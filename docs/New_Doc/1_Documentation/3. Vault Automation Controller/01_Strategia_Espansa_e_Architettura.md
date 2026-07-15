# Vault Automation Controller — strategia espansa e architettura

## 1. Obiettivo operativo

Il controller è un servizio off-chain che converte uno stato osservato in una decisione verificabile. Non custodisce direttamente fondi, non aggira i ruoli dei contratti e non considera una transazione riuscita equivalente a un obiettivo raggiunto.

Il ciclo canonico è:

```text
acquisizione lock del vault
  → osservazione coerente
  → decisione strategica
  → validazione rischio indipendente
  → costruzione ExecutionPlan
  → simulazione dell'intera sequenza
  → approvazione o autorizzazione automatica
  → nuova osservazione e controllo staleness
  → esecuzione
  → verifica post-stato
  → journal, alert e rilascio lock
```

Ogni ciclo ha un ID, una versione di configurazione e lo snapshot di partenza. Questa informazione consente di spiegare in seguito perché una decisione sia stata presa.

## 2. Confine del POC implementabile

### Incluso

- Arbitrum o rete Hardhat forkata, ma architettura parametrica per chain ID;
- un vault identificato da manifest e `vaultId` stabile;
- un asset base;
- riserva liquida in `ProxyGeneral`;
- protocolli supply-only tra quelli attivi e configurati;
- target allocation esplicite;
- withdraw degli eccessi e deposit dei deficit;
- simulazione atomica, approvazione, execution e verifica;
- journal JSON locale con lock cross-process;
- one-shot e scheduler;
- output strutturato consumabile da backend o interfaccia web.

### Escluso intenzionalmente

- borrow, repay automatico e leverage;
- swap automatici per cambiare asset;
- bridge e coordinamento cross-chain;
- APY optimizer in produzione;
- Dolomite e GMX;
- firma multisig automatica;
- consenso tra più worker distribuiti.

Questa non è una riduzione cosmetica. È il perimetro minimo nel quale tutti gli importi sono omogenei, il piano è reversibile economicamente e il fallimento può essere diagnosticato.

## 3. Configurazione

Il deployment manifest continua a descrivere indirizzi. Un nuovo automation config descrive policy e comportamento. Mescolare i due renderebbe difficile aggiornare una soglia senza alterare la rappresentazione del deploy.

Campi principali:

- `schemaVersion`, `vaultId`, `chainId`, `manifestPath`;
- `mode`: observe, advisory, autonomous;
- `baseAssetCode` e decimals attesi;
- riserva target e minima in basis point;
- protocolli con nome, target, cap e abilitazione;
- drift minimo che giustifica il rebalance;
- importo minimo per azione;
- massimo spostabile per ciclo;
- cooldown;
- blocchi massimi tra osservazione ed execution;
- drift quantitativo massimo ammesso tra approvazione ed execution;
- health factor minimo, quando applicabile;
- flag esplicito supply-only;
- directory di stato, intervallo scheduler e conferme;
- doppio opt-in per autonomia.

La somma di riserva target e target protocolli deve essere 10.000 bps. Ogni target deve restare sotto il cap. Nomi duplicati, protocolli non presenti/attivi e mismatch di chain o asset sono errori, non warning.

## 4. Observer

L’observer legge un blocco iniziale, effettua le letture e legge un blocco finale. Se l’intervallo supera la tolleranza, lo snapshot è incoerente e il ciclo non procede.

Per ciascun protocollo configurato legge:

- `getProtocolInfo`/manifest active;
- `getBalance(protocol, baseAssetCode)`;
- `getDebt(protocol, baseAssetCode)`;
- `getHealthFactor(protocol)`;
- summary per circuit breaker e net APY, se decodificabile.

Legge inoltre il balance ERC-20 dell’asset base in custody. Il `managedAssets` del POC è:

```text
liquidità custody + somma dei balance supply configurati
```

I debiti devono essere zero in supply-only. Pool value resta telemetria separata perché può usare una scala valutativa diversa.

