# Strategia espansa

## 1. Obiettivo

Trasformare il sito da manifesto ripetitivo sulla self-custody a dimostrazione credibile di una financial home trasparente, mantenendo rigore fra prodotto attuale, implementazione tecnica e visione.

## 2. Architettura dell’informazione

### Homepage

Ordine definitivo:

1. Hero orientata al beneficio.
2. Barra Today → Next → Vision.
3. Capital Boundary interattivo.
4. Transparency Receipt.
5. USDC Conservative PoC.
6. Risk-adjusted intelligence.
7. Financial home: Hold, Invest, Understand, Use.
8. Infrastructure.
9. Evidence-based roadmap.
10. Trust e CTA.

Le vecchie sezioni Ownership Core, Capital Path e Invest only what you choose diventano un solo blocco. La tabella dei tre modelli viene trasferita in How it works. La sezione Structured underneath viene sostituita da un’esperienza orientata a asset, obiettivo, rischio, strategia e monitoraggio.

### How it works

Il viaggio diventa:

1. Hold.
2. Authorize.
3. Deposit.
4. Allocate & monitor.
5. Withdraw or use.

La pagina deve inoltre spiegare allowance, share, stati di liquidità e confronto fra intermediated account, self-custodial wallet e Jethos vault.

### Vaults

La scheda USDC Conservative viene prima della matrice futura. La scheda mostra:

- stato e chain;
- base asset;
- accounting corrente;
- standard target;
- integrazioni registrate;
- strategie permesse e vietate;
- policy definite e decisioni pendenti;
- withdrawal e pause assumptions;
- motivazione del vault.

### Risk & Transparency

La pagina riceve:

- policy ledger;
- valori target solo quando provati;
- `Decision pending` quando non definiti;
- esempio illustrativo di allocazione risk-adjusted;
- stato di liquidità e provenienza dei dati.

### PoC Console

Simple mode contiene ciò che serve per capire e agire:

- stato;
- balance/position;
- deposit/withdraw;
- preview;
- fee;
- rischi principali.

Advanced mode contiene:

- raw supply;
- allowance;
- registry;
- address;
- eventi;
- provenance e valori diagnostici.

Non si modifica la sicurezza delle transazioni: il cambio è principalmente di gerarchia visuale e messaggistica.

### Protocol

Si mantengono WebGL e stack, aggiungendo:

- percorso comprensibile user → entry → custody/accounting → orchestration → modules;
- matrice tecnica per componente;
- responsibility, asset control, caller, failure impact, emergency control e status.

### Trust Center

Si aggiunge un evidence register, senza inventare:

- deployment/versione;
- recorded date;
- explorer;
- source commit se assente: not linked;
- admin/multisig/timelock se non provati: not evidenced;
- pause/recovery authority: da verificare;
- monitoring, audit, coverage, incident, bounty e security contact.

Gli assurance gate diventano checklist con stato testuale e prova collegabile.

### Roadmap

Ogni fase mostra:

- capability;
- acceptance criteria;
- evidence;
- blockers;
- owner;
- last update;
- documentation.

Gli owner mancanti sono indicati come `Decision owner pending`; nessun nome viene inventato.

### Vision

Si aggiunge una dashboard illustrativa esplicitamente marcata `Product vision — not currently available` e una narrazione “A day with Jethos”.

### FAQ

Si aggiungono le domande di prodotto, protocolli, fees, frontend unavailable, admin, partner regolamentati e direzione bancaria.

### Documentation

Il catalogo dinamico resta. Vengono aggiunti:

- percorsi User / Risk & assurance / Developer;
- fallback HTML selezionabile;
- rimozione dalla UI pubblica di path locale e comando npm;
- messaggi runtime robusti.

### Team e changelog

Si aggiungono due pagine:

- Team: non inventa persone; dichiara quali disclosure devono essere pubblicate e che la sezione è incompleta.
- Changelog: usa aggiornamenti datati verificabili del sito/repository.

## 3. Modello dati

Conviene centralizzare le nuove informazioni in:

- `data/product-state.json`: Today, Next, Vision;
- `data/risk-policy.json`: policy definite/pending e scenario illustrativo;
- `data/trust-evidence.json`: evidence register e assurance gates;
- `data/changelog.json`: aggiornamenti datati.

Il frontend deve mostrare HTML utile anche senza JavaScript; i JSON servono a idratare conteggi, date e record, non a rendere la pagina vuota.

## 4. Design system

Si riutilizzano badge e token esistenti. Si aggiungono componenti:

- horizon strip;
- product showcase;
- receipt dashboard;
- policy ledger;
- evidence checklist;
- mode switch;
- vision dashboard;
- changelog entry.

Il WebGL rimane sfondo narrativo; FAQ, Docs, Trust Center e tabelle restano HTML leggibile.

## 5. Accessibilità e responsive

- componenti interattivi devono essere `button`, `details`, `a` o controlli nativi;
- tabs e mode switch devono aggiornare `aria-selected`;
- niente informazione affidata solo al colore;
- tabelle devono avere intestazioni;
- card e receipt devono collassare a una colonna su mobile;
- animazioni rispettano `prefers-reduced-motion`;
- l’auth gate non deve regredire.

## 6. Strategia di implementazione

1. creare dati e componenti CSS;
2. rifattorizzare homepage;
3. aggiornare pagine di prodotto;
4. aggiornare console;
5. aggiornare pagine tecniche e trust;
6. aggiornare Docs, FAQ, Vision;
7. aggiungere Team e Changelog;
8. estendere navigazione/footer;
9. aggiornare validatori;
10. eseguire test statici e browser.

## 7. Cose deliberatamente escluse

- Unity/Unreal;
- backend auth;
- invenzione di dati di business o sicurezza;
- modifica degli smart contract;
- dichiarazione di audit o readiness;
- reale allocazione automatica;
- integrazione di partner finanziari.
