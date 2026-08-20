/**
 * 🔄 DEPOSIT BATCH SCRIPT
 * Script per eseguire depositi multipli in batch
 * Derivato dai test di concurrent operations e stress testing
 * Ottimizzato per performance e gas efficiency
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";
import { AMOUNTS } from "../../config/config";
import { TIME_CONSTANTS } from "../../config/constants";

export interface DepositBatchOptions extends ScriptOptions {
  amounts?: string[]; // Array of amounts in ETH (e.g., ["1.0", "2.0", "0.5"])
  batchSize?: number; // Number of deposits to process in parallel
  delayBetweenBatches?: number; // Delay in ms between batches
  users?: string[]; // Optional: different users for each deposit
}

export class DepositBatchScript extends BaseScript {
  private depositAmounts: bigint[];
  private batchSize: number;
  private delayBetweenBatches: number;
  private userAddresses: string[];

  constructor(options: DepositBatchOptions = {}) {
    super(options);
    
    // Parse deposit amounts from options or use defaults
    const amounts = options.amounts || ["1.0", "1.0", "1.0"]; // 3 deposits of 1 ETH each
    this.depositAmounts = amounts.map(amount => ethers.parseEther(amount));
    
    this.batchSize = options.batchSize || 3; // Process 3 deposits at a time
    this.delayBetweenBatches = options.delayBetweenBatches || TIME_CONSTANTS.BATCH_DELAY;
    this.userAddresses = options.users || [];
  }

  protected getScriptName(): string {
    return "Deposit Batch";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    this.logScriptInfo("Batch configuration", `${this.depositAmounts.length} deposits`);
    this.logScriptInfo("Batch size", `${this.batchSize} concurrent operations`);
    this.logScriptInfo("Delay between batches", `${this.delayBetweenBatches}ms`);
    
    // Calculate total deposit amount
    const totalAmount = this.depositAmounts.reduce((sum, amount) => sum + amount, 0n);
    this.logScriptInfo("Total deposit amount", `${this.formatETH(totalAmount)} ETH`);
    
    // Check user balance for total amount
    const userBalance = await this.signer.provider.getBalance(this.signer.address);
    if (userBalance < totalAmount) {
      throw new Error(`Insufficient balance for batch. Required: ${this.formatETH(totalAmount)} ETH, Available: ${this.formatETH(userBalance)} ETH`);
    }

    // Validate each deposit amount (from test patterns)
    const minDeposit = AMOUNTS.SMALL_DEPOSIT;
    const maxDeposit = AMOUNTS.LARGE_DEPOSIT;
    
    for (let i = 0; i < this.depositAmounts.length; i++) {
      const amount = this.depositAmounts[i];
      if (amount < minDeposit) {
        throw new Error(`Deposit ${i+1} too small: ${this.formatETH(amount)} ETH < ${this.formatETH(minDeposit)} ETH`);
      }
      if (amount > maxDeposit) {
        throw new Error(`Deposit ${i+1} too large: ${this.formatETH(amount)} ETH > ${this.formatETH(maxDeposit)} ETH`);
      }
    }

    // Check deposits are enabled
    try {
      const depositsEnabled = await this.contracts.liquidityManager.depositsEnabled();
      if (!depositsEnabled) {
        throw new Error("Deposits are currently disabled");
      }
    } catch (error) {
      this.logScriptInfo("Deposits status", "⚠️ Could not verify (continuing)");
    }

    this.logScriptSuccess("Batch pre-execution checks passed");
  }

  protected async executeMain(): Promise<ScriptResult> {
    this.logScriptInfo("Starting batch deposit execution", "🚀");
    
    // Split deposits into batches
    const batches = this.createBatches();
    
    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalGasUsed = 0n;
    const transactionHashes: string[] = [];
    const errors: string[] = [];

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      this.logScriptInfo(`Processing batch ${batchIndex + 1}/${batches.length}`, `${batch.length} deposits`);

      try {
        // Execute batch concurrently (from concurrent test patterns)
        const batchResults = await this.executeBatch(batch, batchIndex);
        
        // Process results
        for (const result of batchResults) {
          totalProcessed++;
          if (result.success) {
            totalSuccessful++;
            if (result.gasUsed) totalGasUsed += result.gasUsed;
            if (result.transactionHash) transactionHashes.push(result.transactionHash);
          } else {
            errors.push(result.error || "Unknown error");
          }
        }

        // Delay between batches (except for last batch)
        if (batchIndex < batches.length - 1) {
          this.logScriptInfo("Batch delay", `Waiting ${this.delayBetweenBatches}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
        }

      } catch (error: any) {
        this.logScriptError(`Batch ${batchIndex + 1} failed: ${error.message}`);
        errors.push(`Batch ${batchIndex + 1}: ${error.message}`);
      }
    }

    // Return summary result
    const success = totalSuccessful > 0;
    const successRate = totalProcessed > 0 ? (totalSuccessful / totalProcessed * 100).toFixed(2) : "0";
    
    return {
      success,
      gasUsed: totalGasUsed,
      result: {
        totalProcessed,
        totalSuccessful,
        successRate: `${successRate}%`,
        transactionHashes,
        errors
      }
    };
  }

  private createBatches(): { amount: bigint; index: number }[][] {
    const batches: { amount: bigint; index: number }[][] = [];
    
    for (let i = 0; i < this.depositAmounts.length; i += this.batchSize) {
      const batch = this.depositAmounts
        .slice(i, i + this.batchSize)
        .map((amount, localIndex) => ({
          amount,
          index: i + localIndex
        }));
      batches.push(batch);
    }
    
    return batches;
  }

  private async executeBatch(batch: { amount: bigint; index: number }[], batchIndex: number): Promise<ScriptResult[]> {
    // Create deposit promises (from concurrent test pattern)
    const depositPromises = batch.map((deposit) => 
      this.executeSingleDeposit(deposit.amount, deposit.index)
    );

    // Execute all deposits in batch concurrently
    const startTime = Date.now();
    const results = await Promise.allSettled(depositPromises);
    const endTime = Date.now();

    this.logScriptInfo(`Batch ${batchIndex + 1} execution time`, `${endTime - startTime}ms`);

    // Process settled results
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: `Deposit ${batch[index].index + 1}: ${result.reason.message || result.reason}`
        };
      }
    });
  }

  private async executeSingleDeposit(amount: bigint, index: number): Promise<ScriptResult> {
    try {
      this.logScriptInfo(`Executing deposit ${index + 1}`, `${this.formatETH(amount)} ETH`);

      const tx = await this.contracts.liquidityManager.deposit({
        value: amount,
        gasLimit: this.options.gasLimit
      });

      const receipt = await tx.wait(this.options.confirmations);
      
      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt?.blockNumber,
        gasUsed: receipt?.gasUsed || 0n
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  protected async customPostExecutionVerification(): Promise<void> {
    try {
      // Get final user LP balance
      const finalLPBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
      this.logScriptInfo("Final LP Balance", `${this.formatETH(finalLPBalance)} LP`);
      
      // Get final pool state
      try {
        const finalPoolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
        this.logScriptInfo("Final Pool Value", `${this.formatETH(finalPoolValue)} ETH`);
      } catch (error) {
        this.logScriptInfo("Pool value check", "⚠️ Could not fetch (non-critical)");
      }

      // Calculate efficiency metrics (from stress test patterns)
      const totalAmount = this.depositAmounts.reduce((sum, amount) => sum + amount, 0n);
      this.logScriptInfo("Total deposited", `${this.formatETH(totalAmount)} ETH`);

    } catch (error: any) {
      this.logScriptError(`Post-execution verification error: ${error.message}`);
    }
  }

  protected async finalize(result: ScriptResult): Promise<void> {
    if (result.success && result.result) {
      const summary = result.result;
      this.logScriptSuccess("Batch deposit completed!");
      this.logScriptInfo("Summary", "📊");
      this.logScriptInfo("  Processed", `${summary.totalProcessed} deposits`);
      this.logScriptInfo("  Successful", `${summary.totalSuccessful} deposits`);
      this.logScriptInfo("  Success rate", summary.successRate);
      this.logScriptInfo("  Gas used", result.gasUsed?.toString() || "N/A");
      
      if (summary.transactionHashes.length > 0) {
        this.logScriptInfo("Transaction hashes", "📝");
        summary.transactionHashes.forEach((hash: string, index: number) => {
          this.logScriptInfo(`  Deposit ${index + 1}`, hash);
        });
      }

      if (summary.errors.length > 0) {
        this.logScriptError("Errors encountered:");
        summary.errors.forEach((error: string) => this.logScriptError(`  ${error}`));
      }
    } else {
      this.logScriptError("Batch deposit failed!");
      this.logScriptError(`Error: ${result.error}`);
    }
  }
}

// Standalone execution when run directly
async function main() {
  const args = process.argv.slice(2);
  
  // Parse amounts: --amounts=1.0,2.0,0.5
  const amountsArg = args.find(arg => arg.startsWith('--amounts='))?.split('=')[1];
  const amounts = amountsArg ? amountsArg.split(',') : undefined;
  
  // Parse batch size: --batch-size=3
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1];
  const batchSize = batchSizeArg ? parseInt(batchSizeArg) : undefined;
  
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  const options: DepositBatchOptions = {
    amounts,
    batchSize,
    dryRun,
    verbose: verbose || process.env.VERBOSE_LOGGING === "true"
  };

  const batchScript = new DepositBatchScript(options);
  const result = await batchScript.execute();
  
  process.exit(result.success ? 0 : 1);
}

// Execute if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Batch script failed:", error);
    process.exit(1);
  });
}