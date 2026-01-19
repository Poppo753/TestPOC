# 📊 PROMPT per Generazione PowerPoint - Architettura DeFi Protocol

> **Istruzioni per IA**: Questo documento contiene tutte le informazioni necessarie per generare una presentazione PowerPoint completa. Ogni slide ha testo esatto da inserire e descrizione dettagliata dell'immagine da generare.

---

## INFORMAZIONI GENERALI

**Titolo Presentazione:** "Project4 - Aggregatore DeFi Modulare"
**Sottotitolo:** "Architettura Smart Contract su Arbitrum"
**Stile Grafico:** Professionale, tech/blockchain, colori blu/viola/verde acqua
**Network:** Arbitrum One (Layer 2 Ethereum)
**Totale Slide:** ~45

---

# CAPITOLO 1: INTRODUZIONE (3 slide)

---

## Slide 1.1 - Titolo e Cos'è il Protocollo

**TITOLO SLIDE:** "Project4 - Aggregatore DeFi Modulare"

**TESTO (bullet point):**
- Aggregatore DeFi modulare deployato su Arbitrum One
- Gestisce liquidità attraverso molteplici protocolli esterni in modo unificato
- **Multi-protocollo**: Integra Euler V2, Uniswap V3, GMX V2, Balancer
- **Modulare**: Plugin sostituibili senza modificare il codice core
- **Sicuro**: Multi-layer authentication, timelock 24h, circuit breakers

**IMMAGINE:** 
Creare un'immagine con:
- Al centro: logo stilizzato del protocollo (forma esagonale tech)
- Intorno disposti in cerchio i loghi di: Euler Finance, Uniswap, GMX, Balancer, Chainlink
- Frecce che collegano il logo centrale ai loghi esterni
- Sfondo: gradiente blu scuro con pattern blockchain/network

---

## Slide 1.2 - Principi Architetturali

**TITOLO SLIDE:** "Principi Architetturali"

**TESTO (3 box affiancati):**

**Box 1 - Separation of Concerns:**
- Ogni contratto ha una responsabilità singola
- Logica core separata dalla logica di integrazione
- Facilita manutenzione e audit

**Box 2 - Modularità:**
- Plugin sostituibili senza modificare il core
- Nuovi protocolli = nuovo plugin
- Upgrade tramite Beacon pattern

**Box 3 - Security First:**
- Custody centralizzata in un unico contratto
- Whitelist a più livelli (token, protocolli, funzioni)
- Timelock 24h su modifiche critiche
- Emergency pause e circuit breakers

**IMMAGINE:**
Diagramma a piramide con 3 livelli:
- LIVELLO 1 (alto): "UTENTI" con icona persone
- LIVELLO 2 (centro): "SMART CONTRACT CORE" - 9 box piccoli
- LIVELLO 3 (basso): "PLUGIN PROTOCOLLI" - box con loghi Euler, Uniswap, GMX
- LIVELLO 4 (base): "PROTOCOLLI ESTERNI" - Euler V2, Uniswap V3, GMX V2, Balancer, Chainlink

---

## Slide 1.3 - Architettura Overview

**TITOLO SLIDE:** "Architettura a 3 Layer"

**TESTO:** Minimo, solo etichette sui box del diagramma

**IMMAGINE (diagramma architettura completo):**
```
┌─────────────────────────────────────────────────────────────────┐
│                    UTENTI (LP Holders)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: ENTRY POINTS                        │
│   ┌─────────────────┐  ┌────────────┐  ┌────────────────────┐  │
│   │LiquidityManager │  │SwapManager │  │  ProtocolManager   │  │
│   │(Deposit/Withdraw│  │  (Swaps)   │  │(Lending/Yield)     │  │
│   └─────────────────┘  └────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 LAYER 2: CORE INFRASTRUCTURE                    │
│  ┌────────┐ ┌────────────┐ ┌───────────┐ ┌────────────────┐    │
│  │ Beacon │ │ProxyGeneral│ │TokenManager│ │ParameterManager│    │
│  └────────┘ └────────────┘ └───────────┘ └────────────────┘    │
│  ┌───────────────┐ ┌────────────────┐ ┌─────────────────┐      │
│  │ValueCalculator│ │EmergencyHandler│ │ChainlinkAdapter │      │
│  └───────────────┘ └────────────────┘ └─────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LAYER 3: PROTOCOL PLUGINS                      │
│  ┌──────────────┐ ┌────────────────┐ ┌───────────────┐         │
│  │EulerV2Plugin │ │UniswapV3Plugin │ │ GMXv2Plugin   │         │
│  │  (Lending)   │ │    (Swap)      │ │  (Trading)    │         │
│  └──────────────┘ └────────────────┘ └───────────────┘         │
│  ┌────────────────┐ ┌─────────────────┐                        │
│  │FlashLoanService│ │EulerVaultRegistry│                        │
│  └────────────────┘ └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PROTOCOLLI ESTERNI (Arbitrum One)                  │
│  [Euler V2] [Uniswap V3] [GMX V2] [Balancer] [Chainlink]       │
└─────────────────────────────────────────────────────────────────┘
```
Creare questo diagramma graficamente con box colorati, frecce e icone.

---

# CAPITOLO 2: SMART CONTRACT CORE (10 slide)

---

## Slide 2.1 - Panoramica Contratti Core

**TITOLO SLIDE:** "9 Smart Contract Core"

**TESTO:**
"I contratti core costituiscono l'infrastruttura fondamentale. Non interagiscono direttamente con protocolli esterni, ma forniscono le funzionalità base."

**IMMAGINE (griglia 3x3 con icone e nomi):**

| Beacon 🔍 | ProxyGeneral 🏦 | TokenManager 📋 |
|-----------|-----------------|-----------------|
| Registry Centrale | Custody Asset | Whitelist Token |

| ValueCalculator 📊 | ParameterManager ⚙️ | EmergencyHandler 🚨 |
|--------------------|---------------------|---------------------|
| Calcolo NAV | Governance | Emergenze |

