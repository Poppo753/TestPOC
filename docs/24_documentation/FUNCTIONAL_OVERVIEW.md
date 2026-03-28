# 📘 Overview Funzionale del Protocollo

## Introduzione

Il protocollo è un **aggregatore DeFi modulare** che permette di gestire liquidità attraverso molteplici protocolli esterni (lending, swap, trading) in modo unificato. L'architettura separa nettamente la logica core dalla logica di integrazione, permettendo di aggiungere nuovi protocolli senza modificare il codice esistente.

---

## 🏛️ Struttura a Due Livelli

### Livello 1: Smart Contract Core

I contratti core costituiscono l'infrastruttura fondamentale del protocollo. Non interagiscono direttamente con protocolli esterni, ma forniscono le funzionalità base:

- **Beacon**: È il registro centrale del sistema. Ogni modulo è registrato con un nome e un indirizzo. Quando un contratto deve chiamare un altro modulo, chiede al Beacon "dove si trova X?" e ottiene l'indirizzo corrente. Questo permette di aggiornare i moduli cambiando solo la registrazione nel Beacon.

- **ProxyGeneral**: È il "caveau" del protocollo. Tutti gli asset degli utenti sono custoditi qui. Emette LP Token agli utenti quando depositano e li brucia quando ritirano. Nessun altro contratto detiene fondi.

- **TokenManager**: Gestisce la whitelist dei token supportati dal protocollo. Per ogni token registra anche l'oracle da usare per ottenere il prezzo.

- **ValueCalculator**: Calcola il valore totale del pool sommando tutti gli asset (token liberi + posizioni nei protocolli). Usa un sistema di cache per evitare letture ridondanti degli oracle.

- **ParameterManager**: Gestisce tutti i parametri configurabili del protocollo (fee, limiti, soglie). I parametri critici richiedono un timelock di 24 ore prima di diventare effettivi.

- **EmergencyHandler**: Contiene le procedure di emergenza. Può mettere in pausa il protocollo e definisce chi può eseguire azioni di recovery.

- **LiquidityManager**: È l'entry point principale per gli utenti. Gestisce depositi e prelievi, calcola quanti LP Token emettere/bruciare.

- **SwapManager**: Coordina gli swap tra token. Non esegue swap direttamente, ma delega ai plugin appropriati.

- **ProtocolManager**: Coordina le operazioni sui protocolli esterni (deposit, withdraw, borrow, repay). Come SwapManager, delega l'esecuzione effettiva ai plugin.

---

### Livello 2: Smart Contract Modulari (Plugin)

I plugin sono contratti specializzati che sanno come interagire con uno specifico protocollo esterno. Si dividono in due categorie principali:

#### 🔄 Plugin di Swap

Questi plugin gestiscono lo scambio di token attraverso DEX.

**Caratteristiche comuni:**
- Implementano l'interfaccia `ISwapPlugin`
- Funzione principale: `executeSwap(tokenIn, tokenOut, amountIn, minAmountOut)`
- Sono registrati in SwapManager con una priorità (quale usare per default)

**Esempio: UniswapV3PluginDirect**
- Interagisce direttamente con Uniswap V3
- Supporta swap single-hop e multi-hop
- Può quotare il prezzo prima di eseguire lo swap

#### 🏦 Plugin di Lending/Yield

Questi plugin gestiscono depositi, prestiti e strategie di yield su protocolli di lending.

**Caratteristiche comuni:**
- Implementano l'interfaccia `ILendingProtocol`
- Funzioni principali: `deposit()`, `withdraw()`, `borrow()`, `repay()`
- Possono esporre funzioni specifiche del protocollo tramite whitelist di selectors

**Esempi:**
- **EulerV2Plugin**: Integra Euler V2 per lending e leverage
- **DolomitePlugin** (in sviluppo): Integrerà Dolomite per margin trading
- **GMXv2Plugin**: Integra GMX V2 per GM Token (liquidity provision su perps)

---

## 🎭 Il Pattern "3 Musketeers"

Per integrare un nuovo protocollo di lending, il sistema richiede **tre componenti** che lavorano insieme:

### 1. Plugin (Il "Braccio")
Il contratto che esegue le operazioni sul protocollo esterno.
- Contiene la logica per deposit, withdraw, borrow, repay
- Conosce gli indirizzi dei contratti del protocollo target
- Esegue le chiamate effettive

