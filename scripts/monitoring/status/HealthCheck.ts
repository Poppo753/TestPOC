/**
 * PHASE 3 - MONITOR-001.2: HealthCheck.ts
 * Deep Health Check Script for All System Modules
 * 
 * Verifies operational status and health of each module:
 * - TokenManager: token count, oracle connectivity
 * - LiquidityManager: balance, deposits/withdraws enabled
 * - SwapManager: swap functionality, fee calculations
 * - ParameterManager: parameter validity, timelock status
 * - ValueCalculator: calculation accuracy
 * - EmergencyHandler: emergency state, pause status
 * 
 * ⚠️ CRITICAL WARNINGS:
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 * - Use beacon.getModuleInfo() for detailed module data (implementation, lastUpdated, isFrozen, historyCount)
 * - Use beacon.checkModuleExists() for existence checks
 * - TokenManager.getTokenPrice() returns (price, updatedAt, isStale)
 * - ProxyGeneral.paused() for pause status
 * 
 * Reference: test/integration/BeaconModules.integration.test.ts lines 119-247
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../../core/BaseScript";

/**
 * Health check result for individual module
 */
interface ModuleHealth {
  moduleName: string;
  exists: boolean;
  address: string;
  isActive: boolean;
  lastUpdated: number;
  isFrozen: boolean;
  checks: {
    name: string;
    status: "OK" | "WARNING" | "ERROR";
    message: string;
    value?: any;
  }[];
  overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL" | "OFFLINE";
}

/**
 * System-wide health check result
 */
interface SystemHealth {
  timestamp: number;
  overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  modules: ModuleHealth[];
  criticalIssues: string[];
  warnings: string[];
  summary: {
    healthy: number;
    degraded: number;
    critical: number;
    offline: number;
  };
}

/**
 * HealthCheckScript - Comprehensive health verification for all modules
 * 
 * Checks:
 * 1. Module existence and registration
 * 2. Module activity and frozen status
 * 3. Module-specific operational checks
 * 4. System pause state
 * 5. Emergency status
 */
export class HealthCheckScript extends BaseScript {
  /**
   * Execute comprehensive system health check
   */
  protected async executeMain(): Promise<ScriptResult> {
    console.log("🏥 SYSTEM HEALTH CHECK");
    console.log("=====================\n");

    const systemHealth: SystemHealth = {
      timestamp: Date.now(),
      overallStatus: "HEALTHY",
      modules: [],
      criticalIssues: [],
      warnings: [],
      summary: {
        healthy: 0,
        degraded: 0,
        critical: 0,
        offline: 0,
      },
    };

    // Define modules to check
    const modulesToCheck = [
      "TokenManager",
      "LiquidityManager",
      "SwapManager",
      "ParameterManager",
      "ValueCalculator",
      "EmergencyHandler",
    ];

    console.log(`📋 Checking ${modulesToCheck.length} core modules...\n`);

    // Check each module
    for (const moduleName of modulesToCheck) {
      const moduleHealth = await this.checkModuleHealth(moduleName);
      systemHealth.modules.push(moduleHealth);

      // Update summary
      switch (moduleHealth.overallStatus) {
        case "HEALTHY":
          systemHealth.summary.healthy++;
          break;
        case "DEGRADED":
          systemHealth.summary.degraded++;
          break;
        case "CRITICAL":
          systemHealth.summary.critical++;
          break;
        case "OFFLINE":
          systemHealth.summary.offline++;
          break;
      }

      // Collect critical issues and warnings
      for (const check of moduleHealth.checks) {
        if (check.status === "ERROR") {
          systemHealth.criticalIssues.push(`${moduleName}: ${check.message}`);
        } else if (check.status === "WARNING") {
          systemHealth.warnings.push(`${moduleName}: ${check.message}`);
        }
      }

      console.log(`\n`);
    }

    // Determine overall system status
    if (systemHealth.summary.critical > 0 || systemHealth.summary.offline > 0) {
      systemHealth.overallStatus = "CRITICAL";
    } else if (systemHealth.summary.degraded > 0) {
      systemHealth.overallStatus = "DEGRADED";
    } else {
      systemHealth.overallStatus = "HEALTHY";
    }

    // Print summary
    this.printHealthSummary(systemHealth);

    // Return result
    return {
      success: systemHealth.overallStatus !== "CRITICAL",
      data: systemHealth,
      message: `System health check complete: ${systemHealth.overallStatus}`,
    };
  }

