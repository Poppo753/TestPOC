# Problemi Aperti - Analisi Contract Size e Funzioni

**Data:** 2 Dicembre 2024  
**Contesto:** Dopo il refactoring di EulerV2Plugin per implementare IProtocolAdapter

---

## 1. Contract Size Problem

### Contratti che superano il limite (24,576 bytes):

| Contratto | Size Attuale | Limite | Eccesso |
|-----------|-------------|--------|---------|
| **EulerV2Plugin.sol** | 29,456 bytes | 24,576 | +4,880 bytes |
| **LiquidityManager.sol** | 25,414 bytes | 24,576 | +838 bytes |

### Perché è un problema?
- **EIP-170** (Spurious Dragon): Contratti > 24KB non sono deployabili su mainnet
- I test locali funzionano con `allowUnlimitedContractSize: true` in hardhat.config.ts
- Per mainnet deployment, DEVE essere risolto

### Cosa NON conta per il bytecode:
- **Commenti** (vengono rimossi in compilazione)
- **Nomi variabili** (solo gli slot storage contano)
- **Whitespace/formatting**

### Cosa CONTA per il bytecode:
- Numero di funzioni
- Complessità logica
- **Revert strings** (`require(x, "long message")` - queste SI contano!)
- Eventi (event definitions)
- Storage variables
- External/internal calls

### Soluzioni possibili:

#### A) Rimuovere Revert Strings Personalizzate
```solidity
// PRIMA (costa bytecode):
require(amount > 0, "Amount must be greater than zero");

// DOPO (usa meno bytecode):
if (amount == 0) revert ZeroAmount();  // Custom error definito altrove
```

#### B) Estrarre in Librerie
```solidity
// Creare: contracts/libraries/EulerV2PluginLib.sol
library EulerV2PluginLib {
    function convertToStandardPosition(...) internal view returns (...) { ... }
    function sortPositionsByRisk(...) internal view returns (...) { ... }
}
```

#### C) Splitting del Contratto
```
EulerV2PluginCore.sol     - deposit, withdraw, borrow, repay
EulerV2PluginLeverage.sol - openLeverageAtomic, closeLeveragePosition
```
Con un proxy che li coordina.

#### D) Rimuovere funzioni inutilizzate
Analizzare quali funzioni non vengono mai chiamate e rimuoverle.

---

## 2. Funzioni Ridondanti/Incomplete

### A) `getBorrowedAmount()` vs `getDebt()` (COMMENTATA)

**Stato:** Commentata in questa sessione

**Problema:** Facevano la stessa cosa identica:
```solidity
// getDebt() - MANTENUTA
function getDebt(string memory tokenCode) external view returns (uint256) {
    address vault = _getVaultSafe(tokenCode);
    if (vault == address(0)) return 0;
    return IEVault(vault).debtOf(address(this));
}

// getBorrowedAmount() - COMMENTATA (identica a getDebt)
// Chiamava internamente this.getDebt()
```

**Flusso dove `getDebt()` è usata:**
- Health factor calculation
- Repay flow
- Closing leverage positions
- Debt value reporting

**Azione completata:** `getBorrowedAmount` commentata nell'interfaccia e implementazione.

---

### B) `getBorrowCapacity()` (PLACEHOLDER)

**Stato:** Ritorna 0, implementazione non completata

```solidity
function getBorrowCapacity(string memory tokenCode) external view returns (uint256) {
    // TODO: Implementare con calcolo basato su collaterale e LTV
    return 0;
}
```

**A cosa servirebbe:**
Calcolare quanto PUOI ancora prendere in prestito considerando:
- Valore collaterale attuale
- LTV (Loan-to-Value) del mercato
- Debito già esistente

**Formula:**
```
borrowCapacity = (collateralValue * LTV) - currentDebt
```

**Esempio:**
```
Collaterale: 10 ETH = $30,000
LTV: 80%
Debito attuale: $10,000

Capacità: ($30,000 * 0.80) - $10,000 = $14,000
```

**Flusso dove sarebbe usata:**
- UI: mostrare all'utente quanto può ancora borroware
- LiquidityManager: verificare se ha margine prima di aprire nuove posizioni
- Risk management: allertare quando vicino al limite

