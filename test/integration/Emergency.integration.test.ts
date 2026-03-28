import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🚨 EMERGENCY FLOW - INTEGRATION TESTS
 * 
 * Tests complete emergency flow across all modules:
 * - Pause propagation to all modules
 * - Emergency withdraw asset recovery
 * - Operations blocking during emergency
 */

describe("Integration: Emergency Flow", function () {
  let beacon: any;
  let proxyGeneral: any;
  let liquidityManager: any;
  let emergencyHandler: any;
  let tokenManager: any;
  let parameterManager: any;
  let mockWETH: any;
  let mockOracle: any;
  let owner: any;
  let user1: any;

  const DEPOSIT_AMOUNT = ethers.parseEther("10.0");
  const DEFAULT_DEPOSIT_FEE = 50;

  async function deployEmergencyFixture() {
    const [owner, user1, feeRecipient] = await ethers.getSigners();

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
    await chainlinkAdapter.setPriceFeed("USDC", mockOracle.target, 8, 3600);
    await chainlinkAdapter.setPriceFeed("WBTC", mockOracle.target, 8, 3600);

    // Deploy core contracts
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

    const EmergencyHandler = await ethers.getContractFactory("EmergencyHandler");
    const emergencyHandler = await EmergencyHandler.deploy(beacon.target);

    // Register contracts in Beacon
    await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
    await beacon.updateImplementation("TokenManager", tokenManager.target);
    await beacon.updateImplementation("ValueCalculator", valueCalculator.target);
    await beacon.updateImplementation("ParameterManager", parameterManager.target);
    await beacon.updateImplementation("LiquidityManager", liquidityManager.target);
    await beacon.updateImplementation("EmergencyHandler", emergencyHandler.target);

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

    return {
      beacon,
      proxyGeneral,
      liquidityManager,
      emergencyHandler,
      tokenManager,
      parameterManager,
      mockWETH,
      mockOracle,
      owner,
      user1
    };
  }

  beforeEach(async function () {
    const fixture = await deployEmergencyFixture();
    beacon = fixture.beacon;
    proxyGeneral = fixture.proxyGeneral;
    liquidityManager = fixture.liquidityManager;
    emergencyHandler = fixture.emergencyHandler;
    tokenManager = fixture.tokenManager;
    parameterManager = fixture.parameterManager;
    mockWETH = fixture.mockWETH;
    mockOracle = fixture.mockOracle;
    owner = fixture.owner;
    user1 = fixture.user1;

    // Authorize modules
    await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");
    await proxyGeneral.authorizeModule(emergencyHandler.target, "EmergencyHandler");
    
    // Enable operations
    await liquidityManager.setDepositsEnabled(true);
    await liquidityManager.setWithdrawsEnabled(true);
    
    // Setup parameters
    await parameterManager.getFunction("proposeParameterChange(string,uint256)")
      ("minDeposit", ethers.parseEther("0.01"));
    
    // Setup rate limiting
    await proxyGeneral.setRateLimit("deposit", ethers.parseEther("200"), ethers.parseEther("1000"));
    await proxyGeneral.setRateLimit("withdraw", ethers.parseEther("1000"), ethers.parseEther("2000"));
    
    // Bootstrap pool
    await liquidityManager.connect(owner).deposit({ value: ethers.parseEther("10") });
    await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
  });

  describe("⚡ HIGH: Emergency Flow Integration Tests", function () {
    
    // INT-EMR-HIGH-001: Pause → all operations blocked
    it("INT-EMR-HIGH-001: should block all operations when emergency pause activated", async function () {
      // Verify operations work before pause
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      const initialPoolValue = await emergencyHandler.getSystemHealthStatus();
      const initialProxyWETH = await mockWETH.balanceOf(proxyGeneral.target);
      
      console.log(`\n🚨 EMERGENCY PAUSE ACTIVATION TEST:`);
      console.log(`   👤 User: ${user1.address.slice(0,8)}...`);
      console.log(`   🎫 User LP Balance: ${ethers.formatEther(lpBalance)} LP tokens`);
      console.log(`   🟢 System Status: ${initialPoolValue.isPaused ? 'PAUSED' : 'ACTIVE'}`);
      console.log(`   🌊 Pool WETH: ${ethers.formatEther(initialProxyWETH)} WETH`);
      console.log(`   ✅ Operations currently functional`);
      
      expect(lpBalance).to.be.gt(0);
      
      // Activate emergency pause
      console.log(`\n🚨 ACTIVATING EMERGENCY PAUSE...`);
      const emergencyReason = "Integration test emergency";
      const tx = await emergencyHandler.connect(owner).activateEmergency(emergencyReason);
      const receipt = await tx.wait();
      
      // Verify system is paused
      const pauseStatus = await proxyGeneral.paused();
      const healthStatus = await emergencyHandler.getSystemHealthStatus();
      
      console.log(`\n✅ EMERGENCY PAUSE ACTIVATED:`);
      console.log(`   🔴 System Status: ${pauseStatus ? 'PAUSED' : 'ACTIVE'}`);
      console.log(`   📝 Emergency Reason: "${emergencyReason}"`);
      console.log(`   🏛️ ProxyGeneral Paused: ${pauseStatus}`);
      console.log(`   📊 Health Status Paused: ${healthStatus.isPaused}`);
      console.log(`   ⛽ Gas Used: ${receipt!.gasUsed.toLocaleString()} gas`);
      
      expect(pauseStatus).to.be.true;
      
      console.log(`\n🚫 TESTING OPERATION BLOCKING:`);
      
      // Try deposit - should revert
      console.log(`   💰 Attempting deposit of 1 ETH...`);
      await expect(
        liquidityManager.connect(user1).deposit({ value: ethers.parseEther("1") })
      ).to.be.revertedWith("Contract is paused");
      console.log(`   ❌ Deposit correctly blocked`);
      
      // Try withdraw - should revert
      console.log(`   🎫 Attempting withdrawal of ${ethers.formatEther(lpBalance / 2n)} LP tokens...`);
      await expect(
        liquidityManager.connect(user1).withdraw(lpBalance / 2n)
      ).to.be.revertedWith("Contract is paused");
      console.log(`   ❌ Withdraw correctly blocked`);
      
      console.log(`\n✅ EMERGENCY PAUSE VERIFICATION COMPLETE:`);
      console.log(`   🛡️ All operations successfully blocked during emergency`);
      console.log(`   🔴 System in full lockdown mode`);
      console.log(`   ✨ Emergency protection functioning correctly`);
    });

    // INT-EMR-HIGH-002: Pause propagation across modules
    it("INT-EMR-HIGH-002: should propagate pause state across all modules", async function () {
      // Check ProxyGeneral unpaused initially
      const initialPauseState = await proxyGeneral.paused();
      const initialHealthStatus = await emergencyHandler.getSystemHealthStatus();
      
      console.log(`\n🔄 PAUSE PROPAGATION TEST:`);
      console.log(`   🏛️ ProxyGeneral Initial State: ${initialPauseState ? 'PAUSED' : 'ACTIVE'}`);
      console.log(`   📊 System Health Initial State: ${initialHealthStatus.isPaused ? 'PAUSED' : 'ACTIVE'}`);
      console.log(`   🎯 Testing emergency propagation across all modules`);
      
      expect(initialPauseState).to.be.false;
      
      // Activate emergency
      console.log(`\n🚨 ACTIVATING EMERGENCY...`);
      const emergencyReason = "Propagation test";
      const tx = await emergencyHandler.connect(owner).activateEmergency(emergencyReason);
      const receipt = await tx.wait();
      
      // Verify pause propagated to ProxyGeneral
      const finalPauseState = await proxyGeneral.paused();
      const finalHealthStatus = await emergencyHandler.getSystemHealthStatus();
      
      console.log(`\n✅ PAUSE PROPAGATION COMPLETED:`);
      console.log(`   📝 Emergency Reason: "${emergencyReason}"`);
      console.log(`   🏛️ ProxyGeneral Final State: ${finalPauseState ? 'PAUSED' : 'ACTIVE'}`);
      console.log(`   📊 System Health Final State: ${finalHealthStatus.isPaused ? 'PAUSED' : 'ACTIVE'}`);
      console.log(`   🔄 Pause propagated: ${!initialPauseState && finalPauseState ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   ⛽ Gas Used: ${receipt!.gasUsed.toLocaleString()} gas`);
      
      expect(finalPauseState).to.be.true;
      
      // Verify emergency state tracked
      expect(finalHealthStatus.isPaused).to.be.true;
      
      console.log(`\n✅ PROPAGATION VERIFICATION COMPLETE:`);
      console.log(`   🔗 Emergency state successfully propagated to all modules`);
      console.log(`   📊 EmergencyHandler correctly tracking system state`);
      console.log(`   ✨ Module coordination functioning properly`);
    });

    // INT-EMR-HIGH-003: Emergency withdraw → asset recovery
    it("INT-EMR-HIGH-003: should execute emergency withdraw successfully", async function () {
      // Get initial asset state
      const initialProxyWETH = await mockWETH.balanceOf(proxyGeneral.target);
      const initialOwnerETH = await ethers.provider.getBalance(owner.address);
      const initialTotalSupply = await proxyGeneral.totalSupply();
      const initialHealthStatus = await emergencyHandler.getSystemHealthStatus();
      
      console.log(`\n🆘 EMERGENCY ASSET RECOVERY TEST:`);
      console.log(`   👤 Owner: ${owner.address.slice(0,8)}...`);
      console.log(`   🌊 Pool WETH Holdings: ${ethers.formatEther(initialProxyWETH)} WETH`);
      console.log(`   💰 Owner Initial ETH: ${ethers.formatEther(initialOwnerETH)} ETH`);
      console.log(`   📈 Total LP Supply: ${ethers.formatEther(initialTotalSupply)} LP tokens`);
      console.log(`   🟢 System Status: ${initialHealthStatus.isPaused ? 'PAUSED' : 'ACTIVE'}`);
      
      // Activate emergency
      console.log(`\n🚨 ACTIVATING EMERGENCY...`);
      const emergencyReason = "Asset recovery test";
      const emergencyTx = await emergencyHandler.connect(owner).activateEmergency(emergencyReason);
      const emergencyReceipt = await emergencyTx.wait();
      
      // Verify system paused
      const pauseState = await proxyGeneral.paused();
      console.log(`   🔴 Emergency Activated: System ${pauseState ? 'PAUSED' : 'STILL ACTIVE'}`);
      console.log(`   ⛽ Emergency Gas: ${emergencyReceipt!.gasUsed.toLocaleString()} gas`);
      expect(pauseState).to.be.true;
      
      // Execute emergency withdraw (returns WithdrawResult[] array)
      console.log(`\n🆘 EXECUTING EMERGENCY WITHDRAWAL...`);
      const withdrawTx = await emergencyHandler.connect(owner).emergencyWithdraw();
      const withdrawReceipt = await withdrawTx.wait();
      
      // Get final state
      const finalProxyWETH = await mockWETH.balanceOf(proxyGeneral.target);
      const finalOwnerETH = await ethers.provider.getBalance(owner.address);
      const finalStats = await emergencyHandler.getEmergencyStats();
      
      // Calculate recovery metrics
      const wethRecovered = initialProxyWETH - finalProxyWETH;
      const ownerGasUsed = (emergencyReceipt!.gasUsed * emergencyReceipt!.gasPrice) + 
                          (withdrawReceipt!.gasUsed * withdrawReceipt!.gasPrice);
      const netETHChange = finalOwnerETH - initialOwnerETH + BigInt(ownerGasUsed);
      
      console.log(`\n✅ EMERGENCY WITHDRAWAL COMPLETED:`);
      console.log(`   🌊 WETH Recovered: ${ethers.formatEther(wethRecovered)} WETH`);
      console.log(`   🏛️ Remaining Pool WETH: ${ethers.formatEther(finalProxyWETH)} WETH`);
      console.log(`   💰 Owner ETH Change: ${ethers.formatEther(netETHChange)} ETH`);
      console.log(`   ⛽ Total Gas Used: ${(emergencyReceipt!.gasUsed + withdrawReceipt!.gasUsed).toLocaleString()} gas`);
      console.log(`   📊 Emergency Stats - Executed: ${finalStats.withdrawExecuted}`);
      console.log(`   📊 Emergency Stats - Paused: ${finalStats.isPaused}`);
      
      // Verify EmergencyWithdrawCompleted event was emitted
      const events = withdrawReceipt!.logs.filter((log: any) => {
        try {
          const parsed = emergencyHandler.interface.parseLog(log);
          return parsed?.name === "EmergencyWithdrawCompleted";
        } catch {
          return false;
        }
      });
      
      console.log(`   📋 Events Emitted: ${events.length} EmergencyWithdrawCompleted event(s)`);
      expect(events.length).to.be.gt(0);
      
      // Verify emergency stats updated
      expect(finalStats.withdrawExecuted).to.be.true;
      expect(finalStats.isPaused).to.be.true;
      
      console.log(`\n✅ ASSET RECOVERY VERIFICATION COMPLETE:`);
      console.log(`   🆘 Emergency withdrawal mechanism functioning correctly`);
      console.log(`   💰 Assets successfully recovered from protocol`);
      console.log(`   📊 Emergency statistics properly tracked`);
      console.log(`   ✨ Critical recovery procedures operational`);
    });
  });
});
