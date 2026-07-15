# Strategia espansa e riesaminata della suite di sicurezza

## 1. Obiettivo verificabile

La suite deve consentire di rispondere, per un commit preciso, alle domande:

1. quali contratti sono nello scope production;
2. quali proprietà economiche e di sicurezza devono sempre valere;
3. quali test e tool verificano ciascuna proprietà;
4. quali finding sono aperti, confermati, accettati o chiusi;
5. quali evidenze consentono di promuovere il commit da sviluppo a canary;
6. come riprodurre localmente ogni failure della CI;
7. come impedire che una baseline nasconda regressioni nuove.

Il risultato non è la promessa “nessun bug”, impossibile da dimostrare in senso
assoluto. È un sistema di assurance multilivello con scope, assunzioni e limiti
espliciti.

## 2. Perimetro

### 2.1 Production scope iniziale

- Beacon e moduli core;
- ProxyGeneral;
- LiquidityManager;
- ValueCalculator e TokenManager;
- ProtocolManager;
- ParameterManager ed EmergencyHandler;
- ChainlinkAdapter;
- Aave plugin/registry/Lens;
- Euler plugin/registry/Lens;
- Morpho plugin/registry/Lens;
- Morpho Vault plugin/Lens;
- InterVault Registry/Plugin/Lens;
- FlashLoanService e swap path realmente utilizzati;
- interfacce consumate dal codice production.

### 2.2 Scope operativo

- deployment e aggiornamento bundle;
- manifest e validazione schema;
- CLI con dry-run/execution;
- Safe advisory/proposal;
- Vault Automation Controller monitor-only o enabled secondo gate;
- observer VPS e persistenza degli snapshot;
- preflight, health e incident response.

### 2.3 Esclusioni iniziali

- Dolomite e GMX incompleti;
- `contracts/plugins/old`;
- file backup/copy/documentali compilati per errore;
- mock, salvo che il controllo sia deployment hygiene;
- test `old` non autorevoli;
- scenari cross-chain non implementati.

Le esclusioni devono essere per path e motivate. Quando un componente entra
nello scope, la PR deve rimuovere l'esclusione e aggiungere proprietà/test.

## 3. Modello di minaccia

La suite deve modellare almeno:

- utente permissionless razionale;
- attaccante MEV capace di ordinare transazioni e donare token;
- token con callback o comportamento ERC-20 non standard;
- oracle stale, revertente, fuori scala o con timestamp anomalo;
- Lens e protocollo esterno che revertano;
- RPC intermittente nell'off-chain, senza confonderla con un revert on-chain;
- owner compromesso prima e dopo Safe/timelock;
- modulo autorizzato compromesso;
- upgrade Beacon incompatibile;
- failure parziale durante emergency unwind;
- concorrenza di più utenti e richieste simultanee;
- rounding/dust su asset con 6, 8 e 18 decimali;
- protocollo con share price variabile e yield/donation;
- configurazione corretta al deploy ma divenuta invalida dopo upgrade.

Assunzioni non verificabili dal codice, come correttezza di Aave o Chainlink,
devono diventare controlli di configurazione, fork e monitoraggio.

## 4. Tassonomia delle proprietà

### 4.1 Safety

Qualcosa di negativo non deve mai accadere:

- creazione di valore dal nulla;
- doppio conteggio;
- trasferimento non autorizzato;
- share bruciate senza controvalore accettato;
- NAV parziale presentato come valido;
- health sconosciuto presentato come sano;
- swap sotto `minOut` committato;
- riapertura di circuit breaker senza autorizzazione.

### 4.2 Liveness

Qualcosa di necessario deve restare possibile:

- un LP può uscire quando la liquidità è disponibile;
- una posizione può essere chiusa;
- l'emergency recovery autorizzata non viene bloccata dal percorso normale;
- una configurazione deprecated può essere rimossa a saldo zero;
- il controller può osservare e persistere anche quando l'esecuzione è vietata.

