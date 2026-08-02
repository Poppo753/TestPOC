# C1-08 + C1-04 — Guida di migrazione dei test (Sub-fase G1)

> I ~55 test Hardhat (`test/e2e/**`, `test/integration/**`, `test/automation/**`) usano le
> vecchie firme e il pattern `plugin.connect(owner)` che il refactor ha eliminato apposta.
> **Non girano in questo ambiente** (serve `ARBITRUM_RPC_URL` per il fork), quindi vanno
> aggiornati e ri-eseguiti dove il fork è disponibile. Questa guida elenca ogni cambio di API.
> Verifica già fatta senza fork: `forge build` + `hardhat compile` verdi, Foundry unit 7/7
> (`test/foundry/unit/UniversalInterface.t.sol`), Euler sotto EIP-170.

## 1. ProtocolManager — firme cambiate

| Prima | Dopo |
|-------|------|
| `pm.deposit(protocol, token, amount)` | `pm.supplyCollateral(protocol, collateral, loan, amount)` |
| `pm.withdraw(protocol, token, amount)` | `pm.withdrawCollateral(protocol, collateral, loan, amount)` |
| `pm.borrow(protocol, token, amount)` | `pm.borrow(protocol, collateral, loan, amount)` |
| `pm.repay(protocol, token, amount)` | `pm.repay(protocol, collateral, loan, amount)` |
| `pm.getDebt(protocol, token)` | `pm.getDebt(protocol, collateral, loan)` |
| `pm.getHealthFactor(protocol)` | `pm.getHealthFactor(protocol, collateral, loan)` |

- **Pooled (Aave/Euler):** `collateral` = token fornito/collaterale; `loan` = token preso in prestito. Per un semplice supply usare `loan == collateral`.
- **Isolated (Morpho):** `(collateral, loan)` identifica il mercato.
- **Supply-only (MorphoVault/InterVault):** usare `supplyCollateral/withdrawCollateral` con `loan == collateral`. `borrow/repay` **revertano** `UnsupportedOperation`.

## 2. Access control — serve un OPERATORE

Le funzioni sopra sono ora `onlyOperator` (owner **o** VAC autorizzata), non più `onlyOwner`.
Nei test, dopo il deploy:
```ts
await protocolManager.addOperator(await vac.getAddress()); // owner-only
// poi la vac può operare:
await protocolManager.connect(vac).borrow("Aave", "WETH", "USDC", amount);
```
L'owner resta sempre operatore (non serve auto-aggiungerlo).

## 3. Chiamate dirette ai plugin — RIMOSSE

Il bypass `owner()` nei plugin è stato tolto (PLG-084). **Non funziona più:**
```ts
await aavePlugin.connect(owner).borrow("USDC", amount);   // ❌ revert OnlyProtocolManager
```
Instradare SEMPRE via ProtocolManager:
```ts
await protocolManager.connect(operator).borrow("Aave", "WETH", "USDC", amount); // ✅
```
Unica eccezione owner-diretta (escape hatch, incident response):
```ts
await plugin.connect(owner).emergencyClosePosition(collateral, loan); // onlyOwner
```

## 4. Emergency — No-drain (le funzioni di drain non esistono più)

RIMOSSE: `EmergencyHandler.emergencyWithdraw()` (×2 overload), `emergencyTransfer`,
`ProxyGeneral.emergencyTransferAll`. **I test che le chiamano vanno riscritti** sul nuovo flusso:
```ts
// 1. pausa (owner o emergency contact)
await emergencyHandler.connect(contact).emergencyPause("reason");
// 2. unwind di TUTTE le posizioni -> base asset in custody (owner o contact)
await protocolManager.connect(contact).emergencyUnwindAll();
// 3. gli LP ritirano la loro quota pro-rata (NESSUN drain verso owner)
await liquidityManager.connect(lp).withdraw(shares);
```
Test da riscrivere: `test/e2e/EmergencyOnLivePosition.e2e.test.ts`, `test/unit/EmergencyHandler*.test.ts`,
`test/integration/system/Emergency.integration.test.ts`, `scripts/legacy/emergency/**`,
`scripts/legacy/OId/emergencyWithdraw.EResV.ts`.

## 5. Nuovi test user-journey da aggiungere (dove c'è il fork)

- **Operatore vs LP:** un operatore apre/chiude posizioni via ProtocolManager su ogni plugin; un LP NON può toccare ProtocolManager (solo deposit/withdraw shares).
- **Owner non può drenare:** verificare che non esista un path che manda custody all'owner.
- **Unwind sort-by-risk:** posizioni con HF diverso → la più rischiosa chiusa per prima; withdrawal si ferma a target; emergency chiude tutto. (Lo swap collaterale→base per collaterali non-base arriva con C1-06.)

## 6. Checklist file-per-file (55 file)

Priorità (più impattati dalle firme):
1. `test/e2e/Aave.BorrowRepay.e2e.test.ts`, `Euler.BorrowRepay.e2e.test.ts` → borrow/repay pair + addOperator.
2. `test/e2e/*.FullCycle.*`, `*.BaseAsset.*` → supply/withdraw pair.
3. `test/integration/{aave,euler,morpho}/*` → chiamate via ProtocolManager (no `plugin.connect(owner)`).
4. `test/e2e/EmergencyOnLivePosition.e2e.test.ts` + `test/unit/EmergencyHandler*` → flusso No-drain.
5. `test/automation/VaultAutomationController.test.ts`, `InterVaultAutomation.test.ts` → la VAC deve essere `addOperator`.
6. Dolomite (`test/**/dolomite/**`): **escluso dallo scope** (usa ancora ILendingProtocol legacy). Non toccare.

> Nota: la migrazione completa dei 55 file va fatta e ri-eseguita su fork Arbitrum. La correttezza
> delle nuove behavior è già coperta a livello unit (Foundry) senza fork.
