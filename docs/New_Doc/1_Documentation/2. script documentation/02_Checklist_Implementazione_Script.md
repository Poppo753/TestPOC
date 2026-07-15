# Checklist di implementazione della suite script

> Le caselle vengono aggiornate soltanto dopo implementazione e verifica.

Stato finale: tutte le caselle sono state chiuse dopo typecheck, compile, 37 test
locali combinati, smoke fork read-only al blocco `483105327`, smoke CLI e
confronto hash dei 347 file spostati (0 contenuti mancanti). Dolomite e GMX sono
chiusi come guard di rifiuto intenzionale, non come plugin funzionanti.

## A. Audit e riordino

- [x] Inventariare file, estensioni, entrypoint e cartelle duplicate.
- [x] Cercare API obsolete, hardcode, TODO, mock e dipendenze da private key.
- [x] Verificare quali script sono importati dai test.
- [x] Creare `scripts/legacy` senza eliminare file.
- [x] Spostare famiglie duplicate e one-off nel legacy.
- [x] Conservare i quattro script core già testati e le dipendenze minime.
- [x] Documentare stato, rischi e decisione di perimetro Dolomite/GMX.

## B. Framework

- [x] Creare tipi senza `any` per manifest, runtime, receipt e risultati.
- [x] Creare errori strutturati con code e context.
- [x] Implementare parser env per string, boolean, integer, bigint, address e JSON.
- [x] Implementare parser CLI `--key value`, `--key=value` e flag booleani.
- [x] Definire schema manifest v1.
- [x] Implementare caricamento manifest v1.
- [x] Implementare normalizzazione del vecchio `mainnet-latest.json`.
- [x] Validare chain ID, address e duplicati nel manifest.
- [x] Implementare scrittura atomica del manifest.
- [x] Creare runtime con provider, signer, chain, confirmations e dry-run.
- [x] Supportare dependency injection del runtime nei test.
- [x] Definire `ExecutionPlan` serializzabile per browser, Safe e agenti.
- [x] Separare `buildPlan` da `executePlan`.
- [x] Implementare modalità `encode-only` senza signer.
- [x] Serializzare bigint come stringhe e non esporre segreti.
- [x] Serializzare i nonce nelle sequenze multi-transazione.
- [x] Implementare preflight address/code/chain/signer balance.
- [x] Implementare helper receipt e post-verifica.
- [x] Garantire che dry-run non invii transazioni.
- [x] Creare `tsconfig.scripts.json` escludendo legacy.

## C. Monitoring read-only

- [x] Implementare system status strutturato.
- [x] Verificare moduli Beacon e bytecode.
- [x] Esporre pool value, supply e LP price.
- [x] Esporre flags pause/deposit/withdraw.
- [x] Implementare protocol summaries.
- [x] Implementare health globale e per protocollo.
- [x] Implementare posizioni ordinate per rischio.
- [x] Creare entrypoint CLI read-only.

## D. Amministrazione

- [x] Implementare update modulo Beacon con same-address guard.
- [x] Simulare update prima dell'esecuzione.
- [x] Verificare history Beacon dopo upgrade.
- [x] Implementare registrazione/aggiornamento protocollo.
- [x] Implementare attivazione/disattivazione protocollo.
- [x] Implementare selector whitelist.
- [x] Implementare configurazione/rimozione token.
- [x] Implementare configurazione Aave registry.
- [x] Implementare configurazione Euler vault.
- [x] Implementare configurazione Morpho market.
- [x] Implementare configurazione Morpho vault/default vault.
- [x] Implementare emergency status/pause/unpause.
- [x] Implementare circuit breaker plugin supportati.
- [x] Richiedere `EXECUTE=true` per tutte le mutazioni CLI.

## E. Operazioni vault e protocolli

- [x] Implementare deposit con wrapping WETH e approve esatto.
- [x] Implementare withdraw per share o percentuale.
- [x] Usare deadline ricavata dal blocco corrente.
- [x] Implementare swap via SwapManager con quote/slippage/deadline.
- [x] Verificare balance delta dopo deposit/withdraw/swap.
- [x] Implementare protocol deposit.
- [x] Implementare protocol withdraw.
- [x] Implementare protocol borrow.
- [x] Implementare protocol repay.
- [x] Implementare protocol close position.
- [x] Implementare letture balance/debt/health.
- [x] Rifiutare importi zero e protocolli inattivi.

## F. Deployment

- [x] Implementare deploy core in ordine corretto.
- [x] Registrare tutte le implementazioni nel Beacon.
- [x] Configurare base asset e ChainlinkAdapter.
- [x] Autorizzare moduli in ProxyGeneral.
- [x] Configurare fee, limiti e operazioni abilitate.
- [x] Implementare bundle Uniswap V3 Direct.
- [x] Implementare bundle Aave registry/plugin/lens.
- [x] Implementare bundle Euler registry/plugin/lens.
- [x] Implementare bundle Morpho registry/plugin/lens.
- [x] Implementare bundle MorphoVault plugin/lens.
- [x] Trasferire ownership registry al plugin solo dopo configurazione.
- [x] Registrare plugin/lens nel Beacon e ProtocolManager.
- [x] Salvare manifest dopo ogni fase completata.
- [x] Rifiutare esplicitamente Dolomite e GMX.

## G. Test e qualità

- [x] Testare parser env e CLI.
- [x] Testare normalizzazione/validazione manifest.
- [x] Testare dry-run senza transazioni.
- [x] Testare encode-only e JSON serialization dei piani.
- [x] Testare ordine e stop-on-failure delle sequenze.
- [x] Testare system status e health locale.
- [x] Testare update Beacon e post-verifica.
- [x] Testare protocol registration e selector whitelist.
- [x] Testare token/registry configuration.
- [x] Testare deposit, withdraw e swap.
- [x] Testare protocol deposit/withdraw/borrow/repay/close dove mockabile.
- [x] Testare emergency pause/unpause.
- [x] Rieseguire `Phase1.Core.test.ts`.
- [x] Eseguire type-check della sola suite attiva.
- [x] Eseguire compile Hardhat.
- [x] Eseguire smoke fork read-only al blocco fissato.
- [x] Verificare `git diff --check` e zero file eliminati.

## H. Documentazione finale

- [x] Rileggere strategia e checklist confrontandole con il codice finale.
- [x] Correggere task mancanti o non più corretti.
- [x] Segnare ogni task completato.
- [x] Creare report finale di implementazione e fix.
- [x] Creare guida framework/config/manifest.
- [x] Creare guida deploy e upgrade.
- [x] Creare guida vault e protocolli.
- [x] Creare guida monitoring ed emergency.
- [x] Creare catalogo di ogni script attivo con esempi.
- [x] Documentare il legacy e il processo di eventuale recupero.
