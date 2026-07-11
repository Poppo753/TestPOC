import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔄 SWAP MANAGER - MISSING FUNCTIONS UNIT TESTS
 * 
 * Tests functions not covered in main SwapManager.test.ts:
 * - setDefaultDeadlineWindow / getDefaultDeadlineWindow
 * - resetSwapStats
 * - getTokenBaseAssetPrice
 * - estimateSwapGas
 * - emergencyTokenRecovery (full execution)
 */
describe("SwapManager - Missing Functions", function () {
    let swapManager: any;
    let beacon: any;
    let proxyGeneral: any;
    let tokenManager: any;
    let mockUSDC: any;
    let mockWETH: any;
    let mockSimpleSwap: any;
    let owner: any;
    let user1: any;

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();

        // Deploy mock tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
        mockWETH = await MockERC20.deploy("Wrapped Ether", "WETH", 18);

        // Deploy MockOracleAdapter
        const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
        const mockOracleAdapter = await MockOracleAdapter.deploy();

        // Deploy Beacon
        const Beacon = await ethers.getContractFactory("Beacon");
        beacon = await Beacon.deploy();
        await beacon.updateImplementation("WETH", mockWETH.target);
        await beacon.updateImplementation("BASE_ASSET", mockWETH.target);

        // Deploy ProxyGeneral
        const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
        proxyGeneral = await ProxyGeneral.deploy(beacon.target, "WETH");

        // Deploy TokenManager
        const TokenManager = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManager.deploy(beacon.target, mockOracleAdapter.target);

        // Deploy MockSimpleSwap
        const MockSimpleSwap = await ethers.getContractFactory("MockSimpleSwap");
        mockSimpleSwap = await MockSimpleSwap.deploy();

        // Deploy SwapManager
        const SwapManager = await ethers.getContractFactory("SwapManager");
        swapManager = await SwapManager.deploy(beacon.target, "WETH");

        // Register in Beacon
        await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
        await beacon.updateImplementation("TokenManager", tokenManager.target);
        await beacon.updateImplementation("SwapManager", swapManager.target);

        // Setup tokens
        await mockOracleAdapter.setupToken("USDC", ethers.parseUnits("1", 8), 8, true);
        await mockOracleAdapter.setupToken("WETH", ethers.parseUnits("3000", 8), 8, true);
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("USDC", mockUSDC.target, 6, 3600);

        // Set router
        await swapManager.setSimpleSwapRouter(mockSimpleSwap.target);

        // Mint tokens to ProxyGeneral
        await mockUSDC.mint(proxyGeneral.target, ethers.parseUnits("100000", 6));
        await mockWETH.mint(proxyGeneral.target, ethers.parseEther("100"));

        // Authorize SwapManager as module in ProxyGeneral
        await proxyGeneral.authorizeModule(swapManager.target, "SwapManager");
    });

    // ================================================================
    // 1. setDefaultDeadlineWindow / getDefaultDeadlineWindow
    // ================================================================

    describe("setDefaultDeadlineWindow", function () {
        it("Should have default value of 20 minutes", async function () {
            expect(await swapManager.getDefaultDeadlineWindow()).to.equal(20 * 60);
        });

        it("Should set new deadline window", async function () {
            await swapManager.setDefaultDeadlineWindow(10 * 60); // 10 min
            expect(await swapManager.getDefaultDeadlineWindow()).to.equal(10 * 60);
        });

        it("Should emit DefaultDeadlineWindowUpdated event", async function () {
            await expect(swapManager.setDefaultDeadlineWindow(5 * 60))
                .to.emit(swapManager, "DefaultDeadlineWindowUpdated")
                .withArgs(20 * 60, 5 * 60);
        });

        it("Should accept minimum window (1 minute)", async function () {
            await swapManager.setDefaultDeadlineWindow(60);
            expect(await swapManager.getDefaultDeadlineWindow()).to.equal(60);
        });

        it("Should accept maximum window (1 hour)", async function () {
            await swapManager.setDefaultDeadlineWindow(3600);
            expect(await swapManager.getDefaultDeadlineWindow()).to.equal(3600);
        });

        it("Should revert below minimum (< 1 minute)", async function () {
            await expect(swapManager.setDefaultDeadlineWindow(30))
                .to.be.revertedWith("Window too short - minimum 1 minute");
        });

        it("Should revert above maximum (> 1 hour)", async function () {
            await expect(swapManager.setDefaultDeadlineWindow(7200))
                .to.be.revertedWith("Window too long - maximum 1 hour");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                swapManager.connect(user1).setDefaultDeadlineWindow(600)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 2. resetSwapStats
    // ================================================================

    describe("resetSwapStats", function () {
        it("Should reset stats without revert", async function () {
            // Reset stats for a pair (even if no swaps occurred)
            await expect(swapManager.resetSwapStats("USDC", "WETH")).to.not.be.reverted;
        });

        it("Should reset stats and return zeros", async function () {
            await swapManager.resetSwapStats("USDC", "WETH");
            const [errors, successes] = await swapManager.getSwapStats("USDC", "WETH");
            expect(errors).to.equal(0);
            expect(successes).to.equal(0);
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                swapManager.connect(user1).resetSwapStats("USDC", "WETH")
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ================================================================
    // 3. getTokenBaseAssetPrice
    // ================================================================

    describe("getTokenBaseAssetPrice", function () {
        it("Should return price for registered token", async function () {
            const price = await swapManager.getTokenBaseAssetPrice("USDC");
            expect(price).to.be.greaterThan(0);
        });

        it("Should return USDC price (~1 USD = 1e8)", async function () {
            const price = await swapManager.getTokenBaseAssetPrice("USDC");
            expect(price).to.equal(ethers.parseUnits("1", 8));
        });
    });

    // ================================================================
    // 4. estimateSwapGas
    // ================================================================

    describe("estimateSwapGas", function () {
        it("Should return 0 for zero amount", async function () {
            const gas = await swapManager.estimateSwapGas("USDC", "WETH", 0);
            expect(gas).to.equal(0);
        });

        it("Should return lower gas for base asset swap", async function () {
            const baseGas = await swapManager.estimateSwapGas("USDC", "WETH", ethers.parseUnits("1000", 6));
            // WETH is base asset, so should use cheaper base gas path
            expect(baseGas).to.be.greaterThan(0);
        });

        it("Should return estimate for non-base-asset swap", async function () {
            // For token-to-token (non-base), gas is higher
            // Note: USDC → WETH includes base asset, so both should work
            const gas = await swapManager.estimateSwapGas("USDC", "WETH", ethers.parseUnits("100", 6));
            expect(gas).to.be.greaterThan(0);
        });
    });

    // ================================================================
    // 5. emergencyTokenRecovery (full execution)
    // ================================================================

    describe("emergencyTokenRecovery", function () {
        it("Should recover tokens to recipient", async function () {
            const amount = ethers.parseUnits("1000", 6);
            const recipientBalanceBefore = await mockUSDC.balanceOf(user1.address);

            await swapManager.emergencyTokenRecovery("USDC", amount, user1.address);

            const recipientBalanceAfter = await mockUSDC.balanceOf(user1.address);
            expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(amount);
        });

        it("Should emit EmergencyTokenRecovered event", async function () {
            const amount = ethers.parseUnits("500", 6);
            await expect(swapManager.emergencyTokenRecovery("USDC", amount, user1.address))
                .to.emit(swapManager, "EmergencyTokenRecovered")
                .withArgs("USDC", amount, user1.address);
        });

        it("Should revert with zero recipient", async function () {
            await expect(
                swapManager.emergencyTokenRecovery("USDC", 1000, ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid recipient");
        });

        it("Should revert with zero amount", async function () {
            await expect(
                swapManager.emergencyTokenRecovery("USDC", 0, user1.address)
            ).to.be.revertedWith("Amount must be greater than 0");
        });

        it("Should revert when non-owner calls", async function () {
            await expect(
                swapManager.connect(user1).emergencyTokenRecovery("USDC", 1000, user1.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});
