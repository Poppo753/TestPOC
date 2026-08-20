# Strategia espansa per la nuova suite operativa

## Obiettivo finale

Creare una superficie TypeScript server-side che possa essere usata in tre modi
senza duplicare logica:

1. importata da backend o agente Node;
2. eseguita da CLI tramite `ts-node` con il runtime Hardhat caricato;
3. importata dai test con signer e contratti locali.

Un browser non deve importare Hardhat. Per sito web, Safe/multisig o wallet la
libreria produce un `ExecutionPlan` neutro con `chainId`, `target`, `value`,
`calldata`, descrizione e precondizioni. Il frontend firma/invia il piano con il
proprio provider. La libreria restituisce dati strutturati; la CLI si occupa
soltanto di parsing, output e exit code.

## Principi architetturali

### Separare framework, operazioni ed entrypoint

`framework/` contiene configurazione, manifest, preflight, transazioni e tipi.
`operations/` contiene funzioni applicative. Ogni file può avere un piccolo
entrypoint protetto da `require.main === module`, ma l'operazione esportata non
termina mai il processo.

### Manifest come source of truth

Ogni deployment viene descritto da un manifest versionato con:

- schema version;
- network e chain ID;
- timestamp e deployer;
- base asset;
- mappa normalizzata dei contratti;
- metadata dei protocolli;
- transaction hash opzionali.

Il loader supporta il vecchio `mainnet-latest.json`, ma ogni nuova scrittura usa
soltanto lo schema nuovo. Gli address possono essere sovrascritti via env in
modo esplicito, mai tramite fallback silenziosi a indirizzi Hardhat predefiniti.

### Preflight prima di ogni mutazione

Ogni operazione mutante deve verificare:

- chain consentita;
- signer disponibile e saldo gas;
- address valido;
- bytecode presente;
- ownership/authorization quando applicabile;
- stato corrente e idempotenza;
- parametri numerici non nulli e decimali corretti.

### Dry-run vero

Una singola chiamata usa `eth_call`. Una sequenza dipendente usa
`evm_snapshot`, esegue in ordine con nonce espliciti e infine applica sempre
`evm_revert`, anche in caso di errore. Questo è necessario perché una serie di
`eth_call` indipendenti non conserva, per esempio, il wrapping o l'allowance
della chiamata precedente. Su provider live che non supportano snapshot una
simulazione multi-call viene rifiutata esplicitamente: deve essere eseguita su
fork locale o servizio di simulazione equivalente. Senza `--execute=true` la
CLI restituisce soltanto il piano e non invia nulla.

### Receipt e post-verifica

Ogni transazione restituisce hash, block number, gas e status. Dopo il receipt
viene riletto lo stato: una transazione minata non basta se il Beacon, registry
o protocol manager non riflette il risultato atteso.

### Piano prima dell'esecuzione

Ogni mutazione viene divisa in `buildPlan` ed `executePlan`. Il piano è
serializzabile in JSON senza `bigint`, può essere sottoposto a revisione umana,
passato a una Safe o conservato in audit log. `encode-only` non richiede una
private key. Per sequenze multi-transazione il piano dichiara ordine e
dipendenze; l'esecutore serializza i nonce e si ferma al primo post-check fallito.

## Struttura target

```text
scripts/
  framework/
    types.ts
    errors.ts
    env.ts
    manifest.ts
    runtime.ts
    transactions.ts
    preflight.ts
    cli.ts
    plans.ts
  operations/
    deployment/
    administration/
    protocols/
    vault/
    monitoring/
  manifests/
    schema-v1.example.json
  core/                 # compatibility layer già testata
  config/               # profili rete e compatibilità
  legacy/               # storico non supportato
```

## Fase 1 — Fondazioni

### Tipi

Definire tipi per address map, manifest, transaction result, execution options,
protocol kind e structured operation result. Evitare `any` nella nuova suite.

### Errori

Usare errori categorizzati (`ConfigurationError`, `PreflightError`,
`OperationError`) con codice e context serializzabile. Un backend deve poter
distinguere input invalido da revert on-chain.

### Environment

Parser stretti per boolean, integer, bigint, address e JSON. Una variabile
mancante deve produrre un messaggio che indichi nome ed esempio.

### Manifest

Caricamento, normalizzazione legacy, validazione, scrittura atomica e merge
controllato. La scrittura non deve sovrascrivere un manifest di chain diversa.

### Runtime

Raccogliere provider, signer, chain ID, confirmations, dry-run e manifest.
Il runtime deve poter ricevere dependency injection nei test.

### Execution plan e serializzazione

Introdurre un formato stabile per chiamate e sequenze. Tutti i bigint devono
essere convertiti in stringhe decimali, mentre calldata e address restano hex.
Il runtime Node/Hardhat è un adapter di esecuzione, non il formato pubblico.

## Fase 2 — Deployment e upgrade

### Deploy core

Ordine corretto:

1. Beacon;
2. registrazione immediata `BASE_ASSET` e del relativo codice nel Beacon;
3. ProxyGeneral;
4. ChainlinkAdapter;
5. TokenManager;
6. ValueCalculator;
7. SwapManager;
8. ParameterManager;
9. EmergencyHandler;
10. LiquidityManager, che legge asset e decimali nel constructor;
11. ProtocolManager e FlashLoanService;
12. registrazioni Beacon e authorization ProxyGeneral;
13. configurazione feed Chainlink base e poi `setBaseAssetCode`;
14. policy esplicita separata per fee, limiti, rate e operation flags;
15. health check e checkpoint atomico dopo ogni transazione.

