import { ethers } from "hardhat";

async function main() {
    const contractAddress = "0x386E12fe14563A8E7607E3b4e0cD30517809c038";
    const tokenManager = await ethers.getContractAt("TokenPriceManager", contractAddress);

    // Array di token da aggiungere
    const tokens = [
        {
            tokenAddress: "0x0fBcbaEA96Ce0cF7Ee00A8c19c3ab6f5Dc8E1921", // wstETH
            tokenDecimals: 18,
            tokenCode: "wstETH",
            priceFeed: "0xB1552C5e96B312d0Bf8b554186F846C40614a540",
            priceFeedDecimals: 18,
        },
        {
            tokenAddress: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe", // weETH
            tokenDecimals: 18,
            tokenCode: "weETH",
            priceFeed: "0x20bAe7e1De9c596f5F7615aeaa1342Ba99294e12",
            priceFeedDecimals: 18,
        },
        {
            tokenAddress: "0x2416092f143378750bb29b79eD961ab195CcEea5", // ezEth
            tokenDecimals: 18,
            tokenCode: "ezETH",
            priceFeed: "0x989a480b6054389075CBCdC385C18CfB6FC08186",
            priceFeedDecimals: 18,
        },
        {
            tokenAddress: "0x4186BFC76E2E237523CBC30FD220FE055156b41F", // rsETH
            tokenDecimals: 18,
            tokenCode: "rsETH",
            priceFeed: "0xb0EA543f9F8d4B818550365d13F66Da747e1476A",
            priceFeedDecimals: 18,
        },
    ];

    for (const token of tokens) {
        console.log(`Adding token: ${token.tokenCode}`);
        try {
            const tx = await tokenManager.manageTokenData(
                ethers.getAddress(token.tokenAddress),
                token.tokenDecimals,
                token.tokenCode,
                ethers.getAddress(token.priceFeed),
                token.priceFeedDecimals
            );
            console.log(`Transaction sent for ${token.tokenCode}: ${tx.hash}`);
            await tx.wait();
            console.log(`${token.tokenCode} data updated successfully.`);
        } catch (error) {
            console.error(`Failed to add token ${token.tokenCode}:`, error);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
