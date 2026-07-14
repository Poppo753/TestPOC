const { ethers } = require("hardhat");

async function main() {
  console.log("=== DEEP Morpho Verification on Arbitrum ===\n");

  const morphoAddr = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

  // 1. Check Morpho Blue singleton with detailed info
  const code = await ethers.provider.getCode(morphoAddr);
  console.log("Morpho bytecode length:", code.length);
  console.log("Bytecode prefix:", code.substring(0, 40));
  console.log("Is contract:", code !== "0x" && code.length > 2);

  // 2. Also check the Adaptive Curve IRM from official docs (Arbitrum)
  const officialIRM = "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC";
  const ourIRM = "0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA";
  
  const irmCodeOfficial = await ethers.provider.getCode(officialIRM);
  const irmCodeOurs = await ethers.provider.getCode(ourIRM);
  
  console.log("\n--- IRM Addresses ---");
  console.log(`Official IRM (docs): ${officialIRM} → bytecode: ${irmCodeOfficial.length > 2 ? irmCodeOfficial.length + " bytes ✅" : "❌ empty"}`);
  console.log(`Our IRM:             ${ourIRM} → bytecode: ${irmCodeOurs.length > 2 ? irmCodeOurs.length + " bytes ✅" : "❌ empty"}`);

  // 3. Check our oracle
  const ourOracle = "0x282FEB10549fde52bD61A6979424Ddf18A4971A2";
  const oracleCode = await ethers.provider.getCode(ourOracle);
  console.log(`\nOur Oracle: ${ourOracle} → bytecode: ${oracleCode.length > 2 ? oracleCode.length + " bytes ✅" : "❌ empty"}`);

  // 4. Check ChainlinkOracleV2Factory from docs
  const oracleFactory = "0x3A7bB36Ee3f3eE32A60e9f2b33c1e5f2E83ad766";
  const factoryCode = await ethers.provider.getCode(oracleFactory);
  console.log(`Oracle Factory (docs): ${oracleFactory} → bytecode: ${factoryCode.length > 2 ? factoryCode.length + " bytes ✅" : "❌ empty"}`);

  // 5. Check MetaMorpho Factory (from docs, proves Morpho ecosystem is on Arb)
  const metaFactory = "0x1897A8997241C1cD4bD0698647e4EB7213535c24";
  const metaCode = await ethers.provider.getCode(metaFactory);
  console.log(`MetaMorpho Factory (docs): ${metaFactory} → bytecode: ${metaCode.length > 2 ? metaCode.length + " bytes ✅" : "❌ empty"}`);

  // 6. If Morpho exists, try direct calls
  if (code.length > 2) {
    console.log("\n--- Direct Morpho Calls ---");
    
    // Try to query owner (Morpho is immutable, no owner, but has an 'owner' function that returns address(0))
    const morphoAbi = [
      "function owner() view returns (address)",
      "function feeRecipient() view returns (address)",
      "function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
      "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
      "function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)"
    ];
    const morpho = new ethers.Contract(morphoAddr, morphoAbi, ethers.provider);
    
    try {
      const owner = await morpho.owner();
      console.log("Morpho owner():", owner);
    } catch (e) {
      console.log("owner() failed:", e.message?.substring(0, 80));
    }

    // Try computing market ID with the official IRM
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    
    // Market with OFFICIAL IRM from docs
    const marketParamsOfficial = abiCoder.encode(
      ["address", "address", "address", "address", "uint256"],
      [
        "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC loanToken
        "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH collateralToken
        ourOracle,                                       // our oracle
        officialIRM,                                     // official IRM
        "860000000000000000"                             // lltv 86%
      ]
    );
    const marketIdOfficial = ethers.keccak256(marketParamsOfficial);
    
    // Market with OUR IRM
    const marketParamsOurs = abiCoder.encode(
      ["address", "address", "address", "address", "uint256"],
      [
        "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        ourOracle,
        ourIRM,
        "860000000000000000"
      ]
    );
    const marketIdOurs = ethers.keccak256(marketParamsOurs);

    console.log("\nMarketId (official IRM):", marketIdOfficial);
    console.log("MarketId (our IRM):    ", marketIdOurs);

    // Try reading both markets
    for (const [label, id] of [["Official IRM", marketIdOfficial], ["Our IRM", marketIdOurs]]) {
      try {
        const mkt = await morpho.market(id);
        const hasActivity = BigInt(mkt[0]) > 0n || BigInt(mkt[2]) > 0n;
        console.log(`\n[${label}] Market State:`);
        console.log(`  totalSupplyAssets: ${mkt[0]} (${ethers.formatUnits(mkt[0], 6)} USDC)`);
        console.log(`  totalBorrowAssets: ${mkt[2]} (${ethers.formatUnits(mkt[2], 6)} USDC)`);
        console.log(`  lastUpdate: ${mkt[4]} (${mkt[4] > 0 ? new Date(Number(mkt[4]) * 1000).toISOString() : "never"})`);
        console.log(`  Has activity: ${hasActivity}`);
      } catch (e) {
        console.log(`[${label}] Market read failed:`, e.message?.substring(0, 80));
      }
    }

    // Also try idToMarketParams to see if the market was created
    for (const [label, id] of [["Official IRM", marketIdOfficial], ["Our IRM", marketIdOurs]]) {
      try {
        const params = await morpho.idToMarketParams(id);
        const isZero = params[0] === ethers.ZeroAddress;
        console.log(`\n[${label}] idToMarketParams → loanToken: ${params[0]} ${isZero ? "(NOT CREATED)" : "✅ EXISTS"}`);
        if (!isZero) {
          console.log(`  collateralToken: ${params[1]}`);
          console.log(`  oracle: ${params[2]}`);
          console.log(`  irm: ${params[3]}`);
          console.log(`  lltv: ${params[4]}`);
        }
      } catch (e) {
        console.log(`[${label}] idToMarketParams failed:`, e.message?.substring(0, 80));
      }
    }
  } else {
    console.log("\n⚠️ Morpho singleton has NO bytecode on Arbitrum via this RPC.");
    console.log("Trying alternative verification methods...\n");
    
    // Try a direct eth_getCode via raw call to rule out caching
    const provider = ethers.provider;
    const rawCode = await provider.send("eth_getCode", [morphoAddr, "latest"]);
    console.log("Raw eth_getCode result length:", rawCode.length);
    console.log("Raw prefix:", rawCode.substring(0, 40));
    
    // Check block number to make sure we're on the right chain
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    console.log(`\nNetwork: chainId=${network.chainId}, block=${blockNumber}`);
  }
}

main().catch(console.error);
