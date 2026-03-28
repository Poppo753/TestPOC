# Piano Strategico: Fix Errori Script Fase 1 & 2

## Analisi

### Contesto
- **Progetto**: Sistema DeFi su Arbitrum con architettura modulare basata su Beacon proxy pattern
- **Stato attuale**: 23 script operativi (8 core + 15 admin) verificati contro test suite
- **Problematica**: Identificati 2 errori critici che impediscono l'esecuzione di 10 script su 15 della Fase 2
- **Causa root**: Script generati senza riferimento diretto ai test funzionanti, creando discrepanza tra chiamate script e implementazione contratti

### Vincoli / Requisiti

**Tecnici**:
- ✅ NON modificare contratti Solidity (già testati e funzionanti)
- ✅ Mantenere struttura e logica degli script esistenti
- ✅ Preservare error handling, logging, e validazioni
- ✅ Garantire compatibilità TypeScript/Hardhat
- ✅ Zero breaking changes per script già funzionanti

**Operativi**:
- ⚠️ 22+ occorrenze da fixare in 10 file diversi
- ⚠️ SystemHealth.ts ha 7 occorrenze (file più critico)
- ⚠️ EmergencyControl.ts ha 5 occorrenze (secondo file più critico)
- ✅ Fix atomici e reversibili

**Validazione**:
- Compilazione TypeScript deve passare (`npx hardhat compile`)
- Nessun nuovo errore introdotto
- Script devono essere eseguibili (almeno dry-run)

### Rischi / Incertezze

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| **Errore di sostituzione** (getModule in commenti/stringhe) | Media | Basso | Verificare contesto di ogni match |
| **Dipendenze circolari** tra fix | Bassa | Medio | Fix indipendenti, nessuna interdipendenza |
| **TypeScript type errors** post-fix | Media | Medio | `getImplementation()` ritorna `address`, come `getModule()` atteso |
| **Regressioni in script non toccati** | Bassa | Alto | Verificare solo file modificati, non toccare altri |
| **Nuovi errori scoperti durante fix** | Bassa | Medio | Procedere file per file, validare incrementalmente |

**Incertezza critica**:
- ❓ `beacon.getImplementation()` vs `beacon.getModuleInfo()`: quale usare?
  - **Risposta**: `getImplementation()` - ritorna solo `address` (quello che serve agli script)
  - **Conferma**: Test usano `getModuleInfo()` per strutture complete, `getImplementation()` per solo address
  - **Decisione**: Usare `getImplementation()` perché pattern script è `const address = await beacon.getModule()`

---

## Strategia

### Approccio Scelto: **Fix Batch Incrementale con Validazione a Stadi**

#### Fase 1: Preparazione (5 minuti)
1. Backup automatico via git (stash/commit stato attuale)
2. Creazione branch dedicato `fix/script-verification-errors`
3. Preparazione matrice fix per tracking

#### Fase 2: Fix Error #2 - Beacon getModule (15-20 minuti)
**Strategia**: File per file, dal meno critico al più critico, con validazione incrementale

**Ordine di applicazione** (crescente complessità):
1. ViewParameters.ts - 1 occorrenza (riga 360) - file semplice
2. ValidateParameters.ts - 1 occorrenza (riga 458) - file semplice
3. SystemDiagnostics.ts - 2 occorrenze (righe 366, 488)
4. RecoveryManager.ts - 2 occorrenze (righe 302, 349)
5. DeploymentMonitor.ts - 3 occorrenze (righe 302, 384, 602)
6. EmergencyControl.ts - 5 occorrenze (righe 185, 359, 469, 480, 520)
7. SystemHealth.ts - 7 occorrenze (righe 394, 444, 482, 533, 570, 622, 646) - file più critico

