const fs = require('fs');

const filled = JSON.parse(fs.readFileSync('./api_reference_filled.json', 'utf8'));

console.log('🔍 FUNZIONI CON PARAMETRI MA NON ESTRATTI:\n');
console.log('═══════════════════════════════════════════════════════════════\n');

let count = 0;

Object.values(filled.modules).forEach(mod => {
  Object.values(mod.functions).forEach(f => {
    // Verifica se la signature ha parametri
    const hasParams = f.signature && 
                     f.signature.includes('(') && 
                     !f.signature.match(/function\s+\w+\s*\(\s*\)/);
    
    // Ma l'array parameters è vuoto
    if (hasParams && (!f.parameters || f.parameters.length === 0)) {
      count++;
      console.log(`${count}. ${f.name} (${f.module})`);
      console.log(`   ID: ${f.id}`);
      console.log(`   Signature:`);
      console.log(`   ${f.signature.replace(/\r?\n/g, '\n   ')}`);
      
      // Prova a fare il parsing manualmente
      const match = f.signature.match(/function\s+\w+\s*\(([^)]+)\)/);
      if (match) {
        console.log(`\n   ✓ Regex match trovato: "${match[1]}"`);
        
        // Prova a splittare i parametri
        const params = match[1].split(',').map(p => p.trim());
        console.log(`   ✓ Parametri parsati: ${params.length}`);
        params.forEach((p, i) => {
          console.log(`     ${i + 1}. "${p}"`);
        });
      } else {
        console.log(`\n   ❌ Regex non ha trovato parametri`);
      }
      
      console.log('\n' + '─'.repeat(60) + '\n');
    }
  });
});

console.log(`\n📊 Totale funzioni con problemi: ${count}`);
console.log('═══════════════════════════════════════════════════════════════\n');
