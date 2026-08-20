// SPDX-License-Identifier: MIT
/**
 * @title EmergencyPause
 * @dev Script per pause sistema in emergency
 * 
 * Basato su pattern da:
 * - test/integration/Emergency.integration.test.ts (activateEmergency, righe 164-203)
 * - EmergencyHandler.sol (activateEmergency function)
 * 
 * CLI Usage:
 *   npx hardhat run scripts/emergency/EmergencyPause.ts --network <network>
 *   --reason="<reason>"             (emergency reason, required)
 *   --notify-contacts               (notify emergency contacts)
 *   --severity=<1-5>                (severity level, default: 5)
 * 
 * Examples:
 *   npx hardhat run scripts/emergency/EmergencyPause.ts --network localhost --reason="Security breach detected"
 *   npx hardhat run scripts/emergency/EmergencyPause.ts --network localhost --reason="Price oracle failure" --severity=4
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";

interface PauseOptions {
  reason: string;
  notifyContacts: boolean;
  severity: number;
}

export class EmergencyPauseScript extends BaseScript {
  private pauseOptions: PauseOptions;
  
  constructor() {
    super();
    this.pauseOptions = this.parseOptions();
  }

  protected getScriptName(): string {
    return "EmergencyPause";
  }

  private parseOptions(): PauseOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string, defaultValue: string = ""): string => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : defaultValue;
    };
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    return {
      reason: getArg("reason"),
      notifyContacts: hasFlag("notify-contacts"),
      severity: parseInt(getArg("severity", "5"))
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("🚨 EMERGENCY PAUSE ACTIVATION");
    
    if (!this.pauseOptions.reason) {
      throw new Error("Emergency reason required. Use --reason=\"your reason\"");
    }

    Logger.warn(`Reason: ${this.pauseOptions.reason}`);
    Logger.warn(`Severity: ${this.pauseOptions.severity}/5`);

    try {
      const emergencyHandlerAddr = await this.contracts.beacon.getImplementation("EmergencyHandler");
      const emergencyHandler = await ethers.getContractAt("EmergencyHandler", emergencyHandlerAddr);

      // Check current state
      const stats = await emergencyHandler.getEmergencyStats();
      if (stats.isPaused) {
        Logger.warn("System already paused!");
        return {
          success: false,
          error: "System already in emergency mode"
        };
      }

      Logger.info("Activating emergency pause...");
      
      // Pattern: emergencyHandler.activateEmergency(reason)
      const tx = await emergencyHandler.activateEmergency(this.pauseOptions.reason);
      const receipt = await tx.wait();

      Logger.success(`Emergency activated!`);
      Logger.info(`Transaction: ${receipt?.hash}`);
      Logger.info(`Gas Used: ${receipt?.gasUsed.toString()}`);

      // Verify pause
      const finalStats = await emergencyHandler.getEmergencyStats();
      Logger.info(`System Paused: ${finalStats.isPaused ? "YES ✅" : "NO ❌"}`);

      if (this.pauseOptions.notifyContacts) {
        Logger.info("Emergency contacts notification would be sent here");
      }

      return {
        success: true,
        data: {
          reason: this.pauseOptions.reason,
          txHash: receipt?.hash,
          isPaused: finalStats.isPaused
        }
      };

    } catch (error: any) {
      Logger.error(`Failed to activate emergency: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

if (require.main === module) {
  const script = new EmergencyPauseScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
