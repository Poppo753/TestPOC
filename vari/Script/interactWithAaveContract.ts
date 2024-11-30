import { ethers } from "hardhat";
import { BigNumberish } from "ethers";

async function main() {
  const contractAddress = "0xEafED6EfC95ed9995C4c770420aD5E7fFfB6D761"; // Indirizzo del contratto deployato
  const usdcToken = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Indirizzo USDC
  const poolDataProviderAddress = "0x7F23D86Ee20D869112572136221e173428DD740B"; // Inserisci l'indirizzo di PoolDataProvider

  const usdcAmount = ethers.parseUnits("1", 6); // Importo di USDC da depositare (1 USDC)
  const healthFactorTarget = ethers.parseUnits("1.5", 18); // Health Factor desiderato (1.5)

  // ABI minimi per il contratto
  const contractAbi = [
    "function supply(uint256 usdcAmount) external",
    "function borrow(uint256 ethBorrowAmount) external",
  ];

  const poolDataProviderAbi = [
    "function getUserAccountData(address user) view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)"
  ];

  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
  ];

  const [signer] = await ethers.getSigners();
  const contract = new ethers.Contract(contractAddress, contractAbi, signer);
  const usdc = new ethers.Contract(usdcToken, erc20Abi, signer);
  const poolDataProvider = new ethers.Contract(poolDataProviderAddress, poolDataProviderAbi, signer);

  // Step 1: Approva il contratto per spendere USDC
  console.log("Approving USDC for the contract...");
  const approveTx = await usdc.approve(contractAddress, usdcAmount);
  console.log("Approval transaction hash:", approveTx.hash);
  await approveTx.wait();
  console.log("USDC approved successfully!");

  // Step 2: Deposita 1 USDC
  console.log(`Supplying ${ethers.formatUnits(usdcAmount, 6)} USDC to Aave...`);
  const supplyTx = await contract.supply(usdcAmount);
  console.log("Supply transaction hash:", supplyTx.hash);
  await supplyTx.wait();
  console.log("USDC supplied successfully!");

  // Step 3: Ottieni i dati dell'account dal PoolDataProvider
  console.log("Fetching account data...");
  const userData = await poolDataProvider.getUserAccountData(contractAddress);
  console.log("Total Collateral in ETH:", ethers.formatUnits(userData.totalCollateralETH, 18));
  console.log("Available to Borrow in ETH:", ethers.formatUnits(userData.availableBorrowsETH, 18));

  // Step 4: Calcola quanto ETH prendere in prestito per un Health Factor di 1.5
  const totalCollateralETH = userData.totalCollateralETH;
  const ltv = userData.ltv / 10000; // LTV è in basis points, quindi dividiamo per 10000
  const maxBorrowETH = totalCollateralETH.mul(ltv).div(healthFactorTarget);

  console.log("Calculated ETH Borrow Amount:", ethers.formatUnits(maxBorrowETH, 18));

  // Step 5: Prendi in prestito ETH
  console.log(`Borrowing ${ethers.formatUnits(maxBorrowETH, 18)} ETH from Aave...`);
  const borrowTx = await contract.borrow(maxBorrowETH);
  console.log("Borrow transaction hash:", borrowTx.hash);
  await borrowTx.wait();
  console.log("ETH borrowed successfully!");
}

main().catch((error) => {
  console.error("Error during interaction:", error);
  process.exitCode = 1;
});
