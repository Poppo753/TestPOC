// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IDolomite.sol";

/**
 * @title IDolomitePlugin
 * @notice Interface for Dolomite lending/borrowing plugin
 * @dev Similar architecture to ISwapPlugin but for lending operations
 * 
 * DESIGN RATIONALE:
 * - Separate from ISwapPlugin (different domain: lending vs swapping)
 * - Registered in Beacon like other plugins (e.g., "DolomitePlugin")
 * - Account-based: plugin manages accounts on behalf of user/contract
 * - Phase 1: Deposit/Withdraw only
 * - Phase 2: Add borrow position management
 * - Phase 3: Add leverage strategies
 * 
 * ACCOUNT STRATEGY:
 * - Account #0: Main account (deposits/withdrawals, no borrow)
 * - Account #1+: Isolated borrow positions (collateral + debt)
 * - Owner = address(this) = the plugin contract or caller contract
 */
interface IDolomitePlugin {
    
    // ==================== STRUCTS ====================
    
    /**
     * @notice Protocol metadata for plugin identification
     * @param name Human-readable name (e.g., "Dolomite Arbitrum")
     * @param version Plugin version (semantic versioning: "1.0.0")
     * @param features Bitmask of supported features
     *                 1 = DEPOSIT_WITHDRAW
     *                 2 = BORROW_POSITIONS
     *                 4 = LEVERAGE
     *                 8 = LIQUIDATION_PROTECTION
     */
    struct ProtocolInfo {
        string name;
        string version;
        uint256 features;
    }
    
    /**
     * @notice Account position summary
     * @param accountNumber Account number (0 = main, 1+ = borrow positions)
     * @param collateralValue Total collateral value in USD (18 decimals)
     * @param debtValue Total debt value in USD (18 decimals)
     * @param healthFactor Health factor (18 decimals, <1.0 = liquidatable)
     * @param isLiquidatable True if account can be liquidated
     */
    struct AccountPosition {
        uint256 accountNumber;
        uint256 collateralValue;
        uint256 debtValue;
        uint256 healthFactor;
        bool isLiquidatable;
    }
    
    /**
     * @notice Borrow position parameters
     * @param collateralToken Token to use as collateral
     * @param collateralAmount Amount of collateral to deposit
     * @param borrowToken Token to borrow
     * @param borrowAmount Amount to borrow
     * @param toAccountNumber Destination account for borrow position (e.g., 1, 2, 3...)
     */
    struct BorrowPositionParams {
        address collateralToken;
        uint256 collateralAmount;
        address borrowToken;
        uint256 borrowAmount;
        uint256 toAccountNumber;
    }
    
    // ==================== METADATA FUNCTIONS ====================
    
    /**
     * @notice Returns protocol metadata
     * @return info ProtocolInfo struct
     */
    function getProtocolInfo() external pure returns (ProtocolInfo memory info);
    
    /**
     * @notice Health check for plugin operability
     * @return healthy True if plugin is operational
     * @return reason Human-readable reason if not healthy
     * 
     * HEALTH CHECK CRITERIA:
     * - DolomiteMargin contract exists and operational
     * - BorrowPositionRouter accessible
     * - No circuit breaker triggered
     */
    function isHealthy() external view returns (bool healthy, string memory reason);
    
    /**
     * @notice Check if plugin supports a specific token
     * @param token Token address to check
     * @return supported True if token is supported (has a market on Dolomite)
     * 
     * IMPLEMENTATION:
     * - Query DolomiteMargin.getMarketIdByTokenAddress(token)
     * - If reverts or returns invalid ID, not supported
     */
    function supportsToken(address token) external view returns (bool supported);
    
    // ==================== PHASE 1: DEPOSIT/WITHDRAW ====================
    
    /**
     * @notice Deposit token into Dolomite main account (account #0)
     * @param token Token address to deposit
     * @param amount Amount to deposit
     * @return success True if deposit succeeded
     * 
     * REQUIREMENTS:
     * - Caller must have approved this contract to spend tokens
     * - Token must be supported by Dolomite
     * 
     * FLOW:
     * 1. transferFrom(caller, this, amount)
     * 2. approve(DolomiteMargin, amount)
     * 3. DepositRouter.depositERC20(accountNumber=0, marketId, amount)
     * 
     * EVENTS:
     * - Emits Deposited(caller, token, amount, accountNumber=0)
     */
    function deposit(
        address token,
        uint256 amount
    ) external returns (bool success);
    
    /**
     * @notice Withdraw token from Dolomite main account (account #0)
     * @param token Token address to withdraw
     * @param amount Amount to withdraw (use type(uint256).max for "withdraw all")
     * @param recipient Address to receive withdrawn tokens
     * @return amountWithdrawn Actual amount withdrawn
     * 
     * REQUIREMENTS:
     * - Sufficient balance in account #0
     * - Account must remain healthy after withdrawal
     * 
     * FLOW:
     * 1. WithdrawalRouter.withdrawERC20(accountNumber=0, marketId, amount, BalanceCheckFlag.From)
     * 2. Transfer withdrawn tokens to recipient
     * 
     * EVENTS:
     * - Emits Withdrawn(caller, token, amountWithdrawn, recipient, accountNumber=0)
     */
    function withdraw(
        address token,
        uint256 amount,
        address recipient
    ) external returns (uint256 amountWithdrawn);
    
    /**
     * @notice Get account balance for a specific token
     * @param token Token address to query
     * @param accountNumber Account number (0 = main, 1+ = borrow positions)
     * @return balance Account balance (positive = deposit, negative = debt)
     * 
     * IMPLEMENTATION:
     * - Query DolomiteMargin.getAccountWei(address(this), accountNumber, marketId)
     */
    function getBalance(
        address token,
        uint256 accountNumber
    ) external view returns (int256 balance);
    
