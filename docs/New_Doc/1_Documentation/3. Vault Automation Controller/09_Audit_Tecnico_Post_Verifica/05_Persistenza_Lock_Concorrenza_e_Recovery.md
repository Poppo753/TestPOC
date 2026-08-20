# Persistenza, lock, concorrenza e recovery

## Layout dello stato

```text
stateDirectory/
├── runs/
│   └── <run-id>.json
└── locks/
    └── <vault-id>.lock
```

Ogni run conserva configurazione hashata, osservazione, decisione, risk report, piano, risultati, verifica, eventi e transizioni.

## Scrittura atomica

Il nuovo contenuto viene scritto in un file temporaneo creato con `wx`, quindi rinominato sul path finale. Questo evita di esporre JSON parzialmente scritto dopo un crash durante la serializzazione.

Non fornisce però transazioni multi-record: per workflow distribuiti servirà un database.

## Lock esclusivo

Il lock viene creato con apertura esclusiva. Contiene:

- token casuale;
- PID;
- timestamp acquisizione.

Se esiste ed è più recente della TTL, un secondo worker fallisce. Se è più vecchio, può essere recuperato.

## Perché il token è necessario

Scenario:

1. worker A acquisisce lock;
2. A rimane bloccato oltre TTL;
3. worker B considera stale e crea un lock nuovo;
4. A riparte e termina.

Senza token, A cancellerebbe il lock di B. Ora A elimina il file soltanto se il token su disco coincide col proprio.

## Limite TTL senza heartbeat

Il lock non rinnova automaticamente `mtime`. La TTL deve superare il massimo fra:

- observation lenta;
- retry RPC;
- simulazione multi-call;
- attesa confirmations;
- verification.

Con un server produttivo il lock deve diventare un lease rinnovabile. Il POC protegge il single-host ma non dimostra HA.

## Approve/cancel

Anche le mutazioni offline acquisiscono il lock. Questo impedisce che due operatori approvino e cancellino contemporaneamente lo stesso run, o che un approval si sovrapponga a un cycle mutante.

## State machine

Le transizioni non sono arbitrarie. Esempi vietati:

- `CREATED → COMPLETED`;
- `AWAITING_APPROVAL → EXECUTING` senza `APPROVED`;
- riaprire un `STALE`;
- rieseguire un `COMPLETED`.

Ogni transizione conserva `from`, `to`, timestamp e nota.

## Crash prima del broadcast

Se il processo fallisce prima di `EXECUTING`, il run finisce `FAILED` oppure resta in uno stato ispezionabile in caso di crash del processo stesso. Nessuna transazione è stata inviata; si può creare un nuovo ciclo dopo aver verificato il lock.

## Crash durante execution

È il caso critico. Il framework registra le call già confermate, ma un crash esatto dopo il broadcast e prima della scrittura receipt può lasciare una transazione non riconciliata.

Procedura manuale:

1. fermare scheduler;
2. leggere nonce pending/confirmed del signer;
3. cercare receipt e mempool;
4. confrontare stato on-chain;
5. non rilanciare l’intero piano;
6. creare un recovery plan distinto.

Manca ancora un receipt reconciler automatico. Questo è un gate esplicito prima dell’autonomia produttiva.

## `EXECUTION_FAILED` vs `VERIFICATION_FAILED`

- `EXECUTION_FAILED`: almeno una call non è stata completata/confirmata.
- `VERIFICATION_FAILED`: tutte le call risultano confermate, ma il risultato economico non coincide con le invarianti.

Il secondo caso è più subdolo e deve essere trattato come incidente, non come successo parziale accettabile.

## Piano stale

`STALE` è terminale. Non si modifica manualmente il vecchio JSON e non si riapprova. Si crea un nuovo ciclo su stato fresco.

Cause:

- config hash diverso;
- vault/chain diversi;
- block age negativo/eccessivo;
- pause/flag cambiati;
- debt cambiato;
- active/circuit breaker cambiati;
- drift quantitativo oltre soglia;
- nuovo risk report bloccante.

## Backup e integrità

Backup minimi:

- automation config versionata;
- manifest;
- state directory;
- plan esportati;
- log processo;
- receipt/hash;
- mapping Safe transaction quando implementato.

I file del journal non devono essere modificati a mano. Qualunque correzione operativa deve produrre un nuovo run o un evento append-only in un futuro store transazionale.

## Migrazione a database

Requisiti della versione successiva:

- tabella run e transition;
- optimistic version/CAS;
- transaction boundaries;
- unique active lease per vault;
- heartbeat;
- outbox eventi;
- receipt table;
- idempotency key;
- retention e backup verificati.
