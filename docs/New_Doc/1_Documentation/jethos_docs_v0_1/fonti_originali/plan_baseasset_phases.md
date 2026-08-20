Let me re-examine the exact code that needs to change for Phase 0 to produce a concrete, step-by-step implementation plan.    

Analyze LiquidityManager deposit/withdraw

Analyze ProxyGeneral base asset refs

Analyze ValueCalculator and SwapManager WETH refs

Analyze plugin _resolveToken and closePositions

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/Liquiditymanager.sol)

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/ProxyGeneral.sol)

Searched for regex `WETH|weth|wethAddress|1e18` (`**/TestSmartContract/contracts/ValueCalculator.sol`), 26 results

Searched for regex `WETH|weth|keccak256\(bytes\("WETH"\)` (`**/TestSmartContract/contracts/SwapManager.sol`), 82 results

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/TokenManager.sol#120-120), lines 120 to 140

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/plugins/AaveV3Plugin.sol#1-1), lines 1 to 500

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/plugins/MorphoPlugin.sol#1-1), lines 1 to 500

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/plugins/EulerV2Plugin.sol#1-1), lines 1 to 500

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/IProtocolAdapter.sol)

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/ILendingProtocol.sol)

Searched for regex `function _resolveToken|function closePositionsForWeth` (`**/*.sol`), 11 results

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/ValueCalculator.sol#1-1), lines 1 to 250

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/ValueCalculator.sol#500-500), lines 500 to 580

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/SwapManager.sol#1-1), lines 1 to 100

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/SwapManager.sol#530-530), lines 530 to 700

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/SwapManager.sol#800-800), lines 800 to 1010

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/SwapManager.sol#1100-1100), lines 1100 to 1380

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/plugins/AaveV3Plugin.sol#879-879), lines 879 to 900

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/plugins/AaveV3Plugin.sol#442-442), lines 442 to 462

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/plugins/EulerV2Plugin.sol#1205-1205), lines 1205 to 1226

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/plugins/EulerV2Plugin.sol#1353-1353), lines 1353 to 1373

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/plugins/MorphoPlugin.sol#1013-1013), lines 1013 to 1034

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/plugins/MorphoPlugin.sol#529-529), lines 529 to 549

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/SwapManager.sol#1450-1450), lines 1450 to 1550

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/IProtocolAdapter.sol#86-86), lines 86 to 102

Read [](file:///c%3A/Users/loren/AppData/Roaming/Code/User/workspaceStorage/9d128bb2bab3fe9341327cda0c37c9d7/GitHub.copilot-chat/chat-session-resources/c06cbdac-1235-40ff-9065-77a3a6fb032f/toolu_bdrk_019fSUFBhbo4LBWYGRReg4LE__vscode-1775642829530/content.txt#1-1), lines 1 to 200

Read [](file:///c%3A/Users/loren/AppData/Roaming/Code/User/workspaceStorage/9d128bb2bab3fe9341327cda0c37c9d7/GitHub.copilot-chat/chat-session-resources/c06cbdac-1235-40ff-9065-77a3a6fb032f/toolu_bdrk_01YMSUHFLCUdjbD2N3jNzSS9__vscode-1775642829529/content.txt#1-1), lines 1 to 200

Read [](file:///c%3A/Users/loren/AppData/Roaming/Code/User/workspaceStorage/9d128bb2bab3fe9341327cda0c37c9d7/GitHub.copilot-chat/chat-session-resources/c06cbdac-1235-40ff-9065-77a3a6fb032f/toolu_bdrk_01V9jsRZb6PDCrPna3HHm1LJ__vscode-1775642829531/content.txt)

Now I have every line that needs changing. Let me also check the interfaces and ProtocolManager for the `closePositionsForWeth` call chain.  

Explore ProtocolManager closePositionsForWeth

Explore ILiquidityManager interface

Searched for regex `WETH|weth` (`**/TestSmartContract/contracts/ProtocolManager.sol`), 20 results

Searched for regex `WETH|weth` (`**/TestSmartContract/contracts/EmergencyHandler.sol`), 20 results

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/IProtocolAdapter.sol)

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/ILiquidityManager.sol)

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/IProtocolManager.sol)

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/ProtocolManager.sol#792-792), lines 792 to 830

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/EmergencyHandler.sol#1-1), lines 1 to 400

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/ProtocolManager.sol#160-160), lines 160 to 225

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/ProtocolManager.sol#1-1), lines 1 to 100

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/EmergencyHandler.sol#285-285), lines 285 to 382

