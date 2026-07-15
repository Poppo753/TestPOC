# Vault Automation Controller — audit e stato attuale

## Scopo e verdetto

Questo documento trasforma `first chat idea.md` da visione di prodotto in una fotografia verificabile del repository. Il progetto possiede già contratti che custodiscono e movimentano capitale, letture operative, piani serializzabili e un executor con simulazione su fork. Non possiede ancora un processo persistente che osservi, decida, applichi policy, richieda approvazione, esegua e verifichi un rebalance.

Il prossimo incremento corretto è quindi un controller off-chain, non un nuovo protocol plugin. Il primo rilascio deve essere deliberatamente limitato: una chain, un manifest, un vault, un solo asset base e operazioni supply/withdraw. Questa limitazione rende confrontabili gli importi senza inventare conversioni di prezzo e impedisce che il POC assuma rischi di borrow o leverage prima di avere dati oracle e metriche economiche complete.

## Cosa esiste ed è riutilizzabile

### Contratti e confini on-chain

- `ProxyGeneral` rappresenta la custody e le share del vault.
- `LiquidityManager` gestisce depositi e prelievi degli utenti.
- `ProtocolManager` espone registrazione, stato, balance, debt, health e azioni standardizzate sui protocolli.
- `ValueCalculator`, lens adapter e registry forniscono parte delle letture necessarie.
- `EmergencyHandler`, pause e circuit breaker costituiscono i freni on-chain.
- Beacon, ruoli e selector allowlist delimitano ciò che un executor può invocare.

I contratti restano l’autorità sui fondi e sulle invarianti. Il controller non sostituisce i controlli on-chain: propone e invia azioni entro quei controlli.

### Framework operativo

La suite attiva in `scripts/framework` fornisce:

- manifest versionato e validato;
- runtime legato a chain ID, provider, signer e opzioni;
- chiamate serializzabili in un `ExecutionPlan`;
- dipendenze ordinate tra chiamate;
- modalità encode-only, planned, dry-run ed execution;
- snapshot/revert per simulare più transazioni condividendo lo stesso stato;
- nonce sequenziali e attesa delle receipt;
- retry RPC solo per errori transitori;
- preflight su chain, bytecode e ownership.

La combinazione che persiste stato rimane intenzionalmente esplicita: `execute=true` e `dryRun=false`. Tutte le altre modalità pianificano o simulano.

### Sensori disponibili

- `getSystemStatus`: blocco, moduli, pool value/share price quando disponibile, pause e flag operativi.
- `getProtocolHealth`: summary aggregati, health globale, circuit breaker e net APY dichiarato dai lens.
- `getPositionsByRisk`: posizioni ordinate per rischio.
- `readProtocolPosition`: balance, debt e health per protocollo/token.
- lettura ERC-20 della liquidità in custody.

### Attuatori disponibili

- deposit e withdraw dal vault;
- swap in custody;
- deposit, withdraw, borrow, repay e close tramite `ProtocolManager`;
- configurazione protocolli, registry e token;
- pause, circuit breaker e policy core;
- deploy e upgrade;
- esportazione calldata per Safe o wallet.

Dolomite e GMX restano fuori dal controller perché i relativi plugin non sono completati.

## Cosa funziona già, ma non equivale ad automazione

Gli script possono leggere ed eseguire correttamente una singola intenzione. Non mantengono però una storia delle decisioni, non impediscono a due processi di ribilanciare contemporaneamente, non invalidano automaticamente un piano vecchio e non stabiliscono una target allocation. Un cron che richiama direttamente `protocol-action` non risolverebbe questi problemi.

## Dati mancanti o non ancora abbastanza affidabili

### Rendimento

Il `netAPY` dei summary è utile come telemetria, ma non è ancora una base sufficiente per un allocatore economico: occorrono origine, scala, freshness, comportamento in errore, costo gas, liquidità di uscita e storico. Il POC non sceglierà il protocollo con APY più alto. Userà pesi target dichiarati e produrrà telemetria per una futura strategia a punteggio.

### Oracle e prezzi

Non esiste ancora nel framework una lettura normalizzata che attesti per ogni asset prezzo, timestamp, heartbeat e denominazione. Finché manca, il controller può confrontare soltanto quantità dello stesso asset base. La modalità autonoma deve restare disabilitata per configurazione predefinita.

### Gas e slippage

Per spostamenti supply/withdraw sullo stesso asset non c’è swap slippage, ma rimangono gas e possibili limiti di liquidità del protocollo. Il POC applica soglie minime e massimi per ciclo; la valutazione economica completa è una fase successiva.

### Finalità e reorg

Il framework attende receipt, ma un servizio 24/7 richiederà una policy esplicita di finalità per chain e riconciliazione dopo restart. Il POC registra blocchi, hash e stato e rende configurabili conferme e stale-block threshold.

## Cosa deve essere implementato adesso

1. Configurazione versionata del controller, separata dal deployment manifest.
2. Snapshot normalizzato di liquidità e allocazioni per il solo asset base.
3. Strategia deterministica a pesi target, riserva liquida, drift e cooldown.
4. Risk engine indipendente con allowlist, cap, health, circuit breaker e limiti per ciclo.
5. Planner che ritira prima gli eccessi e deposita poi i deficit.
6. Simulazione atomica dell’intero piano mediante snapshot/revert.
7. Stato persistente con scrittura atomica, lock per vault e state machine.
8. Modalità `OBSERVE`, `ADVISORY` e `AUTONOMOUS`, con autonomia opt-in.
9. Approvazione esplicita dei piani advisory.
10. Controllo di staleness e fingerprint prima dell’esecuzione.
11. Verifica post-esecuzione e audit log strutturato.
12. CLI one-shot e loop schedulato, più export del piano.
13. Test unitari, integrazione locale e smoke fork read-only.

## Cosa non va dichiarato completato dal POC

- ottimizzazione dinamica affidabile del rendimento;
- borrow o leverage automatico;
- gestione cross-chain o bridge;
- alta disponibilità distribuita;
- database remoto multi-worker;
- integrazione Safe API/servizio firme;
- notifiche Telegram/PagerDuty reali;
- certificazione per capitale significativo;
- autonomia produttiva senza shadow period e security review.

## Strategia consigliata

Il controller deve partire in `OBSERVE`, passare ad `ADVISORY` dopo test fork e locale, e usare un deploy con capitale limitato prima di qualsiasi autonomia. I piani advisory possono essere esportati come JSON e firmati con strumenti esterni. Solo dopo settimane di shadow mode si abilita `AUTONOMOUS`, con chiave dedicata, limiti molto bassi e ruoli on-chain minimi.

La prima metrica di successo non è “massimo APY”: è dimostrare cicli ripetibili senza doppie esecuzioni, con capitale sempre riconciliabile e decisioni spiegabili.
