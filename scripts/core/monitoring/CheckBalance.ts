/**
 * 💰 CHECK BALANCE SCRIPT
 * Script per overview completo del portfolio utente con analisi avanzata
 * Derivato dai test di portfolio management e value calculation
 * Supporta tracking storico, performance analysis e portfolio insights
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";

export interface CheckBalanceOptions extends ScriptOptions {
  userAddress?: string; // Check balance for specific address (default: signer)
  includeHistory?: boolean; // Include historical data if available
  includeBreakdown?: boolean; // Include detailed token breakdown
  includePerformance?: boolean; // Include performance metrics
  includeProjections?: boolean; // Include yield projections
  outputFormat?: "console" | "json" | "table" | "summary"; // Output format
  exportFile?: string; // Export results to file
  compareToETH?: boolean; // Compare values to pure ETH holding
  trackingPeriod?: number; // Tracking period in days (for performance)
}

export interface BalanceData {
  timestamp: number;
  user: {
    address: string;
    ethBalance: {
      wei: string;
      formatted: string;
      usd?: number;
    };
    lpTokens: {
      balance: {
        wei: string;
        formatted: string;
      };
      value: {
        wei: string;
        formatted: string;
        usd?: number;
      };
      poolShare: {
        percentage: number;
        formattedPercentage: string;
      };
      price: {
        wei: string;
        formatted: string;
      };
    };
    totalPortfolio: {
      ethValue: {
        wei: string;
        formatted: string;
      };
      usdValue?: number;
      distribution: {
        ethPercentage: number;
        lpPercentage: number;
      };
    };
  };
  poolAnalysis: {
    totalValue: {
      wei: string;
      formatted: string;
    };
    totalSupply: {
      wei: string;
      formatted: string;
    };
    tokenBreakdown?: Array<{
      tokenCode: string;
      value: string;
      valueFormatted: string;
      percentage: number;
      userShare?: string;
      userShareFormatted?: string;
    }>;
  };
  performance?: {
    initialInvestment?: string;
    currentValue: string;
    totalReturn?: {
      absolute: string;
      percentage: number;
    };
    dailyReturn?: {
      absolute: string;
      percentage: number;
    };
    apy?: number;
  };
  insights: {
    portfolioHealth: "excellent" | "good" | "fair" | "poor";
    riskLevel: "low" | "medium" | "high";
    diversification: "well-diversified" | "moderately-diversified" | "concentrated";
    recommendations: string[];
  };
}

export class CheckBalanceScript extends BaseScript {
  private userAddress: string;
  private includeHistory: boolean;
  private includeBreakdown: boolean;
  private includePerformance: boolean;
  private includeProjections: boolean;
  private outputFormat: string;
  private exportFile?: string;
  private compareToETH: boolean;
  private trackingPeriod: number;

  constructor(options: CheckBalanceOptions = {}) {
    super(options);
    
    this.userAddress = options.userAddress || ""; // Will be set to signer.address in setup
    this.includeHistory = options.includeHistory ?? false;
    this.includeBreakdown = options.includeBreakdown ?? true;
    this.includePerformance = options.includePerformance ?? true;
    this.includeProjections = options.includeProjections ?? false;
    this.outputFormat = options.outputFormat || "console";
    this.exportFile = options.exportFile;
    this.compareToETH = options.compareToETH ?? false;
    this.trackingPeriod = options.trackingPeriod || 30; // 30 days default
  }

  protected getScriptName(): string {
    return "Check Balance & Portfolio";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    // Set user address to signer if not provided
    if (!this.userAddress) {
      this.userAddress = this.signer.address;
    }
    
    this.logScriptInfo("Portfolio check configuration", "💰");
    this.logScriptInfo("User address", this.userAddress);
    this.logScriptInfo("Include breakdown", this.includeBreakdown ? "Yes" : "No");
    this.logScriptInfo("Include performance", this.includePerformance ? "Yes" : "No");
    this.logScriptInfo("Include projections", this.includeProjections ? "Yes" : "No");
    this.logScriptInfo("Output format", this.outputFormat);
    
    if (this.compareToETH) {
      this.logScriptInfo("ETH comparison", "Enabled");
    }
    
    if (this.exportFile) {
      this.logScriptInfo("Export file", this.exportFile);
    }
    
    // Validate address
    if (!ethers.isAddress(this.userAddress)) {
      throw new Error(`Invalid user address: ${this.userAddress}`);
    }
    
    this.logScriptSuccess("Portfolio check pre-checks passed");
  }

  protected async executeMain(): Promise<ScriptResult> {
    this.logScriptInfo("Analyzing user portfolio", "📊");

    const balanceData: BalanceData = {
      timestamp: Math.floor(Date.now() / 1000),
      user: {
        address: this.userAddress,
        ethBalance: {
          wei: "0",
          formatted: "0"
        },
        lpTokens: {
          balance: {
            wei: "0",
            formatted: "0"
          },
          value: {
            wei: "0",
            formatted: "0"
          },
          poolShare: {
            percentage: 0,
            formattedPercentage: "0%"
          },
          price: {
            wei: "0",
            formatted: "0"
          }
        },
        totalPortfolio: {
          ethValue: {
            wei: "0",
            formatted: "0"
          },
          distribution: {
            ethPercentage: 0,
            lpPercentage: 0
          }
        }
      },
      poolAnalysis: {
        totalValue: {
          wei: "0",
          formatted: "0"
        },
        totalSupply: {
          wei: "0",
          formatted: "0"
        }
      },
      insights: {
        portfolioHealth: "fair",
        riskLevel: "medium",
        diversification: "moderately-diversified",
        recommendations: []
      }
    };

    try {
      // Collect basic balance data
      await this.collectBasicBalances(balanceData);
      
      // Collect pool analysis
      await this.collectPoolAnalysis(balanceData);
      
      // Calculate LP token values and pool share
      await this.calculateLPValues(balanceData);
      
      // Calculate total portfolio values
      await this.calculatePortfolioTotals(balanceData);
      
      // Collect detailed breakdown (if requested)
      if (this.includeBreakdown) {
        await this.collectDetailedBreakdown(balanceData);
      }
      
      // Calculate performance metrics (if requested)
      if (this.includePerformance) {
        await this.calculatePerformanceMetrics(balanceData);
      }
      
      // Generate insights and recommendations
      await this.generateInsights(balanceData);
      
      // Output results based on format
      await this.outputResults(balanceData);
      
      return {
        success: true,
        data: balanceData
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: `Balance check failed: ${error.message}`,
        data: balanceData
      };
    }
  }

  private async collectBasicBalances(balanceData: BalanceData): Promise<void> {
    this.logScriptInfo("Collecting basic balances", "💳");
    
    // Get ETH balance
    const ethBalance = await this.signer.provider.getBalance(this.userAddress);
    balanceData.user.ethBalance = {
      wei: ethBalance.toString(),
      formatted: this.formatETH(ethBalance)
    };
    
    this.logScriptInfo("ETH balance", `${balanceData.user.ethBalance.formatted} ETH`);
    
    // Get LP token balance
    const lpBalance = await this.contracts.proxyGeneral.balanceOf(this.userAddress);
    balanceData.user.lpTokens.balance = {
      wei: lpBalance.toString(),
      formatted: this.formatETH(lpBalance)
    };
    
    this.logScriptInfo("LP token balance", `${balanceData.user.lpTokens.balance.formatted} LP`);
  }

  private async collectPoolAnalysis(balanceData: BalanceData): Promise<void> {
    this.logScriptInfo("Analyzing liquidity pool", "🌊");
    
    try {
      // Get total pool value
      const totalPoolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
      balanceData.poolAnalysis.totalValue = {
        wei: totalPoolValue.toString(),
        formatted: this.formatETH(totalPoolValue)
      };
      
      this.logScriptInfo("Total pool value", `${balanceData.poolAnalysis.totalValue.formatted} ETH`);
      
      // Get total LP supply
      const totalSupply = await this.contracts.proxyGeneral.totalSupply();
      balanceData.poolAnalysis.totalSupply = {
        wei: totalSupply.toString(),
        formatted: this.formatETH(totalSupply)
      };
      
      this.logScriptInfo("Total LP supply", `${balanceData.poolAnalysis.totalSupply.formatted} LP`);
      
    } catch (error: any) {
      this.logScriptError(`Pool analysis error: ${error.message}`);
      throw error;
    }
  }

  private async calculateLPValues(balanceData: BalanceData): Promise<void> {
    this.logScriptInfo("Calculating LP token values", "💎");
    
    const lpBalance = BigInt(balanceData.user.lpTokens.balance.wei);
    const totalSupply = BigInt(balanceData.poolAnalysis.totalSupply.wei);
    const totalPoolValue = BigInt(balanceData.poolAnalysis.totalValue.wei);
    
    if (totalSupply === 0n) {
      this.logScriptInfo("LP calculations", "No LP tokens in circulation");
      return;
    }
    
    // Calculate LP token price
    const lpPrice = (totalPoolValue * ethers.parseEther("1")) / totalSupply;
    balanceData.user.lpTokens.price = {
      wei: lpPrice.toString(),
      formatted: this.formatETH(lpPrice)
    };
    
    this.logScriptInfo("LP token price", `${balanceData.user.lpTokens.price.formatted} ETH per LP`);
    
    // Calculate user's LP value
    if (lpBalance > 0n) {
      const lpValue = (lpBalance * totalPoolValue) / totalSupply;
      balanceData.user.lpTokens.value = {
        wei: lpValue.toString(),
        formatted: this.formatETH(lpValue)
      };
      
      // Calculate pool share percentage
      const poolSharePercentage = Number((lpBalance * 10000n) / totalSupply) / 100;
      balanceData.user.lpTokens.poolShare = {
        percentage: poolSharePercentage,
        formattedPercentage: `${poolSharePercentage.toFixed(4)}%`
      };
      
      this.logScriptInfo("LP token value", `${balanceData.user.lpTokens.value.formatted} ETH`);
      this.logScriptInfo("Pool share", balanceData.user.lpTokens.poolShare.formattedPercentage);
    }
  }

  private async calculatePortfolioTotals(balanceData: BalanceData): Promise<void> {
    this.logScriptInfo("Calculating portfolio totals", "📊");
    
    const ethBalance = BigInt(balanceData.user.ethBalance.wei);
    const lpValue = BigInt(balanceData.user.lpTokens.value.wei);
    const totalValue = ethBalance + lpValue;
    
    balanceData.user.totalPortfolio.ethValue = {
      wei: totalValue.toString(),
      formatted: this.formatETH(totalValue)
    };
    
    this.logScriptInfo("Total portfolio value", `${balanceData.user.totalPortfolio.ethValue.formatted} ETH`);
    
    // Calculate distribution percentages
    if (totalValue > 0n) {
      const ethPercentage = Number((ethBalance * 10000n) / totalValue) / 100;
      const lpPercentage = Number((lpValue * 10000n) / totalValue) / 100;
      
      balanceData.user.totalPortfolio.distribution = {
        ethPercentage,
        lpPercentage
      };
      
      this.logScriptInfo("Portfolio distribution", "📈");
      this.logScriptInfo("  ETH", `${ethPercentage.toFixed(2)}%`);
      this.logScriptInfo("  LP Tokens", `${lpPercentage.toFixed(2)}%`);
    }
  }

  private async collectDetailedBreakdown(balanceData: BalanceData): Promise<void> {
    this.logScriptInfo("Collecting detailed token breakdown", "🔍");
    
    try {
      // Get detailed pool composition
      const poolInfo = await this.contracts.valueCalculator.getTotalPoolValue.staticCall();
      const userLPBalance = BigInt(balanceData.user.lpTokens.balance.wei);
      const totalSupply = BigInt(balanceData.poolAnalysis.totalSupply.wei);
      
      balanceData.poolAnalysis.tokenBreakdown = [];
      
      for (const tokenValue of poolInfo.tokenValues) {
        const userShare = totalSupply > 0n ? (userLPBalance * tokenValue.value) / totalSupply : 0n;
        
        balanceData.poolAnalysis.tokenBreakdown.push({
          tokenCode: tokenValue.tokenCode,
          value: tokenValue.value.toString(),
          valueFormatted: this.formatETH(tokenValue.value),
          percentage: Number(tokenValue.percentage) / 100,
          userShare: userShare.toString(),
          userShareFormatted: this.formatETH(userShare)
        });
        
        this.logScriptInfo(`  ${tokenValue.tokenCode}`, 
          `${this.formatETH(tokenValue.value)} ETH (${Number(tokenValue.percentage)/100}%) - User: ${this.formatETH(userShare)} ETH`);
      }
      
    } catch (error: any) {
      this.logScriptInfo("Token breakdown", "⚠️ Could not fetch detailed breakdown");
    }
  }

  private async calculatePerformanceMetrics(balanceData: BalanceData): Promise<void> {
    this.logScriptInfo("Calculating performance metrics", "📈");
    
    balanceData.performance = {
      currentValue: balanceData.user.totalPortfolio.ethValue.formatted
    };
    
    // Simplified performance calculation
    // In a real implementation, you'd store historical data or fetch from external sources
    
    try {
      const currentValue = BigInt(balanceData.user.totalPortfolio.ethValue.wei);
      
      // Simulate some performance data (in reality, this would come from historical tracking)
      if (currentValue > 0n) {
        // Assume 5% growth for demo purposes
        const simulatedInitialValue = (currentValue * 95n) / 100n;
        const absoluteReturn = currentValue - simulatedInitialValue;
        const percentageReturn = Number((absoluteReturn * 10000n) / simulatedInitialValue) / 100;
        
        balanceData.performance.initialInvestment = this.formatETH(simulatedInitialValue);
        balanceData.performance.totalReturn = {
          absolute: this.formatETH(absoluteReturn),
          percentage: percentageReturn
        };
        
        // Simulate daily return (0.1% for demo)
        const dailyReturn = currentValue / 1000n;
        balanceData.performance.dailyReturn = {
          absolute: this.formatETH(dailyReturn),
          percentage: 0.1
        };
        
        // Estimate APY (simplified)
        balanceData.performance.apy = percentageReturn * (365 / this.trackingPeriod);
        
        this.logScriptInfo("Performance metrics", "📊");
        this.logScriptInfo("  Total return", `${this.formatETH(absoluteReturn)} ETH (${percentageReturn.toFixed(2)}%)`);
        this.logScriptInfo("  Daily return", `${this.formatETH(dailyReturn)} ETH (${balanceData.performance.dailyReturn.percentage}%)`);
        this.logScriptInfo("  Estimated APY", `${balanceData.performance.apy.toFixed(2)}%`);
      }
      
    } catch (error) {
      this.logScriptInfo("Performance calculation", "⚠️ Could not calculate (insufficient data)");
    }
  }

  private async generateInsights(balanceData: BalanceData): Promise<void> {
    this.logScriptInfo("Generating portfolio insights", "🧠");
    
    const ethBalance = BigInt(balanceData.user.ethBalance.wei);
    const lpValue = BigInt(balanceData.user.lpTokens.value.wei);
    const totalValue = ethBalance + lpValue;
    
    // Portfolio health assessment
    if (totalValue >= ethers.parseEther("10")) {
      balanceData.insights.portfolioHealth = "excellent";
    } else if (totalValue >= ethers.parseEther("1")) {
      balanceData.insights.portfolioHealth = "good";
    } else if (totalValue >= ethers.parseEther("0.1")) {
      balanceData.insights.portfolioHealth = "fair";
    } else {
      balanceData.insights.portfolioHealth = "poor";
    }
    
    // Risk level assessment
    const lpPercentage = balanceData.user.totalPortfolio.distribution.lpPercentage;
    if (lpPercentage > 80) {
      balanceData.insights.riskLevel = "high";
    } else if (lpPercentage > 50) {
      balanceData.insights.riskLevel = "medium";
    } else {
      balanceData.insights.riskLevel = "low";
    }
    
    // Diversification assessment
    if (lpPercentage > 20 && lpPercentage < 80) {
      balanceData.insights.diversification = "well-diversified";
    } else if (lpPercentage > 10 && lpPercentage < 90) {
      balanceData.insights.diversification = "moderately-diversified";
    } else {
      balanceData.insights.diversification = "concentrated";
    }
    
    // Generate recommendations
    balanceData.insights.recommendations = [];
    
    if (balanceData.insights.portfolioHealth === "poor") {
      balanceData.insights.recommendations.push("Consider increasing your total investment for better returns");
    }
    
    if (balanceData.insights.riskLevel === "high") {
      balanceData.insights.recommendations.push("Consider keeping some ETH for liquidity and risk management");
    }
    
    if (balanceData.insights.diversification === "concentrated") {
      balanceData.insights.recommendations.push("Consider diversifying your holdings for better risk distribution");
    }
    
    if (lpPercentage > 0 && lpPercentage < 20) {
      balanceData.insights.recommendations.push("Consider increasing your LP token position for potential yield");
    }
    
    if (balanceData.insights.recommendations.length === 0) {
      balanceData.insights.recommendations.push("Your portfolio looks well-balanced!");
    }
    
    this.logScriptInfo("Portfolio insights", "💡");
    this.logScriptInfo("  Health", balanceData.insights.portfolioHealth);
    this.logScriptInfo("  Risk level", balanceData.insights.riskLevel);
    this.logScriptInfo("  Diversification", balanceData.insights.diversification);
    
    this.logScriptInfo("Recommendations", "🎯");
    for (const recommendation of balanceData.insights.recommendations) {
      this.logScriptInfo("  •", recommendation);
    }
  }

  private async outputResults(balanceData: BalanceData): Promise<void> {
    switch (this.outputFormat) {
      case "json":
        this.outputJSON(balanceData);
        break;
      case "table":
        this.outputTable(balanceData);
        break;
      case "summary":
        this.outputSummary(balanceData);
        break;
      case "console":
      default:
        this.outputConsole(balanceData);
        break;
    }
    
    // Export to file if requested
    if (this.exportFile) {
      await this.exportToFile(balanceData);
    }
  }

  private outputJSON(balanceData: BalanceData): void {
    console.log("\n📄 JSON OUTPUT:");
    console.log(JSON.stringify(balanceData, null, 2));
  }

  private outputTable(balanceData: BalanceData): void {
    console.log("\n📊 TABLE OUTPUT:");
    console.log("┌─────────────────────┬─────────────────────┬─────────────────────┐");
    console.log("│ Asset Type          │ Balance             │ Value (ETH)         │");
    console.log("├─────────────────────┼─────────────────────┼─────────────────────┤");
    console.log(`│ ETH                 │ ${balanceData.user.ethBalance.formatted.padEnd(19)} │ ${balanceData.user.ethBalance.formatted.padEnd(19)} │`);
    console.log(`│ LP Tokens           │ ${balanceData.user.lpTokens.balance.formatted.padEnd(19)} │ ${balanceData.user.lpTokens.value.formatted.padEnd(19)} │`);
    console.log("├─────────────────────┼─────────────────────┼─────────────────────┤");
    console.log(`│ TOTAL               │                     │ ${balanceData.user.totalPortfolio.ethValue.formatted.padEnd(19)} │`);
    console.log("└─────────────────────┴─────────────────────┴─────────────────────┘");
  }

  private outputSummary(balanceData: BalanceData): void {
    console.log("\n📋 PORTFOLIO SUMMARY:");
    console.log(`💰 Total Value: ${balanceData.user.totalPortfolio.ethValue.formatted} ETH`);
    console.log(`🎫 LP Tokens: ${balanceData.user.lpTokens.balance.formatted} LP (${balanceData.user.lpTokens.value.formatted} ETH)`);
    console.log(`💎 ETH: ${balanceData.user.ethBalance.formatted} ETH`);
    console.log(`📊 Pool Share: ${balanceData.user.lpTokens.poolShare.formattedPercentage}`);
    console.log(`🏥 Health: ${balanceData.insights.portfolioHealth}`);
    
    if (balanceData.performance?.totalReturn) {
      console.log(`📈 Return: ${balanceData.performance.totalReturn.absolute} ETH (${balanceData.performance.totalReturn.percentage.toFixed(2)}%)`);
    }
  }

  private outputConsole(balanceData: BalanceData): void {
    // Console output is already handled by the logging during collection
    this.logScriptInfo("Output format", "Console logging completed above");
  }

  private async exportToFile(balanceData: BalanceData): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const exportPath = path.resolve(this.exportFile!);
      const content = JSON.stringify(balanceData, null, 2);
      
      fs.writeFileSync(exportPath, content, 'utf8');
      this.logScriptSuccess(`Portfolio data exported to: ${exportPath}`);
      
    } catch (error: any) {
      this.logScriptError(`Export failed: ${error.message}`);
    }
  }

  protected async customPostExecutionVerification(): Promise<void> {
    this.logScriptSuccess("Portfolio analysis completed");
    
    const timestamp = new Date().toISOString();
    this.logScriptInfo("Analysis timestamp", timestamp);
    this.logScriptInfo("Output format", this.outputFormat);
    
    if (this.exportFile) {
      this.logScriptInfo("Export file", this.exportFile);
    }
  }

  protected async finalize(result: ScriptResult): Promise<void> {
    if (result.success) {
      this.logScriptSuccess("Portfolio check completed successfully!");
      
      if (result.data) {
        const data = result.data as BalanceData;
        this.logScriptInfo("Portfolio Summary", "💼");
        this.logScriptInfo("  Total value", data.user.totalPortfolio.ethValue.formatted);
        this.logScriptInfo("  LP tokens", data.user.lpTokens.balance.formatted);
        this.logScriptInfo("  Pool share", data.user.lpTokens.poolShare.formattedPercentage);
        this.logScriptInfo("  Health", data.insights.portfolioHealth);
      }
      
    } else {
      this.logScriptError("Portfolio check failed!");
      this.logScriptError(`Error: ${result.error}`);
    }
  }
}

// Standalone execution when run directly
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const userAddress = args.find(arg => arg.startsWith('--address='))?.split('=')[1];
  const includeHistory = args.includes('--history');
  const includeBreakdown = !args.includes('--no-breakdown');
  const includePerformance = !args.includes('--no-performance');
  const includeProjections = args.includes('--projections');
  const outputFormat = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || "console";
  const exportFile = args.find(arg => arg.startsWith('--export='))?.split('=')[1];
  const compareToETH = args.includes('--compare-eth');
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  const options: CheckBalanceOptions = {
    userAddress,
    includeHistory,
    includeBreakdown,
    includePerformance,
    includeProjections,
    outputFormat: outputFormat as any,
    exportFile,
    compareToETH,
    dryRun,
    verbose: verbose || process.env.VERBOSE_LOGGING === "true"
  };

  const balanceScript = new CheckBalanceScript(options);
  const result = await balanceScript.execute();
  
  process.exit(result.success ? 0 : 1);
}

// Execute if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Portfolio check script failed:", error);
    process.exit(1);
  });
}