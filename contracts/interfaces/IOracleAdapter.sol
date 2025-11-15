// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IOracleAdapter
 * @notice Standard interface for oracle price adapters
 * @dev All oracle implementations (Chainlink, Pyth, Uniswap TWAP, etc.) must conform to this interface
 * 
 * Interface Design Principles:
 * 1. Backward compatible with TokenManager.getTokenPrice()
 * 2. Simple and minimal - no unnecessary complexity
 * 3. View functions only - no state changes
 * 4. Clear error handling through return values
 * 
 * @custom:security-considerations
 * - Always validate price > 0 before using
 * - Check timestamp freshness against heartbeat
 * - Handle reverts gracefully with try/catch
 * - Never trust external oracle data without validation
 */
interface IOracleAdapter {
    
    // ==================== ERRORS ====================
    
    /**
     * @notice Thrown when token is not supported by this adapter
     * @param tokenCode The token code that is not supported
     */
    error TokenNotSupported(string tokenCode);
    
    /**
     * @notice Thrown when price is invalid (zero or negative)
     */
    error InvalidPrice();
    
    /**
     * @notice Thrown when price is too old (exceeds heartbeat)
     * @param timestamp Price timestamp
     * @param maxAge Maximum allowed age
     */
    error StalePrice(uint256 timestamp, uint256 maxAge);
    
    /**
     * @notice Thrown when oracle call fails
     * @param reason Failure reason
     */
    error OracleCallFailed(string reason);
    
    // ==================== EVENTS ====================
    
    /**
     * @notice Emitted when price is successfully retrieved
     * @param tokenCode Token identifier
     * @param price Retrieved price
     * @param timestamp Price update timestamp
     * @param isValid Whether price is considered valid
     */
    event PriceRetrieved(
        string indexed tokenCode,
        uint256 price,
        uint256 timestamp,
        bool isValid
    );
    
    // ==================== CORE FUNCTIONS ====================
    
    /**
     * @notice Get current price for a token
     * @dev This is the PRIMARY function used by TokenManager
     * 
     * Requirements:
     * - MUST revert with TokenNotSupported if token not configured
     * - MUST return price > 0 if isValid = true
     * - MUST return current block.timestamp or earlier for timestamp
     * - MUST validate price before returning (provider-specific checks)
     * - MUST emit PriceRetrieved event
     * 
     * Behavior:
     * - If price is fresh and valid: returns (price, timestamp, true)
     * - If price is stale but exists: returns (price, timestamp, false)
     * - If token not supported: reverts with TokenNotSupported
     * - If oracle call fails: reverts with OracleCallFailed
     * 
     * Example Usage:
     * ```solidity
     * (uint256 price, uint256 timestamp, bool isValid) = adapter.getPrice("USDC");
     * require(isValid, "Price is stale");
     * require(price > 0, "Invalid price");
     * ```
     * 
     * @param tokenCode Unique token identifier (e.g., "USDC", "WBTC", "WETH")
     * @return price Current price in adapter's native decimals
     * @return timestamp Unix timestamp of last price update
     * @return isValid True if price passed all validations and is fresh
     */
    function getPrice(string memory tokenCode)
        external
        view
        returns (
            uint256 price,
            uint256 timestamp,
            bool isValid
        );
    
    /**
     * @notice Get decimals used by price feed
     * @dev CRITICAL: Used for price normalization in calculations
     * 
     * Requirements:
     * - MUST return consistent value for same token
     * - MUST be between 0 and 18 (inclusive)
     * - MUST revert with TokenNotSupported if token not configured
     * 
     * Common Decimals by Provider:
     * - Chainlink USD pairs: 8 decimals (e.g., $2000.00 = 200000000000)
     * - Chainlink ETH pairs: 18 decimals
     * - Pyth: Variable (check per feed)
     * - Uniswap TWAP: Typically 18 decimals
     * 
     * Example:
     * ```solidity
     * uint8 decimals = adapter.getPriceDecimals("USDC");
     * // If decimals = 8, price = 200000000000 means $2000.00
     * uint256 normalizedPrice = price / (10 ** decimals);
     * ```
     * 
     * @param tokenCode Token identifier
     * @return decimals Number of decimals in price value
     */
    function getPriceDecimals(string memory tokenCode)
        external
        view
        returns (uint8 decimals);
    
    /**
     * @notice Check if adapter supports a specific token
     * @dev Use this to avoid reverts before calling getPrice()
     * 
     * Requirements:
     * - MUST NOT revert (returns false for unsupported tokens)
     * - MUST return true only if token is properly configured
     * - MUST be gas-efficient (simple mapping lookup)
     * 
     * Usage Pattern:
     * ```solidity
     * if (adapter.supportsToken("USDC")) {
     *     (uint256 price,,) = adapter.getPrice("USDC");
     * } else {
     *     // Handle unsupported token
     * }
     * ```
     * 
     * @param tokenCode Token to check
     * @return supported True if token is configured in this adapter
     */
    function supportsToken(string memory tokenCode)
        external
        view
        returns (bool supported);
    
    /**
     * @notice Get adapter metadata for identification
     * @dev Useful for logging, debugging, and UI display
     * 
     * Requirements:
     * - MUST return non-empty strings
     * - Version SHOULD follow semantic versioning (e.g., "1.0.0")
     * - Name SHOULD be human-readable (e.g., "Chainlink", "Pyth")
     * 
     * Examples:
     * - ChainlinkAdapter: ("Chainlink", "1.0.0")
     * - PythAdapter: ("Pyth Network", "1.0.0")
     * - CompositeAdapter: ("Composite Multi-Oracle", "1.0.0")
     * - UniswapTWAPAdapter: ("Uniswap V3 TWAP", "1.0.0")
     * 
     * Usage:
     * ```solidity
     * (string memory name, string memory version) = adapter.getAdapterInfo();
     * console.log("Using oracle:", name, "version:", version);
     * ```
     * 
     * @return name Human-readable adapter name
     * @return version Semantic version string
     */
    function getAdapterInfo()
        external
        view
        returns (
            string memory name,
            string memory version
        );
}
