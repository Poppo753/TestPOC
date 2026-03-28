const fs = require('fs');
const path = require('path');

// Percorsi
const API_JSON = './api_reference.json';
const CONTRACTS_DIR = '../../contracts';
const DEPS_JSON = './function_dependencies.json';
const OUTPUT_JSON = './api_reference_filled.json';

console.log('🔍 SMART FILLER - Estrazione automatica da contratti Solidity\n');
console.log('═══════════════════════════════════════════════════════════════\n');

// Carica dati esistenti
const apiData = JSON.parse(fs.readFileSync(API_JSON, 'utf8'));
const depsData = fs.existsSync(DEPS_JSON) ? JSON.parse(fs.readFileSync(DEPS_JSON, 'utf8')) : {};

// Mappa moduli -> file contratti
const MODULE_FILES = {
  'beacon': 'Beacon.sol',
  'proxygeneral': 'ProxyGeneral.sol',
  'tokenmanager': 'TokenManager.sol',
  'valuecalculator': 'ValueCalculator.sol',
  'liquiditymanager': 'LiquidityManager.sol',
  'swapmanager': 'SwapManager.sol',
  'emergencyhandler': 'EmergencyHandler.sol',
  'parametermanager': 'ParameterManager.sol'
};

// Statistiche
let stats = {
  totalFunctions: 0,
  functionsProcessed: 0,
  fieldsAdded: {
    accessControl: 0,
    parameters: 0,
    returns: 0,
    validations: 0,
    events: 0,
    gasCost: 0
  },
  errors: []
};

/**
 * Legge e parsa un file Solidity
 */
function readContract(moduleName) {
  const fileName = MODULE_FILES[moduleName];
  if (!fileName) {
    console.log(`⚠️  Nessun file contratto per modulo: ${moduleName}`);
    return null;
  }
  
  const filePath = path.join(CONTRACTS_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File non trovato: ${filePath}`);
    return null;
  }
  
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Estrae la signature completa di una funzione dal contratto
 */
function extractFunctionSignature(contractCode, functionName) {
  // Pattern per trovare la funzione (supporta multi-line)
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `function\\s+${escapedName}\\s*\\([^)]*\\)[^{]*`,
    'gms'
  );
  
  const match = contractCode.match(pattern);
  if (!match) return null;
  
  // Pulisce la signature
  return match[0]
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Estrae i modifiers dalla signature
 */
function extractAccessControl(signature) {
  if (!signature) return null;
  
  const modifiers = [];
  
  // Visibility
  if (signature.includes('external')) modifiers.push('external');
  else if (signature.includes('public')) modifiers.push('public');
  else if (signature.includes('internal')) modifiers.push('internal');
  else if (signature.includes('private')) modifiers.push('private');
  
  // State mutability
  if (signature.includes('view')) modifiers.push('view');
  else if (signature.includes('pure')) modifiers.push('pure');
  else if (signature.includes('payable')) modifiers.push('payable');
  
  // Custom modifiers
  const customModifiers = [
    'onlyOwner', 'onlyAdmin', 'nonReentrant', 'whenNotPaused',
    'validModule', 'notFrozen', 'onlyEmergency', 'onlyTimelock',
    'onlyBeacon', 'onlyProxy', 'validToken', 'validAmount'
  ];
  
  customModifiers.forEach(mod => {
    if (signature.includes(mod)) modifiers.push(mod);
  });
  
  return modifiers.length > 0 ? modifiers.join(' ') : null;
}

/**
 * Estrae parametri dalla signature
 */
function extractParameters(signature) {
  if (!signature) return [];
  
  const paramsMatch = signature.match(/function\s+\w+\s*\(([^)]*)\)/);
  if (!paramsMatch || !paramsMatch[1].trim()) return [];
  
  const paramsStr = paramsMatch[1];
  const params = [];
  
  // Split per virgole (gestisce array e mappings)
  const parts = paramsStr.split(',').map(p => p.trim());
  
  parts.forEach(part => {
    if (!part) return;
    
    // Estrae tipo e nome: "uint256 amount" o "address[] memory tokens"
    const match = part.match(/^(.+?)\s+(\w+)$/);
    if (match) {
      const type = match[1].trim().replace(/\s+/g, ' ');
      const name = match[2];
      params.push({
        name: `\`${name}\``,
        type: `\`${type}\``,
        description: '' // Questo resta vuoto - serve descrizione manuale
      });
    }
  });
  
  return params;
}

