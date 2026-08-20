import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// To perform emergency withdrawal:
// ts-node emergency-withdraw.ts

// To unpause the contract after emergency withdrawal:
// ts-node emergency-withdraw.ts --unpause


const contractAddress = process.env.EthResVaultAdress!;
const abi = [
    "function emergencyWithdraw() external",
    "function owner() external view returns (address)",
    "function paused() external view returns (bool)",
    "function pause() external",
    "function unpause() external",
    "function balanceOf(address) external view returns (uint256)"
];

async function emergencyWithdrawAll() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        console.log('\n=== Starting Emergency Withdrawal Process ===');

        // Check if caller is owner
        const contractOwner = await contract.owner();
        if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error('Error: Caller is not the contract owner');
            console.log('Contract owner:', contractOwner);
            console.log('Caller address:', wallet.address);
            return;
        }

        // Get initial balances
        const initialContractBalance = await provider.getBalance(contractAddress);
        const initialOwnerBalance = await provider.getBalance(wallet.address);
        
        console.log('\nInitial Balances:');
        console.log(`Contract ETH Balance: ${ethers.formatEther(initialContractBalance)} ETH`);
        console.log(`Owner ETH Balance: ${ethers.formatEther(initialOwnerBalance)} ETH`);

        // Check if contract is paused
        const isPaused = await contract.paused();
        if (!isPaused) {
            console.log('\nContract is not paused. Pausing contract...');
            try {
                const pauseTx = await contract.pause();
                await pauseTx.wait();
                console.log('Contract successfully paused');
            } catch (error: any) {
                console.error('Error pausing contract:', error.message);
                return;
            }
        } else {
            console.log('\nContract is already paused');
        }

        // Execute emergency withdrawal
        console.log('\nExecuting emergency withdrawal...');
        try {
            const tx = await contract.emergencyWithdraw({
                gasLimit: 500000 // Adjust as needed
            });
            
            console.log('Transaction submitted:', tx.hash);
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log('Emergency withdrawal successful!');
                
                // Get final balances
                const finalContractBalance = await provider.getBalance(contractAddress);
                const finalOwnerBalance = await provider.getBalance(wallet.address);
                
                console.log('\nFinal Balances:');
                console.log(`Contract ETH Balance: ${ethers.formatEther(finalContractBalance)} ETH`);
                console.log(`Owner ETH Balance: ${ethers.formatEther(finalOwnerBalance)} ETH`);
                
                console.log('\nWithdrawn Amount:');
                console.log(`ETH: ${ethers.formatEther(finalOwnerBalance - initialOwnerBalance)} ETH`);
            } else {
                console.log('Emergency withdrawal failed!');
            }
        } catch (error: any) {
            console.error('Error during emergency withdrawal:', error.message);
            return;
        }

        console.log('\n=== Emergency Withdrawal Process Complete ===');
        
        // Ask if contract should be unpaused
        console.log('\nNOTE: Contract is still paused. Use the unpause function if needed.');

    } catch (error) {
        console.error("Script failed:", error);
    }
}

async function unpauseContract() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        console.log('\nUnpausing contract...');
        const tx = await contract.unpause();
        await tx.wait();
        console.log('Contract successfully unpaused');
    } catch (error: any) {
        console.error('Error unpausing contract:', error.message);
    }
}

// Execute the emergency withdrawal
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args[0] === '--unpause') {
        unpauseContract()
            .then(() => process.exit(0))
            .catch(error => {
                console.error(error);
                process.exit(1);
            });
    } else {
        emergencyWithdrawAll()
            .then(() => process.exit(0))
            .catch(error => {
                console.error(error);
                process.exit(1);
            });
    }
}


