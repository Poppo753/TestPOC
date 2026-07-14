import { ethers } from "hardhat";

/**
 * TEST REAL SWAP VIA PLUGIN DIRECTLY (BYPASS SWAPMANAGER)
 * 
 * Calls plugin.inputSwap() directly to isolate Uniswap Router issue
 */

const PLUGIN = "0x516c226433dD0ceE2f50fA941eFdbf7218b8F05d";
const PROXY = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
    console.log("============================================================");
    console.log("  TEST REAL SWAP VIA PLUGIN DIRECTLY");
    console.log("============================================================\n");

    const [owner] = await ethers.getSigners();
    console.log(`Owner: ${owner.address}\n`);

    const plugin = await ethers.getContractAt("UniswapV3PluginDirect", PLUGIN);
    const weth = await ethers.getContractAt("IERC20", WETH);
    const usdc = await ethers.getContractAt("IERC20", USDC);

    // Check balances BEFORE
    const wethBalanceBefore = await weth.balanceOf(PROXY);
    const usdcBalanceBefore = await usdc.balanceOf(PROXY);
    
    console.log("BEFORE SWAP:");
    console.log(`  WETH: ${ethers.formatEther(wethBalanceBefore)}`);
    console.log(`  USDC: ${ethers.formatUnits(usdcBalanceBefore, 6)}\n`);

    // Swap amount
    const amount = ethers.parseEther("0.0001"); // 0.0001 WETH
    console.log(`Swapping ${ethers.formatEther(amount)} WETH for USDC...`);

    // Static call first
    try {
        const expectedOut = await plugin.inputSwap.staticCall(WETH, USDC, amount);
        console.log(`Expected output: ${ethers.formatUnits(expectedOut, 6)} USDC\n`);
    } catch (error: any) {
        console.log(`❌ Static call failed: ${error.message}`);
        return;
    }

    // Real TX
    console.log("⏳ Sending REAL transaction...");
    
    try {
        const tx = await plugin.inputSwap(WETH, USDC, amount);
        console.log(`TX hash: ${tx.hash}`);
        console.log("⏳ Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log(`✅ Confirmed! Block: ${receipt?.blockNumber}, Gas: ${receipt?.gasUsed.toString()}\n`);
        
        // Check balances AFTER
        const wethBalanceAfter = await weth.balanceOf(PROXY);
        const usdcBalanceAfter = await usdc.balanceOf(PROXY);
        
        console.log("AFTER SWAP:");
        console.log(`  WETH: ${ethers.formatEther(wethBalanceAfter)}`);
        console.log(`  USDC: ${ethers.formatUnits(usdcBalanceAfter, 6)}\n`);
        
        const wethSpent = wethBalanceBefore - wethBalanceAfter;
        const usdcReceived = usdcBalanceAfter - usdcBalanceBefore;
        
        console.log("RESULT:");
        console.log(`  Spent: ${ethers.formatEther(wethSpent)} WETH`);
        console.log(`  Received: ${ethers.formatUnits(usdcReceived, 6)} USDC`);
        console.log(`  Rate: ${ethers.formatUnits(usdcReceived, 6)} USDC per 0.0001 WETH`);
        
    } catch (error: any) {
        console.log(`\n❌ REAL TX FAILED: ${error.message}`);
        
        if (error.data) {
            console.log(`Error data: ${error.data}`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
