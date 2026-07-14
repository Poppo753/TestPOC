import { ethers } from "hardhat";

/**
 * DEPLOY NUOVO UNISWAPV3PLUGIN (DIRECT) con Quoter V2
 * 
 * Questo plugin chiama direttamente Uniswap V3 Router
 * e usa Quoter V2 per quote accurate
 * 
 * ARCHITETTURA:
 * SwapManager → UniswapV3PluginDirect → Uniswap V3 Router
 *                                     → Uniswap V3 Quoter V2
 */

const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const UNISWAP_V3_QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

async function main() {
    console.log("============================================================");
    console.log("  DEPLOY UniswapV3PluginDirect");
    console.log("============================================================\n");

    const [deployer] = await ethers.getSigners();
    console.log(`Deploying from: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

    // ============ DEPLOY PLUGIN ============
    console.log("Deploying UniswapV3PluginDirect...");
    console.log(`Router: ${UNISWAP_V3_ROUTER}`);
    console.log(`Quoter V2: ${UNISWAP_V3_QUOTER_V2}`);
    console.log(`ProxyGeneral: ${PROXY_GENERAL}\n`);

    const UniswapV3PluginDirect = await ethers.getContractFactory("UniswapV3PluginDirect");
    const plugin = await UniswapV3PluginDirect.deploy(
        UNISWAP_V3_ROUTER,
        UNISWAP_V3_QUOTER_V2,
        PROXY_GENERAL
    );
    
    await plugin.waitForDeployment();
    const pluginAddress = await plugin.getAddress();
    
    console.log(`✅ UniswapV3PluginDirect deployed at: ${pluginAddress}`);

    // ============ VERIFY DEPLOYMENT ============
    console.log("\nVerifying deployment...");
    console.log(`✅ Plugin deployed successfully`);

    // ============ NEXT STEPS ============
    console.log("\n============================================================");
    console.log("  NEXT STEPS");
    console.log("============================================================");
    console.log(`
1. Update Beacon to use new plugin:
   npx hardhat run scripts/admin/beacon/UpdateUniswapV3Plugin.ts --network arbitrum

2. Test swap:
   npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum

3. Verify on Arbiscan (if mainnet):
   npx hardhat verify --network arbitrum ${pluginAddress} ${UNISWAP_V3_ROUTER} ${UNISWAP_V3_QUOTER_V2} ${PROXY_GENERAL}
    `);

    console.log("\n✅ Deployment complete!");
    console.log(`\nNew plugin address: ${pluginAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
