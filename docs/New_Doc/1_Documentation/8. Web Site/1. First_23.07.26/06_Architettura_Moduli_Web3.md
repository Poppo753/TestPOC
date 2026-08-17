# Jethos Website — architettura dei moduli web3

Versione 1.0 — 23 luglio 2026

## Principio

La UI non costruisce calldata liberamente e non chiama plugin in modo diretto. Le azioni consumer passano attraverso gli entry point Jethos previsti dal PoC.

```text
App UI
  ↓
App controller
  ├── Readers → public RPC → core/lens reads
  ├── Estimates → LiquidityManager view helpers
  └── Transactions → wallet signer → LiquidityManager
```

## Separazione dei moduli

### Deployment

`deployment-config.js` contiene un solo deployment, chain, base asset e indirizzi. La configurazione non è ricavata dalla landing e non può essere sovrascritta da query string.

### ABI

`abis.js` contiene soltanto le funzioni necessarie. Non include funzioni admin o plugin write.

### Provider

`contracts.js` crea:

- read context con RPC pubblico;
- write context con signer e controllo chain.

### Sessione wallet

`wallet.js` gestisce EIP-1193. La pagina non chiama `eth_requestAccounts` al caricamento; lo fa soltanto su input dell'utente.

### Letture

`readers.js` restituisce risultati `{ok,value,error}` e aggiunge fonte/timestamp. Un errore non viene rappresentato come zero.

### Stime

`estimates.js` usa:

- `calculateDepositShares`;
- `calculateWithdrawAmount`;
- `canWithdraw`.

Sono helper del contratto corrente, non funzioni ERC-4626 standard e non garantiscono il risultato nel blocco di esecuzione.

### Scritture

`transactions.js` espone soltanto:

- approval esatto;
- revoke approval;
- deposit;
- withdraw con deadline.

Ogni percorso verifica rete, stato, saldo, allowance e gas, attende la receipt e impedisce concorrenza locale.

### Eventi

`events.js` interroga eventi utente in una finestra di 50.000 blocchi, deduplica e aggiunge link explorer.

### Controller

`app-controller.js` orchestra UI e moduli. Non contiene indirizzi o ABI. Gli errori esterni vengono inseriti nel DOM con `textContent`.

## Flusso deposito

```text
input → parseUnits(6) → balance/allowance
      → modal
      → approve exact (se necessario)
      → receipt
      → estimateGas deposit
      → deposit(amount)
      → receipt
      → refresh
```

## Flusso prelievo

```text
share input → parseUnits(share decimals)
            → balance + canWithdraw
            → calculateWithdrawAmount
            → modal
            → estimateGas
            → withdrawWithDeadline
            → receipt
            → refresh
```

## Limiti deliberati

- niente infinite approval;
- niente chiamate dirette a Aave/Euler/Morpho;
- niente funzioni owner;
- niente borrow/leverage nella consumer app;
- niente test automatici che inviano mainnet transaction;
- niente fallback ottimistico quando RPC fallisce;
- niente promessa `minOut` che il contratto non applica.

