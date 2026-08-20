# Jethos Interactive Demo — spiegazione e strategia

## 1. Obiettivo

Il sito descrive Jethos come un'esperienza finanziaria self-custodial costruita
attorno a vault trasparenti. Una descrizione, però, non consente al visitatore di
capire davvero come ci si senta a usare il prodotto. La nuova Interactive Demo
deve colmare questa distanza.

La demo è una piccola applicazione frontend realmente interattiva, ma
completamente simulata:

- non collega wallet;
- non usa RPC o smart contract;
- non richiede firme;
- non sposta denaro;
- non rappresenta rendimenti o disponibilità reali;
- conserva le operazioni simulate soltanto nel browser.

Il risultato deve permettere di vivere il ciclo principale:

`saldo disponibile → esplorazione vault → deposito → monitoraggio → trasparenza → prelievo`.

## 2. Separazione dalla console PoC

`app.html` resta la console tecnica del PoC USDC. La demo viene collocata in
`demo/index.html`, con moduli e stili dedicati.

Questa separazione impedisce tre equivoci:

1. la demo non viene scambiata per l'interfaccia del deployment;
2. nessun componente simulato entra nei moduli Web3 reali;
3. la demo può evolvere come esperienza di prodotto senza alterare la console.

## 3. Esperienza proposta

### Dashboard

Mostra il patrimonio simulato, la quota disponibile nel wallet demo, la quota
depositata e il guadagno illustrativo. Deve offrire un punto di partenza chiaro
anche a chi non conosce la DeFi.

### Vault explorer

Presenta tre profili illustrativi, non prodotti disponibili:

- Reserve: liquidità e stabilità come priorità;
- Balanced: diversificazione prudente;
- Growth: maggiore variabilità e rischio.

Ogni scheda espone APY illustrativo, livello di rischio, liquidità, composizione
e principali rischi. Il rendimento non deve mai essere l'unico criterio visivo.

### Deposito simulato

Una finestra guidata permette di:

1. inserire un importo;
2. vedere il saldo residuo;
3. leggere cosa succederebbe;
4. confermare l'operazione demo.

Il deposito riduce il saldo disponibile e crea o incrementa la posizione.

### Portafoglio

Raggruppa le posizioni e distingue sempre:

- capitale depositato;
- valore simulato corrente;
- variazione illustrativa;
- disponibilità di prelievo.

### Trasparenza

La sezione “Where is my money?” deve rendere visibile il confine di custodia:

- il saldo non depositato resta nel wallet dell'utente;
- solo l'importo esplicitamente depositato entra nel percorso del vault;
- il percorso simulato mostra allocazioni, protocolli e riserva;
- un vault trasparente non elimina rischio tecnico, di protocollo o liquidità.

### Attività

Ogni deposito, prelievo, avanzamento temporale e reset genera una ricevuta
locale con data, tipo, importo e stato. Non si inventano hash di transazione.

### Prelievo

La finestra di prelievo presenta importo, valore residuo e destinazione. Dopo la
conferma, il saldo torna nel wallet demo e la posizione viene aggiornata.

## 4. Persistenza e simulazione

Lo stato vive in `localStorage` con:

- versione dello schema;
- saldo wallet;
- posizioni;
- cronologia;
- numero di giorni simulati;
- stato dell'onboarding.

Un reset ripristina sempre lo scenario iniziale. La crescita è deterministica:
usa l'APY illustrativo e i giorni simulati, senza casualità e senza animazioni
che possano far sembrare i dati live.

## 5. Linguaggio e sicurezza comunicativa

La dicitura “Interactive demo — no real funds” rimane visibile nella shell
dell'app. Le etichette usano “illustrative”, “simulated” e “demo”; non usano
“live”, “guaranteed” o formulazioni equivalenti.

Il messaggio sulla proprietà deve essere preciso:

- i fondi non depositati non entrano nel vault;
- depositare espone la quota depositata ai rischi dichiarati;
- self-custody non significa assenza di rischio;
- la demo descrive il modello, non prova la sicurezza del sistema reale.

## 6. Architettura proposta

```text
dapp-new/
├── demo/
│   └── index.html
├── assets/
│   ├── css/
│   │   └── demo.css
│   └── js/
│       └── demo/
│           ├── data.js
│           ├── storage.js
│           ├── engine.js
│           └── controller.js
└── scripts/
    └── validation/
        └── validate-demo.mjs
```

`data.js` contiene il catalogo illustrativo. `storage.js` governa schema,
normalizzazione e persistenza. `engine.js` contiene operazioni pure sullo stato.
`controller.js` coordina routing, rendering, finestre e input. Nessun modulo
importa il codice in `assets/js/web3/`.

## 7. Strategia di implementazione

1. fissare confini, dati e terminologia;
2. costruire shell accessibile e navigazione interna;
3. implementare stato versionato e motore deterministico;
4. realizzare dashboard e catalogo;
5. realizzare deposito e prelievo con review;
6. aggiungere portafoglio, attività e trasparenza;
7. integrare ingresso dalla landing e shell globale;
8. aggiungere validazione statica dedicata;
9. verificare responsive, tastiera, persistenza, reset e assenza di Web3.

## 8. Criteri di riuscita

La demo è riuscita quando un nuovo visitatore può, senza istruzioni esterne:

- capire che tutto è finto;
- distinguere wallet e capitale depositato;
- scegliere un vault sulla base di rischio e funzionamento;
- completare deposito e prelievo;
- vedere la posizione e il percorso dei fondi cambiare;
- ripristinare lo scenario;
- usare l'interfaccia da tastiera e da mobile.

