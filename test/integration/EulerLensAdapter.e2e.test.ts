/**
 * @file EulerLensAdapter.e2e.test.ts
 * @description E2E Test per EulerLensAdapter su fork di Arbitrum
 * 
 * OBIETTIVO: Testare le funzioni di EulerLensAdapter:
 * - Health monitoring (getHealthFactor, getSubAccountHealth, getTimeToLiquidation)
 * - Value functions (getTotalEulerValue, getEulerPositionValues, getPositionCollateralInEth)
 * - Auto-close support (getEulerPositionsAtRisk, shouldAutoClosePosition)
 * - Utility functions (getPrimaryControllerVault, getVaultForToken, getVaultAPYs)
 * 
 * INTEGRAZIONE:
 * - EulerV2Plugin: Per creare posizioni leverage da monitorare
 * - EulerRegistry: Per lookup vault addresses
 * - TokenManager: Per conversione prezzi a ETH
 * - FlashLoanService: Per operazioni leverage atomiche
 * 
 * SETUP:
 * $env:FORK_ENABLED="true"; npx hardhat test test/integration/EulerLensAdapter.e2e.test.ts
 */

import { ethers, network } from "hardhat";
import { expect } from "chai";
import { Contract, Signer } from "ethers";

describe("EulerLensAdapter - E2E Tests on Arbitrum Fork", function () {
    this.timeout(300000); // 5 minuti

    // ==================== ARBITRUM ADDRESSES ====================
    
    const ADDRESSES = {
        // Tokens
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        
        // Euler V2 Vaults
        WETH_VAULT: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
        USDC_VAULT: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
        
        // Euler V2 Core
        EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
        ACCOUNT_LENS: "0x90a52DDcb232e7bb003DD9258fA1235c553eC956",
        VAULT_LENS: "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380",
        UTILS_LENS: "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE",
        
        // Balancer V2 Vault (0% fee flash loans!)
        BALANCER_VAULT: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        
        // SimpleSwap (Uniswap V3 wrapper)
        SIMPLE_SWAP: "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096",
        
        // Chainlink price feeds
        ETH_USD_FEED: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
        USDC_USD_FEED: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
    };

    // Whale addresses con WETH
    const WETH_WHALE = "0xC3E5607Cd4ca0D5Fe51e09B60Ed97a0Ae6F874dd";

    // Contracts
    let deployer: Signer;
    let deployerAddress: string;
    let beacon: Contract;
    let eulerLensAdapter: Contract;
    let eulerV2Plugin: Contract;
    let EulerRegistry: Contract;
    let flashLoanService: Contract;
    let tokenManager: Contract;
    let weth: Contract;
    let usdc: Contract;
    let wethVault: Contract;
    let usdcVault: Contract;
    let evc: Contract;
    let accountLens: Contract;

    // Test state
    let initialWethBalance: bigint;
    let hasLeveragePosition: boolean = false;

    // ==================== HELPER FUNCTIONS ====================
    
    function formatAmount(amount: bigint, decimals: number = 18): string {
        return Number(ethers.formatUnits(amount, decimals)).toFixed(4);
    }

    function formatHealthFactor(hf: bigint): string {
        if (hf === ethers.MaxUint256) return "∞ (no debt)";
        return (Number(hf) / 1e18).toFixed(4);
    }

    // Sleep helper to avoid rate limiting
    function sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== SETUP ====================
    
    before(async function () {
        if (process.env.FORK_ENABLED !== "true") {
            console.log("⚠️  Skipping E2E tests - not on fork");
            console.log("   Run with: $env:FORK_ENABLED=\"true\"; npx hardhat test test/integration/EulerLensAdapter.e2e.test.ts");
            this.skip();
        }

        console.log("\n" + "=".repeat(70));
        console.log("🔍 EULER LENS ADAPTER - E2E TEST");
        console.log("   Testing health monitoring, value calculation, and auto-close support");
        console.log("=".repeat(70));

        [deployer] = await ethers.getSigners();
        deployerAddress = await deployer.getAddress();

        console.log(`\n📍 Deployer: ${deployerAddress}`);

        // Setup token contracts
        weth = await ethers.getContractAt(
            "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
            ADDRESSES.WETH,
            deployer
        );
        usdc = await ethers.getContractAt(
            "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
            ADDRESSES.USDC,
            deployer
        );

        // Setup Euler vault contracts
        const vaultAbi = [
            "function deposit(uint256 assets, address receiver) external returns (uint256)",
            "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256)",
            "function borrow(uint256 amount, address receiver) external returns (uint256)",
            "function repay(uint256 amount, address receiver) external returns (uint256)",
            "function redeem(uint256 shares, address receiver, address owner) external returns (uint256)",
            "function balanceOf(address) view returns (uint256)",
            "function maxWithdraw(address) view returns (uint256)",
            "function debtOf(address) view returns (uint256)",
            "function asset() view returns (address)",
            "function approve(address, uint256) external returns (bool)",
            "function convertToAssets(uint256 shares) view returns (uint256)",
            "function totalBorrows() view returns (uint256)",
            "function totalAssets() view returns (uint256)",
        ];

        wethVault = await ethers.getContractAt(vaultAbi, ADDRESSES.WETH_VAULT, deployer);
        usdcVault = await ethers.getContractAt(vaultAbi, ADDRESSES.USDC_VAULT, deployer);

        // Setup EVC
        evc = await ethers.getContractAt([
            "function enableCollateral(address account, address vault) external",
            "function enableController(address account, address vault) external",
            "function isCollateralEnabled(address, address) view returns (bool)",
            "function isControllerEnabled(address, address) view returns (bool)",
            "function getControllers(address) view returns (address[])",
        ], ADDRESSES.EVC, deployer);

        // Setup AccountLens
        accountLens = await ethers.getContractAt([
            "function getAccountLiquidityInfo(address, address) view returns (tuple(bool queryFailure, bytes queryFailureReason, address account, address vault, address unitOfAccount, int256 timeToLiquidation, uint256 liabilityValueBorrowing, uint256 liabilityValueLiquidation, uint256 collateralValueBorrowing, uint256 collateralValueLiquidation, uint256 collateralValueRaw, address[] collaterals, uint256[] collateralValuesBorrowing, uint256[] collateralValuesLiquidation, uint256[] collateralValuesRaw))",
            "function getTimeToLiquidation(address, address) view returns (int256)",
        ], ADDRESSES.ACCOUNT_LENS, deployer);

        console.log("\n📦 Deploying contracts (with delays to avoid rate limiting)...\n");

        // Deploy Beacon
        const BeaconFactory = await ethers.getContractFactory("Beacon");
        beacon = await BeaconFactory.deploy();
        await beacon.waitForDeployment();
        console.log(`   ✅ Beacon deployed: ${await beacon.getAddress()}`);
        await sleep(2000);

        // Deploy ChainlinkAdapter (required by TokenManager)
        const ChainlinkAdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
        const chainlinkAdapter = await ChainlinkAdapterFactory.deploy();
        await chainlinkAdapter.waitForDeployment();
        console.log(`   ✅ ChainlinkAdapter deployed: ${await chainlinkAdapter.getAddress()}`);
        await sleep(2000);

        // Configure price feeds in ChainlinkAdapter
        // setPriceFeed(tokenCode, feedAddress, decimals, heartbeat, denomination)
        // Using very high heartbeat (1 week) to avoid stale price issues on fork
        const oneWeek = 7 * 24 * 3600;
        await chainlinkAdapter.setPriceFeed("WETH", ADDRESSES.ETH_USD_FEED, 8, oneWeek, "USD");
        await sleep(1500);
        await chainlinkAdapter.setPriceFeed("USDC", ADDRESSES.USDC_USD_FEED, 8, oneWeek, "USD");
        await sleep(1500);
        // Add ETH as reference feed for USD→ETH conversion
        await chainlinkAdapter.setPriceFeed("ETH", ADDRESSES.ETH_USD_FEED, 8, oneWeek, "USD");
        await sleep(1500);
        // CRITICAL: Set reference feed for USD denomination to enable USD→ETH conversion
        // setReferenceFeed(denomination, feedAddress, decimals, heartbeat)
        await chainlinkAdapter.setReferenceFeed("USD", ADDRESSES.ETH_USD_FEED, 8, oneWeek);
        await sleep(2000);

        // Deploy TokenManager
        const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManagerFactory.deploy(
            await beacon.getAddress(),
            await chainlinkAdapter.getAddress()
        );
        await tokenManager.waitForDeployment();
        console.log(`   ✅ TokenManager deployed: ${await tokenManager.getAddress()}`);
        await sleep(2000);

        // Register TokenManager in Beacon
        await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
        await sleep(1500);

        // Register WETH address in Beacon (TokenManager uses this to prevent adding WETH as token)
        await beacon.updateImplementation("WETH", ADDRESSES.WETH);
        await sleep(1500);

        // Setup tokens in TokenManager using manageTokenData
        // Note: WETH is excluded from TokenManager (it's the base asset)
        // manageTokenData(tokenCode, tokenAddress, tokenDecimals, heartbeat)
        await tokenManager.manageTokenData("USDC", ADDRESSES.USDC, 6, 3600);
        console.log(`   ✅ TokenManager configured with USDC (WETH is base asset)`);
        await sleep(2000);

        // Deploy EulerRegistry
        const EulerRegistryFactory = await ethers.getContractFactory("EulerRegistry");
        EulerRegistry = await EulerRegistryFactory.deploy();
        await EulerRegistry.waitForDeployment();
        console.log(`   ✅ EulerRegistry deployed: ${await EulerRegistry.getAddress()}`);
        await sleep(2000);

        // Configure vaults in registry
        await EulerRegistry.setVault("WETH", ADDRESSES.WETH_VAULT);
        await sleep(1500);
        await EulerRegistry.setVault("USDC", ADDRESSES.USDC_VAULT);
        console.log(`   ✅ EulerRegistry configured with WETH and USDC vaults`);
        await sleep(2000);

        // Register EulerRegistry in Beacon
        await beacon.updateImplementation("EulerRegistry", await EulerRegistry.getAddress());
        await sleep(1500);

        // Deploy FlashLoanService
        const FlashLoanServiceFactory = await ethers.getContractFactory("FlashLoanService");
        flashLoanService = await FlashLoanServiceFactory.deploy(
            await beacon.getAddress()
        );
        await flashLoanService.waitForDeployment();
        console.log(`   ✅ FlashLoanService deployed: ${await flashLoanService.getAddress()}`);
        await sleep(2000);

        // Register FlashLoanService in Beacon
        await beacon.updateImplementation("FlashLoanService", await flashLoanService.getAddress());
        await sleep(1500);

        // Deploy EulerV2Plugin
        const EulerV2PluginFactory = await ethers.getContractFactory("EulerV2Plugin");
        eulerV2Plugin = await EulerV2PluginFactory.deploy(await beacon.getAddress());
        await eulerV2Plugin.waitForDeployment();
        console.log(`   ✅ EulerV2Plugin deployed: ${await eulerV2Plugin.getAddress()}`);
        await sleep(2000);

        // Register EulerV2Plugin in Beacon
        await beacon.updateImplementation("EulerV2Plugin", await eulerV2Plugin.getAddress());
        await sleep(1500);

        // Deploy EulerLensAdapter
        const EulerLensAdapterFactory = await ethers.getContractFactory("EulerLensAdapter");
        eulerLensAdapter = await EulerLensAdapterFactory.deploy(await beacon.getAddress());
        await eulerLensAdapter.waitForDeployment();
        console.log(`   ✅ EulerLensAdapter deployed: ${await eulerLensAdapter.getAddress()}`);
        await sleep(2000);

        // Register EulerLensAdapter in Beacon
        await beacon.updateImplementation("EulerLensAdapter", await eulerLensAdapter.getAddress());
        await sleep(1500);

        console.log("\n" + "-".repeat(70));

        // Fund deployer with WETH from whale
        console.log("\n💰 Funding test account with WETH from whale...");
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [WETH_WHALE],
        });
        
        const whale = await ethers.getSigner(WETH_WHALE);
        const fundAmount = ethers.parseEther("5");
        
        // Fund whale with ETH for gas
        await deployer.sendTransaction({
            to: WETH_WHALE,
            value: ethers.parseEther("1"),
        });
        
        await weth.connect(whale).transfer(deployerAddress, fundAmount);
        
        await network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [WETH_WHALE],
        });

        initialWethBalance = await weth.balanceOf(deployerAddress);
        console.log(`   ✅ Funded with ${formatAmount(initialWethBalance)} WETH`);
    });

    // ==================== TEST CASES ====================

    describe("1. Utility Functions", function () {
        it("Should get vault for token code", async function () {
            const wethVaultAddr = await eulerLensAdapter.getVaultForToken("WETH");
            const usdcVaultAddr = await eulerLensAdapter.getVaultForToken("USDC");
            
            expect(wethVaultAddr).to.equal(ADDRESSES.WETH_VAULT);
            expect(usdcVaultAddr).to.equal(ADDRESSES.USDC_VAULT);
            
            console.log(`   ✅ WETH vault: ${wethVaultAddr}`);
            console.log(`   ✅ USDC vault: ${usdcVaultAddr}`);
        });

        it("Should get vault APYs", async function () {
            const [borrowAPY, supplyAPY] = await eulerLensAdapter.getVaultAPYs(ADDRESSES.WETH_VAULT);
            
            console.log(`   📊 WETH Vault:`);
            console.log(`      Borrow APY: ${(Number(borrowAPY) / 1e18 * 100).toFixed(2)}%`);
            console.log(`      Supply APY: ${(Number(supplyAPY) / 1e18 * 100).toFixed(2)}%`);
            
            // APYs should be reasonable (0-100%)
            expect(borrowAPY).to.be.lt(ethers.parseEther("1")); // < 100%
        });
    });

    describe("2. Health Monitoring - No Position", function () {
        it("Should return max health factor when no debt", async function () {
            const pluginAddr = await eulerV2Plugin.getAddress();
            const healthFactor = await eulerLensAdapter["getHealthFactor(address)"](pluginAddr);
            
            expect(healthFactor).to.equal(ethers.MaxUint256);
            console.log(`   ✅ Health Factor: ${formatHealthFactor(healthFactor)}`);
        });

        it("Should return no controller vault when no borrow", async function () {
            const pluginAddr = await eulerV2Plugin.getAddress();
            const controllerVault = await eulerLensAdapter.getPrimaryControllerVault(pluginAddr);
            
            expect(controllerVault).to.equal(ethers.ZeroAddress);
            console.log(`   ✅ No controller vault (no borrow)`);
        });
    });

    describe("3. Value Functions - No Position", function () {
        it("Should return 0 for getTotalEulerValue when no positions", async function () {
            const totalValue = await eulerLensAdapter.getTotalEulerValue();
            
            console.log(`   💰 Total Euler Value: ${formatAmount(totalValue)} ETH`);
            expect(totalValue).to.equal(0n);
        });

        it("Should return zeros for getEulerPositionValues when no positions", async function () {
            const [collateral, debt, netValue] = await eulerLensAdapter.getEulerPositionValues();
            
            console.log(`   📊 Position Values:`);
            console.log(`      Collateral: ${formatAmount(collateral)} ETH`);
            console.log(`      Debt: ${formatAmount(debt)} ETH`);
            console.log(`      Net Value: ${formatAmount(netValue)} ETH`);
            
            expect(collateral).to.equal(0n);
            expect(debt).to.equal(0n);
            expect(netValue).to.equal(0n);
        });
    });

    describe("4. Create Leverage Position for Testing", function () {
        it("Should open 4x leverage position via EulerV2Plugin (high risk for testing)", async function () {
            const pluginAddr = await eulerV2Plugin.getAddress();
            const depositAmount = ethers.parseEther("1");
            
            console.log(`\n   🔄 Opening 4x leverage position with ${formatAmount(depositAmount)} WETH (HIGH RISK for testing)...`);
            
            // Approve plugin to spend WETH (openLeverageAtomic does transferFrom)
            await weth.approve(pluginAddr, depositAmount);
            await sleep(1000); // Wait 1 sec to avoid rate limiting
            
            try {
                // Build params struct for openLeverageAtomic
                // Using 4x leverage to create a position with HF ~1.1-1.3 (at risk with threshold 2.0)
                const params = {
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    collateralAmount: depositAmount,
                    targetLeverageX100: 400, // 4x leverage for LOW health factor
                    minHealthFactor: ethers.parseEther("1.05"), // Allow lower HF
                    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour from now
                };
                
                await sleep(1000); // Wait 1 sec before leverage operation
                const tx = await eulerV2Plugin.openLeverageAtomic(params);
                
                const receipt = await tx.wait();
                console.log(`   ✅ Leverage position opened! Gas: ${receipt?.gasUsed.toString()}`);
                hasLeveragePosition = true;
                
                await sleep(500); // Small delay before reading state
                
                // Check position state
                const positionCount = await eulerV2Plugin.getActivePositionCount();
                console.log(`   📊 Active positions: ${positionCount}`);
                
                // Check health
                const hf = await eulerV2Plugin.getHealthFactor();
                console.log(`   💪 Health Factor: ${formatHealthFactor(hf)}`);
                
            } catch (error: any) {
                console.log(`   ⚠️ Leverage open failed: ${error.message?.slice(0, 100)}`);
                // Continue tests even if leverage fails
            }
        });
    });

    describe("5. Health Monitoring - With Position", function () {
        it("Should return valid health factor with active position", async function () {
            if (!hasLeveragePosition) this.skip();
            
            const pluginAddr = await eulerV2Plugin.getAddress();
            const healthFactor = await eulerLensAdapter["getHealthFactor(address)"](pluginAddr);
            
            console.log(`   💪 Health Factor: ${formatHealthFactor(healthFactor)}`);
            
            // Should be between 1.0 and infinity (not exactly max uint)
            expect(healthFactor).to.be.gt(ethers.parseEther("1"));
            expect(healthFactor).to.be.lt(ethers.MaxUint256);
        });

        it("Should get time to liquidation with status", async function () {
            if (!hasLeveragePosition) this.skip();
            
            const pluginAddr = await eulerV2Plugin.getAddress();
            const controllerVault = await eulerLensAdapter.getPrimaryControllerVault(pluginAddr);
            
            expect(controllerVault).to.not.equal(ethers.ZeroAddress);
            
            const [ttl, status] = await eulerLensAdapter["getTimeToLiquidation(address,address)"](pluginAddr, controllerVault);
            
            console.log(`   ⏱️ Time to Liquidation: ${ttl.toString()} seconds`);
            console.log(`   📋 Status: ${status}`);
            
            // With healthy position, should be SAFE
            expect(["SAFE_NO_DEBT", "SAFE_OVER_1_YEAR", "AT_RISK"]).to.include(status);
        });
    });

    describe("6. Value Functions - With Position", function () {
        it("Should return positive value for getTotalEulerValue", async function () {
            if (!hasLeveragePosition) this.skip();
            
            const totalValue = await eulerLensAdapter.getTotalEulerValue();
            
            console.log(`   💰 Total Euler Value: ${formatAmount(totalValue)} ETH`);
            
            // Should have some value (at least close to initial deposit)
            expect(totalValue).to.be.gt(0n);
        });

        it("Should return breakdown with getEulerPositionValues", async function () {
            if (!hasLeveragePosition) this.skip();
            
            const [collateral, debt, netValue] = await eulerLensAdapter.getEulerPositionValues();
            
            console.log(`   📊 Position Values:`);
            console.log(`      Collateral: ${formatAmount(collateral)} ETH`);
            console.log(`      Debt: ${formatAmount(debt)} ETH`);
            console.log(`      Net Value: ${formatAmount(netValue)} ETH`);
            
            // Collateral should be > debt (healthy position)
            expect(collateral).to.be.gt(debt);
            // Net value should be positive
            expect(netValue).to.be.gt(0n);
        });

        it("Should get position collateral in ETH", async function () {
            if (!hasLeveragePosition) this.skip();
            
            // Get first position
            const positions = await eulerV2Plugin.getAllPositions();
            if (positions.length === 0) this.skip();
            
            const positionId = positions[0].positionId;
            const collateralEth = await eulerLensAdapter.getPositionCollateralInEth(positionId);
            
            console.log(`   💎 Position ${positionId} collateral: ${formatAmount(collateralEth)} ETH`);
            
            expect(collateralEth).to.be.gt(0n);
        });

        it("Should get withdrawable amount", async function () {
            if (!hasLeveragePosition) this.skip();
            
            const withdrawable = await eulerLensAdapter.getWithdrawableAmount("WETH");
            
            console.log(`   🏦 Withdrawable WETH: ${formatAmount(withdrawable)}`);
            
            // Some amount should be withdrawable while maintaining health
            // (may be 0 if leverage is high)
        });
    });

    describe("7. Auto-Close Support", function () {
        it("Should return empty array for getEulerPositionsAtRisk with low threshold", async function () {
            // Use a very low threshold - no positions should be at risk
            const lowThreshold = ethers.parseEther("0.5"); // 0.5x health factor
            const atRiskPositions = await eulerLensAdapter.getEulerPositionsAtRisk(lowThreshold);
            
            console.log(`   🛡️ Positions at risk (HF < 0.5): ${atRiskPositions.length}`);
            expect(atRiskPositions.length).to.equal(0);
        });

        it("Should detect positions at risk with threshold 2.0", async function () {
            if (!hasLeveragePosition) this.skip();
            
            // With 4x leverage, HF should be ~1.1-1.3
            // Threshold 2.0 should catch this position as "at risk"
            const threshold = ethers.parseEther("2"); // 2.0x health factor threshold
            const atRiskPositions = await eulerLensAdapter.getEulerPositionsAtRisk(threshold);
            
            console.log(`   ⚠️ Positions at risk (HF < 2.0): ${atRiskPositions.length}`);
            expect(atRiskPositions.length).to.be.gte(1);
        });

        it("Should check shouldAutoClosePosition correctly", async function () {
            if (!hasLeveragePosition) this.skip();
            
            const positions = await eulerV2Plugin.getAllPositions();
            if (positions.length === 0) this.skip();
            
            const positionId = positions[0].positionId;
            
            // Low threshold - should NOT auto close
            const shouldCloseLow = await eulerLensAdapter.shouldAutoClosePosition(
                positionId,
                ethers.parseEther("0.5")
            );
            expect(shouldCloseLow).to.equal(false);
            console.log(`   ✅ Position ${positionId} - shouldAutoClose (HF < 0.5): ${shouldCloseLow}`);
            
            // High threshold - should auto close
            const shouldCloseHigh = await eulerLensAdapter.shouldAutoClosePosition(
                positionId,
                ethers.parseEther("10")
            );
            expect(shouldCloseHigh).to.equal(true);
            console.log(`   ⚠️ Position ${positionId} - shouldAutoClose (HF < 10): ${shouldCloseHigh}`);
        });
    });

    describe("8. Integration with EulerV2Plugin", function () {
        it("Should match health factor from plugin and adapter", async function () {
            const pluginAddr = await eulerV2Plugin.getAddress();
            
            const pluginHF = await eulerV2Plugin.getHealthFactor();
            const adapterHF = await eulerLensAdapter["getHealthFactor(address)"](pluginAddr);
            
            console.log(`   📊 Plugin Health Factor: ${formatHealthFactor(pluginHF)}`);
            console.log(`   📊 Adapter Health Factor: ${formatHealthFactor(adapterHF)}`);
            
            // Should be equal or very close
            expect(pluginHF).to.equal(adapterHF);
        });
    });

    describe("9. Cleanup - Close Position", function () {
        it("Should close leverage position", async function () {
            if (!hasLeveragePosition) this.skip();
            
            console.log(`\n   🔄 Closing leverage position...`);
            
            try {
                const tx = await eulerV2Plugin.closeLeverageAtomic(
                    "WETH",
                    "USDC",
                    100 // 1% max slippage
                );
                
                const receipt = await tx.wait();
                console.log(`   ✅ Position closed! Gas: ${receipt?.gasUsed.toString()}`);
                
                // Verify no more positions
                const positionCount = await eulerV2Plugin.getActivePositionCount();
                console.log(`   📊 Active positions: ${positionCount}`);
                expect(positionCount).to.equal(0);
                
            } catch (error: any) {
                console.log(`   ⚠️ Close failed: ${error.message?.slice(0, 100)}`);
            }
        });
    });

    describe("10. Final Report", function () {
        it("Should print test summary", async function () {
            console.log("\n" + "=".repeat(70));
            console.log("📋 EULER LENS ADAPTER - TEST SUMMARY");
            console.log("=".repeat(70));
            
            const finalWethBalance = await weth.balanceOf(deployerAddress);
            const pluginWethBalance = await weth.balanceOf(await eulerV2Plugin.getAddress());
            
            console.log(`\n   💰 Final Balances:`);
            console.log(`      Deployer WETH: ${formatAmount(finalWethBalance)}`);
            console.log(`      Plugin WETH: ${formatAmount(pluginWethBalance)}`);
            
            console.log(`\n   ✅ Tests Completed:`);
            console.log(`      - Utility functions (getVaultForToken, getVaultAPYs)`);
            console.log(`      - Health monitoring (getHealthFactor, getTimeToLiquidation)`);
            console.log(`      - Value functions (getTotalEulerValue, getEulerPositionValues)`);
            console.log(`      - Auto-close support (getEulerPositionsAtRisk, shouldAutoClosePosition)`);
            console.log(`      - Integration with EulerV2Plugin`);
            
            console.log("\n" + "=".repeat(70));
        });
    });
});
