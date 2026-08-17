# Jethos Website — guida d'uso del sito e di ogni script

Versione 1.0 — 23 luglio 2026

## Avvio

Da `dapp-new`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 -Port 8000
```

Oppure:

```powershell
python -m http.server 8000
```

Aprire `http://127.0.0.1:8000/`. Non usare `file://`.

## Validazione

```powershell
node scripts/validate-site.mjs
```

Controlla JSON, link locali, ID duplicati, metadata, claim vietati e vecchi indirizzi ETH nei moduli attivi.

## Script core

| Script | Scopo | Uso diretto |
|---|---|---|
| `core/site-shell.js` | Genera header/footer, inizializza nav e reveal. | Importato da tutte le pagine. Configurare `data-root` su `<html>` e `data-page` su `<body>`. |
| `core/navigation.js` | Menu mobile, Escape, resize e chiusura dopo click. | Usato da site-shell; richiede `data-nav-toggle` e `data-nav-links`. |
| `core/reveal.js` | Progressive reveal con reduced motion. | Aggiungere classe `.reveal`; il contenuto resta visibile senza observer. |
| `core/format.js` | Numeri, indirizzi, date ed escaping. | Importare funzioni singole; non usarle per costruire importi on-chain. |

## Componenti

| Script | Scopo | Uso diretto |
|---|---|---|
| `components/status-badge.js` | Crea badge coerenti per gli stati. | Chiamare `statusBadge(status)` o usare `hydrateStatusBadges`. |
| `components/modal.js` | Dialog accessibile con Escape, focus trap e restore. | Creare `new Modal(backdrop)`, poi `open()`/`close()`. |
| `components/toast.js` | Notifiche temporanee aria-live. | `showToast(message, {duration})`. Non inserisce HTML esterno. |

## Feature editoriali

| Script | Scopo | Uso diretto |
|---|---|---|
| `features/site-features.js` | Idrata badge dichiarativi e disclosure. | Importato nelle pagine informative; non è richiesto per leggere il contenuto. |

## Moduli web3

| Script | Scopo | Come usarlo |
|---|---|---|
| `web3/deployment-config.js` | Chain, asset e indirizzi del PoC. | Aggiornare solo da un manifest verificato; chiamare `validateDeployment`. |
| `web3/abis.js` | ABI minime ERC-20/core. | Aggiungere solo funzioni realmente usate e verificate. |
| `web3/ethers-loader.js` | Caricamento singleton Ethers v6. | `await loadEthers()`; gestire sempre il possibile errore CDN. |
| `web3/wallet.js` | Sessione wallet EIP-1193. | `restore()` non mostra popup; `connect()` va chiamato da click; ascoltare `change`. |
| `web3/contracts.js` | Factory read/write. | `getReadContext()` senza wallet; `getWriteContext(walletSession)` richiede rete corretta. |
| `web3/readers.js` | Snapshot vault, utente e protocolli. | Controllare sempre `.ok`; mostrare `.error`, non sostituirlo con zero. |
| `web3/estimates.js` | Parsing esatto e stime del LiquidityManager. | Usare `parseBaseAmount`, `parseShareAmount`, poi estimate; indicare `guaranteed:false`. |
| `web3/transactions.js` | Approve, revoke, deposit e withdraw. | Fornire walletSession e callback `onState`; mostrare ogni richiesta nel wallet. |
| `web3/events.js` | Storico utente limitato. | `readUserEvents(address,{blockWindow})`; ridurre la finestra se l'RPC rifiuta. |
| `web3/app-controller.js` | Orchestrazione completa della console. | Importato soltanto da `app.html`; dipende dagli ID documentati nella pagina. |

## Script operativi

### `scripts/serve.ps1`

Parametri:

- `-Port`: 1024–65535, default 8000.

Il server ascolta soltanto su `127.0.0.1`. Per pubblicare il sito usare un host statico e configurare header di sicurezza separatamente.

### `scripts/validate-site.mjs`

Non modifica file e non usa dipendenze npm. Exit code 0 indica struttura valida; exit code 1 elenca errori.

## Aggiornare un deployment

1. Ottenere il manifest verificato.
2. Creare una nuova entry in `data/deployments.json`.
3. Aggiornare `deployment-config.js`.
4. Verificare chain ID, base asset e decimali.
5. Verificare bytecode per ogni indirizzo.
6. Verificare ABI read-only.
7. Testare approve/deposit/withdraw su fork.
8. Eseguire `validate-site.mjs`.
9. Aggiornare documentazione e timestamp.

## Aggiornare roadmap, vault e protocolli

- `data/roadmap.json`: usare capacità, status e exit criteria.
- `data/vaults.json`: non usare `live` senza deployment verificato.
- `data/protocols.json`: distinguere registrazione da allocazione.
- non inserire APY statici presentati come live.

## Test sicuro

1. Eseguire il validatore.
2. Avviare server locale.
3. Visitare tutte le pagine senza wallet.
4. Verificare read-only della console.
5. Usare un fork per write path.
6. Non confermare transazioni mainnet soltanto per testare la UI.

## Risoluzione problemi

- **Pagina vuota con file://**: usare server HTTP.
- **Live data unavailable**: controllare RPC/CDN e non interpretare il dato come zero.
- **Wrong network**: usare Switch network e verificare Arbitrum One.
- **Approval richiesta**: è intenzionale; viene approvato l'importo esatto.
- **Event history unavailable**: ridurre `blockWindow` o usare un provider archive adeguato.
- **Estimate diverso dall'eseguito**: stato e accounting possono cambiare fra lettura e blocco; il PoC non offre min-out ERC-4626 standard.