| LiquidityManager 💧 | SwapManager 🔄 | ProtocolManager 🔌 |
|---------------------|----------------|---------------------|
| Entry Point Utenti | Orchestratore Swap | Orchestratore Lending |

Creare griglia visiva con icone stilizzate per ogni contratto.

---

## Slide 2.2 - Beacon

**TITOLO SLIDE:** "Beacon - Registry Centrale"

**TESTO (bullet point):**
- **Ruolo:** Registry centrale che mappa nomi moduli → indirizzi contratti
- **Come funziona:** Quando un contratto deve chiamare un altro modulo, chiede al Beacon "dove si trova X?" e ottiene l'indirizzo corrente
- **Vantaggio:** Permette upgrade dei moduli cambiando solo la registrazione nel Beacon, senza modificare i contratti che li chiamano
- **Sicurezza:** Freeze singolo modulo o freeze globale in emergenza

**Esempio mapping:**
```
"ProxyGeneral"  → 0x123...abc
"TokenManager"  → 0x456...def
"EulerV2Plugin" → 0x789...ghi
```

**IMMAGINE:**
Diagramma con:
- Box centrale "BEACON" (grande, evidenziato)
- Box "Contratto A" a sinistra che manda freccia "getImplementation('ProxyGeneral')" al Beacon
- Beacon risponde con freccia "0x123...abc" verso Contratto A
- Box "ProxyGeneral" a destra collegato con linea tratteggiata al Beacon

---

## Slide 2.3 - ProxyGeneral

**TITOLO SLIDE:** "ProxyGeneral - Il Caveau del Protocollo"

**TESTO (bullet point):**
- **Ruolo:** Custodisce TUTTI gli asset degli utenti in un unico punto sicuro
- **LP Token:** Emette LP Token quando utenti depositano, li brucia quando ritirano
- **Regola fondamentale:** NESSUN altro contratto detiene fondi - tutti gli asset qui
- **Sicurezza:** Solo moduli autorizzati possono operare, emergency pause disponibile
- **Rate Limiting:** Limiti su operazioni per prevenire exploit

**IMMAGINE:**
Icona grande di cassaforte/vault al centro con:
- Freccia verde IN da sinistra etichettata "Deposit Token → Mint LP"
- Freccia rossa OUT verso destra etichettata "Burn LP → Withdraw Token"
- Piccoli loghi token (ETH, USDC, ARB) dentro la cassaforte
- Badge "SOLO MODULI AUTORIZZATI" sopra

---

## Slide 2.4 - TokenManager

**TITOLO SLIDE:** "TokenManager - Whitelist Token"

**TESTO (bullet point):**
- **Ruolo:** Gestisce la whitelist dei token supportati dal protocollo
- **Mapping:** Per ogni token registra anche l'oracle Chainlink da usare per il prezzo
- **Controllo:** Se un token non è in whitelist, nessuna operazione è permessa
- **Sicurezza:** Solo l'Owner può aggiungere/rimuovere token (con timelock)

**IMMAGINE:**
Tabella visiva con 3 colonne:

| Token Code | Token Address | Oracle Chainlink |
|------------|---------------|------------------|
| WETH | 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 | ETH/USD Feed |
| USDC | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 | USDC/USD Feed |
| ARB | 0x912CE59144191C1204E64559FE8253a0e49E6548 | ARB/USD Feed |
| WBTC | 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f | BTC/USD Feed |

Badge verde "✓ WHITELISTED" accanto a ogni riga.

---

## Slide 2.5 - ValueCalculator

**TITOLO SLIDE:** "ValueCalculator - Calcolo NAV Pool"

**TESTO (bullet point):**
- **Ruolo:** Calcola il valore totale del pool (NAV - Net Asset Value)
- **Formula:** NAV = Σ(token liberi in ProxyGeneral) + Σ(posizioni nei protocolli esterni)
- **Sistema Cache:** Evita letture ridondanti degli oracle per risparmiare gas
- **Dipendenze:** Usa ChainlinkAdapter per i prezzi, LensAdapter per le posizioni

**IMMAGINE:**
Formula visiva grande:

```
NAV = [Token Liberi] + [Posizioni Protocolli]
         │                    │
         ▼                    ▼
    WETH: 10 ETH         Euler: 5 ETH depositati
    USDC: 50,000         GMX: 2 GM Token
    ARB: 100,000         
         │                    │
         ▼                    ▼
   $35,000 USD           $8,500 USD
         │                    │
         └────────┬───────────┘
                  ▼
          NAV TOTALE: $43,500 USD
```

---

## Slide 2.6 - ParameterManager

**TITOLO SLIDE:** "ParameterManager - Governance con Timelock"

**TESTO (bullet point):**
- **Ruolo:** Gestisce tutti i parametri configurabili del protocollo
- **Parametri:** Fee (0.1%-1%), limiti deposito/ritiro, soglie, slippage tollerance
- **Timelock 24h:** I parametri critici richiedono 24 ore di attesa prima di diventare effettivi
- **Perché timelock:** Dà tempo agli utenti di reagire a modifiche sospette prima che siano attive

**Esempio parametri:**
- `maxDeposit`: 100 ETH
- `withdrawalFee`: 0.1%
- `slippageTolerance`: 0.5%

**IMMAGINE:**
Timeline orizzontale:
```
[PROPOSTA]──────24 ore──────>[ESECUZIONE]
    │                              │
    ▼                              ▼
"maxDeposit = 200 ETH"     Parametro attivo
Timestamp: T0              Timestamp: T0 + 24h
```
Icona orologio grande al centro che mostra "24h"

---

## Slide 2.7 - EmergencyHandler

**TITOLO SLIDE:** "EmergencyHandler - Sistema di Emergenza"

**TESTO (bullet point):**
- **Ruolo:** Contiene le procedure di emergenza per proteggere i fondi
- **Pausa Globale:** Può fermare TUTTE le operazioni del protocollo istantaneamente
- **Ruolo Guardian:** Account speciale che può SOLO attivare la pausa (nessun altro potere)
- **Recovery:** Definisce procedure per recuperare dopo un'emergenza