Lo snapshot produce un fingerprint deterministico sui campi economicamente significativi. Prima di eseguire un piano approvato il controller riosserva, ricalcola il rischio e confronta struttura, blocchi e drift quantitativo. Pause, debt, active state e circuit breaker devono coincidere esattamente; piccoli incrementi passivi da interessi sono ammessi entro `maxStateDriftBps`.

## 5. Strategy engine

La strategia non produce calldata. Produce delta desiderati:

```text
targetAmount = managedAssets × targetBps / 10.000
delta = targetAmount - currentAmount
```

Un delta negativo genera un candidato withdraw; uno positivo un candidato deposit. Un piano nasce soltanto se:

- almeno una deviazione supera `rebalanceThresholdBps`;
- è trascorso il cooldown;
- ogni azione supera `minimumActionAmount`;
- esiste capitale totale positivo.

Il massimo per ciclo può ridurre proporzionalmente le azioni. I withdraw vengono pianificati prima dei deposit. Se la liquidità ottenibile non copre tutti i deficit, i deposit vengono limitati: il planner non presume capitale inesistente.

Le divisioni intere possono lasciare dust in custody. Il verifier usa una tolleranza configurata e non pretende uguaglianza matematica irrealistica al singolo wei.

## 6. Risk engine

Il risk engine riceve snapshot e proposta e può respingerla. Non condivide la funzione di scoring della strategia.

Controlli bloccanti:

- chain, vault e asset coerenti;
- vault non paused e operazioni necessarie abilitate;
- protocollo allowlisted, configurato e attivo;
- circuit breaker non attivo;
- debt uguale a zero in supply-only;
- health sopra soglia quando finito e significativo;
- riserva prospettica almeno al minimo;
- esposizione prospettica entro cap;
- volume del ciclo entro massimo;
- nessun importo negativo, nullo o superiore al balance sorgente;
- autonomia consentita solo con entrambi i flag di opt-in;
- dati oracle obbligatori: se la policy li richiede ma l’observer non li fornisce, fail-closed.

Warning non bloccanti includono APY assente, costo gas non stimato e dust. In autonomous i warning configurati come critici diventano blocchi.

## 7. Planner

Il planner usa la stessa ABI e lo stesso `ProtocolManager` della suite operativa. Ogni call ha ID univoco. Tutti i withdraw sono ordinati; i deposit dipendono dall’ultimo withdraw, assicurando che la simulazione veda la liquidità rientrata.

Il piano è un normale `ExecutionPlan`, quindi può essere:

- salvato e mostrato in una UI;
- esportato verso Safe;
- simulato su Hardhat fork;
- eseguito dall’executor esistente.

## 8. Simulazione

Una simulazione multi-call richiede uno snapshot-capable provider. Le transazioni sono realmente applicate nel fork e poi l’intero snapshot viene revertito. Questo è essenziale perché il secondo deposit deve vedere il withdraw del primo call.

Un semplice insieme di `eth_call` indipendenti non basta. Se il provider non supporta snapshot, un piano multi-call non viene dichiarato simulato.

## 9. Stato e state machine

Stati principali:

```text
CREATED → OBSERVED → VALIDATED → PLANNED → SIMULATED
SIMULATED → AWAITING_APPROVAL → APPROVED → EXECUTING
EXECUTING → VERIFYING → COMPLETED
```

Stati terminali/di errore:

```text
NO_ACTION, REJECTED, SIMULATION_FAILED, STALE,
EXECUTION_FAILED, VERIFICATION_FAILED, CANCELLED
```

Ogni transizione viene aggiunta, non sovrascritta. Il record contiene decisione, findings, piano, simulation result, execution result e snapshot finale.

Il POC usa file JSON per non aggiungere una dipendenza database prima che il dominio sia stabile. La scrittura è `temporary file → rename`, mentre il lock usa creazione esclusiva. Un lock contiene PID e timestamp; può essere recuperato soltanto oltre una TTL esplicita.

## 10. Modalità

### OBSERVE

Osserva, calcola e registra. Non costruisce alcuna aspettativa di approvazione e non invia.

### ADVISORY

