const { ethers } = require("hardhat");
async function main() {
  const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
  const usdc = await ethers.getContractAt("IERC20", USDC);
  const balance = await usdc.balanceOf(WHALE);
  console.log("Whale USDC balance:", ethers.formatUnits(balance, 6));
  for (let slot = 0; slot <= 15; slot++) {
    const key = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address","uint256"],[WHALE, slot]));
    const val = await ethers.provider.getStorage(USDC, key);
    if (val !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("Slot " + slot + ": " + val + " (" + BigInt(val) + ")");
    }
  }
}
main();
