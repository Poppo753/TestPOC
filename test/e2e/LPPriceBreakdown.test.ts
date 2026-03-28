import { ethers } from "hardhat";

/**
 * Test: Log current LP price (ETH per LP token)
 * - Mostra valore totale pool in ETH
 * - Mostra total supply LP tokens
 * - Calcola e mostra LP price (ETH per LP token)
 */

describe("E2E: LP Price Breakdown", function () {
  this.timeout(600000);

  // Mainnet deployed addresses
  const VALUE_CALCULATOR_ADDRESS = "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B";
  const PROXY_GENERAL_ADDRESS = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

  it("Should log current LP price (ETH per LP token)", async function () {
    // Get contracts
    const valueCalculator = await ethers.getContractAt("ValueCalculator", VALUE_CALCULATOR_ADDRESS);
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", PROXY_GENERAL_ADDRESS);

    // Get total pool value
    const totalPoolValue = await valueCalculator.getTotalPoolValueView();
    console.log(`\n📊 Pool Stats:`);
    console.log(`Total Pool Value: ${ethers.formatEther(totalPoolValue)} ETH`);
    console.log(`Raw value: ${totalPoolValue}`);

    // Get total LP supply
    const totalSupply = await proxyGeneral.totalSupply();
    console.log(`\nTotal LP Supply: ${ethers.formatEther(totalSupply)} LP tokens`);
    console.log(`Raw supply: ${totalSupply}`);

    // Calculate LP price
    if (totalSupply > 0n) {
      const lpPrice = (totalPoolValue * ethers.parseEther("1")) / totalSupply;
      console.log(`\n💎 LP Token Price:`);
      console.log(`${ethers.formatEther(lpPrice)} ETH per LP token`);
      console.log(`Raw LP price: ${lpPrice}`);
      
      // Show what 1 LP is worth
      console.log(`\n📈 Value breakdown:`);
      console.log(`1 LP token = ${ethers.formatEther(lpPrice)} ETH`);
      console.log(`10 LP tokens = ${ethers.formatEther(lpPrice * 10n)} ETH`);
      console.log(`100 LP tokens = ${ethers.formatEther(lpPrice * 100n)} ETH`);
    } else {
      console.log("\n⚠️ No LP tokens in circulation, LP price undefined.");
    }
  });
});
