# 🔄 SWAP POOL TOKENS - Guida Rapida per l'Owner

Hai **3 modi** per swappare token dal pool usando UniswapV3Plugin:

---

## 🚀 Metodo 1: Script PowerShell (PIÙ FACILE)

```powershell
# Mostra menu con preset
.\scripts\interact\swap-pool.ps1

# Swap veloce con preset
.\scripts\interact\swap-pool.ps1 -Preset 1    # 50% WETH → USDC
.\scripts\interact\swap-pool.ps1 -Preset 2    # 50% USDC → WETH

# Swap custom
.\scripts\interact\swap-pool.ps1 -From WETH -To USDC -Percentage 30
```

---

## ⚡ Metodo 2: Variabili d'Ambiente

```powershell
# Swap 50% WETH in USDC (default)
npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum

# Swap 30% USDC in WETH
$env:SWAP_TOKEN_FROM="USDC"; $env:SWAP_TOKEN_TO="WETH"; $env:SWAP_PERCENTAGE="30"; npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum

# O in una riga (PowerShell)
$env:SWAP_TOKEN_FROM="WETH"; $env:SWAP_TOKEN_TO="USDC"; $env:SWAP_PERCENTAGE="25"; $env:SWAP_SLIPPAGE="100"; npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum
```

---

## 🎯 Metodo 3: Preset con QuickSwap.ts

```bash
# Mostra menu
npx ts-node scripts/interact/QuickSwap.ts

# Esegui preset
npx ts-node scripts/interact/QuickSwap.ts 1    # 50% WETH → USDC
npx ts-node scripts/interact/QuickSwap.ts 2    # 50% USDC → WETH
npx ts-node scripts/interact/QuickSwap.ts 5    # 50% WETH → WBTC
```

---

## 📋 Preset Disponibili

| # | Swap | % | Slippage |
|---|------|---|----------|
| 1 | WETH → USDC | 50% | 3% |
| 2 | USDC → WETH | 50% | 3% |
| 3 | WETH → USDC | 25% | 2% (conservative) |
| 4 | USDC → WETH | 75% | 5% (aggressive) |
| 5 | WETH → WBTC | 50% | 3% |
| 6 | WBTC → WETH | 50% | 3% |
| 7 | USDC → WBTC | 30% | 5% |
| 8 | WBTC → USDC | 30% | 5% |

---

## ⚙️ Parametri Personalizzabili

```powershell
$env:SWAP_TOKEN_FROM="WETH"        # Token da vendere
$env:SWAP_TOKEN_TO="USDC"          # Token da comprare
$env:SWAP_PERCENTAGE="50"          # % del balance (1-100)
$env:SWAP_SLIPPAGE="300"           # Basis points (300 = 3%)
$env:SWAP_DEADLINE_MINUTES="20"    # Minuti per deadline
```

---

## ✅ Prerequisiti

Prima di eseguire qualsiasi swap, assicurati di avere:

1. ✅ **File .env configurato** con:
   - `BEACON_ADDRESS`
   - `LIQUIDITY_MANAGER_ADDRESS`
   - `ARBITRUM_RPC_URL`
   - `PRIVATE_KEY`

2. ✅ **Sei l'owner** del contratto SwapManager

3. ✅ **Token nel pool** da swappare (verifica con `SystemStatus.ts`)

4. ✅ **Swaps abilitati** (verifica con `SystemStatus.ts`)

5. ✅ **Gas** nel wallet (~0.001 ETH sufficiente)

---

## 🔍 Verifica Sistema Prima di Swappare

```bash
# Controlla stato sistema e balance pool
npx hardhat run scripts/interact/SystemStatus.ts --network arbitrum
```

Output esempio:
```
Pool Balances:
  WETH: 10.5 (50%)
  USDC: 15000.0 (40%)
  WBTC: 0.35 (10%)

Swap Status: ✅ Enabled
Active Plugin: UniswapV3Plugin
```

---

## 🛠 Esempi Pratici

### Ribilanciare Portfolio: Ridurre ETH, Aumentare USDC
```powershell
# Converti 30% degli ETH in USDC
.\scripts\interact\swap-pool.ps1 -Preset 1
```

