# Comandi completi

Tutti i comandi partono dalla root `TestSmartContract`.

## Verifica software

```powershell
npm run scripts:typecheck
npm run compile
npm run automation:test
npm run scripts:test
```

Risultato corrente: 14 + 37 = 51 test locali.

## Observe

```powershell
$env:HARDHAT_NETWORK = "arbitrum"
npm run automation:cli -- preflight --config="scripts/automation/config.poc.json"
npm run automation:cli -- run --config="scripts/automation/config.poc.json"
npm run automation:cli -- loop --config="scripts/automation/config.poc.json"
```

## Ispezione journal

```powershell
npm run automation:cli -- list --config="scripts/automation/config.poc.json"
npm run automation:cli -- show --config="scripts/automation/config.poc.json" --run-id="RUN_ID"
npm run automation:cli -- export --config="scripts/automation/config.poc.json" --run-id="RUN_ID" --output="rebalance-plan.json"
```

L'export usa creazione esclusiva e non sovrascrive un file esistente.

## Advisory direct

```powershell
npm run automation:cli -- run --config="scripts/automation/config.direct.json"
npm run automation:cli -- approve --config="scripts/automation/config.direct.json" --run-id="RUN_ID" --approved-by="operator-or-ticket"
npm run automation:cli -- execute --config="scripts/automation/config.direct.json" --run-id="RUN_ID" --execute=true --dry-run=false
```

`execution.expectedSignerAddress` deve coincidere col signer e con l'owner del `ProtocolManager`.

## Safe

```powershell
$env:PRIVATE_KEY = "caricata-in-modo-sicuro"
$env:SAFE_API_KEY = "caricata-in-modo-sicuro"
npm run automation:cli -- preflight --config="scripts/automation/config.safe.json"
npm run automation:cli -- run --config="scripts/automation/config.safe.json"
npm run automation:cli -- safe-propose --config="scripts/automation/config.safe.json" --run-id="RUN_ID"
npm run automation:cli -- safe-sync --config="scripts/automation/config.safe.json" --run-id="RUN_ID"
```

Ripetere `safe-sync` dopo l'esecuzione Safe. Non usare `approve` in Safe mode.

## Servizio

```powershell
npm run automation:cli -- loop --config="scripts/automation/config.poc.json"
npm run automation:cli -- service-status --config="scripts/automation/config.poc.json"
```

Autonomous persistente:

```powershell
npm run automation:cli -- loop --config="scripts/automation/config.autonomous.json" --execute=true --dry-run=false
```

## Cancellazione intenzione

```powershell
npm run automation:cli -- cancel --config="scripts/automation/config.poc.json" --run-id="RUN_ID" --reason="policy or state changed"
```

Per Safe cancellare/reject anche la proposta Safe; cancellare il journal locale non invalida una transazione multisig esistente.

## Fork riproducibile

```powershell
$env:FORK_ENABLED = "true"
$env:ARBITRUM_RPC_URL = "https://rpc-privata"
$env:FORK_BLOCK_NUMBER = "BLOCCO_FISSATO"
$env:HARDHAT_NETWORK = "hardhat"
npm run automation:cli -- preflight --config="scripts/automation/config.fork.json"
npm run automation:cli -- run --config="scripts/automation/config.fork.json"
```

Per `safe-propose` su fork, `simulationImpersonateAddress` deve essere un owner della Safe. Non inviare proposte al Transaction Service ufficiale usando una Safe mainnet mentre si lavora su uno stato forkato: usare un ambiente Safe di test o limitarsi alla simulazione/fixture locale.

## Deploy che produce il manifest

Il deploy rimane nella CLI operativa separata:

```powershell
npm run scripts:cli -- deploy-core --manifest="scripts/manifests/arbitrum-weth-poc.json" --base-code="WETH" --base-address="0x..." --base-decimals=18 --base-price-feed="0x..." --feed-decimals=8 --heartbeat=3600 --execute=true
npm run scripts:cli -- deploy-bundle --manifest="scripts/manifests/arbitrum-weth-poc.json" --kind="aave" --pool="0x..." --execute=true
```

Euler e Morpho Vault richiedono gli indirizzi esterni descritti nella documentazione della suite script. Dopo configurazione registry e trasferimento ownership, rieseguire il preflight del controller.
