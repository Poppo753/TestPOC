# Fase 5 — checklist policy e selector whitelist

**Stato: tecnicamente in lavorazione, PASS parziale — 2 agosto 2026.**
Tutto ciò che è tecnicamente eseguibile senza una decisione economica
dell'utente è stato completato (sezioni B, C, parti di D/E/F). La sezione A
(valori economici e approvazione umana) resta aperta di proposito: uso i
valori POC attuali come placeholder tecnico, non come policy approvata. Vedi
`03_Registro_Esecuzione.md` per l'evidenza completa e l'elenco preciso di
cosa resta bloccato e perché.

Legenda: `[x]` completato; `[ ]` da fare; `[~]` in corso; `[!]` fallito.

## A. Baseline e decisioni

- [x] Registrare il commit Git da certificare (`ca9ab9f3e488044c685292936aaab53dd71cc7ae`).
- [x] Censire tutti i valori del control file observe (vedi registro).
- [x] Censire fee, slippage e limiti on-chain correnti (vedi registro: `depositFee=0`, `withdrawFee=0`, `maxSlippage=300bps`, `minDeposit/maxDeposit`, `withdrawLimits`, `poolReserveRatio=0`).
- [ ] Registrare il capitale massimo totale deciso — **bloccato**: decisione economica dell'utente, non ancora presa. Placeholder tecnico non approvato: `50000000` unità (50 USDC) nel control file candidato.
- [ ] Registrare il massimale di ogni protocollo — **bloccato**: uso i valori POC attuali (Aave 40%, Euler 30%, MorphoVault 25%) come placeholder, non come decisione approvata.
- [ ] Registrare riserva target e riserva minima — **bloccato**: valori POC attuali (20%/15%) usati come placeholder.
- [ ] Registrare il movimento massimo per ciclo — **bloccato**: valore POC attuale (10%) usato come placeholder.
- [ ] Registrare l'importo minimo per azione — **bloccato**: valore POC attuale (0.1 USDC) usato come placeholder.
- [ ] Registrare il cooldown — **bloccato**: valore POC attuale (3600s) usato come placeholder.
- [ ] Registrare lo slippage massimo — **bloccato**: nessun valore di policy off-chain esiste ancora; on-chain `SwapManager.maxSlippage=300bps` è il solo dato disponibile.
- [ ] Registrare fee di deposito e withdraw — **bloccato**: nessun valore di policy off-chain esiste; on-chain entrambe le fee sono `0`.
- [ ] Registrare limiti deposit e withdraw — **bloccato**: nessun valore di policy off-chain dedicato; solo i limiti on-chain esistenti sono noti (vedi registro).
- [ ] Registrare il health factor minimo — **bloccato**: valore POC attuale (`1.5e18`) usato come placeholder.
- [ ] Registrare la policy per oracle e APY mancanti — **bloccato**: comportamento POC attuale (`requireOracleFreshness=false`) usato come placeholder.
- [ ] Registrare i criteri di emergency pause — **bloccato**: nessuna decisione formalizzata oltre al meccanismo tecnico esistente (vedi FASE4-001 in `10_Phase_4_Fork/`).
- [ ] Ottenere approvazione esplicita dell'utente sulla policy umana — **bloccato**, gate non superabile senza l'utente.

## B. Artefatti tecnici

- [x] Creare un control file candidato senza modificare quello observe (`scripts/automation/config.arbitrum-usdc-poc-1.policy-candidate.json`).
- [x] Usare uno state directory separato per il candidato (`.automation-state/arbitrum-usdc-poc-1-policy-candidate`).
- [x] Mantenere mode `observe`, execution `disabled` e autonomous `false` nel candidato tecnico.
- [x] Tradurre tutti i valori della policy nel control file candidato (valori POC attuali, non approvati).
- [x] Creare la matrice `policy -> controllo off-chain -> controllo on-chain` (vedi registro).
- [x] Identificare ogni limite privo di enforcement on-chain (trovato: capitale massimo totale, assente prima di questa fase).
- [x] Correggere o accettare esplicitamente ogni gap tecnico (corretto: aggiunto `policy.maxTotalCapitalUnits` opzionale e retrocompatibile in `types.ts`/`config.ts`/`risk.ts`).
- [x] Creare test automatici per il control file candidato (`test/deployment/PolicyWhitelist.fork.test.ts`, `test/automation/RiskTotalCapitalCap.test.ts`).
- [x] Verificare che target protocolli più riserva sommino a `10000` bps.
- [x] Verificare che ogni target sia minore o uguale al proprio massimo.
- [x] Verificare che ogni protocollo disabilitato abbia target `0`.

## C. Selector whitelist

- [!] Ricostruire gli eventi `SelectorAllowanceChanged` dal deployment al blocco fork — **infeasible con l'RPC attuale**: Alchemy piano Free limita `eth_getLogs` a 10 blocchi per chiamata (verificato empiricamente); servirebbero centinaia di migliaia di chiamate per coprire ~6.6M blocchi. Sostituito con verifica dello stato attuale (vedi sotto).
- [x] Calcolare lo stato finale per ogni coppia plugin-selector (tramite lettura diretta della mapping `allowedSelectors`, non tramite eventi storici).
- [x] Leggere `allowedSelectors` per ogni selector osservato (firme canoniche + selettore jolly, 4 protocolli).
- [x] Censire AaveV3, EulerV2, MorphoVault e Morpho.
- [x] Collegare ogni selector autorizzato a una firma canonica (nessun selector autorizzato: whitelist vuota confermata).
- [x] Collegare ogni selector autorizzato a un flow documentato (non applicabile: whitelist vuota).
- [x] Verificare assenza del selector `0xffffffff` (verificato per tutti e 4 i protocolli).
- [x] Verificare assenza di selector sconosciuti (nessun selector autorizzato trovato).
- [x] Definire whitelist generica vuota per il POC `supplyOnly` (confermato: 0 selector autorizzati su tutti i protocolli).
- [ ] Generare calldata di revoca per ogni selector non necessario — non applicabile: nessun selector risulta autorizzato da revocare.
- [ ] Aggiungere test negativo per ogni selector revocato — non applicabile, nessun selector da revocare.
- [x] Aggiungere test positivo per ogni selector mantenuto (test negativo generico eseguito: `executeProtocolCall` con selettore non autorizzato reverte con `SelectorNotAllowed`).

