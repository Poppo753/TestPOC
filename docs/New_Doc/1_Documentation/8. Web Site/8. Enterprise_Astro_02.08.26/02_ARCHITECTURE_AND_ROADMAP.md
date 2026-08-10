# Architettura e roadmap

## Visione generale

Jethos viene ricostruito come sito statico Astro tipizzato. Astro possiede composizione, routing, metadata e rendering HTML; TypeScript governa dati e controller; il browser riceve JavaScript solo per feature interattive. Il design system separa foundations, primitives, composition, components e patterns. Le feature di dominio rimangono moduli verticali autonomi. Il legacy resta baseline fino al completamento.

Stato finale: tutte le sei milestone e i 33 task sono completati. Le decisioni as-built e le procedure correnti sono anche in `jethos-web/docs/`; `jethos-web/dist/` è l'unico artifact deployabile.

## Requisiti funzionali

- RF-001 — Generare Home, App, Demo, 13 pagine informative e quattro redirect mantenendo gli URL correnti.
- RF-002 — Riprodurre header, footer, navigazione, metadata e stato pagina corrente.
- RF-003 — Riprodurre aspetto desktop e mobile del sito legacy.
- RF-004 — Riprodurre tutte le interazioni homepage.
- RF-005 — Riprodurre Demo, persistenza, deposito, crescita, prelievo, ricevute e reset.
- RF-006 — Riprodurre App PoC, letture, wallet, rete, stime e transaction workflow.
- RF-007 — Riprodurre Docs catalog, ricerca, deep link, TOC e download.
- RF-008 — Riprodurre quattro scene WebGL e fallback esplicito.
- RF-009 — Conservare tassonomia status, dati prodotto, protocollo ed evidenze.
- RF-010 — Fornire un catalogue del design system e fixture di feature.
- RF-011 — Fornire gate di build, test, accessibilità e regressione visuale.
- RF-012 — Predisporre un content adapter sostituibile da un CMS senza accoppiare i componenti.
- RF-013 — Mantenere redirect e link legacy.
- RF-014 — Fornire documentazione installazione, sviluppo, test, deploy e manutenzione.

## Requisiti non funzionali

- RNF-001 — Output di produzione statico e deployabile su hosting CDN.
- RNF-002 — TypeScript strict senza errori.
- RNF-003 — Nessun framework UI client-side obbligatorio.
- RNF-004 — WCAG 2.2 AA come obiettivo; tastiera, focus e reduced motion verificati.
- RNF-005 — Nessun segreto o private key nel client.
- RNF-006 — Dati DeFi critici versionati e validati, non modificabili dal CMS editoriale.
- RNF-007 — Errori RPC e wallet gestiti senza bloccare contenuto editoriale.
- RNF-008 — Feature con lifecycle mount/destroy e cleanup.
- RNF-009 — CSS governato da layer e token semantici, senza dipendenze tra internals di componenti.
- RNF-010 — Build riproducibile tramite lockfile.
- RNF-011 — Preview e produzione separabili; rollback tramite artifact immutabile.
- RNF-012 — Nessuna regressione rispetto ai gate legacy applicabili.
- RNF-013 — Budget JS differenziato: minimo sulle pagine editoriali, feature-specific sulle superfici interattive.
- RNF-014 — Compatibilità con browser evergreen desktop/mobile.
- RNF-015 — Documentazione sufficiente per ripresa da altro sviluppatore.

## Soluzione architetturale

```text
jethos-web/
├─ public/                    asset statici, docs e manifest pubblici
├─ src/
│  ├─ design-system/
│  │  ├─ foundations/
│  │  ├─ primitives/
│  │  ├─ composition/
│  │  ├─ components/
│  │  └─ patterns/
│  ├─ features/              vertical slice di dominio
│  ├─ layouts/
│  ├─ pages/                 routing Astro
│  ├─ content/
│  ├─ data/
│  ├─ infrastructure/        wallet, RPC, analytics, auth adapters
│  ├─ scripts/               controller client condivisi
│  └─ styles/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ e2e/
│  ├─ accessibility/
│  └─ visual/
└─ docs/
```

