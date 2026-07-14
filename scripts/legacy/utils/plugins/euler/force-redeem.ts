/**
 * Force withdraw using redeem instead of withdraw
 */

import { ethers } from "hardhat";

const PLUGIN = "0x2356D97B9F81be327F2497B9CDd869736E654dd6";
const WETH_VAULT = "0xD8b27CF359b7D15710a5BE299AF6e7Bf904984C2";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const PROTOCOL_MANAGER = "0x88Bd0A1eF96764B328aC6EBa99A7715a9ba28DF9";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

async function main() {
    const [signer] = await ethers.getSigners();
    
    // Check shares
    const vault = new ethers.Contract(
        WETH_VAULT,
        ["function balanceOf(address) view returns (uint256)", "function redeem(uint256,address,address) returns (uint256)"],
        signer
    );
    
    const shares = await vault.balanceOf(PLUGIN);
    console.log(`\n📊 Current Position:`);
    console.log(`   WETH Shares: ${ethers.formatEther(shares)}`);
    
    if (shares === 0n) {
        console.log(`❌ No shares to redeem`);
        return;
    }
    
    // Redeem via ProtocolManager
    console.log(`\n💸 Redeeming all shares...`);
    
    const pm = await ethers.getContractAt(
        ["function executeOnProtocol(string,bytes) returns (bytes)"],
        PROTOCOL_MANAGER,
        signer
    );
    
    const pluginInterface = new ethers.Interface([
        "function redeemShares(string,uint256)"
    ]);
    
    const calldata = pluginInterface.encodeFunctionData("redeemShares", ["WETH", shares]);
    
    const tx = await pm.executeOnProtocol("Euler", calldata);
    const receipt = await tx.wait();
    
    console.log(`✅ Shares redeemed!`);
    console.log(`   Tx: ${receipt?.hash}`);
    console.log(`   Gas: ${receipt?.gasUsed.toString()}`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Check WETH in ProxyGeneral
    const weth = new ethers.Contract(
        WETH,
        ["function balanceOf(address) view returns (uint256)"],
        signer
    );
    
    const proxyBalance = await weth.balanceOf(PROXY_GENERAL);
    console.log(`\n✅ ProxyGeneral WETH: ${ethers.formatEther(proxyBalance)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
