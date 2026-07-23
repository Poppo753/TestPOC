# Risk Framework

> Profili, metriche quantitative, cap e protezione del capitale

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

## 1. Obiettivo

> **Nota:** Il vault mira a preservare e accrescere il capitale espresso nel proprio base asset, mantenendo entro limiti prestabiliti le esposizioni nette verso asset diversi dal base asset.

Il rischio viene presentato all’utente attraverso tre profili semplici, ma calcolato attraverso parametri quantitativi. “Conservativo” non significa privo di rischio: indica limiti più severi, liquidità superiore e dipendenze inferiori.

## 2. Dimensioni del risk score

| Dimensione | Esempi di indicatori |
| --- | --- |
| Smart contract | Audit, anzianità, incidenti, upgradeability, bug bounty. |
| Protocollo e governance | Concentrazione admin, timelock, pause, dipendenze. |
| Mercato | TVL, utilization, liquidità prelevabile, concentrazione. |
| Oracle | Fonte, staleness, fallback, deviazione, manipulabilità. |
| Asset | Volatilità, depeg, wrapper, emittente, redemption. |
| Debito e liquidazione | LTV, health factor, correlazione, velocità di deleverage. |
| Strategia | Numero di gambe, leva, derivati, scadenze, asincronia. |
| Chain/bridge | Finalità, sequencer, bridge, messaging, wrapped representation. |
| Operativo | Keeper, chiavi, monitoraggio, possibilità di doppia esecuzione. |

## 3. Parametri provvisori dei profili

| Parametro | Conservativo | Bilanciato | Avanzato |
| --- | --- | --- | --- |
| Leva target | 1,00x | Da definire per strategia | Da definire per strategia |
| Leva massima | 1,10x PROVVISORIO | PROVVISORIO ≤1,30x | PROVVISORIO ≤1,75x |
| Debt ratio massimo | 10% PROVVISORIO | 25% PROVVISORIO | 45% PROVVISORIO |
| HF target | ≥2,2 | ≥1,8 | ≥1,5 |
| HF rebalance | 2,0 | 1,6 | 1,35 |
| HF emergenza | 1,8 | 1,4 | 1,25 |
| Cap per protocollo | 15% | 20% | 20% |
| Cap per mercato | 10% | 15% | 20% |
| Quota max del mercato | 5% della liquidità utile | 10% | 15% |
| Riserva | Più elevata | Intermedia | Inferiore ma non nulla |

> **Nota:** I valori sono proposte operative per strutturare test e documentazione, non parametri definitivi. Le strategie supply-only del PoC 1A non usano leva né debito.

## 4. Health factor e metriche complementari

Jethos deve controllare contemporaneamente leva, debt ratio, LTV, health factor, buffer dalla liquidazione, correlazione e liquidità. Nessuna singola metrica descrive da sola la sicurezza della posizione.

## 5. Concentrazione

- Massimo provvisorio generale del 20% per protocollo e mercato, con limiti inferiori nei profili prudenti.
- Cap dinamico rispetto a TVL, liquidità prelevabile e importo uscibile entro una finestra.
- Il deposito deve simulare l’effetto sull’utilization e sull’APY post-allocazione.
- Il limite di protocollo deve considerare anche esposizioni indirette attraverso vault e asset.

## 6. Strategie e categorie

| Elemento | Conservativo | Bilanciato | Avanzato |
| --- | --- | --- | --- |
| Lending supply-only | Sì | Sì | Sì |
| Borrowing | Assente o minimo | Limitato | Consentito entro limiti |
| Staking | Possibile se semplice e liquido | Sì | Sì |
| Restaking | No inizialmente | Limitato / valutato | Sì se approvato |
| Pendle PT | Non inizialmente; possibile in futuro | Sì selezionato | Sì |
| Perpetual | No | Solo strategie specifiche | Sì con hedge e cap |
| Bridge/cross-chain | No inizialmente | Futuro con limiti | Futuro con limiti |

## 7. Loss budget provvisorio

| Modalità | Perdita massima proposta | Comportamento |
| --- | --- | --- |
| Ordinaria | 0,10% | Operazione consentita se motivata dai costi normali e dai limiti. |
| Emergency automation | 0,50% | Unwind automatico per evitare una perdita maggiore, con evento e modalità dedicata. |
| Multisig emergency | 2,00% | Intervento straordinario motivato e registrato. |
| Oltre soglia | Nessuna esecuzione automatica | Pausa, analisi e piano di recovery. |

> **Nota:** PROVVISORIO: i loss budget devono essere definiti per strategia e testati con scenari estremi. Non sono promesse di perdita massima per l’utente.

## 8. Risk scoring del team

- Metodologia pubblica e versionata.
- Motivazione di ogni punteggio e variazione.
- Possibilità di disabilitare rapidamente mercati senza bloccare repay e withdraw.
- Revisione futura indipendente e community approval.
- Separazione tra rating del protocollo e rating della specifica strategia.

## 9. Contagio e isolamento

- Cap per plugin e vault sottostante.
- Nessun ciclo nel grafo dei vault.
- Mercati collateralizzati isolati per le share Jethos.
- Contabilità look-through delle esposizioni.
- Possibilità di sospendere una strategia senza bloccare l’intero vault.
- Cross-chain come modulo separato con cap dedicato.
