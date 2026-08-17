# Governance, Security & Administration

> Community approval, multisig, upgrade ed emergenze

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

## 1. Modello iniziale

> **Nota:** Jethos è inizialmente un ecosistema curato. Il team ricerca, sviluppa, simula e propone strategie; la comunità potrà approvarle. Il protocollo non è inizialmente community-driven né permissionless nella creazione di plugin e strategie.

## 2. Permissionlessness per livello

| Livello | Iniziale |
| --- | --- |
| Accesso ai vault | Aperto, salvo eventuali vincoli legali o di deployment futuri. |
| Integrazione delle share | Aperta: share ERC-20/4626 componibili. |
| Esecuzione di ribilanciamenti | Soltanto keeper e team autorizzati. |
| Creazione di vault | Curata dal team. |
| Aggiunta di plugin/protocolli | Curata e approvata; mai arbitraria. |
| Governance | Community approval progressiva, regole ancora da formalizzare. |

## 3. Voto e share trasferibili

Il potere di voto non deve dipendere dal saldo istantaneo, perché le share possono essere trasferite, prestate o usate come collaterale. La direzione preferita è una media temporale della partecipazione, con snapshot e possibile delega.

- No flash-loan voting.
- No doppio voto dopo trasferimento.
- No doppio conteggio delle share custodite da protocolli.
- Possibile maturazione del voting power nel tempo.
- Regole fondamentali del profilo non modificabili tramite semplice maggioranza operativa.

## 4. Upgrade

| Fase | Regola |
| --- | --- |
| PoC | Upgrade immediato per iterazione privata. |
| Successiva | Timelock da definire; comunicazione e test obbligatori. |
| Cambiamenti strutturali | Preferenza forte per nuovo vault e migrazione esplicita. |
| Limiti di rischio | Tecnicamente modificabili nel PoC; nel prodotto maturo modificabili soltanto entro intervalli o tramite migrazione. |

## 5. Struttura delle chiavi

| Ruolo | Proposta iniziale |
| --- | --- |
| Multisig admin | 2-of-3 con dispositivi separati; nel PoC controllato dal fondatore/team. |
| Keeper 1 | Chiave limitata su provider A. |
| Keeper 2 | Chiave limitata su provider B. |
| Guardian | Chiave/ruolo di emergenza; scope da definire. |
| Recovery | Chiave offline e procedure documentate. |

> **Nota:** Un multisig controllato da una sola persona migliora la resilienza delle chiavi ma non crea governance multiparte. Questa limitazione deve essere dichiarata.

## 6. Pause granulari

| Modalità | Effetto |
| --- | --- |
| Pause deposits | Blocca nuovi depositi; prelievi possibilmente attivi. |
| Withdraw-only | Nessun nuovo investimento o debito; consentite operazioni di uscita. |
| Pause borrowing | Nessun aumento del debito; repay consentito. |
| Pause swaps | Blocca swap ordinari; eccezioni di emergency unwind da autorizzare. |
| Disable plugin/market | Nessuna nuova allocazione; withdraw/repay/close restano disponibili. |
| Oracle quarantine | Blocca operazioni dipendenti dal prezzo anomalo. |
| Keeper rotation | Revoca immediata di una chiave compromessa. |

## 7. Emergency actions

- Revoke allowance verso router o protocollo.
- Emergency deleverage e repay.
- Emergency unwind entro loss budget.
- Ritiro di liquidità dai protocolli.
- Claim necessario alla chiusura.
- Rescue di token estranei senza poter sottrarre base asset o asset contabilizzati.
- Futura uscita in natura.

## 8. Testing e assurance

| Livello | Requisiti |
| --- | --- |
| PoC privato | Unit, fork, integration, fuzz di accounting, test di pause e upgrade. |
| Alpha limitata | Invariant test, simulazioni keeper, cap ridotti, monitoraggio 24/7. |
| Pubblico | Audit indipendente, bug bounty, documentazione delle assunzioni e incident response. |

## 9. Invarianti di sicurezza

1. Nessuna share senza asset economico corrispondente secondo la formula.
1. Nessun asset contabilizzato trasferibile a destinatari arbitrari dall’admin.
1. Il debito è sempre sottratto dal NAV.
1. Il vault non può investire in sé stesso direttamente o indirettamente.
1. Le pause devono preservare almeno repay e uscita quando tecnicamente possibile.
1. Una operazione non può essere eseguita due volte.
1. Un upgrade strutturale maturo non deve cambiare silenziosamente il prodotto acquistato dall’utente.
