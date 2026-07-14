import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Run the script with the new limit in ETH
// ts-node set-withdraw-limit.ts "1.5"  # Sets limit to 1.5 ETH per hour

const contractAddress = process.env.EthResVaultAdress!;
const abi = [
    "function setWithdrawLimit(uint256 _newLimit) external",
    "function owner() external view returns (address)",
    "function withdrawLimitPerHour() external view returns (uint256)"
];

async function setWithdrawLimit(newLimit: string) {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        console.log('\n=== Starting Withdraw Limit Update Process ===');

        // Check wallet balance
        const balance = await provider.getBalance(wallet.address);
        console.log('Wallet balance:', ethers.formatEther(balance), 'ETH');

        // Check if caller is owner
        const contractOwner = await contract.owner();
        if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error('Error: Caller is not the contract owner');
            console.log('Contract owner:', contractOwner);
            console.log('Caller address:', wallet.address);
            return;
        }

        // Get current withdraw limit
        const currentLimit = await contract.withdrawLimitPerHour();
        console.log('\nCurrent Withdraw Limit:', ethers.formatEther(currentLimit), 'ETH per hour');

        // Convert new limit to Wei
        const newLimitWei = ethers.parseEther(newLimit);
        if (newLimitWei <= BigInt(0)) {
            console.error('Error: New limit must be greater than 0');
            return;
        }

        // Get current gas data
        const feeData = await provider.getFeeData();

        // Execute withdraw limit update
        console.log(`\nSetting new withdraw limit to ${newLimit} ETH per hour...`);
        const tx = await contract.setWithdrawLimit(newLimitWei, {
            gasLimit: 300000,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        });

        console.log('Transaction submitted:', tx.hash);
        const receipt = await tx.wait();

        // ... rest of your code remains the same ...

    } catch (error: any) {
        console.error("Script failed:", error.message);
        if (error.message.includes("Invalid limit")) {
            console.error("The new limit must be greater than 0");
        } else if (error.message.includes("execution reverted")) {
            console.error("This might be because you're not the contract owner");
        } else if (error.message.includes("insufficient funds")) {
            console.error("Your wallet doesn't have enough ETH to pay for gas");
        }
    }
}

// Execute if run directly
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.error('Usage: ts-node set-withdraw-limit.ts <newLimit>');
        console.error('Example: ts-node set-withdraw-limit.ts "1.5"');
        process.exit(1);
    }

    setWithdrawLimit(args[0])
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
