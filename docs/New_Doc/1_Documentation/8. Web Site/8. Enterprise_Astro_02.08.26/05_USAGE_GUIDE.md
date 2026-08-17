# Guida all'utilizzo

## Panoramica

Il progetto enterprise è completo in `jethos-web/`. `dapp-new/` resta la baseline e il fallback fino al cutover; `jethos-web/dist/` è l'unico artifact target deployabile.

## Architettura essenziale

Astro genera HTML statico da layout, componenti e contenuti tipizzati. JavaScript client viene associato soltanto alle feature interattive. Il design system è separato dalle feature di dominio. I dati tecnici DeFi restano versionati in Git.

## Prerequisiti

- Node.js 22.12 o superiore; la baseline di verifica usa 22.23.2.
- npm con lockfile.
- Microsoft Edge/Chrome per test browser.
- Python opzionale per servire il legacy.
- Microsoft Word soltanto per sincronizzare i DOCX legacy.

## Installazione

Il nuovo package è isolato dal package Hardhat root:

```powershell
cd jethos-web
npm ci
```

## Configurazione

- Runtime obbligatorio: Node.js 22.12+.
- Output Astro: `static`.
- Asset build: `dist/_assets/`.
- TypeScript: preset `strictest` con indexed access ed exact optional properties.

## Variabili d'ambiente

Non applicabile in questa fase. Le future variabili pubbliche e server-only saranno separate e validate.

## Avvio locale

### Legacy static server

- Scopo: avviare la baseline corrente.
- Percorso: `dapp-new/scripts/serve.ps1`.
- Prerequisiti: Python.
- Comando: `powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 -Port 8000`.
- Parametri: `-Port` opzionale.
- Input: directory `dapp-new`.
- Output: server localhost.
- Esempio: aprire `http://127.0.0.1:8000/`.
- Errori comuni: porta occupata; apertura via `file://` non supportata.

### Nuovo sito Astro

- Scopo: sviluppo locale del target enterprise.
- Percorso: `jethos-web/package.json`.
- Prerequisiti: Node.js 22.12+ e `npm ci`.
- Comando: `npm run dev`.
- Parametri: opzioni Astro, per esempio `-- --host 127.0.0.1`.
- Input: `src/` e `public/`.
- Output: server locale Astro.
- Esempio: `cd jethos-web; npm run dev`.
- Errori comuni: Node precedente alla versione richiesta.

## Build

### Build statica Astro

- Scopo: generare l'artifact deployabile.
- Percorso: `jethos-web/package.json`.
- Prerequisiti: Node 22.12+ e installazione pulita.
- Comando: `npm run build`.
- Parametri: nessuno.
- Input: route, componenti, contenuti e asset.
- Output: `jethos-web/dist/`.
- Esempio: `cd jethos-web; npm run build`.
- Errori comuni: schema contenuti invalido o type error.

## Test

### Baseline legacy

- Scopo: verificare sito statico, contenuti, Demo, Docs e WebGL.
- Percorso: `dapp-new/package.json`.
- Prerequisiti: Node.js 20+ per il legacy; Node.js 22.12+ per `jethos-web/`.
- Comando: `npm run validate`, `npm run check:product`, `npm run check:demo`, `npm run check:webgl`, `npm run check:docs`.
- Parametri: nessuno.
- Input: file legacy.
- Output: esito console.
- Esempio: `cd dapp-new; npm run check:demo`.
- Errori comuni: `check:content` include attualmente un HTML sotto `artifacts/`.

### Browser smoke legacy

- Scopo: verificare runtime in Chromium.
- Percorso: `dapp-new/scripts/browser/`.
- Prerequisiti: server locale e Edge/Chrome.
- Comando: `npm run check:auth:browser -- http://127.0.0.1:8000` e analoghi.
- Parametri: base URL.
- Input: sito servito.
- Output: esito smoke.
- Esempio: `npm run check:docs:browser -- http://127.0.0.1:8000`.
- Errori comuni: browser non trovato o server non avviato.

## Deployment

Il nuovo target produrrà `jethos-web/dist/`. Hosting e cutover saranno documentati in M6. Non pubblicare il nuovo artifact prima della chiusura dei gate.

## Script e comandi

- `npm run check`: diagnostica Astro/TypeScript.
- `npm run lint`: ESLint.
- `npm run format:check`: conformità Prettier.
- `npm run test`: unit e integration con Vitest.
- `npm run test:e2e`: Playwright; configurazione browser completata nel task successivo.
- `npm run verify`: composizione dei gate locali non-browser.

## API e interfacce

### Feature controller target

- Scopo: lifecycle uniforme delle feature client.
- Interfaccia: `mount(root): { destroy(): void }`.
- Input: root DOM e configurazione tipizzata.
- Output: controller disposable.
- Dipendenze: browser API progressive.
- Esempio: da aggiungere in M2/M4.
- Errori: root o markup incompleto.
- Limitazioni: interfaccia progettata ma non ancora implementata.

