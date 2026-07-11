import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * 🏦 EULER REGISTRY - UNIT TESTS
 * 
 * Tests all functions of EulerRegistry:
 * - Vault registry (set, batch, remove, lookup)
 * - Position manager (create, update, close, queries)
 * - On-demand sub-account allocation (Opzione C)
 * - Swap-and-pop removal logic
 * - Access control (onlyOwner)
 * - Edge cases and error handling
 */
describe("EulerRegistry", function () {
    let registry: any;
    let owner: SignerWithAddress;
    let nonOwner: SignerWithAddress;

    // Mock vault addresses
    const WETH_VAULT = "0x78E3E051D32157AACD550fBB78458762d8f7edFF";
    const USDC_VAULT = "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899";
    const DAI_VAULT = "0x0000000000000000000000000000000000000003";

    beforeEach(async function () {
        [owner, nonOwner] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("EulerRegistry");
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

        it("Should start with 0 registered vaults", async function () {
            expect(await registry.getRegisteredCount()).to.equal(0);
        });

        it("Should start with nextPositionId = 0", async function () {
            expect(await registry.nextPositionId()).to.equal(0);
        });

        it("Should start with 0 active positions", async function () {
            expect(await registry.getActivePositionCount()).to.equal(0);
        });
    });

    // ================================================================
    // 2. VAULT REGISTRY — setVault
    // ================================================================

    describe("2. setVault", function () {
        it("Should register a vault", async function () {
            await registry.setVault("WETH", WETH_VAULT);
            expect(await registry.getVault("WETH")).to.equal(WETH_VAULT);
        });

        it("Should emit VaultSet event with isNew=true", async function () {
            await expect(registry.setVault("WETH", WETH_VAULT))
                .to.emit(registry, "VaultSet")
                .withArgs("WETH", WETH_VAULT, true);
        });

        it("Should update existing vault and emit isNew=false", async function () {
            await registry.setVault("WETH", WETH_VAULT);
            const newVault = "0x0000000000000000000000000000000000000099";
            await expect(registry.setVault("WETH", newVault))
                .to.emit(registry, "VaultSet")
                .withArgs("WETH", newVault, false);

            expect(await registry.getVault("WETH")).to.equal(newVault);
            expect(await registry.getRegisteredCount()).to.equal(1); // no double-add
        });

        it("Should set reverse lookup (vault → tokenCode)", async function () {
            await registry.setVault("WETH", WETH_VAULT);
            expect(await registry.getTokenCode(WETH_VAULT)).to.equal("WETH");
        });

        it("Should clear old reverse lookup on update", async function () {
            await registry.setVault("WETH", WETH_VAULT);
            const newVault = "0x0000000000000000000000000000000000000099";
            await registry.setVault("WETH", newVault);

            // Old vault should no longer resolve
            await expect(registry.getTokenCode(WETH_VAULT))
                .to.be.revertedWithCustomError(registry, "VaultNotFound");
        });

        it("Should revert with empty tokenCode", async function () {
            await expect(registry.setVault("", WETH_VAULT))
                .to.be.revertedWithCustomError(registry, "TokenCodeEmpty");
        });

        it("Should revert with zero vault address", async function () {
            await expect(registry.setVault("WETH", ethers.ZeroAddress))
                .to.be.revertedWithCustomError(registry, "InvalidVaultAddress");
        });

        it("Should revert if vault already registered for different token", async function () {
            await registry.setVault("WETH", WETH_VAULT);
            await expect(registry.setVault("ETH", WETH_VAULT))
                .to.be.revertedWithCustomError(registry, "VaultAlreadyRegistered");
        });

        it("Should allow same vault for same token (re-register)", async function () {
            await registry.setVault("WETH", WETH_VAULT);
            await registry.setVault("WETH", WETH_VAULT); // no revert
            expect(await registry.getVault("WETH")).to.equal(WETH_VAULT);
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).setVault("WETH", WETH_VAULT)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 3. VAULT REGISTRY — setVaultsBatch
    // ================================================================

    describe("3. setVaultsBatch", function () {
        it("Should register multiple vaults", async function () {
            await registry.setVaultsBatch(
                ["WETH", "USDC", "DAI"],
                [WETH_VAULT, USDC_VAULT, DAI_VAULT]
            );
            expect(await registry.getRegisteredCount()).to.equal(3);
            expect(await registry.getVault("WETH")).to.equal(WETH_VAULT);
            expect(await registry.getVault("USDC")).to.equal(USDC_VAULT);
        });

        it("Should revert with mismatched lengths", async function () {
            await expect(
                registry.setVaultsBatch(["WETH"], [WETH_VAULT, USDC_VAULT])
            ).to.be.revertedWith("Array length mismatch");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).setVaultsBatch(["WETH"], [WETH_VAULT])
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 4. VAULT REGISTRY — removeVault
    // ================================================================

    describe("4. removeVault", function () {
        beforeEach(async function () {
            await registry.setVaultsBatch(
                ["WETH", "USDC", "DAI"],
                [WETH_VAULT, USDC_VAULT, DAI_VAULT]
            );
        });

        it("Should remove a vault", async function () {
            await registry.removeVault("USDC");
            expect(await registry.isRegistered("USDC")).to.be.false;
            expect(await registry.getRegisteredCount()).to.equal(2);
        });

        it("Should emit VaultRemoved event", async function () {
            await expect(registry.removeVault("USDC"))
                .to.emit(registry, "VaultRemoved")
                .withArgs("USDC", USDC_VAULT);
        });

        it("Should clear reverse lookup after removal", async function () {
            await registry.removeVault("USDC");
            await expect(registry.getTokenCode(USDC_VAULT))
                .to.be.revertedWithCustomError(registry, "VaultNotFound");
        });

        it("Should correctly swap-and-pop (remove middle)", async function () {
            await registry.removeVault("USDC");
            const tokens = await registry.getAllRegisteredTokens();
            expect(tokens.length).to.equal(2);
            expect(tokens).to.include("WETH");
            expect(tokens).to.include("DAI");
        });

        it("Should remove all vaults one by one", async function () {
            await registry.removeVault("WETH");
            await registry.removeVault("USDC");
            await registry.removeVault("DAI");
            expect(await registry.getRegisteredCount()).to.equal(0);
        });

        it("Should revert for unregistered vault", async function () {
            await expect(registry.removeVault("LINK"))
                .to.be.revertedWithCustomError(registry, "VaultNotFound");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(registry.connect(nonOwner).removeVault("WETH"))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 5. VAULT REGISTRY — View Functions
    // ================================================================

    describe("5. Vault View Functions", function () {
        beforeEach(async function () {
            await registry.setVault("WETH", WETH_VAULT);
            await registry.setVault("USDC", USDC_VAULT);
        });

        it("getVault should return vault address", async function () {
            expect(await registry.getVault("WETH")).to.equal(WETH_VAULT);
        });

        it("getVault should revert for unregistered token", async function () {
            await expect(registry.getVault("LINK"))
                .to.be.revertedWithCustomError(registry, "VaultNotFound");
        });

        it("getVaultSafe should return address(0) for unregistered", async function () {
            expect(await registry.getVaultSafe("LINK")).to.equal(ethers.ZeroAddress);
        });

        it("getTokenCode should return correct code", async function () {
            expect(await registry.getTokenCode(WETH_VAULT)).to.equal("WETH");
        });

        it("isRegistered should return correct values", async function () {
            expect(await registry.isRegistered("WETH")).to.be.true;
            expect(await registry.isRegistered("LINK")).to.be.false;
        });

        it("getAllVaults should return paired arrays", async function () {
            const [tokenCodes, vaults] = await registry.getAllVaults();
            expect(tokenCodes.length).to.equal(2);
            expect(vaults.length).to.equal(2);
            // Find WETH position
            const wethIdx = tokenCodes.indexOf("WETH");
            expect(vaults[wethIdx]).to.equal(WETH_VAULT);
        });
    });

    // ================================================================
    // 6. POSITION MANAGER — createPosition
    // ================================================================

    describe("6. createPosition", function () {
        it("Should create a position", async function () {
            const tx = await registry.createPosition(
                1, WETH_VAULT, USDC_VAULT,
                ethers.parseEther("1"), ethers.parseUnits("1500", 6)
            );
            const receipt = await tx.wait();

            const pos = await registry.getPosition(0);
            expect(pos.subAccountId).to.equal(1);
            expect(pos.collateralVault).to.equal(WETH_VAULT);
            expect(pos.borrowVault).to.equal(USDC_VAULT);
            expect(pos.initialCollateral).to.equal(ethers.parseEther("1"));
            expect(pos.borrowedAmount).to.equal(ethers.parseUnits("1500", 6));
            expect(pos.isActive).to.be.true;
        });

        it("Should emit PositionCreated event", async function () {
            await expect(
                registry.createPosition(1, WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000)
            ).to.emit(registry, "PositionCreated")
             .withArgs(0, 1, WETH_VAULT, USDC_VAULT);
        });

        it("Should increment nextPositionId", async function () {
            await registry.createPosition(1, WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000);
            expect(await registry.nextPositionId()).to.equal(1);

            await registry.createPosition(2, WETH_VAULT, USDC_VAULT, ethers.parseEther("2"), 2000);
            expect(await registry.nextPositionId()).to.equal(2);
        });

        it("Should add to active positions", async function () {
            await registry.createPosition(1, WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000);
            expect(await registry.getActivePositionCount()).to.equal(1);
            expect(await registry.isPositionActive(0)).to.be.true;
        });

        it("Should revert with zero collateralVault", async function () {
            await expect(
                registry.createPosition(1, ethers.ZeroAddress, USDC_VAULT, ethers.parseEther("1"), 1000)
            ).to.be.revertedWithCustomError(registry, "InvalidVault");
        });

        it("Should revert with zero borrowVault", async function () {
            await expect(
                registry.createPosition(1, WETH_VAULT, ethers.ZeroAddress, ethers.parseEther("1"), 1000)
            ).to.be.revertedWithCustomError(registry, "InvalidVault");
        });

        it("Should revert with zero initialCollateral", async function () {
            await expect(
                registry.createPosition(1, WETH_VAULT, USDC_VAULT, 0, 1000)
            ).to.be.revertedWithCustomError(registry, "InvalidVault");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).createPosition(1, WETH_VAULT, USDC_VAULT, 1000, 500)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 7. POSITION MANAGER — updatePosition
    // ================================================================

    describe("7. updatePosition", function () {
        beforeEach(async function () {
            await registry.createPosition(1, WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000);
        });

        it("Should update borrowed amount", async function () {
            await registry.updatePosition(0, 2000);
            const pos = await registry.getPosition(0);
            expect(pos.borrowedAmount).to.equal(2000);
        });

        it("Should emit PositionUpdated event", async function () {
            await expect(registry.updatePosition(0, 2000))
                .to.emit(registry, "PositionUpdated")
                .withArgs(0, 2000);
        });

        it("Should revert for non-existent position", async function () {
            await expect(registry.updatePosition(999, 2000))
                .to.be.revertedWithCustomError(registry, "PositionNotFound");
        });

        it("Should revert for closed position", async function () {
            await registry.closePositionRecord(0);
            await expect(registry.updatePosition(0, 2000))
                .to.be.revertedWithCustomError(registry, "PositionNotActive");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).updatePosition(0, 2000)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 8. POSITION MANAGER — closePositionRecord
    // ================================================================

    describe("8. closePositionRecord", function () {
        beforeEach(async function () {
            await registry.createPosition(1, WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000);
            await registry.createPosition(2, WETH_VAULT, USDC_VAULT, ethers.parseEther("2"), 2000);
        });

        it("Should close a position", async function () {
            await registry.closePositionRecord(0);
            const pos = await registry.getPosition(0);
            expect(pos.isActive).to.be.false;
        });

        it("Should emit PositionClosed event", async function () {
            await expect(registry.closePositionRecord(0))
                .to.emit(registry, "PositionClosed")
                .withArgs(0);
        });

        it("Should remove from active positions array", async function () {
            expect(await registry.getActivePositionCount()).to.equal(2);
            await registry.closePositionRecord(0);
            expect(await registry.getActivePositionCount()).to.equal(1);
            expect(await registry.isPositionActive(0)).to.be.false;
            expect(await registry.isPositionActive(1)).to.be.true;
        });

        it("Should handle closing all positions", async function () {
            await registry.closePositionRecord(0);
            await registry.closePositionRecord(1);
            expect(await registry.getActivePositionCount()).to.equal(0);
        });

        it("Should revert for non-existent position", async function () {
            await expect(registry.closePositionRecord(999))
                .to.be.revertedWithCustomError(registry, "PositionNotFound");
        });

        it("Should revert for already closed position", async function () {
            await registry.closePositionRecord(0);
            await expect(registry.closePositionRecord(0))
                .to.be.revertedWithCustomError(registry, "PositionAlreadyClosed");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).closePositionRecord(0)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 9. POSITION MANAGER — View Functions
    // ================================================================

    describe("9. Position View Functions", function () {
        beforeEach(async function () {
            await registry.createPosition(1, WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000);
            await registry.createPosition(2, WETH_VAULT, USDC_VAULT, ethers.parseEther("2"), 2000);
            await registry.closePositionRecord(0); // close first
        });

        it("getPosition should return data for existing position", async function () {
            const pos = await registry.getPosition(1);
            expect(pos.subAccountId).to.equal(2);
            expect(pos.isActive).to.be.true;
        });

        it("getPosition should revert for non-existent", async function () {
            await expect(registry.getPosition(999))
                .to.be.revertedWithCustomError(registry, "PositionNotFound");
        });

        it("getPositionSafe should return zero struct for non-existent", async function () {
            const pos = await registry.getPositionSafe(999);
            expect(pos.createdAt).to.equal(0);
        });

        it("getAllPositions should include active and closed", async function () {
            const positions = await registry.getAllPositions();
            expect(positions.length).to.equal(2);
            expect(positions[0].isActive).to.be.false; // closed
            expect(positions[1].isActive).to.be.true;  // active
        });

        it("getActivePositions should return only active ones", async function () {
            const [positions, ids] = await registry.getActivePositions();
            expect(positions.length).to.equal(1);
            expect(ids[0]).to.equal(1);
            expect(positions[0].isActive).to.be.true;
        });

        it("getActivePositionIds should return correct IDs", async function () {
            const ids = await registry.getActivePositionIds();
            expect(ids.length).to.equal(1);
            expect(ids[0]).to.equal(1);
        });

        it("isPositionActive should return correct values", async function () {
            expect(await registry.isPositionActive(0)).to.be.false;
            expect(await registry.isPositionActive(1)).to.be.true;
            expect(await registry.isPositionActive(999)).to.be.false;
        });
    });

    // ================================================================
    // 10. ON-DEMAND ALLOCATION — createPositionOnDemand
    // ================================================================

    describe("10. createPositionOnDemand (Opzione C)", function () {
        it("Should allocate new sub-account for first position", async function () {
            const tx = await registry.createPositionOnDemand(
                WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000
            );
            const receipt = await tx.wait();

            const pos = await registry.getPosition(0);
            expect(pos.subAccountId).to.equal(1); // first allocation
            expect(pos.isActive).to.be.true;
        });

        it("Should reuse sub-account for same pair after close", async function () {
            // Create and close
            await registry.createPositionOnDemand(WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000);
            await registry.closePositionRecord(0);

            // Re-open same pair
            await registry.createPositionOnDemand(WETH_VAULT, USDC_VAULT, ethers.parseEther("2"), 2000);
            const pos = await registry.getPosition(1);
            expect(pos.subAccountId).to.equal(1); // REUSED, not 2
        });

        it("Should allocate different sub-accounts for different pairs", async function () {
            await registry.createPositionOnDemand(WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000);
            await registry.createPositionOnDemand(WETH_VAULT, DAI_VAULT, ethers.parseEther("1"), 1000);

            const pos0 = await registry.getPosition(0);
            const pos1 = await registry.getPosition(1);
            expect(pos0.subAccountId).to.equal(1);
            expect(pos1.subAccountId).to.equal(2);
        });

        it("Should revert if active position exists for same pair", async function () {
            await registry.createPositionOnDemand(WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000);
            await expect(
                registry.createPositionOnDemand(WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000)
            ).to.be.revertedWith("EulerRegistry: position already exists for this pair");
        });

        it("Should revert with zero vault addresses", async function () {
            await expect(
                registry.createPositionOnDemand(ethers.ZeroAddress, USDC_VAULT, ethers.parseEther("1"), 1000)
            ).to.be.revertedWithCustomError(registry, "InvalidVault");
        });

        it("Should revert with zero initialCollateral", async function () {
            await expect(
                registry.createPositionOnDemand(WETH_VAULT, USDC_VAULT, 0, 1000)
            ).to.be.revertedWithCustomError(registry, "InvalidVault");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                registry.connect(nonOwner).createPositionOnDemand(WETH_VAULT, USDC_VAULT, 1000, 500)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 11. ON-DEMAND — Helper View Functions
    // ================================================================

    describe("11. On-Demand Helper Views", function () {
        it("getSubAccountForPair should return 0 for unallocated pair", async function () {
            expect(await registry.getSubAccountForPair(WETH_VAULT, USDC_VAULT)).to.equal(0);
        });

        it("getSubAccountForPair should return allocated ID", async function () {
            await registry.createPositionOnDemand(WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000);
            expect(await registry.getSubAccountForPair(WETH_VAULT, USDC_VAULT)).to.equal(1);
        });

        it("hasActivePositionForPair should return false initially", async function () {
            expect(await registry.hasActivePositionForPair(WETH_VAULT, USDC_VAULT)).to.be.false;
        });

        it("hasActivePositionForPair should return true when active", async function () {
            await registry.createPositionOnDemand(WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000);
            expect(await registry.hasActivePositionForPair(WETH_VAULT, USDC_VAULT)).to.be.true;
        });

        it("hasActivePositionForPair should return false after close", async function () {
            await registry.createPositionOnDemand(WETH_VAULT, USDC_VAULT, ethers.parseEther("1"), 1000);
            await registry.closePositionRecord(0);
            expect(await registry.hasActivePositionForPair(WETH_VAULT, USDC_VAULT)).to.be.false;
        });
    });

    // ================================================================
    // 12. OWNERSHIP TRANSFER
    // ================================================================

    describe("12. Ownership Transfer", function () {
        it("Should transfer ownership", async function () {
            await registry.transferOwnership(nonOwner.address);
            expect(await registry.owner()).to.equal(nonOwner.address);
        });

        it("New owner can manage vaults", async function () {
            await registry.transferOwnership(nonOwner.address);
            await registry.connect(nonOwner).setVault("WETH", WETH_VAULT);
            expect(await registry.isRegistered("WETH")).to.be.true;
        });

        it("New owner can manage positions", async function () {
            await registry.transferOwnership(nonOwner.address);
            await registry.connect(nonOwner).createPosition(1, WETH_VAULT, USDC_VAULT, 1000, 500);
            expect(await registry.getActivePositionCount()).to.equal(1);
        });
    });
});
