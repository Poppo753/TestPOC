# Piano Strategico: Aggiornamento API Reference e Diagramma Interattivo

> **✅ PROGETTO COMPLETATO - 17 Novembre 2025**
> 
> **API Reference v3.0:** 193/193 funzioni documentate (100%) ✅  
> **Sistema Dinamico:** Implementato con fonte di verità unica ✅  
> **Breaking Changes:** 4 identificati e documentati ✅
> 
> Vedi sezione "COMPLETAMENTO PROGETTO" in fondo per dettagli completi.

---

## Analisi

### Contesto
Il progetto è un sistema DeFi modulare su Arbitrum composto da 8 moduli principali (Beacon, ProxyGeneral, TokenManager, ValueCalculator, LiquidityManager, SwapManager, EmergencyHandler, ParameterManager). Sono stati eseguiti numerosi test di integrazione con successo, indicando che il sistema è maturo e funzionante.

**Documenti da aggiornare:**
1. **API_Reference.md** (~1458 righe) - Documentazione completa di tutte le funzioni
2. **diagram_detailed.html** - Visualizzazione interattiva delle relazioni tra funzioni

### Vincoli / Requisiti
- ✅ Tutti i test di integrazione passano (26 file di test)
- ✅ Sistema modulare con dipendenze ben definite
- ✅ Documentazione esistente da usare come template
- ✅ HTML già funzionante con React embedded
- 🔍 Necessario identificare tutte le modifiche effettuate dall'ultima versione documentata
- 🔍 Mantenere coerenza tra codice sorgente, API Reference e diagramma HTML
- 📝 Aggiornamento incrementale modulo per modulo per evitare errori

### Rischi / Incertezze
- ⚠️ **Scope Drift**: Non sappiamo esattamente quante funzioni sono state aggiunte/modificate/rimosse
- ⚠️ **Sincronizzazione**: Le tre fonti di verità (contracts/, API_Reference.md, diagram_detailed.html) potrebbero essere disallineate
- ⚠️ **Breaking Changes**: Potrebbero esserci modifiche alle signature che richiedono aggiornamenti agli esempi
- ⚠️ **Mapping Complesso**: Le chiamate tra funzioni in `functionCalls` potrebbero essere obsolete
- ⚠️ **Documentazione Mancante**: Nuove funzioni potrebbero non avere ancora documentazione

---

## Strategia

### Approccio Scelto: **Audit Incrementale a 3 Fasi**

#### **Fase 1: Discovery & Inventory** 
Analizzare ogni modulo Solidity per identificare:
- Funzioni pubbliche/external attualmente implementate
- Signature corrette (parametri, return values, modifiers)
- Eventi emessi
- Chiamate a altri moduli/contratti
- Modifiche rispetto alla versione documentata

#### **Fase 2: Documentation Sync**
Per ogni modulo, aggiornare l'API_Reference.md:
- Aggiungere nuove funzioni scoperte
- Aggiornare signature e descrizioni funzioni esistenti
- Rimuovere funzioni deprecate
- Validare esempi di codice
- Aggiornare tabelle eventi e error codes

#### **Fase 3: Interactive Diagram Update**
Aggiornare il diagram_detailed.html:
- Sincronizzare l'array `modules` con le funzioni reali
- Aggiornare `functionCalls` con le dipendenze corrette
- Aggiornare `functionDetails` con access control e descrizioni
- Validare link alla documentazione
- Testare interattività e rendering

### Alternative e Trade-off

| Approccio | Pro | Contro | Scelta |
|-----------|-----|--------|--------|
| **Full Rewrite** | Partenza pulita, nessun debito tecnico | Rischio alto, perdita conoscenza storica | ❌ |
| **Automated Parsing** | Veloce, oggettivo | Richiede tooling, perde contesto umano | ❌ |
| **Incremental Audit** | Controllato, basso rischio, completo | Richiede tempo | ✅ |
| **Spot Fixes** | Velocissimo | Incompletezza garantita | ❌ |

### Motivazioni
- **Incrementale**: Permette validazione step-by-step senza introdurre errori a cascata
- **Modulo-per-modulo**: Mantiene focus e permette checkpoint frequenti
- **3 Fasi**: Separa discovery (oggettiva) da documentation (soggettiva) da implementation (tecnica)
- **Low Risk**: Non tocchiamo il codice Solidity, solo documentazione

