# VPS observe — file operativi

Questa directory contiene il bootstrap minimo della VPS Ubuntu 24.04. La unità
`systemd` è in `../systemd/`.

Il bootstrap verifica sistema e architettura, installa Node 22 LTS verificando
SHA-256, crea l'utente `vaultops`, clona `dev-26`, esegue `npm ci` e installa
la unità. Non copia segreti e non avvia il servizio.

```bash
sudo bash ops/vps/bootstrap-observe.sh
```

Il solo secret ammesso va in:

```text
/etc/vault-automation/arbitrum-usdc-poc-1.env
```

Formato:

```text
ARBITRUM_RPC_URL=https://endpoint-autenticato
```

Permessi: owner `root`, group `vaultops`, mode `0640`. Non aggiungere
`PRIVATE_KEY`, mnemonic o chiavi Safe.
