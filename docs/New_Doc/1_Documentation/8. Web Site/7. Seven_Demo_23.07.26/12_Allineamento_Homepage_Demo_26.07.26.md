# Allineamento tra homepage, prodotto e demo

## Obiettivo

La homepage non è più soltanto comunicazione commerciale: durante la sua progettazione sono state definite numerose superfici della futura applicazione. La demo deve permettere di vivere lo stesso modello, senza confonderlo con il PoC realmente disponibile.

Il principio centrale rimane:

- ciò che è nel wallet resta sotto il controllo diretto dell'utente;
- soltanto un'azione esplicita sposta un valore in un vault;
- una posizione in vault deve rendere visibili route, allocazioni, rischi, liquidità, costi e prove;
- Base, Pro e Advanced non cambiano il confine di proprietà: cambiano le scelte esposte e la profondità della spiegazione.

## Mappa delle schermate stabilite

### Overview / dashboard

La dashboard mostra valore totale, valore disponibile nel wallet, valore depositato nei vault e rendimento illustrativo. Il box Wallet apre gli asset liquidi; il box Vault positions apre il portfolio; Explore vaults apre la selezione dei vault.

### Wallet

Il wallet presenta USDC, USDT, BTC ed ETH con valore in dollari, quantità illustrativa, percentuale sul totale e grafico ad anello. Selezionare un asset porta ai vault Advanced con quell'asset già impostato. La demo usa valori equivalenti in USD e non simula prezzi di mercato.

### Vaults e livelli di esperienza

I profili di rischio sono sempre Conservative, Balanced e Opportunity.

| Livello | Scelte utente | Spiegazione |
| --- | --- | --- |
| Base | importo e rischio | linguaggio semplice, categorie aggregate e significato del lending |
| Pro | importo, rischio e rete | protocolli, singole allocazioni, APY e dipendenze |
| Advanced | importo, rischio, rete e asset | limiti, borrowing, leva, health factor, trigger e prove |

Le reti illustrative sono Plasma, Ethereum, Arbitrum, Base e BNB Chain. Gli asset illustrativi sono USDC, USDT, BTC ed ETH.

### Deposit

Il deposito separa selezione dell'importo, review e conferma simulata. La review mostra vault, asset, rete, rischio, APY e valore residuo. La conferma modifica soltanto lo stato del browser, sottrae valore dallo specifico asset del wallet e crea una posizione identificata da profilo, rete e asset.

### Portfolio

Ogni posizione mostra profilo, rete, asset, principal, valore corrente, variazione e giorni simulati. Inspect receipt apre la spiegazione della posizione. Withdraw restituisce il valore allo stesso asset del wallet.

### Transparency / ricevuta

La ricevuta mostra valore, rendimento netto illustrativo, stato di uscita, rete, stato dell'evidenza, allocazioni, APY delle route, ragione dell'allocazione e dati necessari a verificarla.

“Why this route?” significa: perché questa combinazione resta il miglior risultato eleggibile dopo rendimento, costi, liquidità e limiti di rischio.

“What would prove it?” significa: quali evidenze devono collegare la spiegazione allo stato reale, per esempio transazione, contratto, blocco e timestamp.

### Activity

La cronologia registra depositi, prelievi e avanzamenti temporali simulati. Non vengono inventati hash on-chain.

## Modello dati implementato

Lo stato locale versione 2 contiene valori separati per asset, posizioni indicizzate come `profilo:rete:asset`, giorni simulati e ricevute di attività. Non importa alcun modulo Web3.

Il rendimento rimane deterministico: a parità di principal, APY e giorni il risultato è sempre uguale. Non esistono casualità, feed di prezzo o capitale reale.

## Confini

La demo rappresenta la product direction, ma non dichiara che vault, reti, asset, APY, allocazioni o limiti siano disponibili o approvati. Non dichiara inoltre che tutte le route siano implementate o che il sistema completo sia auditato. Il PoC tecnico rimane una superficie separata.
