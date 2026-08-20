# Guida tecnica — file, moduli e manutenzione

## Mappa

```text
demo/index.html
assets/css/demo.css
assets/js/demo/
├── data.js
├── storage.js
├── engine.js
└── controller.js
scripts/
├── browser/demo-smoke.mjs
└── validation/
    ├── validate-demo.mjs
    └── test-demo-engine.mjs
```

## `demo/index.html`

È l'unico entry point. Contiene:

- metadati e `noindex`;
- design system condiviso;
- auth e site shell;
- banner permanente;
- rail con cinque route;
- workspace;
- un solo modal;
- regione toast.

Usa `data-root=".."` perché la shell deve risolvere asset e link dalla
sottocartella.

## `data.js`

Contiene `DEMO_VAULTS` e `vaultById`. Per modificare un profilo:

1. mantenere l'id stabile;
2. dichiarare APY come decimale (`0.032` = 3,2%);
3. mantenere la somma delle allocazioni a 100;
4. fornire almeno un rischio;
5. eseguire `npm run check:demo`.

I dati devono restare illustrativi. Non copiare dati del deployment in questo
file senza cambiare il modello informativo.

## `storage.js`

Definisce:

- `DEMO_SCHEMA_VERSION`;
- chiave `localStorage`;
- scenario iniziale;
- validazione minima;
- load, save e clear.

Quando lo schema cambia, incrementare la versione e decidere esplicitamente se
implementare una migrazione. L'attuale politica è reset sicuro.

## `engine.js`

Contiene il modello contabile:

- `positionValue`;
- `summarize`;
- `deposit`;
- `advanceDays`;
- `withdraw`.

Non deve importare DOM, storage o Web3. Prima di cambiare formule, estendere
`test-demo-engine.mjs` con casi riproducibili.

Il deposito consolida il valore maturato e il nuovo importo come nuovo
principal a giorno zero. Il prelievo parziale fa lo stesso per il valore
residuo. È una semplificazione dichiarata, adeguata alla demo.

## `controller.js`

Coordina:

- routing;
- rendering;
- input e review;
- modal e focus;
- notifiche;
- salvataggio;
- reset.

Le viste vengono create con `document.createElement`. Non introdurre template
costruiti concatenando input in `innerHTML`.

Per aggiungere una route:

1. aggiungerla a `ROUTES`;
2. aggiungere il link nell'HTML;
3. creare il renderer;
4. inserirlo nella mappa `renderers`;
5. aggiornare validatore, test e documentazione.

## `demo.css`

Tutte le classi specifiche usano `demo-`. Riutilizza token e componenti
globali. Le soglie principali sono 1100, 760 e 520 px.

Non usare `z-index` sopra l'auth gate. Verificare sempre desktop, mobile e
`prefers-reduced-motion`.

## `validate-demo.mjs`

Gate statico che controlla:

- file;
- route;
- disclaimer;
- schema;
- catalogo;
- allocazioni;
- collegamenti;
- separazione Web3.

Eseguire:

```powershell
npm run check:demo
```

## `test-demo-engine.mjs`

Verifica comportamento e casi d'errore senza browser. Se fallisce, non
compensare nel controller: correggere il motore.

## `demo-smoke.mjs`

Richiede server locale e Edge/Chrome:

```powershell
npm run check:demo:browser -- http://127.0.0.1:8000
```

Usa un profilo temporaneo e verifica il DOM realmente renderizzato.

## Controllo completo

```powershell
npm run check:demo
npm run validate
npm run check:content
npm run check:product
npm run ready
```

`ready` comprende anche diagnostica live del deployment: il suo successo non è
un audit né autorizzazione alla pubblicazione.

