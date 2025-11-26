import { ethers } from "hardhat";

const ETH_USD_FEED = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";

async function main() {
  console.log("\n🔍 TEST ETH/USD FEED");
  console.log("=====================================\n");

  const feed = await ethers.getContractAt(
    [
      "function description() external view returns (string)",
      "function decimals() external view returns (uint8)",
      "function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)"
    ],
    ETH_USD_FEED
  );

  console.log(`Feed Address: ${ETH_USD_FEED}`);
  
  const description = await feed.description();
  console.log(`Description: ${description}`);
  
  const decimals = await feed.decimals();
  console.log(`Decimals: ${decimals}`);
  
  const roundData = await feed.latestRoundData();
  console.log(`\nLatest Round Data:`);
  console.log(`   roundId: ${roundData[0]}`);
  console.log(`   price: ${roundData[1]}`);
  console.log(`   startedAt: ${roundData[2]}`);
  console.log(`   updatedAt: ${roundData[3]}`);
  console.log(`   answeredInRound: ${roundData[4]}`);

  const price = roundData[1];
  const updatedAt = roundData[3];
  const answeredInRound = roundData[4];
  const roundId = roundData[0];

  console.log(`\nValidations:`);
  console.log(`   price > 0: ${price > 0 ? '✅' : '❌'}`);
  console.log(`   updatedAt > 0: ${updatedAt > 0 ? '✅' : '❌'}`);
  console.log(`   answeredInRound >= roundId: ${answeredInRound >= roundId ? '✅' : '❌'}`);

  const age = Math.floor((Date.now() / 1000) - Number(updatedAt));
  console.log(`   Age: ${age}s (${(age / 3600).toFixed(2)} hours)`);
  console.log(`   Fresh (< 24h): ${age < 86400 ? '✅' : '❌'}`);

  console.log(`\n✅ Feed is ${price > 0 && updatedAt > 0 && answeredInRound >= roundId ? 'VALID' : 'INVALID'}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
