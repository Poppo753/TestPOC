import { ethers } from "hardhat";

/**
 * CHECK PROXYGENERAL APPROVALS FOR PLUGIN
 * 
 * Verifies if ProxyGeneral has approved UniswapV3PluginDirect
 * to spend WETH (and other tokens)
 */

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
    console.log("============================================================");
    console.log("  CHECK PROXYGENERAL APPROVALS");
    console.log("============================================================\n");

    const beacon = await ethers.getContractAt("Beacon", BEACON);
    
    const proxyGeneralAddress = await beacon.getImplementation("ProxyGeneral");
    const pluginAddress = await beacon.getImplementation("UniswapV3Plugin");
    
    console.log(`ProxyGeneral: ${proxyGeneralAddress}`);
    console.log(`UniswapV3Plugin: ${pluginAddress}\n`);

    // Check WETH approval
    const wethContract = await ethers.getContractAt(
        ["function allowance(address,address) view returns (uint256)"],
        WETH
    );
    
    const wethAllowance = await wethContract.allowance(proxyGeneralAddress, pluginAddress);
    console.log(`WETH allowance: ${ethers.formatEther(wethAllowance)} WETH`);
    
    if (wethAllowance === 0n) {
        console.log("❌ NO APPROVAL! Plugin cannot spend WETH from ProxyGeneral");
        console.log("\nSolution:");
        console.log("SwapManager must call ProxyGeneral.approveSpender() before plugin.inputSwap()");
    } else {
        console.log("✅ Plugin approved to spend WETH");
    }

    // Check USDC approval (for return path)
    const usdcContract = await ethers.getContractAt(
        ["function allowance(address,address) view returns (uint256)", "function decimals() view returns (uint8)"],
        USDC
    );
    
    const usdcDecimals = await usdcContract.decimals();
    const usdcAllowance = await usdcContract.allowance(proxyGeneralAddress, pluginAddress);
    console.log(`\nUSDC allowance: ${ethers.formatUnits(usdcAllowance, usdcDecimals)} USDC`);
    
    if (usdcAllowance === 0n) {
        console.log("⚠️  NO APPROVAL for USDC (OK if only swapping WETH→USDC)");
    } else {
        console.log("✅ Plugin approved to spend USDC");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