/**
 * Estrae returns dalla signature
 */
function extractReturns(signature) {
  if (!signature) return [];
  
  const returnsMatch = signature.match(/returns\s*\(([^)]*)\)/);
  if (!returnsMatch || !returnsMatch[1].trim()) return [];
  
  const returnsStr = returnsMatch[1];
  const returns = [];
  
  // Split per virgole
  const parts = returnsStr.split(',').map(p => p.trim());
  
  parts.forEach(part => {
    if (!part) return;
    
    // Può avere nome: "uint256 balance" o solo tipo: "bool"
    const matchWithName = part.match(/^(.+?)\s+(\w+)$/);
    if (matchWithName) {
      const type = matchWithName[1].trim().replace(/\s+/g, ' ');
      const name = matchWithName[2];
      returns.push({
        type: `\`${type}\``,
        description: `Value of ${name}` // Descrizione generica
      });
    } else {
      returns.push({
        type: `\`${part.trim()}\``,
        description: '' // Descrizione vuota se non c'è nome
      });
    }
  });
  
  return returns;
}

/**
 * Estrae il corpo della funzione dal contratto
 */
function extractFunctionBody(contractCode, functionName) {
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `function\\s+${escapedName}\\s*\\([^)]*\\)[^{]*\\{`,
    'gms'
  );
  
  const match = pattern.exec(contractCode);
  if (!match) return null;
  
  const startIndex = match.index + match[0].length - 1; // -1 per includere {
  let braceCount = 0;
  let endIndex = startIndex;
  
  // Trova la chiusura della funzione contando le parentesi graffe
  for (let i = startIndex; i < contractCode.length; i++) {
    if (contractCode[i] === '{') braceCount++;
    if (contractCode[i] === '}') braceCount--;
    if (braceCount === 0) {
      endIndex = i + 1;
      break;
    }
  }
  
  return contractCode.substring(startIndex, endIndex);
}

/**
 * Estrae validations (require/revert) dal corpo della funzione
 */
function extractValidations(functionBody) {
  if (!functionBody) return [];
  
  const validations = [];
  
  // Trova require statements
  const requirePattern = /require\s*\(\s*([^,]+)\s*,\s*"([^"]+)"\s*\)/g;
  let match;
  
  while ((match = requirePattern.exec(functionBody)) !== null) {
    const condition = match[1].trim();
    const message = match[2];
    validations.push(`✅ ${condition.replace(/\s+/g, ' ')}`);
    validations.push(`❌ Reverts with "${message}"`);
  }
  
  // Trova revert statements
  const revertPattern = /revert\s+(\w+)\s*\(/g;
  while ((match = revertPattern.exec(functionBody)) !== null) {
    validations.push(`❌ Reverts with \`${match[1]}\``);
  }
  
  // Trova if + revert con messaggio
  const ifRevertPattern = /if\s*\([^)]+\)\s*revert\s+"([^"]+)"/g;
  while ((match = ifRevertPattern.exec(functionBody)) !== null) {
    validations.push(`❌ Reverts with "${match[1]}"`);
  }
  
  return validations;
}

/**
 * Estrae events emessi dalla funzione
 */
function extractEvents(functionBody) {
  if (!functionBody) return null;
  
  const events = [];
  
  // Trova emit statements
  const emitPattern = /emit\s+(\w+)\s*\([^)]*\)\s*;/g;
  let match;
  
  while ((match = emitPattern.exec(functionBody)) !== null) {
    const eventName = match[1];
    
    // Cerca la definizione dell'event nel codice (approssimativa)
    const eventDefPattern = new RegExp(`event\\s+${eventName}\\s*\\([^)]*\\)`, 'g');
    const eventMatch = eventDefPattern.exec(functionBody);
    
    if (eventMatch) {
      events.push(eventMatch[0] + ';');
    } else {
      events.push(`emit ${eventName}(...);`);
    }
  }
  
  return events.length > 0 ? events.join('\n') : null;
}

