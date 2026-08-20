/**
 * 💰 DEPOSIT ETH SCRIPT
 * Script per depositare ETH nel pool di liquidità
 * Basato sui test di integrazione esistenti
 */

import { ethers } from "hardhat";
import { 
  getAllContracts, 
  AMOUNTS, 
  NETWORK_CONFIG, 
  Logger, 
  showConfig, 
  validateConfig 
} from "../config/config";

async function main() {
  Logger.section("ETH Deposit Script");
  
  // Verifica configurazione
  const validation = validateConfig();
  if (!validation.isValid) {
    Logger.error("Configuration errors found:");
    validation.errors.forEach(error => console.log(`   - ${error}`));
    return;
  }

  // Ottieni l'account deployer
  const [deployer] = await ethers.getSigners();
  Logger.info(`Using account: ${deployer.address}`);
  Logger.info(`Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

  // Mostra configurazione se verbose
  if (process.env.VERBOSE_LOGGING === "true") {
    showConfig();
  }

  // Connetti a tutti i contratti usando la configurazione centralizzata
  const contracts = await getAllContracts();

  // Parametri del deposito dalla configurazione
  const DEPOSIT_AMOUNT = AMOUNTS.DEFAULT_DEPOSIT;
  
  Logger.section("Pre-Deposit State");
  
  // Ottieni stato del pool (codice dai test!)
  try {
    const poolValue = await contracts.valueCalculator.getTotalPoolValueView();
    Logger.info(`Pool Value: ${ethers.formatEther(poolValue)} ETH`);
  } catch (error) {
    Logger.info("Pool Value: Unable to fetch (possibly empty pool)");
  }

  // Ottieni balance LP dell'utente (codice dai test!)
  const userLPBalance = await contracts.proxyGeneral.balanceOf(deployer.address);
  Logger.info(`User LP Balance: ${ethers.formatEther(userLPBalance)} LP`);

  Logger.section("Executing Deposit");
  Logger.info(`Depositing: ${ethers.formatEther(DEPOSIT_AMOUNT)} ETH`);

  // Esegui il deposito (stesso codice dei test!)
  try {
    const tx = await contracts.liquidityManager.deposit({
      value: DEPOSIT_AMOUNT,
      gasLimit: NETWORK_CONFIG.gasLimit
    });
    
    Logger.info(`Transaction hash: ${tx.hash}`);
    Logger.info("Waiting for confirmation...");
    
    const receipt = await tx.wait(NETWORK_CONFIG.confirmations);
    if (receipt) {
      Logger.success(`Transaction confirmed in block: ${receipt.blockNumber}`);
      Logger.info(`Gas used: ${receipt.gasUsed.toString()}`);
    } else {
      Logger.error("Transaction receipt not available");
    }

  } catch (error: any) {
    Logger.error(`Deposit failed: ${error.message}`);
    return;
  }

  Logger.section("Post-Deposit State");
  
  // Verifica stato dopo deposito (codice dai test!)
  try {
    const newPoolValue = await contracts.valueCalculator.getTotalPoolValueView();
    Logger.info(`New Pool Value: ${ethers.formatEther(newPoolValue)} ETH`);
    
    const newUserLPBalance = await contracts.proxyGeneral.balanceOf(deployer.address);
    Logger.info(`New LP Balance: ${ethers.formatEther(newUserLPBalance)} LP`);
    
    const lpTokensReceived = newUserLPBalance - userLPBalance;
    Logger.success(`LP Tokens Received: ${ethers.formatEther(lpTokensReceived)} LP`);
    
    // Calcola prezzo LP token (codice dai test!)
    if (lpTokensReceived > 0n) {
      const lpPrice = (DEPOSIT_AMOUNT * ethers.parseEther("1")) / lpTokensReceived;
      Logger.info(`LP Token Price: ${ethers.formatEther(lpPrice)} ETH per LP`);
    }

  } catch (error: any) {
    Logger.error(`Error fetching post-deposit state: ${error.message}`);
  }

  Logger.success("Deposit Script Completed!");
}

// Esegui lo script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });