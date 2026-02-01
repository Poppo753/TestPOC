/**
 * Quick ETH → USDC swap via SimpleSwap
 * Usage: AMOUNT=0.001 npx hardhat run scripts/utils/swap-eth-to-usdc.ts --network arbitrum
 */

import { ethers } from "hardhat";

const SIMPLE_SWAP = "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

async function main() {
    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();
    
    // Get amount
    const amountEth = process.env.AMOUNT || "0.001";
    const amountWei = ethers.parseEther(amountEth);
    
    console.log(`\n💱 Swapping ${amountEth} ETH → USDC`);
    console.log(`   SimpleSwap: ${SIMPLE_SWAP}`);
    console.log(`   Signer: ${signerAddress}\n`);
    
    // Get contracts
    const simpleSwap = await ethers.getContractAt(
        ["function swapExactETHForTokens(address,uint256,address) payable returns (uint256)"],
        SIMPLE_SWAP,
        signer
    );
    
    const usdc = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)"],
        USDC
    );
    
    // Check balance before
    const balanceBefore = await usdc.balanceOf(PROXY_GENERAL);
    console.log(`📊 ProxyGeneral USDC before: ${ethers.formatUnits(balanceBefore, 6)}`);
    
    // Execute swap
    console.log(`\n🔄 Executing swap...`);
    const tx = await simpleSwap.swapExactETHForTokens(
        USDC,
        0, // min out (0 for testing)
        PROXY_GENERAL,
        { value: amountWei }
    );
    
    const receipt = await tx.wait();
    console.log(`   ✅ Tx: ${receipt?.hash}`);
    console.log(`   Gas: ${receipt?.gasUsed.toString()}`);
    
    // Wait for sync
    await new Promise(r => setTimeout(r, 2000));
    
    // Check balance after
    const balanceAfter = await usdc.balanceOf(PROXY_GENERAL);
    const received = balanceAfter - balanceBefore;
    
    console.log(`\n✅ Swap complete!`);
    console.log(`   ProxyGeneral USDC after: ${ethers.formatUnits(balanceAfter, 6)}`);
    console.log(`   USDC received: ${ethers.formatUnits(received, 6)}`);
    console.log(`   Rate: ${ethers.formatUnits(received, 6)} USDC per ${amountEth} ETH`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
