const { ethers } = require("hardhat");

async function main() {
  console.log("=== Multi-RPC Morpho Check ===\n");

  const morphoAddr = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
  
  // Try multiple public RPCs for Arbitrum
  const rpcs = [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum-one-rpc.publicnode.com",
    "https://1rpc.io/arb",
    "https://rpc.ankr.com/arbitrum",
  ];

  for (const rpc of rpcs) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      const code = await provider.getCode(morphoAddr);
      const blockNum = await provider.getBlockNumber();
      console.log(`[${rpc.substring(8, 40)}...] block=${blockNum} bytecode_len=${code.length} is_contract=${code.length > 2}`);
    } catch (e) {
      console.log(`[${rpc.substring(8, 40)}...] ERROR: ${e.message?.substring(0, 60)}`);
    }
  }

  // Also check Morpho V2 contracts from docs
  console.log("\n--- Morpho V2 Contracts (from docs) ---");
  const v2Contracts = {
    "VaultV2Factory": "0xA1D94F746dEfa1928926b84fB2596c06926C0405",
    "MorphoVaultV1AdapterFactory": "0xD1B8E2dee25c2b89DCD2f98448a7ce87d6F63394",
    "MorphoMarketV1AdapterV2Factory": "0x32BB1c0D48D8b1B3363e86eeB9A0300BAd61ccc1",
    "MorphoRegistry (V2)": "0x3696c5eAe4a7Ffd04Ea163564571E9CD8Ed9364e",
  };

  for (const [name, addr] of Object.entries(v2Contracts)) {
    const code = await ethers.provider.getCode(addr);
    console.log(`${name}: ${code.length > 2 ? code.length + " bytes ✅" : "❌ empty"}`);
  }

  // Check other V1 things from docs
  console.log("\n--- Other Morpho V1 addresses ---");
  const v1Others = {
    "PublicAllocator": "0xfd32fA2ca22c76dD6E550706Ad913FC6CE91c75D",
    "PreLiquidation Factory": "0x6FF33615e792E35ed1026ea7cACCf42D9BF83476",
    "Bundler3": "0x6566194141eefa99Af43Bb5Aa71460Ca2Dc90245",
    "Rewards Distributor Factory": "0x9baA51245CDD28D8D74Afe8B3959b616E9ee7c8D",
    "MORPHO token": "0x58D97B57BB95320F9a05dC918Aef65434969c2B2",
  };

  for (const [name, addr] of Object.entries(v1Others)) {
    const code = await ethers.provider.getCode(addr);
    console.log(`${name}: ${code.length > 2 ? code.length + " bytes ✅" : "❌ empty"}`);
  }

  // Check env variable
  console.log("\n--- Config ---");
  console.log("ARBITRUM_RPC_URL:", process.env.ARBITRUM_RPC_URL || "(not set, using default)");
}

main().catch(console.error);
