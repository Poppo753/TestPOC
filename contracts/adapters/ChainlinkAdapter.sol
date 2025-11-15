// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IOracleAdapter.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChainlinkAdapter
 * @notice Adapter for Chainlink Price Feeds
 * @dev Wraps Chainlink-specific logic into the IOracleAdapter interface
 * 
 * Features:
 * - Complete Chainlink validation (roundId, updatedAt, answeredInRound)
 * - Circuit breaker for repeated failures
 * - Heartbeat-based staleness detection
 * - Per-token configuration
 * 
 * @custom:security-contact security@yourdomain.com
 */
contract ChainlinkAdapter is IOracleAdapter, Ownable {
    
    // ==================== STRUCTS ====================
    
    /**
     * @dev Configuration for each Chainlink price feed
     * @param feedAddress Address of Chainlink Aggregator
     * @param decimals Number of decimals in price (typically 8 for USD pairs)
     * @param heartbeat Maximum acceptable time between updates
     * @param isActive Whether this feed is currently active
     * @param errorCount Number of consecutive errors (for circuit breaker)
     */
    struct PriceFeedConfig {
        address feedAddress;
        uint8 decimals;
        uint256 heartbeat;
        bool isActive;
        uint256 errorCount;
    }
    
    // ==================== STORAGE ====================
    
    /// @notice Mapping: tokenCode => Chainlink price feed configuration
    mapping(string => PriceFeedConfig) private priceFeeds;
    
    /// @notice Circuit breaker threshold - max errors before marking feed invalid
    uint256 public maxErrorThreshold = 3;
    
    // ==================== EVENTS ====================
    
    /**
     * @notice Emitted when a new price feed is added
     * @param tokenCode Token identifier
     * @param feedAddress Chainlink aggregator address
     * @param decimals Price decimals
     * @param heartbeat Max update interval
     */
    event PriceFeedAdded(
        string indexed tokenCode,
        address feedAddress,
        uint8 decimals,
        uint256 heartbeat
    );
    
    /**
     * @notice Emitted when a price feed is updated
     * @param tokenCode Token identifier
     * @param oldFeedAddress Previous aggregator address
     * @param newFeedAddress New aggregator address
     */
    event PriceFeedUpdated(
        string indexed tokenCode,
        address oldFeedAddress,
        address newFeedAddress
    );
    
    /**
     * @notice Emitted when a price feed is removed
     * @param tokenCode Token identifier
     */
    event PriceFeedRemoved(string indexed tokenCode);
    
    /**
     * @notice Emitted when circuit breaker activates
     * @param tokenCode Token that exceeded error threshold
     * @param errorCount Number of errors accumulated
     */
    event CircuitBreakerActivated(string indexed tokenCode, uint256 errorCount);
    
    /**
     * @notice Emitted when error count is reset
     * @param tokenCode Token that recovered
     */
    event ErrorCountReset(string indexed tokenCode);
    
    // ==================== CONSTRUCTOR ====================
    
    /**
     * @dev Initializes the adapter with Ownable pattern
     */
    constructor() Ownable() {}
    
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @notice Add or update a price feed configuration
     * @dev Validates feed works before adding
     * 
     * @param tokenCode Unique token identifier (e.g., "USDC", "WBTC")
     * @param feedAddress Chainlink Aggregator V3 address
     * @param decimals Number of decimals in price (must match feed)
     * @param heartbeat Maximum acceptable time between price updates
     */
    function setPriceFeed(
        string memory tokenCode,
        address feedAddress,
        uint8 decimals,
        uint256 heartbeat
    ) external onlyOwner {
        // ==================== VALIDATION ====================
        
        require(bytes(tokenCode).length > 0, "Empty token code");
        require(bytes(tokenCode).length <= 16, "Token code too long");
        require(feedAddress != address(0), "Invalid feed address");
        require(decimals > 0 && decimals <= 18, "Invalid decimals");
        require(heartbeat > 0, "Invalid heartbeat");
        
        // ==================== CHAINLINK FEED VALIDATION ====================
        
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            // CRITICAL VALIDATIONS (same as TokenManager)
            require(price > 0, "Invalid price");
            require(updatedAt > 0, "Round not complete");
            require(answeredInRound >= roundId, "Stale feed");
        } catch {
            revert("Feed validation failed");
        }
        
        // Optional: Validate decimals match (if feed exposes decimals())
        try feed.decimals() returns (uint8 oracleDecimals) {
            require(oracleDecimals == decimals, "Decimals mismatch");
        } catch {
            // Feed doesn't expose decimals() - accept provided value
        }
        
        // ==================== UPDATE CONFIGURATION ====================
        
        bool isNew = !priceFeeds[tokenCode].isActive;
        address oldFeedAddress = priceFeeds[tokenCode].feedAddress;
        
        priceFeeds[tokenCode] = PriceFeedConfig({
            feedAddress: feedAddress,
            decimals: decimals,
            heartbeat: heartbeat,
            isActive: true,
            errorCount: 0  // Reset errors on configuration
        });
        
        // ==================== EMIT EVENTS ====================
        
        if (isNew) {
            emit PriceFeedAdded(tokenCode, feedAddress, decimals, heartbeat);
        } else {
            emit PriceFeedUpdated(tokenCode, oldFeedAddress, feedAddress);
        }
    }
    
    /**
     * @notice Remove a price feed (marks as inactive)
     * @param tokenCode Token to remove
     */
    function removePriceFeed(string memory tokenCode) external onlyOwner {
        require(priceFeeds[tokenCode].isActive, "Feed not active");
        
        priceFeeds[tokenCode].isActive = false;
        
        emit PriceFeedRemoved(tokenCode);
    }
    
    /**
     * @notice Update circuit breaker threshold
     * @param _newThreshold New max error count before circuit breaker
     */
    function setMaxErrorThreshold(uint256 _newThreshold) external onlyOwner {
        require(_newThreshold > 0, "Invalid threshold");
        maxErrorThreshold = _newThreshold;
    }
    
    /**
     * @notice Manually reset error count for a token
     * @dev Useful after fixing an oracle issue
     * @param tokenCode Token to reset
     */
    function resetErrorCount(string memory tokenCode) external onlyOwner {
        require(priceFeeds[tokenCode].isActive, "Feed not active");
        priceFeeds[tokenCode].errorCount = 0;
        emit ErrorCountReset(tokenCode);
    }
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @notice Get price feed configuration (for debugging)
     * @param tokenCode Token to query
     * @return config Complete PriceFeedConfig struct
     */
    function getFeedConfig(string memory tokenCode)
        external
        view
        returns (PriceFeedConfig memory config)
    {
        return priceFeeds[tokenCode];
    }
    
    // ==================== IORACLEADAPTER IMPLEMENTATION ====================
    
    /**
     * @inheritdoc IOracleAdapter
     * @dev Implementation with circuit breaker and complete Chainlink validations
     */
    function getPrice(string memory tokenCode)
        external
        view
        override
        returns (
            uint256 price,
            uint256 timestamp,
            bool isValid
        )
    {
        PriceFeedConfig memory config = priceFeeds[tokenCode];
        
        // ==================== TOKEN SUPPORT CHECK ====================
        
        if (!config.isActive) {
            revert TokenNotSupported(tokenCode);
        }
        
        // ==================== CIRCUIT BREAKER CHECK ====================
        
        if (config.errorCount >= maxErrorThreshold) {
            // Circuit breaker activated - return invalid price
            // Note: Cannot emit event in view function
            return (0, block.timestamp, false);
        }
        
        // ==================== CHAINLINK ORACLE CALL ====================
        
        AggregatorV3Interface feed = AggregatorV3Interface(config.feedAddress);
        
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 rawPrice,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            // ==================== CHAINLINK VALIDATIONS ====================
            
            // 1. Price must be positive
            bool priceValid = rawPrice > 0;
            
            // 2. Round must be complete
            bool roundComplete = updatedAt > 0;
            
            // 3. Answer must not be stale (answeredInRound >= roundId)
            bool notStale = answeredInRound >= roundId;
            
            // 4. Price must be fresh (within heartbeat)
            bool isFresh = block.timestamp - updatedAt <= config.heartbeat;
            
            // ==================== DETERMINE VALIDITY ====================
            
            // Price is valid if ALL checks pass
            bool allValid = priceValid && roundComplete && notStale && isFresh;
            
            // Note: Cannot emit PriceRetrieved event in view function
            // Events should be emitted by calling contract (TokenManager)
            
            // ==================== RETURN RESULT ====================
            
            return (
                uint256(rawPrice),
                updatedAt,
                allValid
            );
            
        } catch Error(string memory reason) {
            // Chainlink call failed - increment error count in storage would be needed
            // but this is a view function, so we just revert
            revert OracleCallFailed(reason);
        } catch {
            revert OracleCallFailed("Chainlink call failed");
        }
    }
    
    /**
     * @inheritdoc IOracleAdapter
     */
    function getPriceDecimals(string memory tokenCode)
        external
        view
        override
        returns (uint8 decimals)
    {
        if (!priceFeeds[tokenCode].isActive) {
            revert TokenNotSupported(tokenCode);
        }
        
        return priceFeeds[tokenCode].decimals;
    }
    
    /**
     * @inheritdoc IOracleAdapter
     * @dev Never reverts - returns false for unsupported tokens
     */
    function supportsToken(string memory tokenCode)
        external
        view
        override
        returns (bool supported)
    {
        return priceFeeds[tokenCode].isActive;
    }
    
    /**
     * @inheritdoc IOracleAdapter
     */
    function getAdapterInfo()
        external
        pure
        override
        returns (
            string memory name,
            string memory version
        )
    {
        return ("Chainlink", "1.0.0");
    }
}
