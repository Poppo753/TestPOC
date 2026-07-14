# Fase 2 — runbook installazione e gestione

## Collegamento

```powershell
ssh -i "$env:USERPROFILE\.ssh\vault_observer_hetzner_ed25519" root@IP_VPS
```

Confrontare la fingerprint host con la console Hetzner prima di accettarla.

## Bootstrap

```bash
git clone --branch dev-26 --single-branch https://github.com/Poppo753/TestPOC.git /root/TestPOC-bootstrap
cd /root/TestPOC-bootstrap
bash ops/vps/bootstrap-observe.sh
```

Il bootstrap non avvia il servizio.

## Secret RPC

File: `/etc/vault-automation/arbitrum-usdc-poc-1.env`.

```text
ARBITRUM_RPC_URL=https://endpoint-autenticato
```

```bash
chown root:vaultops /etc/vault-automation/arbitrum-usdc-poc-1.env
chmod 0640 /etc/vault-automation/arbitrum-usdc-poc-1.env
stat /etc/vault-automation/arbitrum-usdc-poc-1.env
```

Non stampare il contenuto nei log.

## Validazione

```bash
cd /opt/vault-automation/TestSmartContract
sudo -u vaultops npm run compile
sudo -u vaultops npm run scripts:typecheck
sudo -u vaultops npm run scripts:test
sudo -u vaultops npm run automation:test
set -a
source /etc/vault-automation/arbitrum-usdc-poc-1.env
set +a
sudo -u vaultops --preserve-env=ARBITRUM_RPC_URL,HARDHAT_NETWORK env HARDHAT_NETWORK=arbitrum npm run automation:cli -- preflight --config=scripts/automation/config.arbitrum-usdc-poc-1.json
```

## Avvio e log

```bash
systemctl enable --now vault-automation-observe.service
systemctl status vault-automation-observe.service --no-pager
journalctl -u vault-automation-observe.service -n 100 --no-pager
```

## Heartbeat

```bash
cd /opt/vault-automation/TestSmartContract
set -a
source /etc/vault-automation/arbitrum-usdc-poc-1.env
set +a
sudo -u vaultops --preserve-env=ARBITRUM_RPC_URL,HARDHAT_NETWORK env HARDHAT_NETWORK=arbitrum npm run automation:cli -- service-status --config=scripts/automation/config.arbitrum-usdc-poc-1.json
```

## Stop e restart

```bash
systemctl stop vault-automation-observe.service
systemctl restart vault-automation-observe.service
```

Lo stop usa `SIGTERM`. Non cancellare lock o journal mentre il processo è vivo.
