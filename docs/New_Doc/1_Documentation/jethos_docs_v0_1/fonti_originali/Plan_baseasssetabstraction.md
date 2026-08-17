# Plan: Base Asset Abstraction + Multi-Pool + Multi-Chain Roadmap

## Vision
Trasformare il sistema vault attuale (ETH-only, Arbitrum-only, 3 protocolli) in una piattaforma multi-pool, multi-chain, multi-protocollo. Architettura a piramide di vault interconnessi.

## Target Finale
- **3 pool types**: WETH, USDC/USDT, WBTC
- **3+ chain**: Arbitrum, Base, BNB Chain (poi altre)
- **10+ protocolli**: Aave V3, Euler V2, Morpho Blue, Compound V3, Dolomite, GMX V2, Pendle, Silo V2, Venus, Moonwell, Ethena, Sky Protocol
- **Piramide vault**: livelli base → raggruppamenti → general vault, con vault superiori che investono negli inferiori

---

## Decisione Architetturale: Core Solo ERC20

Il core accetta **solo ERC20** come base asset. Per il pool "ETH", il base asset è WETH.

**Perché**: ETH nativo non è ERC20 — ha `msg.value`, `payable`, `.call{value}`, `receive()`. Se il core supporta ETH nativo, ogni contratto biforca in due path (payable + transferFrom). Con "solo ERC20", un codebase serve tutti i pool types senza biforcazioni.

**UX per ETH nativo**: Pattern Uniswap — un sottile `DepositHelper` (~50 righe) wrappa ETH↔WETH e chiama il core. Opzionale — chi ha già WETH interagisce direttamente.

```
Utente invia ETH nativo
       │
       ▼
   DepositHelper (wrappa ETH→WETH, chiama core)
       │
       ▼
   LiquidityManager (vede solo WETH ERC20, transferFrom)
```

---

## FASE 0 — Base Asset Abstraction (Refactoring Core)

### Principio
Ogni riferimento a "WETH" nei contratti core diventa riferimento a `BASE_ASSET` configurabile. Il base asset viene risolto via Beacon key `"BASE_ASSET"`. Deploy diversi settano base asset diversi (WETH, USDC, WBTC).

### Contratti da modificare

#### Beacon.sol
- Registrare `"BASE_ASSET"` key → indirizzo del token base (WETH, USDC o WBTC a seconda del pool)
- Opzionale: `getBaseAsset()` convenience function

#### LiquidityManager.sol (IMPATTO MASSIMO)
- `deposit()`: rimuovere `payable`. Parametro `uint256 amount`. Usare `IERC20(baseAsset).safeTransferFrom(msg.sender, address(this), amount)`. Trasferire a ProxyGeneral via ERC20
- `withdraw()`: rimuovere WETH→ETH unwrap. Inviare base asset via `IERC20.safeTransfer()`
- Fee transfer: da `.call{value}` a `IERC20.safeTransfer(feeRecipient, feeAmount)`
- Rimuovere `weth.deposit{value}()` e `weth.withdraw()`
- Usare SafeERC20 ovunque (per compatibilità USDT)

#### ProxyGeneral.sol
- `receive()`: potrebbe non servire più per il base asset flow (valutare se serve per altri motivi)
- Reserve checks: da `WETH.balanceOf` a `baseAsset.balanceOf`
- Emergency transfer: cambiare riferimenti WETH a base asset

#### TokenManager.sol
- Esclusione: da `require(_tokenAddress != wethAddress)` a `require(_tokenAddress != baseAssetAddress)`
- Base asset risolto via Beacon `"BASE_ASSET"`, non registrato nel TokenManager
- WETH diventa un token normale registrabile (nel pool USDC/WBTC) con price feed

#### ValueCalculator.sol (IMPATTO ALTO)
- Pool value base: da `WETH.balanceOf(proxyGeneral)` a `baseAsset.balanceOf(proxyGeneral)`
- Prezzo base asset: usare feed oracle reale (non 1:1 hardcoded). Per USDC il feed USDC/USD restituisce ~$1.00, ma protegge da depeg. Per WETH il feed ETH/USD
- Denominazione: tutte le valutazioni in termini del base asset (o in USD se base = stablecoin)
- `selectTokenForSwap()`: skippa base asset invece di WETH
- Formula invariata: `value = (tokenBalance * pricePerToken) / 10^decimals`