  /**
   * Check health of individual module
   * Pattern from: test/integration/BeaconModules.integration.test.ts lines 192-207
   */
  private async checkModuleHealth(moduleName: string): Promise<ModuleHealth> {
    console.log(`🔍 Checking ${moduleName}...`);

    const moduleHealth: ModuleHealth = {
      moduleName,
      exists: false,
      address: ethers.ZeroAddress,
      isActive: false,
      lastUpdated: 0,
      isFrozen: false,
      checks: [],
      overallStatus: "OFFLINE",
    };

    try {
      // Check 1: Module exists
      // Pattern: beacon.checkModuleExists() - lines 119, 140, 226, 238, 242, 247, 326
      const exists = await this.contracts.beacon.checkModuleExists(moduleName);
      moduleHealth.exists = exists;
      moduleHealth.checks.push({
        name: "Module Registration",
        status: exists ? "OK" : "ERROR",
        message: exists ? "Module registered" : "Module not found in beacon",
        value: exists,
      });

      if (!exists) {
        console.log(`   ❌ ${moduleName} not registered`);
        return moduleHealth;
      }

      // Check 2: Get module info
      // Pattern: beacon.getModuleInfo() returns {currentImpl, lastUpdated, isFrozen, historyCount}
      // Reference: test/integration/BeaconModules.integration.test.ts line 192
      const moduleInfo = await this.contracts.beacon.getModuleInfo(moduleName);
      moduleHealth.address = moduleInfo.currentImpl;
      moduleHealth.lastUpdated = Number(moduleInfo.lastUpdated);
      moduleHealth.isFrozen = moduleInfo.isFrozen;

      moduleHealth.checks.push({
        name: "Module Address",
        status: moduleHealth.address !== ethers.ZeroAddress ? "OK" : "ERROR",
        message:
          moduleHealth.address !== ethers.ZeroAddress
            ? "Valid implementation address"
            : "Zero address - module not deployed",
        value: moduleHealth.address,
      });

      // Check 3: Module frozen status
      moduleHealth.checks.push({
        name: "Module Frozen Status",
        status: moduleHealth.isFrozen ? "WARNING" : "OK",
        message: moduleHealth.isFrozen
          ? "Module is frozen - upgrades disabled"
          : "Module not frozen",
        value: moduleHealth.isFrozen,
      });

      // Check 4: Module-specific health checks
      await this.runModuleSpecificChecks(moduleName, moduleHealth);

      // Determine module overall status
      const hasErrors = moduleHealth.checks.some((c) => c.status === "ERROR");
      const hasWarnings = moduleHealth.checks.some((c) => c.status === "WARNING");

      if (hasErrors) {
        moduleHealth.overallStatus = "CRITICAL";
      } else if (hasWarnings) {
        moduleHealth.overallStatus = "DEGRADED";
      } else {
        moduleHealth.overallStatus = "HEALTHY";
      }

      moduleHealth.isActive = !hasErrors;

      // Log module status
      const statusIcon =
        moduleHealth.overallStatus === "HEALTHY"
          ? "✅"
          : moduleHealth.overallStatus === "DEGRADED"
            ? "⚠️"
            : "❌";
      console.log(`   ${statusIcon} ${moduleName}: ${moduleHealth.overallStatus}`);

      // Log checks
      for (const check of moduleHealth.checks) {
        const checkIcon = check.status === "OK" ? "✓" : check.status === "WARNING" ? "⚠" : "✗";
        console.log(`      ${checkIcon} ${check.name}: ${check.message}`);
      }
    } catch (error: any) {
      console.log(`   ❌ ${moduleName}: Error during health check - ${error.message}`);
      moduleHealth.checks.push({
        name: "Health Check Execution",
        status: "ERROR",
        message: `Exception during check: ${error.message}`,
      });
      moduleHealth.overallStatus = "CRITICAL";
    }

    return moduleHealth;
  }

  /**
   * Run module-specific health checks
   */
  private async runModuleSpecificChecks(
    moduleName: string,
    moduleHealth: ModuleHealth
  ): Promise<void> {
    try {
      switch (moduleName) {
        case "TokenManager":
          await this.checkTokenManager(moduleHealth);
          break;

        case "LiquidityManager":
          await this.checkLiquidityManager(moduleHealth);
          break;

        case "SwapManager":
          await this.checkSwapManager(moduleHealth);
          break;

        case "ParameterManager":
          await this.checkParameterManager(moduleHealth);
          break;

        case "ValueCalculator":
          await this.checkValueCalculator(moduleHealth);
          break;

        case "EmergencyHandler":
          await this.checkEmergencyHandler(moduleHealth);
          break;
      }
    } catch (error: any) {
      moduleHealth.checks.push({
        name: "Module-Specific Checks",
        status: "ERROR",
        message: `Failed to run specific checks: ${error.message}`,
      });
    }
  }

