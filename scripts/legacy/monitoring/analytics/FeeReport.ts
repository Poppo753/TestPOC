/**
 * FeeReport.ts - Fee Collection Analysis
 * 
 * ⚠️ CRITICAL PATTERNS (from contracts and tests):
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 * - ParameterManager.getParameterInfo() returns {currentValue, minValue, maxValue, isActive}
 * - LiquidityManager: depositFee and withdrawFee are public state variables
 * - Fee events: DepositFeeUpdated, WithdrawFeeUpdated from LiquidityManager
 * - Fee events: ParameterUpdated from ParameterManager
 * - Reference: test/unit/ParameterManager.test.ts, contracts/Liquiditymanager.sol
 */

import { ethers } from "hardhat";
import { Beacon, ParameterManager, LiquidityManager } from "../../../typechain-types";

interface FeeConfiguration {
  depositFee: bigint;
  withdrawFee: bigint;
  depositFeeBps: number;
  withdrawFeeBps: number;
  timestamp: number;
}

interface FeeChangeEvent {
  feeType: "deposit" | "withdraw" | "parameter";
  oldValue: bigint;
  newValue: bigint;
  blockNumber: number;
  timestamp: number;
  transactionHash: string;
}

interface FeeCollectionEstimate {
  totalDeposits: bigint;
  totalWithdrawals: bigint;
  estimatedDepositFees: bigint;
  estimatedWithdrawFees: bigint;
  totalEstimatedFees: bigint;
  depositCount: number;
  withdrawalCount: number;
}

interface FeeReportData {
  currentFees: FeeConfiguration;
  feeChanges: FeeChangeEvent[];
  feeCollection: FeeCollectionEstimate;
  contractBalance: bigint;
  startBlock: number;
  endBlock: number;
}

interface ContractSetup {
  beacon: Beacon;
  parameterManager: ParameterManager;
  liquidityManager: LiquidityManager;
}

class FeeReportMonitor {
  private contracts!: ContractSetup;

  /**
   * Initialize contracts from deployed addresses
   * Pattern: beacon.getImplementation() - test/integration/BeaconModules.integration.test.ts
   */
  async initialize() {
    console.log("🔧 Initializing Fee Report Monitor...");

    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) {
      throw new Error("❌ BEACON_ADDRESS not set in environment");
    }

    this.contracts = {
      beacon: await ethers.getContractAt("Beacon", beaconAddress)
    } as ContractSetup;

    // Pattern: ALWAYS use beacon.getImplementation() NOT getModule()
    // Reference: test/integration/LiquidityFlow.integration.test.ts line 127
    const parameterManagerAddr = await this.contracts.beacon.getImplementation("ParameterManager");
    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");

