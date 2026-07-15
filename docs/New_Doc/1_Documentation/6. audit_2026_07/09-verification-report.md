# Verification Report

Verifica caso-per-caso dei 25 finding HIGH del report `ISSUES.md`. Ogni voce è stata
controllata leggendo il codice reale nei percorsi indicati (esclusi `plugins/old/`,
`*.backup`, `EulerV2Plugin copy.sol.md`, `dolomite/`, `gmx/`).

## Summary

- CONFIRMED: 21
- FALSE POSITIVE: 1
- PARTIAL: 3

Legenda severity:
- HIGH = fondi a rischio / rottura funzionale sistemica
- MEDIUM = degrado significativo, ma bounded (owner-only, mock, etc.)
- LOW = drift documentale / hardening

## Per-finding

### CORE-004 — `checkWithdrawLimits` dead code
- **Status: CONFIRMED**
- **Evidence:**
  - `Liquiditymanager.sol:750-788` chiama `proxy.getHourlyWithdrawn(user, hour)` per validare hourly/daily limits.
  - `ProxyGeneral.sol:644` `setHourlyWithdrawn` e `ProxyGeneral.sol:665` `incrementHourlyWithdrawn` esistono ma la ricerca globale su `contracts/**/*.sol` non trova NESSUN caller (nessun modulo li invoca durante deposit/withdraw). `withdrawToken` in `ProxyGeneral.sol` non aggiorna `hourlyWithdrawnAmounts`.
  - Effetto: `hourlyWithdrawnAmounts` resta sempre 0, quindi `currentHourlyUsed + amount > withdrawLimits.hourlyLimit` è sempre falso finché `amount ≤ hourlyLimit`, e il ciclo `daily` non accumula nulla. Solo min/max per-tx sono in vigore.
- **Correct severity: HIGH** (limits pubblicizzati non sono enforced).

### CORE-005 — `updateMultipleParameters` bypassa il timelock
- **Status: CONFIRMED**
- **Evidence:** `ParameterManager.sol:313-338`. La funzione non legge mai `parameters[paramName].requiresTimelock`, e scrive `parameters[paramName].currentValue = newValue` in modo sincrono (linea 328). Il campo `requiresTimelock` (settato a `true` per `maxDeposit`, `maxWithdrawPerTx`, `withdrawLimitPerHour`, `maxSlippage`, `poolReserveRatio`) è quindi ignorato dal batch update, mentre `proposeParameterChange` (`ParameterManager.sol:478`) lo rispetta. Autorizzati con ruolo `authorizedUpdater` possono aggirare la governance.
- **Correct severity: HIGH**.

### CORE-007 — `executeParameterChange` sempre revert
- **Status: CONFIRMED**
- **Evidence:** `ParameterManager.sol:498-524`. Il guard è `if (param.proposedAt > 0 && block.timestamp >= param.effectiveAt && !param.isActive)`. `_registerParameter` (`ParameterManager.sol:150-159`) mette `isActive: true` per ogni parametro creato. Nessun code path setta `isActive = false` prima di execute — al contrario, linea 510 lo re-setta a true dopo l'esecuzione. Quindi il guard `!param.isActive` è sempre falso e la funzione cade sempre in `revert("No executable proposal found")` (linea 523). Il flusso `propose → execute` è completamente rotto.
- **Correct severity: HIGH**.

### CORE-008 — `pause()` chiamabile da qualsiasi modulo autorizzato
- **Status: CONFIRMED (PARTIAL sulla severity)**
- **Evidence:** `ProxyGeneral.sol:430` `pause() external onlyAuthorizedModule`; `ProxyGeneral.sol:115-121` la modifier accetta `authorizedModules[msg.sender] || msg.sender == owner()`. LiquidityManager / SwapManager / TokenManager / ProtocolManager / EmergencyHandler sono tutti moduli autorizzati; qualunque bug o compromissione in uno di essi può DoS-are l'intero sistema (deposit, withdraw, mint, burn, transferFunds sono tutti `whenNotPaused`).
- **Correct severity: MEDIUM.** Non è "chiunque" — occorre un modulo compromesso — quindi la voce è concettualmente giusta ma la severity dipende dal modello di trust dei moduli.

