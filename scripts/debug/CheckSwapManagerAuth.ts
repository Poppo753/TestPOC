import { ethers } from "hardhat";

/**
 * CHECK SWAPMANAGER AUTHORIZATION ON PROXYGENERAL
 */

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";

async function main() {
    console.log("============================================================");
    console.log("  CHECK SWAPMANAGER AUTHORIZATION");
    console.log("============================================================\n");

    const beacon = await ethers.getContractAt("Beacon", BEACON);
    
    const proxyGeneralAddress = await beacon.getImplementation("ProxyGeneral");
    const swapManagerAddress = await beacon.getImplementation("SwapManager");
    
    console.log(`ProxyGeneral: ${proxyGeneralAddress}`);
    console.log(`SwapManager: ${swapManagerAddress}\n`);

    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", proxyGeneralAddress);
    
    const isAuthorized = await proxyGeneral.authorizedModules(swapManagerAddress);
    
    console.log(`SwapManager authorized: ${isAuthorized}`);
    
    if (!isAuthorized) {
        console.log("\n❌ SwapManager NOT AUTHORIZED!");
        console.log("\nSolution:");
        console.log("Run: proxyGeneral.setModuleAuthorization(swapManagerAddress, true)");
        console.log("\nOr run script:");
        console.log("npx hardhat run scripts/admin/security/AuthorizeSwapManager.ts --network arbitrum");
    } else {
        console.log("\n✅ SwapManager is authorized on ProxyGeneral");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
