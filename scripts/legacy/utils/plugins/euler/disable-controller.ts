/**
 * Disable USDC vault as controller via EVC from Plugin account
 */

import { ethers } from "hardhat";

const PLUGIN = "0x2356D97B9F81be327F2497B9CDd869736E654dd6";
const USDC_VAULT = "0x797DD80692c3b2dAdabCe8e30C07fDE5307D48a9";
const EVC = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

async function main() {
    const [signer] = await ethers.getSigners();
    
    console.log(`\n🔓 Disabling USDC vault controller...`);
    console.log(`   USDC Vault: ${USDC_VAULT}`);
    console.log(`   Plugin: ${PLUGIN}`);
    console.log(`   EVC: ${EVC}\n`);
    
    // Call through ProxyGeneral → Plugin → EVC
    const proxyGeneral = await ethers.getContractAt(
        ["function execute(address,bytes) returns (bytes)"],
        PROXY_GENERAL,
        signer
    );
    
    // Encode Plugin call to EVC.disableController
    const pluginInterface = new ethers.Interface([
        "function callEVC(bytes calldata data) external returns (bytes memory)"
    ]);
    
    const evcInterface = new ethers.Interface(["function disableController(address)"]);
    const evcCalldata = evcInterface.encodeFunctionData("disableController", [USDC_VAULT]);
    
    const pluginCalldata = pluginInterface.encodeFunctionData("callEVC", [evcCalldata]);
    
    const tx = await proxyGeneral.execute(PLUGIN, pluginCalldata);
    const receipt = await tx.wait();
    
    console.log(`✅ Controller disabled!`);
    console.log(`   Tx: ${receipt?.hash}`);
    console.log(`   Gas: ${receipt?.gasUsed.toString()}`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log(`\n💡 Now run: npx hardhat run scripts/testing/test-withdraw.ts --network arbitrum`);
}

main().catch(e => { console.error(e); process.exit(1); });
