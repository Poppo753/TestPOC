# Report — EVC Batch Refactor (Fifth Phase)

**Data**: Gennaio 2025  
**Contratto**: `EulerV2Plugin.sol`  
**Network**: Arbitrum Mainnet  
**Status**: ✅ Completato — Pronto per il deploy

---

## 1. Obiettivo

Refactoring completo di `EulerV2Plugin` per adottare il pattern ufficiale **EVC Batch** (`evc.batch(BatchItem[])`) di Euler V2, sostituendo le chiamate individuali dirette ai vault con operazioni atomiche in batch. Questo ha incluso anche la correzione di un **bug critico** sull'interfaccia `disableController`.

---

## 2. Bug Critico Risolto

### `disableController` — Signature Errata

| | Vecchia Interfaccia (IEVC.sol) | EVC Reale On-Chain |
|---|---|---|
| **Firma** | `disableController(address account, address vault)` | `disableController(address account)` |
| **Parametri** | 2 | 1 |
| **Function Selector** | Diverso | — |
| **Risultato** | ❌ REVERT su mainnet | ✅ Funzionante |

**Root Cause**: L'interfaccia IEVC.sol definiva `disableController` con 2 parametri, ma il contratto EVC reale deployato su Arbitrum (`0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066`) accetta solo 1 parametro. I function selector sono diversi, quindi qualsiasi chiamata a `disableController` con la vecchia interfaccia avrebbe causato un revert.

**Fix applicato**:
- `IEVC.sol`: cambiato `disableController(address account, address vault)` → `disableController(address account)`
- `IEVault.sol`: aggiunto `disableController()` (0 params) — il vault ha una propria funzione che internamente chiama `evc.disableController(account)` dove `msg.sender` è il vault (il controller effettivo)
- `FlashLoanPlugin.sol`: corretto chiamata `disableController` per usare la nuova firma

---

## 3. Modifiche Implementate

### 3.1 Helper `_batchItem()`

Aggiunta funzione interna per costruire `IEVC.BatchItem` struct in modo compatto:

```solidity
function _batchItem(
    address targetContract,
    address onBehalfOfAccount, 
    bytes memory data
) internal pure returns (IEVC.BatchItem memory)
```

Riduce la ripetizione di codice e la dimensione del bytecode nelle 6 funzioni che usano batch.

### 3.2 `deposit()` — Batch Atomico

**Prima**: 2 chiamate separate con status check ad ogni operazione
```
evc.enableCollateral(address(this), vault) → individuale
IEVault(vault).deposit(amount, address(this)) → individuale
```

**Dopo**: 1 batch atomico con status check differite
```
evc.batch([enableCollateral, deposit]) → atomico
```

Il batch salta `enableCollateral` se il collaterale è già abilitato (controllo `isCollateralEnabled`).

### 3.3 `borrow()` — Batch Atomico

**Prima**: 2 chiamate separate
```
evc.enableController(address(this), vault)
IEVault(vault).borrow(amount, address(this))
```

**Dopo**: 1 batch atomico
```
evc.batch([enableController, borrow])
```

Il batch salta `enableController` se il controller è già abilitato (controllo `isControllerEnabled`).

### 3.4 `closePosition(string, string)` — Batch Atomico (BIGGEST WIN)

**Prima**: 4 chiamate esterne separate con self-call pattern
```solidity
this.repay(borrowTokenCode, type(uint256).max);     // self-call esterno
evc.disableController(address(this), borrowVault);   // ❌ BUG — signature errata
this.withdraw(depositTokenCode, type(uint256).max);  // self-call esterno
evc.disableCollateral(address(this), depositVault);  // individuale
```

**Dopo**: 1 singolo batch atomico
```solidity
evc.batch([
    repay(type(uint256).max) on borrowVault,
    vault.disableController() on borrowVault,    // ✅ chiamata corretta al vault
    redeem(shares...) on depositVault,
    evc.disableCollateral(address(this), depositVault)
])
```

Vantaggi:
- Operazione completamente atomica (tutto o niente)
- Elimina self-calls esterni (`this.repay()`, `this.withdraw()`)
- Fix del bug `disableController`
- Status check differite → risparmio gas

### 3.5 `_handleOpenLeverageCallback()` — Batch Atomico

**Prima**: 4 chiamate individuali durante il callback del flash loan
```
evc.enableCollateral(...)
IEVault.deposit(...)
evc.enableController(...)
IEVault.borrow(...)
```

**Dopo**: 1 batch atomico
```solidity
evc.batch([enableCollateral, deposit, enableController, borrow])
```

### 3.6 `_handleCloseLeverageCallback()` — Batch Atomico

**Prima**: 2 chiamate + nessun cleanup EVC
```
IEVault.repay(...)
IEVault.redeem(...)
// disableController/disableCollateral MAI chiamati
```

