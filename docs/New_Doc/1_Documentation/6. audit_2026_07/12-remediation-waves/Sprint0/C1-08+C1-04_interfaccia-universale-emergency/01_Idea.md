# C1-08 + C1-04 — Interfaccia universale pair-based + Emergency No-drain — IDEA

**Fix ID:** C1-08 (interfaccia) + C1-04 (emergency) — trattati **insieme** perché l'unwind uniforme dell'emergenza dipende dall'interfaccia universale.
**Severity:** CRITICAL (entrambi)
**Decisioni:** DEC-006 (pair-based), DEC-007 (No-drain), DEC-008 (access control A2/B2/C)
**Design approvato:** `security/design/UNIVERSAL_LENDING_INTERFACE.md`
**Ordine:** secondo dello Sprint 0 (dopo C1-09). È il blocco architetturale più grande (8-16h).

---

## Perché C1-08 e C1-04 si fanno insieme

Sembrano due fix distinti ma condividono lo stesso perno tecnico:

- **C1-08** rende `ProtocolManager` l'unico punto di ingresso pair-based per tutte le operazioni di lending su tutti i plugin.
- **C1-04** (No-drain) richiede un **unwind uniforme**: chiudere TUTTE le posizioni (leverage + supply) su TUTTI i plugin, ordinandole per rischio, riportando i fondi a base asset in custody.

L'unwind uniforme è possibile **solo** se tutti i plugin espongono la stessa interfaccia di chiusura posizione — cioè **solo dopo C1-08**. Farli separati significherebbe scrivere `closePositionsForBaseAsset` due volte (una con l'interfaccia vecchia, una con la nuova). Insieme = un solo giro.

---

## Cosa non va oggi (i due bug)

### C1-08 — interface drift (IFC-004 + PLG-084)
- `ProtocolManager` chiama `ILendingProtocol(plugin).borrow(loanCode, amount)` (mono-token, Aave-centrico).
- `MorphoPlugin` implementa `borrow(collateral, loan, amount)` (pair-based).
- → puntando a Morpho, **selector non trovato → revert** (IFC-004).
- Il bypass `owner()` nei modifier `onlyProtocolManager` ha **nascosto** il bug: i test chiamavano `plugin.connect(owner)` direttamente, mai via ProtocolManager (PLG-084).

### C1-04 — emergency drain + selector rotto
- `EmergencyHandler.emergencyWithdraw()` chiama `ProxyGeneral.emergencyTransfer(...)` che **non esiste** → revert nascosto da try/catch, evento emesso con 0 trasferiti.
- Anche se fixassimo il selector, la funzione manda tutto a `owner()` = **rug vector** (No-drain lo vieta).
- `closePositionsForBaseAsset` ha semantica **incoerente** tra i 5 plugin (CORE-081): serve unwind uniforme.

---

## L'idea di soluzione

### Parte 1 — Interfaccia universale (C1-08)
1. Riscrivere `ILendingProtocol` **pair-based**: `supplyCollateral/withdrawCollateral/borrow/repay/getCollateral/getDebt/getHealthFactor(collateral, loan, ...)`.
2. Nuova `ILeverageProtocol` con `OpenLeverageParams`/`CloseLeverageParams` (includono `minCollateralAfterSwap`, `maxSlippageBps`, `deadline`).
3. `ProtocolManager` = unico ingresso: `supplyCollateral/borrow/repay/openLeverage/closeLeverage` con routing pair-based + `onlyOperator` (owner + registro VAC, **DEC-008 A2**).
4. **Rimuovere il bypass `owner()`** dai modifier dei plugin (chiude PLG-084). Un solo escape hatch `emergencyClosePosition` onlyOwner documentato.
5. Migrazione plugin: **Morpho già pair-based** (solo `override` + nomi); **Aave/Euler** aggiungono il param `collateral`; **MorphoVault** supply-only con `loan==collateral`; **InterVault** allineato.

### Parte 2 — Emergency No-drain (C1-04)
6. **Rimuovere** `emergencyWithdraw()`-to-owner + `emergencyTransfer`/`emergencyTransferAll`-verso-owner. Nessuna funzione dà custody dei fondi all'owner.
7. **Emergenza = pausa + unwind + LP withdraw:**
   - `pause()` / `emergencyUnwindAll()` triggerabili da **owner + emergency contacts** (DEC-008 B2). `unpause()` solo owner.
   - **unwind uniforme** (DEC-007): raccogli TUTTE le posizioni, ordina per HF crescente (più rischiose prima), chiudi progressivamente. Withdrawal mode = fino a `targetAmount`; emergency mode = tutto.
   - pool in "withdraw-only": gli LP ritirano pro-rata via `LiquidityManager.withdraw`.
8. Uniformare `closePositionsForBaseAsset` su tutti i plugin secondo la semantica sort-by-risk (chiude CORE-081).

### Access control (DEC-008)
- `onlyOperator` = `owner()` (hardcoded) + `authorizedOperators[msg.sender]` (registro gestito da owner). La VAC ci sta dentro e può fare **tutte** le operazioni di ribilanciamento (C).
- Emergency trigger = owner + emergency contacts (B2).
- Nessun operatore (VAC inclusa) può muovere fondi verso un EOA esterno (No-drain).

---

## Finding che questa wave chiude

| Finding | Come |
|---------|------|
| IFC-004 | root del drift risolto (ProtocolManager pair-based) |
| PLG-084 | bypass owner rimosso |
| IFC-022/23/24 | override aggiunti |
| PLG-030..035 (parz.) | slippage params negli struct leverage |
| CORE-001, CORE-015, CORE-010 | emergencyTransfer/All-to-owner rimossi |
| NEW-010, NEW-018 | executed-flag / no-whenPaused rimossi con la funzione |
| CORE-081 | closePositionsForBaseAsset uniformato (sort-by-risk) |

---

## Rischi principali (dettaglio in 02)
- Breaking change su tutta la superficie lending → tutti i test da riscrivere come user-journey.
- Storage layout dei plugin: verificare con `forge inspect storage-layout` prima/dopo.
- Perdere l'escape hatch in emergenza → mitigato da `emergencyClosePosition` onlyOwner + property test sul path withdraw+unwind.

---

## Strategia di test
User-journey via ProtocolManager (non più `plugin.connect(owner)`):
- Operatore apre/chiude posizioni su ogni plugin via ProtocolManager (il test che oggi fallirebbe per Morpho).
- LP deposita/ritira; NON può toccare ProtocolManager.
- Emergency: owner/emergency-contact pausa + unwind → LP ritira pro-rata; owner NON può drenare.
- Unwind sort-by-risk: le posizioni più rischiose si chiudono prima; withdrawal si ferma a targetAmount.

→ dettaglio completo, mappa del codice attuale e piano file-per-file in `02_Idea_Dettagliata.md`.
