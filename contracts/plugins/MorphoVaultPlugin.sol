// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IProtocolAdapter.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/IProxyGeneral.sol";
import "../interfaces/ITokenManagerForModules.sol";
import "../interfaces/IMorphoRegistry.sol";
import "../interfaces/morpho/IERC4626.sol";

/**
 * @title MorphoVaultPlugin
 * @notice Plugin per interazione con MetaMorpho Vaults (ERC-4626) su Arbitrum
 * @dev Complementa il MorphoPlugin (market lending diretto) con la funzionalità vault.
 *      Implementa IProtocolAdapter per integrazione completa con ProtocolManager.
 * 
 * ARCHITETTURA:
 * - MorphoPlugin → interazione diretta con i MARKETS Morpho (supply collateral, borrow, repay)
 * - MorphoVaultPlugin → interazione con VAULTS MetaMorpho (deposit/withdraw in ERC-4626)
 * 
 * I vault MetaMorpho sono contratti ERC-4626 gestiti da curatori (Steakhouse, Gauntlet, kpk, etc.)
 * che allocano liquidità su più markets Morpho sottostanti.
 * 
 * VANTAGGI DEI VAULT vs MARKET DIRETTO:
 * - Diversificazione automatica su N markets
 * - Curating professionale delle allocazioni
 * - APY ottimizzato dal curatore
 * - Nessun rischio di liquidazione (supply-only)
 * 
 * PROTOCOLMANAGER INTEGRATION:
 * - deposit(tokenCode, amount): deposita nel vault di default per quel token
 * - withdraw(tokenCode, amount): ritira dal vault di default
 * - getBalance(tokenCode): restituisce valore in asset nel vault di default
 * - Vault-specific: vaultDeposit/vaultWithdraw/vaultRedeem per operazioni granulari
 * 
 * CUSTODY MODEL:
 * - ProtocolManager invia token al plugin
 * - Plugin deposita nel vault (riceve shares)
 * - Shares rimangono nel plugin (trackate per ProxyGeneral)
 * - Withdraw: plugin brucia shares, trasferisce asset a ProxyGeneral
 * 
 * REGISTRY CONDIVISO:
 * - Vault config (approved vaults, default per tokenCode) vive in MorphoRegistry
 * - MorphoRegistry è lo stesso usato da MorphoPlugin per i market params
 * - activeVaults tracking resta nel plugin (stato runtime, non config)
 * 
 * @author Project4 Team
 * @custom:version 1.2.0
 */
