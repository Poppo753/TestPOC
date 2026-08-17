# Guida Proof Path Roadmap

## Scopo

Proof Path insegna che una roadmap credibile procede per evidenze, non per date arbitrarie. È un'esperienza opzionale e non sostituisce la roadmap testuale.

## Gate

1. **Deployment:** bytecode e chain ID.
2. **Accounting:** pool value, reserve e share supply.
3. **Integrations:** Registry, Plugin e LensAdapter.
4. **Safety:** pause, recovery e withdrawal test ripetibili.
5. **Readiness:** distinguere evidence, audit e autorizzazione produttiva.

## Stato

La progressione è salvata in `sessionStorage` sotto `jethos-roadmap-gate`. Si chiude con la tab. Reset cancella soltanto questa chiave.

## Accessibilità

Domande e risposte sono heading e button HTML; il rail è supplementare. Non c'è drag, timer o dipendenza da colori. La tastiera usa il comportamento nativo dei button.

## Modifica contenuti

Le domande sono nell'array `GATES` di `roadmap-game.js`. Ogni gate contiene `title`, `prompt`, `answers` e indice `correct`. Dopo una modifica eseguire test manuale completo e `npm run check:webgl`.

## Regole non negoziabili

- niente wallet connection;
- niente token, reward o punteggi;
- niente frasi che implicano audit;
- niente blocco della roadmap HTML;
- niente stato server-side o tracking.

