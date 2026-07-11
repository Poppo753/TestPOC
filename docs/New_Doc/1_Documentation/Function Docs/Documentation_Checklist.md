# Documentation Checklist
> Progetto: TestSmartContract — Solidity Contract Documentation  
> Riferimento: `DocumentationGuideline_Expanded.md`  
> Legenda: `[ ]` = da fare &nbsp;|&nbsp; `[x]` = completato  
> **Pattern:** per ogni contratto → leggi il .sol → scrivi subito md + righe CSV + blocco JSON, poi passa al successivo

---

## PRE-REQUISITI

- [ ] Leggere `DocumentationGuideline_Expanded.md` per intero
- [ ] Verificare che `api_reference_beacon.json` sia accessibile come template
- [ ] Creare la struttura completa di cartelle di output sotto `docs/New_Doc/1_Documentation/Function Docs/`:
  > Ogni sottocartella corrisponde a una categoria di file sorgente e conterrà esclusivamente i file `.md` di quella categoria. I tre file di output globali (`contracts_overview.md`, `all_functions.csv`, `api_reference_full.json`) restano nella root della cartella `Function Docs/`.
  ```
  Function Docs/
  ├── contracts_overview.md          ← overview generale (Step finale)
  ├── all_functions.csv              ← CSV globale (popolato via via)
  ├── api_reference_full.json        ← JSON completo (popolato via via)
  └── contracts/
      ├── core/                      ← 10 contratti core
      ├── plugins/                   ← 10 plugin + registry
      ├── adapters/                  ← 5 lens adapter
      ├── services/                  ← 1 service
      ├── interfaces/                ← 30 interfacce root del progetto
      │   ├── aave/                  ← 1 interfaccia esterna: IAaveV3Pool
      │   ├── balancer/              ← 1 interfaccia esterna: IBalancerVault
      │   ├── euler/                 ← 5 interfacce esterne Euler
      │   └── morpho/               ← 2 interfacce esterne Morpho
      └── mocks/                     ← 14 mock contracts (test only)
  ```
  - [x] Creare cartella `contracts/`
  - [x] Creare cartella `contracts/core/`
  - [x] Creare cartella `contracts/plugins/`
  - [x] Creare cartella `contracts/adapters/`
  - [x] Creare cartella `contracts/services/`
  - [x] Creare cartella `contracts/interfaces/`
  - [x] Creare cartella `contracts/interfaces/aave/`
  - [x] Creare cartella `contracts/interfaces/balancer/`
  - [x] Creare cartella `contracts/interfaces/euler/`
  - [x] Creare cartella `contracts/interfaces/morpho/`
  - [x] Creare cartella `contracts/mocks/`
- [ ] Creare il file `all_functions.csv` con la sola riga di intestazione:  
  `Contract,ContractType,FunctionName,Visibility,StateMutability,Modifiers,Parameters,Returns,Description,AccessControl,Events,Notes`
- [ ] Creare il file `api_reference_full.json` con la struttura base:  
  `{ "version": "3.0.0", "modules": {} }`
- [ ] Aprire VS Code con il workspace `TestSmartContract`

---

## CORE CONTRACTS
> Per ogni contratto: leggi → scrivi .md → aggiungi righe al CSV → aggiungi modulo al JSON  
> Output .md → `contracts/core/<NomeContratto>.md`

### Beacon
- [ ] Leggere `contracts/Beacon.sol`
- [ ] Scrivere `contracts/core/Beacon.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `Beacon` a `all_functions.csv`
- [ ] Aggiungere modulo `beacon` a `api_reference_full.json`

### ProtocolManager
- [ ] Leggere `contracts/ProtocolManager.sol`
- [ ] Scrivere `contracts/core/ProtocolManager.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `ProtocolManager` a `all_functions.csv`
- [ ] Aggiungere modulo `protocol_manager` a `api_reference_full.json`