**Dopo**: 1 batch atomico con cleanup completo
```solidity
evc.batch([
    repay on borrowVault,
    redeem on depositVault,
    vault.disableController() on borrowVault,
    evc.disableCollateral(address(this), depositVault)
])
```

### 3.7 `repay()` e `withdraw()` — Invariati

Queste funzioni sono rimaste come chiamate singole dirette ai vault. Il batch aggiunge complessità senza benefici per operazioni a singola chiamata. Il cleanup (disableController/disableCollateral) viene gestito in `closePosition`.

---

## 4. Ottimizzazione Bytecode

Dopo il refactoring EVC batch, il bytecode aveva raggiunto **26,143 bytes**, superando il limite di 24,576 bytes di 1,567 bytes. Sono state applicate le seguenti ottimizzazioni:

### 4.1 Codice Morto Rimosso

| Tipo | Elemento | Motivo |
|---|---|---|
| Event | `CollateralEnabled` | Emesso dall'EVC, non dal plugin |
| Event | `ControllerEnabled` | Emesso dall'EVC, non dal plugin |
| Event | `CollateralDisabled` | Emesso dall'EVC, non dal plugin |
| Event | `ControllerDisabled` | Emesso dall'EVC, non dal plugin |
| Error | `TokenNotRegistered` | Sostituito da require con stringa |
| Error | `DepositFailed` | Mai usato dopo il refactoring |
| Error | `WithdrawalFailed` | Mai usato dopo il refactoring |
| Error | `BorrowFailed` | Mai usato dopo il refactoring |
| Error | `RepayFailed` | Mai usato dopo il refactoring |
| Error | `PositionNotFound` | Mai usato |
| Constant | `MAIN_SUB_ACCOUNT` | Mai referenziato |

### 4.2 Funzioni WETH Duplicate Rimosse

Due funzioni di grandi dimensioni che duplicavano logica già presente:

- **`_closeLeverageAtomicForWeth()`** (~65 righe) — duplicava `closeLeverageAtomic()` con variazione minima. Eliminata e sostituita con `this.closeLeverageAtomic()` via self-call in `closePositionsForWeth()`.
- **`_closeNormalDepositsForWeth()`** (~70 righe) — duplicava `closePosition()`. La logica in `closePositionsForWeth()` ora usa `this.closeLeverageAtomic()` direttamente.

### 4.3 Modifier Aggiornato

```solidity
// Prima
modifier onlyOwnerOrLiquidityManager() {
    require(msg.sender == owner() || msg.sender == liquidityManager, "...");
}

// Dopo — permette self-calls da closePositionsForWeth
modifier onlyOwnerOrLiquidityManager() {
    require(
        msg.sender == owner() || 
        msg.sender == liquidityManager || 
        msg.sender == address(this),   // ← aggiunto
        "..."
    );
}
```

### 4.4 Risultato Finale

| Metrica | Pre-Refactor | Post-Refactor | Post-Ottimizzazione |
|---|---|---|---|
| **Bytecode** | 24,530 bytes | 26,143 bytes | **22,538 bytes** |
| **Margine** | 46 bytes (0.2%) | -1,567 bytes ❌ | **+2,038 bytes (8.3%)** ✅ |

---

## 5. File Modificati

| File | Tipo | Descrizione |
|---|---|---|
| `contracts/interfaces/euler/IEVC.sol` | Fix | `disableController(address, address)` → `disableController(address)` |
| `contracts/interfaces/euler/IEVault.sol` | Aggiunta | Aggiunto `disableController()` (0 params) |
| `contracts/plugins/EulerV2Plugin.sol` | Refactoring | Batch pattern + ottimizzazione bytecode |
| `contracts/plugins/FlashLoanPlugin.sol` | Fix | Corretta chiamata `disableController` |
| `test/integration/EulerV2Plugin.batch.test.ts` | Nuovo | Test suite completa (47 test) |
| `scripts/deployment/euler/upgrade-euler-plugin.ts` | Nuovo | Script di upgrade per deploy su mainnet |

---

## 6. Test Suite

### 6.1 Configurazione

- **Framework**: Hardhat + ethers.js v6 + Chai
- **Metodo**: Fork di Arbitrum mainnet (contratti Euler V2 reali)
- **Whale Impersonation**: Si usano whale address reali per ottenere WETH/USDC per i test
- **Contratti reali usati**: EVC (`0x6302...`), WETH Vault (`0x78E3...`), USDC Vault (`0x0a1e...`)

### 6.2 Risultati: 47/47 Test Passati ✅

