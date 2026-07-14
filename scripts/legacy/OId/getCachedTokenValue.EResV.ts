import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const contractAddress = process.env.EthResVaultAdress!;
const abi = [
    "function getCachedTokenValue(string memory _tokenCode) public view returns (uint256 value, bool isValid)",
    "function CACHE_DURATION() public view returns (uint256)"
];

async function checkCachedValues() {
    if (!process.env.ARBITRUM_RPC_URL) {
        throw new Error('ARBITRUM_RPC_URL not found in environment variables');
    }

    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const tokens = ["wstETH", "weETH", "ezETH", "rsETH"];

    console.log("Checking cached values...\n");

    // Get cache duration and convert BigInt to number
    const cacheDuration = await contract.CACHE_DURATION();
    console.log(`Cache Duration: ${Number(cacheDuration) / 60} minutes\n`);

    for (const token of tokens) {
        try {
            console.log(`Checking cache for ${token}...`);
            
            const [value, isValid] = await contract.getCachedTokenValue(token);
            
            console.log(`Token: ${token}`);
            if (isValid) {
                const valueInEth = ethers.formatUnits(value, 18);
                console.log(`Cached Value: ${valueInEth} ETH`);
                console.log(`Cache Status: Valid`);
            } else {
                console.log(`Cache Status: Invalid or expired`);
                if (value === BigInt(0)) {
                    console.log(`No cached value available`);
                }
            }
            console.log("------------------------");

        } catch (error: any) {
            console.error(`Error checking cache for ${token}:`, error?.message || 'Unknown error');
            console.log("------------------------");
        }
    }
}

function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

async function monitorCacheStatus(duration: number = 300) {
    if (!process.env.ARBITRUM_RPC_URL) {
        throw new Error('ARBITRUM_RPC_URL not found in environment variables');
    }

    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    const contract = new ethers.Contract(contractAddress, abi, provider);
    const tokens = ["wstETH", "weETH", "ezETH", "rsETH"];

    console.log(`Starting cache monitor for ${formatDuration(duration)}`);
    console.log("Press Ctrl+C to stop\n");

    const startTime = Date.now();
    const checkInterval = 30;

    while ((Date.now() - startTime) / 1000 < duration) {
        console.clear();
        console.log(`Cache Monitor - Running for ${formatDuration(Math.floor((Date.now() - startTime) / 1000))}`);
        console.log("========================");

        for (const token of tokens) {
            try {
                const [value, isValid] = await contract.getCachedTokenValue(token);
                console.log(`\n${token}:`);
                console.log(`Status: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
                if (isValid) {
                    const valueInEth = ethers.formatUnits(value, 18);
                    console.log(`Value: ${valueInEth} ETH`);
                }
            } catch (error: any) {
                console.log(`\n${token}: ⚠️ Error checking cache`);
            }
        }

        console.log("\n========================");
        await new Promise(resolve => setTimeout(resolve, checkInterval * 1000));
    }

    console.log("\nMonitoring completed!");
}

console.log("Running basic cache check...\n");
checkCachedValues()
    .then(() => {
        console.log("\nWould you like to monitor cache status? (y/n)");
        process.stdin.once('data', (data) => {
            const answer = data.toString().trim().toLowerCase();
            if (answer === 'y') {
                console.log("\nStarting cache monitor...");
                monitorCacheStatus()
                    .then(() => process.exit(0))
                    .catch(error => {
                        console.error("Monitor error:", error);
                        process.exit(1);
                    });
            } else {
                process.exit(0);
            }
        });
    })
    .catch((error: any) => {
        console.error("Main error:", error?.message || 'Unknown error');
        process.exit(1);
    });