### ProxyGeneral
- [ ] Leggere `contracts/ProxyGeneral.sol`
- [ ] Scrivere `contracts/core/ProxyGeneral.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `ProxyGeneral` a `all_functions.csv`
- [ ] Aggiungere modulo `proxy_general` a `api_reference_full.json`

### ParameterManager
- [ ] Leggere `contracts/ParameterManager.sol`
- [ ] Scrivere `contracts/core/ParameterManager.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `ParameterManager` a `all_functions.csv`
- [ ] Aggiungere modulo `parameter_manager` a `api_reference_full.json`

### LiquidityManager
- [ ] Leggere `contracts/Liquiditymanager.sol`
- [ ] Scrivere `contracts/core/LiquidityManager.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `LiquidityManager` a `all_functions.csv`
- [ ] Aggiungere modulo `liquidity_manager` a `api_reference_full.json`

### SwapManager
- [ ] Leggere `contracts/SwapManager.sol`
- [ ] Scrivere `contracts/core/SwapManager.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `SwapManager` a `all_functions.csv`
- [ ] Aggiungere modulo `swap_manager` a `api_reference_full.json`

### TokenManager
- [ ] Leggere `contracts/TokenManager.sol`
- [ ] Scrivere `contracts/core/TokenManager.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `TokenManager` a `all_functions.csv`
- [ ] Aggiungere modulo `token_manager` a `api_reference_full.json`

### ValueCalculator
- [ ] Leggere `contracts/ValueCalculator.sol`
- [ ] Scrivere `contracts/core/ValueCalculator.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `ValueCalculator` a `all_functions.csv`
- [ ] Aggiungere modulo `value_calculator` a `api_reference_full.json`

### DepositHelper
- [ ] Leggere `contracts/DepositHelper.sol`
- [ ] Scrivere `contracts/core/DepositHelper.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `DepositHelper` a `all_functions.csv`
- [ ] Aggiungere modulo `deposit_helper` a `api_reference_full.json`

### EmergencyHandler
- [ ] Leggere `contracts/EmergencyHandler.sol`
- [ ] Scrivere `contracts/core/EmergencyHandler.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `EmergencyHandler` a `all_functions.csv`
- [ ] Aggiungere modulo `emergency_handler` a `api_reference_full.json`

---

## PLUGINS
> Stesso pattern: leggi → .md → CSV → JSON  
> Output .md → `contracts/plugins/<NomePlugin>.md`

### AaveV3Plugin
- [ ] Leggere `contracts/plugins/AaveV3Plugin.sol`
- [ ] Scrivere `contracts/plugins/AaveV3Plugin.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `AaveV3Plugin` a `all_functions.csv`
- [ ] Aggiungere modulo `aave_v3_plugin` a `api_reference_full.json`

### AaveV3Registry
- [ ] Leggere `contracts/plugins/AaveV3Registry.sol`
- [ ] Scrivere `contracts/plugins/AaveV3Registry.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `AaveV3Registry` a `all_functions.csv`
- [ ] Aggiungere modulo `aave_v3_registry` a `api_reference_full.json`

### DolomitePlugin
- [ ] Leggere `contracts/plugins/DolomitePlugin.sol`
- [ ] Scrivere `contracts/plugins/DolomitePlugin.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `DolomitePlugin` a `all_functions.csv`
- [ ] Aggiungere modulo `dolomite_plugin` a `api_reference_full.json`

### EulerRegistry
- [ ] Leggere `contracts/plugins/EulerRegistry.sol`
- [ ] Scrivere `contracts/plugins/EulerRegistry.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `EulerRegistry` a `all_functions.csv`
- [ ] Aggiungere modulo `euler_registry` a `api_reference_full.json`

### EulerV2Plugin
- [ ] Leggere `contracts/plugins/EulerV2Plugin.sol`
- [ ] Scrivere `contracts/plugins/EulerV2Plugin.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `EulerV2Plugin` a `all_functions.csv`
- [ ] Aggiungere modulo `euler_v2_plugin` a `api_reference_full.json`

### MorphoPlugin
- [ ] Leggere `contracts/plugins/MorphoPlugin.sol`
- [ ] Scrivere `contracts/plugins/MorphoPlugin.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `MorphoPlugin` a `all_functions.csv`
- [ ] Aggiungere modulo `morpho_plugin` a `api_reference_full.json`

