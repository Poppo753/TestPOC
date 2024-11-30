const poolAbi = [
    "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external",
  ];

  import { ethers } from "hardhat";

  async function main() {
    const poolAddress = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"; // Indirizzo del contratto POOL
    const ethToken = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // Indirizzo WETH
    const ethBorrowAmount = ethers.parseUnits("0.0000001", 18); // 0.05 ETH (18 decimali)
  
    const [signer] = await ethers.getSigners();
  
    // Instanzia il contratto POOL
    const pool = new ethers.Contract(poolAddress, poolAbi, signer);
  
    console.log(`Borrowing ${ethBorrowAmount.toString()} ETH from Aave...`);
  
    // Esegui il borrow
    const tx = await pool.borrow(ethToken, ethBorrowAmount, 2, 0, signer.address); // 2 = Tasso variabile
    console.log("Transaction hash:", tx.hash);
  
    await tx.wait();
    console.log("Borrow successful!");
  }
  
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  