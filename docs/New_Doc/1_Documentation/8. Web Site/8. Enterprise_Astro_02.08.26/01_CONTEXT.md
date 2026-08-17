# Contesto del progetto

## Richiesta

Ricostruire il sito Jethos attualmente in `dapp-new/` come applicazione web statica enterprise, mantenendo parità visiva e funzionale, introducendo Astro, TypeScript, un design system modulare, test automatizzati, una content architecture predisposta per un futuro CMS e documentazione operativa completa. La migrazione deve seguire `Prompt_BIG.md` e non deve interrompere il sito legacy prima della verifica finale.

## Obiettivo generale

Produrre in `jethos-web/` una nuova implementazione statica, tipizzata, componentizzata e testabile di tutte le superfici attive di Jethos. `dapp-new/` resta la baseline eseguibile durante la migrazione. Il cutover potrà avvenire solo dopo parità di URL, contenuti, interazioni, responsive layout, accessibilità e gate operativi.

## Stato attuale

- La ricostruzione in `jethos-web/` è COMPLETATA E VERIFICATA; il legacy resta disponibile come baseline e rollback fino al cutover operativo.
- Il target produce 33 route Astro più l'alias fisico `/demo/index.html`: il contratto di artifact verifica 34 URL obbligatori.
- Installazione pulita e audit risultano verdi con Node 22.23.2: 0 vulnerabilità, 50 unit test e 104 E2E superati; quattro casi visuali mobile duplicati sono skip intenzionali.
- Build, CSP hash-based, security header, budget raw, manifest SHA-256 e CI dedicata fanno parte del gate di release.
- Il sito legacy è operativo in `dapp-new/` e non richiede build.
- Sono presenti 20 HTML attivi: Home, App PoC, Demo, 13 pagine informative e quattro redirect compatibilità.
- La baseline locale supera `validate`, `check:product`, `check:demo`, `check:webgl`, `check:docs` e i quattro smoke test browser.
- `check:content` fallisce per un problema preesistente: include `artifacts/orbit-review/preview.html`, mentre gli artefatti dovrebbero essere esclusi.
- Sono state catturate baseline autenticate di Home, Docs, Demo e App in `dapp-new/artifacts/enterprise-baseline/`.
- Il worktree conteneva modifiche dell'utente non collegate al sito; non devono essere alterate.
- Due modifiche già richieste dall'utente sono presenti in `dapp-new/assets/js/core/reveal.js` e `dapp-new/assets/css/base.css`.
- Nel target sono migrate tutte le pagine editoriali e Docs: il build genera 27 pagine, incluse 13 route documento autonome oltre al catalogo.
- Docs usa Markdown compilato a build-time, fallback HTML server-rendered e un reader client progressivo senza interpretare Markdown runtime.
- I quattro URL root legacy sono generati da una route Astro parametrica e dalla config sincronizzata; canonical, meta refresh e link fallback condividono lo stesso target validato.
- La Home target non è più una fixture: dieci sezioni statiche sono separate per ownership visuale e conservano tutti gli host `data-*` richiesti dalle feature successive.
- Roadmap strip, receipt allocation, financial synthesis e decision runway condividono ora il contratto disposable e sono verificate con mouse, tastiera e reduced motion.
- Strategy Inspector e Architecture Map sono separati in model/view/controller tipizzati; grafici dinamici, pannelli di dettaglio e popover responsive hanno lifecycle e test dedicati.
- Ownership Journey è composta da motion controller, wallet allocation e vault explorer indipendenti; selezione persistente e preview temporanea sono stati distinti semanticamente.
- Le quattro scene WebGL sono attive nel target tramite Three.js `0.185.1` bundled, manifest e quality budget tipizzati; forced-off, reduced motion, controlli HTML e Proof Path sono coperti da test.
- Il dominio Demo è ora TypeScript puro: catalogo 4 asset × 5 reti × 3 profili, formule legacy, operazioni e storage schema v3 mantengono la chiave pubblica e sono verificati indipendentemente dalla UI.
- La Demo completa è disponibile a `/demo/index.html`: shell Astro, CSS e renderer visuale hash-verificati, routing hash, dialog, deposito/crescita/prelievo, persistenza e responsive behavior sono coperti desktop/mobile.
- L'infrastruttura PoC target ora include deployment validato, ABIs locali, ethers bundled `6.17.0`, read/write context, reader con `Result` per campo e timeout, sessione EIP-1193 passiva con lifecycle e test mock.
- `/app.html` è completa: quattro componenti Astro SSR, adapter UI modulare hash-verificato e workflow locali per approve esatto, revoke, deposit e withdraw; test mock coprono safety gate, errori wallet/RPC e responsive accessibility senza write live.

## Architettura esistente

- HTML multipagina statico con ES modules vanilla.
- Shell condivisa generata da `assets/js/core/site-shell.js` usando `site-config.js`.
- CSS globale diviso in token, base, layout, componenti e fogli specializzati.
- Feature editoriali collegate tramite attributi `data-*`.
- Demo browser-only separata dai moduli Web3.
- Console PoC separata in livelli `app/` e `web3/`.
- Document reader basato su manifest e Markdown sincronizzato.
- WebGL2 opzionale con manifest, quality manager, scene factory, fallback e cleanup.
- JSON separati per contenuti editoriali, prodotto e protocollo.
- Script Node senza dipendenze per validazione, diagnostica e smoke browser.

## Stack e dipendenze

### Legacy

