# Sessione 2 Dicembre 2025 - Implementazione Modular Withdrawal Flow

## Obiettivo della Sessione

Implementare un sistema modulare per chiudere posizioni su qualsiasi protocollo (Euler, Dolomite, futuri) per ottenere WETH quando richiesto da LiquidityManager. Il sistema deve essere estensibile: aggiungendo un nuovo plugin, il flusso di withdrawal deve automaticamente includerlo senza modifiche a LiquidityManager.

---

## Architettura Implementata

### Flow Completo (Modular Withdrawal)

```
User richiede withdrawal WETH
        ↓
LiquidityManager.withdrawWethToUser()
        ↓
_closeProtocolPositionsForWeth(amountNeeded)  [NUOVO - MODULARE]
        ↓
IProtocolManager(protocolManager).closePositionsForWeth(amountNeeded)
        ↓
ProtocolManager.closePositionsForWeth() [LOOP su TUTTI i protocolli registrati]
        ↓
for each protocol in registeredProtocolNames:
    IProtocolAdapter(plugin).closePositionsForWeth(stillNeeded)
        ↓
[EulerV2Plugin]:
    1. _closeNormalDepositsForWeth() → Chiude depositi senza leverage
    2. _closeLeverageAtomicForWeth() → Chiude posizioni leverage con flash loan
        ↓
WETH ritorna a ProxyGeneral → LiquidityManager → User
```

### I "Tre Moschettieri" Pattern

Per ogni protocollo servono 3 componenti:

1. **Plugin** (es. `EulerV2Plugin.sol`)
   - Implementa `IProtocolAdapter` 
   - Esegue azioni: deposit, withdraw, openLeverage, closeLeverage, closePositionsForWeth

2. **LensAdapter** (es. `EulerLensAdapter.sol`)
   - Query di sola lettura: getHealthFactor, getTotalValue, getPositionsAtRisk
   - Non modifica stato

3. **Registry** (es. `EulerVaultRegistry.sol`)
   - Mappatura tokenCode → vault address
   - Configurazione specifica del protocollo

---

## File Modificati

### 1. `contracts/Liquiditymanager.sol`

**Modifiche:**
- ❌ RIMOSSO: `_closeEulerPositionsForWeth()` (Euler-specifico)
- ❌ RIMOSSO: `_closeEulerNormalDepositsForWeth()` (Euler-specifico)
- ❌ RIMOSSO: Import di `IEulerV2Plugin`, `IEulerLensAdapter`, `IEVault`
- ✅ AGGIUNTO: Import di `IProtocolManager`
- ✅ AGGIUNTO: `_closeProtocolPositionsForWeth()` (modulare, delega a ProtocolManager)

**Nuova funzione:**
```solidity
function _closeProtocolPositionsForWeth(uint256 targetWethAmount) 
    internal 
    returns (uint256 wethObtained, uint256 positionsClosed) 
{
    address protocolManagerAddr = IBeacon(beacon).getImplementation("ProtocolManager");
    if (protocolManagerAddr == address(0)) {
        return (0, 0);
    }
    
    (wethObtained, positionsClosed) = IProtocolManager(protocolManagerAddr)
        .closePositionsForWeth(targetWethAmount);
    
    emit ProtocolPositionsClosedForWeth(positionsClosed, wethObtained);
}
```

### 2. `contracts/interfaces/ILiquidityManager.sol`

**Modifiche:**
- ❌ RIMOSSO: Eventi Euler-specifici (`EulerPositionsClosedForWeth`, `EulerNormalDepositsClosedForWeth`)
- ✅ AGGIUNTO: Evento generico `ProtocolPositionsClosedForWeth(uint256 positionsClosed, uint256 wethObtained)`

### 3. `contracts/interfaces/IProtocolManager.sol`

**Aggiunta alla fine (sezione MODULAR WITHDRAWAL):**
```solidity
function closePositionsForWeth(uint256 targetWethAmount) 
    external 
    returns (uint256 wethObtained, uint256 totalPositionsClosed);
```

### 4. `contracts/ProtocolManager.sol`

