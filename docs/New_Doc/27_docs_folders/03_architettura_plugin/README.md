# 3. Architettura: Plugin Modulari

Questa sezione descrive i plugin che integrano protocolli esterni.

## Contenuti

- **3.1 Tipologie di Plugin** - Differenza tra Swap Plugin e Lending Plugin
- **3.2 Plugin Swap** - Interfaccia ISwapPlugin, registrazione in SwapManager
  - **3.2.1 UniswapV3PluginDirect** - Integrazione Uniswap V3, quote e swap
- **3.3 Plugin Lending** - Interfaccia ILendingProtocol, operazioni standard
  - **3.3.1 EulerV2Plugin** - Integrazione Euler V2, sub-account, leverage
  - **3.3.2 AaveV3Plugin** - Integrazione Aave V3, lending + leverage atomico
  - **3.3.3 MorphoPlugin** - Integrazione Morpho Blue, mercati isolati + leverage atomico
  - **3.3.4 GMXv2Plugin** - Integrazione GMX V2, GM Token mint/burn
- **3.4 Plugin Yield** - Plugin supply-only per yield passivo
  - **3.4.1 MorphoVaultPlugin** - Integrazione MetaMorpho vault ERC-4626, deposit/withdraw
- **3.5 Plugin Utility** - FlashLoanService (Balancer V2, 0% fee)
