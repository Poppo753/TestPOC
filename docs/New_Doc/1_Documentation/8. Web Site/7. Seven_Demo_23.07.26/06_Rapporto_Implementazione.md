# Rapporto di implementazione — Jethos Interactive Demo

## Esito

È stata implementata un'applicazione dimostrativa completa e separata dal PoC
on-chain. Il visitatore può vivere un ciclo coerente di esplorazione, deposito,
monitoraggio, trasparenza e prelievo usando esclusivamente stato locale.

## Cosa è stato creato

### Applicazione

- `dapp-new/demo/index.html`
- `dapp-new/assets/css/demo.css`
- `dapp-new/assets/js/demo/data.js`
- `dapp-new/assets/js/demo/storage.js`
- `dapp-new/assets/js/demo/engine.js`
- `dapp-new/assets/js/demo/controller.js`

### Validazione

- `scripts/validation/validate-demo.mjs`
- `scripts/validation/test-demo-engine.mjs`
- `scripts/browser/demo-smoke.mjs`
- comandi `check:demo` e `check:demo:browser`
- inserimento dei due gate statici nel comando `ready`

### Integrazione

- CTA globale “Try demo”;
- CTA hero della landing;
- CTA conclusiva della landing;
- collegamento nel footer;
- console PoC ancora raggiungibile da landing, demo e footer;
- aggiornamento dei README.

## Flussi implementati

### Overview

Mostra patrimonio totale, saldo wallet, valore nei vault, guadagno illustrativo
e confine tra disponibilità diretta e capitale depositato.

### Explore vaults

Confronta Reserve, Balanced e Growth usando struttura uniforme. Ogni profilo
espone APY illustrativo, rischio, liquidità, allocazioni e rischi specifici.

### Deposit

Il modal permette importo libero, 25%, 50% e Max. La fase di review mostra
destinazione, saldo residuo, profilo di rischio e avviso. La conferma aggiorna
wallet, posizione e ricevuta locale.

### Portfolio

Mostra principal, valore deterministico, variazione e giorni simulati. Il
comando “Simulate 30 days” rende osservabile l'evoluzione senza feed esterni.

### Withdrawal

Supporta importo libero, 50% e Max, review, prelievo parziale e totale. Il valore
ritorna al wallet demo.

### Activity

Registra deposito, prelievo e avanzamento temporale con identificatore locale,
data, importo e stato “Simulated”. Non crea hash o explorer link finti.

### Transparency

Mostra confine di proprietà, percorso wallet–vault, allocazioni e risk ledger
per ogni posizione.

## Decisioni tecniche

### Nessun framework

Il sito è statico e modulare; è stato mantenuto lo stesso modello per evitare
build, dipendenze e configurazione di hosting aggiuntive.

### Stato derivato

Il valore della posizione non viene salvato: viene calcolato da principal, APY
illustrativo e giorni. Questo rende la demo riproducibile.

### Persistenza locale versionata

Lo schema è versione 1. Stato assente, corrotto o incompatibile produce uno
scenario iniziale sicuro da 10.000 demo USDC.

### Separazione Web3

La demo non importa alcun modulo `assets/js/web3/`. `app.html` e i suoi
workflow reali non sono stati modificati.

## Correzioni preventive

- evitata una falsa connessione wallet;
- evitata crescita casuale;
- evitati hash inventati;
- evitato uso di WebGL dentro l'app;
- evitati modal sovrapposti;
- APY reso visivamente comparabile a rischio e liquidità;
- gestione focus, Escape, errori e reduced motion;
- input dinamici inseriti senza `innerHTML`.

## Verifiche eseguite

Tutti con esito positivo:

- `npm run check:demo`
- `npm run validate`
- `npm run check:content`
- `npm run check:product`
- `npm run check:demo:browser -- http://127.0.0.1:4175`
- `npm run ready`

Il browser smoke ha verificato auth gate, overview, saldi, navigazione e
disclaimer. Il motore ha verificato deposito, crescita, prelievi e rifiuto di
operazioni non valide.

## Stato finale

La demo è completa rispetto al perimetro approvato. È un prototipo esperienziale
funzionante, non un collegamento alla produzione e non una prova di sicurezza
del sistema reale.

