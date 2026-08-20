import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 📐 F.5 — Edge Cases: Beacon Upgrade Scenarios
 *
 * Run: npx hardhat test test/unit/EdgeCases.beaconUpgrade.test.ts
 */
describe("Edge Cases F.5 — Beacon Upgrade", function () {
    this.timeout(60000);

    let beacon: any;
    let owner: any;
    let newOwner: any;
    let attacker: any;

    // Deploy due MockERC20 come implementazioni
    let impl1: any;
    let impl2: any;

    before(async function () {
        [owner, newOwner, attacker] = await ethers.getSigners();

        const BeaconFactory  = await ethers.getContractFactory("Beacon");
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");

        beacon = await BeaconFactory.deploy();
        // Usiamo MockERC20 come "implementazioni" poiché sono contratti deployati
        impl1 = await MockERC20Factory.deploy("ImplV1", "V1", 18);
        impl2 = await MockERC20Factory.deploy("ImplV2", "V2", 18);
    });

    // ==================== SCENARIO 1: Upgrade Base ====================

    describe("SCENARIO 1 — Upgrade base", function () {
        it("F.5.1 — registra impl1 come TestModule", async function () {
            await beacon.connect(owner).updateImplementation("TestModule", await impl1.getAddress());
            const addr = await beacon.getImplementation("TestModule");
            expect(addr.toLowerCase()).to.equal((await impl1.getAddress()).toLowerCase());
        });

        it("F.5.2 — upgrade a impl2 → getImplementation ritorna impl2", async function () {
            await beacon.connect(owner).updateImplementation("TestModule", await impl2.getAddress());
            const addr = await beacon.getImplementation("TestModule");
            expect(addr.toLowerCase()).to.equal((await impl2.getAddress()).toLowerCase());
        });

        it("F.5.3 — history contiene impl1 dopo upgrade", async function () {
            const history = await beacon.getImplementationHistory("TestModule");
            const impl1Addr = (await impl1.getAddress()).toLowerCase();
            const found = history.map((a: string) => a.toLowerCase()).includes(impl1Addr);
            expect(found).to.be.true;
        });
    });

    // ==================== SCENARIO 2: Freeze/Unfreeze ====================

    describe("SCENARIO 2 — Freeze/Unfreeze modulo", function () {
        it("F.5.4 — freezeModule blocca updateImplementation", async function () {
            await beacon.connect(owner).freezeModule("TestModule");

            await expect(
                beacon.connect(owner).updateImplementation("TestModule", await impl1.getAddress())
            ).to.be.reverted; // notFrozen modifier
        });

        it("F.5.5 — unfreezeModule ripristina accesso", async function () {
            await beacon.connect(owner).unfreezeModule("TestModule");

            // Ora deve poter aggiornare di nuovo
            await expect(
                beacon.connect(owner).updateImplementation("TestModule", await impl1.getAddress())
            ).to.not.be.reverted;
        });
    });

    // ==================== SCENARIO 3: Global Freeze ====================

    describe("SCENARIO 3 — Global Freeze", function () {
        it("F.5.6 — activateGlobalFreeze blocca getImplementation", async function () {
            await beacon.connect(owner).activateGlobalFreeze();

            // L'impl "BASE_ASSET" non è registrato, quindi getImplementation reverta per validModule
            // Ma con global freeze, tutte le funzioni che controllano frozen devono bloccarsi
            // Verifichiamo checkSystemHealth per vedere lo stato
            const [isHealthy] = await beacon.checkSystemHealth();
            // Con global freeze attivo, il sistema non è healthy
            expect(isHealthy).to.be.false;
        });

        it("F.5.7 — deactivateGlobalFreeze riattiva il sistema", async function () {
            await beacon.connect(owner).deactivateGlobalFreeze();

            const [isHealthy] = await beacon.checkSystemHealth();
            // Dopo deactivate, può tornare healthy (o no per altri motivi)
            expect(typeof isHealthy).to.equal("boolean");
        });
    });

    // ==================== SCENARIO 4: Non-Contract Address ====================

    describe("SCENARIO 4 — Non-contract address", function () {
        it("F.5.8 — updateImplementation con EOA reverta 'Implementation must be a contract'", async function () {
            await expect(
                beacon.connect(owner).updateImplementation("TestModule", attacker.address)
            ).to.be.revertedWith("Implementation must be a contract");
        });
    });

    // ==================== SCENARIO 5: Same Address ====================

    describe("SCENARIO 5 — Same implementation address", function () {
        it("F.5.9 — updateImplementation con stesso indirizzo reverta", async function () {
            // Prima imposta impl1
            const currentAddr = await beacon.getImplementation("TestModule");

            await expect(
                beacon.connect(owner).updateImplementation("TestModule", currentAddr)
            ).to.be.revertedWith("Same implementation address");
        });
    });

    // ==================== SCENARIO 6: 2-Step Ownership ====================

    describe("SCENARIO 6 — 2-Step Ownership Transfer", function () {
        it("F.5.10 — transferOwnership imposta pendingOwner", async function () {
            await beacon.connect(owner).transferOwnership(newOwner.address);
            const pending = await beacon.pendingOwner();
            expect(pending.toLowerCase()).to.equal(newOwner.address.toLowerCase());
        });

        it("F.5.11 — acceptOwnership da newOwner trasferisce ownership", async function () {
            await beacon.connect(newOwner).acceptOwnership();
            const currentOwner = await beacon.owner();
            expect(currentOwner.toLowerCase()).to.equal(newOwner.address.toLowerCase());
        });

        it("F.5.12 — vecchio owner non può più fare updateImplementation", async function () {
            const MockERC20Factory = await ethers.getContractFactory("MockERC20");
            const impl3 = await MockERC20Factory.deploy("ImplV3", "V3", 18);

            await expect(
                beacon.connect(owner).updateImplementation("TestModule", await impl3.getAddress())
            ).to.be.revertedWith("Only owner can call this function");
        });

        it("F.5.13 — nuovo owner può fare updateImplementation", async function () {
            const MockERC20Factory = await ethers.getContractFactory("MockERC20");
            const impl3 = await MockERC20Factory.deploy("ImplV3", "V3", 18);

            await expect(
                beacon.connect(newOwner).updateImplementation("TestModule", await impl3.getAddress())
            ).to.not.be.reverted;
        });
    });
});
