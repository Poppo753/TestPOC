# Strategy & Automation Framework

> Strategy Engine, keeper, monitoraggio e ribilanciamenti

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

## 1. Principio di allocazione

> **Nota:** L’automazione sceglie l’allocazione con il miglior rendimento netto corretto per rischio tra strategie, mercati e protocolli già autorizzati.

## 2. Funzione di convenienza

La decisione non usa una soglia fissa di APY. Il beneficio deve considerare capitale, durata, costi e rischio:

> **Nota:** Beneficio netto atteso = Capitale × miglioramento del rendimento × durata attesa − gas − slippage − fee di entrata/uscita − costi cross-chain − penalizzazione di rischio.

- Stabilità e oscillazione storica del rendimento.
- Probabilità che gli incentivi diminuiscano.
- Capacità del mercato di ricevere il capitale.
- Impatto del deposito sul nuovo APY.
- Costo e tempo di una futura uscita.

## 3. Strategy Engine

| Input | Elaborazione | Output |
| --- | --- | --- |
| Mercati e protocolli autorizzati | Filtro di eligibility e profilo di rischio | Set di strategie possibili |
| Stato del mercato | Simulazione post-allocazione | APY netto e utilization futuri |
| Posizioni del vault | Rischio, liquidità, cap e correlazione | Allocazione target |
| Costi | Gas, swap, fee, slippage e unwind | Beneficio netto |
| Segnali di emergenza | Confronto tra perdita immediata e perdita attesa | Deleverage/unwind/pause |

## 4. Simulazione APY post-allocazione

1. Leggere lo stato corrente del mercato.
1. Applicare il capitale che Jethos vorrebbe aggiungere o rimuovere.
1. Calcolare nuova utilization e curva dei tassi.
1. Calcolare reward marginali e diluizione.
1. Stimare il rendimento netto del vault, non soltanto della posizione.
1. Stimare il percorso e costo di uscita.

## 5. Operazioni richiedibili dal backend

- Deposit/withdraw da protocolli autorizzati.
- Borrow/repay entro limiti.
- Swap tra token autorizzati e base asset.
- Claim e harvest di reward.
- Apertura e chiusura di strategie censite.
- Spostamento di capitale tra strategie.
- Aumento della riserva o deleverage.
- Sospensione di una strategia e avvio dell’unwind.

> **Nota:** Il backend non può inviare calldata arbitraria verso indirizzi arbitrari. Ogni operazione deve appartenere a un tipo riconosciuto e superare i controlli on-chain.

## 6. Monitoraggio

La frequenza è una funzione di TVL, leva, health factor, volatilità, liquidità, costo, profilo e complessità. Un vault piccolo ma vicino alla liquidazione può richiedere più frequenza di un vault grande supply-only.

| Meccanismo | Uso |
| --- | --- |
| Polling periodico | Controlli completi anche in assenza di eventi. |
| Event-driven | Reazione a depositi, prelievi, borrow, repay, oracle update e incidenti. |
| Allarmi | HF, depeg, liquidity drop, cap, transazioni fallite, keeper offline. |
| Reconciliation | Confronto tra accounting on-chain e stato ricostruito dal backend. |

## 7. Keeper e ridondanza

| Elemento | Decisione iniziale |
| --- | --- |
| Istanze automatiche | Almeno due, indipendenti. |
| Provider | Cloud differenti. |
| Chiavi | Separate e limitate per ruolo/operazione. |
| Fallback | Multisig manuale del team. |
| Guardian | Ruolo di emergenza separato da definire. |
| Doppia esecuzione | Nonce, operation ID o controllo dello stato. |

## 8. Batch vs operazioni progressive

| Modalità | Quando usarla |
| --- | --- |
| Batch atomico | Capitale limitato, operazioni sincrone, bisogno di evitare stati intermedi. |
| Progressivo | Capitale elevato, slippage, liquidity impact, strategie asincrone o rischio di fallimento parziale. |

Il backend decide dinamicamente la modalità sulla base dei costi e della sicurezza.

## 9. Harvest

> **Nota:** Harvest quando: valore netto delle reward > gas + slippage + soglia minima di convenienza. Le reward vengono convertite nel base asset e reinvestite.

## 10. Decision log

- Timestamp, chain, vault e versione della strategia.
- Stato iniziale e metriche considerate.
- Alternative valutate.
- Allocazione scelta e beneficio atteso.
- Risk score e limiti verificati.
- Operation ID e transazioni on-chain.
- Risultato reale e scostamento dalla previsione.
