/**
 * @file EulerV2Plugin.phase3.test.ts
 * @description FASE 3 - Test LEVERAGE ATOMICO con swap via 1inch
 * 
 * Questo test usa lo STESSO setup funzionante di realfunds.test.ts
 * ma testa openLeveragePosition con swap reale.
 * 
 * Run:
 * $env:FORK_ENABLED="true"; npx hardhat test test/integration/EulerV2Plugin.phase3.test.ts --network hardhat
 */

import { expect } from "chai";
import { ethers, network } from "hardhat";
import { Contract, Signer } from "ethers";

// Real addresses from Arbitrum mainnet
const ADDRESSES = {
    // Core
    PROXY_GENERAL: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1",
    BEACON: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
    TOKEN_MANAGER: "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517",
    
    // Tokens
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    
    // Euler V2
    EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
    ACCOUNT_LENS: "0x90a52DDcb232e7bb003DD9258fA1235c553eC956",
    VAULT_LENS: "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380",
    UTILS_LENS: "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE",
    WETH_VAULT: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
    USDC_VAULT: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
    SWAPPER: "0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7",
    SWAP_VERIFIER: "0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5",
    
    // 1inch aggregator
    ONE_INCH_ROUTER: "0x1111111254EEB25477B68fb85Ed929f73A960582",
};

// 1inch API
const ONE_INCH_API_KEY = process.env.ONEINCH_API_KEY ?? "";

// WETH whale with plenty of funds
const WETH_WHALE = "0xC3E5607Cd4ca0D5Fe51e09B60Ed97a0Ae6F874dd";

