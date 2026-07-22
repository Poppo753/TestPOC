# Fase 3 — piano grafico espanso e riesaminato

## 1. Asset

Creare:

- `assets/brand/jethos-mark.svg`;
- sistema icone inline tramite `icon.js`;
- componenti CSS ownership boundary, receipt, bento e signal.

## 2. Modifiche design system

- ampliare scale surface e accent;
- aggiungere gradient mesh e section bands;
- introdurre radius differenziati;
- aggiungere border highlight e noise CSS leggero;
- definire dimensioni bento;
- migliorare nav active state;
- migliorare button depth senza eccesso glow.

## 3. Hero

La dashboard non deve sembrare un mockup di conto generico. Deve raccontare:

```text
Wallet balance — controlled by you
       [explicit action boundary]
Vault position — governed by visible rules
       allocation route + proof
```

## 4. Icone

Sostituire H/I/S/U con icone lineari proprietarie:

- wallet;
- vault/arrow;
- send;
- eye/ledger.

Le icone devono avere testo equivalente e non portare informazione esclusiva.

## 5. Layout

- Hold e Invest diventano card principali;
- Send e Understand secondarie;
- sezioni alterne con `section-band`;
- comparison e transparency come grandi visual, non semplici tabelle;
- pagine interne ricevono page hero con brand motif.

## 6. Riesame

### Immagini bitmap generate

Scartate: il concept è informativo e si esprime meglio con SVG/CSS nativi, più leggeri e responsive.

### Reintroduzione Three.js

Scartata: renderebbe il sito più spettacolare ma meno focalizzato, più pesante e meno accessibile.

### Font esterno

Rinviato: un font distintivo aiuterebbe, ma introdurrebbe privacy/performance/licenza. Prima si consolida la direzione con typography di sistema.

### Animazioni numerose

Ridotte a confine, route e reveal. La motion deve spiegare una relazione, non riempire spazio.

### Dark-only

Mantenuto per coerenza con il prototipo. I token restano predisposti a una futura modalità chiara, ma non viene aggiunta senza progetto dedicato.

## 7. Acceptance criteria

- mark riconoscibile e locale;
- first viewport comunica wallet/vault senza leggere tutto;
- nessuna perdita di contrasto;
- mobile 500 px senza overflow;
- reduced motion funzionante;
- nessuna nuova dipendenza pesante;
- asset SVG e CSS validi;
- App coerente con il sito;
- grafica più distintiva senza sembrare un gioco o un exchange aggressivo.

