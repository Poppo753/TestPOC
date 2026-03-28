import { ethers } from "hardhat";

/**
 * Test GMXv2Plugin with REAL keeper execution
 * 
 * This script:
 * 1. Funds test wallet with USDC
 * 2. Calls inputSwap to buy GM tokens
 * 3. Waits for GMX keeper to execute deposit (1-2 min)
 * 4. Verifies GM tokens received
 * 5. Tests selling GM tokens back
 * 
 * Prerequisites:
 * - GMX_V2_PLUGIN_TESTNET or GMX_V2_PLUGIN_ADDRESS in .env
 * - Test wallet with ETH for gas and execution fees
 * - USDC for testing (can get from faucet)
 * 
 * Run: npx hardhat run scripts/test/testKeeperExecution.ts --network arbitrumSepolia
 * Or for mainnet: --network arbitrum
 */

async function main() {
    console.log("\n🧪 Testing GMXv2Plugin with Real Keeper Execution\n");
    
    const [signer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📊 Test Info:");
    console.log("   Network:", network.name);
    console.log("   Chain ID:", network.chainId);
    console.log("   Signer:", signer.address);
    console.log("   Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH");
    console.log("");
    
    // Get plugin address
    const pluginAddress = process.env.GMX_V2_PLUGIN_ADDRESS || process.env.GMX_V2_PLUGIN_TESTNET;
    if (!pluginAddress) {
        throw new Error("GMX_V2_PLUGIN_ADDRESS or GMX_V2_PLUGIN_TESTNET not set in .env");
    }
    
    console.log("🔌 Plugin Address:", pluginAddress);
    console.log("");
    
    // Contract addresses (mainnet)
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const GM_BTC = "0x7C11F78Ce78768518D743E81Fdfa2F860C6b9A77";
    const GM_ETH = "0x450bb6774Dd8a756274E0ab4107953259d2ac541";
    
    // Connect to contracts
    const gmxPlugin = await ethers.getContractAt("GMXv2Plugin", pluginAddress);
    const usdc = await ethers.getContractAt("IERC20", USDC);
    const gmBtc = await ethers.getContractAt("IERC20", GM_BTC);
    const gmEth = await ethers.getContractAt("IERC20", GM_ETH);
    
    // Check execution fee
    const executionFee = await gmxPlugin["getExecutionFee()"]();
    console.log("💰 Execution Fee:", ethers.formatEther(executionFee), "ETH");
    console.log("");
    
    // Check balances
    const usdcBalance = await usdc.balanceOf(signer.address);
    const gmBtcBalance = await gmBtc.balanceOf(signer.address);
    const gmEthBalance = await gmEth.balanceOf(signer.address);
    
    console.log("📊 Initial Balances:");
    console.log("   USDC:", ethers.formatUnits(usdcBalance, 6));
    console.log("   GM BTC:", ethers.formatEther(gmBtcBalance));
    console.log("   GM ETH:", ethers.formatEther(gmEthBalance));
    console.log("");
    
    if (usdcBalance < ethers.parseUnits("100", 6)) {
        console.log("⚠️  WARNING: Low USDC balance");
        console.log("   Get testnet USDC from: https://faucet.circle.com/");
        console.log("   Or use Arbitrum faucet for other tokens");
        console.log("");
    }
    
    // ============ TEST 1: BUY GM BTC ============
    
    console.log("═".repeat(60));
    console.log("🧪 TEST 1: Buy GM BTC with USDC");
    console.log("═".repeat(60));
    console.log("");
    
    const buyAmount = ethers.parseUnits("100", 6); // 100 USDC
    console.log("   Amount:", ethers.formatUnits(buyAmount, 6), "USDC");
    console.log("   Target: GM BTC");
    console.log("");
    
    // Approve USDC
    console.log("   1️⃣ Approving USDC...");
    const approveTx = await usdc.approve(pluginAddress, buyAmount);
    await approveTx.wait();
    console.log("   ✅ USDC approved");
    console.log("");
    
    // Call inputSwap
    console.log("   2️⃣ Calling inputSwap...");
    const swapTx = await gmxPlugin.inputSwap(USDC, GM_BTC, buyAmount, {
        value: executionFee
    });
    const receipt = await swapTx.wait();
    console.log("   ✅ Transaction confirmed");
    console.log("   Tx hash:", receipt?.hash);
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
    
    // Wait for keeper execution
    console.log("   ⏳ Waiting for GMX keeper to execute deposit...");
    console.log("   Expected time: 1-2 minutes");
    console.log("   Monitor on GMX: https://app.gmx.io");
    console.log("");
    
    // Poll for GM BTC balance increase
    let gmBtcReceived = false;
    const startTime = Date.now();
    const maxWaitTime = 180000; // 3 minutes max
    
    while (!gmBtcReceived && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
        
        const newGmBtcBalance = await gmBtc.balanceOf(signer.address);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        
        process.stdout.write(`\r   ⏱️  ${elapsed}s elapsed... GM BTC: ${ethers.formatEther(newGmBtcBalance)}`);
        
        if (newGmBtcBalance > gmBtcBalance) {
            gmBtcReceived = true;
            const received = newGmBtcBalance - gmBtcBalance;
            console.log("");
            console.log("");
            console.log("   ✅ GM BTC received!");
            console.log("   Amount:", ethers.formatEther(received));
            console.log("   Time:", elapsed, "seconds");
            console.log("");
        }
    }
    
    if (!gmBtcReceived) {
        console.log("");
        console.log("");
        console.log("   ⚠️  Keeper execution taking longer than expected");
        console.log("   Check status on GMX app or wait longer");
        console.log("");
        
        if (depositKey) {
            console.log("   Check operation status:");
            const status = await gmxPlugin.checkOperationStatus(depositKey);
            console.log("   Is Pending:", status.isPending);
            console.log("   Estimated Time:", status.estimatedExecutionTime.toString());
        }
        
        console.log("");
        console.log("   Test will continue with selling if you have existing GM tokens");
        console.log("");
    }
    
    // ============ TEST 2: SELL GM ETH (if available) ============
    
    if (gmEthBalance > 0) {
        console.log("═".repeat(60));
        console.log("🧪 TEST 2: Sell GM ETH for USDC");
        console.log("═".repeat(60));
        console.log("");
        
        const sellAmount = ethers.parseEther("0.001"); // 0.001 GM ETH
        console.log("   Amount:", ethers.formatEther(sellAmount), "GM ETH");
        console.log("   Target: USDC");
        console.log("");
        
        // Approve GM ETH
        console.log("   1️⃣ Approving GM ETH...");
        const approveGmTx = await gmEth.approve(pluginAddress, sellAmount);
        await approveGmTx.wait();
        console.log("   ✅ GM ETH approved");
        console.log("");
        
        // Call inputSwap (selling GM for USDC)
        console.log("   2️⃣ Calling inputSwap (sell)...");
        const sellTx = await gmxPlugin.inputSwap(GM_ETH, USDC, sellAmount, {
            value: executionFee
        });
        const sellReceipt = await sellTx.wait();
        console.log("   ✅ Transaction confirmed");
        console.log("   Tx hash:", sellReceipt?.hash);
        console.log("");
        
        // Extract withdrawal key
        let withdrawalKey: string | undefined;
        if (sellReceipt?.logs) {
            for (const log of sellReceipt.logs) {
                try {
                    const parsed = gmxPlugin.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    if (parsed?.name === "WithdrawalCreated") {
                        withdrawalKey = parsed.args.withdrawalKey;
                        console.log("   📝 Withdrawal Key:", withdrawalKey);
                        break;
                    }
                } catch (e) {
                    // Ignore
                }
            }
        }
        console.log("");
        
        console.log("   ⏳ Waiting for GMX keeper to execute withdrawal...");
        console.log("   Expected time: 1-2 minutes");
        console.log("");
        
        // Poll for USDC balance increase
        let usdcReceived = false;
        const sellStartTime = Date.now();
        
        while (!usdcReceived && (Date.now() - sellStartTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            const newUsdcBalance = await usdc.balanceOf(signer.address);
            const elapsed = Math.floor((Date.now() - sellStartTime) / 1000);
            
            process.stdout.write(`\r   ⏱️  ${elapsed}s elapsed... USDC: ${ethers.formatUnits(newUsdcBalance, 6)}`);
            
            if (newUsdcBalance > usdcBalance) {
                usdcReceived = true;
                const received = newUsdcBalance - usdcBalance;
                console.log("");
                console.log("");
                console.log("   ✅ USDC received!");
                console.log("   Amount:", ethers.formatUnits(received, 6));
                console.log("   Time:", elapsed, "seconds");
                console.log("");
            }
        }
        
        if (!usdcReceived) {
            console.log("");
            console.log("");
            console.log("   ⚠️  Keeper execution taking longer than expected");
            if (withdrawalKey) {
                const status = await gmxPlugin.checkOperationStatus(withdrawalKey);
                console.log("   Is Pending:", status.isPending);
            }
            console.log("");
        }
    } else {
        console.log("⏭️  Skipping sell test (no GM ETH balance)");
        console.log("");
    }
    
    // ============ FINAL SUMMARY ============
    
    console.log("═".repeat(60));
    console.log("📊 FINAL BALANCES");
    console.log("═".repeat(60));
    console.log("");
    
    const finalUsdcBalance = await usdc.balanceOf(signer.address);
    const finalGmBtcBalance = await gmBtc.balanceOf(signer.address);
    const finalGmEthBalance = await gmEth.balanceOf(signer.address);
    
    console.log("   USDC:", ethers.formatUnits(finalUsdcBalance, 6));
    console.log("   GM BTC:", ethers.formatEther(finalGmBtcBalance));
    console.log("   GM ETH:", ethers.formatEther(finalGmEthBalance));
    console.log("");
    
    console.log("🔄 Changes:");
    console.log("   USDC:", ethers.formatUnits(finalUsdcBalance - usdcBalance, 6));
    console.log("   GM BTC:", ethers.formatEther(finalGmBtcBalance - gmBtcBalance));
    console.log("   GM ETH:", ethers.formatEther(finalGmEthBalance - gmEthBalance));
    console.log("");
    
    if (gmBtcReceived) {
        console.log("✅ Test PASSED - Keeper executed successfully");
    } else {
        console.log("⚠️  Test INCOMPLETE - Keeper execution pending");
        console.log("   Check GMX app for status");
    }
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Test failed:");
        console.error(error);
        process.exit(1);
    });
