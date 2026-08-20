// SPDX-License-Identifier: MIT
/**
 * @title DeployModule
 * @dev Script per deployment di singoli moduli con registrazione in Beacon
 * 
 * Uso:
 * - Deploy di un nuovo modulo
 * - Upgrade di modulo esistente
 * - Test di deployment isolato
 * 
 * CLI Usage:
 *   npx hardhat run scripts/dev/DeployModule.ts --network <network>
 *   --module=<ModuleName>          (required: TokenManager, LiquidityManager, etc.)
 *   --register                     (register in Beacon after deployment)
 *   --verify                       (verify on Etherscan)
 *   --init                         (run initialization if needed)
 * 
 * Examples:
 *   npx hardhat run scripts/dev/DeployModule.ts --network localhost --module=LiquidityManager --register
 *   npx hardhat run scripts/dev/DeployModule.ts --network sepolia --module=SwapManager --register --verify
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";

interface ModuleOptions {
  module: string;
  register: boolean;
  verify: boolean;
  init: boolean;
}

const VALID_MODULES = [
  "TokenManager",
  "ParameterManager",
  "ValueCalculator",
  "ProxyGeneral",
  "LiquidityManager",
  "SwapManager",
  "EmergencyHandler"
];

/**
 * @notice Script per deployment singolo modulo
 * @dev Pattern: Beacon update from test fixtures
 */
export class DeployModuleScript extends BaseScript {
  private moduleOptions: ModuleOptions;
  private moduleAddress: string = "";
  
  constructor() {
    super();
    this.moduleOptions = this.parseModuleOptions();
  }

  protected getScriptName(): string {
    return "DeployModule";
  }

  private parseModuleOptions(): ModuleOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string, defaultValue: string = ""): string => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : defaultValue;
    };
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    return {
      module: getArg("module"),
      register: hasFlag("register"),
      verify: hasFlag("verify"),
      init: hasFlag("init")
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("MODULE DEPLOYMENT");
    Logger.info(`Module: ${this.moduleOptions.module}`);
    Logger.info(`Register: ${this.moduleOptions.register ? "YES" : "NO"}`);
    Logger.info(`Verify: ${this.moduleOptions.verify ? "YES" : "NO"}`);

    try {
      // Validate module name
      if (!VALID_MODULES.includes(this.moduleOptions.module)) {
        throw new Error(`Invalid module: ${this.moduleOptions.module}. Valid: ${VALID_MODULES.join(", ")}`);
      }

      // Step 1: Deploy module
      await this.deployModule();

      // Step 2: Register in Beacon if requested
      if (this.moduleOptions.register) {
        await this.registerInBeacon();
      }

      // Step 3: Initialize if requested
      if (this.moduleOptions.init) {
        await this.initializeModule();
      }

      Logger.success("Module deployment completed");

      return {
        success: true,
        data: {
          module: this.moduleOptions.module,
          address: this.moduleAddress
        }
      };

    } catch (error: any) {
      Logger.error(`Module deployment failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async deployModule(): Promise<void> {
    Logger.section(`DEPLOYING ${this.moduleOptions.module.toUpperCase()}`);

    // Get Beacon address
    const beaconAddr = await this.contracts.beacon.getAddress();
    Logger.info(`Using Beacon: ${beaconAddr}`);

    // Deploy the module
    const ModuleFactory = await ethers.getContractFactory(this.moduleOptions.module);

    // Modules requiring baseAssetCode or baseDecimals
    const modulesNeedingBaseAssetCode = [
      "SwapManager", "ValueCalculator", "LiquidityManager", "ProxyGeneral",
      "MorphoLensAdapter", "EulerLensAdapter", "AaveV3LensAdapter", "MorphoVaultLensAdapter",
      "EulerV2Plugin", "AaveV3Plugin", "MorphoPlugin"
    ];
    let module;
    if (this.moduleOptions.module === "ParameterManager") {
      module = await ModuleFactory.deploy(beaconAddr, 6); // baseDecimals for USDC
    } else if (modulesNeedingBaseAssetCode.includes(this.moduleOptions.module)) {
      module = await ModuleFactory.deploy(beaconAddr, "USDC");
    } else {
      module = await ModuleFactory.deploy(beaconAddr);
    }
    await module.waitForDeployment();

    this.moduleAddress = await module.getAddress();
    Logger.success(`${this.moduleOptions.module} deployed: ${this.moduleAddress}`);
  }

  private async registerInBeacon(): Promise<void> {
    Logger.section("REGISTERING IN BEACON");
    Logger.info(`Updating Beacon implementation for ${this.moduleOptions.module}`);

    await this.contracts.beacon.updateImplementation(this.moduleOptions.module, this.moduleAddress);
    
    // Verify registration
    const registered = await this.contracts.beacon.getImplementation(this.moduleOptions.module);
    
    if (registered === this.moduleAddress) {
      Logger.success(`${this.moduleOptions.module} registered successfully`);
    } else {
      throw new Error("Registration verification failed");
    }
  }

  private async initializeModule(): Promise<void> {
    Logger.section("INITIALIZING MODULE");
    
    // Module-specific initialization
    switch (this.moduleOptions.module) {
      case "LiquidityManager":
        await this.initializeLiquidityManager();
        break;
      case "ProxyGeneral":
        await this.initializeProxyGeneral();
        break;
      default:
        Logger.info(`No initialization required for ${this.moduleOptions.module}`);
    }
  }

  private async initializeLiquidityManager(): Promise<void> {
    Logger.info("Initializing LiquidityManager with default settings...");
    
    const liquidityManager = await ethers.getContractAt("LiquidityManager", this.moduleAddress);
    
    // Set default fees
    await liquidityManager.setDepositFee(50); // 0.5%
    await liquidityManager.setWithdrawFee(100); // 1.0%
    
    // Set default limits
    await liquidityManager.setWithdrawLimits(
      ethers.parseEther("1000"),
      ethers.parseEther("10000"),
      ethers.parseEther("0.01"),
      ethers.parseEther("100")
    );
    
    Logger.success("LiquidityManager initialized");
  }

  private async initializeProxyGeneral(): Promise<void> {
    Logger.info("Initializing ProxyGeneral authorizations...");
    
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", this.moduleAddress);
    
    // Get LiquidityManager address from Beacon
    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    
    if (liquidityManagerAddr !== ethers.ZeroAddress) {
      await proxyGeneral.authorizeModule(liquidityManagerAddr, "LiquidityManager");
      Logger.success("LiquidityManager authorized");
    }
  }
}

// Execute script
if (require.main === module) {
  const script = new DeployModuleScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
