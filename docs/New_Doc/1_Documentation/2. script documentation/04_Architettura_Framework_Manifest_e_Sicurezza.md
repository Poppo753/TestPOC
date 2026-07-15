# Architettura del framework, manifest e sicurezza

## Flusso end-to-end

```text
CLI / backend / agente
        |
        v
parser input -> manifest v1 -> runtime/provider
        |             |             |
        +---------- preflight -------+
                         |
                         v
                    buildPlan
                         |
              +----------+-----------+
              |          |           |
          encode-only  dry-run    execute
              |          |           |
          JSON/Safe   snapshot     receipt
                         |           |
                       revert    post-check
```

La CLI non contiene logica di protocollo. Ogni comando chiama una funzione sotto `operations/`, la stessa importabile da un servizio Node. Il browser non importa Hardhat: riceve `ExecutionPlan.calls[]`, firma `target`, `value` e `data` con il proprio wallet e conserva descrizioni/dipendenze per revisione.

## Manifest v1

Campi obbligatori:

- `schemaVersion: 1`;
- `network` e `chainId`;
- `createdAt`, `updatedAt`;
- `baseAsset` con code, address, decimals;
- `contracts`, `protocols`, `transactions`, `metadata`.

Il loader riconosce il vecchio `deployments/mainnet-latest.json`, normalizza sezioni top-level e nomi delle chiavi, ma ogni nuova scrittura usa lo schema v1. La validazione controlla chain ID, decimali, address dei contratti/protocolli, kind supportati, duplicati nella mappa contratti e formato degli hash. La scrittura è atomica: file temporaneo nello stesso path e rename finale.

Il manifest non contiene private key, mnemonic o URL RPC. `deployer` è soltanto l'address pubblico. `metadata.lastCompletedStep` e `lastCompletedBlock` rendono il deploy riprendibile e verificabile.

## ExecutionPlan

Ogni chiamata contiene:

- ID stabile e descrizione;
- chain ID;
- target;
- value come stringa decimale;
- calldata;
- dipendenze da chiamate precedenti;
- stato atteso opzionale.

`buildPlan` rifiuta ID duplicati, chain incoerenti e dipendenze future/mancanti. `stringifyForOutput` converte qualsiasi bigint in stringa; non viene usato `Number` per importi on-chain.

## Modalità di esecuzione

### Piano soltanto

Con `execute=false` nessuna transazione viene inviata. Il risultato contiene chiamate con status `planned`.

### Encode-only

Con `--encode-only=true` non serve signer. Per operazioni dipendenti dall'utente, come deposit/withdraw, va passato `--caller`. Un withdraw percentuale non può essere calcolato offline: encode-only richiede share esplicite.

### Dry-run

Per una chiamata viene usato `eth_call`. Per più chiamate dipendenti, il provider deve supportare `evm_snapshot`: la suite invia in ordine con nonce esplicito, raccoglie l'esito e ripristina sempre lo snapshot. Un provider live senza snapshot riceve un errore chiaro invece di una falsa simulazione.

### Execute

Solo `--execute=true --dry-run=false` invia stato permanente. Il nonce `pending` iniziale viene letto una volta e incrementato in ordine. L'esecuzione si ferma al primo fallimento e conserva i risultati delle chiamate già confermate.

## Deployment checkpoint

Il deployment non può essere un piano completamente pre-costruito perché l'address del contratto N nasce dalla receipt N. `CheckpointDeployer` pertanto:

1. riusa un address già presente solo se ha bytecode;
2. attende le confirmation richieste;
3. registra hash e block;
4. salva atomicamente il manifest dopo ogni step;
5. verifica owner prima delle configurazioni.

La policy economica non ha default produttivi nascosti. Fee, limiti, rate e flag vengono configurati con `core-policy`, in unità atomiche esplicite.

## Regole operative di sicurezza

- Non usare mai `scripts/legacy` in CI o produzione.
- Fissare `FORK_BLOCK_NUMBER` prima di simulare.
- Verificare `chainId` del manifest e del provider.
- Usare una RPC privata per run lunghi.
- Eseguire prima senza `--execute`, poi dry-run su fork, poi multisig.
- Controllare fee recipient, base asset decimals, feed decimals/heartbeat e dipendenze esterne.
- Trasferire ownership dei registry solo dopo tutte le configurazioni.
- Conservare il manifest risultante come artefatto di release.

