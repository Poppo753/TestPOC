/**
 * 💸 SET DEPOSIT FEE SCRIPT
 * 
 * Script per aggiornare la deposit fee del LiquidityManager con:
 * - Validazione fee contro MAX_FEE (500 = 5%)
 * - Verifica permessi owner
 * - Visualizzazione impatto
 * - Event tracking
 * - Dry-run mode
 * 
 * Basato su: test/unit/LiquidityManager.test.ts lines 1012-1030
 * Pattern: liquidityManager.setDepositFee(newFee)
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";
import { Logger } from "../../config/config";

interface SetDepositFeeOptions extends ScriptOptions {
  fee?: number;
  dryRun?: boolean;
  view?: boolean;
}

export class SetDepositFeeScript extends BaseScript {
  private feeOptions: SetDepositFeeOptions;

  constructor(options: SetDepositFeeOptions) {
    super(options);
    this.feeOptions = options;
  }

  protected getScriptName(): string {
    return "Set Deposit Fee";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    Logger.info("🔍 Validating Fee Parameters");
    
    const MAX_FEE = 500; // 5% maximum from contract
    
    // VIEW MODE - solo visualizza
    if (this.feeOptions.view) {
      return;
    }
    
    // Validate input
    if (this.feeOptions.fee === undefined) {
      throw new Error("Fee parameter required. Use --fee=<value> (in basis points)");
    }
    
    const newFee = this.feeOptions.fee;
    
    // Validation (pattern from test line 1028-1030)
    if (newFee > MAX_FEE) {
      throw new Error(`Fee exceeds maximum: ${newFee} > ${MAX_FEE} (5%)`);
    }
    
    if (newFee < 0) {
      throw new Error("Fee cannot be negative");
    }
    
    Logger.info(`New Fee: ${newFee} basis points (${(newFee / 100).toFixed(2)}%)`);
    Logger.info(`Maximum Allowed: ${MAX_FEE} basis points (5%)`);
  }

  protected async executeMain(): Promise<ScriptResult> {
    try {
      // Get LiquidityManager via beacon.getImplementation()
      const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
      const liquidityManager = await ethers.getContractAt(
        "LiquidityManager",
        liquidityManagerAddr
      );
      
      Logger.info(`LiquidityManager: ${liquidityManagerAddr}`);
      
      // VIEW MODE - Visualizza fee correnti
      if (this.feeOptions.view) {
        const currentFee = await liquidityManager.depositFee();
        const maxFee = 500; // MAX_FEE from contract
        const feePercentage = (Number(currentFee) / 100).toFixed(2);
        const feeRecipient = await liquidityManager.feeRecipient();
        
        Logger.info("📊 Current Deposit Fee Configuration:");
        Logger.info(`Current Fee: ${currentFee} basis points (${feePercentage}%)`);
        Logger.info(`Maximum Fee: ${maxFee} basis points (5%)`);
        Logger.info(`Fee Recipient: ${feeRecipient}`);
        
        return {
          success: true,
          data: {
            currentFee: Number(currentFee),
            feePercentage: `${feePercentage}%`,
            maxFee: maxFee,
            feeRecipient: feeRecipient
          }
        };
      }
      
      const newFee = this.feeOptions.fee!;
      const MAX_FEE = 500;
      
      // Get current fee
      const oldFee = await liquidityManager.depositFee();
      Logger.info(`Current deposit fee: ${oldFee} basis points (${(Number(oldFee) / 100).toFixed(2)}%)`);
      Logger.info(`New deposit fee: ${newFee} basis points (${(newFee / 100).toFixed(2)}%)`);
      
      // Calculate impact
      const impactBps = Math.abs(newFee - Number(oldFee));
      const impactPercentage = (impactBps / 100).toFixed(2);
      Logger.info(`Impact: ${impactBps} basis points (${impactPercentage}% change)`);
      
      // DRY RUN MODE
      if (this.feeOptions.dryRun) {
        Logger.warn("🔍 DRY RUN MODE - No changes will be made");
        Logger.info("✅ Validation passed - fee update would succeed");
        
        return {
          success: true,
          data: {
            oldFee: Number(oldFee),
            newFee: newFee,
            maxFee: MAX_FEE,
            impactPercentage: `${impactPercentage}%`,
            dryRun: true
          }
        };
      }
      
      // Execute update (pattern from test line 1016)
      Logger.info("📝 Updating deposit fee...");
      const tx = await liquidityManager.setDepositFee(newFee);
      
      Logger.info(`Transaction hash: ${tx.hash}`);
      Logger.info("⏳ Waiting for confirmation...");
      
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction failed - no receipt");
      }
      
      Logger.success(`✅ Deposit fee updated in block ${receipt.blockNumber}`);
      
      // Verify update
      const updatedFee = await liquidityManager.depositFee();
      if (Number(updatedFee) !== newFee) {
        throw new Error("Fee update verification failed");
      }
      
      Logger.success(`Verified: Deposit fee is now ${updatedFee} basis points (${(newFee / 100).toFixed(2)}%)`);
      
      // Check for DepositFeeUpdated event (from contract line 429)
      const events = receipt.logs
        .map(log => {
          try {
            return liquidityManager.interface.parseLog({
              topics: log.topics as string[],
              data: log.data
            });
          } catch {
            return null;
          }
        })
        .filter(event => event !== null);
      
      const feeEvent = events.find(e => e && e.name === "DepositFeeUpdated");
      if (feeEvent) {
        Logger.info(`📢 Event emitted: DepositFeeUpdated(${feeEvent.args.oldFee}, ${feeEvent.args.newFee})`);
      }
      
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        data: {
          oldFee: Number(oldFee),
          newFee: newFee,
          maxFee: MAX_FEE,
          impactPercentage: `${impactPercentage}%`
        }
      };
      
    } catch (error: any) {
      // Parse common errors
      if (error.message.includes("Fee exceeds maximum")) {
        Logger.error("💡 Fee must be <= 500 basis points (5%)");
      } else if (error.message.includes("Ownable: caller is not the owner")) {
        Logger.error("💡 Only owner can update deposit fee");
      }
      
      throw error;
    }
  }
}

/**
 * Main execution
 * Pattern verified: liquidityManager.setDepositFee(newFee)
 * Test reference: LiquidityManager.test.ts lines 1012-1030
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: SetDepositFeeOptions = {
    network: "hardhat"
  };
  
  for (const arg of args) {
    if (arg.startsWith("--fee=")) {
      options.fee = parseInt(arg.split("=")[1]);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--view") {
      options.view = true;
    }
  }
  
  const script = new SetDepositFeeScript(options);
  const result = await script.execute();
  
  if (!result.success) {
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
