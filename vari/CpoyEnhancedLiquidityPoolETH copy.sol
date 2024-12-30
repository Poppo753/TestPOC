// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Add these interfaces after your existing imports
interface ISimpleSwap {
    function inputSwap(address spendToken, address receiveToken, uint256 amountIn) external returns (uint256);
    function outputSwap(address spendToken, address receiveToken, uint256 amountInMax, uint256 amountOut) external returns (uint256);
}

interface IERC20Approval {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

/**
 * @title EnhancedLiquidityPoolETH
 * @dev A liquidity pool contract that handles ETH and ERC20 tokens with price feed integration
 * @notice This contract allows users to deposit ETH and receive LP tokens at a 1:1 ratio
 * @custom:security-contact security@yourdomain.com
 */
contract EnhancedLiquidityPoolETH is ERC20, ReentrancyGuard, Ownable {
    /// @notice Maximum amount of ETH that can be deposited in a single transaction
    uint256 public maxDeposit = 100 ether;
    
    /// @notice Maximum amount of ETH that can be withdrawn in a single transaction
    uint256 public maxWithdrawPerTx = 50 ether;
    
    /// @notice Minimum amount of ETH that can be deposited or withdrawn
    uint256 public minDeposit = 0.000001 ether;
    uint256 public minWithdraw = 0.000001 ether;
    
    /// @notice Maximum slippage allowed for withdrawals (200 = 2%)
    uint256 public maxSlippage = 200;
    
    /// @notice Minimum reserve ratio the pool must maintain (1000 = 10%)
    uint256 public poolReserveRatio = 0; // Changed to 0 as discussed
    
    /// @notice Duration for which price cache is considered valid
    uint256 public cacheDuration = 5 minutes;
    
    /// @notice Maximum age of price feed data before it's considered stale
    uint256 public maxPriceAge = 24 hours;
    
    /// @notice Maximum number of tokens that can be managed by the pool
    uint256 public maxTokensPerOperation = 10;
    
    /// @notice Maximum number of errors before triggering alert
    uint256 public maxErrors = 3;
    
    /// @notice Maximum amount that can be withdrawn per hour
    uint256 public withdrawLimitPerHour = 100 ether;

    // Add a counter state variable
    uint256 public tokenCodesCount;

    // SwapAdress Contract
    address public simpleSwapAddress;


    /**
     * @dev Struct containing token information and price feed data
     * @param tokenAddress Address of the ERC20 token
     * @param tokenDecimals Number of decimals for the token
     * @param tokenCode Unique identifier for the token
     * @param priceFeed Address of the Chainlink price feed
     * @param priceFeedDecimals Number of decimals in price feed
     * @param isActive Whether the token is currently active in the pool
     * @param lastPriceTimestamp Last time price was updated
     * @param lastPrice Last recorded price
     * @param heartbeat Maximum time between price updates
     */
    struct TokenInfo {
        address tokenAddress;
        uint8 tokenDecimals;
        string tokenCode;
        address priceFeed;
        uint8 priceFeedDecimals;
        bool isActive;
        uint256 lastPriceTimestamp;
        uint256 lastPrice;
        uint256 heartbeat;
    }

    /**
     * @dev Struct for caching token values to save gas
     * @param value Cached token value
     * @param timestamp When the cache was last updated
     * @param isValid Whether the cache is currently valid
     */
    struct TokenValueCache {
        uint256 value;
        uint256 timestamp;
        bool isValid;
    }

    /**
     * @dev Struct for withdrawal validation data
     * @param preWithdrawBalance Pool balance before withdrawal
     * @param totalValue Total pool value including all tokens
     * @param totalSupply Total supply of LP tokens
     * @param ethAmount Amount of ETH to withdraw
     * @param poolEthBalance Current ETH balance of the pool
     * @param pricesValid Whether all price feeds are valid
     */
    struct WithdrawValidation {
        uint256 preWithdrawBalance;
        uint256 totalValue;
        uint256 totalSupply;
        uint256 ethAmount;
        uint256 poolEthBalance;
        bool pricesValid;
    }

        // Add these new structures and variables for timelock mechanism
    struct PendingUpdate {
        string parameterName;
        uint256 newValue;
        uint256 executeTime;
        bool exists;
        address proposer;
    }

    // Storage
    /// @notice Mapping of token codes to their information
    mapping(string => TokenInfo) public tokenData;
    
    /// @notice Mapping of token codes to their cached values
    mapping(string => TokenValueCache) private tokenValueCache;
    
    /// @notice Mapping of token codes to their error counts
    mapping(string => uint256) public tokenErrors;

    // Mapping to store pending updates
    mapping(bytes32 => PendingUpdate) public pendingUpdates;
    
    /// @notice Array of all token codes in the pool
    string[] public tokenCodes;
    
    /// @notice Timestamp of last hourly withdrawal limit reset
    uint256 public lastHourlyReset;
    
    /// @notice Amount withdrawn in current hour
    uint256 public hourlyWithdrawnAmount;

    // Timelock duration (2 days)
    uint256 public constant TIMELOCK_DURATION = 2 days;
    
    /// @notice Emergency pause flag
    bool public paused;

    // Events
    /// @notice Emitted when a new token is added to the pool
    event TokenAdded(string tokenCode, address tokenAddress, address priceFeed);
    
    /// @notice Emitted when a token is removed from the pool
    event TokenRemoved(string tokenCode);
    
    /// @notice Emitted when a token operation encounters an error
    event TokenError(string tokenCode, string errorMessage);
    
    /// @notice Emitted when token value cache is updated
    event CacheUpdated(string tokenCode, uint256 value);
    
    /// @notice Emitted when price feed data is stale
    event PriceStale(string tokenCode, uint256 lastUpdateTime);
    
    /// @notice Emitted when total pool value is updated
    event PoolValueUpdated(uint256 totalValue);
    
    /// @notice Emitted when cache is cleared
    event CacheCleared(string tokenCode);
    
    /// @notice Emitted when heartbeat is updated
    event HeartbeatUpdated(string tokenCode, uint256 newHeartbeat);
    
    /// @notice Emitted when error threshold is reached
    event ErrorThresholdReached(string tokenCode);
    /**
     * @notice Emitted when a user deposits ETH into the pool
     * @param user Address of the depositor
     * @param ethAmount Amount of ETH deposited
     * @param sharesReceived Amount of LP tokens received
     * @param totalPoolETH Total ETH in pool after deposit
     * @param totalSupply Total supply of LP tokens after deposit
     */
    event Deposit(
        address indexed user,
        uint256 ethAmount,
        uint256 sharesReceived,
        uint256 totalPoolETH,
        uint256 totalSupply
    );

    /**
     * @notice Emitted when a user withdraws from the pool
     * @param user Address of the withdrawer
     * @param shares Amount of LP tokens burned
     * @param ethAmount Amount of ETH withdrawn
     * @param totalPoolValue Total value of pool after withdrawal
     * @param remainingPoolBalance Remaining ETH balance in pool
     */
    event Withdrawn(
        address indexed user,
        uint256 shares,
        uint256 ethAmount,
        uint256 totalPoolValue,
        uint256 remainingPoolBalance
    );

    event ParameterUpdateProposed(
    string indexed parameterName,
    uint256 newValue,
    uint256 executeTime,
    address indexed proposer
    );

    event ParameterUpdated(
        string indexed parameterName,
        uint256 oldValue,
        uint256 newValue,
        uint256 timestamp,
        address indexed executor
    );

    event ParameterUpdateCancelled(
        string indexed parameterName,
        uint256 proposedValue,
        address indexed canceller,
        uint256 timestamp
    );

        /// @notice Emitted when a swap is successfully executed
    event SwapExecuted(
        string spendTokenCode,
        string receiveTokenCode,
        uint256 amountIn,
        uint256 amountReceived
    );

    /// @notice Emitted when a swap fails
    event SwapFailed(
        string spendTokenCode,
        string receiveTokenCode,
        uint256 amountIn,
        string reason
    );

        // Events for emergency withdrawal tracking
    event EmergencyWithdrawal(
        string tokenCode,
        uint256 amount,
        address indexed recipient
    );

    event EmergencyWithdrawalFailed(
        string tokenCode,
        uint256 amount,
        string reason
    );

    event EmergencyWithdrawalComplete(
        uint256 totalAssetsWithdrawn,
        bool allSuccessful
    );

    address public immutable WETH_ADDRESS;
        /**
         * @dev Contract constructor
         * @notice Initializes the contract with LP token name and symbol
         */
    constructor(address _wethAddress) ERC20("LP Token", "LPT") Ownable() {
        require(_wethAddress != address(0), "Invalid WETH address");
        WETH_ADDRESS = _wethAddress;
        lastHourlyReset = block.timestamp;
    }


    /**
     * @dev Modifier to check if contract is not paused
     */
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    /**
     * @dev Modifier to validate token existence and active status
     * @param _tokenCode The token code to validate
     */
    modifier validToken(string memory _tokenCode) {
        require(tokenData[_tokenCode].isActive, "Token not found or inactive");
        _;
    }

    /**
     * @dev Modifier to check withdrawal limits
     * @param amount Amount being withdrawn
     */
    modifier withinLimits(uint256 amount) {
        if (block.timestamp >= lastHourlyReset + 1 hours) {
            hourlyWithdrawnAmount = 0;
            lastHourlyReset = block.timestamp;
        }
        require(hourlyWithdrawnAmount + amount <= withdrawLimitPerHour, "Exceeds hourly limit");
        _;
    }

    /**
     * @notice Allows users to deposit ETH and receive LP tokens
     * @dev Implements 1:1 ratio between ETH and LP tokens
     * @dev Includes comprehensive validation checks
     */
    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value >= minDeposit, "Below minimum deposit");
        require(msg.value <= maxDeposit, "Exceeds maximum deposit");
        
