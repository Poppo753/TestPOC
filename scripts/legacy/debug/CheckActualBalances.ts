import { ethers } from "hardhat";

const PROXY = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const DOLOMITE_PLUGIN = "0x..."; // Need to find deployed DolomitePlugin address
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  console.log("\n🔍 CHECKING ACTUAL BALANCES");
  console.log("=".repeat(100) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}\n`);

  // Check ProxyGeneral balances
  console.log("📊 ProxyGeneral Balances:");
  console.log("-".repeat(100));

  const tokens = [
    { name: "WETH", address: WETH, decimals: 18 },
    { name: "USDC", address: USDC, decimals: 6 },
    { name: "WBTC", address: WBTC, decimals: 8 }
  ];

  for (const token of tokens) {
    const tokenContract = await ethers.getContractAt(
      ["function balanceOf(address) external view returns (uint256)"],
      token.address
    );

    const balance = await tokenContract.balanceOf(PROXY);
    console.log(`   ${token.name}: ${ethers.formatUnits(balance, token.decimals)}`);
  }

  // Check ETH balance
  const ethBalance = await ethers.provider.getBalance(PROXY);
  console.log(`   ETH: ${ethers.formatEther(ethBalance)}\n`);

  // Try to read from deployments to find all deployed plugins
  console.log("🔌 Checking Deployed Plugins:");
  console.log("-".repeat(100));

  const deployments = {
    "UniswapV3Plugin": "0x7ec91aEc1bD85E63D671b23E5deC8157D1f8aE01"
  };

  for (const [name, address] of Object.entries(deployments)) {
    console.log(`\n${name}: ${address}`);
    
    // Check contract code
    const code = await ethers.provider.getCode(address);
    const hasCode = code !== "0x";
    console.log(`   Has code: ${hasCode ? '✅' : '❌'}`);

    if (hasCode) {
      // Try to get protocol info
      try {
        const plugin = await ethers.getContractAt(
          ["function getProtocolInfo() external view returns (tuple(string,string,uint8))"],
          address
        );
        const info = await plugin.getProtocolInfo();
        console.log(`   Protocol: ${info[0]}`);
        console.log(`   Version: ${info[1]}`);
        console.log(`   Features: ${info[2]}`);
      } catch (e: any) {
        console.log(`   Could not read protocol info`);
      }
    }
  }

  console.log("\n\n" + "=".repeat(100));
  console.log("💡 NEXT STEPS:");
  console.log("=".repeat(100));
  console.log("1. If ProxyGeneral has token balances, we can test withdrawal");
  console.log("2. If no balances, need to first deposit tokens");
  console.log("3. UniswapV3Plugin is for swapping, not LP positions");
  console.log("4. May need to deploy a DolomitePlugin or LP management plugin");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