Safety e liveness possono confliggere. Il fail-closed del NAV deve bloccare
depositi/prelievi normali, non necessariamente l'unwind di emergenza misurato
su balance delta.

### 4.3 Accounting

- asset e liability usano unità e decimals dichiarati;
- `totalSupply`, balances LP e burn/mint sono coerenti;
- fee + netto = lordo entro rounding definito;
- il prezzo share non varia per una riallocazione interna priva di profit/loss;
- yield reale aumenta il NAV una sola volta;
- debt viene sottratto una sola volta;
- protocol share viene convertita con la direzione di rounding corretta.

### 4.4 Governance e upgrade

- ogni funzione privilegiata ha un ruolo previsto;
- batch e alias non bypassano timelock;
- upgrade/config change producono eventi e manifest aggiornato;
- una modifica dell'indirizzo non viene confusa con storage migration;
- i moduli stateful hanno una procedura di migrazione o vengono dichiarati
  sostituzioni non trasparenti;
- Safe threshold e signer policy sono verificati off-chain e on-chain.

## 5. Architettura dei file proposta

La struttura è indicativa e deve essere introdotta solo quando si implementa:

```text
security/
├── README.md
├── scope/
│   ├── production-paths.txt
│   └── exclusions.md
├── findings/
│   ├── register.json
│   ├── schema.json
│   └── accepted-risk.md
├── slither/
│   ├── slither.config.json
│   ├── baseline.json
│   └── suppressions.md
├── properties/
│   ├── PROPERTY_CATALOG.md
│   └── TRACEABILITY.md
├── foundry/
│   ├── unit/
│   ├── fuzz/
│   ├── invariant/
│   ├── handlers/
│   └── mocks/
├── echidna/
│   ├── echidna.yaml
│   ├── harnesses/
│   └── corpus/
├── halmos/
│   ├── README.md
│   └── properties/
└── reports/                 # generati, non necessariamente versionati
```

Decisione revisionata: non spostare subito tutti i test Foundry sotto una root
non standard se ciò complica Hardhat. È accettabile usare `test/foundry/*.t.sol`
e una cartella `security/` soltanto per configurazioni e cataloghi. Il layout
finale va validato con entrambi i compiler prima di creare decine di file.

## 6. Lifecycle autorevole di un finding

Ogni finding deve contenere:

- ID stabile e unico;
- titolo;
- commit di scoperta;
- file/riga o componente;
- categoria;
- severity;
- confidence;
- stato;
- attore e prerequisiti;
- impatto;
- invariante violato;
- PoC/test associato;
- fix PR/commit;
- regression test;
- rischio residuo;
- reviewer;
- data di ultima verifica.

Stati ammessi:

```text
candidate
→ triaged
→ confirmed | false-positive | duplicate | accepted-risk | out-of-scope
→ fix-in-progress
→ fixed-pending-verification
→ closed
```

`closed` richiede test e verifica sul commit contenente il fix. “Il codice sembra
corretto” non è evidenza sufficiente.

### 6.1 Severity e confidence separate

Severity misura l'impatto se il finding è vero. Confidence misura quanto è
solida la dimostrazione. Un `High/Low-confidence` non deve essere trattato come
un `High/High-confidence`; deve ricevere priorità di verifica, non fix cieco.

### 6.2 Deduplicazione

Due finding sono duplicati quando condividono root cause e remediation, anche
se hanno scenari diversi. Gli scenari diventano casi del finding principale.

Per esempio:

```text
VALUATION-001 Critical valuation fail-open
├── token oracle failure
├── protocol Lens failure
├── ProtocolManager total failure / legacy fallback
├── health adapter failure
└── automation reads partial value
```

Le conseguenze possono avere test separati senza gonfiare il conteggio bug.

## 7. Fase 0 — audit normalization

### 7.1 Snapshot

- registrare commit auditato;
- confrontarlo con HEAD;
- censire file nuovi/modificati dopo l'audit;
- inserire InterVault nello scope;
- non applicare finding riferiti a linee obsolete senza riverifica.

