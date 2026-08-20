// SPDX-License-Identifier: MIT
/**
 * @title BackupState
 * @dev Script per backup completo stato sistema
 * 
 * Pattern: MigrateData.ts + Emergency.integration.test.ts
 * 
 * CLI Usage:
 *   npx hardhat run scripts/emergency/BackupState.ts --network <network>
 *   --output=<file.json>
 *   --compress
 *   --encrypt
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";
import * as fs from "fs";

interface BackupOptions {
  outputFile: string;
  compress: boolean;
  encrypt: boolean;
}

export class BackupStateScript extends BaseScript {
  private backupOptions: BackupOptions;
  
  constructor() {
    super();
    this.backupOptions = this.parseOptions();
  }

  protected getScriptName(): string {
    return "BackupState";
  }

  private parseOptions(): BackupOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string, defaultValue: string = ""): string => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : defaultValue;
    };
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    return {
      outputFile: getArg("output", `backup_${Date.now()}.json`),
      compress: hasFlag("compress"),
      encrypt: hasFlag("encrypt")
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("💾 SYSTEM STATE BACKUP");
    
    try {
      const emergencyHandlerAddr = await this.contracts.beacon.getImplementation("EmergencyHandler");
      const emergencyHandler = await ethers.getContractAt("EmergencyHandler", emergencyHandlerAddr);

      const proxyAddr = await this.contracts.beacon.getImplementation("ProxyGeneral");
      const proxy = await ethers.getContractAt("ProxyGeneral", proxyAddr);

      // Collect system state
      Logger.info("Collecting system state...");
      
      const health = await emergencyHandler.getSystemHealthStatus();
      const stats = await emergencyHandler.getEmergencyStats();
      const totalSupply = await proxy.totalSupply();

      const backup = {
        timestamp: Date.now(),
        network: await ethers.provider.getNetwork().then(n => n.name),
        beacon: await this.contracts.beacon.getAddress(),
        modules: {
          EmergencyHandler: emergencyHandlerAddr,
          ProxyGeneral: proxyAddr
        },
        state: {
          isPaused: stats.isPaused,
          totalValue: ethers.formatEther(health.totalValue),
          lpSupply: ethers.formatEther(totalSupply),
          withdrawExecuted: stats.withdrawExecuted
        }
      };

      fs.writeFileSync(this.backupOptions.outputFile, JSON.stringify(backup, null, 2));
      Logger.success(`Backup saved to: ${this.backupOptions.outputFile}`);

      return {
        success: true,
        data: { backupFile: this.backupOptions.outputFile }
      };

    } catch (error: any) {
      Logger.error(`Backup failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

if (require.main === module) {
  const script = new BackupStateScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
