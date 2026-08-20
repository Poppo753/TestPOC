# Cose da fare dopo la parte tecnica

Questa cartella raccoglie tutto ciò che è stato deliberatamente rimandato
perché non ha senso farlo ora: nessun utente reale, capitale minimo (3 USDC),
focus sulla solidità tecnica del sistema.

Quando la parte tecnica sarà stabile e vorresti aggiungere capitale reale
o altri operatori, torna qui e spunta una per una.

---

## Nota: cosa è davvero non tecnico

Le fasi 6 e 7 hanno una parte tecnica autonoma che può essere svolta ora
(script di trasferimento ownership, config advisory, test CLI `safe-propose`/`safe-sync`
su fork o mock). Quella parte è nelle cartelle `10_` e oltre.
Ciò che resta qui è solo la parte che richiede una Safe reale deployata on-chain.

---

## Fase 3 — Governance e Safe

**Cartella documentazione:** `09_Phase_3_Safe/`
**Bloccante per:** Fase 6 (trasferimento ownership reale), Fase 7 (advisory), Fase 8 (canary reale).
**Non bloccante per:** Fase 4 (fork simulation), Fase 5 (policy).

Cosa fare quando sei pronto:

- [ ] Decidere numero di owner, identità e threshold della Safe.
- [ ] Procurarsi hardware wallet distinti per ogni owner.
- [ ] Scrivere la procedura di recovery (perdita di una chiave).
- [ ] Creare la Safe su Arbitrum One tramite `app.safe.global`.
- [ ] Verificare owner e threshold on-chain da almeno due dispositivi.
- [ ] Eseguire una transazione innocua di test (0 ETH a se stessa).
- [ ] Seguire la checklist completa in `09_Phase_3_Safe/01_Checklist_Migrazione.md`.

Quando completata, aggiornare lo stato in
`06_Roadmap_Prossimi_Passi_Dal_POC_alla_Produzione.md` §7 e sbloccare la Fase 6.

---

## Fase 6 — Trasferimento ownership reale alla Safe

**Parte tecnica (fatta in `10_Phase_4_Fork/`):** script di trasferimento, calldata, verifica post-condizione — provati su fork il 2 agosto 2026, 13/13 PASS.
**Parte non tecnica (qui):** eseguire le transazioni reali on-chain dopo che la Safe è operativa.

**Dipende da:** Fase 3 (Safe deployata), Fase 4 (fork simulation completata — PASS).

- [ ] Decidere su FASE4-001 (`emergencyHandler.emergencyUnpause()` irraggiungibile dopo trasferimento ownership): fixare il contratto prima del trasferimento reale, oppure accettare esplicitamente il percorso diretto `proxyGeneral.unpause()` come procedura ufficiale. Vedi `10_Phase_4_Fork/03_Registro_Esecuzione.md`.
- [ ] Decidere su FASE5-002 (`ParameterManager.poolReserveRatio` on-chain a `0`, più permissivo della policy off-chain `reserveMinimumBps=1500`): includere la correzione (`setPoolReserveRatio`-equivalente) nel batch di configurazione Safe della Fase 6/7, oppure accettare esplicitamente il gap finché l'automazione resta osservativa. Vedi `11_Phase_5_Policy_e_Whitelist/03_Registro_Esecuzione.md`.
- [ ] Decidere tutti i valori economici della policy Fase 5 (capitale massimo, massimali protocollo, riserva, movimento, importo minimo, cooldown, slippage, fee, limiti deposit/withdraw, health factor, policy oracle/APY, criteri emergency pause) e approvare esplicitamente la policy umana. Vedi `11_Phase_5_Policy_e_Whitelist/03_Registro_Esecuzione.md`, sezione "Cosa resta bloccato".
- [ ] Decidere se aggiornare l'RPC (piano Alchemy o provider diverso) per abilitare la ricostruzione storica completa degli eventi `SelectorAllowanceChanged`, oggi impraticabile per il limite di 10 blocchi per `eth_getLogs` del piano Free.
- [ ] Eseguire il trasferimento ownership reale contratto per contratto.
- [ ] Verificare owner on-chain dopo ogni trasferimento.
- [ ] Eseguire preflight Safe finale.

---

## Fase 7 — Safe advisory: ciclo reale proposta → firme → esecuzione

**Parte tecnica (già nei comandi CLI esistenti):** `safe-propose`, `safe-sync`, config advisory — si testano ora su fork.
**Parte non tecnica (qui):** il ciclo completo con firme reali da hardware wallet richiede Safe operativa.

**Dipende da:** Fase 3, Fase 6.

- [ ] Eseguire ciclo reale proposta → quorum → esecuzione → receipt verificato.

---

## Fase 8 — Canary con capitale minimo

**Dipende da:** Fase 7.
**Capitale massimo deliberatamente sacrificabile:** da scrivere prima di iniziare (es. 5 USDC).
**Nota:** i 3.1 USDC già nel vault potrebbero servire come canary, ma solo
dopo che il sistema advisory è stato testato end-to-end almeno una volta.

---

## Note generali

- Nessuno di questi task richiede modifiche al codice.
- Nessuno di questi task riguarda la sicurezza tecnica del sistema — riguarda la governance operativa.
- Finché l'ownership è sul deployer e l'execution è disabilitata, il rischio è contenuto.
- Non affrettare questi passaggi: una Safe configurata male è peggio di nessuna Safe.
