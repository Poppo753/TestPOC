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

- [ ] Registrare branch e commit che saranno analizzati.
- [ ] Registrare data, solc, Hardhat, Node e lockfile.
- [ ] Confrontare il commit dell'audit 2026-07 con HEAD corrente.
- [ ] Elencare file production aggiunti dopo l'audit, incluso InterVault.
- [ ] Salvare il diff di scope come artifact/documento.
- [ ] Dichiarare che risultati su linee obsolete richiedono riverifica.

Deliverable: `security/scope/audit-snapshot.md`.

### S0.2 Scope production machine-readable

- [ ] Creare elenco include per core e componenti attivi.
- [ ] Includere Aave, Euler, Morpho, Morpho Vault e InterVault.
- [ ] Includere FlashLoanService e swap path realmente deploygabili.
- [ ] Includere le interfacce consumate a runtime.
- [ ] Definire scope off-chain: deploy, manifest, Safe, CLI e VAC.
- [ ] Escludere Dolomite e GMX con motivazione e criterio di reingresso.
- [ ] Escludere `plugins/old`, backup e copy non production.
- [ ] Separare mock production-hygiene da contratti deploygabili.
- [ ] Aggiungere controllo CI che segnali nuovi file Solidity non classificati.

Deliverable: `security/scope/production-paths.txt` e `exclusions.md`.

### S0.3 Ownership

- [ ] Assegnare owner tecnico alla suite.
- [ ] Assegnare reviewer indipendente per accepted risk e suppression.
- [ ] Stabilire chi può modificare baseline e configurazioni security.
- [ ] Proteggere tali path con CODEOWNERS/review obbligatoria.

Gate S0: nessun tool viene configurato prima di avere scope e owner.

## 3. S1 — Normalizzazione dell'audit

### S1.1 Schema dei finding

- [ ] Definire schema JSON o tabellare autorevole.
- [ ] Rendere obbligatori ID, title, commit, component, severity e confidence.
- [ ] Aggiungere actor, prerequisites, impact e invariant violated.
- [ ] Aggiungere PoC, fix commit, regression e residual risk.
- [ ] Definire stati ammessi e transizioni.
- [ ] Validare lo schema in CI.

### S1.2 Correzione strutturale

- [ ] Ricalcolare i totali per severity.
- [ ] Correggere la tabella Critical incoerente col totale dichiarato.
- [ ] Rimuovere PLG-006 dalle liste in cui rimane dopo il falso positivo.
- [ ] Individuare tutte le collisioni ID come `CORE-049`.
- [ ] Deduplicare `CORE-049`/`NEW-028` e finding equivalenti.
- [ ] Separare varianti/scenari dalla root cause.
- [ ] Separare production bug, hardening, gas, docs e deployment hygiene.
- [ ] Aggiornare path e linee al commit corrente.
- [ ] Inserire InterVault e i nuovi script/test nello scope.
- [ ] Conservare storico e alias degli ID rimossi.

### S1.3 Finding valuation unificato

- [ ] Creare finding root `critical valuation fail-open`.
- [ ] Includere token oracle failure.
- [ ] Includere Lens failure in ProtocolManager.
- [ ] Includere fallback legacy Euler quando fallisce ProtocolManager.
- [ ] Includere health adapter failure mascherata come healthy/max.
- [ ] Collegare deposit, withdraw, reserve ratio e automation.
- [ ] Separare view diagnostica best-effort da NAV transazionale.
- [ ] Definire soluzione attesa: validità esplicita e fail-closed economico.
- [ ] Definire recovery che non dipenda dallo stesso NAV fallito.

### S1.4 Verification Critical/High

Per ogni finding:

- [ ] Verificare codice corrente e reachability.
- [ ] Ricostruire call graph e ruoli.
- [ ] Identificare asset a rischio.
- [ ] Scrivere scenario minimo.
- [ ] Creare PoC o motivare formalmente perché non riproducibile.
- [ ] Rivalutare severity e confidence.
- [ ] Marcare duplicate/false-positive/accepted-risk con reviewer.
- [ ] Non proporre fix architetturali prima della root cause.

