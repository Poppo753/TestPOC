import { ethers } from "hardhat";

const PLUGIN = "0x2356D97B9F81be327F2497B9CDd869736E654dd6";
const WETH_VAULT = "0xD8b27CF359b7D15710a5BE299AF6e7Bf904984C2";
const USDC_VAULT = "0x797DD80692c3b2dAdabCe8e30C07fDE5307D48a9";
const EVC = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
const PROTOCOL_MANAGER = "0x88Bd0A1eF96764B328aC6EBa99A7715a9ba28DF9";

async function main() {
    const [signer] = await ethers.getSigners();
    
    console.log(`\n🔍 Checking EVC Status...`);
    
    // Direct EVC call
    const evcAbi = ["function isControllerEnabled(address,address) view returns (bool)"];
    const evc = new ethers.Contract(EVC, evcAbi, signer);
    
    const usdcControllerEnabled = await evc.isControllerEnabled(PLUGIN, USDC_VAULT);
    
    console.log(`  Plugin: ${PLUGIN}`);
    console.log(`  USDC Controller Enabled: ${usdcControllerEnabled}`);
    
    // Get position via ProtocolManager
    const pm = await ethers.getContractAt("ProtocolManager", PROTOCOL_MANAGER);
    const position = await pm.getPositionAggregate("Euler");
    
    console.log(`\nPosition from ProtocolManager:`);
    console.log(`  Assets: ${position.totalAssets.length}`);
    position.totalAssets.forEach((asset: any, i: number) => {
        console.log(`    ${i}: ${ethers.formatUnits(asset, 18)} (code: ${position.assetCodes[i]})`);
    });
    console.log(`  Debts: ${position.totalDebts.length}`);
    position.totalDebts.forEach((debt: any, i: number) => {
        console.log(`    ${i}: ${ethers.formatUnits(debt, 6)} (code: ${position.debtCodes[i]})`);
    });
}

main().catch(e => { console.error(e); process.exit(1); });
