# Jethos Website — audit generale della seconda iterazione

Versione 1.0 — 23 luglio 2026

## Esito sintetico

La prima iterazione ha corretto il posizionamento e creato una base funzionante. Non deve essere rifatta da zero. La seconda iterazione deve trasformarla da “buona implementazione informativa” a sistema più mantenibile, più memorabile e più chiaramente Jethos.

## 1. Architettura

### Cosa funziona

- sito statico senza build obbligatoria;
- pagine e App separate;
- configurazione deployment e ABI centralizzate;
- letture, stime, transazioni ed eventi separati;
- validatore locale;
- funzionamento senza wallet;
- azioni consumer limitate agli entry point Jethos.

### Cosa migliorare

1. `app-controller.js` concentra stato, rendering, form, modal e workflow.
2. I JSON editoriali sono validati ma non alimentano realmente le viste.
3. Manca una diagnostica CLI riutilizzabile del deployment e dei protocolli.
4. Il validatore non confronta ancora `deployments.json` con `deployment-config.js`.
5. Il codice DOM dinamico può essere ulteriormente reso sicuro e uniforme.
6. Non esiste una cartella App distinta da quella web3.
7. Le pagine HTML sono poco formattate e difficili da revisionare manualmente.
8. Manca una configurazione esemplificativa degli header di sicurezza per hosting statico.

### Decisione

Mantenere Vanilla ES modules e sito statico. Separare la consumer App in `assets/js/app`, aggiungere servizi di rendering/form/workflow, usare i dati JSON per sezioni aggiornabili e creare script read-only di diagnostica. Non introdurre React/Vite in questa fase: aggiungerebbe build e dipendenze senza risolvere il problema principale.

## 2. Contenuti

### Cosa funziona

- financial home come identità;
- separazione wallet/vault;
- status PoC/Planned/Vision;
- linguaggio prudente sul rischio;
- rimozione di maximum yield e claim assoluti;
- trasparenza del vault spiegata.

### Cosa migliorare

1. Il messaggio sulla proprietà è corretto ma non ancora memorabile.
2. “Financial home” viene ripetuto molto e rischia di diventare astratto.
3. Hold/Invest/Send/Understand non distingue abbastanza capacità attuali e direzione.
4. Manca una comparazione sobria fra conto intermediato, wallet e vault.
5. Manca una sezione “What Jethos is / is not”.
6. Manca una FAQ che risponda alle obiezioni più naturali.
7. Alcune frasi sono tecniche prima che emotive.
8. La trasparenza deve essere mostrata come esperienza: dove, perché, costo, uscita.

### Decisione

Adottare tre frasi proprietarie:

- **What stays in your wallet stays under your control.**
- **Invest only what you choose.**
- **See the route, not just the result.**

Integrare una comparazione non polemica e dichiarare con precisione che chi controlla chiavi e autorizzazioni controlla il wallet. Presentare il vault come capitale programmato da regole pubbliche, non come assenza di intermediari o rischio.

## 3. Grafica

### Cosa funziona

- palette coerente;
- gerarchia pulita;
- dashboard hero efficace;
- responsive valido;
- card e diagrammi leggibili;
- assenza di librerie 3D pesanti.

### Cosa migliorare

1. Il logo “J” è generico.
2. Le card hanno forme troppo uniformi.
3. Mancano metafore visuali proprietarie.
4. Il confine wallet/vault può diventare il principale elemento grafico.
5. Le sezioni sono ordinate ma poco cinematografiche.
6. Le lettere H/I/S/U sembrano placeholder.
7. Il sito ha poche micro-interazioni informative.
8. La dashboard può comunicare ownership e trasparenza in modo più ricco.

### Decisione

Creare un'identità grafica basata su:

- una “J” formata da due flussi, wallet e vault;
- una ownership boundary luminosa;
- linee di capitale che si muovono soltanto dopo un deposito esplicito;
- bento layout con dimensioni differenziate;
- icone SVG coerenti;
- superfici alternate e sezioni più riconoscibili;
- motion leggero, disattivato con reduced motion.

## 4. Priorità

1. Rifattorizzazione App senza cambiare comportamento.
2. Script diagnostici e controllo config.
3. Copy centrale e comparazione.
4. FAQ e chiarezza status.
5. Brand mark e visual wallet/vault.
6. Bento, icone e motion.
7. Verifica funzionale e visual regression manuale.

## 5. Limiti invariati

- nessuna modifica Solidity;
- nessuna transazione mainnet di test;
- nessuna UI amministrativa;
- nessuna chiamata consumer diretta ai plugin;
- nessun claim di banca regolamentata o deposito assicurato;
- nessuna promessa che una chiave compromessa o un approval malevolo non possa muovere asset.

