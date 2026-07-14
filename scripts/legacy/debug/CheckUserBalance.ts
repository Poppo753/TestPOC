import { ethers } from "hardhat";

const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("\n📊 Token Balances:");
  console.log(`User: ${signer.address}\n`);

  const tokens = [
    { name: "USDC", address: USDC, decimals: 6 },
    { name: "WETH", address: WETH, decimals: 18 },
    { name: "WBTC", address: WBTC, decimals: 8 }
  ];

  for (const token of tokens) {
    const contract = await ethers.getContractAt(
      ["function balanceOf(address) external view returns (uint256)"],
      token.address
    );
    
    const balance = await contract.balanceOf(signer.address);
    console.log(`${token.name}: ${ethers.formatUnits(balance, token.decimals)}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
