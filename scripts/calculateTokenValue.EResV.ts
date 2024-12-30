import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const contractAddress = process.env.EthResVaultAdress!;
const abi = [
    "function getTokenCount() public view returns (uint256)",
    "function tokenCodes(uint256) public view returns (string memory)",
    "function tokenData(string memory) public view returns (address tokenAddress, uint8 tokenDecimals, string memory tokenCode, address priceFeed, uint8 priceFeedDecimals, bool isActive, uint256 lastPriceTimestamp, uint256 lastPrice, uint256 heartbeat)",
    "function getCachedTokenValue(string memory _tokenCode) public view returns (uint256 value, bool isValid)",
    "function tokenErrors(string memory) public view returns (uint256)",
    "function getTokenPriceWithEvents(string memory _tokenCode) external returns (uint256 price, uint256 timestamp)",
    "function calculateTokenValue(string memory _tokenCode) external returns (uint256)"
];

interface TokenValue {
    code: string;
    valueInETH: bigint;
    price: string;
    lastUpdate: string;
}

async function main() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        console.log('\n=== Pool Value Calculator ===');
        
        // Get ETH balance
        const ethBalance = await provider.getBalance(contractAddress);
        console.log('\nETH Balance:', ethers.formatEther(ethBalance), 'ETH');

        // Get token values
        const tokenCount = await contract.getTokenCount();
        const count = Number(tokenCount);
        let totalTokenValueInETH = ethers.parseEther("0");
        const tokenValues: TokenValue[] = [];
        
        // Get the current nonce
        let nonce = await wallet.getNonce();
        
        console.log('\n=== Processing Tokens ===');
        for (let i = 0; i < count; i++) {
            const tokenCode = await contract.tokenCodes(i);
            console.log(`\nProcessing ${tokenCode}:`);
            
            try {
                // Get token info
                const tokenInfo = await contract.tokenData(tokenCode);
                const currentPrice = ethers.formatUnits(tokenInfo.lastPrice, tokenInfo.priceFeedDecimals);
                console.log('Current Price:', currentPrice);
                
                // Calculate token value in ETH with explicit nonce
                console.log('Calculating value in ETH...');
                const tx = await contract.calculateTokenValue(tokenCode, {
                    nonce: nonce++
                });
                const receipt = await tx.wait();
                
                // Get the value from the transaction receipt or make another call
                const value = await contract.getCachedTokenValue(tokenCode);
                
                if (value[1]) { // check isValid from getCachedTokenValue
                    const valueInETH = value[0];
                    console.log(`${tokenCode} Holdings Value: ${ethers.formatEther(valueInETH)} ETH`);
                    totalTokenValueInETH += valueInETH;
                    
                    tokenValues.push({
                        code: tokenCode,
                        valueInETH: valueInETH,
                        price: currentPrice,
                        lastUpdate: new Date(Number(tokenInfo.lastPriceTimestamp) * 1000).toLocaleString()
                    });
                } else {
                    console.log(`${tokenCode}: Invalid value calculation`);
                }

            } catch (error: any) {
                console.log(`Error processing ${tokenCode}:`, error.message);
                try {
                    const errorCount = await contract.tokenErrors(tokenCode);
                    console.log('Error count:', errorCount.toString());
                } catch (err) {
                    console.log('Could not get error count');
                }
            }
        }

        // Calculate total value (ETH + tokens)
        const totalPoolValue = ethBalance + totalTokenValueInETH;

        // Display detailed summary
        console.log('\n=== Detailed Summary ===');
        console.log('\nETH Holdings:');
        console.log(`Balance: ${ethers.formatEther(ethBalance)} ETH`);
        console.log(`Percentage of Pool: ${((Number(ethBalance) * 100) / Number(totalPoolValue)).toFixed(2)}%`);

        console.log('\nToken Holdings:');
        for (const token of tokenValues) {
            console.log(`\n${token.code}:`);
            console.log(`Value: ${ethers.formatEther(token.valueInETH)} ETH`);
            console.log(`Price: ${token.price}`);
            console.log(`Last Update: ${token.lastUpdate}`);
            console.log(`Percentage of Pool: ${((Number(token.valueInETH) * 100) / Number(totalPoolValue)).toFixed(2)}%`);
        }

        console.log('\n=== Total Pool Value ===');
        console.log(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
        console.log(`Token Values: ${ethers.formatEther(totalTokenValueInETH)} ETH`);
        console.log(`Total Pool Value: ${ethers.formatEther(totalPoolValue)} ETH`);

    } catch (error) {
        console.error("Script failed:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
