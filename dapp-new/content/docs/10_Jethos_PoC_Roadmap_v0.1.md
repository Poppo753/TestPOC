# PoC & Implementation Roadmap

> Primo vault USDC Conservativo e fasi successive

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

## 1. Obiettivo del PoC

Dimostrare che il core multi-base-asset, i tre plugin esistenti, l’accounting ERC-4626, la riserva dinamica e lo Strategy Engine possono gestire un vault USDC in modo verificabile e recuperare integralmente il capitale in condizioni normali.

> **Nota:** PoC 1A: USDC Conservativo, Arbitrum, supply-only, Aave V3 + Morpho Blue + Euler V2, circa 100 USDC personali, test privato.

## 2. Parametri iniziali

| Parametro | Valore |
| --- | --- |
| Base asset | USDC |
| Profilo | Conservativo |
| Chain | Arbitrum |
| Cap iniziale | 100 USDC effettivi; cap di contratto poco superiore per test controllati. |
| Riserva min/target/max | 35% / 45% / 55% |
| Strategie | Supply-only nei mercati approvati. |
| Borrowing | Escluso dal PoC 1A. |
| Share | ERC-4626, 18 decimali. |
| Prelievi | Sincroni. |
| Oracle | Chainlink; staleness da verificare nei contratti. |
| APY obiettivo | Almeno 2–3% annuo netto sul NAV, se disponibile senza violare il profilo. |
| Fee di deposito | 0,10% nel PoC, salvo riconsiderazione per test contabili. |
| Altre fee | Zero nel PoC. |
| Upgrade | Immediato nel PoC privato. |
| Periodo iniziale | Almeno una settimana di prove intensive; stabilità più lunga prima di capitale pubblico. |

## 3. Conseguenza della riserva sull’APY

Con riserva target del 45%, soltanto il 55% del NAV viene investito. Per ottenere il 2–3% netto sul NAV, la parte investita deve produrre un rendimento superiore, prima di gas e fee. Il PoC deve mostrare separatamente APY delle strategie, APY lordo del vault e APY netto sul NAV.

## 4. Fasi

| Fase | Contenuto | Criterio di uscita |
| --- | --- | --- |
| 1A — Lending Optimizer | Supply-only, tre protocolli, riserva, ERC-4626, harvest semplice. | Accounting e prelievi invarianti; zero perdita non spiegata. |
| 1B — Borrowing Strategy | Una strategia, un asset borrowed, HF e unwind completi. | Monitoraggio e deleverage testati in scenari estremi. |
| 1C — ETH/BTC/LST | Swap, LST, esposizioni coperte, strategie concatenate. | Delta e rischio misurabili; unwind e pricing robusti. |
| 2 — Multi-vault | Famiglie e profili aggiuntivi su Arbitrum. | Cap e risk score formalizzati. |
| 3 — Multi-chain indipendente | Replica su altre EVM senza bridge. | Config e test per chain. |
| 4 — Composability | Vault superiori e, successivamente, cross-chain share. | DAG, queue e bridge risk auditati. |

## 5. Test minimi PoC 1A

| Area | Test |
| --- | --- |
| ERC-4626 | deposit/mint/withdraw/redeem, preview, arrotondamenti, zero share. |
| Donazioni | Prima e dopo depositi, vault quasi vuoto, attacco di inflation. |
| Decimali | USDC 6 → share 18, importi minimi e massimi. |
| Accounting | totalAssets = riserva + posizioni − debiti; nel 1A debiti zero. |
| Plugin | Supply/withdraw Aave, Morpho, Euler e fallimenti. |
| Ribilanciamento | Spostamento, batch/progressivo, APY post-allocazione. |
| Riserva | Sotto minimo, dentro banda, sopra massimo. |
| Pause | Depositi, plugin, withdraw-only, keeper rotation. |
| Upgrade | Persistenza di stato e rollback procedure. |
| Oracle | Stale/invalid → operazioni falliscono. |

## 6. Criteri di accettazione

1. Tutti i depositi ricevono share coerenti e nessuna operazione produce zero share.
1. Il prezzo per share non diminuisce senza una causa economica tracciabile.
1. Ogni prelievo sincrono restituisce l’importo previsto o fallisce atomicamente.
1. Non esistono trasferimenti amministrativi arbitrari del capitale.
1. Il vault può recuperare tutto il capitale dai tre protocolli nei test normali.
1. Donazioni non consentono estrazione di valore superiore a quanto apportato.
1. Il backend non può superare hard limit on-chain.
1. Due keeper non possono eseguire due volte la stessa operazione.
1. La riconciliazione tra backend e chain non presenta differenze non spiegate.
1. Le pause mantengono disponibili repay e uscita quando tecnicamente possibile.

## 7. Condizioni di stop

- Errore o incertezza nel NAV.
- Differenza contabile non spiegata.
- Oracle stale o anomalo.
- Plugin incapace di ritirare l’importo atteso.
- Perdita non spiegata anche minima.
- Operation replay o permessi eccessivi.
- Upgrade che altera lo stato in modo inatteso.

## 8. Roadmap tecnica derivata dai file iniziali

La roadmap originaria prevedeva Base Asset Abstraction, validazione dei tre pool su Arbitrum, config multi-chain, nuovi plugin e piramide. Poiché la Base Asset Abstraction è dichiarata implementata, il prossimo lavoro si concentra su verifica del codice, ERC-4626, PoC 1A e consolidamento dei plugin.

1. Verificare il repository contro la documentazione multi-base-asset.
1. Integrare o allineare ERC-4626.
1. Implementare protezioni donation/inflation.
1. Definire e testare il vault USDC Conservativo 1A.
1. Consolidare monitoraggio e keeper ridondanti.
1. Passare a borrowing 1B soltanto dopo gli acceptance criteria.
1. Produrre specifiche separate per ogni nuovo protocollo e strategia.
