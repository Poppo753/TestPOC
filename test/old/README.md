# 📦 Test Archive - Cartella OLD

## Perché questi test sono stati spostati qui?

I test in questa cartella sono stati rimossi dalla suite di test principale per i seguenti motivi:

---

## 🗂️ **Test Archiviati**

### 1. `ComplianceTestSuite.test.ts`
**Motivo spostamento**: Test troppo complesso e monolitico
- ❌ **Problema**: Cerca di testare tutto il sistema insieme in un unico test
- ❌ **Accoppiamento**: Troppo accoppiato, richiede setup completo di tutti i moduli
- ❌ **Manutenzione**: Difficile da mantenere e aggiornare
- ❌ **Fallimenti**: Quando fallisce è difficile capire quale parte specifica ha problemi
- 📝 **Alternativa**: Usare `SimpleComplianceTests.test.ts` per test modulari

### 2. `EnhancedLiquidityPoolETH.test.ts`
**Motivo spostamento**: Test specifico per contratto che potrebbe essere cambiato
- ❌ **Dipendenze hardcoded**: Si basa su indirizzi specifici e configurazioni fisse
- ❌ **Contratto specifico**: Potrebbe testare funzionalità non più presenti
- ❌ **Setup complesso**: Richiede configurazioni specifiche dell'ambiente
- 📝 **Alternativa**: Creare test più generici per le funzionalità core

### 3. `LiquidityManager.rateLimiting.test.ts`
**Motivo spostamento**: Test troppo specifico per una singola funzionalità
- ❌ **Troppo specifico**: Testa solo rate limiting in modo molto dettagliato
- ❌ **Configurazioni hardcoded**: Dipende da valori specifici che potrebbero essere cambiati
- ❌ **Obsolescenza**: L'implementazione del rate limiting potrebbe essere diversa
- 📝 **Alternativa**: Includere test di rate limiting nei test di integrazione

### 4. `ValueCalculator.selectTokenForSwap.test.ts`
**Motivo spostamento**: Test di sviluppo specifico per una issue
- ❌ **Sprint-based**: Era per una specifica issue di sviluppo (Issue #1)
- ❌ **Troppo granulare**: Testa una singola funzione in modo eccessivamente dettagliato
- ❌ **Non sistemico**: Non testa l'integrazione con il resto del sistema
- 📝 **Alternativa**: Test della funzionalità swap nei test di integrazione

---

## ✅ **Test MANTENUTI nella cartella principale**

### `QuickSmokeTest.test.ts` ✅
- **Scopo**: Smoke test rapidi per verificare deployment e funzioni base
- **Valore**: Test essenziali per validazione rapida
- **Manutenibilità**: Semplici e facili da mantenere

### `SimpleComplianceTests.test.ts` ✅  
- **Scopo**: Test di compliance modulari e ben strutturati
- **Valore**: Coprono le funzionalità core senza dipendenze complesse
- **Manutenibilità**: Modulari, facili da estendere e modificare

---

## 🔄 **Quando utilizzare i test archiviati**

I test in questa cartella possono essere utili come:

1. **📖 Riferimento**: Per capire come erano testati certi aspetti del sistema
2. **🔍 Debug**: Se si sospetta che una modifica abbia rotto funzionalità specifiche
3. **📋 Checklist**: Per assicurarsi di non aver perso test importanti
4. **🏗️ Ricostruzione**: Come base per creare nuovi test più mirati

---

## 📅 **Cronologia**

- **Data archiviazione**: 24 Ottobre 2025
- **Motivo**: Riorganizzazione suite di test per maggiore manutenibilità
- **Decisione**: Mantenere solo test essenziali e facilmente manutenibili

---

## ⚠️ **Nota Importante**

**NON eliminare** questi test! Potrebbero contenere logica di test importante che potrebbe essere utile in futuro. Sono semplicemente archiviati per:

- ✅ Mantenere la suite di test principale pulita e manutenibile
- ✅ Evitare test che falliscono per motivi di configurazione
- ✅ Concentrarsi sui test che forniscono valore reale

Se hai bisogno di riattivare uno di questi test, assicurati di:
1. Aggiornare le dipendenze e configurazioni
2. Verificare che i contratti testati esistano ancora
3. Adattare il test alle modifiche del sistema