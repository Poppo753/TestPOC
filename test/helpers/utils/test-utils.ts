import { expect } from "chai";
import { ethers } from "hardhat";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { BaseContract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * 🌍 TEST ENVIRONMENT INTERFACE
 * Definisce l'ambiente di test standard
 */
export interface TestEnvironment {
  provider: typeof ethers.provider;
  accounts: HardhatEthersSigner[];
  owner: HardhatEthersSigner;
  users: HardhatEthersSigner[];
  snapshots: {
    initial: string;
    current: string;
  };
}

/**
 * 🔧 SETUP TEST ENVIRONMENT
 * Configura l'ambiente di test standard
 */
export async function setupTestEnvironment(): Promise<TestEnvironment> {
  const accounts = await ethers.getSigners();
  const [owner, ...users] = accounts;

  // Create initial snapshot
  const initialSnapshot = await helpers.time.snapshot();

  return {
    provider: ethers.provider,
    accounts,
    owner,
    users,
    snapshots: {
      initial: initialSnapshot.toString(),
      current: initialSnapshot.toString(),
    },
  };
}

/**
 * ⏰ TIME MANIPULATION HELPERS
 */
export class TimeHelpers {
  /**
   * Advance time by specified seconds
   */
  static async advanceTime(seconds: number): Promise<void> {
    await time.increase(seconds);
  }

  /**
   * Advance time to specific timestamp
   */
  static async advanceToTime(timestamp: number): Promise<void> {
    await time.increaseTo(timestamp);
  }

  /**
   * Get current block timestamp
   */
  static async getCurrentTime(): Promise<number> {
    return await time.latest();
  }

  /**
   * Advance blocks
   */
  static async advanceBlocks(blocks: number): Promise<void> {
    for (let i = 0; i < blocks; i++) {
      await time.advanceBlock();
    }
  }

  /**
   * Get current block number
   */
  static async getCurrentBlock(): Promise<number> {
    return await ethers.provider.getBlockNumber();
  }
}

/**
 * 🎯 CUSTOM ASSERTIONS
 */
export class TestAssertions {
  /**
   * Assert that a promise reverts with specific message
   */
  static async expectRevertWithMessage(
    promise: Promise<any>,
    expectedMessage: string
  ): Promise<void> {
    await expect(promise).to.be.revertedWith(expectedMessage);
  }

  /**
   * Assert that a promise reverts with custom error
   */
  static async expectRevertWithCustomError(
    contract: BaseContract,
    promise: Promise<any>,
    errorName: string,
    errorArgs?: any[]
  ): Promise<void> {
    if (errorArgs) {
      await expect(promise)
        .to.be.revertedWithCustomError(contract, errorName)
        .withArgs(...errorArgs);
    } else {
      await expect(promise).to.be.revertedWithCustomError(contract, errorName);
    }
  }

  /**
   * Assert that a value is close to expected (for handling rounding)
   */
  static expectCloseTo(
    actual: bigint,
    expected: bigint,
    tolerance: bigint = ethers.parseEther("0.001")
  ): void {
    const diff = actual > expected ? actual - expected : expected - actual;
    expect(diff).to.be.lte(tolerance);
  }

  /**
   * Assert that a transaction emits specific event with args
   */
  static async expectEmitWithArgs(
    contract: BaseContract,
    promise: Promise<any>,
    eventName: string,
    eventArgs: any[]
  ): Promise<void> {
    await expect(promise)
      .to.emit(contract, eventName)
      .withArgs(...eventArgs);
  }

  /**
   * Assert that a value is within percentage tolerance
   */
  static expectWithinPercent(
    actual: bigint,
    expected: bigint,
    percentTolerance: number = 1 // 1% default
  ): void {
    const tolerance = (expected * BigInt(percentTolerance)) / 100n;
    this.expectCloseTo(actual, expected, tolerance);
  }
}

/**
 * ⛽ GAS MEASUREMENT HELPERS
 */
export class GasHelpers {
  /**
   * Measure gas used by a transaction
   */
  static async measureGas(promise: Promise<any>): Promise<bigint> {
    const tx = await promise;
    const receipt = await tx.wait();
    return receipt.gasUsed;
  }

  /**
   * Assert gas usage is below threshold
   */
  static async expectGasBelow(
    promise: Promise<any>,
    gasLimit: bigint
  ): Promise<void> {
    const gasUsed = await this.measureGas(promise);
    expect(gasUsed).to.be.lte(gasLimit);
  }

  /**
   * Compare gas usage between two operations
   */
  static async compareGasUsage(
    operation1: Promise<any>,
    operation2: Promise<any>
  ): Promise<{ op1Gas: bigint; op2Gas: bigint; difference: bigint }> {
    const op1Gas = await this.measureGas(operation1);
    const op2Gas = await this.measureGas(operation2);
    const difference = op1Gas > op2Gas ? op1Gas - op2Gas : op2Gas - op1Gas;

    return { op1Gas, op2Gas, difference };
  }
}

/**
 * 💰 BALANCE HELPERS
 */
export class BalanceHelpers {
  /**
   * Get ETH balance of address
   */
  static async getEthBalance(address: string): Promise<bigint> {
    return await ethers.provider.getBalance(address);
  }

  /**
   * Get ERC20 token balance
   */
  static async getTokenBalance(
    tokenContract: BaseContract,
    address: string
  ): Promise<bigint> {
    return await tokenContract.balanceOf(address);
  }

  /**
   * Track balance changes during operation
   */
  static async trackBalanceChange(
    address: string,
    operation: () => Promise<any>,
    tokenContract?: BaseContract
  ): Promise<bigint> {
    const balanceBefore = tokenContract
      ? await this.getTokenBalance(tokenContract, address)
      : await this.getEthBalance(address);

    await operation();

    const balanceAfter = tokenContract
      ? await this.getTokenBalance(tokenContract, address)
      : await this.getEthBalance(address);

    return balanceAfter - balanceBefore;
  }
}

/**
 * 📸 SNAPSHOT HELPERS
 */
export class SnapshotHelpers {
  private static snapshots: Map<string, string> = new Map();

  /**
   * Take a snapshot with a name
   */
  static async takeSnapshot(name: string): Promise<string> {
    const snapshot = await time.snapshot();
    const snapshotId = snapshot.toString();
    this.snapshots.set(name, snapshotId);
    return snapshotId;
  }

  /**
   * Restore to named snapshot
   */
  static async restoreSnapshot(name: string): Promise<void> {
    const snapshotId = this.snapshots.get(name);
    if (!snapshotId) {
      throw new Error(`Snapshot '${name}' not found`);
    }
    await time.revert(snapshotId);
  }

  /**
   * Auto snapshot - take snapshot before and restore after
   */
  static autoSnapshot() {
    return {
      async beforeEach() {
        await SnapshotHelpers.takeSnapshot("auto");
      },
      async afterEach() {
        await SnapshotHelpers.restoreSnapshot("auto");
      },
    };
  }
}

/**
 * 🔢 NUMBER HELPERS
 */
export class NumberHelpers {
  /**
   * Parse ETH amount
   */
  static parseEth(amount: string): bigint {
    return ethers.parseEther(amount);
  }

  /**
   * Parse token amount with decimals
   */
  static parseUnits(amount: string, decimals: number): bigint {
    return ethers.parseUnits(amount, decimals);
  }

  /**
   * Format ETH amount for display
   */
  static formatEth(amount: bigint): string {
    return ethers.formatEther(amount);
  }

  /**
   * Format token amount for display
   */
  static formatUnits(amount: bigint, decimals: number): string {
    return ethers.formatUnits(amount, decimals);
  }

  /**
   * Calculate percentage
   */
  static calculatePercentage(part: bigint, total: bigint): number {
    return Number((part * 10000n) / total) / 100; // Returns percentage with 2 decimals
  }

  /**
   * Apply basis points
   */
  static applyBasisPoints(amount: bigint, basisPoints: number): bigint {
    return (amount * BigInt(basisPoints)) / 10000n;
  }
}

/**
 * 🔍 DEBUGGING HELPERS
 */
export class DebugHelpers {
  /**
   * Log contract state for debugging
   */
  static async logContractState(
    contract: BaseContract,
    stateFunctions: string[]
  ): Promise<void> {
    console.log(`\n📊 Contract State: ${await contract.getAddress()}`);
    
    for (const func of stateFunctions) {
      try {
        const result = await contract[func]();
        console.log(`   ${func}: ${result}`);
      } catch (error) {
        console.log(`   ${func}: ERROR - ${error}`);
      }
    }
  }

  /**
   * Log balances for debugging
   */
  static async logBalances(
    addresses: string[],
    tokenContract?: BaseContract
  ): Promise<void> {
    console.log("\n💰 Balances:");
    
    for (const address of addresses) {
      if (tokenContract) {
        const balance = await BalanceHelpers.getTokenBalance(tokenContract, address);
        const symbol = await tokenContract.symbol();
        console.log(`   ${address}: ${NumberHelpers.formatUnits(balance, 18)} ${symbol}`);
      } else {
        const balance = await BalanceHelpers.getEthBalance(address);
        console.log(`   ${address}: ${NumberHelpers.formatEth(balance)} ETH`);
      }
    }
  }

  /**
   * Wait for user input (useful for manual inspection)
   */
  static async pauseForInspection(message: string = "Press any key to continue..."): Promise<void> {
    if (process.env.NODE_ENV === "test-debug") {
      console.log(`\n⏸️  ${message}`);
      // In real implementation, you'd add readline here
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * 🎭 TEST DATA GENERATORS
 */
export class TestDataGenerators {
  /**
   * Generate random address
   */
  static randomAddress(): string {
    return ethers.Wallet.createRandom().address;
  }

  /**
   * Generate random amount within range
   */
  static randomAmount(min: bigint, max: bigint): bigint {
    const range = max - min;
    const random = BigInt(Math.floor(Math.random() * Number(range)));
    return min + random;
  }

  /**
   * Generate test token data
   */
  static generateTokenData() {
    return {
      name: "Test Token",
      symbol: "TEST",
      decimals: 18,
      supply: ethers.parseEther("1000000"),
    };
  }

  /**
   * Generate test user accounts
   */
  static async generateTestUsers(count: number): Promise<HardhatEthersSigner[]> {
    const accounts = await ethers.getSigners();
    return accounts.slice(1, count + 1); // Skip owner (first account)
  }
}

// Export all helpers as a single object for convenience
export const TestUtils = {
  Time: TimeHelpers,
  Assert: TestAssertions,
  Gas: GasHelpers,
  Balance: BalanceHelpers,
  Snapshot: SnapshotHelpers,
  Number: NumberHelpers,
  Debug: DebugHelpers,
  Data: TestDataGenerators,
  setupEnvironment: setupTestEnvironment,
};