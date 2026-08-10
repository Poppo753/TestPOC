# Checklist del progetto

## Stato generale

- Stato progetto: COMPLETATO E VERIFICATO
- Milestone corrente: M6 — completata
- Fase corrente: handover concluso
- Prossimo task: nessuno; resta la decisione operativa di cutover
- Task completati: 33
- Task totali: 33
- Ultimo aggiornamento: 2026-08-03 05:20 +02:00

## Milestone M1

- [x] TASK-M1-F1-001 — Inventariare il sito legacy
  - Obiettivo: ricostruire entry point, moduli, dati, dipendenze e script.
  - Requisiti collegati: RF-001, RF-009, RNF-012.
  - File coinvolti: `dapp-new/**`.
  - Componenti coinvolti: intero legacy.
  - Modifica da eseguire: nessuna; analisi read-only.
  - Dipendenze: Prompt_BIG.
  - Rischi: ignorare superfici non evidenti.
  - Criterio di completamento: inventario registrato in `01_CONTEXT.md`.
  - Verifica richiesta: confronto tree, import e package scripts.
  - Esito: completato e verificato; rilevati 20 HTML, 9 JSON, 4 scene e moduli Demo/App/Docs.
  - Note: `pages/` contiene 13 pagine informative.

- [x] TASK-M1-F1-002 — Eseguire baseline statica legacy
  - Obiettivo: registrare gate pre-migrazione.
  - Requisiti collegati: RNF-012.
  - File coinvolti: `dapp-new/scripts/`.
  - Componenti coinvolti: validation gates.
  - Modifica da eseguire: nessuna.
  - Dipendenze: TASK-M1-F1-001.
  - Rischi: network diagnostics non deterministiche.
  - Criterio di completamento: esiti locali registrati.
  - Verifica richiesta: validate, content, product, demo, webgl, docs.
  - Esito: 5/6 superati; `check:content` fallisce su HTML dentro artifacts.
  - Note: errore preesistente, non regressione.

- [x] TASK-M1-F1-003 — Eseguire baseline browser e visuale
  - Obiettivo: fissare comportamento runtime e frame di confronto.
  - Requisiti collegati: RF-003, RNF-004, RNF-012.
  - File coinvolti: `dapp-new/scripts/browser/`, `dapp-new/artifacts/enterprise-baseline/`.
  - Componenti coinvolti: Auth, Demo, Docs, WebGL, Home e App.
  - Modifica da eseguire: generare artefatti locali.
  - Dipendenze: server locale e Edge.
  - Rischi: rendering GPU/timing variabile.
  - Criterio di completamento: smoke superati e screenshot presenti.
  - Verifica richiesta: quattro smoke browser e quattro catture autenticate.
  - Esito: completato e verificato.
  - Note: motion forzato ridotto nelle catture.

- [x] TASK-M1-F2-001 — Definire architettura e roadmap
  - Obiettivo: fissare soluzione, alternative, decisioni e milestone.
  - Requisiti collegati: tutti.
  - File coinvolti: `02_ARCHITECTURE_AND_ROADMAP.md`.
  - Componenti coinvolti: target architecture.
  - Modifica da eseguire: creare documento ufficiale.
  - Dipendenze: M1-F1.
  - Rischi: roadmap non verificabile.
  - Criterio di completamento: sezioni Prompt_BIG presenti e milestone con gate.
  - Verifica richiesta: rilettura contro codice e richiesta.
  - Esito: completato; verifica finale del documento ancora in TASK-M1-F2-003.
  - Note: scelta migrazione parallela in `jethos-web/`.

- [x] TASK-M1-F2-002 — Creare checklist, log, guida e handover iniziali
  - Obiettivo: attivare governo operativo.
  - Requisiti collegati: RF-014, RNF-015.
  - File coinvolti: documenti 03-06.
  - Componenti coinvolti: documentazione.
  - Modifica da eseguire: creare file con struttura obbligatoria.
  - Dipendenze: TASK-M1-F2-001.
  - Rischi: stato iniziale incoerente.
  - Criterio di completamento: quattro file presenti e sincronizzati.
  - Verifica richiesta: controllo heading e stato.
  - Esito: completato e verificato; i quattro documenti sono presenti con la struttura obbligatoria.
  - Note: stato e prossimo task sincronizzati.