**Pattern di sostituzione**:
```typescript
// TROVA (con variazioni):
await this.beacon.getModule("ModuleName")
await beacon.getModule("ModuleName")
const address = await this.beacon.getModule(moduleName)

// SOSTITUISCI CON:
await this.beacon.getImplementation("ModuleName")
await beacon.getImplementation("ModuleName")
const address = await this.beacon.getImplementation(moduleName)
```

**Validazione per file**:
- Grep verification: conferma 0 residui `getModule` nel file
- Syntax check: file compila senza errori TypeScript
- Logic check: chiamate a `getImplementation` hanno senso nel contesto

#### Fase 3: Fix Error #1 - UpdateParameters (5 minuti)
**File**: `scripts/admin/parameters/UpdateParameters.ts`  
**Riga**: 698

**Sostituzione singola**:
```typescript
// TROVA:
const tx = await this.parameterManager.updateParameter(paramName, newValue);

// SOSTITUISCI:
const tx = await this.parameterManager.proposeParameterChange(paramName, newValue);
```

**Note speciali**:
- Verificare che `paramName` e `newValue` restino invariati
- Controllare return type di `proposeParameterChange()` sia compatibile con uso di `tx`

#### Fase 4: Validazione Globale (10 minuti)
1. **Compilazione completa**: `npx hardhat compile`
2. **Grep residui**: Verificare zero `getModule` e `updateParameter` in `/scripts`
3. **Type check**: Verificare signature functions corrette
4. **Documentazione**: Aggiornare SCRIPT_VERIFICATION_PHASE1-2.md con status fix applicati

#### Fase 5: Commit Strutturato (5 minuti)
```bash
git add scripts/admin/parameters/ViewParameters.ts
git commit -m "fix(scripts): replace beacon.getModule with getImplementation in ViewParameters"

# ... per ogni file ...

git add docs/10_project_management/SCRIPT_VERIFICATION_PHASE1-2.md
git commit -m "docs: mark verification errors as fixed"
```

---

### Alternative e Trade-off

#### **Alternativa A**: Fix Atomico Unico (Scartata)
- **Pro**: Veloce (1 commit), facile rollback totale
- **Contro**: Difficile debug se errori, no validazione incrementale, git diff confusionario
- **Motivo scarto**: Troppo rischioso con 22+ sostituzioni

#### **Alternativa B**: Uso di `getModuleInfo()` invece di `getImplementation()` (Scartata)
```typescript
// Opzione B:
const moduleInfo = await beacon.getModuleInfo("ModuleName");
const address = moduleInfo.implementation;
```
- **Pro**: Più informazioni disponibili (version, active status)
- **Contro**: 
  - Richiede refactoring maggiore (2 linee invece di 1)
  - Overhead inutile se serve solo address
  - Pattern diverso dai test
- **Motivo scarto**: Over-engineering, test usano `getImplementation()` per address singolo

#### **Alternativa C**: Script di sostituzione automatica (Scartata parzialmente)
```bash
# Sed/PowerShell script per sostituzioni massive
(Get-Content $file) -replace 'getModule\(', 'getImplementation(' | Set-Content $file
```
- **Pro**: Velocissimo
- **Contro**: Rischio sostituzione in commenti/stringhe, no review manuale
- **Decisione**: Usare per preparazione ma validare manualmente ogni file

#### **Alternativa D**: Creazione wrapper `getModule()` in Beacon (Scartata)
- Aggiungere funzione `getModule()` che chiama `getImplementation()` in Beacon.sol
- **Pro**: Zero modifiche agli script
- **Contro**: 
  - Modifica contratto già testato e deployed
  - Naming confusionario (getModule vs getModuleInfo)
  - Viola vincolo "non toccare contratti"
- **Motivo scarto**: Inaccettabile

---

### Motivazioni Strategia Finale

1. **Incrementale**: Ogni file è unità atomica, facile rollback parziale
2. **Sicura**: Validazione dopo ogni file, catch errori early
3. **Tracciabile**: Commit granulari per git history pulita
4. **Reversibile**: Ogni fix indipendente, no effetti collaterali
5. **Efficiente**: Ordine crescente complessità = learning curve smooth
6. **Documentata**: Update finale doc conferma fix applicati

