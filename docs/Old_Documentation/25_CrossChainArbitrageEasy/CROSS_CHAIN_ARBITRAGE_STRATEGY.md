# Cross-Chain Arbitrage Strategy (Easy Mode)

> **Side Project**: Low-latency-free arbitrage exploiting cross-chain price inefficiencies

## 📋 Executive Summary

Traditional on-chain arbitrage requires millisecond-level execution and competes with professional MEV searchers using $100k+/month infrastructure. This strategy takes a different approach:

- **No flash loans** → No callback complexity, no MEV competition
- **No speed race** → Execute in 5-10 seconds, not milliseconds
- **No frontrunning risk** → Transactions on different chains are uncorrelated
- **Pre-funded wallets** → Capital already on each chain, ready to act

---

## 🎯 Core Concept

### The Setup

```
┌─────────────────────────────────────────────────────────────────┐
│                     INITIAL CAPITAL DISTRIBUTION                 │
├─────────────────────┬─────────────────────┬─────────────────────┤
│      ARBITRUM       │        BSC          │       MANTLE        │
│  $100 USDC          │  $100 USDC          │  $100 USDC          │
│  100 MNT tokens     │  100 MNT tokens     │  100 MNT tokens     │
└─────────────────────┴─────────────────────┴─────────────────────┘

Total: $600 equivalent, balanced across 3 chains
```

### The Opportunity

When a price discrepancy exists between chains:

```
SCENARIO: MNT token price discrepancy detected

┌──────────────────┐     ┌──────────────────┐
│     MANTLE       │     │    ARBITRUM      │
│  MNT = $0.80     │     │  MNT = $0.85     │
│  (native chain,  │     │  (low liquidity  │
│   high liquidity)│     │   secondary pool)│
└──────────────────┘     └──────────────────┘

SPREAD: 6.25% ($0.05 per token)
```

### The Execution

```
SIMULTANEOUS ACTIONS (no atomicity required):

1. ARBITRUM: Sell 100 MNT → Receive ~$85 USDC (at $0.85)
2. MANTLE:   Buy MNT with $85 USDC → Receive ~106 MNT (at $0.80)

NET RESULT:
┌──────────────────┐     ┌──────────────────┐
│     MANTLE       │     │    ARBITRUM      │
│  $15 USDC        │     │  $185 USDC       │
│  206 MNT tokens  │     │  0 MNT tokens    │
└──────────────────┴─────┴──────────────────┘

PROFIT: +6 MNT tokens (~$4.80 at $0.80)
        Minus gas (~$0.30) = NET ~$4.50
```

---

## 🎯 Token Selection Strategy

### The Key Insight

> **Tokens that are heavily traded on their native chain but have low liquidity on secondary chains create persistent arbitrage opportunities.**

### Ideal Token Characteristics

| Characteristic | Why It Matters | Example |
|---------------|----------------|---------|
| **Native chain dominance** | 90%+ volume on home chain | MNT on Mantle |
| **Secondary chain presence** | Listed on 2-3 other chains | MNT on ARB/BSC |
| **Low secondary liquidity** | <$500k TVL on other chains | Less efficient pricing |
| **Moderate market cap** | $50M-$500M | Enough volume, not over-arbitraged |
| **Not a major asset** | Avoid BTC/ETH/USDC | Too efficiently priced |

### Prime Candidates

#### Tier 1: L2 Native Tokens on Other Chains

| Token | Native Chain | Secondary Chains | Why Good |
|-------|--------------|------------------|----------|
| **MNT** | Mantle | Arbitrum, BSC | Heavy Mantle activity, thin ARB pools |
| **METIS** | Metis | Arbitrum, Ethereum | Same pattern |
| **MANTA** | Manta Pacific | Arbitrum, BSC | New L2, growing |
| **ZK** | zkSync Era | Arbitrum | High native volume |
| **STRK** | Starknet | Ethereum, Arbitrum | Similar dynamics |

#### Tier 2: Protocol Tokens with Multi-Chain Presence

| Token | Primary Chain | Opportunity Chains |
|-------|---------------|-------------------|
| **GMX** | Arbitrum | BSC, Avalanche |
| **RDNT** | Arbitrum | BSC, Ethereum |
| **JOE** | Avalanche | Arbitrum, BSC |
| **CAKE** | BSC | Arbitrum, Ethereum |

#### Tier 3: Bridged Meme/Community Tokens

| Token | Risk Level | Spread Potential |
|-------|------------|------------------|
| **PEPE** on non-ETH chains | Medium | 1-5% |
| **ARB** on BSC | Low | 0.5-2% |
| Chain mascot tokens | High | 2-10% |

### Tokens to AVOID