### 7.2 Correzione strutturale

- riconciliare conteggi;
- eliminare ID collision;
- collegare duplicati;
- rimuovere false positive dalle liste prioritarie;
- separare `Critical/High confirmed` da `candidate`;
- distinguere bug production da mock/deployment hygiene;
- riscrivere la roadmap in base alla dipendenza tra fix.

### 7.3 Ordine di verifica

1. perdita o blocco fondi;
2. share/NAV e dilution;
3. access control/upgrade;
4. slippage/oracle/health;
5. emergency/pause;
6. interfacce runtime incompatibili;
7. availability e gas DoS;
8. quality/info.

### 7.4 Test-before-fix

Per ogni Critical/High confermabile:

1. creare test minimo rosso;
2. dimostrare lo stato prima/dopo;
3. applicare fix minimo;
4. eseguire test mirato;
5. eseguire suite di area;
6. eseguire full-core e fork se coinvolge protocollo esterno;
7. aggiornare finding ed evidenze.

## 8. Fase 1 — consolidamento Hardhat e CI

### 8.1 Workflow

L'attuale `.github/workflows/tests.yml` va prima reso affidabile:

- action aggiornate e versionate;
- Node compatibile col progetto e fissato;
- `npm ci` da lockfile;
- branch trigger coerenti con il branching reale;
- concurrency con cancellazione dei run superseded;
- permission minime;
- timeout per job;
- artifact test/report;
- job che non includano fork in glob non-fork;
- Dolomite/GMX esclusi in modo esplicito, non tramite failure ignorate;
- fork solo se secret disponibile e con blocco numerico obbligatorio;
- nessuna PRIVATE_KEY nei job di test;
- matrice o workflow riutilizzabili per ridurre duplicazione.

### 8.2 Gate PR

I gate iniziali devono includere:

- compile;
- typecheck script;
- unit core/plugin attivi;
- integration locali;
- MetaVault locale;
- script e automation;
- security regression;
- invariant correnti;
- diff/check e artifact essenziali.

I fork pubblici non devono rendere casualmente rossa ogni PR. Possono essere
nightly e release, oppure PR autorizzate con RPC stabile e blocco fissato.

## 9. Fase 2 — Slither

### 9.1 Installazione riproducibile

Opzioni:

- Python environment con versione pin;
- container Trail of Bits con digest pin;
- action dedicata con versione pin.

Decisione revisionata: per sviluppo Windows e CI Linux, un container o un
environment Python documentato riduce il drift. Non usare `latest` come gate.

### 9.2 Configurazione

- target root del progetto, affinché crytic-compile usi Hardhat;
- solc coerente;
- esclusioni precise per legacy/mock/incompleti;
- report JSON/SARIF e checklist Markdown;
- detector ad alta confidence sempre visibili;
- suppression per ID/path, non disabilitazione massiva;
- commento e owner per ogni suppression.

### 9.3 Prima esecuzione

Il job parte `continue-on-error` o report-only. Si raccolgono:

- detector;
- severity/confidence;
- file e funzione;
- duplicati;
- finding già presenti nell'audit;
- finding nuovi;
- falsi positivi;
- tool error/compilation error separati dai security finding.

### 9.4 Baseline

La baseline non deve essere soltanto l'output grezzo. Deve contenere finding
revisionati e una fingerprint stabile. Ogni voce accettata ha:

- motivazione;
- owner;
- expiry/review date;
- issue collegata;
- condizioni che renderebbero invalida l'accettazione.

### 9.5 Gate differenziale

Prima policy:

- tool/compile error: FAIL;
- nuovo High/High: FAIL;
- nuovo Medium/High: FAIL;
- nuovo High/Medium: review obbligatoria;
- Low/Info: report;
- finding baseline modificato: review;
- aumento di superficie su accepted-risk: FAIL finché rivalutato.

## 10. Fase 3 — Foundry sidecar

