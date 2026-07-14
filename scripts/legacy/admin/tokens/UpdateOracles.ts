/**
 * 🔄 UPDATE ORACLES SCRIPT
 * 
 * Script per aggiornare configurazione oracle di token esistenti:
 * - Aggiorna price feed address
 * - Aggiorna heartbeat
 * - Resetta error count se necessario
 * - Valida nuova configurazione oracle
 * 
 * Basato su: test/unit/TokenManager.test.ts - updateHeartbeat, resetTokenErrors
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";
import { Logger } from "../../config/config";

interface UpdateOraclesOptions extends ScriptOptions {
  tokenCode: string;
  newOraclePrice?: string;  // New price in USD (e.g., "42000" for WBTC)
  newHeartbeat?: number;
  resetErrors?: boolean;
}

export class UpdateOraclesScript extends BaseScript {
  private updateOptions: UpdateOraclesOptions;

  constructor(options: UpdateOraclesOptions) {
    super(options);
    this.updateOptions = {
      resetErrors: false,
      ...options
    };
  }

  protected getScriptName(): string {
    return "Update Oracles";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    Logger.info("🔍 Validating Oracle Update Parameters");
    
    // Validate token code
    if (!this.updateOptions.tokenCode || this.updateOptions.tokenCode.length === 0) {
      throw new Error("Token code is required");
    }
    
    // Check if token exists
    const isActive = await this.contracts.tokenManager.isTokenActive(this.updateOptions.tokenCode);
    if (!isActive) {
      throw new Error(`Token ${this.updateOptions.tokenCode} is not active`);
    }
    Logger.success(`✅ Token ${this.updateOptions.tokenCode} is active`);
    
    // Get current token info
    const tokenInfo = await this.contracts.tokenManager.getTokenInfo(this.updateOptions.tokenCode);
    Logger.info("\n📊 Current Configuration:");
    Logger.info(`   Token Code: ${tokenInfo.tokenCode}`);
    Logger.info(`   Token Address: ${tokenInfo.tokenAddress}`);
    Logger.info(`   Current Heartbeat: ${tokenInfo.heartbeat}s`);
    Logger.info(`   Current Error Count: ${tokenInfo.errorCount}`);
    
    // Check what will be updated
    const updates: string[] = [];
    
    if (this.updateOptions.newOraclePrice) {
      const price = parseFloat(this.updateOptions.newOraclePrice);
      if (price <= 0) {
        throw new Error("Price must be positive");
      }
      updates.push(`Oracle Price: ${this.updateOptions.newOraclePrice} USD`);
    }
    
    if (this.updateOptions.newHeartbeat) {
      if (this.updateOptions.newHeartbeat <= 0) {
        throw new Error("Heartbeat must be positive");
      }
      updates.push(`Heartbeat: ${tokenInfo.heartbeat}s → ${this.updateOptions.newHeartbeat}s`);
    }
    
    if (this.updateOptions.resetErrors && tokenInfo.errorCount > 0) {
      updates.push(`Error Count: ${tokenInfo.errorCount} → 0 (RESET)`);
    }
    
    if (updates.length === 0) {
      throw new Error("No updates specified. Provide newOraclePrice, newHeartbeat, or resetErrors=true");
    }
    
    Logger.info("\n🔄 Planned Updates:");
    updates.forEach(update => Logger.info(`   - ${update}`));
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section(`Updating Configuration for: ${this.updateOptions.tokenCode}`);
    
    const results: ScriptResult[] = [];
    
    // Update price in OracleAdapter (if provided)
    if (this.updateOptions.newOraclePrice) {
      Logger.info("Updating price in OracleAdapter...");
      
      const oracleAdapterAddress = await this.contracts.tokenManager.oracleAdapter();
      const oracleAdapter = await ethers.getContractAt("MockOracleAdapter", oracleAdapterAddress);
      
      const decimals = await oracleAdapter.getPriceDecimals(this.updateOptions.tokenCode);
      const priceInDecimals = ethers.parseUnits(this.updateOptions.newOraclePrice, decimals);
      
      const result = await this.executeTransaction(
        oracleAdapter.setPrice(this.updateOptions.tokenCode, priceInDecimals),
        `Update Oracle Price`
      );
      
      results.push(result);
    }
    
    // Update heartbeat if provided
    if (this.updateOptions.newHeartbeat) {
      Logger.info(`Updating heartbeat to ${this.updateOptions.newHeartbeat}s...`);
      
      const result = await this.executeTransaction(
        this.contracts.tokenManager.updateHeartbeat(
          this.updateOptions.tokenCode,
          this.updateOptions.newHeartbeat
        ),
        `Update Heartbeat`
      );
      
      results.push(result);
    }
    
    // Reset errors if requested
    if (this.updateOptions.resetErrors) {
      Logger.info("Resetting token error count...");
      
      const result = await this.executeTransaction(
        this.contracts.tokenManager.resetTokenErrors(this.updateOptions.tokenCode),
        `Reset Token Errors`
      );
      
      results.push(result);
    }
    
    // Aggregate results
    const allSuccessful = results.every(r => r.success);
    const totalGasUsed = results.reduce((sum, r) => sum + (r.gasUsed || 0n), 0n);
    
    return {
      success: allSuccessful,
      transactionHash: results[0]?.transactionHash,
      gasUsed: totalGasUsed,
      data: {
        tokenCode: this.updateOptions.tokenCode,
        updatesApplied: results.length,
        results
      }
    };
  }

  protected async customPostExecutionVerification(): Promise<void> {
    Logger.info("🔍 Verifying Updates");
    
    // Get updated token info
    const tokenInfo = await this.contracts.tokenManager.getTokenInfo(this.updateOptions.tokenCode);
    
    Logger.info("\n📊 Updated Configuration:");
    Logger.info(`   Token Code: ${tokenInfo.tokenCode}`);
    Logger.info(`   Heartbeat: ${tokenInfo.heartbeat}s`);
    Logger.info(`   Error Count: ${tokenInfo.errorCount}`);
    Logger.info(`   Is Active: ${tokenInfo.isActive}`);
    
    // Verify heartbeat update
    if (this.updateOptions.newHeartbeat) {
      if (tokenInfo.heartbeat !== BigInt(this.updateOptions.newHeartbeat)) {
        throw new Error("Heartbeat update verification failed");
      }
      Logger.success("✅ Heartbeat updated successfully");
    }
    
    // Verify error count reset
    if (this.updateOptions.resetErrors) {
      if (tokenInfo.errorCount !== 0n) {
        throw new Error("Error count reset verification failed");
      }
      Logger.success("✅ Error count reset successfully");
    }
    
    // Verify price update via OracleAdapter
    if (this.updateOptions.newOraclePrice) {
      const oracleAdapterAddress = await this.contracts.tokenManager.oracleAdapter();
      const oracleAdapter = await ethers.getContractAt("IOracleAdapter", oracleAdapterAddress);
      
      const [price, , isValid] = await oracleAdapter.getPrice(this.updateOptions.tokenCode);
      const decimals = await oracleAdapter.getPriceDecimals(this.updateOptions.tokenCode);
      
      const currentPrice = ethers.formatUnits(price, decimals);
      Logger.info(`\n💰 Current Price from OracleAdapter: ${currentPrice} USD`);
      
      if (!isValid) {
        Logger.warn("   ⚠️ Price marked as invalid by OracleAdapter");
      } else {
        Logger.success("✅ Price updated successfully in OracleAdapter");
      }
    }
    
    // Test price retrieval from TokenManager
    try {
      const [price, updatedAt, isStale] = await this.contracts.tokenManager.getTokenPrice(this.updateOptions.tokenCode);
      const oracleAdapterAddress = await this.contracts.tokenManager.oracleAdapter();
      const oracleAdapter = await ethers.getContractAt("IOracleAdapter", oracleAdapterAddress);
      const decimals = await oracleAdapter.getPriceDecimals(this.updateOptions.tokenCode);
      
      Logger.info(`\n💰 Price via TokenManager: ${ethers.formatUnits(price, decimals)} USD`);
      if (isStale) {
        Logger.warn("   ⚠️ Price data is stale");
      } else {
        Logger.success("✅ Price retrieval working correctly");
      }
    } catch (error: any) {
      Logger.warn(`⚠️ Price retrieval test failed: ${error.message}`);
    }
  }

  protected async finalize(result: ScriptResult): Promise<void> {
    if (result.success) {
      Logger.section("✅ UPDATE CONFIGURATION SUMMARY");
      Logger.success(`Configuration for ${this.updateOptions.tokenCode} updated successfully!`);
      Logger.info(`\n📋 Updates Applied:`);
      
      if (this.updateOptions.newOraclePrice) {
        Logger.info(`   ✓ Oracle Price: ${this.updateOptions.newOraclePrice} USD`);
      }
      if (this.updateOptions.newHeartbeat) {
        Logger.info(`   ✓ Heartbeat: ${this.updateOptions.newHeartbeat}s`);
      }
      if (this.updateOptions.resetErrors) {
        Logger.info(`   ✓ Error Count Reset`);
      }
      
      Logger.info(`\n📊 Transaction Details:`);
      Logger.info(`   Total Updates: ${result.data?.updatesApplied}`);
      Logger.info(`   Total Gas Used: ${result.gasUsed?.toString()}`);
      
    } else {
      Logger.section("❌ UPDATE CONFIGURATION FAILED");
      Logger.error(`Failed to update configuration for ${this.updateOptions.tokenCode}`);
      Logger.error(`Error: ${result.error}`);
    }
  }
}

// 🚀 CLI Execution
async function main() {
  // Get parameters from environment
  const tokenCode = process.env.TOKEN_CODE;
  const newOraclePrice = process.env.NEW_ORACLE_PRICE;
  const newHeartbeat = process.env.NEW_HEARTBEAT ? parseInt(process.env.NEW_HEARTBEAT) : undefined;
  const resetErrors = process.env.RESET_ERRORS === "true";

  if (!tokenCode) {
    console.error("❌ ERROR: TOKEN_CODE must be provided");
    console.error("\nUsage:");
    console.error("  TOKEN_CODE=USDC NEW_HEARTBEAT=7200 npx hardhat run scripts/admin/tokens/UpdateOracles.ts");
    console.error("\nParameters:");
    console.error("  TOKEN_CODE         - Required: Token to update");
    console.error("  NEW_ORACLE_PRICE   - Optional: New price in USD (e.g., '42000' for WBTC)");
    console.error("  NEW_HEARTBEAT      - Optional: New heartbeat in seconds");
    console.error("  RESET_ERRORS       - Optional: true to reset error count");
    console.error("\nExamples:");
    console.error("  # Update heartbeat:");
    console.error("  TOKEN_CODE=USDC NEW_HEARTBEAT=7200 npx hardhat run scripts/admin/tokens/UpdateOracles.ts");
    console.error("\n  # Update oracle price:");
    console.error("  TOKEN_CODE=WBTC NEW_ORACLE_PRICE=42000 npx hardhat run scripts/admin/tokens/UpdateOracles.ts");
    console.error("\n  # Reset errors:");
    console.error("  TOKEN_CODE=USDC RESET_ERRORS=true npx hardhat run scripts/admin/tokens/UpdateOracles.ts");
    process.exit(1);
  }

  if (!newOraclePrice && !newHeartbeat && !resetErrors) {
    console.error("❌ ERROR: At least one update parameter must be provided");
    console.error("Provide: NEW_ORACLE_PRICE, NEW_HEARTBEAT, or RESET_ERRORS=true");
    process.exit(1);
  }

  const script = new UpdateOraclesScript({
    tokenCode,
    newOraclePrice,
    newHeartbeat,
    resetErrors,
    verbose: process.env.VERBOSE_LOGGING === "true",
    dryRun: process.env.DRY_RUN === "true"
  });

  const result = await script.execute();
  process.exit(result.success ? 0 : 1);
}

// Execute if running directly
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default UpdateOraclesScript;
