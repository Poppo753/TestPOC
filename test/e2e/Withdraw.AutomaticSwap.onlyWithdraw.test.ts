import { expect } from "chai";
import { ethers } from "hardhat";

// Helper to delay between RPC calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Test: Withdrawal with existing LP (simula mainnet)
 * - Assume user has LP
 * - Esegue solo withdrawal
 * - Logga balances, swap events, verifica che lo swap automatico funzioni
 */

describe("E2E: Withdrawal with existing LP (mainnet-like)", function () {
  this.timeout(600000);

  let liquidityManager;
  let proxyGeneral;
  let swapManager;
  let user1;
  let user1Address;

  // Mainnet deployed addresses
  const LIQUIDITY_MANAGER_ADDRESS = "0x545b79254F74Ba33958290BB73F2a338509c975d";
  const PROXY_GENERAL_ADDRESS = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
  const SWAP_MANAGER_ADDRESS = "0x01269d496E957A54e02cdcd5888957baf317A947";

  // Token addresses
  const ARBITRUM_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const ARBITRUM_WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

  before(async function () {
    // Usa la private key dall'env
    const pk = process.env.PRIVATE_KEY;
    if (!pk) throw new Error("PRIVATE_KEY non trovata nell'env");
    user1 = new ethers.Wallet(pk, ethers.provider);
    user1Address = await user1.getAddress();
    liquidityManager = await ethers.getContractAt("LiquidityManager", LIQUIDITY_MANAGER_ADDRESS);
    proxyGeneral = await ethers.getContractAt("ProxyGeneral", PROXY_GENERAL_ADDRESS);
    swapManager = await ethers.getContractAt("SwapManager", SWAP_MANAGER_ADDRESS);
    await delay(1000);
  });

  it("Should withdraw LP and trigger automatic swap if needed", async function () {
    // Check LP balance
    const lpBalance = await proxyGeneral.balanceOf(user1Address);
    console.log(`\nUser LP balance: ${ethers.formatEther(lpBalance)} LP (address: ${user1Address})`);
    expect(lpBalance).to.be.gt(0);

    // Check pool balances before
    const wethContract = await ethers.getContractAt("IERC20", ARBITRUM_WETH);
    const usdcContract = await ethers.getContractAt("IERC20", ARBITRUM_USDC);
    const wbtcContract = await ethers.getContractAt("IERC20", ARBITRUM_WBTC);
    const wethBefore = await wethContract.balanceOf(PROXY_GENERAL_ADDRESS);
    const usdcBefore = await usdcContract.balanceOf(PROXY_GENERAL_ADDRESS);
    const wbtcBefore = await wbtcContract.balanceOf(PROXY_GENERAL_ADDRESS);
    console.log(`Pool before withdrawal:`);
    console.log(`  WETH: ${ethers.formatEther(wethBefore)} WETH`);
    console.log(`  USDC: ${ethers.formatUnits(usdcBefore, 6)} USDC`);
    console.log(`  WBTC: ${ethers.formatUnits(wbtcBefore, 8)} WBTC`);

    // Try withdrawal
    try {
      const tx = await liquidityManager.connect(user1).withdraw(lpBalance, { gasLimit: 5000000 });
      const receipt = await tx.wait();
      await delay(1000);
      console.log(`\nWithdrawal tx hash: ${tx.hash}`);
      // Log swap events
      const swapEvents = receipt.logs.filter(log => {
        try {
          const parsed = swapManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "SwapCompleted" || parsed?.name === "SwapStarted";
        } catch { return false; }
      });
      const autoSwapEvent = receipt.logs.find(log => {
        try {
          const parsed = liquidityManager.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed?.name === "AutomaticSwapTriggered";
        } catch { return false; }
      });
      console.log(`SwapManager events: ${swapEvents.length}`);
      console.log(`AutomaticSwapTriggered: ${autoSwapEvent ? "YES" : "NO"}`);
      // Check pool balances after
      const wethAfter = await wethContract.balanceOf(PROXY_GENERAL_ADDRESS);
      const usdcAfter = await usdcContract.balanceOf(PROXY_GENERAL_ADDRESS);
      const wbtcAfter = await wbtcContract.balanceOf(PROXY_GENERAL_ADDRESS);
      console.log(`Pool after withdrawal:`);
      console.log(`  WETH: ${ethers.formatEther(wethAfter)} WETH`);
      console.log(`  USDC: ${ethers.formatUnits(usdcAfter, 6)} USDC`);
      console.log(`  WBTC: ${ethers.formatUnits(wbtcAfter, 8)} WBTC`);
      // Check if swap occurred
      const usdcUsed = usdcBefore - usdcAfter;
      const wbtcUsed = wbtcBefore - wbtcAfter;
      console.log(`USDC swapped: ${ethers.formatUnits(usdcUsed, 6)} USDC`);
      console.log(`WBTC swapped: ${ethers.formatUnits(wbtcUsed, 8)} WBTC`);
      expect(usdcUsed > 0n || wbtcUsed > 0n).to.be.true;
      console.log(`\n✅ Automatic swap executed if needed`);
    } catch (error) {
      console.log(`\n❌ Withdrawal failed: ${error.message}`);
      throw error;
    }
  });
});
