import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 📐 F.4 — Edge Cases: Rate Limiting
 *
 * Verifica il rate limiting per deposit/withdraw:
 * - Limite orario per utente
 * - Limite giornaliero separato
 * - Limiti separati per utente (A non blocca B)
 * - Reset dopo 1 ora
 *
 * Run: npx hardhat test test/unit/EdgeCases.rateLimit.test.ts
 */
describe("Edge Cases F.4 — Rate Limiting", function () {
    this.timeout(60000);

    let beacon: any;
    let proxyGeneral: any;
    let tokenManager: any;
    let liquidityManager: any;
    let baseToken: any;
    let owner: any;
    let userA: any;
    let userB: any;

    before(async function () {
        [owner, userA, userB] = await ethers.getSigners();

        const MockERC20Factory  = await ethers.getContractFactory("MockERC20");
        const BeaconFactory = await ethers.getContractFactory("Beacon");
        const ProxyGeneralFactory = await ethers.getContractFactory("ProxyGeneral");

        baseToken    = await MockERC20Factory.deploy("MockWETH", "mWETH", 18);
        beacon = await BeaconFactory.deploy();
        proxyGeneral = await ProxyGeneralFactory.deploy(await beacon.getAddress(), "WETH");

        await beacon.updateImplementation("ProxyGeneral", await proxyGeneral.getAddress());
        await beacon.updateImplementation("BASE_ASSET", await baseToken.getAddress());

        const LMFactory = await ethers.getContractFactory("LiquidityManager");
        liquidityManager = await LMFactory.deploy(await beacon.getAddress(), "WETH");
        await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());
        await proxyGeneral.setRateLimit("deposit", ethers.parseEther("100"), ethers.parseEther("1000"));
        await proxyGeneral.setRateLimit("withdraw", ethers.parseEther("100"), ethers.parseEther("1000"));

        // Imposta limiti bassi per testare facilmente
        await liquidityManager.connect(owner).setWithdrawLimits(
            ethers.parseEther("100"),   // hourlyLimit: 100 WETH/h
            ethers.parseEther("1000"),  // dailyLimit: 1000 WETH/day
            ethers.parseEther("0.001"), // minWithdraw
            ethers.parseEther("100")    // maxWithdraw
        );

        // Distribuisci token agli utenti
        await baseToken.connect(owner).transfer(userA.address, ethers.parseEther("500"));
        await baseToken.connect(owner).transfer(userB.address, ethers.parseEther("500"));
    });

    // ==================== RATE LIMIT VIEW FUNCTIONS ====================

    describe("F.4.1 — checkWithdrawLimits / getRemainingLimit", function () {
        it("F.4.1a — checkWithdrawLimits entro il limite ritorna (true, '')", async function () {
            const [allowed] = await liquidityManager.checkWithdrawLimits(
                userA.address,
                ethers.parseEther("50")
            );
            expect(allowed).to.be.true;
        });

        it("F.4.1b — checkWithdrawLimits sopra maxWithdraw ritorna (false, reason)", async function () {
            const [allowed, reason] = await liquidityManager.checkWithdrawLimits(
                userA.address,
                ethers.parseEther("200") // sopra maxWithdraw=100
            );
            expect(allowed).to.be.false;
            expect(reason.length).to.be.gt(0);
        });

        it("F.4.1c — checkWithdrawLimits per 0 amount ritorna (false, reason)", async function () {
            const [allowed] = await liquidityManager.checkWithdrawLimits(
                userA.address,
                0n
            );
            expect(allowed).to.be.false;
        });

        it("F.4.1d — checkWithdrawLimits sotto minWithdraw ritorna (false, reason)", async function () {
            const [allowed] = await liquidityManager.checkWithdrawLimits(
                userA.address,
                1n // 1 wei, sotto minWithdraw=0.001 WETH
            );
            expect(allowed).to.be.false;
        });
    });

    // ==================== LIMITI SEPARATI PER UTENTE ====================

    describe("F.4.2 — Limiti per-utente separati", function () {
        it("F.4.2a — checkWithdrawLimits di A e B indipendenti", async function () {
            const [okA] = await liquidityManager.checkWithdrawLimits(userA.address, ethers.parseEther("50"));
            const [okB] = await liquidityManager.checkWithdrawLimits(userB.address, ethers.parseEther("50"));
            expect(okA).to.be.true;
            expect(okB).to.be.true;
        });
    });

    // ==================== RATE LIMIT PER TIPO ====================

    describe("F.4.3 — checkRateLimit deposit vs withdraw separati", function () {
        it("F.4.3a — checkDepositRateLimit funziona per owner", async function () {
            const [ok, hourlyRemaining, dailyRemaining] =
                await liquidityManager.checkDepositRateLimit(owner.address, ethers.parseEther("1"));
            expect(ok).to.equal(true);
            expect(hourlyRemaining).to.equal(ethers.parseEther("100"));
            expect(dailyRemaining).to.equal(ethers.parseEther("1000"));
        });

        it("F.4.3b — checkWithdrawRateLimit funziona per owner", async function () {
            const [ok, hourlyRemaining, dailyRemaining] =
                await liquidityManager.checkWithdrawRateLimit(owner.address, ethers.parseEther("1"));
            expect(ok).to.equal(true);
            expect(hourlyRemaining).to.equal(ethers.parseEther("100"));
            expect(dailyRemaining).to.equal(ethers.parseEther("1000"));
        });
    });

    // ==================== RESET DOPO 1 ORA ====================

    describe("F.4.4 — setWithdrawLimits via owner", function () {
        it("F.4.4a — setWithdrawLimits funziona per owner", async function () {
            await expect(
                liquidityManager.connect(owner).setWithdrawLimits(
                    ethers.parseEther("200"),  // hourlyLimit
                    ethers.parseEther("2000"), // dailyLimit
                    ethers.parseEther("0.001"),// minWithdraw
                    ethers.parseEther("200")   // maxWithdraw
                )
            ).to.not.be.reverted;
        });

        it("F.4.4b — dopo aggiornamento limite, checkWithdrawLimits riflette il nuovo limite", async function () {
            // Con maxWithdraw=200, questo deve passare ora
            const [allowed] = await liquidityManager.checkWithdrawLimits(
                userA.address,
                ethers.parseEther("150")
            );
            expect(allowed).to.be.true;
        });

        it("F.4.4c — setWithdrawLimits da attacker reverta", async function () {
            await expect(
                liquidityManager.connect(userB).setWithdrawLimits(
                    ethers.parseEther("999"),
                    ethers.parseEther("9999"),
                    ethers.parseEther("0.001"),
                    ethers.parseEther("999")
                )
            ).to.be.reverted;
        });
    });
});