**3 Livelli di stop:**
1. **Pause Globale** (ProxyGeneral) - Ferma tutto
2. **Freeze Modulo** (Beacon) - Ferma singolo modulo
3. **Circuit Breaker** (Plugin) - Ferma singolo plugin

**IMMAGINE:**
3 pulsanti di emergenza:
- Pulsante rosso grande "PAUSE GLOBALE" → Ferma tutto il protocollo
- Pulsante arancione medio "FREEZE MODULO" → Ferma es. "EulerV2Plugin"
- Pulsante giallo piccolo "CIRCUIT BREAKER" → Ferma operazione specifica

Stati: NORMAL (verde) → PAUSED (rosso) → RECOVERY (giallo) → NORMAL (verde)

---

## Slide 2.8 - LiquidityManager

**TITOLO SLIDE:** "LiquidityManager - Entry Point Utenti"

**TESTO (bullet point):**
- **Ruolo:** È l'UNICO punto di interazione per gli utenti normali
- **Deposit:** Utente deposita token supportati → riceve LP Token proporzionali
- **Withdraw:** Utente brucia LP Token → riceve quota proporzionale del pool
- **Calcolo LP:** Usa ValueCalculator per determinare quanti LP Token emettere/bruciare

**IMPORTANTE:** Gli utenti possono SOLO depositare e ritirare. Nessun controllo sulla gestione.

**IMMAGINE:**
Flusso orizzontale:

```
DEPOSITO:
[UTENTE] ──WETH──> [LiquidityManager] ──calcola NAV──> [ValueCalculator]
                          │
                          ▼
              [ProxyGeneral] ──mint──> [LP Token] ──> [UTENTE]

RITIRO:
[UTENTE] ──LP Token──> [LiquidityManager] ──calcola quota──> [ValueCalculator]
                          │
                          ▼
              [ProxyGeneral] ──burn LP, trasferisci token──> [UTENTE]
```

---

## Slide 2.9 - SwapManager

**TITOLO SLIDE:** "SwapManager - Orchestratore Swap"

**TESTO (bullet point):**
- **Ruolo:** Coordina gli swap tra token del pool
- **Non esegue direttamente:** Delega l'esecuzione ai plugin appropriati (es. UniswapV3Plugin)
- **Selezione plugin:** Può scegliere il plugin migliore in base a liquidità/prezzo
- **Whitelist:** Opera SOLO con token registrati in TokenManager

**Plugin Swap supportati:**
- UniswapV3PluginDirect (attivo)
- CurvePlugin (futuro)
- CamelotPlugin (futuro)

**IMMAGINE:**
SwapManager al centro con frecce verso:
- UniswapV3Plugin (con logo Uniswap)
- Box tratteggiato "CurvePlugin" (futuro)
- Box tratteggiato "CamelotPlugin" (futuro)

Sopra: "Richiesta: Swap 10 WETH → USDC"
Sotto: "Risposta: 35,000 USDC"

---

## Slide 2.10 - ProtocolManager

**TITOLO SLIDE:** "ProtocolManager - Orchestratore Lending/Yield"

**TESTO (bullet point):**
- **Ruolo:** Coordina TUTTE le operazioni sui protocolli esterni (lending, yield, trading)
- **Operazioni standard:** deposit, withdraw, borrow, repay
- **Delega a plugin:** EulerV2Plugin, GMXv2Plugin, etc.
- **Whitelist Selectors:** Per funzioni protocol-specific, solo i selector autorizzati possono essere chiamati

**Plugin Lending supportati:**
- EulerV2Plugin (lending + leverage)
- GMXv2Plugin (GM Token mint/burn)
- FlashLoanService (flash loan Balancer)

**IMMAGINE:**
ProtocolManager al centro con frecce verso:
- EulerV2Plugin (con logo Euler) → etichetta "deposit, withdraw, borrow, repay, leverage"
- GMXv2Plugin (con logo GMX) → etichetta "mintGM, burnGM"
- FlashLoanService (con logo Balancer) → etichetta "flash loan"

Badge "WHITELIST SELECTORS ✓" in alto a destra

---

# CAPITOLO 3: PLUGIN MODULARI (6 slide)

---

## Slide 3.1 - Tipologie di Plugin

**TITOLO SLIDE:** "Due Categorie di Plugin"

**TESTO:**

**🔄 PLUGIN SWAP (DEX)**
- Gestiscono scambio token attraverso DEX
- Implementano interfaccia `ISwapPlugin`
- Funzione principale: `executeSwap(tokenIn, tokenOut, amountIn, minAmountOut)`
- Esempio: UniswapV3PluginDirect

**🏦 PLUGIN LENDING/YIELD**
- Gestiscono depositi, prestiti, strategie yield
- Implementano interfaccia `ILendingProtocol`
- Funzioni: `deposit()`, `withdraw()`, `borrow()`, `repay()`
- Esempi: EulerV2Plugin, GMXv2Plugin

**IMMAGINE:**
Due colonne affiancate:

| 🔄 SWAP PLUGIN | 🏦 LENDING PLUGIN |
|----------------|-------------------|
| Scambia token | Deposita/Presta |
| ISwapPlugin | ILendingProtocol |
| UniswapV3Plugin | EulerV2Plugin |
| (futuro: Curve, Camelot) | GMXv2Plugin |

---

## Slide 3.2 - Plugin Swap - Interfaccia ISwapPlugin

**TITOLO SLIDE:** "Interfaccia ISwapPlugin"

**TESTO:**

```solidity
interface ISwapPlugin {
    // Esegue lo swap
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);
    
    // Quota il prezzo prima di swap
    function getExpectedOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 expectedOutput);
}
```

**Registrazione:** Il plugin viene registrato in SwapManager con un ID e priorità

**IMMAGINE:**
Box interfaccia stilizzato con i due metodi evidenziati:
- `executeSwap()` → icona frecce swap
- `getExpectedOutput()` → icona calcolatrice

---

## Slide 3.2.1 - UniswapV3PluginDirect

**TITOLO SLIDE:** "UniswapV3PluginDirect"

