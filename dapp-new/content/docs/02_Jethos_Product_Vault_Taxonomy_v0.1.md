# Product & Vault Taxonomy

> Famiglie di prodotto, profili di rischio e piramide dei vault

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

## 1. Principio contabile del prodotto

> **Nota:** Il vault mira a preservare e accrescere il capitale espresso nel proprio base asset, mantenendo entro limiti prestabiliti le esposizioni nette verso asset diversi dal base asset.

Il base asset determina l’unità di successo del prodotto. Un vault BTC mira ad aumentare BTC; un vault ETH mira ad aumentare ETH; un vault USDC mira ad aumentare USDC. Il frontend può mostrare il valore equivalente in USD, ma la contabilità primaria resta nel base asset.

## 2. Profili utente

| Profilo | Obiettivo | Caratteristiche indicative |
| --- | --- | --- |
| Conservativo | Preservazione e liquidità elevate. | Lending semplice, borrowing assente o minimo, protocolli maturi, riserva elevata, limiti più severi. |
| Bilanciato | Maggiore rendimento con rischio controllato. | Strategie concatenate selezionate, Pendle e restaking limitati, concentrazione moderata. |
| Avanzato | Rendimento superiore accettando maggiore complessità. | Strategie più articolate, perpetual/hedging autorizzati, liquidità e buffer inferiori ma sempre entro hard limit. |

## 3. Famiglie di base asset

| Famiglia | Base asset iniziali | Misura primaria |
| --- | --- | --- |
| Stablecoin | USDC; in futuro USDT e altri asset approvati. | Unità del base asset, con attenzione a depeg e rischio emittente. |
| ETH | WETH nel core; helper opzionale per ETH nativo. | Unità di ETH/WETH. |
| BTC | WBTC o altro wrapper approvato. | Unità di BTC rappresentato, includendo rischio del wrapper. |

## 4. Tassonomia dei livelli

| Livello | Tipo | Esempi | Regola |
| --- | --- | --- | --- |
| 1 — Base | Interazione o strategia specifica | Lending, staking, fixed-yield, hedge, protocol-specific vault. | Interagisce con protocolli esterni; non investe in vault pari o superiori. |
| 2 — Strategia composta | Combina più gambe o vault base | Delta-neutral ETH, stable strategy, BTC yield strategy. | Può investire soltanto nel livello inferiore. |
| 3 — General per asset e rischio | Aggrega strategie | USDC Conservativo, ETH Bilanciato, BTC Avanzato. | Diversifica tra vault inferiori autorizzati. |
| 4 — Top level | Prodotto generalista | Possibile USDC General. | Investe nei livelli inferiori senza cicli. |

## 5. Grafo aciclico

> **Nota:** La piramide deve essere implementata come DAG: un vault può investire soltanto in livelli inferiori e non può possedere direttamente o indirettamente le proprie share.

- Verifica delle dipendenze dirette e indirette al momento dell’autorizzazione.
- Profondità massima configurata.
- Divieto di investire nello stesso livello o in un livello superiore.
- TVL lordo separato dal capitale esterno netto per evitare doppio conteggio.
- Esposizioni calcolate look-through fino ai protocolli sottostanti.

## 6. Share e libertà dell’utente

Ogni combinazione chain–base asset–profilo avrà presumibilmente una share token distinta, ERC-4626 e con 18 decimali. Le share saranno trasferibili. Jethos non può impedire a un utente di utilizzarle esternamente, ma può decidere quali integrazioni sostenere ufficialmente.

## 7. Uso futuro come collaterale: cinque rischi obbligatori

| Rischio | Descrizione |
| --- | --- |
| Contagio vault–lending market | Calo o illiquidità della share può generare liquidazioni, richieste di rimborso e bad debt che ritornano sul vault. |
| Manipolazione del prezzo per share | Donazioni, oracle fragili, NAV obsoleto o reward illiquide possono gonfiare il valore usato per prendere in prestito. |
| Prelievi asincroni | Il liquidatore può ricevere una share non riscattabile immediatamente e rifiutarsi di liquidare senza forte sconto. |
| Mismatch di liquidità | Share trasferibile e NAV elevato non significano che gli asset sottostanti siano immediatamente liquidabili. |
| Cicli e leva ricorsiva | Vault e lending market possono creare TVL apparente, leva nascosta e dipendenze circolari. |

> **Nota:** Politica: share trasferibili fin dal principio; collateralizzazione ufficiale soltanto in una fase successiva, con LTV conservativi, cap, oracle robusti, mercati isolati e blocco delle ricorsioni.

## 8. Ecosistema ufficiale e futuro sandbox

| Fase | Modello |
| --- | --- |
| Iniziale | Soltanto vault ufficiali curati da Jethos. Team proponente, community approval futura. |
| Intermedia | Possibili integrazioni esterne degli share token, senza diventare automaticamente prodotti ufficiali. |
| Futura | Eventuale sandbox permissionless chiaramente separata, con rating e avvertenze. |

## 9. Primo prodotto

> **Nota:** PoC 1A: singolo vault USDC Conservativo su Arbitrum, supply-only, Aave V3/Morpho Blue/Euler V2, capitale privato iniziale di circa 100 USDC.

## 10. Naming provvisorio

| Elemento | Formato suggerito | Esempio |
| --- | --- | --- |
| Vault | Jethos + Asset + Profilo + Chain | Jethos USDC Conservative — Arbitrum |
| Share | j + Asset + Profilo breve + Chain breve | jUSDC-C-ARB |
| Strategia | Tipo + Protocollo/mercato + versione | Lending Optimizer Aave–Morpho–Euler v1 |
| Deployment | Versione esplicita | Vault v1; Vault v2 tramite migrazione. |
