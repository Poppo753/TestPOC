import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x1779ADd1c915262C4b455731Bff5423f7FD9a3F2"; // Inserisci l'indirizzo del contratto
  const usdcToken = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Indirizzo USDC

  const usdcAmount = ethers.parseUnits("0.1", 6); // 1 USDC (6 decimali)
  const ethBorrowAmount = ethers.parseUnits("0.000000001", 18); // 0.00001 ETH (18 decimali)

  // ABI minima per il contratto
  const contractAbi = [
    "function supplyAndBorrow(uint256 usdcAmount, uint256 ethBorrowAmount) external",
  ];

  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
  ];

  const [signer] = await ethers.getSigners();
  const contract = new ethers.Contract(contractAddress, contractAbi, signer);
  const usdc = new ethers.Contract(usdcToken, erc20Abi, signer);

  // Approva il contratto per spendere USDC
  console.log("Approving USDC for the contract...");
  const approveTx = await usdc.approve(contractAddress, ethers.MaxUint256);
  console.log("Approval transaction hash:", approveTx.hash);
  await approveTx.wait();
  console.log("USDC approved successfully!");

  // Chiama la funzione supplyAndBorrow
  console.log(`Supplying ${ethers.formatUnits(usdcAmount, 6)} USDC and borrowing ${ethers.formatUnits(ethBorrowAmount, 18)} ETH...`);
  const tx = await contract.supplyAndBorrow(usdcAmount, ethBorrowAmount);
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("Operation successful!");
}

main().catch((error) => {
  console.error("Error during interaction:", error);
  process.exitCode = 1;
});
