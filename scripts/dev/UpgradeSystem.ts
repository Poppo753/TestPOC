// SPDX-License-Identifier: MIT
/**
 * @title UpgradeSystem
 * @dev Script per upgrade beacon-based di moduli del sistema
 * 
 * Pattern: BeaconModules.integration.test.ts - Beacon updateImplementation
 * 
 * CLI Usage:
 *   npx hardhat run scripts/dev/UpgradeSystem.ts --network <network>
 *   --module=<ModuleName>          (required: module to upgrade)
 *   --dry-run                      (simulate without executing)
 *   --backup                       (backup old implementation address)
 * 
 * Examples:
 *   npx hardhat run scripts/dev/UpgradeSystem.ts --network localhost --module=LiquidityManager --dry-run
 *   npx hardhat run scripts/dev/UpgradeSystem.ts --network sepolia --module=SwapManager --backup
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";

interface UpgradeOptions {
  module: string;
  dryRun: boolean;
  backup: boolean;
}

/**
 * @notice Script per upgrade moduli via Beacon
 * @dev Pattern: beacon.updateImplementation da test
 */
export class UpgradeSystemScript extends BaseScript {
  private upgradeOptions: UpgradeOptions;
  private oldImplementation: string = "";
  private newImplementation: string = "";
  
  constructor() {
    super();
    this.upgradeOptions = this.parseUpgradeOptions();
  }

  protected getScriptName(): string {
    return "UpgradeSystem";
  }

  private parseUpgradeOptions(): UpgradeOptions {
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
      dryRun: hasFlag("dry-run"),
      backup: hasFlag("backup")
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("SYSTEM UPGRADE");
    Logger.info(`Module: ${this.upgradeOptions.module}`);
    Logger.info(`Dry Run: ${this.upgradeOptions.dryRun ? "YES" : "NO"}`);
    Logger.info(`Backup: ${this.upgradeOptions.backup ? "YES" : "NO"}`);

    try {
      // Step 1: Validate and get old implementation
      await this.validateModule();

      // Step 2: Deploy new implementation
      await this.deployNewImplementation();

      // Step 3: Update Beacon (if not dry-run)
      if (!this.upgradeOptions.dryRun) {
        await this.updateBeacon();
        await this.verifyUpgrade();
      } else {
        Logger.info("DRY RUN - Skipping actual upgrade");
      }

      return {
        success: true,
        data: {
          module: this.upgradeOptions.module,
          oldImplementation: this.oldImplementation,
          newImplementation: this.newImplementation,
          upgraded: !this.upgradeOptions.dryRun
        }
      };

    } catch (error: any) {
      Logger.error(`Upgrade failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async validateModule(): Promise<void> {
    Logger.section("VALIDATING MODULE");

    this.oldImplementation = await this.contracts.beacon.getImplementation(this.upgradeOptions.module);
    
    if (this.oldImplementation === ethers.ZeroAddress) {
      throw new Error(`Module ${this.upgradeOptions.module} not found in Beacon`);
    }

    Logger.success(`Current implementation: ${this.oldImplementation}`);

    if (this.upgradeOptions.backup) {
      Logger.info(`Backup address saved: ${this.oldImplementation}`);
    }
  }

  private async deployNewImplementation(): Promise<void> {
    Logger.section("DEPLOYING NEW IMPLEMENTATION");

    const beaconAddr = await this.contracts.beacon.getAddress();
    const ModuleFactory = await ethers.getContractFactory(this.upgradeOptions.module);
    const newModule = await ModuleFactory.deploy(beaconAddr);
    await newModule.waitForDeployment();

    this.newImplementation = await newModule.getAddress();
    Logger.success(`New implementation deployed: ${this.newImplementation}`);
  }

  private async updateBeacon(): Promise<void> {
    Logger.section("UPDATING BEACON");
    Logger.info(`Updating ${this.upgradeOptions.module} implementation...`);

    await this.contracts.beacon.updateImplementation(this.upgradeOptions.module, this.newImplementation);
    
    Logger.success("Beacon updated successfully");
  }

  private async verifyUpgrade(): Promise<void> {
    Logger.section("VERIFYING UPGRADE");

    const currentImpl = await this.contracts.beacon.getImplementation(this.upgradeOptions.module);
    
    if (currentImpl !== this.newImplementation) {
      throw new Error("Upgrade verification failed");
    }

    Logger.success(`Upgrade verified: ${currentImpl}`);
    Logger.success(`Old: ${this.oldImplementation}`);
    Logger.success(`New: ${this.newImplementation}`);
  }
}

// Execute script
if (require.main === module) {
  const script = new UpgradeSystemScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
