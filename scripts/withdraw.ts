import { ethers } from 'ethers';
import { Log } from '@ethersproject/abstract-provider';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const ABI_FRAGMENT = [
    "function withdraw(uint256 _shares, uint256 _minEthAmount) external returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function maxSlippage() external view returns (uint256)",
    "function getTotalPoolValue() external view returns (uint256)",
    "event Withdrawn(address indexed user, uint256 shares, uint256 ethAmount, uint256 totalValue, uint256 poolBalance)"
];

async function withdrawFromPool() {
    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const contractAddress = process.env.EthResVaultAdress!;
    const contract = new ethers.Contract(contractAddress, ABI_FRAGMENT, wallet);
    
    try {
        // Get user's LP token balance
        const balance = await contract.balanceOf(wallet.address);
        
        if (balance === 0n) {
            console.log("No LP tokens to withdraw");
            return;
        }
        
        console.log(`Current LP token balance: ${ethers.formatEther(balance)} LP`);

        // Get contract's maxSlippage
        const maxSlippage = await contract.maxSlippage();
        console.log(`Contract maxSlippage: ${maxSlippage} basis points (${Number(maxSlippage)/100}%)`);
        
        // Calculate expected minimum amount as per contract logic
        const expectedMinAmount = (balance * (10000n - maxSlippage)) / 10000n;
        console.log(`Contract's expectedMinAmount: ${ethers.formatEther(expectedMinAmount)} ETH`);

        // Try with different minEthAmount values for testing (using raw BigInt values)
        const testValues = [
            0n,                     // Zero
            expectedMinAmount,      // Exact expected amount
            balance,                // Full amount
            expectedMinAmount - 1n  // Just below expected
        ];

        console.log('\nTesting different minEthAmount values:');
        for (const testValue of testValues) {
            try {
                await contract.withdraw.estimateGas(
                    balance,
                    testValue
                );
                console.log(`✓ Raw minEthAmount: ${testValue} (${ethers.formatEther(testValue)} ETH) would work`);
            } catch (error: any) {
                console.log(`✗ Raw minEthAmount: ${testValue} (${ethers.formatEther(testValue)} ETH) would fail:`, error.reason);
            }
        }

        // Proceed with actual withdrawal using the expected minimum amount
        console.log('\nProceeding with withdrawal...');
        
        const gasEstimate = await contract.withdraw.estimateGas(
            balance,
            expectedMinAmount
        );
        
        console.log(`Estimated gas: ${gasEstimate}`);

        const gasLimit = gasEstimate * 120n / 100n;
        
        const tx = await contract.withdraw(
            balance,
            expectedMinAmount,
            {
                gasLimit,
            }
        );
        
        console.log(`Transaction submitted: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
        
        const withdrawalEvent = receipt.logs.find((log: Log) => {
            try {
                const parsedLog = contract.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                });
                return parsedLog?.name === 'Withdrawn';
            } catch {
                return false;
            }
        });

        if (withdrawalEvent) {
            const parsedLog = contract.interface.parseLog({
                topics: withdrawalEvent.topics,
                data: withdrawalEvent.data
            });
            if (parsedLog && parsedLog.args) {
                const ethAmount = ethers.formatEther(parsedLog.args.ethAmount);
                console.log(`Successfully withdrew ${ethAmount} ETH`);
            }
        }
        
    } catch (error: any) {
        console.error('Error during withdrawal:', error);
        
        // More detailed error reporting
        if (error.transaction) {
            console.log('\nTransaction details:');
            console.log('From:', error.transaction.from);
            console.log('To:', error.transaction.to);
            console.log('Data:', error.transaction.data);
        }
        if (error.receipt) {
            console.log('\nTransaction receipt:');
            console.log('Status:', error.receipt.status);
            console.log('Gas used:', error.receipt.gasUsed.toString());
        }
    }
}

// Execute the withdrawal
withdrawFromPool().catch(console.error);