#### SwapManager.sol (~15 riferimenti WETH)
- Rinominare: `_swapToWETH()` → `_swapToBaseAsset()`, `_swapFromWETH()` → `_swapFromBaseAsset()`
- Tutti i `keccak256(bytes("WETH"))` → comparazione con base asset code
- Routing hub: base asset diventa l'hub
- Gas estimation: aggiornare stime per base asset swap

#### Plugin (Aave, Euler, Morpho) — Token Resolution
- `_resolveToken()`: da `if tokenCode == "WETH" → Beacon` a `if tokenCode == baseAssetCode → Beacon`
- `closePositionsForWeth()` → `closePositionsForBaseAsset()`
  - Aave: withdraw aToken del base asset
  - Euler: close positions, track base asset ottenuto
  - Morpho: filter markets dove collateral = base asset

#### Interfacce
- `IProtocolAdapter`: rinominare `closePositionsForWeth` → `closePositionsForBaseAsset`
- `ILiquidityManager`: rimuovere `payable` da deposit
- Aggiornare documentazione return values

#### ChainlinkAdapter.sol
- `setTargetDenomination("USD")` per pool stablecoin
- Registrare feed appropriati per chain (ETH/USD, USDC/USD, WBTC/USD)
- Tutti i prezzi normalizzati a 18 decimali internamente

#### ParameterManager.sol
- I limiti restano `uint256` raw — nessuna perdita di precisione
- I valori cambiano per riflettere il base asset: `maxDeposit = 100000e6` (USDC) vs `100e18` (WETH)
- Il ParameterManager non ha consapevolezza dei decimali — sono solo uint256 confrontati con amounts nello stesso formato

#### EmergencyHandler.sol
- Riferimenti WETH → base asset

#### LensAdapters
- Return values denominati appropriatamente

### Nuovo Contratto: DepositHelper.sol (~50 righe)
- `depositETH()`: payable, wrappa ETH→WETH, approva LiquidityManager, chiama deposit, trasferisce LP tokens all'utente
- `withdrawETH(shares)`: chiama withdraw, riceve WETH, unwrappa, invia ETH all'utente
- Serve **solo** per il pool WETH. Pool USDC/WBTC non ne hanno bisogno.

---

## FASE 1 — Validazione: 3 Pool su Arbitrum

Deploy su Arbitrum con i 3 protocolli esistenti:
- Pool WETH (con DepositHelper per UX ETH nativo)
- Pool USDC
- Pool WBTC

Test end-to-end per validare che l'astrazione funziona.

### Oracle Feeds Arbitrum (Chainlink)
| Token | Feed | Decimali |
|---|---|---|
| ETH/USD | `0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612` | 8 |
| USDC/USD | `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3` | 8 |
| WBTC/USD | `0xd0C7101eACbB49F3deCcCc166d238410D6D46d57` | 8 |
| USDT/USD | `0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7` | 8 |

### Protocolli per Pool Type (Arbitrum)
| Protocollo | WETH Pool | USDC Pool | WBTC Pool |
|---|---|---|---|
| Aave V3 | ✅ supply WETH | ✅ supply USDC | ✅ supply WBTC |
| Euler V2 | ✅ vault WETH | ✅ vault USDC | Verificare vault |
| Morpho Blue | ✅ WETH collateral markets | ✅ USDC come loan token (strategia diversa) | Verificare markets |

---

## FASE 2 — Multi-Chain Config Layer

### Config per Chain
Creare config file con:
- Token addresses (WETH, USDC, USDT, WBTC per chain)
- Oracle feed addresses per chain
- Protocollo addresses per chain
- Gas parameters per chain

### Mappa Protocolli per Chain
| Protocollo | Arbitrum | Base | BNB |
|---|---|---|---|
| Aave V3 | ✅ | ✅ | ✅ |
| Euler V2 | ✅ | ✅ | ❌ |
| Morpho Blue | ✅ | ✅ | ❌ |
| Compound V3 | ✅ | ✅ | ❌ |
| Dolomite | ✅ | ❌ | ❌ |
| GMX V2 | ✅ | ❌ | ❌ |
| Pendle | ✅ | ❌ | ❌ |
| Silo V2 | ✅ | ❌ | ❌ |
| Venus | ❌ | ❌ | ✅ |
| Moonwell | ❌ | ✅ | ❌ |

Deploy test su Base e BNB con Aave V3 (minimo comune denominatore).

---

## FASE 3 — Nuovi Plugin

