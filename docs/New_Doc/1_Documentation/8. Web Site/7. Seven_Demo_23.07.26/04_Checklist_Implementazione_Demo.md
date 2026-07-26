# Checklist completa — Jethos Interactive Demo

Stato iniziale verificato prima dell'implementazione. Le caselle vengono
marcate solo dopo implementazione e controllo.

## A. Confini e architettura

- [x] A01 Mantenere `app.html` come console PoC reale.
- [x] A02 Creare entry point autonomo `demo/index.html`.
- [x] A03 Usare `data-root=".."` e shell/auth condivise.
- [x] A04 Impedire ogni import dai moduli `assets/js/web3/`.
- [x] A05 Aggiungere `noindex,nofollow` e avviso persistente “no real funds”.
- [x] A06 Usare route hash senza dipendenze server.

## B. Modello e dati

- [x] B01 Creare catalogo illustrativo centralizzato e immutabile.
- [x] B02 Definire tre vault confrontabili con rischio, APY, liquidità e rischi.
- [x] B03 Verificare allocazioni al 100% e id univoci.
- [x] B04 Creare schema stato versionato.
- [x] B05 Creare scenario iniziale con 10.000 demo USDC.
- [x] B06 Gestire JSON locale corrotto con reset sicuro.
- [x] B07 Persistenza locale dopo ogni operazione.

## C. Motore simulato

- [x] C01 Calcolare valore posizione in modo deterministico.
- [x] C02 Calcolare riepilogo wallet/vault/patrimonio/guadagno.
- [x] C03 Validare depositi positivi e saldo sufficiente.
- [x] C04 Applicare depositi in modo atomico.
- [x] C05 Avanzare di 30 giorni solo con posizioni.
- [x] C06 Validare prelievi positivi e valore sufficiente.
- [x] C07 Gestire prelievo parziale e totale senza residui numerici.
- [x] C08 Registrare attività locali senza hash finti.
- [x] C09 Implementare reset completo.

## D. Shell applicativa

- [x] D01 Creare rail desktop e navigazione mobile.
- [x] D02 Implementare Overview.
- [x] D03 Implementare Explore vaults.
- [x] D04 Implementare Portfolio.
- [x] D05 Implementare Activity.
- [x] D06 Implementare Transparency.
- [x] D07 Evidenziare route attiva con `aria-current`.
- [x] D08 Aggiungere reset con conferma.

## E. Overview

- [x] E01 Mostrare patrimonio totale simulato.
- [x] E02 Mostrare wallet, vault e guadagno separatamente.
- [x] E03 Mostrare confine wallet/vault.
- [x] E04 Aggiungere CTA verso catalogo.
- [x] E05 Aggiungere onboarding conciso e non bloccante.

## F. Vault explorer

- [x] F01 Rendere card confrontabili con struttura uniforme.
- [x] F02 Dare a rischio e liquidità pari evidenza dell'APY.
- [x] F03 Rendere allocazioni e rischi nel dettaglio inline.
- [x] F04 Aggiungere azione di deposito per ogni vault.
- [x] F05 Etichettare tutti i valori come illustrativi.

## G. Deposito

- [x] G01 Creare modal accessibile a due fasi.
- [x] G02 Mostrare saldo e scorciatoie 25%, 50%, Max.
- [x] G03 Validare input e mostrare errore inline.
- [x] G04 Mostrare saldo residuo prima della conferma.
- [x] G05 Review con destinazione, rischio e avviso.
- [x] G06 Aggiornare stato, attività e route dopo conferma.

## H. Portafoglio, tempo e prelievo

- [x] H01 Mostrare principal, valore corrente e variazione.
- [x] H02 Mostrare stato vuoto utile.
- [x] H03 Implementare “Simulate 30 days”.
- [x] H04 Creare prelievo a due fasi.
- [x] H05 Offrire 50% e Max.
- [x] H06 Mostrare valore residuo e destinazione.
- [x] H07 Aggiornare wallet, posizione e attività.

## I. Trasparenza e attività

- [x] I01 Mostrare ownership boundary senza assoluti fuorvianti.
- [x] I02 Disegnare route del capitale in HTML/CSS.
- [x] I03 Mostrare allocazioni derivate dal catalogo.
- [x] I04 Mostrare ledger dei rischi per posizione.
- [x] I05 Mostrare cronologia più recente per prima.
- [x] I06 Creare ricevute locali con id, data, tipo, importo e stato.
- [x] I07 Non generare explorer link o hash simulati.

## J. UX, grafica e accessibilità

- [x] J01 Integrare il design system esistente con CSS prefissato.
- [x] J02 Creare responsive desktop/tablet/mobile.
- [x] J03 Gestire modal, Escape, focus iniziale e ritorno del focus.
- [x] J04 Usare `aria-live` per notifiche e `role=alert` per errori.
- [x] J05 Non affidare significato soltanto al colore.
- [x] J06 Rispettare `prefers-reduced-motion`.
- [x] J07 Evitare inserimento di input con `innerHTML`.
- [x] J08 Garantire target interattivi e focus visibile.

## K. Integrazione

- [x] K01 Collegare CTA globale alla demo.
- [x] K02 Collegare hero landing alla demo.
- [x] K03 Conservare accesso alla console PoC.
- [x] K04 Inserire demo nel footer.
- [x] K05 Aggiornare README e mappa della struttura.

## L. Validazione

- [x] L01 Aggiungere test Node del motore.
- [x] L02 Aggiungere validatore statico della demo.
- [x] L03 Aggiungere comandi npm dedicati.
- [x] L04 Eseguire test del motore.
- [x] L05 Eseguire validatore demo.
- [x] L06 Eseguire validazione generale.
- [x] L07 Eseguire controlli editoriali/prodotto.
- [x] L08 Controllare riferimenti locali e duplicati ID.
- [x] L09 Verificare manualmente il flusso in browser se disponibile.

## M. Documentazione e consegna

- [x] M01 Aggiornare questa checklist con risultati effettivi.
- [x] M02 Creare rapporto di implementazione.
- [x] M03 Creare guida utente della demo.
- [x] M04 Creare guida tecnica e manutenzione moduli.
- [x] M05 Creare indice della cartella documentale.
- [x] M06 Registrare limiti e lavoro futuro senza presentarli come bug.

## Chiusura

Checklist completata il 23 luglio 2026. Evidenze tecniche e comandi eseguiti
sono riepilogati in `10_Verifica_Finale.md`.
