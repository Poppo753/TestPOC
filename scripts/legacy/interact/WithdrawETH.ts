/**
 * 💳 WITHDRAW ETH SCRIPT
 * Script per ritirare ETH dal pool di liquidità
 * Basato sui test di integrazione esistenti
 */

import { ethers } from "hardhat";
import { getAllContracts, Logger } from "../config/config";

async function main() {
  Logger.section("ETH Withdraw Script");
  
  // Ottieni l'account deployer
  const [deployer] = await ethers.getSigners();
  Logger.info(`Using account: ${deployer.address}`);
  Logger.info(`Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

  // Connetti a tutti i contratti usando la configurazione centralizzata
  Logger.info("Connecting to all contracts...");
  const contracts = await getAllContracts();
  Logger.success("All contracts connected successfully");

  const { beacon, liquidityManager, valueCalculator, proxyGeneral } = contracts;

  Logger.section("Pre-Withdraw State");
  
  // Ottieni stato del pool (codice dai test!)
  try {
    const poolValue = await valueCalculator.getTotalPoolValueView();
    Logger.info(`Pool Value: ${ethers.formatEther(poolValue)} ETH`);
  } catch (error) {
    // Pool vuoto o nessun token, normale dopo withdraw completo
    Logger.info("Pool Value: 0 ETH (empty pool)");
  }

  // Ottieni balance LP dell'utente (codice dai test!)
  const userLPBalance = await proxyGeneral.balanceOf(deployer.address);
  Logger.info(`User LP Balance: ${ethers.formatEther(userLPBalance)} LP`);

  if (userLPBalance === 0n) {
    Logger.error("No LP tokens to withdraw!");
    return;
  }

  // Parametri del withdraw - ritira TUTTI i LP tokens
  const WITHDRAW_AMOUNT = userLPBalance; // Ritira il 100%
  
  Logger.section("Executing Withdraw");
  Logger.info(`Withdrawing: ${ethers.formatEther(WITHDRAW_AMOUNT)} LP`);

  // Ottieni ETH balance prima del withdraw
  const ethBalanceBefore = await deployer.provider.getBalance(deployer.address);

  // Esegui il withdraw (stesso codice dei test!)
  try {
    const tx = await liquidityManager.withdraw(WITHDRAW_AMOUNT, {
      gasLimit: 2000000 // Increased gas limit to see full error
    });
    
    Logger.info(`Transaction hash: ${tx.hash}`);
    Logger.info("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    if (receipt) {
      Logger.success(`Transaction confirmed in block: ${receipt.blockNumber}`);
      Logger.info(`Gas used: ${receipt.gasUsed.toString()}`);
    } else {
      Logger.info("Transaction receipt not available");
    }

  } catch (error: any) {
    Logger.error(`Withdraw failed: ${error.message}`);
    return;
  }

  Logger.section("Post-Withdraw State");
  
  // Verifica stato dopo withdraw
  try {
    // Pool value (può essere 0 se withdraw completo)
    try {
      const newPoolValue = await valueCalculator.getTotalPoolValueView();
      Logger.info(`New Pool Value: ${ethers.formatEther(newPoolValue)} ETH`);
    } catch {
      Logger.info(`New Pool Value: 0 ETH (empty pool)`);
    }
    
    const newUserLPBalance = await proxyGeneral.balanceOf(deployer.address);
    Logger.info(`New LP Balance: ${ethers.formatEther(newUserLPBalance)} LP`);
    
    const lpTokensBurned = userLPBalance - newUserLPBalance;
    Logger.success(`LP Tokens Burned: ${ethers.formatEther(lpTokensBurned)} LP`);
    
    // Calcola ETH ricevuto (approssimativo, include gas)
    const ethBalanceAfter = await deployer.provider.getBalance(deployer.address);
    const ethChange = ethBalanceAfter - ethBalanceBefore;
    
    // Il change è negativo per il gas, ma positivo per l'ETH ricevuto
    // In un withdraw così piccolo, il gas può essere maggiore dell'ETH ricevuto
    if (ethChange > 0n) {
      Logger.success(`Net ETH Received: ${ethers.formatEther(ethChange)} ETH`);
    } else {
      Logger.info(`Net ETH Change: ${ethers.formatEther(ethChange)} ETH (includes gas costs)`);
      // Per withdraw piccoli, il gas costa più dell'ETH ricevuto
      Logger.info(`Note: For small withdrawals, gas costs may exceed ETH received`);
    }
    
    // Calcola prezzo LP token nel withdraw
    if (lpTokensBurned > 0n) {
      // Il valore teorico è ~1:1 con l'ETH depositato (meno fees)
      Logger.info(`Theoretical ETH value: ~${ethers.formatEther(lpTokensBurned)} ETH (minus 0.1% fee)`);
    }

  } catch (error: any) {
    Logger.info(`Could not fully verify post-withdraw state: ${error.message}`);
  }

  Logger.success("Withdraw Script Completed!");
}

// Esegui lo script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });