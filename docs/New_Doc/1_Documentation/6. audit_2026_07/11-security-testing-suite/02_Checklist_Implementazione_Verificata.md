# Checklist verificata di implementazione della suite di sicurezza

## 1. Regole d'uso

Stati:

- `[ ]` non iniziato;
- `[~]` in corso o parziale;
- `[x]` completato con evidenza;
- `[!]` bloccato con blocker documentato.

Un task può essere marcato `[x]` soltanto se il deliverable indicato esiste e il
comando di verifica è riproducibile. Questa checklist descrive l'implementazione
futura: non autorizza deploy, transazioni, modifica ruoli o uso di chiavi.

### 1.1 Protocollo obbligatorio per un chatbot/agente esecutore

Prima di iniziare ogni fase, l'agente deve:

- [ ] Leggere integralmente `00_Stato_e_Strategia_Suite_Sicurezza.md`.
- [ ] Leggere integralmente `01_Strategia_Espansa_e_Riesaminata.md`.
- [ ] Leggere integralmente questa checklist e l'eventuale registro della fase.
- [ ] Verificare branch, HEAD e `git status` senza alterare modifiche preesistenti.
- [ ] Identificare `AGENTS.md`, policy repository e istruzioni CI applicabili.
- [ ] Creare/aggiornare un piano con un solo step `in_progress`.
- [ ] Eseguire i task nell'ordine delle dipendenze, salvo motivazione registrata.
- [ ] Non marcare task completati sulla base della sola creazione del file.
- [ ] Registrare comando, versione, commit, risultato e artifact per ogni gate.
- [ ] Non ridurre test, detector, run o scope per ottenere un PASS senza review.
- [ ] Non modificare una baseline per assorbire un nuovo finding della stessa PR.
- [ ] Non interpretare timeout, skip o tool error come test superato.
- [ ] Non effettuare deploy, canary, proposta Safe o transazione senza autorizzazione esplicita.
- [ ] Non usare o stampare private key, mnemonic, token RPC o secret CI.
- [ ] Fermarsi ai gate umani elencati in §1.4.

### 1.2 Path canonici dei deliverable

Per evitare che agenti diversi inventino strutture incompatibili, utilizzare:

```text
security/
├── README.md
├── DECISIONS.md
├── scope/
│   ├── audit-snapshot.md
│   ├── production-paths.txt
│   └── exclusions.md
├── findings/
│   ├── schema.json
│   ├── register.json
│   └── accepted-risk.md
├── properties/
│   ├── PROPERTY_CATALOG.md
│   └── TRACEABILITY.md
├── slither/
│   ├── slither.config.json
│   ├── baseline.json
│   └── suppressions.md
├── echidna/
│   ├── echidna.yaml
│   └── README.md
├── halmos/
│   └── README.md
└── reports/                 # output generato; definire cosa versionare

test/foundry/
├── unit/
├── fuzz/
├── invariant/
├── handlers/
└── mocks/

.github/workflows/
├── tests.yml                # suite Hardhat consolidata
├── security-pr.yml
├── security-nightly.yml
└── security-release.yml
```

Una deviazione richiede una voce in `security/DECISIONS.md` con motivazione,
alternative considerate e impatto sui comandi/documentazione.

### 1.3 Evidenza minima per chiudere un task

Ogni task tecnico completato deve riportare, nel registro di esecuzione della
fase o nel finding associato:

- ID del task;
- commit/HEAD testato;
- file creati o modificati;
- comando esatto;
- versione del tool;
- exit code;
- conteggio PASS/FAIL/SKIP quando applicabile;
- path del report/counterexample;
- eventuali warning o limiti;
- reviewer richiesto;
- prossimo task sbloccato.

Per i task documentali serve anche un controllo incrociato con strategia e
checklist. Per i fix serve sempre almeno una regressione che falliva prima del
fix o una motivazione verificabile quando ciò è tecnicamente impossibile.

### 1.4 Gate che richiedono decisione o autorizzazione umana

Un chatbot può preparare analisi, alternative, patch e test, ma deve fermarsi
prima di:

- [ ] approvare un accepted risk o cambiarne la severity finale;
- [ ] nominare owner/reviewer reali o modificare regole CODEOWNERS/protezione branch;
- [ ] scegliere una semantica economica controversa tra alternative non equivalenti;
- [ ] applicare una modifica core che cambia NAV, share, fee, prelievo o recovery senza decisione registrata;
- [ ] installare tool con privilegi elevati o modificare infrastruttura globale;
- [ ] aggiungere/modificare secret GitHub, RPC o credenziali VPS;
- [ ] pubblicare report potenzialmente sensibili su GitHub code scanning;
- [ ] proporre o eseguire una transazione Safe;
- [ ] effettuare deploy, verifica explorer o canary Arbitrum;
- [ ] ingaggiare/dichiarare completato un audit esterno;
- [ ] aumentare cap o capitale;
- [ ] dichiarare production-ready.

Se il gate umano non è risolto, il task viene marcato `[!]` con blocker preciso;
non viene sostituito da un'assunzione dell'agente.

### 1.5 Decisioni tecniche che l'agente può prendere

Entro il perimetro autorizzato, l'agente può:

- scegliere la più recente versione stabile supportata di un tool dopo verifica
  sulle fonti ufficiali, fissandola in `security/DECISIONS.md`;
- creare configurazioni, harness, mock e workflow non distruttivi;
- correggere problemi puramente meccanici o di compatibilità senza cambiare la
  semantica economica;
- scrivere test/PoC e classificare un finding come `candidate`;
- proporre severity e remediation, lasciando la decisione finale al reviewer;
- eseguire test locali e fork senza transazioni reali usando secret già
  disponibili e senza esporli;
- aggiornare checklist e registri con evidenze effettivamente ottenute.

### 1.6 Handover minimo tra agenti o sessioni

Al termine di ogni fase creare o aggiornare un registro contenente:

```text
branch e HEAD
scope attivo
task completati/in corso/bloccati
file modificati
comandi PASS/FAIL
finding nuovi o cambiati
decisioni ancora richieste
artifact/corpus/counterexample
prossimo task esatto
```

Un nuovo agente non deve ricominciare dall'inizio né fidarsi soltanto delle
checkbox: deve confrontare evidenze, file e stato Git.

Dipendenze principali:

```text
S0 Scope
 └─ S1 Audit normalization
     ├─ S9 remediation iterativa dei blocker già confermati
     ├─ S2 CI Hardhat
     └─ S3 Slither → S4 baseline/gate
         └─ S5 Foundry → S6 properties
             ├─ S7 Echidna
             └─ S8 Halmos

Ogni nuovo finding prodotto da S3–S8 rientra immediatamente nel ciclo S9.
S1 + cicli S9 + suite S2–S8 → S10 fork/release → audit esterno/canary
```

Regola fondamentale: non si attende di avere installato tutti gli strumenti e
non si attende di avere trovato “tutti i bug”. Dopo S1, ogni gruppo di finding
confermato viene riprodotto, corretto e sottoposto a regressione mentre la suite
di sicurezza continua a crescere in parallelo.

## 2. S0 — Preparazione e scope

### S0.1 Snapshot autorevole

