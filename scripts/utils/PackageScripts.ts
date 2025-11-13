/**
 * 🎯 QUICK COMMANDS
 * Script shortcuts per operazioni comuni
 */

// Aggiungi questi script al package.json nella sezione "scripts":

const SUGGESTED_SCRIPTS = {
  // Configurazione
  "config:show": "hardhat run scripts/utils/ShowConfig.ts",
  "config:update": "hardhat run scripts/utils/UpdateAddresses.ts",
  
  // Interazione principale
  "defi:status": "hardhat run scripts/interact/SystemStatus.ts",
  "defi:deposit": "hardhat run scripts/interact/DepositETH.ts",
  "defi:withdraw": "hardhat run scripts/interact/WithdrawETH.ts",
  
  // Test completi
  "test:unit": "hardhat test test/unit/",
  "test:integration": "hardhat test test/integration/",
  "test:all": "hardhat test",
  
  // Deploy
  "deploy:local": "hardhat run scripts/deploy/DeployAll.ts --network localhost",
  "deploy:testnet": "hardhat run scripts/deploy/DeployAll.ts --network sepolia"
};

console.log("📦 SUGGESTED PACKAGE.JSON SCRIPTS");
console.log("Add these to your package.json scripts section:");
console.log("\n```json");
console.log(JSON.stringify(SUGGESTED_SCRIPTS, null, 2));
console.log("```");

console.log("\n🎯 USAGE EXAMPLES:");
console.log("npm run config:show       # Show current configuration");
console.log("npm run config:update     # Update contract addresses");
console.log("npm run defi:status       # Check system status");
console.log("npm run defi:deposit      # Deposit ETH");
console.log("npm run defi:withdraw     # Withdraw ETH");
console.log("npm run test:all          # Run all tests");

export { SUGGESTED_SCRIPTS };