| Sezione | # Test | Status |
|---|---|---|
| Deposit Operations | 5 | ✅ |
| Withdraw Operations | 4 | ✅ |
| Borrow Operations | 4 | ✅ |
| Repay Operations | 4 | ✅ |
| ClosePosition (string,string) | 3 | ✅ |
| OpenLeverageAtomic | 3 | ✅ |
| CloseLeverageAtomic | 3 | ✅ |
| Circuit Breaker | 4 | ✅ |
| Emergency Withdraw | 2 | ✅ |
| View Functions | 5 | ✅ |
| Full Cycle — EVC State | 3 | ✅ |
| Multi-Token Operations | 3 | ✅ |
| Gas Report | 4 | ✅ |
| **TOTALE** | **47** | **✅** |

### 6.3 Gas Report (da test su fork)

| Operazione | Gas Usato |
|---|---|
| Deposit (primo, con enableCollateral) | ~268,000 |
| Deposit (successivo, collaterale già abilitato) | ~195,000 |
| Borrow (primo) | ~370,000 |
| Borrow (successivo) | ~314,000 |
| ClosePosition | ~370,000 |
| OpenLeverageAtomic (2x WETH) | ~1,380,000 |
| CloseLeverageAtomic | ~818,000 |

### 6.4 Nota su ethers.js v6

La funzione `closePosition` ha due overload:
- `closePosition(string, string)` — chiude posizione specifica
- `closePosition(uint256)` — chiude per ID posizione

Con ethers.js v6, è necessario usare la notazione esplicita:
```typescript
plugin["closePosition(string,string)"]("USDC", "WETH")
```

---

## 7. Schema EVC Batch

### Come funziona `evc.batch()`

```
┌─────────────────────────────────────────────────┐
│              evc.batch(BatchItem[])              │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ enable   │  │ deposit  │  │ enable       │  │
│  │ Collat.  │→ │ (vault)  │→ │ Controller   │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│                                                  │
│  Status checks DEFERRED until batch completion   │
│  All-or-nothing: revert annulla tutto            │
└─────────────────────────────────────────────────┘
```

### BatchItem Structure

```solidity
struct BatchItem {
    address targetContract;      // EVC o Vault
    address onBehalfOfAccount;   // address(this) = il plugin
    uint256 value;               // 0 (no ETH)
    bytes data;                  // abi.encodeCall(...)
}
```

---

## 8. Deployment

### Script di Upgrade

```
scripts/deployment/euler/upgrade-euler-plugin.ts
```

**Sequenza**:
1. Valida network (Arbitrum 42161) e balance deployer
2. Verifica prerequisiti in Beacon (EulerRegistry, FlashLoanService, EulerLensAdapter)
3. Controlla ownership corrente di EulerRegistry
4. Deploya nuovo `EulerV2Plugin`
5. Verifica bytecode size < 24,576
6. Verifica configurazione (EVC address, Beacon reference)
7. Aggiorna Beacon: `beacon.updateImplementation("EulerV2Plugin", newAddress)`
8. Trasferisce ownership EulerRegistry al nuovo plugin
9. Salva deployment in `mainnet-latest.json`

**Comando**:
```bash
npx hardhat run scripts/deployment/euler/upgrade-euler-plugin.ts --network arbitrum
```

### Post-Upgrade Checklist

- [ ] Verificare ownership EulerRegistry → nuovo plugin
- [ ] Verificare autorizzazione FlashLoanService (via Beacon lookup)
- [ ] Test deposit con importo piccolo (0.001 WETH)
- [ ] Test withdraw
- [ ] Test borrow + repay
- [ ] Test closePosition
- [ ] Test openLeverageAtomic + closeLeverageAtomic
- [ ] Monitorare per 24h prima di incrementare gli importi

---

## 9. Riferimento alla Proposal

Mapping tra le fasi pianificate in `Proposal.md` e lo stato di completamento:

| Fase | Descrizione | Status |
|---|---|---|
| Phase 1 | Fix Interfaces (IEVC, IEVault) | ✅ Completato |
| Phase 2 | Add `_batchItem()` helper | ✅ Completato |
| Phase 3 | Refactor deposit/borrow | ✅ Completato |
| Phase 4 | Refactor closePosition | ✅ Completato |
| Phase 5 | Refactor flash loan callbacks | ✅ Completato |
| Phase 6 | Bytecode check + optimization | ✅ Completato (22,538 bytes) |
| Phase 7 | Testing | ✅ Completato (47/47 test) |

**Tutte le 7 fasi sono state completate con successo.**

---

## 10. Considerazioni Future

1. **`setAccountOperator` signature**: L'interfaccia IEVC ha `setOperator(address, bool)` ma l'EVC reale potrebbe avere `setAccountOperator(address, address, bool)` — da verificare se usato.
2. **Sub-account operations**: `addCollateral`/`removeCollateral` usano `evc.call()` — conversione a batch è lower priority ma possibile.
3. **EVC Operator pattern**: Il plugin potrebbe registrarsi come EVC operator per i sub-account per autorizzazione più semplice — da valutare in iterazione futura.
4. **Monitoring**: Post-deploy, monitorare gas usage reale vs test per confermare i risparmi del batch pattern.
