// SPDX-License-Identifier: MIT
/**
 * @title DebugState
 * @dev Script per ispezionare stato sistema
 * 
 * CLI Usage:
 *   npx hardhat run scripts/dev/DebugState.ts --network <network>
 *   --module=<ModuleName>          (inspect specific module)
 *   --all                          (inspect all modules)
 * 
 * Examples:
 *   npx hardhat run scripts/dev/DebugState.ts --network localhost --module=LiquidityManager
 *   npx hardhat run scripts/dev/DebugState.ts --network localhost --all
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";

interface DebugStateOptions {
  module?: string;
  all: boolean;
}

export class DebugStateScript extends BaseScript {
  private debugOptions: DebugStateOptions;
  
  constructor() {
    super();
    this.debugOptions = this.parseDebugOptions();
  }

  protected getScriptName(): string {
    return "DebugState";
  }

  private parseDebugOptions(): DebugStateOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string): string | undefined => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : undefined;
    };
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    return {
      module: getArg("module"),
      all: hasFlag("all")
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("STATE DEBUG");

    try {
      if (this.debugOptions.all) {
        await this.inspectAllModules();
      } else if (this.debugOptions.module) {
        await this.inspectModule(this.debugOptions.module);
      } else {
        await this.inspectBeacon();
      }

      return {
        success: true,
        data: {}
      };

    } catch (error: any) {
      Logger.error(`State debug failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async inspectBeacon(): Promise<void> {
    Logger.section("BEACON STATE");
    Logger.info(`Address: ${await this.contracts.beacon.getAddress()}`);
    Logger.info(`Owner: ${await this.contracts.beacon.owner()}`);
  }

  private async inspectModule(moduleName: string): Promise<void> {
    Logger.section(`${moduleName.toUpperCase()} STATE`);
    
    const moduleAddr = await this.contracts.beacon.getImplementation(moduleName);
    Logger.info(`Address: ${moduleAddr}`);

    if (moduleName === "LiquidityManager") {
      const lm = await ethers.getContractAt("LiquidityManager", moduleAddr);
      Logger.info(`Deposit Fee: ${await lm.depositFee()} bps`);
      Logger.info(`Withdraw Fee: ${await lm.withdrawFee()} bps`);
    }
  }

  private async inspectAllModules(): Promise<void> {
    const modules = ["TokenManager", "ParameterManager", "ValueCalculator", "ProxyGeneral", "LiquidityManager", "SwapManager", "EmergencyHandler"];
    
    for (const module of modules) {
      await this.inspectModule(module);
    }
  }
}

if (require.main === module) {
  const script = new DebugStateScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
