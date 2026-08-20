# Simulazione fork, deploy e server

## Tre ambienti diversi

### Ambiente locale

Usa contratti deployati dalla fixture e `MockOperationalProtocol`. Serve a verificare logica e sequenze senza dipendenze esterne.

### Hardhat fork

Replica lo stato Arbitrum a un blocco. Supporta snapshot, impersonazione e rollback. Serve a simulare chiamate reali verso protocolli e contratti deployati.

### Arbitrum live

È lo stato autorevole. Non offre normalmente `evm_snapshot` e richiede un signer reale. Serve per observe e, solo dopo i gate, execution.

Non devono essere confusi: una simulazione riuscita sul fork non è una receipt mainnet; una `eth_call` mainnet non è una simulazione sequenziale persistente.

## Perché più `eth_call` non bastano

Una call isolata non conserva lo stato per la successiva. Nel rebalance:

```text
withdraw A → custody aumenta → deposit B usa quella custody
```

Il secondo passaggio deve vedere il primo. Per questo il framework invia realmente le transazioni sul fork, attende le receipt e poi reverte l’intero snapshot.

## Impersonazione

I metodi `ProtocolManager.deposit/withdraw` sono protetti. I normali account Hardhat non coincidono con owner/Safe del deploy. In config si può specificare:

```json
"simulationImpersonateAddress": "0xOwnerOrSafe"
```

Quando tutte le condizioni sono vere:

- network Hardhat;
- `FORK_ENABLED=true`;
- comando che richiede signer;
- modalità non observe;

la CLI impersona l’indirizzo e gli assegna ETH nel fork. Su `arbitrum` questo percorso non viene eseguito.

## Fork fisso e fork recente

### Fork fisso

Serve a test riproducibili. Esempio verificato:

```powershell
$env:FORK_ENABLED = "true"
$env:FORK_BLOCK_NUMBER = "483105327"
npx hardhat test test/scripts/ForkSmoke.test.ts
```

### Fork recente

Serve a costruire un piano che si intende approvare ed eseguire subito dopo. Se si usa un blocco storico, il controllo block age lo renderà correttamente stale rispetto alla mainnet corrente.

## Workflow advisory corretto

### Fase A — pianificazione e simulazione

```powershell
$env:HARDHAT_NETWORK = "hardhat"
$env:FORK_ENABLED = "true"
Remove-Item Env:FORK_BLOCK_NUMBER -ErrorAction SilentlyContinue
npm run automation:cli -- run --config="scripts/automation/config.poc.json"
```

Output atteso: `AWAITING_APPROVAL` se esiste un rebalance.

### Fase B — ispezione/export

```powershell
npm run automation:cli -- show --config="scripts/automation/config.poc.json" --run-id="RUN_ID"
npm run automation:cli -- export --config="scripts/automation/config.poc.json" --run-id="RUN_ID" --output="plan.json"
```

### Fase C — approvazione journal

```powershell
npm run automation:cli -- approve --config="scripts/automation/config.poc.json" --run-id="RUN_ID" --approved-by="SAFE_TX_ID"
```

Questo passaggio non raccoglie ancora firme Safe.

### Fase D — execution live

```powershell
$env:HARDHAT_NETWORK = "arbitrum"
npm run automation:cli -- execute --config="scripts/automation/config.poc.json" --run-id="RUN_ID" --execute=true --dry-run=false
```

Prima dell’invio, stato, age, config e rischio vengono rivalutati. Se l’approvazione ha richiesto troppo tempo, il risultato corretto è `STALE`.

## Deploy POC richiesto

Il deploy deve essere separato dal sistema storico e produrre:

- indirizzi core;
- `ProtocolManager` e protocolli registrati;
- custody corretta;
- token/registry configurati;
- ruoli e owner verificati;
- emergency path;
- manifest schema v1;
- automation config dedicata;
- Safe/operator identity;
- capitale iniziale nullo o limitato.

Finché non esiste questo deploy, non è possibile certificare il fork completo del controller contro un ambiente POC reale.

## Server 24/7 — shadow mode

La prima installazione deve usare `mode=observe` e nessun signer. Componenti minimi:

```text
process manager/container
controller one-shot/loop
volume persistente per stateDirectory
RPC primaria e controllo RPC secondaria
log collector
health check
backup
alert umano
```

Requisiti operativi:

- restart automatico;
- utente OS non privilegiato;
- filesystem con permessi minimi;
- NTP;
- spazio disco monitorato;
- log rotation;
- backup del journal;
- manifest/config versionati;
- nessuna private key in shadow mode.

## Limite del file store

Il JSON store è adatto a un host e un worker. Non usare due container su host differenti con una cartella di rete condivisa. Per HA servono database transazionale, lease rinnovabile e coordinamento distribuito.

## Chainlink CRE

CRE può in futuro ospitare trigger, letture e workflow verificabili, ma il controller corrente usa journal e lock persistenti. Un porting richiede ridisegnare la memoria perché le callback CRE sono stateless. La scelta POC resta server stateful; CRE può essere valutato come trigger/watchdog o seconda implementazione.
