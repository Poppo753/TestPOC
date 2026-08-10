# Log di implementazione

## Stato attuale

COMPLETATO E VERIFICATO — Milestone M1-M6 e 33/33 task chiusi.

## Milestone completate

M1 — Baseline e governo; M2 — foundation; M3 — pagine e Docs; M4 — Home e WebGL; M5 — Demo e App; M6 — regressione, hardening e handover.

## Milestone in corso

Nessuna. Il cutover è una decisione operativa esterna.

## Cronologia delle modifiche

## 2026-08-03 05:20 +02:00 — TASK-M6-F1-001 / F1-002 / F2-001 / F3-001

### Obiettivo

Chiudere regressione globale, hardening, deploy/rollback e documentazione finale.

### Implementazione effettuata

Corretta la precedenza CSS dell'header Astro rispetto al bridge WebGL; aggiunti contratto per 34 route, CSP hash-based, security header, budget raw, manifest SHA-256, CI dedicata e documenti Architecture, Testing, CMS e Deployment. README e sei documenti ufficiali aggiornati all'as-built.

### Test eseguiti

- installazione pulita Node 22.23.2 e audit: zero vulnerabilità;
- parity: 58 file e quattro redirect;
- Astro check: 0 errori, warning e hint; lint e format verdi;
- Vitest: 50/50;
- build: 33 pagine Astro più alias Demo, 34 URL contrattuali e 68 file hashati;
- performance: 1.272.385 B JS raw totali, chunk massimo 735.442 B;
- Playwright: 104 passed, quattro skip visuali mobile intenzionali, zero failure.

### Risultato

Target enterprise completo, verificato e pronto a deploy preview/cutover. Il legacy resta intatto come baseline e rollback fino alla decisione operativa.

### Problemi o limitazioni

L'hosting non è stato scelto né modificato. Il CMS resta predisposto ma non attivato. Rendering GPU, font rasterization e dati RPC live non sono oracle pixel deterministici.

### Prossimo task

Nessuno tecnico; approvazione umana e cutover secondo `jethos-web/docs/DEPLOYMENT.md`.

## 2026-08-03 04:05 +02:00 — TASK-M5-F3-001

### Obiettivo

Migrare App Simple/Advanced e workflow finanziari preservando conferma esplicita e nessun write automatico.

### Implementazione effettuata

La route `/app.html` compone header/stato, workspace, sidebar e conferma come componenti Astro SSR. I moduli UI legacy già separati restano adapter hash-verificati ma importano soltanto bridge TypeScript locali. Transazioni con dipendenze iniettate applicano mutex, preflight contract state/balance/allowance/canWithdraw, estimateGas, deadline e lifecycle receipt.

### Test eseguiti

Astro check/build; 9 unit infrastruttura/workflow; 10 E2E desktop/mobile con wallet e RPC mock; axe; nessun write live.

### Risultati

M5 completa. Tutte le 20 superfici legacy esistono nel target; il build genera 33 route Astro più alias esatto Demo.

### Prossimo task

TASK-M6-F1-001 — chiudere regressione globale.

## 2026-08-03 03:25 +02:00 — TASK-M5-F2-001

### Obiettivo

Migrare in TypeScript deployment, ABI, contesti RPC, reader resilienti e wallet EIP-1193 senza introdurre connessioni automatiche.

### Implementazione effettuata

Il manifest runtime valida checksum e coerenza chain id; ethers è bundled. I reader restituiscono un discriminated result per ogni campo e applicano timeout, preservando il fallback del registro. `WalletSession` riceve provider e signer factory, usa `eth_accounts` nel restore, riserva `eth_requestAccounts` al click esplicito e rilascia listener/subscriber.

### Test eseguiti

Astro check 0/0/0, lint, sei unit mock e audit zero.

### Problemi o limitazioni

La versione ethers legacy `6.13.2` ha prodotto un advisory transitivo `ws` high; sostituita con `6.17.0`, compatibile API e indicata dall'audit come fix.

### Prossimo task

TASK-M5-F3-001 — migrare PoC App UI e workflow.

## 2026-08-03 03:05 +02:00 — TASK-M5-F1-002

### Obiettivo

Portare l'intera esperienza Demo mantenendo URL, visuale, hash routing, dialog e flussi simulati.

### Implementazione effettuata

Creata la route Astro Demo con shell SSR, noindex, footer escluso e asset route-specific. CSS e renderer legacy sono sincronizzati con hash come adapter visuale isolato; il dominio TypeScript resta il riferimento testabile per le formule. Un finalizer deterministico emette `/demo/index.html`, necessario perché Astro `format:file` collassa le route `index` annidate in `demo.html`.

### Test eseguiti

Astro check/build superati; 10 E2E desktop/mobile per route, navigazione, workflow completo, storage, error boundary, focus trap/restoration, filtri Advanced, zero traffico Web3 e axe.

### Risultati

La Demo è funzionalmente e visualmente disponibile sullo stesso URL legacy, senza wallet o richieste esterne.

