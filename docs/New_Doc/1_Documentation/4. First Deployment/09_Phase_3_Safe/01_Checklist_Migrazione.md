# Fase 3 — checklist governance e Safe

**Stato: parcheggiata — 2 agosto 2026.**
Esecuzione rinviata: nessun capitale significativo in gestione e nessun utente reale.
Riprendere prima di Fase 6 (trasferimento ownership reale) quando il contesto lo richiede.
Le fasi tecnicamente autonome (Fase 4 fork, Fase 5 policy) procedono in parallelo senza sbloccare questa.

Legenda: `[x]` completato; `[ ]` da fare; `[~]` in corso; `[!]` fallito.

## A. Decisioni di governance

- [ ] Registrare il numero approvato di owner.
- [ ] Registrare l'indirizzo pubblico di ogni owner.
- [ ] Associare ogni owner a un operatore identificato.
- [ ] Approvare il threshold.
- [ ] Verificare che ogni owner usi un dispositivo distinto.
- [ ] Verificare che gli owner non condividano la stessa seed phrase.
- [ ] Identificare il proposer autorizzato.
- [ ] Approvare il processo di revisione della calldata.
- [ ] Approvare il delay per upgrade ad alto impatto.
- [ ] Approvare la procedura di recovery.

## B. Preparazione sicura

- [ ] Verificare che ogni hardware wallet mostri il proprio indirizzo.
- [ ] Confrontare ogni indirizzo tramite un secondo canale.
- [ ] Verificare che nessuna private key o mnemonic sia nel repository.
- [ ] Verificare che nessuna chiave owner sia sulla VPS observer.
- [ ] Verificare che `ARBITRUM_RPC_URL` sia disponibile solo come variabile d'ambiente.
- [ ] Registrare il commit Git usato per la verifica.
- [ ] Registrare il nonce del deployer prima della creazione.

## C. Creazione Safe

- [ ] Selezionare Arbitrum One nell'interfaccia Safe.
- [ ] Inserire gli owner nell'ordine approvato.
- [ ] Impostare il threshold approvato.
- [ ] Verificare il riepilogo da almeno due dispositivi.
- [ ] Creare la Safe.
- [ ] Registrare `SAFE_ADDRESS`.
- [ ] Registrare la transaction hash di creazione.
- [ ] Verificare receipt di creazione con `status=1`.

## D. Verifica on-chain

- [ ] Verificare chain ID `42161` dal provider.
- [ ] Verificare bytecode non vuoto a `SAFE_ADDRESS`.
- [ ] Leggere gli owner on-chain.
- [ ] Confrontare gli owner on-chain con la decisione approvata.
- [ ] Leggere il threshold on-chain.
- [ ] Confrontare il threshold on-chain con la decisione approvata.
- [ ] Registrare la versione Safe.
- [ ] Verificare assenza di moduli non approvati.
- [ ] Verificare guard e fallback handler rispetto alla configurazione approvata.

## E. Transazione innocua e recovery

- [ ] Registrare il nonce Safe prima del test.
- [ ] Preparare un trasferimento di `0` ETH dalla Safe alla stessa Safe con calldata `0x`.
- [ ] Decodificare destinazione, valore e calldata su due dispositivi.
- [ ] Raccogliere esattamente il quorum richiesto.
- [ ] Eseguire la transazione innocua.
- [ ] Verificare receipt con `status=1`.
- [ ] Verificare incremento del nonce Safe pari a `1`.
- [ ] Simulare l'indisponibilità di un solo owner.
- [ ] Verificare che gli owner rimanenti possano raggiungere il threshold.
- [ ] Documentare il tempo del recovery drill.
- [ ] Verificare che nessuna ownership core sia cambiata.

## F. Chiusura e handoff

- [ ] Verificare che il servizio VPS sia `active`.
- [ ] Verificare che il control file resti in modalità `observe`.
- [ ] Verificare che execution resti `disabled`.
- [ ] Verificare che autonomous resti `false`.
- [ ] Aggiornare `03_Registro_Esecuzione.md` con tutte le evidenze.
- [ ] Valutare tutti i criteri PASS dell'handoff.
- [ ] Registrare timestamp finale e decisione PASS/FAIL.
- [ ] Autorizzare la preparazione della Fase 4 solo dopo PASS.

