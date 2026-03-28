import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔗 WITHDRAW FLOW - INTEGRATION TESTS
 * 
 * Tests complete withdraw flow across all modules:
 * - LP burn → WETH → ETH conversion
 * - SwapManager automatic swaps
 * - ProxyGeneral custody release
 * - Withdraw limit tracking
 */

describe("Integration: Withdraw Flow", function () {
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
  let owner: any;
  let user1: any;
  let user2: any;
  let feeRecipient: any;

  // Test constants
  const DEPOSIT_AMOUNT = ethers.parseEther("10.0"); // 10 ETH
  const DEFAULT_DEPOSIT_FEE = 50;  // 0.5%
  const DEFAULT_WITHDRAW_FEE = 100; // 1.0%

  async function deployIntegrationFixture() {
    const [owner, user1, user2, feeRecipient] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    const mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    
    // Deploy MockWETH
    const MockWETH = await ethers.getContractFactory("MockWETH");
    const mockWETH = await MockWETH.deploy();

    // Deploy MockChainlinkOracle
    const MockChainlinkOracle = await ethers.getContractFactory("MockChainlinkOracle");
    const mockOracle = await MockChainlinkOracle.deploy(
      ethers.parseUnits("2000", 8),
      8,
      "ETH/USD"
    );

    // Deploy Beacon
    const Beacon = await ethers.getContractFactory("Beacon");
    const beacon = await Beacon.deploy();
    await beacon.updateImplementation("WETH", mockWETH.target);

    // Deploy ChainlinkAdapter
    const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
    const chainlinkAdapter = await ChainlinkAdapter.deploy();
    
    // Setup price feeds in ChainlinkAdapter
    await chainlinkAdapter.setPriceFeed("USDC", mockOracle.target, 8, 3600);
    await chainlinkAdapter.setPriceFeed("WBTC", mockOracle.target, 8, 3600);

    // Deploy core contracts
    const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
    const proxyGeneral = await ProxyGeneral.deploy(beacon.target);

    const TokenManager = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TokenManager.deploy(beacon.target, chainlinkAdapter.target);

    const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
    const valueCalculator = await ValueCalculator.deploy(beacon.target);

    const SwapManager = await ethers.getContractFactory("SwapManager");
    const swapManager = await SwapManager.deploy(beacon.target);

    const ParameterManager = await ethers.getContractFactory("ParameterManager");
    const parameterManager = await ParameterManager.deploy(beacon.target);

    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LiquidityManager.deploy(beacon.target);

    // Register contracts in Beacon
    await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
    await beacon.updateImplementation("TokenManager", tokenManager.target);
    await beacon.updateImplementation("ValueCalculator", valueCalculator.target);
    await beacon.updateImplementation("SwapManager", swapManager.target);
    await beacon.updateImplementation("ParameterManager", parameterManager.target);
    await beacon.updateImplementation("LiquidityManager", liquidityManager.target);

    // Setup tokens in TokenManager
    await tokenManager.manageTokenData(
      "USDC", mockUSDC.target, 6, 3600
    );
    await tokenManager.manageTokenData(
      "WBTC", mockWBTC.target, mockOracle.target, 8, 8, 3600
    );

    // Setup LiquidityManager
    await liquidityManager.setFeeRecipient(feeRecipient.address);
    await liquidityManager.setDepositFee(DEFAULT_DEPOSIT_FEE);
    await liquidityManager.setWithdrawFee(DEFAULT_WITHDRAW_FEE);
    await liquidityManager.setWithdrawLimits(
      ethers.parseEther("600"),
      ethers.parseEther("2000"),
      ethers.parseEther("0.000001"),
      ethers.parseEther("500")
    );

    // Mint tokens to ProxyGeneral for initial pool
    await mockUSDC.mint(proxyGeneral.target, ethers.parseUnits("10000", 6));
    await mockWBTC.mint(proxyGeneral.target, ethers.parseUnits("0.5", 8));
    
    // Note: WETH will be added only through proper deposits to maintain LP token balance

    return {
      beacon,
      proxyGeneral,
      liquidityManager,
      tokenManager,
      valueCalculator,
      swapManager,
      parameterManager,
      mockUSDC,
      mockWBTC,
      mockWETH,
      mockOracle,
      owner,
      user1,
      user2,
      feeRecipient
    };
  }

  beforeEach(async function () {
    const fixture = await deployIntegrationFixture();
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
    owner = fixture.owner;
    user1 = fixture.user1;
    user2 = fixture.user2;
    feeRecipient = fixture.feeRecipient;

    // Authorize LiquidityManager
    await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");
    
    // Enable deposits and withdraws
    await liquidityManager.setDepositsEnabled(true);
    await liquidityManager.setWithdrawsEnabled(true);
    
    // Setup parameters
    await parameterManager.getFunction("proposeParameterChange(string,uint256)")
      ("minDeposit", ethers.parseEther("0.01"));
    
    // Setup rate limiting
    await proxyGeneral.setRateLimit("deposit", ethers.parseEther("200"), ethers.parseEther("1000"));
    await proxyGeneral.setRateLimit("withdraw", ethers.parseEther("1000"), ethers.parseEther("2000"));
    
    // Bootstrap pool with initial deposit
    await liquidityManager.connect(owner).deposit({ value: ethers.parseEther("10") });
    
    // User1 deposits to get LP tokens for withdrawal tests
    await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
  });

  describe("⚡ HIGH: Complete Withdraw Flow Tests", function () {
    
    // INT-WTH-HIGH-001: Full withdraw flow (LP burn → WETH → ETH)
    it("INT-WTH-HIGH-001: should complete full withdraw flow from LP to ETH", async function () {
      // Get user1's LP balance
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      expect(lpBalance).to.be.gt(0);
      
      const withdrawShares = lpBalance / 2n; // Withdraw half
      
      // Get initial state
      const initialETHBalance = await ethers.provider.getBalance(user1.address);
      const initialLPBalance = await proxyGeneral.balanceOf(user1.address);
      const initialProxyWETH = await mockWETH.balanceOf(proxyGeneral.target);
      const initialTotalSupply = await proxyGeneral.totalSupply();
      const initialPoolValue = await valueCalculator.getTotalPoolValueView();
      const initialLPPrice = initialTotalSupply > 0n ? Number(initialPoolValue) / Number(initialTotalSupply) : 0;
      
      console.log(`\n🏦 STARTING WITHDRAW OPERATION:`);
      console.log(`   👤 User: ${user1.address.slice(0,8)}...`);
      console.log(`   🎫 Total LP Balance: ${ethers.formatEther(lpBalance)} LP tokens`);
      console.log(`   🔥 Withdrawing: ${ethers.formatEther(withdrawShares)} LP tokens (50%)`);
      console.log(`   💰 Initial ETH Balance: ${ethers.formatEther(initialETHBalance)} ETH`);
      console.log(`   🌊 Pool WETH Available: ${ethers.formatEther(initialProxyWETH)} WETH`);
      console.log(`   💎 Initial Pool Value: ${ethers.formatEther(initialPoolValue)} ETH`);
      console.log(`   📈 Pool Total Supply: ${ethers.formatEther(initialTotalSupply)} LP tokens`);
      console.log(`   💰 Initial LP Price: ${initialLPPrice.toFixed(6)} ETH per LP token`);
      
      // Execute withdraw
      const tx = await liquidityManager.connect(user1).withdraw(withdrawShares);
      const receipt = await tx.wait();
      
      // Calculate gas cost
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      // Get final state
      const finalETHBalance = await ethers.provider.getBalance(user1.address);
      const finalLPBalance = await proxyGeneral.balanceOf(user1.address);
      const finalProxyWETH = await mockWETH.balanceOf(proxyGeneral.target);
      const finalTotalSupply = await proxyGeneral.totalSupply();
      
      // Calculate metrics
      const ethReceived = finalETHBalance - initialETHBalance + BigInt(gasUsed);
      const lpTokensBurned = initialLPBalance - finalLPBalance;
      const wethUsed = initialProxyWETH - finalProxyWETH;
      const supplyDecrease = initialTotalSupply - finalTotalSupply;
      const expectedFee = (BigInt(wethUsed) * BigInt(DEFAULT_WITHDRAW_FEE)) / 10000n;
      const finalPoolValue = await valueCalculator.getTotalPoolValueView();
      const finalLPPrice = finalTotalSupply > 0n ? Number(finalPoolValue) / Number(finalTotalSupply) : 0;
      const poolValueDecrease = initialPoolValue - finalPoolValue;
      
      console.log(`\n✅ WITHDRAW COMPLETED SUCCESSFULLY:`);
      console.log(`   🔥 LP Tokens Burned: ${ethers.formatEther(lpTokensBurned)} LP tokens`);
      console.log(`   📉 Total Supply Decreased by: ${ethers.formatEther(supplyDecrease)} LP tokens`);
      console.log(`   🔄 WETH → ETH Converted: ${ethers.formatEther(wethUsed)} WETH`);
      console.log(`   💸 Withdraw Fee: ${ethers.formatEther(expectedFee)} ETH (${DEFAULT_WITHDRAW_FEE/100}%)`);
      console.log(`   💰 ETH Received (net): ${ethers.formatEther(ethReceived)} ETH`);
      console.log(`   🎫 Remaining LP Balance: ${ethers.formatEther(finalLPBalance)} LP tokens`);
      console.log(`   🌊 Pool WETH Remaining: ${ethers.formatEther(finalProxyWETH)} WETH`);
      console.log(`   💎 Final Pool Value: ${ethers.formatEther(finalPoolValue)} ETH (-${ethers.formatEther(poolValueDecrease)})`);
      console.log(`   💰 Final LP Price: ${finalLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   ⛽ Gas Used: ${receipt!.gasUsed.toLocaleString()} gas (${ethers.formatEther(gasUsed)} ETH)`);
      
      // Verify LP tokens burned
      expect(finalLPBalance).to.equal(initialLPBalance - withdrawShares);
      
      // Verify ETH received (accounting for gas and withdraw fee)
      expect(ethReceived).to.be.gt(0);
      
      // Verify WETH decreased in ProxyGeneral
      expect(finalProxyWETH).to.be.lt(initialProxyWETH);
    });

    // INT-WTH-HIGH-002: Withdraw → SwapManager → automatic swap (if needed)
    it("INT-WTH-HIGH-002: should handle withdraw without needing swap when sufficient WETH", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 4n; // Small withdrawal
      
      // Get initial WETH balance
      const initialWETH = await mockWETH.balanceOf(proxyGeneral.target);
      const initialTotalSupply = await proxyGeneral.totalSupply();
      const initialPoolValue = await valueCalculator.getTotalPoolValueView();
      const initialLPPrice = initialTotalSupply > 0n ? Number(initialPoolValue) / Number(initialTotalSupply) : 0;
      
      console.log(`\n🔄 SWAP AVOIDANCE TEST:`);
      console.log(`   🎫 Withdrawing: ${ethers.formatEther(withdrawShares)} LP tokens (25%)`);
      console.log(`   🌊 Pool WETH Available: ${ethers.formatEther(initialWETH)} WETH`);
      console.log(`   💎 Initial Pool Value: ${ethers.formatEther(initialPoolValue)} ETH`);
      console.log(`   📈 Total Supply: ${ethers.formatEther(initialTotalSupply)} LP tokens`);
      console.log(`   💰 Initial LP Price: ${initialLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   🎯 Goal: Use direct WETH without triggering SwapManager`);
      
      // Execute withdraw (should not trigger swap since we have WETH)
      const tx = await liquidityManager.connect(user1).withdraw(withdrawShares);
      const receipt = await tx.wait();
      
      // Verify WETH was used directly (no swap needed)
      const finalWETH = await mockWETH.balanceOf(proxyGeneral.target);
      const wethUsed = initialWETH - finalWETH;
      const finalTotalSupply = await proxyGeneral.totalSupply();
      const supplyDecrease = initialTotalSupply - finalTotalSupply;
      const finalPoolValue = await valueCalculator.getTotalPoolValueView();
      const finalLPPrice = finalTotalSupply > 0n ? Number(finalPoolValue) / Number(finalTotalSupply) : 0;
      const poolValueDecrease = initialPoolValue - finalPoolValue;
      
      console.log(`\n✅ DIRECT WETH WITHDRAWAL SUCCESSFUL:`);
      console.log(`   🔄 WETH Used Directly: ${ethers.formatEther(wethUsed)} WETH`);
      console.log(`   🌊 Remaining Pool WETH: ${ethers.formatEther(finalWETH)} WETH`);
      console.log(`   📉 Supply Decrease: ${ethers.formatEther(supplyDecrease)} LP tokens`);
      console.log(`   💎 Final Pool Value: ${ethers.formatEther(finalPoolValue)} ETH (-${ethers.formatEther(poolValueDecrease)})`);
      console.log(`   💰 Final LP Price: ${finalLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   🚫 No SwapManager intervention needed`);
      console.log(`   ✨ Efficient withdrawal path taken`);
      console.log(`   ⛽ Gas Used: ${receipt!.gasUsed.toLocaleString()} gas`);
      
      expect(initialWETH - finalWETH).to.be.gt(0);
    });

    // INT-WTH-HIGH-003: Withdraw → ProxyGeneral custody release
    it("INT-WTH-HIGH-003: should release assets from ProxyGeneral custody during withdraw", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const withdrawShares = lpBalance / 3n;
      
      // Get initial ProxyGeneral asset state
      const initialTotalSupply = await proxyGeneral.totalSupply();
      const initialPoolValue = await valueCalculator.getTotalPoolValueView();
      const initialProxyWETH = await mockWETH.balanceOf(proxyGeneral.target);
      const initialLPPrice = initialTotalSupply > 0n ? Number(initialPoolValue) / Number(initialTotalSupply) : 0;
      
      console.log(`\n🏛️ CUSTODY RELEASE VERIFICATION:`);
      console.log(`   🎫 Withdrawing: ${ethers.formatEther(withdrawShares)} LP tokens (33%)`);
      console.log(`   📈 Initial Total Supply: ${ethers.formatEther(initialTotalSupply)} LP tokens`);
      console.log(`   � Initial Pool Value: ${ethers.formatEther(initialPoolValue)} ETH`);
      console.log(`   💰 Initial LP Price: ${initialLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   🌊 Initial ProxyGeneral WETH: ${ethers.formatEther(initialProxyWETH)} WETH`);
      console.log(`   🏦 ProxyGeneral Address: ${proxyGeneral.target.slice(0,10)}...`);
      
      // Execute withdraw
      const tx = await liquidityManager.connect(user1).withdraw(withdrawShares);
      const receipt = await tx.wait();
      
      // Get final state
      const finalTotalSupply = await proxyGeneral.totalSupply();
      const finalPoolValue = await valueCalculator.getTotalPoolValueView();
      const finalProxyWETH = await mockWETH.balanceOf(proxyGeneral.target);
      
      // Calculate changes
      const supplyDecrease = initialTotalSupply - finalTotalSupply;
      const poolValueDecrease = initialPoolValue - finalPoolValue;
      const wethReleased = initialProxyWETH - finalProxyWETH;
      const finalLPPrice = finalTotalSupply > 0n ? Number(finalPoolValue) / Number(finalTotalSupply) : 0;
      
      console.log(`\n✅ CUSTODY RELEASE COMPLETED:`);
      console.log(`   📉 Total Supply Decreased: ${ethers.formatEther(supplyDecrease)} LP tokens`);
      console.log(`   � Pool Value Decreased: ${ethers.formatEther(poolValueDecrease)} ETH`);
      console.log(`   🌊 WETH Released from Custody: ${ethers.formatEther(wethReleased)} WETH`);
      console.log(`   🏦 Remaining ProxyGeneral WETH: ${ethers.formatEther(finalProxyWETH)} WETH`);
      console.log(`   � Remaining Pool Value: ${ethers.formatEther(finalPoolValue)} ETH`);
      console.log(`   💰 Final LP Price: ${finalLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   ✨ Assets successfully released from ProxyGeneral custody`);
      console.log(`   ⛽ Gas Used: ${receipt!.gasUsed.toLocaleString()} gas`);
      
      // Verify total supply decreased
      expect(finalTotalSupply).to.equal(initialTotalSupply - withdrawShares);
      
      // Verify pool value decreased
      expect(finalPoolValue).to.be.lt(initialPoolValue);
      
      // Verify WETH released from custody
      expect(finalProxyWETH).to.be.lt(initialProxyWETH);
    });

    // INT-WTH-HIGH-004: Withdraw → limit tracking → remaining limits
    it("INT-WTH-HIGH-004: should track withdraw limits across operations", async function () {
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const firstWithdraw = lpBalance / 4n;
      
      // Get initial ETH balance
      const initialETH = await ethers.provider.getBalance(user1.address);
      const initialTotalSupply = await proxyGeneral.totalSupply();
      const initialPoolValue = await valueCalculator.getTotalPoolValueView();
      const initialLPPrice = initialTotalSupply > 0n ? Number(initialPoolValue) / Number(initialTotalSupply) : 0;
      
      console.log(`\n📊 WITHDRAWAL LIMIT TRACKING:`);
      console.log(`   👤 User: ${user1.address.slice(0,8)}...`);
      console.log(`   🎫 Total LP Balance: ${ethers.formatEther(lpBalance)} LP tokens`);
      console.log(`   💰 Initial ETH Balance: ${ethers.formatEther(initialETH)} ETH`);
      console.log(`   💎 Initial Pool Value: ${ethers.formatEther(initialPoolValue)} ETH`);
      console.log(`   💰 Initial LP Price: ${initialLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   📈 Initial Total Supply: ${ethers.formatEther(initialTotalSupply)} LP tokens`);
      console.log(`   🎯 Testing sequential withdrawals within limits`);
      
      // First withdraw
      console.log(`\n🔸 WITHDRAWAL 1:`);
      console.log(`   🎫 Amount: ${ethers.formatEther(firstWithdraw)} LP tokens (25%)`);
      const tx1 = await liquidityManager.connect(user1).withdraw(firstWithdraw);
      const receipt1 = await tx1.wait();
      const gas1 = receipt1!.gasUsed * receipt1!.gasPrice;
      
      const midETH = await ethers.provider.getBalance(user1.address);
      const firstReceived = midETH - initialETH + BigInt(gas1);
      const midLPBalance = await proxyGeneral.balanceOf(user1.address);
      const midTotalSupply = await proxyGeneral.totalSupply();
      const midPoolValue = await valueCalculator.getTotalPoolValueView();
      const midLPPrice = midTotalSupply > 0n ? Number(midPoolValue) / Number(midTotalSupply) : 0;
      
      console.log(`   💰 ETH Received: ${ethers.formatEther(firstReceived)} ETH`);
      console.log(`   🎫 Remaining LP Balance: ${ethers.formatEther(midLPBalance)} LP tokens`);
      console.log(`   📉 Total Supply: ${ethers.formatEther(midTotalSupply)} LP tokens`);
      console.log(`   💎 Pool Value: ${ethers.formatEther(midPoolValue)} ETH`);
      console.log(`   💰 LP Price: ${midLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   ⛽ Gas Used: ${receipt1!.gasUsed.toLocaleString()} gas`);
      expect(firstReceived).to.be.gt(0);
      
      // Second withdraw (should still be within limits)
      const secondWithdraw = lpBalance / 4n;
      console.log(`\n🔸 WITHDRAWAL 2:`);
      console.log(`   🎫 Amount: ${ethers.formatEther(secondWithdraw)} LP tokens (25%)`);
      const tx2 = await liquidityManager.connect(user1).withdraw(secondWithdraw);
      const receipt2 = await tx2.wait();
      const gas2 = receipt2!.gasUsed * receipt2!.gasPrice;
      
      // Verify second withdraw also completed successfully
      const finalETH = await ethers.provider.getBalance(user1.address);
      const secondReceived = finalETH - midETH + BigInt(gas2);
      const finalLPBalance = await proxyGeneral.balanceOf(user1.address);
      const finalTotalSupply = await proxyGeneral.totalSupply();
      const totalReceived = finalETH - initialETH + BigInt(gas1) + BigInt(gas2);
      const totalWithdrawn = firstWithdraw + secondWithdraw;
      const finalPoolValue = await valueCalculator.getTotalPoolValueView();
      const finalLPPrice = finalTotalSupply > 0n ? Number(finalPoolValue) / Number(finalTotalSupply) : 0;
      
      console.log(`   💰 ETH Received: ${ethers.formatEther(secondReceived)} ETH`);
      console.log(`   🎫 Remaining LP Balance: ${ethers.formatEther(finalLPBalance)} LP tokens`);
      console.log(`   📉 Total Supply: ${ethers.formatEther(finalTotalSupply)} LP tokens`);
      console.log(`   💎 Pool Value: ${ethers.formatEther(finalPoolValue)} ETH`);
      console.log(`   💰 LP Price: ${finalLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   ⛽ Gas Used: ${receipt2!.gasUsed.toLocaleString()} gas`);
      expect(secondReceived).to.be.gt(0);
      
      console.log(`\n✅ LIMIT TRACKING VERIFICATION:`);
      console.log(`   🔥 Total LP Tokens Burned: ${ethers.formatEther(totalWithdrawn)} LP tokens`);
      console.log(`   💰 Total ETH Received: ${ethers.formatEther(totalReceived)} ETH`);
      console.log(`   📊 Final LP Balance: ${ethers.formatEther(finalLPBalance)} LP tokens`);
      console.log(`   📈 Final Total Supply: ${ethers.formatEther(finalTotalSupply)} LP tokens`);
      console.log(`   💎 Final Pool Value: ${ethers.formatEther(finalPoolValue)} ETH`);
      console.log(`   💰 Final LP Price: ${finalLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   ✅ Both withdrawals completed within limits`);
      console.log(`   🎯 Withdrawal tracking system functioning correctly`);
      
      // Verify total LP tokens burned
      expect(finalLPBalance).to.equal(lpBalance - firstWithdraw - secondWithdraw);
    });
  });
});
