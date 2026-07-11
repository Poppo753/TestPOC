# 📊 Guida all'Aggiornamento del Diagramma Interattivo

**File Target:** `diagram_detailed.html`  
**Ultima Revisione:** 24 Ottobre 2025  
**Scopo:** Documentare come aggiungere nuove funzioni e relazioni al diagramma interattivo

---

## 🎯 Panoramica del Sistema

Il diagramma interattivo è composto da **3 strutture dati principali** che devono essere mantenute sincronizzate:

1. **`functionCalls`** - Mappa le chiamate USCENTI da ogni funzione
2. **`functionDetails`** - Contiene la documentazione dettagliata di ogni funzione
3. **`modules`** - Definisce i moduli e le loro funzioni visibili

---

## 📐 Struttura 1: `functionCalls` (Linee 107-261)

### Scopo
Definisce **cosa chiama ogni funzione**. Questa è la mappa delle dipendenze per visualizzare le frecce nel diagramma.

### Formato
```javascript
const functionCalls = {
  "ModuleName.functionName": [
    { target: "TargetModule.targetFunction", type: COLOR_CONSTANT, param: "optional_param" },
    { target: "AnotherModule.anotherFunction", type: COLOR_CONSTANT },
    // ... altre chiamate
  ],
  // ... altre funzioni
};
```

### Tipi di Colore Disponibili
- **`READ`** - Chiamate di lettura/view (`#2563eb` - blu)
- **`WRITE`** - Chiamate che modificano lo stato (`#ef4444` - rosso)
- **`EXTERNAL`** - Integrazioni esterne (Chainlink, DEX, WETH) (`#ea580c` - arancione)
- **`EMERGENCY`** - Operazioni di emergenza (`#991b1b` - rosso scuro)

### Esempio di Aggiunta
```javascript
// NUOVO MODULO: MyNewModule
"MyNewModule.newFunction": [
  { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
  { target: "TokenManager.getTokenPrice", type: READ },
  { target: "ProxyGeneral.transferFunds", type: WRITE },
  { target: "External.Chainlink.latestRoundData", type: EXTERNAL },
],
```

### ⚠️ Regole Importanti
1. **Nome completo**: Sempre `"ModuleName.functionName"`
2. **Target esatto**: Deve corrispondere a una funzione esistente in `modules` o `functionDetails`
3. **Parametro opzionale**: Usato per chiamate a `getImplementation()` per specificare quale modulo viene risolto
4. **Coerenza**: Se aggiungi una chiamata qui, considera di aggiornare anche `functionDetails`

---

## 📚 Struttura 2: `functionDetails` (Linee 282-354)

### Scopo
Fornisce la **documentazione tooltip** che appare quando l'utente passa il mouse su una funzione.

### Formato
```javascript
const functionDetails = {
  "ModuleName.functionName": {
    signature: "functionName(param1, param2) → returnType",
    params: "param1: Description, param2: Description",
    returns: "returnType: What it returns",
    access: "public/view/onlyOwner/onlyAuthorized/emergency",
    description: "Brief description of what this function does and its purpose in the system.",
    docs: "docs/relative/path/to/documentation.md#anchor"
  },
  // ... altre funzioni
};
```

### Esempio di Aggiunta
```javascript
"MyNewModule.calculateRisk": {
  signature: "calculateRisk(address user, uint256 amount) → uint256",
  params: "user: User address, amount: Amount to evaluate",
  returns: "uint256: Risk score (0-100)",
  access: "public view",
  description: "Calculates risk score for a user's transaction based on historical data and current pool state.",
  docs: "docs/Technical_Module_Analysis.md#mynewmodule"
},
```

### 📋 Campi Obbligatori
- ✅ **signature**: Firma completa della funzione con tipi di ritorno
- ✅ **params**: Descrizione di ogni parametro
- ✅ **returns**: Cosa restituisce la funzione
- ✅ **access**: Modificatori di accesso
- ✅ **description**: Descrizione chiara e concisa (1-2 frasi)
- ⚠️ **docs**: OPZIONALE - Link alla documentazione completa

