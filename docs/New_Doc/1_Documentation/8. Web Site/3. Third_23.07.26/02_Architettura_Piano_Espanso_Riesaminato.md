# Fase 1 — piano espanso e riesaminato

## 1. Configurazione della shell

Separare dati e rendering. La configurazione deve contenere link, gruppi footer, disclaimer e definizioni degli stati; `site-shell.js` deve occuparsi soltanto di proiettarli nel DOM. Questo riduce stringhe duplicate e rende verificabile la navigazione.

Riesame: non spostare tutto il copy delle pagine in JSON. Renderebbe l'editing editoriale meno leggibile e introdurrebbe hydration inutile. Solo dati trasversali vanno centralizzati.

## 2. Robustezza asincrona App

Ogni refresh riceve un numero progressivo. Solo il risultato dell'ultimo refresh può aggiornare la vista. Un cambio account invalida la lettura utente precedente. Il pulsante Refresh espone stato busy senza bloccare la connessione wallet.

Riesame: AbortController non è affidabile per ogni provider ethers; il token “latest wins” è più semplice e sufficiente.

## 3. Diagnostica operativa

La libreria comune deve offrire provider read-only, conversione BigInt JSON e gestione uniforme degli errori. `check-deployment` controlla fondamenta; `inspect-protocols` controlla registro e lens; `check-content` controlla il contratto editoriale; `release-readiness` li esegue in sequenza e fallisce se un gate fallisce.

Riesame: il comando aggregato non deve inviare transazioni né scrivere snapshot automaticamente. L'output JSON rimane disponibile sui comandi specializzati.

## 4. Trust Center

Creare una pagina pubblica che distingua: live read, deployment record, implementato, PoC, planned, vision e illustrative. Deve mostrare confini di responsabilità, indirizzi/Arbiscan, verifiche ripetibili e limiti dell'assurance.

## 5. Ordine

1. Configurazione e shell.
2. Token asincroni App.
3. Libreria e CLI.
4. Trust Center.
5. Validatori e readiness.
6. Test sintattici, statici, live e HTTP.