### 2. LensAdapter (Gli "Occhi")
Il contratto che legge lo stato delle posizioni.
- Interroga il protocollo per sapere quanto abbiamo depositato
- Calcola il valore in USD delle posizioni
- Fornisce dati a ValueCalculator per il NAV del pool

### 3. Registry (La "Mappa")
Il contratto che mappa token → vault/pool del protocollo.
- Per ogni token supportato, indica quale vault usare
- Può essere on-chain o basato su registry esistenti del protocollo

**Perché questo pattern?**
- **Separazione delle responsabilità**: Ogni componente fa una cosa sola
- **Riusabilità**: Lo stesso LensAdapter può servire più plugin
- **Testabilità**: Si può mockare ogni componente indipendentemente
- **Sicurezza**: Le letture (Lens) sono separate dalle scritture (Plugin)

---

## 🔌 Come Aggiungere un Nuovo Protocollo

### Per un nuovo DEX (Swap Plugin)

1. Creare un contratto che implementa `ISwapPlugin`
2. Implementare `executeSwap()` con la logica specifica del DEX
3. Registrare il plugin in SwapManager
4. Fatto! SwapManager può ora usarlo per gli swap

### Per un nuovo Lending Protocol

1. **Creare il Registry** (se non esiste)
   - Mappare token supportati → vault/pool del protocollo
   
2. **Creare il LensAdapter**
   - Implementare `ILensAdapter`
   - Funzione `getPositionValue(token)` che ritorna il valore in USD
   
3. **Creare il Plugin**
   - Implementare `ILendingProtocol`
   - Implementare deposit/withdraw/borrow/repay
   - Eventualmente esporre funzioni protocol-specific con whitelist
   
4. **Registrazione**
   - Registrare il plugin in ProtocolManager con un ID univoco
   - Registrare il LensAdapter in ValueCalculator

---

## 🛡️ Sicurezza e Controllo Accessi

### Separazione Netta: Utente vs Admin

Il protocollo implementa una **separazione netta** tra le azioni degli utenti e quelle degli amministratori:

#### 👤 Utente (Depositante)
L'utente ha un ruolo estremamente limitato e sicuro:
- **Può solo depositare** token supportati e ricevere LP Token
- **Può solo ritirare** bruciando LP Token e ricevendo token proporzionali
- **Non può** influenzare come vengono gestiti i fondi
- **Non può** scegliere su quali protocolli allocare

Dal punto di vista dell'utente, il protocollo è una "black box": deposita, riceve LP Token che rappresentano la sua quota del pool, e può ritirare quando vuole.

#### 🔧 Admin/Operator (Gestore)
L'admin può gestire la liquidità del pool, **MA** è vincolato da molteplici livelli di sicurezza:

1. **Solo Token Whitelistati**: Può operare esclusivamente con token registrati in TokenManager
2. **Solo Protocolli Registrati**: Può usare solo plugin registrati nel Beacon
3. **Solo Strategie Censite**: Può eseguire solo operazioni su vault/pool pre-approvati nei Registry
4. **Solo Funzioni Autorizzate**: Per operazioni protocol-specific, può chiamare solo function selectors whitelistati
5. **Timelock su Modifiche**: Cambiare parametri critici richiede 24h di attesa

**Cosa questo significa in pratica:**
- L'admin NON può trasferire fondi a indirizzi arbitrari
- L'admin NON può approvare token verso contratti non censiti
- L'admin NON può chiamare funzioni arbitrarie sui protocolli
- L'admin PUÒ solo muovere fondi tra il pool e i protocolli/token già autorizzati

### Gerarchia dei Ruoli

| Ruolo | Cosa può fare | Cosa NON può fare |
|-------|---------------|-------------------|
| **Owner** | Registrare moduli, modificare parametri (con timelock) | Bypassare timelock, rimuovere fondi |
| **Operator** | Ribilanciare tra protocolli censiti, harvest yield | Aggiungere nuovi protocolli, cambiare parametri |
| **Guardian** | Attivare pausa emergenza | Qualsiasi operazione sui fondi |
| **User** | Depositare/Ritirare | Influenzare gestione liquidità |

### Il "Recinto" di Sicurezza

Immaginalo come un recinto: l'admin può muoversi liberamente all'interno del recinto (token e protocolli censiti), ma non può uscirne. Il recinto è definito da:

```
┌─────────────────────────────────────────────────────────┐
│                    RECINTO SICURO                        │
│                                                          │
│  Token Whitelistati: WETH, USDC, ARB, ...               │
│  Protocolli Censiti: Euler, Uniswap, GMX, ...           │
│  Vault Autorizzati: eUSDC, eWETH, GM-ETH-USDC, ...      │
│  Funzioni Permesse: deposit, withdraw, swap, ...         │
│                                                          │
│  ✅ Admin può operare liberamente QUI DENTRO            │
└─────────────────────────────────────────────────────────┘
         ❌ Admin NON può uscire dal recinto
```

### Whitelist dei Selectors

Per le funzioni protocol-specific (non standard), il protocollo usa una whitelist di function selectors. Solo le chiamate esplicitamente autorizzate possono essere eseguite. Questo previene che un plugin malevolo possa fare chiamate arbitrarie.

### Custody Model

Tutti i fondi risiedono in ProxyGeneral. I plugin non detengono mai fondi, operano sempre per conto del ProxyGeneral usando `delegatecall` o approvazioni temporanee.

---

## 📊 Flusso delle Operazioni Principali

### 👤 Azioni Utente (Permissionless)

**Deposito** - L'utente deposita token e riceve LP Token:
```
Utente → LiquidityManager → ValueCalculator (calcola NAV)
                          → ProxyGeneral (trasferisce token, mint LP)
```

**Ritiro** - L'utente brucia LP Token e riceve token proporzionali:
```
Utente → LiquidityManager → ValueCalculator (calcola quota)
                          → ProxyGeneral (burn LP, trasferisce token)
```

*Nota: Queste sono le UNICHE azioni che un utente può eseguire.*

---

### 🔧 Azioni Admin (Vincolate al "Recinto")

**Swap Token** (solo tra token whitelistati):
```
Operator → SwapManager → [verifica token in whitelist]
                       → UniswapPlugin → Uniswap V3
```

**Deposit su Lending** (solo su vault censiti):
```
Operator → ProtocolManager → [verifica protocollo registrato]
                           → EulerV2Plugin → [verifica vault in Registry]
                                           → Euler V2
```

**Strategia Leverage** (ogni step è vincolato):
```
Operator → FlashLoanService → Balancer (flash loan)
         → ProtocolManager → EulerV2Plugin (deposit collateral) ✓ vault censito
                           → EulerV2Plugin (borrow) ✓ funzione autorizzata
                           → SwapManager (swap) ✓ token whitelistati
                           → EulerV2Plugin (deposit extra) ✓ vault censito
         → Balancer (repay flash loan)
```

*Nota: Ogni singola operazione passa attraverso verifiche di whitelist/registry.*

---

## 🔮 Estensibilità Futura

L'architettura è progettata per supportare facilmente:

- **Nuovi DEX**: Curve, Camelot, TraderJoe (solo nuovo SwapPlugin)
- **Nuovi Lending**: Aave, Compound, Silo (pattern 3 Musketeers)
- **Nuove Strategie**: Yield farming, delta-neutral (nuovi plugin specializzati)
- **Cross-chain**: Bridge plugin per operare su altre chain

Il Beacon pattern permette di aggiornare qualsiasi modulo senza interrompere il servizio, semplicemente cambiando l'indirizzo registrato.

---

## 📝 Riepilogo

| Componente | Tipo | Responsabilità |
|------------|------|----------------|
| Beacon | Core | Registry indirizzi moduli |
| ProxyGeneral | Core | Custody asset + LP Token |
| TokenManager | Core | Whitelist token |
| ValueCalculator | Core | Calcolo NAV |
| ParameterManager | Core | Governance parametri |
| LiquidityManager | Core | Depositi/Prelievi utenti |
| SwapManager | Core | Orchestrazione swap |
| ProtocolManager | Core | Orchestrazione lending |
| UniswapPlugin | Plugin Swap | Integrazione Uniswap |
| EulerV2Plugin | Plugin Lending | Integrazione Euler |
| GMXv2Plugin | Plugin Trading | Integrazione GMX |
| FlashLoanService | Plugin Utility | Flash loan Balancer |
| ChainlinkAdapter | Adapter | Prezzi oracle |
| EulerLensAdapter | Adapter | Lettura posizioni Euler |

---

*Documento generato il 19 Gennaio 2026*