**TESTO (bullet point):**
- **Protocollo:** Integrazione diretta con Uniswap V3 su Arbitrum
- **Swap Single-hop:** WETH → USDC diretto
- **Swap Multi-hop:** WETH → USDC → ARB (attraverso più pool)
- **Quote:** Può quotare il prezzo atteso prima di eseguire lo swap
- **Fee Tier:** Supporta pool con fee 0.05%, 0.3%, 1%

**Indirizzi Arbitrum:**
- SwapRouter: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
- QuoterV2: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`

**IMMAGINE:**
Logo Uniswap grande + flusso:
```
[WETH] ──0.3% fee pool──> [USDC]
   │                         │
   └──0.05% fee──> [ARB] ───┘
         (multi-hop)
```

---

## Slide 3.3 - Plugin Lending - Interfaccia ILendingProtocol

**TITOLO SLIDE:** "Interfaccia ILendingProtocol"

**TESTO:**

```solidity
interface ILendingProtocol {
    // Deposita token come collateral
    function deposit(string memory tokenCode, uint256 amount) external;
    
    // Ritira token depositati
    function withdraw(string memory tokenCode, uint256 amount) external;
    
    // Prende in prestito token
    function borrow(string memory tokenCode, uint256 amount) external;
    
    // Ripaga prestito
    function repay(string memory tokenCode, uint256 amount) external;
}
```

**Nota:** Funzioni protocol-specific (es. leverage) sono esposte tramite whitelist di function selectors

**IMMAGINE:**
Box con 4 metodi disposti a croce:
- ↓ `deposit()` (freccia verde in entrata)
- ↑ `withdraw()` (freccia rossa in uscita)
- → `borrow()` (freccia blu verso destra)
- ← `repay()` (freccia arancione verso sinistra)

---

## Slide 3.3.1 - EulerV2Plugin

**TITOLO SLIDE:** "EulerV2Plugin - Lending & Leverage"

**TESTO (bullet point):**
- **Protocollo:** Integrazione completa con Euler V2 su Arbitrum
- **Operazioni base:** deposit, withdraw, borrow, repay
- **Leverage:** Supporta apertura/chiusura posizioni leverage atomiche
- **Sub-Account Model:** 256 sub-account (0-255) per isolare posizioni
  - Sub-Account 0: Depositi semplici (yield farming)
  - Sub-Account 1-255: Posizioni leverage isolate

**Indirizzi Arbitrum:**
- EVC (Controller): `0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066`
- WETH Vault: `0x78E3E051D32157AACD550fBB78458762d8f7edFF`
- USDC Vault: `0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899`

**IMMAGINE:**
Logo Euler + diagramma sub-account:
```
┌─────────────────────────────────────┐
│         EULER V2 PLUGIN             │
├─────────────────────────────────────┤
│ Sub-Account 0: Yield (no leverage)  │
│ Sub-Account 1: Posizione Leverage 1 │
│ Sub-Account 2: Posizione Leverage 2 │
│ ...                                 │
│ Sub-Account 255: Posizione N        │
└─────────────────────────────────────┘
```

---

## Slide 3.4 - Plugin Utility: FlashLoanService

**TITOLO SLIDE:** "FlashLoanService - Leverage Atomico"

**TESTO (bullet point):**
- **Protocollo:** Integrazione con Balancer per flash loan
- **Scopo:** Permette strategie leverage atomiche (tutto in una transazione)
- **Come funziona:**
  1. Prende in prestito da Balancer (fee ~0%)
  2. Esegue operazioni (deposit, borrow, swap)
  3. Ripaga Balancer nella stessa transazione
- **Atomicità:** Se una qualsiasi operazione fallisce, TUTTO viene annullato

**Indirizzo Balancer Vault:** `0xBA12222222228d8Ba445958a75a0704d566BF2C8`

**IMMAGINE:**
Flusso circolare:
```
     ┌────────────────────────────────────────┐
     │           STESSA TRANSAZIONE           │
     │                                        │
[Balancer]──flash loan──>[Plugin]             │
     │                      │                 │
     │                      ▼                 │
     │              deposit collateral        │
     │              borrow                    │
     │              swap                      │
     │              deposit extra             │
     │                      │                 │
     │                      ▼                 │
     └◄────repay + fee────[Plugin]            │
     │                                        │
     └────────────────────────────────────────┘
```

---

# CAPITOLO 4: PATTERN 3 MUSKETEERS (5 slide)

---

## Slide 4.1 - Panoramica Pattern

**TITOLO SLIDE:** "Pattern 3 Musketeers"

**TESTO:**
Per integrare un nuovo protocollo di lending, servono **3 componenti** che lavorano insieme:

1. **Plugin** (Il "Braccio" 💪) - Esegue le operazioni
2. **LensAdapter** (Gli "Occhi" 👁️) - Legge lo stato
3. **Registry** (La "Mappa" 🗺️) - Mappa token → vault

**Perché questo pattern?**
- Separazione delle responsabilità
- Riusabilità dei componenti
- Testabilità indipendente
- Sicurezza: letture separate da scritture

**IMMAGINE:**
3 personaggi stilizzati (moschettieri) collegati:
```
    💪 PLUGIN          👁️ LENS           🗺️ REGISTRY
   (Il Braccio)      (Gli Occhi)        (La Mappa)
        │                │                   │
        │                │                   │
        └────────────────┴───────────────────┘
                         │
                    LAVORANO INSIEME
