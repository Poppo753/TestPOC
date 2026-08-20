# Liquidity & Withdrawal Framework

> Riserve dinamiche, prelievi sincroni e queue future

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

## 1. Riserva liquida

> **Nota:** La riserva è composta esclusivamente da base asset non investito. Posizioni Aave, Morpho o Euler, anche se rapidamente riscattabili, restano investimenti e non vengono conteggiate nella riserva primaria.

## 2. Intervallo dinamico

La riserva non viene mantenuta a una percentuale esatta. Tre soglie evitano ribilanciamenti inefficienti:

| Soglia PoC | Valore | Azione |
| --- | --- | --- |
| Minimo | 35% | Recuperare liquidità o bloccare nuove allocazioni. |
| Target | 45% | Livello operativo desiderato. |
| Massimo | 55% | Investire l’eccesso se il beneficio netto giustifica il costo. |

I valori del PoC sono volutamente conservativi e riducono il rendimento sul NAV. In produzione le soglie dipenderanno da profilo, storico di flussi, liquidità delle strategie e costo di unwind.

## 3. Waterfall del prelievo

1. Base asset nella riserva.
1. Lending supply immediatamente riscattabile.
1. Altre strategie liquide.
1. Strategie con più passaggi o scadenze.
1. Future posizioni asincrone tramite queue.

## 4. PoC sincrono

- ERC-4626 standard.
- Il prelievo viene completato nella stessa transazione oppure fallisce.
- Nessuna withdrawal queue nel PoC 1A.
- Nessuna promessa di tempo differito.
- Test su riserva sufficiente e recupero dai tre protocolli.

## 5. Queue futura per epoche

> **Nota:** Le richieste vengono raccolte per epoca; il vault recupera liquidità; tutti gli utenti dell’epoca vengono soddisfatti pro-rata; il residuo passa all’epoca successiva.

| Esempio | Richiesta | Disponibile al 50% | Residuo |
| --- | --- | --- | --- |
| Alice | 100 | 50 | 50 |
| Bob | 200 | 100 | 100 |
| Carlo | 700 | 350 | 350 |

La proporzionalità della coda è distinta dalla proporzionalità economica delle share: ogni utente conserva sempre il diritto al valore netto corrispondente alle proprie share, salvo perdite del vault.

## 6. ERC-7540 e 7887

- ERC-7540 come base per requestRedeem, pending e claimable.
- Request ID utilizzabile come identificativo dell’epoca.
- Possibilità di claim parziale e residuo pendente.
- ERC-7887 o logica equivalente da valutare per cancellare richieste ancora reversibili.

## 7. Costo dei prelievi

| Fase | Politica |
| --- | --- |
| PoC | Nessuna fee aggiuntiva sul prelievo; misurazione dei costi reali. |
| Futuro immediato | Costo reale delle operazioni necessario al disinvestimento. |
| Futuro prodotto | Possibile percentuale aggiuntiva destinata al protocollo, dichiarata chiaramente. |

## 8. Prelievo in natura di emergenza

Deve esistere come opzione architetturale futura: se la conversione in base asset è impossibile o distruttiva, l’utente può ricevere una quota proporzionale degli asset sottostanti. Questa modalità richiede adapter per token, debiti, posizioni non trasferibili e comunicazione molto chiara; non è parte del PoC.

## 9. Condizioni di blocco dei depositi

- Vault o depositi in pausa.
- Cap raggiunto.
- NAV o oracle non affidabile.
- Prezzo per share anomalo.
- Health factor sotto soglia.
- Emergency unwind o reconciliation fallita.
- Monitoraggio indisponibile oltre la soglia consentita.
- Deposito che produrrebbe zero share o concentrazione eccessiva.
- Nessun percorso autorizzato per allocare o custodire in sicurezza il capitale.

## 10. UX del prelievo

- Mostrare importo immediatamente disponibile.
- Mostrare la sorgente della liquidità e il costo stimato.
- Per le queue: stato pending/claimable, percentuale soddisfatta e tempo stimato non garantito.
- Non descrivere come istantaneo un prodotto che può richiedere disinvestimento.
