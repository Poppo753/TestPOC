# Strategia espansa e revisionata

## 1. Obiettivo operativo

L'operatore deve poter scegliere un file per vault, eseguire un controllo e avviare il servizio. Da quel momento il processo deve osservare e proporre o eseguire soltanto ciò che il profilo autorizza.

L'esperienza desiderata è:

```text
control file
    ├── punta al manifest verificato
    ├── dichiara policy e protocolli
    ├── dichiara modello di approvazione/esecuzione
    └── dichiara comportamento del servizio
             │
             ▼
          preflight
             │
     ┌───────┴────────┐
     │                │
  fail closed       ready
                      │
                      ▼
               loop supervisionato
```

Il file descrive intenzione e limiti. Non contiene credenziali e non modifica governance.

## 2. Confini di responsabilità

### Control file

Responsabile di:

- policy economica;
- protocolli abilitati;
- modalità operativa;
- identità attesa del firmatario o Safe;
- parametri del servizio;
- riferimenti a manifest e directory di stato.

Non responsabile di:

- generare indirizzi di deploy;
- custodire segreti;
- concedere ruoli on-chain;
- aggiornare contratti.

### Manifest

Responsabile di:

- indirizzi effettivamente deployati;
- chain e asset del deploy;
- plugin, lens e registry;
- transaction hash e checkpoint;
- metadati di deployment.

Il manifest nasce dagli script di deploy, non da copia/incolla non verificato. Il preflight controlla anche il bytecode perché un indirizzo sintatticamente valido non prova l'esistenza di un contratto.

### Secret backend

Responsabile di:

- RPC URL e API key;
- chiave di un eventuale owner Safe usata per proporre/firmare;
- chiave del signer diretto solo in ambienti autorizzati;
- credenziali di monitoring.

Il repository contiene soltanto i nomi delle variabili attese.

### Safe

Responsabile di:

- ownership amministrativa;
- quorum;
- raccolta firme;
- esecuzione del batch approvato.

Il Transaction Service è un coordinatore off-chain: la fonte finale resta la receipt on-chain e lo stato post-esecuzione.

### Runner 24/7

Responsabile di:

- avvio dopo preflight;
- un ciclo alla volta;
- heartbeat;
- arresto ordinato;
- exit code significativo;
- log JSON.

Il supervisor esterno è responsabile di restart, retention log e disponibilità host.

## 3. Evoluzione del control file

La compatibilità con schema v1 va preservata. I nuovi blocchi sono opzionali e ricevono default conservativi.

### `execution`

```json
{
  "execution": {
    "kind": "disabled",
    "expectedSignerAddress": "0x..."
  }
}
```

Valori:

- `disabled`: nessun percorso persistente;
- `direct`: esecuzione tramite signer fornito dall'ambiente;
- `safe`: batch eseguito dalla Safe.

Regole:

- `observe` richiede `disabled` oppure accetta configurazione non usata;
- `autonomous` non può usare `safe` nella prima versione, perché manca un modulo autonomo;
- `direct` persistente richiede indirizzo atteso e corrispondenza esatta col signer;
- `safe` richiede Safe address e Transaction Service.

### `safe`

```json
{
  "safe": {
    "address": "0x...",
    "txServiceUrl": "https://...",
    "apiKeyEnv": "SAFE_API_KEY"
  }
}
```

`apiKeyEnv` è il nome della variabile, mai il valore. Un endpoint self-hosted può non richiedere API key.

### `runtime`

Campi aggiuntivi:

- `heartbeatPath`;
- `maxConsecutiveFailures`;
- `preflightEveryCycles` opzionale soltanto se utile;
- `shutdownGraceSeconds` solo se esistono risorse da drenare.

Per il POC bastano heartbeat e soglia fallimenti. Non serve un orchestratore interno complesso.

## 4. Preflight

### Controlli statici

- schema;
- somme bps;
- percorsi risolti;
- directory scrivibile;
- nessun segreto inline;
- coerenza mode/execution/Safe;
- protocolli supportati.

### Controlli provider

- chain ID;
- block number raggiungibile;
- bytecode di core, asset, plugin, lens e registry;
- network coerente col manifest.

### Controlli applicativi

