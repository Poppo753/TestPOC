/**
 * ExportTransactions.ts - Transaction Export
 * 
 * ⚠️ CRITICAL PATTERNS:
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 * - Query events: Deposit, Withdrawn, SwapExecuted
 * - Export to JSON/CSV format
 */

import { ethers } from "hardhat";
import { Beacon, LiquidityManager, SwapManager } from "../../../typechain-types";

interface TransactionExport {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  type: "deposit" | "withdraw" | "swap";
  user: string;
  amount: string;
  details: any;
}

class TransactionExporter {
  private contracts!: { beacon: Beacon; liquidityManager: LiquidityManager; swapManager: SwapManager };

  async initialize() {
    console.log("🔧 Initializing Transaction Exporter...");
    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) throw new Error("❌ BEACON_ADDRESS not set");

    this.contracts = {
      beacon: await ethers.getContractAt("Beacon", beaconAddress)
    } as any;

    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    const swapManagerAddr = await this.contracts.beacon.getImplementation("SwapManager");

    this.contracts.liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);
    this.contracts.swapManager = await ethers.getContractAt("SwapManager", swapManagerAddr);

    console.log("✅ Transaction Exporter initialized");
  }

  async exportTransactions(fromBlock?: number, toBlock?: number | string): Promise<TransactionExport[]> {
    console.log("\n📊 Exporting transactions...");
    const transactions: TransactionExport[] = [];

    // Export Deposits
    const depositFilter = this.contracts.liquidityManager.filters.Deposit();
    const depositEvents = await this.contracts.liquidityManager.queryFilter(depositFilter, fromBlock, toBlock);

    for (const event of depositEvents) {
      const block = await event.getBlock();
      transactions.push({
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: block.timestamp,
        type: "deposit",
        user: event.args.user,
        amount: ethers.formatEther(event.args.ethAmount),
        details: {
          sharesReceived: event.args.sharesReceived.toString(),
          totalPoolETH: event.args.totalPoolETH.toString(),
          totalSupply: event.args.totalSupply.toString()
        }
      });
    }

    // Export Withdrawals
    const withdrawFilter = this.contracts.liquidityManager.filters.Withdrawn();
    const withdrawEvents = await this.contracts.liquidityManager.queryFilter(withdrawFilter, fromBlock, toBlock);

    for (const event of withdrawEvents) {
      const block = await event.getBlock();
      transactions.push({
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: block.timestamp,
        type: "withdraw",
        user: event.args.user,
        amount: ethers.formatEther(event.args.ethAmount),
        details: {
          shares: event.args.shares.toString(),
          totalPoolValue: event.args.totalPoolValue.toString(),
          remainingPoolBalance: event.args.remainingPoolBalance.toString()
        }
      });
    }

    // Export Swaps
    const swapFilter = this.contracts.swapManager.filters["SwapExecuted(string,string,uint256,uint256,uint256,address)"]();
    const swapEvents = await this.contracts.swapManager.queryFilter(swapFilter, fromBlock, toBlock);

    for (const event of swapEvents) {
      const block = await event.getBlock();
      transactions.push({
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: block.timestamp,
        type: "swap",
        user: event.args.executor,
        amount: event.args.amountIn.toString(),
        details: {
          tokenIn: event.args.tokenIn,
          tokenOut: event.args.tokenOut,
          amountOut: event.args.amountOut.toString(),
          slippageBps: event.args.slippageBps.toString()
        }
      });
    }

    transactions.sort((a, b) => a.blockNumber - b.blockNumber);
    console.log(`   Exported ${transactions.length} transactions`);

    return transactions;
  }

  async exportToJSON(transactions: TransactionExport[], filename: string = "transactions.json") {
    const fs = await import("fs");
    const path = await import("path");

    const outputDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(transactions, null, 2));
    
    console.log(`\n💾 Transactions exported to: ${filepath}`);
  }
}

async function main() {
  const exporter = new TransactionExporter();
  await exporter.initialize();
  
  const transactions = await exporter.exportTransactions();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await exporter.exportToJSON(transactions, `transactions-${timestamp}.json`);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}

export { TransactionExporter, TransactionExport };