### MorphoRegistry
- [ ] Leggere `contracts/plugins/MorphoRegistry.sol`
- [ ] Scrivere `contracts/plugins/MorphoRegistry.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `MorphoRegistry` a `all_functions.csv`
- [ ] Aggiungere modulo `morpho_registry` a `api_reference_full.json`

### MorphoVaultPlugin
- [ ] Leggere `contracts/plugins/MorphoVaultPlugin.sol`
- [ ] Scrivere `contracts/plugins/MorphoVaultPlugin.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `MorphoVaultPlugin` a `all_functions.csv`
- [ ] Aggiungere modulo `morpho_vault_plugin` a `api_reference_full.json`

### UniswapV3Plugin
- [ ] Leggere `contracts/plugins/UniswapV3Plugin.sol`
- [ ] Scrivere `contracts/plugins/UniswapV3Plugin.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `UniswapV3Plugin` a `all_functions.csv`
- [ ] Aggiungere modulo `uniswap_v3_plugin` a `api_reference_full.json`

### UniswapV3PluginDirect
- [ ] Leggere `contracts/plugins/UniswapV3PluginDirect.sol`
- [ ] Scrivere `contracts/plugins/UniswapV3PluginDirect.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `UniswapV3PluginDirect` a `all_functions.csv`
- [ ] Aggiungere modulo `uniswap_v3_plugin_direct` a `api_reference_full.json`

---

## ADAPTERS
> Stesso pattern completo: leggi → scrivi .md → aggiungi righe CSV → aggiungi modulo JSON  
> Output .md → `contracts/adapters/<NomeAdapter>.md`

### AaveV3LensAdapter
- [ ] Leggere `contracts/adapters/AaveV3LensAdapter.sol`
- [ ] Scrivere `contracts/adapters/AaveV3LensAdapter.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `AaveV3LensAdapter` a `all_functions.csv`
- [ ] Aggiungere modulo `aave_v3_lens_adapter` a `api_reference_full.json`

### ChainlinkAdapter
- [ ] Leggere `contracts/adapters/ChainlinkAdapter.sol`
- [ ] Scrivere `contracts/adapters/ChainlinkAdapter.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `ChainlinkAdapter` a `all_functions.csv`
- [ ] Aggiungere modulo `chainlink_adapter` a `api_reference_full.json`

### EulerLensAdapter
- [ ] Leggere `contracts/adapters/EulerLensAdapter.sol`
- [ ] Scrivere `contracts/adapters/EulerLensAdapter.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `EulerLensAdapter` a `all_functions.csv`
- [ ] Aggiungere modulo `euler_lens_adapter` a `api_reference_full.json`

### MorphoLensAdapter
- [ ] Leggere `contracts/adapters/MorphoLensAdapter.sol`
- [ ] Scrivere `contracts/adapters/MorphoLensAdapter.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `MorphoLensAdapter` a `all_functions.csv`
- [ ] Aggiungere modulo `morpho_lens_adapter` a `api_reference_full.json`

### MorphoVaultLensAdapter
- [ ] Leggere `contracts/adapters/MorphoVaultLensAdapter.sol`
- [ ] Scrivere `contracts/adapters/MorphoVaultLensAdapter.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `MorphoVaultLensAdapter` a `all_functions.csv`
- [ ] Aggiungere modulo `morpho_vault_lens_adapter` a `api_reference_full.json`

---

## SERVICES
> Stesso pattern completo: leggi → scrivi .md → aggiungi righe CSV → aggiungi modulo JSON  
> Output .md → `contracts/services/<NomeService>.md`

### FlashLoanService
- [ ] Leggere `contracts/services/FlashLoanService.sol`
- [ ] Scrivere `contracts/services/FlashLoanService.md` (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Aggiungere righe di `FlashLoanService` a `all_functions.csv`
- [ ] Aggiungere modulo `flash_loan_service` a `api_reference_full.json`

---

## INTERFACES
> Pattern per interfaccia: leggi → aggiungi righe CSV → scrivi .md (scopo + tabella funzioni)  
> Le interfacce non hanno storage né events propri: il .md è più snello ma va sempre fatto

### Interfaces — Progetto (root)
> Output .md → `contracts/interfaces/<NomeInterfaccia>.md`

#### IBeacon
- [ ] Leggere `contracts/interfaces/IBeacon.sol`
- [ ] Aggiungere righe di `IBeacon` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IBeacon.md` (scopo, tabella funzioni, contratti che la implementano)

