# 🔗 EVC - Guida all'Integrazione

**Fonte:** https://docs.euler.finance/developers/evc/integration-guide  
**Data:** 29 Novembre 2025  
**Network:** Arbitrum

---

## 📋 Indice

1. [Panoramica EVC](#panoramica-evc)
2. [Batching Operations](#1-batching-operations)
3. [Sub-accounts](#2-sub-accounts)
4. [Account Ownership](#3-account-ownership-e-registration)
5. [Operator Delegation](#4-operator-delegation)
6. [Liquidations con controlCollateral](#5-liquidations-con-controlcollateral)
7. [Simulating Transactions](#6-simulating-transactions)
8. [Permits (Gasless Transactions)](#7-permits-gasless-transactions)
9. [Emergency Modes](#8-emergency-modes)
10. [Best Practices](#9-best-practices)

---

## Panoramica EVC

L'**Ethereum Vault Connector (EVC)** è il cuore della modularità e composabilità in Euler V2. Agisce come punto di ingresso principale per tutte le interazioni avanzate.

### Perché l'EVC è Importante

| Funzionalità | Descrizione |
|--------------|-------------|
| **Batching** | Raggruppa azioni multiple (deposit, borrow, swap, repay) in una singola transazione atomica |
| **Sub-accounts** | Crea fino a 256 posizioni isolate per wallet |
| **Operators** | Delega il controllo dei sub-accounts a contratti fidati o bot di automazione |
| **Deferred Checks** | Supera temporaneamente limiti o health factor in un batch, purché i check passino alla fine |
| **Unified Authentication** | L'EVC gestisce l'autenticazione, i vault si concentrano su autorizzazione e business logic |

### Cosa Possono Fare gli Sviluppatori con l'EVC

- ✅ Costruire frontend e bot personalizzati che sfruttano batching, sub-accounts e operators
- ✅ Creare automazione avanzata (stop-loss, auto-rebalancing, protezione liquidazioni)
- ✅ Integrare con altri protocolli usando operazioni cross-vault atomiche
- ✅ Simulare transazioni complesse prima dell'esecuzione
- ✅ Progettare nuove strutture di mercato e strumenti di risk management

> ⚠️ **IMPORTANTE**: La maggior parte dei token ERC-20 NON sono EVC-aware e sono sempre detenuti dal tuo indirizzo principale. I sub-accounts sono usati per accounting interno e isolamento delle posizioni, ma NON per detenere token ERC-20 effettivi. Se invii token ERC-20 direttamente a un indirizzo sub-account, quei token saranno PERSI.

---

## 1. Batching Operations

Il batching permette di raggruppare più azioni in una singola transazione atomica.

### Struttura BatchItem

```solidity
struct BatchItem {
    address targetContract;      // Contratto target da chiamare
    address onBehalfOfAccount;   // Account per conto del quale eseguire (address(0) se target è EVC)
    uint256 value;               // ETH value da inoltrare
    bytes data;                  // Dati encodati da chiamare
}
```

### Esempio: Deposit + Borrow in un Solo Batch

```solidity
IEVC.BatchItem[] memory items = new IEVC.BatchItem[](2);

// Assumendo che collateral asset sia già approvato e controller/collateral già abilitati
items[0] = IEVC.BatchItem({
    targetContract: vault,
    onBehalfOfAccount: myAccount,
    value: 0,
    data: abi.encodeWithSelector(
        IVault.deposit.selector,
        depositAmount,
        myAccount
    )
});

items[1] = IEVC.BatchItem({
    targetContract: vault,
    onBehalfOfAccount: myAccount,
    value: 0,
    data: abi.encodeWithSelector(
        IVault.borrow.selector,
        borrowAmount,
        myAccount
    )
});

connector.batch(items);
```

### Caratteristiche del Batching

- ✅ **Atomicità**: Tutte le operazioni riescono o falliscono insieme
- ✅ **Cross-vault**: Puoi fare batch su più vault e anche contratti esterni
- ✅ **Gas efficiency**: Una sola transazione invece di multiple
- ✅ **Deferred checks**: I check di solvency sono eseguiti alla fine del batch

---

## 2. Sub-accounts

I sub-accounts permettono di **isolare posizioni e strategie**. Ogni indirizzo ha 256 sub-accounts, che sono indirizzi virtuali derivati dall'indirizzo principale.

### Come Funzionano gli Indirizzi Sub-account

Tutti i 256 sub-accounts appartenenti allo stesso owner condividono i primi **19 bytes** dell'indirizzo Ethereum. L'unica differenza è l'**ultimo byte**.

### Come Derivare un Indirizzo Sub-account

Un indirizzo sub-account è creato facendo **XOR** tra l'indirizzo principale e un numero da 0 a 255.

- Sub-account 0 = indirizzo principale (nessun cambiamento)
- Sub-account 1 = indirizzo XOR 1
- Sub-account 2 = indirizzo XOR 2
- ...e così via fino a 255

### Esempio in Solidity

```solidity
function getAccount(address owner, uint8 accountId) public pure returns (address) {
    return address(uint160(owner) ^ uint160(accountId));
}

// Utilizzo:
address myAddress = /* tuo indirizzo principale */;
address account3 = getAccount(myAddress, 3); // Questo è il tuo 4° sub-account
```

### Deposit su un Sub-account

```solidity
// Depositare token dal tuo indirizzo principale, ma accreditare le shares a subAccount3
IEVC.BatchItem[] memory items = new IEVC.BatchItem[](1);

items[0] = IEVC.BatchItem({
    targetContract: vault,
    onBehalfOfAccount: myAddress,    // i token vengono prelevati da qui
    value: 0,
    data: abi.encodeWithSelector(
        IVault.deposit.selector,
        depositAmount,
        subAccount3                   // le shares vanno al sub-account
    )
});

connector.batch(items);
```

### Borrow da un Sub-account

```solidity
// Prendere in prestito per conto di subAccount3, ma inviare i token al tuo indirizzo principale
IEVC.BatchItem[] memory items = new IEVC.BatchItem[](1);

items[0] = IEVC.BatchItem({
    targetContract: vault,
    onBehalfOfAccount: subAccount3,  // il debito viene creato qui
    value: 0,
    data: abi.encodeWithSelector(
        IVault.borrow.selector,
        borrowAmount,
        myAddress                     // i token vanno all'indirizzo principale
    )
});

connector.batch(items);
```

### Regole Importanti per Sub-accounts

| Operazione | `onBehalfOfAccount` | `receiver` |
|------------|---------------------|------------|
| **Deposit** | Indirizzo principale (i token ERC-20 sono lì) | Può essere sub-account (shares accreditate lì) |
| **Borrow** | Sub-account (debito creato lì) | Indirizzo principale (token ERC-20 inviati lì) |

> ⚠️ Questa distinzione è importante perché la maggior parte dei token ERC-20 non capisce il sistema di autenticazione EVC e non può recuperare token inviati ai sub-accounts.

---

## 3. Account Ownership e Registration

L'EVC mantiene un mapping degli owner degli account, importante per risolvere la relazione tra sub-accounts e il loro owner primario.

### Come Viene Registrata l'Ownership

L'owner di un account viene registrato nell'EVC la **prima volta** che l'owner interagisce con l'EVC (es. abilitando collateral, controller, o eseguendo batch/call).

### Interazioni Dirette con i Vault

Gli account possono interagire direttamente con i vault, bypassando l'EVC. Questo significa:

- Un account potrebbe non avere un owner registrato nell'EVC finché non interagisce con l'EVC
- Se un account riceve vault shares prima che il suo owner abbia mai interagito con l'EVC, l'EVC non avrà un owner registrato

### Pattern di Integrazione

```solidity
address owner = evc.getAccountOwner(account);

if (owner == address(0)) {
    // Owner non registrato; assumere che l'account sia il proprio owner
    owner = account;
}
```

> ⚠️ Questo pattern è ampiamente usato, ma non è certo al 100%. Potrebbero esserci edge case rari dove il vero owner non è l'account stesso.

---

## 4. Operator Delegation

Gli operators permettono di **delegare il controllo** di un sub-account a un altro indirizzo (es. un bot o contratto di automazione).

### Concedere Diritti Operator per un Sub-account Specifico

```solidity
evc.setAccountOperator(subAccount, operatorAddress, true);
```

### Concedere Diritti Operator per TUTTI i Sub-accounts

```solidity
// L'address prefix è i primi 19 bytes dell'indirizzo dell'owner
// Il bitfield è un intero a 256 bit dove ogni bit rappresenta un sub-account
// type(uint256).max imposta TUTTI i bit a 1, concedendo diritti a tutti i sub-accounts

evc.setOperator(
    evc.getAddressPrefix(owner),
    operatorAddress,
    type(uint256).max
);
```

### Cos'è un Address Prefix?

Nell'EVC, un **address prefix** è i primi 19 bytes di un indirizzo Ethereum. Tutti i 256 sub-accounts di un owner condividono lo stesso prefix. L'EVC usa questo prefix per gestire efficientemente permessi e diritti operator su tutti i sub-accounts.

### Cosa Possono Fare gli Operators

- ✅ Eseguire batch
- ✅ Depositare e prelevare
- ✅ Prendere in prestito e ripagare
- ✅ Abilitare automazione avanzata e strategie intent-based

> ⚠️ **WARNING**: La delega operator è un'operazione critica per la sicurezza. Un operator con accesso ai tuoi sub-accounts può muovere fondi, prendere in prestito, ripagare e eseguire qualsiasi azione per tuo conto. Delega diritti operator solo a contratti o EOA fidati, e rivedi e revoca regolarmente i permessi non più necessari.

### Revocare Diritti Operator

```solidity
// Revocare per sub-account specifico
evc.setAccountOperator(subAccount, operatorAddress, false);

// Revocare per tutti i sub-accounts (aggiornando il bitfield)
evc.setOperator(evc.getAddressPrefix(owner), operatorAddress, 0);
```

---

## 5. Liquidations con controlCollateral

Per eseguire una liquidazione, il vault controller chiama `controlCollateral` per sequestrare collaterale dal sub-account del borrower.

### Esempio: Sequestrare Collateral Shares

```solidity
address collateralVault = /* indirizzo del vault collaterale */;
address violator = /* sub-account in violazione */;
address liquidator = /* indirizzo del liquidatore */;
uint256 seizeShares = /* numero di shares da sequestrare */;

// Preparare call data per transfer
bytes memory transferData = abi.encodeWithSelector(
    IVault.transfer.selector,
    liquidator,   // destinatario delle shares
    seizeShares   // quantità di shares da trasferire
);

// Chiamare controlCollateral
connector.controlCollateral(
    collateralVault,
    violator,
    0,           // value
    transferData
);
```

### Caratteristiche

- ✅ L'operazione è atomica e sicura
- ✅ Solo il vault controller può iniziarla
- ✅ Solo per account che hanno abilitato quel vault come controller
- ✅ La funzione transfer sposta shares dal sub-account del violator al liquidator

---

## 6. Simulating Transactions

Puoi **simulare batch** prima dell'esecuzione usando `batchSimulation`:

```solidity
(
    IEVC.BatchItemResult[] memory results,
    IEVC.StatusCheckResult[] memory accountChecks,
    IEVC.StatusCheckResult[] memory vaultChecks
) = connector.batchSimulation(items);

// Analizzare i risultati prima di inviare una transazione reale
```

### Casi d'Uso

- ✅ **Frontend**: Mostrare preview delle operazioni
- ✅ **Bot**: Validare profittabilità prima dell'esecuzione
- ✅ **Risk management**: Verificare che i check di solvency passino

---

## 7. Permits (Gasless Transactions)

L'EVC supporta transazioni gasless usando **EIP-712 permits**. Questo permette agli utenti di firmare un messaggio off-chain, che può poi essere inviato da qualsiasi relayer per eseguire un batch di operazioni.

### Come Usare i Permits EVC

1. **Costruire** il messaggio permit (signer, sender, nonce, deadline, value, calldata)
2. **Firmare** il messaggio off-chain usando EIP-712
3. **Inviare** il permit alla funzione `permit` dell'EVC

```solidity
evc.permit(
    signer,         // L'utente che autorizza l'azione
    sender,         // Il relayer o executor
    nonceNamespace, // Per replay protection
    nonce,          // Per replay protection
    deadline,       // Timestamp di scadenza
    value,          // ETH value da inoltrare (solitamente 0)
    data,           // Calldata encodata (es. batch)
    signature       // Firma EIP-712
);
```

### Understanding Nonce Namespace

Il sistema di permit dell'EVC usa `nonceNamespace` e `nonce` per protezione replay e sequenziamento.

Il `nonceNamespace` permette di avere **stream multipli indipendenti** di permits per lo stesso account:

- Workflow paralleli (es. uno per azioni regolari, uno per emergenze)
- Cancellare o sostituire uno stream specifico senza influenzare gli altri

> 💡 **TIP**: Se non sei sicuro, usa `nonceNamespace = 0` per tutti i tuoi permits. Usa namespace multipli solo se hai bisogno di stream paralleli e indipendenti.

### Tipi di Firma Supportati

| Tipo | Descrizione |
|------|-------------|
| **ECDSA** | Firme da EOA (Externally Owned Account) |
| **ERC-1271** | Firme da smart contract wallet |

> ⚠️ **SECURITY NOTE**: I permits sono potenti e devono essere gestiti con cura. Verifica sempre nonce e deadline, e non firmare mai un permit che non capisci completamente.

---

## 8. Emergency Modes

L'EVC fornisce due modalità di emergenza per proteggere gli account in caso di compromissione o attività sospetta.

### Lockdown Mode

Quando abilitato, restringe tutte le operazioni per l'address prefix interessato (tutti i 256 sub-accounts), eccetto la gestione di operators e nonces.

- ❌ Nessuna chiamata a contratti esterni
- ❌ Nessun trasferimento di valore
- ✅ I controllers possono ancora controllare il collaterale

```solidity
// Abilitare Lockdown Mode
evc.setLockdownMode(evc.getAddressPrefix(owner), true);

// Disabilitare Lockdown Mode
evc.setLockdownMode(evc.getAddressPrefix(owner), false);
```

**Quando usarlo**: Se sospetti che un operator o permit malevolo sia stato aggiunto.

### Permit Disabled Mode

Quando abilitato, previene l'esecuzione di qualsiasi permit firmato dall'owner per l'address prefix interessato.

```solidity
// Abilitare Permit Disabled Mode
evc.setPermitDisabledMode(evc.getAddressPrefix(owner), true);

// Disabilitare Permit Disabled Mode
evc.setPermitDisabledMode(evc.getAddressPrefix(owner), false);
```

**Quando usarlo**: Se credi che un messaggio permit dannoso sia stato firmato.

---

## 9. Best Practices

| Best Practice | Descrizione |
|---------------|-------------|
| **Usa sempre batching** | Per operazioni correlate, risparmia gas e garantisce atomicità |
| **Sfrutta i sub-accounts** | Per isolamento del rischio e separazione delle strategie |
| **Delega con operators** | Per automazione, ma solo a contratti fidati |
| **Simula transazioni complesse** | Prima dell'esecuzione, per evitare errori costosi |
| **Rivedi le feature di sicurezza EVC** | Lockdown Mode e Permit Disabled Mode per protezione extra |

---

## 📚 Riferimenti

- [EVC Overview](https://docs.euler.finance/developers/evc/)
- [EVC Integration Guide](https://docs.euler.finance/developers/evc/integration-guide)
- [EVC Whitepaper](https://github.com/euler-xyz/ethereum-vault-connector/blob/master/docs/whitepaper.md)
- [EVC GitHub Repository](https://github.com/euler-xyz/ethereum-vault-connector)
- [EVC Website](https://evc.wtf/)
