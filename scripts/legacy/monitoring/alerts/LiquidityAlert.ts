/**
 * LiquidityAlert.ts - Liquidity Warnings
 * 
 * ⚠️ CRITICAL PATTERNS:
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 * - Check LiquidityManager balance via ethers.provider.getBalance()
 * - Reference: test/integration/LiquidityFlow
 */

import { ethers } from "hardhat";
import { Beacon, LiquidityManager } from "../../../typechain-types";

interface LiquidityAlert {
  contractAddress: string;
  balance: bigint;
  threshold: bigint;
  alertType: "low" | "critical" | "zero";
  severity: "warning" | "critical";
  timestamp: number;
}

class LiquidityAlertMonitor {
  private contracts!: { beacon: Beacon; liquidityManager: LiquidityManager };
  private readonly LOW_THRESHOLD = ethers.parseEther("1.0"); // 1 ETH
  private readonly CRITICAL_THRESHOLD = ethers.parseEther("0.1"); // 0.1 ETH

  async initialize() {
    console.log("🔧 Initializing Liquidity Alert Monitor...");
    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) throw new Error("❌ BEACON_ADDRESS not set");

    this.contracts = {
      beacon: await ethers.getContractAt("Beacon", beaconAddress)
    } as any;

    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    this.contracts.liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);

    console.log("✅ Liquidity Alert Monitor initialized");
  }

  async checkLiquidityAlerts(): Promise<LiquidityAlert[]> {
    console.log("\n🔍 Checking liquidity levels...");
    const alerts: LiquidityAlert[] = [];

    const liquidityManagerAddr = await this.contracts.liquidityManager.getAddress();
    
    // Pattern: Check balance via ethers.provider.getBalance()
    const balance = await ethers.provider.getBalance(liquidityManagerAddr);

    console.log(`   LiquidityManager balance: ${ethers.formatEther(balance)} ETH`);

    // Check if balance is zero
    if (balance === 0n) {
      alerts.push({
        contractAddress: liquidityManagerAddr,
        balance,
        threshold: 0n,
        alertType: "zero",
        severity: "critical",
        timestamp: Date.now()
      });
      console.log(`   🚨 CRITICAL: LiquidityManager balance is ZERO!`);
    }
    // Check if balance is critically low
    else if (balance < this.CRITICAL_THRESHOLD) {
      alerts.push({
        contractAddress: liquidityManagerAddr,
        balance,
        threshold: this.CRITICAL_THRESHOLD,
        alertType: "critical",
        severity: "critical",
        timestamp: Date.now()
      });
      console.log(`   🚨 CRITICAL: LiquidityManager balance below ${ethers.formatEther(this.CRITICAL_THRESHOLD)} ETH`);
    }
    // Check if balance is low
    else if (balance < this.LOW_THRESHOLD) {
      alerts.push({
        contractAddress: liquidityManagerAddr,
        balance,
        threshold: this.LOW_THRESHOLD,
        alertType: "low",
        severity: "warning",
        timestamp: Date.now()
      });
      console.log(`   ⚠️ WARNING: LiquidityManager balance below ${ethers.formatEther(this.LOW_THRESHOLD)} ETH`);
    } else {
      console.log(`   ✅ Liquidity level is healthy`);
    }

    return alerts;
  }

  async monitorLiquidity() {
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║     LIQUIDITY WARNING MONITOR         ║");
    console.log("╚════════════════════════════════════════╝");

    const alerts = await this.checkLiquidityAlerts();

    if (alerts.length === 0) {
      console.log("\n✅ All liquidity levels are healthy");
    } else {
      console.log(`\n⚠️ ${alerts.length} liquidity alerts detected:`);
      alerts.forEach((alert, idx) => {
        console.log(`\n   ${idx + 1}. ${alert.severity.toUpperCase()}`);
        console.log(`      Type: ${alert.alertType}`);
        console.log(`      Balance: ${ethers.formatEther(alert.balance)} ETH`);
        console.log(`      Threshold: ${ethers.formatEther(alert.threshold)} ETH`);
      });
    }

    return alerts;
  }
}

async function main() {
  const monitor = new LiquidityAlertMonitor();
  await monitor.initialize();
  await monitor.monitorLiquidity();
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}

export { LiquidityAlertMonitor, LiquidityAlert };
