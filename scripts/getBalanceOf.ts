import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Funzione per formattare un numero come stringa con separatori per migliaia
function formatBigInt(bigintValue: bigint, decimals: number): string {
    // Dividi per 10^decimals per ottenere il valore reale
    const divisor = BigInt(10) ** BigInt(decimals);
    const wholePart = bigintValue / divisor;
    const fractionalPart = bigintValue % divisor;

    // Formattazione della parte intera con separatori per migliaia
    const formattedWhole = Intl.NumberFormat("en-US").format(Number(wholePart));

    // Formattazione della parte frazionaria
    const fractionalString = fractionalPart.toString().padStart(decimals, "0");

    return `${formattedWhole}.${fractionalString}`;
}

async function main() {
    // Configura il provider
    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);

    // Indirizzo del portafoglio o contratto di cui vuoi conoscere il saldo
    const accountAddress = "0x0B11d8d864A02B40970e1a39aaD4A20BdE4C0F95";

    // Lista di contratti dei token ERC-20
    const tokenAddresses = [
        "0x4186BFC76E2E237523CBC30FD220FE055156b41F", // Token 1
        "0x0fBcbaEA96Ce0cF7Ee00A8c19c3ab6f5Dc8E1921", // Token 2
        "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe", // Token 3
        "0x2416092f143378750bb29b79eD961ab195CcEea5"  // Token 4
    ];

    // ABI minima per le funzioni balanceOf e decimals
    const tokenAbi = [
        "function balanceOf(address account) external view returns (uint256)",
        "function decimals() external view returns (uint8)",
        "function name() external view returns (string)", // Facoltativo
        "function symbol() external view returns (string)" // Facoltativo
    ];

    try {
        // Ottieni il saldo in ETH
        const ethBalance = await provider.getBalance(accountAddress);
        const formattedEthBalance = formatBigInt(BigInt(ethBalance.toString()), 18);

        console.log(`ETH Balance: ${formattedEthBalance} ETH`);

        // Interroga i saldi dei token in parallelo usando Promise.all
        const tokenBalances = await Promise.all(
            tokenAddresses.map(async (tokenAddress) => {
                try {
                    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);

                    // Chiamate alle funzioni balanceOf e decimals
                    const [balance, decimals, name, symbol] = await Promise.all([
                        tokenContract.balanceOf(accountAddress),
                        tokenContract.decimals(),
                        tokenContract.name().catch(() => "Unknown Name"), // Opzionale
                        tokenContract.symbol().catch(() => "Unknown Symbol") // Opzionale
                    ]);

                    // Formattazione del saldo
                    const formattedBalance = formatBigInt(BigInt(balance.toString()), decimals);

                    return {
                        tokenAddress,
                        name,
                        symbol,
                        rawBalance: balance.toString(),
                        decimals,
                        formattedBalance,
                    };
                } catch (tokenError) {
                    const errorMessage = tokenError instanceof Error ? tokenError.message : String(tokenError);
                    console.error(`Errore per il token ${tokenAddress}:`, errorMessage);
                    return { tokenAddress, error: errorMessage };
                }
            })
        );

        // Stampa i risultati
        for (const result of tokenBalances) {
            if (result.error) {
                console.error(`Token Address: ${result.tokenAddress}, Errore: ${result.error}`);
            } else {
                console.log(`\nToken Address: ${result.tokenAddress}`);
                console.log(`Name: ${result.name}`);
                console.log(`Symbol: ${result.symbol}`);
                console.log(`Balance (raw): ${result.rawBalance}`);
                console.log(`Decimals: ${result.decimals}`);
                console.log(`Formatted Balance: ${result.formattedBalance}`);
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Errore durante l'interrogazione dei saldi:", errorMessage);
    }
}

main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Errore nello script:", errorMessage);
    process.exit(1);
});
