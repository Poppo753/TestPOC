import { ethers } from 'ethers';
import { AlphaRouter, SwapOptionsSwapRouter02, SwapType } from '@uniswap/smart-order-router';
import { CurrencyAmount, Percent, Token } from '@uniswap/sdk-core';
import JSBI from 'jsbi';
import { ChainId } from '@uniswap/sdk-core';

// Configurazione
const RPC_URL = 'https://arb1.arbitrum.io/rpc';
const PRIVATE_KEY = 'LA_TUA_CHIAVE_PRIVATA';
const TOKEN_IN_ADDRESS = '0x...'; // Indirizzo del token di input
const TOKEN_OUT_ADDRESS = '0x...'; // Indirizzo del token di output
const AMOUNT_IN = '0.01'; // Quantità del token di input da swappare
const SLIPPAGE_TOLERANCE = 50; // Tolleranza di slippage in basis points (0.50%)
const DEADLINE = 1800; // Scadenza in secondi (30 minuti)

// Provider e Wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Informazioni sui token
const chainId = ChainId.ARBITRUM_ONE;
const decimals = 18;
const tokenIn = new Token(chainId, TOKEN_IN_ADDRESS, decimals, 'TOKEN_IN_SYMBOL', 'Token In Name');
const tokenOut = new Token(chainId, TOKEN_OUT_ADDRESS, decimals, 'TOKEN_OUT_SYMBOL', 'Token Out Name');

// Router
const router = new AlphaRouter({ chainId, provider });

async function main() {
  const amountInRaw = JSBI.BigInt(ethers.parseUnits(AMOUNT_IN, decimals).toString());
  const currencyAmountIn = CurrencyAmount.fromRawAmount(tokenIn, amountInRaw);

  const swapOptions = {
    recipient: wallet.address,
    slippageTolerance: new Percent(SLIPPAGE_TOLERANCE, 10_000),
    deadline: Math.floor(Date.now() / 1000) + DEADLINE,
    type: "exactIn", // Tipo aggiornato
  };

  const route = await router.route(currencyAmountIn, tokenOut, "exactIn", swapOptions);

  if (route && route.methodParameters) {
    const transaction = {
      data: route.methodParameters.calldata,
      to: route.methodParameters.router,
      value: ethers.BigInt(route.methodParameters.value),
      from: wallet.address,
      gasPrice: ethers.BigInt(route.gasPriceWei.toString()),
      gasLimit: ethers.BigInt(route.estimatedGasUsed.toString()),
    };

    const txResponse = await wallet.sendTransaction(transaction);
    console.log(`Transazione inviata: ${txResponse.hash}`);

    const receipt = await txResponse.wait();
    console.log(`Transazione confermata nel blocco ${receipt.blockNumber}`);
  } else {
    console.error('Non è stato possibile trovare una rotta per lo swap.');
  }
}

main().catch((error) => {
  console.error('Errore durante l\'esecuzione dello swap:', error);
});
