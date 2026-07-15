# Additional findings — Second pass

**Audit date:** 2026-07-15
**Scope:** stessa dello `ISSUES.md`, focus su aree sotto-coperte: reentrancy cross-contract, storage/upgrade safety, griefing/DoS, precision loss, MEV extra swap, integrazioni protocolli, access boundary, misc.
**Metodo:** review manuale line-by-line di LiquidityManager, ProxyGeneral, SwapManager, Beacon, ValueCalculator, ProtocolManager, EmergencyHandler, TokenManager, DepositHelper, ChainlinkAdapter, MorphoLensAdapter, MorphoRegistry, EulerRegistry, FlashLoanService, e dei plugin (Aave/Euler/Morpho/MorphoVault/UniswapV3Direct). Esclusi: `plugins/old/`, `*.backup`, `EulerV2Plugin copy.sol.md`, file `dolomite`/`gmx`.

Ordine di severity: dal CRITICAL/HIGH verso LOW. Ogni finding riporta severity + categoria (reentrancy | storage | griefing | precision | mev | integration | access | time | misc). I finding con `Ref:` sono varianti/estensioni di issue già in `ISSUES.md`.

---

## NEW-001
- Severity: HIGH
- Category: mev
- File: contracts/Liquiditymanager.sol
- Line: 163-180, 174 (`totalValue = calculator.getTotalPoolValueView()`)
- Title: First-depositor share inflation attack (nessun virtual/dead share, nessuna minimum liquidity)
- Description: Il primo deposito setta `shares = netDeposit` (1:1) senza mint di minimum-liquidity dead shares (pattern OZ ERC4626 con `_decimalsOffset`, o burn-to-address(0) alla Uniswap V2). Il TVL usato per calcolare le quote successive è letteralmente `IERC20(baseAsset).balanceOf(proxyGeneral)` + somma dei balance dei token attivi in `ValueCalculator.getTotalPoolValueView()`. Un attaccante può quindi: (1) fare bootstrap con 1 wei → riceve 1 share, (2) trasferire direttamente 1e18 di base asset (o di qualsiasi token in `TokenManager.getActiveTokens()`) a `ProxyGeneral` con un normale `transfer`, gonfiando il TVL senza mint di nuove shares. Ogni successivo deposito V ottiene `shares = V * 1 / (1e18 + V)` che rounde down aggressivamente (fino a 0 quando V < 1e18). Con V = 2 * 1e18 la vittima riceve `shares = 1`, prende il 50% del pool ma ha contribuito il 66% del suo valore.
- Failure scenario: Attaccante Alice deposita `minDeposit` (10^-6 base asset) e ottiene 1 share. Alice trasferisce direttamente 1 base asset (1e18 se WETH, 1e6 se USDC) al `ProxyGeneral`. Vittima Bob deposita 2 base asset. `shares_Bob = (2e18 * 1) / (1e18 + minDeposit + 1) = 1` (arrotondamento). Il pool ora vale 3e18 con supply 2. Bob withdraw 1 share e riceve `1 * 3e18 / 2 = 1.5e18`. Perdita di Bob: 0.5e18 (25%). Guadagno di Alice: 0.5e18 sui 1e18 donati (50% profit istantaneo).
- Recommendation: Aggiungere protezione minimum-liquidity o virtual shares al primo deposito. Opzioni: (a) mint `MINIMUM_LIQUIDITY = 10^3` shares a `address(0)` alla prima chiamata (Uniswap V2 style); (b) usare `_decimalsOffset = 6+` come OpenZeppelin ERC4626 con virtual assets/shares nel calcolo di `shares = (netDeposit * (totalSupply + 10^offset)) / (totalValue + 1)`; (c) richiedere che il primo deposito sia fatto solo dall'owner in un initializer, dopo un mint di seed shares non riscattabili. Aggiungere anche `minLpTokensOut` alla firma di `deposit` (Ref: CORE-064 solo copre `depositETH`).

---

## NEW-002
- Severity: HIGH
- Category: mev
- File: contracts/Liquiditymanager.sol
- Line: 127-214
- Title: Sandwich deposit — attacker front-run che dona base asset a `ProxyGeneral` prima del deposit vittima
- Description: `LiquidityManager.deposit(uint256 amount)` non accetta `minLpTokensOut` e non ha deadline. Un attaccante può: (1) osservare in mempool un deposit V della vittima, (2) inserirsi con un `IERC20.transfer` diretto verso `ProxyGeneral` di un ammontare D del base asset (nessun controllo di provenienza, `getTotalPoolValueView` legge solo `balanceOf`), (3) lasciare eseguire il deposit vittima con `shares = V * S / (T + D)` << `shares = V * S / T` atteso, (4) uscire con `withdraw` per riprendere quasi tutta la donazione più una frazione del valore vittima. Costo per attaccante: solo il gas dei tre step. Il `ValueCalculator.getTotalPoolValueView()` non ha alcun meccanismo per distinguere "asset legittimi (via deposit)" da "asset donati". La 3% acceptance threshold in `_executeAutomaticSwap` (CORE-025) non aiuta perché applicata solo al withdraw automatico.
- Failure scenario: Bob invia in mempool `deposit(10 WETH)` mentre `totalSupply = 100` e `totalValue = 100 WETH` (share price 1:1). Alice priorità gas +1, esegue `WETH.transfer(proxyGeneral, 100 WETH)`. Ora totalValue = 200 WETH. Bob’s deposit calcola `shares = 10 * 100 / 200 = 5`. Bob riceve 5 shares invece di 10 (perde il 50%). Alice a fine blocco (o blocco successivo) withdraw 100/205 delle proprie shares esistenti — se Alice aveva shares, ottiene il valore aumentato dalla donazione + parte del deposit di Bob.
- Recommendation: Aggiungere parametro `minLpTokensOut` obbligatorio a `deposit(amount, minLpTokensOut)`. Considerare anche un sistema di TVL "commit" (deposit contabilizzato solo se via `deposit()`, non via `balanceOf`): tracking interno del `totalDeposited` invece di leggere `balanceOf(proxyGeneral)`. Questo elimina anche la donation-based NAV inflation di NEW-003.

---

## NEW-003
- Severity: HIGH
- Category: mev
- File: contracts/ValueCalculator.sol
- Line: 214-289 (`getTotalPoolValue`), 295-316 (`getTotalPoolValueView`)
- Title: NAV inflation via donazione diretta di qualsiasi token attivo, non solo base asset
- Description: `getTotalPoolValue` e `getTotalPoolValueView` costruiscono il TVL sommando: (i) `IERC20(baseAsset).balanceOf(proxyGeneral)`, (ii) per ogni token in `TokenManager.getActiveTokens()` — `(balanceOf(proxyGeneral) * price) / 10^decimals`, (iii) valore dei protocolli. Il balance letto è quello raw on-chain: qualsiasi utente può inflare il NAV facendo `IERC20(activeToken).transfer(proxyGeneral, X)`. Combinato con NEW-001/002 amplifica l'attacco (l'attaccante può usare token secondari, con prezzo oracolo alto ma non gettato da lui, per gonfiare il NAV).
- Failure scenario: Attaccante ha WBTC (attivo nel pool WETH). Trasferisce 1 WBTC a `ProxyGeneral`. Il valore del pool sale di `1 * price_WBTC / 10^8` = circa 25 WETH. Successivo deposit vittima è diluito. In alternativa: l'attaccante fa fake deposit tramite un modulo autorizzato compromesso (o via `ProxyGeneral.depositToken` chiamato da un plugin) e poi withdraw indietro — netto zero ma inflazione temporanea del NAV durante il blocco.
- Recommendation: Come per NEW-002, spostare da `balanceOf`-based accounting a **internal tracking**. Mantenere `totalDeposited[tokenCode]` incrementato SOLO da funzioni contabilizzate (deposit/depositToken/swap output). Il balance leftover in `ProxyGeneral` diventa "recuperabile via rescue" ma non contribuisce al NAV. In alternativa, `ValueCalculator.getTotalPoolValueView` dovrebbe leggere `min(balanceOf, trackedBalance)`.

---

