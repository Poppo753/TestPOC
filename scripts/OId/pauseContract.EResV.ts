import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const contractAddress = process.env.EthResVaultAdress!;
const abi = [
    "function pause() external",
    "function owner() external view returns (address)",
    "function paused() external view returns (bool)"
];

async function pauseContract() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        console.log('\n=== Starting Contract Pause Process ===');

        // Check if caller is owner
        const contractOwner = await contract.owner();
        if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error('Error: Caller is not the contract owner');
            console.log('Contract owner:', contractOwner);
            console.log('Caller address:', wallet.address);
            return;
        }

        // Check current pause state
        const isPaused = await contract.paused();
        if (isPaused) {
            console.log('Contract is already paused');
            return;
        }

        // Execute pause
        console.log('\nPausing contract...');
        const tx = await contract.pause({
            gasLimit: 100000 // Adjust as needed
        });

        console.log('Transaction submitted:', tx.hash);
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log('Contract successfully paused!');

            // Verify new pause state
            const newPauseState = await contract.paused();
            console.log('\nContract Status:');
            console.log(`Paused: ${newPauseState}`);
        } else {
            console.log('Failed to pause contract!');
        }

        console.log('\n=== Contract Pause Process Complete ===');

    } catch (error: any) {
        console.error("Script failed:", error.message);
        if (error.message.includes("execution reverted")) {
            console.error("This might be because you're not the contract owner or the contract is already paused.");
        }
    }
}

// Execute if run directly
if (require.main === module) {
    pauseContract()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
