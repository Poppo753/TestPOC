# Audit tecnico post-verifica — indice

## Scopo

Questa sottocartella censisce nel dettaglio l’implementazione e le correzioni emerse dalla verifica end-to-end del 14 luglio 2026. Non sostituisce i documenti di architettura e utilizzo già presenti: li completa con tracciabilità file-per-file, invarianti, failure path ed evidenze.

## Ordine di lettura

1. `01_Censimento_Modifiche_File_per_File.md` — cosa è stato creato o modificato e perché.
2. `02_Flusso_End_to_End_e_Invarianti.md` — esecuzione completa dal comando al post-stato.
3. `03_Configurazione_e_Policy_Field_by_Field.md` — significato e sicurezza di ogni campo.
4. `04_Simulazione_Fork_Deploy_e_Server.md` — separazione fra fork, mainnet e servizio 24/7.
5. `05_Persistenza_Lock_Concorrenza_e_Recovery.md` — journal, state machine, crash e limiti.
6. `06_Matrice_Test_e_Tracciabilita.md` — requisito → codice → test → evidenza.
7. `07_Limiti_Residui_Gate_e_Roadmap.md` — cosa manca davvero prima della produzione.

## Documenti principali collegati

- `../10_Indice_Generale_e_Perimetro_Documentale.md`: punto d'ingresso unico all'intero corpus documentale.
- `../10_Control_File_Implementation/README.md`: estensione successiva con control file, preflight, signer, Safe e servizio.
- `../01_Strategia_Espansa_e_Architettura.md`: architettura generale.
- `../03_Checklist_Implementazione.md`: checklist corrente.
- `../05_Guida_Comandi_e_Utilizzo.md`: comandi operatore.
- `../06_Runbook_Sicurezza_e_Incidenti.md`: gestione incidenti.
- `../08_Verifica_End_to_End_14_07_2026.md`: verdetto sintetico dell’ultima verifica.

## Perimetro certificato

Il censimento riguarda esclusivamente:

- un vault;
- una chain;
- un asset base;
- operazioni `deposit` e `withdraw` verso protocolli supply-only;
- Aave, Euler e Morpho Vault tramite `ProtocolManager`;
- modalità observe, advisory e autonomia tecnicamente protetta ma non ancora autorizzata operativamente.

Non comprende Dolomite, GMX, Morpho market diretto, Uniswap, borrow, leverage, swap automatici o bridge.
