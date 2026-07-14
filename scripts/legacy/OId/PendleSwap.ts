import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { BigNumberish } from "ethers";
dotenv.config();

async function main() {
    const pendleSwapAddress = "0x6783D8BD7E1ef3B1664e0b9aE2Cc59CF48772Dbd"; // Contratto deployato
    const tokenManagerAddress = "0xCcFB44a82335447260CD56540c02191109D3e9ED"; // Indirizzo del TokenPriceManager

    const isTokenInETH = false; // Imposta a true se tokenIn è ETH
    const tokenInAddress = isTokenInETH
        ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" // Indirizzo placeholder per ETH
        : "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // Token che vuoi scambiare
    const tokenOutCode = "wstETH"; // Codice identificativo del token in uscita
    const tokenOutAddress = "0x0fBcbaEA96Ce0cF7Ee00A8c19c3ab6f5Dc8E1921"; // Token che vuoi ricevere
    const amountIn = ethers.parseUnits("0.000001", 18); // Quantità di ETH/tokenIn da scambiare (es. 1.0)
    const receiver = "0x8390e98483a9b39265428c8610371134B5d11C3F"; // Chi riceverà i token scambiati
    const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // Deadline (10 minuti)

    // Inizializzazione del provider e del wallet
    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    // Connessione al TokenPriceManager
    const tokenManager = await ethers.getContractAt("TokenPriceManager", tokenManagerAddress);

    // Ottieni il prezzo del tokenOut
    console.log(`Fetching price for tokenOut (${tokenOutCode})...`);
    const priceRaw: bigint = await tokenManager.getTokenPrice(tokenOutCode);
    console.log(`Raw price of ${tokenOutCode}: ${priceRaw}`);

    // Calcola il minAmountOut con uno slippage dello 0,3%
    const slippagePercentage = 0.003; // 0,3%
    const slippageFactor = BigInt(Math.round((1 - slippagePercentage) * 1e8)); // Slippage come intero
    const priceWithSlippage = (priceRaw * slippageFactor) / BigInt(1e8);
    const minAmountOut = (amountIn * priceWithSlippage) / BigInt(10 ** 18);
    console.log(`Minimum amount out (with 0.3% slippage): ${minAmountOut}`);

    // Connessione al contratto PendleSwap
    const pendleSwapABI = [
        "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address receiver, uint256 deadline) external payable",
    ];
    const pendleSwap = new ethers.Contract(pendleSwapAddress, pendleSwapABI, wallet);

    // Eseguire lo swap
    console.log(`Executing swap with ETH as tokenIn...`);
    const swapTx = await pendleSwap.swap(
        tokenInAddress,
        tokenOutAddress,
        amountIn,
        minAmountOut,
        receiver,
        deadline,
        { value: amountIn } // Invio di ETH con la transazione
    );
    const receipt = await swapTx.wait();
    console.log("Swap executed successfully!");
    console.log(`Transaction Hash: ${receipt.transactionHash}`);
}

// Gestione degli errori
main().catch((error) => {
    console.error("Error in script execution:", error);
    process.exitCode = 1;
});
