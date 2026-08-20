import { ethers } from "hardhat";

const PLUGIN = "0x2356D97B9F81be327F2497B9CDd869736E654dd6";
const WETH_VAULT = "0xD8b27CF359b7D15710a5BE299AF6e7Bf904984C2";

async function main() {
    const [signer] = await ethers.getSigners();
    
    const vault = await ethers.getContractAt(
        ["function getAccountStatus(address) view returns (address, bool, address)"],
        WETH_VAULT
    );
    
    const [controller, isEnabled, collateral] = await vault.getAccountStatus(PLUGIN);
    
    console.log(`\nWETH Vault Status:`);
    console.log(`  Controller: ${controller}`);
    console.log(`  Enabled: ${isEnabled}`);
    console.log(`  Collateral: ${collateral}`);
}

main().catch(e => { console.error(e); process.exit(1); });
