// SPDX-License-Identifier: MIT
/**
 * @title DebugGas
 * @dev Script per analisi costi gas
 * 
 * CLI Usage:
 *   npx hardhat run scripts/dev/DebugGas.ts --network <network>
 *   --operation=<deposit|withdraw|swap>
 *   --amount=<eth>
 * 
 * Examples:
 *   npx hardhat run scripts/dev/DebugGas.ts --network localhost --operation=deposit --amount=10
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";

interface DebugGasOptions {
  operation: string;
  amount: string;
}

export class DebugGasScript extends BaseScript {
  private debugOptions: DebugGasOptions;
  
  constructor() {
    super();
    this.debugOptions = this.parseDebugOptions();
  }

  protected getScriptName(): string {
    return "DebugGas";
  }

  private parseDebugOptions(): DebugGasOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string, defaultValue: string = ""): string => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : defaultValue;
    };

    return {
      operation: getArg("operation", "deposit"),
      amount: getArg("amount", "1")
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("GAS ANALYSIS");
    Logger.info(`Operation: ${this.debugOptions.operation}`);
    Logger.info(`Amount: ${this.debugOptions.amount} ETH`);

    try {
      const amount = ethers.parseEther(this.debugOptions.amount);
      const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
      const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);

      let gasUsed = BigInt(0);

      if (this.debugOptions.operation === "deposit") {
        const tx = await liquidityManager.deposit({ value: amount, gasLimit: 500000 });
        const receipt = await tx.wait();
        if (receipt) {
          gasUsed = receipt.gasUsed;
        }
      } else if (this.debugOptions.operation === "withdraw") {
        const tx = await liquidityManager.withdraw(amount, { gasLimit: 500000 });
        const receipt = await tx.wait();
        if (receipt) {
          gasUsed = receipt.gasUsed;
        }
      }

      Logger.success(`Gas Used: ${gasUsed.toString()}`);
      
      const gasPrice = await ethers.provider.getFeeData().then(f => f.gasPrice || BigInt(0));
      const costETH = (gasUsed * gasPrice) / BigInt(10**18);
      Logger.info(`Cost: ~${ethers.formatEther(costETH)} ETH`);

      return {
        success: true,
        data: {
          operation: this.debugOptions.operation,
          gasUsed: gasUsed.toString()
        }
      };

    } catch (error: any) {
      Logger.error(`Gas analysis failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

if (require.main === module) {
  const script = new DebugGasScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
