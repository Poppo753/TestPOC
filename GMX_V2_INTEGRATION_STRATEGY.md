# 🎯 GMX V2 Integration Strategy - Token GM

## 📋 Executive Summary

Strategia completa per integrare GMX V2 nel sistema di swap management per comprare/vendere token GM (GMX Market tokens). I token GM sono LP tokens che rappresentano liquidità nei mercati GMX V2.

---

## 🏗️ Architettura

```
┌─────────────────────────────────────────────────────────────┐
│                      SwapManager                             │
│  • Coordina swap tra plugin                                 │
│  • Best price routing                                        │
│  • Slippage protection                                       │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼────────┐    ┌──▼──────────────┐
│ UniswapV3  │    │  GMXv2Plugin    │
│ Plugin     │    │  (ASYNC!)       │
│ • Instant  │    │  • Deposits     │
│ • Atomic   │    │  • Withdrawals  │
└────────────┘    └──┬──────────────┘
                     │
        ┌────────────┴───────────────┐
        │                            │
    ┌───▼─────────────┐      ┌──────▼────────┐
    │ ExchangeRouter  │      │  Reader       │
    │ (0x7C68...)     │      │  (0xf60...)   │
    │ • createDeposit │      │  • Quotes     │
    │ • createWithdraw│      │  • Prices     │
    └───┬─────────────┘      └───────────────┘
        │
    ┌───▼────────────┐
    │ DepositHandler │
    │ (Keeper runs)  │
    │ • Mints GM     │
    │ • Burns GM     │
    └────────────────┘
```

---

## 🔑 Key Concepts

### 1. **Token GM vs GLP (V1)**

| Feature | GLP (V1) | GM (V2) |
|---------|----------|---------|
| **Tipo** | Single global pool | Market-specific pools |
| **Collateral** | Mixed (ETH, BTC, USDC, etc) | Long + Short per market |
| **Pricing** | Index-based | Oracle + market-based |
| **Execution** | Instant | Async (keeper) |
| **Markets** | 1 pool | Multiple markets |

**Esempio Markets V2:**
- `GM:ETH/USD` → Long: WETH, Short: USDC
- `GM:BTC/USD` → Long: WBTC, Short: USDC
- `GM:ARB/USD` → Long: ARB, Short: USDC

### 2. **Async Operation Model**

```solidity
// STEP 1: User creates deposit (immediate)
exchangeRouter.createDeposit{value: 0.002 ether}(params)
→ Returns depositKey
→ User tokens locked

// STEP 2: Keeper executes (1-2 minutes later)
depositHandler.executeDeposit(depositKey)
→ GM tokens minted
→ Sent to receiver

// STEP 3: User receives GM tokens
// Time delay: ~60-120 seconds
```

### 3. **Execution Fees**

Ogni operazione richiede ETH per i keeper:
- **Deposit**: ~0.001-0.003 ETH
- **Withdrawal**: ~0.001-0.003 ETH
- Fee variabile in base a gas price

---

## 💡 Implementazione

### File Creati

#### 1. **IGMXv2ExchangeRouter.sol**
Interface per ExchangeRouter (entry point principale):
- `createDeposit()` - Minta GM tokens
- `createWithdrawal()` - Burna GM tokens
- `sendTokens()` - Invia collateral
- `sendWnt()` - Invia execution fee

#### 2. **IGMXv2Reader.sol**
Interface per Reader (quotes e market info):
- `getMarket()` - Info su market
- `getDepositAmountOut()` - Quote per minting
- `getWithdrawalAmountOut()` - Quote per burning

#### 3. **GMXv2Plugin.sol**
Plugin principale con logica completa:
- Implementa `ISwapPlugin`
- Gestisce deposit/withdrawal asincroni
- Tracking di pending operations
- Market configuration management

---

## 🔧 Come Usare

### Setup Iniziale

```solidity
// 1. Deploy GMXv2Plugin
GMXv2Plugin plugin = new GMXv2Plugin(
    0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8, // ExchangeRouter
    0xf60becbba223EEA9495Da3f606753867eC10d139, // Reader
    0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8, // DataStore
    proxyGeneralAddress,
    0x82aF49447D8a07e3bd95BD0d56f35241523fBab1  // WETH
);

// 2. Add markets
plugin.addMarket(
    0x70d95587d40A2caf56bd97485aB3Eec10Bee6336, // GM:ETH/USD
    0x82aF49447D8a07e3bd95BD0d56f35241523fBab1, // Index: WETH
    0x82aF49447D8a07e3bd95BD0d56f35241523fBab1, // Long: WETH
    0xaf88d065e77c8cC2239327C5EDb3A432268e5831  // Short: USDC
);

// 3. Register in SwapManager
swapManager.registerPlugin("GMX-V2", address(plugin));
```

