import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log(`\n👤 Address: ${signer.address}`);
  
  const balanceWei = await ethers.provider.getBalance(signer.address);
  console.log(`💰 ETH Balance: ${ethers.formatEther(balanceWei)} ETH\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
