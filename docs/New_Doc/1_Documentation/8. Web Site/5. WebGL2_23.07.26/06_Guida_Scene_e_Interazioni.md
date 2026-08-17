# Guida scene e interazioni

## Ownership Core

Pagina: Home. Modulo: `scenes/ownership-core.js`.

Il core mint è il capitale nel wallet. L'anello amber è l'autorizzazione. La camera viola è il vault trasparente. I pulse viaggiano lungo un tube continuo soltanto durante una finestra della sequenza. “Replay capital path” riavvia la timeline; non effettua transazioni.

Da non fare:

- trasformare ogni asset in una particella;
- suggerire che un wallet non possa essere compromesso;
- associare dimensione del core a un saldo reale senza consenso e specifica;
- aumentare la velocità per rendere la scena più “viva”.

## Capital Journey

Pagina: How it works. Modulo: `scenes/capital-journey.js`.

Quattro stazioni hanno geometrie differenti. I pulsanti Hold, Authorize, Deposit e Withdraw sono controlli reali; cambiano `focus`, spostano la capital unit e mettono in evidenza una stazione. I paragrafi sottostanti restano la descrizione completa.

Per collegare un nuovo step bisogna aggiornare insieme HTML, bridge e semantica della factory; non è sufficiente aggiungere un quinto oggetto.

## Transparent Stack

Pagina: Protocol. Modulo: `scenes/protocol-stack.js`.

I quattro layer rappresentano entry, custody/accounting, orchestration e integrations. “Complete stack” ripristina la vista globale. I tre blocchi laterali rappresentano Registry, Plugin e LensAdapter senza fingere topologie contract precise.

La scena è una mappa concettuale. Nomi, ABI e dipendenze effettive restano nella documentazione tecnica.

## Evidence Reactor

Pagina: Roadmap. Modulo: `scenes/evidence-reactor.js`.

Il progress del gioco è normalizzato tra 0 e 1. I gate completati diventano mint, il corrente amber, i futuri restano freddi. Il core percorre la curva con easing; il completamento stabilizza la struttura senza effetti celebrativi eccessivi.

Il contenuto delle domande è in `roadmap-game.js`. Ogni risposta deve rappresentare evidenza reale, non una preferenza di marketing.

## Accessibilità delle interazioni

- i canvas sono ignorati dalle tecnologie assistive;
- i pulsanti mantengono testo comprensibile senza scena;
- `aria-pressed` comunica la selezione;
- Proof Path usa `aria-live`;
- non esistono hotspot disponibili soltanto con mouse;
- reduced motion conserva la composizione e i controlli.