**Modifiche:**
- ✅ AGGIUNTO: Modifier `onlyOwnerOrLiquidityManager`
- ✅ La funzione `closePositionsForWeth()` già esistente ora ha questo modifier

**Modifier:**
```solidity
modifier onlyOwnerOrLiquidityManager() {
    address liquidityManager = IBeacon(beacon).getImplementation("LiquidityManager");
    require(
        msg.sender == owner() || msg.sender == liquidityManager,
        "ProtocolManager: caller is not owner or LiquidityManager"
    );
    _;
}
```

### 5. `contracts/plugins/EulerV2Plugin.sol`

**Modifiche alla funzione `closePositionsForWeth()`:**

**PRIMA** (solo leverage):
```solidity
function closePositionsForWeth(uint256 targetWethAmount) external override {
    // Solo loop su _positions (leverage)
    for (uint256 i = 0; i < sortedPositions.length; i++) {
        _closeLeverageAtomicForWeth(...);
    }
}
```

**DOPO** (depositi normali + leverage):
```solidity
function closePositionsForWeth(uint256 targetWethAmount) external override {
    // STEP 1: Prima chiude depositi normali (no debt, più semplici)
    (uint256 fromDeposits, uint256 depositsClosed) = _closeNormalDepositsForWeth(targetWethAmount, proxyGeneral);
    wethObtained += fromDeposits;
    
    // STEP 2: Poi chiude posizioni leverage (con flash loan)
    for (uint256 i = 0; i < sortedPositions.length; i++) {
        _closeLeverageAtomicForWeth(...);
    }
}
```

**Nuova funzione `_closeNormalDepositsForWeth()`:**
```solidity
function _closeNormalDepositsForWeth(
    uint256 targetWethAmount,
    address proxyGeneral
) internal returns (uint256 wethObtained, uint256 depositsClosed) {
    // Ottiene tutti i vault dalla registry
    (string[] memory tokenCodes, address[] memory vaults) = 
        IEulerVaultRegistry(vaultRegistry).getAllVaults();
    
    for (uint256 i = 0; i < vaults.length && wethObtained < targetWethAmount; i++) {
        address vault = vaults[i];
        
        // Check se abbiamo shares ma NO debt (= deposito normale, non leverage)
        uint256 shares = IEVault(vault).balanceOf(address(this));
        uint256 debt = IEVault(vault).debtOf(address(this));
        if (shares == 0 || debt > 0) continue;
        
        // Withdraw dal vault
        IEVault(vault).withdraw(maxWithdrawable, address(this), address(this));
        
        // Se è WETH, aggiungi direttamente
        // Se non è WETH, swap via FlashLoanService
    }
}
```

**Aggiunta all'interfaccia IEulerVaultRegistry (forward declaration):**
```solidity
interface IEulerVaultRegistry {
    // ... esistenti ...
    function getAllVaults() external view returns (string[] memory tokenCodes, address[] memory vaults);
}
```

### 6. `contracts/plugins/EulerV2Plugin.sol` - Flash Loan per Leverage Close

**Nuova funzione `_closeLeverageAtomicForWeth()`:**
Chiude una posizione leverage usando flash loan quando non c'è abbastanza liquidità:

```solidity
function _closeLeverageAtomicForWeth(
    string memory collateralToken,
    string memory borrowToken,
    uint256 positionId
) external returns (uint256 wethReturned) {
    // 1. Calcola debt da ripagare
    uint256 debtAmount = IEVault(borrowVault).debtOf(address(this));
    
    // 2. Esegue flash loan per ottenere USDC
    // 3. Nel callback: ripaga debt, ritira collaterale, swap a WETH
    // 4. Ripaga flash loan
    // 5. Ritorna WETH ottenuto
}
```

---

## Test Implementati e Risultati

### Test Suite: `EulerV2Plugin.closePositionsForWeth.test.ts`

| # | Test | Risultato |
|---|------|-----------|
| 1 | Should open 3 leverage positions with different leverage levels | ✅ PASS |
| 2 | Should close riskiest position first when requesting small amount | ✅ PASS |
| 3 | Should close multiple positions when requesting larger amount | ✅ PASS |
| 4 | Should return 0 when no active positions | ✅ PASS |
| 5 | Should handle target larger than available value | ✅ PASS |

