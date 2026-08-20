# T1 — Slither triage report (46 gravi H/H + M/H)

**Fase:** T1 (Slither triage — sotto-fase di S3.3 estesa)
**Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89` (contratti immutati dal `7f0dc690`)
**Slither:** 0.11.5 · solc 0.8.27
**Actor:** `agent-T1-slither-triage`
**Data:** 2026-07-17
**Protocollo applicato:** `security/slither/TRIAGE_CHECKLIST.md` §1–§6

## 1. Sintesi

Sono stati triati **46 finding** su 828 totali:
- **12 High/High** (P1)
- **34 Medium/High** (P2)

Ogni finding ha una entry nel `register.json` con id `SLIT-001..SLIT-046`. Cross-link `sub_findings` scritti sulle entry padre (`NEW-006`, `IFC-027`, `CORE-023`, `PLG-057`).

### 1.1 Conteggi per stato

| Stato | Count | Note |
|---|---:|---|
| `duplicate` | 6 | Ricoperti da finding audit già in register. `sub_findings` cross-linked. |
| `confirmed` | 8 | 7 encode-packed-collision NEW + 1 fee-on-transfer invariant (design intent). |
| `false-positive` | 32 | 31 `incorrect-equality` su zero-check sentinels + 1 canonical uint2str. |
| `accepted-risk` | 0 | Nessun accepted-risk creato; §6 regola d'oro rispettata (nessun FP di comodo). |
| `out-of-scope` | 0 | Tutti i 46 sono su path production dopo l'applicazione di `filter_paths`. |
| **Totale** | **46** | |

### 1.2 Conteggi per severity finale (mapping §5 checklist)

| Severity | Count |
|---|---:|
| `high` | 11 |
| `medium` | 2 |
| `low` | 2 |
| `info` | 31 |

Nessuna escalation a `critical`. Le 11 `high` corrispondono ai 4 `arbitrary-send-erc20` + 7 `encode-packed-collision`. Le 2 `medium` sono le 2 duplicate strutturali (`CORE-023` pausa dead + `PLG-057` uint8 tautology).

## 2. Lista dettagliata

### 2.1 High/High (P1) — 12 finding → SLIT-001..SLIT-012

| SLIT | Check | File:line | Stato | Root/Note |
|---|---|---|---|---|
| SLIT-001 | arbitrary-send-erc20 | `ProxyGeneral.sol:380-385` `transferFromModule` | **duplicate** | `NEW-006` (pull-side twin di `transferToModule`). Compromised authorized module → drena altri moduli. |
| SLIT-002 | arbitrary-send-erc20 | `ProxyGeneral.sol:293-310` `depositToken` | **duplicate** | `NEW-006`. Authorized module può chiamare `depositToken(victim, ...)` e prendere l'allowance dell'utente senza mint di shares → user loss / NAV inflation. |
| SLIT-003 | arbitrary-send-erc20 | `UniswapV3PluginDirect.sol:175-236` `outputSwap` | **duplicate** | `IFC-027`. No ACL, pull da `proxyGeneral` state var con `amountOutMinimum=0` (`PLG-020`) + `CORE-012` max-uint approve. Sandwich guaranteed. |
| SLIT-004 | arbitrary-send-erc20 | `UniswapV3PluginDirect.sol:117-169` `inputSwap` | **duplicate** | `IFC-027`. Stesso pattern (min=0 → `PLG-019`, no caller ACL). |
| SLIT-005 | encode-packed-collision | `SwapManager.sol:1312-1319` `resetSwapStats` | **confirmed** | NEW bug. `abi.encodePacked(spendTokenCode, receiveTokenCode)` — sibling di `PLG-061` (MorphoRegistry) ma su SwapManager. |
| SLIT-006 | encode-packed-collision | `SwapManager.sol:1107-1117` `_handleSwapError` | **confirmed** | NEW bug (stessa forma). |
| SLIT-007 | encode-packed-collision | `SwapManager.sol:413-509` `swapWithBestPlugin` | **confirmed** | NEW bug (hot path). |
| SLIT-008 | encode-packed-collision | `SwapManager.sol:616-666` `_swapFromBaseAsset` | **confirmed** | NEW bug. |
| SLIT-009 | encode-packed-collision | `SwapManager.sol:1150-1156` `getSwapStats` | **confirmed** | NEW bug (view). |
| SLIT-010 | encode-packed-collision | `SwapManager.sol:558-611` `_swapToBaseAsset` | **confirmed** | NEW bug. |
| SLIT-011 | encode-packed-collision | `SwapManager.sol:671-733` `_swapTokenToToken` | **confirmed** | NEW bug. |
| SLIT-012 | uninitialized-state | `Liquiditymanager.sol:62` `paused` (storage) | **duplicate** | `CORE-023` (paused dead storage). Slither conferma esattamente la stessa variabile. |

### 2.2 Medium/High (P2) — 34 finding → SLIT-013..SLIT-046

| SLIT | Check | File:line | Stato | Root/Note |
|---|---|---|---|---|
| SLIT-013 | incorrect-equality | `Liquiditymanager.sol:406-543` `_executeAutomaticSwap#458` | false-positive | `tokenToSwap.length==0 || amountToSwap==0` — sentinel per fallback path. |
| SLIT-014 | incorrect-equality | `MorphoVaultPlugin.sol:327-331` `getVaultBalance` | false-positive | `shares==0` short-circuit view. |
| SLIT-015 | incorrect-equality | `MorphoVaultPlugin.sol:155-166` `getBalance` | false-positive | `shares==0` short-circuit view. |
| SLIT-016 | incorrect-equality | `InterVaultPlugin.sol:245-257` `_checkProspectiveCap` | false-positive | Divide-by-zero guard: `postParent==0 → revert ValuationUnavailable`. Protettivo. |
| SLIT-017 | incorrect-equality | `AaveV3Plugin.sol:656-706` `closeLeverageAtomic` | false-positive | `currentDebt==0 → NoPositionToClose`. Sentinel. |
| SLIT-018 | incorrect-equality | `InterVaultLensAdapter.sol:179-190` `_toParentBase` | false-positive | `amount==0` short-circuit. |
| SLIT-019 | incorrect-equality | `Liquiditymanager.sol:127-214` `deposit` invariant | **confirmed** low | Strict `balanceOf == pre + netDeposit` DoSa la deposit su fee-on-transfer / rebasing base asset. Design intent (whitelist governance), ma no policy esplicita in codice → registrato low. |
| SLIT-020 | incorrect-equality | `AaveV3Plugin.sol:329-377` `repay` | false-positive | `currentDebt==0` early-return idempotente. |
| SLIT-021 | incorrect-equality | `MorphoVaultPlugin.sol:423-438` `_redeemAllVaults` | false-positive | Pruning cleanup `balance==0`. |
| SLIT-022 | incorrect-equality | `Liquiditymanager.sol:243-397` `_withdrawInternal` | false-positive | Strict `totalSupply` delta su LP token proprietary (nonReentrant scope). Sicuro. |
| SLIT-023 | incorrect-equality | `InterVaultPlugin.sol:176-199` `emergencyWithdrawAll` | false-positive | `shares==0 continue`. |
| SLIT-024 | incorrect-equality | `AaveV3Plugin.sol:249-288` `withdraw` | false-positive | Sentinel. |
| SLIT-025 | incorrect-equality | `MorphoVaultPlugin.sol:395-421` `_vaultWithdraw` (line 410) | false-positive | Dust-burn: `convertToAssets(remainingShares) == 0`. Comment in codice conferma intent. |
| SLIT-026 | incorrect-equality | `InterVaultLensAdapter.sol:173-177` `_positionValue` | false-positive | Short-circuit view. |
| SLIT-027 | incorrect-equality | `InterVaultLensAdapter.sol:141-171` `_position` (interVaultValue) | false-positive | Divide-by-zero guard su exposureBps. |
| SLIT-028 | incorrect-equality | `EulerRegistry.sol:593-600` `getPosition` | false-positive | `createdAt==0` sentinel di esistenza record. |
| SLIT-029 | incorrect-equality | `AaveV3Plugin.sol:454-476` `closePositionsForBaseAsset` | false-positive | Early return `(0,0)`. |
| SLIT-030 | incorrect-equality | `EulerLensAdapter.sol:736-789` `_convertToBaseAssetValue` | false-positive | Short-circuit view. |
| SLIT-031 | incorrect-equality | `InterVaultPlugin.sol:139-143` `getBalance` | false-positive | Short-circuit view. |
| SLIT-032 | incorrect-equality | `InterVaultPlugin.sol:238-243` `_withdrawAll` | false-positive | No-op. |
| SLIT-033 | incorrect-equality | `InterVaultLensAdapter.sol:141-171` `_position` (shares) | false-positive | Short-circuit lens. |
| SLIT-034 | incorrect-equality | `Liquiditymanager.sol:587-645` `_swapLiquidTokensForBaseAsset` | false-positive | Loop-continue `balance==0`. |
| SLIT-035 | incorrect-equality | `InterVaultPlugin.sol:220-236` `_withdrawAssets` | false-positive | Div-by-zero guard. |
| SLIT-036 | incorrect-equality | `InterVaultPlugin.sol:259-271` `_toParentBase` | false-positive | Short-circuit. |
| SLIT-037 | incorrect-equality | `Liquiditymanager.sol:406-543` `_executeAutomaticSwap#541` | false-positive | Post-loop assertion `stillNeeded==0`. Correlato a `CORE-025` ma predicate corretto. |
| SLIT-038 | incorrect-equality | `MorphoVaultPlugin.sol:294-313` `vaultRedeem` | false-positive | Cleanup. |
| SLIT-039 | incorrect-equality | `ValueCalculator.sol:506-649` `selectTokenForSwap` | false-positive | Loop-continue. Distinto da `CORE-049`. |
| SLIT-040 | incorrect-equality | `InterVaultPlugin.sol:161-174` `closePositionsForBaseAsset` | false-positive | Early return. |
| SLIT-041 | incorrect-equality | `MorphoVaultPlugin.sol:395-421` `_vaultWithdraw` (line 414) | false-positive | Secondo cleanup pattern nella stessa funzione (vedi SLIT-025). |
| SLIT-042 | incorrect-equality | `EmergencyHandler.sol:262-282` `_uint2str` | false-positive | Canonical uint→string base case. Non un predicate security. |
| SLIT-043 | incorrect-equality | `InterVaultPlugin.sol:273-276` `_childAssets` | false-positive | Short-circuit view helper. |
| SLIT-044 | incorrect-equality | `EulerLensAdapter.sol:1151-1209` `estimatePositionAfterSwap` | false-positive | Divide-by-zero guard su HF. Correlato a `PLG-037` (fail-mask) ma qui pure view: convention corretta. |
| SLIT-045 | incorrect-equality | `EulerV2Plugin.sol:312-356` `withdraw` | false-positive | Sentinel. |
| SLIT-046 | tautology | `EulerRegistry.sol:315-375` `createPositionOnDemand#338` | **duplicate** | `PLG-057` (uint8 nextSubAccountId, `> 255` sempre false, Panic 0x11 su overflow). |

