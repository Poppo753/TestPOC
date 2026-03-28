import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔗 DEPOSIT FLOW - INTEGRATION TESTS
 * 
 * Tests complete deposit flow across all modules:
 * - ETH → WETH conversion
 * - LP token minting
 * - ProxyGeneral custody
 * - ValueCalculator updates
 * - Fee distribution
 */

describe("Integration: Deposit Flow", function () {
  let beacon: any;
  let proxyGeneral: any;
  let liquidityManager: any;
  let tokenManager: any;
  let valueCalculator: any;
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
  const LARGE_DEPOSIT = ethers.parseEther("100.0"); // 100 ETH
  const SMALL_DEPOSIT = ethers.parseEther("0.1");   // 0.1 ETH
  const DEFAULT_DEPOSIT_FEE = 100; // 1% (100 basis points)

  async function deployIntegrationFixture() {
    const [owner, user1, user2, feeRecipient] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    const mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    
    // Deploy MockWETH with deposit/withdraw functionality
    const MockWETH = await ethers.getContractFactory("MockWETH");
    const mockWETH = await MockWETH.deploy();

    // Deploy MockChainlinkOracle
    const MockChainlinkOracle = await ethers.getContractFactory("MockChainlinkOracle");
    const mockOracle = await MockChainlinkOracle.deploy(
      ethers.parseUnits("2000", 8), // $2000
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

    // Deploy all core contracts
    const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
    const proxyGeneral = await ProxyGeneral.deploy(beacon.target);

    const TokenManager = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TokenManager.deploy(beacon.target, chainlinkAdapter.target);

    const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
    const valueCalculator = await ValueCalculator.deploy(beacon.target);

    const ParameterManager = await ethers.getContractFactory("ParameterManager");
    const parameterManager = await ParameterManager.deploy(beacon.target);

    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LiquidityManager.deploy(beacon.target);

    // Register contracts in Beacon
    await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
    await beacon.updateImplementation("TokenManager", tokenManager.target);
    await beacon.updateImplementation("ValueCalculator", valueCalculator.target);
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
    await liquidityManager.setWithdrawFee(100);
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
    parameterManager = fixture.parameterManager;
    mockUSDC = fixture.mockUSDC;
    mockWBTC = fixture.mockWBTC;
    mockWETH = fixture.mockWETH;
    mockOracle = fixture.mockOracle;
    owner = fixture.owner;
    user1 = fixture.user1;
    user2 = fixture.user2;
    feeRecipient = fixture.feeRecipient;

    // Authorize LiquidityManager as module in ProxyGeneral
    await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");
    
    // Enable deposits and withdraws
    await liquidityManager.setDepositsEnabled(true);
    await liquidityManager.setWithdrawsEnabled(true);
    
    // Setup parameters in ParameterManager
    await parameterManager.getFunction("proposeParameterChange(string,uint256)")
      ("minDeposit", ethers.parseEther("0.01"));
    
    // Setup rate limiting (now implemented in ProxyGeneral)
    await proxyGeneral.setRateLimit(
      "deposit",
      ethers.parseEther("200"),
      ethers.parseEther("1000")
    );
    await proxyGeneral.setRateLimit(
      "withdraw",
      ethers.parseEther("1000"),
      ethers.parseEther("2000")
    );
    
    // BOOTSTRAP POOL: Initial deposit from owner to establish LP shares baseline
    await liquidityManager.connect(owner).deposit({ value: ethers.parseEther("10") });
  });

  describe("⚡ HIGH: Complete Deposit Flow Tests", function () {
    
    // INT-DEP-HIGH-001: Full deposit flow (ETH → WETH → LP)
    it("INT-DEP-HIGH-001: should complete full deposit flow from ETH to LP tokens", async function () {
      const depositAmount = DEPOSIT_AMOUNT;
      
      // Get initial state
      const initialLPBalance = await proxyGeneral.balanceOf(user1.address);
      const initialWETHBalance = await mockWETH.balanceOf(proxyGeneral.target);
      const initialTotalSupply = await proxyGeneral.totalSupply();
      const initialPoolValue = await valueCalculator.getTotalPoolValueView();
      const initialLPPrice = initialTotalSupply > 0n ? Number(initialPoolValue) / Number(initialTotalSupply) : 0;
      
      console.log(`\n🏦 STARTING DEPOSIT OPERATION:`);
      console.log(`   💰 Depositing: ${ethers.formatEther(depositAmount)} ETH`);
      console.log(`   👤 User: ${user1.address.slice(0,8)}...`);
      console.log(`   📊 Initial LP Balance: ${ethers.formatEther(initialLPBalance)} LP tokens`);
      console.log(`   🌊 Initial Pool WETH: ${ethers.formatEther(initialWETHBalance)} WETH`);
      console.log(`   💎 Initial Pool Value: ${ethers.formatEther(initialPoolValue)} ETH`);
      console.log(`   📈 Initial Total Supply: ${ethers.formatEther(initialTotalSupply)} LP tokens`);
      console.log(`   💰 Initial LP Price: ${initialLPPrice.toFixed(6)} ETH per LP token`);
      
      // Execute deposit
      const tx = await liquidityManager.connect(user1).deposit({ value: depositAmount });
      const receipt = await tx.wait();
      
      // Calculate metrics
      const finalLPBalance = await proxyGeneral.balanceOf(user1.address);
      const finalWETHBalance = await mockWETH.balanceOf(proxyGeneral.target);
      const finalTotalSupply = await proxyGeneral.totalSupply();
      const finalPoolValue = await valueCalculator.getTotalPoolValueView();
      const finalLPPrice = finalTotalSupply > 0n ? Number(finalPoolValue) / Number(finalTotalSupply) : 0;
      const expectedFee = (depositAmount * BigInt(DEFAULT_DEPOSIT_FEE)) / 10000n;
      const netDeposit = depositAmount - expectedFee;
      const lpTokensMinted = finalLPBalance - initialLPBalance;
      const wethAdded = finalWETHBalance - initialWETHBalance;
      const supplyIncrease = finalTotalSupply - initialTotalSupply;
      const poolValueIncrease = finalPoolValue - initialPoolValue;
      
      console.log(`\n✅ DEPOSIT COMPLETED SUCCESSFULLY:`);
      console.log(`   💸 Fee Charged: ${ethers.formatEther(expectedFee)} ETH (${DEFAULT_DEPOSIT_FEE/100}%)`);
      console.log(`   💵 Net Deposited: ${ethers.formatEther(netDeposit)} ETH`);
      console.log(`   🔄 ETH → WETH Converted: ${ethers.formatEther(wethAdded)} WETH`);
      console.log(`   🎫 LP Tokens Minted: ${ethers.formatEther(lpTokensMinted)} LP tokens`);
      console.log(`   📊 Final LP Balance: ${ethers.formatEther(finalLPBalance)} LP tokens`);
      console.log(`   🌊 Final Pool WETH: ${ethers.formatEther(finalWETHBalance)} WETH`);
      console.log(`   � Final Pool Value: ${ethers.formatEther(finalPoolValue)} ETH (+${ethers.formatEther(poolValueIncrease)})`);
      console.log(`   �📈 Total Supply Increased by: ${ethers.formatEther(supplyIncrease)} LP tokens`);
      console.log(`   💰 Final LP Price: ${finalLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   ⛽ Gas Used: ${receipt!.gasUsed.toLocaleString()} gas`);
      
      // Verify LP tokens minted
      expect(finalLPBalance).to.be.gt(initialLPBalance);
      
      // Verify WETH received by ProxyGeneral
      expect(finalWETHBalance).to.be.gt(initialWETHBalance);
      
      // Verify total supply increased
      expect(finalTotalSupply).to.be.gt(initialTotalSupply);
    });

    // INT-DEP-HIGH-002: Deposit → ValueCalculator → pool value update
    it("INT-DEP-HIGH-002: should update pool value via ValueCalculator after deposit", async function () {
      // Get initial pool value
      const initialPoolValue = await valueCalculator.getTotalPoolValueView();
      const initialTotalSupply = await proxyGeneral.totalSupply();
      const initialLPPrice = initialTotalSupply > 0n ? Number(initialPoolValue) / Number(initialTotalSupply) : 0;
      
      console.log(`\n📊 POOL VALUE TRACKING:`);
      console.log(`   � Initial Pool Value: ${ethers.formatEther(initialPoolValue)} ETH`);
      console.log(`   📈 Initial Total Supply: ${ethers.formatEther(initialTotalSupply)} LP tokens`);
      console.log(`   💰 Initial LP Price: ${initialLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   💳 Depositing: ${ethers.formatEther(DEPOSIT_AMOUNT)} ETH`);
      
      // Execute deposit
      const tx = await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      const receipt = await tx.wait();
      
      // Get updated pool value
      const finalPoolValue = await valueCalculator.getTotalPoolValueView();
      const finalTotalSupply = await proxyGeneral.totalSupply();
      const finalLPPrice = finalTotalSupply > 0n ? Number(finalPoolValue) / Number(finalTotalSupply) : 0;
      const valueIncrease = finalPoolValue - initialPoolValue;
      const percentageIncrease = (BigInt(valueIncrease) * 10000n) / BigInt(initialPoolValue);
      
      console.log(`\n✅ POOL VALUE UPDATED:`);
      console.log(`   � Final Pool Value: ${ethers.formatEther(finalPoolValue)} ETH`);
      console.log(`   📊 Value Increase: ${ethers.formatEther(valueIncrease)} ETH`);
      console.log(`   📈 Percentage Increase: ${Number(percentageIncrease)/100}%`);
      console.log(`   📈 Final Total Supply: ${ethers.formatEther(finalTotalSupply)} LP tokens`);
      console.log(`   💰 Final LP Price: ${finalLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   🔄 ValueCalculator successfully recalculated total pool worth`);
      console.log(`   ⛽ Gas Used: ${receipt!.gasUsed.toLocaleString()} gas`);
      
      // Pool value should increase
      expect(finalPoolValue).to.be.gt(initialPoolValue);
    });

    // INT-DEP-HIGH-003: Deposit → ProxyGeneral custody transfer
    it("INT-DEP-HIGH-003: should transfer assets to ProxyGeneral custody", async function () {
      const depositAmount = DEPOSIT_AMOUNT;
      
      // Get initial ProxyGeneral WETH balance
      const initialBalance = await mockWETH.balanceOf(proxyGeneral.target);
      const initialPoolValue = await valueCalculator.getTotalPoolValueView();
      const initialTotalSupply = await proxyGeneral.totalSupply();
      const initialLPPrice = initialTotalSupply > 0n ? Number(initialPoolValue) / Number(initialTotalSupply) : 0;
      
      console.log(`\n🏛️ CUSTODY TRANSFER VERIFICATION:`);
      console.log(`   💰 Deposit Amount: ${ethers.formatEther(depositAmount)} ETH`);
      console.log(`   🏦 ProxyGeneral Initial WETH: ${ethers.formatEther(initialBalance)} WETH`);
      console.log(`   💎 Initial Pool Value: ${ethers.formatEther(initialPoolValue)} ETH`);
      console.log(`   💰 Initial LP Price: ${initialLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   📍 ProxyGeneral Address: ${proxyGeneral.target.slice(0,10)}...`);
      
      // Execute deposit
      const tx = await liquidityManager.connect(user1).deposit({ value: depositAmount });
      const receipt = await tx.wait();
      
      // Calculate expected values
      const expectedFee = (depositAmount * BigInt(DEFAULT_DEPOSIT_FEE)) / 10000n;
      const expectedIncrease = depositAmount - expectedFee;
      
      // Verify WETH in ProxyGeneral custody
      const finalBalance = await mockWETH.balanceOf(proxyGeneral.target);
      const actualIncrease = finalBalance - initialBalance;
      const finalPoolValue = await valueCalculator.getTotalPoolValueView();
      const finalTotalSupply = await proxyGeneral.totalSupply();
      const finalLPPrice = finalTotalSupply > 0n ? Number(finalPoolValue) / Number(finalTotalSupply) : 0;
      
      console.log(`\n✅ CUSTODY TRANSFER COMPLETED:`);
      console.log(`   💸 Fee Deducted: ${ethers.formatEther(expectedFee)} ETH`);
      console.log(`   💵 Net Amount: ${ethers.formatEther(expectedIncrease)} ETH`);
      console.log(`   🔄 Actual WETH Received: ${ethers.formatEther(actualIncrease)} WETH`);
      console.log(`   🏦 ProxyGeneral Final WETH: ${ethers.formatEther(finalBalance)} WETH`);
      console.log(`   💎 Final Pool Value: ${ethers.formatEther(finalPoolValue)} ETH`);
      console.log(`   💰 Final LP Price: ${finalLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   📈 Custody Increase: ${ethers.formatEther(actualIncrease)} WETH`);
      console.log(`   ✨ Assets successfully transferred to ProxyGeneral custody`);
      console.log(`   ⛽ Gas Used: ${receipt!.gasUsed.toLocaleString()} gas`);
      
      expect(finalBalance - initialBalance).to.be.closeTo(expectedIncrease, ethers.parseEther("0.01"));
    });

    // INT-DEP-HIGH-004: Deposit → fee → FeeRecipient balance
    it("INT-DEP-HIGH-004: should send deposit fee to FeeRecipient", async function () {
      const depositAmount = DEPOSIT_AMOUNT;
      const expectedFee = (depositAmount * BigInt(DEFAULT_DEPOSIT_FEE)) / 10000n;
      
      // Get initial fee recipient ETH balance (not WETH - fees sent as ETH)
      const initialFeeBalance = await ethers.provider.getBalance(feeRecipient.address);
      const initialPoolValue = await valueCalculator.getTotalPoolValueView();
      const initialTotalSupply = await proxyGeneral.totalSupply();
      const initialLPPrice = initialTotalSupply > 0n ? Number(initialPoolValue) / Number(initialTotalSupply) : 0;
      
      console.log(`\n💰 FEE DISTRIBUTION TRACKING:`);
      console.log(`   💳 Deposit Amount: ${ethers.formatEther(depositAmount)} ETH`);
      console.log(`   📊 Fee Rate: ${DEFAULT_DEPOSIT_FEE/100}% (${DEFAULT_DEPOSIT_FEE} basis points)`);
      console.log(`   💸 Expected Fee: ${ethers.formatEther(expectedFee)} ETH`);
      console.log(`   👤 Fee Recipient: ${feeRecipient.address.slice(0,10)}...`);
      console.log(`   💰 Initial Fee Balance: ${ethers.formatEther(initialFeeBalance)} ETH`);
      console.log(`   💎 Initial Pool Value: ${ethers.formatEther(initialPoolValue)} ETH`);
      console.log(`   💰 Initial LP Price: ${initialLPPrice.toFixed(6)} ETH per LP token`);
      
      // Execute deposit
      const tx = await liquidityManager.connect(user1).deposit({ value: depositAmount });
      const receipt = await tx.wait();
      
      // Verify fee received as ETH
      const finalFeeBalance = await ethers.provider.getBalance(feeRecipient.address);
      const feeReceived = finalFeeBalance - initialFeeBalance;
      const finalPoolValue = await valueCalculator.getTotalPoolValueView();
      const finalTotalSupply = await proxyGeneral.totalSupply();
      const finalLPPrice = finalTotalSupply > 0n ? Number(finalPoolValue) / Number(finalTotalSupply) : 0;
      
      console.log(`\n✅ FEE PAYMENT COMPLETED:`);
      console.log(`   💸 Fee Actually Received: ${ethers.formatEther(feeReceived)} ETH`);
      console.log(`   💰 Final Fee Balance: ${ethers.formatEther(finalFeeBalance)} ETH`);
      console.log(`   📈 Balance Increase: ${ethers.formatEther(feeReceived)} ETH`);
      console.log(`   💎 Final Pool Value: ${ethers.formatEther(finalPoolValue)} ETH`);
      console.log(`   💰 Final LP Price: ${finalLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   ✨ Fee successfully transferred to FeeRecipient`);
      console.log(`   🔍 Fee Accuracy: ${(Number(feeReceived * 10000n / expectedFee) / 100).toFixed(2)}%`);
      console.log(`   ⛽ Gas Used: ${receipt!.gasUsed.toLocaleString()} gas`);
      
      expect(feeReceived).to.be.closeTo(expectedFee, ethers.parseEther("0.001"));
    });

    // INT-DEP-HIGH-005: Multiple deposits → totalSupply tracking
    it("INT-DEP-HIGH-005: should track totalSupply correctly across multiple deposits", async function () {
      const initialSupply = await proxyGeneral.totalSupply();
      const initialPoolValue = await valueCalculator.getTotalPoolValueView();
      const initialLPPrice = initialSupply > 0n ? Number(initialPoolValue) / Number(initialSupply) : 0;
      
      console.log(`\n📊 MULTI-DEPOSIT SUPPLY TRACKING:`);
      console.log(`   📈 Initial Total Supply: ${ethers.formatEther(initialSupply)} LP tokens`);
      console.log(`   💎 Initial Pool Value: ${ethers.formatEther(initialPoolValue)} ETH`);
      console.log(`   💰 Initial LP Price: ${initialLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   👥 Testing with 3 deposits from 2 users`);
      
      // First deposit from user1
      console.log(`\n🔸 DEPOSIT 1 - User1:`);
      console.log(`   💰 Amount: ${ethers.formatEther(DEPOSIT_AMOUNT)} ETH`);
      const tx1 = await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      const receipt1 = await tx1.wait();
      const supplyAfterFirst = await proxyGeneral.totalSupply();
      const user1BalanceFirst = await proxyGeneral.balanceOf(user1.address);
      const supplyIncreaseFirst = supplyAfterFirst - initialSupply;
      const poolValueAfterFirst = await valueCalculator.getTotalPoolValueView();
      const lpPriceAfterFirst = supplyAfterFirst > 0n ? Number(poolValueAfterFirst) / Number(supplyAfterFirst) : 0;
      
      console.log(`   🎫 LP Tokens Minted: ${ethers.formatEther(user1BalanceFirst)} LP tokens`);
      console.log(`   📈 Total Supply: ${ethers.formatEther(supplyAfterFirst)} LP tokens (+${ethers.formatEther(supplyIncreaseFirst)})`);
      console.log(`   💎 Pool Value: ${ethers.formatEther(poolValueAfterFirst)} ETH`);
      console.log(`   💰 LP Price: ${lpPriceAfterFirst.toFixed(6)} ETH per LP token`);
      console.log(`   ⛽ Gas Used: ${receipt1!.gasUsed.toLocaleString()} gas`);
      expect(supplyAfterFirst).to.be.gt(initialSupply);
      
      // Second deposit from user2
      console.log(`\n🔸 DEPOSIT 2 - User2:`);
      console.log(`   💰 Amount: ${ethers.formatEther(LARGE_DEPOSIT)} ETH (Large deposit)`);
      const tx2 = await liquidityManager.connect(user2).deposit({ value: LARGE_DEPOSIT });
      const receipt2 = await tx2.wait();
      const supplyAfterSecond = await proxyGeneral.totalSupply();
      const user2Balance = await proxyGeneral.balanceOf(user2.address);
      const supplyIncreaseSecond = supplyAfterSecond - supplyAfterFirst;
      const poolValueAfterSecond = await valueCalculator.getTotalPoolValueView();
      const lpPriceAfterSecond = supplyAfterSecond > 0n ? Number(poolValueAfterSecond) / Number(supplyAfterSecond) : 0;
      
      console.log(`   🎫 LP Tokens Minted: ${ethers.formatEther(user2Balance)} LP tokens`);
      console.log(`   📈 Total Supply: ${ethers.formatEther(supplyAfterSecond)} LP tokens (+${ethers.formatEther(supplyIncreaseSecond)})`);
      console.log(`   💎 Pool Value: ${ethers.formatEther(poolValueAfterSecond)} ETH`);
      console.log(`   💰 LP Price: ${lpPriceAfterSecond.toFixed(6)} ETH per LP token`);
      console.log(`   ⛽ Gas Used: ${receipt2!.gasUsed.toLocaleString()} gas`);
      expect(supplyAfterSecond).to.be.gt(supplyAfterFirst);
      
      // Third deposit from user1 again
      console.log(`\n🔸 DEPOSIT 3 - User1 (again):`);
      console.log(`   💰 Amount: ${ethers.formatEther(SMALL_DEPOSIT)} ETH (Small deposit)`);
      const tx3 = await liquidityManager.connect(user1).deposit({ value: SMALL_DEPOSIT });
      const receipt3 = await tx3.wait();
      const finalSupply = await proxyGeneral.totalSupply();
      const user1BalanceFinal = await proxyGeneral.balanceOf(user1.address);
      const user1AdditionalTokens = user1BalanceFinal - user1BalanceFirst;
      const supplyIncreaseThird = finalSupply - supplyAfterSecond;
      const finalPoolValue = await valueCalculator.getTotalPoolValueView();
      const finalLPPrice = finalSupply > 0n ? Number(finalPoolValue) / Number(finalSupply) : 0;
      
      console.log(`   🎫 Additional LP Tokens: ${ethers.formatEther(user1AdditionalTokens)} LP tokens`);
      console.log(`   📈 Total Supply: ${ethers.formatEther(finalSupply)} LP tokens (+${ethers.formatEther(supplyIncreaseThird)})`);
      console.log(`   💎 Pool Value: ${ethers.formatEther(finalPoolValue)} ETH`);
      console.log(`   💰 LP Price: ${finalLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   ⛽ Gas Used: ${receipt3!.gasUsed.toLocaleString()} gas`);
      expect(finalSupply).to.be.gt(supplyAfterSecond);
      
      // Verify user balances sum to total supply (accounting for initial supply)
      const user1BalanceTotal = await proxyGeneral.balanceOf(user1.address);
      const user2BalanceTotal = await proxyGeneral.balanceOf(user2.address);
      const userTotal = user1BalanceTotal + user2BalanceTotal;
      const totalIncreaseFromDeposits = finalSupply - initialSupply;
      
      console.log(`\n✅ SUPPLY TRACKING VERIFICATION:`);
      console.log(`   👤 User1 Total LP Balance: ${ethers.formatEther(user1BalanceTotal)} LP tokens`);
      console.log(`   👤 User2 Total LP Balance: ${ethers.formatEther(user2BalanceTotal)} LP tokens`);
      console.log(`   👥 Combined User Balances: ${ethers.formatEther(userTotal)} LP tokens`);
      console.log(`   📈 Total Supply Increase: ${ethers.formatEther(totalIncreaseFromDeposits)} LP tokens`);
      console.log(`   💎 Final Pool Value: ${ethers.formatEther(finalPoolValue)} ETH`);
      console.log(`   💰 Final LP Price: ${finalLPPrice.toFixed(6)} ETH per LP token`);
      console.log(`   ✨ Supply tracking accurate across all deposits`);
      console.log(`   📊 Final Total Supply: ${ethers.formatEther(finalSupply)} LP tokens`);
      
      expect(finalSupply - initialSupply).to.equal(userTotal);
    });
  });
});