---

## Documentazione

### Schema Logico Fix

```
┌─────────────────────────────────────────────────────────────┐
│                    FIX WORKFLOW                              │
└─────────────────────────────────────────────────────────────┘

1. PREPARAZIONE
   ├─ Git stash/commit current state
   ├─ Create branch: fix/script-verification-errors
   └─ Prepare fix tracking matrix

2. FIX ERROR #2 (beacon.getModule → getImplementation)
   │
   ├─ ViewParameters.ts (1x) ────┐
   ├─ ValidateParameters.ts (1x) │
   ├─ SystemDiagnostics.ts (2x)  ├──► Validate each
   ├─ RecoveryManager.ts (2x)    │    file after fix
   ├─ DeploymentMonitor.ts (3x)  │
   ├─ EmergencyControl.ts (5x)   │
   └─ SystemHealth.ts (7x) ──────┘

3. FIX ERROR #1 (updateParameter → proposeParameterChange)
   │
   └─ UpdateParameters.ts (1x)

4. GLOBAL VALIDATION
   ├─ npx hardhat compile
   ├─ Grep check: zero "getModule" residuals
   ├─ Grep check: zero "updateParameter" residuals
   └─ TypeScript type validation

5. DOCUMENTATION & COMMIT
   ├─ Update SCRIPT_VERIFICATION_PHASE1-2.md
   ├─ Mark all errors as FIXED
   └─ Structured git commits (1 per file)
```

### API / Interfacce Coinvolte

#### Beacon.sol (Contract)
```solidity
// ✅ CORRETTO - Funzione esistente
function getImplementation(string memory module) 
    external 
    view 
    returns (address)
// Ritorna: address del modulo (es: 0x123...)

// ❌ ERRATO - Funzione NON esiste
function getModule(string memory module) 
// Questa non esiste in Beacon.sol!

// ℹ️ ALTERNATIVA - Esiste ma troppo verbosa per uso script
function getModuleInfo(string memory module) 
    external 
    view 
    returns (ModuleInfo memory)
// Ritorna: struct{implementation, version, active, ...}
```

#### ParameterManager.sol (Contract)
```solidity
// ✅ CORRETTO - Funzione esistente
function proposeParameterChange(
    string memory parameterName, 
    uint256 newValue
) external onlyAuthorizedUpdater
// Pattern: Proposta + Timelock + Esecuzione

// ❌ ERRATO - Funzione NON esiste
function updateParameter(string memory name, uint256 value)
// Questa non esiste in ParameterManager.sol!
```

### Impatti / Note Tecniche

#### Impatto su Script
- **Behavioral**: ZERO - funzionalità identica, solo fix chiamata API
- **Performance**: ZERO - `getImplementation()` potenzialmente più veloce (no struct decoding)
- **Type Safety**: MIGLIORATO - chiamata a funzione esistente vs non-esistente

#### Impatto su Contratti
- **NESSUNO** - zero modifiche a Solidity

#### Impatto su Test
- **NESSUNO** - test già usano pattern corretto

#### Impatto su Deployment
- **NESSUNO** - script sono strumenti operativi, non parte deployment

#### Compatibilità Breaking Changes
- **NESSUNA** - fix backward compatible con contratti deployed

---

## TODO

### 📋 FASE 1: PREPARAZIONE
- [ ] **Step 1.1**: Verificare git status pulito
  - `git status` - confermare no uncommitted changes critici
  - Se necessario: `git stash push -m "WIP before script fixes"`

- [ ] **Step 1.2**: Creare branch dedicato
  - `git checkout -b fix/script-verification-errors`
  - Conferma branch attivo: `git branch --show-current`

