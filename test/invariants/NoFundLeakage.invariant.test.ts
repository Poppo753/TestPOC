import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔐 INVARIANT B.5 — No Fund Leakage
 *
 * INVARIANTE: sum(balanceOf(users)) + pool_WETH = totalDeposited - totalFees
 *
 * I fondi non possono "scomparire" dal sistema: ogni wei depositato
 * deve essere tracciabile tra:
 *   1. WETH nel ProxyGeneral (pool)
 *   2. WETH riscattabile dalle shares degli utenti (proporzionale)
 *   3. Fee pagate al feeRecipient
 *
 * Totale: pool_WETH + feeRecipientWETH ≈ totalDeposited (entro dust)
 *
 * Verifica anche che il saldo totale degli utenti (shares → WETH)
 * non superi mai il pool disponibile.
 */
describe("Invariant B.5 — No Fund Leakage", function () {
    // Fork storage reads can be delayed by RPC backoff; functional assertions remain strict.
    this.timeout(180_000);

    let beacon: any;
    let proxyGeneral: any;
    let liquidityManager: any;
    let mockWETH: any;
    let owner: any;
    let feeRecipient: any;
    let users: any[];

    const DUST = ethers.parseEther("0.0001");

    // ============================
    // HELPER: ritorna la WETH riscattabile per un user (proporzionale alle shares)
    // ============================
    async function redeemableWETH(signer: any): Promise<bigint> {
        const shares = await proxyGeneral.balanceOf(signer.address);
        if (shares === 0n) return 0n;
        const totalSupply = await proxyGeneral.totalSupply();
        const poolWETH = await mockWETH.balanceOf(proxyGeneral.target);
        if (totalSupply === 0n) return 0n;
        return (shares * poolWETH) / totalSupply;
    }

    // ============================
    // HELPER: somma redeemable di tutti gli utenti
    // ============================
    async function totalRedeemable(): Promise<bigint> {
        let total = 0n;
        for (const u of users) {
            total += await redeemableWETH(u);
        }
        return total;
    }

    // ============================
    // HELPER: verifica no-leakage
    // ============================
    async function assertNoLeakage(totalDeposited: bigint, label: string) {
        const poolWETH = await mockWETH.balanceOf(proxyGeneral.target);
        const feeWETH = await mockWETH.balanceOf(feeRecipient.address);

        // Pool + fee ≈ totalDeposited
        const totalAccountedFor = poolWETH + feeWETH;
        const diff = totalDeposited > totalAccountedFor
            ? totalDeposited - totalAccountedFor
            : totalAccountedFor - totalDeposited;

        expect(diff).to.be.lte(DUST,
            `[${label}] Leakage: deposited=${ethers.formatEther(totalDeposited)}, pool+fee=${ethers.formatEther(totalAccountedFor)}, diff=${ethers.formatEther(diff)}`
        );

        // redeemable totale <= pool (non più di quanto c'è)
        const redeem = await totalRedeemable();
        expect(redeem).to.be.lte(poolWETH + DUST,
            `[${label}] Redeemable ${ethers.formatEther(redeem)} > pool ${ethers.formatEther(poolWETH)}`
        );
    }

    // ============================
    // SETUP
    // ============================
    async function deployFixture(depositFee: number = 0, withdrawFee: number = 0) {
        const signers = await ethers.getSigners();
        const owner = signers[0];
        const feeRecipient = signers[1];
        const users = signers.slice(2, 10); // 8 utenti

        const MockWETH = await ethers.getContractFactory("MockWETH");
        const mockWETH = await MockWETH.deploy();

        const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
        const mockOracle = await MockOracleAdapter.deploy();
        await mockOracle.setPrice("WETH", ethers.parseUnits("3000", 8));

        const Beacon = await ethers.getContractFactory("Beacon");
        const beacon = await Beacon.deploy();
        await beacon.updateImplementation("WETH", mockWETH.target);
        await beacon.updateImplementation("BASE_ASSET", mockWETH.target);

        const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
        const proxyGeneral = await ProxyGeneral.deploy(beacon.target, "WETH");

        const TokenManager = await ethers.getContractFactory("TokenManager");
        const tokenManager = await TokenManager.deploy(beacon.target, mockOracle.target);

        const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
        const valueCalculator = await ValueCalculator.deploy(beacon.target, "WETH");

        const SwapManager = await ethers.getContractFactory("SwapManager");
        const swapManager = await SwapManager.deploy(beacon.target, "WETH");

        const ParameterManager = await ethers.getContractFactory("ParameterManager");
        const parameterManager = await ParameterManager.deploy(beacon.target, 18);

        const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
        const liquidityManager = await LiquidityManager.deploy(beacon.target, "WETH");

        await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
        await beacon.updateImplementation("TokenManager", tokenManager.target);
        await beacon.updateImplementation("ValueCalculator", valueCalculator.target);
        await beacon.updateImplementation("SwapManager", swapManager.target);
        await beacon.updateImplementation("ParameterManager", parameterManager.target);
        await beacon.updateImplementation("LiquidityManager", liquidityManager.target);

        await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");
        await liquidityManager.setFeeRecipient(feeRecipient.address);
        await liquidityManager.setDepositFee(depositFee);
        await liquidityManager.setWithdrawFee(withdrawFee);

        // Ensure owner has enough ETH to fund all users (prevent state pollution across test files)
        await ethers.provider.send("hardhat_setBalance", [
            owner.address,
            ethers.toBeHex(ethers.parseEther("10000"))
        ]);
        for (const u of users) {
            await ethers.provider.send("hardhat_setBalance", [
                u.address,
                ethers.toQuantity(ethers.parseEther("100"))
            ]);
        }

        return { beacon, proxyGeneral, liquidityManager, mockWETH, owner, feeRecipient, users };
    }

    // ============================
    // TEST 1: solo deposit, senza fee
    // ============================
    it("B.5.1 — nessuna perdita durante deposit sequenziali senza fee", async function () {
        const f = await deployFixture(0, 0);
        beacon = f.beacon; proxyGeneral = f.proxyGeneral; liquidityManager = f.liquidityManager;
        mockWETH = f.mockWETH; owner = f.owner; feeRecipient = f.feeRecipient; users = f.users;

        let totalDeposited = 0n;
        for (const u of users) {
            const amount = ethers.parseEther("10");
            await u.sendTransaction({ to: mockWETH.target, value: amount });
            await mockWETH.connect(u).approve(liquidityManager.target, amount);
            await liquidityManager.connect(u).deposit(amount);
            totalDeposited += amount;
            await assertNoLeakage(totalDeposited, `deposit ${u.address.slice(0, 6)}`);
        }
    });

    // ============================
    // TEST 2: deposit + withdraw interleaved, senza fee
    // ============================
    it("B.5.2 — nessuna perdita con deposit e withdraw alternati", async function () {
        const f = await deployFixture(0, 0);
        beacon = f.beacon; proxyGeneral = f.proxyGeneral; liquidityManager = f.liquidityManager;
        mockWETH = f.mockWETH; owner = f.owner; feeRecipient = f.feeRecipient; users = f.users;

        let totalDeposited = 0n;
        let totalWithdrawn = 0n;

        // Deposita i primi 4
        for (const u of users.slice(0, 4)) {
            const amount = ethers.parseEther("20");
            await u.sendTransaction({ to: mockWETH.target, value: amount });
            await mockWETH.connect(u).approve(liquidityManager.target, amount);
            await liquidityManager.connect(u).deposit(amount);
            totalDeposited += amount;
        }

        // Alterna deposit e withdraw
        for (let i = 0; i < 4; i++) {
            const depositor = users[4 + i];
            const withdrawer = users[i];

            // Deposit
            const depAmount = ethers.parseEther("15");
            await depositor.sendTransaction({ to: mockWETH.target, value: depAmount });
            await mockWETH.connect(depositor).approve(liquidityManager.target, depAmount);
            await liquidityManager.connect(depositor).deposit(depAmount);
            totalDeposited += depAmount;

            // Withdraw parziale
            const shares = await proxyGeneral.balanceOf(withdrawer.address);
            const withdrawShares = shares / 3n;
            if (withdrawShares > 0n) {
                const balBefore = await mockWETH.balanceOf(withdrawer.address);
                await proxyGeneral.connect(withdrawer).approve(liquidityManager.target, withdrawShares);
                await liquidityManager.connect(withdrawer).withdraw(withdrawShares);
                const balAfter = await mockWETH.balanceOf(withdrawer.address);
                totalWithdrawn += (balAfter - balBefore);
            }

            // Verifica: pool + fee ≈ totalDeposited - totalWithdrawn
            await assertNoLeakage(totalDeposited - totalWithdrawn, `round ${i}`);
        }
    });

    // ============================
    // TEST 3: con fee su deposit — pool + feeRecipient ≈ totalDeposited
    // ============================
    it("B.5.3 — con fee su deposit, pool + feeRecipient = totalDeposited (no leakage)", async function () {
        const f = await deployFixture(100, 0); // 1% deposit fee, no withdraw fee
        beacon = f.beacon; proxyGeneral = f.proxyGeneral; liquidityManager = f.liquidityManager;
        mockWETH = f.mockWETH; owner = f.owner; feeRecipient = f.feeRecipient; users = f.users;

        let totalDeposited = 0n;

        for (const u of users.slice(0, 5)) {
            const amount = ethers.parseEther("10");
            await u.sendTransaction({ to: mockWETH.target, value: amount });
            await mockWETH.connect(u).approve(liquidityManager.target, amount);
            await liquidityManager.connect(u).deposit(amount);
            totalDeposited += amount;

            // Dopo ogni deposit: pool + feeRecipient ≈ totalDeposited
            const poolWETH = await mockWETH.balanceOf(proxyGeneral.target);
            const feeWETH = await mockWETH.balanceOf(feeRecipient.address);
            const totalAccounted = poolWETH + feeWETH;
            const diff = totalDeposited > totalAccounted
                ? totalDeposited - totalAccounted
                : totalAccounted - totalDeposited;
            expect(diff).to.be.lte(DUST,
                `Leakage dopo deposit ${u.address.slice(0,6)}: diff=${ethers.formatEther(diff)}`
            );
        }
    });

    // ============================
    // TEST 4: invariante su totalSupply — shares = redeemable value ≈ pool
    // ============================
    it("B.5.4 — le shares totali rappresentano esattamente il pool WETH", async function () {
        const f = await deployFixture(0, 0);
        beacon = f.beacon; proxyGeneral = f.proxyGeneral; liquidityManager = f.liquidityManager;
        mockWETH = f.mockWETH; owner = f.owner; feeRecipient = f.feeRecipient; users = f.users;

        for (const u of users.slice(0, 6)) {
            const amount = ethers.parseEther("7");
            await u.sendTransaction({ to: mockWETH.target, value: amount });
            await mockWETH.connect(u).approve(liquidityManager.target, amount);
            await liquidityManager.connect(u).deposit(amount);
        }

        const poolWETH = await mockWETH.balanceOf(proxyGeneral.target);
        const totalSupply = await proxyGeneral.totalSupply();
        const redeemable = await totalRedeemable();

        // La somma redeemable = pool WETH (entro dust da rounding)
        const diff = poolWETH > redeemable ? poolWETH - redeemable : redeemable - poolWETH;
        expect(diff).to.be.lte(DUST,
            `Redeemable ${ethers.formatEther(redeemable)} ≠ pool ${ethers.formatEther(poolWETH)}`
        );

        // totalSupply coerente
        expect(totalSupply).to.be.gt(0n);
    });
});