## NEW-004
- Severity: HIGH
- Category: reentrancy
- File: contracts/ProxyGeneral.sol
- Line: 18, 157, 172, 191, 249, 293, 347, 363, 380, 459, 585, 644, 665, 704
- Title: `ProxyGeneral` importa `ReentrancyGuard` ma NESSUNA funzione ha il modifier `nonReentrant`
- Description: Il contratto eredita da `ReentrancyGuard` (line 18) ma nessuna funzione (`mint`, `burn`, `transferFunds`, `withdrawToken`, `depositToken`, `approveSpender`, `transferToModule`, `transferFromModule`, `emergencyTransferAll`, `trackOperation`, `incrementHourlyWithdrawn`, `receive`, `fallback`) applica `nonReentrant`. In particolare `transferFunds` fa una low-level `to.call{value: amount}("")` (line 198) verso indirizzo arbitrario — se `to` è un contratto malevolo, può reentrare in una qualsiasi funzione di `ProxyGeneral` (o in un modulo autorizzato che a sua volta chiama `ProxyGeneral`). L'unico mutex globale è la state variable `paused`, ma di default `paused == false` e viene toggled solo in emergenza. Cross-contract reentrancy: durante `SwapManager.performSwap` → `plugin.inputSwap` → `IERC20.transfer` a `ProxyGeneral` → callback ERC777 → chiama `LiquidityManager.deposit` (con `nonReentrant` LM) o direttamente `ProxyGeneral.transferFunds` (nessun guard).
- Failure scenario: Base asset è un token ERC777 (rara ma possibile — Statera, EthereumMax stile) o un token con hook post-transfer. Attaccante chiama `LiquidityManager.withdraw(100)`. Nel path di `_withdrawInternal` → `proxy.withdrawToken(baseAssetCode, totalNeeded, address(this))` → `safeTransfer` a LM → callback ERC777 → attaccante reentra in `SwapManager.swapWithBestPlugin` (che ha `nonReentrant` sui suoi function, ma il guard è per-contratto — diverso da LM). Dallo SwapManager riesce a triggerare `proxy.approveSpender` e `plugin.inputSwap` mentre l’originale withdraw sta ancora aggiornando il balance atteso post-swap. Esito: incoerenza tra `newBalance` letto (line 327 di LM) e stato reale. LM legge un balance più basso perché nel reentrancy path lo SwapManager ne ha appena consumato.
- Recommendation: Aggiungere `nonReentrant` a tutte le funzioni state-changing di `ProxyGeneral` (`transferFunds`, `withdrawToken`, `depositToken`, `transferToModule`, `transferFromModule`, `mint`, `burn`, `approveSpender`, `emergencyTransferAll`). Alternativamente, spostare a un mutex condiviso "cross-module" (single storage slot in `ProxyGeneral` letto da tutti i moduli). Ref: CORE-074 (parziale, solo `emergencyWithdraw`).

---

## NEW-005
- Severity: HIGH
- Category: storage
- File: contracts/Beacon.sol
- Line: 109-137 (updateImplementation), 302-338 (batchUpdateImplementations)
- Title: Beacon-lookup pattern senza migrate: `updateImplementation` fa perdere TUTTO lo storage runtime
- Description: `Beacon.updateImplementation("SwapManager", newAddr)` sostituisce l'indirizzo del modulo con un altro contratto concretamente deployato. Non è un TransparentProxy → i contratti hanno il proprio storage individuale. Alla sostituzione: `SwapManager.maxSlippage`, `activeSwapPlugin`, `simpleSwapRouter`, `minSwapAmounts`, `maxSwapAmounts`, `swapErrors`, `swapSuccesses`, `swapsEnabled`, `defaultDeadlineWindow` — tutti persi (o meglio: il nuovo contratto parte da default). Simile per `TokenManager.tokenData` (config token registry), `ParameterManager.parameters` (parametri governance), `LiquidityManager.withdrawLimits/hourlyWithdrawnAmount`, `ProxyGeneral.authorizedModules/RateLimit` mappings, `EmergencyHandler.emergencyContacts/snapshots`, tutte le registry Aave/Euler/Morpho (vault mappings, position IDs, sub-account allocations). Un upgrade è di fatto un teardown completo del modulo. Non c'è alcuna funzione `migrate(oldImpl)` in nessun contratto. Il piano di remediation al `CORE-058` menziona timelock su updateImplementation, ma non affronta il problema di migrazione.
- Failure scenario: Owner scopre bug su `SwapManager.setActiveSwapPlugin`. Deploya nuovo SwapManager con fix. Chiama `Beacon.updateImplementation("SwapManager", newAddr)`. Da questo momento: `activeSwapPlugin` torna al default `"UniswapV3Plugin"` (mai settato via constructor?), quindi rotture di flow che usavano un plugin custom. `swapSuccesses`/`swapErrors` tracking perso → statistiche zerate. Peggio: se il vecchio SwapManager aveva `IERC20.approve(plugin, MAX)` ancora attivo (CORE-012), quelle approve puntano al VECCHIO SwapManager come `owner()` del contratto ma il vecchio contratto non ha più autorità (non è più il `SwapManager` per il sistema). L'approve stessa passa da `ProxyGeneral` (che approva lo spender = plugin), quindi resta valida — ma il vecchio SwapManager potrebbe ancora chiamare `plugin.inputSwap` come EOA-like se il plugin non filtra caller, drenando token.
- Recommendation: Documentare esplicitamente che il pattern è "beacon-lookup, non-upgrade" e vietare `updateImplementation` per moduli con storage stateful. In alternativa, richiedere che ogni modulo esponga `migrateFrom(address oldImpl)` che copi lo storage significativo, e che `Beacon.updateImplementation` chiami questa funzione atomicamente. In terza alternativa, migrare tutto il pattern a `TransparentUpgradeableProxy`/`UUPS` con `ERC-1967` storage slot fissi. Aggiungere anche una funzione `Beacon.revokeImplementation(module)` per finalizzare il retirement.

---

## NEW-006
- Severity: HIGH
- Category: access
- File: contracts/ProxyGeneral.sol
- Line: 363-371 (`transferToModule`), 380-385 (`transferFromModule`)
- Title: `transferToModule` permette a QUALSIASI modulo autorizzato di dirottare qualsiasi asset verso QUALSIASI altro modulo autorizzato
- Description: `transferToModule(address token, address module, uint256 amount)` è `onlyAuthorizedModule` e richiede che `module` (destinazione) sia anche autorizzato. Non c'è check che il caller sia il "proprietario" logico del token, né che `module` abbia bisogno di quell'asset. Un modulo compromesso o un modulo con bug che espone questa capability (es. `SwapManager.emergencyTokenRecovery` line 1558-1576 fa già `proxy.transferFunds`, ma un futuro modulo potrebbe esporre `transferToModule` senza wrapper access-control) può muovere arbitrariamente 100% degli asset tra moduli. Combinato con il fatto che ogni plugin (`AaveV3Plugin`, `MorphoPlugin`, `EulerV2Plugin`, ecc.) è autorizzato in `ProxyGeneral` per fare i propri `withdrawToken`/`transferFunds`, il blast radius di un plugin compromesso è totale.
- Failure scenario: `UniswapV3Plugin` (attualmente `onlyOwner` non presente sui suoi metodi swap — vedi CORE-030, PLG-026) è chiamabile da chiunque. Un attaccante potrebbe non chiamarlo direttamente, ma se una futura versione espone metodi che invocano `proxy.transferToModule`, l'attaccante può reindirizzare fondi tra plugin. Inoltre `transferToModule` è raw `IERC20.transfer` (line 367) → USDT-incompatibile (Ref: CORE-055/56 estensione).
- Recommendation: Restringere `transferToModule` a un role dedicato (es. solo `ProtocolManager` per il "trasferimento a plugin per operazione"). Passare a SafeERC20 per tutti i movimenti. Considerare di rimuovere `transferToModule` in favore di `withdrawToken` (che è già per-recipient) + approve mirato.

---

## NEW-007
- Severity: HIGH
- Category: precision
- File: contracts/adapters/MorphoLensAdapter.sol
- Line: 178 (`return (collateralValue * params.lltv) / (debtAssets * WAD);`)
- Title: MorphoLensAdapter._computeMarketHF replica lo stesso bug scala HF di MorphoPlugin (Ref: PLG-005) — HF ritornato al monitoraggio è 1e18× più basso del reale
- Description: L'adapter di lettura Morpho ha la stessa formula errata del plugin: `HF = (collateralValue * lltv) / (debtAssets * WAD)`. Poiché `collateralValue` e `debtAssets` sono entrambi in unità del loan token e `lltv` è già in WAD, dividere ulteriormente per WAD ridimensiona il risultato di 1e18×. Il valore ritornato è un ratio adimensionale (es. 1.72) invece del formato WAD atteso (1.72e18). Tutte le funzioni pubbliche che leggono HF via MorphoLensAdapter — `getHealthFactor()`, `getPositionHealth()`, `getPositionsSortedByRisk()`, `getProtocolSummary()` — restituiscono valori ~1e18× più piccoli di quelli reali. Interfacce di monitoring / dashboard segnaleranno "sotto 1e18 = liquidazione imminente" per posizioni sane.
- Failure scenario: LP ha una posizione Morpho con HF reale = 1.5 (in WAD: 1.5e18). MorphoLensAdapter riporta HF = 1.5 (interpretato come 1.5 wei = 1.5e-18). Sistema di monitoring esterno lo segnala come "position at liquidation risk". Il team esegue un forced close (via `closePositionsForBaseAsset`) su una posizione perfettamente sana → perdita non necessaria di collaterale + gas + slippage swap.
- Recommendation: Rimuovere la divisione per `WAD` nella formula: `return (collateralValue * params.lltv) / debtAssets;`. Verifica identica in `MorphoPlugin._computeHealthFactor` (PLG-005) e uniformare al pattern ufficiale Morpho (`SharesMathLib` + `MathLib.wDivDown`).
- Ref: PLG-005 (variante nel LensAdapter — separato dal plugin bug)

