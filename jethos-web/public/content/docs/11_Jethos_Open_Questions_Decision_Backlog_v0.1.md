# Open Questions & Decision Backlog

> Domande future organizzate per milestone

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

## Come usare questo documento

Le domande non bloccano tutte il Master Vision Document. Sono raggruppate per il momento in cui diventano necessarie. Ogni risposta dovrà essere registrata con data, versione, motivazione e impatto sui documenti collegati.

> **Nota:** Nessuna ulteriore domanda è necessaria per pubblicare la bozza v0.1 della visione. Le domande “P0” bloccano il PoC o la sua corretta specifica; le altre possono essere affrontate progressivamente.

## P0 — Prima di implementare o chiudere il PoC 1A

- ☐ Quale implementazione ERC-4626 e quale meccanismo di virtual accounting verranno utilizzati?
- ☐ Quale decimal offset produce esattamente share a 18 decimali per USDC?
- ☐ Quale deposito minimo e quale minSharesOut applicare?
- ☐ Come si comporta il vault dopo il rimborso dell’ultima share reale?
- ☐ Qual è il valore esatto di staleness degli oracle già configurato nei contratti?
- ☐ Quali mercati specifici Aave, Morpho ed Euler sono autorizzati?
- ☐ Quali cap di contratto usare oltre ai 100 USDC effettivi?
- ☐ La fee di deposito 0,10% viene riscossa in asset o tramite share?
- ☐ Chi è il fee recipient del PoC e come viene testata la fee?
- ☐ Quali ruoli esistono nei contratti e quali indirizzi li controllano?
- ☐ Come viene implementato il 2-of-3 se il fondatore controlla inizialmente tutte le chiavi?
- ☐ Quali pause sono già disponibili nel codice e quali mancano?
- ☐ Quali operazioni può svolgere ciascuna chiave keeper?
- ☐ Come vengono generati e verificati operation ID e nonce?
- ☐ Quali metriche definiscono il successo della prima settimana?

## P1 — Prima del PoC 1B con borrowing

- ☐ Quale asset viene preso in prestito per primo?
- ☐ Quale protocollo origina il debito?
- ☐ Qual è l’utilizzo preciso dell’asset borrowed?
- ☐ Qual è la gamba positiva e quella negativa della strategia?
- ☐ Qual è la leva target e massima?
- ☐ Qual è il debt ratio massimo?
- ☐ Quali target, rebalance ed emergency health factor usare?
- ☐ Qual è il percorso completo di unwind?
- ☐ Quale liquidità è necessaria per chiudere la posizione?
- ☐ Come reagire a depeg, oracle stale o funding anomalo?
- ☐ Quale loss budget è consentito automaticamente?
- ☐ Quali stress test devono essere superati?

## P1 — Accounting e reward

- ☐ Quando includere reward maturate ma non reclamate nel NAV?
- ☐ Quale haircut applicare a reward illiquide?
- ☐ Quale soglia economica avvia l’harvest?
- ☐ Quali router e route sono autorizzati per vendere reward?
- ☐ Come gestire reward multiple e token non trasferibili?
- ☐ Come riconciliare asset inviati accidentalmente diversi dal base asset?
- ☐ Come impedire che un rescue sottragga asset contabilizzati?
- ☐ Come trattare interessi e claim nel mezzo di un deposito/prelievo?

## P1 — Risk scoring

- ☐ Quali pesi assegnare a smart contract, oracle, asset, liquidità e governance?
- ☐ Quali dati sono on-chain e quali off-chain?
- ☐ Con quale frequenza aggiornare il punteggio?
- ☐ Quale variazione causa riduzione automatica del cap?
- ☐ Quale punteggio minimo consente Conservativo, Bilanciato e Avanzato?
- ☐ Come valutare protocolli nuovi con poca storia?
- ☐ Come considerare dipendenze comuni tra protocolli?
- ☐ Come pubblicare e versionare la motivazione del rating?

## P1 — Sicurezza e amministrazione

- ☐ Quanto durerà il timelock dopo il PoC?
- ☐ Il guardian può soltanto mettere in pausa o anche effettuare unwind?
- ☐ Chi può revocare allowance e keeper?
- ☐ Quale loss budget richiede multisig?
- ☐ Quale perdita impone pausa totale?
- ☐ Quali cambiamenti richiedono migrazione obbligatoria?
- ☐ Quali funzioni restano attive in withdraw-only?
- ☐ Quale procedura si usa se il multisig non è raggiungibile?
- ☐ Quali audit e bug bounty precedono capitale pubblico?

## P2 — Withdrawal queue ERC-7540/7887

- ☐ Quanto dura un’epoca?
- ☐ Come vengono aggregate le richieste?
- ☐ Il price per share viene fissato alla richiesta o al claim?
- ☐ Come si calcola il soddisfacimento parziale?
- ☐ Il residuo passa automaticamente all’epoca successiva?
- ☐ Quando una richiesta può essere cancellata?
- ☐ La cancellazione restituisce share o asset?
- ☐ Come si impedisce front-running tra epoche?
- ☐ Come viene mostrato il tempo stimato?
- ☐ Quali vault possono restare sincroni e quali devono essere asincroni?
- ☐ Come si integra una share asincrona come collaterale?

