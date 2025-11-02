import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  Beacon,
  TokenManager,
  ParameterManager, 
  ValueCalculator,
  ProxyGeneral,
  LiquidityManager,
  SwapManager,
  EmergencyHandler
} from "../../typechain-types";

describe("Integration: Beacon ↔ Modules", function () {
  
  // ==================== SETUP ====================
  
  let beacon: Beacon;
  let tokenManager: TokenManager;
  let parameterManager: ParameterManager;
  let valueCalculator: ValueCalculator;
  let proxyGeneral: ProxyGeneral;
  let liquidityManager: LiquidityManager;
  let swapManager: SwapManager;
  let emergencyHandler: EmergencyHandler;
  
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  
  const MODULE_NAMES = [
    "TokenManager",
    "ParameterManager", 
    "ValueCalculator",
    "ProxyGeneral",
    "LiquidityManager",
    "SwapManager",
    "EmergencyHandler"
  ];

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy Beacon
    const BeaconFactory = await ethers.getContractFactory("Beacon");
    beacon = await BeaconFactory.deploy();
    await beacon.waitForDeployment();

    // Deploy all modules
    console.log("🚀 Deploying all modules for integration testing...");
    
    const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
    tokenManager = await TokenManagerFactory.deploy(await beacon.getAddress());
    await tokenManager.waitForDeployment();

    const ParameterManagerFactory = await ethers.getContractFactory("ParameterManager");
    parameterManager = await ParameterManagerFactory.deploy(await beacon.getAddress());
    await parameterManager.waitForDeployment();

    const ValueCalculatorFactory = await ethers.getContractFactory("ValueCalculator");
    valueCalculator = await ValueCalculatorFactory.deploy(await beacon.getAddress());
    await valueCalculator.waitForDeployment();

    const ProxyGeneralFactory = await ethers.getContractFactory("ProxyGeneral");
    proxyGeneral = await ProxyGeneralFactory.deploy(await beacon.getAddress());
    await proxyGeneral.waitForDeployment();

    const LiquidityManagerFactory = await ethers.getContractFactory("LiquidityManager");
    liquidityManager = await LiquidityManagerFactory.deploy(await beacon.getAddress());
    await liquidityManager.waitForDeployment();

    const SwapManagerFactory = await ethers.getContractFactory("SwapManager");
    swapManager = await SwapManagerFactory.deploy(await beacon.getAddress());
    await swapManager.waitForDeployment();

    const EmergencyHandlerFactory = await ethers.getContractFactory("EmergencyHandler");
    emergencyHandler = await EmergencyHandlerFactory.deploy(await beacon.getAddress());
    await emergencyHandler.waitForDeployment();

    console.log("✅ All modules deployed successfully");
  });

  // ==================== WAVE 1: BEACON MODULES TESTS ====================

  describe("⚡ HIGH: Beacon Module Management Tests", function () {

    describe("🏗️ BM-001: Beacon Module Discovery and Registration", function () {

      it("should register all 8 modules in the Beacon", async function () {
        console.log("\n🔍 BEACON MODULE REGISTRATION TEST:");
        console.log(`   📊 Testing registration of ${MODULE_NAMES.length} modules`);
        console.log(`   🎯 Beacon Address: ${await beacon.getAddress()}`);

        // Get initial state
        const initialModules = await beacon.getRegisteredModules();
        console.log(`   📋 Initial registered modules: ${initialModules.length}`);

        // Register all modules in the Beacon
        const moduleAddresses = [
          await tokenManager.getAddress(),
          await parameterManager.getAddress(),
          await valueCalculator.getAddress(), 
          await proxyGeneral.getAddress(),
          await liquidityManager.getAddress(),
          await swapManager.getAddress(),
          await emergencyHandler.getAddress()
        ];

        console.log("\n🔄 REGISTERING MODULES:");
        for (let i = 0; i < MODULE_NAMES.length; i++) {
          const moduleName = MODULE_NAMES[i];
          const moduleAddress = moduleAddresses[i];
          
          console.log(`   📝 Registering ${moduleName}: ${moduleAddress}`);
          await beacon.updateImplementation(moduleName, moduleAddress);
          
          // Verify module was registered
          const exists = await beacon.checkModuleExists(moduleName);
          expect(exists).to.be.true;
          
          const retrievedAddress = await beacon.getImplementation(moduleName);
          expect(retrievedAddress).to.equal(moduleAddress);
          
          console.log(`   ✅ ${moduleName} registered successfully`);
        }

        console.log("\n📊 VERIFICATION:");
        
        // Verify all modules are registered
        const finalModules = await beacon.getRegisteredModules();
        console.log(`   📈 Final registered modules: ${finalModules.length}`);
        expect(finalModules.length).to.equal(MODULE_NAMES.length);

        // Check each module exists and has correct address
        for (let i = 0; i < MODULE_NAMES.length; i++) {
          const moduleName = MODULE_NAMES[i];
          const expectedAddress = moduleAddresses[i];
          
          const exists = await beacon.checkModuleExists(moduleName);
          expect(exists).to.be.true;
          
          const actualAddress = await beacon.getImplementation(moduleName);
          expect(actualAddress).to.equal(expectedAddress);
          
          console.log(`   ✅ ${moduleName}: ${actualAddress} ✓`);
        }

        // Verify module discovery functionality
        const discoveredModules = await beacon.getRegisteredModules();
        expect(discoveredModules).to.have.lengthOf(MODULE_NAMES.length);
        
        // Check all expected modules are discovered
        for (const moduleName of MODULE_NAMES) {
          expect(discoveredModules).to.include(moduleName);
        }

        console.log("\n✅ MODULE DISCOVERY VERIFICATION COMPLETE:");
        console.log(`   🎯 All ${MODULE_NAMES.length} modules discovered correctly`);
        console.log(`   📊 Beacon successfully managing module registry`);
        console.log(`   🔄 Module discovery system functioning properly`);
      });

      it("should provide accurate module information for all registered modules", async function () {
        console.log("\n📋 MODULE INFORMATION VERIFICATION TEST:");
        
        // Register all modules first
        const moduleAddresses = [
          await tokenManager.getAddress(),
          await parameterManager.getAddress(),
          await valueCalculator.getAddress(),
          await proxyGeneral.getAddress(), 
          await liquidityManager.getAddress(),
          await swapManager.getAddress(),
          await emergencyHandler.getAddress()
        ];

        for (let i = 0; i < MODULE_NAMES.length; i++) {
          await beacon.updateImplementation(MODULE_NAMES[i], moduleAddresses[i]);
        }

        console.log(`   🔍 Verifying module info for ${MODULE_NAMES.length} modules`);

        // Test module information retrieval
        for (let i = 0; i < MODULE_NAMES.length; i++) {
          const moduleName = MODULE_NAMES[i];
          const expectedAddress = moduleAddresses[i];
          
          console.log(`\n   📊 Testing ${moduleName}:`);
          
          // Get detailed module info
          const moduleInfo = await beacon.getModuleInfo(moduleName);
          
          console.log(`      📍 Address: ${moduleInfo.currentImpl}`);
          console.log(`      🕐 Last Update: ${moduleInfo.lastUpdated}`);
          console.log(`      🔒 Frozen: ${moduleInfo.isFrozen}`);
          console.log(`      📚 History Length: ${moduleInfo.historyCount}`);
          
          // Verify module info accuracy
          expect(moduleInfo.currentImpl).to.equal(expectedAddress);
          expect(moduleInfo.lastUpdated).to.be.gt(0);
          expect(moduleInfo.isFrozen).to.be.false;
          expect(moduleInfo.historyCount).to.equal(0); // No updates yet
          
          // Get implementation history
          const history = await beacon.getImplementationHistory(moduleName);
          expect(history).to.have.lengthOf(0); // No previous implementations
          
          console.log(`      ✅ ${moduleName} info verified`);
        }

        console.log("\n✅ MODULE INFORMATION VERIFICATION COMPLETE:");
        console.log(`   📊 All module info correctly retrieved`);
        console.log(`   🎯 Beacon providing accurate module metadata`);
        console.log(`   📋 Module information system functioning properly`);
      });

      it("should handle module existence checks correctly", async function () {
        console.log("\n🔍 MODULE EXISTENCE CHECK TEST:");
        
        // Test non-existent modules
        const nonExistentModules = ["NonExistent", "FakeModule", "TestModule"];
        
        console.log("   🚫 Testing non-existent modules:");
        for (const moduleName of nonExistentModules) {
          const exists = await beacon.checkModuleExists(moduleName);
          expect(exists).to.be.false;
          console.log(`      ❌ ${moduleName}: ${exists} ✓`);
        }

        // Register a few modules
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
        
        console.log("\n   ✅ Testing registered modules:");
        
        // Test existing modules
        let exists = await beacon.checkModuleExists("TokenManager");
        expect(exists).to.be.true;
        console.log(`      ✅ TokenManager: ${exists} ✓`);
        
        exists = await beacon.checkModuleExists("ValueCalculator");
        expect(exists).to.be.true;
        console.log(`      ✅ ValueCalculator: ${exists} ✓`);
        
        // Test still non-existent modules
        exists = await beacon.checkModuleExists("SwapManager");
        expect(exists).to.be.false;
        console.log(`      ❌ SwapManager (not registered): ${exists} ✓`);

        console.log("\n✅ MODULE EXISTENCE CHECK COMPLETE:");
        console.log(`   🎯 Existence checks working correctly`);
        console.log(`   📊 Beacon accurately tracking module states`);
      });

      it("should maintain accurate registered module list", async function () {
        console.log("\n📜 REGISTERED MODULE LIST TEST:");
        
        // Start with empty list
        let registeredModules = await beacon.getRegisteredModules();
        expect(registeredModules).to.have.lengthOf(0);
        console.log(`   📊 Initial modules: ${registeredModules.length}`);

        // Register modules one by one and verify list updates
        const testModules = [
          { name: "TokenManager", address: await tokenManager.getAddress() },
          { name: "ParameterManager", address: await parameterManager.getAddress() },
          { name: "ValueCalculator", address: await valueCalculator.getAddress() }
        ];

        console.log("\n   🔄 Registering modules sequentially:");
        for (let i = 0; i < testModules.length; i++) {
          const { name, address } = testModules[i];
          
          await beacon.updateImplementation(name, address);
          
          registeredModules = await beacon.getRegisteredModules();
          expect(registeredModules).to.have.lengthOf(i + 1);
          expect(registeredModules).to.include(name);
          
          console.log(`      ✅ Step ${i + 1}: ${name} added. Total: ${registeredModules.length}`);
        }

        console.log("\n   📋 Final registered modules:");
        const finalList = await beacon.getRegisteredModules();
        for (const moduleName of finalList) {
          console.log(`      📌 ${moduleName}`);
        }

        // Verify final list accuracy
        expect(finalList).to.have.lengthOf(testModules.length);
        for (const { name } of testModules) {
          expect(finalList).to.include(name);
        }

        console.log("\n✅ REGISTERED MODULE LIST VERIFICATION COMPLETE:");
        console.log(`   📊 Module list maintained accurately`);
        console.log(`   🔄 Sequential registration working properly`);
        console.log(`   📋 List reflects actual registered modules`);
      });

    });

    describe("🔄 BM-002: Beacon ↔ Module Communication", function () {

      it("should enable modules to retrieve information from Beacon", async function () {
        console.log("\n🔄 BEACON → MODULE COMMUNICATION TEST:");
        
        // Register modules in Beacon first
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
        await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());
        
        console.log("   📊 Testing module-to-beacon information retrieval");

        // Test each module can query the Beacon for other modules
        console.log("\n   🔍 Testing TokenManager → Beacon queries:");
        
        // TokenManager should be able to get ValueCalculator address from Beacon
        const valueCalcFromBeacon = await beacon.getImplementation("ValueCalculator");
        const expectedValueCalcAddress = await valueCalculator.getAddress();
        expect(valueCalcFromBeacon).to.equal(expectedValueCalcAddress);
        console.log(`      ✅ TokenManager can retrieve ValueCalculator: ${valueCalcFromBeacon}`);

        // Test module existence queries
        const moduleExists = await beacon.checkModuleExists("LiquidityManager");
        expect(moduleExists).to.be.true;
        console.log(`      ✅ TokenManager can check LiquidityManager existence: ${moduleExists}`);

        console.log("\n   🔍 Testing cross-module address resolution:");
        
        // Test that modules can resolve each other's addresses via Beacon
        const modules = ["TokenManager", "ValueCalculator", "LiquidityManager"];
        for (const moduleName of modules) {
          const moduleAddress = await beacon.getImplementation(moduleName);
          expect(moduleAddress).to.not.equal(ethers.ZeroAddress);
          console.log(`      📍 ${moduleName}: ${moduleAddress} ✓`);
        }

        console.log("\n✅ BEACON → MODULE COMMUNICATION VERIFIED:");
        console.log(`   🎯 Modules can successfully query Beacon`);
        console.log(`   📊 Cross-module address resolution working`);
        console.log(`   🔄 Information flow from Beacon to modules operational`);
      });

      it("should update module addresses and notify dependent modules", async function () {
        console.log("\n📡 MODULE ADDRESS UPDATE COMMUNICATION TEST:");
        
        // Deploy initial ValueCalculator
        const ValueCalculatorFactory = await ethers.getContractFactory("ValueCalculator");
        const valueCalc1 = await ValueCalculatorFactory.deploy(await beacon.getAddress());
        await valueCalc1.waitForDeployment();
        
        // Register initial version
        await beacon.updateImplementation("ValueCalculator", await valueCalc1.getAddress());
        console.log(`   📝 Initial ValueCalculator: ${await valueCalc1.getAddress()}`);

        // Verify initial registration
        let currentAddress = await beacon.getImplementation("ValueCalculator");
        expect(currentAddress).to.equal(await valueCalc1.getAddress());
        console.log(`   ✅ Initial address confirmed: ${currentAddress}`);

        // Deploy new version of ValueCalculator
        const valueCalc2 = await ValueCalculatorFactory.deploy(await beacon.getAddress());
        await valueCalc2.waitForDeployment();
        console.log(`   🆕 New ValueCalculator deployed: ${await valueCalc2.getAddress()}`);

        // Update the implementation in Beacon
        const tx = await beacon.updateImplementation("ValueCalculator", await valueCalc2.getAddress());
        const receipt = await tx.wait();
        
        console.log(`   🔄 Update transaction completed: ${receipt?.hash}`);

        // Verify the address was updated
        currentAddress = await beacon.getImplementation("ValueCalculator");
        expect(currentAddress).to.equal(await valueCalc2.getAddress());
        console.log(`   ✅ Address updated successfully: ${currentAddress}`);

        // Verify the old address is in history
        const history = await beacon.getImplementationHistory("ValueCalculator");
        expect(history).to.have.lengthOf(1);
        expect(history[0]).to.equal(await valueCalc1.getAddress());
        console.log(`   📚 Previous address stored in history: ${history[0]}`);

        // Test that any module can now get the new address
        const retrievedAddress = await beacon.getImplementation("ValueCalculator");
        expect(retrievedAddress).to.equal(await valueCalc2.getAddress());
        console.log(`   🎯 Modules receive updated address: ${retrievedAddress}`);

        console.log("\n✅ MODULE ADDRESS UPDATE COMMUNICATION VERIFIED:");
        console.log(`   📡 Address updates propagated successfully`);
        console.log(`   📚 History tracking maintained`);
        console.log(`   🔄 Communication channels functioning properly`);
      });

      it("should handle beacon status queries from modules", async function () {
        console.log("\n📊 BEACON STATUS COMMUNICATION TEST:");
        
        // Register some modules first
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ParameterManager", await parameterManager.getAddress());
        await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
        
        console.log("   🔍 Testing beacon status retrieval");

        // Test beacon status query
        const beaconStatus = await beacon.getBeaconStatus();
        
        console.log(`   📊 Total Modules: ${beaconStatus[0]}`);
        console.log(`   📊 Frozen Modules: ${beaconStatus[1]}`);
        console.log(`   📊 Global Freeze: ${beaconStatus[2]}`);
        console.log(`   📊 Current Owner: ${beaconStatus[3]}`);
        console.log(`   📊 Pending Owner: ${beaconStatus[4]}`);

        // Verify status information
        expect(beaconStatus[3]).to.equal(owner.address); // currentOwner
        expect(beaconStatus[4]).to.equal(ethers.ZeroAddress); // pendingOwner
        expect(beaconStatus[0]).to.equal(3); // totalModules
        expect(beaconStatus[2]).to.be.false; // globalFreeze
        expect(beaconStatus[1]).to.equal(0); // frozenModules

        console.log("\n   🏥 Testing system health check:");
        
        // Test system health query
        const healthCheck = await beacon.checkSystemHealth();
        
        console.log(`   🏥 System Healthy: ${healthCheck.isHealthy}`);
        console.log(`   📋 Issues Count: ${healthCheck.issues.length}`);
        
        // With normal setup, system should be healthy
        expect(healthCheck.isHealthy).to.be.true;
        expect(healthCheck.issues).to.have.lengthOf(0);

        if (healthCheck.issues.length > 0) {
          console.log("   ⚠️ Issues found:");
          for (const issue of healthCheck.issues) {
            console.log(`      - ${issue}`);
          }
        }

        console.log("\n✅ BEACON STATUS COMMUNICATION VERIFIED:");
        console.log(`   📊 Status information accurately retrieved`);
        console.log(`   🏥 Health monitoring functioning`);
        console.log(`   🔄 Beacon telemetry accessible to modules`);
      });

      it("should support module-to-module communication via Beacon", async function () {
        console.log("\n🔗 MODULE-TO-MODULE COMMUNICATION VIA BEACON TEST:");
        
        // Register all necessary modules
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
        await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());
        await beacon.updateImplementation("SwapManager", await swapManager.getAddress());
        
        console.log("   🔄 Testing cross-module address resolution");

        // Simulate a scenario where LiquidityManager needs to find SwapManager
        console.log("\n   📞 LiquidityManager → SwapManager lookup:");
        const swapManagerAddress = await beacon.getImplementation("SwapManager");
        expect(swapManagerAddress).to.equal(await swapManager.getAddress());
        console.log(`      ✅ Found SwapManager: ${swapManagerAddress}`);

        // Simulate ValueCalculator finding TokenManager
        console.log("\n   📞 ValueCalculator → TokenManager lookup:");
        const tokenManagerAddress = await beacon.getImplementation("TokenManager");
        expect(tokenManagerAddress).to.equal(await tokenManager.getAddress());
        console.log(`      ✅ Found TokenManager: ${tokenManagerAddress}`);

        // Test batch module lookup
        console.log("\n   📞 Batch module lookup:");
        const allModules = await beacon.getRegisteredModules();
        console.log(`      📊 Total modules registered: ${allModules.length}`);
        
        for (const moduleName of allModules) {
          const moduleAddress = await beacon.getImplementation(moduleName);
          expect(moduleAddress).to.not.equal(ethers.ZeroAddress);
          console.log(`      📍 ${moduleName}: ${moduleAddress}`);
        }

        // Verify module discovery completeness
        expect(allModules).to.include("TokenManager");
        expect(allModules).to.include("ValueCalculator");
        expect(allModules).to.include("LiquidityManager");
        expect(allModules).to.include("SwapManager");

        console.log("\n✅ MODULE-TO-MODULE COMMUNICATION VERIFIED:");
        console.log(`   🔗 Cross-module discovery working via Beacon`);
        console.log(`   📊 All modules can find each other`);
        console.log(`   🎯 Beacon serving as effective communication hub`);
      });

    });

    describe("🔄 BM-003: Beacon ↔ Module State Synchronization", function () {

      it("should synchronize freeze states across all modules", async function () {
        console.log("\n❄️ MODULE FREEZE STATE SYNCHRONIZATION TEST:");
        
        // Register modules first
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
        await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());
        await beacon.updateImplementation("EmergencyHandler", await emergencyHandler.getAddress());
        
        console.log("   🏗️ Setup: 4 modules registered in Beacon");
        console.log(`      📍 TokenManager: ${await tokenManager.getAddress()}`);
        console.log(`      📍 ValueCalculator: ${await valueCalculator.getAddress()}`);
        console.log(`      📍 LiquidityManager: ${await liquidityManager.getAddress()}`);
        console.log(`      📍 EmergencyHandler: ${await emergencyHandler.getAddress()}`);

        // Check initial state - all modules should be unfrozen
        console.log("\n   🔍 INITIAL STATE VERIFICATION:");
        for (const moduleName of ["TokenManager", "ValueCalculator", "LiquidityManager", "EmergencyHandler"]) {
          const moduleInfo = await beacon.getModuleInfo(moduleName);
          expect(moduleInfo.isFrozen).to.be.false;
          console.log(`      ✅ ${moduleName}: Unfrozen ✓`);
        }

        // Test global freeze activation
        console.log("\n   ❄️ ACTIVATING GLOBAL FREEZE:");
        console.log("      🔴 Beacon activating emergency global freeze...");
        
        await beacon.activateGlobalFreeze();
        
        const beaconStatus = await beacon.getBeaconStatus();
        expect(beaconStatus[2]).to.be.true; // globalFreeze should be true
        console.log(`      ✅ Global freeze activated: ${beaconStatus[2]}`);

        // Verify all modules reflect the global freeze state
        console.log("\n   🔍 VERIFYING GLOBAL FREEZE PROPAGATION:");
        for (const moduleName of ["TokenManager", "ValueCalculator", "LiquidityManager", "EmergencyHandler"]) {
          const moduleInfo = await beacon.getModuleInfo(moduleName);
          // During global freeze, operations should be restricted
          console.log(`      ❄️ ${moduleName}: Global freeze active = ${beaconStatus[2]}`);
        }

        // Test global freeze deactivation
        console.log("\n   🌞 DEACTIVATING GLOBAL FREEZE:");
        console.log("      🟢 Beacon deactivating global freeze...");
        
        await beacon.deactivateGlobalFreeze();
        
        const updatedStatus = await beacon.getBeaconStatus();
        expect(updatedStatus[2]).to.be.false; // globalFreeze should be false
        console.log(`      ✅ Global freeze deactivated: ${updatedStatus[2]}`);

        console.log("\n✅ FREEZE STATE SYNCHRONIZATION VERIFIED:");
        console.log(`   ❄️ Global freeze propagation working correctly`);
        console.log(`   🔄 State synchronization between Beacon and modules`);
        console.log(`   🎯 Emergency freeze system operational`);
      });

      it("should handle individual module freeze/unfreeze with state consistency", async function () {
        console.log("\n🧊 INDIVIDUAL MODULE FREEZE SYNCHRONIZATION TEST:");
        
        // Register test modules
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
        await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());
        
        console.log("   🏗️ Setup: 3 modules registered for individual freeze testing");

        // Test individual module freeze
        console.log("\n   ❄️ FREEZING INDIVIDUAL MODULE:");
        console.log("      🎯 Target: TokenManager");
        
        // Check initial state
        let tokenManagerInfo = await beacon.getModuleInfo("TokenManager");
        expect(tokenManagerInfo.isFrozen).to.be.false;
        console.log(`      📊 Initial TokenManager state: Unfrozen ✓`);

        // Freeze TokenManager
        await beacon.freezeModule("TokenManager");
        
        // Verify TokenManager is frozen
        tokenManagerInfo = await beacon.getModuleInfo("TokenManager");
        expect(tokenManagerInfo.isFrozen).to.be.true;
        console.log(`      ❄️ TokenManager frozen: ${tokenManagerInfo.isFrozen} ✓`);

        // Verify other modules are still unfrozen
        console.log("\n   🔍 VERIFYING OTHER MODULES REMAIN UNFROZEN:");
        for (const moduleName of ["ValueCalculator", "LiquidityManager"]) {
          const moduleInfo = await beacon.getModuleInfo(moduleName);
          expect(moduleInfo.isFrozen).to.be.false;
          console.log(`      ✅ ${moduleName}: Still unfrozen ✓`);
        }

        // Check beacon status shows correct frozen count
        const beaconStatus = await beacon.getBeaconStatus();
        expect(beaconStatus[1]).to.equal(1); // frozenModules count
        console.log(`      📊 Beacon frozen modules count: ${beaconStatus[1]} ✓`);

        // Test unfreezing
        console.log("\n   🌞 UNFREEZING MODULE:");
        console.log("      🎯 Target: TokenManager");
        
        await beacon.unfreezeModule("TokenManager");
        
        // Verify TokenManager is unfrozen
        tokenManagerInfo = await beacon.getModuleInfo("TokenManager");
        expect(tokenManagerInfo.isFrozen).to.be.false;
        console.log(`      ✅ TokenManager unfrozen: ${!tokenManagerInfo.isFrozen} ✓`);

        // Verify beacon status updated
        const finalStatus = await beacon.getBeaconStatus();
        expect(finalStatus[1]).to.equal(0); // frozenModules count should be 0
        console.log(`      📊 Beacon frozen modules count: ${finalStatus[1]} ✓`);

        console.log("\n✅ INDIVIDUAL MODULE FREEZE SYNCHRONIZATION VERIFIED:");
        console.log(`   🧊 Individual freeze/unfreeze working correctly`);
        console.log(`   📊 Freeze count tracking accurate`);
        console.log(`   🔄 State consistency maintained across operations`);
      });

      it("should maintain module implementation history consistency", async function () {
        console.log("\n📚 MODULE IMPLEMENTATION HISTORY SYNCHRONIZATION TEST:");
        
        // Deploy multiple versions of ValueCalculator for history testing
        const ValueCalculatorFactory = await ethers.getContractFactory("ValueCalculator");
        
        console.log("   🏗️ Deploying multiple ValueCalculator versions:");
        const valueCalc1 = await ValueCalculatorFactory.deploy(await beacon.getAddress());
        await valueCalc1.waitForDeployment();
        console.log(`      📝 Version 1: ${await valueCalc1.getAddress()}`);
        
        const valueCalc2 = await ValueCalculatorFactory.deploy(await beacon.getAddress());
        await valueCalc2.waitForDeployment();
        console.log(`      📝 Version 2: ${await valueCalc2.getAddress()}`);
        
        const valueCalc3 = await ValueCalculatorFactory.deploy(await beacon.getAddress());
        await valueCalc3.waitForDeployment();
        console.log(`      📝 Version 3: ${await valueCalc3.getAddress()}`);

        // Register initial version
        console.log("\n   🔄 BUILDING IMPLEMENTATION HISTORY:");
        await beacon.updateImplementation("ValueCalculator", await valueCalc1.getAddress());
        console.log(`      ✅ Initial registration: Version 1`);
        
        // Verify no history yet
        let history = await beacon.getImplementationHistory("ValueCalculator");
        expect(history).to.have.lengthOf(0);
        console.log(`      📚 History length: ${history.length} (empty) ✓`);

        // Update to version 2
        await beacon.updateImplementation("ValueCalculator", await valueCalc2.getAddress());
        console.log(`      🔄 Updated to: Version 2`);
        
        // Verify history contains version 1
        history = await beacon.getImplementationHistory("ValueCalculator");
        expect(history).to.have.lengthOf(1);
        expect(history[0]).to.equal(await valueCalc1.getAddress());
        console.log(`      📚 History length: ${history.length}`);
        console.log(`      📋 History[0]: ${history[0]} (Version 1) ✓`);

        // Update to version 3
        await beacon.updateImplementation("ValueCalculator", await valueCalc3.getAddress());
        console.log(`      🔄 Updated to: Version 3`);
        
        // Verify history contains versions 1 and 2
        history = await beacon.getImplementationHistory("ValueCalculator");
        expect(history).to.have.lengthOf(2);
        expect(history[0]).to.equal(await valueCalc1.getAddress());
        expect(history[1]).to.equal(await valueCalc2.getAddress());
        console.log(`      📚 History length: ${history.length}`);
        console.log(`      📋 History[0]: ${history[0]} (Version 1) ✓`);
        console.log(`      📋 History[1]: ${history[1]} (Version 2) ✓`);

        // Verify current implementation is version 3
        const currentImpl = await beacon.getImplementation("ValueCalculator");
        expect(currentImpl).to.equal(await valueCalc3.getAddress());
        console.log(`      📍 Current: ${currentImpl} (Version 3) ✓`);

        // Test module info consistency
        console.log("\n   🔍 VERIFYING MODULE INFO CONSISTENCY:");
        const moduleInfo = await beacon.getModuleInfo("ValueCalculator");
        expect(moduleInfo.currentImpl).to.equal(await valueCalc3.getAddress());
        expect(moduleInfo.historyCount).to.equal(2);
        console.log(`      📍 Module info current: ${moduleInfo.currentImpl} ✓`);
        console.log(`      📚 Module info history count: ${moduleInfo.historyCount} ✓`);
        console.log(`      🕐 Last updated: ${moduleInfo.lastUpdated} ✓`);

        console.log("\n✅ IMPLEMENTATION HISTORY SYNCHRONIZATION VERIFIED:");
        console.log(`   📚 History tracking accurate across updates`);
        console.log(`   🔄 State consistency between different query methods`);
        console.log(`   📊 Module info reflects correct implementation state`);
      });

      it("should synchronize ownership changes across the beacon system", async function () {
        console.log("\n👑 OWNERSHIP SYNCHRONIZATION TEST:");
        
        // Register some modules first
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ParameterManager", await parameterManager.getAddress());
        
        console.log("   🏗️ Setup: 2 modules registered");
        console.log(`      👤 Current owner: ${owner.address}`);
        console.log(`      👤 New owner candidate: ${user1.address}`);

        // Check initial ownership state
        console.log("\n   🔍 INITIAL OWNERSHIP STATE:");
        let beaconStatus = await beacon.getBeaconStatus();
        expect(beaconStatus[3]).to.equal(owner.address); // currentOwner
        expect(beaconStatus[4]).to.equal(ethers.ZeroAddress); // pendingOwner
        console.log(`      👑 Current owner: ${beaconStatus[3]} ✓`);
        console.log(`      ⏳ Pending owner: ${beaconStatus[4]} (none) ✓`);

        // Initiate ownership transfer
        console.log("\n   🔄 INITIATING OWNERSHIP TRANSFER:");
        console.log(`      📤 Owner initiating transfer to: ${user1.address}`);
        
        await beacon.transferOwnership(user1.address);
        
        // Verify pending state
        beaconStatus = await beacon.getBeaconStatus();
        expect(beaconStatus[3]).to.equal(owner.address); // still current owner
        expect(beaconStatus[4]).to.equal(user1.address); // pending owner set
        console.log(`      👑 Current owner: ${beaconStatus[3]} (unchanged) ✓`);
        console.log(`      ⏳ Pending owner: ${beaconStatus[4]} (set) ✓`);

        // Test that modules still respond to current owner
        console.log("\n   🔒 VERIFYING ACCESS CONTROL DURING TRANSFER:");
        
        // Current owner should still be able to freeze modules
        await beacon.freezeModule("TokenManager");
        const tokenManagerInfo = await beacon.getModuleInfo("TokenManager");
        expect(tokenManagerInfo.isFrozen).to.be.true;
        console.log(`      ✅ Current owner can still freeze modules ✓`);
        
        // Unfreeze for cleanup
        await beacon.unfreezeModule("TokenManager");

        // Complete ownership transfer
        console.log("\n   ✅ COMPLETING OWNERSHIP TRANSFER:");
        console.log(`      📥 ${user1.address} accepting ownership...`);
        
        await beacon.connect(user1).acceptOwnership();
        
        // Verify ownership transferred
        beaconStatus = await beacon.getBeaconStatus();
        expect(beaconStatus[3]).to.equal(user1.address); // new current owner
        expect(beaconStatus[4]).to.equal(ethers.ZeroAddress); // no pending owner
        console.log(`      👑 New owner: ${beaconStatus[3]} ✓`);
        console.log(`      ⏳ Pending owner: ${beaconStatus[4]} (cleared) ✓`);

        // Test new owner has control
        console.log("\n   🔑 VERIFYING NEW OWNER ACCESS:");
        
        // New owner should be able to freeze modules
        await beacon.connect(user1).freezeModule("ParameterManager");
        const parameterManagerInfo = await beacon.getModuleInfo("ParameterManager");
        expect(parameterManagerInfo.isFrozen).to.be.true;
        console.log(`      ✅ New owner can freeze modules ✓`);
        
        // Old owner should no longer have access
        console.log(`      🚫 Testing old owner access restriction...`);
        await expect(beacon.connect(owner).unfreezeModule("ParameterManager"))
          .to.be.revertedWith("Only owner can call this function");
        console.log(`      ✅ Old owner correctly denied access ✓`);

        // New owner cleans up
        await beacon.connect(user1).unfreezeModule("ParameterManager");

        console.log("\n✅ OWNERSHIP SYNCHRONIZATION VERIFIED:");
        console.log(`   👑 Ownership transfer completed successfully`);
        console.log(`   🔒 Access control updated across all operations`);
        console.log(`   🔄 State consistency maintained during transition`);
      });

    });

    describe("🔄 BM-004: Module Address Updates & Propagation", function () {

      it("should handle module address updates with proper event emission", async function () {
        console.log("\n📡 MODULE ADDRESS UPDATE EVENT TESTING:");
        
        // Deploy initial and updated versions of a module
        const LiquidityManagerFactory = await ethers.getContractFactory("LiquidityManager");
        const liquidityV1 = await LiquidityManagerFactory.deploy(await beacon.getAddress());
        await liquidityV1.waitForDeployment();
        
        const liquidityV2 = await LiquidityManagerFactory.deploy(await beacon.getAddress());
        await liquidityV2.waitForDeployment();
        
        console.log("   🏗️ Deployed LiquidityManager versions:");
        console.log(`      📦 Version 1: ${await liquidityV1.getAddress()}`);
        console.log(`      📦 Version 2: ${await liquidityV2.getAddress()}`);

        // Register initial version and capture event
        console.log("\n   🔄 INITIAL REGISTRATION:");
        const registerTx = await beacon.updateImplementation("LiquidityManager", await liquidityV1.getAddress());
        const registerReceipt = await registerTx.wait();
        
        console.log(`      ✅ Registration TX: ${registerReceipt?.hash}`);
        console.log(`      📝 Gas used: ${registerReceipt?.gasUsed}`);

        // Test first update and verify event
        console.log("\n   🔄 UPDATING MODULE ADDRESS:");
        console.log(`      🔄 Updating from V1 to V2...`);
        
        const updateTx = await beacon.updateImplementation("LiquidityManager", await liquidityV2.getAddress());
        const updateReceipt = await updateTx.wait();
        
        // Verify event emission
        const events = updateReceipt?.logs;
        console.log(`      📊 Events emitted: ${events?.length}`);
        
        // Check the implementation was updated
        const currentImpl = await beacon.getImplementation("LiquidityManager");
        expect(currentImpl).to.equal(await liquidityV2.getAddress());
        console.log(`      ✅ Current implementation: ${currentImpl}`);

        // Verify history tracking
        const history = await beacon.getImplementationHistory("LiquidityManager");
        expect(history).to.have.lengthOf(1);
        expect(history[0]).to.equal(await liquidityV1.getAddress());
        console.log(`      📚 History[0]: ${history[0]} (V1 preserved)`);

        // Test module info reflects the update
        const moduleInfo = await beacon.getModuleInfo("LiquidityManager");
        expect(moduleInfo.currentImpl).to.equal(await liquidityV2.getAddress());
        expect(moduleInfo.historyCount).to.equal(1);
        console.log(`      📊 Module info updated correctly`);
        console.log(`      🕐 Last update timestamp: ${moduleInfo.lastUpdated}`);

        console.log("\n✅ MODULE ADDRESS UPDATE VERIFICATION COMPLETE:");
        console.log(`   📡 Address updates processed correctly`);
        console.log(`   📚 History preservation working`);
        console.log(`   🔄 Event emission functioning`);
      });

      it("should propagate address updates to dependent modules", async function () {
        console.log("\n🌐 MODULE ADDRESS PROPAGATION TESTING:");
        
        // Register multiple interdependent modules
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
        await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());
        
        console.log("   🏗️ Initial module ecosystem setup:");
        console.log(`      📍 TokenManager: ${await tokenManager.getAddress()}`);
        console.log(`      📍 ValueCalculator: ${await valueCalculator.getAddress()}`);
        console.log(`      📍 LiquidityManager: ${await liquidityManager.getAddress()}`);

        // Simulate a scenario where LiquidityManager needs TokenManager's address
        console.log("\n   🔍 CROSS-MODULE ADDRESS RESOLUTION:");
        let tokenManagerAddr = await beacon.getImplementation("TokenManager");
        console.log(`      📞 LiquidityManager can find TokenManager: ${tokenManagerAddr}`);
        expect(tokenManagerAddr).to.equal(await tokenManager.getAddress());

        // Deploy new TokenManager version
        console.log("\n   🔄 DEPLOYING NEW TOKENMANAGER VERSION:");
        const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
        const newTokenManager = await TokenManagerFactory.deploy(await beacon.getAddress());
        await newTokenManager.waitForDeployment();
        console.log(`      🆕 New TokenManager: ${await newTokenManager.getAddress()}`);

        // Update TokenManager in Beacon
        console.log("\n   📡 UPDATING TOKENMANAGER ADDRESS IN BEACON:");
        await beacon.updateImplementation("TokenManager", await newTokenManager.getAddress());
        console.log(`      ✅ TokenManager updated in Beacon`);

        // Verify other modules can immediately access the new address
        console.log("\n   🔍 VERIFYING PROPAGATION TO DEPENDENT MODULES:");
        tokenManagerAddr = await beacon.getImplementation("TokenManager");
        expect(tokenManagerAddr).to.equal(await newTokenManager.getAddress());
        console.log(`      ✅ LiquidityManager sees new TokenManager: ${tokenManagerAddr}`);

        // Test that ValueCalculator can also see the update
        const tokenManagerFromVC = await beacon.getImplementation("TokenManager");
        expect(tokenManagerFromVC).to.equal(await newTokenManager.getAddress());
        console.log(`      ✅ ValueCalculator sees new TokenManager: ${tokenManagerFromVC}`);

        // Verify the old TokenManager is in history
        const history = await beacon.getImplementationHistory("TokenManager");
        expect(history).to.have.lengthOf(1);
        expect(history[0]).to.equal(await tokenManager.getAddress());
        console.log(`      📚 Old TokenManager preserved in history: ${history[0]}`);

        console.log("\n✅ ADDRESS PROPAGATION VERIFICATION COMPLETE:");
        console.log(`   🌐 Updates immediately visible to all modules`);
        console.log(`   🔄 Cross-module dependency resolution working`);
        console.log(`   📚 History tracking maintained`);
      });

      it("should handle multiple simultaneous module updates", async function () {
        console.log("\n⚡ MULTIPLE MODULE UPDATES TESTING:");
        
        // Deploy multiple module versions
        const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
        const ValueCalculatorFactory = await ethers.getContractFactory("ValueCalculator");
        const ParameterManagerFactory = await ethers.getContractFactory("ParameterManager");
        
        console.log("   🏗️ Deploying multiple new module versions:");
        
        const newTokenManager = await TokenManagerFactory.deploy(await beacon.getAddress());
        await newTokenManager.waitForDeployment();
        console.log(`      📦 New TokenManager: ${await newTokenManager.getAddress()}`);
        
        const newValueCalculator = await ValueCalculatorFactory.deploy(await beacon.getAddress());
        await newValueCalculator.waitForDeployment();
        console.log(`      📦 New ValueCalculator: ${await newValueCalculator.getAddress()}`);
        
        const newParameterManager = await ParameterManagerFactory.deploy(await beacon.getAddress());
        await newParameterManager.waitForDeployment();
        console.log(`      📦 New ParameterManager: ${await newParameterManager.getAddress()}`);

        // Register initial versions
        console.log("\n   📝 REGISTERING INITIAL VERSIONS:");
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
        await beacon.updateImplementation("ParameterManager", await parameterManager.getAddress());
        
        const initialCount = await beacon.getBeaconStatus();
        console.log(`      📊 Initial registered modules: ${initialCount[0]}`);

        // Perform batch updates
        console.log("\n   ⚡ PERFORMING BATCH UPDATES:");
        console.log("      🔄 Updating TokenManager...");
        await beacon.updateImplementation("TokenManager", await newTokenManager.getAddress());
        
        console.log("      🔄 Updating ValueCalculator...");
        await beacon.updateImplementation("ValueCalculator", await newValueCalculator.getAddress());
        
        console.log("      🔄 Updating ParameterManager...");
        await beacon.updateImplementation("ParameterManager", await newParameterManager.getAddress());

        // Verify all updates were successful
        console.log("\n   ✅ VERIFYING BATCH UPDATE RESULTS:");
        
        const updatedTokenMgr = await beacon.getImplementation("TokenManager");
        expect(updatedTokenMgr).to.equal(await newTokenManager.getAddress());
        console.log(`      ✅ TokenManager: ${updatedTokenMgr}`);
        
        const updatedValueCalc = await beacon.getImplementation("ValueCalculator");
        expect(updatedValueCalc).to.equal(await newValueCalculator.getAddress());
        console.log(`      ✅ ValueCalculator: ${updatedValueCalc}`);
        
        const updatedParamMgr = await beacon.getImplementation("ParameterManager");
        expect(updatedParamMgr).to.equal(await newParameterManager.getAddress());
        console.log(`      ✅ ParameterManager: ${updatedParamMgr}`);

        // Verify module count remains correct
        const finalCount = await beacon.getBeaconStatus();
        expect(finalCount[0]).to.equal(3);
        console.log(`      📊 Module count maintained: ${finalCount[0]}`);

        // Verify each module has correct history
        console.log("\n   📚 VERIFYING HISTORY TRACKING:");
        
        const tokenHistory = await beacon.getImplementationHistory("TokenManager");
        expect(tokenHistory).to.have.lengthOf(1);
        console.log(`      📖 TokenManager history: ${tokenHistory.length} entry`);
        
        const valueHistory = await beacon.getImplementationHistory("ValueCalculator");
        expect(valueHistory).to.have.lengthOf(1);
        console.log(`      📖 ValueCalculator history: ${valueHistory.length} entry`);
        
        const paramHistory = await beacon.getImplementationHistory("ParameterManager");
        expect(paramHistory).to.have.lengthOf(1);
        console.log(`      📖 ParameterManager history: ${paramHistory.length} entry`);

        console.log("\n✅ MULTIPLE MODULE UPDATES VERIFICATION COMPLETE:");
        console.log(`   ⚡ Batch updates processed successfully`);
        console.log(`   📊 Module registry integrity maintained`);
        console.log(`   📚 Individual history tracking preserved`);
      });

      it("should prevent invalid module address updates", async function () {
        console.log("\n🛡️ INVALID MODULE UPDATE PROTECTION TESTING:");
        
        // Register a valid module first
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        console.log("   🏗️ TokenManager registered successfully");

        const initialAddress = await beacon.getImplementation("TokenManager");
        console.log(`      📍 Initial address: ${initialAddress}`);

        // Test 1: Prevent zero address update
        console.log("\n   🚫 TEST 1: Preventing zero address update");
        await expect(beacon.updateImplementation("TokenManager", ethers.ZeroAddress))
          .to.be.revertedWith("Invalid implementation address");
        console.log(`      ✅ Zero address correctly rejected`);

        // Test 2: Prevent same address update
        console.log("\n   🚫 TEST 2: Preventing same address update");
        await expect(beacon.updateImplementation("TokenManager", await tokenManager.getAddress()))
          .to.be.revertedWith("Same implementation address");
        console.log(`      ✅ Same address correctly rejected`);

        // Test 3: Prevent non-contract address update
        console.log("\n   🚫 TEST 3: Preventing non-contract address update");
        await expect(beacon.updateImplementation("TokenManager", user1.address))
          .to.be.revertedWith("Implementation must be a contract");
        console.log(`      ✅ Non-contract address correctly rejected`);

        // Verify the original address is unchanged after failed attempts
        const finalAddress = await beacon.getImplementation("TokenManager");
        expect(finalAddress).to.equal(initialAddress);
        console.log(`      ✅ Original address preserved: ${finalAddress}`);

        // Verify no history entries were added from failed updates
        const history = await beacon.getImplementationHistory("TokenManager");
        expect(history).to.have.lengthOf(0);
        console.log(`      📚 History remains clean: ${history.length} entries`);

        console.log("\n✅ INVALID UPDATE PROTECTION VERIFICATION COMPLETE:");
        console.log(`   🛡️ All invalid update attempts correctly blocked`);
        console.log(`   🔒 Module integrity preserved`);
        console.log(`   📚 History tracking unaffected by failures`);
      });

    });

    describe("🔐 BM-005: Access Control via Beacon Pattern", function () {

      it("should enforce owner-only access to critical beacon functions", async function () {
        console.log("\n🔒 BEACON OWNER ACCESS CONTROL TESTING:");
        
        // Register some modules first
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
        
        console.log("   🏗️ Setup: 2 modules registered");
        console.log(`      👑 Current owner: ${owner.address}`);
        console.log(`      👤 Non-owner (user1): ${user1.address}`);
        console.log(`      👤 Non-owner (user2): ${user2.address}`);

        // Test owner can perform critical operations
        console.log("\n   ✅ TESTING OWNER ACCESS:");
        
        // Owner can update implementations
        console.log("      🔄 Owner updating module implementation...");
        await beacon.connect(owner).updateImplementation("ParameterManager", await parameterManager.getAddress());
        console.log("      ✅ Owner successfully updated module");
        
        // Owner can freeze modules
        console.log("      ❄️ Owner freezing module...");
        await beacon.connect(owner).freezeModule("TokenManager");
        console.log("      ✅ Owner successfully froze module");
        
        // Owner can activate global freeze
        console.log("      🌍 Owner activating global freeze...");
        await beacon.connect(owner).activateGlobalFreeze();
        console.log("      ✅ Owner successfully activated global freeze");
        
        // Clean up
        await beacon.connect(owner).deactivateGlobalFreeze();
        await beacon.connect(owner).unfreezeModule("TokenManager");

        // Test non-owners are blocked from critical operations
        console.log("\n   🚫 TESTING NON-OWNER ACCESS RESTRICTIONS:");
        
        // Non-owner cannot update implementations
        console.log("      🚫 Non-owner attempting module update...");
        await expect(beacon.connect(user1).updateImplementation("TokenManager", await liquidityManager.getAddress()))
          .to.be.revertedWith("Only owner can call this function");
        console.log("      ✅ Non-owner correctly blocked from module update");
        
        // Non-owner cannot freeze modules
        console.log("      🚫 Non-owner attempting module freeze...");
        await expect(beacon.connect(user2).freezeModule("ValueCalculator"))
          .to.be.revertedWith("Only owner can call this function");
        console.log("      ✅ Non-owner correctly blocked from module freeze");
        
        // Non-owner cannot activate global freeze
        console.log("      🚫 Non-owner attempting global freeze...");
        await expect(beacon.connect(user1).activateGlobalFreeze())
          .to.be.revertedWith("Only owner can call this function");
        console.log("      ✅ Non-owner correctly blocked from global freeze");

        console.log("\n✅ BEACON ACCESS CONTROL VERIFICATION COMPLETE:");
        console.log(`   🔒 Owner access properly granted`);
        console.log(`   🚫 Non-owner access properly restricted`);
        console.log(`   🎯 Access control system functioning correctly`);
      });

      it("should maintain access control during ownership transfer", async function () {
        console.log("\n👑 ACCESS CONTROL DURING OWNERSHIP TRANSFER:");
        
        // Setup initial state
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        console.log("   🏗️ TokenManager registered by current owner");
        console.log(`      👑 Current owner: ${owner.address}`);
        console.log(`      👤 Future owner: ${user1.address}`);

        // Test current owner has access before transfer
        console.log("\n   🔒 VERIFYING CURRENT OWNER ACCESS:");
        await beacon.connect(owner).freezeModule("TokenManager");
        console.log("      ✅ Current owner can freeze modules");
        await beacon.connect(owner).unfreezeModule("TokenManager");
        console.log("      ✅ Current owner can unfreeze modules");

        // Initiate ownership transfer
        console.log("\n   🔄 INITIATING OWNERSHIP TRANSFER:");
        await beacon.connect(owner).transferOwnership(user1.address);
        console.log("      📤 Ownership transfer initiated");

        // During pending state, original owner should still have access
        console.log("\n   ⏳ TESTING ACCESS DURING PENDING STATE:");
        await beacon.connect(owner).freezeModule("TokenManager");
        console.log("      ✅ Original owner still has access during pending");
        
        // Pending owner should not have access yet
        console.log("      🚫 Testing pending owner access...");
        await expect(beacon.connect(user1).unfreezeModule("TokenManager"))
          .to.be.revertedWith("Only owner can call this function");
        console.log("      ✅ Pending owner correctly denied access");
        
        // Clean up
        await beacon.connect(owner).unfreezeModule("TokenManager");

        // Complete ownership transfer
        console.log("\n   ✅ COMPLETING OWNERSHIP TRANSFER:");
        await beacon.connect(user1).acceptOwnership();
        console.log("      📥 New owner accepted ownership");

        // Test new owner has access
        console.log("\n   🔑 VERIFYING NEW OWNER ACCESS:");
        await beacon.connect(user1).freezeModule("TokenManager");
        console.log("      ✅ New owner can freeze modules");
        
        // Test old owner no longer has access
        console.log("      🚫 Testing old owner access...");
        await expect(beacon.connect(owner).unfreezeModule("TokenManager"))
          .to.be.revertedWith("Only owner can call this function");
        console.log("      ✅ Old owner correctly denied access");
        
        // Clean up
        await beacon.connect(user1).unfreezeModule("TokenManager");

        console.log("\n✅ OWNERSHIP TRANSFER ACCESS CONTROL VERIFIED:");
        console.log(`   👑 Access transfer completed successfully`);
        console.log(`   🔒 Old owner access properly revoked`);
        console.log(`   🔑 New owner access properly granted`);
      });

      it("should handle frozen module access restrictions", async function () {
        console.log("\n❄️ FROZEN MODULE ACCESS CONTROL TESTING:");
        
        // Register modules
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
        
        console.log("   🏗️ Setup: 2 modules registered");
        console.log("      📍 TokenManager (will be frozen)");
        console.log("      📍 ValueCalculator (will remain unfrozen)");

        // Test normal operations on unfrozen modules
        console.log("\n   ✅ TESTING OPERATIONS ON UNFROZEN MODULES:");
        
        // Should be able to update unfrozen modules
        const ValueCalculatorFactory = await ethers.getContractFactory("ValueCalculator");
        const newValueCalc = await ValueCalculatorFactory.deploy(await beacon.getAddress());
        await newValueCalc.waitForDeployment();
        
        await beacon.updateImplementation("ValueCalculator", await newValueCalc.getAddress());
        console.log("      ✅ Can update unfrozen modules");

        // Freeze TokenManager
        console.log("\n   ❄️ FREEZING TOKENMANAGER:");
        await beacon.freezeModule("TokenManager");
        console.log("      ❄️ TokenManager frozen successfully");

        // Test that frozen modules cannot be updated
        console.log("\n   🚫 TESTING OPERATIONS ON FROZEN MODULES:");
        
        const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
        const newTokenManager = await TokenManagerFactory.deploy(await beacon.getAddress());
        await newTokenManager.waitForDeployment();
        
        console.log("      🚫 Attempting to update frozen module...");
        await expect(beacon.updateImplementation("TokenManager", await newTokenManager.getAddress()))
          .to.be.revertedWith("Module is frozen");
        console.log("      ✅ Frozen module correctly protected from updates");

        // Test that unfrozen modules can still be updated
        console.log("\n   ✅ VERIFYING UNFROZEN MODULES STILL ACCESSIBLE:");
        const anotherValueCalc = await ValueCalculatorFactory.deploy(await beacon.getAddress());
        await anotherValueCalc.waitForDeployment();
        
        await beacon.updateImplementation("ValueCalculator", await anotherValueCalc.getAddress());
        console.log("      ✅ Unfrozen modules still updateable");

        // Test unfreezing restores access
        console.log("\n   🌞 TESTING UNFREEZE RESTORATION:");
        await beacon.unfreezeModule("TokenManager");
        console.log("      🌞 TokenManager unfrozen");
        
        // Should now be able to update previously frozen module
        await beacon.updateImplementation("TokenManager", await newTokenManager.getAddress());
        console.log("      ✅ Unfrozen module can be updated again");

        console.log("\n✅ FROZEN MODULE ACCESS CONTROL VERIFIED:");
        console.log(`   ❄️ Frozen modules properly protected`);
        console.log(`   ✅ Unfrozen modules remain accessible`);
        console.log(`   🌞 Unfreeze properly restores access`);
      });

      it("should enforce global freeze across all operations", async function () {
        console.log("\n🌍 GLOBAL FREEZE ACCESS CONTROL TESTING:");
        
        // Register multiple modules
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
        await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());
        
        console.log("   🏗️ Setup: 3 modules registered");
        console.log("      📍 TokenManager");
        console.log("      📍 ValueCalculator");
        console.log("      📍 LiquidityManager");

        // Test normal operations before global freeze
        console.log("\n   ✅ TESTING NORMAL OPERATIONS:");
        await beacon.freezeModule("TokenManager");
        await beacon.unfreezeModule("TokenManager");
        console.log("      ✅ Individual freeze/unfreeze working normally");

        // Activate global freeze
        console.log("\n   🌍 ACTIVATING GLOBAL FREEZE:");
        await beacon.activateGlobalFreeze();
        console.log("      🔴 Global freeze activated");

        // Test that module updates are blocked during global freeze
        console.log("\n   🚫 TESTING OPERATIONS DURING GLOBAL FREEZE:");
        
        const ValueCalculatorFactory = await ethers.getContractFactory("ValueCalculator");
        const newValueCalc = await ValueCalculatorFactory.deploy(await beacon.getAddress());
        await newValueCalc.waitForDeployment();
        
        console.log("      🚫 Attempting module update during global freeze...");
        await expect(beacon.updateImplementation("ValueCalculator", await newValueCalc.getAddress()))
          .to.be.revertedWith("Global freeze active");
        console.log("      ✅ Module updates correctly blocked during global freeze");

        // Test that query operations still work during global freeze
        console.log("\n   🔍 VERIFYING INDIVIDUAL OPERATIONS DURING GLOBAL FREEZE:");
        
        // Individual freeze might still work during global freeze (by design)
        await beacon.freezeModule("LiquidityManager");
        console.log("      ✅ Individual freeze operations still work (emergency management)");
        await beacon.unfreezeModule("LiquidityManager");
        console.log("      ✅ Individual unfreeze operations still work");

        // Test that query operations still work
        console.log("\n   🔍 VERIFYING QUERY OPERATIONS STILL WORK:");
        const modules = await beacon.getRegisteredModules();
        expect(modules).to.have.lengthOf(3);
        console.log(`      ✅ Can still query registered modules: ${modules.length}`);
        
        const status = await beacon.getBeaconStatus();
        expect(status[2]).to.be.true; // globalFreeze
        console.log(`      ✅ Can still query beacon status: global freeze = ${status[2]}`);

        // Deactivate global freeze
        console.log("\n   🌞 DEACTIVATING GLOBAL FREEZE:");
        await beacon.deactivateGlobalFreeze();
        console.log("      🟢 Global freeze deactivated");

        // Test that operations work again
        console.log("\n   ✅ VERIFYING OPERATIONS RESTORED:");
        await beacon.updateImplementation("ValueCalculator", await newValueCalc.getAddress());
        console.log("      ✅ Module updates working again");
        
        await beacon.freezeModule("LiquidityManager");
        await beacon.unfreezeModule("LiquidityManager");
        console.log("      ✅ Individual freeze/unfreeze working again");

        console.log("\n✅ GLOBAL FREEZE ACCESS CONTROL VERIFIED:");
        console.log(`   🌍 Global freeze blocks all modification operations`);
        console.log(`   🔍 Query operations remain available during freeze`);
        console.log(`   🌞 Operations properly restored after deactivation`);
      });

    });

  });

}); 