// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IProtocolManager.sol";
import "../interfaces/IProtocolAdapter.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/IDolomite.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/IProxyGeneral.sol";

/**
 * @title DolomitePlugin
 * @notice Plugin for Dolomite lending protocol integration via ProtocolManager
 * @dev Implements ILendingProtocol for common lending operations
 * 
 * ARCHITECTURE (ProtocolManager Pattern):
 * - Managed by ProtocolManager (9th core contract)
 * - Custody flow: ProxyGeneral → ProtocolManager → DolomitePlugin → Dolomite
 * - Common operations: deposit, withdraw, borrow, repay (via ILendingProtocol)
 * - Dolomite-specific: openBorrowPosition, borrowFromPosition, etc. (via executeProtocolCall)
 * 
 * INTERFACES IMPLEMENTED:
 * - IProtocolManager: deposit, withdraw, getBalance, getTotalValue, emergencyWithdrawAll
 * - ILendingProtocol: borrow, repay, getDebt, getHealthFactor, getBorrowCapacity
 * 
 * DOLOMITE FEATURES:
 * - Account #0: Main account (standard deposits/borrows)
 * - Account #1+: Isolated borrow positions (leveraged trading)
 * - Flash loans: Zero-fee via Operation framework
 * - All accounts owned by address(this) (plugin contract)
 * 
 * CUSTODY MODEL:
 * - ProtocolManager calls deposit/withdraw/borrow/repay
 * - Plugin expects tokens already in contract (sent by ProtocolManager)
 * - Plugin returns tokens to ProxyGeneral after operations
 * - NO direct owner calls (all via ProtocolManager)
 * 
 * DEPLOYMENT (Arbitrum One):
 * - DolomiteMargin: 0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072
 * - BorrowPositionRouter: TBD
 * - DepositWithdrawalRouter: TBD
 * 
 * @custom:security-contact security@project4.com
 * @custom:version 2.0.0 (refactored for ProtocolManager)
 */
