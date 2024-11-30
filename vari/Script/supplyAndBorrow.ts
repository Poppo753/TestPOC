import { ethers } from "hardhat";

async function main() {
  // Indirizzi aggiornati
  const poolAddress = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"; // Indirizzo del contratto POOL
  const usdcToken = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Indirizzo USDC
  const ethToken = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // Indirizzo WETH (ETH)

  // Importi per le transazioni
  const usdcAmount = ethers.parseUnits("1", 6); // 100 USDC (6 decimali)
  const ethBorrowAmount = ethers.parseUnits("0.00001", 18); // 0.05 ETH (18 decimali)

  // ABI minima per il contratto POOL
  const poolAbi = [
    "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
    "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external",
  ];

  // ABI minima per il contratto ERC-20 (USDC)
  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
  ];

  // Ottieni il firmatario
  const [signer] = await ethers.getSigners();

  // Instanzia i contratti
  const pool = new ethers.Contract(poolAddress, poolAbi, signer);
  const usdc = new ethers.Contract(usdcToken, erc20Abi, signer);

  try {
    // Step 1: Controllo e approvazione di USDC
    const allowance = await usdc.allowance(signer.address, poolAddress);
    console.log("USDC Allowance:", allowance.toString());

    // Confronto numerico
    if (allowance < usdcAmount) {
      console.log("Approving USDC for the Pool...");
      const approveTx = await usdc.approve(poolAddress, usdcAmount);
      console.log("Approval transaction hash:", approveTx.hash);
      await approveTx.wait();
      console.log("USDC approved successfully!");
    } else {
      console.log("USDC is already approved for the Pool.");
    }

    // Step 2: Deposito di USDC (Supply)
    console.log(`Supplying ${ethers.formatUnits(usdcAmount, 6)} USDC to Aave...`);
    const supplyTx = await pool.supply(usdcToken, usdcAmount, signer.address, 0); // Referral code 0
    console.log("Supply transaction hash:", supplyTx.hash);
    await supplyTx.wait();
    console.log("USDC supplied successfully!");

    // Step 3: Prestito di ETH (Borrow)
    console.log(`Borrowing ${ethers.formatUnits(ethBorrowAmount, 18)} ETH from Aave...`);
    const borrowTx = await pool.borrow(ethToken, ethBorrowAmount, 2, 0, signer.address); // 2 = Tasso variabile
    console.log("Borrow transaction hash:", borrowTx.hash);
    await borrowTx.wait();
    console.log("ETH borrowed successfully!");
  } catch (error) {
    console.error("Error during supply and borrow process:", error);
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exitCode = 1;
});
