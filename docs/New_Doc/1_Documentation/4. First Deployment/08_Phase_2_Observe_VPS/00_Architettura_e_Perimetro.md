# Fase 2 — architettura VPS observe

## Obiettivo

Spostare il controller dal processo temporaneo Windows a una VPS supervisionata
senza ampliare la sua autorità. La VPS osserva Arbitrum e registra decisioni,
ma non firma, propone o invia transazioni.

## Host scelto

- Hetzner Cloud CX23 x86: 2 vCPU, 4 GB RAM, 40 GB SSD;
- Nuremberg, Ubuntu 24.04 LTS;
- IPv4 e IPv6 pubblici;
- chiave Ed25519 dedicata;
- firewall cloud: SSH TCP/22 limitato all'IPv4 dell'operatore;
- costo dichiarato: €7,31/mese IVA inclusa.

Il PDF della console resta un file locale non versionato finché l'utente non ne
autorizza esplicitamente l'inclusione.

## Confini di sicurezza

Sono ammessi repository, manifest, control file observe, RPC, journal e
heartbeat. Sono vietati private key EVM, mnemonic, chiavi Safe owner, flag
`--execute=true --dry-run=false` e config advisory/autonomous.

`systemd` esegue un solo worker come `vaultops` con privilegi e filesystem
ridotti. Non viene esposto alcun servizio applicativo.

## Runtime

Node 20 è EOL nel luglio 2026. La VPS usa Node 22 LTS e ripete compile,
typecheck e test. Un'incompatibilità blocca l'avvio: non si torna
automaticamente a un runtime EOL.

## Migrazione

1. lasciare attivo il loop Windows;
2. preparare e testare la VPS;
3. avviare `systemd`;
4. osservare almeno due cicli VPS riusciti;
5. fermare il loop Windows;
6. verificare un ulteriore ciclo VPS;
7. iniziare la finestra ufficiale 24–72 ore.

La breve sovrapposizione è sicura perché entrambi gli observer sono read-only e
usano journal separati.