Ora ho mappato ogni singola riga. Ecco il piano di implementazione concreto per la FASE 0.

---

## Piano di Implementazione — FASE 0: Base Asset Abstraction

### Strategia: Bottom-Up in 7 Step

Parto dalle fondamenta (interfacce) e salgo verso i contratti concreti. Ogni step è compilabile e testabile indipendentemente.

---

### Step 1 — Interfacce (nessuna dipendenza)
*Modifica le firme. Tutto il resto si adegua.*

**A) IProtocolAdapter.sol**
- Rinominare `closePositionsForWeth(uint256 targetWethAmount) → closePositionsForBaseAsset(uint256 targetAmount)`
- Rinominare return: `wethObtained → baseAssetObtained`
- Rinominare campo struct: `wethReturned → baseAssetReturned` (linea 56)

**B) IProtocolManager.sol**
- Stessa rinomina: `closePositionsForWeth → closePositionsForBaseAsset` (linee 162-167)
- Return: `wethObtained → baseAssetObtained`, `totalPositionsClosed` resta

**C) ILiquidityManager.sol**
- `deposit() external payable` → `deposit(uint256 amount) external` (rimuovere `payable`, aggiungere parametro)
- Rinominare: `wethBalance` nel struct PoolStats (linea 128) → `baseAssetBalance`
- Rinominare eventi: `ProtocolPositionsClosedForWeth` → `ProtocolPositionsClosedForBaseAsset` (linea 168), `LiquidTokenSwappedForWeth` → `LiquidTokenSwappedForBaseAsset` (linea 175)

**D) Aggiungere a IBeacon.sol** (opzionale, convenience):
- `function getBaseAsset() external view returns (address)` — wrapper per `getImplementation("BASE_ASSET")`

---

### Step 2 — Beacon.sol (fondamenta)
*Registra il concetto di BASE_ASSET.*

- Nessun cambio al codice di Beacon.sol — è già generico (`getImplementation(string)`)
- **Cambio di deployment**: invece di registrare `"WETH"` → indirizzo WETH, registri `"BASE_ASSET"` → indirizzo del token base (WETH, o USDC, o WBTC)
- `"WETH"` resta registrato come riferimento per i contratti che hanno ancora bisogno dell'indirizzo WETH specifico (es. DepositHelper)
- Nello script di deploy: `beacon.updateImplementation("BASE_ASSET", wethAddress)` per il pool ETH, `beacon.updateImplementation("BASE_ASSET", usdcAddress)` per il pool USDC

---

### Step 3 — TokenManager.sol (1 riga critica)
*Cambia l'esclusione da WETH a BASE_ASSET.*

**Linea ~120**: da
```solidity
address wethAddress = IBeacon(beacon).getImplementation("WETH");
require(_tokenAddress != wethAddress, "Cannot add WETH as token");
```
a
```solidity
address baseAsset = IBeacon(beacon).getImplementation("BASE_ASSET");
require(_tokenAddress != baseAsset, "Cannot add base asset as token");
```

Stesso cambio nella funzione legacy (~linea 145). Rimuovere l'import di IWETH se non più necessario.

---

### Step 4 — ProxyGeneral.sol (3 aree)
*Generalize WETH references a BASE_ASSET.*

**A) withdrawToken() e depositToken()** (linee 305-318, 347-360):
Da
```solidity
if (keccak256(bytes(tokenCode)) == keccak256(bytes("WETH"))) {
    tokenAddress = IBeacon(beacon).getImplementation("WETH");
```
A — **introdurre un helper interno `_resolveToken()`** che centralizza la risoluzione:
```solidity
function _resolveToken(string memory tokenCode) internal view returns (address) {
    string memory baseAssetCode = _getBaseAssetCode();
    if (keccak256(bytes(tokenCode)) == keccak256(bytes(baseAssetCode))) {
        return IBeacon(beacon).getImplementation("BASE_ASSET");
    }
    address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
    return ITokenManagerForModules(tokenManager).getTokenAddress(tokenCode);
}
```

**B) emergencyTransferAll()** (linee 610-618): Cambiare `getImplementation("WETH")` → `getImplementation("BASE_ASSET")`

**C) receive()** (linea 720): Mantenere — serve ancora se il DepositHelper deve inviare ETH per wrapping, o per protocolli che restituiscono ETH nativo. Ma aggiungere commento che è per uso specifico, non per il flusso base asset.