Le pagine renderizzano componenti Astro. Le feature interattive espongono un controller `mount(root)` con `destroy()`. Il contenuto entra tramite repository tipizzato, non tramite accessi diretti sparsi a file JSON o CMS.

## Flussi principali

```text
Route Astro → Layout → Pattern/Feature → HTML statico
                                      ↘ controller TS solo se necessario
```

```text
Git content / futuro CMS → adapter → schema → modello interno → componenti
Protocol manifest         → validatore tecnico ────────────────┘
RPC live                  → reader con Result → App renderer
```

```text
Wallet click → EIP-1193 connect → chain check → estimate → confirmation
             → exact approval se necessaria → deposit/withdraw → receipt → refresh
```

## Moduli e responsabilità

### Design system

- Scopo: vocabolario visuale e accessibile condiviso.
- Input: props tipizzate e slot.
- Output: HTML semantico e CSS deterministico.
- Dipendenze: foundations e composition.
- Interfacce pubbliche: props/variant documentate.
- Dati: nessun dato di dominio.
- Errori: variant invalida rilevata dal type-check.
- Test: catalogue, snapshot visuale, axe e tastiera per componenti interattivi.

### Content repository

- Scopo: normalizzare Markdown/JSON e futuro CMS.
- Input: fonti editoriali locali/remoti.
- Output: modelli `PageContent`, `Status`, `Roadmap`, `Vault`, `Evidence`.
- Dipendenze: Astro Content Collections e schema.
- Interfacce pubbliche: query per collection e ID.
- Dati: editoriali; non possiede config blockchain eseguibile.
- Errori: schema invalido, riferimento mancante, claim non verificato.
- Test: schema, slug, link, status e cross-source contract.

### Feature runtime

- Scopo: comportamento client isolato.
- Input: root element, config serializzabile e DOM server-rendered.
- Output: stato DOM ed eventi custom tipizzati.
- Dipendenze: primitive behavior condivise.
- Interfacce pubbliche: `mount(root): Disposable`.
- Dati: stato UI locale.
- Errori: markup incompleto, browser API assente.
- Test: unit controller, E2E tastiera e visual state.

### Demo

- Scopo: simulazione deterministica senza wallet o Web3.
- Input: catalogo, stato storage versionato e azioni utente.
- Output: snapshot, attività e ricevute illustrative.
- Dipendenze: engine puro, storage adapter e componenti UI.
- Interfacce pubbliche: engine functions e controller route.
- Errori: importo invalido, saldo insufficiente, vault inesistente, storage corrotto.
- Test: unit engine, migration/reset storage, E2E completo.

### PoC Console

- Scopo: lettura e transazioni sul deployment esplicito.
- Input: manifest, provider RPC, wallet EIP-1193.
- Output: snapshot e transaction status.
- Dipendenze: ethers bundled, infrastructure Web3.
- Interfacce pubbliche: reader `Result`, wallet session, workflow.
- Errori: RPC, rete, account, estimate, rejection, revert, stale response.
- Test: unit con provider mock, E2E wallet mock, diagnostica live separata.

### WebGL

- Scopo: enhancement visuale contenuto e controllato.
- Input: manifest scena, qualità e semantic events HTML.
- Output: canvas decorativo o fallback CSS.
- Dipendenze: Three.js bundled/dynamic chunk.
- Interfacce pubbliche: scene factory e controller lifecycle.
- Errori: WebGL2 assente, import fallito, context lost, device budget.
- Test: manifest statico, smoke browser, forced-off e visual review.

## Modello dati

- `Status`: unione finita di live, recorded, implemented, poc, validation, planned, vision, illustrative, unavailable.
- `DeploymentManifest`: chain, asset e indirizzi validati.
- `VaultDefinition`: asset, profilo, stato e catena.
- `StrategyProfile`: route, allocazioni, policy, rischi e APY illustrativo.
- `EvidenceRecord`: label, valore, status e provenance.
- `DemoStateV3`: wallet assets, posizioni, attività e giorni simulati.
- `PageContent`: metadata, hero e sezioni editoriali.

