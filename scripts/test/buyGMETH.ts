import { ethers } from "hardhat";

/**
 * Buy GM ETH tokens using WETH from ProxyGeneral
 * 
 * This script:
 * 1. Checks WETH balance in ProxyGeneral
 * 2. Calls SwapManager to execute swap WETH → GM-ETH
 * 3. Monitors for keeper execution
 * 4. Verifies GM ETH tokens received
 * 
 * Run: npx hardhat run scripts/test/buyGMETH.ts --network arbitrum
 */

async function main() {
    console.log("\n🚀 Buying GM ETH with WETH from ProxyGeneral\n");
    
    const [signer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📊 Transaction Info:");
    console.log("   Network:", network.name);
    console.log("   Signer:", signer.address);
    console.log("   Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH");
    console.log("");
    
    // Contract addresses
    const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
    const SWAP_MANAGER = "0x01269d496E957A54e02cdcd5888957baf317A947";
    const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
    const GMX_PLUGIN = "0x821BAF0f941A99677FD0DaE159b60d1165fdE13E";
    
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const GM_ETH = "0x450bb6774Dd8a756274E0ab4107953259d2ac541";
    
    // Connect to contracts
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", PROXY_GENERAL);
    const swapManager = await ethers.getContractAt("SwapManager", SWAP_MANAGER);
    const tokenManager = await ethers.getContractAt("TokenManager", TOKEN_MANAGER);
    const gmxPlugin = await ethers.getContractAt("GMXv2Plugin", GMX_PLUGIN);
    const weth = await ethers.getContractAt("IERC20", WETH);
    const gmEth = await ethers.getContractAt("IERC20", GM_ETH);
    
    // Check execution fee
    const executionFee = await gmxPlugin["getExecutionFee()"]();
    console.log("💰 Execution Fee:", ethers.formatEther(executionFee), "ETH (0.002 ETH required)");
    console.log("");
    
    // Check WETH balance in ProxyGeneral
    console.log("📊 Checking balances...");
    const wethBalance = await weth.balanceOf(PROXY_GENERAL);
    const gmEthBalance = await gmEth.balanceOf(PROXY_GENERAL);
    
    console.log("   WETH in ProxyGeneral:", ethers.formatEther(wethBalance));
    console.log("   GM-ETH in ProxyGeneral:", ethers.formatEther(gmEthBalance));
    console.log("");
    
    if (wethBalance === 0n) {
        console.log("❌ No WETH in ProxyGeneral!");
        console.log("   Deposit WETH first or use depositWETH function");
        return;
    }
    
    // Check if user has enough ETH for execution fee
    const ethBalance = await ethers.provider.getBalance(signer.address);
    if (ethBalance < executionFee) {
        console.log("❌ Insufficient ETH for execution fee!");
        console.log("   Need:", ethers.formatEther(executionFee), "ETH");
        console.log("   Have:", ethers.formatEther(ethBalance), "ETH");
        return;
    }
    
    // Determine swap amount (use 10% of WETH balance or min 0.01 WETH)
    const minAmount = ethers.parseEther("0.01");
    const swapAmount = wethBalance > minAmount * 10n ? wethBalance / 10n : wethBalance;
    
    console.log("💱 Swap Details:");
    console.log("   From: WETH");
    console.log("   To: GM-ETH");
    console.log("   Amount:", ethers.formatEther(swapAmount), "WETH");
    console.log("   Execution Fee:", ethers.formatEther(executionFee), "ETH");
    console.log("");
    
    // Check SwapManager active plugin
    const activePlugin = await swapManager.activeSwapPlugin();
    console.log("🔌 Active Plugin:", activePlugin);
    
    if (activePlugin !== "GMX-V2") {
        console.log("⚠️  Warning: Active plugin is not GMX-V2");
        console.log("   This swap may not use GMXv2Plugin");
    }
    console.log("");
    
    // Execute swap via SwapManager
    console.log("═".repeat(60));
    console.log("🔄 EXECUTING SWAP");
    console.log("═".repeat(60));
    console.log("");
    
    console.log("⚠️  NOTA: ProxyGeneral richiede chiamate da moduli autorizzati");
    console.log("   Per testare, useremo WETH dal wallet direttamente");
    console.log("");
    
    // Check user's WETH balance
    const userWethBalance = await weth.balanceOf(signer.address);
    console.log("   WETH in wallet:", ethers.formatEther(userWethBalance));
    
    if (userWethBalance === 0n) {
        console.log("");
        console.log("❌ No WETH in wallet!");
        console.log("   Wrap some ETH first:");
        console.log("   1. Visit https://app.uniswap.org");
        console.log("   2. Or call WETH.deposit() with ETH");
        console.log("");
        console.log("   Alternative: Use LiquidityManager to interact with ProxyGeneral");
        return;
    }
    
    // Use wallet WETH (not ProxyGeneral)
    const actualSwapAmount = userWethBalance > minAmount ? minAmount : userWethBalance;
    
    console.log("");
    console.log("💱 Swap Details:");
    console.log("   From: WETH (wallet)");
    console.log("   To: GM-ETH (will be sent to ProxyGeneral)");
    console.log("   Amount:", ethers.formatEther(actualSwapAmount), "WETH");
    console.log("   Execution Fee:", ethers.formatEther(executionFee), "ETH");
    console.log("");
    
    try {
        console.log("   Step 1: Approve GMXv2Plugin to spend WETH...");
        const approveTx = await weth.approve(GMX_PLUGIN, actualSwapAmount);
        await approveTx.wait();
        console.log("   ✅ Plugin approved");
        console.log("");
        
        console.log("   Step 2: Calling GMXv2Plugin.inputSwap...");
        console.log("   Parameters:");
        console.log("     - spendToken:", WETH);
        console.log("     - receiveToken:", GM_ETH);
        console.log("     - spendAmount:", ethers.formatEther(actualSwapAmount));
        console.log("     - value:", ethers.formatEther(executionFee), "ETH");
        console.log("");
        
        // Call plugin (GM tokens will be sent to ProxyGeneral as receiver)
        const tx = await gmxPlugin.inputSwap(
            WETH,
            GM_ETH,
            actualSwapAmount,
            { value: executionFee }
        );
        
        console.log("   📝 Transaction sent:", tx.hash);
        console.log("   ⏳ Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log("   ✅ Transaction confirmed!");
        console.log("   Gas used:", receipt?.gasUsed.toString());
        console.log("");
        
        // Extract deposit key from events
        let depositKey: string | undefined;
        if (receipt?.logs) {
            for (const log of receipt.logs) {
                try {
                    const parsed = gmxPlugin.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    if (parsed?.name === "DepositCreated") {
                        depositKey = parsed.args.depositKey;
                        console.log("   📝 Deposit Key:", depositKey);
                        break;
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }
        console.log("");
        
    } catch (error: any) {
        console.log("   ❌ Swap failed:", error.message);
        
        if (error.message.includes("revert")) {
            console.log("");
            console.log("   Common issues:");
            console.log("   - Insufficient WETH in ProxyGeneral");
            console.log("   - Execution fee too low");
            console.log("   - Plugin not properly configured");
            console.log("   - Market not active in GMXv2Plugin");
        }
        return;
    }
    
    // Wait for keeper execution
    console.log("═".repeat(60));
    console.log("⏳ WAITING FOR GMX KEEPER");
    console.log("═".repeat(60));
    console.log("");
    console.log("   GMX keepers typically execute deposits in 1-2 minutes");
    console.log("   Monitor on: https://app.gmx.io");
    console.log("");
    
    // Poll for GM ETH balance increase
    let tokensReceived = false;
    const startTime = Date.now();
    const maxWaitTime = 180000; // 3 minutes
    const pollInterval = 10000;  // 10 seconds
    
    console.log("   Polling for GM-ETH balance increase...");
    
    while (!tokensReceived && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const newGmEthBalance = await gmEth.balanceOf(PROXY_GENERAL);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        
        process.stdout.write(`\r   ⏱️  ${elapsed}s elapsed... GM-ETH: ${ethers.formatEther(newGmEthBalance)} `);
        
        if (newGmEthBalance > gmEthBalance) {
            tokensReceived = true;
            const received = newGmEthBalance - gmEthBalance;
            console.log("");
            console.log("");
            console.log("   ✅ GM-ETH TOKENS RECEIVED!");
            console.log("   Amount:", ethers.formatEther(received));
            console.log("   Time:", elapsed, "seconds");
            console.log("");
        }
    }
    
    if (!tokensReceived) {
        console.log("");
        console.log("");
        console.log("   ⚠️  Keeper execution taking longer than expected");
        console.log("   This is normal - GMX keepers can take 2-5 minutes");
        console.log("");
        console.log("   Check status:");
        console.log("   1. Visit https://app.gmx.io");
        console.log("   2. Check your recent transactions");
        console.log("   3. Look for pending deposits");
        console.log("");
        console.log("   Run this to check balance later:");
        console.log("   proxyGeneral.getBalance('GM-ETH')");
        console.log("");
    }
    
    // Final balances
    console.log("═".repeat(60));
    console.log("📊 FINAL BALANCES");
    console.log("═".repeat(60));
    console.log("");
    
    const finalWethBalance = await weth.balanceOf(PROXY_GENERAL);
    const finalGmEthBalance = await gmEth.balanceOf(PROXY_GENERAL);
    
    console.log("   WETH:", ethers.formatEther(finalWethBalance));
    console.log("   GM-ETH:", ethers.formatEther(finalGmEthBalance));
    console.log("");
    
    console.log("🔄 Changes:");
    console.log("   WETH:", ethers.formatEther(finalWethBalance - wethBalance), "(spent)");
    console.log("   GM-ETH:", ethers.formatEther(finalGmEthBalance - gmEthBalance), "(received)");
    console.log("");
    
    // Get GM-ETH price
    try {
        const priceData = await tokenManager.getTokenPrice("GM-ETH");
        const gmEthPrice = priceData.price || priceData[0]; // Handle tuple or struct
        console.log("💰 GM-ETH Value:");
        console.log("   Price:", ethers.formatEther(gmEthPrice), "ETH per GM-ETH");
        console.log("   Total Value:", ethers.formatEther((finalGmEthBalance * gmEthPrice) / ethers.parseEther("1")), "ETH");
        console.log("");
    } catch (e) {
        console.log("⚠️  Could not fetch GM-ETH price");
        console.log("");
    }
    
    if (tokensReceived) {
        console.log("✅ SWAP COMPLETE - GM-ETH tokens successfully received!");
    } else {
        console.log("⏳ SWAP PENDING - Check back in a few minutes");
    }
    console.log("");
    
    console.log("🔗 Next Actions:");
    console.log("   - View position: https://app.gmx.io");
    console.log("   - Check balance: await gmEth.balanceOf(PROXY_GENERAL)");
    console.log("   - Sell GM-ETH: Run script with reverse swap");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Script failed:");
        console.error(error);
        process.exit(1);
    });