        uint256 preDepositBalance = IWETH(WETH_ADDRESS).balanceOf(address(this));
        uint256 preDepositSupply = totalSupply();
        
        uint256 shares = msg.value;
        require(shares > 0, "No shares to mint");

    // Wrap ETH to WETH
    IWETH(WETH_ADDRESS).deposit{value: msg.value}();


        if (preDepositSupply > 0) {
            require(
                (shares * preDepositSupply) / (preDepositBalance + msg.value) > 0,
                "Share calculation error"
            );
        }

        _mint(msg.sender, shares);

        require(
            totalSupply() == preDepositSupply + shares,
            "Invalid supply change"
        );
    require(
        IWETH(WETH_ADDRESS).balanceOf(address(this)) == preDepositBalance + msg.value,
        "Invalid WETH balance change"
    );

        emit Deposit(
            msg.sender,
            msg.value,
            shares,
            IWETH(WETH_ADDRESS).balanceOf(address(this)),
            totalSupply()
        );
    }

    /**
     * @notice Allows users to withdraw ETH by burning LP tokens
     * @dev Implements slippage protection and reserve ratio checks
     * @param _shares Amount of LP tokens to burn
     * @param _minWethAmount Minimum ETH amount expected to receive
     * @return ethAmount The amount of ETH withdrawn
     */
