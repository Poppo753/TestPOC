# Guida completa motore e script WebGL

## `bootstrap.js`

Entry point pubblico. Legge `data-webgl-scene`, applica override `?webgl=`, controlla supporto, crea canvas decorativo, importa Three.js, monta controlli e avvia il controller. Qualsiasi errore attiva il fallback senza interrompere la pagina.

Uso indiretto:

```js
import { initWebGLExperience } from '../webgl/bootstrap.js';
initWebGLExperience();
```

È già richiamato da `site-features.js`.

## `scene-manifest.js`

Contiene versione Three.js e configurazioni scene. Per una nuova scena aggiungere un record con `density`, `cameraZ`, `drift`, `layout` ed eventualmente `maxFps`. Non inserire dati finanziari o indirizzi.

## `quality-manager.js`

Legge reduced motion, Save-Data, viewport, memoria e core logici. Produce il budget di particelle, FPS, DPR e segmenti. Override locali:

- `?webgl=off`: nessun canvas;
- `?webgl=low`;
- `?webgl=medium`;
- `?webgl=high`.

## `three-loader.js`

Import lazy da jsDelivr con versione pinned e timeout. Non cambiare versione senza eseguire validatore e test runtime.

## `scene-controller.js`

Possiede scene, camera, renderer, world e loop. Gestisce resize, pointer parallax, scroll, visibility, FPS cap e teardown. Le API per le integrazioni sono:

```js
controller.setState({ risk: 0.5 });
controller.pulse(1);
controller.start();
controller.stop();
controller.dispose();
```

## `capital-world.js`

Costruisce tutte le primitive condivise e conserva i resource handle. `update()` anima rotazioni, trasferimento particelle, rischio, profili, espansione Vision, protocol focus e pulse. I valori sono visuali normalizzati 0–1, non metriche onchain.

## `interaction-bridge.js`

Collega focus, hover, slider, bottoni, FAQ e input App allo state semantico. Non deve importare ethers né chiamare contratti. L'App sospende il renderer quando il modal di conferma è aperto.

## `page-controls.js`

Genera controlli accessibili per Vaults, Risk, Security e Developers. I controlli vengono montati soltanto dopo inizializzazione WebGL riuscita e sono sempre marcati illustrativi.

## `roadmap-game.js`

Gestisce Proof Path, domande, risposte, progress rail, reset e `sessionStorage`. Non usare localStorage, wallet o backend per la progressione.

## `scroll-timeline.js`

Normalizza progressione documento/elemento. Mantiene la matematica di scroll fuori dal renderer.

## `fallback.js`

Rimuove lo stage e registra `data-webgl-state` e `data-webgl-fallback` per debug e CSS.

## CSS

`assets/css/webgl.css` gestisce compositing, mask, controlli e minigioco. È importato da `base.css`, quindi non occorre aggiungerlo manualmente a ogni pagina.

