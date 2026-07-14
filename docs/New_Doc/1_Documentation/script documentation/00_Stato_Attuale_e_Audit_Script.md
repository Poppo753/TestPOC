# Audit della cartella `scripts`

## Scopo

Questo documento fotografa lo stato trovato il 14 luglio 2026, il riordino
conservativo eseguito e i rischi da eliminare prima di considerare gli script
una superficie operativa utilizzabile da computer, backend, sito web o agente
autonomo.

## Inventario iniziale

- 359 file totali.
- 340 file TypeScript.
- 14 documenti Markdown.
- 3 file JavaScript, 1 JSON e 1 PowerShell.
- 290 file con un proprio `main()`.
- 297 file che terminavano direttamente il processo.
- 60 file che leggevano indirizzi da variabili `*_ADDRESS` sparse.
- 25 file con dipendenza esplicita da `PRIVATE_KEY`.
- 29 file contenenti mock, simulazioni, placeholder o TODO.
- cartelle sovrapposte: `deploy`, `deployment`, `deployments`;
  `test`, `testing`, `e2e`; `debug`, `interact`, `monitoring`.

Questi numeri non significano che 340 operazioni fossero disponibili. Molti
file erano copie successive dello stesso debug, fix one-off, redeploy di una
versione specifica o script legati a indirizzi storici.

## Problemi strutturali osservati

### Configurazione frammentata

Gli indirizzi erano distribuiti fra `.env`, `scripts/config/config.ts`,
`arbitrum.config.ts`, costanti locali e `deployments/mainnet-latest.json`.
Quest'ultimo contiene inoltre due schemi contemporaneamente: una mappa
`contracts` e sezioni top-level come `EulerV2Plugin`.

### Nessun confine fra libreria ed entrypoint

Quasi ogni file conteneva `main().then(...process.exit...)`. Questo rendeva
difficile importare e testare la logica da un backend senza avviare
involontariamente un processo o una transazione.

### Dry-run non affidabile

Alcuni script chiamavano una funzione per costruire `txPromise` prima di
controllare `dryRun`. In Ethers la chiamata può già inviare la transazione; un
dry-run deve invece usare `staticCall` o fermarsi prima della mutazione.

### API e costruttori storici

Sono presenti script nati per vecchie versioni del Beacon, dei plugin e dei
registry. L'audit statico ha trovato ancora chiamate alla vecchia API e molte
assunzioni locali sui costruttori. Gli esempi più pericolosi erano deployment
“completi” che non registravano tutti i moduli o usavano un costruttore Uniswap
non più corrente.

### Indirizzi e manifest non verificati

Caricare una stringa valida come address non prova che:

- sia sulla chain corretta;
- contenga bytecode;
- implementi il contratto atteso;
- coincida con l'implementazione registrata nel Beacon;
- appartenga allo stesso deployment degli altri moduli.

### Script distruttivi senza guardrail uniformi

Upgrade, pause, ownership, recovery e configurazione token non condividevano un
livello comune di conferma, allowlist di chain, controllo owner e post-verifica.

### Monitoring parzialmente simulato

Alcuni report dichiaravano esplicitamente metriche mock o ricostruite senza
fonte on-chain. Tali file possono essere utili come prototipi, ma non devono
apparire fra gli strumenti operativi supportati.

### Type-check non significativo

Il `tsconfig.json` includeva l'intera cartella `scripts` e anche `test/old`.
Il primo errore TypeScript proveniva da un test old sintatticamente rotto, quindi
non esisteva un gate indipendente per gli script di produzione.

## Riordino eseguito

Nessun file è stato eliminato. Sono stati archiviati 347 file sotto:

```text
scripts/legacy/
```

Le cartelle originali sono state mantenute come sottocartelle quando possibile,
così storia, nomi e contesto restano ricercabili. Sono state create categorie
aggiuntive per root script, azioni di configurazione, utility e operazioni core
estese.

## Superficie mantenuta attiva per compatibilità

Sono rimasti attivi soltanto gli script già coperti da
`test/integration/scripts/Phase1.Core.test.ts`:

- `core/deposit/DepositETH.ts`;
- `core/withdraw/WithdrawETH.ts`;
- `core/monitoring/SystemStatus.ts`;
- `core/monitoring/CheckBalance.ts`;
- runtime/configurazione minimi da cui dipendono.

Questi file costituiscono una compatibility layer; non saranno la nuova API
operativa principale.

## Cosa funziona oggi

- deposit della base asset ERC-20 dopo wrapping/approve;
- withdraw parziale o percentuale delle share;
- lettura di balance e stato core;
- fixture di test locale per i quattro script precedenti;
- deployment JSON storico utilizzabile come fonte da normalizzare;
- contratti e plugin Aave/Euler/Morpho già validati dai test fork.

## Cosa manca

- manifest con schema unico e validazione chain/code;
- runtime importabile senza `process.exit`;
- policy uniforme di dry-run, conferme e receipt;
- deployment core ripetibile e post-verificato;
- deployment bundle Aave/Euler/Morpho/MorphoVault/Uniswap;
- upgrade sicuro dei moduli Beacon;
- registrazione e aggiornamento protocolli nel ProtocolManager;
- configurazione token, registry, market e vault;
- operazioni vault complete: deposit, withdraw, swap;
- operazioni protocollo: deposit, withdraw, borrow, repay, close;
- health, summaries e posizioni aggregate;
- emergency pause/unpause con controlli owner;
- test dedicati alla nuova infrastruttura;
- guida stabile per ogni entrypoint supportato.

## Decisione di perimetro

Dolomite e GMX restano nel legacy/incomplete scope: non verranno esposti dalla
nuova suite finché i rispettivi plugin non avranno API e flow completi.

## Conclusione

La cartella conteneva molto materiale utile come storia e diagnostica, ma non
una API operativa affidabile. La soluzione corretta non è correggere 340 file
uno per uno: è preservare il legacy, creare un runtime unico e offrire un numero
ridotto di operazioni componibili, testate e documentate.

