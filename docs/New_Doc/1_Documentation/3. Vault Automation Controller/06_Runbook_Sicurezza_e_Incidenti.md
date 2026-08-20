# Runbook sicurezza, rollout e incidenti

## Rollout

### Gate 1 — locale e fork

Compilazione, typecheck, suite automation, regressioni script e fork a blocco fisso devono passare. Ogni modifica a contratti, ABI, observer, policy o executor riapre questo gate.

### Gate 2 — observe/shadow

Eseguire il controller 24/7 senza invii. Revisionare:

- frequenza delle decisioni;
- piani respinti e warning;
- stabilità dei lens/RPC;
- drift reale e dust;
- gas stimato manualmente;
- piani che diventano stale;
- falsi positivi di circuit breaker e health.

Durata consigliata: almeno una settimana stabile, più lunga se le condizioni di mercato non hanno variato significativamente.

### Gate 3 — advisory e Safe

Ogni piano viene simulato, esportato e proposto alla Safe. Collegare run ID, Safe transaction ID, firmatari e receipt. Eseguire deposit, rebalance, protocol disable e user withdrawal completi.

### Gate 4 — capitale POC

Chiave/ruolo dedicato, limiti per ciclo bassi, reserve alta, nessun debt, protocolli minimi e alert umano. Fare incident drill prima dell’autonomia.

### Gate 5 — autonomia limitata

Richiede tutti i gate precedenti, acknowledgement, ruolo least-privilege on-chain e possibilità immediata di revoca. Aumentare limiti solo con evidenze.

## Incidenti

### `REJECTED`

Non forzare il piano. Leggere findings, verificare lens e stato on-chain. Correggere configurazione solo se la policy era realmente errata; poi creare un nuovo run.

### `STALE`

È comportamento normale e sicuro. Non modificare fingerprint o block number. Generare un nuovo ciclo.

### `SIMULATION_FAILED`

Conservare revert, piano, blocco e RPC. Riprodurre sullo stesso fork. Non approvare calldata manualmente “per provare”.

### `EXECUTION_FAILED`

Fermare scheduler e revocare invii automatici. Controllare ogni `TransactionResult`, nonce e receipt; determinare quali call sono confermate. Non rilanciare l’intero piano. Osservare il vault, costruire eventualmente un recovery plan separato e farlo approvare.

### `VERIFICATION_FAILED`

Trattare come incidente anche se tutte le receipt hanno status 1. Attivare pause/circuit breaker se capitale, reserve o debt sono inattesi. Confrontare expected e actual balance.

### Lock presente

Controllare PID e timestamp nel file. Non cancellarlo mentre il worker è vivo. La TTL deve superare il peggior tempo di ciclo; il recupero automatico protegge il lock nuovo dal rilascio tardivo del vecchio worker, ma non sostituisce la verifica delle transazioni pending.

### RPC indisponibile

Il retry copre errori transitori, non revert deterministici. Dopo retry esauriti il run finisce `FAILED`. Non alternare RPC con head molto differenti durante lo stesso ciclo.

## Segreti e ruoli

- non inserire private key in config o manifest;
- usare secret manager o signer remoto;
- non usare l’owner universale per autonomia produttiva;
- allowlistare selector minimi;
- separare deployer, governance, emergency e automation executor;
- ruotare/revocare la chiave dopo sospetto incidente.

## Backup e retention

Salvare config versionata, manifest, run JSON, piani esportati, receipt e log. La state directory è parte dell’audit trail. Per più host sostituire il file store con database transazionale e lock distribuito: non condividere semplicemente la directory su rete.

## Drill minimi

1. RPC rate limit durante observation.
2. Piano reso stale dopo approvazione.
3. Circuit breaker attivo.
4. Protocollo inattivo.
5. Simulazione che reverte al secondo call.
6. Crash dopo la prima receipt.
7. Verifica post-stato fallita.
8. Lock conteso e lock stale.
9. Emergency pause e revoca executor.
10. Prelievo utente con capitale allocato.