---

## Documentazione

### Schema Logico dell'Aggiornamento

```
┌─────────────────────────────────────────────────────────────────┐
│                    FASE 1: DISCOVERY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Per ogni modulo in contracts/:                                │
│  1. Leggere contract Solidity                                  │
│  2. Estrarre lista funzioni pubbliche/external                 │
│  3. Annotare signature completa (params, returns, modifiers)   │
│  4. Identificare chiamate a external contracts/modules         │
│  5. Documentare eventi emessi                                  │
│  6. Comparare con versione in API_Reference.md                 │
│                                                                 │
│  Output: Inventory Report per modulo (diff vs documentato)    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ⬇️
┌─────────────────────────────────────────────────────────────────┐
│                  FASE 2: API REFERENCE SYNC                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Per ogni modulo (usando Inventory Report):                    │
│  1. Aggiornare sezione header del modulo                       │
│  2. Per ogni funzione nuova: creare entry completa             │
│  3. Per ogni funzione modificata: aggiornare signature/docs    │
│  4. Per ogni funzione rimossa: eliminare entry                 │
│  5. Aggiornare tabelle "Events Emitted"                        │
│  6. Aggiornare sezione "Called By"                             │
│  7. Validare esempi di codice                                  │
│                                                                 │
│  Output: API_Reference.md aggiornato e validato                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ⬇️
┌─────────────────────────────────────────────────────────────────┐
│                 FASE 3: HTML DIAGRAM UPDATE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Aggiornare array `modules` con funzioni corrette           │
│  2. Aggiornare `functionCalls` con dipendenze reali            │
│  3. Aggiornare `functionDetails` con metadata corretti         │
│  4. Sincronizzare link docs con API_Reference.md               │
│  5. Testare rendering e interattività                          │
│  6. Validare colori/categorizzazione funzioni                  │
│                                                                 │
│  Output: diagram_detailed.html funzionante e sincronizzato     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### API / Interfacce da Creare

**Inventory Report Template** (per ogni modulo):
```markdown
## [ModuleName] Inventory Report

### Funzioni Aggiunte
- [ ] functionName(params) returns (type) - access_modifier
  - Description: ...
  - Calls: [Module.function, ...]
  - Events: [EventName, ...]

### Funzioni Modificate
- [ ] functionName
  - Old Signature: ...
  - New Signature: ...
  - Changes: [param added, return type changed, ...]

### Funzioni Rimosse
- [ ] deprecatedFunction - reason

### Dipendenze Cambiate
- [ ] Now calls: [newDependency1, ...]
- [ ] No longer calls: [oldDependency1, ...]

