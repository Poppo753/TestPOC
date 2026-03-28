/**
 * Authorize ProtocolManager in ProxyGeneral
 */

import { ethers } from "hardhat";

const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

async function main() {
    console.log("\n🔐 Authorizing ProtocolManager in ProxyGeneral...\n");
    
    const proxy = await ethers.getContractAt("ProxyGeneral", PROXY_GENERAL);
    
    const tx = await proxy.authorizeModule(PROTOCOL_MANAGER, "ProtocolManager");
    await tx.wait();
    
    console.log(`✅ ProtocolManager authorized!`);
    console.log(`   Tx: ${tx.hash}\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
