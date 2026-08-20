# Guida architettura e runtime

## Flusso

```text
body[data-webgl-scene]
        ↓
bootstrap.js ── manifest ── factory scena
        ↓
quality + Three loader
        ↓
SceneController ── renderer/camera/lifecycle
        ↓
interaction-bridge ← controlli HTML
```

## File runtime

### `bootstrap.js`

È l'unico entry point pubblico. Verifica scena, host, preferenze e WebGL2; crea il canvas; carica Three.js e la factory in parallelo; installa bridge e gioco; gestisce fallback ed eliminazione a `pagehide`.

Una pagina senza `data-webgl-host` termina immediatamente e non carica Three.js.

### `scene-manifest.js`

È la whitelist. Ogni voce contiene modulo, posizione camera, FOV e frame rate massimo. Due scene non possono condividere lo stesso modulo: il validatore lo vieta.

Per aggiungere una scena bisogna prima giustificare perché il 3D chiarisce quella pagina; poi creare una factory separata, host/fallback HTML e contratto di validazione.

### `scene-controller.js`

Possiede:

- `WebGLRenderer` locale;
- camera prospettica;
- tone mapping e color space;
- `ResizeObserver` sul viewport;
- `IntersectionObserver` per fermare rendering fuori schermo;
- Page Visibility per fermare tab nascoste;
- parallasse minima del puntatore;
- profilo statico per reduced motion;
- rilascio GPU e listener.

Le scene non devono creare un secondo renderer o listener globali.

### `quality-manager.js`

Combina reduced motion, save-data, memoria, core e viewport. Override:

- `?webgl=off`
- `?webgl=low`
- `?webgl=medium`
- `?webgl=high`

`off` mantiene il fallback; `static` costruisce la scena ma renderizza un frame.

### `three-loader.js`

Carica una versione Three.js esatta da jsDelivr con timeout. Aggiornare la versione soltanto dopo smoke e visual review.

### `visual-kit.js`

Contiene palette, resource tracker, materiali, luci, plinth, tube ed easing. Una nuova scena dovrebbe riutilizzare questo vocabolario senza trasformarlo in un generatore di scene identiche.

### `asset-loader.js`

È il punto di ingresso GLTF/GLB per il futuro art pass. Non viene invocato dalla baseline: se manca un asset, la scena procedurale resta completa.

### `interaction-bridge.js`

Ascolta controlli HTML e invia patch semantiche al controller. Non deve leggere saldo, rendimento o stato wallet per produrre effetti decorativi.

### `fallback.js`

Rimuove un canvas non valido, registra motivo e mantiene la composizione CSS. Non nasconde mai l'intera sezione.

### `debug-panel.js`

Con `?webglDebug=1` mostra scena, qualità, fps campionato, draw call e triangoli. È diagnostica, non benchmark scientifico.

## Contratto di una scene factory

Ogni file in `scenes/` esporta:

```js
export function createScene(THREE, scene, quality) {
  return {
    root,
    state,
    setState(patch),
    update(time, delta),
    dispose(),
  };
}
```

Geometrie e materiali devono essere registrati nel resource tracker. `dispose()` deve liberarli.

