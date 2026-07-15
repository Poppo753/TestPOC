# Audit TestPOC `/contracts` — Enterprise Review

**Date:** 2026-07-14 → 2026-07-15
**Scope:** `C:/Personal/TestPOC/contracts/**`
**Esclusioni:** `plugins/old/`, file con nome `dolomite`/`gmx`, `*.backup`
**Language:** Solidity ^0.8.19 / ^0.8.27
**Total LOC in scope:** 23 546

---

## Deliverable

I documenti in questa cartella sono organizzati come segue:

| # | File | Contenuto |
|---|------|-----------|
| 00 | [00-README.md](00-README.md) | Questo indice + executive summary |
| 01 | [01-core-architecture.md](01-core-architecture.md) | Architettura core: topologia, ruoli, storage layout, upgradability, invariants |
| 02 | [02-core-functions-catalog.md](02-core-functions-catalog.md) | Catalogo funzione-per-funzione dei 10 contratti core |
| 03 | [03-plugins-architecture.md](03-plugins-architecture.md) | Architettura di ogni plugin (Aave/Euler/Morpho/Uniswap) |
| 04 | [04-plugins-flows.md](04-plugins-flows.md) | Sequence diagrams testuali per deposit/withdraw/borrow/repay/leverage/flash-loan |
| 05 | [05-adapters-and-services.md](05-adapters-and-services.md) | Adapters (Chainlink, Lens) e Services (FlashLoan) |
| 06 | [06-oracle-and-math.md](06-oracle-and-math.md) | Analisi matematica: HF, LTV, unit, decimals, precision loss |
| 07 | [07-interfaces-catalog.md](07-interfaces-catalog.md) | Tabella interface → impl(s) → callers → stato |
| 08 | [08-cross-contract-consistency.md](08-cross-contract-consistency.md) | Findings di drift signature/event/error tra interfacce e impl |
| 09 | [09-verification-report.md](09-verification-report.md) | **Verification pass rev. 2** — 21 confirmed / 1 FP / 3 partial su 25 HIGH campionati |
| 10 | [10-additional-findings.md](10-additional-findings.md) | **Second pass rev. 2** — 32 nuovi finding non trovati nel primo pass |
| 11 | [11-security-testing-suite/00_Stato_e_Strategia_Suite_Sicurezza.md](11-security-testing-suite/00_Stato_e_Strategia_Suite_Sicurezza.md) | Strategia revisionata e checklist per static analysis, fuzz, invariant, symbolic testing e CI |
| 99 | [ISSUES.md](ISSUES.md) | **Issue register consolidato — 320 findings (rev. 2)** |

---

## Executive Summary

### Verdetto

**Il codice NON è pronto per il deploy enterprise/mainnet.** Sono presenti (dopo verification + second pass):

- **5 finding CRITICAL** che rendono funzioni intere non funzionanti o completamente esposte ad attacco;
- **60 finding HIGH** su MEV, access-control, math health-factor, oracle, coerenza interfaccia/impl, share inflation attack, reentrancy globale;
- **111 MEDIUM** di consolidamento (governance, USDT-compat, timelock, event drift);
- **99 LOW** e **40 INFO** di code-quality e docs.

La rev. 2 include:
- **Verification pass**: 21/25 HIGH campionati confermati, 1 falso positivo (PLG-006), 3 severity aggiustate.
- **Second pass**: 32 nuovi finding non trovati nel primo pass, di cui 8 HIGH tra cui il **classic share-inflation attack** (NEW-001), **ProxyGeneral senza `nonReentrant` da nessuna parte** (NEW-004), **Beacon-lookup senza migrate** (NEW-005), **stesso bug HF replicato in MorphoLensAdapter** (NEW-007), **`emergencyWithdraw` senza `whenPaused`** che diventa rug backdoor dopo il fix di CORE-001 (NEW-018).

### 5 blocking bugs prioritari

1. **CORE-001** `IProxyGeneral.emergencyTransfer(address,uint256,address)` **NON è implementata** in ProxyGeneral (solo `emergencyTransferAll` esiste). Il path `EmergencyHandler.emergencyWithdraw` chiama un selector inesistente e fallisce silenziosamente per ogni token. In una vera emergenza, non è possibile drenare i token non-base dal pool.
2. **CORE-002** `SwapManager.swapWithBestPlugin` verifica `minAmountOut` solo contro il quote pre-swap, mai contro l'actual amount ricevuto → sandwich attack trivial.
3. **CORE-003** `LiquidityManager.withdraw` clamps `netWithdraw` al balance disponibile ma brucia le shares complete → LP perde valore silenziosamente.
4. **PLG-005** `MorphoPlugin._computeHealthFactor` ha uno scaling errato: divide per `WAD` in più → HF calcolato molto sotto la realtà → `openLeverageAtomic` reverte SEMPRE su Morpho.
5. **PLG-006** `EulerV2Plugin` alloca `subAccountId` nel Registry ma le callback usano `address(this)` (main account, sub 0). L'architettura sub-account è pensata per posizioni parallele ma non è mai usata → impossibile aprire due leverage con borrow-vault diverso in parallelo.