function withdraw(uint256 _shares, uint256 _minWethAmount) external 
    nonReentrant 
    whenNotPaused 
    withinLimits(_shares) 
    returns (uint256 ethAmount) 
{
    require(_shares > 0, "Cannot withdraw zero shares");
    require(_shares <= balanceOf(msg.sender), "Insufficient LP token balance");
    require(_shares <= maxWithdrawPerTx, "Exceeds maximum withdrawal size");

    WithdrawValidation memory validation;
    validation.totalSupply = totalSupply();
    validation.preWithdrawBalance = IWETH(WETH_ADDRESS).balanceOf(address(this));
    validation.ethAmount = (_shares * validation.preWithdrawBalance) / validation.totalSupply;

    // Get total pool value first
    try this.getTotalPoolValue() returns (uint256 totalValue) {
        validation.totalValue = totalValue;
        validation.pricesValid = true;
    } catch {
        revert("Price feed error");
    }

    // Calculate proportional WETH amount
    validation.ethAmount = (_shares * validation.totalValue) / validation.totalSupply;
    
    // Validate minimum withdrawal and slippage
    require(validation.ethAmount >= minWithdraw, "Below minimum withdrawal");
    require(validation.ethAmount >= _minWethAmount, "Excessive slippage");
    
    uint256 expectedMinAmount = (validation.ethAmount * (10000 - maxSlippage)) / 10000;
    require(_minWethAmount >= expectedMinAmount, "Slippage tolerance too high");

    // Check pool reserves
    validation.poolEthBalance = IWETH(WETH_ADDRESS).balanceOf(address(this));
    
    // Combine reserve ratio checks to save gas
    uint256 currentReserveRatio = (validation.poolEthBalance * 10000) / validation.totalValue;
    uint256 postWithdrawRatio = ((validation.poolEthBalance - validation.ethAmount) * 10000) / 
                               (validation.totalValue - validation.ethAmount);
    require(currentReserveRatio >= poolReserveRatio, "Insufficient pool reserves");
    require(postWithdrawRatio >= poolReserveRatio, "Would break reserve ratio");

    // Update state
    hourlyWithdrawnAmount += validation.ethAmount;
    _burn(msg.sender, _shares);

    // Transfer wETH
    require(
        IWETH(WETH_ADDRESS).transfer(msg.sender, validation.ethAmount),
        "WETH transfer failed"
    );

    // Validate final state
    require(
        IWETH(WETH_ADDRESS).balanceOf(address(this)) == validation.preWithdrawBalance - validation.ethAmount,
        "Invalid balance change"
    );
    require(
        totalSupply() == validation.totalSupply - _shares,
        "Invalid supply change"
    );

    emit Withdrawn(
        msg.sender, 
        _shares, 
        validation.ethAmount,
        validation.totalValue,
        IWETH(WETH_ADDRESS).balanceOf(address(this))
    );

    return validation.ethAmount;
}


