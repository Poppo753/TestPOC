/**
 * @file verify-aave3-postdeploy.ts
 * @description Post-deploy verification for AaveV3Plugin + FlashLoanService
 * 
 * Steps:
 * 1. Verify Beacon registrations
 * 2. Verify ProxyGeneral authorization
 * 3. Test deposit 0.001 WETH via ProtocolManager
 * 4. Test withdraw 0.001 WETH
 * 5. Test openLeverageAtomic 0.01 WETH 1.5x
 * 6. Test closeLeverageAtomic
 * 
 * USAGE:
 *   npx hardhat run scripts/verify-aave3-postdeploy.ts --network arbitrum
 */

import { ethers, network } from "hardhat";

// ==================== ADDRESSES ====================

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
const AAVE_V3_PLUGIN = "0x7aEA35f66d054bB6C68957A8A27b10F08c33aA7A";
const FLASH_LOAN_SERVICE = "0x3486b561CA1E3Dc146F97D8Ed4B9e4f2cd10822d";

const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const aWETH = "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8";

// ==================== AMOUNTS ====================
const DEPOSIT_AMOUNT = ethers.parseEther("0.0005");   // 0.0005 WETH for deposit test
const LEVERAGE_AMOUNT = ethers.parseEther("0.0005");  // 0.0005 WETH for leverage test