### 10.1 Compatibilità

`foundry.toml` deve replicare:

- `src = contracts`;
- Solidity 0.8.27;
- optimizer 100;
- `via_ir = true`;
- EVM version coerente;
- librerie `node_modules`/remapping;
- path artifact separati da Hardhat;
- permission filesystem minime;
- RPC alias senza segreti versionati.

Il primo gate è `hardhat compile` e `forge build` sullo stesso source tree con
bytecode size coerente e nessun cambio di sorgente.

### 10.2 Pilot

Il pilot deve coprire tre categorie:

1. unit puro: formula share/rounding;
2. fuzz: deposit amount, supply, NAV e decimals;
3. stateful invariant: più utenti, deposit/donation/withdraw/failure Lens.

Se il pilot duplica soltanto test Hardhat senza trovare nuovi stati, va
ridisegnato prima di espandere Foundry.

### 10.3 Handler stateful

Gli handler devono generare azioni valide e tracciare ghost state:

- deposit utente;
- withdraw parziale/totale;
- donation base e token attivo;
- invest/close protocollo;
- yield positivo;
- fee change autorizzato;
- pause/unpause;
- Lens/oracle fail/recover;
- cap/lifecycle update;
- emergency unwind;
- upgrade mock compatibile/incompatibile.

Ghost variables:

- asset netti versati per utente;
- asset netti ricevuti;
- fee totali;
- profit/loss esterno simulato;
- supply attesa;
- exposure per protocollo;
- valore visibile e validità della valuation.

### 10.4 Proprietà Foundry prioritarie

#### VAL-001 — NAV validity

Se un token/Lens critical attivo fallisce, le entry point economiche revertano.
Le view diagnostiche possono restituire stato parziale solo insieme a
`isValid=false` e componenti falliti.

#### LP-001 — No free shares

Il valore ritirabile dall'attaccante non supera versamenti + yield attribuibile
- fee, salvo rounding bound.

#### LP-002 — Withdrawal atomicity

O l'utente riceve almeno il minimo accettato e vengono bruciate le share, oppure
l'intera transazione reverte.

#### LP-003 — Donation resistance

Donazioni e first-depositor non permettono di estrarre valore dalla vittima.

#### CUST-001 — Conservation

Valore parent + plugin + protocollo, al netto del debito, coincide col modello
entro tolleranza e senza doppio conteggio.

#### GOV-001 — Privilege

Attori non autorizzati non modificano indirizzi, cap, ruoli, pause o fondi.

#### EMG-001 — Recovery

Con sistema pausato, recovery autorizzata restituisce quanto effettivamente
ricevuto e conserva tracking delle posizioni fallite.

### 10.5 Fuzz configuration

- run brevi nelle PR;
- run più profondi nightly;
- seed riportato;
- counterexample persistiti;
- `fail_on_revert` scelto per harness, non globalmente senza analisi;
- metriche sulle chiamate handler e reverts;
- bound realistici ma con edge 0/max/decimals;
- nessun `assume` così stretto da eliminare gli scenari interessanti.

## 11. Fase 4 — Echidna

### 11.1 Perché dopo Foundry

Scrivere proprietà è più costoso che installare il fuzzer. Foundry fornisce un
feedback loop rapido; quando proprietà e handler sono maturi, Echidna aggiunge
mutation, corpus, shrinking e campagne lunghe.

### 11.2 Modalità

- riuso test/invariant Foundry dove compatibile;
- assertion/property mode per harness specifici;
- corpus versionato solo se stabile e privo di dati sensibili;
- corpus CI come artifact se voluminoso;
- campagne separate per core, protocol bundle e InterVault;
- timeout espliciti;
- JSON output parsato e archiviato.

### 11.3 Gate

Echidna nightly fallisce su proprietà violata o harness/tool error. La mancata
copertura non è automaticamente PASS: va pubblicata la coverage e controllata
la distribuzione delle chiamate.

