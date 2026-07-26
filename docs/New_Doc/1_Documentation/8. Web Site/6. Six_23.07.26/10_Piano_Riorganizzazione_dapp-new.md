# Piano di riorganizzazione di dapp-new

Data: 23 luglio 2026  
Obiettivo: separare applicazione attiva, fonti dati, strumenti operativi, artefatti e materiale storico senza cambiare gli URL pubblici.

## Principi

1. `index.html`, `app.html` e i redirect di compatibilità restano in root.
2. Gli URL delle pagine pubbliche non cambiano.
3. I file attivi non vengono mescolati con prototipi precedenti.
4. I JSON vengono divisi per dominio, non lasciati in una cartella piatta.
5. Gli script vengono divisi per responsabilità.
6. Il materiale legacy viene conservato, non cancellato.
7. Tutti i path vengono aggiornati e verificati dai gate.

## Struttura target

```text
dapp-new/
├─ index.html
├─ app.html
├─ landing.html / documentation.html / config.html / portfolio.html
├─ package.json
├─ README.md
├─ assets/
│  ├─ brand/
│  ├─ css/
│  └─ js/
├─ content/
│  └─ docs/
├─ data/
│  ├─ editorial/
│  │  └─ site-content.json
│  ├─ product/
│  │  ├─ product-state.json
│  │  ├─ vaults.json
│  │  ├─ roadmap.json
│  │  ├─ risk-policy.json
│  │  └─ changelog.json
│  └─ protocol/
│     ├─ deployments.json
│     ├─ protocols.json
│     └─ trust-evidence.json
├─ pages/
├─ scripts/
│  ├─ browser/
│  ├─ diagnostics/
│  │  └─ lib/
│  ├─ documentation/
│  ├─ validation/
│  ├─ release-readiness.mjs
│  └─ serve.ps1
├─ legacy/
│  ├─ prototype/
│  ├─ reference/
│  ├─ data/
│  └─ media/
└─ artifacts/
   └─ visual-review/
```

## Migrazioni

### Dati

- dati editoriali → `data/editorial`;
- stato e roadmap prodotto → `data/product`;
- deployment, registry e trust → `data/protocol`.

### Script

- smoke test e catture → `scripts/browser`;
- RPC diagnostics → `scripts/diagnostics`;
- sync documentazione → `scripts/documentation`;
- gate statici → `scripts/validation`.

### Legacy

- vecchio sistema componenti `src` e `main.js` → `legacy/prototype`;
- vecchi documenti/API reference → `legacy/reference`;
- vecchi JSON non attivi → `legacy/data`;
- video non referenziato → `legacy/media`.

## File che restano volutamente in root

- entry point web;
- redirect compatibilità;
- metadata hosting;
- package e README.

Spostarli romperebbe URL esistenti o renderebbe meno chiaro l’avvio locale.

## Verifica richiesta

- nessun riferimento attivo ai vecchi path;
- tutti i JSON validi;
- 19 pagine e link locali validi;
- Docs, auth e quattro scene WebGL funzionanti;
- diagnostica deployment e registry funzionante;
- `npm run ready` passato.
