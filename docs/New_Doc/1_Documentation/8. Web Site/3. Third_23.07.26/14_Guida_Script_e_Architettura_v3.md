# Guida script e architettura — v3

## Avvio

Dalla cartella `dapp-new`:

```powershell
.\scripts\serve.ps1 -Port 8000
```

Aprire `http://127.0.0.1:8000/`. Il sito richiede un origin HTTP per moduli ES, fetch JSON e dipendenze browser.

## Release gate

```powershell
npm run ready
```

Esegue in sequenza:

1. `validate-site.mjs` — struttura, link, H1, metadata, JSON, deployment JSON/JS, nav e taxonomy.
2. `check-content.mjs` — claim vietati, messaggi obbligatori e descrizioni.
3. `check-deployment.mjs` — bytecode, rete, asset, share, pool, fee, pause e operatività.
4. `inspect-protocols.mjs` — registry, plugin, lens, valori ed health globale.

Il comando continua a mostrare ogni gate anche se uno fallisce, quindi il report resta diagnostico. Non contiene signer e non invia transazioni.

## Comandi singoli

```powershell
npm run validate
npm run check:content
npm run check:deployment
npm run inspect:protocols
```

Le due CLI live supportano output macchina:

```powershell
npm run check:deployment -- --json
npm run inspect:protocols -- --json
```

## Libreria CLI

`scripts/lib/diagnostics.mjs` espone:

- `createReadOnlyProvider()` — costruisce soltanto `JsonRpcProvider` statico;
- `errorMessage()` — normalizza errori ethers/RPC;
- `jsonStringify()` — serializza BigInt in modo sicuro;
- `isJsonMode()` — interpreta `--json`;
- deployment ed ethers già validati.

Nuovi script operativi devono riusare questa libreria. Non aggiungere opzioni private-key o mnemonic.

## Shell pubblica

`assets/js/config/site-config.js` contiene soltanto dati trasversali: nav, footer, disclaimer e status. Il copy delle pagine resta nell'HTML per fallback, indicizzazione e review leggibile.

`core/site-shell.js` crea elementi con `createElement`, `textContent` e attributi espliciti. Per aggiungere una pagina primaria:

1. creare l'HTML con `data-root` corretto;
2. aggiungere la route a `SITE.navigation`;
3. assegnare `data-page` al body;
4. eseguire `npm run validate`.

## Dati Trust Center

`data-hydrator.js` legge `deployments.json` e `protocols.json` same-origin con timeout. Aggiorna solo elementi dichiarativi `data-deployment-fact` e `data-deployment-contract`. Se fetch fallisce, il contenuto HTML resta visibile; non mostra mai un vuoto come zero.

## Console PoC

Il controller usa contatori progressivi per refresh pubblici e utente. Una risposta è renderizzata soltanto se il token è ancora quello corrente e l'account non è cambiato. Non rimuovere questo controllo quando si aggiungono nuove letture.

Scritture consentite dalla UI:

- exact USDC approval verso LiquidityManager;
- revoke allowance;
- deposit tramite core;
- withdrawal con deadline tramite core.

Non esporre write generiche ai plugin. Le interazioni dirette ai protocolli appartengono al core autorizzato, non al consumatore.

## Checklist di manutenzione

1. Aggiornare record e configurazione insieme.
2. Eseguire `npm run ready`.
3. Verificare landing, Trust Center e App via HTTP.
4. Controllare desktop, 500 px e reduced motion.
5. Per cambi write, usare prima un fork finanziato.
6. Non descrivere il passaggio dei gate come audit.

