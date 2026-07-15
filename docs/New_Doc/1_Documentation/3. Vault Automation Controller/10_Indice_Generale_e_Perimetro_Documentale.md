# Indice generale e perimetro documentale

## Risposta breve

Sì: il Vault Automation Controller è ora documentato dall'idea iniziale fino ai limiti che impediscono di chiamarlo production-ready. La sottocartella `09_Audit_Tecnico_Post_Verifica` contiene il primo censimento tecnico; `10_Control_File_Implementation` documenta control file, preflight, signer, Safe e servizio.

La documentazione distingue deliberatamente tre concetti che non devono essere confusi:

1. **implementato nel codice**: una capacità esiste ed è raggiungibile;
2. **verificato localmente o su fork**: esiste un'evidenza ripetibile nel perimetro indicato;
3. **validato operativamente in produzione**: richiede deploy, manifest reali, capitale controllato, shadow period, monitoraggio e gestione incidenti. Questo terzo livello non è ancora completato.

## Perimetro dell'implementazione corrente

Il controller governa un POC ristretto e intenzionale:

- un vault per configurazione;
- una chain per processo/configurazione;
- un solo asset base;
- allocazione supply-only;
- operazioni di deposito e prelievo;
- adapter supportati per Aave, Euler e Morpho Vault;
- osservazione, proposta, veto di rischio, pianificazione, simulazione, approvazione, esecuzione e verifica post-transazione;
- persistenza locale con journal JSON e lock per vault;
- modalità observe, advisory e autonomy con doppio opt-in;
- supporto a Hardhat fork con signer esplicito o impersonation configurata.

Restano fuori dal perimetro operativo: Dolomite e GMX incompleti, borrow, leverage, swap automatici, bridge, Morpho market diretto, governance automatica e strategia multi-asset.

## Dove leggere, in base alla domanda

### Voglio capire l'idea e l'architettura

1. `first chat idea.md` — origine e obiettivo del controller.
2. `00_Audit_e_Stato_Attuale.md` — punto di partenza e gap iniziali.
3. `01_Strategia_Espansa_e_Architettura.md` — architettura, trust boundary e ordine di implementazione.
4. `02_Revisione_Critica_della_Strategia.md` — correzioni emerse dalla rilettura critica.

### Voglio sapere esattamente cosa è stato implementato

1. `04_Stato_Finale_e_Changelog.md` — risultato sintetico e prove eseguite.
2. `09_Audit_Tecnico_Post_Verifica/01_Censimento_Modifiche_File_per_File.md` — responsabilità e motivazione di ogni file modificato.
3. `09_Audit_Tecnico_Post_Verifica/02_Flusso_End_to_End_e_Invarianti.md` — tutti i passaggi e le proprietà che devono restare vere.
4. `09_Audit_Tecnico_Post_Verifica/03_Configurazione_e_Policy_Field_by_Field.md` — significato di ciascun campo e relativo impatto di sicurezza.

### Voglio eseguirlo o integrarlo in un server

1. `05_Guida_Comandi_e_Utilizzo.md` — comandi, flag e casi d'uso.
2. `09_Audit_Tecnico_Post_Verifica/04_Simulazione_Fork_Deploy_e_Server.md` — differenze fra locale, fork, chain reale e servizio 24/7.
3. `06_Runbook_Sicurezza_e_Incidenti.md` — rollout, blocco, recovery ed escalation.
4. `09_Audit_Tecnico_Post_Verifica/05_Persistenza_Lock_Concorrenza_e_Recovery.md` — journal, lock, crash e ripristino.

### Voglio revisionare test e sicurezza

1. `08_Verifica_End_to_End_14_07_2026.md` — verdetto e risultati dell'ultima verifica completa.
2. `09_Audit_Tecnico_Post_Verifica/06_Matrice_Test_e_Tracciabilita.md` — requisito, codice, test ed evidenza.
3. `09_Audit_Tecnico_Post_Verifica/07_Limiti_Residui_Gate_e_Roadmap.md` — ciò che non è ancora dimostrato.
4. `03_Checklist_Implementazione.md` — task completati e gate esterni ancora aperti.

## Censimento dei documenti principali

