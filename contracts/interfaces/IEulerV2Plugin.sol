// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./IProtocolAdapter.sol";
import "./IEulerV2PluginSpecific.sol";

/**
 * @title IEulerV2Plugin
 * @notice Complete interface for Euler V2 plugin
 * @dev Combines:
 *      - IProtocolAdapter: Standard interface for all protocols (deposit, withdraw, positions, values)
 *      - IEulerV2PluginSpecific: Euler-specific functions (leverage, sub-accounts)
 * 
 * ARCHITECTURE (3 Musketeers Pattern):
 * 1. EulerV2Plugin (implements IEulerV2Plugin) - All operations
 * 2. EulerLensAdapter (implements ILensAdapter) - Health monitoring, value queries
 * 3. EulerVaultRegistry - Vault configuration
 * 
 * IMPORTANT:
 * - IProtocolAdapter.Position is the STANDARD format returned by getAllPositions(), getPosition()
 * - IEulerV2PluginSpecific.LeveragePositionInternal is for Euler-specific queries
 * - Use getLeveragePosition() for Euler-specific data (sub-account, vaults)
 * - Use getPosition() for standard format (IProtocolAdapter.Position)
 * 
 * Euler V2 Architecture:
 * - EVC (Ethereum Vault Connector): Hub for batching and sub-accounts
 * - EVK (Euler Vault Kit): ERC-4626 vaults with borrowing
 * - Sub-account 0: Simple deposits (yield farming)
 * - Sub-accounts 1-255: Isolated leverage positions
 * 
 * Custody Flow (leverage):
 * ProxyGeneral → ProtocolManager → EulerV2Plugin → EVC.batch([...]) → Euler Vaults
 * 
 * @author Project4 Team
 */
interface IEulerV2Plugin is IProtocolAdapter, IEulerV2PluginSpecific {
    
    // ==================== LEGACY COMPATIBILITY ====================
    // These maintain backward compatibility with existing code
    
    /**
     * @notice Legacy struct - use IProtocolAdapter.Position instead
     * @dev Kept for backward compatibility, maps to LeveragePositionInternal
     */
    struct LeveragePosition {
        uint256 positionId;
        uint8 subAccountId;
        address collateralVault;
        address borrowVault;
        uint256 initialCollateral;
        uint256 borrowedAmount;
        bool isActive;
        uint256 createdAt;
    }
    
    // ==================== EULER-SPECIFIC EVENTS ====================
    
    /// @notice Emitted on Euler deposit
    event EulerDeposit(
        string indexed tokenCode,
        address indexed vault,
        uint256 amount,
        uint256 sharesReceived
    );
    
    /// @notice Emitted on Euler withdrawal
    event EulerWithdrawal(
        string indexed tokenCode,
        address indexed vault,
        uint256 amount,
        uint256 sharesBurned
    );
    
    /// @notice Emitted on Euler borrow
    event EulerBorrow(
        string indexed tokenCode,
        address indexed vault,
        uint256 amount
    );
    
    /// @notice Emitted on Euler repay
    event EulerRepay(
        string indexed tokenCode,
        address indexed vault,
        uint256 amount
    );
    
    /// @notice Emitted when tokens are borrowed
    event Borrowed(string tokenCode, uint256 amount, uint256 accountNumber);
    
    /// @notice Emitted when tokens are repaid
    event Repaid(string tokenCode, uint256 amount, uint256 accountNumber);
    
    // ==================== LENDING PROTOCOL FUNCTIONS ====================
    // These come from ILendingProtocol which is being replaced by IProtocolAdapter
    
    /**
     * @notice Borrow tokens from Euler
     * @param tokenCode Token code (e.g., "USDC")
     * @param amount Amount to borrow
     * @return success True if successful
     */
    function borrow(string memory tokenCode, uint256 amount) external returns (bool success);
    
    /**
     * @notice Repay borrowed tokens
     * @param tokenCode Token code
     * @param amount Amount to repay
     * @return success True if successful
     */
    function repay(string memory tokenCode, uint256 amount) external returns (bool success);
    
    // DEPRECATED: Use getDebt() instead - same functionality
    // /**
    //  * @notice Get borrowed amount for a token
    //  * @param tokenCode Token code
    //  * @return amount Borrowed amount
    //  */
    // function getBorrowedAmount(string memory tokenCode) external view returns (uint256 amount);
    
    /**
     * @notice Get health factor for the main account
     * @return healthFactor Health factor (1e18 = 1.0)
     */
    function getHealthFactor() external view returns (uint256 healthFactor);
}
