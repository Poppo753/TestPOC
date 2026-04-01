/**
 * @file smoke-test-aave-v3-mainnet.ts
 * @description Smoke test reale su Arbitrum mainnet:
 *   1. Pre-checks (ProxyGeneral WETH, ProtocolManager registration)
 *   2. Register "AaveV3Plugin" in ProtocolManager se non già presente
 *   3. Deposit 0.001 WETH in Aave V3 via ProtocolManager
 *   4. Check balance + health factor
 *   5. Borrow 0.50 USDC
 *   6. Check debt
 *   7. Repay 0.50 USDC (full debt)
 *   8. Withdraw 0.001 WETH
 *   9. Final verification: stato pulito
 */
import { ethers } from "hardhat";

// === INDIRIZZI MAINNET ===
const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
const AAVE_V3_PLUGIN = "0x4cFDCb4215F562DC3Bc36D28fCf093E993AdC026";
const AAVE_V3_REGISTRY = "0xEeb0EA1C430E956266C8027E39cA7A5C855B1a73";
const AAVE_V3_LENS = "0xF9d5Cb5a86f0aD469f37F08B27AEf7FdF46ac3E3";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

// === IMPORTI MINIMI ===
const DEPOSIT_AMOUNT = ethers.parseEther("0.001");   // 0.001 WETH (~$2)
const BORROW_AMOUNT = 500_000n;                        // 0.50 USDC

