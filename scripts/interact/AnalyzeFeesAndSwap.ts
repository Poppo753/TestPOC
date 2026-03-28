import { ethers } from "hardhat";

async function main() {
    console.log("🔍 CHECKING FEES AND SWAP LOGIC\n");

    const liquidityManagerAddress = "0x545b79254F74Ba33958290BB73F2a338509c975d";
    const lm = await ethers.getContractAt("LiquidityManager", liquidityManagerAddress);

    // 1. Check current fees
    console.log("💰 CURRENT FEES:");
    const depositFee = await lm.depositFee();
    const withdrawFee = await lm.withdrawFee();
    console.log(`   Deposit Fee: ${depositFee} basis points (${Number(depositFee) / 100}%)`);
    console.log(`   Withdraw Fee: ${withdrawFee} basis points (${Number(withdrawFee) / 100}%)`);
    
    const feeRecipient = await lm.feeRecipient();
    console.log(`   Fee Recipient: ${feeRecipient}\n`);

    // 2. Simulate withdrawal calculation
    console.log("🧮 SIMULATING WITHDRAWAL CALCULATION:");
    
    const proxyAddress = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
    const proxy = await ethers.getContractAt("ProxyGeneral", proxyAddress);
    
    const [signer] = await ethers.getSigners();
    const userLpBalance = await proxy.balanceOf(signer.address);
    const totalSupply = await proxy.totalSupply();
    
    console.log(`   Your LP Balance: ${ethers.formatEther(userLpBalance)} LP`);
    console.log(`   Total LP Supply: ${ethers.formatEther(totalSupply)} LP`);
    console.log(`   Your Share: ${(Number(userLpBalance) * 100 / Number(totalSupply)).toFixed(2)}%\n`);

    // 3. Get pool value
    const valueCalculatorAddress = "0x4d763776C4474dc055CF7F1430b2DeeA9160283b";
    const calc = await ethers.getContractAt("ValueCalculator", valueCalculatorAddress);
    const poolInfo = await calc.getTotalPoolValue();
    
    console.log("📊 POOL VALUE BREAKDOWN:");
    console.log(`   Total Pool Value: ${ethers.formatEther(poolInfo.totalValue)} ETH`);
    for (const tv of poolInfo.tokenValues) {
        if (tv.tokenCode && tv.tokenCode !== "") {
            console.log(`      ${tv.tokenCode}: ${ethers.formatEther(tv.value)} ETH`);
        }
    }
    console.log("");

    // 4. Calculate what withdrawal should be
    const rawEthAmount = (userLpBalance * poolInfo.totalValue) / totalSupply;
    const feeAmount = (rawEthAmount * withdrawFee) / 10000n;
    const netWithdraw = rawEthAmount - feeAmount;
    
    console.log("💵 WITHDRAWAL CALCULATION:");
    console.log(`   Raw ETH Amount: ${ethers.formatEther(rawEthAmount)} ETH`);
    console.log(`   Withdraw Fee: ${ethers.formatEther(feeAmount)} ETH`);
    console.log(`   Net Withdraw: ${ethers.formatEther(netWithdraw)} ETH`);
    console.log(`   Fee goes to: ${feeRecipient}\n`);

    // 5. Check if swap would be needed
    const wethAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const weth = await ethers.getContractAt("IERC20", wethAddress);
    const wethBalance = await weth.balanceOf(proxyAddress);
    
    console.log("🔄 SWAP REQUIREMENT CHECK:");
    console.log(`   WETH in Pool: ${ethers.formatEther(wethBalance)} ETH`);
    console.log(`   Net Withdraw Needed: ${ethers.formatEther(netWithdraw)} ETH`);
    
    if (wethBalance < netWithdraw) {
        const wethNeeded = netWithdraw - wethBalance;
        console.log(`   ⚠️  SWAP REQUIRED! Need ${ethers.formatEther(wethNeeded)} more WETH`);
        console.log(`   This should trigger automatic swap of USDC/WBTC → WETH\n`);
    } else {
        console.log(`   ✅ NO SWAP NEEDED - sufficient WETH in pool\n`);
    }

    // 6. Check actual token balances to understand what could be swapped
    console.log("🪙 TOKEN BALANCES IN POOL:");
    const tokens = [
        { code: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
        { code: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
        { code: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
        { code: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 }
    ];
    
    for (const token of tokens) {
        const tokenContract = await ethers.getContractAt("IERC20", token.address);
        const balance = await tokenContract.balanceOf(proxyAddress);
        console.log(`   ${token.code}: ${ethers.formatUnits(balance, token.decimals)}`);
    }

    console.log("\n📝 CONCLUSION:");
    console.log("   If USDC/WBTC values were properly calculated (not 0 due to stale prices),");
    console.log("   the total pool value would be higher, requiring more WETH for withdrawal.");
    console.log("   This SHOULD trigger automatic swap, but currently doesn't because");
    console.log("   those tokens are valued at 0 ETH due to the 'Price too old' error.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
