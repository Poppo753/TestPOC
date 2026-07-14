// SPDX-License-Identifier: MIT
/**
 * @title MigrateData
 * @dev Script per migrazione dati tra versioni del sistema
 * 
 * CLI Usage:
 *   npx hardhat run scripts/dev/MigrateData.ts --network <network>
 *   --from=<version>               (source version)
 *   --to=<version>                 (target version)
 *   --export=<file.json>           (export data to file)
 *   --import=<file.json>           (import data from file)
 * 
 * Examples:
 *   npx hardhat run scripts/dev/MigrateData.ts --network localhost --export=backup.json
 *   npx hardhat run scripts/dev/MigrateData.ts --network localhost --import=backup.json
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";
import * as fs from "fs";

interface MigrateOptions {
  from?: string;
  to?: string;
  exportFile?: string;
  importFile?: string;
}

interface SystemState {
  beacon: {
    address: string;
    modules: { [key: string]: string };
  };
  liquidityManager: {
    depositFee: number;
    withdrawFee: number;
  };
  timestamp: number;
}

/**
 * @notice Script per migrazione dati
 */
export class MigrateDataScript extends BaseScript {
  private migrateOptions: MigrateOptions;
  
  constructor() {
    super();
    this.migrateOptions = this.parseMigrateOptions();
  }

  protected getScriptName(): string {
    return "MigrateData";
  }

  private parseMigrateOptions(): MigrateOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string): string | undefined => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : undefined;
    };

    return {
      from: getArg("from"),
      to: getArg("to"),
      exportFile: getArg("export"),
      importFile: getArg("import")
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("DATA MIGRATION");

    try {
      if (this.migrateOptions.exportFile) {
        await this.exportData();
      } else if (this.migrateOptions.importFile) {
        await this.importData();
      } else {
        throw new Error("Specify --export or --import");
      }

      return {
        success: true,
        data: {
          operation: this.migrateOptions.exportFile ? "export" : "import"
        }
      };

    } catch (error: any) {
      Logger.error(`Migration failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async exportData(): Promise<void> {
    Logger.section("EXPORTING DATA");

    const state: SystemState = {
      beacon: {
        address: await this.contracts.beacon.getAddress(),
        modules: {}
      },
      liquidityManager: {
        depositFee: 0,
        withdrawFee: 0
      },
      timestamp: Date.now()
    };

    // Export module addresses
    const modules = ["TokenManager", "ParameterManager", "ValueCalculator", "ProxyGeneral", "LiquidityManager", "SwapManager", "EmergencyHandler"];
    for (const module of modules) {
      const addr = await this.contracts.beacon.getImplementation(module);
      if (addr !== ethers.ZeroAddress) {
        state.beacon.modules[module] = addr;
      }
    }

    // Export LiquidityManager config
    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    if (liquidityManagerAddr !== ethers.ZeroAddress) {
      const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);
      state.liquidityManager.depositFee = Number(await liquidityManager.depositFee());
      state.liquidityManager.withdrawFee = Number(await liquidityManager.withdrawFee());
    }

    fs.writeFileSync(this.migrateOptions.exportFile!, JSON.stringify(state, null, 2));
    Logger.success(`Data exported to: ${this.migrateOptions.exportFile}`);
  }

  private async importData(): Promise<void> {
    Logger.section("IMPORTING DATA");
    Logger.warn("Import not yet implemented");
  }
}

// Execute script
if (require.main === module) {
  const script = new MigrateDataScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