- asset code e decimals config/manifest;
- ogni protocollo enabled presente nel manifest;
- kind supportato dal controller;
- protocollo attivo nel manifest;
- `ProtocolManager` raggiungibile;
- owner del `ProtocolManager` coerente col modello:
  - direct: signer atteso;
  - safe: Safe address.

### Output

Il report deve contenere check con `PASS`, `WARNING` o `FAIL`, senza segreti. Il comando termina non-zero in presenza di `FAIL`.

## 5. Signer sicuro

### Direct

Il control file contiene soltanto `expectedSignerAddress`. Hardhat riceve la chiave dall'ambiente. Prima di inviare:

1. ricava l'indirizzo dal signer;
2. confronta con quello atteso;
3. controlla chain;
4. controlla owner/autorità;
5. controlla saldo gas;
6. mantiene il doppio gate CLI.

Per una produzione più matura `createRuntime` dovrà ricevere un signer remoto/KMS implementante l'interfaccia ethers `Signer`; non è necessario modificare la logica di dominio.

### Safe

Il server può possedere, eventualmente, la chiave di un singolo owner per proporre la transazione. Quella chiave non basta a superare il quorum. È comunque un segreto e va protetta.

La strada più prudente per il primo POC è:

- controller prepara il batch;
- un owner propone/firma tramite ambiente protetto;
- altri owner approvano in Safe;
- l'esecuzione avviene tramite Safe UI o executor ufficiale;
- il controller riconcilia.

## 6. Integrazione Safe

### Preparazione

Dal piano si generano `MetaTransactionData` in ordine. Ogni voce usa:

- `to = PlannedCall.target`;
- `value = PlannedCall.value`;
- `data = PlannedCall.data`;
- `operation = CALL`.

Il Protocol Kit ufficiale costruisce un unico batch usando `MultiSendCallOnly` quando ci sono più chiamate. Il Transaction Service ne esegue la stima prima della proposta; questo percorso non richiede che il quorum sia già raccolto, a differenza di una validazione della transazione già firmata.

### Proposta

Il Protocol Kit:

- legge la Safe;
- costruisce il batch;
- richiede al Transaction Service la stima del batch e usa il `safeTxGas` restituito;
- assegna il nonce;
- calcola `safeTxHash`;
- produce la firma del proposer.

L'API Kit invia la proposta al Transaction Service.

Il run salva:

- Safe address;
- nonce;
- Safe transaction data normalizzata;
- `safeTxHash`;
- proposer;
- timestamp.

### Riconciliazione

Il controller legge la transazione tramite `safeTxHash` e verifica:

- stessa Safe;
- stesso hash;
- stessi dati serializzati salvati;
- esecuzione avvenuta;
- esito positivo;
- transaction hash on-chain;
- receipt con conferme sufficienti.

Poi osserva il vault ed esegue lo stesso verifier già usato dal direct executor.

### Staleness

Una proposta Safe può restare pendente. Il controller deve segnalarla stale se supera l'età prevista, ma non può impedire agli owner di eseguirla. Per impedimento on-chain servirebbe un executor con vincoli o un Safe Guard/Module: non viene introdotto nel POC perché aumenterebbe molto superficie d'attacco e audit.

La mitigazione POC è:

- `maxPlanAgeBlocks` conservativo;
- cancellazione/rejection Safe delle proposte vecchie;
- owner istruiti a non eseguire dopo alert stale;
- verifica post-stato e circuit breaker in caso di deviazione.

## 7. Servizio 24/7

### Bootstrap

1. carica control file;
2. valida staticamente;
3. carica manifest;
4. costruisce runtime;
5. esegue preflight;
6. scrive heartbeat `ready`;
7. entra nel loop.

### Ogni ciclo

1. heartbeat `running`;
2. esegue un ciclo;
3. registra run ID e stato;
4. azzera o incrementa fallimenti consecutivi;
5. heartbeat `waiting`;
6. attende in modo interrompibile.

Gli stati economici `NO_ACTION` e `REJECTED` non sono crash. `FAILED`, errori RPC e impossibilità di osservare sono failure operative.

### Shutdown

SIGINT/SIGTERM interrompono l'attesa. Una transazione già inviata non va abbandonata: il processo completa attesa receipt/verifica prima di uscire, salvo terminazione forzata esterna.

### Heartbeat

Scrittura atomica con:

- vault ID;
- PID;
- stato servizio;
- startedAt/updatedAt;
- ultimo ciclo/run;
- fallimenti consecutivi;
- ultima anomalia sanificata.