    this.contracts.parameterManager = await ethers.getContractAt("ParameterManager", parameterManagerAddr);
    this.contracts.liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);

    console.log("✅ Fee Report Monitor initialized");
    console.log(`   📍 Beacon: ${beaconAddress}`);
    console.log(`   ⚙️ ParameterManager: ${parameterManagerAddr}`);
    console.log(`   🌊 LiquidityManager: ${liquidityManagerAddr}`);
  }

  /**
   * Get current fee configuration
   * Pattern: LiquidityManager public variables depositFee, withdrawFee
   * Reference: contracts/Liquiditymanager.sol lines 61-62
   */
  async getCurrentFees(): Promise<FeeConfiguration> {
    console.log("\n💰 Reading current fee configuration...");

    // Pattern: depositFee and withdrawFee are public state variables
    const depositFee = await this.contracts.liquidityManager.depositFee();
    const withdrawFee = await this.contracts.liquidityManager.withdrawFee();

    console.log(`   Deposit Fee: ${depositFee} bps (${Number(depositFee) / 100}%)`);
    console.log(`   Withdraw Fee: ${withdrawFee} bps (${Number(withdrawFee) / 100}%)`);

    return {
      depositFee,
      withdrawFee,
      depositFeeBps: Number(depositFee),
      withdrawFeeBps: Number(withdrawFee),
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Query fee change events from LiquidityManager
   * Events: DepositFeeUpdated(uint256 oldFee, uint256 newFee)
   *         WithdrawFeeUpdated(uint256 oldFee, uint256 newFee)
   * Reference: contracts/interfaces/ILiquidityManager.sol lines 160-161
   */
  async getFeeChangeEvents(
    fromBlock?: number,
    toBlock?: number | string
  ): Promise<FeeChangeEvent[]> {
    console.log("\n📊 Querying fee change events...");
    console.log(`   From block: ${fromBlock ?? "earliest"}`);
    console.log(`   To block: ${toBlock ?? "latest"}`);

    const feeChanges: FeeChangeEvent[] = [];

    // Query DepositFeeUpdated events
    const depositFeeFilter = this.contracts.liquidityManager.filters.DepositFeeUpdated();
    const depositFeeEvents = await this.contracts.liquidityManager.queryFilter(
      depositFeeFilter,
      fromBlock,
      toBlock
    );

    for (const event of depositFeeEvents) {
      const block = await event.getBlock();
      feeChanges.push({
        feeType: "deposit",
        oldValue: event.args.oldFee,
        newValue: event.args.newFee,
        blockNumber: event.blockNumber,
        timestamp: block.timestamp,
        transactionHash: event.transactionHash
      });
    }

    // Query WithdrawFeeUpdated events
    const withdrawFeeFilter = this.contracts.liquidityManager.filters.WithdrawFeeUpdated();
    const withdrawFeeEvents = await this.contracts.liquidityManager.queryFilter(
      withdrawFeeFilter,
      fromBlock,
      toBlock
    );

    for (const event of withdrawFeeEvents) {
      const block = await event.getBlock();
      feeChanges.push({
        feeType: "withdraw",
        oldValue: event.args.oldFee,
        newValue: event.args.newFee,
        blockNumber: event.blockNumber,
        timestamp: block.timestamp,
        transactionHash: event.transactionHash
      });
    }

    // Sort by block number
    feeChanges.sort((a, b) => a.blockNumber - b.blockNumber);

    console.log(`   Found ${feeChanges.length} fee change events`);
    return feeChanges;
  }

  /**
   * Estimate fee collection from deposit/withdraw events
   * Pattern: Query LiquidityDeposited and LiquidityWithdrawn events
   */
  async estimateFeeCollection(
    fromBlock?: number,
    toBlock?: number | string
  ): Promise<FeeCollectionEstimate> {
    console.log("\n💸 Estimating fee collection...");

    const currentFees = await this.getCurrentFees();

    // Query Deposit events
    // Pattern: event Deposit(address indexed user, uint256 ethAmount, uint256 sharesReceived, uint256 totalPoolETH, uint256 totalSupply)
    // Reference: contracts/interfaces/ILiquidityManager.sol line 156
    const depositFilter = this.contracts.liquidityManager.filters.Deposit();
    const depositEvents = await this.contracts.liquidityManager.queryFilter(
      depositFilter,
      fromBlock,
      toBlock
    );

    // Query Withdrawn events
    // Pattern: event Withdrawn(address indexed user, uint256 shares, uint256 ethAmount, uint256 totalPoolValue, uint256 remainingPoolBalance)
    // Reference: contracts/interfaces/ILiquidityManager.sol line 157
    const withdrawFilter = this.contracts.liquidityManager.filters.Withdrawn();
    const withdrawEvents = await this.contracts.liquidityManager.queryFilter(
      withdrawFilter,
      fromBlock,
      toBlock
    );

    console.log(`   Deposit events: ${depositEvents.length}`);
    console.log(`   Withdrawal events: ${withdrawEvents.length}`);

    // Calculate totals
    let totalDeposits = 0n;
    for (const event of depositEvents) {
      totalDeposits += event.args.ethAmount;
    }

    let totalWithdrawals = 0n;
    for (const event of withdrawEvents) {
      totalWithdrawals += event.args.ethAmount;
    }

    // Estimate fees collected
    // Pattern: feeAmount = (amount * feeBps) / 10000
    // Reference: contracts/Liquiditymanager.sol line 129
    const estimatedDepositFees = (totalDeposits * currentFees.depositFee) / 10000n;
    const estimatedWithdrawFees = (totalWithdrawals * currentFees.withdrawFee) / 10000n;
    const totalEstimatedFees = estimatedDepositFees + estimatedWithdrawFees;

    console.log(`   Total deposits: ${ethers.formatEther(totalDeposits)} ETH`);
    console.log(`   Total withdrawals: ${ethers.formatEther(totalWithdrawals)} ETH`);
    console.log(`   Estimated deposit fees: ${ethers.formatEther(estimatedDepositFees)} ETH`);
    console.log(`   Estimated withdraw fees: ${ethers.formatEther(estimatedWithdrawFees)} ETH`);
    console.log(`   Total estimated fees: ${ethers.formatEther(totalEstimatedFees)} ETH`);

    return {
      totalDeposits,
      totalWithdrawals,
      estimatedDepositFees,
      estimatedWithdrawFees,
      totalEstimatedFees,
      depositCount: depositEvents.length,
      withdrawalCount: withdrawEvents.length
    };
  }

  /**
   * Get LiquidityManager contract balance
   */
  async getContractBalance(): Promise<bigint> {
    const address = await this.contracts.liquidityManager.getAddress();
    const balance = await ethers.provider.getBalance(address);
    console.log(`\n💼 LiquidityManager balance: ${ethers.formatEther(balance)} ETH`);
    return balance;
  }

  /**
   * Check fee-related parameters in ParameterManager
   * Pattern: parameterManager.getParameterInfo() returns {currentValue, minValue, maxValue, isActive}
   * Reference: test/unit/ParameterManager.test.ts line 165
   */
  async checkFeeParameters(): Promise<void> {
    console.log("\n⚙️ Checking fee-related parameters in ParameterManager...");

    try {
      // Get all parameter names
      const allParams = await this.contracts.parameterManager.getAllParameterNames();
      console.log(`   Total parameters: ${allParams.length}`);

      // Filter fee-related parameters
      const feeParams = allParams.filter((name: string) => 
        name.toLowerCase().includes("fee") || 
        name.toLowerCase().includes("deposit") || 
        name.toLowerCase().includes("withdraw")
      );

      if (feeParams.length > 0) {
        console.log(`\n   📋 Fee-related parameters found:`);
        for (const paramName of feeParams) {
          // Pattern: getParameterInfo returns {currentValue, minValue, maxValue, isActive}
          const paramInfo = await this.contracts.parameterManager.getParameterInfo(paramName);
          console.log(`\n   ${paramName}:`);
          console.log(`      Current: ${paramInfo.currentValue}`);
          console.log(`      Min: ${paramInfo.minValue}`);
          console.log(`      Max: ${paramInfo.maxValue}`);
          console.log(`      Active: ${paramInfo.isActive}`);
        }
      } else {
        console.log(`   ℹ️ No fee-related parameters in ParameterManager`);
      }
    } catch (error) {
      console.log(`   ⚠️ Error checking parameters: ${error}`);
    }
  }

  /**
   * Generate comprehensive fee report
   */
  async generateReport(
    fromBlock?: number,
    toBlock?: number | string,
    lastNBlocks?: number
  ): Promise<FeeReportData> {
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║      FEE COLLECTION ANALYSIS REPORT    ║");
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

    // Get current fees
    const currentFees = await this.getCurrentFees();

    // Get fee change history
    const feeChanges = await this.getFeeChangeEvents(startBlock, endBlock === "latest" ? undefined : Number(endBlock));

    // Estimate fee collection
    const feeCollection = await this.estimateFeeCollection(startBlock, endBlock === "latest" ? undefined : Number(endBlock));

    // Get contract balance
    const contractBalance = await this.getContractBalance();

    // Check ParameterManager for fee params
    await this.checkFeeParameters();

    // Summary
    console.log("\n📊 FEE REPORT SUMMARY:");
    console.log(`   Current deposit fee: ${currentFees.depositFeeBps} bps (${currentFees.depositFeeBps / 100}%)`);
    console.log(`   Current withdraw fee: ${currentFees.withdrawFeeBps} bps (${currentFees.withdrawFeeBps / 100}%)`);
    console.log(`   Fee changes in period: ${feeChanges.length}`);
    console.log(`   Deposit transactions: ${feeCollection.depositCount}`);
    console.log(`   Withdrawal transactions: ${feeCollection.withdrawalCount}`);
    console.log(`   Estimated fees collected: ${ethers.formatEther(feeCollection.totalEstimatedFees)} ETH`);
    console.log(`   LiquidityManager balance: ${ethers.formatEther(contractBalance)} ETH`);

    if (feeChanges.length > 0) {
      console.log("\n📋 FEE CHANGES:");
      feeChanges.forEach((change, idx) => {
        console.log(`\n   ${idx + 1}. ${change.feeType.toUpperCase()} FEE CHANGE:`);
        console.log(`      Old: ${change.oldValue} bps (${Number(change.oldValue) / 100}%)`);
        console.log(`      New: ${change.newValue} bps (${Number(change.newValue) / 100}%)`);
        console.log(`      Block: ${change.blockNumber}`);
        console.log(`      Tx: ${change.transactionHash}`);
      });
    }

    console.log("\n════════════════════════════════════════");
    console.log("Report generation complete ✅");

    return {
      currentFees,
      feeChanges,
      feeCollection,
      contractBalance,
      startBlock,
      endBlock: typeof endBlock === "string" ? currentBlock : endBlock
    };
  }

  /**
   * Export report to JSON file
   */
  async exportToJSON(report: FeeReportData, filename: string = "fee-report.json") {
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
  console.log("║   FEE COLLECTION ANALYSIS SCRIPT      ║");
  console.log("╚════════════════════════════════════════╝");

  const monitor = new FeeReportMonitor();
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
  await monitor.exportToJSON(report, `fee-report-${timestamp}.json`);

  console.log("\n✅ Fee analysis complete");
}

// Execute script
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Error in fee analysis:", error);
      process.exit(1);
    });
}

export { FeeReportMonitor, FeeReportData, FeeConfiguration, FeeChangeEvent };
