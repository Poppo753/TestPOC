import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * FORK TEST per MorphoPlugin + MorphoRegistry + MorphoLensAdapter
 * 
 * Verifica tutti i flussi del pattern "3 Musketeers" su Morpho Blue Arbitrum:
 * - Registry: configurazione mercati, lookup, admin ops
 * - Plugin: supplyCollateral, withdrawCollateral, borrow, repay, closePosition
 * - LensAdapter: getTotalValue, getHealthFactor, getPositionsAtRisk
 * - Access Control: onlyOwner, onlyProtocolManager, circuit breaker
 * - Custody Model: fondi passano sempre da/verso ProxyGeneral
 * 
 * SETUP:
 *   $env:FORK_ENABLED="true"; npx hardhat test test/integration/MorphoPlugin.fork.test.ts
 */

describe("Morpho Blue Plugin - Comprehensive Fork Tests (Arbitrum Mainnet)", function () {
    this.timeout(300000);

    // ==================== CONTRACTS ====================
    let registry: any;
    let plugin: any;
    let lensAdapter: any;
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;
    let mockFlashLoanService: any;

    // ==================== SIGNERS ====================
    let owner: SignerWithAddress;

    // ==================== TOKEN CONTRACTS ====================
    let wethContract: any;
    let usdcContract: any;

    // ==================== ARBITRUM MAINNET ADDRESSES ====================

    // Morpho Blue singleton
    const MORPHO = "0x6c247b1F6182318877311737BaC0844bAa518F5e";

    // Tokens
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

    // Morpho WETH/USDC 86% LLTV market params (from blue-api.morpho.org)
    const MORPHO_ORACLE = "0x282FEB10549fde52bD61A6979424Ddf18A4971A2";
    const MORPHO_IRM = "0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA";
    const MORPHO_LLTV = "860000000000000000"; // 86%

    // Whale for impersonation
    const WETH_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
    const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    // ==================== SETUP ====================

    before(async function () {
        // Skip if not on fork
        const network = await ethers.provider.getNetwork();
        if (process.env.FORK_ENABLED !== "true" && network.chainId !== 42161n) {
            console.log("⚠️  Skipping fork tests - not running on Arbitrum fork");
            console.log("   Run with: $env:FORK_ENABLED=\"true\"; npx hardhat test test/integration/MorphoPlugin.fork.test.ts");
            this.skip();
        }

        [owner] = await ethers.getSigners();
        console.log("\n🔧 Setting up Morpho Blue Fork Test Environment...");
        console.log(`   Owner: ${owner.address}`);

        // ==================== TOKEN CONTRACTS (needed early for mock setup) ====================

        wethContract = await ethers.getContractAt("IERC20", WETH);
        usdcContract = await ethers.getContractAt("IERC20", USDC);

        // ==================== INJECT MOCK MORPHO IF NOT ON FORK ====================

        const morphoCode = await ethers.provider.getCode(MORPHO);
        if (morphoCode === "0x") {
            console.log("   Morpho Blue not found on fork, injecting MockMorpho...");

            // Deploy MockMorpho locally, then inject its bytecode at the MORPHO address
            const MockMorphoFactory = await ethers.getContractFactory("MockMorpho");
            const tempMock = await MockMorphoFactory.deploy();
            await tempMock.waitForDeployment();
            const mockBytecode = await ethers.provider.getCode(await tempMock.getAddress());
            await ethers.provider.send("hardhat_setCode", [MORPHO, mockBytecode]);

            // Deploy MockMorphoOracle and inject at oracle address for deterministic pricing
            const MockOracleFactory = await ethers.getContractFactory("MockMorphoOracle");
            const tempOracle = await MockOracleFactory.deploy(0);
            await tempOracle.waitForDeployment();
            const oracleBytecode = await ethers.provider.getCode(await tempOracle.getAddress());
            await ethers.provider.send("hardhat_setCode", [MORPHO_ORACLE, oracleBytecode]);

            // Set oracle price: WETH/USDC ≈ $2500
            // Morpho oracle price = ethPrice * 10^(36 + loanDecimals - collateralDecimals)
            //                      = 2500 * 10^(36 + 6 - 18) = 2500e24
            const mockOracle = await ethers.getContractAt("MockMorphoOracle", MORPHO_ORACLE);
            await mockOracle.setPrice(ethers.parseUnits("2500", 24));

            // Create the market in MockMorpho
            const mockMorpho = await ethers.getContractAt("MockMorpho", MORPHO);
            await mockMorpho.createMarket([USDC, WETH, MORPHO_ORACLE, MORPHO_IRM, BigInt(MORPHO_LLTV)]);

            // Fund MockMorpho with USDC for borrow liquidity
            // Use direct storage manipulation to set USDC balance at MORPHO address
            // USDC on Arbitrum (native) uses slot 9 for balances: balanceOf[addr] = keccak256(addr, 9)
            const usdcBalanceSlot = 9;
            const morphoBalanceSlot = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [MORPHO, usdcBalanceSlot])
            );
            await ethers.provider.send("hardhat_setStorageAt", [
                USDC,
                morphoBalanceSlot,
                ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseUnits("1000000", 6)])
            ]);

            console.log("   ✅ MockMorpho + MockMorphoOracle injected at real addresses");
        }

        // ==================== DEPLOY MOCK INFRA ====================

        const MockBeaconFactory = await ethers.getContractFactory("MockBeacon");
        mockBeacon = await MockBeaconFactory.deploy();
        await mockBeacon.waitForDeployment();

        const MockTokenManagerFactory = await ethers.getContractFactory("MockTokenManager");
        mockTokenManager = await MockTokenManagerFactory.deploy();
        await mockTokenManager.waitForDeployment();

        const MockProxyGeneralFactory = await ethers.getContractFactory("MockProxyGeneral");
        mockProxyGeneral = await MockProxyGeneralFactory.deploy();
        await mockProxyGeneral.waitForDeployment();

        // Deploy MockFlashLoanService for leverage tests
        const MockFlashLoanServiceFactory = await ethers.getContractFactory("MockFlashLoanService");
        mockFlashLoanService = await MockFlashLoanServiceFactory.deploy(WETH, USDC);
        await mockFlashLoanService.waitForDeployment();

        // Fund MockFlashLoanService with WETH + USDC for swap liquidity
        const flashLoanAddr = await mockFlashLoanService.getAddress();

        // Fund WETH via whale impersonation
        await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
        const wethWhale = await ethers.getSigner(WETH_WHALE);
        await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("100"))]);
        // Wrap ETH → WETH for flash loan service (deposit to WETH contract)
        const weth9Abi = ["function deposit() payable"];
        const weth9 = new ethers.Contract(WETH, weth9Abi, wethWhale);
        await weth9.deposit({ value: ethers.parseEther("50") });
        await wethContract.connect(wethWhale).transfer(flashLoanAddr, ethers.parseEther("50"));

        // Fund USDC via storage slot
        const usdcBalanceSlot = 9;
        const flashUsdcSlot = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [flashLoanAddr, usdcBalanceSlot])
        );
        await ethers.provider.send("hardhat_setStorageAt", [
            USDC, flashUsdcSlot,
            ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseUnits("5000000", 6)])
        ]);

        // Configure mock beacon
        await mockBeacon.setImplementation("TokenManager", await mockTokenManager.getAddress());
        await mockBeacon.setImplementation("ProxyGeneral", await mockProxyGeneral.getAddress());
        await mockBeacon.setImplementation("ProtocolManager", owner.address);
        await mockBeacon.setImplementation("LiquidityManager", owner.address);
        await mockBeacon.setImplementation("WETH", WETH);
        await mockBeacon.setImplementation("BASE_ASSET", WETH);
        await mockBeacon.setImplementation("FlashLoanService", flashLoanAddr);

        // Configure mock token manager
        await mockTokenManager.setTokenAddress("WETH", WETH);
        await mockTokenManager.setTokenAddress("USDC", USDC);

        // Set ETH price for LensAdapter calculations
        const ethPriceUsd = ethers.parseUnits("2500", 8); // ~$2500
        await mockTokenManager.setTokenPrice("WETH", ethPriceUsd);
        await mockTokenManager.setTokenPrice("USDC", ethers.parseUnits("1", 8)); // $1

        // ==================== DEPLOY MORPHO REGISTRY ====================

        const RegistryFactory = await ethers.getContractFactory("MorphoRegistry");
        registry = await RegistryFactory.deploy();
        await registry.waitForDeployment();

        // Configure WETH/USDC market
        await registry.configureMarket(
            "WETH", "USDC",
            WETH, USDC,
            MORPHO_ORACLE, MORPHO_IRM, MORPHO_LLTV
        );

        await mockBeacon.setImplementation("MorphoRegistry", await registry.getAddress());

        // ==================== DEPLOY MORPHO PLUGIN ====================

        const PluginFactory = await ethers.getContractFactory("MorphoPlugin");
        plugin = await PluginFactory.deploy(await mockBeacon.getAddress(), "WETH", MORPHO);
        await plugin.waitForDeployment();
        await mockBeacon.setImplementation("MorphoPlugin", await plugin.getAddress());

        // ==================== DEPLOY MORPHO LENS ADAPTER ====================

        const LensFactory = await ethers.getContractFactory("MorphoLensAdapter");
        lensAdapter = await LensFactory.deploy(await mockBeacon.getAddress(), "WETH", MORPHO);
        await lensAdapter.waitForDeployment();
        await mockBeacon.setImplementation("MorphoLensAdapter", await lensAdapter.getAddress());

        console.log(`\n   Registry:     ${await registry.getAddress()}`);
        console.log(`   Plugin:       ${await plugin.getAddress()}`);
        console.log(`   LensAdapter:  ${await lensAdapter.getAddress()}`);
        console.log(`   MockProxy:    ${await mockProxyGeneral.getAddress()}`);
        console.log("✅ Setup completato!\n");
    });

    // ================================================================
    // 1. REGISTRY TESTS
    // ================================================================

    describe("1. MorphoRegistry - Market Configuration", function () {
        it("Should have WETH/USDC market configured", async function () {
            const config = await registry.getMarketConfig("WETH", "USDC");
            expect(config.params.collateralToken).to.equal(WETH);
            expect(config.params.loanToken).to.equal(USDC);
            expect(config.params.oracle).to.equal(MORPHO_ORACLE);
            expect(config.params.irm).to.equal(MORPHO_IRM);
            expect(config.params.lltv).to.equal(BigInt(MORPHO_LLTV));
            expect(config.isActive).to.be.true;
        });

        it("Should return correct market params", async function () {
            const params = await registry.getMarketParams("WETH", "USDC");
            expect(params.collateralToken).to.equal(WETH);
            expect(params.loanToken).to.equal(USDC);
        });

        it("Should report market as configured", async function () {
            expect(await registry.isMarketConfigured("WETH", "USDC")).to.be.true;
            expect(await registry.isMarketConfigured("WETH", "WBTC")).to.be.false;
        });

        it("Should list registered markets", async function () {
            const markets = await registry.getRegisteredMarkets();
            expect(markets.length).to.equal(2); // [collateralCodes, loanCodes]
            expect(markets[0]).to.include("WETH");
            expect(markets[1]).to.include("USDC");
        });

        it("Should return non-zero market ID", async function () {
            const marketId = await registry.getMarketId("WETH", "USDC");
            expect(marketId).to.not.equal(ethers.ZeroHash);
        });

        it("Should revert for unconfigured market", async function () {
            await expect(
                registry.getMarketConfig("INVALID", "TOKEN")
            ).to.be.revertedWithCustomError(registry, "MarketNotConfigured");
        });

        it("Should allow deactivating a market", async function () {
            await registry.setMarketStatus("WETH", "USDC", false);
            const config = await registry.getMarketConfig("WETH", "USDC");
            expect(config.isActive).to.be.false;

            // Reactivate
            await registry.setMarketStatus("WETH", "USDC", true);
            const config2 = await registry.getMarketConfig("WETH", "USDC");
            expect(config2.isActive).to.be.true;
        });

        it("Should reject non-owner calls", async function () {
            const [, attacker] = await ethers.getSigners();
            await expect(
                registry.connect(attacker).configureMarket(
                    "HACK", "TOKEN", WETH, USDC, MORPHO_ORACLE, MORPHO_IRM, MORPHO_LLTV
                )
            ).to.be.reverted;
        });
    });

    // ================================================================
    // 2. PLUGIN TESTS - BASIC
    // ================================================================

    describe("2. MorphoPlugin - Basic Deployment", function () {
        it("Should deploy correctly", async function () {
            expect(await plugin.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("Should have correct owner", async function () {
            expect(await plugin.owner()).to.equal(owner.address);
        });

        it("Should have correct Morpho Blue address", async function () {
            expect(await plugin.MORPHO_ADDRESS()).to.equal(MORPHO);
        });

        it("Should have circuit breaker OFF", async function () {
            expect(await plugin.circuitBreakerTripped()).to.be.false;
        });

        it("Should have correct beacon reference", async function () {
            expect(await plugin.beacon()).to.equal(await mockBeacon.getAddress());
        });
    });

    // ================================================================
    // 3. PLUGIN TESTS - SUPPLY COLLATERAL
    // ================================================================

    describe("3. MorphoPlugin - Supply Collateral", function () {
        before(async function () {
            // Get WETH from whale
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("10")),
            ]);
            // Transfer WETH to plugin
            const amount = ethers.parseEther("1");
            await wethContract.connect(whale).transfer(await plugin.getAddress(), amount);
        });

        it("Should supply WETH collateral to Morpho WETH/USDC market", async function () {
            const supplyAmount = ethers.parseEther("0.5");

            const tx = await plugin.connect(owner).supplyCollateral("WETH", "USDC", supplyAmount);
            const receipt = await tx.wait();
            console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

            // Verify collateral is recorded in Morpho
            const collateral = await plugin.getCollateral("WETH", "USDC");
            expect(collateral).to.be.gte(supplyAmount);
            console.log(`   ✅ Collateral supplied: ${ethers.formatEther(collateral)} WETH`);
        });

        it("Should report collateral via getCollateral()", async function () {
            const collateral = await plugin.getCollateral("WETH", "USDC");
            expect(collateral).to.be.gt(0);
            console.log(`   Collateral: ${ethers.formatEther(collateral)} WETH`);
        });

        it("Should have MAX health factor (no debt)", async function () {
            const hf = await plugin.getHealthFactor("WETH", "USDC");
            expect(hf).to.equal(ethers.MaxUint256);
            console.log(`   Health factor: MAX (no debt)`);
        });

        it("Should deposit via generic deposit() (routes to supplyCollateral)", async function () {
            const additionalAmount = ethers.parseEther("0.3");
            // Plugin already has remaining WETH from the before() hook

            const collateralBefore = await plugin.getCollateral("WETH", "USDC");
            await plugin.connect(owner).deposit("WETH", additionalAmount);
            const collateralAfter = await plugin.getCollateral("WETH", "USDC");
            expect(collateralAfter).to.be.gt(collateralBefore);
            console.log(`   Collateral: ${ethers.formatEther(collateralBefore)} → ${ethers.formatEther(collateralAfter)}`);
        });
    });

    // ================================================================
    // 4. PLUGIN TESTS - BORROW
    // ================================================================

    describe("4. MorphoPlugin - Borrow", function () {
        it("Should borrow USDC against WETH collateral", async function () {
            const borrowAmount = ethers.parseUnits("10", 6); // 10 USDC

            const proxyBefore = await usdcContract.balanceOf(await mockProxyGeneral.getAddress());

            const tx = await plugin.connect(owner).borrow("WETH", "USDC", borrowAmount);
            const receipt = await tx.wait();
            console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

            // Borrowed USDC must be in ProxyGeneral (custody model)
            const proxyAfter = await usdcContract.balanceOf(await mockProxyGeneral.getAddress());
            expect(proxyAfter - proxyBefore).to.equal(borrowAmount);
            console.log(`   ✅ ${ethers.formatUnits(borrowAmount, 6)} USDC borrowed → ProxyGeneral`);
        });

        it("Should report correct debt via getDebt()", async function () {
            const debt = await plugin.getDebt("WETH", "USDC");
            expect(debt).to.be.gt(0);
            console.log(`   USDC debt: ${ethers.formatUnits(debt, 6)}`);
        });

        it("Should have health factor > 1 after borrow", async function () {
            const hf = await plugin.getHealthFactor("WETH", "USDC");
            // HF is a raw multiplier (not WAD-scaled): >1 = healthy
            expect(hf).to.be.gt(1);
            expect(hf).to.not.equal(ethers.MaxUint256);
            console.log(`   Health Factor: ${hf.toString()}x`);
        });

        it("Should borrow with specific market params", async function () {
            const borrowAmount = ethers.parseUnits("5", 6); // 5 more USDC
            const debtBefore = await plugin.getDebt("WETH", "USDC");

            await plugin.connect(owner).borrow("WETH", "USDC", borrowAmount);

            const debtAfter = await plugin.getDebt("WETH", "USDC");
            expect(debtAfter).to.be.gt(debtBefore);
            console.log(`   Debt: ${ethers.formatUnits(debtBefore, 6)} → ${ethers.formatUnits(debtAfter, 6)} USDC`);
        });
    });

    // ================================================================
    // 5. PLUGIN TESTS - REPAY
    // ================================================================

    describe("5. MorphoPlugin - Repay", function () {
        it("Should repay partial USDC debt", async function () {
            const repayAmount = ethers.parseUnits("5", 6); // 5 USDC

            // Send MORE USDC than repayAmount so plugin takes partial repay path
            // (plugin uses full repay by shares when amount >= balance)
            await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
            const whale = await ethers.getSigner(USDC_WHALE);
            await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
            await usdcContract.connect(whale).transfer(await plugin.getAddress(), ethers.parseUnits("10", 6));

            const debtBefore = await plugin.getDebt("WETH", "USDC");
            await plugin.connect(owner).repay("WETH", "USDC", repayAmount);
            const debtAfter = await plugin.getDebt("WETH", "USDC");

            expect(debtAfter).to.be.lt(debtBefore);
            console.log(`   Debt: ${ethers.formatUnits(debtBefore, 6)} → ${ethers.formatUnits(debtAfter, 6)} USDC`);
        });

        it("Should repay all debt (amount = 0)", async function () {
            // Send enough USDC to cover remaining debt + interest
            const currentDebt = await plugin.getDebt("WETH", "USDC");
            const extra = currentDebt + ethers.parseUnits("1", 6); // extra for interest

            await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
            const whale = await ethers.getSigner(USDC_WHALE);
            await usdcContract.connect(whale).transfer(await plugin.getAddress(), extra);

            await plugin.connect(owner).repay("WETH", "USDC", 0); // 0 = repay all

            const debtAfter = await plugin.getDebt("WETH", "USDC");
            expect(debtAfter).to.equal(0);
            console.log(`   ✅ All debt repaid. Remaining: ${ethers.formatUnits(debtAfter, 6)} USDC`);
        });

        it("Should have MAX health factor after full repay", async function () {
            const hf = await plugin.getHealthFactor("WETH", "USDC");
            expect(hf).to.equal(ethers.MaxUint256);
        });
    });

    // ================================================================
    // 6. PLUGIN TESTS - WITHDRAW COLLATERAL
    // ================================================================

    describe("6. MorphoPlugin - Withdraw Collateral", function () {
        it("Should withdraw partial collateral", async function () {
            const collateralBefore = await plugin.getCollateral("WETH", "USDC");
            const withdrawAmount = ethers.parseEther("0.1");

            const proxyWethBefore = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            await plugin.connect(owner).withdrawCollateral("WETH", "USDC", withdrawAmount);
            const proxyWethAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());

            expect(proxyWethAfter - proxyWethBefore).to.equal(withdrawAmount);
            const collateralAfter = await plugin.getCollateral("WETH", "USDC");
            expect(collateralAfter).to.be.lt(collateralBefore);
            console.log(`   Collateral: ${ethers.formatEther(collateralBefore)} → ${ethers.formatEther(collateralAfter)} WETH`);
        });

        it("Should withdraw all collateral (amount = 0)", async function () {
            await plugin.connect(owner).withdrawCollateral("WETH", "USDC", 0); // 0 = withdraw all

            const collateralAfter = await plugin.getCollateral("WETH", "USDC");
            expect(collateralAfter).to.equal(0);
            console.log(`   ✅ All collateral withdrawn`);
        });

        it("Should use generic withdraw() to withdraw collateral", async function () {
            // Supply again first
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
            await wethContract.connect(whale).transfer(await plugin.getAddress(), ethers.parseEther("0.2"));
            await plugin.connect(owner).supplyCollateral("WETH", "USDC", ethers.parseEther("0.2"));

            // Withdraw via generic interface
            await plugin.connect(owner).withdraw("WETH", ethers.parseEther("0.1"));

            const collateral = await plugin.getCollateral("WETH", "USDC");
            expect(collateral).to.be.gt(0);
            console.log(`   Remaining collateral: ${ethers.formatEther(collateral)} WETH`);
        });
    });

    // ================================================================
    // 7. PLUGIN TESTS - CLOSE POSITION
    // ================================================================

    describe("7. MorphoPlugin - Close Position", function () {
        before(async function () {
            // Setup: supply collateral and borrow
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);

            await wethContract.connect(whale).transfer(await plugin.getAddress(), ethers.parseEther("0.5"));
            await plugin.connect(owner).supplyCollateral("WETH", "USDC", ethers.parseEther("0.5"));
            await plugin.connect(owner).borrow("WETH", "USDC", ethers.parseUnits("20", 6));
        });

        it("Should close market position (repay all + withdraw all)", async function () {
            // Send USDC to repay
            await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
            const whale = await ethers.getSigner(USDC_WHALE);
            await usdcContract.connect(whale).transfer(await plugin.getAddress(), ethers.parseUnits("25", 6));

            await plugin.connect(owner).closeMarketPosition("WETH", "USDC");

            const debt = await plugin.getDebt("WETH", "USDC");
            const collateral = await plugin.getCollateral("WETH", "USDC");
            expect(debt).to.equal(0);
            expect(collateral).to.equal(0);
            console.log(`   ✅ Position closed. Debt: ${debt}, Collateral: ${collateral}`);
        });
    });

    // ================================================================
    // 8. PLUGIN TESTS - CIRCUIT BREAKER
    // ================================================================

    describe("8. MorphoPlugin - Circuit Breaker", function () {
        it("Should allow owner to activate circuit breaker", async function () {
            await plugin.connect(owner).activateCircuitBreaker();
            expect(await plugin.circuitBreakerTripped()).to.be.true;
        });

        it("Should block operations when circuit breaker is active", async function () {
            await expect(
                plugin.connect(owner).deposit("WETH", ethers.parseEther("0.1"))
            ).to.be.revertedWithCustomError(plugin, "CircuitBreakerActive");
        });

        it("Should allow owner to deactivate circuit breaker", async function () {
            await plugin.connect(owner).deactivateCircuitBreaker();
            expect(await plugin.circuitBreakerTripped()).to.be.false;
        });
    });

    // ================================================================
    // 9. LENS ADAPTER TESTS
    // ================================================================

    describe("9. MorphoLensAdapter - Value & Health Monitoring", function () {
        before(async function () {
            // Setup position for lens tests
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);

            await wethContract.connect(whale).transfer(await plugin.getAddress(), ethers.parseEther("0.5"));
            await plugin.connect(owner).supplyCollateral("WETH", "USDC", ethers.parseEther("0.5"));
            await plugin.connect(owner).borrow("WETH", "USDC", ethers.parseUnits("50", 6));
        });

        it("Should return total value > 0", async function () {
            const totalValue = await lensAdapter.getTotalValue();
            expect(totalValue).to.be.gt(0);
            console.log(`   Total value (ETH): ${ethers.formatEther(totalValue)}`);
        });

        it("Should return health factor > 1", async function () {
            const hf = await lensAdapter.getHealthFactor();
            // HF is raw multiplier from Morpho (not WAD-scaled): >1 = healthy
            expect(hf).to.be.gt(1);
            console.log(`   Health factor: ${hf.toString()}x`);
        });

        it("Should return protocol-level limits", async function () {
            const [minHF, maxLev] = await lensAdapter.getProtocolLimits();
            expect(minHF).to.be.gt(ethers.parseEther("1"));
            expect(maxLev).to.be.gt(0);
            console.log(`   Min HF: ${ethers.formatEther(minHF)}, Max Leverage: ${maxLev.toString()}`);
        });

        after(async function () {
            // Cleanup position after lens tests
            try {
                await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
                const whale = await ethers.getSigner(USDC_WHALE);
                await usdcContract.connect(whale).transfer(await plugin.getAddress(), ethers.parseUnits("60", 6));
                await plugin.connect(owner).closeMarketPosition("WETH", "USDC");
            } catch {}
        });
    });

    // ================================================================
    // 10. ACCESS CONTROL TESTS
    // ================================================================

    describe("10. MorphoPlugin - Access Control", function () {
        it("Should reject non-owner calls to supplyCollateral", async function () {
            const [, attacker] = await ethers.getSigners();
            await expect(
                plugin.connect(attacker).supplyCollateral("WETH", "USDC", ethers.parseEther("0.1"))
            ).to.be.revertedWithCustomError(plugin, "OnlyProtocolManager");
        });

        it("Should reject non-owner calls to borrow", async function () {
            const [, attacker] = await ethers.getSigners();
            await expect(
                plugin.connect(attacker).borrow("WETH", "USDC", ethers.parseUnits("10", 6))
            ).to.be.revertedWithCustomError(plugin, "OnlyProtocolManager");
        });

        it("Should reject non-owner activateCircuitBreaker", async function () {
            const [, attacker] = await ethers.getSigners();
            await expect(
                plugin.connect(attacker).activateCircuitBreaker()
            ).to.be.reverted;
        });
    });

    // ================================================================
    // 11. LEVERAGE TESTS - OPEN
    // ================================================================

    describe("11. MorphoPlugin - openLeverageAtomic (2x)", function () {
        const COLLATERAL_AMOUNT = ethers.parseEther("0.5");

        before(async function () {
            // Ensure no leftover position
            try {
                const collateral = await plugin.getCollateral("WETH", "USDC");
                if (collateral > 0) {
                    // Fund for repay if needed
                    const usdcSlot = 9;
                    const pluginAddr = await plugin.getAddress();
                    const pluginUsdcSlot = ethers.keccak256(
                        ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [pluginAddr, usdcSlot])
                    );
                    await ethers.provider.send("hardhat_setStorageAt", [
                        USDC, pluginUsdcSlot,
                        ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseUnits("50000", 6)])
                    ]);
                    await plugin.connect(owner).closeMarketPosition("WETH", "USDC");
                }
            } catch {}

            // Transfer WETH to owner for collateral deposit
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("100"))]);
            // Wrap ETH → WETH
            const weth9Abi = ["function deposit() payable"];
            const weth9 = new ethers.Contract(WETH, weth9Abi, whale);
            await weth9.deposit({ value: ethers.parseEther("5") });
            await wethContract.connect(whale).transfer(owner.address, ethers.parseEther("5"));

            // Approve plugin to pull WETH
            await wethContract.connect(owner).approve(await plugin.getAddress(), ethers.MaxUint256);
        });

        it("Should open 2x leverage position ATOMICALLY", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const tx = await plugin.connect(owner).openLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                collateralAmount: COLLATERAL_AMOUNT,
                targetLeverageX100: 200, // 2x
                minHealthFactor: 1,      // raw multiplier (not WAD)
                deadline: deadline,
            });
            const receipt = await tx.wait();
            console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);
        });

        it("Should have collateral > initial amount (leveraged)", async function () {
            const collateral = await plugin.getCollateral("WETH", "USDC");
            // 2x leverage on 0.5 WETH → ~1.0 WETH collateral total
            expect(collateral).to.be.gt(COLLATERAL_AMOUNT);
            console.log(`   Collateral: ${ethers.formatEther(collateral)} WETH (initial: ${ethers.formatEther(COLLATERAL_AMOUNT)})`);
        });

        it("Should have USDC debt > 0", async function () {
            const debt = await plugin.getDebt("WETH", "USDC");
            expect(debt).to.be.gt(0);
            console.log(`   Debt: ${ethers.formatUnits(debt, 6)} USDC`);
        });

        it("Should have healthy HF after leverage", async function () {
            const hf = await plugin.getHealthFactor("WETH", "USDC");
            expect(hf).to.be.gte(1);
            expect(hf).to.not.equal(ethers.MaxUint256);
            console.log(`   Health Factor: ${hf.toString()}x`);
        });

        it("Should reject invalid leverage (too low)", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            await expect(
                plugin.connect(owner).openLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    collateralAmount: ethers.parseEther("0.1"),
                    targetLeverageX100: 100, // 1x = invalid, must be >= 110
                    minHealthFactor: 1,
                    deadline: deadline,
                })
            ).to.be.revertedWithCustomError(plugin, "InvalidLeverage");
        });

        it("Should reject expired deadline", async function () {
            await expect(
                plugin.connect(owner).openLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    collateralAmount: ethers.parseEther("0.1"),
                    targetLeverageX100: 200,
                    minHealthFactor: 1,
                    deadline: 1, // expired
                })
            ).to.be.revertedWithCustomError(plugin, "DeadlineExpired");
        });
    });

    // ================================================================
    // 12. LEVERAGE TESTS - CLOSE
    // ================================================================

    describe("12. MorphoPlugin - closeLeverageAtomic", function () {
        it("Should close leverage position ATOMICALLY", async function () {
            // Verify we have an open position first
            const debtBefore = await plugin.getDebt("WETH", "USDC");
            expect(debtBefore).to.be.gt(0, "No open position to close");

            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const tx = await plugin.connect(owner).closeLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                maxSlippageBps: 500,  // 5% slippage tolerance
                deadline: deadline,
            });
            const receipt = await tx.wait();
            console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);
        });

        it("Should have NO debt remaining", async function () {
            const debt = await plugin.getDebt("WETH", "USDC");
            expect(debt).to.equal(0);
            console.log(`   ✅ Debt: ${ethers.formatUnits(debt, 6)} USDC`);
        });

        it("Should have NO collateral remaining", async function () {
            const collateral = await plugin.getCollateral("WETH", "USDC");
            expect(collateral).to.equal(0);
            console.log(`   ✅ Collateral: ${ethers.formatEther(collateral)} WETH`);
        });

        it("Should have returned WETH equity to owner", async function () {
            // Owner should have received some WETH back (the equity after unwinding)
            const ownerWeth = await wethContract.balanceOf(owner.address);
            expect(ownerWeth).to.be.gt(0);
            console.log(`   Owner WETH: ${ethers.formatEther(ownerWeth)}`);
        });

        it("Should have MAX health factor (no position)", async function () {
            const hf = await plugin.getHealthFactor("WETH", "USDC");
            expect(hf).to.equal(ethers.MaxUint256);
        });

        it("Should reject close when no position exists", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            await expect(
                plugin.connect(owner).closeLeverageAtomic({
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    maxSlippageBps: 200,
                    deadline: deadline,
                })
            ).to.be.revertedWithCustomError(plugin, "NoPositionToClose");
        });
    });
});
