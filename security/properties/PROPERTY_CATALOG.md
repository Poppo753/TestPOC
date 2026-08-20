# Property catalog — TestPOC security suite

**Ultimo aggiornamento:** 2026-07-15 al commit `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`.
**Fase checklist:** S6.

Ogni property qui elencata:
- ha un ID stabile (prefisso VAL/LP/WDR/CUST/GOV/ORC/HF/SWP/EMG);
- è collegata a uno o più finding in `security/findings/register.json`;
- ha un tipo (safety / liveness / accounting / governance);
- è verificata da almeno un motore (Hardhat/Foundry unit/Foundry fuzz/Foundry invariant/Echidna/Halmos/Fork);
- dichiara limiti del modello.

Status legenda:
- `IMPLEMENTED` — test esiste e gira in CI
- `PILOT` — test esiste nel pilot ma con modello semplificato (§S5.2)
- `PLANNED` — test da scrivere in prossimo sprint
- `BLOCKED-HUMAN` — richiede autorizzazione umana per semantica

## 1. NAV e valuation (§S6.2)

### VAL-001 — Token critico fallito invalida NAV
- **Type:** safety
- **Ref finding:** VALUATION-001, CORE-049, NEW-028, CORE-044
- **Statement:** Se `ValueCalculator.calculateTokenValue(tokenCode)` reverta per un token attivo, `getTotalPoolValue` DEVE revertare. Nessun deposit/withdraw normale procede su NAV parziale.
- **Precondizioni:** almeno 1 token registrato in `TokenManager.getActiveTokens()`.
- **Tolleranze:** nessuna.
- **Motore:** Foundry invariant (`test/foundry/invariant/*ValValidity*.invariant.t.sol` — PLANNED).
- **Limiti modello:** richiede mock di ValueCalculator con failure controllabile.
- **Status:** PLANNED (Sprint 0 dopo autorizzazione fix VALUATION-001).

### VAL-002 — Lens critica fallita invalida NAV
- **Type:** safety
- **Ref finding:** VALUATION-001, ADP-018, IFC-010
- **Statement:** Se un LensAdapter (Aave/Euler/Morpho/InterVault) ritorna revert o dato incoerente, `ProtocolManager.getAllProtocolsValue` DEVE revertare. Fallback silente proibito.
- **Motore:** Foundry invariant + Hardhat fork.
- **Status:** PLANNED.

### VAL-003 — ProtocolManager fail-open bloccato
- **Type:** safety
- **Ref finding:** VALUATION-001, CORE-052
- **Statement:** Fallimento di `ProtocolManager.getAllProtocolsValue()` NON deve triggerare fallback a `_getEulerPositionValue()` legacy in `ValueCalculator`.
- **Motore:** Foundry unit + Hardhat integration.
- **Status:** PLANNED.

### VAL-004 — View parziale espone `isValid=false`
- **Type:** liveness (diagnostica)
- **Ref finding:** VALUATION-001 remediation §C1-01
- **Statement:** `getTotalPoolValueBestEffort()` (nuova API) ritorna `(uint256 value, bool isValid, address[] failedTokens)`. Se `!isValid`, i callers economici (LM.deposit, LM.withdraw, VAC) devono revertare; solo la UI legge questa view.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN (semantica API cambia, richiede DEC-*).

### VAL-005 — Health unknown non ritorna healthy/max
- **Type:** safety
- **Ref finding:** PLG-037 (Euler max mask)
- **Statement:** Se `_getHealthFactor` incontra queryFailure, DEVE revertare o ritornare `(uint256 hf, bool isValid=false)`. Ritorno di `type(uint256).max` è vietato per callers economici.
- **Motore:** Foundry fuzz.
- **Status:** BLOCKED-HUMAN (cambia signature return).

### VAL-006 — Deposit/rebalance/normal withdraw revertano su NAV invalido
- **Type:** safety
- **Ref finding:** VALUATION-001 remediation
- **Statement:** Tutti i path economici in `LiquidityManager` e `ProtocolManager` chiamano `getTotalPoolValue` versione strict.
- **Motore:** Foundry invariant.
- **Status:** BLOCKED-HUMAN (dipende da VAL-004).