### Prossimo task

TASK-M5-F2-001 — migrare deployment, readers e wallet.

## 2026-08-03 02:40 +02:00 — TASK-M5-F1-001

### Obiettivo

Separare e tipizzare dominio, catalogo e persistenza della Demo prima del porting UI.

### Implementazione effettuata

Creati contratti TypeScript per asset, reti, profili, vault, posizioni e attività; portate senza variazioni formule, arrotondamento, deposit, crescita e withdraw. Lo storage adapter conserva schema 3 e chiave `jethos-interactive-demo-v3`, valida input e recupera in sicurezza dati assenti/corrotti.

### Test eseguiti

Astro check 0/0/0, lint e 7 unit test Demo superati.

### Risultati

Il dominio Demo non dipende più dal DOM ed è pronto per controller e viste Astro.

### Prossimo task

TASK-M5-F1-002 — migrare Demo UI e routing.

## 2026-08-03 02:25 +02:00 — TASK-M4-F3-001

### Obiettivo

Migrare WebGL runtime e quattro scene senza CDN, preservando visuale, quality budget, fallback e progressive enhancement.

### File modificati

- `jethos-web/src/features/webgl/**`, `BaseLayout.astro` e le tre route con controlli scena;
- manifest npm/lockfile, sync/parity config e test WebGL;
- i sei documenti operativi ufficiali.

### Implementazione effettuata

Three.js `0.185.1` è bundled e lazy-loaded soltanto sulle route con `webglScene`. Manifest, quality detection, controller, interaction bridge, GLB loader opzionale e Proof Path sono TypeScript strict; scene e visual-kit restano copie hash-verificate per parità esatta. Canvas decorativo, fallback CSS, cleanup, offscreen pause e stato ARIA sono preservati.

### Test eseguiti

- parity su 48 fonti, Astro check 0/0/0, lint e build statico a 31 pagine;
- 34 unit test superati;
- 7 E2E WebGL desktop: quattro forced-off, controlli Journey/Protocol, Proof Path con session persistence e reduced motion static;
- audit dipendenze: 0 vulnerabilità.

### Risultati

M4 è completa: Home, tutte le feature DOM e quattro scene sono operative nel target senza dipendenze CDN WebGL.

### Problemi o limitazioni

Il chunk opzionale Three.js supera 500 KB minificato; è isolato dal percorso editoriale e viene caricato soltanto sulle quattro route 3D. Le scene procedurali rimangono JavaScript controllato per evitare drift durante il porting.

### Prossimo task

TASK-M5-F1-001 — migrare Demo domain e storage.

## Aggiornamento — 2026-08-02 22:25 +02:00

### Milestone e fase

M1 — F1 inventario/baseline; F2 documentazione iniziale.

### Task completati

- TASK-M1-F1-001
- TASK-M1-F1-002
- TASK-M1-F1-003
- TASK-M1-F2-001
- TASK-M1-F2-002
- TASK-M1-F2-003

### File creati

- `dapp-new/artifacts/enterprise-baseline/home-desktop.png`
- `dapp-new/artifacts/enterprise-baseline/docs-desktop.png`
- `dapp-new/artifacts/enterprise-baseline/demo-desktop.png`
- `dapp-new/artifacts/enterprise-baseline/app-desktop.png`
- Sei documenti ufficiali nella cartella corrente.

### File modificati

Nessun file applicativo modificato in questa fase.

### File eliminati

Nessuno.

### Implementazione effettuata

Inventario del legacy, lettura della documentazione rilevante, analisi moduli/import/CSS/dati, esecuzione baseline statica e browser, definizione architettura Astro enterprise e roadmap incrementale.

### Motivazioni

La parità richiesta rende necessario un riferimento misurabile prima di modificare il prodotto. La migrazione parallela riduce rischio e consente rollback immediato.

### Test eseguiti

- `npm run validate`: superato, 20 HTML e 9 JSON.
- `npm run check:content`: fallito su artifact HTML preesistente.
- `npm run check:product`: superato.
- `npm run check:demo`: superato, incluso engine.
- `npm run check:webgl`: superato.
- `npm run check:docs`: superato, 13 documenti.
- Auth browser smoke: superato.
- Demo browser smoke: superato.
- Docs browser smoke: superato.
- WebGL browser smoke: superato, quattro scene più forced-off.

### Risultati

Baseline sufficientemente stabile per iniziare il target senza alterare il legacy.

### Problemi o limitazioni

Il content validator legacy non esclude `artifacts/`. Le snapshot visuali complete richiedono ambiente browser deterministico.

### Prossimo task

TASK-M2-F1-001 — creare il package Astro isolato in `jethos-web/`.

## Aggiornamento — 2026-08-02 22:42 +02:00

### Milestone e fase

M2 — F1 setup e configurazione.

### Task completati

- TASK-M2-F1-001

### File creati

- `jethos-web/package.json` e `package-lock.json`
- configurazioni Astro, TypeScript, Vitest, Playwright, ESLint e Prettier
- route foundation e unit smoke test
- `jethos-web/README.md`