**Azione suggerita:**
- Se non usata in UI/LiquidityManager → rimuovere (risparmia bytecode)
- Se necessaria → implementare con Euler AccountLens

---

### C) `closePositionsForWeth()` (IMPLEMENTATA, NON TESTATA)

**Stato:** Implementata, test creato ma fallisce per RPC rate limit

**Scopo:** Chiudere automaticamente posizioni leverage per ottenere WETH quando richiesto.

**Flusso:**
```
LiquidityManager richiede 5 WETH per withdraw
→ ProxyGeneral non ha abbastanza WETH
→ Chiama closePositionsForWeth(5 ETH)
→ Plugin:
   1. Prende tutte le posizioni attive
   2. Le ordina per health factor (riskiest first)
   3. Chiude una alla volta finché target raggiunto
→ Ritorna (wethObtained, positionsClosed)
```

**Tipo posizioni:** SOLO posizioni leverage, NON depositi semplici
- Depositi semplici: usa `withdraw("WETH", amount)` direttamente
- Posizioni leverage: complesse (ripaga debito, ritira collaterale, swap)

**Test creato:** `test/integration/EulerV2Plugin.closePositionsForWeth.test.ts`

**Problema attuale:** 429 Too Many Requests dal RPC pubblico

**Azione suggerita:**
- Testare con RPC privato (Alchemy/Infura)
- Oppure aspettare e riprovare più tardi

---

## 3. Analisi Funzioni Potenzialmente Inutilizzate

### Da verificare in EulerV2Plugin:

| Funzione | Probabilmente Usata? | Note |
|----------|---------------------|------|
| `openLeveragePosition()` | ❌ DEPRECATED | Usa `openLeverageAtomic()` invece |
| `getBorrowCapacity()` | ❓ Da verificare | Ritorna 0, placeholder |
| `getProtocolInfo()` | ❓ Da verificare | Non in IProtocolAdapter |
| Legacy helper functions | ❓ Da verificare | Potrebbero esserci funzioni interne non usate |

### Strategia per analisi:
1. Grep per ogni funzione nel codebase
2. Verificare se chiamata da altri contratti
3. Verificare se chiamata nei test
4. Se non usata → candidata per rimozione

---

## 4. Priorità Azioni

### Alta Priorità (Blockers per Mainnet):
1. **Ridurre EulerV2Plugin < 24KB**
   - Rimuovere `openLeveragePosition` deprecated
   - Estrarre helper in libreria
   - Usare custom errors invece di require strings

2. **Ridurre LiquidityManager < 24KB**
   - Stessa strategia

### Media Priorità:
3. **Testare `closePositionsForWeth`** con RPC privato
4. **Decidere su `getBorrowCapacity`**: implementare o rimuovere

### Bassa Priorità:
5. **Code cleanup**: rimuovere funzioni inutilizzate
6. **Ottimizzazione gas**: refactoring logiche complesse

---

## 5. Comandi Utili per Analisi

### Verificare size contratti:
```bash
npx hardhat compile
# Guardare i warnings nel output
```

### Cercare utilizzi di una funzione:
```bash
# In PowerShell
Get-ChildItem -Recurse -Include *.sol,*.ts | Select-String "getBorrowCapacity"
```

### Testare con RPC privato:
```bash
# In .env
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY

# Poi
$env:FORK_ENABLED = "true"
npx hardhat test test/integration/EulerV2Plugin.closePositionsForWeth.test.ts --network hardhat
```

---

## 6. Stato Test `closePositionsForWeth`

**File:** `test/integration/EulerV2Plugin.closePositionsForWeth.test.ts`

**Test cases:**
1. ✅ Setup - Open 3 leverage positions (2x, 3x, 4x)
2. ✅ Close riskiest first when requesting small amount
3. ✅ Close multiple positions when requesting larger amount  
4. ✅ Return 0 when no active positions
5. ✅ Handle target larger than available value

**Stato attuale:** Fallisce per 429 Rate Limit (RPC pubblico)

**Per eseguire con successo:**
- Usare RPC privato con rate limit più alto
- Oppure aggiungere sleep/delay tra le operazioni

---

*Documento da passare alla prossima chat per continuare il lavoro*