| Documento | Funzione | Stato |
|---|---|---|
| `00_Audit_e_Stato_Attuale.md` | fotografa il punto di partenza | storico, valido come baseline |
| `01_Strategia_Espansa_e_Architettura.md` | definisce architettura e strategia | aggiornato con drift quantitativo e revalidazione |
| `02_Revisione_Critica_della_Strategia.md` | registra la revisione critica | completato |
| `03_Checklist_Implementazione.md` | traccia task e gate | aggiornata; i gate operativi restano aperti |
| `04_Stato_Finale_e_Changelog.md` | riepiloga implementazione ed evidenze | aggiornato all'audit del 14/07/2026 |
| `05_Guida_Comandi_e_Utilizzo.md` | manuale di esecuzione | aggiornato per fork, drift e revalidazione |
| `06_Runbook_Sicurezza_e_Incidenti.md` | procedura operativa e incident response | valido per il POC corrente |
| `07_Mappa_File_e_Limiti_Evolutivi.md` | mappa codice e roadmap | aggiornato con il censimento tecnico |
| `08_Verifica_End_to_End_14_07_2026.md` | evidenza dell'ultima verifica | fotografia corrente |
| `09_Audit_Tecnico_Post_Verifica/` | dettaglio tecnico granulare | completato |
| `10_Indice_Generale_e_Perimetro_Documentale.md` | indice e confini delle affermazioni | documento corrente |
| `10_Control_File_Implementation/` | control file, preflight, Safe e runner 24/7 | software completato, gate reali aperti |

I file `Prompt.md` e `Guide&NEXTImplementation.md` restano materiale di lavoro e contesto. Non prevalgono sui documenti numerati quando descrivono stato, sicurezza o maturità.

## Censimento della sottocartella tecnica

| Documento | Contenuto censito |
|---|---|
| `README.md` | scopo, ordine di lettura e perimetro certificato |
| `01_Censimento_Modifiche_File_per_File.md` | file creati/modificati, responsabilità, motivazioni e relazioni |
| `02_Flusso_End_to_End_e_Invarianti.md` | state machine completa e invarianti prima/dopo ogni fase |
| `03_Configurazione_e_Policy_Field_by_Field.md` | schema, policy, protocolli, runtime e soglie |
| `04_Simulazione_Fork_Deploy_e_Server.md` | eth_call, simulazione sequenziale, fork, deploy e servizio continuativo |
| `05_Persistenza_Lock_Concorrenza_e_Recovery.md` | journal, atomicità, lock, TTL, concorrenza, crash e migrazione DB |
| `06_Matrice_Test_e_Tracciabilita.md` | tutti i livelli di test e collegamento requisiti-evidenze |
| `07_Limiti_Residui_Gate_e_Roadmap.md` | limiti noti, gate ordinati e percorso verso produzione |

## Evidenze correnti

Alla verifica del 14 luglio 2026:

- test specifici del controller: **14 passing**;
- regression suite degli script: **37 passing**;
- totale locale delle due suite: **51 passing**;
- typecheck: **PASS**;
- compilazione Solidity/Hardhat: **PASS**;
- smoke test read-only su fork Arbitrum fissato al blocco `483105327`: **PASS**.

Il fork smoke non porta il totale a 47 perché è riportato come prova ambientale separata, non come parte delle due suite locali conteggiate.

## Cosa significa “completo” in questa documentazione

“Completo” significa che il comportamento implementato è censito e che i limiti conosciuti sono dichiarati. Non significa che il sistema sia già autorizzabile con capitale significativo.

Prima di una certificazione operativa servono ancora, almeno:

1. deploy POC isolato con indirizzi e ruoli reali;
2. manifest e configurazione validati per quel deploy;
3. full-cycle del controller sul fork del POC, usando il vero owner/ruolo autorizzato;
4. acceptance dell'adapter con Safe reale, firme e quorum;
5. periodo shadow 24/7 con RPC stabile, metriche e alert remoti;
6. receipt reconciler e recovery provata dopo crash;
7. persistenza transazionale/HA se vengono avviati più worker o host;
8. audit di sicurezza e rollout progressivo con capitale limitato.

Questi punti non sono omissioni documentali: sono gate esplicitamente aperti e tracciati nella checklist e nella roadmap.

## Regola di manutenzione

Ogni modifica futura al controller deve aggiornare insieme:

1. il censimento file-per-file, se cambia una responsabilità;
2. la guida configurazione, se cambia schema o policy;
3. la matrice test, con l'evidenza nuova o modificata;
4. checklist e changelog;
5. limiti e roadmap, se cambia il perimetro supportato.

Una capacità non deve essere dichiarata disponibile soltanto perché esiste una funzione: deve avere configurazione valida, test proporzionati al rischio, runbook e un failure path documentato.
