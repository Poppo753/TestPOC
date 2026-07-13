import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔐 INVARIANT B.1 — Value Conservation
 *
 * INVARIANTE: totalWithdrawable >= totalDeposited - totalWithdrawn - totalFees - DUST_TOLERANCE
 *
 * Verifica che nessun fondo "scompaia" dal sistema.
 * DUST_TOLERANCE è necessario per errori di arrotondamento nelle divisioni integer.
 */
describe("Invariant B.1 — Value Conservation", function () {
    let beacon: any;
    let proxyGeneral: any;
    let liquidityManager: any;
    let mockWETH: any;
    let mockOracle: any;
    let owner: any;
    let feeRecipient: any;
    let users: any[];

    // 0.0001 WETH di tolleranza per rounding
    const DUST_TOLERANCE = ethers.parseEther("0.0001");

    // ============================
    // HELPER: wrap ETH → WETH e deposita
    // ============================
    async function depositFor(signer: any, amount: bigint): Promise<bigint> {
        await signer.sendTransaction({ to: mockWETH.target, value: amount });
        await mockWETH.connect(signer).approve(liquidityManager.target, amount);
        const tx = await liquidityManager.connect(signer).deposit(amount);
        const receipt = await tx.wait();
        // Estrai il fee dall'evento DepositFee se presente, altrimenti 0
        return 0n; // fee calcolata separatamente
    }

    // ============================
    // HELPER: ritorna quanto un utente può withdraware (in WETH)
    // ============================
    async function getWithdrawableValue(signer: any): Promise<bigint> {
        const shares = await proxyGeneral.balanceOf(signer.address);
        if (shares === 0n) return 0n;
        const totalSupply = await proxyGeneral.totalSupply();
        const poolWETH = await mockWETH.balanceOf(proxyGeneral.target);
        if (totalSupply === 0n) return 0n;
        // proportional share of pool
        return (shares * poolWETH) / totalSupply;
    }

    // ============================
    // SETUP: deploy con fee configurata
    // ============================
    async function deployFixture() {
        const signers = await ethers.getSigners();
        const owner = signers[0];
        const feeRecipient = signers[1];
        const users = signers.slice(2, 12); // 10 utenti

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

        // Senza fee per misurare value conservation pura
        await liquidityManager.setDepositFee(0);
        await liquidityManager.setWithdrawFee(0);

        for (const u of users) {
            await ethers.provider.send("hardhat_setBalance", [
                u.address,
                ethers.toQuantity(ethers.parseEther("50"))
            ]);
        }

        return { beacon, proxyGeneral, liquidityManager, mockWETH, mockOracle, owner, feeRecipient, users };
    }

    beforeEach(async function () {
        const f = await deployFixture();
        beacon = f.beacon;
        proxyGeneral = f.proxyGeneral;
        liquidityManager = f.liquidityManager;
        mockWETH = f.mockWETH;
        mockOracle = f.mockOracle;
        owner = f.owner;
        feeRecipient = f.feeRecipient;
        users = f.users;
    });

    // ============================
    // HELPER: verifica invariante
    // ============================
    async function checkValueInvariant(
        totalDeposited: bigint,
        totalWithdrawn: bigint,
        label: string
    ) {
        // Calcola quanto è withdrawable da tutti gli utenti
        let sumWithdrawable = 0n;
        for (const u of users) {
            sumWithdrawable += await getWithdrawableValue(u);
        }
        // Aggiungi il pool diretto (WETH diretto nel proxy, es. owner)
        const ownerWithdrawable = await getWithdrawableValue(owner);
        sumWithdrawable += ownerWithdrawable;

        // Quanto dovrebbe esserci nel pool (senza fee): deposited - withdrawn
        const expectedMinimum = totalDeposited > totalWithdrawn
            ? totalDeposited - totalWithdrawn
            : 0n;

        // Il pool WETH reale
        const poolWETH = await mockWETH.balanceOf(proxyGeneral.target);

        // Invariante: poolWETH >= expectedMinimum - DUST
        if (expectedMinimum > DUST_TOLERANCE) {
            expect(poolWETH + DUST_TOLERANCE).to.be.gte(
                expectedMinimum,
                `[${label}] Pool WETH ${ethers.formatEther(poolWETH)} < expected minimum ${ethers.formatEther(expectedMinimum - DUST_TOLERANCE)}`
            );
        }
    }

    // ============================
    // TEST 1: 10 deposit diversi
    // ============================
    it("B.1.1 — value conservation dopo 10 deposit di importi diversi", async function () {
        const amounts = [
            ethers.parseEther("1"),
            ethers.parseEther("5"),
            ethers.parseEther("10"),
            ethers.parseEther("0.5"),
            ethers.parseEther("3"),
            ethers.parseEther("7"),
            ethers.parseEther("2"),
            ethers.parseEther("15"),
            ethers.parseEther("0.1"),
            ethers.parseEther("4"),
        ];

        let totalDeposited = 0n;
        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            const amount = amounts[i];
            await u.sendTransaction({ to: mockWETH.target, value: amount });
            await mockWETH.connect(u).approve(liquidityManager.target, amount);
            await liquidityManager.connect(u).deposit(amount);
            totalDeposited += amount;
            await checkValueInvariant(totalDeposited, 0n, `dopo deposit ${i + 1}`);
        }
    });

    // ============================
    // TEST 2: 5 withdraw parziali
    // ============================
    it("B.1.2 — value conservation dopo 5 withdraw parziali", async function () {
        const depositAmount = ethers.parseEther("10");
        let totalDeposited = 0n;

        for (const u of users.slice(0, 5)) {
            await u.sendTransaction({ to: mockWETH.target, value: depositAmount });
            await mockWETH.connect(u).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(u).deposit(depositAmount);
            totalDeposited += depositAmount;
        }

        let totalWithdrawn = 0n;
        for (let i = 0; i < 5; i++) {
            const u = users[i];
            const shares = await proxyGeneral.balanceOf(u.address);
            const halfShares = shares / 2n;
            if (halfShares > 0n) {
                const balBefore = await mockWETH.balanceOf(u.address);
                await proxyGeneral.connect(u).approve(liquidityManager.target, halfShares);
                await liquidityManager.connect(u).withdraw(halfShares);
                const balAfter = await mockWETH.balanceOf(u.address);
                totalWithdrawn += (balAfter - balBefore);
            }
            await checkValueInvariant(totalDeposited, totalWithdrawn, `dopo withdraw ${i + 1}`);
        }
    });

    // ============================
    // TEST 3: pool deve tornare a 0 dopo withdraw completo
    // ============================
    it("B.1.3 — pool WETH si svuota completamente dopo tutti i withdraw", async function () {
        const depositAmount = ethers.parseEther("5");

        for (const u of users.slice(0, 5)) {
            await u.sendTransaction({ to: mockWETH.target, value: depositAmount });
            await mockWETH.connect(u).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(u).deposit(depositAmount);
        }

        // Withdrawa tutto
        for (const u of users.slice(0, 5)) {
            const shares = await proxyGeneral.balanceOf(u.address);
            if (shares > 0n) {
                await proxyGeneral.connect(u).approve(liquidityManager.target, shares);
                await liquidityManager.connect(u).withdraw(shares);
            }
        }

        const finalPool = await mockWETH.balanceOf(proxyGeneral.target);
        const finalSupply = await proxyGeneral.totalSupply();

        // Tolleranza dust: pool può avere residui trascurabili per rounding
        expect(finalPool).to.be.lte(DUST_TOLERANCE, `Pool non completamente svuotata: ${ethers.formatEther(finalPool)} WETH`);
        expect(finalSupply).to.equal(0n, "totalSupply non zero dopo withdraw completo");
    });

    // ============================
    // TEST 4: con fee > 0, le fee vanno al feeRecipient, non spariscono
    // ============================
    it("B.1.4 — con fee, il totale pool + fee = deposited (nessuna perdita)", async function () {
        // Imposta fee 1% deposit
        await liquidityManager.setDepositFee(100); // 100 bps = 1%

        const depositAmount = ethers.parseEther("10");
        let totalDeposited = 0n;

        for (const u of users.slice(0, 5)) {
            await u.sendTransaction({ to: mockWETH.target, value: depositAmount });
            await mockWETH.connect(u).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(u).deposit(depositAmount);
            totalDeposited += depositAmount;
        }

        const poolWETH = await mockWETH.balanceOf(proxyGeneral.target);
        const feeRecipientWETH = await mockWETH.balanceOf(feeRecipient.address);

        // Pool + fee_recipient ≈ totalDeposited (entro dust)
        const totalAccountedFor = poolWETH + feeRecipientWETH;
        const diff = totalDeposited > totalAccountedFor
            ? totalDeposited - totalAccountedFor
            : totalAccountedFor - totalDeposited;

        expect(diff).to.be.lte(DUST_TOLERANCE,
            `Fondi persi: deposited=${ethers.formatEther(totalDeposited)}, pool+fee=${ethers.formatEther(totalAccountedFor)}`
        );
    });
});
