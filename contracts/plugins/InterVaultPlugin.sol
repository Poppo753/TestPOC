// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/ILiquidityManager.sol";
import "../interfaces/IProxyGeneral.sol";
import "../interfaces/ITokenManagerForModules.sol";
import "../interfaces/metavault/IInterVaultPlugin.sol";
import "../interfaces/metavault/IInterVaultRegistry.sol";

interface IInterVaultValueCalculator {
    function getTotalPoolValueView() external view returns (uint256);
}

interface IInterVaultChildDirectory {
    function getImplementation(string memory moduleName) external view returns (address);
    function checkModuleExists(string memory moduleName) external view returns (bool);
}

/**
 * @title InterVaultPlugin
 * @notice The only capital-moving adapter between a local MetaVault and its leaf vaults.
 * @dev This contract intentionally implements the existing IProtocolAdapter surface.
 *      tokenCode is a real asset code and the Registry resolves its one canonical child.
 *      It never swaps, borrows, accepts arbitrary calldata or accepts a caller-selected
 *      recipient. Child LPTs remain in this contract exactly as aTokens/eVault shares
 *      remain in their protocol plugins.
 */
contract InterVaultPlugin is IInterVaultPlugin, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    uint16 private constant BPS = 10_000;
    address public immutable beacon;
    IInterVaultRegistry public immutable registry;
    string public baseAssetCode;
    bool public override circuitBreakerTripped;

    bytes32[] private activeChildIds;
    mapping(bytes32 => uint256) private activeIndexPlusOne;

    error InvalidAddress();
    error InvalidAmount();
    error OnlyProtocolManager();
    error CircuitBreakerActive();
    error ChildInactive(bytes32 childId);
    error DepositsDisabled(bytes32 childId);
    error WithdrawalsDisabled(bytes32 childId);
    error EmergencyOnly(bytes32 childId);
    error AssetMismatch(address expected, address actual);
    error InsufficientBalance(uint256 available, uint256 requested);
    error DepositLimitExceeded(uint256 requested, uint256 maximum);
    error ExposureCapExceeded(uint256 prospectiveBps, uint256 maximumBps);
    error InsufficientSharesOut(uint256 received, uint256 minimum);
    error InsufficientAssetsOut(uint256 received, uint256 minimum);
    error ResidualAllowance(uint256 allowance);
    error ValuationUnavailable();
    error InvalidPosition(uint256 positionId);
    error ChildComponentDrift(bytes32 childId, string component, address expected, address actual);
    error ChildHasInterVaultCapability(bytes32 childId);

    event ChildDeposited(bytes32 indexed childId, string tokenCode, uint256 assets, uint256 sharesReceived);
    event ChildWithdrawn(bytes32 indexed childId, string tokenCode, uint256 assetsRequested, uint256 assetsReceived, uint256 sharesBurned);
    event ChildEmergencyWithdrawn(bytes32 indexed childId, string tokenCode, uint256 assetsReceived, uint256 sharesBurned);
    event ChildEmergencyWithdrawFailed(bytes32 indexed childId, string tokenCode, bytes reason);
    event ActiveChildAdded(bytes32 indexed childId);
    event ActiveChildRemoved(bytes32 indexed childId);
    event CircuitBreakerDeactivated(address indexed caller);

    modifier onlyProtocolManager() {
        address manager = IBeacon(beacon).getImplementation("ProtocolManager");
        // PLG-084 fix (DEC-006/009): nessun bypass owner(). Escape hatch = emergencyClosePosition.
        if (msg.sender != manager) revert OnlyProtocolManager();
        _;
    }

    modifier notCircuitBroken() {
        if (circuitBreakerTripped) revert CircuitBreakerActive();
        _;
    }

    constructor(address _beacon, address _registry, string memory _baseAssetCode) Ownable() {
        if (_beacon == address(0) || _registry == address(0) || bytes(_baseAssetCode).length == 0) revert InvalidAddress();
        if (_beacon.code.length == 0 || _registry.code.length == 0) revert InvalidAddress();
        beacon = _beacon;
        registry = IInterVaultRegistry(_registry);
        baseAssetCode = _baseAssetCode;
    }

    function supplyCollateral(string memory collateral, string memory /* loan */, uint256 amount)
        external override onlyProtocolManager notCircuitBroken nonReentrant returns (bool)
    {
        string memory tokenCode = collateral; // supply-only: loan == collateral
        if (amount == 0) revert InvalidAmount();
        IInterVaultRegistry.ChildVault memory child = registry.getChildForToken(tokenCode);
        _requireDepositable(child);
        _requireChildIntegrity(child);
        if (amount > child.maxDepositAssets) revert DepositLimitExceeded(amount, child.maxDepositAssets);
        address asset = _resolveToken(tokenCode);
        if (asset != child.baseAsset) revert AssetMismatch(child.baseAsset, asset);
        uint256 balance = IERC20(asset).balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance(balance, amount);
        _checkProspectiveCap(child, amount);

        uint256 expectedShares = ILiquidityManager(child.liquidityManager).calculateDepositShares(amount);
        if (expectedShares == 0) revert InsufficientSharesOut(0, 1);
        uint256 minimumShares = Math.mulDiv(expectedShares, BPS - child.maxShareDeviationBps, BPS);
        uint256 sharesBefore = IERC20(child.shareToken).balanceOf(address(this));

        IERC20(asset).safeApprove(child.liquidityManager, 0);
        IERC20(asset).safeApprove(child.liquidityManager, amount);
        ILiquidityManager(child.liquidityManager).deposit(amount);
        IERC20(asset).safeApprove(child.liquidityManager, 0);
        uint256 residual = IERC20(asset).allowance(address(this), child.liquidityManager);
        if (residual != 0) revert ResidualAllowance(residual);

        uint256 sharesReceived = IERC20(child.shareToken).balanceOf(address(this)) - sharesBefore;
        if (sharesReceived < minimumShares) revert InsufficientSharesOut(sharesReceived, minimumShares);
        _addActiveChild(child.childId);
        emit ChildDeposited(child.childId, tokenCode, amount, sharesReceived);
        return true;
    }

    function withdrawCollateral(string memory collateral, string memory /* loan */, uint256 amount)
        external override onlyProtocolManager notCircuitBroken nonReentrant returns (bool)
    {
        string memory tokenCode = collateral; // supply-only: loan == collateral
        if (amount == 0) revert InvalidAmount();
        IInterVaultRegistry.ChildVault memory child = registry.getChildForToken(tokenCode);
        _requireWithdrawable(child);
        _withdrawAssets(child, amount, false);
        return true;
    }

    function getBalance(string memory tokenCode) external view override returns (uint256 balance) {
        IInterVaultRegistry.ChildVault memory child = registry.getChildForToken(tokenCode);
        uint256 shares = IERC20(child.shareToken).balanceOf(address(this));
        return shares == 0 ? 0 : ILiquidityManager(child.liquidityManager).calculateWithdrawAmount(shares);
    }

    function closePosition(uint256 positionId)
        external override onlyProtocolManager notCircuitBroken nonReentrant returns (uint256 baseAssetReturned)
    {
        // Lens position IDs are the complete bytes32 child IDs encoded as a
        // uint256. They are stable even when activeChildIds is compacted.
        bytes32 childId = bytes32(positionId);
        if (!registry.isChildRegistered(childId)) revert InvalidPosition(positionId);
        IInterVaultRegistry.ChildVault memory child = registry.getChild(childId);
        uint256 beforeBalance = IERC20(child.baseAsset).balanceOf(_getProxyGeneral());
        _withdrawAll(child, false);
        if (child.baseAsset == _getBaseAsset()) {
            baseAssetReturned = IERC20(child.baseAsset).balanceOf(_getProxyGeneral()) - beforeBalance;
        }
        emit PositionClosed(positionId, baseAssetReturned);
    }

    function closePositionsForBaseAsset(uint256 targetAmount)
        external override onlyProtocolManager notCircuitBroken nonReentrant
        returns (uint256 baseAssetObtained, uint256 positionsClosed)
    {
        IInterVaultRegistry.ChildVault memory child = registry.getChildForToken(baseAssetCode);
        _requireWithdrawable(child);
        uint256 available = _childAssets(child);
        if (available == 0) return (0, 0);
        uint256 requested = targetAmount == 0 || targetAmount > available ? available : targetAmount;
        uint256 beforeBalance = IERC20(child.baseAsset).balanceOf(_getProxyGeneral());
        _withdrawAssets(child, requested, false);
        baseAssetObtained = IERC20(child.baseAsset).balanceOf(_getProxyGeneral()) - beforeBalance;
        positionsClosed = 1;
    }

    function emergencyWithdrawAll(string[] memory tokenCodes)
        external override onlyProtocolManager nonReentrant returns (bool success)
    {
        success = true;
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            IInterVaultRegistry.ChildVault memory child = registry.getChildForToken(tokenCodes[i]);
            uint256 shares = IERC20(child.shareToken).balanceOf(address(this));
            if (shares == 0) continue;
            uint256 assetsBefore = IERC20(child.baseAsset).balanceOf(address(this));
            try ILiquidityManager(child.liquidityManager).withdraw(shares) returns (uint256) {
                // Never trust a child-reported return amount. Custody movement
                // is based exclusively on the ERC-20 delta actually received.
                uint256 assetsReceived = IERC20(child.baseAsset).balanceOf(address(this)) - assetsBefore;
                if (assetsReceived > 0) IERC20(child.baseAsset).safeTransfer(_getProxyGeneral(), assetsReceived);
                _removeActiveChildIfEmpty(child.childId, child.shareToken);
                emit ChildEmergencyWithdrawn(child.childId, tokenCodes[i], assetsReceived, shares);
            } catch (bytes memory reason) {
                // Do not return false: ProtocolManager would revert the whole
                // call and undo every successful child exit. The failed child
                // remains in activeChildIds and its shares remain observable.
                emit ChildEmergencyWithdrawFailed(child.childId, tokenCodes[i], reason);
            }
        }
    }

    function activateCircuitBreaker() external override onlyOwner {
        circuitBreakerTripped = true;
        emit CircuitBreakerActivated(msg.sender);
    }

    function deactivateCircuitBreaker() external override onlyOwner {
        circuitBreakerTripped = false;
        emit CircuitBreakerDeactivated(msg.sender);
    }

    function getActiveChildIds() external view override returns (bytes32[] memory) { return activeChildIds; }
    function getChildShares(bytes32 childId) external view override returns (uint256) {
        IInterVaultRegistry.ChildVault memory child = registry.getChild(childId);
        return IERC20(child.shareToken).balanceOf(address(this));
    }
    function getChildAssets(bytes32 childId) external view override returns (uint256) {
        return _childAssets(registry.getChild(childId));
    }

    // ==================== IProtocolAdapter: LENDING (supply-only → revert) ====================

    /// @inheritdoc IProtocolAdapter
    /// @dev Supply-only (DEC-009): borrow non supportato.
    function borrow(string memory, string memory, uint256) external pure override returns (bool) {
        revert UnsupportedOperation();
    }

    /// @inheritdoc IProtocolAdapter
    /// @dev Supply-only (DEC-009): repay non supportato.
    function repay(string memory, string memory, uint256) external pure override returns (bool) {
        revert UnsupportedOperation();
    }

    /// @inheritdoc IProtocolAdapter
    /// @dev Collaterale = valore in asset delle shares nel child per `collateral`.
    function getCollateral(string memory collateral, string memory /* loan */)
        external view override returns (uint256)
    {
        IInterVaultRegistry.ChildVault memory child = registry.getChildForToken(collateral);
        uint256 shares = IERC20(child.shareToken).balanceOf(address(this));
        return shares == 0 ? 0 : ILiquidityManager(child.liquidityManager).calculateWithdrawAmount(shares);
    }

    /// @inheritdoc IProtocolAdapter
    /// @dev Supply-only: nessun debito.
    function getDebt(string memory, string memory) external pure override returns (uint256) {
        return 0;
    }

    /// @inheritdoc IProtocolAdapter
    /// @dev Supply-only: nessun debito → health factor infinito.
    function getHealthFactor(string memory, string memory) external pure override returns (uint256) {
        return type(uint256).max;
    }

    /// @inheritdoc IProtocolAdapter
    function protocolType() external pure override returns (string memory) {
        return "INTERVAULT";
    }

    /// @inheritdoc IProtocolAdapter
    /// @dev EMERGENCY escape hatch (supply-only): ritira tutto il child per `collateral`
    ///      verso ProxyGeneral. onlyOwner.
    function emergencyClosePosition(string memory collateral, string memory /* loan */)
        external override onlyOwner nonReentrant returns (uint256 baseAssetReturned)
    {
        IInterVaultRegistry.ChildVault memory child = registry.getChildForToken(collateral);
        uint256 beforeBalance = IERC20(child.baseAsset).balanceOf(_getProxyGeneral());
        _withdrawAll(child, true);
        if (child.baseAsset == _getBaseAsset()) {
            baseAssetReturned = IERC20(child.baseAsset).balanceOf(_getProxyGeneral()) - beforeBalance;
        }
        emit PositionClosed(0, baseAssetReturned);
    }

    function _withdrawAssets(IInterVaultRegistry.ChildVault memory child, uint256 amount, bool emergency) private {
        if (!emergency) _requireWithdrawable(child);
        uint256 sharesBefore = IERC20(child.shareToken).balanceOf(address(this));
        uint256 positionAssets = sharesBefore == 0 ? 0 : ILiquidityManager(child.liquidityManager).calculateWithdrawAmount(sharesBefore);
        if (amount > positionAssets) revert InsufficientBalance(positionAssets, amount);
        uint256 sharesToBurn = Math.mulDiv(amount, sharesBefore, positionAssets, Math.Rounding.Up);
        address asset = child.baseAsset;
        uint256 assetBefore = IERC20(asset).balanceOf(address(this));
        ILiquidityManager(child.liquidityManager).withdraw(sharesToBurn);
        uint256 assetsReceived = IERC20(asset).balanceOf(address(this)) - assetBefore;
        if (assetsReceived < amount) revert InsufficientAssetsOut(assetsReceived, amount);
        IERC20(asset).safeTransfer(_getProxyGeneral(), assetsReceived);
        uint256 sharesAfter = IERC20(child.shareToken).balanceOf(address(this));
        _removeActiveChildIfEmpty(child.childId, child.shareToken);
        emit ChildWithdrawn(child.childId, child.tokenCode, amount, assetsReceived, sharesBefore - sharesAfter);
    }

    function _withdrawAll(IInterVaultRegistry.ChildVault memory child, bool emergency) private {
        uint256 shares = IERC20(child.shareToken).balanceOf(address(this));
        if (shares == 0) return;
        uint256 assets = ILiquidityManager(child.liquidityManager).calculateWithdrawAmount(shares);
        _withdrawAssets(child, assets, emergency);
    }

    function _checkProspectiveCap(IInterVaultRegistry.ChildVault memory child, uint256 amount) private view {
        uint256 depositValue = _toParentBase(child.tokenCode, child.baseAsset, child.assetDecimals, amount);
        uint256 currentChildValue = _toParentBase(child.tokenCode, child.baseAsset, child.assetDecimals, _childAssets(child));
        address calculator = IBeacon(beacon).getImplementation("ValueCalculator");
        uint256 parentValueAfterTransfer;
        try IInterVaultValueCalculator(calculator).getTotalPoolValueView() returns (uint256 value) {
            parentValueAfterTransfer = value;
        } catch { revert ValuationUnavailable(); }
        uint256 postParent = parentValueAfterTransfer + depositValue;
        if (postParent == 0) revert ValuationUnavailable();
        uint256 prospectiveBps = Math.mulDiv(currentChildValue + depositValue, BPS, postParent);
        if (prospectiveBps > child.maxExposureBps) revert ExposureCapExceeded(prospectiveBps, child.maxExposureBps);
    }

    function _toParentBase(string memory tokenCode, address token, uint8 tokenDecimals, uint256 amount) private view returns (uint256) {
        if (amount == 0) return 0;
        address baseAsset = _getBaseAsset();
        if (token == baseAsset) return amount;
        address managerAddress = IBeacon(beacon).getImplementation("TokenManager");
        ITokenManagerForModules manager = ITokenManagerForModules(managerAddress);
        uint256 tokenPrice = manager.getTokenPriceForModule(tokenCode);
        uint256 basePrice = manager.getBaseAssetPrice();
        if (tokenPrice == 0 || basePrice == 0) revert ValuationUnavailable();
        uint8 baseDecimals = IERC20Metadata(baseAsset).decimals();
        uint256 valueAtPriceScale = Math.mulDiv(amount, tokenPrice, 10 ** tokenDecimals);
        return Math.mulDiv(valueAtPriceScale, 10 ** baseDecimals, basePrice);
    }

    function _childAssets(IInterVaultRegistry.ChildVault memory child) private view returns (uint256) {
        uint256 shares = IERC20(child.shareToken).balanceOf(address(this));
        return shares == 0 ? 0 : ILiquidityManager(child.liquidityManager).calculateWithdrawAmount(shares);
    }

    function _resolveToken(string memory tokenCode) private view returns (address) {
        if (keccak256(bytes(tokenCode)) == keccak256(bytes(baseAssetCode))) return _getBaseAsset();
        return ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager")).getTokenAddress(tokenCode);
    }

    function _requireDepositable(IInterVaultRegistry.ChildVault memory child) private pure {
        if (!child.active) revert ChildInactive(child.childId);
        if (!child.depositsEnabled) revert DepositsDisabled(child.childId);
        if (child.emergencyOnly) revert EmergencyOnly(child.childId);
    }

    function _requireWithdrawable(IInterVaultRegistry.ChildVault memory child) private pure {
        if (!child.withdrawalsEnabled) revert WithdrawalsDisabled(child.childId);
    }

    function _requireChildIntegrity(IInterVaultRegistry.ChildVault memory child) private view {
        IInterVaultChildDirectory directory = IInterVaultChildDirectory(child.childBeacon);
        _requireCurrentComponent(directory, child.childId, "LiquidityManager", child.liquidityManager);
        _requireCurrentComponent(directory, child.childId, "ProxyGeneral", child.shareToken);
        _requireCurrentComponent(directory, child.childId, "ValueCalculator", child.valueCalculator);
        _requireCurrentComponent(directory, child.childId, "BASE_ASSET", child.baseAsset);
        if (directory.checkModuleExists("InterVaultPlugin")) revert ChildHasInterVaultCapability(child.childId);
    }

    function _requireCurrentComponent(
        IInterVaultChildDirectory directory,
        bytes32 childId,
        string memory component,
        address expected
    ) private view {
        address actual = directory.getImplementation(component);
        if (actual != expected) revert ChildComponentDrift(childId, component, expected, actual);
    }

    function _addActiveChild(bytes32 childId) private {
        if (activeIndexPlusOne[childId] != 0) return;
        activeChildIds.push(childId);
        activeIndexPlusOne[childId] = activeChildIds.length;
        emit ActiveChildAdded(childId);
    }

    function _removeActiveChildIfEmpty(bytes32 childId, address shareToken) private {
        if (IERC20(shareToken).balanceOf(address(this)) != 0) return;
        uint256 indexPlusOne = activeIndexPlusOne[childId];
        if (indexPlusOne == 0) return;
        uint256 index = indexPlusOne - 1;
        bytes32 last = activeChildIds[activeChildIds.length - 1];
        activeChildIds[index] = last;
        activeIndexPlusOne[last] = index + 1;
        activeChildIds.pop();
        delete activeIndexPlusOne[childId];
        emit ActiveChildRemoved(childId);
    }

    function _getProxyGeneral() private view returns (address) { return IBeacon(beacon).getImplementation("ProxyGeneral"); }
    function _getBaseAsset() private view returns (address) { return IBeacon(beacon).getImplementation("BASE_ASSET"); }
}
