/**
 * Withdraw from OLD plugin (that has the shares)
 */

import { ethers } from "hardhat";

const OLD_PLUGIN = "0x2356D97B9F81be327F2497B9CDd869736E654dd6";
const PROTOCOL_MANAGER = "0x88Bd0A1eF96764B328aC6EBa99A7715a9ba28DF9";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
    const [signer] = await ethers.getSigners();
    
    console.log(`\n💸 Withdrawing from OLD plugin...`);
    console.log(`   Plugin: ${OLD_PLUGIN}\n`);
    
    // Update ProtocolManager to use old plugin
    console.log(`📝 Updating ProtocolManager to old plugin...`);
    const pm = await ethers.getContractAt("ProtocolManager", PROTOCOL_MANAGER, signer);
    
    const tx2 = await pm.updateProtocol(
        "Euler",
        OLD_PLUGIN,
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );
    await tx2.wait();
    console.log(`   ✅ ProtocolManager updated\n`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Withdraw via ProtocolManager.withdraw()
    console.log(`💰 Withdrawing WETH via ProtocolManager...`);
    
    const tx3 = await pm.withdraw("Euler", "WETH", 0);
    const receipt = await tx3.wait();
    
    console.log(`   ✅ Withdrawal complete!`);
    console.log(`   Tx: ${receipt?.hash}`);
    console.log(`   Gas: ${receipt?.gasUsed.toString()}\n`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Check balance
    const weth = new ethers.Contract(
        WETH,
        ["function balanceOf(address) view returns (uint256)"],
        signer
    );
    
    const balance = await weth.balanceOf(PROXY_GENERAL);
    console.log(`✅ ProxyGeneral WETH: ${ethers.formatEther(balance)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