Non contiene config completa, RPC o segreti.

### Supervisione

Per il POC basta una delle seguenti:

- systemd su Linux;
- Docker Compose con restart policy;
- Windows service wrapper se l'host resta Windows.

Non servono contemporaneamente Kubernetes, queue e database distribuito.

## 8. Manifest reale del deploy

Il codice di deployment esistente deve restare l'unica fonte di creazione del manifest. Il nuovo lavoro aggiunge verifica, non un secondo deployer.

Flusso:

1. scegliere network e asset;
2. eseguire `deploy-core` con checkpoint;
3. configurare core e oracle;
4. eseguire `deploy-bundle` per Aave, Euler e Morpho Vault;
5. configurare registry;
6. verificare health e posizioni;
7. trasferire ownership alla Safe;
8. rieseguire preflight in modalità Safe;
9. congelare/copiare il manifest come artefatto del POC.

Il repository non può completare i punti che richiedono indirizzi esterni scelti, gas e firme reali. Può però rendere ogni passaggio ripetibile e verificabile.

## 9. Test

### Unitari

- default conservativi;
- combinazioni mode/execution;
- nessun segreto inline;
- expected signer mismatch;
- report preflight;
- batch Safe preserva ordine e calldata;
- binding Safe serializzabile;
- heartbeat atomico;
- classificazione failure del runner.

### Integrazione locale

- manifest con mock reali;
- owner direct coerente/incoerente;
- Safe mock come owner, ove economicamente utile;
- ciclo servizio avviato e interrotto;
- autonomous loop inoltra esplicitamente il persistent gate;
- riconciliazione esterna testata con client Safe finto, senza rete.

### Fork

- preflight contro manifest POC;
- simulazione con Safe impersonata;
- batch uguale al piano simulato;
- nessuna esecuzione Dolomite/GMX.

### Reale

- proposta Safe;
- quorum;
- esecuzione;
- receipt;
- verifica post-stato;
- osservazione 24/7.

Questi ultimi sono acceptance test operativi e rimangono aperti senza ambiente.

## 10. Rilettura critica e correzioni apportate

La prima idea “un file e fa tutto” è stata corretta nei punti seguenti.

### Correzione 1: manifest separato

Unire manifest e policy renderebbe facile alterare accidentalmente indirizzi durante una modifica economica. Il riferimento resta nel control file, l'artefatto resta separato.

### Correzione 2: Safe esegue, non approva soltanto

Registrare `approvedBy=safe-id` non prova una firma. La strategia ora richiede hash, Transaction Service, receipt e post-verifica.

### Correzione 3: niente auto-deploy nel demone

Il processo che muove capitale non deve poter aggiornare i propri contratti o ruoli. Deployment e governance restano suite separate.

### Correzione 4: niente Safe module nel POC

Un module potrebbe rendere autonoma una Safe, ma introduce policy on-chain, ruoli e superficie d'attacco. Prima si valida advisory multisig; il module diventa un progetto successivo con audit dedicato.

### Correzione 5: 24/7 non significa alta disponibilità

Un processo supervisionato può funzionare continuativamente, ma non è HA. Il POC dichiara single host e usa lock JSON. Database/lease distribuite arrivano solo con più worker.

### Correzione 6: il runner deve ricevere il gate persistente

Il loop attuale non inoltra i flag di esecuzione a `runCycle`; quindi un autonomous loop rimane approvato ma non esegue. Il fix deve essere esplicito e testato, senza eliminare il doppio opt-in.

### Correzione 7: staleness Safe non è enforceable off-chain

Il controller può segnalare ma non annullare magicamente una transazione già firmabile. La documentazione distingue mitigazione POC da enforcement on-chain futuro.

## 11. Ordine finale

1. estendere schema in modo backward-compatible;
2. aggiungere preflight;
3. aggiungere signer identity checks;
4. correggere scheduler e introdurre heartbeat;
5. implementare adapter Safe dietro interfaccia testabile;
6. integrare CLI;
7. testare localmente;
8. aggiornare documentazione;
9. deploy POC;
10. fork sul POC;
11. Safe reale;
12. shadow 24/7;
13. audit e capitale progressivo.

Questo ordine massimizza evidenza utile senza costruire infrastruttura prematura.
