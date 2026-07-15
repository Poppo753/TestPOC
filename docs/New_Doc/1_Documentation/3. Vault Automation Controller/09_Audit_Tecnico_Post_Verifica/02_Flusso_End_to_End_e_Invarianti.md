# Flusso end-to-end e invarianti

## 1. Ingresso CLI

La CLI carica e valida la configurazione prima di leggere manifest, aprire signer o creare il controller. `list`, `show`, `approve`, `cancel` ed `export` lavorano sul journal; `run`, `loop` ed `execute` costruiscono anche il runtime blockchain.

Invariante: un run richiesto via config deve appartenere allo stesso `vaultId`. Durante execution vengono verificati anche chain ID e config hash.

## 2. Runtime

Il runtime lega:

- provider;
- signer opzionale;
- indirizzo signer;
- chain ID;
- nome rete;
- manifest;
- opzioni execute/dry-run/encode-only;
- retry e confirmations.

Invariante: chain del manifest, provider, piano e automation config devono coincidere.

## 3. Acquisizione lock

Prima di creare o modificare un ciclo viene acquisito il lock del vault. Questo vale anche per approve, cancel ed execute.

Invarianti:

- un solo mutatore per vault su un host;
- il lock viene rilasciato in `finally`;
- un lock nuovo non viene eliminato da un worker vecchio;
- una TTL scaduta consente recovery, ma deve essere maggiore del peggior tempo di ciclo.

## 4. Creazione run

Il run nasce `CREATED` con:

- ID univoco;
- vault/chain;
- mode;
- config hash;
- timestamp;
- prima transizione;
- event list.

Un fallimento inatteso diventa `FAILED` quando esiste già un record persistibile.

## 5. Osservazione

L’observer raccoglie custody, protocolli e operational state. Non usa pool value per sommare allocazioni, perché pool value potrebbe essere espresso in una scala valutativa diversa. Somma soltanto unità dello stesso base asset.

Invarianti:

- nessun asset eterogeneo;
- nessun protocollo attivo invisibile;
- nessun protocol kind fuori perimetro;
- circuit breaker noto;
- snapshot entro il block span massimo.

## 6. Strategia

La decisione può essere `NO_ACTION` o `REBALANCE`. L’APY non entra nella formula. I target sono governance input.

Invarianti:

- target complessivi = 100%;
- nessuna azione zero o sotto minimo;
- nessun movimento oltre il cap ciclo;
- deposit limitati alla liquidità disponibile dopo i withdraw;
- cooldown rispettato.

## 7. Observe mode

Se la decisione richiederebbe un rebalance ma la modalità è `observe`, il run termina `OBSERVED_ONLY`. Non costruisce transazioni e non richiede signer.

Invariante: shadow mode non può mutare la blockchain.

## 8. Risk validation

In advisory/autonomous il risk engine valuta stato corrente e proiezione post-azioni. Un finding bloccante porta a `REJECTED`.

Invariante: strategy e risk hanno responsabilità separate; una proposta valida matematicamente può essere vietata dalla policy.

## 9. Planning

Il planner produce calldata per il solo `ProtocolManager`. Tutti i withdraw precedono i deposit; le dipendenze rendono questa relazione esplicita anche fuori dall’executor corrente.

Invarianti:

- nessun target arbitrario;
- nessun selector diverso da deposit/withdraw;
- nessun borrow, repay, swap o bridge;
- piano serializzabile e chain-bound.

## 10. Simulazione

Per un piano multi-call il provider deve supportare snapshot. Il framework:

1. prende snapshot;
2. invia le transazioni nel fork con nonce sequenziale;
3. attende receipt;
4. interrompe al primo fallimento;
5. reverte lo snapshot in `finally`.

Invarianti:

- le call successive vedono lo stato prodotto dalle precedenti;
- nessuna mutazione sopravvive alla simulazione;
- un RPC senza snapshot non può produrre un falso successo multi-call.

## 11. Approval

In advisory, una simulazione riuscita porta a `AWAITING_APPROVAL`. L’approval registra attore e timestamp e porta a `APPROVED`. Non rappresenta ancora una firma Safe crittografica.

In autonomia, l’approvazione policy richiede modalità, enable flag e acknowledgement esatta. Senza gate persistente il run resta approvato ma non invia.

## 12. Pre-execution revalidation

Prima dell’invio vengono ricontrollati:

- vault ID;
- chain ID;
- config hash;
- block age non negativo e non eccessivo;
- cambi strutturali;
- drift quantitativo;
- risk report sullo stato fresco.

Un fallimento porta a `STALE`, non a un tentativo forzato.

## 13. Execution

Il framework usa il signer reale, nonce pending iniziale e nonce incrementale. Ogni receipt deve avere status 1. Il risultato conserva call confermate, hash, blocco e gas.

Invariante: solo `--execute=true --dry-run=false` rende persistenti le transazioni dalla CLI.

## 14. Verification

Dopo le receipt il controller riosserva. `COMPLETED` richiede:

- nessun debt;
- nessuna perdita managed oltre tolleranza;
- custody coerente;
- balance protocollo coerenti;
- cap e reserve rispettati;
- protocolli attivi;
- circuit breaker false.

Receipt riuscite con post-stato errato producono `VERIFICATION_FAILED`.

## 15. Stati terminali

- `OBSERVED_ONLY`: shadow decision registrata;
- `NO_ACTION`: nessun rebalance;
- `REJECTED`: policy violation;
- `SIMULATION_FAILED`: fork/revert;
- `STALE`: piano non più valido;
- `EXECUTION_FAILED`: sequenza non completata;
- `VERIFICATION_FAILED`: post-condizioni violate;
- `FAILED`: errore workflow inatteso;
- `CANCELLED`: annullamento esplicito;
- `COMPLETED`: invio e verifica riusciti.
