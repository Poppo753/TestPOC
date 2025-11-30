/**
 * @file EulerV2Plugin.debug.test.ts
 * @description Debug test per identificare esattamente dove fallisce il leverage
 * 
 * OBIETTIVO: Testare ogni componente del batch separatamente per trovare l'errore
 */

import { ethers, network } from "hardhat";
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

    const WETH_WHALE = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336";
    const USDC_WHALE = "0x47c031236e19d024b42f8AE6780E44A573170703";

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

    after(async function () {
        console.log("\n" + "=".repeat(70));
        console.log("🔬 DEBUG TESTS COMPLETED");
        console.log("=".repeat(70));
    });
});