```

---

## Slide 4.2 - Plugin (Il Braccio)

**TITOLO SLIDE:** "Plugin - Il Braccio 💪"

**TESTO (bullet point):**
- **Ruolo:** Esegue le operazioni effettive sul protocollo esterno
- **Contenuto:** Logica per deposit, withdraw, borrow, repay
- **Conoscenza:** Conosce gli indirizzi dei contratti del protocollo target
- **Azione:** Chiama direttamente i contratti esterni

**Esempio - EulerV2Plugin:**
```solidity
function deposit(string memory tokenCode, uint256 amount) external {
    address vault = registry.getVault(tokenCode);
    IERC20(token).approve(vault, amount);
    IEVault(vault).deposit(amount, address(this));
}
```

**IMMAGINE:**
Braccio robotico stilizzato che:
- Prende token da "ProxyGeneral"
- Li deposita in "Euler Vault"
- Frecce che mostrano il flusso

---

## Slide 4.3 - LensAdapter (Gli Occhi)

**TITOLO SLIDE:** "LensAdapter - Gli Occhi 👁️"

**TESTO (bullet point):**
- **Ruolo:** Legge lo stato delle posizioni nel protocollo esterno
- **Funzione principale:** `getPositionValue(tokenCode)` → valore in USD
- **Consumer:** Fornisce dati a ValueCalculator per calcolare il NAV
- **Read-only:** Non modifica nulla, solo letture

**Esempio - EulerLensAdapter:**
```solidity
function getPositionValue(string memory tokenCode) external view returns (uint256) {
    address vault = registry.getVault(tokenCode);
    uint256 shares = IEVault(vault).balanceOf(address(proxyGeneral));
    uint256 assets = IEVault(vault).convertToAssets(shares);
    uint256 price = oracle.getPrice(tokenCode);
    return assets * price / 1e18;
}
```

**IMMAGINE:**
Occhio/lente stilizzato che osserva:
- Box "Euler Vault" con numeri (5 ETH depositati)
- Freccia verso "ValueCalculator" con "$8,500 USD"

---

## Slide 4.4 - Registry (La Mappa)

**TITOLO SLIDE:** "Registry - La Mappa 🗺️"

**TESTO (bullet point):**
- **Ruolo:** Mappa ogni token supportato al suo vault/pool nel protocollo
- **Contenuto:** Per ogni token code, indica quale vault usare
- **Configurazione:** Può essere on-chain o basato su registry del protocollo
- **Sicurezza:** Solo vault autorizzati sono mappati

**Esempio - EulerVaultRegistry:**

| Token Code | Token Address | Euler Vault |
|------------|---------------|-------------|
| WETH | 0x82aF...Bab1 | 0x78E3...dFF (eWETH) |
| USDC | 0xaf88...5831 | 0x0a1e...899 (eUSDC) |
| ARB | 0x912C...6548 | 0x2a3b...123 (eARB) |

**IMMAGINE:**
Mappa stilizzata con:
- Punti "WETH", "USDC", "ARB" a sinistra
- Frecce che puntano a "eWETH Vault", "eUSDC Vault", "eARB Vault" a destra
- Etichetta "SOLO VAULT AUTORIZZATI"

---

## Slide 4.5 - Vantaggi del Pattern

**TITOLO SLIDE:** "Vantaggi del Pattern 3 Musketeers"

**TESTO (4 box):**

**1. Separazione Responsabilità**
- Ogni componente fa una cosa sola
- Plugin: scrive
- Lens: legge
- Registry: mappa

**2. Riusabilità**
- Stesso LensAdapter può servire più plugin
- Registry condiviso tra componenti

**3. Testabilità**
- Mock di ogni componente indipendentemente
- Unit test isolati

**4. Sicurezza**
- Letture (Lens) separate da scritture (Plugin)
- Registry limita vault autorizzati

**IMMAGINE:**
4 icone con checkmark verde:
- ✓ Separazione
- ✓ Riusabilità
- ✓ Testabilità
- ✓ Sicurezza

Sotto: diagramma con 3 box separati ma collegati da linee

---

# CAPITOLO 5: AGGIUNGERE NUOVI PROTOCOLLI (3 slide)

---

## Slide 5.1 - Nuovo Swap Plugin

**TITOLO SLIDE:** "Come Aggiungere un Nuovo DEX"

**TESTO:**

**3 Step Semplici:**

**Step 1️⃣ - Crea il Plugin**
```solidity
contract CurvePlugin is ISwapPlugin {
    function executeSwap(...) external returns (uint256) {
        // Logica Curve-specifica
    }
}
```

**Step 2️⃣ - Implementa executeSwap()**
- Interagisci con i contratti Curve
- Gestisci approvazioni e slippage

**Step 3️⃣ - Registra in SwapManager**
```solidity
swapManager.registerPlugin("curve", curvePluginAddress);
```

✅ **Fatto!** SwapManager può ora usare Curve per gli swap

**IMMAGINE:**
Checklist con 3 step e checkmark:
- ☑️ Implementa ISwapPlugin
- ☑️ Crea executeSwap()
- ☑️ Registra in SwapManager

---

## Slide 5.2 - Nuovo Lending Plugin

**TITOLO SLIDE:** "Come Aggiungere un Nuovo Lending (Pattern 3 Musketeers)"

**TESTO:**

**4 Step - Pattern Completo:**

**Step 1️⃣ - Crea il Registry**
```solidity
contract AaveVaultRegistry {
    mapping(string => address) public vaults;
    // WETH → aWETH, USDC → aUSDC, ...
}
```

**Step 2️⃣ - Crea il LensAdapter**
```solidity
contract AaveLensAdapter is ILensAdapter {
    function getPositionValue(string memory tokenCode) external view returns (uint256);
}
```

**Step 3️⃣ - Crea il Plugin**
```solidity
contract AavePlugin is ILendingProtocol {
    function deposit(...) external;
    function withdraw(...) external;
    function borrow(...) external;
    function repay(...) external;
}
```

**Step 4️⃣ - Registra Tutto**
- Plugin in ProtocolManager
- LensAdapter in ValueCalculator
- Registry nel Plugin

**IMMAGINE:**
Flowchart verticale con 4 step collegati da frecce

---

## Slide 5.3 - Registrazione Moduli

**TITOLO SLIDE:** "Registrazione nei Contratti Core"

**TESTO:**

**3 Registrazioni Necessarie:**

**1. Beacon** - Registra indirizzo modulo
```solidity
beacon.updateImplementation("AavePlugin", 0x123...);
```

**2. ProtocolManager** - Registra plugin con ID
```solidity
protocolManager.registerProtocol("aave", aavePluginAddress);
```

**3. ValueCalculator** - Registra LensAdapter
```solidity
valueCalculator.registerLens("aave", aaveLensAddress);
```

**IMMAGINE:**
3 box con frecce "registra in":
```
[AavePlugin] ──registra──> [Beacon]
[AavePlugin] ──registra──> [ProtocolManager]
[AaveLensAdapter] ──registra──> [ValueCalculator]
```

---

# CAPITOLO 6: MODELLO DI SICUREZZA (8 slide)

---

## Slide 6.1 - Separazione Utente/Admin

**TITOLO SLIDE:** "Principio Fondamentale: Separazione Ruoli"

**TESTO:**

**Il protocollo implementa una SEPARAZIONE NETTA:**

| 👤 UTENTE | 🔧 ADMIN |
|-----------|----------|
| Può SOLO depositare e ritirare | Gestisce la liquidità |
| Nessun controllo sulla gestione | MA è VINCOLATO |
| Il protocollo è una "black box" | Opera solo nel "recinto" autorizzato |

**Risultato:**
- L'utente è protetto: può sempre ritirare la sua quota
- L'admin non può rubare: può solo muovere fondi tra destinazioni pre-autorizzate

**IMMAGINE:**
Due figure stilizzate:
- Sinistra: Utente semplice con frecce solo verso "DEPOSIT" e "WITHDRAW"
- Destra: Admin con catene/vincoli, dentro un recinto

---

## Slide 6.2 - Ruolo Utente

**TITOLO SLIDE:** "Ruolo Utente - Azioni Permesse"

**TESTO:**

**✅ COSA PUÒ FARE L'UTENTE:**
- Depositare token supportati (WETH, USDC, ARB, ...)
- Ricevere LP Token proporzionali al deposito
- Bruciare LP Token per ritirare
- Ricevere quota proporzionale del pool

**❌ COSA NON PUÒ FARE L'UTENTE:**
- Scegliere su quali protocolli allocare
- Influenzare le strategie di gestione
- Modificare parametri del protocollo
- Accedere direttamente ai protocolli esterni

**Punto di vista utente:** "Black box" - deposita, tiene LP Token, ritira quando vuole.

**IMMAGINE:**
Utente stilizzato con:
- Freccia verde → "DEPOSIT" → LP Token
- Freccia rossa ← "WITHDRAW" ← Token
- X rosse su "Strategie", "Parametri", "Protocolli"

---

## Slide 6.3 - Ruolo Admin/Operator

**TITOLO SLIDE:** "Ruolo Admin - Vincolato al Recinto"

**TESTO:**

**L'admin può gestire la liquidità MA è vincolato da 5 livelli:**

1. **Solo Token Whitelistati**
   - Può operare SOLO con token in TokenManager (WETH, USDC, ARB, ...)

2. **Solo Protocolli Registrati**
   - Può usare SOLO plugin registrati in Beacon (Euler, Uniswap, GMX)

3. **Solo Vault Censiti**
   - Può interagire SOLO con vault mappati nei Registry (eWETH, eUSDC, ...)

4. **Solo Funzioni Autorizzate**
   - Per operazioni protocol-specific, solo selector whitelistati

5. **Timelock su Modifiche**
   - Cambiare parametri critici richiede 24h di attesa

**IMMAGINE:**
Admin stilizzato DENTRO un recinto con 5 muri etichettati con i vincoli

---

## Slide 6.4 - Il "Recinto" di Sicurezza

**TITOLO SLIDE:** "Il Recinto - Confini dell'Admin"

**TESTO:**

**L'admin opera LIBERAMENTE ma SOLO dentro questi confini:**

```
┌─────────────────────────────────────────────────────────────┐
│                      RECINTO SICURO                          │
│                                                              │
│  Token Whitelistati: WETH, USDC, ARB, WBTC                  │
│  Protocolli Censiti: Euler V2, Uniswap V3, GMX V2           │
│  Vault Autorizzati: eUSDC, eWETH, eARB, GM-ETH-USDC         │
│  Funzioni Permesse: deposit, withdraw, swap, borrow, repay  │
│                                                              │
│          ✅ Admin può operare liberamente QUI DENTRO        │
└─────────────────────────────────────────────────────────────┘
                 ❌ Admin NON può uscire dal recinto
