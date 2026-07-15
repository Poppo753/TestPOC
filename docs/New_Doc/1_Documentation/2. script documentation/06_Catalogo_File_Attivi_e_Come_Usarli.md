# Catalogo di tutti i file attivi

## Entry point

- `scripts/cli.ts`: unico entrypoint shell supportato. Parsing e output; non duplica logica.
- `scripts/README.md`: promemoria rapido e lista comandi.
- `scripts/manifests/schema-v1.example.json`: base da copiare per integrazioni esterne.
- `scripts/hardhat-plugins.d.ts`: carica l'augmentation TypeScript Hardhat/Ethers.

## Framework

- `framework/types.ts`: contratti TypeScript pubblici per manifest, runtime, piano e risultati.
- `framework/errors.ts`: errori con code/message/context e serializzazione.
- `framework/env.ts`: parser stretti di env string/bool/int/bigint/address/JSON.
- `framework/cli.ts`: parser delle opzioni CLI e serializzatore bigint.
- `framework/manifest.ts`: schema, normalizzazione legacy, validazione, load/save atomico.
- `framework/runtime.ts`: costruzione runtime da Hardhat, manifest, signer e opzioni.
- `framework/abis.ts`: ABI minime aderenti alle API correnti.
- `framework/contracts.ts`: letture ABI tipizzate via provider.
- `framework/preflight.ts`: chain, code, signer, balance, owner e importi.
- `framework/retry.ts`: retry esponenziale limitato alle letture RPC transitorie.
- `framework/plans.ts`: encoding calldata e validazione delle dipendenze.
- `framework/transactions.ts`: planned/encode-only/dry-run/execute, nonce e receipt.

Questi file si importano da backend/test; non si eseguono singolarmente.

## Operazioni deployment

- `operations/deployment/deployer.ts`: engine checkpoint, deploy, send, owner check.
- `operations/deployment/deploy-core.ts`: core completo e wiring Beacon/Proxy/oracle.
- `operations/deployment/deploy-bundle.ts`: cinque bundle supportati e guard plugin incompleti.

Usare le funzioni `deployCore` e `deployBundle` da un orchestratore, oppure i comandi omonimi della CLI.

## Operazioni amministrative

- `administration/beacon.ts`: update modulo e history.
- `administration/core-policy.ts`: fee, limiti, rate e operation flags.
- `administration/protocols.ts`: register/update/status/selectors.
- `administration/tokens.ts`: configure/remove token.
- `administration/registries.ts`: Aave/Euler/Morpho e ownership finale.
- `administration/emergency.ts`: sistema e circuit breaker.

Ogni funzione restituisce `OperationResult`; non chiama `process.exit` e può essere usata da API HTTP o job autonomi.

## Vault e protocolli

- `vault/deposit.ts`: wrap opzionale, approve esatto, deposit, share delta.
- `vault/withdraw.ts`: share/percentuale, preflight, deadline, burn delta.
- `vault/swap.ts`: quote multi-plugin, slippage, custody delta.
- `protocols/positions.ts`: dispatcher delle cinque azioni e lettura posizione.

## Monitoring

- `monitoring/system-status.ts`: snapshot strutturato del sistema.
- `monitoring/protocol-health.ts`: health, summaries e posizioni per rischio.

Sono read-only e possono essere schedulati. Conservano importi raw come stringhe; la UI applica decimali e simboli.

## Compatibility core

- `core/deposit/DepositETH.ts`;
- `core/withdraw/WithdrawETH.ts`;
- `core/monitoring/SystemStatus.ts`;
- `core/monitoring/CheckBalance.ts`;
- `core/README.md`.

Questi quattro script preesistenti restano per compatibilità e hanno 15 test dedicati. Per nuove integrazioni usare `operations/`, che supporta piano neutro e dependency injection.

## Configurazione compatibility

- `config/arbitrum.config.ts`: profilo Arbitrum storico ancora usato dal core.
- `config/chainlink-feeds-arbitrum.ts`: catalogo feed.
- `config/config.ts`: configurazione compatibility importata dalle fixture.
- `config/constants.ts`: costanti core.
- `config/networks.ts`: profili rete.

Non sono source of truth per nuovi deployment: il manifest v1 lo è.

## Utility compatibility

- `utils/BaseScript.ts`: lifecycle comune dei quattro script core.
- `utils/TestBaseScript.ts`: supporto ai test core.

Non estendere queste classi per nuove funzioni; aggiungere una operation importabile.
