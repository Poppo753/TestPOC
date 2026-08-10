# Fase 4 — registro esecuzione rehearsal ownership su fork

## Stato

- stato fase: completata
- operatore responsabile: GitHub Copilot (agente), su richiesta dell'utente
- commit Git: `ca9ab9f3e488044c685292936aaab53dd71cc7ae`
- decisione finale: PASS

## Timestamp

- inizio fase: 2026-08-02T20:xx UTC (sessione locale)
- fine fase: 2026-08-02T21:04 UTC
- timezone usata: UTC per gli orari on-chain/log; CEST per riferimento operatore
- durata totale: circa 1 ora (setup, harness, due esecuzioni, regressione, documentazione)

## Evidenza ambiente

- sistema operativo: Windows (PowerShell)
- Node: v20.12.2 (non v22; il requisito Node 22 della Fase 2 è specifico della VPS observer, non vincolante per questa rehearsal locale — annotato come deviazione non bloccante)
- npm: 10.9.1
- Hardhat: rete `hardhat`, fork Arbitrum One
- chain ID sorgente: 42161
- `FORK_BLOCK_NUMBER`: 490447686
- manifest: `scripts/manifests/arbitrum-usdc-poc-1.json`
- manifest chain ID: 42161
- manifest contract count: 22
- deployer impersonato: `0x8390e98483a9b39265428c8610371134B5d11C3F`
- rete Hardhat verificata: sì (`network.name === "hardhat"` verificato in `before()`, gate bloccante)
- private key reale usata: no (solo account Hardhat locali e impersonation in-fork)

## Evidenza baseline

- working tree: dirty, ma le modifiche non tracciate/modificate sono pre-esistenti e non correlate alla Fase 4 (`dapp-new/assets/css/base.css`, `dapp-new/assets/js/core/reveal.js` modificati; `docs/New_Doc/1_Documentation/Prompt.md` cancellato; cartelle `jethos-web/`, `8. Web Site/8. Enterprise_Astro_02.08.26/` non tracciate). I soli file introdotti da questa fase sono `contracts/mocks/EphemeralMultisig.sol`, `test/deployment/OwnershipTransfer.fork.test.ts` e la documentazione in `09_Phase_3_Safe/`, `10_Phase_4_Fork/`, `11_Phase_5_Policy_e_Whitelist/`, `00_TODO_Non_Tecnico/`.
- `npm ci`: non rieseguito (dipendenze già installate e verificate in sessioni precedenti); `npm run compile` confermato "Nothing to compile" prima delle modifiche, poi ricompilato con successo dopo l'aggiunta di `EphemeralMultisig.sol`.
- compile: PASS (`Compiled 1 Solidity file successfully`, target `paris`, 82 typings generati)
- typecheck: PASS (`tsc -p tsconfig.scripts.json`, nessun errore)
- suite script: PASS (`npm run scripts:test`, 40/40)
- suite automation: PASS (`npm run automation:test`, 16/16)
- problemi trovati: nessuna regressione introdotta dalla nuova suite

## Safe effimera