### Buying GM Tokens

```solidity
// User wants to buy GM:ETH/USD with USDC
address GM_ETH_USD = 0x70d95587d40A2caf56bd97485aB3Eec10Bee6336;
address USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

// Execute swap via SwapManager
swapManager.executeSwap{value: 0.002 ether}(
    USDC,           // spendToken
    GM_ETH_USD,     // receiveToken
    1000e6,         // amount (1000 USDC)
    950e18,         // minOut (950 GM, 5% slippage)
    "GMX-V2"        // plugin name
);

// After 1-2 minutes, keeper executes
// User receives GM:ETH/USD tokens in ProxyGeneral
```

### Selling GM Tokens

```solidity
// User wants to sell GM:ETH/USD for USDC
swapManager.executeSwap{value: 0.002 ether}(
    GM_ETH_USD,     // spendToken (GM token)
    USDC,           // receiveToken
    100e18,         // amount (100 GM)
    950e6,          // minOut (950 USDC)
    "GMX-V2"
);

// After 1-2 minutes, keeper executes
// User receives USDC in ProxyGeneral
```

---

## ⚠️ Limitazioni & Trade-offs

### ❌ Svantaggi

1. **Async Execution**
   - Delay 1-2 minuti
   - Non atomic (cannot chain with other swaps)
   - Price risk durante delay

2. **Execution Fees**
   - Cost extra (~$2-5 per operation)
   - Variabile con gas price
   - Deve essere pagato in ETH

3. **Complessità**
   - Richiede tracking di pending operations
   - Error handling più complesso
   - UI deve mostrare pending status

4. **Non per Arbitrage**
   - Troppo lento per MEV
   - Non utilizzabile in flash loans
   - Non composable atomicamente

### ✅ Vantaggi

1. **Accesso a GMX Markets**
   - Yield farming on GM tokens
   - Exposure a mercati specifici
   - Fees distribution da trading

2. **Oracle-Based Pricing**
   - Prezzi più stabili
   - Meno price impact
   - Protection da manipulation

3. **Yield Generation**
   - GM tokens generano fees
   - APR variabile per market
   - Passive income

---

## 🎯 Use Cases Ideali

### ✅ Buoni Use Cases

1. **Portfolio Rebalancing**
   ```
   User ha troppo USDC → Compra GM:ETH/USD
   → Mantiene per farming → Vende dopo 1 mese
   ```

2. **Yield Farming**
   ```
   Deposita USDC → GM:BTC/USD
   → Staking per rewards
   → Ritorna in USDC dopo 3 mesi
   ```

3. **Hedging Strategies**
   ```
   Long ETH spot + Short via GM markets
   → Neutral position
   → Farming fees
   ```

### ❌ Use Cases Non Ideali

1. **Arbitrage Trading**
   - Troppo lento (1-2 min delay)
   - Execution fee mangia profit

2. **High-Frequency Trading**
   - Async execution inadatto
   - Slippage risk durante delay

3. **Atomic Swaps**
   - Non composable
   - Cannot chain A→GM→B in single tx

---

## 🔮 Future Improvements

### Phase 2: Oracle Integration

```solidity
// Integrare Chainlink per pricing reale
function getExpectedOutput(...) external view returns (uint256) {
    // Fetch real prices from GMX oracles
    MarketPrices memory prices = _getMarketPrices(gmToken);
    
    // Use GMX Reader for accurate quote
    return reader.getDepositAmountOut(
        dataStore,
        market,
        prices,
        longAmount,
        shortAmount,
        address(0)
    );
}
```

### Phase 3: Callback Handler

```solidity
// Implement callback per tracking automatico
contract GMXCallbackHandler {
    function afterDepositExecution(...) external {
        // Update user balances
        // Emit events
        // Notify SwapManager
    }
}
```

### Phase 4: Multi-Asset Deposits

```solidity
// Support per depositing both long + short
function depositBothTokens(
    address gmToken,
    uint256 longAmount,
    uint256 shortAmount
) external returns (uint256 gmOut);
```

