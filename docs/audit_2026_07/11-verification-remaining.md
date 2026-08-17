# Verification Remaining Report — S1.4 (fase 2)

Verifica caso-per-caso di **tutti i CRITICAL e HIGH del registro NON già verificati in
`09-verification-report.md`**. La lettura del codice è avvenuta sul commit
`786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89` (branch `dev-26`), con `contracts/**`
identico allo snapshot InterVault `7f0dc690` (documento `security/scope/audit-snapshot.md`).

## Perimetro

- **CRITICAL non verificati:** nessuno (tutti i CRITICAL originali erano già in `09`).
- **HIGH non verificati (57 finding):** elenco confrontato tra §HIGH di `ISSUES.md`
  e il recap di `09-verification-report.md`. Sono inclusi anche i finding NEW-001…NEW-008
  aggiunti nella second pass e classificati HIGH.

Legenda severity: HIGH = fondi a rischio / rottura funzionale sistemica;
MEDIUM = degrado bounded; LOW = drift documentale / hardening.

## Summary

- CONFIRMED: **53**
- PARTIAL / severity da rivedere: **4** (PLG-001, PLG-013, PLG-014, PLG-015)
- FALSE POSITIVE: **0**
- STALE: **0**
- NON VERIFICATI: **0**

**Nessun finding NON è stato verificato**; tutti i 57 HIGH remaining sono stati letti
direttamente nel codice sorgente.

## Note di metodo

- Nessun contratto in `contracts/**` è stato modificato dal 2026-07-15 10:52 (commit
  `7f0dc690`) fino a HEAD; nessun path del registro risulta STALE.
- Verifica statica basata su `grep`/read; nessun PoC eseguito. Le mitigazioni citate
  (es. check post-swap flash loan sul repay) non estendono la protezione all'utente
  finale — ciò è dichiarato esplicitamente per ogni finding.

---

## Per-finding

### CORE-006 — `cancelParameterProposal` ignora `proposalId`
- **Status: CONFIRMED**
- **Evidence:** `ParameterManager.sol:530-545`. Il parametro `proposalId` è dichiarato ma
  MAI utilizzato nel corpo: il loop itera su tutti i `parameterNames` e cancella la prima
  proposta con `param.proposedAt > 0` (linee 536-543). Owner che intende cancellare una
  proposta specifica cancella la prima trovata, non quella richiesta.
- **Correct severity: HIGH** (governance/emergency operativa non affidabile).

### CORE-010 — `emergencyTransferAll` sweepa solo base + ETH
- **Status: CONFIRMED**
- **Evidence:** `ProxyGeneral.sol:459-482`. Trasferisce solo `IBeacon(beacon).getImplementation("BASE_ASSET")`
  (linee 463-469) e `address(this).balance` (linee 472-476). Nessuna iterazione su
  `TokenManager.getActiveTokens()` per sweeping ERC20 tracciati (WBTC, USDC, tokens
  registrati). I fondi ERC20 non-base restano bloccati sul contratto in emergenza.
- **Correct severity: HIGH** (emergency response incompleta).

### CORE-011 — Quote spot-price manipolabili in `swapWithBestPlugin`
- **Status: CONFIRMED**
- **Evidence:**
  - `SwapManager.sol:459` `swapWithBestPlugin` chiama `getAllQuotes(...)` che a sua volta
    interroga `plugin.getExpectedOutput()` su ciascun plugin.
  - Per `UniswapV3PluginDirect` (`plugins/UniswapV3PluginDirect.sol:272-306`) il calcolo
    è derivato da `IUniswapV3Pool(pool).slot0()` → `sqrtPriceX96` (spot).
  - Il `bestQuote` selezionato (linee 462-473) viene confrontato solo con `minAmountOut`
    passato dal caller (linea 474). NON viene ri-verificato `actualReceived >= minAmountOut`
    dopo lo swap (`amountOut = bestPlugin.inputSwap(...)` linea 490, senza controllo).
  - Anche `_validateSwapParameters` (linea 1087) usa lo stesso `swapper.getExpectedOutput`
    come reference per `minAcceptableOutput`, ereditando la manipolabilità.
- **Correct severity: HIGH** (MEV totale su swap orchestrati dal LiquidityManager).

### PLG-001 — `AaveV3Plugin.repay` allowance insufficiente su repayAmount=max
- **Status: PARTIAL**
- **Evidence:** `AaveV3Plugin.sol:340-377`.
  - Linea 365 approva `currentDebt + (currentDebt / 100)` (buffer 1%) quando repayAmount
    è `type(uint256).max`.
  - Linea 366 clampa `approveAmount` a `balance` disponibile.
  - Il caso "debito cresce prima della `repay`" richiede accrue di interesse **intra-tx**;
    Aave V3 accrue-a on-write, non intra-tx, quindi il pattern è largely resiliente
    quando balance ≥ currentDebt+1%. Il rischio residuo esiste se balance = currentDebt
    esatto e Aave incrementa debt (via `_updateInterestRates` interno) più di 0 wei tra
    check e call.
- **Correct severity: MEDIUM** (edge case, non fund-loss diretto).

### PLG-004 — AaveV3Plugin `_handleOpenLeverageCallback` swap senza minOut
- **Status: CONFIRMED**
- **Evidence:** `AaveV3Plugin.sol:749-754`. `IFlashLoanService(flashLoanService).swap(borrowToken, collateralToken, flashLoanAmount)`
  senza `minOut`. Unico check: `if (collateralFromSwap == 0) revert SwapFailed();` (L754).
  Un sandwich fa scendere `collateralFromSwap` fino a un valore >0 ma arbitrariamente
  basso; il flusso prosegue con `pool.supply(totalCollateral)` sottodimensionato → HF
  check finale (L629-632) può ancora passare se attaccante calibra bene.
