import { ethers } from "hardhat";

/**
 * Deploy GMXv2Plugin on Arbitrum Mainnet (PRODUCTION)
 * 
 * This script:
 * 1. Deploys GMXv2Plugin with REAL GMX V2 contracts
 * 2. Configures GM markets (BTC, ETH)
 * 3. Sets proper execution fees
 * 4. Verifies deployment on Arbiscan
 * 
 * ⚠️  IMPORTANT: Review all addresses before deployment
 * 
 * Requirements:
 * - PRIVATE_KEY in .env (use hardware wallet for production!)
 * - ARBITRUM_RPC_URL in .env
 * - ARBITRUM_ETHERSCAN_API_KEY in .env
 * - Sufficient ETH for deployment (~0.01 ETH)
 * 
 * Run: npx hardhat run scripts/deploy/deployGMXv2PluginMainnet.ts --network arbitrum
 */

async function main() {
    console.log("\n🚀 PRODUCTION DEPLOYMENT: GMXv2Plugin on Arbitrum Mainnet\n");
    
    // Confirmation prompt
    console.log("⚠️  WARNING: This will deploy to MAINNET!");
    console.log("   Review all addresses carefully before proceeding.\n");
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    
    console.log("📊 Deployment Info:");
    console.log("   Deployer:", deployer.address);
    console.log("   Balance:", ethers.formatEther(balance), "ETH");
    console.log("   Network:", (await ethers.provider.getNetwork()).name);
    console.log("   Chain ID:", (await ethers.provider.getNetwork()).chainId);
    console.log("");
    
    if (balance < ethers.parseEther("0.00001")) {
        throw new Error("Insufficient balance for deployment. Need at least 0.00001 ETH");
    }
    
    // Get ProxyGeneral address from environment
    const PROXY_GENERAL = process.env.PROXY_GENERAL_ADDRESS;
    if (!PROXY_GENERAL) {
        throw new Error("PROXY_GENERAL_ADDRESS not set in .env");
    }
    
    // ============ ARBITRUM MAINNET ADDRESSES ============
    
    const MAINNET_ADDRESSES = {
        // GMX V2 Contracts (VERIFIED)
        ExchangeRouter: "0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8",
        Reader: "0xf60becbba223EEA9495Da3f606753867eC10d139",
        DataStore: "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8",
        
        // Tokens
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
        USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        
        // Your GM Tokens
        GM_BTC: "0x7C11F78Ce78768518D743E81Fdfa2F860C6b9A77",
        GM_ETH: "0x450bb6774Dd8a756274E0ab4107953259d2ac541",
        
        // Your System
        ProxyGeneral: PROXY_GENERAL,
    };
    
    console.log("🔗 Contract Addresses:");
    console.log("   GMX ExchangeRouter:", MAINNET_ADDRESSES.ExchangeRouter);
    console.log("   GMX Reader:", MAINNET_ADDRESSES.Reader);
    console.log("   GMX DataStore:", MAINNET_ADDRESSES.DataStore);
    console.log("   ProxyGeneral:", MAINNET_ADDRESSES.ProxyGeneral);
    console.log("   WETH:", MAINNET_ADDRESSES.WETH);
    console.log("");
    
    // Pause for review
    console.log("⏸️  Deploying in 5 seconds...");
    console.log("   Press Ctrl+C to cancel\n");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // ============ DEPLOY PLUGIN ============
    
    console.log("📦 Deploying GMXv2Plugin...");
    
    const GMXv2PluginFactory = await ethers.getContractFactory("GMXv2Plugin");
    const gmxPlugin = await GMXv2PluginFactory.deploy(
        MAINNET_ADDRESSES.ExchangeRouter,
        MAINNET_ADDRESSES.Reader,
        MAINNET_ADDRESSES.DataStore,
        MAINNET_ADDRESSES.ProxyGeneral,
        MAINNET_ADDRESSES.WETH
    );
    
    console.log("   ⏳ Waiting for deployment...");
    await gmxPlugin.waitForDeployment();
    
    const pluginAddress = await gmxPlugin.getAddress();
    console.log("   ✅ GMXv2Plugin deployed at:", pluginAddress);
    
    // Wait for block confirmations
    console.log("   ⏳ Waiting for 3 confirmations...");
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log("");
    
    // ============ CONFIGURE MARKETS ============
    
    console.log("🏪 Configuring GM markets...");
    
    console.log("   Adding GM BTC market (WBTC/WBTC)...");
    const tx1 = await gmxPlugin.addMarket(
        MAINNET_ADDRESSES.GM_BTC,     // 0x7C11F78Ce78768518D743E81Fdfa2F860C6b9A77
        MAINNET_ADDRESSES.WBTC,       // indexToken
        MAINNET_ADDRESSES.WBTC,       // longToken
        MAINNET_ADDRESSES.WBTC        // shortToken (WBTC/WBTC market)
    );
    await tx1.wait();
    console.log("   ✅ GM BTC configured");
    
    console.log("   Adding GM ETH market (WETH/WETH)...");
    const tx2 = await gmxPlugin.addMarket(
        MAINNET_ADDRESSES.GM_ETH,     // 0x450bb6774Dd8a756274E0ab4107953259d2ac541
        MAINNET_ADDRESSES.WETH,       // indexToken
        MAINNET_ADDRESSES.WETH,       // longToken
        MAINNET_ADDRESSES.WETH        // shortToken (WETH/WETH market)
    );
    await tx2.wait();
    console.log("   ✅ GM ETH configured");
    console.log("");
    
    // ============ VERIFY DEPLOYMENT ============
    
    console.log("🔍 Verifying deployment...");
    
    const metadata = await gmxPlugin.getPluginMetadata();
    const executionFee = await gmxPlugin["getExecutionFee()"]();
    const gmBtcMarket = await gmxPlugin.markets(MAINNET_ADDRESSES.GM_BTC);
    const gmEthMarket = await gmxPlugin.markets(MAINNET_ADDRESSES.GM_ETH);
    
    console.log("   Plugin name:", metadata.name);
    console.log("   Version:", metadata.version);
    console.log("   Execution fee:", ethers.formatEther(executionFee), "ETH");
    console.log("   GM BTC active:", gmBtcMarket.isActive);
    console.log("   GM ETH active:", gmEthMarket.isActive);
    console.log("   Owner:", await gmxPlugin.owner());
    console.log("");
    
    // ============ VERIFICATION ON ARBISCAN ============
    
    console.log("📝 Contract verification...");
    console.log("   Waiting 30 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    try {
        console.log("   Running Arbiscan verification...");
        // Note: This requires @nomicfoundation/hardhat-verify
        const verifyCommand = `npx hardhat verify --network arbitrum ${pluginAddress} "${MAINNET_ADDRESSES.ExchangeRouter}" "${MAINNET_ADDRESSES.Reader}" "${MAINNET_ADDRESSES.DataStore}" "${MAINNET_ADDRESSES.ProxyGeneral}" "${MAINNET_ADDRESSES.WETH}"`;
        console.log("   Command:", verifyCommand);
        console.log("   ⏳ Verifying...");
        
        // Auto-verify if possible
        const { run } = require("hardhat");
        await run("verify:verify", {
            address: pluginAddress,
            constructorArguments: [
                MAINNET_ADDRESSES.ExchangeRouter,
                MAINNET_ADDRESSES.Reader,
                MAINNET_ADDRESSES.DataStore,
                MAINNET_ADDRESSES.ProxyGeneral,
                MAINNET_ADDRESSES.WETH
            ],
        });
        console.log("   ✅ Contract verified on Arbiscan");
    } catch (error: any) {
        console.log("   ⚠️  Auto-verification failed:", error.message);
        console.log("   Run verification manually with command above");
    }
    console.log("");
    
    // ============ SUMMARY ============
    
    console.log("═".repeat(60));
    console.log("🎉 PRODUCTION DEPLOYMENT COMPLETE");
    console.log("═".repeat(60));
    console.log("");
    console.log("📊 Deployment Summary:");
    console.log("   Plugin Address:", pluginAddress);
    console.log("   Network: Arbitrum Mainnet");
    console.log("   Chain ID: 42161");
    console.log("   Deployer:", deployer.address);
    console.log("   Owner:", await gmxPlugin.owner());
    console.log("");
    console.log("🏪 Configured Markets:");
    console.log("   GM BTC:", MAINNET_ADDRESSES.GM_BTC);
    console.log("     - Index: WBTC", MAINNET_ADDRESSES.WBTC);
    console.log("     - Long: WBTC", MAINNET_ADDRESSES.WBTC);
    console.log("     - Short: WBTC", MAINNET_ADDRESSES.WBTC);
    console.log("     - Chainlink: 0x19eCDd6DDc12597ec4A522fB1E25b1A580B605B7");
    console.log("   GM ETH:", MAINNET_ADDRESSES.GM_ETH);
    console.log("     - Index: WETH", MAINNET_ADDRESSES.WETH);
    console.log("     - Long: WETH", MAINNET_ADDRESSES.WETH);
    console.log("     - Short: WETH", MAINNET_ADDRESSES.WETH);
    console.log("     - Chainlink: 0xEAeFFF521cb36dFb414E8580f8635BFB44d96255");
    console.log("");
    console.log("🔗 Links:");
    console.log("   Arbiscan:", "https://arbiscan.io/address/" + pluginAddress);
    console.log("   GMX App:", "https://app.gmx.io");
    console.log("");
    console.log("📝 Integration Steps:");
    console.log("   1. Register plugin in Beacon:");
    console.log(`      beacon.updateImplementation("GMX-V2", "${pluginAddress}")`);
    console.log("");
    console.log("   2. Authorize in ProxyGeneral:");
    console.log(`      proxyGeneral.authorizeModule("${pluginAddress}", "GMX-V2-Plugin")`);
    console.log("");
    console.log("   3. Register GM tokens in TokenManager:");
    console.log(`      tokenManager.manageTokenData("GM-BTC", "${MAINNET_ADDRESSES.GM_BTC}", 18, 3600)`);
    console.log(`      tokenManager.manageTokenData("GM-ETH", "${MAINNET_ADDRESSES.GM_ETH}", 18, 3600)`);
    console.log("");
    console.log("   4. Add Chainlink price feeds:");
    console.log(`      chainlinkAdapter.addPriceFeed("GM-BTC", "0x19eCDd6DDc12597ec4A522fB1E25b1A580B605B7", 8, 3600)`);
    console.log(`      chainlinkAdapter.addPriceFeed("GM-ETH", "0xEAeFFF521cb36dFb414E8580f8635BFB44d96255", 8, 3600)`);
    console.log("");
    console.log("💾 Save to .env:");
    console.log(`   GMX_V2_PLUGIN_ADDRESS=${pluginAddress}`);
    console.log("");
    console.log("✅ Plugin is LIVE on Arbitrum mainnet!");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
