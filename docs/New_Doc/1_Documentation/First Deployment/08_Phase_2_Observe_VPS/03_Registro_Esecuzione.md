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
- verifica indipendente della host key contro un secondo canale Hetzner: ancora da completare;
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
- stato Fase 2: in osservazione; non completa prima della scadenza minima.

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
