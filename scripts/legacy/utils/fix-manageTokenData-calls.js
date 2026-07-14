const fs = require('fs');
const path = require('path');

/**
 * Script per aggiornare tutte le chiamate a manageTokenData
 * dalla vecchia firma a 6 parametri alla nuova a 4 parametri
 */

const filePath = path.join(__dirname, '../../test/unit/TokenManager.test.ts');

console.log('🔍 Lettura file:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

// Pattern per matchare manageTokenData con 6 parametri
// Formato: tokenCode, tokenAddress, oracleAddress, tokenDecimals, oracleDecimals, heartbeat
const pattern6Params = /manageTokenData\s*\(\s*([^,]+),\s*([^,]+),\s*await mockOracle\.getAddress\(\),\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/g;

let matches = 0;
content = content.replace(pattern6Params, (match, tokenCode, tokenAddress, tokenDecimals, oracleDecimals, heartbeat) => {
    matches++;
    // Nuova firma: tokenCode, tokenAddress, tokenDecimals, heartbeat (rimuove oracle + oracleDecimals)
    return `manageTokenData(${tokenCode}, ${tokenAddress}, ${tokenDecimals}, ${heartbeat})`;
});

if (matches > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Aggiornate ${matches} chiamate a manageTokenData`);
} else {
    console.log('ℹ️  Nessuna chiamata da aggiornare trovata');
}

console.log('✨ Script completato');
