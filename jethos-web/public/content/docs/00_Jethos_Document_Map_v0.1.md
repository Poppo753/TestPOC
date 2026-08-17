# Mappa della documentazione

> Struttura, ordine di lettura e stato dei documenti

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

## Scopo del pacchetto

Questo pacchetto trasforma i tre documenti tecnici iniziali e le decisioni emerse nel confronto in una documentazione coordinata. I documenti non sostituiscono specifiche di codice, audit o analisi legale: costituiscono la base condivisa dalla quale produrre tali artefatti.

> **Nota:** Il Master Vision Document è già utilizzabile come base narrativa. Le specifiche numeriche sono intenzionalmente marcate come definitive, provvisorie o future.

## Ordine di lettura consigliato

| N. | Documento | Funzione |
| --- | --- | --- |
| 01 | Master Vision | Perché esiste Jethos, cosa offre, principi e obiettivo finale. |
| 02 | Product & Vault Taxonomy | Famiglie di vault, profili di rischio, livelli della piramide e user experience. |
| 03 | Protocol Architecture | Core ERC-20, base asset, plugin, backend, hard limit e trust model. |
| 04 | Accounting, Shares & ERC-4626 | NAV, share, donazioni, reward, arrotondamenti e standard. |
| 05 | Risk Framework | Punteggi quantitativi, limiti, health factor, concentrazione e contagio. |
| 06 | Strategy & Automation | Strategy Engine, monitoraggio, keeper, ribilanciamenti e APY simulato. |
| 07 | Liquidity & Withdrawals | Riserve, prelievi sincroni e futuro ERC-7540/7887. |
| 08 | Governance & Security | Community approved, multisig, upgrade, pause ed emergenze. |
| 09 | Multi-chain & Composability | Deployment separati, futura esposizione cross-chain e DAG dei vault. |
| 10 | PoC & Roadmap | Primo vault USDC Conservativo e sequenza 1A/1B/1C. |
| 11 | Open Questions & Decision Backlog | Domande future organizzate per priorità e milestone. |

## Legenda degli stati

| Stato | Significato |
| --- | --- |
| DECISO | Principio o scelta accettata esplicitamente. |
| PROVVISORIO | Valore proposto per poter progettare e testare; può essere modificato. |
| FUTURO | Elemento deliberatamente rinviato a una fase successiva. |
| APERTO | Decisione ancora necessaria prima della milestone indicata. |
| DA VERIFICARE NEL CODICE | Parametro già presente nei contratti ma non estratto nei documenti disponibili. |

## Versioning consigliato

- v0.1: visione consolidata e primo PoC definito a livello funzionale.
- v0.2: verifica contro il repository, indirizzi, interfacce e parametri reali.
- v0.3: threat model, test plan e specifica del PoC 1A.
- v0.4: revisione successiva a test fork e testnet/private deployment.
- v1.0: versione pubblica accompagnata da audit e documentazione di rischio.
