# 📊 Guida PowerPoint - Struttura Slide

> **Totale stimato:** ~45-50 slide  
> **Durata presentazione:** ~30-40 minuti

---

## 1. INTRODUZIONE (3 slide)

### Slide 1.1 - Titolo e Cos'è il Protocollo
**Testo:**
- Nome protocollo + tagline
- "Aggregatore DeFi modulare su Arbitrum"
- 3 bullet point: Multi-protocollo, Modulare, Sicuro

**Immagine:** Logo + icone dei protocolli integrati (Euler, Uniswap, GMX)

---

### Slide 1.2 - Principi Architetturali
**Testo:**
- Separation of Concerns
- Modularità (plugin sostituibili)
- Security First

**Immagine:** Diagramma semplice a 3 livelli (Core → Plugin → Protocolli esterni)

---

### Slide 1.3 - Overview Visivo
**Testo:** Minimo, solo etichette

**Immagine:** Diagramma architettura completo (Layer 1-2-3)

---

## 2. SMART CONTRACT CORE (10 slide)

### Slide 2.1 - Panoramica Core
**Testo:**
- "9 contratti fondamentali"
- Elenco nomi con icona per ciascuno

**Immagine:** Griglia 3x3 con icone/nomi dei 9 contratti

---

### Slide 2.2 - Beacon
**Testo:**
- Registry centrale moduli
- Nome → Indirizzo
- Permette upgrade senza modificare caller

**Immagine:** Diagramma: Contratto A chiede a Beacon → ottiene indirizzo B

---

### Slide 2.3 - ProxyGeneral
**Testo:**
- "Il Caveau" - custodisce tutti gli asset
- Emette/brucia LP Token
- Nessun altro contratto detiene fondi

**Immagine:** Icona cassaforte con frecce in/out (deposit/withdraw)

---

### Slide 2.4 - TokenManager
**Testo:**
- Whitelist token supportati
- Mapping token → oracle
- Controllo accessi su operazioni

**Immagine:** Tabella semplice: Token | Oracle | Status

---

### Slide 2.5 - ValueCalculator
**Testo:**
- Calcola NAV totale pool
- Somma: token liberi + posizioni protocolli
- Sistema cache per gas efficiency

**Immagine:** Formula visiva: NAV = Σ(token) + Σ(posizioni)

---

### Slide 2.6 - ParameterManager
**Testo:**
- Gestisce parametri configurabili
- Fee, limiti, soglie
- Timelock 24h per modifiche critiche

**Immagine:** Timeline: Proposta → 24h → Esecuzione

---

### Slide 2.7 - EmergencyHandler
**Testo:**
- Procedure di emergenza
- Pausa globale protocollo
- Ruolo Guardian

**Immagine:** Icona allarme/stop con stati: Normal → Paused → Recovery

---

### Slide 2.8 - LiquidityManager
**Testo:**
- Entry point utenti
- Deposito → LP Token
- LP Token → Ritiro

**Immagine:** Flusso: User → LiquidityManager → ProxyGeneral

---

### Slide 2.9 - SwapManager
**Testo:**
- Orchestratore swap
- Delega a plugin specifici
- Seleziona plugin migliore

**Immagine:** SwapManager al centro con frecce verso UniswapPlugin, CurvePlugin, etc.

---

### Slide 2.10 - ProtocolManager
**Testo:**
- Orchestratore lending/yield
- Delega a plugin: deposit, withdraw, borrow, repay
- Whitelist selectors per sicurezza

**Immagine:** ProtocolManager → EulerPlugin, GMXPlugin, etc.

---

## 3. PLUGIN MODULARI (6 slide)

### Slide 3.1 - Tipologie di Plugin
**Testo:**
- Due categorie principali
- 🔄 Swap Plugin (DEX)
- 🏦 Lending Plugin (Lending/Yield)

**Immagine:** Due colonne con icone e esempi

---

### Slide 3.2 - Plugin Swap - Interfaccia
**Testo:**
- Implementa `ISwapPlugin`
- Funzione: `executeSwap(tokenIn, tokenOut, amount)`
- Registrato in SwapManager

