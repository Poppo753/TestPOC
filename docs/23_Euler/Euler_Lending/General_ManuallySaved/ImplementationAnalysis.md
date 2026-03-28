Analyze existing contracts architecture

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/ProtocolManager.sol)

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/SwapManager.sol#1-1), lines 1 to 500

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/ILendingProtocol.sol)

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/plugins/DolomitePlugin.sol#1-1), lines 1 to 500

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/plugins/DolomitePlugin.sol#500-500), lines 500 to 981

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/Liquiditymanager.sol#1-1), lines 1 to 600

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/TokenManager.sol#1-1), lines 1 to 400

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/ValueCalculator.sol#1-1), lines 1 to 400

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/Liquiditymanager.sol#600-600), lines 600 to 984

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/ValueCalculator.sol#400-400), lines 400 to 613

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/IProtocolManager.sol#1-1), lines 1 to 100

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/IBeacon.sol)

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/IProtocolManager.sol#100-100), lines 100 to 162

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/IProxyGeneral.sol#1-1), lines 1 to 100

Ottimo, ho analizzato a fondo tutti i tuoi contratti. Ora ho un quadro completo dell'architettura. Permettimi di scriverti un documento di analisi e proposta di implementazione.

---

## 📋 Analisi e Proposta di Integrazione Euler V2

### La Tua Idea è Coerente e Fattibile ✅

La tua proposta di creare un **EulerV2Plugin** che implementa `ILendingProtocol` è perfettamente allineata con l'architettura esistente. Hai già un pattern consolidato con `DolomitePlugin` che possiamo replicare.

---

## 🏗️ Architettura Proposta

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                BEACON (Registry)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
         ┌──────────────────────────────┼───────────────────────────────────┐
         ▼                              ▼                                   ▼
┌─────────────────┐          ┌──────────────────┐              ┌──────────────────┐
│  ProxyGeneral   │◄─────────│ ProtocolManager  │──────────────│ EulerOracleAdapter│
│  (Custody)      │          │  (Orchestrator)  │              │ (Health Monitor)  │
└─────────────────┘          └──────────────────┘              └──────────────────┘
                                        │                                   │
                    ┌───────────────────┼───────────────────┐               │
                    ▼                   ▼                   ▼               │
           ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
           │DolomitePlugin│    │EulerV2Plugin │◄───│    EVC       │◄────────┘
           └──────────────┘    └──────────────┘    │  (Batching)  │
                                      │            └──────────────┘
                                      ▼
                               ┌──────────────┐
                               │ Euler Vaults │
                               │ (eWETH, eUSDC│
                               │  eUSDT, etc) │
                               └──────────────┘
```

---

## 🔍 Considerazioni Chiave

### 1. **Dove Mettere il Plugin: ProtocolManager (non SwapManager)**

Il tuo `EulerV2Plugin` dovrebbe integrarsi con **ProtocolManager**, non SwapManager, perché:
- `ProtocolManager` gestisce già lending protocols via `ILendingProtocol`
- `SwapManager` è per swap spot, non per posizioni
- Il pattern custody (ProxyGeneral ↔ Plugin ↔ External Protocol) è già definito

### 2. **Separazione delle Responsabilità**

| Componente | Responsabilità |
|------------|----------------|
| **EulerV2Plugin** | deposit, withdraw, borrow, repay, posizioni con leva |
| **EulerOracleAdapter** | health monitoring, valori posizioni, integrazione con ValueCalculator |

**Perché separare l'Oracle?**
- Il tuo `ValueCalculator` già usa un pattern modulare (`IOracleAdapter`)
- La logica di auto-swap in `LiquidityManager` ha bisogno di conoscere il valore delle posizioni Euler
- Separando, l'oracle può essere usato da più componenti senza accoppiamento

### 3. **Complessità delle Posizioni con Leva**

Euler V2 usa **EVC batching** per operazioni atomiche. Questo significa che:

```
Aprire posizione con leva = 1 transazione con batch di 7 operazioni
```

La domanda è: **dove gestire questa complessità?**

**Opzione A**: Tutto nel Plugin (Consigliata)
```solidity
// EulerV2Plugin.sol
function openLeveragePosition(
    string memory collateralTokenCode,
    string memory borrowTokenCode,
    uint256 collateralAmount,
    uint256 borrowAmount,
    bytes memory swapData  // Per il Swapper Euler
) external returns (uint256 positionId);
```
- Pro: Incapsula tutta la logica Euler
- Pro: Più facile da testare e auditare
- Con: Più gas per le chiamate

**Opzione B**: ProtocolManager coordina i singoli step
- Pro: Più controllo dall'esterno
- Con: Più complesso, più chiamate esterne

### 4. **Gestione Sub-Accounts Euler**

Euler V2 supporta **256 sub-accounts** per wallet. Questo è simile ai tuoi account Dolomite (#0, #1, #2...).

Suggerisco:
- **Sub-account 0**: Depositi semplici (yield farming)
- **Sub-account 1-N**: Posizioni con leva isolate

---

## 📄 Struttura Proposta dei Contratti

### EulerV2Plugin.sol

```solidity
// Implementa ILendingProtocol (che include IProtocolManager)
contract EulerV2Plugin is ILendingProtocol, Ownable, ReentrancyGuard {
    
    // === FUNZIONI BASE (via ProtocolManager) ===
    function deposit(string memory tokenCode, uint256 amount) external returns (bool);
    function withdraw(string memory tokenCode, uint256 amount) external returns (bool);
    function borrow(string memory tokenCode, uint256 amount) external returns (bool);
    function repay(string memory tokenCode, uint256 amount) external returns (bool);
    
    // === FUNZIONI POSIZIONI (chiamate direttamente) ===
    function openLeveragePosition(OpenLeverageParams calldata params) external returns (uint256 positionId);
    function closeLeveragePosition(uint256 positionId) external returns (uint256 collateralReturned);
    function addCollateralToPosition(uint256 positionId, uint256 amount) external;
    function removeCollateralFromPosition(uint256 positionId, uint256 amount) external;
    
    // === VIEW FUNCTIONS ===
    function getPositionHealth(uint256 positionId) external view returns (uint256 healthFactor);
    function getPositionValue(uint256 positionId) external view returns (uint256 collateralValue, uint256 debtValue);
    function getAllPositions() external view returns (PositionInfo[] memory);
}
```

### EulerOracleAdapter.sol

```solidity
// Implementa IOracleAdapter per integrarsi con ValueCalculator
contract EulerOracleAdapter is IOracleAdapter {
    
    // === ORACLE STANDARD (per TokenManager) ===
    function getPrice(string memory tokenCode) external view returns (uint256 price, uint256 timestamp, bool isValid);
    
    // === EULER-SPECIFIC (per LiquidityManager auto-close) ===
    function getTotalEulerValue() external view returns (uint256);  // Collateral - Debt
    function getEulerPositionsAtRisk(uint256 minHealthFactor) external view returns (uint256[] memory positionIds);
    function shouldAutoClosePosition(uint256 positionId, uint256 threshold) external view returns (bool);
}
```

---

## 🔄 Flusso Auto-Withdrawal con Euler

La tua `LiquidityManager` già ha la logica per auto-swap quando WETH è insufficiente. Per integrare Euler:

```
User richiede withdrawal 10 ETH
         ↓
