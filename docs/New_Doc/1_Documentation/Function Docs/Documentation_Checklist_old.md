# Documentation Checklist
> Progetto: TestSmartContract — Solidity Contract Documentation  
> Riferimento: `DocumentationGuideline_Expanded.md`  
> Legenda: `[ ]` = da fare &nbsp;|&nbsp; `[x]` = completato

---

## PRE-REQUISITI

- [ ] Leggere `DocumentationGuideline_Expanded.md` per intero
- [ ] Verificare che `api_reference_beacon.json` sia accessibile come template
- [ ] Creare la cartella `docs/New_Doc/1_Documentation/contracts/` se non esiste
- [ ] Aprire VS Code con il workspace `TestSmartContract`

---

## STEP 1 — OVERVIEW GENERALE

**Output:** `docs/New_Doc/1_Documentation/contracts_overview.md`

### 1.1 — Lettura file sorgente (Core)
- [ ] Leggere `contracts/Beacon.sol` — raccogliere tipo, NatSpec, import
- [ ] Leggere `contracts/ProtocolManager.sol` — raccogliere tipo, NatSpec, import
- [ ] Leggere `contracts/ProxyGeneral.sol` — raccogliere tipo, NatSpec, import
- [ ] Leggere `contracts/ParameterManager.sol` — raccogliere tipo, NatSpec, import
- [ ] Leggere `contracts/Liquiditymanager.sol` — raccogliere tipo, NatSpec, import
- [ ] Leggere `contracts/SwapManager.sol` — raccogliere tipo, NatSpec, import
- [ ] Leggere `contracts/TokenManager.sol` — raccogliere tipo, NatSpec, import
- [ ] Leggere `contracts/ValueCalculator.sol` — raccogliere tipo, NatSpec, import
- [ ] Leggere `contracts/DepositHelper.sol` — raccogliere tipo, NatSpec, import
- [ ] Leggere `contracts/EmergencyHandler.sol` — raccogliere tipo, NatSpec, import

### 1.2 — Lettura file sorgente (Plugins)
- [ ] Leggere `contracts/plugins/AaveV3Plugin.sol`
- [ ] Leggere `contracts/plugins/AaveV3Registry.sol`
- [ ] Leggere `contracts/plugins/DolomitePlugin.sol`
- [ ] Leggere `contracts/plugins/EulerRegistry.sol`
- [ ] Leggere `contracts/plugins/EulerV2Plugin.sol`
- [ ] Leggere `contracts/plugins/MorphoPlugin.sol`
- [ ] Leggere `contracts/plugins/MorphoRegistry.sol`
- [ ] Leggere `contracts/plugins/MorphoVaultPlugin.sol`
- [ ] Leggere `contracts/plugins/UniswapV3Plugin.sol`
- [ ] Leggere `contracts/plugins/UniswapV3PluginDirect.sol`

### 1.3 — Lettura file sorgente (Adapters)
- [ ] Leggere `contracts/adapters/AaveV3LensAdapter.sol`
- [ ] Leggere `contracts/adapters/ChainlinkAdapter.sol`
- [ ] Leggere `contracts/adapters/EulerLensAdapter.sol`
- [ ] Leggere `contracts/adapters/MorphoLensAdapter.sol`
- [ ] Leggere `contracts/adapters/MorphoVaultLensAdapter.sol`

### 1.4 — Lettura file sorgente (Services)
- [ ] Leggere `contracts/services/FlashLoanService.sol`

### 1.5 — Lettura file sorgente (Interfaces — root)
- [ ] Leggere tutti i file `I*.sol` in `contracts/interfaces/` (29 file)
- [ ] Verificare e leggere le sottocartelle: `interfaces/aave/`, `interfaces/balancer/`, `interfaces/euler/`, `interfaces/morpho/`

### 1.6 — Lettura file sorgente (Mocks)
- [ ] Leggere `contracts/mocks/` (11 file) + `MockChainlinkOracle.sol`, `MockERC20.sol`, `MockWETH.sol` (root)

### 1.7 — Scrittura del documento
- [ ] Scrivere sezione **Core Contracts** (tabella: File, Tipo, Descrizione)
- [ ] Scrivere sezione **Plugins** (tabella)
- [ ] Scrivere sezione **Registries** (tabella)
- [ ] Scrivere sezione **Adapters** (tabella)
- [ ] Scrivere sezione **Services** (tabella)
- [ ] Scrivere sezione **Interfaces** (tabella)
- [ ] Scrivere sezione **Mocks** (tabella)
- [ ] Scrivere sezione **Mappa delle Dipendenze** per ogni Core contract
- [ ] Salvare il file `contracts_overview.md`
- [ ] Verificare che tutti i contratti siano presenti nel documento

---

## STEP 2 — CSV GLOBALE DI TUTTE LE FUNZIONI

**Output:** `docs/New_Doc/1_Documentation/all_functions.csv`

### 2.1 — Setup
- [ ] Creare il file CSV con la riga di intestazione:
  `Contract,ContractType,FunctionName,Visibility,StateMutability,Modifiers,Parameters,Returns,Description,AccessControl,Events,Notes`

### 2.2 — Estrazione funzioni (Core)
- [ ] Estrarre tutte le funzioni da `Beacon.sol`
- [ ] Estrarre tutte le funzioni da `ProtocolManager.sol`
- [ ] Estrarre tutte le funzioni da `ProxyGeneral.sol`
- [ ] Estrarre tutte le funzioni da `ParameterManager.sol`
- [ ] Estrarre tutte le funzioni da `Liquiditymanager.sol`
- [ ] Estrarre tutte le funzioni da `SwapManager.sol`
- [ ] Estrarre tutte le funzioni da `TokenManager.sol`
- [ ] Estrarre tutte le funzioni da `ValueCalculator.sol`
- [ ] Estrarre tutte le funzioni da `DepositHelper.sol`
- [ ] Estrarre tutte le funzioni da `EmergencyHandler.sol`

### 2.3 — Estrazione funzioni (Plugins)
- [ ] Estrarre funzioni da `AaveV3Plugin.sol`
- [ ] Estrarre funzioni da `AaveV3Registry.sol`
- [ ] Estrarre funzioni da `DolomitePlugin.sol`
- [ ] Estrarre funzioni da `EulerRegistry.sol`
- [ ] Estrarre funzioni da `EulerV2Plugin.sol`
- [ ] Estrarre funzioni da `MorphoPlugin.sol`
- [ ] Estrarre funzioni da `MorphoRegistry.sol`
- [ ] Estrarre funzioni da `MorphoVaultPlugin.sol`
- [ ] Estrarre funzioni da `UniswapV3Plugin.sol`
- [ ] Estrarre funzioni da `UniswapV3PluginDirect.sol`

### 2.4 — Estrazione funzioni (Adapters)
- [ ] Estrarre funzioni da `AaveV3LensAdapter.sol`
- [ ] Estrarre funzioni da `ChainlinkAdapter.sol`
- [ ] Estrarre funzioni da `EulerLensAdapter.sol`
- [ ] Estrarre funzioni da `MorphoLensAdapter.sol`
- [ ] Estrarre funzioni da `MorphoVaultLensAdapter.sol`

### 2.5 — Estrazione funzioni (Services)
- [ ] Estrarre funzioni da `FlashLoanService.sol`

### 2.6 — Estrazione funzioni (Interfaces)
- [ ] Estrarre funzioni da tutti i file `I*.sol` in `interfaces/`
- [ ] Estrarre funzioni dalle interfacce nelle sottocartelle `aave/`, `balancer/`, `euler/`, `morpho/`

### 2.7 — Estrazione funzioni (Mocks)
- [ ] Estrarre funzioni da tutti i file in `mocks/`
- [ ] Estrarre funzioni da `MockChainlinkOracle.sol`, `MockERC20.sol`, `MockWETH.sol`

### 2.8 — Verifica e finalizzazione CSV
- [ ] Controllare che non ci siano virgole non quotate nei campi stringa
- [ ] Controllare che il campo `StateMutability` sia presente per ogni riga
- [ ] Verificare che `constructor`, `receive`, `fallback` siano inclusi dove presenti
- [ ] Ordinare le righe per `Contract` poi `FunctionName`
- [ ] Salvare il file `all_functions.csv`
- [ ] Aprire il CSV in un foglio di calcolo per verifica visiva rapida

---

## STEP 3 — FILE .md PER OGNI CONTRATTO

**Output:** `docs/New_Doc/1_Documentation/contracts/<ContractName>.md`

### 3.1 — Core Contracts
- [ ] Creare `contracts/ProtocolManager.md`
  - [ ] Tabella metadata (file, tipo, solidity version, eredità)
  - [ ] Sezione Scopo
  - [ ] Tabella Storage Variables
  - [ ] Tabella Costanti e Immutabili
  - [ ] Tabella Funzioni
  - [ ] Tabella Events
  - [ ] Tabella Custom Errors
  - [ ] Sezione Note di Sicurezza
  - [ ] Sezione Dipendenze
- [ ] Creare `contracts/ProxyGeneral.md` (stessa struttura)
- [ ] Creare `contracts/Beacon.md`
- [ ] Creare `contracts/ParameterManager.md`
- [ ] Creare `contracts/LiquidityManager.md`
- [ ] Creare `contracts/SwapManager.md`
- [ ] Creare `contracts/TokenManager.md`
- [ ] Creare `contracts/ValueCalculator.md`
- [ ] Creare `contracts/DepositHelper.md`
- [ ] Creare `contracts/EmergencyHandler.md`

