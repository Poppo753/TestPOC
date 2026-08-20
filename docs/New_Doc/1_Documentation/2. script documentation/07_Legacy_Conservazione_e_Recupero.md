# Legacy: conservazione, rischi e recupero

## Stato

`scripts/legacy` contiene 347 file. Sono stati spostati, non cancellati. Il controllo finale ha confrontato i blob Git dei 347 path rimossi con gli hash di tutti i file oggi presenti sotto `scripts`: contenuti mancanti = 0.

Le sottocartelle preservano il contesto originario (`admin`, `debug`, `deploy`, `deployment`, `testing`, `interact`, `monitoring`, `migration`, ecc.). I file che erano direttamente nella root sono in `legacy/root-scripts`; le action che erano mescolate alla configurazione sono in `legacy/config-actions`; le varianti core non certificate sono in `legacy/core-extended`.

## Perché non sono attivi

Nel legacy sono presenti, a seconda del file:

- address hardcoded e manifest differenti;
- private key/env letti direttamente;
- vecchia API Beacon o SwapManager;
- `process.exit` dentro logica riusabile;
- script GMX/Dolomite incompleti;
- mock, TODO, diagnostiche one-off e stato fork implicito;
- cartelle duplicate con responsabilità sovrapposte;
- assenza di dry-run, post-check o chain guard.

Non eseguire un file legacy solo perché il nome sembra corretto.

## Procedura di recupero

1. Identificare il comportamento ancora necessario.
2. Leggere contratto e interfaccia correnti; non copiare l'ABI dal file storico.
3. Verificare se l'operation attiva già copre il caso.
4. Portare soltanto la logica mancante sotto `operations/<dominio>`.
5. Usare runtime/manifest/preflight/ExecutionPlan correnti.
6. Aggiungere test locale deterministico con snapshot/revert.
7. Aggiungere smoke fork al blocco fissato se dipende da protocollo reale.
8. Documentare il nuovo comando; lasciare intatto l'originale legacy finché la migrazione è revisionata.

## Cosa non recuperare

- deploy GMX e Dolomite finché i plugin non sono conclusi;
- script che correggono manualmente uno specifico deployment senza preflight;
- diagnostiche con whale/address casuali;
- copie di script già coperte dalla suite attiva;
- workaround per API eliminate.

