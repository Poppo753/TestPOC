const { ethers } = require("hardhat");

async function main() {
  console.log("=== Direct Function Call Test to Morpho ===\n");

  const morphoAddr = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
  
  // Instead of eth_getCode, try calling functions directly
  const morphoAbi = [
    "function owner() view returns (address)",
    "function feeRecipient() view returns (address)",
    "function isIrmEnabled(address irm) view returns (bool)",
    "function isLltvEnabled(uint256 lltv) view returns (bool)",
    "function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
    "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
    "function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)"
  ];
  
  const morpho = new ethers.Contract(morphoAddr, morphoAbi, ethers.provider);

  // 1. Try basic calls
  console.log("--- Basic Calls ---");
  try {
    const owner = await morpho.owner();
    console.log("✅ owner():", owner);
  } catch (e) {
    console.log("❌ owner() FAILED:", e.message?.substring(0, 100));
  }

  try {
    const feeRecipient = await morpho.feeRecipient();
    console.log("✅ feeRecipient():", feeRecipient);
  } catch (e) {
    console.log("❌ feeRecipient() FAILED:", e.message?.substring(0, 100));
  }

  // 2. Check if 86% LLTV is enabled
  try {
    const lltvEnabled = await morpho.isLltvEnabled("860000000000000000");
    console.log("✅ isLltvEnabled(86%):", lltvEnabled);
  } catch (e) {
    console.log("❌ isLltvEnabled FAILED:", e.message?.substring(0, 100));
  }

  // 3. Check both IRMs
  const officialIRM = "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC";
  const ourIRM = "0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA";
  
  for (const [label, irm] of [["Official (docs)", officialIRM], ["Our IRM", ourIRM]]) {
    try {
      const enabled = await morpho.isIrmEnabled(irm);
      console.log(`✅ isIrmEnabled(${label}): ${enabled}`);
    } catch (e) {
      console.log(`❌ isIrmEnabled(${label}) FAILED:`, e.message?.substring(0, 100));
    }
  }

  // 4. Try to find the real WETH/USDC market
  // We need to compute market IDs with different oracle/IRM combinations
  console.log("\n--- Market Discovery ---");
  
  const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const LLTV_86 = "860000000000000000";
  
  // Try with both IRMs and our oracle
  const combos = [
    { label: "Our Oracle + Official IRM", oracle: "0x282FEB10549fde52bD61A6979424Ddf18A4971A2", irm: officialIRM },
    { label: "Our Oracle + Our IRM", oracle: "0x282FEB10549fde52bD61A6979424Ddf18A4971A2", irm: ourIRM },
  ];
  
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  for (const combo of combos) {
    const encoded = abiCoder.encode(
      ["address", "address", "address", "address", "uint256"],
      [USDC, WETH, combo.oracle, combo.irm, LLTV_86]
    );
    const marketId = ethers.keccak256(encoded);
    
    try {
      const mkt = await morpho.market(marketId);
      const hasActivity = BigInt(mkt[0]) > 0n;
      console.log(`\n[${combo.label}]`);
      console.log(`  MarketId: ${marketId}`);
      console.log(`  totalSupply: ${ethers.formatUnits(mkt[0], 6)} USDC`);
      console.log(`  totalBorrow: ${ethers.formatUnits(mkt[2], 6)} USDC`);
      console.log(`  lastUpdate: ${mkt[4]} ${mkt[4] > 0 ? "✅ ACTIVE" : "(no activity)"}`);
    } catch (e) {
      console.log(`[${combo.label}] market() FAILED:`, e.message?.substring(0, 100));
    }
  }

  // 5. Extra: try low-level getCode again vs raw RPC
  console.log("\n--- eth_getCode retry ---");
  const code = await ethers.provider.getCode(morphoAddr);
  console.log("getCode length:", code.length);
  
  // Also check our own plugin to make sure getCode works at all
  const pluginCode = await ethers.provider.getCode("0x84824B667ce8b268EEf5267bA5f030Ab89E9CfBE");
  console.log("Our MorphoPlugin getCode length:", pluginCode.length);
  
  // Network info
  const network = await ethers.provider.getNetwork();
  const block = await ethers.provider.getBlockNumber();
  console.log(`\nNetwork: chainId=${network.chainId} block=${block}`);
}

main().catch(console.error);
