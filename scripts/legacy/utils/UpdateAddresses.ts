/**
 * 🔧 UPDATE CONTRACT ADDRESSES
 * Script per aggiornare automaticamente gli indirizzi dei contratti nel .env
 * Esegui dopo ogni deploy per aggiornare la configurazione
 */

import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

interface DeploymentAddresses {
  beacon?: string;
  liquidityManager?: string;
  valueCalculator?: string;
  tokenManager?: string;
  parameterManager?: string;
  proxyGeneral?: string;
  swapManager?: string;
  emergencyHandler?: string;
}

/**
 * Aggiorna il file .env con i nuovi indirizzi
 */
function updateEnvFile(addresses: DeploymentAddresses) {
  const envPath = path.join(__dirname, "../../.env");
  
  let envContent = "";
  
  // Leggi il file .env esistente se presente
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  // Aggiorna o aggiungi ogni indirizzo
  Object.entries(addresses).forEach(([contractName, address]) => {
    if (!address) return;
    
    const envVarName = contractName.replace(/([A-Z])/g, "_$1").toUpperCase() + "_ADDRESS";
    const envLine = `${envVarName}=${address}`;
    
    // Cerca se la variabile esiste già
    const regex = new RegExp(`^${envVarName}=.*$`, "m");
    
    if (regex.test(envContent)) {
      // Aggiorna la riga esistente
      envContent = envContent.replace(regex, envLine);
      console.log(`✅ Updated ${envVarName}: ${address}`);
    } else {
      // Aggiungi nuova riga
      if (!envContent.endsWith("\n") && envContent.length > 0) {
        envContent += "\n";
      }
      envContent += envLine + "\n";
      console.log(`➕ Added ${envVarName}: ${address}`);
    }
  });

  // Scrivi il file aggiornato
  fs.writeFileSync(envPath, envContent);
  console.log(`💾 Environment file updated: ${envPath}`);
}

/**
 * Ottieni indirizzi dall'ultima deployment (se disponibile)
 */
async function getDeploymentAddresses(): Promise<DeploymentAddresses> {
  console.log("🔍 Trying to detect deployed contract addresses...");
  
  // Qui potresti implementare la logica per leggere da un file di deployment
  // o da un registro dei contratti deployati
  
  // Per ora, chiediamo all'utente di fornirli manualmente
  return {};
}

/**
 * Verifica che gli indirizzi siano validi
 */
function validateAddresses(addresses: DeploymentAddresses): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  Object.entries(addresses).forEach(([name, address]) => {
    if (address && !ethers.isAddress(address)) {
      errors.push(`Invalid address for ${name}: ${address}`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

async function main() {
  console.log("🔧 CONTRACT ADDRESS UPDATER");
  console.log("This script helps you update contract addresses in the .env file");
  
  // Esempio di come aggiornare gli indirizzi manualmente
  // Sostituisci questi con gli indirizzi reali dei tuoi contratti deployati
  const newAddresses: DeploymentAddresses = {
    // beacon: "0x...",
    // liquidityManager: "0x...",
    // valueCalculator: "0x...",
    // tokenManager: "0x...",
    // parameterManager: "0x...",
    // proxyGeneral: "0x...",
    // swapManager: "0x...",
    // emergencyHandler: "0x..."
  };

  console.log("\n📝 Instructions:");
  console.log("1. Edit this script and add your deployed contract addresses");
  console.log("2. Uncomment the lines in the newAddresses object");
  console.log("3. Run the script again to update the .env file");
  console.log("\nExample:");
  console.log('beacon: "0x5FbDB2315678afecb367f032d93F642f64180aa3",');
  
  // Conta quanti indirizzi sono stati forniti
  const providedAddresses = Object.values(newAddresses).filter(addr => addr && addr.length > 0);
  
  if (providedAddresses.length === 0) {
    console.log("\n⚠️  No addresses provided. Please edit this script first.");
    console.log("Add your contract addresses to the newAddresses object and run again.");
    return;
  }

  console.log(`\n🔍 Found ${providedAddresses.length} address(es) to update:`);
  Object.entries(newAddresses).forEach(([name, address]) => {
    if (address) {
      console.log(`   ${name}: ${address}`);
    }
  });

  // Valida gli indirizzi
  const validation = validateAddresses(newAddresses);
  if (!validation.valid) {
    console.log("\n❌ Address validation failed:");
    validation.errors.forEach(error => console.log(`   - ${error}`));
    return;
  }

  // Aggiorna il file .env
  console.log("\n💾 Updating .env file...");
  updateEnvFile(newAddresses);
  
  console.log("\n✅ Contract addresses updated successfully!");
  console.log("You can now run other scripts with the updated configuration.");
  
  // Mostra come verificare la configurazione
  console.log("\n📋 Next steps:");
  console.log("1. npx hardhat run scripts/interact/SystemStatus.ts  # Verify configuration");
  console.log("2. npx hardhat run scripts/interact/DepositETH.ts   # Test deposit");
  console.log("3. npx hardhat run scripts/interact/WithdrawETH.ts  # Test withdraw");
}

// Esegui lo script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });