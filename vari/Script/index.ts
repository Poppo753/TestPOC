import axios from "axios";

async function get1InchQuote(amountIn: string, tokenIn: string, tokenOut: string) {
    const chainId = 42161; // Arbitrum chain ID
    const url = `https://api.1inch.io/v5.0/42161/quote`;

    try {
        const response = await axios.get(url, {
            params: {
                fromTokenAddress: tokenIn, // Indirizzo del token di input (es. ETH)
                toTokenAddress: tokenOut, // Indirizzo del token di output (es. USDC)
                amount: amountIn,         // Quantità di token di input (in wei)
            },
        });
        return response.data; // Ritorna i dati della risposta
    } catch (error) {
        console.error("Errore durante il recupero del preventivo:", error);
        throw error;
    }
}

(async () => {
    const ethAmount = "1000000000000000000"; // 1 ETH in wei
    const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; // ETH
    const usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // USDC

    const quote = await get1InchQuote(ethAmount, ethAddress, usdcAddress);
    console.log("Preventivo:", quote);
})();
