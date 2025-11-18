// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/ISwapPlugin.sol";
import "../interfaces/IDolomite.sol";

/**
 * @title DolomitePlugin
 * @notice "Fake swap" plugin for Dolomite lending - deposits disguised as swaps
 * @dev Implements ISwapPlugin to integrate seamlessly with SwapManager
 * 
 * GENIUS CONCEPT:
 * - SwapManager thinks: "I'm swapping WETH for dWETH"
 * - DolomitePlugin does: deposit(WETH) → Dolomite balance
 * - "Output token" (dWETH) = synthetic token representing Dolomite position
 * 
 * FAKE SWAP MAPPING:
 * Input Token  → Output Token    = What Actually Happens
 * ────────────────────────────────────────────────────────
 * WETH         → dWETH (0xd...)  = deposit WETH to Dolomite
 * USDC         → dUSDC (0xd...)  = deposit USDC to Dolomite
 * dWETH (0xd...) → WETH          = withdraw WETH from Dolomite
 * 
 * SYNTHETIC TOKEN ADDRESSES:
 * We use deterministic fake addresses (keccak256 hash) to represent positions:
 * - dWETH = keccak256("dolomite.WETH") → 0xd...
 * - dUSDC = keccak256("dolomite.USDC") → 0xd...
 * These are NOT real ERC20s, just identifiers for SwapManager
 * 
 * ADVANTAGES:
 * ✅ Zero modifications to SwapManager
 * ✅ Reuses all SwapManager features (best price, slippage, etc.)
 * ✅ Registered in Beacon like other swap plugins
 * ✅ Can compete with Aave, Compound plugins (if we build them)
 * ✅ SwapManager's getAllQuotes() includes Dolomite yields
 * 
 * ARCHITECTURE:
 * - Registered in Beacon as "DolomitePlugin"
 * - Owner = address(this) for all Dolomite accounts
 * - Account #0: Main account (all deposits aggregated here)
 * - Future: Account #1+ for isolated borrow positions
 * 
 * DEPLOYMENT (Arbitrum One):
 * - DolomiteMargin: 0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072
 * - BorrowPositionRouter: TBD
 * - DepositWithdrawalRouter: TBD
 */