- [x] TASK-M1-F2-003 — Validare coerenza dei sei documenti
  - Obiettivo: chiudere M1 con documentazione aderente al repository.
  - Requisiti collegati: RNF-015.
  - File coinvolti: documenti 01-06.
  - Componenti coinvolti: documentazione.
  - Modifica da eseguire: correggere incongruenze.
  - Dipendenze: TASK-M1-F2-002.
  - Rischi: pianificare attività fuori ordine.
  - Criterio di completamento: nessuna sezione obbligatoria mancante; prossimo task unico.
  - Verifica richiesta: ricerca heading e confronto roadmap/checklist.
  - Esito: completato e verificato tramite controllo automatico degli heading; sei milestone presenti sia in roadmap sia in checklist.
  - Note: rilevati 33 task totali; conteggio corretto nello stato generale.

## Milestone M2

- [x] TASK-M2-F1-001 — Creare package Astro isolato
  - Obiettivo: inizializzare `jethos-web/` senza modificare il package Hardhat root.
  - Requisiti collegati: RF-001, RNF-001, RNF-010.
  - File coinvolti: `jethos-web/package.json`, lockfile, config Astro/TS.
  - Componenti coinvolti: build foundation.
  - Modifica da eseguire: configurare dipendenze motivate e script.
  - Dipendenze: M1 completa.
  - Rischi: conflitto workspace o versioni.
  - Criterio di completamento: install pulita e progetto vuoto compilabile.
  - Verifica richiesta: `npm ci`, `npm run build`, `astro check`.
  - Esito: completato e verificato con Node 22.23.2; `npm ci`, Astro check, lint, unit smoke e build statico superati. `npm audit` riporta zero vulnerabilità.
  - Note: Astro 5 è stato scartato dopo audit; DEC-007 registra il passaggio ad Astro 7.1.6. Il package Hardhat root è rimasto invariato.

- [x] TASK-M2-F1-002 — Configurare qualità e ambienti
  - Obiettivo: introdurre typecheck, lint, format e config test.
  - Requisiti collegati: RNF-002, RNF-010, RNF-014.
  - File coinvolti: config TypeScript, ESLint, Prettier, Vitest, Playwright.
  - Componenti coinvolti: toolchain.
  - Modifica da eseguire: configurazione minima senza regole ridondanti.
  - Dipendenze: TASK-M2-F1-001.
  - Rischi: toolchain eccessiva.
  - Criterio di completamento: comandi indipendenti eseguibili.
  - Verifica richiesta: typecheck/lint/unit smoke.
  - Esito: completato e verificato; typecheck, lint, format, 2 unit test, build e 2 smoke E2E/axe su Edge desktop/mobile sono verdi.
  - Note: configurazione ESLint aggiornata all'API `defineConfig`; nessun hint residuo. I test browser usano browser reale e verificano heading principale e violazioni axe automatizzabili.

- [x] TASK-M2-F1-003 — Portare asset statici e fonti senza drift
  - Obiettivo: rendere disponibili brand, docs, dati e redirect source.
  - Requisiti collegati: RF-009, RF-013.
  - File coinvolti: `public/`, `src/data/`, script parity.
  - Componenti coinvolti: asset/content.
  - Modifica da eseguire: copia controllata o adapter con hash/parity test.
  - Dipendenze: TASK-M2-F1-001.
  - Rischi: duplicazione silenziosa.
  - Criterio di completamento: test rileva divergenze dal legacy durante migrazione.
  - Verifica richiesta: content parity test.
  - Esito: completato e verificato; 25 file tra brand, dati e documenti più 4 redirect sono sincronizzati e coperti da manifest SHA-256.
  - Note: `sync:legacy` aggiorna esplicitamente le copie; `check:parity` è read-only, rileva file mancanti, modificati o inattesi ed è incluso in `verify`.

