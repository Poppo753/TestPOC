# Jethos Website — piano espanso e riesaminato

Versione 1.1 — 23 luglio 2026  
Stato: piano esecutivo riesaminato prima dell'implementazione

## 1. Scopo

Questo documento espande `01_Strategia_Generale_Sito_Jethos.md`, trasforma la visione editoriale in un piano tecnico e riesamina criticamente ogni scelta prima di produrre la checklist.

Il risultato richiesto non è soltanto una landing più gradevole. Deve essere un piccolo sistema editoriale e applicativo capace di:

- raccontare correttamente Jethos;
- distinguere presente, sviluppo e visione;
- offrire documentazione navigabile;
- collegarsi al PoC USDC corrente;
- permettere interazioni utente sicure attraverso il core Jethos;
- essere mantenibile senza modificare centinaia di righe duplicate.

## 2. Analisi dello stato iniziale

### 2.1 Punti validi

- Identità visiva scura viola/blu riconoscibile.
- Buona quantità di materiale visuale.
- Landing responsive di base.
- Contenuti dinamici già separati in `plugins.json` e `roadmap.json`.
- Componenti JavaScript atomici riutilizzabili nella vecchia DApp.
- Collegamenti ad Arbiscan e primi tentativi di dati live.

### 2.2 Problemi editoriali

- Jethos è descritto come universal yield aggregator.
- “Maximum Yield” contraddice il rendimento corretto per rischio.
- “Every Protocol” trasforma la modularità in una promessa assoluta.
- L'utente incontra protocolli e contratti prima di comprendere il prodotto.
- PoC, implementazione tecnica e visione quinquennale sono mescolati.
- ETH, USDC e WBTC sembrano tutti prodotti disponibili.
- La piramide sembra operativa a più livelli.
- “No-risk”, “audited” e “withdraw anytime” sono troppo assoluti.
- Gli audit dei sottostanti possono essere confusi con un audit Jethos.

### 2.3 Problemi tecnici

- `landing.html` supera 2.300 righe e incorpora struttura, stile e logica.
- Tailwind CDN e dipendenze remote non costituiscono una base production-grade.
- Vanta, Three.js e più sistemi di animazione competono fra loro.
- Il file video è circa 15 MB.
- La vecchia configurazione punta a un deployment ETH differente dal PoC USDC più recente.
- ABI `deposit()` payable non corrisponde a `deposit(uint256)` ERC-20 corrente.
- Fee, simboli e importi minimi sono hardcoded.
- Errori RPC vengono in alcuni casi trasformati in stati ottimistici.
- Non esiste una classificazione uniforme della provenienza dei dati.
- Le stime di share non sono distinte da preview garantite dal contratto.

## 3. Strategia di prodotto

### 3.1 Identità

Jethos è organizzato in tre livelli:

1. **Jethos Protocol** — infrastruttura on-chain, vault, accounting, plugin, rischio e automazione;
2. **Jethos App** — esperienza self-custodial per detenere, investire, inviare e comprendere gli asset;
3. **Future financial services** — pagamenti, carte, credito e asset tokenizzati tramite partner e percorsi regolamentati.

Il sito deve iniziare dal livello 2, spiegare il livello 1 come motore e presentare il livello 3 come visione.

### 3.2 Differenza rispetto alla banca tradizionale

Il messaggio corretto non è “le banche fanno ciò che vogliono”. Il messaggio verificabile è:

- nel wallet l'utente conserva il controllo delle chiavi e delle autorizzazioni;
- Jethos non utilizza automaticamente gli asset non depositati;
- quando l'utente deposita, le regole del vault e le transazioni sono pubbliche;
- l'utente può vedere destinazioni, limiti e movimenti del capitale;
- esistono comunque smart-contract risk, admin risk, protocol risk e wallet risk.

La comunicazione deve evidenziare la differenza senza insinuare assenza assoluta di rischio o controllo umano.

### 3.3 Principale lavoro comunicativo

Il sito deve insegnare cinque concetti in meno di due minuti:

1. Jethos è una financial home self-custodial.
2. Wallet e capitale investito sono due stati differenti.
3. L'utente sceglie asset, obiettivo e rischio.
4. Il vault usa soltanto strategie autorizzate e verificabili.
5. Il prodotto attuale è un PoC; la financial home completa è la direzione.

## 4. Sistema degli stati

Ogni capacità, vault, integrazione e metrica deve avere uno stato esplicito:

