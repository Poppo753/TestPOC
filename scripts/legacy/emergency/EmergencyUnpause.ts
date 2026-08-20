// SPDX-License-Identifier: MIT
/**
 * @title EmergencyUnpause
 * @dev Script per unpause sistema dopo emergency
 * 
 * Basato su pattern da:
 * - test/integration/Emergency.integration.test.ts
 * - EmergencyHandler.sol (emergencyUnpause, can Unpause)
 * 
 * CLI Usage:
 *   npx hardhat run scripts/emergency/EmergencyUnpause.ts --network <network>
 *   --force                        (skip safety checks)
 *   --skip-checks                  (skip cooldown verification)
 *   --validate-state               (validate system state before unpause)
 * 
 * Examples:
 *   npx hardhat run scripts/emergency/EmergencyUnpause.ts --network localhost --validate-state
 *   npx hardhat run scripts/emergency/EmergencyUnpause.ts --network localhost --force
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";

interface UnpauseOptions {
  force: boolean;
  skipChecks: boolean;
  validateState: boolean;
}

export class EmergencyUnpauseScript extends BaseScript {
  private unpauseOptions: UnpauseOptions;
  
  constructor() {
    super();
    this.unpauseOptions = this.parseOptions();
  }

  protected getScriptName(): string {
    return "EmergencyUnpause";
  }

  private parseOptions(): UnpauseOptions {
    const args = process.argv.slice(2);
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    return {
      force: hasFlag("force"),
      skipChecks: hasFlag("skip-checks"),
      validateState: hasFlag("validate-state")
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("🟢 EMERGENCY UNPAUSE");
    
    try {
      const emergencyHandlerAddr = await this.contracts.beacon.getImplementation("EmergencyHandler");
      const emergencyHandler = await ethers.getContractAt("EmergencyHandler", emergencyHandlerAddr);

      // Check current state
      const stats = await emergencyHandler.getEmergencyStats();
      if (!stats.isPaused) {
        Logger.info("System not paused - nothing to do");
        return {
          success: true,
          data: { message: "System already active" }
        };
      }

      // Safety checks
      if (!this.unpauseOptions.skipChecks && !this.unpauseOptions.force) {
        Logger.section("SAFETY CHECKS");
        
        const canUnpause = await emergencyHandler.canUnpause();
        Logger.info(`Can Unpause: ${canUnpause.canUnpause ? "YES" : "NO"}`);
        Logger.info(`Reason: ${canUnpause.reason}`);

        if (!canUnpause.canUnpause) {
          throw new Error(`Cannot unpause: ${canUnpause.reason}. Use --force to override.`);
        }
      }

      // Validate state if requested
      if (this.unpauseOptions.validateState) {
        Logger.section("STATE VALIDATION");
        const health = await emergencyHandler.getSystemHealthStatus();
        Logger.info(`Total Value: ${ethers.formatEther(health.totalValue)} ETH`);
        Logger.info(`LP Supply: ${ethers.formatEther(health.lpSupply)} LP`);
      }

      Logger.info("Unpausing system...");
      
      const tx = await emergencyHandler.emergencyUnpause();
      const receipt = await tx.wait();

      Logger.success("System unpaused!");
      Logger.info(`Transaction: ${receipt?.hash}`);
      Logger.info(`Gas Used: ${receipt?.gasUsed.toString()}`);

      const finalStats = await emergencyHandler.getEmergencyStats();
      Logger.info(`System Paused: ${finalStats.isPaused ? "YES" : "NO ✅"}`);

      return {
        success: true,
        data: {
          txHash: receipt?.hash,
          isPaused: finalStats.isPaused
        }
      };

    } catch (error: any) {
      Logger.error(`Failed to unpause: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

if (require.main === module) {
  const script = new EmergencyUnpauseScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