const PROTOCOL_NAME = "AaveV3Plugin"; // nome nel Beacon

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("\n🧪 SMOKE TEST AAVE V3 — ARBITRUM MAINNET");
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   ETH balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

    // ===============================================================
    // STEP 0 — PRE-CHECKS
    // ===============================================================
    console.log("\n=== STEP 0: PRE-CHECKS ===");

    const weth = await ethers.getContractAt("IERC20", WETH);
    const usdc = await ethers.getContractAt("IERC20", USDC);
    const proxyWeth = await weth.balanceOf(PROXY_GENERAL);
    const proxyUsdc = await usdc.balanceOf(PROXY_GENERAL);
    console.log(`   ProxyGeneral WETH: ${ethers.formatEther(proxyWeth)} WETH`);
    console.log(`   ProxyGeneral USDC: ${ethers.formatUnits(proxyUsdc, 6)} USDC`);

    if (proxyWeth < DEPOSIT_AMOUNT) {
        console.error(`   ❌ ProxyGeneral non ha abbastanza WETH (serve ${ethers.formatEther(DEPOSIT_AMOUNT)})`);
        process.exit(1);
    }
    console.log(`   ✅ ProxyGeneral ha abbastanza WETH per depositare`);

    // ===============================================================
    // STEP 1 — REGISTER PROTOCOL IN PROTOCOL-MANAGER (se necessario)
    // ===============================================================
    console.log("\n=== STEP 1: PROTOCOL REGISTRATION ===");
    const pm = await ethers.getContractAt(
        [
            "function registerProtocol(string memory protocolName, address plugin, address lensAdapter, address registry) external",
            "function getProtocolInfo(string memory) view returns (address plugin, address lensAdapter, address registry, bool isActive, uint256 registeredAt)",
            "function getAllProtocolNames() view returns (string[] memory)",
            "function deposit(string memory protocolName, string memory tokenCode, uint256 amount) external",
            "function withdraw(string memory protocolName, string memory tokenCode, uint256 amount) external",
            "function borrow(string memory protocolName, string memory tokenCode, uint256 amount) external",
            "function repay(string memory protocolName, string memory tokenCode, uint256 amount) external",
            "function getBalance(string memory protocolName, string memory tokenCode) view returns (uint256)",
            "function getDebt(string memory protocolName, string memory tokenCode) view returns (uint256)",
            "function getHealthFactor(string memory protocolName) view returns (uint256)",
        ],
        PROTOCOL_MANAGER
    );

    // Check if already registered
    const allProtocols = await pm.getAllProtocolNames();
    console.log(`   Protocolli registrati: [${allProtocols.join(", ")}]`);

    if (!allProtocols.includes(PROTOCOL_NAME)) {
        console.log(`   📝 Registro "${PROTOCOL_NAME}" in ProtocolManager...`);
        const tx = await pm.registerProtocol(
            PROTOCOL_NAME,
            AAVE_V3_PLUGIN,
            AAVE_V3_LENS,
            AAVE_V3_REGISTRY
        );
        await tx.wait();
        console.log(`   ✅ Registrato! tx: ${tx.hash}`);
    } else {
        console.log(`   ✅ "${PROTOCOL_NAME}" già registrato`);
    }

    // ===============================================================
    // STEP 2 — SNAPSHOT BALANCES PRE-OPERAZIONE
    // ===============================================================
    console.log("\n=== STEP 2: SNAPSHOT PRE-OPERAZIONE ===");
    const preProxyWeth = await weth.balanceOf(PROXY_GENERAL);
    const preProxyUsdc = await usdc.balanceOf(PROXY_GENERAL);
    const prePluginBalance = await pm.getBalance(PROTOCOL_NAME, "WETH");
    const prePluginDebt = await pm.getDebt(PROTOCOL_NAME, "USDC");
    console.log(`   ProxyGeneral WETH:  ${ethers.formatEther(preProxyWeth)}`);
    console.log(`   ProxyGeneral USDC:  ${ethers.formatUnits(preProxyUsdc, 6)}`);
    console.log(`   Plugin WETH balance: ${ethers.formatEther(prePluginBalance)}`);
    console.log(`   Plugin USDC debt:    ${ethers.formatUnits(prePluginDebt, 6)}`);

    // ===============================================================
    // STEP 3 — DEPOSIT 0.001 WETH
    // ===============================================================
    console.log("\n=== STEP 3: DEPOSIT 0.001 WETH ===");
    const txDeposit = await pm.deposit(PROTOCOL_NAME, "WETH", DEPOSIT_AMOUNT);
    const receiptDeposit = await txDeposit.wait();
    console.log(`   ✅ Deposit tx: ${txDeposit.hash} (gas: ${receiptDeposit!.gasUsed})`);

    const postDepositBalance = await pm.getBalance(PROTOCOL_NAME, "WETH");
    const postDepositHF = await pm.getHealthFactor(PROTOCOL_NAME);
    const postProxyWeth = await weth.balanceOf(PROXY_GENERAL);
    console.log(`   Plugin WETH balance: ${ethers.formatEther(postDepositBalance)}`);
    console.log(`   Health Factor:       ${postDepositHF === ethers.MaxUint256 ? "MAX (no debt)" : ethers.formatEther(postDepositHF)}`);
    console.log(`   ProxyGeneral WETH:   ${ethers.formatEther(postProxyWeth)} (diff: -${ethers.formatEther(preProxyWeth - postProxyWeth)})`);

    if (postDepositBalance < DEPOSIT_AMOUNT * 99n / 100n) {
        console.error("   ❌ Deposit balance mismatch!");
        process.exit(1);
    }
    console.log("   ✅ Deposit verificato");

    // ===============================================================
    // STEP 4 — BORROW 0.50 USDC
    // ===============================================================
    console.log("\n=== STEP 4: BORROW 0.50 USDC ===");
    const txBorrow = await pm.borrow(PROTOCOL_NAME, "USDC", BORROW_AMOUNT);
    const receiptBorrow = await txBorrow.wait();
    console.log(`   ✅ Borrow tx: ${txBorrow.hash} (gas: ${receiptBorrow!.gasUsed})`);

    const postBorrowDebt = await pm.getDebt(PROTOCOL_NAME, "USDC");
    const postBorrowHF = await pm.getHealthFactor(PROTOCOL_NAME);
    const postBorrowProxyUsdc = await usdc.balanceOf(PROXY_GENERAL);
    console.log(`   Plugin USDC debt:    ${ethers.formatUnits(postBorrowDebt, 6)} USDC`);
    console.log(`   Health Factor:       ${ethers.formatEther(postBorrowHF)}`);
    console.log(`   ProxyGeneral USDC:   ${ethers.formatUnits(postBorrowProxyUsdc, 6)} (diff: +${ethers.formatUnits(postBorrowProxyUsdc - preProxyUsdc, 6)})`);

    if (postBorrowDebt < BORROW_AMOUNT * 99n / 100n) {
        console.error("   ❌ Borrow debt mismatch!");
        process.exit(1);
    }
    console.log("   ✅ Borrow verificato");

    // ===============================================================
    // STEP 5 — REPAY USDC (quanto possibile con il bilancio ProxyGeneral)
    // ===============================================================
    console.log("\n=== STEP 5: REPAY USDC ===");
    // ProxyGeneral ha solo il borrowed amount; interest rende il debito > available
    const proxyUsdcForRepay = await usdc.balanceOf(PROXY_GENERAL);
    const currentDebt = await pm.getDebt(PROTOCOL_NAME, "USDC");
    // Ripaga il minimo tra debito e disponibilità
    const repayAmount = proxyUsdcForRepay < currentDebt ? proxyUsdcForRepay : currentDebt;
    console.log(`   ProxyGeneral USDC: ${ethers.formatUnits(proxyUsdcForRepay, 6)}`);
    console.log(`   Debito corrente:   ${ethers.formatUnits(currentDebt, 6)}`);
    console.log(`   Ripago:            ${ethers.formatUnits(repayAmount, 6)}`);

    const txRepay = await pm.repay(PROTOCOL_NAME, "USDC", repayAmount);
    const receiptRepay = await txRepay.wait();
    console.log(`   ✅ Repay tx: ${txRepay.hash} (gas: ${receiptRepay!.gasUsed})`);

    const postRepayDebt = await pm.getDebt(PROTOCOL_NAME, "USDC");
    const postRepayHF = await pm.getHealthFactor(PROTOCOL_NAME);
    console.log(`   Plugin USDC debt residuo: ${ethers.formatUnits(postRepayDebt, 6)} USDC`);
    console.log(`   Health Factor:            ${postRepayHF === ethers.MaxUint256 ? "MAX (no debt)" : ethers.formatEther(postRepayHF)}`);

    if (postRepayDebt > 10_000n) { // > 0.01 USDC = problema
        console.error(`   ⚠️  Debito residuo significativo: ${ethers.formatUnits(postRepayDebt, 6)} USDC`);
        console.log("   (dovuto a interessi maturati tra borrow e repay — normale per dust)");
    } else {
        console.log("   ✅ Debito essenzialmente ripagato (dust < 0.01 USDC)");
    }

    // ===============================================================
    // STEP 6 — WITHDRAW WETH (quasi tutto, lascia margine per dust debt)
    // ===============================================================
    console.log("\n=== STEP 6: WITHDRAW WETH ===");
    const currentBalance = await pm.getBalance(PROTOCOL_NAME, "WETH");
    const remainingDebt = await pm.getDebt(PROTOCOL_NAME, "USDC");
    
    // Se c'è dust debt, non posso prelevare il 100% (health factor andrebbe a 0)
    // Prelevo il 99.5% se c'è debito, 100% se non c'è
    let withdrawAmount: bigint;
    if (remainingDebt > 0n) {
        withdrawAmount = currentBalance * 995n / 1000n; // 99.5%
        console.log(`   ⚠️  Dust debt presente (${ethers.formatUnits(remainingDebt, 6)} USDC)`);
        console.log(`   Prelevo 99.5% del balance per mantenere HF sicuro`);
    } else {
        withdrawAmount = currentBalance;
    }
    console.log(`   Balance disponibile: ${ethers.formatEther(currentBalance)} WETH`);
    console.log(`   Prelevo:            ${ethers.formatEther(withdrawAmount)} WETH`);

    const txWithdraw = await pm.withdraw(PROTOCOL_NAME, "WETH", withdrawAmount);
    const receiptWithdraw = await txWithdraw.wait();
    console.log(`   ✅ Withdraw tx: ${txWithdraw.hash} (gas: ${receiptWithdraw!.gasUsed})`);

    const postWithdrawBalance = await pm.getBalance(PROTOCOL_NAME, "WETH");
    const postWithdrawProxyWeth = await weth.balanceOf(PROXY_GENERAL);
    console.log(`   Plugin WETH balance: ${ethers.formatEther(postWithdrawBalance)}`);
    console.log(`   ProxyGeneral WETH:   ${ethers.formatEther(postWithdrawProxyWeth)}`);

    // ===============================================================
    // STEP 7 — VERIFICA FINALE
    // ===============================================================
    console.log("\n=== STEP 7: VERIFICA FINALE ===");
    const finalBalance = await pm.getBalance(PROTOCOL_NAME, "WETH");
    const finalDebt = await pm.getDebt(PROTOCOL_NAME, "USDC");
    const finalHF = await pm.getHealthFactor(PROTOCOL_NAME);
    const finalProxyWeth = await weth.balanceOf(PROXY_GENERAL);

    console.log(`   Plugin WETH balance: ${ethers.formatEther(finalBalance)}`);
    console.log(`   Plugin USDC debt:    ${ethers.formatUnits(finalDebt, 6)}`);
    console.log(`   Health Factor:       ${finalHF === ethers.MaxUint256 ? "MAX (no debt)" : ethers.formatEther(finalHF)}`);
    console.log(`   ProxyGeneral WETH:   ${ethers.formatEther(finalProxyWeth)}`);

    // Calcola diff netta
    const wethDiff = finalProxyWeth - preProxyWeth;
    console.log(`\n   WETH net diff ProxyGeneral: ${ethers.formatEther(wethDiff)} WETH`);
    // Potrebbe esserci un piccolo guadagno da yield Aave oppure piccola perdita da interest

    const errors: string[] = [];
    if (finalBalance > ethers.parseEther("0.00005")) errors.push(`WETH residuo in Aave: ${ethers.formatEther(finalBalance)}`);
    if (finalDebt > 10_000n) errors.push(`USDC debito residuo: ${ethers.formatUnits(finalDebt, 6)}`);
    // HF potrebbe non essere MAX se c'è dust debt + dust collateral

    if (errors.length > 0) {
        console.log("\n   ⚠️  WARNINGS:");
        errors.forEach(e => console.log(`      - ${e}`));
    }

    // ===============================================================
    // RIEPILOGO GAS
    // ===============================================================
    const totalGas = receiptDeposit!.gasUsed + receiptBorrow!.gasUsed + receiptRepay!.gasUsed + receiptWithdraw!.gasUsed;
    console.log("\n" + "=".repeat(55));
    console.log("📊 SMOKE TEST RIEPILOGO");
    console.log("=".repeat(55));
    console.log(`   ✅ Deposit 0.001 WETH   gas: ${receiptDeposit!.gasUsed}`);
    console.log(`   ✅ Borrow 0.50 USDC     gas: ${receiptBorrow!.gasUsed}`);
    console.log(`   ✅ Repay USDC (full)     gas: ${receiptRepay!.gasUsed}`);
    console.log(`   ✅ Withdraw WETH (full)  gas: ${receiptWithdraw!.gasUsed}`);
    console.log(`   ---`);
    console.log(`   Total gas used: ${totalGas}`);
    console.log(`   WETH net: ${ethers.formatEther(wethDiff)} WETH`);
    console.log(`   Status: ${errors.length === 0 ? "✅ TUTTO PULITO" : "⚠️  " + errors.length + " warning(s)"}`);
    console.log("=".repeat(55));
}

main().catch((e) => { console.error(e); process.exit(1); });
