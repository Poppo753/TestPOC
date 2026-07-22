# Jethos Website — strategia generale

Versione 1.0 — 23 luglio 2026  
Stato: documento guida per la ricostruzione completa di `dapp-new`

## 1. Decisione strategica

Jethos deve essere presentato come **un'esperienza finanziaria decentralizzata e self-custodial per gli asset digitali**, non come un semplice yield aggregator.

La formula italiana “home banking decentralizzato self-custodial” descrive bene l'idea. Nella comunicazione inglese è preferibile usare espressioni più naturali e meno ambigue:

- **Your self-custodial financial home.**
- **A self-custodial banking experience for digital assets.**
- **Hold, invest, send and understand your digital assets in one transparent experience.**

La definizione “bank” non deve implicare che Jethos sia una banca regolamentata, che protegga depositi come un istituto bancario o che garantisca rendimento e rimborso. Jethos è un software e un'infrastruttura DeFi; eventuali servizi regolamentati futuri richiederanno partner e percorsi dedicati.

## 2. La promessa centrale

Jethos vuole dare all'utente un luogo unico e familiare nel quale:

1. detenere asset nel proprio wallet;
2. scegliere esplicitamente quali asset investire;
3. selezionare un obiettivo e un profilo di rischio comprensibili;
4. ricevere una posizione trasferibile nel vault;
5. vedere dove si trova il capitale investito;
6. capire rendimento, rischio, liquidità, costi e decisioni;
7. inviare, ricevere e, in futuro, utilizzare gli asset in servizi finanziari più ampi.

Il protocollo, i plugin e i vault sono il motore. L'esperienza quotidiana dell'utente è il prodotto.

## 3. Proprietà e trasparenza

Il sito deve spiegare con precisione due stati differenti.

### 3.1 Fondi nel wallet

Gli asset non depositati restano nel wallet self-custodial. Jethos non può investirli, spostarli o utilizzarli automaticamente. Soltanto chi controlla il wallet può autorizzare una transazione.

La formulazione deve essere forte ma tecnicamente corretta: la sicurezza dipende anche dalla custodia delle chiavi, dalle autorizzazioni già concesse e dall'integrità del wallet. Non si deve promettere che “nessuno potrà mai toccarli” in senso assoluto.

### 3.2 Fondi nei vault

Il deposito è una scelta esplicita. Dal deposito in poi il capitale segue le regole degli smart contract, le integrazioni autorizzate e i poteri amministrativi documentati. L'utente deve poter verificare:

- vault e base asset;
- quantità depositata e share ricevute;
- riserva disponibile;
- protocolli e strategie utilizzati;
- fee;
- stato di prelevabilità;
- transazioni e indirizzi on-chain;
- rischi, limiti e condizioni di emergenza.

Il confronto implicito con la finanza tradizionale può essere espresso positivamente: **in Jethos la destinazione del capitale investito è verificabile**, anziché usare toni polemici o assoluti contro le banche.

## 4. Gerarchia del messaggio

La landing deve raccontare Jethos in questo ordine:

1. controllo e proprietà;
2. esperienza finanziaria unificata;
3. separazione wallet/vault;
4. scelta asset e profilo di rischio;
5. funzionamento trasparente del capitale;
6. rendimento netto corretto per rischio;
7. tecnologia modulare sottostante;
8. stato reale del prodotto e roadmap;
9. documentazione tecnica.

L'ordine precedente del sito — yield, protocolli, contratti, piramide — parte dal motore e non dal bisogno dell'utente.

## 5. Architettura informativa

Il nuovo sito sarà composto da:

- `Home`: identità e panoramica;
- `How it works`: wallet, vault, share e ciclo del capitale;
- `Vaults`: famiglie per asset, rischio e stato;
- `Risk & Transparency`: metodologia, limiti e verificabilità;
- `Vision`: Protocol, App e futuri servizi;
- `Roadmap`: Today, Next e Vision;
- `Security`: controlli, assunzioni, audit e amministrazione;
- `Protocol`: architettura tecnica e plugin;
- `Developers`: contratti, integrazione e risorse;
- `Docs`: indice della documentazione;
- `App`: console del PoC separata dal sito informativo.

## 6. Landing page

### 6.1 Hero

Titolo:

> Your self-custodial financial home.

Sottotitolo:

> Hold, invest, send and understand your digital assets from one transparent experience—without giving up ownership of what remains in your wallet.

Badge:

> Private PoC · USDC Conservative · Arbitrum

CTA:

- Explore Jethos;
- View the PoC;
- Read the docs.

Il visual principale deve ricordare una dashboard finanziaria: saldo totale, disponibile nel wallet, investito nei vault e azioni principali.

### 6.2 Sezioni successive