#### IProtocolManager
- [ ] Leggere `contracts/interfaces/IProtocolManager.sol`
- [ ] Aggiungere righe di `IProtocolManager` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IProtocolManager.md`

#### IProxyGeneral
- [ ] Leggere `contracts/interfaces/IProxyGeneral.sol`
- [ ] Aggiungere righe di `IProxyGeneral` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IProxyGeneral.md`

#### IParameterManager
- [ ] Leggere `contracts/interfaces/IParameterManager.sol`
- [ ] Aggiungere righe di `IParameterManager` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IParameterManager.md`

#### IParameterManagerForModules
- [ ] Leggere `contracts/interfaces/IParameterManagerForModules.sol`
- [ ] Aggiungere righe di `IParameterManagerForModules` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IParameterManagerForModules.md`

#### ILiquidityManager
- [ ] Leggere `contracts/interfaces/ILiquidityManager.sol`
- [ ] Aggiungere righe di `ILiquidityManager` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/ILiquidityManager.md`

#### ISwapManager
- [ ] Leggere `contracts/interfaces/ISwapManager.sol`
- [ ] Aggiungere righe di `ISwapManager` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/ISwapManager.md`

#### ISwapManagerForModules
- [ ] Leggere `contracts/interfaces/ISwapManagerForModules.sol`
- [ ] Aggiungere righe di `ISwapManagerForModules` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/ISwapManagerForModules.md`

#### ISwapPlugin
- [ ] Leggere `contracts/interfaces/ISwapPlugin.sol`
- [ ] Aggiungere righe di `ISwapPlugin` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/ISwapPlugin.md`

#### ITokenManagerForModules
- [ ] Leggere `contracts/interfaces/ITokenManagerForModules.sol`
- [ ] Aggiungere righe di `ITokenManagerForModules` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/ITokenManagerForModules.md`

#### IValueCalculatorForModules
- [ ] Leggere `contracts/interfaces/IValueCalculatorForModules.sol`
- [ ] Aggiungere righe di `IValueCalculatorForModules` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IValueCalculatorForModules.md`

#### IEmergencyHandler
- [ ] Leggere `contracts/interfaces/IEmergencyHandler.sol`
- [ ] Aggiungere righe di `IEmergencyHandler` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IEmergencyHandler.md`

#### ILendingProtocol
- [ ] Leggere `contracts/interfaces/ILendingProtocol.sol`
- [ ] Aggiungere righe di `ILendingProtocol` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/ILendingProtocol.md`

#### ILensAdapter
- [ ] Leggere `contracts/interfaces/ILensAdapter.sol`
- [ ] Aggiungere righe di `ILensAdapter` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/ILensAdapter.md`

#### IOracleAdapter
- [ ] Leggere `contracts/interfaces/IOracleAdapter.sol`
- [ ] Aggiungere righe di `IOracleAdapter` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IOracleAdapter.md`

#### IProtocolAdapter
- [ ] Leggere `contracts/interfaces/IProtocolAdapter.sol`
- [ ] Aggiungere righe di `IProtocolAdapter` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IProtocolAdapter.md`

#### IFlashLoanCallback
- [ ] Leggere `contracts/interfaces/IFlashLoanCallback.sol`
- [ ] Aggiungere righe di `IFlashLoanCallback` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IFlashLoanCallback.md`