- HTML5, CSS custom properties, JavaScript ES modules.
- Ethers caricato dinamicamente da CDN nella console PoC.
- Three.js `0.185.1` caricato da jsDelivr solo sulle quattro pagine con scena.
- Microsoft Edge/Chrome installato per gli smoke test.
- Python usato come server statico locale.

### Target

- Astro con output statico.
- TypeScript strict.
- Componenti Astro server-rendered; Vanilla TypeScript per comportamento client.
- Vitest per unit e contract test.
- Playwright per E2E, accessibilità e regressione visuale.
- Content Collections/adapters per contenuti locali, predisposti per CMS remoto.
- Nessun framework UI client-side nella prima implementazione.

## Moduli coinvolti

- `dapp-new/index.html` e feature homepage.
- `dapp-new/pages/*.html`.
- `dapp-new/demo/` e `assets/js/demo/`.
- `dapp-new/app.html`, `assets/js/app/` e `assets/js/web3/`.
- `assets/js/webgl/` e quattro scene.
- `assets/css/*.css`.
- `data/`, `content/docs/`, `assets/brand/`.
- `scripts/validation/`, `scripts/browser/`, `scripts/diagnostics/`.
- Nuova applicazione `jethos-web/`.

## Comportamento attuale

- Tutte le pagine attive presentano un gate di preview client-side.
- Header e footer sono generati dopo l'autenticazione.
- Home contiene roadmap, journey, receipt, synthesis, strategy inspector e architecture map interattivi.
- Demo conserva stato versionato in `localStorage`, simula deposito, crescita deterministica e prelievo senza Web3.
- App legge il deployment Arbitrum, ripristina il wallet senza richiesta automatica e consente approve esatto, revoke, deposit e withdraw previa conferma.
- Docs carica 13 documenti da manifest, offre ricerca, deep link, indice e download Markdown.
- WebGL è progressive enhancement e rispetta reduced motion, visibilità pagina e capacità dispositivo.

## Problemi individuati

- `pages.css` misura circa 115 KB, contiene 906 regole e mescola pagine, feature e patch responsive.
- `demo/controller.js` misura circa 67 KB; `strategy-inspector.js` circa 31 KB; `ownership-journey.js` circa 24 KB.
- I moduli feature non condividono un lifecycle uniforme.
- Popover, hover/focus synchronization e observer sono duplicati.
- Colori e superfici derivati sono frequentemente hardcoded fuori dai token.
- Le pagine ripetono head, stylesheet, script e strutture editoriali.
- Molti HTML sono su una sola riga e difficili da revisionare.
- Il gate client-side contiene una credenziale e non costituisce autenticazione reale.
- Ethers e Three.js legacy usavano CDN runtime; entrambe sono ora dipendenze locali versionate nel target.
- Mancano type-check, lint, unit test moderni, test visuali versionati e CI web dedicata.
- `check:content` non esclude correttamente `artifacts/`.
- Alcuni dati sono duplicati tra HTML, JSON e configurazione eseguibile.

## Vincoli

- Parità visiva e funzionale prima del cutover.
- URL pubblici e redirect compatibilità invariati.
- Nessuna perdita delle cautele editoriali DeFi.
- Nessuna private key o segreto nel frontend.
- Nessuna transazione automatica o write diretta ai plugin.
- Progressive enhancement, tastiera e reduced motion devono restare supportati.
- Il sito legacy deve restare eseguibile durante la migrazione.
- Le modifiche dell'utente fuori perimetro non devono essere sovrascritte.

## Rischi ed edge case

- Differenze CSS dovute a ordine degli import e scoped CSS Astro.
- Differenze di font/rendering nelle snapshot su host differenti.
- Hydration o client navigation potrebbero alterare focus, hash e dialoghi.
- WebGL può divergere per GPU, driver o timing.
- Wallet non installato, account cambiato, rete errata, RPC offline e transazioni rifiutate.
- Stato Demo legacy incompatibile con un nuovo schema.
- Deep link Docs e download potrebbero rompersi con il routing generato.
- Dati CMS futuri non devono prevalere sui manifest tecnici versionati.
- Una migrazione in-place renderebbe difficile rollback e confronto visuale.

## Assunzioni

- `jethos-web/` sarà il nuovo source root e `jethos-web/dist/` il deploy artifact.
- Astro sarà usato come compilatore statico, non come SPA runtime.
- Il markup legacy può essere preservato inizialmente per ottenere parità, poi consolidato nei componenti senza alterarne l'output.
- Sanity o altro CMS non verrà integrato ora: verrà predisposta un'interfaccia adapter; i contenuti restano in Git finché non esiste un team editoriale.
- Le dipendenze npm saranno installate solo nel nuovo progetto e documentate.

## Aspetti da verificare

- Node.js 22.12+ è richiesto dalla linea Astro 7 corrente; l'host locale espone Node 20.12, quindi le verifiche usano temporaneamente `node@22.23.2` senza modificare il runtime di sistema.
- Possibilità di eliminare il runtime React anche in un futuro preview CMS.
- Approvazione umana del cutover e del dominio/hosting finale; l'implementazione tecnica non effettua pubblicazione esterna.
- Configurazione dell'autenticazione preview presso l'hosting scelto; il client non contiene più credenziali.
- Se l'endpoint RPC cambia, aggiornare deployment config e `connect-src`, quindi rieseguire l'intera suite.
- Responsabili editoriali e necessità reale di un CMS.