- [x] TASK-M2-F2-001 — Implementare foundations CSS
  - Obiettivo: definire layer, token primitivi/semantici, typography e motion.
  - Requisiti collegati: RF-003, RNF-004, RNF-009.
  - File coinvolti: `src/design-system/foundations/`.
  - Componenti coinvolti: design system.
  - Modifica da eseguire: portare valori legacy preservando rendering.
  - Dipendenze: TASK-M2-F1-003.
  - Rischi: cascade diversa.
  - Criterio di completamento: token e layer documentati, reduced motion presente.
  - Verifica richiesta: build CSS e visual fixture.
  - Esito: completato e verificato; layer order, reset, token primitivi/semantici, tipografia e motion sono compilati e coperti da test unit/browser.
  - Note: i valori visuali legacy restano esatti; i nuovi componenti consumeranno alias semantici. Reduced motion disattiva smooth scroll e comprime animazioni/transizioni.

- [x] TASK-M2-F2-002 — Implementare primitives e composition
  - Obiettivo: Button, Badge, Icon, Container, Stack, Cluster, Grid e Split.
  - Requisiti collegati: RF-002, RF-010.
  - File coinvolti: `src/design-system/primitives/`, `composition/`.
  - Componenti coinvolti: design system.
  - Modifica da eseguire: API tipizzate con markup legacy-equivalent.
  - Dipendenze: TASK-M2-F2-001.
  - Rischi: over-abstraction.
  - Criterio di completamento: catalogue e props documentate.
  - Verifica richiesta: component fixtures e axe.
  - Esito: completato e verificato; Button, Badge, Icon, Eyebrow, VisuallyHidden, Container, Stack, Cluster, Grid, Split e Section compilano e sono renderizzati nella fixture accessibile.
  - Note: API piccole e tipizzate; classi legacy preservate per parità. Nessun wrapper per markup che non esprime un contratto riusabile.

- [x] TASK-M2-F2-003 — Implementare components e patterns condivisi
  - Obiettivo: Card, Metric, DataRow, Callout, PageHero, SectionHeading, FinalCta.
  - Requisiti collegati: RF-002, RF-010.
  - File coinvolti: `components/`, `patterns/`.
  - Componenti coinvolti: design system.
  - Modifica da eseguire: estrarre soltanto pattern reali ricorrenti.
  - Dipendenze: TASK-M2-F2-002.
  - Rischi: props arbitrarie equivalenti a CSS inline.
  - Criterio di completamento: varianti finite e catalogue completo.
  - Verifica richiesta: visual/component tests.
  - Esito: completato e verificato; Card, Metric, DataRow, Callout, PageHero, SectionHeading e FinalCta hanno varianti finite e stili nel layer corretto.
  - Note: la fixture compone pattern, componenti e primitive; typecheck, build e axe desktop/mobile sono verdi.

- [x] TASK-M2-F2-004 — Implementare content repository tipizzato
  - Obiettivo: schema e query per contenuti/dati.
  - Requisiti collegati: RF-009, RF-012, RNF-006.
  - File coinvolti: `src/content.config.ts`, `src/content/`, `src/data/`.
  - Componenti coinvolti: content layer.
  - Modifica da eseguire: definire schema e adapter locale.
  - Dipendenze: TASK-M2-F1-003.
  - Rischi: CMS coupling o dati tecnici misclassificati.
  - Criterio di completamento: dati invalidi fermano la build.
  - Verifica richiesta: contract test con fixture invalide.
  - Esito: completato e verificato; 10 fonti JSON e 13 Markdown sono registrati nel content layer, con schema strict e repository locali separati editorial/protocol.
  - Note: 16 test unitari includono tutte le fonti valide e fixture invalide per catalogo vault e indirizzi deployment. Il repository è già consumato dalla fixture di build.

