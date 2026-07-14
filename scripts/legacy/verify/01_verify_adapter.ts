/**
 * @title Verify ChainlinkAdapter Deployment
 * @notice Post-deployment verification script for ChainlinkAdapter
 * @dev Validates that adapter is working correctly before proceeding to TokenManager deployment
 * 
 * Usage:
 *   # Using latest deployment
 *   npx hardhat run scripts/verify/01_verify_adapter.ts --network arbitrum
 * 
 *   # Using specific address
 *   CHAINLINK_ADAPTER_ADDRESS=0x... npx hardhat run scripts/verify/01_verify_adapter.ts --network arbitrum
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getAllFeeds } from "../config/chainlink-feeds-arbitrum";

// ==================== TYPES ====================

interface VerificationResult {
  adapterAddress: string;
  network: string;
  timestamp: number;
  checks: {
    deployment: boolean;
    ownership: boolean;
    feeds: FeedCheck[];
    prices: PriceCheck[];
  };
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

interface FeedCheck {
  token: string;
  supported: boolean;
  feedAddress: string;
  decimals: number;
  status: "✅" | "❌" | "⚠️";
  message: string;
}

interface PriceCheck {
  token: string;
  price: string;
  timestamp: Date;
  isValid: boolean;
  age: number; // seconds
  status: "✅" | "❌" | "⚠️";
  message: string;
}

// ==================== MAIN VERIFICATION FUNCTION ====================

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔍 VERIFYING CHAINLINK ADAPTER");
  console.log("=".repeat(80) + "\n");

  const networkName = network.name;
  const isMainnet = networkName === "arbitrum";
  
  console.log(`📡 Network: ${networkName}`);
  
  // Get adapter address
  let adapterAddress = process.env.CHAINLINK_ADAPTER_ADDRESS;
  
  if (!adapterAddress) {
    // Try to load from latest deployment
    const deploymentPath = path.join(
      __dirname,
      "..",
      "deployments",
      `chainlink-adapter-${networkName}-latest.json`
    );
    
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      adapterAddress = deployment.adapterAddress;
      console.log(`📂 Loaded from: ${deploymentPath}`);
    } else {
      throw new Error("❌ No adapter address found! Set CHAINLINK_ADAPTER_ADDRESS or deploy first.");
    }
  }
  
  console.log(`📍 Adapter Address: ${adapterAddress}\n`);
  
  // Validate address exists
  if (!adapterAddress) {
    throw new Error("❌ Adapter address is undefined!");
  }
  
  // Get adapter contract
  const adapter = await ethers.getContractAt("ChainlinkAdapter", adapterAddress);
  const [deployer] = await ethers.getSigners();
  
  // Initialize result
  const result: VerificationResult = {
    adapterAddress,
    network: networkName,
    timestamp: Date.now(),
    checks: {
      deployment: false,
      ownership: false,
      feeds: [],
      prices: [],
    },
    summary: {
      totalChecks: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
    },
  };
  
  // ==================== CHECK 1: DEPLOYMENT ====================
  
  console.log("─".repeat(80));
  console.log("CHECK 1: Deployment Verification");
  console.log("─".repeat(80) + "\n");
  
  try {
    const code = await ethers.provider.getCode(adapterAddress);
    
    if (code === "0x" || code === "0x0") {
      console.log("❌ No contract code at address!");
      result.checks.deployment = false;
      result.summary.failed++;
    } else {
      console.log("✅ Contract deployed successfully");
      console.log(`   📏 Code size: ${(code.length - 2) / 2} bytes`);
      result.checks.deployment = true;
      result.summary.passed++;
    }
    
    // Get adapter info
    const [name, version] = await adapter.getAdapterInfo();
    console.log(`   📋 Name: ${name}`);
    console.log(`   🔢 Version: ${version}`);
    
    if (name !== "Chainlink") {
      console.log("⚠️  Warning: Adapter name unexpected");
      result.summary.warnings++;
    }
    
  } catch (error: any) {
    console.log(`❌ Deployment check failed: ${error.message}`);
    result.checks.deployment = false;
    result.summary.failed++;
  }
  
  result.summary.totalChecks++;
  
  // ==================== CHECK 2: OWNERSHIP ====================
  
  console.log("\n" + "─".repeat(80));
  console.log("CHECK 2: Ownership Verification");
  console.log("─".repeat(80) + "\n");
  
  try {
    const owner = await adapter.owner();
    const deployerAddress = await deployer.getAddress();
    
    console.log(`   👤 Owner: ${owner}`);
    console.log(`   🔑 Deployer: ${deployerAddress}`);
    
    if (owner.toLowerCase() === deployerAddress.toLowerCase()) {
      console.log("✅ Deployer is owner");
      result.checks.ownership = true;
      result.summary.passed++;
    } else {
      console.log("⚠️  Owner is different from deployer");
      result.checks.ownership = true;
      result.summary.warnings++;
    }
    
  } catch (error: any) {
    console.log(`❌ Ownership check failed: ${error.message}`);
    result.checks.ownership = false;
    result.summary.failed++;
  }
  
  result.summary.totalChecks++;
  
  // ==================== CHECK 3: FEED CONFIGURATION ====================
  
  console.log("\n" + "─".repeat(80));
  console.log("CHECK 3: Feed Configuration Verification");
  console.log("─".repeat(80) + "\n");
  
  const expectedFeeds = getAllFeeds(isMainnet ? "mainnet" : "sepolia");
  console.log(`📊 Checking ${expectedFeeds.length} expected feeds...\n`);
  
  for (const expectedFeed of expectedFeeds) {
    const feedCheck: FeedCheck = {
      token: expectedFeed.token,
      supported: false,
      feedAddress: "",
      decimals: 0,
      status: "❌",
      message: "",
    };
    
    try {
      // Check if token is supported
      const supported = await adapter.supportsToken(expectedFeed.token);
      feedCheck.supported = supported;
      
      if (!supported) {
        feedCheck.status = "❌";
        feedCheck.message = "Token not configured";
        console.log(`❌ ${expectedFeed.token}: Not configured`);
        result.summary.failed++;
      } else {
        // Get feed config
        const config = await adapter.getFeedConfig(expectedFeed.token);
        feedCheck.feedAddress = config.feedAddress;
        feedCheck.decimals = Number(config.decimals);
        
        // Validate configuration
        const correctAddress = config.feedAddress.toLowerCase() === expectedFeed.feedAddress.toLowerCase();
        const correctDecimals = Number(config.decimals) === expectedFeed.decimals;
        
        if (correctAddress && correctDecimals) {
          feedCheck.status = "✅";
          feedCheck.message = "Correctly configured";
          console.log(`✅ ${expectedFeed.token}: Configured correctly`);
          console.log(`   📍 Feed: ${config.feedAddress}`);
          console.log(`   🔢 Decimals: ${config.decimals}`);
          console.log(`   ⏱️  Heartbeat: ${config.heartbeat}s`);
          result.summary.passed++;
        } else {
          feedCheck.status = "⚠️";
          feedCheck.message = !correctAddress ? "Wrong feed address" : "Wrong decimals";
          console.log(`⚠️  ${expectedFeed.token}: Configuration mismatch`);
          if (!correctAddress) {
            console.log(`   ❌ Expected: ${expectedFeed.feedAddress}`);
            console.log(`   ❌ Got: ${config.feedAddress}`);
          }
          if (!correctDecimals) {
            console.log(`   ❌ Expected decimals: ${expectedFeed.decimals}`);
            console.log(`   ❌ Got decimals: ${config.decimals}`);
          }
          result.summary.warnings++;
        }
      }
      
    } catch (error: any) {
      feedCheck.status = "❌";
      feedCheck.message = `Error: ${error.message}`;
      console.log(`❌ ${expectedFeed.token}: Check failed - ${error.message}`);
      result.summary.failed++;
    }
    
    result.checks.feeds.push(feedCheck);
    result.summary.totalChecks++;
    console.log("");
  }
  
  // ==================== CHECK 4: PRICE RETRIEVAL ====================
  
  console.log("─".repeat(80));
  console.log("CHECK 4: Price Retrieval Verification");
  console.log("─".repeat(80) + "\n");
  
  console.log("📈 Testing live price retrieval...\n");
  
  for (const feed of expectedFeeds) {
    const priceCheck: PriceCheck = {
      token: feed.token,
      price: "0",
      timestamp: new Date(0),
      isValid: false,
      age: 0,
      status: "❌",
      message: "",
    };
    
    try {
      const supported = await adapter.supportsToken(feed.token);
      
      if (!supported) {
        priceCheck.status = "⚠️";
        priceCheck.message = "Not configured";
        console.log(`⚠️  ${feed.token}: Skipped (not configured)`);
        result.summary.warnings++;
      } else {
        // Get price
        const [price, timestamp, isValid] = await adapter.getPrice(feed.token);
        const decimals = await adapter.getPriceDecimals(feed.token);
        
        priceCheck.price = ethers.formatUnits(price, decimals);
        priceCheck.timestamp = new Date(Number(timestamp) * 1000);
        priceCheck.isValid = isValid;
        priceCheck.age = Date.now() / 1000 - Number(timestamp);
        
        // Validate price
        const priceValue = Number(ethers.formatUnits(price, decimals));
        const priceReasonable = priceValue > 0 && priceValue < 1000000; // Sanity check
        const notTooOld = priceCheck.age < 86400 * 2; // Less than 2 days old
        
        if (isValid && priceReasonable && notTooOld) {
          priceCheck.status = "✅";
          priceCheck.message = "Valid price retrieved";
          console.log(`✅ ${feed.token}: $${priceCheck.price}`);
          console.log(`   🕐 Updated: ${priceCheck.timestamp.toISOString()}`);
          console.log(`   ⏱️  Age: ${Math.floor(priceCheck.age)}s ago`);
          console.log(`   ✓ Valid: ${isValid}`);
          result.summary.passed++;
        } else {
          priceCheck.status = "⚠️";
          const issues = [];
          if (!isValid) issues.push("stale");
          if (!priceReasonable) issues.push("unreasonable value");
          if (!notTooOld) issues.push("too old");
          priceCheck.message = `Issues: ${issues.join(", ")}`;
          
          console.log(`⚠️  ${feed.token}: $${priceCheck.price}`);
          console.log(`   ⚠️  Issues: ${issues.join(", ")}`);
          result.summary.warnings++;
        }
      }
      
    } catch (error: any) {
      priceCheck.status = "❌";
      priceCheck.message = `Error: ${error.message}`;
      console.log(`❌ ${feed.token}: Failed to get price - ${error.message}`);
      result.summary.failed++;
    }
    
    result.checks.prices.push(priceCheck);
    result.summary.totalChecks++;
    console.log("");
  }
  
  // ==================== SUMMARY ====================
  
  console.log("=".repeat(80));
  console.log("📊 VERIFICATION SUMMARY");
  console.log("=".repeat(80) + "\n");
  
  const passRate = (result.summary.passed / result.summary.totalChecks * 100).toFixed(1);
  
  console.log(`✅ Passed: ${result.summary.passed}/${result.summary.totalChecks} (${passRate}%)`);
  console.log(`❌ Failed: ${result.summary.failed}/${result.summary.totalChecks}`);
  console.log(`⚠️  Warnings: ${result.summary.warnings}/${result.summary.totalChecks}`);
  
  // Overall status
  if (result.summary.failed === 0) {
    if (result.summary.warnings === 0) {
      console.log(`\n🎉 ALL CHECKS PASSED! Adapter is ready for production.`);
    } else {
      console.log(`\n✅ VERIFICATION PASSED with warnings. Review warnings before proceeding.`);
    }
  } else {
    console.log(`\n❌ VERIFICATION FAILED! Address issues before using adapter.`);
  }
  
  // Save verification report
  const reportsDir = path.join(__dirname, "..", "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportPath = path.join(reportsDir, `adapter-verification-${networkName}-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 Verification report saved: ${reportPath}`);
  
  console.log("\n" + "=".repeat(80) + "\n");
  
  // Exit with error if verification failed
  if (result.summary.failed > 0) {
    process.exit(1);
  }
  
  return result;
}

// ==================== EXECUTE ====================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n" + "=".repeat(80));
    console.error("❌ VERIFICATION FAILED");
    console.error("=".repeat(80));
    console.error(error);
    process.exit(1);
  });