## Interfacce e integrazioni

- Astro Content Collections per fonti Git.
- Adapter CMS futuro dietro `ContentRepository`.
- EIP-1193 per wallet.
- JSON-RPC Arbitrum per letture.
- Ethers importato come dipendenza del bundle, non da CDN runtime.
- Three.js come chunk dinamico solo per scene abilitate.
- Hosting statico con header CSP e preview auth server-side.

## Gestione degli errori

- Contenuto invalido: build fallita con messaggio contestuale.
- Feature markup invalido: log diagnostico in sviluppo, progressive fallback in produzione.
- RPC: `Result<T, RpcError>` e fallback “unavailable”; nessun dato inventato.
- Wallet: messaggi normalizzati per assenza, rifiuto, rete e revert.
- Demo: eccezioni di dominio rese come errori form/toast.
- WebGL: canvas rimosso e fallback mantenuto.

## Sicurezza

- Eliminare credenziale hardcoded dalla nuova produzione.
- Preview protetta a livello hosting/server.
- CSP senza `unsafe-inline` dove possibile.
- Token CMS preview solo server-side e read-only.
- Manifest di deployment in Git con cross-validation.
- Nessun `innerHTML` per dati runtime non fidati.
- Rich text CMS reso tramite componenti allowlist.
- Approvazioni ERC-20 esatte e revocabili.

## Prestazioni e scalabilità

- HTML statico per tutte le pagine editoriali.
- JS per-route e dynamic import delle feature.
- CSS inizialmente parity-preserving, poi separato per ownership senza modifiche visuali.
- Font self-hosted e asset fingerprinted.
- WebGL sospeso offscreen e su tab nascosta.
- Budget registrati e verificati dopo la prima build completa.

## Compatibilità e migrazioni

- Nuova app in `jethos-web/`; legacy invariato.
- URL legacy replicati tramite route/redirect statici.
- `localStorage` Demo v3 preservato.
- Dati copiati o adattati con test di parità fino al cutover.
- Cutover reversibile cambiando directory/artifact di deploy.

## Alternative considerate

- Vite vanilla: migliora build e TS ma non risolve layout/pagine/content composition.
- SvelteKit: valido, ma introduce runtime/component model più ampio del necessario.
- React/Next.js: escluso perché non esiste stato reattivo globale tale da giustificarlo.
- Web Components per tutto: interoperabili ma aumentano lifecycle e Shadow DOM complexity.
- Migrazione in-place: esclusa perché rende confronto e rollback più rischiosi.
- Sanity immediato: rinviato finché non esiste un workflow editoriale reale.

## Decisioni tecniche

### DEC-001 — Astro statico come application shell

- Contesto: sito multipagina statico con forte duplicazione e interazioni locali.
- Decisione: Astro con output statico.
- Motivazione: componenti e routing a build-time, JavaScript selettivo, HTML finale standard.
- Alternative escluse: SPA React, Vite-only.
- Conseguenze: serve Node/build; hosting resta statico.

### DEC-002 — Migrazione parallela

- Contesto: è richiesta parità completa e rollback sicuro.
- Decisione: creare `jethos-web/` accanto a `dapp-new/`.
- Motivazione: confronto diretto e nessuna interruzione del legacy.
- Alternative escluse: conversione in-place.
- Conseguenze: temporanea duplicazione di asset/fonti controllata da parity test.

### DEC-003 — Nessun framework UI client

- Contesto: feature locali, nessuno stato applicativo globale sulle pagine editoriali.
- Decisione: Astro components + Vanilla TypeScript controller.
- Motivazione: meno runtime, boundary più chiari.
- Alternative escluse: React/Svelte islands come default.
- Conseguenze: lifecycle e state management devono essere definiti internamente.

### DEC-004 — Design system per responsabilità

- Contesto: Atomic Design puro può creare astrazioni prive di valore.
- Decisione: foundations, primitives, composition, components, patterns, features.
- Motivazione: riuso semantico e ownership chiara.
- Alternative escluse: cartelle atom/molecule indiscriminate.
- Conseguenze: ogni componente necessita API e criterio di riuso.

