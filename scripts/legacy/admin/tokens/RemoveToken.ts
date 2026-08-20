/**
 * 🗑️ REMOVE TOKEN SCRIPT
 * 
 * Script per rimuovere un token dal TokenManager:
 * - Verifica che il token esista
 * - Controlla balance nel pool prima della rimozione
 * - Disattiva il token nel sistema
 * - Verifica post-rimozione
 * 
 * Basato su: test/unit/TokenManager.test.ts - removeToken
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";
import { Logger } from "../../config/config";

interface RemoveTokenOptions extends ScriptOptions {
  tokenCode: string;
  forceRemove?: boolean; // Force removal anche con balance > 0
}

export class RemoveTokenScript extends BaseScript {
  private removeOptions: RemoveTokenOptions;

  constructor(options: RemoveTokenOptions) {
    super(options);
    this.removeOptions = {
      forceRemove: false,
      ...options
    };
  }

  protected getScriptName(): string {
    return "Remove Token";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    Logger.info("🔍 Validating Token Removal");
    
    // Validate token code
    if (!this.removeOptions.tokenCode || this.removeOptions.tokenCode.length === 0) {
      throw new Error("Token code is required");
    }
    
    // Check if token exists
    const isActive = await this.contracts.tokenManager.isTokenActive(this.removeOptions.tokenCode);
    if (!isActive) {
      throw new Error(`Token ${this.removeOptions.tokenCode} is not active or does not exist`);
    }
    Logger.success(`✅ Token ${this.removeOptions.tokenCode} found and is active`);
    
    // Get token info
    const tokenInfo = await this.contracts.tokenManager.getTokenInfo(this.removeOptions.tokenCode);
    Logger.info("\n📊 Current Token Info:");
    Logger.info(`   Token Address: ${tokenInfo.tokenAddress}`);
    Logger.info(`   Token Decimals: ${tokenInfo.tokenDecimals}`);
    Logger.info(`   Price Feed: ${tokenInfo.priceFeed}`);
    Logger.info(`   Error Count: ${tokenInfo.errorCount}`);
    
    // Check if WETH
    const wethAddress = await this.contracts.beacon.getImplementation("WETH");
    if (tokenInfo.tokenAddress.toLowerCase() === wethAddress.toLowerCase()) {
      throw new Error("Cannot remove WETH token");
    }
    
    // Check token balance in ProxyGeneral
    try {
      const tokenContract = await ethers.getContractAt("IERC20", tokenInfo.tokenAddress);
      const balance = await tokenContract.balanceOf(await this.contracts.proxyGeneral.getAddress());
      
      Logger.info(`\n💰 Token Balance in Pool: ${ethers.formatUnits(balance, tokenInfo.tokenDecimals)}`);
      
      if (balance > 0n) {
        if (!this.removeOptions.forceRemove) {
          Logger.warn("⚠️ WARNING: Token has non-zero balance in the pool!");
          Logger.warn("This may cause issues. Consider:");
          Logger.warn("  1. Swapping remaining tokens to other assets");
          Logger.warn("  2. Using forceRemove=true to proceed anyway");
          throw new Error("Cannot remove token with balance (use forceRemove=true to override)");
        } else {
          Logger.warn("⚠️ Force remove enabled - proceeding despite non-zero balance");
        }
      } else {
        Logger.success("✅ Token balance is zero - safe to remove");
      }
    } catch (error: any) {
      if (error.message.includes("forceRemove")) {
        throw error; // Re-throw our custom error
      }
      Logger.warn(`Unable to check token balance: ${error.message}`);
    }
    
    // Get current active tokens
    const activeTokens = await this.contracts.tokenManager.getActiveTokens();
    Logger.info(`\n📋 Currently Active Tokens: ${activeTokens.length}`);
    activeTokens.forEach((token: string) => {
      const marker = token === this.removeOptions.tokenCode ? " ← REMOVING" : "";
      Logger.info(`   - ${token}${marker}`);
    });
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section(`Removing Token: ${this.removeOptions.tokenCode}`);
    
    const result = await this.executeTransaction(
      this.contracts.tokenManager.removeToken(this.removeOptions.tokenCode),
      `Remove Token ${this.removeOptions.tokenCode}`
    );
    
    if (result.success) {
      result.data = {
        tokenCode: this.removeOptions.tokenCode,
        forceRemove: this.removeOptions.forceRemove
      };
    }
    
    return result;
  }

  protected async customPostExecutionVerification(): Promise<void> {
    Logger.info("🔍 Verifying Token Removal");
    
    // Check token is inactive
    const isActive = await this.contracts.tokenManager.isTokenActive(this.removeOptions.tokenCode);
    if (isActive) {
      throw new Error("Token removal failed - token is still active");
    }
    Logger.success(`✅ Token ${this.removeOptions.tokenCode} is now INACTIVE`);
    
    // Try to get token info (should still exist but inactive)
    try {
      const tokenInfo = await this.contracts.tokenManager.getTokenInfo(this.removeOptions.tokenCode);
      Logger.info("\n📊 Token Info After Removal:");
      Logger.info(`   Is Active: ${tokenInfo.isActive}`);
      Logger.info(`   Token Address: ${tokenInfo.tokenAddress}`);
    } catch (error) {
      Logger.info("Token completely removed from registry");
    }
    
    // Get updated active tokens list
    const activeTokens = await this.contracts.tokenManager.getActiveTokens();
    Logger.info(`\n📋 Remaining Active Tokens: ${activeTokens.length}`);
    if (activeTokens.length > 0) {
      activeTokens.forEach((token: string) => {
        Logger.info(`   - ${token}`);
      });
    } else {
      Logger.warn("⚠️ No active tokens remaining in the system");
    }
    
    // Get total token count
    const tokenCount = await this.contracts.tokenManager.getTokenCount();
    Logger.info(`\n📈 Total Token Count: ${tokenCount}`);
  }

  protected async finalize(result: ScriptResult): Promise<void> {
    if (result.success) {
      Logger.section("✅ REMOVE TOKEN SUMMARY");
      Logger.success(`Token ${this.removeOptions.tokenCode} successfully removed!`);
      Logger.info(`\n📋 Details:`);
      Logger.info(`   Token: ${this.removeOptions.tokenCode}`);
      Logger.info(`   Force Remove: ${this.removeOptions.forceRemove ? "YES" : "NO"}`);
      Logger.info(`   Transaction: ${result.transactionHash}`);
      Logger.info(`   Gas Used: ${result.gasUsed?.toString()}`);
      
      Logger.warn("\n⚠️ IMPORTANT:");
      Logger.warn("   - Token is now deactivated in the system");
      Logger.warn("   - Any remaining token balance is not accessible");
      Logger.warn("   - Consider emergency recovery if needed");
    } else {
      Logger.section("❌ REMOVE TOKEN FAILED");
      Logger.error(`Failed to remove token ${this.removeOptions.tokenCode}`);
      Logger.error(`Error: ${result.error}`);
    }
  }
}

// 🚀 CLI Execution
async function main() {
  // Get parameters from environment
  const tokenCode = process.env.TOKEN_CODE;
  const forceRemove = process.env.FORCE_REMOVE === "true";

  if (!tokenCode) {
    console.error("❌ ERROR: TOKEN_CODE must be provided");
    console.error("\nUsage:");
    console.error("  TOKEN_CODE=USDC npx hardhat run scripts/admin/tokens/RemoveToken.ts");
    console.error("\nOptional parameters:");
    console.error("  FORCE_REMOVE=true (removes token even with non-zero balance)");
    console.error("\nExample:");
    console.error("  TOKEN_CODE=USDC FORCE_REMOVE=true npx hardhat run scripts/admin/tokens/RemoveToken.ts");
    process.exit(1);
  }

  const script = new RemoveTokenScript({
    tokenCode,
    forceRemove,
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

export default RemoveTokenScript;
