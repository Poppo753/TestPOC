/**
 * 🛠️ BASE SCRIPT CLASS
 * Classe base per tutti gli script di interazione con standardizzazione di:
 * - Logging
 * - Error handling 
 * - Configuration validation
 * - Result formatting
 * - Execution patterns
 */

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  getAllContracts, 
  NETWORK_CONFIG, 
  Logger, 
  showConfig, 
  validateConfig 
} from "../config/config";

// Tipo per le istanze dei contratti (inferito da getAllContracts)
type ContractInstances = Awaited<ReturnType<typeof getAllContracts>>;

// 📋 Standard Interfaces per tutti gli script
export interface ScriptConfig {
  verbose?: boolean;
  dryRun?: boolean;
  confirmations?: number;
  gasLimit?: number;
  skipValidation?: boolean;
}

export interface ScriptResult {
  success: boolean;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: bigint;
  result?: any;
  error?: string;
  executionTime?: number;
  data?: { [key: string]: any }; // Per dati aggiuntivi specifici dello script
}

export interface ScriptOptions extends ScriptConfig {
  [key: string]: any; // Per parametri specifici degli script
}

// 🎯 Abstract Base Class per tutti gli script
export abstract class BaseScript {
  protected signer!: SignerWithAddress; // Initialized in setup()
  protected contracts!: ContractInstances; // Initialized in setup()
  protected options: ScriptOptions;
  protected startTime: number;

  constructor(options: ScriptOptions = {}) {
    this.options = {
      verbose: process.env.VERBOSE_LOGGING === "true",
      confirmations: NETWORK_CONFIG.confirmations,
      gasLimit: NETWORK_CONFIG.gasLimit,
      dryRun: false,
      skipValidation: false,
      ...options
    };
    this.startTime = Date.now();
  }

  // 🔧 Setup standardizzato per tutti gli script
  protected async setup(): Promise<void> {
    Logger.section(`${this.getScriptName()} Setup`);
    
    // Validazione configurazione
    if (!this.options.skipValidation) {
      const validation = validateConfig();
      if (!validation.isValid) {
        Logger.error("Configuration errors found:");
        validation.errors.forEach(error => Logger.error(`   - ${error}`));
        throw new Error("Invalid configuration");
      }
    }

    // Setup signer
    const [deployer] = await ethers.getSigners();
    this.signer = deployer;
    Logger.info(`Using account: ${this.signer.address}`);
    
    const balance = await this.signer.provider.getBalance(this.signer.address);
    Logger.info(`Account balance: ${ethers.formatEther(balance)} ETH`);

    // Mostra configurazione se verbose
    if (this.options.verbose) {
      showConfig();
    }

    // Connetti contratti
    this.contracts = await getAllContracts();
    Logger.success("Setup completed successfully");
  }

  // 📊 Pre-execution checks standardizzati
  protected async preExecutionChecks(): Promise<void> {
    Logger.section(`${this.getScriptName()} Pre-Execution Checks`);
    
    // Verifica stato dei contratti base
    try {
      const poolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
      Logger.info(`Current Pool Value: ${ethers.formatEther(poolValue)} ETH`);
    } catch (error) {
      Logger.info("Pool Value: Unable to fetch (possibly empty pool)");
    }

    // Verifica balance LP dell'utente
    const userLPBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
    Logger.info(`User LP Balance: ${ethers.formatEther(userLPBalance)} LP`);

    // Hook per checks specifici dello script
    await this.customPreExecutionChecks();
  }