- **Reachable by:** owner (unica funzione autorizzata a `openLeverageAtomic`), quindi
  richiede owner-signer come actor. Comunque un actor non-fidato in pool MEV può
  sandwichare il tx pubblico.
- **Correct severity: HIGH**.

### PLG-011 — EulerV2Plugin `_handleOpenLeverageCallback` swap senza minOut
- **Status: CONFIRMED**
- **Evidence:** `EulerV2Plugin.sol:986-990`. `IFlashLoanService(flashLoanService).swap(borrowToken, collateralToken, flashLoanAmount)`
  senza `minOut`. Check `if (collateralFromSwap == 0) revert SwapFailed();` (L992). Stesso
  pattern di PLG-004.
- **Correct severity: HIGH**.

### PLG-012 — MorphoPlugin `_handleOpenLeverageCallback` swap senza minOut
- **Status: CONFIRMED**
- **Evidence:** `MorphoPlugin.sol:847-849`. `IFlashLoanServiceMorpho(flashLoanService).swap(...)`
  senza `minOut`. Check `if (collateralFromSwap == 0) revert SwapFailed();` (L850).
- **Correct severity: HIGH**.

### PLG-013 — EulerV2Plugin `_handleCloseLeverageCallback` swap senza minOut
- **Status: PARTIAL**
- **Evidence:** `EulerV2Plugin.sol:1104-1108` chiama swap senza `minOut` ma L1110-1112
  verifica `if (usdcReceived < repayAmount) revert SlippageExceeded(...)` e L1117-1119
  ricontrolla `usdcBalance < repayAmount`. Il check protegge SOLO che il flash loan
  possa essere ripagato, non l'utente. Un attaccante può sandwichare per ridurre
  `usdcReceived` a esattamente `repayAmount` (o poco più), massimizzando l'estrazione
  dal collaterale residuo destinato all'utente. `maxSlippageBps` presente in ctx ma
  MAI enforced qui (variante di PLG-032).
- **Correct severity: HIGH** — la mitigazione parziale non copre l'estrazione dal residuo.

### PLG-014 — MorphoPlugin `_handleCloseLeverageCallback` swap senza minOut
- **Status: PARTIAL**
- **Evidence:** `MorphoPlugin.sol:896-902`. Stessa struttura di PLG-013: check
  `if (borrowReceived < repayAmount) revert SlippageExceeded(...)` (L900-902) protegge
  solo il repay del flash loan, non l'utente. `ctx.maxSlippageBps` presente ma non
  enforced (variante di PLG-030).
- **Correct severity: HIGH**.

### PLG-015 — AaveV3Plugin `_handleCloseLeverageCallback` swap senza minOut
- **Status: PARTIAL**
- **Evidence:** `AaveV3Plugin.sol:797-799`. `swap(collateralToken, borrowToken, collateralBalance)`
  senza `minOut`. L801-803 check `borrowReceived < repayAmount → revert`. `maxSlippageBps`
  in ctx non enforced (variante di PLG-031).
- **Correct severity: HIGH**.

### PLG-016 — AaveV3Plugin `_calculateFlashLoanAmount` usa spot `getExpectedOutput`
- **Status: CONFIRMED**
- **Evidence:** `AaveV3Plugin.sol:827-838`. `IFlashLoanService(flashLoanService).getExpectedOutput(collateralToken, borrowToken, collateralAmount)`
  restituisce il valore spot (`FlashLoanService.getExpectedOutput` → `ISimpleSwap.getExpectedOutput`
  → `UniswapV3PluginDirect` slot0 spot). L'attaccante può gonfiare/deflazionare per
  spingere l'utente a un `flashLoanAmount` fuori target, quindi HF finale fuori range o
  leverage effettivo diverso da quello richiesto.
- **Correct severity: HIGH**.

### PLG-017 — EulerV2Plugin `_calculateFlashLoanAmount` spot
- **Status: CONFIRMED**
- **Evidence:** `EulerV2Plugin.sol:1326-1343`. Identico pattern di PLG-016.
- **Correct severity: HIGH**.

### PLG-018 — MorphoPlugin `_calculateFlashLoanAmount` spot
- **Status: CONFIRMED**
- **Evidence:** `MorphoPlugin.sol:1043-1054`. Identico pattern.
- **Correct severity: HIGH**.

### PLG-022 — UniswapV3PluginDirect fee tier hardcoded 3000
- **Status: CONFIRMED**
- **Evidence:** `UniswapV3PluginDirect.sol:35` `uint24 public constant DEFAULT_FEE = 3000;`
  usato in `exactInputSingle.fee` (L147), `exactOutputSingle.fee` (L205),
  `_getPoolAddress(..., DEFAULT_FEE)` (L266, 315-332). Nessuna funzione per
  cambiare fee tier o multi-hop. Pool 500/10000 (0.05% / 1%) non raggiungibili.
- **Correct severity: HIGH** (pool con maggiore liquidità per certe coppie sono su fee
  diverse; costringere 3000 impatta il price impact reale).

### PLG-023 — UniswapV3PluginDirect approve/transferFrom raw
- **Status: CONFIRMED**
- **Evidence:** `UniswapV3PluginDirect.sol:132`, `138`, `159`, `190`, `196`, `217`, `225`
  usano `IERC20.transferFrom / approve / transfer` senza SafeERC20. USDT su Arbitrum
  ritorna void per `approve` legacy → SafeERC20 sarebbe necessario. Attualmente USDT
  arbitrum ha una implementazione EIP-20 che dovrebbe funzionare, ma il pattern è
  fragile per token non-standard.