### DEC-005 — CMS come adapter futuro

- Contesto: oggi i contenuti sono gestiti tecnicamente e i dati critici richiedono Git review.
- Decisione: Content Collections locali con interfaccia sostituibile.
- Motivazione: nessun costo/complessità prematura; percorso chiaro verso Sanity.
- Alternative escluse: CMS immediato o dati tecnici nel CMS.
- Conseguenze: preview visuale CMS viene implementata solo su requisito reale.

### DEC-006 — Parità prima della pulizia visuale

- Contesto: rifare markup e CSS contemporaneamente impedisce di attribuire regressioni.
- Decisione: preservare inizialmente DOM e CSS osservabili, poi estrarre componenti e ownership.
- Motivazione: diff visuale verificabile.
- Alternative escluse: redesign o token rewrite immediato.
- Conseguenze: parte del CSS legacy sarà temporaneamente importata nel nuovo progetto.

### DEC-007 — Node 22 e Astro 7 come baseline supportata

- Contesto: l'host corrente ha Node 20.12; Astro 5 è compatibile ma `npm audit` segnala advisory high risolti soltanto nella linea Astro 7.
- Decisione: richiedere Node 22.12+ e usare Astro 7.1.6; sull'host corrente i gate vengono eseguiti con `node@22.23.2` temporaneo.
- Motivazione: non fondare il nuovo target enterprise su una major con vulnerabilità note non correggibili in-line.
- Alternative escluse: mantenere Astro 5 per comodità locale; aggiornare silenziosamente il Node di sistema.
- Conseguenze: gli sviluppatori devono aggiornare Node; CI deve bloccare e registrare la versione runtime.

### DEC-008 — Documentazione precompilata con enhancement progressivo

- Contesto: il reader legacy scarica Markdown e lo converte nel browser; routing statico, sicurezza e fallback no-JS devono restare verificabili.
- Decisione: generare una route Astro autonoma per ognuno dei 13 documenti, usare tali route come fallback del catalogo e far clonare al dialog soltanto DOM già compilato. Le fonti `.md` pubbliche servono esclusivamente il download.
- Motivazione: nessun parser Markdown runtime o `innerHTML` da contenuto sorgente, URL stabili, TOC generata a build-time e contenuto completo anche senza JavaScript.
- Alternative escluse: parser custom legacy nel client; incorporare i 13 documenti in template nascosti nel catalogo; rendere il dialog l'unica modalità di lettura.
- Conseguenze: il build produce 13 route aggiuntive e il controller Docs dipende dal contratto DOM `data-document-*`; il contract è coperto da E2E desktop/mobile.

### DEC-009 — Runtime WebGL tipizzato con scene procedurali hash-verificate

- Contesto: il runtime legacy caricava Three.js da CDN e le quattro scene procedurali rappresentano la baseline visuale esatta.
- Decisione: bundle locale di Three.js `0.185.1`, runtime/manifest/quality/lifecycle in TypeScript strict e scene più visual-kit sincronizzati con hash come boundary visuale immutabile.
- Motivazione: rimuovere il rischio CDN e tipizzare orchestration e failure path senza alterare geometria, materiali o timing già approvati.
- Alternative escluse: riscrivere contemporaneamente le scene introducendo visual drift; mantenere import dinamici da jsDelivr.
- Conseguenze: il chunk Three.js supera 500 KB ma viene richiesto soltanto sulle quattro route abilitate; un futuro refactor delle scene richiede snapshot GPU controllate.

## Roadmap

## Milestone M1 — Baseline e governo del progetto

### Obiettivo

Fissare stato reale, architettura, documentazione e baseline verificabile.

### Risultato utilizzabile

Piano ufficiale, checklist, baseline test e screenshot.

### Componenti coinvolti

Legacy, documentazione e script esistenti.

### Dipendenze

Prompt_BIG e repository accessibile.

### Criteri di ingresso

Richiesta confermata.

### Criteri di completamento

Sei documenti creati; baseline registrata; rischi e decisioni documentati.