### CORE-009 — `ProtocolManager` senza `whenNotPaused`
- **Status: CONFIRMED**
- **Evidence:** `grep whenNotPaused|paused\(\)|isPaused` in `ProtocolManager.sol` → 0 match. `borrow`, `repay`, `withdrawCollateralFromProtocol`, `deposit`, `withdraw` etc. procedono anche a sistema pausato. In particolare `IProxyGeneral(proxyGeneral).withdrawToken(...)` a linea 234 e 348 fa uscire i fondi dal proxy: se `withdrawToken` nel proxy è a sua volta `whenNotPaused`, la chiamata revert (mitigazione parziale); ma le operazioni di stato/lettura o eventuali metodi che non lo sono restano vulnerabili. In ogni caso il pattern architetturale è assente.
- **Correct severity: HIGH**.

### CORE-012 — Approve `type(uint256).max` permanenti
- **Status: CONFIRMED**
- **Evidence:** `SwapManager.sol:566`, `SwapManager.sol:621`, `SwapManager.sol:679`. Approva `swapper` (implementazione ISimpleSwap risolta dal Beacon) per l'ammontare massimo su tutti i token che passano dal proxy. Se l'implementazione di ISimpleSwap viene sostituita (via Beacon) o compromessa, ha diritto di ritiro totale del wallet del proxy. Mitigazione: `if (currentAllowance < amountIn)` limita solo la frequenza dell'approve, non l'importo.
- **Correct severity: HIGH**.

### PLG-005 — Health Factor Morpho: formula & scaling
- **Status: CONFIRMED (bug reale)**
- **Evidence:** `MorphoPlugin.sol:1005-1009`.
  ```
  collateralValue = (pos.collateral * oraclePrice) / ORACLE_PRICE_SCALE;   // OK, come Morpho
  return (collateralValue * params.lltv) / (debtAssets * WAD);
  ```
  La formula Morpho corretta è `maxBorrow = collateralPriced * lltv / WAD` e `HF = maxBorrow / debtAssets`. Il codice divide DI NUOVO per `WAD`, quindi il risultato è `HF_reale / WAD`, cioè fuori scala rispetto alla convenzione WAD (1e18) usata da tutto il resto del progetto (`AaveV3Plugin.getHealthFactor()` ritorna WAD).
  Esempio numerico: HF reale = 1.5 (posizione sana) → return = `1.5e18 / 1e18 = 1` (intero). Qualsiasi caller che confronta con `1e18` interpreta come "unhealthy". HF reale = 0.5 → return = 0. Il commento in linea 1008 (`"lltv is already in WAD scale, so result is in WAD scale"`) è quindi errato.
  Stesso bug replicato in `MorphoLensAdapter.sol:171-178`.
- **Correct severity: HIGH** (auto-close / monitoring vengono innescati con scaling errato).

### PLG-006 — Sub-account XOR
- **Status: FALSE POSITIVE**
- **Evidence:** `EulerV2Plugin.sol:1288-1290`. `_deriveSubAccount(subAccountId) = address(uint160(address(this)) ^ uint160(subAccountId))`. Con `subAccountId=0` restituisce `address(this)`, che coincide con la definizione EVC: sub-account 0 = main account. `_getPositionAccount` a 1292-1305 prende il derivato solo se ha debito/collaterale, altrimenti torna a `address(this)`. È il comportamento canonico Euler V2. Nessun bug rilevato in questa formula.

