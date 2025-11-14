// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ISimpleSwap.sol";

/**
 * @title ISwapPlugin
 * @notice Extended DEX plugin interface with health checks and metadata
 * @dev Extends ISimpleSwap for backward compatibility
 * 
 * DESIGN RATIONALE:
 * - Extends ISimpleSwap (NOT replaces) → existing SimpleSwap contracts work without changes
 * - Adds optional metadata functions → new plugins can implement, old plugins ignore
 * - Backward compatible: SwapManager can cast ISwapPlugin → ISimpleSwap for base calls
 * 
 * USAGE:
 * Old plugin (SimpleSwap deployed):
 *   - Implements ISimpleSwap only
 *   - SwapManager casts to ISimpleSwap
 *   - Works perfectly (backward compatible)
 * 
 * New plugin (CamelotPlugin, OdosPlugin):
 *   - Implements ISwapPlugin (includes ISimpleSwap)
 *   - SwapManager can query metadata (getProtocolInfo, isHealthy)
 *   - Best price selection, health monitoring
 */
interface ISwapPlugin is ISimpleSwap {
    
    // ==================== STRUCTS ====================
    
    /**
     * @notice Protocol metadata for plugin identification
     * @param name Human-readable protocol name (e.g., "Uniswap V3", "Camelot V3")
     * @param version Plugin version (semantic versioning: "1.0.0")
     * @param features Bitmask of supported features (1=BASIC_SWAP, 2=MULTI_HOP, 4=LIMIT_ORDERS, 8=FLASH_SWAP, 16=MEV_PROTECTION, 32=YIELD_TOKENS)
     */
    struct ProtocolInfo {
        string name;
        string version;
        uint256 features;
    }
    
    /**
     * @notice Returns protocol metadata
     * @dev MUST be pure or view, no state changes
     * @return info ProtocolInfo struct with name, version, features
     * 
     * EXAMPLE IMPLEMENTATION:
     * ```solidity
     * function getProtocolInfo() external pure returns (ProtocolInfo memory) {
     *     return ProtocolInfo({
     *         name: "Uniswap V3",
     *         version: "1.0.0",
     *         features: 1 | 2  // BASIC_SWAP | MULTI_HOP
     *     });
     * }
     * ```
     */
    function getProtocolInfo() external pure returns (ProtocolInfo memory info);
    
    /**
     * @notice Checks if plugin supports a specific token pair
     * @dev Used for filtering plugins before quote queries
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return supported True if pair is supported, false otherwise
     * 
     * RATIONALE:
     * - Avoid wasting gas querying plugins that don't support the pair
     * - Pendle plugin: only supports PT/YT tokens
     * - Generic DEX: supports most pairs
     * 
     * EXAMPLE IMPLEMENTATION:
     * ```solidity
     * function supportsTokenPair(address tokenA, address tokenB) 
     *     external view returns (bool) 
     * {
     *     // Check if tokens are whitelisted
     *     return whitelistedTokens[tokenA] && whitelistedTokens[tokenB];
     * }
     * ```
     */
    function supportsTokenPair(address tokenA, address tokenB) 
        external view returns (bool supported);
    
    /**
     * @notice Health check for plugin operability
     * @dev Used for circuit breaker pattern, monitoring
     * @return healthy True if plugin is operational, false if degraded/offline
     * @return reason Human-readable reason if not healthy (empty if healthy)
     * 
     * HEALTH CHECK CRITERIA:
     * - Router contract exists and not paused
     * - Sufficient liquidity available
     * - Oracle price feeds operational (if used)
     * - No recent swap failures (circuit breaker)
     * 
     * EXAMPLE IMPLEMENTATION:
     * ```solidity
     * function isHealthy() external view returns (bool, string memory) {
     *     // Check router exists
     *     if (address(router).code.length == 0) {
     *         return (false, "Router contract not deployed");
     *     }
     *     
     *     // Check not paused
     *     try IUniswapV3Router(router).factory() returns (address factory) {
     *         if (IUniswapV3Factory(factory).paused()) {
     *             return (false, "Protocol paused");
     *         }
     *     } catch {
     *         return (false, "Router call failed");
     *     }
     *     
     *     return (true, "");
     * }
     * ```
     * 
     * USAGE IN SWAPMANAGER:
     * ```solidity
     * (bool healthy, string memory reason) = plugin.isHealthy();
     * if (!healthy) {
     *     emit PluginUnhealthy(pluginName, reason);
     *     continue; // Skip this plugin in best price selection
     * }
     * ```
     */
    function isHealthy() 
        external view returns (bool healthy, string memory reason);
    
    // ==================== EVENTS ====================
    
    /**
     * @notice Emitted when plugin configuration is updated
     * @param configKey Configuration key
     * @param oldValue Old value
     * @param newValue New value
     */
    event ConfigurationUpdated(
        string indexed configKey,
        bytes oldValue,
        bytes newValue
    );
    
    /**
     * @notice Emitted when plugin enters unhealthy state
     * @param reason Human-readable reason
     * @param timestamp Block timestamp
     */
    event HealthStatusChanged(
        bool isHealthy,
        string reason,
        uint256 timestamp
    );
}