| Type | Reason |
|------|--------|
| BTC, ETH, major stables | Spread < 0.05%, too efficient |
| Low volume tokens | Can't execute size without slippage |
| Tokens with only 1 chain | No arbitrage possible |
| Rebasing/elastic tokens | Complex accounting |

---

## 💰 Profitability Analysis

### Cost Structure (per arbitrage cycle)

| Cost Component | Arbitrum | BSC | Mantle | Total |
|----------------|----------|-----|--------|-------|
| Swap gas | $0.10 | $0.15 | $0.05 | - |
| DEX fee (0.3%) | 0.3% | 0.3% | 0.3% | - |
| Slippage (est.) | 0.1% | 0.2% | 0.1% | - |
| **Total per leg** | ~0.5% | ~0.6% | ~0.5% | - |

### Break-Even Calculation

```
For a round-trip arbitrage (sell on A, buy on B):
- Chain A costs: ~0.5% + $0.10 gas
- Chain B costs: ~0.5% + $0.15 gas

MINIMUM SPREAD REQUIRED:
- On $100 position: 1.0% + $0.25 = need $1.25 profit → 1.25% spread
- On $500 position: 1.0% + $0.25 = need $5.25 profit → 1.05% spread  
- On $1000 position: 1.0% + $0.25 = need $10.25 profit → 1.025% spread

RULE OF THUMB: Need >1.2% spread to be profitable
```

### Expected Frequency

| Token Type | Spread >1.2% Frequency | Avg Spread When >1.2% |
|------------|------------------------|----------------------|
| Tier 1 (L2 natives) | 3-8x per day | 1.5-3% |
| Tier 2 (Protocol) | 1-3x per day | 1.2-2% |
| Tier 3 (Meme) | 5-15x per day | 2-8% (but risky) |

### Monthly Projection (Conservative)

```
Assumptions:
- $500 capital per chain (3 chains = $1500 total)
- 3 successful arbs per day
- Average profit per arb: $3 (after costs)
- 25 active days per month

PROJECTION:
- Daily: $9
- Monthly: $225
- ROI: 15% monthly / 180% yearly

REALITY CHECK:
- Missed opportunities: -30%
- Bad trades (slippage): -10%
- Inventory imbalance periods: -20%

REALISTIC: $100-150/month on $1500 capital (~8-10% monthly)
```

---

## 🏗️ Technical Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ARBITRAGE BOT                             │
│                     (TypeScript/Node.js)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Price Feed   │  │ Price Feed   │  │ Price Feed   │          │
│  │  Arbitrum    │  │    BSC       │  │   Mantle     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └────────────┬────┴────────────────┘                   │
│                      ▼                                          │
│              ┌──────────────┐                                   │
│              │  Comparator  │                                   │
│              │  Engine      │                                   │
│              └──────┬───────┘                                   │
│                     │                                           │
│         ┌───────────┴───────────┐                              │
│         ▼                       ▼                              │
│  ┌──────────────┐       ┌──────────────┐                       │
│  │ SELL order   │       │ BUY order    │                       │
│  │ (high price  │       │ (low price   │                       │
│  │  chain)      │       │  chain)      │                       │
│  └──────────────┘       └──────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### No Smart Contracts Required!

This strategy can be executed entirely with:
- **ethers.js** / **viem** for transaction signing
- Standard ERC20 approve + DEX router swap calls
- No custom contracts = no audit costs, no deployment complexity

### Bot Components

```typescript
// Simplified structure

interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  dexRouter: string;      // Uniswap/PancakeSwap router
  wallet: Wallet;
  tokens: TokenConfig[];
}

interface ArbitrageOpportunity {
  token: string;
  buyChain: ChainConfig;
  sellChain: ChainConfig;
  buyPrice: number;
  sellPrice: number;
  spreadPercent: number;
  estimatedProfit: number;
}

// Main loop
while (true) {
  const prices = await fetchAllPrices(chains, tokens);
  const opportunities = findArbitrageOpportunities(prices);
  
  for (const opp of opportunities) {
    if (opp.spreadPercent > MIN_SPREAD && opp.estimatedProfit > MIN_PROFIT) {
      await executeArbitrage(opp);
    }
  }
  
  await sleep(POLL_INTERVAL); // 10-30 seconds
}
```

---

## 📊 Rebalancing Strategy

### The Inventory Problem

After multiple arbitrages in one direction, capital becomes imbalanced:

```
AFTER 10 "SELL on ARB, BUY on MANTLE" cycles:

┌──────────────────┐     ┌──────────────────┐
│     MANTLE       │     │    ARBITRUM      │
│  $0 USDC         │     │  $200 USDC       │
│  300 MNT         │     │  0 MNT           │
└──────────────────┘     └──────────────────┘

PROBLEM: Can't execute more arbs in this direction!
```

