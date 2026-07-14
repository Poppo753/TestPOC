/**
 * PerformanceReport.ts - System Performance Metrics
 * 
 * ⚠️ CRITICAL PATTERNS:
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 * - Query all major events and calculate gas usage
 * - Track transaction times and throughput
 */

import { ethers } from "hardhat";
import { Beacon, LiquidityManager, SwapManager } from "../../../typechain-types";

interface TransactionMetrics {
  txHash: string;
  blockNumber: number;
  gasUsed: bigint;
  gasPrice: bigint;
  gasCost: bigint;
  timestamp: number;
  functionName: string;
}

interface PerformanceReportData {
  totalTransactions: number;
  totalGasUsed: bigint;
  avgGasPerTx: bigint;
  totalGasCost: bigint;
  avgGasPrice: bigint;
  maxGasUsed: bigint;
  minGasUsed: bigint;
  transactions: TransactionMetrics[];
}

class PerformanceReportMonitor {
  private contracts!: { beacon: Beacon; liquidityManager: LiquidityManager; swapManager: SwapManager };

  async initialize() {
    console.log("🔧 Initializing Performance Report Monitor...");
    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) throw new Error("❌ BEACON_ADDRESS not set");

    this.contracts = {
      beacon: await ethers.getContractAt("Beacon", beaconAddress)
    } as any;

    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    const swapManagerAddr = await this.contracts.beacon.getImplementation("SwapManager");

    this.contracts.liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);
    this.contracts.swapManager = await ethers.getContractAt("SwapManager", swapManagerAddr);

    console.log("✅ Performance Report Monitor initialized");
  }

  async collectTransactionMetrics(fromBlock?: number, toBlock?: number | string): Promise<TransactionMetrics[]> {
    const metrics: TransactionMetrics[] = [];

    // Collect Deposit transactions
    const depositFilter = this.contracts.liquidityManager.filters.Deposit();
    const depositEvents = await this.contracts.liquidityManager.queryFilter(depositFilter, fromBlock, toBlock);

    for (const event of depositEvents) {
      const receipt = await event.getTransactionReceipt();
      const block = await event.getBlock();
      
      metrics.push({
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        gasUsed: receipt.gasUsed,
        gasPrice: receipt.gasPrice,
        gasCost: receipt.gasUsed * receipt.gasPrice,
        timestamp: block.timestamp,
        functionName: "deposit"
      });
    }

    // Collect Swap transactions
    const swapFilter = this.contracts.swapManager.filters["SwapExecuted(string,string,uint256,uint256,uint256,address)"]();
    const swapEvents = await this.contracts.swapManager.queryFilter(swapFilter, fromBlock, toBlock);

    for (const event of swapEvents) {
      const receipt = await event.getTransactionReceipt();
      const block = await event.getBlock();
      
      metrics.push({
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        gasUsed: receipt.gasUsed,
        gasPrice: receipt.gasPrice,
        gasCost: receipt.gasUsed * receipt.gasPrice,
        timestamp: block.timestamp,
        functionName: "swap"
      });
    }

    return metrics.sort((a, b) => a.blockNumber - b.blockNumber);
  }

  async generateReport(fromBlock?: number, toBlock?: number | string): Promise<PerformanceReportData> {
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║  SYSTEM PERFORMANCE ANALYSIS REPORT    ║");
    console.log("╚════════════════════════════════════════╝");

    const transactions = await this.collectTransactionMetrics(fromBlock, toBlock);

    if (transactions.length === 0) {
      console.log("\n⚠️ No transactions found");
      return {
        totalTransactions: 0,
        totalGasUsed: 0n,
        avgGasPerTx: 0n,
        totalGasCost: 0n,
        avgGasPrice: 0n,
        maxGasUsed: 0n,
        minGasUsed: 0n,
        transactions: []
      };
    }

    const totalGasUsed = transactions.reduce((sum, tx) => sum + tx.gasUsed, 0n);
    const totalGasCost = transactions.reduce((sum, tx) => sum + tx.gasCost, 0n);
    const totalGasPrice = transactions.reduce((sum, tx) => sum + tx.gasPrice, 0n);

    const gasUsedArray = transactions.map(tx => tx.gasUsed);
    const maxGasUsed = gasUsedArray.reduce((max, val) => val > max ? val : max, 0n);
    const minGasUsed = gasUsedArray.reduce((min, val) => val < min ? val : min, maxGasUsed);

    console.log(`\n📊 Total transactions: ${transactions.length}`);
    console.log(`   Total gas used: ${totalGasUsed.toString()}`);
    console.log(`   Avg gas per tx: ${(totalGasUsed / BigInt(transactions.length)).toString()}`);
    console.log(`   Total gas cost: ${ethers.formatEther(totalGasCost)} ETH`);
    console.log(`   Max gas used: ${maxGasUsed.toString()}`);
    console.log(`   Min gas used: ${minGasUsed.toString()}`);

    return {
      totalTransactions: transactions.length,
      totalGasUsed,
      avgGasPerTx: totalGasUsed / BigInt(transactions.length),
      totalGasCost,
      avgGasPrice: totalGasPrice / BigInt(transactions.length),
      maxGasUsed,
      minGasUsed,
      transactions
    };
  }
}

async function main() {
  const monitor = new PerformanceReportMonitor();
  await monitor.initialize();
  await monitor.generateReport();
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}

export { PerformanceReportMonitor, PerformanceReportData, TransactionMetrics };
