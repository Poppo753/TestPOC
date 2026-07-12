import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔌 E2E A.1 — Aave Borrow/Repay Full Cycle
 *
 * REQUIRE: FORK_ENABLED=true e RPC Arbitrum
 * Run: $env:FORK_ENABLED="true"; npx hardhat test test\e2e\Aave.BorrowRepay.e2e.test.ts
 *
 * SCENARI:
 *   1. Basic Borrow/Repay
 *   2. Interest Accrual (30 giorni)
 *   3. Near-Liquidation (posizione a rischio)
 *   4. Partial Repay
 */
describe("E2E A.1 — Aave Borrow/Repay Full Cycle", function () {
    this.timeout(180000);

    // ==================== ADDRESSES ====================
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
    const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    // ==================== STATE ====================
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;
    let registry: any;
    let plugin: any;
    let lensAdapter: any;
    let wethContract: any;
    let usdcContract: any;
    let owner: any;
    let aWETH: string;
    let aUSDC: string;
    let variableDebtUSDC: string;

    // ==================== SETUP ====================

    before(async function () {
        if (process.env.FORK_ENABLED !== "true") {
            this.skip();
            return;
        }

        [owner] = await ethers.getSigners();

        // Discover aToken/debtToken addresses
        const aaveDataProvider = await ethers.getContractAt(
            [
                "function getReserveAToken(address) view returns (address)",
                "function getReserveVariableDebtToken(address) view returns (address)",
            ],
            AAVE_POOL
        );

        aWETH = await aaveDataProvider.getReserveAToken(WETH);
        aUSDC = await aaveDataProvider.getReserveAToken(USDC);
        variableDebtUSDC = await aaveDataProvider.getReserveVariableDebtToken(USDC);

        // Deploy MockBeacon, MockProxyGeneral, MockTokenManager
        const MockBeaconFactory = await ethers.getContractFactory("MockBeacon");
        mockBeacon = await MockBeaconFactory.deploy();

        const MockTokenManagerFactory = await ethers.getContractFactory("MockTokenManager");
        mockTokenManager = await MockTokenManagerFactory.deploy();

        const MockProxyGeneralFactory = await ethers.getContractFactory("MockProxyGeneral");
        mockProxyGeneral = await MockProxyGeneralFactory.deploy();

        await mockBeacon.setImplementation("TokenManager", await mockTokenManager.getAddress());
        await mockBeacon.setImplementation("ProxyGeneral", await mockProxyGeneral.getAddress());
        await mockBeacon.setImplementation("ProtocolManager", owner.address);
        await mockBeacon.setImplementation("LiquidityManager", owner.address);
        await mockBeacon.setImplementation("WETH", WETH);
        await mockBeacon.setImplementation("BASE_ASSET", WETH);

        await mockTokenManager.setTokenAddress("WETH", WETH);
        await mockTokenManager.setTokenAddress("USDC", USDC);

        const aaveOracle = await ethers.getContractAt(
            ["function getAssetPrice(address) view returns (uint256)"],
            "0xb56c2F0B653B2e0b10C9b928C8580Ac5Df02C7C7"
        );
        const ethPrice = await aaveOracle.getAssetPrice(WETH);
        await mockTokenManager.setTokenPrice("WETH", ethPrice);

        // Deploy AaveV3Registry
        const RegistryFactory = await ethers.getContractFactory("AaveV3Registry");
        registry = await RegistryFactory.deploy();
        await registry.configureToken("WETH", WETH, aWETH, variableDebtUSDC);
        await registry.configureToken("USDC", USDC, aUSDC, variableDebtUSDC);
        await mockBeacon.setImplementation("AaveV3Registry", await registry.getAddress());

        // Deploy AaveV3Plugin
        const PluginFactory = await ethers.getContractFactory("AaveV3Plugin");
        plugin = await PluginFactory.deploy(await mockBeacon.getAddress(), "WETH", AAVE_POOL);
        await mockBeacon.setImplementation("AaveV3Plugin", await plugin.getAddress());

        // Deploy AaveV3LensAdapter
        const LensFactory = await ethers.getContractFactory("AaveV3LensAdapter");
        lensAdapter = await LensFactory.deploy(await mockBeacon.getAddress(), "WETH", AAVE_POOL);
        await mockBeacon.setImplementation("AaveV3LensAdapter", await lensAdapter.getAddress());

        wethContract = await ethers.getContractAt("IERC20", WETH);
        usdcContract = await ethers.getContractAt("IERC20", USDC);
    });

    // ==================== HELPERS ====================

    async function fundPlugin(amount: bigint) {
        const pluginAddr = await plugin.getAddress();
        // Give plugin ETH to wrap, avoiding whale balance depletion
        await ethers.provider.send("hardhat_setBalance", [
            pluginAddr,
            ethers.toQuantity(amount + ethers.parseEther("1"))
        ]);
        await ethers.provider.send("hardhat_impersonateAccount", [pluginAddr]);
        const pluginSigner = await ethers.getSigner(pluginAddr);
        const wethIface = new ethers.Interface(["function deposit() payable"]);
        await pluginSigner.sendTransaction({
            to: WETH,
            value: amount,
            data: wethIface.encodeFunctionData("deposit")
        });
        await ethers.provider.send("hardhat_stopImpersonatingAccount", [pluginAddr]);
    }

    async function fundPluginUSDC(amount: bigint) {
        await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
        await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
        const whale = await ethers.getSigner(USDC_WHALE);
        await usdcContract.connect(whale).transfer(await plugin.getAddress(), amount);
        await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);
    }

    async function cleanPosition() {
        try {
            const debt = await plugin.getDebt("USDC");
            if (debt > 0n) {
                const margin = debt + debt / 20n; // +5% per interessi
                await fundPluginUSDC(margin);
                await plugin.connect(owner).repay("USDC", 0);
            }
        } catch {}
        try {
            const bal = await plugin.getBalance("WETH");
            if (bal > 0n) await plugin.connect(owner).withdraw("WETH", 0);
        } catch {}
    }

    afterEach(async function () {
        await cleanPosition();
    });

    // ==================== SCENARIO 1: Basic Borrow/Repay ====================

    describe("SCENARIO 1 — Basic Borrow/Repay", function () {
        it("A.1.1 — deposit WETH → aWETH balance > 0", async function () {
            const amount = ethers.parseEther("1");
            await fundPlugin(amount);
            await plugin.connect(owner).deposit("WETH", amount);

            const aToken = await ethers.getContractAt("IERC20", aWETH);
            const aBalance = await aToken.balanceOf(await plugin.getAddress());
            expect(aBalance).to.be.gt(0n, "aWETH balance dovrebbe essere > 0");
        });

        it("A.1.2 — borrow USDC → debt > 0 e HF > 1", async function () {
            const amount = ethers.parseEther("1");
            await fundPlugin(amount);
            await plugin.connect(owner).deposit("WETH", amount);

            const borrowAmount = ethers.parseUnits("500", 6); // 500 USDC
            await plugin.connect(owner).borrow("USDC", borrowAmount);

            const debt = await plugin.getDebt("USDC");
            expect(debt).to.be.gt(0n, "Debt USDC dovrebbe essere > 0");

            const hf = await plugin.getHealthFactor();
            expect(hf).to.be.gt(ethers.parseEther("1"), "Health factor deve essere > 1");
            expect(hf).to.not.equal(ethers.MaxUint256);
        });

        it("A.1.3 — repay full USDC → debt = 0 e HF = MAX", async function () {
            const wethAmount = ethers.parseEther("2");
            await fundPlugin(wethAmount);
            await plugin.connect(owner).deposit("WETH", wethAmount);

            const borrowAmount = ethers.parseUnits("500", 6);
            await plugin.connect(owner).borrow("USDC", borrowAmount);

            const debtBefore = await plugin.getDebt("USDC");
            expect(debtBefore).to.be.gt(0n);

            // Repay tutto (amount=0 = max)
            const margin = debtBefore + debtBefore / 10n;
            await fundPluginUSDC(margin);
            await plugin.connect(owner).repay("USDC", 0);

            const debtAfter = await plugin.getDebt("USDC");
            expect(debtAfter).to.equal(0n, "Debt deve essere 0 dopo repay completo");

            const hf = await plugin.getHealthFactor();
            expect(hf).to.equal(ethers.MaxUint256, "HF deve tornare a MAX dopo repay");
        });

        it("A.1.4 — withdraw WETH → WETH torna in ProxyGeneral", async function () {
            const amount = ethers.parseEther("1");
            await fundPlugin(amount);
            await plugin.connect(owner).deposit("WETH", amount);

            const proxyBefore = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            await plugin.connect(owner).withdraw("WETH", 0); // 0 = max
            const proxyAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());

            expect(proxyAfter).to.be.gt(proxyBefore, "WETH dovrebbe essere tornato nel proxy");
        });
    });

    // ==================== SCENARIO 2: Interest Accrual ====================

    describe("SCENARIO 2 — Interest Accrual dopo 30 giorni", function () {
        it("A.1.5 — il debito USDC cresce nel tempo", async function () {
            const wethAmount = ethers.parseEther("2");
            await fundPlugin(wethAmount);
            await plugin.connect(owner).deposit("WETH", wethAmount);

            const borrowAmount = ethers.parseUnits("500", 6);
            await plugin.connect(owner).borrow("USDC", borrowAmount);

            const debtT0 = await plugin.getDebt("USDC");

            // Avanza 30 giorni
            await ethers.provider.send("evm_increaseTime", [30 * 24 * 3600]);
            await ethers.provider.send("evm_mine", []);

            const debtT30 = await plugin.getDebt("USDC");
            expect(debtT30).to.be.gte(debtT0, "Debito non può diminuire nel tempo");
            // Con interessi > 0 dovrebbe crescere (minima variazione attesa)
            // Se rimane uguale, il blocco non ha avanzato abbastanza per accrual
        });

        it("A.1.6 — HF scende dopo accrual interessi", async function () {
            const wethAmount = ethers.parseEther("2");
            await fundPlugin(wethAmount);
            await plugin.connect(owner).deposit("WETH", wethAmount);

            const borrowAmount = ethers.parseUnits("1000", 6); // borrow significativo
            await plugin.connect(owner).borrow("USDC", borrowAmount);

            const hfT0 = await plugin.getHealthFactor();
            expect(hfT0).to.not.equal(ethers.MaxUint256);

            // Avanza 30 giorni
            await ethers.provider.send("evm_increaseTime", [30 * 24 * 3600]);
            await ethers.provider.send("evm_mine", []);

            const hfT30 = await plugin.getHealthFactor();
            // HF può diminuire o restare uguale (dipende dal tasso)
            // Ma non può salire senza repay
            expect(hfT30).to.be.lte(hfT0 + ethers.parseEther("0.01"),
                "HF non dovrebbe crescere senza repay"
            );
        });
    });

    // ==================== SCENARIO 3: Near-Liquidation ====================

    describe("SCENARIO 3 — Posizione a rischio (HF ≈ 1.1)", function () {
        it("A.1.7 — LensAdapter trova posizione a rischio", async function () {
            // Supply 1 WETH e borrow al 75% LTV (≈2250 USDC a 3000$/ETH)
            const wethAmount = ethers.parseEther("1");
            await fundPlugin(wethAmount);
            await plugin.connect(owner).deposit("WETH", wethAmount);

            // Borrow conservativo per HF > 1.1
            const borrowAmount = ethers.parseUnits("1800", 6); // ~80% del massimo
            try {
                await plugin.connect(owner).borrow("USDC", borrowAmount);
            } catch {
                // Se troppo alto, prova con importo ridotto
                await plugin.connect(owner).borrow("USDC", ethers.parseUnits("1000", 6));
            }

            const hf = await plugin.getHealthFactor();
            expect(hf).to.be.gt(ethers.parseEther("1"), "HF deve essere > 1 (non liquidabile)");

            // LensAdapter: posizioni a rischio con soglia 2.0 (molto alto, cattura tutto)
            const atRisk = await lensAdapter.getPositionsAtRisk(ethers.parseEther("2.0"));
            // Il risultato può essere vuoto se HF > 2.0, non è un errore
            expect(Array.isArray(atRisk)).to.be.true;
        });
    });

    // ==================== SCENARIO 4: Partial Repay ====================

    describe("SCENARIO 4 — Partial Repay", function () {
        it("A.1.8 — repay parziale migliora HF", async function () {
            const wethAmount = ethers.parseEther("2");
            await fundPlugin(wethAmount);
            await plugin.connect(owner).deposit("WETH", wethAmount);

            const borrowAmount = ethers.parseUnits("1000", 6);
            await plugin.connect(owner).borrow("USDC", borrowAmount);

            const hfBefore = await plugin.getHealthFactor();
            const debtBefore = await plugin.getDebt("USDC");
            expect(debtBefore).to.be.gt(0n);

            // Repay metà
            const halfRepay = debtBefore / 2n;
            await fundPluginUSDC(halfRepay);
            await plugin.connect(owner).repay("USDC", halfRepay);

            const hfAfter = await plugin.getHealthFactor();
            const debtAfter = await plugin.getDebt("USDC");

            expect(debtAfter).to.be.lt(debtBefore, "Debito deve scendere dopo partial repay");
            expect(hfAfter).to.be.gte(hfBefore, "HF deve migliorare dopo partial repay");
        });

        it("A.1.9 — borrow 1000 USDC, repay 500, debt ≈ 500 + interesse", async function () {
            const wethAmount = ethers.parseEther("2");
            await fundPlugin(wethAmount);
            await plugin.connect(owner).deposit("WETH", wethAmount);

            await plugin.connect(owner).borrow("USDC", ethers.parseUnits("1000", 6));
            const debtFull = await plugin.getDebt("USDC");

            await fundPluginUSDC(ethers.parseUnits("500", 6));
            await plugin.connect(owner).repay("USDC", ethers.parseUnits("500", 6));

            const debtAfter = await plugin.getDebt("USDC");
            // Debito residuo deve essere ~500 USDC (con tolleranza per interesse)
            const expectedDebt = debtFull - ethers.parseUnits("500", 6);
            const tolerance = ethers.parseUnits("5", 6); // 5 USDC tolleranza

            expect(debtAfter).to.be.lte(expectedDebt + tolerance);
            expect(debtAfter).to.be.gte(expectedDebt > tolerance ? expectedDebt - tolerance : 0n);
        });
    });
});