### 💡 Best Practices
- Mantieni la `description` sotto 150 caratteri per leggibilità nel tooltip
- Usa terminologia coerente con `API_Reference.md`
- Includi sempre il link `docs` se la funzione è documentata

---

## 🧩 Struttura 3: `modules` (Linee 356-498)

### Scopo
Definisce la **rappresentazione visuale** dei moduli e le funzioni che appaiono nel diagramma.

### Formato
```javascript
const modules = [
  {
    key: "ModuleName",           // Nome unico del modulo
    title: "MODULENAME",          // Titolo maiuscolo visualizzato
    subtitle: "Brief Description", // Sottotitolo descrittivo
    x: 50,                        // Posizione X nel SVG
    y: 50,                        // Posizione Y nel SVG
    functions: [
      { 
        id: "functionName",                    // ID unico (senza prefisso modulo)
        name: "functionName(...)",             // Nome visualizzato (può essere abbreviato)
        access: "view/auth/owner/emergency",   // Etichetta di accesso
        color: READ                            // Colore della funzione (READ/WRITE/EXTERNAL/EMERGENCY)
      },
      // ... altre funzioni
    ]
  },
  // ... altri moduli
];
```

### Layout del Diagramma Attuale
```
┌─────────────────┬─────────────────┬─────────────────┐
│  Beacon (50,50) │ ProxyGeneral    │ TokenManager    │
│                 │    (450,50)     │    (900,50)     │
├─────────────────┼─────────────────┼─────────────────┤
│ ValueCalculator │ LiquidityMgr    │ SwapManager     │
│    (50,400)     │    (450,400)    │    (900,400)    │
├─────────────────┼─────────────────┼─────────────────┤
│ EmergencyHandler│ ParameterMgr    │ External        │
│    (50,750)     │    (450,750)    │    (900,750)    │
└─────────────────┴─────────────────┴─────────────────┘
```

### Esempio di Aggiunta di un Nuovo Modulo
```javascript
{
  key: "RiskManager",
  title: "RISKMANAGER",
  subtitle: "Risk Assessment",
  x: 50,              // Scegli posizione appropriata
  y: 1100,            // Nuova riga sotto EmergencyHandler
  functions: [
    { id: "calculateRisk", name: "calculateRisk(...)", access: "view", color: READ },
    { id: "updateRiskParams", name: "updateRiskParams(...)", access: "owner", color: WRITE },
    { id: "getRiskScore", name: "getRiskScore(user)", access: "view", color: READ },
  ]
},
```

### Esempio di Aggiunta di Funzioni a Modulo Esistente
```javascript
// Nel modulo TokenManager esistente, aggiungi:
{
  key: "TokenManager",
  title: "TOKENMANAGER",
  subtitle: "Registry + Oracle",
  x: 900,
  y: 50,
  functions: [
    // ... funzioni esistenti ...
    { id: "getTokenCount", name: "getTokenCount()", access: "view", color: READ },
    { id: "updateHeartbeat", name: "updateHeartbeat(...)", access: "owner", color: WRITE },
  ]
},
```

### ⚠️ Considerazioni sul Layout
- **Distanza orizzontale**: 400-450px tra colonne
- **Distanza verticale**: 350-400px tra righe
- **Larghezza modulo**: 350px (hardcoded nel componente)
- **Altezza dinamica**: 50px header + (20px × numero funzioni) + 20px padding

---

## 🔄 Workflow di Aggiornamento Completo

### Scenario: Aggiungere una Nuova Funzione

#### Passo 1: Analizza la Funzione
Prima di aggiornare il diagramma, raccogli:
- ✅ Nome del modulo e della funzione
- ✅ Parametri di input
- ✅ Tipo di ritorno
- ✅ Access control (view/public/onlyOwner/etc.)
- ✅ Quali altre funzioni chiama
- ✅ Tipo di operazione (READ/WRITE/EXTERNAL/EMERGENCY)