### Content repository target

- Scopo: isolare componenti da file/CMS.
- Interfaccia: query tipizzate per collection e ID.
- Input: contenuto locale o adapter remoto.
- Output: modelli validati.
- Dipendenze: Astro content layer.
- Esempio: da aggiungere in M2.
- Errori: schema invalido o entry assente.
- Limitazioni: non gestirà segreti o configurazione blockchain modificabile editorialmente.

## Moduli principali

- Design system: foundations, primitives, composition, components e patterns.
- Features: Home, Docs, Demo, PoC e WebGL.
- Infrastructure: content, blockchain, auth e osservabilità.
- Layouts/pages: composizione statica e routing.

### Foundations CSS

- Import pubblico: `src/design-system/foundations/index.css`.
- Ordine layer: reset, tokens, base, primitives, composition, components, patterns, utilities, overrides.
- I componenti nuovi usano token `--color-*`, `--layout-*` e `--motion-*`; i nomi palette legacy sono primitive di compatibilità.
- Ogni nuova animazione deve degradare tramite il contratto globale `prefers-reduced-motion`.

### Primitive e composition

- `Button` decide semanticamente tra link e button tramite `href`; varianti: primary, secondary, ghost, danger.
- `Badge` espone i toni di stato già presenti nel prodotto.
- `Container`, `Section`, `Stack`, `Cluster` e `Grid` gestiscono soltanto layout e spaziatura responsive.
- Aggiungere un componente solo quando esiste un contratto di semantica, comportamento o riuso; evitare wrapper puramente nominali.

### Componenti e pattern

- Componenti: `Card`, `Metric`, `DataRow`, `Callout`; varianti finite definite nei rispettivi tipi.
- Pattern: `PageHero`, `SectionHeading`, `FinalCta`; accettano contenuto editoriale e slot, non dettagli di stile arbitrari.
- `Icon` contiene soltanto i quattro pittogrammi legacy e richiede un nome tipizzato; senza `label` è decorativa, con `label` diventa immagine accessibile.

### Content repository e CMS

- Le pagine importano `editorialContentRepository` o `protocolEvidenceRepository`, mai JSON sparsi.
- `src/content/schemas.ts` è il contratto condiviso: contenuti fuori schema fermano content sync e build.
- Un CMS futuro implementa soltanto `EditorialContentRepository`; deployment, address e prove tecniche restano nel repository protocol locale/versionato.
- Prima di collegare un CMS definire ruoli, preview, rollback, webhook build e disponibilità del provider; nessun token deve finire nel client.

### Shell e navigazione

- Ogni route usa `BaseLayout` con `title`, `description` e `page`; `page` determina `aria-current`.
- Link e gruppi footer si modificano soltanto in `src/config/site.ts`.
- `SiteHeader` e `SiteFooter` sono server-rendered; `features/navigation.ts` gestisce esclusivamente il menu responsive e restituisce `destroy()`.
- Il build usa formato `file`: una route `src/pages/pages/vaults.astro` produce `pages/vaults.html`.

### Pagina pilota Changelog

- Route: `src/pages/pages/changelog.astro`; output: `dist/pages/changelog.html`.
- Dati: `editorialContentRepository.getChangelog()`; la route non importa il JSON.
- Presentazione di data e tipo: funzione pura `features/changelog/model.ts`, coperta da unit test.
- CSS specifico confinato in `features/changelog/changelog.css`; i pattern generici restano nel design system.

### Pattern editoriali

- `DataTable` fornisce regione etichettata, focusabile e scrollabile da tastiera; il chiamante mantiene markup table nativo.
- `FaqList`/`FaqItem` usano details/summary e funzionano senza JavaScript.
- `StatusLedger`/`StatusLedgerRow` coprono evidence, policy e roadmap con label, valore e stato separati.
- `ComparisonGrid` richiede `ComparisonRow` e `ComparisonCell` per una gerarchia ARIA table valida.
- `Timeline` e `Flow` gestiscono soltanto la relazione visuale; gli item restano Card/articoli espliciti.

### Bridge CSS di migrazione

- `src/styles/legacy/pages.css` e `webgl.css` sono copie hashate, non nuove fonti da modificare.
- Modificare gli originali in `dapp-new/assets/css/`, poi eseguire `npm run sync:legacy`.
- Il bridge serve soltanto a chiudere parità; M6 ne misura e rimuove la parte diventata di proprietà del design system/features.
- Protocol espone controlli HTML semantici che pilotano la scena quando disponibile; `?webgl=off` forza e verifica il fallback CSS.

### Route editoriali migrate

- Product/risk: Vaults, Risk, Trust Center, Security, Protocol.
- Narrative: How it works, Roadmap, Vision, FAQ, Developers, Team.
- FAQ usa details/summary: deve restare fruibile senza client JS.
- Le route con `webglScene` caricano dinamicamente il runtime locale; non introdurre import Three.js da CDN.

### Runtime WebGL

- `src/features/webgl/bootstrap.ts` è l'unico entry point browser; il layout lo importa soltanto quando `data-webgl-scene` è presente.
- `scene-manifest.ts` associa i quattro nomi pubblici a camera, FPS massimo e factory lazy; `quality.ts` governa `off/static/low/medium/high`.
- Per diagnosi usare `?webgl=low`, `?webgl=off` oppure `?webglDebug=1`; reduced motion forza una singola composizione statica.
- Le scene sotto `legacy/` e `visual-kit.js` sono copie hash-verificate: modificare la fonte legacy e usare `npm run sync:legacy`; una riscrittura richiede regressione visuale GPU controllata.
- Ogni nuovo listener, observer, timer o risorsa GPU deve essere rilasciato da `destroy()`/`dispose()`.

### Dominio Demo

- `src/features/demo/domain/catalog.ts` è l'unica fonte del catalogo illustrativo; `engine.ts` contiene solo formule e operazioni, senza DOM.
- `storage.ts` mantiene la compatibilità con `jethos-interactive-demo-v3`; non cambiare chiave o schema senza una migrazione esplicita e testata.
- Gli errori di dominio sono messaggi utente deterministici; la futura view li presenta, non li ridefinisce.
- La route pubblica resta `/demo/index.html`; Astro genera internamente `demo.html` e `scripts/finalize-static-output.mjs` crea l'alias artifact esatto dopo il build.
- `src/features/demo/legacy/` e `src/styles/legacy/demo.css` sono adapter visuali hash-verificati: non modificarli direttamente; usare fonte legacy e `npm run sync:legacy`.
- Eseguire `demo.spec.ts` dopo modifiche a navigazione, dialog, storage o layout; la suite copre entrambi i breakpoint.

### Infrastruttura PoC

- `src/features/app/infrastructure/deployment.ts` è la sola config runtime della PoC; ogni nuovo deployment è un record distinto e validato, non una sovrascrittura editoriale.
- `readers.ts` conserva `ok/value/error` per singolo campo: la UI deve mostrare unavailable/errore e non trasformare failure RPC in `0`.
- `WalletSession.restore()` è passivo; soltanto un gesto utente può chiamare `connect()`. Chiamare `destroy()` nel lifecycle pagina.
- Ethers è locale a versione esatta `6.17.0`; non reintrodurre loader CDN.
- `/app.html` non deve essere provata con fondi reali durante test UI: unit test iniettano read/write context e Playwright usa provider EIP-1193/RPC mock.
- `src/features/app/web3/transactions.ts` è l'unico write boundary: mantenere mutex, preflight, exact approval, estimateGas, receipt status e deadline.
- La UI in `src/features/app/legacy/` è hash-verificata; i componenti pagina SSR sono in `src/components/app/`. Modifiche visuali alla boundary richiedono sync e regression review.

### Catalogo e reader Docs

- `/pages/docs.html` è il catalogo canonico; ricerca e conteggio sono enhancement client.
- Ogni record manifest genera `/pages/docs/NN.html`, leggibile e indicizzabile senza JavaScript; `?doc=NN` apre lo stesso contenuto nel dialog.
- `src/features/docs/controller.ts` carica la route statica e clona soltanto i nodi `data-document-body` e `data-document-toc`; non reintrodurre un parser Markdown runtime o `innerHTML` da fonti.
- I download puntano a `public/content/docs/*.md`, copie hashate generate da `npm run sync:legacy`; modificare sempre la fonte in `dapp-new/content/docs/`.
- Una nuova voce richiede file Markdown, record in `manifest.json`, sync, build e aggiornamento delle aspettative di conteggio nei test.

### Redirect legacy

- I target canonici si modificano nella fonte `dapp-new/*.html`, poi con `npm run sync:legacy`; `src/config/legacy-redirects.json` non va modificato direttamente.
- `src/config/legacy-routing.ts` associa copy e valida target/path; `src/pages/[legacy].astro` genera i quattro file root.
- Ogni redirect deve mantenere meta refresh, canonical e link HTML di fallback allo stesso target; eseguire unit test, build e `routing.spec.ts` dopo ogni variazione.

### Composizione Home

- `src/pages/index.astro` compone dieci sezioni da `src/components/home/`; la route non possiede markup interno di feature.
- Ogni componente di sezione conserva una root/host `data-*` stabile per il controller verticale corrispondente.
- `src/styles/legacy/home-refresh.css` è una copia hashata: modificare la fonte legacy e sincronizzare, non editarla direttamente.
- In F1 i controlli dinamici sono markup server iniziale; ogni controller viene aggiunto con lifecycle `mount/destroy` e test tastiera nelle fasi F2/F3.

