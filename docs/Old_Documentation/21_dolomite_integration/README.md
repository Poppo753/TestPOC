# Dolomite Integration - Summary & Next Steps

## 📋 Cosa è stato creato

### 1. **Interfaces** (`contracts/interfaces/`)

#### `IDolomite.sol`
Interfacce per i contratti core di Dolomite:
- `IDolomiteMargin`: Contratto principale per query su accounts e markets
- `IBorrowPositionRouter`: Router per gestire borrow positions
- `IDepositWithdrawalRouter`: Router per deposit/withdraw
- `AccountBalanceLib`: Library per balance check flags

#### `IDolomitePlugin.sol`
Interface completa per il plugin Dolomite:
- **Phase 1**: `deposit()`, `withdraw()`, `getBalance()`
- **Phase 2**: `openBorrowPosition()`, `closeBorrowPosition()`, `getPositionSummary()`
- **Phase 3**: `openLeveragedPosition()` (future)
- Metadata: `getProtocolInfo()`, `isHealthy()`, `supportsToken()`

### 2. **Implementation** (`contracts/plugins/`)

#### `DolomitePlugin.sol`
Implementazione del plugin (Fase 1 completa):
- ✅ **Deposit**: Deposita ERC20 su Dolomite account #0
- ✅ **Withdraw**: Preleva da Dolomite account #0
- ✅ **Balance query**: Controlla saldi su qualsiasi account
- ✅ **Health checks**: Verifica operatività del protocollo
- ✅ **Token support**: Controlla se token è supportato
- ✅ **Circuit breaker**: Emergency stop per owner
- 🚧 **Borrow positions**: Stub (da implementare in Fase 2)
- 🔮 **Leverage**: Stub (da implementare in Fase 3)

### 3. **Documentation** (`docs/21_dolomite_integration/`)

