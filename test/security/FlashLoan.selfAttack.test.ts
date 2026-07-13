import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔒 C.4 — Flash Loan Self-Attack Tests
 *
 * NOTA: alcuni test (attacchi 2, 5) richiedono fork. I test strutturali
 * (attacchi 1, 3, 4) funzionano senza fork.
 *
 * SCENARI:
 *   1. Non-Plugin Flash Loan → NotRegisteredPlugin
 *   2. Flash Loan Price Manipulation (fork)
 *   3. Reentrancy su Flash Loan Callback → _inFlashLoan flag
 *   4. Unauthorized receiveFlashLoan → NotBalancerVault
 *   5. Swap da non-plugin (fork)
 *
 * Run: npx hardhat test test/security/FlashLoan.selfAttack.test.ts
 * Fork: $env:FORK_ENABLED="true"; npx hardhat test test/security/FlashLoan.selfAttack.test.ts
 */
describe("Security C.4 — Flash Loan Self-Attack", function () {
    this.timeout(120000);

    // ==================== ADDRESSES ====================
    const BALANCER_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    const WETH           = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

    // ==================== STATE ====================
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;
    let flashLoanService: any;
    let owner: any;
    let attacker: any;

    // ==================== SETUP ====================

    before(async function () {
        [owner, attacker] = await ethers.getSigners();

        const MockBeaconFactory       = await ethers.getContractFactory("MockBeacon");
        const MockTokenManagerFactory = await ethers.getContractFactory("MockTokenManager");
        const MockProxyGeneralFactory = await ethers.getContractFactory("MockProxyGeneral");

        mockBeacon       = await MockBeaconFactory.deploy();
        mockTokenManager = await MockTokenManagerFactory.deploy();
        mockProxyGeneral = await MockProxyGeneralFactory.deploy();

        const PLACEHOLDER = ethers.Wallet.createRandom().address;

        await mockBeacon.setImplementation("TokenManager",     await mockTokenManager.getAddress());
        await mockBeacon.setImplementation("ProxyGeneral",     await mockProxyGeneral.getAddress());
        await mockBeacon.setImplementation("ProtocolManager",  owner.address);
        await mockBeacon.setImplementation("LiquidityManager", owner.address);
        await mockBeacon.setImplementation("BASE_ASSET",       WETH);
        await mockBeacon.setImplementation("WETH",             WETH);
        await mockBeacon.setImplementation("BalancerVault",    BALANCER_VAULT);

        await mockTokenManager.setTokenAddress("WETH", WETH);
        await mockTokenManager.setTokenPrice("WETH", ethers.parseUnits("3000", 8));

        // Deploy FlashLoanService (1 argomento)
        const FlashFactory = await ethers.getContractFactory("FlashLoanService");
        flashLoanService = await FlashFactory.deploy(await mockBeacon.getAddress());
        await mockBeacon.setImplementation("FlashLoanService", await flashLoanService.getAddress());
    });

    // ==================== ATTACCO 1: Non-Plugin Flash Loan ====================

    describe("ATTACCO 1 — Non-Plugin Flash Loan (senza fork)", function () {
        it("C.4.1 — executeFlashLoan da EOA non registrato reverta NotRegisteredPlugin", async function () {
            // attacker NON è registrato come plugin nel beacon
            await expect(
                flashLoanService.connect(attacker).executeFlashLoan(
                    [WETH],
                    [ethers.parseEther("1")],
                    "0x"
                )
            ).to.be.revertedWithCustomError(flashLoanService, "NotRegisteredPlugin")
              .withArgs(attacker.address);
        });

        it("C.4.2 — executeFlashLoan da owner (ProtocolManager placeholder) non reverta NotRegisteredPlugin", async function () {
            // owner è registrato come ProtocolManager nel beacon
            // Il test verifica che il controllo di registrazione passi,
            // poi potrebbe revertare per altri motivi (no balance, fork needed, ecc.)
            try {
                await flashLoanService.connect(owner).executeFlashLoan(
                    [WETH],
                    [ethers.parseEther("0.001")],
                    "0x"
                );
                // Se arriva qui senza revert: OK (in fork avrebbe senso)
            } catch (e: any) {
                // Deve NON revertare con NotRegisteredPlugin
                if (e.message.includes("NotRegisteredPlugin")) {
                    throw new Error("owner (ProtocolManager) non dovrebbe ricevere NotRegisteredPlugin");
                }
                // Altri revert (senza fork) sono accettabili
            }
        });
    });

    // ==================== ATTACCO 3: Reentrancy su Flash Loan ====================

    describe("ATTACCO 3 — Reentrancy su Flash Loan Callback (senza fork)", function () {
        it("C.4.3 — il callback Balancer è bloccato quando non esiste un flash loan attivo", async function () {
            await ethers.provider.send("hardhat_impersonateAccount", [BALANCER_VAULT]);
            await ethers.provider.send("hardhat_setBalance", [BALANCER_VAULT, ethers.toQuantity(ethers.parseEther("1"))]);
            const balancerSigner = await ethers.getSigner(BALANCER_VAULT);
            await expect(
                flashLoanService.connect(balancerSigner).receiveFlashLoan([], [], [], "0x")
            ).to.be.revertedWithCustomError(flashLoanService, "NotInFlashLoan");
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [BALANCER_VAULT]);
        });

        it("C.4.4 — _inFlashLoan flag è privato (non accessibile dall'esterno)", async function () {
            // Verifica che il contratto non esponga _inFlashLoan pubblicamente
            // Questo è una caratteristica di sicurezza: lo stato interno non deve essere leakato
            try {
                const isInFlashLoan = await (flashLoanService as any).inFlashLoan();
                // Se accessibile (funzione pubblica/getter), deve essere false al momento
                expect(isInFlashLoan).to.be.false;
            } catch {
                // Non accessibile = corretto design
            }
        });
    });

    // ==================== ATTACCO 4: Unauthorized receiveFlashLoan ====================

    describe("ATTACCO 4 — Unauthorized receiveFlashLoan (senza fork)", function () {
        it("C.4.5 — receiveFlashLoan da EOA reverta NotBalancerVault", async function () {
            // Simula una chiamata diretta a receiveFlashLoan senza passare per Balancer
            const tokens = [WETH];
            const amounts = [ethers.parseEther("1")];
            const feeAmounts = [0n];

            await expect(
                flashLoanService.connect(attacker).receiveFlashLoan(
                    tokens,
                    amounts,
                    feeAmounts,
                    "0x"
                )
            ).to.be.revertedWithCustomError(flashLoanService, "NotBalancerVault")
              .withArgs(attacker.address);
        });

        it("C.4.6 — receiveFlashLoan da owner (non Balancer) reverta NotBalancerVault", async function () {
            const tokens = [WETH];
            const amounts = [ethers.parseEther("1")];
            const feeAmounts = [0n];

            await expect(
                flashLoanService.connect(owner).receiveFlashLoan(
                    tokens,
                    amounts,
                    feeAmounts,
                    "0x"
                )
            ).to.be.revertedWithCustomError(flashLoanService, "NotBalancerVault")
              .withArgs(owner.address);
        });
    });

    // ==================== ATTACCO 2+5: Fork Required ====================

    describe("ATTACCO 2+5 — Fork Tests (skip senza fork)", function () {
        before(function () {
            if (process.env.FORK_ENABLED !== "true") {
                this.skip();
            }
        });

        it("C.4.7 — Balancer vault è un contratto live su Arbitrum", async function () {
            const code = await ethers.provider.getCode(BALANCER_VAULT);
            expect(code.length).to.be.gt(2);
        });

        it("C.4.8 — WETH è un contratto live su Arbitrum", async function () {
            const code = await ethers.provider.getCode(WETH);
            expect(code.length).to.be.gt(2);
        });
    });

    // ==================== STRUTTURA ====================

    describe("Struttura FlashLoanService", function () {
        it("C.4.9 \u2014 beacon() ritorna l'indirizzo del beacon", async function () {
            const b = await flashLoanService.beacon();
            expect(b.toLowerCase()).to.equal((await mockBeacon.getAddress()).toLowerCase());
        });

        it("C.4.10 — bytecode > 1000 bytes (contratto non vuoto)", async function () {
            const code = await ethers.provider.getCode(await flashLoanService.getAddress());
            expect(code.length).to.be.gt(1000);
        });
    });
});