- **PoC live**: deployment esistente, privato e verificabile;
- **Implemented**: presente nel repository ma non necessariamente prodotto pubblico;
- **In validation**: sottoposto a test o consolidamento;
- **Planned**: approvato come direzione, non implementato;
- **Vision**: possibilità di lungo periodo;
- **Illustrative**: dato o UI dimostrativa;
- **Live data**: letto dalla chain con timestamp e fonte.

Questo vocabolario è un requisito funzionale, non una decorazione.

## 5. Mappa delle pagine

### 5.1 Home

Obiettivo: far comprendere identità, controllo, funzionamento e stato.

Contiene:

- hero con dashboard illustrativa;
- quattro capacità Hold/Invest/Send/Understand;
- diagramma wallet/vault;
- percorso in cinque fasi;
- matrice asset/risk;
- modello rendimento netto;
- mockup trasparenza;
- principi di controllo;
- architettura semplificata;
- tre anime Jethos;
- roadmap a orizzonti;
- CTA.

Non contiene:

- nove card di contratti;
- ABI;
- elenco completo delle funzioni;
- dettagli amministrativi;
- roadmap trimestrale non approvata.

### 5.2 How it works

Obiettivo: spiegare l'intero ciclo del capitale.

Sezioni:

1. Wallet ownership.
2. Approval e deposito esplicito.
3. Share e rappresentazione della posizione.
4. Reserve e allocazioni.
5. Monitoring e rebalancing.
6. Withdrawal e possibili stati di liquidità.
7. Cosa Jethos può e non può fare.
8. Rischi residui.

### 5.3 Vaults

Obiettivo: trasformare la tassonomia tecnica in catalogo di prodotto.

Contiene:

- selezione per base asset;
- profili Conservative, Balanced e Advanced;
- definizione base-asset denominated;
- scheda PoC USDC Conservative;
- schede future chiaramente disabilitate;
- spiegazione share;
- liquidità e prelievi;
- link alla metodologia rischio.

### 5.4 Risk & Transparency

Obiettivo: mostrare che “semplice” non significa opaco.

Contiene:

- significato dei profili;
- dimensioni del risk score;
- cap, reserve, HF e liquidità;
- APY nominale vs rendimento netto;
- esempio di allocazione;
- origine dei dati;
- rischi inevitabili;
- status delle policy ancora da definire.

### 5.5 Vision

Obiettivo: spiegare il financial home senza presentarlo come già disponibile.

Contiene:

- missione;
- Protocol, App, Services;
- esperienza futura;
- multi-asset e multi-chain;
- composabilità;
- servizi regolamentati tramite partner;
- limiti delle promesse.

### 5.6 Roadmap

Obiettivo: mostrare dipendenze e criteri, non scadenze speculative.

Orizzonti:

- Today — validate the foundation;
- Next — expand vault families and the app;
- Later — composability and independent EVM deployments;
- Vision — complete self-custodial financial experience.

Ogni milestone descrive criterio di uscita e stato.

### 5.7 Security

Obiettivo: presentare controlli e limiti con linguaggio preciso.

Contiene:

- threat surfaces;
- smart contract controls;
- wallet responsibilities;
- admin e upgrade assumptions;
- pause ed emergenze;
- audit status Jethos;
- risorse audit sottostanti separate;
- incident disclosure placeholder;
- link ai contratti.

### 5.8 Protocol

Obiettivo: spiegazione tecnica senza contaminare la landing.

Contiene:

- core contracts;
- custody e call flow;
- Registry/Plugin/LensAdapter;
- protocolli correnti;
- automation;
- InterVault e limiti correnti;
- deployment record.

### 5.9 Developers

Obiettivo: punto di ingresso per integrazioni.

Contiene:

- quick start locale;
- chain/deployment config;
- entry point utente;
- indirizzi e explorer;
- eventi;
- struttura moduli frontend;
- indicazione che l'ABI è derivata dai contratti correnti;
- avvertenza PoC.

### 5.10 Docs

Obiettivo: indice editoriale verso il pacchetto v0.1 e guide web.

La prima versione non tenta di convertire tutti i DOCX in HTML. Offre tassonomia, abstract e link/percorsi, distinguendo documentazione concettuale, tecnica, PoC e decision backlog.

### 5.11 App

Obiettivo: console read-mostly del PoC con transazioni esplicite.

La pagina deve funzionare senza wallet per dati pubblici e attivare le azioni soltanto dopo connessione, rete corretta e consenso.

## 6. Design system

### 6.1 Token

