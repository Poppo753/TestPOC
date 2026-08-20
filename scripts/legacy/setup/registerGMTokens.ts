import { ethers } from "hardhat";

/**
 * Register GM tokens in TokenManager
 * Run this AFTER oracles are configured
 */

async function main() {
    console.log("\n🪙 Registering GM Tokens in TokenManager\n");
    
    const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
    const GM_BTC = "0x7C11F78Ce78768518D743E81Fdfa2F860C6b9A77";
    const GM_ETH = "0x450bb6774Dd8a756274E0ab4107953259d2ac541";
    
    const tokenManager = await ethers.getContractAt("TokenManager", TOKEN_MANAGER);
    
    console.log("   Registering GM-BTC...");
    const tx1 = await tokenManager.manageTokenData(
        "GM-BTC",
        GM_BTC,
        18,
        3600
    );
    await tx1.wait();
    console.log("   ✅ GM-BTC registered");
    
    console.log("   Registering GM-ETH...");
    const tx2 = await tokenManager.manageTokenData(
        "GM-ETH",
        GM_ETH,
        18,
        3600
    );
    await tx2.wait();
    console.log("   ✅ GM-ETH registered\n");
    
    // Verify
    const gmBtcInfo = await tokenManager.getTokenInfo("GM-BTC");
    const gmEthInfo = await tokenManager.getTokenInfo("GM-ETH");
    console.log("✅ GM-BTC:", gmBtcInfo.tokenAddress, "Active:", gmBtcInfo.isActive);
    console.log("✅ GM-ETH:", gmEthInfo.tokenAddress, "Active:", gmEthInfo.isActive);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