#### IAaveV3Plugin
- [ ] Leggere `contracts/interfaces/IAaveV3Plugin.sol`
- [ ] Aggiungere righe di `IAaveV3Plugin` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IAaveV3Plugin.md`

#### IAaveV3Registry
- [ ] Leggere `contracts/interfaces/IAaveV3Registry.sol`
- [ ] Aggiungere righe di `IAaveV3Registry` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IAaveV3Registry.md`

#### IEulerLensAdapter
- [ ] Leggere `contracts/interfaces/IEulerLensAdapter.sol`
- [ ] Aggiungere righe di `IEulerLensAdapter` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IEulerLensAdapter.md`

#### IEulerRegistry
- [ ] Leggere `contracts/interfaces/IEulerRegistry.sol`
- [ ] Aggiungere righe di `IEulerRegistry` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IEulerRegistry.md`

#### IEulerV2Plugin
- [ ] Leggere `contracts/interfaces/IEulerV2Plugin.sol`
- [ ] Aggiungere righe di `IEulerV2Plugin` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IEulerV2Plugin.md`

#### IEulerV2PluginSpecific
- [ ] Leggere `contracts/interfaces/IEulerV2PluginSpecific.sol`
- [ ] Aggiungere righe di `IEulerV2PluginSpecific` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IEulerV2PluginSpecific.md`

#### IMorphoPlugin
- [ ] Leggere `contracts/interfaces/IMorphoPlugin.sol`
- [ ] Aggiungere righe di `IMorphoPlugin` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IMorphoPlugin.md`

#### IMorphoRegistry
- [ ] Leggere `contracts/interfaces/IMorphoRegistry.sol`
- [ ] Aggiungere righe di `IMorphoRegistry` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IMorphoRegistry.md`

#### ISimpleSwap
- [ ] Leggere `contracts/interfaces/ISimpleSwap.sol`
- [ ] Aggiungere righe di `ISimpleSwap` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/ISimpleSwap.md`

#### IUniswapV3Pool
- [ ] Leggere `contracts/interfaces/IUniswapV3Pool.sol`
- [ ] Aggiungere righe di `IUniswapV3Pool` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IUniswapV3Pool.md`

#### IUniswapV3QuoterV2
- [ ] Leggere `contracts/interfaces/IUniswapV3QuoterV2.sol`
- [ ] Aggiungere righe di `IUniswapV3QuoterV2` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IUniswapV3QuoterV2.md`

#### IUniswapV3Router
- [ ] Leggere `contracts/interfaces/IUniswapV3Router.sol`
- [ ] Aggiungere righe di `IUniswapV3Router` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IUniswapV3Router.md`

#### IWETH
- [ ] Leggere `contracts/interfaces/IWETH.sol`
- [ ] Aggiungere righe di `IWETH` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/IWETH.md`

### Interfaces — Aave (sottocartella)
> Output .md → `contracts/interfaces/aave/<NomeInterfaccia>.md`

#### IAaveV3Pool
- [ ] Leggere `contracts/interfaces/aave/IAaveV3Pool.sol`
- [ ] Aggiungere righe di `IAaveV3Pool` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/aave/IAaveV3Pool.md`

### Interfaces — Balancer (sottocartella)
> Output .md → `contracts/interfaces/balancer/<NomeInterfaccia>.md`

#### IBalancerVault
- [ ] Leggere `contracts/interfaces/balancer/IBalancerVault.sol`
- [ ] Aggiungere righe di `IBalancerVault` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/balancer/IBalancerVault.md`

### Interfaces — Euler (sottocartella)
> Output .md → `contracts/interfaces/euler/<NomeInterfaccia>.md`

#### IAccountLens
- [ ] Leggere `contracts/interfaces/euler/IAccountLens.sol`
- [ ] Aggiungere righe di `IAccountLens` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/euler/IAccountLens.md`