// ==================== HELPERS ====================
const fmt = (v: bigint, d = 18) => Number(ethers.formatUnits(v, d)).toFixed(d === 6 ? 2 : 6);
const fmtE = (v: bigint) => fmt(v, 18);
const fmtU = (v: bigint) => fmt(v, 6);

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🔍 POST-DEPLOY VERIFICATION: AaveV3Plugin + FlashLoanService");
    console.log("=".repeat(70));

    const [deployer] = await ethers.getSigners();
    const deployerAddr = deployer.address;
    const ethBalance = await ethers.provider.getBalance(deployerAddr);

    console.log(`\n📍 Deployer: ${deployerAddr}`);
    console.log(`   ETH Balance: ${fmtE(ethBalance)} ETH`);
    console.log(`   Network: ${network.name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);

    // ==================== CONTRACTS ====================

    const beacon = await ethers.getContractAt(
        [
            "function getImplementation(string memory name) view returns (address)",
            "function getRegisteredModules() view returns (string[] memory)",
            "function checkModuleExists(string memory module) view returns (bool)",
        ],
        BEACON
    );

    const proxy = await ethers.getContractAt(
        [
            "function authorizedModules(address module) view returns (bool)",
        ],
        PROXY_GENERAL
    );

    const weth = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256)", "function deposit() payable"],
        WETH
    );

    const usdc = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)"],
        USDC
    );

    const aWethToken = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)"],
        aWETH
    );

    const protocolManager = await ethers.getContractAt(
        [
            "function deposit(string memory protocolName, string memory tokenCode, uint256 amount) external",
            "function withdraw(string memory protocolName, string memory tokenCode, uint256 amount) external",
            "function getBalance(string memory protocolName, string memory tokenCode) view returns (uint256)",
        ],
        PROTOCOL_MANAGER,
        deployer
    );

    const plugin = await ethers.getContractAt("AaveV3Plugin", AAVE_V3_PLUGIN, deployer);

    let testsPassed = 0;
    let testsFailed = 0;

    function pass(msg: string) { console.log(`   ✅ ${msg}`); testsPassed++; }
    function fail(msg: string) { console.log(`   ❌ ${msg}`); testsFailed++; }

    // ==================== STEP 1: Verify Beacon Registrations ====================

    console.log("\n\n📋 STEP 1: Verify Beacon Registrations");
    console.log("-".repeat(50));

    try {
        const pluginAddr = await beacon.getImplementation("AaveV3Plugin");
        if (pluginAddr.toLowerCase() === AAVE_V3_PLUGIN.toLowerCase()) {
            pass(`AaveV3Plugin → ${pluginAddr}`);
        } else {
            fail(`AaveV3Plugin mismatch: expected ${AAVE_V3_PLUGIN}, got ${pluginAddr}`);
        }
    } catch (e: any) { fail(`AaveV3Plugin: ${e.message}`); }

    try {
        const flashAddr = await beacon.getImplementation("FlashLoanService");
        if (flashAddr.toLowerCase() === FLASH_LOAN_SERVICE.toLowerCase()) {
            pass(`FlashLoanService → ${flashAddr}`);
        } else {
            fail(`FlashLoanService mismatch: expected ${FLASH_LOAN_SERVICE}, got ${flashAddr}`);
        }
    } catch (e: any) { fail(`FlashLoanService: ${e.message}`); }

    // Check getRegisteredModules includes both
    const modules = await beacon.getRegisteredModules();
    console.log(`   Registered modules (${modules.length}): [${modules.join(", ")}]`);
    if (modules.includes("AaveV3Plugin")) pass("AaveV3Plugin in registered modules");
    else fail("AaveV3Plugin NOT in registered modules");
    if (modules.includes("FlashLoanService")) pass("FlashLoanService in registered modules");
    else fail("FlashLoanService NOT in registered modules");

    // ==================== STEP 2: Verify ProxyGeneral Auth ====================

    console.log("\n📋 STEP 2: Verify ProxyGeneral Authorization");
    console.log("-".repeat(50));

    const isAuth = await proxy.authorizedModules(AAVE_V3_PLUGIN);
    if (isAuth) pass(`AaveV3Plugin authorized in ProxyGeneral`);
    else fail(`AaveV3Plugin NOT authorized in ProxyGeneral`);

    // ==================== STEP 3: Verify Plugin Configuration ====================

    console.log("\n📋 STEP 3: Verify Plugin Configuration");
    console.log("-".repeat(50));

    try {
        const pluginOwner = await plugin.owner();
        if (pluginOwner.toLowerCase() === deployerAddr.toLowerCase()) {
            pass(`Plugin owner: ${pluginOwner}`);
        } else {
            fail(`Plugin owner mismatch: ${pluginOwner}`);
        }
    } catch (e: any) { fail(`Plugin owner check: ${e.message}`); }

    try {
        const pluginBeacon = await plugin.beacon();
        if (pluginBeacon.toLowerCase() === BEACON.toLowerCase()) {
            pass(`Plugin beacon: ${pluginBeacon}`);
        } else {
            fail(`Plugin beacon mismatch: ${pluginBeacon}`);
        }
    } catch (e: any) { fail(`Plugin beacon check: ${e.message}`); }

    // ==================== CHECK BALANCES ====================

    const wethBal = await weth.balanceOf(deployerAddr);
    const proxyWeth = await weth.balanceOf(PROXY_GENERAL);
    const pluginAWeth = await aWethToken.balanceOf(AAVE_V3_PLUGIN);

    console.log(`\n📊 Current Balances:`);
    console.log(`   Deployer ETH:     ${fmtE(ethBalance)}`);
    console.log(`   Deployer WETH:    ${fmtE(wethBal)}`);
    console.log(`   ProxyGeneral WETH: ${fmtE(proxyWeth)}`);
    console.log(`   Plugin aWETH:     ${fmtE(pluginAWeth)}`);

    // ==================== STEP 4: Test Deposit ====================

    console.log("\n📋 STEP 4: Test Deposit (0.001 WETH)");
    console.log("-".repeat(50));

    // Calculate if we have enough
    const totalNeeded = DEPOSIT_AMOUNT + LEVERAGE_AMOUNT + ethers.parseEther("0.0001"); // buffer for gas
    const canDeposit = (proxyWeth >= DEPOSIT_AMOUNT) || (ethBalance > DEPOSIT_AMOUNT + ethers.parseEther("0.0001"));
    const canLeverage = ethBalance > LEVERAGE_AMOUNT + ethers.parseEther("0.0001");

    if (!canDeposit) {
        console.log(`   ⚠️  Insufficient funds for deposit test.`);
        console.log(`   ProxyGeneral WETH: ${fmtE(proxyWeth)}, Deployer ETH: ${fmtE(ethBalance)}`);
        console.log(`   Skipping deposit test.`);
    } else {
        // Use existing ProxyGeneral WETH if available, otherwise wrap
        if (proxyWeth >= DEPOSIT_AMOUNT) {
            console.log(`   Using existing ${fmtE(proxyWeth)} WETH in ProxyGeneral`);
        } else {
            console.log(`   Wrapping ${fmtE(DEPOSIT_AMOUNT)} ETH → WETH...`);
            const wrapTx = await weth.connect(deployer).deposit({ value: DEPOSIT_AMOUNT });
            await wrapTx.wait();

            const wethContract = await ethers.getContractAt(
                ["function transfer(address,uint256) returns (bool)"],
                WETH, deployer
            );
            console.log(`   Sending WETH to ProxyGeneral...`);
            const transferTx = await wethContract.transfer(PROXY_GENERAL, DEPOSIT_AMOUNT);
            await transferTx.wait();
            pass(`Sent ${fmtE(DEPOSIT_AMOUNT)} WETH to ProxyGeneral`);
        }

        // Deposit via ProtocolManager
        console.log(`   Depositing via ProtocolManager...`);
        try {
            const depositTx = await protocolManager.deposit("AaveV3Plugin", "WETH", DEPOSIT_AMOUNT);
            const receipt = await depositTx.wait();
            console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);
            pass(`Deposit ${fmtE(DEPOSIT_AMOUNT)} WETH via ProtocolManager`);

            // Verify aWETH balance increased
            const aWethAfter = await aWethToken.balanceOf(AAVE_V3_PLUGIN);
            console.log(`   Plugin aWETH balance: ${fmtE(aWethAfter)}`);
            if (aWethAfter > pluginAWeth) {
                pass(`aWETH increased: ${fmtE(pluginAWeth)} → ${fmtE(aWethAfter)}`);
            } else {
                fail(`aWETH did not increase!`);
            }

            // Check via ProtocolManager.getBalance
            const pmBalance = await protocolManager.getBalance("AaveV3Plugin", "WETH");
            console.log(`   ProtocolManager.getBalance: ${fmtE(pmBalance)} WETH`);
            if (pmBalance > 0n) pass(`ProtocolManager reports balance > 0`);
            else fail(`ProtocolManager reports 0 balance`);

        } catch (e: any) {
            fail(`Deposit failed: ${e.message?.substring(0, 200)}`);
        }

        // ==================== STEP 5: Withdraw deposit back ====================

        console.log("\n📋 STEP 5: Withdraw 0.0005 WETH back");
        console.log("-".repeat(50));

        try {
            const withdrawTx = await protocolManager.withdraw("AaveV3Plugin", "WETH", DEPOSIT_AMOUNT);
            const wReceipt = await withdrawTx.wait();
            console.log(`   Gas used: ${wReceipt?.gasUsed.toString()}`);
            pass(`Withdraw ${fmtE(DEPOSIT_AMOUNT)} WETH`);

            const aWethAfterWithdraw = await aWethToken.balanceOf(AAVE_V3_PLUGIN);
            console.log(`   Plugin aWETH after withdraw: ${fmtE(aWethAfterWithdraw)}`);

            const proxyWethAfter = await weth.balanceOf(PROXY_GENERAL);
            console.log(`   ProxyGeneral WETH: ${fmtE(proxyWethAfter)}`);
            if (proxyWethAfter >= DEPOSIT_AMOUNT - ethers.parseEther("0.00001")) {
                pass(`WETH returned to ProxyGeneral`);
            } else {
                fail(`WETH not fully returned to ProxyGeneral`);
            }
        } catch (e: any) {
            fail(`Withdraw failed: ${e.message?.substring(0, 200)}`);
        }
    }

    // ==================== STEP 6: Test Leverage ====================

    console.log("\n📋 STEP 6: Test Leverage (0.0005 WETH, 1.5x)");
    console.log("-".repeat(50));

    const ethBalNow = await ethers.provider.getBalance(deployerAddr);
    const canDoLeverage = ethBalNow > LEVERAGE_AMOUNT + ethers.parseEther("0.0001");

    if (!canDoLeverage) {
        console.log(`   ⚠️  Insufficient ETH for leverage test.`);
        console.log(`   Need: >${fmtE(LEVERAGE_AMOUNT + ethers.parseEther("0.0002"))} ETH`);
        console.log(`   Have: ${fmtE(ethBalNow)} ETH`);
        console.log(`   Skipping leverage test.`);
    } else {
        // Wrap ETH → WETH for leverage
        console.log(`   Wrapping ${fmtE(LEVERAGE_AMOUNT)} ETH → WETH...`);
        const wrapTx = await weth.connect(deployer).deposit({ value: LEVERAGE_AMOUNT });
        await wrapTx.wait();

        // Approve plugin
        console.log(`   Approving AaveV3Plugin...`);
        const approveTx = await weth.connect(deployer).approve(AAVE_V3_PLUGIN, LEVERAGE_AMOUNT);
        await approveTx.wait();

        // Open leverage
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        console.log(`   Opening 1.5x leverage with ${fmtE(LEVERAGE_AMOUNT)} WETH...`);

        try {
            const openTx = await plugin.openLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                collateralAmount: LEVERAGE_AMOUNT,
                targetLeverageX100: 150, // 1.5x
                minHealthFactor: ethers.parseEther("1.1"),
                deadline,
            });
            const openReceipt = await openTx.wait();
            console.log(`   Gas used (open): ${openReceipt?.gasUsed.toString()}`);
            pass(`openLeverageAtomic 1.5x executed`);

            // Check position
            const aWethLev = await aWethToken.balanceOf(AAVE_V3_PLUGIN);
            const debt = await plugin.getDebt("USDC");
            const hf = await plugin.getHealthFactor();

            console.log(`   aWETH collateral: ${fmtE(aWethLev)}`);
            console.log(`   USDC debt: ${fmtU(debt)}`);
            console.log(`   Health Factor: ${fmtE(hf)}`);

            if (aWethLev > LEVERAGE_AMOUNT) pass(`Collateral leveraged: ${fmtE(aWethLev)} > ${fmtE(LEVERAGE_AMOUNT)}`);
            else fail(`Collateral not leveraged`);

            if (debt > 0n) pass(`Debt created: ${fmtU(debt)} USDC`);
            else fail(`No debt created`);

            if (hf > ethers.parseEther("1.1")) pass(`Health factor healthy: ${fmtE(hf)}`);
            else fail(`Health factor too low: ${fmtE(hf)}`);

            // ==================== STEP 7: Close Leverage ====================

            console.log("\n📋 STEP 7: Close Leverage Position");
            console.log("-".repeat(50));

            console.log(`   Closing leverage position...`);
            const usdcBefore = await usdc.balanceOf(deployerAddr);

            const closeTx = await plugin.closeLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                maxSlippageBps: 200, // 2%
                deadline: Math.floor(Date.now() / 1000) + 3600,
            });
            const closeReceipt = await closeTx.wait();
            console.log(`   Gas used (close): ${closeReceipt?.gasUsed.toString()}`);
            pass(`closeLeverageAtomic executed`);

            const debtAfter = await plugin.getDebt("USDC");
            const aWethAfter = await aWethToken.balanceOf(AAVE_V3_PLUGIN);
            const usdcAfter = await usdc.balanceOf(deployerAddr);
            const usdcReturned = usdcAfter - usdcBefore;

            console.log(`   Debt after close: ${fmtU(debtAfter)} USDC`);
            console.log(`   aWETH after close: ${fmtE(aWethAfter)}`);
            console.log(`   USDC equity returned: ${fmtU(usdcReturned)}`);

            if (debtAfter === 0n) pass(`Debt fully repaid`);
            else fail(`Debt remaining: ${fmtU(debtAfter)}`);

            if (usdcReturned > 0n) pass(`Equity returned: ${fmtU(usdcReturned)} USDC`);
            else fail(`No equity returned`);

        } catch (e: any) {
            fail(`Leverage failed: ${e.message?.substring(0, 300)}`);
        }
    }

    // ==================== SUMMARY ====================

    console.log("\n" + "=".repeat(70));
    console.log("📊 VERIFICATION SUMMARY");
    console.log("=".repeat(70));
    console.log(`   ✅ Passed: ${testsPassed}`);
    console.log(`   ❌ Failed: ${testsFailed}`);
    console.log(`   Total:    ${testsPassed + testsFailed}`);

    if (testsFailed === 0) {
        console.log("\n   🎉 ALL VERIFICATIONS PASSED!");
    } else {
        console.log(`\n   ⚠️  ${testsFailed} verification(s) failed!`);
    }

    console.log("\n   Final Balances:");
    const finalEth = await ethers.provider.getBalance(deployerAddr);
    const finalWeth = await weth.balanceOf(deployerAddr);
    const finalProxyWeth = await weth.balanceOf(PROXY_GENERAL);
    const finalUsdc = await usdc.balanceOf(deployerAddr);
    console.log(`   Deployer ETH:      ${fmtE(finalEth)}`);
    console.log(`   Deployer WETH:     ${fmtE(finalWeth)}`);
    console.log(`   Deployer USDC:     ${fmtU(finalUsdc)}`);
    console.log(`   ProxyGeneral WETH: ${fmtE(finalProxyWeth)}`);
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Verification failed:");
        console.error(error);
        process.exit(1);
    });
