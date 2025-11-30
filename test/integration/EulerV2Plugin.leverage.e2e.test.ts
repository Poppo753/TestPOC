import { expect } from "chai";
import { ethers } from "hardhat";
import { EulerV2Plugin, EulerVaultRegistry } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getOpenLeverageSwapData, calculateMinCollateralReceived, EULER, TOKENS } from "../../scripts/euler/swap-data-helper";

/**
 * E2E TEST per EulerV2Plugin - LEVERAGE OPERATIONS con 1inch API
 * 
 * Questi test verificano le operazioni di leverage REALI usando:
 * - Contratti Euler V2 su fork Arbitrum
 * - 1inch API per generare swapData
 * 
 * SETUP:
 * $env:FORK_ENABLED="true"; npx hardhat test test/integration/EulerV2Plugin.leverage.e2e.test.ts
 * 
 * NOTA: Questi test fanno chiamate API reali a 1inch.
 * Rate limit: 1 req/sec. I test usano cache per ridurre le chiamate.
 */

describe("EulerV2Plugin - Leverage E2E Tests (with 1inch)", function () {
    this.timeout(300000); // 5 minuti per API calls

    let plugin: EulerV2Plugin;
    let vaultRegistry: EulerVaultRegistry;
    let owner: SignerWithAddress;
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;
    let wethContract: any;
    let usdcContract: any;

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

        // Deploy VaultRegistry
        const VaultRegistryFactory = await ethers.getContractFactory("EulerVaultRegistry");
        vaultRegistry = await VaultRegistryFactory.deploy();
        await vaultRegistry.waitForDeployment();
        await mockBeacon.setImplementation("EulerVaultRegistry", await vaultRegistry.getAddress());

        // Deploy Plugin
        const EulerPluginFactory = await ethers.getContractFactory("EulerV2Plugin");
        plugin = await EulerPluginFactory.deploy(await mockBeacon.getAddress());
        await plugin.waitForDeployment();

        // Setup vaults and tokens
        await vaultRegistry.setVault("WETH", EULER.VAULTS.WETH);
        await vaultRegistry.setVault("USDC", EULER.VAULTS.USDC);
        await mockTokenManager.setTokenAddress("WETH", TOKENS.WETH);
        await mockTokenManager.setTokenAddress("USDC", TOKENS.USDC);

        wethContract = await ethers.getContractAt("IERC20", TOKENS.WETH);
        usdcContract = await ethers.getContractAt("IERC20", TOKENS.USDC);

        console.log(`   Plugin: ${await plugin.getAddress()}`);
        console.log("✅ E2E Test Setup complete!\n");
    });

    describe("1. Open Leverage Position with 1inch", function () {
        let positionId: bigint;

        before(async function () {
            // Trasferisci WETH al plugin come collaterale iniziale
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const wethWhale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE, 
                ethers.toQuantity(ethers.parseEther("10"))
            ]);
            
            // 0.1 WETH come collaterale iniziale
            await wethContract.connect(wethWhale).transfer(
                await plugin.getAddress(), 
                ethers.parseEther("0.1")
            );
            
            console.log(`   Plugin WETH balance: ${ethers.formatEther(
                await wethContract.balanceOf(await plugin.getAddress())
            )} WETH`);
        });

        it("Should generate valid swapData from 1inch API", async function () {
            const borrowAmount = ethers.parseUnits("50", 6); // 50 USDC
            
            const { swapData, expectedWethOut, minWethOut } = await getOpenLeverageSwapData(
                borrowAmount,
                EULER.VAULTS.WETH,
                100, // 1% slippage
                true // use API
            );
            
            expect(swapData).to.not.equal("0x");
            expect(swapData.length).to.be.gt(100); // Should have meaningful data
            expect(expectedWethOut).to.be.gt(0n);
            expect(minWethOut).to.be.gt(0n);
            expect(minWethOut).to.be.lt(expectedWethOut); // minOut < expected
            
            console.log(`   ✅ SwapData generated: ${swapData.length} bytes`);
            console.log(`   Expected WETH: ${ethers.formatEther(expectedWethOut)}`);
        });

        it("Should open leverage position successfully", async function () {
            const collateralAmount = ethers.parseEther("0.05"); // 0.05 WETH
            const borrowAmount = ethers.parseUnits("50", 6); // 50 USDC
            
            // Generate swapData
            const { swapData, minWethOut } = await getOpenLeverageSwapData(
                borrowAmount,
                EULER.VAULTS.WETH,
                200 // 2% slippage for safety
            );
            
            // Calculate min collateral received
            const minCollateralReceived = await calculateMinCollateralReceived(borrowAmount, 300);
            
            const params = {
                collateralTokenCode: "WETH",
                borrowTokenCode: "USDC",
                collateralAmount,
                borrowAmount,
                minCollateralReceived,
                swapData,
                deadline: Math.floor(Date.now() / 1000) + 3600 // 1 hour
            };

            console.log(`\n   Opening leverage position...`);
            console.log(`   Collateral: ${ethers.formatEther(collateralAmount)} WETH`);
            console.log(`   Borrow: ${ethers.formatUnits(borrowAmount, 6)} USDC`);
            console.log(`   Min extra collateral: ${ethers.formatEther(minCollateralReceived)} WETH`);

            // Debug: Check sub-account
            const pluginAddr = await plugin.getAddress();
            const subAccountId = 1n;
            const subAccount = ethers.toBeHex(
                (BigInt(pluginAddr) ^ subAccountId) & ((1n << 160n) - 1n),
                20
            );
            console.log(`   Plugin address: ${pluginAddr}`);
            console.log(`   Sub-account: ${subAccount}`);
            
            const subAccountCode = await ethers.provider.getCode(subAccount);
            console.log(`   Sub-account has code: ${subAccountCode !== "0x"}`);
            if (subAccountCode !== "0x") {
                console.log(`   ⚠️ SUB-ACCOUNT IS A CONTRACT! This will cause EVC_NotAuthorized!`);
            }

            try {
                const tx = await plugin.openLeveragePosition(params);
                const receipt = await tx.wait();
                
                // Get position ID from event
                const event = receipt?.logs.find((log: any) => {
                    try {
                        const parsed = plugin.interface.parseLog(log);
                        return parsed?.name === "LeveragePositionOpened";
                    } catch { return false; }
                });
                
                if (event) {
                    const parsed = plugin.interface.parseLog(event);
                    positionId = parsed?.args?.positionId || 0n;
                    console.log(`   ✅ Position opened! ID: ${positionId}`);
                    console.log(`   Gas used: ${receipt?.gasUsed}`);
                }
                
                // Verify position
                const pos = await plugin.getPosition(positionId);
                expect(pos.isActive).to.be.true;
                expect(pos.collateralVault).to.equal(EULER.VAULTS.WETH);
                expect(pos.borrowVault).to.equal(EULER.VAULTS.USDC);
                
                console.log(`   Position details:`);
                console.log(`     - Sub-account: ${pos.subAccountId}`);
                console.log(`     - Initial collateral: ${ethers.formatEther(pos.initialCollateral)} WETH`);
                console.log(`     - Borrowed: ${ethers.formatUnits(pos.borrowedAmount, 6)} USDC`);
                
            } catch (error: any) {
                console.log(`   ❌ Transaction failed: ${error.message}`);
                
                // Check if it's a known error
                if (error.message.includes("0x")) {
                    console.log(`   Error code: ${error.message.match(/0x[a-fA-F0-9]+/)?.[0]}`);
                }
                
                // Re-throw for test failure
                throw error;
            }
        });

        it("Should have valid health factor", async function () {
            if (positionId === undefined) this.skip();
            
            const health = await plugin.getPositionHealth(positionId);
            
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
            
            const [collateralValue, debtValue] = await plugin.getPositionValue(positionId);
            
            console.log(`   Collateral Value: ${ethers.formatEther(collateralValue)} ETH`);
            console.log(`   Debt Value: ${ethers.formatEther(debtValue)} ETH`);
            
            expect(collateralValue).to.be.gt(0n);
            expect(debtValue).to.be.gt(0n);
            expect(collateralValue).to.be.gt(debtValue); // Healthy = collateral > debt
        });
    });

    describe("2. Add Collateral to Position", function () {
        let testPositionId: bigint;

        before(async function () {
            const count = await plugin.getActivePositionCount();
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
            const healthBefore = await plugin.getPositionHealth(testPositionId);
            const addAmount = ethers.parseEther("0.02");
            
            console.log(`   Health before: ${healthBefore === ethers.MaxUint256 ? "MAX" : ethers.formatEther(healthBefore)}`);
            
            const tx = await plugin.addCollateralToPosition(testPositionId, addAmount);
            await tx.wait();
            
            const healthAfter = await plugin.getPositionHealth(testPositionId);
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
            const count = await plugin.getActivePositionCount();
            if (count === 0n) {
                console.log("   ⚠️ No active positions to close");
                this.skip();
            }
            testPositionId = 0n;
        });

        it("Should close position and return collateral", async function () {
            const pos = await plugin.getPosition(testPositionId);
            if (!pos.isActive) {
                console.log("   ⚠️ Position already closed");
                this.skip();
            }

            // Get debt estimate
            const [, debtValue] = await plugin.getPositionValue(testPositionId);
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

            const tx = await plugin.closeLeveragePosition(testPositionId);
            const receipt = await tx.wait();

            const proxyBalanceAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            const returned = proxyBalanceAfter - proxyBalanceBefore;

            console.log(`   ✅ Position closed!`);
            console.log(`   WETH returned: ${ethers.formatEther(returned)}`);
            console.log(`   Gas used: ${receipt?.gasUsed}`);

            // Verify position is closed
            const posAfter = await plugin.getPosition(testPositionId);
            expect(posAfter.isActive).to.be.false;
        });
    });

    describe("4. Multiple Positions", function () {
        it("Should track active position count correctly", async function () {
            const count = await plugin.getActivePositionCount();
            console.log(`   Active positions: ${count}`);
            
            const allPositions = await plugin.getAllPositions();
            console.log(`   Total positions returned: ${allPositions.length}`);
            
            for (const pos of allPositions) {
                console.log(`   - Position ${pos.positionId}: active=${pos.isActive}`);
            }
        });
    });
});
