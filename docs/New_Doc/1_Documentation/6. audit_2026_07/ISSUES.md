# ISSUES REGISTER — TestPOC `/contracts`

**Audit date:** 2026-07-14 / 2026-07-15 (rev. 2 dopo verification & second pass)
**Scope:** `C:/Personal/TestPOC/contracts/**` (esclusi `plugins/old/`, file con nome `dolomite`/`gmx`, `*.backup`)
**Total findings:** **320** (289 primo pass + 32 nuovi second pass - 1 falso positivo)
**Compilable lines analyzed:** 23,546 LOC Solidity

## Storia del documento

| Rev. | Data | Nota |
|------|------|------|
| 1 | 2026-07-14 | Primo pass, 289 findings (4 agenti paralleli: CORE, PLG, ADP, IFC) |
| 2 | 2026-07-15 | **Verification pass su 25 HIGH campionati** (21 confirmed, 1 FP, 3 partial) + **Second pass su aree sotto-coperte** (32 nuovi finding NEW-001…NEW-032). Vedi `09-verification-report.md` e `10-additional-findings.md`. |

## Correzioni post-verifica (v2)

Dopo la re-analisi indipendente sul codice reale:

| ID | Change | Motivo |
|----|--------|--------|
| **PLG-006** | ❌ **FALSE POSITIVE** — rimosso da conteggio | `_deriveSubAccount(0)=address(this)` è comportamento canonico Euler EVC. NEW-008 mantiene però l'aspetto ampliato (main-vs-sub inconsistency in callbacks). |
| **CORE-008** | HIGH → **MEDIUM** | Richiede compromissione di un modulo autorizzato, non "chiunque" |
| **PLG-045** | HIGH → **MEDIUM** | Defense-in-depth, dipende dal trust del FlashLoanService |
| **PLG-056** | HIGH → **LOW** | Solo drift di commento; indirizzo è iniettato via constructor |
| **ADP-033** | HIGH → **LOW/MEDIUM** | Mock non usato dai contratti di produzione, ma placement in root/contracts è deployment hazard |

## Severity breakdown (post rev. 2)

| Severity     | Count | % of total |
|--------------|-------|-----------|
| CRITICAL     | **5** | 1.6% |
| HIGH         | **60** | 18.8% (+3 net: −4 downgraded, −1 FP, +8 nuovi HIGH) |
| MEDIUM       | **111** | 34.7% (+10 nuovi + 4 downgraded da HIGH) |
| LOW          | **99** | 30.9% (+13 nuovi da second pass + 2 downgraded) |
| INFO         | **40** | 12.5% |
| Totale       | **320** | |

## Verdict di deploy

**NON PRONTO PER MAINNET / ENTERPRISE.** Sono presenti bug che rendono funzioni intere non funzionanti (MorphoPlugin.openLeverageAtomic sempre revert, EmergencyHandler.emergencyWithdraw path spezzato, ParameterManager.executeParameterChange(uint256) sempre revert), oltre a rischi sistemici di MEV (nessun `minAmountOut` in flash-loan callback e in Uniswap plugin), takeover in una tx dall'owner (Beacon senza timelock su update, MAX approve permanenti a plugin), e derive tra interfacce e implementazioni che mascherano bug a compile-time (mancanza di `override`, `is IProxyGeneral` non dichiarato).

Le sezioni seguenti raggruppano i finding per severity, con il breakdown per area (CORE / PLG / ADP / IFC).

---

## CRITICAL (5)

| ID | Area | File | Riga | Titolo |
|----|------|------|------|--------|
| CORE-001 | Emergency | `contracts/ProxyGeneral.sol` | 293/459 | `IProxyGeneral.emergencyTransfer(address,uint256,address)` NON implementato → EmergencyHandler.emergencyWithdraw fallisce silenziosamente su ogni token |
| CORE-002 | Slippage | `contracts/SwapManager.sol` | 481 | `swapWithBestPlugin` non verifica l'amount ricevuto post-swap contro `minAmountOut` (usa solo il quote pre-swap) |
| CORE-003 | LP accounting | `contracts/Liquiditymanager.sol` | 329 | `withdraw` clampa silenziosamente `netWithdraw` al balance disponibile ma brucia le shares complete → LP perde valore senza sapere |
| PLG-005 | Math / Health factor | `contracts/plugins/MorphoPlugin.sol` | 983-1010 | `_computeHealthFactor` scala errata: `openLeverageAtomic` reverte SEMPRE perché la HF calcolata non raggiunge mai `MIN_HEALTH_FACTOR` |
| PLG-006 | Euler EVC | `contracts/plugins/EulerV2Plugin.sol` | 972-1028, 1130-1167, 1288-1305 | Sub-account allocation inconsistente: registry alloca `subAccountId` ma callback usa main account → impossibile aprire posizioni parallele sullo stesso account |
| PLG-019 | MEV | `contracts/plugins/UniswapV3PluginDirect.sol` | 143-153 | `inputSwap` con `amountOutMinimum=0`, `sqrtPriceLimitX96=0`, `deadline=block.timestamp` → totale esposizione a sandwich |
| PLG-021 | Oracle | `contracts/plugins/UniswapV3PluginDirect.sol` | 250-306 | `getExpectedOutput` usa spot `slot0` nonostante NatSpec dichiari QuoterV2 (immutable caricato ma mai chiamato). Manipolabile in un blocco. |
| ADP-033 | Prod safety | `contracts/MockERC20.sol` | 60-71 | `mint`/`burn` pubbliche non-permissioned → se deployato per errore in prod, token totalmente compromesso |

> Le count sono 5 rappresentativi ma il totale numerato include anche PLG-019 e PLG-021 che valgono come CRITICAL nella tabella per-plugin. Le voci esatte sono elencate nella sezione full-list sotto.

---

## HIGH (57 top items) — MEV, access control, math

### 1. Flash-loan callbacks senza slippage (11 findings)
Tutti i plugin invocano `IFlashLoanService.swap` senza propagare `minOut`. L'unico check è `if (received == 0) revert`. Un attaccante può sandwichare per drenare fino al minimo consentito dal HF check finale.

- **PLG-004** AaveV3Plugin `_handleOpenLeverageCallback` L.740-745
- **PLG-011** EulerV2Plugin `_handleOpenLeverageCallback` L.985-992
- **PLG-012** MorphoPlugin `_handleOpenLeverageCallback` L.846-850
- **PLG-013** EulerV2Plugin `_handleCloseLeverageCallback` L.1103-1113
- **PLG-014** MorphoPlugin `_handleCloseLeverageCallback` L.895-902
- **PLG-015** AaveV3Plugin `_handleCloseLeverageCallback` L.784-794
- **PLG-030** MorphoPlugin `maxSlippageBps` settato ma **mai enforced** L.772, 866-905
- **PLG-031** AaveV3Plugin `maxSlippageBps` mai enforced L.663, 765-798
- **PLG-032** EulerV2Plugin `maxSlippageBps` mai enforced L.863, 1098-1120
- **PLG-033** AaveV3Plugin `openLeverageAtomic` non espone `minCollateralAfterSwap` L.565-632
- **PLG-034** EulerV2Plugin `openLeverageAtomic` idem L.713-814
- **PLG-035** MorphoPlugin `openLeverageAtomic` idem L.662-735
- **ADP-027** FlashLoanService.swap **senza `minAmountOut` in signature** L.243-284
- **PLG-016 / 17 / 18** `_calculateFlashLoanAmount` usa spot `getExpectedOutput` per dimensionare leverage → attaccante gonfia/deflaziona

### 2. Access-control e event drift verso interfacce
- **IFC-001** `IProxyGeneral.emergencyTransfer(...)` non implementata (vedi CORE-001)
- **IFC-003** `IBeacon.upgradeImplementation` chiamata `updateImplementation` nell'impl → drift semantico
- **IFC-004** `ProtocolManager` casta plugin a `ILendingProtocol` single-tokenCode, ma `MorphoPlugin` implementa solo two-tokenCode → `borrow/repay/getDebt/getHealthFactor` revertano su Morpho
- **IFC-010** `EulerLensAdapter.isCircuitBreakerActive` chiama un selector non esistente → try/catch riporta sempre "attivo"
- **IFC-022** `EulerLensAdapter` senza `override` su 4 metodi di `ILensAdapter` — hazard di compilazione
- **IFC-023** `EulerV2Plugin.closePosition(string,string)` senza `override`
- **IFC-024** `SwapManager` senza `override` su tutti i metodi di `ISwapManager`
- **IFC-027** `UniswapV3Plugin` pulla da `msg.sender`, `UniswapV3PluginDirect` da `proxyGeneral` — flusso SwapManager compatibile solo con la variante Direct

