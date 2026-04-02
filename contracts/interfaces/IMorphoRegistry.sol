// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./morpho/IMorpho.sol";

/**
 * @title IMorphoRegistry
 * @notice Interface for MorphoRegistry
 * @dev Maps tokenCode pairs → MarketParams for Morpho Blue isolated markets.
 *      Unlike Aave (single pool) or Euler (per-token vaults), Morpho uses
 *      isolated markets identified by (loanToken, collateralToken, oracle, irm, lltv).
 * 
 * DIFFERENZA CHIAVE:
 * - Aave Registry: tokenCode → (underlying, aToken, debtToken)
 * - Euler Registry: tokenCode → vault, plus sub-account management
 * - Morpho Registry: marketKey → MarketParams + position tracking
 *   Un market è univocamente identificato dalla combinazione collaterale/prestito
 * 
 * @author Project4 Team
 */
interface IMorphoRegistry {

    /// @notice Market configuration stored in registry
    struct MarketConfig {
        MarketParams params;      // Full market params (loanToken, collateralToken, oracle, irm, lltv)
        Id marketId;              // Precomputed market Id (hash of params)
        bool isActive;            // Whether this market is active for operations
    }

    /// @notice Vault configuration stored in registry
    struct VaultConfig {
        address vault;            // MetaMorpho ERC-4626 vault address
        string assetCode;         // Underlying asset code (e.g., "USDC")
        bool isActive;            // Whether this vault is active for operations
    }

    // ==================== EVENTS ====================

    event MarketConfigured(
        string indexed collateralCode,
        string indexed loanCode,
        Id indexed marketId,
        address oracle,
        address irm,
        uint256 lltv
    );
    event MarketRemoved(string indexed collateralCode, string indexed loanCode);
    event MarketStatusChanged(string indexed collateralCode, string indexed loanCode, bool isActive);

    event VaultConfigured(address indexed vault, string indexed assetCode);
    event VaultRemoved(address indexed vault);
    event VaultStatusChanged(address indexed vault, bool isActive);
    event DefaultVaultSet(string indexed assetCode, address indexed vault);

    // ==================== ERRORS ====================

    error MarketNotConfigured(string collateralCode, string loanCode);
    error InvalidAddress();
    error TokenCodeEmpty();
    error MarketAlreadyConfigured(string collateralCode, string loanCode);
    error VaultNotConfigured(address vault);

    // ==================== MARKET VIEW FUNCTIONS ====================

    /// @notice Get the full market config for a collateral/loan pair
    function getMarketConfig(string memory collateralCode, string memory loanCode) 
        external view returns (MarketConfig memory);

    /// @notice Get MarketParams for a collateral/loan pair
    function getMarketParams(string memory collateralCode, string memory loanCode) 
        external view returns (MarketParams memory);

    /// @notice Get precomputed market Id
    function getMarketId(string memory collateralCode, string memory loanCode) 
        external view returns (Id);

    /// @notice Check if a market is configured
    function isMarketConfigured(string memory collateralCode, string memory loanCode) 
        external view returns (bool);

    /// @notice Get all registered market keys (collateralCode, loanCode pairs)
    function getRegisteredMarkets() external view returns (string[] memory collateralCodes, string[] memory loanCodes);

    /// @notice Get count of registered markets
    function getRegisteredMarketCount() external view returns (uint256);

    // ==================== VAULT VIEW FUNCTIONS ====================

    /// @notice Check if a vault is approved
    function isVaultApproved(address vault) external view returns (bool);

    /// @notice Get vault config
    function getVaultConfig(address vault) external view returns (VaultConfig memory);

    /// @notice Get default vault for a tokenCode
    function getDefaultVault(string memory assetCode) external view returns (address);

    /// @notice Get all registered vault addresses
    function getRegisteredVaults() external view returns (address[] memory);

    /// @notice Get count of registered vaults
    function getRegisteredVaultCount() external view returns (uint256);

    // ==================== MARKET ADMIN FUNCTIONS ====================

    /// @notice Configure a new Morpho market
    function configureMarket(
        string memory collateralCode,
        string memory loanCode,
        address collateralToken,
        address loanToken,
        address oracle,
        address irm,
        uint256 lltv
    ) external;

    /// @notice Set market active/inactive status
    function setMarketStatus(string memory collateralCode, string memory loanCode, bool isActive) external;

    // ==================== VAULT ADMIN FUNCTIONS ====================

    /// @notice Configure a MetaMorpho vault
    function configureVault(address vault, string memory assetCode) external;

    /// @notice Remove a vault
    function removeVault(address vault) external;

    /// @notice Set vault active/inactive
    function setVaultStatus(address vault, bool isActive) external;

    /// @notice Set default vault for a tokenCode (used by VaultPlugin IProtocolAdapter routing)
    function setDefaultVault(string memory assetCode, address vault) external;
}
