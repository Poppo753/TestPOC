# 🔧 SPECIFICHE IMPLEMENTAZIONE - Deadline Protection

**Documento:** Parte 3/4 - MEV Protection Strategy  
**Focus:** Technical Specifications & Code Implementation Details

---

## 🎯 STRATEGIA DI SOLUZIONE

### Approccio Scelto: **OVERLOAD PATTERN con Default Deadline**

**Rationale:**
- ✅ **Backward Compatibility**: Caller esistenti funzionano senza modifiche
- ✅ **Progressive Enhancement**: Advanced users possono specificare deadline custom
- ✅ **Security by Default**: Default deadline protegge automaticamente
- ✅ **Clean Architecture**: Refactoring separa concerns (validation vs execution)

### Alternative Valutate

| Approccio | Pro | Contro | Decisione |
|-----------|-----|--------|-----------|
| **A) Nuovo metodo performSwapWithDeadline()** | • Zero breaking changes<br>• Explicit intent | • Duplicazione codice<br>• Double maintenance | ❌ Rejected |
| **B) Modifica performSwap() esistente (breaking)** | • Clean interface<br>• No duplication | • Breaking change<br>• Migration complessa | ❌ Rejected |
| **C) Overload con default deadline** | • Backward compatible<br>• Graduale migration<br>• Best of both worlds | • Naming workaround (Solidity)<br>• Slightly complex | ✅ **SELECTED** |
| **D) External MEV protection (Flashbots)** | • No code changes | • Arbitrum non supporta<br>• External dependency | ❌ Not viable |

---

## 📐 DESIGN PATTERNS

### Pattern 1: Function Overload Simulation

**Problema:** Solidity non supporta overload per numero parametri

**Soluzione:** Naming convention per simulare overload
```solidity
// LEGACY: Default deadline (backward compatible)
function performSwapAuto(
    string memory spendToken,
    string memory receiveToken, 
    uint256 amountIn
) public returns (uint256) {
    uint256 deadline = block.timestamp + defaultDeadlineWindow;
    return performSwap(spendToken, receiveToken, amountIn, deadline);
}

// NEW: Explicit deadline (advanced use cases)
function performSwap(
    string memory spendToken,
    string memory receiveToken,
    uint256 amountIn,
    uint256 deadline
) public returns (uint256) {
    require(block.timestamp <= deadline, "Swap deadline expired");
    return _performSwapInternal(spendToken, receiveToken, amountIn);
}
```

### Pattern 2: Core Logic Extraction

**Problema:** Evitare duplicazione codice tra overloaded functions

**Soluzione:** Internal function con core logic
```solidity
function _performSwapInternal(
    string memory spendTokenCode,
    string memory receiveTokenCode,
    uint256 amountIn
) internal returns (uint256 amountReceived) {
    // VALIDATION
    require(amountIn > 0, "Amount must be greater than 0");
    require(
        keccak256(bytes(spendTokenCode)) != keccak256(bytes(receiveTokenCode)),
        "Cannot swap same token"
    );
    
    // EXISTING LOGIC (unchanged)
    SwapValidation memory validation = _validateSwapParameters(...);
    require(validation.isValid, validation.errorReason);
    
    // ROUTING
    if (isWETHReceive) return _swapToWETH(...);
    else if (isWETHSpend) return _swapFromWETH(...);
    else return _swapTokenToToken(...);
}
```

### Pattern 3: Deadline Propagation Chain

**Problema:** Propagare deadline da user call fino a internal swap

**Soluzione:** Parameter threading attraverso call stack
```
User Call
    ↓ deadline parameter
withdrawWithDeadline(shares, deadline)
    ↓ pass through
_executeAutomaticSwap(wethNeeded, calculator, deadline)
    ↓ pass through
performSwap(spendToken, receiveToken, amount, deadline)
    ↓ validate & delegate
_performSwapInternal(spendToken, receiveToken, amount)
```

---

## 🔨 IMPLEMENTAZIONE DETTAGLIATA

### 1. SwapManager.sol - State Variables

```solidity
// ========== STATE VARIABLES ==========

/// @notice Default deadline window per operazioni automatiche
/// @dev Configurabile da owner, range: 1 min - 1 ora
uint256 public defaultDeadlineWindow = 20 minutes; // Industry standard

/// @notice Minimum deadline window permesso
uint256 public constant MIN_DEADLINE_WINDOW = 1 minutes;

/// @notice Maximum deadline window permesso
uint256 public constant MAX_DEADLINE_WINDOW = 1 hours;
```