#### Passo 2: Aggiorna `modules` (Struttura Visuale)
```javascript
// Trova il modulo giusto e aggiungi:
{
  key: "TokenManager",
  // ... campi esistenti ...
  functions: [
    // ... funzioni esistenti ...
    { 
      id: "getTokenCount", 
      name: "getTokenCount()", 
      access: "view", 
      color: READ 
    },
  ]
}
```

#### Passo 3: Aggiungi a `functionCalls` (Dipendenze)
```javascript
const functionCalls = {
  // ... chiamate esistenti ...
  
  "TokenManager.getTokenCount": [
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    // Aggiungi tutte le chiamate che questa funzione fa
  ],
};
```

#### Passo 4: Aggiungi a `functionDetails` (Documentazione)
```javascript
const functionDetails = {
  // ... dettagli esistenti ...
  
  "TokenManager.getTokenCount": {
    signature: "getTokenCount() → uint256",
    params: "none",
    returns: "uint256: Total number of registered tokens",
    access: "public view",
    description: "Returns the total count of tokens registered in the system, including both active and inactive tokens.",
    docs: "docs/API_Reference.md#tokenmanager-gettokencount"
  },
};
```

#### Passo 5: Verifica la Mappa Inversa
La `reverseCallMap` viene generata automaticamente dal codice:
```javascript
// Linee 263-276 - Questo è AUTOMATICO, non modificare
const reverseCallMap = {};
Object.entries(functionCalls).forEach(([caller, calls]) => {
  calls.forEach(call => {
    if (!reverseCallMap[call.target]) {
      reverseCallMap[call.target] = [];
    }
    reverseCallMap[call.target].push({
      caller: caller,
      type: call.type,
      param: call.param
    });
  });
});
```
✅ **Non modificare questo blocco** - viene calcolato automaticamente da `functionCalls`

---

## 🎨 Scenario: Aggiungere un Nuovo Modulo Completo

### Passo 1: Pianifica il Layout
```
Decidi:
- Dove posizionare il modulo (x, y)
- Se serve una nuova riga o colonna
- Come adattare la dimensione del SVG
```

### Passo 2: Aggiungi a `modules`
```javascript
const modules = [
  // ... moduli esistenti ...
  
  {
    key: "RiskManager",
    title: "RISKMANAGER",
    subtitle: "Risk Assessment",
    x: 50,
    y: 1100,
    functions: [
      { id: "calculateRisk", name: "calculateRisk(...)", access: "public", color: READ },
      { id: "getRiskScore", name: "getRiskScore(...)", access: "view", color: READ },
      { id: "updateRiskParams", name: "updateRiskParams(...)", access: "owner", color: WRITE },
      { id: "emergencyLockUser", name: "emergencyLockUser(...)", access: "emergency", color: EMERGENCY },
    ]
  },
];
```

### Passo 3: Aggiungi Tutte le Relazioni in `functionCalls`
```javascript
const functionCalls = {
  // ... chiamate esistenti ...
  
  // RISKMANAGER calls
  "RiskManager.calculateRisk": [
    { target: "Beacon.getImplementation", type: READ, param: "ValueCalculator" },
    { target: "ValueCalculator.getTotalPoolValue", type: READ },
    { target: "ProxyGeneral.balanceOf", type: READ },
  ],
  
  "RiskManager.updateRiskParams": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.isPaused", type: READ },
  ],
  
  "RiskManager.emergencyLockUser": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.pause", type: EMERGENCY },
  ],
};
```

