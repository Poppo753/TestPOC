/**
 * 🧪 POPULATE TEST DATA SCRIPT
 * 
 * Script per generazione ambiente di test completo con:
 * - Deploy mock tokens (USDC, WBTC, WETH)
 * - Setup MockOracleAdapter (IOracleAdapter interface)
 * - Registrazione token in TokenManager (4 parametri)
 * - Mint balances test per utenti
 * - Configurazione fee e parametri
 * 
 * Basato su: test/unit/SwapManager.Phase1B.test.ts lines 28-35 (MockOracleAdapter pattern)
 * Pattern: OracleAdapter setup PRIMA di TokenManager registration
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";
import { Logger } from "../../config/config";

interface PopulateTestDataOptions extends ScriptOptions {
  userCount?: number;
  mintAmount?: string;  // ETH amount to mint
  includeLiquidity?: boolean;
  skipTokenSetup?: boolean;
}

interface TestDataResult {
  mockTokens: {
    USDC: string;
    WBTC: string;
    WETH: string;
  };
  mockOracle: string;  // MockOracleAdapter address (IOracleAdapter interface)
  testUsers: string[];
  balancesMinted: {
    [address: string]: string;
  };
}

export class PopulateTestDataScript extends BaseScript {
  private testOptions: PopulateTestDataOptions;

  constructor(options: PopulateTestDataOptions) {
    super(options);
    this.testOptions = {
      userCount: 3,
      mintAmount: "100", // 100 ETH per user
      includeLiquidity: true,
      skipTokenSetup: false,
      ...options
    };
  }

  protected getScriptName(): string {
    return "Populate Test Data";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    Logger.info("🔍 Validating Test Data Parameters");
    
    Logger.info(`User Count: ${this.testOptions.userCount}`);
    Logger.info(`Mint Amount per User: ${this.testOptions.mintAmount} ETH`);
    Logger.info(`Include Liquidity: ${this.testOptions.includeLiquidity}`);
    Logger.info(`Skip Token Setup: ${this.testOptions.skipTokenSetup}`);
    
    // Validate mint amount
    const mintAmount = parseFloat(this.testOptions.mintAmount!);
    if (mintAmount <= 0) {
      throw new Error("Mint amount must be positive");
    }
    if (mintAmount > 10000) {
      Logger.warn("⚠️ Large mint amount detected - may cause issues");
    }
  }

  protected async executeMain(): Promise<ScriptResult> {
    try {
      const result: TestDataResult = {
        mockTokens: { USDC: "", WBTC: "", WETH: "" },
        mockOracle: "",
        testUsers: [],
        balancesMinted: {}
      };

      // Get all signers
      const signers = await ethers.getSigners();
      const owner = signers[0];
      const userCount = Math.min(this.testOptions.userCount!, signers.length - 1);
      
      Logger.section("📦 Deploying Mock Tokens");
      
      // Deploy mock tokens (pattern from test line 51-56)
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      
      Logger.info("Deploying MockUSDC...");
      const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
      await mockUSDC.waitForDeployment();
      result.mockTokens.USDC = await mockUSDC.getAddress();
      Logger.success(`MockUSDC deployed: ${result.mockTokens.USDC}`);
      
      Logger.info("Deploying MockWBTC...");
      const mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
      await mockWBTC.waitForDeployment();
      result.mockTokens.WBTC = await mockWBTC.getAddress();
      Logger.success(`MockWBTC deployed: ${result.mockTokens.WBTC}`);
      
      Logger.info("Deploying MockWETH...");
      const MockWETH = await ethers.getContractFactory("MockWETH");
      const mockWETH = await MockWETH.deploy();
      await mockWETH.waitForDeployment();
      result.mockTokens.WETH = await mockWETH.getAddress();
      Logger.success(`MockWETH deployed: ${result.mockTokens.WETH}`);

      // Deploy MockOracleAdapter (pattern from test: SwapManager.Phase1B.test.ts lines 28-35)
      Logger.section("🔗 Deploying Mock Oracle Adapter");
      const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
      const mockOracleAdapter = await MockOracleAdapter.deploy();
      await mockOracleAdapter.waitForDeployment();
      result.mockOracle = await mockOracleAdapter.getAddress();
      Logger.success(`MockOracleAdapter deployed: ${result.mockOracle}`);
      
      // Setup tokens in OracleAdapter BEFORE registering in TokenManager
      Logger.section("🔧 Configuring Tokens in OracleAdapter");
      
      // USDC: $1.00 (8 decimals)
      Logger.info("Setting up USDC in OracleAdapter...");
      await mockOracleAdapter.setupToken(
        "USDC",
        ethers.parseUnits("1", 8),  // $1.00
        8,                           // price decimals
        true                         // isValid
      );
      
      // WBTC: $42000.00 (8 decimals)
      Logger.info("Setting up WBTC in OracleAdapter...");
      await mockOracleAdapter.setupToken(
        "WBTC",
        ethers.parseUnits("42000", 8),  // $42000.00
        8,                               // price decimals
        true                             // isValid
      );
      
      Logger.success("✅ OracleAdapter configured with token prices");
      
      // Update beacon WETH implementation (pattern from test line 68)
      Logger.section("🎯 Updating Beacon");
      Logger.info("Updating WETH implementation in Beacon...");
      const tx1 = await this.contracts.beacon.updateImplementation("WETH", result.mockTokens.WETH);
      await tx1.wait();
      Logger.success("✅ WETH registered in Beacon");

      // Setup tokens in TokenManager (pattern from test: 4 parameters)
      if (!this.testOptions.skipTokenSetup) {
        Logger.section("🪙 Registering Tokens in TokenManager");
        
        Logger.info("Registering USDC...");
        const tx2 = await this.contracts.tokenManager["manageTokenData(string,address,uint8,uint256)"](
          "USDC",
          result.mockTokens.USDC,
          6,      // token decimals
          3600    // heartbeat (1 hour)
        );
        await tx2.wait();
        Logger.success("✅ USDC registered");
        
        Logger.info("Registering WBTC...");
        const tx3 = await this.contracts.tokenManager["manageTokenData(string,address,uint8,uint256)"](
          "WBTC",
          result.mockTokens.WBTC,
          8,      // token decimals
          3600    // heartbeat (1 hour)
        );
        await tx3.wait();
        Logger.success("✅ WBTC registered");
        
        Logger.info("Note: WETH handled via Beacon, not registered in TokenManager");
      }

      // Mint tokens to test users (pattern from test line 120+)
      Logger.section("💰 Minting Test Balances");
      
      const mintAmountWei = ethers.parseEther(this.testOptions.mintAmount!);
      const mintAmountUSDC = ethers.parseUnits("100000", 6); // 100k USDC
      const mintAmountWBTC = ethers.parseUnits("10", 8); // 10 WBTC
      
      for (let i = 1; i <= userCount; i++) {
        const user = signers[i];
        const userAddr = await user.getAddress();
        result.testUsers.push(userAddr);
        
        Logger.info(`Minting to user${i} (${userAddr})...`);
        
        // Mint USDC
        const tx4 = await mockUSDC.mint(userAddr, mintAmountUSDC);
        await tx4.wait();
        
        // Mint WBTC
        const tx5 = await mockWBTC.mint(userAddr, mintAmountWBTC);
        await tx5.wait();
        
        // Wrap ETH to WETH
        await mockWETH.connect(user).deposit({ value: mintAmountWei });
        
        result.balancesMinted[userAddr] = this.testOptions.mintAmount!;
        
        Logger.success(`✅ User${i} funded: ${this.testOptions.mintAmount} WETH, 100k USDC, 10 WBTC`);
      }

      // Configure fees in LiquidityManager (pattern from test line 117-119)
      Logger.section("⚙️ Configuring System Parameters");
      
      const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
      const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);
      
      Logger.info("Setting deposit fee to 0.5%...");
      const tx6 = await liquidityManager.setDepositFee(50); // 0.5%
      await tx6.wait();
      
      Logger.info("Setting withdraw fee to 1.0%...");
      const tx7 = await liquidityManager.setWithdrawFee(100); // 1.0%
      await tx7.wait();
      
      Logger.info("Setting fee recipient...");
      const tx8 = await liquidityManager.setFeeRecipient(await owner.getAddress());
      await tx8.wait();
      
      Logger.success("✅ Fees configured");

      // Add initial liquidity if requested
      if (this.testOptions.includeLiquidity) {
        Logger.section("💧 Adding Initial Liquidity");
        
        const initialLiquidity = ethers.parseEther("10"); // 10 ETH
        Logger.info(`Depositing ${ethers.formatEther(initialLiquidity)} ETH...`);
        
        const tx9 = await liquidityManager.deposit({ value: initialLiquidity });
        const receipt = await tx9.wait();
        
        Logger.success(`✅ Initial liquidity added in block ${receipt!.blockNumber}`);
        
        // Get pool value
        const poolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
        Logger.info(`Current pool value: ${ethers.formatEther(poolValue)} ETH`);
      }

      Logger.section("📊 Test Environment Summary");
      Logger.success("✅ Test environment ready!");
      Logger.info(`Mock Tokens Deployed: ${Object.keys(result.mockTokens).length}`);
      Logger.info(`Test Users Funded: ${result.testUsers.length}`);
      Logger.info(`Total Test Capital: ${parseFloat(this.testOptions.mintAmount!) * userCount} ETH equivalent`);
      
      return {
        success: true,
        data: result
      };
      
    } catch (error: any) {
      Logger.error("Error populating test data");
      throw error;
    }
  }
}

/**
 * Main execution
 * Pattern verified: MockOracleAdapter setup from SwapManager.Phase1B.test.ts
 * Test reference: Uses 4-parameter manageTokenData() API
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: PopulateTestDataOptions = {
    network: "hardhat"
  };
  
  for (const arg of args) {
    if (arg.startsWith("--users=")) {
      options.userCount = parseInt(arg.split("=")[1]);
    } else if (arg.startsWith("--mint=")) {
      options.mintAmount = arg.split("=")[1];
    } else if (arg === "--no-liquidity") {
      options.includeLiquidity = false;
    } else if (arg === "--skip-tokens") {
      options.skipTokenSetup = true;
    }
  }
  
  const script = new PopulateTestDataScript(options);
  const result = await script.execute();
  
  if (!result.success) {
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
