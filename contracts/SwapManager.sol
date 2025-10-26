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
     * @notice Esegue swap da token a WETH come richiesto dalle specs
     * @param tokenCode Token da vendere
     * @param amountIn Quantità da swappare
     * @param minAmountOut Minimum amount out per slippage protection
     * @param deadline Deadline per lo swap
     * @return amountOut Quantità WETH ricevuta
     */
    function swapTokenForWETH(
        string memory tokenCode,
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
        require(block.timestamp <= deadline, "Swap deadline expired");
        uint256 received = performSwap(tokenCode, "WETH", amountIn);
        require(received >= minAmountOut, "Insufficient output amount");
        return received;
    }

    /**
     * @notice Swap WETH per altro token
     * @param tokenCode Token da ricevere
     * @param wethAmountIn Quantità WETH da spendere
     * @param minTokenOut Minimum amount out per slippage protection
     * @param deadline Deadline per lo swap
     * @return tokenAmountOut Quantità token ricevuta
     */
    function swapWETHForToken(
        string memory tokenCode,
        uint256 wethAmountIn,
        uint256 minTokenOut,
        uint256 deadline
    ) 
        external
        nonReentrant
        onlyAuthorizedCaller
        whenSwapsEnabled
        returns (uint256 tokenAmountOut)
    {
        require(block.timestamp <= deadline, "Swap deadline expired");
        uint256 received = performSwap("WETH", tokenCode, wethAmountIn);
        require(received >= minTokenOut, "Insufficient output amount");
        return received;
    }

    /**
     * @notice Esegue swap tramite ProxyGeneral custody pattern
     * @param spendTokenCode Token da vendere
     * @param receiveTokenCode Token da ricevere
     * @param amountIn Quantità da swappare
     * @return amountReceived Quantità effettivamente ricevuta
     */
    function performSwap(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) 
        public
        nonReentrant
        onlyAuthorizedCaller
        whenSwapsEnabled
        returns (uint256 amountReceived)
    {
        // VALIDATE INPUT PARAMETERS
        require(amountIn > 0, "Amount must be greater than 0");
        require(
            keccak256(bytes(spendTokenCode)) != keccak256(bytes(receiveTokenCode)),
            "Cannot swap same token"
        );
        require(simpleSwapRouter != address(0), "SimpleSwap router not set");
        
        // PRE-SWAP VALIDATION
        SwapValidation memory validation = _validateSwapParameters(spendTokenCode, receiveTokenCode, amountIn);
        require(validation.isValid, validation.errorReason);
        
        // GET CONTRACT REFERENCES
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        ISimpleSwap swapper = ISimpleSwap(simpleSwapRouter);
        
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
        
        // APPROVE SIMPLESWAP TO SPEND TOKENS FROM PROXYGENERAL
        proxy.approveSpender(validation.spendTokenAddress, address(swapper), amountIn);
        
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
            
            // CALCULATE SLIPPAGE FOR ANALYTICS
            uint256 slippage = ((validation.expectedOutput - execution.actualReceived) * 10000) / validation.expectedOutput;
            
            // EMIT EVENT WITH SLIPPAGE DATA
            emit SwapExecuted(spendTokenCode, "WETH", amountIn, execution.actualReceived, slippage, msg.sender);
            
            return execution.actualReceived;
            
        } catch Error(string memory reason) {
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
        
        // APPROVE SIMPLESWAP TO SPEND WETH FROM PROXYGENERAL
        proxy.approveSpender(validation.spendTokenAddress, address(swapper), amountIn);
        
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
            
            // CALCULATE SLIPPAGE FOR ANALYTICS
            uint256 slippage = ((validation.expectedOutput - execution.actualReceived) * 10000) / validation.expectedOutput;
            
            // EMIT EVENT WITH SLIPPAGE DATA
            emit SwapExecuted("WETH", receiveTokenCode, amountIn, execution.actualReceived, slippage, msg.sender);
            
            return execution.actualReceived;
            
        } catch Error(string memory reason) {
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
        
        // APPROVE SIMPLESWAP TO SPEND TOKENS FROM PROXYGENERAL
        proxy.approveSpender(validation.spendTokenAddress, address(swapper), amountIn);
        
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
            
            // CALCULATE SLIPPAGE FOR ANALYTICS
            uint256 slippage = ((validation.expectedOutput - execution.actualReceived) * 10000) / validation.expectedOutput;
            
            // EMIT EVENT WITH SLIPPAGE DATA
            emit SwapExecuted(spendTokenCode, receiveTokenCode, amountIn, execution.actualReceived, slippage, msg.sender);
            
            return execution.actualReceived;
            
        } catch Error(string memory reason) {
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
        ISimpleSwap swapper = ISimpleSwap(simpleSwapRouter);
        
        // CHECK MODULE ADDRESSES
        if (tokenManager == address(0)) {
            validation.errorReason = "TokenManager not configured";
            return validation;
        }
        if (simpleSwapRouter == address(0)) {
            validation.errorReason = "SimpleSwap router not configured";
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
        
        // GET EXPECTED OUTPUT AND CALCULATE SLIPPAGE PROTECTION
        try swapper.getExpectedOutput(validation.spendTokenAddress, validation.receiveTokenAddress, amountIn) returns (uint256 expectedOutput) {
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
     * @param newRouter Nuovo router address
     */
    function setSimpleSwapRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Invalid router address");
        require(newRouter.code.length > 0, "Router must be a contract");
        
        address oldRouter = simpleSwapRouter;
        simpleSwapRouter = newRouter;
        
        emit SimpleSwapRouterUpdated(oldRouter, newRouter);
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
        
        // Query router for expected output (this validates route exists)
        ISimpleSwap router = ISimpleSwap(simpleSwapRouter);
        uint256 expectedOutput = router.getExpectedOutput(tokenInAddress, tokenOutAddress, amountIn);
        
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

        // Check token addresses exist
        ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
        address tokenInAddress = tokenManager.getTokenAddress(tokenCodeIn);
        address tokenOutAddress = tokenManager.getTokenAddress(tokenCodeOut);
        
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
