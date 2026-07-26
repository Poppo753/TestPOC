# Valutazione delle migliorie proposte

Data: 23 luglio 2026  
Ambito: `TestSmartContract/dapp-new`  
Fonte: `Migliorie.md`

## Esito sintetico

La diagnosi centrale è corretta: il sito comunica bene ownership e self-custody, ma la homepage ripete troppo il confine wallet-vault e mostra troppo tardi il prodotto, la receipt di trasparenza e la distinzione fra stato corrente e visione.

La soluzione non è rifare il sito da zero. Conviene:

1. accorciare e riordinare la homepage;
2. rendere dominante il PoC USDC Conservative;
3. trasformare principi astratti in esempi e stati leggibili;
4. dare alle pagine specialistiche informazioni più operative;
5. non inventare soglie, audit, persone, ruoli o risultati che il repository non prova.

## Cosa è approvato

- mantenere la headline `Home banking, rebuilt around ownership.`;
- riscrivere il sottotitolo partendo dal beneficio;
- introdurre subito `Today → Next → Vision`;
- fondere le sezioni ripetitive sul confine del capitale;
- anticipare e ampliare il Transparency Receipt;
- rendere USDC Conservative nettamente più importante delle famiglie future;
- spostare il confronto fra modelli in How it works;
- aggiungere lo stato `Allocate & monitor`;
- distinguere PoC corrente e standard vault target;
- rendere il rischio misurabile, dichiarando anche le decisioni pendenti;
- dividere la console in modalità Simple e Advanced;
- arricchire Trust Center e Roadmap con evidenze, stato e responsabilità;
- organizzare la documentazione per pubblico;
- aggiungere changelog e una sezione trasparente sul team;
- mantenere Three.js solo nelle pagine narrative già selezionate.

## Cosa è già presente

- headline principale corretta;
- tassonomia visuale per PoC, implemented, planned, vision, illustrative e live;
- scene WebGL separate per Home, How it works, Protocol e Roadmap;
- Trust Center con deployment e confini di controllo;
- roadmap basata su exit criteria;
- lettore dinamico della documentazione con ricerca, indice e download;
- gate di preview su tutte le pagine attive.

Questi elementi non devono essere duplicati: vanno consolidati.

## Cosa non può essere dichiarato come fatto

Non risultano prove sufficienti per pubblicare come dati definitivi:

- soglie numeriche della policy Conservative;
- conteggio di test superati, copertura e scenari fork;
- audit completati;
- multisig, timelock e bug bounty operativi;
- identità, biografie e ruoli del team;
- security contact pubblico;
- commit di release associato al deployment;
- allocazione live completa per protocollo;
- rendimento netto attuale;
- data di deploy diversa da quella registrata;
- implementazione completa ERC-4626 del consumer vault.

Il sito può mostrare questi campi, ma deve usare `Decision pending`, `Not available` o `Not yet evidenced`.

## Priorità

### P0 — gerarchia e correttezza

- nuova homepage;
- distinzione Today/Next/Vision;
- USDC PoC dominante;
- Docs senza dettagli interni nella UI pubblica;
- fallback HTML del catalogo;
- stato corrente e target ERC-4626 separati.

### P1 — concretezza del prodotto

- receipt esteso;
- How it works con cinque stati ed esempio numerico;
- Vaults con scheda PoC e policy ledger;
- Risk con decision example e policy table;
- console Simple/Advanced;
- Trust Center e Roadmap basati su evidenza.

### P2 — fiducia e continuità

- FAQ estese;
- team disclosure onesta;
- changelog datato;
- dashboard concettuale nella Vision.

## Criterio di accettazione

L’implementazione è accettabile se:

- un visitatore distingue in pochi secondi ciò che esiste da ciò che è futuro;
- la homepage non ripete più tre volte lo stesso concetto;
- ogni numero illustrativo è marcato come tale;
- ogni dato non provato è dichiarato pending;
- i dati esistenti continuano a essere caricati dalle fonti strutturate;
- accessibilità, responsive, auth, Docs e WebGL continuano a funzionare;
- tutti i validatori locali passano.
