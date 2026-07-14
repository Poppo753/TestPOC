/**
 * Check WETH balance in ProxyGeneral
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";
const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  CHECK WETH BALANCE IN POOL");
    console.log("=".repeat(60) + "\n");

    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    const proxyGeneralAddress = await beacon.getImplementation("ProxyGeneral");
    
    console.log(`ProxyGeneral: ${proxyGeneralAddress}\n`);

    const wethAbi = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ];
    
    const weth = await ethers.getContractAt(wethAbi, WETH_ADDRESS);
    
    const balance = await weth.balanceOf(proxyGeneralAddress);
    const decimals = await weth.decimals();
    
    console.log(`WETH Balance: ${ethers.formatUnits(balance, decimals)} WETH`);
    console.log(`Raw: ${balance.toString()}\n`);
    
    if (balance === 0n) {
        console.log(`❌ No WETH in pool!\n`);
        console.log(`The pool has 0 WETH to swap.`);
        console.log(`You need to deposit ETH or wrap some ETH to WETH first.\n`);
    } else {
        console.log(`✅ WETH available for swapping! 🎉\n`);
    }
    
    // Check ETH balance too
    const ethBalance = await ethers.provider.getBalance(proxyGeneralAddress);
    console.log(`Native ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
    console.log(`Raw: ${ethBalance.toString()}\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Error:", error.message);
        process.exit(1);
    });
