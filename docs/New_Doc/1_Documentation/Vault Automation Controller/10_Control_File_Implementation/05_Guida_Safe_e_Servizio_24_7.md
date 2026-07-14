# Guida Safe e servizio 24/7

## Workflow Safe

### 1. Generare il run

Con control file `mode=advisory`, `execution.kind=safe`:

```powershell
npm run automation:cli -- run --config="scripts/automation/config.poc.json"
```

Se serve rebalance, lo stato finale è `AWAITING_SAFE_PROPOSAL`. Non viene eseguita una simulazione direct fingendo di essere la Safe.

### 2. Proporre

Il signer dell'ambiente deve essere uno degli owner della Safe:

```powershell
npm run automation:cli -- safe-propose --config="scripts/automation/config.poc.json" --run-id="RUN_ID"
```

Il comando:

1. crea `MetaTransactionData` call-only;
2. costruisce MultiSendCallOnly;
3. richiede la stima al Transaction Service;
4. calcola hash e firma;
5. propone;
6. salva il binding.

Lo stato diventa `AWAITING_APPROVAL`, non `APPROVED`.

### 3. Firmare ed eseguire nella Safe

Gli altri owner controllano:

- Safe address;
- chain;
- nonce;
- target;
- calldata decodificata;
- importi;
- età del piano.

Raggiunto il quorum, la Safe esegue il batch. Il controller non conserva le firme degli altri owner.

### 4. Sincronizzare

```powershell
npm run automation:cli -- safe-sync --config="scripts/automation/config.poc.json" --run-id="RUN_ID"
```

Se pending, il run non cambia. Se failed, diventa `EXECUTION_FAILED`. Se successful, vengono controllati servizio trusted, binding, receipt, target, conferme e post-stato.

## Staleness Safe

Non eseguire proposte che hanno superato `maxPlanAgeBlocks` o ricevuto alert di cambio stato. La Safe può ancora eseguire una proposta vecchia perché il controllo è off-chain. Per enforcement servirebbe un Guard/Module o executor on-chain dedicato; non fa parte del POC.

Una proposta vecchia deve essere cancellata/rejected nella Safe e il run va cancellato localmente se ancora non terminale.

## Servizio 24/7

### Avvio

Observe o direct:

```powershell
npm run automation:cli -- loop --config="scripts/automation/config.poc.json"
```

Autonomous persistente richiede entrambi i flag:

```powershell
npm run automation:cli -- loop --config="scripts/automation/config.poc.json" --execute=true --dry-run=false
```

Il loop esegue sempre preflight prima di partire.

In Safe mode il loop genera al massimo un'intenzione aperta. `latestOpen()` impedisce duplicati; proposta e sync restano comandi espliciti nel POC.

### Heartbeat

```powershell
npm run automation:cli -- service-status --config="scripts/automation/config.poc.json"
```

Stati:

- `ready`;
- `running`;
- `waiting`;
- `failed`;
- `stopped`.

Un file vecchio non prova che il servizio sia vivo. Il monitor esterno deve verificare che `updatedAt` sia recente rispetto a `intervalSeconds`.

### Esempio systemd

Esempio concettuale da adattare all'host:

```ini
[Unit]
Description=Vault Automation Controller - arbitrum-weth-poc-1
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/TestSmartContract
Environment=HARDHAT_NETWORK=arbitrum
EnvironmentFile=/run/secrets/vault-automation.env
ExecStart=/usr/bin/npm run automation:cli -- loop --config=scripts/automation/config.poc.json
Restart=on-failure
RestartSec=15
TimeoutStopSec=180
User=vault-automation
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Per observe/advisory non aggiungere i flag persistenti. Proteggere `EnvironmentFile` e state directory con permessi dell'utente dedicato.

## Recovery

### Processo crashato durante waiting

Riavviare. Il lock dovrebbe essere libero; il journal resta valido.

### Lock presente

Verificare che non esista un processo vivo. Solo dopo il TTL il controller recupera il lock stale. Non cancellarlo mentre un worker è attivo.

### Safe pending

Non creare un secondo run. Controllare Safe UI/Service e usare `safe-sync`.

### Receipt inviata ma processo terminato

Per direct execution resta necessario il receipt reconciler più completo già indicato nella roadmap generale. Per Safe, `safe-sync` recupera la transazione tramite `safeTxHash`.

### Failure threshold

Il runner esce non-zero. Il supervisor può riavviare, ma un restart loop deve generare alert e non essere considerato recovery riuscita.
