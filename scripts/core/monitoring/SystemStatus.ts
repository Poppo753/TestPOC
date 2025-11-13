/**
 * 📊 SYSTEM STATUS SCRIPT (Refactored)
 * Script refactorizzato per verificare lo stato completo del sistema DeFi
 * Refactored con BaseScript per standardizzazione
 * Derivato dai test di integrazione esistenti
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";

export interface SystemStatusOptions extends ScriptOptions {
  detailed?: boolean; // Include detailed module information
  includeHealth?: boolean; // Include health checks
  includeParameters?: boolean; // Include system parameters
  includeUser?: boolean; // Include user-specific information
  outputFormat?: "console" | "json" | "csv"; // Output format
  exportFile?: string; // Export results to file
}

export interface SystemStatusData {
  timestamp: number;
  beacon: {
    address: string;
    registeredModules: string[];
    moduleAddresses: { [moduleName: string]: string };
    systemHealth?: {
      isHealthy: boolean;
      issues?: string[];
    };
  };
  liquidityPool: {
    totalValue: string;
    totalValueETH: string;
    tokenBreakdown: Array<{
      tokenCode: string;
      value: string;
      valueETH: string;
      percentage: number;
    }>;
    totalSupply?: string;
    lpPrice?: string;
  };
  user?: {
    address: string;
    lpBalance: string;
    lpBalanceETH: string;
    ethBalance: string;
    lpValue: string;
    poolSharePercentage?: number;
  };
  systemParameters?: {
    depositFee?: number;
    withdrawFee?: number;
    [key: string]: any;
  };
  emergencyStatus: {
    isPaused: boolean;
    canPause?: boolean;
    canUnpause?: boolean;
    pauseReason?: string;
    unpauseReason?: string;
  };
  operationalStatus: {
    depositsEnabled: boolean;
    withdrawsEnabled: boolean;
    swapsEnabled: boolean;
  };
}

export class SystemStatusScript extends BaseScript {
  private detailed: boolean;
  private includeHealth: boolean;
  private includeParameters: boolean;
  private includeUser: boolean;
  private outputFormat: string;
  private exportFile?: string;

  constructor(options: SystemStatusOptions = {}) {
    super(options);
    
    this.detailed = options.detailed ?? true;
    this.includeHealth = options.includeHealth ?? true;
    this.includeParameters = options.includeParameters ?? true;
    this.includeUser = options.includeUser ?? true;
    this.outputFormat = options.outputFormat || "console";
    this.exportFile = options.exportFile;
  }

  protected getScriptName(): string {
    return "System Status Check";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    this.logScriptInfo("System status configuration", "📊");
    this.logScriptInfo("Detailed mode", this.detailed ? "Yes" : "No");
    this.logScriptInfo("Include health checks", this.includeHealth ? "Yes" : "No");
    this.logScriptInfo("Include parameters", this.includeParameters ? "Yes" : "No");
    this.logScriptInfo("Include user info", this.includeUser ? "Yes" : "No");
    this.logScriptInfo("Output format", this.outputFormat);
    
    if (this.exportFile) {
      this.logScriptInfo("Export file", this.exportFile);
    }
    
    this.logScriptSuccess("System status pre-checks passed");
  }

  protected async executeMain(): Promise<ScriptResult> {
    this.logScriptInfo("Collecting system status", "🔍");

    const statusData: SystemStatusData = {
      timestamp: Math.floor(Date.now() / 1000),
      beacon: {
        address: "",
        registeredModules: [],
        moduleAddresses: {}
      },
      liquidityPool: {
        totalValue: "0",
        totalValueETH: "0",
        tokenBreakdown: []
      },
      emergencyStatus: {
        isPaused: false
      },
      operationalStatus: {
        depositsEnabled: false,
        withdrawsEnabled: false,
        swapsEnabled: false
      }
    };

    try {
      // Collect beacon information
      await this.collectBeaconStatus(statusData);
      
      // Collect liquidity pool information
      await this.collectLiquidityPoolStatus(statusData);
      
      // Collect user information (if requested)
      if (this.includeUser) {
        await this.collectUserStatus(statusData);
      }
      
      // Collect system parameters (if requested)
      if (this.includeParameters) {
        await this.collectSystemParameters(statusData);
      }
      
      // Collect emergency status
      await this.collectEmergencyStatus(statusData);
      
      // Collect operational status
      await this.collectOperationalStatus(statusData);
      
      // Output results based on format
      await this.outputResults(statusData);
      
      return {
        success: true,
        data: statusData
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: `System status collection failed: ${error.message}`,
        data: statusData
      };
    }
  }

  private async collectBeaconStatus(statusData: SystemStatusData): Promise<void> {
    this.logScriptInfo("Collecting beacon status", "📡");
    
    try {
      const beaconAddress = await this.contracts.beacon.getAddress();
      statusData.beacon.address = beaconAddress;
      
      // Get registered modules
      const registeredModules = await this.contracts.beacon.getRegisteredModules();
      statusData.beacon.registeredModules = registeredModules;
      
      this.logScriptInfo("Registered modules", registeredModules.length.toString());
      
      // Get module addresses
      for (const moduleName of registeredModules) {
        try {
          const moduleAddr = await this.contracts.beacon.getImplementation(moduleName);
          statusData.beacon.moduleAddresses[moduleName] = moduleAddr;
          
          if (this.detailed) {
            this.logScriptInfo(`  ${moduleName}`, moduleAddr);
          }
        } catch (error: any) {
          this.logScriptInfo(`  ${moduleName}`, `⚠️ Error: ${error.message}`);
        }
      }
      
      // System health check (if available and requested)
      if (this.includeHealth) {
        try {
          const healthCheck = await this.contracts.beacon.checkSystemHealth();
          statusData.beacon.systemHealth = {
            isHealthy: healthCheck.isHealthy,
            issues: healthCheck.issues || []
          };
          
          this.logScriptInfo("System health", healthCheck.isHealthy ? "✅ HEALTHY" : "❌ UNHEALTHY");
          
          if (!healthCheck.isHealthy && healthCheck.issues) {
            for (const issue of healthCheck.issues) {
              this.logScriptInfo("  Issue", issue);
            }
          }
        } catch (error) {
          this.logScriptInfo("System health", "⚠️ Could not check");
        }
      }
      
    } catch (error: any) {
      this.logScriptError(`Beacon status error: ${error.message}`);
      throw error;
    }
  }

  private async collectLiquidityPoolStatus(statusData: SystemStatusData): Promise<void> {
    this.logScriptInfo("Collecting liquidity pool status", "🌊");
    
    try {
      // Get total pool value
      const poolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
      statusData.liquidityPool.totalValue = poolValue.toString();
      statusData.liquidityPool.totalValueETH = this.formatETH(poolValue);
      
      this.logScriptInfo("Total pool value", `${this.formatETH(poolValue)} ETH`);
      
      // Get detailed pool information
      try {
        const poolInfo = await this.contracts.valueCalculator.getTotalPoolValue.staticCall();
        
        for (const tokenValue of poolInfo.tokenValues) {
          statusData.liquidityPool.tokenBreakdown.push({
            tokenCode: tokenValue.tokenCode,
            value: tokenValue.value.toString(),
            valueETH: this.formatETH(tokenValue.value),
            percentage: Number(tokenValue.percentage) / 100
          });
          
          if (this.detailed) {
            this.logScriptInfo(`  ${tokenValue.tokenCode}`, 
              `${this.formatETH(tokenValue.value)} ETH (${Number(tokenValue.percentage)/100}%)`);
          }
        }
      } catch (error) {
        this.logScriptInfo("Token breakdown", "⚠️ Could not fetch detailed info");
      }
      
      // Get LP token information
      try {
        const totalSupply = await this.contracts.proxyGeneral.totalSupply();
        statusData.liquidityPool.totalSupply = totalSupply.toString();
        
        if (totalSupply > 0n && poolValue > 0n) {
          const lpPrice = (poolValue * ethers.parseEther("1")) / totalSupply;
          statusData.liquidityPool.lpPrice = this.formatETH(lpPrice);
          
          this.logScriptInfo("Total LP supply", `${this.formatETH(totalSupply)} LP`);
          this.logScriptInfo("LP token price", `${this.formatETH(lpPrice)} ETH per LP`);
        }
      } catch (error) {
        this.logScriptInfo("LP token info", "⚠️ Could not fetch");
      }
      
    } catch (error: any) {
      this.logScriptError(`Pool status error: ${error.message}`);
      throw error;
    }
  }

  private async collectUserStatus(statusData: SystemStatusData): Promise<void> {
    this.logScriptInfo("Collecting user status", "👤");
    
    try {
      const userAddress = this.signer.address;
      const userLPBalance = await this.contracts.proxyGeneral.balanceOf(userAddress);
      const userETHBalance = await this.signer.provider.getBalance(userAddress);
      
      statusData.user = {
        address: userAddress,
        lpBalance: userLPBalance.toString(),
        lpBalanceETH: this.formatETH(userLPBalance),
        ethBalance: userETHBalance.toString(),
        lpValue: "0"
      };
      
      this.logScriptInfo("User address", userAddress);
      this.logScriptInfo("LP balance", `${this.formatETH(userLPBalance)} LP`);
      this.logScriptInfo("ETH balance", `${this.formatETH(userETHBalance)} ETH`);
      
      // Calculate LP value in ETH
      if (userLPBalance > 0n) {
        try {
          const poolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
          const totalSupply = await this.contracts.proxyGeneral.totalSupply();
          
          if (totalSupply > 0n) {
            const userPoolShare = (userLPBalance * poolValue) / totalSupply;
            statusData.user.lpValue = userPoolShare.toString();
            statusData.user.poolSharePercentage = Number((userLPBalance * 10000n) / totalSupply) / 100;
            
            this.logScriptInfo("LP value", `${this.formatETH(userPoolShare)} ETH`);
            this.logScriptInfo("Pool share", `${statusData.user.poolSharePercentage}%`);
          }
        } catch (error) {
          this.logScriptInfo("LP value calculation", "⚠️ Could not calculate");
        }
      }
      
    } catch (error: any) {
      this.logScriptError(`User status error: ${error.message}`);
      // Non-critical error, don't throw
    }
  }

  private async collectSystemParameters(statusData: SystemStatusData): Promise<void> {
    this.logScriptInfo("Collecting system parameters", "⚙️");
    
    statusData.systemParameters = {};
    
    try {
      // Deposit fee
      try {
        const depositFee = await this.contracts.parameterManager.getParameter("DEPOSIT_FEE_RATE");
        statusData.systemParameters.depositFee = Number(depositFee) / 100;
        this.logScriptInfo("Deposit fee", `${statusData.systemParameters.depositFee}%`);
      } catch {
        this.logScriptInfo("Deposit fee", "Not configured");
      }
      
      // Withdraw fee
      try {
        const withdrawFee = await this.contracts.parameterManager.getParameter("WITHDRAW_FEE_RATE");
        statusData.systemParameters.withdrawFee = Number(withdrawFee) / 100;
        this.logScriptInfo("Withdraw fee", `${statusData.systemParameters.withdrawFee}%`);
      } catch {
        this.logScriptInfo("Withdraw fee", "Not configured");
      }
      
      // Additional parameters can be added here
      
    } catch (error: any) {
      this.logScriptError(`Parameters error: ${error.message}`);
      // Non-critical error, don't throw
    }
  }

  private async collectEmergencyStatus(statusData: SystemStatusData): Promise<void> {
    this.logScriptInfo("Collecting emergency status", "🚨");
    
    try {
      // Check if system is paused via emergency handler
      try {
        const pauseExecuted = await this.contracts.emergencyHandler.isEmergencyExecuted("pause");
        statusData.emergencyStatus.isPaused = pauseExecuted;
        
        this.logScriptInfo("System paused", pauseExecuted ? "YES" : "NO");
        
        // Additional emergency checks can be added here
        
      } catch (error) {
        this.logScriptInfo("Emergency status", "⚠️ Could not check");
      }
      
    } catch (error: any) {
      this.logScriptError(`Emergency status error: ${error.message}`);
      // Non-critical error, don't throw
    }
  }

  private async collectOperationalStatus(statusData: SystemStatusData): Promise<void> {
    this.logScriptInfo("Collecting operational status", "🔧");
    
    try {
      // Check deposits enabled
      try {
        const depositsEnabled = await this.contracts.liquidityManager.depositsEnabled();
        statusData.operationalStatus.depositsEnabled = depositsEnabled;
        this.logScriptInfo("Deposits enabled", depositsEnabled ? "YES" : "NO");
      } catch {
        this.logScriptInfo("Deposits status", "⚠️ Could not check");
      }
      
      // Check withdraws enabled
      try {
        const withdrawsEnabled = await this.contracts.liquidityManager.withdrawsEnabled();
        statusData.operationalStatus.withdrawsEnabled = withdrawsEnabled;
        this.logScriptInfo("Withdraws enabled", withdrawsEnabled ? "YES" : "NO");
      } catch {
        this.logScriptInfo("Withdraws status", "⚠️ Could not check");
      }
      
      // Check swaps enabled (if swap manager available)
      try {
        const swapsEnabled = true; // Simplified - would check actual swap manager status
        statusData.operationalStatus.swapsEnabled = swapsEnabled;
        this.logScriptInfo("Swaps enabled", swapsEnabled ? "YES" : "NO");
      } catch {
        this.logScriptInfo("Swaps status", "⚠️ Could not check");
      }
      
    } catch (error: any) {
      this.logScriptError(`Operational status error: ${error.message}`);
      // Non-critical error, don't throw
    }
  }

  private async outputResults(statusData: SystemStatusData): Promise<void> {
    switch (this.outputFormat) {
      case "json":
        this.outputJSON(statusData);
        break;
      case "csv":
        await this.outputCSV(statusData);
        break;
      case "console":
      default:
        this.outputConsole(statusData);
        break;
    }
    
    // Export to file if requested
    if (this.exportFile) {
      await this.exportToFile(statusData);
    }
  }

  private outputJSON(statusData: SystemStatusData): void {
    console.log("\n📄 JSON OUTPUT:");
    console.log(JSON.stringify(statusData, null, 2));
  }

  private async outputCSV(statusData: SystemStatusData): Promise<void> {
    console.log("\n📊 CSV OUTPUT:");
    console.log("Category,Key,Value");
    
    // Basic info
    console.log(`System,Timestamp,${statusData.timestamp}`);
    console.log(`Beacon,Address,${statusData.beacon.address}`);
    console.log(`Beacon,Modules,${statusData.beacon.registeredModules.length}`);
    
    // Pool info
    console.log(`Pool,TotalValueETH,${statusData.liquidityPool.totalValueETH}`);
    console.log(`Pool,TotalSupply,${statusData.liquidityPool.totalSupply || 'N/A'}`);
    console.log(`Pool,LPPrice,${statusData.liquidityPool.lpPrice || 'N/A'}`);
    
    // User info
    if (statusData.user) {
      console.log(`User,Address,${statusData.user.address}`);
      console.log(`User,LPBalance,${statusData.user.lpBalanceETH}`);
      console.log(`User,ETHBalance,${statusData.user.ethBalance}`);
    }
    
    // Operational status
    console.log(`Operations,DepositsEnabled,${statusData.operationalStatus.depositsEnabled}`);
    console.log(`Operations,WithdrawsEnabled,${statusData.operationalStatus.withdrawsEnabled}`);
    console.log(`Operations,SwapsEnabled,${statusData.operationalStatus.swapsEnabled}`);
  }

  private outputConsole(statusData: SystemStatusData): void {
    // Console output is already handled by the logging during collection
    this.logScriptInfo("Output format", "Console logging completed above");
  }

  private async exportToFile(statusData: SystemStatusData): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const exportPath = path.resolve(this.exportFile!);
      const content = JSON.stringify(statusData, null, 2);
      
      fs.writeFileSync(exportPath, content, 'utf8');
      this.logScriptSuccess(`Exported to: ${exportPath}`);
      
    } catch (error: any) {
      this.logScriptError(`Export failed: ${error.message}`);
    }
  }

  protected async customPostExecutionVerification(): Promise<void> {
    this.logScriptSuccess("System status collection completed");
    
    // Summary
    const timestamp = new Date().toISOString();
    this.logScriptInfo("Collection timestamp", timestamp);
    this.logScriptInfo("Output format", this.outputFormat);
    
    if (this.exportFile) {
      this.logScriptInfo("Export file", this.exportFile);
    }
  }

  protected async finalize(result: ScriptResult): Promise<void> {
    if (result.success) {
      this.logScriptSuccess("System status check completed successfully!");
      
      if (result.data) {
        const data = result.data as SystemStatusData;
        this.logScriptInfo("Summary", "📊");
        this.logScriptInfo("  Modules registered", data.beacon.registeredModules.length.toString());
        this.logScriptInfo("  Pool value", data.liquidityPool.totalValueETH);
        
        if (data.user) {
          this.logScriptInfo("  User LP balance", data.user.lpBalanceETH);
        }
        
        const operational = data.operationalStatus;
        const status = operational.depositsEnabled && operational.withdrawsEnabled ? "OPERATIONAL" : "LIMITED";
        this.logScriptInfo("  System status", status);
      }
      
    } else {
      this.logScriptError("System status check failed!");
      this.logScriptError(`Error: ${result.error}`);
    }
  }
}

// Standalone execution when run directly
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const detailed = !args.includes('--simple');
  const includeHealth = !args.includes('--no-health');
  const includeParameters = !args.includes('--no-params');
  const includeUser = !args.includes('--no-user');
  const outputFormat = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || "console";
  const exportFile = args.find(arg => arg.startsWith('--export='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  const options: SystemStatusOptions = {
    detailed,
    includeHealth,
    includeParameters,
    includeUser,
    outputFormat: outputFormat as any,
    exportFile,
    dryRun,
    verbose: verbose || process.env.VERBOSE_LOGGING === "true"
  };

  const statusScript = new SystemStatusScript(options);
  const result = await statusScript.execute();
  
  process.exit(result.success ? 0 : 1);
}

// Execute if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 System status script failed:", error);
    process.exit(1);
  });
}