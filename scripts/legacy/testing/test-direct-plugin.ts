/**
 * Direct plugin test (bypass ProtocolManager)
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet } from "../utils/plugins/euler/euler-helpers";

const NEW_PLUGIN = "0x6450a7D9Df02D4bDb5dC7F21BF39F5a0f53dC374";

async function main() {
    console.log("\n🧪 Direct plugin test...\n");
    
    await verifyArbitrumMainnet();
    const [deployer] = await ethers.getSigners();
    
    const plugin = await ethers.getContractAt("EulerV2Plugin", NEW_PLUGIN);
    const weth = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.WETH);
    
    // Transfer WETH to plugin
    console.log("1. Transferring 0.0001 WETH to plugin...");
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", ARBITRUM_ADDRESSES.PROXY_GENERAL);
    
    const amount = ethers.parseEther("0.0001");
    let tx = await proxyGeneral.transferToModule(ARBITRUM_ADDRESSES.WETH, NEW_PLUGIN, amount);
    await tx.wait();
    console.log(`   ✅ Transferred\n`);
    
    // Check owner
    const owner = await plugin.owner();
    console.log(`Plugin owner: ${owner}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Match: ${owner.toLowerCase() === deployer.address.toLowerCase()}\n`);
    
    // Try deposit AS OWNER (deployer is still owner)
    console.log("2. Calling deposit() directly as owner...");
    try {
        tx = await plugin.deposit("WETH", amount);
        await tx.wait();
        console.log(`   ✅ Deposit successful!\n`);
    } catch (e: any) {
        console.log(`   ❌ Failed: ${e.message}\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
