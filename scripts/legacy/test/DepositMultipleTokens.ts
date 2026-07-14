import { ethers } from "hardhat";

const PROXY = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const SWAP_MANAGER = "0xA1b7B8C442c3c1F342BB9C44b7d0733D0c9Ff357";
const LIQUIDITY_MANAGER = "0x751f2AA50310792d3Cc91bbA9357a61e184278B5"; // NEW with multi-swap!

// Tokens
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  console.log("\n" + "=".repeat(100));
  console.log("💰 DEPOSIT MULTIPLE TOKENS FOR MULTI-SWAP TEST");
  console.log("=".repeat(100) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`User: ${signer.address}\n`);

  // Step 1: Deposit ETH to get LP tokens and WETH in pool
  console.log("STEP 1: Deposit 0.001 ETH to pool");
  console.log("-".repeat(100));

  const liquidityManager = await ethers.getContractAt(
    ["function deposit() external payable returns (uint256)"],
    LIQUIDITY_MANAGER
  );

  const depositAmount = ethers.parseEther("0.001");
  
  console.log(`💰 Depositing ${ethers.formatEther(depositAmount)} ETH...`);
  
  const depositTx = await liquidityManager.deposit({ value: depositAmount });
  console.log(`📝 TX: ${depositTx.hash}`);
  
  const depositReceipt = await depositTx.wait();
  console.log(`✅ Deposited in block ${depositReceipt?.blockNumber}\n`);

  // Step 2: Swap some WETH to USDC
  console.log("\nSTEP 2: Swap WETH → USDC (to diversify pool)");
  console.log("-".repeat(100));

  const swapManager = await ethers.getContractAt(
    ["function performSwap(string,string,uint256,uint256) external returns (uint256)"],
    SWAP_MANAGER
  );

  const wethToSwap = ethers.parseEther("0.0003"); // Swap 0.0003 WETH to USDC
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min

  console.log(`🔄 Swapping ${ethers.formatEther(wethToSwap)} WETH → USDC...`);
  
  const swapTx1 = await swapManager.performSwap("WETH", "USDC", wethToSwap, deadline);
  console.log(`📝 TX: ${swapTx1.hash}`);
  
  const swapReceipt1 = await swapTx1.wait();
  console.log(`✅ Swapped in block ${swapReceipt1?.blockNumber}\n`);

  // Step 3: Swap some WETH to WBTC
  console.log("\nSTEP 3: Swap WETH → WBTC (add more diversity)");
  console.log("-".repeat(100));

  const wethToSwap2 = ethers.parseEther("0.0003"); // Swap 0.0003 WETH to WBTC
  
  console.log(`🔄 Swapping ${ethers.formatEther(wethToSwap2)} WETH → WBTC...`);
  
  const swapTx2 = await swapManager.performSwap("WETH", "WBTC", wethToSwap2, deadline);
  console.log(`📝 TX: ${swapTx2.hash}`);
  
  const swapReceipt2 = await swapTx2.wait();
  console.log(`✅ Swapped in block ${swapReceipt2?.blockNumber}\n`);

  // Step 4: Check final balances
  console.log("\nSTEP 4: Final Pool Composition");
  console.log("=".repeat(100));

  const proxyGeneral = await ethers.getContractAt(
    ["function balanceOf(address) external view returns (uint256)"],
    PROXY
  );

  const wethContract = await ethers.getContractAt(
    ["function balanceOf(address) external view returns (uint256)"],
    WETH
  );

  const usdcContract = await ethers.getContractAt(
    ["function balanceOf(address) external view returns (uint256)"],
    USDC
  );

  const wbtcContract = await ethers.getContractAt(
    ["function balanceOf(address) external view returns (uint256)"],
    WBTC
  );

  const wethBalance = await wethContract.balanceOf(PROXY);
  const usdcBalance = await usdcContract.balanceOf(PROXY);
  const wbtcBalance = await wbtcContract.balanceOf(PROXY);
  const lpBalance = await proxyGeneral.balanceOf(signer.address);

  console.log(`\n💰 Pool Balances:`);
  console.log(`   WETH: ${ethers.formatEther(wethBalance)} WETH`);
  console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  console.log(`   WBTC: ${ethers.formatUnits(wbtcBalance, 8)} WBTC`);
  console.log(`\n👤 Your LP: ${ethers.formatEther(lpBalance)} LP\n`);

  console.log("=".repeat(100));
  console.log("✅ MULTI-TOKEN POOL READY FOR TESTING!");
  console.log("=".repeat(100));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