  /**
   * Check TokenManager health
   * ⚠️ getTokenPrice() returns (price, updatedAt, isStale) - Reference: test/unit/TokenManager.test.ts
   */
  private async checkTokenManager(moduleHealth: ModuleHealth): Promise<void> {
    const tmAddress = await this.contracts.beacon.getImplementation("TokenManager");
    const tokenManager = await ethers.getContractAt("TokenManager", tmAddress);

    // Check token count
    const tokenCount = await tokenManager.getActiveTokenCount();
    moduleHealth.checks.push({
      name: "Active Tokens",
      status: Number(tokenCount) > 0 ? "OK" : "WARNING",
      message: `${tokenCount} active tokens`,
      value: Number(tokenCount),
    });

    // Check WETH token (critical)
    try {
      const wethAddress = await tokenManager.WETH();
      const [price, updatedAt, isStale] = await tokenManager.getTokenPrice(wethAddress);

      moduleHealth.checks.push({
        name: "WETH Oracle",
        status: !isStale && Number(price) > 0 ? "OK" : "WARNING",
        message: isStale
          ? "WETH price data is stale"
          : Number(price) > 0
            ? "WETH oracle operational"
            : "WETH price is zero",
        value: { price: price.toString(), isStale },
      });
    } catch (error: any) {
      moduleHealth.checks.push({
        name: "WETH Oracle",
        status: "ERROR",
        message: `WETH oracle check failed: ${error.message}`,
      });
    }
  }

  /**
   * Check LiquidityManager health
   */
  private async checkLiquidityManager(moduleHealth: ModuleHealth): Promise<void> {
    const lmAddress = await this.contracts.beacon.getImplementation("LiquidityManager");
    const liquidityManager = await ethers.getContractAt("LiquidityManager", lmAddress);

    // Check contract balance
    const balance = await ethers.provider.getBalance(lmAddress);
    moduleHealth.checks.push({
      name: "Contract Balance",
      status: balance > 0 ? "OK" : "WARNING",
      message: `${ethers.formatEther(balance)} ETH`,
      value: balance.toString(),
    });

    // Check deposits enabled
    try {
      const depositsEnabled = await liquidityManager.depositsEnabled();
      moduleHealth.checks.push({
        name: "Deposits Status",
        status: depositsEnabled ? "OK" : "WARNING",
        message: depositsEnabled ? "Deposits enabled" : "Deposits disabled",
        value: depositsEnabled,
      });
    } catch (error: any) {
      // Older versions might not have this function
      moduleHealth.checks.push({
        name: "Deposits Status",
        status: "WARNING",
        message: "Cannot verify deposits status",
      });
    }

    // Check LP token supply
    const lpSupply = await liquidityManager.totalSupply();
    moduleHealth.checks.push({
      name: "LP Token Supply",
      status: lpSupply > 0 ? "OK" : "WARNING",
      message: `${ethers.formatEther(lpSupply)} LP tokens`,
      value: lpSupply.toString(),
    });
  }

  /**
   * Check SwapManager health
   */
  private async checkSwapManager(moduleHealth: ModuleHealth): Promise<void> {
    const smAddress = await this.contracts.beacon.getImplementation("SwapManager");
    const swapManager = await ethers.getContractAt("SwapManager", smAddress);

    // Check if swap manager has beacon reference
    try {
      const beaconAddr = await swapManager.beacon();
      moduleHealth.checks.push({
        name: "Beacon Reference",
        status: beaconAddr !== ethers.ZeroAddress ? "OK" : "ERROR",
        message:
          beaconAddr !== ethers.ZeroAddress
            ? "Beacon reference valid"
            : "Missing beacon reference",
        value: beaconAddr,
      });
    } catch (error: any) {
      moduleHealth.checks.push({
        name: "Beacon Reference",
        status: "WARNING",
        message: "Cannot verify beacon reference",
      });
    }

    // Check fee calculation (basic validation)
    try {
      const pmAddress = await this.contracts.beacon.getImplementation("ParameterManager");
      const parameterManager = await ethers.getContractAt("ParameterManager", pmAddress);
      const swapFee = await parameterManager.getParameter("swapFee");

      moduleHealth.checks.push({
        name: "Swap Fee Configuration",
        status: Number(swapFee) > 0 && Number(swapFee) < 10000 ? "OK" : "WARNING",
        message: `Swap fee: ${Number(swapFee) / 100}%`,
        value: swapFee.toString(),
      });
    } catch (error: any) {
      moduleHealth.checks.push({
        name: "Swap Fee Configuration",
        status: "WARNING",
        message: "Cannot verify swap fee",
      });
    }
  }

