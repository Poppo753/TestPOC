# 🔧 Piano di Integrazione Euler V2 - Parte 3

**Continuazione di:** 08_Integration_Plan_Part2.md

---

## Flussi Operativi

### Flusso 1: Deposit Semplice (via ProtocolManager)

```
┌─────────────┐      ┌─────────────────┐      ┌───────────────┐      ┌─────────────┐
│    Owner    │─────►│ ProtocolManager │─────►│ EulerV2Plugin │─────►│ Euler Vault │
│             │      │                 │      │               │      │             │
│ deposit()   │      │ withdrawToken() │      │ deposit()     │      │ deposit()   │
│             │      │ to plugin       │      │               │      │             │
└─────────────┘      └─────────────────┘      └───────────────┘      └─────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  ProxyGeneral   │
                     │  sends tokens   │
                     └─────────────────┘
```

**Chiamata:**
```solidity
protocolManager.deposit("EulerV2Plugin", "WETH", 1 ether);
```

**Sequenza:**
1. Owner chiama `ProtocolManager.deposit()`
2. ProtocolManager risolve plugin via Beacon
3. ProtocolManager chiama `ProxyGeneral.withdrawToken(WETH, 1 ether, plugin)`
4. EulerV2Plugin riceve WETH
5. EulerV2Plugin chiama `eulerVault.deposit(1 ether, address(this))`
6. Plugin ora detiene eWETH shares

---

### Flusso 2: Withdraw (via ProtocolManager)

```
┌─────────────┐      ┌─────────────────┐      ┌───────────────┐      ┌─────────────┐
│    Owner    │─────►│ ProtocolManager │─────►│ EulerV2Plugin │─────►│ Euler Vault │
│             │      │                 │      │               │      │             │
│ withdraw()  │      │                 │      │ withdraw()    │      │ withdraw()  │
│             │      │                 │      │               │      │             │
└─────────────┘      └─────────────────┘      └───────────────┘      └─────────────┘
                                                      │
                                                      ▼
                                             ┌─────────────────┐
                                             │  ProxyGeneral   │
                                             │ receives tokens │
                                             └─────────────────┘
```

**Chiamata:**
```solidity
protocolManager.withdraw("EulerV2Plugin", "WETH", 1 ether);
```

**Sequenza:**
1. Owner chiama `ProtocolManager.withdraw()`
2. ProtocolManager risolve plugin via Beacon
3. EulerV2Plugin chiama `eulerVault.withdraw(1 ether, address(this), address(this))`
4. EulerV2Plugin trasferisce WETH a ProxyGeneral
5. Token tornano in custody

---

### Flusso 3: Borrow (via ProtocolManager)

```
┌─────────────┐      ┌─────────────────┐      ┌───────────────┐      ┌─────────────┐
│    Owner    │─────►│ ProtocolManager │─────►│ EulerV2Plugin │─────►│ Euler Vault │
│             │      │                 │      │               │      │             │
│ borrow()    │      │                 │      │ borrow()      │      │ borrow()    │
│             │      │                 │      │               │      │             │
└─────────────┘      └─────────────────┘      └───────────────┘      └─────────────┘
                                                      │
                                                      ▼
                                             ┌─────────────────┐
                                             │  ProxyGeneral   │
                                             │ receives USDC   │
                                             └─────────────────┘
```

**Pre-requisiti:**
- Collaterale già depositato nel vault
- Collateral vault abilitato come collateral su EVC
- Borrow vault abilitato come controller su EVC

**Chiamata:**
```solidity
protocolManager.borrow("EulerV2Plugin", "USDC", 1000e6);
```

---

