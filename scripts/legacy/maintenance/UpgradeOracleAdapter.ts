import { ethers } from "hardhat";

/**
 * Script: Deploy new ChainlinkAdapter with denomination conversion support
 * and update TokenManager to use it
 * 
 * PROBLEM: Current deployed ChainlinkAdapter lacks denomination conversion
 * (no setReferenceFeed, no targetDenomination)
 * 
 * SOLUTION: Deploy new version and update TokenManager.setOracleAdapter()
 */

// Current addresses
const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
const OLD_ORACLE_ADAPTER = "0x16a5201814Ba08E8a7c8C1f59f83E0409206761c";

// Chainlink feeds on Arbitrum
const CHAINLINK_FEEDS = {
  USDC: { feed: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", decimals: 8, heartbeat: 86400 },
  USDT: { feed: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7", decimals: 8, heartbeat: 86400 },
  DAI: { feed: "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB", decimals: 8, heartbeat: 3600 },
  WBTC: { feed: "0xd0C7101eACbB49F3deCcCc166d238410D6D46d57", decimals: 8, heartbeat: 86400 },
  WETH: { feed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", decimals: 8, heartbeat: 3600 },
  ARB: { feed: "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6", decimals: 8, heartbeat: 86400 },
  LINK: { feed: "0x86E53CF1B870786351Da77A57575e79CB55812CB", decimals: 8, heartbeat: 3600 },
  UNI: { feed: "0x9C917083fDb403ab5ADbEC26Ee294f6EcAda2720", decimals: 8, heartbeat: 86400 },
};

const ETH_USD_FEED = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";

async function main() {
  console.log("\n🚀 DEPLOY NEW CHAINLINK ADAPTER");
  console.log("=".repeat(100) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(signer.address))} ETH\n`);

  // ==================== STEP 1: DEPLOY NEW ADAPTER ====================
  console.log("Step 1: Deploy new ChainlinkAdapter");
  console.log("-".repeat(100));

  const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
  const chainlinkAdapter = await ChainlinkAdapter.deploy();
  await chainlinkAdapter.waitForDeployment();
  const newAdapterAddress = await chainlinkAdapter.getAddress();

  console.log(`   ✅ New ChainlinkAdapter: ${newAdapterAddress}`);
  console.log(`   📝 Deployment TX: ${chainlinkAdapter.deploymentTransaction()?.hash}\n`);

  // ==================== STEP 2: CONFIGURE PRICE FEEDS ====================
  console.log("Step 2: Configure price feeds with USD denomination");
  console.log("-".repeat(100));

  for (const [token, config] of Object.entries(CHAINLINK_FEEDS)) {
    console.log(`   Adding ${token}...`);
    const tx = await chainlinkAdapter.setPriceFeed(
      token,
      config.feed,
      config.decimals,
      config.heartbeat,
      "USD"  // denomination
    );
    await tx.wait();
    console.log(`      ✅ ${token} configured (TX: ${tx.hash})`);
  }
  console.log();

  // ==================== STEP 3: SET REFERENCE FEED ====================
  console.log("Step 3: Set USD reference feed (ETH/USD)");
  console.log("-".repeat(100));

  const tx = await chainlinkAdapter.setReferenceFeed(
    "USD",
    ETH_USD_FEED,
    8,
    86400  // 24h heartbeat
  );
  await tx.wait();
  console.log(`   ✅ USD reference feed configured`);
  console.log(`   📝 TX: ${tx.hash}\n`);

  // ==================== STEP 4: UPDATE TOKEN MANAGER ====================
  console.log("Step 4: Update TokenManager to use new Oracle Adapter");
  console.log("-".repeat(100));

  const tokenManager = await ethers.getContractAt(
    ["function setOracleAdapter(address) external"],
    TOKEN_MANAGER
  );

  const updateTx = await tokenManager.setOracleAdapter(newAdapterAddress);
  await updateTx.wait();
  console.log(`   ✅ TokenManager updated`);
  console.log(`   📝 TX: ${updateTx.hash}\n`);

  // ==================== STEP 5: VERIFICATION ====================
  console.log("Step 5: Verify prices");
  console.log("-".repeat(100));

  const testAdapter = await ethers.getContractAt(
    ["function getPrice(string) external view returns (uint256, uint256, bool)"],
    newAdapterAddress
  );

  console.log("\n💵 USDC:");
  const usdcPrice = await testAdapter.getPrice("USDC");
  console.log(`   Price: ${ethers.formatEther(usdcPrice[0])} ETH per USDC`);
  console.log(`   Valid: ${usdcPrice[2] ? '✅' : '❌'}`);
  console.log(`   Expected: ~0.00034 ETH`);
  console.log(`   Correct: ${Math.abs(Number(ethers.formatEther(usdcPrice[0])) - 0.00034) < 0.0001 ? '✅' : '❌'}`);

  console.log("\n₿ WBTC:");
  const btcPrice = await testAdapter.getPrice("WBTC");
  console.log(`   Price: ${ethers.formatEther(btcPrice[0])} ETH per WBTC`);
  console.log(`   Valid: ${btcPrice[2] ? '✅' : '❌'}`);
  console.log(`   Expected: ~29 ETH`);
  console.log(`   Correct: ${Math.abs(Number(ethers.formatEther(btcPrice[0])) - 29) < 5 ? '✅' : '❌'}`);

  // Test TokenManager
  console.log("\n\n🔬 TokenManager Test:");
  console.log("-".repeat(100));

  const testTokenManager = await ethers.getContractAt(
    ["function getTokenPrice(string) external view returns (uint256, uint256, bool)"],
    TOKEN_MANAGER
  );

  const tmUSDC = await testTokenManager.getTokenPrice("USDC");
  console.log(`\n💵 USDC via TokenManager:`);
  console.log(`   Price: ${ethers.formatEther(tmUSDC[0])} ETH`);
  console.log(`   Valid: ${tmUSDC[2] ? '✅' : '❌'}`);

  const tmBTC = await testTokenManager.getTokenPrice("WBTC");
  console.log(`\n₿ WBTC via TokenManager:`);
  console.log(`   Price: ${ethers.formatEther(tmBTC[0])} ETH`);
  console.log(`   Valid: ${tmBTC[2] ? '✅' : '❌'}`);

  // ==================== SUMMARY ====================
  console.log("\n\n📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(100));
  console.log(`Old Oracle Adapter: ${OLD_ORACLE_ADAPTER}`);
  console.log(`New Oracle Adapter: ${newAdapterAddress}`);
  console.log(`TokenManager:       ${TOKEN_MANAGER}`);
  console.log(`\n✅ Deployment complete!`);
  console.log(`\n⚠️ IMPORTANT: Update deployments/mainnet-latest.json with new address!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
