import { ethers } from "hardhat";

const PLUGIN = "0x2356D97B9F81be327F2497B9CDd869736E654dd6";
const WETH_VAULT = "0xD8b27CF359b7D15710a5BE299AF6e7Bf904984C2";

async function main() {
    const vaultAbi = [
        "function balanceOf(address) view returns (uint256)",
        "function maxWithdraw(address) view returns (uint256)",
        "function maxRedeem(address) view returns (uint256)",
        "function convertToAssets(uint256) view returns (uint256)",
        "function getVaultInfoByAccount(address,bool) view returns (uint128,uint128,uint128)"
    ];
    
    const vault = new ethers.Contract(WETH_VAULT, vaultAbi, ethers.provider);
    
    const shares = await vault.balanceOf(PLUGIN);
    const maxWithdraw = await vault.maxWithdraw(PLUGIN);
    const maxRedeem = await vault.maxRedeem(PLUGIN);
    const assetValue = shares > 0n ? await vault.convertToAssets(shares) : 0n;
    
    console.log(`\n📊 WETH Vault Status for Plugin:`);
    console.log(`   Shares Balance: ${ethers.formatEther(shares)} eWETH`);
    console.log(`   Asset Value: ${ethers.formatEther(assetValue)} WETH`);
    console.log(`   Max Withdraw: ${ethers.formatEther(maxWithdraw)} WETH`);
    console.log(`   Max Redeem: ${ethers.formatEther(maxRedeem)} eWETH`);
    
    if (maxWithdraw === 0n && shares > 0n) {
        console.log(`\n⚠️  You have shares but can't withdraw!`);
        console.log(`   Possible reasons:`);
        console.log(`   - Collateral still enabled in EVC`);
        console.log(`   - Another vault has active controller`);
        console.log(`   - Vault is paused`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
