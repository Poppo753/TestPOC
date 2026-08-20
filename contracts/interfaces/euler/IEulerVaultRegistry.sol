// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IEulerVaultRegistry
 * @notice Interface for EulerVaultRegistry - Maps token codes to Euler vaults
 * @dev Used by LiquidityManager to iterate over registered vaults
 */
interface IEulerVaultRegistry {
    /**
     * @notice Get vault address for a token code
     * @param tokenCode Token code (e.g., "WETH")
     * @return vault Vault address
     */
    function getVault(string memory tokenCode) external view returns (address vault);
    
    /**
     * @notice Get vault address without revert (returns address(0) if not found)
     * @param tokenCode Token code
     * @return vault Vault address or address(0)
     */
    function getVaultSafe(string memory tokenCode) external view returns (address vault);
    
    /**
     * @notice Get token code for a vault address
     * @param vault Vault address
     * @return tokenCode Token code
     */
    function getTokenCode(address vault) external view returns (string memory tokenCode);
    
    /**
     * @notice Check if a token is registered
     * @param tokenCode Token code
     * @return True if registered
     */
    function isRegistered(string memory tokenCode) external view returns (bool);
    
    /**
     * @notice Get all registered token codes
     * @return Array of token codes
     */
    function getAllRegisteredTokens() external view returns (string[] memory);
    
    /**
     * @notice Get number of registered tokens
     * @return Count of registered vaults
     */
    function getRegisteredCount() external view returns (uint256);
    
    /**
     * @notice Get all vaults with their token codes
     * @return tokenCodes Array of token codes
     * @return vaults Array of vault addresses (same order)
     */
    function getAllVaults() 
        external 
        view 
        returns (string[] memory tokenCodes, address[] memory vaults);
}
