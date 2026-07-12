import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 📐 F.1 — Edge Cases: Token Decimals
 *
 * Verifica che il sistema gestisca correttamente token con diversi decimali:
 * - 2 decimali (token esotici)
 * - 6 decimali (USDC)
 * - 8 decimali (WBTC)
 * - 18 decimali (WETH)
 *
 * Run: npx hardhat test test/unit/EdgeCases.tokenDecimals.test.ts
 */
describe("Edge Cases F.1 — Token Decimals", function () {
    this.timeout(60000);

    let owner: any;
    let oracle: any;

    before(async function () {
        [owner] = await ethers.getSigners();
        const MockOracleFactory = await ethers.getContractFactory("MockOracleAdapter");
        oracle = await MockOracleFactory.deploy();
    });

    // ==================== HELPER ====================

    async function deployTokenAndBeacon(decimals: number, tokenCode: string, priceUSD: bigint) {
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        const MockBeaconFactory = await ethers.getContractFactory("MockBeacon");
        const MockTMFactory = await ethers.getContractFactory("MockTokenManager");
        const MockPGFactory = await ethers.getContractFactory("MockProxyGeneral");

        const token = await MockERC20Factory.deploy(`Token${decimals}`, `T${decimals}`, decimals);
        const beacon = await MockBeaconFactory.deploy();
        const tm = await MockTMFactory.deploy();
        const pg = await MockPGFactory.deploy();

        await tm.setTokenAddress(tokenCode, await token.getAddress());
        await tm.setTokenPrice(tokenCode, priceUSD);

        await beacon.setImplementation("TokenManager",    await tm.getAddress());
        await beacon.setImplementation("ProxyGeneral",    await pg.getAddress());
        await beacon.setImplementation("ProtocolManager", owner.address);
        await beacon.setImplementation("BASE_ASSET",      await token.getAddress());

        const LMFactory = await ethers.getContractFactory("LiquidityManager");
        const lm = await LMFactory.deploy(await beacon.getAddress(), tokenCode);
        await beacon.setImplementation("LiquidityManager", await lm.getAddress());

        return { token, beacon, tm, pg, lm };
    }

    // ==================== 18 DECIMALI (WETH) ====================

    describe("18 decimali (WETH)", function () {
        it("F.1.1 — deploy con token 18 decimali non reverta", async function () {
            const { lm } = await deployTokenAndBeacon(18, "WETH", ethers.parseUnits("3000", 8));
            expect(await lm.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("F.1.2 — calculateDepositShares(0) = 0 con 18 decimali", async function () {
            const { lm } = await deployTokenAndBeacon(18, "WETH", ethers.parseUnits("3000", 8));
            const shares = await lm.calculateDepositShares(0n);
            expect(shares).to.equal(0n);
        });

        it("F.1.3 — withdrawLimits hourlyLimit usa 18 decimali correttamente", async function () {
            const { lm } = await deployTokenAndBeacon(18, "WETH", ethers.parseUnits("3000", 8));
            const limits = await lm.withdrawLimits();
            // 100 * 10^18 = hourlyLimit default
            expect(limits.hourlyLimit).to.equal(100n * BigInt(10 ** 18));
        });
    });

    // ==================== 6 DECIMALI (USDC) ====================

    describe("6 decimali (USDC)", function () {
        it("F.1.4 — deploy con token 6 decimali non reverta", async function () {
            const { lm } = await deployTokenAndBeacon(6, "USDC", ethers.parseUnits("1", 8));
            expect(await lm.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("F.1.5 — withdrawLimits hourlyLimit usa 6 decimali correttamente", async function () {
            const { lm } = await deployTokenAndBeacon(6, "USDC", ethers.parseUnits("1", 8));
            const limits = await lm.withdrawLimits();
            // 100 * 10^6 = 100_000_000
            expect(limits.hourlyLimit).to.equal(100n * BigInt(10 ** 6));
        });

        it("F.1.6 — calculateDepositShares con 6 decimali = 0 per 0 amount", async function () {
            const { lm } = await deployTokenAndBeacon(6, "USDC", ethers.parseUnits("1", 8));
            const shares = await lm.calculateDepositShares(0n);
            expect(shares).to.equal(0n);
        });
    });

    // ==================== 8 DECIMALI (WBTC) ====================

    describe("8 decimali (WBTC)", function () {
        it("F.1.7 — deploy con token 8 decimali non reverta", async function () {
            const { lm } = await deployTokenAndBeacon(8, "WBTC", ethers.parseUnits("60000", 8));
            expect(await lm.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("F.1.8 — withdrawLimits hourlyLimit usa 8 decimali correttamente", async function () {
            const { lm } = await deployTokenAndBeacon(8, "WBTC", ethers.parseUnits("60000", 8));
            const limits = await lm.withdrawLimits();
            // 100 * 10^8 = 10_000_000_000
            expect(limits.hourlyLimit).to.equal(100n * BigInt(10 ** 8));
        });
    });

    // ==================== ORACLE PRICE CONVERSIONS ====================

    describe("Oracle price con diversi decimali", function () {
        it("F.1.9 — MockOracleAdapter non ha overflow con prezzi a 8 decimali", async function () {
            await oracle.setPrice("WBTC", ethers.parseUnits("60000", 8));
            const [price] = await oracle.getPrice("WBTC");
            expect(price).to.equal(ethers.parseUnits("60000", 8));
        });

        it("F.1.10 — prezzi USDC e WBTC coesistono senza conflitti", async function () {
            await oracle.setPrice("USDC", ethers.parseUnits("1", 8));
            await oracle.setPrice("WBTC", ethers.parseUnits("60000", 8));

            const [priceUSDC] = await oracle.getPrice("USDC");
            const [priceWBTC] = await oracle.getPrice("WBTC");

            expect(priceUSDC).to.equal(ethers.parseUnits("1", 8));
            expect(priceWBTC).to.equal(ethers.parseUnits("60000", 8));
        });
    });
});
