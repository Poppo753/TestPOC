/**
 * 💳 WITHDRAW ETH SCRIPT
 * Script per ritirare ETH dal pool di liquidità
 * Basato sui test di integrazione esistenti
 */

import { ethers } from "hardhat";

async function main() {
  console.log("🚀 STARTING ETH WITHDRAW SCRIPT");
  
  // Ottieni l'account deployer
  const [deployer] = await ethers.getSigners();
  console.log(`💼 Using account: ${deployer.address}`);
  console.log(`💰 Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

  // Indirizzi dei contratti deployati (da sostituire con quelli reali)
  const DEPLOYED_CONTRACTS = {
    beacon: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Sostituisci con indirizzo reale
    liquidityManager: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707", // Sostituisci con indirizzo reale
    valueCalculator: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" // Sostituisci con indirizzo reale
  };

  // Connetti ai contratti (stesso codice dei test!)
  const beacon = await ethers.getContractAt("Beacon", DEPLOYED_CONTRACTS.beacon);
  const liquidityManager = await ethers.getContractAt("LiquidityManager", DEPLOYED_CONTRACTS.liquidityManager);
  const valueCalculator = await ethers.getContractAt("ValueCalculator", DEPLOYED_CONTRACTS.valueCalculator);
  
  // Ottieni ProxyGeneral per i balance LP
  const proxyGeneralAddr = await beacon.getImplementation("ProxyGeneral");
  const proxyGeneral = await ethers.getContractAt("ProxyGeneral", proxyGeneralAddr);

  console.log(`\n📊 PRE-WITHDRAW STATE:`);
  
  // Ottieni stato del pool (codice dai test!)
  try {
    const poolValue = await valueCalculator.getTotalPoolValueView();
    console.log(`   🌊 Pool Value: ${ethers.formatEther(poolValue)} ETH`);
  } catch (error) {
    console.log("   🌊 Pool Value: Unable to fetch");
  }

  // Ottieni balance LP dell'utente (codice dai test!)
  const userLPBalance = await proxyGeneral.balanceOf(deployer.address);
  console.log(`   🎫 User LP Balance: ${ethers.formatEther(userLPBalance)} LP`);

  if (userLPBalance === 0n) {
    console.log("   ❌ No LP tokens to withdraw!");
    return;
  }

  // Parametri del withdraw - ritira metà dei LP tokens
  const WITHDRAW_AMOUNT = userLPBalance / 2n; // Ritira il 50%
  
  console.log(`\n💳 EXECUTING WITHDRAW:`);
  console.log(`   📤 Withdrawing: ${ethers.formatEther(WITHDRAW_AMOUNT)} LP`);

  // Ottieni ETH balance prima del withdraw
  const ethBalanceBefore = await deployer.provider.getBalance(deployer.address);

  // Esegui il withdraw (stesso codice dei test!)
  try {
    const tx = await liquidityManager.withdraw(WITHDRAW_AMOUNT, {
      gasLimit: 500000 // Gas limit di sicurezza
    });
    
    console.log(`   ⏳ Transaction hash: ${tx.hash}`);
    console.log("   ⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    if (receipt) {
      console.log(`   ✅ Transaction confirmed in block: ${receipt.blockNumber}`);
      console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}`);
    } else {
      console.log("   ⚠️ Transaction receipt not available");
    }

  } catch (error: any) {
    console.error("   ❌ Withdraw failed:", error.message);
    return;
  }

  console.log(`\n📊 POST-WITHDRAW STATE:`);
  
  // Verifica stato dopo withdraw (codice dai test!)
  try {
    const newPoolValue = await valueCalculator.getTotalPoolValueView();
    console.log(`   🌊 New Pool Value: ${ethers.formatEther(newPoolValue)} ETH`);
    
    const newUserLPBalance = await proxyGeneral.balanceOf(deployer.address);
    console.log(`   🎫 New LP Balance: ${ethers.formatEther(newUserLPBalance)} LP`);
    
    const lpTokensBurned = userLPBalance - newUserLPBalance;
    console.log(`   🔥 LP Tokens Burned: ${ethers.formatEther(lpTokensBurned)} LP`);
    
    // Calcola ETH ricevuto
    const ethBalanceAfter = await deployer.provider.getBalance(deployer.address);
    const ethReceived = ethBalanceAfter - ethBalanceBefore;
    console.log(`   💰 ETH Received: ${ethers.formatEther(ethReceived)} ETH`);
    
    // Calcola prezzo LP token nel withdraw (codice dai test!)
    if (lpTokensBurned > 0n && ethReceived > 0n) {
      const lpPrice = (ethReceived * ethers.parseEther("1")) / lpTokensBurned;
      console.log(`   💰 LP Token Price: ${ethers.formatEther(lpPrice)} ETH per LP`);
    }

  } catch (error: any) {
    console.error("   ❌ Error fetching post-withdraw state:", error.message);
  }

  console.log("\n🎉 WITHDRAW SCRIPT COMPLETED!");
}

// Esegui lo script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });