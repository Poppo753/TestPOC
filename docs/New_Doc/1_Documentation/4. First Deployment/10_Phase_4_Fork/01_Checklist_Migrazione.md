# Fase 4 — checklist rehearsal ownership su fork

**Stato: eseguita e PASS — 2 agosto 2026.** Vedi `03_Registro_Esecuzione.md` per l'evidenza completa.

Legenda: `[x]` completato; `[ ]` da fare; `[~]` in corso; `[!]` fallito.

## A. Preparazione

- [x] Registrare il commit Git da certificare (`ca9ab9f3e488044c685292936aaab53dd71cc7ae`).
- [x] Verificare il working tree e censire ogni modifica (dirty con modifiche pre-esistenti non correlate, vedi registro).
- [x] Eseguire `npm ci` (Node 20.12.2 disponibile in locale; il requisito Node 22 vale per la VPS Fase 2, non per questa rehearsal locale — vedi registro).
- [x] Eseguire compile e typecheck.
- [x] Eseguire le suite script e automation.
- [x] Verificare disponibilità di `ARBITRUM_RPC_URL` senza stamparla.
- [x] Leggere un blocco Arbitrum successivo all'ultima configurazione.
- [x] Registrare il valore esatto di `FORK_BLOCK_NUMBER` (`490447686`).
- [x] Verificare che il manifest dichiari chain ID `42161`.
- [x] Verificare che il manifest contenga esattamente 22 contratti.

## B. Harness di rehearsal

- [x] Creare `test/deployment/OwnershipTransfer.fork.test.ts`.
- [x] Rendere il test eseguibile soltanto con `FORK_ENABLED=true`.
- [x] Bloccare il test se `FORK_BLOCK_NUMBER` è assente.
- [x] Bloccare il test se la rete non è `hardhat`.
- [x] Caricare `scripts/manifests/arbitrum-usdc-poc-1.json`.
- [x] Creare uno snapshot prima di ogni mutazione.
- [x] Impersonare il deployer soltanto dopo i controlli di rete.
- [x] Creare tre owner Safe da account Hardhat locali.
- [x] Creare una Safe locale con threshold `2` (`EphemeralMultisig`, `contracts/mocks/EphemeralMultisig.sol`).
- [x] Registrare l'indirizzo della Safe effimera.
- [x] Garantire `hardhat_stopImpersonatingAccount` nel cleanup.
- [x] Garantire `evm_revert` nel cleanup.

## C. Matrice ownership

- [x] Censire 22 righe dalla proprietà `contracts` del manifest.
- [x] Verificare bytecode per tutte le 22 righe.
- [x] Leggere owner iniziale dei 21 contratti trasferibili.
- [x] Classificare `beacon` come trasferimento a due step.
- [x] Classificare 20 contratti come trasferimento a uno step.
- [x] Classificare `flashLoanService` come non Ownable.
- [x] Verificare il Beacon immutabile di `flashLoanService`.
- [x] Registrare owner attuale, owner atteso, metodo ed evidenza per ogni riga.
- [x] Bloccare il test se una riga non ha classificazione.

## D. Trasferimento sul fork

- [x] Eseguire i 20 trasferimenti Ownable a uno step dal deployer alla Safe locale.
- [x] Avviare il trasferimento Beacon dal deployer alla Safe locale.
- [x] Verificare `pendingOwner` della Beacon.
- [x] Eseguire `acceptOwnership` della Beacon tramite la Safe locale.
- [x] Verificare owner Safe per 21/21 contratti trasferibili.
- [x] Verificare `pendingOwner` Beacon uguale all'indirizzo zero.
- [x] Provare un'operazione owner-only dal vecchio deployer per ogni contratto trasferibile.
- [x] Verificare 21/21 revert del vecchio deployer.
- [x] Verificare che una sola firma Safe non possa eseguire.
- [x] Verificare che due firme Safe distinte possano eseguire.

## E. Regressione funzionale

- [x] Eseguire una modifica amministrativa innocua tramite la Safe locale.
- [x] Verificare il nuovo valore amministrativo.
- [x] Eseguire il rollback tramite la Safe locale.
- [x] Verificare il ripristino esatto del valore iniziale.
- [x] Eseguire pause tramite la Safe locale.
- [x] Verificare lo stato paused.
- [x] Avanzare il tempo locale oltre il timelock di unpause.
- [x] Eseguire unpause tramite la Safe locale (percorso diretto `proxyGeneral.unpause()`; vedi problema trovato nel registro su `emergencyHandler.emergencyUnpause()`).
- [x] Verificare lo stato unpaused.
- [x] Eseguire un deposito dopo il trasferimento.
- [x] Verificare aumento delle quote LP.
- [x] Eseguire un withdraw dopo il trasferimento.
- [x] Verificare riduzione delle quote LP.
- [x] Eseguire health per tutti i protocolli attivi.
- [x] Verificare assenza di finding critical non spiegati.

## F. Chiusura e handoff

- [x] Eseguire la rehearsal due volte sullo stesso blocco.
- [x] Verificare risultati deterministici nelle due esecuzioni.
- [x] Salvare matrice, output test e timestamp.
- [x] Verificare cleanup dell'impersonation.
- [x] Verificare ripristino dello snapshot.
- [x] Verificare che non siano state inviate transazioni ad Arbitrum One.
- [x] Verificare che la VPS observer non sia stata modificata (nessuna connessione SSH eseguita in questa sessione).
- [x] Aggiornare `03_Registro_Esecuzione.md`.
- [x] Valutare tutti i criteri PASS dell'handoff.
- [x] Registrare decisione PASS/FAIL.
- [x] Autorizzare la Fase 5 solo dopo la valutazione tecnica.
- [ ] Valutare tutti i criteri PASS dell'handoff.
- [ ] Registrare decisione PASS/FAIL.
- [ ] Autorizzare la Fase 5 solo dopo la valutazione tecnica.