### Flusso 4: Aprire Posizione con Leva (Diretto)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         OPEN LEVERAGE POSITION                                │
│                         (Batch EVC Atomico)                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ProxyGeneral → EulerV2Plugin (collaterale iniziale)                     │
│                                                                              │
│  2. EVC.batch([                                                              │
│       deposit(collateral) → subAccount                                       │
│       enableCollateral(subAccount, collateralVault)                          │
│       enableController(subAccount, borrowVault)                              │
│       borrow(borrowAmount) → Swapper                                         │
│       Swapper.swap(borrowed → collateral)                                    │
│       deposit(swapped) → subAccount                                          │
│       SwapVerifier.verify(minAmount)                                         │
│     ])                                                                       │
│                                                                              │
│  3. Position registrata con positionId                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Chiamata (diretta al plugin):**
```solidity
// Prima: ProtocolManager trasferisce collaterale al plugin
protocolManager.executeProtocolCall(
    "EulerV2Plugin",
    abi.encodeCall(IProxyGeneral.withdrawToken, ("WETH", 1 ether, eulerPlugin))
);

// Poi: Apri posizione leverage
eulerV2Plugin.openLeveragePosition(OpenLeverageParams({
    collateralTokenCode: "WETH",
    borrowTokenCode: "USDC",
    collateralAmount: 1 ether,
    borrowAmount: 2000e6,
    minCollateralReceived: 0.8 ether,  // ~0.8 ETH minimum da swap
    swapData: aggregatorSwapData,       // Da API aggregator
    deadline: block.timestamp + 300
}));
```

**Risultato:**
- Sub-account #1 creato con ~1.8 ETH collaterale
- 2000 USDC debito
- Position ID = 0 registrato

---

### Flusso 5: Chiudere Posizione con Leva (Diretto)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         CLOSE LEVERAGE POSITION                               │
│                         (Batch EVC Atomico)                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. EVC.batch([                                                              │
│       withdraw(allCollateral) → Swapper                                      │
│       Swapper.swap(collateral → debt asset, targetDebt=0)                    │
│       repay(max) → close debt                                                │
│       SwapVerifier.verifyDebtMax(0)                                          │
│     ])                                                                       │
│                                                                              │
│  2. Collaterale residuo → ProxyGeneral                                       │
│                                                                              │
│  3. Position marcata inattiva                                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Chiamata:**
```solidity
uint256 collateralReturned = eulerV2Plugin.closeLeveragePosition(0);
// collateralReturned = ~0.2 ETH profit (esempio)
```

---

### Flusso 6: Auto-Close per Withdrawal (LiquidityManager)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTO-CLOSE EULER POSITIONS                                │
│                    (Durante Withdrawal)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User: withdraw(10 ETH)                                                     │
│            │                                                                │
│            ▼                                                                │
│  LiquidityManager: WETH in ProxyGeneral = 3 ETH                            │
│            │                                                                │
│            ▼ (mancano 7 ETH)                                                │
│  _executeAutomaticSwap():                                                   │
│     1. Swap token con % più bassa                                           │
│        → ottiene 4 ETH                                                      │
│     2. Ancora mancano 3 ETH                                                 │
│            │                                                                │
│            ▼                                                                │
│  _closeEulerPositionsForWeth():                                             │
│     1. Query EulerLensAdapter.getEulerPositionsAtRisk(1.5e18)              │
│     2. Per ogni posizione: closeLeveragePosition()                          │
│     3. Collaterale torna a ProxyGeneral                                     │
│            │                                                                │
│            ▼                                                                │
│  Withdrawal completo!                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Modifiche ai Contratti Esistenti

### 1. LiquidityManager.sol

Aggiungere supporto per auto-close posizioni Euler:

