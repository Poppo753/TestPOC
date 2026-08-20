# Jethos WebGL2 — spiegazione generale

## Decisione

La prima integrazione WebGL viene sostituita, non semplicemente ritoccata. Il problema non era lo sfondo globale in sé: era l'uso dello stesso scenario wireframe su quasi ogni pagina, insieme a uno stacking errato. La seconda prova in riquadri locali è stata ugualmente scartata perché sembrava una demo tecnica. La soluzione definitiva conserva veri background full-screen, ma soltanto su quattro pagine e con scene differenti.

La nuova architettura usa il 3D solo quando chiarisce un concetto o crea un momento memorabile:

1. **Home — Ownership Core:** capitale disponibile, autorizzazione esplicita e capitale investito diventano tre oggetti solidi e distinti.
2. **How it works — Capital Journey:** una sequenza narrativa mostra Hold, Authorize, Deposit e Withdraw.
3. **Protocol — Transparent Stack:** livelli solidi ed esplosi rendono leggibili custodia, accounting, orchestrazione e integrazioni.
4. **Roadmap — Evidence Reactor:** un'esperienza interattiva opzionale trasforma le milestone in gate verificabili.

App, documentazione, FAQ, security, trust center, vault listing, risk, vision e developer pages non montano un renderer. Conservano CSS, SVG, grafici e micro-motion accessibili. Questo evita che l'effetto speciale diventi rumore.

## Posizionamento visuale

Jethos è presentato come una casa finanziaria decentralizzata e self-custodial. Il messaggio non deve diventare un attacco insistente alle banche; deve rendere evidente la differenza strutturale:

- il capitale non depositato resta nel wallet controllato dall'utente;
- un passaggio esplicito separa disponibilità e investimento;
- il vault segue regole pubbliche e percorsi osservabili;
- trasparenza non significa assenza di rischio;
- self-custody non elimina il rischio di chiavi, firme e approval compromessi.

Il 3D serve a rendere visibili queste soglie, non a suggerire sicurezza assoluta o rendimenti.

## Linguaggio grafico

La nuova grammatica elimina nuvole di punti, stelle casuali e wireframe sottili. Usa invece:

- volumi solidi con materiali fisici;
- vetro controllato soltanto per ciò che deve comunicare ispezionabilità;
- luce mint per il wallet e il capitale non depositato;
- luce amber per autorizzazioni e confini;
- viola per vault e accounting;
- cyan per evidenza, lettura e integrazioni;
- camera lenta, stabile, con reazione minima al puntatore;
- animazioni con inizio, sviluppo e conclusione leggibili.

## Architettura tecnica

Ogni esperienza possiede un solo host HTML ma il canvas è un layer full-screen fisso dietro la pagina. Non esistono bordo, riquadro, shadow o card WebGL. Il canvas non controlla navigazione, testi, pulsanti o stato finanziario. Il bootstrap seleziona una factory diversa per ogni scena; non esiste più un `capital-world` parametrico condiviso.

Il sistema è diviso in:

- bootstrap e ciclo di vita;
- manifest delle sole scene abilitate;
- renderer e qualità adattiva;
- libreria visuale condivisa;
- quattro scene autonome;
- bridge semantico tra HTML e 3D;
- fallback statico;
- diagnostica automatica.

## Risultato atteso

Il sito deve continuare a essere completo senza WebGL. Con WebGL disponibile, quattro pagine ricevono esperienze chiaramente diverse e contestuali. La qualità definitiva potrà crescere sostituendo gradualmente le geometrie procedurali con asset GLB creati in Blender, senza cambiare l'architettura.
