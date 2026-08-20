/**
 * ExportBalances.ts - Balance Snapshots
 * 
 * ⚠️ CRITICAL PATTERNS:
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 * - Use LiquidityManager for LP balances
 * - Use TokenManager for token info
 */

import { ethers } from "hardhat";
import { Beacon, LiquidityManager, TokenManager, ProxyGeneral } from "../../../typechain-types";

interface BalanceSnapshot {
  timestamp: number;
  blockNumber: number;
  liquidityManager: {
    totalAssets: string;
    balance: string;
    totalSupply: string;
  };
  tokens: {
    code: string;
    price: string;
    updatedAt: string;
    isStale: boolean;
  }[];
}

class BalanceExporter {
  private contracts!: { beacon: Beacon; liquidityManager: LiquidityManager; tokenManager: TokenManager; proxyGeneral: ProxyGeneral };

  async initialize() {
    console.log("🔧 Initializing Balance Exporter...");
    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) throw new Error("❌ BEACON_ADDRESS not set");

    this.contracts = {
      beacon: await ethers.getContractAt("Beacon", beaconAddress)
    } as any;

    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    const tokenManagerAddr = await this.contracts.beacon.getImplementation("TokenManager");
    const proxyGeneralAddr = await this.contracts.beacon.getImplementation("ProxyGeneral");

    this.contracts.liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);
    this.contracts.tokenManager = await ethers.getContractAt("TokenManager", tokenManagerAddr);
    this.contracts.proxyGeneral = await ethers.getContractAt("ProxyGeneral", proxyGeneralAddr);

    console.log("✅ Balance Exporter initialized");
  }

  async captureSnapshot(): Promise<BalanceSnapshot> {
    console.log("\n📸 Capturing balance snapshot...");

    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const timestamp = block!.timestamp;

    // Get LiquidityManager data
    const liquidityManagerAddr = await this.contracts.liquidityManager.getAddress();
    const balance = await ethers.provider.getBalance(liquidityManagerAddr);
    
    // Pattern: totalSupply() is in ProxyGeneral, not LiquidityManager
    // Reference: contracts/Liquiditymanager.sol line 148 - uses proxy.totalSupply()
    const totalSupply = await this.contracts.proxyGeneral.totalSupply();

    // Get token prices
    const tokenCodes = ["WETH", "USDC", "WBTC"];
    const tokens = [];

    for (const code of tokenCodes) {
      try {
        const [price, updatedAt, isStale] = await this.contracts.tokenManager.getTokenPrice(
          ethers.encodeBytes32String(code)
        );

        tokens.push({
          code,
          price: price.toString(),
          updatedAt: updatedAt.toString(),
          isStale
        });
      } catch (error) {
        console.log(`   ⚠️ Could not get price for ${code}`);
      }
    }

    console.log(`   Block: ${blockNumber}`);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`   Total Supply: ${totalSupply.toString()}`);

    return {
      timestamp,
      blockNumber,
      liquidityManager: {
        totalAssets: balance.toString(),
        balance: balance.toString(),
        totalSupply: totalSupply.toString()
      },
      tokens
    };
  }

  async exportToJSON(snapshot: BalanceSnapshot, filename: string = "balances.json") {
    const fs = await import("fs");
    const path = await import("path");

    const outputDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
    
    console.log(`\n💾 Snapshot exported to: ${filepath}`);
  }
}

async function main() {
  const exporter = new BalanceExporter();
  await exporter.initialize();
  
  const snapshot = await exporter.captureSnapshot();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await exporter.exportToJSON(snapshot, `balances-${timestamp}.json`);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}

export { BalanceExporter, BalanceSnapshot };
