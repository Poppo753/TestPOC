# Revisione critica della strategia

## Verifica task per task

### Confermato senza modifiche

- mantenere headline e posizionamento;
- nuova gerarchia della homepage;
- receipt anticipato;
- PoC dominante;
- Today/Next/Vision;
- cinque stati in How it works;
- policy pending esplicite;
- console Simple/Advanced;
- Trust Center evidence-based;
- roadmap con blocker ed evidenze;
- Docs per audience;
- changelog.

### Corretto rispetto alla proposta iniziale

1. **Non rimuovere il WebGL della Roadmap.**  
   `Migliorie.md` suggerisce di evitare il 3D nella roadmap dettagliata. L’implementazione corrente lo usa come introduzione educativa opzionale, mentre i dettagli restano HTML. È coerente e può rimanere.

2. **Non creare percentuali di avanzamento.**  
   Lo stato sarà testuale e associato a evidenze; niente progress bar arbitrarie.

3. **Non mostrare soglie conservative come reali.**  
   I campi non definiti verranno marcati `Policy decision pending`. Un esempio numerico separato resterà `Illustrative`.

4. **Non presentare la lista integrazioni come allocazione.**  
   Aave, Euler e Morpho sono integrazioni registrate; la UI continuerà a specificarlo.

5. **Non aggiungere profili team inventati.**  
   Verrà creata una disclosure page onesta con stato incompleto e contatto da definire.

6. **Non duplicare la documentazione.**  
   Il lettore Markdown esistente resta la fonte dettagliata; si migliora solo l’orientamento.

7. **Non riscrivere l’architettura WebGL.**  
   Il modello Protocol già soddisfa l’exploded view; si migliora il contenuto HTML associato.

8. **Non spostare i dati diagnostici fuori dalla console.**  
   Verranno nascosti nella modalità Advanced, non rimossi.

## Strategia finale

La strategia migliore è una revisione editoriale e informativa profonda, ma tecnicamente incrementale:

- mantenere il design system e gli entry point;
- modificare HTML e dati strutturati;
- aggiungere il minimo JavaScript necessario per modalità e fallback;
- preservare i workflow web3;
- verificare tutto con i gate esistenti.

## Rischi dell’intervento

- una homepage troppo lunga anche dopo il refactoring;
- nuove sezioni con dati pending percepite come incomplete;
- console Simple/Advanced che nasconde informazioni necessarie;
- doppia fonte fra HTML e JSON;
- validatori non aggiornati;
- regressioni su mobile.

## Mitigazioni

- massimo dieci blocchi narrativi in homepage;
- pending presentato come trasparenza, non come dato mancante casuale;
- Advanced sempre accessibile con un click;
- HTML come fallback leggibile, JSON come fonte di aggiornamento;
- nuovi controlli statici;
- verifica a viewport desktop e mobile.
