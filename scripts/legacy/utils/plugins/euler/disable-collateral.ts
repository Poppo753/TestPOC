/**
 * Disable WETH collateral to allow withdrawal
 */

import { ethers } from "hardhat";

const PLUGIN = "0x2356D97B9F81be327F2497B9CDd869736E654dd6";
const WETH_VAULT = "0xD8b27CF359b7D15710a5BE299AF6e7Bf904984C2";
const PROTOCOL_MANAGER = "0x88Bd0A1eF96764B328aC6EBa99A7715a9ba28DF9";

async function main() {
    const [signer] = await ethers.getSigners();
    
    console.log(`\n🔓 Disabling WETH collateral...`);
    console.log(`   WETH Vault: ${WETH_VAULT}`);
    console.log(`   Plugin: ${PLUGIN}\n`);
    
    const pm = await ethers.getContractAt(
        ["function executeOnProtocol(string,bytes) returns (bytes)"],
        PROTOCOL_MANAGER,
        signer
    );
    
    const pluginInterface = new ethers.Interface([
        "function disableCollateral(string)"
    ]);
    
    const calldata = pluginInterface.encodeFunctionData("disableCollateral", ["WETH"]);
    
    const tx = await pm.executeOnProtocol("Euler", calldata);
    const receipt = await tx.wait();
    
    console.log(`✅ Collateral disabled!`);
    console.log(`   Tx: ${receipt?.hash}`);
    console.log(`   Gas: ${receipt?.gasUsed.toString()}`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log(`\n💡 Now run: npx hardhat run scripts/testing/test-withdraw.ts --network arbitrum`);
}

main().catch(e => { console.error(e); process.exit(1); });
