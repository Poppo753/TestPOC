const { ethers } = require("hardhat");

async function main() {
  console.log("=== Morpho Blue Verification on Arbitrum ===\n");

  // 1. Check Morpho Blue singleton
  const morphoAddr = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
  const code = await ethers.provider.getCode(morphoAddr);
  console.log("Morpho Blue bytecode length:", code.length);
  console.log("Is deployed:", code.length > 2);

  // 2. Check our deployed contracts
  const contracts = {
    MorphoRegistry: "0x4Ff9306f450dbF152143317be833702822aD463F",
    MorphoPlugin: "0x84824B667ce8b268EEf5267bA5f030Ab89E9CfBE",
    MorphoLensAdapter: "0x1Bc36aE66319Fd4485F87DB84832b007C3549573",
  };

  for (const [name, addr] of Object.entries(contracts)) {
    const c = await ethers.provider.getCode(addr);
    console.log(`${name}: bytecode=${c.length > 2 ? c.length + " bytes ✅" : "❌ NOT FOUND"}`);
  }

  // 3. Deployer balance
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`\nDeployer: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  // 4. If Morpho exists, try to query it
  if (code.length > 2) {
    console.log("\n✅ Morpho Blue IS on Arbitrum! Can proceed with e2e tests.");
    
    // Try to read market state for WETH/USDC
    const morphoAbi = [
      "function idToMarketParams(bytes32 id) external view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)",
      "function market(bytes32 id) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)"
    ];
    const morpho = new ethers.Contract(morphoAddr, morphoAbi, ethers.provider);
    
    // Compute market ID for WETH/USDC 86%
    const marketParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "address", "address", "uint256"],
      [
        "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC (loanToken)
        "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH (collateralToken)
        "0x282FEB10549fde52bD61A6979424Ddf18A4971A2", // oracle
        "0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA", // irm
        "860000000000000000"                           // lltv 86%
      ]
    );
    const marketId = ethers.keccak256(marketParams);
    console.log("MarketId:", marketId);
    
    try {
      const mkt = await morpho.market(marketId);
      console.log("Market totalSupplyAssets:", mkt[0].toString());
      console.log("Market totalBorrowAssets:", mkt[2].toString());
      console.log("Market lastUpdate:", mkt[4].toString());
      console.log("Market has liquidity:", BigInt(mkt[0]) > 0n);
    } catch (e) {
      console.log("Error reading market:", e.message?.substring(0, 100));
    }
  } else {
    console.log("\n❌ Morpho Blue is NOT on Arbitrum at this address!");
    console.log("Our contracts are deployed but CANNOT interact with Morpho Blue.");
    console.log("E2E tests are NOT possible.");
  }
}

main().catch(console.error);
