import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const contractAddress = process.env.EthResVaultAdress!;
const abi = [
    "function getActiveTokens() external view returns (string[] memory)",
    "function tokenData(string) external view returns (address tokenAddress, uint8 tokenDecimals, string tokenCode, address priceFeed, uint8 priceFeedDecimals, bool isActive, uint256 lastPriceTimestamp, uint256 lastPrice, uint256 heartbeat)"
];

async function getActiveTokens() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const contract = new ethers.Contract(contractAddress, abi, provider);

        console.log('\n=== Getting Active Tokens ===');

        // Get active tokens
        const activeTokens = await contract.getActiveTokens();
        console.log('\nNumber of active tokens:', activeTokens.length);

        if (activeTokens.length > 0) {
            console.log('\nActive Token Details:');
            console.log('-------------------');

            // Get detailed information for each active token
            for (let i = 0; i < activeTokens.length; i++) {
                const tokenCode: string = activeTokens[i];
                const tokenInfo = await contract.tokenData(tokenCode);

                console.log(`\nToken ${i + 1}:`);
                console.log(`Code: ${tokenCode}`);
                console.log(`Address: ${tokenInfo.tokenAddress}`);
                console.log(`Decimals: ${tokenInfo.tokenDecimals}`);
                console.log(`Price Feed: ${tokenInfo.priceFeed}`);
                console.log(`Price Feed Decimals: ${tokenInfo.priceFeedDecimals}`);
                console.log(`Last Price: ${ethers.formatUnits(tokenInfo.lastPrice, tokenInfo.priceFeedDecimals)}`);
                console.log(`Last Price Update: ${new Date(Number(tokenInfo.lastPriceTimestamp) * 1000).toLocaleString()}`);
                console.log(`Heartbeat: ${tokenInfo.heartbeat.toString()} seconds`);
                console.log('-------------------');
            }

            // Additional statistics
            console.log('\nSummary Statistics:');
            console.log(`Total Active Tokens: ${activeTokens.length}`);
            
            // Check last price updates
            const now = Math.floor(Date.now() / 1000);
            const staleTokens = await Promise.all(
                activeTokens.map(async (tokenCode: string) => {
                    const tokenInfo = await contract.tokenData(tokenCode);
                    return now - Number(tokenInfo.lastPriceTimestamp) > Number(tokenInfo.heartbeat);
                })
            );

            const staleTokenCount = staleTokens.filter(Boolean).length;
            if (staleTokenCount > 0) {
                console.log(`\nWarning: ${staleTokenCount} tokens have stale prices!`);
            }
        } else {
            console.log('\nNo active tokens found in the pool');
        }

        console.log('\n=== Active Tokens Process Complete ===');

    } catch (error: any) {
        console.error("Script failed:", error.message);
    }
}

// Execute if run directly
if (require.main === module) {
    getActiveTokens()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
