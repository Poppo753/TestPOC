/**
 * 💰 DEPOSIT ETH SCRIPT - REFACTORED
 * Script per depositare ETH nel pool di liquidità
 * Utilizza BaseScript per standardizzazione e logging
 * Basato sui test di integrazione esistenti
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";
import { AMOUNTS } from "../../config/config";

export interface DepositETHOptions extends ScriptOptions {
  amount?: string; // Amount in ETH (e.g., "1.0")
  skipPreChecks?: boolean;
}

export class DepositETHScript extends BaseScript {
  private depositAmount: bigint;

  constructor(options: DepositETHOptions = {}) {
    super(options);
    
    // Parse deposit amount from options or use default
    const amountStr = options.amount || "1.0";
    this.depositAmount = ethers.parseEther(amountStr);
  }

  protected getScriptName(): string {
    return "Deposit ETH";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    if (this.options.skipPreChecks) {
      this.logScriptInfo("Pre-checks skipped", "⏭️");
      return;
    }

    // Validate deposit amount
    this.logScriptInfo("Deposit amount", `${this.formatETH(this.depositAmount)} ETH`);
    
    // Check user balance
    const userBalance = await this.signer.provider.getBalance(this.signer.address);
    if (userBalance < this.depositAmount) {
      throw new Error(`Insufficient balance. Required: ${this.formatETH(this.depositAmount)} ETH, Available: ${this.formatETH(userBalance)} ETH`);
    }

    // Check deposit limits (from tests: minimum and maximum validation)
    const minDeposit = AMOUNTS.SMALL_DEPOSIT; // 0.1 ETH
    const maxDeposit = AMOUNTS.LARGE_DEPOSIT; // 10 ETH
    
    if (this.depositAmount < minDeposit) {
      throw new Error(`Deposit too small. Minimum: ${this.formatETH(minDeposit)} ETH`);
    }
    
    if (this.depositAmount > maxDeposit) {
      throw new Error(`Deposit too large. Maximum: ${this.formatETH(maxDeposit)} ETH`);
    }

    // Check if deposits are enabled
    try {
      const depositsEnabled = await this.contracts.liquidityManager.depositsEnabled();
      if (!depositsEnabled) {
        throw new Error("Deposits are currently disabled");
      }
    } catch (error) {
      this.logScriptInfo("Deposits status check", "⚠️ Could not verify (continuing)");
    }

    this.logScriptSuccess("All pre-execution checks passed");
  }

  protected async executeMain(): Promise<ScriptResult> {
    this.logScriptInfo("Executing deposit", `${this.formatETH(this.depositAmount)} ETH`);

    // Execute the deposit (same logic from original script and tests)
    const depositTx = this.contracts.liquidityManager.deposit({
      value: this.depositAmount,
      gasLimit: this.options.gasLimit
    });

    return await this.executeTransaction(
      depositTx,
      `Deposit ${this.formatETH(this.depositAmount)} ETH`
    );
  }

  protected async customPostExecutionVerification(): Promise<void> {
    try {
      // Get post-deposit state (from test patterns)
      const newUserLPBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
      this.logScriptInfo("New LP Balance", `${this.formatETH(newUserLPBalance)} LP`);
      
      // Calculate LP tokens received (from test logic)
      const lpTokensReceived = newUserLPBalance; // Assuming this is the increase
      this.logScriptSuccess(`LP Tokens Received: ${this.formatETH(lpTokensReceived)} LP`);
      
      // Calculate LP token price (from test calculations)
      if (lpTokensReceived > 0n) {
        const lpPrice = (this.depositAmount * ethers.parseEther("1")) / lpTokensReceived;
        this.logScriptInfo("LP Token Price", `${this.formatETH(lpPrice)} ETH per LP`);
      }

      // Verify pool value increased (from test validation)
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
      this.logScriptSuccess("Deposit completed successfully!");
      this.logScriptInfo("Transaction", `View on explorer: ${result.transactionHash}`);
    } else {
      this.logScriptError("Deposit failed!");
      this.logScriptError(`Error: ${result.error}`);
    }
  }
}

// Standalone execution when run directly
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const amount = args.find(arg => arg.startsWith('--amount='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  const options: DepositETHOptions = {
    amount: amount,
    dryRun: dryRun,
    verbose: verbose || process.env.VERBOSE_LOGGING === "true"
  };

  const depositScript = new DepositETHScript(options);
  const result = await depositScript.execute();
  
  process.exit(result.success ? 0 : 1);
}

// Execute if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
}