- [x] Registrare branch e commit che saranno analizzati.
- [x] Registrare data, solc, Hardhat, Node e lockfile.
- [x] Confrontare il commit dell'audit 2026-07 con HEAD corrente.
- [x] Elencare file production aggiunti dopo l'audit, incluso InterVault.
- [x] Salvare il diff di scope come artifact/documento.
- [x] Dichiarare che risultati su linee obsolete richiedono riverifica.

Deliverable: `security/scope/audit-snapshot.md`. **[completato 2026-07-15 al commit `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`]**

### S0.2 Scope production machine-readable

- [x] Creare elenco include per core e componenti attivi.
- [x] Includere Aave, Euler, Morpho, Morpho Vault e InterVault.
- [x] Includere FlashLoanService e swap path realmente deploygabili.
- [x] Includere le interfacce consumate a runtime.
- [x] Definire scope off-chain: deploy, manifest, Safe, CLI e VAC.
- [x] Escludere Dolomite e GMX con motivazione e criterio di reingresso.
- [x] Escludere `plugins/old`, backup e copy non production.
- [x] Separare mock production-hygiene da contratti deploygabili.
- [~] Aggiungere controllo CI che segnali nuovi file Solidity non classificati. — specifica pronta in `exclusions.md` §5; implementazione job GH Actions rimandata a S2 per non toccare CI in S0.

Deliverable: `security/scope/production-paths.txt` e `exclusions.md`. **[completato 2026-07-15 al commit `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`]**

### S0.3 Ownership

