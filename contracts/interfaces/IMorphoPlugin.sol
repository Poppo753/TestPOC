// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./IProtocolAdapter.sol";

/**
 * @title IMorphoPlugin
 * @notice Interface for the Morpho Blue plugin
 * @dev Combines:
 *      - IProtocolAdapter: Standard interface (deposit, withdraw, positions)
 *      - Morpho-specific: supplyCollateral, borrow, repay, withdrawCollateral
 * 
 * ARCHITECTURE (3 Musketeers Pattern):
 * 1. MorphoPlugin (implements IMorphoPlugin) - All operations
 * 2. MorphoLensAdapter (implements ILensAdapter) - Health monitoring, value queries
 * 3. MorphoRegistry - CollateralCode/LoanCode → MarketParams mappings
 * 
 * MORPHO BLUE SPECIFICS:
 * - Isolated markets (each market = 1 collateral + 1 loan asset)
 * - No receipt tokens (no aTokens). Position tracked via shares internally
 * - Collateral does NOT earn yield
 * - No native health factor → must compute from position + oracle
 * - Authorization: plugin must be authorized on Morpho to manage ProxyGeneral's position
 * - Uses MarketParams to identify each market
 * 
 * CUSTODY MODEL:
 * - ProtocolManager chiama deposit/withdraw/borrow/repay
 * - Plugin si aspetta token già nel contratto (inviati da ProtocolManager)
 * - Plugin restituisce token a ProxyGeneral dopo operazioni
 * 
 * MORPHO BLUE ADDRESS (all chains):
 * - 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
 * 
 * @author Project4 Team
 */
interface IMorphoPlugin is IProtocolAdapter {

    // ==================== MORPHO-SPECIFIC EVENTS ====================

    event MorphoSupplyCollateral(
        string indexed collateralCode,
        string indexed loanCode,
        address indexed collateralToken,
        uint256 amount
    );

    event MorphoWithdrawCollateral(
        string indexed collateralCode,
        string indexed loanCode,
        address indexed collateralToken,
        uint256 amount
    );

    event MorphoBorrow(
        string indexed collateralCode,
        string indexed loanCode,
        address indexed loanToken,
        uint256 amount
    );

    event MorphoRepay(
        string indexed collateralCode,
        string indexed loanCode,
        address indexed loanToken,
        uint256 amountRepaid
    );

    event Borrowed(string tokenCode, uint256 amount, uint256 accountNumber);
    event Repaid(string tokenCode, uint256 amount, uint256 accountNumber);

    // ==================== LENDING PROTOCOL FUNCTIONS ====================

    /**
     * @notice Supply collateral to a Morpho market
     * @param collateralCode Collateral token code (e.g., "WETH")
     * @param loanCode Loan token code (e.g., "USDC") - identifies the market
     * @param amount Amount of collateral to supply
     * @return success True if successful
     */
    function supplyCollateral(
        string memory collateralCode,
        string memory loanCode,
        uint256 amount
    ) external returns (bool success);

    /**
     * @notice Borrow from a Morpho market
     * @param collateralCode Collateral token code (e.g., "WETH") - identifies the market
     * @param loanCode Loan token code (e.g., "USDC")
     * @param amount Amount to borrow
     * @return success True if successful
     */
    function borrow(
        string memory collateralCode,
        string memory loanCode,
        uint256 amount
    ) external returns (bool success);

    /**
     * @notice Repay borrowed assets on a Morpho market
     * @param collateralCode Collateral token code (e.g., "WETH") - identifies the market
     * @param loanCode Loan token code (e.g., "USDC")
     * @param amount Amount to repay (0 for full repay via shares)
     * @return success True if successful
     */
    function repay(
        string memory collateralCode,
        string memory loanCode,
        uint256 amount
    ) external returns (bool success);

    /**
     * @notice Withdraw collateral from a Morpho market
     * @param collateralCode Collateral token code (e.g., "WETH")
     * @param loanCode Loan token code (e.g., "USDC") - identifies the market
     * @param amount Amount of collateral to withdraw
     * @return success True if successful
     */
    function withdrawCollateral(
        string memory collateralCode,
        string memory loanCode,
        uint256 amount
    ) external returns (bool success);

    /**
     * @notice Get current debt for a market (in loan token units)
     * @param collateralCode Collateral token code
     * @param loanCode Loan token code
     * @return debtAmount Current debt including accrued interest
     */
    function getDebt(string memory collateralCode, string memory loanCode)
        external view returns (uint256 debtAmount);

    /**
     * @notice Get current collateral balance in a market
     * @param collateralCode Collateral token code
     * @param loanCode Loan token code
     * @return collateralAmount Current collateral deposited
     */
    function getCollateral(string memory collateralCode, string memory loanCode)
        external view returns (uint256 collateralAmount);

    /**
     * @notice Get health factor for a market position
     * @dev Computed manually: (collateral * oraclePrice * lltv) / (debt * ORACLE_PRICE_SCALE)
     * @param collateralCode Collateral token code
     * @param loanCode Loan token code
     * @return healthFactor Health factor in 1e18 scale. type(uint256).max if no debt
     */
    function getHealthFactor(string memory collateralCode, string memory loanCode)
        external view returns (uint256 healthFactor);

    /**
     * @notice Circuit breaker status
     */
    function circuitBreakerTripped() external view returns (bool);

    /**
     * @notice Close a complete market position: repay all debt + withdraw all collateral
     * @param collateralCode Collateral token code
     * @param loanCode Loan token code
     * @return success True if position closed successfully
     */
    function closeMarketPosition(
        string memory collateralCode,
        string memory loanCode
    ) external returns (bool success);
}
