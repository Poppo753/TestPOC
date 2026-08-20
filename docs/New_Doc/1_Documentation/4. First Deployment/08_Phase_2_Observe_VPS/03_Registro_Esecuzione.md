# Fase 2 — registro esecuzione VPS

Data avvio preparazione: 15 luglio 2026.

## Evidenza locale

- preflight Arbitrum: PASS;
- loop Windows observe avviato, intervallo 300 secondi;
- persistent execution: false;
- cicli iniziali: `NO_ACTION` perché il vault è vuoto;
- consecutive failure osservate: 0.

È uno smoke test, non ancora il periodo shadow ufficiale.

## VPS

- provider: Hetzner Cloud;
- host: `vault-observer-arbitrum-01`;
- piano: CX23 x86, 2 vCPU, 4 GB RAM, 40 GB SSD, Ubuntu 24.04;
- IPv4: `46.225.133.37`;
- host key Ed25519 registrata: `SHA256:Rv4aL01OZGbyQ2heFUUh/qT2gS4lquogNfDHGyKs8bA`;
- verifica indipendente della host key contro un secondo canale Hetzner: **completata il 16 luglio 2026** tramite console web Hetzner; fingerprint confermata `SHA256:Rv4aL01OZGbyQ2heFUUh/qT2gS4lquogNfDHGyKs8bA`;
- provisioning, firewall SSH-only e accesso con chiave dedicata: completati;
- Ubuntu aggiornato e riavviato; nessun reboot pendente;
- Node: `v22.23.1`, archivio ufficiale verificato tramite `SHASUMS256.txt`;
- npm: `10.9.8`;
- utente servizio: `vaultops`, privo di privilegi amministrativi;
- repository: branch `dev-26`, commit operativo `9ba9dc872879a907427bd12408c9958f71b26375`;
- secret file: una sola riga `ARBITRUM_RPC_URL`, owner `root:vaultops`, mode `0640`;
- `PRIVATE_KEY`, mnemonic e signer nel secret file: assenti;
- compile: 90 file Solidity PASS;
- typecheck script: PASS;
- suite script: 39/39 PASS;
- suite automation: 14/14 PASS;
- preflight Arbitrum: ready, tutti i check PASS al blocco `483923152`;
- control file: `mode=observe`, `autonomous.enabled=false`, `execution.kind=disabled`, intervallo 300 secondi;
- servizio: enabled e active, hardening systemd exposure `3.8 OK`;
- primo ciclo riuscito: `2026-07-14T23:30:21Z`, esito `NO_ACTION`;
- secondo ciclo riuscito: `2026-07-14T23:35:22Z`, esito `NO_ACTION`;
- loop Windows fermato dopo il secondo ciclo VPS;
- terzo ciclo riuscito senza fallback Windows: `2026-07-14T23:40:24Z`, esito `NO_ACTION`;
- heartbeat dopo il terzo ciclo: `waiting`, `consecutiveFailures=0`;
- processo systemd: stesso PID, `NRestarts=0` dopo il fix;
- inizio finestra shadow ufficiale: `2026-07-14T23:40:26Z`, cioè 15 luglio 2026 ore 01:40:26 CEST;
- prima scadenza certificabile di 24 ore: 16 luglio 2026 ore 01:40:26 CEST;
- stato Fase 2: **PASS — chiusa il 16 luglio 2026 alle 15:14 UTC**; tutti i 12 criteri soddisfatti (vedi sezione raccolta live).

## Raccolta live — 16 luglio 2026 ore 15:02–15:14 UTC

Raccolta eseguita via SSH read-only dopo verifica fingerprint. Nessun segreto stampato.

### Sistema e servizio

- `hostnamectl`: `vault-observer-arbitrum-01`, Ubuntu 24.04.4 LTS, kernel 6.8.0-134-generic;
- data raccolta: `2026-07-16T15:02:53+00:00`;
- uptime al momento della raccolta: 9 minuti (reboot automatico kernel alle 14:53 UTC, vedi sezione eventi);
- servizio: **enabled**, **active**;
- `MainPID=898`, `NRestarts=0`, `ExecMainStatus=0`;
- `ActiveEnterTimestamp`: Thu 2026-07-16 14:53:25 UTC (primo avvio post-reboot).

### Heartbeat

```json
{
  "schemaVersion": 1,
  "vaultId": "arbitrum-usdc-poc-1",
  "pid": 898,
  "state": "waiting",
  "startedAt": "2026-07-16T14:53:42.203Z",
  "updatedAt": "2026-07-16T15:13:50.830Z",
  "lastRunId": "arbitrum-usdc-poc-1-1784214829273-42738966",
  "lastRunState": "NO_ACTION",
  "consecutiveFailures": 0
}
```

