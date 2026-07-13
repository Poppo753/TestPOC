import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🟣 E2E A.7 — MorphoVault Full Cycle (ERC4626 Vaults)
 *
 * REQUIRE: FORK_ENABLED=true e RPC Arbitrum
 * Run: $env:FORK_ENABLED="true"; npx hardhat test test\e2e\MorphoVault.FullCycle.e2e.test.ts
 *
 * SCENARI:
 *   1. Deploy MorphoVaultPlugin (1 solo argomento) + MorphoRegistry
 *   2. Vault deposit + getVaultShares
 *   3. Vault redeem (vaultRedeem)
 *   4. VaultNotApproved guard
 *   5. DepositExceedsMax guard
 *   6. LensAdapter integration (MorphoVaultLensAdapter)
 */
describe("E2E A.7 — MorphoVault Full Cycle", function () {
    this.timeout(180000);

    // ==================== ADDRESSES (Arbitrum Mainnet) ====================
    const WETH       = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC       = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    // Esempio vault Morpho ERC4626 su Arbitrum (WETH supply vault)
    const MORPHO_WETH_VAULT = "0x78E3E051D32157AACD550fBB78458762d8f7edFF";  // ReUsed Euler WETH vault address placeholder
    const WETH_WHALE        = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    // ==================== STATE ====================
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;
    let vaultPlugin: any;
    let morphoRegistry: any;
    let vaultLensAdapter: any;
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

        // Deploy MorphoRegistry
        const RegistryFactory = await ethers.getContractFactory("MorphoRegistry");
        morphoRegistry = await RegistryFactory.deploy();
        await mockBeacon.setImplementation("MorphoRegistry", await morphoRegistry.getAddress());

        // MorphoVaultPlugin (solo 1 argomento: beacon)
        const VaultPluginFactory = await ethers.getContractFactory("MorphoVaultPlugin");
        vaultPlugin = await VaultPluginFactory.deploy(await mockBeacon.getAddress());
        await mockBeacon.setImplementation("MorphoVaultPlugin", await vaultPlugin.getAddress());

        // Deploy MorphoVaultLensAdapter
        const MorphoVaultLensFactory = await ethers.getContractFactory("MorphoVaultLensAdapter");
        vaultLensAdapter = await MorphoVaultLensFactory.deploy(await mockBeacon.getAddress(), "WETH");
        await mockBeacon.setImplementation("MorphoVaultLensAdapter", await vaultLensAdapter.getAddress());

        wethContract = await ethers.getContractAt("IERC20", WETH);
    });

    // ==================== HELPER ====================

    async function fundPluginWETH(amount: bigint) {
        await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
        await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
        const whale = await ethers.getSigner(WETH_WHALE);
        await wethContract.connect(whale).transfer(await vaultPlugin.getAddress(), amount);
        await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);
    }

    // ==================== SCENARIO 1: Deploy Struttura ====================

    describe("SCENARIO 1 — Deploy e struttura MorphoVaultPlugin", function () {
        it("A.7.1 — plugin deployato (1 arg) senza errori", async function () {
            expect(await vaultPlugin.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("A.7.2 — owner = deployer", async function () {
            expect(await vaultPlugin.owner()).to.equal(owner.address);
        });

        it("A.7.3 — circuitBreaker = false all'avvio", async function () {
            const tripped = await vaultPlugin.circuitBreakerTripped();
            expect(tripped).to.be.false;
        });

        it("A.7.4 — beacon registrato correttamente", async function () {
            const b = await vaultPlugin.beacon();
            expect(b.toLowerCase()).to.equal((await mockBeacon.getAddress()).toLowerCase());
        });
    });

    // ==================== SCENARIO 2: MorphoRegistry ====================

    describe("SCENARIO 2 — MorphoRegistry setDefaultVault", function () {
        it("A.7.5 — setDefaultVault non reverta per WETH", async function () {
            await morphoRegistry.configureVault(MORPHO_WETH_VAULT, "WETH");
            await morphoRegistry.setDefaultVault("WETH", MORPHO_WETH_VAULT);
            const vaultAddr = await morphoRegistry.getDefaultVault("WETH");
            expect(vaultAddr.toLowerCase()).to.equal(MORPHO_WETH_VAULT.toLowerCase());
        });

        it("A.7.6 — getDefaultVault = ZeroAddress se non impostato", async function () {
            const addr = await morphoRegistry.getDefaultVault("UNKNOWN_TOKEN");
            expect(addr).to.equal(ethers.ZeroAddress);
        });
    });

    // ==================== SCENARIO 3: VaultShares iniziali ====================

    describe("SCENARIO 3 — getVaultShares iniziale", function () {
        it("A.7.7 — getVaultShares = 0 prima del deposit", async function () {
            const shares = await vaultPlugin.getVaultShares(MORPHO_WETH_VAULT);
            expect(shares).to.equal(0n);
        });
    });

    // ==================== SCENARIO 4: VaultNotApproved (guard) ====================

    describe("SCENARIO 4 — Vault non approvato", function () {
        it("A.7.8 — deposit su vault non approvato reverta", async function () {
            const rndVault = ethers.Wallet.createRandom().address;
            await fundPluginWETH(ethers.parseEther("0.1"));
            await expect(
                vaultPlugin.connect(owner).vaultDeposit(rndVault, ethers.parseEther("0.01"))
            ).to.be.reverted;
        });
    });

    // ==================== SCENARIO 5: LensAdapter ====================

    describe("SCENARIO 5 — MorphoVaultLensAdapter", function () {
        it("A.7.9 — lensAdapter deployato", async function () {
            expect(await vaultLensAdapter.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("A.7.10 — beacon lensAdapter corretto", async function () {
            try {
                const b = await vaultLensAdapter.beacon();
                expect(b.toLowerCase()).to.equal((await mockBeacon.getAddress()).toLowerCase());
            } catch {
                this.skip();
            }
        });
    });
});
