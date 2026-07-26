# Report di migrazione e verifica

## Migrazione eseguita

Sono stati spostati 32 path iniziali, seguiti da due normalizzazioni di naming.

### Dati

- `data/site-content.json` → `data/editorial/site-content.json`
- dati di prodotto → `data/product/`
- dati deployment/trust → `data/protocol/`

### Script

- browser smoke e capture → `scripts/browser/`
- RPC diagnostics → `scripts/diagnostics/`
- sync documentazione → `scripts/documentation/`
- gate statici → `scripts/validation/`

### Legacy

- `src` e vecchio `main.js` → `legacy/prototype/`
- API reference, dependency graph e vecchi documenti → `legacy/reference/`
- JSON non attivi → `legacy/data/`
- video sperimentale → `legacy/media/experimental-webgl-background.mp4`

### Artefatti

Il precedente `review-output` è stato spostato in `artifacts/visual-review` e l’intera cartella `artifacts` è ignorata.

## Codice aggiornato

- package script;
- release readiness;
- import relativi dei validatori;
- import relativi della diagnostica;
- root resolution dello script Word;
- fetch JSON del data hydrator;
- confronto fra deployment JSON e config JS;
- source label nelle pagine Risk, Trust e Changelog;
- README principale.

## Protezioni introdotte

`validate-site.mjs`:

- ignora `legacy` e `artifacts`;
- valida solo JSON sotto `data`;
- continua a controllare pagine, link, navigation, footer e deployment;
- usa la nuova fonte `data/protocol/deployments.json`.

## Test dopo la migrazione

### Statici

- Site validation: 19 pagine, 9 JSON attivi.
- Editorial contract: 21 fonti.
- Product content: passato.
- Documentation: 13 documenti.
- WebGL contract: quattro scene.

### Documentazione

`npm run sync:docs` ha convertito nuovamente 12 DOCX e copiato il Markdown 12 usando il nuovo path dello script.

### Live diagnostics

`npm run ready` ha confermato:

- otto componenti con bytecode;
- native USDC coerente;
- depositi e prelievi abilitati al momento del test;
- pause non riportate;
- quattro integrazioni registrate attive.

### Browser

- auth gate: passato;
- Docs reader: passato;
- quattro scene WebGL e fallback forced-off: passati.

## Esito

La struttura è più leggibile senza cambiare URL pubblici o workflow utente. Tutti gli entry point e i comandi `npm` continuano a funzionare.