- [x] TASK-M2-F3-001 — Implementare BaseLayout, header e footer
  - Obiettivo: sostituire shell runtime con HTML statico condiviso.
  - Requisiti collegati: RF-002, RNF-003.
  - File coinvolti: layouts e shell components.
  - Componenti coinvolti: header, nav, footer, metadata.
  - Modifica da eseguire: output equivalente e menu client minimale.
  - Dipendenze: M2-F2.
  - Rischi: path e aria-current.
  - Criterio di completamento: shell corretta da route root e nested.
  - Verifica richiesta: route smoke e keyboard menu.
  - Esito: completato e verificato; shell server-rendered, metadata, nav corrente, footer e menu responsive sono centralizzati e accessibili.
  - Note: controller `mountNavigation(root): { destroy() }` testato su Edge desktop/mobile; Escape chiude e restituisce focus. Build format `file` preserva URL `.html`.

- [x] TASK-M2-F3-002 — Migrare Changelog come pagina pilota
  - Obiettivo: validare l'intero flusso componenti/content/rendering.
  - Requisiti collegati: RF-001, RF-003, RF-009.
  - File coinvolti: route changelog, pattern e content.
  - Componenti coinvolti: EditorialLayout, PageHero, changelog entries.
  - Modifica da eseguire: generare pagina da fonte strutturata.
  - Dipendenze: TASK-M2-F3-001.
  - Rischi: contenuto divergente.
  - Criterio di completamento: testo, DOM e screenshot equivalenti.
  - Verifica richiesta: content parity, axe, visual desktop/mobile.
  - Esito: completato e verificato; `/pages/changelog.html` è generato dai dati tipizzati con markup e layout equivalenti al legacy.
  - Note: mapper unit-testato per date/tipi; 4 entry e source label verificati su Edge desktop/mobile con axe. M2 completata.

## Milestone M3

- [x] TASK-M3-F1-001 — Estrarre pattern editoriali restanti
  - Obiettivo: coprire grid, table, evidence, policy, timeline e FAQ.
  - Requisiti collegati: RF-010.
  - File coinvolti: design-system patterns.
  - Componenti coinvolti: pattern editoriali.
  - Modifica da eseguire: API semantiche con slot limitati.
  - Dipendenze: M2.
  - Rischi: componenti specifici mascherati da generici.
  - Criterio di completamento: almeno due consumer reali o responsabilità autonoma.
  - Verifica richiesta: catalogue e visual tests.
  - Esito: completato e verificato; SectionBand, DataTable, FAQ, StatusLedger, ComparisonGrid, Timeline e Flow sono tipizzati e renderizzati nel catalogue temporaneo.
  - Note: pattern estratti da ricorrenze misurate (101 badge, 46 card, 24 comparison cell, 20 FAQ, 18 evidence row, 13 policy row). Axe ha rilevato e guidato la correzione della semantica Flow da list a group.

- [x] TASK-M3-F2-001 — Migrare pagine prodotto e rischio
  - Obiettivo: Vaults, Risk, Trust, Security e Protocol.
  - Requisiti collegati: RF-001, RF-003, RF-009.
  - File coinvolti: cinque route e fonti dati.
  - Componenti coinvolti: evidence/policy/product patterns.
  - Modifica da eseguire: conversione Astro con URL invariati.
  - Dipendenze: TASK-M3-F1-001.
  - Rischi: claim o provenance persi.
  - Criterio di completamento: contenuti e status equivalenti.
  - Verifica richiesta: content contract, axe e screenshot.
  - Esito: completato e verificato; Vaults, Risk, Trust, Security e Protocol generano gli URL legacy, consumano fonti tipizzate e superano axe desktop/mobile.
  - Note: `pages.css` e `webgl.css` sono bridge temporanei hashati (27 fonti totali). Protocol espone un fallback statico esplicito; il runtime WebGL è pianificato in M4-F3-001.

