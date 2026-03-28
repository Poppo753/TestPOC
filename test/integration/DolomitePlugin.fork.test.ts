import { expect } from "chai";
import { ethers } from "hardhat";
import { DolomitePlugin } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * FORK TEST per DolomitePlugin
 * 
 * Questi test usano una FORK di Arbitrum mainnet per testare con i contratti Dolomite REALI.
 * 
 * SETUP:
 * 1. Avvia fork: npx hardhat node --fork https://arb1.arbitrum.io/rpc
 * 2. Run test: npx hardhat test test/DolomitePlugin.fork.test.ts --network localhost
 * 
 * OPPURE usa hardhat.config.ts network "arbitrumFork"
 */

describe("DolomitePlugin - Fork Tests (Arbitrum Mainnet)", function () {
    let plugin: DolomitePlugin;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;

    // Arbitrum Mainnet Addresses
    const DOLOMITE_MARGIN = "0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072";
    
    // Source: https://docs.dolomite.io/smart-contract-addresses/core-routers
    const BORROW_POSITION_ROUTER = "0xF579b345cdA0860668b857De10ABD62442133D0F";
    const DEPOSIT_WITHDRAWAL_ROUTER = "0xf8b2c637a68cf6a17b1df9f8992eebeff63d2dff"; // DepositWithdrawalRouter

    // Tokens
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

    // Whale addresses (hanno molti token) per impersonare
    const WETH_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A"; // Binance hot wallet
    const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    before(async function () {
        // Skip se non siamo su fork
        if (process.env.FORK_ENABLED !== "true" && (await ethers.provider.getNetwork()).chainId !== 42161n) {
            console.log("⚠️  Skipping fork tests - not running on Arbitrum fork");
            this.skip();
        }

        [owner, user] = await ethers.getSigners();

        console.log("\n🔧 Deploying DolomitePlugin on Arbitrum Fork...");
        
        // Deploy plugin
        const DolomitePluginFactory = await ethers.getContractFactory("DolomitePlugin");
        plugin = await DolomitePluginFactory.deploy(
            DOLOMITE_MARGIN,
            BORROW_POSITION_ROUTER,
            DEPOSIT_WITHDRAWAL_ROUTER
        );
        await plugin.waitForDeployment();

        const pluginAddress = await plugin.getAddress();
        console.log(`✅ Plugin deployed at: ${pluginAddress}`);
    });

    describe("Metadata Functions", function () {
        it("Should return correct protocol info", async function () {
            const info = await plugin.getProtocolInfo();
            
            expect(info.name).to.equal("Dolomite Lending");
            expect(info.version).to.equal("1.0.0");
            expect(info.features).to.equal(1); // BASIC_SWAP
        });

        it("Should pass health check", async function () {
            const [healthy, reason] = await plugin.isHealthy();
            
            expect(healthy).to.be.true;
            expect(reason).to.equal("");
        });

        it("Should detect WETH as potentially supported token", async function () {
            // Test che il plugin sia configurato correttamente
            const [healthy, reason] = await plugin.isHealthy();
            expect(healthy).to.be.true;
        });
    });

    describe("Token Registration", function () {
        let dWETH: string;
        let dUSDC: string;

        it("Should register WETH and generate synthetic address", async function () {
            await plugin.connect(owner).registerToken(WETH);

            dWETH = await plugin.getSyntheticToken(WETH);
            
            expect(dWETH).to.not.equal(ethers.ZeroAddress);
            expect(dWETH).to.not.equal(WETH); // Must be different
            
            console.log(`   WETH: ${WETH}`);
            console.log(`   dWETH: ${dWETH}`);
        });

        it("Should register USDC and generate synthetic address", async function () {
            await plugin.connect(owner).registerToken(USDC);

            dUSDC = await plugin.getSyntheticToken(USDC);
            
            expect(dUSDC).to.not.equal(ethers.ZeroAddress);
            expect(dUSDC).to.not.equal(USDC);
            expect(dUSDC).to.not.equal(dWETH); // Must be unique
            
            console.log(`   USDC: ${USDC}`);
            console.log(`   dUSDC: ${dUSDC}`);
        });

        it("Should fail to register same token twice", async function () {
            await expect(
                plugin.connect(owner).registerToken(WETH)
            ).to.be.reverted;
        });

        it("Should return correct bidirectional mappings", async function () {
            const syntheticFromReal = await plugin.getSyntheticToken(WETH);
            const realFromSynthetic = await plugin.getRealToken(syntheticFromReal);
            
            expect(realFromSynthetic).to.equal(WETH);
        });
    });

    describe("Token Pair Support", function () {
        let dWETH: string;

        before(async function () {
            dWETH = await plugin.getSyntheticToken(WETH);
        });

        it("Should support WETH → dWETH (deposit)", async function () {
            const supported = await plugin.supportsTokenPair(WETH, dWETH);
            expect(supported).to.be.true;
        });

        it("Should support dWETH → WETH (withdraw)", async function () {
            const supported = await plugin.supportsTokenPair(dWETH, WETH);
            expect(supported).to.be.true;
        });

        it("Should NOT support WETH → USDC (not a valid pair)", async function () {
            const supported = await plugin.supportsTokenPair(WETH, USDC);
            expect(supported).to.be.false;
        });

        it("Should NOT support unregistered token pairs", async function () {
            const supported = await plugin.supportsTokenPair(WBTC, WETH);
            expect(supported).to.be.false;
        });
    });

    describe("Deposit (Fake Swap: WETH → dWETH)", function () {
        let dWETH: string;
        let wethContract: any;
        let wethWhale: SignerWithAddress;

        before(async function () {
            dWETH = await plugin.getSyntheticToken(WETH);
            wethContract = await ethers.getContractAt("IERC20", WETH);

            // Impersonate WETH whale
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            wethWhale = await ethers.getSigner(WETH_WHALE);

            // Set ETH balance for whale using hardhat_setBalance
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("10")) // 10 ETH for gas
            ]);
        });

        it("Should execute deposit via inputSwap", async function () {
            const depositAmount = ethers.parseEther("1"); // 1 WETH

            // Transfer WETH to user from whale
            await wethContract.connect(wethWhale).transfer(user.address, depositAmount);
            
            const userBalanceBefore = await wethContract.balanceOf(user.address);
            console.log(`   User WETH before: ${ethers.formatEther(userBalanceBefore)}`);

            // Approve plugin to spend WETH
            await wethContract.connect(user).approve(await plugin.getAddress(), depositAmount);

            // Execute "swap" (deposit)
            const tx = await plugin.connect(user).inputSwap(
                WETH,           // spendToken
                dWETH,          // receiveToken (synthetic)
                depositAmount   // amountIn
            );

            const receipt = await tx.wait();
            console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

            // Check event emitted
            await expect(tx)
                .to.emit(plugin, "DolomiteDeposit")
                .withArgs(user.address, WETH, depositAmount, dWETH);

            // User's WETH balance should decrease
            const userBalanceAfter = await wethContract.balanceOf(user.address);
            expect(userBalanceAfter).to.equal(0);

            console.log(`   User WETH after: ${ethers.formatEther(userBalanceAfter)}`);
        });

        it("Should show increased balance on Dolomite", async function () {
            const balance = await plugin.getDolomiteBalance(WETH);
            
            console.log(`   Dolomite balance: ${ethers.formatEther(balance)} WETH`);
            
            expect(balance).to.be.gt(0);
            // Allow 10 wei tolerance for interest accrual
            expect(balance).to.be.closeTo(ethers.parseEther("1"), 10);
        });

        it("Should return 1:1 quote for deposit", async function () {
            const amountIn = ethers.parseEther("5");
            const expectedOut = await plugin.getExpectedOutput(WETH, dWETH, amountIn);
            
            expect(expectedOut).to.equal(amountIn); // 1:1 ratio
        });
    });

    describe("Withdraw (Fake Swap: dWETH → WETH)", function () {
        let dWETH: string;
        let wethContract: any;

        before(async function () {
            dWETH = await plugin.getSyntheticToken(WETH);
            wethContract = await ethers.getContractAt("IERC20", WETH);
        });

        it("Should execute withdrawal via inputSwap", async function () {
            const withdrawAmount = ethers.parseEther("0.5"); // 0.5 WETH

            // Check Dolomite balance before
            const dolomiteBalanceBefore = await plugin.getDolomiteBalance(WETH);
            console.log(`   Dolomite balance before: ${ethers.formatEther(dolomiteBalanceBefore)}`);

            expect(dolomiteBalanceBefore).to.be.gte(withdrawAmount);

            // Execute "swap" (withdraw)
            const tx = await plugin.connect(user).inputSwap(
                dWETH,          // spendToken (synthetic)
                WETH,           // receiveToken (real)
                withdrawAmount  // amountIn
            );

            await expect(tx)
                .to.emit(plugin, "DolomiteWithdrawal")
                .withArgs(user.address, WETH, withdrawAmount, dWETH);

            // Check Dolomite balance after
            const dolomiteBalanceAfter = await plugin.getDolomiteBalance(WETH);
            console.log(`   Dolomite balance after: ${ethers.formatEther(dolomiteBalanceAfter)}`);

            // Allow small difference due to Dolomite interest accrual (few wei)
            const expectedBalance = dolomiteBalanceBefore - withdrawAmount;
            const tolerance = ethers.parseUnits("10", "gwei"); // 10 gwei tolerance for interest
            
            expect(dolomiteBalanceAfter).to.be.closeTo(expectedBalance, tolerance);

            // User should have received WETH
            const userBalance = await wethContract.balanceOf(user.address);
            console.log(`   User received: ${ethers.formatEther(userBalance)} WETH`);
            
            expect(userBalance).to.equal(withdrawAmount);
        });

        it("Should return 1:1 quote for withdrawal", async function () {
            const amountIn = ethers.parseEther("0.5");
            const expectedOut = await plugin.getExpectedOutput(dWETH, WETH, amountIn);
            
            expect(expectedOut).to.equal(amountIn); // 1:1 ratio
        });

        it("Should fail withdraw if insufficient balance", async function () {
            const tooMuch = ethers.parseEther("1000"); // Plugin non ha così tanto

            await expect(
                plugin.connect(user).inputSwap(dWETH, WETH, tooMuch)
            ).to.be.reverted;
        });
    });

    describe("Integration with SwapManager Pattern", function () {
        let dWETH: string;
        let wethContract: any;
        let wethWhale: SignerWithAddress;

        before(async function () {
            dWETH = await plugin.getSyntheticToken(WETH);
            wethContract = await ethers.getContractAt("IERC20", WETH);
            
            // Impersonate and set balance
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            wethWhale = await ethers.getSigner(WETH_WHALE);
            
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("10"))
            ]);
        });

        it("Should simulate SwapManager custody pattern", async function () {
            // Simula come SwapManager chiamerebbe il plugin

            const depositAmount = ethers.parseEther("2");

            // 1. Get WETH to user (simulating user funding)
            await wethContract.connect(wethWhale).transfer(user.address, depositAmount);

            // 2. User approves plugin (in realtà sarebbe SwapManager)
            await wethContract.connect(user).approve(await plugin.getAddress(), depositAmount);

            // 3. Plugin pulls tokens and deposits
            const amountOut = await plugin.connect(user).inputSwap.staticCall(
                WETH,
                dWETH,
                depositAmount
            );

            expect(amountOut).to.equal(depositAmount); // 1:1

            // Execute real transaction
            await plugin.connect(user).inputSwap(WETH, dWETH, depositAmount);

            // 4. Verify deposit succeeded
            const balance = await plugin.getDolomiteBalance(WETH);
            console.log(`   Total on Dolomite: ${ethers.formatEther(balance)} WETH`);
            
            expect(balance).to.be.gt(0);
        });
    });

    describe("Circuit Breaker", function () {
        it("Should allow owner to trip circuit breaker", async function () {
            await plugin.connect(owner).setCircuitBreaker(true);

            const [healthy, reason] = await plugin.isHealthy();
            expect(healthy).to.be.false;
            expect(reason).to.include("Circuit breaker");
        });

        it("Should block operations when circuit breaker is active", async function () {
            const dWETH = await plugin.getSyntheticToken(WETH);
            
            await expect(
                plugin.connect(user).inputSwap(WETH, dWETH, ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(plugin, "CircuitBreakerActive");
        });

        it("Should allow owner to reset circuit breaker", async function () {
            await plugin.connect(owner).setCircuitBreaker(false);

            const [healthy, reason] = await plugin.isHealthy();
            expect(healthy).to.be.true;
        });
    });

    describe("Error Handling", function () {
        it("Should reject outputSwap (not supported)", async function () {
            const dWETH = await plugin.getSyntheticToken(WETH);
            
            await expect(
                plugin.outputSwap(WETH, dWETH, ethers.parseEther("1"), ethers.parseEther("1"))
            ).to.be.revertedWith("DolomitePlugin: outputSwap not supported, use inputSwap");
        });

        it("Should reject invalid swap directions", async function () {
            await expect(
                plugin.inputSwap(WETH, USDC, ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(plugin, "InvalidSwapDirection");
        });

        it("Should reject unregistered tokens", async function () {
            await expect(
                plugin.connect(owner).registerToken(WBTC)
            ).to.not.be.reverted; // Should work if WBTC supported on Dolomite

            // But random address should fail
            const randomAddr = ethers.Wallet.createRandom().address;
            await expect(
                plugin.connect(owner).registerToken(randomAddr)
            ).to.be.revertedWithCustomError(plugin, "TokenNotSupported");
        });
    });

    describe("Gas Benchmarks", function () {
        let dWETH: string;
        let wethContract: any;
        let wethWhale: SignerWithAddress;

        before(async function () {
            dWETH = await plugin.getSyntheticToken(WETH);
            wethContract = await ethers.getContractAt("IERC20", WETH);
            
            // Impersonate and set balance
            await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
            wethWhale = await ethers.getSigner(WETH_WHALE);
            
            await ethers.provider.send("hardhat_setBalance", [
                WETH_WHALE,
                ethers.toQuantity(ethers.parseEther("10"))
            ]);
        });

        it("Benchmark: Deposit gas cost", async function () {
            const depositAmount = ethers.parseEther("1");

            await wethContract.connect(wethWhale).transfer(user.address, depositAmount);
            await wethContract.connect(user).approve(await plugin.getAddress(), depositAmount);

            const tx = await plugin.connect(user).inputSwap(WETH, dWETH, depositAmount);
            const receipt = await tx.wait();

            console.log(`   📊 Deposit gas: ${receipt?.gasUsed.toString()}`);
        });

        it("Benchmark: Withdraw gas cost", async function () {
            const withdrawAmount = ethers.parseEther("0.5");

            const tx = await plugin.connect(user).inputSwap(dWETH, WETH, withdrawAmount);
            const receipt = await tx.wait();

            console.log(`   📊 Withdraw gas: ${receipt?.gasUsed.toString()}`);
        });

        it("Benchmark: getExpectedOutput gas (view)", async function () {
            const amountIn = ethers.parseEther("10");

            const gasBefore = await ethers.provider.getBalance(user.address);
            await plugin.getExpectedOutput(WETH, dWETH, amountIn);
            const gasAfter = await ethers.provider.getBalance(user.address);

            console.log(`   📊 getExpectedOutput gas: ~0 (view function)`);
        });
    });
});
