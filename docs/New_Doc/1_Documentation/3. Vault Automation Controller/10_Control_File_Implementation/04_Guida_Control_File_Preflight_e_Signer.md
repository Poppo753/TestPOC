# Guida control file, preflight e signer

## Un file per vault

Partire da `scripts/automation/config.example.json` e creare un file dedicato, per esempio:

```text
scripts/automation/config.arbitrum-weth-poc-1.json
```

Non riusare `stateDirectory` o `heartbeatPath` fra vault differenti.

## Sezione execution

### Observe

```json
"mode": "observe",
"execution": {
  "kind": "disabled"
}
```

Non richiede signer e non produce transazioni.

### Direct advisory/autonomous

```json
"execution": {
  "kind": "direct",
  "expectedSignerAddress": "0xPublicSignerAddress"
}
```

L'indirizzo è pubblico. La chiave non va nel JSON.

Per autonomous servono inoltre:

```json
"mode": "autonomous",
"autonomous": {
  "enabled": true,
  "acknowledgement": "I_ACCEPT_LIMITED_AUTONOMOUS_EXECUTION"
}
```

### Safe advisory

Con servizio ufficiale:

```json
"mode": "advisory",
"execution": {
  "kind": "safe"
},
"safe": {
  "address": "0xSafeAddress",
  "apiKeyEnv": "SAFE_API_KEY"
}
```

Con Transaction Service self-hosted:

```json
"safe": {
  "address": "0xSafeAddress",
  "txServiceUrl": "https://safe-service.example/api"
}
```

Se l'endpoint custom richiede una chiave si possono specificare entrambi i campi.

## Runtime service

```json
"runtime": {
  "stateDirectory": "../../.automation-state/arbitrum-weth-poc-1",
  "heartbeatPath": "../../.automation-state/arbitrum-weth-poc-1/service-heartbeat.json",
  "intervalSeconds": 300,
  "lockTtlSeconds": 900,
  "confirmations": 2,
  "rpcRetries": 5,
  "rpcRetryDelayMs": 1000,
  "maxConsecutiveFailures": 5
}
```

`maxConsecutiveFailures` deve essere abbastanza basso da far intervenire il supervisor, ma non così basso da trasformare un singolo errore RPC in restart continuo.

## Segreti

Esempio PowerShell solo per la sessione corrente:

```powershell
$env:ARBITRUM_RPC_URL = "https://rpc-privata"
$env:PRIVATE_KEY = "chiave-caricata-da-secret-manager"
$env:SAFE_API_KEY = "api-key-safe"
```

Non salvare i valori:

- nel control file;
- nel manifest;
- nei comandi della shell condivisi;
- nei log;
- nel repository.

Per un server utilizzare secret injection del provider, systemd credentials, Docker secrets, KMS o un vault aziendale. Il processo deve poter leggere il secret, ma gli utenti non autorizzati non devono poter leggere ambiente e file di stato.

## Preflight

```powershell
$env:HARDHAT_NETWORK = "arbitrum"
npm run automation:cli -- preflight --config="scripts/automation/config.arbitrum-weth-poc-1.json"
```

Interpretazione:

- `PASS`: controllo soddisfatto;
- `WARNING`: informazione incompleta ma non bloccante;
- `FAIL`: il processo non è ready;
- exit code `2`: report prodotto ma preflight fallito;
- exit code `1`: errore applicativo prima/durante il comando.

Un preflight Safe verifica anche bytecode Safe, owner di `ProtocolManager`, API key e raggiungibilità del Transaction Service.

## Manifest

Il control file contiene soltanto:

```json
"manifestPath": "../manifests/arbitrum-weth-poc-1.json"
```

Il manifest deve provenire da `deploy-core`/`deploy-bundle`. Il preflight non accetta come prova un indirizzo senza bytecode e confronta le registrazioni on-chain dei protocolli.

## Fork

Su fork, `runtime.simulationImpersonateAddress` indica l'account da impersonare per il comando che richiede firma:

- nel direct workflow: owner atteso del `ProtocolManager`;
- in `safe-propose`: un owner della Safe.

L'impersonation vale soltanto su Hardhat fork e non fornisce alcun potere su mainnet.
