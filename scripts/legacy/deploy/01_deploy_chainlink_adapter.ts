/**
 * @title Deploy ChainlinkAdapter - Arbitrum Mainnet
 * @notice Deploys and configures ChainlinkAdapter with real Chainlink price feeds
 * @dev Step 1 of Oracle Modularity deployment
 * 
 * Prerequisites:
 * - PRIVATE_KEY in .env
 * - ARBITRUM_RPC_URL in .env (optional, uses public RPC if not set)
 * - ARBITRUM_ETHERSCAN_API_KEY in .env (for verification)
 * 
 * Usage:
 *   # Mainnet deployment
 *   npx hardhat run scripts/deploy/01_deploy_chainlink_adapter.ts --network arbitrum
 * 
 *   # Testnet deployment
 *   npx hardhat run scripts/deploy/01_deploy_chainlink_adapter.ts --network arbitrumSepolia
 * 
 *   # Dry run (fork mode)
 *   FORK_ENABLED=true npx hardhat run scripts/deploy/01_deploy_chainlink_adapter.ts --network hardhat
 * 
 * @author Your Team
 * @custom:security-contact security@yourdomain.com
 */

import { ethers, network, run } from "hardhat";
import { 
  getAllFeeds, 
  validateFeedConfig, 
  ChainlinkFeedConfig 
} from "../config/chainlink-feeds-arbitrum";
import * as fs from "fs";
import * as path from "path";

// ==================== TYPES ====================

interface DeploymentResult {
  adapterAddress: string;
  deployer: string;
  network: string;
  timestamp: number;
  gasUsed: string; // Changed from bigint to string for JSON serialization
  feedsConfigured: number;
  feeds: ChainlinkFeedConfig[];
}

// ==================== CONFIGURATION ====================

const DEPLOYMENT_CONFIG = {
  // Gas settings
  maxFeePerGas: ethers.parseUnits("0.1", "gwei"), // Conservative for Arbitrum
  maxPriorityFeePerGas: ethers.parseUnits("0.01", "gwei"),
  
  // Verification settings
  verifyOnEtherscan: true,
  verificationRetries: 3,
  verificationDelay: 10000, // 10 seconds
  
  // Safety settings
  dryRun: false, // Set to true to simulate without actual deployment
  requireConfirmation: true,
};

