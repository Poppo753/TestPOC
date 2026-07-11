# 💱 Swaps e Posizioni con Leva

**Fonte:** https://docs.euler.finance/developers/periphery/swaps  
**Data:** 29 Novembre 2025  
**Network:** Arbitrum

---

## 📋 Indice

1. [Perché gli Swap sono Importanti](#perché-gli-swap-sono-importanti)
2. [Come Vengono Eseguiti gli Swap](#come-vengono-eseguiti-gli-swap)
3. [Contratti Swapper e SwapVerifier](#contratti-swapper-e-swapverifier)
4. [Modalità di Swap](#modalità-di-swap)
5. [Flussi di Swap Comuni](#flussi-di-swap-comuni)
6. [Open Leverage - Dettaglio](#open-leverage---dettaglio)
7. [Close Leverage / Swap-to-Repay](#close-leverage--swap-to-repay)
8. [Handlers e Meta-Aggregators](#handlers-e-meta-aggregators)
9. [Sicurezza e Best Practices](#sicurezza-e-best-practices)
10. [Esempi di Codice](#esempi-di-codice)

---

## Perché gli Swap sono Importanti

Gli swap sono un **building block fondamentale** del protocollo Euler V2, permettendo di:

| Caso d'Uso | Descrizione |
|------------|-------------|
| **Aprire posizioni con leva** | Prendere in prestito un asset, swapparlo per collaterale, depositare — tutto in un batch |
| **Chiudere o ribilanciare posizioni** | Prelevare collaterale, swappare per l'asset del debito, ripagare — in una singola transazione |
| **Liquidazioni** | Il collaterale può essere swappato per l'asset di liability per ripagare il debito |

Tradizionalmente, questi workflow richiedevano step manuali multipli o smart contract specializzati. L'integrazione nativa degli swap di Euler semplifica il processo, rendendolo seamless ed efficiente.

---

## Come Vengono Eseguiti gli Swap

Gli swap in Euler sono eseguiti come parte di un **batch di operazioni via EVC**. Questo significa che puoi combinare prelievi, swap, depositi e ripagamenti in una singola transazione atomica.

### Flusso Tipico

```
1. Prelevare o prendere in prestito l'asset che vuoi swappare
         ↓
2. Inviarlo a un contratto periphery (lo Swapper)
         ↓
3. Eseguire lo swap su un DEX esterno via Swapper
         ↓
4. Depositare o ripagare con l'asset swappato
         ↓
5. Verificare il risultato con SwapVerifier
```

### Vantaggi

- ✅ **Riduzione gas**: Una sola transazione invece di multiple
- ✅ **Riduzione rischio**: Atomicità garantisce che tutto riesca o fallisca insieme
- ✅ **No slippage tra step**: L'operazione è atomica

---

## Contratti Swapper e SwapVerifier

### Swapper

| Caratteristica | Descrizione |
|----------------|-------------|
| **Ruolo** | Contratto flessibile che esegue swap usando DEX o aggregatori esterni |
| **Trust** | **UNTRUSTED** - può essere sostituito o personalizzato |
| **Access control** | Nessuno - chiunque può interagire o prelevare token che detiene |
| **Comportamento** | Agisce come "black box" dalla prospettiva del protocollo |

### SwapVerifier

| Caratteristica | Descrizione |
|----------------|-------------|
| **Ruolo** | Contratto che verifica l'esito degli swap |
| **Trust** | **TRUSTED** - completamente auditato |
| **Funzione** | Assicura che l'ammontare ricevuto (o ripagato) corrisponda alle aspettative |
| **Protezione** | Enforce slippage e limiti di price impact |

> ⚠️ **SEMPRE usare SwapVerifier dopo Swapper** nel tuo batch EVC per sicurezza!

### Indirizzi su Arbitrum

| Contratto | Indirizzo |
|-----------|-----------|
| Swapper | `0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7` |
| SwapVerifier | `0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5` |

---

## Modalità di Swap

Euler supporta tre modalità principali di swap:

### 1. Exact Input

| Aspetto | Descrizione |
|---------|-------------|
| **Comportamento** | Swappa una quantità nota di token input per il massimo output possibile |
| **Caso d'uso** | Maggior parte dei payload degli aggregatori DEX |
| **Esempio** | "Swap esattamente 1000 USDC per il massimo ETH possibile" |

### 2. Exact Output

| Aspetto | Descrizione |
|---------|-------------|
| **Comportamento** | Swappa il minimo input necessario per ricevere una quantità specifica di output |
| **Surplus** | L'input non usato viene ri-depositato per l'utente |
| **Esempio** | "Swap il minimo USDC necessario per ottenere esattamente 1 ETH" |

### 3. Target Debt (Swap-to-Repay)

| Aspetto | Descrizione |
|---------|-------------|
| **Comportamento** | Swappa abbastanza per ripagare un target di debito specifico (spesso zero per chiudere posizione) |
| **Surplus** | Qualsiasi surplus viene depositato per l'utente |
| **Esempio** | "Swappa abbastanza ETH per ripagare tutto il mio debito USDC" |

---

## Flussi di Swap Comuni

### 1. Open Leverage (Aprire Posizione con Leva)

```
┌─────────────────────────────────────────────────────────┐
│                    OPEN LEVERAGE                        │
├─────────────────────────────────────────────────────────┤
│  1. Borrow asset → inviare a Swapper                    │
│  2. Swapper esegue swap (exact input)                   │
│  3. Depositare output come collaterale                  │
│  4. SwapVerifier verifica risultato                     │
└─────────────────────────────────────────────────────────┘
```

**Esempio**: Vuoi 3x leva su ETH
1. Deposita 1 ETH come collaterale
2. Prendi in prestito 2000 USDC (basato su LTV)
3. Swappa 2000 USDC → ~0.8 ETH (via Swapper)
4. Deposita 0.8 ETH come collaterale aggiuntivo
5. SwapVerifier verifica che hai ricevuto abbastanza ETH

**Risultato**: Hai esposizione a ~1.8 ETH con solo 1 ETH iniziale

### 2. Swap Collateral (Cambiare Tipo di Collaterale)

```
┌─────────────────────────────────────────────────────────┐
│                   SWAP COLLATERAL                       │
├─────────────────────────────────────────────────────────┤
│  1. Withdraw collaterale → inviare a Swapper            │
│  2. Swapper swappa per target collateral asset          │
│  3. Depositare output come nuovo collaterale            │
│  4. SwapVerifier verifica risultato                     │
└─────────────────────────────────────────────────────────┘
```

**Esempio**: Cambiare collaterale da WBTC a ETH
1. Preleva WBTC dal vault collaterale
2. Swappa WBTC → ETH (via Swapper)
3. Deposita ETH nel nuovo vault collaterale
4. SwapVerifier verifica l'ammontare

### 3. Swap-to-Repay (Chiudere Posizione)

```
┌─────────────────────────────────────────────────────────┐
│                    SWAP-TO-REPAY                        │
├─────────────────────────────────────────────────────────┤
│  1. Withdraw collaterale → inviare a Swapper            │
│  2. Swapper swappa per liability asset (target debt)    │
│  3. SwapVerifier verifica che debito è ripagato         │
└─────────────────────────────────────────────────────────┘
```

**Esempio**: Chiudere posizione leveraged
1. Preleva tutto il collaterale ETH
2. Swappa abbastanza ETH → USDC per ripagare il debito
3. SwapVerifier verifica che debito = 0
4. ETH rimanente torna al tuo wallet

---

## Open Leverage - Dettaglio

Ecco un esempio completo di come aprire una posizione con leva.

### Scenario

- **Collaterale iniziale**: 1 ETH
- **Leva desiderata**: 3x
- **Asset di debito**: USDC
- **Obiettivo**: Esposizione totale a ~3 ETH

### Flusso delle Operazioni

```solidity
IEVC.BatchItem[] memory items = new IEVC.BatchItem[](7);

// 1. Depositare collaterale iniziale (1 ETH)
items[0] = IEVC.BatchItem({
    targetContract: ethVault,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        IEVault.deposit.selector,
        1 ether,
        account
    )
});

// 2. Abilitare ETH vault come collaterale
items[1] = IEVC.BatchItem({
    targetContract: evc,
    onBehalfOfAccount: address(0),
    value: 0,
    data: abi.encodeWithSelector(
        IEVC.enableCollateral.selector,
        account,
        ethVault
    )
});

// 3. Abilitare USDC vault come controller (per borrow)
items[2] = IEVC.BatchItem({
    targetContract: evc,
    onBehalfOfAccount: address(0),
    value: 0,
    data: abi.encodeWithSelector(
        IEVC.enableController.selector,
        account,
        usdcVault
    )
});

// 4. Prendere in prestito USDC → inviarli allo Swapper
items[3] = IEVC.BatchItem({
    targetContract: usdcVault,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        IEVault.borrow.selector,
        borrowAmount,      // es. 2000 USDC
        swapperAddress     // i fondi vanno allo Swapper
    )
});

// 5. Eseguire swap USDC → ETH via Swapper
items[4] = IEVC.BatchItem({
    targetContract: swapperAddress,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        ISwapper.swap.selector,
        swapParams    // parametri dello swap (handler, mode, etc.)
    )
});

// 6. Depositare ETH ricevuto come collaterale aggiuntivo
items[5] = IEVC.BatchItem({
    targetContract: ethVault,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        IEVault.deposit.selector,
        type(uint256).max,  // depositare tutto l'ETH ricevuto
        account
    )
});

// 7. Verificare risultato con SwapVerifier
items[6] = IEVC.BatchItem({
    targetContract: swapVerifierAddress,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        ISwapVerifier.verifyAmountMinAndSkim.selector,
        ethVault,
        account,
        minExpectedEth,  // slippage protection
        deadline
    )
});

// Eseguire tutto atomicamente
IEVC(evc).batch(items);
```

---

## Close Leverage / Swap-to-Repay

### Scenario

- **Posizione corrente**: 1.8 ETH collaterale, 2000 USDC debito
- **Obiettivo**: Chiudere completamente la posizione

### Flusso delle Operazioni

```solidity
IEVC.BatchItem[] memory items = new IEVC.BatchItem[](4);

// 1. Prelevare collaterale → inviarlo allo Swapper
items[0] = IEVC.BatchItem({
    targetContract: ethVault,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        IEVault.withdraw.selector,
        collateralAmount,  // o type(uint256).max per tutto
        swapperAddress,    // i fondi vanno allo Swapper
        account
    )
});

// 2. Swapper esegue swap ETH → USDC (target debt mode)
items[1] = IEVC.BatchItem({
    targetContract: swapperAddress,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        ISwapper.swap.selector,
        swapParams  // mode = TARGET_DEBT, target = 0 (ripagare tutto)
    )
});

// 3. Ripagare il debito
items[2] = IEVC.BatchItem({
    targetContract: usdcVault,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        IEVault.repay.selector,
        type(uint256).max,  // ripagare tutto il debito
        account
    )
});

// 4. Verificare che debito sia zero
items[3] = IEVC.BatchItem({
    targetContract: swapVerifierAddress,
    onBehalfOfAccount: account,
    value: 0,
    data: abi.encodeWithSelector(
        ISwapVerifier.verifyDebtMax.selector,
        usdcVault,
        account,
        0,        // debito massimo accettabile = 0
        deadline
    )
});

IEVC(evc).batch(items);
```

---

## Handlers e Meta-Aggregators

### Handlers

Gli **handlers** sono moduli interni nel contratto Swapper che interfacciano con provider di swap esterni.

| Handler | Descrizione |
|---------|-------------|
| `HANDLER_UNISWAP_V2` | Interfaccia con Uniswap V2 e fork |
| `HANDLER_UNISWAP_V3` | Interfaccia con Uniswap V3 |
| `HANDLER_GENERIC` | Interfaccia generica per aggregatori |

Il tipo di handler è specificato nei parametri dello swap.

### Meta-Aggregator API

Euler fornisce un servizio API **open-source** che:

1. Interroga multipli aggregatori
2. Trova la route migliore
3. Genera un payload di transazione per il tuo batch EVC

Questo abilita esecuzione automatica e ottimale degli swap.

---

## Sicurezza e Best Practices

| Best Practice | Descrizione |
|---------------|-------------|
| **Sempre usare SwapVerifier** | Dopo Swapper nel batch EVC per verificare il risultato |
| **Trust boundaries** | Swapper = untrusted; SwapVerifier = trusted e auditato |
| **Gestire slippage** | Impostare limiti ragionevoli per evitare transazioni fallite o perdite inaspettate |
| **Usare meta-aggregators** | Per routing ottimale e generazione payload |
| **Verificare deadline** | Includere sempre deadline nelle verifiche |
| **Testare su fork** | Prima di eseguire su mainnet |

### Controlli SwapVerifier

| Funzione | Descrizione |
|----------|-------------|
| `verifyAmountMinAndSkim` | Verifica ammontare minimo ricevuto, trasferisce surplus |
| `verifyDebtMax` | Verifica che il debito non superi un massimo (usato per chiudere posizioni) |

---

## Esempi di Codice

### TypeScript - Open Leverage Completo

```typescript
import { ethers } from 'ethers';

// Indirizzi Arbitrum
const ADDRESSES = {
    EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
    SWAPPER: "0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7",
    SWAP_VERIFIER: "0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5"
};

interface LeverageParams {
    collateralVault: string;    // Vault per depositare collaterale (es. ETH vault)
    borrowVault: string;        // Vault da cui prendere in prestito (es. USDC vault)
    collateralAmount: bigint;   // Ammontare collaterale iniziale
    borrowAmount: bigint;       // Ammontare da prendere in prestito
    minOutputAmount: bigint;    // Minimo output dallo swap (slippage protection)
    swapData: string;           // Dati dello swap (da aggregator)
    deadline: number;           // Deadline timestamp
}

async function openLeveragePosition(
    signer: ethers.Signer,
    params: LeverageParams
) {
    const account = await signer.getAddress();
    const evc = new ethers.Contract(ADDRESSES.EVC, EVC_ABI, signer);
    
    const batchItems = [
        // 1. Deposit collaterale iniziale
        {
            targetContract: params.collateralVault,
            onBehalfOfAccount: account,
            value: 0n,
            data: ethers.utils.defaultAbiCoder.encode(
                ['bytes4', 'uint256', 'address'],
                [DEPOSIT_SELECTOR, params.collateralAmount, account]
            )
        },
        // 2. Enable collateral
        {
            targetContract: ADDRESSES.EVC,
            onBehalfOfAccount: ethers.constants.AddressZero,
            value: 0n,
            data: ethers.utils.defaultAbiCoder.encode(
                ['bytes4', 'address', 'address'],
                [ENABLE_COLLATERAL_SELECTOR, account, params.collateralVault]
            )
        },
        // 3. Enable controller
        {
            targetContract: ADDRESSES.EVC,
            onBehalfOfAccount: ethers.constants.AddressZero,
            value: 0n,
            data: ethers.utils.defaultAbiCoder.encode(
                ['bytes4', 'address', 'address'],
                [ENABLE_CONTROLLER_SELECTOR, account, params.borrowVault]
            )
        },
        // 4. Borrow → Swapper
        {
            targetContract: params.borrowVault,
            onBehalfOfAccount: account,
            value: 0n,
            data: ethers.utils.defaultAbiCoder.encode(
                ['bytes4', 'uint256', 'address'],
                [BORROW_SELECTOR, params.borrowAmount, ADDRESSES.SWAPPER]
            )
        },
        // 5. Execute swap
        {
            targetContract: ADDRESSES.SWAPPER,
            onBehalfOfAccount: account,
            value: 0n,
            data: params.swapData
        },
        // 6. Deposit swapped collateral
        {
            targetContract: params.collateralVault,
            onBehalfOfAccount: account,
            value: 0n,
            data: ethers.utils.defaultAbiCoder.encode(
                ['bytes4', 'uint256', 'address'],
                [DEPOSIT_SELECTOR, ethers.constants.MaxUint256, account]
            )
        },
        // 7. Verify swap result
        {
            targetContract: ADDRESSES.SWAP_VERIFIER,
            onBehalfOfAccount: account,
            value: 0n,
            data: ethers.utils.defaultAbiCoder.encode(
                ['bytes4', 'address', 'address', 'uint256', 'uint256'],
                [
                    VERIFY_AMOUNT_MIN_SELECTOR,
                    params.collateralVault,
                    account,
                    params.minOutputAmount,
                    params.deadline
                ]
            )
        }
    ];
    
    const tx = await evc.batch(batchItems);
    const receipt = await tx.wait();
    
    console.log(`Leverage position opened. TX: ${receipt.hash}`);
    return receipt;
}
```

### Solidity - Contratto Helper per Leverage

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@euler-xyz/euler-interfaces/interfaces/IEVault.sol";
import "@euler-xyz/euler-interfaces/interfaces/IEthereumVaultConnector.sol";
import "@euler-xyz/euler-interfaces/interfaces/ISwapper.sol";
import "@euler-xyz/euler-interfaces/interfaces/ISwapVerifier.sol";

contract EulerLeverageHelper {
    IEVC public immutable evc;
    ISwapper public immutable swapper;
    ISwapVerifier public immutable swapVerifier;
    
    constructor(address _evc, address _swapper, address _swapVerifier) {
        evc = IEVC(_evc);
        swapper = ISwapper(_swapper);
        swapVerifier = ISwapVerifier(_swapVerifier);
    }
    
    struct LeverageParams {
        address collateralVault;
        address borrowVault;
        uint256 initialCollateral;
        uint256 borrowAmount;
        ISwapper.SwapParams swapParams;
        uint256 minOutputAmount;
        uint256 deadline;
    }
    
    function openLeveragePosition(LeverageParams calldata params) external {
        // Preparare batch di 7 operazioni
        IEVC.BatchItem[] memory items = new IEVC.BatchItem[](7);
        
        // ... (implementare come nell'esempio sopra)
        
        evc.batch(items);
    }
    
    function closeLeveragePosition(
        address collateralVault,
        address borrowVault,
        uint256 collateralToWithdraw,
        ISwapper.SwapParams calldata swapParams,
        uint256 deadline
    ) external {
        IEVC.BatchItem[] memory items = new IEVC.BatchItem[](4);
        
        // ... (implementare come nell'esempio swap-to-repay)
        
        evc.batch(items);
    }
}
```

---

## 📚 Riferimenti

- [Swaps Documentation](https://docs.euler.finance/developers/periphery/swaps)
- [EulerSwap Overview](https://docs.euler.finance/developers/euler-swap/)
- [EVK Periphery GitHub](https://github.com/euler-xyz/evk-periphery)
- [Swapper Contract](https://github.com/euler-xyz/evk-periphery/blob/master/src/Swapper/Swapper.sol)
- [SwapVerifier Contract](https://github.com/euler-xyz/evk-periphery/blob/master/src/Swapper/SwapVerifier.sol)
