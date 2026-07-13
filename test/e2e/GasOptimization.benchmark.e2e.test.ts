import { expect } from "chai";
import { ethers } from "hardhat";
import { assertGasSnapshot } from "../helpers/gasSnapshot";

/**
 * 🔥 E.1 — Gas Optimization Benchmark
 *
 * Misura il gas consumato dalle operazioni chiave del protocollo su fork
 * Arbitrum mainnet. Tutti i test vengono saltati se FORK_ENABLED !== "true".
 * Integra assertGasSnapshot (Infra 9.6) per rilevare regressioni gas.
 *
 * Run: cross-env FORK_ENABLED=true npx hardhat test test/e2e/GasOptimization.benchmark.e2e.test.ts
 */

const WETH_ADDR  = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC_ADDR  = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const AAVE_POOL  = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const WETH_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

const GAS_LIMITS: Record<string, number> = {
    beaconDeploy:           3_000_000,
    parameterManagerDeploy: 6_000_000,
    liquidityManagerDeploy: 5_100_000,
    aavePluginDeploy:       4_000_000,
    aaveDeposit:            600_000,
    aaveWithdraw:           600_000,
    beaconUpdate:           150_000,
    setImplementation:      135_000,
};

describe("E.1 — Gas Optimization Benchmark", function () {
    this.timeout(120_000);

    let owner: any;
    let beacon: any;
    let weth: any;

    const results: Record<string, bigint> = {};

    before(async function () {
        if (process.env.FORK_ENABLED !== "true") {
            this.skip();
            return;
        }

        [owner] = await ethers.getSigners();
        weth = await ethers.getContractAt("IERC20Metadata", WETH_ADDR);

        // Fund owner with WETH via whale impersonation
        await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
        const whale = await ethers.getSigner(WETH_WHALE);
        await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toBeHex(ethers.parseEther("10"))]);
        await weth.connect(whale).transfer(owner.address, ethers.parseEther("5"));
        await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);
    });

    after(function () {
        if (Object.keys(results).length === 0) return;
        console.log("\n📊 GAS BENCHMARK RESULTS:");
        console.log("=".repeat(50));
        for (const [op, gas] of Object.entries(results)) {
            const limit = GAS_LIMITS[op] ?? 999_999_999;
            const status = gas <= BigInt(limit) ? "✅" : "⚠️ ";
            console.log(`  ${status} ${op.padEnd(30)} ${gas.toLocaleString().padStart(12)} gas`);
        }
        console.log("=".repeat(50));
    });

    // ==================== DEPLOYMENT GAS ====================

    describe("Deployment Gas", function () {
        it("E.1.1 — Beacon deploy gas", async function () {
            const factory = await ethers.getContractFactory("Beacon");
            const tx = await factory.deploy();
            const receipt = await tx.deploymentTransaction()!.wait();
            const gas = receipt!.gasUsed;
            results["beaconDeploy"] = gas;
            assertGasSnapshot("Beacon.deploy", gas);
            beacon = tx;
            expect(gas).to.be.lte(GAS_LIMITS.beaconDeploy);
        });

        it("E.1.2 — ParameterManager deploy gas", async function () {
            const factory = await ethers.getContractFactory("ParameterManager");
            const tx = await factory.deploy(await beacon.getAddress(), 18);
            const receipt = await tx.deploymentTransaction()!.wait();
            const gas = receipt!.gasUsed;
            results["parameterManagerDeploy"] = gas;
            assertGasSnapshot("ParameterManager.deploy", gas);
            expect(gas).to.be.lte(GAS_LIMITS.parameterManagerDeploy);
        });

        it("E.1.3 — MockERC20 + LiquidityManager deploy gas", async function () {
            const mockFactory = await ethers.getContractFactory("MockERC20");
            const baseToken = await mockFactory.deploy("MockWETH", "mWETH", 18);
            await beacon.updateImplementation("BASE_ASSET", await baseToken.getAddress());

            const MockTMFactory = await ethers.getContractFactory("MockTokenManager");
            const tokenManager = await MockTMFactory.deploy();
            await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());

            const MockPGFactory = await ethers.getContractFactory("MockProxyGeneral");
            const proxyGeneral = await MockPGFactory.deploy();
            await beacon.updateImplementation("ProxyGeneral", await proxyGeneral.getAddress());
            await beacon.updateImplementation("ProtocolManager", await tokenManager.getAddress());

            const lmFactory = await ethers.getContractFactory("LiquidityManager");
            const tx = await lmFactory.deploy(await beacon.getAddress(), "WETH");
            const receipt = await tx.deploymentTransaction()!.wait();
            const gas = receipt!.gasUsed;
            results["liquidityManagerDeploy"] = gas;
            assertGasSnapshot("LiquidityManager.deploy", gas);
            expect(gas).to.be.lte(GAS_LIMITS.liquidityManagerDeploy);
        });

        it("E.1.4 — AaveV3Plugin deploy gas", async function () {
            const factory = await ethers.getContractFactory("AaveV3Plugin");
            const tx = await factory.deploy(await beacon.getAddress(), "WETH", AAVE_POOL);
            const receipt = await tx.deploymentTransaction()!.wait();
            const gas = receipt!.gasUsed;
            results["aavePluginDeploy"] = gas;
            assertGasSnapshot("AaveV3Plugin.deploy", gas);
            expect(gas).to.be.lte(GAS_LIMITS.aavePluginDeploy);
        });
    });

    // ==================== BEACON OPERATIONS GAS ====================

    describe("Beacon Operation Gas", function () {
        it("E.1.5 — setImplementation gas", async function () {
            const implementation = await (await ethers.getContractFactory("MockBeacon")).deploy();
            const tx = await beacon.updateImplementation("GasBenchmark", await implementation.getAddress());
            const receipt = await tx.wait();
            const gas = receipt!.gasUsed;
            results["setImplementation"] = gas;
            assertGasSnapshot("Beacon.setImplementation", gas);
            expect(gas).to.be.lte(GAS_LIMITS.setImplementation);
        });
    });

    // ==================== AAVE DEPOSIT/WITHDRAW GAS ====================

    describe("Aave Deposit/Withdraw Gas", function () {
        let aavePlugin: any;

        before(async function () {
            await beacon.updateImplementation("BASE_ASSET", WETH_ADDR);
            const dataProvider = await ethers.getContractAt([
                "function getReserveAToken(address) view returns (address)",
                "function getReserveVariableDebtToken(address) view returns (address)"
            ], AAVE_POOL);
            const aWETH = await dataProvider.getReserveAToken(WETH_ADDR);
            const debtWETH = await dataProvider.getReserveVariableDebtToken(WETH_ADDR);
            const registry = await (await ethers.getContractFactory("AaveV3Registry")).deploy();
            await registry.configureToken("WETH", WETH_ADDR, aWETH, debtWETH);
            await beacon.updateImplementation("AaveV3Registry", await registry.getAddress());
            const factory = await ethers.getContractFactory("AaveV3Plugin");
            aavePlugin = await factory.deploy(await beacon.getAddress(), "WETH", AAVE_POOL);

            // Register plugin
            await beacon.updateImplementation("AavePlugin", await aavePlugin.getAddress());

            const pluginAddress = await aavePlugin.getAddress();
            await ethers.provider.send("hardhat_setBalance", [pluginAddress, ethers.toQuantity(ethers.parseEther("1"))]);
            await ethers.provider.send("hardhat_impersonateAccount", [pluginAddress]);
            await (await ethers.getSigner(pluginAddress)).sendTransaction({
                to: WETH_ADDR, value: ethers.parseEther("0.2"), data: "0xd0e30db0"
            });
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [pluginAddress]);
        });

        it("E.1.6 — Aave deposit gas", async function () {
            const amount = ethers.parseEther("0.1");
            try {
                const tx = await aavePlugin.connect(owner).deposit("WETH", amount);
                const receipt = await tx.wait();
                const gas = receipt!.gasUsed;
                results["aaveDeposit"] = gas;
                assertGasSnapshot("AaveV3Plugin.deposit", gas);
                expect(gas).to.be.lte(GAS_LIMITS.aaveDeposit);
            } catch (e: any) {
                console.log("    ℹ Aave deposit not supported by this plugin interface, skipping gas measurement");
                throw e;
            }
        });
    });

    // ==================== SUMMARY ASSERTION ====================

    describe("Gas Budget Summary", function () {
        it("E.1.7 — tutti i deployment sono entro budget", function () {
            for (const [op, gas] of Object.entries(results)) {
                const limit = GAS_LIMITS[op];
                if (limit) {
                    expect(gas, `${op} over gas budget`).to.be.lte(limit);
                }
            }
        });
    });
});
