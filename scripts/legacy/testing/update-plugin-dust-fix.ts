/**
 * Register new EulerV2Plugin with dust fix
 */

import { ethers } from "hardhat";

const ADDRESSES = {
    BEACON: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
    PROTOCOL_MANAGER: "0x5b8314319CB56864b002caFEB92540B7A7559fBB",
    PROXY_GENERAL: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1",
    NEW_PLUGIN: "0x6450a7D9Df02D4bDb5dC7F21BF39F5a0f53dC374",
    EULER_REGISTRY: "0x52c2D0645f5Bea7fE159d9Db9C27Ba6b50D1bAe3",
    EULER_LENS: "0xfb76C4475149F1843bdF1d327569A12a027Be833"
};

async function main() {
    console.log("\n🔄 Updating EulerV2Plugin (dust fix)...\n");
    
    const [deployer] = await ethers.getSigners();
    
    // 1. Update Beacon implementation
    console.log("1️⃣ Updating Beacon...");
    const beacon = await ethers.getContractAt("Beacon", ADDRESSES.BEACON);
    const tx1 = await beacon.updateImplementation("EulerV2Plugin", ADDRESSES.NEW_PLUGIN);
    await tx1.wait();
    console.log(`   ✅ Beacon updated: ${ADDRESSES.NEW_PLUGIN}\n`);
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Update in ProtocolManager (skip - already registered)
    console.log("2️⃣ ProtocolManager...");
    console.log(`   ℹ️  Euler already registered (using Beacon)\n`);
    
    // 3. Authorize in ProxyGeneral
    console.log("3️⃣ Checking ProxyGeneral...");
    const proxy = await ethers.getContractAt("ProxyGeneral", ADDRESSES.PROXY_GENERAL);
    
    const isAuthorized = await proxy.authorizedModules(ADDRESSES.NEW_PLUGIN);
    if (!isAuthorized) {
        const tx3 = await proxy.authorizeModule(ADDRESSES.NEW_PLUGIN);
        await tx3.wait();
        console.log(`   ✅ Plugin authorized in ProxyGeneral\n`);
    } else {
        console.log(`   ℹ️  Plugin already authorized\n`);
    }
    
    // 4. Check contract size
    const code = await ethers.provider.getCode(ADDRESSES.NEW_PLUGIN);
    const size = (code.length - 2) / 2; // Remove '0x' and divide by 2
    console.log(`📏 Contract Size: ${size} bytes (${size > 24576 ? '❌ TOO LARGE' : '✅ OK'})`);
    
    console.log("\n✅ Plugin update complete!");
    console.log(`\n📝 New plugin: ${ADDRESSES.NEW_PLUGIN}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
