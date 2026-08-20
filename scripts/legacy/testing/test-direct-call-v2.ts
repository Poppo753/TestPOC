/**
 * Call plugin directly as deployer (bypassing PM)
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet } from "../utils/plugins/euler/euler-helpers";

const NEW_PLUGIN = "0x490139F3b29786D64056a236a0062CA23A7313f6";
const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";

async function main() {
    console.log("\n🧪 Direct plugin call test (as deployer)\n");
    
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
    
    // Check plugin balance
    const balance = await weth.balanceOf(NEW_PLUGIN);
    console.log(`   Plugin WETH: ${formatAmount(balance)}\n`);
    
    // Try deposit AS PROTOCOL MANAGER (via impersonation simulation)
    console.log("2. Calling deposit() via ProtocolManager...");
    
    // Get PM contract
    const pm = await ethers.getContractAt("ProtocolManager", PROTOCOL_MANAGER);
    
    try {
        tx = await pm.deposit("Euler", "WETH", amount);
        await tx.wait();
        console.log(`   ✅ Deposit successful!\n`);
    } catch (e: any) {
        console.log(`   ❌ Failed: ${e.message.substring(0, 100)}\n`);
        
        // Try calling plugin directly as deployer (owner of PM)
        console.log("3. Trying direct call to plugin as deployer...");
        try {
            tx = await plugin.deposit("WETH", amount);
            await tx.wait();
            console.log(`   ✅ Direct call worked!\n`);
        } catch (e2: any) {
            console.log(`   ❌ Also failed: ${e2.message.substring(0, 100)}\n`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