## 3. Cross-linking applicato

Sono state aggiornate le entry padre in `register.json` con `sub_findings` + una history entry `T1 Slither triage: cross-linked sub_findings ...` datata 2026-07-17:

| Padre | sub_findings aggiunti | Motivazione |
|---|---|---|
| `NEW-006` | `SLIT-001`, `SLIT-002` | Stesso pattern "authorized module → asset dirottamento" sui due entry-point residui (`transferFromModule`, `depositToken`). |
| `IFC-027` | `SLIT-003`, `SLIT-004` | Slither H/H sui due swap direct (`inputSwap` + `outputSwap`) — parte del ciclo di remediation `IFC-027`. |
| `CORE-023` | `SLIT-012` | Slither conferma la variabile `paused` non inizializzata. |
| `PLG-057` | `SLIT-046` | Slither `tautology` sullo stesso pattern uint8 in una diversa call site (`createPositionOnDemand`). |

Nessuna entry padre è stata modificata oltre l'aggiunta di `sub_findings` e di **una** history entry di crosslink.

## 4. Nuovi bug reali (confirmed non duplicate)

### 4.1 encode-packed-collision (7 siti, `SLIT-005..SLIT-011`)

**Componente:** `contracts/SwapManager.sol` (7 call sites)
**Pattern comune:** `keccak256(abi.encodePacked(codeA, codeB))` su due stringhe dinamiche → collisione tra pair `("US","DC")` vs `("USD","C")`.