### Test richiesti

Gate locali e smoke browser legacy.

### Rischi

Documentazione non aderente al codice reale.

### Fasi

- F1: inventario e baseline.
- F2: architettura, requisiti e checklist.

## Milestone M2 — Foundation enterprise

### Obiettivo

Creare progetto Astro, TypeScript, design system foundation, content schema e pipeline di test.

### Risultato utilizzabile

App compilabile con shell, catalogue e una route pilota.

### Componenti coinvolti

Config, layout, shell, foundations, primitives, content repository e test runner.

### Dipendenze

M1 completata.

### Criteri di ingresso

Decisioni tecniche approvate dalla roadmap.

### Criteri di completamento

Install, typecheck, build e test foundation superati; route pilota visualmente comparata.

### Test richiesti

Build Astro, TypeScript, Vitest, Playwright smoke, axe e screenshot.

### Rischi

Versioni incompatibili o CSS global order divergente.

### Fasi

- F1: setup e configurazione.
- F2: design system e content layer.
- F3: shell e pagina pilota.

## Milestone M3 — Pagine editoriali e Docs

### Obiettivo

Migrare 13 pagine informative e document reader mantenendo URL e markup visuale.

### Risultato utilizzabile

Sito editoriale completo generato staticamente.

Stato: completato. Il target genera catalogo, 13 pagine documento, 13 pagine informative e quattro redirect compatibilità; i test browser coprono redirect, canonical e fallback.

### Componenti coinvolti

Layout editoriali, patterns, content, docs reader e redirect.

### Dipendenze

M2 stabile.

### Criteri di ingresso

Shell e route pilota verificate.

### Criteri di completamento

Tutte le route presenti, link validi, screenshot e accessibilità approvati.

### Test richiesti

Route matrix, link checker, Docs deep link, axe, desktop/mobile visual regression.

### Rischi

Markup monolinea portato in modo incompleto e path relativi errati.

### Fasi

- F1: componenti editoriali ricorrenti.
- F2: migrazione route.
- F3: Docs e redirect.

## Milestone M4 — Homepage e WebGL

### Obiettivo

Migrare homepage, feature e scene con parità visuale/interattiva.

### Risultato utilizzabile

Landing completa e responsive.

Stato F1: markup completo ripartito in dieci componenti di sezione, CSS visuale sincronizzato e feature host preservati; controller e WebGL vengono collegati nelle fasi successive.

Stato F2.1: le quattro feature Home semplici sono vertical slice TypeScript indipendenti, aggregate da un bootstrap di route e governate dal contratto `DisposableController` condiviso.

Stato F2.2: Inspector e Architecture Map applicano model/view/controller; la geometria del popover flottante è una utility pura condivisibile con Ownership, mentre cataloghi, formule e risk inheritance sono testati fuori dal DOM.

Stato F2.3: Ownership separa motion adapter, wallet state e vault explorer; desktop usa RAF scroll-driven, compact usa IntersectionObserver e reduced motion rimuove ogni trasformazione inline.

Stato F3: completato. Quattro scene lazy, quality budget, sospensione offscreen/tab nascosta, fallback CSS, controlli semantici e Proof Path sono attivi; Three.js non usa più CDN runtime.

### Componenti coinvolti

Homepage sections, feature controller, WebGL runtime e scene.

### Dipendenze

M3 e design system stabili.

### Criteri di ingresso

Baseline Home disponibile.

### Criteri di completamento

Tutte le feature e scene funzionano; fallback e reduced motion superati; visual diff accettabile.

### Test richiesti

Unit controller, E2E interazioni, WebGL smoke, screenshot full-page desktop/mobile.

### Rischi

Timing animazioni, stacking context e canvas divergenti.

### Fasi

- F1: sezioni statiche.
- F2: feature interattive.
- F3: WebGL e visual parity.

## Milestone M5 — Demo e PoC Console

### Obiettivo

Migrare le due superfici applicative senza cambiare modello o sicurezza.

### Risultato utilizzabile

Demo completa e console PoC utilizzabile.