#### `DOLOMITE_PLUGIN_GUIDE.md`
Guida completa per:
- Architettura del plugin
- Account strategy (account #0 vs #1+)
- Smart contract addresses Arbitrum
- Deployment instructions
- Usage examples (Solidity + TypeScript)
- Security considerations
- Roadmap per le 3 fasi

### 4. **Scripts** (`scripts/`)

#### `deployDolomitePlugin.ts`
Script di deployment per Arbitrum:
- Deploy con parametri configurabili
- Post-deployment checks (health, token support)
- Verification command auto-generated
- Salvataggio deployment info in JSON

---

## 🎯 Architettura - Come funziona

### Custody Model

```
User
  │
  │ 1. approve(plugin, amount)
  ▼
DolomitePlugin
  │
  │ 2. transferFrom(user, plugin, amount)
  │ 3. approve(depositRouter, amount)
  ▼
DepositRouter
  │
  │ 4. deposit to DolomiteMargin
  ▼
DolomiteMargin
  │
  └─► Account (owner=plugin, number=0)
        Balance: +amount
```

### Account Strategy

**Dolomite è account-based**: ogni account = `(owner, accountNumber)`

- **Owner**: `address(DolomitePlugin)` 
  → Il plugin è il proprietario di tutti gli account
  
- **Account #0**: Main account
  - Riceve deposits da utenti
  - Usato per withdrawals
  - **NO borrow** (sempre in surplus)
  - Sicuro per deposits semplici

- **Account #1, #2, #3...**: Borrow positions (Phase 2)
  - Ogni posizione è isolata
  - Può avere collateral + debt
  - Gestita tramite `BorrowPositionRouter`
  - Rischio di liquidazione se health factor < 1.0

---

## ✅ Fase 1: Deposit/Withdraw (COMPLETATA)

### Cosa puoi fare ORA

```solidity
// 1. Resolve plugin from Beacon
address pluginAddr = beacon.getImplementation("DolomitePlugin");
IDolomitePlugin plugin = IDolomitePlugin(pluginAddr);

// 2. Deposit USDC
IERC20(USDC).approve(pluginAddr, 1000e6);
plugin.deposit(USDC, 1000e6);

// 3. Check balance
int256 balance = plugin.getBalance(USDC, 0);

// 4. Withdraw
uint256 withdrawn = plugin.withdraw(USDC, 500e6, recipient);
```

### Use Cases Fase 1

- ✅ **Vault strategies**: Deposita fondi su Dolomite per yield
- ✅ **Liquidity aggregation**: Riserve su più protocolli (Aave + Dolomite)
- ✅ **Gas saving**: Batch deposits/withdrawals
- ✅ **Emergency reserves**: Fondi accessibili ma fruttiferi

### Limitazioni Fase 1

- ❌ **NO borrow**: Non puoi prendere a prestito
- ❌ **NO leverage**: Non puoi amplificare posizioni
- ❌ **NO collateral management**: Account #0 è solo deposit/withdraw

---

## 🚧 Fase 2: Borrow Positions (DA IMPLEMENTARE)

### Obiettivi

Implementare gestione completa di posizioni di borrow su Dolomite:

1. **Open borrow position**: Deposita collateral + prendi a prestito
2. **Close borrow position**: Ripaga debito + recupera collateral
3. **Position monitoring**: Health factor, liquidation risk
4. **Max borrow calculation**: Quanto puoi prendere a prestito in sicurezza

### Flusso di apertura posizione

```solidity
// User ha 1 WETH, vuole prendere a prestito $1500 USDC

// 1. Prepare parameters
BorrowPositionParams memory params = BorrowPositionParams({
    collateralToken: WETH,
    collateralAmount: 1 ether,
    borrowToken: USDC,
    borrowAmount: 1500e6,
    toAccountNumber: 1  // First borrow position
});

// 2. Open position
uint256 accountId = plugin.openBorrowPosition(params);
// → User ha depositato 1 WETH su account #1
// → User ha ricevuto 1500 USDC

// 3. Monitor health
AccountPosition memory pos = plugin.getPositionSummary(1);
// pos.healthFactor → se < 1.0, rischio liquidazione

// 4. Close position (quando vuoi)
plugin.closeBorrowPosition(1, recipient);
// → Ripaga 1500 USDC (+ interessi)
// → Recupera 1 WETH
```

### Implementazione richiesta in `DolomitePlugin.sol`

```solidity
function openBorrowPosition(
    BorrowPositionParams calldata params
) external nonReentrant whenNotPaused returns (uint256 accountNumber) {
    // 1. Transfer collateral from caller
    IERC20(params.collateralToken).safeTransferFrom(
        msg.sender, 
        address(this), 
        params.collateralAmount
    );
    
    // 2. Deposit collateral to account #0
    _depositInternal(params.collateralToken, params.collateralAmount);
    
    // 3. Get market IDs
    uint256 collateralMarketId = dolomiteMargin.getMarketIdByTokenAddress(
        params.collateralToken
    );
    uint256 borrowMarketId = dolomiteMargin.getMarketIdByTokenAddress(
        params.borrowToken
    );
    
    // 4. Open borrow position (move collateral from #0 to #toAccountNumber)
    borrowRouter.openBorrowPosition(
        MAIN_ACCOUNT,
        params.toAccountNumber,
        collateralMarketId,
        params.collateralAmount,
        AccountBalanceLib.BalanceCheckFlag.From
    );
    
    // 5. Borrow tokens (move debt from #toAccountNumber to #0)
    borrowRouter.transferBetweenAccounts(
        0, // no isolation
        params.toAccountNumber,
        MAIN_ACCOUNT,
        borrowMarketId,
        params.borrowAmount,
        AccountBalanceLib.BalanceCheckFlag.To
    );
    
    // 6. Withdraw borrowed tokens to caller
    _withdrawInternal(params.borrowToken, params.borrowAmount, msg.sender);
    
    // 7. Track account
    userBorrowAccounts[msg.sender].push(params.toAccountNumber);
    
    emit BorrowPositionOpened(
        msg.sender,
        params.toAccountNumber,
        params.collateralToken,
        params.collateralAmount,
        params.borrowToken,
        params.borrowAmount
    );
    
    return params.toAccountNumber;
}
```

### Testing Fase 2

1. **Unit tests**: Mock Dolomite routers, test logica
2. **Fork tests**: Test su Arbitrum fork con contratti reali
3. **Testnet**: Deploy su Arbitrum testnet (se disponibile)
4. **Mainnet (piccoli importi)**: Test con $10-100 prima di scalare

---

## 🔮 Fase 3: Leverage (FUTURO)

### Obiettivo

Aprire posizioni con leva (es. 3x, 5x) tramite loop di deposit → borrow → re-deposit.

### Esempio: 3x Leverage su ETH

```solidity
// User ha $1000 USDC, vuole 3x leverage su ETH

// 1. Apri posizione con leva
uint256 accountId = plugin.openLeveragedPosition(
    USDC,           // collateralToken
    1000e6,         // initialAmount = $1000
    3e18,           // leverageMultiplier = 3.0x
    5               // maxIterations
);

// Cosa succede internamente:
// Iteration 1: Deposit $1000 USDC, borrow $750 USDC (75% LTV)
// Iteration 2: Deposit $750 USDC, borrow $562.5 USDC
// Iteration 3: Deposit $562.5 USDC, borrow $421.87 USDC
// ...
// Final: $3000 collateral, $2000 debt = 3x leverage
```

### Considerazioni Fase 3

- **Slippage**: Ogni iteration può avere slippage (se swap necessario)
- **Gas costs**: Più iterations = più gas
- **Liquidation risk**: Leverage alto = rischio liquidazione alto
- **Market conditions**: Verificare liquidità prima di loop
- **Emergency exit**: De-leverage automatico se health factor < soglia

---

## 📍 Dove siamo ora

### ✅ Completato

- [x] Design architettura (simile a SwapPlugin)
- [x] Interfacce Dolomite (`IDolomite.sol`)
- [x] Plugin interface (`IDolomitePlugin.sol`)
- [x] Implementazione Fase 1 (deposit/withdraw)
- [x] Documentation completa
- [x] Deploy script

### 🚧 TODO immediato

1. **Verificare indirizzi router Dolomite**
   - [ ] Vai su https://docs.dolomite.io/smart-contract-addresses
   - [ ] Trova `BorrowPositionRouter` address
   - [ ] Trova `DepositWithdrawalRouter` address
   - [ ] Aggiorna `deployDolomitePlugin.ts`

2. **Testing Fase 1**
   - [ ] Scrivere unit tests per deposit/withdraw
   - [ ] Test su Arbitrum fork
   - [ ] Deploy su testnet (se disponibile)

3. **Deploy su Mainnet (opzionale, fase 1)**
   - [ ] Run deploy script
   - [ ] Verify su Arbiscan
   - [ ] Register nel Beacon
   - [ ] Test con piccoli importi ($10-50)

### 🔄 TODO Fase 2 (medio termine)

1. **Implementare borrow positions**
   - [ ] `openBorrowPosition()`
   - [ ] `closeBorrowPosition()`
   - [ ] `getPositionSummary()`
   - [ ] `getMaxBorrowAmount()`

2. **Testing estensivo**
   - [ ] Unit tests per borrow logic
   - [ ] Integration tests con SwapManager (per repay)
   - [ ] Stress testing (liquidations, edge cases)

3. **Security**
   - [ ] Audit interno
   - [ ] Consider professional audit
   - [ ] Liquidation monitoring system

---

## 🔑 Prossimi Step Concreti

### Step 1: Clonare repository Dolomite (opzionale ma consigliato)

```bash
cd ~/projects
git clone https://github.com/dolomite-exchange/dolomite-margin-modules.git
cd dolomite-margin-modules

# Esplora i contratti per capire meglio:
# - contracts/external/interfaces/
# - contracts/external/routers/
```

### Step 2: Trovare gli indirizzi router

**Opzione A**: Controllare docs ufficiali
```
https://docs.dolomite.io/smart-contract-addresses
```

**Opzione B**: Query on-chain (se hai già DolomiteMargin address)
```typescript
// In Hardhat console o script
const dolomite = await ethers.getContractAt(
    "IDolomiteMargin", 
    "0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072"
);

// Dolomite potrebbe avere getter per routers
// Oppure controlla eventi di deployment
```

**Opzione C**: Esplora su Arbiscan
```
1. Vai su https://arbiscan.io/address/0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072
2. Tab "Contract" → "Read Contract"
3. Cerca funzioni tipo "getBorrowRouter()" o simili
4. Oppure guarda "Events" del deployer
```

### Step 3: Aggiornare deploy script

Una volta trovati gli indirizzi:

```typescript
// In scripts/deployDolomitePlugin.ts

const BORROW_POSITION_ROUTER = "0xABC123..."; // ← Replace
const DEPOSIT_WITHDRAWAL_ROUTER = "0xDEF456..."; // ← Replace
```

### Step 4: Testing locale (fork)

```bash
# Avvia Arbitrum fork
npx hardhat node --fork https://arb1.arbitrum.io/rpc

# In altro terminale, deploy su fork
npx hardhat run scripts/deployDolomitePlugin.ts --network localhost

# Test deposit/withdraw
npx hardhat run scripts/testDolomitePlugin.ts --network localhost
```

### Step 5: Deploy su Mainnet (quando ready)

```bash
# 1. Double-check addresses
# 2. Ensure wallet has ETH for gas
# 3. Deploy
npx hardhat run scripts/deployDolomitePlugin.ts --network arbitrum

# 4. Verify
npx hardhat verify --network arbitrum <ADDRESS> \
    0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072 \
    <BORROW_ROUTER> \
    <DEPOSIT_ROUTER>

# 5. Register in Beacon (as Beacon owner)
# beacon.upgradeImplementation("DolomitePlugin", <ADDRESS>)
```

---

## 💡 Domande & Risposte

### Q: Perché separare deposit/withdraw (Fase 1) da borrow (Fase 2)?

**A**: 
- **Risk management**: Deposit/withdraw è safe, borrow ha rischi di liquidazione
- **Incremental testing**: Test Fase 1 con fondi reali prima di aggiungere complessità
- **Code quality**: Ogni fase ha testing dedicato

### Q: Posso usare il plugin per più utenti?

**A**: 
- **Fase 1**: Sì, ma tutti gli utenti condividono l'account #0 del plugin
  → Meglio avere un plugin per contratto/strategia
- **Fase 2**: Ogni borrow position è isolata, quindi più utenti OK
  → Trackare ownership con `userBorrowAccounts` mapping

### Q: Come gestisco la liquidazione?

**A**: 
- **Fase 2**: Monitor `healthFactor` tramite `getPositionSummary()`
- **Phase 2+**: Implementare sistema di alerting (es. The Graph, Gelato)
- **Emergency**: `closeBorrowPosition()` automatico se health < soglia

### Q: Dolomite vs Aave - differenze?

**A**:
| Feature | Dolomite | Aave |
|---------|----------|------|
| Architecture | Account-based (owner, number) | Address-based |
| Isolation | Borrow positions isolate | Single health per address |
| Complexity | Higher (account management) | Lower (simple lending) |
| Flexibility | Very high (custom strategies) | Medium |

### Q: Posso integrare con SwapManager?

**A**: 
- **Fase 1**: No, solo deposit/withdraw
- **Fase 2**: Sì! Per swappare collateral o repay debt
  ```solidity
  // In closeBorrowPosition():
  // 1. Swap current token to debt token via SwapManager
  // 2. Repay debt con result
  // 3. Recover collateral
  ```

---

## 📚 Resources

- **Dolomite Docs**: https://docs.dolomite.io
- **Smart Contract Addresses**: https://docs.dolomite.io/smart-contract-addresses
- **Managing Borrow Positions**: https://docs.dolomite.io/developer-documentation/managing-borrow-positions
- **Dolomite GitHub**: https://github.com/dolomite-exchange
- **Arbitrum Explorer**: https://arbiscan.io

---

## 🎉 Conclusione

Hai ora una **base solida** per integrare Dolomite nel tuo sistema:

1. ✅ **Interfacce complete** per tutte e 3 le fasi
2. ✅ **Implementazione Fase 1** (deposit/withdraw) pronta per deploy
3. ✅ **Architettura estendibile** per Fase 2 e 3
4. ✅ **Documentation dettagliata** per ogni step
5. ✅ **Deploy script** configurabile

**Prossimo step**: Trova gli indirizzi router e fai il primo deploy! 🚀

Se hai domande o vuoi procedere con Fase 2, fammi sapere! 💪
