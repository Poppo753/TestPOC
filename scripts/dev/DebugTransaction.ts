// SPDX-License-Identifier: MIT
/**
 * @title DebugTransaction
 * @dev Script per debug transazioni fallite
 * 
 * CLI Usage:
 *   npx hardhat run scripts/dev/DebugTransaction.ts --network <network>
 *   --tx=<txHash>                  (transaction hash to debug)
 *   --decode                       (decode revert reason)
 * 
 * Examples:
 *   npx hardhat run scripts/dev/DebugTransaction.ts --network localhost --tx=0x123... --decode
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";

interface DebugTxOptions {
  tx: string;
  decode: boolean;
}

export class DebugTransactionScript extends BaseScript {
  private debugOptions: DebugTxOptions;
  
  constructor() {
    super();
    this.debugOptions = this.parseDebugOptions();
  }

  protected getScriptName(): string {
    return "DebugTransaction";
  }

  private parseDebugOptions(): DebugTxOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string, defaultValue: string = ""): string => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : defaultValue;
    };
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    return {
      tx: getArg("tx"),
      decode: hasFlag("decode")
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("TRANSACTION DEBUG");
    Logger.info(`TX Hash: ${this.debugOptions.tx}`);

    try {
      const tx = await ethers.provider.getTransaction(this.debugOptions.tx);
      
      if (!tx) {
        throw new Error("Transaction not found");
      }

      Logger.info(`From: ${tx.from}`);
      Logger.info(`To: ${tx.to}`);
      Logger.info(`Value: ${ethers.formatEther(tx.value)} ETH`);
      Logger.info(`Gas Limit: ${tx.gasLimit.toString()}`);

      const receipt = await ethers.provider.getTransactionReceipt(this.debugOptions.tx);
      
      if (receipt) {
        Logger.info(`Status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
        Logger.info(`Gas Used: ${receipt.gasUsed.toString()}`);
        Logger.info(`Block: ${receipt.blockNumber}`);

        if (receipt.status === 0 && this.debugOptions.decode) {
          Logger.section("REVERT REASON");
          try {
            const txRequest = {
              to: tx.to,
              from: tx.from,
              data: tx.data,
              value: tx.value
            };
            await ethers.provider.call(txRequest);
          } catch (error: any) {
            Logger.error(`Revert: ${error.message}`);
          }
        }
      }

      return {
        success: true,
        data: { tx: this.debugOptions.tx, status: receipt?.status }
      };

    } catch (error: any) {
      Logger.error(`Debug failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

if (require.main === module) {
  const script = new DebugTransactionScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
