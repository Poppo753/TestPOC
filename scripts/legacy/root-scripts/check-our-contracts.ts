const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;

  // 1. Check real Morpho has code
  const realMorpho = "0x6c247b1F6182318877311737BaC0844bAa518F5e";
  const code = await provider.getCode(realMorpho);
  console.log("Real Morpho bytecode length:", code.length, "| Has code:", code.length > 2);

  // 2. Check our MorphoPlugin for the MORPHO address
  const pluginAddr = "0x84824B667ce8b268EEf5267bA5f030Ab89E9CfBE";
  const plugin = new ethers.Contract(pluginAddr, [
    "function MORPHO() view returns (address)",
    "function morphoRegistry() view returns (address)"
  ], provider);

  try {
    const morphoAddr = await plugin.MORPHO();
    console.log("MorphoPlugin.MORPHO():", morphoAddr);
    console.log("Matches real?", morphoAddr.toLowerCase() === realMorpho.toLowerCase());
  } catch(e: any) {
    console.log("MORPHO() failed:", e.message?.substring(0, 100));
  }

  try {
    const reg = await plugin.morphoRegistry();
    console.log("MorphoPlugin.morphoRegistry():", reg);
  } catch(e: any) {
    console.log("morphoRegistry() failed:", e.message?.substring(0, 100));
  }

  // 3. Check MorphoRegistry for the market config
  const registryAddr = "0x4Ff9306f450dbF152143317be833702822aD463F";
  const registry = new ethers.Contract(registryAddr, [
    "function getMarketConfig(address,address) view returns (bytes32,address,address,uint256,address)",
    "function MORPHO() view returns (address)"
  ], provider);

  const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

  try {
    const regMorpho = await registry.MORPHO();
    console.log("MorphoRegistry.MORPHO():", regMorpho);
  } catch(e: any) {
    console.log("Registry MORPHO() failed:", e.message?.substring(0, 100));
  }

  try {
    const config = await registry.getMarketConfig(USDC, WETH);
    console.log("\nRegistry market config:");
    console.log("  marketId:", config[0]);
    console.log("  oracle:", config[1]);
    console.log("  irm:", config[2]);
    console.log("  lltv:", config[3].toString());
    console.log("  collateral:", config[4]);
    
    // Compare with the real market ID from API
    const realMarketId = "0xca83d02be579485cc10945c9597a6141e772f1cf0e0aa28d09a327b6cbd8642c";
    console.log("\n  Real market ID (from API):", realMarketId);
    console.log("  Match:", config[0].toLowerCase() === realMarketId.toLowerCase());
  } catch(e: any) {
    console.log("getMarketConfig failed:", e.message?.substring(0, 200));
  }

  // done
}

main().catch(console.error);
