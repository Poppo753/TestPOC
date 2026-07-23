# Report di verifica WebGL2

Data: 23 luglio 2026.

## Risultati automatici

| Gate | Risultato |
|---|---|
| Node syntax, moduli WebGL | superato |
| `npm run check:webgl` | 4 scene, 4 factory, Three.js 0.185.1 |
| `npm run validate` | 17 pagine, 5 data file |
| `npm run check:content` | 19 fonti attive |
| `npm run check:deployment` | superato |
| `npm run inspect:protocols` | 4 integrazioni attive lette |
| `npm run ready` | superato |
| browser WebGL smoke | 4 live + fallback off |

## Review visuale

La prima cattura headless è stata scartata perché istanze Edge condividevano il profilo. La procedura è stata corretta usando profili isolati; gli screenshot validi sono conservati in `visual-review/`.

La review ha prodotto tre fix:

- Journey ingrandita e rialzata;
- Evidence Reactor ingrandito e rialzato;
- camera responsive compensata su aspect ratio stretto.

Le scene risultano visivamente distinte e non contengono particle cloud o wireframe. La baseline è coerente e molto più definita della versione rimossa; non viene certificata come art pass Blender finale.

## Header e input

Il canvas full-screen non accetta pointer event. L'header wrapper è nel livello 1000 e viene creato correttamente anche dopo il mount WebGL. Il browser smoke verifica che header e canvas coesistano; il contratto CSS impedisce sia la regressione allo stage uniforme su tutte le pagine sia il ritorno al riquadro WebGL bordato.

## Limiti del test

- SwiftShader non equivale a tutte le GPU reali;
- screenshot non misurano fluidità percepita;
- test DOM non sostituisce una sessione manuale completa con mouse/touch/screen reader;
- deployment check non è audit.

Prima della pubblicazione restano raccomandati device test reali e art review umana.