### Note di Implementazione
- ...
```

### Impatti / Note Tecniche

1. **API_Reference.md**
   - Dimensione attuale: ~1458 righe
   - Stima post-aggiornamento: 1500-2000 righe (se aggiunte nuove funzioni)
   - Sezioni da validare: Events Index, Error Codes, Common Patterns

2. **diagram_detailed.html**
   - JavaScript inline: ~2288 righe
   - 3 oggetti da sincronizzare: `functionCalls`, `functionDetails`, `modules`
   - Validare rendering con tutti i browser

3. **Nessun Impatto su Codice Solidity**
   - Zero modifiche ai contracts
   - Zero modifiche agli script di deploy
   - Zero modifiche ai test

4. **Backward Compatibility**
   - I link esistenti in API_Reference.md potrebbero rompersi se rinominiamo sezioni
   - Mantenere anchor IDs compatibili

---

## TODO

### 📦 FASE 1: DISCOVERY & INVENTORY

#### 1.1 Beacon Module Audit
- [ ] Leggere `contracts/Beacon.sol` completo
- [ ] Estrarre tutte le funzioni public/external con signature
- [ ] Identificare chiamate a altri moduli (Ownable, etc.)
- [ ] Documentare eventi emessi
- [ ] Creare Beacon Inventory Report
- [ ] Comparare con API_Reference.md sezione Beacon (#beacon)

#### 1.2 ProxyGeneral Module Audit
- [ ] Leggere `contracts/ProxyGeneral.sol` completo
- [ ] Estrarre tutte le funzioni public/external con signature
- [ ] Identificare chiamate IERC20, Beacon, WETH
- [ ] Documentare eventi emessi (incluso ModuleAuthorized con moduleType)
- [ ] Creare ProxyGeneral Inventory Report
- [ ] Comparare con API_Reference.md sezione ProxyGeneral (#proxygeneral)

#### 1.3 TokenManager Module Audit
- [ ] Leggere `contracts/TokenManager.sol` completo
- [ ] Estrarre tutte le funzioni public/external
- [ ] Identificare integrazioni Chainlink (AggregatorV3Interface)
- [ ] Documentare eventi e strutture dati (TokenInfo, OracleConfig)
- [ ] Creare TokenManager Inventory Report
- [ ] Comparare con API_Reference.md sezione TokenManager (#tokenmanager)

#### 1.4 ValueCalculator Module Audit
- [ ] Leggere `contracts/ValueCalculator.sol` completo
- [ ] Estrarre tutte le funzioni public/external
- [ ] Identificare chiamate a TokenManager, ProxyGeneral, Beacon
- [ ] Documentare logica di caching e invalidazione
- [ ] Creare ValueCalculator Inventory Report
- [ ] Comparare con API_Reference.md sezione ValueCalculator (#valuecalculator)

#### 1.5 LiquidityManager Module Audit
- [ ] Leggere `contracts/LiquidityManager.sol` completo
- [ ] Estrarre tutte le funzioni public/external
- [ ] Identificare chiamate a ValueCalculator, ProxyGeneral, WETH
- [ ] Documentare meccanismi di rate limiting
- [ ] Creare LiquidityManager Inventory Report
- [ ] Comparare con API_Reference.md sezione LiquidityManager (#liquiditymanager)

#### 1.6 SwapManager Module Audit
- [ ] Leggere `contracts/SwapManager.sol` completo
- [ ] Estrarre tutte le funzioni public/external
- [ ] Identificare integrazioni DEX (SimpleSwap, altri router)
- [ ] Documentare logica di slippage protection
- [ ] Creare SwapManager Inventory Report
- [ ] Comparare con API_Reference.md sezione SwapManager (#swapmanager)

#### 1.7 EmergencyHandler Module Audit
- [ ] Leggere `contracts/EmergencyHandler.sol` completo
- [ ] Estrarre tutte le funzioni public/external
- [ ] Identificare chiamate a ProxyGeneral (pause/unpause)
- [ ] Documentare meccanismi di timelock
- [ ] Creare EmergencyHandler Inventory Report
- [ ] Comparare con API_Reference.md sezione EmergencyHandler (#emergencyhandler)

#### 1.8 ParameterManager Module Audit
- [ ] Leggere `contracts/ParameterManager.sol` completo
- [ ] Estrarre tutte le funzioni public/external
- [ ] Identificare logica di governance (proposte, esecuzione)
- [ ] Documentare strutture ProposalData, ParameterInfo
- [ ] Creare ParameterManager Inventory Report
- [ ] Comparare con API_Reference.md sezione ParameterManager (#parametermanager)

#### 1.9 Contracts Aggiuntivi Audit
- [ ] Verificare `contracts/adapters/` (OracleAdapter, SwapAdapter, etc.)
- [ ] Verificare `contracts/interfaces/` per interfacce esposte
- [ ] Verificare `contracts/mocks/` per capire comportamenti simulati
- [ ] Documentare dipendenze esterne (Chainlink, DEX, WETH)

#### 1.10 Consolidamento Discovery Phase
- [ ] Aggregare tutti gli Inventory Reports in un master document
- [ ] Identificare pattern comuni (es: onlyAuthorizedModule usage)
- [ ] Calcolare statistiche (funzioni aggiunte, modificate, rimosse)
- [ ] Preparare summary per Fase 2

---

### 📝 FASE 2: API REFERENCE SYNC

#### 2.1 Aggiornamento Beacon Section
- [ ] Aggiornare header section con dipendenze corrette
- [ ] Per ogni funzione in Beacon Inventory: aggiornare/creare entry
- [ ] Validare signature, parameters, returns
- [ ] Aggiornare esempi di codice con valori reali
- [ ] Aggiornare "Called By" sections
- [ ] Validare gas costs (se cambiati)

#### 2.2 Aggiornamento ProxyGeneral Section
- [ ] Aggiornare header section
- [ ] **CRITICAL**: Validare breaking change `authorizeModule(address, string)`
- [ ] Aggiornare tutte le funzioni mint, burn, transfer
- [ ] Validare emergency functions
- [ ] Aggiornare esempi con nuovi parametri
- [ ] Aggiornare Events Index con nuovo `ModuleAuthorized` event

#### 2.3 Aggiornamento TokenManager Section
- [ ] Aggiornare header section
- [ ] Validare funzioni di oracle management
- [ ] Aggiornare strutture dati (TokenInfo, OracleConfig)
- [ ] Validare heartbeat logic
- [ ] Aggiornare esempi con token reali (ARB, USDC, etc.)

#### 2.4 Aggiornamento ValueCalculator Section
- [ ] Aggiornare header section
- [ ] Validare funzioni di caching
- [ ] Aggiornare logica di price aggregation
- [ ] Validare formule matematiche nei commenti
- [ ] Aggiornare esempi con calcoli reali

#### 2.5 Aggiornamento LiquidityManager Section
- [ ] Aggiornare header section
- [ ] Validare deposit/withdraw flows completi
- [ ] Aggiornare rate limiting parameters
- [ ] Validare emergency withdraw logic
- [ ] Aggiornare diagrammi di flusso (se presenti)

#### 2.6 Aggiornamento SwapManager Section
- [ ] Aggiornare header section
- [ ] Validare integrazioni DEX
- [ ] Aggiornare slippage protection mechanisms
- [ ] Validare multi-hop swap logic (se implementato)
- [ ] Aggiornare esempi con swap reali

#### 2.7 Aggiornamento EmergencyHandler Section
- [ ] Aggiornare header section
- [ ] Validare emergency contacts management
- [ ] Aggiornare timelock mechanisms
- [ ] Validare system health checks
- [ ] Aggiornare esempi con scenari reali

#### 2.8 Aggiornamento ParameterManager Section
- [ ] Aggiornare header section
- [ ] Validare governance flow (propose → execute)
- [ ] Aggiornare parameter registry
- [ ] Validare emergency parameter changes
- [ ] Aggiornare esempi con proposte reali

#### 2.9 Aggiornamento Appendici
- [ ] Aggiornare Architecture Overview con nuovi moduli/adapter
- [ ] Aggiornare Common Patterns con nuovi pattern identificati
- [ ] Ricostruire Events Index completo
- [ ] Ricostruire Error Codes completo
- [ ] Validare Enhancement Functions section
- [ ] Aggiornare Glossary con nuovi termini

#### 2.10 Validazione Finale API Reference
- [ ] Verificare tutti i link interni (anchors)
- [ ] Verificare coerenza terminologia
- [ ] Spell check completo
- [ ] Validare code syntax highlighting
- [ ] Testare rendering Markdown in VS Code e GitHub

---

### 🎨 FASE 3: HTML DIAGRAM UPDATE

#### 3.1 Preparazione Data Structures
- [ ] Creare mapping completo: Contract Functions → HTML IDs
- [ ] Creare mapping: Function Calls → Arrow Targets
- [ ] Creare mapping: Access Modifiers → Badge Colors
- [ ] Preparare template per nuove entries

#### 3.2 Aggiornamento `modules` Array
- [ ] Aggiornare Beacon module con funzioni corrette
- [ ] Aggiornare ProxyGeneral module con funzioni corrette
- [ ] Aggiornare TokenManager module con funzioni corrette
- [ ] Aggiornare ValueCalculator module con funzioni corrette
- [ ] Aggiornare LiquidityManager module con funzioni corrette
- [ ] Aggiornare SwapManager module con funzioni corrette
- [ ] Aggiornare EmergencyHandler module con funzioni corrette
- [ ] Aggiornare ParameterManager module con funzioni corrette
- [ ] Aggiungere nuovi moduli (adapters, se necessario)

#### 3.3 Aggiornamento `functionCalls` Object
- [ ] Aggiornare Beacon function calls
- [ ] Aggiornare ProxyGeneral function calls
- [ ] Aggiornare TokenManager function calls (Chainlink integration)
- [ ] Aggiornare ValueCalculator function calls
- [ ] Aggiornare LiquidityManager function calls
- [ ] Aggiornare SwapManager function calls (DEX integration)
- [ ] Aggiornare EmergencyHandler function calls
- [ ] Aggiornare ParameterManager function calls
- [ ] Validare chiamate a External contracts (IERC20, AggregatorV3, etc.)

#### 3.4 Aggiornamento `functionDetails` Object
- [ ] Aggiornare Beacon function details
- [ ] Aggiornare ProxyGeneral function details
- [ ] Aggiornare TokenManager function details
- [ ] Aggiornare ValueCalculator function details
- [ ] Aggiornare LiquidityManager function details
- [ ] Aggiornare SwapManager function details
- [ ] Aggiornare EmergencyHandler function details
- [ ] Aggiornare ParameterManager function details
- [ ] Sincronizzare `docs` links con API_Reference.md anchors

#### 3.5 Sincronizzazione Access Control
- [ ] Validare badge colors per access modifiers
- [ ] Aggiornare `.access-owner` class usage
- [ ] Aggiornare `.access-auth` class usage
- [ ] Aggiornare `.access-view` class usage
- [ ] Aggiornare `.access-public` class usage
- [ ] Aggiornare `.access-emergency` class usage

#### 3.6 Aggiornamento Reverse Call Map
- [ ] Rigenerare `reverseCallMap` object (chi chiama questa funzione)
- [ ] Validare completezza delle relazioni inverse
- [ ] Testare "Called By" tooltip nel diagram

#### 3.7 Testing & Validation HTML
- [ ] Testare apertura in browser (Chrome, Firefox, Edge)
- [ ] Testare click su ogni modulo
- [ ] Testare hover su ogni funzione
- [ ] Testare apertura modale documentazione per ogni funzione
- [ ] Testare toggle View Mode (Modules / Calls / Details)
- [ ] Testare performance con tutte le frecce visualizzate
- [ ] Validare responsiveness (mobile, tablet, desktop)

#### 3.8 Ottimizzazione & Polish
- [ ] Ottimizzare animazioni (se laggy)
- [ ] Aggiungere loading states (se necessario)
- [ ] Migliorare contrasto colori per accessibility
- [ ] Aggiungere keyboard navigation (opzionale)
- [ ] Comprimere SVG assets (se presenti)

#### 3.9 Documentazione HTML Usage
- [ ] Creare README section per diagram_detailed.html
- [ ] Documentare come aggiungere nuove funzioni
- [ ] Documentare come aggiornare le relazioni
- [ ] Fornire template per nuovi moduli

#### 3.10 Final Validation & Deployment
- [ ] Verificare che tutti i link docs portino alle sezioni corrette in API_Reference.md
- [ ] Verificare che non ci siano funzioni orfane (senza modulo)
- [ ] Verificare che non ci siano chiamate a funzioni inesistenti
- [ ] Creare changelog delle modifiche al diagram
- [ ] Commit finale con messaggio descrittivo

---

## ✅ Acceptance Criteria

La documentazione sarà considerata completa quando:

1. ✅ **API_Reference.md**:
   - Ogni funzione pubblica/external in `contracts/` ha una entry completa
   - Tutte le signature sono accurate
   - Tutti gli esempi sono funzionanti
   - Zero broken links interni

2. ✅ **diagram_detailed.html**:
   - Ogni funzione in `contracts/` è visualizzata
   - Tutte le chiamate tra funzioni sono rappresentate con frecce
   - Tutti i link docs portano alle sezioni corrette
   - Il diagram è interattivo e senza errori JavaScript

3. ✅ **Sincronizzazione**:
   - Codice Solidity ↔️ API_Reference.md ↔️ diagram_detailed.html
   - Nessuna discrepanza tra le tre fonti

4. ✅ **Quality**:
   - Zero typos
   - Terminologia consistente
   - Rendering corretto in tutti i browser
   - Performance accettabile

---

## 📊 Metriche di Successo

- **Copertura**: 100% delle funzioni pubbliche/external documentate
- **Accuratezza**: 0 errori di signature
- **Completezza**: 0 broken links
- **Performance**: Diagram carica in <2s
- **Maintenance**: Riduzione 50% tempo per trovare documentazione funzione

---

**Prossimo Step**: Attendere approvazione per procedere con TODO 1.1 (Beacon Module Audit)