**Impatto attuale:** `pairHash` è oggi usato **solo** per counters `swapSuccesses` / `swapErrors` (telemetria + logica di scoring interno). Non ha impact economico diretto oggi, ma:
- corrompe le statistiche usate da `SwapManager` per "best plugin" selection → mismatch di reputazione tra pair;
- pattern fragile: qualunque futuro fix che riutilizzi `pairHash` come chiave di slippage-per-pair o pause-per-pair introduce un vero exploit (attacker on-boards un token code che collide con una pair strategica).

**Fix raccomandato:** sostituire con `keccak256(abi.encode(spendTokenCode, receiveTokenCode))` (ABI encoding include length prefix → nessuna collisione).

**Severity finale:** `high` (mapping §5 checklist da Slither H/H). Motivazione: 7 siti duplicano lo stesso bug, hot path (`swapWithBestPlugin`) coinvolto, fix è one-line.

### 4.2 Strict ERC20 delta invariant in deposit (`SLIT-019`)

**Componente:** `contracts/Liquiditymanager.sol#127-214 deposit`
**Pattern:** `require(balanceOf(proxyGeneral) == preDepositBalance + netDeposit, ...)`
**Impatto:** DoS totale su deposit se base asset diventa fee-on-transfer o rebasing (governance error o token upgrade non annunciato). Non exploitable oggi (base asset è USDC), ma manca policy esplicita che vieta on-boarding di FoT come base asset.

