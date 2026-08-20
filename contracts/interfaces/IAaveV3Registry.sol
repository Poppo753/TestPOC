// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IAaveV3Registry
 * @notice Interface for AaveV3Registry
 * @dev Maps tokenCode → underlying asset, aToken, variableDebtToken
 *      Unlike Euler (per-token vaults), Aave V3 uses a single Pool.
 *      The Registry stores token metadata for each supported asset.
 * 
 * @author Project4 Team
 */
interface IAaveV3Registry {

    /// @notice Token configuration in Aave V3
    struct TokenConfig {
        address underlying;         // Underlying asset (e.g., WETH address)
        address aToken;             // aToken (receipt for supply, e.g., aWETH)
        address variableDebtToken;  // Variable debt token (e.g., variableDebtWETH)
        bool isActive;              // Whether this token is active for operations
    }

    // ==================== EVENTS ====================

    event TokenConfigured(string indexed tokenCode, address underlying, address aToken, address variableDebtToken);
    event TokenRemoved(string indexed tokenCode);
    event TokenStatusChanged(string indexed tokenCode, bool isActive);

    // ==================== ERRORS ====================

    error TokenNotConfigured(string tokenCode);
    error InvalidAddress();
    error TokenCodeEmpty();
    error TokenAlreadyConfigured(string tokenCode);

    // ==================== VIEW FUNCTIONS ====================

    function getTokenConfig(string memory tokenCode) external view returns (TokenConfig memory);
    function getUnderlying(string memory tokenCode) external view returns (address);
    function getAToken(string memory tokenCode) external view returns (address);
    function getVariableDebtToken(string memory tokenCode) external view returns (address);
    function isTokenConfigured(string memory tokenCode) external view returns (bool);
    function getRegisteredTokens() external view returns (string[] memory);
    function getRegisteredTokenCount() external view returns (uint256);

    // ==================== ADMIN FUNCTIONS ====================

    function configureToken(
        string memory tokenCode,
        address underlying,
        address aToken,
        address variableDebtToken
    ) external;

    function removeToken(string memory tokenCode) external;
    function setTokenActive(string memory tokenCode, bool active) external;
}