- **Correct severity: HIGH** (compat non garantita con token maggiori).

### PLG-025 — UniswapV3PluginDirect nessun ReentrancyGuard
- **Status: CONFIRMED**
- **Evidence:** `UniswapV3PluginDirect.sol:21` `contract UniswapV3PluginDirect is ISwapPlugin`
  — nessuna eredità da `ReentrancyGuard`. `inputSwap` (L117) e `outputSwap` (L175) fanno
  `transferFrom(proxyGeneral, ...)` → `approve router` → `uniswap swap` → `transfer(proxyGeneral, ...)`.
  Un token con hook di trasferimento (ERC777, ERC1363, tokens `_beforeTokenTransfer` custom)
  può reentrant re-invocare `inputSwap`/`outputSwap`. Reachable solo se un token con hook
  è collegato via SwapManager → improbabile in Arbitrum canonical set.
- **Correct severity: HIGH** (potenziale ma reachable solo con token esotici).

### PLG-028 — MorphoPlugin `repay` approva balance intero
- **Status: CONFIRMED**
- **Evidence:** `MorphoPlugin.sol:410-434`. L413: `IERC20(params.loanToken).safeIncreaseAllowance(address(morpho), balance)`
  approva l'INTERO balance del plugin, non solo `repayAmount` (`amount` o shares).
  Se balance > debt, resta allowance residua verso Morpho. In `try/catch` non pulisce
  l'allowance dopo la `repay`. Attaccante che compromette Morpho (o via governance
  Morpho) può drenare il residuo.
- **Correct severity: HIGH** (least-privilege violato per pool esterno).

### PLG-029 — MorphoPlugin `closeMarketPosition` idem
- **Status: CONFIRMED**
- **Evidence:** `MorphoPlugin.sol:467-471`. `safeIncreaseAllowance(address(morpho), balance)`
  con l'intero balance. Stesso pattern di PLG-028.
- **Correct severity: HIGH**.

### PLG-030 — MorphoPlugin `maxSlippageBps` mai enforced
- **Status: CONFIRMED**
- **Evidence:** `MorphoPlugin.sol:768-775` popola `ctx.maxSlippageBps` dal parametro
  utente. `_handleCloseLeverageCallback` (L866-906) usa `flashLoanAmount + feeAmount` come
  soglia (`repayAmount` L893) e mai `ctx.maxSlippageBps`. Il campo è **write-only**:
  scritto in `_flashLoanContext`, mai letto per una condizione di revert.
- **Correct severity: HIGH**.

### PLG-031 — AaveV3Plugin `maxSlippageBps` mai enforced
- **Status: CONFIRMED**
- **Evidence:** `AaveV3Plugin.sol:672` popola `ctx.maxSlippageBps`. `_handleCloseLeverageCallback`
  (L774-807) usa `flashLoanAmount + feeAmount` come `repayAmount` (L794) e non applica
  `ctx.maxSlippageBps` in nessun condizionale.
- **Correct severity: HIGH**.

### PLG-032 — EulerV2Plugin `maxSlippageBps` mai enforced
- **Status: CONFIRMED**
- **Evidence:** `EulerV2Plugin.sol:863` popola `ctx.maxSlippageBps` (default 100 = 1%).
  `_handleCloseLeverageCallback` (L1038-1121) non lo usa in alcun conditional.
- **Correct severity: HIGH**.

### PLG-033 — AaveV3Plugin `openLeverageAtomic` no `minCollateralAfterSwap`
- **Status: CONFIRMED**
- **Evidence:** `AaveV3Plugin.sol:103-110` `OpenLeverageAtomicParams` ha `collateralToken`,
  `borrowToken`, `collateralAmount`, `targetLeverageX100`, `minHealthFactor`, `deadline`.
  Nessun campo `minCollateralAfterSwap` o `minTotalCollateral`. L'unico check post-flash-loan
  è HF (L629-632), che può essere raggiunto anche con collaterale netto sottodimensionato.
- **Correct severity: HIGH**.

### PLG-034 — EulerV2Plugin idem
- **Status: CONFIRMED**
- **Evidence:** `EulerV2Plugin.sol:685-692` struct identica per campi rilevanti.
  `openLeverageAtomic` (L713-814) non impone bound su collaterale finale oltre HF.
- **Correct severity: HIGH**.

### PLG-035 — MorphoPlugin idem
- **Status: CONFIRMED**
- **Evidence:** `MorphoPlugin.sol:111-118` struct. `openLeverageAtomic` (L662-735) non
  impone bound su collaterale finale oltre HF.
- **Correct severity: HIGH**.

### PLG-036 — EulerV2Plugin `getHealthFactor` usa solo `controllers[0]`
- **Status: CONFIRMED**
- **Evidence:** `EulerV2Plugin.sol:597-632`. L604 `address[] memory controllers = evc.getControllers(address(this));`
  L613 `address controllerVault = controllers[0];` — hardcode del primo controller.
  Se il plugin è controller-abilitato su >1 vault (es. multi-borrow via Euler EVC),
  l'HF ritornato è parziale, non aggregato. `_computeMarketHF` per market non esiste
  come aggregato in EulerV2Plugin.
- **Correct severity: HIGH**.

