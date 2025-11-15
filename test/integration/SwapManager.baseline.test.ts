import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * PHASE 0.4: BASELINE MEASUREMENTS
 * 
 * Questo test misura le performance del sistema CORRENTE (pre-refactor)
 * per stabilire un baseline di confronto con il sistema refactorato.
 * 
 * Metriche misurate:
 * - Gas cost per swap singolo
 * - Gas cost per getExpectedOutput
 * - Latency operazioni
 * - Success rate
 */
describe("SwapManager - Baseline Measurements (Phase 0.4)", function () {
    
    let swapManager: Contract;
    let beacon: Contract;
    let proxyGeneral: Contract;
    let tokenManager: Contract;
    let simpleSwap: Contract;
    let weth: Contract;
    let usdc: Contract;
    
    let owner: Signer;
    let liquidityManagerMock: Signer;
    let user: Signer;
    
    // Arbitrum mainnet addresses
    const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const SIMPLE_SWAP_DEPLOYED = "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096";
    
    // Baseline results storage
    const baselineResults = {
        gasSwapSingle: [] as number[],
        gasGetExpectedOutput: [] as number[],
        swapLatency: [] as number[],
        successCount: 0,
        errorCount: 0,
    };
    
    before(async function () {
        // Skip if not forking
        if (process.env.FORK_ENABLED !== "true") {
            this.skip();
        }
        
        [owner, liquidityManagerMock, user] = await ethers.getSigners();
        
        console.log("\n📊 BASELINE MEASUREMENT SETUP");
        console.log("=====================================");
        console.log("Fork enabled: Arbitrum mainnet");
        console.log(`Block: ${await ethers.provider.getBlockNumber()}`);
        console.log(`Owner: ${await owner.getAddress()}`);
        console.log(`WETH: ${WETH_ADDRESS}`);
        console.log(`USDC: ${USDC_ADDRESS}`);
        console.log(`SimpleSwap: ${SIMPLE_SWAP_DEPLOYED}`);
    });
    
    describe("Setup & Verification", function () {
        
        it("Should verify SimpleSwap deployed contract exists", async function () {
            const code = await ethers.provider.getCode(SIMPLE_SWAP_DEPLOYED);
            expect(code).to.not.equal("0x");
            console.log(`✅ SimpleSwap contract verified at ${SIMPLE_SWAP_DEPLOYED}`);
        });
        
        it("Should deploy Beacon and register modules", async function () {
            const BeaconFactory = await ethers.getContractFactory("Beacon");
            beacon = await BeaconFactory.deploy();
            await beacon.waitForDeployment();
            
            const beaconAddress = await beacon.getAddress();
            console.log(`✅ Beacon deployed: ${beaconAddress}`);
        });
        
        it("Should deploy ProxyGeneral", async function () {
            const ProxyGeneralFactory = await ethers.getContractFactory("ProxyGeneral");
            proxyGeneral = await ProxyGeneralFactory.deploy(await beacon.getAddress());
            await proxyGeneral.waitForDeployment();
            
            console.log(`✅ ProxyGeneral deployed: ${await proxyGeneral.getAddress()}`);
        });
        
        it("Should deploy TokenManager", async function () {
            // Deploy MockOracleAdapter for TokenManager
            const MockOracleAdapterFactory = await ethers.getContractFactory("MockOracleAdapter");
            const mockOracleAdapter = await MockOracleAdapterFactory.deploy();
            await mockOracleAdapter.waitForDeployment();
            
            const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
            tokenManager = await TokenManagerFactory.deploy(
                await beacon.getAddress(),
                await mockOracleAdapter.getAddress()
            );
            await tokenManager.waitForDeployment();
            
            // Register WETH and USDC
            await tokenManager.addToken("WETH", WETH_ADDRESS);
            await tokenManager.addToken("USDC", USDC_ADDRESS);
            
            console.log(`✅ TokenManager deployed: ${await tokenManager.getAddress()}`);
        });
        
        it("Should deploy SwapManager with current configuration", async function () {
            const SwapManagerFactory = await ethers.getContractFactory("SwapManager");
            swapManager = await SwapManagerFactory.deploy(
                await beacon.getAddress(),
                await proxyGeneral.getAddress(),
                await tokenManager.getAddress(),
                WETH_ADDRESS
            );
            await swapManager.waitForDeployment();
            
            // Set SimpleSwap router (current system)
            await swapManager.setSimpleSwapRouter(SIMPLE_SWAP_DEPLOYED);
            
            // Authorize LiquidityManager mock
            await swapManager.updateAuthorizationStatus(
                await liquidityManagerMock.getAddress(),
                true
            );
            
            console.log(`✅ SwapManager deployed: ${await swapManager.getAddress()}`);
            console.log(`✅ SimpleSwap router set: ${SIMPLE_SWAP_DEPLOYED}`);
        });
        
        it("Should register modules in Beacon", async function () {
            await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
            await beacon.updateImplementation("SwapManager", await swapManager.getAddress());
            await beacon.updateImplementation("ProxyGeneral", await proxyGeneral.getAddress());
            
            console.log("✅ Modules registered in Beacon");
        });
        
        it("Should configure ProxyGeneral custody permissions", async function () {
            await proxyGeneral.updateModulePermissions(
                await swapManager.getAddress(),
                true // allowTransfers
            );
            
            console.log("✅ ProxyGeneral permissions configured");
        });
    });
    
    describe("Baseline Measurement - Gas Costs", function () {
        
        beforeEach(async function () {
            // Fund ProxyGeneral with WETH for testing
            weth = await ethers.getContractAt("IWETH", WETH_ADDRESS);
            
            // Deposit ETH to WETH
            const depositAmount = ethers.parseEther("10");
            await weth.deposit({ value: depositAmount });
            
            // Transfer to ProxyGeneral
            await weth.transfer(await proxyGeneral.getAddress(), depositAmount);
            
            console.log(`💰 Funded ProxyGeneral with 10 WETH`);
        });
        
        it("BASELINE: Gas cost for getExpectedOutput", async function () {
            const amountIn = ethers.parseEther("1"); // 1 WETH
            
            // Measure gas for getExpectedOutput
            const tx = await swapManager.getExpectedOutput.estimateGas(
                "WETH",
                "USDC",
                amountIn
            );
            
            baselineResults.gasGetExpectedOutput.push(Number(tx));
            
            console.log(`📊 Gas getExpectedOutput: ${tx}`);
            
            // Verify it works
            const expectedOutput = await swapManager.getExpectedOutput(
                "WETH",
                "USDC",
                amountIn
            );
            
            expect(expectedOutput).to.be.gt(0);
            console.log(`✅ Expected output: ${ethers.formatUnits(expectedOutput, 6)} USDC`);
        });
        
        it("BASELINE: Gas cost for performSwap (WETH → USDC)", async function () {
            const amountIn = ethers.parseEther("0.1"); // 0.1 WETH
            const expectedOutput = await swapManager.getExpectedOutput(
                "WETH",
                "USDC",
                amountIn
            );
            const minOutput = (expectedOutput * 97n) / 100n; // 3% slippage
            
            const deadline = (await time.latest()) + 600; // 10 min
            
            // Measure gas for performSwap
            const startTime = Date.now();
            
            const tx = await swapManager.connect(liquidityManagerMock).performSwap(
                "WETH",
                "USDC",
                amountIn,
                minOutput,
                deadline
            );
            
            const receipt = await tx.wait();
            const endTime = Date.now();
            
            baselineResults.gasSwapSingle.push(Number(receipt?.gasUsed || 0));
            baselineResults.swapLatency.push(endTime - startTime);
            baselineResults.successCount++;
            
            console.log(`📊 Gas performSwap: ${receipt?.gasUsed}`);
            console.log(`⏱️  Latency: ${endTime - startTime}ms`);
            
            // Verify swap succeeded
            const usdcBalance = await ethers.getContractAt(
                "IERC20",
                USDC_ADDRESS
            ).then(c => c.balanceOf(await proxyGeneral.getAddress()));
            
            expect(usdcBalance).to.be.gt(0);
            console.log(`✅ USDC received: ${ethers.formatUnits(usdcBalance, 6)}`);
        });
        
        it("BASELINE: Gas cost for performSwap (USDC → WETH)", async function () {
            // First swap WETH → USDC to get USDC
            const setupAmount = ethers.parseEther("0.5");
            const expectedSetup = await swapManager.getExpectedOutput(
                "WETH",
                "USDC",
                setupAmount
            );
            const minSetup = (expectedSetup * 97n) / 100n;
            const deadlineSetup = (await time.latest()) + 600;
            
            await swapManager.connect(liquidityManagerMock).performSwap(
                "WETH",
                "USDC",
                setupAmount,
                minSetup,
                deadlineSetup
            );
            
            // Now measure USDC → WETH swap
            const usdcBalance = await ethers.getContractAt(
                "IERC20",
                USDC_ADDRESS
            ).then(c => c.balanceOf(await proxyGeneral.getAddress()));
            
            const amountIn = usdcBalance / 2n; // Use half
            const expectedOutput = await swapManager.getExpectedOutput(
                "USDC",
                "WETH",
                amountIn
            );
            const minOutput = (expectedOutput * 97n) / 100n;
            const deadline = (await time.latest()) + 600;
            
            const startTime = Date.now();
            
            const tx = await swapManager.connect(liquidityManagerMock).performSwap(
                "USDC",
                "WETH",
                amountIn,
                minOutput,
                deadline
            );
            
            const receipt = await tx.wait();
            const endTime = Date.now();
            
            baselineResults.gasSwapSingle.push(Number(receipt?.gasUsed || 0));
            baselineResults.swapLatency.push(endTime - startTime);
            baselineResults.successCount++;
            
            console.log(`📊 Gas performSwap (USDC→WETH): ${receipt?.gasUsed}`);
            console.log(`⏱️  Latency: ${endTime - startTime}ms`);
        });
        
        it("BASELINE: Multiple swaps performance", async function () {
            const numSwaps = 5;
            console.log(`\n🔄 Running ${numSwaps} sequential swaps...`);
            
            for (let i = 0; i < numSwaps; i++) {
                const amountIn = ethers.parseEther("0.05"); // 0.05 WETH per swap
                const expectedOutput = await swapManager.getExpectedOutput(
                    "WETH",
                    "USDC",
                    amountIn
                );
                const minOutput = (expectedOutput * 97n) / 100n;
                const deadline = (await time.latest()) + 600;
                
                const startTime = Date.now();
                
                const tx = await swapManager.connect(liquidityManagerMock).performSwap(
                    "WETH",
                    "USDC",
                    amountIn,
                    minOutput,
                    deadline
                );
                
                const receipt = await tx.wait();
                const endTime = Date.now();
                
                baselineResults.gasSwapSingle.push(Number(receipt?.gasUsed || 0));
                baselineResults.swapLatency.push(endTime - startTime);
                baselineResults.successCount++;
                
                console.log(`  Swap ${i + 1}: ${receipt?.gasUsed} gas, ${endTime - startTime}ms`);
            }
        });
    });
    
    describe("Baseline Results Summary", function () {
        
        it("Should calculate and display baseline statistics", function () {
            console.log("\n");
            console.log("═══════════════════════════════════════════════════");
            console.log("           BASELINE RESULTS SUMMARY");
            console.log("═══════════════════════════════════════════════════");
            console.log("");
            
            // Gas statistics
            if (baselineResults.gasSwapSingle.length > 0) {
                const avgGas = baselineResults.gasSwapSingle.reduce((a, b) => a + b, 0) / baselineResults.gasSwapSingle.length;
                const minGas = Math.min(...baselineResults.gasSwapSingle);
                const maxGas = Math.max(...baselineResults.gasSwapSingle);
                
                console.log("📊 GAS COSTS (performSwap):");
                console.log(`   Average: ${Math.round(avgGas).toLocaleString()} gas`);
                console.log(`   Min:     ${minGas.toLocaleString()} gas`);
                console.log(`   Max:     ${maxGas.toLocaleString()} gas`);
                console.log("");
            }
            
            if (baselineResults.gasGetExpectedOutput.length > 0) {
                const avgGasQuote = baselineResults.gasGetExpectedOutput.reduce((a, b) => a + b, 0) / baselineResults.gasGetExpectedOutput.length;
                
                console.log("📊 GAS COSTS (getExpectedOutput):");
                console.log(`   Average: ${Math.round(avgGasQuote).toLocaleString()} gas`);
                console.log("");
            }
            
            // Latency statistics
            if (baselineResults.swapLatency.length > 0) {
                const avgLatency = baselineResults.swapLatency.reduce((a, b) => a + b, 0) / baselineResults.swapLatency.length;
                const minLatency = Math.min(...baselineResults.swapLatency);
                const maxLatency = Math.max(...baselineResults.swapLatency);
                
                console.log("⏱️  LATENCY:");
                console.log(`   Average: ${Math.round(avgLatency)}ms`);
                console.log(`   Min:     ${minLatency}ms`);
                console.log(`   Max:     ${maxLatency}ms`);
                console.log("");
            }
            
            // Success rate
            const total = baselineResults.successCount + baselineResults.errorCount;
            const successRate = total > 0 ? (baselineResults.successCount / total * 100) : 0;
            
            console.log("✅ SUCCESS RATE:");
            console.log(`   Successful: ${baselineResults.successCount}`);
            console.log(`   Failed:     ${baselineResults.errorCount}`);
            console.log(`   Rate:       ${successRate.toFixed(2)}%`);
            console.log("");
            console.log("═══════════════════════════════════════════════════");
            console.log("");
            
            // Assertions
            expect(baselineResults.successCount).to.be.gt(0);
            expect(successRate).to.equal(100);
        });
        
        it("Should save baseline to file for comparison", async function () {
            const fs = require("fs");
            const path = require("path");
            
            const results = {
                timestamp: new Date().toISOString(),
                blockNumber: await ethers.provider.getBlockNumber(),
                metrics: {
                    avgGasPerSwap: baselineResults.gasSwapSingle.reduce((a, b) => a + b, 0) / baselineResults.gasSwapSingle.length,
                    avgGasQuote: baselineResults.gasGetExpectedOutput.reduce((a, b) => a + b, 0) / baselineResults.gasGetExpectedOutput.length,
                    avgLatency: baselineResults.swapLatency.reduce((a, b) => a + b, 0) / baselineResults.swapLatency.length,
                    successRate: (baselineResults.successCount / (baselineResults.successCount + baselineResults.errorCount)) * 100,
                },
                raw: baselineResults,
            };
            
            const outputPath = path.join(__dirname, "../../", "baseline-results.json");
            fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
            
            console.log(`💾 Baseline results saved to: ${outputPath}`);
        });
    });
});
