import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * FORK TEST ESAUSTIVO per AaveV3Plugin + AaveV3Registry + AaveV3LensAdapter
 * 
 * Verifica tutti i flussi del pattern "3 Musketeers" su Aave V3 Arbitrum:
 * - Registry: configurazione token, aToken/debtToken lookup, admin ops
 * - Plugin: deposit, withdraw, borrow, repay, closePosition, emergency, circuit breaker
 * - LensAdapter: getTotalValue, getHealthFactor, getPositionsAtRisk, getValueBreakdown
 * - Access Control: onlyOwner, onlyProtocolManager, circuit breaker
 * - Custody Model: fondi passano sempre da/verso ProxyGeneral
 * 
 * SETUP:
 *   $env:FORK_ENABLED="true"; npx hardhat test test/integration/AaveV3Plugin.fork.test.ts
 */

describe("AaveV3 Plugin - Comprehensive Fork Tests (Arbitrum Mainnet)", function () {
    this.timeout(180000);

    // ==================== CONTRACTS ====================
    let registry: any;
    let plugin: any;
    let lensAdapter: any;
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;

    // ==================== SIGNERS ====================
    let owner: SignerWithAddress;

    // ==================== TOKEN CONTRACTS ====================
    let wethContract: any;
    let usdcContract: any;

    // ==================== ARBITRUM MAINNET ADDRESSES ====================

    // Aave V3 Core
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";

    // Tokens
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Native USDC

    // Whale per impersonazione (Aave V3 Pool ha molta liquidità, ma usiamo whale nota)
    const WETH_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A"; // Binance
    const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    // ProxyGeneral reale (per check balance su mainnet fork)
    const PROXY_GENERAL_REAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

    // Discovered aToken/debtToken (populated in before())
    let aWETH: string;
    let aUSDC: string;
    let variableDebtWETH: string;
    let variableDebtUSDC: string;

    // ==================== SETUP ====================

    before(async function () {
        // Skip se non siamo su fork
        const network = await ethers.provider.getNetwork();
        if (process.env.FORK_ENABLED !== "true" && network.chainId !== 42161n) {
            console.log("⚠️  Skipping fork tests - not running on Arbitrum fork");
            console.log("   Run with: $env:FORK_ENABLED=\"true\"; npx hardhat test test/integration/AaveV3Plugin.fork.test.ts");
            this.skip();
        }

        [owner] = await ethers.getSigners();
        console.log("\n🔧 Setting up AaveV3 Fork Test Environment...");
        console.log(`   Owner: ${owner.address}`);
        console.log(`   Network chainId: ${network.chainId}`);

        // ==================== DISCOVER AAVE TOKENS ====================

        console.log("\n📡 Querying Aave V3 Pool per aToken/debtToken...");
        const pool = await ethers.getContractAt(
            [
                "function getReserveAToken(address) view returns (address)",
                "function getReserveVariableDebtToken(address) view returns (address)",
            ],
            AAVE_POOL
        );

        aWETH = await pool.getReserveAToken(WETH);
        aUSDC = await pool.getReserveAToken(USDC);
        variableDebtWETH = await pool.getReserveVariableDebtToken(WETH);
        variableDebtUSDC = await pool.getReserveVariableDebtToken(USDC);

        console.log(`   aWETH: ${aWETH}`);
        console.log(`   aUSDC: ${aUSDC}`);
        console.log(`   variableDebtWETH: ${variableDebtWETH}`);
        console.log(`   variableDebtUSDC: ${variableDebtUSDC}`);

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

        // Configura mock beacon
        await mockBeacon.setImplementation("TokenManager", await mockTokenManager.getAddress());
        await mockBeacon.setImplementation("ProxyGeneral", await mockProxyGeneral.getAddress());
        await mockBeacon.setImplementation("ProtocolManager", owner.address);
        await mockBeacon.setImplementation("LiquidityManager", owner.address);
        await mockBeacon.setImplementation("WETH", WETH);
        await mockBeacon.setImplementation("BASE_ASSET", WETH);

        // Configura mock token manager
        await mockTokenManager.setTokenAddress("WETH", WETH);
        await mockTokenManager.setTokenAddress("USDC", USDC);

        // Set WETH price from Aave Oracle (needed by LensAdapter._baseToEth)
        const aaveOracle = await ethers.getContractAt(
            ["function getAssetPrice(address) view returns (uint256)"],
            "0xb56c2F0B653B2e0b10C9b928C8580Ac5Df02C7C7"
        );
        const ethPriceUsd = await aaveOracle.getAssetPrice(WETH);
        await mockTokenManager.setTokenPrice("WETH", ethPriceUsd);
        console.log(`   ETH/USD price (8dec): ${ethPriceUsd}`);

        // ==================== DEPLOY AAVE V3 REGISTRY ====================

        const RegistryFactory = await ethers.getContractFactory("AaveV3Registry");
        registry = await RegistryFactory.deploy();
        await registry.waitForDeployment();

        // Configura token NEL registry PRIMA di transferOwnership
        await registry.configureToken("WETH", WETH, aWETH, variableDebtWETH);
        await registry.configureToken("USDC", USDC, aUSDC, variableDebtUSDC);

        await mockBeacon.setImplementation("AaveV3Registry", await registry.getAddress());

        // ==================== DEPLOY AAVE V3 PLUGIN ====================

        const PluginFactory = await ethers.getContractFactory("AaveV3Plugin");
        plugin = await PluginFactory.deploy(await mockBeacon.getAddress(), "WETH");
        await plugin.waitForDeployment();
        await mockBeacon.setImplementation("AaveV3Plugin", await plugin.getAddress());

        // Transfer Registry ownership al Plugin (come da guida)
        // NOTA: Per i test, manteniamo owner come owner del registry per poter modificarlo
        // In produzione, ownership va al plugin
        // await registry.transferOwnership(await plugin.getAddress());

        // ==================== DEPLOY AAVE V3 LENS ADAPTER ====================

        const LensFactory = await ethers.getContractFactory("AaveV3LensAdapter");
        lensAdapter = await LensFactory.deploy(await mockBeacon.getAddress(), "WETH");
        await lensAdapter.waitForDeployment();
        await mockBeacon.setImplementation("AaveV3LensAdapter", await lensAdapter.getAddress());

        // ==================== TOKEN CONTRACTS ====================

        wethContract = await ethers.getContractAt("IERC20", WETH);
        usdcContract = await ethers.getContractAt("IERC20", USDC);

        console.log(`\n   Registry:     ${await registry.getAddress()}`);
        console.log(`   Plugin:       ${await plugin.getAddress()}`);
        console.log(`   LensAdapter:  ${await lensAdapter.getAddress()}`);
        console.log(`   MockProxy:    ${await mockProxyGeneral.getAddress()}`);
        console.log("✅ Setup completato!\n");
    });

    // ==================== CLEANUP HELPER ====================

    async function cleanupAllPositions() {
        // 1. Repay any outstanding USDC debt
        try {
            const usdcDebt = await plugin.getDebt("USDC");
            if (usdcDebt > 0n) {
                const margin = usdcDebt + (usdcDebt / 50n);
                await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
                const whale = await ethers.getSigner(USDC_WHALE);
                await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
                await usdcContract.connect(whale).transfer(await plugin.getAddress(), margin);
                await plugin.connect(owner).repay("USDC", 0);
            }
        } catch {}
        // 2. Withdraw any remaining WETH collateral
        try {
            const balance = await plugin.getBalance("WETH");
            if (balance > 0n) {
                await plugin.connect(owner).withdraw("WETH", 0);
            }
        } catch {}
    }

    // ================================================================
    // 1. REGISTRY TESTS
    // ================================================================

    describe("1. AaveV3Registry - Token Configuration", function () {
        it("Should have WETH configured", async function () {
            const config = await registry.getTokenConfig("WETH");
            expect(config.underlying).to.equal(WETH);
            expect(config.aToken).to.equal(aWETH);
            expect(config.variableDebtToken).to.equal(variableDebtWETH);
            expect(config.isActive).to.be.true;
        });

        it("Should have USDC configured", async function () {
            const config = await registry.getTokenConfig("USDC");
            expect(config.underlying).to.equal(USDC);
            expect(config.aToken).to.equal(aUSDC);
            expect(config.variableDebtToken).to.equal(variableDebtUSDC);
            expect(config.isActive).to.be.true;
        });

        it("Should return correct underlying addresses", async function () {
            expect(await registry.getUnderlying("WETH")).to.equal(WETH);
            expect(await registry.getUnderlying("USDC")).to.equal(USDC);
        });

        it("Should return correct aToken addresses", async function () {
            expect(await registry.getAToken("WETH")).to.equal(aWETH);
            expect(await registry.getAToken("USDC")).to.equal(aUSDC);
        });

        it("Should return correct variableDebtToken addresses", async function () {
            expect(await registry.getVariableDebtToken("WETH")).to.equal(variableDebtWETH);
            expect(await registry.getVariableDebtToken("USDC")).to.equal(variableDebtUSDC);
        });

        it("Should list registered tokens", async function () {
            const tokens = await registry.getRegisteredTokens();
            expect(tokens).to.include("WETH");
            expect(tokens).to.include("USDC");
            expect(await registry.getRegisteredTokenCount()).to.equal(2);
        });

        it("Should revert for unconfigured token", async function () {
            await expect(
                registry.getTokenConfig("INVALID")
            ).to.be.revertedWithCustomError(registry, "TokenNotConfigured");
        });

        it("Should allow deactivating a token", async function () {
            await registry.setTokenActive("USDC", false);
            const config = await registry.getTokenConfig("USDC");
            expect(config.isActive).to.be.false;

            // Riattiva per i test successivi
            await registry.setTokenActive("USDC", true);
            const config2 = await registry.getTokenConfig("USDC");
            expect(config2.isActive).to.be.true;
        });

        it("Should revert configureToken with empty tokenCode", async function () {
            await expect(
                registry.configureToken("", WETH, aWETH, variableDebtWETH)
            ).to.be.revertedWithCustomError(registry, "TokenCodeEmpty");
        });

        it("Should revert configureToken with zero address", async function () {
            await expect(
                registry.configureToken("TEST", ethers.ZeroAddress, aWETH, variableDebtWETH)
            ).to.be.revertedWithCustomError(registry, "InvalidAddress");
        });
    });

    describe("2. AaveV3Registry - Admin Operations", function () {
        it("Should allow batch configuration", async function () {
            // Aggiungi USDT per test
            const usdtUnderlying = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
            const pool = await ethers.getContractAt(
                [
                    "function getReserveAToken(address) view returns (address)",
                    "function getReserveVariableDebtToken(address) view returns (address)",
                ],
                AAVE_POOL
            );

            let aUSDT: string, debtUSDT: string;
            try {
                aUSDT = await pool.getReserveAToken(usdtUnderlying);
                debtUSDT = await pool.getReserveVariableDebtToken(usdtUnderlying);
            } catch {
                console.log("   ⚠️ USDT non disponibile nel Pool, skip batch test");
                this.skip();
                return;
            }

            await registry.configureTokensBatch(
                ["USDT"],
                [usdtUnderlying],
                [aUSDT],
                [debtUSDT]
            );

            const config = await registry.getTokenConfig("USDT");
            expect(config.underlying).to.equal(usdtUnderlying);
            expect(config.aToken).to.equal(aUSDT);
            console.log(`   ✅ USDT batch-configured`);
        });

        it("Should allow removing a token", async function () {
            // Rimuovi USDT aggiunto sopra
            const countBefore = await registry.getRegisteredTokenCount();
            if (await registry.isTokenConfigured("USDT")) {
                await registry.removeToken("USDT");
                const countAfter = await registry.getRegisteredTokenCount();
                expect(countAfter).to.equal(countBefore - 1n);
                expect(await registry.isTokenConfigured("USDT")).to.be.false;
            }
        });

        it("Should reject non-owner calls", async function () {
            const [, attacker] = await ethers.getSigners();
            await expect(
                registry.connect(attacker).configureToken("HACK", WETH, aWETH, variableDebtWETH)
            ).to.be.reverted;
        });
    });

    // ================================================================
    // 2. PLUGIN TESTS - BASIC DEPLOYMENT
    // ================================================================

    describe("3. AaveV3Plugin - Basic Deployment", function () {
        it("Should deploy correctly", async function () {
            expect(await plugin.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("Should have correct owner", async function () {
            expect(await plugin.owner()).to.equal(owner.address);
        });

        it("Should have correct Aave Pool address", async function () {
            expect(await plugin.AAVE_POOL_ADDRESS()).to.equal(AAVE_POOL);
        });

        it("Should have circuit breaker OFF", async function () {
            expect(await plugin.circuitBreakerTripped()).to.be.false;
        });

        it("Should have correct beacon reference", async function () {
            expect(await plugin.beacon()).to.equal(await mockBeacon.getAddress());
        });
    });

    // ================================================================
    // 3. PLUGIN TESTS - DEPOSIT
    // ================================================================

    describe("4. AaveV3Plugin - Deposit (Supply)", function () {
        let wethWhale: SignerWithAddress;

        before(async function () {
            // Impersona whale per ottenere WETH
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            wethWhale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("10")),
            ]);
        });

        it("Should deposit WETH into Aave V3", async function () {
            const depositAmount = ethers.parseEther("0.1"); // 0.1 WETH

            // Trasferisci WETH dalla whale al plugin
            await wethContract.connect(wethWhale).transfer(await plugin.getAddress(), depositAmount);

            const pluginBalance = await wethContract.balanceOf(await plugin.getAddress());
            expect(pluginBalance).to.be.gte(depositAmount);

            // Deposita nel Pool Aave
            const tx = await plugin.connect(owner).deposit("WETH", depositAmount);
            const receipt = await tx.wait();

            console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

            // Verifica: plugin ha ricevuto aToken
            const aTokenContract = await ethers.getContractAt("IERC20", aWETH);
            const aTokenBalance = await aTokenContract.balanceOf(await plugin.getAddress());
            expect(aTokenBalance).to.be.gt(0);
            console.log(`   ✅ aWETH received: ${ethers.formatEther(aTokenBalance)}`);
        });

        it("Should report correct balance via getBalance()", async function () {
            const balance = await plugin.getBalance("WETH");
            expect(balance).to.be.gt(0);
            console.log(`   WETH balance in Aave: ${ethers.formatEther(balance)}`);
        });

        it("Should have health factor = MAX (no debt yet)", async function () {
            const hf = await plugin.getHealthFactor();
            expect(hf).to.equal(ethers.MaxUint256);
            console.log(`   Health factor: MAX (no debt)`);
        });

        it("Should deposit multiple times (additive)", async function () {
            const balanceBefore = await plugin.getBalance("WETH");
            const additionalDeposit = ethers.parseEther("0.05");

            await wethContract.connect(wethWhale).transfer(await plugin.getAddress(), additionalDeposit);
            await plugin.connect(owner).deposit("WETH", additionalDeposit);

            const balanceAfter = await plugin.getBalance("WETH");
            expect(balanceAfter).to.be.gt(balanceBefore);
            console.log(`   Balance: ${ethers.formatEther(balanceBefore)} → ${ethers.formatEther(balanceAfter)}`);
        });

        it("Should revert deposit with insufficient balance", async function () {
            await expect(
                plugin.connect(owner).deposit("WETH", ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(plugin, "InsufficientBalance");
        });
    });

    // ================================================================
    // 4. PLUGIN TESTS - BORROW
    // ================================================================

    describe("5. AaveV3Plugin - Borrow", function () {
        it("Should borrow USDC against WETH collateral", async function () {
            const borrowAmount = ethers.parseUnits("10", 6); // 10 USDC

            const proxyBefore = await usdcContract.balanceOf(await mockProxyGeneral.getAddress());

            const tx = await plugin.connect(owner).borrow("USDC", borrowAmount);
            const receipt = await tx.wait();

            console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

            // Borrowed USDC deve essere in ProxyGeneral (custody model!)
            const proxyAfter = await usdcContract.balanceOf(await mockProxyGeneral.getAddress());
            expect(proxyAfter - proxyBefore).to.equal(borrowAmount);
            console.log(`   ✅ ${ethers.formatUnits(borrowAmount, 6)} USDC borrowed → ProxyGeneral`);
        });

        it("Should report correct debt via getDebt()", async function () {
            const debt = await plugin.getDebt("USDC");
            expect(debt).to.be.gt(0);
            console.log(`   USDC debt: ${ethers.formatUnits(debt, 6)}`);
        });

        it("Should have health factor > 1 after borrow", async function () {
            const hf = await plugin.getHealthFactor();
            expect(hf).to.be.gt(ethers.parseEther("1"));
            expect(hf).to.not.equal(ethers.MaxUint256);
            console.log(`   Health factor: ${ethers.formatEther(hf)}`);
        });

        it("Should report zero debt for non-borrowed tokens", async function () {
            const wethDebt = await plugin.getDebt("WETH");
            expect(wethDebt).to.equal(0);
        });

        it("Should report borrow capacity", async function () {
            const capacity = await plugin.getBorrowCapacity("USDC");
            expect(capacity).to.be.gt(0);
            console.log(`   Remaining borrow capacity (base): ${capacity.toString()}`);
        });
    });

    // ================================================================
    // 5. PLUGIN TESTS - REPAY
    // ================================================================

    describe("6. AaveV3Plugin - Repay", function () {
        it("Should repay partial USDC debt", async function () {
            const debtBefore = await plugin.getDebt("USDC");
            if (debtBefore === 0n) {
                console.log("   ⚠️ No debt, skipping repay test");
                this.skip();
            }

            const repayAmount = ethers.parseUnits("5", 6); // 5 USDC

            // Ottieni USDC dalla whale e trasferisci al plugin
            await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
            const usdcWhale = await ethers.getSigner(USDC_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                USDC_WHALE,
                ethers.toQuantity(ethers.parseEther("10")),
            ]);
            await usdcContract.connect(usdcWhale).transfer(await plugin.getAddress(), repayAmount);

            // Repay
            const tx = await plugin.connect(owner).repay("USDC", repayAmount);
            await tx.wait();

            const debtAfter = await plugin.getDebt("USDC");
            expect(debtAfter).to.be.lt(debtBefore);
            console.log(`   ✅ Debt: ${ethers.formatUnits(debtBefore, 6)} → ${ethers.formatUnits(debtAfter, 6)} USDC`);
        });

        it("Should repay full remaining debt (amount=0)", async function () {
            const debtBefore = await plugin.getDebt("USDC");
            if (debtBefore === 0n) {
                console.log("   ⚠️ No debt remaining, skipping");
                this.skip();
            }

            // Invia abbastanza USDC al plugin per ripagare tutto + margine interessi
            const margin = debtBefore / 100n; // 1% margine
            const totalNeeded = debtBefore + margin;

            await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
            const usdcWhale = await ethers.getSigner(USDC_WHALE);
            await usdcContract.connect(usdcWhale).transfer(await plugin.getAddress(), totalNeeded);

            // Repay con amount=0 → ripaga tutto
            const tx = await plugin.connect(owner).repay("USDC", 0);
            await tx.wait();

            const debtAfter = await plugin.getDebt("USDC");
            expect(debtAfter).to.equal(0);
            console.log(`   ✅ Full repay: debt = 0`);
        });

        it("Should return to health factor MAX after full repay", async function () {
            const hf = await plugin.getHealthFactor();
            expect(hf).to.equal(ethers.MaxUint256);
        });

        it("Should handle repay gracefully when no debt exists", async function () {
            // Non dovrebbe revertare, ritorna true con noop
            const result = await plugin.connect(owner).repay.staticCall("USDC", ethers.parseUnits("1", 6));
            expect(result).to.be.true;
        });
    });

    // ================================================================
    // 6. PLUGIN TESTS - WITHDRAW
    // ================================================================

    describe("7. AaveV3Plugin - Withdraw", function () {
        it("Should withdraw WETH to ProxyGeneral", async function () {
            const balance = await plugin.getBalance("WETH");
            if (balance === 0n) {
                console.log("   ⚠️ No WETH deposited, skipping");
                this.skip();
            }

            const withdrawAmount = balance / 2n; // Ritira metà
            const proxyBefore = await wethContract.balanceOf(await mockProxyGeneral.getAddress());

            const tx = await plugin.connect(owner).withdraw("WETH", withdrawAmount);
            await tx.wait();

            // Verify: WETH arrivati a ProxyGeneral (non al plugin o al caller!)
            const proxyAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            const received = proxyAfter - proxyBefore;
            expect(received).to.be.gte(withdrawAmount - 1n); // -1 per arrotondamento
            console.log(`   ✅ Withdrawn ${ethers.formatEther(received)} WETH → ProxyGeneral`);
        });

        it("Should withdraw remaining WETH (amount=0 = max)", async function () {
            const balance = await plugin.getBalance("WETH");
            if (balance === 0n) {
                console.log("   ⚠️ No WETH remaining, skipping");
                this.skip();
            }

            const proxyBefore = await wethContract.balanceOf(await mockProxyGeneral.getAddress());

            // amount=0 dovrebbe ritirare tutto (implementazione usa type(uint256).max)
            await plugin.connect(owner).withdraw("WETH", 0);

            const proxyAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            const received = proxyAfter - proxyBefore;
            expect(received).to.be.gt(0);

            const remainingBalance = await plugin.getBalance("WETH");
            expect(remainingBalance).to.equal(0);
            console.log(`   ✅ Full withdraw: ${ethers.formatEther(received)} WETH → ProxyGeneral`);
        });

        it("Should revert withdraw with zero aToken balance", async function () {
            await expect(
                plugin.connect(owner).withdraw("WETH", ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(plugin, "InsufficientBalance");
        });
    });

    // ================================================================
    // 7. PLUGIN TESTS - CLOSE POSITION
    // ================================================================

    describe("8. AaveV3Plugin - Close Position (Borrow-Deposit cycle)", function () {
        before(async function () {
            // Ricrea una posizione: deposit WETH + borrow USDC
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("10")),
            ]);

            const depositAmount = ethers.parseEther("0.1");
            await wethContract.connect(whale).transfer(await plugin.getAddress(), depositAmount);
            await plugin.connect(owner).deposit("WETH", depositAmount);

            const borrowAmount = ethers.parseUnits("10", 6);
            await plugin.connect(owner).borrow("USDC", borrowAmount);

            console.log("   Setup: 0.1 WETH collateral + 10 USDC debt");
        });

        it("Should close position (repay debt + withdraw collateral)", async function () {
            // Per closePosition servono USDC nel plugin per ripagare
            const debt = await plugin.getDebt("USDC");
            const margin = debt + (debt / 100n);

            await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
            const usdcWhale = await ethers.getSigner(USDC_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                USDC_WHALE,
                ethers.toQuantity(ethers.parseEther("10")),
            ]);
            await usdcContract.connect(usdcWhale).transfer(await plugin.getAddress(), margin);

            const proxyWethBefore = await wethContract.balanceOf(await mockProxyGeneral.getAddress());

            // Close position (explicit signature to disambiguate from closePosition(uint256))
            const tx = await plugin.connect(owner)["closePosition(string,string)"]("USDC", "WETH");
            await tx.wait();

            // Verifica: debt = 0
            const debtAfter = await plugin.getDebt("USDC");
            expect(debtAfter).to.equal(0);

            // Verifica: WETH arrivato a ProxyGeneral
            const proxyWethAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            expect(proxyWethAfter).to.be.gt(proxyWethBefore);

            // Verifica: nessun aToken rimasto nel plugin
            const aTokenBalance = await (await ethers.getContractAt("IERC20", aWETH)).balanceOf(await plugin.getAddress());
            expect(aTokenBalance).to.equal(0);

            console.log(`   ✅ Position closed`);
            console.log(`   Debt: ${ethers.formatUnits(debt, 6)} → 0 USDC`);
            console.log(`   WETH returned to ProxyGeneral: ${ethers.formatEther(proxyWethAfter - proxyWethBefore)}`);
        });
    });

    // ================================================================
    // 8. PLUGIN TESTS - CLOSE POSITION BY ID
    // ================================================================

    describe("9. AaveV3Plugin - closePosition(positionId) + closePositionsForBaseAsset", function () {
        before(async function () {
            // Cleanup residual state from previous sections
            await cleanupAllPositions();

            // Ricrea posizione per closePosition(uint256)
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);

            const depositAmount = ethers.parseEther("0.05");
            await wethContract.connect(whale).transfer(await plugin.getAddress(), depositAmount);
            await plugin.connect(owner).deposit("WETH", depositAmount);
        });

        it("Should closePosition(0) and return WETH to ProxyGeneral", async function () {
            const proxyBefore = await wethContract.balanceOf(await mockProxyGeneral.getAddress());

            const tx = await plugin.connect(owner)["closePosition(uint256)"](0);
            await tx.wait();

            const proxyAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            const returned = proxyAfter - proxyBefore;
            expect(returned).to.be.gt(0);
            console.log(`   ✅ closePosition(0): ${ethers.formatEther(returned)} WETH → ProxyGeneral`);
        });

        it("Should closePositionsForBaseAsset with target amount", async function () {
            // Deposita di nuovo per testare closePositionsForBaseAsset
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);

            const depositAmount = ethers.parseEther("0.05");
            await wethContract.connect(whale).transfer(await plugin.getAddress(), depositAmount);
            await plugin.connect(owner).deposit("WETH", depositAmount);

            const proxyBefore = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            const target = ethers.parseEther("0.02"); // Chiedi solo 0.02 WETH

            const tx = await plugin.connect(owner).closePositionsForBaseAsset(target);
            await tx.wait();

            const proxyAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            const obtained = proxyAfter - proxyBefore;
            expect(obtained).to.be.gte(target - 1n);
            console.log(`   ✅ closePositionsForBaseAsset: ${ethers.formatEther(obtained)} WETH obtained`);
        });
    });

    // ================================================================
    // 9. PLUGIN TESTS - EMERGENCY
    // ================================================================

    describe("10. AaveV3Plugin - Emergency Operations", function () {
        before(async function () {
            // Cleanup residual state from previous sections
            await cleanupAllPositions();

            // Deposita WETH per testare emergency withdraw
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);

            const depositAmount = ethers.parseEther("0.05");
            await wethContract.connect(whale).transfer(await plugin.getAddress(), depositAmount);
            await plugin.connect(owner).deposit("WETH", depositAmount);
        });

        it("Should emergency withdraw all WETH to ProxyGeneral", async function () {
            const balanceBefore = await plugin.getBalance("WETH");
            if (balanceBefore === 0n) {
                console.log("   ⚠️ No balance for emergency withdraw, skipping");
                this.skip();
            }

            const proxyBefore = await wethContract.balanceOf(await mockProxyGeneral.getAddress());

            await plugin.connect(owner).emergencyWithdrawAll(["WETH"]);

            const balanceAfter = await plugin.getBalance("WETH");
            expect(balanceAfter).to.equal(0);

            const proxyAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            expect(proxyAfter).to.be.gt(proxyBefore);
            console.log(`   ✅ Emergency withdraw: ${ethers.formatEther(proxyAfter - proxyBefore)} WETH → ProxyGeneral`);
        });
    });

    // ================================================================
    // 10. ACCESS CONTROL
    // ================================================================

    describe("11. Access Control", function () {
        it("Should reject deposit from non-owner/non-ProtocolManager", async function () {
            const [, , randomUser] = await ethers.getSigners();
            await expect(
                plugin.connect(randomUser).deposit("WETH", ethers.parseEther("0.001"))
            ).to.be.revertedWithCustomError(plugin, "OnlyProtocolManager");
        });

        it("Should reject borrow from non-owner/non-ProtocolManager", async function () {
            const [, , randomUser] = await ethers.getSigners();
            await expect(
                plugin.connect(randomUser).borrow("USDC", ethers.parseUnits("1", 6))
            ).to.be.revertedWithCustomError(plugin, "OnlyProtocolManager");
        });

        it("Should reject repay from non-owner/non-ProtocolManager", async function () {
            const [, , randomUser] = await ethers.getSigners();
            await expect(
                plugin.connect(randomUser).repay("USDC", ethers.parseUnits("1", 6))
            ).to.be.revertedWithCustomError(plugin, "OnlyProtocolManager");
        });

        it("Should reject withdraw from non-owner/non-ProtocolManager", async function () {
            const [, , randomUser] = await ethers.getSigners();
            await expect(
                plugin.connect(randomUser).withdraw("WETH", ethers.parseEther("0.001"))
            ).to.be.revertedWithCustomError(plugin, "OnlyProtocolManager");
        });

        it("Should allow owner to call deposit (bypass ProtocolManager check)", async function () {
            // Owner può depositare anche se ProtocolManager è un altro indirizzo
            const randomAddr = ethers.Wallet.createRandom().address;
            await mockBeacon.setImplementation("ProtocolManager", randomAddr);

            // Owner manda WETH al plugin e deposita
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await wethContract.connect(whale).transfer(await plugin.getAddress(), ethers.parseEther("0.01"));

            // Owner può depositare (modifier: msg.sender == owner())
            await plugin.connect(owner).deposit("WETH", ethers.parseEther("0.01"));
            console.log("   ✅ Owner can always deposit (bypasses ProtocolManager check)");

            // Cleanup: reset ProtocolManager
            await mockBeacon.setImplementation("ProtocolManager", owner.address);

            // Withdraw per pulizia (try/catch in case there's outstanding debt from prior sections)
            try { await plugin.connect(owner).withdraw("WETH", 0); } catch {}
        });

        it("Should reject emergencyWithdrawAll from non-owner", async function () {
            const [, , randomUser] = await ethers.getSigners();
            await expect(
                plugin.connect(randomUser).emergencyWithdrawAll(["WETH"])
            ).to.be.reverted;
        });
    });

    // ================================================================
    // 11. CIRCUIT BREAKER
    // ================================================================

    describe("12. Circuit Breaker", function () {
        it("Should allow owner to activate circuit breaker", async function () {
            await plugin.connect(owner).activateCircuitBreaker();
            expect(await plugin.circuitBreakerTripped()).to.be.true;
        });

        it("Should block deposit when circuit breaker active", async function () {
            await expect(
                plugin.connect(owner).deposit("WETH", ethers.parseEther("0.001"))
            ).to.be.revertedWithCustomError(plugin, "CircuitBreakerActive");
        });

        it("Should block borrow when circuit breaker active", async function () {
            await expect(
                plugin.connect(owner).borrow("USDC", ethers.parseUnits("1", 6))
            ).to.be.revertedWithCustomError(plugin, "CircuitBreakerActive");
        });

        it("Should block withdraw when circuit breaker active", async function () {
            await expect(
                plugin.connect(owner).withdraw("WETH", ethers.parseEther("0.001"))
            ).to.be.revertedWithCustomError(plugin, "CircuitBreakerActive");
        });

        it("Should block repay when circuit breaker active", async function () {
            await expect(
                plugin.connect(owner).repay("USDC", ethers.parseUnits("1", 6))
            ).to.be.revertedWithCustomError(plugin, "CircuitBreakerActive");
        });

        it("Should block closePosition when circuit breaker active", async function () {
            await expect(
                plugin.connect(owner)["closePosition(string,string)"]("USDC", "WETH")
            ).to.be.revertedWithCustomError(plugin, "CircuitBreakerActive");
        });

        it("Should allow owner to deactivate circuit breaker", async function () {
            await plugin.connect(owner).deactivateCircuitBreaker();
            expect(await plugin.circuitBreakerTripped()).to.be.false;
        });

        it("Should resume operations after deactivation", async function () {
            // Cleanup any residual state first
            await cleanupAllPositions();

            // Deposit piccolo per verificare che le operazioni riprendano
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            const amount = ethers.parseEther("0.01");
            await wethContract.connect(whale).transfer(await plugin.getAddress(), amount);

            // Questo non deve revertare
            await plugin.connect(owner).deposit("WETH", amount);
            const balance = await plugin.getBalance("WETH");
            expect(balance).to.be.gt(0);
            console.log("   ✅ Operations resumed after circuit breaker deactivation");

            // Cleanup
            await plugin.connect(owner).withdraw("WETH", 0);
        });

        it("Should reject activateCircuitBreaker from non-owner", async function () {
            const [, , randomUser] = await ethers.getSigners();
            await expect(
                plugin.connect(randomUser).activateCircuitBreaker()
            ).to.be.reverted;
        });
    });

    // ================================================================
    // 12. LENS ADAPTER TESTS
    // ================================================================

    describe("13. AaveV3LensAdapter - Without Positions", function () {
        before(async function () {
            // Ensure clean state: no positions in Aave
            await cleanupAllPositions();
        });

        it("Should return protocol name = AaveV3", async function () {
            expect(await lensAdapter.protocolName()).to.equal("AaveV3");
        });

        it("Should return protocol type = LENDING", async function () {
            const pType = await lensAdapter.protocolType();
            expect(pType).to.equal(0); // LENDING = 0
        });

        it("Should return circuit breaker status", async function () {
            const isActive = await lensAdapter.isCircuitBreakerActive();
            expect(isActive).to.be.false;
        });

        it("Should return plugin address", async function () {
            const pluginAddr = await lensAdapter.getPlugin();
            expect(pluginAddr).to.equal(await plugin.getAddress());
        });

        it("Should return 0 active positions when nothing deposited", async function () {
            const count = await lensAdapter.getActivePositionCount();
            expect(count).to.equal(0);
        });

        it("Should return 0 for getTotalValue when nothing deposited", async function () {
            const value = await lensAdapter.getTotalValue();
            expect(value).to.equal(0);
        });

        it("Should return health factor MAX when no debt", async function () {
            const hf = await lensAdapter.getHealthFactor();
            expect(hf).to.equal(ethers.MaxUint256);
        });
    });

    describe("14. AaveV3LensAdapter - With Active Position", function () {
        before(async function () {
            // Crea posizione: deposit WETH + borrow USDC
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("10")),
            ]);

            const depositAmount = ethers.parseEther("0.1");
            await wethContract.connect(whale).transfer(await plugin.getAddress(), depositAmount);
            await plugin.connect(owner).deposit("WETH", depositAmount);
            await plugin.connect(owner).borrow("USDC", ethers.parseUnits("10", 6));

            console.log("   Setup: 0.1 WETH collateral + 10 USDC debt");
        });

        after(async function () {
            // Cleanup: ripaga debito e ritira
            const debt = await plugin.getDebt("USDC");
            if (debt > 0n) {
                const margin = debt + (debt / 50n); // 2% margin
                await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
                const usdcWhale = await ethers.getSigner(USDC_WHALE);
                await ethers.provider.send("hardhat_setBalance", [
                    USDC_WHALE,
                    ethers.toQuantity(ethers.parseEther("10")),
                ]);
                await usdcContract.connect(usdcWhale).transfer(await plugin.getAddress(), margin);
                await plugin.connect(owner).repay("USDC", 0);
            }
            const balance = await plugin.getBalance("WETH");
            if (balance > 0n) {
                await plugin.connect(owner).withdraw("WETH", 0);
            }
        });

        it("Should return 1 active position", async function () {
            const count = await lensAdapter.getActivePositionCount();
            expect(count).to.equal(1);
        });

        it("Should return positive net value (collateral > debt)", async function () {
            const value = await lensAdapter.getTotalValue();
            expect(value).to.be.gt(0);
            console.log(`   Net value (ETH): ${ethers.formatEther(value)}`);
        });

        it("Should return valid health factor > 1", async function () {
            const hf = await lensAdapter.getHealthFactor();
            expect(hf).to.be.gt(ethers.parseEther("1"));
            expect(hf).to.not.equal(ethers.MaxUint256);
            console.log(`   Health factor: ${ethers.formatEther(hf)}`);
        });

        it("Should return correct value breakdown", async function () {
            const breakdown = await lensAdapter.getValueBreakdown();
            expect(breakdown.totalCollateral).to.be.gt(0);
            expect(breakdown.totalDebt).to.be.gt(0);
            expect(breakdown.netValue).to.be.gt(0);
            expect(breakdown.totalCollateral).to.be.gt(breakdown.totalDebt);
            console.log(`   Collateral: ${ethers.formatEther(breakdown.totalCollateral)} ETH`);
            console.log(`   Debt:       ${ethers.formatEther(breakdown.totalDebt)} ETH`);
            console.log(`   Net:        ${ethers.formatEther(breakdown.netValue)} ETH`);
        });

        it("Should return healthy protocol summary", async function () {
            const summary = await lensAdapter.getProtocolSummary();
            expect(summary.name).to.equal("AaveV3");
            expect(summary.activePositionCount).to.equal(1);
            expect(summary.netValue).to.be.gt(0);
            expect(summary.lowestHealthFactor).to.be.gt(ethers.parseEther("1"));
            console.log(`   Summary: ${summary.activePositionCount} positions, HF=${ethers.formatEther(summary.lowestHealthFactor)}`);
        });

        it("Should return no positions at risk (healthy position)", async function () {
            const atRisk = await lensAdapter.getPositionsAtRisk(ethers.parseEther("1"));
            expect(atRisk.length).to.equal(0);
        });

        it("Should get position health info", async function () {
            const health = await lensAdapter.getPositionHealth(0);
            expect(health.healthFactor).to.be.gt(ethers.parseEther("1"));
            expect(health.isHealthy).to.be.true;
            console.log(`   Risk level: ${health.riskLevel}`);
        });

        it("Should get account health info", async function () {
            const health = await lensAdapter.getAccountHealth();
            expect(health.healthFactor).to.be.gt(ethers.parseEther("1"));
            expect(health.isHealthy).to.be.true;
        });

        it("Should get positions sorted by risk", async function () {
            const sorted = await lensAdapter.getPositionsSortedByRisk();
            expect(sorted.length).to.equal(1);
            expect(sorted[0].protocolName).to.equal("AaveV3");
        });

        it("Should estimate WETH from close all", async function () {
            const estimate = await lensAdapter.estimateBaseAssetFromCloseAll();
            expect(estimate).to.be.gt(0);
            console.log(`   Estimated WETH from close all: ${ethers.formatEther(estimate)}`);
        });

        it("Should get vault (aToken) for token", async function () {
            const vault = await lensAdapter.getVaultForToken("WETH");
            expect(vault).to.equal(aWETH);
        });

        it("Should get protocol limits", async function () {
            const [minHF, maxLev] = await lensAdapter.getProtocolLimits();
            expect(minHF).to.equal(ethers.parseEther("1.05"));
            expect(maxLev).to.equal(500);
        });

        it("Should get liquidation threshold", async function () {
            const threshold = await lensAdapter.getLiquidationThreshold(0);
            expect(threshold).to.be.gt(0);
            console.log(`   Liquidation threshold: ${ethers.formatEther(threshold)} (${Number(threshold) / 1e16}%)`);
        });
    });

    // ================================================================
    // 13. CUSTODY MODEL VERIFICATION
    // ================================================================

    describe("15. Custody Model - Funds Flow Verification", function () {
        it("Plugin should NOT hold any WETH after withdraw", async function () {
            const pluginWeth = await wethContract.balanceOf(await plugin.getAddress());
            expect(pluginWeth).to.equal(0);
        });

        it("Plugin should NOT hold any USDC after operations", async function () {
            const pluginUsdc = await usdcContract.balanceOf(await plugin.getAddress());
            // Dust da repay overpayment accumulato da più sezioni
            console.log(`   Plugin USDC residual: ${ethers.formatUnits(pluginUsdc, 6)}`);
            expect(pluginUsdc).to.be.lt(ethers.parseUnits("15", 6)); // < 15 USDC (accumulated dust from multiple repays)
        });

        it("Plugin should NOT hold any aTokens after full withdraw", async function () {
            const aTokenContract = await ethers.getContractAt("IERC20", aWETH);
            const aTokenBalance = await aTokenContract.balanceOf(await plugin.getAddress());
            expect(aTokenBalance).to.equal(0);
        });

        it("Full cycle: deposit → borrow → repay → withdraw → all to ProxyGeneral", async function () {
            // Reset: tracked proxy balances
            const proxyWethStart = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            const proxyUsdcStart = await usdcContract.balanceOf(await mockProxyGeneral.getAddress());

            // 1. Deposit 0.05 WETH
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            const depositAmount = ethers.parseEther("0.05");
            await wethContract.connect(whale).transfer(await plugin.getAddress(), depositAmount);
            await plugin.connect(owner).deposit("WETH", depositAmount);

            // 2. Borrow 5 USDC
            const borrowAmount = ethers.parseUnits("5", 6);
            await plugin.connect(owner).borrow("USDC", borrowAmount);

            // USDC arrived at ProxyGeneral
            const proxyUsdcAfterBorrow = await usdcContract.balanceOf(await mockProxyGeneral.getAddress());
            expect(proxyUsdcAfterBorrow - proxyUsdcStart).to.equal(borrowAmount);

            // 3. Repay 5 USDC
            await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
            const usdcWhale = await ethers.getSigner(USDC_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                USDC_WHALE,
                ethers.toQuantity(ethers.parseEther("10")),
            ]);
            const repayNeeded = (await plugin.getDebt("USDC")) + ethers.parseUnits("1", 6); // debt + margin
            await usdcContract.connect(usdcWhale).transfer(await plugin.getAddress(), repayNeeded);
            await plugin.connect(owner).repay("USDC", 0);

            const debtAfter = await plugin.getDebt("USDC");
            expect(debtAfter).to.equal(0);

            // 4. Withdraw all WETH → ProxyGeneral
            await plugin.connect(owner).withdraw("WETH", 0);
            const proxyWethEnd = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            expect(proxyWethEnd).to.be.gt(proxyWethStart);

            // 5. Plugin should hold nothing
            const pluginWeth = await wethContract.balanceOf(await plugin.getAddress());
            const pluginUsdc = await usdcContract.balanceOf(await plugin.getAddress());
            const pluginAWeth = await (await ethers.getContractAt("IERC20", aWETH)).balanceOf(await plugin.getAddress());

            expect(pluginWeth).to.equal(0);
            expect(pluginAWeth).to.equal(0);
            // USDC dust from this single cycle
            expect(pluginUsdc).to.be.lt(ethers.parseUnits("3", 6));

            console.log("   ✅ Full cycle verified:");
            console.log(`      WETH returned to ProxyGeneral: ${ethers.formatEther(proxyWethEnd - proxyWethStart)}`);
            console.log(`      Plugin WETH residual: ${pluginWeth}`);
            console.log(`      Plugin aWETH residual: ${pluginAWeth}`);
            console.log(`      Plugin USDC residual: ${ethers.formatUnits(pluginUsdc, 6)}`);
        });
    });

    // ================================================================
    // 14. AAVE POOL INTEGRATION VERIFICATION
    // ================================================================

    describe("16. Aave V3 Pool Direct Integration", function () {
        it("Should verify Aave Pool is responding", async function () {
            const pool = await ethers.getContractAt(
                ["function getReservesList() view returns (address[])"],
                AAVE_POOL
            );
            const reserves = await pool.getReservesList();
            expect(reserves.length).to.be.gt(0);
            console.log(`   Aave V3 active reserves: ${reserves.length}`);
        });

        it("Should read getUserAccountData for plugin", async function () {
            const pool = await ethers.getContractAt(
                [
                    "function getUserAccountData(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
                ],
                AAVE_POOL
            );

            const [totalCollateral, totalDebt, availableBorrows, liquidationThreshold, ltv, hf] =
                await pool.getUserAccountData(await plugin.getAddress());

            console.log(`   totalCollateral (USD 8dec): ${totalCollateral}`);
            console.log(`   totalDebt (USD 8dec): ${totalDebt}`);
            console.log(`   availableBorrows: ${availableBorrows}`);
            console.log(`   liquidationThreshold: ${liquidationThreshold}`);
            console.log(`   ltv: ${ltv}`);
            console.log(`   healthFactor: ${hf === ethers.MaxUint256 ? "MAX" : ethers.formatEther(hf)}`);
        });

        it("Should verify aToken balanceOf is accurate", async function () {
            // Deposit per verificare
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);
            const amount = ethers.parseEther("0.01");
            await wethContract.connect(whale).transfer(await plugin.getAddress(), amount);
            await plugin.connect(owner).deposit("WETH", amount);

            // aToken balance ≈ deposited amount
            const aTokenBalance = await (await ethers.getContractAt("IERC20", aWETH)).balanceOf(await plugin.getAddress());
            // Tolleranza: ±0.1% per arrotondamento
            const tolerance = amount / 1000n;
            expect(aTokenBalance).to.be.gte(amount - tolerance);
            expect(aTokenBalance).to.be.lte(amount + tolerance);

            // Cleanup
            await plugin.connect(owner).withdraw("WETH", 0);
        });
    });

    // ================================================================
    // 15. EDGE CASES
    // ================================================================

    describe("17. Edge Cases", function () {
        it("Should handle deposit of exact balance (no leftover)", async function () {
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);

            const exact = ethers.parseEther("0.01234567890123456");
            await wethContract.connect(whale).transfer(await plugin.getAddress(), exact);
            await plugin.connect(owner).deposit("WETH", exact);

            const pluginWeth = await wethContract.balanceOf(await plugin.getAddress());
            expect(pluginWeth).to.equal(0); // No leftover WETH
            console.log("   ✅ Exact deposit - no WETH leftover");

            await plugin.connect(owner).withdraw("WETH", 0);
        });

        it("Should handle multiple borrow/repay cycles", async function () {
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const whale = await ethers.getSigner(WETH_WHALE);

            // Deposit collateral
            await wethContract.connect(whale).transfer(await plugin.getAddress(), ethers.parseEther("0.1"));
            await plugin.connect(owner).deposit("WETH", ethers.parseEther("0.1"));

            for (let i = 0; i < 3; i++) {
                // Borrow
                await plugin.connect(owner).borrow("USDC", ethers.parseUnits("2", 6));
                const debt = await plugin.getDebt("USDC");
                expect(debt).to.be.gt(0);

                // Repay
                await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
                const usdcWhale = await ethers.getSigner(USDC_WHALE);
                await ethers.provider.send("hardhat_setBalance", [
                    USDC_WHALE,
                    ethers.toQuantity(ethers.parseEther("10")),
                ]);
                const repayNeeded = debt + ethers.parseUnits("1", 6);
                await usdcContract.connect(usdcWhale).transfer(await plugin.getAddress(), repayNeeded);
                await plugin.connect(owner).repay("USDC", 0);

                const debtAfter = await plugin.getDebt("USDC");
                expect(debtAfter).to.equal(0);
            }

            console.log("   ✅ 3 borrow/repay cycles completed successfully");

            // Cleanup
            await plugin.connect(owner).withdraw("WETH", 0);
        });

        it("Should return correct getBalance for unconfigured token (0)", async function () {
            // Token che non esiste nel registry potrebbe causare un revert,
            // ma getBalance usa try/catch internamente (getATokenSafe)
            const balance = await plugin.getBalance("NONEXISTENT");
            expect(balance).to.equal(0);
        });

        it("Should return 0 debt for unconfigured token", async function () {
            const debt = await plugin.getDebt("NONEXISTENT");
            expect(debt).to.equal(0);
        });
    });
});
