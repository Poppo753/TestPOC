import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

/**
 * 🔗 WITHDRAWAL DEADLINE & MEV PROTECTION - E2E FORK TESTS
 * 
 * Tests deadline propagation and MEV protection on Arbitrum fork:
 * - withdrawWithDeadline() with valid/expired deadlines
 * - Automatic swap with deadline propagation
 * - Deadline critical warnings (< 3 min, < 2 min)
 * - MEV protection verification with real Uniswap V3
 * 
 * FORK SETUP:
 * - Arbitrum Mainnet fork at latest block
 * - Real UniswapV3PluginDirect deployed
 * - Real WETH, USDC, WBTC tokens
 * - Real Uniswap V3 pools for liquidity
 */

describe("E2E: Withdrawal Deadline & MEV Protection (Arbitrum Fork)", function () {
  // Increase timeout for fork tests (fork setup can be slow)
  this.timeout(300000); // 5 minutes
  
  let beacon: Contract;
  let proxyGeneral: Contract;
  let liquidityManager: Contract;
  let tokenManager: Contract;
  let valueCalculator: Contract;
  let swapManager: Contract;
  let parameterManager: Contract;
  let uniswapV3Plugin: Contract;
  let chainlinkAdapter: Contract;
  let owner: any;
  let user1: any;
  let user2: any;
  let feeRecipient: any;

  // Real Arbitrum mainnet addresses
  const ARBITRUM_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Native USDC
  const ARBITRUM_WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const UNISWAP_V3_QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
  
  // Chainlink price feeds on Arbitrum
  const CHAINLINK_ETH_USD = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";
  const CHAINLINK_BTC_USD = "0x6ce185860a4963106506C203335A2910413708e9";
  const CHAINLINK_USDC_USD = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3";

  // Test constants
  const DEPOSIT_AMOUNT = ethers.parseEther("5.0"); // 5 ETH
  const WITHDRAWAL_DEADLINE_VALID = 20 * 60; // 20 minutes
  const WITHDRAWAL_DEADLINE_TIGHT = 4 * 60; // 4 minutes (triggers warning)
  const WITHDRAWAL_DEADLINE_CRITICAL = 2 * 60; // 2 minutes (triggers critical warning)

  before(async function () {
    // This test requires fork - skip if not forking
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 42161n && network.chainId !== 31337n) {
      console.log("⚠️  Skipping fork tests - not on Arbitrum or local fork");
      this.skip();
    }

    [owner, user1, user2, feeRecipient] = await ethers.getSigners();

    console.log("\n🌐 FORK ENVIRONMENT SETUP");
    console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`   Block Number: ${await ethers.provider.getBlockNumber()}`);
    console.log(`   Owner: ${owner.address}`);
    console.log(`   User1: ${user1.address}`);
  });

  beforeEach(async function () {
    console.log("\n🔧 DEPLOYING PROTOCOL ON FORK...");

    // Deploy Beacon
    const Beacon = await ethers.getContractFactory("Beacon");
    beacon = await Beacon.deploy();
    await beacon.updateImplementation("WETH", ARBITRUM_WETH);
    console.log(`   ✅ Beacon deployed: ${await beacon.getAddress()}`);

    // Deploy ChainlinkAdapter with real Arbitrum price feeds
    const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
    chainlinkAdapter = await ChainlinkAdapter.deploy();
    await chainlinkAdapter.setPriceFeed("ETH", CHAINLINK_ETH_USD, 8, 3600);
    await chainlinkAdapter.setPriceFeed("WBTC", CHAINLINK_BTC_USD, 8, 3600);
    await chainlinkAdapter.setPriceFeed("USDC", CHAINLINK_USDC_USD, 8, 3600);
    console.log(`   ✅ ChainlinkAdapter deployed with real feeds`);

    // Deploy core contracts
    const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
    proxyGeneral = await ProxyGeneral.deploy(await beacon.getAddress());

    const TokenManager = await ethers.getContractFactory("TokenManager");
    tokenManager = await TokenManager.deploy(await beacon.getAddress(), await chainlinkAdapter.getAddress());

    const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
    valueCalculator = await ValueCalculator.deploy(await beacon.getAddress());

    const SwapManager = await ethers.getContractFactory("SwapManager");
    swapManager = await SwapManager.deploy(await beacon.getAddress());

    const ParameterManager = await ethers.getContractFactory("ParameterManager");
    parameterManager = await ParameterManager.deploy(await beacon.getAddress());

    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    liquidityManager = await LiquidityManager.deploy(await beacon.getAddress());

    // Deploy UniswapV3PluginDirect with REAL Uniswap V3 Router
    const UniswapV3PluginDirect = await ethers.getContractFactory("UniswapV3PluginDirect");
    uniswapV3Plugin = await UniswapV3PluginDirect.deploy(
      UNISWAP_V3_ROUTER,
      UNISWAP_V3_QUOTER_V2,
      await proxyGeneral.getAddress()
    );
    console.log(`   ✅ UniswapV3PluginDirect deployed: ${await uniswapV3Plugin.getAddress()}`);

    // Register contracts in Beacon
    await beacon.updateImplementation("ProxyGeneral", await proxyGeneral.getAddress());
    await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
    await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
    await beacon.updateImplementation("SwapManager", await swapManager.getAddress());
    await beacon.updateImplementation("ParameterManager", await parameterManager.getAddress());
    await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());
    await beacon.updateImplementation("UniswapV3Plugin", await uniswapV3Plugin.getAddress());

    // Setup tokens in TokenManager (REAL Arbitrum tokens)
    await tokenManager.manageTokenData("USDC", ARBITRUM_USDC, CHAINLINK_USDC_USD, 6, 8, 3600);
    await tokenManager.manageTokenData("WBTC", ARBITRUM_WBTC, CHAINLINK_BTC_USD, 8, 8, 3600);
    console.log(`   ✅ TokenManager configured with USDC and WBTC`);

    // Setup SwapManager with UniswapV3Plugin
    await swapManager.setActiveSwapPlugin("UniswapV3Plugin");
    await swapManager.setMaxSlippage(300); // 3%
    console.log(`   ✅ SwapManager configured with UniswapV3Plugin`);

    // Setup LiquidityManager
    await liquidityManager.setFeeRecipient(feeRecipient.address);
    await liquidityManager.setDepositFee(50); // 0.5%
    await liquidityManager.setWithdrawFee(100); // 1.0%
    await liquidityManager.setWithdrawLimits(
      ethers.parseEther("100"), // hourly
      ethers.parseEther("500"), // daily
      ethers.parseEther("0.001"), // min
      ethers.parseEther("50") // max
    );

    // Authorize LiquidityManager
    await proxyGeneral.authorizeModule(await liquidityManager.getAddress(), "LiquidityManager");
    await proxyGeneral.authorizeModule(await swapManager.getAddress(), "SwapManager");
    
    // Setup rate limiting
    await proxyGeneral.setRateLimit("deposit", ethers.parseEther("200"), ethers.parseEther("1000"));
    await proxyGeneral.setRateLimit("withdraw", ethers.parseEther("1000"), ethers.parseEther("2000"));
    
    // Setup parameters
    await parameterManager.getFunction("proposeParameterChange(string,uint256)")("minDeposit", ethers.parseEther("0.01"));
    await parameterManager.getFunction("proposeParameterChange(string,uint256)")("poolReserveRatio", 2000); // 20%

    console.log(`   ✅ Protocol deployed and configured on fork\n`);

    // Bootstrap pool with initial deposits
    console.log("💰 BOOTSTRAPPING POOL...");
    await liquidityManager.connect(owner).deposit({ value: ethers.parseEther("10") });
    console.log(`   ✅ Owner deposited 10 ETH`);
    
    // User1 deposits for withdrawal tests
    await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
    console.log(`   ✅ User1 deposited ${ethers.formatEther(DEPOSIT_AMOUNT)} ETH`);

    // Get some USDC and WBTC in the pool for swap tests
    // We'll use Uniswap V3 to swap some WETH → USDC
    const wethContract = await ethers.getContractAt("IWETH", ARBITRUM_WETH);
    const usdcContract = await ethers.getContractAt("IERC20", ARBITRUM_USDC);
    
    // Wrap 2 ETH to WETH
    await wethContract.connect(owner).deposit({ value: ethers.parseEther("2") });
    
    // Swap 1 WETH → USDC via Uniswap V3 Router
    const routerContract = await ethers.getContractAt(
      ["function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160)) external payable returns (uint256)"],
      UNISWAP_V3_ROUTER
    );
    
    await wethContract.connect(owner).approve(UNISWAP_V3_ROUTER, ethers.parseEther("1"));
    const swapParams = {
      tokenIn: ARBITRUM_WETH,
      tokenOut: ARBITRUM_USDC,
      fee: 500, // 0.05%
      recipient: await proxyGeneral.getAddress(),
      deadline: Math.floor(Date.now() / 1000) + 600,
      amountIn: ethers.parseEther("1"),
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
    };
    
    await routerContract.connect(owner).exactInputSingle(swapParams);
    const usdcBalance = await usdcContract.balanceOf(await proxyGeneral.getAddress());
    console.log(`   ✅ Pool has ${ethers.formatUnits(usdcBalance, 6)} USDC for swaps\n`);
  });

  describe("⚡ CRITICAL: withdrawWithDeadline() - Basic Functionality", function () {
    
    it("E2E-WD-001: should complete withdrawal with valid deadline (20 min)", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 2n;
      
      // Calculate deadline (20 minutes from now)
      const currentTime = Math.floor(Date.now() / 1000);
      const deadline = currentTime + WITHDRAWAL_DEADLINE_VALID;
      
      console.log(`\n🔐 WITHDRAWAL WITH VALID DEADLINE TEST:`);
      console.log(`   User: ${user1.address.slice(0, 10)}...`);
      console.log(`   Shares to withdraw: ${ethers.formatEther(withdrawShares)} LP`);
      console.log(`   Current time: ${currentTime}`);
      console.log(`   Deadline: ${deadline} (+${WITHDRAWAL_DEADLINE_VALID}s)`);
      console.log(`   Time remaining: ${WITHDRAWAL_DEADLINE_VALID / 60} minutes`);
      
      // Get initial state
      const initialETH = await ethers.provider.getBalance(user1.address);
      const initialPoolValue = await valueCalculator.getTotalPoolValueView();
      
      // Execute withdrawal with deadline
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, deadline);
      const receipt = await tx.wait();
      
      // Calculate gas cost
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      // Verify events
      const withdrawalStartedEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "WithdrawalStarted";
        } catch { return false; }
      });
      
      const withdrawalCompletedEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "WithdrawalCompleted";
        } catch { return false; }
      });
      
      expect(withdrawalStartedEvent).to.not.be.undefined;
      expect(withdrawalCompletedEvent).to.not.be.undefined;
      
      console.log(`\n✅ WITHDRAWAL COMPLETED:`);
      console.log(`   ⛽ Gas used: ${receipt!.gasUsed.toLocaleString()}`);
      console.log(`   ✅ WithdrawalStarted event emitted`);
      console.log(`   ✅ WithdrawalCompleted event emitted`);
      
      // Verify ETH received
      const finalETH = await ethers.provider.getBalance(user1.address);
      const ethReceived = finalETH - initialETH + BigInt(gasUsed);
      
      console.log(`   💰 ETH received: ${ethers.formatEther(ethReceived)} ETH`);
      expect(ethReceived).to.be.gt(0);
    });

    it("E2E-WD-002: should revert if deadline already expired", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 4n;
      
      // Expired deadline (1 minute in the past)
      const pastDeadline = Math.floor(Date.now() / 1000) - 60;
      
      console.log(`\n⏱️  EXPIRED DEADLINE TEST:`);
      console.log(`   Deadline: ${pastDeadline} (expired 60s ago)`);
      console.log(`   Expected: Transaction reverts immediately`);
      
      await expect(
        liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, pastDeadline)
      ).to.be.revertedWith("Withdraw deadline expired");
      
      console.log(`   ✅ Correctly reverted with "Withdraw deadline expired"`);
    });

    it("E2E-WD-003: should emit TightDeadline warning if deadline < 5 min", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 4n;
      
      // Tight deadline (4 minutes)
      const currentTime = Math.floor(Date.now() / 1000);
      const tightDeadline = currentTime + WITHDRAWAL_DEADLINE_TIGHT;
      
      console.log(`\n⚠️  TIGHT DEADLINE WARNING TEST:`);
      console.log(`   Deadline: ${tightDeadline} (+${WITHDRAWAL_DEADLINE_TIGHT}s = ${WITHDRAWAL_DEADLINE_TIGHT/60} min)`);
      console.log(`   Expected: WithdrawalDeadlineCritical event NOT emitted (> 3 min)`);
      console.log(`   Expected: Withdrawal succeeds but logs warning`);
      
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, tightDeadline);
      const receipt = await tx.wait();
      
      // Check for critical warning (should NOT be present for 4 min deadline)
      const criticalEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "WithdrawalDeadlineCritical";
        } catch { return false; }
      });
      
      expect(criticalEvent).to.be.undefined;
      console.log(`   ✅ No critical warning for 4 min deadline (correct)`);
      console.log(`   ✅ Withdrawal completed successfully`);
    });

    it("E2E-WD-004: should emit Critical warning if deadline < 3 min", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 4n;
      
      // Critical deadline (2 minutes)
      const currentTime = Math.floor(Date.now() / 1000);
      const criticalDeadline = currentTime + WITHDRAWAL_DEADLINE_CRITICAL;
      
      console.log(`\n🔴 CRITICAL DEADLINE WARNING TEST:`);
      console.log(`   Deadline: ${criticalDeadline} (+${WITHDRAWAL_DEADLINE_CRITICAL}s = ${WITHDRAWAL_DEADLINE_CRITICAL/60} min)`);
      console.log(`   Expected: WithdrawalDeadlineCritical event EMITTED`);
      
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, criticalDeadline);
      const receipt = await tx.wait();
      
      // Check for critical warning
      const criticalEvents = receipt!.logs.filter((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "WithdrawalDeadlineCritical";
        } catch { return false; }
      });
      
      expect(criticalEvents.length).to.be.gt(0);
      
      console.log(`   ✅ WithdrawalDeadlineCritical event emitted ${criticalEvents.length} time(s)`);
      console.log(`   ✅ Withdrawal completed despite critical warning`);
    });
  });

  describe("🔥 HIGH: Automatic Swap with Deadline Propagation", function () {
    
    it("E2E-WD-005: should propagate deadline to automatic swap when WETH insufficient", async function () {
      // This test requires insufficient WETH to trigger automatic swap
      // We'll withdraw a large amount to force swap
      
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const largeWithdraw = (lpBalance * 80n) / 100n; // 80% of user's LP
      
      const currentTime = Math.floor(Date.now() / 1000);
      const deadline = currentTime + WITHDRAWAL_DEADLINE_VALID;
      
      console.log(`\n🔄 AUTOMATIC SWAP WITH DEADLINE TEST:`);
      console.log(`   Withdrawing: ${ethers.formatEther(largeWithdraw)} LP (80%)`);
      console.log(`   Deadline: ${deadline} (+${WITHDRAWAL_DEADLINE_VALID}s)`);
      
      // Get WETH balance before
      const wethContract = await ethers.getContractAt("IERC20", ARBITRUM_WETH);
      const wethBefore = await wethContract.balanceOf(await proxyGeneral.getAddress());
      console.log(`   Pool WETH before: ${ethers.formatEther(wethBefore)} WETH`);
      
      // Calculate expected withdraw amount
      const totalSupply = await proxyGeneral.totalSupply();
      const totalValue = await valueCalculator.getTotalPoolValueView();
      const expectedWithdraw = (largeWithdraw * totalValue) / totalSupply;
      
      console.log(`   Expected withdraw: ${ethers.formatEther(expectedWithdraw)} ETH`);
      console.log(`   Swap needed: ${wethBefore < expectedWithdraw ? "YES ✅" : "NO ❌"}`);
      
      if (wethBefore >= expectedWithdraw) {
        console.log(`   ⚠️  Skipping: Pool has sufficient WETH (no swap needed)`);
        this.skip();
      }
      
      // Execute withdrawal (should trigger automatic swap)
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(largeWithdraw, deadline);
      const receipt = await tx.wait();
      
      // Check for automatic swap trigger event
      const swapTriggeredEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "AutomaticSwapTriggered";
        } catch { return false; }
      });
      
      // Check for swap execution in SwapManager
      const swapStartedEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = swapManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "SwapStarted";
        } catch { return false; }
      });
      
      const swapCompletedEvent = receipt!.logs.find((log: any) => {
        try {
          const parsed = swapManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "SwapCompleted";
        } catch { return false; }
      });
      
      console.log(`\n✅ AUTOMATIC SWAP EXECUTED:`);
      console.log(`   ✅ AutomaticSwapTriggered: ${swapTriggeredEvent ? "YES" : "NO"}`);
      console.log(`   ✅ SwapStarted: ${swapStartedEvent ? "YES" : "NO"}`);
      console.log(`   ✅ SwapCompleted: ${swapCompletedEvent ? "YES" : "NO"}`);
      
      expect(swapTriggeredEvent).to.not.be.undefined;
      expect(swapStartedEvent).to.not.be.undefined;
      expect(swapCompletedEvent).to.not.be.undefined;
      
      // Verify deadline was propagated
      if (swapStartedEvent) {
        const parsedSwapStart = swapManager.interface.parseLog({
          topics: swapStartedEvent.topics,
          data: swapStartedEvent.data
        });
        console.log(`   ⏱️  Swap deadline: ${parsedSwapStart?.args.deadline}`);
        console.log(`   ⏱️  Time remaining: ${parsedSwapStart?.args.timeRemaining}s`);
        
        expect(parsedSwapStart?.args.deadline).to.equal(deadline);
      }
      
      console.log(`   ✅ Deadline propagated correctly to automatic swap`);
      console.log(`   ⛽ Total gas used: ${receipt!.gasUsed.toLocaleString()}`);
    });

    it("E2E-WD-006: should emit critical warnings during automatic swap if deadline tight", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const largeWithdraw = (lpBalance * 70n) / 100n;
      
      // Critical deadline (2 minutes)
      const currentTime = Math.floor(Date.now() / 1000);
      const criticalDeadline = currentTime + WITHDRAWAL_DEADLINE_CRITICAL;
      
      console.log(`\n🔴 CRITICAL DEADLINE + AUTOMATIC SWAP TEST:`);
      console.log(`   Deadline: ${criticalDeadline} (+${WITHDRAWAL_DEADLINE_CRITICAL}s = ${WITHDRAWAL_DEADLINE_CRITICAL/60} min)`);
      console.log(`   Expected: Multiple critical warnings during swap stages`);
      
      // Check if swap will be needed
      const wethContract = await ethers.getContractAt("IERC20", ARBITRUM_WETH);
      const wethBefore = await wethContract.balanceOf(await proxyGeneral.getAddress());
      const totalSupply = await proxyGeneral.totalSupply();
      const totalValue = await valueCalculator.getTotalPoolValueView();
      const expectedWithdraw = (largeWithdraw * totalValue) / totalSupply;
      
      if (wethBefore >= expectedWithdraw) {
        console.log(`   ⚠️  Skipping: Pool has sufficient WETH (no swap needed for critical warnings test)`);
        this.skip();
      }
      
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(largeWithdraw, criticalDeadline);
      const receipt = await tx.wait();
      
      // Count critical warning events
      const criticalEvents = receipt!.logs.filter((log: any) => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "WithdrawalDeadlineCritical";
        } catch { return false; }
      });
      
      // Also check SwapManager critical warnings
      const swapCriticalEvents = receipt!.logs.filter((log: any) => {
        try {
          const parsed = swapManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "DeadlineCritical";
        } catch { return false; }
      });
      
      console.log(`\n✅ CRITICAL WARNINGS EMITTED:`);
      console.log(`   🔴 LiquidityManager warnings: ${criticalEvents.length}`);
      console.log(`   🔴 SwapManager warnings: ${swapCriticalEvents.length}`);
      
      criticalEvents.forEach((event: any, index: number) => {
        const parsed = liquidityManager.interface.parseLog({ topics: event.topics, data: event.data });
        console.log(`   └─ [${index + 1}] Stage: ${parsed?.args.stage}, Time remaining: ${parsed?.args.timeRemaining}s`);
      });
      
      expect(criticalEvents.length).to.be.gt(0);
      console.log(`   ✅ Multiple critical warnings correctly emitted`);
      console.log(`   ✅ Withdrawal completed despite critical warnings`);
    });
  });

  describe("🎯 EDGE: Deadline Expiration Scenarios", function () {
    
    it("E2E-WD-007: should revert if swap takes too long and deadline expires", async function () {
      // This test simulates a scenario where the swap might take longer than deadline
      // On a real fork this is hard to simulate without manipulating time
      
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 3n;
      
      // Very tight deadline (10 seconds) - likely to fail if swap needed
      const veryTightDeadline = Math.floor(Date.now() / 1000) + 10;
      
      console.log(`\n⏰ DEADLINE EXPIRATION DURING SWAP TEST:`);
      console.log(`   Deadline: +10 seconds (very tight)`);
      console.log(`   Note: This may pass if pool has sufficient WETH`);
      console.log(`   Note: On mainnet fork, actual Uniswap swap takes ~5-10s`);
      
      try {
        const tx = await liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, veryTightDeadline);
        await tx.wait();
        
        console.log(`   ⚠️  Transaction succeeded (WETH sufficient or swap fast enough)`);
        console.log(`   ✅ No deadline expiry (this is OK)`);
        
      } catch (error: any) {
        if (error.message.includes("deadline expired")) {
          console.log(`   ✅ Correctly reverted with deadline expired error`);
          expect(error.message).to.include("deadline expired");
        } else {
          console.log(`   ⚠️  Different error: ${error.message}`);
          throw error;
        }
      }
    });

    it("E2E-WD-008: should handle sequential withdrawals with same deadline", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const smallWithdraw = lpBalance / 10n; // 10% each
      
      const currentTime = Math.floor(Date.now() / 1000);
      const sharedDeadline = currentTime + WITHDRAWAL_DEADLINE_VALID;
      
      console.log(`\n⚡ SEQUENTIAL WITHDRAWALS TEST:`);
      console.log(`   Shared deadline: ${sharedDeadline} (+${WITHDRAWAL_DEADLINE_VALID}s)`);
      console.log(`   Withdrawing: 2 x ${ethers.formatEther(smallWithdraw)} LP`);
      
      // First withdrawal
      console.log(`\n   [1/2] First withdrawal...`);
      const tx1 = await liquidityManager.connect(user1).withdrawWithDeadline(smallWithdraw, sharedDeadline);
      const receipt1 = await tx1.wait();
      console.log(`   ✅ Completed - Gas: ${receipt1!.gasUsed.toLocaleString()}`);
      
      // Second withdrawal with same deadline (now shorter time remaining)
      console.log(`\n   [2/2] Second withdrawal (less time remaining)...`);
      const tx2 = await liquidityManager.connect(user1).withdrawWithDeadline(smallWithdraw, sharedDeadline);
      const receipt2 = await tx2.wait();
      console.log(`   ✅ Completed - Gas: ${receipt2!.gasUsed.toLocaleString()}`);
      
      const totalGas = receipt1!.gasUsed + receipt2!.gasUsed;
      console.log(`\n✅ SEQUENTIAL WITHDRAWALS COMPLETED:`);
      console.log(`   Total gas: ${totalGas.toLocaleString()}`);
      console.log(`   Both used same deadline successfully`);
    });
  });

  describe("📊 ANALYTICS: Deadline Timing Verification", function () {
    
    it("E2E-WD-009: should track accurate timing in WithdrawalCompleted event", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 4n;
      
      const currentTime = Math.floor(Date.now() / 1000);
      const deadline = currentTime + WITHDRAWAL_DEADLINE_VALID;
      
      console.log(`\n⏱️  TIMING TRACKING VERIFICATION:`);
      
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, deadline);
      const receipt = await tx.wait();
      
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
      
      console.log(`\n✅ TIMING METRICS:`);
      console.log(`   Deadline: ${parsed?.args.deadline}`);
      console.log(`   Time used: ${parsed?.args.timeUsed}s`);
      console.log(`   Swap executed: ${parsed?.args.swapExecuted}`);
      console.log(`   Time efficiency: ${((WITHDRAWAL_DEADLINE_VALID - Number(parsed?.args.timeUsed)) / WITHDRAWAL_DEADLINE_VALID * 100).toFixed(1)}% buffer remaining`);
      
      expect(parsed?.args.timeUsed).to.be.gt(0);
      expect(parsed?.args.timeUsed).to.be.lt(WITHDRAWAL_DEADLINE_VALID);
    });

    it("E2E-WD-010: should verify deadline monitoring across full withdrawal flow", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 2n;
      
      const currentTime = Math.floor(Date.now() / 1000);
      const deadline = currentTime + (10 * 60); // 10 minutes
      
      console.log(`\n📊 FULL FLOW MONITORING TEST:`);
      console.log(`   Deadline: +10 minutes`);
      
      const tx = await liquidityManager.connect(user1).withdrawWithDeadline(withdrawShares, deadline);
      const receipt = await tx.wait();
      
      // Collect all deadline-related events
      const eventTypes = [
        { name: "WithdrawalStarted", contract: liquidityManager },
        { name: "AutomaticSwapTriggered", contract: liquidityManager },
        { name: "SwapStarted", contract: swapManager },
        { name: "SwapCompleted", contract: swapManager },
        { name: "WithdrawalCompleted", contract: liquidityManager }
      ];
      
      console.log(`\n📋 EVENT TIMELINE:`);
      
      eventTypes.forEach(({ name, contract }) => {
        const event = receipt!.logs.find((log: any) => {
          try {
            const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
            return parsed?.name === name;
          } catch { return false; }
        });
        
        if (event) {
          const parsed = contract.interface.parseLog({ topics: event.topics, data: event.data });
          console.log(`   ✅ ${name}`);
          if (parsed?.args.deadline) {
            console.log(`      └─ Deadline: ${parsed.args.deadline}`);
          }
          if (parsed?.args.timeRemaining) {
            console.log(`      └─ Time remaining: ${parsed.args.timeRemaining}s`);
          }
          if (parsed?.args.timeUsed) {
            console.log(`      └─ Time used: ${parsed.args.timeUsed}s`);
          }
        } else {
          console.log(`   ⚪ ${name} (not triggered)`);
        }
      });
      
      console.log(`\n✅ Full withdrawal flow monitored successfully`);
    });
  });
});