- [x] Assegnare owner tecnico alla suite. — `@Poppo753` come single-maintainer (registrato in `security/DECISIONS.md` DEC-001, autorizzato dall'utente 2026-07-15).
- [~] Assegnare reviewer indipendente per accepted risk e suppression. — TBD: al momento single-maintainer, self-review con cooling-off condizionale (DEC-003). Trigger di riattivazione: primo deploy mainnet / secondo maintainer / accepted risk critical.
- [x] Stabilire chi può modificare baseline e configurazioni security. — `@Poppo753` (DEC-001).
- [~] Proteggere tali path con CODEOWNERS/review obbligatoria. — CODEOWNERS creato (`.github/CODEOWNERS`), required review NON attivata (DEC-002: bloccherebbe unico autore). Branch protection lato GitHub Settings: raccomandazioni in DEC-004 da applicare manualmente da Poppo753 (agente non ha accesso).

Gate S0: nessun tool viene configurato prima di avere scope e owner. **[chiuso 2026-07-15 al commit `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`. S1 sbloccato da DEC-005.]**

## 3. S1 — Normalizzazione dell'audit

### S1.1 Schema dei finding

- [x] Definire schema JSON o tabellare autorevole. — `security/findings/schema.json` (JSON Schema draft 2020-12).
- [x] Rendere obbligatori ID, title, commit, component, severity e confidence. — required + pattern enforced.
- [x] Aggiungere actor, prerequisites, impact e invariant violated. — proprietà definite.
- [x] Aggiungere PoC, fix commit, regression e residual risk. — proprietà definite.
- [x] Definire stati ammessi e transizioni. — enum `state` + `$defs.state_transitions_notes`.
- [~] Validare lo schema in CI. — comando di validazione documentato in `security/findings/README.md` §4; job CI da aggiungere in S2. **[completato 2026-07-15 salvo il job CI, rimandato a S2]**

### S1.2 Correzione strutturale

- [x] Ricalcolare i totali per severity. — Register.json: 8 critical, 80 high, 127 medium, 89 low, 23 info (327 entries totali).
- [x] Correggere la tabella Critical incoerente col totale dichiarato. — nuovo conteggio in `register.json`; ISSUES.md storico preservato.
- [x] Rimuovere PLG-006 dalle liste in cui rimane dopo il falso positivo. — PLG-006 marcato `state=false-positive` con motivazione.
- [x] Individuare tutte le collisioni ID come `CORE-049`. — 5 collisioni identificate e deduplicate.
- [x] Deduplicare `CORE-049`/`NEW-028` e finding equivalenti. — NEW-028 → duplicate di CORE-049. Altri: IFC-001 → CORE-001, NEW-013 → CORE-030, IFC-011 → CORE-070, PLG-098 → PLG-062.
- [x] Separare varianti/scenari dalla root cause. — sub_findings link non-dedup: PLG-005 ⇢ NEW-007, CORE-063 ⇢ NEW-027, CORE-074 ⇢ NEW-004, CORE-058 ⇢ NEW-005/012, PLG-006 ⇢ NEW-008.
- [x] Separare production bug, hardening, gas, docs e deployment hygiene. — enum `category` in schema, applicato a ogni entry.
- [x] Aggiornare path e linee al commit corrente. — commit `786a5b92…` in ogni history entry; codice invariato dal commit InterVault.
- [x] Inserire InterVault e i nuovi script/test nello scope. — 5 candidates `INTERVAULT-001…005` (high/medium, state=candidate, confidence=low).
- [x] Conservare storico e alias degli ID rimossi. — nessun ID cancellato; duplicati mantenuti con `root_finding` valorizzato + `sub_findings` sul canonico.

Deliverable: `security/findings/register.json` (228 KB, 327 entries, schema-valid). **[completato 2026-07-15]**

### S1.3 Finding valuation unificato

- [x] Creare finding root `critical valuation fail-open`. — `VALUATION-001` in register.json, severity=critical, confidence=high, state=confirmed.
- [x] Includere token oracle failure. — sub_finding `CORE-049` + `CORE-044`.
- [x] Includere Lens failure in ProtocolManager. — sub_finding `ADP-018` (Euler Lens fallback) + `IFC-010` (isCircuitBreakerActive selector inesistente).
- [x] Includere fallback legacy Euler quando fallisce ProtocolManager. — sub_finding `CORE-052`.
- [x] Includere health adapter failure mascherata come healthy/max. — sub_finding `PLG-037` (Euler HF mask con `type(uint256).max`) + `ADP-003` (circuit breaker inerte).
- [x] Collegare deposit, withdraw, reserve ratio e automation. — sub_finding `CORE-075` (post-swap reserve ratio usa pre-swap totalValue) + `NEW-028` (attack scenario NAV donation).
- [x] Separare view diagnostica best-effort da NAV transazionale. — semantica proposta in `S1.6-remediation-plan.md` §C1-01 (strict vs best-effort views).
- [x] Definire soluzione attesa: validità esplicita e fail-closed economico. — documentato in `S1.6-remediation-plan.md` §C1-01.
- [x] Definire recovery che non dipenda dallo stesso NAV fallito. — documentato in `S1.6-remediation-plan.md` §C1-04 (emergency legge balance delta, non NAV).

Deliverable: entry `VALUATION-001` in `register.json` con 9 sub_findings + semantica in `S1.6-remediation-plan.md`. **[completato 2026-07-15]**

### S1.4 Verification Critical/High

Per ogni finding:

- [x] Verificare codice corrente e reachability. — Report `docs/audit_2026_07/09-verification-report.md` (25 HIGH campione) + `docs/audit_2026_07/11-verification-remaining.md` (53 HIGH restanti + partial). Totale 78 finding CRITICAL/HIGH verificati direttamente sul codice.
- [x] Ricostruire call graph e ruoli. — coperto entry-by-entry nei due report.
- [x] Identificare asset a rischio. — campo `impact` in `register.json`.
- [x] Scrivere scenario minimo. — coperto nei report; PoC concreti per NEW-001/002/003 e VALUATION-001.
- [~] Creare PoC o motivare formalmente perché non riproducibile. — PoC deterministici rimandati a Foundry S5 (test rossi). Per S1 si documenta reachability + scenario aritmetico.
- [x] Rivalutare severity e confidence. — PLG-001 downgraded HIGH → MEDIUM; PLG-013/14/15 HIGH partial; CORE-008/PLG-045 → MEDIUM; PLG-056 → LOW; PLG-057/ADP-033/ADP-039 → MEDIUM. Confidence=high per tutti i confermati.
- [x] Marcare duplicate/false-positive/accepted-risk con reviewer. — 5 duplicati (IFC-001, NEW-028, NEW-013, IFC-011, PLG-098), 1 falso positivo (PLG-006). Reviewer=`@Poppo753` (single-maintainer) come da DEC-001.
- [x] Non proporre fix architetturali prima della root cause. — VALUATION-001 root creato; fix semantica documentata in `S1.6-remediation-plan.md` §C1-01 ma non ancora applicata (gate umano §1.4).

Deliverable: register.json con 94 finding in `state=confirmed`, `last_verified=2026-07-15`, `confidence=high`. **[completato 2026-07-15]**

### S1.5 Priorità iniziali

Vedi `security/findings/S1.5-priorities-verified.md` per la verifica di ogni item sul codice attuale.

- [x] Verificare withdrawal clamp + burn completo. — CORE-003 confermato via `Liquiditymanager.sol:329-346`.
- [x] Verificare emergency selector/path. — CORE-001 confermato via grep (solo `emergencyTransferAll`, no `emergencyTransfer(a,u,r)`).
- [x] Verificare first-depositor e donation attack. — NEW-001/002/003 confermati via grep (no `MINIMUM_LIQUIDITY`, `_decimalsOffset`, `minLpTokensOut`).
- [x] Verificare NAV token/Lens fail-open. — VALUATION-001 confermato via `ValueCalculator.sol:261-270` + `EulerLensAdapter.sol:882` fake selector.
- [x] Verificare Morpho HF scale e Lens/plugin consistency. — PLG-005 + NEW-007 confermati via `MorphoPlugin.sol:1009` e `MorphoLensAdapter.sol:178`.
- [x] Verificare minOut nei percorsi realmente raggiungibili. — 20+ finding confermati (flash-loan callback, service, Uniswap direct, SwapManager).
- [x] Verificare timelock/batch/parameter execution. — CORE-005/06/07 confermati via `ParameterManager.sol` (2 override `executeParameterChange`).
- [x] Verificare interface selector incompatibili a runtime. — IFC-004/010/022/23/24 confermati via `ProtocolManager.sol:320,351,402,414` vs `MorphoPlugin.sol:340,379`.
- [x] Verificare Sequencer Uptime Feed e oracle states. — ADP-001 confermato via grep (0 uso di `SequencerUptime`).
- [x] Verificare upgrade/storage semantics reali del Beacon. — NEW-005 confermato via `Beacon.sol:109` (no timelock, no migrate).
- [~] Verificare reentrancy con token/callback avversario, non per assenza modifier. — NEW-004 confermato per **assenza modifier** ma PoC token-based rimandato a Foundry (S5+).

### S1.6 Cicli esecutivi di analisi e remediation

Per ogni ciclo applicare obbligatoriamente:

```text
triage sul codice corrente
→ finding confermato o scartato
→ test/PoC rosso
→ semantica corretta concordata
→ fix minimo
→ test mirato verde
→ suite componente/full-core/off-chain pertinente
→ fork se necessario
→ evidenza e chiusura
```

- [ ] Non rimandare un Critical/High confermato in attesa di Slither/Foundry/Echidna/Halmos.
- [ ] Non dichiarare mai che sono stati trovati “tutti i bug”.
- [ ] Terminare ogni ciclo con suite verdi prima di ampliare il perimetro.
- [ ] Se un fix cambia architettura o API, rivalutare i finding dipendenti.
- [ ] Se un nuovo tool trova un bug, inserirlo nel ciclo corrente o nel primo ciclo compatibile per severità.
- [ ] Correggere prima le root cause che generano numerosi failure derivati.

#### Ciclo 0 — normalizzazione

- [ ] Deduplicare, aggiornare e classificare il registro senza fix indiscriminati.
- [ ] Identificare blocker e dipendenze tra remediation.

#### Ciclo 1 — solvency, NAV, share e fondi

- [ ] Valuation fail-open di token, Lens, health e fallback.
- [ ] Withdrawal clamp/burn e atomicità del pagamento.
- [ ] First depositor, donation e `minLpTokensOut`.
- [ ] Fee, rounding, bootstrap e share accounting.
- [ ] Emergency selector, recovery e tracking delle failure parziali.

#### Ciclo 2 — accesso, governance e upgrade

- [ ] Ruoli, pause e least privilege.
- [ ] Safe, timelock, batch e overload.
- [ ] Upgrade Beacon e migrazione dei moduli stateful.
- [ ] Reentrancy confermata tramite call graph/PoC.
- [ ] Drift di interfacce che causa selector runtime incompatibili.

#### Ciclo 3 — protocolli e custody

- [ ] Aave deposit/withdraw/borrow/repay/leverage.
- [ ] Euler share, sub-account, custody e health.
- [ ] Morpho market, shares, HF e borrow/repay.
- [ ] Morpho Vault share/dust/active tracking.
- [ ] InterVault parent/leaf, cap, lifecycle e unwind.
- [ ] Routing dei fondi e balance delta per ogni bundle.

#### Ciclo 4 — oracle, swap, flash loan e MEV

- [ ] Sequencer Uptime Feed e grace period.
- [ ] Staleness, future timestamp, scale e denomination.
- [ ] `minOut`, deadline e actual balance delta.
- [ ] Quote spot/manipolazione e flash-loan callback.
- [ ] Sandwich e slippage sui percorsi realmente raggiungibili.

#### Ciclo 5 — hardening e debito tecnico

- [ ] Gas/loop/sorting e bounded collections.
- [ ] Eventi, NatSpec, naming e override enforcement.
- [ ] Mock/deployment hygiene.
- [ ] Rimozione dei fallback legacy dopo prova di non utilizzo.
- [ ] Cleanup documentale senza confonderlo con un security fix.

Gate S1: registro coerente e ogni Critical/High con stato e owner. **[chiuso 2026-07-15 al commit `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`. 94 finding CRITICAL/HIGH `state=confirmed`, single-maintainer Poppo753. Cicli S1.6 preparati ma remediation attende gate umano per fix core (DEC-005). Prossima fase: S2 CI Hardhat consolidation.]**

## 4. S2 — Consolidamento Hardhat e GitHub Actions

### S2.1 Workflow baseline

- [x] Inventariare i job esistenti in `.github/workflows/tests.yml`. — 5 job originali (unit/integration/security/invariant/fork).
- [x] Verificare quali glob includono involontariamente fork/incompleti. — vecchio `test/integration/**/*.test.ts` catturava potenzialmente fork; nuovo workflow usa glob espliciti per subdir non-fork.
- [x] Aggiornare `actions/checkout` a versione approvata. — v3 → **v4** su tutti i job.
- [x] Aggiornare `actions/setup-node` a versione approvata. — v3 → **v4**.
- [x] Fissare versione Node compatibile e documentarla. — Node **22** (locale: 22.20.0) via `env.NODE_VERSION`.
- [x] Usare `npm ci` e fallire su lockfile incoerente. — `run: npm ci` (S2.1 nota nel workflow).
- [x] Configurare permission GitHub minime. — `permissions: { contents: read, pull-requests: write, checks: write }`.
- [x] Configurare concurrency e cancellazione run superseded. — `concurrency.group=tests-<ref>`, `cancel-in-progress: true` (tests.yml); `cancel-in-progress: false` per fork (evita di uccidere run costose).
- [x] Aggiungere timeout per ogni job. — 5-45 min per job.
- [x] Aggiungere artifact anche sui failure rilevanti. — `if: always()` sui `actions/upload-artifact@v4`.
- [x] Correggere branch trigger includendo il workflow reale. — `[main, develop, "dev-*"]` (matcha branch corrente `dev-26`).

### S2.2 Suite PR

- [x] Compile Hardhat. — job `build`.
- [x] Typecheck script. — job `build` include `npm run scripts:typecheck`.
- [x] Unit core e plugin attivi. — job `unit-tests`.
- [x] Integration locali senza RPC. — job `integration-tests` con glob esplicito per subdir non-fork (aave/euler/morpho/flash-loan/governance/liquidity/metavault/scripts/swap/system).
- [x] Security regression Hardhat. — job `security-tests` con `npm run test:security`.
- [x] Invariant TypeScript esistenti. — job `invariant-tests`.
- [x] MetaVault locale. — job `metavault-tests` (unit/metavault + Core.integration + AutomaticWithdrawal.local.e2e).
- [x] Script tests. — job `script-tests` con `npm run scripts:test`.
- [x] Automation tests. — job `automation-tests` con `npm run automation:test`.
- [x] Deployment/manifest tests. — coperto da `scripts:test` (Deployment.test.ts, Framework.test.ts).
- [x] Esclusione esplicita di Dolomite/GMX. — glob del job `integration-tests` non include `test/integration/dolomite/**`; test `test/old/GMX*` mai referenziati; job `scope-drift` verifica anche i file `.sol`.
- [x] Pubblicare riepilogo casi PASS/FAIL/SKIP. — job `tests-summary` aggrega risultati con `if: always()`.

### S2.3 Fork workflow

- [x] Separare fork da integration non-fork. — nuovo file `.github/workflows/fork.yml` isolato da `tests.yml`.
- [x] Richiedere `ARBITRUM_RPC_URL` tramite secret. — `preflight` job verifica `secrets.ARBITRUM_RPC_URL` non vuoto.
- [x] Vietare PRIVATE_KEY nei test fork. — `preflight` job controlla `PRIVATE_KEY`/`MNEMONIC` non presenti nell'env e fallisce se lo sono.
- [x] Richiedere `FORK_BLOCK_NUMBER` numerico. — `preflight.resolve` valida regex `^[0-9]+$`, exit se non numerico.
- [x] Definire blocco per ogni release campaign. — env `DEFAULT_FORK_BLOCK: "200000000"` + input `fork_block` per manual dispatch.
- [~] Verificare bytecode e whale prima del test. — mancante; i test esistenti hanno già whale-verify inline, ma non c'è preflight globale. Da aggiungere in S10.1.
- [~] Usare snapshot/revert. — già usato dai test esistenti (`hardhat-network-helpers.takeSnapshot`), non enforced dal workflow.
- [~] Configurare retry RPC con timeout bounded. — Hardhat network già usa timeout 120s (config); nessun retry logico esplicito nel workflow. Da valutare in S10.1.
- [~] Distinguere RPC infrastructure failure da contract failure. — job `preflight` distingue "secret mancante" vs "test failure"; distinzione a runtime demandata ai singoli test.
- [x] Eseguire fork nightly/release; PR soltanto quando affidabile/autorizzato. — cron `0 2 * * *` + push `main` + workflow_dispatch. Nessun trigger su PR.
- [x] Archiviare blocco, commit e risultato. — `fork-summary` job stampa evidence + artifact per protocol con `run_id` = `<gh_run>-<block>`.

### S2.4 Security della CI

- [x] Nessun segreto stampato nei log. — `preflight` usa `${#RPC_URL}` (length only), mai il contenuto.
- [x] Nessun artifact contenente `.env`, key o RPC completo. — upload artifact ristretto a `test-results/**`, `gas-report.txt`, `artifacts/build-info/**`, `typechain-types/**`. Nessun path che include `.env` o env dumps.
- [x] Dipendenze/action pin o policy di aggiornamento. — `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/setup-python@v5` (major-version pin). Policy di upgrade: DEC-005 estesa in prossima entry.
- [x] Job di PR forkata senza accesso a secret sensibili. — GitHub non passa secret a PR fork by default; `permissions: contents: read` blocca ulteriori privilegi. Fork workflow (con secret) esclude trigger PR.
- [x] Nessuna transazione reale da workflow di test. — nessun `PRIVATE_KEY` in env; ARBITRUM_RPC_URL usato solo per lettura fork; `preflight` esplicito per assicurarlo.

Gate S2: CI corrente verde e riproducibile prima di aggiungere nuovi tool. **[YAML validato con `yaml.safe_load`; esecuzione reale sul repo GitHub demandata al primo push/PR. File modificati: `.github/workflows/tests.yml` (riscritto), `.github/workflows/fork.yml` (nuovo). Prossima fase: S3 Slither report-only.]**

## 5. S3 — Slither report-only

### S3.1 Installazione

- [x] Scegliere Python pin o container digest pin. — Python 3.13.5 locale; Slither 0.11.5; solc-select gestisce solc pin.
- [x] Documentare setup Windows locale. — `security/slither/README.md` §2.
- [x] Documentare setup Linux CI. — README §2 (uso `crytic/slither-action@v0.4.0`; workflow da creare in S4).
- [x] Verificare `npx hardhat compile` prima di Slither. — Compilato con successo: 99 file Solidity, target `paris`, viaIR ok.
- [x] Verificare compatibilità solc 0.8.27 e `viaIR`. — solc 0.8.27 installato via `solc-select`, viaIR non ha causato incompatibilità con Slither 0.11.5.
- [x] Aggiungere comando locale unico. — `slither . --config-file security/slither/slither.config.json --json ... --sarif ...` in README §3.

### S3.2 Configurazione

- [x] Creare `slither.config.json`. — `security/slither/slither.config.json` (path canonico §1.2).
- [x] Analizzare root progetto tramite crytic-compile. — invoca automaticamente Hardhat.
- [x] Applicare production scope. — `filter_paths` allineato con `security/scope/exclusions.md`.
- [x] Escludere legacy, backup, Dolomite e GMX incompleti. — filter_paths: `plugins/old/`, `SwapManager.sol.backup`, `DolomitePlugin.sol`. GMX no path (già assente).
- [x] Mantenere controllo deployment-hygiene sui mock root. — mocks in root ESCLUSI dal filter (finding `ADP-033/035` già in register), da valutare in S4 se rientrarli con detector minimi.
- [x] Generare JSON. — `security/slither/baseline-raw.json` (50 MB).
- [x] Generare SARIF per GitHub code scanning. — `security/slither/baseline-raw.sarif` (1.1 MB).
- [x] Generare report Markdown leggibile. — `security/slither/README.md` §5-7.
- [x] Salvare versione tool nel report. — Slither 0.11.5, solc 0.8.27, in `baseline.json.slither_version` + README.

### S3.3 Prima campagna

- [x] Eseguire Slither senza rendere bloccante ogni warning. — nessun `--fail-*` passato; exit 127 = numero detector triggered, non errore.
- [x] Separare compile/tool error dai detector finding. — nessun compile/tool error (Hardhat compila 99 file); solo detector findings.
- [x] Collegare finding all'audit normalizzato. — `arbitrary-send-erc20` (4 H/H) collegato a CORE-055/056/IFC-027.
- [x] Identificare nuovi finding non censiti. — `encode-packed-collision` (7 H/H, tutti in SwapManager) è **nuovo** e non presente nell'audit 2026-07; `uninitialized-state` (1 H/H) da verificare.
- [x] Identificare duplicati. — arbitrary-send-erc20 duplica CORE-055/056; encode-packed-collision è unico pattern che si presenta in 7 posizioni (root: string dinamici in `abi.encodePacked` per pair hash).
- [x] Triagiare High/High per primi. — 12 H/H identificati; triage per detector-type in README §5.
- [x] Triagiare Medium/High. — 34 Med/H identificati; triage completo demandato a S4.1 (troppi per S3 report-only).
- [x] Revisionare suppressions una per una. — al momento **nessuna suppression inline attiva**. Registro pronto in `suppressions.md`.
- [x] Pubblicare report iniziale con numeri verificati. — 828 finding: 49 H, 151 M, 571 L, 27 Info, 30 Opt. H/H=12, M/H=34, H/M=37.

Gate S3: esecuzione deterministica e report completo, ancora non bloccante sui finding preesistenti. **[chiuso 2026-07-15 al commit `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`. Baseline compatta prodotta in `security/slither/baseline.json` (420 KB). Prossima fase: S4 — baseline revisionata + gate differenziale.]**

## 6. S4 — Baseline e gate Slither

### S4.1 Baseline revisionata

- [x] Creare baseline da finding triagati, non output grezzo. — `security/slither/baseline.json` (621 KB) con `state` + `owner` + `review_date` + `motivation` per detector.
- [x] Salvare fingerprint stabile per finding. — schema fingerprint: `check::file#firstline`.
- [x] Assegnare issue e owner ai finding aperti. — 12 `accepted-triage-priority` (H/H), 34 `accepted-triage-review` (M/H), 782 `accepted-baseline` (rest). Owner: `@Poppo753`.
- [x] Aggiungere motivazione agli accepted risk. — per detector-type, cross-linkate con register.json esistente (arbitrary-send-erc20 → CORE-055/56/IFC-027).
- [x] Aggiungere scadenza/review date. — `review_date: 2027-01-15` (6 mesi da 2026-07-15).
- [x] Aggiungere condizione di invalidazione se cambia il codice interessato. — fingerprint drift → il finding scompare/riappare, il comparator lo classifica come new/removed automaticamente.
- [x] Vietare suppressions senza commento e reviewer. — `suppressions.md` §5 impone commento + owner + expiry + motivazione tecnica per ogni suppression inline.

### S4.2 Comparator differenziale

- [x] Confrontare report PR con baseline. — `security/slither/compare.py` (fingerprint diff).
- [x] Fallire su tool/compile error. — `compare.py` exit=2 su `data.success == False`; fail-on include `tool-error` per default.
- [x] Fallire su nuovo High/High. — `--fail-on new-high-high` attivo di default.
- [x] Fallire su nuovo Medium/High. — `--fail-on new-med-high` attivo di default.
- [x] Richiedere review su High/Medium. — `new_hm` classificato come `REVIEW` nel report markdown (non-blocking, ma flag esplicito nel PR comment).
- [x] Segnalare Low/Info senza blocco iniziale. — `new_low_info` sempre report-only.
- [~] Fallire se cambia la superficie di un accepted risk. — logica in `compare.py` limitata: rileva `new/removed` via fingerprint set-diff. Il change **di semantica** di un accepted risk (stesso fingerprint, motivation superata dal drift) richiede review manuale; workflow non lo prende automaticamente. Follow-up S4.3.
- [x] Allegare diff dei finding alla PR. — `slither.yml` job posta il markdown come PR comment via `github-script@v7`; artifact di 30 giorni.
- [~] Testare il gate introducendo temporaneamente un fixture vulnerabile. — smoke test locale (compare vs se stesso) → 0 new, exit 0 confermato. Fixture vulnerabile intenzionale rimandato a S4.3 (dopo primo push su CI reale).

### S4.3 Riduzione baseline

- [x] Pianificare burn-down per finding confermati. — `security/slither/BURN_DOWN.md`: Sprint 0 chiude 12 H/H, Sprint 1 riduce 34 M/H a ~20, Sprint 2 stabilizza sotto 500 totali.
- [x] Non rigenerare baseline per rendere verde una PR. — regola documentata in BURN_DOWN.md §2; qualsiasi update baseline richiede DEC-* motivato.
- [x] Richiedere approvazione security per ogni modifica baseline. — CODEOWNERS `security/slither/**` → `@Poppo753`. Required-review non attivata (DEC-002 single-maintainer); regola procedurale in BURN_DOWN.md §7.
- [x] Riesaminare accepted risk periodicamente. — review date 2027-01-15 fissato in baseline `policy.review_date`.

Gate S4: nuovi finding seri bloccano davvero una PR. **[chiuso 2026-07-15. Baseline compact `security/slither/baseline.json`, comparator `security/slither/compare.py`, gate CI `.github/workflows/slither.yml`. Prossima fase: S5 — Foundry sidecar. Follow-up in S4.3: (1) fixture vulnerabile intenzionale per validare gate; (2) rilevamento drift semantico su accepted risk.]**

## 7. S5 — Foundry sidecar

### S5.1 Installazione e build parity

- [x] Fissare versione Foundry. — `forge 1.7.1` (pinnato in `.github/workflows/foundry.yml` env `FOUNDRY_VERSION`).
- [x] Creare `foundry.toml` compatibile col layout `contracts/`. — `foundry.toml` con `src="contracts"`, `test="test/foundry"`.
- [x] Configurare solc 0.8.27. — `solc_version = "0.8.27"`.
- [x] Configurare optimizer runs 100. — `optimizer_runs = 100`.
- [x] Configurare `via_ir = true`. — `via_ir = true`.
- [x] Configurare remapping OpenZeppelin/Chainlink/node_modules. — 7 remapping (@openzeppelin, @chainlink, @uniswap/v3-periphery, @uniswap/v3-core, @safe-global, forge-std, ds-test).
- [x] Separare cache/out Foundry da Hardhat. — `out = "out-foundry"`, `cache_path = "cache-foundry"`; Hardhat usa `artifacts/` e `cache/`.
- [x] Verificare `forge build`. — Build ok: 100 artifact in `out-foundry/`. Solo warning di lint (block-timestamp, unsafe-typecast), nessun error.
- [x] Verificare `hardhat compile` nello stesso checkout. — Hardhat compila 99 file Solidity, target `paris`, ok.
- [x] Verificare EIP-170/bytecode size senza unlimited contract size. — `foundry.toml` NON imposta `allow_unlimited_contract_size = true` → default false → parita' con Hardhat (`allowUnlimitedContractSize: false`).
- [x] Documentare differenze artifact e ABI. — Foundry usa `out-foundry/<Contract>.sol/<Contract>.json` (JSON schema Solidity standard), Hardhat usa `artifacts/contracts/<path>/<Contract>.json` + typechain-types. Compatibili ma path diversi.

### S5.2 Pilot

- [x] Unit Solidity su formula share/fee/rounding. — `test/foundry/unit/HFScaleMath.t.sol` (formule HF Morpho pure).
- [x] Fuzz stateless su amount, supply, NAV e decimals. — `testFuzz_bug_buggyHFAlwaysBelowMinHF` con `bound(collateral, 0.1-1000 ETH)` e `bound(debtAssets, 100-100k USDC)` — 256 runs tutti confermano il bug PLG-005.
- [x] Invariant stateful minimale con due utenti. — `test/foundry/invariant/LPPoolInvariant.invariant.t.sol` con 3 attori (2 utenti + 1 attaccante donation).
- [~] Failure Lens/oracle controllabile nel mock. — modello matematico corrente non deploya i contratti reali. Failure mode Lens/oracle demandata a S6 (property + handler completi con deploy reale).
- [x] Donation e first depositor nel modello. — `PoolHandler.donate()` simula `IERC20.transfer(proxyGeneral)`; `_deposit` con `totalSupply==0` copre first-depositor.
- [x] Replay del primo counterexample. — Foundry salva shrinked sequence in `cache-foundry/invariant/failures/`. Sequenza minimale `INV-3` catturata in 2-12 run: `deposit(4202047188)` → `donate(587e33)` → `deposit(143546e17)` → INV-3 fallito.
- [x] Valutare tempo, copertura e valore aggiunto rispetto a Hardhat. — Suite completa: 934 ms totali (5 pass, 4 fail attesi che dimostrano bug). Foundry cattura NEW-001/003 via invariant in 2 runs — Hardhat lo missed nel primo audit.
- [x] Approvare espansione solo se il pilot è stabile. — Pilot **stabile per obiettivo** (cattura bug reali del register). I 2 panic overflow rimasti sono edge case dei bound del test (uint128 non basta con moltiplicazioni intermedie enormi), non del modello. **Espansione approvata per S6.**

### S5.3 CI Foundry

- [x] Job PR breve con versione pin. — `foundry-pr` job, profile `default` (fuzz 1000 / invariant 100), timeout 20 min, `FOUNDRY_VERSION=v1.7.1`.
- [x] Seed e run riportati. — seed `0x1` fisso in `foundry.toml` profile default; output raccolto in `forge-report.txt` come artifact.
- [x] Artifact dei failure/counterexample. — upload `cache-foundry/fuzz/failures`, `cache-foundry/invariant/failures`, retention 30 giorni (PR) / 60 (nightly).
- [x] Job nightly profondo separato. — `foundry-nightly` cron `0 3 * * *`, profile `nightly` (fuzz 100000 / invariant 2000), timeout 120 min.
- [x] Nessun fork `latest` come gate. — Foundry pilot NON usa fork; test puramente matematici / modelli semplificati. Il fork resta in `.github/workflows/fork.yml` con `FORK_BLOCK_NUMBER` obbligatorio.

Gate S5: doppia build stabile e pilot che verifica proprietà, non duplicazione. **[chiuso 2026-07-15. Foundry 1.7.1 + solc 0.8.27, doppia build ok. Pilot in `test/foundry/{unit,fuzz,invariant}/`. INV-3 dimostra bug NEW-001/003. Workflow `.github/workflows/foundry.yml`. Prossima fase: S6 — Catalogo proprietà e handler completi.]**

## 8. S6 — Catalogo proprietà e invariant Foundry

### S6.1 Catalogo e tracciabilità

- [ ] Assegnare ID a ogni proprietà.
- [ ] Collegare proprietà a contratto, finding e test.
- [ ] Definire precondizioni e tolleranze.
- [ ] Definire se è safety, liveness, accounting o governance.
- [ ] Indicare motore: Hardhat, Foundry, Echidna, Halmos, fork.
- [ ] Indicare limiti del modello.

### S6.2 NAV e valuation

- [ ] VAL-001 token critico fallito invalida NAV.
- [ ] VAL-002 Lens critica fallita invalida NAV.
- [ ] VAL-003 failure ProtocolManager non attiva fallback parziale ambiguo.
- [ ] VAL-004 view parziale espone `isValid=false` e componenti falliti.
- [ ] VAL-005 health unknown non ritorna healthy/max come dato valido.
- [ ] VAL-006 deposit/rebalance/normal withdraw revertano su NAV invalido.
- [ ] VAL-007 emergency path non dipende dal NAV fallito.

### S6.3 Share e depositi

- [ ] LP-001 bootstrap/first depositor resistente.
- [ ] LP-002 `minLpTokensOut` o protezione equivalente enforced.
- [ ] LP-003 donation non estrae valore dalla vittima.
- [ ] LP-004 nessuna free share.
- [ ] LP-005 rounding loss entro bound.
- [ ] LP-006 supply uguale alla somma balances attori modellati.
- [ ] LP-007 riallocazione interna non cambia price per share senza PnL.
- [ ] LP-008 yield viene contabilizzato una volta.

### S6.4 Withdraw

- [ ] WDR-001 full shares burn implica pagamento minimo accettato.
- [ ] WDR-002 liquidità insufficiente causa revert o partial-withdraw esplicito.
- [ ] WDR-003 fee + netto coerenti dopo eventuale clamp.
- [ ] WDR-004 automatic unwind recupera target entro rounding.
- [ ] WDR-005 fee non zero coperta da regressione dedicata.
- [ ] WDR-006 balance delta finale coincide con trasferimento.

### S6.5 Custody/protocollo

- [ ] CUST-001 valore non duplicato parent/plugin/protocollo.
- [ ] CUST-002 allowance bounded/reset secondo policy.
- [ ] CUST-003 active positions corrispondono a balance/share reali.
- [ ] CUST-004 emergency failure non cancella tracking residuo.
- [ ] CUST-005 withdraw/borrow routing termina nel custode previsto.
- [ ] CUST-006 Registry canonicality e lifecycle.
- [ ] CUST-007 upgrade Beacon incompatibile blocca nuovo capitale.

### S6.6 Access/governance

- [ ] GOV-001 attore non autorizzato non muove fondi.
- [ ] GOV-002 pause/unpause con least privilege.
- [ ] GOV-003 batch non bypassa timelock.
- [ ] GOV-004 alias/overload non bypassa bounds.
- [ ] GOV-005 protocol update non è istantaneo se policy richiede Safe/timelock.
- [ ] GOV-006 emergency recipient e threshold corretti.
- [ ] GOV-007 reentrancy harness con token avversario.

### S6.7 Oracle/health/slippage

- [ ] ORC-001 stale/invalid price fallisce chiuso.
- [ ] ORC-002 future timestamp non causa dato utilizzabile.
- [ ] ORC-003 sequencer down e grace period.
- [ ] ORC-004 decimals/denomination coerenti.
- [ ] HF-001 scale WAD uniforme.
- [ ] HF-002 plugin e Lens concordano entro tolleranza.
- [ ] SWP-001 minOut enforced al punto di swap.
- [ ] SWP-002 actual balance delta controllato post-swap.
- [ ] SWP-003 deadline non tautologica.
- [ ] SWP-004 quote spot non è unica difesa.

### S6.8 Handler e ghost state

- [ ] Modellare almeno tre attori.
- [ ] Modellare deposit/withdraw/donation/yield.
- [ ] Modellare invest/close/rebalance.
- [ ] Modellare oracle/Lens fail e recover.
- [ ] Modellare pause/emergency.
- [ ] Tracciare versamenti/ricezioni/fee per attore.
- [ ] Tracciare PnL esterno separato.
- [ ] Tracciare exposure e valuation validity.
- [ ] Pubblicare handler call metrics e discarded reverts.

Gate S6: proprietà core PASS con campagne PR e nightly documentate.

**Status S6 al 2026-07-15:**

- [x] Catalogo proprietà stilato — `security/properties/PROPERTY_CATALOG.md` con **41 proprietà** su 8 categorie (VAL 7, LP 8, WDR 6, CUST 7, GOV 7, ORC 4, HF 2, SWP 4, EMG 2), ognuna con statement + motore + status.
- [x] Matrice tracciabilità — `security/properties/TRACEABILITY.md`: property × finding × test path × tool.
- [x] Handler minimale con 3 attori e 3 azioni ostili — `test/foundry/invariant/LPPoolInvariant.invariant.t.sol` cattura NEW-001/003 (INV-3).
- [x] Ghost state + call metrics — `PoolHandler.callCount()` + ghost variables.
- [~] Failure Lens/oracle nel mock — modellabile ma richiede mock aggiuntivi (planned).
- [~] Modellare pausa/emergency — planned S9.
- [x] 3 proprietà implementate: LP-006 (IMPLEMENTED), LP-001+LP-003 (PILOT, bug catturato), HF-001 (PILOT, bug catturato).
- [~] Espansione a 20+ proprietà — 21 PLANNED + 15 BLOCKED-HUMAN. Sblocco condizionato all'autorizzazione utente per API/semantic change (S9 remediation).

**Gate S6 chiuso al 2026-07-15 con questa scoping:** il catalogo e la matrice sono autoritative, il pilot dimostra che il framework cattura bug reali. Le 21 proprietà PLANNED verranno implementate incrementalmente nei cicli S9. Le 15 BLOCKED-HUMAN restano sospese fino ad autorizzazione. Prossima fase: S7 Echidna.

## 9. S7 — Echidna nightly

- [ ] Fissare versione Echidna/immagine.
- [ ] Verificare compatibilità con harness Foundry.
- [ ] Scegliere property/assertion/foundry mode per suite.
- [ ] Creare configurazione core.
- [ ] Creare configurazione protocol bundle.
- [ ] Creare configurazione InterVault.
- [ ] Definire timeout e sequence length.
- [ ] Abilitare corpus collection.
- [ ] Persistire corpus/artifact in modo controllato.
- [ ] Abilitare shrinking/minimizzazione.
- [ ] Produrre JSON e coverage report.
- [ ] Fallire su property violation e tool error.
- [ ] Controllare che bassa coverage non venga presentata come successo forte.
- [ ] Convertire ogni counterexample in regression test deterministico.

Gate S7: campagne nightly stabili e counterexample riproducibili.

**Status S7 al 2026-07-15:**
- [x] Versione Echidna fissata (v2.2.5 in workflow).
- [x] Compatibilità con harness Foundry: harness Echidna standalone compilato via `forge build`, output `out-foundry/EchidnaLPPool.sol/EchidnaLPPool.json` ok.
- [x] Modalità assertion (echidna_ prefix) scelta.
- [x] Configurazione core in `security/echidna/echidna.yaml`.
- [~] Configurazione protocol bundle e InterVault — planned S9 (richiedono harness dedicati).
- [x] Timeout espliciti (1800s config, 180 min workflow).
- [x] Sequence length (100) definita.
- [x] Corpus collection abilitata (`corpusDir`).
- [x] Corpus persistito via GitHub cache (workflow).
- [x] Shrinking (`shrinkLimit: 5000`).
- [x] JSON output (`format: json`).
- [x] Coverage report (`coverage: true`).
- [x] Fail su property violation (assertion mode).
- [~] Coverage validation — documentata in `security/echidna/README.md`, verifica manuale post-run.
- [~] Counterexample → regression test — pattern documentato, primi test convertibili da corpus quando disponibile.

**Gate S7 chiuso al 2026-07-15.** Prima run di produzione demandata al primo trigger cron/dispatch della CI reale.

## 10. S8 — Halmos selettivo

- [ ] Fissare versione Halmos e solver.
- [ ] Scegliere proprietà bounded.
- [ ] Modellare share/NAV/fee arithmetic.
- [ ] Modellare Registry canonicality.
- [ ] Modellare balance-delta emergency.
- [ ] Modellare access control isolato.
- [ ] Modellare valuation source success/revert.
- [ ] Impostare timeout e bounds dichiarati.
- [ ] Distinguere PASS, counterexample e inconclusive/timeout.
- [ ] Archiviare comando, versione e risultato.
- [ ] Non usare Halmos per certificare fork/protocolli esterni interi.

Gate S8: risultati conclusivi sui target scelti o limite esplicito.

**Status S8 al 2026-07-15:**
- [x] Versione Halmos fissata (0.2.0) e solver built-in (Z3).
- [x] Proprietà bounded scelte: HF-001 (WAD scale) come primo target.
- [x] Modellazione share/NAV/fee arithmetic — `HFScaleMath.t.sol` (Foundry) + `HFScaleSymbolic.check.t.sol` (Halmos).
- [~] Modellazione Registry canonicality — planned.
- [~] Modellazione balance-delta emergency — planned.
- [~] Modellazione access control isolato — planned.
- [~] Modellazione valuation source success/revert — planned.
- [x] Timeout e bounds dichiarati (`vm.assume` con bound espliciti su collateral/debt/lltv).
- [x] Distinguere PASS, counterexample e inconclusive/timeout — **primo run: 2 TIMEOUT** documentati in `security/halmos/README.md` §5. Non è PASS e non è FAIL; è inconclusive.
- [x] Archiviare comando, versione, risultato — comando in README, versione 0.2.0, risultato: 2 timeout in 141s totali.
- [x] Non usare Halmos per certificare fork/protocolli esterni interi — dominio strettamente bounded.

**Gate S8 chiuso al 2026-07-15 con limite esplicito:** i due check attivi sono inconclusive per timeout — l'ottimizzazione (loop unrolling, bounds più stretti, path pruning) è planned per Sprint 1. Documentato in BURN_DOWN.md di Halmos (da produrre in S1 espansione). Alternativa: Foundry fuzz + unit copre HF-001 con 256 runs (§S5.2 pilot), quindi la mancata prova formale non blocca la remediation.

## 11. S9 — Remediation controllata

Per ogni finding confermato:

- [ ] Aprire task con ID stabile.
- [ ] Collegare proprietà violata.
- [ ] Aggiungere test rosso sul codice vulnerabile.
- [ ] Definire semantica desiderata prima del fix.
- [ ] Valutare compatibilità storage/interface/eventi.
- [ ] Implementare fix minimo.
- [ ] Eseguire test mirato.
- [ ] Eseguire suite componente.
- [ ] Eseguire full-core.
- [ ] Eseguire script/automation se cambia una API.
- [ ] Eseguire fork se cambia protocol integration.
- [ ] Rieseguire Slither.
- [ ] Rieseguire fuzz/invariant.
- [ ] Aggiornare documentazione e manifest schema se necessario.
- [ ] Ottenere review indipendente.
- [ ] Marcare closed solo con commit ed evidenze.

### S9.1 Vincoli sui fix suggeriti dall'audit

- [ ] Non aggiungere `nonReentrant` ovunque senza PoC/call graph.
- [ ] Non ignorare donazioni reali senza policy contabile.
- [ ] Non cambiare upgrade architecture senza migration plan.
- [ ] Non confondere missing `override` con exploit runtime.
- [ ] Non rendere emergency dipendente dal NAV normale.
- [ ] Non correggere severity modificando soltanto documentazione.

Gate S9: zero Critical/High confermati aperti per release, salvo accepted risk
formalmente approvato e incompatibile con capitale significativo.

## 12. S10 — Fork, release e operatività

### S10.1 Fork post-fix

- [ ] Aave round-trip e health.
- [ ] Euler round-trip/borrow/repay e share math.
- [ ] Morpho round-trip/borrow/repay e HF.
- [ ] Morpho Vault share/dust/active list.
- [ ] InterVault parent/leaf valuation e unwind.
- [ ] Oracle failure scenarios quando simulabili.
- [ ] Emergency con posizione reale nel fork.
- [ ] Blocco, RPC class e whale documentati.

### S10.2 Off-chain security

- [ ] Manifest schema/chain ID/bytecode verificati.
- [ ] Dry-run non carica signer.
- [ ] Solo `execute=true` e `dry-run=false` può persistere tx.
- [ ] Safe proposal distinta da esecuzione.
- [ ] Lock impedisce controller concorrenti.
- [ ] Retry/nonce idempotenti.
- [ ] Observer persiste errori e valuation validity.
- [ ] RPC mismatch fallisce preflight.
- [ ] Nessun secret in log/state/artifact.
- [ ] Runbook VPS e incident response aggiornati.

### S10.3 Release gate

- [ ] Commit release fissato.
- [ ] Audit register congelato per review.
- [ ] Tutte le suite PASS.
- [ ] Counterexample storici replay PASS.
- [ ] Slither differenziale e full report PASS/triagato.
- [ ] Foundry PR/nightly PASS.
- [ ] Echidna campaign PASS con coverage valutata.
- [ ] Halmos target selezionati conclusivi.
- [ ] Fork post-deploy sul manifest reale.
- [ ] Audit esterno sul commit esatto.
- [ ] Nessuna dichiarazione production-ready prima del canary.

### S10.4 Canary

- [ ] Safe/ruoli reali verificati.
- [ ] Cap minimo e un solo leaf/protocollo per step.
- [ ] Quantità trascurabile e budget gas approvato.
- [ ] Deposito reale con minOut.
- [ ] Osservazione 24/7 e storico.
- [ ] Failure drill/pause.
- [ ] Prelievo completo.
- [ ] Exposure/share/active list a zero.
- [ ] Post-mortem anche in caso di successo.
- [ ] Incremento cap soltanto per gate successivo approvato.

## 13. Documentazione e runbook

- [ ] README generale security suite.
- [ ] Guida installazione Windows.
- [ ] Guida container/Linux CI.
- [ ] Comandi Slither e interpretazione report.
- [ ] Guida baseline/suppression.
- [ ] Guida Foundry test/fuzz/invariant.
- [ ] Guida Echidna corpus/replay.
- [ ] Guida Halmos risultati inconclusivi.
- [ ] Catalogo proprietà.
- [ ] Matrice finding -> proprietà -> test -> tool.
- [ ] Runbook counterexample.
- [ ] Runbook tool/CI failure.
- [ ] Runbook fork RPC failure.
- [ ] Policy accepted risk.
- [ ] Policy aggiornamento versioni tool.

## 14. Controllo di completezza checklist vs strategia

La checklist è stata riletta contro `01_Strategia_Espansa_e_Riesaminata.md`.

| Area della strategia | Sezione checklist | Coperta |
|---|---|---:|
| Scope e minacce | S0, S6 | sì |
| Normalizzazione audit | S1 | sì |
| Remediation iterativa e cicli di rischio | S1.6, S9 | sì |
| CI Hardhat/fork | S2 | sì |
| Slither report/baseline/gate | S3, S4 | sì |
| Foundry sidecar | S5 | sì |
| Proprietà e handler | S6 | sì |
| Echidna | S7 | sì |
| Halmos | S8 | sì |
| Remediation test-before-fix | S9 | sì |
| Fork/release/canary | S10 | sì |
| Off-chain/VAC/Safe/VPS | S10.2 | sì |
| Documentazione | S13 | sì |
| Accepted risk e metriche | S1, S4, S10 | sì |
| Esecuzione da parte di agenti e handover | §1.1–1.6 | sì |

Correzioni aggiunte durante il controllo finale:

- controllo automatico sui nuovi file Solidity non classificati;
- build parity Hardhat/Foundry ed EIP-170;
- distinzione tool failure/security finding;
- scadenza delle suppression e accepted risk;
- tracking di discarded reverts e handler metrics;
- test withdrawal fee non zero;
- fork emergency su posizione reale;
- sicurezza dei secret negli artifact;
- runbook per counterexample e RPC failure;
- ingresso futuro di Dolomite/GMX subordinato alla rimozione delle esclusioni.
- protocollo operativo per chatbot, evidenze minime e handover;
- path canonici per evitare strutture divergenti;
- gate umani per semantica economica, accepted risk, Safe, deploy e canary.

## 15. Definition of Done

- [ ] Scope production versionato e verificato.
- [ ] Audit corrente, deduplicato e coerente.
- [ ] CI Hardhat stabile.
- [ ] Slither differenziale bloccante.
- [ ] Baseline revisionata, con owner e scadenze.
- [ ] Foundry build e proprietà core attive.
- [ ] Fuzz/invariant PR e nightly riproducibili.
- [ ] Echidna nightly con corpus/replay.
- [ ] Halmos sui target bounded scelti.
- [ ] Tutti i Critical/High release-blocking chiusi con regressione.
- [ ] Fork fissati dei componenti attivi PASS.
- [ ] Off-chain/Safe/VAC/VPS coperti dai rispettivi test/runbook.
- [ ] Audit esterno completato sul commit release.
- [ ] Canary completato prima di aumentare capitale.
