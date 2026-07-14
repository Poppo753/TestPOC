const fs = require('fs');
const path = require('path');

/**
 * Script per sostituire mockOracle con mockOracleAdapter nei test
 */

const filePath = path.join(__dirname, '../../test/unit/TokenManager.test.ts');

console.log('🔍 Lettura file:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

let changes = 0;

// 1. Sostituisci mockOracle.updatePrice() con mockOracleAdapter.setPrice() per USDC
content = content.replace(/await mockOracle\.updatePrice\(([^)]+)\);/g, (match, price) => {
    changes++;
    return `await mockOracleAdapter.setPrice(TOKEN_CODES.USDC, ${price});`;
});

// 2. Sostituisci mockOracle.setShouldFail() con mockOracleAdapter.setValid()
content = content.replace(/await mockOracle\.setShouldFail\(true\);/g, () => {
    changes++;
    return `await mockOracleAdapter.setStale(TOKEN_CODES.USDC);`;
});

content = content.replace(/await mockOracle\.setShouldFail\(false\);/g, () => {
    changes++;
    return `await mockOracleAdapter.setValid(TOKEN_CODES.USDC);`;
});

// 3. Sostituisci mockOracle.makeStale() con mockOracleAdapter.setStale()
content = content.replace(/await mockOracle\.makeStale\([^)]+\);/g, () => {
    changes++;
    return `await mockOracleAdapter.setStale(TOKEN_CODES.USDC);`;
});

// 4. Commenta i test che usano getCurrentRoundId (non supportato da MockOracleAdapter)
content = content.replace(/(const (?:initialRoundId|newRoundId) = await mockOracle\.getCurrentRoundId\(\);)/g, (match) => {
    changes++;
    return `// ${match} // Not supported by MockOracleAdapter`;
});

if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Applicate ${changes} sostituzioni mockOracle -> mockOracleAdapter`);
} else {
    console.log('ℹ️  Nessuna sostituzione necessaria');
}

console.log('✨ Script completato');
