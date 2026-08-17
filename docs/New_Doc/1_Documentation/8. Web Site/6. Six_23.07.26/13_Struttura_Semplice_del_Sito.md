# Struttura semplice del sito Jethos

Il progetto del sito è diviso in poche parti principali.

```text
dapp-new/
├─ index.html       homepage reale
├─ app.html         applicazione PoC reale
├─ pages/           tutte le pagine informative reali
├─ landing.html     vecchio URL: reindirizza a index.html
├─ documentation.html vecchio URL: reindirizza a pages/docs.html
├─ config.html      vecchio URL: reindirizza a pages/protocol.html
├─ portfolio.html   vecchio URL: reindirizza a app.html
├─ assets/          grafica, CSS e JavaScript
├─ data/            informazioni mostrate dal sito
├─ content/docs/    documentazione leggibile nel sito
├─ scripts/         controlli e strumenti di manutenzione
├─ legacy/          vecchi file conservati ma non utilizzati
└─ artifacts/       screenshot e file temporanei locali
```

## Quali sono le pagine vere?

- `index.html` è la landing page principale.
- `app.html` è la console privata del PoC USDC.
- `pages/` contiene tutte le altre pagine attive: Vaults, Risk, Trust Center, Roadmap, Docs, FAQ, Vision e così via.

`index.html` deve normalmente rimanere nella cartella principale perché è la
homepage che il server apre automaticamente. `app.html` rimane accanto alla
homepage perché è il secondo entry point principale del progetto.

## Perché ci sono altre pagine HTML nella cartella principale?

Questi quattro file non sono pagine reali:

- `landing.html`;
- `documentation.html`;
- `config.html`;
- `portfolio.html`.

Sono piccoli redirect mantenuti soltanto per non rompere eventuali vecchi link.
Non contengono il vecchio sito e non vengono modificati come pagine.

Quindi la regola effettiva è:

```text
ROOT
├─ index.html e app.html       entry point reali
├─ quattro redirect legacy    compatibilità URL
└─ pages/                     tutte le pagine informative reali
```

## Aspetto e comportamento

Tutto ciò che costruisce visivamente il sito si trova in `assets/`.

- `assets/css/` contiene colori, layout, card, tabelle e responsive.
- `assets/js/` contiene menu, autenticazione, documentazione, WebGL, wallet e interazioni con i contratti.
- `assets/brand/` contiene logo e materiali del marchio.

## Informazioni mostrate

I file in `data/` contengono informazioni strutturate.

- `data/product/` contiene roadmap, vault, rischio e stato del prodotto.
- `data/protocol/` contiene deployment, protocolli ed evidenze.
- `data/editorial/` contiene principi e testi trasversali.

In questo modo i dati possono essere aggiornati senza riscrivere tutta la pagina.

## Documentazione

`content/docs/` contiene le versioni Markdown mostrate dal lettore interno del sito.

Questi file vengono generati dal pacchetto documentale principale tramite:

```powershell
npm run sync:docs
```

## Script

Gli strumenti dentro `scripts/` servono a controllare che tutto funzioni.

- `scripts/validation/` controlla file, link, contenuti e WebGL.
- `scripts/browser/` prova il sito in un browser reale.
- `scripts/diagnostics/` legge deployment e protocolli.
- `scripts/documentation/` aggiorna la documentazione.

Il controllo completo si avvia con:

```powershell
npm run ready
```

## File vecchi

`legacy/` contiene il vecchio prototipo e vecchi documenti.

Sono conservati come riferimento, ma il sito attuale non li utilizza.

## Riassunto in una frase

Le uniche pagine reali in root sono Home e PoC; tutte le pagine informative sono
in `pages`, mentre gli altri quattro HTML in root sono soltanto redirect.
