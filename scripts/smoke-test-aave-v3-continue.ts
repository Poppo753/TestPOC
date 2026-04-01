/**
 * @file smoke-test-aave-v3-continue.ts
 * @description Continua lo smoke test dal STEP 5 (repay)
 *   Deposit e Borrow già eseguiti con successo.
 *   Plugin ha 0.001 WETH collateral, ~0.50 USDC debito
 *   ProxyGeneral ha 0.50 USDC
 */
import { ethers } from "hardhat";

const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const PROTOCOL_NAME = "AaveV3Plugin";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("\n🧪 SMOKE TEST AAVE V3 — CONTINUA DAL STEP 5");
    console.log(`   Deployer: ${deployer.address}`);

    const weth = await ethers.getContractAt("IERC20", WETH);
    const usdc = await ethers.getContractAt("IERC20", USDC);

    const pm = await ethers.getContractAt(
        [
            "function deposit(string memory, string memory, uint256) external",
            "function withdraw(string memory, string memory, uint256) external",
            "function borrow(string memory, string memory, uint256) external",
            "function repay(string memory, string memory, uint256) external",
            "function getBalance(string memory, string memory) view returns (uint256)",
            "function getDebt(string memory, string memory) view returns (uint256)",
            "function getHealthFactor(string memory) view returns (uint256)",
        ],
        PROTOCOL_MANAGER
    );

    // === STATUS CORRENTE ===
    console.log("\n=== STATUS CORRENTE ===");
    const proxyWeth = await weth.balanceOf(PROXY_GENERAL);
    const proxyUsdc = await usdc.balanceOf(PROXY_GENERAL);
    const pluginBalance = await pm.getBalance(PROTOCOL_NAME, "WETH");
    const pluginDebt = await pm.getDebt(PROTOCOL_NAME, "USDC");
    const hf = await pm.getHealthFactor(PROTOCOL_NAME);

    console.log(`   ProxyGeneral WETH:   ${ethers.formatEther(proxyWeth)}`);
    console.log(`   ProxyGeneral USDC:   ${ethers.formatUnits(proxyUsdc, 6)}`);
    console.log(`   Plugin WETH balance: ${ethers.formatEther(pluginBalance)}`);
    console.log(`   Plugin USDC debt:    ${ethers.formatUnits(pluginDebt, 6)}`);
    console.log(`   Health Factor:       ${hf === ethers.MaxUint256 ? "MAX" : ethers.formatEther(hf)}`);

    const preProxyWeth = proxyWeth;

    // ===============================================================
    // STEP 5 — REPAY USDC (tutto ciò che ProxyGeneral possiede)
    // ===============================================================
    console.log("\n=== STEP 5: REPAY USDC ===");
    const repayAmount = proxyUsdc < pluginDebt ? proxyUsdc : pluginDebt;
    console.log(`   Ripago: ${ethers.formatUnits(repayAmount, 6)} USDC`);

    const txRepay = await pm.repay(PROTOCOL_NAME, "USDC", repayAmount);
    const receiptRepay = await txRepay.wait();
    console.log(`   ✅ Repay tx: ${txRepay.hash} (gas: ${receiptRepay!.gasUsed})`);

    const postRepayDebt = await pm.getDebt(PROTOCOL_NAME, "USDC");
    const postRepayHF = await pm.getHealthFactor(PROTOCOL_NAME);
    console.log(`   USDC debt residuo: ${ethers.formatUnits(postRepayDebt, 6)} USDC`);
    console.log(`   Health Factor:     ${postRepayHF === ethers.MaxUint256 ? "MAX" : ethers.formatEther(postRepayHF)}`);

    if (postRepayDebt <= 10_000n) {
        console.log("   ✅ Debito essenzialmente ripagato (dust ≤ 0.01 USDC)");
    } else {
        console.log(`   ⚠️  Debito residuo: ${ethers.formatUnits(postRepayDebt, 6)} USDC`);
    }

    // ===============================================================
    // STEP 6 — WITHDRAW WETH
    // ===============================================================
    console.log("\n=== STEP 6: WITHDRAW WETH ===");
    const currentBalance = await pm.getBalance(PROTOCOL_NAME, "WETH");
    const debtAfterRepay = await pm.getDebt(PROTOCOL_NAME, "USDC");

    let withdrawAmount: bigint;
    if (debtAfterRepay > 0n) {
        // Con dust debt, prelevo il 99% per non azzerare il HF
        withdrawAmount = currentBalance * 99n / 100n;
        console.log(`   ⚠️  Dust debt presente, prelevo 99%`);
    } else {
        withdrawAmount = currentBalance;
    }
    console.log(`   Balance:  ${ethers.formatEther(currentBalance)} WETH`);
    console.log(`   Prelevo:  ${ethers.formatEther(withdrawAmount)} WETH`);

    const txWithdraw = await pm.withdraw(PROTOCOL_NAME, "WETH", withdrawAmount);
    const receiptWithdraw = await txWithdraw.wait();
    console.log(`   ✅ Withdraw tx: ${txWithdraw.hash} (gas: ${receiptWithdraw!.gasUsed})`);

    // ===============================================================
    // VERIFICA FINALE
    // ===============================================================
    console.log("\n=== VERIFICA FINALE ===");
    const finalBalance = await pm.getBalance(PROTOCOL_NAME, "WETH");
    const finalDebt = await pm.getDebt(PROTOCOL_NAME, "USDC");
    const finalHF = await pm.getHealthFactor(PROTOCOL_NAME);
    const finalProxyWeth = await weth.balanceOf(PROXY_GENERAL);
    const finalProxyUsdc = await usdc.balanceOf(PROXY_GENERAL);

    console.log(`   Plugin WETH:       ${ethers.formatEther(finalBalance)}`);
    console.log(`   Plugin USDC debt:  ${ethers.formatUnits(finalDebt, 6)}`);
    console.log(`   Health Factor:     ${finalHF === ethers.MaxUint256 ? "MAX" : ethers.formatEther(finalHF)}`);
    console.log(`   ProxyGeneral WETH: ${ethers.formatEther(finalProxyWeth)}`);
    console.log(`   ProxyGeneral USDC: ${ethers.formatUnits(finalProxyUsdc, 6)}`);

    const wethDiff = finalProxyWeth - preProxyWeth;

    // ===============================================================
    // RIEPILOGO
    // ===============================================================
    console.log("\n" + "=".repeat(55));
    console.log("📊 SMOKE TEST RIEPILOGO COMPLETO");
    console.log("=".repeat(55));
    console.log("   Operazioni completate su mainnet:");
    console.log("   ✅ STEP 1: registerProtocol in ProtocolManager");
    console.log("   ✅ STEP 3: Deposit 0.001 WETH in Aave V3");
    console.log("   ✅ STEP 4: Borrow 0.50 USDC da Aave V3");
    console.log(`   ✅ STEP 5: Repay ${ethers.formatUnits(repayAmount, 6)} USDC`);
    console.log(`   ✅ STEP 6: Withdraw ${ethers.formatEther(withdrawAmount)} WETH`);
    console.log(`   ---`);
    console.log(`   Gas: repay=${receiptRepay!.gasUsed} withdraw=${receiptWithdraw!.gasUsed}`);
    console.log(`   WETH recuperato: +${ethers.formatEther(wethDiff)} WETH`);
    if (finalDebt > 0n) {
        console.log(`   Dust debt residuo: ${ethers.formatUnits(finalDebt, 6)} USDC (interessi)`);
        console.log(`   Dust collateral:   ${ethers.formatEther(finalBalance)} WETH (a copertura)`);
    }
    console.log("=".repeat(55));
    console.log("   🎉 TUTTI I 4 FLUSSI PRINCIPALI VERIFICATI SU MAINNET:");
    console.log("      deposit ✅  borrow ✅  repay ✅  withdraw ✅");
    console.log("=".repeat(55));
}

main().catch((e) => { console.error(e); process.exit(1); });
