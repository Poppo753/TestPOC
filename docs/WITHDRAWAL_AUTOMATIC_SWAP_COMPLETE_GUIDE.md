# 🔄 Guida Completa: Withdrawal con Automatic Swap

## 📋 Indice
1. [Problema Iniziale](#problema-iniziale)
2. [Architettura del Sistema](#architettura-del-sistema)
3. [Registrazione e Configurazione Token](#registrazione-e-configurazione-token)
4. [Flow Completo del Withdrawal](#flow-completo-del-withdrawal)
5. [Errori Risolti](#errori-risolti)
6. [Deployment Addresses](#deployment-addresses)
7. [Riassunto Finale](#riassunto-finale)

---

## 🔍 Problema Iniziale

**Sintomo**: Il withdrawal con automatic swap falliva con l'errore:
```
❌ "Insufficient liquidity for target value"
```

**Causa Root**: Multipli bug concatenati nel sistema di pricing e swap automatico.

---

## 🏗️ Architettura del Sistema

### Contratti Coinvolti nel Withdrawal

```
User
  ↓ withdraw(shares)
LiquidityManager
  ↓ getTotalPoolValue()
  ↓ selectTokenForSwap(targetValue)
ValueCalculator
  ↓ getTokenPrice()
TokenManager
  ↓ getPrice()
ChainlinkAdapter (Oracle)
  ↓ latestRoundData()
Chainlink Feed
  ↓ performSwap()
SwapManager
  ↓ exactInputSingle()
UniswapV3Plugin
  ↓ swap()
Uniswap V3 Pool
```

---

## 🎯 Registrazione e Configurazione Token

### 1️⃣ **ChainlinkAdapter** (Oracle System)

**Dove**: `contracts/adapters/ChainlinkAdapter.sol`

**Funzione**: `setPriceFeed(string tokenCode, address feedAddress, uint8 decimals, uint256 heartbeat, string denomination)`

**Parametri Importanti**:
- `tokenCode`: Nome del token (es. "USDC", "WBTC")
- `feedAddress`: Indirizzo del Chainlink Price Feed
- `decimals`: Decimali del feed (tipicamente 8 per Chainlink)
- `heartbeat`: Massimo tempo senza aggiornamenti (secondi)
- `denomination`: Valuta del feed ("USD", "ETH", "BTC")

**Esempio Configurazione**:
```javascript
// USDC/USD feed
await chainlinkAdapter.setPriceFeed(
  "USDC",
  "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", // Chainlink USDC/USD su Arbitrum
  8,        // decimals
  86400,    // 24h heartbeat (stablecoin)
  "USD"     // denomination
);

// WBTC/USD feed  
await chainlinkAdapter.setPriceFeed(
  "WBTC",
  "0xd0C7101eACbB49F3deCcCc166d238410D6D46d57", // Chainlink WBTC/USD su Arbitrum
  8,        // decimals
  3600,     // 1h heartbeat
  "USD"     // denomination
);
```

**⚙️ Conversion Setup** (USD → ETH):
```javascript
// Configura reference feed per conversione USD→ETH
await chainlinkAdapter.setReferenceFeed(
  "USD",                                          // denomination da convertire
  "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // ETH/USD feed
  8,                                             // decimals
  3600                                           // heartbeat
);

// Imposta target denomination
await chainlinkAdapter.setTargetDenomination("ETH");
```

**📊 Heartbeat per Tipo di Token**:
- **Stablecoin** (USDC, USDT, DAI): `86400` (24 ore) - aggiornamenti rari
- **BTC, ETH**: `3600` (1 ora) - più volatili
- **Altcoin**: `1800` (30 min) - molto volatili

---

### 2️⃣ **TokenManager** (Token Registry)

**Dove**: `contracts/TokenManager.sol`

**Funzione**: `addToken(string tokenCode, address tokenAddress, uint8 decimals, uint256 minBalance, uint256 maxBalance)`

**Parametri**:
- `tokenCode`: Stesso nome usato in ChainlinkAdapter
- `tokenAddress`: Address del token ERC20
- `decimals`: Decimali del token (6 per USDC, 8 per WBTC, 18 per ETH)
- `minBalance`: Balance minimo consentito (0 = no limit)
- `maxBalance`: Balance massimo consentito

**Esempio**:
```javascript
const tokenManager = await ethers.getContractAt("TokenManager", TOKEN_MANAGER_ADDRESS);

// Registra USDC
await tokenManager.addToken(
  "USDC",
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC su Arbitrum
  6,                                             // decimals
  0,                                             // no minBalance
  ethers.parseUnits("1000000", 6)               // max 1M USDC
);

// Registra WBTC
await tokenManager.addToken(
  "WBTC",
  "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", // WBTC su Arbitrum
  8,                                             // decimals
  0,                                             // no minBalance
  ethers.parseUnits("100", 8)                    // max 100 WBTC
);
```

**⚠️ WETH è Speciale**:
WETH **NON** deve essere registrato nel TokenManager perché è gestito direttamente dal Beacon:
```javascript
// WETH è nel Beacon, non nel TokenManager!
const wethAddress = await beacon.getImplementation("WETH");
```

**🔗 Link Oracle**:
```javascript
// Collega TokenManager all'Oracle Adapter
await tokenManager.setOracleAdapter(CHAINLINK_ADAPTER_ADDRESS);
```

---

### 3️⃣ **ValueCalculator** (Value & Swap Logic)

**Dove**: `contracts/ValueCalculator.sol`

**Configurazione `maxPriceAge`**:
```javascript
const valueCalculator = await ethers.getContractAt("ValueCalculator", VALUE_CALCULATOR_ADDRESS);

// CRITICO: Deve essere >= del massimo heartbeat dei token!
await valueCalculator.setMaxPriceAge(86400); // 24 ore per supportare stablecoin
```

**❌ Errore Comune**:
```javascript
// SBAGLIATO - maxPriceAge troppo corto
maxPriceAge = 3600;  // 1 ora
heartbeat USDC = 86400; // 24 ore
// Risultato: "Price not reliable" perché USDC non si aggiorna ogni ora!
```

**✅ Configurazione Corretta**:
```javascript
// maxPriceAge deve essere >= del heartbeat più lungo
maxPriceAge = 86400; // 24 ore (copre tutti i token inclusi stablecoin)
```

---

### 4️⃣ **ProxyGeneral** (Authorization)

**Dove**: `contracts/ProxyGeneral.sol`

**Autorizzazione Moduli**:
```javascript
const proxyGeneral = await ethers.getContractAt("ProxyGeneral", PROXY_GENERAL_ADDRESS);

// Autorizza LiquidityManager a chiamare ProxyGeneral
await proxyGeneral.authorizeModule(
  LIQUIDITY_MANAGER_ADDRESS,
  "LiquidityManager"
);
```

**⚠️ Critico**: Dopo ogni redeploy del LiquidityManager, devi riautorizzarlo!

---

### 5️⃣ **SwapManager & Plugin** (Swap Execution)

**Configurazione Plugin**:
```javascript
const swapManager = await ethers.getContractAt("SwapManager", SWAP_MANAGER_ADDRESS);

// Attiva UniswapV3Plugin
await swapManager.setActivePlugin("UniswapV3Plugin");

// Abilita swaps
await swapManager.setSwapsEnabled(true);
```

**Token Approvals** (nel Plugin):
```javascript
const uniswapPlugin = await ethers.getContractAt("UniswapV3Plugin", PLUGIN_ADDRESS);

// Approva token per Uniswap Router
await uniswapPlugin.approveTokenForSwap("USDC", ethers.MaxUint256);
await uniswapPlugin.approveTokenForSwap("WBTC", ethers.MaxUint256);
```

---

## 🔄 Flow Completo del Withdrawal

### Step 1: User Calls `withdraw(shares)`

```solidity
// User → LiquidityManager
liquidityManager.withdraw(shares);
```

### Step 2: Calculate ETH Amount

```solidity
// LiquidityManager calcola quanto ETH l'utente dovrebbe ricevere
ethAmount = (shares * totalPoolValue) / totalSupply;
netWithdraw = ethAmount - feeAmount;
```

### Step 3: Check WETH Balance

```solidity
poolEthBalance = WETH.balanceOf(proxyGeneral);

if (poolEthBalance < netWithdraw) {
    // Serve swap automatico!
    requiresSwap = true;
    wethNeeded = netWithdraw - poolEthBalance;
}
```

### Step 4: Select Token for Swap

```solidity
// LiquidityManager → ValueCalculator
(tokenCode, amount) = valueCalculator.selectTokenForSwap(wethNeeded);
```

**MULTI-SWAP LOOP** (Nuovo!):

Il sistema ora esegue **multiple swap** in loop fino a ottenere abbastanza WETH:

```solidity
while (wethStillNeeded > 0 && iteration < 10) {
    // 1. Check if we have enough WETH now
    currentWeth = WETH.balanceOf(proxyGeneral);
    if (currentWeth >= wethNeeded) BREAK;
    
    // 2. Select next token to swap
    (tokenCode, amount) = selectTokenForSwap(wethStillNeeded);
    
    // 3. If no more tokens available
    if (tokenCode == "" || amount == 0) {
        // Check if we have at least 97% of target
        if (totalObtained >= wethNeeded * 0.97) ACCEPT;
        else REVERT;
    }
    
    // 4. Execute swap
    receivedWeth = performSwap(tokenCode, "WETH", amount);
    
    // 5. Update counters
    totalObtained += receivedWeth;
    wethStillNeeded -= receivedWeth;
    iteration++;
}
```

**Eventi Multi-Swap**:
- `MultiSwapStarted(user, wethNeeded, maxIterations)`
- `MultiSwapIteration(user, iteration, token, amount, received, stillNeeded)`
- `MultiSwapCompleted(user, totalIterations, totalWethObtained)`

**Logica `selectTokenForSwap()`**:

1. **Get Active Tokens**: Prende solo token registrati nel TokenManager (non WETH!)
2. **Calculate Values**: 
   ```solidity
   tokenValue = (tokenBalance * price) / (10 ** tokenDecimals);
   ```
3. **Calculate Percentages**: Basate su `swappableValue` (non `totalPoolValue`!)
   ```solidity
   swappableValue = sum(values of non-WETH tokens);
   percentage = (tokenValue * 10000) / swappableValue;
   ```
4. **Sort by Percentage**: Token con % più bassa prima (per preservare diversificazione)
5. **Select with Buffer Logic**:
   - Prova con 10% buffer
   - Se non basta, prova 5% buffer
   - Se non basta, prova 0% buffer (exact amount)
   - Se token value >= 95% del target, usa **tutto il balance**
6. **Last Resort**: Se nessun token ha sufficiente balance, ritorna token con valore più alto usando **tutto il balance**
7. **No Tokens**: Ritorna `("", 0)` per segnalare al multi-swap che non ci sono più token

**🐛 Bug Originale**:
```solidity
// SBAGLIATO (vecchia versione)
percentage = (tokenValue * 10000) / totalPoolValue; // Include WETH!
targetWithBuffer = targetValue * 1.10; // Sempre 10% buffer
if (requiredAmount > balance) revert; // Non flessibile
```

**✅ Fix Applicato**:
```solidity
// CORRETTO (nuova versione)
percentage = (tokenValue * 10000) / swappableValue; // Solo token swappabili!

// Buffer intelligente
if (requiredAmountWith10Buffer <= balance) return (token, requiredAmountWith10Buffer);
if (requiredAmountWith5Buffer <= balance) return (token, requiredAmountWith5Buffer);
if (requiredAmountExact <= balance) return (token, requiredAmountExact);
if (tokenValue >= targetValue * 0.95) return (token, balance); // Usa tutto!
```

### Step 5: Execute Swap

```solidity
// LiquidityManager → SwapManager → UniswapV3Plugin
receivedWeth = swapManager.performSwap(tokenCode, "WETH", amount, deadline);
```

**Swap Flow**:
1. SwapManager valida parametri
2. Chiama plugin attivo (UniswapV3Plugin)
3. Plugin esegue swap su Uniswap V3
4. WETH ritorna al ProxyGeneral

### Step 6: Verify Swap Success

```solidity
// Get actual WETH balance after all swaps
newWethBalance = WETH.balanceOf(proxyGeneral);

// Multi-swap already handles slippage internally, so just adjust if needed
if (newWethBalance < netWithdraw) {
    netWithdraw = newWethBalance; // Use whatever we got
}

// Update poolEthBalance
poolEthBalance = newWethBalance;
```

**🆕 Gestione Multi-Swap**:
- Il multi-swap loop gestisce la slippage tolerance internamente
- Se non riesce a ottenere il 100% del target, accetta >= 97%
- Se ha swappato tutti i token disponibili, usa tutto quello ottenuto
- Il `netWithdraw` viene aggiustato a quanto effettivamente disponibile

**🐛 Bug Originale**:
```solidity
// SBAGLIATO - non aggiornava poolEthBalance dopo swap
postWithdrawBalance = poolEthBalance - netWithdraw;
// poolEthBalance era ancora 0, netWithdraw era 0.001 ETH
// Risultato: UNDERFLOW! ❌
```

**✅ Fix Applicato**:
```solidity
// CORRETTO - aggiorna poolEthBalance dopo swap
poolEthBalance = newWethBalance;
postWithdrawBalance = poolEthBalance - netWithdraw; // OK! ✅
```

### Step 7: Burn LP & Transfer WETH

```solidity
// Burn LP tokens
proxy.burn(msg.sender, shares);

// Transfer WETH to LiquidityManager
proxy.withdrawToken("WETH", totalWethNeeded, address(this));

// Unwrap WETH → ETH
weth.withdraw(netWithdraw);

// Send ETH to user
(bool success, ) = msg.sender.call{value: netWithdraw}("");
require(success, "ETH transfer failed");
```

---

## 🐛 Errori Risolti

### Errore #1: "Price not reliable"

**Causa**: 
```javascript
// ValueCalculator.maxPriceAge = 3600 (1 ora)
// USDC Chainlink heartbeat = 86400 (24 ore)
// USDC non si aggiorna ogni ora → prezzo "troppo vecchio"
```

**Soluzione**:
```javascript
await valueCalculator.setMaxPriceAge(86400); // 24 ore
```

**Dove Configurare**:
- `maxPriceAge` in **ValueCalculator**
- `heartbeat` per ogni token in **ChainlinkAdapter.setPriceFeed()**

---

### Errore #2: "Insufficient liquidity for target value"

**Causa**: Formula sbagliata in `selectTokenForSwap()`:
1. Usava `totalPoolValue` (include WETH) invece di `swappableValue`
2. Buffer fisso 10% anche quando token aveva solo 100% del target disponibile
3. Non gestiva caso in cui serve swappare quasi tutto

**Esempio Numerico**:
```
Total Pool Value = 0.001208 ETH (include WETH)
USDC value = 0.001208 ETH (100% del pool)
WBTC value = 0 ETH
WETH = 0 ETH (già swappato)

Target needed = 0.001208 ETH
With 10% buffer = 0.001329 ETH

USDC available = 0.001208 ETH < 0.001329 ETH
Risultato: "Insufficient liquidity" ❌
```

**Soluzione**: 
- Calcola percentuali solo su token swappabili (non WETH)
- Buffer intelligente: 10% → 5% → 0% → usa tutto il balance
- Se token value >= 95% del target, swappa **tutto**

---

### Errore #3: "Swap didn't provide enough WETH"

**Causa**: Swap produceva meno WETH del target a causa dello slippage, ma il check era troppo rigido.

**Esempio**:
```
netWithdraw = 0.001208 ETH
Swap USDC → WETH con 3% slippage
Received = 0.001200 ETH
0.001200 < 0.001208 → FAIL! ❌
```

**Soluzione**:
```solidity
// Accept se >= 97% del target
minAcceptable = (netWithdraw * 97) / 100;
require(newWethBalance >= minAcceptable);

// Aggiusta netWithdraw a quanto effettivamente ricevuto
if (newWethBalance < netWithdraw) {
    netWithdraw = newWethBalance;
}
```

---

### Errore #4: "arithmetic underflow or overflow"

**Causa**: 
```solidity
// poolEthBalance era ancora il valore PRIMA dello swap (0 ETH)
// netWithdraw era 0.001208 ETH
postWithdrawBalance = poolEthBalance - netWithdraw;
// 0 - 0.001208 = UNDERFLOW! ❌
```

**Soluzione**:
```solidity
// DOPO lo swap, aggiorna poolEthBalance
poolEthBalance = newWethBalance;

// ORA il calcolo funziona
postWithdrawBalance = poolEthBalance - netWithdraw; // OK! ✅
```

---

### Errore #5: "Caller not authorized"

**Causa**: Dopo redeploy del LiquidityManager, non era più autorizzato nel ProxyGeneral.

**Soluzione**:
```javascript
await proxyGeneral.authorizeModule(
  NEW_LIQUIDITY_MANAGER_ADDRESS,
  "LiquidityManager"
);
```

**⚠️ Importante**: Ogni volta che rideployi un modulo, devi riautorizzarlo!

---

## 📍 Deployment Addresses (Arbitrum Mainnet)

### Contratti Aggiornati (Post-Fix + Multi-Swap)

```javascript
// Core System
Beacon: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870"
ProxyGeneral: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1"

// Oracle System
ChainlinkAdapter (NEW): "0x018f6392eb912624930d68c3c226b707B1D8B2A7"
TokenManager: "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517"

// Value & Swap
ValueCalculator (MULTI-SWAP): "0x2E042874BcFc6bE51e0D6b23F8Da22bDd8B215B0"
LiquidityManager (MULTI-SWAP): "0xfb26C7A0CF5b4e86Dcf870b2349A29DA4F630150"
SwapManager: "0xA1b7B8C442c3c1F342BB9C44b7d0733D0c9Ff357"
UniswapV3Plugin: "0x6E775865308E1C1C1aa0a08c31F2aF799D50801a"

// Tokens
WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
```

### Chainlink Price Feeds (Arbitrum)

```javascript
// Price Feeds
USDC/USD: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3"
WBTC/USD: "0xd0C7101eACbB49F3deCcCc166d238410D6D46d57"
ETH/USD: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612" // Reference feed
```

---

## 📊 Riassunto Finale

### ✅ Checklist Configurazione Completa

#### 1. **Oracle Setup**
- [ ] Deploy ChainlinkAdapter
- [ ] Per ogni token:
  - [ ] `setPriceFeed(tokenCode, feedAddress, decimals, heartbeat, "USD")`
  - [ ] Heartbeat: 86400 per stablecoin, 3600 per volatile
- [ ] Configura conversion:
  - [ ] `setReferenceFeed("USD", ethUsdFeed, 8, 3600)`
  - [ ] `setTargetDenomination("ETH")`

#### 2. **Token Registry**
- [ ] Per ogni token (tranne WETH):
  - [ ] `tokenManager.addToken(tokenCode, address, decimals, minBalance, maxBalance)`
- [ ] Link Oracle: `tokenManager.setOracleAdapter(chainlinkAdapterAddress)`

#### 3. **Value Calculator**
- [ ] Deploy ValueCalculator
- [ ] `setMaxPriceAge(86400)` - DEVE essere >= massimo heartbeat!

#### 4. **Liquidity Manager**
- [ ] Deploy LiquidityManager
- [ ] Autorizza: `proxyGeneral.authorizeModule(liquidityManager, "LiquidityManager")`

#### 5. **Swap System**
- [ ] Configura SwapManager:
  - [ ] `setActivePlugin("UniswapV3Plugin")`
  - [ ] `setSwapsEnabled(true)`
- [ ] Approva token nel plugin:
  - [ ] `uniswapPlugin.approveTokenForSwap(tokenCode, MaxUint256)`

#### 6. **Beacon Updates**
- [ ] Update implementations:
  - [ ] `beacon.updateImplementation("ChainlinkAdapter", newAddress)`
  - [ ] `beacon.updateImplementation("ValueCalculator", newAddress)`
  - [ ] `beacon.updateImplementation("LiquidityManager", newAddress)`

---

### 🎯 Parametri Critici da Ricordare

| Parametro | Dove | Valore Consigliato | Perché |
|-----------|------|-------------------|--------|
| **heartbeat** | ChainlinkAdapter.setPriceFeed() | 86400 (stablecoin)<br>3600 (BTC/ETH) | Frequenza aggiornamenti Chainlink |
| **maxPriceAge** | ValueCalculator | 86400 (24h) | Deve essere >= max heartbeat |
| **decimals** | TokenManager.addToken() | 6 (USDC)<br>8 (WBTC)<br>18 (ETH) | Decimali nativi del token |
| **slippage** | LiquidityManager (hardcoded) | 3% | Tolerance per swap automatico |
| **targetDenomination** | ChainlinkAdapter | "ETH" | Tutti i prezzi convertiti in ETH |

---

### 🔧 Comandi Quick Reference

```bash
# 1. Setup Oracle
npx hardhat run scripts/deploy/DeployOracleAdapter.ts --network arbitrum
npx hardhat run scripts/config/ConfigureOraclePriceFeeds.ts --network arbitrum

# 2. Setup Token Registry
npx hardhat run scripts/config/RegisterTokens.ts --network arbitrum

# 3. Deploy & Configure ValueCalculator
npx hardhat run scripts/deploy/RedeployValueCalculator.ts --network arbitrum
npx hardhat run scripts/config/UpdateMaxPriceAge.ts --network arbitrum

# 4. Deploy & Authorize LiquidityManager
npx hardhat run scripts/deploy/RedeployLiquidityManager.ts --network arbitrum
npx hardhat run scripts/config/AuthorizeLiquidityManager.ts --network arbitrum

# 5. Test Withdrawal
npx hardhat run scripts/e2e/WithdrawAll.ts --network arbitrum
```

---

### 💡 Lezioni Apprese

1. **WETH è Speciale**: Non registrarlo nel TokenManager, è nel Beacon!

2. **maxPriceAge vs heartbeat**: `maxPriceAge` deve sempre essere >= del heartbeat più lungo!

3. **Percentuali su Token Swappabili**: Non includere WETH nel calcolo delle percentuali per `selectTokenForSwap()`

4. **Buffer Intelligente**: Non usare sempre 10%, scala dinamicamente basandosi sulla disponibilità

5. **Slippage Tolerance**: Accetta swap che danno >= 97% del target, non esattamente 100%

6. **Aggiorna State Dopo Swap**: Ricorda di aggiornare `poolEthBalance` dopo lo swap per evitare underflow!

7. **Autorizzazione Moduli**: Dopo ogni redeploy, riautorizza nel ProxyGeneral!

---

### ✅ Risultato Finale

✅ **Withdrawal con Automatic MULTI-SWAP Funziona Perfettamente!**

**Transaction di Successo** (Single Token): `0x85a6f85d6c2848580162ba36f56989be97ddbd89cdfba196fcb94edaa1950118`

**Flow Single Token**:
1. User chiama `withdraw(0.000853 LP)`
2. Sistema calcola: serve 0.001204 ETH
3. Pool ha 0 WETH, 3.543565 USDC
4. Automatic swap: 3.543565 USDC → 0.001200 WETH (3% slippage)
5. WETH unwrapped → ETH
6. ETH inviato all'utente
7. LP tokens burned

**Transaction di Successo** (Multi Token): `0x6fc4b244044ac41bd2ed0279fb804736088abb276f0a62fe09ac3dbd040316d1`

**Flow Multi-Token**:
1. User chiama `withdraw(0.001 LP)`
2. Sistema calcola: serve ~0.00099 ETH
3. Pool ha 0.0004 WETH, 0.88 USDC, 0.00001 WBTC
4. **Multi-swap automatico**:
   - Iteration 1: Swap WBTC → WETH
   - Iteration 2: Swap USDC → WETH
   - Iteration 3: Check WETH sufficiente → STOP
5. WETH unwrapped → ETH
6. ETH inviato all'utente
7. LP tokens burned

**✨ Sistema Completo: Automatic Single OR Multi-Swap, zero intervento manuale!**

---

## 📚 Riferimenti

- **Chainlink Price Feeds**: https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
- **Uniswap V3 Docs**: https://docs.uniswap.org/contracts/v3/overview
- **Arbitrum Network**: https://docs.arbitrum.io/

---

**Documento creato il**: 26 Novembre 2025  
**Ultima verifica funzionamento**: Block 404376836 (Arbitrum Mainnet)  
**Status**: ✅ PRODUCTION READY
