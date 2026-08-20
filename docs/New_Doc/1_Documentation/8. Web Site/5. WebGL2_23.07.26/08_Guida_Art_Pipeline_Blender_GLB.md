# Guida art pipeline Blender e GLB

## Perché è una fase separata

Il motore non crea art direction. Gli asset finali richiedono concept, silhouette, materiali e animazione approvati. Sostituire ora le geometrie con modelli generici scaricati sposterebbe il problema senza risolverlo.

## Ordine consigliato

1. esportare gli screenshot baseline come reference di composizione;
2. creare tre concept frame per Home e due per Protocol/Roadmap;
3. approvare una sola direzione, inclusa variante mobile;
4. modellare in Blender con scala coerente e pivot intenzionali;
5. nominare nodi semanticamente (`WalletCore`, `AuthorizationGate`, `VaultChamber`);
6. creare animazioni corte e cicli con pause;
7. esportare GLB PBR;
8. caricare tramite `asset-loader.js` mantenendo fallback procedurale;
9. misurare peso, memoria, draw call e tempo di first render;
10. comprimere solo dopo il profiling;
11. rieseguire screenshot e smoke su hardware reale;
12. valutare post-processing soltanto alla fine.

## Asset suggeriti

### Home

- wallet core con shell divisibile;
- gate con un meccanismo di apertura visibile;
- vault chamber trasparente con camere interne;
- tre ribbon di capitale, non centinaia di punti.

### Protocol

- quattro chassis modulari;
- connettori e porte riconoscibili;
- Registry, Plugin, LensAdapter come moduli con silhouette diverse.

### Roadmap

- gate architettonici;
- core di verifica;
- stati cold/current/stable costruiti soprattutto con materiale e luce.

## Budget da definire con asset reali

Non fissare numeri arbitrari prima di conoscere target e dispositivi. Registrare per ogni GLB: byte trasferiti, texture GPU, vertici, triangoli, materiali, draw call e tempo di parsing. La variante mobile può usare mesh o texture differenti se la misurazione lo giustifica.

## Unity e Unreal

Non devono entrare nel sito principale. Possono essere considerati per un'esperienza standalone futura con obiettivo, deployment e budget separati. L'eventuale progetto non deve diventare dipendenza di navigazione, documentazione o PoC.