1. One financial home — Hold, Invest, Send, Understand.
2. Your wallet and your investments are not the same thing.
3. Simple for you. Structured underneath.
4. Choose how you want your assets to work.
5. Risk-adjusted, not headline-driven.
6. See where your assets are and why.
7. Built for transparency, limits and control.
8. Powered by modular DeFi infrastructure.
9. Protocol, App and future services.
10. Today, Next, Vision.
11. CTA conclusiva.

## 7. Visualizzazioni necessarie

### 7.1 Dashboard concettuale

Mostra wallet, vault, totale e azioni. Deve essere dichiarata illustrative se i dati non sono live.

### 7.2 Mappa wallet–vault

Spiega che il wallet non viene investito automaticamente e che il deposito è una decisione esplicita.

### 7.3 Flusso del capitale

```text
Wallet → approval → Jethos Vault → reserve + approved strategies → share → withdraw
```

### 7.4 Matrice asset–rischio

Stablecoin, ETH e BTC incrociati con Conservative, Balanced e Advanced. Ogni cella deve avere uno stato: PoC, development, planned o vision.

### 7.5 Rendimento netto

Mostra la differenza fra APY nominale e risultato atteso dopo fee, gas, slippage, liquidità e vincoli di rischio.

### 7.6 Allocazione trasparente

Mostra una ripartizione dimostrativa tra riserva e protocolli, chiaramente etichettata come esempio se non deriva da dati live.

### 7.7 Architettura a livelli

App → Vault → Strategy/Risk layer → Approved protocol modules. I nove contratti dettagliati restano nella pagina Protocol.

### 7.8 Orizzonti di roadmap

Today, Next e Vision sostituiscono date rigide non approvate.

## 8. Linguaggio e limiti

Da usare:

- self-custodial wallet;
- explicit deposit;
- transparent vault rules;
- approved strategies;
- risk-managed;
- verifiable on-chain;
- expected o estimated return;
- not risk-free;
- PoC, planned, vision.

Da evitare:

- maximum yield;
- every protocol;
- guaranteed;
- risk-free/no-risk;
- always withdraw instantly;
- fully audited, se Jethos non dispone di audit proprio;
- bank, senza chiarire il significato;
- live, per funzionalità soltanto implementate o testate privatamente.

## 9. Direzione visuale

Si mantiene l'identità scura viola/blu, ma con un linguaggio più vicino a un prodotto finanziario:

- tipografia meno monumentale;
- dashboard e dati leggibili;
- icone coerenti al posto delle emoji;
- animazioni utilizzate per spiegare, non decorare;
- sfondi geometrici più leggeri;
- molto contrasto e spazio;
- componenti responsive e accessibili;
- indicatori di stato sempre visibili.

## 10. Architettura tecnica del sito

Il sito sarà statico e modulare, eseguibile con un semplice server locale, senza build obbligatoria:

```text
dapp-new/
  index.html
  app.html
  pages/
  assets/
    css/
    js/
      core/
      components/
      features/
      web3/
  data/
  docs/
```

Vantaggi:

- separazione contenuti/interazioni;
- nessun framework necessario per consultare il sito;
- moduli ES riutilizzabili;
- deployment semplice;
- progressiva migrazione futura possibile;
- configurazioni di chain e deployment centralizzate.

## 11. App e interazioni on-chain

La console PoC offrirà:

- connessione wallet;
- verifica e cambio chain;
- lettura saldo wallet USDC;
- lettura share;
- lettura supply, pool value, fee e stato pause;
- approval USDC con importo esatto;
- deposito attraverso LiquidityManager;
- prelievo attraverso LiquidityManager;
- stime esplicitamente identificate;
- storico eventi deposit/withdraw;
- elenco dei protocolli registrati e posizioni leggibili;
- link Arbiscan;
- errori decodificati e stato transazione.

Gli utenti non chiameranno direttamente i plugin: interagiranno con gli entry point Jethos. Le funzioni amministrative e di strategia saranno documentate ma non esposte come normali azioni utente.

## 12. Fonte di verità

I dati devono essere separati in tre classi:

1. `live`: letti dalla chain;
2. `deployment record`: derivati dal manifest locale e collegati all'explorer;
3. `illustrative/vision`: esempi editoriali dichiarati.

Nessun APY statico deve sembrare live. Nessuna funzionalità pianificata deve apparire disponibile.

## 13. Criteri di completamento

Il lavoro sarà considerato completo quando:

- tutte le pagine esistono e condividono navigazione e design system;
- la landing comunica l'identità di financial home self-custodial;
- wallet e vault sono distinti con precisione;
- stato PoC, development e vision non sono confusi;
- la DApp usa il deployment USDC corrente;
- approve/deposit/withdraw sono protetti da validazioni e conferme;
- il sito funziona anche senza wallet;
- responsive, tastiera, reduced-motion ed error state sono gestiti;
- la checklist è aggiornata;
- ogni modulo e procedura è documentato.