### 2. SwapManager.sol - Configuration Functions

```solidity
// ========== CONFIGURAZIONE DEADLINE ==========

/**
 * @notice Imposta finestra default per deadline automatico
 * @dev Solo owner può modificare
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
```

### 3. SwapManager.sol - Refactored Swap Functions

```solidity
// ========== SWAP FUNCTIONS (REFACTORED) ==========

/**
 * @notice Esegue swap con deadline AUTOMATICO (backward compatibility)
 * @dev Usa defaultDeadlineWindow per calcolare deadline
 * @dev Questa funzione mantiene backward compatibility per caller esistenti
 * @param spendTokenCode Token da vendere
 * @param receiveTokenCode Token da ricevere
 * @param amountIn Quantità input
 * @return amountReceived Quantità ricevuta
 */
function performSwapAuto(
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
    // Calcola deadline automatico
    uint256 deadline = block.timestamp + defaultDeadlineWindow;
    
    // Delega a versione con deadline esplicito
    return performSwap(spendTokenCode, receiveTokenCode, amountIn, deadline);
}

/**
 * @notice Esegue swap con deadline ESPLICITO (MEV protected)
 * @dev Fornisce protezione MEV via deadline check
 * @param spendTokenCode Token da vendere
 * @param receiveTokenCode Token da ricevere
 * @param amountIn Quantità input
 * @param deadline Timestamp massimo per esecuzione (unix timestamp)
 * @return amountReceived Quantità ricevuta
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
    
    // Emetti evento se deadline stretto (< 5 min rimanente)
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
 * @notice Core swap logic (INTERNAL)
 * @dev Contiene tutta la logica di swap esistente
 * @dev NON include deadline check - MUST essere chiamato da wrapper
 * @param spendTokenCode Token da vendere
 * @param receiveTokenCode Token da ricevere
 * @param amountIn Quantità input
 * @return amountReceived Quantità ricevuta
 */
function _performSwapInternal(
    string memory spendTokenCode,
    string memory receiveTokenCode,
    uint256 amountIn
) internal returns (uint256 amountReceived) {
    // VALIDATE INPUT PARAMETERS
    require(amountIn > 0, "Amount must be greater than 0");
    require(
        keccak256(bytes(spendTokenCode)) != keccak256(bytes(receiveTokenCode)),
        "Cannot swap same token"
    );
    require(simpleSwapRouter != address(0), "SimpleSwap router not set");
    
    // PRE-SWAP VALIDATION
    SwapValidation memory validation = _validateSwapParameters(
        spendTokenCode, 
        receiveTokenCode, 
        amountIn
    );
    require(validation.isValid, validation.errorReason);
    
    // GET CONTRACT REFERENCES
    address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
    IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
    ISimpleSwap swapper = ISimpleSwap(simpleSwapRouter);
    
    // SPECIAL HANDLING FOR WETH (routing logic)
    if (keccak256(bytes(receiveTokenCode)) == keccak256(bytes("WETH"))) {
        return _swapToWETH(spendTokenCode, amountIn, validation, proxy, swapper);
    } else if (keccak256(bytes(spendTokenCode)) == keccak256(bytes("WETH"))) {
        return _swapFromWETH(receiveTokenCode, amountIn, validation, proxy, swapper);
    } else {
        return _swapTokenToToken(spendTokenCode, receiveTokenCode, amountIn, validation, proxy, swapper);
    }
}
```

### 4. SwapManager.sol - Events

```solidity
// ========== EVENTI ==========

/**
 * @notice Emesso quando default deadline window cambia
 * @param oldWindow Vecchia finestra in secondi
 * @param newWindow Nuova finestra in secondi
 */
event DefaultDeadlineWindowUpdated(uint256 oldWindow, uint256 newWindow);

/**
 * @notice Emesso quando swap ha deadline stretto (< 5 min)
 * @dev Utile per monitoring e alerting
 * @param caller Indirizzo caller
 * @param spendToken Token speso
 * @param receiveToken Token ricevuto
 * @param deadline Deadline timestamp
 * @param currentTime Block timestamp corrente
 */
event TightDeadlineWarning(
    address indexed caller,
    string spendToken,
    string receiveToken,
    uint256 deadline,
    uint256 currentTime
);
```

---

## 🔗 INTEGRAZIONE LIQUIDITY MANAGER

### 1. LiquidityManager.sol - Withdraw Functions