### File modificati

- documenti ufficiali 01-06 per DEC-007 e avanzamento M2.

### File eliminati

Nessuno intenzionale; `npm ci` ha rigenerato `node_modules` dal lockfile.

### Implementazione effettuata

Creato package isolato Astro 7 statico con TypeScript strict e toolchain qualità. Aggiunto override `sharp@0.35.0` per chiudere l'advisory transitivo corrente.

### Motivazioni

Astro 7 risolve advisory presenti nella linea 5; Node 22 è il runtime minimo supportato. Le dipendenze sono versionate esattamente per riproducibilità.

### Test eseguiti

- install pulita con Node 22.23.2: superata;
- `npm audit`: zero vulnerabilità;
- Astro check: zero errori, un hint deprecation non bloccante nella config ESLint;
- ESLint: superato;
- Prettier check: superato;
- Vitest: 1/1 superato;
- Astro build: una route statica generata.

### Risultati

Foundation compilabile e isolata dal package Hardhat.

### Problemi o limitazioni

Il Node di sistema è 20.12; i gate locali sono stati invocati con `node@22.23.2`. Il prossimo task deve eliminare l'hint ESLint e completare gli ambienti test.

### Prossimo task

TASK-M2-F1-002 — configurare qualità e ambienti.

## Aggiornamento — 2026-08-02 22:45 +02:00

### Milestone e fase

M2 — F1 setup e configurazione.

### Task completati

- TASK-M2-F1-002

### File creati

- `jethos-web/tests/e2e/foundation.spec.ts`

### File modificati

- `jethos-web/eslint.config.js`
- documenti operativi 03-06

### File eliminati

Nessuno.

### Implementazione effettuata

Chiusa la toolchain qualità con configurazione ESLint corrente, smoke test Playwright su viewport desktop/mobile Edge e scansione axe della route foundation.

### Motivazioni

Il gate browser verifica già dalla foundation sia rendering reale sia regressioni di accessibilità automatizzabili, senza introdurre un framework UI.

### Test eseguiti

- Prettier write/check: superato;
- Astro check: zero errori, warning o hint;
- ESLint: superato;
- Vitest: 2/2 superati;
- Astro build: superato;
- Playwright Edge desktop/mobile con axe: 2/2 superati.

### Risultati

Tutti i comandi qualità indipendenti sono eseguibili e verdi con Node 22.23.2.

### Problemi o limitazioni

L'host corrente mantiene Node 20.12 come runtime di sistema: per i gate target si usa temporaneamente Node 22.23.2 via `npx` finché l'ambiente non viene aggiornato.

### Prossimo task

TASK-M2-F1-003 — portare asset statici e fonti con controllo anti-drift.

## Aggiornamento — 2026-08-02 22:50 +02:00

### Milestone e fase

M2 — F1 setup e configurazione.

### Task completati

- TASK-M2-F1-003

### File creati

- `jethos-web/scripts/sync-legacy-sources.mjs`
- `jethos-web/public/assets/brand/jethos-mark.svg`
- copie controllate in `jethos-web/src/content/data/` e `jethos-web/src/content/docs/`
- `jethos-web/src/content/legacy-manifest.json`
- `jethos-web/src/config/legacy-redirects.json`

### File modificati

- `jethos-web/package.json`
- documenti operativi 03-06

### File eliminati

Nessuno.

### Implementazione effettuata

Creato uno script Node senza dipendenze che sincronizza fonti legacy, genera hash SHA-256 e redirect, e in modalità check confronta byte, inventario e manifest senza scrivere.

### Motivazioni

Durante la migrazione il legacy rimane la baseline funzionale: un gate deterministico impedisce che copie editoriali, dati o brand divergano silenziosamente prima del cutover.

### Test eseguiti

- sync iniziale: 25 file e 4 redirect;
- `check:parity`: superato;
- ESLint: superato;
- Astro check: zero errori, warning o hint;
- Vitest: 2/2 superati;
- Astro build: superato.

### Risultati

Le fonti necessarie alla migrazione sono disponibili localmente nel target con provenienza verificabile.

### Problemi o limitazioni

Il sync è intenzionalmente temporaneo: al cutover M6 `jethos-web` diventerà owner e il contratto con `dapp-new` verrà rimosso in modo esplicito.

### Prossimo task

TASK-M2-F2-001 — implementare foundations CSS preservando i valori visivi legacy.

## Aggiornamento — 2026-08-02 22:55 +02:00

### Milestone e fase

M2 — F2 design system e content layer.

### Task completati

- TASK-M2-F2-001

### File creati

- `jethos-web/src/design-system/foundations/{index,tokens,reset,typography,motion}.css`
- `jethos-web/tests/unit/design-foundations.test.ts`

### File modificati

- `jethos-web/src/pages/index.astro`
- `jethos-web/tests/e2e/foundation.spec.ts`
- documenti operativi 03-06

### File eliminati

Nessuno.

