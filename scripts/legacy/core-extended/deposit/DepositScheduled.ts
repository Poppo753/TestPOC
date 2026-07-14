/**
 * ⏰ DEPOSIT SCHEDULED SCRIPT
 * Script per depositi programmati nel tempo
 * Derivato dai test di timing constraints e validazione temporale
 * Supporta scheduling, delays e conditional execution
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";
import { AMOUNTS } from "../../config/config";
import { TIME_CONSTANTS } from "../../config/constants";

export interface DepositScheduledOptions extends ScriptOptions {
  amount?: string; // Amount in ETH
  delayMs?: number; // Delay before execution in milliseconds
  targetTimestamp?: number; // Execute at specific timestamp
  maxRetries?: number; // Max retries if timing conditions not met
  retryDelayMs?: number; // Delay between retries
  conditions?: {
    minPoolValue?: string; // Execute only if pool value >= this
    maxPoolValue?: string; // Execute only if pool value <= this
    minUserBalance?: string; // Execute only if user has >= this balance
  };
}

export class DepositScheduledScript extends BaseScript {
  private depositAmount: bigint;
  private delayMs: number;
  private targetTimestamp?: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private conditions: {
    minPoolValue?: bigint;
    maxPoolValue?: bigint;
    minUserBalance?: bigint;
  };

  constructor(options: DepositScheduledOptions = {}) {
    super(options);
    
    this.depositAmount = ethers.parseEther(options.amount || "1.0");
    this.delayMs = options.delayMs || 0;
    this.targetTimestamp = options.targetTimestamp;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || TIME_CONSTANTS.RETRY_DELAY;
    
    // Parse conditions
    this.conditions = {
      minPoolValue: options.conditions?.minPoolValue ? ethers.parseEther(options.conditions.minPoolValue) : undefined,
      maxPoolValue: options.conditions?.maxPoolValue ? ethers.parseEther(options.conditions.maxPoolValue) : undefined,
      minUserBalance: options.conditions?.minUserBalance ? ethers.parseEther(options.conditions.minUserBalance) : undefined,
    };
  }

  protected getScriptName(): string {
    return "Deposit Scheduled";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    this.logScriptInfo("Scheduled deposit configuration", "⏰");
    this.logScriptInfo("Deposit amount", `${this.formatETH(this.depositAmount)} ETH`);
    
    if (this.delayMs > 0) {
      this.logScriptInfo("Execution delay", `${this.delayMs}ms`);
    }
    
    if (this.targetTimestamp) {
      const targetDate = new Date(this.targetTimestamp * 1000);
      this.logScriptInfo("Target timestamp", `${targetDate.toISOString()}`);
      
      // Check if target time is in the future
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (this.targetTimestamp <= currentTimestamp) {
        throw new Error(`Target timestamp ${this.targetTimestamp} is in the past (current: ${currentTimestamp})`);
      }
    }

    // Log conditions if any
    if (this.conditions.minPoolValue || this.conditions.maxPoolValue || this.conditions.minUserBalance) {
      this.logScriptInfo("Execution conditions", "📋");
      if (this.conditions.minPoolValue) {
        this.logScriptInfo("  Min pool value", `${this.formatETH(this.conditions.minPoolValue)} ETH`);
      }
      if (this.conditions.maxPoolValue) {
        this.logScriptInfo("  Max pool value", `${this.formatETH(this.conditions.maxPoolValue)} ETH`);
      }
      if (this.conditions.minUserBalance) {
        this.logScriptInfo("  Min user balance", `${this.formatETH(this.conditions.minUserBalance)} ETH`);
      }
    }

    // Basic validation (from test patterns)
    const minDeposit = AMOUNTS.SMALL_DEPOSIT;
    const maxDeposit = AMOUNTS.LARGE_DEPOSIT;
    
    if (this.depositAmount < minDeposit) {
      throw new Error(`Deposit too small: ${this.formatETH(this.depositAmount)} ETH < ${this.formatETH(minDeposit)} ETH`);
    }
    
    if (this.depositAmount > maxDeposit) {
      throw new Error(`Deposit too large: ${this.formatETH(this.depositAmount)} ETH > ${this.formatETH(maxDeposit)} ETH`);
    }

    this.logScriptSuccess("Scheduled deposit pre-checks passed");
  }

  protected async executeMain(): Promise<ScriptResult> {
    // Wait for scheduled time
    await this.waitForScheduledTime();
    
    // Execute with retries and condition checking
    let attempt = 1;
    let lastError: string | undefined;

    while (attempt <= this.maxRetries) {
      this.logScriptInfo(`Execution attempt ${attempt}/${this.maxRetries}`, "🎯");
      
      try {
        // Check execution conditions
        const conditionsResult = await this.checkExecutionConditions();
        if (!conditionsResult.canExecute) {
          throw new Error(`Conditions not met: ${conditionsResult.reason}`);
        }

        // Execute the deposit
        const result = await this.executeScheduledDeposit();
        
        if (result.success) {
          return result;
        } else {
          lastError = result.error;
          throw new Error(result.error || "Deposit failed");
        }

      } catch (error: any) {
        lastError = error.message;
        this.logScriptError(`Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < this.maxRetries) {
          this.logScriptInfo("Retry delay", `Waiting ${this.retryDelayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
        }
        
        attempt++;
      }
    }

    // All attempts failed
    return {
      success: false,
      error: `All ${this.maxRetries} attempts failed. Last error: ${lastError}`
    };
  }

  private async waitForScheduledTime(): Promise<void> {
    // Handle immediate delay
    if (this.delayMs > 0) {
      this.logScriptInfo("Waiting for delay", `${this.delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }

    // Handle target timestamp
    if (this.targetTimestamp) {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const remainingTime = this.targetTimestamp - currentTimestamp;
      
      if (remainingTime > 0) {
        const remainingMs = remainingTime * 1000;
        this.logScriptInfo("Waiting for target time", `${remainingTime}s (${remainingMs}ms)`);
        
        // For very long waits, log periodic updates
        if (remainingMs > 60000) { // > 1 minute
          const updateInterval = 30000; // 30 seconds
          let elapsed = 0;
          
          while (elapsed < remainingMs) {
            const waitTime = Math.min(updateInterval, remainingMs - elapsed);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            elapsed += waitTime;
            
            if (elapsed < remainingMs) {
              const remaining = Math.ceil((remainingMs - elapsed) / 1000);
              this.logScriptInfo("Still waiting", `${remaining}s remaining`);
            }
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, remainingMs));
        }
      }
      
      this.logScriptSuccess("Target time reached");
    }
  }

  private async checkExecutionConditions(): Promise<{ canExecute: boolean; reason?: string }> {
    try {
      // Check pool value conditions
      if (this.conditions.minPoolValue || this.conditions.maxPoolValue) {
        try {
          const poolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
          
          if (this.conditions.minPoolValue && poolValue < this.conditions.minPoolValue) {
            return {
              canExecute: false,
              reason: `Pool value ${this.formatETH(poolValue)} < required ${this.formatETH(this.conditions.minPoolValue)} ETH`
            };
          }
          
          if (this.conditions.maxPoolValue && poolValue > this.conditions.maxPoolValue) {
            return {
              canExecute: false,
              reason: `Pool value ${this.formatETH(poolValue)} > max allowed ${this.formatETH(this.conditions.maxPoolValue)} ETH`
            };
          }
          
          this.logScriptInfo("Pool value condition", `✅ ${this.formatETH(poolValue)} ETH`);
        } catch (error) {
          this.logScriptInfo("Pool value check", "⚠️ Could not verify (continuing)");
        }
      }

      // Check user balance condition
      if (this.conditions.minUserBalance) {
        const userBalance = await this.signer.provider.getBalance(this.signer.address);
        
        if (userBalance < this.conditions.minUserBalance) {
          return {
            canExecute: false,
            reason: `User balance ${this.formatETH(userBalance)} < required ${this.formatETH(this.conditions.minUserBalance)} ETH`
          };
        }
        
        this.logScriptInfo("User balance condition", `✅ ${this.formatETH(userBalance)} ETH`);
      }

      // Check basic user balance for deposit
      const userBalance = await this.signer.provider.getBalance(this.signer.address);
      if (userBalance < this.depositAmount) {
        return {
          canExecute: false,
          reason: `Insufficient balance: ${this.formatETH(userBalance)} < ${this.formatETH(this.depositAmount)} ETH`
        };
      }

      // Check if deposits are enabled
      try {
        const depositsEnabled = await this.contracts.liquidityManager.depositsEnabled();
        if (!depositsEnabled) {
          return {
            canExecute: false,
            reason: "Deposits are currently disabled"
          };
        }
      } catch (error) {
        this.logScriptInfo("Deposits status", "⚠️ Could not verify (continuing)");
      }

      return { canExecute: true };

    } catch (error: any) {
      return {
        canExecute: false,
        reason: `Condition check failed: ${error.message}`
      };
    }
  }

  private async executeScheduledDeposit(): Promise<ScriptResult> {
    this.logScriptInfo("Executing scheduled deposit", `${this.formatETH(this.depositAmount)} ETH`);

    const depositTx = this.contracts.liquidityManager.deposit({
      value: this.depositAmount,
      gasLimit: this.options.gasLimit
    });

    return await this.executeTransaction(
      depositTx,
      `Scheduled Deposit ${this.formatETH(this.depositAmount)} ETH`
    );
  }

  protected async customPostExecutionVerification(): Promise<void> {
    try {
      // Get post-deposit state
      const newUserLPBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
      this.logScriptInfo("New LP Balance", `${this.formatETH(newUserLPBalance)} LP`);
      
      // Log execution timing
      const executionTimestamp = Math.floor(Date.now() / 1000);
      this.logScriptInfo("Execution timestamp", executionTimestamp.toString());
      
      if (this.targetTimestamp) {
        const timingAccuracy = Math.abs(executionTimestamp - this.targetTimestamp);
        this.logScriptInfo("Timing accuracy", `±${timingAccuracy}s`);
      }

      // Verify pool state
      try {
        const newPoolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
        this.logScriptInfo("New Pool Value", `${this.formatETH(newPoolValue)} ETH`);
      } catch (error) {
        this.logScriptInfo("Pool value check", "⚠️ Could not fetch (non-critical)");
      }

    } catch (error: any) {
      this.logScriptError(`Post-execution verification error: ${error.message}`);
    }
  }

  protected async finalize(result: ScriptResult): Promise<void> {
    if (result.success) {
      this.logScriptSuccess("Scheduled deposit completed successfully!");
      this.logScriptInfo("Transaction", `${result.transactionHash}`);
      
      if (this.targetTimestamp) {
        const executionTime = Math.floor(Date.now() / 1000);
        const timingDiff = executionTime - this.targetTimestamp;
        this.logScriptInfo("Timing precision", `${timingDiff}s from target`);
      }
    } else {
      this.logScriptError("Scheduled deposit failed!");
      this.logScriptError(`Error: ${result.error}`);
    }
  }
}

// Standalone execution when run directly
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const amount = args.find(arg => arg.startsWith('--amount='))?.split('=')[1];
  const delayArg = args.find(arg => arg.startsWith('--delay='))?.split('=')[1];
  const targetArg = args.find(arg => arg.startsWith('--target='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  const options: DepositScheduledOptions = {
    amount,
    delayMs: delayArg ? parseInt(delayArg) : undefined,
    targetTimestamp: targetArg ? parseInt(targetArg) : undefined,
    dryRun,
    verbose: verbose || process.env.VERBOSE_LOGGING === "true"
  };

  const scheduledScript = new DepositScheduledScript(options);
  const result = await scheduledScript.execute();
  
  process.exit(result.success ? 0 : 1);
}

// Execute if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Scheduled script failed:", error);
    process.exit(1);
  });
}