/**
 * Stima il gas cost basandosi sul tipo di operazioni
 */
function estimateGasCost(functionBody, signature) {
  if (!functionBody) return null;
  
  // View/pure functions hanno costo zero on-chain
  if (signature && (signature.includes('view') || signature.includes('pure'))) {
    const sloads = (functionBody.match(/\w+\[\w+\]/g) || []).length;
    return `~${2100 * sloads + 1000} gas (SLOAD operations)`;
  }
  
  let gasCost = 21000; // Base transaction cost
  
  // SSTORE operations (~20k gas each)
  const sstores = (functionBody.match(/\w+\[\w+\]\s*=/g) || []).length;
  gasCost += sstores * 20000;
  
  // SLOAD operations (~2100 gas each)
  const sloads = (functionBody.match(/\w+\[\w+\]/g) || []).length;
  gasCost += sloads * 2100;
  
  // Event emissions (~375 gas each + indexed params)
  const events = (functionBody.match(/emit\s+\w+/g) || []).length;
  gasCost += events * 1500;
  
  // External calls (~2600 gas + target cost)
  const calls = (functionBody.match(/\.\w+\(/g) || []).length;
  gasCost += calls * 2600;
  
  if (gasCost > 100000) {
    return `~${Math.round(gasCost / 1000)}k gas (high - multiple storage writes)`;
  } else if (gasCost > 50000) {
    return `~${Math.round(gasCost / 1000)}k gas (medium)`;
  } else {
    return `~${gasCost.toLocaleString()} gas (low)`;
  }
}

/**
 * Estrae calledBy dalle dependencies
 */
function extractCalledBy(functionId) {
  if (!depsData || !depsData.functions) return null;
  
  const callers = [];
  
  // Cerca chi chiama questa funzione
  Object.entries(depsData.functions).forEach(([caller, data]) => {
    if (data.calls && data.calls.includes(functionId)) {
      callers.push(caller);
    }
  });
  
  return callers.length > 0 ? callers.join(', ') : null;
}

/**
 * Processa una singola funzione
 */
function processFunction(func, moduleName, contractCode) {
  stats.totalFunctions++;
  
  const functionName = func.name;
  console.log(`  📝 ${functionName}`);
  
  // Se già completa, salta
  if (func._complete) {
    console.log(`     ✅ Già completa\n`);
    return func;
  }
  
  let updated = false;
  
  // Estrai signature completa se non presente o incompleta
  const fullSignature = extractFunctionSignature(contractCode, functionName);
  
  // 1. ACCESS CONTROL
  if (!func.accessControl || func.accessControl.trim() === '') {
    const accessControl = extractAccessControl(fullSignature || func.signature);
    if (accessControl) {
      func.accessControl = accessControl;
      stats.fieldsAdded.accessControl++;
      updated = true;
      console.log(`     ✓ accessControl: ${accessControl}`);
    }
  }
  
  // 2. PARAMETERS
  if (!func.parameters || func.parameters.length === 0) {
    const parameters = extractParameters(fullSignature || func.signature);
    if (parameters.length > 0) {
      func.parameters = parameters;
      stats.fieldsAdded.parameters++;
      updated = true;
      console.log(`     ✓ parameters: ${parameters.length} params`);
    }
  }
  
  // 3. RETURNS
  if (!func.returns || func.returns.length === 0) {
    const returns = extractReturns(fullSignature || func.signature);
    if (returns.length > 0) {
      func.returns = returns;
      stats.fieldsAdded.returns++;
      updated = true;
      console.log(`     ✓ returns: ${returns.length} values`);
    }
  }
  
  // Estrai corpo della funzione
  const functionBody = extractFunctionBody(contractCode, functionName);
  
  // 4. VALIDATIONS
  if ((!func.validations || func.validations.length === 0) && functionBody) {
    const validations = extractValidations(functionBody);
    if (validations.length > 0) {
      func.validations = validations;
      stats.fieldsAdded.validations++;
      updated = true;
      console.log(`     ✓ validations: ${validations.length} checks`);
    }
  }
  
  // 5. EVENTS
  if ((!func.events || func.events.trim() === '') && functionBody) {
    const events = extractEvents(functionBody);
    if (events) {
      func.events = events;
      stats.fieldsAdded.events++;
      updated = true;
      console.log(`     ✓ events: found emits`);
    }
  }
  
  // 6. GAS COST
  if ((!func.gasCost || func.gasCost.trim() === '') && functionBody) {
    const gasCost = estimateGasCost(functionBody, fullSignature || func.signature);
    if (gasCost) {
      func.gasCost = gasCost;
      stats.fieldsAdded.gasCost++;
      updated = true;
      console.log(`     ✓ gasCost: ${gasCost}`);
    }
  }
  
  // 7. CALLED BY (dalle dependencies)
  if (!func.calledBy || func.calledBy.trim() === '') {
    const calledBy = extractCalledBy(func.id);
    if (calledBy) {
      func.calledBy = calledBy;
      updated = true;
      console.log(`     ✓ calledBy: ${calledBy}`);
    }
  }
  
  // Ricalcola completezza
  const requiredFields = [
    'description', 'signature', 'parameters', 'returns',
    'accessControl', 'validations', 'events', 'gasCost',
    'usageExample', 'calledBy', 'securityNotes'
  ];
  
  const missingFields = requiredFields.filter(field => {
    const value = func[field];
    return !value || 
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'string' && value.trim() === '');
  });
  
  func._missingFields = missingFields;
  func._complete = missingFields.length === 0;
  
  if (updated) {
    stats.functionsProcessed++;
    console.log(`     📊 Campi mancanti: ${missingFields.length}/11\n`);
  } else {
    console.log(`     ⚠️  Nessuna nuova informazione estratta\n`);
  }
  
  return func;
}