## D. Limiti on-chain e calldata

- [x] Confrontare massimali protocollo con enforcement disponibile (enforcement è off-chain nel motore di rischio `risk.ts`, non in Solidity; i contratti non impongono un cap di allocazione per protocollo).
- [x] Confrontare riserva minima con enforcement disponibile (**gap trovato**: `poolReserveRatio` on-chain è `0`, mentre la policy off-chain richiede `reserveMinimumBps=1500`; l'on-chain è quindi più permissivo dell'intenzione off-chain, mitigato dal fatto che `execution.kind=disabled` blocca comunque ogni transazione).
- [x] Confrontare slippage massimo off-chain e on-chain (nessun valore di policy off-chain ancora deciso; on-chain `SwapManager.maxSlippage=300bps`).
- [x] Confrontare fee massime off-chain e on-chain (nessun valore di policy off-chain ancora deciso; on-chain `depositFee=0`, `withdrawFee=0`).
- [x] Confrontare limiti deposit e withdraw off-chain e on-chain (nessun valore di policy off-chain dedicato; on-chain valori registrati nel registro).
- [x] Confrontare health factor off-chain e limiti dei plugin (coerente: policy e osservazione runtime usano la stessa scala 1e18).
- [x] Verificare comportamento fail-closed con oracle stale (già testato in `test/automation/VaultAutomationController.test.ts`, motore di rischio).
- [x] Verificare comportamento deterministico con APY assente (già testato nella suite automation esistente).
- [ ] Generare il batch esatto delle modifiche necessarie — non applicabile: nessuna modifica di selettori è necessaria (whitelist già vuota come richiesto).
- [ ] Decodificare target, selector, argomenti e valori del batch — non applicabile, nessun batch da generare.
- [ ] Verificare che il batch non contenga chiamate fuori policy — non applicabile.
- [ ] Salvare hash e ordine delle calldata — non applicabile.

## E. Simulazione e regressione

- [x] Fissare `FORK_BLOCK_NUMBER` dopo l'ultima configurazione (`490447686`).
- [x] Simulare il batch completo sul fork — non applicabile (nessun batch selettori da applicare); simulata invece la lettura di stato e il caso negativo `executeProtocolCall`.
- [x] Verificare lo stato on-chain dopo il batch (stato allowedSelectors confermato invariato/vuoto).
- [x] Provare superamento del capitale massimo (`test/automation/RiskTotalCapitalCap.test.ts`, motore di rischio, non fork Solidity).
- [x] Provare superamento del massimale protocollo (già coperto da `test/automation/VaultAutomationController.test.ts`).
- [x] Provare violazione della riserva minima (già coperto dalla stessa suite).
- [x] Provare superamento del movimento massimo per ciclo (già coperto dalla stessa suite).
- [ ] Provare azione sotto l'importo minimo — non ripetuto in questa fase; già coperto strutturalmente dal motore `planner.ts`/`risk.ts` testato nella suite automation esistente.
- [ ] Provare azione durante cooldown — già coperto da `test/automation/VaultAutomationController.test.ts` ("builds deterministic withdraw-first deltas and applies movement caps" include un caso cooldown).
- [x] Provare health factor sotto il minimo (già coperto dalla suite automation esistente).
- [x] Provare oracle mancante o stale (già coperto dalla suite automation esistente).
- [x] Provare selector non autorizzato (`test/deployment/PolicyWhitelist.fork.test.ts`, fork reale).
- [x] Ripetere la simulazione sullo stesso blocco (due esecuzioni, 7/7 PASS entrambe).
- [x] Eseguire regressioni e invarianti (compile, typecheck, 40/40 script, 16/16 automation, 5/5 nuovo test capitale, 17/17 invarianti — 4 pending non correlati).
- [x] Verificare risultati deterministici.

## F. Chiusura e handoff

- [x] Verificare che il control file observe sia invariato (hash SHA256 identico, `git status` vuoto sul file).
- [x] Verificare che Arbitrum One sia invariata (nessuna transazione inviata, solo letture e simulazioni su fork `hardhat`).
- [x] Verificare che la VPS observer sia invariata (nessuna connessione SSH in questa sessione).
- [x] Archiviare policy umana, matrice, calldata e output fork (vedi registro; policy umana resta parziale/placeholder in attesa di approvazione).
- [x] Aggiornare `03_Registro_Esecuzione.md`.
- [x] Valutare tutti i criteri PASS dell'handoff.
- [x] Registrare decisione PASS/FAIL tecnico (PASS tecnico parziale: meccanismo e infrastruttura pronti, valori economici e approvazione aperti).
- [x] Registrare approvazione Safe come PENDING finché la Fase 3 è parcheggiata.
- [x] Vietare applicazione reale fino ai gate delle Fasi 3, 4 e 6.

