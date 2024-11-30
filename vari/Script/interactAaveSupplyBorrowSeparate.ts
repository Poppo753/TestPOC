import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x2E1f703AAbF1Dc1f36ceB015a9Ec095ACFCa0d47"; // Inserisci l'indirizzo del contratto
  const usdcToken = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Indirizzo USDC

  const usdcAmount = ethers.parseUnits("1", 6); // 1 USDC (6 decimali)
  const ethBorrowAmount = ethers.parseUnits("0.0001", 18); // 0.00001 ETH (18 decimali)

  // ABI minima per il contratto
  const contractAbi = [
    "function supply(uint256 usdcAmount) external",
    "function borrow(uint256 ethBorrowAmount) external",
  ];

  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
  ];

  const [signer] = await ethers.getSigners();
  const contract = new ethers.Contract(contractAddress, contractAbi, signer);
  const usdc = new ethers.Contract(usdcToken, erc20Abi, signer);

  // Approva il contratto per spendere USDC
  console.log("Approving USDC for the contract...");
  const approveTx = await usdc.approve(contractAddress, usdcAmount);
  console.log("Approval transaction hash:", approveTx.hash);
  await approveTx.wait();
  console.log("USDC approved successfully!");

  // Step 1: Chiamata alla funzione `supply`
  console.log(`Supplying ${ethers.formatUnits(usdcAmount, 6)} USDC to Aave...`);
  const supplyTx = await contract.supply(usdcAmount);
  console.log("Supply transaction hash:", supplyTx.hash);
  await supplyTx.wait();
  console.log("USDC supplied successfully!");

  // Step 2: Chiamata alla funzione `borrow`
  console.log(`Borrowing ${ethers.formatUnits(ethBorrowAmount, 18)} ETH from Aave...`);
  const borrowTx = await contract.borrow(ethBorrowAmount);
  console.log("Borrow transaction hash:", borrowTx.hash);
  await borrowTx.wait();
  console.log("ETH borrowed successfully!");
}

main().catch((error) => {
  console.error("Error during interaction:", error);
  process.exitCode = 1;
});
