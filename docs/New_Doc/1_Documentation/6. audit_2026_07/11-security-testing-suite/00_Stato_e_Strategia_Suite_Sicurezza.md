# Stato e strategia della suite di sicurezza

## 1. Scopo

Questo documento definisce come trasformare l'attuale insieme di test e il
registro di audit di luglio 2026 in un processo di sicurezza riproducibile.
L'obiettivo non è accumulare tool, ma assegnare a ogni strumento un compito
preciso, produrre evidenze verificabili e impedire che una Pull Request
introduca una regressione economica o di sicurezza.

La strategia riguarda il codice attivo di core, Aave, Euler, Morpho, Morpho
Vault e InterVault. Dolomite, GMX, cartelle `old`, backup e mock non destinati al
deploy sono fuori dal gate production finché non vengono completati e ammessi
formalmente nello scope.

## 2. Situazione attuale

### 2.1 Cosa esiste già

Il repository dispone già di una base importante:

- Hardhat 2 con Solidity 0.8.27, optimizer e `viaIR`;
- test unitari, integration, E2E, security, performance e fork;
- cinque file di invariant test TypeScript;
- fixture full-core e mock deterministici;
- fork Arbitrum con whale, snapshot/revert e blocchi fissabili;
- test di script, deployment, manifest e operazioni;
- test del Vault Automation Controller;
- GitHub Actions con job unit, integration, security, invariant e fork;
- audit documentale con catalogo architetturale e issue register;
- observer VPS e storico operativo separati dai test di sviluppo.

Questa base deve essere conservata. Hardhat resta autorevole per integrazione
TypeScript, manifest, Safe, automazione, CLI e fork orchestrati.

### 2.2 Limiti attuali

La copertura esistente è ampia, ma non costituisce ancora una pipeline di
security assurance completa:

- nessuna static analysis automatica in CI;
- invariant TypeScript prevalentemente scenario-based, non campagne stateful
  profonde generate dal fuzzer;
- nessun corpus persistente di counterexample;
- nessun symbolic testing mirato alle formule economiche;
- workflow CI non aggiornato alle versioni correnti delle action;
- job fork privo di `FORK_BLOCK_NUMBER` obbligatorio;
- trigger CI centrati su `main/develop`, mentre il lavoro corrente usa altri
  branch;
- audit con duplicati, ID incoerenti, severity non uniformi e finding non tutti
  verificati;
- nessuna matrice formale finding -> PoC -> fix -> regression -> evidenza;
- nessuna policy di baseline per distinguere debito tecnico esistente da nuovi
  finding introdotti da una PR.

### 2.3 Il finding NAV come esempio

Il problema di valorizzazione fail-open dimostra perché servono più livelli.
Una lettura manuale ha trovato che ValueCalculator e ProtocolManager possono
saltare un token o una Lens fallita e restituire un NAV incompleto. Un test
deterministico dimostra lo scenario InterVault, ma una suite matura deve anche:

- rilevare automaticamente nuovi `catch` silenziosi tramite static analysis;
- fuzzare depositi/prelievi quando una sorgente di valore cambia stato;
- verificare l'invariante “NAV valido oppure revert” su sequenze multiutente;
- provare simbolicamente la formula di share in un modello ridotto;
- riprodurre il comportamento su fork senza dipendere dal blocco corrente.

## 3. Valutazione dell'audit 2026-07

L'audit è un buon backlog red-team, non ancora una certificazione. Prima di
implementare le raccomandazioni devono essere eseguiti:

1. deduplicazione semantica;
2. verifica sul commit corrente;
3. correzione di ID, conteggi e severity;
4. distinzione tra bug, hardening, design choice e fuori scope;
5. PoC per ogni Critical/High;
6. definizione dell'invariante violato;
7. regression test prima del fix;
8. chiusura soltanto dopo evidenza post-fix.

Esempi da normalizzare:

- `CORE-049` e `NEW-028` descrivono lo stesso zero-silent dei token;
- il fallimento Lens è descritto nel catalogo ma non ha un ticket autonomo;
- un finding dichiarato falso positivo compare ancora in alcune liste;
- breakdown e totale dichiarato non coincidono;
- alcune assenze di modifier sono presentate come exploit senza call graph;
- alcune raccomandazioni cambiano l'architettura prima di dimostrare il rischio.

## 4. Principi della strategia

### 4.1 Ogni tool deve rispondere a una domanda diversa