- background: navy quasi nero;
- surface: pannelli blu/grigio;
- primary: violet;
- secondary: cyan/blue;
- success: green soltanto per stati positivi reali;
- warning: amber per PoC/estimate;
- danger: coral/red;
- testo: bianco caldo e grigi ad alto contrasto.

### 6.2 Tipografia

Font di sistema per affidabilità e performance. Titoli fluidi con `clamp`, massimo circa 64 px desktop. Il messaggio deve restare leggibile senza dipendere dal font esterno.

### 6.3 Componenti

- site header/mobile navigation;
- footer;
- status badge;
- button/link button;
- content card;
- metric;
- flow diagram;
- disclosure/accordion;
- callout;
- source label;
- transaction state;
- toast;
- modal di conferma;
- skeleton;
- empty/error state.

### 6.4 Motion

- reveal leggero con IntersectionObserver;
- animazioni del flusso soltanto quando visibile;
- nessun effetto essenziale affidato al movimento;
- `prefers-reduced-motion` disabilita transizioni non necessarie;
- niente Vanta/Three nella prima implementazione consolidata.

Riesame: eliminare gli effetti 3D riduce dipendenze, peso e distrazione. L'identità resta affidata a gradienti, griglie e diagrammi CSS/SVG. La scelta è confermata.

## 7. Architettura file

```text
dapp-new/
  index.html
  app.html
  landing.html                    compatibility redirect
  documentation.html              compatibility redirect
  config.html                     compatibility redirect
  portfolio.html                  compatibility redirect
  pages/
    how-it-works.html
    vaults.html
    risk-transparency.html
    vision.html
    roadmap.html
    security.html
    protocol.html
    developers.html
    docs.html
  assets/
    css/
      tokens.css
      base.css
      components.css
      layouts.css
      pages.css
    js/
      core/
        site-shell.js
        navigation.js
        reveal.js
        format.js
      components/
        status-badge.js
        modal.js
        toast.js
      features/
        capital-flow.js
        vault-matrix.js
        roadmap.js
        transparency-demo.js
      web3/
        ethers-loader.js
        deployment-config.js
        abis.js
        wallet.js
        contracts.js
        readers.js
        estimates.js
        transactions.js
        events.js
        app-controller.js
  data/
    site-content.json
    vaults.json
    protocols.json
    roadmap.json
    deployments.json
  README.md
```

Riesame: una cartella per pagina aggiungerebbe profondità senza beneficio in un sito statico. Una sola cartella `pages` è più semplice. La separazione profonda è riservata ai moduli JavaScript, dove serve davvero.

## 8. Modello dei contenuti

Contenuti editoriali stabili restano nell'HTML per indicizzazione e funzionamento senza JavaScript. Dati ripetuti o aggiornabili vengono salvati in JSON:

- vault catalog;
- roadmap;
- protocol integrations;
- deployments.

Riesame: spostare tutto il testo in JSON renderebbe il sito più difficile da tradurre e ispezionare senza introdurre un vero CMS. Si mantiene una soluzione ibrida.

## 9. Configurazione on-chain

### 9.1 Deployment corrente

Fonte locale: `scripts/manifests/arbitrum-usdc-poc-1.json`.

Elementi principali:

- chain ID 42161;
- base asset USDC `0xaf88...e5831`, 6 decimali;
- LiquidityManager `0x80fB...e192`;
- ProxyGeneral `0xb070...d9BF`;
- ValueCalculator `0x1850...7c1A`;
- ProtocolManager `0x91fE...5A8D`;
- Aave, Euler, Morpho e MorphoVault registrati.

Il manifest è una registrazione locale del deployment. L'app deve leggere lo stato live e segnalare errori o incongruenze.

### 9.2 ABI minime

Le ABI frontend devono contenere soltanto le funzioni usate:

- ERC-20: balance, allowance, approve, decimals, symbol;
- Proxy share: balance, supply, decimals, symbol;
- LiquidityManager: deposit, withdraw, withdrawWithDeadline, fee, status e eventi;
- ValueCalculator: total pool value;
- ProtocolManager: nomi, info, summary, value, health;
- Lens summary, se decodificabile con ABI corrente.

Riesame: evitare ABI enormi riduce superficie e rende visibile ciò che la UI usa. Scelta confermata.

## 10. Architettura web3

### 10.1 Ethers loader

Carica Ethers v6 da CDN una sola volta, gestisce errore di rete e non inizializza automaticamente un wallet.

### 10.2 Wallet session

Responsabilità:

- rilevare provider EIP-1193;
- connessione esplicita;
- ripristino non invasivo tramite `eth_accounts`;
- chain switch;
- account/chain listeners senza listener duplicati;
- stato serializzabile per UI.

### 10.3 Contract factory

Crea contratti read-only con RPC pubblico e contratti write con signer. Nessun modulo di presentazione costruisce contratti direttamente.

### 10.4 Readers

Funzioni pure ad alto livello:

- `readVaultSnapshot`;
- `readUserSnapshot`;
- `readProtocolSnapshot`;
- `readAllowance`;
- `readTransactionCapabilities`.

Ogni risultato contiene `source`, `timestamp`, `status` ed eventuale `error`. Un errore non diventa valore zero senza etichetta.

### 10.5 Estimates

Poiché il vault corrente non è ERC-4626 e non espone tutte le preview standard, le stime frontend sono indicative.

- stima deposito: formula corrente con pool value/supply e fee;
- stima prelievo: quota di pool value meno fee;
- arrotondamenti coerenti con gli interi;
- disclaimer sempre mostrato;
- nessuna stima usata come garanzia `minOut` se il contratto non lo supporta.

### 10.6 Transactions

Sequenza deposito:

1. validazione importo e decimali;
2. rete e account;
3. lettura depositsEnabled;
4. lettura balance;
5. approval esatto se insufficiente;
6. attesa receipt approval;
7. nuova lettura allowance;
8. stima gas deposit;
9. modal riassuntivo;
10. invio deposit;
11. attesa conferma;
12. refresh snapshot.

Sequenza prelievo:

1. validazione share;
2. rete/account;
3. lettura withdrawsEnabled;
4. lettura balance share;
5. stima indicativa;
6. modal;
7. gas estimate;
8. `withdrawWithDeadline` preferito;
9. receipt;
10. refresh.

Riesame: l'approval infinito è più comodo ma aumenta il rischio. La UI usa approval esatto e offre revoca separata. Scelta confermata.

### 10.7 Event history

- query per finestre di blocchi;
- filtri indicizzati per utente quando supportati;
- fallback a scansione limitata;
- deduplicazione per txHash/logIndex;
- ordinamento;
- link explorer;
- limite configurabile;
- errore esplicito se il provider limita la query.

## 11. Funzioni della App

### 11.1 Modalità disconnessa

- stato vault pubblico;
- contratti e source;
- protocolli;
- pool value/supply;
- deposit/withdraw status;
- CTA connect.

### 11.2 Modalità connessa

- saldo wallet ETH per gas;
- saldo USDC;
- allowance;
- share;
- valore stimato posizione;
- deposit/withdraw;
- revoke approval;
- storico.

### 11.3 Operazioni escluse dalla UI utente

- chiamate dirette ai plugin;
- allocazioni manuali;
- borrow/leverage;
- emergency transfer;
- amministrazione Beacon/Registry;
- configurazione fee/risk;
- upgrade.

Queste operazioni appartengono a strumenti operatori separati con policy e autenticazione adeguate. Esporle nella consumer app contraddirebbe il modello Jethos.

## 12. Accessibilità

- struttura semantica;
- skip link;
- un solo H1;
- focus visibile;
- dialog con focus management;
- navigazione tastiera;
- label reali;
- errori associati ai campi;
- contrasto almeno WCAG AA dove possibile;
- `aria-live` per transazioni;
- grafici accompagnati da testo/tabella;
- reduced motion;
- nessuna informazione comunicata soltanto con colore.

## 13. Responsive

Breakpoint guidati dal contenuto:

- sotto 720 px: navigazione drawer, card singole, tabelle scrollabili;
- 720–1080 px: due colonne;
- oltre 1080 px: layout completo.

La dashboard hero deve restare leggibile a 320 px. I diagrammi complessi diventano sequenze verticali.

## 14. Performance e resilienza

- nessun video hero obbligatorio;
- nessuna libreria 3D;
- CSS locale;
- immagini SVG/CSS leggere;
- JavaScript caricato come module/defer;
- RPC chiamato solo dove necessario;
- refresh manuale e intervallo prudente;
- timeout e retry limitato;
- contenuti disponibili se RPC/CDN falliscono;
- nessuna chiave privata o API secret nel frontend.

## 15. Sicurezza frontend

- nessun HTML remoto non sanitizzato;
- JSON locale trattato come dato, non markup;
- indirizzi validati;
- chain ID verificato prima di scrivere;
- importi convertiti con `parseUnits`;
- niente `Number` per quantità on-chain;
- gas stimato, non hardcoded come unica via;
- receipt status controllato;
- errori wallet decodificati senza esporre stack inutili;
- CTA disabilitate durante pending;
- doppio click impedito;
- conferma distinta per approve e deposit;
- link explorer con `rel="noopener noreferrer"`.