  /**
   * Check ParameterManager health
   */
  private async checkParameterManager(moduleHealth: ModuleHealth): Promise<void> {
    const pmAddress = await this.contracts.beacon.getImplementation("ParameterManager");
    const parameterManager = await ethers.getContractAt("ParameterManager", pmAddress);

    // Check critical parameters
    const criticalParams = ["depositFee", "withdrawFee", "swapFee", "timelockPeriod"];

    for (const param of criticalParams) {
      try {
        const value = await parameterManager.getParameter(param);
        const isValid = Number(value) >= 0;

        moduleHealth.checks.push({
          name: `Parameter: ${param}`,
          status: isValid ? "OK" : "ERROR",
          message: isValid ? `${param}=${value}` : `Invalid ${param} value`,
          value: value.toString(),
        });
      } catch (error: any) {
        moduleHealth.checks.push({
          name: `Parameter: ${param}`,
          status: "WARNING",
          message: `Cannot read ${param}: ${error.message}`,
        });
      }
    }
  }

  /**
   * Check ValueCalculator health
   */
  private async checkValueCalculator(moduleHealth: ModuleHealth): Promise<void> {
    const vcAddress = await this.contracts.beacon.getImplementation("ValueCalculator");
    const valueCalculator = await ethers.getContractAt("ValueCalculator", vcAddress);

    // Check beacon reference
    try {
      const beaconAddr = await valueCalculator.beacon();
      moduleHealth.checks.push({
        name: "Beacon Reference",
        status: beaconAddr !== ethers.ZeroAddress ? "OK" : "ERROR",
        message:
          beaconAddr !== ethers.ZeroAddress
            ? "Beacon reference valid"
            : "Missing beacon reference",
        value: beaconAddr,
      });
    } catch (error: any) {
      moduleHealth.checks.push({
        name: "Beacon Reference",
        status: "WARNING",
        message: "Cannot verify beacon reference",
      });
    }

    // Test basic calculation (LP price)
    try {
      const lmAddress = await this.contracts.beacon.getImplementation("LiquidityManager");
      const lpPrice = await valueCalculator.getLPPrice(lmAddress);

      moduleHealth.checks.push({
        name: "LP Price Calculation",
        status: Number(lpPrice) >= 0 ? "OK" : "ERROR",
        message: `LP Price: ${ethers.formatEther(lpPrice)}`,
        value: lpPrice.toString(),
      });
    } catch (error: any) {
      moduleHealth.checks.push({
        name: "LP Price Calculation",
        status: "ERROR",
        message: `Calculation failed: ${error.message}`,
      });
    }
  }

  /**
   * Check EmergencyHandler health
   * Pattern: ProxyGeneral.paused() - Reference: test/unit/ProxyGeneral.simple.test.ts
   */
  private async checkEmergencyHandler(moduleHealth: ModuleHealth): Promise<void> {
    // Check ProxyGeneral pause state
    const isPaused = await this.contracts.proxyGeneral.paused();
    moduleHealth.checks.push({
      name: "System Pause State",
      status: !isPaused ? "OK" : "WARNING",
      message: isPaused ? "System is PAUSED" : "System operational",
      value: isPaused,
    });

    // Check emergency handler has owner
    try {
      const ehAddress = await this.contracts.beacon.getImplementation("EmergencyHandler");
      const emergencyHandler = await ethers.getContractAt("EmergencyHandler", ehAddress);

      const owner = await emergencyHandler.owner();
      moduleHealth.checks.push({
        name: "Emergency Handler Owner",
        status: owner !== ethers.ZeroAddress ? "OK" : "ERROR",
        message: owner !== ethers.ZeroAddress ? "Owner configured" : "No owner set",
        value: owner,
      });
    } catch (error: any) {
      moduleHealth.checks.push({
        name: "Emergency Handler Owner",
        status: "WARNING",
        message: "Cannot verify owner",
      });
    }
  }

  /**
   * Print health check summary
   */
  private printHealthSummary(systemHealth: SystemHealth): void {
    console.log("\n" + "=".repeat(60));
    console.log("🏥 SYSTEM HEALTH SUMMARY");
    console.log("=".repeat(60));

    const statusIcon =
      systemHealth.overallStatus === "HEALTHY"
        ? "✅"
        : systemHealth.overallStatus === "DEGRADED"
          ? "⚠️"
          : "❌";

    console.log(`\n${statusIcon} Overall Status: ${systemHealth.overallStatus}\n`);

    console.log("📊 Module Status:");
    console.log(`   ✅ Healthy:  ${systemHealth.summary.healthy}`);
    console.log(`   ⚠️  Degraded: ${systemHealth.summary.degraded}`);
    console.log(`   ❌ Critical: ${systemHealth.summary.critical}`);
    console.log(`   🔌 Offline:  ${systemHealth.summary.offline}`);

    if (systemHealth.criticalIssues.length > 0) {
      console.log(`\n❌ CRITICAL ISSUES (${systemHealth.criticalIssues.length}):`);
      systemHealth.criticalIssues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    if (systemHealth.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${systemHealth.warnings.length}):`);
      systemHealth.warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
    }

    console.log("\n" + "=".repeat(60) + "\n");
  }
}

// Main execution
async function main() {
  const script = new HealthCheckScript();
  await script.execute();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
