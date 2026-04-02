// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IMorphoRegistry.sol";
import "../interfaces/morpho/IMorpho.sol";

/**
 * @title MorphoRegistry
 * @notice Registry condiviso per Morpho Blue markets E MetaMorpho vaults su Arbitrum
 * @dev Registrato nel Beacon come "MorphoRegistry"
 *      Usato sia da MorphoPlugin (markets) che da MorphoVaultPlugin (vaults)
 * 
 * MARKETS: Maps (collateralCode, loanCode) → MarketParams completi
 * VAULTS:  Maps vault address → VaultConfig + default vault per tokenCode
 * 
 * DIFFERENZA CHIAVE VS AAVE/EULER:
 * - Aave: tokenCode → (underlying, aToken, debtToken) — un pool condiviso
 * - Euler: tokenCode → vault address (ERC-4626) + sub-account management
 * - Morpho Markets: (collateral, loan) pair → MarketParams con oracle + IRM + LLTV
 * - Morpho Vaults: ERC-4626 MetaMorpho vaults gestiti da curatori
 * 
 * MORPHO BLUE ADDRESS (Arbitrum):
 * - 0x6c247b1F6182318877311737BaC0844bAa518F5e
 * 
 * @author Project4 Team
 */
contract MorphoRegistry is IMorphoRegistry, Ownable {
    using MarketParamsLib for MarketParams;

    // ========== MARKET STATE ==========

    /// @notice Mappa marketKey → MarketConfig
    mapping(bytes32 => MarketConfig) private _marketConfigs;

    /// @notice Array di collateral codes registrati (per iterazione)
    string[] private _collateralCodes;
    string[] private _loanCodes;

    /// @notice Flag per verificare se un market è registrato
    mapping(bytes32 => bool) private _isRegistered;

    // ========== VAULT STATE ==========

    /// @notice Vault address → VaultConfig
    mapping(address => VaultConfig) private _vaultConfigs;

    /// @notice Vault address → approved flag
    mapping(address => bool) private _vaultApproved;

    /// @notice Lista vault registrati (per iterazione)
    address[] private _registeredVaults;

    /// @notice assetCode → default vault address per routing IProtocolAdapter
    mapping(string => address) private _defaultVaults;

    // ========== CONSTRUCTOR ==========

    constructor() Ownable() {}

    // ========== INTERNAL HELPERS ==========

    /// @dev Compute a unique key for a (collateralCode, loanCode) pair
    function _marketKey(string memory collateralCode, string memory loanCode)
        internal pure returns (bytes32)
    {
        return keccak256(abi.encodePacked(collateralCode, "|", loanCode));
    }

    // ========== ADMIN FUNCTIONS ==========

    /**
     * @notice Configura un mercato Morpho Blue
     * @dev Solo owner può chiamare. Computa automaticamente il marketId.
     * @param collateralCode Codice collaterale (es. "WETH")
     * @param loanCode Codice prestito (es. "USDC")
     * @param collateralToken Indirizzo del token collaterale
     * @param loanToken Indirizzo del loan token
     * @param oracle Indirizzo dell'oracolo Morpho per questo mercato
     * @param irm Indirizzo dell'Interest Rate Model
     * @param lltv Liquidation LTV (scaled 1e18, es. 0.86e18 = 86%)
     */
    function configureMarket(
        string memory collateralCode,
        string memory loanCode,
        address collateralToken,
        address loanToken,
        address oracle,
        address irm,
        uint256 lltv
    ) external override onlyOwner {
        if (bytes(collateralCode).length == 0 || bytes(loanCode).length == 0) revert TokenCodeEmpty();
        if (collateralToken == address(0) || loanToken == address(0)) revert InvalidAddress();
        if (oracle == address(0) || irm == address(0)) revert InvalidAddress();

        bytes32 key = _marketKey(collateralCode, loanCode);
        bool isNew = !_isRegistered[key];

        MarketParams memory params = MarketParams({
            loanToken: loanToken,
            collateralToken: collateralToken,
            oracle: oracle,
            irm: irm,
            lltv: lltv
        });

        Id marketId = params.id();

        _marketConfigs[key] = MarketConfig({
            params: params,
            marketId: marketId,
            isActive: true
        });

        if (isNew) {
            _collateralCodes.push(collateralCode);
            _loanCodes.push(loanCode);
            _isRegistered[key] = true;
        }

        emit MarketConfigured(collateralCode, loanCode, marketId, oracle, irm, lltv);
    }

    /**
     * @notice Set market active/inactive
     */
    function setMarketStatus(
        string memory collateralCode,
        string memory loanCode,
        bool isActive
    ) external override onlyOwner {
        bytes32 key = _marketKey(collateralCode, loanCode);
        if (!_isRegistered[key]) revert MarketNotConfigured(collateralCode, loanCode);

        _marketConfigs[key].isActive = isActive;
        emit MarketStatusChanged(collateralCode, loanCode, isActive);
    }

    // ========== VIEW FUNCTIONS ==========

    function getMarketConfig(string memory collateralCode, string memory loanCode)
        external view override returns (MarketConfig memory)
    {
        bytes32 key = _marketKey(collateralCode, loanCode);
        if (!_isRegistered[key]) revert MarketNotConfigured(collateralCode, loanCode);
        return _marketConfigs[key];
    }

    function getMarketParams(string memory collateralCode, string memory loanCode)
        external view override returns (MarketParams memory)
    {
        bytes32 key = _marketKey(collateralCode, loanCode);
        if (!_isRegistered[key]) revert MarketNotConfigured(collateralCode, loanCode);
        return _marketConfigs[key].params;
    }

    function getMarketId(string memory collateralCode, string memory loanCode)
        external view override returns (Id)
    {
        bytes32 key = _marketKey(collateralCode, loanCode);
        if (!_isRegistered[key]) revert MarketNotConfigured(collateralCode, loanCode);
        return _marketConfigs[key].marketId;
    }

    function isMarketConfigured(string memory collateralCode, string memory loanCode)
        external view override returns (bool)
    {
        bytes32 key = _marketKey(collateralCode, loanCode);
        return _isRegistered[key];
    }

    function getRegisteredMarkets()
        external view override returns (string[] memory collateralCodes, string[] memory loanCodes)
    {
        return (_collateralCodes, _loanCodes);
    }

    function getRegisteredMarketCount() external view override returns (uint256) {
        return _collateralCodes.length;
    }

    // ========== VAULT ADMIN FUNCTIONS ==========

    /**
     * @notice Configura un MetaMorpho vault ERC-4626
     * @param vault Indirizzo del MetaMorpho vault
     * @param assetCode Codice asset sottostante (es. "USDC")
     */
    function configureVault(address vault, string memory assetCode) external override onlyOwner {
        if (vault == address(0)) revert InvalidAddress();
        if (bytes(assetCode).length == 0) revert TokenCodeEmpty();

        bool isNew = !_vaultApproved[vault];

        _vaultConfigs[vault] = VaultConfig({
            vault: vault,
            assetCode: assetCode,
            isActive: true
        });
        _vaultApproved[vault] = true;

        if (isNew) {
            _registeredVaults.push(vault);
        }

        emit VaultConfigured(vault, assetCode);
    }

    /**
     * @notice Rimuove un vault dal registry
     */
    function removeVault(address vault) external override onlyOwner {
        if (!_vaultApproved[vault]) revert VaultNotConfigured(vault);

        delete _vaultConfigs[vault];
        _vaultApproved[vault] = false;

        // Rimuovi dall'array (swap-and-pop)
        for (uint256 i = 0; i < _registeredVaults.length; i++) {
            if (_registeredVaults[i] == vault) {
                _registeredVaults[i] = _registeredVaults[_registeredVaults.length - 1];
                _registeredVaults.pop();
                break;
            }
        }

        emit VaultRemoved(vault);
    }

    /**
     * @notice Set vault active/inactive
     */
    function setVaultStatus(address vault, bool isActive) external override onlyOwner {
        if (!_vaultApproved[vault]) revert VaultNotConfigured(vault);
        _vaultConfigs[vault].isActive = isActive;
        emit VaultStatusChanged(vault, isActive);
    }

    /**
     * @notice Set default vault per un assetCode (usato da MorphoVaultPlugin.deposit())
     */
    function setDefaultVault(string memory assetCode, address vault) external override onlyOwner {
        if (!_vaultApproved[vault]) revert VaultNotConfigured(vault);
        if (bytes(assetCode).length == 0) revert TokenCodeEmpty();
        _defaultVaults[assetCode] = vault;
        emit DefaultVaultSet(assetCode, vault);
    }

    // ========== VAULT VIEW FUNCTIONS ==========

    function isVaultApproved(address vault) external view override returns (bool) {
        return _vaultApproved[vault] && _vaultConfigs[vault].isActive;
    }

    function getVaultConfig(address vault) external view override returns (VaultConfig memory) {
        if (!_vaultApproved[vault]) revert VaultNotConfigured(vault);
        return _vaultConfigs[vault];
    }

    function getDefaultVault(string memory assetCode) external view override returns (address) {
        return _defaultVaults[assetCode];
    }

    function getRegisteredVaults() external view override returns (address[] memory) {
        return _registeredVaults;
    }

    function getRegisteredVaultCount() external view override returns (uint256) {
        return _registeredVaults.length;
    }
}