| Livello | Domanda | Strumento principale |
|---|---|---|
| Compile/type | Il codice è coerente e compilabile? | Hardhat, TypeScript |
| Scenario | Il flusso noto produce l'esito atteso? | Hardhat/Mocha |
| Static analysis | Esiste un pattern strutturalmente sospetto? | Slither |
| Fuzz | Quali input rompono una proprietà? | Foundry |
| Stateful invariant | Quale sequenza di operazioni rompe l'economia? | Foundry, Echidna |
| Symbolic | La proprietà vale per l'intero dominio modellato? | Halmos selettivo |
| Integrazione reale | Il codice interagisce col protocollo deployato? | Hardhat fork fissato |
| Operatività | Manifest, Safe, RPC e servizio funzionano? | Script/VAC/canary |
| Revisione indipendente | Cosa non abbiamo modellato? | Audit esterno |

Due strumenti sovrapposti non devono essere aggiunti finché non esiste una
proprietà che giustifichi il secondo motore.

### 4.2 Nessun warning è automaticamente un bug

Un finding statico deve avere:

- codice e commit di riferimento;
- precondizioni e attore;
- percorso di chiamata;
- asset o invariante impattato;
- scenario riproducibile, se possibile;
- severity e confidence separate;
- decisione e motivazione.

L'assenza di `nonReentrant`, per esempio, richiede di dimostrare una callback e
uno stato sfruttabile. Aggiungere modifier indiscriminatamente può rompere call
legittime senza eliminare il rischio reale.

### 4.3 Fail-closed progressivo nella CI

La prima esecuzione Slither produrrà warning preesistenti. Bloccare tutte le PR
su qualunque warning renderebbe la CI permanentemente rossa. Si crea invece una
baseline revisionata:

- finding conosciuti: tracciati con stato e scadenza;
- nuovi High/Medium ad alta confidence: bloccanti;
- informational e low: report, non gate iniziale;
- falsi positivi: esclusione puntuale con motivazione;
- nessuna esclusione globale per far “diventare verde” il job.

La severità del gate cresce quando la baseline viene ridotta.

### 4.4 Riproducibilità prima della profondità

Ogni ambiente deve fissare:

- versione Node e lockfile;
- versione Python e Slither;
- versione Foundry o immagine/container digest;
- versione solc 0.8.27;
- optimizer, `viaIR` e remapping;
- chain ID e blocco fork;
- seed/corpus quando supportato;
- timeout e numero di run;
- esclusioni e scope production.

Un test profondo ma non riproducibile non può essere un gate.

## 5. Architettura raccomandata

```text
Hardhat + TypeScript
├── unit/integration/E2E esistenti
├── fork Arbitrum e protocolli reali
├── deployment, manifest e Safe
├── script e CLI
└── Vault Automation Controller

Slither
├── static analysis per PR
├── baseline revisionata
├── report SARIF/Markdown
└── blocco sui nuovi finding seri

Foundry
├── unit Solidity economici
├── fuzz parametrico
├── invariant stateful
├── gas/bytecode regression
└── fork mirati quando utile

Echidna
├── campagne lunghe nightly
├── corpus persistente
├── sequenze multi-call
└── minimizzazione counterexample

Halmos
├── proprietà matematiche ridotte
├── access control selezionato
└── share/NAV/rounding
```

## 6. Ordine consigliato

### Fase 0 — congelare scope e normalizzare audit

Prima dei tool si definisce il commit base, l'elenco production e la tassonomia
dei finding. Critical e High ricevono PoC o motivazione esplicita di mancata
riproducibilità.

### Fase 1 — rendere autorevole la CI esistente

Si correggono trigger, versioni action, suite realmente eseguite, blocco fork,
timeout e artifact. La CI deve prima eseguire affidabilmente ciò che già esiste.

### Fase 2 — introdurre Slither in modalità osservazione

Si esegue sullo scope production, si genera il report iniziale e si fa triage.
Il job non blocca finché baseline e configurazione non sono revisionate.

### Fase 3 — attivare il gate differenziale Slither

Solo i nuovi finding rilevanti bloccano la PR. La baseline non è una whitelist
eterna: ogni finding accettato ha owner, motivazione e target di revisione.

### Fase 4 — aggiungere Foundry senza migrare Hardhat

Si crea configurazione compatibile col layout attuale e si parte dalle
proprietà economiche più importanti. Nessun test TypeScript viene riscritto
senza un beneficio misurabile.

### Fase 5 — campagne invariant e attack harness

Si modellano attori, donazioni, fee, yield, failure Lens/oracle, pausa, upgrade,
cap, emergenza e sequenze di deposit/withdraw/rebalance.

### Fase 6 — Echidna nightly