### Feature Home semplici

- `src/features/home/bootstrap.ts` scopre esclusivamente le root presenti e combina i controller; non contiene logica di dominio.
- Roadmap, receipt, synthesis e runway vivono ciascuna nella propria directory e non interrogano il documento fuori dalla root ricevuta.
- `src/core/disposable.ts` è il contratto lifecycle condiviso; ogni timer, observer e listener aggiunto da una feature deve essere rilasciato in `destroy()`.
- Reduced motion deve portare direttamente allo stato finale; browser senza IntersectionObserver non devono lasciare contenuti invisibili.

### Strategy Inspector e Architecture Map

- Ogni directory contiene `model.ts`, `view.ts` e `controller.ts`: il model non accede al DOM, la view non possiede stato globale, il controller orchestra root e lifecycle.
- Aggiungere una strategia richiede allocazioni Base/Pro pari al 100%, mechanics, detail copy e unit test del weighted yield.
- Aggiungere chain/asset/risk route richiede aggiornare il catalogo completo e il test di inheritance; non inserire candidate direttamente nella view.
- `core/floating-popover.ts` calcola e applica il placement. Su mobile il popover diventa bottom sheet e deve distinguere focus tastiera da pointer per non intercettare il tap che lo apre.

### Ownership Journey

- `ownership/motion-controller.ts` possiede esclusivamente geometria, RAF, observer e linked focus; ogni nuovo listener/observer/timer va rilasciato in destroy.
- `wallet-allocation.ts` distingue preview hover/focus da selezione click persistente; `aria-pressed` non deve seguire l'hover.
- `vault-model.ts` contiene modalità, chain, token, vault e formule APY illustrative; view/controller non duplicano numeri.
- `vault-controller.ts` implementa tab keyboard secondo il pattern ARIA e usa il side placement condiviso; Escape/close ripristinano il focus al vault di origine.

## Flussi operativi

Durante la migrazione ogni milestone deve chiudere i propri test, aggiornare checklist/log/guida/handover e lasciare legacy e target in stato eseguibile.

## Esempi di utilizzo

Dal package `jethos-web/`, con Node 22.12+:

```powershell
npm ci
npm run check
npm run lint
npm run test
npm run test:e2e
npm run build
```

Durante la migrazione delle fonti:

```powershell
npm run sync:legacy
npm run check:parity
```

Il primo comando aggiorna le copie controllate da `../dapp-new`; il secondo non scrive e fallisce su contenuti mancanti, modificati o inattesi. `npm run verify` include già il controllo di parità.

Sull'host corrente, che espone ancora Node 20.12 globalmente, i CLI possono essere invocati temporaneamente con `npx --yes --package=node@22.23.2 node <percorso-cli>`.

## Errori comuni

- Confondere `dapp-new/` con il nuovo source root.
- Modificare dati deployment dal layer editoriale.
- Collegare un CMS direttamente ai componenti invece di implementare il repository contract.
- Modificare direttamente un file sotto `src/content/data`, `src/content/docs` o `public/assets/brand` durante la migrazione: va cambiata la fonte legacy e rieseguito `sync:legacy`.
- Accettare snapshot senza ispezionare il diff.
- affidarsi al gate client-side come autenticazione.

## Risoluzione dei problemi

Consultare `03_CHECKLIST.md`, poi gli ultimi aggiornamenti di `04_IMPLEMENTATION_LOG.md` e `06_HANDOVER.md`.

## Sicurezza

- Non inserire segreti, token CMS o private key nel client.
- Il gate legacy è soltanto access friction.
- Le diagnostiche live sono read-only.
- Le transazioni restano esplicite e passano dai contratti core.

## Limiti conosciuti

- Hosting finale non specificato: applicare o tradurre `dist/_headers` e usare autenticazione edge per la preview.
- CMS concreto non attivato: usare l'adapter documentato solo quando esiste un workflow editoriale reale.
- App è un PoC privato: RPC e wallet restano fallibili e nessuna transazione live fa parte dei test automatici.
- Il bridge visuale legacy è intenzionale e hash-verificato; rimuoverlo soltanto con una nuova baseline approvata.

## Documentazione operativa finale

- `jethos-web/README.md`: avvio, comandi e mappa del progetto.
- `jethos-web/docs/ARCHITECTURE.md`: confini e regole di modularità.
- `jethos-web/docs/TESTING.md`: suite, visual review e budget.
- `jethos-web/docs/CONTENT_AND_CMS.md`: integrazione CMS incrementale.
- `jethos-web/docs/DEPLOYMENT.md`: release, hosting, cutover e rollback.
