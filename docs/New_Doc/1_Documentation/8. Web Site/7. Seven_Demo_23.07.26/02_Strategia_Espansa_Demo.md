# Jethos Interactive Demo — strategia espansa

## 1. Decisione di prodotto

La demo deve essere un “vertical slice”: un tratto completo e coerente
dell'esperienza futura, non un insieme di mockup. È preferibile implementare
bene un ciclo deposito–controllo–prelievo rispetto a mostrare molte funzioni
inerti.

Il pubblico principale è un visitatore che conosce home banking e investimenti
ma potrebbe non conoscere vault, allowance, share token o protocolli DeFi.
Pertanto la UI parla prima in termini di denaro, obiettivi e rischio; i dettagli
tecnici restano disponibili nella sezione trasparenza.

## 2. Confini funzionali

### Incluso

- sessione demo locale prefinanziata;
- dashboard patrimoniale;
- tre vault illustrativi;
- dettaglio rischio e allocazione;
- deposito con review;
- portafoglio e rendimento deterministico;
- avanzamento simulato di 30 giorni;
- prelievo totale o parziale;
- cronologia e ricevute locali;
- reset;
- routing tramite hash;
- stato persistente e versionato;
- responsive e accessibilità essenziale.

### Escluso intenzionalmente

- connessione wallet;
- account, backend e database;
- token o chain reali;
- prezzi esterni;
- firma di messaggi;
- bridge, swap e fiat on-ramp;
- performance casuali o feed di mercato;
- promessa di caratteristiche non implementate nel PoC.

## 3. Information architecture

La demo usa una shell applicativa distinta dal sito editoriale. Una rail
laterale su desktop e una barra scorrevole su mobile contengono:

1. Overview;
2. Explore vaults;
3. Portfolio;
4. Activity;
5. Transparency.

La route è codificata nell'hash per rendere ogni area navigabile senza framework
e senza configurazione server. Il documento mantiene un solo `h1`; i titoli
delle viste sono `h2`.

## 4. Modello dei dati

### Catalogo vault

Ogni vault possiede:

- id stabile;
- nome e descrizione;
- profilo di rischio;
- APY illustrativo;
- liquidità;
- colore di accento;
- elenco di allocazioni;
- elenco di rischi;
- indicatore “illustrative”.

### Stato utente

```text
schemaVersion
walletBalance
positions[vaultId].principal
positions[vaultId].daysAccrued
activity[]
simulatedDays
onboardingComplete
```

Il valore corrente è derivato, non salvato:

`principal × (1 + APY)^(days / 365)`.

Questa scelta evita drift e rende l'output riproducibile. Il prelievo converte
la proporzione richiesta del valore corrente in saldo wallet, riducendo
proporzionalmente principal e giorni accumulati.

## 5. Scenario iniziale

Il wallet parte con 10.000 demo USDC e nessuna posizione. L'utente non deve
“connettere” un wallet finto, perché ciò insegnerebbe un'interazione diversa da
quella reale. La shell comunica semplicemente che è attivo un profilo demo.

Un onboarding compatto spiega tre regole:

1. i fondi sono simulati;
2. il wallet e i vault sono confini diversi;
3. rischio e rendimento sono puramente illustrativi.

## 6. Dashboard

### Gerarchia

1. etichetta permanente della demo;
2. patrimonio totale;
3. disponibile nel wallet;
4. valore nei vault;
5. guadagno simulato;
6. azione primaria “Explore vaults”.

Il patrimonio totale non deve crescere con animazioni continue. Si aggiorna
solo dopo un'azione esplicita, rendendo chiara la causalità.

### Capital boundary

Una fascia visuale mostra wallet e vault come due contenitori. L'importo nel
wallet è marcato “under your direct control”; quello nei vault è marcato
“deposited by your explicit action and exposed to vault risks”.

## 7. Esplorazione vault

Ogni card ha la stessa struttura per rendere confrontabili i prodotti:

- profilo e nome;
- descrizione di una riga;
- APY illustrativo;
- livello di rischio;
- liquidità;
- composizione;
- “View details” e “Simulate deposit”.

L'APY non riceve dimensione o colore più aggressivi del rischio. Il vault
selezionato viene aperto in un pannello di dettaglio dentro la vista, non in un
secondo modal sovrapposto.

## 8. Deposito

La finestra usa due stati:

### Inserimento

- nome vault;
- saldo disponibile;
- campo importo;
- scorciatoie 25%, 50%, Max;
- errore inline;
- saldo residuo.

