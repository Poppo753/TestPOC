import { ethers } from "hardhat";

async function main() {
    console.log("\n🔍 CHECKING BEACON IMPLEMENTATIONS\n");
    
    const beaconAddress = process.env.BEACON_ADDRESS!;
    console.log(`Beacon address: ${beaconAddress}\n`);
    
    const beacon = await ethers.getContractAt("Beacon", beaconAddress);
    
    const implementations = [
        "LiquidityManager",
        "TokenManager",
        "SwapManager",
        "ValueCalculator",
        "ParameterManager",
        "EmergencyHandler",
        "ProxyGeneral",
        "WETH"
    ];
    
    for (const impl of implementations) {
        try {
            const address = await beacon.getImplementation(impl);
            console.log(`✅ ${impl.padEnd(20)}: ${address}`);
        } catch (error) {
            console.log(`❌ ${impl.padEnd(20)}: NOT REGISTERED`);
        }
    }
    
    console.log(`\n📋 Compare with .env:`);
    console.log(`   LIQUIDITY_MANAGER_ADDRESS=${process.env.LIQUIDITY_MANAGER_ADDRESS}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
