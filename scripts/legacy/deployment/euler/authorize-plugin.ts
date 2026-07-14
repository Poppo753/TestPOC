/**
 * Authorize EulerV2Plugin in ProxyGeneral
 */

import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const EULER_PLUGIN = "0x2356D97B9F81be327F2497B9CDd869736E654dd6";

async function main() {
    console.log("\n🔐 Authorizing EulerV2Plugin in ProxyGeneral...\n");

    const [deployer] = await ethers.getSigners();
    
    const proxyGeneral = await ethers.getContractAt(
        [
            "function authorizeModule(address module, string memory moduleType) external",
            "function isAuthorizedModule(address module) external view returns (bool)"
        ],
        PROXY_GENERAL,
        deployer
    );

    // Check current status
    const isAuth = await proxyGeneral.isAuthorizedModule(EULER_PLUGIN);
    console.log(`Current status: ${isAuth ? "✅ Authorized" : "❌ Not authorized"}`);
    
    if (!isAuth) {
        console.log("\nAuthorizing EulerV2Plugin...");
        const tx = await proxyGeneral.authorizeModule(EULER_PLUGIN, "EulerV2Plugin");
        await tx.wait();
        console.log("✅ Authorized!");
        
        // Verify
        const verified = await proxyGeneral.isAuthorizedModule(EULER_PLUGIN);
        console.log(`Verification: ${verified ? "✅ Success" : "❌ Failed"}`);
    } else {
        console.log("\n✅ Already authorized!");
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
