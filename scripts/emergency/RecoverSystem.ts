// SPDX-License-Identifier: MIT
/**
 * @title RecoverSystem
 * @dev Script per full system state recovery e health check
 * 
 * Basato su pattern da:
 * - EmergencyHandler.sol (getSystemHealthStatus, generateEmergencyReport)
 * - test/integration/Emergency.integration.test.ts
 * 
 * Funzionalità:
 * 1. System Health Check: Verifica completa stato sistema
 * 2. Automatic Recovery: Tentativo recovery automatico
 * 3. Emergency Report: Generazione report dettagliato
 * 4. State Snapshot: Snapshot completo dello stato
 * 
 * CLI Usage:
 *   npx hardhat run scripts/emergency/RecoverSystem.ts --network <network>
 *   --check-health                 (esegui health check)
 *   --auto-recover                 (tentativo recovery automatico)
 *   --report                       (genera emergency report)
 *   --export=<file.json>           (esporta report a file)
 * 
 * Examples:
 *   npx hardhat run scripts/emergency/RecoverSystem.ts --network localhost --check-health
 *   npx hardhat run scripts/emergency/RecoverSystem.ts --network localhost --auto-recover --report
 *   npx hardhat run scripts/emergency/RecoverSystem.ts --network localhost --report --export=emergency_report.json
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";
import * as fs from "fs";

interface RecoverSystemOptions {
  checkHealth: boolean;
  autoRecover: boolean;
  report: boolean;
  exportFile?: string;
}

/**
 * @notice Script per system recovery
 * @dev Pattern: EmergencyHandler.getSystemHealthStatus()
 */
export class RecoverSystemScript extends BaseScript {
  private recoveryOptions: RecoverSystemOptions;
  
  constructor() {
    super();
    this.recoveryOptions = this.parseOptions();
  }

  protected getScriptName(): string {
    return "RecoverSystem";
  }

  private parseOptions(): RecoverSystemOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string): string | undefined => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : undefined;
    };
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    return {
      checkHealth: hasFlag("check-health"),
      autoRecover: hasFlag("auto-recover"),
      report: hasFlag("report"),
      exportFile: getArg("export")
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("SYSTEM RECOVERY");
    
    try {
      const emergencyHandlerAddr = await this.contracts.beacon.getImplementation("EmergencyHandler");
      const emergencyHandler = await ethers.getContractAt("EmergencyHandler", emergencyHandlerAddr);

      let healthStatus: any;
      let emergencyReport: any;

      // Step 1: Health Check
      if (this.recoveryOptions.checkHealth) {
        Logger.section("HEALTH CHECK");
        healthStatus = await emergencyHandler.getSystemHealthStatus();
        
        Logger.info(`System Paused: ${healthStatus.isPaused ? "YES" : "NO"}`);
        Logger.info(`Total Value: ${ethers.formatEther(healthStatus.totalValue)} ETH`);
        Logger.info(`LP Supply: ${ethers.formatEther(healthStatus.lpSupply)} LP`);
        // Note: getSystemHealthStatus() returns (isPaused, totalValue, lpSupply, activeTokens)
        // NOT totalSupply - the correct property name is lpSupply
      }

      // Step 2: Get Emergency Report
      if (this.recoveryOptions.report) {
        Logger.section("RETRIEVING EMERGENCY REPORT");
        // Use getLastEmergencyReport() (view function) instead of generateEmergencyReport() (transaction)
        // generateEmergencyReport() modifies state and costs gas - only use when generating a NEW report
        emergencyReport = await emergencyHandler.getLastEmergencyReport();
        
        Logger.success("Emergency Report Retrieved");
        
        // Use 'any' type workaround for struct property access (same as IncidentReport.ts)
        const reportObj = emergencyReport as any;
        Logger.info(JSON.stringify(reportObj, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value, 2
        ));

        if (this.recoveryOptions.exportFile) {
          const reportData = {
            report: JSON.parse(JSON.stringify(reportObj, (key, value) => 
              typeof value === 'bigint' ? value.toString() : value
            )),
            retrievedAt: new Date().toISOString()
          };
          
          fs.writeFileSync(this.recoveryOptions.exportFile, JSON.stringify(reportData, null, 2));
          Logger.success(`Report exported to: ${this.recoveryOptions.exportFile}`);
        }
      }

      // Step 3: Auto Recovery
      if (this.recoveryOptions.autoRecover) {
        Logger.section("ATTEMPTING AUTO RECOVERY");
        Logger.warn("Auto recovery not yet implemented");
      }

      return {
        success: true,
        data: {
          healthStatus,
          emergencyReport
        }
      };

    } catch (error: any) {
      Logger.error(`System recovery failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

if (require.main === module) {
  const script = new RecoverSystemScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