- [x] TASK-M3-F2-002 — Migrare pagine narrative
  - Obiettivo: How it works, Roadmap, Vision, FAQ, Developers e Team.
  - Requisiti collegati: RF-001, RF-003.
  - File coinvolti: sei route.
  - Componenti coinvolti: flow, timeline, FAQ, tables.
  - Modifica da eseguire: conversione Astro con markup equivalente.
  - Dipendenze: TASK-M3-F1-001.
  - Rischi: scene host mancanti su tre route.
  - Criterio di completamento: route e fallback completi.
  - Verifica richiesta: route matrix, axe e screenshot.
  - Esito: completato e verificato; How it works, Roadmap, Vision, FAQ, Developers e Team generano route complete e superano axe desktop/mobile.
  - Note: 13 route totali costruite; FAQ mantiene 20 disclosure native, roadmap usa il repository tipizzato e tre host scena espongono fallback statici espliciti fino a M4.

- [x] TASK-M3-F3-001 — Migrare Docs catalog e renderer
  - Obiettivo: catalogo, ricerca, deep link, TOC e download.
  - Requisiti collegati: RF-007.
  - File coinvolti: Docs route, content/docs e feature docs.
  - Componenti coinvolti: document reader.
  - Modifica da eseguire: server-render fallback più enhancement client.
  - Dipendenze: TASK-M3-F2-001.
  - Rischi: Markdown unsafe o history rotta.
  - Criterio di completamento: 13 documenti leggibili e deep link funzionante.
  - Verifica richiesta: unit renderer, browser smoke, axe dialog.
  - Esito: completato e verificato; catalogo, ricerca, reader, history, deep link, TOC, download e 13 fallback statici operativi.
  - Note: Markdown compilato da Astro a build-time; nessun parser runtime o inserimento di Markdown con `innerHTML`. Parity su 42 copie, 20 unit test, build a 27 pagine e Docs E2E/axe 4/4 desktop/mobile superati.

- [x] TASK-M3-F3-002 — Implementare redirect e route compatibility
  - Obiettivo: preservare quattro URL root e ogni link interno.
  - Requisiti collegati: RF-013.
  - File coinvolti: route redirect e config hosting.
  - Componenti coinvolti: routing.
  - Modifica da eseguire: output statico compatibile.
  - Dipendenze: route target migrate.
  - Rischi: redirect loop.
  - Criterio di completamento: target corretti e canonical presenti.
  - Verifica richiesta: HTTP/browser redirect test.
  - Esito: completato e verificato; quattro file root generati con target, canonical, meta refresh e fallback link coerenti.
  - Note: config sincronizzata validata come target interno; route dinamica produce `config.html`, `documentation.html`, `landing.html` e `portfolio.html`. Vitest 22/22, build 31 pagine e redirect E2E 10/10 desktop/mobile superati.

## Milestone M4

- [x] TASK-M4-F1-001 — Migrare markup statico homepage
  - Obiettivo: portare tutte le sezioni senza behavior.
  - Requisiti collegati: RF-003.
  - File coinvolti: Home route e section components.
  - Componenti coinvolti: homepage.
  - Modifica da eseguire: componentizzazione conservando output.
  - Dipendenze: M3 patterns.
  - Rischi: DOM/CSS divergence.
  - Criterio di completamento: screenshot statico vicino alla baseline.
  - Verifica richiesta: DOM/content parity e visual full-page.
  - Esito: completato e verificato; dieci sezioni componentizzate, contenuti e host feature preservati, Home responsive completa.
  - Note: `home-refresh.css` è il terzo bridge visuale hashato (43 file in parity). Astro check/lint/build superati; Home E2E/axe 4/4 desktop/mobile. Corretti nel target due difetti ARIA legacy senza variazioni visuali.

