# 🔗 Integrazione GMX V2 Plugin nell'Ecosistema Modulare

## 📋 Overview dell'Integrazione

Sì, **i token GM devono essere registrati in TokenManager** prima di poterli usare! Il sistema modulare funziona così:

```
┌─────────────────────────────────────────────────────────────────┐
│                        ECOSISTEMA MODULARE                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│ TokenManager │◄───┤    Beacon     │───►│ ProxyGeneral │
│  (Registry)  │    │  (Resolver)   │    │  (Custody)   │
└──────┬───────┘    └───────────────┘    └──────┬───────┘
       │                                          │
       │ registra GM tokens                      │ detiene GM tokens
       │ + Chainlink feeds                       │ + auto-detection
       │                                          │
       ▼                                          ▼
┌──────────────────────────────────────────────────────────┐
│                      SwapManager                          │
│  • Valida token via TokenManager                        │
│  • Esegue swap via plugin                                │
│  • Aggiorna balances in ProxyGeneral                     │
└──────┬───────────────────────────────────────────────────┘
       │
       ├──────────┬──────────────┐
       ▼          ▼              ▼
┌─────────┐ ┌──────────┐ ┌──────────────┐
│UniswapV3│ │ Camelot  │ │ GMXv2Plugin  │
│ Plugin  │ │ Plugin   │ │ (NEW!)       │
└─────────┘ └──────────┘ └──────────────┘
```

---

## 🎯 Flusso Completo: Setup → Swap → Withdrawal

### **FASE 1: Setup Token GM in TokenManager**

```solidity
// 1. Deploy ChainlinkAdapter (se non già fatto)
ChainlinkAdapter adapter = new ChainlinkAdapter();

// 2. Add Chainlink price feeds per GM tokens
// GM:ETH/USD ha un feed Chainlink dedicato!
adapter.addPriceFeed(
    "GM-ETH-USD",                                    // tokenCode
    0x1234...abcd,                                   // Chainlink aggregator per GM:ETH/USD
    8,                                               // decimals
    3600                                             // heartbeat (1 ora)
);

adapter.addPriceFeed(
    "GM-BTC-USD",
    0x5678...efgh,
    8,
    3600
);

// 3. Register GM tokens in TokenManager
tokenManager.manageTokenData(
    "GM-ETH-USD",                                    // tokenCode
    0x70d95587d40A2caf56bd97485aB3Eec10Bee6336,    // GM token address
    18,                                              // decimals (GM tokens are 18)
    3600                                             // heartbeat
);

tokenManager.manageTokenData(
    "GM-BTC-USD",
    0x47c031236e19d024b42f8AE6780E44A573170703,
    18,
    3600
);
```

**✅ Risultato**: TokenManager conosce i token GM e può:
- Validare che esistano
- Fornire decimals
- Ottenere price da Chainlink
- Verificare se sono attivi

---

### **FASE 2: Setup GMXv2Plugin in SwapManager**

```solidity
// 1. Deploy GMXv2Plugin
GMXv2Plugin gmxPlugin = new GMXv2Plugin(
    0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8, // ExchangeRouter
    0xf60becbba223EEA9495Da3f606753867eC10d139, // Reader
    0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8, // DataStore
    address(proxyGeneral),                      // ProxyGeneral
    0x82aF49447D8a07e3bd95BD0d56f35241523fBab1  // WETH
);

// 2. Configure markets in GMXv2Plugin
gmxPlugin.addMarket(
    0x70d95587d40A2caf56bd97485aB3Eec10Bee6336, // GM:ETH/USD
    0x82aF49447D8a07e3bd95BD0d56f35241523fBab1, // Index: WETH
    0x82aF49447D8a07e3bd95BD0d56f35241523fBab1, // Long: WETH
    0xaf88d065e77c8cC2239327C5EDb3A432268e5831  // Short: USDC
);

// 3. Register plugin in Beacon
beacon.updateImplementation("GMX-V2", address(gmxPlugin));

// 4. Authorize plugin in ProxyGeneral
proxyGeneral.authorizeModule(address(gmxPlugin), "SwapPlugin");
```

---

### **FASE 3: Eseguire Swap (Comprare GM Token)**

```solidity
// USER CHIAMA: Voglio comprare GM:ETH/USD con 1000 USDC

// SwapManager automaticamente:
// 1. Valida token code via TokenManager
address usdcAddress = tokenManager.getTokenAddress("USDC");
address gmTokenAddress = tokenManager.getTokenAddress("GM-ETH-USD");
uint8 usdcDecimals = tokenManager.getTokenInfo("USDC").tokenDecimals;
uint8 gmDecimals = tokenManager.getTokenInfo("GM-ETH-USD").tokenDecimals;

// 2. Verifica balance in ProxyGeneral
uint256 usdcBalance = IERC20(usdcAddress).balanceOf(address(proxyGeneral));
require(usdcBalance >= 1000e6, "Insufficient USDC");

// 3. Approva GMXv2Plugin a spendere da ProxyGeneral
proxyGeneral.approveSpender(
    usdcAddress,
    address(gmxPlugin),
    1000e6
);

// 4. Esegue swap via plugin
uint256 gmReceived = gmxPlugin.inputSwap{value: 0.002 ether}(
    usdcAddress,        // spendToken
    gmTokenAddress,     // receiveToken
    1000e6              // amountIn
);

// 5. ASYNC: Keeper GMX esegue dopo 1-2 minuti
// 6. GM tokens arrivano in ProxyGeneral automaticamente!
```