Si riutilizzano gli invariant Foundry dove possibile. Corpus e counterexample
diventano artifact persistenti e regressioni deterministiche.

### Fase 7 — Halmos mirato

Solo formule e contratti con dominio controllabile. Non si tenta di simbolizzare
l'intero sistema e tutti i protocolli esterni.

### Fase 8 — remediation audit e verifica indipendente

Ogni fix segue test rosso -> fix minimo -> test verde -> suite completa -> fork.
Dopo Critical/High e gate operativi si richiede audit esterno sul commit esatto.

## 7. Proprietà prioritarie

### NAV e share

- un componente attivo non valorizzabile invalida il NAV;
- il valore non può sparire senza errore esplicito;
- depositi non possono coniare più valore di quanto ricevuto;
- prelievi normali consegnano l'importo calcolato oppure revertano;
- nessuna share viene bruciata per liquidità parziale non accettata;
- donazione e first-depositor non producono profitto estratto dalla vittima;
- rounding loss resta entro un bound dichiarato;
- `totalSupply == 0` ha bootstrap controllato.

### Custody e protocolli

- somma custody parent/plugin/protocollo non duplica valore;
- allowance torna a zero o al bound previsto;
- delta reale di balance coincide con quanto contabilizzato;
- share protocollo e active tracking restano coerenti;
- chiusura/emergenza non dimentica posizioni residue;
- registry e Beacon non possono cambiare semantica senza invalidare preflight.

### Accesso, pausa ed emergenza

- nessun attore non autorizzato sposta fondi o cambia configurazione;
- pausa blocca operazioni di rischio ma non la recovery autorizzata;
- emergency recipient è quello approvato;
- Safe/timelock non sono aggirabili da metodi batch o alias;
- un fallimento parziale viene osservato e non dichiarato successo.

### Oracle, health e slippage

- prezzo stale/invalid/future timestamp non produce prezzo utilizzabile;
- sequencer down/grace period invalida l'oracolo;
- health unknown non diventa healthy;
- scale e decimals restano coerenti tra plugin e Lens;
- ogni swap economico ha minOut/deadline applicati nel punto di esecuzione;
- quote manipolabile non è l'unica protezione post-swap.

## 8. CI proposta

### Pull Request

- installazione riproducibile;
- compile e typecheck;
- suite Hardhat locali rilevanti;
- Slither differenziale;
- Foundry unit/fuzz breve;
- invariant breve con seed registrato;
- artifact dei report anche in caso di failure.

### Nightly

- suite Hardhat completa non-fork;
- fork fissati per Aave/Euler/Morpho/Morpho Vault/InterVault;
- Foundry invariant profondo;
- Echidna con corpus persistente;
- coverage e gas/bytecode regression;
- nessun uso di chiave privata, soltanto RPC read/fork.

### Release candidate

- audit register senza Critical/High aperti non accettati;
- suite completa e replay counterexample;
- fork post-deploy/rehearsal;
- Halmos selettivo;
- Slither completo senza nuova baseline opportunistica;
- audit esterno e successivo canary.

## 9. Stima iniziale

| Attività | Stima indicativa |
|---|---:|
| Normalizzazione audit e scope | 3–7 giorni, più PoC complessi |
| Correzione CI esistente | 1–3 giorni |
| Installazione/configurazione Slither | 1–2 giorni |
| Primo triage Slither | 2–5 giorni |
| Foundry sidecar e primi test | 2–4 giorni |
| Prima suite invariant utile | 1–2 settimane |
| Echidna nightly | 3–5 giorni dopo gli invariant |
| Halmos su proprietà selezionate | 3–7 giorni |

Le stime non includono la remediation dei bug: ogni Critical/High può richiedere
da alcune ore a più giorni, soprattutto se cambia la semantica economica.

## 10. Decisione raccomandata

La strategia migliore è incrementale:

1. rendere affidabile ciò che esiste;
2. normalizzare l'audit;
3. introdurre Slither e una baseline seria;
4. aggiungere Foundry per proprietà economiche;
5. usare Echidna per profondità temporale;
6. usare Halmos soltanto dove offre una prova più forte;
7. mantenere Hardhat, script e automazione;
8. richiedere audit esterno prima di capitale significativo.

Riferimenti ufficiali:

- Slither: https://github.com/crytic/slither
- Foundry/Hardhat: https://getfoundry.sh/config/hardhat
- Foundry invariant: https://getfoundry.sh/forge/invariant-testing
- Echidna: https://github.com/crytic/echidna
- Halmos: https://github.com/a16z/halmos
