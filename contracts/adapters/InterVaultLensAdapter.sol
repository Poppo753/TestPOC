// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/ILiquidityManager.sol";
import "../interfaces/IProtocolAdapter.sol";
import "../interfaces/ITokenManagerForModules.sol";
import "../interfaces/metavault/IInterVaultLensAdapter.sol";
import "../interfaces/metavault/IInterVaultPlugin.sol";
import "../interfaces/metavault/IInterVaultRegistry.sol";

/**
 * @title InterVaultLensAdapter
 * @notice Read-only valuation boundary for leaf LPTs held by InterVaultPlugin.
 * @dev Values are returned in the parent vault base-asset units, matching the
 *      convention already used by ValueCalculator and the other Lens adapters.
 */
contract InterVaultLensAdapter is IInterVaultLensAdapter {
    using Math for uint256;

    address public immutable beacon;
    IInterVaultRegistry public immutable registry;
    IInterVaultPlugin public immutable plugin;
    string public baseAssetCode;

    error InvalidAddress();
    error InvalidPosition(uint256 positionId);
    error ValuationUnavailable(string tokenCode);

    constructor(address _beacon, address _registry, address _plugin, string memory _baseAssetCode) {
        if (_beacon == address(0) || _registry == address(0) || _plugin == address(0)) revert InvalidAddress();
        if (_beacon.code.length == 0 || _registry.code.length == 0 || _plugin.code.length == 0) revert InvalidAddress();
        beacon = _beacon;
        registry = IInterVaultRegistry(_registry);
        plugin = IInterVaultPlugin(_plugin);
        baseAssetCode = _baseAssetCode;
    }

    function protocolName() external pure override returns (string memory) { return "InterVault"; }
    function protocolType() external pure override returns (IProtocolAdapter.ProtocolType) { return IProtocolAdapter.ProtocolType.YIELD; }
    function isCircuitBreakerActive() external view override returns (bool) { return plugin.circuitBreakerTripped(); }
    function getPlugin() external view override returns (address) { return address(plugin); }

    function getTotalValue() public view override returns (uint256 netValue) {
        bytes32[] memory ids = registry.getChildIds();
        for (uint256 i = 0; i < ids.length; i++) netValue += _positionValue(registry.getChild(ids[i]));
    }

    function getValueBreakdown() external view override returns (ValueBreakdown memory breakdown) {
        ChildPosition[] memory positions = _allPositions();
        for (uint256 i = 0; i < positions.length; i++) {
            breakdown.totalCollateral += positions[i].valueInParentBase;
            breakdown.availableToWithdraw += positions[i].availableInParentBase;
        }
        breakdown.netValue = breakdown.totalCollateral;
    }

    function getActivePositionCount() public view override returns (uint256 count) {
        bytes32[] memory ids = registry.getChildIds();
        for (uint256 i = 0; i < ids.length; i++) {
            IInterVaultRegistry.ChildVault memory child = registry.getChild(ids[i]);
            if (IERC20(child.shareToken).balanceOf(address(plugin)) > 0) count++;
        }
    }

    function getProtocolSummary() external view override returns (ProtocolSummary memory summary) {
        uint256 total = getTotalValue();
        summary.name = "InterVault";
        summary.protocolType = IProtocolAdapter.ProtocolType.YIELD;
        summary.totalCollateral = total;
        summary.totalDebt = 0;
        summary.netValue = total;
        summary.activePositionCount = getActivePositionCount();
        summary.lowestHealthFactor = type(uint256).max;
        summary.isHealthy = !plugin.circuitBreakerTripped();
    }

    function getHealthFactor() external pure override returns (uint256) { return type(uint256).max; }
    function getPositionHealth(uint256 positionId) external view override returns (HealthInfo memory info) {
        if (!registry.isChildRegistered(bytes32(positionId))) revert InvalidPosition(positionId);
        return _safeHealth();
    }
    function getAccountHealth() external pure override returns (HealthInfo memory info) { return _safeHealth(); }
    function getPositionsAtRisk(uint256) external pure override returns (PositionWithRisk[] memory) {
        return new PositionWithRisk[](0);
    }

    function getPositionsSortedByRisk() external view override returns (PositionWithRisk[] memory positions) {
        ChildPosition[] memory childPositions = _allPositions();
        uint256 count;
        for (uint256 i = 0; i < childPositions.length; i++) if (childPositions[i].shares > 0) count++;
        positions = new PositionWithRisk[](count);
        uint256 cursor;
        for (uint256 i = 0; i < childPositions.length; i++) {
            if (childPositions[i].shares == 0) continue;
            positions[cursor++] = PositionWithRisk({
                positionId: uint256(childPositions[i].childId),
                protocolName: "InterVault",
                healthFactor: type(uint256).max,
                timeToLiquidation: type(int256).max,
                riskLevel: "SAFE",
                collateral: childPositions[i].valueInParentBase,
                debt: 0,
                shouldAutoClose: false
            });
        }
    }

    function getYieldInfo(string memory) external pure override returns (YieldInfo memory info) { return info; }
    function getNetAPY() external pure override returns (int256) { return 0; }
    function getVaultForToken(string memory tokenCode) external view override returns (address) {
        return registry.getChildForToken(tokenCode).shareToken;
    }
    function estimateBaseAssetFromCloseAll() external view override returns (uint256) {
        return getTotalValue();
    }
    function getLiquidationThreshold(uint256) external pure override returns (uint256) { return 0; }
    function estimatePositionAfterSwap(uint256, address, address, uint256)
        external pure override returns (uint256, uint256, uint256)
    { return (0, 0, type(uint256).max); }
    function getProtocolLimits() external pure override returns (uint256 minHealthFactor, uint256 maxLeverage) {
        return (type(uint256).max, 100);
    }

    function getChildPosition(bytes32 childId) external view override returns (ChildPosition memory position) {
        return _position(childId);
    }
    function getAllChildPositions() external view override returns (ChildPosition[] memory positions) {
        return _allPositions();
    }

    function _allPositions() private view returns (ChildPosition[] memory positions) {
        bytes32[] memory ids = registry.getChildIds();
        positions = new ChildPosition[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) positions[i] = _position(ids[i]);
    }

    function _position(bytes32 childId) private view returns (ChildPosition memory position) {
        IInterVaultRegistry.ChildVault memory child = registry.getChild(childId);
        uint256 shares = IERC20(child.shareToken).balanceOf(address(plugin));
        uint256 assets = shares == 0 ? 0 : ILiquidityManager(child.liquidityManager).calculateWithdrawAmount(shares);
        uint256 value = _toParentBase(child, assets);
        uint256 available;
        if (shares > 0 && child.withdrawalsEnabled) {
            try ILiquidityManager(child.liquidityManager).canWithdraw(address(plugin), shares) returns (bool allowed, string memory) {
                if (allowed) available = value;
            } catch { available = 0; }
        }
        // Never call the parent ValueCalculator here: it calls this Lens while
        // aggregating protocol values, so doing so would recurse until OOG.
        // This percentage is intentionally the weight inside the InterVault
        // sleeve. Off-chain reporting can combine getTotalValue() with the
        // parent NAV to calculate the sleeve's percentage of the whole vault.
        uint256 interVaultValue = getTotalValue();
        position = ChildPosition({
            childId: childId,
            tokenCode: child.tokenCode,
            shareToken: child.shareToken,
            shares: shares,
            underlyingAssets: assets,
            valueInParentBase: value,
            availableInParentBase: available,
            exposureBps: interVaultValue == 0 ? 0 : Math.mulDiv(value, 10_000, interVaultValue),
            active: child.active,
            depositsEnabled: child.depositsEnabled,
            withdrawalsEnabled: child.withdrawalsEnabled
        });
    }

    function _positionValue(IInterVaultRegistry.ChildVault memory child) private view returns (uint256) {
        uint256 shares = IERC20(child.shareToken).balanceOf(address(plugin));
        if (shares == 0) return 0;
        return _toParentBase(child, ILiquidityManager(child.liquidityManager).calculateWithdrawAmount(shares));
    }

    function _toParentBase(IInterVaultRegistry.ChildVault memory child, uint256 amount) private view returns (uint256) {
        if (amount == 0) return 0;
        address baseAsset = IBeacon(beacon).getImplementation("BASE_ASSET");
        if (child.baseAsset == baseAsset) return amount;
        ITokenManagerForModules manager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
        uint256 tokenPrice = manager.getTokenPriceForModule(child.tokenCode);
        uint256 basePrice = manager.getBaseAssetPrice();
        if (tokenPrice == 0 || basePrice == 0) revert ValuationUnavailable(child.tokenCode);
        uint8 baseDecimals = IERC20Metadata(baseAsset).decimals();
        uint256 valueAtPriceScale = Math.mulDiv(amount, tokenPrice, 10 ** child.assetDecimals);
        return Math.mulDiv(valueAtPriceScale, 10 ** baseDecimals, basePrice);
    }

    function _safeHealth() private pure returns (HealthInfo memory info) {
        info.healthFactor = type(uint256).max;
        info.liquidationThreshold = 0;
        info.timeToLiquidation = type(int256).max;
        info.riskLevel = "SAFE";
        info.isHealthy = true;
    }
}