### S1.5 Priorità iniziali

- [ ] Verificare withdrawal clamp + burn completo.
- [ ] Verificare emergency selector/path.
- [ ] Verificare first-depositor e donation attack.
- [ ] Verificare NAV token/Lens fail-open.
- [ ] Verificare Morpho HF scale e Lens/plugin consistency.
- [ ] Verificare minOut nei percorsi realmente raggiungibili.
- [ ] Verificare timelock/batch/parameter execution.
- [ ] Verificare interface selector incompatibili a runtime.
- [ ] Verificare Sequencer Uptime Feed e oracle states.
- [ ] Verificare upgrade/storage semantics reali del Beacon.
- [ ] Verificare reentrancy con token/callback avversario, non per assenza modifier.

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

Gate S1: registro coerente e ogni Critical/High con stato e owner.

## 4. S2 — Consolidamento Hardhat e GitHub Actions

### S2.1 Workflow baseline

- [ ] Inventariare i job esistenti in `.github/workflows/tests.yml`.
- [ ] Verificare quali glob includono involontariamente fork/incompleti.
- [ ] Aggiornare `actions/checkout` a versione approvata e pin policy.
- [ ] Aggiornare `actions/setup-node` a versione approvata.
- [ ] Fissare versione Node compatibile e documentarla.
- [ ] Usare `npm ci` e fallire su lockfile incoerente.
- [ ] Configurare permission GitHub minime.
- [ ] Configurare concurrency e cancellazione run superseded.
- [ ] Aggiungere timeout per ogni job.
- [ ] Aggiungere artifact anche sui failure rilevanti.
- [ ] Correggere branch trigger includendo il workflow reale.

### S2.2 Suite PR

- [ ] Compile Hardhat.
- [ ] Typecheck script.
- [ ] Unit core e plugin attivi.
- [ ] Integration locali senza RPC.
- [ ] Security regression Hardhat.
- [ ] Invariant TypeScript esistenti.
- [ ] MetaVault locale.
- [ ] Script tests.
- [ ] Automation tests.
- [ ] Deployment/manifest tests.
- [ ] Esclusione esplicita di Dolomite/GMX.
- [ ] Pubblicare riepilogo casi PASS/FAIL/SKIP.

### S2.3 Fork workflow

- [ ] Separare fork da integration non-fork.
- [ ] Richiedere `ARBITRUM_RPC_URL` tramite secret.
- [ ] Vietare PRIVATE_KEY nei test fork.
- [ ] Richiedere `FORK_BLOCK_NUMBER` numerico.
- [ ] Definire blocco per ogni release campaign.
- [ ] Verificare bytecode e whale prima del test.
- [ ] Usare snapshot/revert.
- [ ] Configurare retry RPC con timeout bounded.
- [ ] Distinguere RPC infrastructure failure da contract failure.
- [ ] Eseguire fork nightly/release; PR soltanto quando affidabile/autorizzato.
- [ ] Archiviare blocco, commit e risultato.

### S2.4 Security della CI

- [ ] Nessun segreto stampato nei log.
- [ ] Nessun artifact contenente `.env`, key o RPC completo.
- [ ] Dipendenze/action pin o policy di aggiornamento.
- [ ] Job di PR forkata senza accesso a secret sensibili.
- [ ] Nessuna transazione reale da workflow di test.

Gate S2: CI corrente verde e riproducibile prima di aggiungere nuovi tool.

## 5. S3 — Slither report-only

### S3.1 Installazione

- [ ] Scegliere Python pin o container digest pin.
- [ ] Documentare setup Windows locale.
- [ ] Documentare setup Linux CI.
- [ ] Verificare `npx hardhat compile` prima di Slither.
- [ ] Verificare compatibilità solc 0.8.27 e `viaIR`.
- [ ] Aggiungere comando locale unico.

### S3.2 Configurazione

