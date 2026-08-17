# Master Vision Document

> Visione generale, identità e principi fondamentali

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

Stato corrente dichiarato: la Base Asset Abstraction è stata implementata; il core è multi-base-asset e predisposto per deployment EVM multi-chain. Il deployment iniziale non è ancora utilizzato con capitale pubblico reale.

## Executive summary

Jethos Protocol è un’infrastruttura DeFi e una futura esperienza finanziaria consumer progettata per rendere la proprietà diretta, l’investimento e l’utilizzo degli asset digitali semplici quanto un home banking, senza nascondere dove si trovano i fondi o concedere a un operatore libertà arbitraria sul capitale.

> **Nota:** Il vault mira a preservare e accrescere il capitale espresso nel proprio base asset, mantenendo entro limiti prestabiliti le esposizioni nette verso asset diversi dal base asset.

> **Nota:** Jethos può utilizzare esclusivamente i fondi che l’utente ha depositato esplicitamente in un vault e soltanto verso contratti, plugin, protocolli, mercati, token e vault previamente autorizzati. Nessuna chiave operativa può trasferire arbitrariamente il capitale verso destinatari liberi.

## 1. Missione

Rendere facile l’accesso alla blockchain e alla finanza decentralizzata, permettendo alle persone di detenere realmente i propri asset e di investirli in modo chiaro, intuitivo e familiare. Jethos deve semplificare sia l’esperienza dei nuovi utenti sia quella delle persone che già utilizzano la DeFi ma oggi gestiscono manualmente protocolli, chain, liquidazioni, reward e ribilanciamenti.

## 2. Problema

- La DeFi è frammentata tra protocolli, mercati, chain, wallet, bridge e interfacce differenti.
- Il rendimento mostrato da un mercato non coincide necessariamente con il rendimento netto dopo gas, slippage, fee, rischio e impatto del capitale.
- Le strategie con debito richiedono monitoraggio continuo di health factor, liquidità e oracle.
- L’utente deve comprendere dettagli tecnici per svolgere attività finanziarie che dovrebbero essere semplici.
- Nei servizi tradizionali l’utente spesso non ha visibilità completa sull’utilizzo dei propri fondi.

## 3. Soluzione

Jethos offre vault con regole pubbliche che allocano il capitale tra protocolli e strategie autorizzati. L’utente sceglie asset e profilo di rischio, deposita nel vault e riceve share trasferibili. Il backend analizza opportunità e rischi; gli smart contract applicano limiti non aggirabili e impediscono trasferimenti arbitrari.

> **Nota:** L’automazione sceglie l’allocazione con il miglior rendimento netto corretto per rischio tra strategie, mercati e protocolli già autorizzati.

## 4. Le due anime di Jethos

| Componente | Funzione | Orizzonte |
| --- | --- | --- |
| Jethos Protocol | Core on-chain, vault, plugin, accounting, risk limits, share e composabilità. | Priorità attuale |
| Jethos App | Wallet self-custody, investimento semplice, trasparenza, invio di asset e dashboard. | Progressivo |
| Servizi finanziari integrati | Carta, pagamenti, partner regolamentati, asset tokenizzati e credito. | Visione futura |

## 5. Portafoglio e fondi investiti

L’applicazione distingue chiaramente due stati: “in portafoglio” e “nei vault”. Gli asset in portafoglio restano sotto il controllo del wallet self-custody e non vengono investiti automaticamente. Gli asset nei vault sono stati depositati volontariamente e seguono regole pubbliche di investimento e prelievo.

- L’utente può revocare autorizzazioni future del wallet.
- L’utente può smettere di depositare, trasferire le share o richiedere il prelievo.
- L’utente non può modificare il ribilanciamento comune del vault soltanto per la propria quota.
- Lo stato di prelevabilità deve essere mostrato come immediato, in disinvestimento o pendente.

## 6. Proposta di valore

