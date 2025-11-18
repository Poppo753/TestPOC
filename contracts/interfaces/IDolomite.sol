// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Account
 * @notice Library for Dolomite account structure
 */
library Account {
    struct Info {
        address owner;      // Account owner address
        uint256 number;     // Account number (0 = main, others = sub-accounts)
    }
}

/**
 * @title Types
 * @notice Library for Dolomite data types
 */
library Types {
    struct Wei {
        bool sign;          // true = positive (supply), false = negative (borrow)
        uint256 value;      // Absolute value
    }
}

/**
 * @title IDolomiteMargin
 * @notice Core Dolomite protocol interface (simplified for MVP)
 * @dev Based on Dolomite official documentation
 * https://docs.dolomite.io/developer-documentation/dolomite-margin-glossary
 */
interface IDolomiteMargin {
    /**
     * @notice Get market ID for a token address
     * @param token Token address to query
     * @return marketId Dolomite market ID for this token
     */
    function getMarketIdByTokenAddress(address token) external view returns (uint256 marketId);
    
    /**
     * @notice Get account balance for specific market
     * @param account Account info (owner + number)
     * @param marketId Market ID to query
     * @return wei Account balance as Wei struct (sign + value)
     */
    function getAccountWei(
        Account.Info memory account,
        uint256 marketId
    ) external view returns (Types.Wei memory);
    
    /**
     * @notice Check if account is liquidatable
     * @param owner Account owner
     * @param accountNumber Account number
     * @return isLiquidatable True if account can be liquidated
     */
    function isAccountLiquidatable(
        address owner,
        uint256 accountNumber
    ) external view returns (bool isLiquidatable);
}

/**
 * @title AccountBalanceLib
 * @notice Library for balance check flags used in Dolomite operations
 */
library AccountBalanceLib {
    /**
     * @notice Balance check enforcement level
     * @dev Both: Check both accounts are healthy
     *      From: Only check source account is healthy
     *      To: Only check destination account is healthy
     *      None: No health checks (use with caution)
     */
    enum BalanceCheckFlag {
        Both,
        From,
        To,
        None
    }
}

/**
 * @title IBorrowPositionRouter
 * @notice High-level router for managing borrow positions on Dolomite
 * @dev Based on Dolomite official documentation
 * https://docs.dolomite.io/developer-documentation/managing-borrow-positions
 */
interface IBorrowPositionRouter {
    /**
     * @notice Transfer assets between two accounts owned by msg.sender
     * @dev Used to move collateral/debt between main account and borrow positions
     * @param isolationModeMarketId Market ID for isolation mode (0 if not used)
     * @param fromAccountNumber Source account number
     * @param toAccountNumber Destination account number
     * @param marketId Market ID of asset to transfer
     * @param amount Amount to transfer (use type(uint256).max for "all")
     * @param balanceCheckFlag Which account(s) to health-check after transfer
     * 
     * EXAMPLE: Move 1000 USDC from main account to borrow position
     * transferBetweenAccounts(0, 0, 123, usdcMarketId, 1000e6, BalanceCheckFlag.To)
     */
    function transferBetweenAccounts(
        uint256 isolationModeMarketId,
        uint256 fromAccountNumber,
        uint256 toAccountNumber,
        uint256 marketId,
        uint256 amount,
        AccountBalanceLib.BalanceCheckFlag balanceCheckFlag
    ) external;

    /**
     * @notice Open a new borrow position by moving collateral to isolated account
     * @dev Moves collateral from main account (typically 0) to borrow account
     * @param fromAccountNumber Source account (usually 0 = main account)
     * @param toAccountNumber Destination account (borrow position, e.g., 1, 2, 3...)
     * @param marketId Market ID of collateral token
     * @param amount Amount of collateral to move
     * @param balanceCheckFlag Health check flag (typically From or Both)
     * 
     * FLOW:
     * 1. Deposit collateral to account #0 (via separate deposit function)
     * 2. Call openBorrowPosition to move collateral to account #1
     * 3. Account #1 now has collateral, can borrow against it
     * 
     * EXAMPLE: Open position with 1 WETH collateral
     * openBorrowPosition(0, 1, wethMarketId, 1e18, BalanceCheckFlag.From)
     */
    function openBorrowPosition(
        uint256 fromAccountNumber,
        uint256 toAccountNumber,
        uint256 marketId,
        uint256 amount,
        AccountBalanceLib.BalanceCheckFlag balanceCheckFlag
    ) external;