### PLG-007 — `closePosition(uint256)` senza modifier
- **Status: CONFIRMED**
- **Evidence:** `EulerV2Plugin.sol:1373` la firma è `function closePosition(uint256 positionId) external override returns (uint256 baseAssetReturned)` — nessun modifier. Internamente chiama `this.closeLeverageAtomic(params)` (linea 1391) che ha `onlyOwnerOrLiquidityManager` (linea 843) — ma la modifier (linea 220-227) include esplicitamente `msg.sender == address(this)`, quindi la chiamata `this.` passa il controllo. Un chiamante esterno arbitrario può quindi forzare la chiusura di QUALSIASI posizione registrata (`getPosition(positionId)`), disintermediando owner/LM. I fondi finali finiscono su `msg.sender` di `closeLeverageAtomic` = `address(this)` (il plugin) — il chiamante non li ruba direttamente, ma può DoS/grief l'operazione, causare slippage massimo (`params.maxSlippageBps = 200` hardcoded) e destabilizzare il registry. Combinato con PLG-008 il rischio cresce.
- **Correct severity: HIGH**.

### PLG-008 / PLG-009 / PLG-010 — `closeLeverageAtomic` invia i fondi a `msg.sender`
- **Status: CONFIRMED**
- **Evidence:**
  - `AaveV3Plugin.sol:679-690` — `safeTransfer(msg.sender, collateralReturned)` e `safeTransfer(msg.sender, borrowExcess)`.
  - `MorphoPlugin.sol:791-800` — stesso pattern.
  - `EulerV2Plugin.sol:890-901` — stesso pattern.
  - `onlyOwnerOrLiquidityManager` accetta owner, LiquidityManager e `address(this)`. Se chiamato dall'owner via wallet EOA (uscita ordinaria) i fondi vanno all'EOA e NON al `ProxyGeneral` che aveva depositato il collaterale originale. Il codice non ha alcuna logica che restituisce i fondi al custode designato (ProxyGeneral). Se chiamato dal LiquidityManager (auto-close), i fondi vanno al LM, che poi deve rigirarli — non c'è un handshake che garantisca il transito. Se innescato da un terzo tramite `closePosition` (vedi PLG-007) `msg.sender` è il plugin stesso e i fondi restano sul plugin (destinati a essere spesi via `getBalance`), ma senza modifier chiunque può forzare la sequenza.
- **Correct severity: HIGH** (fund routing non corrisponde al modello custodial del ProxyGeneral).

### PLG-019 / PLG-020 / PLG-021 — Uniswap V3 direct plugin senza slippage on-chain
- **Status: CONFIRMED**
- **Evidence:**
  - `UniswapV3PluginDirect.sol:151` `amountOutMinimum: 0` in `exactInputSingle`.
  - `UniswapV3PluginDirect.sol:152, 210` `sqrtPriceLimitX96: 0` in entrambi input e output swap.
  - `UniswapV3PluginDirect.sol:272-295` `getExpectedOutput` legge `IUniswapV3Pool.slot0()` e usa `sqrtPriceX96` come prezzo spot, applicando un discount statico dell'85% (linea 301). `slot0` è manipolabile in singolo blocco.
  Il commento a linea 151 dice "Slippage controlled by SwapManager" e infatti `SwapManager._executeInputSwap` fa un check `execution.actualReceived >= validation.minAcceptableOutput` DOPO il swap (linea 578-581 di `SwapManager.sol`). Quindi la protezione esiste a livello superiore. Tuttavia:
  1. Se il plugin è chiamato direttamente (registrato come ISimpleSwap in altri percorsi — es. `FlashLoanService.swap` a `FlashLoanService.sol:269`), non c'è alcun controllo di slippage → PLG-019 valido in quel contesto.
  2. `sqrtPriceLimitX96=0` significa che il pool può swappare fino a esaurire tutta la liquidità della tick attuale → PLG-020 valido.
  3. `getExpectedOutput` da spot slot0 può essere manipolato per far accettare `minAcceptableOutput` gonfiati da SwapManager → PLG-021 valido.
- **Correct severity: HIGH** in produzione con FlashLoanService (il quale usa `getExpectedOutput` a fallback).