**Immagine:** Box interfaccia con metodi principali

---

### Slide 3.2.1 - UniswapV3PluginDirect
**Testo:**
- Integrazione diretta Uniswap V3
- Single-hop e multi-hop
- Quote prima di swap

**Immagine:** Logo Uniswap + flusso swap

---

### Slide 3.3 - Plugin Lending - Interfaccia
**Testo:**
- Implementa `ILendingProtocol`
- Funzioni: deposit, withdraw, borrow, repay
- Funzioni protocol-specific via whitelist

**Immagine:** Box interfaccia con 4 metodi base

---

### Slide 3.3.1 - EulerV2Plugin
**Testo:**
- Integrazione Euler V2
- Sub-account model (0-255)
- Supporto leverage

**Immagine:** Logo Euler + diagramma sub-account

---

### Slide 3.4 - Plugin Utility
**Testo:**
- FlashLoanPlugin / FlashLoanService
- Integrazione Balancer
- Usato per strategie leverage atomiche

**Immagine:** Flusso flash loan: Borrow → Operazioni → Repay (stesso tx)

---

## 4. PATTERN 3 MUSKETEERS (5 slide)

### Slide 4.1 - Panoramica
**Testo:**
- Per ogni lending protocol servono 3 componenti
- Lavorano insieme
- Standard per nuove integrazioni

**Immagine:** 3 icone collegate: Braccio, Occhi, Mappa

---

### Slide 4.2 - Plugin (Il Braccio)
**Testo:**
- Esegue operazioni
- Contiene logica deposit/withdraw/borrow/repay
- Chiama contratti del protocollo target

**Immagine:** Braccio robotico che interagisce con protocollo

---

### Slide 4.3 - LensAdapter (Gli Occhi)
**Testo:**
- Legge stato posizioni
- Calcola valore USD
- Fornisce dati a ValueCalculator

**Immagine:** Lente/occhio che osserva dati

---

### Slide 4.4 - Registry (La Mappa)
**Testo:**
- Mappa token → vault/pool
- Configurazione per ogni token
- Può essere on-chain o off-chain

**Immagine:** Tabella mapping: WETH → eWETH vault

---

### Slide 4.5 - Vantaggi del Pattern
**Testo:**
- Separazione responsabilità
- Riusabilità componenti
- Testabilità indipendente
- Sicurezza: letture separate da scritture

**Immagine:** Diagramma con 3 box separati ma collegati

---

## 5. AGGIUNGERE PROTOCOLLI (4 slide)

### Slide 5.1 - Nuovo Swap Plugin
**Testo:**
- 3 step semplici:
  1. Implementa ISwapPlugin
  2. Crea executeSwap()
  3. Registra in SwapManager

**Immagine:** Checklist con 3 step ✓

---

### Slide 5.2 - Nuovo Lending Plugin
**Testo:**
- 4 step (pattern 3 Musketeers):
  1. Crea Registry
  2. Crea LensAdapter
  3. Crea Plugin
  4. Registra tutto

**Immagine:** Flowchart dei 4 step

---

### Slide 5.3 - Registrazione Moduli
**Testo:**
- Beacon: registra indirizzo modulo
- ProtocolManager: registra plugin con ID
- ValueCalculator: registra LensAdapter

**Immagine:** 3 box con frecce "registra in"

---

### Slide 5.4 - Esempio Pratico (opzionale)
**Testo:**
- Esempio: integrare Aave
- Mostra i 3 contratti necessari
- Snippet codice minimo

**Immagine:** Diagramma specifico Aave integration

---

## 6. MODELLO DI SICUREZZA (8 slide)

### Slide 6.1 - Separazione Utente/Admin
**Testo:**
- Principio fondamentale
- Utente: solo deposit/withdraw
- Admin: gestisce MA vincolato

**Immagine:** Due figure separate: User (semplice) vs Admin (con catene)

---

