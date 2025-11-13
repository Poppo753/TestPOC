# 🚀 DeFi System Interaction Scripts

Questi script ti permettono di interagire facilmente con i contratti DeFi deployati, utilizzando tutto il codice già testato nei test di integrazione.

## � Setup Rapido

### 1. **Configurazione Automatica**
```bash
# Mostra la configurazione corrente
npx hardhat run scripts/utils/ShowConfig.ts

# Aggiorna gli indirizzi dopo il deploy
npx hardhat run scripts/utils/UpdateAddresses.ts
```

### 2. **File di Configurazione**

Il sistema usa due file di configurazione:

**📄 `.env`** - Variabili d'ambiente:
```bash
# Indirizzi dei contratti
BEACON_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
LIQUIDITY_MANAGER_ADDRESS=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
# ... altri indirizzi

# Parametri operazionali
DEFAULT_DEPOSIT_AMOUNT=1.0
DEFAULT_WITHDRAW_PERCENTAGE=50
NETWORK=localhost
```

**📄 `scripts/config/config.ts`** - Configurazione TypeScript centralizzata:
- Lettura automatica dal .env
- Validazione degli indirizzi
- Utility per logging
- Connessione automatica ai contratti

## 📁 Script Disponibili

### **Interazione:**
```bash
npx hardhat run scripts/interact/DepositETH.ts --network localhost
```

**Cosa fa:**
- ✅ Verifica stato del pool prima del deposito
- 💰 Deposita ETH nel pool di liquidità
- 🎫 Riceve LP tokens
- 📊 Mostra statistiche post-deposito
- 💰 Calcola prezzo LP token

### 2. **WithdrawETH.ts** - Ritiro ETH
```bash
npx hardhat run scripts/interact/WithdrawETH.ts --network localhost
```

**Cosa fa:**
- ✅ Verifica balance LP tokens
- 🔥 Brucia LP tokens
- 💰 Riceve ETH
- 📊 Mostra statistiche post-ritiro
- 💰 Calcola prezzo LP token nel withdraw

### 3. **SystemStatus.ts** - Stato Sistema
```bash
npx hardhat run scripts/interact/SystemStatus.ts --network localhost
```

**Cosa fa:**
- 📡 Verifica tutti i moduli registrati nel Beacon
- 🌊 Mostra stato del pool di liquidità
- 👤 Mostra balance dell'utente (ETH e LP)
- ⚙️ Verifica parametri di sistema (fee, etc.)
- 🚨 Controlla stato di emergenza
- 🏥 Verifica health generale del sistema

## 🔧 Setup

### 1. **Aggiorna Indirizzi Contratti**

Prima di usare gli script, aggiorna gli indirizzi dei contratti deployati in ogni file:

```typescript
const DEPLOYED_CONTRACTS = {
  beacon: "0x...", // Indirizzo del tuo Beacon deployato
  liquidityManager: "0x...", // Indirizzo del tuo LiquidityManager
  valueCalculator: "0x...", // Indirizzo del tuo ValueCalculator
  parameterManager: "0x..." // Indirizzo del tuo ParameterManager
};
```

### 2. **Configura Network**

Assicurati che il network sia configurato in `hardhat.config.ts`:

```typescript
networks: {
  localhost: {
    url: "http://127.0.0.1:8545"
  },
  // Altri network...
}
```

## 🎯 Workflow Tipico

### Deploy → Test → Interact

1. **Deploy dei contratti:**
```bash
npx hardhat run scripts/deploy/DeployAll.ts --network localhost
```

2. **Esegui i test per verificare tutto funzioni:**
```bash
npx hardhat test test/integration/
```

3. **Controlla stato sistema:**
```bash
npx hardhat run scripts/interact/SystemStatus.ts --network localhost
```

4. **Deposita ETH:**
```bash
npx hardhat run scripts/interact/DepositETH.ts --network localhost
```

5. **Controlla nuovo stato:**
```bash
npx hardhat run scripts/interact/SystemStatus.ts --network localhost
```

6. **Ritira ETH:**
```bash
npx hardhat run scripts/interact/WithdrawETH.ts --network localhost
```

## 💡 Vantaggi di questo Approccio

### **Codice Testato al 100%** ✅
- Tutti gli script usano lo stesso codice dei test
- Se i test passano, gli script funzionano
- Zero bug di integrazione

### **Logging Dettagliato** 📊
- Output con emoji per facilità di lettura
- Metriche pre/post operazione
- Error handling completo

### **Modulare e Riutilizzabile** 🔧
- Ogni script fa una cosa specifica
- Facile da modificare per nuove funzionalità
- Codice pulito e ben documentato

### **Sicurezza** 🛡️
- Gas limits impostati
- Controlli di validazione
- Error handling robusto

## 🚀 Esempi di Output

### Deposito ETH:
```
🚀 STARTING ETH DEPOSIT SCRIPT
💼 Using account: 0x...
💰 Account balance: 100.0 ETH

📊 PRE-DEPOSIT STATE:
   🌊 Pool Value: 0.0 ETH
   🎫 User LP Balance: 0.0 LP

💰 EXECUTING DEPOSIT:
   📥 Depositing: 1.0 ETH
   ⏳ Transaction hash: 0x...
   ✅ Transaction confirmed in block: 123
   ⛽ Gas used: 234567

📊 POST-DEPOSIT STATE:
   🌊 New Pool Value: 0.99 ETH
   🎫 New LP Balance: 0.99 LP
   🎁 LP Tokens Received: 0.99 LP
   💰 LP Token Price: 1.0 ETH per LP

🎉 DEPOSIT SCRIPT COMPLETED!
```

## 🔍 Debug e Troubleshooting

### Errori Comuni:

1. **Contract not found** → Verifica indirizzi in `DEPLOYED_CONTRACTS`
2. **Insufficient funds** → Assicurati di avere ETH per gas
3. **Transaction reverted** → Controlla stato sistema con `SystemStatus.ts`

### Debug Mode:
Aggiungi `console.log` extra per debug dettagliato.

---

## 🎉 Conclusione

Con questi script puoi interagire con il sistema DeFi in modo sicuro e intuitivo, sfruttando tutto il lavoro fatto nei test di integrazione! 

**Il codice è lo stesso che hai già testato → Zero rischi, massima efficienza!** 🚀