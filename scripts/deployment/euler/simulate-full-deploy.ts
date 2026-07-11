/**
 * @file simulate-full-deploy.ts
 * @description Simula il deploy COMPLETO su fork Arbitrum e misura gas/costi reali
 * 
 * Simula:
 * 1. Deploy FlashLoanService
 * 2. Upgrade EulerV2Plugin (deploy new + beacon update + ownership transfer)
 * 3. Configure system (verify all)
 * 4. Test operations (deposit, withdraw, borrow, repay, closePosition, leverage)
 * 
 * USAGE:
 *   $env:FORK_ENABLED="true"; npx hardhat run scripts/deployment/euler/simulate-full-deploy.ts
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES, EULER_VAULTS } from "../../config/arbitrum.config";

// Base Asset Configuration
const BASE_ASSET_CODE = "USDC";

const BEACON_ADDRESS = ARBITRUM_ADDRESSES.BEACON;
const OLD_PLUGIN = "0x490139F3b29786D64056a236a0062CA23A7313f6";
const EULER_REGISTRY = "0xa2bE49a4b89F7e7131f8e72015E8a6CD20201BC6";

interface GasResult {
    step: string;
    gasUsed: bigint;
    txHash?: string;
}

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🔬 SIMULAZIONE DEPLOY COMPLETO — Arbitrum Fork");
    console.log("=".repeat(70) + "\n");

    const results: GasResult[] = [];
    
    // Get deployer (impersonate beacon owner)
    const beaconOwnerAddr = "0x8390e98483a9b39265428c8610371134B5d11C3F";
    await ethers.provider.send("hardhat_impersonateAccount", [beaconOwnerAddr]);
    
    // Fund the impersonated account
    const [funder] = await ethers.getSigners();
    await funder.sendTransaction({
        to: beaconOwnerAddr,
        value: ethers.parseEther("1.0"),
    });
    
    const deployer = await ethers.getSigner(beaconOwnerAddr);
    const balance = await ethers.provider.getBalance(beaconOwnerAddr);
    console.log(`📍 Deployer: ${beaconOwnerAddr}`);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH\n`);

    // Get beacon
    const beacon = await ethers.getContractAt(
        [
            "function updateImplementation(string memory moduleName, address newImplementation) external",
            "function getImplementation(string memory name) view returns (address)",
            "function owner() view returns (address)"
        ],
        BEACON_ADDRESS,
        deployer
    );

    // ==================== STEP 1: Deploy FlashLoanService ====================
    console.log("━".repeat(70));
    console.log("1️⃣  DEPLOY FLASHLOANSERVICE");
    console.log("━".repeat(70));

    const FlashLoanService = await ethers.getContractFactory("FlashLoanService", deployer);
    const flashLoanTx = await FlashLoanService.deploy(BEACON_ADDRESS);
    const flashLoanReceipt = await flashLoanTx.deploymentTransaction()!.wait();
    const flashLoanAddress = await flashLoanTx.getAddress();
    
    const flashLoanGas = flashLoanReceipt!.gasUsed;
    results.push({ step: "Deploy FlashLoanService", gasUsed: flashLoanGas });
    console.log(`   ✅ Deployed: ${flashLoanAddress}`);
    console.log(`   ⛽ Gas: ${flashLoanGas.toLocaleString()}`);

    // Register in Beacon
    const regFlashTx = await beacon.updateImplementation("FlashLoanService", flashLoanAddress);
    const regFlashReceipt = await regFlashTx.wait();
    
    results.push({ step: "Register FlashLoanService in Beacon", gasUsed: regFlashReceipt!.gasUsed });
    console.log(`   ✅ Registered in Beacon`);
    console.log(`   ⛽ Gas: ${regFlashReceipt!.gasUsed.toLocaleString()}\n`);

    // ==================== STEP 2: Deploy NEW EulerV2Plugin ====================
    console.log("━".repeat(70));
    console.log("2️⃣  DEPLOY NEW EULERV2PLUGIN (EVC Batch)");
    console.log("━".repeat(70));

    const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin", deployer);
    const pluginTx = await EulerV2Plugin.deploy(BEACON_ADDRESS, BASE_ASSET_CODE, ARBITRUM_ADDRESSES.EVC, ARBITRUM_ADDRESSES.ACCOUNT_LENS);
    const pluginReceipt = await pluginTx.deploymentTransaction()!.wait();
    const newPluginAddress = await pluginTx.getAddress();
    
    const pluginGas = pluginReceipt!.gasUsed;
    results.push({ step: "Deploy EulerV2Plugin (new)", gasUsed: pluginGas });

    const code = await ethers.provider.getCode(newPluginAddress);
    const sizeBytes = (code.length - 2) / 2;
    console.log(`   ✅ Deployed: ${newPluginAddress}`);
    console.log(`   📦 Bytecode: ${sizeBytes} bytes`);
    console.log(`   ⛽ Gas: ${pluginGas.toLocaleString()}`);

    // Update Beacon
    const regPluginTx = await beacon.updateImplementation("EulerV2Plugin", newPluginAddress);
    const regPluginReceipt = await regPluginTx.wait();
    
    results.push({ step: "Update EulerV2Plugin in Beacon", gasUsed: regPluginReceipt!.gasUsed });
    console.log(`   ✅ Beacon updated`);
    console.log(`   ⛽ Gas: ${regPluginReceipt!.gasUsed.toLocaleString()}`);

    // Transfer EulerRegistry ownership
    const registry = await ethers.getContractAt(
        ["function owner() view returns (address)", "function transferOwnership(address newOwner) external"],
        EULER_REGISTRY,
        deployer
    );
    
    const currentRegistryOwner = await registry.owner();
    console.log(`\n   EulerRegistry owner: ${currentRegistryOwner}`);
    
    if (currentRegistryOwner.toLowerCase() === beaconOwnerAddr.toLowerCase()) {
        const transferTx = await registry.transferOwnership(newPluginAddress);
        const transferReceipt = await transferTx.wait();
        results.push({ step: "Transfer EulerRegistry ownership", gasUsed: transferReceipt!.gasUsed });
        console.log(`   ✅ Ownership transferred to plugin`);
        console.log(`   ⛽ Gas: ${transferReceipt!.gasUsed.toLocaleString()}`);
    } else if (currentRegistryOwner.toLowerCase() === OLD_PLUGIN.toLowerCase()) {
        console.log(`   ⚠️  Registry owned by OLD plugin — skipping transfer in sim`);
        results.push({ step: "Transfer EulerRegistry ownership", gasUsed: 30000n });
    } else {
        console.log(`   ⚠️  Registry owned by ${currentRegistryOwner}`);
        results.push({ step: "Transfer EulerRegistry ownership (estimate)", gasUsed: 30000n });
    }

    // ==================== STEP 3: Test Plugin Operations ====================
    console.log("\n" + "━".repeat(70));
    console.log("3️⃣  TEST OPERAZIONI PLUGIN SU MAINNET");
    console.log("━".repeat(70));

    // Setup: get WETH for testing
    const WETH_WHALE = "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8";
    await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
    const whale = await ethers.getSigner(WETH_WHALE);
    
    const weth = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.WETH);
    const usdc = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.USDC);
    
    // Transfer WETH to plugin for testing
    const testAmount = ethers.parseEther("0.01"); // 0.01 WETH
    
    // Fund whale for gas
    await funder.sendTransaction({ to: WETH_WHALE, value: ethers.parseEther("0.1") });
    await weth.connect(whale).transfer(newPluginAddress, testAmount);

    // Get plugin contract
    const plugin = await ethers.getContractAt("EulerV2Plugin", newPluginAddress, deployer);

    // Test Deposit
    try {
        const depositTx = await plugin.deposit("WETH", testAmount);
        const depositReceipt = await depositTx.wait();
        results.push({ step: "🧪 Test: deposit(WETH, 0.01)", gasUsed: depositReceipt!.gasUsed });
        console.log(`   ✅ Deposit: ${depositReceipt!.gasUsed.toLocaleString()} gas`);
    } catch (e: any) {
        console.log(`   ❌ Deposit failed: ${e.message?.substring(0, 100)}`);
        results.push({ step: "🧪 Test: deposit (FAILED)", gasUsed: 0n });
    }

    // Test Borrow (small USDC)
    try {
        const borrowAmount = 1000000n; // 1 USDC
        const borrowTx = await plugin.borrow("USDC", borrowAmount);
        const borrowReceipt = await borrowTx.wait();
        results.push({ step: "🧪 Test: borrow(USDC, 1)", gasUsed: borrowReceipt!.gasUsed });
        console.log(`   ✅ Borrow: ${borrowReceipt!.gasUsed.toLocaleString()} gas`);
    } catch (e: any) {
        console.log(`   ❌ Borrow failed: ${e.message?.substring(0, 100)}`);
        results.push({ step: "🧪 Test: borrow (FAILED)", gasUsed: 0n });
    }

    // Test Repay
    try {
        // Get USDC to repay - need to fund plugin
        const USDC_WHALE = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";
        await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
        const usdcWhale = await ethers.getSigner(USDC_WHALE);
        await funder.sendTransaction({ to: USDC_WHALE, value: ethers.parseEther("0.01") });
        await usdc.connect(usdcWhale).transfer(newPluginAddress, 2000000n); // 2 USDC
        
        const repayTx = await plugin.repay("USDC", ethers.MaxUint256);
        const repayReceipt = await repayTx.wait();
        results.push({ step: "🧪 Test: repay(USDC, max)", gasUsed: repayReceipt!.gasUsed });
        console.log(`   ✅ Repay: ${repayReceipt!.gasUsed.toLocaleString()} gas`);
    } catch (e: any) {
        console.log(`   ❌ Repay failed: ${e.message?.substring(0, 100)}`);
        results.push({ step: "🧪 Test: repay (FAILED)", gasUsed: 0n });
    }

    // Test ClosePosition
    try {
        const closeTx = await plugin["closePosition(string,string)"]("WETH", "USDC");
        const closeReceipt = await closeTx.wait();
        results.push({ step: "🧪 Test: closePosition(WETH,USDC)", gasUsed: closeReceipt!.gasUsed });
        console.log(`   ✅ ClosePosition: ${closeReceipt!.gasUsed.toLocaleString()} gas`);
    } catch (e: any) {
        console.log(`   ❌ ClosePosition failed: ${e.message?.substring(0, 100)}`);
        results.push({ step: "🧪 Test: closePosition (FAILED)", gasUsed: 0n });
    }

    // Test Leverage (deposit first, then leverage)
    try {
        // Re-deposit for leverage test
        await weth.connect(whale).transfer(newPluginAddress, ethers.parseEther("0.05"));
        const depositTx2 = await plugin.deposit("WETH", ethers.parseEther("0.05"));
        await depositTx2.wait();

        const leverageTx = await plugin.openLeverageAtomic(
            "WETH", "USDC", 
            ethers.parseEther("0.05"), // flash borrow amount
            20000n, // 2x target leverage
            100n    // 1% slippage
        );
        const leverageReceipt = await leverageTx.wait();
        results.push({ step: "🧪 Test: openLeverageAtomic(2x)", gasUsed: leverageReceipt!.gasUsed });
        console.log(`   ✅ OpenLeverage: ${leverageReceipt!.gasUsed.toLocaleString()} gas`);

        // Close leverage
        const closeLevTx = await plugin.closeLeverageAtomic("WETH", "USDC", 100n);
        const closeLevReceipt = await closeLevTx.wait();
        results.push({ step: "🧪 Test: closeLeverageAtomic", gasUsed: closeLevReceipt!.gasUsed });
        console.log(`   ✅ CloseLeverage: ${closeLevReceipt!.gasUsed.toLocaleString()} gas`);
    } catch (e: any) {
        console.log(`   ❌ Leverage test failed: ${e.message?.substring(0, 200)}`);
        results.push({ step: "🧪 Test: leverage (FAILED)", gasUsed: 0n });
    }

    // ==================== COST ANALYSIS ====================
    console.log("\n" + "=".repeat(70));
    console.log("💰 ANALISI COSTI COMPLETA");
    console.log("=".repeat(70));

    // Get current gas price from fork
    const feeData = await ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits("0.1", "gwei"); // Arbitrum typical
    const ethPrice = 1800; // Conservative ETH price estimate
    
    console.log(`\n📊 Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
    console.log(`📊 ETH Price: ~$${ethPrice}\n`);

    let totalDeployGas = 0n;
    let totalTestGas = 0n;

    console.log("┌─────────────────────────────────────────────┬──────────────┬──────────────┐");
    console.log("│ Step                                        │ Gas Used     │ Cost (ETH)   │");
    console.log("├─────────────────────────────────────────────┼──────────────┼──────────────┤");

    for (const r of results) {
        const costWei = r.gasUsed * gasPrice;
        const costEth = Number(ethers.formatEther(costWei));
        const costUsd = costEth * ethPrice;
        const isTest = r.step.startsWith("🧪");
        
        if (isTest) {
            totalTestGas += r.gasUsed;
        } else {
            totalDeployGas += r.gasUsed;
        }

        const stepName = r.step.padEnd(43);
        const gasStr = r.gasUsed.toLocaleString().padStart(12);
        const costStr = costEth.toFixed(6).padStart(12);
        console.log(`│ ${stepName} │ ${gasStr} │ ${costStr} │`);
    }

    console.log("├─────────────────────────────────────────────┼──────────────┼──────────────┤");
    
    const deployWei = totalDeployGas * gasPrice;
    const deployCostEth = Number(ethers.formatEther(deployWei));
    const deployCostUsd = deployCostEth * ethPrice;
    console.log(`│ 📦 TOTALE DEPLOY                            │ ${totalDeployGas.toLocaleString().padStart(12)} │ ${deployCostEth.toFixed(6).padStart(12)} │`);
    
    const testWei = totalTestGas * gasPrice;
    const testCostEth = Number(ethers.formatEther(testWei));
    const testCostUsd = testCostEth * ethPrice;
    console.log(`│ 🧪 TOTALE TEST                              │ ${totalTestGas.toLocaleString().padStart(12)} │ ${testCostEth.toFixed(6).padStart(12)} │`);
    
    const totalGas = totalDeployGas + totalTestGas;
    const totalWei = totalGas * gasPrice;
    const totalCostEth = Number(ethers.formatEther(totalWei));
    const totalCostUsd = totalCostEth * ethPrice;
    console.log(`│ 💰 TOTALE ASSOLUTO                          │ ${totalGas.toLocaleString().padStart(12)} │ ${totalCostEth.toFixed(6).padStart(12)} │`);
    
    console.log("└─────────────────────────────────────────────┴──────────────┴──────────────┘");

    console.log(`\n💵 Stima Costi in USD (ETH @ $${ethPrice}):`);
    console.log(`   Deploy infrastruttura: ~$${deployCostUsd.toFixed(4)}`);
    console.log(`   Test operazioni:       ~$${testCostUsd.toFixed(4)}`);
    console.log(`   TOTALE:                ~$${totalCostUsd.toFixed(4)}`);
    
    console.log(`\n💡 Note:`);
    console.log(`   • Arbitrum L2 = gas molto economico vs Ethereum L1`);
    console.log(`   • Gas price attuale su Arbitrum: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
    console.log(`   • Il costo reale potrebbe variare ±30% in base al traffico di rete`);
    console.log(`   • ETH $${ethPrice} è una stima conservativa`);
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Simulazione fallita:");
        console.error(error);
        process.exit(1);
    });
