import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * 🔒 WITHDRAWAL DEADLINE MONITORING - UNIT TESTS
 * 
 * Tests deadline monitoring events and MEV protection without fork:
 * - WithdrawalStarted event emission
 * - WithdrawalCompleted event with timing
 * - WithdrawalDeadlineCritical warnings
 * - Deadline validation and expiration
 */

describe("Unit: Withdrawal Deadline Monitoring", function () {
  let beacon: any;
  let proxyGeneral: any;
  let liquidityManager: any;
  let tokenManager: any;
  let valueCalculator: any;
  let swapManager: any;
  let parameterManager: any;
  let mockUSDC: any;
  let mockWBTC: any;
  let mockWETH: any;
  let mockOracle: any;
  let chainlinkAdapter: any;
  let owner: any;
  let user1: any;
  let feeRecipient: any;

  const DEPOSIT_AMOUNT = ethers.parseEther("5.0");

  async function deployFixture() {
    const [owner, user1, feeRecipient] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    const mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    
    const MockWETH = await ethers.getContractFactory("MockWETH");
    const mockWETH = await MockWETH.deploy();

    const MockChainlinkOracle = await ethers.getContractFactory("MockChainlinkOracle");
    const mockOracle = await MockChainlinkOracle.deploy(
      ethers.parseUnits("2000", 8),
      8,
      "ETH/USD"
    );

    // Deploy Beacon
    const Beacon = await ethers.getContractFactory("Beacon");
    const beacon = await Beacon.deploy();
    await beacon.updateImplementation("WETH", await mockWETH.getAddress());

    // Deploy ChainlinkAdapter
    const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
    const chainlinkAdapter = await ChainlinkAdapter.deploy();
    await chainlinkAdapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600, "USD");
    await chainlinkAdapter.setPriceFeed("WBTC", await mockOracle.getAddress(), 8, 3600, "USD");

    // Deploy core contracts
    const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
    const proxyGeneral = await ProxyGeneral.deploy(await beacon.getAddress());

    const TokenManager = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TokenManager.deploy(await beacon.getAddress(), await chainlinkAdapter.getAddress());

    const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
    const valueCalculator = await ValueCalculator.deploy(await beacon.getAddress());

    const SwapManager = await ethers.getContractFactory("SwapManager");
    const swapManager = await SwapManager.deploy(await beacon.getAddress());

    const ParameterManager = await ethers.getContractFactory("ParameterManager");
    const parameterManager = await ParameterManager.deploy(await beacon.getAddress());

    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LiquidityManager.deploy(await beacon.getAddress());

    // Register in Beacon
    await beacon.updateImplementation("ProxyGeneral", await proxyGeneral.getAddress());
    await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
    await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
    await beacon.updateImplementation("SwapManager", await swapManager.getAddress());
    await beacon.updateImplementation("ParameterManager", await parameterManager.getAddress());
    await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());

    // Setup tokens
    await tokenManager.manageTokenData("USDC", await mockUSDC.getAddress(), await mockOracle.getAddress(), 6, 8, 3600);
    await tokenManager.manageTokenData("WBTC", await mockWBTC.getAddress(), await mockOracle.getAddress(), 8, 8, 3600);

    // Setup LiquidityManager
    await liquidityManager.setFeeRecipient(feeRecipient.address);
    await liquidityManager.setDepositFee(50);
    await liquidityManager.setWithdrawFee(100);
    await liquidityManager.setWithdrawLimits(
      ethers.parseEther("100"),
      ethers.parseEther("500"),
      ethers.parseEther("0.001"),
      ethers.parseEther("50")
    );

    // Authorize
    await proxyGeneral.authorizeModule(await liquidityManager.getAddress(), "LiquidityManager");
    await proxyGeneral.setRateLimit("deposit", ethers.parseEther("200"), ethers.parseEther("1000"));
    await proxyGeneral.setRateLimit("withdraw", ethers.parseEther("1000"), ethers.parseEther("2000"));
    
    await parameterManager.getFunction("proposeParameterChange(string,uint256)")("minDeposit", ethers.parseEther("0.01"));
    await parameterManager.getFunction("proposeParameterChange(string,uint256)")("poolReserveRatio", 2000);

    return {
      beacon, proxyGeneral, liquidityManager, tokenManager, valueCalculator,
      swapManager, parameterManager, mockUSDC, mockWBTC, mockWETH, mockOracle,
      chainlinkAdapter, owner, user1, feeRecipient
    };
  }

  beforeEach(async function () {
    const fixture = await deployFixture();
    beacon = fixture.beacon;
    proxyGeneral = fixture.proxyGeneral;
    liquidityManager = fixture.liquidityManager;
    tokenManager = fixture.tokenManager;
    valueCalculator = fixture.valueCalculator;
    swapManager = fixture.swapManager;
    parameterManager = fixture.parameterManager;
    mockUSDC = fixture.mockUSDC;
    mockWBTC = fixture.mockWBTC;
    mockWETH = fixture.mockWETH;
    mockOracle = fixture.mockOracle;
    chainlinkAdapter = fixture.chainlinkAdapter;
    owner = fixture.owner;
    user1 = fixture.user1;
    feeRecipient = fixture.feeRecipient;

    // Bootstrap pool
    await liquidityManager.connect(owner).deposit({ value: ethers.parseEther("10") });
    await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
  });

  describe("🎯 Deadline Event Emission", function () {
    
    it("UNIT-WD-001: should emit WithdrawalStarted with deadline info", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 2n;
      
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock!.timestamp;
      const deadline = currentTime + (20 * 60); // 20 minutes
      
      console.log(`\n📡 TESTING WithdrawalStarted EVENT:`);
      console.log(`   Current time: ${currentTime}`);
      console.log(`   Deadline: ${deadline} (+1200s)`);
      
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, deadline);
      const receipt = await tx.wait();
      
      // Find WithdrawalStarted event
      const startedEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "WithdrawalStarted";
        } catch { return false; }
      });
      
      const parsed = liquidityManager.interface.parseLog({
        topics: startedEvent!.topics,
        data: startedEvent!.data
      });
      
      expect(parsed?.args.user).to.equal(user1.address);
      expect(parsed?.args.shares).to.equal(withdrawShares);
      expect(parsed?.args.deadline).to.equal(deadline);
      // Allow 1199-1200 due to block timing
      expect(parsed?.args.timeRemaining).to.be.within(1199n, 1200n);
      expect(parsed?.args.requiresSwap).to.equal(false);
      
      console.log(`   ✅ WithdrawalStarted event emitted correctly`);
    });

    it("UNIT-WD-002: should emit WithdrawalCompleted with timing metrics", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 4n;
      
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock!.timestamp;
      const deadline = currentTime + 600;
      
      console.log(`\n⏱️  TESTING WithdrawalCompleted EVENT:`);
      
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, deadline);
      const receipt = await tx.wait();
      
      // Find WithdrawalCompleted event
      const completedEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "WithdrawalCompleted";
        } catch { return false; }
      });
      
      expect(completedEvent).to.not.be.undefined;
      
      const parsed = liquidityManager.interface.parseLog({
        topics: completedEvent!.topics,
        data: completedEvent!.data
      });
      
      console.log(`   User: ${parsed?.args.user}`);
      console.log(`   Shares burned: ${ethers.formatEther(parsed?.args.shares)}`);
      console.log(`   ETH received: ${ethers.formatEther(parsed?.args.ethReceived)}`);
      console.log(`   Deadline: ${parsed?.args.deadline}`);
      console.log(`   Time used: ${parsed?.args.timeUsed}s`);
      console.log(`   Swap executed: ${parsed?.args.swapExecuted}`);
      
      expect(parsed?.args.user).to.equal(user1.address);
      expect(parsed?.args.deadline).to.equal(deadline);
      // Allow 0-1 seconds (EVM may execute in same block)
      expect(parsed?.args.timeUsed).to.be.within(0n, 2n);
      expect(parsed?.args.swapExecuted).to.be.false;
      
      console.log(`   ✅ All timing metrics tracked correctly`);
    });

    it("UNIT-WD-003: should emit Critical warning for deadline < 3 min", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 4n;
      
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock!.timestamp;
      const criticalDeadline = currentTime + 120; // 2 minutes
      
      console.log(`\n🔴 TESTING CRITICAL DEADLINE WARNING:`);
      console.log(`   Deadline: +120s (2 minutes - CRITICAL)`);
      
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, criticalDeadline);
      const receipt = await tx.wait();
      
      // Count critical warnings
      const criticalEvents = receipt!.logs.filter((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "WithdrawalDeadlineCritical";
        } catch { return false; }
      });
      
      console.log(`   Critical warnings emitted: ${criticalEvents.length}`);
      
      expect(criticalEvents.length).to.be.gt(0);
      
      criticalEvents.forEach((event: any, index: number) => {
        const parsed = liquidityManager.interface.parseLog({ topics: event.topics, data: event.data });
        console.log(`   [${index + 1}] Stage: ${parsed?.args.stage}, Time remaining: ${parsed?.args.timeRemaining}s`);
      });
      
      console.log(`   ✅ Critical warnings correctly emitted`);
    });
  });

  describe("🚫 Deadline Validation", function () {
    
    it("UNIT-WD-004: should revert if deadline already expired", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 4n;
      
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock!.timestamp;
      const expiredDeadline = currentTime - 60; // 1 minute in past
      
      console.log(`\n⏰ TESTING EXPIRED DEADLINE:`);
      console.log(`   Current time: ${currentTime}`);
      console.log(`   Deadline: ${expiredDeadline} (expired 60s ago)`);
      
      await expect(
        liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, expiredDeadline)
      ).to.be.revertedWith("Withdraw deadline expired");
      
      console.log(`   ✅ Correctly reverted with deadline expired`);
    });

    it("UNIT-WD-005: should accept deadline exactly at current time", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 4n;
      
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock!.timestamp;
      // Add 1 second buffer to avoid timing race (tx executes in next block)
      const exactDeadline = currentTime + 1;
      
      console.log(`\n⏰ TESTING EXACT DEADLINE (edge case):`);
      console.log(`   Deadline = current time + 1s: ${exactDeadline}`);
      
      // This should succeed (deadline validation is <=)
      await liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, exactDeadline);
      
      console.log(`   ✅ Withdrawal accepted with exact deadline`);
    });

    it("UNIT-WD-006: should work with legacy withdraw (auto deadline)", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 4n;
      
      console.log(`\n🔄 TESTING LEGACY WITHDRAW (auto deadline = 20 min):`);
      
      const tx = await liquidityManager.connect(user1).withdraw(withdrawShares);
      const receipt = await tx.wait();
      
      // Check for WithdrawalStarted with auto deadline
      const startedEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "WithdrawalStarted";
        } catch { return false; }
      });
      
      expect(startedEvent).to.not.be.undefined;
      
      const parsed = liquidityManager.interface.parseLog({
        topics: startedEvent!.topics,
        data: startedEvent!.data
      });
      
      console.log(`   Auto deadline set: ${parsed?.args.deadline}`);
      console.log(`   Time remaining: ${parsed?.args.timeRemaining}s (~20 min)`);
      
      // Should be ~1200 seconds (20 minutes)
      expect(parsed?.args.timeRemaining).to.be.closeTo(1200, 5);
      
      console.log(`   ✅ Legacy withdraw uses auto deadline correctly`);
    });
  });

  describe("📊 Event Data Accuracy", function () {
    
    it("UNIT-WD-007: should track requiresSwap flag correctly", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const smallWithdraw = lpBalance / 10n; // Small - no swap needed
      
      const currentBlock = await ethers.provider.getBlock("latest");
      const deadline = currentBlock!.timestamp + 600;
      
      console.log(`\n🔍 TESTING requiresSwap FLAG:`);
      
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(smallWithdraw, deadline);
      const receipt = await tx.wait();
      
      const startedEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "WithdrawalStarted";
        } catch { return false; }
      });
      
      const parsed = liquidityManager.interface.parseLog({
        topics: startedEvent!.topics,
        data: startedEvent!.data
      });
      
      console.log(`   Requires swap: ${parsed?.args.requiresSwap}`);
      console.log(`   (Pool has sufficient WETH for small withdrawal)`);
      
      expect(parsed?.args.requiresSwap).to.be.false;
      
      console.log(`   ✅ requiresSwap flag accurate`);
    });

    it("UNIT-WD-008: should record accurate timeUsed metric", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 4n;
      
      const currentBlock = await ethers.provider.getBlock("latest");
      const deadline = currentBlock!.timestamp + 600;
      
      const startTime = currentBlock!.timestamp;
      
      console.log(`\n⏱️  TESTING timeUsed ACCURACY:`);
      console.log(`   Start time: ${startTime}`);
      
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, deadline);
      const receipt = await tx.wait();
      
      const endBlock = await ethers.provider.getBlock(receipt!.blockNumber);
      const actualTimeUsed = endBlock!.timestamp - startTime;
      
      const completedEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "WithdrawalCompleted";
        } catch { return false; }
      });
      
      const parsed = liquidityManager.interface.parseLog({
        topics: completedEvent!.topics,
        data: completedEvent!.data
      });
      
      console.log(`   Actual time used: ${actualTimeUsed}s`);
      console.log(`   Recorded timeUsed: ${parsed?.args.timeUsed}s`);
      
      // Allow 0-1 seconds (EVM may execute in same block)
      expect(Number(parsed?.args.timeUsed)).to.be.within(0, actualTimeUsed + 1);
      expect(Number(parsed?.args.timeUsed)).to.be.closeTo(actualTimeUsed, 1);
      
      console.log(`   ✅ timeUsed metric accurate`);
    });
  });

  describe("🔄 Sequential Withdrawals", function () {
    
    it("UNIT-WD-009: should handle multiple withdrawals with same deadline", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawAmount = lpBalance / 10n;
      
      const currentBlock = await ethers.provider.getBlock("latest");
      const sharedDeadline = currentBlock!.timestamp + 600;
      
      console.log(`\n⚡ TESTING SEQUENTIAL WITHDRAWALS:`);
      console.log(`   Shared deadline: ${sharedDeadline}`);
      console.log(`   Performing 3 withdrawals...\n`);
      
      const results = [];
      
      for (let i = 0; i < 3; i++) {
        const tx = await liquidityManager.connect(user1).withdrawWithDeadline(withdrawAmount, sharedDeadline);
        const receipt = await tx.wait();
        
        const completedEvent = receipt!.logs.find((log: any) => {
          try {
            const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
            return parsed?.name === "WithdrawalCompleted";
          } catch { return false; }
        });
        
        const parsed = liquidityManager.interface.parseLog({
          topics: completedEvent!.topics,
          data: completedEvent!.data
        });
        
        results.push({
          index: i + 1,
          timeUsed: Number(parsed?.args.timeUsed),
          gasUsed: Number(receipt!.gasUsed)
        });
        
        console.log(`   [${i + 1}/3] Time used: ${parsed?.args.timeUsed}s, Gas: ${receipt!.gasUsed.toLocaleString()}`);
      }
      
      console.log(`\n   ✅ All 3 withdrawals completed with same deadline`);
      console.log(`   Average gas: ${Math.round(results.reduce((sum, r) => sum + r.gasUsed, 0) / 3).toLocaleString()}`);
    });
  });
});