### PLG-037 — EulerV2Plugin HF maschera fail con `type(uint256).max`
- **Status: CONFIRMED**
- **Evidence:** `EulerV2Plugin.sol:621-624`. `if (liquidity.queryFailure) return type(uint256).max;`
  Fallback pericoloso: monitoring/auto-close leggono `HF ≥ MIN` e non innescano risposta,
  mentre in realtà lo stato è ignoto. Il comportamento sicuro sarebbe revert o ritorno
  di 0 (worst-case).
- **Correct severity: HIGH**.

### PLG-038 — EulerV2Plugin `emergencyWithdrawAll` senza try/catch
- **Status: CONFIRMED**
- **Evidence:** `EulerV2Plugin.sol:656-678`. Il loop L665-675 fa `IEVault(vault).redeem(shares, proxyGeneral, address(this))`
  senza try/catch. Un vault con circuit breaker o pausa fa revert dell'intera call,
  bloccando la sweep degli altri vault.
- **Correct severity: HIGH**.

### PLG-039 — AaveV3Plugin `emergencyWithdrawAll` senza try/catch
- **Status: CONFIRMED**
- **Evidence:** `AaveV3Plugin.sol:845-867`. Loop L854-864 chiama `aavePool.withdraw(token, type(uint256).max, proxyGeneral)`
  senza try/catch. Prima withdraw fallita blocca l'intera funzione.
- **Correct severity: HIGH**.

### PLG-040 — MorphoPlugin `emergencyWithdrawAll` try/catch silenzioso
- **Status: CONFIRMED**
- **Evidence:** `MorphoPlugin.sol:913-959`. L935 `try morpho.repay(...) {} catch {}` e
  L942-944 `try morpho.withdrawCollateral(...) { emit } catch {}` — silenzioso: nessun
  evento di fallimento, nessun revert. La funzione ritorna `true` (L958) anche se tutte
  le operazioni hanno fallito. Il chiamante non sa distinguere successo da fallimento
  totale.
- **Correct severity: HIGH** (falsa sicurezza in emergenza).

### PLG-041 — MorphoVaultPlugin idem
- **Status: CONFIRMED**
- **Evidence:** `MorphoVaultPlugin.sol:217-238` e `_redeemAllVaults` (L423-438).
  L432 `try v.redeem(shares, receiver, address(this)) {} catch {}` — silent. L236
  `delete activeVaults;` cancella il tracking anche se qualche redeem è fallito. Il
  chiamante riceve `true` (L237) e perde la lista dei vault ancora attivi.
- **Correct severity: HIGH**.

### PLG-042 — AaveV3Plugin `MIN_HEALTH_FACTOR = 1.05e18`
- **Status: CONFIRMED**
- **Evidence:** `AaveV3Plugin.sol:74`. `uint256 public constant MIN_HEALTH_FACTOR = 1.05e18;`
  — costante compilata, non configurabile. 5% di buffer sotto liquidazione è troppo
  basso per volatilità intraday (BTC ha già mosso >5% in un giorno). Standard prudenti
  DeFi sono 1.20-1.50.
- **Correct severity: HIGH**.

### PLG-043 — EulerV2Plugin idem
- **Status: CONFIRMED**
- **Evidence:** `EulerV2Plugin.sol:118` `uint256 public constant MIN_HEALTH_FACTOR = 1.05e18;`
- **Correct severity: HIGH**.

### PLG-044 — MorphoPlugin idem
- **Status: CONFIRMED**
- **Evidence:** `MorphoPlugin.sol:82` `uint256 public constant MIN_HEALTH_FACTOR = 1.05e18;`
- **Correct severity: HIGH**.

### PLG-046 — Flash loan callback no `nonReentrant`
- **Status: CONFIRMED**
- **Evidence:** `onFlashLoanReceived` in `AaveV3Plugin.sol:713-730`, `MorphoPlugin.sol:814-831`,
  `EulerV2Plugin.sol:945-966`. Nessuno ha modifier `nonReentrant`. Guard esiste come flag
  `_inFlashLoanCallback` boolean (linea 88 AaveV3, 96 Morpho, 134 EulerV2) — ma è settato
  a `true` dal plugin **prima** di chiamare `executeFlashLoan`, poi la callback verifica
  che sia `true`, quindi permette una singola callback ma non protegge da nested
  reentrancy (attaccante che rientra in `openLeverageAtomic` durante callback).
  Combinato con `_flashLoanContext` shared, la reentrancy può corrompere lo stato
  passando da OPEN a CLOSE su stesso storage.
- **Correct severity: HIGH**.

### PLG-047 — EulerV2Plugin `addCollateralToPosition` approve via `evc.call`
- **Status: CONFIRMED**
- **Evidence:** `EulerV2Plugin.sol:1149-1158`. Ramo `else` (positionAccount != address(this)):
  ```
  IERC20(collateralToken).safeTransfer(positionAccount, amount);
  evc.call(collateralToken, positionAccount, 0, abi.encodeCall(
      IERC20.approve, (pos.collateralVault, amount)
  ));
  ```
  `evc.call(target, onBehalfOfAccount, ...)` esegue il call su `target` con `msg.sender = address(evc)`
  (l'EVC forwarda; `onBehalfOfAccount` è metadata semantica, non sostituisce `msg.sender`
  visto dal token). Quindi la `approve` risulta come `EVC.approve(vault, amount)` invece
  che `positionAccount.approve(vault, amount)`. Il vault non potrà pull-are da
  positionAccount → deposit successivo (L1160-1164) fallisce.
- **Correct severity: HIGH** (funzione `addCollateralToPosition` è rotta per sub-account
  diverso da address(this)).

