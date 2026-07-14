# 🚀 Production Deployment Scripts

Script production-ready per il deployment completo su Arbitrum Mainnet.

## 📁 Files in questa directory

### `deployModules.mainnet.ts`
Script principale per deployment completo del sistema con ChainlinkAdapter.

**Features:**
- ✅ Deploy ChainlinkAdapter (production oracle)
- ✅ Configurazione automatica di 9 Chainlink price feeds
- ✅ Deploy di tutti i 6 moduli core
- ✅ Validazione post-deployment
- ✅ Salvataggio automatico deployment info in JSON
- ✅ Supporto per Arbitrum Mainnet (chainId: 42161)

**Chainlink Feeds configurati:**
- USDC/USD, USDT/USD, DAI/USD (stablecoins)
- BTC/USD, ETH/USD (major assets)
- LINK/USD, UNI/USD (DeFi tokens)
- ARB/USD (Arbitrum native)

**Usage:**
```bash
BEACON_ADDRESS=0x... npx hardhat run scripts/deployment/deployModules.mainnet.ts --network arbitrum
```

**Output:**
- Console log dettagliato con tutti gli addresses
- File JSON salvato in `deployments/mainnet-<timestamp>.json`
- Next steps guide per completare il setup

---

## 🔄 Deployment Workflow Completo

### Step-by-Step Guide

#### 1️⃣ **Pre-Deployment Check**
```bash
# Verifica balance wallet
npx hardhat run scripts/utils/CheckBalance.ts --network arbitrum

# Output atteso:
# ✅ Balance sufficient for deployment
#    (Required: 0.5 ETH, Available: 0.8 ETH)
```

#### 2️⃣ **Deploy Beacon** (Infrastructure)
```bash
npx hardhat run scripts/OId/deployBeacon.ts --network arbitrum

# Output: Beacon deployed to: 0x...
# ✅ Action: Copia address in .env come BEACON_ADDRESS
```

#### 3️⃣ **Deploy Modules + ChainlinkAdapter** (Core System)
```bash
BEACON_ADDRESS=0x... npx hardhat run scripts/deployment/deployModules.mainnet.ts --network arbitrum

# Tempo: ~5-10 minuti
# Output: 8 contract addresses (Beacon + ChainlinkAdapter + 6 moduli)
# ✅ Action: Copia TUTTI gli addresses in .env
```

#### 4️⃣ **Register Implementations** (Link to Beacon)
```bash
npx hardhat run scripts/admin/beacon/RegisterImplementations.ts --network arbitrum

# Output: ✅ Successfully registered: 6/6
```

#### 5️⃣ **Add Tokens** (Register USDC, WBTC, etc.)
```bash
# USDC
TOKEN_CODE=USDC TOKEN_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831 \
npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum

# WBTC
TOKEN_CODE=WBTC TOKEN_ADDRESS=0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f \
npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum

# ETH
TOKEN_CODE=ETH TOKEN_ADDRESS=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 \
npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum
```

#### 6️⃣ **Verify System** (Health Check)
```bash
npx hardhat run scripts/utils/DeploymentSummary.ts --network arbitrum

# Output:
# 🎉 SYSTEM READY FOR PRODUCTION!
# ✅ Contracts Deployed: 8/8
# ✅ Beacon Configured
# ✅ Oracle Active
# ✅ Ready for Deposits
```

#### 7️⃣ **First Deposit** (Test Live!)
```bash
npx hardhat run scripts/interact/DepositETH.ts --network arbitrum

# Output: ✅ LP Tokens Received: 100.0 LP
```

---

## 📊 Deployment Costs (Arbitrum Mainnet)

Stime basate su gas price medio di ~0.1 Gwei su Arbitrum:

| Component | Estimated Cost |
|-----------|----------------|
| Beacon | ~0.001 ETH |
| ChainlinkAdapter | ~0.003 ETH |
| TokenManager | ~0.005 ETH |
| SwapManager | ~0.004 ETH |
| ValueCalculator | ~0.003 ETH |
| ParameterManager | ~0.002 ETH |
| EmergencyHandler | ~0.002 ETH |
| LiquidityManager | ~0.004 ETH |
| Price Feed Config (9 tokens) | ~0.009 ETH |
| Register Implementations | ~0.006 ETH |
| Add Tokens (4) | ~0.004 ETH |
| **TOTAL** | **~0.043 ETH** |
| **+ Buffer (20%)** | **~0.052 ETH** |

