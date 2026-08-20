# Guida script, test e debug

Eseguire i comandi dalla cartella `dapp-new`.

## Contratto statico

```bash
npm run check:webgl
```

Controlla whitelist, host, fallback, factory uniche, versione Three.js, stacking dell'header, canvas non interattivo, assenza dei vecchi moduli e divieto di wireframe/PointsMaterial nelle scene.

## Smoke browser

Avviare un server locale:

```bash
python -m http.server 4173
```

In un altro terminale:

```bash
npm run check:webgl:browser -- http://127.0.0.1:4173
```

`browser-webgl-smoke.mjs` rileva Edge/Chrome, usa profili temporanei isolati e verifica quattro mount live, canvas, header e fallback `?webgl=off`. `JETHOS_BROWSER` può indicare un eseguibile alternativo.

## Catture comparative

```bash
npm run capture:webgl -- http://127.0.0.1:4173 ./webgl-review
```

`capture-webgl-review.mjs` genera quattro PNG 1440×1000 dalla parte superiore di ogni pagina, mostrando insieme hero e background 3D. Le immagini devono essere ispezionate: il comando non può giudicare qualità estetica.

## Diagnostica runtime

Aprire una scena con:

```text
?webglDebug=1
```

Combinazioni utili:

```text
?webgl=low&webglDebug=1
?webgl=high&webglDebug=1
?webgl=off
```

## Gate completo

```bash
npm run ready
```

Comprende sito, contenuto, WebGL2, deployment e registry. Il passaggio non equivale ad audit o approvazione production.

## Checklist manuale minima

1. usare link header sopra ogni scena;
2. aprire e chiudere menu mobile;
3. usare Tab e Invio sui controlli;
4. provare replay e quattro step;
5. selezionare ogni protocol layer;
6. completare e resettare Proof Path;
7. verificare reduced motion a livello OS;
8. verificare rete bloccata/CDN fallita;
9. controllare portrait e landscape su dispositivo reale;
10. controllare console e memory dopo navigazioni ripetute.