```solidity
// ==================== NUOVE FUNZIONI ====================

/// @notice Chiude posizioni Euler per ottenere WETH
/// @param wethNeeded Quantità di WETH necessaria
function _closeEulerPositionsForWeth(uint256 wethNeeded) internal returns (uint256 wethObtained) {
    // Verifica se EulerV2Plugin è configurato
    address lensAdapter = IBeacon(beacon).getImplementation("EulerLensAdapter");
    if (lensAdapter == address(0)) return 0;
    
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    if (plugin == address(0)) return 0;
    
    // Ottieni posizioni a rischio (HF < 1.5)
    uint256[] memory positionIds = IEulerLensAdapter(lensAdapter).getEulerPositionsAtRisk(1.5e18);
    
    uint256 wethBefore = IERC20(weth).balanceOf(proxyGeneral);
    
    for (uint256 i = 0; i < positionIds.length && wethObtained < wethNeeded; i++) {
        try IEulerV2Plugin(plugin).closeLeveragePosition(positionIds[i]) returns (uint256) {
            // Calcola WETH ottenuto
            uint256 wethAfter = IERC20(weth).balanceOf(proxyGeneral);
            wethObtained += wethAfter - wethBefore;
            wethBefore = wethAfter;
        } catch {
            // Ignora errori, continua con prossima posizione
            continue;
        }
    }
}

/// @notice Modifica alla funzione _executeAutomaticSwap esistente
function _executeAutomaticSwap(
    uint256 wethNeeded,
    IValueCalculatorForModules calculator,
    uint256 deadline
) internal returns (uint256 wethObtained) {
    // ... codice esistente per swap token ...
    
    // NUOVO: Se ancora insufficiente, chiudi posizioni Euler
    if (wethObtained < wethNeeded) {
        uint256 fromEuler = _closeEulerPositionsForWeth(wethNeeded - wethObtained);
        wethObtained += fromEuler;
    }
}
```

### 2. ValueCalculator.sol

Includere valore posizioni Euler nel calcolo pool:

```solidity
// ==================== MODIFICHE ====================

/// @notice Aggiornare getTotalPoolValue per includere Euler
function getTotalPoolValue() public view returns (PoolValueInfo memory info) {
    // ... codice esistente ...
    
    // NUOVO: Aggiungi valore posizioni Euler
    address eulerLens = IBeacon(beacon).getImplementation("EulerLensAdapter");
    if (eulerLens != address(0)) {
        try IEulerLensAdapter(eulerLens).getTotalEulerValue() returns (uint256 eulerValue) {
            info.totalValue += eulerValue;
            
            // Aggiungi come "token" virtuale per la vista
            // oppure track separatamente
            info.protocolValues.push(ProtocolValue({
                protocolName: "EulerV2",
                value: eulerValue,
                percentage: 0 // Calcolato dopo
            }));
        } catch {
            // Ignora se non disponibile
        }
    }
    
    // Ricalcola percentuali
    _recalculatePercentages(info);
}
```

### 3. Registrazione in Beacon

```solidity
// Dopo deploy dei contratti:

// 1. Registra EulerV2Plugin
IBeacon(beacon).upgradeImplementation("EulerV2Plugin", address(eulerPlugin));

// 2. Registra EulerLensAdapter
IBeacon(beacon).upgradeImplementation("EulerLensAdapter", address(eulerLensAdapter));

// 3. Whitelist function selectors in ProtocolManager
bytes4[] memory selectors = new bytes4[](4);
selectors[0] = IEulerV2Plugin.openLeveragePosition.selector;
selectors[1] = IEulerV2Plugin.closeLeveragePosition.selector;
selectors[2] = IEulerV2Plugin.addCollateralToPosition.selector;
selectors[3] = IEulerV2Plugin.removeCollateralFromPosition.selector;

protocolManager.setAllowedSelectors("EulerV2Plugin", selectors, true);
```

---

## Piano di Implementazione

### Fase 1: Fondamenta (1-2 settimane)

| Task | Descrizione | Priorità |
|------|-------------|----------|
| 1.1 | Creare `IEulerV2Plugin.sol` interfaccia | Alta |
| 1.2 | Creare `EulerV2Plugin.sol` con deposit/withdraw | Alta |
| 1.3 | Test unitari deposit/withdraw su fork | Alta |
| 1.4 | Registrare vault per WETH, USDC, USDT, WBTC | Alta |

### Fase 2: Lending Base (1 settimana)

| Task | Descrizione | Priorità |
|------|-------------|----------|
| 2.1 | Implementare borrow/repay | Alta |
| 2.2 | Implementare getDebt, getHealthFactor | Alta |
| 2.3 | Test unitari lending su fork | Alta |
| 2.4 | Test integrazione con ProtocolManager | Media |