### VAL-007 — Emergency path non dipende dal NAV fallito
- **Type:** liveness
- **Ref finding:** VALUATION-001 remediation §C1-04
- **Statement:** `EmergencyHandler.emergencyWithdraw()` legge balance delta reali (via `IERC20.balanceOf`), NON il NAV computato.
- **Motore:** Foundry unit.
- **Status:** PLANNED.

## 2. Share e depositi (§S6.3)

### LP-001 — Bootstrap / first depositor resistente
- **Type:** safety
- **Ref finding:** NEW-001
- **Statement:** Al primo deposit (`totalSupply==0`), un attaccante che deposita 1 wei + dona X non deve poter estrarre valore dal secondo depositor.
- **Motore:** Foundry invariant.
- **Status:** **PILOT (INV-3 in `LPPoolInvariant.invariant.t.sol` dimostra il bug attuale).**

### LP-002 — `minLpTokensOut` enforced
- **Type:** safety
- **Ref finding:** NEW-002, NEW-026
- **Statement:** `LiquidityManager.deposit(amount, minLpTokensOut)` reverta se `sharesReceived < minLpTokensOut`.
- **Motore:** Foundry unit + fuzz.
- **Status:** BLOCKED-HUMAN (API change).

### LP-003 — Donation non estrae valore dalla vittima
- **Type:** safety
- **Ref finding:** NEW-002, NEW-003
- **Statement:** Trasferire base asset direttamente a `ProxyGeneral` NON deve alterare il `pricePerShare` accessibile agli utenti. Il NAV usa `_totalDeposited` tracked, non `balanceOf`.
- **Motore:** Foundry invariant + Echidna.
- **Status:** PILOT (INV-3).

### LP-004 — Nessuna free share
- **Type:** accounting
- **Ref finding:** LP-004 (nuovo)
- **Statement:** ∀ user U, ∀ transazione T: `sharesOf(U)_after <= sharesOf(U)_before + amount_deposited * expectedRate + rounding_tolerance`.
- **Motore:** Foundry invariant.
- **Status:** PILOT (parziale — INV-3 copre il caso donation).

### LP-005 — Rounding loss entro bound
- **Type:** accounting
- **Ref finding:** CORE-050, NEW-014
- **Statement:** Per ogni deposit/withdraw sequence, la perdita cumulata per rounding integer non supera ≤ `numOps * 1 wei`.
- **Motore:** Foundry fuzz + Halmos symbolic.
- **Status:** PLANNED.

### LP-006 — Supply == sum balances
- **Type:** accounting
- **Ref finding:** invariant standard ERC20
- **Statement:** `totalSupply() == Σ balanceOf(user) ∀ user ∈ actors`.
- **Motore:** Foundry invariant.
- **Status:** **IMPLEMENTED** (INV-1 in `LPPoolInvariant.invariant.t.sol`).

### LP-007 — Riallocazione interna non cambia price per share
- **Type:** accounting
- **Ref finding:** CUST-001
- **Statement:** Se ProtocolManager sposta collaterale da un plugin all'altro senza PnL, il `pricePerShare` **non varia**.
- **Motore:** Foundry invariant + Hardhat fork.
- **Status:** PLANNED.

### LP-008 — Yield contabilizzato una volta
- **Type:** accounting
- **Ref finding:** VALUATION-001
- **Statement:** Yield accrual reale (interessi Aave, ecc.) aumenta il NAV una sola volta. Nessun double-count parent/plugin.
- **Motore:** Foundry invariant + Hardhat fork.
- **Status:** PLANNED.

## 3. Withdraw (§S6.4)

### WDR-001 — Full shares burn implica pagamento minimo accettato
- **Type:** safety
- **Ref finding:** CORE-003
- **Statement:** Se `_shares` shares vengono bruciate in `withdraw`, allora `outAmount >= minAmountOut` (nuovo parametro). Altrimenti revert.
- **Motore:** Foundry unit + fuzz.
- **Status:** BLOCKED-HUMAN (API change).

### WDR-002 — Liquidità insufficiente causa revert o partial esplicito
- **Type:** safety
- **Ref finding:** CORE-003
- **Statement:** Se `newBalance < netWithdraw` post-auto-swap, la tx DEVE revertare (opzione A) o burn shares proporzionali (opzione B). No silent clamp.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN.

### WDR-003 — Fee + netto coerenti dopo clamp
- **Type:** accounting
- **Ref finding:** NEW-014
- **Statement:** Se clamp accade, `feeAmount / (feeAmount + netWithdraw) == withdrawFeeBps / 10000`.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN.