- [ ] Creare `slither.config.json`.
- [ ] Analizzare root progetto tramite crytic-compile.
- [ ] Applicare production scope.
- [ ] Escludere legacy, backup, Dolomite e GMX incompleti.
- [ ] Mantenere controllo deployment-hygiene sui mock root.
- [ ] Generare JSON.
- [ ] Generare SARIF per GitHub code scanning.
- [ ] Generare report Markdown leggibile.
- [ ] Salvare versione tool nel report.

### S3.3 Prima campagna

- [ ] Eseguire Slither senza rendere bloccante ogni warning.
- [ ] Separare compile/tool error dai detector finding.
- [ ] Collegare finding all'audit normalizzato.
- [ ] Identificare nuovi finding non censiti.
- [ ] Identificare duplicati.
- [ ] Triagiare High/High per primi.
- [ ] Triagiare Medium/High.
- [ ] Revisionare suppressions una per una.
- [ ] Pubblicare report iniziale con numeri verificati.

Gate S3: esecuzione deterministica e report completo, ancora non bloccante sui
finding preesistenti.

## 6. S4 — Baseline e gate Slither

### S4.1 Baseline revisionata

- [ ] Creare baseline da finding triagati, non output grezzo.
- [ ] Salvare fingerprint stabile per finding.
- [ ] Assegnare issue e owner ai finding aperti.
- [ ] Aggiungere motivazione agli accepted risk.
- [ ] Aggiungere scadenza/review date.
- [ ] Aggiungere condizione di invalidazione se cambia il codice interessato.
- [ ] Vietare suppressions senza commento e reviewer.

### S4.2 Comparator differenziale

- [ ] Confrontare report PR con baseline.
- [ ] Fallire su tool/compile error.
- [ ] Fallire su nuovo High/High.
- [ ] Fallire su nuovo Medium/High.
- [ ] Richiedere review su High/Medium.
- [ ] Segnalare Low/Info senza blocco iniziale.
- [ ] Fallire se cambia la superficie di un accepted risk.
- [ ] Allegare diff dei finding alla PR.
- [ ] Testare il gate introducendo temporaneamente un fixture vulnerabile.

### S4.3 Riduzione baseline

- [ ] Pianificare burn-down per finding confermati.
- [ ] Non rigenerare baseline per rendere verde una PR.
- [ ] Richiedere approvazione security per ogni modifica baseline.
- [ ] Riesaminare accepted risk periodicamente.

Gate S4: nuovi finding seri bloccano davvero una PR.

## 7. S5 — Foundry sidecar

### S5.1 Installazione e build parity

- [ ] Fissare versione Foundry.
- [ ] Creare `foundry.toml` compatibile col layout `contracts/`.
- [ ] Configurare solc 0.8.27.
- [ ] Configurare optimizer runs 100.
- [ ] Configurare `via_ir = true`.
- [ ] Configurare remapping OpenZeppelin/Chainlink/node_modules.
- [ ] Separare cache/out Foundry da Hardhat.
- [ ] Verificare `forge build`.
- [ ] Verificare `hardhat compile` nello stesso checkout.
- [ ] Verificare EIP-170/bytecode size senza unlimited contract size.
- [ ] Documentare differenze artifact e ABI.

### S5.2 Pilot

- [ ] Unit Solidity su formula share/fee/rounding.
- [ ] Fuzz stateless su amount, supply, NAV e decimals.
- [ ] Invariant stateful minimale con due utenti.
- [ ] Failure Lens/oracle controllabile nel mock.
- [ ] Donation e first depositor nel modello.
- [ ] Replay del primo counterexample.
- [ ] Valutare tempo, copertura e valore aggiunto rispetto a Hardhat.
- [ ] Approvare espansione solo se il pilot è stabile.

### S5.3 CI Foundry

- [ ] Job PR breve con versione pin.
- [ ] Seed e run riportati.
- [ ] Artifact dei failure/counterexample.
- [ ] Job nightly profondo separato.
- [ ] Nessun fork `latest` come gate.

Gate S5: doppia build stabile e pilot che verifica proprietà, non duplicazione.

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
