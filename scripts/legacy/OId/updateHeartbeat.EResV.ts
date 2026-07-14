import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { Log } from '@ethersproject/abstract-provider';
import { LogDescription } from '@ethersproject/abi';

dotenv.config();

// Run the script with token code and new heartbeat (in seconds)
// ts-node update-heartbeat.ts "WETH" "3600"  # Updates WETH heartbeat to 1 hour

const contractAddress = process.env.EthResVaultAdress!;
const abi = [
    "function updateHeartbeat(string memory _tokenCode, uint256 _newHeartbeat) external",
    "function owner() external view returns (address)",
    "function tokenData(string) external view returns (address tokenAddress, uint8 tokenDecimals, string tokenCode, address priceFeed, uint8 priceFeedDecimals, bool isActive, uint256 lastPriceTimestamp, uint256 lastPrice, uint256 heartbeat)",
    "event HeartbeatUpdated(string tokenCode, uint256 newHeartbeat)"
];

async function updateHeartbeat(tokenCode: string, newHeartbeat: string) {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        console.log('\n=== Starting Heartbeat Update Process ===');

        // Check if caller is owner
        const contractOwner = await contract.owner();
        if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error('Error: Caller is not the contract owner');
            console.log('Contract owner:', contractOwner);
            console.log('Caller address:', wallet.address);
            return;
        }

        // Convert heartbeat to BigNumber and validate
        const heartbeatBN = ethers.parseUnits(newHeartbeat, 0);
        if (heartbeatBN <= BigInt(0)) {
            console.error('Error: Heartbeat must be greater than 0');
            return;
        }

        // Get current token data
        const tokenInfo = await contract.tokenData(tokenCode);
        console.log('\nCurrent Token Status:');
        console.log(`Token Code: ${tokenCode}`);
        console.log(`Current Heartbeat: ${tokenInfo.heartbeat.toString()} seconds`);
        console.log(`Is Active: ${tokenInfo.isActive}`);

        if (!tokenInfo.isActive) {
            console.error('Error: Token is not active');
            return;
        }

        // Execute heartbeat update
        console.log(`\nUpdating heartbeat to ${newHeartbeat} seconds...`);
        const tx = await contract.updateHeartbeat(tokenCode, heartbeatBN, {
            gasLimit: 200000 // Adjust as needed
        });

        console.log('Transaction submitted:', tx.hash);
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log('Heartbeat update successful!');

            // Verify updated heartbeat
            const updatedTokenInfo = await contract.tokenData(tokenCode);
            console.log('\nUpdated Token Status:');
            console.log(`Token Code: ${tokenCode}`);
            console.log(`New Heartbeat: ${updatedTokenInfo.heartbeat.toString()} seconds`);

            // Look for HeartbeatUpdated event
            const heartbeatEvent = receipt.logs
                .map((log: Log) => {
                    try {
                        return contract.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: LogDescription | null) => event?.name === 'HeartbeatUpdated');

            if (heartbeatEvent) {
                console.log('\nEvent emitted:');
                console.log('Token:', heartbeatEvent.args.tokenCode);
                console.log('New Heartbeat:', heartbeatEvent.args.newHeartbeat.toString(), 'seconds');
            }
        } else {
            console.log('Heartbeat update failed!');
        }

        console.log('\n=== Heartbeat Update Process Complete ===');

    } catch (error: any) {
        console.error("Script failed:", error.message);
    }
}

// Execute the heartbeat update if run directly
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length !== 2) {
        console.error('Usage: ts-node update-heartbeat.ts <tokenCode> <newHeartbeat>');
        console.error('Example: ts-node update-heartbeat.ts "WETH" "3600"');
        process.exit(1);
    }

    const [tokenCode, newHeartbeat] = args;
    updateHeartbeat(tokenCode, newHeartbeat)
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
