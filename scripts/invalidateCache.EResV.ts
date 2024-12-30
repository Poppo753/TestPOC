import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { Log } from '@ethersproject/abstract-provider';
import { LogDescription } from '@ethersproject/abi';

dotenv.config();

const contractAddress = process.env.EthResVaultAdress!;
const abi = [
    "function getTotalPoolValue() external returns (uint256)",
    "function tokenCodes(uint256) external view returns (string)",
    "function tokenData(string) external view returns (address tokenAddress, uint8 tokenDecimals, string tokenCode, address priceFeed, uint8 priceFeedDecimals, bool isActive, uint256 lastPriceTimestamp, uint256 lastPrice, uint256 heartbeat)",
    "event PoolValueUpdated(uint256 totalValue)"
];

async function getTotalPoolValue() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        console.log('\n=== Getting Total Pool Value ===');

        // Get contract ETH balance
        const ethBalance = await provider.getBalance(contractAddress);
        console.log('\nContract ETH Balance:', ethers.formatEther(ethBalance), 'ETH');

        // Get total pool value
        console.log('\nCalculating total pool value...');
        const tx = await contract.getTotalPoolValue({
            gasLimit: 500000 // Adjust as needed
        });

        console.log('Transaction submitted:', tx.hash);
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            // Look for PoolValueUpdated event
            const poolValueEvent = receipt.logs
                .map((log: Log) => {
                    try {
                        return contract.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: LogDescription | null) => event?.name === 'PoolValueUpdated');

            if (poolValueEvent) {
                const totalValue = poolValueEvent.args.totalValue;
                console.log('\nPool Value Details:');
                console.log('Total Pool Value:', ethers.formatEther(totalValue), 'ETH');
                
                // Calculate and show difference from ETH balance
                const tokenValue = totalValue - ethBalance;
                console.log('\nBreakdown:');
                console.log('ETH Balance:', ethers.formatEther(ethBalance), 'ETH');
                console.log('Other Tokens Value:', ethers.formatEther(tokenValue), 'ETH');
                
                // Calculate percentage distribution
                const ethPercentage = (Number(ethBalance) * 100) / Number(totalValue);
                const tokenPercentage = (Number(tokenValue) * 100) / Number(totalValue);
                
                console.log('\nDistribution:');
                console.log(`ETH: ${ethPercentage.toFixed(2)}%`);
                console.log(`Other Tokens: ${tokenPercentage.toFixed(2)}%`);
            }
        } else {
            console.log('Failed to get pool value!');
        }

        console.log('\n=== Pool Value Calculation Complete ===');

    } catch (error: any) {
        console.error("Script failed:", error.message);
    }
}

// Execute if run directly
if (require.main === module) {
    getTotalPoolValue()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
