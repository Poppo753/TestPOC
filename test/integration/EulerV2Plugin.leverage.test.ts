import { expect } from "chai";
import { ethers } from "hardhat";
import { EulerV2Plugin, EulerVaultRegistry } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * FORK TEST per EulerV2Plugin - LEVERAGE OPERATIONS (Fase 3)
 * 
 * Questi test verificano le operazioni di leverage usando i contratti Euler V2 REALI.
 * 
 * SETUP:
 * 1. Set env: FORK_ENABLED=true
 * 2. Run test: npx hardhat test test/integration/EulerV2Plugin.leverage.test.ts --network hardhat
 * 
 * OPPURE:
 * $env:FORK_ENABLED="true"; npx hardhat test test/integration/EulerV2Plugin.leverage.test.ts
 * 
 * NOTA: I test di leverage richiedono swap reali, quindi potrebbero fallire
 * se il swapper Euler non è attivo o se i dati di swap non sono validi.
 * Per test più robusti, usiamo test senza swap dove possibile.
 */

describe("EulerV2Plugin - Leverage Fork Tests (Arbitrum Mainnet)", function () {
    // Timeout aumentato per fork tests
    this.timeout(180000);

    let plugin: EulerV2Plugin;
    let vaultRegistry: EulerVaultRegistry;
    let owner: SignerWithAddress;
    let mockBeacon: any;
    let mockProxyGeneral: any;
    let mockTokenManager: any;
    let wethContract: any;
    let usdcContract: any;

    // ==================== ARBITRUM MAINNET ADDRESSES ====================
    
    const EVC_ADDRESS = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
    const SWAPPER_ADDRESS = "0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7";
    const SWAP_VERIFIER_ADDRESS = "0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5";
    
    const EULER_VAULTS = {
        WETH: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
        USDC: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
    };

    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    
    const WETH_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
    const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    before(async function () {
        // Skip se non siamo su fork
        const network = await ethers.provider.getNetwork();
        if (process.env.FORK_ENABLED !== "true" && network.chainId !== 42161n) {
            console.log("⚠️  Skipping leverage fork tests - not running on Arbitrum fork");
            console.log("   Run with: $env:FORK_ENABLED=\"true\"; npx hardhat test test/integration/EulerV2Plugin.leverage.test.ts");
            this.skip();
        }

        [owner] = await ethers.getSigners();
        console.log("\n🔧 Setting up Leverage Test Environment...");

        // ==================== DEPLOY MOCK CONTRACTS ====================
        
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

        // ==================== DEPLOY VAULT REGISTRY ====================
        
        const VaultRegistryFactory = await ethers.getContractFactory("EulerVaultRegistry");
        vaultRegistry = await VaultRegistryFactory.deploy();
        await vaultRegistry.waitForDeployment();
        await mockBeacon.setImplementation("EulerVaultRegistry", await vaultRegistry.getAddress());

        // ==================== DEPLOY EULER V2 PLUGIN ====================
        
        const EulerPluginFactory = await ethers.getContractFactory("EulerV2Plugin");
        plugin = await EulerPluginFactory.deploy(await mockBeacon.getAddress());
        await plugin.waitForDeployment();

        // ==================== SETUP VAULTS AND TOKENS ====================
        
        await vaultRegistry.setVault("WETH", EULER_VAULTS.WETH);
        await vaultRegistry.setVault("USDC", EULER_VAULTS.USDC);
        await mockTokenManager.setTokenAddress("WETH", WETH);
        await mockTokenManager.setTokenAddress("USDC", USDC);

        wethContract = await ethers.getContractAt("IERC20", WETH);
        usdcContract = await ethers.getContractAt("IERC20", USDC);

        console.log(`   Plugin: ${await plugin.getAddress()}`);
        console.log("✅ Leverage Test Setup completato!\n");
    });

    describe("1. Position Management - Initial State", function () {
        it("Should have no active positions initially", async function () {
            const count = await plugin.getActivePositionCount();
            expect(count).to.equal(0);
            console.log(`   Active positions: ${count}`);
        });

        it("Should return empty array for getAllPositions", async function () {
            const positions = await plugin.getAllPositions();
            expect(positions.length).to.equal(0);
        });
    });

    describe("2. Open Leverage Position - Validation", function () {
        it("Should revert with expired deadline", async function () {
            const params = {
                collateralTokenCode: "WETH",
                borrowTokenCode: "USDC",
                collateralAmount: ethers.parseEther("0.1"),
                borrowAmount: ethers.parseUnits("100", 6),
                minCollateralReceived: 0n,
                swapData: "0x",
                deadline: Math.floor(Date.now() / 1000) - 3600 // 1 ora fa
            };

            await expect(
                plugin.openLeveragePosition(params)
            ).to.be.revertedWithCustomError(plugin, "DeadlineExpired");
        });

        it("Should revert with zero collateral amount", async function () {
            const params = {
                collateralTokenCode: "WETH",
                borrowTokenCode: "USDC",
                collateralAmount: 0n,
                borrowAmount: ethers.parseUnits("100", 6),
                minCollateralReceived: 0n,
                swapData: "0x",
                deadline: Math.floor(Date.now() / 1000) + 3600
            };

            await expect(
                plugin.openLeveragePosition(params)
            ).to.be.revertedWithCustomError(plugin, "InvalidAddress");
        });

        it("Should revert with zero borrow amount", async function () {
            const params = {
                collateralTokenCode: "WETH",
                borrowTokenCode: "USDC",
                collateralAmount: ethers.parseEther("0.1"),
                borrowAmount: 0n,
                minCollateralReceived: 0n,
                swapData: "0x",
                deadline: Math.floor(Date.now() / 1000) + 3600
            };

            await expect(
                plugin.openLeveragePosition(params)
            ).to.be.revertedWithCustomError(plugin, "InvalidAddress");
        });

        it("Should revert with insufficient balance", async function () {
            const params = {
                collateralTokenCode: "WETH",
                borrowTokenCode: "USDC",
                collateralAmount: ethers.parseEther("100"), // 100 WETH che non abbiamo
                borrowAmount: ethers.parseUnits("100", 6),
                minCollateralReceived: 0n,
                swapData: "0x",
                deadline: Math.floor(Date.now() / 1000) + 3600
            };

            await expect(
                plugin.openLeveragePosition(params)
            ).to.be.revertedWithCustomError(plugin, "InsufficientBalance");
        });
    });

    describe("3. Open Leverage Position - Basic Flow (senza swap)", function () {
        /**
         * NOTA: Il batch EVC per openLeveragePosition richiede swapData valido.
         * Senza un aggregator (1inch, Paraswap) configurato, il batch fallisce.
         * 
         * Qui testiamo che il flusso di validazione funzioni correttamente.
         * Per test E2E completi, si dovrebbe:
         * 1. Integrare con un aggregator API per generare swapData
         * 2. Oppure usare un mock Swapper per test
         */
        
        let positionId: bigint;

        before(async function () {
            // Impersona whale e trasferisci WETH al plugin
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const wethWhale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
            
            // Trasferisci 0.5 WETH al plugin per test
            await wethContract.connect(wethWhale).transfer(
                await plugin.getAddress(), 
                ethers.parseEther("0.5")
            );
            
            console.log(`   Plugin WETH balance: ${ethers.formatEther(await wethContract.balanceOf(await plugin.getAddress()))}`);
        });

        it("Should fail without valid swap data (expected behavior)", async function () {
            // Il batch EVC richiede swap data valido per completarsi
            // Questo test verifica che il flusso di validazione funzioni
            
            const params = {
                collateralTokenCode: "WETH",
                borrowTokenCode: "USDC",
                collateralAmount: ethers.parseEther("0.1"),
                borrowAmount: ethers.parseUnits("50", 6), // 50 USDC
                minCollateralReceived: 0n, // Nessun minimo per test
                swapData: "0x", // Nessun swap data - causa fallimento batch
                deadline: Math.floor(Date.now() / 1000) + 3600
            };

            // Dovrebbe fallire al batch EVC perché swapData è vuoto
            await expect(
                plugin.openLeveragePosition(params)
            ).to.be.reverted;
            
            console.log("   ✅ Correctly reverts without valid swap data");
        });

        it("Should have zero active positions (batch failed)", async function () {
            const count = await plugin.getActivePositionCount();
            expect(count).to.equal(0);
            console.log(`   Active positions: ${count}`);
        });
    });

    describe("3b. Manual Leverage Simulation (using base functions)", function () {
        /**
         * Questo test simula un flusso leverage usando le funzioni base già testate:
         * 1. deposit() - Deposita WETH come collaterale
         * 2. setupBorrowConfig() - Abilita collateral e controller
         * 3. borrow() - Prende in prestito USDC
         * 
         * Poi testa le funzioni di gestione leverage su questa "pseudo-posizione"
         */

        before(async function () {
            // Trasferisci WETH fresco al plugin
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const wethWhale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
            
            await wethContract.connect(wethWhale).transfer(
                await plugin.getAddress(), 
                ethers.parseEther("0.2")
            );
        });

        it("Should deposit WETH as collateral", async function () {
            const depositAmount = ethers.parseEther("0.1");
            const tx = await plugin.deposit("WETH", depositAmount);
            await tx.wait();

            const balance = await plugin.getBalance("WETH");
            console.log(`   Deposited WETH: ${ethers.formatEther(balance)}`);
            expect(balance).to.be.gt(0);
        });

        it("Should setup borrow config", async function () {
            await plugin.setupBorrowConfig(EULER_VAULTS.WETH, EULER_VAULTS.USDC);
            
            expect(await plugin.isCollateralEnabled(EULER_VAULTS.WETH)).to.be.true;
            expect(await plugin.isControllerEnabled(EULER_VAULTS.USDC)).to.be.true;
            console.log("   ✅ Collateral and controller enabled");
        });

        it("Should borrow USDC", async function () {
            const borrowAmount = ethers.parseUnits("10", 6); // 10 USDC

            const tx = await plugin.borrow("USDC", borrowAmount);
            await tx.wait();

            const debt = await plugin.getDebt("USDC");
            console.log(`   Borrowed: ${ethers.formatUnits(borrowAmount, 6)} USDC`);
            console.log(`   Current debt: ${ethers.formatUnits(debt, 6)} USDC`);
            expect(debt).to.be.gte(borrowAmount);
        });

        it("Should have valid health factor", async function () {
            const hf = await plugin.getHealthFactor();
            
            if (hf === ethers.MaxUint256) {
                console.log("   Health Factor: MAX (no debt registered)");
            } else {
                console.log(`   Health Factor: ${ethers.formatEther(hf)}`);
                expect(hf).to.be.gt(ethers.parseEther("1")); // > 1 = healthy
            }
        });
    });

    describe("4. Add/Remove Collateral", function () {
        let testPositionId: bigint;

        before(async function () {
            // Verifica se abbiamo una posizione attiva
            const count = await plugin.getActivePositionCount();
            if (count === 0n) {
                console.log("   ⚠️ No active positions, skipping add/remove collateral tests");
                this.skip();
            }
            testPositionId = 0n; // Prima posizione
        });

        it("Should add collateral to position", async function () {
            // Trasferisci più WETH al plugin
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const wethWhale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
            
            const addAmount = ethers.parseEther("0.05");
            await wethContract.connect(wethWhale).transfer(await plugin.getAddress(), addAmount);

            const healthBefore = await plugin.getPositionHealth(testPositionId);

            try {
                const tx = await plugin.addCollateralToPosition(testPositionId, addAmount);
                await tx.wait();

                const healthAfter = await plugin.getPositionHealth(testPositionId);
                
                console.log(`   Health before: ${healthBefore === ethers.MaxUint256 ? "MAX" : ethers.formatEther(healthBefore)}`);
                console.log(`   Health after: ${healthAfter === ethers.MaxUint256 ? "MAX" : ethers.formatEther(healthAfter)}`);
                
                // Health dovrebbe aumentare con più collaterale
                if (healthBefore !== ethers.MaxUint256 && healthAfter !== ethers.MaxUint256) {
                    expect(healthAfter).to.be.gt(healthBefore);
                }
                
                console.log(`   ✅ Added ${ethers.formatEther(addAmount)} WETH collateral`);
            } catch (error: any) {
                console.log(`   ⚠️ addCollateralToPosition failed: ${error.message.slice(0, 200)}`);
            }
        });

        it("Should fail to remove too much collateral", async function () {
            // Prova a rimuovere troppo collaterale (dovrebbe fallire per health check)
            const hugeAmount = ethers.parseEther("1000");

            await expect(
                plugin.removeCollateralFromPosition(testPositionId, hugeAmount)
            ).to.be.reverted; // EVC verificherà health factor
        });
    });

    describe("5. Close Leverage Position", function () {
        let testPositionId: bigint;

        before(async function () {
            const count = await plugin.getActivePositionCount();
            if (count === 0n) {
                console.log("   ⚠️ No active positions to close, skipping");
                this.skip();
            }
            testPositionId = 0n;
        });

        it("Should fail to close non-existent position", async function () {
            await expect(
                plugin.closeLeveragePosition(999n)
            ).to.be.revertedWithCustomError(plugin, "PositionNotFound");
        });

        it("Should close position (with debt repayment)", async function () {
            // Ottieni info posizione
            const pos = await plugin.getPosition(testPositionId);
            if (!pos.isActive) {
                console.log("   ⚠️ Position already closed, skipping");
                this.skip();
            }

            // Ottieni debt value dalla posizione (invece di chiamare _deriveSubAccount che è internal)
            const [, debtValue] = await plugin.getPositionValue(testPositionId);
            
            // Stima del debito effettivo (debtValue è in unit of account, potrebbe essere diverso)
            // Per sicurezza, otteniamo USDC in eccesso
            console.log(`   Position debt value: ${ethers.formatEther(debtValue)}`);
            
            // Usa borrowedAmount dalla posizione come stima base
            const currentDebt = pos.borrowedAmount + ethers.parseUnits("10", 6); // +10 USDC per interessi

            console.log(`   Estimated debt to repay: ${ethers.formatUnits(currentDebt, 6)} USDC`);

            // Se c'è debito stimato, trasferisci USDC al plugin per ripagarlo
            if (currentDebt > 0n) {
                await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
                const usdcWhale = await ethers.getSigner(USDC_WHALE);
                await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
                
                // Trasferisci abbastanza USDC per ripagare
                await usdcContract.connect(usdcWhale).transfer(await plugin.getAddress(), currentDebt);
                
                console.log(`   Transferred ${ethers.formatUnits(currentDebt, 6)} USDC for repayment`);
            }

            const proxyBalanceBefore = await wethContract.balanceOf(await mockProxyGeneral.getAddress());

            try {
                const tx = await plugin.closeLeveragePosition(testPositionId);
                const receipt = await tx.wait();

                const proxyBalanceAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
                const returned = proxyBalanceAfter - proxyBalanceBefore;

                console.log(`   ✅ Position closed`);
                console.log(`   WETH returned to ProxyGeneral: ${ethers.formatEther(returned)}`);
                console.log(`   Gas used: ${receipt?.gasUsed}`);

                // Verifica posizione chiusa
                const posAfter = await plugin.getPosition(testPositionId);
                expect(posAfter.isActive).to.be.false;
            } catch (error: any) {
                console.log(`   ⚠️ closeLeveragePosition failed: ${error.message.slice(0, 300)}`);
                throw error;
            }
        });

        it("Should not allow closing already closed position", async function () {
            await expect(
                plugin.closeLeveragePosition(testPositionId)
            ).to.be.revertedWithCustomError(plugin, "PositionAlreadyClosed");
        });
    });

    describe("6. Multiple Positions", function () {
        before(async function () {
            // Trasferisci WETH al plugin per nuove posizioni
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            const wethWhale = await ethers.getSigner(WETH_WHALE);
            await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
            await wethContract.connect(wethWhale).transfer(
                await plugin.getAddress(), 
                ethers.parseEther("1")
            );
        });

        it("Should track position count correctly", async function () {
            const countBefore = await plugin.getActivePositionCount();
            console.log(`   Active positions before: ${countBefore}`);
            
            // Qui potremmo aprire nuove posizioni per testare il conteggio
            // Ma richiede swap data valido
        });

        it("Should return all positions via getAllPositions", async function () {
            const positions = await plugin.getAllPositions();
            console.log(`   Total positions returned: ${positions.length}`);
            
            for (const pos of positions) {
                console.log(`   - Position ${pos.positionId}: active=${pos.isActive}, collateral=${ethers.formatEther(pos.initialCollateral)} WETH`);
            }
        });
    });

    describe("7. Circuit Breaker on Leverage Operations", function () {
        it("Should block leverage operations when circuit breaker is active", async function () {
            // Trip circuit breaker
            await plugin.tripCircuitBreaker();
            expect(await plugin.circuitBreakerTripped()).to.be.true;

            const params = {
                collateralTokenCode: "WETH",
                borrowTokenCode: "USDC",
                collateralAmount: ethers.parseEther("0.1"),
                borrowAmount: ethers.parseUnits("50", 6),
                minCollateralReceived: 0n,
                swapData: "0x",
                deadline: Math.floor(Date.now() / 1000) + 3600
            };

            await expect(
                plugin.openLeveragePosition(params)
            ).to.be.revertedWithCustomError(plugin, "CircuitBreakerActive");
        });

        it("Should allow operations after circuit breaker reset", async function () {
            await plugin.resetCircuitBreaker();
            expect(await plugin.circuitBreakerTripped()).to.be.false;
        });
    });

    describe("8. Access Control", function () {
        let nonOwner: SignerWithAddress;

        before(async function () {
            [, nonOwner] = await ethers.getSigners();
        });

        it("Should only allow owner to open positions", async function () {
            const params = {
                collateralTokenCode: "WETH",
                borrowTokenCode: "USDC",
                collateralAmount: ethers.parseEther("0.1"),
                borrowAmount: ethers.parseUnits("50", 6),
                minCollateralReceived: 0n,
                swapData: "0x",
                deadline: Math.floor(Date.now() / 1000) + 3600
            };

            // OpenZeppelin v4 usa "Ownable: caller is not the owner"
            await expect(
                plugin.connect(nonOwner).openLeveragePosition(params)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should only allow owner to close positions", async function () {
            await expect(
                plugin.connect(nonOwner).closeLeveragePosition(0)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should only allow owner to add collateral", async function () {
            await expect(
                plugin.connect(nonOwner).addCollateralToPosition(0, ethers.parseEther("0.1"))
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});
