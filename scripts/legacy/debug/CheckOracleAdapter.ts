import { ethers } from "hardhat";

const ORACLE_ADAPTER = "0x16a5201814Ba08E8a7c8C1f59f83E0409206761c";

async function main() {
  console.log("\n🔍 CHECK ORACLE ADAPTER FUNCTIONS");
  console.log("=====================================\n");

  const adapter = await ethers.getContractAt(
    [
      "function owner() external view returns (address)",
      "function targetDenomination() external view returns (string)",
      "function maxErrorThreshold() external view returns (uint256)",
      "function supportsToken(string) external view returns (bool)",
      "function getPrice(string) external view returns (uint256, uint256, bool)"
    ],
    ORACLE_ADAPTER
  );

  console.log(`Contract: ${ORACLE_ADAPTER}`);
  
  try {
    const owner = await adapter.owner();
    console.log(`✅ owner(): ${owner}`);
  } catch (e: any) {
    console.log(`❌ owner(): ${e.message}`);
  }

  try {
    const target = await adapter.targetDenomination();
    console.log(`✅ targetDenomination(): ${target}`);
  } catch (e: any) {
    console.log(`❌ targetDenomination(): ${e.message}`);
  }

  try {
    const threshold = await adapter.maxErrorThreshold();
    console.log(`✅ maxErrorThreshold(): ${threshold}`);
  } catch (e: any) {
    console.log(`❌ maxErrorThreshold(): ${e.message}`);
  }

  try {
    const supports = await adapter.supportsToken("USDC");
    console.log(`✅ supportsToken("USDC"): ${supports}`);
  } catch (e: any) {
    console.log(`❌ supportsToken(): ${e.message}`);
  }

  try {
    const price = await adapter.getPrice("USDC");
    console.log(`✅ getPrice("USDC"): ${ethers.formatEther(price[0])} ETH`);
  } catch (e: any) {
    console.log(`❌ getPrice(): ${e.message}`);
  }

  // Test setReferenceFeed existence
  console.log("\n🔧 Testing write functions (estimateGas only):");
  
  const testAdapter = await ethers.getContractAt(
    ["function setReferenceFeed(string,address,uint8,uint256) external"],
    ORACLE_ADAPTER
  );

  try {
    await testAdapter.setReferenceFeed.estimateGas(
      "TEST",
      ethers.ZeroAddress,
      8,
      3600
    );
    console.log(`✅ setReferenceFeed() exists`);
  } catch (e: any) {
    if (e.message.includes("Invalid feed address")) {
      console.log(`✅ setReferenceFeed() exists (validation working)`);
    } else {
      console.log(`❌ setReferenceFeed(): ${e.message}`);
    }
  }

  // Get contract code to verify it's the right contract
  console.log("\n📜 Contract Code:");
  const code = await ethers.provider.getCode(ORACLE_ADAPTER);
  console.log(`   Size: ${code.length / 2 - 1} bytes`);
  console.log(`   Hash: ${ethers.keccak256(code)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
