/**
 * 📋 SHOW CONFIGURATION
 * Script per visualizzare la configurazione corrente del sistema
 */

import { showConfig, validateConfig } from "../config/config";

async function main() {
  console.log("📋 CURRENT SYSTEM CONFIGURATION");
  console.log("=" .repeat(50));
  
  // Mostra tutta la configurazione
  showConfig();
  
  // Mostra validazione dettagliata
  const validation = validateConfig();
  
  console.log("\n🔍 CONFIGURATION VALIDATION:");
  if (validation.isValid) {
    console.log("✅ All configuration is valid and ready to use");
  } else {
    console.log("❌ Configuration has the following issues:");
    validation.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    
    console.log("\n🔧 To fix these issues:");
    console.log("1. Edit the .env file with correct values");
    console.log("2. Or run: npx hardhat run scripts/utils/UpdateAddresses.ts");
  }
  
  console.log("\n📚 USAGE EXAMPLES:");
  console.log("# Deploy contracts:");
  console.log("npx hardhat run scripts/deploy/DeployAll.ts --network localhost");
  console.log("");
  console.log("# Update addresses after deploy:");
  console.log("npx hardhat run scripts/utils/UpdateAddresses.ts");
  console.log("");
  console.log("# Check system status:");
  console.log("npx hardhat run scripts/interact/SystemStatus.ts --network localhost");
  console.log("");
  console.log("# Deposit ETH:");
  console.log("npx hardhat run scripts/interact/DepositETH.ts --network localhost");
  console.log("");
  console.log("# Withdraw ETH:");
  console.log("npx hardhat run scripts/interact/WithdrawETH.ts --network localhost");
}

// Esegui lo script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });