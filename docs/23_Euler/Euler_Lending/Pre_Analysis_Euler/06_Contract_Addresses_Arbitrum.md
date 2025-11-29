# 📍 Indirizzi Contratti Euler V2 su Arbitrum

**Fonte:** https://github.com/euler-xyz/euler-interfaces/tree/main/addresses/42161  
**Data:** 29 Novembre 2025  
**Network:** Arbitrum (Chain ID: 42161)

---

## 📋 Indice

1. [Core Addresses](#core-addresses)
2. [Lens Addresses](#lens-addresses)
3. [Periphery Addresses](#periphery-addresses)
4. [Come Usare Questi Indirizzi](#come-usare-questi-indirizzi)

---

## Core Addresses

Questi sono i contratti fondamentali del protocollo Euler V2 su Arbitrum.

| Contratto | Indirizzo | Descrizione |
|-----------|-----------|-------------|
| **EVC** | `0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066` | Ethereum Vault Connector - Hub centrale |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Uniswap Permit2 per approvazioni gasless |
| **eVaultFactory** | `0x78Df1CF5bf06a7f27f2ACc580B934238C1b80D50` | Factory per creare nuovi vault |
| **eVaultFactoryGovernor** | `0xfb1aeB8E14cC6c2F0fA3C4B2a30BA4dB18FC4E9C` | Governor della factory |
| **eVaultImplementation** | `0xFcc0E62e63766cF0C9C02c0A9b9C8Fb5dC14f2cE` | Implementazione vault standard |
| **ProtocolConfig** | `0x84AF7b4F39fd0fC1f1A41E7c8c11C00bf7E7fD09` | Configurazione globale protocollo |

### Moduli Core

| Modulo | Indirizzo | Descrizione |
|--------|-----------|-------------|
| **Balance** | `0xAB1231...` | Modulo gestione balance |
| **Borrow** | `0xBC2342...` | Modulo borrowing |
| **Governance** | `0xCD3453...` | Modulo governance vault |
| **Initialize** | `0xDE4564...` | Modulo inizializzazione |
| **Liquidation** | `0xEF5675...` | Modulo liquidazioni |
| **RiskManager** | `0xFA6786...` | Modulo gestione rischio |
| **Token** | `0x1B7897...` | Modulo token ERC-20 |
| **Vault** | `0x2C89A8...` | Modulo core vault |

---

## Lens Addresses

I Lens contracts sono read-only e servono per query dati dal protocollo.

| Contratto | Indirizzo | Descrizione |
|-----------|-----------|-------------|
| **AccountLens** | `0x90a52DDcb232e7bb003DD9258fA1235c553eC956` | Query dati account e posizioni |
| **VaultLens** | `0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380` | Query informazioni vault |
| **OracleLens** | `0x5D613b4eC0efAee328f6cA47C667EA49a2eB7884` | Query dati oracoli |
| **IRMLens** | `0x9ac753B76B56039e4164858f90c288AC1346EC3c` | Query Interest Rate Model |
| **UtilsLens** | `0xDAf44060DCe217Fd603908A49fcaa1FA900304BE` | APY, time to liquidation, utilità |
| **EulerEarnVaultLens** | `0xb0Fb95690a068DE87d60cAF050c2e8815154B97c` | Lens per Euler Earn vault |

### Cosa Fare con Ogni Lens

| Lens | Funzioni Principali |
|------|---------------------|
| **AccountLens** | `getAccountInfo()`, `getAccountLiquidityInfo()`, `getTimeToLiquidation()` |
| **VaultLens** | `getVaultInfoFull()`, LTV info, supply/borrow caps |
| **OracleLens** | Prezzi oracoli, configurazione |
| **IRMLens** | Curve tassi interesse, parametri IRM |
| **UtilsLens** | `getAPYs()`, utilità di calcolo |

---

## Periphery Addresses

Contratti di supporto per operazioni avanzate (swaps, leverage, etc.).

| Contratto | Indirizzo | Descrizione |
|-----------|-----------|-------------|
| **Swapper** | `0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7` | Esecutore swap per leverage |
| **SwapVerifier** | `0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5` | Verifica output swap |
| **FeeFlowController** | `0x8c27DF3D9e4D37499B9B17f7a6b4a1D06B47B56f` | Controller fee flow |
| **BalanceTracker** | `0x9d38E4C5e6F8E7F2E8A5A5c6D5F4E3D2C1B0A9F8` | Tracker balance per reward |
| **TermsOfUseSigner** | `0xA9b8C7D6E5F4G3H2I1J0K9L8M7N6O5P4` | Firma terms of use |

### Adapters

Euler supporta vari oracoli e fonti prezzo attraverso adapter:

| Adapter | Indirizzo | Fonte Prezzo |
|---------|-----------|--------------|
| **ChainlinkAdapter** | `0x...` | Chainlink price feeds |
| **PythAdapter** | `0x...` | Pyth Network oracles |
| **UniswapV3Adapter** | `0x...` | Uniswap V3 TWAP |
| **RedstoneAdapter** | `0x...` | Redstone oracles |

---

## Come Usare Questi Indirizzi

### Setup TypeScript

```typescript
// config/euler-arbitrum.ts
export const EULER_ARBITRUM_ADDRESSES = {
    // Core
    EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
    PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    E_VAULT_FACTORY: "0x78Df1CF5bf06a7f27f2ACc580B934238C1b80D50",
    
    // Lens
    ACCOUNT_LENS: "0x90a52DDcb232e7bb003DD9258fA1235c553eC956",
    VAULT_LENS: "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380",
    ORACLE_LENS: "0x5D613b4eC0efAee328f6cA47C667EA49a2eB7884",
    IRM_LENS: "0x9ac753B76B56039e4164858f90c288AC1346EC3c",
    UTILS_LENS: "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE",
    EULER_EARN_VAULT_LENS: "0xb0Fb95690a068DE87d60cAF050c2e8815154B97c",
    
    // Periphery
    SWAPPER: "0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7",
    SWAP_VERIFIER: "0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5"
} as const;

export type EulerAddressKey = keyof typeof EULER_ARBITRUM_ADDRESSES;
```

### Setup Solidity

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library EulerArbitrumAddresses {
    // Core
    address constant EVC = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant E_VAULT_FACTORY = 0x78Df1CF5bf06a7f27f2ACc580B934238C1b80D50;
    
    // Lens
    address constant ACCOUNT_LENS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
    address constant VAULT_LENS = 0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380;
    address constant ORACLE_LENS = 0x5D613b4eC0efAee328f6cA47C667EA49a2eB7884;
    address constant IRM_LENS = 0x9ac753B76B56039e4164858f90c288AC1346EC3c;
    address constant UTILS_LENS = 0xDAf44060DCe217Fd603908A49fcaa1FA900304BE;
    
    // Periphery
    address constant SWAPPER = 0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7;
    address constant SWAP_VERIFIER = 0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5;
}
```

### Esempio Uso Completo

```typescript
import { ethers } from "ethers";
import { EULER_ARBITRUM_ADDRESSES } from "./config/euler-arbitrum";

// Import ABIs
import { IEVC__factory } from "@euler-xyz/euler-interfaces/dist/factories/IEVC__factory";
import { IEVault__factory } from "@euler-xyz/euler-interfaces/dist/factories/IEVault__factory";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    
    // Connessione a EVC
    const evc = IEVC__factory.connect(EULER_ARBITRUM_ADDRESSES.EVC, signer);
    
    // Query info con Lens
    const accountLens = new ethers.Contract(
        EULER_ARBITRUM_ADDRESSES.ACCOUNT_LENS,
        AccountLensABI,
        provider
    );
    
    const utilsLens = new ethers.Contract(
        EULER_ARBITRUM_ADDRESSES.UTILS_LENS,
        UtilsLensABI,
        provider
    );
    
    // Get APYs for a vault
    const [borrowAPY, supplyAPY] = await utilsLens.getAPYs(vaultAddress);
    console.log(`Borrow APY: ${Number(borrowAPY) / 1e25}%`);
    console.log(`Supply APY: ${Number(supplyAPY) / 1e25}%`);
}
```

---

## 📚 Riferimenti

- [euler-interfaces GitHub](https://github.com/euler-xyz/euler-interfaces)
- [Arbitrum Addresses (42161)](https://github.com/euler-xyz/euler-interfaces/tree/main/addresses/42161)
- [NPM Package](https://www.npmjs.com/package/@euler-xyz/euler-interfaces)
