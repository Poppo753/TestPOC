/**
 * 💰 DEPOSIT ETH FOR TESTING
 * Quick script to deposit ETH so we can test the withdrawal fix
 */

import { ethers } from "hardhat";
import { Logger } from "../config/config";

const CONTRACTS = {
  liquidityManager: "0x545b79254F74Ba33958290BB73F2a338509c975d"
};

async function main() {
  Logger.section("💰 Deposit ETH for Testing");
  
  const [deployer] = await ethers.getSigners();
  Logger.info(`Account: ${deployer.address}`);
  Logger.info(`Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  const liquidityManager = await ethers.getContractAt("LiquidityManager", CONTRACTS.liquidityManager);
  
  // Deposit small amount for testing
  const depositAmount = ethers.parseEther("0.0001"); // 0.0001 ETH
  
  Logger.info(`Depositing ${ethers.formatEther(depositAmount)} ETH...`);
  
  const tx = await liquidityManager.deposit({ value: depositAmount });
  Logger.info(`Transaction: ${tx.hash}`);
  
  const receipt = await tx.wait();
  if (!receipt) {
    Logger.error("Transaction failed");
    return;
  }
  
  Logger.success(`✅ Deposit successful in block ${receipt.blockNumber}`);
  Logger.info(`Gas used: ${receipt.gasUsed.toString()}`);
  
  // Get LP balance
  const proxyGeneral = await ethers.getContractAt(
    "ProxyGeneral",
    "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1"
  );
  
  const lpBalance = await proxyGeneral.balanceOf(deployer.address);
  Logger.success(`\n💎 LP Tokens received: ${ethers.formatEther(lpBalance)} LP`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Failed:", error);
    process.exit(1);
  });
