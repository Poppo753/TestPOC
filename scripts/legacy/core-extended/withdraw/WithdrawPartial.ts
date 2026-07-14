/**
 * 🎯 WITHDRAW PARTIAL SCRIPT
 * Script per withdrawal parziali strategici con logica business avanzata
 * Derivato dai test di concurrent operations e stress testing
 * Supporta multiple strategies: dollar-cost averaging, liquidity preservation, profit taking
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";
import { AMOUNTS } from "../../config/config";

export interface WithdrawPartialOptions extends ScriptOptions {
  strategy?: "percentage" | "target-amount" | "preserve-liquidity" | "profit-taking" | "dca-out";
  amount?: string; // Amount in LP tokens for target-amount strategy
  percentage?: number; // Percentage for percentage strategy (1-99)
  targetValue?: string; // Target pool value to maintain for preserve-liquidity
  profitThreshold?: number; // Minimum profit % for profit-taking (1-100)
  dcaIntervals?: number; // Number of intervals for DCA-out strategy
  dcaDelayMs?: number; // Delay between DCA intervals in milliseconds
  preservePercentage?: number; // % of liquidity to preserve (10-90)
  slippageProtection?: boolean; // Enable slippage protection
  maxSlippage?: number; // Max slippage in basis points
}

export class WithdrawPartialScript extends BaseScript {
  private strategy: string;
  private amount?: bigint;
  private percentage?: number;
  private targetValue?: bigint;
  private profitThreshold?: number;
  private dcaIntervals: number;
  private dcaDelayMs: number;
  private preservePercentage: number;
  private slippageProtection: boolean;
  private maxSlippage: number;

  constructor(options: WithdrawPartialOptions = {}) {
    super(options);
    
    this.strategy = options.strategy || "percentage";
    this.amount = options.amount ? ethers.parseEther(options.amount) : undefined;
    this.percentage = options.percentage;
    this.targetValue = options.targetValue ? ethers.parseEther(options.targetValue) : undefined;
    this.profitThreshold = options.profitThreshold;
    this.dcaIntervals = options.dcaIntervals || 5;
    this.dcaDelayMs = options.dcaDelayMs || 30000; // 30 seconds default
    this.preservePercentage = options.preservePercentage || 20; // Preserve 20% by default
    this.slippageProtection = options.slippageProtection ?? true;
    this.maxSlippage = options.maxSlippage || 300; // 3% default
    
    // Validation
    this.validateStrategy();
  }

  private validateStrategy(): void {
    const validStrategies = ["percentage", "target-amount", "preserve-liquidity", "profit-taking", "dca-out"];
    if (!validStrategies.includes(this.strategy)) {
      throw new Error(`Invalid strategy: ${this.strategy}. Valid options: ${validStrategies.join(", ")}`);
    }
    
    if (this.strategy === "percentage" && (!this.percentage || this.percentage < 1 || this.percentage >= 100)) {
      throw new Error("Percentage strategy requires percentage between 1-99");
    }
    
    if (this.strategy === "target-amount" && !this.amount) {
      throw new Error("Target-amount strategy requires amount parameter");
    }
    
    if (this.strategy === "preserve-liquidity" && !this.targetValue) {
      throw new Error("Preserve-liquidity strategy requires targetValue parameter");
    }
    
    if (this.strategy === "profit-taking" && (!this.profitThreshold || this.profitThreshold < 1)) {
      throw new Error("Profit-taking strategy requires profitThreshold >= 1%");
    }
  }

  protected getScriptName(): string {
    return `Withdraw Partial (${this.strategy})`;
  }

  protected async customPreExecutionChecks(): Promise<void> {
    this.logScriptInfo("Partial withdrawal configuration", "🎯");
    this.logScriptInfo("Strategy", this.strategy);
    
    // Get current state
    const userLPBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
    const currentPoolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
    
    this.logScriptInfo("Current LP Balance", `${this.formatETH(userLPBalance)} LP`);
    this.logScriptInfo("Current Pool Value", `${this.formatETH(currentPoolValue)} ETH`);
    
    if (userLPBalance === 0n) {
      throw new Error("No LP tokens available for withdrawal");
    }
    
    // Strategy-specific pre-checks
    await this.performStrategyPreChecks(userLPBalance, currentPoolValue);
    
    this.logScriptSuccess("Partial withdrawal pre-checks passed");
  }

  private async performStrategyPreChecks(userLPBalance: bigint, currentPoolValue: bigint): Promise<void> {
    switch (this.strategy) {
      case "percentage":
        await this.validatePercentageStrategy(userLPBalance);
        break;
      case "target-amount":
        await this.validateTargetAmountStrategy(userLPBalance);
        break;
      case "preserve-liquidity":
        await this.validatePreserveLiquidityStrategy(userLPBalance, currentPoolValue);
        break;
      case "profit-taking":
        await this.validateProfitTakingStrategy(userLPBalance);
        break;
      case "dca-out":
        await this.validateDCAStrategy(userLPBalance);
        break;
    }
  }

  private async validatePercentageStrategy(userLPBalance: bigint): Promise<void> {
    const withdrawAmount = (userLPBalance * BigInt(this.percentage!)) / 100n;
    this.logScriptInfo("Withdrawal amount", `${this.formatETH(withdrawAmount)} LP (${this.percentage}%)`);
    
    if (withdrawAmount < AMOUNTS.MIN_WITHDRAW) {
      throw new Error(`Calculated withdrawal too small: ${this.formatETH(withdrawAmount)} LP`);
    }
  }

  private async validateTargetAmountStrategy(userLPBalance: bigint): Promise<void> {
    if (this.amount! > userLPBalance) {
      throw new Error(`Target amount exceeds balance: ${this.formatETH(this.amount!)} > ${this.formatETH(userLPBalance)} LP`);
    }
    
    this.logScriptInfo("Target withdrawal", `${this.formatETH(this.amount!)} LP`);
  }

  private async validatePreserveLiquidityStrategy(userLPBalance: bigint, currentPoolValue: bigint): Promise<void> {
    if (currentPoolValue <= this.targetValue!) {
      throw new Error(`Pool value already at/below target: ${this.formatETH(currentPoolValue)} <= ${this.formatETH(this.targetValue!)} ETH`);
    }
    
    const excessValue = currentPoolValue - this.targetValue!;
    this.logScriptInfo("Excess pool value", `${this.formatETH(excessValue)} ETH`);
    this.logScriptInfo("Target preservation", `${this.formatETH(this.targetValue!)} ETH`);
  }

  private async validateProfitTakingStrategy(userLPBalance: bigint): Promise<void> {
    // Get total supply and calculate current LP price
    const totalLPSupply = await this.contracts.proxyGeneral.totalSupply();
    const currentPoolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
    
    if (totalLPSupply === 0n) {
      throw new Error("No LP tokens in circulation");
    }
    
    const currentLPPrice = (currentPoolValue * ethers.parseEther("1")) / totalLPSupply;
    
    // For profit-taking, we assume initial LP price was 1 ETH (simplified)
    const initialLPPrice = ethers.parseEther("1");
    const profitPercentage = ((currentLPPrice - initialLPPrice) * 100n) / initialLPPrice;
    
    this.logScriptInfo("Current LP Price", `${this.formatETH(currentLPPrice)} ETH`);
    this.logScriptInfo("Profit %", `${profitPercentage}%`);
    
    if (profitPercentage < BigInt(this.profitThreshold!)) {
      throw new Error(`Profit threshold not met: ${profitPercentage}% < ${this.profitThreshold}%`);
    }
  }

  private async validateDCAStrategy(userLPBalance: bigint): Promise<void> {
    const amountPerInterval = userLPBalance / BigInt(this.dcaIntervals);
    
    if (amountPerInterval < AMOUNTS.MIN_WITHDRAW) {
      throw new Error(`DCA interval amount too small: ${this.formatETH(amountPerInterval)} LP per interval`);
    }
    
    this.logScriptInfo("DCA Configuration", "📅");
    this.logScriptInfo("  Intervals", this.dcaIntervals.toString());
    this.logScriptInfo("  Amount per interval", `${this.formatETH(amountPerInterval)} LP`);
    this.logScriptInfo("  Delay between intervals", `${this.dcaDelayMs}ms`);
    
    const totalTime = (this.dcaIntervals - 1) * this.dcaDelayMs;
    this.logScriptInfo("  Total execution time", `~${Math.ceil(totalTime / 1000)}s`);
  }

  protected async executeMain(): Promise<ScriptResult> {
    this.logScriptInfo("Executing partial withdrawal strategy", this.strategy);

    switch (this.strategy) {
      case "percentage":
        return await this.executePercentageWithdrawal();
      case "target-amount":
        return await this.executeTargetAmountWithdrawal();
      case "preserve-liquidity":
        return await this.executePreserveLiquidityWithdrawal();
      case "profit-taking":
        return await this.executeProfitTakingWithdrawal();
      case "dca-out":
        return await this.executeDCAWithdrawal();
      default:
        throw new Error(`Strategy ${this.strategy} not implemented`);
    }
  }

  private async executePercentageWithdrawal(): Promise<ScriptResult> {
    const userLPBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
    const withdrawAmount = (userLPBalance * BigInt(this.percentage!)) / 100n;
    
    return await this.executeSingleWithdrawal(withdrawAmount);
  }

  private async executeTargetAmountWithdrawal(): Promise<ScriptResult> {
    return await this.executeSingleWithdrawal(this.amount!);
  }

  private async executePreserveLiquidityWithdrawal(): Promise<ScriptResult> {
    const currentPoolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
    const totalLPSupply = await this.contracts.proxyGeneral.totalSupply();
    const userLPBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
    
    // Calculate how much LP to withdraw to reach target pool value
    const excessValue = currentPoolValue - this.targetValue!;
    const withdrawAmount = (excessValue * totalLPSupply) / currentPoolValue;
    
    // Don't withdraw more than user has
    const actualWithdrawAmount = withdrawAmount > userLPBalance ? userLPBalance : withdrawAmount;
    
    // Preserve some percentage of user's liquidity
    const maxWithdrawAmount = (userLPBalance * BigInt(100 - this.preservePercentage)) / 100n;
    const finalWithdrawAmount = actualWithdrawAmount > maxWithdrawAmount ? maxWithdrawAmount : actualWithdrawAmount;
    
    this.logScriptInfo("Calculated withdrawal", `${this.formatETH(finalWithdrawAmount)} LP`);
    this.logScriptInfo("Preserving", `${this.preservePercentage}% of user liquidity`);
    
    return await this.executeSingleWithdrawal(finalWithdrawAmount);
  }

  private async executeProfitTakingWithdrawal(): Promise<ScriptResult> {
    const userLPBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
    
    // Withdraw a portion based on profit level (simplified approach)
    // Higher profit = higher withdrawal percentage
    const profitBasedPercentage = Math.min(this.profitThreshold! / 2, 50); // Cap at 50%
    const withdrawAmount = (userLPBalance * BigInt(profitBasedPercentage)) / 100n;
    
    this.logScriptInfo("Profit-based withdrawal", `${profitBasedPercentage}% of LP balance`);
    
    return await this.executeSingleWithdrawal(withdrawAmount);
  }

  private async executeDCAWithdrawal(): Promise<ScriptResult> {
    const userLPBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
    const amountPerInterval = userLPBalance / BigInt(this.dcaIntervals);
    
    const results: ScriptResult[] = [];
    let totalETHReceived = 0n;
    let totalLPWithdrawn = 0n;
    
    this.logScriptInfo("Starting DCA withdrawal", `${this.dcaIntervals} intervals`);
    
    for (let i = 0; i < this.dcaIntervals; i++) {
      this.logScriptInfo(`DCA Interval ${i + 1}/${this.dcaIntervals}`, "📅");
      
      try {
        const result = await this.executeSingleWithdrawal(amountPerInterval);
        results.push(result);
        
        if (result.success && result.data) {
          totalETHReceived += BigInt(result.data.ethReceived || "0");
          totalLPWithdrawn += BigInt(result.data.lpTokensBurned || "0");
        }
        
        // Delay before next interval (except for last one)
        if (i < this.dcaIntervals - 1) {
          this.logScriptInfo("DCA Delay", `Waiting ${this.dcaDelayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.dcaDelayMs));
        }
        
      } catch (error: any) {
        this.logScriptError(`DCA interval ${i + 1} failed: ${error.message}`);
        // Continue with remaining intervals
      }
    }
    
    const successfulIntervals = results.filter(r => r.success).length;
    this.logScriptInfo("DCA Summary", "📊");
    this.logScriptInfo("  Successful intervals", `${successfulIntervals}/${this.dcaIntervals}`);
    this.logScriptInfo("  Total ETH received", `${this.formatETH(totalETHReceived)} ETH`);
    this.logScriptInfo("  Total LP withdrawn", `${this.formatETH(totalLPWithdrawn)} LP`);
    
    return {
      success: successfulIntervals > 0,
      data: {
        dcaResults: results,
        totalETHReceived: totalETHReceived.toString(),
        totalLPWithdrawn: totalLPWithdrawn.toString(),
        successfulIntervals,
        totalIntervals: this.dcaIntervals
      }
    };
  }

  private async executeSingleWithdrawal(withdrawAmount: bigint): Promise<ScriptResult> {
    // Get balances before withdrawal
    const ethBalanceBefore = await this.signer.provider.getBalance(this.signer.address);
    const lpBalanceBefore = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
    
    // Slippage protection
    if (this.slippageProtection) {
      const expectedETH = await this.contracts.liquidityManager.calculateWithdrawAmount(withdrawAmount);
      this.logScriptInfo("Slippage protection", `Expected: ${this.formatETH(expectedETH)} ETH`);
    }
    
    // Execute withdrawal
    const withdrawTx = this.contracts.liquidityManager.withdraw(withdrawAmount, {
      gasLimit: this.options.gasLimit || 500000
    });

    const result = await this.executeTransaction(
      withdrawTx,
      `Partial Withdraw ${this.formatETH(withdrawAmount)} LP`
    );

    // Add post-withdrawal data
    if (result.success) {
      const ethBalanceAfter = await this.signer.provider.getBalance(this.signer.address);
      const lpBalanceAfter = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
      
      const ethReceived = ethBalanceAfter - ethBalanceBefore;
      const lpTokensBurned = lpBalanceBefore - lpBalanceAfter;
      
      result.data = {
        ...result.data,
        ethReceived: ethReceived.toString(),
        lpTokensBurned: lpTokensBurned.toString(),
        ethReceivedFormatted: this.formatETH(ethReceived),
        lpTokensBurnedFormatted: this.formatETH(lpTokensBurned)
      };
    }

    return result;
  }

  protected async customPostExecutionVerification(): Promise<void> {
    // Strategy-specific post-execution verification
    const userLPBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
    const currentPoolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
    
    this.logScriptInfo("Post-execution state", "📊");
    this.logScriptInfo("  Remaining LP Balance", `${this.formatETH(userLPBalance)} LP`);
    this.logScriptInfo("  Current Pool Value", `${this.formatETH(currentPoolValue)} ETH`);
    
    if (this.strategy === "preserve-liquidity" && this.targetValue) {
      const preservedCorrectly = currentPoolValue >= this.targetValue;
      this.logScriptInfo("Liquidity preservation", preservedCorrectly ? "✅ Target met" : "⚠️ Below target");
    }
  }

  protected async finalize(result: ScriptResult): Promise<void> {
    if (result.success) {
      this.logScriptSuccess(`Partial withdrawal strategy '${this.strategy}' completed!`);
      
      if (result.data) {
        if (this.strategy === "dca-out") {
          this.logScriptInfo("DCA Results", `${result.data.successfulIntervals}/${result.data.totalIntervals} intervals`);
          this.logScriptInfo("Total ETH", `${this.formatETH(BigInt(result.data.totalETHReceived))} ETH`);
        } else {
          this.logScriptInfo("ETH Received", `${result.data.ethReceivedFormatted} ETH`);
          this.logScriptInfo("LP Withdrawn", `${result.data.lpTokensBurnedFormatted} LP`);
        }
      }
      
    } else {
      this.logScriptError(`Partial withdrawal strategy '${this.strategy}' failed!`);
      this.logScriptError(`Error: ${result.error}`);
    }
  }
}

// Standalone execution when run directly
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const strategy = args.find(arg => arg.startsWith('--strategy='))?.split('=')[1] || "percentage";
  const amount = args.find(arg => arg.startsWith('--amount='))?.split('=')[1];
  const percentageArg = args.find(arg => arg.startsWith('--percentage='))?.split('=')[1];
  const targetValue = args.find(arg => arg.startsWith('--target-value='))?.split('=')[1];
  const profitThresholdArg = args.find(arg => arg.startsWith('--profit-threshold='))?.split('=')[1];
  const dcaIntervalsArg = args.find(arg => arg.startsWith('--dca-intervals='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  const options: WithdrawPartialOptions = {
    strategy: strategy as any,
    amount,
    percentage: percentageArg ? parseInt(percentageArg) : undefined,
    targetValue,
    profitThreshold: profitThresholdArg ? parseInt(profitThresholdArg) : undefined,
    dcaIntervals: dcaIntervalsArg ? parseInt(dcaIntervalsArg) : undefined,
    dryRun,
    verbose: verbose || process.env.VERBOSE_LOGGING === "true"
  };

  const partialScript = new WithdrawPartialScript(options);
  const result = await partialScript.execute();
  
  process.exit(result.success ? 0 : 1);
}

// Execute if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Partial withdrawal script failed:", error);
    process.exit(1);
  });
}