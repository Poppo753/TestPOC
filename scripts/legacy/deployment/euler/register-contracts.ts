/**
 * Register remaining deployed contracts in Beacon
 */

import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";

const CONTRACTS = {
    FlashLoanService: "0xe3CfDe7684e60A55cC2Aae1fcf996C76de04B337"
};

async function main() {
    const [deployer] = await ethers.getSigners();
    const beacon = await ethers.getContractAt(
        ["function updateImplementation(string,address) external"],
        BEACON,
        deployer
    );

    for (const [name, addr] of Object.entries(CONTRACTS)) {
        console.log(`Registering ${name}: ${addr}`);
        const tx = await beacon.updateImplementation(name, addr);
        await tx.wait();
        console.log("✅ Registered!\n");
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
