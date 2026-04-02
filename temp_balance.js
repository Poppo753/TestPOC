const { ethers } = require("hardhat");
async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(bal), "ETH");
  const gasPrice = (await ethers.provider.getFeeData()).gasPrice;
  console.log("Gas price:", gasPrice ? ethers.formatUnits(gasPrice, "gwei") + " gwei" : "unknown");
  if (gasPrice) {
    const estimated = gasPrice * 8000000n;
    console.log("Estimated cost:", ethers.formatEther(estimated), "ETH");
    console.log("Sufficient:", bal >= estimated ? "YES" : "NO - need more ETH");
  }
}
main();
