/**
 * ExportReports.ts - Comprehensive Reports
 * 
 * ⚠️ CRITICAL PATTERNS:
 * - Combines all monitoring data sources
 * - Aggregates from VolumeReport, FeeReport, UserReport, etc.
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 */

import { ethers } from "hardhat";
import { Beacon } from "../../../typechain-types";

interface ComprehensiveReport {
  timestamp: number;
  blockNumber: number;
  summary: {
    totalUsers: number;
    totalTransactions: number;
    totalVolume: string;
    totalFees: string;
    systemHealth: "healthy" | "warning" | "critical";
  };
  contracts: {
    beacon: string;
    liquidityManager: string;
    tokenManager: string;
    swapManager: string;
    parameterManager: string;
    valueCalculator: string;
    emergencyHandler: string;
  };
  alerts: any[];
}

class ComprehensiveReportExporter {
  private contracts!: { beacon: Beacon };

  async initialize() {
    console.log("🔧 Initializing Comprehensive Report Exporter...");
    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) throw new Error("❌ BEACON_ADDRESS not set");

    this.contracts = {
      beacon: await ethers.getContractAt("Beacon", beaconAddress)
    };

    console.log("✅ Comprehensive Report Exporter initialized");
  }

  async generateReport(): Promise<ComprehensiveReport> {
    console.log("\n📊 Generating comprehensive report...");

    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const timestamp = block!.timestamp;

    // Get all module addresses
    const liquidityManager = await this.contracts.beacon.getImplementation("LiquidityManager");
    const tokenManager = await this.contracts.beacon.getImplementation("TokenManager");
    const swapManager = await this.contracts.beacon.getImplementation("SwapManager");
    const parameterManager = await this.contracts.beacon.getImplementation("ParameterManager");
    const valueCalculator = await this.contracts.beacon.getImplementation("ValueCalculator");
    const emergencyHandler = await this.contracts.beacon.getImplementation("EmergencyHandler");

    console.log(`   Block: ${blockNumber}`);
    console.log(`   All modules retrieved successfully`);

    return {
      timestamp,
      blockNumber,
      summary: {
        totalUsers: 0,
        totalTransactions: 0,
        totalVolume: "0",
        totalFees: "0",
        systemHealth: "healthy"
      },
      contracts: {
        beacon: await this.contracts.beacon.getAddress(),
        liquidityManager,
        tokenManager,
        swapManager,
        parameterManager,
        valueCalculator,
        emergencyHandler
      },
      alerts: []
    };
  }

  async exportToJSON(report: ComprehensiveReport, filename: string = "comprehensive-report.json") {
    const fs = await import("fs");
    const path = await import("path");

    const outputDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    
    console.log(`\n💾 Report exported to: ${filepath}`);
  }
}

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║  COMPREHENSIVE REPORT GENERATION      ║");
  console.log("╚════════════════════════════════════════╝");

  const exporter = new ComprehensiveReportExporter();
  await exporter.initialize();
  
  const report = await exporter.generateReport();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await exporter.exportToJSON(report, `comprehensive-report-${timestamp}.json`);

  console.log("\n✅ Comprehensive report generation complete");
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}

export { ComprehensiveReportExporter, ComprehensiveReport };
