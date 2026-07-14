/**
 * 🔍 CHECK LP TOKEN HOLDERS
 * Script per trovare chi possiede i LP tokens nel pool
 */

import { ethers } from "hardhat";

const CONTRACTS = {
  proxyGeneral: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1"
};

async function main() {
  console.log("🔍 CHECKING LP TOKEN HOLDERS\n");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}\n`);
  
  const proxyGeneral = await ethers.getContractAt("ProxyGeneral", CONTRACTS.proxyGeneral);
  
  // Get total supply
  const totalSupply = await proxyGeneral.totalSupply();
  console.log(`💎 Total LP Supply: ${ethers.formatEther(totalSupply)} LP\n`);
  
  if (totalSupply === 0n) {
    console.log("❌ No LP tokens exist (pool is empty or never used)");
    return;
  }
  
  // Check deployer balance
  const deployerBalance = await proxyGeneral.balanceOf(deployer.address);
  console.log(`👤 Your LP Balance: ${ethers.formatEther(deployerBalance)} LP`);
  
  if (deployerBalance === 0n) {
    console.log("\n⚠️ You don't have any LP tokens!");
    console.log("   Checking for LP Transfer events to find holders...\n");
    
    // Query Transfer events to find who has LP tokens
    const transferFilter = proxyGeneral.filters.Transfer();
    const currentBlock = await deployer.provider.getBlockNumber();
    
    // Query last 10000 blocks (adjust if needed)
    const fromBlock = currentBlock - 10000 > 0 ? currentBlock - 10000 : 0;
    
    console.log(`📊 Scanning blocks ${fromBlock} to ${currentBlock}...`);
    
    const events = await proxyGeneral.queryFilter(transferFilter, fromBlock, currentBlock);
    
    console.log(`\n📜 Found ${events.length} Transfer events:\n`);
    
    // Track all unique holders
    const holders = new Map<string, bigint>();
    
    for (const event of events) {
      if (event.args) {
        const from = event.args.from;
        const to = event.args.to;
        const value = event.args.value;
        
        console.log(`   Block ${event.blockNumber}:`);
        console.log(`      From: ${from}`);
        console.log(`      To: ${to}`);
        console.log(`      Amount: ${ethers.formatEther(value)} LP\n`);
        
        // Track balances
        if (from !== ethers.ZeroAddress) {
          const current = holders.get(from) || 0n;
          holders.set(from, current - value);
        }
        
        if (to !== ethers.ZeroAddress) {
          const current = holders.get(to) || 0n;
          holders.set(to, current + value);
        }
      }
    }
    
    console.log("\n💰 Current LP Token Holders (based on events):");
    
    for (const [address, balance] of holders.entries()) {
      if (balance > 0n) {
        console.log(`   ${address}: ${ethers.formatEther(balance)} LP`);
      }
    }
  } else {
    console.log(`\n✅ You have ${ethers.formatEther(deployerBalance)} LP tokens`);
    console.log(`   That's ${totalSupply > 0n ? Number(deployerBalance * 10000n / totalSupply) / 100 : 0}% of the pool`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
