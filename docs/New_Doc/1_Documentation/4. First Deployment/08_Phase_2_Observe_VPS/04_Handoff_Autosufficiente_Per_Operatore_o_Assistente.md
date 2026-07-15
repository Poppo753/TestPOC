Ciao P# Handoff autosufficiente della VPS observer

## Scopo

Questo file consente a un nuovo operatore o assistente di verificare la Fase 2
senza ricostruire la conversazione originale. Non contiene password, RPC, chiavi
SSH private, mnemonic o signer blockchain.

## Identità pubblica

- provider: Hetzner Cloud;
- host: `vault-observer-arbitrum-01`;
- IPv4: `46.225.133.37`;
- sistema: Ubuntu 24.04 LTS, amd64;
- utente servizio: `vaultops`;
- repository server: `/opt/vault-automation/TestSmartContract`;
- branch atteso: `dev-26`;
- servizio: `vault-automation-observe.service`;
- control file: `scripts/automation/config.arbitrum-usdc-poc-1.json`;
- manifest: `scripts/manifests/arbitrum-usdc-poc-1.json`;
- state root: `.automation-state/arbitrum-usdc-poc-1` nel repository;
- heartbeat: `.automation-state/arbitrum-usdc-poc-1/service-heartbeat.json`;
- secret environment: `/etc/vault-automation/arbitrum-usdc-poc-1.env`;
- modalità attesa: `observe`, execution `disabled`, autonomous `false`.

La chiave privata SSH resta sul computer dell'operatore e non va copiata in
questo repository. La fingerprint host attesa è documentata nel Registro di
esecuzione, ma deve ancora essere confrontata tramite un secondo canale Hetzner.

## Accesso

Da PowerShell:

```powershell
ssh -i "$env:USERPROFILE\.ssh\vault_observer_hetzner_ed25519" root@46.225.133.37
```

Non ignorare un avviso di host-key cambiata. Interrompere e verificare dalla
console Hetzner.

## Raccolta read-only completa

Eseguire sulla VPS. I comandi non stampano il contenuto del file RPC.

```bash
hostnamectl
date --iso-8601=seconds
uptime
systemctl is-enabled vault-automation-observe.service
systemctl is-active vault-automation-observe.service
systemctl show vault-automation-observe.service -p MainPID -p NRestarts -p ActiveEnterTimestamp -p ExecMainStatus
journalctl -u vault-automation-observe.service --since "2026-07-14 23:40:26 UTC" --no-pager
sudo -u vaultops git -C /opt/vault-automation/TestSmartContract rev-parse HEAD
sudo -u vaultops git -C /opt/vault-automation/TestSmartContract status --short
stat -c '%U:%G %a %n' /etc/vault-automation/arbitrum-usdc-poc-1.env
find /opt/vault-automation/TestSmartContract/.automation-state/arbitrum-usdc-poc-1 -maxdepth 2 -type f -printf '%TY-%Tm-%TdT%TH:%TM:%TS %p\n' | sort
```

Heartbeat strutturato:

```bash
cd /opt/vault-automation/TestSmartContract
set -a
source /etc/vault-automation/arbitrum-usdc-poc-1.env
set +a
sudo -u vaultops --preserve-env=ARBITRUM_RPC_URL,HARDHAT_NETWORK \
  env HARDHAT_NETWORK=arbitrum npm run automation:cli -- \
  service-status --config=scripts/automation/config.arbitrum-usdc-poc-1.json
```

Elenco run e dettaglio dell'ultimo run:

```bash
sudo -u vaultops --preserve-env=ARBITRUM_RPC_URL,HARDHAT_NETWORK \
  env HARDHAT_NETWORK=arbitrum npm run automation:cli -- \
  list --config=scripts/automation/config.arbitrum-usdc-poc-1.json

# Sostituire RUN_ID con l'ID più recente restituito dal comando precedente.
sudo -u vaultops --preserve-env=ARBITRUM_RPC_URL,HARDHAT_NETWORK \
  env HARDHAT_NETWORK=arbitrum npm run automation:cli -- \
  show --config=scripts/automation/config.arbitrum-usdc-poc-1.json --run-id=RUN_ID
```

Preflight aggiornato:

```bash
sudo -u vaultops --preserve-env=ARBITRUM_RPC_URL,HARDHAT_NETWORK \
  env HARDHAT_NETWORK=arbitrum npm run automation:cli -- \
  preflight --config=scripts/automation/config.arbitrum-usdc-poc-1.json
```

## Criteri PASS della Fase 2

Tutti devono essere veri:

1. sono trascorse almeno 24 ore dall'inizio ufficiale
   `2026-07-14T23:40:26Z`;
2. servizio `enabled` e `active`;
3. heartbeat recente: età non superiore a due intervalli, quindi 600 secondi;
4. stato heartbeat `waiting`, `running` oppure `ready`;
5. `consecutiveFailures=0` e nessun `lastError` irrisolto;
6. `NRestarts=0`, oppure ogni restart è spiegato con evidenza e nuova finestra;
7. nessun run `FAILED`, `SIMULATION_FAILED` o `VERIFICATION_FAILED` non
   investigato;
8. preflight `ready=true`;
9. manifest e control file corrispondono al commit atteso;
10. file secret ancora `root:vaultops 640` e privo di signer;
11. nessun comando persistente e nessuna transazione inviata;
12. la fingerprint host è stata verificata da un secondo canale.

Se uno solo fallisce, la Fase 2 non è conclusa.

## Criteri di escalation

- heartbeat più vecchio di 600 secondi;
- servizio inattivo o restart non spiegato;
- failure consecutive maggiori di zero;
- errore RPC ripetuto oltre i retry;
- drift manifest/on-chain;
- comparsa di `PRIVATE_KEY`, mnemonic o configurazione non-observe;
- repository dirty con cambiamenti non censiti;
- posizione economica inattesa nel vault durante il periodo shadow.

In questi casi non avviare advisory e non cancellare manualmente lock o run.
Raccogliere journal, heartbeat, ultimo run e commit, quindi aggiornare
`03_Registro_Esecuzione.md`.

## Passaggio alla fase successiva

Dopo il PASS:

1. aggiornare la checklist Fase 2 con timestamp finale e conteggio run;
2. archiviare output di heartbeat, preflight, `NRestarts` e journal;
3. creare una config advisory separata; non modificare quella observe in place;
4. configurare Safe e Transaction Service senza installare una signer key sulla
   VPS observer;
5. ripetere preflight e produrre soltanto una proposta innocua/canary;
6. mantenere la Safe 2-su-3 come autorità per operazioni amministrative.

Un altro assistente può quindi capire lo stato dai file e dai comandi sopra, ma
per interrogare davvero la VPS deve ricevere dall'utente accesso alla chiave SSH
locale o output redatto dei comandi. La documentazione da sola non concede
accesso, intenzionalmente.
