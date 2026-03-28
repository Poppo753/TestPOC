/**
 * ModuleStatus.ts - Individual Module Status Monitor
 * 
 * ⚠️ CRITICAL PATTERNS (from test files):
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 * - beacon.getModuleInfo() returns {currentImpl, lastUpdated, isFrozen, historyCount}
 * - beacon.checkModuleExists() for existence checks
 * - Reference: test/integration/BeaconModules.integration.test.ts lines 185-235
 */

import { ethers } from "hardhat";
import { Beacon } from "../../../typechain-types";

interface ModuleStatusData {
  moduleName: string;
  exists: boolean;
  currentImplementation: string;
  lastUpdated: bigint;
  isFrozen: boolean;
  historyCount: bigint;
  implementationHistory: string[];
  isHealthy: boolean;
  warnings: string[];
  timestamp: number;
}

interface ContractSetup {
  beacon: Beacon;
}

const MODULE_NAMES = [
  "TokenManager",
  "ParameterManager",
  "ValueCalculator",
  "ProxyGeneral",
  "LiquidityManager",
  "SwapManager",
  "EmergencyHandler"
];

class ModuleStatusMonitor {
  private contracts!: ContractSetup;

  /**
   * Initialize contracts from deployed addresses
   * Pattern: test/integration/BeaconModules.integration.test.ts
   */
  async initialize() {
    console.log("🔧 Initializing Module Status Monitor...");

    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) {
      throw new Error("❌ BEACON_ADDRESS not set in environment");
    }

    this.contracts = {
      beacon: await ethers.getContractAt("Beacon", beaconAddress)
    };

