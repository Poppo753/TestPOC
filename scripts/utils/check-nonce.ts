import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();
    const address = await signer.getAddress();
    const nonce = await signer.getNonce();
    
    console.log(`Address: ${address}`);
    console.log(`Current nonce: ${nonce}`);
    console.log(`\nWait 30s then check again...`);
    
    await new Promise(r => setTimeout(r, 30000));
    
    const nonceAfter = await signer.getNonce();
    console.log(`Nonce after wait: ${nonceAfter}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
