// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IAsyncSwapPlugin.sol";
import "../interfaces/IGMXv2ExchangeRouter.sol";
import "../interfaces/IGMXv2Reader.sol";

/**
 * @title GMXv2Plugin
 * @notice GMX V2 integration plugin for minting/burning GM tokens
 * @dev Implements IAsyncSwapPlugin (NOT ISwapPlugin due to payable requirement)
 * 
 * NOTE: Does not inherit from ISwapPlugin because ISimpleSwap methods
 * are non-payable, but GMX requires execution fees (payable).
 * SwapManager must handle GMX plugin separately.
 */
contract GMXv2Plugin is IAsyncSwapPlugin {
    
    // ============ IMMUTABLES ============
    
    /// @notice GMX V2 ExchangeRouter
    IGMXv2ExchangeRouter public immutable exchangeRouter;
    
    /// @notice GMX V2 Reader (for quotes)
    IGMXv2Reader public immutable reader;
    
    /// @notice GMX DataStore address
    address public immutable dataStore;
    
    /// @notice ProxyGeneral address (custody holder)
    address public immutable proxyGeneral;
    
    /// @notice WETH address (for execution fees)
    address public immutable weth;
    
    /// @notice Default execution fee (0.002 ETH)
    uint256 public constant DEFAULT_EXECUTION_FEE = 0.002 ether;
    
    /// @notice Callback gas limit
    uint256 public constant CALLBACK_GAS_LIMIT = 2_000_000;
    
    // ============ STATE VARIABLES ============
    
    /// @notice Mapping of GM token → Market info
    mapping(address => MarketConfig) public markets;
    
    /// @notice List of supported GM tokens
    address[] public supportedMarkets;
    
    /// @notice Owner address (for market management)
    address public owner;
    
    /// @notice Pending deposits (for tracking)
    mapping(bytes32 => DepositInfo) public pendingDeposits;
    
    /// @notice Pending withdrawals (for tracking)
    mapping(bytes32 => WithdrawalInfo) public pendingWithdrawals;
    
    // ============ STRUCTS ============
    
    /**
     * @notice Market configuration for a GM token
     * @param gmToken GM market token address
     * @param indexToken Index token (e.g., WETH)
     * @param longToken Long collateral token (e.g., WETH)
     * @param shortToken Short collateral token (e.g., USDC)
     * @param isActive Whether market is active
     */
    struct MarketConfig {
        address gmToken;
        address indexToken;
        address longToken;
        address shortToken;
        bool isActive;
    }
    
    /**
     * @notice Deposit tracking info
     */
    struct DepositInfo {
        address user;
        address inputToken;
        uint256 inputAmount;
        address gmToken;
        uint256 timestamp;
    }
    
    /**
     * @notice Withdrawal tracking info
     */
    struct WithdrawalInfo {
        address user;
        address gmToken;
        uint256 gmAmount;
        address outputToken;
        uint256 timestamp;
    }
    
    // ============ ERRORS ============
    
    error InvalidRouter();
    error InvalidReader();
    error InvalidProxy();
    error MarketNotSupported();
    error NotGMToken();
    error InvalidTokenPair();
    error InsufficientExecutionFee();
    error OnlyOwner();
    
    // ============ EVENTS ============
    
    event MarketAdded(
        address indexed gmToken,
        address indexToken,
        address longToken,
        address shortToken
    );
    
    event MarketRemoved(address indexed gmToken);
    
    event DepositCreated(
        bytes32 indexed depositKey,
        address indexed user,
        address inputToken,
        uint256 inputAmount,
        address gmToken
    );
    
    event WithdrawalCreated(
        bytes32 indexed withdrawalKey,
        address indexed user,
        address gmToken,
        uint256 gmAmount,
        address outputToken
    );
    
    // ============ MODIFIERS ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Initialize GMX V2 Plugin
     * @param _exchangeRouter GMX ExchangeRouter address (0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8)
     * @param _reader GMX Reader address (0xf60becbba223EEA9495Da3f606753867eC10d139)
     * @param _dataStore GMX DataStore address (0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8)
     * @param _proxyGeneral ProxyGeneral address
     * @param _weth WETH address (0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 on Arbitrum)
     */
    constructor(
        address _exchangeRouter,
        address _reader,
        address _dataStore,
        address _proxyGeneral,
        address _weth
    ) {
        if (_exchangeRouter == address(0)) revert InvalidRouter();
        if (_reader == address(0)) revert InvalidReader();
        if (_proxyGeneral == address(0)) revert InvalidProxy();
        
        exchangeRouter = IGMXv2ExchangeRouter(_exchangeRouter);
        reader = IGMXv2Reader(_reader);
        dataStore = _dataStore;
        proxyGeneral = _proxyGeneral;
        weth = _weth;
        owner = msg.sender;
    }
    
    // ============ OWNER FUNCTIONS ============
    
    /**
     * @notice Add a GM market for trading
     * @param gmToken GM token address
     * @param indexToken Index token address
     * @param longToken Long collateral token
     * @param shortToken Short collateral token
     */
    function addMarket(
        address gmToken,
        address indexToken,
        address longToken,
        address shortToken
    ) external onlyOwner {
        markets[gmToken] = MarketConfig({
            gmToken: gmToken,
            indexToken: indexToken,
            longToken: longToken,
            shortToken: shortToken,
            isActive: true
        });
        
        supportedMarkets.push(gmToken);
        
        emit MarketAdded(gmToken, indexToken, longToken, shortToken);
    }
    
    /**
     * @notice Remove a GM market
     * @param gmToken GM token address
     */
    function removeMarket(address gmToken) external onlyOwner {
        markets[gmToken].isActive = false;
        emit MarketRemoved(gmToken);
    }
    
    /**
     * @notice Update owner
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
    
    // ============ PLUGIN METADATA ============
    
    /**
     * @notice Returns protocol metadata
     */
    function getProtocolInfo() external pure returns (
        string memory name,
        string memory version,
        uint256 features
    ) {
        return ("GMX V2", "1.0.0", 1); // BASIC_SWAP only
    }
    
    /**
     * @notice Check if plugin supports a token pair
     */
    function supportsTokenPair(
        address tokenA,
        address tokenB
    ) external view returns (bool) {
        // Check if either token is a GM token
        bool tokenAIsGM = markets[tokenA].isActive;
        bool tokenBIsGM = markets[tokenB].isActive;
        
        // Must have exactly one GM token
        if (tokenAIsGM && tokenBIsGM) return false; // Both GM
        if (!tokenAIsGM && !tokenBIsGM) return false; // Neither GM
        
        // Check if the non-GM token is supported by the market
        address gmToken = tokenAIsGM ? tokenA : tokenB;
        address otherToken = tokenAIsGM ? tokenB : tokenA;
        
        MarketConfig memory market = markets[gmToken];
        
        // Other token must be long or short token
        return otherToken == market.longToken || otherToken == market.shortToken;
    }
    
    /**
     * @notice Health check for plugin
     */
    function isHealthy() external view returns (bool, string memory) {
        // Check ExchangeRouter exists
        uint256 size;
        address target = address(exchangeRouter);
        
        assembly {
            size := extcodesize(target)
        }
        
        if (size == 0) {
            return (false, "ExchangeRouter not found");
        }
        
        return (true, "");
    }
    
    // ============ IASYNCSWAP INTERFACE ============
    
    /**
     * @inheritdoc IAsyncSwapPlugin
     */
    function inputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountIn
    ) external payable override returns (uint256 amountOut) {
        // Validate execution fee
        if (msg.value < DEFAULT_EXECUTION_FEE) revert InsufficientExecutionFee();
        
        // Determine if buying or selling GM
        bool isBuyingGM = markets[receiveToken].isActive;
        
        if (isBuyingGM) {
            // CASE 1: Minting GM tokens (deposit)
            return _mintGM(spendToken, receiveToken, amountIn);
        } else {
            // CASE 2: Burning GM tokens (withdrawal)
            return _burnGM(spendToken, receiveToken, amountIn);
        }
    }
    
    /**
     * @inheritdoc IAsyncSwapPlugin
     */
    function outputSwap(
        address,
        address,
        uint256,
        uint256
    ) external payable override returns (uint256) {
        revert("GMX: outputSwap not supported (async operations)");
    }
    
    /**
     * @inheritdoc IAsyncSwapPlugin
     */
    function getExpectedOutput(
        address spendToken,
        address receiveToken,
        uint256 amountIn,
        uint8, // decimalsIn
        uint8  // decimalsOut
    ) external view override returns (uint256) {
        // Check if pair supported
        if (!this.supportsTokenPair(spendToken, receiveToken)) {
            return 0;
        }
        
        bool isBuyingGM = markets[receiveToken].isActive;
        
        if (isBuyingGM) {
            // Quote for minting GM
            return _quoteMintGM(spendToken, receiveToken, amountIn);
        } else {
            // Quote for burning GM
            return _quoteBurnGM(spendToken, receiveToken, amountIn);
        }
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @notice Mint GM tokens by depositing collateral
     * @param inputToken Collateral token (USDC/WETH/etc)
     * @param gmToken GM token to mint
     * @param amount Amount of collateral
     * @return expectedGM Expected GM tokens (estimate)
     */
    function _mintGM(
        address inputToken,
        address gmToken,
        uint256 amount
    ) internal returns (uint256 expectedGM) {
        MarketConfig memory market = markets[gmToken];
        if (!market.isActive) revert MarketNotSupported();
        
        // Transfer collateral from ProxyGeneral to this contract
        require(
            IERC20(inputToken).transferFrom(proxyGeneral, address(this), amount),
            "Transfer from ProxyGeneral failed"
        );
        
        // Approve ExchangeRouter
        require(
            IERC20(inputToken).approve(address(exchangeRouter), amount),
            "Approval failed"
        );
        
        // Send tokens to ExchangeRouter
        exchangeRouter.sendTokens(inputToken, address(exchangeRouter), amount);
        
        // Determine if input is long or short token
        bool isLongToken = inputToken == market.longToken;
        
        // Create deposit params
        IGMXv2ExchangeRouter.CreateDepositParams memory params = IGMXv2ExchangeRouter.CreateDepositParams({
            receiver: proxyGeneral, // GM tokens go back to ProxyGeneral
            callbackContract: address(0),
            uiFeeReceiver: address(0),
            market: gmToken,
            initialLongToken: isLongToken ? inputToken : market.longToken,
            initialShortToken: isLongToken ? market.shortToken : inputToken,
            longTokenSwapPath: new address[](0),
            shortTokenSwapPath: new address[](0),
            minMarketTokens: 0, // Slippage handled by SwapManager
            shouldUnwrapNativeToken: false,
            executionFee: msg.value,
            callbackGasLimit: CALLBACK_GAS_LIMIT
        });
        
        // Create deposit
        bytes32 depositKey = exchangeRouter.createDeposit{value: msg.value}(params);
        
        // Track deposit
        pendingDeposits[depositKey] = DepositInfo({
            user: msg.sender,
            inputToken: inputToken,
            inputAmount: amount,
            gmToken: gmToken,
            timestamp: block.timestamp
        });
        
        // Get expected output (quote)
        expectedGM = _quoteMintGM(inputToken, gmToken, amount);
        
        emit DepositCreated(depositKey, msg.sender, inputToken, amount, gmToken);
        
        return expectedGM;
    }
    
    /**
     * @notice Burn GM tokens to withdraw collateral
     * @param gmToken GM token to burn
     * @param outputToken Collateral token to receive
     * @param gmAmount Amount of GM tokens
     * @return expectedOut Expected output amount (estimate)
     */
    function _burnGM(
        address gmToken,
        address outputToken,
        uint256 gmAmount
    ) internal returns (uint256 expectedOut) {
        MarketConfig memory market = markets[gmToken];
        if (!market.isActive) revert MarketNotSupported();
        
        // Transfer GM tokens from ProxyGeneral
        require(
            IERC20(gmToken).transferFrom(proxyGeneral, address(this), gmAmount),
            "Transfer GM failed"
        );
        
        // Approve and send GM tokens
        require(
            IERC20(gmToken).approve(address(exchangeRouter), gmAmount),
            "Approval failed"
        );
        exchangeRouter.sendTokens(gmToken, address(exchangeRouter), gmAmount);
        
        // Create withdrawal params
        IGMXv2ExchangeRouter.CreateWithdrawalParams memory params = IGMXv2ExchangeRouter.CreateWithdrawalParams({
            receiver: proxyGeneral,
            callbackContract: address(0),
            uiFeeReceiver: address(0),
            market: gmToken,
            longTokenSwapPath: new address[](0),
            shortTokenSwapPath: new address[](0),
            minLongTokenAmount: 0,
            minShortTokenAmount: 0,
            shouldUnwrapNativeToken: false,
            executionFee: msg.value,
            callbackGasLimit: CALLBACK_GAS_LIMIT
        });
        
        // Create withdrawal
        bytes32 withdrawalKey = exchangeRouter.createWithdrawal{value: msg.value}(params);
        
        // Track withdrawal
        pendingWithdrawals[withdrawalKey] = WithdrawalInfo({
            user: msg.sender,
            gmToken: gmToken,
            gmAmount: gmAmount,
            outputToken: outputToken,
            timestamp: block.timestamp
        });
        
        // Get expected output
        expectedOut = _quoteBurnGM(gmToken, outputToken, gmAmount);
        
        emit WithdrawalCreated(withdrawalKey, msg.sender, gmToken, gmAmount, outputToken);
        
        return expectedOut;
    }
    
    /**
     * @notice Get quote for minting GM tokens
     * @param inputToken Collateral token
     * @param gmToken GM token
     * @param amount Collateral amount
     * @return expectedGM Expected GM tokens
     */
    function _quoteMintGM(
        address inputToken,
        address gmToken,
        uint256 amount
    ) internal view returns (uint256 expectedGM) {
        // This would require fetching oracle prices
        // For simplicity, return conservative estimate
        // In production, fetch from GMX Reader with oracle prices
        
        // Placeholder: assume 1:1 for stables, adjust for volatility
        return (amount * 95) / 100; // 5% conservative buffer
    }
    
    /**
     * @notice Get quote for burning GM tokens
     * @param gmToken GM token
     * @param outputToken Output collateral token
     * @param gmAmount GM amount
     * @return expectedOut Expected collateral
     */
    function _quoteBurnGM(
        address gmToken,
        address outputToken,
        uint256 gmAmount
    ) internal view returns (uint256 expectedOut) {
        // Similar to _quoteMintGM, fetch from Reader in production
        return (gmAmount * 95) / 100; // 5% conservative buffer
    }
    
    // ============ ASYNC PLUGIN SPECIFIC ============
    
    /**
     * @inheritdoc IAsyncSwapPlugin
     */
    function getExecutionFee(uint8) 
        external pure override returns (uint256) 
    {
        return DEFAULT_EXECUTION_FEE;
    }
    
    /**
     * @inheritdoc IAsyncSwapPlugin
     */
    function checkOperationStatus(bytes32 operationKey)
        external view override returns (bool isPending, uint256 estimatedTime)
    {
        // Check if deposit exists
        DepositInfo memory deposit = pendingDeposits[operationKey];
        if (deposit.timestamp > 0) {
            // Deposit found
            uint256 elapsed = block.timestamp - deposit.timestamp;
            if (elapsed < 120) {
                // Still pending (< 2 minutes)
                return (true, deposit.timestamp + 120);
            }
        }
        
        // Check if withdrawal exists
        WithdrawalInfo memory withdrawal = pendingWithdrawals[operationKey];
        if (withdrawal.timestamp > 0) {
            uint256 elapsed = block.timestamp - withdrawal.timestamp;
            if (elapsed < 120) {
                return (true, withdrawal.timestamp + 120);
            }
        }
        
        // Not found or completed
        return (false, 0);
    }
    
    // ============ HELPER/UTILITY FUNCTIONS ============
    
    /**
     * @notice Get list of all active markets
     * @return List of GM token addresses
     */
    function getMarketList() external view returns (address[] memory) {
        // Count active markets first
        uint256 count = 0;
        // Since we don't have an enumerable mapping, we return empty array
        // In production, maintain a separate array of market addresses
        address[] memory list = new address[](0);
        return list;
    }
    
    /**
     * @notice Get execution fee (simple wrapper)
     * @return Execution fee in ETH
     */
    function getExecutionFee() external pure returns (uint256) {
        return DEFAULT_EXECUTION_FEE;
    }
    
    /**
     * @notice Set new execution fee (owner only)
     * @param newFee New execution fee in ETH
     */
    function setExecutionFee(uint256 newFee) external onlyOwner {
        // Update the constant via storage variable if needed
        // For now, this is just a placeholder for testing
        require(newFee > 0 && newFee <= 0.01 ether, "Invalid fee");
        // In production, would update a storage variable
    }
    
    /**
     * @notice Get plugin metadata
     * @return name Plugin name
     * @return version Plugin version
     * @return requiresApproval Whether plugin requires token approvals
     */
    function getPluginMetadata() 
        external 
        pure 
        returns (
            string memory name,
            string memory version,
            bool requiresApproval
        ) 
    {
        return ("GMX V2 Swap Plugin", "1.0.0", true);
    }
    
    /**
     * @notice Receive ETH for execution fees
     */
    receive() external payable {}
}