## 12. Fase 5 — Halmos

### 12.1 Target adatto

- formule share con supply/NAV simbolici bounded;
- rounding e fee conservation;
- access control di funzioni isolate;
- state transition del Registry;
- impossibilità di alias token;
- balance-delta emergency accounting;
- fail-closed su sorgente di valore simbolicamente revertente.

### 12.2 Target inadatto iniziale

- intero stack con Aave/Euler/Morpho reali;
- fork Arbitrum completo;
- RPC e Safe;
- loop non bounded su registry grandi;
- proprietà che dipendono da comportamento off-chain.

Un timeout symbolic non è una prova né un failure di sicurezza: è un risultato
inconclusivo da documentare.

## 13. Fork e differential testing

I fork restano in Hardhat inizialmente perché fixture, whale, manifest e script
sono già affidabili. Devono usare:

- RPC autenticata;
- blocco obbligatorio;
- snapshot/revert;
- whale verificata al blocco;
- indirizzi esterni ufficiali;
- parent effimero per evitare transazioni reali;
- post-deploy fork sul manifest reale prima del canary;
- nessuna dipendenza dal “latest” nei gate release.

Differential tests consigliati:

- valore Lens vs valore protocollo ufficiale;
- share conversion locale vs preview protocollo;
- health plugin vs health Lens vs API ufficiale on-chain;
- quote/minOut vs actual balance delta;
- manifest atteso vs bytecode/config on-chain.

## 14. Security della parte off-chain

Gli smart contract non sono l'unico perimetro. Test e controlli devono coprire:

- manifest schema e chain ID;
- nessun segreto nei file/log/artifact;
- signer non caricato in observe/dry-run;
- execute richiede combinazione esplicita di flag;
- Safe proposal non equivale a esecuzione;
- lock impedisce due controller concorrenti;
- restart conserva stato e idempotenza;
- nonce/retry non duplicano transazioni;
- RPC mismatch o stale block causa preflight failure;
- observer registra failure e non produce fingerprint “sana” incompleta;
- VPS usa least privilege e aggiornamenti controllati.

Slither non copre questi aspetti; restano test TypeScript e hardening operativo.

## 15. Metriche corrette

Metriche utili:

- proprietà coperte per componente;
- Critical/High confirmed aperti;
- finding senza PoC;
- nuovi finding Slither per PR;
- branch/line coverage come segnale;
- selector handler raggiunti;
- reverts scartati nei fuzzer;
- tempo al replay del counterexample;
- fork deterministici PASS;
- accepted risk scaduti;
- tempo medio finding -> regression -> closure.

Metriche da non usare da sole:

- numero totale di test;
- 100% line coverage;
- numero grezzo di warning Slither;
- numero di run fuzz senza proprietà forti;
- “nessun bug trovato” dopo un timeout.

## 16. Effort e dipendenze

### Workstream A — Governance dell'audit

- 3–7 giorni per struttura, deduplica e scope;
- verifica dei Critical/High: variabile, realisticamente 1–3 settimane;
- dipende dalla disponibilità di reviewer e fork stabili.

### Workstream B — CI e static analysis

- CI: 1–3 giorni;
- Slither install/config: 1–2 giorni;
- triage iniziale: 2–5 giorni;
- gate differenziale: 1–2 giorni dopo triage.

### Workstream C — Property testing

- Foundry base: 2–4 giorni;
- harness core: 3–7 giorni;
- invariant economici: 1–2 settimane;
- bundle protocollo: 1–3 settimane aggiuntive, incrementali.

### Workstream D — Deep verification

- Echidna: 3–5 giorni dopo harness maturi;
- Halmos: 3–7 giorni per un primo set ristretto;
- audit esterno: pianificazione separata dopo remediation.

Non è corretto sommare meccanicamente tutte le stime: alcune attività possono
procedere in parallelo, ma la proprietà deve essere definita prima di più motori.

## 17. Riesame critico della strategia

Questa sezione documenta il secondo pass richiesto sulla strategia.

