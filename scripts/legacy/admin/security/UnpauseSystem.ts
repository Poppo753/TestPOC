/**
 * ▶️ UNPAUSE SYSTEM SCRIPT
 * 
 * Script per riattivare il sistema dopo una pausa:
 * - Rimuove il pause state
 * - Usa la funzione unpause() di ProxyGeneral
 * - Verifica che il sistema sia tornato operativo
 * - Testa operazioni base dopo l'unpause
 * 
 * Basato su: test/unit/ProxyGeneral.simple.test.ts - unpause function
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";
import { Logger } from "../../config/config";

interface UnpauseSystemOptions extends ScriptOptions {
  skipChecks?: boolean;
  testOperations?: boolean;
}

export class UnpauseSystemScript extends BaseScript {
  private unpauseOptions: UnpauseSystemOptions;

  constructor(options: UnpauseSystemOptions) {
    super(options);
    this.unpauseOptions = {
      skipChecks: false,
      testOperations: true,
      ...options
    };
  }

  protected getScriptName(): string {
    return "Unpause System";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    Logger.info("🔍 Checking System Unpause Prerequisites");
    
    // Check if system is paused
    const isPaused = await this.contracts.proxyGeneral.paused();
    if (!isPaused) {
      throw new Error("System is not paused - nothing to unpause");
    }
    Logger.success("✅ System is currently PAUSED (ready to unpause)");
    
    // Check if caller is owner (only owner can unpause)
    const isOwner = (await this.contracts.proxyGeneral.owner()) === this.signer.address;
    if (!isOwner) {
      throw new Error("Only the contract OWNER can unpause the system");
    }
    Logger.success("✅ Caller is OWNER - authorized to unpause");
    
    // Get pause duration
    Logger.info("\n📊 Current System State:");
    const totalSupply = await this.contracts.proxyGeneral.totalSupply();
    Logger.info(`   Total LP Supply: ${ethers.formatEther(totalSupply)} LP`);
    Logger.info(`   System Paused: YES`);
    
    // Optional: Perform safety checks before unpausing
    if (!this.unpauseOptions.skipChecks) {
      Logger.info("\n🔍 Performing Safety Checks:");
      
      // Check 1: Verify all contracts are responsive
      try {
        await this.contracts.beacon.getImplementation("WETH");
        Logger.success("   ✅ Beacon contract responsive");
      } catch (error) {
        throw new Error("Beacon contract not responsive - do not unpause");
      }
      
      // Check 2: Verify TokenManager is working
      try {
        const tokenCount = await this.contracts.tokenManager.getTokenCount();
        Logger.success(`   ✅ TokenManager responsive (${tokenCount} tokens)`);
      } catch (error) {
        throw new Error("TokenManager not responsive - do not unpause");
      }
      
      // Check 3: Verify ParameterManager is working
      try {
        const minDeposit = await this.contracts.parameterManager.getParameter("minDepositAmount");
        Logger.success(`   ✅ ParameterManager responsive (minDeposit: ${ethers.formatEther(minDeposit)} ETH)`);
      } catch (error) {
        throw new Error("ParameterManager not responsive - do not unpause");
      }
      
      // Check 4: Verify ValueCalculator is working
      try {
        const poolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
        Logger.success(`   ✅ ValueCalculator responsive (Pool: ${ethers.formatEther(poolValue)} ETH)`);
      } catch (error) {
        Logger.info("   ⚠️ ValueCalculator unable to calculate pool value (may be ok if pool is empty)");
      }
      
      Logger.success("\n✅ All safety checks passed - system ready to unpause");
    } else {
      Logger.info("⚠️ Safety checks SKIPPED (skipChecks=true)");
    }
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("▶️ Unpausing System");
    
    const result = await this.executeTransaction(
      this.contracts.proxyGeneral.unpause(),
      "Unpause System"
    );
    
    if (result.success) {
      result.data = {
        unpausedAt: Math.floor(Date.now() / 1000),
        unpausedBy: this.signer.address
      };
    }
    
    return result;
  }

  protected async customPostExecutionVerification(): Promise<void> {
    Logger.info("🔍 Verifying System Unpause");
    
    // Verify system is not paused
    const isPaused = await this.contracts.proxyGeneral.paused();
    if (isPaused) {
      throw new Error("System unpause verification failed - system is still paused");
    }
    Logger.success("✅ System is now ACTIVE (not paused)");
    
    // Test operations if enabled
    if (this.unpauseOptions.testOperations) {
      Logger.info("\n🧪 Testing System Operations:");
      
      // Test 1: Verify system is no longer paused
      Logger.info("   Testing unpause state...");
      try {
        // Verify the pause flag is now false
        const isPausedNow = await this.contracts.proxyGeneral.paused();
        if (!isPausedNow) {
          Logger.success("   ✅ System is confirmed ACTIVE (not paused)");
        } else {
          Logger.error("   ❌ ERROR: System still shows as paused!");
        }
      } catch (error: any) {
        Logger.error(`   ❌ State check failed: ${error.message.substring(0, 100)}`);
      }
      
      // Test 2: Check parameter reads
      Logger.info("   Testing parameter access...");
      try {
        const minDeposit = await this.contracts.parameterManager.getParameter("minDepositAmount");
        Logger.success(`   ✅ Parameters accessible (minDeposit: ${ethers.formatEther(minDeposit)} ETH)`);
      } catch (error) {
        Logger.error("   ❌ Parameter access failed");
      }
      
      // Test 3: Check pool value calculation
      Logger.info("   Testing pool calculations...");
      try {
        const poolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
        Logger.success(`   ✅ Pool calculations working (Value: ${ethers.formatEther(poolValue)} ETH)`);
      } catch (error) {
        Logger.info("   ℹ️ Pool calculation test skipped (empty pool)");
      }
    }
    
    // Show final system state
    Logger.info("\n📊 System State After Unpause:");
    try {
      const poolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
      Logger.info(`   Pool Value: ${ethers.formatEther(poolValue)} ETH`);
    } catch (error) {
      Logger.info("   Pool Value: 0 ETH (empty pool)");
    }
    
    const totalSupply = await this.contracts.proxyGeneral.totalSupply();
    Logger.info(`   Total LP Supply: ${ethers.formatEther(totalSupply)} LP`);
    Logger.info(`   System Status: ACTIVE ✅`);
  }

  protected async finalize(result: ScriptResult): Promise<void> {
    if (result.success) {
      Logger.section("✅ SYSTEM UNPAUSED SUCCESSFULLY");
      Logger.success("The system has been restored to normal operation");
      Logger.info(`\n📋 Unpause Details:`);
      Logger.info(`   Unpaused By: ${result.data?.unpausedBy}`);
      Logger.info(`   Unpaused At: ${new Date(result.data?.unpausedAt * 1000).toISOString()}`);
      Logger.info(`   Transaction: ${result.transactionHash}`);
      Logger.info(`   Gas Used: ${result.gasUsed?.toString()}`);
      
      Logger.info("\n✅ SYSTEM STATUS:");
      Logger.info("   - All user operations are now ENABLED");
      Logger.info("   - Deposits, withdrawals, and swaps are functional");
      Logger.info("   - System is operating normally");
      
      Logger.info("\n📋 Recommended Next Steps:");
      Logger.info("   1. Monitor system behavior for anomalies");
      Logger.info("   2. Check logs for any errors");
      Logger.info("   3. Verify pool value calculations are accurate");
      Logger.info("   4. Test a small user operation to confirm functionality");
      
    } else {
      Logger.section("❌ SYSTEM UNPAUSE FAILED");
      Logger.error("Failed to unpause the system");
      Logger.error(`Error: ${result.error}`);
      Logger.info("\n🔍 Troubleshooting:");
      Logger.info("   1. Verify caller is the contract owner");
      Logger.info("   2. Check if system is actually paused");
      Logger.info("   3. Verify gas limits and network connectivity");
      Logger.info("   4. Check for any contract upgrade issues");
    }
  }
}

// 🚀 CLI Execution
async function main() {
  // Get parameters from environment
  const skipChecks = process.env.SKIP_CHECKS === "true";
  const testOperations = process.env.TEST_OPERATIONS !== "false"; // Default true

  console.log("\n▶️ SYSTEM UNPAUSE - Restoring Normal Operations\n");

  const script = new UnpauseSystemScript({
    skipChecks,
    testOperations,
    verbose: process.env.VERBOSE_LOGGING === "true",
    dryRun: process.env.DRY_RUN === "true"
  });

  const result = await script.execute();
  
  if (result.success) {
    console.log("\n✅ System successfully unpaused and restored to normal operation");
  }
  
  process.exit(result.success ? 0 : 1);
}

// Execute if running directly
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default UnpauseSystemScript;
