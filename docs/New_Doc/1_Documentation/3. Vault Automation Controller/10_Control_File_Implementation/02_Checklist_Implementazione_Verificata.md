# Checklist implementazione verificata

## Regole della checklist

- `[x]`: implementato e verificato nel repository.
- `[ ]`: non completato.
- `[~]`: implementato lato software ma richiede acceptance esterna.
- Nessun deploy, firma o uptime reale viene spuntato senza evidenza.
- Dolomite e GMX restano esclusi.

## A. Analisi e progettazione

- [x] Auditare control file, manifest, runtime, signer, CLI, store e scheduler esistenti.
- [x] Separare policy, deployment artifact e segreti.
- [x] Definire i confini fra direct executor e Safe executor.
- [x] Verificare il flusso Safe sui kit ufficiali correnti.
- [x] Rifiutare auto-deploy e auto-upgrade nel servizio 24/7.
- [x] Rileggere criticamente la strategia e correggere overengineering.
- [x] Definire cosa è software-complete e cosa resta gate esterno.

## B. Control file

- [x] Aggiungere modello `execution.kind`: `disabled`, `direct`, `safe`.
- [x] Aggiungere `execution.expectedSignerAddress` senza segreti.
- [x] Aggiungere configurazione Safe con address, service URL e nome env API key.
- [x] Aggiungere heartbeat path e soglia fallimenti servizio.
- [x] Applicare default conservativi ai file schema v1 esistenti.
- [x] Validare combinazioni mode/execution.
- [x] Impedire autonomous+Safe senza modulo esplicitamente supportato.
- [x] Impedire direct persistente senza expected signer.
- [x] Impedire chiavi private o mnemonic inline nel JSON.
- [x] Aggiornare config example con comment-free JSON valido.

## C. Manifest e preflight

- [x] Riutilizzare il loader manifest esistente senza introdurre un secondo schema.
- [x] Verificare config chain/base asset contro manifest.
- [x] Verificare protocolli enabled presenti, attivi e di kind supportato.
- [x] Verificare bytecode di core, base asset, plugin, lens e registry.
- [x] Verificare raggiungibilità provider e block number.
- [x] Verificare owner di ProtocolManager rispetto a direct signer o Safe.
- [x] Verificare directory di stato e heartbeat scrivibili.
- [x] Produrre report strutturato PASS/WARNING/FAIL.
- [x] Aggiungere comando CLI `preflight` con exit non-zero su FAIL.
- [x] Evitare di stampare RPC, API key o segreti nel report.
- [x] Testare casi validi e mismatch indipendenti.

## D. Signer sicuro

- [x] Conservare la chiave fuori dal control file.
- [x] Verificare indirizzo derivato contro `expectedSignerAddress`.
- [x] Verificare saldo gas per percorsi persistenti direct.
- [x] Mantenere `--execute=true --dry-run=false` come gate CLI.
- [x] Mantenere acknowledgement autonomous come secondo gate.
- [x] Documentare env/secret manager e permessi minimi del file system.
- [x] Non aggiungere log contenenti chiavi o interi oggetti environment.

## E. Safe adapter

- [x] Usare i kit ufficiali Safe anziché encoding MultiSend manuale.
- [x] Convertire ogni PlannedCall in CALL preservando ordine, target, value e data.
- [x] Forzare batch call-only.
- [x] Calcolare Safe transaction hash ufficiale.
- [x] Firmare/proporre soltanto con owner esterno configurato.
- [x] Supportare API key tramite nome variabile ambiente o service URL custom.
- [x] Salvare binding run↔Safe address↔nonce↔safeTxHash.
- [x] Non marcare una proposta come approvazione multisig completata.
- [x] Leggere stato della transazione dal Transaction Service.
- [x] Verificare che la risposta coincida col binding salvato e sia `trusted`.
- [x] Attendere receipt e conferme e verificare che la transazione target sia la Safe.
- [x] Eseguire post-state verifier dopo esecuzione Safe.
- [x] Gestire pending, failed e successful senza doppia esecuzione.
- [x] Testare con client Safe fake; nessuna rete nei test locali.
- [x] Documentare il limite di staleness non enforceable on-chain.