---

## NEW-008
- Severity: HIGH
- Category: integration
- File: contracts/plugins/EulerV2Plugin.sol
- Line: 1000-1024 (batch open), 1054-1096 (batch close), 597-632 (`getHealthFactor`)
- Title: Callback flash-loan Euler opera sull'account principale (`address(this)`) mentre la registry allocca un sub-account — HF, controllers, positionsSortedByRisk tutti puntano all'entità sbagliata
- Description: In `_handleOpenLeverageCallback` linee 1002-1020, `evc.batch` viene costruito con `onBehalfOfAccount: address(this)` per tutte le operazioni (`enableCollateral`, `deposit`, `enableController`, `borrow`). Ma successivamente `openLeverageAtomic` (line 791-797) invoca `IEulerRegistry.createPositionOnDemand(...)` che allocca un `subAccountId != 0` e memorizza `LeveragePositionStorage.subAccountId`. Quindi la posizione EVC reale è sul MAIN account (via XOR 0), mentre il registry pensa sia su sub-account XOR N. Coerenza spezzata: `getHealthFactor()` interroga `evc.getControllers(address(this))` correttamente perché main account, ma `_getPositionAccount(pos)` (line 1292-1305) preferisce il sub-account se ha debito — e il sub-account NON ha debito (tutto sul main). Quindi `closePosition(positionId)` prende `pos.subAccountId` dal registry, ma il debito è sull'account principale. `_handleCloseLeverageCallback` (linea 1069, 1077) è coerente col main → chiude effettivamente la posizione, ma il registry rimane con `isActive = true` e `subAccountId = N` per un sub-account che non è mai stato usato.
- Failure scenario: Aggregatore di posizioni multiple: LP apre posizione WETH/USDC → registry.subAccountId = 1. LP apre posizione WBTC/USDC → registry.subAccountId = 2 (chiave hash diversa). Entrambe le posizioni "vivono" sul main account. `evc.getControllers(mainAccount)` ritorna [WBTC_borrowVault, USDC_borrowVault] o solo l'ultimo abilitato. `getHealthFactor()` usa `controllers[0]` = probabile WBTC_borrowVault; interroga `AccountLens.getAccountLiquidityInfo(mainAccount, WBTC_borrowVault)` → ritorna liquidità globale del main account contro il collaterale ma con controller sbagliato. Ne segue HF spuria che non riflette nessuna delle due posizioni singolarmente.
- Recommendation: Decidere: **Opzione A**: rimuovere completamente la sub-account allocation → registry salva sempre `subAccountId = 0` e allow one active position per vault-pair. **Opzione B**: applicare correttamente il sub-account in EVC — nel batch, passare `onBehalfOfAccount: _deriveSubAccount(pos.subAccountId)` e trasferire i token flash loan a quell'indirizzo via `evc.call` (analogo a `addCollateralToPosition` con la fix di PLG-047). L'attuale ibrido è incoerente.
- Ref: PLG-006 (stesso root cause, ampliato con l'impatto su `getHealthFactor`)

---

## NEW-009
- Severity: MEDIUM
- Category: integration
- File: contracts/plugins/MorphoRegistry.sol
- Line: 242-247 (`setDefaultVault`), 212-228 (`removeVault`), 233-237 (`setVaultStatus`)
- Title: `setDefaultVault` non verifica che `vault.assetCode` corrisponda a `assetCode`; `removeVault` e `setVaultStatus(false)` lasciano `_defaultVaults` pointer stale
- Description: `setDefaultVault(string assetCode, address vault)` richiede solo `_vaultApproved[vault]`. Non verifica che il `VaultConfig.assetCode` del vault sia uguale al parametro `assetCode`. Un owner può accidentalmente settare il default vault di "USDC" a un vault MetaMorpho USDT o WETH. `MorphoVaultPlugin.deposit("USDC", 1e6)` chiama `registry.getDefaultVault("USDC")` → ottiene un vault WETH e chiama `_vaultDeposit(vault, amount)` → l'`IERC4626(vault).asset()` legge WETH mentre `IERC20(WETH).balanceOf(address(this))` è 0 (il plugin ha USDC, non WETH) → revert `InsufficientBalance`.

  Peggiore: `removeVault(address vault)` (line 212) e `setVaultStatus(vault, false)` (line 233) NON puliscono `_defaultVaults` mapping. Dopo la rimozione, `getDefaultVault(assetCode)` continua a ritornare l'indirizzo del vault rimosso. `MorphoVaultPlugin.deposit` chiama `_vaultDeposit(removedVault, amount)` → questo NON è più in `_vaultApproved` ma il plugin usa `onlyApprovedVault` solo su `vaultDeposit`/`vaultWithdraw`/`vaultRedeem` public (line 262, 280, 299), NON su `_vaultDeposit`/`_vaultWithdraw` internal chiamate dal path IProtocolAdapter. `_vaultDeposit` chiama direttamente `IERC4626(vault).deposit(...)` sul vault "rimosso" → se il vault è ancora vivo on-chain deposita comunque, ma il plugin ora ha shares non tracciate; se il vault è stato drainato/paused, revert generico. Vault status downgrade viene silenziosamente ignorato dal routing default.
- Failure scenario: Owner rimuove un vault MetaMorpho per policy change. Il default per "USDC" era quello. Un utente chiama `deposit("USDC", 100e6)` via ProtocolManager → arriva a `MorphoVaultPlugin.deposit("USDC", 100e6)` → `getDefaultVault("USDC")` ritorna il vault rimosso → `_vaultDeposit` deposita su un vault non più supportato → shares MetaMorpho depositate al vecchio vault, plugin le traccia in `activeVaults` (line 389), ma le funzioni di monitoring esterne (che leggono la registry) non lo sanno.
- Recommendation: (1) In `setDefaultVault`, aggiungere `require(keccak256(bytes(_vaultConfigs[vault].assetCode)) == keccak256(bytes(assetCode)), "asset mismatch")`. (2) In `removeVault` e in `setVaultStatus(vault, false)`, iterare `_defaultVaults` e cancellare le entry che puntano al vault rimosso/disattivato (o mantenere un reverse mapping per efficienza). (3) In `MorphoVaultPlugin._vaultDeposit` e `_vaultWithdraw`, aggiungere `require(_getRegistry().isVaultApproved(vault))` prima dell'operazione.

---

## NEW-010
- Severity: MEDIUM
- Category: griefing
- File: contracts/EmergencyHandler.sol
- Line: 291, 384 (`emergencyExecuted["withdraw"] = true`)
- Title: `emergencyWithdraw()` marca `emergencyExecuted["withdraw"] = true` INCONDIZIONATAMENTE, anche se tutti i trasferimenti sono falliti
- Description: `emergencyWithdraw()` è protetta da `require(!emergencyExecuted["withdraw"], "Emergency withdraw already executed")` (line 292). Alla fine (line 384) fa `emergencyExecuted["withdraw"] = true` senza controllare se `successfulWithdraws > 0` o `totalWithdrawn > 0`. Combinato con CORE-001 (l'`emergencyTransfer(address,uint256,address)` di ProxyGeneral non implementato → tutte le `try proxy.emergencyTransfer` catturano un revert generico), lo stato risultante è: 0 asset trasferiti, ma `emergencyExecuted["withdraw"] = true` blocca ogni futuro tentativo. L'unica via è chiamare `resetEmergencyState("withdraw")` (line 671), che è `onlyOwner` — quindi funziona come recovery, ma è un failure mode nascosto: un owner distratto vede "withdraw eseguito" nell'event log e non sa che 0 asset sono usciti.
- Failure scenario: Sistema compromesso, owner scatena emergency withdraw. Tutti i token falliscono per CORE-001 (`emergencyTransfer` non implementata). Owner vede `EmergencyWithdrawCompleted(0, 0, N)` nel log ma non capisce immediatamente. Chiama `emergencyPause` → poi vuole re-tryare `emergencyWithdraw` → revert "already executed". Deve prima chiamare `resetEmergencyState("withdraw")`. Nel frattempo attaccante sta drainando.
- Recommendation: Setta `emergencyExecuted["withdraw"] = true` solo se `successfulWithdraws == activeTokens.length + 1` (tutti sono riusciti) o `totalWithdrawn > 0` (almeno uno). Altrimenti lasciare il flag a false e permettere retry. In alternativa, rimuovere del tutto il one-shot semantico (l'emergency withdraw dovrebbe essere reidempotente per definizione: chiamalo N volte, drena quello che c'è).

---

## NEW-011
- Severity: MEDIUM
- Category: griefing
- File: contracts/ProxyGeneral.sol
- Line: 320-336 (`_resolveTokenAddress`), 249-270 (`withdrawToken`)
- Title: `withdrawToken` reverte se il token è stato disattivato in `TokenManager` — asset rimangono trapped
- Description: `_resolveTokenAddress(tokenCode)` chiama `ITokenManagerForModules(tm).getTokenInfo(tokenCode)`. `TokenManager.getTokenInfo` non è stato letto integralmente ma dalla firma pubblica di `getTokenAddress` (verificato via `getTokenPrice`) sappiamo che `!isActive` fa revert (`require(tokenData[_tokenCode].isActive, "Token not active")` line 276). Se un owner chiama `TokenManager.removeToken("XYZ")` mentre `ProxyGeneral` detiene ancora balance XYZ (per swap in-flight, per depositi ancora non swappati, o semplicemente per token accumulati via `receiveFromModule`), `ProxyGeneral.withdrawToken("XYZ", ...)` reverte con "Token not active". L'unica via per recuperare è `emergencyTransferAll` (CORE-010: sweepa solo base asset + ETH), quindi in pratica XYZ è stuck. Anche `SwapManager.emergencyTokenRecovery(tokenCode, ...)` chiama `tokenManager.getTokenAddress(tokenCode)` che ha lo stesso revert (line 387 di TokenManager).
- Failure scenario: Owner decide di rimuovere "UNI" dal pool (poco liquidity). Balance corrente in `ProxyGeneral`: 500 UNI. Owner chiama `TokenManager.removeToken("UNI")`. Da questo momento `ProxyGeneral.withdrawToken("UNI", ...)` reverte. `SwapManager.emergencyTokenRecovery("UNI", ...)` reverte. Neanche `emergencyTransferAll` li recupera perché skippa non-base-asset non-tracked. I 500 UNI diventano trapped fino a: (a) reintegrare il token in TokenManager, (b) upgrade di ProxyGeneral con via alternativa (che perde altro stato per NEW-005).
- Recommendation: (1) In `ProxyGeneral._resolveTokenAddress`, aggiungere una branch che ammette anche token disattivati (view function di `TokenManager` che ritorna `TokenInfo` senza revert su `!isActive`, o un nuovo `getTokenAddressUnsafe(tokenCode)` che ritorna 0 in caso di non trovato). (2) In `TokenManager.removeToken`, richiedere `require(IERC20(tokenAddress).balanceOf(proxyGeneral) == 0, "balance still exists")` prima di rimuovere.

---

## NEW-012
- Severity: MEDIUM
- Category: access
- File: contracts/ProtocolManager.sol
- Line: 584-598 (`updateProtocol`)
- Title: `updateProtocol` permette swap silenzioso di plugin/lensAdapter/registry senza timelock né validazione
- Description: `updateProtocol(protocolName, plugin, lensAdapter, registry)` è `onlyOwner` singolo step, no timelock. Owner può sostituire il `plugin` field di un protocollo registrato con un contratto arbitrario. Il campo `plugin` viene poi usato da tutte le call: `deposit`, `withdraw`, `borrow`, `repay`, `closePosition`, `executeProtocolCall`, `closePositionsForBaseAsset`. Non ci sono controlli su: (a) il nuovo plugin implementa l'interfaccia attesa, (b) il nuovo plugin punta agli stessi Aave/Morpho/Euler pool, (c) coerenza con `lensAdapter` (che potrebbe rimanere il vecchio → mismatch tra dati letti e stato reale delle posizioni). L'evento emesso è `ProtocolRegistered` (non `ProtocolUpdated`) — CORE-041 flag già ma questo va oltre l'event misleading e riguarda il rischio operativo.
- Failure scenario: Owner compromesso (o operatore incompetente) esegue `updateProtocol("EulerV2", maliciousPlugin, existingLens, existingRegistry)`. `maliciousPlugin` esporta le stesse firme di `EulerV2Plugin` ma dirotta i fondi ricevuti via `deposit`. Alla prossima operazione `ProtocolManager.deposit("EulerV2", "WETH", 100e18)` → `proxyGeneral.withdrawToken("WETH", 100e18, maliciousPlugin)` → maliciousPlugin trasferisce a un wallet controllato dall'attaccante.
- Recommendation: Aggiungere timelock (via `ParameterManager` o simile) per `updateProtocol`. Nel meantime, aggiungere check: (i) plugin deve rispondere a `IProtocolAdapter.protocolType()` con lo stesso valore del plugin precedente; (ii) plugin deve avere codesize > 0 (`extcodesize`); (iii) considerare di richiedere che `lensAdapter.getPlugin()` restituisca il nuovo plugin (coerenza). L'evento deve chiamarsi `ProtocolUpdated`. Ref: CORE-041 estende.

---

## NEW-013
- Severity: MEDIUM
- Category: misc
- File: contracts/SwapManager.sol
- Line: 799-820 (`_getSwapPluginNames`), 831-850 (`_isSwapPlugin`)
- Title: Filtro plugin swap troppo permissivo — TUTTI i moduli che finiscono con "Plugin" vengono interrogati, inclusi lending plugin (AaveV3Plugin, MorphoPlugin, EulerV2Plugin)
- Description: `_isSwapPlugin(moduleName)` accetta qualsiasi stringa che termini con i 6 byte "Plugin". Nella registry Beacon sono registrati con questo suffisso: `UniswapV3Plugin`, `UniswapV3PluginDirect` (swap ok), ma anche `AaveV3Plugin`, `EulerV2Plugin`, `MorphoPlugin`, `MorphoVaultPlugin`, `DolomitePlugin`. `getAllQuotes` (line 921-965) itera fino a 10 di questi e chiama `plugin.getExpectedOutput(...)` su ciascuno. I lending plugin NON implementano `ISimpleSwap.getExpectedOutput(address,address,uint256,uint8,uint8)` → il try/catch (line 950) catcha e marca isValid = false. Costo: gas per il selector-not-found revert × N plugin per quote — su Arbitrum ~2-5k gas per revert × 5 plugin = 10-25k gas sprecati per swap. Peggio: se un lending plugin implementasse ACCIDENTALMENTE una funzione con la stessa firma per altri fini, verrebbe interrogata come oracolo — comportamento imprevedibile.
- Failure scenario: `SwapManager.swapWithBestPlugin("WETH", "USDC", 1e18, ...)` in un pool con 5 lending plugin registrati + 1 swap plugin. Il best-quote loop fa 6 chiamate: 5 fallite + 1 valida. Costo gas addizionale ~15k. Su base ricorrente (LM auto-swap durante withdraw), il costo si accumula.
- Recommendation: (1) Aggiungere un enum `ModuleCategory { SWAP, LENDING, ORACLE, ... }` al `Beacon` e filtrare per category. Alternativamente: (2) mantenere una lista whitelist di plugin swap in `SwapManager` (`registerSwapPlugin`/`unregisterSwapPlugin` `onlyOwner`) invece di derivarla dal nome. Il naming-based approach viola il principio "explicit over implicit". Ref: CORE-030 (variante).

---

## NEW-014
- Severity: MEDIUM
- Category: precision
- File: contracts/Liquiditymanager.sol
- Line: 278-343
- Title: `_withdrawInternal` calcola `withdrawFee` sull'ammontare pre-clamp, ma clampa `netWithdraw` dopo (fee viene inflazionato relativo al ricevuto reale)
- Description: Il flusso withdraw è: (1) `validation.amount = _shares * totalValue / totalSupply` (line 279); (2) `feeAmount = validation.amount * withdrawFee / 10000; netWithdraw = validation.amount - feeAmount` (line 286-287); (3) se pool balance insufficient, si triggera `_executeAutomaticSwap` e successivamente `if (newBalance < netWithdraw) netWithdraw = newBalance` (line 329-331). Il problema: `feeAmount` è calcolato su `validation.amount` (target teorico), ma se `netWithdraw` viene clampato al `newBalance`, la fee resta pesata come se avesse ricevuto l'intero `validation.amount`. Il `totalNeeded` a line 349-352 `totalNeeded = netWithdraw + feeAmount` — la fee viene tolta comunque dall'account del pool (via `proxy.withdrawToken(baseAssetCode, totalNeeded, ...)` line 353) — quindi la fee effettivamente applicata all'utente in caso di clamping è > `withdrawFee%` sul ricevuto. Esempio: shares valgono 100 base asset, fee 5% → utente atteso 95, pool preleva 5 fee. Ma pool ha solo 80 → `netWithdraw` clampato a 80. Utente riceve 80, fee resta 5. Fee effettiva = 5/80 = 6.25%. E CORE-003 (silent clamp + full share burn) amplifica ulteriormente: utente perde 100 - 85 = 15 base asset di value contro il 5% previsto.
- Failure scenario: Come sopra. Utente vede documenti "fee 5%" e riceve 80/100 = 20% di haircut. Combined con CORE-003, i suoi shares vengono comunque interamente bruciati (line 346 `proxy.burn(msg.sender, _shares)`).
- Recommendation: Ricalcolare la fee sul `netWithdraw` clampato: quando il clamp scatta a line 329-331, ricalcolare `feeAmount = (netWithdraw * withdrawFee) / (10000 - withdrawFee)` (per mantenere il rapporto), o più semplicemente ridurre `feeAmount` proporzionalmente. Meglio ancora: revert su clamp (raccomandazione già in remediation sprint 0 di CORE-003) — così la fee non è mai divergente. Ref: CORE-003 (aspetto complementare).

---

## NEW-015
- Severity: MEDIUM
- Category: griefing
- File: contracts/Beacon.sol
- Line: 205-222 (`freezeModule`, `unfreezeModule`), 227-242 (globalFreeze)
- Title: `Beacon.getImplementation` reverta se il modulo è frozen (line 147) — un solo freeze rende inutilizzabile tutto il sistema
- Description: `Beacon.getImplementation(module)` fa `require(!globalFreeze && !moduleFrozen[module], "Module access frozen")`. Ogni chiamata a un modulo (letteralmente ogni funzione del sistema che risolve via Beacon) reverte se il modulo è frozen. Se l'owner freezza per errore un modulo critico (es. `TokenManager`, `ValueCalculator`, `ProxyGeneral`), l'intero sistema si blocca: deposit, withdraw, swap, protocol calls — tutti tentano di leggere il modulo tramite `IBeacon(beacon).getImplementation(...)`. Anche funzioni view che non hanno bisogno del modulo runtime finiscono per revertare (es. `LiquidityManager.getPoolStats` legge TokenManager). Non c'è meccanismo di "read-only bypass" o "circuit breaker locale che permette solo withdraw". Combined con CORE-057 (getImplementation reverta invece di ritornare 0), tutta la resilience si affida al fatto che l'owner NON freezzi accidentalmente.
- Failure scenario: Owner riceve alert su un potenziale bug nel `ValueCalculator` (es. errore oracolo che triggera loop cache). Owner esegue `freezeModule("ValueCalculator")` come precauzione. Da quel momento: `LiquidityManager.deposit` reverte a line 174 (`calculator.getTotalPoolValueView()` interno → `getImplementation("ValueCalculator")` revert). Anche `withdraw` reverte. Gli utenti non possono uscire dal pool. Se l'owner è in un fuso orario diverso o è indisponibile, si genera panico + potenziale run.
- Recommendation: (1) `getImplementation` dovrebbe avere una versione `getImplementationSafe(module)` che ritorna `address(0)` se frozen (non revert), permettendo ai caller di gestire il fallback graceful. (2) Introdurre un concetto di "freeze levels": `FREEZE_ADMIN` (solo funzioni admin bloccate), `FREEZE_WRITES` (write ma view OK), `FREEZE_ALL` (tutto). (3) Documentare che `freezeModule` è un'operazione ad alto rischio (bugbounty pattern).

---

## NEW-016
- Severity: MEDIUM
- Category: precision
- File: contracts/services/FlashLoanService.sol
- Line: 322-335 (`_estimateViaTokenManager`), 368-370
- Title: `estimateFromTokenManager` cross-rate ha rischio overflow con token high-decimals + prezzi grandi
- Description: `estimateFromTokenManager` formula: `(amountIn * priceIn * (10 ** decimalsOut)) / (priceOut * (10 ** decimalsIn))`. Per token da 18 decimali con importo massimo pratico (`type(uint128).max` ≈ 3.4e38), `amountIn * priceIn` può facilmente eccedere 2^256 se `priceIn` è già in WAD (1e18). Esempio: WETH balance 100 = 100e18 = 1e20. Prezzo WETH = 2000 USDC = 2e9 * 1e18 = 2e27 (se scaled in WAD). Prodotto = 1e20 * 2e27 = 2e47. Ancora sotto 2e77 → ok. Ma per un flash-loan da 1M ETH = 1e24, prodotto = 1e24 * 2e27 = 2e51, poi × 1e18 (decimalsOut) = 2e69. Ancora ok. Ma se il valore è WBTC valued in ETH terms con 18 decimali + big amount, si arriva vicini all'overflow. Solidity 0.8+ reverta su overflow → DoS di flash-loan calculation.
- Failure scenario: Un plugin invoca `_calculateFlashLoanAmount` con collateralAmount molto grande (edge case: whale user apre leverage 5× su 1000 ETH). Prodotto overflow → revert → `openLeverageAtomic` fallisce anche se sarebbe valida.
- Recommendation: Utilizzare `mulDiv` (FullMath da Uniswap V3 o OZ v5) per evitare intermediate overflow: `mulDiv(amountIn, priceIn * 10**decimalsOut, priceOut * 10**decimalsIn)`. Alternativamente, ridimensionare i prezzi prima della moltiplicazione se sono in scale > 18. Ref: ADP-013 (variante simile in EulerLensAdapter).

---

## NEW-017
- Severity: MEDIUM
- Category: precision
- File: contracts/adapters/ChainlinkAdapter.sol
- Line: 441 (`isFresh = block.timestamp - updatedAt <= config.heartbeat`)
- Title: `_getRawPrice` sottrae `block.timestamp - updatedAt` senza guard — underflow revert se il feed publica un timestamp futuro
- Description: `_getRawPrice` non usa un check `if (updatedAt > block.timestamp) return (0, updatedAt, false);` prima di `block.timestamp - updatedAt`. Solidity 0.8+ reverta su underflow per subtraction. Un feed Chainlink corrotto o compromesso (ha già succeduto in prod — v.d. FTT Chainlink freeze) può temporaneamente pubblicare un round con `updatedAt` nel futuro, oppure durante testnet forks / development scenarios. Il revert propaga da `_getRawPrice` → `getPrice` → `TokenManager.getTokenPrice` → `LiquidityManager.deposit/withdraw`, `ValueCalculator.getTotalPoolValue`, ogni interazione col pool. Nessuna funzione può eseguire.
- Failure scenario: Su Arbitrum, un fork/replay locale del testnet può avere `block.timestamp < Chainlink.updatedAt` per round in-flight. In test integration o simulation network, ogni chiamata `getPrice` reverta con "Panic 0x11". Anche se raro in prod, un revert underflow è più difficile da diagnosticare del corretto `revert OracleCallFailed("stale")`.
- Recommendation: `_getRawPrice` deve controllare `if (updatedAt > block.timestamp)` e ritornare `(uint256(rawPrice), updatedAt, false)` (invalid). Alternativa: `isFresh = updatedAt <= block.timestamp && (block.timestamp - updatedAt) <= config.heartbeat`. Ref: ADP-002 sicurezza oracolo (variante).

---

## NEW-018
- Severity: MEDIUM
- Category: access
- File: contracts/EmergencyHandler.sol
- Line: 291 (`emergencyWithdraw()`), 291-389
- Title: `emergencyWithdraw()` no-args ignora il `emergencyState.isActive` guard — owner può drenare il pool a se stesso senza pausare
- Description: `emergencyWithdraw()` (line 291, no args, senza `whenPaused`) può essere chiamata da `onlyOwner` in qualsiasi momento, anche se il sistema NON è in emergency. Confronto con `ProxyGeneral.emergencyTransferAll` (line 459) che richiede `whenPaused` e delega correttamente. Qui invece l'owner ha una "backdoor drain": chiamare `emergencyWithdraw()` senza pausare, tutti gli asset attivi vanno a `owner()`. Combined con CORE-015 (hardcode a owner) e CORE-001 (path spezzato attualmente), è un rug-pull vector nascosto: se un giorno CORE-001 viene fixato, `emergencyWithdraw()` diventa un one-click rug per l'owner, senza la trasparenza del pause preventivo.
- Failure scenario: Owner (compromesso o malicious) NON pausa. Chiama `emergencyWithdraw()`. Tutti gli asset tracked vanno a `owner()`. LP possono ancora vedere `paused == false`, `deposit`/`withdraw` sembrano funzionanti — ma il pool è vuoto → il prossimo withdraw reverta silenziosamente su `validation.totalValue = 0`. LP scoprono il rug solo quando provano a uscire.
- Recommendation: Aggiungere `require(emergencyState.isActive, "Emergency not active")` a `emergencyWithdraw()`. In alternativa, richiedere che `owner()` sia in un multisig con timelock separato per l'emergency withdraw path. Ref: CORE-015 (variante — rimozione del hardcode a owner + gate su pause).

---

## NEW-019
- Severity: MEDIUM
- Category: griefing
- File: contracts/EmergencyHandler.sol
- Line: 792-848 (`createAssetSnapshot`), 872-881 (`getAllSnapshots`)
- Title: `createAssetSnapshot` è chiamabile da chiunque + `getAllSnapshots` unbounded → DoS storage-cost
- Description: `createAssetSnapshot` non ha modifier di access control (né `onlyOwner`, né `onlyEmergencyAuthorized`). Ogni chiamata: (a) incrementa `snapshotCount`, (b) fa `snapshots[id] = snapshot` (nuova entry mapping storage — ~200k+ gas), (c) `snapshotIds.push(id)` (storage array). Un attaccante può spammare per riempire `snapshotIds` fino a rendere `getAllSnapshots` (line 872) unusable per DoS (bubble sort O(n) copia in memory-array, revert OOG oltre certe dimensioni). Peggio: `getAllSnapshots` non ha pagination, quindi qualsiasi consumer off-chain che chiami questo view function riceverà revert dopo qualche migliaio di snapshot spammati. Costo attacco: ~100k gas × N = 100 gwei * 100k = 0.01 ETH per 1000 snapshot su Arbitrum (< $0.20 per DoS del getAllSnapshots).
- Failure scenario: Attaccante spamma `createAssetSnapshot()` 10000 volte in un giorno. Storage inflate del contratto. `getAllSnapshots()` inizia a revertare OOG. Ogni dashboard/monitoring che legge tutti gli snapshot come fonte di audit trail smette di funzionare.
- Recommendation: (1) Aggiungere `onlyEmergencyAuthorized` a `createAssetSnapshot`. (2) Aggiungere pagination a `getAllSnapshots(start, count)`. (3) Bound su `snapshotCount` (es. auto-rotate: dopo 1000 snapshot cancellare le più vecchie). Ref: CORE-017/CORE-080 (parzialmente coperto ma qui l'attaccante può *aggiungere*, non solo leggere).

---

## NEW-020
- Severity: LOW
- Category: precision
- File: contracts/plugins/AaveV3Plugin.sol
- Line: 356-358 (`approveAmount = currentDebt + (currentDebt / 100)`)
- Title: `repay` approva 1% in eccesso per gestire interest accrual → residuo allowance non azzerato dopo il repay
- Description: `AaveV3Plugin.repay` (line 320-368) — quando `repayAmount == type(uint256).max`, calcola `approveAmount = currentDebt + (currentDebt / 100)` = debito + 1% per handle interest between block. Fa `safeIncreaseAllowance(aavePool, approveAmount)`. Aave `repay` consuma solo `actualRepaid` (il debito reale). Il buffer 1% resta come allowance dormant verso Aave Pool. Su repeated repay operations, l'allowance accumula (safeIncreaseAllowance somma, mai reset a 0). Nel tempo, il Pool ha un'allowance progressivamente maggiore su tutto il balance del plugin — se una compromise futura degli oracoli Aave (v.d. incident Fantom 2022) permettesse una `repay(bigAmount, ...)` malformed, il buffer aggiuntivo verrebbe consumato.
- Failure scenario: Plugin ha `IERC20(USDC).allowance(plugin, aavePool)` accumulato a 1000 USDC negli anni. Attaccante trova un bug nel Pool che permette allowance drain (path improbabile ma non zero). Perde 1000 USDC che non doveva approvare.
- Recommendation: Sostituire con `forceApprove(aavePool, needed)` (SafeERC20 OZ v5) o azzerare dopo il repay: `IERC20(token).approve(address(aavePool), 0);`. Rimuovere del tutto il buffer 1% (interest tra block non accade — la tx è atomica; interest tra call e call è un problema di partial-repay che va gestito diversamente).

---

## NEW-021
- Severity: LOW
- Category: griefing
- File: contracts/adapters/ChainlinkAdapter.sol
- Line: 292-300 (`setTargetDenomination`)
- Title: `setTargetDenomination` cambia semantica globale dei prezzi senza invalidare / ri-validare reference feeds
- Description: `setTargetDenomination(newDenomination)` cambia la stringa `targetDenomination` (usata come normalizzatore in `getPrice`). Dopo il cambio, tutti i `priceFeeds[tokenCode]` esistenti (denominati es. in "USD") vengono convertiti verso il nuovo target (es. "BTC") tramite `referenceFeeds["USD"]`. Ma `referenceFeeds["USD"]` è stato originariamente configurato con `denomination: targetDenomination` fissato al momento della registrazione (line 279). Dopo il cambio, `refConfig.denomination` NON è più coerente con il nuovo target. Peggio: `_getRawPrice(refConfig)` legge un feed che potrebbe non esistere on-chain per la nuova coppia (target/oldDenomination). Nessuna revert immediata — il change è persistente e ritorna prezzi malformed silenziosamente.
- Failure scenario: Sistema deployato con `targetDenomination = "ETH"`. Feeds: `USDC → USD`, `refFeed["USD"] = ETH/USD Chainlink`. Owner (per motivi arbitrari) cambia a `targetDenomination = "USD"`. `getPrice("USDC")` ora: `needsConversion = "USD" != "USD" = false`, ritorna raw `rawPrice` (in USD, 8 decimals) non normalizzato a 18 decimali. Tutte le calcolazioni `ValueCalculator` che assumono prezzi in 18 decimals rompono.
- Recommendation: `setTargetDenomination` deve essere blocked se `priceFeeds` o `referenceFeeds` sono configurati (require array empty), oppure deve ri-eseguire l'intera configurazione. In alternativa, rimuovere questa funzione (targetDenomination dovrebbe essere immutable, deciso in constructor).

---

## NEW-022
- Severity: LOW
- Category: griefing
- File: contracts/services/FlashLoanService.sol
- Line: 383-397 (`_isRegisteredPlugin`)
- Title: `_isRegisteredPlugin` è O(n) su tutti i moduli del Beacon per ogni flash loan / swap → gas cost degrada linearmente al numero di moduli
- Description: `_isRegisteredPlugin(plugin)` itera `beacon.getRegisteredModules()` (unbounded array, CORE-078) e per ogni modulo fa un `IBeacon.getImplementation(moduleName)` (già ~2k gas). Su N moduli: N × 3k gas = per 20 moduli sono 60k gas per verifica. Chiamata a ogni `executeFlashLoan` e a ogni `swap`. Se in futuro il Beacon accumula molti moduli, il costo cresce indefinitamente. La lettura di getImplementation reverta se il modulo è frozen (CORE-057) → l'`try` catcha ma il consumo di gas del revert è comunque significativo (~5k gas addizionale per frozen module).
- Failure scenario: Beacon con 50 moduli, 3 frozen. Ogni `FlashLoanService.executeFlashLoan` consuma ~180k gas SOLO per la verifica plugin. Su Arbitrum a 0.1 gwei = 0.018 ETH addizionale per swap → costo user amplificato.
- Recommendation: Sostituire l'iterazione con un mapping `mapping(address => bool) private _isPlugin` popolato via `Beacon.updateImplementation` (evento listener) o via una `registerPlugin` esplicita. La verifica diventa O(1). Ref: ADP-025/029 già parziali. In alternativa, cache il risultato per un plugin address (mapping[address] => uint256 blockNumber ↔ validità).

---

## NEW-023
- Severity: LOW
- Category: misc
- File: contracts/plugins/MorphoVaultPlugin.sol
- Line: 217-238 (`emergencyWithdrawAll`), 414-422 (`_redeemAllVaults`)
- Title: `emergencyWithdrawAll` fa `delete activeVaults` anche se `_redeemAllVaults` ha silenziosamente fallito su alcuni vault
- Description: `_redeemAllVaults` (line 414-421) itera `activeVaults` e per ciascuno fa `try v.redeem(shares, receiver, address(this)) {} catch {}` — swallowing di tutti i revert. Al termine di `emergencyWithdrawAll`, riga 236 fa `delete activeVaults;` incondizionalmente. Se un vault MetaMorpho era paused / drained / aveva un bug che faceva revert su `redeem`, le shares MetaMorpho di quel vault restano nel plugin (non redeemed) ma il tracking le "dimentica". Recovery futura impossibile via `emergencyWithdrawAll` (activeVaults è vuoto). L'unica via è `vaultRedeem(specificVault, shares)` manuale — richiede conoscenza dell'indirizzo del vault fuori dalla registry (che potrebbe averlo già rimosso).
- Failure scenario: Plugin ha shares su vault A (funzionante) e vault B (paused). `emergencyWithdrawAll(...)` chiama `_redeemAllVaults`: A redeem OK, B revert silenzioso. `delete activeVaults` cancella la memoria che il plugin aveva shares su B. B poi si sblocca 2 settimane dopo — nessun modo automatico di recuperare le shares, richiede intervento owner con `MorphoVaultPlugin.vaultRedeem(B, ...)` — ma B potrebbe essere già stato rimosso da `MorphoRegistry.removeVault` (perché supponevano fosse morto).
- Recommendation: `_redeemAllVaults` deve ritornare la lista dei vault dove il redeem È fallito, e `emergencyWithdrawAll` deve preservare quelli in `activeVaults`. Alternativamente, non fare mai `delete activeVaults` — fare rebuild dopo l'operazione basandosi su `IERC4626(v).balanceOf(address(this)) > 0`. Ref: PLG-040/41.

---

## NEW-024
- Severity: LOW
- Category: misc
- File: contracts/ProxyGeneral.sol
- Line: 244-283 (`withdrawToken`, `depositToken`), 320-336 (`_resolveTokenAddress`)
- Title: `depositToken` / `withdrawToken` risolvono base asset via Beacon ma non tengono cache — chiama `_resolveTokenAddress` a ogni chiamata
- Description: Ogni `withdrawToken` / `depositToken` chiama `_resolveTokenAddress(tokenCode)` che a sua volta risolve via Beacon (`getImplementation("TokenManager")` = ~2k gas + external call) e poi via `TokenManager.getTokenInfo` (~10k gas). Per ogni operazione, ~15k gas addizionale solo per resolution. Se il pool ha molti swap intra-block (es. auto-swap durante withdraw), il costo si accumula. Non è un bug ma un pattern di inefficienza — inoltre espone il sistema a inconsistency in caso di beacon frozen mid-operation (revert non deterministico).
- Failure scenario: Non attivamente sfruttabile, ma costo user finale amplificato.
- Recommendation: Cachare `baseAssetAddress` come immutable in `ProxyGeneral` (setted in constructor da `_beacon.getImplementation("BASE_ASSET")`), evitando resolution ripetute. Simile per `TokenManager` (se non si vuole supportarne l'upgrade in Beacon per il same-address).

---

## NEW-025
- Severity: LOW
- Category: misc
- File: contracts/plugins/UniswapV3PluginDirect.sol
- Line: 143-153 (`inputSwap`), 201-211 (`outputSwap`)
- Title: `deadline: block.timestamp` in Uniswap V3 exactInputSingle/exactOutputSingle è di fatto no-deadline
- Description: I parametri `deadline: block.timestamp` in Uniswap V3 vengono confrontati come `require(block.timestamp <= deadline)` internamente al Router. Con `deadline == block.timestamp`, il require è sempre "just barely valid" — l'attaccante può inserire una tx del plugin in QUALSIASI blocco futuro (via MEV bundle sniping o priorityfee spam) senza mai violare il deadline (perché `block.timestamp` è auto-referenziale). Il deadline è di fatto inefficace. È il classico pattern anti-MEV Uniswap che dovrebbe essere `block.timestamp + delta` (short delta) o preferibilmente propagato dal caller (SwapManager) che ha già una deadline consistente.
- Failure scenario: SwapManager chiama `plugin.inputSwap(...)` con l'intento di completare entro `SwapManager.deadline`. Ma se una tx del plugin viene ritardata via MEV, verrà comunque eseguita perché `deadline: block.timestamp` è tautologico. Amplifica MEV su swap. Combined con `amountOutMinimum: 0` (PLG-019) è drenaggio totale.
- Recommendation: (a) Modificare la firma `ISimpleSwap.inputSwap` per prendere anche `deadline` propagato dal caller. (b) Nel plugin, usare `deadline: params.deadline` invece di `block.timestamp`. In assenza di deadline propagato, usare `block.timestamp + 60` (1 minute) come minimo. Ref: PLG-019 (variante — MEV specifica del deadline oltre a minOut).

---

## NEW-026
- Severity: LOW
- Category: precision
- File: contracts/Liquiditymanager.sol
- Line: 279 (`validation.amount = (_shares * validation.totalValue) / validation.totalSupply`)
- Title: `withdraw` calcola `validation.amount` con round-down favorendo il pool — nessuna floor-vs-ceiling policy dichiarata; questa direzione è ok, ma manca il DUAL check sul `deposit`
- Description: In `withdraw`, `shares * totalValue / totalSupply` rounde down → utente riceve meno, pool tiene di più. Corretto per prevenire drenaggio. In `deposit`, `netDeposit * preDepositSupply / totalValue` rounde down → utente riceve meno shares, pool tiene di più. Anche corretto. MA: il `deposit` fa `require(shares > 0, "Deposit too small")` (line 179) — non c'è un `require(shares >= expectedShares - 1)` o simile. Questo apre a small precision loss al deposit che favorisce il pool oltre l'aspettativa. Combined con NEW-001 (share inflation), la vittima del sandwich riceve **meno** shares dell'attesa contabile e nessun rimborso.
- Failure scenario: Pool con totalSupply = 3, totalValue = 3e18. Vittima deposit 1e18. `shares = 1e18 * 3 / 3e18 = 1`. Ora se totalValue fosse 3e18 + 1 wei (attaccante donation), shares = `1e18 * 3 / (3e18 + 1) = 0.999... = 0`. Revert. OK, ma con donation 2e18, shares = `1e18 * 3 / 5e18 = 0`, revert. Per far scattare il roundmg loss shares = 1, l'attaccante deve tarare esattamente la donation. Su chain congestionate, l'attaccante scan mempool e ripete finché trova un target vulnerabile.
- Recommendation: Aggiungere `minLpTokensOut` parameter obbligatorio al deposit (Ref: NEW-002). Aggiungere anche un rebate se la round-down eccede una soglia (es. > 1% del expected), o floor a 1 wei quando `shares == 0` per prevenire deposit-lock. Ref: NEW-001 (complementare).

---

## NEW-027
- Severity: LOW
- Category: griefing
- File: contracts/DepositHelper.sol
- Line: 35-52 (`depositETH`)
- Title: `depositETH` fa `weth.deposit{value: msg.value}()` senza verificare che `weth` sia effettivamente WETH (cache immutable settato al construction)
- Description: `constructor(address _beacon)` legge `weth = IWETH(IBeacon(_beacon).getImplementation("BASE_ASSET"))` — se in quel momento BASE_ASSET NON è WETH, il DepositHelper è deployato con `weth` puntato a un ERC20 non-WETH. La chiamata a `weth.deposit{value: msg.value}()` in `depositETH` reverta (perché ERC20 standard non ha `deposit()` payable), ma se BASE_ASSET era stato inizialmente WETH e poi il Beacon ha cambiato via `updateImplementation("BASE_ASSET", ...)` a un altro token, il `DepositHelper.weth` immutable rimane puntato al vecchio WETH. Le operazioni di depositETH continuano a wrappare ETH → WETH old, e poi `LiquidityManager.deposit(msg.value)` reverte perché `IERC20(baseAsset).safeTransferFrom(msg.sender, ...)` prova a trasferire il NUOVO base asset (non WETH) dal msg.sender = DepositHelper — che non ne ha. Ref: CORE-063 già flagga il problema del cache immutable, ma qui l'impatto è che ETH deposit path si rompe completamente.
- Failure scenario: Beacon cambia BASE_ASSET da WETH a USDC (per motivi arbitrari — non è realistico per un pool ma il codice lo supporta). Ogni chiamata a `DepositHelper.depositETH{value: 1 ETH}()` → wrappa in WETH (immutable), poi `LiquidityManager.deposit(1e18)` → `safeTransferFrom(depositHelper, proxy, 1e18 USDC)` — DepositHelper non ha USDC → revert. Utente perde solo gas ma la funzione è unusable.
- Recommendation: Sostituire l'immutable con un lookup dinamico `weth = IWETH(IBeacon(beacon).getImplementation("BASE_ASSET"))` a ogni `depositETH`. Alternativamente, `require(address(weth) == IBeacon(beacon).getImplementation("BASE_ASSET"), "base asset changed")` prima del wrap. Ref: CORE-063 (variante focalizzata sull'impatto operativo).

---

## NEW-028
- Severity: LOW
- Category: misc
- File: contracts/ValueCalculator.sol
- Line: 214-289 (`getTotalPoolValue`), 261-270 (catch on failed token)
- Title: `getTotalPoolValue` silently zeroa il valore di un token se `calculateTokenValuePure` reverta → NAV understated senza segnalazione
- Description: All'interno del loop line 239-271, se `try this.calculateTokenValuePure(tokenCode)` fallisce (es. oracolo down, price too old, decimals mismatch), la catch line 261-270 setta `tokenValues[i+1].value = 0` e continua senza aggiornare il totale. Il NAV ritornato è quindi il vero NAV meno il valore del token silently-zeroed. Combined con NEW-001 (share inflation depende dal TVL misurato correttamente), un attaccante può DELIBERATELY fare un feed stall (via manipolazione DEX di un oracolo secondario) → NAV sceso silently → attaccante deposita a NAV sottostimato → riceve più shares del dovuto → poi il feed torna online → NAV torna al reale → attaccante withdraw con profit.
- Failure scenario: Pool WETH-based con LINK come token attivo (valore 10 WETH). Prezzo LINK/ETH via Chainlink. Attaccante manipola oracolo LINK (raro) o attende una staleness naturale (heartbeat non updato per outage temporaneo). `getTotalPoolValueView` skippa LINK → NAV ritornato 90 WETH (vero: 100 WETH). Attaccante deposita 10 WETH → shares = `10 * S / 90` invece di `10 * S / 100`. Diluizione ridotta → shares extra. Quando oracolo torna, attaccante withdraw con guadagno.
- Recommendation: Un token failure dovrebbe forzare il pool in "safe mode" (blocco deposit temporaneo, allow only withdraw). Alternativamente, revertare `getTotalPoolValueView` se qualsiasi token attivo fallisce — CORE-049 flagga già "zeroes silently" ma qui il concreto attack vector è documentato. Ref: CORE-049 (estende con attack scenario).

---

## NEW-029
- Severity: LOW
- Category: misc
- File: contracts/plugins/AaveV3Plugin.sol
- Line: 341-345 (`repay` all)
- Title: `repay` con amount=0 sentinel non documentato in NatSpec dell'interfaccia + gestione inconsistente vs Aave native `type(uint256).max`
- Description: Il plugin traduce `amount == 0` in `repayAmount = type(uint256).max` (Aave sentinel per "repay all"). Ma `ILendingProtocol.repay(tokenCode, amount)` (interfaccia comune) non documenta questo comportamento. `MorphoPlugin.repay` (line 379-441) usa una logica leggermente diversa: `if (amount == 0 || amount >= balance)` (line 417) usa shares mode per exact repay via `pos.borrowShares`. `EulerV2Plugin.repay` (line 434-435) fa `repayAmount = (amount == 0 || amount >= currentDebt) ? currentDebt : amount` — repay full via assets (non shares). Comportamenti divergenti tra plugin per lo stesso sentinel. Un caller `ProtocolManager.repay(..., 0)` non sa a priori se il repay sarà "exact debt as assets" o "shares-based repay" o Aave `max`.
- Failure scenario: Non exploitable direct ma confusing. In caso di full repay, Morpho attraverso shares evita dust, Euler / Aave via assets può lasciare dust. Automation off-chain che assume comportamento uniforme si comporta in modo divergente.
- Recommendation: Definire in `ILendingProtocol.repay(tokenCode, amount)` che `amount == 0` significa "repay full" e specificare che l'implementazione usa la strategia protocol-native (Aave `max`, Morpho shares, Euler assets). Aggiungere NatSpec `@custom:sentinel`. Ref: PLG-096.

---

## NEW-030
- Severity: LOW
- Category: precision
- File: contracts/Liquiditymanager.sol
- Line: 776-784 (`checkWithdrawLimits`)
- Title: `checkWithdrawLimits` daily loop legge un range di 24 hour buckets che potrebbe includere ore future se currentHour è calcolato dopo un timestamp fake
- Description: `currentHour = block.timestamp / 1 hours`. Loop `for (uint256 i = 0; i < 24; i++) { hour = currentHour - i; ... }` legge le ultime 24 ore. Nessun problema in mainnet. Ma se un miner (validator) manipola `block.timestamp` di ~15 minuti (limite consentito da consensus), l'utente può shiftare il window: se ha depositato 999 base asset alle 08:30 e vuole prelevare 999 alle 08:59, e il validator setta block.timestamp = 09:00 (fine hour), il currentHour cambia → il bucket del deposito precedente diventa "current-1" invece di "current-0" → daily accounting inconsistente. Combined con CORE-004 (accounting dead code), non è exploit attivo, ma diventa quando CORE-004 sarà fixed.
- Failure scenario: Non attualmente exploitable per via di CORE-004. Post-fix, un validator MEV searcher può manipolare timestamp per bypassare limits marginalmente.
- Recommendation: Usare `block.number`-based buckets invece di `block.timestamp / 1 hours`. In alternativa, usare finestre sliding con timestamp esplicito (calcolo cumulativo). Ref: CORE-004/024.

---

## NEW-031
- Severity: LOW
- Category: access
- File: contracts/SwapManager.sol
- Line: 1246-1258 (`setActiveSwapPlugin`)
- Title: `setActiveSwapPlugin` non richiede coerenza con l'interfaccia `ISimpleSwap` — solo `code.length > 0`
- Description: Owner può settare `activeSwapPlugin` a un plugin che ha bytecode ma NON implementa `ISimpleSwap.inputSwap`/`getExpectedOutput`. Ogni swap successivo reverta genericamente (selector not found → OOG in fallback) senza chiaro errore. Non è attivamente exploitabile perché onlyOwner, ma è un footgun per l'operatore.
- Recommendation: Aggiungere `ISimpleSwap(pluginAddr).getExpectedOutput(dummyToken, dummyToken, 1)` in try/catch per verificare che l'interfaccia sia implementata. In alternativa `IERC165.supportsInterface(type(ISimpleSwap).interfaceId)`.

---

## NEW-032
- Severity: LOW
- Category: misc
- File: contracts/ProxyGeneral.sol
- Line: 704-706 (`fallback`)
- Title: `fallback() external payable { revert(...); }` accetta ETH nel selector non trovato ma poi reverta → gas wasted
- Description: Il fallback è `payable`. Se un caller invia ETH con un selector inesistente, il fallback riceve l'ETH E POI reverta → l'ETH viene refunded. Ok. Ma il fatto che sia payable spreca gas nel setup del CALL — perché non `external { revert(); }` (non-payable)? La ragione è che con `receive()` presente, la fallback può essere non-payable — Solidity dispatcha `receive()` per plain-ETH-transfer e fallback per non-matching selector. Quindi rimuovere payable non fa danni. Minor issue.
- Recommendation: `fallback() external { revert("Function does not exist"); }` (non-payable). Ref: informational.

---

## Sommario

Totale nuovi finding: **32**.

- CRITICAL: 0
- HIGH: **8** (NEW-001 share inflation, NEW-002 sandwich deposit, NEW-003 NAV donation di token attivi, NEW-004 ProxyGeneral no nonReentrant, NEW-005 no migrate su beacon lookup, NEW-006 transferToModule wide surface, NEW-007 HF scale bug Morpho Lens, NEW-008 EVC main-vs-sub inconsistency ampliata)
- MEDIUM: **10** (NEW-009 MorphoRegistry defaultVault, NEW-010 emergencyExecuted flag, NEW-011 removeToken traps balance, NEW-012 updateProtocol no timelock, NEW-013 filtro plugin permissivo, NEW-014 withdraw fee mispricing on clamp, NEW-015 Beacon freeze DoS, NEW-016 FlashLoanService overflow, NEW-017 Chainlink underflow, NEW-018 emergencyWithdraw no pause, NEW-019 createAssetSnapshot public + unbounded)
- LOW: **13** (NEW-020 approve buffer dust, NEW-021 setTargetDenomination, NEW-022 O(n) plugin check, NEW-023 delete activeVaults, NEW-024 no cache resolution, NEW-025 deadline block.timestamp, NEW-026 deposit rounding, NEW-027 depositETH cached WETH, NEW-028 silent zero token, NEW-029 repay sentinel, NEW-030 timestamp manipulation, NEW-031 setActiveSwapPlugin no ISimpleSwap check, NEW-032 fallback payable)

## Priorità raccomandate

**Sprint 0** — deploy blockers:
- NEW-001, NEW-002, NEW-003 (share inflation trilogy) — richiede minimum-liquidity + minLpTokensOut + tracked balance.
- NEW-004 (ProxyGeneral nonReentrant) — aggiungere modifier a tutte le state-changing functions.
- NEW-005 (Beacon migrate) — documentare il pattern, considerare migration a UUPS o `migrateFrom` esplicito.

**Sprint 1** — high severity:
- NEW-006, NEW-007, NEW-008 (accesso e coerenza tra Morpho Lens/Plugin e Euler EVC).
- NEW-012 (updateProtocol timelock).
- NEW-009 (MorphoRegistry consistency).

**Sprint 2** — medium:
- NEW-010 through NEW-019.

**Sprint 3** — low:
- NEW-020 through NEW-032.