### WDR-004 — Automatic unwind recupera target entro rounding
- **Type:** liveness
- **Ref finding:** CORE-025 (3% acceptance threshold)
- **Statement:** Se auto-swap è invocato con `baseAssetNeeded=X`, e ci sono abbastanza asset liquidi + protocol positions, il balance post-unwind è ≥ `X - rounding_tolerance`.
- **Motore:** Hardhat fork (richiede protocol reale).
- **Status:** PLANNED.

### WDR-005 — Fee non zero coperta da regressione dedicata
- **Type:** accounting
- **Ref finding:** CORE-027
- **Statement:** Fuzz test con `withdrawFee ∈ [1, 500]` bps verifica che fee sia sempre trasferita a `feeRecipient`.
- **Motore:** Foundry fuzz.
- **Status:** PLANNED.

### WDR-006 — Balance delta finale coincide con trasferimento
- **Type:** safety
- **Ref finding:** CORE-037
- **Statement:** Dopo `plugin.withdraw`, `IERC20(token).balanceOf(proxyGeneral)_after - _before == amount`.
- **Motore:** Foundry unit + Hardhat fork.
- **Status:** PLANNED.

## 4. Custody / protocollo (§S6.5)

### CUST-001 — Valore non duplicato parent/plugin/protocollo
- **Type:** accounting
- **Statement:** Somma `getBalance` di parent + plugin + protocollo <= custody totale + rounding.
- **Motore:** Foundry invariant + Hardhat fork.
- **Status:** PLANNED.

### CUST-002 — Allowance bounded/reset secondo policy
- **Type:** safety
- **Ref finding:** CORE-012, CORE-055, PLG-023, NEW-020
- **Statement:** Dopo qualsiasi swap/deposit/repay, `IERC20.allowance(proxyGeneral, spender) <= expected + rounding` (no residual MAX approve).
- **Motore:** Foundry invariant.
- **Status:** PLANNED.

### CUST-003 — Active positions == balance/share reali
- **Type:** accounting
- **Ref finding:** PLG-041, NEW-023 (MorphoVault activeVaults inconsistency)
- **Statement:** ∀ tracked vault/position: `plugin.isActive(v) == (IERC4626(v).balanceOf(plugin) > 0)`.
- **Motore:** Foundry invariant.
- **Status:** PLANNED.

### CUST-004 — Emergency failure non cancella tracking residuo
- **Type:** liveness
- **Ref finding:** NEW-023, PLG-040, PLG-041
- **Statement:** Se `emergencyWithdrawAll` fallisce su un vault, il tracking di quel vault NON viene cancellato.
- **Motore:** Foundry unit.
- **Status:** PLANNED.

### CUST-005 — Withdraw/borrow routing termina nel custode previsto
- **Type:** safety
- **Ref finding:** PLG-008, PLG-009, PLG-010
- **Statement:** `closeLeverageAtomic` trasferisce i fondi finali a `proxyGeneral`, non a `msg.sender`.
- **Motore:** Foundry unit + Hardhat fork.
- **Status:** BLOCKED-HUMAN.

### CUST-006 — Registry canonicality e lifecycle
- **Type:** governance
- **Ref finding:** NEW-009, PLG-059, PLG-062
- **Statement:** `Registry.removeVault(v)` implica: `getDefaultVault(any_asset) != v`; nessun stale pointer.
- **Motore:** Foundry unit.
- **Status:** PLANNED.

### CUST-007 — Upgrade Beacon incompatibile blocca nuovo capitale
- **Type:** liveness safety
- **Ref finding:** NEW-005, CORE-058
- **Statement:** Se `Beacon.updateImplementation(module, newImpl)` incontra storage mismatch, la deposit successiva deve revertare fino a migrazione esplicita.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN (semantica upgrade).

## 5. Access / governance (§S6.6)

### GOV-001 — Attore non autorizzato non muove fondi
- **Type:** safety
- **Ref finding:** PLG-007, CORE-008, CORE-036, NEW-006
- **Statement:** Nessuna funzione state-changing accessibile da un caller esterno arbitrario può modificare `balances`, `allowances`, o `sharesOf`.
- **Motore:** Foundry fuzz (fuzz caller address).
- **Status:** PLANNED.