#### IEulerVaultRegistry
- [ ] Leggere `contracts/interfaces/euler/IEulerVaultRegistry.sol`
- [ ] Aggiungere righe di `IEulerVaultRegistry` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/euler/IEulerVaultRegistry.md`

#### IEVault
- [ ] Leggere `contracts/interfaces/euler/IEVault.sol`
- [ ] Aggiungere righe di `IEVault` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/euler/IEVault.md`

#### IEVC
- [ ] Leggere `contracts/interfaces/euler/IEVC.sol`
- [ ] Aggiungere righe di `IEVC` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/euler/IEVC.md`

#### ISwapper
- [ ] Leggere `contracts/interfaces/euler/ISwapper.sol`
- [ ] Aggiungere righe di `ISwapper` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/euler/ISwapper.md`

### Interfaces — Morpho (sottocartella)
> Output .md → `contracts/interfaces/morpho/<NomeInterfaccia>.md`

#### IERC4626
- [ ] Leggere `contracts/interfaces/morpho/IERC4626.sol`
- [ ] Aggiungere righe di `IERC4626` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/morpho/IERC4626.md`

#### IMorpho
- [ ] Leggere `contracts/interfaces/morpho/IMorpho.sol`
- [ ] Aggiungere righe di `IMorpho` a `all_functions.csv`
- [ ] Scrivere `contracts/interfaces/morpho/IMorpho.md`

---

## MOCKS
> Pattern mock: leggi → scrivi .md sintetico (scopo + tabella funzioni + note "solo per test") → aggiungi righe CSV  
> Non richiedono blocco JSON (non sono moduli di produzione)  
> Output .md → `contracts/mocks/<NomeMock>.md` (anche per i mock in root del sorgente)

### MockBeacon
- [ ] Leggere `contracts/mocks/MockBeacon.sol`
- [ ] Scrivere `contracts/mocks/MockBeacon.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockBeacon` a `all_functions.csv`

### MockProxyGeneral
- [ ] Leggere `contracts/mocks/MockProxyGeneral.sol`
- [ ] Scrivere `contracts/mocks/MockProxyGeneral.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockProxyGeneral` a `all_functions.csv`

### MockTokenManager
- [ ] Leggere `contracts/mocks/MockTokenManager.sol`
- [ ] Scrivere `contracts/mocks/MockTokenManager.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockTokenManager` a `all_functions.csv`

### MockLiquidityManager
- [ ] Leggere `contracts/mocks/MockLiquidityManager.sol`
- [ ] Scrivere `contracts/mocks/MockLiquidityManager.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockLiquidityManager` a `all_functions.csv`

### MockFlashLoanService
- [ ] Leggere `contracts/mocks/MockFlashLoanService.sol`
- [ ] Scrivere `contracts/mocks/MockFlashLoanService.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockFlashLoanService` a `all_functions.csv`

### MockDepositHelper
- [ ] Leggere `contracts/mocks/MockDepositHelper.sol`
- [ ] Scrivere `contracts/mocks/MockDepositHelper.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockDepositHelper` a `all_functions.csv`

### MockChainlinkAggregator
- [ ] Leggere `contracts/mocks/MockChainlinkAggregator.sol`
- [ ] Scrivere `contracts/mocks/MockChainlinkAggregator.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockChainlinkAggregator` a `all_functions.csv`

### MockMorpho
- [ ] Leggere `contracts/mocks/MockMorpho.sol`
- [ ] Scrivere `contracts/mocks/MockMorpho.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockMorpho` a `all_functions.csv`

### MockOracleAdapter
- [ ] Leggere `contracts/mocks/MockOracleAdapter.sol`
- [ ] Scrivere `contracts/mocks/MockOracleAdapter.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockOracleAdapter` a `all_functions.csv`

### MockReentrantToken
- [ ] Leggere `contracts/mocks/MockReentrantToken.sol`
- [ ] Scrivere `contracts/mocks/MockReentrantToken.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockReentrantToken` a `all_functions.csv`

### MockSimpleSwap
- [ ] Leggere `contracts/mocks/MockSimpleSwap.sol`
- [ ] Scrivere `contracts/mocks/MockSimpleSwap.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockSimpleSwap` a `all_functions.csv`

### MockChainlinkOracle _(root)_
- [ ] Leggere `contracts/MockChainlinkOracle.sol`
- [ ] Scrivere `contracts/mocks/MockChainlinkOracle.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockChainlinkOracle` a `all_functions.csv`

### MockERC20 _(root)_
- [ ] Leggere `contracts/MockERC20.sol`
- [ ] Scrivere `contracts/mocks/MockERC20.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockERC20` a `all_functions.csv`

### MockWETH _(root)_
- [ ] Leggere `contracts/MockWETH.sol`
- [ ] Scrivere `contracts/mocks/MockWETH.md` (scopo, tabella funzioni, nota "solo per test")
- [ ] Aggiungere righe di `MockWETH` a `all_functions.csv`

---

## CSV — VERIFICA E FINALIZZAZIONE
> Da eseguire dopo aver completato tutte le estrazioni sopra

- [ ] Controllare che non ci siano virgole non quotate nei campi stringa
- [ ] Controllare che il campo `StateMutability` sia presente per ogni riga
- [ ] Verificare che `constructor`, `receive`, `fallback` siano inclusi dove presenti
- [ ] Ordinare le righe per `Contract` poi `FunctionName`
- [ ] Salvare il file `all_functions.csv`
- [ ] Aprire il CSV in un foglio di calcolo per verifica visiva rapida

---

## FILE .md — VERIFICA E FINALIZZAZIONE
> Da eseguire dopo aver completato tutti i file .md sopra

- [ ] Controllare che ogni .md abbia tutte le sezioni richieste (metadata, scopo, storage, funzioni, events, errors, sicurezza, dipendenze)
- [ ] Verificare che le tabelle siano ben formate (colonne allineate, nessuna cella vuota non intenzionale)
- [ ] Verificare che le dipendenze siano coerenti tra i file (es. se A importa B, la sezione Dipendenze di A lo deve riportare)

---

## JSON — VERIFICA E FINALIZZAZIONE
> Da eseguire dopo aver aggiunto tutti i moduli al JSON

- [ ] Validare il JSON in VS Code (nessuna squiggle rossa)
- [ ] Verificare che `_complete: true` sia settato solo per funzioni completamente documentate
- [ ] Compilare `_missingFields` per le funzioni incomplete (`_complete: false`)
- [ ] Impostare correttamente `displayOrder` per ogni modulo (Core → Plugins → Registries → Adapters → Services)
- [ ] Salvare il file `api_reference_full.json`

---

## OVERVIEW FINALE
> Da scrivere DOPO aver completato tutti i contratti sopra (i dati sono già stati raccolti)

- [ ] Scrivere `contracts_overview.md` — sezione **Core Contracts** (dati già in memoria dal lavoro precedente)
- [ ] Aggiungere sezione **Plugins**
- [ ] Aggiungere sezione **Registries**
- [ ] Aggiungere sezione **Adapters**
- [ ] Aggiungere sezione **Services**
- [ ] Aggiungere sezione **Interfaces**
- [ ] Aggiungere sezione **Mocks**
- [ ] Aggiungere sezione **Mappa delle Dipendenze** (ricavata dagli import già letti)
- [ ] Salvare il file `contracts_overview.md`
- [ ] Verificare che tutti i contratti siano presenti nel documento

---

## VERIFICA FINALE

- [ ] Aprire `contracts_overview.md` e verificare leggibilità
- [ ] Aprire `all_functions.csv` in un foglio di calcolo: zero errori di formato
- [ ] Spot-check: confrontare 3 file .md a caso con i rispettivi .sol
- [ ] Validare `api_reference_full.json` in VS Code (nessuna squiggle rossa)
- [ ] Aggiornare questo file checklist mettendo `[x]` su tutti i task completati
- [ ] Creare un commit con messaggio: `docs: complete contract documentation (STEP 1-4)`
