# Checklist aggiornamento per contratto e plugin

## Regola generale applicabile a ogni aggiornamento

- [ ] Aprire change record con componente, motivazione, commit, ABI e rischio.
- [ ] Verificare storage/costruttore e dipendenze immutabili.
- [ ] Compilare ed eseguire unit, integration, fork, invariant, security e gas rilevanti.
- [ ] Fissare blocco fork e manifest di partenza.
- [ ] Deployare il nuovo contratto senza cambiare routing.
- [ ] Verificare bytecode e constructor args.
- [ ] Simulare la modifica di routing/registry/Beacon.
- [ ] Preparare rollback verso il vecchio indirizzo.
- [ ] Applicare la modifica tramite owner o Safe.
- [ ] Verificare evento, mapping, owner e post-state.
- [ ] Eseguire smoke test senza lasciare fondi o allowance residue.
- [ ] Aggiornare manifest, documentazione e control file se necessario.
- [ ] Conservare il vecchio indirizzo; non distruggere artefatti storici.

## Core

### Beacon

- [ ] Trattare la sostituzione del Beacon come migrazione architetturale, non normale upgrade.
- [ ] Ricostruire tutti i mapping, freeze state e ownership.
- [ ] Migrare ogni consumer che conserva il Beacon come immutable.
- [ ] Non eseguire senza audit dedicato e piano di rollback completo.

### ProxyGeneral

- [ ] Deployare con Beacon e base code invariati.
- [ ] Ricreare tutte le autorizzazioni dei moduli.
- [ ] Verificare custody e spostare asset solo con procedura separata.
- [ ] Aggiornare mapping Beacon `ProxyGeneral` e riferimenti che puntano direttamente al vecchio proxy.

### ChainlinkAdapter

- [ ] Ricreare tutti i feed, decimali, heartbeat e quote currency.
- [ ] Testare stale/negative/zero round e conversioni.
- [ ] Aggiornare Beacon solo dopo confronto prezzi vecchio/nuovo.

### TokenManager

- [ ] Ricreare token data e base asset code.
- [ ] Verificare indirizzi, decimali e heartbeat contro ChainlinkAdapter.
- [ ] Aggiornare Beacon e rieseguire ValueCalculator/LiquidityManager flows.

### ValueCalculator

- [ ] Deployare con Beacon e base code corretti.
- [ ] Confrontare valori e rounding su tutti gli asset supportati.
- [ ] Aggiornare Beacon e rieseguire health/position accounting.

### SwapManager

- [ ] Deployare con Beacon e base code corretti.
- [ ] Ricreare token/policy di swap e limiti slippage.
- [ ] Aggiornare Beacon; non abilitare swap finché simulazione e fork non passano.

### ParameterManager

- [ ] Deployare con i 6 decimali USDC.
- [ ] Esportare e ricreare fee, limiti e rate limits.
- [ ] Verificare che zero/default non allarghino accidentalmente i limiti.

### EmergencyHandler

- [ ] Verificare stato emergency globale e destinazioni di recupero.
- [ ] Autorizzare il nuovo modulo sul ProxyGeneral.
- [ ] Provare pause/unpause e recovery sul fork prima del routing.

### LiquidityManager

- [ ] Deployare soltanto dopo che `BASE_ASSET` e `USDC` sono presenti nel Beacon.
- [ ] Verificare bootstrap shares, rounding, concorrenza e limiti di prelievo.
- [ ] Autorizzare sul ProxyGeneral e aggiornare Beacon.
- [ ] Se cambia custody, eseguire migrazione saldi atomica e auditata.

### ProtocolManager

- [ ] Esportare protocolli, registry, selector e active state.
- [ ] Deployare e ricreare ogni entry senza Dolomite/GMX.
- [ ] Autorizzare sul ProxyGeneral, aggiornare Beacon e verificare owner/Safe.

### FlashLoanService

- [ ] Verificare provider, callback authorization e fee assumptions.
- [ ] Aggiornare Beacon soltanto dopo test di rimborso atomico e revert.

## Bundle protocolli

### AaveV3Registry

- [ ] Esportare token, underlying, aToken, debt token e active state.
- [ ] Deployare, ricreare dati da Aave reserve on-chain e trasferire ownership corretta.
- [ ] Aggiornare Beacon e riferimento ProtocolManager se cambia registry.

### AaveV3Plugin

- [ ] Deployare con nuovo Beacon/base code/Aave Pool verificati.
- [ ] Trasferire o chiudere prima ogni posizione del vecchio plugin.
- [ ] Aggiornare Beacon, Proxy authorization e ProtocolManager nello stesso change set.
- [ ] Provare supply/withdraw/borrow/repay/emergency e circuit breaker.

### AaveV3LensAdapter

- [ ] Deployare con le stesse dipendenze del plugin.
- [ ] Confrontare health e position output vecchio/nuovo.
- [ ] Aggiornare Beacon e ProtocolManager lens.

### EulerRegistry

- [ ] Esportare vault, reverse mappings, position records e subaccount allocations.
- [ ] Chiudere o migrare con prova formale ogni posizione attiva.
- [ ] Ricostruire vault config prima di trasferire ownership al plugin/Safe previsto.

### EulerV2Plugin

- [ ] Verificare generazione EVC/Lens/Vault supportata.
- [ ] Chiudere tutte le posizioni e disabilitare controller/collateral del vecchio plugin.
- [ ] Deployare, aggiornare Beacon/Proxy/ProtocolManager e provare shares/borrow limit.

### EulerLensAdapter

- [ ] Verificare compatibilità ABI con AccountLens, VaultLens e UtilsLens.
- [ ] Confrontare health, debt, collateral e share output.
- [ ] Aggiornare Beacon e ProtocolManager lens.

### MorphoRegistry

- [ ] Esportare market tuple e vault config esatte.
- [ ] Verificare ogni market ID contro Morpho on-chain.
- [ ] Ricostruire market/vault/default prima del trasferimento ownership.
- [ ] Coordinare l'update perché Morpho e Morpho Vault condividono il registry.

### MorphoPlugin

- [ ] Deployare con Morpho singleton immutabile verificato.
- [ ] Chiudere posizioni del vecchio plugin o dimostrare migrazione sicura.
- [ ] Aggiornare Beacon/Proxy/ProtocolManager e testare supply/borrow/repay/close.

### MorphoLensAdapter

- [ ] Verificare market discovery, oracle scale, LLTV e health factor.
- [ ] Aggiornare Beacon e ProtocolManager lens dopo confronto deterministico.

### MorphoVaultPlugin

- [ ] Riscattare o migrare tutte le share ERC-4626 del vecchio plugin.
- [ ] Verificare vault approved/default e `asset() == USDC`.
- [ ] Aggiornare Beacon/Proxy/ProtocolManager e provare deposit/redeem/withdraw.

### MorphoVaultLensAdapter

- [ ] Confrontare shares, assets, maxDeposit/maxWithdraw e health output.
- [ ] Aggiornare Beacon e ProtocolManager lens.

## Chiusura di ogni update

- [ ] Preflight senza warning critici.
- [ ] Fork post-update al blocco fissato.
- [ ] Observe prima di riattivare automazioni.
- [ ] Manifest con transazione, block number, vecchio e nuovo indirizzo.
- [ ] Safe receipt e post-state archiviati.