### GOV-002 — Pause/unpause con least privilege
- **Type:** governance
- **Ref finding:** CORE-008
- **Statement:** Solo `EmergencyHandler` + `owner` possono chiamare `ProxyGeneral.pause()`.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN.

### GOV-003 — Batch non bypassa timelock
- **Type:** governance
- **Ref finding:** CORE-005, CORE-067, CORE-068
- **Statement:** `updateMultipleParameters` e i bytes-overload RIFIUTANO parametri con `requiresTimelock=true`.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN.

### GOV-004 — Alias/overload non bypassa bounds
- **Type:** governance
- **Ref finding:** CORE-067, CORE-068
- **Statement:** Il bytes-overload di `setParameterEmergency` applica gli stessi `[min, max]` bounds del string-overload.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN.

### GOV-005 — Protocol update non è istantaneo se policy richiede timelock
- **Type:** governance
- **Ref finding:** NEW-012
- **Statement:** `ProtocolManager.updateProtocol(name, plugin, ...)` accetta il cambio solo dopo `parameterTimelock` di attesa.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN.

### GOV-006 — Emergency recipient e threshold corretti
- **Type:** governance
- **Ref finding:** CORE-015
- **Statement:** `emergencyRecipient` è configurabile separatamente da `owner`. `setEmergencyRecipient` richiede firma dell'emergency contact + owner.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN.

### GOV-007 — Reentrancy harness con token avversario
- **Type:** safety
- **Ref finding:** NEW-004
- **Statement:** Con base asset ERC777 malicious, nessun path in `ProxyGeneral/LiquidityManager/SwapManager` permette reentrancy che estragga valore.
- **Motore:** Foundry unit + custom ERC777 mock.
- **Status:** PLANNED.

## 6. Oracle / health / slippage (§S6.7)

### ORC-001 — Stale/invalid price fallisce chiuso
- **Type:** safety
- **Ref finding:** ADP-002, ADP-003, ADP-004
- **Statement:** Se `AggregatorV3Interface.latestRoundData` ritorna `answer <= 0` o `updatedAt` stale, `ChainlinkAdapter.getPrice` reverta.
- **Motore:** Foundry unit + mock Chainlink.
- **Status:** PLANNED.

### ORC-002 — Future timestamp non causa dato utilizzabile
- **Type:** safety
- **Ref finding:** NEW-017
- **Statement:** Se `updatedAt > block.timestamp`, `getPrice` reverta (no underflow).
- **Motore:** Foundry unit + Halmos.
- **Status:** PLANNED.