### Ribilanciare Portfolio: Ridurre USDC, Aumentare ETH
```powershell
# Converti 50% degli USDC in ETH
.\scripts\interact\swap-pool.ps1 -Preset 2
```

### Swap Conservativo (Basso Rischio)
```powershell
# Solo 25% con slippage basso
.\scripts\interact\swap-pool.ps1 -Preset 3
```

### Swap Aggressivo (Per Opportunità)
```powershell
# 75% con slippage più alto
.\scripts\interact\swap-pool.ps1 -Preset 4
```

### Diversificare in Bitcoin
```powershell
# Converti metà ETH in WBTC
.\scripts\interact\swap-pool.ps1 -Preset 5
```

### Swap Custom Preciso
```powershell
# Esattamente 15% WETH → USDC con 1% slippage
.\scripts\interact\swap-pool.ps1 -From WETH -To USDC -Percentage 15 -Slippage 100
```

---

## ⚠️ Note Importanti

### Slippage
- **100 basis points = 1%**
- **300 basis points = 3%** (default)
- **500 basis points = 5%**
- Usa slippage più alto per:
  - Token meno liquidi (WBTC)
  - Swap grandi (>$10k)
  - Mercati volatili

### Percentuale
- **Non swappare mai 100%** se hai bisogno di mantenere liquidità in quel token
- **25-50%** è ragionevole per ribilanciamento
- **>75%** solo se sei sicuro

### Gas Cost
- Circa **200k-400k gas** per swap
- Con 0.1 gwei: **~$0.06-0.12** (@ $3000 ETH)
- Il pool paga il gas, ma viene dedotto dal valore totale

### Deadline
- Default: **20 minuti**
- Protegge da MEV e front-running
- Se lo swap fallisce per "deadline expired", riprova subito

---

## 🛠 Risoluzione Problemi

### ❌ "Caller not authorized"
**Soluzione**: Verifica di essere l'owner
```bash
npx hardhat console --network arbitrum
> const sm = await ethers.getContractAt("SwapManager", "SWAP_MANAGER_ADDRESS")
> await sm.owner()  # Deve essere il tuo address
```

### ❌ "Swaps are disabled"
**Soluzione**: Abilita gli swap
```bash
npx hardhat run scripts/admin/system/EnableSwaps.ts --network arbitrum
```

### ❌ "No WETH in pool to swap"
**Soluzione**: Controlla balance pool
```bash
npx hardhat run scripts/interact/SystemStatus.ts --network arbitrum
```

### ❌ "Best quote below minimum"
**Soluzione**: Aumenta slippage o riduci amount
```powershell
# Aumenta slippage da 3% a 5%
$env:SWAP_SLIPPAGE="500"; npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum
```

### ❌ "Insufficient liquidity"
**Soluzione**: 
- Riduci la percentuale da swappare
- Prova più tardi quando c'è più liquidità su Uniswap
- Aumenta lo slippage (con cautela!)

---

## 📊 Monitoraggio Post-Swap

Dopo lo swap, verifica:

```bash
# Controlla nuovo stato pool
npx hardhat run scripts/interact/SystemStatus.ts --network arbitrum

# Verifica transazione su Arbiscan
# L'hash sarà nell'output dello script
```

---

## 🔐 Sicurezza

✅ **Testato**: Basato su SwapManager production-ready  
✅ **Deadline**: Protezione MEV integrata  
✅ **Slippage**: Protezione da prezzi sfavorevoli  
✅ **Validazione**: Tutti i parametri validati prima dell'esecuzione  
✅ **Countdown**: 5 secondi per cancellare prima dell'esecuzione  

⚠️ **Testa sempre su testnet prima di usare su mainnet!**

---

## 📚 File Utili

- **Script principale**: `scripts/interact/SwapPoolTokens.ts`
- **Script PowerShell**: `scripts/interact/swap-pool.ps1`
- **Guida dettagliata**: `scripts/interact/SWAP_GUIDE.md`
- **Status sistema**: `scripts/interact/SystemStatus.ts`

---

## 🆘 Supporto

Per problemi:
1. Controlla i **log dettagliati** dello script
2. Verifica **SystemStatus.ts** per vedere lo stato
3. Consulta **SWAP_GUIDE.md** per troubleshooting
4. Controlla **docs/** per documentazione completa

---

**Buon swap! 🚀**