---

## 📊 Market Addresses (Arbitrum)

### Top GMX V2 Markets

| Market | GM Token | Long Token | Short Token |
|--------|----------|------------|-------------|
| ETH/USD | `0x70d95587d40A2caf56bd97485aB3Eec10Bee6336` | WETH | USDC |
| BTC/USD | `0x47c031236e19d024b42f8AE6780E44A573170703` | WBTC | USDC |
| ARB/USD | `0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407` | ARB | USDC |
| SOL/USD | `0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9` | SOL | USDC |
| LINK/USD | `0x7f1fa204bb700853D36994DA19F830b6Ad18455C` | LINK | USDC |

### Contract Addresses

| Contract | Address | Description |
|----------|---------|-------------|
| ExchangeRouter | `0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8` | Main entry point |
| Reader | `0xf60becbba223EEA9495Da3f606753867eC10d139` | Quote engine |
| DataStore | `0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8` | State storage |
| OrderHandler | `0x352f684ab9e97a6321a13CF03A61316B681D9fD2` | Order execution |

---

## 🧪 Testing Strategy

### Unit Tests

```solidity
// Test minting GM
function test_MintGM() public {
    // Setup
    deal(USDC, user, 1000e6);
    
    // Execute
    vm.prank(user);
    plugin.inputSwap{value: 0.002 ether}(
        USDC,
        GM_ETH_USD,
        1000e6
    );
    
    // Assert deposit created
    // Note: Cannot assert GM balance immediately (async!)
}

// Test quote accuracy
function test_QuoteAccuracy() public {
    uint256 quote = plugin.getExpectedOutput(
        USDC,
        GM_ETH_USD,
        1000e6,
        6,
        18
    );
    
    assertGt(quote, 0);
    assertLt(quote, 1100e18); // Sanity check
}
```

### Integration Tests (Fork)

```solidity
// Test with real GMX contracts
function test_IntegrationMintGM() public {
    // Fork Arbitrum mainnet
    vm.createSelectFork("arbitrum");
    
    // Execute real deposit
    bytes32 key = plugin.inputSwap{value: 0.002 ether}(...);
    
    // Fast forward time
    vm.warp(block.timestamp + 120);
    
    // Manually trigger keeper (simulate)
    // Check GM balance increased
}
```

---

## 📚 Resources

### Official Documentation
- **GMX V2 Docs**: https://docs.gmx.io/docs/trading/v2
- **Synthetics Repo**: https://github.com/gmx-io/gmx-synthetics
- **Oracle Integration**: https://docs.gmx.io/docs/api/contracts-v2

### Chainlink Data Feeds (GM Tokens)
- GM:ETH/USD: Available on Chainlink
- GM:BTC/USD: Available on Chainlink
- Custom markets: Use GMX Reader

### Community
- Discord: https://discord.gg/gmx
- Telegram: https://t.me/GMX_IO
- Twitter: @GMX_IO

---

## ✅ Checklist Implementation

- [x] Create interfaces (IGMXv2ExchangeRouter, IGMXv2Reader)
- [x] Implement GMXv2Plugin contract
- [x] Market management (add/remove markets)
- [x] Deposit flow (mint GM)
- [x] Withdrawal flow (burn GM)
- [ ] Oracle integration (real pricing)
- [ ] Callback handler (execution tracking)
- [ ] Unit tests
- [ ] Fork integration tests
- [ ] Deploy to testnet
- [ ] Add market configurations
- [ ] Frontend integration
- [ ] Deploy to mainnet

---

## 🎓 Conclusioni

**GMXv2Plugin** fornisce accesso ai token GM per:
- ✅ **Yield farming** su mercati specifici
- ✅ **Portfolio diversification** con LP tokens
- ✅ **Fee generation** da trading volume
- ❌ **Non adatto** per arbitrage/HFT
- ❌ **Async execution** richiede patience

**Quando usare:**
- Long-term holds (>1 giorno)
- Yield strategies
- Portfolio rebalancing

**Quando NON usare:**
- Arbitrage (troppo lento)
- Atomic multi-hop swaps
- High-frequency trading

**Next Steps:**
1. Deploy plugin
2. Add top 5 markets (ETH, BTC, ARB, SOL, LINK)
3. Test con piccoli amounts
4. Monitor execution times
5. Optimize execution fees
6. Scale to more markets