// ==================== MAIN DEPLOYMENT FUNCTION ====================

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🚀 DEPLOYING CHAINLINK ADAPTER - ARBITRUM");
  console.log("=".repeat(80) + "\n");

  // Get network info
  const networkName = network.name;
  const isMainnet = networkName === "arbitrum";
  const isFork = networkName === "hardhat" && process.env.FORK_ENABLED === "true";
  
  console.log(`📡 Network: ${networkName}`);
  console.log(`🏦 Mainnet: ${isMainnet ? "YES ⚠️" : "NO"}`);
  console.log(`🍴 Fork Mode: ${isFork ? "YES" : "NO"}`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);
  
  console.log(`\n👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
  
  // Safety check: minimum balance
  const minBalance = ethers.parseEther(isMainnet ? "0.01" : "0.001");
  if (balance < minBalance) {
    throw new Error(`❌ Insufficient balance! Need at least ${ethers.formatEther(minBalance)} ETH`);
  }
  
  // Get feed configurations
  const feedsToConfig = getAllFeeds(isMainnet ? "mainnet" : "sepolia");
  console.log(`\n📊 Feeds to configure: ${feedsToConfig.length}`);
  feedsToConfig.forEach((feed, i) => {
    console.log(`   ${i + 1}. ${feed.token.padEnd(6)} → ${feed.description}`);
  });
  
  // Validate all feeds
  console.log(`\n✅ Validating feed configurations...`);
  for (const feed of feedsToConfig) {
    try {
      validateFeedConfig(feed);
      console.log(`   ✓ ${feed.token}: Valid`);
    } catch (error: any) {
      throw new Error(`❌ Invalid feed config for ${feed.token}: ${error.message}`);
    }
  }
  
  // Confirmation prompt (if enabled)
  if (DEPLOYMENT_CONFIG.requireConfirmation && isMainnet && !isFork) {
    console.log("\n" + "⚠️".repeat(40));
    console.log("⚠️  MAINNET DEPLOYMENT - REAL FUNDS WILL BE USED");
    console.log("⚠️".repeat(40));
    console.log("\nPress Ctrl+C to cancel, or wait 10 seconds to continue...\n");
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  // ==================== STEP 1: DEPLOY ADAPTER ====================
  
  console.log("\n" + "─".repeat(80));
  console.log("📦 STEP 1: Deploying ChainlinkAdapter...");
  console.log("─".repeat(80) + "\n");
  
  const ChainlinkAdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
  
  console.log("⏳ Deploying contract...");
  const adapter = await ChainlinkAdapterFactory.deploy({
    maxFeePerGas: DEPLOYMENT_CONFIG.maxFeePerGas,
    maxPriorityFeePerGas: DEPLOYMENT_CONFIG.maxPriorityFeePerGas,
  });
  
  console.log("⏳ Waiting for deployment confirmation...");
  await adapter.waitForDeployment();
  
  const adapterAddress = await adapter.getAddress();
  const deployTx = adapter.deploymentTransaction();
  const receipt = await deployTx?.wait();
  
  console.log(`\n✅ ChainlinkAdapter deployed!`);
  console.log(`   📍 Address: ${adapterAddress}`);
  console.log(`   🔗 Transaction: ${deployTx?.hash}`);
  console.log(`   ⛽ Gas Used: ${receipt?.gasUsed.toString()}`);
  console.log(`   💵 Gas Price: ${ethers.formatUnits(receipt?.gasPrice || 0n, "gwei")} gwei`);
  
  // ==================== STEP 2: CONFIGURE PRICE FEEDS ====================
  
  console.log("\n" + "─".repeat(80));
  console.log("⚙️  STEP 2: Configuring Price Feeds...");
  console.log("─".repeat(80) + "\n");
  
  let totalGasUsed = receipt?.gasUsed || 0n;
  let successCount = 0;
  const configuredFeeds: ChainlinkFeedConfig[] = [];
  
  for (let i = 0; i < feedsToConfig.length; i++) {
    const feed = feedsToConfig[i];
    console.log(`[${i + 1}/${feedsToConfig.length}] Configuring ${feed.token}...`);
    
    try {
      // Call setPriceFeed
      const tx = await adapter.setPriceFeed(
        feed.token,
        feed.feedAddress,
        feed.decimals,
        feed.heartbeat,
        {
          maxFeePerGas: DEPLOYMENT_CONFIG.maxFeePerGas,
          maxPriorityFeePerGas: DEPLOYMENT_CONFIG.maxPriorityFeePerGas,
        }
      );
      
      console.log(`   ⏳ Transaction: ${tx.hash}`);
      const feedReceipt = await tx.wait();
      
      totalGasUsed += feedReceipt?.gasUsed || 0n;
      successCount++;
      configuredFeeds.push(feed);
      
      console.log(`   ✅ ${feed.token} configured successfully`);
      console.log(`   ⛽ Gas: ${feedReceipt?.gasUsed.toString()}\n`);
      
    } catch (error: any) {
      console.error(`   ❌ Failed to configure ${feed.token}: ${error.message}\n`);
      
      // Don't fail the entire deployment, but warn
      if (isMainnet) {
        console.warn(`⚠️  Warning: ${feed.token} not configured, but continuing...`);
      }
    }
  }
  
  console.log(`\n✅ Feed Configuration Complete: ${successCount}/${feedsToConfig.length} successful`);
  
  // ==================== STEP 3: VERIFY CONFIGURATION ====================
  
  console.log("\n" + "─".repeat(80));
  console.log("🔍 STEP 3: Verifying Configuration...");
  console.log("─".repeat(80) + "\n");
  
  // Verify each feed works
  for (const feed of configuredFeeds) {
    try {
      const supported = await adapter.supportsToken(feed.token);
      
      if (supported) {
        // Try to get price
        const [price, timestamp, isValid] = await adapter.getPrice(feed.token);
        const decimals = await adapter.getPriceDecimals(feed.token);
        
        console.log(`✓ ${feed.token}:`);
        console.log(`   Price: $${ethers.formatUnits(price, decimals)}`);
        console.log(`   Valid: ${isValid ? "✅" : "⚠️ STALE"}`);
        console.log(`   Timestamp: ${new Date(Number(timestamp) * 1000).toISOString()}`);
      } else {
        console.log(`✗ ${feed.token}: NOT SUPPORTED ⚠️`);
      }
    } catch (error: any) {
      console.error(`✗ ${feed.token}: Error - ${error.message}`);
    }
  }
  
  // Verify adapter info
  const [adapterName, adapterVersion] = await adapter.getAdapterInfo();
  console.log(`\n📋 Adapter Info:`);
  console.log(`   Name: ${adapterName}`);
  console.log(`   Version: ${adapterVersion}`);
  
  // ==================== STEP 4: ETHERSCAN VERIFICATION ====================
  
  if (DEPLOYMENT_CONFIG.verifyOnEtherscan && !isFork && networkName !== "hardhat") {
    console.log("\n" + "─".repeat(80));
    console.log("🔍 STEP 4: Verifying on Arbiscan...");
    console.log("─".repeat(80) + "\n");
    
    console.log("⏳ Waiting for Arbiscan to index contract...");
    await new Promise(resolve => setTimeout(resolve, DEPLOYMENT_CONFIG.verificationDelay));
    
    for (let attempt = 1; attempt <= DEPLOYMENT_CONFIG.verificationRetries; attempt++) {
      try {
        console.log(`\n📝 Verification attempt ${attempt}/${DEPLOYMENT_CONFIG.verificationRetries}...`);
        
        await run("verify:verify", {
          address: adapterAddress,
          constructorArguments: [],
        });
        
        console.log(`✅ Contract verified on Arbiscan!`);
        console.log(`   🔗 View at: https://${isMainnet ? '' : 'sepolia.'}arbiscan.io/address/${adapterAddress}#code`);
        break;
        
      } catch (error: any) {
        if (error.message.includes("already verified")) {
          console.log(`✅ Contract already verified on Arbiscan!`);
          break;
        }
        
        console.error(`❌ Verification attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < DEPLOYMENT_CONFIG.verificationRetries) {
          console.log(`   ⏳ Retrying in ${DEPLOYMENT_CONFIG.verificationDelay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, DEPLOYMENT_CONFIG.verificationDelay));
        } else {
          console.warn(`⚠️  Could not verify on Arbiscan. You can verify manually later.`);
        }
      }
    }
  }
  
  // ==================== STEP 5: SAVE DEPLOYMENT INFO ====================
  
  console.log("\n" + "─".repeat(80));
  console.log("💾 STEP 5: Saving Deployment Info...");
  console.log("─".repeat(80) + "\n");
  
  const deploymentResult: DeploymentResult = {
    adapterAddress,
    deployer: deployerAddress,
    network: networkName,
    timestamp: Date.now(),
    gasUsed: totalGasUsed.toString(), // Convert BigInt to string
    feedsConfigured: successCount,
    feeds: configuredFeeds,
  };
  
  // Save to file
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `chainlink-adapter-${networkName}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(deploymentResult, null, 2));
  console.log(`✅ Deployment info saved to: ${filepath}`);
  
  // Also save as "latest"
  const latestFilepath = path.join(deploymentsDir, `chainlink-adapter-${networkName}-latest.json`);
  fs.writeFileSync(latestFilepath, JSON.stringify(deploymentResult, null, 2));
  console.log(`✅ Latest deployment saved to: ${latestFilepath}`);
  
  // ==================== SUMMARY ====================
  
  console.log("\n" + "=".repeat(80));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80));
  console.log(`\n📋 Summary:`);
  console.log(`   🏦 Network: ${networkName}`);
  console.log(`   📍 ChainlinkAdapter: ${adapterAddress}`);
  console.log(`   ⚙️  Feeds Configured: ${successCount}/${feedsToConfig.length}`);
  console.log(`   ⛽ Total Gas Used: ${totalGasUsed.toString()}`);
  console.log(`   💵 Estimated Cost: ~${ethers.formatEther(totalGasUsed * (receipt?.gasPrice || 0n))} ETH`);
  
  console.log(`\n📝 Next Steps:`);
  console.log(`   1. Verify adapter on Arbiscan: https://${isMainnet ? '' : 'sepolia.'}arbiscan.io/address/${adapterAddress}`);
  console.log(`   2. Test adapter with: npx hardhat run scripts/verify/01_verify_adapter.ts --network ${networkName}`);
  console.log(`   3. Deploy TokenManager: npx hardhat run scripts/deploy/02_deploy_token_manager.ts --network ${networkName}`);
  
  console.log("\n" + "=".repeat(80) + "\n");
  
  // Set environment variable for next script
  console.log(`💡 Export for next script:`);
  console.log(`   export CHAINLINK_ADAPTER_ADDRESS=${adapterAddress}`);
  
  return deploymentResult;
}

// ==================== EXECUTE ====================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n" + "=".repeat(80));
    console.error("❌ DEPLOYMENT FAILED");
    console.error("=".repeat(80));
    console.error(error);
    process.exit(1);
  });
