import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * 🏦 MORPHO REGISTRY - UNIT TESTS
 * 
 * Tests all functions of MorphoRegistry:
 * - Market configuration and status management
 * - Vault configuration, removal, status, default vault
 * - View functions (markets + vaults)
 * - Access control (onlyOwner)
 * - Edge cases and error handling
 */
describe("MorphoRegistry", function () {
    let registry: any;
    let owner: SignerWithAddress;
    let nonOwner: SignerWithAddress;

    // Mock addresses
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const DAI  = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";

    const ORACLE_1 = "0x0000000000000000000000000000000000000011";
    const ORACLE_2 = "0x0000000000000000000000000000000000000012";
    const IRM_1    = "0x0000000000000000000000000000000000000021";
    const IRM_2    = "0x0000000000000000000000000000000000000022";
    const LLTV_86  = ethers.parseEther("0.86"); // 86%
    const LLTV_80  = ethers.parseEther("0.80"); // 80%

    const VAULT_1 = "0x0000000000000000000000000000000000000031";
    const VAULT_2 = "0x0000000000000000000000000000000000000032";
    const VAULT_3 = "0x0000000000000000000000000000000000000033";

    beforeEach(async function () {
        [owner, nonOwner] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("MorphoRegistry");
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

        it("Should start with 0 registered markets", async function () {
            expect(await registry.getRegisteredMarketCount()).to.equal(0);
        });

        it("Should start with 0 registered vaults", async function () {
            expect(await registry.getRegisteredVaultCount()).to.equal(0);
        });
    });

    // ================================================================
    // 2. MARKET — configureMarket
    // ================================================================

    describe("2. configureMarket", function () {
        it("Should configure a market successfully", async function () {
            await registry.configureMarket("WETH", "USDC", WETH, USDC, ORACLE_1, IRM_1, LLTV_86);

            const config = await registry.getMarketConfig("WETH", "USDC");
            expect(config.params.loanToken).to.equal(USDC);
            expect(config.params.collateralToken).to.equal(WETH);
            expect(config.params.oracle).to.equal(ORACLE_1);
            expect(config.params.irm).to.equal(IRM_1);
            expect(config.params.lltv).to.equal(LLTV_86);
            expect(config.isActive).to.be.true;
        });

        it("Should emit MarketConfigured event", async function () {
            await expect(
                registry.configureMarket("WETH", "USDC", WETH, USDC, ORACLE_1, IRM_1, LLTV_86)
            ).to.emit(registry, "MarketConfigured");
        });

        it("Should increment registered market count", async function () {
            await registry.configureMarket("WETH", "USDC", WETH, USDC, ORACLE_1, IRM_1, LLTV_86);
            expect(await registry.getRegisteredMarketCount()).to.equal(1);

            await registry.configureMarket("DAI", "USDC", DAI, USDC, ORACLE_2, IRM_2, LLTV_80);
            expect(await registry.getRegisteredMarketCount()).to.equal(2);
        });

        it("Should allow updating existing market config", async function () {
            await registry.configureMarket("WETH", "USDC", WETH, USDC, ORACLE_1, IRM_1, LLTV_86);
            // Update with new oracle
            await registry.configureMarket("WETH", "USDC", WETH, USDC, ORACLE_2, IRM_1, LLTV_86);

            const config = await registry.getMarketConfig("WETH", "USDC");
            expect(config.params.oracle).to.equal(ORACLE_2);
            // Count should NOT increase on update
            expect(await registry.getRegisteredMarketCount()).to.equal(1);
        });

        it("Should compute marketId correctly", async function () {
            await registry.configureMarket("WETH", "USDC", WETH, USDC, ORACLE_1, IRM_1, LLTV_86);
            const marketId = await registry.getMarketId("WETH", "USDC");
            // marketId should be a bytes32 (non-zero)
            expect(marketId).to.not.equal(ethers.ZeroHash);
        });

        it("Should revert with empty collateralCode", async function () {
            await expect(
                registry.configureMarket("", "USDC", WETH, USDC, ORACLE_1, IRM_1, LLTV_86)
            ).to.be.revertedWithCustomError(registry, "TokenCodeEmpty");
        });

        it("Should revert with empty loanCode", async function () {
            await expect(
                registry.configureMarket("WETH", "", WETH, USDC, ORACLE_1, IRM_1, LLTV_86)
            ).to.be.revertedWithCustomError(registry, "TokenCodeEmpty");
        });

        it("Should revert with zero collateralToken", async function () {
            await expect(
                registry.configureMarket("WETH", "USDC", ethers.ZeroAddress, USDC, ORACLE_1, IRM_1, LLTV_86)
            ).to.be.revertedWithCustomError(registry, "InvalidAddress");
        });

        it("Should revert with zero loanToken", async function () {
            await expect(
                registry.configureMarket("WETH", "USDC", WETH, ethers.ZeroAddress, ORACLE_1, IRM_1, LLTV_86)
            ).to.be.revertedWithCustomError(registry, "InvalidAddress");
        });

        it("Should revert with zero oracle", async function () {
            await expect(
                registry.configureMarket("WETH", "USDC", WETH, USDC, ethers.ZeroAddress, IRM_1, LLTV_86)
            ).to.be.revertedWithCustomError(registry, "InvalidAddress");
        });

        it("Should revert with zero irm", async function () {
            await expect(
                registry.configureMarket("WETH", "USDC", WETH, USDC, ORACLE_1, ethers.ZeroAddress, LLTV_86)
            ).to.be.revertedWithCustomError(registry, "InvalidAddress");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).configureMarket("WETH", "USDC", WETH, USDC, ORACLE_1, IRM_1, LLTV_86)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 3. MARKET — setMarketStatus
    // ================================================================

    describe("3. setMarketStatus", function () {
        beforeEach(async function () {
            await registry.configureMarket("WETH", "USDC", WETH, USDC, ORACLE_1, IRM_1, LLTV_86);
        });

        it("Should deactivate a market", async function () {
            await registry.setMarketStatus("WETH", "USDC", false);
            const config = await registry.getMarketConfig("WETH", "USDC");
            expect(config.isActive).to.be.false;
        });

        it("Should reactivate a market", async function () {
            await registry.setMarketStatus("WETH", "USDC", false);
            await registry.setMarketStatus("WETH", "USDC", true);
            const config = await registry.getMarketConfig("WETH", "USDC");
            expect(config.isActive).to.be.true;
        });

        it("Should emit MarketStatusChanged event", async function () {
            await expect(registry.setMarketStatus("WETH", "USDC", false))
                .to.emit(registry, "MarketStatusChanged");
        });

        it("Should revert for unconfigured market", async function () {
            await expect(registry.setMarketStatus("DAI", "USDC", false))
                .to.be.revertedWithCustomError(registry, "MarketNotConfigured");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).setMarketStatus("WETH", "USDC", false)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 4. MARKET — View Functions
    // ================================================================

    describe("4. Market View Functions", function () {
        beforeEach(async function () {
            await registry.configureMarket("WETH", "USDC", WETH, USDC, ORACLE_1, IRM_1, LLTV_86);
            await registry.configureMarket("DAI", "USDC", DAI, USDC, ORACLE_2, IRM_2, LLTV_80);
        });

        it("getMarketParams should return correct params", async function () {
            const params = await registry.getMarketParams("WETH", "USDC");
            expect(params.loanToken).to.equal(USDC);
            expect(params.collateralToken).to.equal(WETH);
            expect(params.lltv).to.equal(LLTV_86);
        });

        it("getMarketId should return non-zero hash", async function () {
            const id = await registry.getMarketId("WETH", "USDC");
            expect(id).to.not.equal(ethers.ZeroHash);
        });

        it("isMarketConfigured should return true for configured market", async function () {
            expect(await registry.isMarketConfigured("WETH", "USDC")).to.be.true;
        });

        it("isMarketConfigured should return false for unconfigured market", async function () {
            expect(await registry.isMarketConfigured("LINK", "USDC")).to.be.false;
        });

        it("getRegisteredMarkets should return paired arrays", async function () {
            const [collCodes, loanCodes] = await registry.getRegisteredMarkets();
            expect(collCodes.length).to.equal(2);
            expect(loanCodes.length).to.equal(2);
            expect(collCodes[0]).to.equal("WETH");
            expect(loanCodes[0]).to.equal("USDC");
            expect(collCodes[1]).to.equal("DAI");
            expect(loanCodes[1]).to.equal("USDC");
        });

        it("getRegisteredMarketCount should be correct", async function () {
            expect(await registry.getRegisteredMarketCount()).to.equal(2);
        });

        // Reverting getters
        it("getMarketConfig should revert for unconfigured", async function () {
            await expect(registry.getMarketConfig("LINK", "USDC"))
                .to.be.revertedWithCustomError(registry, "MarketNotConfigured");
        });

        it("getMarketParams should revert for unconfigured", async function () {
            await expect(registry.getMarketParams("LINK", "USDC"))
                .to.be.revertedWithCustomError(registry, "MarketNotConfigured");
        });

        it("getMarketId should revert for unconfigured", async function () {
            await expect(registry.getMarketId("LINK", "USDC"))
                .to.be.revertedWithCustomError(registry, "MarketNotConfigured");
        });
    });

    // ================================================================
    // 5. VAULT — configureVault
    // ================================================================

    describe("5. configureVault", function () {
        it("Should configure a vault", async function () {
            await registry.configureVault(VAULT_1, "USDC");
            const config = await registry.getVaultConfig(VAULT_1);
            expect(config.vault).to.equal(VAULT_1);
            expect(config.assetCode).to.equal("USDC");
            expect(config.isActive).to.be.true;
        });

        it("Should emit VaultConfigured event", async function () {
            await expect(registry.configureVault(VAULT_1, "USDC"))
                .to.emit(registry, "VaultConfigured")
                .withArgs(VAULT_1, "USDC");
        });

        it("Should increment registered vault count", async function () {
            await registry.configureVault(VAULT_1, "USDC");
            expect(await registry.getRegisteredVaultCount()).to.equal(1);

            await registry.configureVault(VAULT_2, "WETH");
            expect(await registry.getRegisteredVaultCount()).to.equal(2);
        });

        it("Should allow updating existing vault config", async function () {
            await registry.configureVault(VAULT_1, "USDC");
            await registry.configureVault(VAULT_1, "DAI"); // update assetCode
            const config = await registry.getVaultConfig(VAULT_1);
            expect(config.assetCode).to.equal("DAI");
            // Count should NOT increase on update
            expect(await registry.getRegisteredVaultCount()).to.equal(1);
        });

        it("Should revert with zero vault address", async function () {
            await expect(registry.configureVault(ethers.ZeroAddress, "USDC"))
                .to.be.revertedWithCustomError(registry, "InvalidAddress");
        });

        it("Should revert with empty assetCode", async function () {
            await expect(registry.configureVault(VAULT_1, ""))
                .to.be.revertedWithCustomError(registry, "TokenCodeEmpty");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).configureVault(VAULT_1, "USDC")
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 6. VAULT — removeVault
    // ================================================================

    describe("6. removeVault", function () {
        beforeEach(async function () {
            await registry.configureVault(VAULT_1, "USDC");
            await registry.configureVault(VAULT_2, "WETH");
            await registry.configureVault(VAULT_3, "DAI");
        });

        it("Should remove a vault", async function () {
            await registry.removeVault(VAULT_2);
            expect(await registry.isVaultApproved(VAULT_2)).to.be.false;
            expect(await registry.getRegisteredVaultCount()).to.equal(2);
        });

        it("Should emit VaultRemoved event", async function () {
            await expect(registry.removeVault(VAULT_2))
                .to.emit(registry, "VaultRemoved")
                .withArgs(VAULT_2);
        });

        it("Should remove all vaults", async function () {
            await registry.removeVault(VAULT_1);
            await registry.removeVault(VAULT_2);
            await registry.removeVault(VAULT_3);
            expect(await registry.getRegisteredVaultCount()).to.equal(0);
        });

        it("Should revert for unconfigured vault", async function () {
            const unknownVault = "0x0000000000000000000000000000000000000099";
            await expect(registry.removeVault(unknownVault))
                .to.be.revertedWithCustomError(registry, "VaultNotConfigured");
        });

        it("Should clear config data after removal", async function () {
            await registry.removeVault(VAULT_2);
            await expect(registry.getVaultConfig(VAULT_2))
                .to.be.revertedWithCustomError(registry, "VaultNotConfigured");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).removeVault(VAULT_1)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 7. VAULT — setVaultStatus
    // ================================================================

    describe("7. setVaultStatus", function () {
        beforeEach(async function () {
            await registry.configureVault(VAULT_1, "USDC");
        });

        it("Should deactivate a vault", async function () {
            await registry.setVaultStatus(VAULT_1, false);
            // isVaultApproved checks both approved AND active
            expect(await registry.isVaultApproved(VAULT_1)).to.be.false;
        });

        it("Should reactivate a vault", async function () {
            await registry.setVaultStatus(VAULT_1, false);
            await registry.setVaultStatus(VAULT_1, true);
            expect(await registry.isVaultApproved(VAULT_1)).to.be.true;
        });

        it("Should emit VaultStatusChanged event", async function () {
            await expect(registry.setVaultStatus(VAULT_1, false))
                .to.emit(registry, "VaultStatusChanged")
                .withArgs(VAULT_1, false);
        });

        it("Should revert for unconfigured vault", async function () {
            const unknownVault = "0x0000000000000000000000000000000000000099";
            await expect(registry.setVaultStatus(unknownVault, false))
                .to.be.revertedWithCustomError(registry, "VaultNotConfigured");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).setVaultStatus(VAULT_1, false)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 8. VAULT — setDefaultVault
    // ================================================================

    describe("8. setDefaultVault", function () {
        beforeEach(async function () {
            await registry.configureVault(VAULT_1, "USDC");
            await registry.configureVault(VAULT_2, "USDC");
        });

        it("Should set default vault for assetCode", async function () {
            await registry.setDefaultVault("USDC", VAULT_1);
            expect(await registry.getDefaultVault("USDC")).to.equal(VAULT_1);
        });

        it("Should allow changing default vault", async function () {
            await registry.setDefaultVault("USDC", VAULT_1);
            await registry.setDefaultVault("USDC", VAULT_2);
            expect(await registry.getDefaultVault("USDC")).to.equal(VAULT_2);
        });

        it("Should emit DefaultVaultSet event", async function () {
            await expect(registry.setDefaultVault("USDC", VAULT_1))
                .to.emit(registry, "DefaultVaultSet")
                .withArgs("USDC", VAULT_1);
        });

        it("Should revert for unapproved vault", async function () {
            const unknownVault = "0x0000000000000000000000000000000000000099";
            await expect(registry.setDefaultVault("USDC", unknownVault))
                .to.be.revertedWithCustomError(registry, "VaultNotConfigured");
        });

        it("Should revert with empty assetCode", async function () {
            await expect(registry.setDefaultVault("", VAULT_1))
                .to.be.revertedWithCustomError(registry, "TokenCodeEmpty");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).setDefaultVault("USDC", VAULT_1)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("getDefaultVault should return address(0) when not set", async function () {
            expect(await registry.getDefaultVault("WETH")).to.equal(ethers.ZeroAddress);
        });
    });

    // ================================================================
    // 9. VAULT — View Functions
    // ================================================================

    describe("9. Vault View Functions", function () {
        beforeEach(async function () {
            await registry.configureVault(VAULT_1, "USDC");
            await registry.configureVault(VAULT_2, "WETH");
        });

        it("isVaultApproved should return true for active vault", async function () {
            expect(await registry.isVaultApproved(VAULT_1)).to.be.true;
        });

        it("isVaultApproved should return false for unknown vault", async function () {
            const unknownVault = "0x0000000000000000000000000000000000000099";
            expect(await registry.isVaultApproved(unknownVault)).to.be.false;
        });

        it("isVaultApproved should return false for deactivated vault", async function () {
            await registry.setVaultStatus(VAULT_1, false);
            expect(await registry.isVaultApproved(VAULT_1)).to.be.false;
        });

        it("getVaultConfig should return correct data", async function () {
            const config = await registry.getVaultConfig(VAULT_1);
            expect(config.vault).to.equal(VAULT_1);
            expect(config.assetCode).to.equal("USDC");
            expect(config.isActive).to.be.true;
        });

        it("getRegisteredVaults should return all vaults", async function () {
            const vaults = await registry.getRegisteredVaults();
            expect(vaults.length).to.equal(2);
            expect(vaults).to.include(VAULT_1);
            expect(vaults).to.include(VAULT_2);
        });

        it("getRegisteredVaultCount should be correct", async function () {
            expect(await registry.getRegisteredVaultCount()).to.equal(2);
        });
    });

    // ================================================================
    // 10. OWNERSHIP TRANSFER
    // ================================================================

    describe("10. Ownership Transfer", function () {
        it("Should transfer ownership", async function () {
            await registry.transferOwnership(nonOwner.address);
            expect(await registry.owner()).to.equal(nonOwner.address);
        });

        it("New owner can configure markets", async function () {
            await registry.transferOwnership(nonOwner.address);
            await registry.connect(nonOwner).configureMarket("WETH", "USDC", WETH, USDC, ORACLE_1, IRM_1, LLTV_86);
            expect(await registry.isMarketConfigured("WETH", "USDC")).to.be.true;
        });

        it("New owner can configure vaults", async function () {
            await registry.transferOwnership(nonOwner.address);
            await registry.connect(nonOwner).configureVault(VAULT_1, "USDC");
            expect(await registry.isVaultApproved(VAULT_1)).to.be.true;
        });

        it("Old owner cannot configure after transfer", async function () {
            await registry.transferOwnership(nonOwner.address);
            await expect(
                registry.configureMarket("WETH", "USDC", WETH, USDC, ORACLE_1, IRM_1, LLTV_86)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});