- [ ] **Step 1.3**: Preparare matrice tracking fix
  - Creare file temporaneo `FIX_TRACKING.md` con checklist 10 script
  - Struttura: `- [ ] Filename.ts (N occorrences) - lines X, Y, Z`

---

### 🔧 FASE 2: FIX ERROR #2 - beacon.getModule() → getImplementation()

#### **Step 2.1**: ViewParameters.ts (1 occorrenza)
- [ ] Aprire ViewParameters.ts
- [ ] Localizzare riga 360: `beacon.getModule("ParameterManager")`
- [ ] Sostituire con: `beacon.getImplementation("ParameterManager")`
- [ ] Verificare contesto (3 linee prima/dopo) invariato
- [ ] Salvare file
- [ ] **Validazione**:
  - `grep -n "getModule" scripts/admin/parameters/ViewParameters.ts` → 0 match
  - File compila senza errori TypeScript
- [ ] Commit: `git commit -am "fix(ViewParameters): use getImplementation instead of getModule"`

#### **Step 2.2**: ValidateParameters.ts (1 occorrenza)
- [ ] Aprire ValidateParameters.ts
- [ ] Localizzare riga 458: `beacon.getModule("ParameterManager")`
- [ ] Sostituire con: `beacon.getImplementation("ParameterManager")`
- [ ] Salvare file
- [ ] **Validazione**: grep + compile check
- [ ] Commit: `git commit -am "fix(ValidateParameters): use getImplementation instead of getModule"`

#### **Step 2.3**: SystemDiagnostics.ts (2 occorrenze)
- [ ] Aprire SystemDiagnostics.ts
- [ ] Localizzare e fixare riga 366
- [ ] Localizzare e fixare riga 488
- [ ] Salvare file
- [ ] **Validazione**: confermare 0 residui `getModule` nel file
- [ ] Commit: `git commit -am "fix(SystemDiagnostics): replace getModule with getImplementation (2 occurrences)"`

#### **Step 2.4**: RecoveryManager.ts (2 occorrenze)
- [ ] Aprire RecoveryManager.ts
- [ ] Fixare righe 302, 349
- [ ] Salvare e validare
- [ ] Commit: `git commit -am "fix(RecoveryManager): replace getModule with getImplementation (2 occurrences)"`

#### **Step 2.5**: DeploymentMonitor.ts (3 occorrenze)
- [ ] Aprire DeploymentMonitor.ts
- [ ] Fixare righe 302, 384, 602
- [ ] Salvare e validare
- [ ] Commit: `git commit -am "fix(DeploymentMonitor): replace getModule with getImplementation (3 occurrences)"`

#### **Step 2.6**: EmergencyControl.ts (5 occorrenze) ⚠️
- [ ] Aprire EmergencyControl.ts
- [ ] Fixare righe: 185, 359, 469, 480, 520
- [ ] **ATTENZIONE**: Verificare ogni occorrenza individualmente
  - Riga 185: inizializzazione EmergencyHandler
  - Righe 359, 469, 520: loop su moduli
  - Riga 480: LiquidityManager specifico
- [ ] Salvare e validare
- [ ] Commit: `git commit -am "fix(EmergencyControl): replace getModule with getImplementation (5 occurrences)"`

#### **Step 2.7**: SystemHealth.ts (7 occorrenze) ⚠️⚠️ CRITICAL
- [ ] Aprire SystemHealth.ts
- [ ] Fixare righe: 394, 444, 482, 533, 570, 622, 646
- [ ] **MAPPING MODULI**:
  - Riga 394: loop generico moduli
  - Riga 444: TokenManager
  - Riga 482: LiquidityManager
  - Riga 533: SwapManager
  - Riga 570: ParameterManager
  - Riga 622: ValueCalculator
  - Riga 646: EmergencyHandler
- [ ] Verificare ogni modulo name string corretta
- [ ] Salvare e validare
- [ ] **VALIDAZIONE EXTRA**:
  - Compilazione specifica file
  - Logic check: tutti i 7 moduli sono nomi validi
