import { ethers } from "hardhat";

/**
 * DEBUG COMPLETO DELLO SWAP
 * 
 * Verifica sistematicamente ogni step:
 * 1. Plugin registrato?
 * 2. SimpleSwap address nel plugin?
 * 3. SimpleSwap implementa ISimpleSwap?
 * 4. Token approval funziona?
 * 5. Swap simulation
 */

const BEACON_ADDRESS = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const SWAP_MANAGER_ADDRESS = "0x01269d496E957A54e02cdcd5888957baf317A947";
const PROXY_GENERAL_ADDRESS = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
    console.log("============================================================");
    console.log("  FULL SWAP DEBUG - TRACCIA COMPLETA");
    console.log("============================================================\n");

    const [owner] = await ethers.getSigners();
    console.log(`Owner: ${owner.address}\n`);

    // ============ STEP 1: BEACON & PLUGIN ============
    console.log("STEP 1: Beacon & Plugin Registration");
    console.log("─────────────────────────────────────");
    
    const beacon = await ethers.getContractAt("IBeacon", BEACON_ADDRESS);
    
    try {
        const pluginAddress = await beacon.getImplementation("UniswapV3Plugin");
        console.log(`✅ Plugin registered: ${pluginAddress}`);
    } catch (error: any) {
        console.log(`❌ Plugin NOT registered: ${error.message}`);
        return;
    }

    // ============ STEP 2: PLUGIN DETAILS ============
    console.log("\nSTEP 2: Plugin Configuration");
    console.log("─────────────────────────────────────");
    
    const pluginAddress = await beacon.getImplementation("UniswapV3Plugin");
    const plugin = await ethers.getContractAt("UniswapV3Plugin", pluginAddress);
    
    const simpleSwapAddress = await plugin.simpleSwap();
    console.log(`SimpleSwap address in plugin: ${simpleSwapAddress}`);
    
    // Check if it's Uniswap V3 Router
    if (simpleSwapAddress === "0xE592427A0AEce92De3Edee1F18E0157C05861564") {
        console.log(`⚠️  This is Uniswap V3 Router (NOT SimpleSwap wrapper)`);
    }
    
    // Check code size
    const codeSize = await ethers.provider.getCode(simpleSwapAddress);
    console.log(`Code size: ${codeSize.length} bytes`);

    // ============ STEP 3: INTERFACE TEST ============
    console.log("\nSTEP 3: Interface Compatibility Test");
    console.log("─────────────────────────────────────");
    
    try {
        // Try calling ISimpleSwap interface on simpleSwap address
        const simpleSwap = await ethers.getContractAt("ISimpleSwap", simpleSwapAddress);
        const expectedOutput = await simpleSwap.getExpectedOutput(
            WETH_ADDRESS,
            USDC_ADDRESS,
            ethers.parseEther("0.0001")
        );
        console.log(`✅ ISimpleSwap.getExpectedOutput() works`);
        console.log(`   Expected output: ${expectedOutput.toString()}`);
        
        if (expectedOutput.toString() === "0") {
            console.log(`   ⚠️  Output is 0 - could be liquidity issue or interface mismatch`);
        }
    } catch (error: any) {
        console.log(`❌ ISimpleSwap interface FAILED: ${error.message}`);
        console.log(`   This confirms: ${simpleSwapAddress} does NOT implement ISimpleSwap`);
    }

    // ============ STEP 4: PLUGIN getExpectedOutput ============
    console.log("\nSTEP 4: Plugin getExpectedOutput");
    console.log("─────────────────────────────────────");
    
    try {
        const expectedFromPlugin = await plugin.getExpectedOutput(
            WETH_ADDRESS,
            USDC_ADDRESS,
            ethers.parseEther("0.0001")
        );
        console.log(`✅ Plugin.getExpectedOutput() returned: ${expectedFromPlugin.toString()}`);
        
        if (expectedFromPlugin.toString() === "0") {
            console.log(`   ❌ Output is 0 - plugin cannot calculate swap`);
        }
    } catch (error: any) {
        console.log(`❌ Plugin.getExpectedOutput() FAILED: ${error.message}`);
    }

    // ============ STEP 5: SWAP MANAGER SIMULATION ============
    console.log("\nSTEP 5: SwapManager Configuration");
    console.log("─────────────────────────────────────");
    
    const swapManager = await ethers.getContractAt("SwapManager", SWAP_MANAGER_ADDRESS);
    
    const simpleSwapRouter = await swapManager.simpleSwapRouter();
    console.log(`SwapManager.simpleSwapRouter: ${simpleSwapRouter}`);
    
    if (simpleSwapRouter === ethers.ZeroAddress) {
        console.log(`   ❌ SimpleSwap router NOT configured in SwapManager`);
    } else {
        console.log(`   ✅ SimpleSwap router is set`);
    }

    // ============ STEP 6: BALANCES & APPROVALS ============
    console.log("\nSTEP 6: Balances & Approvals");
    console.log("─────────────────────────────────────");
    
    const weth = await ethers.getContractAt("IERC20", WETH_ADDRESS);
    const proxyBalance = await weth.balanceOf(PROXY_GENERAL_ADDRESS);
    console.log(`ProxyGeneral WETH balance: ${ethers.formatEther(proxyBalance)} WETH`);
    
    if (proxyBalance === 0n) {
        console.log(`   ❌ No WETH in ProxyGeneral - cannot swap`);
    }
    
    const allowance = await weth.allowance(PROXY_GENERAL_ADDRESS, SWAP_MANAGER_ADDRESS);
    console.log(`ProxyGeneral → SwapManager allowance: ${ethers.formatEther(allowance)} WETH`);

    // ============ STEP 7: TRY ACTUAL SWAP ============
    console.log("\nSTEP 7: Attempt Swap (DRY RUN with callStatic)");
    console.log("─────────────────────────────────────");
    
    const swapAmount = ethers.parseEther("0.0001");
    
    try {
        // Simulate swap without sending transaction
        const result = await swapManager.performSwap.staticCall(
            WETH_ADDRESS,
            USDC_ADDRESS,
            swapAmount,
            0, // minAmountOut = 0 for test
            "UniswapV3Plugin"
        );
        
        console.log(`✅ Swap simulation SUCCEEDED!`);
        console.log(`   Would receive: ${result.toString()} USDC`);
    } catch (error: any) {
        console.log(`❌ Swap simulation FAILED`);
        console.log(`   Error: ${error.message}`);
        
        // Try to extract revert reason
        if (error.data) {
            try {
                const iface = swapManager.interface;
                const decodedError = iface.parseError(error.data);
                console.log(`   Decoded error: ${decodedError?.name}`);
                console.log(`   Args: ${JSON.stringify(decodedError?.args)}`);
            } catch {}
        }
    }

    // ============ CONCLUSIONS ============
    console.log("\n============================================================");
    console.log("  CONCLUSIONI");
    console.log("============================================================");
    console.log(`
1. Plugin address: ${pluginAddress}
2. SimpleSwap in plugin: ${simpleSwapAddress}
3. Is Uniswap Router: ${simpleSwapAddress === "0xE592427A0AEce92De3Edee1F18E0157C05861564"}
4. ProxyGeneral balance: ${ethers.formatEther(proxyBalance)} WETH
5. SwapManager router: ${simpleSwapRouter}
    `);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
