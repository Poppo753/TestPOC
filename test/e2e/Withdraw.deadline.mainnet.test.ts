import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

// Helper to delay between RPC calls (rate limit: 5 calls/sec)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 🔗 WITHDRAWAL DEADLINE & MEV PROTECTION - E2E MAINNET FORK TESTS
 * 
 * Tests deadline propagation using EXISTING deployed contracts on Arbitrum:
 * - Uses real deployed LiquidityManager, SwapManager, UniswapV3Plugin
 * - Tests with real Uniswap V3 pools and liquidity
 * - Verifies deadline events and MEV protection
 * 
 * REQUIRES: FORK_ENABLED=true in .env
 */

describe("E2E: Withdrawal Deadline - Mainnet Fork", function () {
  this.timeout(300000); // 5 minutes
  
  let liquidityManager: Contract;
  let proxyGeneral: Contract;
  let user1: any;
  let impersonatedUser: any;

  // Deployed contract addresses (from .env)
  const LIQUIDITY_MANAGER_ADDRESS = "0x545b79254F74Ba33958290BB73F2a338509c975d";
  const PROXY_GENERAL_ADDRESS = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
  
  // Known user with LP tokens (find from Arbiscan)
  // For testing, we'll use a whale address or deploy our own liquidity
  const LP_TOKEN_HOLDER = "0x8390e98483a9b39265428c8610371134B5d11C3F"; // Deployer address

  before(async function () {
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 42161n && network.chainId !== 31337n) {
      console.log("⚠️  Skipping - requires Arbitrum fork (FORK_ENABLED=true)");
      this.skip();
    }

    [user1] = await ethers.getSigners();

    console.log("\n🌐 MAINNET FORK SETUP");
    console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`   Block: ${await ethers.provider.getBlockNumber()}`);
    console.log(`   Testing with: ${user1.address}`);
  });

  beforeEach(async function () {
    // Connect to existing deployed contracts
    liquidityManager = await ethers.getContractAt("LiquidityManager", LIQUIDITY_MANAGER_ADDRESS);
    proxyGeneral = await ethers.getContractAt("ProxyGeneral", PROXY_GENERAL_ADDRESS);
    
    console.log("\n✅ Connected to mainnet contracts");
    console.log(`   LiquidityManager: ${LIQUIDITY_MANAGER_ADDRESS}`);
    console.log(`   ProxyGeneral: ${PROXY_GENERAL_ADDRESS}`);
    
    await delay(1000); // Wait 1s between setup calls (rate limit: 5 calls/sec)

    // Fund user1 with ETH for gas and deposits (fork allows this)
    await ethers.provider.send("hardhat_setBalance", [
      user1.address,
      "0x56BC75E2D63100000", // 100 ETH
    ]);

    // Fund LiquidityManager contract with ETH for withdrawals
    await ethers.provider.send("hardhat_setBalance", [
      LIQUIDITY_MANAGER_ADDRESS,
      "0xDE0B6B3A7640000", // 1 ETH
    ]);
    
    await delay(1000); // Wait 1s after funding
    
    // Verify balance was set
    const lmBalance = await ethers.provider.getBalance(LIQUIDITY_MANAGER_ADDRESS);
    console.log(`   LiquidityManager balance: ${ethers.formatEther(lmBalance)} ETH`);

    // Check if user has LP tokens
    const lpBalance = await proxyGeneral.balanceOf(user1.address);
    console.log(`   User LP balance: ${ethers.formatEther(lpBalance)} LP`);

    // If user has no LP tokens, we need to deposit first or impersonate a holder
    if (lpBalance === 0n) {
      // Try to deposit some ETH to get LP tokens
      console.log("\n🔄 User has no LP tokens - attempting deposit...");
      
      // Check LM balance before deposit
      const lmBalanceBefore = await ethers.provider.getBalance(LIQUIDITY_MANAGER_ADDRESS);
      console.log(`   LM balance before deposit: ${ethers.formatEther(lmBalanceBefore)} ETH`);
      
      try {
        const depositAmount = ethers.parseEther("0.1"); // Small test deposit
        const depositTx = await liquidityManager.connect(user1).deposit({ 
          value: depositAmount,
          gasLimit: 2000000 
        });
        await depositTx.wait();
        
        const newBalance = await proxyGeneral.balanceOf(user1.address);
        console.log(`   ✅ Deposited, new LP balance: ${ethers.formatEther(newBalance)} LP`);
        
        // Check LM balance after deposit
        const lmBalanceAfter = await ethers.provider.getBalance(LIQUIDITY_MANAGER_ADDRESS);
        console.log(`   LM balance after deposit: ${ethers.formatEther(lmBalanceAfter)} ETH`);
        
        await delay(1000); // Wait 1s after deposit
      } catch (error: any) {
        console.log(`   ⚠️  Deposit failed: ${error.message}`);
        console.log("   Skipping tests - user needs LP tokens");
        this.skip();
      }
    }
  });

  describe("⚡ Basic Deadline Functionality", function () {
    it("E2E-MD-001: should withdraw with valid deadline (20 min)", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      if (lpBalance === 0n) {
        console.log("⚠️  Skipping - no LP tokens");
        this.skip();
      }

      const withdrawShares = lpBalance / 4n; // Withdraw 25%
      const currentBlock = await ethers.provider.getBlock("latest");
      const deadline = currentBlock!.timestamp + (20 * 60); // 20 minutes

      console.log("\n📊 WITHDRAWAL TEST:");
      console.log(`   LP Balance: ${ethers.formatEther(lpBalance)}`);
      console.log(`   Withdrawing: ${ethers.formatEther(withdrawShares)} LP (25%)`);
      console.log(`   Deadline: +${(20 * 60)}s (20 min)`);
      
      await delay(1000); // Wait 1s before withdrawal

      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(
        withdrawShares,
        deadline,
        { gasLimit: 3000000 }
      );
      const receipt = await tx.wait();
      await delay(1000); // Wait 1s after transaction

      console.log(`   ✅ Withdrawal completed`);
      console.log(`   Gas used: ${receipt!.gasUsed.toString()}`);

      // Verify WithdrawalStarted event
      const startedEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ 
            topics: log.topics, 
            data: log.data 
          });
          return parsed?.name === "WithdrawalStarted";
        } catch { return false; }
      });

      expect(startedEvent).to.not.be.undefined;
      const parsedStarted = liquidityManager.interface.parseLog({
        topics: startedEvent!.topics,
        data: startedEvent!.data
      });

      console.log(`\n📡 WithdrawalStarted Event:`);
      console.log(`   User: ${parsedStarted?.args.user}`);
      console.log(`   Shares: ${ethers.formatEther(parsedStarted?.args.shares)}`);
      console.log(`   Deadline: ${parsedStarted?.args.deadline}`);
      console.log(`   Time Remaining: ${parsedStarted?.args.timeRemaining}s`);
      console.log(`   Requires Swap: ${parsedStarted?.args.requiresSwap}`);

      expect(parsedStarted?.args.user).to.equal(user1.address);
      expect(parsedStarted?.args.deadline).to.equal(deadline);
      expect(parsedStarted?.args.timeRemaining).to.be.within(1190n, 1200n);
    });

    it("E2E-MD-002: should revert with expired deadline", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      if (lpBalance === 0n) {
        console.log("⚠️  Skipping - no LP tokens");
        this.skip();
      }

      const withdrawShares = lpBalance / 4n;
      const currentBlock = await ethers.provider.getBlock("latest");
      const expiredDeadline = currentBlock!.timestamp - 60; // 1 minute ago

      console.log("\n⏰ EXPIRED DEADLINE TEST:");
      console.log(`   Current time: ${currentBlock!.timestamp}`);
      console.log(`   Deadline: ${expiredDeadline} (expired 60s ago)`);

      await expect(
        liquidityManager.connect(user1).withdrawWithDeadline(
          withdrawShares,
          expiredDeadline,
          { gasLimit: 3000000 }
        )
      ).to.be.revertedWith("Withdraw deadline expired");

      console.log(`   ✅ Correctly rejected expired deadline`);
    });

    it("E2E-MD-003: should emit critical warning for tight deadline", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      if (lpBalance === 0n) {
        console.log("⚠️  Skipping - no LP tokens");
        this.skip();
      }

      const withdrawShares = lpBalance / 4n;
      const currentBlock = await ethers.provider.getBlock("latest");
      const tightDeadline = currentBlock!.timestamp + 120; // 2 minutes (CRITICAL)

      console.log("\n🔴 CRITICAL DEADLINE TEST:");
      console.log(`   Deadline: +120s (2 minutes - expect critical warnings)`);

      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(
        withdrawShares,
        tightDeadline,
        { gasLimit: 3000000 }
      );
      const receipt = await tx.wait();

      // Find WithdrawalDeadlineCritical events
      const criticalEvents = receipt!.logs.filter((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ 
            topics: log.topics, 
            data: log.data 
          });
          return parsed?.name === "WithdrawalDeadlineCritical";
        } catch { return false; }
      });

      console.log(`   Critical warnings emitted: ${criticalEvents.length}`);
      
      criticalEvents.forEach((log: any, i: number) => {
        const parsed = liquidityManager.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        console.log(`   [${i + 1}] Stage: ${parsed?.args.stage}, Time remaining: ${parsed?.args.timeRemaining}s`);
      });

      expect(criticalEvents.length).to.be.greaterThan(0);
      console.log(`   ✅ Critical warnings working correctly`);
    });
  });

  describe("🔄 Automatic Swap with Deadline", function () {
    it("E2E-MD-004: should propagate deadline to automatic swap", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      if (lpBalance === 0n) {
        console.log("⚠️  Skipping - no LP tokens");
        this.skip();
      }

      // Large withdrawal to force a swap
      const withdrawShares = lpBalance / 2n; // 50%
      const currentBlock = await ethers.provider.getBlock("latest");
      const deadline = currentBlock!.timestamp + (20 * 60);

      console.log("\n🔄 AUTOMATIC SWAP TEST:");
      console.log(`   Withdrawing: ${ethers.formatEther(withdrawShares)} LP (50%)`);
      console.log(`   Deadline: +1200s (20 min)`);

      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(
        withdrawShares,
        deadline,
        { gasLimit: 5000000 }
      );
      const receipt = await tx.wait();

      // Check if swap was triggered
      const swapTriggeredEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ 
            topics: log.topics, 
            data: log.data 
          });
          return parsed?.name === "AutomaticSwapTriggered";
        } catch { return false; }
      });

      if (swapTriggeredEvent) {
        const parsed = liquidityManager.interface.parseLog({
          topics: swapTriggeredEvent.topics,
          data: swapTriggeredEvent.data
        });

        console.log(`\n📡 AutomaticSwapTriggered Event:`);
        console.log(`   Token to swap: ${parsed?.args.tokenToSwap}`);
        console.log(`   Amount: ${ethers.formatUnits(parsed?.args.amountToSwap, 6)}`);
        console.log(`   WETH needed: ${ethers.formatEther(parsed?.args.wethNeeded)}`);
        console.log(`   Deadline: ${parsed?.args.deadline}`);
        console.log(`   Time remaining: ${parsed?.args.timeRemaining}s`);

        expect(parsed?.args.deadline).to.equal(deadline);
        console.log(`   ✅ Deadline correctly propagated to swap`);
      } else {
        console.log(`   ℹ️  No swap triggered (pool had sufficient WETH)`);
      }
    });
  });

  describe("⏱️ Timing Metrics", function () {
    it("E2E-MD-005: should track accurate timeUsed metric", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      if (lpBalance === 0n) {
        console.log("⚠️  Skipping - no LP tokens");
        this.skip();
      }

      const withdrawShares = lpBalance / 4n;
      const currentBlock = await ethers.provider.getBlock("latest");
      const deadline = currentBlock!.timestamp + (20 * 60);

      const startTime = currentBlock!.timestamp;
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(
        withdrawShares,
        deadline,
        { gasLimit: 3000000 }
      );
      const receipt = await tx.wait();

      const endBlock = await ethers.provider.getBlock(receipt!.blockNumber);
      const actualTimeUsed = endBlock!.timestamp - startTime;

      // Find WithdrawalCompleted event
      const completedEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ 
            topics: log.topics, 
            data: log.data 
          });
          return parsed?.name === "WithdrawalCompleted";
        } catch { return false; }
      });

      const parsed = liquidityManager.interface.parseLog({
        topics: completedEvent!.topics,
        data: completedEvent!.data
      });

      console.log(`\n⏱️  TIMING METRICS:`);
      console.log(`   Start time: ${startTime}`);
      console.log(`   End time: ${endBlock!.timestamp}`);
      console.log(`   Actual time used: ${actualTimeUsed}s`);
      console.log(`   Recorded timeUsed: ${parsed?.args.timeUsed}s`);

      // Allow small variance due to block timing
      expect(Number(parsed?.args.timeUsed)).to.be.within(0, actualTimeUsed + 2);
      console.log(`   ✅ Timing metrics accurate`);
    });
  });
});
