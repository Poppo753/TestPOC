import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔐 INVARIANT B.2 — LP Price Monotonicity
 *
 * INVARIANTE: il prezzo per LP token NON deve mai scendere in assenza di perdite.
 *
 * lpPrice = pool_WETH_balance / totalSupply
 *
 * Casi ammessi di crescita:
 *   - Accumulo di fee (rimangono nel pool)
 *   - Rendimenti simulati (trasferimento diretto al ProxyGeneral)
 *
 * Casi di stabilità (prezzo invariato):
 *   - Deposit da nuovi utenti (diluisce shares proporzionalmente)
 *   - Withdraw parziale (riduce sia pool che shares proporzionalmente)
 */
describe("Invariant B.2 — LP Price Monotonicity", function () {
    let beacon: any;
    let proxyGeneral: any;
    let liquidityManager: any;
    let mockWETH: any;
    let owner: any;
    let users: any[];

    // Tolleranza per rounding (1e9 wei = ~0.000000001 WETH)
    const PRICE_TOLERANCE = 1_000_000_000n;

    // ============================
    // HELPER: calcola LP price (in WETH per 1e18 shares)
    // ============================
    async function getLPPrice(): Promise<bigint> {
        const totalSupply = await proxyGeneral.totalSupply();
        if (totalSupply === 0n) return 0n;
        const poolWETH = await mockWETH.balanceOf(proxyGeneral.target);
        // Scala a 1e18 per precision
        return (poolWETH * 10n ** 18n) / totalSupply;
    }

    // ============================
    // HELPER: deposit
    // ============================
    async function depositFor(signer: any, amount: bigint) {
        await signer.sendTransaction({ to: mockWETH.target, value: amount });
        await mockWETH.connect(signer).approve(liquidityManager.target, amount);
        return liquidityManager.connect(signer).deposit(amount);
    }

    // ============================
    // HELPER: withdraw tutte le shares
    // ============================
    async function withdrawAllFor(signer: any) {
        const shares = await proxyGeneral.balanceOf(signer.address);
        if (shares === 0n) return;
        await proxyGeneral.connect(signer).approve(liquidityManager.target, shares);
        return liquidityManager.connect(signer).withdraw(shares);
    }

    // ============================
    // SETUP
    // ============================
    async function deployFixture() {
        const signers = await ethers.getSigners();
        const owner = signers[0];
        const feeRecipient = signers[1];
        const users = signers.slice(2, 7);

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
        await liquidityManager.setDepositFee(0);
        await liquidityManager.setWithdrawFee(0);

        for (const u of users) {
            await owner.sendTransaction({ to: u.address, value: ethers.parseEther("50") });
        }

        return { beacon, proxyGeneral, liquidityManager, mockWETH, mockOracle, owner, feeRecipient, users };
    }

    beforeEach(async function () {
        const f = await deployFixture();
        beacon = f.beacon;
        proxyGeneral = f.proxyGeneral;
        liquidityManager = f.liquidityManager;
        mockWETH = f.mockWETH;
        owner = f.owner;
        users = f.users;
    });

    // ============================
    // TEST 1: deposit non abbassa il prezzo
    // ============================
    it("B.2.1 — deposit da nuovo utente non abbassa il prezzo LP", async function () {
        // Primo deposit (primo utente definisce il prezzo iniziale)
        await depositFor(users[0], ethers.parseEther("10"));
        const priceAfterFirst = await getLPPrice();

        // 4 deposit aggiuntivi da utenti diversi
        for (let i = 1; i < 5; i++) {
            const priceBefore = await getLPPrice();
            await depositFor(users[i % users.length], ethers.parseEther("5"));
            const priceAfter = await getLPPrice();

            // Il prezzo non deve scendere (tolleranza per rounding)
            expect(priceAfter + PRICE_TOLERANCE).to.be.gte(
                priceBefore,
                `Prezzo sceso dopo deposit ${i}: ${priceAfter} < ${priceBefore}`
            );
        }

        // Prezzo finale non inferiore a quello iniziale
        const priceFinal = await getLPPrice();
        expect(priceFinal + PRICE_TOLERANCE).to.be.gte(
            priceAfterFirst,
            `Prezzo finale ${priceFinal} < prezzo iniziale ${priceAfterFirst}`
        );
    });

    // ============================
    // TEST 2: withdraw non abbassa il prezzo
    // ============================
    it("B.2.2 — withdraw parziale non abbassa il prezzo LP", async function () {
        // Setup: tutti depositano
        for (const u of users) {
            await depositFor(u, ethers.parseEther("10"));
        }

        const priceBeforeWithdraw = await getLPPrice();

        // Withdrawa parzialmente ognuno
        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            const shares = await proxyGeneral.balanceOf(u.address);
            const half = shares / 2n;
            if (half > 0n) {
                await proxyGeneral.connect(u).approve(liquidityManager.target, half);
                await liquidityManager.connect(u).withdraw(half);
            }
            const priceAfter = await getLPPrice();
            expect(priceAfter + PRICE_TOLERANCE).to.be.gte(
                priceBeforeWithdraw,
                `Prezzo sceso dopo withdraw ${i}: ${priceAfter} < ${priceBeforeWithdraw}`
            );
        }
    });

    // ============================
    // TEST 3: fee con recipient esterno — il prezzo deve restare stabile (non scende)
    // ============================
    it("B.2.3 — con fee su deposit, il prezzo LP non scende (fee escono dal pool)", async function () {
        // Configura fee 1% con feeRecipient esterno (il default del fixture)
        await liquidityManager.setDepositFee(100);

        // Primo deposit: prezzo iniziale
        await depositFor(users[0], ethers.parseEther("10"));
        const priceFirst = await getLPPrice();

        // Secondo deposit con fee: le shares emesse tengono conto della fee
        // Il prezzo LP deve restare >= al prezzo precedente
        for (let i = 1; i < 4; i++) {
            const priceBefore = await getLPPrice();
            await depositFor(users[i], ethers.parseEther("10"));
            const priceAfter = await getLPPrice();
            expect(priceAfter + PRICE_TOLERANCE).to.be.gte(
                priceBefore,
                `Prezzo sceso con fee deposit ${i}: ${priceAfter} < ${priceBefore}`
            );
        }

        // Prezzo finale >= prezzo iniziale (le fee non diluiscono i vecchi holders)
        const priceFinal = await getLPPrice();
        expect(priceFinal + PRICE_TOLERANCE).to.be.gte(
            priceFirst,
            `Prezzo finale ${priceFinal} < prezzo iniziale ${priceFirst}`
        );
    });

    // ============================
    // TEST 4: rendimento simulato aumenta il prezzo
    // ============================
    it("B.2.4 — rendimento simulato (trasferimento diretto) aumenta il prezzo LP", async function () {
        // Setup iniziale
        for (const u of users.slice(0, 3)) {
            await depositFor(u, ethers.parseEther("10"));
        }
        const priceBefore = await getLPPrice();

        // Simula rendimento: owner trasferisce WETH direttamente al ProxyGeneral
        const yieldAmount = ethers.parseEther("3"); // 10% di rendimento
        await owner.sendTransaction({ to: mockWETH.target, value: yieldAmount });
        // Trasferimento diretto (non via LiquidityManager)
        await mockWETH.connect(owner).transfer(proxyGeneral.target, yieldAmount);

        const priceAfter = await getLPPrice();

        // Il prezzo deve essere strettamente maggiore
        expect(priceAfter).to.be.gt(
            priceBefore,
            `Prezzo non cresciuto dopo rendimento: ${priceAfter} <= ${priceBefore}`
        );
    });

    // ============================
    // TEST 5: il prezzo non è mai negativo o zero dopo deposit
    // ============================
    it("B.2.5 — il prezzo LP è sempre > 0 dopo il primo deposit", async function () {
        await depositFor(users[0], ethers.parseEther("1"));
        const price = await getLPPrice();
        expect(price).to.be.gt(0n, "LP price è zero dopo il primo deposit");
    });
});
