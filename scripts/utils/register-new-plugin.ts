import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const NEW_PLUGIN = "0x846471faAA2F877EdF235838120C34995a3E279E";
const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
const EULER_LENS = "0xfb76C4475149F1843bdF1d327569A12a027Be833";
const EULER_REGISTRY = "0x52c2D0645f5Bea7fE159d9Db9C27Ba6b50D1bAe3";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

async function main() {
    const [signer] = await ethers.getSigners();
    
    console.log(`\n🔄 Configuring new plugin...`);
    console.log(`   Plugin: ${NEW_PLUGIN}\n`);
    
    // Plugin already registered in Beacon, skip to ProtocolManager
    
    // 1. Register in ProtocolManager
    console.log(`📝 Registering Euler in ProtocolManager...`);
    const pm = await ethers.getContractAt("ProtocolManager", PROTOCOL_MANAGER, signer);
    const tx1 = await pm.registerProtocol("Euler", NEW_PLUGIN, EULER_LENS, EULER_REGISTRY);
    await tx1.wait();
    console.log(`   ✅ Euler registered\n`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 2. Authorize in ProxyGeneral
    console.log(`🔓 Authorizing in ProxyGeneral...`);
    const proxy = await ethers.getContractAt(
        ["function authorizeModule(address,string)"],
        PROXY_GENERAL,
        signer
    );
    const tx2 = await proxy.authorizeModule(NEW_PLUGIN, "EulerV2Plugin");
    await tx2.wait();
    console.log(`   ✅ Authorized in ProxyGeneral\n`);
    
    console.log(`✅ Setup complete!`);
    console.log(`\nPlugin: ${NEW_PLUGIN}`);
    console.log(`Size: 24,251 bytes (325 bytes under limit)`);
}

main().catch(e => { console.error(e); process.exit(1); });
