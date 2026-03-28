# Testing DolomitePlugin - Guida Completa

## 🧪 Perché Testare Prima del Deploy

1. ✅ **Verifica che i contratti Dolomite esistano e siano accessibili**
2. ✅ **Testa deposit/withdraw con token reali**
3. ✅ **Benchmark gas costs**
4. ✅ **Verifica che synthetic addresses funzionino**
5. ✅ **Identifica problemi prima di spendere gas su mainnet**

---

## 🎯 Metodi di Testing

### 1. Fork Tests (CONSIGLIATO) ⭐

Usa i **contratti Dolomite reali** su una fork di Arbitrum mainnet.

**Vantaggi:**
- ✅ Testing con contratti reali (100% accurato)
- ✅ Usa token reali (WETH, USDC, ecc.)
- ✅ Nessun costo (fork locale)
- ✅ Può impersonare whales per avere fondi

**Come fare:**

```bash
# Opzione 1: Hardhat network con forking abilitato
FORK_ENABLED=true npx hardhat test test/DolomitePlugin.fork.test.ts

# Opzione 2: Node con fork persistente
npx hardhat node --fork https://arb1.arbitrum.io/rpc
# In altro terminale:
npx hardhat test test/DolomitePlugin.fork.test.ts --network localhost
```

### 2. Unit Tests (Base)

Test con mock contracts - utile per logica isolata.

```bash
npx hardhat test test/DolomitePlugin.test.ts
```

### 3. Testnet Deploy

Deploy su Arbitrum Sepolia (se Dolomite è deployato lì).

```bash
npx hardhat run scripts/deployDolomitePlugin.ts --network arbitrumSepolia
```

---

## 🚀 Quick Start: Fork Testing

### Setup Ambiente

```bash
# 1. Installa dipendenze (se non fatto)
npm install

# 2. Configura .env
echo "ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc" >> .env
echo "FORK_ENABLED=true" >> .env

# Opzionale: Block number specifico per riproducibilità
echo "FORK_BLOCK_NUMBER=123456789" >> .env
```

### Run Fork Tests

```bash
# Test completi con fork
FORK_ENABLED=true npx hardhat test test/DolomitePlugin.fork.test.ts

# Con gas report
FORK_ENABLED=true REPORT_GAS=true npx hardhat test test/DolomitePlugin.fork.test.ts
```

### Cosa Testano i Fork Tests

✅ **Metadata Functions**
- `getProtocolInfo()` ritorna info corrette
- `isHealthy()` verifica connessione a Dolomite
- Token support detection

✅ **Token Registration**
- Registra WETH, USDC
- Genera synthetic addresses (dWETH, dUSDC)
- Verifica mappings bidirezionali

✅ **Deposit Flow (WETH → dWETH)**
- Impersona whale per ottenere WETH
- Esegue `inputSwap(WETH, dWETH, 1 ether)`
- Verifica balance su Dolomite aumentato
- Check eventi emessi

✅ **Withdraw Flow (dWETH → WETH)**
- Esegue `inputSwap(dWETH, WETH, 0.5 ether)`
- Verifica WETH ricevuto
- Verifica balance Dolomite diminuito

✅ **Error Handling**
- Circuit breaker
- Invalid directions
- Insufficient balance

✅ **Gas Benchmarks**
- Gas per deposit
- Gas per withdraw
- Gas per quote queries

---

## 📊 Output Atteso

```
  DolomitePlugin - Fork Tests (Arbitrum Mainnet)

    Metadata Functions
      ✓ Should return correct protocol info
      ✓ Should pass health check
      ✓ Should detect WETH as supported token

    Token Registration
      ✓ Should register WETH and generate synthetic address
         WETH: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
         dWETH: 0xd1a7...
      ✓ Should register USDC and generate synthetic address
         USDC: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
         dUSDC: 0xd2b8...

    Deposit (Fake Swap: WETH → dWETH)
      ✓ Should execute deposit via inputSwap (gas: 234567)
         User WETH before: 1.0
         User WETH after: 0.0
      ✓ Should show increased balance on Dolomite
         Dolomite balance: 1.0 WETH

    Withdraw (Fake Swap: dWETH → WETH)
      ✓ Should execute withdrawal via inputSwap
         Dolomite balance before: 1.0
         Dolomite balance after: 0.5
         User received: 0.5 WETH

    Gas Benchmarks
      ✓ Benchmark: Deposit gas cost
         📊 Deposit gas: 234567
      ✓ Benchmark: Withdraw gas cost
         📊 Withdraw gas: 198432

  12 passing (45s)
```

---

## 🔧 Troubleshooting

### Test fallisce: "Cannot find Dolomite contracts"

**Problema:** Indirizzi router non configurati correttamente

**Fix:**
```typescript
// In test/DolomitePlugin.fork.test.ts
const BORROW_POSITION_ROUTER = "0x..."; // ← Aggiorna questi
const DEPOSIT_WITHDRAWAL_ROUTER = "0x..."; // ← Cerca su docs.dolomite.io
```

### Test fallisce: "Whale has no WETH"

**Problema:** Whale address non ha fondi o fork non aggiornata

**Fix:**
```typescript
// Usa whale diverso o block number più recente
const WETH_WHALE = "0xNEW_WHALE_ADDRESS";

// Oppure in .env:
FORK_BLOCK_NUMBER=<latest_block>
```

### Test fallisce: "Market not found for token"

**Problema:** Token non è supportato su Dolomite

**Fix:**
- Verifica che il token abbia un market su Dolomite
- Controlla su Dolomite UI quali token sono disponibili

---

