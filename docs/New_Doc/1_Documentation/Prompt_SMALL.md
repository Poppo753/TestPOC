Devi analizzare, pianificare, implementare, verificare e documentare la modifica richiesta utilizzando il materiale presente nella chat, negli allegati e nel progetto.

## Configurazione

DOCUMENTATION_PATH: `[INSERIRE_PATH_CARTELLA_DOCUMENTAZIONE]`

Salva obbligatoriamente la documentazione in questa cartella, creando sempre la seguente struttura:

```text
DOCUMENTATION_PATH/
├── 01_CONTEXT.md
├── 02_PLAN.md
├── 03_CHECKLIST.md
├── 04_IMPLEMENTATION_REPORT.md
└── 05_USAGE_GUIDE.md
```

Non modificare i nomi dei file, non creare copie come `PLAN_v2.md` o `CHECKLIST_FINAL.md` e non creare altri documenti salvo necessità tecnica reale.

Adatta il livello di dettaglio alla dimensione della modifica, ma mantieni sempre questa struttura.

---

## 1. Analisi del progetto

Prima di scrivere o modificare codice:

1. Leggi il materiale fornito nella chat e negli allegati.
2. Analizza la struttura del progetto e i file rilevanti.
3. Individua:

   * comportamento attuale;
   * risultato richiesto;
   * componenti coinvolti;
   * dipendenze;
   * convenzioni già utilizzate;
   * funzionalità esistenti riutilizzabili;
   * rischi, edge case e possibili regressioni.
4. Non assumere che la soluzione inizialmente proposta sia necessariamente quella migliore.
5. Valuta eventuali alternative e scegli la soluzione più semplice, coerente, sicura e manutenibile.
6. Non modificare ancora il codice.

Compila `01_CONTEXT.md` con questa struttura:

```markdown
# Contesto

## Richiesta

## Situazione attuale

## Obiettivo

## File e componenti coinvolti

## Vincoli e dipendenze

## Rischi ed edge case

## Assunzioni
```

---

## 2. Piano tecnico

Crea `02_PLAN.md` descrivendo esattamente come verrà realizzata la modifica.

Utilizza sempre questa struttura:

```markdown
# Piano tecnico

## Soluzione scelta

## Motivazione della soluzione

## Alternative valutate

## Modifiche previste

### File da creare

### File da modificare

### File da eliminare

## Flusso di funzionamento

## Gestione degli errori

## Sicurezza e validazioni

## Compatibilità e regressioni

## Strategia di test

## Ordine di implementazione
```

Per ogni modifica prevista specifica:

* file interessato;
* funzione, classe o componente coinvolto;
* comportamento attuale;
* comportamento da ottenere;
* modifica necessaria;
* dipendenze;
* rischi;
* verifica richiesta.

Dopo aver scritto il piano, rileggilo interamente e correggilo direttamente se:

* contiene attività inutili;
* manca qualche passaggio;
* introduce complessità non necessaria;
* non è coerente con il progetto;
* può causare regressioni;
* esiste un approccio migliore.

Non creare una seconda versione del piano.

---

## 3. Checklist

Crea `03_CHECKLIST.md` trasformando ogni attività del piano in task operativi.

Utilizza sempre questa struttura:

```markdown
# Checklist

## Stato generale

- Stato: DA INIZIARE
- Task completati: 0
- Task totali: 0
- Ultimo aggiornamento:

## Fase 1 — Preparazione

## Fase 2 — Implementazione

## Fase 3 — Test e verifiche

## Fase 4 — Documentazione

## Problemi e deviazioni

## Attività non completate
```

Ogni task deve usare questo formato:

```markdown
- [ ] TASK-001 — Titolo del task
  - Obiettivo:
  - File coinvolti:
  - Modifica:
  - Dipendenze:
  - Criterio di completamento:
  - Verifica richiesta:
  - Esito:
```

La checklist deve includere:

* tutte le modifiche al codice;
* file da creare, modificare o eliminare;
* configurazioni;
* dipendenze;
* validazioni;
* gestione degli errori;
* sicurezza;
* test;
* build, lint e type-check quando disponibili;
* aggiornamento della documentazione;
* verifica finale delle regressioni.

Confronta `03_CHECKLIST.md` con `02_PLAN.md` prima di iniziare. Correggi task mancanti, duplicati, vaghi o fuori ordine.

---

## 4. Implementazione

Esegui tutti i task della checklist rispettandone l’ordine e le dipendenze.

Durante l’implementazione:

