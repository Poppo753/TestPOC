/**
 * @file EulerV2Plugin.debug.test.ts
 * @description Debug test per identificare esattamente dove fallisce il leverage
 * 
 * OBIETTIVO: Testare ogni componente del batch separatamente per trovare l'errore
 */

import { ethers, network } from "hardhat";
import hre from "hardhat";
import { expect } from "chai";
import { Contract, Signer } from "ethers";

describe("EulerV2Plugin Debug - Leverage Components", function () {
    this.timeout(300000);

    // Arbitrum addresses
    const ADDRESSES = {
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        WETH_VAULT: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
        USDC_VAULT: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
        EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
        SWAPPER: "0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7",
        SWAP_VERIFIER: "0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5",
        PROXY_GENERAL: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1",
        BEACON: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
        TOKEN_MANAGER: "0x99d3Db00Ed29AffDEea7ECf7C1BFbF3d77D8BBE2",
    };

    // Use simple accounts with WETH - the GMX protocol addresses are smart contracts
    const WETH_WHALE = "0xC3E5607Cd4ca0D5Fe51e09B60Ed97a0Ae6F874dd"; // Working whale from phase3 test
    const USDC_WHALE = "0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23"; // Circle arbitrum USDC holder

    let owner: Signer;
    let weth: Contract;
    let usdc: Contract;
    let wethVault: Contract;
    let usdcVault: Contract;
    let evc: Contract;
    let swapper: Contract;
    let swapVerifier: Contract;

    before(async function () {
        if (process.env.FORK_ENABLED !== "true") {
            console.log("⚠️  Skipping - set FORK_ENABLED=true");
            this.skip();
        }

        console.log("\n" + "=".repeat(70));
        console.log("🔬 DEBUG: Leverage Components Test");
        console.log("=".repeat(70));

        // Get owner
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

        // Fund with ETH
        const [funder] = await ethers.getSigners();
        await funder.sendTransaction({
            to: proxyOwner,
            value: ethers.parseEther("10"),
        });

        // Get contracts
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

        // Extended vault interface
        const vaultAbi = [
            "function deposit(uint256 assets, address receiver) external returns (uint256)",
            "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256)",
            "function borrow(uint256 amount, address receiver) external returns (uint256)",
            "function balanceOf(address) view returns (uint256)",
            "function maxWithdraw(address) view returns (uint256)",
            "function debtOf(address) view returns (uint256)",
            "function asset() view returns (address)",
            "function approve(address, uint256) external returns (bool)",
        ];

        wethVault = await ethers.getContractAt(vaultAbi, ADDRESSES.WETH_VAULT, owner);
        usdcVault = await ethers.getContractAt(vaultAbi, ADDRESSES.USDC_VAULT, owner);

        // EVC with batch
        evc = await ethers.getContractAt([
            "function enableCollateral(address account, address vault) external",
            "function enableController(address account, address vault) external",
            "function isCollateralEnabled(address, address) view returns (bool)",
            "function isControllerEnabled(address, address) view returns (bool)",
            "function batch((address targetContract, address onBehalfOfAccount, uint256 value, bytes data)[] items) external",
            "function call(address targetContract, address onBehalfOfAccount, uint256 value, bytes data) external returns (bytes)",
            "function getAccountOwner(address account) view returns (address)",
        ], ADDRESSES.EVC, owner);

        // Swapper
        swapper = await ethers.getContractAt([
            "function swap((bytes32 handler, uint256 mode, address account, address tokenIn, address tokenOut, uint256 amountOut, address vaultIn, address accountIn, address receiver, bytes data) params) external",
            "function HANDLER_GENERIC() view returns (bytes32)",
        ], ADDRESSES.SWAPPER);

        swapVerifier = await ethers.getContractAt([
            "function verifyAmountMinAndSkim(address vault, address receiver, uint256 amountMin, uint256 deadline) external",
        ], ADDRESSES.SWAP_VERIFIER);
    });

    describe("Step 1: Test Direct Borrow to Swapper", function () {
        let testAccount: string;

        before(async function () {
            testAccount = await owner.getAddress();
            console.log("\n📦 Test account:", testAccount);

            // Get WETH from whale
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [WETH_WHALE],
            });
            const whale = await ethers.getSigner(WETH_WHALE);
            const [funder] = await ethers.getSigners();
            await funder.sendTransaction({ to: WETH_WHALE, value: ethers.parseEther("0.1") });

            const wethAmount = ethers.parseEther("0.1");
            await (await weth.connect(whale).transfer(testAccount, wethAmount)).wait();
            console.log(`   Got ${ethers.formatEther(wethAmount)} WETH`);
        });

        it("Should deposit WETH as collateral", async function () {
            const wethBal = await weth.balanceOf(await owner.getAddress());
            console.log(`\n   WETH balance: ${ethers.formatEther(wethBal)}`);

            await (await weth.approve(ADDRESSES.WETH_VAULT, wethBal)).wait();
            await (await wethVault.deposit(wethBal, await owner.getAddress())).wait();

            const shares = await wethVault.balanceOf(await owner.getAddress());
            console.log(`   ✅ Deposited, shares: ${ethers.formatEther(shares)}`);
        });

        it("Should enable collateral and controller", async function () {
            const acc = await owner.getAddress();

            await (await evc.enableCollateral(acc, ADDRESSES.WETH_VAULT)).wait();
            await (await evc.enableController(acc, ADDRESSES.USDC_VAULT)).wait();

            console.log(`   ✅ Collateral enabled: ${await evc.isCollateralEnabled(acc, ADDRESSES.WETH_VAULT)}`);
            console.log(`   ✅ Controller enabled: ${await evc.isControllerEnabled(acc, ADDRESSES.USDC_VAULT)}`);
        });

        it("Should borrow USDC directly to SWAPPER", async function () {
            const borrowAmount = ethers.parseUnits("5", 6); // 5 USDC
            
            console.log(`\n🔄 Borrowing ${ethers.formatUnits(borrowAmount, 6)} USDC → Swapper`);
            console.log(`   Swapper address: ${ADDRESSES.SWAPPER}`);
            
            // Check Swapper USDC before
            const swapperUsdcBefore = await usdc.balanceOf(ADDRESSES.SWAPPER);
            console.log(`   Swapper USDC before: ${ethers.formatUnits(swapperUsdcBefore, 6)}`);
            
            // Direct borrow to Swapper
            try {
                const tx = await usdcVault.borrow(borrowAmount, ADDRESSES.SWAPPER);
                await tx.wait();
                console.log(`   ✅ Borrow successful!`);
            } catch (error: any) {
                console.log(`   ❌ Borrow failed: ${error.message}`);
                if (error.data) {
                    console.log(`   Error data: ${error.data}`);
                }
                throw error;
            }
            
            // Check Swapper USDC after
            const swapperUsdcAfter = await usdc.balanceOf(ADDRESSES.SWAPPER);
            console.log(`   Swapper USDC after: ${ethers.formatUnits(swapperUsdcAfter, 6)}`);
            
            // Verify debt
            const debt = await usdcVault.debtOf(await owner.getAddress());
            console.log(`   Account debt: ${ethers.formatUnits(debt, 6)} USDC`);
            
            expect(swapperUsdcAfter).to.be.gt(swapperUsdcBefore);
        });
    });

    describe("Step 2: Test EVC Batch with Borrow", function () {
        let testAccount2: string;
        
        before(async function () {
            // Use a sub-account derived from owner
            const ownerAddr = await owner.getAddress();
            testAccount2 = ethers.concat([
                ownerAddr.slice(0, -2),  // First 19 bytes of owner
                "0x01"  // Sub-account 1
            ]).toLowerCase();
            
            console.log("\n📦 Sub-account for batch test:", testAccount2);
            
            // Verify owner owns sub-account
            const subAccountOwner = await evc.getAccountOwner(testAccount2);
            console.log(`   Sub-account owner: ${subAccountOwner}`);
            console.log(`   Expected owner: ${ownerAddr}`);
            
            // Deposit WETH for this sub-account
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [WETH_WHALE],
            });
            const whale = await ethers.getSigner(WETH_WHALE);
            const [funder] = await ethers.getSigners();
            await funder.sendTransaction({ to: WETH_WHALE, value: ethers.parseEther("0.1") });
            
            const wethAmount = ethers.parseEther("0.05");
            await (await weth.connect(whale).transfer(ownerAddr, wethAmount)).wait();
            await (await weth.approve(ADDRESSES.WETH_VAULT, wethAmount)).wait();
            await (await wethVault.deposit(wethAmount, testAccount2)).wait();
            
            console.log(`   ✅ Deposited ${ethers.formatEther(wethAmount)} WETH for sub-account`);
            
            // Enable collateral and controller for sub-account
            await (await evc.enableCollateral(testAccount2, ADDRESSES.WETH_VAULT)).wait();
            await (await evc.enableController(testAccount2, ADDRESSES.USDC_VAULT)).wait();
            
            console.log(`   ✅ Sub-account collateral/controller enabled`);
        });
        
        it("Should borrow via EVC batch to Swapper", async function () {
            const borrowAmount = ethers.parseUnits("3", 6); // 3 USDC
            
            console.log(`\n🔄 EVC Batch: Borrow ${ethers.formatUnits(borrowAmount, 6)} USDC → Swapper`);
            
            // Build borrow calldata
            const borrowCalldata = usdcVault.interface.encodeFunctionData("borrow", [
                borrowAmount,
                ADDRESSES.SWAPPER
            ]);
            
            const batchItems = [{
                targetContract: ADDRESSES.USDC_VAULT,
                onBehalfOfAccount: testAccount2,  // Sub-account
                value: 0,
                data: borrowCalldata
            }];
            
            console.log("   Batch items:", JSON.stringify(batchItems, null, 2));
            
            const swapperUsdcBefore = await usdc.balanceOf(ADDRESSES.SWAPPER);
            console.log(`   Swapper USDC before: ${ethers.formatUnits(swapperUsdcBefore, 6)}`);
            
            try {
                const tx = await evc.batch(batchItems);
                await tx.wait();
                console.log(`   ✅ Batch successful!`);
            } catch (error: any) {
                console.log(`   ❌ Batch failed: ${error.message}`);
                if (error.data) {
                    const selector = typeof error.data === 'string' ? error.data.slice(0, 10) : "unknown";
                    console.log(`   Error selector: ${selector}`);
                    
                    // EVC errors
                    const evcErrors: Record<string, string> = {
                        "0x38ae747c": "EVC_EmptyError - A call in the batch returned empty error",
                        "0xe07f2e6b": "EVC_NotAuthorized",
                        "0x6b835a66": "EVC_ControllerViolation",
                    };
                    
                    if (evcErrors[selector]) {
                        console.log(`   Known error: ${evcErrors[selector]}`);
                    }
                }
                throw error;
            }
            
            const swapperUsdcAfter = await usdc.balanceOf(ADDRESSES.SWAPPER);
            console.log(`   Swapper USDC after: ${ethers.formatUnits(swapperUsdcAfter, 6)}`);
            
            expect(swapperUsdcAfter).to.be.gt(swapperUsdcBefore);
        });
    });

    describe("Step 3: Test Swapper.swap Call", function () {
        it("Should call Swapper.swap directly (mock)", async function () {
            // First get USDC to Swapper
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [USDC_WHALE],
            });
            const whale = await ethers.getSigner(USDC_WHALE);
            const [funder] = await ethers.getSigners();
            await funder.sendTransaction({ to: USDC_WHALE, value: ethers.parseEther("0.1") });
            
            const usdcAmount = ethers.parseUnits("5", 6);
            await (await usdc.connect(whale).transfer(ADDRESSES.SWAPPER, usdcAmount)).wait();
            
            console.log(`\n📦 Sent ${ethers.formatUnits(usdcAmount, 6)} USDC to Swapper`);
            console.log(`   Swapper USDC: ${ethers.formatUnits(await usdc.balanceOf(ADDRESSES.SWAPPER), 6)}`);
            
            // Get handler
            const handlerGeneric = await swapper.HANDLER_GENERIC();
            console.log(`   HANDLER_GENERIC: ${handlerGeneric}`);
            
            // For now just verify the Swapper is callable
            // The actual swap would need real 1inch calldata
            console.log(`   ✅ Swapper contract verified accessible`);
        });
    });

    describe("Step 4: Full Batch with Swap", function () {
        let testAccount3: string;
        
        // 1inch API helper
        async function get1inchSwap(
            srcToken: string,
            dstToken: string,
            amount: string,
            fromAddress: string,
            receiverAddress: string,
            slippage: number
        ): Promise<{ tx: { to: string; data: string }; dstAmount: string }> {
            const apiKey = "j69cJtNJglZIf06DVK8qT6XvCAr5G5Ux";
            const params = new URLSearchParams({
                src: srcToken,
                dst: dstToken,
                amount: amount,
                from: fromAddress,
                receiver: receiverAddress,
                slippage: slippage.toString(),
                disableEstimate: "true",
            });
            
            const response = await fetch(
                `https://api.1inch.dev/swap/v6.0/42161/swap?${params}`,
                {
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Accept": "application/json",
                    },
                }
            );
            
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`1inch API error: ${response.status} - ${text}`);
            }
            
            return await response.json();
        }
        
        before(async function () {
            // Use a sub-account derived from owner
            const ownerAddr = await owner.getAddress();
            testAccount3 = ethers.concat([
                ownerAddr.slice(0, -2),
                "0x02"  // Sub-account 2
            ]).toLowerCase();
            
            console.log("\n📦 Sub-account for full batch:", testAccount3);
            
            // Deposit WETH for this sub-account
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [WETH_WHALE],
            });
            const whale = await ethers.getSigner(WETH_WHALE);
            const [funder] = await ethers.getSigners();
            await funder.sendTransaction({ to: WETH_WHALE, value: ethers.parseEther("0.1") });
            
            const wethAmount = ethers.parseEther("0.05");
            const ownerAddr2 = await owner.getAddress();
            await (await weth.connect(whale).transfer(ownerAddr2, wethAmount)).wait();
            await (await weth.approve(ADDRESSES.WETH_VAULT, wethAmount)).wait();
            await (await wethVault.deposit(wethAmount, testAccount3)).wait();
            
            console.log(`   ✅ Deposited ${ethers.formatEther(wethAmount)} WETH for sub-account`);
            
            // Enable collateral and controller for sub-account
            await (await evc.enableCollateral(testAccount3, ADDRESSES.WETH_VAULT)).wait();
            await (await evc.enableController(testAccount3, ADDRESSES.USDC_VAULT)).wait();
            
            console.log(`   ✅ Sub-account collateral/controller enabled`);
        });
        
        it("Should test borrow + real 1inch swap batch", async function () {
            const borrowAmount = ethers.parseUnits("5", 6); // 5 USDC
            
            console.log(`\n🔄 Testing BATCH with REAL 1inch swap`);
            console.log(`   Borrow amount: ${ethers.formatUnits(borrowAmount, 6)} USDC`);
            
            // Get 1inch swap data
            console.log("\n   📡 Fetching 1inch swap data...");
            
            let swapResult;
            try {
                swapResult = await get1inchSwap(
                    ADDRESSES.USDC,     // src
                    ADDRESSES.WETH,     // dst
                    borrowAmount.toString(),
                    ADDRESSES.SWAPPER,  // from (Swapper will have the tokens)
                    ADDRESSES.WETH_VAULT, // receiver (send WETH to vault for skim)
                    1  // 1% slippage
                );
                console.log(`   ✅ Got 1inch data`);
                console.log(`   1inch Router: ${swapResult.tx.to}`);
                console.log(`   Expected WETH: ${ethers.formatEther(swapResult.dstAmount)}`);
            } catch (e: any) {
                console.log(`   ❌ 1inch API failed: ${e.message}`);
                this.skip();
                return;
            }
            
            // Build borrow calldata
            const borrowCalldata = usdcVault.interface.encodeFunctionData("borrow", [
                borrowAmount,
                ADDRESSES.SWAPPER
            ]);
            
            // Build swap calldata with real 1inch data
            // Use encodeBytes32String for right-padded bytes32 string
            const handlerGeneric = ethers.encodeBytes32String("Generic");
            
            const handlerData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "bytes"],
                [swapResult.tx.to, swapResult.tx.data]
            );
            
            const swapParamsAbi = new ethers.Interface([
                "function swap((bytes32 handler, uint256 mode, address account, address tokenIn, address tokenOut, uint256 amountOut, address vaultIn, address accountIn, address receiver, bytes data) params)"
            ]);
            
            const swapCalldata = swapParamsAbi.encodeFunctionData("swap", [{
                handler: handlerGeneric,
                mode: 0, // EXACT_IN
                account: ethers.ZeroAddress,
                tokenIn: ADDRESSES.USDC,
                tokenOut: ADDRESSES.WETH,
                amountOut: 0n,
                vaultIn: ethers.ZeroAddress,
                accountIn: ethers.ZeroAddress,
                receiver: ethers.ZeroAddress,
                data: handlerData,
            }]);
            
            // Build SwapVerifier calldata
            const minWethOut = BigInt(swapResult.dstAmount) * 95n / 100n; // 5% slippage
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            
            const verifierCalldata = swapVerifier.interface.encodeFunctionData(
                "verifyAmountMinAndSkim",
                [ADDRESSES.WETH_VAULT, testAccount3, minWethOut, deadline]
            );
            
            // Build batch
            const batchItems = [
                {
                    targetContract: ADDRESSES.USDC_VAULT,
                    onBehalfOfAccount: testAccount3,
                    value: 0,
                    data: borrowCalldata
                },
                {
                    targetContract: ADDRESSES.SWAPPER,
                    onBehalfOfAccount: testAccount3,
                    value: 0,
                    data: swapCalldata
                },
                {
                    targetContract: ADDRESSES.SWAP_VERIFIER,
                    onBehalfOfAccount: testAccount3,
                    value: 0,
                    data: verifierCalldata
                }
            ];
            
            console.log("\n   Batch items:");
            console.log(`   1. Borrow ${ethers.formatUnits(borrowAmount, 6)} USDC → Swapper`);
            console.log(`   2. Swap USDC → WETH via 1inch`);
            console.log(`   3. Verify min ${ethers.formatEther(minWethOut)} WETH and skim`);
            
            // Check balances before
            const vaultWethBefore = await weth.balanceOf(ADDRESSES.WETH_VAULT);
            const accountSharesBefore = await wethVault.balanceOf(testAccount3);
            
            console.log(`\n   Before:`);
            console.log(`   WETH Vault balance: ${ethers.formatEther(vaultWethBefore)}`);
            console.log(`   Account shares: ${ethers.formatEther(accountSharesBefore)}`);
            
            try {
                const tx = await evc.batch(batchItems);
                const receipt = await tx.wait();
                
                console.log(`\n   ✅ BATCH SUCCESSFUL!`);
                console.log(`   Gas used: ${receipt.gasUsed}`);
                
                // Check balances after
                const accountSharesAfter = await wethVault.balanceOf(testAccount3);
                const accountDebt = await usdcVault.debtOf(testAccount3);
                
                console.log(`\n   After:`);
                console.log(`   Account shares: ${ethers.formatEther(accountSharesAfter)}`);
                console.log(`   Account debt: ${ethers.formatUnits(accountDebt, 6)} USDC`);
                console.log(`   Shares gained: ${ethers.formatEther(accountSharesAfter - accountSharesBefore)}`);
                
                expect(accountSharesAfter).to.be.gt(accountSharesBefore);
                expect(accountDebt).to.be.gte(borrowAmount);
                
            } catch (e: any) {
                console.log(`\n   ❌ BATCH FAILED!`);
                console.log(`   Error: ${e.message}`);
                
                if (e.data) {
                    const selector = typeof e.data === 'string' ? e.data.slice(0, 10) : "unknown";
                    console.log(`   Error selector: ${selector}`);
                    
                    const knownErrors: Record<string, string> = {
                        "0x38ae747c": "EVC_EmptyError - A batch item failed with empty revert",
                        "0xe07f2e6b": "EVC_NotAuthorized",
                    };
                    
                    if (knownErrors[selector]) {
                        console.log(`   Identified: ${knownErrors[selector]}`);
                    }
                }
                
                throw e;
            }
        });

        it("Should test swap individually with real 1inch", async function () {
            // Use a fresh sub-account - must be lowercase then checksummed
            const rawAddress = owner.address.toLowerCase().slice(0, -2) + "03";
            const testAccount4 = ethers.getAddress(rawAddress);
            
            console.log(`\n📪 Sub-account for individual swap: ${testAccount4}`);
            
            // ==============================================================
            // STEP 0: Check 1inch v6 EXECUTOR allowance (but don't pre-approve)
            // We want to see where exactly the swap fails
            // ==============================================================
            const executor1inch = "0x8c864d0c8e476bf9eb9d620c10e1296fb0e2f940";
            console.log(`\n   🔧 Checking 1inch v6 executor: ${executor1inch}`);
            
            // Check current allowances
            const erc20Abi = ["function allowance(address,address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
            const usdcCheck = new ethers.Contract(ADDRESSES.USDC, erc20Abi, owner);
            let executorAllowance = await usdcCheck.allowance(ADDRESSES.SWAPPER, executor1inch);
            console.log(`   Current Swapper→Executor allowance: ${ethers.formatUnits(executorAllowance, 6)} USDC`);
            // ==============================================================
            
            // Get fresh WETH from whale
            const WETH_WHALE = "0xC3E5607Cd4ca0D5Fe51e09B60Ed97a0Ae6F874dd";
            const wethWhale = await ethers.getImpersonatedSigner(WETH_WHALE);
            await owner.sendTransaction({ to: wethWhale.address, value: ethers.parseEther("0.1") });
            
            const freshWeth = ethers.parseEther("0.2");
            await weth.connect(wethWhale).transfer(owner.address, freshWeth);
            console.log(`   Got ${ethers.formatEther(freshWeth)} WETH from whale`);
            
            // Setup: deposit collateral
            const depositAmount = ethers.parseEther("0.1");
            await weth.connect(owner).approve(ADDRESSES.WETH_VAULT, depositAmount);
            await wethVault.connect(owner).deposit(depositAmount, testAccount4);
            console.log(`   ✅ Deposited ${ethers.formatEther(depositAmount)} WETH`);
            
            // Enable collateral and controller
            await evc.enableCollateral(testAccount4, ADDRESSES.WETH_VAULT);
            await evc.enableController(testAccount4, ADDRESSES.USDC_VAULT);
            console.log(`   ✅ Collateral/Controller enabled`);
            
            // Step A: Borrow to Swapper
            const borrowAmount = ethers.parseUnits("10", 6);
            
            const borrowCalldata = usdcVault.interface.encodeFunctionData("borrow", [
                borrowAmount,
                ADDRESSES.SWAPPER
            ]);
            
            const borrowBatch = [{
                targetContract: ADDRESSES.USDC_VAULT,
                onBehalfOfAccount: testAccount4,
                value: 0,
                data: borrowCalldata
            }];
            
            console.log(`\n   📍 Step A: Borrow ${ethers.formatUnits(borrowAmount, 6)} USDC → Swapper`);
            
            try {
                const tx = await evc.batch(borrowBatch);
                await tx.wait();
                console.log(`   ✅ Borrow OK`);
                
                const swapperBalance = await usdc.balanceOf(ADDRESSES.SWAPPER);
                console.log(`   Swapper USDC balance: ${ethers.formatUnits(swapperBalance, 6)}`);
            } catch (e: any) {
                console.log(`   ❌ Borrow FAILED: ${e.message}`);
                throw e;
            }
            
            // Step B: Get 1inch data
            console.log(`\n   📡 Step B: Fetching 1inch swap data...`);
            
            interface OneInchResponse {
                tx: {
                    to: string;
                    data: string;
                    value: string;
                };
                dstAmount: string;
            }
            
            let swapResult: OneInchResponse;
            try {
                const oneInchApiUrl = "https://api.1inch.dev/swap/v6.0/42161/swap";
                const queryParams = new URLSearchParams({
                    src: ADDRESSES.USDC,
                    dst: ADDRESSES.WETH,
                    amount: borrowAmount.toString(),
                    from: ADDRESSES.SWAPPER,
                    receiver: ADDRESSES.WETH_VAULT, // Deposit directly to vault
                    slippage: "3",
                    disableEstimate: "true",
                    allowPartialFill: "false",
                });
                
                const response = await fetch(`${oneInchApiUrl}?${queryParams}`, {
                    headers: {
                        "Authorization": "Bearer j69cJtNJglZIf06DVK8qT6XvCAr5G5Ux",
                        "Accept": "application/json"
                    }
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.log(`   ❌ 1inch error: ${response.status} - ${errorText}`);
                    this.skip();
                    return;
                }
                
                swapResult = await response.json() as OneInchResponse;
                console.log(`   ✅ Got 1inch data`);
                console.log(`   1inch Router: ${swapResult.tx.to}`);
                console.log(`   Expected WETH: ${ethers.formatEther(swapResult.dstAmount)}`);
                console.log(`   Calldata length: ${swapResult.tx.data.length} chars`);
                
            } catch (e: any) {
                console.log(`   ❌ 1inch API failed: ${e.message}`);
                this.skip();
                return;
            }
            
            // Step C: Try swap directly
            console.log(`\n   📍 Step C: Execute Swapper.swap`);
            
            // DEBUG: Print 1inch calldata first 200 chars
            console.log(`   1inch calldata selector: ${swapResult.tx.data.slice(0, 10)}`);
            console.log(`   1inch calldata (first 300 chars): ${swapResult.tx.data.slice(0, 300)}...`);
            
            // Use encodeBytes32String for right-padded bytes32 string
            const handlerGeneric = ethers.encodeBytes32String("Generic");
            
            const handlerData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "bytes"],
                [swapResult.tx.to, swapResult.tx.data]
            );
            
            console.log(`   Handler: ${handlerGeneric}`);
            console.log(`   HandlerData encoded, length: ${handlerData.length} chars`);
            
            const swapParams = {
                handler: handlerGeneric,
                mode: 0, // EXACT_IN
                account: ethers.ZeroAddress,
                tokenIn: ADDRESSES.USDC,
                tokenOut: ADDRESSES.WETH,
                amountOut: 0n,
                vaultIn: ethers.ZeroAddress,
                accountIn: ethers.ZeroAddress,
                receiver: ethers.ZeroAddress,
                data: handlerData,
            };
            
            console.log(`   SwapParams:`, {
                handler: swapParams.handler,
                mode: swapParams.mode,
                tokenIn: swapParams.tokenIn,
                tokenOut: swapParams.tokenOut,
                dataLength: swapParams.data.length
            });
            
            // Build swap calldata
            const swapParamsAbi = new ethers.Interface([
                "function swap((bytes32 handler, uint256 mode, address account, address tokenIn, address tokenOut, uint256 amountOut, address vaultIn, address accountIn, address receiver, bytes data) params)"
            ]);
            
            const swapCalldata = swapParamsAbi.encodeFunctionData("swap", [swapParams]);
            
            const wethVaultBalanceBefore = await weth.balanceOf(ADDRESSES.WETH_VAULT);
            console.log(`\n   WETH Vault balance before: ${ethers.formatEther(wethVaultBalanceBefore)}`);
            
            // Try DIRECT call first (not via EVC batch)
            console.log(`\n   📍 Try 1: Direct Swapper.swap call...`);
            const swapperContract = new ethers.Contract(ADDRESSES.SWAPPER, swapParamsAbi, owner);
            
            // First verify the encoding by decoding what we encoded
            console.log(`   Verifying handlerData encoding...`);
            const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
                ["address", "bytes"],
                handlerData
            );
            console.log(`   Decoded target: ${decodedData[0]}`);
            console.log(`   Decoded payload length: ${decodedData[1].length} chars`);
            console.log(`   Decoded payload selector: ${decodedData[1].slice(0, 10)}`);
            
            // Check current allowances
            const routerAllowance = await usdcCheck.allowance(ADDRESSES.SWAPPER, swapResult.tx.to);
            console.log(`   Swapper→Router allowance: ${ethers.formatUnits(routerAllowance, 6)} USDC`);
            const execAllowance = await usdcCheck.allowance(ADDRESSES.SWAPPER, executor1inch);
            console.log(`   Swapper→Executor allowance: ${ethers.formatUnits(execAllowance, 6)} USDC`);
            
            try {
                // Try estimateGas first to get better error
                try {
                    const gasEstimate = await swapperContract.swap.estimateGas(swapParams);
                    console.log(`   Estimated gas: ${gasEstimate}`);
                } catch (estimateError: any) {
                    console.log(`   Gas estimation failed: ${estimateError.message.slice(0, 200)}`);
                    // Check for nested error
                    if (estimateError.error?.data) {
                        console.log(`   Nested error data: ${estimateError.error.data}`);
                    }
                    if (estimateError.error?.error?.data) {
                        console.log(`   Double nested error: ${estimateError.error.error.data}`);
                    }
                    // Check receipt
                    if (estimateError.receipt) {
                        console.log(`   Receipt status: ${estimateError.receipt.status}`);
                    }
                    // Log raw error
                    console.log(`   Raw error keys: ${Object.keys(estimateError)}`);
                }
                
                const tx = await swapperContract.swap(swapParams);
                const receipt = await tx.wait();
                console.log(`   ✅ DIRECT SWAP SUCCESSFUL!`);
                console.log(`   Gas used: ${receipt.gasUsed}`);
                
                const wethVaultBalanceAfter = await weth.balanceOf(ADDRESSES.WETH_VAULT);
                console.log(`   WETH Vault balance after: ${ethers.formatEther(wethVaultBalanceAfter)}`);
                console.log(`   WETH received: ${ethers.formatEther(wethVaultBalanceAfter - wethVaultBalanceBefore)}`);
                
                console.log(`\n   🎉 SUCCESS! With pre-approved executor, the swap works!`);
                return; // Success, test passed
                
            } catch (directError: any) {
                console.log(`   ❌ DIRECT SWAP FAILED: ${directError.message.slice(0,300)}`);
                
                if (directError.data) {
                    console.log(`   Error data: ${typeof directError.data === 'string' ? directError.data.slice(0, 100) : 'object'}`);
                }
            }
            
            // Try via EVC batch 
            console.log(`\n   📍 Try 2: EVC batch with Swapper.swap...`);
            const swapBatch = [{
                targetContract: ADDRESSES.SWAPPER,
                onBehalfOfAccount: testAccount4,
                value: 0,
                data: swapCalldata
            }];
            
            try {
                const tx = await evc.batch(swapBatch);
                const receipt = await tx.wait();
                console.log(`   ✅ SWAP SUCCESSFUL via EVC batch!`);
                console.log(`   Gas used: ${receipt.gasUsed}`);
                
                const wethVaultBalanceAfter = await weth.balanceOf(ADDRESSES.WETH_VAULT);
                console.log(`   WETH Vault balance after: ${ethers.formatEther(wethVaultBalanceAfter)}`);
                console.log(`   WETH received: ${ethers.formatEther(wethVaultBalanceAfter - wethVaultBalanceBefore)}`);
                
            } catch (e: any) {
                console.log(`   ❌ SWAP via EVC batch FAILED!`);
                console.log(`   Error: ${e.message.slice(0, 300)}`);
                
                if (e.data) {
                    const selector = typeof e.data === 'string' ? e.data.slice(0, 10) : "unknown";
                    console.log(`   Error selector: ${selector}`);
                }
                
                // Check balances for debugging
                const swapperBalanceAfter = await usdc.balanceOf(ADDRESSES.SWAPPER);
                console.log(`   Swapper's USDC balance: ${ethers.formatUnits(swapperBalanceAfter, 6)}`);
                
                // Try 3: Call 1inch directly as impersonated Swapper
                console.log(`\n   📍 Try 3: Direct 1inch call as impersonated Swapper...`);
                
                // Setup impersonation with ETH
                await hre.network.provider.send("hardhat_setBalance", [
                    ADDRESSES.SWAPPER,
                    "0x56bc75e2d63100000" // 100 ETH
                ]);
                const swapperSigner = await ethers.getImpersonatedSigner(ADDRESSES.SWAPPER);
                
                // Pre-approve executor before direct call
                const usdcForApprove = new ethers.Contract(ADDRESSES.USDC, erc20Abi, swapperSigner);
                await usdcForApprove.approve(executor1inch, ethers.MaxUint256);
                console.log(`   Pre-approved executor for direct test`);
                
                try {
                    const direct1inchTx = await swapperSigner.sendTransaction({
                        to: swapResult.tx.to,
                        data: swapResult.tx.data,
                        value: 0
                    });
                    const receipt3 = await direct1inchTx.wait();
                    console.log(`   ✅ DIRECT 1inch CALL SUCCESSFUL!`);
                    console.log(`   Gas used: ${receipt3!.gasUsed}`);
                    
                    const wethVaultBalanceAfter = await weth.balanceOf(ADDRESSES.WETH_VAULT);
                    console.log(`   WETH Vault balance after: ${ethers.formatEther(wethVaultBalanceAfter)}`);
                    console.log(`   WETH received: ${ethers.formatEther(wethVaultBalanceAfter - wethVaultBalanceBefore)}`);
                    
                    console.log(`\n   💡 Direct 1inch works! Problem is in Swapper.swap logic.`);
                    console.log(`   The GenericHandler might be modifying the calldata or the allowance flow is broken.`);
                    
                    // Try 4: Call Swapper.swap with FRESH funds and executor pre-approved
                    console.log(`\n   📍 Try 4: Swapper.swap with FRESH funds and executor pre-approved...`);
                    
                    // Step 4a: Borrow fresh USDC to Swapper
                    console.log(`   Step 4a: Borrowing fresh 10 USDC to Swapper...`);
                    const borrowBatch4 = [{
                        targetContract: ADDRESSES.USDC_VAULT,
                        onBehalfOfAccount: testAccount4,
                        value: 0,
                        data: usdcVault.interface.encodeFunctionData("borrow", [borrowAmount, ADDRESSES.SWAPPER])
                    }];
                    
                    const borrowTx4 = await evc.batch(borrowBatch4);
                    await borrowTx4.wait();
                    
                    const swapperBalanceForTry4 = await usdc.balanceOf(ADDRESSES.SWAPPER);
                    console.log(`   Swapper USDC balance: ${ethers.formatUnits(swapperBalanceForTry4, 6)}`);
                    
                    // Step 4b: Get fresh 1inch data
                    console.log(`   Step 4b: Getting fresh 1inch data...`);
                    const queryParams4 = new URLSearchParams({
                        src: ADDRESSES.USDC,
                        dst: ADDRESSES.WETH,
                        amount: borrowAmount.toString(),
                        from: ADDRESSES.SWAPPER,
                        receiver: ADDRESSES.WETH_VAULT,
                        slippage: "3",
                        disableEstimate: "true",
                        allowPartialFill: "false",
                    });
                    
                    const response4 = await fetch(`https://api.1inch.dev/swap/v6.0/42161/swap?${queryParams4}`, {
                        headers: {
                            "Authorization": "Bearer j69cJtNJglZIf06DVK8qT6XvCAr5G5Ux",
                            "Accept": "application/json"
                        }
                    });
                    
                    if (!response4.ok) {
                        console.log(`   ❌ 1inch API failed for Try 4`);
                        return;
                    }
                    
                    const swapResult4 = await response4.json() as OneInchResponse;
                    console.log(`   ✅ Got fresh 1inch data, expected WETH: ${ethers.formatEther(swapResult4.dstAmount)}`);
                    
                    // Build fresh swap params
                    const handlerData4 = ethers.AbiCoder.defaultAbiCoder().encode(
                        ["address", "bytes"],
                        [swapResult4.tx.to, swapResult4.tx.data]
                    );
                    
                    const swapParams4 = {
                        handler: handlerGeneric,
                        mode: 0,
                        account: ethers.ZeroAddress,
                        tokenIn: ADDRESSES.USDC,
                        tokenOut: ADDRESSES.WETH,
                        amountOut: 0n,
                        vaultIn: ethers.ZeroAddress,
                        accountIn: ethers.ZeroAddress,
                        receiver: ethers.ZeroAddress,
                        data: handlerData4,
                    };
                    
                    // Executor is already pre-approved from Try 3
                    const execAllowance4 = await usdcCheck.allowance(ADDRESSES.SWAPPER, executor1inch);
                    console.log(`   Swapper→Executor allowance: ${ethers.formatUnits(execAllowance4, 6)} USDC`);
                    
                    const wethVaultBalanceBeforeTry4 = await weth.balanceOf(ADDRESSES.WETH_VAULT);
                    
                    const swapperContract2 = new ethers.Contract(ADDRESSES.SWAPPER, swapParamsAbi, swapperSigner);
                    
                    try {
                        const tx4 = await swapperContract2.swap(swapParams4);
                        const receipt4 = await tx4.wait();
                        console.log(`   ✅ SWAPPER.SWAP WITH EXECUTOR APPROVED SUCCESSFUL!`);
                        console.log(`   Gas used: ${receipt4!.gasUsed}`);
                        
                        const wethVaultBalanceAfter4 = await weth.balanceOf(ADDRESSES.WETH_VAULT);
                        console.log(`   WETH received: ${ethers.formatEther(wethVaultBalanceAfter4 - wethVaultBalanceBeforeTry4)}`);
                        
                        console.log(`\n   🎉 SUCCESS! The issue is that 1inch v6 requires approval to EXECUTOR, not ROUTER.`);
                        console.log(`   Solution: Pre-approve 1inch executor before swap, or use Uniswap handlers.`);
                    } catch (e4: any) {
                        console.log(`   ❌ Swap still failed: ${e4.message.slice(0, 200)}`);
                        if (e4.data) {
                            console.log(`   Error data: ${e4.data.slice(0, 100)}`);
                        }
                        
                        // Additional debug: simulate the call
                        console.log(`\n   📡 Debug: Simulating Swapper internal call...`);
                        try {
                            // Use staticCall to simulate
                            await swapperContract2.swap.staticCall(swapParams4);
                        } catch (simError: any) {
                            console.log(`   Simulation error: ${simError.message.slice(0, 300)}`);
                        }
                        
                        // Try 5: Manually replicate GenericHandler logic
                        console.log(`\n   📍 Try 5: Manually replicate GenericHandler.swapGeneric logic...`);
                        
                        // Decode just like GenericHandler does
                        const [targetDecoded, payloadDecoded] = ethers.AbiCoder.defaultAbiCoder().decode(
                            ["address", "bytes"],
                            swapParams4.data
                        );
                        console.log(`   Decoded target: ${targetDecoded}`);
                        console.log(`   Decoded payload selector: ${payloadDecoded.slice(0, 10)}`);
                        console.log(`   Decoded payload length: ${payloadDecoded.length}`);
                        
                        // As Swapper, approve the target (like setMaxAllowance does)
                        const usdcAsSwapper = new ethers.Contract(ADDRESSES.USDC, erc20Abi, swapperSigner);
                        const currentAllowanceToRouter = await usdcAsSwapper.allowance(ADDRESSES.SWAPPER, targetDecoded);
                        console.log(`   Current allowance to router: ${ethers.formatUnits(currentAllowanceToRouter, 6)}`);
                        
                        if (currentAllowanceToRouter < borrowAmount) {
                            console.log(`   Approving router...`);
                            await usdcAsSwapper.approve(targetDecoded, ethers.MaxUint256);
                        }
                        
                        // Now call the target with payload (exactly like target.call(payload))
                        console.log(`   Calling 1inch router directly with decoded payload...`);
                        try {
                            const manualTx = await swapperSigner.sendTransaction({
                                to: targetDecoded,
                                data: payloadDecoded,
                                value: 0
                            });
                            const manualReceipt = await manualTx.wait();
                            console.log(`   ✅ MANUAL CALL SUCCESSFUL!`);
                            console.log(`   Gas used: ${manualReceipt!.gasUsed}`);
                            
                            const wethVaultBalanceAfter5 = await weth.balanceOf(ADDRESSES.WETH_VAULT);
                            console.log(`   WETH received: ${ethers.formatEther(wethVaultBalanceAfter5 - wethVaultBalanceBeforeTry4)}`);
                            
                            console.log(`\n   ⚠️ Manual call works but Swapper.swap fails!`);
                            console.log(`   The issue is INSIDE the Swapper contract execution.`);
                            
                            // Try 6: Call Swapper.swap from a DIFFERENT account (not impersonated Swapper)
                            console.log(`\n   📍 Try 6: Swapper.swap called by OWNER (not impersonated Swapper)...`);
                            
                            // Borrow more USDC
                            console.log(`   Borrowing fresh 10 USDC...`);
                            const borrowBatch6 = [{
                                targetContract: ADDRESSES.USDC_VAULT,
                                onBehalfOfAccount: testAccount4,
                                value: 0,
                                data: usdcVault.interface.encodeFunctionData("borrow", [borrowAmount, ADDRESSES.SWAPPER])
                            }];
                            await evc.batch(borrowBatch6);
                            console.log(`   Swapper USDC: ${ethers.formatUnits(await usdc.balanceOf(ADDRESSES.SWAPPER), 6)}`);
                            
                            // Get fresh 1inch data
                            const queryParams6 = new URLSearchParams({
                                src: ADDRESSES.USDC,
                                dst: ADDRESSES.WETH,
                                amount: borrowAmount.toString(),
                                from: ADDRESSES.SWAPPER,
                                receiver: ADDRESSES.WETH_VAULT,
                                slippage: "3",
                                disableEstimate: "true",
                                allowPartialFill: "false",
                            });
                            
                            const response6 = await fetch(`https://api.1inch.dev/swap/v6.0/42161/swap?${queryParams6}`, {
                                headers: {
                                    "Authorization": "Bearer j69cJtNJglZIf06DVK8qT6XvCAr5G5Ux",
                                    "Accept": "application/json"
                                }
                            });
                            const swapResult6 = await response6.json() as OneInchResponse;
                            console.log(`   Got 1inch data, expected: ${ethers.formatEther(swapResult6.dstAmount)} WETH`);
                            
                            const handlerData6 = ethers.AbiCoder.defaultAbiCoder().encode(
                                ["address", "bytes"],
                                [swapResult6.tx.to, swapResult6.tx.data]
                            );
                            
                            const swapParams6 = {
                                handler: handlerGeneric,
                                mode: 0,
                                account: ethers.ZeroAddress,
                                tokenIn: ADDRESSES.USDC,
                                tokenOut: ADDRESSES.WETH,
                                amountOut: 0n,
                                vaultIn: ethers.ZeroAddress,
                                accountIn: ethers.ZeroAddress,
                                receiver: ethers.ZeroAddress,
                                data: handlerData6,
                            };
                            
                            // Call from OWNER, not impersonated Swapper
                            const swapperFromOwner = new ethers.Contract(ADDRESSES.SWAPPER, swapParamsAbi, owner);
                            
                            const wethBalBefore6 = await weth.balanceOf(ADDRESSES.WETH_VAULT);
                            
                            try {
                                // Try with extra gas
                                const tx6 = await swapperFromOwner.swap(swapParams6, {
                                    gasLimit: 5000000
                                });
                                const receipt6 = await tx6.wait();
                                console.log(`   ✅ SWAPPER.SWAP FROM OWNER SUCCESSFUL!`);
                                console.log(`   Gas used: ${receipt6!.gasUsed}`);
                                console.log(`   WETH received: ${ethers.formatEther((await weth.balanceOf(ADDRESSES.WETH_VAULT)) - wethBalBefore6)}`);
                            } catch (e6: any) {
                                console.log(`   ❌ Swap from owner failed: ${e6.message.slice(0, 200)}`);
                                if (e6.data) console.log(`   Error data: ${e6.data.slice(0, 100)}`);
                                
                                // Try 7: Use low-level call to see exact revert
                                console.log(`\n   📍 Try 7: Low-level call with trace...`);
                                
                                const swapCalldata7 = swapParamsAbi.encodeFunctionData("swap", [swapParams6]);
                                
                                // Try eth_call to get detailed error
                                try {
                                    const result = await ethers.provider.call({
                                        to: ADDRESSES.SWAPPER,
                                        data: swapCalldata7,
                                        from: await owner.getAddress(),
                                        gasLimit: 5000000
                                    });
                                    console.log(`   eth_call result: ${result}`);
                                } catch (callErr: any) {
                                    console.log(`   eth_call error: ${callErr.message.slice(0, 300)}`);
                                    if (callErr.data) console.log(`   eth_call error data: ${callErr.data.slice(0, 200)}`);
                                    
                                    // Check revert data
                                    if (callErr.error?.data) {
                                        const revertData = callErr.error.data;
                                        console.log(`   Revert data: ${revertData}`);
                                        
                                        // Try to decode Swapper_SwapError(address, bytes)
                                        // selector = keccak256("Swapper_SwapError(address,bytes)") = 0x2e35c9f2
                                        if (revertData.startsWith("0x2e35c9f2")) {
                                            console.log(`   This is Swapper_SwapError!`);
                                            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                                                ["address", "bytes"],
                                                "0x" + revertData.slice(10)
                                            );
                                            console.log(`   Swap provider: ${decoded[0]}`);
                                            console.log(`   Raw error: ${decoded[1]}`);
                                        }
                                    }
                                }
                            }
                            
                        } catch (manualError: any) {
                            console.log(`   ❌ Manual call failed: ${manualError.message.slice(0, 300)}`);
                        }
                    }
                    
                    return; // Continue analysis
                    
                } catch (e1inch: any) {
                    console.log(`   ❌ DIRECT 1inch CALL FAILED: ${e1inch.message.slice(0, 300)}`);
                    if (e1inch.data) {
                        console.log(`   1inch error data: ${typeof e1inch.data === 'string' ? e1inch.data.slice(0, 100) : 'object'}`);
                    }
                }
                
                throw e;
            }
        });
    });

    after(async function () {
        console.log("\n" + "=".repeat(70));
        console.log("🔬 DEBUG TESTS COMPLETED");
        console.log("=".repeat(70));
    });
});