### Review

- importo;
- destinazione;
- profilo di rischio;
- APY illustrativo;
- disponibilità residua;
- nota esplicita sui rischi;
- conferma finale.

La conferma applica l'operazione in modo atomico, chiude la finestra, mostra
una notifica e indirizza al portafoglio.

## 9. Avanzamento temporale

“Simulate 30 days” aumenta il contatore globale di giorni e registra una voce
in attività. È disponibile solo con almeno una posizione. Il comando non
introduce eventi negativi o aleatori: serve a mostrare il funzionamento
contabile, non a simulare il mercato.

## 10. Prelievo

Il prelievo parte dalla posizione e usa:

- valore corrente disponibile;
- importo richiesto;
- scorciatoie 50% e Max;
- anteprima del valore che rimarrà;
- destinazione “Demo wallet”;
- review finale.

Una tolleranza numerica elimina residui infinitesimali quando si seleziona Max.

## 11. Trasparenza

La vista ha tre livelli:

### Ownership boundary

Spiega cosa è fuori e dentro il vault.

### Capital route

Per ogni posizione mostra un diagramma HTML:

`Demo wallet → Jethos vault → reserve / protocol allocations`.

Le allocazioni derivano dal catalogo e sono rappresentate con barre e
percentuali. Non sono dichiarate come allocazioni reali.

### Risk ledger

Mostra i rischi specifici del vault e una nota generale su smart contract,
protocollo, stablecoin, liquidità e amministrazione.

## 12. Attività

La cronologia più recente appare per prima e comprende:

- identificatore locale leggibile;
- data e ora;
- tipo;
- vault;
- importo;
- stato “Simulated”.

Non si genera un finto explorer link. Quando non esistono operazioni, compare
uno stato vuoto con azione utile.

## 13. Accessibilità

- landmark e titoli semantici;
- link interni con `aria-current`;
- modal con `role=dialog`, focus iniziale e chiusura Escape;
- ritorno del focus all'elemento di origine;
- errori con `role=alert`;
- notifiche con `aria-live`;
- pulsanti con target minimo;
- nessuna informazione affidata solo al colore;
- rispetto di `prefers-reduced-motion`.

## 14. Responsive

Desktop: rail laterale sticky e contenuto largo.

Tablet: rail più compatta e metriche su due colonne.

Mobile: navigazione orizzontale, card a colonna singola, modal come bottom
sheet, barre di allocazione leggibili e azioni full-width.

## 15. Integrazione nel sito

- CTA globale “Try demo” verso `demo/index.html`;
- CTA hero della landing verso la demo;
- PoC reale ancora raggiungibile dal product showcase e dal footer;
- pagina demo con `noindex,nofollow` finché il prodotto è privato;
- auth gate condiviso tramite `site-shell.js`.

## 16. Moduli e responsabilità

### `data.js`

Sola fonte del catalogo dimostrativo; oggetti congelati.

### `storage.js`

Caricamento sicuro, migrazione per reset, validazione minima, clone e
persistenza. Se il JSON è corrotto, ritorna lo scenario iniziale.

### `engine.js`

Funzioni pure o quasi-pure: calcoli, deposito, prelievo, avanzamento temporale,
riepiloghi. Nessun DOM.

### `controller.js`

Rendering, eventi, route, modal, notifiche e coordinamento della persistenza.
Tutti i contenuti dinamici entrano tramite `textContent` o creazione esplicita
di nodi; nessun dato utente viene inserito con `innerHTML`.

### `demo.css`

Stili isolati sotto prefissi `demo-`; riusa token, button, card e badge
globali senza duplicare il design system.

## 17. Validazione

Il validatore dedicato deve controllare:

- esistenza dei file;
- presenza delle cinque route;
- avvisi “no real funds”;
- `noindex`;
- assenza di import da `web3`;
- versione dello schema;
- percentuali di allocazione pari a 100;
- id vault univoci;
- collegamento dalla shell;
- script npm.

La validazione generale deve continuare a passare. Un test del motore esegue
deposito, crescita, prelievo parziale, prelievo totale e casi di errore.

## 18. Ordine operativo definitivo

1. documenti di strategia;
2. checklist verificata;
3. catalogo e modello;
4. motore e test;
5. HTML semantico;
6. controller e finestre;
7. CSS responsive;
8. integrazione sito;
9. validatori;
10. test complessivi;
11. aggiornamento checklist e manuali.

