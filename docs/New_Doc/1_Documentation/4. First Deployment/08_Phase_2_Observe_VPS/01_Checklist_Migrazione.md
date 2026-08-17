# Fase 2 — checklist migrazione VPS

Legenda: `[x]` completato; `[ ]` da completare; `[~]` in corso; `[!]` fallito.

## A. Acquisto e accesso

- [x] Creare VPS CX23 x86 a Nuremberg con Ubuntu 24.04.
- [x] Abilitare IPv4 e IPv6 pubblici.
- [x] Creare e collegare chiave SSH Ed25519 dedicata.
- [x] Creare e collegare firewall cloud SSH-only.
- [x] Registrare IPv4 e fingerprint host.
- [x] Verificare primo accesso SSH come root.
- [x] Verificare fingerprint host contro console Hetzner — **16 luglio 2026**, `SHA256:Rv4aL01OZGbyQ2heFUUh/qT2gS4lquogNfDHGyKs8bA` confermata.

## B. Bootstrap

- [x] Aggiungere bootstrap riproducibile.
- [x] Aggiungere unità `systemd` hardened.
- [x] Aggiornare Ubuntu e completare il reboot richiesto.
- [x] Installare Node 22 LTS verificando SHA-256.
- [x] Creare utente `vaultops`.
- [x] Clonare `dev-26` e registrare il commit.
- [x] Eseguire `npm ci`.

## C. Secret e validazione

- [x] Installare solo `ARBITRUM_RPC_URL` in `/etc/vault-automation/`.
- [x] Verificare owner `root:vaultops` e mode `0640`.
- [x] Confermare assenza di `PRIVATE_KEY`, mnemonic e signer.
- [x] Eseguire compile e typecheck.
- [x] Eseguire 39 test script e 14 test automation.
- [x] Eseguire preflight Arbitrum.

## D. Servizio

- [x] Avviare e abilitare `vault-automation-observe.service`.
- [x] Verificare servizio attivo, heartbeat `waiting` e zero failure.
- [x] Verificare almeno due cicli VPS.
- [x] Fermare il loop Windows.
- [x] Verificare un ciclo VPS successivo.

## E. Periodo shadow

- [x] Registrare timestamp iniziale.
- [x] Osservare almeno 24 ore — **PASS**: da `2026-07-14T23:40:26Z` a `2026-07-16T15:14Z`, ~39.6 ore, 476 run, 0 failure.
- [x] Censire cicli, failure, restart, heartbeat ed errori RPC — archiviati in `03_Registro_Esecuzione.md`.
- [x] Non completare il gate prima della durata minima.

## G. Chiusura Fase 2

- [x] Raccolta live SSH read-only completata — 16 luglio 2026 ore 15:02–15:14 UTC.
- [x] Tutti i 12 criteri PASS verificati con evidenza live.
- [x] Evento reboot kernel documentato e classificato come non bloccante.
- [x] Registro aggiornato con heartbeat, preflight, run count, commit e permessi.
- [ ] Creare config advisory separata (gate per Fase 3).
- [ ] Configurare Safe e Transaction Service senza signer sulla VPS observer.

## F. Handoff

- [x] Creare runbook autosufficiente per un nuovo operatore o assistente.
- [x] Censire host, servizio, commit, state root, heartbeat e manifest senza segreti.
- [x] Definire raccolta read-only e criteri PASS/FAIL numerici.
- [x] Chiarire che la documentazione non sostituisce l'accesso SSH.
