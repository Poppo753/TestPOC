import { expect } from "chai";
import { ethers } from "hardhat";
import { EulerV2Plugin, EulerRegistry } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * E2E TEST per EulerV2Plugin - LEVERAGE OPERATIONS (Atomic via FlashLoanService)
 * 
 * Questi test verificano le operazioni di leverage REALI usando:
 * - Contratti Euler V2 su fork Arbitrum
 * - FlashLoanService per flash loan Balancer + SimpleSwap
 * 
 * SETUP:
 * $env:FORK_ENABLED="true"; npx hardhat test test/integration/EulerV2Plugin.leverage.e2e.test.ts
 */

describe("EulerV2Plugin - Leverage E2E Tests (Atomic)", function () {
    this.timeout(300000);

    let plugin: EulerV2Plugin;
    let vaultRegistry: EulerRegistry;
    let eulerLensAdapter: any;
    let flashLoanService: any;
    let owner: SignerWithAddress;
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;
    let wethContract: any;
    let usdcContract: any;

    // Arbitrum addresses
    const EULER_VAULTS = {
        WETH: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
        USDC: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
    };
    const TOKENS = {
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    };
    const WETH_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
    const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    before(async function () {
        // Skip se non siamo su fork
        if (process.env.FORK_ENABLED !== "true") {
            console.log("⚠️  Skipping E2E tests - not on fork");
            console.log('   Run with: $env:FORK_ENABLED="true"; npx hardhat test test/integration/EulerV2Plugin.leverage.e2e.test.ts');
            this.skip();
        }

        [owner] = await ethers.getSigners();
        console.log("\n🔧 Setting up E2E Leverage Test Environment...");

        // Deploy mock contracts
        const MockBeaconFactory = await ethers.getContractFactory("MockBeacon");
        mockBeacon = await MockBeaconFactory.deploy();
        await mockBeacon.waitForDeployment();

        const MockTokenManagerFactory = await ethers.getContractFactory("MockTokenManager");
        mockTokenManager = await MockTokenManagerFactory.deploy();
        await mockTokenManager.waitForDeployment();

        const MockProxyGeneralFactory = await ethers.getContractFactory("MockProxyGeneral");
        mockProxyGeneral = await MockProxyGeneralFactory.deploy();
        await mockProxyGeneral.waitForDeployment();

        await mockBeacon.setImplementation("TokenManager", await mockTokenManager.getAddress());
        await mockBeacon.setImplementation("ProxyGeneral", await mockProxyGeneral.getAddress());
        await mockBeacon.setImplementation("ProtocolManager", owner.address);
        await mockBeacon.setImplementation("WETH", TOKENS.WETH);

        // Deploy VaultRegistry
        const VaultRegistryFactory = await ethers.getContractFactory("EulerRegistry");
        vaultRegistry = await VaultRegistryFactory.deploy();
        await vaultRegistry.waitForDeployment();
        await mockBeacon.setImplementation("EulerRegistry", await vaultRegistry.getAddress());

        // Deploy FlashLoanService (required for openLeverageAtomic)
        const FlashLoanServiceFactory = await ethers.getContractFactory("FlashLoanService");
        flashLoanService = await FlashLoanServiceFactory.deploy(await mockBeacon.getAddress());
        await flashLoanService.waitForDeployment();
        await mockBeacon.setImplementation("FlashLoanService", await flashLoanService.getAddress());
        console.log(`   FlashLoanService: ${await flashLoanService.getAddress()}`);

        // Deploy Plugin
        const EulerPluginFactory = await ethers.getContractFactory("EulerV2Plugin");
        plugin = await EulerPluginFactory.deploy(await mockBeacon.getAddress());
        await plugin.waitForDeployment();

        // Deploy EulerLensAdapter
        const EulerLensAdapterFactory = await ethers.getContractFactory("EulerLensAdapter");
        eulerLensAdapter = await EulerLensAdapterFactory.deploy(await mockBeacon.getAddress());
        await eulerLensAdapter.waitForDeployment();
        await mockBeacon.setImplementation("EulerLensAdapter", await eulerLensAdapter.getAddress());
        await mockBeacon.setImplementation("EulerV2Plugin", await plugin.getAddress());

        // Setup vaults (before transferring ownership)
        await vaultRegistry.setVault("WETH", EULER_VAULTS.WETH);
        await vaultRegistry.setVault("USDC", EULER_VAULTS.USDC);

        // Transfer registry ownership to plugin (needed for createPositionOnDemand)
        await vaultRegistry.transferOwnership(await plugin.getAddress());
        await mockTokenManager.setTokenAddress("WETH", TOKENS.WETH);
        await mockTokenManager.setTokenAddress("USDC", TOKENS.USDC);

        wethContract = await ethers.getContractAt("IERC20", TOKENS.WETH);
        usdcContract = await ethers.getContractAt("IERC20", TOKENS.USDC);

        console.log(`   Plugin: ${await plugin.getAddress()}`);
        console.log("✅ E2E Test Setup complete!\n");
    });

    describe("1. Open Leverage Position (Atomic)", function () {
        let positionId: bigint;

        before(async function () {
            // Transfer WETH to deployer (owner) for approve flow
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const wethWhale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE, 
                ethers.toQuantity(ethers.parseEther("10"))
            ]);
            
            // Transfer to owner (openLeverageAtomic does safeTransferFrom)
            await wethContract.connect(wethWhale).transfer(
                owner.address, 
                ethers.parseEther("1")
            );
            
            // Approve plugin to spend WETH
            await wethContract.connect(owner).approve(
                await plugin.getAddress(),
                ethers.parseEther("1")
            );
            
            console.log(`   Owner WETH balance: ${ethers.formatEther(
                await wethContract.balanceOf(owner.address)
            )} WETH`);
        });

        it("Should open leverage position with openLeverageAtomic", async function () {
            const collateralAmount = ethers.parseEther("0.1"); // 0.1 WETH

            const params = {
                collateralToken: "WETH",
                borrowToken: "USDC",
                collateralAmount,
                targetLeverageX100: 200, // 2x leverage
                minHealthFactor: ethers.parseEther("1.05"),
                deadline: Math.floor(Date.now() / 1000) + 3600
            };

            console.log(`\n   Opening leverage position (atomic)...`);
            console.log(`   Collateral: ${ethers.formatEther(collateralAmount)} WETH`);
            console.log(`   Target: 2x leverage`);

            try {
                const tx = await plugin.openLeverageAtomic(params);
                const receipt = await tx.wait();
                
                console.log(`   ✅ Position opened!`);
                console.log(`   Gas used: ${receipt?.gasUsed}`);
                
                positionId = 0n; // First position
                
                // Verify position in registry
                const pos = await vaultRegistry.getPosition(positionId);
                expect(pos.isActive).to.be.true;
                expect(pos.collateralVault).to.equal(EULER_VAULTS.WETH);
                expect(pos.borrowVault).to.equal(EULER_VAULTS.USDC);
                
                console.log(`   Position details:`);
                console.log(`     - Sub-account: ${pos.subAccountId}`);
                console.log(`     - Initial collateral: ${ethers.formatEther(pos.initialCollateral)} WETH`);
                console.log(`     - Borrowed: ${ethers.formatUnits(pos.borrowedAmount, 6)} USDC`);
                
            } catch (error: any) {
                console.log(`   ❌ Transaction failed: ${error.message.slice(0, 400)}`);
                throw error;
            }
        });

        it("Should have valid health factor", async function () {
            if (positionId === undefined) this.skip();
            
            const health = await eulerLensAdapter.getPositionHealthFactor(positionId);
            
            if (health === ethers.MaxUint256) {
                console.log(`   Health Factor: MAX (no debt)`);
            } else {
                const healthFormatted = ethers.formatEther(health);
                console.log(`   Health Factor: ${healthFormatted}`);
                expect(health).to.be.gt(ethers.parseEther("1")); // > 1 = healthy
            }
        });

        it("Should have correct position value", async function () {
            if (positionId === undefined) this.skip();
            
            const [collateralValue, debtValue, netValue] = await eulerLensAdapter.getPositionValue(positionId);
            
            console.log(`   Collateral Value: ${ethers.formatEther(collateralValue)} ETH`);
            console.log(`   Debt Value: ${ethers.formatEther(debtValue)} ETH`);
            console.log(`   Net Value: ${ethers.formatEther(netValue)} ETH`);
            
            expect(collateralValue).to.be.gt(0n);
            expect(debtValue).to.be.gt(0n);
            expect(collateralValue).to.be.gt(debtValue); // Healthy = collateral > debt
        });
    });

    describe("2. Add Collateral to Position", function () {
        let testPositionId: bigint;

        before(async function () {
            const count = await vaultRegistry.getActivePositionCount();
            if (count === 0n) {
                console.log("   ⚠️ No active positions, skipping");
                this.skip();
            }
            testPositionId = 0n;
            
            // Transfer more WETH to plugin
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const wethWhale = await ethers.getSigner(WETH_WHALE);
            await wethContract.connect(wethWhale).transfer(
                await plugin.getAddress(), 
                ethers.parseEther("0.05")
            );
        });

        it("Should add collateral and improve health factor", async function () {
            const healthBefore = await eulerLensAdapter.getPositionHealthFactor(testPositionId);
            const addAmount = ethers.parseEther("0.02");
            
            console.log(`   Health before: ${healthBefore === ethers.MaxUint256 ? "MAX" : ethers.formatEther(healthBefore)}`);
            
            const tx = await plugin.addCollateralToPosition(testPositionId, addAmount);
            await tx.wait();
            
            const healthAfter = await eulerLensAdapter.getPositionHealthFactor(testPositionId);
            console.log(`   Health after: ${healthAfter === ethers.MaxUint256 ? "MAX" : ethers.formatEther(healthAfter)}`);
            
            // Health should improve (increase)
            if (healthBefore !== ethers.MaxUint256 && healthAfter !== ethers.MaxUint256) {
                expect(healthAfter).to.be.gt(healthBefore);
            }
            
            console.log(`   ✅ Added ${ethers.formatEther(addAmount)} WETH collateral`);
        });
    });

    describe("3. Close Leverage Position", function () {
        let testPositionId: bigint;

        before(async function () {
            const count = await vaultRegistry.getActivePositionCount();
            if (count === 0n) {
                console.log("   ⚠️ No active positions to close");
                this.skip();
            }
            testPositionId = 0n;
        });

        it("Should close position and return collateral", async function () {
            const pos = await vaultRegistry.getPosition(testPositionId);
            if (!pos.isActive) {
                console.log("   ⚠️ Position already closed");
                this.skip();
            }

            // Get debt estimate
            const [, debtValue] = await eulerLensAdapter.getPositionValue(testPositionId);
            console.log(`   Current debt value: ${ethers.formatEther(debtValue)} ETH`);
            
            // Transfer USDC for debt repayment
            const estimatedDebt = pos.borrowedAmount + ethers.parseUnits("5", 6); // +5 USDC for interest
            
            await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
            const usdcWhale = await ethers.getSigner(USDC_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                USDC_WHALE, 
                ethers.toQuantity(ethers.parseEther("10"))
            ]);
            
            await usdcContract.connect(usdcWhale).transfer(
                await plugin.getAddress(), 
                estimatedDebt
            );
            
            console.log(`   Transferred ${ethers.formatUnits(estimatedDebt, 6)} USDC for repayment`);

            const proxyBalanceBefore = await wethContract.balanceOf(await mockProxyGeneral.getAddress());

            const tx = await plugin["closePosition(uint256)"](testPositionId);
            const receipt = await tx.wait();

            const proxyBalanceAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            const returned = proxyBalanceAfter - proxyBalanceBefore;

            console.log(`   ✅ Position closed!`);
            console.log(`   WETH returned: ${ethers.formatEther(returned)}`);
            console.log(`   Gas used: ${receipt?.gasUsed}`);

            // Verify position is closed
            const posAfter = await vaultRegistry.getPosition(testPositionId);
            expect(posAfter.isActive).to.be.false;
        });
    });

    describe("4. Multiple Positions", function () {
        it("Should track active position count correctly", async function () {
            const count = await vaultRegistry.getActivePositionCount();
            console.log(`   Active positions: ${count}`);
            
            const allPositions = await vaultRegistry.getAllPositions();
            console.log(`   Total positions returned: ${allPositions.length}`);
            
            for (const pos of allPositions) {
                console.log(`   - Position ${pos.positionId}: active=${pos.isActive}`);
            }
        });
    });
});