    console.log("✅ Module Status Monitor initialized");
    console.log(`   📍 Beacon: ${beaconAddress}`);
  }

  /**
   * Get status for a specific module
   * Pattern: beacon.getModuleInfo() - test/integration/BeaconModules.integration.test.ts line 192
   */
  async getModuleStatus(moduleName: string): Promise<ModuleStatusData> {
    console.log(`\n📊 Checking status for module: ${moduleName}`);

    const warnings: string[] = [];

    // Check if module exists
    // Pattern: beacon.checkModuleExists() - test line 231
    const exists = await this.contracts.beacon.checkModuleExists(moduleName);

    if (!exists) {
      return {
        moduleName,
        exists: false,
        currentImplementation: ethers.ZeroAddress,
        lastUpdated: 0n,
        isFrozen: false,
        historyCount: 0n,
        implementationHistory: [],
        isHealthy: false,
        warnings: [`❌ Module ${moduleName} not registered in Beacon`],
        timestamp: Date.now()
      };
    }

    // Get detailed module info
    // Pattern: beacon.getModuleInfo() returns {currentImpl, lastUpdated, isFrozen, historyCount}
    // Reference: test/integration/BeaconModules.integration.test.ts line 192
    const moduleInfo = await this.contracts.beacon.getModuleInfo(moduleName);

    console.log(`   📍 Address: ${moduleInfo.currentImpl}`);
    console.log(`   🕐 Last Update: ${moduleInfo.lastUpdated}`);
    console.log(`   🔒 Frozen: ${moduleInfo.isFrozen}`);
    console.log(`   📚 History Length: ${moduleInfo.historyCount}`);

    // Check implementation address validity
    if (moduleInfo.currentImpl === ethers.ZeroAddress) {
      warnings.push("⚠️ Module has zero address implementation");
    }

    // Check if frozen (might be intentional but worth noting)
    if (moduleInfo.isFrozen) {
      warnings.push("🔒 Module is frozen - updates disabled");
    }

    // Check last update time (warn if very old)
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const timeSinceUpdate = currentTime - moduleInfo.lastUpdated;
    const ONE_MONTH = BigInt(30 * 24 * 60 * 60);

    if (timeSinceUpdate > ONE_MONTH) {
      warnings.push(`⚠️ Module not updated in ${timeSinceUpdate / BigInt(86400)} days`);
    }

    // Get implementation history
    // Pattern: beacon.getImplementationHistory() - test line 206
    const history = await this.contracts.beacon.getImplementationHistory(moduleName);
    console.log(`   📜 History: ${history.length} previous implementations`);

    // Verify module code exists at implementation address
    const code = await ethers.provider.getCode(moduleInfo.currentImpl);
    if (code === "0x") {
      warnings.push("❌ No contract code at implementation address!");
    }

    const isHealthy = warnings.length === 0;

    return {
      moduleName,
      exists: true,
      currentImplementation: moduleInfo.currentImpl,
      lastUpdated: moduleInfo.lastUpdated,
      isFrozen: moduleInfo.isFrozen,
      historyCount: moduleInfo.historyCount,
      implementationHistory: history,
      isHealthy,
      warnings,
      timestamp: Date.now()
    };
  }

  /**
   * Get status for all registered modules
   * Pattern: Loop over MODULE_NAMES - test line 185
   */
  async getAllModulesStatus(): Promise<ModuleStatusData[]> {
    console.log("\n🔍 CHECKING ALL MODULES STATUS");
    console.log("════════════════════════════════════════");

    const results: ModuleStatusData[] = [];

    for (const moduleName of MODULE_NAMES) {
      const status = await this.getModuleStatus(moduleName);
      results.push(status);

      console.log(`\n${moduleName}:`);
      console.log(`   Exists: ${status.exists ? "✅" : "❌"}`);
      console.log(`   Implementation: ${status.currentImplementation}`);
      console.log(`   Healthy: ${status.isHealthy ? "✅" : "⚠️"}`);
      
      if (status.warnings.length > 0) {
        console.log(`   Warnings:`);
        status.warnings.forEach(w => console.log(`      ${w}`));
      }
    }

    return results;
  }

  /**
   * Get registered modules list from Beacon
   * Pattern: beacon.getRegisteredModules() - test line 107
   */
  async getRegisteredModulesList(): Promise<string[]> {
    const modules = await this.contracts.beacon.getRegisteredModules();
    
    console.log("\n📋 REGISTERED MODULES IN BEACON:");
    console.log(`   Total: ${modules.length} modules`);
    modules.forEach((name, idx) => {
      console.log(`   ${idx + 1}. ${name}`);
    });

    return modules;
  }

  /**
   * Compare expected vs actual registered modules
   * Pattern: Compare MODULE_NAMES with beacon.getRegisteredModules()
   */
  async verifyAllModulesRegistered(): Promise<{
    allRegistered: boolean;
    missing: string[];
    extra: string[];
  }> {
    console.log("\n🔍 VERIFYING MODULE REGISTRATION");
    
    const registeredModules = await this.contracts.beacon.getRegisteredModules();
    const registeredSet = new Set(registeredModules);
    const expectedSet = new Set(MODULE_NAMES);

    const missing = MODULE_NAMES.filter(name => !registeredSet.has(name));
    const extra = registeredModules.filter(name => !expectedSet.has(name));

    const allRegistered = missing.length === 0;

    console.log(`   Expected modules: ${MODULE_NAMES.length}`);
    console.log(`   Registered modules: ${registeredModules.length}`);
    console.log(`   All registered: ${allRegistered ? "✅" : "⚠️"}`);

    if (missing.length > 0) {
      console.log("\n   ⚠️ Missing modules:");
      missing.forEach(name => console.log(`      - ${name}`));
    }

    if (extra.length > 0) {
      console.log("\n   ℹ️ Extra modules (not in expected list):");
      extra.forEach(name => console.log(`      - ${name}`));
    }

    return {
      allRegistered,
      missing,
      extra
    };
  }

  /**
   * Check module implementation history
   * Pattern: beacon.getImplementationHistory() - test line 380
   */
  async getModuleHistory(moduleName: string): Promise<{
    moduleName: string;
    currentImplementation: string;
    historyCount: number;
    history: string[];
  }> {
    console.log(`\n📜 CHECKING IMPLEMENTATION HISTORY: ${moduleName}`);

    const exists = await this.contracts.beacon.checkModuleExists(moduleName);
    if (!exists) {
      console.log(`   ❌ Module ${moduleName} not found`);
      return {
        moduleName,
        currentImplementation: ethers.ZeroAddress,
        historyCount: 0,
        history: []
      };
    }

    // Pattern: beacon.getImplementation() - test line 359
    const currentImpl = await this.contracts.beacon.getImplementation(moduleName);
    
    // Pattern: beacon.getImplementationHistory() - test line 380
    const history = await this.contracts.beacon.getImplementationHistory(moduleName);

    console.log(`   📍 Current: ${currentImpl}`);
    console.log(`   📚 History entries: ${history.length}`);

    if (history.length > 0) {
      console.log(`   📜 Previous implementations:`);
      history.forEach((addr, idx) => {
        console.log(`      ${idx + 1}. ${addr}`);
      });
    }

    return {
      moduleName,
      currentImplementation: currentImpl,
      historyCount: history.length,
      history
    };
  }

  /**
   * Generate summary report
   */
  async generateReport(): Promise<void> {
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║   MODULE STATUS MONITORING REPORT     ║");
    console.log("╚════════════════════════════════════════╝");

    const timestamp = new Date().toISOString();
    console.log(`\n📅 Report Time: ${timestamp}`);

    // Get all modules status
    const allStatus = await this.getAllModulesStatus();

    // Summary statistics
    const totalModules = allStatus.length;
    const existingModules = allStatus.filter(s => s.exists).length;
    const healthyModules = allStatus.filter(s => s.isHealthy).length;
    const frozenModules = allStatus.filter(s => s.isFrozen).length;
    const modulesWithHistory = allStatus.filter(s => s.historyCount > 0n).length;

    console.log("\n📊 SUMMARY STATISTICS:");
    console.log(`   Total modules checked: ${totalModules}`);
    console.log(`   Existing modules: ${existingModules}/${totalModules}`);
    console.log(`   Healthy modules: ${healthyModules}/${existingModules}`);
    console.log(`   Frozen modules: ${frozenModules}`);
    console.log(`   Modules with update history: ${modulesWithHistory}`);

    // List unhealthy modules
    const unhealthyModules = allStatus.filter(s => !s.isHealthy);
    if (unhealthyModules.length > 0) {
      console.log("\n⚠️ MODULES REQUIRING ATTENTION:");
      unhealthyModules.forEach(module => {
        console.log(`\n   ${module.moduleName}:`);
        module.warnings.forEach(w => console.log(`      ${w}`));
      });
    } else {
      console.log("\n✅ ALL MODULES HEALTHY");
    }

    // Verify registration completeness
    await this.verifyAllModulesRegistered();

    console.log("\n════════════════════════════════════════");
    console.log("Report generation complete ✅");
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║   MODULE STATUS MONITORING SCRIPT     ║");
  console.log("╚════════════════════════════════════════╝");

  const monitor = new ModuleStatusMonitor();
  await monitor.initialize();

  // Check command line arguments for specific module
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] !== "--report") {
    // Check specific module
    const moduleName = args[0];
    console.log(`\n🎯 Checking specific module: ${moduleName}`);
    
    const status = await monitor.getModuleStatus(moduleName);
    
    console.log("\n📊 MODULE STATUS:");
    console.log(JSON.stringify(status, (_, v) => 
      typeof v === 'bigint' ? v.toString() : v
    , 2));

    // Check history if module exists
    if (status.exists) {
      await monitor.getModuleHistory(moduleName);
    }
  } else {
    // Generate full report
    await monitor.generateReport();
  }

  console.log("\n✅ Module status monitoring complete");
}

// Execute script
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Error in module status monitoring:", error);
      process.exit(1);
    });
}

export { ModuleStatusMonitor, ModuleStatusData };