### 3.2 — Plugins
- [ ] Creare `contracts/AaveV3Plugin.md`
- [ ] Creare `contracts/AaveV3Registry.md`
- [ ] Creare `contracts/DolomitePlugin.md`
- [ ] Creare `contracts/EulerRegistry.md`
- [ ] Creare `contracts/EulerV2Plugin.md`
- [ ] Creare `contracts/MorphoPlugin.md`
- [ ] Creare `contracts/MorphoRegistry.md`
- [ ] Creare `contracts/MorphoVaultPlugin.md`
- [ ] Creare `contracts/UniswapV3Plugin.md`
- [ ] Creare `contracts/UniswapV3PluginDirect.md`

### 3.3 — Adapters
- [ ] Creare `contracts/AaveV3LensAdapter.md`
- [ ] Creare `contracts/ChainlinkAdapter.md`
- [ ] Creare `contracts/EulerLensAdapter.md`
- [ ] Creare `contracts/MorphoLensAdapter.md`
- [ ] Creare `contracts/MorphoVaultLensAdapter.md`

### 3.4 — Services
- [ ] Creare `contracts/FlashLoanService.md`

### 3.5 — Interfaces (se > 5 funzioni)
- [ ] Verificare il numero di funzioni per ogni interfaccia
- [ ] Creare file .md per le interfacce con > 5 funzioni
- [ ] Per le interfacce con ≤ 5 funzioni: verificare che siano coperte nel CSV

### 3.6 — Mocks (documentazione ridotta)
- [ ] Creare file .md sintetici per i mock principali
  - [ ] `MockBeacon.md`
  - [ ] `MockProxyGeneral.md`
  - [ ] `MockTokenManager.md`
  - [ ] `MockLiquidityManager.md`
  - [ ] `MockFlashLoanService.md`
  - [ ] Resto dei mock (un file per ciascuno)

### 3.7 — Verifica finale Step 3
- [ ] Controllare che ogni .md abbia tutte le sezioni richieste
- [ ] Verificare che le tabelle siano ben formate (colonne allineate)
- [ ] Verificare che le dipendenze siano coerenti tra i file

---

## STEP 4 — POPOLAZIONE DEL JSON

**Output:** `docs/New_Doc/1_Documentation/api_reference_full.json`

### 4.1 — Setup struttura JSON
- [ ] Creare il file `api_reference_full.json` con la struttura base (version + modules vuoto)
- [ ] Impostare `"version": "3.0.0"`

### 4.2 — Popolamento Core Contracts
- [ ] Aggiungere modulo `protocol_manager` con tutte le funzioni
- [ ] Aggiungere modulo `proxy_general`
- [ ] Aggiungere modulo `beacon`
- [ ] Aggiungere modulo `parameter_manager`
- [ ] Aggiungere modulo `liquidity_manager`
- [ ] Aggiungere modulo `swap_manager`
- [ ] Aggiungere modulo `token_manager`
- [ ] Aggiungere modulo `value_calculator`
- [ ] Aggiungere modulo `deposit_helper`
- [ ] Aggiungere modulo `emergency_handler`

### 4.3 — Popolamento Plugins
- [ ] Aggiungere modulo `aave_v3_plugin`
- [ ] Aggiungere modulo `aave_v3_registry`
- [ ] Aggiungere modulo `dolomite_plugin`
- [ ] Aggiungere modulo `euler_registry`
- [ ] Aggiungere modulo `euler_v2_plugin`
- [ ] Aggiungere modulo `morpho_plugin`
- [ ] Aggiungere modulo `morpho_registry`
- [ ] Aggiungere modulo `morpho_vault_plugin`
- [ ] Aggiungere modulo `uniswap_v3_plugin`
- [ ] Aggiungere modulo `uniswap_v3_plugin_direct`

### 4.4 — Popolamento Adapters e Services
- [ ] Aggiungere modulo `aave_v3_lens_adapter`
- [ ] Aggiungere modulo `chainlink_adapter`
- [ ] Aggiungere modulo `euler_lens_adapter`
- [ ] Aggiungere modulo `morpho_lens_adapter`
- [ ] Aggiungere modulo `morpho_vault_lens_adapter`
- [ ] Aggiungere modulo `flash_loan_service`

### 4.5 — Verifica e finalizzazione JSON
- [ ] Validare il JSON (nessun errore di sintassi)
- [ ] Verificare che `_complete: true` sia settato solo per funzioni completamente documentate
- [ ] Compilare `_missingFields` per le funzioni incomplete
- [ ] Impostare correttamente `displayOrder` per ogni modulo
- [ ] Salvare il file `api_reference_full.json`

---

## VERIFICA FINALE

- [ ] Aprire `contracts_overview.md` e verificare leggibilità
- [ ] Aprire `all_functions.csv` in un foglio di calcolo: zero errori di formato
- [ ] Spot-check: verificare 3 file .md a caso contro i rispettivi .sol
- [ ] Validare `api_reference_full.json` con un JSON validator online o in VS Code
- [ ] Aggiornare questo file checklist mettendo `[x]` su tutti i task completati
- [ ] Creare un commit con messaggio: `docs: complete contract documentation (STEP 1-4)`
