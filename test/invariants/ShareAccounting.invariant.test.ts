import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔐 INVARIANT B.3 — Share Accounting
 *
 * INVARIANTE: sum(balanceOf(userN)) === proxyGeneral.totalSupply()
 *
 * Questa proprietà matematica deve reggere dopo ogni operazione di deposit o withdraw,
 * indipendentemente dall'ordine o dall'importo. Se si rompe → bug critico nel mint/burn.
 */
describe("Invariant B.3 — Share Accounting", function () {
    let beacon: any;
    let proxyGeneral: any;
    let liquidityManager: any;
    let mockWETH: any;
    let owner: any;
    let users: any[];

    const DEPOSIT_AMOUNT = ethers.parseEther("10.0");

    // ============================
    // HELPER: verifica invariante
    // ============================
    async function checkShareInvariant(label: string) {
        const totalSupply = await proxyGeneral.totalSupply();
        let sumShares = 0n;
        for (const u of users) {
            sumShares += await proxyGeneral.balanceOf(u.address);
        }
        expect(sumShares).to.equal(
            totalSupply,
            `[${label}] sum(shares) ${sumShares} !== totalSupply ${totalSupply}`
        );
    }

    // ============================
    // HELPER: deposit WETH
    // ============================
    async function depositFor(signer: any, amount: bigint) {
        // Wrap ETH → WETH (MockWETH.deposit payable)
        await signer.sendTransaction({ to: mockWETH.target, value: amount });
        await mockWETH.connect(signer).approve(liquidityManager.target, amount);
        return liquidityManager.connect(signer).deposit(amount);
    }

    // ============================
    // HELPER: withdraw all shares
    // ============================
    async function withdrawAllFor(signer: any) {
        const shares = await proxyGeneral.balanceOf(signer.address);
        if (shares === 0n) return;
        // ProxyGeneral è il LP token: serve approvare LiquidityManager a bruciare le shares
        await proxyGeneral.connect(signer).approve(liquidityManager.target, shares);
        return liquidityManager.connect(signer).withdraw(shares);
    }

    // ============================
    // SETUP: deploy completo
    // ============================
    async function deployFixture() {
        const signers = await ethers.getSigners();
        const owner = signers[0];
        const users = signers.slice(1, 6); // 5 utenti

        // MockWETH
        const MockWETH = await ethers.getContractFactory("MockWETH");
        const mockWETH = await MockWETH.deploy();

        // MockOracleAdapter
        const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
        const mockOracle = await MockOracleAdapter.deploy();
        await mockOracle.setPrice("WETH", ethers.parseUnits("3000", 8));

        // Beacon
        const Beacon = await ethers.getContractFactory("Beacon");
        const beacon = await Beacon.deploy();
        await beacon.updateImplementation("WETH", mockWETH.target);
        await beacon.updateImplementation("BASE_ASSET", mockWETH.target);

        // Core contracts
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

        // Beacon registrations
        await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
        await beacon.updateImplementation("TokenManager", tokenManager.target);
        await beacon.updateImplementation("ValueCalculator", valueCalculator.target);
        await beacon.updateImplementation("SwapManager", swapManager.target);
        await beacon.updateImplementation("ParameterManager", parameterManager.target);
        await beacon.updateImplementation("LiquidityManager", liquidityManager.target);

        // Autorizza LiquidityManager nel ProxyGeneral
        await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");

        // Fee recipient
        await liquidityManager.setFeeRecipient(owner.address);

        // Finanzia ogni utente con ETH
        for (const u of users) {
            await owner.sendTransaction({ to: u.address, value: ethers.parseEther("50") });
        }

        return { beacon, proxyGeneral, liquidityManager, mockWETH, owner, users };
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
    // INVARIANTE 1: dopo 5 deposit
    // ============================
    it("B.3.1 — invariante regge dopo 5 deposit alternati", async function () {
        await checkShareInvariant("T=0 vuoto");

        for (let i = 0; i < users.length; i++) {
            await depositFor(users[i], DEPOSIT_AMOUNT);
            await checkShareInvariant(`dopo deposit utente ${i}`);
        }
    });

    // ============================
    // INVARIANTE 2: dopo 5 withdraw
    // ============================
    it("B.3.2 — invariante regge dopo 5 withdraw alternati", async function () {
        // Prima deposita tutti
        for (const u of users) {
            await depositFor(u, DEPOSIT_AMOUNT);
        }
        await checkShareInvariant("dopo tutti i deposit");

        // Poi withdrawa uno alla volta
        for (let i = 0; i < users.length; i++) {
            await withdrawAllFor(users[i]);
            await checkShareInvariant(`dopo withdraw utente ${i}`);
        }
    });

    // ============================
    // INVARIANTE 3: sequenza mista
    // ============================
    it("B.3.3 — invariante regge su 20+ operazioni miste deposit/withdraw", async function () {
        await checkShareInvariant("T=0");

        // 5 deposit
        for (let i = 0; i < 5; i++) {
            await depositFor(users[i % users.length], DEPOSIT_AMOUNT);
            await checkShareInvariant(`op ${i + 1}/20`);
        }

        // 5 withdraw parziali (50% delle shares)
        for (let i = 0; i < 5; i++) {
            const u = users[i % users.length];
            const shares = await proxyGeneral.balanceOf(u.address);
            if (shares > 0n) {
                const half = shares / 2n;
                await proxyGeneral.connect(u).approve(liquidityManager.target, half);
                await liquidityManager.connect(u).withdraw(half);
            }
            await checkShareInvariant(`op ${5 + i + 1}/20`);
        }

        // 5 deposit di importi diversi
        const amounts = [
            ethers.parseEther("1"),
            ethers.parseEther("5"),
            ethers.parseEther("0.5"),
            ethers.parseEther("20"),
            ethers.parseEther("3"),
        ];
        for (let i = 0; i < 5; i++) {
            await depositFor(users[i], amounts[i]);
            await checkShareInvariant(`op ${10 + i + 1}/20`);
        }

        // 5 withdraw totali
        for (let i = 0; i < 5; i++) {
            await withdrawAllFor(users[i]);
            await checkShareInvariant(`op ${15 + i + 1}/20`);
        }

        // Verifica finale: pool vuota
        const finalSupply = await proxyGeneral.totalSupply();
        const sumFinal = (await Promise.all(users.map(u => proxyGeneral.balanceOf(u.address))))
            .reduce((a: bigint, b: bigint) => a + b, 0n);
        expect(sumFinal).to.equal(finalSupply, "Pool finale: somma shares !== totalSupply");
    });

    // ============================
    // INVARIANTE 4: deposit dello stesso utente più volte
    // ============================
    it("B.3.4 — invariante regge con multi-deposit dallo stesso utente", async function () {
        const u = users[0];
        for (let i = 0; i < 5; i++) {
            await depositFor(u, DEPOSIT_AMOUNT);
            await checkShareInvariant(`deposit ripetuto ${i + 1}/5`);
        }
    });
});
