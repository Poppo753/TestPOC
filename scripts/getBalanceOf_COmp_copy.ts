import * as dotenv from "dotenv";
import { ethers } from "hardhat";

dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);

  const tokenAddress = "0x0B11d8d864A02B40970e1a39aaD4A20BdE4C0F95";
  const tokenAbi = [
    "function totalSupply() external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function balanceOf(address account) external view returns (uint256)",
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
  ];

  let totalSupply: bigint = BigInt(0);
  let decimals: number = 18;

  const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);

  try {
    totalSupply = BigInt((await tokenContract.totalSupply()).toString());
    decimals = await tokenContract.decimals();

    const formattedSupply = ethers.formatUnits(totalSupply, decimals);

    console.log(`Token Address: ${tokenAddress}`);
    console.log(`Total Supply (raw): ${totalSupply}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Formatted Total Supply: ${formattedSupply}`);
  } catch (error) {
    console.error("Errore durante il recupero dei dati:", error);
  }

  const accountAddress = "0x0B11d8d864A02B40970e1a39aaD4A20BdE4C0F95";

  const tokenAddresses = [
    "0x4186BFC76E2E237523CBC30FD220FE055156b41F",
    "0x0fBcbaEA96Ce0cF7Ee00A8c19c3ab6f5Dc8E1921",
    "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
    "0x2416092f143378750bb29b79eD961ab195CcEea5",
  ];

  try {
    const ethBalance = await provider.getBalance(accountAddress);
    const ethBalanceBigInt = BigInt(ethBalance.toString());
    const formattedEthBalance = ethers.formatEther(ethBalance);

    console.log(`ETH Balance (BigInt): ${ethBalanceBigInt}`);
    console.log(`ETH Balance (Formatted): ${formattedEthBalance} ETH`);

    let totalValueInEth = ethBalanceBigInt;

    for (const tokenAddress of tokenAddresses) {
      try {
        const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);

        const [balance, decimals, name, symbol] = await Promise.all([
          tokenContract.balanceOf(accountAddress),
          tokenContract.decimals(),
          tokenContract.name().catch(() => "Unknown Name"),
          tokenContract.symbol().catch(() => "Unknown Symbol"),
        ]);

        const rawBalance = BigInt(balance.toString());
        const decimalsBigInt = BigInt(10) ** BigInt(decimals);
        const formattedBalance = ethers.formatUnits(balance, decimals);

        console.log(`\nToken Address: ${tokenAddress}`);
        console.log(`Name: ${name}`);
        console.log(`Symbol: ${symbol}`);
        console.log(`Balance (BigInt): ${rawBalance}`);
        console.log(`Decimals: ${decimals}`);
        console.log(`Formatted Balance: ${formattedBalance}`);
      } catch (tokenError) {
        console.error(`Errore per il token ${tokenAddress}:`, tokenError);
      }
    }

    const contractAddress = "0xCcFB44a82335447260CD56540c02191109D3e9ED";
    const tokenManager = await ethers.getContractAt("TokenPriceManager", contractAddress);

    type TokenCode = "wstETH" | "weETH" | "ezETH" | "rsETH";
    const tokenCodes: TokenCode[] = ["wstETH", "weETH", "ezETH", "rsETH"];
    const tokenAddressesMap: Record<TokenCode, string> = {
      wstETH: "0x4186BFC76E2E237523CBC30FD220FE055156b41F",
      weETH: "0x0fBcbaEA96Ce0cF7Ee00A8c19c3ab6f5Dc8E1921",
      ezETH: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
      rsETH: "0x2416092f143378750bb29b79eD961ab195CcEea5",
    };

    for (const tokenCode of tokenCodes) {
      try {
        const price = await tokenManager.getTokenPrice(tokenCode);
        const tokenContract = new ethers.Contract(tokenAddressesMap[tokenCode], tokenAbi, provider);

        const [balance, tokenDecimals] = await Promise.all([
          tokenContract.balanceOf(accountAddress),
          tokenContract.decimals(),
        ]);

        const balanceBigInt = BigInt(balance.toString());
        const priceBigInt = BigInt(price.toString());
        const decimalsBigInt = BigInt(10) ** BigInt(tokenDecimals);

        const valueInEth = (balanceBigInt * priceBigInt) / decimalsBigInt;

        totalValueInEth += valueInEth;

        console.log(`\n${tokenCode}:`);
        console.log(`Balance: ${ethers.formatUnits(balance, tokenDecimals)}`);
        console.log(`Price: ${ethers.formatUnits(price, 18)} ETH`);
        console.log(`Value in ETH: ${ethers.formatUnits(valueInEth, 18)} ETH`);
      } catch (error) {
        console.error(`Failed to process ${tokenCode}:`, error);
      }
    }

    console.log("\nTotal Values:");
    console.log(`Total Value in ETH: ${ethers.formatUnits(totalValueInEth, 18)} ETH`);

    if (totalSupply > BigInt(0)) {
      const decimalsBigInt = BigInt(10) ** BigInt(decimals);
      const valuePerToken = (totalValueInEth * decimalsBigInt) / totalSupply;
      console.log(`Value per Token: ${ethers.formatUnits(valuePerToken, 18)} ETH`);
    } else {
      console.error("Total supply is zero, cannot calculate value per token.");
    }
  } catch (error) {
    console.error("Errore durante l'interrogazione dei saldi o calcoli:", error);
  }
}

main().catch((error) => {
  console.error("Errore nello script:", error);
  process.exit(1);
});
