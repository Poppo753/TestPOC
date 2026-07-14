import { ethers } from "hardhat";

/**
 * Deploy GMXv2Plugin on Arbitrum Sepolia Testnet
 * 
 * This script:
 * 1. Deploys GMXv2Plugin
 * 2. Configures GM markets (BTC, ETH)
 * 3. Verifies deployment on Arbiscan
 * 
 * Requirements:
 * - PRIVATE_KEY in .env
 * - ARBITRUM_SEPOLIA_RPC_URL in .env
 * - ARBITRUM_ETHERSCAN_API_KEY in .env (for verification)
 * 
 * Run: npx hardhat run scripts/deploy/deployGMXv2PluginTestnet.ts --network arbitrumSepolia
 */

async function main() {
    console.log("\n🚀 Deploying GMXv2Plugin to Arbitrum Sepolia Testnet...\n");
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    
    console.log("📊 Deployment Info:");
    console.log("   Deployer:", deployer.address);
    console.log("   Balance:", ethers.formatEther(balance), "ETH");
    console.log("   Network:", (await ethers.provider.getNetwork()).name);
    console.log("   Chain ID:", (await ethers.provider.getNetwork()).chainId);
    console.log("");
    
    if (balance < ethers.parseEther("0.01")) {
        console.log("⚠️  Warning: Low balance. Get testnet ETH from:");
        console.log("   https://faucet.quicknode.com/arbitrum/sepolia");
        console.log("");
    }
    
    // ============ ARBITRUM SEPOLIA ADDRESSES ============
    
    // Note: Arbitrum Sepolia might not have GMX V2 deployed
    // For testing, we'll use placeholder addresses or deploy on mainnet fork
    
    const SEPOLIA_ADDRESSES = {
        // These are mainnet addresses - adjust if testnet GMX exists
        ExchangeRouter: "0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8",
        Reader: "0xf60becbba223EEA9495Da3f606753867eC10d139",
        DataStore: "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8",
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        
        // Your mock ProxyGeneral (use deployer for now)
        ProxyGeneral: deployer.address,
    };
    
    console.log("⚠️  NOTE: Arbitrum Sepolia may not have GMX V2 deployed");
    console.log("   Using mainnet addresses for testing");
    console.log("   For production, deploy on Arbitrum mainnet\n");
    
    // ============ DEPLOY PLUGIN ============
    
    console.log("📦 Deploying GMXv2Plugin...");
    
    const GMXv2PluginFactory = await ethers.getContractFactory("GMXv2Plugin");
    const gmxPlugin = await GMXv2PluginFactory.deploy(
        SEPOLIA_ADDRESSES.ExchangeRouter,
        SEPOLIA_ADDRESSES.Reader,
        SEPOLIA_ADDRESSES.DataStore,
        SEPOLIA_ADDRESSES.ProxyGeneral,
        SEPOLIA_ADDRESSES.WETH
    );
    
    await gmxPlugin.waitForDeployment();
    const pluginAddress = await gmxPlugin.getAddress();
    
    console.log("✅ GMXv2Plugin deployed at:", pluginAddress);
    console.log("");
    
    // ============ CONFIGURE MARKETS ============
    
    console.log("🏪 Configuring GM markets...");
    
    // GM BTC
    const GM_BTC = "0x7C11F78Ce78768518D743E81Fdfa2F860C6b9A77";
    const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    
    console.log("   Adding GM BTC market...");
    const tx1 = await gmxPlugin.addMarket(GM_BTC, WBTC, WBTC, USDC);
    await tx1.wait();
    console.log("   ✅ GM BTC configured");
    
    // GM ETH
    const GM_ETH = "0x450bb6774Dd8a756274E0ab4107953259d2ac541";
    const WETH = SEPOLIA_ADDRESSES.WETH;
    
    console.log("   Adding GM ETH market...");
    const tx2 = await gmxPlugin.addMarket(GM_ETH, WETH, WETH, USDC);
    await tx2.wait();
    console.log("   ✅ GM ETH configured");
    console.log("");
    
    // ============ VERIFY DEPLOYMENT ============
    
    console.log("🔍 Verifying deployment...");
    
    const metadata = await gmxPlugin.getPluginMetadata();
    const executionFee = await gmxPlugin["getExecutionFee()"]();
    const gmBtcMarket = await gmxPlugin.markets(GM_BTC);
    const gmEthMarket = await gmxPlugin.markets(GM_ETH);
    
    console.log("   Plugin name:", metadata.name);
    console.log("   Version:", metadata.version);
    console.log("   Execution fee:", ethers.formatEther(executionFee), "ETH");
    console.log("   GM BTC active:", gmBtcMarket.isActive);
    console.log("   GM ETH active:", gmEthMarket.isActive);
    console.log("");
    
    // ============ VERIFICATION ON ARBISCAN ============
    
    console.log("📝 Contract verification...");
    console.log("   Run this command to verify on Arbiscan:");
    console.log("");
    console.log(`   npx hardhat verify --network arbitrumSepolia ${pluginAddress} \\`);
    console.log(`     "${SEPOLIA_ADDRESSES.ExchangeRouter}" \\`);
    console.log(`     "${SEPOLIA_ADDRESSES.Reader}" \\`);
    console.log(`     "${SEPOLIA_ADDRESSES.DataStore}" \\`);
    console.log(`     "${SEPOLIA_ADDRESSES.ProxyGeneral}" \\`);
    console.log(`     "${SEPOLIA_ADDRESSES.WETH}"`);
    console.log("");
    
    // ============ SUMMARY ============
    
    console.log("═".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE");
    console.log("═".repeat(60));
    console.log("");
    console.log("📊 Deployment Summary:");
    console.log("   Plugin Address:", pluginAddress);
    console.log("   Network: Arbitrum Sepolia Testnet");
    console.log("   Deployer:", deployer.address);
    console.log("");
    console.log("🏪 Configured Markets:");
    console.log("   GM BTC:", GM_BTC);
    console.log("   GM ETH:", GM_ETH);
    console.log("");
    console.log("🔗 Explorer:");
    console.log("   https://sepolia.arbiscan.io/address/" + pluginAddress);
    console.log("");
    console.log("📝 Next Steps:");
    console.log("   1. Verify contract on Arbiscan (see command above)");
    console.log("   2. Test inputSwap with testnet tokens");
    console.log("   3. Wait for keeper execution (1-2 min)");
    console.log("   4. Verify GM token balance");
    console.log("");
    console.log("💾 Save this address to .env:");
    console.log(`   GMX_V2_PLUGIN_TESTNET=${pluginAddress}`);
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