**Severity finale:** `low` (design intent + no live exploit).

## 5. Cross-reference con `S1.6-remediation-plan.md`

I nuovi finding SLIT si mappano ai cicli di Sprint 0 come segue. **Nessun fix è stato applicato** — solo raccomandazione per l'agent di remediation.

| Ciclo S1.6 | Finding di riferimento | SLIT correlati | Azione |
|---|---|---|---|
| C1-04 (emergency selector + NEW-018) | `CORE-001`, `NEW-018` | — | (invariato) |
| C1-06 (minOut end-to-end) | `PLG-004/011/013/15/19/20`, `NEW-002/025/026` | `SLIT-003`, `SLIT-004` | Nel fix `IFC-027` + `PLG-019/20`, contestualmente introdurre ACL su `UniswapV3PluginDirect.inputSwap/outputSwap`. |
| C1-08 (interface drift) | `IFC-*`, `CORE-070` | — | (invariato) |
| **NEW — C1-09 (encode-packed collision)** | `PLG-061` | `SLIT-005..SLIT-011` | **Aggiungere nuovo blocker C1-09.** Fix uniforme in tutti i 7 siti di SwapManager + il site di MorphoRegistry. Effort: basso (7 line changes). Test: property fuzz che genera pair colliding e verifica che gli hash differiscano. |
| **Trust model authorized-module** | `NEW-006`, `CORE-036` | `SLIT-001`, `SLIT-002` | Nel fix `NEW-006`, considerare anche `transferFromModule` e `depositToken` (attualmente non nel bulletpoint dei fix concreti C1-04..C1-08). Effort: medio (aggiungere `require(from == msg.sender)` a `depositToken`, restringere `transferFromModule` a un allowlist esplicito). |
| **Uint8 counter tautology** | `PLG-057` | `SLIT-046` | Fix di `PLG-057` (già in register). Nessun cambio scope; Slither `tautology` è una conferma indipendente. |
| **Fee-on-transfer policy** | `CORE-055/056` | `SLIT-019` | Aggiungere requisito "base asset non FoT / rebasing" nel documento di onboarding governance. Non blocca Sprint 0. |

