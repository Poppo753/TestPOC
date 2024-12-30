import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function checkAllPricesWithEvents() {
    if (!process.env.ARBITRUM_RPC_URL) {
        throw new Error('ARBITRUM_RPC_URL not found in environment variables');
    }

    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    
    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in environment variables');
    }
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const contractAddress = process.env.EthResVaultAdress!;

    const abi = [
        "function getTokenPriceWithEvents(string memory _tokenCode) public returns (uint256 price, uint256 updatedAt)",
        "event PriceStale(string indexed tokenCode, uint256 timestamp)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, wallet);

    const tokens = ["wstETH", "weETH", "ezETH", "rsETH"];

    console.log("Checking prices with events...\n");

    // Set up event listener for stale prices
    contract.on("PriceStale", (tokenCode: string, timestamp: bigint) => {
        console.log(`\nSTALE PRICE ALERT!`);
        console.log(`Token: ${tokenCode}`);
        console.log(`Last Update: ${new Date(Number(timestamp) * 1000).toLocaleString()}`);
        console.log("------------------------");
    });

    for (const token of tokens) {
        try {
            console.log(`Checking ${token}...`);
            
            // Call the function to get the price
            const [price, updatedAt] = await contract.getTokenPriceWithEvents.staticCall(token);
            
            // Now send the transaction to trigger any potential events
            const tx = await contract.getTokenPriceWithEvents(token, {
                nonce: await wallet.getNonce()
            });
            console.log(`Transaction sent: ${tx.hash}`);
            
            // Wait for transaction to be mined
            const receipt = await tx.wait();

            // Format the values
            const date = new Date(Number(updatedAt) * 1000);
            const priceInEth = ethers.formatUnits(price, 18);

            console.log(`Token: ${token}`);
            console.log(`Price: ${priceInEth} ETH`);
            console.log(`Updated: ${date.toLocaleString()}`);
            console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
            console.log("------------------------");

            // Add a small delay between transactions
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error: any) {
            console.error(`Error getting price for ${token}:`, error?.message || 'Unknown error');
            console.log("------------------------");
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log("\nWaiting for any stale price events...");
    await new Promise(resolve => setTimeout(resolve, 15000));

    contract.removeAllListeners();
    console.log("Script completed.");
}

checkAllPricesWithEvents().catch((error: any) => {
    console.error("Main error:", error?.message || 'Unknown error');
    process.exit(1);
});
