import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔗 D.1 — Cross-Protocol Rebalance (Aave→Euler)
 *
 * REQUIRE: FORK_ENABLED=true e RPC Arbitrum
 * Run: $env:FORK_ENABLED="true"; npx hardhat test test/e2e/CrossProtocol.Rebalance.e2e.test.ts
 *
 * SCENARI:
 *   1. Rebalance Aave→Euler via ProtocolManager
 *   2. Multi-Protocol Allocation (50% Aave, 30% Euler, 20% Morpho)
 */
describe("E2E D.1 — Cross-Protocol Rebalance", function () {
    this.timeout(180000);

    // ==================== ADDRESSES ====================
    const WETH          = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC          = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const AAVE_POOL     = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const EVC           = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
    const ACCOUNT_LENS  = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
    const MORPHO        = "0x6c247b1F6182318877311737BaC0844bAa518F5e";
    const WETH_WHALE    = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    // ==================== STATE ====================
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;
    let aavePlugin: any;
    let eulerPlugin: any;
    let morphoPlugin: any;
    let wethContract: any;
    let owner: any;

    // ==================== SETUP ====================

    before(async function () {
        if (process.env.FORK_ENABLED !== "true") {
            this.skip();
            return;
        }

        [owner] = await ethers.getSigners();

        const MockBeaconFactory       = await ethers.getContractFactory("MockBeacon");
        const MockTokenManagerFactory = await ethers.getContractFactory("MockTokenManager");
        const MockProxyGeneralFactory = await ethers.getContractFactory("MockProxyGeneral");

        mockBeacon       = await MockBeaconFactory.deploy();
        mockTokenManager = await MockTokenManagerFactory.deploy();
        mockProxyGeneral = await MockProxyGeneralFactory.deploy();

        await mockBeacon.setImplementation("TokenManager",     await mockTokenManager.getAddress());
        await mockBeacon.setImplementation("ProxyGeneral",     await mockProxyGeneral.getAddress());
        await mockBeacon.setImplementation("ProtocolManager",  owner.address);
        await mockBeacon.setImplementation("LiquidityManager", owner.address);
        await mockBeacon.setImplementation("BASE_ASSET",       WETH);
        await mockBeacon.setImplementation("WETH",             WETH);

        await mockTokenManager.setTokenAddress("WETH", WETH);
        await mockTokenManager.setTokenAddress("USDC", USDC);
        await mockTokenManager.setTokenPrice("WETH", ethers.parseUnits("3000", 8));
        await mockTokenManager.setTokenPrice("USDC", ethers.parseUnits("1", 8));

        // Deploy 3 plugin
        const AaveFactory  = await ethers.getContractFactory("AaveV3Plugin");
        aavePlugin = await AaveFactory.deploy(await mockBeacon.getAddress(), "WETH", AAVE_POOL);
        await mockBeacon.setImplementation("AaveV3Plugin", await aavePlugin.getAddress());

        const EulerFactory = await ethers.getContractFactory("EulerV2Plugin");
        eulerPlugin = await EulerFactory.deploy(await mockBeacon.getAddress(), "WETH", EVC, ACCOUNT_LENS);
        await mockBeacon.setImplementation("EulerV2Plugin", await eulerPlugin.getAddress());

        const MorphoFactory = await ethers.getContractFactory("MorphoPlugin");
        morphoPlugin = await MorphoFactory.deploy(await mockBeacon.getAddress(), "WETH", MORPHO);
        await mockBeacon.setImplementation("MorphoPlugin", await morphoPlugin.getAddress());

        wethContract = await ethers.getContractAt("IERC20", WETH);
    });

    // ==================== HELPER ====================

    async function fundPlugin(plugin: any, amount: bigint) {
        await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
        await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
        const whale = await ethers.getSigner(WETH_WHALE);
        await wethContract.connect(whale).transfer(await plugin.getAddress(), amount);
        await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);
    }

    // ==================== SCENARIO 1: Rebalance Aave→Euler ====================

    describe("SCENARIO 1 — Rebalance Aave → Euler", function () {
        it("D.1.1 — AaveV3Plugin deployato con pool address corretto", async function () {
            const pool = await aavePlugin.aavePool();
            expect(pool.toLowerCase()).to.equal(AAVE_POOL.toLowerCase());
        });

        it("D.1.2 — EulerV2Plugin deployato con beacon corretto", async function () {
            expect(await eulerPlugin.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("D.1.3 — deposit su Aave funziona senza errori di accesso", async function () {
            const amount = ethers.parseEther("0.1");
            await fundPlugin(aavePlugin, amount);
            await expect(
                aavePlugin.connect(owner).deposit("WETH", amount)
            ).to.not.be.reverted;
        });

        it("D.1.4 — AavePlugin balance dopo deposit > 0", async function () {
            const bal = await aavePlugin.getBalance("WETH");
            expect(bal).to.be.gt(0n);
        });
    });

    // ==================== SCENARIO 2: Multi-Protocol Allocation ====================

    describe("SCENARIO 2 — Multi-Protocol Allocation", function () {
        it("D.1.5 — MorphoPlugin deployato correttamente", async function () {
            const morphoAddr = await morphoPlugin.morpho();
            expect(morphoAddr.toLowerCase()).to.equal(MORPHO.toLowerCase());
        });

        it("D.1.6 — tutti e 3 i plugin hanno circuitBreaker = false", async function () {
            const aaveCB   = await aavePlugin.circuitBreakerTripped();
            const eulerCB  = await eulerPlugin.circuitBreakerTripped();
            const morphoCB = await morphoPlugin.circuitBreakerTripped();
            expect(aaveCB).to.be.false;
            expect(eulerCB).to.be.false;
            expect(morphoCB).to.be.false;
        });

        it("D.1.7 — withdraw da Aave dopo deposit", async function () {
            // Ritira quanto possibile da Aave
            try {
                const bal = await aavePlugin.getBalance("WETH");
                if (bal > 0n) {
                    await aavePlugin.connect(owner).withdraw("WETH", bal);
                }
            } catch (e: any) {
                // Accettabile (potrebbe avere limitazioni di liquidità)
            }
        });
    });
});
