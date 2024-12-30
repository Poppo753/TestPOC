import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const contractAddress = process.env.EthResVaultAdress!;
const abi = [
    "function balanceOf(address account) external view returns (uint256)",
    "function withdraw(uint256 _shares, uint256 _minEthAmount) external returns (uint256)",
    "function getTotalPoolValue() external view returns (uint256)",
    "function MAX_WITHDRAW_PER_TX() public view returns (uint256)",
    "function MAX_SLIPPAGE() public view returns (uint256)",
    "function totalSupply() external view returns (uint256)"
];

async function withdrawAllLPT() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        console.log('\n=== Starting LPT Withdrawal Process ===');

        // Get user's LPT balance
        const balance = await contract.balanceOf(wallet.address);
        console.log(`Your LPT Balance: ${ethers.formatEther(balance)} LPT`);

        if (balance <= 0) {
            console.log('No LPT tokens to withdraw');
            return;
        }

        // Get contract constants
        const MAX_WITHDRAW_PER_TX = await contract.MAX_WITHDRAW_PER_TX();
        const MAX_SLIPPAGE = await contract.MAX_SLIPPAGE();

        // Calculate minimum ETH amount with maximum allowed slippage
        const totalPoolValue = await contract.getTotalPoolValue();
        const totalSupply = await contract.totalSupply();
        
        // If we need multiple transactions due to MAX_WITHDRAW_PER_TX
        let remainingBalance = balance;
        let nonce = await wallet.getNonce();

        while (remainingBalance > 0) {
            // Calculate withdrawal amount for this transaction
            const withdrawAmount = remainingBalance > MAX_WITHDRAW_PER_TX 
                ? MAX_WITHDRAW_PER_TX 
                : remainingBalance;

            // Calculate minimum ETH amount with maximum allowed slippage
            const expectedEthAmount = (withdrawAmount * totalPoolValue) / totalSupply;
            const minEthAmount = (expectedEthAmount * (10000 - Number(MAX_SLIPPAGE))) / 10000;

            console.log('\nProcessing withdrawal:');
            console.log(`Withdrawing: ${ethers.formatEther(withdrawAmount)} LPT`);
            console.log(`Minimum ETH expected: ${ethers.formatEther(minEthAmount)} ETH`);

            try {
                // Execute withdrawal
                const tx = await contract.withdraw(
                    withdrawAmount,
                    minEthAmount,
                    {
                        nonce: nonce++,
                        gasLimit: 500000 // Adjust as needed
                    }
                );

                console.log('Withdrawal transaction submitted:', tx.hash);
                const receipt = await tx.wait();
                
                if (receipt.status === 1) {
                    console.log('Withdrawal successful!');
                    console.log('ETH received:', ethers.formatEther(await provider.getBalance(wallet.address)));
                } else {
                    console.log('Withdrawal failed!');
                }

                // Update remaining balance
                remainingBalance -= withdrawAmount;
                console.log(`Remaining LPT to withdraw: ${ethers.formatEther(remainingBalance)}`);

                // Add delay between transactions if needed
                if (remainingBalance > 0) {
                    console.log('Waiting 15 seconds before next withdrawal...');
                    await new Promise(resolve => setTimeout(resolve, 15000));
                }

            } catch (error: any) {
                console.error('Error during withdrawal:', error.message);
                break;
            }
        }

        // Final balance check
        const finalBalance = await contract.balanceOf(wallet.address);
        console.log('\n=== Withdrawal Process Complete ===');
        console.log(`Final LPT Balance: ${ethers.formatEther(finalBalance)} LPT`);
        console.log(`Final ETH Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH`);

    } catch (error) {
        console.error("Script failed:", error);
    }
}

// Execute the withdrawal
withdrawAllLPT()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
