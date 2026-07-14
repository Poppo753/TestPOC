/**
 * Authorize new plugin in ProxyGeneral
 */

import { ethers } from "hardhat";

const NEW_PLUGIN = "0x6450a7D9Df02D4bDb5dC7F21BF39F5a0f53dC374";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

async function main() {
    console.log(`\n🔐 Authorizing plugin in ProxyGeneral...`);
    console.log(`   Plugin: ${NEW_PLUGIN}\n`);
    
    const proxy = await ethers.getContractAt("ProxyGeneral", PROXY_GENERAL);
    
    const isAuthorized = await proxy.authorizedModules(NEW_PLUGIN);
    
    if (isAuthorized) {
        console.log(`✅ Already authorized!`);
    } else {
        const tx = await proxy.authorizeModule(NEW_PLUGIN, "EulerV2Plugin");
        await tx.wait();
        console.log(`✅ Authorized! Tx: ${tx.hash}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
