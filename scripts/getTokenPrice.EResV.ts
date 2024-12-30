import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function checkAllPrices() {
    if (!process.env.ARBITRUM_RPC_URL) {
        throw new Error('ARBITRUM_RPC_URL not found in environment variables');
    }

    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    
    // Contract address
    const contractAddress = process.env.EthResVaultAdress!;

    // Contract ABI - only the functions we need
    const abi = [
        "function getTokenPrice(string memory _tokenCode) public view returns (uint256 price, uint256 updatedAt, bool isStale)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, provider);

    // List of tokens to check
    const tokens = ["wstETH", "weETH", "ezETH", "rsETH"];

    console.log("Checking prices (view function)...\n");

    for (const token of tokens) {
        try {
            const [price, timestamp, isStale] = await contract.getTokenPrice(token);
            
            // Format the timestamp to human-readable date
            const date = new Date(Number(timestamp) * 1000);
            
            // Format price to ETH (assuming 18 decimals)
            const priceInEth = ethers.formatUnits(price, 18);

            console.log(`Token: ${token}`);
            console.log(`Price: ${priceInEth} ETH`);
            console.log(`Updated: ${date.toLocaleString()}`);
            console.log(`Is Stale: ${isStale}`);
            console.log("------------------------");
        } catch (error: any) {
            console.error(`Error getting price for ${token}:`, error?.message || 'Unknown error');
            console.log("------------------------");
        }
    }
}

// Run the script
checkAllPrices().catch((error: any) => {
    console.error("Main error:", error?.message || 'Unknown error');
    process.exit(1);
});