### Implementazione effettuata

Definito l'ordine dei cascade layer e separati reset, token, tipografia e motion. I token legacy sono preservati come primitive; un contratto semantico stabile disaccoppia i componenti futuri dalla palette.

### Motivazioni

La separazione consente parità immediata e futura evoluzione del brand senza cercare valori colore nei componenti. Il contratto reduced-motion è globale e verificabile nel browser.

### Test eseguiti

- parity fonti: superata;
- ESLint e Astro check: superati senza diagnostiche;
- Vitest: 4/4 superati;
- build statica: superata;
- Edge desktop/mobile: 4/4 test superati, inclusi token computati, reduced motion e axe.

### Risultati

Foundation CSS pronta per primitives e composition, senza variazioni intenzionali ai valori visivi legacy.

### Problemi o limitazioni

Inter resta nello stack legacy ma non è ancora self-hosted: senza una risorsa font il browser usa il fallback di sistema, come nel sito attuale.

### Prossimo task

TASK-M2-F2-002 — implementare primitives e composition riusabili.

## Aggiornamento — 2026-08-02 23:00 +02:00

### Milestone e fase

M2 — F2 design system e content layer.

### Task completati

- TASK-M2-F2-002

### File creati

- primitive Astro in `jethos-web/src/design-system/primitives/`
- composition Astro in `jethos-web/src/design-system/composition/`
- stylesheet e entrypoint del design system

### File modificati

- `jethos-web/src/pages/index.astro`
- `jethos-web/.prettierignore`
- documenti operativi 03-06

### File eliminati

Nessuno.

### Implementazione effettuata

Introdotte primitive tipizzate per azioni, badge e contenuto accessibile, più composizioni responsive per container, sezione, stack, cluster e griglia. La fixture target le renderizza realmente.

### Motivazioni

Il confine di componente segue responsabilità e riuso, non la tassonomia atomica in modo dogmatico: gli elementi con API/semantica stabile sono componenti; il markup monouso resta markup.

### Test eseguiti

- parity e Prettier: superati;
- ESLint e Astro check: superati senza diagnostiche;
- Vitest: 4/4 superati;
- build statica: superata;
- Edge desktop/mobile + axe: 4/4 superati.

### Risultati

Le prossime pagine possono essere composte con API uniformi mantenendo class names e valori visuali legacy.

### Problemi o limitazioni

La formattazione delle fonti sincronizzate è esclusa intenzionalmente da Prettier: devono restare byte-identiche alla baseline finché il target non ne assume l'ownership.

### Prossimo task

TASK-M2-F2-003 — implementare componenti e pattern condivisi.

## Aggiornamento — 2026-08-02 23:05 +02:00

### Milestone e fase

M2 — F2 design system e content layer.

### Task completati

- TASK-M2-F2-003

### File creati

- `jethos-web/src/design-system/components/` con Card, Metric, DataRow e Callout
- `jethos-web/src/design-system/patterns/` con PageHero, SectionHeading e FinalCta
- primitive Icon e composition Split previste dal catalogo

### File modificati

- entrypoint design system e fixture `src/pages/index.astro`
- documenti operativi 03-06

### File eliminati

Nessuno.

### Implementazione effettuata

Estratti esclusivamente i blocchi ripetuti misurati nel legacy, mantenendo classi e dimensioni visuali. Le API espongono varianti finite e slot contenuto, non proprietà equivalenti a CSS inline.

### Motivazioni

Componenti con confini espliciti riducono la duplicazione delle 14 pagine senza introdurre una gerarchia atoms/molecules rigida o un runtime client non necessario.

### Test eseguiti

- parity fonti, lint e Astro check: superati;
- Vitest: 4/4 superati;
- build statica: superata;
- fixture Edge desktop/mobile + axe: 4/4 superati.

### Risultati

Catalogo base completo per shell e prime pagine editoriali.

### Problemi o limitazioni

I pattern specifici Home, Demo e PoC restano fuori dal design system condiviso finché la migrazione non dimostra riuso reale.

### Prossimo task

TASK-M2-F2-004 — implementare repository contenuti tipizzato e validazione fail-fast.

## Aggiornamento — 2026-08-02 23:10 +02:00

### Milestone e fase

M2 — F2 design system e content layer.

### Task completati

- TASK-M2-F2-004

### File creati

- `jethos-web/src/content.config.ts`
- `jethos-web/src/content/schemas.ts`
- `jethos-web/src/content/repository-contract.ts`
- `jethos-web/src/content/local-repository.ts`
- `jethos-web/tests/unit/content-schemas.test.ts`

### File modificati

- fixture `jethos-web/src/pages/index.astro`
- documenti operativi 03-06

### File eliminati

Nessuno.

### Implementazione effettuata

Registrate 11 collection Astro: dieci singleton JSON e la collection Markdown. Schemi Zod strict validano date, stati, profili, indirizzi EVM e strutture annidate. Repository editorial e protocol sono interfacce separate.

### Motivazioni