### PLG-045 — `onFlashLoanReceived` non valida `tokens[0] == borrowToken`
- **Status: CONFIRMED (PARTIAL sulla severity)**
- **Evidence:** in tutti e tre i callback (AaveV3Plugin.sol:704-721, EulerV2Plugin.sol:945-983, MorphoPlugin.sol:814-831) l'unico gate è `msg.sender != flashLoanService` + `_inFlashLoanCallback`. Il codice usa `address(tokens[0])` (es. AaveV3Plugin.sol:736) come `borrowToken` senza confrontarlo con `ctx.borrowTokenCode`. Poiché `FlashLoanService` è on-chain e trusted (registrato via Beacon), la superficie d'attacco è: (a) upgrade del FLS che passa `tokens[0]` diversi, (b) bug in FLS. Non è un exploit diretto ma la defensa-in-profondità manca.
- **Correct severity: MEDIUM** (dipende da trust del FLS; alzabile a HIGH solo se il FLS è upgradable senza timelock).

### PLG-049 — `AaveV3Plugin.getBorrowCapacity` unità sbagliata rispetto alla NatSpec
- **Status: CONFIRMED**
- **Evidence:** `AaveV3Plugin.sol:517-532` ritorna `availableBorrowsBase` da `aavePool.getUserAccountData(this)`. Per Aave V3, `getUserAccountData` ritorna tutti i valori "Base" espressi in USD con 8 decimali (base currency del PriceOracle Aave). `IAaveV3Plugin.sol:105` e `ILendingProtocol.sol:146,151` NatSpec dichiarano "in token units" / "500000000 (500 USDC)". Chi consuma il valore trattandolo come importo di token (`amount = getBorrowCapacity("USDC")`) borrower-a un valore proporzionato al prezzo USD *1e8 anziché a `USDC*1e6`, cioè circa 100× troppo o troppo poco a seconda del token.
- **Correct severity: HIGH** (calcoli di capacity e leverage sbagliati).

### PLG-056 — Indirizzo Morpho Blue Arbitrum
- **Status: PARTIAL (drift documentale, non runtime)**
- **Evidence:** `MorphoPlugin.sol:191-196` — l'indirizzo Morpho è iniettato via `constructor(address _morphoAddress)` e salvato in `immutable IMorpho morpho`. Nessun indirizzo hardcoded. Il commento `MorphoPlugin.sol:55-56` cita `0x6c247b1F6182318877311737BaC0844bAa518F5e` che corrisponde al deployment reale di Morpho Blue su Arbitrum One (Morpho Labs, tx nota). L'indirizzo `0xBBBBBb...` citato nel finding è il deployment su Ethereum mainnet — non è "la versione canonica" per Arbitrum. Quindi il finding parte da un confronto sbagliato; però è vero che il commento andrebbe uniformato con una nota "l'indirizzo effettivo è iniettato in deploy". Nessun bug runtime.
- **Correct severity: LOW** (informational / documentazione).

### PLG-057 — `nextSubAccountId > 255` è dead code su uint8
- **Status: CONFIRMED**
- **Evidence:** `EulerRegistry.sol:70` `uint8 private nextSubAccountId = 1;`. `EulerRegistry.sol:306` `if (nextSubAccountId > 255)` è tautologicamente falso (max di uint8 = 255). All'uso di 255 → `nextSubAccountId++` (linea 311) provoca Panic 0x11 (arithmetic overflow) sotto Solidity 0.8, quindi la registrazione dopo il 255° pair-slot revert con Panic anziché con la stringa `"EulerRegistry: max positions reached"`. Piccolo bug funzionale (messaggio errato) e limite sub-account potenzialmente più basso di quanto voluto se il codice si aspetta 256 slot.
- **Correct severity: MEDIUM** (non fund-loss; comportamento inatteso).

