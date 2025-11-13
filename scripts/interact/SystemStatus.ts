/**
 * 📊 SYSTEM STATUS SCRIPT
 * Script per verificare lo stato completo del sistema DeFi
 * Basato sui test di integrazione esistenti
 */

import { ethers } from "hardhat";

async function main() {
  console.log("🔍 CHECKING SYSTEM STATUS");
  
  // Ottieni l'account deployer
  const [deployer] = await ethers.getSigners();
  console.log(`💼 Checking from account: ${deployer.address}`);

  // Indirizzi dei contratti deployati (da sostituire con quelli reali)
  const DEPLOYED_CONTRACTS = {
    beacon: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Sostituisci con indirizzo reale
    liquidityManager: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707", // Sostituisci con indirizzo reale
    valueCalculator: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9", // Sostituisci con indirizzo reale
    parameterManager: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" // Sostituisci con indirizzo reale
  };

  try {
    // Connetti ai contratti (stesso codice dei test!)
    console.log("\n🔗 CONNECTING TO CONTRACTS:");
    const beacon = await ethers.getContractAt("Beacon", DEPLOYED_CONTRACTS.beacon);
    console.log(`   ✅ Beacon: ${DEPLOYED_CONTRACTS.beacon}`);
    
    const liquidityManager = await ethers.getContractAt("LiquidityManager", DEPLOYED_CONTRACTS.liquidityManager);
    console.log(`   ✅ LiquidityManager: ${DEPLOYED_CONTRACTS.liquidityManager}`);
    
    const valueCalculator = await ethers.getContractAt("ValueCalculator", DEPLOYED_CONTRACTS.valueCalculator);
    console.log(`   ✅ ValueCalculator: ${DEPLOYED_CONTRACTS.valueCalculator}`);

    // Verifica moduli registrati nel Beacon (codice dai test!)
    console.log("\n📡 BEACON STATUS:");
    try {
      const registeredModules = await beacon.getRegisteredModules();
      console.log(`   📊 Registered Modules: ${registeredModules.length}`);
      
      for (const moduleName of registeredModules) {
        const moduleAddr = await beacon.getImplementation(moduleName);
        console.log(`   ✅ ${moduleName}: ${moduleAddr}`);
      }
      
      // Verifica health del sistema (codice dai test!)
      const healthCheck = await beacon.checkSystemHealth();
      console.log(`   🏥 System Health: ${healthCheck.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      
    } catch (error: any) {
      console.log(`   ❌ Beacon status error: ${error.message}`);
    }

    // Verifica stato del pool (codice dai test!)
    console.log("\n🌊 LIQUIDITY POOL STATUS:");
    try {
      const poolValue = await valueCalculator.getTotalPoolValueView();
      console.log(`   💰 Total Pool Value: ${ethers.formatEther(poolValue)} ETH`);
      
      // Ottieni informazioni dettagliate del pool
      const poolInfo = await valueCalculator.getTotalPoolValue.staticCall();
      console.log(`   🎫 Total Pool Value: ${ethers.formatEther(poolInfo.totalValue)} ETH`);
      console.log(`   📊 Token Types: ${poolInfo.tokenValues.length}`);
      
      for (const tokenValue of poolInfo.tokenValues) {
        console.log(`   🪙 ${tokenValue.tokenCode}: ${ethers.formatEther(tokenValue.value)} ETH (${Number(tokenValue.percentage)/100}%)`);
      }
      
    } catch (error: any) {
      console.log(`   ❌ Pool status error: ${error.message}`);
    }

    // Verifica balance dell'utente (codice dai test!)
    console.log("\n👤 USER STATUS:");
    try {
      const proxyGeneralAddr = await beacon.getImplementation("ProxyGeneral");
      const proxyGeneral = await ethers.getContractAt("ProxyGeneral", proxyGeneralAddr);
      
      const userLPBalance = await proxyGeneral.balanceOf(deployer.address);
      console.log(`   🎫 LP Token Balance: ${ethers.formatEther(userLPBalance)} LP`);
      
      const userETHBalance = await deployer.provider.getBalance(deployer.address);
      console.log(`   💰 ETH Balance: ${ethers.formatEther(userETHBalance)} ETH`);
      
      // Calcola valore LP in ETH
      if (userLPBalance > 0n) {
        const poolValue = await valueCalculator.getTotalPoolValueView();
        const totalSupply = await proxyGeneral.totalSupply();
        
        if (totalSupply > 0n) {
          const userPoolShare = (userLPBalance * poolValue) / totalSupply;
          console.log(`   💎 LP Value: ${ethers.formatEther(userPoolShare)} ETH`);
          
          const lpPrice = (poolValue * ethers.parseEther("1")) / totalSupply;
          console.log(`   💰 LP Price: ${ethers.formatEther(lpPrice)} ETH per LP`);
        }
      }
      
    } catch (error: any) {
      console.log(`   ❌ User status error: ${error.message}`);
    }

    // Verifica parametri di sistema (codice dai test!)
    console.log("\n⚙️ SYSTEM PARAMETERS:");
    try {
      const parameterManager = await ethers.getContractAt("ParameterManager", DEPLOYED_CONTRACTS.parameterManager);
      
      // Verifica fee di deposito
      try {
        const depositFee = await parameterManager.getParameter("DEPOSIT_FEE_RATE");
        console.log(`   💸 Deposit Fee: ${Number(depositFee)/100}%`);
      } catch {
        console.log(`   💸 Deposit Fee: Not configured`);
      }
      
      // Verifica fee di withdraw
      try {
        const withdrawFee = await parameterManager.getParameter("WITHDRAW_FEE_RATE");
        console.log(`   💸 Withdraw Fee: ${Number(withdrawFee)/100}%`);
      } catch {
        console.log(`   💸 Withdraw Fee: Not configured`);
      }
      
    } catch (error: any) {
      console.log(`   ❌ Parameters error: ${error.message}`);
    }

    // Verifica stato di emergenza (codice dai test!)
    console.log("\n🚨 EMERGENCY STATUS:");
    try {
      const emergencyHandlerAddr = await beacon.getImplementation("EmergencyHandler");
      const emergencyHandler = await ethers.getContractAt("EmergencyHandler", emergencyHandlerAddr);
      
      const isPaused = await emergencyHandler.isPaused();
      console.log(`   ⏸️ System Paused: ${isPaused ? 'YES' : 'NO'}`);
      
      if (!isPaused) {
        const canPause = await emergencyHandler.canPause();
        console.log(`   🛡️ Can Pause: ${canPause[0] ? 'YES' : 'NO'}`);
        if (!canPause[0]) {
          console.log(`   📋 Reason: ${canPause[1]}`);
        }
      } else {
        const canUnpause = await emergencyHandler.canUnpause();
        console.log(`   🔓 Can Unpause: ${canUnpause[0] ? 'YES' : 'NO'}`);
        if (!canUnpause[0]) {
          console.log(`   📋 Reason: ${canUnpause[1]}`);
        }
      }
      
    } catch (error: any) {
      console.log(`   ❌ Emergency status error: ${error.message}`);
    }

  } catch (error: any) {
    console.error("💥 System status check failed:", error);
    return;
  }

  console.log("\n✅ SYSTEM STATUS CHECK COMPLETED!");
}

// Esegui lo script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });