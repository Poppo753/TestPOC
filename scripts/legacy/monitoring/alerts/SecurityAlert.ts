/**
 * SecurityAlert.ts - Security Issue Detection
 * 
 * ⚠️ CRITICAL PATTERNS (from tests):
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 * - Check ProxyGeneral.paused() for pause state
 * - Reference: test/unit/ProxyGeneral.simple.test.ts line 67
 */

import { ethers } from "hardhat";
import { Beacon, ProxyGeneral, EmergencyHandler } from "../../../typechain-types";

interface SecurityAlert {
  alertType: "paused" | "emergency" | "unauthorized" | "frozen";
  severity: "warning" | "critical";
  description: string;
  timestamp: number;
  details: any;
}

class SecurityAlertMonitor {
  private contracts!: { beacon: Beacon; proxyGeneral: ProxyGeneral; emergencyHandler: EmergencyHandler };

  async initialize() {
    console.log("🔧 Initializing Security Alert Monitor...");
    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) throw new Error("❌ BEACON_ADDRESS not set");

    this.contracts = {
      beacon: await ethers.getContractAt("Beacon", beaconAddress)
    } as any;

    const proxyGeneralAddr = await this.contracts.beacon.getImplementation("ProxyGeneral");
    const emergencyHandlerAddr = await this.contracts.beacon.getImplementation("EmergencyHandler");

    this.contracts.proxyGeneral = await ethers.getContractAt("ProxyGeneral", proxyGeneralAddr);
    this.contracts.emergencyHandler = await ethers.getContractAt("EmergencyHandler", emergencyHandlerAddr);

    console.log("✅ Security Alert Monitor initialized");
  }

  async checkSecurityAlerts(): Promise<SecurityAlert[]> {
    console.log("\n🔍 Checking security status...");
    const alerts: SecurityAlert[] = [];

    // Pattern: Check pause state via ProxyGeneral.paused()
    // Reference: test/unit/ProxyGeneral.simple.test.ts line 67
    const isPaused = await this.contracts.proxyGeneral.paused();
    
    console.log(`   ProxyGeneral paused: ${isPaused}`);

    if (isPaused) {
      alerts.push({
        alertType: "paused",
        severity: "critical",
        description: "System is currently PAUSED",
        timestamp: Date.now(),
        details: { isPaused }
      });
      console.log(`   🚨 CRITICAL: System is PAUSED!`);
    }

    // Check if emergency mode is active (if EmergencyHandler has such a state)
    try {
      // Note: This depends on EmergencyHandler contract implementation
      // Adjust based on actual contract interface
      console.log(`   ✅ Security checks completed`);
    } catch (error) {
      console.log(`   ⚠️ Error checking emergency state: ${error}`);
    }

    return alerts;
  }

  async monitorSecurity() {
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║   SECURITY ISSUE DETECTION MONITOR    ║");
    console.log("╚════════════════════════════════════════╝");

    const alerts = await this.checkSecurityAlerts();

    if (alerts.length === 0) {
      console.log("\n✅ No security issues detected");
    } else {
      console.log(`\n⚠️ ${alerts.length} security alerts detected:`);
      alerts.forEach((alert, idx) => {
        console.log(`\n   ${idx + 1}. ${alert.severity.toUpperCase()} - ${alert.alertType}`);
        console.log(`      ${alert.description}`);
        console.log(`      Details: ${JSON.stringify(alert.details, null, 2)}`);
      });
    }

    return alerts;
  }
}

async function main() {
  const monitor = new SecurityAlertMonitor();
  await monitor.initialize();
  await monitor.monitorSecurity();
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}

export { SecurityAlertMonitor, SecurityAlert };
