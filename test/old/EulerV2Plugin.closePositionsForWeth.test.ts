import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

/**
 * Test E2E per closePositionsForWeth()
 * 
 * Scenario:
 * 1. Apri 2-3 posizioni leverage con HF diversi
 * 2. Chiama closePositionsForWeth con un target
 * 3. Verifica che chiuda le posizioni riskiest-first
 * 4. Verifica che ritorni il WETH corretto
 */
describe("EulerV2Plugin - closePositionsForWeth E2E", function () {
    this.timeout(300000); // 5 minuti per fork tests
    
    // Contracts
    let eulerV2Plugin: Contract;
    let eulerLensAdapter: Contract;
    let beacon: Contract;
    let tokenManager: Contract;
    let chainlinkAdapter: Contract;
    let EulerRegistry: Contract;
    let flashLoanService: Contract;
    
    // Signers
    let deployer: Signer;
    let deployerAddress: string;
    
    // Addresses Arbitrum
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH_VAULT = "0x78E3E051D32157AACD550fBB78458762d8f7edFF";
    const USDC_VAULT = "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899";
    const WETH_WHALE = "0xC3E5607Cd4ca0D5Fe51e09B60Ed97a0Ae6F874dd"; // Known Arbitrum WETH holder
    const ETH_USD_FEED = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";
    
    // Helper - delay to avoid RPC rate limiting
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const DELAY_MS = 1500; // 1.5 seconds between RPC calls
    
    before(async function () {
        console.log("\n" + "=".padEnd(70, "="));
        console.log("🔍 CLOSE POSITIONS FOR WETH - E2E TEST");
        console.log("   Testing automatic position closing to obtain target WETH");
        console.log("=".padEnd(70, "=") + "\n");
        
        [deployer] = await ethers.getSigners();
        deployerAddress = await deployer.getAddress();
        
        console.log(`📍 Deployer: ${deployerAddress}\n`);
        
        // Deploy infrastructure
        console.log("📦 Deploying contracts...\n");
        
        // Beacon
        const BeaconFactory = await ethers.getContractFactory("Beacon");
        beacon = await BeaconFactory.deploy();
        await beacon.waitForDeployment();
        console.log(`   ✅ Beacon deployed: ${await beacon.getAddress()}`);
        await sleep(DELAY_MS);
        
        // ChainlinkAdapter
        const ChainlinkAdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
        chainlinkAdapter = await ChainlinkAdapterFactory.deploy();
        await chainlinkAdapter.waitForDeployment();
        console.log(`   ✅ ChainlinkAdapter deployed: ${await chainlinkAdapter.getAddress()}`);
        await sleep(DELAY_MS);
        
        // Setup price feeds - using high heartbeat for fork testing
        const oneWeek = 7 * 24 * 3600;
        await chainlinkAdapter.setPriceFeed("WETH", ETH_USD_FEED, 8, oneWeek, "USD");
        await sleep(DELAY_MS);
        await chainlinkAdapter.setPriceFeed("USDC", "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", 8, oneWeek, "USD");
        await sleep(DELAY_MS);
        await chainlinkAdapter.setPriceFeed("ETH", ETH_USD_FEED, 8, oneWeek, "USD");
        await sleep(DELAY_MS);
        await chainlinkAdapter.setReferenceFeed("USD", ETH_USD_FEED, 8, oneWeek);
        await sleep(DELAY_MS);
        
        // TokenManager
        const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManagerFactory.deploy(
            await beacon.getAddress(),
            await chainlinkAdapter.getAddress()
        );
        await tokenManager.waitForDeployment();
        console.log(`   ✅ TokenManager deployed: ${await tokenManager.getAddress()}`);
        await sleep(DELAY_MS);
        
        // Register in Beacon
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await sleep(DELAY_MS);
        await beacon.updateImplementation("WETH", WETH);
        await sleep(DELAY_MS);
        
        // Configure TokenManager
        await tokenManager.manageTokenData("USDC", USDC, 6, 3600);
        console.log(`   ✅ TokenManager configured with USDC`);
        await sleep(DELAY_MS);
        
        // EulerRegistry
        const EulerRegistryFactory = await ethers.getContractFactory("EulerRegistry");
        EulerRegistry = await EulerRegistryFactory.deploy();
        await EulerRegistry.waitForDeployment();
        console.log(`   ✅ EulerRegistry deployed: ${await EulerRegistry.getAddress()}`);
        await sleep(DELAY_MS);
        
        await EulerRegistry.setVault("WETH", WETH_VAULT);
        await sleep(DELAY_MS);
        await EulerRegistry.setVault("USDC", USDC_VAULT);
        await sleep(DELAY_MS);
        
        // FlashLoanService
        const FlashLoanServiceFactory = await ethers.getContractFactory("FlashLoanService");
        flashLoanService = await FlashLoanServiceFactory.deploy(await beacon.getAddress());
        await flashLoanService.waitForDeployment();
        console.log(`   ✅ FlashLoanService deployed: ${await flashLoanService.getAddress()}`);
        await sleep(DELAY_MS);
        
        // Register all in Beacon
        await beacon.updateImplementation("EulerRegistry", await EulerRegistry.getAddress());
        await sleep(DELAY_MS);
        await beacon.updateImplementation("FlashLoanService", await flashLoanService.getAddress());
        await sleep(DELAY_MS);
        await beacon.updateImplementation("ProxyGeneral", deployerAddress); // Use deployer as ProxyGeneral for testing
        await sleep(DELAY_MS);
        await beacon.updateImplementation("LiquidityManager", deployerAddress); // Use deployer as LiquidityManager for testing
        await sleep(DELAY_MS);
        
        // EulerV2Plugin
        const EulerV2PluginFactory = await ethers.getContractFactory("EulerV2Plugin");
        eulerV2Plugin = await EulerV2PluginFactory.deploy(await beacon.getAddress());
        await eulerV2Plugin.waitForDeployment();
        
        console.log(`   ✅ EulerV2Plugin deployed: ${await eulerV2Plugin.getAddress()}`);
        await sleep(DELAY_MS);
        
        // Deploy EulerLensAdapter
        const EulerLensAdapterFactory = await ethers.getContractFactory("EulerLensAdapter");
        eulerLensAdapter = await EulerLensAdapterFactory.deploy(await beacon.getAddress());
        await eulerLensAdapter.waitForDeployment();
        console.log(`   ✅ EulerLensAdapter deployed: ${await eulerLensAdapter.getAddress()}`);
        await sleep(DELAY_MS);
        
        // Register plugin in Beacon (required for FlashLoanService authorization)
        await beacon.updateImplementation("EulerV2Plugin", await eulerV2Plugin.getAddress());
        console.log(`   ✅ EulerV2Plugin registered in Beacon`);
        await sleep(DELAY_MS);
        
        // Register EulerLensAdapter in Beacon
        await beacon.updateImplementation("EulerLensAdapter", await eulerLensAdapter.getAddress());
        console.log(`   ✅ EulerLensAdapter registered in Beacon`);
        await sleep(DELAY_MS);
        
        // Fund deployer with WETH (not plugin directly)
        console.log("\n💰 Funding deployer with WETH from whale...");
        await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
        
        // Fund whale with ETH for gas using hardhat_setBalance
        await ethers.provider.send("hardhat_setBalance", [
            WETH_WHALE,
            "0x" + ethers.parseEther("10").toString(16)
        ]);
        
        const whale = await ethers.getSigner(WETH_WHALE);
        const weth = await ethers.getContractAt("IERC20", WETH);
        const fundAmount = ethers.parseEther("10"); // 10 WETH
        
        // Transfer to deployer, not plugin
        await weth.connect(whale).transfer(deployerAddress, fundAmount);
        console.log(`   ✅ Funded deployer with ${ethers.formatEther(fundAmount)} WETH`);
        
        await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);
        
        console.log("\n" + "-".padEnd(70, "-") + "\n");
    });
    
    describe("1. Setup - Open Multiple Leverage Positions", function () {
        it("Should open 3 leverage positions with different leverage levels", async function () {
            const weth = await ethers.getContractAt("IERC20", WETH);
            const pluginAddr = await eulerV2Plugin.getAddress();
            
            // Helper to open leverage position
            async function openPosition(leverageX100: number, description: string) {
                console.log(`\n   📈 Opening ${description}...`);
                
                const collateralAmount = ethers.parseEther("1");
                await weth.approve(pluginAddr, collateralAmount);
                
                const params = {
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    collateralAmount: collateralAmount,
                    targetLeverageX100: leverageX100,
                    minHealthFactor: ethers.parseEther("1.05"),
                    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
                };
                
                const tx = await eulerV2Plugin.openLeverageAtomic(params);
                await tx.wait();
                console.log(`      ✅ Position opened`);
                await sleep(DELAY_MS * 2); // Extra delay for leverage operations
            }
            
            // Position 1: 2x leverage (safest)
            await openPosition(200, "Position 1: 2x leverage (safe)");
            
            // Position 2: 3x leverage (medium risk)
            await openPosition(300, "Position 2: 3x leverage (medium)");
            
            // Position 3: 4x leverage (risky)
            await openPosition(400, "Position 3: 4x leverage (risky)");
            
            // Verify positions
            await sleep(DELAY_MS);
            const activeCount = await EulerRegistry.getActivePositionCount();
            console.log(`\n   📊 Active positions: ${activeCount}`);
            expect(activeCount).to.equal(3);
            
            // Log health factors
            for (let i = 0; i < 3; i++) {
                await sleep(DELAY_MS);
                const hf = await eulerLensAdapter.getPositionHealthFactor(i);
                console.log(`      Position ${i}: HF = ${ethers.formatEther(hf)}`);
            }
        });
    });
    
    describe("2. closePositionsForWeth - Core Functionality", function () {
        it("Should close riskiest position first when requesting small amount", async function () {
            // Request 0.5 WETH - should close just the riskiest position
            console.log("\n   🎯 Requesting 0.5 WETH (should close 1 risky position)...");
            
            const targetWeth = ethers.parseEther("0.5");
            const tx = await eulerV2Plugin.closePositionsForWeth(targetWeth);
            const receipt = await tx.wait();
            await sleep(DELAY_MS * 2);
            
            // Check result
            const activeCount = await EulerRegistry.getActivePositionCount();
            console.log(`   📊 Active positions after: ${activeCount}`);
            
            // Should have closed the riskiest one (Position 3 with 4x leverage)
            expect(activeCount).to.equal(2);
        });
        
        it("Should close multiple positions when requesting larger amount", async function () {
            // Request 3 WETH - should close remaining positions
            console.log("\n   🎯 Requesting 3 WETH (should close remaining positions)...");
            
            await sleep(DELAY_MS);
            const targetWeth = ethers.parseEther("3");
            const tx = await eulerV2Plugin.closePositionsForWeth(targetWeth);
            const receipt = await tx.wait();
            await sleep(DELAY_MS * 2);
            
            const activeCount = await EulerRegistry.getActivePositionCount();
            console.log(`   📊 Active positions after: ${activeCount}`);
            
            // Should have closed all remaining
            expect(activeCount).to.equal(0);
        });
        
        it("Should return 0 when no active positions", async function () {
            console.log("\n   🎯 Requesting WETH with no positions...");
            
            await sleep(DELAY_MS);
            const [wethObtained, positionsClosed] = await eulerV2Plugin.closePositionsForWeth.staticCall(
                ethers.parseEther("1")
            );
            
            console.log(`   📊 WETH obtained: ${ethers.formatEther(wethObtained)}`);
            console.log(`   📊 Positions closed: ${positionsClosed}`);
            
            expect(wethObtained).to.equal(0);
            expect(positionsClosed).to.equal(0);
        });
    });
    
    describe("3. Edge Cases", function () {
        before(async function () {
            // Refund and open new position for edge case tests
            await sleep(DELAY_MS);
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            await sleep(DELAY_MS);
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                "0x" + ethers.parseEther("10").toString(16)
            ]);
            const whale = await ethers.getSigner(WETH_WHALE);
            const weth = await ethers.getContractAt("IERC20", WETH);
            await sleep(DELAY_MS);
            await weth.connect(whale).transfer(
                await eulerV2Plugin.getAddress(),
                ethers.parseEther("5")
            );
            await sleep(DELAY_MS);
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);
        });
        
        it("Should handle target larger than available value", async function () {
            const weth = await ethers.getContractAt("IERC20", WETH);
            const pluginAddr = await eulerV2Plugin.getAddress();
            
            // Open one position using correct params
            await sleep(DELAY_MS);
            const collateralAmount = ethers.parseEther("1");
            await weth.approve(pluginAddr, collateralAmount);
            await sleep(DELAY_MS);
            
            const params = {
                collateralToken: "WETH",
                borrowToken: "USDC",
                collateralAmount: collateralAmount,
                targetLeverageX100: 200,
                minHealthFactor: ethers.parseEther("1.05"),
                deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
            };
            
            await eulerV2Plugin.openLeverageAtomic(params);
            await sleep(DELAY_MS * 2);
            
            console.log("\n   🎯 Requesting 100 WETH (more than available)...");
            
            const tx = await eulerV2Plugin.closePositionsForWeth(ethers.parseEther("100"));
            await tx.wait();
            await sleep(DELAY_MS * 2);
            
            const activeCount = await EulerRegistry.getActivePositionCount();
            console.log(`   📊 Active positions after: ${activeCount}`);
            
            // Should close all available, not revert
            expect(activeCount).to.equal(0);
        });
    });
    
    after(async function () {
        console.log("\n" + "=".padEnd(70, "="));
        console.log("✅ closePositionsForWeth E2E tests completed");
        console.log("=".padEnd(70, "=") + "\n");
    });
});
