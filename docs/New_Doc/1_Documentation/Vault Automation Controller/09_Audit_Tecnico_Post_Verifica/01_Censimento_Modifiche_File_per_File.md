# Censimento modifiche file-per-file

## `scripts/automation/types.ts`

Definisce il contratto dati del controller. Contiene:

- `AutomationMode`: `observe`, `advisory`, `autonomous`;
- policy protocollo con `targetBps`, `maxBps` ed enable flag;
- configurazione completa del controller;
- osservazione normalizzata di vault e protocolli;
- azioni ad alto livello `deposit`/`withdraw`;
- decisione strategica;
- findings di rischio warning/bloccanti;
- report prospettico;
- state machine dei run;
- eventi, verifica e record persistente.

Durante l’ultima revisione è stato aggiunto `maxStateDriftBps`: separa un piccolo incremento passivo dovuto al rendimento da una modifica materiale dello stato. È stato aggiunto anche `simulationImpersonateAddress`, usato esclusivamente su Hardhat fork.

## `scripts/automation/config.ts`

È il boundary di validazione. Non lascia che strategy/risk/executor ricevano valori ambigui. Verifica:

- schema version esatto;
- formato sicuro di `vaultId`;
- chain ID positivo;
- manifest path presente;
- modalità ammessa;
- codice asset e decimals;
- almeno un protocollo;
- nomi protocollo univoci;
- interi e intervalli bps;
- target non superiore al cap;
- protocollo disabilitato con target obbligatoriamente zero;
- somma target protocolli + reserve target uguale a 10.000;
- reserve minima non superiore al target;
- importi bigint espressi come stringhe decimali;
- supply-only obbligatorio;
- doppio opt-in autonomy;
- runtime, retry, lock TTL e confirmations;
- indirizzo di impersonazione valido, quando presente.

`loadAutomationConfig` risolve manifest e state directory rispetto alla posizione del file config. `hashValue` e `stableJson` producono un hash deterministico della configurazione; l’hash viene conservato nel run e ricontrollato prima dell’esecuzione.

## `scripts/automation/config.example.json`

È un template, non una configurazione mainnet pronta. Mostra:

- WETH come base asset;
- AaveV3, EulerV2 e MorphoVault;
- reserve target e minima;
- threshold, minimum amount e max movement;
- cooldown;
- max plan age;
- drift tollerato;
- health minimo;
- oracle freshness disattivata perché il POC non possiede ancora telemetria normalizzata;
- state directory, retry e confirmations.

`maxPlanAgeBlocks` è un limite di esempio da calibrare sulla chain e sul workflow di approvazione. `simulationImpersonateAddress` non è valorizzato perché deve coincidere con l’autorità del deploy reale.

## `scripts/automation/observer.ts`

Costruisce uno snapshot economico coerente:

1. verifica chain e base asset contro il manifest;
2. registra blocco iniziale;
3. legge system status;
4. legge il balance ERC-20 in `ProxyGeneral`;
5. confronta tutti i protocolli registrati con quelli configurati;
6. rifiuta un protocollo attivo non contabilizzato;
7. consente soltanto kind `aave`, `euler`, `morpho-vault`;
8. legge balance, debt e health per protocollo;
9. legge active state da `ProtocolManager`;
10. legge `circuitBreakerTripped()` direttamente dal plugin;
11. legge APY dal lens come telemetria opzionale;
12. somma esclusivamente quantità dello stesso asset base;
13. calcola allocation e reserve bps;
14. verifica l’estensione massima dello snapshot in blocchi;
15. genera fingerprint deterministico.

La lettura diretta del circuit breaker dal plugin corregge il rischio che un lens configurato verso una vecchia implementazione riporti uno stato non aggiornato.

## `scripts/automation/strategy.ts`

Implementa la strategia deterministica a pesi target:

```text
target = managedAssets × targetBps / 10.000
delta  = target - balance corrente
```

Gestisce zero assets, cooldown, threshold, minimum amount e movimento massimo per ciclo. Produce prima withdraw e poi deposit. I deposit sono limitati da custody corrente + withdraw pianificati.

Correzione post-audit: se il cap di movimento riduce un’azione sotto `minimumActionAmount`, l’azione non viene più emessa. Prima avrebbe potuto creare una call economicamente insignificante pur partendo da un delta valido.

## `scripts/automation/risk.ts`

È indipendente dalla strategia. La strategia propone; il risk engine può vietare. Produce codici strutturati:

- `CONTEXT_MISMATCH`;
- `VAULT_PAUSED`;
- `DEPOSITS_DISABLED`;
- `WITHDRAWS_DISABLED`;
- `ORACLE_DATA_UNAVAILABLE`;
- `AUTONOMY_NOT_ACKNOWLEDGED`;
- `PROTOCOL_NOT_ALLOWED`;
- `PROTOCOL_INACTIVE`;
- `CIRCUIT_STATUS_UNKNOWN`;
- `CIRCUIT_BREAKER`;
- `DEBT_FORBIDDEN`;
- `HEALTH_BELOW_MINIMUM`;
- `INVALID_AMOUNT`;
- `UNKNOWN_PROTOCOL`;
- `DEPOSIT_NOT_ALLOWED`;
- `INSUFFICIENT_PROTOCOL_BALANCE`;
- `INSUFFICIENT_CUSTODY`;
- `MOVEMENT_LIMIT`;
- `RESERVE_BELOW_MINIMUM`;
- `PROTOCOL_CAP_EXCEEDED`.