    // ==================== PHASE 2: BORROW POSITIONS ====================
    
    /**
     * @notice Open a new borrow position
     * @param params Borrow position parameters (collateral, borrow amounts, etc.)
     * @return accountNumber Account number created for this position
     * 
     * REQUIREMENTS:
     * - Caller must have approved this contract to spend collateral tokens
     * - Collateral amount must be sufficient for requested borrow
     * - Position must be healthy after creation (health factor > 1.0)
     * 
     * FLOW:
     * 1. transferFrom(caller, this, collateralAmount) - get collateral from caller
     * 2. deposit collateral to account #0 (via deposit function)
     * 3. openBorrowPosition: move collateral from #0 to #toAccountNumber
     * 4. transferBetweenAccounts: borrow tokens from #toAccountNumber to #0
     * 5. withdraw borrowed tokens from #0 and send to caller
     * 
     * RESULT:
     * - Account #toAccountNumber: +collateral, -debt
     * - Caller receives borrowed tokens
     * 
     * EVENTS:
     * - Emits BorrowPositionOpened(caller, accountNumber, collateralToken, collateralAmount, borrowToken, borrowAmount)
     */
    function openBorrowPosition(
        BorrowPositionParams calldata params
    ) external returns (uint256 accountNumber);
    
    /**
     * @notice Close a borrow position and return collateral
     * @param accountNumber Account number to close (must be > 0)
     * @param recipient Address to receive remaining collateral
     * @return collateralTokens Array of collateral token addresses returned
     * @return collateralAmounts Array of collateral amounts returned
     * 
     * REQUIREMENTS:
     * - Caller must have approved this contract to spend repayment tokens
     * - All debt must be repayable (caller provides debt tokens)
     * 
     * FLOW:
     * 1. Query debt amounts on accountNumber
     * 2. transferFrom(caller, this, debtAmount) - get repayment tokens
     * 3. deposit repayment to account #0
     * 4. repayAllForBorrowPosition: repay debt from #0 to #accountNumber
     * 5. closeBorrowPosition: return collateral to #0
     * 6. withdraw collateral from #0 and send to recipient
     * 
     * EVENTS:
     * - Emits BorrowPositionClosed(caller, accountNumber, recipient)
     */
    function closeBorrowPosition(
        uint256 accountNumber,
        address recipient
    ) external returns (
        address[] memory collateralTokens,
        uint256[] memory collateralAmounts
    );
    
    /**
     * @notice Get position summary for an account
     * @param accountNumber Account number to query
     * @return position AccountPosition struct with collateral, debt, health factor
     */
    function getPositionSummary(
        uint256 accountNumber
    ) external view returns (AccountPosition memory position);
    
    /**
     * @notice Get maximum borrowable amount for a given collateral
     * @param collateralToken Collateral token address
     * @param collateralAmount Amount of collateral
     * @param borrowToken Token to borrow
     * @return maxBorrowAmount Maximum amount that can be borrowed safely
     * 
     * CALCULATION:
     * - Query collateral price and LTV ratio from Dolomite
     * - maxBorrow = collateralValue * LTV / borrowTokenPrice
     * - Apply safety margin (e.g., 90% of max to avoid immediate liquidation)
     */
    function getMaxBorrowAmount(
        address collateralToken,
        uint256 collateralAmount,
        address borrowToken
    ) external view returns (uint256 maxBorrowAmount);
    
    // ==================== PHASE 3: LEVERAGE (Future) ====================
    
    /**
     * @notice Open leveraged position (deposit → borrow → re-deposit loop)
     * @dev To be implemented in Phase 3
     * @param collateralToken Token to use as collateral
     * @param initialAmount Initial deposit amount
     * @param leverageMultiplier Leverage multiplier (e.g., 3.0 = 3x leverage, in 18 decimals)
     * @param maxIterations Maximum number of borrow-deposit loops
     * @return accountNumber Account number created
     * @return finalCollateral Final collateral amount after leverage
     * @return finalDebt Final debt amount
     */
    function openLeveragedPosition(
        address collateralToken,
        uint256 initialAmount,
        uint256 leverageMultiplier,
        uint256 maxIterations
    ) external returns (
        uint256 accountNumber,
        uint256 finalCollateral,
        uint256 finalDebt
    );
    
    // ==================== EVENTS ====================
    
    /**
     * @notice Emitted when tokens are deposited
     */
    event Deposited(
        address indexed caller,
        address indexed token,
        uint256 amount,
        uint256 accountNumber
    );
    
    /**
     * @notice Emitted when tokens are withdrawn
     */
    event Withdrawn(
        address indexed caller,
        address indexed token,
        uint256 amount,
        address indexed recipient,
        uint256 accountNumber
    );
    
    /**
     * @notice Emitted when a borrow position is opened
     */
    event BorrowPositionOpened(
        address indexed caller,
        uint256 indexed accountNumber,
        address collateralToken,
        uint256 collateralAmount,
        address borrowToken,
        uint256 borrowAmount
    );
    
    /**
     * @notice Emitted when a borrow position is closed
     */
    event BorrowPositionClosed(
        address indexed caller,
        uint256 indexed accountNumber,
        address indexed recipient
    );
    
    /**
     * @notice Emitted when plugin configuration is updated
     */
    event ConfigurationUpdated(
        string indexed configKey,
        bytes oldValue,
        bytes newValue
    );
    
    /**
     * @notice Emitted when plugin health status changes
     */
    event HealthStatusChanged(
        bool isHealthy,
        string reason,
        uint256 timestamp
    );
}
