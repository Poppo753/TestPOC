import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const contractAddress = process.env.EthResVaultAdress!;
const abi = [
    "function getTokenCount() external view returns (uint256)",
    "function tokenCodes(uint256) external view returns (string)",
    "function tokenData(string) external view returns (address tokenAddress, uint8 tokenDecimals, string tokenCode, address priceFeed, uint8 priceFeedDecimals, bool isActive, uint256 lastPriceTimestamp, uint256 lastPrice, uint256 heartbeat)"
];

async function getTokenCount() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const contract = new ethers.Contract(contractAddress, abi, provider);

        console.log('\n=== Getting Token Count ===');

        // Get token count
        const count = await contract.getTokenCount();
        console.log('\nTotal number of tokens:', count.toString());

        // Optional: Get details of each token
        if (count > 0) {
            console.log('\nToken Details:');
            console.log('-------------');

            for (let i = 0; i < Number(count); i++) {
                try {
                    const tokenCode = await contract.tokenCodes(i);
                    const tokenInfo = await contract.tokenData(tokenCode);

                    console.log(`\nToken ${i + 1}:`);
                    console.log(`Code: ${tokenCode}`);
                    console.log(`Address: ${tokenInfo.tokenAddress}`);
                    console.log(`Active: ${tokenInfo.isActive}`);
                    console.log(`Decimals: ${tokenInfo.tokenDecimals}`);
                    console.log(`Price Feed: ${tokenInfo.priceFeed}`);
                    console.log('-------------');
                } catch (error) {
                    console.log(`Error fetching details for token index ${i}`);
                }
            }

            // Calculate active tokens
            let activeCount = 0;
            for (let i = 0; i < Number(count); i++) {
                const tokenCode = await contract.tokenCodes(i);
                const tokenInfo = await contract.tokenData(tokenCode);
                if (tokenInfo.isActive) activeCount++;
            }

            console.log('\nSummary:');
            console.log(`Total Tokens: ${count.toString()}`);
            console.log(`Active Tokens: ${activeCount}`);
            console.log(`Inactive Tokens: ${Number(count) - activeCount}`);
        }

        console.log('\n=== Token Count Process Complete ===');

    } catch (error: any) {
        console.error("Script failed:", error.message);
    }
}

// Execute if run directly
if (require.main === module) {
    getTokenCount()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
