# Protocol Architecture

> Core, plugin, automazione e confini di fiducia

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

I documenti iniziali descrivono la Base Asset Abstraction come Fase 0. La decisione più recente dichiara che tale implementazione è stata completata: il presente documento la tratta come stato corrente da verificare contro il repository.

## 1. Principio architetturale

> **Nota:** Il core tratta esclusivamente ERC-20 come base asset. Per il prodotto ETH il base asset è WETH; un helper separato può offrire UX ETH nativo senza biforcare il core.

## 2. Componenti principali

| Componente | Responsabilità |
| --- | --- |
| Beacon / Config registry | Risoluzione di BASE_ASSET, manager, plugin e indirizzi configurati. |
| LiquidityManager | Depositi, prelievi, fee, riserva e orchestrazione della liquidità. |
| ProxyGeneral / Custody execution layer | Detenzione operativa e chiamate consentite verso plugin e protocolli. |
| TokenManager | Registro di token diversi dal base asset e relativi metadati. |
| ValueCalculator | NAV, valore delle posizioni e conversione nel base asset. |
| SwapManager | Swap autorizzati, limiti di slippage e routing verso il base asset. |
| ProtocolManager | Coordinamento delle posizioni tra plugin. |
| EmergencyHandler | Pause, unwind, recovery e modalità di emergenza. |
| Plugin + Registry + LensAdapter | Integrazione specifica di protocollo, configurazione e letture. |
| DepositHelper | Wrapping/unwrapping ETH↔WETH per il solo prodotto ETH. |

## 3. Stato multi-base-asset

- BASE_ASSET configurabile per deployment.
- Depositi e prelievi del core tramite SafeERC20.
- Valutazione denominata nel base asset, con prezzi oracle per le esposizioni esterne.
- Plugin risolvono dinamicamente il base asset.
- Deployment separati possono usare WETH, USDC, WBTC o altri ERC-20 approvati.
- Configurazioni chain-specific separano token, oracle, protocolli e parametri gas.

## 4. Plugin model

Ogni protocollo è integrato tramite un insieme coerente di moduli. Il pattern iniziale è denominato “3 Musketeers”: Registry, Plugin e LensAdapter. Il plugin esegue operazioni consentite; il registry conserva mercati e configurazioni; il lens espone letture e dati normalizzati.

| Regola | Requisito |
| --- | --- |
| Autorizzazione | Nessun plugin non censito può ricevere fondi o approvazioni. |
| Mercati | Ogni mercato, vault o pool deve essere approvato separatamente. |
| Token | Solo token autorizzati e base asset configurato. |
| Allowance | Importi limitati o forceApprove controllato; revoca di emergenza. |
| Destinatari | Nessun destinatario arbitrario selezionabile dal backend. |
| Chiusura | Ogni plugin deve supportare unwind e recupero del base asset secondo modalità dichiarate. |

## 5. Backend e smart contract

> **Nota:** Jethos può utilizzare esclusivamente i fondi che l’utente ha depositato esplicitamente in un vault e soltanto verso contratti, plugin, protocolli, mercati, token e vault previamente autorizzati. Nessuna chiave operativa può trasferire arbitrariamente il capitale verso destinatari liberi.

Il backend calcola rischio, rendimento, liquidità, utilization e convenienza. Lo smart contract non deve replicare l’intero modello quantitativo, ma deve applicare hard limit verificabili e non aggirabili.

| Backend propone | Contratto verifica |
| --- | --- |
| Deposita o ritira da un protocollo | Plugin, protocollo, mercato e importo autorizzati. |
| Borrow/repay | Debt ratio, LTV, health factor post-operazione e cap. |
| Swap | Token, router, oracle, slippage e destinatario. |
| Ribilanciamento | Riserva minima, esposizioni, scadenza del segnale e operation ID. |
| Emergency unwind | Modalità attiva, loss budget e operazioni permesse. |

## 6. Hard limit minimi

- Plugin, protocollo, mercato e token autorizzati.
- Importo massimo per operazione e per periodo.
- Cap per vault, strategia, protocollo e mercato.
- Slippage e deviazione massima dall’oracle.
- Health factor, LTV, leva e debt ratio.
- Riserva liquida minima.
- Scadenza del segnale e nonce/operation ID.
- Divieto di trasferimento verso destinatari arbitrari.
- Protezione dalla doppia esecuzione.
- Pause granulari e modalità withdraw-only.

## 7. Flusso di deposito

1. L’utente approva il base asset al vault o a un router autorizzato.
1. Il vault calcola le share ERC-4626 e verifica minimo, cap e condizioni di sicurezza.
1. Il base asset entra nel vault e alimenta inizialmente la riserva.
1. Il backend può successivamente proporre un’allocazione.
1. Il contratto applica i limiti e il plugin esegue l’operazione.

## 8. Flusso di prelievo sincrono

1. L’utente richiede asset o riscatta share.
1. Il vault usa prima la riserva liquida.
1. Se necessario, recupera capitale dal lending immediatamente liquido.
1. Nel PoC l’operazione deve concludersi nella transazione o fallire senza effetti parziali.
1. In futuro ERC-7540 consentirà richieste pendenti e soddisfacimento per epoche.

## 9. Upgrade e migrazione

| Fase | Politica |
| --- | --- |
| PoC privato | Upgrade immediati consentiti per iterare rapidamente. |
| Pre-produzione | Introduzione di timelock, test di upgrade e procedure multisig. |
| Prodotto maturo | Cambiamenti strutturali e modifica del profilo di rischio tramite nuovo vault e migrazione volontaria quasi sempre preferita. |

## 10. Osservabilità

- Eventi per deposito, prelievo, allocazione, borrow, repay, swap, harvest e pause.
- Decision log del Strategy Engine con input, output, motivazione e transazioni correlate.
- Riconciliazione periodica tra saldo, posizioni, debiti e totalAssets.
- Allarmi su oracle, health factor, liquidità, cap e transazioni fallite.