### ADP-001 — Manca Sequencer Uptime Feed
- **Status: CONFIRMED**
- **Evidence:** `ChainlinkAdapter.sol` importa solo `AggregatorV3Interface` e legge `latestRoundData()` sui feed (linee 156, 259, 427). Nessun riferimento a `SequencerUptimeFeed` / `L2 Sequencer Uptime`. Su Arbitrum la best practice Chainlink richiede di consultare `0xFdB631F5EE196F0ed6FAa767959853A9F217697D` (Arbitrum) prima di considerare valido un prezzo, per evitare stale reads dopo un downtime del sequencer. Assenza confermata.
- **Correct severity: HIGH** (Arbitrum-specific safety).

### ADP-007 — `getYieldInfo` usa `getReserveNormalizedIncome` come APY
- **Status: CONFIRMED**
- **Evidence:** `AaveV3LensAdapter.sol:387-396`. Chiama `aavePool.getReserveNormalizedIncome(underlying)` e `getReserveNormalizedVariableDebt`, che ritornano INDEX cumulativi ray-scaled (crescono monotonicamente dal 1e27 iniziale). Il codice fa `(index - 1e27) * 1e18 / 1e27` — questo restituisce il rendimento cumulato lifetime, non un tasso annualizzato. Per un mercato attivo da anni, l'"APY" reportato può essere 20-30% mentre il vero APY è 3-4%. Le funzioni corrette sarebbero `getReserveData(underlying).currentLiquidityRate` e `.currentVariableBorrowRate` (per-second rate ray, da moltiplicare per `SECONDS_PER_YEAR`).
- **Correct severity: HIGH** (guida decisioni di allocazione / rebalance).

### ADP-011 — HF Euler con LTV 80% hardcoded
- **Status: CONFIRMED**
- **Evidence:** `EulerLensAdapter.sol:183` `healthFactor = (totalCollateral * 80 * 1e18) / (totalDebt * 100);`. Gli EVault Euler V2 espongono `LTVBorrow(collateralVault)` per l'LTV di *quel* pair — variabile per vault. Hardcodare 80% ignora il vero LTV configurato dal vault admin. Sotto-stima o sovra-stima l'HF a seconda del vault, con conseguenze sul monitoring e auto-close. Simile hardcoding a `EulerLensAdapter.sol:165` (`requiredCollateral = (totalDebt * 10) / 8`).
- **Correct severity: HIGH**.

### ADP-027 — `FlashLoanService.swap` senza `minAmountOut`
- **Status: CONFIRMED**
- **Evidence:** `FlashLoanService.sol:243-284`. Firma: `function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256 amountOut)`. Nessun `minAmountOut`. La sola verifica è `amountOut == 0` (linea 271). Con un pool manipolato o un attacco sandwich, il caller riceve un output arbitrariamente basso. Tutti i callback flash loan (`_handleOpenLeverageCallback`, `_handleCloseLeverageCallback` nei 3 plugin) usano questa `swap()` senza slippage e poi in `_handleCloseLeverageCallback` fanno solo `if (borrowReceived < repayAmount) revert` → protegge da revert ma non da un'estrazione parziale (in `_handleOpenLeverageCallback` non c'è nemmeno quello: `if (collateralFromSwap == 0) revert;` è l'unica difesa, cioè >0 è ok).
- **Correct severity: HIGH**.

### ADP-030 — `FlashLoanService.getExpectedOutput` fallback 1:1
- **Status: CONFIRMED**
- **Evidence:** `FlashLoanService.sol:302-307` chiama `ISimpleSwap.getExpectedOutput`; nel `catch` va a `_estimateViaTokenManager`. Quest'ultima (`FlashLoanService.sol:322-335`) tenta `estimateFromTokenManager` e nel catch finale ritorna `(amountIn * 10**decimalsOut) / 10**decimalsIn` — cioè converte solo la scala dei decimali, ipotizzando 1:1 fra due asset qualsiasi. Se ISimpleSwap è down (Beacon non popolato o revert) e anche TokenManager fallisce, un caller che usa `getExpectedOutput` come reference per slippage ottiene un valore assurdo (es. 1 WETH → 3000 USDC in unità pure, ma il fallback ritorna 1e18 wei → 1e6 wei = 1 USDC dopo l'aggiustamento decimali). Se questo valore alimenta `minAmountOut` upstream, apre a MEV.
- **Correct severity: HIGH**.

