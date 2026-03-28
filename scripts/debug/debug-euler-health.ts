/**
 * Script di debug per verificare l'Health Factor su Euler V2
 * 
 * Questo script simula esattamente ciò che fa il test per capire
 * perché getHealthFactor ritorna MAX anche con debito attivo.
 */

import { ethers } from "hardhat";

// Indirizzi Arbitrum
const EVC_ADDRESS = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
const ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
const WETH_VAULT = "0x78E3E051D32157AACD550fBB78458762d8f7edFF";
const USDC_VAULT = "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const WETH_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

// ABIs minimali
const EVC_ABI = [
    "function enableCollateral(address account, address vault) external",
    "function enableController(address account, address vault) external",
    "function isCollateralEnabled(address account, address vault) external view returns (bool)",
    "function isControllerEnabled(address account, address vault) external view returns (bool)",
    "function getCollaterals(address account) external view returns (address[] memory)",
    "function getControllers(address account) external view returns (address[] memory)"
];

const VAULT_ABI = [
    "function deposit(uint256 assets, address receiver) external returns (uint256)",
    "function borrow(uint256 assets, address receiver) external returns (uint256)",
    "function debtOf(address account) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function asset() external view returns (address)",
    "function convertToAssets(uint256 shares) external view returns (uint256)"
];

const ERC20_ABI = [
    "function balanceOf(address) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function transfer(address to, uint256 amount) external returns (bool)"
];

// Proviamo diverse varianti di ABI per AccountLens
const ACCOUNT_LENS_ABI_V1 = [
    `function getAccountLiquidityInfo(address account, address vault) external view returns (tuple(
        bool queryFailure,
        bytes queryFailureReason,
        address account,
        address vault,
        address unitOfAccount,
        int256 timeToLiquidation,
        uint256 liabilityValueBorrowing,
        uint256 liabilityValueLiquidation,
        uint256 collateralValueBorrowing,
        uint256 collateralValueLiquidation,
        uint256 collateralValueRaw,
        address[] collaterals,
        uint256[] collateralValuesBorrowing,
        uint256[] collateralValuesLiquidation,
        uint256[] collateralValuesRaw
    ))`,
    "function getTimeToLiquidation(address account, address vault) external view returns (int256)"
];

const ACCOUNT_LENS_ABI_V2 = [
    "function getAccountLiquidityInfo(address account, address[] calldata collaterals, address liabilityVault) external view returns (tuple(int256 timeToLiquidation, uint256 liabilityValue, uint256 collateralValueBorrowing, uint256 collateralValueLiquidation, uint256 collateralValueRaw))"
];

