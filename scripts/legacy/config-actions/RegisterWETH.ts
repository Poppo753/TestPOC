import { ethers } from "hardhat";

const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
const ORACLE_ADAPTER = "0x018f6392eb912624930d68c3c226b707B1D8B2A7";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  console.log("\n📝 REGISTER WETH IN TOKEN MANAGER");
  console.log("=".repeat(80) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}\n`);

  const tokenManager = await ethers.getContractAt(
    [
      "function addToken(string,address,uint8,uint256,uint256) external",
      "function getTokenInfo(string) external view returns (tuple(address,uint256,string,bool,uint256,uint256,uint256,uint256))"
    ],
    TOKEN_MANAGER
  );

  // Check if already registered
  console.log("Checking if WETH is already registered...");
  try {
    const info = await tokenManager.getTokenInfo("WETH");
    console.log(`WETH is already registered: ${info[0]}`);
    console.log(`Active: ${info[3]}`);
    return;
  } catch (e: any) {
    console.log(`WETH not registered yet\n`);
  }

  // Register WETH
  console.log("Registering WETH...");
  console.log(`Token Code: WETH`);
  console.log(`Address: ${WETH}`);
  console.log(`Decimals: 18`);
  console.log(`Min Balance: 0`);
  console.log(`Max Balance: 1000000 ETH\n`);

  const tx = await tokenManager.addToken(
    "WETH",
    WETH,
    18,
    0, // minBalance
    ethers.parseEther("1000000") // maxBalance
  );

  console.log(`📝 TX: ${tx.hash}`);
  console.log(`⏳ Waiting...`);

  await tx.wait();
  console.log(`✅ WETH registered!\n`);

  // Verify
  const info = await tokenManager.getTokenInfo("WETH");
  console.log(`✅ Verified:`);
  console.log(`   Address: ${info[0]}`);
  console.log(`   Decimals: ${info[1]}`);
  console.log(`   Active: ${info[3]}`);

  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