```

**Cosa significa:**
- ❌ NON può trasferire fondi a indirizzi arbitrari
- ❌ NON può approvare token verso contratti non censiti
- ❌ NON può chiamare funzioni non autorizzate

**IMMAGINE:**
Recinto stilizzato con 4 muri (Token, Protocolli, Vault, Funzioni) e admin dentro

---

## Slide 6.5 - Gerarchia Ruoli

**TITOLO SLIDE:** "Gerarchia dei Ruoli"

**TESTO (tabella):**

| Ruolo | Può fare | NON può fare |
|-------|----------|--------------|
| **Owner** | Registrare moduli, modificare parametri (con timelock 24h) | Bypassare timelock, prelevare fondi direttamente |
| **Operator** | Ribilanciare tra protocolli censiti, harvest yield | Aggiungere protocolli, modificare whitelist |
| **Guardian** | Attivare pausa emergenza | Qualsiasi operazione sui fondi |
| **User** | Depositare e ritirare via LiquidityManager | Influenzare gestione liquidità |

**IMMAGINE:**
Piramide con 4 livelli:
- Top: 👑 Owner
- 2°: 🔧 Operator
- 3°: 🛡️ Guardian
- Base: 👤 Users (molti)

---

## Slide 6.6 - Custody Model

**TITOLO SLIDE:** "Custody Model - ProxyGeneral Centrale"

**TESTO (bullet point):**

**Regola fondamentale:** TUTTI i fondi risiedono in ProxyGeneral

- **ProxyGeneral:** Unico contratto che detiene asset
- **Plugin:** Stateless, non detengono MAI fondi
- **Operazioni:** Plugin operano "per conto di" ProxyGeneral
- **Approvazioni:** Temporanee, solo per l'operazione specifica

**Vantaggi:**
- Single point of custody = più facile da proteggere
- Plugin compromesso = fondi ancora al sicuro in ProxyGeneral
- Audit semplificato

**IMMAGINE:**
ProxyGeneral (cassaforte grande) al centro, con plugin (satelliti piccoli) intorno che operano MA i fondi restano nella cassaforte

---

## Slide 6.7 - Timelock Governance

**TITOLO SLIDE:** "Timelock 24h - Protezione Parametri"

**TESTO (bullet point):**

**Come funziona:**
1. Owner propone modifica parametro critico
2. Proposta registrata con timestamp
3. **Attesa obbligatoria 24 ore**
4. Solo dopo 24h può essere eseguita

**Perché è importante:**
- Dà tempo agli utenti di vedere la proposta
- Se modifica è sospetta/malevola → utenti possono ritirare
- Guardian può attivare pausa se necessario

**Parametri con timelock:**
- maxDeposit, maxWithdraw
- Fee rates
- Nuovi moduli/plugin

**IMMAGINE:**
Timeline orizzontale:
```
T0: Proposta          T0+24h: Esecuzione
    │                      │
    ▼                      ▼
