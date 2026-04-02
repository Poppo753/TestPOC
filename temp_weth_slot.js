const { ethers } = require("hardhat");
async function main() {
  const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const weth = await ethers.getContractAt("IERC20", WETH);
  const balance = await weth.balanceOf(ADDR);
  console.log("Owner WETH balance:", ethers.formatEther(balance));
  // WETH9 balanceOf mapping is at slot 3
  for (let slot = 0; slot <= 5; slot++) {
    const key = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address","uint256"],[ADDR, slot]));
    const val = await ethers.provider.getStorage(WETH, key);
    if (val !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("Slot " + slot + ": " + val + " (" + BigInt(val) + ")");
    }
  }
  // Also check whale balance to find correct slot
  const WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
  const whaleBalance = await weth.balanceOf(WHALE);
  console.log("Whale WETH balance:", ethers.formatEther(whaleBalance));
  for (let slot = 0; slot <= 5; slot++) {
    const key = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address","uint256"],[WHALE, slot]));
    const val = await ethers.provider.getStorage(WETH, key);
    if (val !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("Whale Slot " + slot + ": " + val + " (" + BigInt(val) + ")");
    }
  }
}
main();