## 16. SEO e contenuti

- title e description unici;
- canonical relativi da definire quando esiste il dominio;
- Open Graph predisposto senza URL fittizi;
- headings coerenti;
- JSON-LD evitato finché identità legale e dominio non sono definiti;
- robots non blocca il sito informativo;
- la pagina App può essere `noindex` durante il PoC.

## 17. Testing

### 17.1 Statico

- tutti gli href locali risolvono;
- nessun ID duplicato;
- JSON valido;
- moduli importabili;
- nessun vecchio indirizzo ETH nei nuovi moduli;
- nessuna frase vietata.

### 17.2 Browser

- caricamento di ogni pagina via HTTP locale;
- console senza errori bloccanti;
- mobile/desktop screenshot;
- nav e menu;
- reduced motion;
- app disconnessa.

### 17.3 Web3 read-only

- RPC raggiungibile;
- bytecode presente agli indirizzi;
- letture base asset e vault;
- gestione RPC failure.

### 17.4 Write path

Non si inviano transazioni mainnet durante il test automatico del sito. Si verificano:

- validazioni;
- costruzione chiamate;
- gas estimate soltanto con account appropriato;
- stati UI con adapter/mock;
- eventuale fork separato già appartenente alla suite Solidity.

Riesame: eseguire transazioni reali per “testare la UI” sarebbe distruttivo e non necessario. Scelta confermata.

## 18. Ordine di esecuzione

1. Congelare strategia e termini.
2. Creare design token e shell condivisa.
3. Creare struttura pagine e navigazione.
4. Implementare landing.
5. Implementare contenuti specialistici.
6. Centralizzare data JSON.
7. Implementare configurazione deployment e ABI.
8. Implementare web3 read-only.
9. Implementare wallet.
10. Implementare estimates.
11. Implementare transazioni.
12. Implementare app controller/UI.
13. Aggiungere eventi e protocol view.
14. Aggiungere compatibility redirects.
15. Verificare sito e app senza wallet.
16. Verificare read-only live.
17. Correggere accessibilità/responsive.
18. Aggiornare checklist e guide.

L'ordine evita che il sito venga progettato attorno a una DApp obsoleta e impedisce che le transazioni siano implementate prima della configurazione corretta.

## 19. Riesame critico finale

### Decisioni mantenute

- Financial home come identità primaria.
- Wallet/vault come concetto centrale.
- Multi-page invece di una landing monolitica.
- Vanilla ES modules senza build obbligatoria.
- App separata dal sito.
- Deployment e ABI centralizzati.
- Approval esatto.
- Interazioni utente soltanto tramite core Jethos.
- Date roadmap sostituite da orizzonti.
- Eliminazione effetti 3D pesanti.

### Decisioni corrette durante il riesame

1. **“Nessuno può toccare i fondi”** è stato corretto in una descrizione basata su chiavi, autorizzazioni e deposito esplicito.
2. **“Home banking” in inglese** è stato sostituito da “self-custodial financial home”.
3. **Tutto il testo in JSON** è stato scartato a favore di HTML indicizzabile più dati strutturati.
4. **Interazione diretta con plugin** è stata esclusa dalla consumer app; passa dal core Jethos.
5. **Preview garantita** è stata sostituita da stima indicativa perché il contratto non è ERC-4626 completo.
6. **Audit badge** è stato separato tra Jethos e protocolli sottostanti.
7. **Test transazionali mainnet** sono stati esclusi dalla verifica automatica.
8. **Roadmap trimestrale** è stata sostituita da capacità e criteri di uscita.

### Rischi residui

- La documentazione descrive un target più ampio del PoC.
- Gli indirizzi del manifest devono essere riverificati live.
- L'app dipende da Ethers CDN e RPC pubblico.
- Il vault corrente non offre preview/min-out standard.
- Alcune letture ProtocolManager possono fallire per dati o plugin specifici.
- Nessun frontend può compensare discrepanze o rischi del contratto.

### Conclusione del riesame

La strategia è adeguata perché separa chiaramente identità, informazione e transazione; comunica la proprietà senza promesse assolute; usa lo stato reale del PoC; e mantiene la possibilità di evolvere verso una vera applicazione finanziaria senza ricostruire ancora una volta l'intero sito.