[PROPOSTA] ───⏰ 24h───> [ATTIVA]
    │
    └── Utenti possono reagire
```

---

## Slide 6.8 - Emergency System

**TITOLO SLIDE:** "Sistema di Emergenza - 3 Livelli"

**TESTO:**

**3 Livelli di Stop Progressivi:**

**Livello 1 - Pause Globale (ProxyGeneral)**
- Ferma TUTTE le operazioni del protocollo
- Attivabile da: Owner, Guardian
- Uso: Exploit rilevato, emergenza critica

**Livello 2 - Freeze Modulo (Beacon)**
- Ferma UN singolo modulo (es. EulerV2Plugin)
- Attivabile da: Owner
- Uso: Problema isolato in un plugin

**Livello 3 - Circuit Breaker (Plugin)**
- Ferma operazioni specifiche in un plugin
- Attivabile da: Plugin stesso (automatico) o Owner
- Uso: Anomalia rilevata (es. prezzo oracle anomalo)

**IMMAGINE:**
3 pulsanti di emergenza di dimensioni decrescenti:
- 🔴 Grande: "PAUSE GLOBALE" - ferma tutto
- 🟠 Medio: "FREEZE MODULO" - ferma un modulo
- 🟡 Piccolo: "CIRCUIT BREAKER" - ferma operazione

---

# CAPITOLO 7: FLUSSI OPERATIVI (5 slide)

---

## Slide 7.1 - Flusso Deposito Utente

**TITOLO SLIDE:** "Flusso: Deposito Utente"

**TESTO:**

**Step del deposito:**

1. **Utente** chiama `LiquidityManager.deposit(WETH, 10 ether)`
2. **LiquidityManager** chiede a **ValueCalculator** il NAV attuale
3. **ValueCalculator** calcola: $43,500 USD totali
4. **LiquidityManager** calcola LP da emettere in proporzione
5. **ProxyGeneral** trasferisce 10 WETH dall'utente
6. **ProxyGeneral** mint LP Token all'utente

**Risultato:** Utente ha LP Token che rappresentano la sua quota del pool

**IMMAGINE:**
Flowchart orizzontale:
```
[UTENTE]──10 WETH──>[LiquidityManager]──NAV?──>[ValueCalculator]
                           │                        │
                           │◄───$43,500 USD─────────┘
                           │
                           ▼
                    [ProxyGeneral]
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              trasferisce    mint LP
              10 WETH        ──────> [UTENTE]
```

---

## Slide 7.2 - Flusso Ritiro Utente

**TITOLO SLIDE:** "Flusso: Ritiro Utente"

**TESTO:**

**Step del ritiro:**

1. **Utente** chiama `LiquidityManager.withdraw(lpAmount)`
2. **LiquidityManager** chiede a **ValueCalculator** il NAV attuale
3. **ValueCalculator** calcola: $50,000 USD totali
4. **LiquidityManager** calcola quota proporzionale dell'utente
5. **ProxyGeneral** brucia LP Token dell'utente
6. **ProxyGeneral** trasferisce token proporzionali all'utente

**Nota:** Se necessario, SwapManager converte token per dare all'utente il tipo richiesto

**IMMAGINE:**
Flowchart orizzontale (inverso al deposito):
```
[UTENTE]──LP Token──>[LiquidityManager]──NAV?──>[ValueCalculator]
                           │                        │
                           │◄───$50,000 USD─────────┘
                           │
                           ▼
                    [ProxyGeneral]
                           │
                    ┌──────┴──────┐
                    ▼             ▼
                burn LP      trasferisce
                Token        token ──────> [UTENTE]
```

---

## Slide 7.3 - Flusso Admin: Swap

**TITOLO SLIDE:** "Flusso: Swap Token (Admin)"

**TESTO:**

**Step dello swap:**

1. **Operator** chiama `SwapManager.swap(WETH, USDC, 10 ether)`
2. **SwapManager** verifica: WETH in whitelist? ✅
3. **SwapManager** verifica: USDC in whitelist? ✅
4. **SwapManager** seleziona **UniswapV3Plugin**
5. **ProxyGeneral** approva WETH verso Uniswap
6. **UniswapV3Plugin** esegue swap su Uniswap V3
7. **ProxyGeneral** riceve USDC

**Checkpoint sicurezza:** Token non whitelistati = operazione RIFIUTATA

**IMMAGINE:**
Flowchart con checkpoint:
```
[Operator]──swap──>[SwapManager]
                        │
                  ┌─────┴─────┐
                  ▼           ▼
            [WETH ✅]    [USDC ✅]  ← Whitelist check
                  │           │
                  └─────┬─────┘
                        ▼
              [UniswapV3Plugin]
                        │
                        ▼
                  [Uniswap V3]
                        │
                        ▼
             [ProxyGeneral riceve USDC]
