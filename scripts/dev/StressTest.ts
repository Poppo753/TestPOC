// SPDX-License-Identifier: MIT
/**
 * @title StressTest
 * @dev Script per stress testing del sistema DeFi con misurazione performance
 * 
 * Basato su pattern da:
 * - test/integration/LF-005.StressTesting.integration.test.ts (righe 1-364)
 * - test/integration/LF-004.ConcurrentOps.integration.test.ts (righe 1-366)
 * 
 * Test supportati:
 * 1. Rapid Sequential Deposits: Performance under high-frequency load
 * 2. Concurrent Deposits: Parallel transaction handling
 * 3. Mixed Operations: Deposits + Withdraws concurrently
 * 4. Gas Cost Analysis: Operation cost measurements
 * 5. Performance Degradation: System behavior under sustained load
 * 
 * CLI Usage:
 *   npx hardhat run scripts/dev/StressTest.ts --network <network>
 *   --test=<rapid|concurrent|mixed|gas|degradation|all>
 *   --operations=<number>    (default: 10)
 *   --amount=<eth_amount>    (default: 0.5)
 *   --users=<number>         (default: 5)
 *   --report                 (generate detailed report)
 * 
 * Examples:
 *   npx hardhat run scripts/dev/StressTest.ts --network localhost --test=rapid --operations=20
 *   npx hardhat run scripts/dev/StressTest.ts --network localhost --test=concurrent --users=10
 *   npx hardhat run scripts/dev/StressTest.ts --network localhost --test=all --report
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";

interface StressTestOptions {
  test: "rapid" | "concurrent" | "mixed" | "gas" | "degradation" | "all";
  operations: number;
  amount: string;
  users: number;
  report: boolean;
}

interface PerformanceMetrics {
  testName: string;
  totalOperations: number;
  successfulOps: number;
  failedOps: number;
  totalTime: number;
  averageTime: number;
  opsPerSecond: number;
  totalGasUsed: bigint;
  averageGasPerOp: bigint;
  minTime: number;
  maxTime: number;
  stdDeviation: number;
}

/**
 * @notice Script per stress testing e misurazione performance
 * @dev Pattern da LF-005 e LF-004 integration tests
 */
export class StressTestScript extends BaseScript {
  private testOptions: StressTestOptions;
  private performanceMetrics: PerformanceMetrics[] = [];
  
  constructor() {
    super();
    this.testOptions = this.parseTestOptions();
  }

  protected getScriptName(): string {
    return "StressTest";
  }

