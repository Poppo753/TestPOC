// SPDX-License-Identifier: MIT
/**
 * @title DeployFull
 * @dev Script per deployment completo del sistema DeFi con tutti i moduli
 * 
 * Basato su pattern da:
 * - test/integration fixtures deployCompleteEcosystem (tutte le suite di test)
 * - Pattern comune: Beacon + 7 moduli + WETH + registrazione + autorizzazioni
 * 
 * Deployment order (criticamente importante):
 * 1. Beacon (registry centrale)
 * 2. TokenManager
 * 3. ParameterManager
 * 4. ValueCalculator
 * 5. ProxyGeneral
 * 6. LiquidityManager
 * 7. SwapManager
 * 8. EmergencyHandler
 * 9. Mock contracts (se testnet/localhost)
 * 10. Registrazione moduli in Beacon
 * 11. Autorizzazioni ProxyGeneral
 * 12. Inizializzazione configurazioni
 * 
 * CLI Usage:
 *   npx hardhat run scripts/dev/DeployFull.ts --network <network>
 *   --with-mocks                (deploy mock tokens/oracle - default for localhost)
 *   --skip-init                 (skip initialization steps)
 *   --verify                    (verify on Etherscan after deployment)
 *   --export=<file.json>        (export deployment addresses)
 * 
 * Examples:
 *   npx hardhat run scripts/dev/DeployFull.ts --network localhost --with-mocks
 *   npx hardhat run scripts/dev/DeployFull.ts --network sepolia --verify
 *   npx hardhat run scripts/dev/DeployFull.ts --network mainnet --export=deployment.json
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";
import * as fs from "fs";

interface DeployOptions {
  withMocks: boolean;
  skipInit: boolean;
  verify: boolean;
  exportFile?: string;
}

interface DeploymentAddresses {
  beacon: string;
  tokenManager: string;
  parameterManager: string;
  valueCalculator: string;
  proxyGeneral: string;
  liquidityManager: string;
  swapManager: string;
  emergencyHandler: string;
  mockWETH?: string;
  mockUSDC?: string;
  mockWBTC?: string;
  mockOracle?: string;
  deploymentTime: number;
  network: string;
  deployer: string;
}

/**
 * @notice Script per deployment completo del sistema DeFi
 * @dev Pattern da integration test fixtures
 */
export class DeployFullScript extends BaseScript {
  private deployOptions: DeployOptions;
  private deployedAddresses: Partial<DeploymentAddresses> = {};
  
  constructor() {
    super();
    this.deployOptions = this.parseDeployOptions();
  }

  protected getScriptName(): string {
    return "DeployFull";
  }