/**
 * @notice Adds or updates a token in the pool
 * @dev Only callable by owner
 * @param _tokenCode Unique identifier for the token
 * @param _tokenAddress Address of the ERC20 token contract
 * @param _priceFeed Address of the Chainlink price feed
 * @param _tokenDecimals Number of decimals for the token
 * @param _priceFeedDecimals Number of decimals in price feed
 * @param _heartbeat Maximum time between price updates
 */
function manageTokenData(
    string memory _tokenCode,
    address _tokenAddress,
    address _priceFeed,
    uint8 _tokenDecimals,
    uint8 _priceFeedDecimals,
    uint256 _heartbeat
) external onlyOwner {
    require(_tokenAddress != address(0), "Invalid token address");
    require(_priceFeed != address(0), "Invalid price feed address");
    require(bytes(_tokenCode).length > 0, "Invalid token code");
    require(_heartbeat > 0, "Invalid heartbeat");
    require(_tokenAddress != WETH_ADDRESS, "Cannot add WETH as token");    

    if (!tokenData[_tokenCode].isActive) {
        require(tokenCodesCount < maxTokensPerOperation, "Too many tokens");
        tokenCodes.push(_tokenCode);
        tokenCodesCount++; // Increment counter when adding new token
    }

    tokenData[_tokenCode] = TokenInfo({
        tokenAddress: _tokenAddress,
        tokenDecimals: _tokenDecimals,
        tokenCode: _tokenCode,
        priceFeed: _priceFeed,
        priceFeedDecimals: _priceFeedDecimals,
        isActive: true,
        lastPriceTimestamp: 0,
        lastPrice: 0,
        heartbeat: _heartbeat
    });

    emit TokenAdded(_tokenCode, _tokenAddress, _priceFeed);
}
    /**
     * @notice Removes a token from the pool
     * @dev Only callable by owner
     * @param _tokenCode The token code to remove
     */
    function removeToken(string memory _tokenCode) external onlyOwner validToken(_tokenCode) {
        tokenData[_tokenCode].isActive = false;
        
        for (uint i = 0; i < tokenCodes.length; i++) {
            if (keccak256(bytes(tokenCodes[i])) == keccak256(bytes(_tokenCode))) {
                tokenCodes[i] = tokenCodes[tokenCodes.length - 1];
                tokenCodes.pop();
                break;
            }
        }

        emit TokenRemoved(_tokenCode);
    }

    /**
     * @dev Sets the address of the SimpleSwap contract
     * @param _simpleSwapAddress Address of the SimpleSwap contract
     */
    function setSimpleSwapAddress(address _simpleSwapAddress) external onlyOwner {
        require(_simpleSwapAddress != address(0), "Invalid address");
        simpleSwapAddress = _simpleSwapAddress;
    }

    /**
     * @dev Performs a token swap using SimpleSwap protocol
     * @param spendTokenCode Code of the token to spend
     * @param receiveTokenCode Code of the token to receive
     * @param amountIn Amount of tokens to spend
     * @return amountReceived Amount of tokens received
     */
    function performSwap(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) 
        external
        nonReentrant
        whenNotPaused
        validToken(spendTokenCode)
        validToken(receiveTokenCode)
        returns (uint256 amountReceived)
    {
        require(simpleSwapAddress != address(0), "SimpleSwap address not set");
        require(amountIn > 0, "Amount must be greater than 0");
        
        // Get token addresses from our token data
        address spendToken = tokenData[spendTokenCode].tokenAddress;
        address receiveToken = tokenData[receiveTokenCode].tokenAddress;
        
        require(spendToken != address(0) && receiveToken != address(0), "Invalid tokens");
        require(spendToken != receiveToken, "Cannot swap same token");

    // Add WETH balance check if spending WETH
    if (spendToken == WETH_ADDRESS) {
        require(
            IWETH(WETH_ADDRESS).balanceOf(address(this)) >= amountIn,
            "Insufficient WETH balance"
        );
    }

        // First approve the SimpleSwap contract to spend tokens
        IERC20Approval(spendToken).approve(simpleSwapAddress, 0); // Reset approval first
        IERC20Approval(spendToken).approve(simpleSwapAddress, amountIn);

    // Store initial balance if receiving WETH
    uint256 initialWethBalance = 0;
    if (receiveToken == WETH_ADDRESS) {
        initialWethBalance = IWETH(WETH_ADDRESS).balanceOf(address(this));
    }

    // Perform the swap
    try ISimpleSwap(simpleSwapAddress).inputSwap(
        spendToken,
        receiveToken,
        amountIn
        ) returns (uint256 received) {
            // Verify received amount if it's WETH
            if (receiveToken == WETH_ADDRESS) {
                uint256 actualReceived = IWETH(WETH_ADDRESS).balanceOf(address(this)) - initialWethBalance;
                require(actualReceived >= received, "WETH amount mismatch");
            }

            amountReceived = received;
            emit SwapExecuted(spendTokenCode, receiveTokenCode, amountIn, received);
            return received;
        } catch Error(string memory reason) {
            emit SwapFailed(spendTokenCode, receiveTokenCode, amountIn, reason);
            revert(reason);
    }
    }


    /**
     * @notice Updates the heartbeat duration for a token's price feed
     * @dev Only callable by owner
     * @param _tokenCode The token to update
     * @param _newHeartbeat New maximum time between price updates
     */
    function updateHeartbeat(string memory _tokenCode, uint256 _newHeartbeat) 
        external 
        onlyOwner 
        validToken(_tokenCode) 
    {
        require(_newHeartbeat > 0, "Invalid heartbeat");
        tokenData[_tokenCode].heartbeat = _newHeartbeat;
        emit HeartbeatUpdated(_tokenCode, _newHeartbeat);
    }

    /**
     * @notice Gets the latest price for a token from Chainlink without events
     * @dev Pure price check functionality
     * @param _tokenCode The token to get the price for
     * @return price The current price
     * @return updatedAt The timestamp of the price
     * @return isStale Whether the price is considered stale
     */
    function getTokenPrice(string memory _tokenCode) 
        public 
        view 
        validToken(_tokenCode) 
        returns (uint256 price, uint256 updatedAt, bool isStale) 
    {
        TokenInfo memory token = tokenData[_tokenCode];
        
        AggregatorV3Interface priceFeed = AggregatorV3Interface(token.priceFeed);
        (
            uint80 roundId,
            int256 rawPrice,
            ,
            uint256 timestamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        
        require(rawPrice > 0, "Invalid price");
        require(timestamp > 0, "Round not complete");
        require(answeredInRound >= roundId, "Stale price");
        
        return (
            uint256(rawPrice), 
            timestamp,
            (block.timestamp - timestamp > token.heartbeat)
        );
    }

    /**
     * @notice Gets the latest price and emits events if needed
     * @param _tokenCode The token to get the price for
     * @return price The current price
     * @return updatedAt The timestamp of the price
     */
    function getTokenPriceWithEvents(string memory _tokenCode) 
        public 
        validToken(_tokenCode) 
        returns (uint256 price, uint256 updatedAt) 
    {
        uint256 priceResult;
        uint256 updatedAtResult;
        bool isStale;
        
        (priceResult, updatedAtResult, isStale) = getTokenPrice(_tokenCode);

    if (!isStale) {  // Notice the ! operator
        // Update the token data fields only if price is fresh
        tokenData[_tokenCode].lastPrice = priceResult;
        tokenData[_tokenCode].lastPriceTimestamp = updatedAtResult;
    } else {
        emit PriceStale(_tokenCode, updatedAtResult);
    }

        return (priceResult, updatedAtResult);
    }


    /**
     * @notice Gets the cached value of a token if available
     * @param _tokenCode The token to check
     * @return value The cached value
     * @return isValid Whether the cache is valid
     * @dev Uses block.timestamp for cache validation
     */
    function getCachedTokenValue(string memory _tokenCode) 
        public 
        view 
        returns (uint256 value, bool isValid) 
    {
        TokenValueCache memory cache = tokenValueCache[_tokenCode];
        uint256 currentTime = block.timestamp;  // Get current block timestamp
        
        if (cache.isValid && currentTime - cache.timestamp <= cacheDuration) {
            return (cache.value, true);
        }
        return (0, false);
    }

    /**
     * @notice Calculates the current value of a token holding
     * @dev Uses cache if available and valid
     * @param _tokenCode The token to calculate value for
     * @return The current value in ETH terms
     */
    function calculateTokenValue(string memory _tokenCode) 
        public 
        validToken(_tokenCode) 
        returns (uint256) 
    {
        // Check cache first
        (uint256 cachedValue, bool isCacheValid) = getCachedTokenValue(_tokenCode);
        if (isCacheValid) {
            return cachedValue;
        }

        try this.getTokenPriceWithEvents(_tokenCode) returns (uint256 price, uint256 timestamp) {
            uint256 currentTime = block.timestamp;
            if (currentTime - timestamp <= maxPriceAge) {
                uint256 tokenBalance = IERC20(tokenData[_tokenCode].tokenAddress).balanceOf(address(this));
                uint256 value = (tokenBalance * price) / (10 ** tokenData[_tokenCode].priceFeedDecimals);
                
                // Update cache
                tokenValueCache[_tokenCode] = TokenValueCache({
                    value: value,
                    timestamp: currentTime,
                    isValid: true
                });
                
                emit CacheUpdated(_tokenCode, value);
                return value;
            }
        } catch {
            tokenErrors[_tokenCode]++;
            if (tokenErrors[_tokenCode] >= maxErrors) {
                emit ErrorThresholdReached(_tokenCode);
            }
            emit TokenError(_tokenCode, "Price feed error");
        }
        
        revert("Value calculation failed");
    }

    /**
     * @notice Calculates the total value of all assets in the pool
     * @return The total pool value in ETH terms
     */
    function getTotalPoolValue() external returns (uint256) {
        uint256 totalValue = IWETH(WETH_ADDRESS).balanceOf(address(this));
        
        for (uint i = 0; i < tokenCodes.length; i++) {
            if (tokenData[tokenCodes[i]].isActive) {
                totalValue += calculateTokenValue(tokenCodes[i]);
            }
        }
        
        emit PoolValueUpdated(totalValue);
        return totalValue;
    }

    /**
     * @notice Invalidates the cache for a specific token
     * @dev Only callable by owner
     * @param _tokenCode The token whose cache to invalidate
     */
    function invalidateCache(string memory _tokenCode) external onlyOwner validToken(_tokenCode) {
        delete tokenValueCache[_tokenCode];
        emit CacheCleared(_tokenCode);
    }

    /**
     * @notice Pauses all deposit and withdrawal operations
     * @dev Only callable by owner
     */
    function pause() external onlyOwner {
        paused = true;
    }

    /**
     * @notice Resumes all deposit and withdrawal operations
     * @dev Only callable by owner
     */
    function unpause() external onlyOwner {
        paused = false;
    }

/**
 * @notice Proposes a parameter update that can be executed after timelock period
 * @param parameterName Name of the parameter to update
 * @param newValue New value for the parameter
 */
function proposeParameterUpdate(string calldata parameterName, uint256 newValue) external onlyOwner {
    require(newValue > 0, "Invalid value");
    bytes32 updateId = keccak256(abi.encodePacked(parameterName, newValue));
    
    // Ensure there's no existing pending update for this parameter
    require(!pendingUpdates[updateId].exists, "Update already pending");
    
    // Validate parameter name and value
    require(isValidParameter(parameterName, newValue), "Invalid parameter or value");
    
    pendingUpdates[updateId] = PendingUpdate({
        parameterName: parameterName,
        newValue: newValue,
        executeTime: block.timestamp + TIMELOCK_DURATION,
        exists: true,
        proposer: msg.sender
    });
    
    emit ParameterUpdateProposed(parameterName, newValue, block.timestamp + TIMELOCK_DURATION, msg.sender);
}

/**
 * @notice Cancels a pending parameter update
 * @param parameterName Name of the parameter whose update is to be cancelled
 * @param newValue The proposed value to cancel
 */
function cancelParameterUpdate(string calldata parameterName, uint256 newValue) external onlyOwner {
    bytes32 updateId = keccak256(abi.encodePacked(parameterName, newValue));
    PendingUpdate memory update = pendingUpdates[updateId];
    
    require(update.exists, "No such pending update");
    require(block.timestamp < update.executeTime, "Update already executable");
    
    emit ParameterUpdateCancelled(
        parameterName,
        newValue,
        msg.sender,
        block.timestamp
    );
    
    delete pendingUpdates[updateId];
}

/**
 * @notice Executes a pending parameter update after timelock period
 * @param parameterName Name of the parameter to update
 * @param newValue New value for the parameter
 */
function executeParameterUpdate(string calldata parameterName, uint256 newValue) external onlyOwner {
    bytes32 updateId = keccak256(abi.encodePacked(parameterName, newValue));
    PendingUpdate memory update = pendingUpdates[updateId];
    
    require(update.exists, "No such pending update");
    require(block.timestamp >= update.executeTime, "Timelock not expired");
    
    uint256 oldValue = getCurrentParameterValue(parameterName);
    updateParameter(parameterName, newValue);
    
    emit ParameterUpdated(
        parameterName,
        oldValue,
        newValue,
        block.timestamp,
        msg.sender
    );
    
    delete pendingUpdates[updateId];
}

/**
 * @notice Returns all details about a pending parameter update
 * @param parameterName Name of the parameter
 * @param newValue Proposed new value
 */
function getPendingUpdate(string calldata parameterName, uint256 newValue) 
    external 
    view 
    returns (
        bool exists,
        uint256 executeTime,
        address proposer,
        uint256 timeRemaining
    ) 
{
    bytes32 updateId = keccak256(abi.encodePacked(parameterName, newValue));
    PendingUpdate memory update = pendingUpdates[updateId];
    
    if (update.exists && block.timestamp < update.executeTime) {
        timeRemaining = update.executeTime - block.timestamp;
    }
    
    return (
        update.exists,
        update.executeTime,
        update.proposer,
        timeRemaining
    );
}

/**
 * @notice Validates parameter name and value
 * @param parameterName Name of the parameter
 * @param newValue Proposed new value
 */
function isValidParameter(string calldata parameterName, uint256 newValue) internal pure returns (bool) {
    bytes32 paramHash = keccak256(bytes(parameterName));
    
    if (paramHash == keccak256(bytes("maxDeposit"))) {
        return newValue >= 1 ether;
    }
    else if (paramHash == keccak256(bytes("maxWithdrawPerTx"))) {
        return newValue >= 0.1 ether;
    }
    else if (paramHash == keccak256(bytes("minDeposit"))) {
        return newValue <= 1 ether;
    }
    else if (paramHash == keccak256(bytes("minWithdraw"))) {
        return newValue <= 1 ether;
    }
    else if (paramHash == keccak256(bytes("maxSlippage"))) {
        return newValue <= 1000; // Max 10%
    }
    else if (paramHash == keccak256(bytes("poolReserveRatio"))) {
        return newValue <= 5000; // Max 50%
    }
    else if (paramHash == keccak256(bytes("cacheDuration"))) {
        return newValue <= 1 hours;
    }
    else if (paramHash == keccak256(bytes("maxPriceAge"))) {
        return newValue <= 48 hours;
    }
    else if (paramHash == keccak256(bytes("maxTokensPerOperation"))) {
        return newValue <= 20;
    }
    else if (paramHash == keccak256(bytes("maxErrors"))) {
        return newValue <= 10;
    }
    else if (paramHash == keccak256(bytes("withdrawLimitPerHour"))) {
        return newValue >= 1 ether;
    }
    
    return false;
}

/**
 * @notice Gets the current value of a parameter
 * @param parameterName Name of the parameter
 */
function getCurrentParameterValue(string calldata parameterName) internal view returns (uint256) {
    bytes32 paramHash = keccak256(bytes(parameterName));
    
    if (paramHash == keccak256(bytes("maxDeposit"))) return maxDeposit;
    if (paramHash == keccak256(bytes("maxWithdrawPerTx"))) return maxWithdrawPerTx;
    if (paramHash == keccak256(bytes("minDeposit"))) return minDeposit;
    if (paramHash == keccak256(bytes("minWithdraw"))) return minWithdraw;
    if (paramHash == keccak256(bytes("maxSlippage"))) return maxSlippage;
    if (paramHash == keccak256(bytes("poolReserveRatio"))) return poolReserveRatio;
    if (paramHash == keccak256(bytes("cacheDuration"))) return cacheDuration;
    if (paramHash == keccak256(bytes("maxPriceAge"))) return maxPriceAge;
    if (paramHash == keccak256(bytes("maxTokensPerOperation"))) return maxTokensPerOperation;
    if (paramHash == keccak256(bytes("maxErrors"))) return maxErrors;
    if (paramHash == keccak256(bytes("withdrawLimitPerHour"))) return withdrawLimitPerHour;
    
    revert("Invalid parameter name");
}

/**
 * @notice Updates a parameter value
 * @param parameterName Name of the parameter
 * @param newValue New value for the parameter
 */
function updateParameter(string calldata parameterName, uint256 newValue) internal {
    bytes32 paramHash = keccak256(bytes(parameterName));
    
    if (paramHash == keccak256(bytes("maxDeposit"))) maxDeposit = newValue;
    else if (paramHash == keccak256(bytes("maxWithdrawPerTx"))) maxWithdrawPerTx = newValue;
    else if (paramHash == keccak256(bytes("minDeposit"))) minDeposit = newValue;
    else if (paramHash == keccak256(bytes("minWithdraw"))) minWithdraw = newValue;
    else if (paramHash == keccak256(bytes("maxSlippage"))) maxSlippage = newValue;
    else if (paramHash == keccak256(bytes("poolReserveRatio"))) poolReserveRatio = newValue;
    else if (paramHash == keccak256(bytes("cacheDuration"))) cacheDuration = newValue;
    else if (paramHash == keccak256(bytes("maxPriceAge"))) maxPriceAge = newValue;
    else if (paramHash == keccak256(bytes("maxTokensPerOperation"))) maxTokensPerOperation = newValue;
    else if (paramHash == keccak256(bytes("maxErrors"))) maxErrors = newValue;
    else if (paramHash == keccak256(bytes("withdrawLimitPerHour"))) withdrawLimitPerHour = newValue;
    else revert("Invalid parameter name");
}

    /**
     * @notice Gets the number of tokens managed by the pool
     * @return The number of tokens in the pool
     */
    function getTokenCount() external view returns (uint256) {
        return tokenCodes.length;
    }

    /**
     * @notice Gets a list of all active tokens in the pool
     * @return Array of active token codes
     */
    function getActiveTokens() external view returns (string[] memory) {
        uint256 activeCount = 0;
        for (uint i = 0; i < tokenCodes.length; i++) {
            if (tokenData[tokenCodes[i]].isActive) {
                activeCount++;
            }
        }
        
        string[] memory activeTokens = new string[](activeCount);
        uint256 index = 0;
        for (uint i = 0; i < tokenCodes.length; i++) {
            if (tokenData[tokenCodes[i]].isActive) {
                activeTokens[index] = tokenCodes[i];
                index++;
            }
        }
        return activeTokens;
    }

/**
     * @notice Emergency function to withdraw all assets (WETH and other tokens) from the pool
     * @dev Only callable by owner when contract is paused
     * @return success Boolean indicating if all withdrawals were successful
     */
    function emergencyWithdraw() external onlyOwner returns (bool success) {
        require(paused, "Contract must be paused");
        address owner = owner();
        uint256 totalAssetsWithdrawn = 0;
        bool allWithdrawalsSuccessful = true;

        // First withdraw WETH
        uint256 wethBalance = IWETH(WETH_ADDRESS).balanceOf(address(this));
        if (wethBalance > 0) {
            bool wethTransferSuccess = IWETH(WETH_ADDRESS).transfer(owner, wethBalance);
            if (wethTransferSuccess) {
                totalAssetsWithdrawn += wethBalance;
                emit EmergencyWithdrawal("WETH", wethBalance, owner);
            } else {
                allWithdrawalsSuccessful = false;
                emit EmergencyWithdrawalFailed("WETH", wethBalance, "Transfer failed");
            }
        }

        // Then withdraw all other tokens
        for (uint i = 0; i < tokenCodes.length; i++) {
            TokenInfo memory token = tokenData[tokenCodes[i]];
            
            if (token.isActive && token.tokenAddress != WETH_ADDRESS) {
                uint256 tokenBalance = IERC20(token.tokenAddress).balanceOf(address(this));
                
                if (tokenBalance > 0) {
                    try IERC20(token.tokenAddress).transfer(owner, tokenBalance) returns (bool transferred) {
                        if (transferred) {
                            totalAssetsWithdrawn++;
                            emit EmergencyWithdrawal(token.tokenCode, tokenBalance, owner);
                        } else {
                            allWithdrawalsSuccessful = false;
                            emit EmergencyWithdrawalFailed(token.tokenCode, tokenBalance, "Transfer returned false");
                        }
                    } catch (bytes memory reason) {
                        allWithdrawalsSuccessful = false;
                        emit EmergencyWithdrawalFailed(token.tokenCode, tokenBalance, string(reason));
                    }
                }
            }
        }

        emit EmergencyWithdrawalComplete(
            totalAssetsWithdrawn,
            allWithdrawalsSuccessful
        );

        return allWithdrawalsSuccessful;
    }

/**
     * @notice Handles direct ETH transfers to the contract
     * @dev Reverts all direct ETH transfers to force usage of deposit() function
     */
    receive() external payable {
        revert("Direct ETH transfers not allowed. Use deposit() function");
    }

    /**
     * @notice Handles fallback calls to the contract
     * @dev Reverts all fallback calls
     */
    fallback() external payable {
        revert("Function does not exist. Use deposit() function");
    }
}
