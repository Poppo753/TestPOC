# Report fase 3 — grafica

## Esito

L'identità visiva non dipende più soltanto da gradienti e grandi titoli. Il motivo ricorrente è il confine tra capitale nel wallet e capitale autorizzato nel vault, accompagnato dalla route leggibile verso i protocolli.

## Sistema introdotto

- marchio SVG Jethos locale e riutilizzabile;
- icone SVG accessibili, senza librerie esterne;
- dashboard hero con boundary, stati e route/proof strip;
- bento grid per le capacità principali;
- comparison grid e receipt di trasparenza;
- connettori e livelli più leggibili nei diagrammi;
- section band, mesh, profondità e hover più coerenti;
- page hero interne riconoscibili;
- CTA finale e console PoC ricondotte allo stesso linguaggio visivo.

## Motion e accessibilità

Il pulse del capitale e le animazioni di route servono a chiarire un flusso, non a decorare. `prefers-reduced-motion` le disattiva. Focus, contrasto, navigazione responsive e assenza di overflow sono stati controllati su desktop e mobile.

## Scelta tecnica

Non sono stati aggiunti video, bitmap generative, Three.js o dipendenze pesanti. SVG, CSS e DOM sono sufficienti per questa identità, restano nitidi e riducono costo di caricamento e manutenzione.