### PLG-048 — EulerV2Plugin `closePositionsForBaseAsset` silent try/catch
- **Status: CONFIRMED**
- **Evidence:** `EulerV2Plugin.sol:1418-1445`. L1427-1441 wrappa
  `this.closeLeverageAtomic(...)` in `try { ... } catch { // Continue on failure }`.
  Nessun evento, nessun log del fallimento. In emergency il caller (LiquidityManager
  auto-close) crede che positions siano state chiuse quando sono state solo skippate.
- **Correct severity: HIGH** (auto-close può fallire in modo invisibile).

### ADP-002 — ChainlinkAdapter no min/maxAnswer bounds
- **Status: CONFIRMED**
- **Evidence:** `ChainlinkAdapter.sol:427-452`. Legge `feed.latestRoundData()` e valida
  `priceValid`, `roundComplete`, `notStale`, `isFresh`. Nessuna lettura di
  `AggregatorV3Interface.aggregator().minAnswer()` / `maxAnswer()` e nessuna
  comparazione. Un attacco Luna-style (prezzo clampato al bound minimo del feed)
  non è rilevabile.
- **Correct severity: HIGH** (validazione oracle incompleta — MEDIUM in altri audit
  ma HIGH nel contesto di leverage/liquidazione).

### ADP-012 — EulerLensAdapter doppio conteggio in `_calculateTotalValues`
- **Status: CONFIRMED**
- **Evidence:** `EulerLensAdapter.sol:643-693`.
  - L660-680: loop su `getAllRegisteredTokens()` che accumula `plugin.getBalance(tokenCode)`
    e `plugin.getDebt(tokenCode)` come totalCollateral/totalDebt.
  - L683-685: chiama `_calculateLeverageValues()` che aggiunge `leverageCollateral` e
    `leverageDebt` dalle leverage positions.
  - Le leverage positions occupano vault Euler → `plugin.getBalance(vault_token)` le
    include già. Somma successiva raddoppia i valori.
- **Correct severity: HIGH** (NAV Euler sovrastimato, decisioni di rebalance errate).

### IFC-002 — `EmergencyTransferExecuted` event drift
- **Status: CONFIRMED**
- **Evidence:**
  - `IProxyGeneral.sol:325` `event EmergencyTransferExecuted(address token, uint256 amount, address indexed to);` — 3 args.
  - `ProxyGeneral.sol:91` `event EmergencyTransferExecuted(address indexed recipient, uint256 timestamp);` — 2 args, tipi diversi.
  - `IEmergencyHandler.sol:221` `event EmergencyTransferExecuted(address indexed recipient, uint256 amount);` — 2 args, coerente con EmergencyHandler.sol:962-968.
  - Topic hash `keccak256("EmergencyTransferExecuted(...)")` differisce fra i tre.
    Off-chain listener che filtra sul topic dell'interface `IProxyGeneral` non riceve
    mai gli eventi emessi dall'impl.
- **Correct severity: HIGH** (osservabilità emergency compromessa).

### IFC-003 — `IBeacon.upgradeImplementation` vs `Beacon.updateImplementation`
- **Status: CONFIRMED**
- **Evidence:** `IBeacon.sol:6` `function upgradeImplementation(...)`, `Beacon.sol:109`
  `function updateImplementation(...)`. Nome divergente → selector diverso. Chi programma
  contro l'interfaccia (`IBeacon(beacon).upgradeImplementation(...)`) chiama un selector
  inesistente → revert. `Beacon` inoltre non dichiara `is IBeacon`.
- **Correct severity: HIGH** (integrazione beacon inaffidabile).

### IFC-005 — `ParameterRegistered` event drift
- **Status: CONFIRMED**
- **Evidence:**
  - `IParameterManager.sol:244` `event ParameterRegistered(string key, bytes defaultValue, string description);` — 3 args.
  - `ParameterManager.sol:64-70` `event ParameterRegistered(string indexed parameterName, uint256 initialValue, uint256 minValue, uint256 maxValue, bool requiresTimelock);` — 5 args, tipi diversi.
  - Topic hash divergente → indexer non rileva registration.
- **Correct severity: HIGH**.

### IFC-006 — `EmergencyContact*` event drift
- **Status: CONFIRMED**
- **Evidence:**
  - `IEmergencyHandler.sol:214-215`:
    `EmergencyContactAdded(address indexed contact, string role, uint256 timestamp)` — 3 args
    `EmergencyContactRemoved(address indexed contact, uint256 timestamp)` — 2 args.
  - `EmergencyHandler.sol:113-114`:
    `EmergencyContactAdded(address indexed contact)` — 1 arg
    `EmergencyContactRemoved(address indexed contact)` — 1 arg.
- **Correct severity: HIGH**.

### IFC-007 — `IParameterManagerForModules.isPaused` non implementata
- **Status: CONFIRMED**
- **Evidence:** `IParameterManagerForModules.sol:6` dichiara `function isPaused() external view returns (bool);`
  `ParameterManager.sol:14` `contract ParameterManager is IParameterManager, Ownable` — NON dichiara
  `is IParameterManagerForModules`. `grep function isPaused` in `ParameterManager.sol` → 0 match.
  Modulo che chiama `IParameterManagerForModules(pm).isPaused()` revert su selector inesistente.
- **Correct severity: HIGH**.

