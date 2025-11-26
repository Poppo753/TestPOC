import { expect } from "chai";
import { ethers } from "hardhat";

describe("Fork Check", function () {
  it("should fork Arbitrum correctly", async function () {
    const network = await ethers.provider.getNetwork();
    const blockNumber = await ethers.provider.getBlockNumber();
    
    console.log("\n🌐 FORK STATUS:");
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Block Number: ${blockNumber}`);
    console.log(`   Name: ${network.name}`);
    
    // Check if we can read from a known Arbitrum contract (WETH)
    const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const wethCode = await ethers.provider.getCode(WETH_ADDRESS);
    
    console.log(`   WETH code length: ${wethCode.length} bytes`);
    console.log(`   Fork working: ${wethCode.length > 2 ? "✅ YES" : "❌ NO"}`);
    
    expect(blockNumber).to.be.greaterThan(0);
    expect(wethCode.length).to.be.greaterThan(2);
  });
});
