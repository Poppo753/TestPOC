# 🚀 Guida ai Test di Compliance - DeFi System

## 📋 Indice
1. [Come Eseguire i Test](#come-eseguire-i-test)
2. [Struttura dei Test](#struttura-dei-test)
3. [Script di Verifica](#script-di-verifica)
4. [Troubleshooting](#troubleshooting)

---

## 🏃 Come Eseguire i Test

### Opzione 1: Test Semplificati (RACCOMANDATO per iniziare)

```powershell
# Compila i contratti
npx hardhat compile

# Esegui i test semplificati
npx hardhat test test/SimpleComplianceTests.test.ts
```

### Opzione 2: Test Completi (Richiede dipendenze aggiuntive)

```powershell
# Prima installa le dipendenze
npm install --save-dev @nomicfoundation/hardhat-chai-matchers --legacy-peer-deps
npm install --save-dev @nomicfoundation/hardhat-network-helpers --legacy-peer-deps

# Poi esegui i test completi
npx hardhat test test/ComplianceTestSuite.test.ts
```

### Opzione 3: Esegui TUTTI i Test

```powershell
npx hardhat test
```

---

## 📊 Struttura dei Test

### 1. **SimpleComplianceTests.test.ts** (✅ PRONTO ALL'USO)
Test base che verifica:
- ✅ Deployment di tutti i contratti
- ✅ Sistema commissioni (fee)
- ✅ Limiti di withdraw
- ✅ Sistema di emergenza
- ✅ Gestione parametri
- ✅ Sistema swap
- ✅ Rate limiting

**Vantaggi:**
- Non richiede dipendenze aggiuntive
- Veloce da eseguire
- Perfetto per test di sviluppo

### 2. **ComplianceTestSuite.test.ts** (📦 Completo)
Test avanzati che includono:
- ✅ Scenari end-to-end complessi
- ✅ Test di integrazione tra moduli
- ✅ Simulazione emergenze con timelock
- ✅ Test governance parametri
- ✅ Verifica compliance 100%

**Vantaggi:**
- Coverage completo
- Test realistici
- Verifica compliance totale

---

## 🔍 Script di Verifica

### Verifica Contratti Deployed

Se hai già deployato i contratti su Arbitrum, usa lo script di verifica:

```powershell
# Imposta le variabili d'ambiente
$env:BEACON_ADDRESS="0x..." # Il tuo Beacon address
$env:PROXY_GENERAL_ADDRESS="0x..." # Il tuo ProxyGeneral address

# Esegui lo script di verifica
npx hardhat run scripts/verifyCompliance.ts --network arbitrum
```

Lo script ti mostrerà:
- ✅ Stato di ogni modulo
- ✅ Configurazione fee system
- ✅ Limiti di withdraw
- ✅ Contatti emergenza
- ✅ Parametri registrati
- ✅ Rate limiting attivo
- ✅ Report compliance finale

---

## 🎯 Esempio di Output

Quando esegui i test, vedrai qualcosa del genere:

```
✅ DeFi System - Core Compliance Tests
  🏗️ 1. CONTRACTS DEPLOYMENT
    ✅ Should deploy Beacon successfully
       Beacon deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
    ✅ Should deploy ProxyGeneral successfully
       ProxyGeneral deployed at: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
    ✅ Should deploy LiquidityManager successfully
    
  💰 2. FEE SYSTEM TESTS
    ✅ Should set deposit fee correctly
       Deposit fee set to: 100 basis points (1%)
    ✅ Should set withdraw fee correctly
    ✅ Should reject excessive fees
    
  🚦 3. WITHDRAW LIMITS TESTS
    ✅ Should set withdraw limits correctly
       Hourly: 10.0 ETH
       Daily: 100.0 ETH

  ... (continua)

🎯 COMPLIANCE VERIFICATION REPORT
============================================================
01. ✅ Beacon Pattern Architecture
02. ✅ Modular System Design
03. ✅ Fee System (Basis Points + Caps)
...
16. ✅ End-to-End Testing Suite

🚀 COMPLIANCE STATUS: 100% COMPLETE! ✨
🏆 ALL TESTS PASSED - PRODUCTION READY!
============================================================
```

---

## 🐛 Troubleshooting

### Problema 1: "Cannot find module 'hardhat'"

**Soluzione:**
```powershell
npm install
```

### Problema 2: "Error: Cannot find module '@nomicfoundation/hardhat-toolbox'"

**Soluzione:**
```powershell
npm install --save-dev @nomicfoundation/hardhat-toolbox --legacy-peer-deps
```

### Problema 3: Test falliscono con "insufficient funds"

**Soluzione:**
I test usano la rete locale di Hardhat che fornisce account con ETH di test automaticamente. Assicurati di NON usare `--network arbitrum` quando esegui i test.

```powershell
# ❌ SBAGLIATO
npx hardhat test --network arbitrum

# ✅ GIUSTO
npx hardhat test
```

### Problema 4: "Error: VM Exception while processing transaction: revert"

**Soluzione:**
Compila i contratti prima di eseguire i test:

```powershell
npx hardhat clean
npx hardhat compile
npx hardhat test
```

### Problema 5: Test molto lenti

**Soluzione:**
Esegui solo i test essenziali:

```powershell
# Solo deployment tests
npx hardhat test test/SimpleComplianceTests.test.ts --grep "DEPLOYMENT"

# Solo fee system tests
npx hardhat test test/SimpleComplianceTests.test.ts --grep "FEE SYSTEM"

# Solo un test specifico
npx hardhat test test/SimpleComplianceTests.test.ts --grep "Should deploy Beacon"
```

---

## 📖 Comandi Utili

### Compilazione

```powershell
# Compila tutti i contratti
npx hardhat compile

# Pulisci e ricompila
npx hardhat clean
npx hardhat compile

# Vedi info di compilazione
npx hardhat compile --show-stack-traces
```

### Test

```powershell
# Tutti i test
npx hardhat test

# Test specifico
npx hardhat test test/SimpleComplianceTests.test.ts

# Test con dettagli
npx hardhat test --verbose

# Test con gas report
REPORT_GAS=true npx hardhat test

# Test con coverage
npx hardhat coverage
```

### Deployment Locale

```powershell
# Avvia node locale
npx hardhat node

# In un altro terminale, deploya
npx hardhat run scripts/deployBeacon.ts --network localhost
```

---

## 🎓 Come Leggere i Risultati

### ✅ Test Passato
```
✅ Should deploy Beacon successfully
   Beacon deployed at: 0x5FbDB...
```
Significa che il test è passato correttamente.

### ❌ Test Fallito
```
1) Should reject excessive fees
   Error: Expected transaction to be reverted
```
Significa che c'è un problema nel codice. Leggi l'errore per capire cosa sistemare.

### ⏭️ Test Skippato
```
- Should test advanced feature (skipped)
```
Il test è stato saltato (probabilmente perché richiede setup aggiuntivo).

---

## 🚀 Prossimi Passi

Dopo che tutti i test passano:

1. ✅ **Test Locali Passano** → Procedi al punto 2
2. 🔧 **Configura Arbitrum** → Aggiungi la rete nel `hardhat.config.ts`
3. 🚀 **Deploy su Testnet** → Usa gli script di deployment
4. ✅ **Verifica su Testnet** → Usa `verifyCompliance.ts`
5. 🎯 **Deploy su Mainnet** → Dopo testing completo

---

## 📞 Supporto

Se hai problemi:
1. Controlla questa guida
2. Verifica gli errori di compilazione: `npx hardhat compile`
3. Pulisci e ricompila: `npx hardhat clean && npx hardhat compile`
4. Reinstalla dipendenze: `rm -rf node_modules && npm install`

---

## 🎉 Compliance Checklist

Prima del deployment production:

- [ ] ✅ Tutti i test passano
- [ ] ✅ Coverage > 80%
- [ ] ✅ Nessun warning di compilazione
- [ ] ✅ Gas optimization verificata
- [ ] ✅ Security audit completato
- [ ] ✅ Documentazione aggiornata
- [ ] ✅ Testnet deployment verificato
- [ ] ✅ Emergency procedures testate

---

## 📚 Risorse Aggiuntive

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Chai Matchers](https://ethereum-waffle.readthedocs.io/en/latest/matchers.html)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

---

**Buon Testing! 🚀**