    /**
     * @notice Repay all debt for a borrow position using assets from another account
     * @dev Automatically calculates and repays full debt amount
     * @param isolationModeMarketId Market ID for isolation mode (0 if not used)
     * @param fromAccountNumber Account with assets to repay debt (usually 0)
     * @param borrowAccountNumber Account with debt to repay
     * @param marketId Market ID of debt token to repay
     * @param balanceCheckFlag Health check flag
     * 
     * EXAMPLE: Repay all USDC debt on position #1 using assets from account #0
     * repayAllForBorrowPosition(0, 0, 1, usdcMarketId, BalanceCheckFlag.To)
     */
    function repayAllForBorrowPosition(
        uint256 isolationModeMarketId,
        uint256 fromAccountNumber,
        uint256 borrowAccountNumber,
        uint256 marketId,
        AccountBalanceLib.BalanceCheckFlag balanceCheckFlag
    ) external;

    /**
     * @notice Close a borrow position and return collateral to another account
     * @dev Requires all debt to be repaid first (use repayAllForBorrowPosition)
     * @param isolationModeMarketId Market ID for isolation mode (0 if not used)
     * @param borrowAccountNumber Account to close (must have zero debt)
     * @param toAccountNumber Destination for collateral (usually 0 = main account)
     * @param collateralMarketIds Array of market IDs for collateral to withdraw
     * 
     * FLOW:
     * 1. repayAllForBorrowPosition(...) to clear debt
     * 2. closeBorrowPosition(...) to withdraw collateral back to main account
     * 
     * EXAMPLE: Close position #1, return all collateral to main account
     * uint256[] memory collaterals = new uint256[](1);
     * collaterals[0] = wethMarketId;
     * closeBorrowPosition(0, 1, 0, collaterals)
     */
    function closeBorrowPosition(
        uint256 isolationModeMarketId,
        uint256 borrowAccountNumber,
        uint256 toAccountNumber,
        uint256[] calldata collateralMarketIds
    ) external;
}

/**
 * @title IDepositWithdrawalRouter
 * @notice Router for depositing/withdrawing assets to/from Dolomite
 * @dev Official Dolomite API - https://docs.dolomite.io/developer-documentation/depositing-or-withdrawing
 */
interface IDepositWithdrawalRouter {
    enum EventFlag {
        None,
        Borrow
    }
    
    /**
     * @notice Deposit tokens into Dolomite account
     * @param _isolationModeMarketId The market ID of the isolation mode token vault (0 if not using isolation mode)
     * @param _toAccountNumber The account number to deposit into
     * @param _marketId The ID of the market being deposited
     * @param _amountWei The amount in Wei to deposit. Use type(uint256).max to deposit msg.sender's entire balance
     * @param _eventFlag Flag indicating if this deposit should emit special events (e.g. opening a borrow position)
     * 
     * EXAMPLE: Deposit 1 WETH to account 0
     * WETH.approve(router, 1 ether);
     * uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(WETH);
     * router.depositWei(0, 0, marketId, 1 ether, EventFlag.None);
     */
    function depositWei(
        uint256 _isolationModeMarketId,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        EventFlag _eventFlag
    ) external;
    
    /**
     * @notice Withdraw tokens from Dolomite account
     * @param _isolationModeMarketId The market ID of the isolation mode token vault (0 if not using isolation mode)
     * @param _fromAccountNumber The account number to withdraw from
     * @param _marketId The ID of the market being withdrawn
     * @param _amountWei The amount in Wei to withdraw. Use type(uint256).max to withdraw entire balance
     * @param _balanceCheckFlag Flag indicating how to validate account balances after withdrawal
     * 
     * EXAMPLE: Withdraw 1 WETH from account 0
     * uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(WETH);
     * router.withdrawWei(0, 0, marketId, 1 ether, BalanceCheckFlag.From);
     */
    function withdrawWei(
        uint256 _isolationModeMarketId,
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;
}
