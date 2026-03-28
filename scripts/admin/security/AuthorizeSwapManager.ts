import { ethers } from "hardhat";

/**
 * AUTHORIZE SWAPMANAGER ON PROXYGENERAL
 * 
 * Adds SwapManager to ProxyGeneral's authorized modules list
 */

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";

async function main() {
    console.log("============================================================");
    console.log("  AUTHORIZE SWAPMANAGER ON PROXYGENERAL");
    console.log("============================================================\n");

    const [owner] = await ethers.getSigners();
    console.log(`Owner: ${owner.address}\n`);

    const beacon = await ethers.getContractAt("Beacon", BEACON);
    
    const proxyGeneralAddress = await beacon.getImplementation("ProxyGeneral");
    const swapManagerAddress = await beacon.getImplementation("SwapManager");
    
    console.log(`ProxyGeneral: ${proxyGeneralAddress}`);
    console.log(`SwapManager: ${swapManagerAddress}\n`);

    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", proxyGeneralAddress);
    
    // Check current status
    const wasAuthorized = await proxyGeneral.authorizedModules(swapManagerAddress);
    console.log(`Current status: ${wasAuthorized ? "AUTHORIZED" : "NOT AUTHORIZED"}\n`);
    
    if (wasAuthorized) {
        console.log("✅ SwapManager already authorized!");
        return;
    }

    // Authorize SwapManager
    console.log("Authorizing SwapManager...");
    console.log("⏳ Sending transaction...");

    const tx = await proxyGeneral.authorizeModule(swapManagerAddress, "SwapManager");
    
    console.log(`Transaction hash: ${tx.hash}`);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await tx.wait();
    
    console.log(`✅ Transaction confirmed!`);
    console.log(`   Block: ${receipt?.blockNumber}`);
    console.log(`   Gas used: ${receipt?.gasUsed.toString()}\n`);

    // Verify
    const isNowAuthorized = await proxyGeneral.authorizedModules(swapManagerAddress);
    console.log(`New status: ${isNowAuthorized ? "AUTHORIZED ✅" : "NOT AUTHORIZED ❌"}`);
    
    if (isNowAuthorized) {
        console.log("\n✅ SwapManager successfully authorized!");
        console.log("\nNext: Test swap");
        console.log("npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum");
    } else {
        console.log("\n❌ Authorization failed!");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
