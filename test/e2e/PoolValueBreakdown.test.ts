import { ethers } from "hardhat";

/**
 * Test: Log pool value breakdown (ETH, USDC, WBTC)
 * - Mostra valore totale pool in ETH
 * - Mostra valore di ogni token attivo
 * - Mostra balances e prezzi usati
 */

describe("E2E: Pool Value Breakdown", function () {
  this.timeout(600000);

  // Mainnet deployed addresses
  const VALUE_CALCULATOR_ADDRESS = "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B";
  const TOKEN_MANAGER_ADDRESS = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
  const PROXY_GENERAL_ADDRESS = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
  const ARBITRUM_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const ARBITRUM_WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

  it("Should log pool value and breakdown for all active tokens", async function () {
    const valueCalculator = await ethers.getContractAt("ValueCalculator", VALUE_CALCULATOR_ADDRESS);
    const tokenManager = await ethers.getContractAt("TokenManager", TOKEN_MANAGER_ADDRESS);
    const proxyGeneral = PROXY_GENERAL_ADDRESS;

    // Get total pool value (detailed)
    const poolValueInfo = await valueCalculator.getTotalPoolValue();
    const totalValue = poolValueInfo.totalValue;
    console.log(`\nTotal pool value: ${ethers.formatEther(totalValue)} ETH`);

    // Breakdown per token
    for (const tokenInfo of poolValueInfo.tokenValues) {
      const code = tokenInfo.tokenCode;
      const value = tokenInfo.value;
      const decimals = tokenInfo.tokenDecimals;
      const balance = tokenInfo.balance;
      console.log(`Token: ${code}`);
      console.log(`  Balance: ${ethers.formatUnits(balance, decimals)}`);
      console.log(`  Value in ETH: ${ethers.formatEther(value)}`);
    }

    // Log actual balances for WETH, USDC, WBTC
    const wethContract = await ethers.getContractAt("IERC20", ARBITRUM_WETH);
    const usdcContract = await ethers.getContractAt("IERC20", ARBITRUM_USDC);
    const wbtcContract = await ethers.getContractAt("IERC20", ARBITRUM_WBTC);
    const wethBalance = await wethContract.balanceOf(proxyGeneral);
    const usdcBalance = await usdcContract.balanceOf(proxyGeneral);
    const wbtcBalance = await wbtcContract.balanceOf(proxyGeneral);
    console.log(`\nActual balances:`);
    console.log(`  WETH: ${ethers.formatEther(wethBalance)}`);
    console.log(`  USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
    console.log(`  WBTC: ${ethers.formatUnits(wbtcBalance, 8)}`);
  });
});
