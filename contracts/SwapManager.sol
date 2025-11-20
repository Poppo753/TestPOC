// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ISwapManager.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/ITokenManagerForModules.sol";
import "./interfaces/IProxyGeneral.sol";
import "./interfaces/ISimpleSwap.sol";
import "./interfaces/IWETH.sol";

/**
 * @title SwapManager
 * @dev Gestisce swap tra token tramite ProxyGeneral custody pattern
 * @custom:security-contact security@yourdomain.com
 */
contract SwapManager is ISwapManager, Ownable, ReentrancyGuard {
    
    // ==================== STORAGE ====================
    
    /// @notice Beacon address per resolution moduli
    address public immutable beacon;
    
    /// @notice Slippage massimo (basis points, 10000 = 100%)
    uint256 public maxSlippage = 300; // 3% default
    
    /// @notice SimpleSwap router address
    /// @dev DEPRECATED: Use activeSwapPlugin + Beacon resolution instead
    /// Maintained for backward compatibility and fallback
    address public simpleSwapRouter;
    
    /// @notice Swaps enabled flag
    bool public swapsEnabled = true;
    
    /// @notice Minimum swap amounts per token
    mapping(string => uint256) public minSwapAmounts;
    
    /// @notice Maximum swap amounts per token
    mapping(string => uint256) public maxSwapAmounts;
    
    /// @notice Error tracking per token pairs
    mapping(bytes32 => uint256) private swapErrors;
    
    /// @notice Success tracking per token pairs
    mapping(bytes32 => uint256) private swapSuccesses;
    
    /// @notice Default deadline window per swap automatici (secondi)
    uint256 public defaultDeadlineWindow = 20 minutes; // Industry standard (Uniswap-like)
    
    /// @notice Minimum deadline window permesso
    uint256 public constant MIN_DEADLINE_WINDOW = 1 minutes;
    
    /// @notice Maximum deadline window permesso
    uint256 public constant MAX_DEADLINE_WINDOW = 1 hours;
    
    // ==================== NEW STORAGE (Phase 1A) ====================
    
    /// @notice Active swap plugin name for Beacon resolution
    /// @dev Default: "UniswapV3Plugin" (reusing existing SimpleSwap deployed)
    string public activeSwapPlugin = "UniswapV3Plugin";

    // ==================== STRUCTS ====================
    
    struct SwapValidation {
        address spendTokenAddress;
        address receiveTokenAddress;
        uint256 availableBalance;
        uint256 expectedOutput;
        uint256 minAcceptableOutput;
        bool isValid;
        string errorReason;
    }

    struct SwapExecution {
        uint256 balanceBefore;
        uint256 balanceAfter;
        uint256 actualReceived;
        uint256 actualSpent;
        bool success;
    }
    
    // ==================== NEW STRUCTS (Phase 1B) ====================
    
    /**
     * @notice Quote result from a single plugin
     * @param pluginName Name of the plugin queried
     * @param quote Expected output amount (0 if invalid)
     * @param isValid True if quote is valid and usable
     * @param errorReason Human-readable error if not valid
     */
    struct QuoteResult {
        string pluginName;
        uint256 quote;
        bool isValid;
        string errorReason;
    }

    // ==================== EVENTS ====================

    /// @notice Emitted when max slippage is updated
    event MaxSlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
    
    /// @notice Emitted when SimpleSwap router is updated
    event SimpleSwapRouterUpdated(address oldRouter, address newRouter);
    
    /// @notice Emitted when a swap is executed with slippage data
    event SwapExecuted(
        string indexed tokenIn,
        string indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 slippageBps,
        address indexed executor
    );
    
    /// @notice Emitted when default deadline window is updated
    event DefaultDeadlineWindowUpdated(uint256 oldWindow, uint256 newWindow);
    
    /// @notice Emitted when swap has tight deadline (< 5 min remaining)
    event TightDeadlineWarning(
        address indexed caller,
        string spendToken,
        string receiveToken,
        uint256 deadline,
        uint256 currentTime
    );
    
    /// @notice Emitted when a swap fails with error details
    /// @dev Questo evento persiste anche se la transazione reverte
    /// @param tokenIn Token code being sold (indexed for filtering)
    /// @param tokenOut Token code being bought (indexed for filtering)
    /// @param amountIn Amount attempted to swap
    /// @param reason Error message from failed swap
    /// @param executor Address that initiated the swap (indexed)
    /// @param timestamp Block timestamp when error occurred
    event SwapFailed(
        string indexed tokenIn,
        string indexed tokenOut,
        uint256 amountIn,
        string reason,
        address indexed executor,
        uint256 timestamp
    );
    
    // ==================== NEW EVENTS (Phase 1A) ====================
    
    /// @notice Emitted when active swap plugin is changed
    event SwapPluginChanged(
        string indexed oldPlugin,
        string indexed newPlugin,
        address newPluginAddress
    );
    
    /// @notice Emitted when deprecated function is called
    /// @dev Used for migration tracking and alerting
    event DeprecationWarning(
        string functionName,
        string message
    );
    
    // ==================== NEW EVENTS (Phase 1B) ====================
    
    /// @notice Emitted when best plugin is selected and executed
    /// @param pluginName Name of the selected plugin
    /// @param expectedQuote Quote that won the selection
    /// @param actualOutput Actual output received from swap
    event BestPluginSelected(
        string indexed pluginName,
        uint256 expectedQuote,
        uint256 actualOutput
    );

    // ==================== MODIFIERS ====================

    modifier onlyAuthorizedCaller() {
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        require(
            msg.sender == owner() ||
            msg.sender == IBeacon(beacon).getImplementation("LiquidityManager") ||
            IProxyGeneral(proxyGeneral).isAuthorizedModule(msg.sender),
            "Not authorized to perform swaps"
        );
        _;
    }

    modifier whenSwapsEnabled() {
        require(swapsEnabled, "Swaps are disabled");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(address _beacon) Ownable() {
        require(_beacon != address(0), "Invalid beacon address");
        beacon = _beacon;
    }

    // ==================== MAIN SWAP FUNCTIONS ====================

    /**
     * @notice Esegue swap con deadline ESPLICITO (MEV protected)
     * @dev Fornisce protezione MEV via deadline check
     * @param spendTokenCode Token da vendere
     * @param receiveTokenCode Token da ricevere
     * @param amountIn Quantità da swappare
     * @param deadline Timestamp massimo per esecuzione (unix timestamp)
     * @return amountReceived Quantità effettivamente ricevuta
     */
    function performSwap(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn,
        uint256 deadline
    ) 
        public
        nonReentrant
        onlyAuthorizedCaller
        whenSwapsEnabled
        returns (uint256 amountReceived)
    {
        // DEADLINE VALIDATION
        require(block.timestamp <= deadline, "Swap deadline expired");
        
        // Emetti warning se deadline stretto (< 5 min rimanente)
        if (deadline - block.timestamp < 5 minutes) {
            emit TightDeadlineWarning(
                msg.sender,
                spendTokenCode,
                receiveTokenCode,
                deadline,
                block.timestamp
            );
        }
        
        // DELEGA A CORE LOGIC
        return _performSwapInternal(spendTokenCode, receiveTokenCode, amountIn);
    }
    
    /**
     * @notice Esegue swap con deadline AUTOMATICO (backward compatibility)
     * @dev Usa defaultDeadlineWindow per calcolare deadline
     * @param spendTokenCode Token da vendere
     * @param receiveTokenCode Token da ricevere
     * @param amountIn Quantità da swappare
     * @return amountReceived Quantità effettivamente ricevuta
     */
    function performSwapAuto(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) 
        public
        onlyAuthorizedCaller
        whenSwapsEnabled
        returns (uint256 amountReceived)
    {
        // Calcola deadline automatico
        uint256 deadline = block.timestamp + defaultDeadlineWindow;
        
        // Delega a versione con deadline esplicito (ha già nonReentrant)
        return performSwap(spendTokenCode, receiveTokenCode, amountIn, deadline);
    }
    
    // ==================== MULTI-PLUGIN SWAP (Phase 1B.2) ====================
    
    /**
     * @notice Execute swap with BEST PRICE plugin (multi-plugin query)
     * @dev Queries all registered plugins, selects best quote, executes swap
     * @param spendTokenCode Token code to sell (e.g., "WETH", "USDC")
     * @param receiveTokenCode Token code to buy (e.g., "USDC", "WETH")
     * @param amountIn Amount of spendToken to swap
     * @param minAmountOut Minimum acceptable output (slippage protection)
     * @param deadline Maximum timestamp for execution (MEV protection)
     * @return amountOut Actual amount received from best plugin
     * 
     * BEHAVIOR:
     * 1. Validates inputs (deadline, amounts, tokens)
     * 2. Resolves token addresses via TokenManager
     * 3. Queries ALL plugins via getAllQuotes()
     * 4. Selects plugin with highest valid quote
     * 5. Executes swap with winning plugin
     * 6. Emits BestPluginSelected event
     * 
     * AUTHORIZATION:
     * - onlyAuthorizedCaller: solo LiquidityManager-ETH/USDC/WBTC
     * - Same security as performSwap()
     * 
     * GAS COST:
     * - Overhead ~10-15k gas vs performSwap() (depends on # plugins)
     * - Worth it for best price guarantee
     * 
     * FAILURE MODES:
     * - No valid quotes → revert "No valid plugin found"
     * - Best quote < minAmountOut → revert "Best quote below minimum"
     * - Deadline expired → revert "Deadline expired"
     * 
     * USAGE (from LiquidityManager):
     * ```solidity
     * uint256 output = swapManager.swapWithBestPlugin(
     *     "WETH",
     *     "USDC",
     *     1 ether,
     *     1900 * 1e6,  // min 1900 USDC
     *     block.timestamp + 600
     * );
     * ```
     */
    function swapWithBestPlugin(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    )
        external
        nonReentrant
        onlyAuthorizedCaller
        whenSwapsEnabled
        returns (uint256 amountOut)
    {
        // ===== VALIDATION =====
        require(block.timestamp <= deadline, "Deadline expired");
        require(amountIn > 0, "Amount must be greater than 0");
        require(minAmountOut > 0, "minAmountOut must be greater than 0");
        require(
            keccak256(bytes(spendTokenCode)) != keccak256(bytes(receiveTokenCode)),
            "Cannot swap same token"
        );
        
        // Emetti warning se deadline stretto
        if (deadline - block.timestamp < 5 minutes) {
            emit TightDeadlineWarning(
                msg.sender,
                spendTokenCode,
                receiveTokenCode,
                deadline,
                block.timestamp
            );
        }
        
        // ===== RESOLVE TOKEN ADDRESSES =====
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        require(tokenManager != address(0), "TokenManager not configured");
        
        ITokenManagerForModules tokens = ITokenManagerForModules(tokenManager);
        
        address tokenIn = tokens.getTokenAddress(spendTokenCode);
        address tokenOut = tokens.getTokenAddress(receiveTokenCode);
        
        require(tokenIn != address(0), "Invalid spend token");
        require(tokenOut != address(0), "Invalid receive token");
        
        // ===== QUERY ALL PLUGINS WITH TOKEN CODES =====
        QuoteResult[] memory quotes = getAllQuotes(spendTokenCode, receiveTokenCode, amountIn);
        
        // ===== SELECT BEST PLUGIN =====
        uint256 bestQuote = 0;
        string memory bestPluginName;
        
        for (uint256 i = 0; i < quotes.length; i++) {
            if (quotes[i].isValid && quotes[i].quote > bestQuote) {
                bestQuote = quotes[i].quote;
                bestPluginName = quotes[i].pluginName;
            }
        }
        
        // Validate best quote found
        require(bytes(bestPluginName).length > 0, "No valid plugin found");
        require(bestQuote >= minAmountOut, "Best quote below minimum");
        
        // ===== EXECUTE SWAP WITH BEST PLUGIN =====
        address bestPluginAddr = IBeacon(beacon).getImplementation(bestPluginName);
        require(bestPluginAddr != address(0), "Best plugin not registered");
        
        ISimpleSwap bestPlugin = ISimpleSwap(bestPluginAddr);
        
        // Get ProxyGeneral reference
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        
        // Approve plugin to spend tokens from ProxyGeneral
        proxy.approveSpender(tokenIn, address(bestPlugin), amountIn);
        
        // Execute swap (no need to recheck minAmountOut - already validated bestQuote)
        amountOut = bestPlugin.inputSwap(tokenIn, tokenOut, amountIn);
        
        // ===== EMIT EVENT & TRACKING =====
        emit BestPluginSelected(bestPluginName, bestQuote, amountOut);
        
        emit SwapExecuted(
            spendTokenCode,
            receiveTokenCode,
            amountIn,
            amountOut,
            0, // slippage calculation omitted for simplicity
            msg.sender
        );
        
        // Update success tracking
        bytes32 pairHash = keccak256(abi.encodePacked(spendTokenCode, receiveTokenCode));
        swapSuccesses[pairHash]++;
        
        return amountOut;
    }

    /**
     * @notice Core swap logic (INTERNAL)
     * @dev Contiene tutta la logica di swap - NON include deadline check
     * @dev MUST essere chiamato da wrapper functions con deadline protection
     * @param spendTokenCode Token da vendere
     * @param receiveTokenCode Token da ricevere
     * @param amountIn Quantità da swappare
     * @return amountReceived Quantità effettivamente ricevuta
     */
    function _performSwapInternal(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) 
        internal
        returns (uint256 amountReceived)
    {
        // VALIDATE INPUT PARAMETERS
        require(amountIn > 0, "Amount must be greater than 0");
        require(
            keccak256(bytes(spendTokenCode)) != keccak256(bytes(receiveTokenCode)),
            "Cannot swap same token"
        );
        
        // PRE-SWAP VALIDATION
        SwapValidation memory validation = _validateSwapParameters(spendTokenCode, receiveTokenCode, amountIn);
        require(validation.isValid, validation.errorReason);
        
        // GET CONTRACT REFERENCES
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        ISimpleSwap swapper = _getActivePlugin(); // PHASE 1A.4: Use plugin resolution instead of hardcoded
        
        // SPECIAL HANDLING FOR WETH
        if (keccak256(bytes(receiveTokenCode)) == keccak256(bytes("WETH"))) {
            return _swapToWETH(spendTokenCode, amountIn, validation, proxy, swapper);
        } else if (keccak256(bytes(spendTokenCode)) == keccak256(bytes("WETH"))) {
            return _swapFromWETH(receiveTokenCode, amountIn, validation, proxy, swapper);
        } else {
            return _swapTokenToToken(spendTokenCode, receiveTokenCode, amountIn, validation, proxy, swapper);
        }
    }

    /**
     * @notice Swap da token generico a WETH
     */
    function _swapToWETH(
        string memory spendTokenCode,
        uint256 amountIn,
        SwapValidation memory validation,
        IProxyGeneral proxy,
        ISimpleSwap swapper
    ) internal returns (uint256 amountReceived) {
        
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        
        // CAPTURE PRE-SWAP BALANCES
        SwapExecution memory execution;
        execution.balanceBefore = IWETH(wethAddress).balanceOf(address(proxy));
        
        // CHECK CURRENT ALLOWANCE - only approve if insufficient
        uint256 currentAllowance = IERC20(validation.spendTokenAddress).allowance(address(proxy), address(swapper));
        if (currentAllowance < amountIn) {
            // APPROVE PLUGIN TO SPEND TOKENS FROM PROXYGENERAL (MAX for efficiency)
            proxy.approveSpender(validation.spendTokenAddress, address(swapper), type(uint256).max);
        }
        
        try swapper.inputSwap(
            validation.spendTokenAddress,
            validation.receiveTokenAddress, 
            amountIn
        ) returns (uint256 received) {
            
            // VERIFY ACTUAL RECEIVED AMOUNT
            execution.balanceAfter = IWETH(wethAddress).balanceOf(address(proxy));
            execution.actualReceived = execution.balanceAfter - execution.balanceBefore;
            
            // SLIPPAGE CHECK
            require(
                execution.actualReceived >= validation.minAcceptableOutput,
                "Slippage exceeds maximum allowed"
            );
            
            // UPDATE SUCCESS TRACKING
            bytes32 pairHash = keccak256(abi.encodePacked(spendTokenCode, "WETH"));
            swapSuccesses[pairHash]++;
            
            // CALCULATE SLIPPAGE FOR ANALYTICS (avoid underflow if actualReceived > expectedOutput)
            uint256 slippage;
            if (execution.actualReceived >= validation.expectedOutput) {
                slippage = 0; // No slippage, got more than expected
            } else {
                slippage = ((validation.expectedOutput - execution.actualReceived) * 10000) / validation.expectedOutput;
            }
            
            // EMIT EVENT WITH SLIPPAGE DATA
            emit SwapExecuted(spendTokenCode, "WETH", amountIn, execution.actualReceived, slippage, msg.sender);
            
            return execution.actualReceived;
            
        } catch Error(string memory reason) {
            // Emit event FIRST (persists through revert)
            emit SwapFailed(spendTokenCode, "WETH", amountIn, reason, msg.sender, block.timestamp);
            
            // Mantieni chiamata a _handleSwapError per compatibilità
            _handleSwapError(spendTokenCode, "WETH", amountIn, reason);
            
            revert(reason);
        }
    }

    /**
     * @notice Swap da WETH a token generico
     */
    function _swapFromWETH(
        string memory receiveTokenCode,
        uint256 amountIn,
        SwapValidation memory validation,
        IProxyGeneral proxy,
        ISimpleSwap swapper
    ) internal returns (uint256 amountReceived) {
        
        // CAPTURE PRE-SWAP BALANCES
        SwapExecution memory execution;
        execution.balanceBefore = IERC20(validation.receiveTokenAddress).balanceOf(address(proxy));
        
        // CHECK CURRENT ALLOWANCE - only approve if insufficient
        uint256 currentAllowance = IERC20(validation.spendTokenAddress).allowance(address(proxy), address(swapper));
        if (currentAllowance < amountIn) {
            // APPROVE PLUGIN TO SPEND WETH FROM PROXYGENERAL (MAX for efficiency)
            proxy.approveSpender(validation.spendTokenAddress, address(swapper), type(uint256).max);
        }
        
        try swapper.inputSwap(
            validation.spendTokenAddress,
            validation.receiveTokenAddress,
            amountIn
        ) returns (uint256 received) {
            
            // VERIFY ACTUAL RECEIVED AMOUNT
            execution.balanceAfter = IERC20(validation.receiveTokenAddress).balanceOf(address(proxy));
            execution.actualReceived = execution.balanceAfter - execution.balanceBefore;
            
            // SLIPPAGE CHECK
            require(
                execution.actualReceived >= validation.minAcceptableOutput,
                "Slippage exceeds maximum allowed"
            );
            
            // UPDATE SUCCESS TRACKING
            bytes32 pairHash = keccak256(abi.encodePacked("WETH", receiveTokenCode));
            swapSuccesses[pairHash]++;
            
            // CALCULATE SLIPPAGE FOR ANALYTICS (avoid underflow if actualReceived > expectedOutput)
            uint256 slippage;
            if (execution.actualReceived >= validation.expectedOutput) {
                slippage = 0; // No slippage, got more than expected
            } else {
                slippage = ((validation.expectedOutput - execution.actualReceived) * 10000) / validation.expectedOutput;
            }
            
            // EMIT EVENT WITH SLIPPAGE DATA
            emit SwapExecuted("WETH", receiveTokenCode, amountIn, execution.actualReceived, slippage, msg.sender);
            
            return execution.actualReceived;
            
        } catch Error(string memory reason) {
            // Emit event FIRST (persists through revert)
            emit SwapFailed("WETH", receiveTokenCode, amountIn, reason, msg.sender, block.timestamp);
            
            // Mantieni chiamata a _handleSwapError per compatibilità
            _handleSwapError("WETH", receiveTokenCode, amountIn, reason);
            
            revert(reason);
        }
    }

    /**
     * @notice Swap tra token generici (non WETH)
     */
    function _swapTokenToToken(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn,
        SwapValidation memory validation,
        IProxyGeneral proxy,
        ISimpleSwap swapper
    ) internal returns (uint256 amountReceived) {
        
        // CAPTURE PRE-SWAP BALANCES
        SwapExecution memory execution;
        execution.balanceBefore = IERC20(validation.receiveTokenAddress).balanceOf(address(proxy));
        
        // CHECK CURRENT ALLOWANCE - only approve if insufficient
        uint256 currentAllowance = IERC20(validation.spendTokenAddress).allowance(address(proxy), address(swapper));
        if (currentAllowance < amountIn) {
            // APPROVE PLUGIN TO SPEND TOKENS FROM PROXYGENERAL (MAX for efficiency)
            proxy.approveSpender(validation.spendTokenAddress, address(swapper), type(uint256).max);
        }
        
        try swapper.inputSwap(
            validation.spendTokenAddress,
            validation.receiveTokenAddress,
            amountIn
        ) returns (uint256 received) {
            
            // VERIFY ACTUAL RECEIVED AMOUNT
            execution.balanceAfter = IERC20(validation.receiveTokenAddress).balanceOf(address(proxy));
            execution.actualReceived = execution.balanceAfter - execution.balanceBefore;
            
            // SLIPPAGE CHECK
            require(
                execution.actualReceived >= validation.minAcceptableOutput,
                "Slippage exceeds maximum allowed"
            );
            
            // UPDATE SUCCESS TRACKING
            bytes32 pairHash = keccak256(abi.encodePacked(spendTokenCode, receiveTokenCode));
            swapSuccesses[pairHash]++;
            
            // CALCULATE SLIPPAGE FOR ANALYTICS (avoid underflow if actualReceived > expectedOutput)
            uint256 slippage;
            if (execution.actualReceived >= validation.expectedOutput) {
                slippage = 0; // No slippage, got more than expected
            } else {
                slippage = ((validation.expectedOutput - execution.actualReceived) * 10000) / validation.expectedOutput;
            }
            
            // EMIT EVENT WITH SLIPPAGE DATA
            emit SwapExecuted(spendTokenCode, receiveTokenCode, amountIn, execution.actualReceived, slippage, msg.sender);
            
            return execution.actualReceived;
            
        } catch Error(string memory reason) {
            // Emit event FIRST (persists through revert)
            emit SwapFailed(spendTokenCode, receiveTokenCode, amountIn, reason, msg.sender, block.timestamp);
            
            // Mantieni chiamata a _handleSwapError per compatibilità
            _handleSwapError(spendTokenCode, receiveTokenCode, amountIn, reason);
            
            revert(reason);
        }
    }

    // ==================== VALIDATION FUNCTIONS ====================

    /**
     * @notice Valida parametri swap prima dell'esecuzione
     * @param spendTokenCode Token da vendere
     * @param receiveTokenCode Token da ricevere
     * @param amountIn Quantità da swappare
     * @return isValid Se la validazione è passata
     * @return errorReason Motivo dell'errore se non valido
     */
    function validateSwapParameters(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) external view returns (bool isValid, string memory errorReason) {
        SwapValidation memory validation = _validateSwapParameters(spendTokenCode, receiveTokenCode, amountIn);
        return (validation.isValid, validation.errorReason);
    }

    // ==================== INTERNAL PLUGIN RESOLUTION (Phase 1A.3) ====================
    
    /**
     * @notice Resolves active swap plugin with fallback
     * @dev Tries Beacon resolution first, falls back to deprecated simpleSwapRouter
     * @return plugin ISimpleSwap implementation address
     * 
     * RESOLUTION LOGIC:
     * 1. Try: Beacon.getImplementation(activeSwapPlugin)
     * 2. Fallback: Use simpleSwapRouter (deprecated but maintained)
     * 3. Revert if both fail
     * 
     * BACKWARD COMPATIBILITY:
     * - If Beacon resolution fails → simpleSwapRouter used (old system works)
     * - If activeSwapPlugin empty → simpleSwapRouter used
     * - If both fail → revert with clear error
     */
    function _getActivePlugin() internal view returns (ISimpleSwap plugin) {
        // TRY NEW SYSTEM: Beacon resolution
        if (bytes(activeSwapPlugin).length > 0) {
            try IBeacon(beacon).getImplementation(activeSwapPlugin) returns (address pluginAddr) {
                if (pluginAddr != address(0) && pluginAddr.code.length > 0) {
                    return ISimpleSwap(pluginAddr);
                }
            } catch {
                // Beacon resolution failed, will fallback
            }
        }
        
        // FALLBACK TO OLD SYSTEM: simpleSwapRouter (deprecated)
        if (simpleSwapRouter != address(0)) {
            return ISimpleSwap(simpleSwapRouter);
        }
        
        // BOTH FAILED: No plugin configured
        revert("No swap plugin configured");
    }
    
    // ==================== MULTI-PLUGIN QUERY SYSTEM (Phase 1B) ====================
    
    /**
     * @notice Get list of swap plugin names from Beacon
     * @dev Filters Beacon registered modules for swap plugins by naming convention
     * @return pluginNames Array of plugin names (e.g., ["UniswapV3Plugin", "CamelotPlugin"])
     * 
     * NAMING CONVENTION:
     * - Plugins MUST end with "Plugin" suffix
     * - Examples: "UniswapV3Plugin", "CamelotPlugin", "OdosPlugin"
     * - This allows filtering without ModuleCategory enum
     * 
     * OPTIMIZATION:
     * - Max 10 plugins to prevent gas exhaustion
     * - Can be extended if needed (monitor gas costs)
     */
    function _getSwapPluginNames() internal view returns (string[] memory pluginNames) {
        string[] memory allModules = IBeacon(beacon).getRegisteredModules();
        
        // First pass: count swap plugins
        uint256 count = 0;
        for (uint256 i = 0; i < allModules.length && count < 10; i++) {
            if (_isSwapPlugin(allModules[i])) {
                count++;
            }
        }
        
        // Second pass: collect plugin names
        pluginNames = new string[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allModules.length && index < count; i++) {
            if (_isSwapPlugin(allModules[i])) {
                pluginNames[index] = allModules[i];
                index++;
            }
        }
        
        return pluginNames;
    }
    
    /**
     * @notice Check if module name is a swap plugin
     * @dev Uses naming convention: must end with "Plugin"
     * 
     * GAS OPTIMIZATION: 
     * - Inline suffix check (6 bytes: "Plugin")
     * - No memory allocation for suffix bytes
     */
    function _isSwapPlugin(string memory moduleName) internal pure returns (bool) {
        bytes memory nameBytes = bytes(moduleName);
        
        // Must be at least 7 chars (e.g., "XPlugin")
        if (nameBytes.length < 6) {
            return false;
        }
        
        // Check if last 6 chars match "Plugin" (0x506C7567696E)
        // P=0x50, l=0x6C, u=0x75, g=0x67, i=0x69, n=0x6E
        uint256 offset = nameBytes.length - 6;
        return (
            nameBytes[offset]     == 0x50 && // P
            nameBytes[offset + 1] == 0x6C && // l
            nameBytes[offset + 2] == 0x75 && // u
            nameBytes[offset + 3] == 0x67 && // g
            nameBytes[offset + 4] == 0x69 && // i
            nameBytes[offset + 5] == 0x6E    // n
        );
    }
    
    /**
     * @notice Get quotes from ALL registered swap plugins
     * @dev Queries each plugin via Beacon, returns array with validity status
     * @param tokenIn Token to sell (address)
     * @param tokenOut Token to buy (address)
     * @param amountIn Amount of tokenIn to swap
     * @return results Array of QuoteResult structs (one per plugin)
     * 
     * BEHAVIOR:
     * - Queries all plugins found via _getSwapPluginNames()
     * - Each plugin query wrapped in try/catch (failures don't revert)
     * - Invalid plugins return isValid=false with errorReason
     * - View function: no state changes, safe to call off-chain
     * 
     * GAS OPTIMIZATION:
     * - Max 10 plugins queried (enforced in _getSwapPluginNames)
     * - Early continue on plugin resolution failures
     * - Memory-efficient result allocation
     * 
     * USAGE:
     * ```solidity
     * QuoteResult[] memory quotes = swapManager.getAllQuotes(WETH, USDC, 1 ether);
     * for (uint i = 0; i < quotes.length; i++) {
     *     if (quotes[i].isValid) {
     *         console.log(quotes[i].pluginName, quotes[i].quote);
     *     }
     * }
     * ```
     */
    /**
     * @notice Get quotes from ALL registered plugins
     * @dev Queries each plugin, returns array of results with decimals from TokenManager
     * @param tokenCodeIn Token code to sell (e.g., "WETH", "USDC") 
     * @param tokenCodeOut Token code to buy
     * @param amountIn Amount to swap
     * @return results Array of QuoteResult structs
     */
    function getAllQuotes(
        string memory tokenCodeIn,
        string memory tokenCodeOut,
        uint256 amountIn
    ) public view returns (QuoteResult[] memory results) {
        require(bytes(tokenCodeIn).length > 0, "Invalid tokenCodeIn");
        require(bytes(tokenCodeOut).length > 0, "Invalid tokenCodeOut");
        require(keccak256(bytes(tokenCodeIn)) != keccak256(bytes(tokenCodeOut)), "Same token");
        require(amountIn > 0, "Amount must be > 0");
        
        // Get TokenManager reference
        address tokenManagerAddr = IBeacon(beacon).getImplementation("TokenManager");
        require(tokenManagerAddr != address(0), "TokenManager not configured");
        ITokenManagerForModules tokens = ITokenManagerForModules(tokenManagerAddr);
        
        // Get token info from TokenManager (single source of truth)
        ITokenManagerForModules.TokenInfo memory tokenInInfo = tokens.getTokenInfo(tokenCodeIn);
        ITokenManagerForModules.TokenInfo memory tokenOutInfo = tokens.getTokenInfo(tokenCodeOut);
        
        address tokenIn = tokenInInfo.tokenAddress;
        address tokenOut = tokenOutInfo.tokenAddress;
        uint8 decimalsIn = tokenInInfo.tokenDecimals;
        uint8 decimalsOut = tokenOutInfo.tokenDecimals;
        
        require(tokenIn != address(0), "Invalid tokenIn");
        require(tokenOut != address(0), "Invalid tokenOut");
        
        // Get all swap plugin names from Beacon
        string[] memory pluginNames = _getSwapPluginNames();
        results = new QuoteResult[](pluginNames.length);
        
        // Query each plugin
        for (uint256 i = 0; i < pluginNames.length; i++) {
            results[i].pluginName = pluginNames[i];
            
            // Try to resolve plugin address from Beacon
            address pluginAddr;
            try IBeacon(beacon).getImplementation(pluginNames[i]) returns (address addr) {
                pluginAddr = addr;
            } catch {
                results[i].isValid = false;
                results[i].errorReason = "Beacon resolution failed";
                continue;
            }
            
            // Verify plugin address is valid
            if (pluginAddr == address(0)) {
                results[i].isValid = false;
                results[i].errorReason = "Plugin not registered";
                continue;
            }
            
            if (pluginAddr.code.length == 0) {
                results[i].isValid = false;
                results[i].errorReason = "Plugin is not a contract";
                continue;
            }
            
            // Query plugin WITH DECIMALS FROM TOKENMANAGER
            ISimpleSwap plugin = ISimpleSwap(pluginAddr);
            
            try plugin.getExpectedOutput(tokenIn, tokenOut, amountIn, decimalsIn, decimalsOut) returns (uint256 quote) {
                if (quote > 0) {
                    results[i].quote = quote;
                    results[i].isValid = true;
                } else {
                    results[i].isValid = false;
                    results[i].errorReason = "Quote is zero";
                }
            } catch Error(string memory reason) {
                results[i].isValid = false;
                results[i].errorReason = reason;
            } catch {
                results[i].isValid = false;
                results[i].errorReason = "getExpectedOutput failed";
            }
        }
        
        return results;
    }

    /**
     * @notice Validazione interna parametri swap
     */
    function _validateSwapParameters(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) internal view returns (SwapValidation memory validation) {
        
        // GET CONTRACT REFERENCES
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        
        ITokenManagerForModules tokens = ITokenManagerForModules(tokenManager);
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        ISimpleSwap swapper = _getActivePlugin();
        
        // CHECK MODULE ADDRESSES
        if (tokenManager == address(0)) {
            validation.errorReason = "TokenManager not configured";
            return validation;
        }
        if (address(swapper) == address(0)) {
            validation.errorReason = "Active swap plugin not configured";
            return validation;
        }
        
        // CHECK TOKEN VALIDITY
        // WETH SPECIAL CASE: WETH not in TokenManager, resolved via Beacon
        bool spendTokenIsWeth = (keccak256(bytes(spendTokenCode)) == keccak256(bytes("WETH")));
        bool receiveTokenIsWeth = (keccak256(bytes(receiveTokenCode)) == keccak256(bytes("WETH")));
        
        // Validate spend token (skip TokenManager check if WETH)
        if (!spendTokenIsWeth && !tokens.isTokenActive(spendTokenCode)) {
            validation.errorReason = "Spend token is inactive";
            return validation;
        }
        
        // Validate receive token (skip TokenManager check if WETH)
        if (!receiveTokenIsWeth && !tokens.isTokenActive(receiveTokenCode)) {
            validation.errorReason = "Receive token is inactive";
            return validation;
        }
        
        // If WETH is involved, verify it's registered in Beacon
        if (spendTokenIsWeth || receiveTokenIsWeth) {
            address wethAddress = IBeacon(beacon).getImplementation("WETH");
            if (wethAddress == address(0)) {
                validation.errorReason = "WETH not registered in Beacon";
                return validation;
            }
        }
        
        // GET TOKEN ADDRESSES
        // WETH special case: get from Beacon instead of TokenManager
        if (spendTokenIsWeth) {
            validation.spendTokenAddress = IBeacon(beacon).getImplementation("WETH");
        } else {
            validation.spendTokenAddress = tokens.getTokenAddress(spendTokenCode);
        }
        
        if (receiveTokenIsWeth) {
            validation.receiveTokenAddress = IBeacon(beacon).getImplementation("WETH");
        } else {
            validation.receiveTokenAddress = tokens.getTokenAddress(receiveTokenCode);
        }
        
        if (validation.spendTokenAddress == address(0) || validation.receiveTokenAddress == address(0)) {
            validation.errorReason = "Invalid token addresses";
            return validation;
        }
        
        // CHECK AVAILABLE BALANCE
        validation.availableBalance = proxy.getAssetBalance(validation.spendTokenAddress);
        if (validation.availableBalance < amountIn) {
            validation.errorReason = "Insufficient balance in pool";
            return validation;
        }
        
        // CHECK SWAP LIMITS
        if (minSwapAmounts[spendTokenCode] > 0 && amountIn < minSwapAmounts[spendTokenCode]) {
            validation.errorReason = "Below minimum swap amount";
            return validation;
        }
        if (maxSwapAmounts[spendTokenCode] > 0 && amountIn > maxSwapAmounts[spendTokenCode]) {
            validation.errorReason = "Exceeds maximum swap amount";
            return validation;
        }
        
        // GET DECIMALS FROM TOKENMANAGER
        uint8 decimalsIn = 18;
        uint8 decimalsOut = 18;
        
        // Get decimals for spendToken
        if (!spendTokenIsWeth) {
            try tokens.getTokenInfo(spendTokenCode) returns (ITokenManagerForModules.TokenInfo memory info) {
                decimalsIn = info.tokenDecimals;
            } catch {}
        }
        
        // Get decimals for receiveToken
        if (!receiveTokenIsWeth) {
            try tokens.getTokenInfo(receiveTokenCode) returns (ITokenManagerForModules.TokenInfo memory info) {
                decimalsOut = info.tokenDecimals;
            } catch {}
        }
        
        // GET EXPECTED OUTPUT AND CALCULATE SLIPPAGE PROTECTION
        try swapper.getExpectedOutput(validation.spendTokenAddress, validation.receiveTokenAddress, amountIn, decimalsIn, decimalsOut) returns (uint256 expectedOutput) {
            validation.expectedOutput = expectedOutput;
            validation.minAcceptableOutput = (expectedOutput * (10000 - maxSlippage)) / 10000;
        } catch {
            validation.errorReason = "Cannot get expected output from swap router";
            return validation;
        }
        
        if (validation.expectedOutput == 0) {
            validation.errorReason = "Expected output is zero";
            return validation;
        }
        
        validation.isValid = true;
        return validation;
    }

    /**
     * @notice Gestisce errori swap con tracking
     */
    function _handleSwapError(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn,
        string memory reason
    ) internal {
        bytes32 pairHash = keccak256(abi.encodePacked(spendTokenCode, receiveTokenCode));
        swapErrors[pairHash]++;
        
        // Swap failed event - logged internally
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Ottiene expected output per uno swap
     * @param spendTokenCode Token da vendere
     * @param receiveTokenCode Token da ricevere
     * @param amountIn Quantità input
     * @return expectedOutput Output previsto
     * @return minOutput Output minimo considerando slippage
     */
    function getExpectedSwapOutput(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) public view returns (uint256 expectedOutput, uint256 minOutput) {
        SwapValidation memory validation = _validateSwapParameters(spendTokenCode, receiveTokenCode, amountIn);
        
        if (!validation.isValid) {
            return (0, 0);
        }
        
        return (validation.expectedOutput, validation.minAcceptableOutput);
    }

    /**
     * @notice Ottiene statistiche swap per una coppia di token
     * @param spendTokenCode Token speso
     * @param receiveTokenCode Token ricevuto
     * @return successCount Numero successi
     * @return errorCount Numero errori
     */
    function getSwapStats(
        string memory spendTokenCode,
        string memory receiveTokenCode
    ) external view returns (uint256 successCount, uint256 errorCount) {
        bytes32 pairHash = keccak256(abi.encodePacked(spendTokenCode, receiveTokenCode));
        return (swapSuccesses[pairHash], swapErrors[pairHash]);
    }

    /**
     * @notice Ottiene quote per swap come richiesto dalle specs
     * @param tokenCode Token da swappare  
     * @param amountIn Quantità input
     * @return estimatedOut Output stimato
     */
    function getSwapQuote(
        string memory tokenCode,
        uint256 amountIn
    ) external view returns (uint256 estimatedOut) {
        (uint256 expectedOutput, ) = getExpectedSwapOutput(tokenCode, "WETH", amountIn);
        return expectedOutput;
    }

    /**
     * @notice Calcola minimum amount out considerando slippage
     * @param tokenCodeIn Token input
     * @param tokenCodeOut Token output
     * @param amountIn Quantità input
     * @param slippageTolerance Tolleranza slippage (basis points)
     * @return minAmountOut Minimum amount out
     */
    function calculateMinAmountOut(
        string memory tokenCodeIn,
        string memory tokenCodeOut,
        uint256 amountIn,
        uint256 slippageTolerance
    ) external view returns (uint256 minAmountOut) {
        (uint256 expectedOutput, ) = getExpectedSwapOutput(tokenCodeIn, tokenCodeOut, amountIn);
        
        // Apply slippage tolerance
        uint256 slippageAmount = (expectedOutput * slippageTolerance) / 10000;
        minAmountOut = expectedOutput - slippageAmount;
        
        return minAmountOut;
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @notice Imposta limiti swap per un token
     * @param tokenCode Token code
     * @param minAmount Minimo swap amount
     * @param maxAmount Massimo swap amount
     */
    function setSwapLimits(
        string memory tokenCode,
        uint256 minAmount,
        uint256 maxAmount
    ) external onlyOwner {
        require(minAmount <= maxAmount, "Invalid limits");
        
        minSwapAmounts[tokenCode] = minAmount;
        maxSwapAmounts[tokenCode] = maxAmount;
        
        // Swap limits updated
    }

    /**
     * @notice Aggiorna slippage massimo
     * @param newSlippage Nuovo slippage in basis points
     */
    function setMaxSlippage(uint256 newSlippage) external onlyOwner {
        require(newSlippage <= 2000, "Slippage too high"); // Max 20%
        
        uint256 oldSlippage = maxSlippage;
        maxSlippage = newSlippage;
        
        emit MaxSlippageUpdated(oldSlippage, newSlippage);
    }

    /**
     * @notice Imposta SimpleSwap router address
     * @dev DEPRECATED: Use setActiveSwapPlugin() instead
     *      Maintained for backward compatibility only
     * @param newRouter Nuovo router address
     */
    function setSimpleSwapRouter(address newRouter) external onlyOwner {
        emit DeprecationWarning(
            "setSimpleSwapRouter",
            "DEPRECATED: Use setActiveSwapPlugin() instead. This function maintained for backward compatibility only."
        );
        
        require(newRouter != address(0), "Invalid router address");
        require(newRouter.code.length > 0, "Router must be a contract");
        
        address oldRouter = simpleSwapRouter;
        simpleSwapRouter = newRouter;
        
        emit SimpleSwapRouterUpdated(oldRouter, newRouter);
    }
    
    /**
     * @notice Set active swap plugin by name (NEW - Phase 1A.3)
     * @dev Plugin must be registered in Beacon before calling
     * @param pluginName Plugin name (e.g., "UniswapV3Plugin", "CamelotPlugin")
     */
    function setActiveSwapPlugin(string memory pluginName) external onlyOwner {
        require(bytes(pluginName).length > 0, "Invalid plugin name");
        
        // Verify plugin exists in Beacon
        address pluginAddr = IBeacon(beacon).getImplementation(pluginName);
        require(pluginAddr != address(0), "Plugin not registered in Beacon");
        require(pluginAddr.code.length > 0, "Plugin address is not a contract");
        
        string memory oldPlugin = activeSwapPlugin;
        activeSwapPlugin = pluginName;
        
        emit SwapPluginChanged(oldPlugin, pluginName, pluginAddr);
    }

    /**
     * @notice Abilita/disabilita swaps
     * @param enabled Stato enabled
     */
    function setSwapsEnabled(bool enabled) external onlyOwner {
        swapsEnabled = enabled;
        emit SwapsEnabledChanged(enabled);
    }
    
    /**
     * @notice Imposta finestra default per deadline automatico
     * @dev Solo owner può modificare, range limitato per sicurezza
     * @param windowSeconds Secondi da aggiungere a block.timestamp
     */
    function setDefaultDeadlineWindow(uint256 windowSeconds) external onlyOwner {
        require(
            windowSeconds >= MIN_DEADLINE_WINDOW,
            "Window too short - minimum 1 minute"
        );
        require(
            windowSeconds <= MAX_DEADLINE_WINDOW,
            "Window too long - maximum 1 hour"
        );
        
        uint256 oldWindow = defaultDeadlineWindow;
        defaultDeadlineWindow = windowSeconds;
        
        emit DefaultDeadlineWindowUpdated(oldWindow, windowSeconds);
    }
    
    /**
     * @notice Ottiene finestra default deadline corrente
     * @return windowSeconds Secondi correnti per default deadline
     */
    function getDefaultDeadlineWindow() external view returns (uint256 windowSeconds) {
        return defaultDeadlineWindow;
    }

    /**
     * @notice Reset statistiche swap per una coppia
     * @param spendTokenCode Token speso
     * @param receiveTokenCode Token ricevuto
     */
    function resetSwapStats(
        string memory spendTokenCode,
        string memory receiveTokenCode
    ) external onlyOwner {
        bytes32 pairHash = keccak256(abi.encodePacked(spendTokenCode, receiveTokenCode));
        delete swapErrors[pairHash];
        delete swapSuccesses[pairHash];
    }

    // ==================== INTERFACE COMPLIANCE FUNCTIONS ====================

    /**
     * @notice Ottiene SimpleSwap router address corrente
     * @return router Indirizzo router
     */
    function getSimpleSwapRouter() external view returns (address router) {
        return simpleSwapRouter;
    }

    /**
     * @notice Verifica se swaps sono abilitati
     * @return enabled Se swaps abilitati
     */
    function areSwapsEnabled() external view returns (bool enabled) {
        return swapsEnabled;
    }

    /**
     * @notice Ottiene prezzo corrente token/WETH
     * @param tokenCode Codice token
     * @return price Prezzo in WETH per unità token
     */
    function getTokenWETHPrice(string memory tokenCode) external view returns (uint256 price) {
        // Use TokenManager to get current price
        ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
        (uint256 tokenPrice, , ) = tokenManager.getTokenPrice(tokenCode);
        return tokenPrice;
    }

    /**
     * @notice Stima gas necessario per uno swap (Issue #8 FIX)
     * @dev Combina stima fissa con query al router per maggiore accuratezza
     * @param tokenCodeIn Token input
     * @param tokenCodeOut Token output  
     * @param amountIn Quantità input
     * @return gasEstimate Stima gas
     * 
     * @custom:implementation
     * - Base gas: 150k (swap base)
     * - WETH swaps: più economici (-50k)
     * - Token-to-token: più costosi (+50k)
     * - Router query: se disponibile, aggiunge validazione
     * - Fallback: se router non disponibile, usa stime fisse
     */
    function estimateSwapGas(
        string memory tokenCodeIn,
        string memory tokenCodeOut,
        uint256 amountIn
    ) external view returns (uint256 gasEstimate) {
        if (amountIn == 0) return 0;
        
        // Base gas cost for swap operation
        uint256 baseGas = 150000;
        
        // WETH swaps are cheaper (no need for token-to-token routing)
        bool isWethSwap = keccak256(bytes(tokenCodeIn)) == keccak256(bytes("WETH")) ||
                          keccak256(bytes(tokenCodeOut)) == keccak256(bytes("WETH"));
        
        if (isWethSwap) {
            baseGas = 100000; // WETH swaps more efficient
        } else {
            // Token-to-token swaps cost more (may need intermediate WETH hop)
            baseGas = 200000;
        }
        
        // If router is available, try to get more accurate estimate
        if (simpleSwapRouter != address(0)) {
            try this._tryGetRouterEstimate(tokenCodeIn, tokenCodeOut, amountIn) returns (uint256 routerGas) {
                // Router provided estimate - use it with safety margin
                return routerGas + 50000; // Add 50k safety buffer
            } catch {
                // Router query failed - fall back to base estimate
                return baseGas;
            }
        }
        
        // No router available - return base estimate
        return baseGas;
    }
    
    /**
     * @notice Helper per query router (internal per try/catch)
     * @dev Chiamata esterna per permettere try/catch
     */
    function _tryGetRouterEstimate(
        string memory tokenCodeIn,
        string memory tokenCodeOut,
        uint256 amountIn
    ) external view returns (uint256 estimatedGas) {
        require(msg.sender == address(this), "Internal only");
        
        // Get token addresses from TokenManager
        ITokenManagerForModules tokenManager = ITokenManagerForModules(
            IBeacon(beacon).getImplementation("TokenManager")
        );
        
        ITokenManagerForModules.TokenInfo memory tokenInInfo = tokenManager.getTokenInfo(tokenCodeIn);
        ITokenManagerForModules.TokenInfo memory tokenOutInfo = tokenManager.getTokenInfo(tokenCodeOut);
        
        address tokenInAddress = tokenInInfo.tokenAddress;
        address tokenOutAddress = tokenOutInfo.tokenAddress;
        uint8 decimalsIn = tokenInInfo.tokenDecimals;
        uint8 decimalsOut = tokenOutInfo.tokenDecimals;
        
        // Query router for expected output (this validates route exists)
        ISimpleSwap router = ISimpleSwap(simpleSwapRouter);
        uint256 expectedOutput = router.getExpectedOutput(tokenInAddress, tokenOutAddress, amountIn, decimalsIn, decimalsOut);
        
        // If we got output, estimate gas based on complexity
        if (expectedOutput > 0) {
            // Base swap gas
            uint256 gas = 150000;
            
            // Add for token approvals (if needed)
            gas += 50000;
            
            // Add for potential multi-hop routes
            if (!_isDirectPair(tokenInAddress, tokenOutAddress)) {
                gas += 100000; // Multi-hop adds significant gas
            }
            
            return gas;
        }
        
        revert("No route available");
    }
    
    /**
     * @notice Verifica se due token hanno pair diretta
     * @dev Semplificato: assume WETH sempre ha pair diretta
     */
    function _isDirectPair(address tokenA, address tokenB) internal view returns (bool) {
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        
        // If either token is WETH, assume direct pair
        if (tokenA == wethAddress || tokenB == wethAddress) {
            return true;
        }
        
        // For other tokens, assume indirect (conservative estimate)
        return false;
    }

    /**
     * @notice Verifica se uno swap è fattibile
     * @param tokenCodeIn Token input
     * @param tokenCodeOut Token output
     * @param amountIn Quantità input
     * @return isValid Se fattibile
     * @return reason Motivo se non fattibile
     */
    function canSwap(
        string memory tokenCodeIn,
        string memory tokenCodeOut,
        uint256 amountIn
    ) external view returns (bool isValid, string memory reason) {
        // Check if swaps enabled
        if (!swapsEnabled) {
            return (false, "Swaps are disabled");
        }

        // Check if same token
        if (keccak256(bytes(tokenCodeIn)) == keccak256(bytes(tokenCodeOut))) {
            return (false, "Cannot swap same token");
        }

        // Check amount > 0
        if (amountIn == 0) {
            return (false, "Amount must be greater than 0");
        }

        // Check token addresses exist - SPECIAL CASE: WETH from Beacon
        bool tokenInIsWeth = (keccak256(bytes(tokenCodeIn)) == keccak256(bytes("WETH")));
        bool tokenOutIsWeth = (keccak256(bytes(tokenCodeOut)) == keccak256(bytes("WETH")));
        
        address tokenInAddress;
        address tokenOutAddress;
        
        if (tokenInIsWeth) {
            tokenInAddress = IBeacon(beacon).getImplementation("WETH");
        } else {
            ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
            tokenInAddress = tokenManager.getTokenAddress(tokenCodeIn);
        }
        
        if (tokenOutIsWeth) {
            tokenOutAddress = IBeacon(beacon).getImplementation("WETH");
        } else {
            ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
            tokenOutAddress = tokenManager.getTokenAddress(tokenCodeOut);
        }
        
        if (tokenInAddress == address(0)) {
            return (false, "Input token not supported");
        }
        
        if (tokenOutAddress == address(0)) {
            return (false, "Output token not supported");
        }

        return (true, "");
    }

    /**
     * @notice Valida parametri swap
     * @param tokenCodeIn Token input
     * @param tokenCodeOut Token output
     * @param amountIn Quantità input
     * @param minAmountOut Quantità minima output
     * @param deadline Deadline
     * @return isValid Se parametri validi
     * @return errorMessage Messaggio errore
     */
    function validateSwapParams(
        string memory tokenCodeIn,
        string memory tokenCodeOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external view returns (bool isValid, string memory errorMessage) {
        // Check basic swap feasibility
        (bool canSwapResult, string memory swapReason) = this.canSwap(tokenCodeIn, tokenCodeOut, amountIn);
        if (!canSwapResult) {
            return (false, swapReason);
        }

        // Check deadline
        if (deadline < block.timestamp) {
            return (false, "Deadline expired");
        }

        // Check minAmountOut
        if (minAmountOut == 0) {
            return (false, "Minimum output must be greater than 0");
        }

        return (true, "");
    }

    /**
     * @notice Recupero token in emergenza
     * @param tokenCode Codice token
     * @param amount Quantità da recuperare
     * @param recipient Destinatario
     */
    function emergencyTokenRecovery(
        string memory tokenCode,
        uint256 amount,
        address recipient
    ) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");

        // Get token address
        ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
        address tokenAddress = tokenManager.getTokenAddress(tokenCode);
        require(tokenAddress != address(0), "Token not found");

        // Transfer from ProxyGeneral
        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        proxy.transferFunds(recipient, tokenAddress, amount);

        emit EmergencyTokenRecovered(tokenCode, amount, recipient);
    }
}
