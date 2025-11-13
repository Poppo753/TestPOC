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
  newPriceFeed?: string;
  newHeartbeat?: number;
  resetErrors?: boolean;
  updateFullConfig?: boolean;
}

export class UpdateOraclesScript extends BaseScript {
  private updateOptions: UpdateOraclesOptions;

  constructor(options: UpdateOraclesOptions) {
    super(options);
    this.updateOptions = {
      resetErrors: false,
      updateFullConfig: false,
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
    Logger.info("\n📊 Current Oracle Configuration:");
    Logger.info(`   Token Code: ${tokenInfo.tokenCode}`);
    Logger.info(`   Token Address: ${tokenInfo.tokenAddress}`);
    Logger.info(`   Current Price Feed: ${tokenInfo.priceFeed}`);
    Logger.info(`   Current Heartbeat: ${tokenInfo.heartbeat}s`);
    Logger.info(`   Current Error Count: ${tokenInfo.errorCount}`);
    
    // Check what will be updated
    const updates: string[] = [];
    
    if (this.updateOptions.newPriceFeed) {
      if (!ethers.isAddress(this.updateOptions.newPriceFeed)) {
        throw new Error("Invalid price feed address");
      }
      updates.push(`Price Feed: ${tokenInfo.priceFeed} → ${this.updateOptions.newPriceFeed}`);
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
      throw new Error("No updates specified. Provide newPriceFeed, newHeartbeat, or resetErrors=true");
    }
    
    Logger.info("\n🔄 Planned Updates:");
    updates.forEach(update => Logger.info(`   - ${update}`));
    
    // Validate new price feed if provided
    if (this.updateOptions.newPriceFeed) {
      Logger.info("\n🔗 Testing new price feed connectivity...");
      try {
        const priceFeed = await ethers.getContractAt(
          "AggregatorV3Interface",
          this.updateOptions.newPriceFeed
        );
        
        const [roundId, price, startedAt, updatedAt, answeredInRound] = 
          await priceFeed.latestRoundData();
        
        Logger.info(`   Latest Price: ${ethers.formatUnits(price, tokenInfo.priceFeedDecimals)} USD`);
        Logger.info(`   Last Updated: ${new Date(Number(updatedAt) * 1000).toISOString()}`);
        
        const decimals = await priceFeed.decimals();
        Logger.info(`   Decimals: ${decimals}`);
        
        if (decimals !== tokenInfo.priceFeedDecimals) {
          Logger.warn(`   ⚠️ Price feed decimals mismatch: ${decimals} vs expected ${tokenInfo.priceFeedDecimals}`);
        }
        
        Logger.success("   New price feed is working correctly");
        
      } catch (error: any) {
        throw new Error(`New price feed validation failed: ${error.message}`);
      }
    }
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section(`Updating Oracle Configuration for: ${this.updateOptions.tokenCode}`);
    
    const results: ScriptResult[] = [];
    
    // If full config update with new price feed, use manageTokenData
    if (this.updateOptions.updateFullConfig && this.updateOptions.newPriceFeed) {
      Logger.info("Using full configuration update (manageTokenData)...");
      
      const tokenInfo = await this.contracts.tokenManager.getTokenInfo(this.updateOptions.tokenCode);
      
      const result = await this.executeTransaction(
        this.contracts.tokenManager.manageTokenData(
          this.updateOptions.tokenCode,
          tokenInfo.tokenAddress,
          this.updateOptions.newPriceFeed,
          tokenInfo.tokenDecimals,
          tokenInfo.priceFeedDecimals,
          this.updateOptions.newHeartbeat || tokenInfo.heartbeat
        ),
        `Update Full Token Configuration`
      );
      
      results.push(result);
      
    } else {
      // Individual updates
      
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
    Logger.info("🔍 Verifying Oracle Updates");
    
    // Get updated token info
    const tokenInfo = await this.contracts.tokenManager.getTokenInfo(this.updateOptions.tokenCode);
    
    Logger.info("\n📊 Updated Oracle Configuration:");
    Logger.info(`   Token Code: ${tokenInfo.tokenCode}`);
    Logger.info(`   Price Feed: ${tokenInfo.priceFeed}`);
    Logger.info(`   Heartbeat: ${tokenInfo.heartbeat}s`);
    Logger.info(`   Error Count: ${tokenInfo.errorCount}`);
    Logger.info(`   Is Active: ${tokenInfo.isActive}`);
    
    // Verify updates were applied
    if (this.updateOptions.newPriceFeed && this.updateOptions.updateFullConfig) {
      if (tokenInfo.priceFeed.toLowerCase() !== this.updateOptions.newPriceFeed.toLowerCase()) {
        throw new Error("Price feed update verification failed");
      }
      Logger.success("✅ Price feed updated successfully");
    }
    
    if (this.updateOptions.newHeartbeat) {
      if (tokenInfo.heartbeat !== BigInt(this.updateOptions.newHeartbeat)) {
        throw new Error("Heartbeat update verification failed");
      }
      Logger.success("✅ Heartbeat updated successfully");
    }
    
    if (this.updateOptions.resetErrors) {
      if (tokenInfo.errorCount !== 0n) {
        throw new Error("Error count reset verification failed");
      }
      Logger.success("✅ Error count reset successfully");
    }
    
    // Test price retrieval with updated oracle
    try {
      const [price, updatedAt, isStale] = await this.contracts.tokenManager.getTokenPrice(this.updateOptions.tokenCode);
      Logger.info(`\n💰 Current Price from Updated Oracle:`);
      Logger.info(`   ${ethers.formatUnits(price, tokenInfo.priceFeedDecimals)} USD`);
      if (isStale) {
        Logger.warn("   ⚠️ Price data is stale");
      } else {
        Logger.success("✅ Price retrieval working with updated oracle");
      }
    } catch (error: any) {
      Logger.warn(`⚠️ Price retrieval test failed: ${error.message}`);
    }
  }

  protected async finalize(result: ScriptResult): Promise<void> {
    if (result.success) {
      Logger.section("✅ UPDATE ORACLES SUMMARY");
      Logger.success(`Oracle configuration for ${this.updateOptions.tokenCode} updated successfully!`);
      Logger.info(`\n📋 Updates Applied:`);
      
      if (this.updateOptions.newPriceFeed && this.updateOptions.updateFullConfig) {
        Logger.info(`   ✓ Price Feed: ${this.updateOptions.newPriceFeed}`);
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
      Logger.section("❌ UPDATE ORACLES FAILED");
      Logger.error(`Failed to update oracle configuration for ${this.updateOptions.tokenCode}`);
      Logger.error(`Error: ${result.error}`);
    }
  }
}

// 🚀 CLI Execution
async function main() {
  // Get parameters from environment
  const tokenCode = process.env.TOKEN_CODE;
  const newPriceFeed = process.env.NEW_PRICE_FEED;
  const newHeartbeat = process.env.NEW_HEARTBEAT ? parseInt(process.env.NEW_HEARTBEAT) : undefined;
  const resetErrors = process.env.RESET_ERRORS === "true";
  const updateFullConfig = process.env.FULL_UPDATE === "true";

  if (!tokenCode) {
    console.error("❌ ERROR: TOKEN_CODE must be provided");
    console.error("\nUsage:");
    console.error("  TOKEN_CODE=USDC NEW_HEARTBEAT=7200 npx hardhat run scripts/admin/tokens/UpdateOracles.ts");
    console.error("\nParameters:");
    console.error("  TOKEN_CODE         - Required: Token to update");
    console.error("  NEW_PRICE_FEED     - Optional: New Chainlink price feed address");
    console.error("  NEW_HEARTBEAT      - Optional: New heartbeat in seconds");
    console.error("  RESET_ERRORS       - Optional: true to reset error count");
    console.error("  FULL_UPDATE        - Optional: true to use full config update (required for price feed changes)");
    console.error("\nExamples:");
    console.error("  # Update heartbeat only:");
    console.error("  TOKEN_CODE=USDC NEW_HEARTBEAT=7200 npx hardhat run scripts/admin/tokens/UpdateOracles.ts");
    console.error("\n  # Reset errors:");
    console.error("  TOKEN_CODE=USDC RESET_ERRORS=true npx hardhat run scripts/admin/tokens/UpdateOracles.ts");
    console.error("\n  # Update price feed (requires FULL_UPDATE):");
    console.error("  TOKEN_CODE=USDC NEW_PRICE_FEED=0x... FULL_UPDATE=true npx hardhat run scripts/admin/tokens/UpdateOracles.ts");
    process.exit(1);
  }

  if (!newPriceFeed && !newHeartbeat && !resetErrors) {
    console.error("❌ ERROR: At least one update parameter must be provided");
    console.error("Provide: NEW_PRICE_FEED, NEW_HEARTBEAT, or RESET_ERRORS=true");
    process.exit(1);
  }

  const script = new UpdateOraclesScript({
    tokenCode,
    newPriceFeed,
    newHeartbeat,
    resetErrors,
    updateFullConfig,
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