- [x] TASK-M4-F2-001 — Migrare feature homepage semplici
  - Obiettivo: roadmap, receipt, synthesis e runway.
  - Requisiti collegati: RF-004, RNF-008.
  - File coinvolti: feature vertical slices.
  - Componenti coinvolti: quattro feature.
  - Modifica da eseguire: controller uniformi e cleanup.
  - Dipendenze: TASK-M4-F1-001.
  - Rischi: focus/hover behavior divergente.
  - Criterio di completamento: E2E mouse e keyboard superati.
  - Verifica richiesta: unit/E2E/axe.
  - Esito: completato e verificato; quattro controller tipizzati con lifecycle uniforme e stato mouse/tastiera equivalente.
  - Note: modello finito per 5 horizons, 4 allocazioni e 3 route; fallback immediato senza IntersectionObserver e con reduced motion. 25 unit test e suite Home combinata 10/10 desktop/mobile superati.

- [x] TASK-M4-F2-002 — Migrare Strategy Inspector e Architecture Map
  - Obiettivo: separare model/view/controller dei due widget complessi.
  - Requisiti collegati: RF-004, RNF-008.
  - File coinvolti: due feature directories.
  - Componenti coinvolti: inspector e map.
  - Modifica da eseguire: porting tipizzato con popover primitive.
  - Dipendenze: TASK-M4-F2-001.
  - Rischi: overlay responsive e stato ARIA.
  - Criterio di completamento: tutti gli stati equivalenti e testati.
  - Verifica richiesta: component/E2E visual.
  - Esito: completato e verificato; strategie, allocazioni, formule, route inheritance, modalità, rischi, chain accordion e popover equivalenti.
  - Note: model/view/controller separati, utility geometrica pura e cleanup completo. 28 unit test; E2E complessi 4/4 desktop/mobile con axe. Corretto race focus/pointer del bottom sheet mobile.

- [x] TASK-M4-F2-003 — Migrare Ownership Journey
  - Obiettivo: separare scroll motion, wallet allocation e vault explorer.
  - Requisiti collegati: RF-004, RNF-004, RNF-008.
  - File coinvolti: ownership feature.
  - Componenti coinvolti: journey.
  - Modifica da eseguire: controller e motion adapter.
  - Dipendenze: TASK-M4-F2-001.
  - Rischi: geometry/scroll timing.
  - Criterio di completamento: desktop, compact e reduced motion equivalenti.
  - Verifica richiesta: E2E scroll e visual.
  - Esito: completato e verificato; desktop scroll path, compact assembly, reduced motion, wallet e vault explorer equivalenti.
  - Note: 31 unit test; suite Home completa 18/18 desktop/mobile con axe. Corretto il difetto legacy che confondeva hover temporaneo e selezione persistente del wallet.

- [x] TASK-M4-F3-001 — Migrare WebGL runtime e scene
  - Obiettivo: bundled dynamic import preservando lifecycle e qualità.
  - Requisiti collegati: RF-008, RNF-013.
  - File coinvolti: WebGL infrastructure/scenes.
  - Componenti coinvolti: quattro scene.
  - Modifica da eseguire: porting TS e asset loading.
  - Dipendenze: route host migrate.
  - Rischi: bundle e rendering diversi.
  - Criterio di completamento: ready su quattro scene e forced-off fallback.
  - Verifica richiesta: static manifest, smoke browser e capture.
  - Esito: completato e verificato; quattro scene ready, forced-off e reduced-motion static funzionano senza CDN runtime.
  - Note: Three.js `0.185.1` e tipi sono versionati; runtime strict, controlli journey/protocol, Proof Path e cleanup sono coperti da 34 unit e 7 E2E desktop dedicati. Le scene procedurali sono una boundary hash-verificata per parità visuale.

## Milestone M5

- [x] TASK-M5-F1-001 — Migrare Demo domain e storage
  - Obiettivo: portare catalogo, engine e storage v3 tipizzati.
  - Requisiti collegati: RF-005.
  - File coinvolti: Demo model/engine/storage.
  - Componenti coinvolti: Demo domain.
  - Modifica da eseguire: preservare formule e chiave storage.
  - Dipendenze: M2.
  - Rischi: perdita stato o arrotondamenti.
  - Criterio di completamento: test legacy e nuovi unit equivalenti.
  - Verifica richiesta: scenario iniziale/deposit/growth/withdraw/error.
  - Esito: completato e verificato; catalogo, formule, operazioni e schema v3 sono TypeScript strict.
  - Note: 7 unit test coprono matrice prodotto, accounting, crescita, deposit/withdraw, errori, round-trip, recovery da stato corrotto e reset isolato.

