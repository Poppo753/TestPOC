import { ethers } from "hardhat";
import { expect } from "chai";

describe("TokenPriceManager with Real Tokens", function () {
    let tokenPriceManager: any;
    const deployedContractAddress = "0x386E12fe14563A8E7607E3b4e0cD30517809c038";

    // Real data for wstETH and weETH
    const tokens = [
        {
            tokenAddress: "0x0fBcbaEA96Ce0cF7Ee00A8c19c3ab6f5Dc8E1921", // wstETH
            tokenDecimals: 18,
            tokenCode: "wstETH",
            priceFeed: "0xB1552C5e96B312d0Bf8b554186F846C40614a540", // Chainlink feed for wstETH/stETH
            priceFeedDecimals: 8,
        },
        {
            tokenAddress: "0x35751007A407CA6fEffe80B3cb397736D2Cf4DbE", // wETH
            tokenDecimals: 18,
            tokenCode: "weETH",
            priceFeed: "0x20bAe7e1De9c596f5F7615aeaa1342Ba99294e12", // Chainlink feed for weETH/Eth
            priceFeedDecimals: 8,
        },
    ];

    before(async function () {
        // Get the deployed contract
        tokenPriceManager = await ethers.getContractAt("TokenPriceManager", deployedContractAddress);
    });

    it("Should add both tokens and retrieve their prices", async function () {
        // Normalize addresses to ensure correct checksum
        for (const token of tokens) {
            token.tokenAddress = ethers.getAddress(token.tokenAddress); // Normalize address
            token.priceFeed = ethers.getAddress(token.priceFeed); // Normalize price feed

            const tx = await tokenPriceManager.manageTokenData(
                token.tokenAddress,
                token.tokenDecimals,
                token.tokenCode,
                token.priceFeed,
                token.priceFeedDecimals
            );
            await tx.wait();

            // Verify the token is added
            const tokenInfo = await tokenPriceManager.getTokenInfo(token.tokenCode);
            expect(tokenInfo.tokenAddress).to.equal(token.tokenAddress);
            expect(tokenInfo.tokenDecimals).to.equal(token.tokenDecimals);
            expect(tokenInfo.tokenCode).to.equal(token.tokenCode);
            expect(tokenInfo.priceFeed).to.equal(token.priceFeed);
            expect(tokenInfo.priceFeedDecimals).to.equal(token.priceFeedDecimals);
        }

        // Retrieve and verify prices
        for (const token of tokens) {
            const price = await tokenPriceManager.getTokenPrice(token.tokenCode);
            console.log(`The latest price of ${token.tokenCode} is: ${price.toString()}`);
            expect(price).to.be.gt(0); // Ensure the price is greater than zero
        }

        // Retrieve and verify all token data
        const allTokens = await tokenPriceManager.getAllTokenData();
        expect(allTokens.length).to.equal(tokens.length);

        for (const token of tokens) {
            const storedToken = allTokens.find((t: any) => t.tokenCode === token.tokenCode);
            expect(storedToken).to.not.be.undefined;
            expect(storedToken.tokenAddress).to.equal(token.tokenAddress);
            expect(storedToken.tokenDecimals).to.equal(token.tokenDecimals);
            expect(storedToken.tokenCode).to.equal(token.tokenCode);
            expect(storedToken.priceFeed).to.equal(token.priceFeed);
            expect(storedToken.priceFeedDecimals).to.equal(token.priceFeedDecimals);
        }
    });
});