**Totale: 5/5 PASS**

### Test Suite: `EulerLensAdapter.e2e.test.ts`

**Totale: 19/19 PASS** (nessuna regressione)

---

## Configurazione Test

Per eseguire i test su fork Arbitrum:

```powershell
cd "e:\Documents\Crypto\Defi\Arbitrum\Coding\Project4\TestSmartContract"
$env:FORK_ENABLED="true"
npx hardhat test test/integration/EulerV2Plugin.closePositionsForWeth.test.ts
npx hardhat test test/integration/EulerLensAdapter.e2e.test.ts
```

**Nota:** I test includono delay di 1.5s tra le chiamate RPC per evitare rate limiting (429 errors).

---

## DolomitePlugin

**Stato:** Escluso dalla compilazione (rinominato a `DolomitePlugin.sol.disabled`)

**Motivo:** Non implementa `closePositionsForWeth()` richiesto da `IProtocolManager`. Da completare in futuro quando si vorrà integrare Dolomite.

---

## Problemi Risolti Durante la Sessione

### 1. Rate Limiting RPC (429 errors)
**Soluzione:** Aggiunto `await sleep(1500)` tra le chiamate nei test

### 2. Modifier `onlyOwnerOrLiquidityManager` falliva
**Causa:** LiquidityManager non era registrato nel Beacon
**Soluzione:** Nel test setup, registrare LiquidityManager:
```typescript
await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());
```

### 3. `closeLeveragePosition` richiedeva USDC per ripagare il debito
**Problema:** Quando si chiude una posizione leverage, serve USDC per ripagare il debito prima di ritirare il collaterale
**Soluzione:** Creata `_closeLeverageAtomicForWeth()` che usa flash loan:
1. Flash loan di USDC
2. Ripaga debito
3. Ritira collaterale (WETH)
4. Se necessario, swap parte del collaterale per ripagare flash loan

### 4. Forward declaration `IEulerVaultRegistry` mancava `getAllVaults`
**Soluzione:** Aggiunta la funzione alla forward declaration in `EulerV2Plugin.sol`

---

## Prossimi Passi Suggeriti

1. **Testare il flusso completo end-to-end** partendo da `LiquidityManager.withdrawWethToUser()`

2. **Implementare DolomitePlugin.closePositionsForWeth()** quando si vorrà integrare Dolomite

3. **Ottimizzare dimensione contratto EulerV2Plugin** (attualmente 32KB, limite mainnet 24KB):
   - Estrarre funzioni in librerie
   - Usare external calls invece di public dove possibile
   - Rimuovere codice non necessario

4. **Aggiungere test per depositi normali** (non leverage) nel flow `closePositionsForWeth`

5. **Verificare che `_closeNormalDepositsForWeth` funzioni** con depositi reali (test attuali usano solo leverage)

---

## Contract Sizes (Post-Refactoring)

| Contratto | Size | Status |
|-----------|------|--------|
| EulerV2Plugin | 32,840 bytes | ⚠️ Supera limite 24KB mainnet |
| LiquidityManager | ~20KB | ✅ OK |
| ProtocolManager | ~15KB | ✅ OK |

---

## Riepilogo Modifiche per File

```
contracts/
├── Liquiditymanager.sol          [MODIFICATO] - Rimosso codice Euler-specifico, aggiunto _closeProtocolPositionsForWeth
├── ProtocolManager.sol           [MODIFICATO] - Aggiunto modifier onlyOwnerOrLiquidityManager
├── interfaces/
│   ├── ILiquidityManager.sol     [MODIFICATO] - Eventi generici invece di Euler-specifici
│   └── IProtocolManager.sol      [MODIFICATO] - Aggiunto closePositionsForWeth()
└── plugins/
    ├── EulerV2Plugin.sol         [MODIFICATO] - closePositionsForWeth ora gestisce depositi + leverage
    └── DolomitePlugin.sol.disabled [ESCLUSO] - Non implementa nuova interfaccia

test/integration/
└── EulerV2Plugin.closePositionsForWeth.test.ts [ESISTENTE] - 5 test passano
```