contract MorphoVaultPlugin is IProtocolAdapter, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================== IMMUTABLES ====================

    address public immutable beacon;

    // ==================== STATE ====================

    bool public circuitBreakerTripped;

    /// @notice List of vaults where we have active positions (runtime tracking)
    address[] public activeVaults;

    // ==================== ERRORS ====================

    error InvalidAddress();
    error CircuitBreakerActive();
    error VaultNotApproved(address vault);
    error RegistryNotSet();
    error OnlyProtocolManager();
    error InsufficientBalance(uint256 available, uint256 requested);
    error DepositExceedsMax(uint256 amount, uint256 maxDeposit);
    error WithdrawExceedsMax(uint256 amount, uint256 maxWithdraw);
    error NoDefaultVault(string tokenCode);

    // ==================== EVENTS ====================

    event VaultDeposited(address indexed vault, address indexed asset, uint256 assets, uint256 sharesReceived);
    event VaultWithdrawn(address indexed vault, address indexed asset, uint256 assetsReceived, uint256 sharesBurned);
    event VaultRedeemed(address indexed vault, address indexed asset, uint256 assetsReceived, uint256 sharesRedeemed);
    event VaultApproved(address indexed vault, bool approved);

    // ==================== MODIFIERS ====================

    modifier notCircuitBroken() {
        if (circuitBreakerTripped) revert CircuitBreakerActive();
        _;
    }

    modifier onlyProtocolManager() {
        address protocolManager = IBeacon(beacon).getImplementation("ProtocolManager");
        // PLG-084 fix (DEC-006/009): nessun bypass owner(). Escape hatch = emergencyClosePosition.
        if (msg.sender != protocolManager) {
            revert OnlyProtocolManager();
        }
        _;
    }

    modifier onlyApprovedVault(address vault) {
        if (!_getRegistry().isVaultApproved(vault)) revert VaultNotApproved(vault);
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(address _beacon) Ownable() {
        if (_beacon == address(0)) revert InvalidAddress();
        beacon = _beacon;
    }

    // ==================== IProtocolAdapter: STANDARD ROUTING ====================
    // These route to the default vault for the given tokenCode

    /**
     * @inheritdoc IProtocolAdapter
     * @dev Routes deposit to the default vault for this tokenCode
     */
    function supplyCollateral(string memory collateral, string memory /* loan */, uint256 amount)
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        // Supply-only (loan == collateral): deposita nel vault di default per `collateral`.
        address vault = _getRegistry().getDefaultVault(collateral);
        if (vault == address(0)) revert NoDefaultVault(collateral);
        return _vaultDeposit(vault, amount);
    }

    /**
     * @inheritdoc IProtocolAdapter
     * @dev Routes withdraw to the default vault for `collateral`
     */
    function withdrawCollateral(string memory collateral, string memory /* loan */, uint256 amount)
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        address vault = _getRegistry().getDefaultVault(collateral);
        if (vault == address(0)) revert NoDefaultVault(collateral);
        return _vaultWithdraw(vault, amount);
    }

    /**
     * @inheritdoc IProtocolAdapter
     * @dev Returns total asset value across all active vaults for this tokenCode
     */
    function getBalance(string memory tokenCode)
        external
        view
        override
        returns (uint256 balance)
    {
        address vault = _getRegistry().getDefaultVault(tokenCode);
        if (vault == address(0)) return 0;
        uint256 shares = IERC4626(vault).balanceOf(address(this));
        if (shares == 0) return 0;
        return IERC4626(vault).convertToAssets(shares);
    }

    /**
     * @inheritdoc IProtocolAdapter
     * @dev Vaults have no individual positionId — redeems all from all vaults
     */
    function closePosition(uint256 /* positionId */)
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (uint256 baseAssetReturned)
    {
        // Vault positions are supply-only, return all assets to ProxyGeneral
        address proxyGeneral = _getProxyGeneral();
        address baseAsset = IBeacon(beacon).getImplementation("BASE_ASSET");
        uint256 balBefore = IERC20(baseAsset).balanceOf(proxyGeneral);

        _redeemAllVaults(proxyGeneral);

        baseAssetReturned = IERC20(baseAsset).balanceOf(proxyGeneral) - balBefore;
        emit PositionClosed(0, baseAssetReturned);
    }

    /**
     * @inheritdoc IProtocolAdapter
     * @dev Vaults are supply-only — no target extraction per se, 
     *      but we redeem from vaults and report what came back as base asset
     */
    function closePositionsForBaseAsset(uint256 targetAmount)
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (uint256 obtained, uint256 positionsClosed)
    {
        address proxyGeneral = _getProxyGeneral();
        address baseAsset = IBeacon(beacon).getImplementation("BASE_ASSET");
        uint256 balBefore = IERC20(baseAsset).balanceOf(proxyGeneral);

        // Supply-only: riscatta i vault (snapshot) rispettando targetAmount (CORE-081 fix).
        // targetAmount == type(uint256).max → emergency mode: riscatta tutto.
        address[] memory vaults = activeVaults;
        for (uint256 i = 0; i < vaults.length; i++) {
            IERC4626 v = IERC4626(vaults[i]);
            uint256 shares = v.balanceOf(address(this));
            if (shares > 0) {
                try v.redeem(shares, proxyGeneral, address(this)) {} catch {}
                if (v.balanceOf(address(this)) == 0) _removeActiveVault(vaults[i]);
                positionsClosed++;
            }
            obtained = IERC20(baseAsset).balanceOf(proxyGeneral) - balBefore;
            if (obtained >= targetAmount) break;
        }
    }

    /**
     * @inheritdoc IProtocolAdapter
     */
    function emergencyWithdrawAll(string[] memory /* tokenCodes */)
        external
        override
        onlyOwner
        nonReentrant
        returns (bool)
    {
        address proxyGeneral = _getProxyGeneral();
        _redeemAllVaults(proxyGeneral);

        // Sweep any tokens stuck in the plugin
        for (uint256 i = 0; i < activeVaults.length; i++) {
            address asset = IERC4626(activeVaults[i]).asset();
            uint256 bal = IERC20(asset).balanceOf(address(this));
            if (bal > 0) {
                IERC20(asset).safeTransfer(proxyGeneral, bal);
            }
        }

        delete activeVaults;
        return true;
    }

    /**
     * @inheritdoc IProtocolAdapter
     */
    function activateCircuitBreaker() external override onlyOwner {
        circuitBreakerTripped = true;
        emit CircuitBreakerActivated(msg.sender);
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
    /// @dev Collaterale = valore in asset delle shares nel vault di default per `collateral`.
    function getCollateral(string memory collateral, string memory /* loan */)
        external view override returns (uint256)
    {
        address vault = _getRegistry().getDefaultVault(collateral);
        if (vault == address(0)) return 0;
        uint256 shares = IERC4626(vault).balanceOf(address(this));
        return shares == 0 ? 0 : IERC4626(vault).convertToAssets(shares);
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
        return "MORPHO_VAULT";
    }

    /// @inheritdoc IProtocolAdapter
    /// @dev EMERGENCY escape hatch (supply-only): riscatta il vault di default per `collateral`
    ///      verso ProxyGeneral. onlyOwner.
    function emergencyClosePosition(string memory collateral, string memory /* loan */)
        external override onlyOwner nonReentrant returns (uint256 baseAssetReturned)
    {
        address proxyGeneral = _getProxyGeneral();
        address baseAsset = IBeacon(beacon).getImplementation("BASE_ASSET");
        uint256 balBefore = IERC20(baseAsset).balanceOf(proxyGeneral);

        address vault = _getRegistry().getDefaultVault(collateral);
        if (vault != address(0)) {
            IERC4626 v = IERC4626(vault);
            uint256 shares = v.balanceOf(address(this));
            if (shares > 0) {
                v.redeem(shares, proxyGeneral, address(this));
                if (v.balanceOf(address(this)) == 0) _removeActiveVault(vault);
            }
        }
        baseAssetReturned = IERC20(baseAsset).balanceOf(proxyGeneral) - balBefore;
        emit PositionClosed(0, baseAssetReturned);
    }

    // ==================== VAULT-SPECIFIC OPERATIONS ====================
    // For granular vault control (specific vault address, not via tokenCode routing)

    /**
     * @notice Deposita asset in un MetaMorpho vault specifico
     * @param vault Indirizzo del vault ERC-4626
     * @param amount Quantità di asset da depositare
     * @return shares Shares ERC-4626 ricevute
     */
    function vaultDeposit(address vault, uint256 amount)
        external
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        onlyApprovedVault(vault)
        returns (uint256 shares)
    {
        _vaultDeposit(vault, amount);
        shares = IERC4626(vault).balanceOf(address(this));
    }

    /**
     * @notice Ritira asset da un MetaMorpho vault (specifica asset amount)
     * @param vault Indirizzo del vault ERC-4626
     * @param assets Quantità di asset da ritirare (0 = max)
     * @return sharesBurned Shares bruciate
     */
    function vaultWithdraw(address vault, uint256 assets)
        external
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        onlyApprovedVault(vault)
        returns (uint256 sharesBurned)
    {
        uint256 sharesBefore = IERC4626(vault).balanceOf(address(this));
        _vaultWithdraw(vault, assets);
        sharesBurned = sharesBefore - IERC4626(vault).balanceOf(address(this));
    }

    /**
     * @notice Riscatta shares da un MetaMorpho vault (specifica shares amount)
     * @param vault Indirizzo del vault ERC-4626
     * @param shares Quantità di shares da riscattare (0 = tutte)
     * @return assetsReceived Asset ricevuti
     */
    function vaultRedeem(address vault, uint256 shares)
        external
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        onlyApprovedVault(vault)
        returns (uint256 assetsReceived)
    {
        IERC4626 v = IERC4626(vault);
        address proxyGeneral = _getProxyGeneral();

        uint256 sharesToRedeem = shares == 0 ? v.balanceOf(address(this)) : shares;
        assetsReceived = v.redeem(sharesToRedeem, proxyGeneral, address(this));

        if (v.balanceOf(address(this)) == 0) {
            _removeActiveVault(vault);
        }

        emit VaultRedeemed(vault, v.asset(), assetsReceived, sharesToRedeem);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Shares possedute in un vault
     */
    function getVaultShares(address vault) external view returns (uint256) {
        return IERC4626(vault).balanceOf(address(this));
    }

    /**
     * @notice Valore in asset delle shares possedute in un vault
     */
    function getVaultBalance(address vault) external view returns (uint256) {
        uint256 shares = IERC4626(vault).balanceOf(address(this));
        if (shares == 0) return 0;
        return IERC4626(vault).convertToAssets(shares);
    }

    /**
     * @notice Lista tutti i vault con posizioni attive e i loro valori
     */
    function getAllVaultPositions()
        external
        view
        returns (address[] memory vaults, uint256[] memory balances)
    {
        vaults = activeVaults;
        balances = new uint256[](vaults.length);
        for (uint256 i = 0; i < vaults.length; i++) {
            uint256 shares = IERC4626(vaults[i]).balanceOf(address(this));
            balances[i] = shares > 0 ? IERC4626(vaults[i]).convertToAssets(shares) : 0;
        }
    }

    /**
     * @notice Valore totale in asset di tutti i vault
     */
    function getTotalVaultValue() external view returns (uint256 totalValue) {
        for (uint256 i = 0; i < activeVaults.length; i++) {
            uint256 shares = IERC4626(activeVaults[i]).balanceOf(address(this));
            if (shares > 0) {
                totalValue += IERC4626(activeVaults[i]).convertToAssets(shares);
            }
        }
    }

    /**
     * @notice Number of active vaults
     */
    function getActiveVaultCount() external view returns (uint256) {
        return activeVaults.length;
    }

    // ==================== CIRCUIT BREAKER ====================

    function deactivateCircuitBreaker() external onlyOwner {
        circuitBreakerTripped = false;
    }

    // ==================== INTERNAL ====================

    function _vaultDeposit(address vault, uint256 amount) internal returns (bool) {
        IERC4626 v = IERC4626(vault);
        address asset = v.asset();

        uint256 balance = IERC20(asset).balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance(balance, amount);

        uint256 maxDep = v.maxDeposit(address(this));
        if (amount > maxDep) revert DepositExceedsMax(amount, maxDep);

        IERC20(asset).safeIncreaseAllowance(vault, amount);
        uint256 shares = v.deposit(amount, address(this));

        _addActiveVault(vault);
        emit VaultDeposited(vault, asset, amount, shares);
        return true;
    }

    function _vaultWithdraw(address vault, uint256 assets) internal returns (bool) {
        IERC4626 v = IERC4626(vault);
        address proxyGeneral = _getProxyGeneral();

        uint256 maxWith = v.maxWithdraw(address(this));
        uint256 withdrawAmount = assets == 0 ? maxWith : assets;
        if (withdrawAmount > maxWith) revert WithdrawExceedsMax(withdrawAmount, maxWith);

        uint256 sharesBurned = v.withdraw(withdrawAmount, proxyGeneral, address(this));

        // ERC-4626 rounding may leave a minimal share balance whose asset value
        // is exactly zero. Keeping it would make monitoring report a permanent
        // active position after a complete nominal withdrawal. Burn only this
        // economically empty dust; valuable remaining shares are untouched.
        uint256 remainingShares = v.balanceOf(address(this));
        if (remainingShares > 0 && v.convertToAssets(remainingShares) == 0) {
            v.redeem(remainingShares, proxyGeneral, address(this));
        }

        if (v.balanceOf(address(this)) == 0) {
            _removeActiveVault(vault);
        }

        emit VaultWithdrawn(vault, v.asset(), withdrawAmount, sharesBurned);
        return true;
    }

    function _redeemAllVaults(address receiver) internal {
        // Iterate over a snapshot because successful redemptions remove items
        // from activeVaults. Failed redemptions remain visible for monitoring
        // and incident handling instead of being silently forgotten.
        address[] memory vaults = activeVaults;
        for (uint256 i = 0; i < vaults.length; i++) {
            IERC4626 v = IERC4626(vaults[i]);
            uint256 shares = v.balanceOf(address(this));
            if (shares > 0) {
                try v.redeem(shares, receiver, address(this)) {} catch {}
            }
            if (v.balanceOf(address(this)) == 0) {
                _removeActiveVault(vaults[i]);
            }
        }
    }

    function _getProxyGeneral() internal view returns (address) {
        return IBeacon(beacon).getImplementation("ProxyGeneral");
    }

    function _getRegistry() internal view returns (IMorphoRegistry) {
        address reg = IBeacon(beacon).getImplementation("MorphoRegistry");
        if (reg == address(0)) revert RegistryNotSet();
        return IMorphoRegistry(reg);
    }

    function _addActiveVault(address vault) internal {
        for (uint256 i = 0; i < activeVaults.length; i++) {
            if (activeVaults[i] == vault) return;
        }
        activeVaults.push(vault);
    }

    function _removeActiveVault(address vault) internal {
        for (uint256 i = 0; i < activeVaults.length; i++) {
            if (activeVaults[i] == vault) {
                activeVaults[i] = activeVaults[activeVaults.length - 1];
                activeVaults.pop();
                return;
            }
        }
    }
}