### IFC-008 — `SwapExecuted` event drift
- **Status: CONFIRMED**
- **Evidence:**
  - `ISwapManager.sol:127-134` `SwapExecuted(address indexed user, string tokenIn, string tokenOut, uint256 amountIn, uint256 amountOut, uint256 timestamp)` — 6 args.
  - `SwapManager.sol:120-127` `SwapExecuted(string indexed tokenIn, string indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 slippageBps, address indexed executor)` — 6 args, tipi/ordine/indexing diversi.
  - Topic hash divergente.
- **Correct severity: HIGH**.

### IFC-009 — `TokenDeposited/Withdrawn` `indexed string` drift
- **Status: CONFIRMED**
- **Evidence:**
  - `IProxyGeneral.sol:306-307` `event TokenDeposited(string tokenCode, uint256 amount, address indexed from);` — string NON indexed.
  - `ProxyGeneral.sol:105-106` `event TokenDeposited(string indexed tokenCode, uint256 amount, address indexed from);` — string INDEXED.
  - Con `indexed string` viene emesso solo il keccak256 → subscriber che si aspetta il valore letterale (come da interfaccia) riceve un hash inutilizzabile.
- **Correct severity: HIGH** (osservabilità dei deposit/withdraw rotta).

### IFC-013 — `ContractPaused` vs `Paused`
- **Status: CONFIRMED**
- **Evidence:**
  - `IProxyGeneral.sol:323-324` `event ContractPaused(address indexed pausedBy);` / `event ContractUnpaused(address indexed unpausedBy);`
  - `ProxyGeneral.sol:85-88` `event Paused(address indexed account);` / `event Unpaused(address indexed account);`
  - Topic hash divergente.
- **Correct severity: HIGH**.

### IFC-022 — EulerLensAdapter senza `override` su 4+ metodi
- **Status: CONFIRMED**
- **Evidence:** `EulerLensAdapter.sol:59` `contract EulerLensAdapter is IEulerLensAdapter, ILensAdapter, Ownable`.
  Metodi ILensAdapter senza `override`:
  - L189 `getActivePositionCount` — no override
  - L200 `getProtocolSummary` — no override
  - L875 `protocolType` — no override
  - L882 `isCircuitBreakerActive` — no override
  In Solidity 0.8.19 questi devono avere `override` → il codice **non compila** o le
  funzioni sono percepite come nuove (non override). Compile hazard reale.
- **Correct severity: HIGH**.

### IFC-023 — EulerV2Plugin `closePosition(string,string)` senza `override`
- **Status: CONFIRMED**
- **Evidence:** `IEulerV2Plugin.sol:120` `function closePosition(string memory debtTokenCode, string memory collateralTokenCode) external returns (bool success);`
  `EulerV2Plugin.sol:482-490` funzione con stessa firma ma senza `override` (linee 486-490
  hanno `external onlyProtocolManager notCircuitBroken nonReentrant returns (bool success)`).
  Compile hazard.
- **Correct severity: HIGH**.

### IFC-024 — SwapManager senza `override` su tutti i metodi ISwapManager
- **Status: CONFIRMED**
- **Evidence:** `SwapManager.sol:18` `contract SwapManager is ISwapManager, Ownable, ReentrancyGuard`.
  `grep override` sul file → 0 match. Metodi come `calculateMinAmountOut` (L1180),
  `setSimpleSwapRouter` (L1235), `getSimpleSwapRouter` (L1327), `setSwapsEnabled` (L1273),
  `areSwapsEnabled` (L1335), `getTokenBaseAssetPrice` (L1344), `estimateSwapGas` (L1366),
  `canSwap` (L1473), `validateSwapParams` (L1535), `emergencyTokenRecovery` (L1567)
  hanno tutti la stessa firma dell'interface ma NESSUN `override`.
- **Correct severity: HIGH** (compile hazard sistemico).

### IFC-027 — UniswapV3Plugin (wrapper) vs UniswapV3PluginDirect semantica divergente
- **Status: CONFIRMED**
- **Evidence:**
  - `UniswapV3Plugin.sol:59` `IERC20(spendToken).safeTransferFrom(msg.sender, address(this), amountIn);`
    → wrapper pull dai token dal **caller**.
  - `UniswapV3PluginDirect.sol:132` `IERC20(spendToken).transferFrom(proxyGeneral, address(this), amountIn);`
    → direct pull dal **ProxyGeneral** (immutable).
  - SwapManager approva il plugin via `proxy.approveSpender(...)` → dà allowance dal
    ProxyGeneral. Direct funziona; wrapper riceverebbe allowance dal ProxyGeneral ma
    poi pullerebbe da `msg.sender` = SwapManager, che non ha i token → transferFrom fallisce.
- **Correct severity: HIGH** (uno dei due plugin è di fatto non collegabile a SwapManager).

### NEW-001 — First depositor share inflation
- **Status: CONFIRMED**
- **Evidence:** `Liquiditymanager.sol:163-180` `deposit`:
  - `if (preDepositSupply == 0) shares = netDeposit;` (L166-168) — bootstrap 1:1.
  - Nessun `_mint` di minimum-liquidity (Uniswap V2 style) né virtual assets/shares
    (OZ ERC4626 `_decimalsOffset`).
  - Attaccante deposita 1 wei → 1 share. Trasferisce 10 000 USDC direttamente al
    ProxyGeneral (donazione). `totalValue = 10 000 000 001` per 1 share.
  - Vittima deposita 1 000 USDC → `shares = 1000e6 * 1 / 10000e6 ≈ 0.1` → `0` intero →
    L179 revert "Deposit too small". Griefing/DoS confermato.
  - Se la vittima raddoppia il deposit sufficient, l'attaccante recupera valore
    proporzionale della donazione.
