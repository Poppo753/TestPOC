// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./IProtocolAdapter.sol";

/**
 * @title IAaveV3Plugin
 * @notice Complete interface for Aave V3 plugin
 * @dev Combines:
 *      - IProtocolAdapter: Standard interface for all protocols (deposit, withdraw, positions)
 *      - Aave V3 specific: borrow, repay, getDebt, getHealthFactor
 * 
 * ARCHITECTURE (3 Musketeers Pattern):
 * 1. AaveV3Plugin (implements IAaveV3Plugin) - All operations
 * 2. AaveV3LensAdapter (implements ILensAdapter) - Health monitoring, value queries
 * 3. AaveV3Registry - Token → aToken/debtToken mappings
 * 
 * AAVE V3 SPECIFICS:
 * - Single Pool contract (not per-token vaults like Euler)
 * - 1 account per address (no sub-accounts)
 * - Health factor natively via getUserAccountData()
 * - Collateral enabled automatically on first supply (can be toggled)
 * - Variable rate borrowing only (mode = 2)
 * 
 * CUSTODY MODEL:
 * - ProtocolManager chiama deposit/withdraw/borrow/repay
 * - Plugin si aspetta token già nel contratto (inviati da ProtocolManager)
 * - Plugin restituisce token a ProxyGeneral dopo operazioni
 * 
 * @author Project4 Team
 */
interface IAaveV3Plugin is IProtocolAdapter {

    // ==================== AAVE-SPECIFIC EVENTS ====================

    /// @notice Emitted on Aave supply
    event AaveDeposit(
        string indexed tokenCode,
        address indexed asset,
        uint256 amount,
        uint256 aTokenReceived
    );

    /// @notice Emitted on Aave withdrawal
    event AaveWithdrawal(
        string indexed tokenCode,
        address indexed asset,
        uint256 amount
    );

    /// @notice Emitted on Aave borrow
    event AaveBorrow(
        string indexed tokenCode,
        address indexed asset,
        uint256 amount
    );

    /// @notice Emitted on Aave repay
    event AaveRepay(
        string indexed tokenCode,
        address indexed asset,
        uint256 amountRepaid
    );

    /// @notice Emitted when tokens are borrowed
    event Borrowed(string tokenCode, uint256 amount, uint256 accountNumber);

    /// @notice Emitted when tokens are repaid
    event Repaid(string tokenCode, uint256 amount, uint256 accountNumber);

    // ==================== LENDING PROTOCOL FUNCTIONS ====================

    /**
     * @notice Borrow tokens from Aave V3
     * @param tokenCode Token code (e.g., "USDC")
     * @param amount Amount to borrow
     * @return success True if successful
     */
    function borrow(string memory tokenCode, uint256 amount) external returns (bool success);

    /**
     * @notice Repay borrowed tokens to Aave V3
     * @param tokenCode Token code (e.g., "USDC")
     * @param amount Amount to repay (0 or type(uint256).max for full repay)
     * @return success True if successful
     */
    function repay(string memory tokenCode, uint256 amount) external returns (bool success);

    /**
     * @notice Get current debt for a token
     * @param tokenCode Token code
     * @return debtAmount Current debt including accrued interest
     */
    function getDebt(string memory tokenCode) external view returns (uint256 debtAmount);

    /**
     * @notice Get health factor from Aave V3 (native)
     * @return healthFactor Health factor in 1e18 scale. type(uint256).max if no debt
     */
    function getHealthFactor() external view returns (uint256 healthFactor);

    /**
     * @notice Get borrowing capacity for a token
     * @param tokenCode Token code
     * @return borrowCapacity Remaining borrow capacity in token units
     */
    function getBorrowCapacity(string memory tokenCode) external view returns (uint256 borrowCapacity);

    /**
     * @notice Circuit breaker status
     */
    function circuitBreakerTripped() external view returns (bool);

    /**
     * @notice Close a complete position: repay all debt + withdraw all collateral
     * @param debtTokenCode Token code for debt (e.g., "USDC")
     * @param collateralTokenCode Token code for collateral (e.g., "WETH")
     * @return success True if position closed successfully
     */
    function closePosition(
        string memory debtTokenCode,
        string memory collateralTokenCode
    ) external returns (bool success);
}