### Passo 4: Documenta Ogni Funzione in `functionDetails`
```javascript
const functionDetails = {
  // ... dettagli esistenti ...
  
  "RiskManager.calculateRisk": {
    signature: "calculateRisk(address user, uint256 amount) → uint256",
    params: "user: User address, amount: Transaction amount",
    returns: "uint256: Risk score (0-100)",
    access: "public view",
    description: "Calculates risk score based on user history, pool health, and transaction size.",
    docs: "docs/Technical_Module_Analysis.md#riskmanager"
  },
  
  "RiskManager.getRiskScore": {
    signature: "getRiskScore(address user) → uint256",
    params: "user: User address to query",
    returns: "uint256: Current risk score",
    access: "public view",
    description: "Returns the cached risk score for a user without recalculation.",
    docs: "docs/Technical_Module_Analysis.md#riskmanager"
  },
  
  "RiskManager.updateRiskParams": {
    signature: "updateRiskParams(uint256 threshold, uint256 weight)",
    params: "threshold: New risk threshold, weight: Risk calculation weight",
    returns: "void",
    access: "onlyOwner",
    description: "Updates risk calculation parameters. Only callable by owner.",
    docs: "docs/Technical_Module_Analysis.md#riskmanager"
  },
  
  "RiskManager.emergencyLockUser": {
    signature: "emergencyLockUser(address user, string reason)",
    params: "user: User to lock, reason: Explanation for lock",
    returns: "void",
    access: "onlyEmergency",
    description: "Emergency function to immediately lock a high-risk user from system operations.",
    docs: "docs/Technical_Module_Analysis.md#riskmanager"
  },
};
```

### Passo 5: Aggiorna Dimensioni SVG se Necessario
```javascript
// Se aggiungi nuove righe, aumenta l'altezza dell'SVG:
// Linea ~941
<svg width={1300} height={1500} style={{ display: "block", margin: "0 auto" }}>
//                    ^^^^^ aumentato da 1300 a 1500
```

### Passo 6: Aggiorna la Legenda
```javascript
// Se il nuovo modulo è in una posizione molto in basso:
// Linea ~968 - Sposta la legenda
<g transform="translate(50, 1450)">
//                           ^^^^ nuova posizione Y
```

---

## 🧪 Testing e Validazione

### Checklist Pre-Commit
- [ ] **Sintassi JavaScript valida** - Controlla virgole, parentesi, quote
- [ ] **Nomi coerenti** - Verifica che `ModuleName.functionName` sia identico ovunque
- [ ] **Colori corretti** - READ/WRITE/EXTERNAL/EMERGENCY usati appropriatamente
- [ ] **Tooltip completi** - Tutti i campi obbligatori in `functionDetails`
- [ ] **Layout non sovrapposto** - Coordinate x,y non creano sovrapposizioni
- [ ] **SVG abbastanza grande** - Tutti i moduli visibili senza scroll orizzontale

### Test Manuale
1. **Apri `diagram_detailed.html` in un browser**
2. **Verifica rendering**: Tutti i moduli sono visibili e ben posizionati
3. **Test tooltip**: Passa il mouse su ogni nuova funzione per verificare tooltip
4. **Test click**: Clicca ogni nuova funzione per verificare le frecce
5. **Test mode toggle**: Passa tra "Outgoing Calls" e "Incoming Calls"
6. **Verifica frecce**: 
   - Outgoing: La funzione clicca mostra tutte le sue chiamate
   - Incoming: La funzione clicca mostra chi la chiama
7. **Test animazioni**: Le frecce appaiono con animazione fluida

### Debug Comune

#### Problema: Funzione non appare nel diagramma
✅ **Soluzione**: Verifica che sia aggiunta in `modules[].functions[]`

#### Problema: Click sulla funzione non mostra frecce
✅ **Soluzione**: Verifica che `functionCalls["Module.function"]` esista e abbia target validi

#### Problema: Tooltip non appare
✅ **Soluzione**: Verifica che `functionDetails["Module.function"]` esista

#### Problema: Freccia non collega correttamente
✅ **Soluzione**: Verifica che il `target` in `functionCalls` corrisponda esattamente a una funzione esistente in `modules`

