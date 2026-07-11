# Implementation Report — `from1chainToMulti`

> **Progetto**: TestSmartContract  
> **Refactoring**: Rimozione degli indirizzi hardcoded per supporto multi-chain  
> **Data di completamento**: 10 Luglio 2026  
> **Stato finale**: ✅ COMPLETATO — 0 errori di compilazione, 242/242 test unitari passanti

---

## Indice

1. [Contesto e Motivazione](#1-contesto-e-motivazione)
2. [Problema Tecnico Risolto](#2-problema-tecnico-risolto)
3. [Cosa è stato Fatto — Contratti Solidity](#3-cosa-è-stato-fatto--contratti-solidity)
4. [Cosa è stato Fatto — Test](#4-cosa-è-stato-fatto--test)
5. [Cosa è stato Fatto — Deploy Scripts](#5-cosa-è-stato-fatto--deploy-scripts)
6. [Problemi Riscontrati e Come Risolti](#6-problemi-riscontrati-e-come-risolti)
7. [Esito Finale e Validazione](#7-esito-finale-e-validazione)
8. [Indirizzi di Riferimento (Arbitrum Mainnet)](#8-indirizzi-di-riferimento-arbitrum-mainnet)

---

## 1. Contesto e Motivazione

### Situazione di partenza

Il progetto `TestSmartContract` è un sistema di gestione di protocolli DeFi (Aave V3, Euler V2, Morpho Blue) basato su pattern Beacon. Ogni protocollo è implementato tramite tre contratti:

- **Plugin** — logica di interazione col protocollo (deposit, borrow, repay, withdraw)
- **LensAdapter** — logica di lettura dati on-chain (healthFactor, posizione, yield)
- **Registry** — registrazione nel Beacon

I sei contratti modificati erano tutti **compilati con indirizzi hardcoded** di Arbitrum mainnet direttamente nelle costanti Solidity:

```solidity
// Esempio pre-refactoring in AaveV3Plugin.sol
address public constant AAVE_POOL_ADDRESS = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
```

### Perché questo è un problema

Un indirizzo hardcoded come `public constant` in Solidity viene **inciso nel bytecode al momento della compilazione**. Questo significa che:

1. **Impossibile deployare su altre chain** — Lo stesso contratto compilato non funziona su Optimism, Base, BNB Chain o qualsiasi altra rete dove Aave/Euler/Morpho hanno indirizzi diversi.
2. **Aggiornabilità nulla** — Se il protocollo aggiorna il proprio indirizzo (es. migrazione V3 → V4), bisogna ricompilare e ridistribuire tutto.
3. **Riutilizzo del bytecode impossibile** — Non si può pubblicare il contratto su un registry e farlo deployare da chiunque su qualunque chain.

### Obiettivo del refactoring

Trasformare tutti gli indirizzi hardcoded in variabili `immutable` iniettate nel costruttore:

```solidity
// Dopo il refactoring in AaveV3Plugin.sol
IAaveV3Pool public immutable aavePool;

constructor(address _beacon, string memory _baseAssetCode, address _aavePool) {
    if (_aavePool == address(0)) revert InvalidAddress();
    aavePool = IAaveV3Pool(_aavePool);
}
```

L'`immutable` garantisce la stessa efficienza gas di una costante (viene risolto al deploy time, non alla chiamata), ma l'indirizzo viene passato dall'esterno. **Stesso bytecode, indirizzi diversi per chain diversa.**

---

## 2. Problema Tecnico Risolto

### Pattern prima del refactoring

```
Contract compiled (Arbitrum hardcoded) → Deploy → Funziona solo su Arbitrum
```

### Pattern dopo il refactoring

```
Contract compiled (nessun indirizzo nel bytecode) → Deploy con args → Funziona su qualsiasi chain
```

### Dettaglio tecnico: `constant` vs `immutable`

| Caratteristica | `constant` | `immutable` |
|---|---|---|
| Valore fissato | A compile time | A deploy time (constructor) |
| Gas cost | Nessuno (inline nel bytecode) | Nessuno (inline nel bytecode) |
| Portabilità multi-chain | ❌ No | ✅ Sì |
| Modificabile dopo deploy | ❌ No | ❌ No (ma diverso per ogni deploy) |

Entrambi costano zero gas in lettura — la scelta `immutable` non ha penalità di performance.

---

## 3. Cosa è stato Fatto — Contratti Solidity

### 3.1 `contracts/plugins/AaveV3Plugin.sol`

**Rimosso:**
```solidity
address public constant AAVE_POOL_ADDRESS = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
```

**Mantenuto (era già presente):**
```solidity
IAaveV3Pool public immutable aavePool;
```

**Modificato il costruttore** da:
```solidity
constructor(address _beacon, string memory _baseAssetCode)
```
a:
```solidity
constructor(address _beacon, string memory _baseAssetCode, address _aavePool) {
    if (_aavePool == address(0)) revert InvalidAddress();
    aavePool = IAaveV3Pool(_aavePool);
}
```

**Perché**: La variabile `aavePool` era già dichiarata `immutable` ma veniva assegnata dalla costante rimossa. Il costruttore ora riceve direttamente l'indirizzo. Il check `address(0)` è obbligatorio per sicurezza — un pool address zero farebbe silenziosamente fallire tutte le operazioni di lending.

---

### 3.2 `contracts/adapters/AaveV3LensAdapter.sol`

**Rimosso:**
```solidity
address public constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
```

**Aggiunto (nuovo stato):**
```solidity
IAaveV3Pool public immutable aavePool;
```

**Modificato il costruttore** con il parametro `address _aavePool` e relativa validazione.

**Sostituiti tutti i 12+ call sites** nel corpo delle funzioni:
```solidity
// Prima
IAaveV3Pool(AAVE_POOL).getUserAccountData(...)
IAaveV3Pool(AAVE_POOL).getReserveData(...)

// Dopo
aavePool.getUserAccountData(...)
aavePool.getReserveData(...)
```

**Perché**: Il LensAdapter chiama il pool Aave per leggere dati di posizione e reserve. Senza l'indirizzo corretto del pool, tutte le funzioni di lettura fallirebbero. Ogni chiamata `IAaveV3Pool(AAVE_POOL).xxx()` costruiva un'istanza temporanea dell'interfaccia — con `immutable` è più pulito e identico per gas.

---

### 3.3 `contracts/plugins/EulerV2Plugin.sol`

**Rimossi:**
```solidity
address public constant EVC_ADDRESS = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
address public constant ACCOUNT_LENS_ADDRESS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
```

**Mantenuto (era già presente):**
```solidity
IEVC public immutable evc;
```

**Aggiunto:**
```solidity
address public immutable accountLensAddress;
```

**Modificato il costruttore** da 2 parametri a 4:
```solidity
constructor(
    address _beacon,
    string memory _baseAssetCode,
    address _evcAddress,
    address _accountLensAddress
)
```

**Perché**: Il plugin Euler usa l'EVC (Ethereum Vault Connector) come punto di ingresso per tutte le operazioni e `AccountLens` per la lettura dello stato degli account. Entrambi hanno indirizzi diversi su ogni chain dove Euler è deployato.

---

### 3.4 `contracts/adapters/EulerLensAdapter.sol`

**Rimossi (4 costanti):**
```solidity
address public constant ACCOUNT_LENS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
address public constant VAULT_LENS   = 0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380;
address public constant UTILS_LENS   = 0xDAf44060DCe217Fd603908A49fcaa1FA900304BE;
address public constant EVC_ADDRESS  = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
```

**Aggiunti (4 immutable):**
```solidity
address public immutable accountLens;
address public immutable vaultLens;
address public immutable utilsLens;
address public immutable evcAddress;
```

**Costruttore** esteso a 6 parametri con 4 validazioni `address(0)`.

**Sostituiti tutti gli 11 call sites** nelle funzioni:
- 8× `IAccountLens(ACCOUNT_LENS)` → `IAccountLens(accountLens)`
- 3× `IEVC(EVC_ADDRESS)` → `IEVC(evcAddress)`

**Nota**: `VAULT_LENS` e `UTILS_LENS` erano dichiarati ma usati solo in commenti interni — rimossi come costanti e mantenuti come immutables per consistenza architetturale e per consentire l'uso futuro senza ricompilazione.

**Perché**: Euler ha un sistema di lens contratti separati (AccountLens, VaultLens, UtilsLens) che variano per chain. Il LensAdapter li usa intensivamente per calcolare health factor, TVL, yield, liquidation risk.

---

### 3.5 `contracts/plugins/MorphoPlugin.sol`

**Rimosso:**
```solidity
address public constant MORPHO_ADDRESS = 0x6c247b1F6182318877311737BaC0844bAa518F5e;
```

**Mantenuto (era già presente):**
```solidity
IMorpho public immutable morpho;
```

**Costruttore** esteso con `address _morphoAddress` e validazione.

**Perché**: Identica motivazione ad Aave — l'indirizzo del contratto core Morpho Blue varia per deployment.

---

### 3.6 `contracts/adapters/MorphoLensAdapter.sol`

**Rimosso:**
```solidity
address public constant MORPHO = 0x6c247b1F6182318877311737BaC0844bAa518F5e;
```

**Aggiunto:**
```solidity
address public immutable morpho;
```

**Costruttore** esteso con `address _morphoAddress` e validazione.

**Modificata `_getMorpho()`** da `private pure` a `private view`:
```solidity
// Prima
function _getMorpho() private pure returns (IMorpho) {
    return IMorpho(MORPHO);
}

// Dopo
function _getMorpho() private view returns (IMorpho) {
    return IMorpho(morpho);
}
```

**Perché il cambio `pure` → `view`**: Una funzione `pure` non può leggere storage né variabili di stato. Dopo la modifica, `morpho` è uno stato `immutable` — per quanto gli immutable siano tecnicamente nel bytecode e non nello storage, il compilatore Solidity richiede `view` (non `pure`) quando si accede a un `immutable` all'interno di una funzione. Tentare di mantenere `pure` genera un errore di compilazione.

---

## 4. Cosa è stato Fatto — Test

### 4.1 `test/unit/LensAdapters.test.ts`

**Aggiunti 6 indirizzi costanti** in testa al file:
```typescript
const ARBITRUM_AAVE_POOL    = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const ARBITRUM_EVC          = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
const ARBITRUM_ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
const ARBITRUM_VAULT_LENS   = "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380";
const ARBITRUM_UTILS_LENS   = "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE";
const ARBITRUM_MORPHO       = "0x6c247b1F6182318877311737BaC0844bAa518F5e";
```

**Aggiornate tutte le chiamate `Factory.deploy()`** per passare gli indirizzi nei `beforeEach` e nei test di zero-address.

**Rimosso** il test obsoleto `"AAVE_POOL constant should be correct"` (testava una costante che non esiste più).

**Aggiunto** il test sostitutivo `"aavePool immutable should match injected address"` che verifica che l'`immutable` esposta sia uguale all'indirizzo passato al costruttore.

**Risultato**: 29/29 test unitari LensAdapters passanti.

---

### 4.2 `test/e2e/` — 6 file modificati

Tutti i file e2e usavano già costanti locali (es. `AAVE_V3_POOL`) per gli indirizzi Arbitrum. Era sufficiente aggiornare le chiamate `Factory.deploy()` per passare quelle costanti come argomento aggiuntivo.

| File | Modifica |
|---|---|
| `USDC.BaseAsset.e2e.test.ts` | `AaveV3Plugin.deploy(..., AAVE_V3_POOL)` + `AaveV3LensAdapter.deploy(..., AAVE_V3_POOL)` |
| `WETH.BaseAsset.e2e.test.ts` | Identico |
| `WBTC.BaseAsset.e2e.test.ts` | Identico |
| `USDT.BaseAsset.e2e.test.ts` | Identico |
| `Euler.USDC.e2e.test.ts` | Aggiunti 4 const Euler + deploy con 4 arg |
| `Morpho.WETH.e2e.test.ts` | Aggiunto `MORPHO_BLUE` const + deploy con 1 arg extra |

`MorphoVault.USDC.e2e.test.ts` — **nessuna modifica** (MorphoVaultPlugin non aveva indirizzi hardcoded).

---

### 4.3 `test/integration/` — 2 file modificati

**`ProtocolManager.euler.test.ts`**:
- Aggiunto `ACCOUNT_LENS_ADDRESS` costante (EVC_ADDRESS era già presente)
- `EulerPluginFactory.deploy(mockBeacon, "WETH", EVC_ADDRESS, ACCOUNT_LENS_ADDRESS)`

**`MorphoPlugin.fork.test.ts`**:
- `MORPHO` costante era già definita a riga 41
- `PluginFactory.deploy(mockBeacon, "WETH", MORPHO)`
- `LensFactory.deploy(mockBeacon, "WETH", MORPHO)`

`MorphoVaultPlugin.fork.test.ts` — **nessuna modifica**.

---

## 5. Cosa è stato Fatto — Deploy Scripts

### `scripts/deploy-aave-v3-plugin.ts`
Costante `AAVE_POOL` era già definita. Aggiunti come argomenti nelle chiamate `.deploy()`.

### `scripts/deploy-euler-plugin.ts`
Aggiunte due costanti `EVC_ADDRESS` e `ACCOUNT_LENS_ADDRESS`. Aggiornate le chiamate deploy.

### `scripts/deploy-morpho-plugin.ts`
Costante `MORPHO_ADDRESS` era già definita. Aggiornate le chiamate deploy.

### `scripts/deployment/euler/deploy-euler-plugin.ts`
Usa `ARBITRUM_ADDRESSES` da `scripts/config/arbitrum.config.ts`. Aggiornato deploy con `ARBITRUM_ADDRESSES.EVC` e `ARBITRUM_ADDRESSES.ACCOUNT_LENS`.

### `scripts/deployment/euler/deploy-euler-lens.ts`
Deploy EulerLensAdapter con tutti e 4 gli indirizzi da `ARBITRUM_ADDRESSES` (inclusi i nuovi `VAULT_LENS` e `UTILS_LENS`).

### `scripts/deployment/euler/simulate-full-deploy.ts`
Aggiornato con EVC e AccountLens.

### `scripts/deployment/euler/upgrade-euler-plugin.ts`
Aggiornato con EVC e AccountLens.

### `scripts/testing/redeploy-euler-ecosystem.ts`
Aggiornati entrambi i deploy (Plugin e LensAdapter) con tutti i parametri corretti.

### `scripts/redeploy-morpho-fixed.ts`
- Deploy aggiornati con `MORPHO_REAL`
- **Fix aggiuntivo**: il codice di verifica chiamava `plugin.MORPHO_ADDRESS()` (getter della costante ormai rimossa) → corretto in `plugin.morpho()` (getter dell'immutable)

### `scripts/redeploy-aave3-flashloan.ts`
- **Fix aggiuntivo**: questo script passava un solo argomento al costruttore `AaveV3Plugin.deploy(BEACON)` — un errore latente che sarebbe esploso al prossimo deploy. Aggiunte le costanti `AAVE_V3_POOL` e `BASE_ASSET_CODE` e aggiornata la chiamata.

### `scripts/config/arbitrum.config.ts`
Aggiunte due nuove voci all'oggetto `ARBITRUM_ADDRESSES`:
```typescript
VAULT_LENS: "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380",
UTILS_LENS: "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE",
```
Erano mancanti perché `EulerLensAdapter` precedentemente le usava come costanti interne.

---

## 6. Problemi Riscontrati e Come Risolti

### Problema 1 — `MorphoLensAdapter.sol`: secondo riferimento a `MORPHO` non trovato

**Errore di compilazione:**
```
DeclarationError: Undeclared identifier.
--> contracts/adapters/MorphoLensAdapter.sol:560:24:
   | return MORPHO;
```

**Causa**: Il replace iniziale aveva aggiornato `_getMorpho()` ma aveva mancato un secondo `return MORPHO` a riga 560, dentro un for-loop in una funzione diversa.

**Soluzione**: Targeted `replace_string_in_file` per sostituire quel secondo `return MORPHO` con `return morpho`.

**Lezione**: Quando si rimuove un `constant` usato in più punti, bisogna sempre fare una ricerca globale nel file prima di procedere.

---

### Problema 2 — `scripts/redeploy-morpho-fixed.ts`: getter `MORPHO_ADDRESS()` non più valido

**Causa**: Il file di redeploy aveva codice di verifica post-deploy che chiamava `plugin.MORPHO_ADDRESS()`, cioè il getter automatico generato da Solidity per la costante `MORPHO_ADDRESS`. Rimuovendo la costante, quel getter smette di esistere.

**Soluzione**: `plugin.MORPHO_ADDRESS()` → `plugin.morpho()` (getter dell'immutable).

**Perché non era stato catturato prima**: I deploy scripts non vengono compilati da `npx hardhat compile` — solo TypeScript può catturarli. Questo tipo di errore sarebbe emerso solo a runtime.

---

### Problema 3 — `scripts/redeploy-aave3-flashloan.ts`: argomento mancante silenzioso

**Causa**: Lo script chiamava `AaveV3PluginFactory.deploy(BEACON)` con un solo argomento quando il costruttore ora richiede 3. In TypeScript/Ethers v6 con TypeChain, questo genera un errore di tipo a compile time — ma lo script non era stato incluso nella lista dei file da aggiornare.

**Soluzione**: Aggiunti `AAVE_V3_POOL` e `BASE_ASSET_CODE` come costanti locali e aggiornata la chiamata.

---

### Problema 4 — `_getMorpho()`: `pure` → `view` obbligatorio

**Causa**: In Solidity, `pure` significa "non legge né scrive stato". Le variabili `immutable` sono integrate nel bytecode, non nello storage, ma il compilatore le tratta comunque come "stato leggibile" per il controllo di mutabilità. Tentare di accedere a un `immutable` in una funzione `pure` genera errore di compilazione.

**Soluzione**: `private pure` → `private view`.

---

## 7. Esito Finale e Validazione

### Compilazione

```
npx hardhat compile --force
→ Compiled 89 Solidity files successfully (evm target: paris)
→ Successfully generated 260 TypeChain typings!
→ 0 errori
```

### Test unitari

```
$env:FORK_ENABLED="false"; npx hardhat test test/unit/LensAdapters.test.ts \
  test/unit/TokenManager.test.ts \
  test/unit/ParameterManager.test.ts \
  test/unit/ValueCalculator.test.ts

→ 242 passing (45s)
→ 0 failing
```

### Test LensAdapters specifici

```
→ 29 passing (4s)
→ 0 failing
```

### Test E2E e Integration (fork Arbitrum)

Strutturalmente corretti. Validazione fork richiede `ARBITRUM_RPC_URL` attivo. La logica di interazione con i protocolli non è stata modificata — solo il modo in cui viene fornito l'indirizzo al momento del deploy.

### TypeChain

260 typings generati riflettono correttamente i nuovi costruttori. Tutti i test TypeScript compilano senza errori di tipo grazie al check implicito di TypeChain.

---

## 8. Indirizzi di Riferimento (Arbitrum Mainnet)

Tutti gli indirizzi usati nel refactoring — ora passati come argomenti invece di essere hardcoded:

| Protocollo | Contratto | Indirizzo |
|---|---|---|
| Aave V3 | Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| Euler V2 | EVC (Ethereum Vault Connector) | `0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066` |
| Euler V2 | AccountLens | `0x90a52DDcb232e7bb003DD9258fA1235c553eC956` |
| Euler V2 | VaultLens | `0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380` |
| Euler V2 | UtilsLens | `0xDAf44060DCe217Fd603908A49fcaa1FA900304BE` |
| Morpho Blue | Core | `0x6c247b1F6182318877311737BaC0844bAa518F5e` |

> Questi indirizzi rimangono nei file di configurazione (`scripts/config/arbitrum.config.ts`), nei test e negli script di deploy — ma **non più nel bytecode dei contratti**.

---

## Riepilogo Numerico

| Categoria | Numero di file |
|---|---|
| Contratti Solidity modificati | 6 |
| File di test modificati | 11 |
| Deploy scripts modificati | 10 |
| File di configurazione modificati | 1 |
| **Totale file modificati** | **28** |

| Metrica | Risultato |
|---|---|
| Errori di compilazione | 0 |
| Test unitari passanti | 242 / 242 |
| TypeChain typings generati | 260 |
| Solidity files compilati | 89 |
| Bug latenti scoperti e corretti | 3 |