### ADP-033 — `MockERC20.mint/burn` pubblici
- **Status: PARTIAL**
- **Evidence:** `MockERC20.sol:60-71`, entrambe `external` senza controllo. Chiunque può mintare o bruciare token di chiunque. Il file si chiama `MockERC20` e vive sotto `contracts/` (non `test/` o `mocks/`), quindi verrebbe compilato e potenzialmente deployato. `mocks/` esiste come cartella parallela ma il file è alla root di `contracts/`. Rischio reale SOLO se il contratto viene deployato in produzione o se un token di produzione lo eredita — cosa che non risulta.
- **Correct severity: LOW / MEDIUM** (con nota di deployment hygiene). Alzarla a HIGH è eccessivo per un mock non usato dai contratti di produzione. Suggerimento: spostare in `contracts/mocks/` e escluderlo dal deployment.

### ADP-039 — Morpho `toAssetsUp` senza VIRTUAL_ASSETS/SHARES
- **Status: CONFIRMED**
- **Evidence:** `MorphoPlugin.sol:998`, `MorphoLensAdapter.sol:150,171` usano
  ```
  (borrowShares * totalBorrowAssets + totalBorrowShares - 1) / totalBorrowShares
  ```
  La libreria ufficiale `SharesMathLib` di Morpho è
  ```
  toAssetsUp(shares, totalAssets, totalShares)
    = mulDivUp(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES)
  ```
  con `VIRTUAL_ASSETS = 1` e `VIRTUAL_SHARES = 1e6`. Le costanti virtuali evitano estrema imprecisione a shares molto piccole e allineano l'accounting a Morpho core. Nel POC l'approssimazione è "quasi giusta" ma differisce leggermente da quanto Morpho vede internamente per il `repay` a shares — se il codice usa il valore calcolato per approvare/preparare `assets`, può risultare in shares residue (dust) o piccoli under-repay.
- **Correct severity: MEDIUM** (correttezza contabile, non fund-loss diretto — Morpho ricalcola comunque).

### IFC-001 — `IProxyGeneral.emergencyTransfer(address,uint256,address)` non implementato
- **Status: CONFIRMED**
- **Evidence:** `IProxyGeneral.sol:293` dichiara `function emergencyTransfer(address token, uint256 amount, address to) external;`. In `ProxyGeneral.sol` grep `function emergencyTransfer` restituisce solo `emergencyTransferAll(address recipient)` a linea 459 — non c'è alcuna implementazione della firma dichiarata nell'interfaccia. `EmergencyHandler.sol:330, 363, 952` chiama `IProxyGeneral(proxy).emergencyTransfer(token, amount, to)` → selector non presente in ProxyGeneral → tutte queste chiamate revert (`try` a linea 330/363 le maschera dietro un log, ma il flusso emergency `emergencyTransfer(payable,uint256)` alla linea 952 lascia il fallo scoperto).
- **Correct severity: HIGH** (emergency response non funziona).

