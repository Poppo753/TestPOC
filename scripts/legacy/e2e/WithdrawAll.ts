import { ethers } from "hardhat";

const LIQUIDITY_MANAGER = "0xfb26C7A0CF5b4e86Dcf870b2349A29DA4F630150"; // Multi-swap WORKING!
const PROXY = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const VALUE_CALCULATOR = "0x2E042874BcFc6bE51e0D6b23F8Da22bDd8B215B0";  // Multi-swap compatible!
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  console.log("\n" + "=".repeat(100));
  console.log("💰 TOTAL VALUE & WITHDRAWAL TEST");
  console.log("=".repeat(100) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`User: ${signer.address}\n`);

  // Get contracts
  const liquidityManager = await ethers.getContractAt(
    ["function withdraw(uint256) external"],
    LIQUIDITY_MANAGER
  );

  const proxyGeneral = await ethers.getContractAt(
    ["function balanceOf(address) external view returns (uint256)", "function totalSupply() external view returns (uint256)"],
    PROXY
  );

  const valueCalculator = await ethers.getContractAt(
    ["function getTotalPoolValueView() external view returns (uint256)"],
    VALUE_CALCULATOR
  );

  // STEP 1: Show total value
  console.log("STEP 1: Portfolio Value");
  console.log("-".repeat(100));

  const totalValue = await valueCalculator.getTotalPoolValueView();
  const totalSupply = await proxyGeneral.totalSupply();
  const userShares = await proxyGeneral.balanceOf(signer.address);

  console.log(`💎 Total Pool Value: ${ethers.formatEther(totalValue)} ETH`);
  console.log(`📊 Total LP Supply: ${ethers.formatEther(totalSupply)} LP`);
  console.log(`👤 Your LP Balance: ${ethers.formatEther(userShares)} LP\n`);

  if (totalSupply > 0n) {
    const lpPrice = (totalValue * ethers.parseEther("1")) / totalSupply;
    console.log(`💰 LP Price: ${ethers.formatEther(lpPrice)} ETH per LP`);
    
    const yourValue = (userShares * totalValue) / totalSupply;
    console.log(`💵 Your Portfolio Value: ${ethers.formatEther(yourValue)} ETH\n`);
  }

  // STEP 2: Withdraw 100%
  console.log("\n" + "=".repeat(100));
  console.log("STEP 2: Withdraw 100% of LP (should auto-swap to WETH)");
  console.log("=".repeat(100) + "\n");

  if (userShares === 0n) {
    console.log("❌ No LP tokens to withdraw!");
    return;
  }

  // Get WETH balance before
  const wethContract = await ethers.getContractAt(
    ["function balanceOf(address) external view returns (uint256)"],
    WETH
  );
  const wethBefore = await wethContract.balanceOf(signer.address);

  console.log(`💰 WETH Before: ${ethers.formatEther(wethBefore)} WETH`);
  console.log(`🔄 Withdrawing 100%: ${ethers.formatEther(userShares)} LP...\n`);

  try {
    const tx = await liquidityManager.withdraw(userShares);

    console.log(`📝 TX: ${tx.hash}`);
    console.log(`⏳ Waiting...`);

    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt?.blockNumber}\n`);

    // Check WETH after
    const wethAfter = await wethContract.balanceOf(signer.address);
    const wethReceived = wethAfter - wethBefore;

    console.log(`💰 WETH After: ${ethers.formatEther(wethAfter)} WETH`);
    console.log(`💵 WETH Received: ${ethers.formatEther(wethReceived)} WETH\n`);

    // Check LP balance after
    const sharesAfter = await proxyGeneral.balanceOf(signer.address);
    console.log(`📊 LP After: ${ethers.formatEther(sharesAfter)} LP\n`);

    console.log("=".repeat(100));
    console.log("✅ WITHDRAWAL COMPLETED!");
    console.log("=".repeat(100));

  } catch (error: any) {
    console.log(`\n❌ FAILED: ${error.message}`);
    if (error.data) console.log(`Data: ${error.data}`);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