- [x] TASK-M5-F1-002 — Migrare Demo UI e routing
  - Obiettivo: suddividere controller 67 KB in route/view/dialog components.
  - Requisiti collegati: RF-005, RNF-008.
  - File coinvolti: Demo route e feature UI.
  - Componenti coinvolti: sette route Demo.
  - Modifica da eseguire: controller composto senza framework.
  - Dipendenze: TASK-M5-F1-001.
  - Rischi: differenze di stato e focus.
  - Criterio di completamento: tutti i flussi browser e screenshot equivalenti.
  - Verifica richiesta: E2E completo e axe.
  - Esito: completato e verificato; route esatta, hash navigation, dialog e workflow Demo completi.
  - Note: 10 E2E desktop/mobile coprono routing, deposit/growth/withdraw, storage v3, errori, focus, Advanced filters, assenza Web3 e axe. Renderer/CSS sono boundary hash-verificate; `finalize-static-output` conserva `/demo/index.html` con build `format:file`.

- [x] TASK-M5-F2-001 — Migrare deployment, readers e wallet
  - Obiettivo: tipizzare infrastructure Web3 e bundlare Ethers.
  - Requisiti collegati: RF-006, RNF-005, RNF-006, RNF-007.
  - File coinvolti: infrastructure blockchain.
  - Componenti coinvolti: manifest, provider, wallet, readers.
  - Modifica da eseguire: Result types e stale-response protection.
  - Dipendenze: M2 setup.
  - Rischi: comportamento Ethers differente.
  - Criterio di completamento: reader e wallet mock test superati.
  - Verifica richiesta: unit/integration e diagnostics parity.
  - Esito: completato e verificato; deployment/ABI, context, reader e wallet sono TypeScript strict e mockabili.
  - Note: ethers `6.13.2` legacy è stato rifiutato per advisory `ws` high; il target usa `6.17.0`, audit zero. Sei unit test coprono address/chain, read parziali, timeout, fallback registry, restore passivo, connect, chain change, add-chain e cleanup.

- [x] TASK-M5-F3-001 — Migrare PoC App UI e workflow
  - Obiettivo: riprodurre App Simple/Advanced e transazioni.
  - Requisiti collegati: RF-006.
  - File coinvolti: App route e feature poc-console.
  - Componenti coinvolti: forms, view, workflow, modal, toast.
  - Modifica da eseguire: componentizzazione e controller tipizzato.
  - Dipendenze: TASK-M5-F2-001.
  - Rischi: operazioni finanziarie errate.
  - Criterio di completamento: approve exact/revoke/deposit/withdraw mock verificati.
  - Verifica richiesta: E2E wallet mock, error state e visual.
  - Esito: completato e verificato; App Simple/Advanced, modal, form e quattro workflow sono disponibili a `/app.html`.
  - Note: 9 unit mock infrastruttura/transazioni e 10 E2E App desktop/mobile coprono RPC totale failure, restore passivo, wrong chain/switch, rejection, tab, advanced mode e axe. Nessuna transazione live eseguita.

## Milestone M6

- [x] TASK-M6-F1-001 — Chiudere regressione globale
  - Obiettivo: confrontare tutte le route e feature col legacy.
  - Requisiti collegati: RNF-012.
  - File coinvolti: tests e intero sito.
  - Componenti coinvolti: tutte le superfici.
  - Modifica da eseguire: correggere divergenze reali.
  - Dipendenze: M3-M5.
  - Rischi: snapshot approvati senza revisione.
  - Criterio di completamento: matrice route, axe e visual approvate.
  - Verifica richiesta: full suite.
  - Esito: completato; matrice Playwright finale 104 passed e 4 skip intenzionali su 108, con axe, tastiera, responsive, reduced motion e quattro artifact visuali desktop.
  - Note: corretto un drift di 72 px causato dall'ordine CSS tra shell Astro e bridge WebGL; il server stale rilevato durante il collaudo non era un difetto applicativo.

