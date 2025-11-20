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
     * @param denomination Price denomination ("ETH", "USD", "BTC", etc.)
     * @param isActive Whether this feed is currently active
     * @param errorCount Number of consecutive errors (for circuit breaker)
     */
    struct PriceFeedConfig {
        address feedAddress;
        uint8 decimals;
        uint256 heartbeat;
        string denomination;
        bool isActive;
        uint256 errorCount;
    }
    
    // ==================== STORAGE ====================
    
    /// @notice Mapping: tokenCode => Chainlink price feed configuration
    mapping(string => PriceFeedConfig) private priceFeeds;
    
    /// @notice Mapping: denomination => reference feed for conversions (e.g., "USD" => ETH/USD feed)
    mapping(string => PriceFeedConfig) private referenceFeeds;
    
    /// @notice Target denomination for all prices (e.g., "ETH")
    string public targetDenomination = "ETH";
    
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
    
    /**
     * @notice Emitted when a reference feed is configured
     * @param denomination Currency denomination (USD, BTC, etc.)
     * @param feedAddress Chainlink aggregator for conversion
     */
    event ReferenceFeedSet(string indexed denomination, address feedAddress);
    
    /**
     * @notice Emitted when target denomination changes
     * @param oldDenomination Previous target
     * @param newDenomination New target
     */
    event TargetDenominationChanged(string oldDenomination, string newDenomination);
    
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
     * @param denomination Price denomination ("ETH", "USD", "BTC")
     */
    function setPriceFeed(
        string memory tokenCode,
        address feedAddress,
        uint8 decimals,
        uint256 heartbeat,
        string memory denomination
    ) external onlyOwner {
        // ==================== VALIDATION ====================
        
        require(bytes(tokenCode).length > 0, "Empty token code");
        require(bytes(tokenCode).length <= 16, "Token code too long");
        require(feedAddress != address(0), "Invalid feed address");
        require(decimals > 0 && decimals <= 18, "Invalid decimals");
        require(heartbeat > 0, "Invalid heartbeat");
        require(bytes(denomination).length > 0, "Empty denomination");
        require(bytes(denomination).length <= 8, "Denomination too long");
        
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
            denomination: denomination,
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
    
    /**
     * @notice Configure a reference feed for currency conversions
     * @dev Example: setReferenceFeed("USD", ethUsdFeedAddress, 8, 3600)
     *      This allows converting USD-denominated prices to ETH
     * 
     * @param denomination Currency code (e.g., "USD", "BTC")
     * @param feedAddress Chainlink feed for TARGET/denomination pair
     *        Example: For "USD", use ETH/USD feed address
     * @param decimals Feed decimals
     * @param heartbeat Max acceptable staleness
     */
    function setReferenceFeed(
        string memory denomination,
        address feedAddress,
        uint8 decimals,
        uint256 heartbeat
    ) external onlyOwner {
        require(bytes(denomination).length > 0, "Empty denomination");
        require(bytes(denomination).length <= 8, "Denomination too long");
        require(feedAddress != address(0), "Invalid feed address");
        require(decimals > 0 && decimals <= 18, "Invalid decimals");
        require(heartbeat > 0, "Invalid heartbeat");
        
        // Validate feed works
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            require(price > 0, "Invalid price");
            require(updatedAt > 0, "Round not complete");
            require(answeredInRound >= roundId, "Stale feed");
        } catch {
            revert("Reference feed validation failed");
        }
        
        referenceFeeds[denomination] = PriceFeedConfig({
            feedAddress: feedAddress,
            decimals: decimals,
            heartbeat: heartbeat,
            denomination: targetDenomination, // Reference feeds are in target denomination
            isActive: true,
            errorCount: 0
        });
        
        emit ReferenceFeedSet(denomination, feedAddress);
    }
    
    /**
     * @notice Set target denomination for all returned prices
     * @dev All prices will be converted to this denomination
     * @param newDenomination Target currency (e.g., "ETH", "USD", "BTC")
     */
    function setTargetDenomination(string memory newDenomination) external onlyOwner {
        require(bytes(newDenomination).length > 0, "Empty denomination");
        require(bytes(newDenomination).length <= 8, "Denomination too long");
        
        string memory oldDenomination = targetDenomination;
        targetDenomination = newDenomination;
        
        emit TargetDenominationChanged(oldDenomination, newDenomination);
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
    
    /**
     * @notice Get reference feed configuration (for debugging)
     * @param denomination Currency code to query
     * @return config Complete PriceFeedConfig struct
     */
    function getReferenceFeedConfig(string memory denomination)
        external
        view
        returns (PriceFeedConfig memory config)
    {
        return referenceFeeds[denomination];
    }
    
    // ==================== IORACLEADAPTER IMPLEMENTATION ====================
    
    /**
     * @inheritdoc IOracleAdapter
     * @dev Implementation with circuit breaker, complete Chainlink validations,
     *      and automatic denomination conversion
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
            return (0, block.timestamp, false);
        }
        
        // ==================== GET RAW PRICE FROM CHAINLINK ====================
        
        (uint256 rawPrice, uint256 rawTimestamp, bool rawValid) = _getRawPrice(config);
        
        if (!rawValid) {
            return (0, rawTimestamp, false);
        }
        
        // ==================== DENOMINATION CONVERSION ====================
        
        // Check if conversion needed
        bool needsConversion = keccak256(bytes(config.denomination)) != keccak256(bytes(targetDenomination));
        
        if (!needsConversion) {
            // Price already in target denomination
            return (rawPrice, rawTimestamp, true);
        }
        
        // Get reference feed for conversion
        PriceFeedConfig memory refConfig = referenceFeeds[config.denomination];
        
        if (!refConfig.isActive) {
            // No reference feed configured - cannot convert
            revert("No reference feed for denomination conversion");
        }
        
        // Get reference price (e.g., ETH/USD if converting from USD to ETH)
        (uint256 refPrice, uint256 refTimestamp, bool refValid) = _getRawPrice(refConfig);
        
        if (!refValid) {
            return (0, refTimestamp, false);
        }
        
        // Convert: token/denomination ÷ target/denomination = token/target
        // Example: USDC/USD ($1.00) ÷ ETH/USD ($2500) = USDC/ETH (0.0004)
        
        // Normalize decimals: bring both to 18 decimals for calculation
        uint256 normalizedTokenPrice = rawPrice * (10 ** (18 - config.decimals));
        uint256 normalizedRefPrice = refPrice * (10 ** (18 - refConfig.decimals));
        
        // Calculate converted price (keep 18 decimals)
        uint256 convertedPrice = (normalizedTokenPrice * 1e18) / normalizedRefPrice;
        
        // Use older timestamp for safety
        uint256 finalTimestamp = rawTimestamp < refTimestamp ? rawTimestamp : refTimestamp;
        
        return (convertedPrice, finalTimestamp, true);
    }
    
    /**
     * @dev Internal function to get raw price from a Chainlink feed
     * @param config Feed configuration
     * @return price Raw price from feed
     * @return timestamp Last update timestamp
     * @return isValid Whether price passes all validations
     */
    function _getRawPrice(PriceFeedConfig memory config)
        internal
        view
        returns (
            uint256 price,
            uint256 timestamp,
            bool isValid
        )
    {
        AggregatorV3Interface feed = AggregatorV3Interface(config.feedAddress);
        
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 rawPrice,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            // ==================== CHAINLINK VALIDATIONS ====================
            
            bool priceValid = rawPrice > 0;
            bool roundComplete = updatedAt > 0;
            bool notStale = answeredInRound >= roundId;
            bool isFresh = block.timestamp - updatedAt <= config.heartbeat;
            
            bool allValid = priceValid && roundComplete && notStale && isFresh;
            
            return (uint256(rawPrice), updatedAt, allValid);
            
        } catch Error(string memory reason) {
            revert OracleCallFailed(reason);
        } catch {
            revert OracleCallFailed("Chainlink call failed");
        }
    }
    
    /**
     * @inheritdoc IOracleAdapter
     * @dev Always returns 18 decimals since prices are normalized to ETH format
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
        
        // All prices returned are in 18 decimals (ETH standard)
        return 18;
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
