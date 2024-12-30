import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Interface for token data
interface TokenConfig {
    tokenCode: string;
    tokenAddress: string;
    priceFeed: string;
    tokenDecimals: number;
    priceFeedDecimals: number;
    heartbeat: number;
}

async function addMultipleTokens(contractAddress: string, privateKey: string, tokens: TokenConfig[]) {
    if (!process.env.ARBITRUM_RPC_URL) {
        throw new Error('ARBITRUM_RPC_URL not found in environment variables');
    }

    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Contract ABI - with the correct function name
    const abi = [
        "function manageTokenData(string memory _tokenCode, address _tokenAddress, address _priceFeed, uint8 _tokenDecimals, uint8 _priceFeedDecimals, uint256 _heartbeat) external",
        "function owner() public view returns (address)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, wallet);

    try {
        // First verify we're the owner
        const contractOwner = await contract.owner();
        if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
            throw new Error('The provided private key is not for the contract owner');
        }

        console.log('Starting to add tokens...');

        for (const token of tokens) {
            try {
                console.log(`Adding token ${token.tokenCode}...`);
                
                const tx = await contract.manageTokenData(
                    token.tokenCode,
                    token.tokenAddress,
                    token.priceFeed,
                    token.tokenDecimals,
                    token.priceFeedDecimals,
                    token.heartbeat
                );

                console.log(`Transaction sent: ${tx.hash}`);
                await tx.wait();
                console.log(`Token ${token.tokenCode} added successfully!`);
            } catch (error) {
                console.error(`Error adding token ${token.tokenCode}:`, error);
            }
        }

        console.log('All token addition attempts completed');
    } catch (error) {
        console.error("Error:", error);
        throw error;
    }
}

async function main() {
    // Contract address on Arbitrum
    const contractAddress = process.env.EthResVaultAdress!;
    
    // Your private key - KEEP THIS SECRET AND NEVER COMMIT TO REPOSITORY
    // Better to use environment variable: process.env.PRIVATE_KEY
    const privateKey = process.env.PRIVATE_KEY!;

    // Token configurations based on your provided data
    const tokens: TokenConfig[] = [
        {
            tokenCode: "wstETH",
            tokenAddress: "0x0fBcbaEA96Ce0cF7Ee00A8c19c3ab6f5Dc8E1921",
            priceFeed: "0xB1552C5e96B312d0Bf8b554186F846C40614a540",
            tokenDecimals: 18,
            priceFeedDecimals: 18,
            heartbeat: 86400 // 24 hours in seconds
        },
        {
            tokenCode: "weETH",
            tokenAddress: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
            priceFeed: "0x20bAe7e1De9c596f5F7615aeaa1342Ba99294e12",
            tokenDecimals: 18,
            priceFeedDecimals: 18,
            heartbeat: 86400
        },
        {
            tokenCode: "ezETH",
            tokenAddress: "0x2416092f143378750bb29b79eD961ab195CcEea5",
            priceFeed: "0x989a480b6054389075CBCdC385C18CfB6FC08186",
            tokenDecimals: 18,
            priceFeedDecimals: 18,
            heartbeat: 86400
        },
        {
            tokenCode: "rsETH",
            tokenAddress: "0x4186BFC76E2E237523CBC30FD220FE055156b41F",
            priceFeed: "0xb0EA543f9F8d4B818550365d13F66Da747e1476A",
            tokenDecimals: 18,
            priceFeedDecimals: 18,
            heartbeat: 86400
        }
    ];

    try {
        await addMultipleTokens(contractAddress, privateKey, tokens);
    } catch (error) {
        console.error("Main error:", error);
    }
}

main();
