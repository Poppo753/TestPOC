## Cos'è questo progetto, davvero

È un **aggregatore di rendimento DeFi** — una struttura di vault intelligenti che prendono i tuoi asset (ETH, USDC, WBTC) e li distribuiscono automaticamente tra i migliori protocolli di lending e yield disponibili su ogni chain, ottimizzando il rendimento senza che tu debba fare nulla.

Il confronto più vicino che esiste è **Yearn Finance**, ma con un'architettura modulare molto più avanzata e con l'obiettivo di diventare il punto di accesso unico a tutti i principali protocolli DeFi.

---

## Lo stato attuale

Oggi esiste **un solo vault deployato su Arbitrum**, non ancora in uso reale. Funziona così:

```
Tu depositi ETH
    │
    ▼
LiquidityManager (calcola le tue quote, minta LP token)
    │
    ▼
ProxyGeneral (custodisce tutti gli asset fisicamente)
    │
    ├──► Aave V3    (lending: depositi WETH, guadagni interessi)
    ├──► Euler V2   (lending avanzato con sub-account e leva)
    └──► Morpho Blue (lending ottimizzato peer-to-peer)
    │
    ▼
ValueCalculator (calcola il valore totale del pool)
    │
    ▼
Tu ritiri il tuo ETH + rendimento accumulato
```

L'architettura centrale è composta da **9 contratti core** più **plugin separati** per ogni protocollo esterno. Ogni protocollo integrato segue il pattern "3 Moschettieri":
- **Registry** — mappa i token ai mercati/vault del protocollo
- **Plugin** — esegue le operazioni (deposit, withdraw, borrow)
- **LensAdapter** — monitora la salute delle posizioni (health factor, liquidation risk)

Questa separazione è cruciale: puoi aggiungere un nuovo protocollo senza toccare il core.

---

## La visione completa: 3 dimensioni di espansione

### Dimensione 1 — Multi-Pool (base asset)

Oggi tutto è WETH-hardcoded. Il piano è rendere il "base asset" configurabile, così lo stesso codebase può girare come:

| Pool | Base Asset | Target utente |
|---|---|---|
| ETH Pool | WETH | holder di ETH che vogliono yield |
| USDC Pool | USDC | holder stablecoin, risk-averse |
| WBTC Pool | WBTC | holder di BTC su EVM |

Un solo refactoring (sostituire "WETH" con "BASE_ASSET" ovunque) sblocca tutto questo. Con 3 plugin esistenti da adattare ora, invece di 13 plugin in futuro — il risparmio è ~57% del lavoro totale.

### Dimensione 2 — Multi-Protocollo

Da 3 protocolli a 10+, nell'ordine:

| Priorità | Protocollo | Specialità | Chain |
|---|---|---|---|
| Alta | Compound V3 | Lending, simile ad Aave | Arbitrum + Base |
| Alta | Silo V2 | Lending isolato | Arbitrum |
| Media | Dolomite | Lending + margin | Arbitrum |
| Media | Pendle | Yield tokenization (fixed vs variable rate) | Arbitrum |
| Media | GMX V2 | Perp trading, GM pools | Arbitrum |
| Bassa | Venus | Compound fork | BNB |
| Bassa | Moonwell | Compound fork | Base |
| Futura | Ethena | USDe staking | Multi-chain |
| Futura | Sky Protocol | ex-MakerDAO, DAI/sDAI | Multi-chain |

### Dimensione 3 — Multi-Chain

Lo stesso sistema replicato su più blockchain:

| Chain | Protocolli disponibili | Stato |
|---|---|---|
| **Arbitrum** | Tutti (hub principale) | Deployment attivo |
| **Base** | Aave + Euler + Morpho + Compound + Moonwell | Da deployare |
| **BNB Chain** | Aave + Venus | Da deployare |

---

## La parte più ambiziosa: la Piramide di Vault

Questa è l'architettura finale del progetto — una struttura a 4 livelli dove i vault superiori investono in quelli inferiori:

```
╔══════════════════════════════════════════════╗
║  LIVELLO 4 (top)       USDC General          ║  ← Vault finale per l'utente retail
╚══════════════════════════════════════════════╝
                          │ investe in
╔══════════════════════════════════════════════╗
║  LIVELLO 3     ETH Low/Med/High Risk         ║
║                USDC Low/Med/High Risk        ║  ← Vault per profilo di rischio
║                WBTC Low/Med/High Risk        ║
╚══════════════════════════════════════════════╝
                          │ investe in
╔══════════════════════════════════════════════╗
║  LIVELLO 2     ETH Delta Neutral             ║
║                USDC Delta Neutral            ║  ← Vault per strategia
║                BTC Delta Neutral             ║
║                Strategy Vault (vari)         ║
╚══════════════════════════════════════════════╝
                          │ investe in
╔══════════════════════════════════════════════╗
║  LIVELLO 1     Lending Vault                 ║
║  (base)        Stable Vault                  ║  ← Vault specializzati per protocollo
║                No-Risk Vault                 ║
║                Degen Vault                   ║
╚══════════════════════════════════════════════╝
                          │ deposita in
╔══════════════════════════════════════════════╗
║  PROTOCOLLI    Aave │ Euler │ Morpho         ║
║  ESTERNI       GMX │ Pendle │ Compound │ ... ║
╚══════════════════════════════════════════════╝
```

Il meccanismo chiave: ogni livello superiore ha un **VaultPlugin** — un plugin speciale che tratta un vault del livello inferiore esattamente come oggi il sistema tratta Aave o Euler. Vuoi allocare nel "Lending Vault"? È solo un altro protocollo nell'elenco, con un plugin che sa come depositarci.

---

## La sequenza di costruzione (da solo)

Il piano consigliato segue questa logica di dipendenze:

```
[Adesso]
  FASE 0 — Rendi il base asset configurabile
     3 plugin da adattare (poco) invece di 13 futuri (tanto)
       │
       ▼
  FASE 1 — Deploy 3 pool su Arbitrum (ETH + USDC + WBTC)
     Valida che l'architettura funzioni per tutti i tipi
       │
       ▼
  FASE 2 — Config multi-chain
     Prepara gli script per deployare su Base e BNB
       │
       ├──► FASE 3a — Nuovi plugin (Compound, Silo, Dolomite)
       ├──► FASE 3b — Plugin chain-specific (Venus per BNB, Moonwell per Base)
       └──► FASE 3c — Plugin complessi (Pendle, GMX V2, Ethena, Sky)
                             │
                             ▼
                     FASE 4 — Piramide vault
                     (quando hai 2-3 vault base funzionanti)
```

---

## In sintesi

Stai costruendo un **layer di astrazione universale sopra tutta la DeFi**. L'utente deposita un asset e dimentica. Sotto, il sistema distribuisce automaticamente su decine di protocolli su più chain, ottimizzando per rischio e rendimento. I vault della piramide permettono diversi profili di rischio con un'unica interfaccia.

Il vantaggio architetturale centrale è che ogni nuovo protocollo integrato funziona **automaticamente** per tutti i pool types (ETH, USDC, WBTC) e per tutte le chain dove esiste — grazie all'astrazione del base asset e al pattern 3 Musketeers. Il lavoro si fa una volta sola.