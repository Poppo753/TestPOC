import hre from "hardhat";

async function main() {
    const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
    
    const beacon = await hre.ethers.getContractAt("Beacon", BEACON);
    
    console.log("\n🔍 Querying Beacon modules...");
    const modules = await beacon.getRegisteredModules();
    
    console.log(`\n📋 Total modules: ${modules.length}`);
    for (let i = 0; i < modules.length; i++) {
        const name = modules[i];
        const addr = await beacon.getImplementation(name);
        console.log(`  ${i + 1}. ${name} -> ${addr}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