Un CMS futuro può sostituire l'adapter editoriale senza dare accesso a deployment, address o trust evidence tecnica. Gli errori contenuto fermano sync/build prima del rendering.

### Test eseguiti

- content sync Astro: superato;
- 10 fonti reali validate;
- fixture vault incompleta e address malformati correttamente rifiutate;
- Astro check: zero diagnostiche;
- Vitest: 16/16 superati;
- build con lettura effettiva dal repository: superata.

### Risultati

Content boundary tipizzato, CMS-ready e indipendente dai componenti visuali.

### Problemi o limitazioni

Nessun CMS remoto è configurato: è intenzionale finché workflow editoriale, ruoli e hosting non sono scelti. Il provider locale resta la fonte di verità della migrazione.

### Prossimo task

TASK-M2-F3-001 — implementare BaseLayout, header e footer.

## Aggiornamento — 2026-08-02 23:20 +02:00

### Milestone e fase

M2 — F3 shell e pagina pilota.

### Task completati

- TASK-M2-F3-001

### File creati

- `jethos-web/src/layouts/BaseLayout.astro`
- `jethos-web/src/components/{BrandLink,SiteHeader,SiteFooter}.astro`
- `jethos-web/src/config/site.ts`
- `jethos-web/src/features/navigation.ts`
- `jethos-web/src/styles/site-shell.css`

### File modificati

- `jethos-web/astro.config.mjs`
- fixture Home e smoke E2E
- documenti operativi 03-06

### File eliminati

Nessuno.

### Implementazione effettuata

Portata la shell da generazione DOM runtime a HTML statico Astro con una sola config tipizzata. Il solo comportamento mobile usa un controller disposable. Aggiunto build format `file` per mantenere i path legacy `.html`.

### Motivazioni

Header e footer sono ora presenti senza JavaScript, indicizzabili e privi di flash; il client bundle copre soltanto apertura/chiusura del menu.

### Test eseguiti

- parity, lint, Astro check, 16 unit e build: superati;
- Playwright/axe desktop e mobile: 6/6 superati;
- menu mobile: open/close label, Escape e focus verificati;
- stato pagina corrente e footer verificati.

### Risultati

Shell condivisa pronta per tutte le route con URL legacy compatibili.

### Problemi o limitazioni

Il primo test mobile cercava un link nascosto tramite accessibility tree e poi un toggle il cui nome era cambiato: i locator sono stati corretti su stato DOM stabile. Nessun difetto runtime rilevato. La preview auth verrà affidata all'hosting, non reintrodotta come password nel client.

### Prossimo task

TASK-M2-F3-002 — migrare Changelog come pagina editoriale pilota.

## Aggiornamento — 2026-08-02 23:25 +02:00

### Milestone e fase

M2 — F3 shell e pagina pilota. Milestone completata.

### Task completati

- TASK-M2-F3-002

### File creati

- route `jethos-web/src/pages/pages/changelog.astro`
- feature `jethos-web/src/features/changelog/`
- test unit e browser Changelog
- componente condiviso `SourceLabel.astro`

### File modificati

- stylesheet componenti e documenti operativi 03-06

### File eliminati

Nessuno.

### Implementazione effettuata

Migrata la prima route editoriale completa. La pagina legge il repository, converte data e tipo con un view model puro, compone design system/shell e genera esattamente `pages/changelog.html`.

### Motivazioni

La verticale pilota dimostra build URL-compatible e data-driven prima della migrazione in serie, riducendo il rischio di replicare errori su tutte le pagine.

### Test eseguiti

- parity, lint, Astro check e build: superati;
- Vitest: 17/17 superati;
- output `dist/pages/changelog.html` verificato;
- Playwright/axe desktop e mobile: 8/8 superati.

### Risultati

M2 completata: foundation enterprise e prima route reale operative.

### Problemi o limitazioni

Il JSON canonico contiene formulazioni leggermente più estese del markup legacy; struttura, gerarchia e styling restano equivalenti. La fonte unica elimina la duplicazione futura.

### Prossimo task

TASK-M3-F1-001 — estrarre i pattern editoriali restanti da uso misurato.

## Aggiornamento — 2026-08-02 23:35 +02:00

### Milestone e fase

M3 — F1 pattern editoriali e migrazione.

### Task completati

- TASK-M3-F1-001

### File creati

- pattern DataTable, FAQ, StatusLedger, ComparisonGrid, Timeline e Flow
- `jethos-web/src/design-system/patterns/editorial.css`
- catalogue temporaneo `DesignSystemCatalogue.astro`

### File modificati

- composition Section con variante band
- entrypoint design system e fixture Home
- documenti operativi 03-06

### File eliminati

Nessuno.

### Implementazione effettuata

Estratti pattern solo dopo conteggio delle ricorrenze sulle 13 pagine legacy. Il catalogue temporaneo li rende insieme in viewport desktop/mobile per typecheck, visual inspection e axe.

### Motivazioni