- [x] TASK-M6-F1-002 — Applicare security e performance hardening
  - Obiettivo: CSP, self-hosting/bundle, budget e headers.
  - Requisiti collegati: RNF-005, RNF-011, RNF-013.
  - File coinvolti: config build/hosting.
  - Componenti coinvolti: deploy artifact.
  - Modifica da eseguire: header e budget verificabili.
  - Dipendenze: TASK-M6-F1-001.
  - Rischi: CSP rompe WebGL/RPC.
  - Criterio di completamento: build funziona sotto policy documentata.
  - Verifica richiesta: header test, bundle report e smoke.
  - Esito: completato; CSP con hash degli script inline, header anti-framing/privacy, cache immutable, budget build e dipendenze runtime locali.
  - Note: JS raw totale 1.272.385 B; chunk massimo Three.js 735.442 B, caricato dinamicamente. Audit: zero vulnerabilità.

- [x] TASK-M6-F2-001 — Documentare deploy e rollback
  - Obiettivo: rendere il cutover ripetibile e reversibile.
  - Requisiti collegati: RNF-011, RF-014.
  - File coinvolti: usage guide e config hosting.
  - Componenti coinvolti: CI/CD.
  - Modifica da eseguire: procedure e artifact.
  - Dipendenze: M6-F1.
  - Rischi: hosting finale non definito.
  - Criterio di completamento: procedura generica e adapter host-specific isolato.
  - Verifica richiesta: build da checkout pulito e serve dist.
  - Esito: completato in `jethos-web/docs/DEPLOYMENT.md`, con artifact immutabile, smoke, promozione e rollback tramite manifest.
  - Note: hosting non imposto; `_headers` è direttamente compatibile con Cloudflare Pages/host stile Netlify e traducibile altrove.

- [x] TASK-M6-F3-001 — Finalizzare documentazione e handover
  - Obiettivo: chiudere tutti i documenti con stato reale.
  - Requisiti collegati: RF-014, RNF-015.
  - File coinvolti: documenti 01-06 e README nuovo sito.
  - Componenti coinvolti: documentazione.
  - Modifica da eseguire: aggiornamento finale senza duplicati.
  - Dipendenze: tutte le milestone.
  - Rischi: dichiarazioni non supportate.
  - Criterio di completamento: comandi e risultati riproducibili.
  - Verifica richiesta: doc review e install clean.
  - Esito: completato; README, Architecture, Testing, CMS, Deployment e i sei documenti Prompt_BIG sono coerenti con l'as-built.
  - Note: installazione pulita con Node 22.23.2 verificata prima della chiusura.

## Verifiche globali

- [x] Tutti gli RF obbligatori verificati.
- [x] Tutti gli RNF obbligatori verificati.
- [x] Installazione pulita.
- [x] Build e typecheck.
- [x] Unit/integration/E2E.
- [x] Accessibilità e reduced motion.
- [x] Visual regression desktop e responsive mobile.
- [x] WebGL ready/fallback.
- [x] Demo e App workflows.
- [x] Link, redirect e metadata.
- [x] Security headers e assenza segreti.
- [x] Documentazione finale coerente.

## Problemi e blocchi

- `check:content` legacy include un file HTML sotto `artifacts/` e fallisce.
- Hosting finale non specificato; non blocca sviluppo statico.
- CMS non richiesto operativamente; integrazione concreta rinviata, adapter previsto.

## Deviazioni dal piano

Nessuna.

## Attività rimaste aperte

Nessuna attività di implementazione aperta. Restano esterne al progetto la scelta dell'hosting, l'eventuale attivazione CMS e l'approvazione del cutover.
