## Architettura Generale — **Jethos Protocol DApp**

Il progetto segue il pattern **Atomic Design** in **vanilla JavaScript (ES6 modules)** + **Tailwind CSS** + **ethers.js v6**, senza alcun framework. La rete target è **Arbitrum One** (`chainId 42161`).

### 4 Pagine Principali

| Pagina | File | Scopo |
|--------|------|-------|
| **Dashboard** | index.html + main.js | App principale: wallet connect, deposit/withdraw ETH, stats, transazioni |
| **Portfolio** | portfolio.html + src/portfolio.js | Visualizzazione composizione pool (doughnut chart con Chart.js) |
| **Config** | config.html | Pannello admin owner-only per eseguire swap (single/multi) |
| **Documentazione** | documentation.html | Viewer interattivo dell'API con grafo dipendenze |

---

## Gerarchia dei Componenti (Atomic Design)

```
Templates (pagine complete)
├── DashboardTemplate ─── orchestra tutto il dashboard
└── GridLayout ─────────── sistema griglia riutilizzabile con pattern predefiniti

Organisms (sezioni con logica business)
├── WalletConnect ──────── connessione MetaMask + stato wallet
├── StatsGrid ──────────── 4 KPI: LP balance, pool value, your value, APY
├── DepositForm ────────── form deposito ETH → LP tokens
├── WithdrawForm ───────── form ritiro LP → ETH (preset 25/50/75/100%)
├── TransactionHistoryPanel ── storico TX con filtri + localStorage
├── ModulesGrid ────────── griglia moduli per la documentazione
├── FunctionModal ──────── popup dettagli funzione (parametri, ABI, security)
├── DependencyGraph ────── frecce SVG animate per call dependencies
└── DocumentationStats ─── pannello floating con statistiche sistema

Molecules (gruppi di atomi)
├── Card ───────────────── container glass/gradient con header+body+footer
├── Alert / ToastManager ─ notifiche toast con auto-dismiss
├── FormGroup ──────────── raggruppa Input + Button in un <form>
├── StatDisplay ────────── valore animato + trend + icona
├── PriceImpactDisplay ─── preview prezzo + fee + rate change
├── FunctionCard ───────── card documentazione per singola funzione
├── ModuleCard ─────────── card espandibile per modulo (contiene FunctionCard)
└── TransactionList ────── lista di TransactionItem

Atoms (elementi base)
├── Button ─────────────── 5 varianti (primary/secondary/outline/ghost/danger)
├── Input ──────────────── campo con label, icona, suffisso, errore
├── Badge ──────────────── 11 varianti (success/warning/view/write/emergency...)
├── Icon ───────────────── 16 icone SVG inline
├── AnimatedNumber ─────── animazione numerica con requestAnimationFrame
├── PricePreview ──────── preview input→output con skeleton loading
├── Skeleton ───────────── placeholder shimmer per loading states
├── ConnectionArrow ────── freccia SVG Bézier animata
└── TransactionItem ────── riga singola TX con link block explorer
```

---

## Layer Web3 / Blockchain

### Smart Contracts coinvolti (Arbitrum):

| Contratto | Indirizzo | Ruolo nel DApp |
|-----------|-----------|----------------|
| **Beacon** | `0xdB99...4870` | Service locator per moduli |
| **LiquidityManager** | `0xfb26...0150` | Deposit/withdraw ETH (write) |
| **ProxyGeneral** | `0x8750...78e1` | LP token ERC20 (balanceOf, totalSupply) |
| **ValueCalculator** | `0x2E04...15B0` | getTotalPoolValueView() |
| **Uniswap V3 Quoter** | `0x61fF...B21e` | Pricing on-chain via quoter.js |

### Flusso operativo:

```
Utente → MetaMask → web3Manager.connect()
                         ↓
                   initContracts() → 3 istanze ethers.Contract
                         ↓
          ┌──────────────┼──────────────┐
     deposit(ETH)    getLPBalance()   getPoolValueUSD()
          ↓               ↓                  ↓
   LiquidityManager  ProxyGeneral    quoter.js → Uniswap V3
          ↓                               (getBestQuote su 3 fee tiers)
   emit Deposit event
          ↓
   TransactionHistoryPanel.loadTransactions()
   (query eventi on-chain + localStorage)
```

---

## Sito Documentazione — Architettura

Il sito documentation.html è un **viewer API interattivo** che carica dati da 2 JSON:

### Data Sources:

| File | Contenuto |
|------|-----------|
| api_reference.json | Documentazione completa di tutti i moduli/funzioni (v3.0.0): signature, parametri, returns, access control, validazioni, gas cost, security notes, usage examples |
| api_reference_beacon.json | Documentazione specifica ProtocolManager (deposit/withdraw su protocolli esterni) |
| function_dependencies.json | Grafo diretto delle dipendenze tra funzioni (DAG v3.0) |

### Funzionalità interattive:

1. **ModulesGrid** — Griglia espandibile di tutti i moduli, ogni modulo contiene N `FunctionCard`
2. **FunctionModal** — Click su una funzione → popup dettagliato con 10+ sezioni (ABI, parametri, tabelle, codice esempio, note sicurezza)
3. **DependencyGraph** — Frecce SVG animate tra funzioni che mostrano le call dependencies
   - Modalità **outgoing** (cosa chiama una funzione)
   - Modalità **incoming** (chi chiama una funzione)
4. **DocumentationStats** — Pannello floating con contatori: moduli totali, funzioni view/write/emergency
5. **ApiReferenceParser** (MarkdownParser.js) — Parsifica il JSON e classifica le funzioni per colore/tipo

### Call graph principali documentati:

```
LiquidityManager.deposit
├── ProxyGeneral.mint
├── ValueCalculator.getTotalPoolValue
│   ├── TokenManager.getActiveTokens
│   └── ValueCalculator.calculateTokenValue
│       ├── TokenManager.getTokenPrice → Chainlink.latestRoundData
│       └── ProxyGeneral.getAssetBalance
└── ProxyGeneral.checkRateLimit → ParameterManager.getCurrentParameterValue

SwapManager.performSwap
├── Beacon.getImplementation
├── TokenManager.getTokenAddress
├── ProxyGeneral.approveSpender
└── ProxyGeneral.transferFunds

EmergencyHandler.emergencyWithdraw
├── TokenManager.getActiveTokens
├── ProxyGeneral.emergencyTransfer
└── ValueCalculator.getTotalPoolValueView
```

---

## Design System

- **Colori**: palette purple (primary), con verde/ambra/rosso per stati
- **Glass-morphism**: `backdrop-blur` + bordi semitrasparenti su tutte le card
- **Video background**: sfondo video in loop su index.html
- **Responsive**: breakpoint sm(640) / md(768) / lg(1024) / xl(1280) / 2xl(1536)
- **Griglia CSS**: 12 colonne con Tailwind (`grid-cols-12`)
- **Animazioni**: slideIn/slideOut per toast, shimmer per skeleton, frecce SVG animate per dipendenze, `AnimatedNumber` per valori numerici
- **Dark mode**: supportato via classe Tailwind

---

## Riepilogo Dipendenze Esterne

| Libreria | Via | Uso |
|----------|-----|-----|
| **ethers.js v6** | CDN | Wallet, contratti, transazioni |
| **Tailwind CSS** | CDN | Stilizzazione utility-first |
| **Chart.js v4.4** | CDN (solo portfolio.html) | Grafico doughnut |

**Zero build tools, zero npm, zero framework** — tutto funziona come ES modules nel browser.