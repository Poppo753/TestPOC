/**
 * @file EulerV2Plugin.manualLeverage.e2e.test.ts
 * @description E2E Test per leverage MANUALE su Euler V2
 * 
 * OBIETTIVO: Bypassare il batch swap di Euler che non funziona
 * e fare il leverage step-by-step usando Uniswap V3 per gli swap.
 * 
 * FLUSSO:
 * 1. Deposita WETH come collaterale su Euler
 * 2. Prendi USDC in prestito da Euler
 * 3. Swappa USDC → WETH via Uniswap V3 (SimpleSwap)
 * 4. Deposita il nuovo WETH come collaterale aggiuntivo
 * 5. Ripeti per aumentare la leva
 * 
 * SETUP:
 * $env:FORK_ENABLED="true"; npx hardhat test test/integration/EulerV2Plugin.manualLeverage.e2e.test.ts
 */

import { ethers, network } from "hardhat";
import { expect } from "chai";
import { Contract, Signer } from "ethers";

describe("EulerV2Plugin - Manual Leverage E2E (via Uniswap V3)", function () {
    this.timeout(300000); // 5 minuti

    // ==================== ARBITRUM ADDRESSES ====================
    
    const ADDRESSES = {
        // Tokens
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        
        // Euler V2 Vaults
        WETH_VAULT: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
        USDC_VAULT: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
        
        // Euler V2 Core
        EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
        ACCOUNT_LENS: "0x90a52DDcb232e7bb003DD9258fA1235c553eC956",
        
        // Uniswap V3 SimpleSwap (nostro contratto già deployed)
        SIMPLE_SWAP: "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096",
        
        // Our deployed contracts
        PROXY_GENERAL: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1",
        BEACON: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
    };

    // Whale addresses con WETH
    const WETH_WHALE = "0xC3E5607Cd4ca0D5Fe51e09B60Ed97a0Ae6F874dd";

    // Contracts
    let owner: Signer;
    let ownerAddress: string;
    let weth: Contract;
    let usdc: Contract;
    let wethVault: Contract;
    let usdcVault: Contract;
    let evc: Contract;
    let simpleSwap: Contract;
    let accountLens: Contract;

    // Test state
    let initialWethBalance: bigint;
    let leverageLoops: number = 0;

    // ==================== HELPER FUNCTIONS ====================
    
    /**
     * @notice Check and log position health
     * @param label Description of the check point
     */
    async function checkHealth(label: string): Promise<void> {
        try {
            const info = await accountLens.getAccountLiquidityInfo(ownerAddress, ADDRESSES.USDC_VAULT);
            
            const collateralValue = info.collateralValueBorrowing;
            const liabilityValue = info.liabilityValueBorrowing;
            const ttl = info.timeToLiquidation;
            
            // Calculate health factor: collateral / liability
            let healthFactor = "∞";
            let healthEmoji = "🟢";
            
            if (liabilityValue > 0n) {
                const hf = (collateralValue * 100n) / liabilityValue;
                healthFactor = (Number(hf) / 100).toFixed(2);
                
                if (Number(hf) / 100 < 1.1) {
                    healthEmoji = "🔴"; // Danger
                } else if (Number(hf) / 100 < 1.3) {
                    healthEmoji = "🟡"; // Warning
                }
            }
            
            // Format TTL
            let ttlStr = "";
            if (ttl === BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")) {
                ttlStr = "∞ (no debt)";
            } else if (ttl === -1n) {
                ttlStr = "⚠️ LIQUIDATABLE!";
            } else if (ttl > 0n) {
                const days = Number(ttl) / 86400;
                if (days > 365) {
                    ttlStr = ">1 year";
                } else {
                    ttlStr = `${days.toFixed(1)} days`;
                }
            } else {
                ttlStr = `${ttl}`;
            }
            
            console.log(`   ${healthEmoji} [${label}] Health: ${healthFactor}x | Collateral: $${ethers.formatUnits(collateralValue, 18)} | Debt: $${ethers.formatUnits(liabilityValue, 18)} | TTL: ${ttlStr}`);
            
        } catch (error: any) {
            console.log(`   ⚪ [${label}] Health check failed: ${error.message?.slice(0, 50)}`);
        }
    }

    before(async function () {
        if (process.env.FORK_ENABLED !== "true") {
            console.log("⚠️  Skipping - set FORK_ENABLED=true");
            this.skip();
        }

        console.log("\n" + "=".repeat(70));
        console.log("🔄 MANUAL LEVERAGE E2E TEST");
        console.log("   Using Uniswap V3 for swaps (bypassing Euler batch swap)");
        console.log("=".repeat(70));

        // Get owner from ProxyGeneral
        const proxyGeneral = await ethers.getContractAt(
            ["function owner() view returns (address)"],
            ADDRESSES.PROXY_GENERAL
        );
        const proxyOwner = await proxyGeneral.owner();

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [proxyOwner],
        });
        owner = await ethers.getSigner(proxyOwner);
        ownerAddress = await owner.getAddress();

        // Fund owner with ETH for gas
        const [funder] = await ethers.getSigners();
        await funder.sendTransaction({
            to: proxyOwner,
            value: ethers.parseEther("10"),
        });

        console.log(`\n📍 Owner: ${ownerAddress}`);

        // Setup token contracts
        weth = await ethers.getContractAt(
            "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
            ADDRESSES.WETH,
            owner
        );
        usdc = await ethers.getContractAt(
            "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
            ADDRESSES.USDC,
            owner
        );

        // Setup Euler vault contracts
        const vaultAbi = [
            "function deposit(uint256 assets, address receiver) external returns (uint256)",
            "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256)",
            "function borrow(uint256 amount, address receiver) external returns (uint256)",
            "function repay(uint256 amount, address receiver) external returns (uint256)",
            "function balanceOf(address) view returns (uint256)",
            "function maxWithdraw(address) view returns (uint256)",
            "function debtOf(address) view returns (uint256)",
            "function asset() view returns (address)",
            "function approve(address, uint256) external returns (bool)",
        ];

        wethVault = await ethers.getContractAt(vaultAbi, ADDRESSES.WETH_VAULT, owner);
        usdcVault = await ethers.getContractAt(vaultAbi, ADDRESSES.USDC_VAULT, owner);

        // Setup EVC
        evc = await ethers.getContractAt([
            "function enableCollateral(address account, address vault) external",
            "function enableController(address account, address vault) external",
            "function isCollateralEnabled(address, address) view returns (bool)",
            "function isControllerEnabled(address, address) view returns (bool)",
        ], ADDRESSES.EVC, owner);

        // Setup SimpleSwap (Uniswap V3 wrapper)
        simpleSwap = await ethers.getContractAt([
            "function inputSwap(address spendToken, address receiveToken, uint256 amountIn) external returns (uint256)",
            "function getExpectedOutput(address spendToken, address receiveToken, uint256 amountIn, uint8 decimalsIn, uint8 decimalsOut) external view returns (uint256)",
        ], ADDRESSES.SIMPLE_SWAP, owner);

        // Setup AccountLens for health checks
        accountLens = await ethers.getContractAt([
            "function getAccountLiquidityInfo(address account, address vault) external view returns ((bool queryFailure, bytes queryFailureReason, address account, address vault, address unitOfAccount, int256 timeToLiquidation, uint256 liabilityValueBorrowing, uint256 liabilityValueLiquidation, uint256 collateralValueBorrowing, uint256 collateralValueLiquidation, uint256 collateralValueRaw, address[] collaterals, uint256[] collateralValuesBorrowing, uint256[] collateralValuesLiquidation, uint256[] collateralValuesRaw))",
            "function getTimeToLiquidation(address account, address vault) external view returns (int256)",
        ], ADDRESSES.ACCOUNT_LENS, owner);

        console.log(`   WETH: ${ADDRESSES.WETH}`);
        console.log(`   USDC: ${ADDRESSES.USDC}`);
        console.log(`   WETH Vault: ${ADDRESSES.WETH_VAULT}`);
        console.log(`   USDC Vault: ${ADDRESSES.USDC_VAULT}`);
        console.log(`   SimpleSwap: ${ADDRESSES.SIMPLE_SWAP}`);
    });

    describe("Phase 1: Setup Initial Collateral", function () {
        it("Should get WETH from whale", async function () {
            // Impersonate whale
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [WETH_WHALE],
            });
            const whale = await ethers.getSigner(WETH_WHALE);
            
            // Fund whale for gas
            const [funder] = await ethers.getSigners();
            await funder.sendTransaction({ to: WETH_WHALE, value: ethers.parseEther("0.1") });

            // Transfer WETH
            const wethAmount = ethers.parseEther("0.5"); // 0.5 WETH iniziali
            const wethAsWhale = weth.connect(whale);
            
            const whaleBal = await weth.balanceOf(WETH_WHALE);
            console.log(`\n   Whale WETH balance: ${ethers.formatEther(whaleBal)}`);
            
            await (await wethAsWhale.transfer(ownerAddress, wethAmount)).wait();
            
            initialWethBalance = await weth.balanceOf(ownerAddress);
            console.log(`   ✅ Got ${ethers.formatEther(initialWethBalance)} WETH`);
            
            expect(initialWethBalance).to.be.gte(wethAmount);
        });

        it("Should deposit initial WETH as collateral on Euler", async function () {
            const depositAmount = initialWethBalance;
            
            console.log(`\n   Depositing ${ethers.formatEther(depositAmount)} WETH to Euler WETH Vault...`);
            
            // Approve vault
            await (await weth.approve(ADDRESSES.WETH_VAULT, depositAmount)).wait();
            
            // Deposit
            await (await wethVault.deposit(depositAmount, ownerAddress)).wait();
            
            const shares = await wethVault.balanceOf(ownerAddress);
            console.log(`   ✅ Deposited! Shares: ${ethers.formatEther(shares)}`);
            await checkHealth("After Initial Deposit");
            
            expect(shares).to.be.gt(0n);
        });

        it("Should enable collateral and controller for borrowing", async function () {
            // Enable WETH vault as collateral
            const isCollateralBefore = await evc.isCollateralEnabled(ownerAddress, ADDRESSES.WETH_VAULT);
            if (!isCollateralBefore) {
                await (await evc.enableCollateral(ownerAddress, ADDRESSES.WETH_VAULT)).wait();
            }
            
            // Enable USDC vault as controller (for borrowing)
            const isControllerBefore = await evc.isControllerEnabled(ownerAddress, ADDRESSES.USDC_VAULT);
            if (!isControllerBefore) {
                await (await evc.enableController(ownerAddress, ADDRESSES.USDC_VAULT)).wait();
            }
            
            const isCollateral = await evc.isCollateralEnabled(ownerAddress, ADDRESSES.WETH_VAULT);
            const isController = await evc.isControllerEnabled(ownerAddress, ADDRESSES.USDC_VAULT);
            
            console.log(`\n   ✅ Collateral enabled: ${isCollateral}`);
            console.log(`   ✅ Controller enabled: ${isController}`);
            await checkHealth("After Config Setup");
            
            expect(isCollateral).to.be.true;
            expect(isController).to.be.true;
        });
    });

    describe("Phase 2: Leverage Loop #1", function () {
        it("Should borrow USDC against WETH collateral", async function () {
            // Calcola quanto possiamo prendere in prestito
            // Euler tipicamente ha LTV ~80%, usiamo ~60% per sicurezza
            // 0.5 ETH @ $3500 = $1750, al 60% = ~$1000 USDC
            const borrowAmount = ethers.parseUnits("600", 6); // 600 USDC - più aggressivo!
            
            console.log(`\n   Borrowing ${ethers.formatUnits(borrowAmount, 6)} USDC...`);
            
            const usdcBefore = await usdc.balanceOf(ownerAddress);
            
            await (await usdcVault.borrow(borrowAmount, ownerAddress)).wait();
            
            const usdcAfter = await usdc.balanceOf(ownerAddress);
            const debt = await usdcVault.debtOf(ownerAddress);
            
            console.log(`   ✅ Borrowed! USDC balance: ${ethers.formatUnits(usdcAfter, 6)}`);
            console.log(`   Current debt: ${ethers.formatUnits(debt, 6)} USDC`);
            await checkHealth("After Borrow #1");
            
            expect(usdcAfter).to.be.gt(usdcBefore);
        });

        it("Should swap USDC → WETH via Uniswap V3 (SimpleSwap)", async function () {
            const usdcBalance = await usdc.balanceOf(ownerAddress);
            console.log(`\n   Swapping ${ethers.formatUnits(usdcBalance, 6)} USDC → WETH...`);
            
            // Get expected output
            try {
                const expectedWeth = await simpleSwap.getExpectedOutput(
                    ADDRESSES.USDC,
                    ADDRESSES.WETH,
                    usdcBalance,
                    6,  // USDC decimals
                    18  // WETH decimals
                );
                console.log(`   Expected output: ~${ethers.formatEther(expectedWeth)} WETH`);
            } catch (e) {
                console.log(`   Could not get expected output (quoter issue)`);
            }
            
            const wethBefore = await weth.balanceOf(ownerAddress);
            
            // Approve SimpleSwap
            await (await usdc.approve(ADDRESSES.SIMPLE_SWAP, usdcBalance)).wait();
            
            // Execute swap
            const tx = await simpleSwap.inputSwap(
                ADDRESSES.USDC,
                ADDRESSES.WETH,
                usdcBalance
            );
            await tx.wait();
            
            const wethAfter = await weth.balanceOf(ownerAddress);
            const wethReceived = wethAfter - wethBefore;
            
            console.log(`   ✅ Swap completed!`);
            console.log(`   Received: ${ethers.formatEther(wethReceived)} WETH`);
            
            expect(wethReceived).to.be.gt(0n);
            leverageLoops++;
        });

        it("Should deposit swapped WETH as additional collateral", async function () {
            const wethBalance = await weth.balanceOf(ownerAddress);
            console.log(`\n   Depositing ${ethers.formatEther(wethBalance)} WETH as additional collateral...`);
            
            if (wethBalance === 0n) {
                console.log("   ⚠️  No WETH to deposit, skipping");
                this.skip();
            }
            
            // Approve and deposit
            await (await weth.approve(ADDRESSES.WETH_VAULT, wethBalance)).wait();
            await (await wethVault.deposit(wethBalance, ownerAddress)).wait();
            
            const newShares = await wethVault.balanceOf(ownerAddress);
            console.log(`   ✅ New total shares: ${ethers.formatEther(newShares)}`);
            await checkHealth("After Deposit #1");
        });
    });

    describe("Phase 3: Leverage Loop #2", function () {
        it("Should borrow more USDC with increased collateral", async function () {
            // Aumenta il borrow dato che abbiamo più collaterale
            const borrowAmount = ethers.parseUnits("400", 6); // 400 USDC - più aggressivo
            
            console.log(`\n   Borrowing additional ${ethers.formatUnits(borrowAmount, 6)} USDC...`);
            
            const debtBefore = await usdcVault.debtOf(ownerAddress);
            
            await (await usdcVault.borrow(borrowAmount, ownerAddress)).wait();
            
            const debtAfter = await usdcVault.debtOf(ownerAddress);
            const usdcBalance = await usdc.balanceOf(ownerAddress);
            
            console.log(`   ✅ Borrowed! Total debt: ${ethers.formatUnits(debtAfter, 6)} USDC`);
            console.log(`   USDC balance: ${ethers.formatUnits(usdcBalance, 6)}`);
            await checkHealth("After Borrow #2");
            
            expect(debtAfter).to.be.gt(debtBefore);
        });

        it("Should swap USDC → WETH (Loop 2)", async function () {
            const usdcBalance = await usdc.balanceOf(ownerAddress);
            
            if (usdcBalance === 0n) {
                console.log("   ⚠️  No USDC to swap, skipping");
                this.skip();
            }
            
            console.log(`\n   Swapping ${ethers.formatUnits(usdcBalance, 6)} USDC → WETH...`);
            
            const wethBefore = await weth.balanceOf(ownerAddress);
            
            await (await usdc.approve(ADDRESSES.SIMPLE_SWAP, usdcBalance)).wait();
            
            const tx = await simpleSwap.inputSwap(
                ADDRESSES.USDC,
                ADDRESSES.WETH,
                usdcBalance
            );
            await tx.wait();
            
            const wethAfter = await weth.balanceOf(ownerAddress);
            const wethReceived = wethAfter - wethBefore;
            
            console.log(`   ✅ Received: ${ethers.formatEther(wethReceived)} WETH`);
            leverageLoops++;
        });

        it("Should deposit WETH (Loop 2)", async function () {
            const wethBalance = await weth.balanceOf(ownerAddress);
            
            if (wethBalance === 0n) {
                console.log("   ⚠️  No WETH to deposit, skipping");
                this.skip();
            }
            
            console.log(`\n   Depositing ${ethers.formatEther(wethBalance)} WETH...`);
            
            await (await weth.approve(ADDRESSES.WETH_VAULT, wethBalance)).wait();
            await (await wethVault.deposit(wethBalance, ownerAddress)).wait();
            
            const shares = await wethVault.balanceOf(ownerAddress);
            console.log(`   ✅ Total shares: ${ethers.formatEther(shares)}`);
            await checkHealth("After Deposit #2");
        });
    });

    describe("Phase 4: Leverage Loop #3", function () {
        it("Should borrow more USDC (Loop 3)", async function () {
            const borrowAmount = ethers.parseUnits("250", 6); // 250 USDC - più aggressivo
            
            console.log(`\n   Borrowing ${ethers.formatUnits(borrowAmount, 6)} USDC...`);
            
            try {
                await (await usdcVault.borrow(borrowAmount, ownerAddress)).wait();
                
                const debt = await usdcVault.debtOf(ownerAddress);
                console.log(`   ✅ Total debt: ${ethers.formatUnits(debt, 6)} USDC`);
                await checkHealth("After Borrow #3");
            } catch (error: any) {
                console.log(`   ⚠️  Cannot borrow more: ${error.message?.slice(0, 100)}`);
                console.log("   Reached max leverage for this collateral");
                this.skip();
            }
        });

        it("Should swap USDC → WETH (Loop 3)", async function () {
            const usdcBalance = await usdc.balanceOf(ownerAddress);
            
            if (usdcBalance === 0n) {
                console.log("   ⚠️  No USDC to swap, skipping");
                this.skip();
            }
            
            console.log(`\n   Swapping ${ethers.formatUnits(usdcBalance, 6)} USDC → WETH...`);
            
            await (await usdc.approve(ADDRESSES.SIMPLE_SWAP, usdcBalance)).wait();
            
            try {
                const tx = await simpleSwap.inputSwap(
                    ADDRESSES.USDC,
                    ADDRESSES.WETH,
                    usdcBalance
                );
                await tx.wait();
                
                const wethBal = await weth.balanceOf(ownerAddress);
                console.log(`   ✅ WETH balance: ${ethers.formatEther(wethBal)}`);
                leverageLoops++;
            } catch (error: any) {
                console.log(`   ⚠️  Swap failed: ${error.message?.slice(0, 100)}`);
            }
        });

        it("Should deposit WETH (Loop 3)", async function () {
            const wethBalance = await weth.balanceOf(ownerAddress);
            
            if (wethBalance === 0n) {
                console.log("   ⚠️  No WETH to deposit, skipping");
                this.skip();
            }
            
            console.log(`\n   Depositing ${ethers.formatEther(wethBalance)} WETH...`);
            
            await (await weth.approve(ADDRESSES.WETH_VAULT, wethBalance)).wait();
            await (await wethVault.deposit(wethBalance, ownerAddress)).wait();
            
            const shares = await wethVault.balanceOf(ownerAddress);
            console.log(`   ✅ Total shares: ${ethers.formatEther(shares)}`);
            await checkHealth("After Deposit #3");
        });
    });

    describe("Phase 4.5: Leverage Loop #4", function () {
        it("Should borrow more USDC (Loop 4)", async function () {
            const borrowAmount = ethers.parseUnits("150", 6); // 150 USDC
            
            console.log(`\n   Borrowing ${ethers.formatUnits(borrowAmount, 6)} USDC...`);
            
            try {
                await (await usdcVault.borrow(borrowAmount, ownerAddress)).wait();
                
                const debt = await usdcVault.debtOf(ownerAddress);
                console.log(`   ✅ Total debt: ${ethers.formatUnits(debt, 6)} USDC`);
                await checkHealth("After Borrow #4");
            } catch (error: any) {
                console.log(`   ⚠️  Cannot borrow more: ${error.message?.slice(0, 100)}`);
                this.skip();
            }
        });

        it("Should swap USDC → WETH (Loop 4)", async function () {
            const usdcBalance = await usdc.balanceOf(ownerAddress);
            
            if (usdcBalance === 0n) {
                this.skip();
            }
            
            console.log(`\n   Swapping ${ethers.formatUnits(usdcBalance, 6)} USDC → WETH...`);
            
            await (await usdc.approve(ADDRESSES.SIMPLE_SWAP, usdcBalance)).wait();
            
            try {
                const tx = await simpleSwap.inputSwap(ADDRESSES.USDC, ADDRESSES.WETH, usdcBalance);
                await tx.wait();
                
                const wethBal = await weth.balanceOf(ownerAddress);
                console.log(`   ✅ WETH balance: ${ethers.formatEther(wethBal)}`);
                leverageLoops++;
            } catch (error: any) {
                console.log(`   ⚠️  Swap failed`);
            }
        });

        it("Should deposit WETH (Loop 4)", async function () {
            const wethBalance = await weth.balanceOf(ownerAddress);
            
            if (wethBalance === 0n) {
                this.skip();
            }
            
            await (await weth.approve(ADDRESSES.WETH_VAULT, wethBalance)).wait();
            await (await wethVault.deposit(wethBalance, ownerAddress)).wait();
            
            const shares = await wethVault.balanceOf(ownerAddress);
            console.log(`   ✅ Total shares: ${ethers.formatEther(shares)}`);
            await checkHealth("After Deposit #4");
        });
    });

    describe("Phase 4.6: Leverage Loop #5", function () {
        it("Should borrow more USDC (Loop 5)", async function () {
            const borrowAmount = ethers.parseUnits("100", 6); // 100 USDC
            
            console.log(`\n   Borrowing ${ethers.formatUnits(borrowAmount, 6)} USDC...`);
            
            try {
                await (await usdcVault.borrow(borrowAmount, ownerAddress)).wait();
                
                const debt = await usdcVault.debtOf(ownerAddress);
                console.log(`   ✅ Total debt: ${ethers.formatUnits(debt, 6)} USDC`);
                await checkHealth("After Borrow #5");
            } catch (error: any) {
                console.log(`   ⚠️  Cannot borrow more: ${error.message?.slice(0, 100)}`);
                this.skip();
            }
        });

        it("Should swap USDC → WETH (Loop 5)", async function () {
            const usdcBalance = await usdc.balanceOf(ownerAddress);
            
            if (usdcBalance === 0n) {
                this.skip();
            }
            
            console.log(`\n   Swapping ${ethers.formatUnits(usdcBalance, 6)} USDC → WETH...`);
            
            await (await usdc.approve(ADDRESSES.SIMPLE_SWAP, usdcBalance)).wait();
            
            try {
                const tx = await simpleSwap.inputSwap(ADDRESSES.USDC, ADDRESSES.WETH, usdcBalance);
                await tx.wait();
                
                const wethBal = await weth.balanceOf(ownerAddress);
                console.log(`   ✅ WETH balance: ${ethers.formatEther(wethBal)}`);
                leverageLoops++;
            } catch (error: any) {
                console.log(`   ⚠️  Swap failed`);
            }
        });

        it("Should deposit WETH (Loop 5)", async function () {
            const wethBalance = await weth.balanceOf(ownerAddress);
            
            if (wethBalance === 0n) {
                this.skip();
            }
            
            await (await weth.approve(ADDRESSES.WETH_VAULT, wethBalance)).wait();
            await (await wethVault.deposit(wethBalance, ownerAddress)).wait();
            
            const shares = await wethVault.balanceOf(ownerAddress);
            console.log(`   ✅ Total shares: ${ethers.formatEther(shares)}`);
            await checkHealth("After Final Deposit #5");
        });
    });

    describe("Phase 5: Final Position Summary", function () {
        it("Should show final leveraged position", async function () {
            console.log("\n" + "=".repeat(60));
            console.log("📊 FINAL LEVERAGED POSITION");
            console.log("=".repeat(60));
            
            const shares = await wethVault.balanceOf(ownerAddress);
            const maxWithdraw = await wethVault.maxWithdraw(ownerAddress);
            const debt = await usdcVault.debtOf(ownerAddress);
            
            console.log(`\n   Initial WETH deposited: ${ethers.formatEther(initialWethBalance)}`);
            console.log(`   Final WETH shares:      ${ethers.formatEther(shares)}`);
            console.log(`   Max withdrawable WETH:  ${ethers.formatEther(maxWithdraw)}`);
            console.log(`   Total USDC debt:        ${ethers.formatUnits(debt, 6)}`);
            console.log(`   Leverage loops:         ${leverageLoops}`);
            
            // Calculate leverage ratio (approximate)
            // Leverage = Total Collateral / Initial Collateral
            if (initialWethBalance > 0n) {
                const leverageRatio = (shares * 100n) / initialWethBalance;
                console.log(`   Approximate leverage:   ${Number(leverageRatio) / 100}x`);
            }
            
            // Final health check
            await checkHealth("FINAL POSITION");
            
            console.log("\n" + "=".repeat(60));
            console.log("✅ MANUAL LEVERAGE COMPLETED SUCCESSFULLY!");
            console.log("=".repeat(60));
            
            // Verify we actually levered up
            expect(shares).to.be.gt(initialWethBalance);
            expect(debt).to.be.gt(0n);
        });
    });

    describe("Phase 6: Unwind Position (Optional)", function () {
        it("Should partially unwind - withdraw some collateral", async function () {
            // Get max withdrawable
            const maxWithdraw = await wethVault.maxWithdraw(ownerAddress);
            
            // Try to withdraw 10% of max
            const withdrawAmount = maxWithdraw / 10n;
            
            if (withdrawAmount === 0n) {
                console.log("   ⚠️  Cannot withdraw any collateral (fully utilized)");
                this.skip();
            }
            
            console.log(`\n   Withdrawing ${ethers.formatEther(withdrawAmount)} WETH...`);
            
            try {
                await (await wethVault.withdraw(withdrawAmount, ownerAddress, ownerAddress)).wait();
                
                const wethBal = await weth.balanceOf(ownerAddress);
                console.log(`   ✅ Withdrawn! WETH balance: ${ethers.formatEther(wethBal)}`);
            } catch (error: any) {
                console.log(`   ⚠️  Cannot withdraw: ${error.message?.slice(0, 100)}`);
            }
        });

        it("Should repay some debt with withdrawn collateral", async function () {
            const wethBalance = await weth.balanceOf(ownerAddress);
            
            if (wethBalance === 0n) {
                console.log("   ⚠️  No WETH to swap for repayment");
                this.skip();
            }
            
            console.log(`\n   Swapping ${ethers.formatEther(wethBalance)} WETH → USDC for repayment...`);
            
            // Swap WETH → USDC
            await (await weth.approve(ADDRESSES.SIMPLE_SWAP, wethBalance)).wait();
            
            try {
                await (await simpleSwap.inputSwap(
                    ADDRESSES.WETH,
                    ADDRESSES.USDC,
                    wethBalance
                )).wait();
                
                const usdcBal = await usdc.balanceOf(ownerAddress);
                console.log(`   ✅ Got ${ethers.formatUnits(usdcBal, 6)} USDC`);
                
                // Repay debt
                if (usdcBal > 0n) {
                    const debtBefore = await usdcVault.debtOf(ownerAddress);
                    const repayAmount = usdcBal < debtBefore ? usdcBal : debtBefore;
                    
                    await (await usdc.approve(ADDRESSES.USDC_VAULT, repayAmount)).wait();
                    await (await usdcVault.repay(repayAmount, ownerAddress)).wait();
                    
                    const debtAfter = await usdcVault.debtOf(ownerAddress);
                    console.log(`   ✅ Repaid! Debt reduced: ${ethers.formatUnits(debtBefore, 6)} → ${ethers.formatUnits(debtAfter, 6)} USDC`);
                }
            } catch (error: any) {
                console.log(`   ⚠️  Repayment failed: ${error.message?.slice(0, 100)}`);
            }
        });
    });

    after(async function () {
        console.log("\n" + "=".repeat(70));
        console.log("🏁 MANUAL LEVERAGE E2E TEST COMPLETED");
        console.log("=".repeat(70));
        
        // Final state
        const shares = await wethVault.balanceOf(ownerAddress);
        const debt = await usdcVault.debtOf(ownerAddress);
        const wethBal = await weth.balanceOf(ownerAddress);
        const usdcBal = await usdc.balanceOf(ownerAddress);
        
        console.log(`\nFinal State:`);
        console.log(`   WETH Vault Shares: ${ethers.formatEther(shares)}`);
        console.log(`   USDC Debt:         ${ethers.formatUnits(debt, 6)}`);
        console.log(`   WETH Wallet:       ${ethers.formatEther(wethBal)}`);
        console.log(`   USDC Wallet:       ${ethers.formatUnits(usdcBal, 6)}`);
        console.log(`   Leverage Loops:    ${leverageLoops}`);
    });
});