### IFC-004 — `ProtocolManager` casta plugin a `ILendingProtocol` (mono-token) ma MorphoPlugin è due-token
- **Status: CONFIRMED**
- **Evidence:**
  - `ILendingProtocol.sol:73` `function borrow(string tokenCode, uint256 amount) external returns (bool);`
  - `ILendingProtocol.sol:100` `function repay(string tokenCode, uint256 amount) external returns (bool);`
  - `ILendingProtocol.sol:117` `function getDebt(string tokenCode) external view returns (uint256);`
  - `ILendingProtocol.sol:138` `function getHealthFactor() external view returns (uint256);`
  - `MorphoPlugin.sol:340` `function borrow(string collateralCode, string loanCode, uint256 amount)`
  - `MorphoPlugin.sol:379` `function repay(string collateralCode, string loanCode, uint256 amount)`
  - `MorphoPlugin.sol:575` `function getDebt(string collateralCode, string loanCode)`
  - `MorphoPlugin.sol:614` `function getHealthFactor(string collateralCode, string loanCode)`
  - `ProtocolManager.sol:320` `ILendingProtocol(plugin).borrow(tokenCode, amount);`
  - `ProtocolManager.sol:351` `ILendingProtocol(plugin).repay(tokenCode, amount);`
  - `ProtocolManager.sol:402` `ILendingProtocol(plugin).getDebt(tokenCode);`
  - `ProtocolManager.sol:414` `ILendingProtocol(plugin).getHealthFactor();`

  I selector `borrow(string,uint256)` (0xa415bcad) e `borrow(string,string,uint256)` sono distinti. Quando ProtocolManager punta a `MorphoPlugin`, il selector dello staticcall non corrisponde a nessuna funzione del MorphoPlugin → revert. Nessuna registrazione di MorphoPlugin come `LENDING` sotto ProtocolManager può funzionare. Idem `getDebt` / `getHealthFactor`.
- **Correct severity: HIGH** (integrazione fondamentale rotta per Morpho tramite ProtocolManager).

### IFC-010 — `EulerLensAdapter.isCircuitBreakerActive` chiama un selector inesistente
- **Status: CONFIRMED**
- **Evidence:** `EulerLensAdapter.sol:34` (interfaccia locale) e `:882-892` (implementazione) chiamano `IEulerV2PluginView(plugin).isCircuitBreakerActive()`. Il plugin `EulerV2Plugin.sol:128` espone `bool public override circuitBreakerTripped;` — quindi il getter è `circuitBreakerTripped()` (selector 0x…), NON `isCircuitBreakerActive()`. La chiamata cade nel `catch` (linea 888) → return `true` sempre. Confronto con `AaveV3LensAdapter.sol:113-117` e `MorphoLensAdapter.sol:194-197`, che correttamente usano `abi.encodeWithSignature("circuitBreakerTripped()")`. Comportamento: EulerLensAdapter riporta sempre "circuit breaker attivo" → i moduli che lo consultano bloccano operazioni Euler come misura precauzionale. Falso positivo permanente.
- **Correct severity: HIGH** (funzionalità Euler resa inutilizzabile via lens).

## Recap tabellare

| ID | Status | Severity mantenuta |
|----|--------|---------------------|
| CORE-004 | CONFIRMED | HIGH |
| CORE-005 | CONFIRMED | HIGH |
| CORE-007 | CONFIRMED | HIGH |
| CORE-008 | CONFIRMED (PARTIAL sulla severity) | MEDIUM |
| CORE-009 | CONFIRMED | HIGH |
| CORE-012 | CONFIRMED | HIGH |
| PLG-005  | CONFIRMED | HIGH |
| PLG-006  | FALSE POSITIVE | — |
| PLG-007  | CONFIRMED | HIGH |
| PLG-008/09/10 | CONFIRMED | HIGH |
| PLG-019/20/21 | CONFIRMED | HIGH |
| PLG-045  | CONFIRMED (PARTIAL) | MEDIUM |
| PLG-049  | CONFIRMED | HIGH |
| PLG-056  | PARTIAL | LOW |
| PLG-057  | CONFIRMED | MEDIUM |
| ADP-001  | CONFIRMED | HIGH |
| ADP-007  | CONFIRMED | HIGH |
| ADP-011  | CONFIRMED | HIGH |
| ADP-027  | CONFIRMED | HIGH |
| ADP-030  | CONFIRMED | HIGH |
| ADP-033  | PARTIAL | LOW/MEDIUM |
| ADP-039  | CONFIRMED | MEDIUM |
| IFC-001  | CONFIRMED | HIGH |
| IFC-004  | CONFIRMED | HIGH |
| IFC-010  | CONFIRMED | HIGH |
