# Dolomite Plugin - "Fake Swap" Design

## 🎯 Concept: Deposit as Swap

Il **DolomitePlugin** implementa `ISwapPlugin` per integrarsi perfettamente con **SwapManager** senza richiedere modifiche. Il trucco? **I depositi su Dolomite sono trattati come "swap"**.

### Fake Swap Mapping

```
SwapManager vede:      WETH → dWETH
DolomitePlugin fa:     deposit(WETH) → Dolomite balance
Risultato:             Plugin ha WETH depositato su Dolomite
```

```
SwapManager vede:      dWETH → WETH
DolomitePlugin fa:     withdraw(WETH) ← Dolomite balance
Risultato:             WETH prelevato e mandato al chiamante
```

---

## 🏗️ Architettura

### Token Sintetici (dTokens)

Per ogni token reale supportato (es. WETH, USDC), generiamo un **token sintetico** che rappresenta la posizione su Dolomite:

| Token Reale | Token Sintetico (dToken) | Indirizzo Sintetico |
|-------------|--------------------------|---------------------|
| WETH (`0x82aF...`) | dWETH | `0xd1a7...` (deterministic hash) |
| USDC (`0xaf88...`) | dUSDC | `0xd2b8...` (deterministic hash) |
| WBTC (`0x2f2a...`) | dWBTC | `0xd3c9...` (deterministic hash) |

**Importante**: I dTokens **NON sono ERC20 reali**. Sono indirizzi deterministici generati con:
```solidity
syntheticAddr = address(uint160(uint256(
    keccak256(abi.encodePacked("dolomite.", realTokenAddr))
)));
```

### Storage Mappings

```solidity
// Mapping: WETH → dWETH
mapping(address => address) public realToSynthetic;

// Mapping: dWETH → WETH
mapping(address => address) public syntheticToReal;
```

---

## 💡 Come Funziona

### 1. Registrazione Token (Setup)

Prima di usare un token, l'owner deve registrarlo:

```solidity
// Admin registra WETH
dolomitePlugin.registerToken(WETH);

// Internamente crea:
// realToSynthetic[WETH] = dWETH (0xd1a7...)
// syntheticToReal[dWETH] = WETH
```

### 2. Deposit (Fake Swap: WETH → dWETH)

```solidity
// User/Contract chiama SwapManager
swapManager.performSwap(
    "WETH",    // spendTokenCode
    "dWETH",   // receiveTokenCode (synthetic!)
    1 ether,   // amountIn
    deadline
);

// SwapManager:
// 1. Resolve token addresses via TokenManager
//    WETH = 0x82aF... (real)
//    dWETH = 0xd1a7... (synthetic, registrato in TokenManager)
// 
// 2. Query getAllQuotes() per best plugin
//    - UniswapV3Plugin: "Non supporto WETH → 0xd1a7..." → skip
//    - DolomitePlugin: "Supporto! È un deposit" → quote = 1:1
//
// 3. Esegue swap tramite DolomitePlugin.inputSwap()

// DolomitePlugin.inputSwap(WETH, dWETH, 1 ether):
// 1. Riconosce: realToSynthetic[WETH] == dWETH → isDeposit = true
// 2. transferFrom(swapManager, this, 1 ether WETH)
// 3. approve(depositRouter, 1 ether)
// 4. depositRouter.depositERC20(accountNumber=0, marketId=WETH, 1 ether)
// 5. emit DolomiteDeposit(...)
// 6. return 1 ether (1:1 ratio, no slippage)

// Risultato:
// - SwapManager ha ricevuto "1 dWETH" (concettualmente)
// - Plugin ha 1 WETH depositato su Dolomite account #0
// - SwapManager tracking mostra "swap executed"
```

### 3. Withdraw (Fake Swap: dWETH → WETH)

```solidity
// User/Contract chiama SwapManager per "swap back"
swapManager.performSwap(
    "dWETH",   // spendTokenCode (synthetic)
    "WETH",    // receiveTokenCode (real)
    1 ether,   // amountIn
    deadline
);

// DolomitePlugin.inputSwap(dWETH, WETH, 1 ether):
// 1. Riconosce: syntheticToReal[dWETH] == WETH → isWithdraw = true
// 2. Query balance su Dolomite: getAccountWei(this, 0, WETH_marketId)
// 3. Verifica: balance >= 1 ether
// 4. depositRouter.withdrawERC20(0, WETH_marketId, 1 ether, BalanceCheckFlag.From)
// 5. transfer(swapManager, 1 ether WETH)
// 6. emit DolomiteWithdrawal(...)
// 7. return 1 ether

// Risultato:
// - SwapManager ha ricevuto 1 WETH reale
// - Plugin ha prelevato 1 WETH da Dolomite
// - Balance su Dolomite diminuito di 1 WETH
```

---

