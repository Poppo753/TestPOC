# Indice consegna WebGL2

1. `00_Spiegazione_Generale_WebGL2.md` — decisione e nuova direzione.
2. `01_Piano_Espanso_WebGL2.md` — strategia, scene, prestazioni e ordine.
3. `02_Riesame_Critico_Strategia.md` — correzioni apportate al piano.
4. `03_Checklist_WebGL2.md` — stato task verificato.
5. `04_Report_Implementazione.md` — modifiche effettive e confini.
6. `05_Guida_Architettura_e_Runtime.md` — responsabilità di ogni modulo.
7. `06_Guida_Scene_e_Interazioni.md` — semantica delle quattro scene.
8. `07_Guida_Script_Test_Debug.md` — comandi e manutenzione.
9. `08_Guida_Art_Pipeline_Blender_GLB.md` — evoluzione verso final art.
10. `09_Report_Verifica.md` — evidenze e limiti dei test.
11. `10_Indice_Consegna.md` — questo indice.
12. `visual-review/` — screenshot diagnostici, non asset di produzione.

## Punti di ingresso nel codice

- CSS: `dapp-new/assets/css/webgl.css`
- runtime: `dapp-new/assets/js/webgl/bootstrap.js`
- scene: `dapp-new/assets/js/webgl/scenes/`
- validazione statica: `dapp-new/scripts/validate-webgl.mjs`
- smoke browser: `dapp-new/scripts/browser-webgl-smoke.mjs`
- catture: `dapp-new/scripts/capture-webgl-review.mjs`

## Stato sintetico

Architettura, fix header, quattro scene, fallback, responsive, reduced motion, diagnostica, smoke e guide sono completati. Concept e asset Blender originali restano intenzionalmente un art pass successivo subordinato ad approvazione visuale; l'infrastruttura GLB è predisposta.

