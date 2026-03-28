import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const NEW_VALUE_CALCULATOR = "0x2E042874BcFc6bE51e0D6b23F8Da22bDd8B215B0";

async function main() {
  console.log("\n🔄 UPDATE BEACON - VALUE CALCULATOR");
  console.log("=".repeat(80) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  console.log(`New ValueCalculator: ${NEW_VALUE_CALCULATOR}\n`);

  const beacon = await ethers.getContractAt(
    [
      "function owner() external view returns (address)",
      "function getImplementation(string) external view returns (address)",
      "function updateImplementation(string,address) external"
    ],
    BEACON
  );

  // Check current
  const owner = await beacon.owner();
  const currentImpl = await beacon.getImplementation("ValueCalculator");
  
  console.log(`Beacon Owner: ${owner}`);
  console.log(`Current ValueCalculator: ${currentImpl}`);
  console.log(`Is Owner: ${owner.toLowerCase() === signer.address.toLowerCase()}\n`);

  // Try update with gas limit
  console.log("🔄 Updating Beacon...");
  
  try {
    const tx = await beacon.updateImplementation("ValueCalculator", NEW_VALUE_CALCULATOR, {
      gasLimit: 500000
    });
    console.log(`📝 TX: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Updated in block ${receipt?.blockNumber}\n`);

    // Verify
    const newImpl = await beacon.getImplementation("ValueCalculator");
    console.log(`New ValueCalculator in Beacon: ${newImpl}`);
    console.log(`✅ Update successful: ${newImpl.toLowerCase() === NEW_VALUE_CALCULATOR.toLowerCase()}`);
    
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.data) {
      console.error(`Data: ${error.data}`);
    }
    
    // Try to decode error
    if (error.error) {
      console.error(`\nInner error:`, error.error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
