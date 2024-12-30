import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { Log, TransactionReceipt } from '@ethersproject/abstract-provider';
import { LogDescription } from '@ethersproject/abi';

dotenv.config();


// Run the script with the token code
// ts-node remove-token.ts "WETH"  # Replace WETH with your token code


const contractAddress = process.env.EthResVaultAdress!;
const abi = [
    "function removeToken(string memory _tokenCode) external",
    "function owner() external view returns (address)",
    "function tokenData(string) external view returns (address tokenAddress, uint8 tokenDecimals, string tokenCode, address priceFeed, uint8 priceFeedDecimals, bool isActive, uint256 lastPriceTimestamp, uint256 lastPrice, uint256 heartbeat)",
    "function tokenCodes(uint256) external view returns (string)",
    "event TokenRemoved(string tokenCode)"
];

async function removeToken(tokenCode: string) {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        console.log('\n=== Starting Token Removal Process ===');

        // Check if caller is owner
        const contractOwner = await contract.owner();
        if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error('Error: Caller is not the contract owner');
            console.log('Contract owner:', contractOwner);
            console.log('Caller address:', wallet.address);
            return;
        }

        // Check if token exists and is active
        const tokenInfo = await contract.tokenData(tokenCode);
        console.log('\nCurrent Token Status:');
        console.log(`Token Code: ${tokenCode}`);
        console.log(`Token Address: ${tokenInfo.tokenAddress}`);
        console.log(`Is Active: ${tokenInfo.isActive}`);

        if (!tokenInfo.isActive) {
            console.log('Token is already inactive');
            return;
        }

        // Execute token removal
        console.log('\nRemoving token...');
        const tx = await contract.removeToken(tokenCode, {
            gasLimit: 300000 // Adjust as needed
        });

        console.log('Transaction submitted:', tx.hash);
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log('Token removal successful!');

            // Verify token status after removal
            const updatedTokenInfo = await contract.tokenData(tokenCode);
            console.log('\nUpdated Token Status:');
            console.log(`Token Code: ${tokenCode}`);
            console.log(`Is Active: ${updatedTokenInfo.isActive}`);

            // Look for TokenRemoved event
            const tokenRemovedEvent = receipt.logs
                .map((log: Log) => {
                    try {
                        return contract.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: LogDescription | null) => event?.name === 'TokenRemoved');

            if (tokenRemovedEvent) {
                console.log('\nEvent emitted:');
                console.log('TokenRemoved:', tokenRemovedEvent.args.tokenCode);
            }
        } else {
            console.log('Token removal failed!');
        }

        console.log('\n=== Token Removal Process Complete ===');

    } catch (error: any) {
        console.error("Script failed:", error.message);
    }
}

// Execute the token removal if run directly
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.error('Usage: ts-node remove-token.ts <tokenCode>');
        process.exit(1);
    }

    removeToken(args[0])
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