### ORC-003 — Sequencer down e grace period
- **Type:** safety
- **Ref finding:** ADP-001
- **Statement:** Con `SequencerUptimeFeed.startedAt + GRACE_PERIOD > block.timestamp` o answer != 0, `getPrice` reverta.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN (richiede l'implementazione del feed).

### ORC-004 — Decimals/denomination coerenti
- **Type:** accounting
- **Ref finding:** NEW-021
- **Statement:** Il prezzo ritornato da `getPrice` è sempre in 18 decimali della `targetDenomination` corrente.
- **Motore:** Foundry unit.
- **Status:** PLANNED.

### HF-001 — Scale WAD uniforme
- **Type:** accounting
- **Ref finding:** PLG-005, NEW-007
- **Statement:** ∀ plugin ∈ {AaveV3, Euler, Morpho, MorphoVault}: `plugin.getHealthFactor(...) ∈ {0, [1e18, ∞)}` (scala WAD).
- **Motore:** Foundry fuzz + Halmos.
- **Status:** **PILOT (`HFScaleMath.t.sol` dimostra il bug per Morpho).**

### HF-002 — Plugin e Lens concordano entro tolleranza
- **Type:** accounting
- **Statement:** ∀ posizione P: `abs(pluginPlugin.getHealthFactor(P) - lensAdapter.getHealthFactor(P)) <= 0.01e18`.
- **Motore:** Foundry unit + Hardhat fork.
- **Status:** PLANNED.

### SWP-001 — `minOut` enforced al punto di swap
- **Type:** safety
- **Ref finding:** ADP-027, PLG-030/31/32, CORE-002
- **Statement:** Ogni chiamata a `swap()` accetta `minAmountOut` e reverta se `amountOut < minAmountOut`.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN.

### SWP-002 — Actual balance delta controllato post-swap
- **Type:** safety
- **Ref finding:** CORE-002
- **Statement:** Dopo lo swap, `IERC20(tokenOut).balanceOf(recipient)_after - _before >= minAmountOut`. La verifica è POST-swap, non solo sul quote.
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN.

### SWP-003 — Deadline non tautologica
- **Type:** safety
- **Ref finding:** NEW-025
- **Statement:** Se il caller passa `deadline < block.timestamp + tolerance`, il plugin reverta (`deadline: block.timestamp` è tautologico e vietato).
- **Motore:** Foundry unit.
- **Status:** BLOCKED-HUMAN.

### SWP-004 — Quote spot non è unica difesa
- **Type:** safety
- **Ref finding:** PLG-021, CORE-011
- **Statement:** Nessun percorso economico usa `slot0` o quote spot come unica protezione. `minAmountOut` è sempre secondario indipendente.
- **Motore:** Foundry unit + Halmos.
- **Status:** BLOCKED-HUMAN.

## 7. Emergency (proprietà residue)

### EMG-001 — Emergency recovery restituisce quanto effettivamente ricevuto
- **Type:** liveness
- **Ref finding:** CORE-001, NEW-010, PLG-040/41
- **Statement:** Se `emergencyWithdraw` viene chiamata su un pool con balance > 0, il recipient riceve **il balance effettivo** (non 0 silenziosamente).
- **Motore:** Foundry unit.
- **Status:** PLANNED.

### EMG-002 — Recovery non setta `executed=true` se 0 asset trasferiti
- **Type:** liveness
- **Ref finding:** NEW-010
- **Statement:** `emergencyExecuted["withdraw"] = true` SOLO se `successfulWithdraws > 0`.
- **Motore:** Foundry unit.
- **Status:** PLANNED.

## 8. Handler e ghost state (§S6.8)

Il pilot corrente (`test/foundry/invariant/LPPoolInvariant.invariant.t.sol`) modella:
- 3 attori (2 utenti + 1 attaccante donation).
- 3 azioni: `deposit`, `withdraw`, `donate`.
- Ghost variables: `ghost_deposited[user]`, `ghost_withdrawn[user]`, `ghost_totalDonated`.

Per S6 pieno servono handler estesi:

- [PLANNED] `LPHandler.rebalance()` — invoca ProtocolManager per spostare capital tra plugin.
- [PLANNED] `LPHandler.oracleFail(tokenCode)` — attiva mock di failure Chainlink.
- [PLANNED] `LPHandler.lensFail(plugin)` — attiva mock di failure Lens.
- [PLANNED] `LPHandler.pause()` / `unpause()` — simula pausa emergency.
- [PLANNED] `LPHandler.upgradeIncompatible()` — simula Beacon update con storage mismatch.
- [PLANNED] `LPHandler.yieldAccrual(pluginId, amount)` — simula interest.
- [PLANNED] Ghost: `ghost_yieldAccrued[user]`, `ghost_valuationValidity`.

## 9. Metriche pilot

Dal pilot corrente (`forge test --match-path "test/foundry/**/*.t.sol"`):

- **Tempo totale:** 934 ms per suite completa (unit + fuzz + invariant).
- **Fuzz runs default:** 256 (profile default → 1000 in CI, 100000 nightly).
- **Invariant runs default:** 100 (profile default → 500 in CI, 2000 nightly).
- **Bug catturato in pilot:** NEW-001/003 (INV-3), PLG-005/NEW-007 (unit HF).

Metriche target per S6 completo (dopo espansione):
- Coverage proprietà per componente: >= 80% delle proprietà del catalogo IMPLEMENTED.
- Selector handler raggiunti: >= 20 per invariant test principale.
- Reverts scartati < 30% delle calls (indicatore di bounds troppo stretti).
- Counterexample replay time: < 5 sec per ognuno.

## 10. Prossima estensione (roadmap S6 dopo pilot)

1. Deploy dei contratti reali in Foundry (fixture Beacon-lookup).
2. Implementare mock Lens/Oracle/Token con failure controllabile.
3. Coprire VAL-001…VAL-007 con test dedicati.
4. Espandere handler a 6+ azioni ostili.
5. Aggiungere Echidna (S7) e Halmos (S8) sulle stesse property.
