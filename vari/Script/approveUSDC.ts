import { ethers } from "hardhat";

async function main() {
  const usdcToken = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Indirizzo USDC
  const poolAddress = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff"; // Indirizzo del Pool

  // ABI minima per la funzione approve
  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
  ];

  // Quantità da approvare (esempio: 100 USDC)
  const usdcAmount = ethers.parseUnits("1000000", 6); // 100 USDC (6 decimali)

  const [signer] = await ethers.getSigners();

  // Instanzia il contratto USDC
  const usdcContract = new ethers.Contract(usdcToken, erc20Abi, signer);

  console.log(`Approving ${usdcAmount.toString()} USDC for Pool...`);

  // Esegui l'approvazione
  const tx = await usdcContract.approve(poolAddress, usdcAmount);
  console.log("Transaction hash:", tx.hash);

  await tx.wait();
  console.log("USDC approved successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
