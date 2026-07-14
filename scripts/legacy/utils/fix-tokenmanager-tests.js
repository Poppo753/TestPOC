/**
 * Script per correggere automaticamente i test che usano TokenManager
 * dopo il refactoring Oracle Modularity (aggiunge parametro oracleAdapter)
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'test/QuickSmokeTest.test.ts',
  'test/integration/SwapManager.baseline.test.ts',
  'test/integration/LF-001.DepositFlow.integration.test.ts',
  'test/integration/LF-002.WithdrawFlow.integration.test.ts',
  'test/integration/LF-003.CycleTesting.integration.test.ts',
  'test/integration/LF-004.ConcurrentOps.integration.test.ts',
  'test/integration/LF-005.StressTesting.integration.test.ts',
  'test/integration/LiquidityFlow.integration.test.ts',
  'test/integration/BeaconModules.integration.test.ts',
  'test/integration/PG-001.ParameterUpdates.integration.test.ts',
  'test/integration/PG-002.GovernanceVoting.integration.test.ts',
  'test/integration/PG-003.AdminControls.integration.test.ts',
  'test/integration/PG-004.CrossModuleSync.integration.test.ts',
  'test/performance/PerformanceBenchmarks.test.ts',
];

function fixFile(filePath) {
  console.log(`\n🔧 Processing: ${filePath}`);
  
  const fullPath = path.join(__dirname, '..', '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠️  File not found, skipping`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  // Pattern 1: Simple deployment with beacon address
  // TokenManagerFactory.deploy(beaconAddress)
  // TokenManagerFactory.deploy(await beacon.getAddress())
  // TokenManagerFactory.deploy(beacon.target)
  
  const pattern1 = /(\s+)(const\s+)?(\w+\s*=\s*)?await\s+TokenManagerFactory\.deploy\s*\(\s*(beaconAddress|await\s+beacon\.getAddress\(\)|beacon\.target)\s*\)/g;
  
  const replacedContent = content.replace(pattern1, (match, indent, constDecl, varAssignment, beaconArg) => {
    modified = true;
    const varPart = constDecl ? constDecl : '';
    const assignPart = varAssignment ? varAssignment : '';
    
    return `${indent}// Deploy MockOracleAdapter for TokenManager
${indent}const MockOracleAdapterFactory = await ethers.getContractFactory("MockOracleAdapter");
${indent}const mockOracleAdapter = await MockOracleAdapterFactory.deploy();
${indent}await mockOracleAdapter.waitForDeployment();
${indent}
${indent}${varPart}${assignPart}await TokenManagerFactory.deploy(
${indent}  ${beaconArg},
${indent}  await mockOracleAdapter.getAddress()
${indent})`;
  });
  
  if (modified) {
    fs.writeFileSync(fullPath, replacedContent, 'utf8');
    console.log(`  ✅ Fixed!`);
  } else {
    console.log(`  ℹ️  No changes needed`);
  }
}

console.log('🚀 Starting TokenManager test fixes...\n');
console.log('This script adds MockOracleAdapter deployment before TokenManager.deploy()');

testFiles.forEach(fixFile);

console.log('\n✨ Done!\n');