### Slide 6.2 - Ruolo Utente
**Testo:**
- ✅ Deposita token → riceve LP
- ✅ Ritira LP → riceve token
- ❌ Nessun controllo sulla gestione
- "Black box" dal punto di vista utente

**Immagine:** User con frecce solo verso deposit/withdraw

---

### Slide 6.3 - Ruolo Admin/Operator
**Testo:**
- Può gestire liquidità MA:
- Solo token whitelistati
- Solo protocolli registrati
- Solo vault censiti
- Solo funzioni autorizzate

**Immagine:** Admin dentro un recinto

---

### Slide 6.4 - Il "Recinto" di Sicurezza
**Testo:**
- TokenManager: whitelist token
- Beacon: protocolli registrati
- Registry: vault autorizzati
- Selectors: funzioni permesse

**Immagine:** Recinto con 4 muri etichettati

---

### Slide 6.5 - Gerarchia Ruoli
**Testo:**
- Owner: registra moduli, parametri (con timelock)
- Operator: ribilancia, harvest
- Guardian: pausa emergenza
- User: deposit/withdraw

**Immagine:** Piramide ruoli con permessi

---

### Slide 6.6 - Custody Model
**Testo:**
- Tutti i fondi in ProxyGeneral
- Plugin stateless (no fondi)
- Approvazioni temporanee

**Immagine:** ProxyGeneral centrale con plugin satellite

---

### Slide 6.7 - Timelock Governance
**Testo:**
- Modifiche critiche: 24h delay
- Proposta → Attesa → Esecuzione
- Tempo per reagire a proposte malevole

**Immagine:** Timeline con orologio

---

### Slide 6.8 - Emergency System
**Testo:**
- Pausa globale (ProxyGeneral)
- Freeze singolo modulo (Beacon)
- Circuit breaker in plugin

**Immagine:** 3 livelli di stop: globale, modulo, plugin

---

## 7. FLUSSI OPERATIVI (5 slide)

### Slide 7.1 - Azioni Utente: Deposito
**Testo:**
- User → LiquidityManager
- Calcolo NAV
- Trasferimento token
- Mint LP Token

**Immagine:** Flowchart orizzontale 4 step

---

### Slide 7.2 - Azioni Utente: Ritiro
**Testo:**
- User → LiquidityManager
- Calcolo quota
- Burn LP Token
- Trasferimento token

**Immagine:** Flowchart orizzontale 4 step (inverso)

---

### Slide 7.3 - Admin: Swap
**Testo:**
- Operator → SwapManager
- Verifica token whitelist ✓
- Plugin esegue swap
- Aggiorna bilanci

**Immagine:** Flusso con checkpoint verifica

---

### Slide 7.4 - Admin: Lending
**Testo:**
- Operator → ProtocolManager
- Verifica protocollo ✓
- Verifica vault ✓
- Plugin esegue operazione

**Immagine:** Flusso con 2 checkpoint

---

### Slide 7.5 - Admin: Leverage
**Testo:**
- Flash loan da Balancer
- Deposit collateral ✓
- Borrow ✓
- Swap ✓
- Deposit extra ✓
- Repay flash loan

**Immagine:** Flusso circolare complesso con checkmark

---

## APPENDICI (4 slide opzionali)

### Slide A - Indirizzi Contratti
**Testo:** Tabella con contratti principali e indirizzi Arbitrum

### Slide B - Interfacce Principali
**Testo:** Screenshot/snippet delle interfacce chiave

### Slide C - Glossario
**Testo:** Termini principali con definizioni brevi

### Slide D - Q&A
**Testo:** Slide finale per domande

---

## 📋 RIEPILOGO SLIDE

| Capitolo | N° Slide |
|----------|----------|
| 1. Introduzione | 3 |
| 2. Core | 10 |
| 3. Plugin | 6 |
| 4. 3 Musketeers | 5 |
| 5. Aggiungere Protocolli | 4 |
| 6. Sicurezza | 8 |
| 7. Flussi Operativi | 5 |
| Appendici | 4 |
| **TOTALE** | **45** |

---

*Guida generata il 19 Gennaio 2026*
