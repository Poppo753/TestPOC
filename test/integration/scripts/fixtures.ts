// SPDX-License-Identifier: MIT
/**
 * @title Script Integration Test Fixtures
 * @dev Common fixtures and utilities for script integration testing
 * 
 * Provides:
 * - Complete system deployment
 * - Mock contracts setup
 * - Test data population
 * - Common assertions
 */

import { ethers } from "hardhat";
import { expect } from "chai";
import { CONTRACT_ADDRESSES } from "../../../scripts/config/config";

/**
 * @notice Deploy complete DeFi system for script testing
 * @dev Deploys all core contracts + mocks in correct order
 */
export async function deployScriptTestFixture() {
  const [owner, user1, user2, user3, feeRecipient] = await ethers.getSigners();

  // ==================== MOCK CONTRACTS ====================
  
  // Deploy MockWETH
  const MockWETH = await ethers.getContractFactory("MockWETH");
  const mockWETH = await MockWETH.deploy();

  // Deploy MockChainlinkOracle
  const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
  const mockOracle = await MockOracleAdapter.deploy();
  await mockOracle.setupToken("WETH", ethers.parseEther("1"), 18, true);

  // Deploy mock tokens
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
  const mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);

  // ==================== BEACON DEPLOYMENT ====================
  
  const Beacon = await ethers.getContractFactory("Beacon");
  const beacon = await Beacon.deploy();

  // Register WETH in Beacon
  await beacon.updateImplementation("WETH", await mockWETH.getAddress());
  await beacon.updateImplementation("BASE_ASSET", await mockWETH.getAddress());

  // ==================== CORE CONTRACTS ====================
  
  // Deploy ProxyGeneral
  const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
  const proxyGeneral = await ProxyGeneral.deploy(await beacon.getAddress(), "WETH");

  // Deploy TokenManager
  const TokenManager = await ethers.getContractFactory("TokenManager");
  const tokenManager = await TokenManager.deploy(await beacon.getAddress(), await mockOracle.getAddress());
  await tokenManager.setBaseAssetCode("WETH");

  // Deploy ValueCalculator
  const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
  const valueCalculator = await ValueCalculator.deploy(await beacon.getAddress(), "WETH");

  // Deploy ParameterManager
  const ParameterManager = await ethers.getContractFactory("ParameterManager");
  const parameterManager = await ParameterManager.deploy(await beacon.getAddress(), 18);

  // Deploy LiquidityManager
  const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
  const liquidityManager = await LiquidityManager.deploy(await beacon.getAddress(), "WETH");

  // Deploy SwapManager
  const SwapManager = await ethers.getContractFactory("SwapManager");
  const swapManager = await SwapManager.deploy(await beacon.getAddress(), "WETH");

  // Deploy EmergencyHandler
  const EmergencyHandler = await ethers.getContractFactory("EmergencyHandler");
  const emergencyHandler = await EmergencyHandler.deploy(await beacon.getAddress());

  // ==================== BEACON REGISTRATION ====================
  
  await beacon.updateImplementation("ProxyGeneral", await proxyGeneral.getAddress());
  await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
  await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
  await beacon.updateImplementation("ParameterManager", await parameterManager.getAddress());
  await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());
  await beacon.updateImplementation("SwapManager", await swapManager.getAddress());
  await beacon.updateImplementation("EmergencyHandler", await emergencyHandler.getAddress());

  Object.assign(CONTRACT_ADDRESSES, {
    beacon: await beacon.getAddress(),
    liquidityManager: await liquidityManager.getAddress(),
    valueCalculator: await valueCalculator.getAddress(),
    tokenManager: await tokenManager.getAddress(),
    parameterManager: await parameterManager.getAddress(),
    proxyGeneral: await proxyGeneral.getAddress(),
    swapManager: await swapManager.getAddress(),
    emergencyHandler: await emergencyHandler.getAddress()
  });

  // ==================== SYSTEM CONFIGURATION ====================
  
  // Authorize modules in ProxyGeneral
  await proxyGeneral.authorizeModule(await liquidityManager.getAddress(), "LiquidityManager");
  await proxyGeneral.authorizeModule(await swapManager.getAddress(), "SwapManager");
  await proxyGeneral.authorizeModule(await emergencyHandler.getAddress(), "EmergencyHandler");

  // Configure LiquidityManager
  await liquidityManager.setFeeRecipient(feeRecipient.address);
  await liquidityManager.setDepositFee(50); // 0.5%
  await liquidityManager.setWithdrawFee(100); // 1%
  await liquidityManager.setDepositsEnabled(true);
  await liquidityManager.setWithdrawsEnabled(true);
  await liquidityManager.setWithdrawLimits(
    ethers.parseEther("600"),    // dailyLimit
    ethers.parseEther("2000"),   // globalLimit
    ethers.parseEther("0.000001"), // minAmount
    ethers.parseEther("500")      // maxAmount
  );

  // Setup rate limiting
  await proxyGeneral.setRateLimit("deposit", ethers.parseEther("200"), ethers.parseEther("1000"));
  await proxyGeneral.setRateLimit("withdraw", ethers.parseEther("1000"), ethers.parseEther("2000"));

  // Setup parameters
  await parameterManager.getFunction("proposeParameterChange(string,uint256)")
    ("minDeposit", ethers.parseEther("0.01"));

  // Note: Mock tokens are deployed but not registered in TokenManager
  // TokenManager registration would be tested separately in admin scripts

  // ==================== INITIAL LIQUIDITY ====================
  
  // Bootstrap pool with the current ERC20-only deposit API.
  const bootstrap = ethers.parseEther("10");
  await mockWETH.connect(owner).deposit({ value: bootstrap });
  await mockWETH.connect(owner).approve(await liquidityManager.getAddress(), bootstrap);
  await liquidityManager.connect(owner).deposit(bootstrap);

  return {
    // Contracts
    beacon,
    proxyGeneral,
    tokenManager,
    valueCalculator,
    parameterManager,
    liquidityManager,
    swapManager,
    emergencyHandler,
    // Mocks
    mockWETH,
    mockOracle,
    mockUSDC,
    mockWBTC,
    // Signers
    owner,
    user1,
    user2,
    user3,
    feeRecipient
  };
}