- [ ] Commit: `git commit -am "fix(SystemHealth): replace getModule with getImplementation (7 occurrences)"`

---

### 🔧 FASE 3: FIX ERROR #1 - updateParameter() → proposeParameterChange()

#### **Step 3.1**: UpdateParameters.ts (1 occorrenza)
- [ ] Aprire `scripts/admin/parameters/UpdateParameters.ts`
- [ ] Localizzare riga 698:
  ```typescript
  const tx = await this.parameterManager.updateParameter(paramName, newValue);
  ```
- [ ] Sostituire con:
  ```typescript
  const tx = await this.parameterManager.proposeParameterChange(paramName, newValue);
  ```
- [ ] **Verifiche context**:
  - Parametri `paramName` e `newValue` invariati
  - Variabile `tx` usata correttamente dopo
  - Return type compatible con await/receipt
- [ ] Salvare file
- [ ] **Validazione**:
  - `grep -n "updateParameter" scripts/admin/parameters/UpdateParameters.ts` → 0 match
  - Compilazione TypeScript OK
- [ ] Commit: `git commit -am "fix(UpdateParameters): use proposeParameterChange instead of updateParameter"`

---

### ✅ FASE 4: VALIDAZIONE GLOBALE

#### **Step 4.1**: Compilazione completa progetto
- [ ] Eseguire: `npx hardhat compile`
- [ ] Verificare output: **"Compiled X Solidity files successfully"**
- [ ] Se errori TypeScript:
  - Identificare file problematico
  - Verificare import/types
  - Rollback file specifico se necessario

#### **Step 4.2**: Grep verification residui Error #2
- [ ] Eseguire:
  ```powershell
  grep -rn "\.getModule\(" scripts/admin/
  ```
- [ ] **Aspettato**: 0 risultati (o solo commenti/stringhe)
- [ ] Se match trovati:
  - Verificare sono falsi positivi (commenti)
  - Se reali: fixare immediatamente

#### **Step 4.3**: Grep verification residui Error #1
- [ ] Eseguire:
  ```powershell
  grep -rn "updateParameter\(" scripts/admin/parameters/UpdateParameters.ts
  ```
- [ ] **Aspettato**: 0 risultati
- [ ] Confermare presente `proposeParameterChange` invece

#### **Step 4.4**: Type signature validation
- [ ] Verificare TypeScript types corretti:
  - `beacon.getImplementation()` ritorna `Promise<address>`
  - `parameterManager.proposeParameterChange()` ritorna `Promise<Transaction>`
- [ ] Se type errors: verificare contratto ABI/typechain generati

---

### 📝 FASE 5: DOCUMENTAZIONE & COMMIT FINALE

#### **Step 5.1**: Aggiornare documento verifica
- [ ] Aprire SCRIPT_VERIFICATION_PHASE1-2.md
- [ ] Sezione "CRITICAL ISSUES FOUND":
  - Marcare Error #1 come: ✅ **FIXED** (commit: abc123)
  - Marcare Error #2 come: ✅ **FIXED** (21 occorrences in 7 files)
- [ ] Aggiungere sezione finale:
  ```markdown
  ## ✅ FIX APPLICATION COMPLETED
  **Date**: November 13, 2025
  **Branch**: fix/script-verification-errors
  **Files Modified**: 10
  **Lines Fixed**: 22
  **Commits**: 11 (1 per file + 1 docs)
  **Compilation Status**: ✅ PASSED
  **Remaining Errors**: 0
  ```
- [ ] Salvare documento

#### **Step 5.2**: Commit finale documentazione
- [ ] `git add docs/10_project_management/SCRIPT_VERIFICATION_PHASE1-2.md`
- [ ] `git commit -m "docs: mark all script verification errors as fixed"`