## ✅ Checklist Pre-Deploy

Prima di deployare su mainnet, assicurati che:

- [ ] **Tutti i fork tests passano** (12/12 green)
- [ ] **Gas costs sono ragionevoli** (< 500k per deposit/withdraw)
- [ ] **Health check passa** su fork
- [ ] **Indirizzi router verificati** su docs.dolomite.io
- [ ] **Synthetic addresses generate correttamente** (deterministici)
- [ ] **Deposit + Withdraw roundtrip funziona** (depositi 1 WETH, ritiri 1 WETH)
- [ ] **Circuit breaker funziona** (può pausare in emergenza)

---

## 🛡️ Sicurezza: Plugin Deregistration

Hai ragione - anche se il plugin ha bugs, puoi **deregistrarlo dal Beacon** senza problemi!

### Come Funziona

```solidity
// 1. Deploy DolomitePlugin v1
DolomitePlugin pluginV1 = new DolomitePlugin(...);

// 2. Register in Beacon
beacon.upgradeImplementation("DolomitePlugin", address(pluginV1));

// 3. SwapManager usa DolomitePlugin
swapManager.performSwap("WETH", "dWETH", 1 ether, deadline);
// → Chiama pluginV1

// 4. Trovi un bug! 🐛

// 5. Deploy DolomitePlugin v2 (fixed)
DolomitePlugin pluginV2 = new DolomitePlugin(...);

// 6. Upgrade nel Beacon
beacon.upgradeImplementation("DolomitePlugin", address(pluginV2));
// ↑ Questo NON rompe nulla!

// 7. SwapManager ora usa automaticamente v2
swapManager.performSwap("WETH", "dWETH", 1 ether, deadline);
// → Chiama pluginV2

// 8. V1 viene ignorato (ma i fondi su Dolomite sono SAFE)
```

### Fondi su Dolomite Sono Sicuri

**Importante:** I fondi depositati su Dolomite sono:
- ✅ **Sul contratto DolomiteMargin** (non sul plugin!)
- ✅ **Ownership: `address(pluginV1)`** (account #0)
- ✅ **Accessibili da pluginV2** se usi stesso account owner

**Come Recuperare Fondi:**

```solidity
// Option 1: Deploy v2 con stesso account owner
// → Automaticamente accede a fondi depositati

// Option 2: Migrazione manuale
pluginV1.emergencyWithdraw(WETH, amount, recipientAddress);
// → Owner può sempre recuperare fondi

// Option 3: Withdraw direttamente da Dolomite
IDolomite(dolomite).withdrawERC20(accountNumber=0, marketId, amount, ...);
// → Se hai accesso all'account, puoi prelevare
```

### Best Practice: Testing Progressivo

```bash
# 1. Fork tests (locale, gratis)
FORK_ENABLED=true npx hardhat test test/DolomitePlugin.fork.test.ts
✅ PASS

# 2. Deploy su testnet (se disponibile)
npx hardhat run scripts/deployDolomitePlugin.ts --network arbitrumSepolia
✅ Test con piccoli importi

# 3. Deploy su mainnet con piccolo deposit iniziale
npx hardhat run scripts/deployDolomitePlugin.ts --network arbitrum
# Register in Beacon
# Test deposit 0.01 ETH
✅ Funziona!

# 4. Gradualmente aumenta importi
# Deposit 0.1 ETH → OK
# Deposit 1 ETH → OK
# Deposit 10 ETH → OK

# 5. Production ready! 🚀
```

---

## 📝 Prossimi Step

### 1. Verifica Indirizzi Router

Prima di testare, trova gli indirizzi corretti:

```bash
# Vai su:
# https://docs.dolomite.io/smart-contract-addresses

# Cerca sezione "Routers" per Arbitrum One
# - BorrowPositionRouter: 0x...
# - DepositWithdrawalRouter: 0x...
```

### 2. Run Fork Tests

```bash
FORK_ENABLED=true npx hardhat test test/DolomitePlugin.fork.test.ts
```

### 3. Se Tests Passano → Deploy!

```bash
npx hardhat run scripts/deployDolomitePlugin.ts --network arbitrum
```

### 4. Register in Beacon

```typescript
beacon.upgradeImplementation("DolomitePlugin", pluginAddress);
```

### 5. Register Tokens

```typescript
plugin.registerToken(WETH);
plugin.registerToken(USDC);
// ...

// Get synthetic addresses
const dWETH = await plugin.getSyntheticToken(WETH);
const dUSDC = await plugin.getSyntheticToken(USDC);

// Register in TokenManager
tokenManager.addToken("dWETH", dWETH, 18, oracleWETH);
tokenManager.addToken("dUSDC", dUSDC, 6, oracleUSDC);
```

### 6. Test con SwapManager

```typescript
swapManager.performSwap("WETH", "dWETH", 0.01 ether, deadline);
// ✅ Se funziona, sei pronto per production!
```

---

## 🎉 Vantaggi dell'Approccio Fork Testing

1. ✅ **Zero costi** - tutto locale
2. ✅ **100% accurato** - contratti reali
3. ✅ **Fast iteration** - modifica e ritest in secondi
4. ✅ **Safe** - nessun rischio fondi reali
5. ✅ **Debugging facile** - console.log, breakpoints, ecc.

---

Vuoi che ti aiuti a:
1. **Trovare gli indirizzi router** Dolomite
2. **Runare i fork tests** e debuggare eventuali errori
3. **Scrivere altri test** specifici per il tuo use case
4. **Deploy su testnet/mainnet** quando sei pronto

Dimmi e ti guido step by step! 🚀
