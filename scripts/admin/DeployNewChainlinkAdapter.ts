import { ethers } from "hardhat";

async function main() {
    console.log("🚀 DEPLOYING NEW CHAINLINK ADAPTER WITH DENOMINATION SYSTEM\n");

    // Deploy new ChainlinkAdapter
    console.log("📦 Deploying ChainlinkAdapter...");
    const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
    const adapter = await ChainlinkAdapter.deploy();
    await adapter.waitForDeployment();
    
    const adapterAddress = await adapter.getAddress();
    console.log(`   ✅ Deployed at: ${adapterAddress}\n`);

    // Chainlink feed addresses on Arbitrum Mainnet
    const FEEDS = {
        ETH_USD: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // ETH/USD 8 decimals
        USDC_USD: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", // USDC/USD 8 decimals
        WBTC_USD: "0x6ce185860a4963106506C203335A2910413708e9", // BTC/USD 8 decimals (for WBTC)
        USDT_USD: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7"  // USDT/USD 8 decimals
    };

    // Step 1: Set target denomination to ETH
    console.log("1️⃣ Setting target denomination to ETH...");
    let tx = await adapter.setTargetDenomination("ETH");
    await tx.wait();
    console.log("   ✅ Target denomination: ETH\n");

    // Step 2: Configure reference feed (ETH/USD) for USD conversions
    console.log("2️⃣ Configuring reference feed (ETH/USD)...");
    tx = await adapter.setReferenceFeed(
        "USD",              // Denomination
        FEEDS.ETH_USD,      // ETH/USD feed address
        8,                  // Decimals
        86400               // Heartbeat: 24 hours (stablecoins update slowly)
    );
    await tx.wait();
    console.log(`   ✅ Reference feed USD → ${FEEDS.ETH_USD}\n`);

    // Step 3: Configure token price feeds with denominations
    console.log("3️⃣ Configuring token price feeds:\n");

    // USDC (USD denomination)
    console.log("   📊 USDC/USD...");
    tx = await adapter.setPriceFeed(
        "USDC",
        FEEDS.USDC_USD,
        8,
        86400,  // 24h heartbeat for stablecoins
        "USD"   // Denomination
    );
    await tx.wait();
    console.log("      ✅ USDC configured (USD denomination)\n");

    // WBTC (USD denomination)
    console.log("   📊 WBTC/USD...");
    tx = await adapter.setPriceFeed(
        "WBTC",
        FEEDS.WBTC_USD,
        8,
        3600,   // 1h heartbeat for volatile assets
        "USD"   // Denomination
    );
    await tx.wait();
    console.log("      ✅ WBTC configured (USD denomination)\n");

    // USDT (USD denomination)
    console.log("   📊 USDT/USD...");
    tx = await adapter.setPriceFeed(
        "USDT",
        FEEDS.USDT_USD,
        8,
        86400,  // 24h heartbeat for stablecoins
        "USD"   // Denomination
    );
    await tx.wait();
    console.log("      ✅ USDT configured (USD denomination)\n");

    // Step 4: Test price conversions
    console.log("4️⃣ Testing price conversions:\n");

    try {
        const [usdcPrice, usdcTimestamp, usdcValid] = await adapter.getPrice("USDC");
        console.log(`   USDC:`);
        console.log(`      Price: ${ethers.formatEther(usdcPrice)} ETH per USDC`);
        console.log(`      Timestamp: ${new Date(Number(usdcTimestamp) * 1000).toISOString()}`);
        console.log(`      Valid: ${usdcValid ? "✅" : "❌"}\n`);
    } catch (error: any) {
        console.log(`   ❌ USDC test failed: ${error.message}\n`);
    }

    try {
        const [wbtcPrice, wbtcTimestamp, wbtcValid] = await adapter.getPrice("WBTC");
        console.log(`   WBTC:`);
        console.log(`      Price: ${ethers.formatEther(wbtcPrice)} ETH per WBTC`);
        console.log(`      Timestamp: ${new Date(Number(wbtcTimestamp) * 1000).toISOString()}`);
        console.log(`      Valid: ${wbtcValid ? "✅" : "❌"}\n`);
    } catch (error: any) {
        console.log(`   ❌ WBTC test failed: ${error.message}\n`);
    }

    try {
        const [usdtPrice, usdtTimestamp, usdtValid] = await adapter.getPrice("USDT");
        console.log(`   USDT:`);
        console.log(`      Price: ${ethers.formatEther(usdtPrice)} ETH per USDT`);
        console.log(`      Timestamp: ${new Date(Number(usdtTimestamp) * 1000).toISOString()}`);
        console.log(`      Valid: ${usdtValid ? "✅" : "❌"}\n`);
    } catch (error: any) {
        console.log(`   ❌ USDT test failed: ${error.message}\n`);
    }

    // Step 5: Transfer ownership to deployer (optional)
    const currentOwner = await adapter.owner();
    console.log(`5️⃣ Current owner: ${currentOwner}`);
    if (currentOwner !== deployer.address) {
        console.log("   Transferring ownership...");
        tx = await adapter.transferOwnership(deployer.address);
        await tx.wait();
        console.log(`   ✅ Ownership transferred to ${deployer.address}\n`);
    } else {
        console.log("   ✅ Already owned by deployer\n");
    }

    console.log("=" .repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE!\n");
    console.log("📋 DEPLOYMENT SUMMARY:");
    console.log(`   ChainlinkAdapter: ${adapterAddress}`);
    console.log(`   Target Denomination: ETH`);
    console.log(`   Reference Feed (USD): ${FEEDS.ETH_USD}`);
    console.log(`   Configured Tokens: USDC, WBTC, USDT (all USD denomination)`);
    console.log("\n🔧 NEXT STEPS:");
    console.log("   1. Update TokenManager to use new ChainlinkAdapter:");
    console.log(`      tokenManager.setOracleAdapter("${adapterAddress}")`);
    console.log("   2. Test with ValueCalculator.getTotalPoolValue()");
    console.log("   3. Verify USDC/WBTC/USDT values are now correct in ETH");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