### Fase 3: Leverage (2 settimane)

| Task | Descrizione | Priorità |
|------|-------------|----------|
| 3.1 | Implementare openLeveragePosition | Alta |
| 3.2 | Implementare closeLeveragePosition | Alta |
| 3.3 | Implementare gestione sub-accounts | Media |
| 3.4 | Test completi posizioni leverage su fork | Alta |

### Fase 4: Lens Adapter (1 settimana)

| Task | Descrizione | Priorità |
|------|-------------|----------|
| 4.1 | Creare `EulerLensAdapter.sol` | Alta |
| 4.2 | Implementare health monitoring | Alta |
| 4.3 | Implementare getEulerPositionsAtRisk | Media |
| 4.4 | Test integrazione con ValueCalculator | Media |

### Fase 5: Integrazione LiquidityManager (1 settimana)

| Task | Descrizione | Priorità |
|------|-------------|----------|
| 5.1 | Modificare _executeAutomaticSwap | Media |
| 5.2 | Implementare _closeEulerPositionsForWeth | Media |
| 5.3 | Test scenario auto-close | Alta |

### Fase 6: Test E2E e Deploy (1-2 settimane)

| Task | Descrizione | Priorità |
|------|-------------|----------|
| 6.1 | Test E2E completi su fork | Alta |
| 6.2 | Security review | Alta |
| 6.3 | Deploy su testnet (se disponibile) | Media |
| 6.4 | Deploy su mainnet Arbitrum | Alta |

---

## Rischi e Mitigazioni

### Rischio 1: Complessità EVC Batching

**Problema:** Il batching EVC è complesso e errori possono causare perdita fondi.

**Mitigazione:**
- Test estensivi su fork prima di mainnet
- Usare sempre SwapVerifier per verifiche
- Implementare circuit breaker
- Limitare importi iniziali

### Rischio 2: Oracle Stale

**Problema:** I Lens Euler potrebbero ritornare dati non aggiornati.

**Mitigazione:**
- Verificare timestamp nelle risposte
- Fallback a ChainlinkAdapter se Euler non risponde
- Aggiungere controlli isStale

### Rischio 3: Slippage su Swap

**Problema:** Swap durante leverage potrebbero avere slippage eccessivo.

**Mitigazione:**
- Usare sempre minOutputAmount
- Deadline su tutte le operazioni
- SwapVerifier per verifica post-swap

### Rischio 4: Liquidazione Durante Operazioni

**Problema:** Posizione potrebbe essere liquidata durante batch.

**Mitigazione:**
- Batch atomici (tutto o niente)
- Calcolare health factor prima di operazioni
- Margine di sicurezza su health threshold

### Rischio 5: Gas Costs

**Problema:** Batch EVC costosi in gas.

**Mitigazione:**
- Ottimizzare calldata
- Usare Permit2 dove possibile
- Batch operazioni multiple insieme

---

## Appendice: Indirizzi Chiave Arbitrum

| Contratto | Indirizzo |
|-----------|-----------|
| EVC | `0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066` |
| eVaultFactory | `0x78Df1CF5bf06a7f27f2ACc580B934238C1b80D50` |
| AccountLens | `0x90a52DDcb232e7bb003DD9258fA1235c553eC956` |
| VaultLens | `0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380` |
| UtilsLens | `0xDAf44060DCe217Fd603908A49fcaa1FA900304BE` |
| Swapper | `0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7` |
| SwapVerifier | `0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

---

## Note Finali

Questo piano fornisce una roadmap completa per l'integrazione di Euler V2 nel tuo sistema. I punti chiave sono:

1. **Riusa i pattern esistenti** - DolomitePlugin è il template perfetto
2. **Separazione responsabilità** - Plugin per operazioni, Lens per monitoring
3. **Atomicità** - EVC batch garantisce sicurezza
4. **Gradualità** - Inizia con deposit/withdraw, poi lending, poi leverage

Vuoi che proceda con la creazione dei file di interfaccia e del plugin base?
