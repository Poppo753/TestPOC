import { ethers } from "ethers"; // Importa Ethers.js per le utility
import { ethers as hardhatEthers } from "hardhat"; // Importa Hardhat Ethers per i signer

// ABI minima del contratto POOL
const poolAbi = [
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
];

async function main() {
  const poolAddress = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"; // Indirizzo del contratto POOL
  const usdcToken = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Indirizzo USDC
  const usdcAmount = ethers.parseUnits("1", 6); // 100 USDC (6 decimali)

  const [signer] = await hardhatEthers.getSigners(); // Ottieni il signer

  // Instanzia il contratto POOL
  const pool = new ethers.Contract(poolAddress, poolAbi, signer);

  console.log(`Supplying ${usdcAmount.toString()} USDC to Aave...`);

  // Esegui il supply
  const tx = await pool.supply(usdcToken, usdcAmount, signer.address, 0); // referralCode = 0
  console.log("Transaction hash:", tx.hash);

  await tx.wait();
  console.log("Supply successful!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
