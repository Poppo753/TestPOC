import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function getAllTokenInfo(contractAddress: string) {
    if (!process.env.ARBITRUM_RPC_URL) {
        throw new Error('ARBITRUM_RPC_URL not found in environment variables');
    }

    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    
    const abi = [
        "function tokenCodes(uint256) public view returns (string)",
        "function tokenData(string) public view returns (address tokenAddress, uint8 tokenDecimals, string tokenCode, address priceFeed, uint8 priceFeedDecimals, bool isActive, uint256 lastPriceTimestamp, uint256 lastPrice, uint256 heartbeat)",
        "function tokenCodesCount() public view returns (uint256)"  // Changed to use the counter
    ];

    const contract = new ethers.Contract(contractAddress, abi, provider);

    try {
        // Get the total number of tokens using the counter
        const tokenCount = await contract.tokenCodesCount();
        console.log(`Total tokens in pool: ${tokenCount.toString()}`);
        
        const tokens = [];
        
        // Iterate through tokens using the counter
        for (let i = 0; i < tokenCount; i++) {
            try {
                const tokenCode = await contract.tokenCodes(i);
                console.log(`Processing token ${i + 1}/${tokenCount}: ${tokenCode}`);
                
                const tokenInfo = await contract.tokenData(tokenCode);
                console.log(`Token info for ${tokenCode}:`, tokenInfo);
                
                // Only add active tokens
                if (tokenInfo.isActive) {
                    tokens.push({
                        index: i,
                        tokenCode: tokenCode,
                        tokenAddress: tokenInfo.tokenAddress,
                        tokenDecimals: tokenInfo.tokenDecimals,
                        priceFeed: tokenInfo.priceFeed,
                        priceFeedDecimals: tokenInfo.priceFeedDecimals,
                        isActive: tokenInfo.isActive,
                        lastPriceTimestamp: tokenInfo.lastPriceTimestamp.toString(),
                        lastPrice: tokenInfo.lastPrice.toString(),
                        heartbeat: tokenInfo.heartbeat.toString()
                    });
                }
            } catch (error) {
                console.warn(`Warning: Error processing token at index ${i}:`, error);
                continue;
            }
        }

        console.log(`Successfully processed ${tokens.length} active tokens`);
        return tokens;
    } catch (error) {
        console.error("Error fetching token info:", error);
        throw error;
    }
}

async function main() {
    const contractAddress = process.env.EthResVaultAdress!;

    try {
        const tokenInfo = await getAllTokenInfo(contractAddress);
    } catch (error) {
        console.error("Main error:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
