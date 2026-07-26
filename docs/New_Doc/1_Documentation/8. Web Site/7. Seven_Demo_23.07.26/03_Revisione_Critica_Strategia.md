# Revisione critica della strategia

## Metodo

La strategia espansa è stata riesaminata considerando comprensibilità,
credibilità, sicurezza comunicativa, manutenzione e possibilità di migrazione
futura verso dati reali.

## Decisioni confermate

- Demo separata dalla console PoC reale.
- Applicazione statica senza framework né nuove dipendenze.
- Stato locale versionato e completamente resettabile.
- Cinque aree applicative con route hash.
- Deposito e prelievo in due fasi.
- Catalogo con rischio visibile quanto il rendimento.
- Trasparenza costruita con HTML/CSS, non WebGL.
- Nessun hash, wallet o transazione fittizia presentata come reale.
- Test del motore e validatore strutturale dedicati.

## Correzioni apportate

### Eliminata la falsa connessione wallet

Una precedente ipotesi prevedeva un wallet demo da “connettere”. È stata
scartata: un pulsante simile può far pensare che verrà aperta un'estensione.
La demo usa invece un profilo prefinanziato chiaramente dichiarato.

### Crescita deterministica

Una simulazione casuale sarebbe più spettacolare ma meno educativa e
difficilmente riproducibile. Il valore deriva soltanto da APY e giorni
illustrativi.

### Nessun WebGL dentro l'app

L'interattività utile nasce dal cambiamento di stato. Un canvas animato
aumenterebbe peso e distrazione senza chiarire proprietà o rischio. Le
micro-animazioni CSS sono sufficienti e vengono disabilitate con reduced
motion.

### Un solo modal alla volta

Il dettaglio del vault viene aperto inline; soltanto le operazioni finanziarie
usano una finestra. Questo evita modal sovrapposti e problemi di focus.

### Nessuna simulazione di incidenti

La prima versione non simula depeg, perdite o blocchi di liquidità: una
simulazione credibile richiederebbe modelli e spiegazioni ulteriori. I rischi
sono comunque esposti con chiarezza.

### Nessun valore “live”

Tutte le cifre sono dichiarate illustrative. I termini `live` e `real-time`
sono esclusi dalla demo.

## Strategia finale

Costruire un vertical slice centrato su proprietà, decisione consapevole,
tracciabilità e reversibilità. La demo deve sembrare un prodotto ben progettato,
ma non deve sembrare un prodotto finanziario già disponibile.

Questa è la strategia migliore per l'attuale fase perché massimizza il valore
comunicativo e mantiene nullo il rischio tecnico di interazione on-chain.

