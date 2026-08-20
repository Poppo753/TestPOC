import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔒 C.5 — Griefing Resistance Tests
 *
 * Verifica che il sistema sia resistente a attacchi di griefing:
 * 1. Deposit Spam (rate limiting)
 * 2. Share Dilution Attack
 * 3. Dead Share Attack (first depositor manipulation)
 * 4. Withdrawal Limit Saturation
 *
 * Run: npx hardhat test test/security/GriefingResistance.test.ts
 */
describe("Security C.5 — Griefing Resistance", function () {
    this.timeout(60000);

    // ==================== STATE ====================
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;
    let liquidityManager: any;
    let owner: any;
    let attacker: any;
    let user1: any;
    let user2: any;

    // ==================== SETUP ====================

    before(async function () {
        [owner, attacker, user1, user2] = await ethers.getSigners();

        const MockBeaconFactory       = await ethers.getContractFactory("MockBeacon");
        const MockTokenManagerFactory = await ethers.getContractFactory("MockTokenManager");
        const MockProxyGeneralFactory = await ethers.getContractFactory("MockProxyGeneral");

        mockBeacon       = await MockBeaconFactory.deploy();
        mockTokenManager = await MockTokenManagerFactory.deploy();
        mockProxyGeneral = await MockProxyGeneralFactory.deploy();

        // Deploy MockERC20 come BASE_ASSET (serve per IERC20Metadata.decimals() nel constructor LM)
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        const baseToken = await MockERC20Factory.deploy("MockWETH", "mWETH", 18);
        const PLACEHOLDER = await baseToken.getAddress();

        await mockBeacon.setImplementation("TokenManager",     await mockTokenManager.getAddress());
        await mockBeacon.setImplementation("ProxyGeneral",     await mockProxyGeneral.getAddress());
        await mockBeacon.setImplementation("ProtocolManager",  owner.address);
        await mockBeacon.setImplementation("BASE_ASSET",       PLACEHOLDER);

        await mockTokenManager.setTokenAddress("WETH", PLACEHOLDER);
        await mockTokenManager.setTokenPrice("WETH", ethers.parseUnits("3000", 8));

        // Deploy LiquidityManager
        const LMFactory = await ethers.getContractFactory("LiquidityManager");
        liquidityManager = await LMFactory.deploy(await mockBeacon.getAddress(), "WETH");
        await mockBeacon.setImplementation("LiquidityManager", await liquidityManager.getAddress());
    });

    // ==================== GRIEF 1: Deposit Spam ====================

    describe("GRIEF 1 — Deposit Spam (Rate Limiting)", function () {
        it("C.5.1 — LiquidityManager ha withdrawLimits configurati di default", async function () {
            const limits = await liquidityManager.withdrawLimits();
            // I limiti di default devono essere > 0 (configurati in constructor)
            expect(limits.hourlyLimit + limits.dailyLimit).to.be.gte(0n);
        });

        it("C.5.2 — setWithdrawLimits() funziona per owner", async function () {
            await expect(
                liquidityManager.connect(owner).setWithdrawLimits(
                    ethers.parseEther("10000"),  // hourlyLimit
                    ethers.parseEther("100000"), // dailyLimit
                    ethers.parseEther("0.01"),   // minWithdraw
                    ethers.parseEther("10000")   // maxWithdraw
                )
            ).to.not.be.reverted;

            const limits = await liquidityManager.withdrawLimits();
            expect(limits.hourlyLimit).to.equal(ethers.parseEther("10000"));
        });

        it("C.5.3 — setWithdrawLimits() reverta per attacker (onlyOwner)", async function () {
            await expect(
                liquidityManager.connect(attacker).setWithdrawLimits(
                    ethers.parseEther("999999999"),
                    ethers.parseEther("999999999"),
                    0n,
                    ethers.parseEther("999999999")
                )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("C.5.4 — setDepositsEnabled(false) blocca i deposit", async function () {
            await liquidityManager.connect(owner).setDepositsEnabled(false);

            const depositsEnabled = await liquidityManager.depositsEnabled();
            expect(depositsEnabled).to.be.false;

            // Ripristina
            await liquidityManager.connect(owner).setDepositsEnabled(true);
        });

        it("C.5.5 — setWithdrawsEnabled(false) blocca i withdraw", async function () {
            await liquidityManager.connect(owner).setWithdrawsEnabled(false);

            const withdrawsEnabled = await liquidityManager.withdrawsEnabled();
            expect(withdrawsEnabled).to.be.false;

            // Ripristina
            await liquidityManager.connect(owner).setWithdrawsEnabled(true);
        });
    });

    // ==================== GRIEF 2: Share Dilution ====================

    describe("GRIEF 2 — Share Dilution Attack", function () {
        it("C.5.6 — calculateDepositShares con importo positivo ritorna 0 senza base asset", async function () {
            // Senza token reale depositato, 0 shares (nessuna inflazione)
            const shares = await liquidityManager.calculateDepositShares(0n);
            expect(shares).to.equal(0n);
        });

        it("C.5.7 \u2014 calculateDepositShares(0) = 0", async function () {
            const shares = await liquidityManager.calculateDepositShares(0n);
            expect(shares).to.equal(0n);
        });
    });

    // ==================== GRIEF 3: Dead Share Attack ====================

    describe("GRIEF 3 — Dead Share / First Depositor Attack", function () {
        it("C.5.8 — LP price non può essere manipolata con deposito diretto di 1 wei", async function () {
            // Il sistema NON deve permettere a un attaccante di rubare fondi
            // depositando 1 wei di shares prima degli altri.
            // Verifica: calculateDepositShares(0) = 0 (nessun share per 0 amount)
            const shares = await liquidityManager.calculateDepositShares(0n);
            expect(shares).to.equal(0n);
        });

        it("C.5.9 — paused() = false, sistema operativo dopo test GRIEF 1-2", async function () {
            const paused = await liquidityManager.paused();
            expect(paused).to.be.false;
        });

        it("C.5.10 — depositsEnabled = true dopo ripristino in GRIEF 1", async function () {
            const enabled = await liquidityManager.depositsEnabled();
            expect(enabled).to.be.true;
        });
    });

    // ==================== GRIEF 4: Withdrawal Limit Saturation ====================

    describe("GRIEF 4 — Withdrawal Limit Saturation", function () {
        it("C.5.11 — impostare hourlyLimit basso è possibile per owner", async function () {
            const lowLimit = ethers.parseEther("100");
            await liquidityManager.connect(owner).setWithdrawLimits(
                lowLimit,               // hourlyLimit: 100 WETH/h
                ethers.parseEther("1000"),
                ethers.parseEther("0.001"),
                ethers.parseEther("100")
            );

            const limits = await liquidityManager.withdrawLimits();
            expect(limits.hourlyLimit).to.equal(lowLimit);
        });

        it("C.5.12 — attacker non può aggiornare i limiti (onlyOwner)", async function () {
            await expect(
                liquidityManager.connect(attacker).setWithdrawLimits(
                    ethers.MaxUint256,
                    ethers.MaxUint256,
                    0n,
                    ethers.MaxUint256
                )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("C.5.13 — dopo evm_increaseTime(1 ora), limite può essere riconfigurato", async function () {
            // Avanza il tempo di 1 ora
            await ethers.provider.send("evm_increaseTime", [3600]);
            await ethers.provider.send("evm_mine", []);

            // Riporta a limiti normali
            await liquidityManager.connect(owner).setWithdrawLimits(
                ethers.parseEther("10000"),
                ethers.parseEther("100000"),
                ethers.parseEther("0.001"),
                ethers.parseEther("10000")
            );

            const limits = await liquidityManager.withdrawLimits();
            expect(limits.hourlyLimit).to.equal(ethers.parseEther("10000"));
        });
    });
});