- **Correct severity: HIGH**.

### NEW-002 — Sandwich deposit senza `minLpTokensOut`
- **Status: CONFIRMED**
- **Evidence:** `Liquiditymanager.sol:127` `function deposit(uint256 amount) external ... returns (uint256 lpTokens)`.
  Nessun parametro `minLpTokensOut`. Combinato con NEW-003 (attaccante inflaziona
  `totalValue` prima del tx vittima), le shares della vittima sono massimamente
  compresse senza tetto.
- **Correct severity: HIGH**.

### NEW-003 — NAV donation di qualsiasi token attivo
- **Status: CONFIRMED**
- **Evidence:** `ValueCalculator.sol:214-316` calcola `getTotalPoolValue` sommando i
  balance di **tutti** i token attivi nel TokenManager. Un attaccante che trasferisce
  qualunque token attivo a ProxyGeneral (transfer diretto, senza `depositToken`)
  aumenta il totalValue. Il totalSupply LP non cambia → LP price aumenta artificialmente
  → deposit successivo dà meno shares della vittima.
- **Correct severity: HIGH**.

### NEW-004 — ProxyGeneral senza `nonReentrant`
- **Status: CONFIRMED**
- **Evidence:** `ProxyGeneral.sol:18` `contract ProxyGeneral is ERC20, Ownable, ReentrancyGuard`
  eredita `ReentrancyGuard` ma nessuna funzione state-changing ha il modifier
  `nonReentrant`. `grep nonReentrant contracts/ProxyGeneral.sol` → 0 match.
  Funzioni vulnerabili in linea di principio: `mint` (L157), `burn` (L172),
  `transferFunds` (L191, chiama `to.call{value:}`), `withdrawToken` (L249),
  `depositToken` (L293), `approveSpender` (L347), `transferToModule` (L363),
  `transferFromModule` (L380), `emergencyTransferAll` (L459), `trackOperation` (L585),
  `setHourlyWithdrawn` (L644), `incrementHourlyWithdrawn` (L665).
- **Correct severity: HIGH** (import inutilizzato + potenziale reentrancy con token con
  callback come ERC777 stackati in cross-module calls).

### NEW-005 — Beacon lookup senza migrate
- **Status: CONFIRMED**
- **Evidence:** `Beacon.sol:109-137` `updateImplementation` sovrascrive `implementations[module] = newImplementation;`
  senza alcun migrate/init hook. I moduli sono contratti **standalone** (non proxy), quindi
  lo storage runtime (LP token balances di ProxyGeneral, `tokenData` di TokenManager,
  `parameters` di ParameterManager, `hourlyWithdrawnAmounts`, ecc.) è nel vecchio contratto
  e non viene trasferito. Un update di `ProxyGeneral` distruggerebbe TUTTI gli LP tokens
  degli utenti. Il pattern "beacon-lookup" richiede migrazione manuale o migrare a
  UUPS/TransparentProxy.
- **Correct severity: HIGH**.