**D) Nuova state variable**: `string public baseAssetCode` — settata nel constructor o via Beacon. Serve per i confronti di stringa. Alternativa: registrare nel Beacon anche `"BASE_ASSET_CODE"` → "WETH" / "USDC" / "WBTC".

---

### Step 5 — LiquidityManager.sol (riscrittura maggiore)
*Il cuore del cambiamento.*

**A) Rimuovere import IWETH.** Aggiungere import SafeERC20:
```solidity
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
using SafeERC20 for IERC20;
```

**B) deposit()** (linee 130-217) — riscrittura completa:
- Rimuovere `payable`
- Aggiungere parametro `uint256 amount`
- Rimuovere `msg.value`, usare `amount` ovunque
- Rimuovere `weth.deposit{value: netDeposit}()` (non serve più wrapping)
- Sostituire `weth.transfer(proxyGeneral, netDeposit)` con:
  ```solidity
  IERC20(baseAsset).safeTransferFrom(msg.sender, proxyGeneral, netDeposit);
  ```
- Fee: da `.call{value: feeAmount}` a `IERC20(baseAsset).safeTransferFrom(msg.sender, feeRecipient, feeAmount)` (o prelevare `amount` tutto e poi trasferire fee separatamente)
- Post-deposit validation: cambiare WETH balance check a base asset balance check

**C) _withdrawInternal()** (linee 244-400) — riscrittura:
- Rimuovere `weth.withdraw(totalWethNeeded)` (no unwrapping)
- Rimuovere `msg.sender.call{value: netWithdraw}` → `IERC20(baseAsset).safeTransfer(msg.sender, netWithdraw)`
- Fee: da `.call{value: feeAmount}` a `IERC20(baseAsset).safeTransfer(feeRecipient, feeAmount)`
- Tutti i `wethAddress` → `baseAsset` da Beacon `"BASE_ASSET"`
- _executeAutomaticSwap: cambiare target da WETH a base asset

**D) receive() / fallback()** (linee 891-898):
- `receive()`: mantenere ma solo per compatibilità DepositHelper. Aggiungere commento.

**E) Constructor** (linee 104-113):
- `withdrawLimits.hourlyLimit = 100 ether` → valore parametrizzato o lasciare generico (tanto sarà override da ParameterManager)

**F) _swapLiquidTokensForWeth() e _closeProtocolPositionsForWeth()**:
- Rinominare a `_swapLiquidTokensForBaseAsset()` e `_closeProtocolPositionsForBaseAsset()`
- Target swap: da `"WETH"` a base asset code

---

### Step 6 — ValueCalculator.sol + SwapManager.sol (valutazione e swap)

**A) ValueCalculator.sol** (19 righe):
- Linea 213: `getImplementation("WETH")` → `getImplementation("BASE_ASSET")`
- Linea 216: `IWETH(wethAddress).balanceOf(proxyGeneral)` → `IERC20(baseAsset).balanceOf(proxyGeneral)`
- Linea 230: `pricePerToken: 1e18` → leggere prezzo reale dall'oracle (o 1:1 calcolato dinamicamente in base ai decimali del base asset)
- Linea 227: `tokenCode: "WETH"` → base asset code
- Linea 527: skip WETH → skip base asset code
- Rimuovere import IWETH, usare IERC20

**B) SwapManager.sol** (82 riferimenti — il più laborioso):
- Tutti i `keccak256(bytes("WETH"))` → confronto con base asset code (letto dal Beacon o cached)
- `_swapToWETH()` → `_swapToBaseAsset()`
- `_swapFromWETH()` → `_swapFromBaseAsset()`
- `getTokenWETHPrice()` → `getTokenBaseAssetPrice()`
- Validation: `spendTokenIsWeth` → `spendTokenIsBaseAsset`
- Gas estimation: `isWethSwap` → `isBaseAssetSwap`
- Suggerimento: **cachare** `baseAssetCode` come state variable per evitare lettura Beacon ad ogni swap

---

### Step 7 — Plugin + ProtocolManager + EmergencyHandler (adeguamento)

**A) 3 Plugin** (AaveV3, EulerV2, Morpho) — stesso pattern per tutti:

`_resolveToken()`: da
```solidity
if (keccak256(bytes(tokenCode)) == keccak256(bytes("WETH"))) {
    return IBeacon(beacon).getImplementation("WETH");
}
```
a
```solidity
if (keccak256(bytes(tokenCode)) == keccak256(bytes(baseAssetCode))) {
    return IBeacon(beacon).getImplementation("BASE_ASSET");
}
```

`closePositionsForWeth()` → `closePositionsForBaseAsset()`:
- Aave (linea 442): `_resolveToken("WETH")` → `_resolveToken(baseAssetCode)`
- Euler (linea 1353): `getImplementation("WETH")` → `getImplementation("BASE_ASSET")`
- Morpho (linea 529): `_resolveToken("WETH")` → `_resolveToken(baseAssetCode)` + filtro mercati per collateral = base asset

Ogni plugin avrà bisogno di `baseAssetCode` — o lo legge dal Beacon, o lo riceve nel constructor.

**B) ProtocolManager.sol** (linee 792-830):
- `closePositionsForWeth()` → `closePositionsForBaseAsset()`
- `IProtocolAdapter(info.plugin).closePositionsForWeth(stillNeeded)` → `.closePositionsForBaseAsset(stillNeeded)`
- Evento: `PositionsClosedForWeth` → `PositionsClosedForBaseAsset`

**C) EmergencyHandler.sol** (16 riferimenti):
- `getImplementation("WETH")` → `getImplementation("BASE_ASSET")`
- `tokenCode: "WETH"` → base asset code
- `"WETH withdrawal"` → `"Base asset withdrawal"`

---

### Step 8 (Nuovo) — DepositHelper.sol
*Contratto wrapper per UX ETH nativo — solo per pool WETH.*

```
~50 righe:
- constructor(beacon, wethAddress, liquidityManagerAddress)
- depositETH() payable: weth.deposit{value}, weth.approve(LM), LM.deposit(amount), trasferisce LP a msg.sender
- withdrawETH(shares): LM.withdraw(shares) → riceve WETH → weth.withdraw() → invia ETH a msg.sender
- receive() external payable (per ricevere ETH da WETH.withdraw)
```

---

### Ordine di compilazione

```
Step 1 (interfacce)  ──►  Step 2 (Beacon deploy config)
        │
        ▼
Step 3 (TokenManager)  ──parallelizzabile──►  Step 4 (ProxyGeneral)
        │                                           │
        ▼                                           ▼
Step 5 (LiquidityManager)  ◄──── dipende da ────  Step 6 (ValueCalc + SwapManager)
        │
        ▼
Step 7 (Plugin + ProtocolManager + EmergencyHandler)
        │
        ▼  
Step 8 (DepositHelper — nuovo, indipendente)
```

---

### Verifica

1. **Compilazione**: `npx hardhat compile` — zero errori dopo ogni step
2. **Test ETH pool**: i test esistenti (fork) adattati per usare WETH come base asset via ERC20 approve+deposit (non più msg.value). Il DepositHelper testato separatamente
3. **Test USDC pool**: nuovi test fork con USDC come base asset (slot 9 su Arbitrum per funding), stessi scenari: deposit, withdraw, swap, protocol interactions
4. **Test WBTC pool**: stessi test con WBTC (8 decimali)
5. **Edge case decimali**: deposito 1 USDC (1e6), deposito 0.00001 WBTC (1e3), precision delle share
6. **Emergency path**: emergenza completa con tutti e 3 i base asset types

---

### Conta lavoro totale

| Contratto | Righe da cambiare (stima) | Complessità |
|---|---|---|
| Interfacce (4 file) | ~15 righe | Bassa |
| TokenManager | ~4 righe | Bassa |
| ProxyGeneral | ~30 righe + nuova funzione `_resolveToken` | Media |
| LiquidityManager | ~100 righe (riscrittura deposit/withdraw) | **Alta** |
| ValueCalculator | ~20 righe | Media |
| SwapManager | ~82 riferimenti da aggiornare | **Alta** (volume) |
| 3 Plugin | ~15 righe ciascuno = ~45 | Media |
| ProtocolManager | ~15 righe | Bassa |
| EmergencyHandler | ~16 righe | Bassa |
| DepositHelper (nuovo) | ~50 righe | Media |
| **Totale** | **~370 righe** | — |

Il grosso del lavoro è: LiquidityManager (riscrittura logica) e SwapManager (82 rename, meccanico ma voluminoso). Il resto sono sostituzioni pattern dirette.