| Pilastro | Descrizione |
| --- | --- |
| Semplicità | Esperienza familiare, spiegazioni brevi, interazione in pochi passaggi. |
| Rendimento | Ricerca del miglior rendimento netto corretto per rischio, non del maggiore APY nominale. |
| Diversificazione | Protocolli, mercati, asset, strategie e in futuro chain differenti. |
| Gestione del rischio | Tre profili semplici sostenuti da parametri quantitativi e automazioni. |
| Accesso unificato | Un’unica app e share standard per accedere a più opportunità. |
| Trasparenza | Posizioni, protocolli, rischi, fee, decisioni e transazioni verificabili. |

## 7. Significato di “banca decentralizzata”

Nel lungo periodo Jethos vuole offrire un portafoglio digitale nel quale l’utente possa detenere, investire, inviare e spendere i propri asset, mantenendo la proprietà economica e una visibilità comprensibile sull’utilizzo dei fondi. Il core DeFi viene prima; carta e pagamenti richiederanno partnership, compliance e soggetti specializzati e sono quindi parte della visione, non del PoC.

## 8. Principi non negoziabili

1. Protezione del capitale nel base asset prima della massimizzazione del rendimento.
1. Nessun protocollo o strategia viene adottato soltanto perché mostra un APY elevato.
1. Esposizioni verso asset diversi dal base asset devono essere neutralizzate, limitate e dichiarate.
1. Il backend non può impartire calldata arbitraria verso destinatari arbitrari.
1. Accesso e integrazione dei vault sono aperti; strategie, plugin e protocolli ufficiali sono curati.
1. I cambiamenti strutturali maturi devono avvenire tramite nuova versione e migrazione esplicita.
1. La complessità interna non deve essere scaricata sull’utente, ma non deve essere nascosta.

## 9. Utenti e modello di ecosistema

Il target principale è l’utente finale. I vault devono tuttavia essere componibili da smart contract, DAO, treasury, aggregatori e altre applicazioni. Il modello iniziale è un ecosistema interamente curato da Jethos: il team propone e sviluppa, la comunità potrà approvare. Un futuro sandbox permissionless è possibile ma distinto chiaramente dai prodotti ufficiali.

## 10. Posizionamento

Jethos non si differenzia attraverso un singolo protocollo sottostante, ma attraverso l’unificazione dell’esperienza: wallet, vault, automazione, rischio spiegato, share standard, accesso multi-protocollo e progressiva composabilità. I riferimenti concettuali citati includono yield aggregator, carte crypto, protocolli come Yearn e servizi di asset tokenizzati come Ondo, senza che ciò implichi identità di modello o integrazione già disponibile.

## 11. Visione a cinque anni

- Core multi-base-asset e multi-chain EVM pienamente operativo.
- Famiglie BTC, ETH e stablecoin con profili Conservativo, Bilanciato e Avanzato.
- Integrazione progressiva di Aave, Morpho, Euler, Compound, Dolomite, Silo, Pendle, GMX, Venus, Moonwell, Ethena, Sky e altri protocolli approvati.
- Piramide di vault componibili e general vault che investono nei livelli inferiori.
- Possibile integrazione di servizi finanziari regolamentati e asset del mondo reale tramite partner.

## 12. Limiti delle promesse

> **Nota:** Jethos mira a ridurre il rischio di perdita e liquidazione, ma non può garantire assenza assoluta di perdite, disponibilità immediata in ogni scenario o il miglior APY esistente in ogni momento.

- Gli smart contract possono contenere vulnerabilità.
- Protocolli, oracle, asset wrapped e chain possono fallire.
- La liquidità può diminuire e i prelievi possono richiedere tempo.
- Le strategie delta-neutral possono perdere neutralità a causa di slippage, funding, depeg o eventi estremi.
- La trasparenza e gli hard limit riducono la fiducia richiesta ma non eliminano ogni rischio.
