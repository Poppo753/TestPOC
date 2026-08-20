# Documentation Guide — Expanded Implementation

> Versione espansa di `DocumentationGuideline.md`  
> Progetto: TestSmartContract  
> Data: 10 Luglio 2026

---

## Indice

- [Scope del progetto](#scope-del-progetto)
- [Struttura dei file sorgente](#struttura-dei-file-sorgente)
- [STEP 1 — Overview Generale (.md)](#step-1--overview-generale-md)
- [STEP 2 — CSV Globale di tutte le Funzioni](#step-2--csv-globale-di-tutte-le-funzioni)
- [STEP 3 — File .md per ogni Contratto](#step-3--file-md-per-ogni-contratto)
- [STEP 4 — Popolazione del JSON (api_reference_beacon.json)](#step-4--popolazione-del-json)
- [Convenzioni e regole](#convenzioni-e-regole)

---

## Scope del progetto

L'obiettivo è creare documentazione tecnica completa per tutti i file Solidity in:

```
TestSmartContract/contracts/
```

La documentazione coprirà:
- **Core contracts** (root): `Beacon.sol`, `ProtocolManager.sol`, `ProxyGeneral.sol`, `ParameterManager.sol`, `LiquidityManager.sol`, `SwapManager.sol`, `TokenManager.sol`, `ValueCalculator.sol`, `DepositHelper.sol`, `EmergencyHandler.sol`
- **Plugins**: `AaveV3Plugin.sol`, `DolomitePlugin.sol`, `EulerV2Plugin.sol`, `MorphoPlugin.sol`, `MorphoVaultPlugin.sol`, `UniswapV3Plugin.sol`, `UniswapV3PluginDirect.sol`
- **Registries**: `AaveV3Registry.sol`, `EulerRegistry.sol`, `MorphoRegistry.sol`
- **Adapters**: `AaveV3LensAdapter.sol`, `ChainlinkAdapter.sol`, `EulerLensAdapter.sol`, `MorphoLensAdapter.sol`, `MorphoVaultLensAdapter.sol`
- **Services**: `FlashLoanService.sol`
- **Interfaces**: tutti i file `I*.sol` in `interfaces/` e sottocartelle
- **Mocks**: tutti i file in `mocks/` + root (documentazione ridotta)

Il file `api_reference_beacon.json` è il **template di riferimento** per il livello di dettaglio richiesto in ogni entry.

---

## Struttura dei file sorgente

```
contracts/
├── Beacon.sol
├── DepositHelper.sol
├── EmergencyHandler.sol
├── Liquiditymanager.sol
├── MockChainlinkOracle.sol       ← mock (root)
├── MockERC20.sol                  ← mock (root)
├── MockWETH.sol                   ← mock (root)
├── ParameterManager.sol
├── ProtocolManager.sol
├── ProxyGeneral.sol
├── SwapManager.sol
├── TokenManager.sol
├── ValueCalculator.sol
├── adapters/
│   ├── AaveV3LensAdapter.sol
│   ├── ChainlinkAdapter.sol
│   ├── EulerLensAdapter.sol
│   ├── MorphoLensAdapter.sol
│   └── MorphoVaultLensAdapter.sol
├── interfaces/
│   ├── IAaveV3Plugin.sol
│   ├── IAaveV3Registry.sol
│   ├── IBeacon.sol
│   ├── IEmergencyHandler.sol
│   ├── IEulerLensAdapter.sol
│   ├── IEulerRegistry.sol
│   ├── IEulerV2Plugin.sol
│   ├── IEulerV2PluginSpecific.sol
│   ├── IFlashLoanCallback.sol
│   ├── ILendingProtocol.sol
│   ├── ILensAdapter.sol
│   ├── ILiquidityManager.sol
│   ├── IMorphoPlugin.sol
│   ├── IMorphoRegistry.sol
│   ├── IOracleAdapter.sol
│   ├── IParameterManager.sol
│   ├── IParameterManagerForModules.sol
│   ├── IProtocolAdapter.sol
│   ├── IProtocolManager.sol
│   ├── IProxyGeneral.sol
│   ├── ISimpleSwap.sol
│   ├── ISwapManager.sol
│   ├── ISwapManagerForModules.sol
│   ├── ISwapPlugin.sol
│   ├── ITokenManagerForModules.sol
│   ├── IUniswapV3Pool.sol
│   ├── IUniswapV3QuoterV2.sol
│   ├── IUniswapV3Router.sol
│   ├── IValueCalculatorForModules.sol
│   ├── IWETH.sol
│   ├── aave/
│   ├── balancer/
│   ├── euler/
│   └── morpho/
├── mocks/
│   ├── MockBeacon.sol
│   ├── MockChainlinkAggregator.sol
│   ├── MockDepositHelper.sol
│   ├── MockFlashLoanService.sol
│   ├── MockLiquidityManager.sol
│   ├── MockMorpho.sol
│   ├── MockOracleAdapter.sol
│   ├── MockProxyGeneral.sol
│   ├── MockReentrantToken.sol
│   ├── MockSimpleSwap.sol
│   └── MockTokenManager.sol
├── plugins/
│   ├── AaveV3Plugin.sol
│   ├── AaveV3Registry.sol
│   ├── DolomitePlugin.sol
│   ├── EulerRegistry.sol
│   ├── EulerV2Plugin.sol
│   ├── MorphoPlugin.sol
│   ├── MorphoRegistry.sol
│   ├── MorphoVaultPlugin.sol
│   ├── UniswapV3Plugin.sol
│   └── UniswapV3PluginDirect.sol
└── services/
    └── FlashLoanService.sol
```

---

## Struttura della documentazione di output

Tutti i file di output vanno creati sotto:
```
E:\Documents\Crypto\Defi\Arbitrum\Coding\Project4\TestSmartContract\docs\New_Doc\1_Documentation\Function Docs\
```

La struttura completa di cartelle da creare **prima di iniziare** qualsiasi step:

```
Function Docs/
├── contracts_overview.md          ← STEP 1 output
├── all_functions.csv              ← STEP 2 output (popolato incrementalmente)
├── api_reference_full.json        ← STEP 4 output (popolato incrementalmente)
└── contracts/
    ├── core/                      ← STEP 3: 10 contratti core
    │   ├── Beacon.md
    │   ├── DepositHelper.md
    │   ├── EmergencyHandler.md
    │   ├── LiquidityManager.md
    │   ├── ParameterManager.md
    │   ├── ProtocolManager.md
    │   ├── ProxyGeneral.md
    │   ├── SwapManager.md
    │   ├── TokenManager.md
    │   └── ValueCalculator.md
    ├── plugins/                   ← STEP 3: 10 plugin + registry
    │   ├── AaveV3Plugin.md
    │   ├── AaveV3Registry.md
    │   ├── DolomitePlugin.md
    │   ├── EulerRegistry.md
    │   ├── EulerV2Plugin.md
    │   ├── MorphoPlugin.md
    │   ├── MorphoRegistry.md
    │   ├── MorphoVaultPlugin.md
    │   ├── UniswapV3Plugin.md
    │   └── UniswapV3PluginDirect.md
    ├── adapters/                  ← STEP 3: 5 lens adapter
    │   ├── AaveV3LensAdapter.md
    │   ├── ChainlinkAdapter.md
    │   ├── EulerLensAdapter.md
    │   ├── MorphoLensAdapter.md
    │   └── MorphoVaultLensAdapter.md
    ├── services/                  ← STEP 3: 1 service
    │   └── FlashLoanService.md
    ├── interfaces/                ← STEP 3: 30 interfacce root
    │   ├── IBeacon.md
    │   ├── IEmergencyHandler.md
    │   ├── ... (tutti i file I*.md)
    │   ├── aave/
    │   │   └── IAaveV3Pool.md
    │   ├── balancer/
    │   │   └── IBalancerVault.md
    │   ├── euler/
    │   │   ├── IAccountLens.md
    │   │   ├── IEulerVaultRegistry.md
    │   │   ├── IEVault.md
    │   │   ├── IEVC.md
    │   │   └── ISwapper.md
    │   └── morpho/
    │       ├── IERC4626.md
    │       └── IMorpho.md
    └── mocks/                     ← STEP 3: 14 mock (inclusi quelli root del sorgente)
        ├── MockBeacon.md
        ├── MockChainlinkAggregator.md
        ├── MockChainlinkOracle.md
        ├── MockDepositHelper.md
        ├── MockERC20.md
        ├── MockFlashLoanService.md
        ├── MockLiquidityManager.md
        ├── MockMorpho.md
        ├── MockOracleAdapter.md
        ├── MockProxyGeneral.md
        ├── MockReentrantToken.md
        ├── MockSimpleSwap.md
        ├── MockTokenManager.md
        └── MockWETH.md
```

> **Nota:** la struttura delle cartelle di documentazione (`contracts/core/`, `contracts/plugins/`, ecc.) rispecchia la struttura del sorgente (`contracts/`, `contracts/plugins/`, ecc.) per facilitare la navigazione incrociata tra codice e docs.

---

## STEP 1 — Overview Generale (.md)

### Output
```
docs/New_Doc/1_Documentation/contracts_overview.md
```

### Implementazione dettagliata

#### 1.1 — Aprire ogni file .sol e raccogliere:
Per ogni file, leggere:
- Prima riga utile: `pragma solidity ^x.x.x;`
- Dichiarazione: `contract X is Y, Z` / `interface X` / `library X` / `abstract contract X`
- Commento NatSpec in cima (se presente): `/// @title`, `/// @notice`, `/// @dev`
- Import list (per la mappa dipendenze)

#### 1.2 — Struttura del documento contracts_overview.md

```markdown
# Contracts Overview

## Core Contracts (root)
| File | Tipo | Descrizione |
|------|------|-------------|
| Beacon.sol | contract | ... |
...

## Plugins
| File | Tipo | Descrizione |
...

## Registries
...

## Adapters
...

## Services
...

## Interfaces
...

## Mocks
...

## Mappa delle Dipendenze
### ProtocolManager.sol
- importa: IProtocolManager.sol, IBeacon.sol, IProxyGeneral.sol, ...
- usato da: (nessun import diretto — entry point esterno)
...
```

#### 1.3 — Ordine di lettura consigliato
1. Prima leggere i contratti Core (sono il cuore del sistema)
2. Poi Plugin e Registry (dipendono dai Core)
3. Poi Adapters e Services
4. Poi Interfaces (sono le definizioni che tutto il resto implementa)
5. Infine Mocks (implementazioni semplificate per i test)

---

## STEP 2 — CSV Globale di tutte le Funzioni

### Output
```
docs/New_Doc/1_Documentation/all_functions.csv
```

### Colonne richieste

| Colonna | Contenuto | Esempio |
|---------|-----------|---------|
| `Contract` | Nome del contratto (senza .sol) | `ProtocolManager` |
| `ContractType` | contract / interface / library / abstract | `contract` |
| `FunctionName` | Nome esatto della funzione | `deposit` |
| `Visibility` | public / external / internal / private | `external` |
| `StateMutability` | pure / view / payable / (none=nonpayable) | `nonpayable` |
| `Modifiers` | Lista dei modifier separati da `;` | `onlyOwner` |
| `Parameters` | Formato: `tipo nome; tipo nome` | `string protocolName; uint256 amount` |
| `Returns` | Formato: `tipo nome` o `tipo` | `bool` |
| `Description` | Frase breve (max 20 parole) dello scopo | `Deposits tokens into a protocol via plugin` |
| `AccessControl` | Chi può chiamarla | `onlyOwner` |
| `Events` | Events emessi (separati da `;`) | `ProtocolOperationExecuted` |
| `Notes` | Note importanti, warning, flag di sicurezza | `Reverts if plugin returns false` |

### Implementazione dettagliata

#### 2.1 — Come estrarre le funzioni da ogni .sol

Per ogni funzione trovata nel codice:
1. Identifica la **signature completa**: `function name(params) visibility stateMutability modifier returns(...)`
2. Separa ogni elemento nella rispettiva colonna
3. Cerca i blocchi `emit EventName(...)` nel corpo della funzione
4. Cerca `require`, `revert`, `if(...) revert` per Notes
5. Cerca `onlyOwner`, `nonReentrant`, `whenNotPaused` ecc. per Modifiers e AccessControl

#### 2.2 — Gestione casi speciali

- **constructor**: includere con `FunctionName = constructor`
- **receive() / fallback()**: includere con nome `receive` / `fallback`
- **modifier** declarations: NON includere (non sono funzioni)
- **event** declarations: NON includere (non sono funzioni)
- **Funzioni di interfaccia**: includere, `StateMutability` da dichiarazione
- **Override**: aggiungere `override` nei Notes

#### 2.3 — Ordinamento nel CSV
- Prima ordina per `Contract` (alfabetico)
- Poi per `FunctionName` (alfabetico)
- Le funzioni `constructor` vanno in cima per quel contratto

#### 2.4 — Encoding del CSV
- Separatore: virgola `,`
- Tutti i campi stringa tra virgolette doppie `"`
- Encoding: UTF-8
- Prima riga: intestazione colonne

---

## STEP 3 — File .md per ogni Contratto

### Output
```
docs/New_Doc/1_Documentation/contracts/<ContractName>.md
```

### Contratti da documentare con file .md completo

**Core (priorità massima):**
- `ProtocolManager.md`
- `ProxyGeneral.md`
- `ParameterManager.md`
- `LiquidityManager.md`
- `SwapManager.md`
- `TokenManager.md`
- `ValueCalculator.md`
- `Beacon.md`
- `DepositHelper.md`
- `EmergencyHandler.md`

**Plugins:**
- `AaveV3Plugin.md`
- `DolomitePlugin.md`
- `EulerV2Plugin.md`
- `MorphoPlugin.md`
- `MorphoVaultPlugin.md`
- `UniswapV3Plugin.md`
- `UniswapV3PluginDirect.md`

**Registries:**
- `AaveV3Registry.md`
- `EulerRegistry.md`
- `MorphoRegistry.md`

**Adapters:**
- `AaveV3LensAdapter.md`
- `ChainlinkAdapter.md`
- `EulerLensAdapter.md`
- `MorphoLensAdapter.md`
- `MorphoVaultLensAdapter.md`

**Services:**
- `FlashLoanService.md`

**Interfaces** (solo se > 5 funzioni — verificare durante lettura):
- Creare file .md ridotto (tabella funzioni + descrizione scopo)

**Mocks** (documentazione ridotta — solo tabella funzioni):
- Creare file .md sintetico

### Struttura di ogni file .md

```markdown
# ContractName

| Campo | Valore |
|-------|--------|
| File | contracts/subfolder/ContractName.sol |
| Tipo | contract / interface / abstract |
| Solidity | ^0.8.x |
| Eredita da | Contract1, Contract2 |
| Implementa | IInterfaceName |

## Scopo
[Descrizione in prosa di 3-5 righe: cosa fa il contratto, 
nel quale ecosistema si inserisce, con chi interagisce]

## Storage Variables

| Nome | Tipo | Visibilità | Descrizione |
|------|------|------------|-------------|
| variabile1 | address | private | ... |
| variabile2 | mapping(...) | internal | ... |

## Costanti e Immutabili

| Nome | Tipo | Valore / Descrizione |
|------|------|----------------------|

## Funzioni

| Funzione | Visibility | Params | Returns | Modifiers | Descrizione |
|----------|------------|--------|---------|-----------|-------------|
| constructor | public | ... | — | — | ... |
| deposit | external | protocolName: string, tokenCode: string, amount: uint256 | — | onlyOwner | Deposita token nel protocollo via plugin |

## Events

| Event | Parametri | Quando viene emesso |
|-------|-----------|---------------------|
| ProtocolOperationExecuted | ... | ... |

## Errors (Custom Revert)

| Error | Parametri | Quando viene lanciato |
|-------|-----------|----------------------|
| InvalidAmount | uint256 amount | amount == 0 |

## Note di Sicurezza
- [Lista di note sulla sicurezza, access control, reentrancy guard, ecc.]

## Dipendenze
- **Importa**: [lista file importati]
- **Usato da**: [contratti che lo importano/chiamano]
```

### Implementazione dettagliata

#### 3.1 — Ordine di creazione consigliato
1. `ProtocolManager.md` (entry point principale)
2. `ProxyGeneral.md`
3. `Beacon.md`
4. Resto dei Core (ordine alfabetico)
5. Plugins (ordine alfabetico)
6. Registries
7. Adapters
8. Services
9. Interfaces
10. Mocks

#### 3.2 — Come mappare i parametri nella tabella funzioni
- Formato params: `nomeParam: tipo` separati da `,`
- Se il tipo è `string memory` o `uint256[]`, scrivere solo il tipo base: `string`, `uint256[]`
- Per params `calldata`: indicare solo il tipo
- Se una funzione non ha params: scrivere `—`
- Se non ha returns: scrivere `—`

#### 3.3 — Come compilare "Note di Sicurezza"
Verificare la presenza di:
- `onlyOwner` / `onlyRole` → annotare chi può chiamare
- `nonReentrant` → annotare protezione da reentrancy
- `whenNotPaused` → annotare pausabilità
- `require` / `revert` con messaggi → riportare le condizioni di revert più importanti
- `SafeERC20` / `safeTransfer` → annotare uso di transfer sicuro
- Low-level call (`call`, `delegatecall`) → segnalare come nota critica

---

## STEP 4 — Popolazione del JSON

### Output
```
docs/New_Doc/1_Documentation/api_reference_full.json
```

### Struttura di riferimento
Seguire esattamente la struttura di `api_reference_beacon.json`:

```json
{
  "version": "3.0.0",
  "modules": {
    "contract_id": {
      "name": "ContractName",
      "id": "contract_id",
      "displayOrder": 1,
      "functions": {
        "contract_id-functionName": {
          "name": "functionName",
          "id": "contract_id-functionName",
          "module": "contract_id",
          "description": "...",
          "signature": "function functionName(...) visibility modifiers",
          "parameters": [...],
          "returns": [...],
          "accessControl": "...",
          "validations": [...],
          "events": "...",
          "gasCost": "...",
          "usageExample": "...",
          "calledBy": "...",
          "securityNotes": [...],
          "notes": "...",
          "_complete": true,
          "_missingFields": []
        }
      }
    }
  }
}
```

### Implementazione dettagliata
- Iniziare dai contratti Core già documentati negli step precedenti (i dati sono già stati raccolti)
- Usare gli .md creati nello STEP 3 come fonte per popolare i campi
- `displayOrder`: seguire ordine Core → Plugins → Registries → Adapters → Services
- `gasCost`: se non stimabile, scrivere `"N/A — see test suite"`
- `_complete`: impostare `false` se mancano campi, listare i mancanti in `_missingFields`

---

## Convenzioni e regole

### Nomenclatura file
- I file .md dei contratti usano il **nome esatto del contratto** (non del file .sol)
- Es: `Liquiditymanager.sol` → il contratto si chiama `LiquidityManager` → file: `LiquidityManager.md`

### Lingua
- Tutti i file di documentazione sono scritti in **inglese**
- Commenti interni a questa guida possono essere in italiano

### Aggiornamento
- Ogni volta che un contratto viene modificato, il file .md corrispondente va aggiornato
- Il CSV va rigenerato (o la riga aggiornata) ad ogni modifica di firma funzione
- Il JSON va aggiornato con `_complete: false` e il campo modificato in `_missingFields` finché non è riallineato

### Priorità di esecuzione
```
STEP 1 (overview) → STEP 2 (CSV) → STEP 3 (md per contratto) → STEP 4 (JSON)
```
Gli STEP sono dipendenti in cascata: le informazioni raccolte nello STEP 1 e 2 accelerano la scrittura degli STEP 3 e 4.
