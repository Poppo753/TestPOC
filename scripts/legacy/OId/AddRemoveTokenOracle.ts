import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("EnhancedLiquidityPoolETH Arbitrum Tests", function () {
    this.timeout(120000);

    let liquidityPool: any;
    let owner: HardhatEthersSigner;
    
    // Arbitrum Mainnet Addresses
    const TOKENS = {
        wstETH: {
            address: "0x0fBcbaEA96Ce0cF7Ee00A8c19c3ab6f5Dc8E1921",
            priceFeed: "0xB1552C5e96B312d0Bf8b554186F846C40614a540",
            decimals: 18,
            code: "wstETH"
        },
        weETH: {
            address: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
            priceFeed: "0x20bAe7e1De9c596f5F7615aeaa1342Ba99294e12",
            decimals: 18,
            code: "weETH"
        },
        ezETH: {
            address: "0x2416092f143378750bb29b79eD961ab195CcEea5",
            priceFeed: "0x989a480b6054389075CBCdC385C18CfB6FC08186",
            decimals: 18,
            code: "ezETH"
        },
        rsETH: {
            address: "0x4186BFC76E2E237523CBC30FD220FE055156b41F",
            priceFeed: "0xb0EA543f9F8d4B818550365d13F66Da747e1476A",
            decimals: 18,
            code: "rsETH"
        }
    };

    const TEST_AMOUNT = ethers.parseEther("0.0001");
    const HEARTBEAT = 3600;

    before(async function () {
        [owner] = await ethers.getSigners();
        console.log("Testing from address:", owner.address);
        
        const LiquidityPool = await ethers.getContractFactory("EnhancedLiquidityPoolETH");
        liquidityPool = await LiquidityPool.deploy();
        await liquidityPool.waitForDeployment();
        console.log("Contract deployed at:", await liquidityPool.getAddress());
    });

    it("Should configure all LSD tokens", async function () {
        for (const [name, token] of Object.entries(TOKENS)) {
            const tx = await liquidityPool.manageTokenData(
                token.address,
                token.decimals,
                token.code,
                token.priceFeed,
                18, // priceFeedDecimals
                HEARTBEAT
            );
            await tx.wait();
            console.log(`${name} configured`);
        }
    });

    it("Should deposit ETH", async function () {
        const tx = await liquidityPool.deposit({ value: TEST_AMOUNT });
        await tx.wait();
        console.log("Deposited:", ethers.formatEther(TEST_AMOUNT), "ETH");
    });

    it("Should check all LSD prices", async function () {
        for (const [name, token] of Object.entries(TOKENS)) {
            const price = await liquidityPool.getTokenPrice(token.code);
            console.log(`Current ${name} price:`, ethers.formatUnits(price, 18));
        }
    });

    it("Should initiate withdrawal", async function () {
        const lpBalance = await liquidityPool.balanceOf(owner.address);
        const tx = await liquidityPool.initiateWithdraw(lpBalance);
        await tx.wait();
        console.log("Withdrawal initiated for", ethers.formatEther(lpBalance), "LP tokens");
    });
});