Le API rappresentano responsabilità autonome: overflow tabella accessibile, disclosure FAQ nativa, righe label/value/status, confronto tabellare, sequenza temporale e flusso.

### Test eseguiti

- parity, lint, Astro check, 17 unit e build: superati;
- catalogue desktop/mobile con axe: superato;
- suite Playwright complessiva: 8/8 superata dopo correzione ARIA Flow.

### Risultati

Pattern sufficienti per migrare le 11 pagine editoriali residue senza copiare strutture ricorrenti.

### Problemi o limitazioni

Il primo catalogue dichiarava Flow come `role=list` con article non marcati listitem; axe lo ha bloccato. Flow è correttamente un gruppo etichettato perché gli step sono articoli autonomi.

### Prossimo task

TASK-M3-F2-001 — migrare Vaults, Risk, Trust, Security e Protocol.

## Aggiornamento — 2026-08-02 23:50 +02:00

### Milestone e fase

M3 — F2 migrazione pagine editoriali.

### Task completati

- TASK-M3-F2-001

### File creati

- route Astro Vaults, Risk & transparency, Trust Center, Security e Protocol
- `jethos-web/src/core/format.ts`
- test browser `product-pages.spec.ts`
- bridge controllati `src/styles/legacy/pages.css` e `webgl.css`

### File modificati

- sync/parity script, BaseLayout e prettier ignore
- documenti operativi 03-06

### File eliminati

Nessuno.

### Implementazione effettuata

Convertite cinque pagine con componenti semantici, path `.html` invariati e fonti repository per vault, policy, deployment, trust e protocolli. CSS visuale specifico preservato temporaneamente byte-per-byte.

### Motivazioni

Il bridge CSS separa il rischio di markup/dati dal successivo ownership cleanup e rende ogni futura rimozione misurabile tramite screenshot, in accordo con DEC-006.

### Test eseguiti

- sync/parity su 27 fonti: superato;
- lint, Astro check, 17 unit e build a 7 route: superati;
- route/heading/footer/axe desktop e mobile: superati per tutte le cinque pagine;
- suite product-pages: 12/12 superata.

### Risultati

Gruppo prodotto/rischio migrato con provenance e claim preservati.

### Problemi o limitazioni

Protocol mostra intenzionalmente il fallback statico con controlli disabilitati finché il runtime WebGL non viene migrato in M4. Due test evidence hanno richiesto locator più specifici; nessun difetto pagina.

### Prossimo task

TASK-M3-F2-002 — migrare How it works, Roadmap, Vision, FAQ, Developers e Team.

## Aggiornamento — 2026-08-03 00:05 +02:00

### Milestone e fase

M3 — F2 migrazione pagine editoriali.

### Task completati

- TASK-M3-F2-002

### File creati

- sei route Astro narrative
- `jethos-web/src/features/vision/vision.css`
- test browser `narrative-pages.spec.ts`

### File modificati

- documenti operativi 03-06

### File eliminati

Nessuno.

### Implementazione effettuata

Migrati percorsi, contenuti, comparison, FAQ, flow, timeline, dashboard concettuale, indirizzi developer e disclosure Team. Roadmap e Developers leggono le fonti tipizzate.

### Motivazioni

Le route mantengono server-render fallback e contenuto completo senza dipendere da JavaScript; le interazioni native, come FAQ, restano operative prima dell'enhancement.

### Test eseguiti

- parity, lint, Astro check, 17 unit e build a 13 route: superati;
- sei route su Edge desktop/mobile con axe: superate;
- conteggi journey 5, timeline 4, FAQ 20 e address repository verificati;
- suite narrative: 14/14 superata.

### Risultati

Tutte le pagine informative eccetto Docs sono migrate e accessibili agli URL legacy.

### Problemi o limitazioni

How it works, Roadmap e Protocol mantengono host e fallback ma non inizializzano ancora WebGL. Roadmap Proof Path espone il record HTML completo; il gioco client verrà portato con le feature M4.

### Prossimo task

TASK-M3-F3-001 — migrare catalogo e reader documentazione.

## Aggiornamento — 2026-08-03 00:20 +02:00

### Milestone e fase

M3 — F3 Docs e compatibilità route.

### Task completati

- TASK-M3-F3-001

### File creati

- route catalogo `src/pages/pages/docs.astro`
- route statica parametrica `src/pages/pages/docs/[id].astro`
- feature Docs `src/features/docs/model.ts` e `controller.ts`
- test unit `docs-model.test.ts` e browser `docs.spec.ts`

### File modificati

- content collection documenti, sync/parity, ignore Prettier e documenti operativi 01-06

### File eliminati

Nessuno.

### Implementazione effettuata

Il manifest genera catalogo e 13 pagine documento. Astro compila Markdown e TOC a build-time; il controller filtra il catalogo e apre nel dialog il DOM della route statica, mantenendo query `?doc=NN`, hash, history, download e fallback diretto.

### Motivazioni