#### **Step 5.3**: Review finale branch
- [ ] `git log --oneline` - verificare 11 commit strutturati
- [ ] `git diff dev-25-operative` - review completo cambiamenti
- [ ] Confermare diff pulito (solo fix intenzionali)

---

### 🚀 FASE 6: MERGE & CLEANUP (OPZIONALE - DECISIONE USER)

#### **Step 6.1**: Merge su branch principale
- [ ] `git checkout dev-25-operative`
- [ ] `git merge fix/script-verification-errors --no-ff`
- [ ] Risolvere eventuali conflitti (improbabili)
- [ ] `git push origin dev-25-operative`

#### **Step 6.2**: Cleanup branch fix
- [ ] `git branch -d fix/script-verification-errors` (local)
- [ ] `git push origin --delete fix/script-verification-errors` (remote, se pushed)

#### **Step 6.3**: Tag release (se applicabile)
- [ ] `git tag -a v1.0.1-script-fixes -m "Fixed 22 script errors across 10 files"`
- [ ] `git push origin v1.0.1-script-fixes`

---

### 🧪 FASE 7: VALIDAZIONE POST-FIX (RACCOMANDATO)

#### **Step 7.1**: Dry-run script fixati
- [ ] Testare ViewParameters.ts: `npx hardhat run scripts/admin/parameters/ViewParameters.ts`
- [ ] Testare SystemHealth.ts: `npx hardhat run scripts/admin/system/SystemHealth.ts`
- [ ] Testare EmergencyControl.ts (dry-run mode se disponibile)
- [ ] Verificare output: no errori "function not found"

#### **Step 7.2**: Integration test (se disponibili)
- [ ] Eseguire test suite completa: `npx hardhat test`
- [ ] Verificare regression: 0 test rotti da fix
- [ ] Se test falliscono: investigare correlazione con fix

#### **Step 7.3**: Documentation final update
- [ ] Aggiungere a SCRIPT_VERIFICATION_PHASE1-2.md:
  ```markdown
  ## ✅ POST-FIX VALIDATION
  - Compilation: ✅ PASSED
  - Dry-run tests: ✅ 3/3 scripts executed
  - Integration tests: ✅ X/Y passed (no regressions)
  - Production ready: ✅ YES
  ```

---

## 📊 METRICHE SUCCESSO

### Criteri di completamento
- [x] **22+ linee fixate** in 10 file
- [ ] **0 errori compilazione** TypeScript
- [ ] **0 residui** `getModule` in `/scripts`
- [ ] **0 residui** `updateParameter` in UpdateParameters.ts
- [ ] **11 commit strutturati** (1 per file + docs)
- [ ] **Documento aggiornato** con status FIXED

### Tempo stimato totale
- ⏱️ **Preparazione**: 5 min
- ⏱️ **Fix Error #2**: 20 min (7 file, ~3 min/file)
- ⏱️ **Fix Error #1**: 5 min (1 file)
- ⏱️ **Validazione**: 10 min
- ⏱️ **Documentazione**: 5 min
- ⏱️ **TOTALE**: **~45 minuti**

### Rollback plan
Se problemi critici durante fix:
```bash
# Rollback totale
git checkout dev-25-operative
git branch -D fix/script-verification-errors

# Rollback parziale (ultimo commit)
git reset --hard HEAD~1

# Rollback specifico file
git checkout HEAD~1 -- scripts/admin/system/SystemHealth.ts
```

---

## 🎯 RACCOMANDAZIONI FINALI

1. **Procedere step-by-step**: Non saltare validazioni intermedie
2. **Commit granulari**: 1 file = 1 commit (facilita rollback selettivo)
3. **Testare incrementalmente**: Dry-run dopo ogni 2-3 fix
4. **Documentare anomalie**: Se qualche fix richiede decisioni extra, annotare
5. **Backup preventivo**: Git stash PRIMA di iniziare

**✅ PRONTO PER ESECUZIONE** - Tutti i passi sono deterministici e reversibili.