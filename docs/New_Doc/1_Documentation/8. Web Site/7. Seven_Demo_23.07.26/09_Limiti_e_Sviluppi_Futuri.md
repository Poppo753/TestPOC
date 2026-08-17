# Limiti dichiarati e sviluppi futuri

## Limiti intenzionali

- un solo asset dimostrativo;
- nessun andamento negativo o volatilità;
- APY fisso e illustrativo;
- liquidità descritta, non simulata temporalmente;
- nessun costo, fee o slippage;
- nessun onboarding wallet;
- nessun account multi-dispositivo;
- nessun backend;
- nessuna traduzione;
- nessun collegamento fra stato demo e stato PoC.

Questi limiti mantengono il messaggio comprensibile e non sono errori.

## Miglioramenti successivi consigliati

### Prima priorità

- test browser interattivo che compili e confermi deposito/prelievo;
- audit manuale WCAG con screen reader;
- localizzazione inglese/italiana;
- migliore gestione mobile del comando reset;
- analytics privacy-preserving sugli step completati.

### Seconda priorità

- scenari educativi su liquidità e perdita;
- confronto fra profili salvabile;
- tour guidato opzionale;
- ricevuta esportabile chiaramente marcata “demo”;
- grafico storico deterministico.

### Migrazione futura verso prodotto reale

Non sostituire semplicemente le funzioni del motore con chiamate Web3. Prima
serve un adapter esplicito e una modalità separata con:

- rete e indirizzi verificabili;
- stato di connessione;
- preventivi e deadline;
- conferme wallet;
- errori RPC;
- transazioni pending/confirmed/failed;
- disclaimer e policy legali appropriati.

La modalità demo deve continuare a esistere come sandbox anche dopo
l'integrazione reale.