#### Problema: "Incoming Calls" non mostra nulla
✅ **Soluzione**: Nessun'altra funzione chiama questa - aggiungi le chiamate in `functionCalls` di altre funzioni

---

## 📝 Template Rapido

### Aggiungere una Funzione a Modulo Esistente

```javascript
// 1. MODULES (Visualizzazione)
{
  key: "ExistingModule",
  // ... campi esistenti ...
  functions: [
    // ... funzioni esistenti ...
    { id: "newFunction", name: "newFunction(...)", access: "view", color: READ },
  ]
}

// 2. FUNCTION CALLS (Dipendenze)
"ExistingModule.newFunction": [
  { target: "OtherModule.someFunction", type: READ },
  { target: "AnotherModule.anotherFunction", type: WRITE },
],

// 3. FUNCTION DETAILS (Documentazione)
"ExistingModule.newFunction": {
  signature: "newFunction(param) → returnType",
  params: "param: Description",
  returns: "returnType: What it returns",
  access: "public view",
  description: "Brief description of the function's purpose.",
  docs: "docs/path/to/documentation.md#anchor"
},
```

### Aggiungere un Modulo Completo

```javascript
// 1. MODULES
{
  key: "NewModule",
  title: "NEWMODULE",
  subtitle: "Short Description",
  x: 50,    // Posizione X
  y: 1100,  // Posizione Y
  functions: [
    { id: "func1", name: "func1(...)", access: "view", color: READ },
    { id: "func2", name: "func2(...)", access: "public", color: WRITE },
  ]
},

// 2. FUNCTION CALLS (per ogni funzione)
"NewModule.func1": [
  { target: "Beacon.getImplementation", type: READ, param: "SomeModule" },
],

"NewModule.func2": [
  { target: "ProxyGeneral.transferFunds", type: WRITE },
],

// 3. FUNCTION DETAILS (per ogni funzione)
"NewModule.func1": {
  signature: "func1() → uint256",
  params: "none",
  returns: "uint256: Result value",
  access: "public view",
  description: "Description of func1.",
  docs: "docs/path.md#func1"
},

"NewModule.func2": {
  signature: "func2(address to, uint256 amount)",
  params: "to: Recipient, amount: Amount to transfer",
  returns: "void",
  access: "public",
  description: "Description of func2.",
  docs: "docs/path.md#func2"
},
```

---

## 🎯 Prossimi Passi

Una volta creato questo documento, sei pronto per:

1. **Fornire i contratti Solidity aggiornati** - Analizzerò le funzioni
2. **Estrarre le dipendenze** - Mapperò le chiamate tra funzioni
3. **Generare gli aggiornamenti** - Creerò i blocchi di codice per `functionCalls`, `functionDetails`, e `modules`
4. **Applicare le modifiche** - Aggiornerò `diagram_detailed.html`
5. **Validare** - Verificherò sintassi e coerenza

---

## 📚 Riferimenti

- **File Sorgente**: `diagram_detailed.html`
- **Documentazione API**: `docs/API_Reference.md`
- **Analisi Moduli**: `docs/Technical_Module_Analysis.md`
- **React Documentation**: Per capire la logica dei componenti

---

## ✅ Checklist Finale

Prima di considerare l'aggiornamento completo:

- [ ] Tutte le nuove funzioni sono in `modules`
- [ ] Tutte le nuove funzioni hanno entry in `functionDetails`
- [ ] Tutte le chiamate sono mappate in `functionCalls`
- [ ] Colori (READ/WRITE/EXTERNAL/EMERGENCY) corretti
- [ ] Layout non crea sovrapposizioni
- [ ] SVG dimensionato correttamente
- [ ] Test manuale completato con successo
- [ ] Documentazione `API_Reference.md` aggiornata (se necessario)

---

**Pronto per ricevere i contratti aggiornati!** 🚀