async function main() {
    console.log("\n🔍 DEBUG EULER V2 HEALTH FACTOR\n");
    console.log("=".repeat(60));
    
    const [owner] = await ethers.getSigners();
    console.log(`Owner: ${owner.address}`);
    
    // Impersona whale
    await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
    const whale = await ethers.getSigner(WETH_WHALE);
    await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
    
    // Contratti
    const evc = new ethers.Contract(EVC_ADDRESS, EVC_ABI, owner);
    const wethVault = new ethers.Contract(WETH_VAULT, VAULT_ABI, owner);
    const usdcVault = new ethers.Contract(USDC_VAULT, VAULT_ABI, owner);
    const weth = new ethers.Contract(WETH, ERC20_ABI, whale);
    const usdc = new ethers.Contract(USDC, ERC20_ABI, owner);
    
    console.log("\n📊 Step 1: Check initial state");
    console.log("-".repeat(40));
    
    // Il nostro "account" per test sarà owner
    const testAccount = owner.address;
    
    console.log(`Test account: ${testAccount}`);
    console.log(`WETH vault: ${WETH_VAULT}`);
    console.log(`USDC vault: ${USDC_VAULT}`);
    
    // Check collaterals e controllers iniziali
    const collateralsBefore = await evc.getCollaterals(testAccount);
    const controllersBefore = await evc.getControllers(testAccount);
    console.log(`\nCollaterals before: ${collateralsBefore.length}`);
    console.log(`Controllers before: ${controllersBefore.length}`);
    
    console.log("\n📊 Step 2: Enable collateral and controller");
    console.log("-".repeat(40));
    
    // Abilita WETH come collaterale
    await evc.enableCollateral(testAccount, WETH_VAULT);
    console.log("✅ WETH vault enabled as collateral");
    
    // Abilita USDC vault come controller
    await evc.enableController(testAccount, USDC_VAULT);
    console.log("✅ USDC vault enabled as controller");
    
    // Verifica
    const isCollateral = await evc.isCollateralEnabled(testAccount, WETH_VAULT);
    const isController = await evc.isControllerEnabled(testAccount, USDC_VAULT);
    console.log(`\nWETH is collateral: ${isCollateral}`);
    console.log(`USDC is controller: ${isController}`);
    
    const collateralsAfter = await evc.getCollaterals(testAccount);
    const controllersAfter = await evc.getControllers(testAccount);
    console.log(`Collaterals after: ${collateralsAfter.length} -> ${collateralsAfter}`);
    console.log(`Controllers after: ${controllersAfter.length} -> ${controllersAfter}`);
    
    console.log("\n📊 Step 3: Deposit WETH as collateral");
    console.log("-".repeat(40));
    
    // Trasferisci WETH dalla whale a owner
    const depositAmount = ethers.parseEther("0.1");
    await weth.transfer(testAccount, depositAmount);
    console.log(`Transferred ${ethers.formatEther(depositAmount)} WETH to test account`);
    
    // Approva e deposita
    const wethAsOwner = new ethers.Contract(WETH, ERC20_ABI, owner);
    await wethAsOwner.approve(WETH_VAULT, depositAmount);
    await wethVault.deposit(depositAmount, testAccount);
    console.log(`Deposited ${ethers.formatEther(depositAmount)} WETH into vault`);
    
    // Check balance in vault
    const shares = await wethVault.balanceOf(testAccount);
    const assets = await wethVault.convertToAssets(shares);
    console.log(`Vault shares: ${shares}`);
    console.log(`Vault assets: ${ethers.formatEther(assets)} WETH`);
    
    console.log("\n📊 Step 4: Borrow USDC");
    console.log("-".repeat(40));
    
    const borrowAmount = ethers.parseUnits("10", 6); // 10 USDC
    
    // Check debt before
    const debtBefore = await usdcVault.debtOf(testAccount);
    console.log(`Debt before: ${ethers.formatUnits(debtBefore, 6)} USDC`);
    
    try {
        await usdcVault.borrow(borrowAmount, testAccount);
        console.log(`✅ Borrowed ${ethers.formatUnits(borrowAmount, 6)} USDC`);
    } catch (e: any) {
        console.log(`❌ Borrow failed: ${e.message}`);
        return;
    }
    
    // Check debt after
    const debtAfter = await usdcVault.debtOf(testAccount);
    console.log(`Debt after: ${ethers.formatUnits(debtAfter, 6)} USDC`);
    
    console.log("\n📊 Step 5: Try to get health factor via AccountLens");
    console.log("-".repeat(40));
    
    // Prova con la versione 1 dell'ABI (corretta)
    console.log("\n🔸 Trying CORRECTED ABI (with all fields)...");
    try {
        const lens1 = new ethers.Contract(ACCOUNT_LENS, ACCOUNT_LENS_ABI_V1, owner);
        const liquidity = await lens1.getAccountLiquidityInfo(testAccount, USDC_VAULT);
        console.log("✅ Corrected ABI works!");
        console.log(`   queryFailure: ${liquidity.queryFailure}`);
        console.log(`   account: ${liquidity.account}`);
        console.log(`   vault: ${liquidity.vault}`);
        console.log(`   timeToLiquidation: ${liquidity.timeToLiquidation}`);
        console.log(`   liabilityValueBorrowing: ${liquidity.liabilityValueBorrowing}`);
        console.log(`   liabilityValueLiquidation: ${liquidity.liabilityValueLiquidation}`);
        console.log(`   collateralValueBorrowing: ${liquidity.collateralValueBorrowing}`);
        console.log(`   collateralValueLiquidation: ${liquidity.collateralValueLiquidation}`);
        console.log(`   collaterals: ${liquidity.collaterals}`);
        
        if (liquidity.liabilityValueBorrowing > 0) {
            const hf = (liquidity.collateralValueBorrowing * BigInt(1e18)) / liquidity.liabilityValueBorrowing;
            console.log(`\n📈 Health Factor: ${ethers.formatUnits(hf, 18)}`);
        } else {
            console.log(`\n📈 Health Factor: MAX (no liability)`);
        }
    } catch (e: any) {
        console.log(`❌ Corrected ABI failed: ${e.message.substring(0, 200)}`);
    }
    
    // Prova con versione 2 (3 args)
    console.log("\n🔸 Trying ABI V2 (3 args: account, collaterals[], liabilityVault)...");
    try {
        const lens2 = new ethers.Contract(ACCOUNT_LENS, ACCOUNT_LENS_ABI_V2, owner);
        const liquidity = await lens2.getAccountLiquidityInfo(testAccount, [WETH_VAULT], USDC_VAULT);
        console.log("✅ V2 ABI works!");
        console.log(`   timeToLiquidation: ${liquidity.timeToLiquidation}`);
        console.log(`   liabilityValue: ${liquidity.liabilityValue}`);
        console.log(`   collateralValueBorrowing: ${liquidity.collateralValueBorrowing}`);
        
        if (liquidity.liabilityValue > 0) {
            const hf = (liquidity.collateralValueBorrowing * BigInt(1e18)) / liquidity.liabilityValue;
            console.log(`\n📈 Health Factor: ${ethers.formatUnits(hf, 18)}`);
        } else {
            console.log(`\n📈 Health Factor: MAX (no liability)`);
        }
    } catch (e: any) {
        console.log(`❌ V2 failed: ${e.message.substring(0, 100)}`);
    }
    
    // Raw call per vedere cosa ritorna effettivamente
    console.log("\n🔸 Trying raw call to see function selector...");
    try {
        // Prova a leggere il bytecode per vedere se il contratto esiste
        const code = await ethers.provider.getCode(ACCOUNT_LENS);
        console.log(`AccountLens has code: ${code.length > 2 ? 'YES' : 'NO'}`);
        console.log(`Code length: ${code.length} bytes`);
    } catch (e: any) {
        console.log(`❌ Failed to get code: ${e.message}`);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("🏁 Debug complete!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
