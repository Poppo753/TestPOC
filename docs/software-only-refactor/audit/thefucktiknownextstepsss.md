Puoi portare avanti parecchio senza attendere le risposte dei provider. Il punto è lavorare su ciò che dipende solo da Jethos, evitando per ora integrazioni real-money.

## Priorità immediata: Sprint 0

### 1. Chiudere le decisioni architetturali interne

Approvate e documentate:

- `ARCH-001`: “Jethos compila, l’utente esegue”.
- `ARCH-002`: trust boundary e responsabilità.
- `AA-001`: formato dell’envelope Smart Account verificabile.
- `ARCH-011`: package condiviso, consigliato `packages/financial-engine`.
- `WEB-001`: `jethos-web` come frontend canonico.
- `BACK-001`: backend minimo, senza signer, custodia o order relay.

Queste decisioni sbloccano quasi tutto il lavoro tecnico successivo.

### 2. Rendere affidabile il repository

È lavoro concretamente implementabile subito:

- correggere ABI e selector obsoleti (`ABI-001`);
- riparare i comandi test con glob incompatibili;
- separare test legacy e target;
- installare/pinnare Foundry, Node e dipendenze;
- classificare i test falliti come bug, test obsoleto o requisito da preservare;
- creare un baseline CI riproducibile (`OPS-002A`).

Obiettivo: un comando documentato deve produrre sempre lo stesso risultato e distinguere chiaramente errori reali da test ormai superati.

### 3. Mettere sotto controllo il sistema legacy

Puoi iniziare subito in sola lettura:

- censire tutte le famiglie di deployment;
- verificare code hash e sorgente corrispondente;
- enumerare owner, operatori e moduli autorizzati;
- ricostruire holder LPT dagli eventi;
- rilevare asset, allowance, debiti, share e posizioni;
- ripetere tutto allo stesso blocco finalizzato tramite due RPC.

Questo completa `MIG-001`.

Poi puoi eseguire `MIG-002` esclusivamente su fork:

- riprodurre il bug full-burn/partial-payout;
- provare un’uscita senza perdita per ogni holder;
- definire expected balance delta;
- scrivere stop condition e rollback;
- preparare il runbook operativo.

Il freeze live (`MIG-003`) deve invece avvenire solo dopo questa prova e con autorizzazione esplicita di security/operator.

### 4. Rimuovere i rischi frontend urgenti

Senza attendere provider:

- ruotare e rimuovere la credenziale presente in `dapp-new`;
- decidere il piano di dismissione di `dapp-new`;
- impedire che il vecchio frontend venga pubblicato accidentalmente;
- documentare quale manifest/deployment consuma il frontend;
- introdurre CSP, secret scanning e controllo degli indirizzi;
- preparare una feature flag fail-closed per ogni futura integrazione.

## Lavoro prodotto che puoi fare in parallelo

Puoi costruire una demo completa senza SDK reali, usando adapter mock.

### UX “home banking”

Progetta le sezioni:

- Home;
- Cash;
- Card;
- Invest;
- Earn;
- Identity.

La demo può già mostrare:

- onboarding;
- account per chain;
- patrimonio aggregato con drill-down;
- stato KYC;
- IBAN/card/provider placeholder;
- configurazione esplicita dell’utente;
- review del piano;
- simulazione;
- conferma;
- ricevuta;
- provider outage e recovery.

Ogni elemento non disponibile deve essere etichettato `DEMO`, `MOCK` o `EXTERNAL GATE`.

### State machine dei provider

Puoi definire ora, senza API reali:

```text
NOT_CONNECTED
→ CONNECTING
→ ACTION_REQUIRED
→ PENDING_PROVIDER
→ ACTIVE
→ SUSPENDED
→ RECOVERY_REQUIRED
→ CLOSED
```

Implementa mock deterministici per:

- Sumsub;
- Monerium;
- Reap;
- 21X;
- Coinbase CDP.

Quando arriveranno le risposte, sostituirai il mock solo se la capability è confermata.

## Foundation TypeScript costruibile subito

Dopo aver approvato `ARCH-011`, puoi estrarre il codice puro esistente e creare:

- `ChainId`, `ChainAccount`, `AssetId`;
- `RuleSet` esplicito;
- `TransactionPlan`;
- `Call { to, data, value, chainId }`;
- serializzazione deterministica;
- dependency graph;
- plan fingerprint;
- registry versionato;
- decoder ABI;
- interfaccia di simulazione;
- expected post-state.

Il package deve essere tecnicamente incapace di:

- ottenere un signer;
- inviare transazioni;
- usare Hardhat o filesystem nel browser;
- chiamare un backend relay;
- scegliere autonomamente un’allocazione.

Puoi anche costruire adapter mock di Aave/Morpho/Euler. Eviterei ancora l’integrazione CDP reale e qualsiasi percorso con fondi.

## Lavoro organizzativo e legale preparatorio

Senza aspettare risposte puoi preparare:

- capability matrix con `CONFIRMED / UNKNOWN / REJECTED`;
- data-flow diagram per ogni provider;
- matrice delle responsabilità contrattuali;
- data inventory GDPR;
- retention/export/delete policy;
- incident runbook;
- provider outage e provider disappearance runbook;
- copy e disclosure da mostrare all’utente;
- elenco preciso delle domande per commercialista e consulente legale.

## Cosa non fare ancora

- Non deployare nuovi contratti finanziari.
- Non cancellare i contratti legacy.
- Non spostare o riscattare fondi live senza runbook approvato.
- Non implementare backend signer o relay.
- Non sviluppare contro API provider solo ipotizzate.
- Non abilitare borrow, leverage, flash loan, session key o rebalance automatico.
- Non considerare `Call[]` sufficiente per l’exactness ERC-4337.

## Definition of done consigliata per lo Sprint 0

Lo Sprint 0 è completato quando hai:

- ADR e trust boundary approvati;
- frontend e package canonici scelti;
- CI/test/ABI baseline riproducibile;
- snapshot `MIG-001` firmato e ripetibile;
- runbook zero-loss `MIG-002` verificato su fork;
- credenziale legacy rimossa/ruotata;
- prototipo navigabile delle sei sezioni;
- engine puro con mock adapter;
- capability matrix ed external gate aggiornati.

A quel punto riesegui il gate in [21_PRE_IMPLEMENTATION_GATE_REVIEW.md](/C:/Personal/TestPOC/docs/software-only-refactor/audit/21_PRE_IMPLEMENTATION_GATE_REVIEW.md). Il primo vertical slice reale successivo dovrebbe essere uno solo:

```text
Login
→ Smart Account user-owned
→ USDC balance
→ Aave supply/withdraw
→ exact-envelope review
→ user authorization
→ receipt/post-state
→ uscita nativa con Jethos offline
```

L’ordine operativo completo è già in [19_REVISED_EXECUTION_ORDER.md](/C:/Personal/TestPOC/docs/software-only-refactor/audit/19_REVISED_EXECUTION_ORDER.md), mentre i singoli task sono nella [checklist revisionata](/C:/Personal/TestPOC/docs/software-only-refactor/MASTER_CHECKLIST_ALL_MODULES_REVISED.md).