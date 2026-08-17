# Struttura finale di dapp-new

## Vista generale

```text
dapp-new/
├─ index.html                       landing pubblica
├─ app.html                         console PoC noindex
├─ landing.html                     solo redirect compatibilità → Home
├─ documentation.html               solo redirect compatibilità → Docs
├─ config.html                      solo redirect compatibilità → Protocol
├─ portfolio.html                   solo redirect compatibilità → PoC
├─ package.json                     comandi ufficiali
├─ README.md                        guida rapida
├─ robots.txt
├─ _headers.example
├─ assets/
├─ content/
├─ data/
├─ pages/
├─ scripts/
├─ legacy/
└─ artifacts/                       output locale ignorato
```

## assets

| Path | Responsabilità |
|---|---|
| `assets/brand` | marchio e SVG |
| `assets/css` | token, base, layout, componenti, pagine, Docs e WebGL |
| `assets/js/app` | controller, form, workflow e renderer PoC |
| `assets/js/components` | componenti UI riutilizzabili |
| `assets/js/config` | navigazione, taxonomy e configurazione sito |
| `assets/js/core` | shell, auth, navigation e utility |
| `assets/js/docs` | reader e parser Markdown |
| `assets/js/features` | enhancement e hydration JSON |
| `assets/js/web3` | ABI, reader, wallet e transazioni |
| `assets/js/webgl` | runtime, scene e controlli 3D |

## content

`content/docs` contiene esclusivamente il mirror Markdown web-readable del pack canonico e il suo `manifest.json`.

Non è il posto in cui modificare manualmente la documentazione: usare il pack canonico e `npm run sync:docs`.

## data

| Dominio | File |
|---|---|
| `editorial` | `site-content.json` |
| `product` | `product-state.json`, `vaults.json`, `roadmap.json`, `risk-policy.json`, `changelog.json` |
| `protocol` | `deployments.json`, `protocols.json`, `trust-evidence.json` |

### Regola

- `product` spiega esperienza, stato e policy;
- `protocol` registra configurazione tecnica ed evidenze;
- `editorial` contiene principi trasversali.

## pages

Le pagine restano piatte per preservare URL semplici:

- `how-it-works.html`
- `vaults.html`
- `risk-transparency.html`
- `trust-center.html`
- `roadmap.html`
- `docs.html`
- `protocol.html`
- `security.html`
- `vision.html`
- `faq.html`
- `developers.html`
- `team.html`
- `changelog.html`

Queste sono le pagine informative reali. I quattro HTML aggiuntivi presenti
nella root non appartengono a questo insieme: sono soltanto stub di redirect per
vecchi URL.

## scripts

| Dominio | Contenuto |
|---|---|
| `browser` | auth, Docs, WebGL smoke e catture |
| `diagnostics` | deployment, registry e libreria RPC read-only |
| `documentation` | sincronizzazione DOCX/Markdown |
| `validation` | gate statici |
| root scripts | server locale e release readiness |

Eseguire gli script tramite `npm`, così eventuali ulteriori riorganizzazioni non cambiano le procedure documentate.

## legacy

| Dominio | Contenuto |
|---|---|
| `prototype` | precedente sistema atom/molecule/organism e vecchio `main.js` |
| `reference` | API JSON, dependency graph e vecchi documenti |
| `data` | JSON superseded |
| `media` | video sperimentale non utilizzato |

Nessun import attivo deve puntare a `legacy`.

## artifacts

Contiene output locali, profili browser e review frame. È ignorato da Git e non appartiene al deploy.

## Dove aggiungere nuovi file

| Nuovo contenuto | Destinazione |
|---|---|
| Pagina pubblica | `pages/` |
| Componente CSS | `assets/css/components.css` o foglio dedicato |
| Modulo app | `assets/js/app/` |
| Integrazione web3 | `assets/js/web3/` |
| Scena 3D | `assets/js/webgl/scenes/` |
| Dato prodotto | `data/product/` |
| Evidenza deployment | `data/protocol/` |
| Documento web sincronizzato | tramite `content/docs/` |
| Test statico | `scripts/validation/` |
| Test browser | `scripts/browser/` |
| Diagnostica RPC | `scripts/diagnostics/` |
| Materiale non attivo | `legacy/` |
