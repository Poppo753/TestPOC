# Guida agli script e alla manutenzione — v2

## Avvio locale

Dalla cartella `dapp-new`:

```powershell
.\scripts\serve.ps1
```

In alternativa si può usare `python -m http.server 8000`. È necessario HTTP: aprire gli HTML con `file://` impedisce il corretto caricamento di moduli e JSON.

## Comandi Node

Non servono dipendenze npm locali. È consigliato Node.js 20 o successivo.

### `npm run validate`

Esegue `scripts/validate-site.mjs`. Controlla struttura e link delle pagine, file JSON, riferimenti locali, un solo H1, configurazione e coerenza tra `data/deployments.json` e `deployment-config.js`. Usarlo dopo cambi a pagine, navigazione, dati o indirizzi.

### `npm run check:deployment`

Esegue `scripts/check-deployment.mjs` contro l'RPC pubblico configurato. Verifica presenza del bytecode, simbolo e decimali dell'asset, supply, valore del pool, abilitazione depositi/prelievi, fee e pause. È rigorosamente read-only.

Per automazione:

```powershell
npm run check:deployment -- --json
```

Un errore RPC non autorizza a sostituire indirizzi: prima verificare rete, endpoint e manifest di deployment.

### `npm run inspect:protocols`

Esegue `scripts/inspect-protocols.mjs`. Legge i protocolli registrati dal core, associa plugin e lens, mostra stato e valore netto e sintetizza la salute globale. Non invia transazioni e non chiama write arbitrarie sui plugin.

```powershell
npm run inspect:protocols -- --json
```

## Moduli del sito

- `core/site-shell.js`: bootstrap comune di header, navigazione e reveal.
- `core/navigation.js`: menu mobile e stato della pagina attiva.
- `core/reveal.js`: progressive reveal con rispetto di reduced motion.
- `core/format.js`: formattazione condivisa.
- `components/icon.js`: sostituisce i placeholder dichiarativi con SVG accessibili.
- `components/modal.js`, `toast.js`, `status-badge.js`: feedback riutilizzabile della App.
- `features/site-features.js`: attiva feature editoriali non Web3.
- `features/data-hydrator.js`: legge JSON same-origin con timeout; se fallisce conserva il fallback HTML.

## Moduli della console PoC

### Livello App

- `app/controller.js`: lifecycle e coordinamento; è l'entry point di `app.html`.
- `app/dom.js`: accesso sicuro agli elementi e aggiornamenti testuali.
- `app/renderers.js`: rappresentazione di wallet, vault, utente, protocolli ed eventi.
- `app/forms.js`: tab, valori e preview dei form.
- `app/workflow.js`: sequenze confirm/approve/deposit/withdraw/revoke e refresh.

### Livello Web3

- `deployment-config.js`: rete, RPC e indirizzi ammessi.
- `abis.js`: ABI minime necessarie alla UI e alle CLI.
- `ethers-loader.js`: caricamento controllato di ethers.
- `wallet.js`: connessione esplicita, rete e account.
- `contracts.js`: costruzione dei contratti read-only o firmati.
- `readers.js`: snapshot vault/utente e stato operativo.
- `events.js`: lettura e normalizzazione degli eventi.
- `estimates.js`: preview dichiaratamente non garantite.
- `transactions.js`: approval esatto, revoke, deposit e withdraw con deadline.
- `web3/app-controller.js`: shim deprecato; non aggiungere nuova logica qui.

## Flusso corretto per aggiornare un deployment

1. Ottenere un manifest verificato dalla procedura di deployment.
2. Aggiornare insieme JSON e configurazione JavaScript.
3. Eseguire `npm run validate`.
4. Eseguire le due CLI read-only.
5. Provare le scritture su fork sicuro e finanziato.
6. Solo dopo revisione, pubblicare la console con header e RPC adeguati.

## Regole operative

- mai inserire private key o seed nel repository o nel browser bundle;
- mai esporre al consumatore chiamate arbitrarie ai plugin;
- mantenere approval esatto e possibilità di revoke;
- non presentare stime o APY come risultati garantiti;
- preservare fallback HTML quando si aggiungono dati dinamici;
- rieseguire validatore, test HTTP e controllo visuale dopo ogni modifica strutturale.