Il deployment deve poter essere eseguito su Hardhat e su chain 42161 soltanto
quando tutti gli indirizzi esterni sono espliciti.

### Bundle plugin

- Aave: registry, plugin, lens, reserve configuration e ownership registry.
- Euler: registry, plugin, lens, EVC/Lens addresses, vault config e ownership.
- Morpho: registry, plugin, lens e market params completi.
- MorphoVault: vault config, plugin e lens riutilizzando MorphoRegistry.
- Uniswap V3 Direct: router, quoter e ProxyGeneral.

Dolomite/GMX devono essere rifiutati con messaggio “unsupported/incomplete”.

### Upgrade

L'upgrade Beacon deve:

- verificare bytecode nuovo;
- leggere implementazione corrente;
- impedire same-address;
- simulare `updateImplementation`;
- eseguire solo con conferma;
- verificare history e nuovo address;
- non modificare ownership automaticamente.

L'output encode-only deve poter essere importato in una multisig. Un eventuale
trasferimento ownership è un task separato a due fasi e non un effetto laterale
del deploy.

## Fase 3 — Configurazione amministrativa

### Token

Registrare/rimuovere token con address, decimali, heartbeat e oracle support.
La base asset viene configurata separatamente per evitare doppia registrazione.

### ProtocolManager

Registrare protocollo con plugin, lens e tipo; aggiornare plugin/lens; attivare o
disattivare; configurare selector whitelist per chiamate specifiche.

### Registry

Esporre configurazione Aave token, Euler vault, Morpho market e Morpho vault.
Ogni comando deve leggere nuovamente il record dopo la transazione.

### Emergency

Esporre status, pause/unpause e circuit breaker di protocollo. Unpause e upgrade
richiedono owner e conferma esplicita.

## Fase 4 — Operazioni utente e vault

### Deposit

Supportare base asset ERC-20 e WETH wrapping. Leggere decimali, simulare,
approvare solo l'importo necessario, depositare e restituire share ricevute.

### Withdraw

Accettare share o percentuale, verificare `canWithdraw`, usare deadline on-chain
e restituire asset ricevuto/share bruciate.

### Swap nella custody

Usare SwapManager, non trasferimenti diretti. Calcolare quote/minOut, applicare
slippage e deadline, simulare e verificare i balance delta.

### Protocol operations

Un dispatcher tipizzato espone deposit, withdraw, borrow, repay e close tramite
ProtocolManager. Le operazioni specifiche (leverage o Morpho market pair) usano
`executeProtocolCall` soltanto con selector whitelisted.

## Fase 5 — Monitoring

### System status

Aggregare Beacon status, module code, pause, deposit/withdraw enabled, pool
value, supply, LP price e active protocols.

### Protocol health

Usare ProtocolManager e lens per total value, collateral, debt, health factor,
position count, circuit breaker e protocol limits.

### Positions

Esporre summaries e posizioni ordinate per rischio. I numeri devono restare in
wei nella struttura dati; la formattazione è responsabilità UI/CLI.

## Fase 6 — Testing

- unit test per env, manifest e CLI parser;
- integration test locale per upgrade, token, protocol registration, deposit,
  withdraw, status ed emergency;
- fork smoke per bundle Aave/Euler/Morpho e monitoring;
- type-check separato che escluda `legacy` e `test/old`;
- mantenimento dei test compatibility core.

## Fase 7 — Documentazione

- guida generale;
- guida per framework e manifest;
- guide deployment/upgrade;
- guide vault/protocolli;
- guide monitoring/emergency;
- catalogo legacy con regola “non eseguire senza revisione”.

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| transazione sulla chain sbagliata | allowlist chain e manifest chain ID |
| indirizzo storico | code check + coerenza Beacon |
| simulazione multi-call non coerente | snapshot/send/revert su fork; rifiuto sui provider senza snapshot |
| allowance eccessiva | approve importo esatto e reset quando necessario |
| manifest corrotto | schema, scrittura atomica e backup |
| plugin incompleto | enum supportato e rifiuto Dolomite/GMX |
| UI interpreta male bigint | output stringhe decimali raw + metadata decimals |
| RPC instabile | timeout, receipt retry limitato e messaggi distinti |
| nonce concorrenti | esecuzione sequenziale o NonceManager esplicito |
| browser legato a Hardhat | ExecutionPlan neutro, firma demandata al wallet |
| output JSON invalido per bigint | serializzatore unico e testato |
| chiavi nei log | mai serializzare env/private key; mostrare solo signer address |

## Ordine ottimale rivisto

L'ordine più sicuro è framework → monitoring read-only → amministrazione
idempotente → operazioni utente → deployment → bundle plugin. Sebbene il deploy
sia concettualmente “prima”, implementarlo dopo runtime e preflight evita di
replicare subito gli errori storici. I test locali devono accompagnare ogni
fase, non essere rimandati alla fine.

## Criterio di completamento

La suite è completata quando tutte le operazioni dichiarate supportate sono
importabili, type-safe, dry-runnable, testate localmente, documentate e non
dipendono da indirizzi hardcoded nascosti.
