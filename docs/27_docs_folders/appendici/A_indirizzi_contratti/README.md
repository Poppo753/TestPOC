# Appendice A: Indirizzi Contratti

Tutti gli indirizzi dei contratti deployed su **Arbitrum One** (chain ID: 42161).

> **Ultimo aggiornamento**: 2 Aprile 2026  
> **Deployer**: `0x8390e98483a9b39265428c8610371134B5d11C3F`

---

## Contratti Core

| Contratto | Indirizzo | Ruolo |
|---|---|---|
| Beacon | `0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870` | Registro moduli + emergency freeze |
| ProxyGeneral | `0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1` | Custody unica per tutti i token |
| ProtocolManager | `0x5b8314319CB56864b002caFEB92540B7A7559fBB` | Orchestrazione unificata plugin |
| TokenManager | `0xc4c8581a7Cbb4e046adB6A6e9008375F38441517` | Gestione token supportati |
| ParameterManager | `0xe5401565c77B41A5206e3E1b6A2b7F54E93bED5e` | Parametri di configurazione |
| ValueCalculator | `0x2E042874BcFc6bE51e0D6b23F8Da22bDd8B215B0` | Calcolo valore portfolio |
| ChainlinkAdapter | `0x018f6392eb912624930d68c3c226b707B1D8B2A7` | Oracle Chainlink |
| EmergencyHandler | `0xcaf7DD1cA3A5857893D97BA3A9C029986A5CAc66` | Gestione emergenze |
| LiquidityManager | `0xfb26C7A0CF5b4e86Dcf870b2349A29DA4F630150` | Gestione liquidità |
| SwapManager | `0xA1b7B8C442c3c1F342BB9C44b7d0733D0c9Ff357` | Routing swap |

---

## Plugin Swap

| Contratto | Indirizzo | Ruolo |
|---|---|---|
| UniswapV3Plugin | `0x7ec91aEc1bD85E63D671b23E5deC8157D1f8aE01` | Swap via Uniswap V3 |

---

## Plugin Lending — Aave V3

| Contratto | Indirizzo | Ruolo |
|---|---|---|
| AaveV3Plugin | `0x7aEA35f66d054bB6C68957A8A27b10F08c33aA7A` | Lending + Leverage (flash loan) |
| AaveV3LensAdapter | `0xF9d5Cb5a86f0aD469f37F08B27AEf7FdF46ac3E3` | Query posizioni, health factor |
| AaveV3Registry | `0xEeb0EA1C430E956266C8027E39cA7A5C855B1a73` | Token config (WETH, USDC, USDT, WBTC) |

**Protocollo esterno**: Aave V3 Pool `0x794a61358D6845594F94dc1DB02A252b5b4814aD`

---

## Plugin Lending — Euler V2

| Contratto | Indirizzo | Ruolo |
|---|---|---|
| EulerV2Plugin | `0x383cc6487772bc1AABd2e74884ad23F313005ACB` | Lending + Leverage (flash loan + EVC batch) |
| EulerLensAdapter | `0xfb76C4475149F1843bdF1d327569A12a027Be833` | Query posizioni, health factor, time-to-liquidation |
| EulerRegistry | `0xe55c78577c84E2cB6E71F8Eb134a66e7B1d9fd56` | Vault config (WETH, USDC) |

**Protocollo esterno**: EVC `0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066`

---

## Plugin Lending — Morpho Blue (Market)

| Contratto | Indirizzo | Ruolo |
|---|---|---|
| MorphoPlugin | `0xf653f0E3FddA2937C2A76C385FA381599BDb65dB` | Lending + Leverage (flash loan) |
| MorphoLensAdapter | `0x37CbA12B65fA59f1D242a02c955b0C87db4d5088` | Query posizioni, health factor, risk |
| MorphoRegistry | `0xe2e3a074aC000c087fCa87ae2fe0741139660f94` | Market + Vault config (condiviso) |

**Protocollo esterno**: Morpho Blue Singleton `0x6c247b1F6182318877311737BaC0844bAa518F5e`

---

## Plugin Yield — Morpho Vault (MetaMorpho)

| Contratto | Indirizzo | Ruolo |
|---|---|---|
| MorphoVaultPlugin | `0x118fd15a78C0Dada24c49343A55142938Ca1868E` | Deposit/Withdraw ERC-4626 vault (supply-only) |
| MorphoVaultLensAdapter | `0xd5dE87464d1C77417f5a47C8B5F73f7B351F47Cc` | Query posizioni vault, shares, APY |

**Vault configurati**:

| Vault | Indirizzo | Asset | Default |
|---|---|---|---|
| HexaOne USDC | `0xaE73875437c86abb60cD7fA77286D63cb94F9a25` | USDC | ✅ |
| Clearstar USDC Reactor | `0xa53Cf822FE93002aEaE16d395CD823Ece161a6AC` | USDC | — |
| usdc staging | `0xd2d46099B70880e268B0c7557b9D22d3AA848654` | USDC | — |

---

## Servizi Condivisi

| Contratto | Indirizzo | Ruolo |
|---|---|---|
| FlashLoanService | `0x3486b561CA1E3Dc146F97D8Ed4B9e4f2cd10822d` | Flash loan Balancer V2 (0% fee) — usato da Aave, Euler, Morpho |

**Balancer Vault**: `0xBA12222222228d8Ba445958a75a0704d566BF2C8`  
**SimpleSwap**: `0xa0DB78167CBAccD47524a261b7741C6B41Bbd096`

---

## Riepilogo Operativo

| Protocollo | Plugin | Lens | Registry | Flash Loan | Leva | Tipo |
|---|---|---|---|---|---|---|
| **Aave V3** | ✅ | ✅ | ✅ | ✅ | ✅ | LENDING |
| **Euler V2** | ✅ | ✅ | ✅ | ✅ | ✅ | LENDING |
| **Morpho Market** | ✅ | ✅ | ✅ (shared) | ✅ | ✅ | LENDING |
| **Morpho Vault** | ✅ | ✅ | ✅ (shared) | ❌ | ❌ | YIELD |
| **Uniswap V3** | ✅ | — | — | — | — | SWAP |
