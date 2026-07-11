# 🏦 EVK - Interazione con i Vault

**Fonte:** https://docs.euler.finance/developers/evk/interacting-with-vaults  
**Data:** 29 Novembre 2025  
**Network:** Arbitrum

---

## 📋 Indice

1. [Panoramica](#panoramica)
2. [Operazioni Base](#operazioni-base)
   - [Deposit](#deposit---depositare-asset)
   - [Withdraw](#withdraw---prelevare-asset)
   - [Borrow](#borrow---prendere-in-prestito)
   - [Repay](#repay---ripagare-il-debito)
3. [Permit2 per Gasless Approvals](#permit2-per-gasless-approvals)
4. [Batching Operations](#batching-operations)
5. [Flash Liquidity](#flash-liquidity)
6. [Exchange Rate e Shares](#exchange-rate-e-shares)
7. [Pyth Oracles](#working-with-pyth-oracles)
8. [Esempi di Codice Completi](#esempi-di-codice-completi)

---

## Panoramica

I vault Euler (EVK) sono contratti **ERC-4626** con funzionalità aggiuntive di borrowing. A differenza dei vault ERC-4626 standard che guadagnano yield investendo attivamente i fondi, i credit vault di Euler sono **pool di lending passivi**.

### Punti Chiave

- **Un asset per vault**: Ogni vault detiene esattamente un token ERC-20 sottostante
- **Shares = proprietà proporzionale**: Le shares rappresentano la quota del vault posseduta
- **Exchange rate cresce**: Man mano che gli interessi maturano, l'exchange rate aumenta
- **EVC raccomandato**: L'Ethereum Vault Connector (EVC) è il punto di ingresso raccomandato

> ⚠️ **IMPORTANTE**: Mentre è possibile interagire direttamente con i vault, l'approccio raccomandato è usare l'EVC come punto di ingresso principale. L'EVC fornisce batching, sub-accounts, simulazioni e altre funzionalità avanzate.

---

## Operazioni Base

### Deposit - Depositare Asset

Per depositare asset in un vault:

1. **Approvare** il vault a spendere i tuoi token
2. **Chiamare** la funzione `deposit`

```solidity
// Step 1: Approvare il vault
IERC20(underlying).approve(vault, amount);

// Step 2: Depositare
IEVault(vault).deposit(amount, receiver);
```

**Parametri:**
| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `amount` | uint256 | Quantità di token sottostanti da depositare |
| `receiver` | address | Indirizzo che riceverà le vault shares |

**Il `receiver` può essere:**
- Il tuo indirizzo principale
- Un indirizzo sub-account EVC (per posizioni isolate)
- Un altro indirizzo (se depositi per conto di qualcun altro)

---

### Withdraw - Prelevare Asset

Per prelevare asset da un vault:

```solidity
IEVault(vault).withdraw(amount, receiver, owner);
```

**Parametri:**
| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `amount` | uint256 | Quantità di token sottostanti da prelevare |
| `receiver` | address | Indirizzo che riceverà i token sottostanti |
| `owner` | address | Indirizzo che possiede le vault shares |

**L'`owner` può essere:**
- Il tuo indirizzo principale
- Un indirizzo sub-account EVC (se prelevi da un sub-account)
- Un altro indirizzo (se prelevi per conto di qualcun altro, dopo aver ottenuto approvazione)

---

### Borrow - Prendere in Prestito

Prima di prendere in prestito, devi (assumendo che il collaterale sia già depositato):

1. **Abilitare** il vault come collaterale nell'EVC
2. **Abilitare** il vault come controller nell'EVC

```solidity
// Step 1: Abilitare il vault come collaterale
IEVC(evc).enableCollateral(account, collateralVault);

// Step 2: Abilitare il vault come controller
IEVC(evc).enableController(account, borrowVault);

// Step 3: Prendere in prestito
IEVault(vault).borrow(amount, receiver);
```

**Parametri:**
| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `amount` | uint256 | Quantità di token sottostanti da prendere in prestito |
| `receiver` | address | Indirizzo che riceverà i token presi in prestito |

> ⚠️ **NOTA**: Il debito sarà di proprietà dell'account che è il chiamante della funzione (o quello per conto del quale l'operazione è stata eseguita).

---

### Repay - Ripagare il Debito

Per ripagare gli asset presi in prestito:

```solidity
// Step 1: Approvare il vault (o usare Permit2)
IERC20(token).approve(vault, amount);

// Step 2: Ripagare il debito
IEVault(vault).repay(amount, receiver);
```

**Parametri:**
| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `amount` | uint256 | Quantità di token sottostanti da ripagare |
| `receiver` | address | Indirizzo che possiede il debito da ripagare |

> ⚠️ **NOTA**: Puoi ripagare il debito solo per l'account che possiede il debito (l'account che ha abilitato il controller).

---

## Permit2 per Gasless Approvals

I vault EVK supportano **Permit2** per approvazioni gasless. Questo permette agli utenti di approvare la spesa dei token tramite una firma invece di una transazione separata.

### Come Funziona

1. **Prima volta**: Approvare il contratto Permit2 (una sola volta)

```solidity
IERC20(underlying).approve(PERMIT2_ADDRESS, type(uint256).max);
```

2. **Poi**: Usare la funzione permit per concedere approvazione tramite firma

```solidity
// La funzione permit in Permit2
function permit(
    address owner,
    PermitSingle memory permitSingle,
    bytes calldata signature
) external;
```

### Vantaggi di Permit2

| Vantaggio | Descrizione |
|-----------|-------------|
| **Sicurezza** | Separa l'approvazione di Permit2 (una tantum) dalle approvazioni individuali ai vault |
| **Batching** | Abilita il raggruppamento di più operazioni in una singola transazione |
| **Interfaccia consistente** | Fornisce un'interfaccia uniforme per tutti i token |
| **Fallback EIP-7702** | Utile dove EIP-7702 non è disponibile |

### Flusso di Approvazione EVK

1. Quando un utente vuole depositare, il vault prova prima a usare Permit2
2. Se Permit2 fallisce, il vault fa fallback a `transferFrom` standard
3. L'approvazione Permit2 una tantum può essere riutilizzata su più vault e protocolli

---

## Batching Operations

L'EVC permette di raggruppare più operazioni in una singola transazione atomica usando la struct `BatchItem`:

```solidity
struct BatchItem {
    // Il contratto target da chiamare
    address targetContract;
    
    // L'account per conto del quale eseguire l'operazione
    // Deve essere address(0) se il target è l'EVC stesso
    address onBehalfOfAccount;
    
    // L'ammontare di value da inoltrare con la chiamata
    // Se type(uint256).max, tutto il balance dell'EVC sarà inoltrato
    // Deve essere 0 se il target è l'EVC stesso
    uint256 value;
    
    // I dati encodati da chiamare sul contratto target
    bytes data;
}
```

### Esempio: Deposit + Enable Collateral + Enable Controller + Borrow

```solidity
IEVC.BatchItem[] memory items = new IEVC.BatchItem[](4);

// Nota: Assumiamo che i token siano già approvati per il vault

// 1. Depositare collaterale
items[0] = IEVC.BatchItem({
    targetContract: collateralVault,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        IEVault.deposit.selector,
        collateralAmount,
        account
    )
});

// 2. Abilitare collaterale
items[1] = IEVC.BatchItem({
    targetContract: evc,
    onBehalfOfAccount: address(0),
    value: 0,
    data: abi.encodeWithSelector(
        IEVC.enableCollateral.selector,
        account,
        collateralVault
    )
});

// 3. Abilitare controller
items[2] = IEVC.BatchItem({
    targetContract: evc,
    onBehalfOfAccount: address(0),
    value: 0,
    data: abi.encodeWithSelector(
        IEVC.enableController.selector,
        account,
        borrowVault
    )
});

// 4. Prendere in prestito
items[3] = IEVC.BatchItem({
    targetContract: borrowVault,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        IEVault.borrow.selector,
        amount,
        receiver
    )
});

// Eseguire il batch
IEVC(evc).batch(items);
```

---

## Flash Liquidity

L'EVC permette di prendere in prestito e ripagare nella stessa transazione **senza richiedere collaterale**. Utile per flash loans e operazioni atomiche.

```solidity
IEVC.BatchItem[] memory items = new IEVC.BatchItem[](4);

// 1. Abilitare controller (richiesto per il borrow)
items[0] = IEVC.BatchItem({
    targetContract: evc,
    onBehalfOfAccount: address(0),
    value: 0,
    data: abi.encodeWithSelector(
        IEVC.enableController.selector,
        account,
        vault
    )
});

// 2. Prendere in prestito
items[1] = IEVC.BatchItem({
    targetContract: vault,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        IEVault.borrow.selector,
        amount,
        account
    )
});

// 3. Ripagare
items[2] = IEVC.BatchItem({
    targetContract: vault,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        IEVault.repay.selector,
        amount,
        account
    )
});

// 4. Disabilitare controller
items[3] = IEVC.BatchItem({
    targetContract: vault,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        IEVault.disableController.selector
    )
});

IEVC(evc).batch(items);
```

### Questo pattern permette di:

- ✅ Abilitare il controller per il borrowing
- ✅ Prendere in prestito asset senza collaterale
- ✅ Usare gli asset presi in prestito per qualsiasi scopo (aggiungere batch item tra 1 e 2)
- ✅ Ripagare il debito nella stessa transazione
- ✅ Disabilitare liberamente il controller
- ✅ Mantenere atomicità e sicurezza

---

## Exchange Rate e Shares

I vault EVK implementano lo standard **ERC-4626**, dove le shares rappresentano claim proporzionali sugli asset del vault.

### Formula Exchange Rate

```
exchangeRate = (cash + totalBorrows + VIRTUAL_DEPOSIT) / (totalShares + VIRTUAL_DEPOSIT)
```

Dove:
- `cash` = asset liquidi nel vault
- `totalBorrows` = totale prestiti in essere
- `VIRTUAL_DEPOSIT` = costante definita come `1e6`

### Caratteristiche

| Aspetto | Descrizione |
|---------|-------------|
| **Crescita** | L'exchange rate cresce man mano che gli interessi maturano |
| **Decimali** | Le shares mantengono gli stessi decimali dell'asset sottostante |
| **Virtual deposit** | Previene manipolazioni e assicura che l'exchange rate sia ben definito anche con zero shares |

---

## Working with Pyth Oracles

Alcuni vault Euler V2 si basano su **oracoli pull-based come Pyth**, che richiedono gestione speciale rispetto agli oracoli push-based tradizionali.

### La Sfida

Quando lavori con vault alimentati da Pyth, potresti incontrare:
- Transazioni che revertano per errori oracolo
- Fallimenti intermittenti nelle query dei dati vault
- Operazioni che falliscono imprevedibilmente in base al timing

### Soluzione: Aggiornare i Prezzi nei Batch

Per qualsiasi interazione con vault alimentati da Pyth:

1. **Recuperare** dati freschi dei prezzi dall'API Pyth
2. **Includere** un aggiornamento prezzi come primo item nel batch EVC
3. **Eseguire** le operazioni desiderate

### Esempio: Borrow con Price Update

```javascript
// 1. Recuperare price updates dall'API Pyth
const priceIds = ['0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace']; // ETH/USD

// 2. Ottenere price update data da Hermes API
const pythApiUrl = 'https://hermes.pyth.network/v2/updates/price/latest';
const response = await fetch(`${pythApiUrl}?ids[]=${priceIds.join('&ids[]=')}&encoding=hex`);
const data = await response.json();
const priceUpdateData = data.binary.data;

// 3. Creare batch con price update prima
const batchItems = [
    // Prima: Aggiornare prezzi Pyth
    {
        targetContract: pythOracleAddress,
        onBehalfOfAccount: account,
        value: 0n, // Pyth potrebbe richiedere una fee
        data: encodeFunctionData({
            abi: pythAbi,
            functionName: 'updatePriceFeeds',
            args: [priceUpdateData]
        })
    },
    // Poi: L'operazione di borrow
    {
        targetContract: vaultAddress,
        onBehalfOfAccount: account,
        value: 0n,
        data: encodeFunctionData({
            abi: vaultAbi,
            functionName: 'borrow',
            args: [amount, receiver]
        })
    }
];

// 4. Eseguire il batch
await walletClient.writeContract({
    address: evcAddress,
    abi: evcAbi,
    functionName: 'batch',
    args: [batchItems]
});
```

### Query con Simulazioni

Per operazioni read-only, usare `batchSimulation`:

```javascript
const simulationItems = [
    // Prima: Simulare price update
    {
        targetContract: pythOracleAddress,
        onBehalfOfAccount: account,
        value: 0n,
        data: encodeFunctionData({
            abi: pythAbi,
            functionName: 'updatePriceFeeds',
            args: [priceUpdateData]
        })
    },
    // Poi: Query account data
    {
        targetContract: lensAddress,
        onBehalfOfAccount: account,
        value: 0n,
        data: encodeFunctionData({
            abi: lensAbi,
            functionName: 'getAccountInfo',
            args: [account, vault]
        })
    }
];

// Simulare il batch
const { result } = await publicClient.simulate({
    address: evcAddress,
    abi: evcAbi,
    functionName: 'batchSimulation',
    args: [simulationItems]
});
```

### Punti Chiave Pyth

- ✅ **Sempre verificare** se un vault usa Pyth controllando l'oracle address
- ✅ **Update fees**: Pyth può addebitare fee per gli aggiornamenti - controllare `getUpdateFee()`
- ✅ **Staleness period**: Gli oracoli Pyth hanno periodi di staleness molto corti (2-3 minuti)

---

## Esempi di Codice Completi

### TypeScript/ethers.js - Deposit Completo

```typescript
import { ethers } from 'ethers';

// Indirizzi Arbitrum
const EVC_ADDRESS = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

async function depositToVault(
    signer: ethers.Signer,
    vaultAddress: string,
    underlyingAddress: string,
    amount: bigint,
    receiver: string
) {
    const underlying = new ethers.Contract(underlyingAddress, ERC20_ABI, signer);
    const vault = new ethers.Contract(vaultAddress, EVAULT_ABI, signer);
    
    // Step 1: Approvare (o usare Permit2)
    const currentAllowance = await underlying.allowance(
        await signer.getAddress(),
        vaultAddress
    );
    
    if (currentAllowance < amount) {
        const approveTx = await underlying.approve(vaultAddress, amount);
        await approveTx.wait();
        console.log("Approvazione completata");
    }
    
    // Step 2: Depositare
    const depositTx = await vault.deposit(amount, receiver);
    const receipt = await depositTx.wait();
    
    console.log(`Deposit completato. TX: ${receipt.hash}`);
    
    // Verificare shares ricevute
    const shares = await vault.balanceOf(receiver);
    console.log(`Shares ricevute: ${shares}`);
    
    return receipt;
}
```

### Solidity - Contratto di Integrazione

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@euler-xyz/euler-interfaces/interfaces/IEVault.sol";
import "@euler-xyz/euler-interfaces/interfaces/IEthereumVaultConnector.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EulerIntegration {
    IEVC public immutable evc;
    
    constructor(address _evc) {
        evc = IEVC(_evc);
    }
    
    /**
     * @notice Deposita asset in un vault
     * @param vault Indirizzo del vault
     * @param amount Quantità da depositare
     * @param receiver Chi riceve le shares
     */
    function deposit(
        address vault,
        uint256 amount,
        address receiver
    ) external returns (uint256 shares) {
        address underlying = IEVault(vault).asset();
        
        // Trasferire token dal chiamante
        IERC20(underlying).transferFrom(msg.sender, address(this), amount);
        
        // Approvare il vault
        IERC20(underlying).approve(vault, amount);
        
        // Depositare
        shares = IEVault(vault).deposit(amount, receiver);
    }
    
    /**
     * @notice Prende in prestito con collaterale già depositato
     * @param collateralVault Vault del collaterale
     * @param borrowVault Vault da cui prendere in prestito
     * @param borrowAmount Quantità da prendere in prestito
     */
    function borrow(
        address collateralVault,
        address borrowVault,
        uint256 borrowAmount
    ) external returns (uint256) {
        // Preparare batch items
        IEVC.BatchItem[] memory items = new IEVC.BatchItem[](3);
        
        // 1. Abilitare collaterale
        items[0] = IEVC.BatchItem({
            targetContract: address(evc),
            onBehalfOfAccount: address(0),
            value: 0,
            data: abi.encodeWithSelector(
                IEVC.enableCollateral.selector,
                msg.sender,
                collateralVault
            )
        });
        
        // 2. Abilitare controller
        items[1] = IEVC.BatchItem({
            targetContract: address(evc),
            onBehalfOfAccount: address(0),
            value: 0,
            data: abi.encodeWithSelector(
                IEVC.enableController.selector,
                msg.sender,
                borrowVault
            )
        });
        
        // 3. Prendere in prestito
        items[2] = IEVC.BatchItem({
            targetContract: borrowVault,
            onBehalfOfAccount: msg.sender,
            value: 0,
            data: abi.encodeWithSelector(
                IEVault.borrow.selector,
                borrowAmount,
                msg.sender
            )
        });
        
        // Eseguire batch
        evc.batch(items);
        
        return borrowAmount;
    }
}
```

---

## 📚 Riferimenti

- [EVK Overview](https://docs.euler.finance/developers/evk/)
- [Interacting with Vaults](https://docs.euler.finance/developers/evk/interacting-with-vaults)
- [EVK Whitepaper](https://github.com/euler-xyz/euler-vault-kit/blob/master/docs/whitepaper.md)
- [EVK GitHub Repository](https://github.com/euler-xyz/euler-vault-kit)
- [Permit2 Documentation](https://github.com/uniswap/permit2)
