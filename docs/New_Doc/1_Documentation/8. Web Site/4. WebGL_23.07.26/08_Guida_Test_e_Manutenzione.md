# Guida test e manutenzione WebGL

## Test statici

```powershell
npm run check:webgl
npm run validate
npm run check:content
```

`validate-webgl.mjs` controlla tredici scene, versione Three pinned, configurazioni e assenza WebGL nei redirect.

## Release gate

```powershell
npm run ready
```

Include anche diagnostica deployment e protocolli. Rimane read-only.

## Test manuali obbligatori

1. `?webgl=high` desktop 1440 px.
2. `?webgl=medium` mobile 500 px.
3. `?webgl=low` su throttling.
4. `?webgl=off`: nessun canvas, contenuto completo.
5. reduced motion: quality `static` e un solo frame.
6. cambio dimensione e orientamento.
7. tab nascosta/visibile.
8. tutte le risposte Proof Path e Reset.
9. slider Risk e profili Vault.
10. App: input, modal, refresh e wallet UI.

## Debug

Ispezionare:

- `document.documentElement.dataset.webglState`;
- `document.documentElement.dataset.webglQuality`;
- `document.documentElement.dataset.webglFallback`;
- presenza di `.webgl-canvas`;
- console warnings del loader.

## Upgrade Three.js

1. Aggiornare solo `THREE_VERSION`.
2. Verificare URL CDN e CSP.
3. Eseguire sintassi e manifest.
4. Renderizzare tutte le scene.
5. Provare dispose/page navigation.
6. Confrontare desktop/mobile e performance.

## Prestazioni

Non aumentare particelle, DPR o segmenti contemporaneamente. Misurare prima. Evitare texture, GLTF e post-processing finché non esiste un budget asset/GPU documentato.

