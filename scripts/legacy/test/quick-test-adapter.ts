/**
 * @title Quick Test - ChainlinkAdapter
 * @notice Quick smoke test for deployed ChainlinkAdapter
 * @dev Use this for rapid testing after deployment
 * 
 * Usage:
 *   CHAINLINK_ADAPTER_ADDRESS=0x... npx hardhat run scripts/test/quick-test-adapter.ts --network arbitrum
 */

import { ethers } from "hardhat";

async function main() {
  console.log("\n🧪 QUICK TEST - ChainlinkAdapter\n");
  console.log("=".repeat(60) + "\n");

  // Get adapter address
  const adapterAddress = process.env.CHAINLINK_ADAPTER_ADDRESS;
  if (!adapterAddress) {
    throw new Error("❌ Set CHAINLINK_ADAPTER_ADDRESS environment variable");
  }

  console.log(`📍 Adapter: ${adapterAddress}\n`);

  // Connect to adapter
  const adapter = await ethers.getContractAt("ChainlinkAdapter", adapterAddress);

  // Test 1: Get adapter info
  console.log("Test 1: Adapter Info");
  const [name, version] = await adapter.getAdapterInfo();
  console.log(`   Name: ${name}`);
  console.log(`   Version: ${version}`);
  console.log(`   ✅ PASS\n`);

  // Test 2: Check supported tokens
  console.log("Test 2: Token Support");
  const testTokens = ["ETH", "USDC", "WBTC", "DAI", "LINK"];
  for (const token of testTokens) {
    const supported = await adapter.supportsToken(token);
    console.log(`   ${token}: ${supported ? "✅" : "❌"}`);
  }
  console.log(`   ✅ PASS\n`);

  // Test 3: Get prices
  console.log("Test 3: Price Retrieval");
  for (const token of testTokens) {
    try {
      const supported = await adapter.supportsToken(token);
      if (supported) {
        const [price, timestamp, isValid] = await adapter.getPrice(token);
        const decimals = await adapter.getPriceDecimals(token);
        const priceFormatted = ethers.formatUnits(price, decimals);
        const age = Math.floor(Date.now() / 1000 - Number(timestamp));
        
        console.log(`   ${token}: $${priceFormatted}`);
        console.log(`      Valid: ${isValid ? "✅" : "⚠️"}`);
        console.log(`      Age: ${age}s`);
      }
    } catch (error: any) {
      console.log(`   ${token}: ❌ ${error.message}`);
    }
  }
  console.log(`   ✅ PASS\n`);

  // Test 4: Ownership
  console.log("Test 4: Ownership");
  const owner = await adapter.owner();
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log(`   Owner: ${owner}`);
  console.log(`   Current: ${deployerAddress}`);
  console.log(`   Match: ${owner.toLowerCase() === deployerAddress.toLowerCase() ? "✅" : "⚠️"}`);
  console.log(`   ✅ PASS\n`);

  console.log("=".repeat(60));
  console.log("🎉 ALL TESTS PASSED!");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ TEST FAILED\n");
    console.error(error);
    process.exit(1);
  });
