## 📊 Flusso Completo: Prelievo WETH con Chiusura Automatica

### 🎯 Risposta Diretta

**`closePosition(positionId)`** chiude **SOLO posizioni leverage** (quelle con debt > 0).

**`closePositionsForWeth(targetAmount)`** chiude **ENTRAMBI**:
1. **Prima**: Depositi normali (no debt, solo yield farming)
2. **Poi**: Posizioni leverage (ordinate per rischio)

---

## 🔄 Flusso Completo: `withdrawWeth()`

Quando un utente chiede di prelevare WETH e non c'è abbastanza liquidità:

```
USER: withdrawWeth(10 WETH)
    ↓
LiquidityManager.withdrawWeth(10 WETH)
    ↓
[Check ProxyGeneral balance: 2 WETH disponibili]
    ↓
Needed: 10 - 2 = 8 WETH mancanti
    ↓
═══════════════════════════════════════════════════════
STEP 1: Swap Liquid Tokens → WETH
═══════════════════════════════════════════════════════
    ↓
_swapLiquidTokensForWeth(8 WETH)
    ├─ USDC balance: 1000 → Swap → 0.3 WETH
    ├─ DAI balance: 500  → Swap → 0.2 WETH
    └─ Total obtained: 0.5 WETH
    ↓
Still needed: 8 - 0.5 = 7.5 WETH
    ↓
═══════════════════════════════════════════════════════
STEP 2: Close Protocol Positions
═══════════════════════════════════════════════════════
    ↓
_closeProtocolPositionsForWeth(7.5 WETH)
    ↓
ProtocolManager.closePositionsForWeth(7.5 WETH)
    ↓
    ┌────────────────────────────────────────────┐
    │ EulerV2Plugin.closePositionsForWeth()      │
    │                                            │
    │ SUB-STEP 1: Close Normal Deposits         │
    │ ────────────────────────────────────────   │
    │ _closeNormalDepositsForWeth(7.5 WETH)     │
    │   ├─ WETH vault (no debt): 3 WETH         │
    │   │   → Withdraw 3 WETH ✅                │
    │   ├─ USDC vault (no debt): 1000 USDC      │
    │   │   → Withdraw + Swap → 0.5 WETH ✅     │
    │   └─ Total: 3.5 WETH                      │
    │                                            │
    │ Still needed: 7.5 - 3.5 = 4 WETH          │
    │                                            │
    │ SUB-STEP 2: Close Leverage Positions      │
    │ ────────────────────────────────────────   │
    │ getPositionsSortedByRisk() → [pos1, pos2] │
    │                                            │
    │ Position 1 (HF: 1.2x - RISKIER) 🔴        │
    │   ├─ Collateral: 0.6 WETH                 │
    │   ├─ Debt: 900 USDC                       │
    │   ├─ closeLeverageAtomic()                │
    │   │   ├─ Flash loan 900 USDC              │
    │   │   ├─ Repay debt                       │
    │   │   ├─ Withdraw 0.6 WETH                │
    │   │   ├─ Swap part WETH → USDC            │
    │   │   └─ Repay flash loan                 │
    │   └─ Returns: ~0.25 WETH ✅               │
    │                                            │
    │ Still needed: 4 - 0.25 = 3.75 WETH        │
    │                                            │
    │ Position 2 (HF: 1.8x - SAFER) 🟢          │
    │   ├─ Collateral: 1 WETH                   │
    │   ├─ Debt: 1500 USDC                      │
    │   ├─ closeLeverageAtomic()                │
    │   └─ Returns: ~0.4 WETH ✅                │
    │                                            │
    │ Total from leverage: 0.65 WETH            │
    └────────────────────────────────────────────┘
    ↓
Total obtained: 3.5 + 0.65 = 4.15 WETH
    ↓
Final balance: 2 + 0.5 + 4.15 = 6.65 WETH
    ↓
❌ Still short! Need 10, have 6.65
    ↓
═══════════════════════════════════════════════════════
STEP 3: Multi-Swap Fallback (if still needed)
═══════════════════════════════════════════════════════
    ↓
_performMultiSwapIfNeeded(3.35 WETH still needed)
    └─ Additional swaps or revert
```

---

## 🔍 Differenza Chiave

### `closePosition(positionId)` - Singola Posizione Leverage

```solidity
function closePosition(uint256 positionId) external override returns (uint256) {
    // Recupera posizione da storage
    LeveragePositionStorage storage pos = _positions[positionId];
    
    // Chiama atomic close per questa specifica posizione
    wethReturned = this.closeLeverageAtomic(params);
    
    // Marca come chiusa
    pos.isActive = false;
}
```

**Usa**: 
- ❌ NON chiamata automaticamente da LiquidityManager
- ✅ Usata da altri contratti tramite `IProtocolAdapter.closePosition()`
- ✅ Chiude **UNA specifica posizione leverage**

---

### `closePositionsForWeth(targetAmount)` - Smart Multi-Step

```solidity
function closePositionsForWeth(uint256 targetAmount) external override returns (uint256, uint256) {
    // STEP 1: Depositi normali (più sicuri)
    (weth1, closed1) = _closeNormalDepositsForWeth(targetAmount);
    
    if (weth1 >= targetAmount) return; // Done!
    
    // STEP 2: Leverage positions (più complesse)
    Position[] memory sorted = getPositionsSortedByRisk();
    
    for (position in sorted) {
        if (wethObtained >= targetAmount) break;
        
        // Chiama atomic close per ogni posizione leverage
        weth2 += closeLeverageAtomic(position);
    }
    
    return (weth1 + weth2, closed1 + closed2);
}
```

**Usa**:
- ✅ Chiamata da `LiquidityManager.withdrawWeth()`
- ✅ Chiude **prima depositi semplici, poi leverage**
- ✅ Ordine: dal più sicuro al più rischioso
- ✅ Si ferma quando raggiunge target

---

## 📊 Priorità di Chiusura

### Order of Operations in `closePositionsForWeth()`:

1. **Normal Deposits** (FIRST - Low Risk):
   ```
   WETH vault (shares > 0, debt = 0)
   USDC vault (shares > 0, debt = 0)
   DAI vault (shares > 0, debt = 0)
   ```
   - ✅ Nessun flash loan necessario
   - ✅ Gas efficiente
   - ✅ Swap automatico a WETH se necessario

2. **Leverage Positions** (SECOND - Higher Risk):
   ```
   Position 1: HF 1.2x (RISKIEST) 🔴
   Position 2: HF 1.5x          🟡
   Position 3: HF 2.0x (SAFEST) 🟢
   ```
   - ⚠️ Richiede flash loan
   - ⚠️ Gas più alto
   - ✅ Chiude prima quelle più rischiose

---

## ✅ Risposta Finale

**Q1: `closePosition()` chiude solo leverage o tutto?**
→ **Solo posizioni leverage** (quelle con `debt > 0`)

**Q2: Come funziona quando manca WETH?**
→ **Automatico**:
1. LiquidityManager verifica balance
2. Se manca, swap liquid tokens
3. Se ancora manca, chiama `closePositionsForWeth()`
4. Plugin chiude **prima depositi normali**, poi leverage (dal più rischioso)
5. Continua fino a raggiungere target o finire posizioni

**Q3: Chi chiama `closePosition()` vs `closePositionsForWeth()`?**
- `closePosition(id)`: Contratti esterni via IProtocolAdapter (singola posizione)
- `closePositionsForWeth(amount)`: LiquidityManager automaticamente (multi-posizione smart)

**Il sistema è progettato per multi-protocol sin dal principio:**

## Architettura Multi-Protocol

**ProtocolManager.closePositionsForWeth()** (ProtocolManager.sol):
```solidity
// Loops through ALL registered protocols
for (uint256 i = 0; i < registeredProtocolNames.length && wethObtained < targetWethAmount; i++) {
    string memory name = registeredProtocolNames[i];
    ProtocolInfo storage info = protocols[name];
    if (!info.isActive) continue;
    
    uint256 stillNeeded = targetWethAmount - wethObtained;
    
    // Calls each protocol's plugin
    try IProtocolAdapter(info.plugin).closePositionsForWeth(stillNeeded) 
        returns (uint256 obtained, uint256 closed) 
    {
        wethObtained += obtained;
        totalPositionsClosed += closed;
    } catch {
        // Skip failed protocol, continue with next
    }
}
```

## Funzionalità Chiave

1. **Protocol Registry** ([line 520](TestSmartContract/contracts/ProtocolManager.sol#L520)):
   - `registerProtocol("Euler", eulerPlugin, eulerLens, eulerRegistry)`
   - `registerProtocol("Aave", aavePlugin, aaveLens, aaveRegistry)` ← futuro
   - Ogni protocollo ha: plugin, lensAdapter, registry opzionale

2. **Interfaccia Standard IProtocolAdapter**:
   - Ogni protocollo implementa `closePositionsForWeth()`
   - Garantisce comportamento uniforme

3. **Zero Modifiche a LiquidityManager**:
   - Chiama solo `protocolManager.closePositionsForWeth(targetAmount)`
   - Non sa quanti/quali protocolli esistono

**Quindi**: Domani aggiungi Aave/Compound/Dolomite semplicemente registrando il nuovo protocol senza toccare LiquidityManager! 🚀