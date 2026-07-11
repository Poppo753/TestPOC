# 📑 INDICE DOCUMENTAZIONE

> **Versione:** 1.0.0  
> **Ultima modifica:** Gennaio 2026

---

## 1. INTRODUZIONE

| # | Paragrafo | Descrizione |
|---|-----------|-------------|
| 1.1 | Cos'è il Protocollo | Definizione di aggregatore DeFi modulare e obiettivi principali |
| 1.2 | Principi Architetturali | Separazione logica core/plugin, modularità, sicurezza |

## 2. ARCHITETTURA: SMART CONTRACT CORE

| # | Paragrafo | Descrizione |
|---|-----------|-------------|
| 2.1 | Beacon | Registry centrale dei moduli, pattern di upgrade |
| 2.2 | ProxyGeneral | Custody degli asset, emissione LP Token |
| 2.3 | TokenManager | Whitelist token supportati, mapping oracle |
| 2.4 | ValueCalculator | Calcolo NAV pool, sistema cache prezzi |
| 2.5 | ParameterManager | Parametri configurabili, timelock 24h |
| 2.6 | EmergencyHandler | Procedure emergenza, pausa globale |
| 2.7 | LiquidityManager | Entry point utenti, depositi/prelievi |
| 2.8 | SwapManager | Orchestrazione swap, selezione plugin |
| 2.9 | ProtocolManager | Orchestrazione lending/yield, delega a plugin |

## 3. ARCHITETTURA: PLUGIN MODULARI

| # | Paragrafo | Descrizione |
|---|-----------|-------------|
| 3.1 | Tipologie di Plugin | Differenza tra Swap Plugin e Lending Plugin |
| 3.2 | Plugin Swap | Interfaccia ISwapPlugin, registrazione in SwapManager |
| 3.2.1 | UniswapV3PluginDirect | Integrazione Uniswap V3, quote e swap |
| 3.3 | Plugin Lending | Interfaccia ILendingProtocol, operazioni standard |
| 3.3.1 | EulerV2Plugin | Integrazione Euler V2, sub-account, leverage |
| 3.4 | Plugin Utility | FlashLoanPlugin, FlashLoanService (Balancer) |

## 4. IL PATTERN "3 MUSKETEERS"

| # | Paragrafo | Descrizione |
|---|-----------|-------------|
| 4.1 | Panoramica | Perché servono 3 componenti per ogni integrazione lending |
| 4.2 | Plugin (Il Braccio) | Esecuzione operazioni, chiamate al protocollo |
| 4.3 | LensAdapter (Gli Occhi) | Lettura stato posizioni, calcolo valori USD |
| 4.4 | Registry (La Mappa) | Mapping token → vault/pool del protocollo |
| 4.5 | Vantaggi del Pattern | Separazione responsabilità, testabilità, sicurezza |

## 5. AGGIUNGERE NUOVI PROTOCOLLI

| # | Paragrafo | Descrizione |
|---|-----------|-------------|
| 5.1 | Nuovo Swap Plugin | Step per integrare un nuovo DEX |
| 5.2 | Nuovo Lending Plugin | Step completi con pattern 3 Musketeers |
| 5.3 | Registrazione Moduli | Come registrare in Beacon, ProtocolManager, ValueCalculator |


## 6. MODELLO DI SICUREZZA

| # | Paragrafo | Descrizione |
|---|-----------|-------------|
| 6.1 | Separazione Utente/Admin | Ruoli nettamente distinti e relativi permessi |
| 6.2 | Ruolo Utente | Può solo depositare/ritirare, nessun controllo gestione |
| 6.3 | Ruolo Admin/Operator | Gestione vincolata al "recinto" autorizzato |
| 6.4 | Il "Recinto" di Sicurezza | Token, protocolli, vault, selectors autorizzati |
| 6.5 | Gerarchia Ruoli | Owner, Operator, Guardian, User - permessi e limiti |
| 6.7 | Custody Model | Tutti i fondi in ProxyGeneral, plugin stateless |
| 6.8 | Timelock Governance | Delay 24h per modifiche parametri critici |
| 6.9 | Emergency System | Pausa globale, freeze moduli, circuit breaker |

## 7. FLUSSI OPERATIVI

| # | Paragrafo | Descrizione |
|---|-----------|-------------|
| 7.1 | Azioni Utente | Flusso deposito, flusso ritiro |
| 7.2 | Azioni Admin: Swap | Flusso swap tra token whitelistati |
| 7.3 | Azioni Admin: Lending | Flusso deposit/withdraw su protocolli censiti |
| 7.4 | Azioni Admin: Leverage | Flusso completo strategia con flash loan |
| 7.5 | Verifiche ad Ogni Step | Come whitelist/registry validano ogni operazione |

## APPENDICI

| # | Appendice | Descrizione |
|---|-----------|-------------|
| A | Indirizzi Contratti | Tutti gli indirizzi deployed su Arbitrum |
| B | Interfacce Principali | ISwapPlugin, ILendingProtocol, ILensAdapter |
| C | Glossario | Definizioni termini tecnici usati |
| D | Diagrammi | Architettura, flussi, dipendenze |

## 📄 Documenti Correlati

- [FUNCTIONAL_OVERVIEW.md](FUNCTIONAL_OVERVIEW.md) - Overview funzionale sintetico
- [ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md) - Overview architetturale tecnico

---

*Documento generato il 19 Gennaio 2026*
