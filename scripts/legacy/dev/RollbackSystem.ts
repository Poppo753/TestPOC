// SPDX-License-Identifier: MIT
/**
 * @title RollbackSystem
 * @dev Script per rollback a implementazione precedente
 * 
 * CLI Usage:
 *   npx hardhat run scripts/dev/RollbackSystem.ts --network <network>
 *   --module=<ModuleName>          (required: module to rollback)
 *   --address=<0x...>              (required: previous implementation address)
 *   --force                        (skip safety checks)
 * 
 * Examples:
 *   npx hardhat run scripts/dev/RollbackSystem.ts --network localhost --module=LiquidityManager --address=0x123...
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";

interface RollbackOptions {
  module: string;
  address: string;
  force: boolean;
}

/**
 * @notice Script per rollback implementazione modulo
 */
export class RollbackSystemScript extends BaseScript {
  private rollbackOptions: RollbackOptions;
  
  constructor() {
    super();
    this.rollbackOptions = this.parseRollbackOptions();
  }

  protected getScriptName(): string {
    return "RollbackSystem";
  }

  private parseRollbackOptions(): RollbackOptions {
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
      address: getArg("address"),
      force: hasFlag("force")
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("SYSTEM ROLLBACK");
    Logger.info(`Module: ${this.rollbackOptions.module}`);
    Logger.info(`Target Address: ${this.rollbackOptions.address}`);
    Logger.info(`Force: ${this.rollbackOptions.force ? "YES" : "NO"}`);

    try {
      if (!this.rollbackOptions.force) {
        await this.performSafetyChecks();
      }

      await this.executeRollback();
      await this.verifyRollback();

      return {
        success: true,
        data: {
          module: this.rollbackOptions.module,
          rolledBackTo: this.rollbackOptions.address
        }
      };

    } catch (error: any) {
      Logger.error(`Rollback failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async performSafetyChecks(): Promise<void> {
    Logger.section("SAFETY CHECKS");

    // Verify target address is valid contract
    const code = await ethers.provider.getCode(this.rollbackOptions.address);
    if (code === "0x") {
      throw new Error("Target address is not a contract");
    }

    // Verify module exists
    const currentImpl = await this.contracts.beacon.getImplementation(this.rollbackOptions.module);
    if (currentImpl === ethers.ZeroAddress) {
      throw new Error(`Module ${this.rollbackOptions.module} not found`);
    }

    Logger.success("Safety checks passed");
  }

  private async executeRollback(): Promise<void> {
    Logger.section("EXECUTING ROLLBACK");
    Logger.info(`Rolling back ${this.rollbackOptions.module} to ${this.rollbackOptions.address}`);

    await this.contracts.beacon.updateImplementation(this.rollbackOptions.module, this.rollbackOptions.address);
    
    Logger.success("Rollback executed");
  }

  private async verifyRollback(): Promise<void> {
    Logger.section("VERIFYING ROLLBACK");

    const currentImpl = await this.contracts.beacon.getImplementation(this.rollbackOptions.module);
    
    if (currentImpl !== this.rollbackOptions.address) {
      throw new Error("Rollback verification failed");
    }

    Logger.success(`Rollback verified: ${currentImpl}`);
  }
}

// Execute script
if (require.main === module) {
  const script = new RollbackSystemScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