Calcola anche il portafoglio prospettico dopo le azioni. Nell’ultima revisione il risk engine viene rieseguito sullo stato fresco immediatamente prima dell’invio.

## `scripts/automation/planner.ts`

Converte la decisione in `ExecutionPlan` serializzabile usando ABI e indirizzo reali di `ProtocolManager`. Proprietà:

- ID univoco e ordinato;
- solo `deposit(string,string,uint256)` e `withdraw(string,string,uint256)`;
- ogni deposit dipende da tutti i withdraw;
- expected state leggibile;
- warning esplicito supply-only.

Il piano non contiene signer, oggetti Hardhat o bigint non serializzabili. Può essere esportato verso backend, wallet o futura integrazione Safe.

## `scripts/automation/store.ts`

Implementa journal JSON single-host:

- directory `runs` e `locks`;
- scrittura temporanea + rename atomico;
- create/get/save/list/latestCompleted;
- validazione delle transizioni;
- lock con creazione esclusiva `wx`;
- stale recovery dopo TTL;
- token univoco del lock.

Il token risolve un race sottile: un worker lento non può eliminare, al proprio termine, il lock nuovo creato dopo il recupero TTL. Il controller ora garantisce il rilascio anche se la lettura del run fallisce dopo l’acquisizione.

## `scripts/automation/controller.ts`

Orchestra il ciclo completo. Le funzioni principali sono:

- `runCycle`;
- `approve`;
- `cancel`;
- `executeApproved`;
- `runScheduler`;
- `observationsMateriallyDiffer`.

Correzioni post-audit:

- drift quantitativo tollerato entro policy invece di uguaglianza al wei;
- cambi strutturali sempre stale;
- controllo hash configurazione;
- controllo vault e chain del run;
- nuovo risk pass sullo stato fresco;
- block age negativo trattato come stale;
- lock rilasciato anche se run creation/read fallisce;
- approve e cancel serializzati dal lock.

## `scripts/automation/verifier.ts`

Non considera la receipt sufficiente. Controlla:

- vault non paused;
- nessun debt;
- reserve minima;
- managed asset loss entro tolleranza;
- protocollo ancora attivo;
- circuit breaker esplicitamente false;
- cap;
- movimento nella direzione prevista;
- balance protocollo vicino all’atteso;
- custody finale vicina all’attesa.

## `scripts/automation/alerts.ts`

Definisce un adapter minimale per eventi strutturati. `JsonConsoleEventSink` emette JSON su stderr; `MemoryEventSink` viene usato nei test. Telegram, email o PagerDuty devono implementare la stessa interfaccia senza contaminare la logica dominio.

## `scripts/automation/cli.ts`

Espone `run`, `loop`, `list`, `show`, `approve`, `cancel`, `execute`, `export`. Le operazioni offline non aprono signer. `execute` richiede contemporaneamente:

```text
--execute=true --dry-run=false
```

Sul fork Hardhat, per advisory/autonomous, la CLI richiede `simulationImpersonateAddress`, impersona l’autorità e assegna ETH soltanto nel fork. L’esecuzione mainnet continua a richiedere una chiave reale configurata nell’ambiente.

## `scripts/framework/runtime.ts`

È stato esteso per accettare un `Signer` esplicito. Questo consente alla CLI automation di passare il signer impersonato sul fork senza cambiare il comportamento degli script esistenti. L’indirizzo dichiarato continua a essere confrontato con il signer effettivo.

## `scripts/framework/abis.ts`

La definizione TypeScript di `getAllProtocolSummaries()` è stata corretta per coincidere con `ILensAdapter.ProtocolSummary` Solidity a otto campi. La vecchia ABI descriveva una struct differente e poteva fallire appena esistevano protocolli registrati.

## `contracts/mocks/MockOperationalProtocol.sol`

Mock esclusivamente test-only. Simula accounting/custody e implementa:

- deposit/withdraw/borrow/repay/close;
- balance/debt/health/value;
- circuit breaker view;
- net APY;
- summary lens con la struct Solidity reale.

Non deve mai essere registrato in produzione.

## `test/automation/VaultAutomationController.test.ts`

Contiene nove casi ampi che coprono config, strategy, risk, fingerprint, drift, planner, verifier, store, lock, observer, simulazione, approvazione, execution, staleness e recovery del lock.

## `package.json`

Comandi aggiunti:

```text
npm run automation:cli
npm run automation:test
```

`scripts:typecheck` include `scripts/automation` tramite `tsconfig.scripts.json`.