### Rebalancing Options

| Option | When to Use | Cost |
|--------|-------------|------|
| **Wait for reverse arb** | If direction changes frequently | $0 |
| **Bridge tokens** | If imbalance persists >24h | $1-5 bridge fee |
| **CEX rebalance** | Large imbalances | Withdrawal fees |
| **Accept imbalance** | If one direction dominates | Opportunity cost |

### Automated Rebalance Trigger

```typescript
const IMBALANCE_THRESHOLD = 0.8; // 80% on one chain

if (chainBalance / totalBalance > IMBALANCE_THRESHOLD) {
  // Option 1: Pause arb in this direction
  // Option 2: Trigger bridge (if profitable over time)
  // Option 3: Alert for manual intervention
}
```

---

## ⚠️ Risk Management

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Price moves between txs | Medium | Low | Execute within 10s, use limit orders |
| DEX liquidity dries up | Low | Medium | Check liquidity before swap |
| Bridge failure | Low | High | Don't rely on bridges for arb |
| Smart contract exploit | Very Low | High | Use only verified DEX routers |
| Inventory stuck | Medium | Medium | Rebalancing strategy |
| Gas spike | Low | Low | Set max gas limits |

### Position Sizing Rules

```
RULES:
1. Never use >20% of chain balance in single arb
2. Keep minimum $50 USDC on each chain (for gas + emergency)
3. Max position size = min(chainA_balance, chainB_balance) * 0.5
4. If spread >5%, reduce size (likely slippage issue)
```

### Kill Switch Conditions

```typescript
const KILL_SWITCH_CONDITIONS = {
  maxLossPerDay: 50,           // USD
  maxConsecutiveLosses: 3,
  minHealthyChains: 2,         // Out of 3
  maxGasPrice: {
    arbitrum: 1,               // gwei
    bsc: 5,
    mantle: 0.5
  }
};
```

---

## 🚀 Implementation Roadmap

### Phase 1: Research & Setup (Week 1)
- [ ] Identify 5-10 target tokens
- [ ] Map DEX pools on each chain
- [ ] Set up wallets on 3 chains
- [ ] Fund with test capital ($100/chain)

### Phase 2: Bot Development (Week 2-3)
- [ ] Price fetching module (multi-chain)
- [ ] Opportunity detection logic
- [ ] Swap execution module
- [ ] Logging & monitoring

### Phase 3: Paper Trading (Week 4)
- [ ] Run bot without execution
- [ ] Log all "would have traded" opportunities
- [ ] Analyze hit rate and theoretical P&L

### Phase 4: Live Trading (Week 5+)
- [ ] Start with minimal capital ($100/chain)
- [ ] Gradually increase if profitable
- [ ] Add more tokens/chains over time

---

## 📁 Project Structure

```
CrossChainArbitrageBot/
├── src/
│   ├── config/
│   │   ├── chains.ts          # Chain configurations
│   │   ├── tokens.ts          # Token addresses per chain
│   │   └── dexes.ts           # DEX router addresses
│   ├── services/
│   │   ├── PriceFetcher.ts    # Multi-chain price polling
│   │   ├── OpportunityFinder.ts
│   │   ├── SwapExecutor.ts    # Execute swaps via DEX
│   │   └── Rebalancer.ts      # Inventory management
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── calculations.ts    # Profit/spread calculations
│   │   └── notifications.ts   # Telegram/Discord alerts
│   └── index.ts               # Main entry point
├── .env                       # Private keys, RPC URLs
├── package.json
└── README.md
```

---

## 🔗 Useful Resources

### DEX Routers by Chain

| Chain | DEX | Router Address |
|-------|-----|----------------|
| Arbitrum | Uniswap V3 | `0xE592427A0AEce92De3Edee1F18E0157C05861564` |
| Arbitrum | Camelot | `0xc873fEcbd354f5A56E00E710B90EF4201db2448d` |
| BSC | PancakeSwap V3 | `0x13f4EA83D0bd40E75C8222255bc855a974568Dd4` |
| Mantle | FusionX | `0x5989FB161568b9F133eDf5Cf6787f5597762797F` |

### Price APIs

- **DexScreener**: `https://api.dexscreener.com/latest/dex/tokens/{address}`
- **1inch API**: `https://api.1inch.io/v5.0/{chainId}/quote`
- **CoinGecko**: `https://api.coingecko.com/api/v3/simple/token_price/{platform}`

---

## 📝 Notes

- This is a **side project** for learning and potential small profits
- Not competing with MEV bots - different game entirely
- Start small, scale only if consistently profitable
- Tax implications: each trade is a taxable event in most jurisdictions

---

*Last Updated: December 2024*
*Status: Concept / Planning Phase*