Ogni plugin segue il pattern 3 Musketeers (Registry + Plugin + LensAdapter). Scritto una volta → funziona per tutti i pool types su tutte le chain.

### Ordine suggerito
1. **Compound V3** — simile ad Aave, multi-chain, basso rischio
2. **Silo V2** — lending/borrowing, Arbitrum
3. **Dolomite** — Arbitrum native, lending
4. **Pendle** — yield tokenization, più complesso
5. **GMX V2** — perp/GM pools, architettura diversa
6. **Venus** — fork Compound, BNB-specific
7. **Moonwell** — fork Compound, Base-specific
8. **Ethena** — USDe staking, pattern unico
9. **Sky Protocol** — (ex MakerDAO)

---

## FASE 4 — Vault Composability (Piramide)

### Architettura a Livelli
```
Livello 4 (top):    USDC General
                         │
Livello 3:     ETH Low Risk │ ETH Med Risk │ ETH High Risk
               USDC Low Risk│ USDC Med Risk│ USDC High Risk
               BTC Low Risk │ BTC Med Risk │ BTC High Risk
                         │
Livello 2:     ETH Delta Neutral │ USDC Delta Neutral │ BTC Delta Neutral
               Strategy Vault A  │ Strategy Vault B
                         │
Livello 1 (base): Lending Vault │ Stable Vault │ No-Risk Vault │ Degen Vault
```

### VaultPlugin (nuovo tipo di plugin)
- Un vault di livello superiore tratta un vault inferiore come un "protocollo esterno"
- `VaultPlugin.deposit()` → deposita nel vault inferiore, riceve LP tokens
- `VaultPlugin.withdraw()` → brucia LP tokens del vault inferiore
- `VaultPlugin.getTotalValue()` → LP tokens × prezzo per share del vault inferiore

Da progettare dopo aver 2-3 vault base funzionanti.

---

## FASE 5 — Espansione Chain

Deploy incrementale:
- Arbitrum: tutti i protocolli disponibili, tutti i pool types
- Base: Aave + Euler + Morpho + Compound + Moonwell
- BNB: Aave + Venus

---

## Sfide Tecniche Trasversali

### Decimali
- WETH: 18 dec, USDC: 6 dec, USDT: 6 dec, WBTC: 8 dec
- Formula `value = (balance * price) / 10^decimals` resta invariata — i decimali del token sono già parametrizzati
- Share calculation: LP token a 18 decimali sempre. Con base a 6 dec, primo deposito di 1000 USDC (1000e6) → 1000e6 shares? O scaling? Valutare fattore 1e12 per mantenere precisione

### USDT Compatibilità
- `transfer()` non restituisce bool → serve SafeERC20 (`safeTransfer`)
- `approve()` richiede reset a 0 → serve `safeIncreaseAllowance` o `forceApprove`
- OpenZeppelin SafeERC20 gestisce entrambi

### Oracle Per Pool Type
- Pool WETH: tutti i prezzi in ETH (oggi) o in USD (post-refactor)
- Pool USDC: tutti i prezzi in USD
- Pool WBTC: tutti i prezzi in USD (o in BTC?)
- Raccomandazione: tutti in USD uniformemente. Chainlink ha feed USD per tutto

### Morpho Blue — USDC come Collaterale
- Su Morpho, USDC è tipicamente il loan token, non il collaterale
- Per il pool USDC: usare USDC nei vault (MorphoVaultPlugin) oppure come loan side
- Serve ricerca mercati disponibili via GraphQL API

---

## Sequenza Dipendenze

```
FASE 0  ──────►  FASE 1  ──────►  FASE 2
(base asset      (3 pool           (multi-chain
 abstraction)     Arbitrum)          config)
                     │                  │
                     ▼                  ▼
                FASE 3a            FASE 3b
                (Compound,         (Venus,
                 Silo,              Moonwell)
                 Dolomite)             │
                     │                 ▼
                     ▼            Deploy Base
                FASE 3c           Deploy BNB
                (Pendle,
                 GMX V2,
                 Ethena, Sky)
                     │
                     ▼
                FASE 4
                (Piramide vault
                 composability)
```

---

## Principio Guida

> Perfeziona Arbitrum prima. Astrai il base asset con 3 plugin (poco lavoro). Ogni nuovo plugin scritto dopo funziona automaticamente per ETH, USDC e WBTC. Base e BNB sono "deploy quando pronto".