Il modello progressive enhancement conserva UX legacy ma rimuove il parser Markdown runtime dal confine di sicurezza. Le fonti pubbliche sono copie hashate per download; il contenuto leggibile proviene sempre dall'output Astro validato.

### Test eseguiti

- parity su 42 file, Astro check 0 errori/warning/hint, lint e build a 27 pagine: superati;
- Vitest: 20/20 superati;
- Playwright Docs desktop/mobile: 4/4 superati;
- axe su pagina documento e dialog aperto: nessuna violazione WCAG A/AA.

### Risultati

RF-007 è coperto con contenuto completo no-JS e reader progressivo accessibile.

### Problemi o limitazioni

Il CSS Docs resta un bridge legacy hashato fino alla razionalizzazione M6. I test hanno rilevato e fatto correggere doppio H1 e regione scroll non focusabile.

### Prossimo task

TASK-M3-F3-002 — implementare redirect e route compatibility.

## Aggiornamento — 2026-08-03 00:30 +02:00

### Milestone e fase

M3 — F3 Docs e compatibilità route, completata.

### Task completati

- TASK-M3-F3-002

### File creati

- `src/config/legacy-routing.ts`
- `src/layouts/RedirectLayout.astro`
- route parametrica `src/pages/[legacy].astro`
- test unit e browser routing

### File modificati

- documenti operativi 01-06

### File eliminati

Nessuno.

### Implementazione effettuata

I quattro redirect legacy vengono generati dalla config hashata. Una validazione pura ammette soltanto target interni e path root `.html`; il layout emette meta refresh, canonical e link fallback dalla medesima struttura dati.

### Motivazioni

Un'unica fonte evita divergenza tra URL, SEO e fallback e conserva output interamente statico senza dipendere da regole specifiche dell'hosting.

### Test eseguiti

- Astro check 0/0/0, lint, 22 unit e build a 31 pagine: superati;
- Playwright redirect desktop/mobile: 10/10 superati, inclusa ispezione HTML di canonical e fallback.

### Risultati

M3 completata: sito editoriale, Docs e compatibilità URL sono operativi nel target.

### Problemi o limitazioni

`portfolio.html` punta correttamente ad `/app.html`, che verrà migrata in M5; fino ad allora il target dev server restituisce la route solo quando la console sarà presente.

### Prossimo task

TASK-M4-F1-001 — migrare markup statico homepage.

## Aggiornamento — 2026-08-03 00:45 +02:00

### Milestone e fase

M4 — F1 markup statico Home.

### Task completati

- TASK-M4-F1-001

### File creati

- dieci componenti `src/components/home/*.astro`
- test browser `home-static.spec.ts`

### File modificati

- route `src/pages/index.astro`
- sync/parity per `home-refresh.css`
- documenti operativi 01-06

### File eliminati

- fixture design-system dalla route Home; il catalogue component resta disponibile per test/sviluppo

### Implementazione effettuata

Le dieci sezioni top-level legacy sono state migrate in componenti Astro separati: hero, horizons, ownership, receipt, decision, synthesis, inspector, architecture, current product e final CTA. BaseLayout possiede shell e metadata; gli host delle feature restano invariati.

### Motivazioni

La separazione per sezione limita il dominio di ogni diff e permette ai controller M4-F2/F3 di montarsi su root autonome senza riscrivere la composizione visuale.

### Test eseguiti

- parity su 43 file, Astro check 0/0/0, lint e build a 31 pagine: superati;
- Home content/DOM e axe desktop/mobile: superati;
- screenshot full-page desktop/mobile catturati e confrontati con la baseline.

### Risultati

Home statica completa e visivamente allineata; contenuti, responsive e dieci boundary di sezione sono pronti per i controller.

### Problemi o limitazioni

Synthesis e altri stati dinamici mostrano per ora lo stato server iniziale; la parità degli stati attivi viene chiusa con i controller. Axe ha rilevato SVG `role=img` con figli interattivi e label su div senza ruolo: corretti come group/img nel target.

### Prossimo task

TASK-M4-F2-001 — migrare feature homepage semplici.

## Aggiornamento — 2026-08-03 01:00 +02:00

### Milestone e fase

M4 — F2 feature Home.

### Task completati

- TASK-M4-F2-001

### File creati

- controller verticali roadmap-strip, receipt-allocation, financial-synthesis e decision-runway
- `src/features/home/bootstrap.ts`
- `src/core/disposable.ts`
- unit model ed E2E feature Home

### File modificati

- Navigation e Docs adottano il tipo disposable condiviso
- route Home monta e smonta il bootstrap su `pagehide`
- documenti operativi 01-06

### File eliminati

Nessuno.

### Implementazione effettuata

Ogni feature espone `mount(root)` e restituisce `destroy()`. Event listener usano AbortController, observer e timer vengono disconnessi, modelli finiti sono tipizzati e il bootstrap possiede soltanto discovery/composizione.

### Motivazioni

La separazione elimina auto-bootstrap ed effetti globali dei moduli legacy e rende ogni behavior montabile, testabile e smontabile indipendentemente.

### Test eseguiti