💡 **Consigliato:** Avere almeno **0.5 ETH** nel wallet per sicurezza.

---

## 🔐 Security Notes

### Pre-Deployment
- ⚠️ Usa un **wallet dedicato** per deployment (non il tuo main wallet)
- ⚠️ Testa SEMPRE su **Arbitrum Sepolia testnet** prima di mainnet
- ⚠️ Verifica che `.env` NON sia committato su git
- ⚠️ Backup della private key in luogo sicuro

### Post-Deployment
- 🔒 Transfer ownership a **multi-sig wallet** (Gnosis Safe)
- 🔒 Verify contracts su **Arbiscan**
- 🔒 Setup **monitoring & alerts** (Chainlink feeds, pool value)
- 🔒 Configure **circuit breakers** e rate limits
- 🔒 **Security audit** prima di gestire TVL significativo

---

## 🆘 Troubleshooting

### Error: "Insufficient balance"
**Causa:** Wallet non ha abbastanza ETH per gas.  
**Soluzione:** Invia almeno 0.5 ETH al wallet deployer.

### Error: "BEACON_ADDRESS not configured"
**Causa:** Beacon non deployato o address mancante in .env.  
**Soluzione:** 
1. Deploy Beacon: `npx hardhat run scripts/OId/deployBeacon.ts --network arbitrum`
2. Copia address in `.env`: `BEACON_ADDRESS=0x...`

### Error: "Token not supported by OracleAdapter"
**Causa:** Token non configurato nei Chainlink feeds.  
**Soluzione:** Verifica che il token sia nella lista `CHAINLINK_FEEDS` in `deployModules.mainnet.ts`.  
Se serve un nuovo token: aggiungi manualmente con `chainlinkAdapter.addPriceFeed()`.

### Error: "Network chainId mismatch"
**Causa:** Stai deployando su network sbagliato.  
**Soluzione:** Verifica che `hardhat.config.ts` abbia configurazione corretta per Arbitrum:
```typescript
arbitrum: {
    url: process.env.ARBITRUM_RPC_URL,
    chainId: 42161,
    accounts: [process.env.PRIVATE_KEY]
}
```

### Warning: "Gas price too high"
**Causa:** Gas spike temporaneo (raro su Arbitrum).  
**Soluzione:** Aspetta qualche minuto e riprova. Arbitrum ha gas molto bassi (~0.1 Gwei).

---

## 📚 Related Documentation

- [Full Mainnet Deployment Guide](../../docs/MAINNET_DEPLOYMENT.md)
- [ChainlinkAdapter Documentation](../../contracts/adapters/README.md)
- [AddToken Script Guide](../admin/tokens/README.md)
- [System Architecture](../../docs/01_specifications/ARCHITECTURE.md)

---

## 🔗 Useful Links

- **Arbitrum Bridge:** https://bridge.arbitrum.io/
- **Arbiscan (Block Explorer):** https://arbiscan.io/
- **Chainlink Price Feeds:** https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
- **Gnosis Safe (Multi-sig):** https://app.safe.global/
- **Arbitrum Docs:** https://docs.arbitrum.io/

---

## ✅ Success Checklist

Usa questa checklist per verificare che tutto sia deployato correttamente:

- [ ] **Beacon deployato** e address salvato in .env
- [ ] **ChainlinkAdapter deployato** con 9 price feeds configurati
- [ ] **6 moduli deployati** (TokenManager, SwapManager, etc.)
- [ ] **Implementations registrati** nel Beacon (6/6 success)
- [ ] **Tokens aggiunti** (minimo USDC, WBTC, ETH)
- [ ] **Contratti verified** su Arbiscan
- [ ] **Test deposit eseguito** con successo
- [ ] **Test withdrawal eseguito** con successo
- [ ] **Ownership trasferita** a multi-sig
- [ ] **Monitoring configurato** (alerts per Chainlink + pool)
- [ ] **Backup completo** di tutti gli addresses e configurazioni

---

**🎉 Ready to deploy to mainnet!**

Per qualsiasi domanda, consulta la [Full Deployment Guide](../../docs/MAINNET_DEPLOYMENT.md) o apri un Issue.