**✅ Risultato**: 
- USDC trasferito da ProxyGeneral → GMX
- GM tokens mintati → arrivano in ProxyGeneral
- Balance aggiornato automaticamente

---

### **FASE 4: Auto-Detection Balance GM Tokens**

```solidity
// ProxyGeneral rileva automaticamente GM tokens!

// 1. Query balance via TokenManager
string[] memory allTokens = tokenManager.getActiveTokens();

for (uint i = 0; i < allTokens.length; i++) {
    string memory tokenCode = allTokens[i];
    address tokenAddress = tokenManager.getTokenAddress(tokenCode);
    
    // Balance in ProxyGeneral
    uint256 balance = IERC20(tokenAddress).balanceOf(address(proxyGeneral));
    
    if (balance > 0) {
        // Ho questo token!
        // TokenManager fornisce:
        // - Address
        // - Decimals
        // - Price (da Chainlink)
        // - Active status
        
        TokenInfo memory info = tokenManager.getTokenInfo(tokenCode);
        uint256 valueUSD = balance * info.lastPrice / (10 ** info.tokenDecimals);
    }
}
```

**✅ Risultato**: Sistema sa **automaticamente**:
- Quali GM tokens hai
- Quanto valgono (via Chainlink)
- Se sono attivi/ritirable

---

### **FASE 5: Withdrawal Automatico (Vendere GM)**

```solidity
// SCENARIO: Emergency withdrawal o rebalancing

// 1. ValueCalculator calcola portfolio value
uint256 gmTokenBalance = IERC20(gmTokenAddress).balanceOf(address(proxyGeneral));
uint256 gmPrice = tokenManager.getTokenPrice("GM-ETH-USD");
uint256 gmValueUSD = (gmTokenBalance * gmPrice) / 1e18;

// 2. Se necessario withdrawal (es. emergency o rebalance)
// Liquiditymanager può triggare automaticamente:

function emergencyWithdrawGM(
    string memory gmTokenCode,
    string memory outputTokenCode,
    uint256 amount
) external onlyAuthorized {
    // Get addresses from TokenManager
    address gmToken = tokenManager.getTokenAddress(gmTokenCode);
    address outputToken = tokenManager.getTokenAddress(outputTokenCode);
    
    // Approve plugin
    proxyGeneral.approveSpender(gmToken, address(gmxPlugin), amount);
    
    // Execute withdrawal (burn GM → receive USDC/WETH)
    uint256 received = gmxPlugin.inputSwap{value: 0.002 ether}(
        gmToken,        // spendToken (GM)
        outputToken,    // receiveToken (USDC/WETH)
        amount
    );
    
    // Output tokens automaticamente in ProxyGeneral
    emit EmergencyWithdrawalExecuted(gmTokenCode, outputTokenCode, amount, received);
}
```

**✅ Risultato**: Withdrawal automatico quando necessario!

---

## 🔍 Domande & Risposte

### **Q1: I token GM devono essere in TokenManager prima?**
**A: SÌ!** Sempre. Questo permette:
- Validazione token code → address
- Decimals consistency
- Price feeds da Chainlink
- Active status check
- Auto-detection balances

### **Q2: Il sistema rileva automaticamente GM tokens?**
**A: SÌ!** Tramite:
```solidity
// 1. TokenManager sa quali token esistono
string[] memory tokens = tokenManager.getActiveTokens();

// 2. ProxyGeneral detiene i token
uint256 balance = IERC20(tokenAddr).balanceOf(proxyGeneral);

// 3. ValueCalculator calcola valore totale
uint256 totalValue = valueCalculator.getTotalValue();
```

### **Q3: Posso fare withdrawal automatico?**
**A: SÌ!** Con Chainlink price feed:
```solidity
// 1. TokenManager fornisce price
(uint256 price, , bool isStale) = tokenManager.getTokenPrice("GM-ETH-USD");

// 2. Liquiditymanager decide se vendere
if (needsRebalancing) {
    swapManager.executeSwap(gmToken, usdc, amount);
}

// 3. GMXv2Plugin esegue withdrawal
// 4. USDC torna in ProxyGeneral
```

### **Q4: Come funziona con Chainlink?**
**A:** Chainlink fornisce price feeds per GM tokens:
```
┌──────────────────┐
│ Chainlink Oracle │
│  GM:ETH/USD Feed │
└────────┬─────────┘
         │ price updates
         ▼
┌─────────────────┐
│ ChainlinkAdapter│
│ (IOracleAdapter)│
└────────┬────────┘
         │ getPrice("GM-ETH-USD")
         ▼
┌──────────────────┐
│  TokenManager    │
│  • Stores price  │
│  • Validates     │
└──────────────────┘
```