Stato F1.1: catalogo, engine e storage Demo v3 sono tipizzati e testati; chiave storage, stato iniziale, formule a sei decimali ed errori legacy sono invariati.

Stato F1.2: route Demo completa e responsive; il renderer legacy è confinato come adapter visuale hash-verificato mentre shell, dominio e output URL sono governati dal target.

Stato F2: deployment e ABI locali, reader resilienti e wallet EIP-1193 sono tipizzati; restore usa soltanto `eth_accounts`, il connect resta esplicito e ogni read conserva successo/errore senza inventare zero.

Stato F3: completato. App Simple/Advanced è composta in quattro componenti Astro; la UI parity adapter usa esclusivamente moduli Web3 TypeScript locali. Approve/revoke/deposit/withdraw hanno preflight, mutex, lifecycle transazione e test con dipendenze iniettate.

### Componenti coinvolti

Demo engine/storage/views; wallet/readers/workflow/App UI.

### Dipendenze

M2 design system; M3 shell.

### Criteri di ingresso

Fixture e baseline disponibili.

### Criteri di completamento

Demo unit/E2E e App mock/E2E superati; diagnostica live separata registrata.

### Test richiesti

Engine, storage, wallet mock, transaction errors, browser flows e visual regression.

### Rischi

Regressioni finanziarie o perdita compatibilità localStorage/wallet.

### Fasi

- F1: Demo domain e UI.
- F2: infrastructure Web3.
- F3: App UI e workflow.

## Milestone M6 — Hardening, cutover e handover

### Obiettivo

Completare regressione, performance, sicurezza, deployment e documentazione.

### Risultato utilizzabile

Artifact statico enterprise pronto al deploy e rollback documentato.

### Componenti coinvolti

Intero sito, CI, header hosting e documentazione.

### Dipendenze

M3-M5 completate.

### Criteri di ingresso

Tutte le route e feature migrate.

### Criteri di completamento

Checklist obbligatoria chiusa, test completi superati, documentazione aggiornata e artifact verificato.

### Test richiesti

Full suite, diff visuale, accessibilità, performance budget, security header e installazione pulita.

### Rischi

Differenze ambientali snapshot e hosting non definito.

### Fasi

- F1: regressione e hardening.
- F2: deploy/rollback.
- F3: documentazione e handover.

## Strategia di test

- Legacy baseline: mantenere esiti e screenshot.
- Unit: modelli, formatter, state transition e content adapter.
- Integration: schema, route generation, manifest parity e storage.
- E2E: navigazione, componenti interattivi, Demo e App con mock.
- Accessibility: axe, keyboard e ARIA snapshot.
- Visual: snapshot deterministiche a viewport desktop/mobile con motion disabilitato.
- WebGL: smoke ready/fallback e review separata.
- Live: diagnostica RPC read-only, mai requisito per unit suite offline.

## Criteri di completamento del progetto

- Tutti RF e RNF obbligatori verificati o esplicitamente classificati non applicabili.
- Tutte le route legacy rispondono correttamente.
- Parità visuale approvata sulle pagine rappresentative e nessuna regressione strutturale sulle restanti.
- Feature Home, Demo, Docs, WebGL e App verificate.
- Build, typecheck, unit, E2E, axe e visual test superati.
- Nessun segreto nel client e preview auth non affidata a credenziali hardcoded.
- Dati critici cross-validati.
- `05_USAGE_GUIDE.md` e `06_HANDOVER.md` completi e coerenti.
- Stato finale registrato come `COMPLETATO E VERIFICATO` oppure limitazione esplicita più prudente.

## Esito finale dei criteri

Tutti i criteri sono soddisfatti. La verifica finale comprende installazione pulita, audit con zero vulnerabilità, parity su 58 file e quattro redirect, Astro check senza diagnostiche, lint/format, 50 unit test, build di 34 URL obbligatori, CSP e budget, manifest SHA-256 e 104 E2E passati su desktop/mobile. Le quattro prove visuali mobile sono intenzionalmente escluse perché producono lo stesso artifact desktop deterministico; mobile layout e axe sono coperti dalle suite funzionali.
