/**
 * 🪙 ADD TOKEN SCRIPT
 * 
 * Script per aggiungere un nuovo token al TokenManager con:
 * - Validazione parametri token
 * - Configurazione price feed Chainlink
 * - Validazione oracle connectivity
 * - Configurazione heartbeat
 * 
 * Basato su: test/unit/TokenManager.test.ts - manageTokenData
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";
import { Logger } from "../../config/config";

interface AddTokenOptions extends ScriptOptions {
  tokenCode: string;
  tokenAddress: string;
  tokenDecimals?: number;
  heartbeat?: number;
}

export class AddTokenScript extends BaseScript {
  private addOptions: AddTokenOptions;

  constructor(options: AddTokenOptions) {
    super(options);
    this.addOptions = {
      tokenDecimals: 18,
      heartbeat: 3600, // 1 hour default
      ...options
    };
  }

  protected getScriptName(): string {
    return "Add Token";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    Logger.info("🔍 Validating Token Parameters");
    
    // Validate token code
    if (!this.addOptions.tokenCode || this.addOptions.tokenCode.length === 0) {
      throw new Error("Token code is required");
    }
    if (this.addOptions.tokenCode.length > 16) {
      throw new Error("Token code must be 16 characters or less");
    }
    
    // Validate addresses
    if (!ethers.isAddress(this.addOptions.tokenAddress)) {
      throw new Error("Invalid token address");
    }
    if (!ethers.isAddress(this.addOptions.priceFeedAddress)) {
      throw new Error("Invalid price feed address");
    }
    
    // Check if WETH (cannot add WETH as regular token)
    const wethAddress = await this.contracts.beacon.getImplementation("WETH");
    if (this.addOptions.tokenAddress.toLowerCase() === wethAddress.toLowerCase()) {
      throw new Error("Cannot add WETH as a regular token");
    }
    
    Logger.info(`Token Code: ${this.addOptions.tokenCode}`);
    Logger.info(`Token Address: ${this.addOptions.tokenAddress}`);
    Logger.info(`Price Feed: ${this.addOptions.priceFeedAddress}`);
    Logger.info(`Token Decimals: ${this.addOptions.tokenDecimals}`);
    Logger.info(`Price Feed Decimals: ${this.addOptions.priceFeedDecimals}`);
    Logger.info(`Heartbeat: ${this.addOptions.heartbeat} seconds`);
    
    // Check if token already exists
    try {
      const isActive = await this.contracts.tokenManager.isTokenActive(this.addOptions.tokenCode);
      if (isActive) {
        Logger.warn(`⚠️ Token ${this.addOptions.tokenCode} is already registered and active`);
        Logger.warn("This operation will UPDATE the existing token configuration");
      }
    } catch (error) {
      Logger.info("Token not yet registered (this is normal for new tokens)");
    }
    
    // Validate price feed connectivity
    Logger.info("🔗 Testing price feed connectivity...");
    try {
      const priceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        this.addOptions.priceFeedAddress
      );
      
      const [roundId, price, startedAt, updatedAt, answeredInRound] = 
        await priceFeed.latestRoundData();
      
      Logger.info(`Latest Price: ${ethers.formatUnits(price, this.addOptions.priceFeedDecimals!)}`);
      Logger.info(`Last Updated: ${new Date(Number(updatedAt) * 1000).toISOString()}`);
      
      // Check staleness
      const now = Math.floor(Date.now() / 1000);
      const age = now - Number(updatedAt);
      if (age > this.addOptions.heartbeat!) {
        Logger.warn(`⚠️ Price feed data is stale (${age}s old, heartbeat: ${this.addOptions.heartbeat}s)`);
      } else {
        Logger.success("Price feed is fresh and working");
      }
      
    } catch (error: any) {
      throw new Error(`Price feed validation failed: ${error.message}`);
    }
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section(`Adding Token: ${this.addOptions.tokenCode}`);
    
    const result = await this.executeTransaction(
      this.contracts.tokenManager.manageTokenData(
        this.addOptions.tokenCode,
        this.addOptions.tokenAddress,
        this.addOptions.priceFeedAddress,
        this.addOptions.tokenDecimals!,
        this.addOptions.priceFeedDecimals!,
        this.addOptions.heartbeat!
      ),
      `Add Token ${this.addOptions.tokenCode}`
    );
    
    if (result.success) {
      result.data = {
        tokenCode: this.addOptions.tokenCode,
        tokenAddress: this.addOptions.tokenAddress,
        priceFeedAddress: this.addOptions.priceFeedAddress,
        tokenDecimals: this.addOptions.tokenDecimals,
        priceFeedDecimals: this.addOptions.priceFeedDecimals,
        heartbeat: this.addOptions.heartbeat
      };
    }
    
    return result;
  }

  protected async customPostExecutionVerification(): Promise<void> {
    Logger.info("🔍 Verifying Token Registration");
    
    // Check token is active
    const isActive = await this.contracts.tokenManager.isTokenActive(this.addOptions.tokenCode);
    if (!isActive) {
      throw new Error("Token registration failed - token is not active");
    }
    Logger.success(`✅ Token ${this.addOptions.tokenCode} is ACTIVE`);
    
    // Get full token info
    const tokenInfo = await this.contracts.tokenManager.getTokenInfo(this.addOptions.tokenCode);
    Logger.info("\n📊 Token Info:");
    Logger.info(`   Token Address: ${tokenInfo.tokenAddress}`);
    Logger.info(`   Token Decimals: ${tokenInfo.tokenDecimals}`);
    Logger.info(`   Price Feed: ${tokenInfo.priceFeed}`);
    Logger.info(`   Price Feed Decimals: ${tokenInfo.priceFeedDecimals}`);
    Logger.info(`   Heartbeat: ${tokenInfo.heartbeat}s`);
    Logger.info(`   Is Active: ${tokenInfo.isActive}`);
    Logger.info(`   Error Count: ${tokenInfo.errorCount}`);
    
    // Test price retrieval
    try {
      const [price, updatedAt, isStale] = await this.contracts.tokenManager.getTokenPrice(this.addOptions.tokenCode);
      Logger.info(`   Current Price: ${ethers.formatUnits(price, this.addOptions.priceFeedDecimals!)} USD`);
      if (isStale) {
        Logger.warn("   Price data is stale");
      }
    } catch (error) {
      Logger.warn("   Price retrieval test failed (may require time to settle)");
    }
    
    // Get total token count
    const tokenCount = await this.contracts.tokenManager.getTokenCount();
    Logger.info(`\n📈 Total Registered Tokens: ${tokenCount}`);
  }

  protected async finalize(result: ScriptResult): Promise<void> {
    if (result.success) {
      Logger.section("✅ ADD TOKEN SUMMARY");
      Logger.success(`Token ${this.addOptions.tokenCode} successfully registered!`);
      Logger.info(`\n📋 Configuration:`);
      Logger.info(`   Token: ${this.addOptions.tokenCode}`);
      Logger.info(`   Address: ${this.addOptions.tokenAddress}`);
      Logger.info(`   Price Feed: ${this.addOptions.priceFeedAddress}`);
      Logger.info(`   Transaction: ${result.transactionHash}`);
      Logger.info(`   Gas Used: ${result.gasUsed?.toString()}`);
    } else {
      Logger.section("❌ ADD TOKEN FAILED");
      Logger.error(`Failed to add token ${this.addOptions.tokenCode}`);
      Logger.error(`Error: ${result.error}`);
    }
  }
}

// 🚀 CLI Execution
async function main() {
  // Get parameters from environment or use defaults
  const tokenCode = process.env.TOKEN_CODE || "USDC";
  const tokenAddress = process.env.TOKEN_ADDRESS || "";
  const priceFeedAddress = process.env.PRICE_FEED_ADDRESS || "";
  const tokenDecimals = process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS) : 6;
  const priceFeedDecimals = process.env.PRICE_FEED_DECIMALS ? parseInt(process.env.PRICE_FEED_DECIMALS) : 8;
  const heartbeat = process.env.HEARTBEAT ? parseInt(process.env.HEARTBEAT) : 3600;

  if (!tokenAddress || !priceFeedAddress) {
    console.error("❌ ERROR: TOKEN_ADDRESS and PRICE_FEED_ADDRESS must be provided");
    console.error("\nUsage:");
    console.error("  TOKEN_CODE=USDC TOKEN_ADDRESS=0x... PRICE_FEED_ADDRESS=0x... npx hardhat run scripts/admin/tokens/AddToken.ts");
    console.error("\nOptional parameters:");
    console.error("  TOKEN_DECIMALS=6 (default: 18)");
    console.error("  PRICE_FEED_DECIMALS=8 (default: 8)");
    console.error("  HEARTBEAT=3600 (default: 3600 seconds)");
    process.exit(1);
  }

  const script = new AddTokenScript({
    tokenCode,
    tokenAddress,
    priceFeedAddress,
    tokenDecimals,
    priceFeedDecimals,
    heartbeat,
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

export default AddTokenScript;
