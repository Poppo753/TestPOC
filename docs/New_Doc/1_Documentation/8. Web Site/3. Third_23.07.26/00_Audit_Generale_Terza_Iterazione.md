# Audit generale — terza iterazione

## Valutazione sintetica

La seconda iterazione è solida: il sito ha una narrativa coerente, una console PoC prudente e un sistema visuale consistente. La terza non deve ricominciare da zero. Deve rimuovere gli ultimi segnali di genericità e trasformare tre idee in infrastruttura concreta: **controllo**, **autorizzazione**, **prova**.

## Architettura: cosa ristrutturare

1. Header, footer, navigazione e tassonomia degli stati sono ancora definiti in modo troppo locale. Conviene creare una configurazione condivisa e costruire la shell con API DOM sicure.
2. Le due CLI live duplicano setup del provider, output e normalizzazione. Serve una piccola libreria operativa comune.
3. Manca un comando unico di readiness che combini validazione statica, coerenza editoriale e diagnostica live.
4. Refresh pubblici, cambio wallet e refresh utente possono sovrapporsi. Il controller deve ignorare risposte diventate obsolete.
5. La documentazione tecnica descrive gli script, ma non esiste ancora un inventario generato dello stato del sito.

Non conviene introdurre framework, database, backend o scritture dirette ai plugin. Il confine corretto resta: utente → core Jethos → integrazioni approvate.

## Contenuti: cosa migliorare

Il messaggio è corretto ma può diventare più memorabile. “Your self-custodial financial home” spiega la categoria; non esprime subito la differenza. La nuova apertura consigliata è:

> **Home banking, rebuilt around ownership.**

con prova immediata:

> Jethos cannot move assets you have not deposited or separately approved. When you invest, the route remains visible.

È più preciso di “nessuno può toccarli”: chi possiede le chiavi, allowance precedenti, token issuer e vulnerabilità restano rischi reali. Il sito deve rappresentare l'intenzione dell'utente senza creare un'assolutezza tecnicamente falsa.

Serve inoltre un Trust Center che riunisca stato PoC, fonti, contratti, controlli, limiti e significato dei badge. Oggi queste informazioni esistono, ma sono distribuite.

## Grafica: cosa migliorare

Il purple/cyan è curato ma ancora vicino al linguaggio DeFi comune. L'identità può diventare più proprietaria attraverso:

- un “capital path” continuo wallet → authorization → vault → protocols;
- colori semantici: mint per capitale sotto controllo, violet per capitale programmato, amber per limiti;
- una hero più editoriale e meno simile a una dashboard SaaS;
- proof cards con numerazione e provenance visibile;
- maggiore variazione di ritmo, dimensione e composizione tra sezioni;
- un Trust Center visivamente simile a un control room, senza simulare certificazioni.

## Obiettivo della terza iterazione

Rendere Jethos riconoscibile anche rimuovendo logo e nome: il visitatore deve percepire immediatamente il confine di proprietà, l'atto di autorizzazione e la tracciabilità del capitale.

