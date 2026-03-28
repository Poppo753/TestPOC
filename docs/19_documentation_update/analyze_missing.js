const fs = require('fs');

const filled = JSON.parse(fs.readFileSync('./api_reference_filled.json', 'utf8'));

console.log('═══════════════════════════════════════════════════════════════');
console.log('   ANALISI FUNZIONI SENZA PARAMETERS/RETURNS');
console.log('═══════════════════════════════════════════════════════════════\n');

// Funzioni senza parameters
console.log('🔍 FUNZIONI SENZA PARAMETERS (sample):\n');
let count = 0;
let noParamsReasons = {
  noSignature: 0,
  noParamsInSignature: 0,
  extractionFailed: 0
};

Object.values(filled.modules).forEach(mod => {
  Object.values(mod.functions).forEach(f => {
    if (!f.parameters || f.parameters.length === 0) {
      // Analizza perché
      if (!f.signature || f.signature.trim() === '') {
        noParamsReasons.noSignature++;
      } else if (f.signature.includes('()')) {
        noParamsReasons.noParamsInSignature++;
      } else {
        noParamsReasons.extractionFailed++;
        if (count < 5) {
          console.log(`${count + 1}. ${f.id}`);
          console.log(`   Signature: ${f.signature.substring(0, 100)}`);
          const match = f.signature.match(/function\s+\w+\s*\(([^)]*)\)/);
          if (match) {
            console.log(`   Params estratti dal regex: "${match[1]}"`);
          }
          console.log('');
          count++;
        }
      }
    }
  });
});

console.log('\n📊 MOTIVI MANCANZA PARAMETERS:');
console.log(`   - Signature mancante: ${noParamsReasons.noSignature}`);
console.log(`   - Funzione senza parametri (): ${noParamsReasons.noParamsInSignature}`);
console.log(`   - Estrazione fallita: ${noParamsReasons.extractionFailed}`);

// Funzioni senza returns
console.log('\n\n🔍 FUNZIONI SENZA RETURNS (sample):\n');
count = 0;
let noReturnsReasons = {
  noSignature: 0,
  noReturnsInSignature: 0,
  extractionFailed: 0
};

Object.values(filled.modules).forEach(mod => {
  Object.values(mod.functions).forEach(f => {
    if (!f.returns || f.returns.length === 0) {
      // Analizza perché
      if (!f.signature || f.signature.trim() === '') {
        noReturnsReasons.noSignature++;
      } else if (!f.signature.includes('returns')) {
        noReturnsReasons.noReturnsInSignature++;
      } else {
        noReturnsReasons.extractionFailed++;
        if (count < 5) {
          console.log(`${count + 1}. ${f.id}`);
          console.log(`   Signature: ${f.signature.substring(0, 100)}`);
          const match = f.signature.match(/returns\s*\(([^)]*)\)/);
          if (match) {
            console.log(`   Returns estratti dal regex: "${match[1]}"`);
          }
          console.log('');
          count++;
        }
      }
    }
  });
});

console.log('\n📊 MOTIVI MANCANZA RETURNS:');
console.log(`   - Signature mancante: ${noReturnsReasons.noSignature}`);
console.log(`   - Funzione senza returns: ${noReturnsReasons.noReturnsInSignature}`);
console.log(`   - Estrazione fallita: ${noReturnsReasons.extractionFailed}`);

console.log('\n═══════════════════════════════════════════════════════════════\n');