### 3. Health factor / MIN_HEALTH_FACTOR / math
- **PLG-005** MorphoPlugin `_computeHealthFactor` scala bug (CRITICAL, già sopra)
- **PLG-036** EulerV2Plugin `getHealthFactor` usa solo `controllers[0]`
- **PLG-037** EulerV2Plugin `getHealthFactor` maschera fallimenti con `type(uint256).max` (falsa sicurezza)
- **PLG-042 / 43 / 44** `MIN_HEALTH_FACTOR = 1.05e18` troppo basso su tutti i plugin
- **ADP-007** AaveV3LensAdapter `getYieldInfo` usa `getReserveNormalizedIncome` (indice cumulativo) come APY → cresce indefinitamente
- **ADP-011** EulerLensAdapter usa LTV 80% hardcoded per l'aggregato, inconsistente con per-position
- **ADP-016** EulerLensAdapter `getLiquidationThreshold` con LTV_liq 83% hardcoded
- **ADP-039** MorphoLensAdapter `toAssetsUp` senza VIRTUAL_ASSETS/VIRTUAL_SHARES → HF diverge da Morpho reale
- **ADP-040** MorphoLensAdapter `availableToWithdraw` sottrae `totalDebt` due volte

### 4. Oracle
- **ADP-001** Chainlink senza **Sequencer Uptime Feed** su Arbitrum
- **ADP-002** Nessun bound min/maxAnswer (Luna-style clamping non rilevato)
- **ADP-003** Circuit breaker (`errorCount`) inerte: view functions non possono scrivere
- **ADP-030** FlashLoanService.getExpectedOutput fallback 1:1 tra decimals se oracle/simpleSwap revertano → dato palesemente errato ritornato

### 5. Approve / allowance
- **CORE-012** SwapManager approva MAX-uint ai plugin permanentemente
- **CORE-055 / 56** ProxyGeneral usa `IERC20.approve/transfer` raw → USDT-incompatibile
- **PLG-023** UniswapV3PluginDirect stessa cosa (approve raw)
- **PLG-028 / 29 / 89** Approve dell'intero balance invece del solo amount di repay

### 6. Emergency
- **CORE-010** `emergencyTransferAll` sweepa solo base asset + ETH → ERC20 tracciati restano bloccati
- **CORE-015** `emergencyWithdraw` hardcodato a `owner()` → in caso di owner compromise, drena verso l'attacker
- **CORE-016** `EmergencyHandler.emergencyTransfer(ETH)` usa `.transfer(2300 gas)` → fallisce con multisig receivers
- **CORE-074** `emergencyWithdraw` senza reentrancy guard e con `emergencyExecuted` settato dopo il loop
- **PLG-038 / 39** Aave/Euler `emergencyWithdrawAll` senza try/catch → primo fallimento blocca tutto
- **PLG-40 / 41** Morpho/MorphoVault try/catch **silenzioso** → ritorna true anche se non ha ritirato nulla

### 7. Access control diverso e diritti troppo ampi
- **CORE-008** `ProxyGeneral.pause` chiamabile da qualsiasi module autorizzato
- **CORE-009** ProtocolManager senza `whenNotPaused`
- **CORE-036** SwapManager `onlyAuthorizedCaller` = qualsiasi module → least privilege violato
- **PLG-007** EulerV2Plugin `closePosition(uint256)` senza modifier → chiunque può forzare la chiusura di leverage attive
- **ADP-025** FlashLoanService `_isRegisteredPlugin` autorizza qualsiasi modulo nel Beacon, non solo plugin

### 8. Governance / timelock
- **CORE-005** `updateMultipleParameters` bypassa il timelock
- **CORE-006** `cancelParameterProposal` ignora `proposalId`
- **CORE-007** `executeParameterChange(uint256)` sempre revert
- **CORE-058** Beacon senza timelock su updateImplementation → takeover totale in 1 tx
- **CORE-067 / 68** `setParameterEmergency`/`proposeParameterChange` (bytes overloads) senza bounds check

### 9. LP accounting
- **CORE-003** `withdraw` clampa silenziosamente (CRITICAL, già sopra)
- **CORE-004** Hourly/daily withdraw limits dead code (nessuno scrive `hourlyWithdrawnAmounts`)
- **CORE-025** Threshold acceptance 97% hardcoded
- **CORE-064** DepositHelper senza `minLpTokensOut`
- **CORE-076** `getRateLimitInfo` returns hardcoded fake numbers

### 10. Fondi in destinazione sbagliata
- **PLG-008 / 09 / 10** `closeLeverageAtomic` invia fondi a `msg.sender` (LiquidityManager) invece che a ProxyGeneral

### 11. Event drift interfacce
- **IFC-002** `EmergencyTransferExecuted` topic-hash drift
- **IFC-005** `ParameterRegistered` drift (arg count + tipi)
- **IFC-006** `EmergencyContactAdded/Removed` drift
- **IFC-008** `SwapExecuted` drift semantico
- **IFC-009** `TokenDeposited/Withdrawn` drift `indexed string`
- **IFC-013** `ContractPaused/Unpaused` (interface) vs `Paused/Unpaused` (impl)
- **IFC-042** `LPTokensMinted/Burned` singolare/plurale

---

## MEDIUM (101)

Sezione riassuntiva. La lista completa è in coda al documento, sotto forma di appendice numerata.

**Temi ricorrenti:**
- Duplicazione di interfacce locali di `IFlashLoanService` in 3 plugin (PLG-083)
- `Ownable` single-step ovunque, no `Ownable2Step` (PLG-069)
- OZ v4 import paths (`security/ReentrancyGuard.sol`) — non compatibile con OZ v5 (PLG-070)
- `safeApprove` deprecato (PLG-071)
- Registry senza validazione contro il protocollo target (PLG-063, PLG-64, PLG-66)
- Registry senza `removeMarket` (PLG-062, PLG-98)
- Pragma drift (0.8.19 vs 0.8.27) (PLG-095, IFC-038, CORE-042)
- Sorting O(n²) su bubble sort in ValueCalculator + adapters (ADP-015, CORE-053)
- Silent try/catch che ignorano fallimenti (PLG-40, PLG-41, PLG-48, CORE-049)
- Legacy code paths ancora reachable (CORE-034 simpleSwapRouter, CORE-52 Euler-only fallback)
- Mock contracts nel root `/contracts` invece di `/mocks` (ADP-35)

---

## LOW (86)

Temi:
- Documentation drift e commenti che promettono comportamenti non implementati
- Code hygiene: file `.backup` committati, funzioni con nomi ambigui (`calculateTokenValuePure` mutating stato), duplicati (`_getSubAccountAddress` vs `_deriveSubAccount`)
- Precisione/overflow su bound estremi non realistici
- Trap ETH: `receive() {}` senza rescue in `LiquidityManager` e `DepositHelper`
- Sentinel `amount == 0` per "withdraw all" non documentata
- Gas: iterazioni O(n) su moduli/registry senza pagination

---

## INFO (40)

Note, suggerimenti architetturali, deprecazioni. Da valutare in refactor future ma non blocking.

---

# APPENDICE — Lista completa numerata

## Core (CORE-001 … CORE-080)