---

## 📝 Checklist Setup Completo

### 1️⃣ **Deploy & Configure Oracles**
- [ ] Deploy ChainlinkAdapter
- [ ] Add GM token price feeds to adapter
- [ ] Set adapter in TokenManager

### 2️⃣ **Register GM Tokens**
```solidity
// Per ogni GM token:
tokenManager.manageTokenData(
    "GM-ETH-USD",                                    // code
    0x70d95587d40A2caf56bd97485aB3Eec10Bee6336,    // address
    18,                                              // decimals
    3600                                             // heartbeat
);
```

### 3️⃣ **Setup GMXv2Plugin**
```solidity
// Deploy plugin
GMXv2Plugin plugin = new GMXv2Plugin(...);

// Add markets
plugin.addMarket(gmToken, indexToken, longToken, shortToken);

// Register in Beacon
beacon.updateImplementation("GMX-V2", address(plugin));
```

### 4️⃣ **Authorize Plugin**
```solidity
proxyGeneral.authorizeModule(address(plugin), "SwapPlugin");
```

### 5️⃣ **Test Flow**
- [ ] Buy GM token (USDC → GM:ETH/USD)
- [ ] Verify balance in ProxyGeneral
- [ ] Check price via TokenManager
- [ ] Sell GM token (GM:ETH/USD → USDC)
- [ ] Verify received USDC

---

## 🎯 Esempio Completo End-to-End

```solidity
// ============ SETUP (One-time) ============

// 1. Register GM token
tokenManager.manageTokenData("GM-ETH-USD", gmTokenAddr, 18, 3600);

// 2. Deploy & configure plugin
GMXv2Plugin plugin = new GMXv2Plugin(...);
plugin.addMarket(gmTokenAddr, weth, weth, usdc);
beacon.updateImplementation("GMX-V2", address(plugin));
proxyGeneral.authorizeModule(address(plugin), "SwapPlugin");

// ============ USAGE (Ongoing) ============

// 3. User deposits USDC
protocolManager.depositToken("USDC", 1000e6);
// → USDC in ProxyGeneral

// 4. Swap USDC → GM:ETH/USD
swapManager.executeSwap{value: 0.002 ether}(
    "USDC",
    "GM-ETH-USD",
    1000e6,
    950e18,     // minOut (5% slippage)
    "GMX-V2"
);
// → GM tokens in ProxyGeneral (after keeper execution)

// 5. Auto-detection
string[] memory tokens = tokenManager.getActiveTokens();
// → includes "GM-ETH-USD"

uint256 balance = IERC20(gmTokenAddr).balanceOf(proxyGeneral);
// → Shows GM balance

(uint256 price, , ) = tokenManager.getTokenPrice("GM-ETH-USD");
// → Price da Chainlink

uint256 valueUSD = (balance * price) / 1e18;
// → Valore portfolio include GM tokens

// 6. Withdrawal (quando necessario)
liquidityManager.emergencyWithdrawGM(
    "GM-ETH-USD",
    "USDC",
    balance
);
// → Vende GM → USDC back in ProxyGeneral
```

---

## ⚠️ Note Importanti

### **Token Registration è Obbligatoria**
❌ **ERRORE**: Swap senza registrazione
```solidity
swapManager.executeSwap("GM-ETH-USD", "USDC", amount);
// → REVERT: "Token not found in TokenManager"
```

✅ **CORRETTO**: Prima registra, poi usa
```solidity
tokenManager.manageTokenData("GM-ETH-USD", ...);
swapManager.executeSwap("GM-ETH-USD", "USDC", amount);
// → SUCCESS
```

### **Chainlink Price Feeds**
GM tokens hanno feed Chainlink dedicati:
- **GM:ETH/USD**: Feed disponibile
- **GM:BTC/USD**: Feed disponibile
- **Altri GM**: Usa GMX Reader per fallback

### **Auto-Detection Funziona Via**
1. **TokenManager**: Registry di tutti i token
2. **ProxyGeneral**: Balance holder
3. **ValueCalculator**: Portfolio valuation
4. **Liquiditymanager**: Auto-rebalancing

### **Withdrawal Automatico**
Triggers per auto-withdrawal:
- Emergency mode
- Rebalancing threshold
- Rate limit enforcement
- Protocol unhealthy state

---

## 🚀 Benefits dell'Integrazione

✅ **Unified Token Registry**: Single source of truth
✅ **Auto Balance Detection**: Sistema sa cosa hai
✅ **Price Oracle Integration**: Valuation automatica
✅ **Emergency Withdrawal**: Liquidity protection
✅ **Modular Architecture**: Easy to extend
✅ **Type Safety**: Token validation built-in

Il sistema è **completamente modulare** e **auto-detecta** tutto! 🎉
