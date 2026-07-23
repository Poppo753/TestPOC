# Report di implementazione WebGL2

## Stato consegnato

La precedente integrazione globale uniforme è stata rimossa. Una prima revisione in viewport bordate è stata poi scartata perché sembrava una demo tecnica. La versione corrente usa quattro veri background full-screen page-scoped: il sito non mostra più lo stesso mondo su tutte le pagine e il canvas non compete con header, PoC o contenuti.

## Correzioni principali

### Navigazione

La causa del blocco dei click era lo stacking context creato assegnando lo stesso livello a header wrapper e main. Il wrapper dell'header possiede ora `z-index: 1000`; main e footer hanno livelli distinti; canvas, fallback e decorazioni usano `pointer-events: none`. Il controllo statico impedisce che questa regola venga rimossa accidentalmente.

### Scope

WebGL è attivo esclusivamente su:

- `index.html` → Ownership Core;
- `pages/how-it-works.html` → Capital Journey;
- `pages/protocol.html` → Transparent Stack;
- `pages/roadmap.html` → Evidence Reactor.

È stato rimosso da PoC, docs, FAQ, vaults, risk, trust, security, vision e developers. Queste pagine non scaricano Three.js perché non contengono né manifest valido né host.

### Qualità grafica

Sono stati eliminati:

- `PointsMaterial` e particle cloud;
- stelle casuali;
- materiali wireframe;
- primitive identiche riconfigurate per pagina;
- stage identico condiviso su tutte le pagine e successivo riquadro/card WebGL.

Sono stati introdotti:

- materiali fisici e standard con metalness, roughness, transmission ed emissive controllati;
- rig di luce condiviso;
- ACES filmic tone mapping e output sRGB;
- volumi solidi, plinth, tube e connector;
- camera specifica per scena e compensazione portrait;
- animazioni semantiche e controlli HTML.

## Architettura implementata

Il manifest punta a quattro moduli factory indipendenti. Il controller gestisce renderer, camera, resize, intersection, visibility, qualità e teardown. Le scene gestiscono esclusivamente oggetti e stato visuale. Il bridge traduce controlli accessibili in stato 3D. Un loader GLTF opzionale prepara il passaggio a modelli Blender senza rendere la baseline dipendente da asset esterni.

## Roadmap interattiva

Proof Path è stato conservato e integrato con Evidence Reactor. Una risposta corretta avanza il core e stabilizza un gate; una risposta errata non produce progresso. Il gioco non richiede wallet, non assegna token o punteggi finanziari e conserva in sessione soltanto l'indice corrente.

## Cosa non è stato dichiarato “final art”

La baseline procedurale è implementata e verificata, ma non sostituisce asset originali prodotti da un 3D artist. Il repository è GLB-ready; modellazione Blender, texture e post-processing sono rinviati finché non esistono concept frame approvati. Questa distinzione impedisce di confondere una consegna tecnica solida con una produzione artistica definitiva.

## Verifiche eseguite

- parsing Node di tutti i moduli WebGL;
- contratto statico WebGL2;
- validazione delle 17 pagine e 5 data file;
- contratto editoriale;
- deployment e protocol registry esistenti;
- release readiness completa;
- smoke test Edge/Chromium di quattro scene live e fallback forzato;
- screenshot reali desktop e mobile;
- review visuale e seconda regolazione di camera/composizione.

Le immagini di review sono nella sottocartella `visual-review/`. Non sono asset di produzione.