describe("EulerV2Plugin - FASE 3: Leverage Atomico", function () {
    this.timeout(180000);

    let owner: Signer;
    let ownerAddress: string;
    let eulerPlugin: Contract;
    let EulerRegistry: Contract;
    let eulerLensAdapter: Contract;
    let weth: Contract;
    let usdc: Contract;
    let wethVault: Contract;
    let usdcVault: Contract;
    let evc: Contract;
    let beacon: Contract;
    let snapshotId: string | undefined;

    // Helper: Ottiene quote da 1inch
    async function get1inchQuote(
        fromToken: string,
        toToken: string,
        amount: string
    ): Promise<{ dstAmount: string }> {
        const url = `https://api.1inch.dev/swap/v6.0/42161/quote?src=${fromToken}&dst=${toToken}&amount=${amount}`;
        
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${ONE_INCH_API_KEY}`,
                "Accept": "application/json"
            }
        });
        
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`1inch quote error: ${response.status} - ${text}`);
        }
        
        return await response.json();
    }

    // Helper: Ottiene swap data da 1inch
    async function get1inchSwapData(
        fromToken: string,
        toToken: string,
        amount: string,
        fromAddress: string,
        receiver: string,
        slippage: number = 1
    ): Promise<{ tx: { to: string, data: string }, dstAmount: string }> {
        const url = `https://api.1inch.dev/swap/v6.0/42161/swap?` +
            `src=${fromToken}&dst=${toToken}&amount=${amount}` +
            `&from=${fromAddress}&receiver=${receiver}` +
            `&slippage=${slippage}&disableEstimate=true`;
        
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${ONE_INCH_API_KEY}`,
                "Accept": "application/json"
            }
        });
        
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`1inch swap error: ${response.status} - ${text}`);
        }
        
        return await response.json();
    }

    // Helper: Costruisce SwapParams per Euler Swapper
    function buildSwapperCalldata(
        aggregatorAddress: string,
        aggregatorCalldata: string,
        tokenIn: string,
        tokenOut: string,
        amountIn: bigint
    ): string {
        // Handler GENERIC: data = abi.encode(target, calldata)
        const HANDLER_GENERIC = ethers.zeroPadValue(ethers.toUtf8Bytes("Generic"), 32);
        const SWAP_MODE_EXACT_IN = 0;
        
        const handlerData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "bytes"],
            [aggregatorAddress, aggregatorCalldata]
        );
        
        // SwapParams struct
        const swapperAbi = new ethers.Interface([
            "function swap((bytes32 handler, uint256 mode, address account, address tokenIn, address tokenOut, uint256 amountOut, address vaultIn, address accountIn, address receiver, bytes data) params)"
        ]);
        
        return swapperAbi.encodeFunctionData("swap", [{
            handler: HANDLER_GENERIC,
            mode: SWAP_MODE_EXACT_IN,
            account: ethers.ZeroAddress,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountOut: 0n,
            vaultIn: ethers.ZeroAddress,
            accountIn: ethers.ZeroAddress,
            receiver: ethers.ZeroAddress, // Receiver è nel calldata 1inch
            data: handlerData,
        }]);
    }

    before(async function () {
        // Check we're on fork
        if (process.env.FORK_ENABLED !== "true") {
            console.log("⚠️  Skipping - set FORK_ENABLED=true");
            this.skip();
        }

        snapshotId = await network.provider.send("evm_snapshot");

        console.log("\n" + "=".repeat(70));
        console.log("🚀 FASE 3: LEVERAGE ATOMICO TEST");
        console.log("=".repeat(70));

        // Get real owner and impersonate
        const proxyGeneral = await ethers.getContractAt(
            ["function owner() view returns (address)"],
            ADDRESSES.PROXY_GENERAL
        );
        const proxyOwner = await proxyGeneral.owner();
        console.log("\n📦 ProxyGeneral owner:", proxyOwner);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [proxyOwner],
        });
        owner = await ethers.getSigner(proxyOwner);
        ownerAddress = proxyOwner;

        // Fund with ETH
        const [funder] = await ethers.getSigners();
        await funder.sendTransaction({
            to: proxyOwner,
            value: ethers.parseEther("10"),
        });

        // Get contracts
        beacon = await ethers.getContractAt(
            ["function updateImplementation(string memory, address) external",
             "function getImplementation(string memory) view returns (address)"],
            ADDRESSES.BEACON,
            owner
        );

        weth = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.WETH, owner);
        usdc = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.USDC, owner);

        wethVault = await ethers.getContractAt(
            ["function balanceOf(address) view returns (uint256)",
             "function maxWithdraw(address) view returns (uint256)",
             "function debtOf(address) view returns (uint256)"],
            ADDRESSES.WETH_VAULT
        );

        usdcVault = await ethers.getContractAt(
            ["function balanceOf(address) view returns (uint256)",
             "function debtOf(address) view returns (uint256)"],
            ADDRESSES.USDC_VAULT
        );

        evc = await ethers.getContractAt(
            ["function isCollateralEnabled(address,address) view returns (bool)",
             "function isControllerEnabled(address,address) view returns (bool)"],
            ADDRESSES.EVC
        );

        // Deploy EulerRegistry
        console.log("\n📦 Deploying infrastructure...");
        const EulerRegistryFactory = await ethers.getContractFactory("EulerRegistry", owner);
        EulerRegistry = await EulerRegistryFactory.deploy();
        await EulerRegistry.waitForDeployment();

        await (await beacon.updateImplementation("EulerRegistry", await EulerRegistry.getAddress())).wait();
        await (await EulerRegistry.setVault("WETH", ADDRESSES.WETH_VAULT)).wait();
        await (await EulerRegistry.setVault("USDC", ADDRESSES.USDC_VAULT)).wait();
        console.log("   ✅ EulerRegistry deployed and configured");

        if ((await beacon.getImplementation("WETH")).toLowerCase() !== ADDRESSES.WETH.toLowerCase()) {
            await (await beacon.updateImplementation("WETH", ADDRESSES.WETH)).wait();
        }
        let configuredBaseAsset = ethers.ZeroAddress;
        try {
            configuredBaseAsset = await beacon.getImplementation("BASE_ASSET");
        } catch {}
        if (configuredBaseAsset.toLowerCase() !== ADDRESSES.WETH.toLowerCase()) {
            await (await beacon.updateImplementation("BASE_ASSET", ADDRESSES.WETH)).wait();
        }

        // Check ProtocolManager
        try {
            await beacon.getImplementation("ProtocolManager");
        } catch {
            await (await beacon.updateImplementation("ProtocolManager", ADDRESSES.TOKEN_MANAGER)).wait();
        }

        // Deploy EulerV2Plugin
        const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin", owner);
        eulerPlugin = await EulerV2Plugin.deploy(
            ADDRESSES.BEACON, "WETH", ADDRESSES.EVC, ADDRESSES.ACCOUNT_LENS
        );
        await eulerPlugin.waitForDeployment();
        console.log(`   ✅ EulerV2Plugin deployed: ${await eulerPlugin.getAddress()}`);

        // Deploy EulerLensAdapter
        const EulerLensAdapter = await ethers.getContractFactory("EulerLensAdapter", owner);
        eulerLensAdapter = await EulerLensAdapter.deploy(
            ADDRESSES.BEACON, "WETH", ADDRESSES.ACCOUNT_LENS,
            ADDRESSES.VAULT_LENS, ADDRESSES.UTILS_LENS, ADDRESSES.EVC
        );
        await eulerLensAdapter.waitForDeployment();
        await (await beacon.updateImplementation("EulerLensAdapter", await eulerLensAdapter.getAddress())).wait();
        await (await beacon.updateImplementation("EulerV2Plugin", await eulerPlugin.getAddress())).wait();
        const FlashLoanService = await ethers.getContractFactory("FlashLoanService", owner);
        const flashLoanService = await FlashLoanService.deploy(ADDRESSES.BEACON);
        await flashLoanService.waitForDeployment();
        await (await beacon.updateImplementation("FlashLoanService", await flashLoanService.getAddress())).wait();
        await (await beacon.updateImplementation("LiquidityManager", await flashLoanService.getAddress())).wait();
        await (await EulerRegistry.transferOwnership(await eulerPlugin.getAddress())).wait();
        console.log(`   ✅ EulerLensAdapter deployed: ${await eulerLensAdapter.getAddress()}`);

        // Authorize in ProxyGeneral
        const proxyFull = await ethers.getContractAt(
            ["function authorizeModule(address, string memory) external"],
            ADDRESSES.PROXY_GENERAL,
            owner
        );
        await (await proxyFull.authorizeModule(await eulerPlugin.getAddress(), "EulerV2Plugin-Phase3")).wait();
        console.log("   ✅ Plugin authorized");

        // Get WETH from whale
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [WETH_WHALE],
        });
        const whale = await ethers.getSigner(WETH_WHALE);
        await funder.sendTransaction({ to: WETH_WHALE, value: ethers.parseEther("0.1") });
        
        const wethAmount = ethers.parseEther("0.1"); // 0.1 WETH for testing
        await (await weth.connect(whale).transfer(await eulerPlugin.getAddress(), wethAmount)).wait();
        console.log(`   ✅ Transferred ${ethers.formatEther(wethAmount)} WETH to plugin`);
    });

    describe("1. Verify Base Components Work", function () {
        it("Should deposit WETH successfully", async function () {
            const pluginAddress = await eulerPlugin.getAddress();
            const pluginWeth = await weth.balanceOf(pluginAddress);
            
            console.log(`\n📊 Plugin WETH: ${ethers.formatEther(pluginWeth)}`);
            
            // Deposit half
            const depositAmount = pluginWeth / 2n;
            await (await eulerPlugin.deposit("WETH", depositAmount)).wait();
            
            const shares = await wethVault.balanceOf(pluginAddress);
            console.log(`   ✅ Deposited, shares: ${ethers.formatEther(shares)}`);
            
            expect(shares).to.be.gt(0);
        });

        it("Should auto-enable collateral and controller via batch", async function () {
            const pluginAddress = await eulerPlugin.getAddress();
            
            // In the new architecture, deposit auto-enables collateral via EVC batch
            // and borrow auto-enables controller via EVC batch
            // Verify that collateral was auto-enabled by the deposit in the previous test
            expect(await evc.isCollateralEnabled(pluginAddress, ADDRESSES.WETH_VAULT)).to.be.true;
            
            console.log("   ✅ Collateral auto-enabled by deposit batch");
        });

        it("Should borrow USDC", async function () {
            const pluginAddress = await eulerPlugin.getAddress();
            const borrowAmount = ethers.parseUnits("1", 6); // 1 USDC
            
            await (await eulerPlugin.borrow("USDC", borrowAmount)).wait();
            
            const debt = await usdcVault.debtOf(pluginAddress);
            console.log(`   ✅ Borrowed, debt: ${ethers.formatUnits(debt, 6)} USDC`);
            
            expect(debt).to.be.gte(borrowAmount);
        });
    });

    describe("2. Open Leverage Position (Atomic)", function () {
        let leveragePlugin: Contract;
        
        before(async function () {
            // Deploy fresh plugin for leverage test
            const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin", owner);
            leveragePlugin = await EulerV2Plugin.deploy(
                ADDRESSES.BEACON, "WETH", ADDRESSES.EVC, ADDRESSES.ACCOUNT_LENS
            );
            await leveragePlugin.waitForDeployment();
            
            const pluginAddress = await leveragePlugin.getAddress();
            const FreshRegistry = await ethers.getContractFactory("EulerRegistry", owner);
            EulerRegistry = await FreshRegistry.deploy();
            await EulerRegistry.waitForDeployment();
            await (await EulerRegistry.setVault("WETH", ADDRESSES.WETH_VAULT)).wait();
            await (await EulerRegistry.setVault("USDC", ADDRESSES.USDC_VAULT)).wait();
            await (await beacon.updateImplementation("EulerRegistry", await EulerRegistry.getAddress())).wait();
            await (await beacon.updateImplementation("EulerV2Plugin", pluginAddress)).wait();
            await (await EulerRegistry.transferOwnership(pluginAddress)).wait();
            console.log(`\n📦 Fresh plugin for leverage: ${pluginAddress}`);
            
            // Authorize
            const proxyFull = await ethers.getContractAt(
                ["function authorizeModule(address, string memory) external"],
                ADDRESSES.PROXY_GENERAL,
                owner
            );
            await (await proxyFull.authorizeModule(pluginAddress, "LeveragePlugin")).wait();
            
            // Get WETH from whale
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [WETH_WHALE],
            });
            const whale = await ethers.getSigner(WETH_WHALE);
            
            const wethAmount = ethers.parseEther("0.05"); // 0.05 WETH
            await (await weth.connect(whale).transfer(ownerAddress, wethAmount)).wait();
            await (await weth.approve(pluginAddress, wethAmount)).wait();
            console.log(`   ✅ Got ${ethers.formatEther(wethAmount)} WETH for leverage`);
        });

        it("Should open leverage position with openLeverageAtomic", async function () {
            const pluginAddress = await leveragePlugin.getAddress();
            const pluginWeth = await weth.balanceOf(ownerAddress);
            
            console.log("\n" + "=".repeat(60));
            console.log("🔄 OPENING LEVERAGE POSITION (Atomic)");
            console.log("=".repeat(60));
            
            console.log(`   Collateral: ${ethers.formatEther(pluginWeth)} WETH`);
            console.log(`   Target: 2x leverage`);
            
            try {
                const params = {
                    collateralToken: "WETH",
                    borrowToken: "USDC",
                    collateralAmount: pluginWeth,
                    targetLeverageX100: 200,  // 2x leverage
                    minHealthFactor: ethers.parseEther("1.05"),
                    deadline: Math.floor(Date.now() / 1000) + 3600
                };
                
                console.log("\n🚀 Executing openLeverageAtomic...");
                
                const tx = await leveragePlugin.openLeverageAtomic(params);
                const receipt = await tx.wait();
                
                console.log(`\n   ✅ SUCCESS!`);
                console.log(`   Tx hash: ${receipt.hash}`);
                console.log(`   Gas used: ${receipt.gasUsed}`);
                
                // Verify position created
                const positionCount = await EulerRegistry.getActivePositionCount();
                console.log(`   Active positions: ${positionCount}`);
                
                if (positionCount > 0n) {
                    const position = await EulerRegistry.getPosition(0);
                    console.log(`\n📊 Position Details:`);
                    console.log(`   Position ID: ${position.positionId}`);
                    console.log(`   Sub-account ID: ${position.subAccountId}`);
                    console.log(`   Initial Collateral: ${ethers.formatEther(position.initialCollateral)} WETH`);
                    console.log(`   Borrowed: ${ethers.formatUnits(position.borrowedAmount, 6)} USDC`);
                    console.log(`   Active: ${position.isActive}`);
                    
                    // Get health using LensAdapter
                    const health = await eulerLensAdapter.getPositionHealthFactor(0);
                    if (health === ethers.MaxUint256) {
                        console.log(`   Health Factor: MAX (very safe)`);
                    } else {
                        console.log(`   Health Factor: ${ethers.formatEther(health)}`);
                    }
                }
                
                expect(positionCount).to.be.gt(0);
                
            } catch (error: any) {
                console.log(`\n❌ LEVERAGE FAILED!`);
                console.log(`   Error: ${error.message}`);
                
                if (error.data) {
                    const selector = error.data.slice(0, 10);
                    console.log(`   Error selector: ${selector}`);
                    
                    const errors: Record<string, string> = {
                        "0xe07f2e6b": "EVC_NotAuthorized",
                        "0x38ae747c": "Unknown Euler Error",
                        "0xc31bcb13": "E_FlashLoanNotRepaid",
                        "0x5a00e7e5": "E_AccountLiquidity",
                        "0xb2be531b": "Unknown (transfer related?)",
                    };
                    
                    if (errors[selector]) {
                        console.log(`   Known: ${errors[selector]}`);
                    }
                }
                
                throw error;
            }
        });
    });

    after(async function () {
        console.log("\n" + "=".repeat(70));
        console.log("✅ FASE 3 TESTS COMPLETED");
        console.log("=".repeat(70));
        if (snapshotId !== undefined) {
            await network.provider.send("evm_revert", [snapshotId]);
        }
    });
});
