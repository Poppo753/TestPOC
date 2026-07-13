import { expect } from "chai";
import { ethers, network } from "hardhat";
import { Contract } from "ethers";

/**
 * Compatibility E2E suite for the retired FlashLoanPlugin architecture.
 * The standalone plugin was replaced by FlashLoanService + EulerV2Plugin;
 * these 16 cases preserve the original coverage against the production path.
 */
describe("FlashLoanService compatibility - Atomic Leverage E2E", function () {
    this.timeout(300_000);

    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH_VAULT = "0x78E3E051D32157AACD550fBB78458762d8f7edFF";
    const USDC_VAULT = "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899";
    const EVC = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
    const ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
    const WETH_WHALE = "0xC3E5607Cd4ca0D5Fe51e09B60Ed97a0Ae6F874dd";

    let owner: any;
    let beacon: Contract;
    let registry: Contract;
    let service: Contract;
    let plugin: Contract;
    let weth: Contract;
    let wethVault: Contract;
    let usdcVault: Contract;

    before(async function () {
        if (process.env.FORK_ENABLED !== "true") this.skip();
        [owner] = await ethers.getSigners();
        weth = await ethers.getContractAt("IERC20", WETH);
        wethVault = await ethers.getContractAt([
            "function balanceOf(address) view returns (uint256)",
            "function convertToAssets(uint256) view returns (uint256)"
        ], WETH_VAULT);
        usdcVault = await ethers.getContractAt([
            "function debtOf(address) view returns (uint256)"
        ], USDC_VAULT);
    });

    describe("Phase 1: Deploy current flash-loan architecture", function () {
        it("Should deploy FlashLoanService with correct configuration", async function () {
            const Beacon = await ethers.getContractFactory("MockBeacon");
            beacon = await Beacon.deploy();
            await beacon.waitForDeployment();

            const TokenManager = await ethers.getContractFactory("MockTokenManager");
            const tokenManager = await TokenManager.deploy();
            await tokenManager.waitForDeployment();
            await tokenManager.setTokenAddress("WETH", WETH);
            await tokenManager.setTokenAddress("USDC", USDC);
            await tokenManager.setTokenPrice("WETH", ethers.parseUnits("2500", 8));
            await tokenManager.setTokenPrice("USDC", ethers.parseUnits("1", 8));

            const Proxy = await ethers.getContractFactory("MockProxyGeneral");
            const proxy = await Proxy.deploy();
            await proxy.waitForDeployment();
            await proxy.setTokenAddress("WETH", WETH);
            await proxy.setTokenAddress("USDC", USDC);

            const Registry = await ethers.getContractFactory("EulerRegistry");
            registry = await Registry.deploy();
            await registry.waitForDeployment();
            await registry.setVault("WETH", WETH_VAULT);
            await registry.setVault("USDC", USDC_VAULT);

            await beacon.setImplementation("TokenManager", await tokenManager.getAddress());
            await beacon.setImplementation("ProxyGeneral", await proxy.getAddress());
            await beacon.setImplementation("ProtocolManager", owner.address);
            await beacon.setImplementation("EulerRegistry", await registry.getAddress());
            await beacon.setImplementation("WETH", WETH);
            await beacon.setImplementation("BASE_ASSET", WETH);

            const Service = await ethers.getContractFactory("FlashLoanService");
            service = await Service.deploy(await beacon.getAddress());
            await service.waitForDeployment();
            await beacon.setImplementation("FlashLoanService", await service.getAddress());

            const Plugin = await ethers.getContractFactory("EulerV2Plugin");
            plugin = await Plugin.deploy(await beacon.getAddress(), "WETH", EVC, ACCOUNT_LENS);
            await plugin.waitForDeployment();
            await beacon.setImplementation("EulerV2Plugin", await plugin.getAddress());
            await beacon.setImplementation("LiquidityManager", await service.getAddress());
            await registry.transferOwnership(await plugin.getAddress());

            expect(await service.isAuthorizedPlugin(await plugin.getAddress())).to.equal(true);
        });
    });

    describe("Phase 2: Setup Initial Collateral", function () {
        it("Should get WETH from whale", async function () {
            await network.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            await network.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("1"))
            ]);
            const whale = await ethers.getSigner(WETH_WHALE);
            await weth.connect(whale).transfer(owner.address, ethers.parseEther("1"));
            await network.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);
            await weth.approve(await plugin.getAddress(), ethers.MaxUint256);
            expect(await weth.balanceOf(owner.address)).to.be.gte(ethers.parseEther("1"));
        });
    });

    const openParams = async (leverage: number) => ({
        collateralToken: "WETH",
        borrowToken: "USDC",
        collateralAmount: ethers.parseEther("0.3"),
        targetLeverageX100: leverage,
        minHealthFactor: ethers.parseEther("1.05"),
        deadline: (await ethers.provider.getBlock("latest"))!.timestamp + 3600
    });

    describe("Phase 3: Simulate Leverage Position", function () {
        it("Should simulate 2x leverage position", async function () {
            const [, debt, hf] = await plugin.openLeverageAtomic.staticCall(await openParams(200));
            expect(debt).to.be.gt(0n);
            expect(hf).to.be.gte(ethers.parseEther("1.05"));
        });

        it("Should simulate 3x leverage position", async function () {
            const [, debt, hf] = await plugin.openLeverageAtomic.staticCall(await openParams(300));
            expect(debt).to.be.gt(0n);
            expect(hf).to.be.gte(ethers.parseEther("1.05"));
        });
    });

    describe("Phase 4: Open Leverage Position", function () {
        it("Should approve WETH for EulerV2Plugin", async function () {
            expect(await weth.allowance(owner.address, await plugin.getAddress())).to.equal(ethers.MaxUint256);
        });

        it("Should open 2x leverage position in ONE transaction", async function () {
            await expect(plugin.openLeverageAtomic(await openParams(200))).to.not.be.reverted;
            expect(await registry.getActivePositionCount()).to.equal(1n);
        });

        it("Should have position state on Euler", async function () {
            const account = await plugin.getAddress();
            expect(await wethVault.balanceOf(account)).to.be.gt(0n);
            expect(await usdcVault.debtOf(account)).to.be.gt(0n);
        });
    });

    describe("Phase 5: Verify Leverage State", function () {
        it("Should have collateral enabled on EVC", async function () {
            const evc = await ethers.getContractAt([
                "function isCollateralEnabled(address,address) view returns (bool)"
            ], EVC);
            expect(await evc.isCollateralEnabled(await plugin.getAddress(), WETH_VAULT)).to.equal(true);
        });

        it("Should have controller enabled on EVC", async function () {
            const evc = await ethers.getContractAt([
                "function isControllerEnabled(address,address) view returns (bool)"
            ], EVC);
            expect(await evc.isControllerEnabled(await plugin.getAddress(), USDC_VAULT)).to.equal(true);
        });

        it("Should report leverage above 1x", async function () {
            const account = await plugin.getAddress();
            const assets = await wethVault.convertToAssets(await wethVault.balanceOf(account));
            const debt = await usdcVault.debtOf(account);
            const debtInWeth = debt * 10n ** 12n / 2500n;
            const equity = assets - debtInWeth;
            expect(assets * 100n / equity).to.be.gte(150n);
        });

        it("Should have healthy position", async function () {
            expect(await plugin.getHealthFactor()).to.be.gte(ethers.parseEther("1.05"));
        });
    });

    describe("Phase 6: Close Leverage Position", function () {
        const closeParams = async () => ({
            collateralToken: "WETH",
            borrowToken: "USDC",
            maxSlippageBps: 200,
            deadline: (await ethers.provider.getBlock("latest"))!.timestamp + 3600
        });

        it("Should preview a complete atomic close", async function () {
            await expect(plugin.closeLeverageAtomic.staticCall(await closeParams())).to.not.be.reverted;
        });

        it("Should close leverage position in ONE transaction", async function () {
            await expect(plugin.closeLeverageAtomic(await closeParams())).to.not.be.reverted;
            expect(await registry.getActivePositionCount()).to.equal(0n);
        });

        it("Should have no debt remaining", async function () {
            expect(await usdcVault.debtOf(await plugin.getAddress())).to.equal(0n);
        });

        it("Should have no collateral remaining", async function () {
            expect(await wethVault.balanceOf(await plugin.getAddress())).to.equal(0n);
        });
    });

    describe("Summary", function () {
        it("Should confirm the migrated architecture", async function () {
            expect(await service.getBalancerVault()).to.not.equal(ethers.ZeroAddress);
            expect(await service.getSimpleSwap()).to.not.equal(ethers.ZeroAddress);
        });
    });
});
