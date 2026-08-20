# 🔄 Swap Pool Tokens - Guida Rapida

Script per swappare token all'interno del pool usando UniswapV3Plugin.

## 🚀 Uso Rapido

### Swap 50% degli ETH in USDC (default)
```bash
npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum
```

### Swap 30% USDC in WETH
```bash
SWAP_TOKEN_FROM=USDC SWAP_TOKEN_TO=WETH SWAP_PERCENTAGE=30 \
npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum
```

## ⚙️ Configurazione

Variabili d'ambiente disponibili:

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `SWAP_TOKEN_FROM` | `WETH` | Token da vendere |
| `SWAP_TOKEN_TO` | `USDC` | Token da comprare |
| `SWAP_PERCENTAGE` | `50` | % del balance da swappare (1-100) |
| `SWAP_SLIPPAGE` | `300` | Slippage in basis points (300 = 3%) |
| `SWAP_DEADLINE_MINUTES` | `20` | Minuti per deadline |

## 📋 Prerequisiti

1. ✅ Essere **owner** del contratto SwapManager
2. ✅ Avere **token nel pool** da swappare  
3. ✅ **SwapManager** configurato con UniswapV3Plugin
4. ✅ File **.env** con BEACON_ADDRESS e LIQUIDITY_MANAGER_ADDRESS

## 🎯 Esempi

```bash
# Swap 25% WETH in USDC con slippage 1%
SWAP_PERCENTAGE=25 SWAP_SLIPPAGE=100 \
npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum

# Swap 75% USDC in WETH con slippage 5%  
SWAP_TOKEN_FROM=USDC SWAP_TOKEN_TO=WETH SWAP_PERCENTAGE=75 SWAP_SLIPPAGE=500 \
npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum

# Swap metà WETH in WBTC
SWAP_TOKEN_FROM=WETH SWAP_TOKEN_TO=WBTC SWAP_PERCENTAGE=50 \
npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum
```

## ⚠️ Note

- **Slippage**: 300 basis points = 3% (100 = 1%, 500 = 5%)
- **Gas**: ~200k-400k gas (~$0.06-0.12 @ $3000 ETH, 0.1 gwei)
- **Deadline**: Lo script aspetta 5 secondi prima di eseguire
- **Sicurezza**: Tutti i parametri vengono validati prima dell'esecuzione

## 🛠 Risoluzione Problemi

- **"Caller not authorized"**: Verifica di essere l'owner
- **"Swaps are disabled"**: Abilita swap con `EnableSwaps.ts`
- **"No token in pool"**: Controlla balance con `SystemStatus.ts`
- **"Invalid token"**: Verifica che il token sia registrato in TokenManager

Per documentazione completa, vedi `README_SWAP.md`.
