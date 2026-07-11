Analizza tutti i file Solidity presenti in:
E:\Documents\Crypto\Defi\Arbitrum\Coding\Project4\TestSmartContract\contracts
(incluse sottocartelle, interfacce, librerie, mock, ecc.)

Usa il file JSON allegato (api_reference_beacon.json) come riferimento di struttura per capire il livello di dettaglio richiesto per ogni funzione.

Esegui i seguenti step nell'ordine indicato:

---

STEP 1 — OVERVIEW GENERALE (.md)
Crea il file:
  docs/New_Doc/1_Documentation/contracts_overview.md

Contenuto:
- Lista di tutti i contratti/interfacce trovati, organizzati per cartella
- Per ciascuno: nome file, tipo (contract / interface / library / abstract), breve descrizione dello scopo
- Sezione con le dipendenze principali (quali contratti importano quali)

---

STEP 2 — CSV GLOBALE DI TUTTE LE FUNZIONI
Crea il file:
  docs/New_Doc/1_Documentation/all_functions.csv

Colonne:
  Contract, ContractType, FunctionName, Visibility, StateMutability, Modifiers, Parameters, Returns, Description, AccessControl, Events, Notes

Includi OGNI funzione di OGNI contratto e interfaccia, una riga per funzione.

---

STEP 3 — FILE .md PER OGNI CONTRATTO
Per ogni contratto principale (escludi mock e interfacce se sono meno di 5 funzioni):
Crea un file in:
  docs/New_Doc/1_Documentation/contracts/<ContractName>.md

Struttura di ogni .md:
- Nome contratto e percorso file
- Scopo del contratto
- Storage variables (nome, tipo, visibilità)
- Tabella funzioni: | Function | Visibility | Params | Returns | Modifiers | Description |
- Events emessi
- Note di sicurezza

Leggi i file .sol direttamente dal workspace per estrarre tutte le informazioni.
Inizia dallo STEP 1 e conferma il completamento di ogni step prima di procedere al successivo.