## F. Servizio 24/7

- [x] Correggere il loop affinché inoltri esplicitamente il persistent gate.
- [x] Non abilitare il gate se i due flag CLI non coincidono.
- [x] Scrivere heartbeat atomico senza segreti.
- [x] Registrare PID, stato, ultimo run e failure count.
- [x] Distinguere NO_ACTION/REJECTED da errori operativi.
- [x] Applicare max consecutive failures con exit non-zero.
- [x] Gestire SIGINT e SIGTERM durante l'attesa.
- [x] Non interrompere volontariamente una receipt già in attesa.
- [x] Aggiungere comando `service-status` read-only.
- [x] Aggiungere test del runner con intervallo controllabile.
- [x] Fornire esempio systemd senza introdurre un orchestratore applicativo.

## G. CLI e UX

- [x] Mantenere un unico `--config` come ingresso operativo.
- [x] Aggiungere `preflight`.
- [x] Aggiungere comando Safe prepare/propose.
- [x] Aggiungere comando Safe sync/reconcile.
- [x] Aggiungere `service-status`.
- [x] Restituire JSON stabile e exit code significativo.
- [x] Evitare sovrascrittura accidentale degli export.
- [x] Aggiornare help/error con elenco comandi.

## H. Test e verifiche repository

- [x] Testare config/default/security.
- [x] Testare preflight.
- [x] Testare Safe conversion, proposta e reconciliation con fake.
- [x] Testare receipt e post-verifica del percorso Safe con transazione Hardhat reale.
- [x] Testare heartbeat e scheduler.
- [x] Testare mismatch signer e owner.
- [x] Eseguire `npm run automation:test`: 14 passing.
- [x] Eseguire `npm run scripts:test`: 37 passing.
- [x] Eseguire `npm run scripts:typecheck`: PASS.
- [x] Eseguire `npm run compile`: PASS.
- [x] Correggere tutte le regressioni introdotte.
- [x] Aggiornare conteggi soltanto dopo l'esecuzione reale: 51 test locali.

## I. Documentazione finale

- [x] Creare indice della cartella.
- [x] Documentare tutti i file creati/modificati.
- [x] Documentare control file campo per campo.
- [x] Documentare preflight e interpretazione report.
- [x] Documentare signer e segreti.
- [x] Documentare workflow Safe completo.
- [x] Documentare servizio 24/7 e recovery.
- [x] Documentare tutti i comandi nuovi.
- [x] Aggiornare documentazione principale del controller.
- [x] Registrare limiti residui senza dichiarazioni production-ready.

## J. Gate esterni — non completabili soltanto nel repository

- [ ] Scegliere RPC privata/stabile e secret backend.
- [ ] Eseguire deploy POC reale e produrre manifest definitivo.
- [ ] Configurare Aave, Euler e Morpho Vault nel deploy.
- [ ] Creare Safe reale con owner e threshold approvati.
- [ ] Trasferire ownership a Safe e verificarla on-chain.
- [ ] Eseguire full-cycle su fork del POC con Safe impersonata.
- [ ] Proporre, firmare ed eseguire un batch Safe reale.
- [ ] Verificare receipt e post-stato reali.
- [ ] Eseguire shadow mode 24/7 per il periodo deciso.
- [ ] Provare restart host/processo e incident runbook.
- [ ] Eseguire audit indipendente prima di capitale significativo.
- [ ] Valutare e migrare separatamente le 17 advisory runtime della dependency tree legacy Chainlink/Uniswap/OpenZeppelin senza upgrade major ciechi.

## Controllo di completezza

La checklist è stata confrontata con `01_Strategia_Espansa_e_Revisionata.md`. Copre control file, manifest, preflight, signer, Safe, servizio, CLI, test, documentazione e gate esterni. I task di Safe module, database HA, Kubernetes, cross-chain, borrow e leverage sono intenzionalmente esclusi dalla prima implementazione perché non necessari al POC descritto.
