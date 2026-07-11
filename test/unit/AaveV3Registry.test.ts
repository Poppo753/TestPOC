import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * 🏦 AAVE V3 REGISTRY - UNIT TESTS
 * 
 * Tests all functions of AaveV3Registry:
 * - Token configuration (single + batch)
 * - Token removal with swap-and-pop
 * - Token activation/deactivation
 * - View functions (safe + reverting)
 * - Access control (onlyOwner)
 * - Edge cases and error handling
 */
describe("AaveV3Registry", function () {
    let registry: any;
    let owner: SignerWithAddress;
    let nonOwner: SignerWithAddress;

    // Mock addresses
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const aWETH = "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8";
    const debtWETH = "0x0c84331e39d6658Cd6e6b9ba04736cC4c4734351";

    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const aUSDC = "0x724dc807b04555b71ed48a6896b6F41593b8C637";
    const debtUSDC = "0xf611aEb5013fD2c0511c9CD55c7dc5C1140741A6";

    const DAI = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
    const aDAI = "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE";
    const debtDAI = "0x8619d80FB0141ba7F184CbF22fd724116D9f7ffC";

    beforeEach(async function () {
        [owner, nonOwner] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("AaveV3Registry");
        registry = await Factory.deploy();
        await registry.waitForDeployment();
    });

    // ================================================================
    // 1. DEPLOYMENT
    // ================================================================

    describe("1. Deployment", function () {
        it("Should deploy with correct owner", async function () {
            expect(await registry.owner()).to.equal(owner.address);
        });

        it("Should start with 0 registered tokens", async function () {
            expect(await registry.getRegisteredTokenCount()).to.equal(0);
        });

        it("Should return empty array for getRegisteredTokens", async function () {
            const tokens = await registry.getRegisteredTokens();
            expect(tokens.length).to.equal(0);
        });
    });

    // ================================================================
    // 2. CONFIGURE TOKEN
    // ================================================================

    describe("2. configureToken", function () {
        it("Should configure a token successfully", async function () {
            await registry.configureToken("WETH", WETH, aWETH, debtWETH);

            const config = await registry.getTokenConfig("WETH");
            expect(config.underlying).to.equal(WETH);
            expect(config.aToken).to.equal(aWETH);
            expect(config.variableDebtToken).to.equal(debtWETH);
            expect(config.isActive).to.be.true;
        });

        it("Should emit TokenConfigured event", async function () {
            await expect(registry.configureToken("WETH", WETH, aWETH, debtWETH))
                .to.emit(registry, "TokenConfigured")
                .withArgs("WETH", WETH, aWETH, debtWETH);
        });

        it("Should increment registered token count", async function () {
            await registry.configureToken("WETH", WETH, aWETH, debtWETH);
            expect(await registry.getRegisteredTokenCount()).to.equal(1);

            await registry.configureToken("USDC", USDC, aUSDC, debtUSDC);
            expect(await registry.getRegisteredTokenCount()).to.equal(2);
        });

        it("Should allow updating existing token config", async function () {
            await registry.configureToken("WETH", WETH, aWETH, debtWETH);
            // Update with new addresses
            const newAToken = "0x0000000000000000000000000000000000000001";
            await registry.configureToken("WETH", WETH, newAToken, debtWETH);

            const config = await registry.getTokenConfig("WETH");
            expect(config.aToken).to.equal(newAToken);
            // Count should NOT increase on update
            expect(await registry.getRegisteredTokenCount()).to.equal(1);
        });

        it("Should revert with empty tokenCode", async function () {
            await expect(registry.configureToken("", WETH, aWETH, debtWETH))
                .to.be.revertedWithCustomError(registry, "TokenCodeEmpty");
        });

        it("Should revert with zero underlying address", async function () {
            await expect(registry.configureToken("WETH", ethers.ZeroAddress, aWETH, debtWETH))
                .to.be.revertedWithCustomError(registry, "InvalidAddress");
        });

        it("Should revert with zero aToken address", async function () {
            await expect(registry.configureToken("WETH", WETH, ethers.ZeroAddress, debtWETH))
                .to.be.revertedWithCustomError(registry, "InvalidAddress");
        });

        it("Should revert with zero variableDebtToken address", async function () {
            await expect(registry.configureToken("WETH", WETH, aWETH, ethers.ZeroAddress))
                .to.be.revertedWithCustomError(registry, "InvalidAddress");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).configureToken("WETH", WETH, aWETH, debtWETH)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 3. CONFIGURE TOKENS BATCH
    // ================================================================

    describe("3. configureTokensBatch", function () {
        it("Should configure multiple tokens in one tx", async function () {
            await registry.configureTokensBatch(
                ["WETH", "USDC", "DAI"],
                [WETH, USDC, DAI],
                [aWETH, aUSDC, aDAI],
                [debtWETH, debtUSDC, debtDAI]
            );

            expect(await registry.getRegisteredTokenCount()).to.equal(3);
            expect(await registry.isTokenConfigured("WETH")).to.be.true;
            expect(await registry.isTokenConfigured("USDC")).to.be.true;
            expect(await registry.isTokenConfigured("DAI")).to.be.true;
        });

        it("Should revert with mismatched array lengths", async function () {
            await expect(
                registry.configureTokensBatch(
                    ["WETH", "USDC"],
                    [WETH],           // shorter
                    [aWETH, aUSDC],
                    [debtWETH, debtUSDC]
                )
            ).to.be.revertedWith("AaveV3Registry: length mismatch");
        });

        it("Should revert if any tokenCode is empty", async function () {
            await expect(
                registry.configureTokensBatch(
                    ["WETH", ""],
                    [WETH, USDC],
                    [aWETH, aUSDC],
                    [debtWETH, debtUSDC]
                )
            ).to.be.revertedWithCustomError(registry, "TokenCodeEmpty");
        });

        it("Should revert if any address is zero", async function () {
            await expect(
                registry.configureTokensBatch(
                    ["WETH", "USDC"],
                    [WETH, ethers.ZeroAddress],
                    [aWETH, aUSDC],
                    [debtWETH, debtUSDC]
                )
            ).to.be.revertedWithCustomError(registry, "InvalidAddress");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).configureTokensBatch(
                    ["WETH"], [WETH], [aWETH], [debtWETH]
                )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 4. REMOVE TOKEN
    // ================================================================

    describe("4. removeToken", function () {
        beforeEach(async function () {
            await registry.configureTokensBatch(
                ["WETH", "USDC", "DAI"],
                [WETH, USDC, DAI],
                [aWETH, aUSDC, aDAI],
                [debtWETH, debtUSDC, debtDAI]
            );
        });

        it("Should remove a token", async function () {
            await registry.removeToken("USDC");
            expect(await registry.isTokenConfigured("USDC")).to.be.false;
            expect(await registry.getRegisteredTokenCount()).to.equal(2);
        });

        it("Should emit TokenRemoved event", async function () {
            await expect(registry.removeToken("USDC"))
                .to.emit(registry, "TokenRemoved")
                .withArgs("USDC");
        });

        it("Should correctly swap-and-pop (remove middle element)", async function () {
            // Remove middle token "USDC" — DAI should take its index
            await registry.removeToken("USDC");
            const tokens = await registry.getRegisteredTokens();
            expect(tokens.length).to.equal(2);
            expect(tokens).to.include("WETH");
            expect(tokens).to.include("DAI");
        });

        it("Should correctly remove last element", async function () {
            await registry.removeToken("DAI");
            const tokens = await registry.getRegisteredTokens();
            expect(tokens.length).to.equal(2);
            expect(tokens).to.include("WETH");
            expect(tokens).to.include("USDC");
        });

        it("Should correctly remove first element", async function () {
            await registry.removeToken("WETH");
            const tokens = await registry.getRegisteredTokens();
            expect(tokens.length).to.equal(2);
        });

        it("Should remove all tokens one by one", async function () {
            await registry.removeToken("WETH");
            await registry.removeToken("USDC");
            await registry.removeToken("DAI");
            expect(await registry.getRegisteredTokenCount()).to.equal(0);
        });

        it("Should revert for unconfigured token", async function () {
            await expect(registry.removeToken("LINK"))
                .to.be.revertedWithCustomError(registry, "TokenNotConfigured");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(registry.connect(nonOwner).removeToken("WETH"))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should clear config data after removal", async function () {
            await registry.removeToken("USDC");
            await expect(registry.getTokenConfig("USDC"))
                .to.be.revertedWithCustomError(registry, "TokenNotConfigured");
        });
    });

    // ================================================================
    // 5. SET TOKEN ACTIVE
    // ================================================================

    describe("5. setTokenActive", function () {
        beforeEach(async function () {
            await registry.configureToken("WETH", WETH, aWETH, debtWETH);
        });

        it("Should deactivate a token", async function () {
            await registry.setTokenActive("WETH", false);
            const config = await registry.getTokenConfig("WETH");
            expect(config.isActive).to.be.false;
        });

        it("Should reactivate a token", async function () {
            await registry.setTokenActive("WETH", false);
            await registry.setTokenActive("WETH", true);
            const config = await registry.getTokenConfig("WETH");
            expect(config.isActive).to.be.true;
        });

        it("Should emit TokenStatusChanged event", async function () {
            await expect(registry.setTokenActive("WETH", false))
                .to.emit(registry, "TokenStatusChanged")
                .withArgs("WETH", false);
        });

        it("Should revert for unconfigured token", async function () {
            await expect(registry.setTokenActive("LINK", false))
                .to.be.revertedWithCustomError(registry, "TokenNotConfigured");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(registry.connect(nonOwner).setTokenActive("WETH", false))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 6. VIEW FUNCTIONS
    // ================================================================

    describe("6. View Functions", function () {
        beforeEach(async function () {
            await registry.configureToken("WETH", WETH, aWETH, debtWETH);
            await registry.configureToken("USDC", USDC, aUSDC, debtUSDC);
        });

        it("getUnderlying should return correct address", async function () {
            expect(await registry.getUnderlying("WETH")).to.equal(WETH);
        });

        it("getAToken should return correct address", async function () {
            expect(await registry.getAToken("WETH")).to.equal(aWETH);
        });

        it("getVariableDebtToken should return correct address", async function () {
            expect(await registry.getVariableDebtToken("WETH")).to.equal(debtWETH);
        });

        it("isTokenConfigured should return true for configured token", async function () {
            expect(await registry.isTokenConfigured("WETH")).to.be.true;
        });

        it("isTokenConfigured should return false for unconfigured token", async function () {
            expect(await registry.isTokenConfigured("LINK")).to.be.false;
        });

        it("getRegisteredTokens should return all tokens", async function () {
            const tokens = await registry.getRegisteredTokens();
            expect(tokens.length).to.equal(2);
            expect(tokens[0]).to.equal("WETH");
            expect(tokens[1]).to.equal("USDC");
        });

        it("getRegisteredTokenCount should be correct", async function () {
            expect(await registry.getRegisteredTokenCount()).to.equal(2);
        });

        // Reverting getters
        it("getUnderlying should revert for unconfigured token", async function () {
            await expect(registry.getUnderlying("LINK"))
                .to.be.revertedWithCustomError(registry, "TokenNotConfigured");
        });

        it("getAToken should revert for unconfigured token", async function () {
            await expect(registry.getAToken("LINK"))
                .to.be.revertedWithCustomError(registry, "TokenNotConfigured");
        });

        it("getVariableDebtToken should revert for unconfigured token", async function () {
            await expect(registry.getVariableDebtToken("LINK"))
                .to.be.revertedWithCustomError(registry, "TokenNotConfigured");
        });

        it("getTokenConfig should revert for unconfigured token", async function () {
            await expect(registry.getTokenConfig("LINK"))
                .to.be.revertedWithCustomError(registry, "TokenNotConfigured");
        });
    });

    // ================================================================
    // 7. SAFE VIEW FUNCTIONS
    // ================================================================

    describe("7. Safe View Functions", function () {
        beforeEach(async function () {
            await registry.configureToken("WETH", WETH, aWETH, debtWETH);
        });

        it("getUnderlyingSafe should return address for configured token", async function () {
            expect(await registry.getUnderlyingSafe("WETH")).to.equal(WETH);
        });

        it("getUnderlyingSafe should return address(0) for unconfigured token", async function () {
            expect(await registry.getUnderlyingSafe("LINK")).to.equal(ethers.ZeroAddress);
        });

        it("getATokenSafe should return address for configured token", async function () {
            expect(await registry.getATokenSafe("WETH")).to.equal(aWETH);
        });

        it("getATokenSafe should return address(0) for unconfigured token", async function () {
            expect(await registry.getATokenSafe("LINK")).to.equal(ethers.ZeroAddress);
        });

        it("getVariableDebtTokenSafe should return address for configured token", async function () {
            expect(await registry.getVariableDebtTokenSafe("WETH")).to.equal(debtWETH);
        });

        it("getVariableDebtTokenSafe should return address(0) for unconfigured token", async function () {
            expect(await registry.getVariableDebtTokenSafe("LINK")).to.equal(ethers.ZeroAddress);
        });
    });

    // ================================================================
    // 8. OWNERSHIP TRANSFER
    // ================================================================

    describe("8. Ownership Transfer", function () {
        it("Should transfer ownership", async function () {
            await registry.transferOwnership(nonOwner.address);
            expect(await registry.owner()).to.equal(nonOwner.address);
        });

        it("New owner should be able to configure tokens", async function () {
            await registry.transferOwnership(nonOwner.address);
            await registry.connect(nonOwner).configureToken("WETH", WETH, aWETH, debtWETH);
            expect(await registry.isTokenConfigured("WETH")).to.be.true;
        });

        it("Old owner should NOT be able to configure after transfer", async function () {
            await registry.transferOwnership(nonOwner.address);
            await expect(
                registry.configureToken("WETH", WETH, aWETH, debtWETH)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});