```solidity
// ========== WITHDRAW FUNCTIONS (REFACTORED) ==========

/**
 * @notice Withdraw con deadline ESPLICITO (MEV protected)
 * @dev Versione principale con full protezione MEV
 * @param _shares Quantità shares da bruciare
 * @param deadline Timestamp massimo per completare swap (se necessario)
 * @return netWithdraw Quantità ETH ricevuta (netta da fee)
 */
function withdrawWithDeadline(uint256 _shares, uint256 deadline) 
    external 
    nonReentrant 
    returns (uint256 netWithdraw) 
{
    // DEADLINE PRE-CHECK (fail fast)
    require(block.timestamp <= deadline, "Withdraw deadline expired");
    
    // VALIDATION SHARES
    require(_shares > 0, "Shares must be greater than 0");
    require(_shares <= balanceOf(msg.sender), "Insufficient shares");
    
    // EXISTING WITHDRAW LOGIC (unchanged)
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
    IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
    IValueCalculatorForModules calculator = IValueCalculatorForModules(
        IBeacon(beacon).getImplementation("ValueCalculator")
    );
    
    // CALCULATE WITHDRAW VALIDATION
    WithdrawValidation memory validation;
    validation.totalSupply = proxy.totalSupply();
    require(validation.totalSupply > 0, "No liquidity in pool");
    
    validation.totalValue = calculator.getTotalPoolValueInETH();
    validation.poolEthBalance = IERC20(wethAddress).balanceOf(proxyGeneral);
    
    // CALCULATE ETH AMOUNT
    validation.ethAmount = (_shares * validation.totalValue) / validation.totalSupply;
    
    // CHECK WITHDRAW LIMITS
    (bool canWithdrawLimits, string memory limitReason) = checkWithdrawLimits(
        msg.sender, 
        validation.ethAmount
    );
    require(canWithdrawLimits, limitReason);
    
    // CALCULATE FEE
    uint256 feeAmount = (validation.ethAmount * withdrawFee) / 10000;
    uint256 netWithdrawAmount = validation.ethAmount - feeAmount;
    
    // RATE LIMITING CHECK
    (bool rateLimitOk, , ) = proxy.checkRateLimit(
        msg.sender, 
        "withdraw", 
        validation.ethAmount
    );
    require(rateLimitOk, "Rate limit exceeded");
    proxy.trackOperation(msg.sender, "withdraw", validation.ethAmount);
    
    // RESERVE RATIO CHECK
    PoolReserveCheck memory reserveCheck;
    reserveCheck.currentReserveRatio = (validation.poolEthBalance * 10000) / validation.totalValue;
    require(
        reserveCheck.currentReserveRatio >= poolReserveRatio, 
        "Insufficient pool reserves"
    );
    
    // SWAP IF NECESSARY (WITH DEADLINE)
    if (validation.poolEthBalance < netWithdrawAmount) {
        validation.requiresSwap = true;
        validation.wethNeeded = netWithdrawAmount - validation.poolEthBalance;
        
        // EXECUTE SWAP CON DEADLINE PROPAGATION
        _executeAutomaticSwap(validation.wethNeeded, calculator, deadline);
        
        // VERIFY SWAP SUCCESS
        uint256 newWethBalance = IERC20(wethAddress).balanceOf(proxyGeneral);
        require(
            newWethBalance >= netWithdrawAmount,
            "Swap didn't provide enough WETH"
        );
    }
    
    // POST-WITHDRAW VALIDATION
    reserveCheck.postWithdrawBalance = validation.poolEthBalance - netWithdrawAmount;
    reserveCheck.postWithdrawValue = validation.totalValue - netWithdrawAmount;
    
    if (reserveCheck.postWithdrawValue > 0) {
        reserveCheck.postWithdrawRatio = (reserveCheck.postWithdrawBalance * 10000) / 
            reserveCheck.postWithdrawValue;
        require(
            reserveCheck.postWithdrawRatio >= poolReserveRatio, 
            "Would break reserve ratio"
        );
    }
    
    // BURN LP TOKENS
    proxy.burn(msg.sender, _shares);
    
    // TRANSFER WETH TO CONTRACT
    IWETH weth = IWETH(wethAddress);
    uint256 totalWethNeeded = netWithdrawAmount;
    if (feeAmount > 0 && feeRecipient != address(0)) {
        totalWethNeeded += feeAmount;
    }
    proxy.withdrawToken("WETH", totalWethNeeded, address(this));
    
    // UNWRAP WETH TO ETH
    weth.withdraw(totalWethNeeded);
    
    // TRANSFER ETH TO USER
    (bool success, ) = msg.sender.call{value: netWithdrawAmount}("");
    require(success, "ETH transfer failed");
    
    // TRANSFER FEE IF APPLICABLE
    if (feeAmount > 0 && feeRecipient != address(0)) {
        (bool feeSuccess, ) = feeRecipient.call{value: feeAmount}("");
        require(feeSuccess, "Fee transfer failed");
    }
    
    // FINAL VALIDATION
    require(
        proxy.totalSupply() == validation.totalSupply - _shares,
        "Invalid supply change"
    );
    
    emit Withdrawn(
        msg.sender,
        _shares,
        validation.ethAmount,
        validation.totalValue,
        IERC20(wethAddress).balanceOf(proxyGeneral)
    );
    
    return netWithdrawAmount;
}

/**
 * @notice Withdraw con deadline AUTOMATICO (backward compatibility)
 * @dev Wrapper che usa default deadline (20 min)
 * @param _shares Quantità shares da bruciare
 * @return netWithdraw Quantità ETH ricevuta (netta da fee)
 */
function withdraw(uint256 _shares) 
    external 
    nonReentrant 
    returns (uint256 netWithdraw) 
{
    // Calcola deadline automatico (20 minuti da ora)
    uint256 deadline = block.timestamp + 20 minutes;
    
    // Delega a versione con deadline
    return this.withdrawWithDeadline(_shares, deadline);
}
```

