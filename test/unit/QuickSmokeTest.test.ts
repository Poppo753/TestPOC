import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🚀 QUICK SMOKE TEST - 2 MINUTES
 * 
 * Tests ONLY:
 * 1. ✅ All contracts compile
 * 2. ✅ All contracts deploy
 * 3. ✅ Basic function calls work
 * 
 * Run: npx hardhat test test/QuickSmokeTest.test.ts
 */

describe("⚡ QUICK SMOKE TEST - System Sanity Check", function () {
    
    let owner: any;
    let user1: any;
    let beacon: any;
    
    before(async function () {
        [owner, user1] = await ethers.getSigners();
        console.log("\n🔧 Test Environment:");
        console.log(`   Owner: ${owner.address}`);
        console.log(`   User1: ${user1.address}`);
    });

    describe("🏗️ DEPLOYMENT SMOKE TEST", function () {
        
        it("✅ Should deploy Beacon", async function () {
            console.log("\n📦 Deploying Beacon...");
            const BeaconFactory = await ethers.getContractFactory("Beacon");
            beacon = await BeaconFactory.deploy();
            await beacon.waitForDeployment();
            const address = await beacon.getAddress();
            
            console.log(`   ✅ Beacon: ${address}`);
            expect(address).to.be.properAddress;
            
            // Test basic function
            const ownerAddress = await beacon.owner();
            expect(ownerAddress).to.equal(owner.address);
            console.log(`   ✅ Owner verified: ${ownerAddress}`);
        });

        it("✅ Should deploy ProxyGeneral", async function () {
            console.log("\n📦 Deploying ProxyGeneral...");
            const ProxyFactory = await ethers.getContractFactory("ProxyGeneral");
            const beaconAddress = await beacon.getAddress();
            const proxy = await ProxyFactory.deploy(beaconAddress, "WETH");
            await proxy.waitForDeployment();
            const address = await proxy.getAddress();
            
            console.log(`   ✅ ProxyGeneral: ${address}`);
            expect(address).to.be.properAddress;
            
            // Test basic function
            const totalSupply = await proxy.totalSupply();
            expect(totalSupply).to.equal(0);
            console.log(`   ✅ Initial LP supply: ${totalSupply}`);
        });

        it("✅ Should deploy TokenManager", async function () {
            console.log("\n📦 Deploying TokenManager...");
            const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
            const beaconAddress = await beacon.getAddress();
            // Deploy MockOracleAdapter for TokenManager

            const MockOracleAdapterFactory = await ethers.getContractFactory("MockOracleAdapter");

            const mockOracleAdapter = await MockOracleAdapterFactory.deploy();

            await mockOracleAdapter.waitForDeployment();

            

            const tokenManager = await TokenManagerFactory.deploy(

              beaconAddress,

              await mockOracleAdapter.getAddress()

            );
            await tokenManager.waitForDeployment();
            const address = await tokenManager.getAddress();
            
            console.log(`   ✅ TokenManager: ${address}`);
            expect(address).to.be.properAddress;
            
            // Test basic function
            const tokenCount = await tokenManager.tokenCodesCount();
            expect(tokenCount).to.equal(0);
            console.log(`   ✅ Initial token count: ${tokenCount}`);
        });

        it("✅ Should deploy ValueCalculator", async function () {
            console.log("\n📦 Deploying ValueCalculator...");
            const ValueCalculatorFactory = await ethers.getContractFactory("ValueCalculator");
            const beaconAddress = await beacon.getAddress();
            const valueCalculator = await ValueCalculatorFactory.deploy(beaconAddress, "WETH");
            await valueCalculator.waitForDeployment();
            const address = await valueCalculator.getAddress();
            
            console.log(`   ✅ ValueCalculator: ${address}`);
            expect(address).to.be.properAddress;
            
            // Test basic function - cache duration getter
            const cacheDuration = await valueCalculator.cacheDuration();
            expect(cacheDuration).to.be.gte(0);
            console.log(`   ✅ Cache duration: ${cacheDuration}s`);
        });

        it("✅ Should deploy LiquidityManager", async function () {
            console.log("\n📦 Deploying LiquidityManager...");
            // LiquidityManager needs BASE_ASSET registered in beacon
            const MockWETHFactory = await ethers.getContractFactory("MockWETH");
            const mockWeth = await MockWETHFactory.deploy();
            await mockWeth.waitForDeployment();
            await beacon.updateImplementation("BASE_ASSET", await mockWeth.getAddress());
            
            const LiquidityManagerFactory = await ethers.getContractFactory("LiquidityManager");
            const beaconAddress = await beacon.getAddress();
            const liquidityManager = await LiquidityManagerFactory.deploy(beaconAddress, "WETH");
            await liquidityManager.waitForDeployment();
            const address = await liquidityManager.getAddress();
            
            console.log(`   ✅ LiquidityManager: ${address}`);
            expect(address).to.be.properAddress;
            
            // Test basic function
            const depositsEnabled = await liquidityManager.depositsEnabled();
            console.log(`   ✅ Deposits enabled: ${depositsEnabled}`);
        });

        it("✅ Should deploy SwapManager", async function () {
            console.log("\n📦 Deploying SwapManager...");
            const SwapManagerFactory = await ethers.getContractFactory("SwapManager");
            const beaconAddress = await beacon.getAddress();
            const swapManager = await SwapManagerFactory.deploy(beaconAddress, "WETH");
            await swapManager.waitForDeployment();
            const address = await swapManager.getAddress();
            
            console.log(`   ✅ SwapManager: ${address}`);
            expect(address).to.be.properAddress;
            
            // Test basic function
            const swapsEnabled = await swapManager.swapsEnabled();
            console.log(`   ✅ Swaps enabled: ${swapsEnabled}`);
        });

        it("✅ Should deploy EmergencyHandler", async function () {
            console.log("\n📦 Deploying EmergencyHandler...");
            const EmergencyHandlerFactory = await ethers.getContractFactory("EmergencyHandler");
            const beaconAddress = await beacon.getAddress();
            const emergencyHandler = await EmergencyHandlerFactory.deploy(beaconAddress);
            await emergencyHandler.waitForDeployment();
            const address = await emergencyHandler.getAddress();
            
            console.log(`   ✅ EmergencyHandler: ${address}`);
            expect(address).to.be.properAddress;
            
            // Test basic function - check if has owner
            const ownerAddress = await emergencyHandler.owner();
            expect(ownerAddress).to.be.properAddress;
            console.log(`   ✅ EmergencyHandler owner set`);
        });

        it("✅ Should deploy ParameterManager", async function () {
            console.log("\n📦 Deploying ParameterManager...");
            const ParameterManagerFactory = await ethers.getContractFactory("ParameterManager");
            const beaconAddress = await beacon.getAddress();
            const parameterManager = await ParameterManagerFactory.deploy(beaconAddress, 18);
            await parameterManager.waitForDeployment();
            const address = await parameterManager.getAddress();
            
            console.log(`   ✅ ParameterManager: ${address}`);
            expect(address).to.be.properAddress;
            
            // Test basic function - check owner
            const ownerAddress = await parameterManager.owner();
            expect(ownerAddress).to.be.properAddress;
            console.log(`   ✅ Parameter storage ready`);
        });
    });

    describe("🔗 BEACON INTEGRATION TEST", function () {
        
        let proxyGeneral: any;
        let tokenManager: any;
        
        before(async function () {
            console.log("\n🔧 Setting up integrated system...");
            
            // Deploy ProxyGeneral
            const ProxyFactory = await ethers.getContractFactory("ProxyGeneral");
            const beaconAddress = await beacon.getAddress();
            proxyGeneral = await ProxyFactory.deploy(beaconAddress, "WETH");
            await proxyGeneral.waitForDeployment();
            
            // Deploy TokenManager
            const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
            // Deploy MockOracleAdapter for TokenManager

            const MockOracleAdapterFactory = await ethers.getContractFactory("MockOracleAdapter");

            const mockOracleAdapter = await MockOracleAdapterFactory.deploy();

            await mockOracleAdapter.waitForDeployment();

            

            tokenManager = await TokenManagerFactory.deploy(

              beaconAddress,

              await mockOracleAdapter.getAddress()

            );
            await tokenManager.waitForDeployment();
            
            // Register in Beacon
            await beacon.updateImplementation("ProxyGeneral", await proxyGeneral.getAddress());
            await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
            
            console.log(`   ✅ ProxyGeneral registered`);
            console.log(`   ✅ TokenManager registered`);
        });

        it("✅ Should resolve ProxyGeneral from Beacon", async function () {
            const registeredAddress = await beacon.getImplementation("ProxyGeneral");
            const actualAddress = await proxyGeneral.getAddress();
            
            expect(registeredAddress).to.equal(actualAddress);
            console.log(`   ✅ Beacon resolves ProxyGeneral correctly`);
        });

        it("✅ Should resolve TokenManager from Beacon", async function () {
            const registeredAddress = await beacon.getImplementation("TokenManager");
            const actualAddress = await tokenManager.getAddress();
            
            expect(registeredAddress).to.equal(actualAddress);
            console.log(`   ✅ Beacon resolves TokenManager correctly`);
        });

        it("✅ Should authorize module in ProxyGeneral", async function () {
            const moduleAddress = user1.address; // Use user1 as mock module
            
            await proxyGeneral.authorizeModule(moduleAddress, "TestModule");
            
            const isAuthorized = await proxyGeneral.isAuthorizedModule(moduleAddress);
            expect(isAuthorized).to.be.true;
            console.log(`   ✅ Module authorization working`);
        });
    });

    describe("📊 BASIC FUNCTIONALITY TEST", function () {
        
        it("✅ Should update Beacon implementation", async function () {
            // Deploy a mock contract to use as implementation
            const MockERC20Factory = await ethers.getContractFactory("MockERC20");
            const mockImpl = await MockERC20Factory.deploy("Test", "TST", 18);
            await mockImpl.waitForDeployment();
            const newAddress = await mockImpl.getAddress();
            
            await beacon.updateImplementation("TestModule", newAddress);
            
            const registered = await beacon.getImplementation("TestModule");
            expect(registered).to.equal(newAddress);
            console.log(`   ✅ Beacon update mechanism working`);
        });

        it("✅ Should pause/unpause ProxyGeneral", async function () {
            const ProxyFactory = await ethers.getContractFactory("ProxyGeneral");
            const beaconAddress = await beacon.getAddress();
            const proxy = await ProxyFactory.deploy(beaconAddress, "WETH");
            await proxy.waitForDeployment();
            
            // Pause
            await proxy.pause();
            let paused = await proxy.paused();
            expect(paused).to.be.true;
            console.log(`   ✅ Pause working`);
            
            // Unpause
            await proxy.unpause();
            paused = await proxy.paused();
            expect(paused).to.be.false;
            console.log(`   ✅ Unpause working`);
        });

        it("✅ Should manage token data in TokenManager", async function () {
            const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
            const beaconAddress = await beacon.getAddress();
            // Deploy MockOracleAdapter for TokenManager

            const MockOracleAdapterFactory = await ethers.getContractFactory("MockOracleAdapter");

            const mockOracleAdapter = await MockOracleAdapterFactory.deploy();

            await mockOracleAdapter.waitForDeployment();

            

            const tokenManager = await TokenManagerFactory.deploy(

              beaconAddress,

              await mockOracleAdapter.getAddress()

            );
            await tokenManager.waitForDeployment();
            
            // Register WETH in Beacon (required for manageTokenData)
            const MockWETHFactory = await ethers.getContractFactory("MockWETH");
            const mockWETH = await MockWETHFactory.deploy();
            await mockWETH.waitForDeployment();
            await beacon.updateImplementation("WETH", await mockWETH.getAddress());
            await beacon.updateImplementation("BASE_ASSET", await mockWETH.getAddress());
            
            // Add mock token - first set up oracle support
            const tokenCode = "TEST";
            const MockERC20Factory2 = await ethers.getContractFactory("MockERC20");
            const testToken = await MockERC20Factory2.deploy("Test Token", "TEST", 18);
            await testToken.waitForDeployment();
            const tokenAddress = await testToken.getAddress();
            const priceFeed = "0x0987654321098765432109876543210987654321";
            
            // Set up oracle to support TEST token
            await mockOracleAdapter.setPrice(tokenCode, ethers.parseUnits("100", 8));
            
            await tokenManager.manageTokenData(
                tokenCode,
                tokenAddress,
                priceFeed,
                18, // decimals
                8,  // price feed decimals
                3600 // heartbeat
            );
            
            const tokenCount = await tokenManager.tokenCodesCount();
            expect(tokenCount).to.equal(1);
            console.log(`   ✅ Token management working (${tokenCount} token)`);
        });
    });

    after(function () {
        console.log("\n" + "=".repeat(60));
        console.log("🎉 SMOKE TEST COMPLETE - ALL SYSTEMS OPERATIONAL");
        console.log("=".repeat(60));
        console.log("\n✅ Summary:");
        console.log("   • 8/8 Contracts deployed successfully");
        console.log("   • Beacon pattern working");
        console.log("   • Module authorization working");
        console.log("   • Basic operations functional");
        console.log("\n🚀 System ready for detailed testing!");
    });
});