/**
 * @notice Populate system with test data
 * @dev Creates deposits, swaps, and activity for testing
 */
export async function populateTestData(fixture: any) {
  const { liquidityManager, mockWETH, user1, user2, user3 } = fixture;

  // Multiple deposits from different users
  for (const [user, amount] of [
    [user1, ethers.parseEther("5")],
    [user2, ethers.parseEther("3")],
    [user3, ethers.parseEther("2")]
  ] as const) {
    await mockWETH.connect(user).deposit({ value: amount });
    await mockWETH.connect(user).approve(await liquidityManager.getAddress(), amount);
    await liquidityManager.connect(user).deposit(amount);
  }

  return {
    totalDeposited: ethers.parseEther("20"), // 10 bootstrap + 10 from users
    userCount: 4 // owner + 3 users
  };
}

/**
 * @notice Common assertions for script output validation
 */
export class ScriptAssertions {
  /**
   * Validate ScriptResult interface
   */
  static validateScriptResult(result: any) {
    expect(result).to.have.property("success");
    expect(result.success).to.be.a("boolean");
    
    if (result.success) {
      expect(result).to.have.property("data");
    } else {
      expect(result).to.have.property("error");
      expect(result.error).to.be.a("string");
    }
  }

  /**
   * Validate transaction was successful
   */
  static async validateTransaction(txHash: string) {
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    expect(receipt).to.not.be.null;
    expect(receipt!.status).to.equal(1); // Success
  }

  /**
   * Validate balance change
   */
  static validateBalanceChange(
    balanceBefore: bigint,
    balanceAfter: bigint,
    expectedChange: bigint,
    tolerance: bigint = ethers.parseEther("0.01")
  ) {
    const actualChange = balanceAfter > balanceBefore 
      ? balanceAfter - balanceBefore 
      : balanceBefore - balanceAfter;
    
    const diff = actualChange > expectedChange 
      ? actualChange - expectedChange 
      : expectedChange - actualChange;
    
    expect(diff).to.be.lte(tolerance);
  }

  /**
   * Validate event emission
   */
  static async validateEventEmitted(
    txHash: string,
    contractAddress: string,
    eventName: string
  ) {
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    expect(receipt).to.not.be.null;
    
    const logs = receipt!.logs.filter(log => log.address === contractAddress);
    expect(logs.length).to.be.gt(0, `No events found from contract ${contractAddress}`);
  }
}

/**
 * @notice Helper utilities for script testing
 */
export class ScriptTestHelpers {
  /**
   * Wait for N blocks
   */
  static async mineBlocks(n: number) {
    for (let i = 0; i < n; i++) {
      await ethers.provider.send("evm_mine", []);
    }
  }

  /**
   * Advance time by N seconds
   */
  static async advanceTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  /**
   * Get current block timestamp
   */
  static async getCurrentTimestamp(): Promise<number> {
    const block = await ethers.provider.getBlock("latest");
    return block!.timestamp;
  }

  /**
   * Reset hardhat network to clean state
   */
  static async resetNetwork() {
    await ethers.provider.send("hardhat_reset", []);
  }

  /**
   * Snapshot current state
   */
  static async snapshot(): Promise<string> {
    return await ethers.provider.send("evm_snapshot", []);
  }

  /**
   * Restore to snapshot
   */
  static async restore(snapshotId: string) {
    await ethers.provider.send("evm_revert", [snapshotId]);
  }

  /**
   * Format error message for better readability
   */
  static formatError(error: any): string {
    if (error.message) {
      return error.message;
    }
    if (error.reason) {
      return error.reason;
    }
    return error.toString();
  }

  /**
   * Parse contract revert reason
   */
  static parseRevertReason(error: any): string {
    const reason = error.reason || error.message || "";
    
    // Try to extract revert reason from error
    const match = reason.match(/reverted with reason string '(.+)'/);
    if (match) {
      return match[1];
    }
    
    return reason;
  }
}

/**
 * @notice Test data generators
 */
export class TestDataGenerators {
  /**
   * Generate random address
   */
  static randomAddress(): string {
    return ethers.Wallet.createRandom().address;
  }

  /**
   * Generate random amount between min and max
   */
  static randomAmount(minEth: string, maxEth: string): bigint {
    const min = ethers.parseEther(minEth);
    const max = ethers.parseEther(maxEth);
    const range = max - min;
    const random = BigInt(Math.floor(Math.random() * Number(range)));
    return min + random;
  }

  /**
   * Generate array of test users
   */
  static async generateTestUsers(count: number) {
    const users = [];
    for (let i = 0; i < count; i++) {
      const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
      users.push(wallet);
    }
    return users;
  }

  /**
   * Generate batch deposit data
   */
  static generateBatchDeposits(count: number) {
    const deposits = [];
    for (let i = 0; i < count; i++) {
      deposits.push({
        amount: this.randomAmount("0.1", "5"),
        user: this.randomAddress()
      });
    }
    return deposits;
  }
}
