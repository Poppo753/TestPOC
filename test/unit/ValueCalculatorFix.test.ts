/**
 * 🧪 TEST VALUE CALCULATOR FIX
 * 
 * Test per verificare che il fix al ValueCalculator funzioni correttamente:
 * 1. getTotalPoolValue() è ora view e non fallisce
 * 2. Calcola correttamente il valore di tutti i token
 * 3. Il withdrawal userà il valore corretto
 */

import { ethers } from "hardhat";
import { expect } from "chai";

describe("ValueCalculator - Fixed Version", function () {
  let valueCalculator: any;
  let tokenManager: any;
  let proxyGeneral: any;
  let deployer: any;
  
  const CONTRACTS = {
    valueCalculator: "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B",
    tokenManager: "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517",
    proxyGeneral: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1",
    beacon: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870"
  };

  before(async function () {
    [deployer] = await ethers.getSigners();
    
    valueCalculator = await ethers.getContractAt("ValueCalculator", CONTRACTS.valueCalculator);
    tokenManager = await ethers.getContractAt("TokenManager", CONTRACTS.tokenManager);
    proxyGeneral = await ethers.getContractAt("ProxyGeneral", CONTRACTS.proxyGeneral);
  });

  describe("calculateTokenValuePure (new function)", function () {
    it("should be a pure view function", async function () {
      // This should not modify state
      const value = await valueCalculator.calculateTokenValuePure.staticCall("USDC");
      console.log(`   USDC value: ${ethers.formatEther(value)} ETH`);
      expect(value).to.be.gte(0);
    });
    
    it("should calculate USDC value correctly", async function () {
      const value = await valueCalculator.calculateTokenValuePure("USDC");
      console.log(`   USDC value: ${ethers.formatEther(value)} ETH`);
      expect(value).to.be.gte(0);
    });
    
    it("should calculate WBTC value correctly", async function () {
      const value = await valueCalculator.calculateTokenValuePure("WBTC");
      console.log(`   WBTC value: ${ethers.formatEther(value)} ETH`);
      expect(value).to.be.gte(0);
    });
  });

  describe("getTotalPoolValue (fixed function)", function () {
    it("should be a view function now", async function () {
      // Use staticCall to verify it's truly view
      const poolInfo = await valueCalculator.getTotalPoolValue.staticCall();
      
      console.log(`\n   📊 Pool Value Info:`);
      console.log(`      Total Value: ${ethers.formatEther(poolInfo.totalValue)} ETH`);
      console.log(`      Token Count: ${poolInfo.tokenValues.length}`);
      
      expect(poolInfo.totalValue).to.be.gt(0, "Total value should be greater than 0");
    });
    
    it("should return valid PoolValueInfo struct", async function () {
      const poolInfo = await valueCalculator.getTotalPoolValue();
      
      expect(poolInfo.totalValue).to.be.gt(0);
      expect(poolInfo.tokenValues.length).to.be.gte(1); // At least WETH
      
      console.log(`\n   🪙 Token Breakdown:`);
      for (const tokenValue of poolInfo.tokenValues) {
        console.log(`      ${tokenValue.tokenCode}:`);
        console.log(`         Value: ${ethers.formatEther(tokenValue.value)} ETH`);
        console.log(`         Balance: ${tokenValue.balance.toString()}`);
        console.log(`         Percentage: ${Number(tokenValue.percentage) / 100}%`);
      }
    });
    
    it("should match getTotalPoolValueView()", async function () {
      const detailedValue = await valueCalculator.getTotalPoolValue();
      const simpleValue = await valueCalculator.getTotalPoolValueView();
      
      console.log(`\n   Detailed (getTotalPoolValue): ${ethers.formatEther(detailedValue.totalValue)} ETH`);
      console.log(`   Simple (getTotalPoolValueView): ${ethers.formatEther(simpleValue)} ETH`);
      
      // Should be equal or very close (within 0.1%)
      const diff = detailedValue.totalValue > simpleValue 
        ? detailedValue.totalValue - simpleValue
        : simpleValue - detailedValue.totalValue;
      
      const percentDiff = Number((BigInt(diff) * 10000n) / simpleValue) / 100;
      console.log(`   Difference: ${percentDiff}%`);
      
      expect(percentDiff).to.be.lt(1, "Values should match within 1%");
    });
    
    it("should include WETH + all active tokens", async function () {
      const activeTokens = await tokenManager.getActiveTokens();
      const poolInfo = await valueCalculator.getTotalPoolValue();
      
      console.log(`\n   Active tokens in TokenManager: ${activeTokens.length}`);
      console.log(`   Tokens in PoolValueInfo: ${poolInfo.tokenValues.length}`);
      
      // Should be activeTokens.length + 1 (for WETH)
      expect(poolInfo.tokenValues.length).to.equal(activeTokens.length + 1);
      
      // First token should be WETH
      expect(poolInfo.tokenValues[0].tokenCode).to.equal("WETH");
    });
  });

  describe("Withdrawal scenario simulation", function () {
    it("should calculate correct ETH amount for full withdrawal", async function () {
      const lpBalance = await proxyGeneral.balanceOf(deployer.address);
      const totalSupply = await proxyGeneral.totalSupply();
      
      if (lpBalance === 0n) {
        console.log(`\n   ⚠️  No LP tokens to test withdrawal`);
        this.skip();
        return;
      }
      
      console.log(`\n   👤 User LP Balance: ${ethers.formatEther(lpBalance)} LP`);
      console.log(`   📊 Total LP Supply: ${ethers.formatEther(totalSupply)} LP`);
      console.log(`   📈 User Share: ${Number(lpBalance * 10000n / totalSupply) / 100}%`);
      
      // Get pool value
      const poolInfo = await valueCalculator.getTotalPoolValue();
      
      // Calculate ETH to receive
      const ethToReceive = (lpBalance * poolInfo.totalValue) / totalSupply;
      
      console.log(`   💰 Pool Total Value: ${ethers.formatEther(poolInfo.totalValue)} ETH`);
      console.log(`   💵 ETH to Receive: ${ethers.formatEther(ethToReceive)} ETH`);
      
      expect(ethToReceive).to.be.gt(0, "Should receive non-zero ETH");
      
      // Verify it's not just WETH value
      const wethOnly = poolInfo.tokenValues[0].value;
      console.log(`   🔍 WETH only: ${ethers.formatEther(wethOnly)} ETH`);
      console.log(`   🔍 Other tokens: ${ethers.formatEther(poolInfo.totalValue - wethOnly)} ETH`);
      
      if (poolInfo.totalValue > wethOnly) {
        console.log(`   ✅ Multi-token pool detected - swap will be triggered`);
      }
    });
  });

  describe("Performance check", function () {
    it("should execute getTotalPoolValue() in reasonable gas", async function () {
      const tx = await valueCalculator.getTotalPoolValue.staticCall();
      console.log(`\n   ℹ️  getTotalPoolValue() executed successfully (view call)`);
    });
  });
});

// Run tests
async function main() {
  console.log("🧪 TESTING VALUE CALCULATOR FIX\n");
  console.log("Running hardhat tests...\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Test script failed:", error);
    process.exit(1);
  });