Costruisce e simula. Salva il piano in `AWAITING_APPROVAL`. Un comando distinto lo approva. Un ulteriore comando esegue solo se il piano è ancora fresco e lo stato non è cambiato.

### AUTONOMOUS

Richiede `mode=autonomous`, `autonomous.enabled=true` e una seconda acknowledgement testuale. Simula sempre prima di inviare. È pensata per una fase successiva con chiave a privilegi ridotti e capitale limitato.

## 11. Crash recovery e idempotenza

- Il lock impedisce due cicli simultanei sul medesimo vault.
- Il run ID deriva da vault, tempo e fingerprint, ma viene anche conservato nel journal.
- Un record già terminale non viene rieseguito.
- Un piano approvato conserva fingerprint e blocco di origine.
- Prima dell’invio viene acquisito nuovamente il lock e riosservato lo stato.
- Un crash in `EXECUTING` non autorizza un retry cieco: occorre riconciliare receipt e nonce.
- Il POC marca tale record per intervento; la riconciliazione automatica delle transazioni pending è fase production-hardening.

## 12. Verifier

Il verifier non si limita alla receipt. Riosserva e controlla:

- assenza di nuovi debiti;
- reserve minima;
- cap per protocollo;
- movimento nella direzione pianificata;
- deviazione finale entro tolleranza, tenendo conto del max-per-cycle;
- vault e protocolli non entrati in stato di emergenza.

Un’esecuzione confermata con verifica fallita è `VERIFICATION_FAILED`, non `COMPLETED`.

## 13. Alert e osservabilità

Il POC emette eventi JSON e li conserva nel record. Eventi minimi:

- ciclo iniziato/completato;
- risk rejection;
- simulation failure;
- awaiting approval;
- stale plan;
- execution/verification failure;
- lock conteso o stale recuperato.

I canali remoti saranno adapter successivi. Il formato evento deve essere stabile per non legare il controller a Telegram o PagerDuty.

## 14. Scheduler

La logica principale resta one-shot. Il loop chiama lo stesso metodo a intervalli configurati, cattura l’errore del singolo ciclo e continua. In produzione lo scheduler dovrebbe essere gestito da systemd, container orchestrator o job platform, non da una finestra terminale dimenticata aperta.

## 15. Testing

### Unitari

- validazione config e somme bps;
- matematica target/delta e dust;
- threshold, minimum amount, cap e max-per-cycle;
- risk rejection e autonomia fail-closed;
- transizioni e lock dello store;
- fingerprint deterministico;
- planner ordering/dependencies;
- verifier.

### Integrazione locale

Con `MockOperationalProtocol` e fixture reali:

- observer legge custody e posizioni;
- strategia produce withdraw/deposit;
- piano multi-call simula con stato condiviso e revert finale;
- execution modifica lo stato;
- verifier osserva il risultato;
- secondo worker non acquisisce lo stesso lock.

### Fork

Il fork smoke deve usare RPC stabile e blocco fissato. In assenza di deploy manifest verificato, si limita a letture/config validation. La certificazione reale richiede manifest del deploy POC e signer/impersonation coerenti.

## 16. Sequenza di rollout

1. Test locali e fork deterministico.
2. `OBSERVE` su Arbitrum con manifest reale.
3. Shadow log per almeno una settimana e revisione delle decisioni.
4. `ADVISORY`, export e approvazione Safe.
5. Deploy POC con capitale limitato, nessun borrow.
6. Incident drill: pause, protocol disable, RPC failure e restart.
7. Autonomia limitata soltanto dopo criteri misurabili.
8. Secondo vault sulla stessa chain.
9. Seconda chain certificata separatamente.
10. Cross-chain soltanto come progetto distinto.

## 17. Criterio di “finito”

L’implementazione software è finita quando config, observer, strategy, risk, planner, simulation, approval, execution, verification, state e CLI sono testati. Il prodotto non è “perfetto” o production-ready finché non ha completato shadow period, audit di sicurezza, runbook incidenti, RPC ridondate, monitoring remoto e prove con capitale limitato.
