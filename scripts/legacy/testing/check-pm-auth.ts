/**
 * Check if ProtocolManager is authorized in ProxyGeneral
 */

import { ethers } from "hardhat";

const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

async function main() {
    console.log("\n🔍 Checking ProtocolManager authorization...\n");
    
    const proxy = await ethers.getContractAt("ProxyGeneral", PROXY_GENERAL);
    
    const isAuthorized = await proxy.authorizedModules(PROTOCOL_MANAGER);
    
    console.log(`ProtocolManager: ${PROTOCOL_MANAGER}`);
    console.log(`Authorized in ProxyGeneral: ${isAuthorized ? '✅ YES' : '❌ NO'}\n`);
    
    if (!isAuthorized) {
        console.log(`⚠️  ProtocolManager is NOT authorized!`);
        console.log(`   Need to call: proxy.authorizeModule(PM, "ProtocolManager")\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
