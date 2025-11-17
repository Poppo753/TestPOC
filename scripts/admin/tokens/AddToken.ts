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
    
    // Check if WETH (cannot add WETH as regular token)
    const wethAddress = await this.contracts.beacon.getImplementation("WETH");
    if (this.addOptions.tokenAddress.toLowerCase() === wethAddress.toLowerCase()) {
      throw new Error("Cannot add WETH as a regular token");
    }
    
    Logger.info(`Token Code: ${this.addOptions.tokenCode}`);
    Logger.info(`Token Address: ${this.addOptions.tokenAddress}`);
    Logger.info(`Token Decimals: ${this.addOptions.tokenDecimals}`);
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
    
    // Get OracleAdapter and verify token support
    Logger.info("🔗 Verifying OracleAdapter configuration...");
    const oracleAdapterAddress = await this.contracts.tokenManager.oracleAdapter();
    const oracleAdapter = await ethers.getContractAt("IOracleAdapter", oracleAdapterAddress);
    
    const isSupported = await oracleAdapter.supportsToken(this.addOptions.tokenCode);
    if (!isSupported) {
        Logger.warn(`⚠️ Token ${this.addOptions.tokenCode} not configured in OracleAdapter`);
        throw new Error("Token not supported by OracleAdapter - configure it first using oracleAdapter.setupToken()");
    }
    
    // Test price retrieval from adapter
    Logger.info("🔗 Testing OracleAdapter price retrieval...");
    try {
      const [price, timestamp, isValid] = await oracleAdapter.getPrice(this.addOptions.tokenCode);
      const decimals = await oracleAdapter.getPriceDecimals(this.addOptions.tokenCode);
      Logger.info(`Latest Price: ${ethers.formatUnits(price, decimals)}`);
      Logger.info(`Last Updated: ${new Date(Number(timestamp) * 1000).toISOString()}`);
      if (!isValid) {
        Logger.warn("⚠️ Price marked as stale by OracleAdapter");
      } else {
        Logger.success("OracleAdapter price is fresh and working");
      }
    } catch (error: any) {
      throw new Error(`OracleAdapter validation failed: ${error.message}`);
    }
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section(`Adding Token: ${this.addOptions.tokenCode}`);
    
    const result = await this.executeTransaction(
      this.contracts.tokenManager["manageTokenData(string,address,uint8,uint256)"](
        this.addOptions.tokenCode,
        this.addOptions.tokenAddress,
        this.addOptions.tokenDecimals!,
        this.addOptions.heartbeat!
      ),
      `Add Token ${this.addOptions.tokenCode}`
    );
    
    if (result.success) {
      result.data = {
        tokenCode: this.addOptions.tokenCode,
        tokenAddress: this.addOptions.tokenAddress,
        tokenDecimals: this.addOptions.tokenDecimals,
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
    Logger.info(`   Heartbeat: ${tokenInfo.heartbeat}s`);
    Logger.info(`   Is Active: ${tokenInfo.isActive}`);
    Logger.info(`   Error Count: ${tokenInfo.errorCount}`);
    
    // Test price via OracleAdapter
    try {
      const oracleAdapterAddress = await this.contracts.tokenManager.oracleAdapter();
      const oracleAdapter = await ethers.getContractAt("IOracleAdapter", oracleAdapterAddress);
      const [price, , isValid] = await oracleAdapter.getPrice(this.addOptions.tokenCode);
      const decimals = await oracleAdapter.getPriceDecimals(this.addOptions.tokenCode);
      Logger.info(`   Current Price from Oracle: ${ethers.formatUnits(price, decimals)} USD`);
      if (!isValid) {
        Logger.warn("   Price marked as stale by OracleAdapter");
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
  const tokenDecimals = process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS) : 6;
  const heartbeat = process.env.HEARTBEAT ? parseInt(process.env.HEARTBEAT) : 3600;

  if (!tokenAddress) {
    console.error("❌ ERROR: TOKEN_ADDRESS must be provided");
    console.error("\nUsage:");
    console.error("  TOKEN_CODE=USDC TOKEN_ADDRESS=0x... npx hardhat run scripts/admin/tokens/AddToken.ts");
    console.error("\nOptional parameters:");
    console.error("  TOKEN_DECIMALS=6 (default: 18)");
    console.error("  HEARTBEAT=3600 (default: 3600 seconds)");
    console.error("\nPREREQUISITE:");
    console.error("  Token MUST be configured in OracleAdapter BEFORE running this script.");
    console.error("  Use: oracleAdapter.setupToken(tokenCode, price, decimals, true)");
    process.exit(1);
  }

  const script = new AddTokenScript({
    tokenCode,
    tokenAddress,
    tokenDecimals,
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