contract DolomitePlugin is ISwapPlugin, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ==================== IMMUTABLES ====================
    
    /// @notice Dolomite core protocol contract
    IDolomiteMargin public immutable dolomiteMargin;
    
    /// @notice Borrow position router (for future use)
    IBorrowPositionRouter public immutable borrowRouter;
    
    /// @notice Deposit/Withdrawal router
    IDepositWithdrawalRouter public immutable depositRouter;
    
    // ==================== CONSTANTS ====================
    
    /// @notice Main account number (used for all deposits)
    uint256 public constant MAIN_ACCOUNT = 0;
    
    /// @notice Feature flags bitmask for ISwapPlugin
    uint256 private constant FEATURE_BASIC_SWAP = 1;
    
    /// @notice Synthetic token prefix for deterministic address generation
    /// @dev keccak256("dolomite.") = 0x...
    bytes32 private constant SYNTHETIC_PREFIX = keccak256("dolomite.");
    
    // ==================== STATE VARIABLES ====================
    
    /// @notice Circuit breaker flag (emergency stop)
    bool public circuitBreakerTripped;
    
    /// @notice Mapping: real token → synthetic token (dToken)
    /// @dev WETH → dWETH, USDC → dUSDC, etc.
    mapping(address => address) public realToSynthetic;
    
    /// @notice Mapping: synthetic token (dToken) → real token
    /// @dev dWETH → WETH, dUSDC → USDC, etc.
    mapping(address => address) public syntheticToReal;
    
    /// @notice Supported tokens list (for easy enumeration)
    address[] public supportedTokens;
    
    // ==================== ERRORS ====================
    
    error InvalidAddress();
    error CircuitBreakerActive();
    error TokenNotSupported(address token);
    error InsufficientBalance(int256 available, uint256 requested);
    error DepositFailed(address token, uint256 amount);
    error WithdrawalFailed(address token, uint256 amount);
    error InvalidSwapDirection(address tokenIn, address tokenOut);
    error SyntheticTokenAlreadyExists(address token);
    
    // ==================== EVENTS ====================
    
    event SyntheticTokenRegistered(
        address indexed realToken,
        address indexed syntheticToken
    );
    
    event DolomiteDeposit(
        address indexed user,
        address indexed token,
        uint256 amount,
        address syntheticToken
    );
    
    event DolomiteWithdrawal(
        address indexed user,
        address indexed token,
        uint256 amount,
        address syntheticToken
    );
    
    // ==================== CONSTRUCTOR ====================
    
    /**
     * @notice Initialize DolomitePlugin with protocol addresses
     * @param _dolomiteMargin DolomiteMargin core contract address
     * @param _borrowRouter BorrowPositionRouter address
     * @param _depositRouter DepositWithdrawalRouter address
     */
    constructor(
        address _dolomiteMargin,
        address _borrowRouter,
        address _depositRouter
    ) Ownable() {
        if (_dolomiteMargin == address(0)) revert InvalidAddress();
        if (_borrowRouter == address(0)) revert InvalidAddress();
        if (_depositRouter == address(0)) revert InvalidAddress();
        
        dolomiteMargin = IDolomiteMargin(_dolomiteMargin);
        borrowRouter = IBorrowPositionRouter(_borrowRouter);
        depositRouter = IDepositWithdrawalRouter(_depositRouter);
    }
    
    // ==================== MODIFIERS ====================
    
    modifier whenNotPaused() {
        if (circuitBreakerTripped) revert CircuitBreakerActive();
        _;
    }
    
    // ==================== ISWAP PLUGIN METADATA ====================
    
    /**
     * @inheritdoc ISwapPlugin
     * @dev Returns "Dolomite Lending" as a swap plugin
     */
    function getProtocolInfo() external pure override returns (ProtocolInfo memory) {
        return ProtocolInfo({
            name: "Dolomite Lending",
            version: "1.0.0",
            features: FEATURE_BASIC_SWAP // Deposit/withdraw as "swap"
        });
    }
    
    /**
     * @inheritdoc ISwapPlugin
     * @dev Checks if pair is valid deposit/withdraw direction
     * 
     * VALID PAIRS:
     * - (WETH, dWETH) = deposit WETH
     * - (dWETH, WETH) = withdraw WETH
     * - (USDC, dUSDC) = deposit USDC
     * - (dUSDC, USDC) = withdraw USDC
     */
    function supportsTokenPair(
        address tokenA,
        address tokenB
    ) external view override returns (bool) {
        // Check if tokenA → tokenB is deposit direction
        if (realToSynthetic[tokenA] == tokenB) {
            return _isTokenSupported(tokenA);
        }
        
        // Check if tokenA → tokenB is withdraw direction
        if (syntheticToReal[tokenA] == tokenB) {
            return _isTokenSupported(tokenB);
        }
        
        return false;
    }
    
    /**
     * @inheritdoc ISwapPlugin
     * @dev Health checks: DolomiteMargin exists, routers accessible, no circuit breaker
     */
    function isHealthy() external view override returns (bool healthy, string memory reason) {
        // Check circuit breaker
        if (circuitBreakerTripped) {
            return (false, "Circuit breaker active");
        }
        
        // Check DolomiteMargin contract exists
        uint256 size;
        address target = address(dolomiteMargin);
        assembly {
            size := extcodesize(target)
        }
        if (size == 0) {
            return (false, "DolomiteMargin contract not found");
        }
        
        // Check deposit router exists
        target = address(depositRouter);
        assembly {
            size := extcodesize(target)
        }
        if (size == 0) {
            return (false, "DepositRouter contract not found");
        }
        
        return (true, "");
    }
    
    // ==================== ISIMPLESWAP IMPLEMENTATION (FAKE SWAPS) ====================
    
    /**
     * @inheritdoc ISimpleSwap
     * @dev "Swap" that's actually a deposit or withdraw
     * 
     * LOGIC:
     * - If spendToken is real and receiveToken is synthetic → DEPOSIT
     *   Example: WETH → dWETH = deposit WETH to Dolomite
     * 
     * - If spendToken is synthetic and receiveToken is real → WITHDRAW
     *   Example: dWETH → WETH = withdraw WETH from Dolomite
     */
    function inputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountIn
    ) external override nonReentrant whenNotPaused returns (uint256 amountOut) {
        // Validate inputs
        require(spendToken != address(0), "Invalid spendToken");
        require(receiveToken != address(0), "Invalid receiveToken");
        require(amountIn > 0, "Invalid amountIn");
        
        // Determine direction: deposit or withdraw
        bool isDeposit = (realToSynthetic[spendToken] == receiveToken);
        bool isWithdraw = (syntheticToReal[spendToken] == receiveToken);
        
        if (!isDeposit && !isWithdraw) {
            revert InvalidSwapDirection(spendToken, receiveToken);
        }
        
        if (isDeposit) {
            // DEPOSIT: spendToken (real) → receiveToken (synthetic)
            return _executeDeposit(spendToken, receiveToken, amountIn);
        } else {
            // WITHDRAW: spendToken (synthetic) → receiveToken (real)
            return _executeWithdraw(spendToken, receiveToken, amountIn);
        }
    }
    
    /**
     * @inheritdoc ISimpleSwap
     * @dev Output swap not supported for deposits (use inputSwap)
     */
    function outputSwap(
        address /* spendToken */,
        address /* receiveToken */,
        uint256 /* amountInMax */,
        uint256 /* amountOut */
    ) external pure override returns (uint256) {
        revert("DolomitePlugin: outputSwap not supported, use inputSwap");
    }
    
    /**
     * @inheritdoc ISimpleSwap
     * @dev Returns 1:1 ratio for deposits/withdraws (no slippage on Dolomite)
     */
    function getExpectedOutput(
        address spendToken,
        address receiveToken,
        uint256 amountIn
    ) external view override returns (uint256) {
        // Check if valid pair
        bool isDeposit = (realToSynthetic[spendToken] == receiveToken);
        bool isWithdraw = (syntheticToReal[spendToken] == receiveToken);
        
        if (!isDeposit && !isWithdraw) {
            return 0; // Invalid pair
        }
        
        // Dolomite deposits/withdraws are 1:1 (no fees, no slippage)
        return amountIn;
    }
    
    // ==================== INTERNAL DEPOSIT/WITHDRAW ====================
    
    /**
     * @notice Execute deposit: real token → Dolomite → synthetic token
     * @param realToken Real token being deposited (e.g., WETH)
     * @param syntheticToken Synthetic token representing position (e.g., dWETH)
     * @param amount Amount to deposit
     * @return amountOut Amount of synthetic tokens "minted" (always 1:1)
     */
    function _executeDeposit(
        address realToken,
        address syntheticToken,
        uint256 amount
    ) internal returns (uint256 amountOut) {
        if (!_isTokenSupported(realToken)) {
            revert TokenNotSupported(realToken);
        }
        
        // Get market ID for real token
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(realToken);
        
        // Transfer real tokens from caller (SwapManager) to this contract
        IERC20(realToken).safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve DepositRouter to spend tokens
        IERC20(realToken).safeApprove(address(depositRouter), amount);
        
        // Deposit to Dolomite main account (account #0)
        // API: depositWei(_isolationModeMarketId, _toAccountNumber, _marketId, _amountWei, _eventFlag)
        try depositRouter.depositWei(
            0,              // _isolationModeMarketId (0 = not using isolation mode)
            MAIN_ACCOUNT,   // _toAccountNumber
            marketId,       // _marketId
            amount,         // _amountWei
            IDepositWithdrawalRouter.EventFlag.None  // _eventFlag
        ) {
            // Deposit succeeded
            // "Mint" synthetic tokens (conceptually - we don't actually mint ERC20s)
            // The balance exists on Dolomite, tracked by this contract
            
            emit DolomiteDeposit(msg.sender, realToken, amount, syntheticToken);
            
            // Return amount (1:1 ratio for deposits)
            return amount;
        } catch Error(string memory /* reason */) {
            revert DepositFailed(realToken, amount);
        } catch {
            revert DepositFailed(realToken, amount);
        }
    }
    
    /**
     * @notice Execute withdrawal: synthetic token → Dolomite → real token
     * @param syntheticToken Synthetic token being "burned" (e.g., dWETH)
     * @param realToken Real token being withdrawn (e.g., WETH)
     * @param amount Amount to withdraw
     * @return amountOut Amount of real tokens withdrawn
     */
    function _executeWithdraw(
        address syntheticToken,
        address realToken,
        uint256 amount
    ) internal returns (uint256 amountOut) {
        if (!_isTokenSupported(realToken)) {
            revert TokenNotSupported(realToken);
        }
        
        // Get market ID for real token
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(realToken);
        
        // Check current balance on Dolomite
        Account.Info memory account = Account.Info({
            owner: address(this),
            number: MAIN_ACCOUNT
        });
        
        Types.Wei memory weiBalance = dolomiteMargin.getAccountWei(account, marketId);
        
        // Convert to int256
        int256 currentBalance;
        if (weiBalance.sign) {
            currentBalance = int256(weiBalance.value);
        } else {
            currentBalance = -int256(weiBalance.value);
        }
        
        if (currentBalance <= 0) {
            revert InsufficientBalance(currentBalance, amount);
        }
        
        uint256 availableBalance = uint256(currentBalance);
        
        if (amount > availableBalance) {
            revert InsufficientBalance(currentBalance, amount);
        }
        
        // Record balance before withdrawal
        uint256 balanceBefore = IERC20(realToken).balanceOf(address(this));
        
        // Withdraw from Dolomite to this contract
        // API: withdrawWei(_isolationModeMarketId, _fromAccountNumber, _marketId, _amountWei, _balanceCheckFlag)
        try depositRouter.withdrawWei(
            0,              // _isolationModeMarketId (0 = not using isolation mode)
            MAIN_ACCOUNT,   // _fromAccountNumber
            marketId,       // _marketId
            amount,         // _amountWei
            AccountBalanceLib.BalanceCheckFlag.From  // _balanceCheckFlag (check source account)
        ) {
            // Calculate actual amount withdrawn
            uint256 balanceAfter = IERC20(realToken).balanceOf(address(this));
            amountOut = balanceAfter - balanceBefore;
            
            // Transfer real tokens to caller (SwapManager)
            IERC20(realToken).safeTransfer(msg.sender, amountOut);
            
            emit DolomiteWithdrawal(msg.sender, realToken, amountOut, syntheticToken);
            
            return amountOut;
        } catch Error(string memory /* reason */) {
            revert WithdrawalFailed(realToken, amount);
        } catch {
            revert WithdrawalFailed(realToken, amount);
        }
    }
    
    // ==================== ADMIN: TOKEN REGISTRATION ====================
    
    /**
     * @notice Register a new token with synthetic counterpart
     * @param realToken Real token address (e.g., WETH)
     * @dev Automatically generates deterministic synthetic address
     * 
     * SYNTHETIC ADDRESS GENERATION:
     * syntheticAddr = address(uint160(uint256(keccak256(abi.encodePacked(SYNTHETIC_PREFIX, realToken)))))
     * 
     * This creates a unique, deterministic address for each token that:
     * - Won't collide with real ERC20 addresses (probabilistically impossible)
     * - Is reproducible (same input → same output)
     * - Doesn't require deploying actual ERC20 contracts
     */
    function registerToken(address realToken) external onlyOwner {
        if (realToken == address(0)) revert InvalidAddress();
        if (realToSynthetic[realToken] != address(0)) {
            revert SyntheticTokenAlreadyExists(realToken);
        }
        if (!_isTokenSupported(realToken)) {
            revert TokenNotSupported(realToken);
        }
        
        // Generate deterministic synthetic address
        address syntheticToken = _generateSyntheticAddress(realToken);
        
        // Register mappings
        realToSynthetic[realToken] = syntheticToken;
        syntheticToReal[syntheticToken] = realToken;
        
        // Add to supported tokens list
        supportedTokens.push(realToken);
        
        emit SyntheticTokenRegistered(realToken, syntheticToken);
    }
    
    /**
     * @notice Generate deterministic synthetic address for a token
     * @param realToken Real token address
     * @return syntheticAddr Deterministic synthetic address
     */
    function _generateSyntheticAddress(address realToken) internal pure returns (address) {
        bytes32 hash = keccak256(abi.encodePacked(SYNTHETIC_PREFIX, realToken));
        return address(uint160(uint256(hash)));
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
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @notice Get synthetic token for a real token
     * @param realToken Real token address
     * @return syntheticToken Synthetic token address (or zero if not registered)
     */
    function getSyntheticToken(address realToken) external view returns (address) {
        return realToSynthetic[realToken];
    }
    
    /**
     * @notice Get real token for a synthetic token
     * @param syntheticToken Synthetic token address
     * @return realToken Real token address (or zero if not registered)
     */
    function getRealToken(address syntheticToken) external view returns (address) {
        return syntheticToReal[syntheticToken];
    }
    
    /**
     * @notice Get list of all supported tokens
     * @return tokens Array of real token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }
    
    /**
     * @notice Get Dolomite balance for a token
     * @param token Real token address
     * @return balance Account balance on Dolomite (signed: positive = deposit, negative = borrow)
     */
    function getDolomiteBalance(address token) external view returns (int256) {
        if (!_isTokenSupported(token)) revert TokenNotSupported(token);
        
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(token);
        
        // Create account info struct
        Account.Info memory account = Account.Info({
            owner: address(this),
            number: MAIN_ACCOUNT
        });
        
        // Get balance as Wei struct
        Types.Wei memory weiBalance = dolomiteMargin.getAccountWei(account, marketId);
        
        // Convert Wei struct to int256
        // sign = true means positive (supply), sign = false means negative (borrow)
        if (weiBalance.sign) {
            return int256(weiBalance.value);
        } else {
            return -int256(weiBalance.value);
        }
    }
    
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @notice Emergency circuit breaker (pause all operations)
     * @param trip True to activate, false to deactivate
     */
    function setCircuitBreaker(bool trip) external onlyOwner {
        circuitBreakerTripped = trip;
        
        emit HealthStatusChanged(
            !trip,
            trip ? "Circuit breaker activated by owner" : "Circuit breaker deactivated",
            block.timestamp
        );
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
}