- Astro check 0/0/0, lint e 25 unit: superati;
- Home static + quattro feature: 10/10 Playwright desktop/mobile;
- tastiera, focus restoration, aria-pressed, hover/focus sync e reduced motion verificati.

### Risultati

Quattro delle feature Home sono migrate senza runtime framework e con cleanup esplicito.

### Problemi o limitazioni

Il ritardo hover di 900 ms della roadmap è preservato per parità; il click resta il percorso deterministico per touch e tastiera.

### Prossimo task

TASK-M4-F2-002 — migrare Strategy Inspector e Architecture Map.

## Aggiornamento — 2026-08-03 01:20 +02:00

### Milestone e fase

M4 — F2 feature Home complesse.

### Task completati

- TASK-M4-F2-002

### File creati

- vertical slice model/view/controller di Strategy Inspector e Architecture Map
- `src/core/floating-popover.ts`
- unit model/geometria ed E2E widget complessi

### File modificati

- bootstrap Home e documenti operativi 01-06

### File eliminati

Nessuno.

### Implementazione effettuata

Inspector renderizza tre strategie, grafici, route, formule e pannelli Base/Pro/Advanced da un modello tipizzato. Architecture separa Today/Direction, inheritance dei tre risk tier, accordion chain e bottom sheet/popover ancorato. Tutti gli eventi e nodi dinamici vengono rilasciati.

### Motivazioni

La separazione impedisce che cataloghi finanziari, DOM builder e stato UI ricadano in un controller monolitico e rende formule/routing verificabili senza browser.

### Test eseguiti

- Astro check 0/0/0, lint, 28 unit e build a 31 pagine: superati;
- Strategy/Architecture E2E desktop/mobile: 4/4 superati;
- axe con popover e grafici dinamici: nessuna violazione.

### Risultati

I due maggiori controller legacy sono portati in vertical slice TypeScript senza framework client.

### Problemi o limitazioni

Il test mobile ha rilevato che l'apertura su `focus` poteva sovrapporre il bottom sheet prima del completamento del tap. Il controller distingue ora apertura pointer da keyboard e preserva correttamente il pin.

### Prossimo task

TASK-M4-F2-003 — migrare Ownership Journey.

## Aggiornamento — 2026-08-03 01:40 +02:00

### Milestone e fase

M4 — F2 Ownership Journey.

### Task completati

- TASK-M4-F2-003

### File creati

- Ownership motion controller
- wallet allocation controller
- vault model/view/controller
- unit Ownership ed E2E journey

### File modificati

- bootstrap Home, popover geometry e documenti operativi 01-06

### File eliminati

Nessuno.

### Implementazione effettuata

Motion desktop calcola il percorso con RAF e geometria reale; compact assembly usa observer; reduced motion ripulisce le trasformazioni. Wallet e vault explorer gestiscono selezione, tabs, filtri, APY illustrativi, grafico, bottom sheet e focus restoration in controller separati.

### Motivazioni

Tre responsabilità con frequenze e rischi diversi non condividono più un modulo da circa 500 righe. Il modello dei vault e il placement sono testabili senza DOM.

### Test eseguiti

- Astro check 0/0/0, lint e 31 unit: superati;
- suite Home integrata: 18/18 desktop/mobile;
- desktop end-state, compact observer, reduced motion, tabs keyboard, popover e axe verificati.

### Risultati

Tutte le feature DOM Home sono migrate; resta soltanto il progressive enhancement WebGL.

### Problemi o limitazioni

Il test ha evidenziato che il legacy usava lo stesso stato per hover e click del wallet: un click dopo pointerenter deselezionava. Preview e selezione persistente sono ora distinte, con `aria-pressed` legato solo alla seconda.

### Prossimo task

TASK-M4-F3-001 — migrare WebGL runtime e scene.

## Decisioni prese durante lo sviluppo

- Nuovo source root `jethos-web/` parallelo a `dapp-new/`.
- Astro statico e TypeScript; niente framework UI client di default.
- CMS dietro adapter, non integrato prematuramente.
- Dati blockchain critici esclusi dal CMS editoriale.

## Problemi incontrati

- `check:content` legacy scansiona artefatti.
- Il primo tentativo di CDP browser usava il browser target sbagliato; corretto creando e collegando un Page target.

## Deviazioni dalla roadmap

Durante TASK-M2-F1-001 il primo tentativo ha usato Astro 5.18.2 per compatibilità con Node 20.12. `npm audit` ha rilevato advisory high la cui correzione richiede Astro 7. La decisione è stata fermata e sostituita da DEC-007 prima di proseguire: Node 22.12+ e Astro 7.1.6.

## Test eseguiti

Registrati nell'aggiornamento cronologico.

## Problemi noti

- Preview auth legacy non è sicurezza reale.
- CSS e controller legacy di grandi dimensioni.
- Dipendenze runtime CDN.

## Attività aperte

Portare nel target brand, documenti e dati legacy con inventario/hash verificabile prima di costruire il design system.