### NEW-006 — `transferToModule` superficie ampia
- **Status: CONFIRMED**
- **Evidence:** `ProxyGeneral.sol:363-371`. Qualsiasi modulo autorizzato può invocare
  `transferToModule(token, module, amount)` dirigendo asset custody verso qualunque
  altro modulo autorizzato. Nessun vincolo di scope (es. "solo ProtocolManager può
  spostare a plugin"). Un modulo compromesso (o buggy) può dirottare fondi.
- **Correct severity: HIGH** (least-privilege violato per movimenti custody).

### NEW-007 — MorphoLensAdapter HF scale bug (variante PLG-005)
- **Status: CONFIRMED**
- **Evidence:** `MorphoLensAdapter.sol:159-179` `_computeMarketHF`.
  L178: `return (collateralValue * params.lltv) / (debtAssets * WAD);` — stessa formula
  errata di `MorphoPlugin._computeHealthFactor` (già confermata come CRITICAL in PLG-005).
  Il risultato è HF diviso per WAD extra → HF reale 1.5 diventa `1` (intero) nella
  view. Monitoring off-chain, `getPositionHealth`, `getPositionsAtRisk` sono tutti
  errati.
- **Correct severity: HIGH**.

### NEW-008 — Euler EVC main vs sub-account (variante ampliata di PLG-006)
- **Status: CONFIRMED**
- **Evidence:**
  - `EulerV2Plugin.openLeverageAtomic` (`EulerV2Plugin.sol:713-814`) esegue tutto il
    batch (`items[0..3]` di enableCollateral/deposit/enableController/borrow) su
    `address(this)` (main account) — L1005-1020.
  - `EulerV2Plugin.sol:792-797` chiama poi `IEulerRegistry(registry).createPositionOnDemand(...)`
    che assegna un `subAccountId` (>0 dopo il primo).
  - `getHealthFactor()` (L597-632) query `address(this)` direttamente, non i sub-account.
  - `_getPositionAccount(pos)` (L1292-1305) è una pezza: verifica se il sub-account ha
    balance/debt >0, altrimenti ritorna `address(this)`. Poiché il callback deposita
    su `address(this)`, il sub-account risulta sempre vuoto → il fallback torna
    `address(this)`. Tutte le posizioni si sovrappongono sul main account.
  - Impossibile aprire >1 posizione leverage indipendente: si mescolano nello stesso
    address(this). Registry pensa di avere posizioni distinte con ID/subAccount, ma
    on-chain sono un unico saldo aggregato.
- **Correct severity: HIGH** (multi-position leverage rotto; unwind di una posizione
  può liquidare/degradare le altre condividendo storage).

---

## Recap tabellare

| ID | Status | Severity confermata |
|----|--------|--------------------|
| CORE-006 | CONFIRMED | HIGH |
| CORE-010 | CONFIRMED | HIGH |
| CORE-011 | CONFIRMED | HIGH |
| PLG-001  | PARTIAL   | MEDIUM (era HIGH — 1% buffer + balance cap mitiga) |
| PLG-004  | CONFIRMED | HIGH |
| PLG-011  | CONFIRMED | HIGH |
| PLG-012  | CONFIRMED | HIGH |
| PLG-013  | PARTIAL   | HIGH (mitigazione parziale su repay flash loan, non su utente) |
| PLG-014  | PARTIAL   | HIGH (idem) |
| PLG-015  | PARTIAL   | HIGH (idem) |
| PLG-016  | CONFIRMED | HIGH |
| PLG-017  | CONFIRMED | HIGH |
| PLG-018  | CONFIRMED | HIGH |
| PLG-022  | CONFIRMED | HIGH |
| PLG-023  | CONFIRMED | HIGH |
| PLG-025  | CONFIRMED | HIGH |
| PLG-028  | CONFIRMED | HIGH |
| PLG-029  | CONFIRMED | HIGH |
| PLG-030  | CONFIRMED | HIGH |
| PLG-031  | CONFIRMED | HIGH |
| PLG-032  | CONFIRMED | HIGH |
| PLG-033  | CONFIRMED | HIGH |
| PLG-034  | CONFIRMED | HIGH |
| PLG-035  | CONFIRMED | HIGH |
| PLG-036  | CONFIRMED | HIGH |
| PLG-037  | CONFIRMED | HIGH |
| PLG-038  | CONFIRMED | HIGH |
| PLG-039  | CONFIRMED | HIGH |
| PLG-040  | CONFIRMED | HIGH |
| PLG-041  | CONFIRMED | HIGH |
| PLG-042  | CONFIRMED | HIGH |
| PLG-043  | CONFIRMED | HIGH |
| PLG-044  | CONFIRMED | HIGH |
| PLG-046  | CONFIRMED | HIGH |
| PLG-047  | CONFIRMED | HIGH |
| PLG-048  | CONFIRMED | HIGH |
| ADP-002  | CONFIRMED | HIGH |
| ADP-012  | CONFIRMED | HIGH |
| IFC-002  | CONFIRMED | HIGH |
| IFC-003  | CONFIRMED | HIGH |
| IFC-005  | CONFIRMED | HIGH |
| IFC-006  | CONFIRMED | HIGH |
| IFC-007  | CONFIRMED | HIGH |
| IFC-008  | CONFIRMED | HIGH |
| IFC-009  | CONFIRMED | HIGH |
| IFC-013  | CONFIRMED | HIGH |
| IFC-022  | CONFIRMED | HIGH |
| IFC-023  | CONFIRMED | HIGH |
| IFC-024  | CONFIRMED | HIGH |
| IFC-027  | CONFIRMED | HIGH |
| NEW-001  | CONFIRMED | HIGH |
| NEW-002  | CONFIRMED | HIGH |
| NEW-003  | CONFIRMED | HIGH |
| NEW-004  | CONFIRMED | HIGH |
| NEW-005  | CONFIRMED | HIGH |
| NEW-006  | CONFIRMED | HIGH |
| NEW-007  | CONFIRMED | HIGH |
| NEW-008  | CONFIRMED | HIGH |

## Osservazioni trasversali

1. **Slippage nella catena flash-loan**: PLG-004/11/12/13/14/15/16/17/18 + PLG-030/31/32
   + PLG-33/34/35 + ADP-027 formano una cadena unica: dal calcolo dell'importo
   flash loan (spot `getExpectedOutput`) allo swap durante il callback (nessun `minOut`
   propagato) alla mancata enforcement di `maxSlippageBps`. Fix richiede refactor
   coordinato, non patch puntuali.

2. **Event drift interface↔impl**: IFC-002/05/06/08/09/13 sono tutti drift dello stesso
   tipo (topic-hash divergente). Sistemare l'interfaccia UNA volta e allineare gli
   impl. Regressione test consigliata: `keccak256("<event signature>")` in un dizionario
   di riferimento.

3. **Compile hazards**: IFC-022/23/24 lasciano dubbio se il codice attualmente compili.
   Non è stato possibile eseguire `npx hardhat compile` in questa sessione (hardhat non
   installato localmente sul checkout). **Raccomandazione S1.5**: eseguire un compile
   pulito con `--force` e verificare che tutti gli `override` mancanti producano errori
   (Solidity 0.8.19+ è stricto).

4. **Share inflation / MEV su deposit**: NEW-001+002+003 formano un trittico che
   invalida l'assunzione di NAV puro. Fix minimo:
   - `_mint(0xdead, MIN_LIQUIDITY)` al primo deposit.
   - Parametro `minLpTokensOut` su `deposit`.
   - Tracker interno `totalDeposited` invece di `balanceOf(proxyGeneral)`.

5. **Custody model rotto per leverage EVC**: NEW-008 + PLG-006 (già in `09`) → l'intero
   design multi-position su Euler è mal progettato. Decisione S1.6: (A) rimuovere
   il claim di parallel positions e documentare "1 leverage attivo alla volta", oppure
   (B) refactorare per usare veramente i sub-account (batch che opera su
   `_deriveSubAccount(id)`, non su address(this)).

---

**Fine 11-verification-remaining.md — 2026-07-16**
