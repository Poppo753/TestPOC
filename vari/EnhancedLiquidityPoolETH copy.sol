// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title EnhancedLiquidityPoolETH
 * @dev A liquidity pool contract that handles ETH and ERC20 tokens with price feed integration
 * @notice This contract allows users to deposit ETH and receive LP tokens at a 1:1 ratio
 * @custom:security-contact security@yourdomain.com
 */
contract EnhancedLiquidityPoolETH is ERC20, ReentrancyGuard, Ownable {
    // Constants
    /// @notice Maximum amount of ETH that can be deposited in a single transaction
    uint256 public constant MAX_DEPOSIT = 100 ether;
    
    /// @notice Maximum amount of ETH that can be withdrawn in a single transaction
    uint256 public constant MAX_WITHDRAW_PER_TX = 50 ether;
    
    /// @notice Minimum amount of ETH that can be deposited or withdrawn
    uint256 public constant MIN_DEPOSIT = 0.000001 ether;
    uint256 public constant MIN_WITHDRAW = 0.000001 ether;
    
    /// @notice Maximum slippage allowed for withdrawals (200 = 2%)
    uint256 public constant MAX_SLIPPAGE = 200;
    
    /// @notice Minimum reserve ratio the pool must maintain (1000 = 10%)
    uint256 public constant POOL_RESERVE_RATIO = 1000;
    
    /// @notice Duration for which price cache is considered valid
    uint256 public constant CACHE_DURATION = 5 minutes;
    
    /// @notice Maximum age of price feed data before it's considered stale
    uint256 public constant MAX_PRICE_AGE = 24 hours;
    
    /// @notice Maximum number of tokens that can be managed by the pool
    uint256 public constant MAX_TOKENS_PER_OPERATION = 10;
    
    /// @notice Maximum number of errors before triggering alert
    uint256 public constant MAX_ERRORS = 3;
    
    /// @notice Maximum amount that can be withdrawn per hour
    uint256 public withdrawLimitPerHour = 100 ether;

    // Add a counter state variable
    uint256 public tokenCodesCount;


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

    // Storage
    /// @notice Mapping of token codes to their information
    mapping(string => TokenInfo) public tokenData;
    
    /// @notice Mapping of token codes to their cached values
    mapping(string => TokenValueCache) private tokenValueCache;
    
    /// @notice Mapping of token codes to their error counts
    mapping(string => uint256) public tokenErrors;
    
    /// @notice Array of all token codes in the pool
    string[] public tokenCodes;
    
    /// @notice Timestamp of last hourly withdrawal limit reset
    uint256 public lastHourlyReset;
    
    /// @notice Amount withdrawn in current hour
    uint256 public hourlyWithdrawnAmount;
    
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

    /**
     * @dev Contract constructor
     * @notice Initializes the contract with LP token name and symbol
     */
    constructor() ERC20("LP Token", "LPT") Ownable() {
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
        require(msg.value >= MIN_DEPOSIT, "Below minimum deposit");
        require(msg.value <= MAX_DEPOSIT, "Exceeds maximum deposit");
        
        uint256 preDepositBalance = address(this).balance - msg.value;
        uint256 preDepositSupply = totalSupply();
        
        uint256 shares = msg.value;
        require(shares > 0, "No shares to mint");

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
            address(this).balance == preDepositBalance + msg.value,
            "Invalid balance change"
        );

        emit Deposit(
            msg.sender,
            msg.value,
            shares,
            address(this).balance,
            totalSupply()
        );
    }

    /**
     * @notice Allows users to withdraw ETH by burning LP tokens
     * @dev Implements slippage protection and reserve ratio checks
     * @param _shares Amount of LP tokens to burn
     * @param _minEthAmount Minimum ETH amount expected to receive
     * @return ethAmount The amount of ETH withdrawn
     */
    function withdraw(uint256 _shares, uint256 _minEthAmount) external 
        nonReentrant 
        whenNotPaused 
        withinLimits(_shares) 
        returns (uint256 ethAmount) 
    {
        require(_shares > 0, "Cannot withdraw zero shares");
        require(_shares <= balanceOf(msg.sender), "Insufficient LP token balance");
        require(_shares <= MAX_WITHDRAW_PER_TX, "Exceeds maximum withdrawal size");

        WithdrawValidation memory validation;
        validation.preWithdrawBalance = address(this).balance;
        validation.totalSupply = totalSupply();

        try this.getTotalPoolValue() returns (uint256 totalValue) {
            validation.totalValue = totalValue;
            validation.pricesValid = true;
        } catch {
            revert("Price feed error");
        }

        validation.ethAmount = _shares;
        
        require(validation.ethAmount >= MIN_WITHDRAW, "Below minimum withdrawal");
        require(validation.ethAmount >= _minEthAmount, "Excessive slippage");
        
        uint256 expectedMinAmount = (validation.ethAmount * (10000 - MAX_SLIPPAGE)) / 10000;
        require(_minEthAmount >= expectedMinAmount, "Slippage tolerance too high");

        validation.poolEthBalance = address(this).balance;
        require(
            validation.poolEthBalance >= (validation.totalValue * POOL_RESERVE_RATIO) / 10000, 
            "Insufficient pool reserves"
        );

        require(
            validation.poolEthBalance - validation.ethAmount >= 
            ((validation.totalValue - validation.ethAmount) * POOL_RESERVE_RATIO) / 10000,
            "Would break reserve ratio"
        );

        hourlyWithdrawnAmount += validation.ethAmount;

        _burn(msg.sender, _shares);

        (bool success, ) = msg.sender.call{value: validation.ethAmount}("");
        require(success, "ETH transfer failed");

        require(
            address(this).balance == validation.preWithdrawBalance - validation.ethAmount,
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
            address(this).balance
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

    if (!tokenData[_tokenCode].isActive) {
        require(tokenCodesCount < MAX_TOKENS_PER_OPERATION, "Too many tokens");
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
        
        if (cache.isValid && currentTime - cache.timestamp <= CACHE_DURATION) {
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
            if (currentTime - timestamp <= MAX_PRICE_AGE) {
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
            if (tokenErrors[_tokenCode] >= MAX_ERRORS) {
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
        uint256 totalValue = address(this).balance;
        
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
     * @notice Updates the hourly withdrawal limit
     * @dev Only callable by owner
     * @param _newLimit New maximum withdrawal amount per hour
     */
    function setWithdrawLimit(uint256 _newLimit) external onlyOwner {
        require(_newLimit > 0, "Invalid limit");
        withdrawLimitPerHour = _newLimit;
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
     * @notice Emergency function to withdraw all ETH from the pool
     * @dev Only callable by owner when contract is paused
     */
    function emergencyWithdraw() external onlyOwner {
        require(paused, "Contract must be paused");
        payable(owner()).transfer(address(this).balance);
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
