# Fase 2 — checklist migrazione VPS

Legenda: `[x]` completato; `[ ]` da completare; `[~]` in corso; `[!]` fallito.

## A. Acquisto e accesso

- [x] Creare VPS CX23 x86 a Nuremberg con Ubuntu 24.04.
- [x] Abilitare IPv4 e IPv6 pubblici.
- [x] Creare e collegare chiave SSH Ed25519 dedicata.
- [x] Creare e collegare firewall cloud SSH-only.
- [ ] Registrare IPv4 e fingerprint host.
- [ ] Verificare primo accesso SSH come root.
- [ ] Verificare fingerprint host contro console Hetzner.

## B. Bootstrap

- [x] Aggiungere bootstrap riproducibile.
- [x] Aggiungere unità `systemd` hardened.
- [ ] Aggiornare Ubuntu.
- [ ] Installare Node 22 LTS verificando SHA-256.
- [ ] Creare utente `vaultops`.
- [ ] Clonare `dev-26` e registrare il commit.
- [ ] Eseguire `npm ci`.

## C. Secret e validazione

- [ ] Installare solo `ARBITRUM_RPC_URL` in `/etc/vault-automation/`.
- [ ] Verificare owner `root:vaultops` e mode `0640`.
- [ ] Confermare assenza di `PRIVATE_KEY` e mnemonic.
- [ ] Eseguire compile e typecheck.
- [ ] Eseguire 39 test script e 14 test automation.
- [ ] Eseguire preflight Arbitrum.

## D. Servizio

- [ ] Avviare e abilitare `vault-automation-observe.service`.
- [ ] Verificare servizio attivo, heartbeat `waiting` e zero failure.
- [ ] Verificare almeno due cicli VPS.
- [ ] Fermare il loop Windows.
- [ ] Verificare un ciclo VPS successivo.

## E. Periodo shadow

- [ ] Registrare timestamp iniziale.
- [ ] Osservare almeno 24 ore, preferibilmente 72.
- [ ] Censire cicli, failure, restart, heartbeat ed errori RPC.
- [ ] Non completare il gate prima della durata minima.