### 17.1 “Migrare tutto a Foundry” — respinto

Motivo: duplicazione di 150 test TS e perdita di vantaggio su manifest, Safe,
automazione e servizi. Decisione: Foundry sidecar focalizzato su proprietà.

### 17.2 “Installare tutti i tool subito” — respinto

Motivo: genera output non triagable e manutenzione sovrapposta. Decisione:
Slither -> Foundry -> Echidna -> Halmos selettivo.

### 17.3 “Bloccare qualsiasi warning Slither” — respinto

Motivo: baseline iniziale rumorosa e CI inutilizzabile. Decisione: report-only,
triage, poi gate differenziale.

### 17.4 “Ignorare tutte le donazioni nel NAV” — respinto

Motivo: la donazione è un asset reale. Nasconderla crea asset fantasma.
Decisione: proteggere mint con minimum shares/virtual accounting/minOut e
definire esplicitamente la policy donation, testandola.

### 17.5 “Aggiungere nonReentrant ovunque” — respinto

Motivo: modifier indiscriminati possono rompere composabilità. Decisione: call
graph, token/callback avversario, PoC e guard al boundary corretto.

### 17.6 “Consentire withdraw normale con NAV parziale” — respinto

Motivo: brucia share a prezzo non verificabile. Decisione: operazioni normali
fail-closed; emergency/unwind separato e balance-delta.

### 17.7 “Fork in ogni PR” — modificato

Motivo: RPC/rate limit rendono il gate instabile e costoso. Decisione: PR fork
solo su richiesta o RPC stabile; nightly/release sempre con blocco fissato.

### 17.8 “Coverage come obiettivo finale” — respinto

Motivo: eseguire una riga non prova l'invariante. Decisione: coverage è una
metrica diagnostica, non certificazione.

### 17.9 “Accepted risk permanente” — respinto

Motivo: il contesto cambia. Decisione: owner, motivazione, data di riesame e
invalidazione automatica se cambia la funzione interessata.

### 17.10 “Automazione VAC può compensare bug on-chain” — respinto

Motivo: observer/guardian reagiscono dopo il fatto e sono aggirabili tramite
entry point dirette. Decisione: invariant on-chain corretti prima di enabled.

## 18. Strategia finale dopo riesame

L'ordine definitivo è:

1. fissare commit e scope;
2. rendere coerente l'audit;
3. riparare la CI esistente;
4. integrare Slither report-only;
5. triagiare e creare baseline con scadenza;
6. abilitare gate differenziale;
7. integrare Foundry sidecar;
8. implementare proprietà core NAV/share/withdraw/access/emergency;
9. estendere a bundle e InterVault;
10. aggiungere Echidna nightly riusando proprietà;
11. aggiungere Halmos soltanto su target bounded;
12. chiudere Critical/High con PoC e regressioni;
13. eseguire fork post-fix e post-deploy;
14. audit esterno;
15. canary con capitale minimo;
16. incremento dei cap per gate progressivi.

Questa strategia minimizza migrazione e overengineering, massimizzando la
probabilità di trovare bug economici reali e di riprodurli.

## 19. Definition of Done complessiva

La suite di sicurezza è implementata, non “finita per sempre”, quando:

- scope production machine-readable;
- audit normalizzato sul commit corrente;
- nessun Critical/High confermato senza owner e piano;
- ogni Critical/High chiuso ha PoC/regression;
- CI PR deterministica e verde;
- Slither differenziale bloccante;
- Foundry fuzz/invariant con proprietà catalogate;
- counterexample replay automatico;
- Echidna nightly stabile;
- Halmos produce risultati conclusivi sui target scelti o limiti documentati;
- fork fissati coprono i bundle attivi;
- script/VAC/Safe restano coperti da TypeScript;
- documentazione consente a un reviewer indipendente di riprodurre tutto;
- audit esterno eseguito sul commit release;
- canary separato dalla dichiarazione production-ready.