- indirizzo locale: `0x683659Fef0A0DebfDCf137ACE17AAC998814cDb0` (deterministico sui due run, stesso fork block e stessi signer Hardhat di default)
- owner locali: signer Hardhat `[1]`, `[2]`, `[3]` (signer `[0]` riservato all'utente di test deposit/withdraw)
- numero owner: 3
- threshold: 2
- chain ID: 42161 (fork)
- bytecode: presente, verificato con `getCode` prima dell'uso
- nonce iniziale: 0
- nonce finale (dopo la sola sezione E "transazione innocua"): incrementato di esattamente 1 nel test dedicato; il conteggio assoluto finale è più alto per via delle transazioni di trasferimento, amministrazione, pause/unpause e recovery drill eseguite prima nello stesso run
- una firma rifiutata: sì, verificato due volte (accettazione Beacon e transazione innocua), revert `"EphemeralMultisig: quorum not reached"`
- due firme accettate: sì, verificato in ogni transazione della rehearsal

## Matrice ownership

Matrice completa 22/22 salvata nell'output del test (`console.log` del test F, riprodotto integralmente sotto in forma sintetica). Owner finale per tutti i 21 contratti trasferibili: `0x683659Fef0A0DebfDCf137ACE17AAC998814cDb0` (Safe effimera).

| Contratto | Owner atteso | Metodo | Esito |
|---|---|---|---|
| beacon | Safe locale | due step | PASS |
| proxyGeneral | Safe locale | uno step | PASS |
| chainlinkAdapter | Safe locale | uno step | PASS |
| tokenManager | Safe locale | uno step | PASS |
| valueCalculator | Safe locale | uno step | PASS |
| swapManager | Safe locale | uno step | PASS |
| parameterManager | Safe locale | uno step | PASS |
| emergencyHandler | Safe locale | uno step | PASS |
| liquidityManager | Safe locale | uno step | PASS |
| protocolManager | Safe locale | uno step | PASS |
| flashLoanService | non applicabile | non Ownable | PASS (eccezione documentata) |
| aaveV3Registry | Safe locale | uno step | PASS |
| aaveV3Plugin | Safe locale | uno step | PASS |
| aaveV3LensAdapter | Safe locale | uno step | PASS |
| eulerRegistry | Safe locale | uno step | PASS |
| eulerV2Plugin | Safe locale | uno step | PASS |
| eulerLensAdapter | Safe locale | uno step | PASS |
| morphoRegistry | Safe locale | uno step | PASS |
| morphoPlugin | Safe locale | uno step | PASS |
| morphoLensAdapter | Safe locale | uno step | PASS |
| morphoVaultPlugin | Safe locale | uno step | PASS |
| morphoVaultLensAdapter | Safe locale | uno step | PASS |

## Evidenza trasferimenti

- righe matrice compilate: 22/22
- contratti con bytecode: 22/22
- owner iniziali letti: 21/21, tutti uguali a `0x8390e98483a9b39265428c8610371134B5d11C3F`
- trasferimenti uno step riusciti: 20/20
- Beacon `pendingOwner` dopo proposta: `0x683659Fef0A0DebfDCf137ACE17AAC998814cDb0`
- Beacon `owner` dopo accettazione: `0x683659Fef0A0DebfDCf137ACE17AAC998814cDb0`
- Beacon `pendingOwner` finale: `0x0000000000000000000000000000000000000000`
- owner Safe finali: 21/21
- eccezioni documentate: `flashLoanService` (non Ownable, accesso vincolato al Beacon immutabile)
- tentativi vecchio deployer: 21
- revert vecchio deployer: 21/21
- problemi trovati: nessuno in questa sezione

## Evidenza amministrazione e rollback

- contratto scelto: `parameterManager` (`ParameterManager.sol`)
- funzione scelta: `setParameterTimelock(uint256)` / getter `parameterTimelock()`
- valore iniziale: `86400` secondi (24 ore, default di fabbrica)
- valore temporaneo: `172800` secondi (48 ore)
- safe transaction hash locale: non applicabile (Safe effimera basata su `txId` incrementale, non su hash EIP-712; vedi `EphemeralMultisig.sol`)
- receipt modifica: transazione multisig eseguita con successo (evento `TransactionExecuted(success=true)`)
- valore dopo modifica: `172800`
- receipt rollback: transazione multisig eseguita con successo
- valore dopo rollback: `86400`
- confronto finale: identico al valore iniziale, rollback esatto confermato

## Evidenza pause e unpause

- stato iniziale: `paused = false`
- receipt pause: transazione multisig eseguita con successo via `emergencyHandler.emergencyPause(reason)` (autorizzato perché EmergencyHandler resta modulo autorizzato su ProxyGeneral indipendentemente dall'ownership)
- stato dopo pause: `paused = true`
- timelock letto: valore di `emergencyHandler.unpauseTimelock()` letto a runtime (default di fabbrica 6 ore)
- secondi avanzati nel fork: timelock + 60 secondi di margine (`evm_increaseTime` + `evm_mine`)
- receipt unpause: **problema trovato** — `emergencyHandler.emergencyUnpause()` risulta irraggiungibile dopo il trasferimento ownership (verificato con una `eth_call` di simulazione prima di impegnare il quorum): la chiamata interna `proxy.unpause()` è `onlyOwner` su `ProxyGeneral` e valuta `msg.sender` come l'indirizzo di `EmergencyHandler`, non l'owner reale di `ProxyGeneral`. Questo comportamento non dipende dal trasferimento alla Safe: si presenta identico anche con il deployer originale, perché `unpause()` non riconosce mai il chiamante `EmergencyHandler` come owner autorizzato. **Percorso funzionale verificato**: l'owner di `ProxyGeneral` (la Safe locale) chiama `unpause()` direttamente; eseguito con successo tramite quorum 2-of-3.
- stato finale: `paused = false` (raggiunto tramite il percorso diretto)

### Problema trovato: `emergencyHandler.emergencyUnpause()` non raggiungibile

- identificativo: FASE4-001
- timestamp: 2026-08-02T20:xx UTC (rilevato durante l'esecuzione del test E "pause/unpause")
- descrizione: `EmergencyHandler.emergencyUnpause()` chiama `IProxyGeneral(proxyGeneral).unpause()`; `ProxyGeneral.unpause()` è protetto da `onlyOwner` (OZ Ownable standard), che confronta `msg.sender` con `ProxyGeneral.owner()`. Quando la chiamata proviene da `EmergencyHandler.emergencyUnpause()`, `msg.sender` visto da `ProxyGeneral` è l'indirizzo del contratto `EmergencyHandler`, non l'owner di `ProxyGeneral` (che sia il deployer originale o, dopo Fase 4, la Safe). La chiamata reverte sempre con `"Ownable: caller is not the owner"` (o l'errore custom equivalente della versione OZ in uso).
- severità: media — non è uno security bug (nessun accesso non autorizzato), ma un difetto funzionale che rende inutilizzabile il percorso amministrativo "ufficiale" di unpause con timelock documentato nei commenti del contratto.
- evidenza: simulazione `eth_call` da `from: <indirizzo Safe locale>` verso `emergencyHandler.emergencyUnpause()`, fallita in entrambe le esecuzioni del test (2/2).
- impatto: il timelock di 6 ore pensato per governare l'unpause (`unpauseTimelock`) non è di fatto applicato nel percorso reale, perché quel percorso non è mai eseguibile; l'unico modo reale di fare unpause è la chiamata diretta `proxyGeneral.unpause()` da parte dell'owner di ProxyGeneral, che NON applica alcun timelock.
- decisione: non bloccante per il PASS della Fase 4 (la rehearsal ha lo scopo esplicito di scoprire difetti come questo prima del trasferimento reale). Da correggere prima della Fase 6 (trasferimento reale) o accettare esplicitamente come comportamento voluto, documentandolo.
- responsabile: da assegnare all'utente/proprietario del progetto per la decisione di fix vs accettazione.
- stato: aperto, non bloccante per Fase 4 e Fase 5.

## Evidenza deposit, withdraw e health

- account utente locale: signer Hardhat `[0]`, finanziato con USDC dal whale `0x489ee077994B6658eAfA855C308275EAd8097C4A`
- asset e importo deposito: USDC, importo pari al doppio di `minDeposit` letto a runtime (o 2 USDC minimo)
- quote LP prima: `0` per l'account di test
- quote LP dopo deposito: maggiore di `0` (verificato `greaterThan`)
- receipt deposito: transazione diretta dell'utente riuscita (non instradata dal multisig: `deposit`/`withdraw` non sono owner-only)
- quote ritirate: pari all'intero incremento del deposito
- quote LP dopo withdraw: inferiore al valore post-deposito (verificato `lessThan`)
- receipt withdraw: riuscito
- protocolli health controllati: `AaveV3`, `EulerV2`, `Morpho`, `MorphoVault` (tutti `active:true` nel manifest)
- finding critical: nessuno; `getHealthFactor` via `ProtocolManager` non disponibile per `Morpho` e `MorphoVault` (revert senza reason string, plugin senza posizione aperta), mitigato usando `getGlobalHealthFactor()` come controllo autorevole, che ha restituito un health factor massimo (nessun debito) in entrambe le esecuzioni
- posizioni residue inattese: nessuna; tutte le posizioni sui protocolli restano a `0` (nessuna allocazione, come atteso in modalità observe)

## Evidenza determinismo e cleanup

- prima esecuzione: 13/13 test PASS
- seconda esecuzione: 13/13 test PASS
- stesso `FORK_BLOCK_NUMBER`: sì, `490447686` in entrambe le esecuzioni
- stessi conteggi gate: sì, identici (stesso indirizzo Safe effimera, stesso esito `emergencyUnpauseReachable=false`, stessa matrice)
- differenze spiegate: nessuna differenza osservata tra le due esecuzioni
- impersonation chiusa: sì, in `after()` con gestione dell'errore se già rimossa
- snapshot ripristinato: sì, `evm_revert` in `after()`
- transazioni Arbitrum One inviate: 0 (rete `hardhat` per l'intera durata, verificato a runtime)
- observer reale modificato: no (nessuna connessione SSH alla VPS eseguita in questa sessione; nessun comando mutativo verso `vault-automation-observe.service`)

## Problemi trovati

Vedi "Problema trovato: `emergencyHandler.emergencyUnpause()` non raggiungibile" sopra (FASE4-001). Nessun altro problema bloccante rilevato.

## Gate di uscita

- matrice completa 22/22: sì
- bytecode 22/22: sì
- owner Safe 21/21: sì
- trasferimenti uno step 20/20: sì
- Beacon due step 1/1: sì
- eccezione non Ownable 1/1: sì (`flashLoanService`)
- controllo residuo deployer 0: sì (21/21 revert)
- rollback esatto: sì
- pause/unpause: sì (percorso diretto; percorso `emergencyUnpause()` documentato come non funzionante, vedi FASE4-001)
- deposit/withdraw: sì
- health senza critical non spiegati: sì
- due esecuzioni deterministiche: sì
- cleanup completo: sì
- transazioni mainnet 0: sì
- problemi bloccanti aperti: 0 (FASE4-001 aperto ma non bloccante, da risolvere prima della Fase 6)
- valutazione gate: PASS
- motivazione: tutti i criteri della checklist Fase 4 sono stati soddisfatti con evidenza riproducibile (due esecuzioni deterministiche); l'unico problema trovato (FASE4-001) è esattamente il tipo di difetto che questa rehearsal è progettata per scoprire prima di un trasferimento reale, ed è stato gestito con un percorso alternativo verificato invece di essere nascosto.
- valutatore: GitHub Copilot (agente), su richiesta dell'utente
- timestamp valutazione: 2026-08-02T21:04 UTC