LiquidityManager verifica: WETH in ProxyGeneral = 3 ETH
         ↓
Mancano 7 ETH → _executeAutomaticSwap()
         ↓
1. Prima: swap token con % più bassa (USDC, WBTC, etc.)
2. Se ancora insufficiente: chiudi posizioni Euler
         ↓
EulerOracleAdapter.getEulerPositionsAtRisk(1.5e18) // Posizioni con HF < 1.5
         ↓
Per ogni posizione a rischio:
   EulerV2Plugin.closeLeveragePosition(positionId)
         ↓
ETH ritorna a ProxyGeneral
         ↓
Withdrawal completo
```

### Modifica a LiquidityManager

```solidity
function _executeAutomaticSwap(uint256 wethNeeded, ...) internal {
    // 1. Prova swap normali (già implementato)
    // ...
    
    // 2. Se ancora insufficiente, chiudi posizioni Euler
    if (wethStillNeeded > 0) {
        _closeEulerPositionsForWeth(wethStillNeeded);
    }
}

function _closeEulerPositionsForWeth(uint256 wethNeeded) internal {
    IEulerOracleAdapter oracle = IEulerOracleAdapter(beacon.get("EulerOracleAdapter"));
    IEulerV2Plugin plugin = IEulerV2Plugin(beacon.get("EulerV2Plugin"));
    
    uint256[] memory riskyPositions = oracle.getEulerPositionsAtRisk(1.5e18);
    
    for (uint256 i = 0; i < riskyPositions.length && wethStillNeeded > 0; i++) {
        uint256 returned = plugin.closeLeveragePosition(riskyPositions[i]);
        wethStillNeeded = returned >= wethStillNeeded ? 0 : wethStillNeeded - returned;
    }
}
```

---

## ✅ Raccomandazioni Finali

### 1. **Inizia con le Funzioni Base**

Prima implementa deposit/withdraw/borrow/repay senza leva. Testa a fondo prima di aggiungere la complessità delle posizioni leverage.

### 2. **Usa Batch EVC per Operazioni Atomiche**

Per posizioni con leva, DEVI usare `evc.batch()` per garantire atomicità:
- Se uno step fallisce, tutto viene revertato
- Nessun rischio di stati intermedi

### 3. **Circuit Breaker**

Implementa `circuitBreakerTripped` come in DolomitePlugin per emergenze.

### 4. **Test su Fork Arbitrum**

Prima di mainnet, testa tutto su fork con:
```bash
npx hardhat node --fork https://arb1.arbitrum.io/rpc
```

### 5. **Whitelisting Selectors**

Per funzioni come `openLeveragePosition`, aggiungi alla whitelist di ProtocolManager:
```solidity
protocolManager.setAllowedSelectors("EulerV2Plugin", [
    bytes4(keccak256("openLeveragePosition((...))")),
    bytes4(keccak256("closeLeveragePosition(uint256)"))
], true);
```

---

## 🎯 Prossimi Passi

1. **Creare interfaccia `IEulerV2Plugin`** estendendo `ILendingProtocol`
2. **Creare `EulerV2Plugin.sol`** con funzioni base (deposit, withdraw)
3. **Testare deposit/withdraw** su fork
4. **Aggiungere borrow/repay**
5. **Aggiungere posizioni con leva**
6. **Creare `EulerOracleAdapter.sol`**
7. **Integrare con LiquidityManager** per auto-close