## 🔌 Integrazione con SwapManager

### Zero Modifiche Richieste!

Il DolomitePlugin si integra **seamlessly** perché:

1. ✅ **Implementa `ISwapPlugin`** (extends `ISimpleSwap`)
   - `inputSwap()`: Deposit o withdraw
   - `outputSwap()`: Non supportato (revert)
   - `getExpectedOutput()`: Sempre 1:1

2. ✅ **Implementa metadata functions**
   - `getProtocolInfo()`: Nome "Dolomite Lending", features = BASIC_SWAP
   - `supportsTokenPair(A, B)`: True se A→B è deposit o withdraw valido
   - `isHealthy()`: Verifica Dolomite routers

3. ✅ **Registrato nel Beacon** come gli altri plugin
   ```solidity
   beacon.upgradeImplementation("DolomitePlugin", pluginAddress);
   ```

4. ✅ **Compatibile con getAllQuotes()**
   ```solidity
   // SwapManager query multiple plugins
   QuoteResult[] memory quotes = swapManager.getAllQuotes("WETH", "dWETH", 1 ether);
   
   // Result:
   // quotes[0] = { pluginName: "UniswapV3Plugin", success: false, reason: "Pair not supported" }
   // quotes[1] = { pluginName: "DolomitePlugin", success: true, expectedOutput: 1 ether }
   
   // SwapManager seleziona DolomitePlugin!
   ```

5. ✅ **Best price selection automatica**
   - Se ci fossero altri lending plugins (Aave, Compound), SwapManager li compara
   - Deposito con APY più alto vince automaticamente

---

## 📊 Esempio Completo: Vault Strategy

Immagina uno smart contract che gestisce una strategia di yield farming:

```solidity
contract YieldVault {
    IBeacon public beacon;
    ISwapManagerForModules public swapManager;
    ITokenManagerForModules public tokenManager;
    
    function depositToHighestYield(uint256 wethAmount) external {
        // 1. User deposita WETH nel vault
        IERC20(WETH).transferFrom(msg.sender, address(this), wethAmount);
        
        // 2. Approva SwapManager
        IERC20(WETH).approve(address(swapManager), wethAmount);
        
        // 3. "Swap" WETH → dWETH (deposit su Dolomite)
        uint256 dWethReceived = swapManager.performSwapAuto(
            "WETH",
            "dWETH",  // Synthetic token per Dolomite
            wethAmount
        );
        
        // 4. SwapManager ha scelto il miglior plugin (Dolomite ha vinto!)
        // 5. WETH è ora depositato su Dolomite e genera yield
        
        // Tracking interno
        userShares[msg.sender] += dWethReceived;
    }
    
    function withdrawFromDolomite(uint256 shares) external {
        require(userShares[msg.sender] >= shares, "Insufficient shares");
        
        // 1. "Swap" dWETH → WETH (withdraw da Dolomite)
        uint256 wethReceived = swapManager.performSwapAuto(
            "dWETH",  // Synthetic token
            "WETH",
            shares
        );
        
        // 2. Manda WETH all'utente
        IERC20(WETH).transfer(msg.sender, wethReceived);
        
        userShares[msg.sender] -= shares;
    }
}
```

**Vantaggi:**
- ✅ Vault non sa che sta usando Dolomite (abstraction)
- ✅ Se domani aggiungiamo AavePlugin, Vault usa automaticamente il migliore
- ✅ SwapManager gestisce slippage, deadline, error handling
- ✅ Zero duplicazione di logica

---

## 🔧 Setup & Configuration

### 1. Deploy DolomitePlugin

```bash
npx hardhat run scripts/deployDolomitePlugin.ts --network arbitrum
# Output: DolomitePlugin deployed at 0x...
```

### 2. Register in Beacon

```solidity
beacon.upgradeImplementation("DolomitePlugin", pluginAddress);
```

### 3. Register Tokens

```solidity
// Owner di DolomitePlugin registra WETH
dolomitePlugin.registerToken(WETH_ADDRESS);

// Ottieni synthetic address
address dWETH = dolomitePlugin.getSyntheticToken(WETH_ADDRESS);
// dWETH = 0xd1a7... (deterministic)
```

### 4. Register Synthetic Tokens in TokenManager

```solidity
// Owner di TokenManager registra dWETH come token
tokenManager.addToken(
    "dWETH",          // code
    dWETH,            // address (synthetic)
    18,               // decimals (same as WETH)
    CHAINLINK_WETH    // oracle (usa stesso di WETH)
);
```

### 5. Test Deposit

```solidity
// In un contratto o script
swapManager.performSwap(
    "WETH",
    "dWETH",
    1 ether,
    block.timestamp + 600
);

// Verifica balance su Dolomite
int256 balance = dolomitePlugin.getDolomiteBalance(WETH);
console.log("Dolomite balance:", balance); // 1 ether
```

