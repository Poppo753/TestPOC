# Slither low-tier skim — cluster analysis dei 782 baseline finding

**Fase:** T1.3
**Commit:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`
**Data:** 2026-07-15
**Scope:** i 782 finding Low + Informational + Optimization della baseline Slither (skippati dal triage puntuale dei 46 gravi).

## 1. Metodo

Aggregazione per (detector, file), filtro solo cluster **>= 3 occorrenze** in path economici. Non entry-by-entry (sarebbe rumore). Focus su pattern che possono nascondere bug reali oltre il livello Slither Low.

Dati compact aggregati: `security/slither/SKIM_LOW.json`.

## 2. Cluster sospetti identificati

### Cluster 1 — `reentrancy-events` (28 occorrenze in path economici)

| File | Count |
|---|---:|
| ProtocolManager.sol | 9 |
| ProxyGeneral.sol | 6 |
| EmergencyHandler.sol | 5 |
| SwapManager.sol | 4 |
| Liquiditymanager.sol | (nel top ma non nel filter) |

**Pattern Slither:** un event viene emesso **dopo** una external call. Da solo è benign (nessun asset a rischio via event), ma:
- In sequenza con external call che può reentrare, l'event log può risultare **incoerente** (event emesso con state parziale) → off-chain indexer riceve dati sbagliati.
- Se l'event triggera automation off-chain (VAC), l'automation può reagire a state parziale.

**Rischio combinato:** con **NEW-004** (ProxyGeneral senza `nonReentrant` da nessuna parte), un token ERC777 malicious potrebbe reentrare e emettere event con state incoerente. Questi 28 sono i candidate primari per il PoC di NEW-004.

**Da registrare:** `SLIT-CLUSTER-001 — reentrancy-events post external call` (severity: low, category: reentrancy, state: triaged, correlato con NEW-004/GOV-007).

### Cluster 2 — `reentrancy-benign` (20 occorrenze in plugin + SwapManager)

| File | Count |
|---|---:|
| EulerV2Plugin.sol | 5 |
| MorphoPlugin.sol | 4 |
| AaveV3Plugin.sol | 4 |
| SwapManager.sol | 4 |
| MorphoVaultPlugin.sol | 3 |

**Pattern Slither:** state modification **dopo** external call, ma il valore modificato non è asset diretto (es. counter, cache).

**Rischio nascosto:**
- Se il "counter" è usato per gate condition (es. numero swap effettuati per rate-limit), la reentrancy può resettarlo/incrementarlo in modo controllato dall'attaccante.
- In particolare **SwapManager** ha `swapSuccesses[pairHash]++` in `swapWithBestPlugin` **dopo** `bestPlugin.inputSwap(...)` — se il plugin reentra, il counter è manipolabile.

**Da registrare:** `SLIT-CLUSTER-002 — reentrancy-benign su counter/state cache` (severity: low, category: reentrancy, correlato con NEW-004).

### Cluster 3 — `timestamp` (33 occorrenze in file critici)

| File | Count |
|---|---:|
| ParameterManager.sol | 16 |
| EmergencyHandler.sol | 8 |
| Liquiditymanager.sol | 6 |
| ValueCalculator.sol | 4 |
| SwapManager.sol | 3 |

**Pattern Slither:** uso di `block.timestamp` in comparison o computation.

**Analisi per file:**

- **ParameterManager (16)**: timelock computation (`effectiveAt = block.timestamp + parameterTimelock`). Uso legittimo del timestamp per gate temporale. Manipolabile dal validator entro ~15 min. Su timelock di 24h è irrilevante.
- **EmergencyHandler (8)**: `emergencyState.timestamp = block.timestamp` + cooldown check. Il validator può shift ~15 min → cooldown effettivo può variare di 15 min su base 24h → irrilevante.
- **Liquiditymanager (6)**: `checkWithdrawLimits` con `currentHour = block.timestamp / 1 hours`. **QUESTO È NEW-030** (validator manipulation del bucket). Correla con CORE-004 (limits dead code) → il fix NEW-030 va nello stesso ciclo di CORE-004.
- **ValueCalculator (4)**: `cache.isValid && block.timestamp - cache.timestamp <= cacheDuration`. Cache invalidation. Manipolabile dal validator entro 15 min → se `cacheDuration < 15 min`, il validator può estendere la validità di una cache stale.
- **SwapManager (3)**: `deadline` check + `TightDeadlineWarning`. Uso legittimo, ma `deadline: block.timestamp` in UniswapV3PluginDirect è tautologico (NEW-025).

**Da registrare:**
- `SLIT-CLUSTER-003 — timestamp bucket manipulation in LM` correlato NEW-030 (severity: low, correlate con existing).
- `SLIT-CLUSTER-004 — timestamp cache validity in VC` (severity: low, NUOVO — cache può essere estesa 15 min).

### Cluster 4 — `events-maths` (3 in ValueCalculator)

**Pattern Slither:** operazione matematica dentro `emit`. Es. `emit ValueChanged(a * b / c)`. Rischio: overflow silente non gestito, o `a*b/c` con precision loss diverso dallo storage.

**Verifica veloce:** in ValueCalculator.sol i 3 casi sono in event di `TokenValueChanged`, `PoolValueUpdated`, `ProtocolValueChanged`. La math è la stessa che viene salvata in storage → coerente. Basso rischio.

**Da registrare:** `SLIT-CLUSTER-005 — events-maths in ValueCalculator` (severity: info, state: false-positive-like, motivazione: math coerente con storage).

## 3. Pattern non-sospetti (skippati)

- **`calls-loop` (452 occorrenze)**: dominato da lens adapter (`EulerLens=102`, `MorphoLens=86`, `InterVaultLens=70`, `MorphoVaultLens=55`). Sono iterazioni su registered markets/vaults — bounded da owner-controlled registry. Non exploit-friendly a meno che qualcuno registri N=1000 markets (governance rischio, non runtime).
- **`cache-array-length`, `costly-loop`**: gas optimization.
- **`assembly-usage`**: esclusi da config.
- **`naming-convention`**: esclusi da config.

## 4. Nuovi finding da registrare (dopo l'agente triage)

Attesi 5 cluster entries in `register.json`:

| ID | Severity | Category | Statement |
|---|---|---|---|
| SLIT-CLUSTER-001 | low | reentrancy | reentrancy-events post external call in 5 core contracts; correlato NEW-004/GOV-007 |
| SLIT-CLUSTER-002 | low | reentrancy | reentrancy-benign su counter/state cache in 5 plugin/SwapManager |
| SLIT-CLUSTER-003 | low | mev | timestamp bucket manipulation in LM (correlato NEW-030) |
| SLIT-CLUSTER-004 | low | mev | timestamp cache validity extension in VC |
| SLIT-CLUSTER-005 | info | precision | events-maths in VC (verificato coerente con storage) |

Ogni entry con `state=triaged`, `confidence=medium`, `note=cluster analysis dai 782 baseline low, non exploit reachable ma pattern da monitorare`.

## 5. Cosa NON è nel report

- **782 finding low uno alla volta**: rumore. Non c'è valore aggiunto.
- **naming-convention**: convenzione stilistica, non security.
- **calls-loop unbounded reachable**: da valutare solo se registry raggiunge N > 20 markets.

## 6. Prossime azioni

1. Attendere completamento agente T1.2 (triage 46 gravi).
2. Consolidare i 5 SLIT-CLUSTER-* nel register al termine.
3. Verificare che i cluster 1-3 rientrino nei bug Sprint 0 (NEW-004, NEW-030) — no bug nuovi che richiedono nuovi fix.
4. Cluster 4 (VC cache) è un finding **nuovo minor** → aggiungere alla remediation plan Sprint 1.

## 7. Cross-reference

- **NEW-004** (ProxyGeneral senza `nonReentrant`) → cluster 1 + cluster 2 sono candidate per il PoC.
- **NEW-030** (timestamp bucket manipulation) → cluster 3.
- **NEW-025** (deadline tautologico UniswapV3PluginDirect) → cluster 3 SwapManager parte.
- **NEW-017** (Chainlink underflow) → indipendente da questo skim.

Nessun bug **nuovo urgente** emerge dallo skim. Il valore aggiunto è:
- Conferma statistica di NEW-004 (28+20 = 48 pattern di reentrancy che potrebbero essere sfruttabili se ProxyGeneral fosse chiamato con ERC777).
- Nuovo minor finding (cluster 4): VC cache extension via validator timestamp shift (15 min).
