# Checklist WebGL2 consolidata

Legenda: `[x]` completato e verificato; `[~]` predisposto ma appartenente al successivo art pass.

## A. Analisi e strategia

- [x] Inventariare pagine, script, CSS e modifiche esistenti.
- [x] Identificare stacking context che bloccava l'header.
- [x] Identificare factory condivisa come causa dell'uniformità.
- [x] Valutare Three.js, Blender, Unity e Unreal.
- [x] Limitare il runtime a quattro pagine significative.
- [x] Definire fallback, accessibilità, lifecycle e budget.
- [x] Riesaminare criticamente e correggere il piano prima del codice.

## B. Struttura e navigazione

- [x] Assegnare all'header wrapper il livello globale 1000.
- [x] Impedire input su canvas e decorazioni.
- [x] Eliminare lo stage condiviso indiscriminatamente da tutte le pagine.
- [x] Scartare la presentazione in card e usare quattro background full-screen page-scoped.
- [x] Rimuovere WebGL da app e pagine editoriali.
- [x] Verificare presenza header nel browser smoke e stacking via contratto CSS.

## C. Runtime

- [x] Ridurre il manifest a quattro factory uniche.
- [x] Rifare bootstrap con un solo mount per pagina e fallback non distruttivo.
- [x] Rifare controller per container e factory.
- [x] Implementare ResizeObserver, IntersectionObserver e visibility.
- [x] Implementare qualità adattiva e override URL.
- [x] Implementare teardown GPU/listener.
- [x] Implementare `?webglDebug=1`.
- [x] Conservare Three.js pinned e timeout CDN.

## D. Linguaggio visuale

- [x] Creare palette, materiali standard/physical e resource tracker.
- [x] Creare rig luci, sRGB e ACES tone mapping.
- [x] Creare plinth, tube e connector riutilizzabili.
- [x] Eliminare particle cloud, stelle e wireframe.
- [x] Creare loader GLTF opzionale per l'art pass.

## E. Scene e interazioni

- [x] Implementare Home / Ownership Core.
- [x] Implementare replay HTML accessibile.
- [x] Implementare How / Capital Journey.
- [x] Collegare quattro step HTML.
- [x] Implementare Protocol / Transparent Stack.
- [x] Collegare selezione layer e complete stack.
- [x] Implementare Roadmap / Evidence Reactor.
- [x] Collegare Proof Path e session progress.
- [x] Verificare silhouette e movimenti differenti.
- [x] Correggere scala/posizione dopo visual review.

## F. Fallback, responsive e accessibilità

- [x] Creare quattro fallback CSS differenti.
- [x] Rendere canvas `aria-hidden`, non focusable e non interattivo.
- [x] Mantenere informazioni e controlli nel DOM.
- [x] Usare HTML nativo, `aria-pressed`, focus-visible e `aria-live`.
- [x] Supportare reduced motion con frame statico.
- [x] Supportare `?webgl=off` senza layout rotto.
- [x] Aggiungere compensazione camera portrait.
- [x] Ispezionare Home desktop/mobile e quattro scene desktop.

## G. Validazione e strumenti

- [x] Riscrivere validatore per il nuovo contratto.
- [x] Fallire su WebGL in pagine non previste.
- [x] Fallire se mancano host, fallback, status o factory.
- [x] Fallire sul vecchio stage condiviso, sul riquadro WebGL, su wireframe o PointsMaterial.
- [x] Aggiungere controllo stacking header.
- [x] Aggiungere browser smoke senza dipendenze.
- [x] Aggiungere catture comparative senza dipendenze.
- [x] Eseguire sintassi, sito, contenuto e release readiness.
- [x] Eseguire browser smoke: quattro scene live + fallback.
- [x] Conservare screenshot della review e documentarne i limiti.

## H. Asset pass successivo

- [~] Concept frame originali — richiedono approvazione visuale prima di modellare.
- [~] Asset originali Blender — pipeline, naming e slot GLB documentati.
- [~] Compressione GLB — da decidere su misurazioni degli asset reali.
- [~] Bloom/DOF — da valutare soltanto dopo profiling final art.
- [~] Device lab esteso — raccomandato prima della pubblicazione pubblica.

Queste voci non sono bug della baseline: sono il passaggio esplicito da implementazione tecnica verificata a produzione artistica definitiva.

## I. Documentazione

- [x] Spiegazione generale.
- [x] Piano espanso.
- [x] Riesame critico.
- [x] Checklist consolidata.
- [x] Report implementazione.
- [x] Guida architettura/runtime e singoli moduli.
- [x] Guida scene e controlli.
- [x] Guida test, debug e catture.
- [x] Guida Blender/GLB.
- [x] Report verifica e indice consegna.
