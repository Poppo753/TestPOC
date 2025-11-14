/**
 * PriceAlert.ts - Price Deviation Alerts
 * 
 * ⚠️ CRITICAL PATTERNS (from tests):
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 * - TokenManager.getTokenPrice() returns (price, updatedAt, isStale) - MUST use tuple destructuring
 * - Reference: test/unit/TokenManager.test.ts line 245
 */

import { ethers } from "hardhat";
import { Beacon, TokenManager } from "../../../typechain-types";

interface PriceAlert {
  tokenCode: string;
  price: bigint;
  updatedAt: bigint;
  isStale: boolean;
  alertType: "stale" | "deviation" | "zero";
  severity: "warning" | "critical";
  timestamp: number;
}

class PriceAlertMonitor {
  private contracts!: { beacon: Beacon; tokenManager: TokenManager };
  private readonly STALE_THRESHOLD = 3600; // 1 hour

  async initialize() {
    console.log("🔧 Initializing Price Alert Monitor...");
    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) throw new Error("❌ BEACON_ADDRESS not set");

    this.contracts = {
      beacon: await ethers.getContractAt("Beacon", beaconAddress)
    } as any;

    const tokenManagerAddr = await this.contracts.beacon.getImplementation("TokenManager");
    this.contracts.tokenManager = await ethers.getContractAt("TokenManager", tokenManagerAddr);

    console.log("✅ Price Alert Monitor initialized");
  }

  async checkPriceAlerts(): Promise<PriceAlert[]> {
    console.log("\n🔍 Checking token prices for alerts...");
    const alerts: PriceAlert[] = [];

    // Get all token codes (assuming WETH, USDC, WBTC, etc.)
    const tokenCodes = ["WETH", "USDC", "WBTC"];

    for (const tokenCode of tokenCodes) {
      try {
        // Pattern: getTokenPrice() returns (price, updatedAt, isStale)
        // Reference: test/unit/TokenManager.test.ts line 245
        const [price, updatedAt, isStale] = await this.contracts.tokenManager.getTokenPrice(
          ethers.encodeBytes32String(tokenCode)
        );

        console.log(`   ${tokenCode}: price=${price}, updatedAt=${updatedAt}, isStale=${isStale}`);

        // Check if price is stale
        if (isStale) {
          alerts.push({
            tokenCode,
            price,
            updatedAt,
            isStale,
            alertType: "stale",
            severity: "critical",
            timestamp: Date.now()
          });
          console.log(`   ⚠️ ALERT: ${tokenCode} price is STALE!`);
        }

        // Check if price is zero
        if (price === 0n) {
          alerts.push({
            tokenCode,
            price,
            updatedAt,
            isStale,
            alertType: "zero",
            severity: "critical",
            timestamp: Date.now()
          });
          console.log(`   🚨 CRITICAL: ${tokenCode} price is ZERO!`);
        }

        // Check if price hasn't been updated recently
        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        const timeSinceUpdate = currentTime - updatedAt;
        
        if (timeSinceUpdate > BigInt(this.STALE_THRESHOLD)) {
          alerts.push({
            tokenCode,
            price,
            updatedAt,
            isStale,
            alertType: "stale",
            severity: "warning",
            timestamp: Date.now()
          });
          console.log(`   ⚠️ WARNING: ${tokenCode} price not updated for ${timeSinceUpdate}s`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking ${tokenCode}: ${error}`);
      }
    }

    return alerts;
  }

  async monitorPrices() {
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║    PRICE DEVIATION ALERT MONITOR      ║");
    console.log("╚════════════════════════════════════════╝");

    const alerts = await this.checkPriceAlerts();

    if (alerts.length === 0) {
      console.log("\n✅ All token prices are healthy");
    } else {
      console.log(`\n⚠️ ${alerts.length} price alerts detected:`);
      alerts.forEach((alert, idx) => {
        console.log(`\n   ${idx + 1}. ${alert.tokenCode} - ${alert.severity.toUpperCase()}`);
        console.log(`      Type: ${alert.alertType}`);
        console.log(`      Price: ${alert.price.toString()}`);
        console.log(`      Last updated: ${alert.updatedAt.toString()}`);
        console.log(`      Is stale: ${alert.isStale}`);
      });
    }

    return alerts;
  }
}

async function main() {
  const monitor = new PriceAlertMonitor();
  await monitor.initialize();
  await monitor.monitorPrices();
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}

export { PriceAlertMonitor, PriceAlert };
