// Quick check with multiple RPCs to see if Morpho has code
const { ethers } = require("ethers");

async function checkWithRPC(url: string, label: string) {
  try {
    const provider = new ethers.JsonRpcProvider(url, 42161, { staticNetwork: true });
    const morphoAddr = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
    
    // Quick timeout
    const codePromise = provider.getCode(morphoAddr);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000));
    
    const code = await Promise.race([codePromise, timeoutPromise]) as string;
    console.log(`[${label}] getCode length: ${code.length} | hasCode: ${code.length > 2}`);
    
    if (code.length > 2) {
      // Try owner() call
      const morpho = new ethers.Contract(morphoAddr, ["function owner() view returns (address)"], provider);
      const owner = await morpho.owner();
      console.log(`[${label}] owner(): ${owner}`);
    }
    
    // Also check our plugin to confirm RPC works
    const pluginCode = await provider.getCode("0x84824B667ce8b268EEf5267bA5f030Ab89E9CfBE");
    console.log(`[${label}] Our Plugin getCode length: ${pluginCode.length}`);
    
    provider.destroy();
  } catch (e: any) {
    console.log(`[${label}] ERROR: ${e.message?.substring(0, 120)}`);
  }
}

async function main() {
  console.log("=== Multi-RPC Morpho Check ===\n");
  
  const rpcs = [
    ["https://arb1.arbitrum.io/rpc", "Arbitrum Public"],
    ["https://1rpc.io/arb", "1RPC"],
    ["https://arbitrum.llamarpc.com", "LlamaRPC"],
    ["https://rpc.ankr.com/arbitrum", "Ankr"],
    ["https://arbitrum.drpc.org", "dRPC"],
  ];
  
  // Run sequentially to avoid rate limits
  for (const [url, label] of rpcs) {
    await checkWithRPC(url, label);
    console.log("");
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
