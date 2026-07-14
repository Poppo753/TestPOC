# Fase 2 — checklist migrazione VPS

Legenda: `[x]` completato; `[ ]` da completare; `[~]` in corso; `[!]` fallito.

## A. Acquisto e accesso

- [x] Creare VPS CX23 x86 a Nuremberg con Ubuntu 24.04.
- [x] Abilitare IPv4 e IPv6 pubblici.
- [x] Creare e collegare chiave SSH Ed25519 dedicata.
- [x] Creare e collegare firewall cloud SSH-only.
- [x] Registrare IPv4 e fingerprint host.
- [x] Verificare primo accesso SSH come root.
- [ ] Verificare fingerprint host contro console Hetzner.

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
- [~] Osservare almeno 24 ore, preferibilmente 72.
- [~] Censire cicli, failure, restart, heartbeat ed errori RPC.
- [x] Non completare il gate prima della durata minima.
