// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IEulerRegistry
 * @notice Interface for EulerRegistry contract that manages vault mappings and leverage positions
 * @dev Combines VaultRegistry and PositionManager functionality
 */
interface IEulerRegistry {
    // ==================== STRUCTS ====================
    
    /**
     * @notice Storage structure for leverage positions
     * @dev Stored in EulerRegistry to track all leverage positions
     */
    struct LeveragePositionStorage {
        uint8 subAccountId;           // EVC sub-account ID (1-255)
        address collateralVault;      // Euler vault for collateral
        address borrowVault;          // Euler vault for borrowed asset
        uint256 initialCollateral;    // Initial collateral amount
        uint256 borrowedAmount;       // Amount borrowed
        bool isActive;                // Position status
        uint256 createdAt;            // Creation timestamp
    }
    
    // ==================== VAULT REGISTRY ====================
    
    /**
     * @notice Get vault address for a token code
     * @param tokenCode Token identifier (e.g., "WETH", "USDC")
     * @return vault Vault address
     * @dev Reverts if token not registered
     */
    function getVault(string memory tokenCode) external view returns (address vault);
    
    /**
     * @notice Get vault address safely (returns address(0) if not found)
     * @param tokenCode Token identifier
     * @return vault Vault address or address(0)
     */
    function getVaultSafe(string memory tokenCode) external view returns (address vault);
    
    /**
     * @notice Get token code from vault address
     * @param vault Vault address
     * @return tokenCode Token identifier
     */
    function getTokenCode(address vault) external view returns (string memory tokenCode);
    
    /**
     * @notice Check if token is registered
     * @param tokenCode Token identifier
     * @return registered True if registered
     */
    function isRegistered(string memory tokenCode) external view returns (bool registered);
    
    /**
     * @notice Get all registered token codes
     * @return tokens Array of token codes
     */
    function getAllRegisteredTokens() external view returns (string[] memory tokens);
    
    /**
     * @notice Get all vaults with their token codes
     * @return tokenCodes Array of token codes
     * @return vaults Array of vault addresses
     */
    function getAllVaults() external view returns (string[] memory tokenCodes, address[] memory vaults);
    
    // ==================== POSITION MANAGER ====================
    
    /**
     * @notice Get next position ID
     * @return nextId Next available position ID
     */
    function nextPositionId() external view returns (uint256 nextId);
    
    /**
     * @notice Create a new leverage position
     * @param subAccountId EVC sub-account ID
     * @param collateralVault Collateral vault address
     * @param borrowVault Borrow vault address
     * @param initialCollateral Initial collateral amount
     * @param borrowedAmount Borrowed amount
     * @return positionId Created position ID
     */
    function createPosition(
        uint8 subAccountId,
        address collateralVault,
        address borrowVault,
        uint256 initialCollateral,
        uint256 borrowedAmount
    ) external returns (uint256 positionId);
    
    /**
     * @notice Create a new leverage position with on-demand sub-account allocation (Opzione C)
     * @dev Uses lazy allocation: allocates sub-account only when needed for a new vault pair
     *      If a position for this pair already exists and is active, reverts
     *      If a position existed but was closed, reuses the same sub-account ID
     * @param collateralVault Collateral vault address
     * @param borrowVault Borrow vault address
     * @param initialCollateral Initial collateral amount
     * @param borrowedAmount Borrowed amount
     * @return positionId Created position ID
     * @return subAccountId Allocated sub-account ID (new or reused)
     */
    function createPositionOnDemand(
        address collateralVault,
        address borrowVault,
        uint256 initialCollateral,
        uint256 borrowedAmount
    ) external returns (uint256 positionId, uint8 subAccountId);
    
    /**
     * @notice Update position borrowed amount
     * @param positionId Position ID
     * @param newBorrowedAmount New borrowed amount
     */
    function updatePosition(uint256 positionId, uint256 newBorrowedAmount) external;
    
    /**
     * @notice Mark position as closed
     * @param positionId Position ID
     */
    function closePositionRecord(uint256 positionId) external;
    
    /**
     * @notice Get position data
     * @param positionId Position ID
     * @return position Position data
     * @dev Reverts if position doesn't exist
     */
    function getPosition(uint256 positionId) external view returns (LeveragePositionStorage memory position);
    
    /**
     * @notice Get position data safely (returns empty struct if not found)
     * @param positionId Position ID
     * @return position Position data
     */
    function getPositionSafe(uint256 positionId) external view returns (LeveragePositionStorage memory position);
    
    /**
     * @notice Get all positions (active and inactive)
     * @return positions Array of all positions
     */
    function getAllPositions() external view returns (LeveragePositionStorage[] memory positions);
    
    /**
     * @notice Get only active positions
     * @return positions Array of active positions
     * @return positionIds Array of position IDs
     */
    function getActivePositions() external view returns (LeveragePositionStorage[] memory positions, uint256[] memory positionIds);
    
    /**
     * @notice Check if position is active
     * @param positionId Position ID
     * @return active True if active
     */
    function isPositionActive(uint256 positionId) external view returns (bool active);    
    /**
     * @notice Get allocated sub-account ID for a vault pair (Opzione C)
     * @dev Returns 0 if no sub-account has been allocated for this pair yet
     * @param collateralVault Collateral vault address
     * @param borrowVault Borrow vault address
     * @return subAccountId Allocated sub-account ID (0 if not allocated)
     */
    function getSubAccountForPair(
        address collateralVault,
        address borrowVault
    ) external view returns (uint8 subAccountId);
    
    /**
     * @notice Check if an active position exists for a vault pair (Opzione C)
     * @param collateralVault Collateral vault address
     * @param borrowVault Borrow vault address
     * @return exists True if an active position exists for this pair
     */
    function hasActivePositionForPair(
        address collateralVault,
        address borrowVault
    ) external view returns (bool exists);}
