import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x2b52468D769fCD415d04E00Fe00B138C5638181F"; // Inserisci l'indirizzo del contratto
  const usdcToken = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Indirizzo USDC
  const ethToken = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // Indirizzo ETH

  // ABI minima per il contratto
  const contractAbi = [
    "function depositAndBorrow(address usdcToken, address ethToken, uint256 usdcAmount, uint256 ethBorrowAmount) external",
  ];

  const [signer] = await ethers.getSigners();

  // Instanzia il contratto
  const contract = new ethers.Contract(contractAddress, contractAbi, signer);

  // Quantità da depositare e prendere in prestito
  const usdcAmount = ethers.parseUnits("1", 0); // 100 USDC (6 decimali)
  const ethBorrowAmount = ethers.parseUnits("0.00000000001", 18); // 0.05 ETH (18 decimali)

  console.log(`Calling depositAndBorrow with ${usdcAmount.toString()} USDC...`);

  // Chiama la funzione depositAndBorrow
  const tx = await contract.depositAndBorrow(usdcToken, ethToken, usdcAmount, ethBorrowAmount);
  console.log("Transaction hash:", tx.hash);

  await tx.wait();
  console.log("USDC deposited and ETH borrowed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
