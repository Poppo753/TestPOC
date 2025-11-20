# 📝 SUMMARY - Owner Swap Scripts

Ho creato una suite completa di script per permetterti di swappare facilmente i token nel pool usando UniswapV3Plugin.

## 📂 File Creati

### 1. Script Principale
**`scripts/interact/SwapPoolTokens.ts`**
- Script completo e robusto per swappare token dal pool
- Validazione completa di tutti i parametri
- Output dettagliato con info su gas, prezzi, e risultati
- Gestione errori completa
- Countdown di 5 secondi prima dell'esecuzione

### 2. Script PowerShell Helper
**`scripts/interact/swap-pool.ps1`**
- Interfaccia PowerShell user-friendly
- 8 preset configurati per swap comuni
- Menu interattivo
- Supporto per swap custom
- Conferma prima dell'esecuzione

### 3. Quick Swap con Preset
**`scripts/interact/QuickSwap.ts`**
- Script TypeScript con preset
- Esecuzione rapida con numeri (1-8)
- Stesso set di preset dello script PowerShell

### 4. Documentazione

**`OWNER_SWAP_GUIDE.md`** (root)
- Guida rapida per l'owner
- 3 metodi di esecuzione
- Esempi pratici per ogni caso d'uso
- Troubleshooting completo
- Note su sicurezza e best practices

**`scripts/interact/SWAP_GUIDE.md`**
- Guida veloce con esempi
- Configurazione parametri
- Risoluzione problemi comuni

## 🚀 Come Usare (3 Metodi)

### Metodo 1: PowerShell (CONSIGLIATO)
```powershell
# Menu interattivo
.\scripts\interact\swap-pool.ps1

# Preset veloce
.\scripts\interact\swap-pool.ps1 -Preset 1

# Custom
.\scripts\interact\swap-pool.ps1 -From WETH -To USDC -Percentage 30
```

### Metodo 2: Variabili d'Ambiente
```bash
# Default (50% WETH → USDC)
npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum

# Custom
SWAP_TOKEN_FROM=USDC SWAP_TOKEN_TO=WETH SWAP_PERCENTAGE=30 npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum
```

### Metodo 3: QuickSwap con TypeScript
```bash
npx ts-node scripts/interact/QuickSwap.ts 1
```

## 📊 Preset Disponibili

| # | Descrizione | From | To | % | Slippage |
|---|-------------|------|----|----|----------|
| 1 | Standard WETH→USDC | WETH | USDC | 50% | 3% |
| 2 | Standard USDC→WETH | USDC | WETH | 50% | 3% |
| 3 | Conservative | WETH | USDC | 25% | 2% |
| 4 | Aggressive | USDC | WETH | 75% | 5% |
| 5 | ETH to Bitcoin | WETH | WBTC | 50% | 3% |
| 6 | Bitcoin to ETH | WBTC | WETH | 50% | 3% |
| 7 | USDC to Bitcoin | USDC | WBTC | 30% | 5% |
| 8 | Bitcoin to USDC | WBTC | USDC | 30% | 5% |

## ✅ Prerequisiti

Prima di eseguire, assicurati di avere:

1. **File .env configurato** con:
   - `BEACON_ADDRESS`
   - `LIQUIDITY_MANAGER_ADDRESS`  
   - `ARBITRUM_RPC_URL`
   - `PRIVATE_KEY`

2. **Essere owner** del contratto SwapManager

3. **Token nel pool** da swappare

4. **Swaps abilitati** nel sistema

5. **Gas nel wallet** (~0.001 ETH)

## 🔍 Verifica Prima di Swappare

```bash
# Controlla stato sistema
npx hardhat run scripts/interact/SystemStatus.ts --network arbitrum
```

## ⚙️ Parametri Configurabili

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `SWAP_TOKEN_FROM` | WETH | Token da vendere |
| `SWAP_TOKEN_TO` | USDC | Token da comprare |
| `SWAP_PERCENTAGE` | 50 | % del balance (1-100) |
| `SWAP_SLIPPAGE` | 300 | Basis points (300 = 3%) |
| `SWAP_DEADLINE_MINUTES` | 20 | Minuti per deadline |

## 🎯 Esempi Pratici

### Ribilanciare: ETH → USDC (50%)
```powershell
.\scripts\interact\swap-pool.ps1 -Preset 1
```

### Ribilanciare: USDC → ETH (50%)
```powershell
.\scripts\interact\swap-pool.ps1 -Preset 2
```

### Swap Custom: 15% WETH → USDC con 1% slippage
```powershell
.\scripts\interact\swap-pool.ps1 -From WETH -To USDC -Percentage 15 -Slippage 100
```

### Diversificare in Bitcoin: 50% ETH → WBTC
```powershell
.\scripts\interact\swap-pool.ps1 -Preset 5
```

## 🛡️ Sicurezza

Lo script include:
- ✅ Validazione completa di tutti i parametri
- ✅ Verifica ownership
- ✅ Check balance e liquidità
- ✅ Deadline per protezione MEV
- ✅ Slippage protection
- ✅ Countdown 5 secondi per cancellare
- ✅ Output dettagliato di ogni step

## 📝 Note Importanti

### Slippage
- 100 = 1%, 300 = 3%, 500 = 5%
- Usa slippage più alto per token meno liquidi o swap grandi

### Percentuale
- Non swappare mai 100% se hai bisogno di liquidità
- 25-50% è ragionevole per ribilanciamento

### Gas Cost
- ~200k-400k gas per swap
- Con 0.1 gwei: ~$0.06-0.12 (@ $3000 ETH)

### Owner Authorization
- Il modifier `onlyAuthorizedCaller` in SwapManager permette all'owner di chiamare `performSwap()`
- Non serve passare attraverso LiquidityManager
- L'owner può swappare direttamente

## 🛠 Troubleshooting

### "Caller not authorized"
Verifica di essere l'owner del SwapManager

### "Swaps are disabled"
Abilita swap con: `npx hardhat run scripts/admin/system/EnableSwaps.ts --network arbitrum`

### "No token in pool"
Controlla balance con: `npx hardhat run scripts/interact/SystemStatus.ts --network arbitrum`

### "Insufficient liquidity"
- Riduci la percentuale
- Aumenta lo slippage
- Riprova più tardi

## 📚 Documentazione

- **Guida Owner**: `OWNER_SWAP_GUIDE.md`
- **Guida Veloce**: `scripts/interact/SWAP_GUIDE.md`
- **Script Principale**: `scripts/interact/SwapPoolTokens.ts`
- **PowerShell Helper**: `scripts/interact/swap-pool.ps1`

## 🎉 Pronto all'Uso!

Gli script sono pronti per l'uso. Inizia con:

```powershell
# Mostra menu preset
.\scripts\interact\swap-pool.ps1

# Oppure swap veloce 50% WETH → USDC
.\scripts\interact\swap-pool.ps1 -Preset 1
```

**Buon swap! 🚀**
