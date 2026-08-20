# Riesame critico della strategia

## Cosa viene confermato

- **Three.js resta la tecnologia adatta.** Il progetto è un sito editoriale e applicativo; non necessita del runtime e del deployment di un game engine.
- **Blender è l'art pipeline corretta.** La qualità finale dipenderà soprattutto da asset, materiali, luce e animazione, non dal cambio di engine.
- **Il 3D deve essere raro.** Quattro scene sono già un investimento importante e sufficiente a dare identità.
- **L'app non deve avere ambient motion.** Durante operazioni finanziarie la chiarezza prevale sullo spettacolo.
- **La roadmap è il luogo giusto per l'interazione più ludica.** È esplorativa, non transazionale.

## Cosa è stato corretto rispetto all'idea iniziale

### Non attendere asset Blender per ogni miglioramento

Bloccare l'intero lavoro fino alla produzione di GLB avrebbe lasciato il sito rotto. La strategia revisionata introduce subito composizioni solide procedurali e una pipeline GLTF pronta, separando correzione tecnica e produzione artistica.

### Non usare scroll storytelling ovunque

Una camera vincolata all'intero documento può creare nausea, rendere fragile il layout e complicare mobile. La Home usa una sequenza autonoma; How e Protocol reagiscono a controlli espliciti; Roadmap reagisce alle scelte. Lo scroll serve soltanto per avviare o fermare il rendering in viewport.

### Non usare post-processing nella baseline

Bloom e depth of field possono migliorare una scena già buona, ma non correggono una composizione debole e aumentano costo e fragilità. La baseline usa tone mapping, luci e materiali. Il post-processing resta un gate successivo, misurato.

### Non rendere il canvas cliccabile

Raycasting e hotspot 3D sono affascinanti, ma rendono accessibilità e input più complessi. Tutte le azioni hanno controlli HTML. Il puntatore può influenzare lievemente la camera senza intercettare click.

### Non promettere una “suite completa di asset” inesistente

Il codice include slot e loader per futuri GLB, ma non finge che primitive procedurali siano modelli Blender finali. Documentazione e diagnostica distinguono baseline implementata e art pass successivo.

## Rischi residui

- Three.js è caricato da CDN: offline o CSP restrittive attivano il fallback.
- La qualità artistica della baseline resta inferiore a modelli custom prodotti da un 3D artist.
- Test automatici statici non sostituiscono review visuale su GPU e dispositivi reali.
- Materiali trasparenti richiedono attenzione a sorting e mobile.
- Il minigioco deve restare breve: più domande non equivalgono a migliore esperienza.

## Decisione finale

Procedere con quattro background full-screen autonomi, baseline solida e asset pipeline Blender-ready. Il canvas resta page-scoped anche se riempie il viewport. Considerare la fase completa soltanto quando navigazione, fallback, differenziazione delle scene e release gate risultano verificati. Considerare la qualità “final art” una fase distinta che richiede concept approvati e asset originali.