---

## 🎯 Vantaggi del Design

### 1. **Riuso Completo di SwapManager**
- ✅ Best price selection tra lending protocols
- ✅ Slippage protection (anche se Dolomite è 1:1)
- ✅ Deadline enforcement
- ✅ Error handling robusto
- ✅ Event tracking (`SwapExecuted`)

### 2. **Estendibilità**
- ✅ Facile aggiungere altri lending: AavePlugin, CompoundPlugin
- ✅ SwapManager confronta yield APY automaticamente
- ✅ User/contracts non cambiano codice

### 3. **Sicurezza**
- ✅ Reentrancy protection da SwapManager
- ✅ Circuit breaker per emergenze
- ✅ Balance checks su Dolomite
- ✅ Custody pattern chiaro

### 4. **UX**
- ✅ Interfaccia uniforme ("swap" invece di "deposit/withdraw")
- ✅ Compatibile con dApp esistenti che usano SwapManager
- ✅ Synthetic tokens tracciabili come normali ERC20

---

## 🚧 Limitazioni & Future Work

### Limitazioni Attuali

1. **1:1 Ratio Only**
   - Dolomite deposit/withdraw è sempre 1:1 (no fees)
   - Se ci fossero fees, `getExpectedOutput()` dovrebbe calcolarli

2. **No Borrow Positions**
   - Fase 1: Solo deposit/withdraw
   - Fase 2: Aggiungere "fake swaps" per borrow
     - Es: `WETH → dWETH-BORROW-USDC` = apri posizione borrow

3. **Synthetic Token Balances**
   - dTokens non sono ERC20 reali
   - Non puoi fare `balanceOf(user)` direttamente
   - Balance esiste solo su Dolomite, trackato dal plugin

### Future Enhancements

#### Fase 2: Borrow Positions as Swaps

```solidity
// "Swap" che apre borrow position
swapManager.performSwap(
    "WETH",                    // collateral
    "dWETH-BORROW-USDC",       // synthetic: posizione con WETH collat, USDC debt
    1 ether,                   // collateral amount
    deadline
);

// Plugin internamente:
// 1. Deposit 1 WETH su account #0
// 2. openBorrowPosition: muovi WETH da #0 a #1
// 3. Borrow 1500 USDC su #1
// 4. Withdraw 1500 USDC da #0
// 5. Transfer 1500 USDC a caller
```

#### Fase 3: Yield Optimization

```solidity
// SwapManager confronta APY tra protocols
getAllQuotes("WETH", "dWETH", 1 ether);

// Results:
// - DolomitePlugin: 3.2% APY
// - AavePlugin: 2.8% APY
// - CompoundPlugin: 3.0% APY

// SwapManager sceglie Dolomite (highest yield)!
```

---

## 📝 Codice Chiave

### InputSwap Logic

```solidity
function inputSwap(
    address spendToken,
    address receiveToken,
    uint256 amountIn
) external returns (uint256 amountOut) {
    // Detect direction
    bool isDeposit = (realToSynthetic[spendToken] == receiveToken);
    bool isWithdraw = (syntheticToReal[spendToken] == receiveToken);
    
    if (!isDeposit && !isWithdraw) {
        revert InvalidSwapDirection(spendToken, receiveToken);
    }
    
    if (isDeposit) {
        // DEPOSIT: real token → synthetic token
        return _executeDeposit(spendToken, receiveToken, amountIn);
    } else {
        // WITHDRAW: synthetic token → real token
        return _executeWithdraw(spendToken, receiveToken, amountIn);
    }
}
```

### Synthetic Token Generation

```solidity
function _generateSyntheticAddress(address realToken) internal pure returns (address) {
    // Deterministic hash: dolomite.{realToken}
    bytes32 hash = keccak256(abi.encodePacked(
        keccak256("dolomite."),  // SYNTHETIC_PREFIX
        realToken
    ));
    
    // Convert hash to address
    return address(uint160(uint256(hash)));
}

// Example:
// WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
// dWETH = 0xd1a7... (deterministic, sempre uguale)
```

---

## 🎉 Conclusione

Il **"Fake Swap" design** è geniale perché:

1. ✅ **Riusa infrastruttura esistente** (SwapManager) senza modifiche
2. ✅ **Abstraction perfetta**: Deposit = Swap to synthetic token
3. ✅ **Estendibile**: Facile aggiungere altri lending protocols
4. ✅ **Best price selection**: SwapManager compara yield APY
5. ✅ **Sicuro**: Tutti i security checks di SwapManager applicati

**Next Steps:**
1. Deploy DolomitePlugin
2. Register in Beacon
3. Register synthetic tokens (dWETH, dUSDC, etc.)
4. Test deposit/withdraw via SwapManager
5. Build yield optimization strategies! 🚀