### 2. LiquidityManager.sol - Internal Swap Function

```solidity
/**
 * @notice Esegue automatic swap per ottenere WETH necessario
 * @dev Con deadline propagation per protezione MEV
 * @param wethNeeded Quantità WETH necessaria
 * @param calculator Reference ValueCalculator
 * @param deadline Timestamp massimo per swap
 */
function _executeAutomaticSwap(
    uint256 wethNeeded,
    IValueCalculatorForModules calculator,
    uint256 deadline
) internal {
    // SELEZIONA TOKEN CON PERCENTUALE PIÙ BASSA
    address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
    string[] memory activeTokens = ITokenManager(
        IBeacon(beacon).getImplementation("TokenManager")
    ).getActiveTokens();
    
    string memory tokenToSwap;
    uint256 lowestPercentage = type(uint256).max;
    
    for (uint256 i = 0; i < activeTokens.length; i++) {
        if (keccak256(bytes(activeTokens[i])) != keccak256(bytes("WETH"))) {
            uint256 tokenValue = calculator.getTokenValueInETH(activeTokens[i]);
            uint256 totalValue = calculator.getTotalPoolValueInETH();
            uint256 percentage = (tokenValue * 10000) / totalValue;
            
            if (percentage < lowestPercentage) {
                lowestPercentage = percentage;
                tokenToSwap = activeTokens[i];
            }
        }
    }
    
    require(bytes(tokenToSwap).length > 0, "No token available for swap");
    
    // CALCOLA AMOUNT TO SWAP
    uint256 tokenValue = calculator.getTokenValueInETH(tokenToSwap);
    uint256 totalValue = calculator.getTotalPoolValueInETH();
    uint256 tokenBalance = calculator.getTokenBalance(proxyGeneral, tokenToSwap);
    
    uint256 amountToSwap = (wethNeeded * tokenBalance * totalValue) / 
        (tokenValue * totalValue);
    
    // VALIDATE SWAP PARAMETERS
    ISwapManager swapper = ISwapManager(
        IBeacon(beacon).getImplementation("SwapManager")
    );
    
    (bool isValid, string memory errorReason) = swapper.validateSwapParameters(
        tokenToSwap,
        "WETH",
        amountToSwap
    );
    require(isValid, string(abi.encodePacked("Swap validation failed: ", errorReason)));
    
    // PERFORM SWAP CON DEADLINE (MEV PROTECTED)
    uint256 receivedWeth = swapper.performSwap(
        tokenToSwap, 
        "WETH", 
        amountToSwap,
        deadline  // ✅ DEADLINE PROPAGATION
    );
    
    // VALIDATE RECEIVED AMOUNT
    require(receivedWeth > 0, "Swap returned zero WETH");
    
    // EMIT EVENT
    emit TokenSwappedForWithdraw(tokenToSwap, amountToSwap, receivedWeth);
}
```

---

**Prossimo Documento:** [MEV_PROTECTION_TESTING.md](./MEV_PROTECTION_TESTING.md) - Piano Test & Migration Strategy