  /**
   * @notice Parse CLI arguments per deploy options
   */
  private parseDeployOptions(): DeployOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string, defaultValue: string = ""): string => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : defaultValue;
    };
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    // Auto-enable mocks for localhost
    const network = process.env.HARDHAT_NETWORK || "localhost";
    const withMocksDefault = network === "localhost" || network === "hardhat";

    return {
      withMocks: hasFlag("with-mocks") || withMocksDefault,
      skipInit: hasFlag("skip-init"),
      verify: hasFlag("verify"),
      exportFile: getArg("export")
    };
  }

  /**
   * @notice Entry point per full deployment
   * @dev Pattern: Deploy contracts → Register → Authorize → Initialize
   */
  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("FULL SYSTEM DEPLOYMENT");
    Logger.info(`Network: ${ethers.provider ? await ethers.provider.getNetwork().then(n => n.name) : "unknown"}`);
    Logger.info(`Deployer: ${this.signer.address}`);
    Logger.info(`With Mocks: ${this.deployOptions.withMocks ? "YES" : "NO"}`);
    Logger.info(`Verify: ${this.deployOptions.verify ? "YES" : "NO"}`);

    const startTime = Date.now();

    try {
      // Step 1: Deploy Beacon (registry centrale)
      await this.deployBeacon();

      // Step 2: Deploy all core modules
      await this.deployTokenManager();
      await this.deployParameterManager();
      await this.deployValueCalculator();
      await this.deployProxyGeneral();
      await this.deployLiquidityManager();
      await this.deploySwapManager();
      await this.deployEmergencyHandler();

      // Step 3: Deploy mocks if requested
      if (this.deployOptions.withMocks) {
        await this.deployMockContracts();
      }

      // Step 4: Register modules in Beacon
      await this.registerModules();

      // Step 5: Setup authorizations
      await this.setupAuthorizations();

      // Step 6: Initialize configurations
      if (!this.deployOptions.skipInit) {
        await this.initializeSystem();
      }

      // Step 7: Verify health
      await this.verifyDeployment();

      // Step 8: Export addresses if requested
      if (this.deployOptions.exportFile) {
        await this.exportAddresses();
      }

      const duration = Date.now() - startTime;
      
      Logger.section("DEPLOYMENT COMPLETE");
      Logger.success(`Full system deployed in ${duration}ms`);
      this.printDeploymentSummary();

      return {
        success: true,
        data: {
          addresses: this.deployedAddresses,
          duration
        }
      };

    } catch (error: any) {
      Logger.error(`Deployment failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * @notice Deploy Beacon contract (registry centrale)
   * @dev Pattern: PG-001.ParameterUpdates line 33
   */
  private async deployBeacon(): Promise<void> {
    Logger.section("DEPLOYING BEACON");
    Logger.info("Beacon is the central registry for all modules");

    const BeaconFactory = await ethers.getContractFactory("Beacon");
    const beacon = await BeaconFactory.deploy();
    await beacon.waitForDeployment();
    
    const beaconAddress = await beacon.getAddress();
    this.deployedAddresses.beacon = beaconAddress;
    
    Logger.success(`Beacon deployed: ${beaconAddress}`);
  }

  /**
   * @notice Deploy TokenManager contract
   * @dev Pattern: test fixtures line ~45
   */
  private async deployTokenManager(): Promise<void> {
    Logger.section("DEPLOYING TOKENMANAGER");
    
    const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TokenManagerFactory.deploy(this.deployedAddresses.beacon!);
    await tokenManager.waitForDeployment();
    
    const address = await tokenManager.getAddress();
    this.deployedAddresses.tokenManager = address;
    
    Logger.success(`TokenManager deployed: ${address}`);
  }

  /**
   * @notice Deploy ParameterManager contract
   * @dev Gestisce parametri di sistema
   */
  private async deployParameterManager(): Promise<void> {
    Logger.section("DEPLOYING PARAMETERMANAGER");
    
    const ParameterManagerFactory = await ethers.getContractFactory("ParameterManager");
    const parameterManager = await ParameterManagerFactory.deploy(this.deployedAddresses.beacon!, 6);
    await parameterManager.waitForDeployment();
    
    const address = await parameterManager.getAddress();
    this.deployedAddresses.parameterManager = address;
    
    Logger.success(`ParameterManager deployed: ${address}`);
  }

  /**
   * @notice Deploy ValueCalculator contract
   * @dev Calcoli di valore e conversioni
   */
  private async deployValueCalculator(): Promise<void> {
    Logger.section("DEPLOYING VALUECALCULATOR");
    
    const ValueCalculatorFactory = await ethers.getContractFactory("ValueCalculator");
    const valueCalculator = await ValueCalculatorFactory.deploy(this.deployedAddresses.beacon!, "USDC");
    await valueCalculator.waitForDeployment();
    
    const address = await valueCalculator.getAddress();
    this.deployedAddresses.valueCalculator = address;
    
    Logger.success(`ValueCalculator deployed: ${address}`);
  }

  /**
   * @notice Deploy ProxyGeneral contract
   * @dev Custody e gestione asset
   */
  private async deployProxyGeneral(): Promise<void> {
    Logger.section("DEPLOYING PROXYGENERAL");
    
    const ProxyGeneralFactory = await ethers.getContractFactory("ProxyGeneral");
    const proxyGeneral = await ProxyGeneralFactory.deploy(this.deployedAddresses.beacon!, "USDC");
    await proxyGeneral.waitForDeployment();
    
    const address = await proxyGeneral.getAddress();
    this.deployedAddresses.proxyGeneral = address;
    
    Logger.success(`ProxyGeneral deployed: ${address}`);
  }

  /**
   * @notice Deploy LiquidityManager contract
   * @dev Gestione liquidità e deposits/withdraws
   */
  private async deployLiquidityManager(): Promise<void> {
    Logger.section("DEPLOYING LIQUIDITYMANAGER");
    
    const LiquidityManagerFactory = await ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LiquidityManagerFactory.deploy(this.deployedAddresses.beacon!, "USDC");
    await liquidityManager.waitForDeployment();
    
    const address = await liquidityManager.getAddress();
    this.deployedAddresses.liquidityManager = address;
    
    Logger.success(`LiquidityManager deployed: ${address}`);
  }

  /**
   * @notice Deploy SwapManager contract
   * @dev Gestione swap e routing
   */
  private async deploySwapManager(): Promise<void> {
    Logger.section("DEPLOYING SWAPMANAGER");
    
    const SwapManagerFactory = await ethers.getContractFactory("SwapManager");
    const swapManager = await SwapManagerFactory.deploy(this.deployedAddresses.beacon!, "USDC");
    await swapManager.waitForDeployment();
    
    const address = await swapManager.getAddress();
    this.deployedAddresses.swapManager = address;
    
    Logger.success(`SwapManager deployed: ${address}`);
  }

  /**
   * @notice Deploy EmergencyHandler contract
   * @dev Gestione emergenze e pause
   */
  private async deployEmergencyHandler(): Promise<void> {
    Logger.section("DEPLOYING EMERGENCYHANDLER");
    
    const EmergencyHandlerFactory = await ethers.getContractFactory("EmergencyHandler");
    const emergencyHandler = await EmergencyHandlerFactory.deploy(this.deployedAddresses.beacon!);
    await emergencyHandler.waitForDeployment();
    
    const address = await emergencyHandler.getAddress();
    this.deployedAddresses.emergencyHandler = address;
    
    Logger.success(`EmergencyHandler deployed: ${address}`);
  }

  /**
   * @notice Deploy mock contracts for testing
   * @dev Pattern: LF-005.StressTesting line 73-77
   */
  private async deployMockContracts(): Promise<void> {
    Logger.section("DEPLOYING MOCK CONTRACTS");
    Logger.info("Deploying MockWETH, MockERC20 tokens, and MockChainlinkOracle");

    // Deploy MockWETH
    Logger.info("Deploying MockWETH...");
    const MockWETHFactory = await ethers.getContractFactory("MockWETH");
    const mockWETH = await MockWETHFactory.deploy();
    await mockWETH.waitForDeployment();
    this.deployedAddresses.mockWETH = await mockWETH.getAddress();
    Logger.success(`MockWETH deployed: ${this.deployedAddresses.mockWETH}`);

    // Deploy MockUSDC (6 decimals)
    Logger.info("Deploying MockUSDC...");
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
    await mockUSDC.waitForDeployment();
    this.deployedAddresses.mockUSDC = await mockUSDC.getAddress();
    Logger.success(`MockUSDC deployed: ${this.deployedAddresses.mockUSDC}`);

    // Deploy MockWBTC (8 decimals)
    Logger.info("Deploying MockWBTC...");
    const mockWBTC = await MockERC20Factory.deploy("Wrapped Bitcoin", "WBTC", 8);
    await mockWBTC.waitForDeployment();
    this.deployedAddresses.mockWBTC = await mockWBTC.getAddress();
    Logger.success(`MockWBTC deployed: ${this.deployedAddresses.mockWBTC}`);

    // Deploy MockChainlinkOracle (ETH/USD at $2000, 8 decimals)
    Logger.info("Deploying MockChainlinkOracle...");
    const MockOracleFactory = await ethers.getContractFactory("MockChainlinkOracle");
    const mockOracle = await MockOracleFactory.deploy(
      ethers.parseUnits("2000", 8), // Initial price: $2000
      8, // Decimals
      "ETH/USD" // Description
    );
    await mockOracle.waitForDeployment();
    this.deployedAddresses.mockOracle = await mockOracle.getAddress();
    Logger.success(`MockChainlinkOracle deployed: ${this.deployedAddresses.mockOracle}`);

    Logger.success("All mock contracts deployed");
  }

  /**
   * @notice Register all modules in Beacon
   * @dev Pattern: test fixtures lines ~80-90
   */
  private async registerModules(): Promise<void> {
    Logger.section("REGISTERING MODULES IN BEACON");
    Logger.info("Updating Beacon implementation registry");

    const beacon = await ethers.getContractAt("Beacon", this.deployedAddresses.beacon!);

    // Register all 7 core modules
    Logger.info("Registering TokenManager...");
    await beacon.updateImplementation("TokenManager", this.deployedAddresses.tokenManager!);
    
    Logger.info("Registering ParameterManager...");
    await beacon.updateImplementation("ParameterManager", this.deployedAddresses.parameterManager!);
    
    Logger.info("Registering ValueCalculator...");
    await beacon.updateImplementation("ValueCalculator", this.deployedAddresses.valueCalculator!);
    
    Logger.info("Registering ProxyGeneral...");
    await beacon.updateImplementation("ProxyGeneral", this.deployedAddresses.proxyGeneral!);
    
    Logger.info("Registering LiquidityManager...");
    await beacon.updateImplementation("LiquidityManager", this.deployedAddresses.liquidityManager!);
    
    Logger.info("Registering SwapManager...");
    await beacon.updateImplementation("SwapManager", this.deployedAddresses.swapManager!);
    
    Logger.info("Registering EmergencyHandler...");
    await beacon.updateImplementation("EmergencyHandler", this.deployedAddresses.emergencyHandler!);

    // Register WETH if deployed
    if (this.deployedAddresses.mockWETH) {
      Logger.info("Registering MockWETH...");
      await beacon.updateImplementation("WETH", this.deployedAddresses.mockWETH);
    }

    const moduleCount = this.deployedAddresses.mockWETH ? 8 : 7;
    Logger.success(`All ${moduleCount} modules registered in Beacon`);
  }

  /**
   * @notice Setup authorizations for ProxyGeneral
   * @dev Pattern: LF-004.ConcurrentOps line 99-102
   */
  private async setupAuthorizations(): Promise<void> {
    Logger.section("SETTING UP AUTHORIZATIONS");
    Logger.info("Authorizing modules in ProxyGeneral");

    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", this.deployedAddresses.proxyGeneral!);

    // Authorize LiquidityManager
    Logger.info("Authorizing LiquidityManager...");
    await proxyGeneral.authorizeModule(this.deployedAddresses.liquidityManager!, "LiquidityManager");
    
    Logger.success("LiquidityManager authorized in ProxyGeneral");
    Logger.success("Authorization setup complete");
  }

  /**
   * @notice Initialize system configurations
   * @dev Setup initial fees, limits, and parameters
   */
  private async initializeSystem(): Promise<void> {
    Logger.section("INITIALIZING SYSTEM CONFIGURATIONS");
    Logger.info("Setting up initial parameters and limits");

    // Get LiquidityManager
    const liquidityManager = await ethers.getContractAt("LiquidityManager", this.deployedAddresses.liquidityManager!);

    // Setup withdraw limits (pattern: LF-005 line 105-110)
    Logger.info("Configuring withdraw limits...");
    await liquidityManager.setWithdrawLimits(
      ethers.parseEther("1000"),   // 1000 ETH hourly limit
      ethers.parseEther("10000"),  // 10000 ETH daily limit
      ethers.parseEther("0.01"),   // 0.01 ETH minimum withdraw
      ethers.parseEther("100")     // 100 ETH max per transaction
    );
    Logger.success("Withdraw limits configured");

    // Setup deposit fee (0.5%)
    Logger.info("Setting deposit fee to 0.5%...");
    await liquidityManager.setDepositFee(50); // 50 basis points = 0.5%
    Logger.success("Deposit fee configured");

    // Setup withdraw fee (1.0%)
    Logger.info("Setting withdraw fee to 1.0%...");
    await liquidityManager.setWithdrawFee(100); // 100 basis points = 1.0%
    Logger.success("Withdraw fee configured");

    // If mocks deployed, initialize liquidity
    if (this.deployedAddresses.mockWETH) {
      Logger.info("Initializing WETH liquidity...");
      
      // Send ETH to MockWETH
      await this.signer.sendTransaction({
        to: this.deployedAddresses.mockWETH,
        value: ethers.parseEther("100") // 100 ETH initial liquidity
      });
      
      Logger.success("Initial WETH liquidity provided");
    }

    Logger.success("System initialization complete");
  }

  /**
   * @notice Verify deployment health
   * @dev Check all modules registered and accessible
   */
  private async verifyDeployment(): Promise<void> {
    Logger.section("VERIFYING DEPLOYMENT");
    Logger.info("Checking system health and module registration");

    const beacon = await ethers.getContractAt("Beacon", this.deployedAddresses.beacon!);

    // Verify all modules registered
    const modules = [
      "TokenManager",
      "ParameterManager",
      "ValueCalculator",
      "ProxyGeneral",
      "LiquidityManager",
      "SwapManager",
      "EmergencyHandler"
    ];

    if (this.deployedAddresses.mockWETH) {
      modules.push("WETH");
    }

    Logger.info(`Verifying ${modules.length} modules...`);
    
    for (const moduleName of modules) {
      const moduleAddr = await beacon.getImplementation(moduleName);
      
      if (moduleAddr === ethers.ZeroAddress) {
        throw new Error(`Module ${moduleName} not registered in Beacon`);
      }
      
      Logger.success(`✓ ${moduleName}: ${moduleAddr}`);
    }

    Logger.success("All modules verified and accessible");
    Logger.success("Deployment health check PASSED");
  }

  /**
   * @notice Export deployment addresses to JSON file
   */
  private async exportAddresses(): Promise<void> {
    Logger.section("EXPORTING DEPLOYMENT ADDRESSES");
    
    const network = await ethers.provider.getNetwork();
    
    const exportData: DeploymentAddresses = {
      ...(this.deployedAddresses as any),
      deploymentTime: Date.now(),
      network: network.name,
      deployer: this.signer.address
    };

    const exportPath = this.deployOptions.exportFile!;
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    
    Logger.success(`Addresses exported to: ${exportPath}`);
  }

  /**
   * @notice Print deployment summary
   */
  private printDeploymentSummary(): void {
    Logger.section("DEPLOYMENT SUMMARY");
    
    Logger.info("Core Contracts:");
    Logger.info(`  Beacon: ${this.deployedAddresses.beacon}`);
    Logger.info(`  TokenManager: ${this.deployedAddresses.tokenManager}`);
    Logger.info(`  ParameterManager: ${this.deployedAddresses.parameterManager}`);
    Logger.info(`  ValueCalculator: ${this.deployedAddresses.valueCalculator}`);
    Logger.info(`  ProxyGeneral: ${this.deployedAddresses.proxyGeneral}`);
    Logger.info(`  LiquidityManager: ${this.deployedAddresses.liquidityManager}`);
    Logger.info(`  SwapManager: ${this.deployedAddresses.swapManager}`);
    Logger.info(`  EmergencyHandler: ${this.deployedAddresses.emergencyHandler}`);

    if (this.deployedAddresses.mockWETH) {
      Logger.info("\nMock Contracts:");
      Logger.info(`  MockWETH: ${this.deployedAddresses.mockWETH}`);
      Logger.info(`  MockUSDC: ${this.deployedAddresses.mockUSDC}`);
      Logger.info(`  MockWBTC: ${this.deployedAddresses.mockWBTC}`);
      Logger.info(`  MockOracle: ${this.deployedAddresses.mockOracle}`);
    }

    Logger.success("\nSystem ready for use!");
  }
}

// Execute script
if (require.main === module) {
  const script = new DeployFullScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
