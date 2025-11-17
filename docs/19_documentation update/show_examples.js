const fs = require('fs');
const data = JSON.parse(fs.readFileSync('api_reference.json', 'utf8'));

console.log('═══════════════════════════════════════════════════════════════');
console.log('   CONFRONTO: FUNZIONE COMPLETA vs INCOMPLETA');
console.log('═══════════════════════════════════════════════════════════════\n');

// Funzione COMPLETA (Beacon.getImplementation)
const complete = data.modules.beacon.functions['beacon-getimplementation'];
console.log('✅ FUNZIONE COMPLETA: getImplementation (Beacon)');
console.log('─────────────────────────────────────────────────────────────');

const fields = [
  'description', 'signature', 'parameters', 'returns', 
  'accessControl', 'validations', 'events', 'gasCost', 
  'usageExample', 'calledBy', 'securityNotes'
];

fields.forEach(field => {
  const val = complete[field];
  const hasContent = Array.isArray(val) 
    ? val.length > 0 
    : (val && typeof val === 'string' && val.trim() !== '');
  
  const preview = Array.isArray(val) 
    ? `[${val.length} items]`
    : (val && val.length > 60 ? val.substring(0, 60) + '...' : val);
    
  console.log(`  ${field.padEnd(15)}: ${hasContent ? '✅' : '❌'} ${preview || ''}`);
});

console.log(`\n  _complete: ${complete._complete}`);
console.log(`  _missingFields: ${complete._missingFields.length === 0 ? 'NESSUNO' : complete._missingFields.join(', ')}`);

console.log('\n\n═══════════════════════════════════════════════════════════════\n');

// Funzione INCOMPLETA (ParameterManager)
const incomplete = data.modules.parametermanager.functions['parametermanager-getparameter'];
console.log('❌ FUNZIONE INCOMPLETA: getParameter (ParameterManager)');
console.log('─────────────────────────────────────────────────────────────');

fields.forEach(field => {
  const val = incomplete[field];
  const hasContent = Array.isArray(val) 
    ? val.length > 0 
    : (val && typeof val === 'string' && val.trim() !== '');
  
  const preview = Array.isArray(val) 
    ? `[${val.length} items]`
    : (val && val.length > 60 ? val.substring(0, 60) + '...' : val);
    
  console.log(`  ${field.padEnd(15)}: ${hasContent ? '✅' : '❌'} ${preview || ''}`);
});

console.log(`\n  _complete: ${incomplete._complete}`);
console.log(`  _missingFields: ${incomplete._missingFields.join(', ')}`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('\n📊 RIEPILOGO PROBLEMI:\n');
console.log('Le funzioni incomplete sono state aggiunte con il template minimo:');
console.log('  - Hanno signature e description');
console.log('  - Mancano: accessControl, validations, events, gasCost,');
console.log('              usageExample, calledBy, securityNotes');
console.log('\nModuli più problematici:');
console.log('  - EmergencyHandler: 0/39 complete (0%)');
console.log('  - ParameterManager: 0/34 complete (0%)');
console.log('  - SwapManager: 1/24 complete (4%)');
console.log('  - LiquidityManager: 1/21 complete (5%)');
console.log('\n═══════════════════════════════════════════════════════════════');
