import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 📐 F.3 — Edge Cases: Timelock (proposta → attesa → esecuzione)
 *
 * Nota: i timelock del ParameterManager sono coperti in F.6.
 * Questo file si concentra sui timelock dell'EmergencyHandler e su
 * comportamenti limite del timelock in ParameterManager.
 *
 * Run: npx hardhat test test/unit/EdgeCases.timelock.test.ts
 */
describe("Edge Cases F.3 — Timelock Behaviors", function () {
    this.timeout(60000);

    let beacon: any;
    let pm: any;
    let owner: any;

    before(async function () {
        [owner] = await ethers.getSigners();

        const MockBeaconFactory = await ethers.getContractFactory("MockBeacon");
        beacon = await MockBeaconFactory.deploy();

        const PMFactory = await ethers.getContractFactory("ParameterManager");
        pm = await PMFactory.deploy(await beacon.getAddress(), 18);
    });

    describe("F.3.1 — Proposta con timelock esatto", function () {
        let proposalValue: bigint;

        before(async function () {
            const info = await pm.getParameterInfo("withdrawLimitPerHour");
            const unit = BigInt(10 ** 18);
            proposalValue = info.currentValue > info.minValue + unit
                ? info.currentValue - unit
                : info.currentValue + unit;

            expect(proposalValue).to.be.within(info.minValue, info.maxValue);
            expect(proposalValue).to.not.equal(info.currentValue);
        });

        it("F.3.1a — proposta ha 24h timelock", async function () {
            const timelockSeconds = await pm.getParameterTimelock();
            expect(timelockSeconds).to.equal(24n * 3600n);
        });

        it("F.3.1b — proposta accettata dal sistema", async function () {
            await expect(
                pm.connect(owner).proposeParameterChange("withdrawLimitPerHour", proposalValue)
            ).to.not.be.reverted;
        });

        it("F.3.1c — execute prima del timelock reverta", async function () {
            await expect(
                pm.connect(owner)["executeParameterChange(string)"]("withdrawLimitPerHour")
            ).to.be.reverted;
        });

        it("F.3.1d — avanza 24h + 1s e execute passa", async function () {
            await ethers.provider.send("evm_increaseTime", [24 * 3600 + 1]);
            await ethers.provider.send("evm_mine", []);
            await expect(
                pm.connect(owner)["executeParameterChange(string)"]("withdrawLimitPerHour")
            ).to.not.be.reverted;
        });
    });

    describe("F.3.2 — Timelock configurabile", function () {
        it("F.3.2a — setParameterTimelock da owner funziona", async function () {
            const newTimelock = 12 * 3600; // 12 ore
            await pm.connect(owner).setParameterTimelock(newTimelock);
            const tl = await pm.getParameterTimelock();
            expect(tl).to.equal(BigInt(newTimelock));
        });

        it("F.3.2b — timelock 0 è rifiutato dal limite minimo di sicurezza", async function () {
            await expect(pm.connect(owner).setParameterTimelock(0))
                .to.be.revertedWith("Timelock below minimum");
            expect(await pm.getParameterTimelock()).to.equal(12n * 3600n);
        });
    });
});
