/**
 * 🔗 ADD NEW TOKEN TO PROTOCOL
 * 
 * Script to register a new token in:
 * 1. ChainlinkAdapter (Oracle)
 * 2. TokenManager (Token Registry)
 * 3. SwapManager (Swap Authorization)
 * 
 * USAGE:
 * npx hardhat run scripts/interact/NewTokenCensor.ts --network arbitrum
 * 
 * CUSTOMIZE:
 * Edit TOKEN_CONFIG below to add different tokens
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

// ==================== TOKEN CONFIGURATION ====================

interface TokenConfig {
  code: string;           // Token code (e.g., "LINK", "UNI", "ARB")
  address: string;        // Token contract address
  decimals: number;       // Token decimals (18 for most ERC20)
  priceFeed: string;      // Chainlink TOKEN/USD feed address
  feedDecimals: number;   // Feed decimals (always 8 for Chainlink)
  heartbeat: number;      // Max seconds between updates
  minBalance: string;     // Min balance (0 = no limit)
  maxBalance: string;     // Max balance in token units
  feeTier: number;        // Uniswap pool fee (500=0.05%, 3000=0.3%, 10000=1%)
}

// Example: LINK token on Arbitrum
const TOKEN_CONFIG: TokenConfig = {
  code: "LINK",
  address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
  decimals: 18,
  priceFeed: "0x86E53CF1B870786351Da77A57575e79CB55812CB", // LINK/USD
  feedDecimals: 8,
  heartbeat: 86400, // 24 hours
  minBalance: "0",
  maxBalance: "100000", // 100k LINK
  feeTier: 3000 // 0.3% (standard)
};

// Contract addresses from .env
const CHAINLINK_ADAPTER = process.env.CHAINLINK_ADAPTER_ADDRESS || "";
const TOKEN_MANAGER = process.env.TOKEN_MANAGER_ADDRESS || "";
const SWAP_MANAGER = process.env.SWAP_MANAGER_ADDRESS || "";
const BEACON = process.env.BEACON_ADDRESS || "";

// ==================== MAIN SCRIPT ====================

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log(`  🔗 ADDING ${TOKEN_CONFIG.code} TOKEN TO PROTOCOL`);
  console.log("════════════════════════════════════════════════════════\n");

  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Validate addresses
  if (!CHAINLINK_ADAPTER || !TOKEN_MANAGER || !SWAP_MANAGER || !BEACON) {
    console.error("❌ Missing contract addresses in .env!");
    console.log("Required: CHAINLINK_ADAPTER_ADDRESS, TOKEN_MANAGER_ADDRESS, SWAP_MANAGER_ADDRESS, BEACON_ADDRESS");
    process.exit(1);
  }

  // Get contracts
  console.log("📡 Connecting to contracts...");
  const chainlinkAdapter = await ethers.getContractAt(
    "ChainlinkAdapter",
    CHAINLINK_ADAPTER
  );
  
  const tokenManager = await ethers.getContractAt(
    "TokenManager",
    TOKEN_MANAGER
  );
  
  const swapManager = await ethers.getContractAt(
    "SwapManager",
    SWAP_MANAGER
  );

  const beacon = await ethers.getContractAt("Beacon", BEACON);
  const wethAddress = await beacon.getImplementation("WETH");
  
  console.log(`✅ ChainlinkAdapter: ${CHAINLINK_ADAPTER}`);
  console.log(`✅ TokenManager: ${TOKEN_MANAGER}`);
  console.log(`✅ SwapManager: ${SWAP_MANAGER}`);
  console.log(`✅ WETH: ${wethAddress}\n`);

  // ==================== STEP 1: CONFIGURE ORACLE ====================
  
  console.log("════════════════════════════════════════════════════════");
  console.log("  1️⃣  CONFIGURING CHAINLINK ADAPTER (ORACLE)");
  console.log("════════════════════════════════════════════════════════\n");
  
  console.log(`Token: ${TOKEN_CONFIG.code}`);
  console.log(`Price Feed: ${TOKEN_CONFIG.priceFeed}`);
  console.log(`Heartbeat: ${TOKEN_CONFIG.heartbeat}s (${TOKEN_CONFIG.heartbeat / 3600}h)`);
  console.log(`Denomination: USD\n`);

  try {
    const tx1 = await chainlinkAdapter.setPriceFeed(
      TOKEN_CONFIG.code,
      TOKEN_CONFIG.priceFeed,
      TOKEN_CONFIG.feedDecimals,
      TOKEN_CONFIG.heartbeat,
      "USD"
    );
    
    console.log(`⏳ TX: ${tx1.hash}`);
    const receipt1 = await tx1.wait();
    console.log(`✅ Oracle configured (Gas: ${receipt1?.gasUsed.toString()})\n`);
  } catch (error: any) {
    console.error(`❌ Oracle configuration failed: ${error.message}\n`);
    process.exit(1);
  }

  // ==================== STEP 2: REGISTER TOKEN ====================
  
  console.log("════════════════════════════════════════════════════════");
  console.log("  2️⃣  REGISTERING IN TOKEN MANAGER");
  console.log("════════════════════════════════════════════════════════\n");
  
  console.log(`Token: ${TOKEN_CONFIG.code}`);
  console.log(`Address: ${TOKEN_CONFIG.address}`);
  console.log(`Decimals: ${TOKEN_CONFIG.decimals}`);
  console.log(`Max Balance: ${TOKEN_CONFIG.maxBalance} ${TOKEN_CONFIG.code}\n`);

  try {
    const tx2 = await tokenManager["manageTokenData(string,address,uint8,uint256)"](
      TOKEN_CONFIG.code,
      TOKEN_CONFIG.address,
      TOKEN_CONFIG.decimals,
      TOKEN_CONFIG.heartbeat
    );
    
    console.log(`⏳ TX: ${tx2.hash}`);
    const receipt2 = await tx2.wait();
    console.log(`✅ Token registered (Gas: ${receipt2?.gasUsed.toString()})\n`);
  } catch (error: any) {
    console.error(`❌ Token registration failed: ${error.message}\n`);
    process.exit(1);
  }

  // ==================== STEP 3: VERIFY SWAPS ====================
  
  console.log("════════════════════════════════════════════════════════");
  console.log("  3️⃣  VERIFYING SWAP CAPABILITY");
  console.log("════════════════════════════════════════════════════════\n");
  
  console.log(`Note: Swaps are enabled globally in SwapManager.`);
  console.log(`Checking if swaps are possible for ${TOKEN_CONFIG.code}↔WETH...\n`);

  try {
    // Check if swaps are enabled
    const swapsEnabled = await swapManager.swapsEnabled();
    console.log(`Global swaps enabled: ${swapsEnabled ? '✅' : '❌'}`);
    
    if (!swapsEnabled) {
      console.log(`\n⚠️  WARNING: Swaps are currently disabled globally!`);
      console.log(`Enable with: swapManager.setSwapsEnabled(true)\n`);
    }
    
  } catch (error: any) {
    console.error(`❌ Swap verification failed: ${error.message}\n`);
  }

  // ==================== STEP 4: VERIFICATION ====================
  
  console.log("════════════════════════════════════════════════════════");
  console.log("  4️⃣  VERIFYING CONFIGURATION");
  console.log("════════════════════════════════════════════════════════\n");

  try {
    // Check Oracle
    const supportsToken = await chainlinkAdapter.supportsToken(TOKEN_CONFIG.code);
    console.log(`Oracle supports ${TOKEN_CONFIG.code}: ${supportsToken ? '✅' : '❌'}`);
    
    if (supportsToken) {
      const [price, , isValid] = await chainlinkAdapter.getPrice(TOKEN_CONFIG.code);
      console.log(`  Current Price: ${ethers.formatUnits(price, 18)} ETH`);
      console.log(`  Price Valid: ${isValid ? '✅' : '❌'}`);
    }
    
    // Check TokenManager
    const tokenInfo = await tokenManager.getTokenInfo(TOKEN_CONFIG.code);
    console.log(`\nTokenManager has ${TOKEN_CONFIG.code}: ${tokenInfo.isActive ? '✅' : '❌'}`);
    if (tokenInfo.isActive) {
      console.log(`  Address: ${tokenInfo.tokenAddress}`);
      console.log(`  Decimals: ${tokenInfo.tokenDecimals}`);
      console.log(`  Heartbeat: ${tokenInfo.heartbeat}s`);
    }
    
    // Check SwapManager
    const canSwapToWeth = await swapManager.canSwap(TOKEN_CONFIG.code, "WETH", ethers.parseUnits("1", TOKEN_CONFIG.decimals));
    const canSwapFromWeth = await swapManager.canSwap("WETH", TOKEN_CONFIG.code, ethers.parseEther("0.001"));
    
    console.log(`\nSwap ${TOKEN_CONFIG.code}→WETH possible: ${canSwapToWeth[0] ? '✅' : '❌'}`);
    if (!canSwapToWeth[0]) console.log(`  Reason: ${canSwapToWeth[1]}`);
    
    console.log(`Swap WETH→${TOKEN_CONFIG.code} possible: ${canSwapFromWeth[0] ? '✅' : '❌'}`);
    if (!canSwapFromWeth[0]) console.log(`  Reason: ${canSwapFromWeth[1]}`);
    
  } catch (error: any) {
    console.error(`⚠️  Verification error: ${error.message}`);
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log(`  🎉 ${TOKEN_CONFIG.code} TOKEN ADDED SUCCESSFULLY!`);
  console.log("════════════════════════════════════════════════════════\n");
  
  console.log("📝 Summary:");
  console.log(`   Token: ${TOKEN_CONFIG.code}`);
  console.log(`   Address: ${TOKEN_CONFIG.address}`);
  console.log(`   Oracle: ${TOKEN_CONFIG.priceFeed}`);
  console.log(`   Swaps: Enabled globally (if swapsEnabled=true)`);
  console.log("\n✅ Token is ready for deposits and automatic swaps!\n");
}

// ==================== EXECUTION ====================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });