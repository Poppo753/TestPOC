import { ethers } from "hardhat";
import { GMXv2Plugin, TokenManager, ChainlinkAdapter, ProxyGeneral, Beacon } from "../typechain-types";

/**
 * Setup completo GMX V2 Plugin nell'ecosistema modulare
 * 
 * FASI:
 * 1. Deploy GMXv2Plugin
 * 2. Register GM tokens in TokenManager (con Chainlink feeds)
 * 3. Configure markets in plugin
 * 4. Authorize plugin in ProxyGeneral
 * 5. Register plugin in Beacon
 * 6. Test flow completo
 */

// ============ GMX V2 ADDRESSES (Arbitrum) ============

const GMX_ADDRESSES = {
    exchangeRouter: "0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8",
    reader: "0xf60becbba223EEA9495Da3f606753867eC10d139",
    dataStore: "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8",
    depositHandler: "0x352f684ab9e97a6321a13CF03A61316B681D9fD2"
};

// ============ GM MARKETS (Top 5) ============

interface GMMarket {
    name: string;
    tokenCode: string;
    gmToken: string;
    indexToken: string;
    longToken: string;
    shortToken: string;
    chainlinkFeed: string; // Chainlink aggregator per GM token
}

const GM_MARKETS: GMMarket[] = [
    {
        name: "ETH/USD",
        tokenCode: "GM-ETH-USD",
        gmToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
        indexToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
        longToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",  // WETH
        shortToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
        chainlinkFeed: "0x0000000000000000000000000000000000000000" // TODO: Add real feed
    },
    {
        name: "BTC/USD",
        tokenCode: "GM-BTC-USD",
        gmToken: "0x47c031236e19d024b42f8AE6780E44A573170703",
        indexToken: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", // WBTC
        longToken: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",  // WBTC
        shortToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
        chainlinkFeed: "0x0000000000000000000000000000000000000000" // TODO: Add real feed
    },
    {
        name: "ARB/USD",
        tokenCode: "GM-ARB-USD",
        gmToken: "0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407",
        indexToken: "0x912CE59144191C1204E64559FE8253a0e49E6548", // ARB
        longToken: "0x912CE59144191C1204E64559FE8253a0e49E6548",  // ARB
        shortToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
        chainlinkFeed: "0x0000000000000000000000000000000000000000" // TODO: Add real feed
    },
    {
        name: "SOL/USD",
        tokenCode: "GM-SOL-USD",
        gmToken: "0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9",
        indexToken: "0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07", // SOL
        longToken: "0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07",  // SOL
        shortToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
        chainlinkFeed: "0x0000000000000000000000000000000000000000" // TODO: Add real feed
    },
    {
        name: "LINK/USD",
        tokenCode: "GM-LINK-USD",
        gmToken: "0x7f1fa204bb700853D36994DA19F830b6Ad18455C",
        indexToken: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", // LINK
        longToken: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",  // LINK
        shortToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
        chainlinkFeed: "0x0000000000000000000000000000000000000000" // TODO: Add real feed
    }
];

// ============ OTHER ADDRESSES ============

const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

// ============ MAIN SETUP FUNCTION ============

async function main() {
    console.log("🚀 Starting GMX V2 Plugin Setup...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");
    
    // ============ STEP 1: Get existing contracts ============
    
    console.log("📦 Step 1: Loading existing contracts...");
    
    const beaconAddress = process.env.BEACON_ADDRESS;
    const tokenManagerAddress = process.env.TOKEN_MANAGER_ADDRESS;
    const chainlinkAdapterAddress = process.env.CHAINLINK_ADAPTER_ADDRESS;
    const proxyGeneralAddress = process.env.PROXY_GENERAL_ADDRESS;
    
    if (!beaconAddress || !tokenManagerAddress || !chainlinkAdapterAddress || !proxyGeneralAddress) {
        throw new Error("Missing contract addresses in .env");
    }
    
    const beacon = await ethers.getContractAt("Beacon", beaconAddress) as Beacon;
    const tokenManager = await ethers.getContractAt("TokenManager", tokenManagerAddress) as TokenManager;
    const chainlinkAdapter = await ethers.getContractAt("ChainlinkAdapter", chainlinkAdapterAddress) as ChainlinkAdapter;
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", proxyGeneralAddress) as ProxyGeneral;
    
    console.log("✅ Contracts loaded\n");
    
    // ============ STEP 2: Deploy GMXv2Plugin ============
    
    console.log("📦 Step 2: Deploying GMXv2Plugin...");
    
    const GMXv2PluginFactory = await ethers.getContractFactory("GMXv2Plugin");
    const gmxPlugin = await GMXv2PluginFactory.deploy(
        GMX_ADDRESSES.exchangeRouter,
        GMX_ADDRESSES.reader,
        GMX_ADDRESSES.dataStore,
        proxyGeneralAddress,
        WETH
    ) as GMXv2Plugin;
    
    await gmxPlugin.waitForDeployment();
    const gmxPluginAddress = await gmxPlugin.getAddress();
    
    console.log("✅ GMXv2Plugin deployed at:", gmxPluginAddress);
    console.log("   - ExchangeRouter:", GMX_ADDRESSES.exchangeRouter);
    console.log("   - Reader:", GMX_ADDRESSES.reader);
    console.log("   - DataStore:", GMX_ADDRESSES.dataStore);
    console.log("   - ProxyGeneral:", proxyGeneralAddress);
    console.log("   - WETH:", WETH, "\n");
    
    // ============ STEP 3: Register GM tokens in TokenManager ============
    
    console.log("📝 Step 3: Registering GM tokens in TokenManager...");
    
    for (const market of GM_MARKETS) {
        console.log(`\n   Processing ${market.name}...`);
        
        // 3a. Add Chainlink price feed to adapter
        if (market.chainlinkFeed !== ethers.ZeroAddress) {
            try {
                console.log(`   → Adding Chainlink feed for ${market.tokenCode}...`);
                const tx1 = await chainlinkAdapter.addPriceFeed(
                    market.tokenCode,
                    market.chainlinkFeed,
                    8, // Chainlink typically uses 8 decimals
                    3600 // 1 hour heartbeat
                );
                await tx1.wait();
                console.log(`   ✅ Chainlink feed added`);
            } catch (error: any) {
                console.log(`   ⚠️  Chainlink feed might already exist or invalid:`, error.message);
            }
        } else {
            console.log(`   ⚠️  No Chainlink feed available for ${market.tokenCode} (using fallback)`);
        }
        
        // 3b. Register GM token in TokenManager
        try {
            console.log(`   → Registering ${market.tokenCode} in TokenManager...`);
            const tx2 = await tokenManager.manageTokenData(
                market.tokenCode,
                market.gmToken,
                18, // GM tokens have 18 decimals
                3600 // 1 hour heartbeat
            );
            await tx2.wait();
            console.log(`   ✅ Token registered`);
        } catch (error: any) {
            console.log(`   ⚠️  Token might already be registered:`, error.message);
        }
    }
    
    console.log("\n✅ All GM tokens processed\n");
    
    // ============ STEP 4: Configure markets in GMXv2Plugin ============
    
    console.log("🔧 Step 4: Configuring markets in GMXv2Plugin...");
    
    for (const market of GM_MARKETS) {
        console.log(`   → Adding market ${market.name}...`);
        
        try {
            const tx = await gmxPlugin.addMarket(
                market.gmToken,
                market.indexToken,
                market.longToken,
                market.shortToken
            );
            await tx.wait();
            console.log(`   ✅ Market ${market.name} added`);
        } catch (error: any) {
            console.log(`   ⚠️  Market might already exist:`, error.message);
        }
    }
    
    console.log("\n✅ All markets configured\n");
    
    // ============ STEP 5: Authorize plugin in ProxyGeneral ============
    
    console.log("🔐 Step 5: Authorizing plugin in ProxyGeneral...");
    
    try {
        const tx = await proxyGeneral.authorizeModule(gmxPluginAddress, "GMX-V2-SwapPlugin");
        await tx.wait();
        console.log("✅ Plugin authorized in ProxyGeneral\n");
    } catch (error: any) {
        console.log("⚠️  Plugin might already be authorized:", error.message, "\n");
    }
    
    // ============ STEP 6: Register plugin in Beacon ============
    
    console.log("🔔 Step 6: Registering plugin in Beacon...");
    
    try {
        const tx = await beacon.updateImplementation("GMX-V2", gmxPluginAddress);
        await tx.wait();
        console.log("✅ Plugin registered in Beacon\n");
    } catch (error: any) {
        console.log("⚠️  Plugin might already be registered:", error.message, "\n");
    }
    
    // ============ STEP 7: Verify setup ============
    
    console.log("🔍 Step 7: Verifying setup...");
    
    // Check plugin authorization
    const isAuthorized = await proxyGeneral.authorizedModules(gmxPluginAddress);
    console.log("   - Plugin authorized in ProxyGeneral:", isAuthorized);
    
    // Check Beacon registration
    const beaconPlugin = await beacon.getImplementation("GMX-V2");
    console.log("   - Plugin in Beacon:", beaconPlugin);
    
    // Check markets
    const market0 = await gmxPlugin.markets(GM_MARKETS[0].gmToken);
    console.log("   - Market 0 active:", market0.isActive);
    
    // Check token registration
    const token0Address = await tokenManager.getTokenAddress(GM_MARKETS[0].tokenCode);
    console.log("   - Token 0 registered:", token0Address !== ethers.ZeroAddress);
    
    console.log("\n✅ Setup verification complete\n");
    
    // ============ STEP 8: Display summary ============
    
    console.log("=" .repeat(60));
    console.log("🎉 GMX V2 PLUGIN SETUP COMPLETE!");
    console.log("=" .repeat(60));
    console.log("\n📋 Summary:");
    console.log(`   - GMXv2Plugin: ${gmxPluginAddress}`);
    console.log(`   - Markets configured: ${GM_MARKETS.length}`);
    console.log(`   - Tokens registered: ${GM_MARKETS.length}`);
    console.log(`   - Authorization: ${isAuthorized ? "✅" : "❌"}`);
    console.log(`   - Beacon registration: ${beaconPlugin === gmxPluginAddress ? "✅" : "❌"}`);
    
    console.log("\n🔗 Registered GM Tokens:");
    for (const market of GM_MARKETS) {
        console.log(`   - ${market.tokenCode} (${market.name})`);
        console.log(`     Address: ${market.gmToken}`);
    }
    
    console.log("\n💡 Next Steps:");
    console.log("   1. Update .env with GMX_V2_PLUGIN_ADDRESS");
    console.log("   2. Test swap: USDC → GM:ETH/USD");
    console.log("   3. Verify balance auto-detection");
    console.log("   4. Test withdrawal: GM:ETH/USD → USDC");
    console.log("   5. Monitor keeper execution times");
    
    console.log("\n⚠️  Important Notes:");
    console.log("   - Execution fee required: ~0.001-0.003 ETH per operation");
    console.log("   - Keeper delay: 1-2 minutes for execution");
    console.log("   - Use for long-term positions, not arbitrage");
    console.log("   - Monitor Chainlink price feeds for accuracy");
    
    console.log("\n📝 Add to .env:");
    console.log(`GMX_V2_PLUGIN_ADDRESS=${gmxPluginAddress}`);
    
    console.log("\n✅ Setup script completed successfully!");
}

// ============ ERROR HANDLING ============

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error during setup:");
        console.error(error);
        process.exit(1);
    });