## 6. Anti-pattern §10 osservati / evitati

- **§10.1 Auto-classificare H/H come confirmed:** non applicato; ogni finding è stato verificato sul codice al commit `786a5b92`.
- **§10.2 Marcare duplicate senza root:** ogni entry duplicate ha `root_finding` valorizzato (§3 tabella).
- **§10.3 Silenziare massivamente reentrancy-*:** NON APPLICABILE in questa fase — la triage riguarda H/H e M/H, che non contengono `reentrancy-*` (i 37 `reentrancy-*` sono in P3 High/Medium, fuori dal batch dei 46 gravi). Da triare nella fase successiva P3.
- **§10.4 Ridurre scope Slither:** nessuna modifica a `slither.config.json`.
- **§10.5 Suppression inline:** nessuna suppression aggiunta.

## 7. Deliverable prodotti

1. **`security/findings/register.json`** — aggiornato da 327 → **373 entries**:
   - 46 nuove entry `SLIT-001..SLIT-046` (schema-valid contro `security/findings/schema.json`);
   - `sub_findings` aggiornati su `NEW-006`, `IFC-027`, `CORE-023`, `PLG-057`;
   - una history entry `T1 Slither triage: cross-linked sub_findings ...` su ogni padre.
2. **`security/slither/TRIAGE_REPORT.md`** — questo documento.
3. **Validazione JSON schema:** `jsonschema.validate` → `OK - 373 entries`.

## 8. Prossimo task raccomandato

**T1.3 — Triage 37 High/Medium (P3).**

Elenco atteso: `reentrancy-*` (37 nella baseline sono `reentrancy-balance/events/no-eth/benign`), da fare **entry-by-entry** per rispettare §10.3.

Suggerimento di esecuzione:
1. Estrarre da `baseline-raw.json` i 37 High/Medium.
2. Deduplicare contro register (probabile match con `CORE-013`, `CORE-073`, `CORE-074`, `NEW-004`, `PLG-025`, `PLG-046`, `PLG-115`).
3. Nuovi finding: registrare come `SLIT-047..` sequenziale (numerazione continua rispetto a `SLIT-046`).
4. Confermare la baseline stabile (`baseline.json` fingerprint) — nessuna modifica alla baseline durante il triage.

## 9. Decisioni umane richieste

Nessun finding richiede escalation manuale a `critical`. Le decisioni umane residue sono:

1. **Aggiungere blocker C1-09** in `S1.6-remediation-plan.md` per `SLIT-005..011` (encode-packed-collision). Effort basso, alto valore per stabilità della hash-based selection.
2. **Estendere il fix `NEW-006`** in `C1-04` (o creare `C1-04-bis`) per includere `depositToken` e `transferFromModule` (SLIT-001/002).
3. **Documentare la policy no-FoT / no-rebasing** per il base asset (linkato a `SLIT-019`). Non-blocking ma raccomandato prima di eventuali cambi di base asset.

## 10. Handover

Al termine di T1.2, T1.3 (P3), T1.4 (skim P4 pattern) chiuderà la fase T1 e sbloccherà **S4** (gate differenziale su nuovi finding H/H + M/H). Con register consolidato + `baseline.json` fingerprint, ogni PR successiva potrà essere confrontata via `compare.py`.