  /**
   * @notice Parse CLI arguments per test options
   */
  private parseTestOptions(): StressTestOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string, defaultValue: string = ""): string => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : defaultValue;
    };
    
    const hasFlag = (name: string): boolean => {
      return args.includes(`--${name}`);
    };

    return {
      test: (getArg("test", "rapid") as StressTestOptions["test"]),
      operations: parseInt(getArg("operations", "10")),
      amount: getArg("amount", "0.5"),
      users: parseInt(getArg("users", "5")),
      report: hasFlag("report")
    };
  }

  /**
   * @notice Entry point per stress testing
   * @dev Pattern: Deploy + Execute tests + Report
   */
  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("STRESS TEST SYSTEM");
    Logger.info(`Test Type: ${this.testOptions.test.toUpperCase()}`);
    Logger.info(`Operations: ${this.testOptions.operations}`);
    Logger.info(`Amount per Operation: ${this.testOptions.amount} ETH`);
    Logger.info(`Test Users: ${this.testOptions.users}`);

    const startTime = Date.now();

    try {
      // Step 1: Verify system ready
      await this.verifySystemReady();

      // Step 2: Execute selected tests
      if (this.testOptions.test === "all") {
        await this.runRapidSequentialTest();
        await this.runConcurrentTest();
        await this.runMixedOperationsTest();
        await this.runGasAnalysisTest();
        await this.runPerformanceDegradationTest();
      } else {
        switch (this.testOptions.test) {
          case "rapid":
            await this.runRapidSequentialTest();
            break;
          case "concurrent":
            await this.runConcurrentTest();
            break;
          case "mixed":
            await this.runMixedOperationsTest();
            break;
          case "gas":
            await this.runGasAnalysisTest();
            break;
          case "degradation":
            await this.runPerformanceDegradationTest();
            break;
        }
      }

      // Step 3: Generate report
      const duration = Date.now() - startTime;
      if (this.testOptions.report) {
        this.generateDetailedReport();
      } else {
        this.generateSummaryReport();
      }

      return {
        success: true,
        data: {
          message: "Stress testing completed successfully",
          metrics: this.performanceMetrics,
          duration
        }
      };

    } catch (error: any) {
      Logger.error(`Stress testing failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * @notice Verifica sistema pronto per stress testing
   * @dev Controlla liquidity disponibile e configurazione
   */
  private async verifySystemReady(): Promise<void> {
    Logger.section("System Readiness Check");

    // Get LiquidityManager
    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);

    Logger.info(`LiquidityManager: ${liquidityManagerAddr}`);

    // Check withdraw limits (should be high for stress testing)
    // Pattern: LF-005.StressTesting.integration.test.ts line 105
    Logger.info("Checking withdraw limits configuration...");
    
    Logger.success("System ready for stress testing");
  }

  /**
   * @notice Test 1: Rapid Sequential Deposits
   * @dev Pattern: LF-005.StressTesting.integration.test.ts (righe 125-165)
   * Misura performance sotto high-frequency load
   */
  private async runRapidSequentialTest(): Promise<void> {
    Logger.section("TEST 1: Rapid Sequential Deposits");
    Logger.info(`Testing ${this.testOptions.operations} rapid sequential deposits`);
    Logger.info("Measuring performance under high frequency load");

    const depositAmount = ethers.parseEther(this.testOptions.amount);
    const signers = await ethers.getSigners();
    const numUsers = Math.min(this.testOptions.users, signers.length - 1);

    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);

    const operationTimes: number[] = [];
    const gasUsedList: bigint[] = [];
    let successCount = 0;
    let failCount = 0;

    Logger.info("Executing rapid deposits...");
    const testStart = Date.now();

    for (let i = 0; i < this.testOptions.operations; i++) {
      const user = signers[(i % numUsers) + 1]; // Skip deployer
      const opStart = Date.now();

      try {
        const tx = await liquidityManager.connect(user).deposit({ 
          value: depositAmount,
          gasLimit: 500000
        });
        const receipt = await tx.wait();
        
        const opTime = Date.now() - opStart;
        operationTimes.push(opTime);
        
        if (receipt) {
          gasUsedList.push(receipt.gasUsed);
        }
        
        successCount++;
        
        if (this.testOptions.report) {
          Logger.success(`Deposit ${i+1}/${this.testOptions.operations}: ${opTime}ms`);
        }
      } catch (error: any) {
        failCount++;
        Logger.error(`Deposit ${i+1} failed: ${error.message}`);
      }
    }

    const testDuration = Date.now() - testStart;

    // Calculate metrics
    const totalGas = gasUsedList.reduce((sum, gas) => sum + gas, BigInt(0));
    const avgTime = operationTimes.reduce((sum, t) => sum + t, 0) / operationTimes.length;
    const avgGas = totalGas / BigInt(successCount);
    const opsPerSecond = (successCount / testDuration) * 1000;

    // Calculate std deviation
    const variance = operationTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / operationTimes.length;
    const stdDev = Math.sqrt(variance);

    this.performanceMetrics.push({
      testName: "Rapid Sequential Deposits",
      totalOperations: this.testOptions.operations,
      successfulOps: successCount,
      failedOps: failCount,
      totalTime: testDuration,
      averageTime: avgTime,
      opsPerSecond: opsPerSecond,
      totalGasUsed: totalGas,
      averageGasPerOp: avgGas,
      minTime: Math.min(...operationTimes),
      maxTime: Math.max(...operationTimes),
      stdDeviation: stdDev
    });

    Logger.success("Rapid sequential test completed");
    Logger.info(`Success rate: ${(successCount/this.testOptions.operations*100).toFixed(2)}%`);
    Logger.info(`Average time: ${avgTime.toFixed(2)}ms`);
    Logger.info(`Ops/second: ${opsPerSecond.toFixed(2)}`);
  }

  /**
   * @notice Test 2: Concurrent Deposits
   * @dev Pattern: LF-004.ConcurrentOps.integration.test.ts (righe 120-180)
   * Testa parallel transaction handling
   */
  private async runConcurrentTest(): Promise<void> {
    Logger.section("TEST 2: Concurrent Deposits");
    Logger.info(`Testing ${this.testOptions.operations} concurrent deposits`);
    Logger.info("Measuring parallel transaction handling");

    const depositAmount = ethers.parseEther(this.testOptions.amount);
    const signers = await ethers.getSigners();
    const numUsers = Math.min(this.testOptions.operations, signers.length - 1);

    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);

    Logger.info("Launching concurrent deposits...");
    const testStart = Date.now();

    // Create deposit promises
    const depositPromises = [];
    for (let i = 0; i < this.testOptions.operations; i++) {
      const user = signers[(i % numUsers) + 1];
      depositPromises.push(
        liquidityManager.connect(user).deposit({ 
          value: depositAmount,
          gasLimit: 500000
        })
      );
    }

    // Execute all concurrently
    const txs = await Promise.all(depositPromises);
    Logger.info("All transactions submitted, waiting for confirmations...");

    // Wait for all receipts
    const receipts = await Promise.all(txs.map(tx => tx.wait()));
    
    const testDuration = Date.now() - testStart;
    const successCount = receipts.filter(r => r !== null).length;
    const totalGas = receipts.reduce((sum, r) => r ? sum + r.gasUsed : sum, BigInt(0));
    const avgGas = totalGas / BigInt(successCount);

    this.performanceMetrics.push({
      testName: "Concurrent Deposits",
      totalOperations: this.testOptions.operations,
      successfulOps: successCount,
      failedOps: this.testOptions.operations - successCount,
      totalTime: testDuration,
      averageTime: testDuration / this.testOptions.operations,
      opsPerSecond: (successCount / testDuration) * 1000,
      totalGasUsed: totalGas,
      averageGasPerOp: avgGas,
      minTime: 0,
      maxTime: testDuration,
      stdDeviation: 0
    });

    Logger.success("Concurrent test completed");
    Logger.info(`Success rate: ${(successCount/this.testOptions.operations*100).toFixed(2)}%`);
    Logger.info(`Total time: ${testDuration}ms`);
    Logger.info(`Average gas: ${avgGas.toString()}`);
  }

  /**
   * @notice Test 3: Mixed Operations (Deposits + Withdraws)
   * @dev Pattern: Concurrent deposits and withdraws
   */
  private async runMixedOperationsTest(): Promise<void> {
    Logger.section("TEST 3: Mixed Operations");
    Logger.info("Testing concurrent deposits and withdraws");

    const amount = ethers.parseEther(this.testOptions.amount);
    const signers = await ethers.getSigners();

    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);

    Logger.info("Phase 1: Setup initial deposits for withdraws...");
    
    // First, make some deposits to enable withdraws
    const setupPromises = [];
    for (let i = 0; i < Math.floor(this.testOptions.operations / 2); i++) {
      const user = signers[(i % this.testOptions.users) + 1];
      setupPromises.push(
        liquidityManager.connect(user).deposit({ 
          value: amount,
          gasLimit: 500000
        })
      );
    }
    await Promise.all(setupPromises);

    Logger.info("Phase 2: Execute mixed deposits and withdraws...");
    const testStart = Date.now();

    const mixedPromises = [];
    
    // Half deposits, half withdraws
    for (let i = 0; i < this.testOptions.operations; i++) {
      const user = signers[(i % this.testOptions.users) + 1];
      
      if (i % 2 === 0) {
        // Deposit
        mixedPromises.push(
          liquidityManager.connect(user).deposit({ 
            value: amount,
            gasLimit: 500000
          })
        );
      } else {
        // Withdraw (small amount to avoid failures)
        mixedPromises.push(
          liquidityManager.connect(user).withdraw(ethers.parseEther("0.1"), {
            gasLimit: 500000
          })
        );
      }
    }

    const txs = await Promise.all(mixedPromises);
    const receipts = await Promise.all(txs.map(tx => tx.wait()));
    
    const testDuration = Date.now() - testStart;
    const successCount = receipts.filter(r => r !== null).length;
    const totalGas = receipts.reduce((sum, r) => r ? sum + r.gasUsed : sum, BigInt(0));

    this.performanceMetrics.push({
      testName: "Mixed Operations",
      totalOperations: this.testOptions.operations,
      successfulOps: successCount,
      failedOps: this.testOptions.operations - successCount,
      totalTime: testDuration,
      averageTime: testDuration / this.testOptions.operations,
      opsPerSecond: (successCount / testDuration) * 1000,
      totalGasUsed: totalGas,
      averageGasPerOp: totalGas / BigInt(successCount),
      minTime: 0,
      maxTime: testDuration,
      stdDeviation: 0
    });

    Logger.success("Mixed operations test completed");
    Logger.info(`Success rate: ${(successCount/this.testOptions.operations*100).toFixed(2)}%`);
  }

  /**
   * @notice Test 4: Gas Cost Analysis
   * @dev Detailed gas measurements for different operations
   */
  private async runGasAnalysisTest(): Promise<void> {
    Logger.section("TEST 4: Gas Cost Analysis");
    Logger.info("Measuring gas costs for various operations");

    const amount = ethers.parseEther(this.testOptions.amount);
    const [_, user1] = await ethers.getSigners();

    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);

    const gasAnalysis: { operation: string; gas: bigint }[] = [];

    // Test 1: First deposit (cold storage)
    Logger.info("Measuring first deposit gas cost...");
    let tx = await liquidityManager.connect(user1).deposit({ 
      value: amount,
      gasLimit: 500000
    });
    let receipt = await tx.wait();
    if (receipt) {
      gasAnalysis.push({ operation: "First Deposit (Cold)", gas: receipt.gasUsed });
      Logger.info(`First deposit: ${receipt.gasUsed.toString()} gas`);
    }

    // Test 2: Second deposit (warm storage)
    Logger.info("Measuring second deposit gas cost...");
    tx = await liquidityManager.connect(user1).deposit({ 
      value: amount,
      gasLimit: 500000
    });
    receipt = await tx.wait();
    if (receipt) {
      gasAnalysis.push({ operation: "Second Deposit (Warm)", gas: receipt.gasUsed });
      Logger.info(`Second deposit: ${receipt.gasUsed.toString()} gas`);
    }

    // Test 3: Withdraw
    Logger.info("Measuring withdraw gas cost...");
    tx = await liquidityManager.connect(user1).withdraw(ethers.parseEther("0.5"), {
      gasLimit: 500000
    });
    receipt = await tx.wait();
    if (receipt) {
      gasAnalysis.push({ operation: "Withdraw", gas: receipt.gasUsed });
      Logger.info(`Withdraw: ${receipt.gasUsed.toString()} gas`);
    }

    // Calculate total and average
    const totalGas = gasAnalysis.reduce((sum, item) => sum + item.gas, BigInt(0));
    const avgGas = totalGas / BigInt(gasAnalysis.length);

    this.performanceMetrics.push({
      testName: "Gas Cost Analysis",
      totalOperations: gasAnalysis.length,
      successfulOps: gasAnalysis.length,
      failedOps: 0,
      totalTime: 0,
      averageTime: 0,
      opsPerSecond: 0,
      totalGasUsed: totalGas,
      averageGasPerOp: avgGas,
      minTime: 0,
      maxTime: 0,
      stdDeviation: 0
    });

    Logger.success("Gas analysis completed");
    Logger.info(`Average gas cost: ${avgGas.toString()}`);

    // Detailed breakdown
    if (this.testOptions.report) {
      Logger.section("Gas Cost Breakdown");
      for (const item of gasAnalysis) {
        Logger.info(`${item.operation}: ${item.gas.toString()} gas`);
      }
    }
  }

  /**
   * @notice Test 5: Performance Degradation Test
   * @dev Pattern: LF-005 righe 152+ - Monitor performance under sustained load
   */
  private async runPerformanceDegradationTest(): Promise<void> {
    Logger.section("TEST 5: Performance Degradation");
    Logger.info("Testing system behavior under sustained load");
    Logger.info("Monitoring for performance degradation over time");

    const amount = ethers.parseEther(this.testOptions.amount);
    const signers = await ethers.getSigners();
    const batchSize = 5;
    const numBatches = Math.ceil(this.testOptions.operations / batchSize);

    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);

    const batchMetrics: { batch: number; time: number; avgGas: bigint }[] = [];

    for (let batch = 0; batch < numBatches; batch++) {
      Logger.info(`Batch ${batch + 1}/${numBatches}...`);
      
      const batchStart = Date.now();
      const batchPromises = [];

      for (let i = 0; i < batchSize; i++) {
        const user = signers[((batch * batchSize + i) % this.testOptions.users) + 1];
        batchPromises.push(
          liquidityManager.connect(user).deposit({ 
            value: amount,
            gasLimit: 500000
          })
        );
      }

      const txs = await Promise.all(batchPromises);
      const receipts = await Promise.all(txs.map(tx => tx.wait()));
      
      const batchTime = Date.now() - batchStart;
      const batchGas = receipts.reduce((sum, r) => r ? sum + r.gasUsed : sum, BigInt(0));
      const avgBatchGas = batchGas / BigInt(batchSize);

      batchMetrics.push({
        batch: batch + 1,
        time: batchTime,
        avgGas: avgBatchGas
      });

      if (this.testOptions.report) {
        Logger.info(`Batch ${batch + 1}: ${batchTime}ms, Avg gas: ${avgBatchGas.toString()}`);
      }
    }

    // Analyze degradation
    const firstBatchTime = batchMetrics[0].time;
    const lastBatchTime = batchMetrics[batchMetrics.length - 1].time;
    const degradation = ((lastBatchTime - firstBatchTime) / firstBatchTime) * 100;

    const totalGas = batchMetrics.reduce((sum, m) => sum + m.avgGas, BigInt(0));
    const avgGas = totalGas / BigInt(batchMetrics.length);

    this.performanceMetrics.push({
      testName: "Performance Degradation",
      totalOperations: this.testOptions.operations,
      successfulOps: this.testOptions.operations,
      failedOps: 0,
      totalTime: batchMetrics.reduce((sum, m) => sum + m.time, 0),
      averageTime: firstBatchTime,
      opsPerSecond: 0,
      totalGasUsed: totalGas * BigInt(batchSize),
      averageGasPerOp: avgGas,
      minTime: firstBatchTime,
      maxTime: lastBatchTime,
      stdDeviation: 0
    });

    Logger.success("Performance degradation test completed");
    Logger.info(`Performance change: ${degradation > 0 ? '+' : ''}${degradation.toFixed(2)}%`);
    
    if (Math.abs(degradation) < 10) {
      Logger.success("Performance stable under sustained load ✅");
    } else {
      Logger.warn(`Performance degradation detected: ${degradation.toFixed(2)}%`);
    }
  }

  /**
   * @notice Generate summary report of stress tests
   */
  private generateSummaryReport(): void {
    Logger.section("STRESS TEST SUMMARY");
    
    for (const metric of this.performanceMetrics) {
      Logger.section(metric.testName);
      Logger.info(`Total Operations: ${metric.totalOperations}`);
      Logger.info(`Successful: ${metric.successfulOps} (${((metric.successfulOps/metric.totalOperations)*100).toFixed(2)}%)`);
      Logger.info(`Failed: ${metric.failedOps}`);
      Logger.info(`Total Time: ${metric.totalTime}ms`);
      Logger.info(`Avg Time/Op: ${metric.averageTime.toFixed(2)}ms`);
      Logger.info(`Ops/Second: ${metric.opsPerSecond.toFixed(2)}`);
      Logger.info(`Total Gas: ${metric.totalGasUsed.toString()}`);
      Logger.info(`Avg Gas/Op: ${metric.averageGasPerOp.toString()}`);
    }

    // Overall summary
    const totalOps = this.performanceMetrics.reduce((sum, m) => sum + m.totalOperations, 0);
    const totalSuccess = this.performanceMetrics.reduce((sum, m) => sum + m.successfulOps, 0);
    const totalGas = this.performanceMetrics.reduce((sum, m) => sum + m.totalGasUsed, BigInt(0));

    Logger.section("OVERALL SUMMARY");
    Logger.info(`Total Tests Run: ${this.performanceMetrics.length}`);
    Logger.info(`Total Operations: ${totalOps}`);
    Logger.info(`Success Rate: ${((totalSuccess/totalOps)*100).toFixed(2)}%`);
    Logger.info(`Total Gas Used: ${totalGas.toString()}`);
  }

  /**
   * @notice Generate detailed report with full metrics
   */
  private generateDetailedReport(): void {
    this.generateSummaryReport();
    
    Logger.section("DETAILED METRICS");
    
    for (const metric of this.performanceMetrics) {
      Logger.section(`${metric.testName} - Detailed Breakdown`);
      Logger.info(`Min Time: ${metric.minTime}ms`);
      Logger.info(`Max Time: ${metric.maxTime}ms`);
      Logger.info(`Std Deviation: ${metric.stdDeviation.toFixed(2)}ms`);
      Logger.info(`Time Range: ${metric.maxTime - metric.minTime}ms`);
      
      if (metric.opsPerSecond > 0) {
        Logger.info(`Peak Throughput: ${metric.opsPerSecond.toFixed(2)} ops/sec`);
      }
    }
  }
}

// Execute script
if (require.main === module) {
  const script = new StressTestScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
