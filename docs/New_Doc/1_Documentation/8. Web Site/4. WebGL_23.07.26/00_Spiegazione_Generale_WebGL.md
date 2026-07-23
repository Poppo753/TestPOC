# Jethos WebGL — spiegazione generale

## Obiettivo

L'integrazione WebGL non deve aggiungere un “video di sfondo”. Deve trasformare il principio Jethos in una grammatica spaziale riconoscibile:

```text
wallet → autorizzazione → vault → protocolli → prova
```

Il movimento ha significato:

- particelle mint: capitale visibile nel wallet;
- gate amber: firma, approval o limite;
- strutture violet: capitale soggetto a regole programmabili;
- linee cyan: route, osservabilità e prova;
- distorsione/instabilità: rischio o dipendenza;
- opacità: stato futuro o non ancora verificato.

## Principio di prodotto

Ogni pagina usa lo stesso universo, ma con intensità diversa. Home, How it works e Roadmap sono immersive. Vaults, Risk, Protocol, Security e Vision sono interattive. Trust, Developers e Docs sono tecniche. FAQ e App usano soltanto motion funzionale.

## Architettura proposta

Il sito resta statico e framework-free. Un canvas condiviso viene creato soltanto su pagine abilitate. Three.js viene importato dinamicamente da una versione pinned. Il contenuto HTML resta completo prima e dopo il caricamento: WebGL è progressive enhancement.

Il sottosistema comprende:

- loader e capability detection;
- quality manager adattivo;
- scene controller e lifecycle;
- factory di oggetti condivisi;
- configurazioni specifiche per pagina;
- interaction bridge tra DOM e scena;
- scroll timeline;
- Roadmap evidence game;
- fallback statico e reduced motion;
- validazione automatica di manifest e scene.

## Esperienza per pagina

- **Home:** capital path completo e ownership boundary.
- **How it works:** una particella percorre hold, authorize, deposit, route e withdraw.
- **Vaults:** tre strutture e profili con complessità crescente.
- **Risk:** rete che reagisce a concentrazione, liquidità e leverage illustrativi.
- **Trust:** topology sobria che pulsa solo su aggiornamento dati.
- **Protocol:** architettura esplosa con core, plugin e lens.
- **Security:** onde di rischio e anelli di difesa.
- **Roadmap:** minigioco Proof Path basato su gate ed evidenze.
- **Vision:** espansione dal singolo vault al financial home.
- **Developers:** chiamate animate attraverso moduli e contratti.
- **Docs:** knowledge graph leggero.
- **FAQ:** micro-motion DOM; WebGL quasi statico.
- **App:** preview funzionale dell'importo e degli step, mai distrazione.

## Non obiettivi

Nessun dato finanziario viene inventato dal 3D. Nessun effetto rappresenta un audit. Nessuna scena esegue transazioni. Nessun punteggio Roadmap implica rendimento o sicurezza. Il sito deve restare navigabile con WebGL disabilitato.