```

---

## Slide 7.4 - Flusso Admin: Deposit Lending

**TITOLO SLIDE:** "Flusso: Deposit su Lending (Admin)"

**TESTO:**

**Step del deposit su Euler:**

1. **Operator** chiama `ProtocolManager.deposit("euler", "WETH", 10 ether)`
2. **ProtocolManager** verifica: "euler" registrato? ✅
3. **ProtocolManager** chiama **EulerV2Plugin**
4. **EulerV2Plugin** verifica: WETH vault in Registry? ✅
5. **ProxyGeneral** approva WETH verso Euler Vault
6. **EulerV2Plugin** deposita in Euler V2
7. **ProxyGeneral** ora possiede eWETH (shares)

**Doppio checkpoint:** Protocollo registrato + Vault censito

**IMMAGINE:**
Flowchart con 2 checkpoint:
```
[Operator]──deposit──>[ProtocolManager]
                            │
                      [euler ✅] ← Protocollo registrato
                            │
                            ▼
                    [EulerV2Plugin]
                            │
                      [WETH vault ✅] ← Vault censito
                            │
                            ▼
                      [Euler V2]
                            │
                            ▼
              [ProxyGeneral possiede eWETH]
```

---

## Slide 7.5 - Flusso Admin: Strategia Leverage

**TITOLO SLIDE:** "Flusso: Strategia Leverage con Flash Loan"

**TESTO:**

**Step della strategia leverage (tutto in 1 transazione):**

1. **Operator** avvia strategia leverage
2. **FlashLoanService** prende in prestito 100 WETH da Balancer
3. **EulerV2Plugin** deposita 100 WETH come collateral ✅ vault censito
4. **EulerV2Plugin** prende in prestito 50,000 USDC ✅ funzione autorizzata
5. **SwapManager** swappa 50,000 USDC → 30 WETH ✅ token whitelistati
6. **EulerV2Plugin** deposita 30 WETH extra ✅ vault censito
7. **FlashLoanService** ripaga 100 WETH a Balancer

**Risultato:** Posizione leverage 130 WETH collateral, 50k USDC debt

**IMMAGINE:**
Flusso circolare complesso:
```
                    ┌──────────────────────────────────────┐
                    │         STESSA TRANSAZIONE           │
                    │                                      │
[Balancer]──100 WETH──>[FlashLoanService]                 │
    ▲                        │                             │
    │                        ▼                             │
    │               [EulerV2Plugin]                        │
    │                   deposit ✅                         │
    │                   borrow USDC ✅                     │
    │                        │                             │
    │                        ▼                             │
    │               [SwapManager]                          │
    │                   USDC→WETH ✅                       │
    │                        │                             │
    │                        ▼                             │
    │               [EulerV2Plugin]                        │
    │                   deposit extra ✅                   │
    │                        │                             │
    └───repay 100 WETH◄──────┘                             │
                    │                                      │
                    └──────────────────────────────────────┘
```

---

# APPENDICI (4 slide)

---

## Slide A - Indirizzi Contratti Arbitrum

**TITOLO SLIDE:** "Indirizzi Contratti - Arbitrum One"

**TESTO (tabella):**

**Contratti Core:**
| Contratto | Indirizzo |
|-----------|-----------|
| Beacon | [da completare dopo deploy] |
| ProxyGeneral | [da completare dopo deploy] |
| TokenManager | [da completare dopo deploy] |
| LiquidityManager | [da completare dopo deploy] |

**Protocolli Esterni:**
| Protocollo | Contratto | Indirizzo |
|------------|-----------|-----------|
| Euler V2 | EVC | 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066 |
| Euler V2 | WETH Vault | 0x78E3E051D32157AACD550fBB78458762d8f7edFF |
| Euler V2 | USDC Vault | 0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899 |
| Uniswap V3 | SwapRouter | 0xE592427A0AEce92De3Edee1F18E0157C05861564 |
| Balancer | Vault | 0xBA12222222228d8Ba445958a75a0704d566BF2C8 |

---

## Slide B - Interfacce Principali

**TITOLO SLIDE:** "Interfacce Chiave"

**TESTO:**

**ISwapPlugin:**
```solidity
function executeSwap(tokenIn, tokenOut, amountIn, minAmountOut) returns (uint256);
function getExpectedOutput(tokenIn, tokenOut, amountIn) view returns (uint256);
```

**ILendingProtocol:**
```solidity
function deposit(tokenCode, amount) external;
function withdraw(tokenCode, amount) external;
function borrow(tokenCode, amount) external;
function repay(tokenCode, amount) external;
```

**ILensAdapter:**
```solidity
function getPositionValue(tokenCode) view returns (uint256 valueUSD);
```

---

## Slide C - Glossario

**TITOLO SLIDE:** "Glossario"

**TESTO (definizioni):**

| Termine | Definizione |
|---------|-------------|
| **NAV** | Net Asset Value - Valore totale del pool in USD |
| **LP Token** | Token che rappresenta la quota dell'utente nel pool |
| **Beacon** | Pattern per registrare e aggiornare indirizzi moduli |
| **Timelock** | Ritardo obbligatorio (24h) prima che una modifica diventi attiva |
| **Whitelist** | Lista di elementi autorizzati (token, protocolli, funzioni) |
| **Circuit Breaker** | Meccanismo che ferma operazioni in caso di anomalia |
| **Flash Loan** | Prestito che deve essere ripagato nella stessa transazione |
| **Selector** | Identificatore di 4 byte di una funzione Solidity |

---

## Slide D - Q&A

**TITOLO SLIDE:** "Domande?"

**TESTO:**
- Grazie per l'attenzione
- Contatti: [inserire]
- Repository: [inserire]
- Documentazione: [inserire]

**IMMAGINE:**
Logo protocollo grande al centro con icona "?" e contatti

---

# 📋 RIEPILOGO FINALE

| Capitolo | N° Slide |
|----------|----------|
| 1. Introduzione | 3 |
| 2. Smart Contract Core | 10 |
| 3. Plugin Modulari | 6 |
| 4. Pattern 3 Musketeers | 5 |
| 5. Aggiungere Protocolli | 3 |
| 6. Modello di Sicurezza | 8 |
| 7. Flussi Operativi | 5 |
| Appendici | 4 |
| **TOTALE** | **44** |

---

*Prompt per generazione PowerPoint - Versione 1.0 - Gennaio 2026*
