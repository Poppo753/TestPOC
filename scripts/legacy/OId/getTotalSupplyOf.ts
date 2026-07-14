import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    // Configura la rete e il provider
    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);

    // Indirizzo del token
    const tokenAddress = "0x0B11d8d864A02B40970e1a39aaD4A20BdE4C0F95";

    // ABI minimale per interagire con un token ERC-20
    const tokenAbi = [
        "function totalSupply() external view returns (uint256)",
        "function decimals() external view returns (uint8)"
    ];

    // Creazione del contratto ERC-20
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);

    try {
        // Chiamata alle funzioni `totalSupply` e `decimals`
        const totalSupply = await tokenContract.totalSupply();
        const decimals = await tokenContract.decimals();

        // Conversione del totalSupply in formato leggibile
        const formattedSupply = ethers.formatUnits(totalSupply, decimals);

        console.log(`Token Address: ${tokenAddress}`);
        console.log(`Total Supply (raw): ${totalSupply}`);
        console.log(`Decimals: ${decimals}`);
        console.log(`Formatted Total Supply: ${formattedSupply}`);
    } catch (error) {
        console.error("Errore durante il recupero dei dati:", error);
    }
}

main().catch((error) => {
    console.error("Errore nello script:", error);
    process.exit(1);
});
