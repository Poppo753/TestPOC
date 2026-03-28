import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const NEW_VALUE_CALCULATOR = "0xEa86c60Ae788FCF8821FC215c2536DA1e543c46e";

async function main() {
  console.log("\n🔄 UPDATE BEACON - VALUE CALCULATOR");
  console.log("=".repeat(80) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}\n`);

  const beacon = await ethers.getContractAt(
    [
      "function owner() external view returns (address)",
      "function getImplementation(string) external view returns (address)",
      "function updateImplementation(string,address) external"
    ],
    BEACON
  );

  const owner = await beacon.owner();
  console.log(`Beacon Owner: ${owner}`);
  console.log(`Is Signer Owner: ${owner.toLowerCase() === signer.address.toLowerCase() ? 'YES ✅' : 'NO ❌'}\n`);

  // Try updateImplementation instead of setImplementation
  console.log("🔄 Updating ValueCalculator implementation...");
  const tx = await beacon.updateImplementation("ValueCalculator", NEW_VALUE_CALCULATOR);
  console.log(`📝 TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ Updated!\n`);

  // Verify
  const newImpl = await beacon.getImplementation("ValueCalculator");
  console.log(`📊 New Implementation: ${newImpl}`);
  console.log(`Match: ${newImpl.toLowerCase() === NEW_VALUE_CALCULATOR.toLowerCase() ? '✅' : '❌'}`);

  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
