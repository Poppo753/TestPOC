import { ethers } from "hardhat";

/**
 * FIX APPROVAL - ProxyGeneral deve approvare SwapManager
 */

const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const SWAP_MANAGER = "0x01269d496E957A54e02cdcd5888957baf317A947";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
    console.log("Checking and fixing approval...\n");

    const [owner] = await ethers.getSigners();
    console.log(`Owner: ${owner.address}\n`);

    const weth = await ethers.getContractAt("IERC20", WETH);
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", PROXY_GENERAL);

    // Check current allowance
    const allowance = await weth.allowance(PROXY_GENERAL, SWAP_MANAGER);
    console.log(`Current allowance: ${ethers.formatEther(allowance)} WETH`);

    if (allowance === 0n) {
        console.log("\n❌ No allowance! Setting approval...");
        
        const tx = await proxyGeneral.approveSpender(
            WETH,
            SWAP_MANAGER,
            ethers.MaxUint256
        );
        
        console.log(`TX: ${tx.hash}`);
        await tx.wait();
        
        console.log("✅ Approval set!");
    } else {
        console.log("✅ Allowance already set");
    }
}

main().then(() => process.exit(0)).catch(console.error);
