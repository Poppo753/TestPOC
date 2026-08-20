import { ethers } from "hardhat";

async function main() {
    console.log("🔍 CHECKING CONTRACT OWNERSHIP\n");

    const valueCalculatorAddress = "0x4d763776C4474dc055CF7F1430b2DeeA9160283b";
    const valueCalculator = await ethers.getContractAt("ValueCalculator", valueCalculatorAddress);

    const [signer] = await ethers.getSigners();
    console.log(`👤 Your address: ${signer.address}`);
    
    const owner = await valueCalculator.owner();
    console.log(`👑 Contract owner: ${owner}`);
    
    console.log(`\n${signer.address === owner ? "✅ YOU ARE THE OWNER!" : "❌ YOU ARE NOT THE OWNER!"}`);
    
    if (signer.address !== owner) {
        console.log("\n💡 SOLUTION: Transfer ownership first or use the correct owner account");
        console.log("   Option 1: valueCalculator.transferOwnership(yourAddress)");
        console.log("   Option 2: Use the private key of the owner account");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
