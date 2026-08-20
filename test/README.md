# 🧪 Test Suite - Smart Contract Testing

## 📁 Struttura Test Attuale

Dopo la riorganizzazione del 24 Ottobre 2025, la cartella test contiene:

### ✅ **Test Attivi e Manutenibili**

- **`QuickSmokeTest.test.ts`** - Smoke test rapidi per deployment e funzioni base
- **`SimpleComplianceTests.test.ts`** - Test di compliance modulari e ben strutturati  
- **`old/`** - Cartella con test archiviati (vedi `old/README.md`)

---

## 🚀 **Come Eseguire i Test**

### Test Completi
```bash
npx hardhat test
```

### Solo Smoke Test (Rapido - 2 minuti)
```bash
npx hardhat test test/QuickSmokeTest.test.ts
```

### Solo Compliance Test
```bash
npx hardhat test test/SimpleComplianceTests.test.ts
```

---

## 📋 **Cosa Testano i File Attuali**

### `QuickSmokeTest.test.ts` 
✅ **Scopo**: Verifica che tutto compili e funzioni base
- Deployment di tutti i contratti (Beacon, ProxyGeneral, TokenManager, etc.)
- Connessioni tra contratti via Beacon pattern
- Funzioni base di ogni modulo
- Setup del sistema integrato

### `SimpleComplianceTests.test.ts`
✅ **Scopo**: Test di compliance per funzionalità core
- Sistema di fee (deposit/withdraw fee)
- Withdraw limits e rate limiting
- Sistema di emergenza (contacts, timelock)
- Parameter management
- Swap system enable/disable
- Rate limiting su ProxyGeneral

---

## 🛠️ **Test Mancanti da Creare**

Potresti voler aggiungere questi test specifici:

### 1. **Integration Tests** (`integration.test.ts`)
- Test end-to-end di deposit/withdraw completi
- Test di swap reali con token mock
- Test di emergency scenarios completi

### 2. **Security Tests** (`security.test.ts`)
- Test di reentrancy protection
- Test di access control
- Test di overflow/underflow
- Test di pausa/unpause

### 3. **Performance Tests** (`performance.test.ts`)
- Test di gas optimization
- Test di limiti di transazioni per block
- Test di stress con molti utenti

### 4. **Edge Cases** (`edge-cases.test.ts`)
- Test con valori limite (0, max uint256, etc.)
- Test con stati inconsistenti
- Test di recovery da errori

---

## 🎯 **Best Practices per Nuovi Test**

### ✅ **DO**
- Scrivi test modulari e indipendenti
- Usa setup/teardown appropriati
- Testa una cosa alla volta
- Usa nomi descrittivi per i test
- Includi sia test positivi che negativi

### ❌ **DON'T**
- Non creare test monolitici che testano tutto insieme
- Non usare indirizzi hardcoded (usa mock o deploy fresh)
- Non creare dipendenze tra test
- Non ignorare edge cases
- Non scrivere test che richiedono setup manuale complesso

---

## 🚦 **Stato Attuale dei Test**

| Test File | Status | Coverage | Manutenibilità |
|-----------|---------|----------|----------------|
| `QuickSmokeTest.test.ts` | ✅ Attivo | Deployment + Base | ⭐⭐⭐⭐⭐ |
| `SimpleComplianceTests.test.ts` | ✅ Attivo | Core Features | ⭐⭐⭐⭐⭐ |
| `old/*` | 📦 Archiviati | Specifiche/Legacy | ⭐⭐ |

---

## 📈 **Roadmap Test**

### Fase 1: ✅ **COMPLETATA** - Cleanup 
- [x] Riorganizzazione test esistenti
- [x] Rimozione test problematici  
- [x] Documentazione delle decisioni

### Fase 2: 🎯 **PROSSIMA** - Enhancement
- [ ] Aggiungere integration tests
- [ ] Aggiungere security tests
- [ ] Migliorare code coverage

### Fase 3: 🚀 **FUTURA** - Advanced
- [ ] Performance benchmarking
- [ ] Stress testing
- [ ] Automated CI/CD integration

---

## 🔧 **Environment Setup**

Assicurati di avere configurato:

```bash
# Install dependencies
npm install

# Compile contracts  
npx hardhat compile

# Run tests
npx hardhat test
```

### Environment Variables
Alcuni test potrebbero richiedere:
```env
# .env file
EthResVaultAdress=0x... # Se hai un contratto deployato
BEACON_ADDRESS=0x...     # Se hai un beacon deployato
```

---

## 📞 **Support**

Per domande sui test:
1. Controlla prima `old/README.md` per test archiviati
2. Verifica che i contratti siano compilati: `npx hardhat compile`
3. Controlla che le dipendenze siano installate: `npm install`

Buon testing! 🚀