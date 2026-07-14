# Configurazione e policy field-by-field

## Identità

| Campo | Significato | Regola |
|---|---|---|
| `schemaVersion` | Versione formato | Deve essere `1` |
| `vaultId` | Identità stabile nel journal/lock | Solo lettere, numeri, `.`, `_`, `-`; max 80 |
| `chainId` | Chain autorizzata | Intero positivo e uguale a manifest/provider |
| `manifestPath` | Indirizzi del deploy | Risolto rispetto al config file |
| `mode` | Livello operativo | `observe`, `advisory`, `autonomous` |
| `baseAssetCode` | Asset unico del POC | Deve coincidere col manifest |
| `baseAssetDecimals` | Decimals asset | 0–36 e uguale al manifest |

## Protocolli

Ogni entry contiene:

| Campo | Significato |
|---|---|
| `name` | Nome esatto registrato in `ProtocolManager` e manifest |
| `enabled` | Consente nuovi deposit |
| `targetBps` | Allocazione desiderata |
| `maxBps` | Cap duro prospettico |

Un protocollo disabilitato deve avere target zero. Può produrre un withdraw di uscita, ma non un nuovo deposit. Tutti i protocolli attivi on-chain devono essere censiti; l’observer blocca quelli mancanti.

Il POC accetta solo manifest kind:

- `aave`;
- `euler`;
- `morpho-vault`.

`morpho` diretto usa collateral market semantics e non viene trattato come semplice yield supply. `uniswap-v3` non è lending. Dolomite e GMX sono esclusi.

## Policy economica

### `reserveTargetBps`

Liquidità desiderata in custody. Insieme ai target protocollo deve totalizzare 10.000.

### `reserveMinimumBps`

Limite duro sotto il quale il risk engine rifiuta. Deve essere minore o uguale al target.

### `rebalanceThresholdBps`

Drift minimo di almeno un bucket prima di considerare un rebalance. Riduce oscillazioni e gas inutile.

### `minimumActionAmount`

Importo minimo assoluto in unità minime del base asset. È una stringa perché può superare la precisione sicura JavaScript.

### `maxMovementBpsPerCycle`

Massimo withdraw e massimo deposit per ciclo rispetto a `managedAssets`. Non è un limite giornaliero: per quello serve una policy addizionale o enforcement on-chain.

### `cooldownSeconds`

Intervallo minimo dal run `COMPLETED` più recente. Run rejected/stale/non-action non avviano il cooldown.

### `maxPlanAgeBlocks`

Massima distanza in blocchi fra osservazione originaria e invio. Deve essere calibrata sulla chain e sulla durata dell’approvazione. Un valore troppo basso rende impraticabile la Safe; uno troppo alto aumenta il rischio di eseguire un’intenzione vecchia.

### `maxStateDriftBps`

Drift massimo quantitativo fra snapshot approvato e stato fresco. Viene calcolato usando il managed value iniziale come denominatore. Non allenta cambi strutturali: pause, flag operativi, debt, active state e circuit breaker devono coincidere esattamente.

### `maxObservationBlockSpan`

Numero massimo di blocchi attraversabili mentre si costruisce uno snapshot. Protegge da letture che mescolano stati troppo distanti.

### `minHealthFactor`

Valore 1e18-scaled. In supply-only ci si aspetta generalmente max uint/no debt; un valore finito sotto soglia è bloccante.

### `requireOracleFreshness`

Se true, il POC corrente fallisce perché `oracleDataAvailable` è false. È intenzionale: non si deve fingere una freshness non implementata.

### `supplyOnly`

Deve essere letteralmente true. Qualunque debt osservato viene rifiutato.

### `verificationToleranceBps`

Tolleranza post-esecuzione per interessi/rounding su managed assets, custody e balance. Non deve essere usata per nascondere perdite significative.

## Autonomia

`autonomous.enabled=true` da solo non basta. Serve:

```text
mode = autonomous
enabled = true
acknowledgement = I_ACCEPT_LIMITED_AUTONOMOUS_EXECUTION
```

La CLI richiede comunque i due flag persistenti. Questi controlli software non sostituiscono ruoli on-chain limitati.

## Runtime

| Campo | Funzione |
|---|---|
| `stateDirectory` | Journal e lock persistenti |
| `intervalSeconds` | Frequenza loop |
| `lockTtlSeconds` | Recovery lock stale |
| `confirmations` | Receipt confirmations |
| `rpcRetries` | Retry letture transitorie |
| `rpcRetryDelayMs` | Ritardo fra retry |
| `simulationImpersonateAddress` | Owner/Safe impersonato soltanto sul fork |

La lock TTL deve superare durata di simulazione + retry + confirmations + verifica. Non esiste ancora heartbeat del lease.

## Parametri da non copiare alla cieca

I valori dell’example sono illustrativi. Prima del deploy vanno calibrati:

- target e cap con governance;
- minimum amount rispetto a gas e TVL;
- plan age rispetto a blocchi/approvazione;
- drift/tolerance rispetto a yield e precisione protocolli;
- confirmations rispetto alla finalità Arbitrum;
- retry rispetto al contratto SLA delle RPC.