contract DolomitePlugin is ILendingProtocol, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ==================== IMMUTABLES ====================
    
    /// @notice Beacon for module resolution (ProxyGeneral, TokenManager, etc.)
    address public immutable beacon;
    
    /// @notice Dolomite core protocol contract
    IDolomiteMargin public immutable dolomiteMargin;
    
    /// @notice Borrow position router (for future use)
    IBorrowPositionRouter public immutable borrowRouter;
    
    /// @notice Deposit/Withdrawal router
    IDepositWithdrawalRouter public immutable depositRouter;
    
    // ==================== CONSTANTS ====================
    
    /// @notice Main account number (used for all deposits)
    uint256 public constant MAIN_ACCOUNT = 0;
    
    /// @notice Starting account number for borrow positions
    /// @dev Users' borrow positions start from account #1, #2, #3...
    uint256 public constant BORROW_ACCOUNT_START = 1;
    
    // ==================== STATE VARIABLES ====================
    
    /// @notice Circuit breaker flag (emergency stop)
    bool public circuitBreakerTripped;
    
    /// @notice Track next available borrow account number per user
    /// @dev user address => next account number (starts at BORROW_ACCOUNT_START = 1)
    mapping(address => uint256) public nextBorrowAccount;
    
    // ==================== ERRORS ====================
    
    error InvalidAddress();
    error CircuitBreakerActive();
    error TokenNotSupported(address token);
    error InsufficientBalance(int256 available, uint256 requested);
    error DepositFailed(address token, uint256 amount);
    error WithdrawalFailed(address token, uint256 amount);
    error BorrowFailed(address token, uint256 amount);
    error RepayFailed(address token, uint256 amount);
    error InvalidAccountNumber(uint256 accountNumber);
    error AccountNotEmpty(uint256 accountNumber);
    error FlashLoanFailed(string reason);
    
    // ==================== EVENTS ====================
    
    event DolomiteDeposit(
        address indexed token,
        uint256 amount
    );
    
    event DolomiteWithdrawal(
        address indexed token,
        uint256 amount
    );
    
    event DolomiteBorrow(
        address indexed token,
        uint256 amount
    );
    
    event DolomiteRepay(
        address indexed token,
        uint256 amount
    );
    
    event BorrowPositionOpened(
        address indexed user,
        uint256 indexed accountNumber,
        address indexed collateralToken,
        uint256 collateralAmount
    );
    
    event BorrowPositionBorrowed(
        address indexed user,
        uint256 indexed accountNumber,
        address indexed borrowToken,
        uint256 borrowAmount
    );
    
    event BorrowPositionRepaid(
        address indexed user,
        uint256 indexed accountNumber,
        address indexed debtToken,
        uint256 repayAmount
    );
    
    event BorrowPositionClosed(
        address indexed user,
        uint256 indexed accountNumber
    );
    
    event FlashLoanExecuted(
        address indexed user,
        address indexed token,
        uint256 amount,
        address callbackContract
    );
    
    // ==================== CONSTRUCTOR ====================
    
    /**
     * @notice Initialize DolomitePlugin with protocol addresses
     * @param _beacon Beacon address for module resolution
     * @param _dolomiteMargin DolomiteMargin core contract address
     * @param _borrowRouter BorrowPositionRouter address
     * @param _depositRouter DepositWithdrawalRouter address
     */
    constructor(
        address _beacon,
        address _dolomiteMargin,
        address _borrowRouter,
        address _depositRouter
    ) Ownable() {
        if (_beacon == address(0)) revert InvalidAddress();
        if (_dolomiteMargin == address(0)) revert InvalidAddress();
        if (_borrowRouter == address(0)) revert InvalidAddress();
        if (_depositRouter == address(0)) revert InvalidAddress();
        
        beacon = _beacon;
        dolomiteMargin = IDolomiteMargin(_dolomiteMargin);
        borrowRouter = IBorrowPositionRouter(_borrowRouter);
        depositRouter = IDepositWithdrawalRouter(_depositRouter);
    }
    
    // ==================== MODIFIERS ====================
    
    modifier whenNotPaused() {
        if (circuitBreakerTripped) revert CircuitBreakerActive();
        _;
    }
    
    // ==================== IPROTOCOLMANAGER IMPLEMENTATION ====================
    
    /**
     * @inheritdoc IProtocolManager
     * @notice Deposit tokens into Dolomite protocol
     * @dev Expects tokens already in this contract (sent by ProtocolManager)
     * Flow: ProtocolManager transfers tokens here → deposit to Dolomite → update accounting
     */
    function deposit(
        string memory tokenCode,
        uint256 amount
    ) external override nonReentrant whenNotPaused returns (bool) {
        // Resolve token address from tokenCode
        address tokenAddress = _resolveTokenFromCode(tokenCode);
        if (!_isTokenSupported(tokenAddress)) {
            revert TokenNotSupported(tokenAddress);
        }
        
        // Check contract has tokens (should have been transferred by ProtocolManager)
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
        require(balance >= amount, "Insufficient balance - tokens not transferred");
        
        // Get market ID for token
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(tokenAddress);
        
        // Approve DepositRouter to spend tokens
        IERC20(tokenAddress).safeApprove(address(depositRouter), amount);
        
        // Deposit to Dolomite main account (account #0)
        try depositRouter.depositWei(
            0,              // _isolationModeMarketId (0 = not using isolation mode)
            MAIN_ACCOUNT,   // _toAccountNumber
            marketId,       // _marketId
            amount,         // _amountWei
            IDepositWithdrawalRouter.EventFlag.None
        ) {
            emit DolomiteDeposit(tokenAddress, amount);
            return true;
        } catch {
            revert DepositFailed(tokenAddress, amount);
        }
    }
    
    /**
     * @inheritdoc IProtocolManager
     * @notice Withdraw tokens from Dolomite protocol
     * @dev Withdraws from Dolomite → transfers to ProxyGeneral
     * Flow: Dolomite → this contract → ProxyGeneral
     */
    function withdraw(
        string memory tokenCode,
        uint256 amount
    ) external override nonReentrant whenNotPaused returns (bool) {
        // Resolve token address
        address tokenAddress = _resolveTokenFromCode(tokenCode);
        if (!_isTokenSupported(tokenAddress)) {
            revert TokenNotSupported(tokenAddress);
        }
        
        // Get market ID
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(tokenAddress);
        
        // Check available balance on Dolomite
        Account.Info memory account = Account.Info({
            owner: address(this),
            number: MAIN_ACCOUNT
        });
        
        Types.Wei memory weiBalance = dolomiteMargin.getAccountWei(account, marketId);
        int256 currentBalance = weiBalance.sign ? int256(weiBalance.value) : -int256(weiBalance.value);
        
        if (currentBalance <= 0 || uint256(currentBalance) < amount) {
            revert InsufficientBalance(currentBalance, amount);
        }
        
        // Record balance before withdrawal
        uint256 balanceBefore = IERC20(tokenAddress).balanceOf(address(this));
        
        // Withdraw from Dolomite to this contract
        try depositRouter.withdrawWei(
            0,              // _isolationModeMarketId
            MAIN_ACCOUNT,   // _fromAccountNumber
            marketId,       // _marketId
            amount,         // _amountWei
            AccountBalanceLib.BalanceCheckFlag.From
        ) {
            // Calculate actual amount withdrawn
            uint256 balanceAfter = IERC20(tokenAddress).balanceOf(address(this));
            uint256 amountWithdrawn = balanceAfter - balanceBefore;
            
            // Transfer to ProxyGeneral
            address proxyGeneral = _getProxyGeneral();
            IERC20(tokenAddress).safeTransfer(proxyGeneral, amountWithdrawn);
            
            emit DolomiteWithdrawal(tokenAddress, amountWithdrawn);
            return true;
        } catch {
            revert WithdrawalFailed(tokenAddress, amount);
        }
    }
    
    /**
     * @inheritdoc IProtocolManager
     * @notice Get balance of a token in Dolomite
     */
    function getBalance(
        string memory tokenCode
    ) external view override returns (uint256) {
        address tokenAddress = _resolveTokenFromCode(tokenCode);
        return _getDolomiteBalance(tokenAddress);
    }
    
    /**
     * @inheritdoc IProtocolManager
     * @notice Get total value of all deposits in ETH
     * @dev Calculates value of all positions on MAIN_ACCOUNT
     */
    function getTotalValue() external view override returns (uint256 totalValueETH) {
        // TODO: Implement actual calculation using Dolomite oracle prices
        // For now return 0 (placeholder)
        return 0;
    }
    
    /**
     * @inheritdoc IProtocolManager
     * @notice Get protocol information
     */
    function getProtocolInfo() external pure override returns (
        string memory name,
        string memory version,
        bool isActive
    ) {
        return ("Dolomite Lending", "2.0.0", true);
    }
    
    /**
     * @inheritdoc IProtocolManager
     * @notice Emergency withdraw all assets from Dolomite
     * @dev Withdraws all tokens from MAIN_ACCOUNT and transfers to ProxyGeneral
     */
    function emergencyWithdrawAll(
        string[] memory tokenCodes
    ) external override nonReentrant returns (bool) {
        address proxyGeneral = _getProxyGeneral();
        
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            address tokenAddress = _resolveTokenFromCode(tokenCodes[i]);
            
            // Get balance on Dolomite
            uint256 balance = _getDolomiteBalance(tokenAddress);
            if (balance == 0) continue;
            
            // Withdraw full balance
            uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(tokenAddress);
            
            try depositRouter.withdrawWei(
                0,
                MAIN_ACCOUNT,
                marketId,
                balance,
                AccountBalanceLib.BalanceCheckFlag.From
            ) {
                // Transfer to ProxyGeneral
                uint256 contractBalance = IERC20(tokenAddress).balanceOf(address(this));
                if (contractBalance > 0) {
                    IERC20(tokenAddress).safeTransfer(proxyGeneral, contractBalance);
                }
            } catch {
                // Continue with next token even if one fails
                continue;
            }
        }
        
        return true;
    }
    
    // ==================== ILENDINGPROTOCOL IMPLEMENTATION ====================
    
    /**
     * @inheritdoc ILendingProtocol
     * @notice Borrow tokens from Dolomite (MAIN_ACCOUNT)
     * @dev Creates debt by withdrawing tokens → transfers to ProxyGeneral
     */
    function borrow(
        string memory tokenCode,
        uint256 amount
    ) external override nonReentrant whenNotPaused returns (bool) {
        address tokenAddress = _resolveTokenFromCode(tokenCode);
        if (!_isTokenSupported(tokenAddress)) {
            revert TokenNotSupported(tokenAddress);
        }
        
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(tokenAddress);
        
        // Build Operation to withdraw tokens (creating debt)
        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info({
            owner: address(this),
            number: MAIN_ACCOUNT
        });
        
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Withdraw,
            accountId: 0,
            amount: TypesExtended.AssetAmount({
                sign: false,  // Negative (creates debt)
                denomination: TypesExtended.AssetDenomination.Wei,
                ref: TypesExtended.AssetReference.Delta,
                value: amount
            }),
            primaryMarketId: marketId,
            secondaryMarketId: 0,
            otherAddress: address(this),  // Withdraw to this contract
            otherAccountId: 0,
            data: ""
        });
        
        try dolomiteMargin.operate(accounts, actions) {
            // Transfer borrowed tokens to ProxyGeneral
            address proxyGeneral = _getProxyGeneral();
            IERC20(tokenAddress).safeTransfer(proxyGeneral, amount);
            
            emit DolomiteBorrow(tokenAddress, amount);
            return true;
        } catch {
            revert BorrowFailed(tokenAddress, amount);
        }
    }
    
    /**
     * @inheritdoc ILendingProtocol
     * @notice Repay debt on Dolomite (MAIN_ACCOUNT)
     * @dev Expects tokens already in contract → deposits to reduce debt
     */
    function repay(
        string memory tokenCode,
        uint256 amount
    ) external override nonReentrant whenNotPaused returns (bool) {
        address tokenAddress = _resolveTokenFromCode(tokenCode);
        if (!_isTokenSupported(tokenAddress)) {
            revert TokenNotSupported(tokenAddress);
        }
        
        // Check contract has tokens (should have been transferred by ProtocolManager)
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
        require(balance >= amount, "Insufficient balance - tokens not transferred");
        
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(tokenAddress);
        
        // Approve DolomiteMargin
        IERC20(tokenAddress).safeApprove(address(dolomiteMargin), amount);
        
        // Build Operation to deposit tokens (reducing debt)
        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info({
            owner: address(this),
            number: MAIN_ACCOUNT
        });
        
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Deposit,
            accountId: 0,
            amount: TypesExtended.AssetAmount({
                sign: true,  // Positive (deposit)
                denomination: TypesExtended.AssetDenomination.Wei,
                ref: TypesExtended.AssetReference.Delta,
                value: amount
            }),
            primaryMarketId: marketId,
            secondaryMarketId: 0,
            otherAddress: address(this),  // Deposit from this contract
            otherAccountId: 0,
            data: ""
        });
        
        try dolomiteMargin.operate(accounts, actions) {
            emit DolomiteRepay(tokenAddress, amount);
            return true;
        } catch {
            revert RepayFailed(tokenAddress, amount);
        }
    }
    
    /**
     * @inheritdoc ILendingProtocol
     * @notice Get debt amount for a token
     * @dev Returns absolute value of negative balance (debt)
     */
    function getDebt(
        string memory tokenCode
    ) external view override returns (uint256 debtAmount) {
        address tokenAddress = _resolveTokenFromCode(tokenCode);
        
        Account.Info memory account = Account.Info({
            owner: address(this),
            number: MAIN_ACCOUNT
        });
        
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(tokenAddress);
        Types.Wei memory weiBalance = dolomiteMargin.getAccountWei(account, marketId);
        
        // If balance is negative, it's debt
        if (!weiBalance.sign) {
            return weiBalance.value;
        }
        
        return 0; // No debt
    }
    
    /**
     * @inheritdoc ILendingProtocol
     * @notice Get health factor of account
     * @dev Health factor = collateral value / debt value
     * Returns 1e18 = 1.0, <1.0 = liquidatable
     */
    function getHealthFactor() external view override returns (uint256 healthFactor) {
        // TODO: Implement actual health factor calculation using Dolomite account values
        // For now return max uint256 (extremely healthy)
        return type(uint256).max;
    }
    
    /**
     * @inheritdoc ILendingProtocol
     * @notice Get remaining borrow capacity for a token
     */
    function getBorrowCapacity(
        string memory tokenCode
    ) external view override returns (uint256 capacity) {
        // TODO: Calculate based on collateral and LTV ratios
        return 0;
    }
    
    // ==================== INTERNAL HELPER FUNCTIONS ====================
    
    /**
     * @notice Resolve token address from tokenCode string
     * @dev Uses TokenManager to resolve token code to address
     * @param tokenCode Token code string (e.g., "WETH", "USDC")
     * @return tokenAddress Address of the token
     */
    function _resolveTokenFromCode(string memory tokenCode) internal view returns (address) {
        // Get TokenManager from Beacon
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        require(tokenManager != address(0), "TokenManager not found in Beacon");
        
        // TODO: Call TokenManager.getTokenAddress(tokenCode)
        // For now, this is a placeholder implementation
        // When TokenManager interface is updated, use proper call:
        // return ITokenManager(tokenManager).getTokenAddress(tokenCode);
        
        // TEMPORARY: Simple keccak-based resolution (INSECURE - for compilation only)
        // This should be replaced with actual TokenManager call in production
        bytes32 codeHash = keccak256(abi.encodePacked(tokenCode));
        
        // Hardcoded mainnet addresses for testing (Arbitrum One)
        if (codeHash == keccak256(abi.encodePacked("WETH"))) {
            return 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1; // WETH on Arbitrum
        } else if (codeHash == keccak256(abi.encodePacked("USDC"))) {
            return 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // USDC on Arbitrum
        } else if (codeHash == keccak256(abi.encodePacked("WBTC"))) {
            return 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f; // WBTC on Arbitrum
        }
        
        // If not found, revert
        revert("Token not found - implement proper TokenManager integration");
    }
    
    /**
     * @notice Get Dolomite balance for a token (positive = collateral, negative = debt)
     * @param tokenAddress Token address
     * @return balance Balance in uint256 (only positive balances)
     */
    function _getDolomiteBalance(address tokenAddress) internal view returns (uint256) {
        if (!_isTokenSupported(tokenAddress)) return 0;
        
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(tokenAddress);
        
        Account.Info memory account = Account.Info({
            owner: address(this),
            number: MAIN_ACCOUNT
        });
        
        Types.Wei memory weiBalance = dolomiteMargin.getAccountWei(account, marketId);
        
        // Return only positive balances (collateral)
        if (weiBalance.sign) {
            return weiBalance.value;
        }
        
        return 0;
    }
    
    /**
     * @notice Get ProxyGeneral address from Beacon
     * @return proxyGeneral Address of ProxyGeneral
     */
    function _getProxyGeneral() internal view returns (address) {
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        require(proxyGeneral != address(0), "ProxyGeneral not found in Beacon");
        return proxyGeneral;
    }
    
    /**
     * @notice Check if token is supported by Dolomite
     * @param token Token address to check
     * @return True if token has a market on Dolomite
     */
    function _isTokenSupported(address token) internal view returns (bool) {
        if (token == address(0)) return false;
        
        try dolomiteMargin.getMarketIdByTokenAddress(token) returns (uint256 marketId) {
            // Market ID should be valid
            return marketId < 1000; // Reasonable upper bound
        } catch {
            return false;
        }
    }
    
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @notice Emergency circuit breaker (pause all operations)
     * @param trip True to activate, false to deactivate
     */
    function setCircuitBreaker(bool trip) external onlyOwner {
        circuitBreakerTripped = trip;
    }
    
    /**
     * @notice Emergency token recovery (in case tokens get stuck)
     * @param token Token address to recover
     * @param amount Amount to recover
     * @param recipient Recipient address
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner {
        if (recipient == address(0)) revert InvalidAddress();
        
        IERC20(token).safeTransfer(recipient, amount);
    }
    
    // ==================== BORROW POSITIONS (OPTION 3: DIRECT CALLS) ====================
    
    /**
     * @notice Open a new leveraged borrow position
     * @dev Moves collateral from main account to isolated borrow account
     * @param collateralToken Token to use as collateral
     * @param collateralAmount Amount of collateral to move
     * @return accountNumber The account number of the new borrow position
     */
    function openBorrowPosition(
        address collateralToken,
        uint256 collateralAmount
    ) external nonReentrant whenNotPaused returns (uint256 accountNumber) {
        if (!_isTokenSupported(collateralToken)) {
            revert TokenNotSupported(collateralToken);
        }
        
        // Get or create next borrow account number for this user
        accountNumber = nextBorrowAccount[msg.sender];
        if (accountNumber == 0) {
            accountNumber = BORROW_ACCOUNT_START;
        }
        nextBorrowAccount[msg.sender] = accountNumber + 1;
        
        // Get market ID for collateral token
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(collateralToken);
        
        // Build Operation to transfer collateral from main account to borrow account
        Account.Info[] memory accounts = new Account.Info[](2);
        accounts[0] = Account.Info({
            owner: address(this),
            number: MAIN_ACCOUNT
        });
        accounts[1] = Account.Info({
            owner: address(this),
            number: accountNumber
        });
        
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Transfer,
            accountId: 0,  // From account[0] (main account)
            amount: TypesExtended.AssetAmount({
                sign: false,  // Negative (withdraw from source)
                denomination: TypesExtended.AssetDenomination.Wei,
                ref: TypesExtended.AssetReference.Delta,
                value: collateralAmount
            }),
            primaryMarketId: marketId,
            secondaryMarketId: 0,
            otherAddress: address(this),
            otherAccountId: 1,  // To account[1] (borrow position)
            data: ""
        });
        
        dolomiteMargin.operate(accounts, actions);
        
        emit BorrowPositionOpened(msg.sender, accountNumber, collateralToken, collateralAmount);
        
        return accountNumber;
    }
    
    /**
     * @notice Borrow tokens against a borrow position
     * @dev Creates debt by withdrawing tokens from Dolomite
     * @param accountNumber Account number of the borrow position
     * @param borrowToken Token to borrow
     * @param borrowAmount Amount to borrow
     */
    function borrowFromPosition(
        uint256 accountNumber,
        address borrowToken,
        uint256 borrowAmount
    ) external nonReentrant whenNotPaused {
        if (accountNumber < BORROW_ACCOUNT_START) {
            revert InvalidAccountNumber(accountNumber);
        }
        if (!_isTokenSupported(borrowToken)) {
            revert TokenNotSupported(borrowToken);
        }
        
        // Get market ID for borrow token
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(borrowToken);
        
        // Build Operation to withdraw tokens (creating debt)
        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info({
            owner: address(this),
            number: accountNumber
        });
        
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Withdraw,
            accountId: 0,
            amount: TypesExtended.AssetAmount({
                sign: false,  // Negative (creates debt)
                denomination: TypesExtended.AssetDenomination.Wei,
                ref: TypesExtended.AssetReference.Delta,
                value: borrowAmount
            }),
            primaryMarketId: marketId,
            secondaryMarketId: 0,
            otherAddress: address(this),  // Withdraw to this contract
            otherAccountId: 0,
            data: ""
        });
        
        dolomiteMargin.operate(accounts, actions);
        
        // Transfer borrowed tokens to user
        IERC20(borrowToken).safeTransfer(msg.sender, borrowAmount);
        
        emit BorrowPositionBorrowed(msg.sender, accountNumber, borrowToken, borrowAmount);
    }
    
    /**
     * @notice Repay debt on a borrow position
     * @dev User must approve this contract to spend repayment tokens first
     * @param accountNumber Account number of the borrow position
     * @param debtToken Token to repay
     * @param repayAmount Amount to repay (use extra to cover interest)
     */
    function repayBorrowPosition(
        uint256 accountNumber,
        address debtToken,
        uint256 repayAmount
    ) external nonReentrant whenNotPaused {
        if (accountNumber < BORROW_ACCOUNT_START) {
            revert InvalidAccountNumber(accountNumber);
        }
        if (!_isTokenSupported(debtToken)) {
            revert TokenNotSupported(debtToken);
        }
        
        // Get market ID for debt token
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(debtToken);
        
        // Transfer repayment tokens from user to this contract
        IERC20(debtToken).safeTransferFrom(msg.sender, address(this), repayAmount);
        
        // Approve DolomiteMargin
        IERC20(debtToken).safeApprove(address(dolomiteMargin), repayAmount);
        
        // Build Operation to deposit tokens (reducing debt)
        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info({
            owner: address(this),
            number: accountNumber
        });
        
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Deposit,
            accountId: 0,
            amount: TypesExtended.AssetAmount({
                sign: true,  // Positive (deposit)
                denomination: TypesExtended.AssetDenomination.Wei,
                ref: TypesExtended.AssetReference.Delta,
                value: repayAmount
            }),
            primaryMarketId: marketId,
            secondaryMarketId: 0,
            otherAddress: address(this),  // Deposit from this contract
            otherAccountId: 0,
            data: ""
        });
        
        dolomiteMargin.operate(accounts, actions);
        
        emit BorrowPositionRepaid(msg.sender, accountNumber, debtToken, repayAmount);
    }
    
    /**
     * @notice Close a borrow position and return collateral to main account
     * @dev All debt must be repaid first. See docs/DolomitePlugin_Implementation_Notes.md for known issues.
     * @param accountNumber Account number of the borrow position
     * @param collateralTokens Array of collateral tokens to withdraw
     * 
     * NOTE: May fail if residual debt exists (even 1 wei from interest accrual).
     * TODO: Add dust tolerance threshold before production (see implementation notes)
     */
    function closeBorrowPosition(
        uint256 accountNumber,
        address[] calldata collateralTokens
    ) external nonReentrant whenNotPaused {
        if (accountNumber < BORROW_ACCOUNT_START) {
            revert InvalidAccountNumber(accountNumber);
        }
        
        // Build Operation to transfer all collateral back to main account
        Account.Info[] memory accounts = new Account.Info[](2);
        accounts[0] = Account.Info({
            owner: address(this),
            number: accountNumber  // Borrow position
        });
        accounts[1] = Account.Info({
            owner: address(this),
            number: MAIN_ACCOUNT   // Main account
        });
        
        // Create transfer action for each collateral token
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](collateralTokens.length);
        
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            if (!_isTokenSupported(collateralTokens[i])) {
                revert TokenNotSupported(collateralTokens[i]);
            }
            
            uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(collateralTokens[i]);
            
            // Get current balance in borrow position
            Account.Info memory borrowAccount = Account.Info({
                owner: address(this),
                number: accountNumber
            });
            Types.Wei memory balance = dolomiteMargin.getAccountWei(borrowAccount, marketId);
            
            // Transfer all balance from borrow position to main account
            // Only transfer if positive (collateral), skip if zero or negative (debt)
            actions[i] = Actions.ActionArgs({
                actionType: Actions.ActionType.Transfer,
                accountId: 0,  // From account[0] (borrow position)
                amount: TypesExtended.AssetAmount({
                    sign: false,  // Negative (withdraw from source)
                    denomination: TypesExtended.AssetDenomination.Wei,
                    ref: TypesExtended.AssetReference.Target,  // Absolute amount (all)
                    value: balance.sign ? balance.value : 0  // Transfer only if positive balance
                }),
                primaryMarketId: marketId,
                secondaryMarketId: 0,
                otherAddress: address(this),
                otherAccountId: 1,  // To account[1] (main account)
                data: ""
            });
        }
        
        dolomiteMargin.operate(accounts, actions);
        
        emit BorrowPositionClosed(msg.sender, accountNumber);
    }
    
    // ==================== FLASH LOANS ====================
    
    /**
     * @notice Execute a flash loan using Dolomite's Operation framework
     * @dev Zero-fee flash loans. See docs/DolomitePlugin_Implementation_Notes.md for details.
     * @param token Token to flash loan
     * @param amount Amount to borrow
     * @param callbackContract Contract to call with borrowed funds (must return tokens)
     * @param callbackData Data to pass to callback contract
     */
    function executeFlashLoan(
        address token,
        uint256 amount,
        address callbackContract,
        bytes calldata callbackData
    ) external nonReentrant whenNotPaused {
        if (!_isTokenSupported(token)) {
            revert TokenNotSupported(token);
        }
        if (callbackContract == address(0)) {
            revert InvalidAddress();
        }
        
        // Get market ID
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(token);
        
        // Build Operation:
        // 1. Create account array (only using MAIN_ACCOUNT for flash loan)
        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info({
            owner: address(this),
            number: MAIN_ACCOUNT
        });
        
        // 2. Create actions array
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](3);
        
        // ACTION 1: Withdraw (creates flash loan by going negative)
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Withdraw,
            accountId: 0,  // Index in accounts array
            amount: TypesExtended.AssetAmount({
                sign: false,  // Negative (withdraw)
                denomination: TypesExtended.AssetDenomination.Wei,
                ref: TypesExtended.AssetReference.Delta,  // Relative amount
                value: amount
            }),
            primaryMarketId: marketId,
            secondaryMarketId: 0,
            otherAddress: address(this),  // Tokens sent to DolomitePlugin
            otherAccountId: 0,
            data: ""
        });
        
        // ACTION 2: Call external contract (use borrowed funds)
        actions[1] = Actions.ActionArgs({
            actionType: Actions.ActionType.Call,
            accountId: 0,
            amount: TypesExtended.AssetAmount({
                sign: true,
                denomination: TypesExtended.AssetDenomination.Wei,
                ref: TypesExtended.AssetReference.Delta,
                value: 0
            }),
            primaryMarketId: 0,
            secondaryMarketId: 0,
            otherAddress: callbackContract,
            otherAccountId: 0,
            data: abi.encodeWithSignature(
                "executeOperation(address,uint256,bytes)",
                token,
                amount,
                callbackData
            )
        });
        
        // ACTION 3: Deposit (repay flash loan)
        // Note: Callback contract must return tokens to this contract before this action
        actions[2] = Actions.ActionArgs({
            actionType: Actions.ActionType.Deposit,
            accountId: 0,
            amount: TypesExtended.AssetAmount({
                sign: true,  // Positive (deposit)
                denomination: TypesExtended.AssetDenomination.Wei,
                ref: TypesExtended.AssetReference.Delta,
                value: amount
            }),
            primaryMarketId: marketId,
            secondaryMarketId: 0,
            otherAddress: address(this),  // Tokens from DolomitePlugin
            otherAccountId: 0,
            data: ""
        });
        
        // Approve Dolomite to take back the tokens (for repayment)
        IERC20(token).safeApprove(address(dolomiteMargin), amount);
        
        // Execute flash loan operation
        try dolomiteMargin.operate(accounts, actions) {
            emit FlashLoanExecuted(msg.sender, token, amount, callbackContract);
        } catch Error(string memory reason) {
            revert FlashLoanFailed(reason);
        } catch {
            revert FlashLoanFailed("Unknown error during flash loan");
        }
    }
    
    // ==================== IProtocolAdapter IMPLEMENTATION ====================
    
    /**
     * @notice Close positions to obtain WETH (stub implementation)
     * @dev TODO: Implement proper position closing logic for Dolomite
     * @param targetWethAmount Target WETH amount to obtain
     * @return wethObtained WETH obtained
     * @return positionsClosed Positions closed
     */
    function closePositionsForWeth(uint256 targetWethAmount) 
        external 
        override
        nonReentrant
        returns (uint256 wethObtained, uint256 positionsClosed) 
    {
        // Stub implementation - returns 0
        // TODO: Implement actual position closing when Dolomite positions are supported
        return (0, 0);
    }
    
    /**
     * @notice Get positions sorted by risk (stub implementation)
     * @dev TODO: Implement proper position retrieval for Dolomite
     * @return positions Empty array (no positions tracked yet)
     */
    function getPositionsSortedByRisk() 
        external 
        view 
        returns (IProtocolAdapter.Position[] memory positions) 
    {
        // Stub implementation - returns empty array
        // TODO: Implement when Dolomite position tracking is added
        return new IProtocolAdapter.Position[](0);
    }
}