## P2 — Share come collaterale

- ☐ Quale lending market supportare ufficialmente per primo?
- ☐ Quale oracle valuta la share?
- ☐ Quale LTV, liquidation threshold e cap utilizzare?
- ☐ Come misurare la liquidità riscattabile oltre al NAV?
- ☐ Come impedire loop di prestito e rideposito?
- ☐ Come impedire cicli con meta-vault?
- ☐ Come trattare share con queue lunga?
- ☐ Chi vota quando la share è depositata come collaterale?
- ☐ Come isolare bad debt del lending market dal vault?
- ☐ Quando disabilitare nuovi prestiti senza bloccare i rimborsi?

## P2 — Governance

- ☐ Quale partecipazione dà diritto al voto?
- ☐ Quale finestra temporale usa il saldo medio?
- ☐ Come funzionano snapshot e delega?
- ☐ Chi può presentare una proposta ufficiale?
- ☐ Quale quorum e maggioranza sono richiesti?
- ☐ Il team o un security council può porre veto?
- ☐ Quali regole del profilo sono fuori dalla governance ordinaria?
- ☐ Come votano utenti di vault con interessi differenti?
- ☐ Come evitare doppio conteggio di share prestate o collateralizzate?
- ☐ È necessario un token di governance separato?

## P2 — Modello economico

- ☐ La fee di deposito resta nel prodotto pubblico?
- ☐ Quando introdurre performance fee?
- ☐ Serve una management fee?
- ☐ Come implementare un high-water mark?
- ☐ Come ripartire ricavi tra treasury, strategist, keeper e assicurazione?
- ☐ Chi paga gas e automazioni?
- ☐ Come evitare che le fee rendano inutile il rendimento conservativo?
- ☐ Quale capitale minimo rende economicamente sostenibile un vault?
- ☐ Come finanziare audit e fondo di emergenza?

## P3 — Multi-vault e piramide

- ☐ Quali vault base devono esistere prima del primo meta-vault?
- ☐ Quale livello massimo di profondità consentire?
- ☐ Come calcolare il NAV look-through?
- ☐ Come distinguere TVL lordo e capitale esterno netto?
- ☐ Come applicare cap a esposizioni indirette?
- ☐ Come impedire cicli durante upgrade e migrazioni?
- ☐ Come gestire queue annidate?
- ☐ Come ripartire i costi di prelievo tra livelli?
- ☐ Come sospendere un vault inferiore senza bloccare tutto il meta-vault?

## P3 — Multi-chain e cross-chain

- ☐ Quale chain aggiungere dopo Arbitrum e con quali criteri?
- ☐ Quali bridge o messaging layer sono accettabili?
- ☐ La share remota è lock-and-mint, canonical transfer o posizione sintetica?
- ☐ Come verificare la copertura 1:1 delle share wrapped?
- ☐ Come aggiornare il NAV remoto e con quale haircut?
- ☐ Come gestire una chain congestionata o ferma?
- ☐ Come completare un prelievo attraverso due queue?
- ☐ Quali cap applicare a ogni chain e route?
- ☐ Come gestire messaggi duplicati, falliti o fuori ordine?
- ☐ Come isolare un exploit bridge?

## P3 — Frontend e comunicazione

- ☐ Quali dati mostrare nella vista semplice e nella vista avanzata?
- ☐ Come spiegare Conservativo senza implicare assenza di rischio?
- ☐ Come mostrare APY strategia, lordo vault e netto NAV?
- ☐ Come mostrare riserva, liquidità e tempo di uscita?
- ☐ Come spiegare le esposizioni nette verso asset non-base?
- ☐ Come mostrare il decision log senza sovraccaricare l’utente?
- ☐ Quali video o schede di 30 secondi accompagnano ogni vault?
- ☐ Come mostrare upgrade, pause e incidenti?
- ☐ Come distinguere Jethos Official da eventuale sandbox?

## P4 — Visione finanziaria futura

- ☐ Quale modello di smart account adottare senza compromettere self-custody?
- ☐ Come integrare carte e pagamenti tramite partner?
- ☐ Quali servizi richiedono KYC o restrizioni geografiche?
- ☐ Come mostrare asset tokenizzati esterni senza custodirli?
- ☐ Jethos offrirà lending collateralizzato direttamente o tramite protocolli?
- ☐ Quali asset del mondo reale sono compatibili con il modello di rischio?
- ☐ Come mantenere trasparenza quando entra un intermediario regolamentato?
- ☐ Quali servizi restano esplicitamente fuori dal perimetro?

## Decision register template

| ID | Data | Decisione | Stato | Motivazione | Documenti impattati |
| --- | --- | --- | --- | --- | --- |
| DEC-___ | ____-__-__ | ... | Proposta/Decisa/Sostituita | ... | 01, 04, 10... |