### Rischi sistemici

- **MEV / slippage**: `minOut` non propagato in flash-loan callback (`AaveV3Plugin`, `EulerV2Plugin`, `MorphoPlugin`, `FlashLoanService`, `UniswapV3PluginDirect`). `maxSlippageBps` stored ma mai enforced.
- **Owner compromise = takeover in 1 tx**: `Beacon.updateImplementation` senza timelock; `SwapManager` MAX-uint approve permanenti ai plugin; ParameterManager `setParameterEmergency(bytes)` senza bounds check.
- **Oracle**: Chainlink senza Sequencer Uptime Feed su Arbitrum; nessun bound min/maxAnswer; circuit breaker inerte.
- **USDT-incompatibile**: `IERC20.approve/transfer/transferFrom` raw in ProxyGeneral e UniswapV3PluginDirect.
- **Governance**: `updateMultipleParameters` bypassa timelock, `cancelParameterProposal` ignora l'ID, `executeParameterChange(uint256)` sempre reverte.
- **Emergency**: recipient hardcoded a `owner()` (se compromesso → drain verso l'attacker); `emergencyTransferAll` sweepa solo base+ETH.

### Coerenza interfacce

Molte impl **non dichiarano `is IX`** anche quando conformi (ProxyGeneral, Beacon, TokenManager, ValueCalculator, ProtocolManager, EulerRegistry, SwapManager per `ISwapManagerForModules`). Questo maschera drift a compile-time. Diverse funzioni `override` sono mancanti (EulerLensAdapter, EulerV2Plugin, SwapManager) — comportamento indefinito su un futuro upgrade dell'interfaccia.

---

## Metodologia

L'audit è stato eseguito il 2026-07-14/15 con lettura integrale di ogni file (23 546 LOC), suddiviso in 4 stream paralleli:

- **CORE** (10 contratti): SwapManager, LiquidityManager, EmergencyHandler, TokenManager, ValueCalculator, ProtocolManager, ParameterManager, ProxyGeneral, Beacon, DepositHelper.
- **PLUGINS** (9 contratti): AaveV3Plugin, EulerV2Plugin, MorphoPlugin, MorphoVaultPlugin, UniswapV3Plugin, UniswapV3PluginDirect, AaveV3Registry, EulerRegistry, MorphoRegistry.
- **ADAPTERS + SERVICES** (9 contratti): ChainlinkAdapter, 4 Lens Adapter, FlashLoanService, mocks nel root.
- **INTERFACES** (35+ file): coerenza tra ~35 interfacce e le rispettive impl.

Per ogni contratto è stata verificata: access control, reentrancy, math/aritmetica, storage/upgradability, external calls, approve pattern, oracle usage, slippage/MEV, flash loan callback, emergency/pause, event emissions, interface conformità, coerenza logica dei flussi, fee handling, health factor.

## Come consumare questo audit

1. **Team leadership**: leggere [ISSUES.md](ISSUES.md) sezione "Verdetto" e "Piano di remediation" per priorità.
2. **Sviluppatori**: partire da [ISSUES.md](ISSUES.md), aprire ogni ID nel proprio scope, e correlare con [01](01-core-architecture.md)-[08](08-cross-contract-consistency.md) per contesto architetturale.
3. **Auditor esterni futuri**: [07-interfaces-catalog.md](07-interfaces-catalog.md) è il punto di ingresso migliore per capire le API. [06-oracle-and-math.md](06-oracle-and-math.md) le formule critiche.

## Riferimenti esterni

- Chainlink L2 Sequencer Uptime Feed (Arbitrum): `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`
- Morpho Blue SharesMathLib: https://github.com/morpho-org/morpho-blue
- Aave V3 Docs — reserve rates: https://docs.aave.com/developers/core-contracts/pool
- Euler V2 EVC Docs: https://docs.euler.finance/
- Uniswap V3 QuoterV2: https://docs.uniswap.org/contracts/v3/reference/periphery/lens/QuoterV2

---

**Auditor:** analisi automatica multi-agent (4 stream in parallelo), consolidata il 2026-07-15.
