# Fase 1 — strategia architetturale

## Obiettivo

Ridurre l'accoppiamento della App, usare davvero i dati strutturati, migliorare diagnostica e sicurezza mantenendo l'esecuzione statica senza build obbligatoria.

## Struttura target

```text
dapp-new/
  assets/js/
    app/
      controller.js
      dom.js
      renderers.js
      forms.js
      workflow.js
    core/
    components/
    features/
      data-hydrator.js
      site-features.js
    web3/
      config/     (logicamente, senza profondità inutile)
      services/
  data/
  scripts/
    validate-site.mjs
    check-deployment.mjs
    inspect-protocols.mjs
```

Per evitare una migrazione puramente cosmetica, `web3` mantiene i file esistenti. La vera nuova separazione viene applicata alla UI App, oggi monolitica.

## Moduli App

- `dom.js`: lookup, testo sicuro, link, elementi e busy state.
- `renderers.js`: vault, user, protocols, events, wallet e transaction rendering.
- `forms.js`: parsing input, preview e tab.
- `workflow.js`: confirmation e sequenze approve/deposit/withdraw/revoke.
- `controller.js`: inizializzazione e coordinamento, senza markup di dettaglio.

## Dati editoriali

`data-hydrator.js` carica JSON same-origin con timeout e fallback. Verrà usato per:

- roadmap;
- vault matrix;
- protocol status.

Il contenuto essenziale resta nell'HTML come fallback accessibile e indicizzabile. Il JSON aggiorna status e liste, evitando pagine vuote se JavaScript fallisce.

## Script CLI

### check-deployment

- valida indirizzi;
- verifica bytecode;
- legge fee, pause, supply e pool value;
- confronta chain e base asset;
- stampa JSON o tabella;
- non possiede signer.

### inspect-protocols

- legge nomi registrati;
- info Registry/Plugin/Lens;
- active status;
- breakdown e health dove disponibili;
- distingue errore, zero e dato non disponibile;
- non esegue operazioni.

## Sicurezza hosting

Aggiungere `_headers.example` con CSP compatibile con:

- script locali;
- Ethers CDN;
- RPC Arbitrum;
- nessun frame esterno;
- object-src none;
- base-uri self.

Non chiamarlo `_headers` per non applicare una policy non testata su ogni host; deve essere una configurazione esplicita da adottare durante il deployment.

