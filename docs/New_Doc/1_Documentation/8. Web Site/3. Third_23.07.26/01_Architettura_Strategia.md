# Fase 1 — strategia architettura

## Direzione

La struttura resta HTML/CSS/ES modules. La terza iterazione aggiunge un livello di configurazione condivisa, una libreria diagnostica e protezioni contro stato asincrono obsoleto.

## Interventi

- creare `assets/js/config/site-config.js` per navigazione, disclaimer e status taxonomy;
- ricostruire shell e link con DOM API, evitando template HTML monolitici;
- creare `scripts/lib/diagnostics.mjs` per provider, serializzazione e report comuni;
- adattare le CLI esistenti alla libreria senza cambiare output pubblico;
- creare `scripts/check-content.mjs` per metadata, claim rischiosi e status editoriali;
- creare `scripts/release-readiness.mjs` come orchestratore read-only;
- introdurre token di refresh nel controller App;
- aggiungere una pagina Trust Center alimentata da fonti strutturate con fallback;
- estendere validazione a Trust Center e configurazione shell.

## Vincoli

Nessuna private key. Nessuna transazione automatica. Nessuna chiamata write diretta ai plugin. Nessun requisito di build per visualizzare il sito.

