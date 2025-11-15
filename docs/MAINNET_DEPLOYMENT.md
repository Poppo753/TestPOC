# 🚀 Mainnet Deployment Guide - Production Ready

Guida completa per il deployment del sistema su Arbitrum Mainnet con ChainlinkAdapter.

## 📋 Indice

1. [Prerequisiti](#prerequisiti)
2. [Configurazione Iniziale](#configurazione-iniziale)
3. [Deployment Workflow](#deployment-workflow)
4. [Post-Deployment](#post-deployment)
5. [Testing](#testing)
6. [Security Checklist](#security-checklist)

---

## 🔧 Prerequisiti

### Software Requirements
- Node.js v18+
- Hardhat v2.0+
- Git

### Wallet Requirements
- **Deployment Wallet** con almeno **0.5 ETH** per gas
  - ⚠️ Usa un wallet dedicato, NON il tuo wallet principale
  - Puoi recuperare i fondi rimanenti dopo il deployment

### API Keys
1. **Arbitrum RPC URL**
   - Gratuito: https://arb1.arbitrum.io/rpc
   - O ottieni un endpoint da [Alchemy](https://www.alchemy.com/) o [Infura](https://www.infura.io/)

2. **Arbiscan API Key** (per verifica contratti)
   - Ottieni gratis da: https://arbiscan.io/myapikey

### Network Check
```bash
# Verifica di essere su Arbitrum Mainnet (chainId: 42161)
npx hardhat console --network arbitrum
> (await ethers.provider.getNetwork()).chainId
42161n
```

---

## ⚙️ Configurazione Iniziale

### 1. Clone e Setup
```bash
git clone <your-repo>
cd TestSmartContract
npm install
```

### 2. Crea file `.env`
```bash
cp .env.example .env
nano .env  # o usa il tuo editor preferito
```

### 3. Configura `.env` (MINIMO RICHIESTO)
```bash
# RPC
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Wallet
PRIVATE_KEY=your_private_key_without_0x

# Arbiscan
ARBISCAN_API_KEY=your_arbiscan_api_key

# Beacon (lascia vuoto per ora, lo deployeremo)
BEACON_ADDRESS=
```

### 4. Verifica Balance
```bash
npx hardhat run scripts/utils/CheckBalance.ts --network arbitrum
```

---

## 🚀 Deployment Workflow

### FASE 1: Deploy Beacon (Infrastructure)

Il Beacon è il registry centrale di tutti i moduli.

```bash
npx hardhat run scripts/OId/deployBeacon.ts --network arbitrum
```

**Output atteso:**
```
Beacon deployed to: 0x...
```

**✅ Action:** Copia l'address e aggiorna `.env`:
```bash
BEACON_ADDRESS=0x_beacon_address_qui
```

---

### FASE 2: Deploy Moduli + ChainlinkAdapter (Core System)

Questo script deploya:
- ✅ ChainlinkAdapter (production oracle)
- ✅ Configura 9 Chainlink price feeds (USDC, WBTC, ETH, etc.)
- ✅ TokenManager (con ChainlinkAdapter)
- ✅ SwapManager
- ✅ ValueCalculator
- ✅ ParameterManager
- ✅ EmergencyHandler
- ✅ LiquidityManager

```bash
npx hardhat run scripts/deployment/deployModules.mainnet.ts --network arbitrum
```

**⏱ Tempo stimato:** 5-10 minuti

**Output atteso:**
```
🚀 MAINNET DEPLOYMENT - PRODUCTION MODE
================================================================================
📋 Deployment Configuration:
   Deployer: 0xYourAddress
   Balance: 0.8 ETH
   Network: arbitrum (chainId: 42161)
   Beacon: 0x...
   ✅ Beacon verified

================================================================================
📡 STEP 1: Deploying ChainlinkAdapter (Production Oracle)
================================================================================
✅ ChainlinkAdapter deployed: 0x...

================================================================================
🔧 STEP 2: Configuring Chainlink Price Feeds
================================================================================
   Configuring USDC...
      ✅ USDC configured
   Configuring WBTC...
      ✅ WBTC configured
   [... altri 7 tokens ...]

================================================================================
⚙️ STEP 3: Deploying Core Modules
================================================================================
1️⃣ Deploying TokenManager...
   ✅ TokenManager: 0x...
2️⃣ Deploying SwapManager...
   ✅ SwapManager: 0x...
[... altri 4 moduli ...]

================================================================================
🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!
================================================================================
📝 DEPLOYED CONTRACT ADDRESSES:

Core Infrastructure:
   Beacon:             0x...
   ChainlinkAdapter:   0x...

Core Modules:
   TokenManager:       0x...
   SwapManager:        0x...
   ValueCalculator:    0x...
   ParameterManager:   0x...
   EmergencyHandler:   0x...
   LiquidityManager:   0x...
```

**✅ Action:** Copia TUTTI gli addresses e aggiorna `.env`:
```bash
CHAINLINK_ADAPTER_ADDRESS=0x...
TOKEN_MANAGER_ADDRESS=0x...
SWAP_MANAGER_ADDRESS=0x...
VALUE_CALCULATOR_ADDRESS=0x...
PARAMETER_MANAGER_ADDRESS=0x...
EMERGENCY_HANDLER_ADDRESS=0x...
LIQUIDITY_MANAGER_ADDRESS=0x...
```

💾 Il file `deployments/mainnet-<timestamp>.json` viene salvato automaticamente con tutti i dati.

---

### FASE 3: Register Implementations in Beacon

Collega tutti i moduli al Beacon.

```bash
npx hardhat run scripts/admin/beacon/RegisterImplementations.ts --network arbitrum
```

**Output atteso:**
```
📝 Registering TokenManager...
   ✅ Registered successfully
📝 Registering SwapManager...
   ✅ Registered successfully
[... altri 4 moduli ...]

REGISTRATION SUMMARY
Total implementations: 6
✅ Successfully registered: 6
```

---

### FASE 4: Add Tokens (Registra USDC, WBTC, etc.)

⚠️ **PREREQUISITO:** I tokens devono essere già configurati in ChainlinkAdapter (fatto automaticamente nello STEP 2).

#### Esempio: Add USDC
```bash
TOKEN_CODE=USDC \
TOKEN_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831 \
npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum
```

**Output atteso:**
```
🔍 Validating Token Parameters
   Token Code: USDC
   Token Address: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831

🔗 Testing OracleAdapter price retrieval...
   Latest Price: 1.0 USD
   ✅ USDC is supported by OracleAdapter

📝 TRANSACTION: Add Token USDC
   Transaction hash: 0x...
   ✅ Transaction confirmed

📊 Token Info:
   Token Address: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
   Token Decimals: 6
   Heartbeat: 3600s
   Current Price from Oracle: 1.0 USD
```

#### Add altri tokens importanti:
```bash
# WBTC
TOKEN_CODE=WBTC \
TOKEN_ADDRESS=0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f \
npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum

# WETH (wrapped ETH)
TOKEN_CODE=ETH \
TOKEN_ADDRESS=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 \
npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum

# USDT
TOKEN_CODE=USDT \
TOKEN_ADDRESS=0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9 \
npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum
```

---

## 🧪 Testing

### 1. System Status Check
```bash
npx hardhat run scripts/interact/SystemStatus.ts --network arbitrum
```

**Output atteso:**
```
📊 System Status
   Pool Value: 0.0 ETH (empty pool)
   Active Tokens: 4 (USDC, WBTC, ETH, USDT)
   Beacon Status: ✅ All implementations registered
```

### 2. Test Deposit (PRIMO DEPOSIT!)
```bash
npx hardhat run scripts/interact/DepositETH.ts --network arbitrum
```

**Output atteso:**
```
💰 ETH Deposit Script
Using account: 0x...
Account balance: 0.7 ETH

Pre-Deposit State
   Pool Value: 0.0 ETH
   User LP Balance: 0.0 LP

Executing Deposit
   Depositing: 0.1 ETH
   Transaction hash: 0x...
   ✅ Transaction confirmed in block: 12345678

Post-Deposit State
   New Pool Value: 0.099 ETH (0.001 ETH fee)
   New LP Balance: 100.0 LP
   ✅ LP Tokens Received: 100.0 LP
```

### 3. Test Withdrawal
```bash
npx hardhat run scripts/interact/WithdrawETH.ts --network arbitrum
```

---

## 🔐 Post-Deployment

### 1. Verify Contracts su Arbiscan

```bash
# ChainlinkAdapter
npx hardhat verify --network arbitrum <CHAINLINK_ADAPTER_ADDRESS>

# TokenManager
npx hardhat verify --network arbitrum <TOKEN_MANAGER_ADDRESS> \
    <BEACON_ADDRESS> <CHAINLINK_ADAPTER_ADDRESS>

# Altri moduli (solo Beacon come constructor arg)
npx hardhat verify --network arbitrum <SWAP_MANAGER_ADDRESS> <BEACON_ADDRESS>
npx hardhat verify --network arbitrum <VALUE_CALCULATOR_ADDRESS> <BEACON_ADDRESS>
npx hardhat verify --network arbitrum <PARAMETER_MANAGER_ADDRESS> <BEACON_ADDRESS>
npx hardhat verify --network arbitrum <EMERGENCY_HANDLER_ADDRESS> <BEACON_ADDRESS>
npx hardhat verify --network arbitrum <LIQUIDITY_MANAGER_ADDRESS> <BEACON_ADDRESS>
```

### 2. Transfer Ownership (CRITICO!)

⚠️ **NON saltare questo step in production!**

```bash
# Prepara un multi-sig wallet (es. Safe/Gnosis Safe)
MULTISIG_ADDRESS=0x_your_safe_wallet

# Transfer ownership di ogni contratto
npx hardhat run scripts/admin/ownership/TransferOwnership.ts --network arbitrum
```

### 3. Setup Monitoring & Alerts

- **Chainlink Monitoring:** Verifica che i price feeds siano attivi
- **Pool Value Alerts:** Notifiche per cambiamenti anomali (>10%)
- **Circuit Breaker:** Configura pause automatica in caso di errori
- **Gas Price Monitoring:** Alert per gas spikes

### 4. Configure Rate Limits (Sicurezza)

```bash
# Limita withdrawals a X ETH per blocco
npx hardhat run scripts/admin/parameters/SetWithdrawLimits.ts --network arbitrum
```

---

## ✅ Security Checklist

### Pre-Deployment
- [ ] Wallet dedicato per deployment (non main wallet)
- [ ] Balance sufficiente (~0.5 ETH)
- [ ] `.env` NON committato su git
- [ ] Private key sicura e backuppata
- [ ] Testato su Arbitrum Sepolia testnet

### Durante Deployment
- [ ] Beacon deployato e verified
- [ ] ChainlinkAdapter deployato con 9 feeds configurati
- [ ] Tutti i 6 moduli deployati
- [ ] Implementations registrati nel Beacon
- [ ] Tokens principali aggiunti (USDC, WBTC, ETH)
- [ ] Test deposit/withdraw eseguiti con successo

### Post-Deployment
- [ ] Tutti i contratti verified su Arbiscan
- [ ] Ownership trasferita a multi-sig
- [ ] Monitoring attivo (Chainlink feeds, pool value)
- [ ] Circuit breakers configurati
- [ ] Rate limits impostati
- [ ] Emergency pause mechanism testato
- [ ] Backup di tutti gli addresses salvato
- [ ] Documentation aggiornata
- [ ] Security audit completato (per TVL significativo)

---

## 🆘 Troubleshooting

### "Insufficient balance" Error
- Soluzione: Invia più ETH al wallet deployer (minimo 0.5 ETH)

### "BEACON_ADDRESS not configured"
- Soluzione: Deploya prima il Beacon (FASE 1) e aggiorna `.env`

### "Token not supported by OracleAdapter"
- Causa: Token non configurato in ChainlinkAdapter
- Soluzione: Verifica che il token sia nella lista `CHAINLINK_FEEDS` in `deployModules.mainnet.ts`
- Se serve aggiungere un nuovo token: usa `ChainlinkAdapter.addPriceFeed()`

### "Transaction reverted" durante AddToken
- Verifica che il token address sia corretto (mainnet, non testnet!)
- Verifica che il Chainlink feed per quel token esista e sia attivo

### Gas troppo alto
- Arbitrum ha gas molto bassi (~0.1 Gwei)
- Se il gas sembra alto, verifica di essere su Arbitrum e non Ethereum mainnet!

---

## 📚 Script Reference

| Script | Scopo | Network |
|--------|-------|---------|
| `deployBeacon.ts` | Deploy Beacon | Mainnet |
| `deployModules.mainnet.ts` | Deploy tutto (ChainlinkAdapter + moduli) | Mainnet |
| `RegisterImplementations.ts` | Collega moduli al Beacon | Mainnet |
| `AddToken.ts` | Registra token nel sistema | Mainnet |
| `SystemStatus.ts` | Verifica stato sistema | Mainnet |
| `DepositETH.ts` | Deposit ETH nel pool | Mainnet |
| `WithdrawETH.ts` | Withdraw dal pool | Mainnet |
| `UpdateOracles.ts` | Aggiorna heartbeat o price | Mainnet |

---

## 📞 Support

- Issues: GitHub Issues
- Security: security@yourdomain.com
- Docs: https://docs.yourproject.com

---

## 📜 License

MIT License - vedi LICENSE file

---

**🎉 Congratulazioni! Il tuo sistema è ora deployato su Arbitrum Mainnet!**

Per qualsiasi domanda o problema, consulta la documentazione o apri un Issue su GitHub.
