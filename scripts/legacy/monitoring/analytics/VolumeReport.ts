/**
 * VolumeReport.ts - Trading Volume Analysis
 * 
 * ⚠️ CRITICAL PATTERNS (from contracts and tests):
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 * - SwapManager emits SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, slippageBps, executor)
 * - Query events: contract.queryFilter(contract.filters.SwapExecuted())
 * - Reference: contracts/SwapManager.sol lines 85-92, test/integration/SF-001.SwapOperations
 */

import { ethers } from "hardhat";
import { Beacon, SwapManager } from "../../../typechain-types";

interface SwapEventData {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  slippageBps: bigint;
  executor: string;
  blockNumber: number;
  timestamp: number;
  transactionHash: string;
}

interface VolumeByToken {
  tokenCode: string;
  volumeIn: bigint;
  volumeOut: bigint;
  swapCount: number;
  avgAmountIn: bigint;
  avgAmountOut: bigint;
}

interface VolumeByPair {
  tokenIn: string;
  tokenOut: string;
  volumeIn: bigint;
  volumeOut: bigint;
  swapCount: number;
  avgSlippageBps: bigint;
}

interface VolumeReportData {
  totalSwaps: number;
  totalVolumeIn: bigint;
  totalVolumeOut: bigint;
  volumeByToken: VolumeByToken[];
  volumeByPair: VolumeByPair[];
  topExecutors: { address: string; swapCount: number }[];
  avgSlippageBps: bigint;
  startBlock: number;
  endBlock: number;
  startTimestamp: number;
  endTimestamp: number;
}

interface ContractSetup {
  beacon: Beacon;
  swapManager: SwapManager;
}

class VolumeReportMonitor {
  private contracts!: ContractSetup;

  /**
   * Initialize contracts from deployed addresses
   * Pattern: beacon.getImplementation() - test/integration/BeaconModules.integration.test.ts
   */
  async initialize() {
    console.log("🔧 Initializing Volume Report Monitor...");

    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) {
      throw new Error("❌ BEACON_ADDRESS not set in environment");
    }

    this.contracts = {
      beacon: await ethers.getContractAt("Beacon", beaconAddress)
    } as ContractSetup;

    // Pattern: ALWAYS use beacon.getImplementation() NOT getModule()
    // Reference: test/integration/LiquidityFlow.integration.test.ts line 127
    const swapManagerAddr = await this.contracts.beacon.getImplementation("SwapManager");
    this.contracts.swapManager = await ethers.getContractAt("SwapManager", swapManagerAddr);

