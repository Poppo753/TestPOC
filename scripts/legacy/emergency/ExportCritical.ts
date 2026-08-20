// SPDX-License-Identifier: MIT
/**
 * @title ExportCritical
 * @dev Script per export dati critici only
 * 
 * CLI Usage:
 *   npx hardhat run scripts/emergency/ExportCritical.ts --network <network>
 *   --format=<json|csv>
 *   --users-only
 *   --assets-only
 *   --output=<file>
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";
import * as fs from "fs";

interface ExportOptions {
  format: "json" | "csv";
  usersOnly: boolean;
  assetsOnly: boolean;
  outputFile: string;
}

export class ExportCriticalScript extends BaseScript {
  private exportOptions: ExportOptions;
  
  constructor() {
    super();
    this.exportOptions = this.parseOptions();
  }

  protected getScriptName(): string {
    return "ExportCritical";
  }

  private parseOptions(): ExportOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string, defaultValue: string = ""): string => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : defaultValue;
    };
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    return {
      format: (getArg("format", "json") as "json" | "csv"),
      usersOnly: hasFlag("users-only"),
      assetsOnly: hasFlag("assets-only"),
      outputFile: getArg("output", `critical_export_${Date.now()}.json`)
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("📤 CRITICAL DATA EXPORT");
    
    try {
      const proxyAddr = await this.contracts.beacon.getImplementation("ProxyGeneral");
      const proxy = await ethers.getContractAt("ProxyGeneral", proxyAddr);

      const emergencyHandlerAddr = await this.contracts.beacon.getImplementation("EmergencyHandler");
      const emergencyHandler = await ethers.getContractAt("EmergencyHandler", emergencyHandlerAddr);

      const criticalData: any = {
        timestamp: Date.now(),
        format: this.exportOptions.format
      };

      // Export users data
      if (this.exportOptions.usersOnly || !this.exportOptions.assetsOnly) {
        Logger.info("Collecting user data...");
        const totalSupply = await proxy.totalSupply();
        criticalData.users = {
          totalLPSupply: ethers.formatEther(totalSupply)
          // Note: Actual user balances would require event log scanning
        };
      }

      // Export assets data
      if (this.exportOptions.assetsOnly || !this.exportOptions.usersOnly) {
        Logger.info("Collecting assets data...");
        const health = await emergencyHandler.getSystemHealthStatus();
        criticalData.assets = {
          totalValue: ethers.formatEther(health.totalValue),
          isPaused: health.isPaused
        };
      }

      // Export
      if (this.exportOptions.format === "json") {
        fs.writeFileSync(this.exportOptions.outputFile, JSON.stringify(criticalData, null, 2));
      } else {
        // Simple CSV export
        const csv = Object.entries(criticalData).map(([k, v]) => `${k},${JSON.stringify(v)}`).join("\n");
        fs.writeFileSync(this.exportOptions.outputFile, csv);
      }

      Logger.success(`Critical data exported to: ${this.exportOptions.outputFile}`);

      return {
        success: true,
        data: { exportFile: this.exportOptions.outputFile }
      };

    } catch (error: any) {
      Logger.error(`Export failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

if (require.main === module) {
  const script = new ExportCriticalScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