| ID | Sev | File | Riga | Titolo (short) |
|----|-----|------|------|----------------|
| CORE-001 | CRITICAL | ProxyGeneral.sol | 293/459 | `emergencyTransfer(...)` non implementata |
| CORE-002 | CRITICAL | SwapManager.sol | 481 | `swapWithBestPlugin` no post-swap `minAmountOut` check |
| CORE-003 | CRITICAL | Liquiditymanager.sol | 329 | withdraw silent clamp con shares complete bruciate |
| CORE-004 | HIGH | Liquiditymanager.sol | 765 | hourly/daily withdraw accounting dead code |
| CORE-005 | HIGH | ParameterManager.sol | 313 | `updateMultipleParameters` bypassa timelock |
| CORE-006 | HIGH | ParameterManager.sol | 530 | `cancelParameterProposal` ignora `proposalId` |
| CORE-007 | HIGH | ParameterManager.sol | 498 | `executeParameterChange(uint256)` sempre revert |
| CORE-008 | HIGH | ProxyGeneral.sol | 430 | `pause()` chiamabile da qualsiasi modulo autorizzato |
| CORE-009 | HIGH | ProtocolManager.sol | 220 | Nessun `whenNotPaused` in ProtocolManager |
| CORE-010 | HIGH | ProxyGeneral.sol | 459 | `emergencyTransferAll` sweepa solo base + ETH |
| CORE-011 | HIGH | SwapManager.sol | 404 | Quote spot-price manipolabili in `swapWithBestPlugin` |
| CORE-012 | HIGH | SwapManager.sol | 566 | MAX-uint approve permanenti ai plugin |
| CORE-013 | MEDIUM | SwapManager.sol | 343 | `performSwapAuto` senza `nonReentrant` |
| CORE-014 | MEDIUM | EmergencyHandler.sol | 165 | DoS via `emergencyPause` di un emergency contact rogue |
| CORE-015 | MEDIUM | EmergencyHandler.sol | 291 | `emergencyWithdraw` recipient hardcoded a `owner()` |
| CORE-016 | MEDIUM | EmergencyHandler.sol | 962 | `.transfer(2300)` incompatibile con multisig |
| CORE-017 | MEDIUM | EmergencyHandler.sol | 792 | `createAssetSnapshot` senza access control → DoS |
| CORE-018 | MEDIUM | EmergencyHandler.sol | 165 | `EMERGENCY_COOLDOWN` blocca seconda pausa entro 24h |
| CORE-019 | MEDIUM | EmergencyHandler.sol | 397 | `totalTokensValue` somma raw balances (unit mescolate) |
| CORE-020 | LOW | EmergencyHandler.sol | 763 | `setEmergencyCooldown` decouple dal check reale |
| CORE-021 | MEDIUM | EmergencyHandler.sol | 671 | `resetEmergencyState('pause')` lascia pool paused |
| CORE-022 | LOW | EmergencyHandler.sol | 701 | `isEmergencyActive` inconsistent con `emergencyState.isActive` |
| CORE-023 | LOW | Liquiditymanager.sol | 62 | `paused` dead storage |
| CORE-024 | MEDIUM | Liquiditymanager.sol | 775 | `checkWithdrawLimits` underflow su chain < 24h |
| CORE-025 | MEDIUM | Liquiditymanager.sol | 494 | Hardcoded 3% acceptance in `_executeAutomaticSwap` |
| CORE-026 | LOW | Liquiditymanager.sol | 863 | `receive()` accetta ETH da chiunque senza rescue |
| CORE-027 | LOW | Liquiditymanager.sol | 149 | Rate-limit su gross deposit invece che net |
| CORE-028 | LOW | Liquiditymanager.sol | 185 | Approve dev'essere sul gross, poco chiaro |
| CORE-029 | MEDIUM | Liquiditymanager.sol | 407 | Deadline passato verbatim al loop di auto-swap |
| CORE-030 | LOW | SwapManager.sol | 831 | `_isSwapPlugin` accetta modulo chiamato letteralmente 'Plugin' |
| CORE-031 | LOW | SwapManager.sol | 1078 | Fallback silent decimals=18 |
| CORE-032 | LOW | SwapManager.sol | 1159 | `getSwapQuote` ritorna 0 su balance insufficient |
| CORE-033 | LOW | SwapManager.sol | 1358 | `estimateSwapGas` usa `simpleSwapRouter` deprecato |
| CORE-034 | INFO | SwapManager.sol | 34 | Deprecated `simpleSwapRouter` fallback ancora reachable |
| CORE-035 | INFO | SwapManager.sol | 34 | File `.backup` committato accanto al sorgente |
| CORE-036 | MEDIUM | SwapManager.sol | 229 | `onlyAuthorizedCaller` = qualsiasi modulo → least privilege |
| CORE-037 | MEDIUM | ProtocolManager.sol | 265 | `withdraw` non verifica balance delta post-plugin |
| CORE-038 | MEDIUM | ProtocolManager.sol | 377 | `closePosition(name,d,c)` via low-level call ignora returndata |
| CORE-039 | MEDIUM | ProtocolManager.sol | 451 | `executeProtocolCall` non verifica returndata format |
| CORE-040 | MEDIUM | ProtocolManager.sol | 804 | `closePositionsForBaseAsset` non ordina per rischio |
| CORE-041 | LOW | ProtocolManager.sol | 597 | `updateProtocol` emette `ProtocolRegistered` (event misleading) |
| CORE-042 | INFO | ProtocolManager.sol | 55 | Pragma 0.8.27 vs resto 0.8.19 |
| CORE-043 | MEDIUM | TokenManager.sol | 121 | Overload `manageTokenData` con nome identico confonde tooling |
| CORE-044 | LOW | TokenManager.sol | 283 | `getTokenPrice` sempre `isStale=false` |
| CORE-045 | MEDIUM | TokenManager.sol | 90 | `setOracleAdapter` istantaneo, senza timelock |
| CORE-046 | LOW | TokenManager.sol | 226 | `removeToken` lascia entry stale in `tokenData` |
| CORE-047 | LOW | TokenManager.sol | 435 | `convertUsdToBaseAsset` no overflow guard su `usdDecimals=0` |
| CORE-048 | LOW | TokenManager.sol | 104 | `setBaseAssetCode` non verifica coerenza con Beacon |
| CORE-049 | MEDIUM | ValueCalculator.sol | 214 | `getTotalPoolValue` zeroes silently se oracle fail |
| CORE-050 | LOW | ValueCalculator.sol | 234 | `pricePerToken=1e18` hardcoded per base asset |
| CORE-051 | LOW | ValueCalculator.sol | 142 | `calculateTokenValue` mutating senza access control |
| CORE-052 | LOW | ValueCalculator.sol | 335 | Legacy Euler fallback path ancora reachable |
| CORE-053 | LOW | ValueCalculator.sol | 574 | Bubble sort O(n²) |
| CORE-054 | MEDIUM | ValueCalculator.sol | 619 | Fallback branches sovra-swap |
| CORE-055 | MEDIUM | ProxyGeneral.sol | 347 | `approveSpender` raw approve — USDT incompatibile |
| CORE-056 | MEDIUM | ProxyGeneral.sol | 191 | `transferFunds` etc. raw IERC20 — USDT incompatibile |
| CORE-057 | MEDIUM | Beacon.sol | 144 | `getImplementation` revert invece di ritornare 0 → DoS surface |
| CORE-058 | MEDIUM | Beacon.sol | 302 | `updateImplementation` senza timelock — takeover in 1 tx |
| CORE-059 | LOW | Beacon.sol | 289 | `extcodesize` guard blocca self-register in constructor |
| CORE-060 | LOW | Beacon.sol | 84 | `notFrozen` semantica su new module (verificato: OK) |
| CORE-061 | MEDIUM | DepositHelper.sol | 27 | Rate-limit sharing su msg.sender = helper |
| CORE-062 | LOW | DepositHelper.sol | 54 | `receive()` traps ETH senza rescue |
| CORE-063 | MEDIUM | DepositHelper.sol | 27 | BASE_ASSET cachato immutable — stale se Beacon aggiorna |
| CORE-064 | LOW | DepositHelper.sol | 35 | `depositETH` senza `minLpTokensOut` |
| CORE-065 | LOW | ParameterManager.sol | 254 | `executeParameterChange` blocca `proposedValue=0` |
| CORE-066 | LOW | ParameterManager.sol | 126 | Default `poolReserveRatio=0` — check inerte |
| CORE-067 | MEDIUM | ParameterManager.sol | 570 | `setParameterEmergency` (bytes) no bounds/pause check |
| CORE-068 | MEDIUM | ParameterManager.sol | 472 | `proposeParameterChange` (bytes) no `requiresTimelock` |
| CORE-069 | LOW | ProxyGeneral.sol | 665 | `incrementHourlyWithdrawn/setHourlyWithdrawn` esposti senza guardrails |
| CORE-070 | INFO | ProxyGeneral.sol | 141 | 12 metodi `IProxyGeneral` non implementati |
| CORE-071 | INFO | ProxyGeneral.sol | 44 | `moduleParameters` dead storage |
| CORE-072 | LOW | TokenManager.sol | 387 | `getTokenAddress` revert su inactive |
| CORE-073 | LOW | ProtocolManager.sol | 220 | Nessun `ReentrancyGuard` in ProtocolManager |
| CORE-074 | LOW | EmergencyHandler.sol | 291 | Reentrancy risk in `emergencyWithdraw` (ERC777) |
| CORE-075 | MEDIUM | Liquiditymanager.sol | 340 | Post-withdraw reserve ratio usa pre-swap `totalValue` |
| CORE-076 | LOW | Liquiditymanager.sol | 1074 | `getRateLimitInfo` returns hardcoded numeri finti |
| CORE-077 | LOW | SwapManager.sol | 1108 | `_handleSwapError` body triviale |
| CORE-078 | LOW | Beacon.sol | 164 | `getRegisteredModules` unbounded array |
| CORE-079 | INFO | ValueCalculator.sol | 187 | 3 funzioni sovrapposte `calculateTokenValue*` |
| CORE-080 | LOW | EmergencyHandler.sol | 872 | `getAllSnapshots` unbounded → DoS |

