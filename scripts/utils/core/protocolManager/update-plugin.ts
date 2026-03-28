/**
 * Update EulerV2Plugin address in ProtocolManager and authorize in ProxyGeneral
 */

import { ethers } from "hardhat";

const OLD_PLUGIN = "0xB4261233e6696fF056953fa7EEDA030D96643B28";
const NEW_PLUGIN = "0xaDcbAad4b427FacCc19d9Da91360327577B8fa8B";
const PROTOCOL_MANAGER = "0x88Bd0A1eF96764B328aC6EBa99A7715a9ba28DF9";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const EULER_REGISTRY = "0x52c2D0645f5Bea7fE159d9Db9C27Ba6b50D1bAe3";
const EULER_LENS = "0xfb76C4475149F1843bdF1d327569A12a027Be833";

async function main() {
    const [signer] = await ethers.getSigners();
    
    console.log(`\n🔄 Updating EulerV2Plugin...`);
    console.log(`   Old: ${OLD_PLUGIN}`);
    console.log(`   New: ${NEW_PLUGIN}\n`);
    
    // 1. Update ProtocolManager
    console.log(`📝 Updating ProtocolManager...`);
    const pm = await ethers.getContractAt("ProtocolManager", PROTOCOL_MANAGER, signer);
    
    const tx1 = await pm.updateProtocol(
        "Euler",
        NEW_PLUGIN,
        ethers.ZeroAddress, // Keep same lens
        ethers.ZeroAddress  // Keep same registry
    );
    await tx1.wait();
    console.log(`   ✅ Updated in ProtocolManager`);
    console.log(`   Tx: ${tx1.hash}\n`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 2. Authorize new plugin
    console.log(`🔓 Authorizing new plugin...`);
    const proxy = await ethers.getContractAt(
        ["function authorizeModule(address,string)"],
        PROXY_GENERAL,
        signer
    );
    
    const tx2 = await proxy.authorizeModule(NEW_PLUGIN, "EulerV2Plugin");
    await tx2.wait();
    console.log(`   ✅ New plugin authorized`);
    console.log(`   Tx: ${tx2.hash}\n`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log(`\n✅ Plugin update complete!`);
    console.log(`   Now run: npx hardhat run scripts/testing/test-withdraw.ts --network arbitrum`);
}

main().catch(e => { console.error(e); process.exit(1); });
