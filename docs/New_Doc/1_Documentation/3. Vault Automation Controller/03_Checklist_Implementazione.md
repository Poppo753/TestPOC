# Checklist dettagliata — Vault Automation Controller

Legenda: `[x]` completato e verificato; `[ ]` non completato; `[~]` implementato ma richiede evidenza esterna/operativa.

## A. Audit e progettazione

- [x] Leggere integralmente `first chat idea.md`.
- [x] Inventariare framework, monitoring, protocol actions, manifest e test esistenti.
- [x] Separare capacità presenti, gap reali e dipendenze esterne.
- [x] Definire il perimetro POC single-chain/single-vault/single-base-asset/supply-only.
- [x] Escludere esplicitamente Dolomite e GMX.
- [x] Scrivere audit dello stato attuale.
- [x] Scrivere strategia espansa.
- [x] Rileggere criticamente la strategia e incorporare le correzioni.
- [x] Confrontare questa checklist con strategia e revisione critica.

## B. Modello e configurazione

- [x] Definire tipi di snapshot, allocation, decisione, risk finding, run e transizione.
- [x] Definire modalità observe/advisory/autonomous e stati terminali.
- [x] Implementare loader JSON con validazione completa.
- [x] Verificare chain ID, asset, bps, target/cap, duplicati e valori non negativi.
- [x] Implementare doppio opt-in autonomy e default fail-closed.
- [x] Fornire configurazione example documentata.

## C. Observer

- [x] Leggere status sistema e balance ERC-20 in custody.
- [x] Leggere balance, debt e health per protocollo configurato.
- [x] Normalizzare summary, circuit breaker e APY opzionale.
- [x] Rifiutare snapshot esteso su troppi blocchi.
- [x] Calcolare managed assets e allocation bps senza sommare asset eterogenei.
- [x] Calcolare fingerprint deterministico dello stato economico.

## D. Strategy engine

- [x] Calcolare target e delta con aritmetica bigint.
- [x] Applicare threshold, minimum action e cooldown.
- [x] Applicare massimo movimentabile per ciclo.
- [x] Produrre motivazioni e decisione NO_ACTION deterministica.
- [x] Pianificare soltanto deposit/withdraw dell’asset base.

## E. Risk engine

- [x] Controllare pause e flag operativi.
- [x] Controllare allowlist, active state e circuit breaker.
- [x] Vietare debt/borrow nel POC.
- [x] Controllare health factor quando applicabile.
- [x] Controllare reserve minima e cap prospettici.
- [x] Controllare balance sorgente, volume e importi.
- [x] Fallire se oracle è obbligatorio ma non disponibile.
- [x] Bloccare autonomous senza doppio opt-in.
- [x] Distinguere findings bloccanti e warning.

## F. Planner e simulazione

- [x] Creare `ExecutionPlan` compatibile col framework.
- [x] Assegnare ID univoci e dipendenze valide.
- [x] Ordinare withdraw prima dei deposit.
- [x] Limitare deposit alla liquidità disponibile/prodotta.
- [x] Simulare l’intero piano con snapshot/revert.
- [x] Non degradare silenziosamente una simulazione multi-call.

## G. Persistenza, lock e workflow

- [x] Implementare store JSON con scrittura atomica.
- [x] Implementare lock esclusivo per vault con TTL e recovery dichiarato.
- [x] Validare transizioni di stato.
- [x] Conservare snapshot, config version, decisione, findings e risultati.
- [x] Implementare create/list/get/approve/cancel.
- [x] Impedire ri-esecuzione di run terminali.
- [x] Controllare fingerprint e stale blocks prima dell’esecuzione.
- [x] Tollerare yield passivo entro soglia e rieseguire il risk engine sullo stato fresco.
- [x] Invalidare il piano se cambia la configurazione approvata.
- [x] Rifiutare protocolli attivi esclusi dall’accounting.
- [x] Marcare crash/partial execution senza retry cieco.

## H. Controller, verifier, alert e scheduler

- [x] Orchestrare il ciclo one-shot sotto lock.
- [x] Implementare comportamento distinto per le tre modalità.
- [x] Simulare sempre prima di approvare/eseguire.
- [x] Riosservare prima dell’invio.
- [x] Verificare reserve, debt, cap, importi e direzione dei delta dopo l’invio.
- [x] Emettere eventi JSON strutturati.
- [x] Implementare scheduler che isola gli errori dei cicli.
- [x] Garantire rilascio lock in `finally`.

## I. CLI e integrazione suite

- [x] Comandi run, loop, list, show, approve, cancel, execute ed export.
- [x] Output JSON machine-readable e codici errore coerenti.
- [x] Nessuna transazione persistente senza flag espliciti.
- [x] Aggiungere comandi package per typecheck, test e CLI automation.
- [x] Commentare codice e confini di sicurezza.

## J. Test

- [x] Unit test configurazione e autonomy guard.
- [x] Unit test strategy con threshold, dust, cooldown e cap ciclo.
- [x] Unit test risk engine per ogni blocco critico.
- [x] Unit test fingerprint e verifier.
- [x] Unit test store, lock e transizioni.
- [x] Integration test observer/planner su fixture locale.
- [x] Integration test simulazione multi-call con revert completo.
- [x] Integration test execution e post-verifica, incluso piano reso stale dopo approvazione.
- [x] Regression test suite script esistente: 37 passing.
- [x] Typecheck scripts completo.
- [x] Compile Hardhat.
- [x] Fork smoke infrastrutturale read-only a blocco Arbitrum fissato `483105327`: 1 passing.
- [x] Control file execution policy, preflight, Safe adapter e service runner: automation suite 14 passing.

## K. Documentazione finale

- [x] Stato finale e changelog delle implementazioni.
- [x] Guida architettura e sicurezza.
- [x] Guida completa ai comandi e ai file.
- [x] Runbook shadow/advisory/autonomous e incidenti.
- [x] Matrice dei limiti: POC, production-hardening, multi-vault e multi-chain.
- [x] Aggiornare questa checklist soltanto con evidenze reali.
- [x] Documentare la nuova implementazione in `10_Control_File_Implementation/`.

## L. Gate esterni non falsificabili

- [ ] Deploy POC isolato con manifest e automation config definitivi.
- [ ] Fork end-to-end del controller contro quel deploy POC e owner impersonato.
- [ ] Shadow mode continuativo su deploy reale.
- [ ] Approvazione Safe reale end-to-end.
- [ ] Incident drill con capitale POC.
- [ ] RPC ridondate e monitoraggio remoto.
- [ ] Security review/audit indipendente.
- [ ] Criteri misurati prima di autonomia con capitale reale.

Gli elementi della sezione L non possono essere marcati completati da test locali: richiedono tempo, infrastruttura e governance reali.
