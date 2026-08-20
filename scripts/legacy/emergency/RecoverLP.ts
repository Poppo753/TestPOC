// SPDX-License-Identifier: MIT
/**
 * @title RecoverLP
 * @dev Script per recovery LP tokens di utenti in situazione di emergency
 * 
 * Basato su pattern da:
 * - test/integration/Emergency.integration.test.ts (LP token management)
 * - test/integration/Withdraw.integration.test.ts (withdraw patterns)
 * - ProxyGeneral.sol (balanceOf, transfer functions)
 * 
 * Funzionalità:
 * 1. User LP Recovery: Recupero LP tokens di specific user
 * 2. Batch Recovery: Recupero LP di multiple users
 * 3. Emergency Liquidation: Conversione LP → ETH/WETH
 * 4. Position Closure: Chiusura posizioni bloccate
 * 
 * CLI Usage:
 *   npx hardhat run scripts/emergency/RecoverLP.ts --network <network>
 *   --user=<address>               (user address per recovery)
 *   --amount=<value>               (quantità LP tokens, opzionale = all)
 *   --to=<address>                 (destinatario, default = user stesso)
 *   --liquidate                    (converti LP in ETH/WETH)
 *   --batch=<file.json>            (file con lista users)
 *   --dry-run                      (simula senza eseguire)
 * 
 * Examples:
 *   npx hardhat run scripts/emergency/RecoverLP.ts --network localhost --user=0x123...
 *   npx hardhat run scripts/emergency/RecoverLP.ts --network localhost --user=0x123... --amount=100 --to=0xabc...
 *   npx hardhat run scripts/emergency/RecoverLP.ts --network localhost --user=0x123... --liquidate
 *   npx hardhat run scripts/emergency/RecoverLP.ts --network localhost --batch=users.json --dry-run
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";
import * as fs from "fs";

interface RecoverLPOptions {
  user?: string;
  amount?: string;
  to?: string;
  liquidate: boolean;
  batchFile?: string;
  dryRun: boolean;
}

interface LPRecoveryResult {
  user: string;
  lpAmount: bigint;
  recipient: string;
  liquidated: boolean;
  ethReceived?: bigint;
  txHash?: string;
  success: boolean;
  error?: string;
}

/**
 * @notice Script per emergency LP tokens recovery
 * @dev Pattern da Emergency.integration.test.ts + Withdraw flows
 */
export class RecoverLPScript extends BaseScript {
  private recoveryOptions: RecoverLPOptions;
  private results: LPRecoveryResult[] = [];
  
  constructor() {
    super();
    this.recoveryOptions = this.parseOptions();
  }

  protected getScriptName(): string {
    return "RecoverLP";
  }

