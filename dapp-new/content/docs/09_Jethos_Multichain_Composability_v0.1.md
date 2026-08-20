# Multi-chain & Vault Composability

> Deployment separati, share cross-chain e piramide

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

## 1. Strategia iniziale

> **Nota:** I vault sono inizialmente deployment indipendenti per chain. Non comunicano, non spostano capitale tramite bridge e non condividono contabilmente la liquidità.

| Deployment | Stato |
| --- | --- |
| Jethos USDC Arbitrum | Indipendente |
| Jethos USDC Base | Indipendente futuro |
| Jethos USDC BNB Chain | Indipendente futuro |

## 2. Config layer multi-chain

- Indirizzi dei token e decimali.
- Feed oracle e staleness.
- Indirizzi e versioni dei protocolli.
- Mercati approvati.
- Parametri gas e router.
- Cap e rischio specifici della chain.
- Script di deployment parametrizzati.

## 3. Espansione dei protocolli

La roadmap tecnica iniziale identifica Arbitrum come ambiente da perfezionare e prevede Base e BNB come deployment successivi. La disponibilità effettiva e gli indirizzi dei protocolli devono essere verificati prima di ogni integrazione; la seguente è una mappa di progetto derivata dai documenti iniziali, non una attestazione corrente.

| Protocollo | Arbitrum | Base | BNB |
| --- | --- | --- | --- |
| Aave V3 | Previsto | Previsto | Previsto |
| Euler V2 | Previsto | Previsto | Non previsto inizialmente |
| Morpho Blue | Previsto | Previsto | Non previsto inizialmente |
| Compound V3 | Previsto | Previsto | Non previsto inizialmente |
| Dolomite / GMX / Pendle / Silo | Focus Arbitrum | Da valutare | Da valutare |
| Moonwell | No focus | Focus Base | No focus |
| Venus | No focus | No focus | Focus BNB |

## 4. Futura esposizione cross-chain tramite share

Quando un vault Arbitrum acquisterà esposizione a un vault Base, l’operazione resterà cross-chain anche se l’oggetto economico è una share. Sarà necessario spostare capitale, trasferire messaggi o rappresentare la share su un’altra chain.

| Rischio | Conseguenza |
| --- | --- |
| Share wrapped non coperta | La rappresentazione remota può non corrispondere alle share reali bloccate. |
| NAV asincrono | Il vault locale può emettere o riscattare share usando un prezzo remoto obsoleto. |
| Bridge/messaging | Bug, ritardi, replay o compromissione. |
| Withdrawal su due livelli | Queue remota + bridge + queue locale aumentano il tempo. |
| Chain failure | Congestione o arresto può rendere indisponibile una parte del NAV. |

## 5. Regole future cross-chain

- Bridge e messaging in allowlist.
- Cap specifico per chain e route.
- Accounting separato per esposizioni remote.
- Oracle/NAV con timestamp e haircut.
- Pause della componente cross-chain senza congelare il resto.
- Nessuna collateralizzazione ricorsiva tra rappresentazioni remote.
- Procedura di recovery per messaggi falliti.

## 6. Piramide e VaultPlugin

Un vault superiore tratta un vault inferiore come un protocollo esterno: deposita il base asset o l’asset richiesto, riceve share, calcola il valore tramite price per share e le riscatta. Questo richiede un VaultPlugin e un registry delle dipendenze.

| Operazione | Funzione |
| --- | --- |
| deposit | Acquista share del vault inferiore entro cap e slippage. |
| withdraw/redeem | Riscatta share; gestisce eventuale asincronia. |
| valuation | Share × valore per share, con look-through per il rischio. |
| dependency check | Verifica DAG e assenza di cicli. |

## 7. Sequenza raccomandata

1. PoC locale su Arbitrum.
1. Tre protocolli e accounting ERC-4626 consolidati.
1. Deployment indipendenti su altre chain EVM.
1. Vault composability sulla stessa chain.
1. Solamente dopo: share cross-chain e relative queue.