  // 🚀 Esecuzione transazione standardizzata
  protected async executeTransaction(
    txPromise: Promise<any>,
    description: string = "Transaction"
  ): Promise<ScriptResult> {
    Logger.section(`Executing ${description}`);
    
    if (this.options.dryRun) {
      Logger.info("DRY RUN MODE - Transaction will not be executed");
      return {
        success: true,
        result: "Dry run completed"
      };
    }

    try {
      const tx = await txPromise;
      Logger.info(`Transaction hash: ${tx.hash}`);
      Logger.info("Waiting for confirmation...");
      
      const receipt = await tx.wait(this.options.confirmations);
      
      if (receipt) {
        Logger.success(`Transaction confirmed in block: ${receipt.blockNumber}`);
        Logger.info(`Gas used: ${receipt.gasUsed.toString()}`);
        
        return {
          success: true,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          executionTime: Date.now() - this.startTime
        };
      } else {
        throw new Error("Transaction receipt not available");
      }

    } catch (error: any) {
      Logger.error(`${description} failed: ${error.message}`);
      
      // Enhanced error handling per errori specifici
      if (error.code === 'INSUFFICIENT_FUNDS') {
        Logger.error("Insufficient ETH balance for transaction");
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        Logger.error("Transaction would likely fail - check parameters");
      }
      
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - this.startTime
      };
    }
  }

  // 📈 Post-execution verification standardizzata
  protected async postExecutionVerification(): Promise<void> {
    Logger.section(`${this.getScriptName()} Post-Execution Verification`);
    
    try {
      // Stato generale del pool
      const newPoolValue = await this.contracts.valueCalculator.getTotalPoolValueView();
      Logger.info(`New Pool Value: ${ethers.formatEther(newPoolValue)} ETH`);
      
      const newUserLPBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
      Logger.info(`New User LP Balance: ${ethers.formatEther(newUserLPBalance)} LP`);

      // Hook per verifiche specifiche dello script
      await this.customPostExecutionVerification();

    } catch (error: any) {
      Logger.error(`Error in post-execution verification: ${error.message}`);
    }
  }

  // 🎯 Template method pattern - main execution flow
  public async execute(): Promise<ScriptResult> {
    try {
      Logger.section(`🚀 EXECUTING ${this.getScriptName().toUpperCase()}`);
      
      // Setup standardizzato
      await this.setup();
      
      // Pre-execution checks
      await this.preExecutionChecks();
      
      // Esecuzione principale (implementata dalle sottoclassi)
      const result = await this.executeMain();
      
      // Post-execution verification
      if (result.success) {
        await this.postExecutionVerification();
      }
      
      // Finalize
      await this.finalize(result);
      
      const totalTime = Date.now() - this.startTime;
      Logger.success(`${this.getScriptName()} completed in ${totalTime}ms`);
      
      return {
        ...result,
        executionTime: totalTime
      };

    } catch (error: any) {
      Logger.error(`💥 ${this.getScriptName()} failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - this.startTime
      };
    }
  }

  // 🔧 Abstract methods da implementare nelle sottoclassi
  protected abstract getScriptName(): string;
  protected abstract executeMain(): Promise<ScriptResult>;
  
  // 🎯 Optional hooks per customizzazione
  protected async customPreExecutionChecks(): Promise<void> {
    // Override in sottoclassi se necessario
  }
  
  protected async customPostExecutionVerification(): Promise<void> {
    // Override in sottoclassi se necessario  
  }
  
  protected async finalize(result: ScriptResult): Promise<void> {
    // Override in sottoclassi per cleanup o reporting finale
  }

  // 🛠️ Utility methods per le sottoclassi
  protected formatETH(amount: bigint): string {
    return ethers.formatEther(amount);
  }
  
  protected parseETH(amount: string): bigint {
    return ethers.parseEther(amount);
  }
  
  protected async getCurrentGasPrice(): Promise<bigint> {
    return await this.signer.provider.getFeeData().then(data => data.gasPrice || 0n);
  }
  
  protected logScriptInfo(key: string, value: any): void {
    Logger.info(`${key}: ${value}`);
  }
  
  protected logScriptSuccess(message: string): void {
    Logger.success(message);
  }
  
  protected logScriptError(message: string): void {
    Logger.error(message);
  }
}

// 🎯 Factory per creazione rapida di script semplici
export class SimpleScript extends BaseScript {
  private scriptName: string;
  private mainFunction: (script: SimpleScript) => Promise<ScriptResult>;

  constructor(
    name: string, 
    mainFunction: (script: SimpleScript) => Promise<ScriptResult>,
    options: ScriptOptions = {}
  ) {
    super(options);
    this.scriptName = name;
    this.mainFunction = mainFunction;
  }

  protected getScriptName(): string {
    return this.scriptName;
  }

  protected async executeMain(): Promise<ScriptResult> {
    return await this.mainFunction(this);
  }
}

// 📦 Export tutto per utilizzazione facile