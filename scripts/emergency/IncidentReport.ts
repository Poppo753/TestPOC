// SPDX-License-Identifier: MIT
/**
 * @title IncidentReport
 * @dev Script per generare report dettagliato incidente
 * 
 * Basato su pattern da:
 * - EmergencyHandler.sol (generateEmergencyReport, getLastEmergencyReport)
 * 
 * CLI Usage:
 *   npx hardhat run scripts/emergency/IncidentReport.ts --network <network>
 *   --export=<file.json>           (esporta report a file)
 *   --include-events               (includi eventi blockchain)
 *   --time-range=<hours>           (time range per eventi, default: 24)
 * 
 * Examples:
 *   npx hardhat run scripts/emergency/IncidentReport.ts --network localhost --export=incident.json
 *   npx hardhat run scripts/emergency/IncidentReport.ts --network localhost --include-events --time-range=48
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";
import * as fs from "fs";

interface ReportOptions {
  exportFile?: string;
  includeEvents: boolean;
  timeRange: number;
}

export class IncidentReportScript extends BaseScript {
  private reportOptions: ReportOptions;
  
  constructor() {
    super();
    this.reportOptions = this.parseOptions();
  }

  protected getScriptName(): string {
    return "IncidentReport";
  }

  private parseOptions(): ReportOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string, defaultValue: string = ""): string => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : defaultValue;
    };
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    return {
      exportFile: getArg("export") || undefined,
      includeEvents: hasFlag("include-events"),
      timeRange: parseInt(getArg("time-range", "24"))
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("📋 INCIDENT REPORT GENERATION");
    
    try {
      const emergencyHandlerAddr = await this.contracts.beacon.getImplementation("EmergencyHandler");
      const emergencyHandler = await ethers.getContractAt("EmergencyHandler", emergencyHandlerAddr);

      // Get last report (view function)
      Logger.info("Retrieving last emergency report...");
      const report = await emergencyHandler.getLastEmergencyReport();

      Logger.section("EMERGENCY REPORT");
      // Use the struct properties as they are defined
      const reportObj = report as any; // Type workaround
      Logger.info(`Report exists: ${reportObj ? "YES" : "NO"}`);
      
      // Log whatever properties exist
      Logger.info(JSON.stringify(reportObj, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value, 2
      ));

      // Export if requested
      if (this.reportOptions.exportFile) {
        const reportData = {
          report: JSON.parse(JSON.stringify(reportObj, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value
          )),
          generatedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(this.reportOptions.exportFile, JSON.stringify(reportData, null, 2));
        Logger.success(`Report exported to: ${this.reportOptions.exportFile}`);
      }

      return {
        success: true,
        data: { report: reportObj }
      };

    } catch (error: any) {
      Logger.error(`Report generation failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

if (require.main === module) {
  const script = new IncidentReportScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
