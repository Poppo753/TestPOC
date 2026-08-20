# Guida di manutenzione

## Avvio locale

Da `TestSmartContract/dapp-new`:

```powershell
python -m http.server 8000
```

Aprire `http://localhost:8000`. Username e password della preview sono entrambi `Poppo753`.

## Fonti editoriali

### Stato prodotto

Aggiornare `data/product/product-state.json` quando cambia Today, Next o Vision. Non spostare una capability in Today senza evidenza.

### Policy rischio

Aggiornare `data/product/risk-policy.json`. Le decisioni non approvate devono restare in `pendingDecisions`. Gli esempi devono conservare un notice illustrativo.

### Trust

Aggiornare `data/protocol/trust-evidence.json` soltanto con prove collegabili. Un audit diventa completo solo quando esiste un report verificabile; multisig e timelock richiedono indirizzi e chain evidence.

### Changelog

Aggiornare `data/product/changelog.json` e la relativa pagina con data, titolo e cambiamenti verificabili. Non usare il changelog come roadmap.

## Documentazione

Dopo modifiche al pack canonico:

```powershell
npm run sync:docs
npm run check:docs
```

La conversione DOCX richiede Microsoft Word. Il catalogo pubblico deve mantenere 13 fallback selezionabili finché il pack resta 00–12.

## Console

Simple e Advanced condividono gli stessi reader e workflow. Non duplicare logica transazionale nei componenti di presentazione.

Prima di cambiare un workflow verificare:

- chain;
- address;
- ABI;
- exact approval;
- estimate notice;
- conferma wallet;
- error state;
- refresh successivo.

## WebGL

Le scene restano limitate a Home, How it works, Protocol e Roadmap. FAQ, Docs, Trust Center e tabelle non devono dipendere dal 3D.

Il journey How it works possiede cinque stazioni. Se cambia il numero di pulsanti, aggiornare insieme:

- `pages/how-it-works.html`;
- `capital-journey.js`;
- normalizzazione della posizione lungo la curva;
- browser smoke.

## Validazione

```powershell
npm run validate
npm run check:content
npm run check:product
npm run check:docs
npm run check:webgl
npm run ready
```

Con server locale:

```powershell
npm run check:auth:browser -- http://127.0.0.1:8000
npm run check:docs:browser -- http://127.0.0.1:8000
npm run check:webgl:browser -- http://127.0.0.1:8000
```

## Regole editoriali

- non confondere registered con allocated;
- non confondere implemented con audited;
- non confondere PoC con public product;
- marcare sempre esempi APY, allocation e balance come illustrative;
- mostrare pending quando la policy non è approvata;
- non usare affermazioni assolute su custodia, sicurezza o liquidità.