    console.log("✅ Volume Report Monitor initialized");
    console.log(`   📍 Beacon: ${beaconAddress}`);
    console.log(`   🔄 SwapManager: ${swapManagerAddr}`);
  }

  /**
   * Query SwapExecuted events from SwapManager
   * Pattern: contract.queryFilter(filter, fromBlock, toBlock)
   * Event: SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, slippageBps, executor)
   * Reference: contracts/SwapManager.sol line 85
   */
  async getSwapEvents(
    fromBlock?: number,
    toBlock?: number | string
  ): Promise<SwapEventData[]> {
    console.log("\n📊 Querying SwapExecuted events...");
    console.log(`   From block: ${fromBlock ?? "earliest"}`);
    console.log(`   To block: ${toBlock ?? "latest"}`);

    // Create filter for SwapExecuted events
    // Pattern: Use full event signature because SwapManager has 2 SwapExecuted events
    // We want: SwapExecuted(string indexed tokenIn, string indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 slippageBps, address indexed executor)
    const filter = this.contracts.swapManager.filters["SwapExecuted(string,string,uint256,uint256,uint256,address)"]();

    // Query events
    const events = await this.contracts.swapManager.queryFilter(
      filter,
      fromBlock,
      toBlock
    );

    console.log(`   Found ${events.length} swap events`);

    // Parse events into structured data
    const swapData: SwapEventData[] = [];

    for (const event of events) {
      const block = await event.getBlock();
      
      swapData.push({
        tokenIn: event.args.tokenIn,
        tokenOut: event.args.tokenOut,
        amountIn: event.args.amountIn,
        amountOut: event.args.amountOut,
        slippageBps: event.args.slippageBps,
        executor: event.args.executor,
        blockNumber: event.blockNumber,
        timestamp: block.timestamp,
        transactionHash: event.transactionHash
      });
    }

    return swapData;
  }

  /**
   * Aggregate volume by token code
   */
  aggregateVolumeByToken(swaps: SwapEventData[]): VolumeByToken[] {
    const tokenMap = new Map<string, {
      volumeIn: bigint;
      volumeOut: bigint;
      countIn: number;
      countOut: number;
    }>();

    // Aggregate volumes
    for (const swap of swaps) {
      // Token used as input
      if (!tokenMap.has(swap.tokenIn)) {
        tokenMap.set(swap.tokenIn, { volumeIn: 0n, volumeOut: 0n, countIn: 0, countOut: 0 });
      }
      const tokenInData = tokenMap.get(swap.tokenIn)!;
      tokenInData.volumeIn += swap.amountIn;
      tokenInData.countIn++;

      // Token received as output
      if (!tokenMap.has(swap.tokenOut)) {
        tokenMap.set(swap.tokenOut, { volumeIn: 0n, volumeOut: 0n, countIn: 0, countOut: 0 });
      }
      const tokenOutData = tokenMap.get(swap.tokenOut)!;
      tokenOutData.volumeOut += swap.amountOut;
      tokenOutData.countOut++;
    }

    // Convert to array
    const result: VolumeByToken[] = [];
    for (const [tokenCode, data] of tokenMap.entries()) {
      result.push({
        tokenCode,
        volumeIn: data.volumeIn,
        volumeOut: data.volumeOut,
        swapCount: data.countIn + data.countOut,
        avgAmountIn: data.countIn > 0 ? data.volumeIn / BigInt(data.countIn) : 0n,
        avgAmountOut: data.countOut > 0 ? data.volumeOut / BigInt(data.countOut) : 0n
      });
    }

    // Sort by total volume
    result.sort((a, b) => {
      const volA = a.volumeIn + a.volumeOut;
      const volB = b.volumeIn + b.volumeOut;
      return volB > volA ? 1 : -1;
    });

    return result;
  }

  /**
   * Aggregate volume by trading pair
   */
  aggregateVolumeByPair(swaps: SwapEventData[]): VolumeByPair[] {
    const pairMap = new Map<string, {
      volumeIn: bigint;
      volumeOut: bigint;
      swapCount: number;
      totalSlippageBps: bigint;
    }>();

    // Aggregate by pair
    for (const swap of swaps) {
      const pairKey = `${swap.tokenIn}-${swap.tokenOut}`;
      
      if (!pairMap.has(pairKey)) {
        pairMap.set(pairKey, {
          volumeIn: 0n,
          volumeOut: 0n,
          swapCount: 0,
          totalSlippageBps: 0n
        });
      }

      const pairData = pairMap.get(pairKey)!;
      pairData.volumeIn += swap.amountIn;
      pairData.volumeOut += swap.amountOut;
      pairData.swapCount++;
      pairData.totalSlippageBps += swap.slippageBps;
    }

    // Convert to array
    const result: VolumeByPair[] = [];
    for (const [pairKey, data] of pairMap.entries()) {
      const [tokenIn, tokenOut] = pairKey.split('-');
      result.push({
        tokenIn,
        tokenOut,
        volumeIn: data.volumeIn,
        volumeOut: data.volumeOut,
        swapCount: data.swapCount,
        avgSlippageBps: data.swapCount > 0 ? data.totalSlippageBps / BigInt(data.swapCount) : 0n
      });
    }

    // Sort by volume
    result.sort((a, b) => {
      const volA = a.volumeIn;
      const volB = b.volumeIn;
      return volB > volA ? 1 : -1;
    });

    return result;
  }

  /**
   * Get top executors by swap count
   */
  getTopExecutors(swaps: SwapEventData[], limit: number = 10): { address: string; swapCount: number }[] {
    const executorMap = new Map<string, number>();

    for (const swap of swaps) {
      const count = executorMap.get(swap.executor) || 0;
      executorMap.set(swap.executor, count + 1);
    }

    const executors = Array.from(executorMap.entries())
      .map(([address, swapCount]) => ({ address, swapCount }))
      .sort((a, b) => b.swapCount - a.swapCount)
      .slice(0, limit);

    return executors;
  }

  /**
   * Generate comprehensive volume report
   */
  async generateReport(
    fromBlock?: number,
    toBlock?: number | string,
    lastNBlocks?: number
  ): Promise<VolumeReportData> {
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║   TRADING VOLUME ANALYSIS REPORT      ║");
    console.log("╚════════════════════════════════════════╝");

    // Determine block range
    const currentBlock = await ethers.provider.getBlockNumber();
    let startBlock = fromBlock ?? 0;
    let endBlock = toBlock ?? "latest";

    if (lastNBlocks) {
      startBlock = currentBlock - lastNBlocks;
      endBlock = currentBlock;
      console.log(`\n📊 Analyzing last ${lastNBlocks} blocks`);
    }

    console.log(`   Start block: ${startBlock}`);
    console.log(`   End block: ${endBlock}`);

    // Get swap events
    const swaps = await this.getSwapEvents(startBlock, endBlock === "latest" ? undefined : Number(endBlock));

    if (swaps.length === 0) {
      console.log("\n⚠️ No swap events found in specified range");
      return {
        totalSwaps: 0,
        totalVolumeIn: 0n,
        totalVolumeOut: 0n,
        volumeByToken: [],
        volumeByPair: [],
        topExecutors: [],
        avgSlippageBps: 0n,
        startBlock,
        endBlock: typeof endBlock === "string" ? currentBlock : endBlock,
        startTimestamp: 0,
        endTimestamp: 0
      };
    }

    // Calculate totals
    const totalVolumeIn = swaps.reduce((sum, swap) => sum + swap.amountIn, 0n);
    const totalVolumeOut = swaps.reduce((sum, swap) => sum + swap.amountOut, 0n);
    const totalSlippage = swaps.reduce((sum, swap) => sum + swap.slippageBps, 0n);
    const avgSlippageBps = swaps.length > 0 ? totalSlippage / BigInt(swaps.length) : 0n;

    // Get time range
    const startTimestamp = swaps[0].timestamp;
    const endTimestamp = swaps[swaps.length - 1].timestamp;
    const duration = endTimestamp - startTimestamp;

    console.log("\n📊 OVERALL STATISTICS:");
    console.log(`   Total swaps: ${swaps.length}`);
    console.log(`   Total volume in: ${ethers.formatEther(totalVolumeIn)} ETH equivalent`);
    console.log(`   Total volume out: ${ethers.formatEther(totalVolumeOut)} ETH equivalent`);
    console.log(`   Avg slippage: ${avgSlippageBps.toString()} bps (${Number(avgSlippageBps) / 100}%)`);
    console.log(`   Duration: ${duration}s (${(duration / 3600).toFixed(2)} hours)`);

    // Aggregate by token
    const volumeByToken = this.aggregateVolumeByToken(swaps);
    
    console.log("\n📊 VOLUME BY TOKEN (Top 10):");
    volumeByToken.slice(0, 10).forEach((token, idx) => {
      console.log(`   ${idx + 1}. ${token.tokenCode}:`);
      console.log(`      Volume In: ${ethers.formatEther(token.volumeIn)}`);
      console.log(`      Volume Out: ${ethers.formatEther(token.volumeOut)}`);
      console.log(`      Swaps: ${token.swapCount}`);
    });

    // Aggregate by pair
    const volumeByPair = this.aggregateVolumeByPair(swaps);
    
    console.log("\n🔄 VOLUME BY TRADING PAIR (Top 10):");
    volumeByPair.slice(0, 10).forEach((pair, idx) => {
      console.log(`   ${idx + 1}. ${pair.tokenIn} → ${pair.tokenOut}:`);
      console.log(`      Volume: ${ethers.formatEther(pair.volumeIn)}`);
      console.log(`      Swaps: ${pair.swapCount}`);
      console.log(`      Avg Slippage: ${pair.avgSlippageBps.toString()} bps`);
    });

    // Top executors
    const topExecutors = this.getTopExecutors(swaps, 10);
    
    console.log("\n👤 TOP EXECUTORS:");
    topExecutors.forEach((executor, idx) => {
      console.log(`   ${idx + 1}. ${executor.address}: ${executor.swapCount} swaps`);
    });

    console.log("\n════════════════════════════════════════");
    console.log("Report generation complete ✅");

    return {
      totalSwaps: swaps.length,
      totalVolumeIn,
      totalVolumeOut,
      volumeByToken,
      volumeByPair,
      topExecutors,
      avgSlippageBps,
      startBlock,
      endBlock: typeof endBlock === "string" ? currentBlock : endBlock,
      startTimestamp,
      endTimestamp
    };
  }

  /**
   * Export report to JSON file
   */
  async exportToJSON(report: VolumeReportData, filename: string = "volume-report.json") {
    const fs = await import("fs");
    const path = await import("path");

    const outputDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filepath = path.join(outputDir, filename);
    
    // Convert BigInt to string for JSON
    const jsonData = JSON.stringify(report, (_, v) => 
      typeof v === 'bigint' ? v.toString() : v
    , 2);

    fs.writeFileSync(filepath, jsonData);
    
    console.log(`\n💾 Report exported to: ${filepath}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║   TRADING VOLUME ANALYSIS SCRIPT      ║");
  console.log("╚════════════════════════════════════════╝");

  const monitor = new VolumeReportMonitor();
  await monitor.initialize();

  // Parse command line arguments
  const args = process.argv.slice(2);
  let fromBlock: number | undefined;
  let toBlock: number | string | undefined;
  let lastNBlocks: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) {
      fromBlock = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--to" && args[i + 1]) {
      toBlock = args[i + 1] === "latest" ? "latest" : parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--last" && args[i + 1]) {
      lastNBlocks = parseInt(args[i + 1]);
      i++;
    }
  }

  // Generate report
  const report = await monitor.generateReport(fromBlock, toBlock, lastNBlocks);

  // Export to JSON
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await monitor.exportToJSON(report, `volume-report-${timestamp}.json`);

  console.log("\n✅ Volume analysis complete");
}

// Execute script
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Error in volume analysis:", error);
      process.exit(1);
    });
}

export { VolumeReportMonitor, VolumeReportData, SwapEventData };
