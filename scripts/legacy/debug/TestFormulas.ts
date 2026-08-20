import { ethers } from "hardhat";

async function main() {
  console.log("\n🧮 VALUE CALCULATION FORMULAS TEST");
  console.log("=".repeat(80) + "\n");

  // USDC data
  const tokenBalance = 3564923n;  // raw balance (6 decimals)
  const price = 339263172768298n;  // wei per 1 USDC intero
  const tokenDecimals = 6n;
  const expectedValue = 1209000000000000n;  // ~0.001209 ETH in wei

  console.log("📊 Inputs:");
  console.log(`   Token Balance: ${tokenBalance} (${ethers.formatUnits(tokenBalance, Number(tokenDecimals))} USDC)`);
  console.log(`   Price: ${price} wei (${ethers.formatEther(price)} ETH per USDC)`);
  console.log(`   Token Decimals: ${tokenDecimals}`);
  console.log(`   Expected Value: ${expectedValue} wei (${ethers.formatEther(expectedValue)} ETH)\n`);

  // Formula 1: Current formula
  const value1 = (tokenBalance * price) / (10n ** tokenDecimals);
  console.log(`Formula 1: (balance * price) / 10^decimals`);
  console.log(`   Result: ${value1} wei (${ethers.formatEther(value1)} ETH)`);
  console.log(`   Match: ${value1 === expectedValue ? '✅' : '❌'}\n`);

  // Formula 2: Divide by 1e18
  const value2 = (tokenBalance * price) / 10n**18n;
  console.log(`Formula 2: (balance * price) / 1e18`);
  console.log(`   Result: ${value2} wei (${ethers.formatEther(value2)} ETH)`);
  console.log(`   Match: ${value2 === expectedValue ? '✅' : '❌'}\n`);

  // Formula 3: Divide by both
  const value3 = (tokenBalance * price) / (10n ** tokenDecimals) / 10n**18n;
  console.log(`Formula 3: (balance * price) / 10^decimals / 1e18`);
  console.log(`   Result: ${value3} wei (${ethers.formatEther(value3)} ETH)`);
  console.log(`   Match: ${value3 === expectedValue ? '✅' : '❌'}\n`);

  // Formula 4: Don't divide
  const value4 = tokenBalance * price;
  console.log(`Formula 4: balance * price (no division)`);
  console.log(`   Result: ${value4} wei (${ethers.formatEther(value4)} ETH)`);
  console.log(`   Match: ${value4 === expectedValue ? '✅' : '❌'}\n`);

  // Formula 5: Multiply by 1e18
  const value5 = (tokenBalance * price) * 10n**18n / (10n ** tokenDecimals);
  console.log(`Formula 5: (balance * price * 1e18) / 10^decimals`);
  console.log(`   Result: ${value5} wei (${ethers.formatEther(value5)} ETH)`);
  console.log(`   Match: ${value5 === expectedValue ? '✅' : '❌'}\n`);

  // Formula 6: Adjust for both decimals
  const value6 = (tokenBalance * price) * (10n ** (18n - tokenDecimals)) / 10n**18n;
  console.log(`Formula 6: (balance * price * 10^(18-decimals)) / 1e18`);
  console.log(`   Result: ${value6} wei (${ethers.formatEther(value6)} ETH)`);
  console.log(`   Match: ${value6 === expectedValue ? '✅' : '❌'}\n`);

  console.log("=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