/**
 * Processa tutte le funzioni di un modulo
 */
function processModule(moduleName, moduleData) {
  console.log(`\n🔧 Processando modulo: ${moduleName.toUpperCase()}`);
  console.log('─────────────────────────────────────────────────────────────\n');
  
  const contractCode = readContract(moduleName);
  if (!contractCode) {
    console.log(`  ❌ Impossibile leggere contratto\n`);
    stats.errors.push(`${moduleName}: contratto non trovato`);
    return moduleData;
  }
  
  // Processa ogni funzione
  Object.keys(moduleData.functions).forEach(funcKey => {
    try {
      moduleData.functions[funcKey] = processFunction(
        moduleData.functions[funcKey],
        moduleName,
        contractCode
      );
    } catch (error) {
      console.log(`  ❌ Errore processando ${funcKey}: ${error.message}\n`);
      stats.errors.push(`${funcKey}: ${error.message}`);
    }
  });
  
  return moduleData;
}

/**
 * Main execution
 */
function main() {
  console.log('📂 Caricamento dati...\n');
  
  // Processa ogni modulo
  Object.keys(apiData.modules).forEach(moduleName => {
    apiData.modules[moduleName] = processModule(
      moduleName,
      apiData.modules[moduleName]
    );
  });
  
  // Salva risultato
  console.log('\n💾 Salvando risultati...\n');
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(apiData, null, 2));
  
  // Ricalcola statistiche finali
  let totalComplete = 0;
  let totalIncomplete = 0;
  
  Object.values(apiData.modules).forEach(module => {
    Object.values(module.functions).forEach(func => {
      if (func._complete) totalComplete++;
      else totalIncomplete++;
    });
  });
  
  // Report finale
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    📊 REPORT FINALE');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log(`📈 FUNZIONI PROCESSATE:`);
  console.log(`   Totale: ${stats.totalFunctions}`);
  console.log(`   Modificate: ${stats.functionsProcessed}`);
  console.log(`   Complete ora: ${totalComplete}/${stats.totalFunctions} (${Math.round(totalComplete/stats.totalFunctions*100)}%)\n`);
  
  console.log(`📊 CAMPI AGGIUNTI:`);
  Object.entries(stats.fieldsAdded).forEach(([field, count]) => {
    if (count > 0) {
      console.log(`   ${field}: ${count}`);
    }
  });
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  ERRORI (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
    if (stats.errors.length > 10) {
      console.log(`   ... e altri ${stats.errors.length - 10} errori`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`✅ Completato! Output salvato in: ${OUTPUT_JSON}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Esegui
main();