* modifica solamente i file necessari;
* rispetta architettura, stile e convenzioni del progetto;
* riutilizza il codice esistente quando appropriato;
* evita duplicazioni;
* evita dipendenze non necessarie;
* non eliminare funzionalità esistenti senza una motivazione;
* mantieni la retrocompatibilità salvo richiesta contraria;
* non inserire segreti o credenziali nel codice;
* gestisci errori, input non validi, casi limite e cleanup;
* non lasciare codice inutilizzato o soluzioni temporanee non documentate.

Aggiungi commenti nel codice per spiegare:

* logiche non evidenti;
* decisioni architetturali;
* vincoli tecnici;
* edge case;
* modalità di configurazione;
* modalità di utilizzo.

Non aggiungere commenti che si limitano a ripetere ciò che il codice mostra già chiaramente.

Dopo ogni task:

1. esegui la verifica prevista;
2. aggiorna immediatamente `03_CHECKLIST.md`;
3. modifica `[ ]` in `[x]` solamente se il task è completato e verificato;
4. inserisci l’esito della verifica;
5. aggiorna il numero dei task completati;
6. annota eventuali problemi o deviazioni dal piano.

Non dichiarare completato un task che non hai realmente implementato o verificato.

Quando una verifica non può essere eseguita, lascia il task non completato oppure contrassegnalo chiaramente come bloccato, indicando il motivo.

---

## 5. Verifica finale

Dopo l’implementazione:

1. rileggi tutte le modifiche;
2. confronta il risultato con la richiesta originale;
3. confronta il codice con `02_PLAN.md`;
4. controlla che tutti i task di `03_CHECKLIST.md` siano stati gestiti;
5. verifica import, nomi, tipi, configurazioni e dipendenze;
6. cerca regressioni, codice duplicato, codice morto e comportamenti incoerenti;
7. esegui, quando disponibili:

   * build;
   * type-check;
   * lint;
   * test automatici;
   * test di integrazione;
   * test manuali pertinenti;
8. correggi gli errori individuati;
9. aggiorna definitivamente la checklist.

Al termine imposta lo stato generale della checklist su uno dei seguenti valori:

* `COMPLETATO E VERIFICATO`
* `COMPLETATO CON VERIFICHE PARZIALI`
* `PARZIALMENTE COMPLETATO`
* `BLOCCATO`

---

## 6. Report dell’implementazione

Compila `04_IMPLEMENTATION_REPORT.md` con questa struttura:

```markdown
# Report dell’implementazione

## Riepilogo

## Situazione iniziale

## Soluzione implementata

## File creati

## File modificati

## File eliminati

## Funzionalità implementate

## Bug corretti

## Decisioni tecniche

## Differenze rispetto al piano

## Test e verifiche eseguiti

## Risultati delle verifiche

## Problemi noti

## Attività rimaste aperte
```

Riporta solamente ciò che è stato realmente fatto.

Non dichiarare eseguiti test o controlli che non sono stati eseguiti.

---

## 7. Guida all’utilizzo

Compila `05_USAGE_GUIDE.md` con questa struttura:

```markdown
# Guida all’utilizzo

## Panoramica

## Prerequisiti

## Installazione

## Configurazione

## Variabili d’ambiente

## Avvio ed esecuzione

## Script e comandi disponibili

## Parametri e input

## Output atteso

## Esempi di utilizzo

## Struttura dei file coinvolti

## Errori comuni e risoluzione

## Limiti e note di sicurezza
```

Descrivi tutti gli script, i comandi e i componenti creati o modificati che devono essere utilizzati da uno sviluppatore o da un utente.

Per ogni script o comando specifica:

* scopo;
* percorso;
* prerequisiti;
* comando completo;
* parametri;
* input;
* output;
* esempio;
* errori comuni.

Quando una sezione non è applicabile, mantienila e scrivi `Non applicabile`, spiegandone brevemente il motivo.

---

## Regole finali

* Non fermarti alla pianificazione: esegui concretamente l’implementazione.
* Non creare documentazione duplicata.
* Non modificare i nomi o la struttura dei cinque documenti.
* Mantieni sincronizzati piano, checklist, codice e report.
* Usa un livello di dettaglio proporzionato alla modifica.
* Per task piccoli, scrivi sezioni brevi ma complete.
* Per task grandi, suddividi il lavoro in task atomici e verificabili.
* Non inventare risultati, file, test o funzionalità.
* Se trovi una strategia migliore durante il lavoro, aggiorna prima il piano e la checklist, poi implementala.
* Alla fine fornisci in chat un riepilogo breve con:

  * stato finale;
  * file di codice creati o modificati;
  * documenti creati;
  * test eseguiti;
  * eventuali task aperti.
