const fs = require('fs');
const path = require('path');

// Percorsi
const API_JSON = './api_reference.json';
const CONTRACTS_DIR = '../../contracts';
const OUTPUT_JSON = './api_reference_TEST.json';

console.log('🧪 SMART FILLER - TEST MODE (solo Beacon)\n');
console.log('═══════════════════════════════════════════════════════════════\n');

// Carica dati esistenti
const apiData = JSON.parse(fs.readFileSync(API_JSON, 'utf8'));

/**
 * Legge e parsa un file Solidity
 */
function readContract(fileName) {
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
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `function\\s+${escapedName}\\s*\\([^)]*\\)[^{]*`,
    'gms'
  );
  
  const match = contractCode.match(pattern);
  if (!match) return null;
  
  return match[0].replace(/\s+/g, ' ').trim();
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
  
  const parts = paramsStr.split(',').map(p => p.trim());
  
  parts.forEach(part => {
    if (!part) return;
    
    const match = part.match(/^(.+?)\s+(\w+)$/);
    if (match) {
      const type = match[1].trim().replace(/\s+/g, ' ');
      const name = match[2];
      params.push({
        name: `\`${name}\``,
        type: `\`${type}\``,
        description: ''
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
  
  const parts = returnsStr.split(',').map(p => p.trim());
  
  parts.forEach(part => {
    if (!part) return;
    
    const matchWithName = part.match(/^(.+?)\s+(\w+)$/);
    if (matchWithName) {
      const type = matchWithName[1].trim().replace(/\s+/g, ' ');
      const name = matchWithName[2];
      returns.push({
        type: `\`${type}\``,
        description: `Value of ${name}`
      });
    } else {
      returns.push({
        type: `\`${part.trim()}\``,
        description: ''
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
  
  const startIndex = match.index + match[0].length - 1;
  let braceCount = 0;
  let endIndex = startIndex;
  
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
  
  return validations;
}

/**
 * Estrae events emessi dalla funzione
 */
function extractEvents(functionBody) {
  if (!functionBody) return null;
  
  const events = [];
  
  const emitPattern = /emit\s+(\w+)\s*\([^)]*\)\s*;/g;
  let match;
  
  while ((match = emitPattern.exec(functionBody)) !== null) {
    const eventName = match[1];
    events.push(`emit ${eventName}(...);`);
  }
  
  return events.length > 0 ? events.join('\n') : null;
}

/**
 * Processa una singola funzione - VERSIONE TEST
 */
function processFunction(func, contractCode) {
  console.log(`\n  📝 ${func.name}`);
  console.log(`     ID: ${func.id}`);
  console.log(`     Completa: ${func._complete ? '✅' : '❌'}`);
  console.log(`     Campi mancanti: ${func._missingFields.join(', ')}`);
  
  const functionName = func.name;
  
  // Estrai signature completa
  const fullSignature = extractFunctionSignature(contractCode, functionName);
  
  if (fullSignature) {
    console.log(`\n     🔍 SIGNATURE ESTRATTA:`);
    console.log(`     ${fullSignature}`);
  } else {
    console.log(`\n     ⚠️  Signature non trovata nel contratto!`);
  }
  
  // Test estrazione accessControl
  const accessControl = extractAccessControl(fullSignature || func.signature);
  if (accessControl) {
    console.log(`\n     ✓ ACCESS CONTROL: ${accessControl}`);
  }
  
  // Test estrazione parameters
  const parameters = extractParameters(fullSignature || func.signature);
  if (parameters.length > 0) {
    console.log(`\n     ✓ PARAMETERS (${parameters.length}):`);
    parameters.forEach(p => {
      console.log(`       - ${p.name}: ${p.type}`);
    });
  }
  
  // Test estrazione returns
  const returns = extractReturns(fullSignature || func.signature);
  if (returns.length > 0) {
    console.log(`\n     ✓ RETURNS (${returns.length}):`);
    returns.forEach(r => {
      console.log(`       - ${r.type}: ${r.description || '(no description)'}`);
    });
  }
  
  // Estrai corpo della funzione
  const functionBody = extractFunctionBody(contractCode, functionName);
  
  if (functionBody) {
    console.log(`\n     ✓ FUNCTION BODY: ${functionBody.length} characters`);
    
    // Test estrazione validations
    const validations = extractValidations(functionBody);
    if (validations.length > 0) {
      console.log(`\n     ✓ VALIDATIONS (${validations.length}):`);
      validations.slice(0, 3).forEach(v => console.log(`       ${v}`));
      if (validations.length > 3) {
        console.log(`       ... e altri ${validations.length - 3}`);
      }
    }
    
    // Test estrazione events
    const events = extractEvents(functionBody);
    if (events) {
      console.log(`\n     ✓ EVENTS:`);
      console.log(`       ${events.replace(/\n/g, '\n       ')}`);
    }
  } else {
    console.log(`\n     ⚠️  Function body non trovato!`);
  }
  
  console.log('\n  ' + '─'.repeat(60));
  
  return func;
}

/**
 * Main execution - TEST MODE
 */
function main() {
  console.log('📂 Leggendo contratto Beacon.sol...\n');
  
  const contractCode = readContract('Beacon.sol');
  if (!contractCode) {
    console.log('❌ Impossibile leggere Beacon.sol');
    return;
  }
  
  console.log(`✅ Contratto caricato (${contractCode.length} caratteri)\n`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           TESTANDO PRIME 3 FUNZIONI DI BEACON');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Prendi solo prime 3 funzioni di Beacon per test
  const beaconFunctions = Object.values(apiData.modules.beacon.functions).slice(0, 3);
  
  beaconFunctions.forEach(func => {
    processFunction(func, contractCode);
  });
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    ✅ TEST COMPLETATO');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('Se i risultati sopra sembrano corretti, puoi eseguire lo script');
  console.log('completo con: node smart_filler.js');
  console.log('\n');
}

// Esegui
main();