  /**
   * @notice Parse CLI arguments
   */
  private parseOptions(): RecoverLPOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string): string | undefined => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : undefined;
    };
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    return {
      user: getArg("user"),
      amount: getArg("amount"),
      to: getArg("to"),
      liquidate: hasFlag("liquidate"),
      batchFile: getArg("batch"),
      dryRun: hasFlag("dry-run")
    };
  }

  /**
   * @notice Entry point
   */
  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("EMERGENCY LP TOKENS RECOVERY");
    Logger.info(`Mode: ${this.recoveryOptions.batchFile ? "BATCH" : "SINGLE USER"}`);
    Logger.info(`Liquidate: ${this.recoveryOptions.liquidate ? "YES" : "NO"}`);
    Logger.info(`Dry Run: ${this.recoveryOptions.dryRun ? "YES" : "NO"}`);

    try {
      // Step 1: Verify system
      await this.verifySystem();

      // Step 2: Execute recovery
      if (this.recoveryOptions.batchFile) {
        await this.recoverBatch();
      } else if (this.recoveryOptions.user) {
        await this.recoverSingleUser();
      } else {
        throw new Error("Must specify --user=<address> or --batch=<file.json>");
      }

      // Step 3: Report results
      this.reportResults();

      return {
        success: true,
        data: {
          message: "LP recovery completed",
          results: this.results
        }
      };

    } catch (error: any) {
      Logger.error(`Recovery failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * @notice Verify system contracts
   */
  private async verifySystem(): Promise<void> {
    Logger.section("VERIFYING SYSTEM");

    const proxyAddr = await this.contracts.beacon.getImplementation("ProxyGeneral");
    if (proxyAddr === ethers.ZeroAddress) {
      throw new Error("ProxyGeneral not found");
    }

    const liquidityAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    if (liquidityAddr === ethers.ZeroAddress) {
      throw new Error("LiquidityManager not found");
    }

    Logger.success(`ProxyGeneral: ${proxyAddr}`);
    Logger.success(`LiquidityManager: ${liquidityAddr}`);
  }

  /**
   * @notice Recover LP for single user
   * @dev Pattern: proxyGeneral.balanceOf() + transfer logic
   */
  private async recoverSingleUser(): Promise<void> {
    if (!this.recoveryOptions.user) {
      throw new Error("User address required");
    }

    Logger.section(`RECOVERING LP FOR USER: ${this.recoveryOptions.user}`);

    const proxyAddr = await this.contracts.beacon.getImplementation("ProxyGeneral");
    const proxy = await ethers.getContractAt("ProxyGeneral", proxyAddr);

    // Get user LP balance
    const userBalance = await proxy.balanceOf(this.recoveryOptions.user);
    Logger.info(`User LP Balance: ${ethers.formatEther(userBalance)} LP`);

    if (userBalance === BigInt(0)) {
      Logger.warn("User has 0 LP tokens");
      return;
    }

    // Determine amount to recover
    const amountToRecover = this.recoveryOptions.amount 
      ? ethers.parseEther(this.recoveryOptions.amount)
      : userBalance;

    if (amountToRecover > userBalance) {
      throw new Error(`Insufficient LP balance. User has ${ethers.formatEther(userBalance)} LP`);
    }

    // Determine recipient
    const recipient = this.recoveryOptions.to || this.recoveryOptions.user;

    Logger.info(`Amount to recover: ${ethers.formatEther(amountToRecover)} LP`);
    Logger.info(`Recipient: ${recipient}`);

    if (this.recoveryOptions.dryRun) {
      Logger.warn("DRY RUN - No actual recovery");
      this.results.push({
        user: this.recoveryOptions.user,
        lpAmount: amountToRecover,
        recipient,
        liquidated: this.recoveryOptions.liquidate,
        success: true
      });
      return;
    }

    // Execute recovery
    if (this.recoveryOptions.liquidate) {
      await this.liquidateLPPosition(this.recoveryOptions.user, amountToRecover, recipient);
    } else {
      await this.transferLP(this.recoveryOptions.user, recipient, amountToRecover);
    }
  }

  /**
   * @notice Liquidate LP position → ETH/WETH
   * @dev Pattern: liquidityManager.withdraw() from Withdraw.integration.test.ts
   */
  private async liquidateLPPosition(user: string, lpAmount: bigint, recipient: string): Promise<void> {
    Logger.section("LIQUIDATING LP POSITION");

    const liquidityAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityAddr);

    Logger.info("Executing withdraw to convert LP → ETH/WETH...");

    // This would require the user's signature or admin override
    // For emergency, we assume admin can execute on behalf
    Logger.warn("Note: Liquidation requires special permissions or user signature");
    Logger.warn("This is a placeholder - actual implementation needs emergency withdrawal function");

    // Placeholder result
    this.results.push({
      user,
      lpAmount,
      recipient,
      liquidated: true,
      success: false,
      error: "Liquidation requires emergency withdrawal function in LiquidityManager"
    });
  }

  /**
   * @notice Transfer LP tokens to recipient
   * @dev Pattern: ERC20 transfer (ProxyGeneral is ERC20)
   * 
   * ⚠️ LIMITATION: ProxyGeneral non ha funzione admin per trasferire LP di altri utenti.
   * Le opzioni disponibili sono:
   * 1. transfer(to, amount) - trasferisce LP del CALLER (questo script)
   * 2. transferFrom(from, to, amount) - richiede approval dall'utente
   * 3. Non esiste emergencyTransferLP(user, to, amount) nel contratto
   * 
   * Per recovery LP in emergency servirebbero:
   * - Approval preventiva dall'utente, oppure
   * - Nuova funzione admin nel ProxyGeneral per emergency LP transfer
   */
  private async transferLP(user: string, recipient: string, amount: bigint): Promise<void> {
    Logger.section("TRANSFERRING LP TOKENS");

    const proxyAddr = await this.contracts.beacon.getImplementation("ProxyGeneral");
    const proxy = await ethers.getContractAt("ProxyGeneral", proxyAddr);

    Logger.error("❌ LP TRANSFER NOT POSSIBLE");
    Logger.warn("ProxyGeneral does not have admin function to transfer LP tokens of other users");
    Logger.warn("Available options:");
    Logger.warn("  1. User must approve this script address first");
    Logger.warn("  2. Use transferFrom() after approval");
    Logger.warn("  3. Add new emergency LP transfer function to ProxyGeneral contract");
    
    Logger.info(`User: ${user}`);
    Logger.info(`Recipient: ${recipient}`);
    Logger.info(`Amount: ${ethers.formatEther(amount)} LP`);

    // This functionality is not implemented due to contract limitations
    this.results.push({
      user,
      lpAmount: amount,
      recipient,
      liquidated: false,
      success: false,
      error: "LP transfer requires approval or new admin function in ProxyGeneral"
    });

    /* IMPLEMENTATION NOTES:
     * Per implementare questa funzionalità servirebbero:
     * 
     * Option A - Con Approval:
     *   const allowance = await proxy.allowance(user, this.signer.address);
     *   if (allowance >= amount) {
     *     const tx = await proxy.transferFrom(user, recipient, amount);
     *     const receipt = await tx.wait();
     *   }
     * 
     * Option B - Nuova funzione nel contratto:
     *   function emergencyTransferLP(address from, address to, uint256 amount) 
     *     external onlyOwner whenPaused {
     *       _transfer(from, to, amount);
     *   }
     */
  }

  /**
   * @notice Recover LP for batch of users
   */
  private async recoverBatch(): Promise<void> {
    if (!this.recoveryOptions.batchFile) {
      throw new Error("Batch file required");
    }

    Logger.section(`BATCH RECOVERY FROM: ${this.recoveryOptions.batchFile}`);

    // Load batch file
    if (!fs.existsSync(this.recoveryOptions.batchFile)) {
      throw new Error(`Batch file not found: ${this.recoveryOptions.batchFile}`);
    }

    const batchData = JSON.parse(fs.readFileSync(this.recoveryOptions.batchFile, "utf-8"));
    const users: string[] = batchData.users || [];

    Logger.info(`Total users to process: ${users.length}`);

    for (const user of users) {
      try {
        this.recoveryOptions.user = user;
        await this.recoverSingleUser();
      } catch (error: any) {
        Logger.error(`Failed for user ${user}: ${error.message}`);
      }
    }
  }

  /**
   * @notice Report recovery results
   */
  private reportResults(): void {
    Logger.section("RECOVERY SUMMARY");

    Logger.info(`Total Recoveries: ${this.results.length}`);
    
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.length - successful;

    Logger.success(`Successful: ${successful}`);
    if (failed > 0) {
      Logger.error(`Failed: ${failed}`);
    }

    for (const result of this.results) {
      Logger.section(`User: ${result.user.slice(0, 10)}...`);
      Logger.info(`LP Amount: ${ethers.formatEther(result.lpAmount)} LP`);
      Logger.info(`Recipient: ${result.recipient.slice(0, 10)}...`);
      Logger.info(`Liquidated: ${result.liquidated ? "YES" : "NO"}`);
      Logger.info(`Status: ${result.success ? "✅ SUCCESS" : "❌ FAILED"}`);
      if (result.error) {
        Logger.error(`Error: ${result.error}`);
      }
      if (result.txHash) {
        Logger.info(`TX: ${result.txHash}`);
      }
    }
  }
}

if (require.main === module) {
  const script = new RecoverLPScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