Età heartbeat al momento della lettura: circa 14 secondi. Ampiamente entro i 600 secondi.

### Commit e working tree

- commit: `9ba9dc872879a907427bd12408c9958f71b26375` — **corrisponde al commit atteso**;
- `git status --short`: nessun output — working tree pulito.

### Secret file

- `stat`: `root:vaultops 640 /etc/vault-automation/arbitrum-usdc-poc-1.env` — **corretto**;
- `grep PRIVATE_KEY|mnemonic|MNEMONIC`: output `0 0` — **assente**.

### Run persistiti

- totale file `.json` nella cartella `runs/`: **476**;
- primo run: ID `1784071821072` → `2026-07-14T23:17:01Z` (cicli di test pre-shadow);
- ultimo run al momento della raccolta: `1784214829273` → `2026-07-16T15:13:49Z`;
- run con stato `FAILED`, `SIMULATION_FAILED`, `VERIFICATION_FAILED`: **0**.

### Preflight aggiornato

- `checkedAt`: `2026-07-16T15:14:11.168Z`;
- `ready: true`;
- blocco Arbitrum: `484496131`;
- tutti i check PASS: `PROVIDER_REACHABLE`, `CHAIN_MATCH`, `BASE_ASSET_MATCH`, `BASE_ASSET_CODE`,
  4 contratti core, 4 protocolli con plugin/lens/registry, `PROTOCOL_MANAGER_OWNER_READ`,
  4 check on-chain, `EXECUTION_DISABLED`, `STATE_DIRECTORY_WRITABLE`, `HEARTBEAT_DIRECTORY_WRITABLE`;
- totale check: **34/34 PASS**.

### Journal sintetico (periodo shadow)

Cicli ogni 5 minuti da `2026-07-14T23:30Z` a `2026-07-16T15:14Z`, esito uniforme `NO_ACTION`.
Nessun ciclo con errore RPC, fallback o failure. Journal completo disponibile su VPS con il
comando `journalctl` indicato nell'handoff.

## Evento: reboot automatico kernel — 16 luglio 2026

- orario: `2026-07-16T14:53:00Z`;
- causa: unattended-upgrades Ubuntu, upgrade kernel `6.8.0-117` → `6.8.0-134`;
- sequenza: systemd ha fermato il servizio in modo pulito (`success: true, stopped: true`)
  prima del reboot; il servizio ha completato il ciclo in corso prima dello stop;
- post-reboot: servizio riavviato automaticamente alle `14:53:25Z`, `NRestarts=0`;
- primo ciclo post-reboot: `2026-07-16T14:53:43Z`, esito `NO_ACTION`;
- stato del working tree dopo il reboot: pulito (confermato da `git status --short`);
- valutazione: evento spiegato, atteso e non influente sul gate; nessuna perdita di stato.

Nota: `last reboot` mostra tre entry: test del 14 luglio ore 23:08 e 23:22 (bootstrap),
e il reboot automatico del 16 luglio.

## Problemi scoperti durante il bootstrap

### URL documentale non valido nell'unità

Il primo `systemd-analyze verify` ha segnalato gli spazi nel percorso del campo
`Documentation=`. Il campo non influenzava l'esecuzione, ma rendeva l'unità non
pulita. È stato rimosso e la verifica è passata prima dell'avvio.

### Ownership Git nel riepilogo bootstrap

Il repository appartiene correttamente a `vaultops`; il riepilogo eseguito da
root veniva quindi respinto da Git come `dubious ownership`. Il bootstrap ora
legge il commit tramite `runuser --user vaultops`, senza aggiungere eccezioni
globali alla sicurezza Git.

### Cache Hardhat incompatibile con `ProtectHome=true`

Il primo avvio ha prodotto `EACCES` perché Hardhat tentava di creare
`/home/vaultops/.config/hardhat-nodejs`, mentre la home era intenzionalmente
protetta da systemd. Il servizio è stato fermato e corretto mantenendo
`ProtectHome=true`: `XDG_CONFIG_HOME` e `NPM_CONFIG_CACHE` puntano ora a
sottocartelle di `.automation-state`, l'unico albero autorizzato in scrittura.
Dopo il fix: stesso PID, zero restart e tre cicli riusciti.

## Audit dipendenze npm