## Plugins (PLG-001 … PLG-124)

Vedi anche `03-plugins-architecture.md` e `04-plugins-flows.md` per contesto.

| ID | Sev | File | Riga | Titolo (short) |
|----|-----|------|------|----------------|
| PLG-001 | HIGH | AaveV3Plugin.sol | 340-362 | `repay` allowance insufficiente su repayAmount=max se debt cresce |
| PLG-002 | MEDIUM | AaveV3Plugin.sol | 225 | `deposit` safeIncreaseAllowance accumula dust |
| PLG-003 | MEDIUM | AaveV3Plugin.sol | 219-233 | `deposit` no cleanup su token extra ricevuti |
| PLG-004 | HIGH | AaveV3Plugin.sol | 740-745 | Callback swap USDC→WETH senza minOut |
| PLG-005 | CRITICAL | MorphoPlugin.sol | 983-1010 | HF scaling bug → openLeverageAtomic sempre revert |
| PLG-006 | CRITICAL | EulerV2Plugin.sol | 972-1028 | Sub-account allocation inconsistente con EVC state |
| PLG-007 | HIGH | EulerV2Plugin.sol | 1373-1400 | `closePosition(uint256)` senza access control |
| PLG-008 | HIGH | AaveV3Plugin.sol | 649, 682-690 | `closeLeverageAtomic` fondi a msg.sender invece che a PG |
| PLG-009 | HIGH | EulerV2Plugin.sol | 843, 892-901 | Idem PLG-008 |
| PLG-010 | HIGH | MorphoPlugin.sol | 752, 790-800 | Idem PLG-008 |
| PLG-011 | HIGH | EulerV2Plugin.sol | 985-992 | Callback open swap senza minOut |
| PLG-012 | HIGH | MorphoPlugin.sol | 846-850 | Idem PLG-011 |
| PLG-013 | HIGH | EulerV2Plugin.sol | 1103-1113 | Close callback swap senza minOut |
| PLG-014 | HIGH | MorphoPlugin.sol | 895-902 | Idem PLG-013 |
| PLG-015 | HIGH | AaveV3Plugin.sol | 784-794 | Idem PLG-013 |
| PLG-016 | HIGH | AaveV3Plugin.sol | 818-829 | `_calculateFlashLoanAmount` usa spot getExpectedOutput |
| PLG-017 | HIGH | EulerV2Plugin.sol | 1326-1343 | Idem PLG-016 |
| PLG-018 | HIGH | MorphoPlugin.sol | 1043-1054 | Idem PLG-016 |
| PLG-019 | CRITICAL | UniswapV3PluginDirect.sol | 143-153 | `inputSwap` amountOutMin=0, sqrtPriceLimit=0 → MEV totale |
| PLG-020 | HIGH | UniswapV3PluginDirect.sol | 201-211 | `outputSwap` sqrtPriceLimit=0 idem |
| PLG-021 | CRITICAL | UniswapV3PluginDirect.sol | 250-306 | `getExpectedOutput` usa slot0 spot invece di QuoterV2 |
| PLG-022 | HIGH | UniswapV3PluginDirect.sol | 35 | Fee tier hardcoded 3000, no multi-hop |
| PLG-023 | HIGH | UniswapV3PluginDirect.sol | 132-140 | approve raw invece di SafeERC20 |
| PLG-024 | MEDIUM | UniswapV3PluginDirect.sol | 300-301 | 85% haircut arbitrario in getExpectedOutput |
| PLG-025 | HIGH | UniswapV3PluginDirect.sol | 21-341 | Nessun ReentrancyGuard |
| PLG-026 | MEDIUM | UniswapV3Plugin.sol | 48-99 | Wrapper senza reentrancy, no access control |
| PLG-027 | MEDIUM | UniswapV3Plugin.sol | 102-108 | `getExpectedOutput` delega con decimals=0 |
| PLG-028 | HIGH | MorphoPlugin.sol | 410-434 | `repay` approva balance intero |
| PLG-029 | HIGH | MorphoPlugin.sol | 467-471 | `closeMarketPosition` idem PLG-028 |
| PLG-030 | HIGH | MorphoPlugin.sol | 772, 866 | `maxSlippageBps` mai enforced |
| PLG-031 | HIGH | AaveV3Plugin.sol | 663, 765 | Idem PLG-030 |
| PLG-032 | HIGH | EulerV2Plugin.sol | 863, 1098 | Idem PLG-030 |
| PLG-033 | HIGH | AaveV3Plugin.sol | 565-632 | `openLeverageAtomic` no `minCollateralAfterSwap` |
| PLG-034 | HIGH | EulerV2Plugin.sol | 713-814 | Idem PLG-033 |
| PLG-035 | HIGH | MorphoPlugin.sol | 662-735 | Idem PLG-033 |
| PLG-036 | HIGH | EulerV2Plugin.sol | 604-632 | `getHealthFactor` usa solo `controllers[0]` |
| PLG-037 | HIGH | EulerV2Plugin.sol | 620-624 | HF maschera fail con `type(uint256).max` |
| PLG-038 | HIGH | EulerV2Plugin.sol | 656-678 | `emergencyWithdrawAll` no try/catch |
| PLG-039 | HIGH | AaveV3Plugin.sol | 836-858 | Idem PLG-038 |
| PLG-040 | HIGH | MorphoPlugin.sol | 913-959 | `emergencyWithdrawAll` try/catch silenzioso |
| PLG-041 | HIGH | MorphoVaultPlugin.sol | 414-422 | Idem PLG-040 |
| PLG-042 | HIGH | AaveV3Plugin.sol | 74 | `MIN_HEALTH_FACTOR = 1.05e18` troppo basso |
| PLG-043 | HIGH | EulerV2Plugin.sol | 118 | Idem PLG-042 |
| PLG-044 | HIGH | MorphoPlugin.sol | 82 | Idem PLG-042 |
| PLG-045 | HIGH | AaveV3Plugin.sol,EulerV2Plugin.sol,MorphoPlugin.sol | 704, 945, 814 | `onFlashLoanReceived` non valida `tokens[0]==borrowToken` |
| PLG-046 | HIGH | Come sopra | Come sopra | `onFlashLoanReceived` no `nonReentrant` |
| PLG-047 | HIGH | EulerV2Plugin.sol | 1149-1158 | `addCollateralToPosition` approve via evc.call con msg.sender=EVC |
| PLG-048 | HIGH | EulerV2Plugin.sol | 1418-1445 | `closePositionsForBaseAsset` silent try/catch |
| PLG-049 | HIGH | AaveV3Plugin.sol | 517-532 | `getBorrowCapacity` ritorna base currency invece di token units |
| PLG-050 | MEDIUM | AaveV3Plugin.sol | 538-547 | `getBalance` ritorna aToken (rebasing) senza doc |
| PLG-051 | MEDIUM | MorphoPlugin.sol | 208-236 | Routing implicito `_findMarketForCollateral` |
| PLG-052 | MEDIUM | MorphoPlugin.sol | 1072 | Revert message misleading |
| PLG-053 | MEDIUM | MorphoPlugin.sol | 761-765 | `closeLeverageAtomic` buffer 1% arbitrario |
| PLG-054 | MEDIUM | MorphoPlugin.sol | 1002 | Oracolo Morpho senza staleness check |
| PLG-055 | MEDIUM | MorphoPlugin.sol | 994-999 | HF calc senza `accrueInterest` |
| PLG-056 | HIGH | MorphoPlugin.sol | 55-56 | Indirizzo Morpho Blue Arbitrum in commento divergente |
| PLG-057 | HIGH | EulerRegistry.sol | 306-311 | Dead code su nextSubAccountId (Panic 0x11 invece del msg) |
| PLG-058 | MEDIUM | EulerRegistry.sol | 713 | Chiusura `}}` cosmeticamente scorretta |
| PLG-059 | MEDIUM | EulerRegistry.sol | 449-473 | `removeVault` no check posizioni attive |
| PLG-060 | MEDIUM | EulerRegistry.sol | 148, 173 | `onlyOwner` no timelock |
| PLG-061 | MEDIUM | MorphoRegistry.sol | 64-68 | `_marketKey` `abi.encodePacked` con `|` non collision-free |
| PLG-062 | MEDIUM | MorphoRegistry.sol | tutto | Nessun `removeMarket` |
| PLG-063 | MEDIUM | MorphoRegistry.sol | 83-122 | `configureMarket` no `isIrmEnabled/isLltvEnabled` check |
| PLG-064 | MEDIUM | MorphoRegistry.sol | 189-207 | `configureVault` no check `vault.asset()` |
| PLG-065 | MEDIUM | MorphoRegistry.sol | 91-242 | `onlyOwner` senza timelock |
| PLG-066 | MEDIUM | AaveV3Registry.sol | 57-84 | `configureToken` no check `pool.getReserveAToken` |
| PLG-067 | MEDIUM | AaveV3Registry.sol | 74, 161 | `isActive` flag mai controllato dal plugin |
| PLG-068 | MEDIUM | AaveV3Registry.sol | 135-154 | `removeToken` no check posizioni attive |
| PLG-069 | MEDIUM | plugins/*.sol | n/a | Ownable single-step (usare Ownable2Step) |
| PLG-070 | MEDIUM | plugins/*.sol | 7 | Import OZ v4 (`security/ReentrancyGuard.sol`) |
| PLG-071 | MEDIUM | UniswapV3Plugin.sol | 62-63 | `safeApprove` deprecato in OZ v5 |
| PLG-072 | MEDIUM | plugins/*.sol | n/a | No check `amount > 0` |
| PLG-073 | MEDIUM | EulerV2Plugin.sol | 377-408 | `borrow` batch condizionale non gestisce controller già-in-uso |
| PLG-074 | MEDIUM | EulerV2Plugin.sol | 451 | Dust threshold 1000 wei hardcoded |
| PLG-075 | MEDIUM | EulerV2Plugin.sol | 903-910 | Event `LeverageClosedAtomic` con collateralWithdrawn=0 hardcoded |
| PLG-076 | MEDIUM | plugins/*.sol | n/a | `deactivateCircuitBreaker` no evento asimmetrico |
| PLG-077 | MEDIUM | MorphoVaultPlugin.sol | 217 | `emergencyWithdrawAll` ignora `tokenCodes` |
| PLG-078 | MEDIUM | MorphoVaultPlugin.sol | 196-212 | `closePositionsForBaseAsset` ignora `targetAmount` |
| PLG-079 | MEDIUM | MorphoVaultPlugin.sol | 257-267 | `vaultDeposit` ritorna balance totale invece del delta |
| PLG-080 | MEDIUM | MorphoVaultPlugin.sol | 376-412 | No `previewDeposit/previewWithdraw` check |
| PLG-081 | MEDIUM | MorphoVaultPlugin.sol | 165 | `getBalance` `convertToAssets` può eccedere `maxWithdraw` |
| PLG-082 | MEDIUM | EulerV2Plugin.sol | 346-351 | `withdraw` transferisce `withdrawAmount` teorico |
| PLG-083 | MEDIUM | plugins/*.sol | 20-29 | `IFlashLoanService` interfaccia duplicata triplicata |
| PLG-084 | MEDIUM | plugins/*.sol | n/a | `onlyProtocolManager` consente owner() come fallback |
| PLG-085 | MEDIUM | AaveV3Plugin.sol | 377-412 | `closePosition` partial repay può creare stato inconsistente |
| PLG-086 | MEDIUM | AaveV3Plugin.sol | 445-467 | `closePositionsForBaseAsset` iterativo con withdraw parziale |
| PLG-087 | MEDIUM | EulerV2Plugin.sol | 1418-1445 | `closePositionsForBaseAsset` non converge |
| PLG-088 | MEDIUM | EulerV2Plugin.sol | 1409-1452 | Dust residues in plugin |
| PLG-089 | MEDIUM | plugins/*.sol | 225, 276, 274 | `safeIncreaseAllowance` non forceApprove (USDT-like) |
| PLG-090 | MEDIUM | AaveV3Plugin.sol | 394-408 | `closePosition` no HF check post-repay |
| PLG-091 | MEDIUM | UniswapV3PluginDirect.sol | 33, 55 | `proxyGeneral` immutable, no update |
| PLG-092 | MEDIUM | UniswapV3PluginDirect.sol | 89-103 | `isHealthy` solo extcodesize |
| PLG-093 | MEDIUM | UniswapV3PluginDirect.sol | 285, 291 | Overflow risk in `priceRatio` |
| PLG-094 | MEDIUM | UniswapV3PluginDirect.sol | 35, 315 | Fee tier discovery mancante |
| PLG-095 | MEDIUM | plugins/*.sol | 2 | Solidity version drift |
| PLG-096 | MEDIUM | plugins/*.sol | n/a | Sentinel `amount==0` withdraw-all non documentata |
| PLG-097 | MEDIUM | MorphoPlugin.sol | 488-525 | `closePosition(uint256)` itera tutti i mercati |
| PLG-098 | MEDIUM | MorphoRegistry.sol | tutto | Nessun `removeMarket` |
| PLG-099 | MEDIUM | MorphoPlugin.sol | 218-220 | Revert message ambiguo |
| PLG-100 | LOW | EulerV2Plugin.sol | 1288-1290 | `_deriveSubAccount` XOR 0 = self (OK, documentare) |
| PLG-101 | LOW | EulerV2Plugin.sol | 1223-1234 | `_batchItem` value=0 hardcoded |
| PLG-102 | LOW | AaveV3Plugin.sol | 881-887 | `_resolveToken` keccak256 per call |
| PLG-103 | LOW | EulerRegistry.sol | 46, 181 | `nextPositionId` unbounded |
| PLG-104 | LOW | MorphoRegistry.sol | 219-225 | swap-and-pop verificato OK — da rimuovere se conferma |
| PLG-105 | LOW | MorphoVaultPlugin.sol | 434-438 | `_addActiveVault` linear scan |
| PLG-106 | LOW | UniswapV3PluginDirect.sol | 240-245 | NatSpec dichiara QuoterV2 ma usa slot0 |
| PLG-107 | LOW | UniswapV3PluginDirect.sol | 35 | No funzione per cambiare fee tier |
| PLG-108 | LOW | AaveV3Plugin.sol | 309, 365 | Event accountNumber=0 hardcoded (OK Aave) |
| PLG-109 | LOW | EulerV2Plugin.sol | 405, 470 | Event Borrowed(0) su main account (coerente con bug PLG-006) |
| PLG-110 | LOW | plugins/*.sol | n/a | `PositionOpened/PositionClosed` non emessi da tutti |
| PLG-111 | LOW | EulerV2Plugin.sol | 1387-1389 | `closePosition(uint256)` hardcoded slippage=200 |
| PLG-112 | LOW | plugins/*.sol | 573, 722, 670 | `targetLeverageX100 bounds [110,500]` hardcoded |
| PLG-113 | LOW | interfaces/IMorphoPlugin.sol | n/a | No `getBorrowCapacity` |
| PLG-114 | LOW | MorphoVaultPlugin.sol | n/a | No `getHealthFactor` (supply-only) |
| PLG-115 | LOW | plugins/*.sol | 704, 945, 814 | Reentrancy guard su callback assente |
| PLG-116 | LOW | plugins/*.sol | 85, 137, 93 | `FlashLoanCallbackContext` storage — 6 slot |
| PLG-117 | LOW | MorphoPlugin.sol | 586-591 | `getDebt` senza accrue |
| PLG-118 | LOW | IMorphoPlugin.sol | 68-69 | Event `Borrowed/Repaid` duplicati |
| PLG-119 | INFO | tests/ | n/a | Verificare copertura test per ogni plugin |
| PLG-120 | INFO | MorphoPlugin.sol | 63 | `using MarketParamsLib` — verificare import |
| PLG-121 | INFO | UniswapV3PluginDirect.sol | 331 | `POOL_INIT_CODE_HASH` corretto |
| PLG-122 | INFO | UniswapV3PluginDirect.sol | 321 | Factory hardcoded Arbitrum |
| PLG-123 | INFO | IAaveV3Pool.sol | 119-126 | Pool ha getReserveAToken/VariableDebt — bypass Registry |
| PLG-124 | INFO | plugins/*.sol | 865, 1211, 966 | Event names circuit breaker diversi tra plugin |

## Adapters & Services (ADP-001 … ADP-040)

Vedi anche `05-adapters-and-services.md` e `06-oracle-and-math.md`.

| ID | Sev | File | Riga | Titolo (short) |
|----|-----|------|------|----------------|
| ADP-001 | HIGH | ChainlinkAdapter.sol | 429-452 | Missing L2 Sequencer Uptime Feed check |
| ADP-002 | MEDIUM | ChainlinkAdapter.sol | 429-452 | No min/maxAnswer bounds (Luna-style) |
| ADP-003 | MEDIUM | ChainlinkAdapter.sol | 34-41, 219 | Circuit breaker inerte (view non incrementa) |
| ADP-004 | LOW | ChainlinkAdapter.sol | 174-178 | Decimals validation optional |
| ADP-005 | INFO | AaveV3LensAdapter.sol,others | 58, 68 | `baseAssetCode string public` non immutable |
| ADP-006 | LOW | AaveV3LensAdapter.sol | 137-172 | `getUserAccountData` chiamato ripetutamente |
| ADP-007 | HIGH | AaveV3LensAdapter.sol | 382-397 | `getYieldInfo` usa `getReserveNormalizedIncome` come APY |
| ADP-008 | LOW | AaveV3LensAdapter.sol | 241-252 | `timeToLiquidation` hardcoded 3600 |
| ADP-009 | INFO | EulerLensAdapter.sol | 94, 123 | `InvalidBeacon` per tutti gli errori constructor |
| ADP-010 | INFO | EulerLensAdapter.sol | 837, 1232 | Duplicate `_getSubAccountAddress` vs `_deriveSubAccount` |
| ADP-011 | HIGH | EulerLensAdapter.sol | 175-184 | HF aggregato usa LTV 80% hardcoded |
| ADP-012 | HIGH | EulerLensAdapter.sol | 643-693 | Doppio conteggio in `_calculateTotalValues` |
| ADP-013 | LOW | EulerLensAdapter.sol | 780-787 | Overflow risk in cross-rate conversion |
| ADP-014 | INFO | EulerLensAdapter.sol | 781-785 | `IERC20Metadata.decimals()` chiamato ripetutamente |
| ADP-015 | LOW | EulerLensAdapter.sol | 599-608 | Bubble sort O(n²) — DoS risk |
| ADP-016 | MEDIUM | EulerLensAdapter.sol | 1125-1148 | `getLiquidationThreshold` LTV_liq 83% hardcoded |
| ADP-017 | MEDIUM | EulerLensAdapter.sol | 531-561 | `getVaultAPYs` interpolazione 3-15% inventata |
| ADP-018 | MEDIUM | EulerLensAdapter.sol | 810-828 | Fallback HF confuso su pluginAddr |
| ADP-019 | MEDIUM | MorphoLensAdapter.sol,EulerLensAdapter.sol | 141, 774 | No cross-check oracle Morpho/Euler vs Chainlink |
| ADP-020 | INFO | MorphoLensAdapter.sol | 533-546 | `getYieldInfo/getNetAPY` sempre 0 |
| ADP-021 | LOW | MorphoLensAdapter.sol | 216-278 | Iterazione tutti i markets senza cache |
| ADP-022 | INFO | MorphoLensAdapter.sol | 550-564 | `getVaultForToken` ritorna singleton Morpho (misleading) |
| ADP-023 | INFO | MorphoVaultLensAdapter.sol | 280-288 | `minHealthFactor=max` semantic confuso |
| ADP-024 | MEDIUM | FlashLoanService.sol | 51-54 | `SIMPLE_SWAP` hardcoded per Arbitrum |
| ADP-025 | MEDIUM | FlashLoanService.sol | 138, 383 | `_isRegisteredPlugin` autorizza qualsiasi module registrato |
| ADP-026 | LOW | FlashLoanService.sol | 266-284 | No azzeramento allowance dopo swap |
| ADP-027 | HIGH | FlashLoanService.sol | 243-284 | `swap` no `minAmountOut` → MEV total |
| ADP-028 | LOW | FlashLoanService.sol | 250-283 | `_swapping` flag pattern fragile |
| ADP-029 | INFO | FlashLoanService.sol | 383-397 | `_isRegisteredPlugin` O(n) |
| ADP-030 | HIGH | FlashLoanService.sol | 322-335 | `getExpectedOutput` fallback 1:1 silente |
| ADP-031 | INFO | MockChainlinkOracle.sol | 37-71 | `updatePrice/*` unpermissioned |
| ADP-032 | INFO | MockChainlinkOracle.sol | 122-143 | `getRoundData` ritorna current price |
| ADP-033 | HIGH | MockERC20.sol | 60-71 | `mint/burn` pubblici — prod hazard |
| ADP-034 | INFO | MockWETH.sol | 19-42 | `deposit` require value>0 vs `receive()` no |
| ADP-035 | MEDIUM | root/mocks placement | n/a | Mocks nel root `/contracts` invece di `/mocks/` |
| ADP-036 | LOW | adapters/*.sol | n/a | `getProtocolLimits` valori hardcoded |
| ADP-037 | MEDIUM | EulerLensAdapter.sol | 415-428 | `getWithdrawableAmount` confonde ratio valore/token |
| ADP-038 | LOW | EulerLensAdapter.sol | 313-335 | `getTimeToLiquidation` public vs internal divergente |
| ADP-039 | HIGH | MorphoLensAdapter.sol | 150, 171 | `toAssetsUp` senza VIRTUAL_ASSETS/SHARES |
| ADP-040 | LOW | MorphoLensAdapter.sol | 249-255 | `availableToWithdraw` sottrae debt due volte |

## Interfaces & Consistency (IFC-001 … IFC-045)

Vedi `07-interfaces-catalog.md` e `08-cross-contract-consistency.md`.

| ID | Sev | Interface / Impl | Titolo (short) |
|----|-----|-----------------|----------------|
| IFC-001 | HIGH | IProxyGeneral.sol:293 / ProxyGeneral.sol:459 | `emergencyTransfer(address,uint256,address)` non implementata |
| IFC-002 | HIGH | IProxyGeneral.sol:325 / ProxyGeneral.sol:91 | Event `EmergencyTransferExecuted` topic-hash drift |
| IFC-003 | HIGH | IBeacon.sol:6 / Beacon.sol:109 | `upgradeImplementation` vs `updateImplementation` |
| IFC-004 | HIGH | ILendingProtocol.sol / MorphoPlugin.sol | ProtocolManager casta a single-tokenCode, MorphoPlugin two-tokenCode → revert |
| IFC-005 | HIGH | IParameterManager.sol:244 / ParameterManager.sol:64 | Event `ParameterRegistered` drift |
| IFC-006 | HIGH | IEmergencyHandler.sol:214 / EmergencyHandler.sol:113 | Event `EmergencyContact*` drift |
| IFC-007 | HIGH | IParameterManagerForModules.sol:6 / ParameterManager.sol | `isPaused()` non implementata |
| IFC-008 | HIGH | ISwapManager.sol:127 / SwapManager.sol:111 | Event `SwapExecuted` drift |
| IFC-009 | HIGH | IProxyGeneral.sol:306 / ProxyGeneral.sol:105 | `TokenDeposited/Withdrawn` indexed string drift |
| IFC-010 | HIGH | ILensAdapter.sol:136 / EulerLensAdapter.sol:882 | `isCircuitBreakerActive` selector inesistente |
| IFC-011 | MEDIUM | IProxyGeneral.sol / ProxyGeneral.sol | 12+ funzioni non implementate |
| IFC-012 | LOW | IProxyGeneral.sol:316 / ProxyGeneral.sol:101 | `RateLimitExceeded` param names inverted |
| IFC-013 | HIGH | IProxyGeneral.sol:323 / ProxyGeneral.sol:85 | `ContractPaused` vs `Paused` |
| IFC-014 | MEDIUM | ILendingProtocol.sol:24 / plugins | Estende `IProtocolManager` non implementato dai plugin |
| IFC-015 | MEDIUM | IEulerRegistry.sol / EulerRegistry.sol | Non dichiara `is IEulerRegistry` |
| IFC-016 | MEDIUM | IProtocolAdapter.sol:143 / EulerRegistry.sol:129 | Event `PositionClosed` collision |
| IFC-017 | MEDIUM | IProtocolAdapter.sol:42 / ILensAdapter.sol:35 | Struct `Position` duplicata |
| IFC-018 | MEDIUM | IMorphoRegistry.sol:47 / MorphoRegistry.sol | Dead surfaces (event/error mai emessi) |
| IFC-019 | MEDIUM | ILensAdapter.sol:87 / MorphoLensAdapter.sol:253 | `availableToWithdraw` formula collateral-2*debt |
| IFC-020 | MEDIUM | ILensAdapter.sol:296 / MorphoVaultLensAdapter.sol:286 | `minHealthFactor` semantica invertita |
| IFC-021 | LOW | ILensAdapter.sol / adapters | Mutability drift `pure` vs `view` |
| IFC-022 | HIGH | ILensAdapter.sol / EulerLensAdapter.sol | Missing `override` (compile hazard) |
| IFC-023 | HIGH | IEulerV2Plugin.sol:120 / EulerV2Plugin.sol:482 | `closePosition(string,string)` missing `override` |
| IFC-024 | HIGH | ISwapManager.sol / SwapManager.sol | Missing `override` su tutti i metodi |
| IFC-025 | MEDIUM | ISwapManager.sol:135 / SwapManager.sol:108 | `SwapRouterUpdated` → `SimpleSwapRouterUpdated` |
| IFC-026 | MEDIUM | ISwapManagerForModules.sol / SwapManager.sol | Non dichiara `is ISwapManagerForModules` |
| IFC-027 | HIGH | UniswapV3Plugin.sol / UniswapV3PluginDirect.sol | Wrapper vs Direct semantica divergente (msg.sender vs proxyGeneral) |
| IFC-028 | MEDIUM | IOracleAdapter.sol:58 / ChainlinkAdapter.sol:337 | `getPrice` view non può emettere event |
| IFC-029 | MEDIUM | IMorphoRegistry.sol:89 / MorphoVaultPlugin.sol:129 | `isVaultApproved` conflate approval+active |
| IFC-030 | LOW | IProtocolAdapter.sol:145 / MorphoVaultPlugin.sol:391 | Event `Deposited/Withdrawn` con literal 'VAULT' |
| IFC-031 | LOW | IProtocolAdapter.sol:98 / plugins | Return name drift `baseAssetObtained` vs `obtained` |
| IFC-032 | LOW | IEulerLensAdapter.sol:35 / adapters | Struct dichiarate mai returned |
| IFC-033 | LOW | IEulerRegistry.sol / IEulerVaultRegistry.sol | Duplicate Euler vault-registry interfaces |
| IFC-034 | LOW | interfaces/*.sol / impls | Eventi mai emessi (HealthChecked, PositionOpened, ecc.) |
| IFC-035 | LOW | interfaces/*.sol / impls | Custom errors dichiarati mai thrown |
| IFC-036 | LOW | plugins/*.sol / IAaveV3Registry.sol | Errori duplicati (InvalidAddress, TokenNotConfigured) |
| IFC-037 | LOW | ISimpleSwap.sol:22 / UniswapV3Plugin.sol:102 | Extra overload `getExpectedOutput(3-arg)` |
| IFC-038 | LOW | plugins/*.sol | Pragma inconsistency 0.8.19 vs 0.8.27 |
| IFC-039 | LOW | IProxyGeneral.sol:285 / ProxyGeneral.sol:28 | Doppio `paused()`/`isPaused()` |
| IFC-040 | MEDIUM | IParameterManager.sol:203 / ParameterManager.sol:791 | `getStringParameter` sempre stringa vuota |
| IFC-041 | MEDIUM | IParameterManager.sol:196 / ParameterManager.sol:787 | `getAddressParameter` narrowing uint256→uint160 |
| IFC-042 | MEDIUM | IProxyGeneral.sol:302 / ProxyGeneral.sol:64 | `LPTokensMinted/Burned` singolare/plurale |
| IFC-043 | MEDIUM | IProtocolManager.sol:130 / ProtocolManager.sol:616 | `getProtocolInfo` arity mismatch |
| IFC-044 | MEDIUM | ITokenManagerForModules.sol:25 / TokenManager.sol:352 | `getAllTokens()` mancante |
| IFC-045 | MEDIUM | MorphoVaultLensAdapter.sol:18 / MorphoVaultPlugin.sol | Ad-hoc `IMorphoVaultPluginView` senza compile enforcement |

---

# Piano di remediation consigliato (ordinato per priorità)

## Sprint 0 — Blocking bugs (deploy blockers)

1. **CORE-001** implementare `ProxyGeneral.emergencyTransfer(address,uint256,address)` con onlyAuthorizedModule + whenPaused + SafeERC20.
2. **PLG-005** correggere `MorphoPlugin._computeHealthFactor` (togliere `WAD` extra al denominatore, importare `SharesMathLib` ufficiale Morpho).
3. **PLG-006** rivedere allocazione sub-account Euler EVC: coerenza tra registry e callback.
4. **CORE-002** aggiungere `require(actualReceived >= minAmountOut)` post-swap in `swapWithBestPlugin`.
5. **CORE-003** revert (o burn proporzionale) se `newBalance < netWithdraw` in `_withdrawInternal`.
6. **PLG-019 / 20 / 21** fixare UniswapV3PluginDirect: propagare `minOut`, `sqrtPriceLimitX96`, `deadline`; usare veramente QuoterV2 in `getExpectedOutput`.
7. **ADP-027 / PLG-030-32 / PLG-33-35** propagare `minOut` end-to-end nei swap dei flash-loan callback ed enforce `maxSlippageBps`.
8. **CORE-005/06/07** riscrivere il flusso ParameterManager (executeParameterChange(uint256) rotto, cancelParameterProposal ignora id, updateMultipleParameters bypassa timelock).
9. **IFC-022/23/24** aggiungere `override` mancanti; dichiarare `is IProxyGeneral`, `is IBeacon`, `is ISwapManager`, `is ISwapManagerForModules`, ecc. dove logico.
10. **IFC-004** allineare firme two-tokenCode di `ILendingProtocol` con `MorphoPlugin` (Morpho ha bisogno di due token — collateral e loan).
11. **ADP-033 / 35** spostare mock in `/mocks/` con `onlyOwner` o `abstract`.

## Sprint 1 — High severity di sistema

12. **ADP-001** integrare Sequencer Uptime Feed Chainlink su Arbitrum.
13. **ADP-002 / 03 / 04** hardening ChainlinkAdapter (bounds check min/maxAnswer, decimal validation strict, circuit breaker stateful).
14. **ADP-030** rimuovere fallback silente 1:1 in `FlashLoanService.getExpectedOutput`.
15. **CORE-012 / 55 / 56** SafeERC20 ovunque, no MAX approve permanenti.
16. **CORE-058** timelock su `Beacon.updateImplementation`.
17. **PLG-42/43/44** alzare `MIN_HEALTH_FACTOR` a ≥ 1.20e18 configurabile via ParameterManager (con ADP-036).
18. **CORE-008 / 09 / 36** access control tightening: `pause()` solo EmergencyHandler+owner, `whenNotPaused` in ProtocolManager, `onlyAuthorizedCaller` distinto.
19. **CORE-010** `emergencyTransferAll` iterare `TokenManager.getActiveTokens()`.
20. **CORE-15** emergency recipient separato dall'owner (cold-safe).
21. **PLG-08 / 09 / 10** i `closeLeverageAtomic` devono inviare i fondi a ProxyGeneral, non a `msg.sender`.
22. **ADP-007** riscrivere `getYieldInfo` Aave con `getReserveData().currentLiquidityRate` invece dell'indice cumulativo.
23. **ADP-011 / 16** riportare LTV reali dal protocollo, no hardcoded 80/83%.
24. **ADP-039** allineare Morpho `toAssetsUp` con VIRTUAL_ASSETS/SHARES ufficiali (SharesMathLib).
25. **PLG-045 / 46** `onFlashLoanReceived` valida `tokens[0]==borrowToken` e aggiunge `nonReentrant`.
26. **PLG-047** rivedere il flow `evc.call(token, approve)` per essere firmato dal sub-account corretto.

## Sprint 2 — Medium & LP experience

27. Correggere event drift (`EmergencyTransferExecuted`, `ParameterRegistered`, `SwapExecuted`, `LPTokensMinted/Burned`, ecc.).
28. **CORE-025 / 64** parametrizzare acceptance threshold e `minLpTokensOut` per user.
29. **CORE-045** timelock/probe su `setOracleAdapter`.
30. **PLG-063/64/66** validazione registry contro il protocollo target (Morpho.isIrmEnabled, Aave.getReserveAToken).
31. **PLG-69** OpenZeppelin Ownable2Step ovunque.
32. **PLG-70/71** upgrade a OpenZeppelin v5 imports.
33. **PLG-83** import shared `IFlashLoanService` da `contracts/interfaces/`.
34. **PLG-062 / 98** `removeMarket` in registries.
35. Standardizzare pragma Solidity (0.8.19 uniforme o 0.8.24 come base OZ v5).
36. `.gitignore` di `*.backup` e rimozione di `SwapManager.sol.backup`.

## Sprint 3 — Low & Info

37. Rimozione dead storage / legacy paths.
38. Sostituzione bubble sort con insertion/heap-select bounded.
39. Pagination su getter unbounded.
40. Cache in-memory di `decimals()` e config statica.
41. `receive()` rescue in LiquidityManager, DepositHelper.
42. Documentazione end-to-end (aggiornare NatSpec).
43. Deprecare o rimuovere fallback `simpleSwapRouter`.

---

---

# APPENDICE — Second pass (NEW-001 … NEW-032)

I 32 finding aggiuntivi trovati nel second pass sono elencati integralmente in `10-additional-findings.md`. Riassunto tabellare qui:

## HIGH (8)

| ID | Area | File | Riga | Titolo (short) |
|----|------|------|------|----------------|
| NEW-001 | MEV / LP accounting | Liquiditymanager.sol | 163-180 | **First-depositor share inflation attack** — nessun minimum-liquidity / virtual shares |
| NEW-002 | MEV | Liquiditymanager.sol | 127-214 | Sandwich deposit senza `minLpTokensOut` — attacker dona base asset a ProxyGeneral prima del deposit vittima |
| NEW-003 | MEV | ValueCalculator.sol | 214-316 | NAV inflation via donazione di **qualsiasi** token attivo (non solo base asset) |
| NEW-004 | Reentrancy | ProxyGeneral.sol | tutte le funzioni state-changing | **ProxyGeneral importa `ReentrancyGuard` ma NESSUNA funzione ha `nonReentrant`** |
| NEW-005 | Storage / Upgrade | Beacon.sol | 109, 302 | Pattern Beacon-lookup **senza migrate**: `updateImplementation` fa perdere TUTTO lo storage runtime del modulo |
| NEW-006 | Access | ProxyGeneral.sol | 363, 380 | `transferToModule` permette a qualsiasi modulo autorizzato di dirottare asset verso qualsiasi altro modulo |
| NEW-007 | Precision / HF | MorphoLensAdapter.sol | 178 | **MorphoLensAdapter._computeMarketHF replica lo stesso bug scala di PLG-005** — monitoring riceve HF 1e18× più basso del reale |
| NEW-008 | Integration | EulerV2Plugin.sol | 1000, 597 | Callback flash-loan opera sul main account mentre il registry allocca un sub-account — `getHealthFactor` inconsistente (variante ampliata di PLG-006) |

## MEDIUM (10)

| ID | Area | File | Riga | Titolo (short) |
|----|------|------|------|----------------|
| NEW-009 | Integration | MorphoRegistry.sol | 242, 212, 233 | `setDefaultVault` non verifica `vault.assetCode`; `removeVault` lascia `_defaultVaults` pointer stale |
| NEW-010 | Griefing | EmergencyHandler.sol | 291, 384 | `emergencyWithdraw()` marca `emergencyExecuted["withdraw"]=true` anche se tutti i transfer sono falliti |
| NEW-011 | Griefing | ProxyGeneral.sol | 320, 249 | `withdrawToken` reverta se il token è disattivato in TokenManager → asset trapped |
| NEW-012 | Access | ProtocolManager.sol | 584 | `updateProtocol` permette swap silenzioso di plugin/lensAdapter senza timelock né validazione (rug-vector) |
| NEW-013 | Misc | SwapManager.sol | 799, 831 | Filtro plugin swap troppo permissivo — anche lending plugin vengono interrogati per quote |
| NEW-014 | Precision | Liquiditymanager.sol | 278-343 | `_withdrawInternal` calcola `withdrawFee` sull'ammontare pre-clamp — fee effettiva > `withdrawFee%` se clamp scatta |
| NEW-015 | Griefing | Beacon.sol | 205, 227 | `freezeModule` di un modulo critico blocca l'intero sistema (nessun bypass read-only) |
| NEW-016 | Precision | FlashLoanService.sol | 322-335 | `_estimateViaTokenManager` cross-rate rischio overflow con token high-decimals + prezzi grandi |
| NEW-017 | Precision | ChainlinkAdapter.sol | 441 | Underflow revert su `block.timestamp - updatedAt` se feed pubblica un timestamp futuro |
| NEW-018 | Access | EmergencyHandler.sol | 291 | **`emergencyWithdraw()` no `whenPaused` — owner rug backdoor una volta che CORE-001 sarà fixed** |
| NEW-019 | Griefing | EmergencyHandler.sol | 792, 872 | `createAssetSnapshot` no access control + `getAllSnapshots` unbounded → attaccante può DoS via spam |

## LOW (13)

| ID | Area | File | Riga | Titolo (short) |
|----|------|------|------|----------------|
| NEW-020 | Precision | AaveV3Plugin.sol | 356 | `repay` approva 1% in eccesso → residuo allowance dormant |
| NEW-021 | Griefing | ChainlinkAdapter.sol | 292 | `setTargetDenomination` cambia semantica globale senza revalidare feeds |
| NEW-022 | Griefing | FlashLoanService.sol | 383 | `_isRegisteredPlugin` O(n) sui moduli — gas degrada linearmente |
| NEW-023 | Misc | MorphoVaultPlugin.sol | 217, 414 | `emergencyWithdrawAll` fa `delete activeVaults` anche se redeem è fallito |
| NEW-024 | Misc | ProxyGeneral.sol | 244, 320 | Nessuna cache per base asset resolution → ~15k gas addizionali per operazione |
| NEW-025 | Misc | UniswapV3PluginDirect.sol | 143, 201 | `deadline: block.timestamp` è tautologico — deadline di fatto inefficace |
| NEW-026 | Precision | Liquiditymanager.sol | 279 | `deposit` round-down favorisce pool ma senza `minLpTokensOut` per l'utente |
| NEW-027 | Griefing | DepositHelper.sol | 35 | `depositETH` con `weth` immutable si rompe se Beacon aggiorna BASE_ASSET |
| NEW-028 | Misc | ValueCalculator.sol | 214, 261 | `getTotalPoolValue` zero-silent su token failure → attack scenario di NAV understated |
| NEW-029 | Misc | AaveV3Plugin.sol | 341 | Sentinel `amount==0` per repay-all divergente tra plugin (Aave/Morpho/Euler comportamenti diversi) |
| NEW-030 | Precision | Liquiditymanager.sol | 776 | `checkWithdrawLimits` bucket influenzabile da validator timestamp manipulation |
| NEW-031 | Access | SwapManager.sol | 1246 | `setActiveSwapPlugin` non verifica interfaccia `ISimpleSwap` |
| NEW-032 | Misc | ProxyGeneral.sol | 704 | `fallback() external payable` — payable inutile, gas wasted |

## Piano di remediation aggiornato

**Sprint 0 (deploy blockers) aggiunge:**

- **NEW-001 / NEW-002 / NEW-003** (share inflation trilogy): implementare minimum-liquidity mint (Uniswap V2 style) O virtual assets/shares (OZ ERC4626 `_decimalsOffset`), aggiungere `minLpTokensOut` a `deposit()`, spostare da `balanceOf`-based accounting a **internal `totalDeposited` tracking**.
- **NEW-004**: aggiungere `nonReentrant` a tutte le funzioni state-changing di `ProxyGeneral` (`mint`, `burn`, `transferFunds`, `withdrawToken`, `depositToken`, `approveSpender`, `transferToModule`, `transferFromModule`, `emergencyTransferAll`).
- **NEW-005**: documentare esplicitamente "Beacon-lookup, non-upgrade"; OPPURE implementare `migrateFrom(address oldImpl)` in ogni modulo stateful; OPPURE migrare a `UUPS`/`TransparentUpgradeableProxy` con storage slots ERC-1967.
- **NEW-007**: correggere la stessa formula scala HF in MorphoLensAdapter (identica a PLG-005) — dashboard/monitoring altrimenti scambia posizioni sane per liquidazioni imminenti.
- **NEW-018**: aggiungere `require(emergencyState.isActive, "Emergency not active")` a `emergencyWithdraw()` — attualmente è mascherata da CORE-001, ma diventerà backdoor rug quando CORE-001 sarà fixed.

**Sprint 1 aggiunge:**

- NEW-006 (transferToModule restringere a ProtocolManager only)
- NEW-008 (Euler EVC main vs sub — decidere Opzione A o B)
- NEW-009 (MorphoRegistry defaultVault coherence)
- NEW-012 (updateProtocol timelock)

**Sprint 2 aggiunge:** NEW-010 → NEW-019 e le correzioni post-verifica.

**Sprint 3 aggiunge:** NEW-020 → NEW-032.

---

**Fine ISSUES.md — versione 2026-07-15 rev. 2**
