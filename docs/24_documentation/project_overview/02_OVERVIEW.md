# 📖 DeFi Protocol - Panoramica Generale

> Questo documento fornisce una visione d'insieme del progetto, espandendo l'executive summary con maggiori dettagli su architettura, funzionalità e roadmap.

---

## 📑 Indice

1. [Vision e Obiettivo Finale](#1-vision-e-obiettivo-finale)
2. [Roadmap delle 6 Fasi](#2-roadmap-delle-6-fasi)
3. [Architettura del Sistema](#3-architettura-del-sistema)
4. [Flussi Operativi Principali](#4-flussi-operativi-principali)
5. [Stato Attuale del Progetto](#5-stato-attuale-del-progetto)
6. [Stack Tecnologico](#6-stack-tecnologico)

---

## 1. Vision e Obiettivo Finale

### 🎯 Mission
Creare un'infrastruttura DeFi che renda l'investimento in criptovalute **semplice come usare un conto corrente bancario**.

### 🌍 Obiettivo Finale
Una **rete di pool interconnessi** talmente ramificata da replicare l'intera economia tradizionale su blockchain:
- Conti corrente → Pool stablecoin
- Fondi di investimento → Pool multi-asset con strategie
- Mutui → Pool di lending con collaterale tokenizzato
- Carte di credito → Spendibilità immediata degli asset

### 💡 Principi Guida

| Principio | Implementazione |
|-----------|-----------------|
| **Semplicità** | UX identica all'homebanking, nessuna conoscenza crypto richiesta |
| **Trasparenza Progressiva** | 3 livelli di dettaglio: Semplice, Pro, Avanzato |
| **Sicurezza** | Smart contracts audited, emergency controls, rate limiting |
| **Modularità** | Aggiungi protocolli/chain senza toccare il core |
| **Istantaneità** | Depositi e prelievi immediati, sempre disponibili |

---

## 2. Roadmap delle 6 Fasi

### 📍 Fase 1: Pool Multi-Chain su EVM (ATTUALE)

**Obiettivo**: Creare i primi pool di USDT/USDC, BTC e ETH su diverse chain EVM.

**Caratteristiche**:
- 3 pool per ogni asset, suddivisi per **livello di rischio**:
  - 🟢 **Low Risk**: Solo lending su protocolli blue-chip (Aave, Compound)
  - 🟡 **Medium Risk**: Lending + yield farming moderato
  - 🔴 **High Risk**: Strategie leverage, liquidity providing, yield farming aggressivo
  
**Chain Target**: Arbitrum (first), Ethereum, Optimism, Base, BSC

**Status**: 🔨 **In sviluppo attivo** - Smart contracts core completati

---

### 📍 Fase 2: Aggregazione su PLASMA

**Obiettivo**: Pool aggregati sulla blockchain PLASMA (fees pagabili in USDT/USDC).

**Vantaggi**:
- L'utente investe in **un singolo pool** che automaticamente alloca sui pool Fase 1
- Ottimizzazione automatica: ribilancia verso chain/strategie più profittevoli
- **No gas management**: l'utente paga fees in stablecoin, non in ETH

**Architettura Cross-Chain**:
```
┌─────────────────────────────────────┐
│         PLASMA (Entry Point)       │
│  ┌─────────────────────────────┐   │
│  │   Master Pool USDC/USDT     │   │
│  └──────────────┬──────────────┘   │
└─────────────────┼──────────────────┘
                  │ Bridges
     ┌────────────┼────────────┐
     ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│Arbitrum │  │Optimism │  │  Base   │
│Pool Low │  │Pool Med │  │Pool High│
└─────────┘  └─────────┘  └─────────┘
```

---

### 📍 Fase 3: Portale User-Friendly + Carta

**Obiettivo**: App/sito con UX identica all'homebanking + carta di credito crypto.

**Features**:
- **Dashboard semplice**: Saldo, rendimenti, storico transazioni
- **Deposito/Prelievo 1-click**: Come un bonifico bancario
- **Scelta rischio**: Slider per allocare tra Low/Medium/High
- **Trasparenza a livelli**:
  - 🟢 Semplice: "I tuoi €1000 hanno generato €5 questo mese"
  - 🟡 Pro: Breakdown per protocollo, APY storici
  - 🔴 Avanzato: Posizioni singole, transazioni on-chain, health factors

**Carta di Credito**:
- Spendi direttamente dal pool
- I fondi continuano a generare yield fino al momento della spesa
- Settlement istantaneo on-chain

---

### 📍 Fase 4: Asset Tokenizzati (Ondo Finance)

**Obiettivo**: Integrare asset del mondo reale tokenizzati per strategie ibride TradFi/DeFi.

**Use Cases**:
- Pool che investono in **Treasury tokenizzati** (USDY, OUSG)
- Strategie che combinano yield DeFi + rendimenti obbligazionari
- Esposizione a mercati tradizionali con settlement blockchain

**Target Clients**:
- Banche che vogliono offrire prodotti crypto ai clienti
- Fondi di investimento che cercano infrastruttura blockchain
- **Consulenza B2B** per sviluppo portali custom

---

### 📍 Fase 5: Platform per Creazione Fondi

**Obiettivo**: Permettere a chiunque (con requisiti legali) di creare il proprio fondo di investimento.

**Come Funziona**:
```
Economista/Gestore ──→ Configura strategia ──→ Pool automatico
                              │
                              ▼
                    ┌─────────────────┐
                    │  Portale white  │
                    │   label pronto  │
                    └─────────────────┘
                              │
                              ▼
                    Investitori depositano
```

**Vantaggi**:
- Infrastruttura sicura gestita da noi
- Compliance integrata
- Time-to-market di giorni invece che mesi

---

### 📍 Fase 6: Pool Mutui con Collaterale Tokenizzato

**Obiettivo**: Permettere prestiti a lungo termine (mutui) con garanzia tokenizzata.

**Architettura**:
```
┌─────────────────────────────────────────────────────────────┐
│                      POOL MUTUI                             │
│                                                             │
│  Investitori ──deposit──→ Pool ──lend──→ Mutuatario        │
│                                                             │
│  Collaterale: NFT che rappresenta la proprietà (casa)      │
│  Valutazione: Oracle + Perito autorizzato                  │
│  Enforcement: Smart contract + entità legale               │
└─────────────────────────────────────────────────────────────┘
```

**Ruolo delle Banche**:
- Le banche rimangono come **ponte tra mondo trustless e persone fisiche**
- Effettuano KYC/AML, valutazione creditizia
- Tokenizzano il collaterale (casa → NFT)
- Il prestito e i pagamenti avvengono on-chain

---

## 3. Architettura del Sistema

### 🏗️ Smart Contracts Core (Fase 1)

Il sistema è composto da **8 contratti principali** che comunicano tramite il **Beacon Proxy Pattern**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARCHITETTURA CORE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                            BEACON                                    │   │
│  │  • Registry moduli                                                   │   │
│  │  • Upgrade management                                                │   │
│  │  • Freeze controls                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│       ┌──────────────────────────────┼──────────────────────────────┐      │
│       │              │               │               │              │      │
│       ▼              ▼               ▼               ▼              ▼      │
│  ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌────────┐   │
│  │ Proxy   │   │Liquidity │   │   Swap    │   │  Token   │   │ Value  │   │
│  │ General │   │ Manager  │   │  Manager  │   │ Manager  │   │  Calc  │   │
│  │         │   │          │   │           │   │          │   │        │   │
│  │LP Token │   │Deposit   │   │Swap exec  │   │Whitelist │   │Pricing │   │
│  │Custody  │   │Withdraw  │   │Slippage   │   │Oracles   │   │Portfolio│  │
│  └─────────┘   └──────────┘   └───────────┘   └──────────┘   └────────┘   │
│                                                                             │
│       ┌──────────────────────────────┬──────────────────────────────┐      │
│       ▼                              ▼                              ▼      │
│  ┌───────────┐               ┌────────────┐                ┌──────────┐   │
│  │ Parameter │               │ Emergency  │                │ Protocol │   │
│  │  Manager  │               │  Handler   │                │ Manager  │   │
│  │           │               │            │                │          │   │
│  │Governance │               │Pause/Resume│                │Multi-prot│   │
│  │Timelock   │               │Emergency   │                │Registry  │   │
│  └───────────┘               └────────────┘                └──────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔌 Plugin System per Protocolli Esterni

Per ogni protocollo DeFi integrato, servono **3 componenti** (i "Tre Moschettieri"):

| Componente | Responsabilità | Interfaccia |
|------------|----------------|-------------|
| **Plugin** | Operazioni write (deposit, withdraw, leverage) | `IPlugin` |
| **LensAdapter** | Letture (health factor, posizioni, valori) | `ILensAdapter` |
| **Registry** | Configurazione (vault addresses, token supportati) | `IRegistry` |

**Esempio con Euler V2**:
```
ProtocolManager.registerProtocol(
    "Euler",
    eulerV2Plugin,       // Operazioni
    eulerLensAdapter,    // Monitoraggio  
    eulerVaultRegistry   // Config
);
```

---

## 4. Flussi Operativi Principali

### 💰 Flusso Deposito

```
Utente deposita 10 ETH
         │
         ▼
┌─────────────────────────────────┐
│     LiquidityManager.deposit()  │
│  1. Ricevi ETH/WETH             │
│  2. Calcola fee (0-5%)          │
│  3. Mint LP tokens              │
│  4. ETH → idle liquidity        │
└─────────────────────────────────┘
         │
         ▼
Owner alloca a protocolli (manuale o automatico)
         │
         ▼
┌─────────────────────────────────┐
│     ProtocolManager             │
│  • Euler: 5 ETH → leverage 3x   │
│  • Aave: 3 ETH → lending        │
│  • Idle: 2 ETH                  │
└─────────────────────────────────┘
```

### 📤 Flusso Prelievo (con Auto-Close)

```
Utente richiede: withdraw(15 ETH)
Ma abbiamo solo: 2 ETH idle + 13 ETH in protocolli
         │
         ▼
┌─────────────────────────────────┐
│   LiquidityManager.withdraw()   │
│  1. Check: 2 ETH < 15 ETH ❌    │
│  2. Shortage: 13 ETH mancanti   │
│  3. Chiama ProtocolManager      │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  ProtocolManager.closePositionsForWeth(13 ETH)  │
│                                                 │
│  1. Ottieni posizioni ordinate per rischio      │
│  2. Chiudi dalla più rischiosa (HF basso)       │
│  3. Accumula ETH fino a raggiungere target      │
└─────────────────────────────────────────────────┘
         │
         ▼
ETH tornano a LiquidityManager → Prelievo completato ✅
```

---

## 5. Stato Attuale del Progetto

### ✅ Completato (Production-Ready)

| Componente | Status | Note |
|------------|--------|------|
| Smart Contracts Core (8) | ✅ | 0 bug critici, audit 10/10 |
| Test Suite | ✅ | 400+ test, >85% coverage |
| Plugin Euler V2 | ✅ | Leverage, lending, monitoring |
| Scripts Deployment | ✅ | 96% completati |
| Documentazione Tecnica | ✅ | Completa |

### 🔨 In Sviluppo

| Componente | Status | ETA |
|------------|--------|-----|
| Plugin GMX v2 | 🔨 | Q1 2026 |
| Plugin Dolomite | 🔨 | Q1 2026 |
| Rebalancing automatico | 📋 | Q2 2026 |
| Cross-chain (PLASMA) | 📋 | Q2-Q3 2026 |

### 📊 Metriche Chiave

```
Contratti:        8 production-ready
Test:             400+ passing
Coverage:         >85%
Gas (swap):       ~168k
Sicurezza:        10/10 su funzioni critiche
Vulnerabilità:    0 critiche (reentrancy fixed)
```

---

## 6. Stack Tecnologico

| Layer | Tecnologia |
|-------|------------|
| **Blockchain** | Arbitrum One (primary), EVM-compatible chains |
| **Smart Contracts** | Solidity 0.8.19 |
| **Framework** | Hardhat 2.22.18 |
| **Testing** | Mocha, Chai, Ethers.js |
| **Oracles** | Chainlink Price Feeds |
| **DEX Integration** | Uniswap V3, 1inch, Odos |
| **Lending** | Euler V2, Aave (planned) |
| **Perpetuals** | GMX v2 (planned) |

---

## 📚 Documenti Correlati

- **Dettaglio Tecnico**: `03_TECHNICAL_ARCHITECTURE.md`
- **Roadmap Fasi**: `04_PHASE_ROADMAP.md`
- **Guida Deployment**: `../../DEPLOYMENT_GUIDE.md`
- **Test Strategy**: `../02_testing/TEST_STRATEGY.md`

---

*Documento: 02_OVERVIEW.md | Ultimo aggiornamento: Gennaio 2026*