`npm audit` registra debito tecnico nelle dipendenze storiche. Il report con
`--omit=dev` mostra 17 finding, nessuno critical; i quattro critical del report
completo appartengono alla toolchain di sviluppo. I finding production sono
principalmente copie transitive usate per sorgenti Solidity Chainlink,
OpenZeppelin e Uniswap, non moduli caricati dal loop observer. Non è stato usato
`npm audit fix --force`: proporrebbe major upgrade incompatibili di Chainlink e
Hardhat e richiede una migrazione separata con regressione completa. Il rischio
residuo è accettato soltanto per questa fase POC read-only, senza signer e senza
endpoint applicativo pubblico; resta un gate esplicito prima della produzione.

RPC e chiavi non devono comparire in questo documento.

## Raccolta live — 26 luglio 2026 ore 20:18–20:32 UTC

### Sistema e servizio

- uptime: **10 giorni 5 ore** dall'ultimo reboot (16 luglio 2026 14:53 UTC);
- servizio: **enabled**, **active**, `MainPID=898`, `NRestarts=0`, `ExecMainStatus=0`;
- nessun nuovo reboot nel periodo.

### Heartbeat

```json
{
  "state": "waiting",
  "startedAt": "2026-07-16T14:53:42.203Z",
  "updatedAt": "2026-07-26T20:14:40.351Z",
  "lastRunId": "arbitrum-usdc-poc-1-1785096878764-1d0dacc0",
  "lastRunState": "OBSERVED_ONLY",
  "consecutiveFailures": 0
}
```

### Run totali al 26 luglio

- totale run: **3399**;
- run `NO_ACTION`: 2287 (dal 14 luglio al 22 luglio 23:37 UTC — vault vuoto);
- run `OBSERVED_ONLY`: **1101** (dal 22 luglio 23:37 UTC — vault finanziato);
- run `FAILED`: **11** (causa uniforme: `Observation crossed N blocks; maximum is 10`);
- run con `SIMULATION_FAILED` o `VERIFICATION_FAILED`: **0**.

Tasso di failure: 11/3399 = **0.32%**. Tutti i fallimenti sono transitori (RPC lento in quel ciclo), con recupero automatico immediato nel ciclo successivo. In nessun momento `consecutiveFailures > 0`.

Distribuzione fallimenti:
- 18 luglio 2026: 3 (ore 11:03, 16:34, 21:41);
- 20 luglio 2026: 2 (ore 15:57, 18:18);
- 22 luglio 2026: 1 (ore 09:27);
- 23 luglio 2026: 1 (ore 17:33);
- 24 luglio 2026: 1 (ore 13:30);
- 26 luglio 2026: 3 (ore 06:59, 12:51, 16:48).

### Evento: primo deposito nel vault — 22 luglio 2026

- timestamp prima osservazione con fondi: `2026-07-22T23:37:15Z`;
- `custodyBalance`: `3100000` (3.1 USDC, decimali 6);
- `managedAssets`: `3100000`; tutti i fondi in custody, nessuna allocazione attiva;
- `reserveBps`: `10000` (100% in custody);
- decisione osservata: `REBALANCE`, drift `8000 bps`;
- azione proposta (non eseguita): `deposit AaveV3 310000 USDC`;
- allocazione target proposta: custody 620000, AaveV3 1085000, EulerV2 775000, MorphoVault 620000;
- esecuzione: **non avviata** — `execution.kind=disabled`, `autonomous.enabled=false`;
- tutti i cicli successivi: `OBSERVED_ONLY`, drift stabile, nessuna transazione.

### Preflight — 26 luglio 2026

- `checkedAt`: `2026-07-26T20:31:53Z`;
- `ready: true`;
- blocco Arbitrum: `488025484`;
- **34/34 check PASS**, incluso `EXECUTION_DISABLED`.

## Nota di handoff successiva

È stato aggiunto `04_Handoff_Autosufficiente_Per_Operatore_o_Assistente.md`, con
comandi read-only e criteri di accettazione. Le modifiche InterVault e i nuovi
test sono per ora nel workspace locale: non sono stati automaticamente eseguiti
come pull/deploy sulla VPS, che resta correttamente agganciata al commit
registrato sopra e al POC privo di InterVault. Ogni aggiornamento del server
richiederà un ciclo esplicito pull di commit revisionato, `npm ci`, compile,
typecheck, test, preflight e restart controllato.

Il 15 luglio 2026 è stata provata la raccolta SSH read-only da un nuovo contesto.
La connessione si è fermata correttamente prima dell'autenticazione perché la
host key non era ancora nel `known_hosts` locale. Non è stato usato
`StrictHostKeyChecking=no`. `ssh-keyscan` ha raggiunto OpenSSH sulla porta 22 ma
il client locale non ha negoziato il KEX necessario per estrarre la chiave.
Pertanto la verifica indipendente della fingerprint resta aperta e nessun nuovo
dato live è stato dichiarato senza evidenza.
