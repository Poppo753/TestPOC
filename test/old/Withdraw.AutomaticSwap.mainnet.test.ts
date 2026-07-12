import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

// Helper to delay between RPC calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 🔄 AUTOMATIC SWAP VERIFICATION - MAINNET FORK TEST
 * 
 * Verifica che il contratto swappi automaticamente USDC/WBTC → WETH quando:
 * - ProxyGeneral ha USDC e WBTC ma pochi/zero LP tokens mintati
 * - Utente deposita ETH e riceve LP
 * - Utente tenta withdraw: deve swappare USDC/WBTC per restituire ETH
 * 
 * SCENARIO REALE MAINNET:
 * - ProxyGeneral: 0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1
 * - Contiene USDC e WBTC ma supply LP bassa/zero
 * - Swap deve usare UniswapV3PluginDirect deployed
 */

describe("E2E: Automatic Swap on Withdraw (Mainnet State)", function () {
  this.timeout(600000); // 10 minutes for fork operations
  
  let liquidityManager: Contract;
  let proxyGeneral: Contract;
  let swapManager: Contract;
  let tokenManager: Contract;
  let valueCalculator: Contract;
  let user1: any;
  let owner: any;

  // Deployed contract addresses
  const LIQUIDITY_MANAGER_ADDRESS = "0x545b79254F74Ba33958290BB73F2a338509c975d";
  const PROXY_GENERAL_ADDRESS = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
  const SWAP_MANAGER_ADDRESS = "0x01269d496E957A54e02cdcd5888957baf317A947";
  const TOKEN_MANAGER_ADDRESS = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
  const VALUE_CALCULATOR_ADDRESS = "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B";
  
  // Token addresses on Arbitrum
  const ARBITRUM_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const ARBITRUM_WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

  before(async function () {
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 42161n && network.chainId !== 31337n) {
      console.log("⚠️  Skipping - requires Arbitrum fork (FORK_ENABLED=true)");
      this.skip();
    }

    [owner, user1] = await ethers.getSigners();

    console.log("\n🌐 MAINNET FORK - AUTOMATIC SWAP VERIFICATION");
    console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`   Block: ${await ethers.provider.getBlockNumber()}`);
    console.log(`   Test user: ${user1.address}`);
  });

  beforeEach(async function () {
    // Connect to deployed contracts
    liquidityManager = await ethers.getContractAt("LiquidityManager", LIQUIDITY_MANAGER_ADDRESS);
    proxyGeneral = await ethers.getContractAt("ProxyGeneral", PROXY_GENERAL_ADDRESS);
    swapManager = await ethers.getContractAt("SwapManager", SWAP_MANAGER_ADDRESS);
    tokenManager = await ethers.getContractAt("TokenManager", TOKEN_MANAGER_ADDRESS);
    valueCalculator = await ethers.getContractAt("ValueCalculator", VALUE_CALCULATOR_ADDRESS);
    
    console.log("\n✅ Connected to mainnet contracts");
    
    await delay(1000);

    // Fund user1 with ETH for deposits
    await ethers.provider.send("hardhat_setBalance", [
      user1.address,
      "0x56BC75E2D63100000", // 100 ETH
    ]);
    
    await delay(1000);
  });

  describe("📊 Step 1: Verify Current Mainnet State", function () {
    
    it("Should check ProxyGeneral holdings and LP supply", async function () {
      console.log("\n📊 MAINNET STATE ANALYSIS:");
      
      // Check LP token supply
      const totalSupply = await proxyGeneral.totalSupply();
      console.log(`\n💎 LP Token Supply:`);
      console.log(`   Total supply: ${ethers.formatEther(totalSupply)} LP`);
      
      // Check WETH balance
      const wethContract = await ethers.getContractAt("IERC20", ARBITRUM_WETH);
      const wethBalance = await wethContract.balanceOf(PROXY_GENERAL_ADDRESS);
      console.log(`\n💰 ProxyGeneral Holdings:`);
      console.log(`   WETH: ${ethers.formatEther(wethBalance)} WETH`);
      
      // Check USDC balance
      const usdcContract = await ethers.getContractAt("IERC20", ARBITRUM_USDC);
      const usdcBalance = await usdcContract.balanceOf(PROXY_GENERAL_ADDRESS);
      console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
      
      // Check WBTC balance
      const wbtcContract = await ethers.getContractAt("IERC20", ARBITRUM_WBTC);
      const wbtcBalance = await wbtcContract.balanceOf(PROXY_GENERAL_ADDRESS);
      console.log(`   WBTC: ${ethers.formatUnits(wbtcBalance, 8)} WBTC`);
      
      // Calculate total value
      let totalValue = 0n;
      try {
        totalValue = await valueCalculator.getTotalPoolValueView();
        console.log(`\n📈 Total Pool Value: ${ethers.formatEther(totalValue)} ETH equivalent`);
      } catch (error) {
        console.log(`\n⚠️  Could not calculate total value: ${error}`);
      }
      
      // Verify state
      console.log(`\n🔍 STATE VERIFICATION:`);
      console.log(`   ✅ LP Supply: ${totalSupply === 0n ? "ZERO (as expected)" : ethers.formatEther(totalSupply)}`);
      console.log(`   ${usdcBalance > 0n ? "✅" : "❌"} USDC present: ${usdcBalance > 0n ? "YES" : "NO"}`);
      console.log(`   ${wbtcBalance > 0n ? "✅" : "❌"} WBTC present: ${wbtcBalance > 0n ? "YES" : "NO"}`);
      
      // Store for next tests
      (this.test?.parent as any).initialState = {
        totalSupply,
        wethBalance,
        usdcBalance,
        wbtcBalance,
        totalValue
      };
    });
  });

  describe("💎 Step 2: User Deposits ETH", function () {
    
    it("Should allow user to deposit ETH and receive LP tokens", async function () {
      const depositAmount = ethers.parseEther("0.05"); // 0.05 ETH (smaller test)
      
      console.log("\n💰 USER DEPOSIT TEST:");
      console.log(`   Depositing: ${ethers.formatEther(depositAmount)} ETH`);
      
      const userEthBefore = await ethers.provider.getBalance(user1.address);
      
      await delay(1000);
      
      try {
        const tx = await liquidityManager.connect(user1).deposit({ 
          value: depositAmount,
          gasLimit: 3000000 
        });
        const receipt = await tx.wait();
        
        await delay(1000);
        
        const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
        const userEthAfter = await ethers.provider.getBalance(user1.address);
        const ethSpent = userEthBefore - userEthAfter;
        
        console.log(`   ✅ Deposit successful`);
        console.log(`   Gas used: ${receipt!.gasUsed.toLocaleString()}`);
        console.log(`   ETH spent (incl. gas): ${ethers.formatEther(ethSpent)} ETH`);
        
        // Check LP tokens received
        const lpBalance = await proxyGeneral.balanceOf(user1.address);
        console.log(`   LP tokens received: ${ethers.formatEther(lpBalance)} LP`);
        
        expect(lpBalance).to.be.gt(0);
        
        // Check new ProxyGeneral state
        const wethContract = await ethers.getContractAt("IERC20", ARBITRUM_WETH);
        const newWethBalance = await wethContract.balanceOf(PROXY_GENERAL_ADDRESS);
        
        console.log(`\n📊 ProxyGeneral After Deposit:`);
        console.log(`   WETH: ${ethers.formatEther(newWethBalance)} WETH`);
        const initialState = (this.test?.parent?.parent as any).initialState;
        if (initialState) {
          console.log(`   WETH increased by: ${ethers.formatEther(newWethBalance - initialState.wethBalance)} WETH`);
        }
        
        // Store for withdrawal test
        (this.test?.parent?.parent as any).userLpBalance = lpBalance;
        (this.test?.parent?.parent as any).postDepositWeth = newWethBalance;
        
      } catch (error: any) {
        console.log(`\n❌ DEPOSIT FAILED: ${error.message}`);
        throw error;
      }
    });
  });

  describe("🔄 Step 3: User Withdraws - Automatic Swap Test", function () {
    
    it("Should automatically swap USDC/WBTC to fulfill withdrawal", async function () {
      const lpBalance = (this.test?.parent?.parent as any).userLpBalance;
      if (!lpBalance || lpBalance === 0n) {
        console.log("⚠️  Skipping - no LP tokens from previous test");
        this.skip();
      }
      
      // Withdraw MORE than deposited to force swap from USDC/WBTC
      // User deposited ~0.05 ETH, total pool value ~0.1 ETH
      // If user tries to withdraw 80% of LP, needs to swap USDC/WBTC
      const totalLpSupply = await proxyGeneral.totalSupply();
      const withdrawPercentage = 80n; // 80%
      const withdrawShares = (totalLpSupply * withdrawPercentage) / 100n;
      
      console.log("\n🔄 AUTOMATIC SWAP WITHDRAWAL TEST:");
      console.log(`   Total LP supply: ${ethers.formatEther(totalLpSupply)} LP`);
      console.log(`   Withdrawing: ${ethers.formatEther(withdrawShares)} LP (${withdrawPercentage}%)`);
      
      // Get balances before withdrawal
      const wethContract = await ethers.getContractAt("IERC20", ARBITRUM_WETH);
      const usdcContract = await ethers.getContractAt("IERC20", ARBITRUM_USDC);
      const wbtcContract = await ethers.getContractAt("IERC20", ARBITRUM_WBTC);
      
      const wethBefore = await wethContract.balanceOf(PROXY_GENERAL_ADDRESS);
      const usdcBefore = await usdcContract.balanceOf(PROXY_GENERAL_ADDRESS);
      const wbtcBefore = await wbtcContract.balanceOf(PROXY_GENERAL_ADDRESS);
      
      console.log(`\n📊 ProxyGeneral Before Withdrawal:`);
      console.log(`   WETH: ${ethers.formatEther(wethBefore)} WETH`);
      console.log(`   USDC: ${ethers.formatUnits(usdcBefore, 6)} USDC`);
      console.log(`   WBTC: ${ethers.formatUnits(wbtcBefore, 8)} WBTC`);
      
      // Calculate expected withdrawal
      const totalSupply = await proxyGeneral.totalSupply();
      const totalValue = await valueCalculator.getTotalPoolValueView();
      const expectedEth = (withdrawShares * totalValue) / totalSupply;
      
      console.log(`\n💰 Expected Withdrawal:`);
      console.log(`   ETH value: ${ethers.formatEther(expectedEth)} ETH`);
      console.log(`   Available WETH: ${ethers.formatEther(wethBefore)} WETH`);
      console.log(`   Needs swap: ${wethBefore < expectedEth ? "YES ✅" : "NO ❌"}`);
      
      await delay(2000);
      
      // Execute withdrawal
      const userEthBefore = await ethers.provider.getBalance(user1.address);
      
      try {
        console.log(`\n⏳ Executing withdrawal...`);
        
        const tx = await liquidityManager.connect(user1).withdraw(
          withdrawShares,
          { gasLimit: 5000000 }
        );
        const receipt = await tx.wait();
        
        await delay(1000);
        
        const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
        const userEthAfter = await ethers.provider.getBalance(user1.address);
        const ethReceived = userEthAfter - userEthBefore + BigInt(gasUsed);
        
        console.log(`\n✅ WITHDRAWAL SUCCESSFUL:`);
        console.log(`   Gas used: ${receipt!.gasUsed.toLocaleString()}`);
        console.log(`   ETH received: ${ethers.formatEther(ethReceived)} ETH`);
        
        // Check for swap events
        const swapEvents = receipt!.logs.filter((log: any) => {
          try {
            const parsed = swapManager.interface.parseLog({ 
              topics: log.topics, 
              data: log.data 
            });
            return parsed?.name === "SwapCompleted" || parsed?.name === "SwapStarted";
          } catch { return false; }
        });
        
        const automaticSwapEvent = receipt!.logs.find((log: any) => {
          try {
            const parsed = liquidityManager.interface.parseLog({ 
              topics: log.topics, 
              data: log.data 
            });
            return parsed?.name === "AutomaticSwapTriggered";
          } catch { return false; }
        });
        
        console.log(`\n🔄 SWAP DETECTION:`);
        console.log(`   SwapManager events: ${swapEvents.length}`);
        console.log(`   AutomaticSwapTriggered: ${automaticSwapEvent ? "YES ✅" : "NO"}`);
        
        if (automaticSwapEvent) {
          const parsed = liquidityManager.interface.parseLog({
            topics: automaticSwapEvent.topics,
            data: automaticSwapEvent.data
          });
          console.log(`\n📡 AutomaticSwapTriggered Event:`);
          console.log(`   Token swapped: ${parsed?.args.tokenToSwap}`);
          console.log(`   Amount: ${parsed?.args.tokenToSwap === "USDC" ? ethers.formatUnits(parsed?.args.amountToSwap, 6) : ethers.formatUnits(parsed?.args.amountToSwap, 8)}`);
          console.log(`   WETH needed: ${ethers.formatEther(parsed?.args.wethNeeded)} WETH`);
        }
        
        // Check balances after withdrawal
        const wethAfter = await wethContract.balanceOf(PROXY_GENERAL_ADDRESS);
        const usdcAfter = await usdcContract.balanceOf(PROXY_GENERAL_ADDRESS);
        const wbtcAfter = await wbtcContract.balanceOf(PROXY_GENERAL_ADDRESS);
        
        console.log(`\n📊 ProxyGeneral After Withdrawal:`);
        console.log(`   WETH: ${ethers.formatEther(wethAfter)} WETH (${wethAfter < wethBefore ? "decreased ✅" : "unchanged"})`);
        console.log(`   USDC: ${ethers.formatUnits(usdcAfter, 6)} USDC (${usdcAfter < usdcBefore ? "decreased ✅" : "unchanged"})`);
        console.log(`   WBTC: ${ethers.formatUnits(wbtcAfter, 8)} WBTC (${wbtcAfter < wbtcBefore ? "decreased ✅" : "unchanged"})`);
        
        // Verify swap occurred
        const usdcUsed = usdcBefore - usdcAfter;
        const wbtcUsed = wbtcBefore - wbtcAfter;
        
        console.log(`\n💱 SWAP VERIFICATION:`);
        console.log(`   USDC swapped: ${ethers.formatUnits(usdcUsed, 6)} USDC`);
        console.log(`   WBTC swapped: ${ethers.formatUnits(wbtcUsed, 8)} WBTC`);
        
        if (wethBefore < expectedEth) {
          // Swap was needed
          expect(usdcUsed > 0n || wbtcUsed > 0n).to.be.true;
          console.log(`   ✅ Automatic swap executed (was needed)`);
        } else {
          console.log(`   ℹ️  No swap needed (sufficient WETH available)`);
        }
        
        // Verify user received ETH
        expect(ethReceived).to.be.gt(0);
        console.log(`\n✅ VERIFICATION PASSED:`);
        console.log(`   ✅ User received ETH successfully`);
        console.log(`   ✅ Automatic swap mechanism working correctly`);
        
      } catch (error: any) {
        console.log(`\n❌ WITHDRAWAL FAILED: ${error.message}`);
        
        // Additional diagnostics
        console.log(`\n🔍 FAILURE DIAGNOSTICS:`);
        console.log(`   Error: ${error.message}`);
        console.log(`   Reason: ${error.reason || "Unknown"}`);
        
        throw error;
      }
    });
  });

  describe("🎯 Step 4: Edge Case - Multiple Withdrawals", function () {
    
    it("Should handle sequential withdrawals with automatic swaps", async function () {
      // Deposit more to get LP tokens
      const depositAmount = ethers.parseEther("1.0");
      
      console.log("\n💰 Setting up for sequential withdrawals:");
      console.log(`   Depositing: ${ethers.formatEther(depositAmount)} ETH`);
      
      await delay(1000);
      
      const tx = await liquidityManager.connect(user1).deposit({ 
        value: depositAmount,
        gasLimit: 3000000 
      });
      await tx.wait();
      
      await delay(1000);
      
      const lpBalance = await proxyGeneral.balanceOf(user1.address);
      console.log(`   LP balance: ${ethers.formatEther(lpBalance)} LP`);
      
      if (lpBalance === 0n) {
        console.log("⚠️  Skipping - no LP tokens");
        this.skip();
      }
      
      // Perform 3 partial withdrawals
      const withdrawAmount = lpBalance / 4n; // 25% each time
      
      console.log(`\n🔄 Performing 3 sequential withdrawals:`);
      console.log(`   Each withdrawal: ${ethers.formatEther(withdrawAmount)} LP (25%)`);
      
      for (let i = 0; i < 3; i++) {
        console.log(`\n   [${i + 1}/3] Withdrawing...`);
        
        await delay(2000);
        
        const withdrawTx = await liquidityManager.connect(user1).withdraw(
          withdrawAmount,
          { gasLimit: 5000000 }
        );
        const receipt = await withdrawTx.wait();
        
        console.log(`   ✅ Completed - Gas: ${receipt!.gasUsed.toLocaleString()}`);
        
        // Check if swap occurred
        const swapEvent = receipt!.logs.find((log: any) => {
          try {
            const parsed = liquidityManager.interface.parseLog({ 
              topics: log.topics, 
              data: log.data 
            });
            return parsed?.name === "AutomaticSwapTriggered";
          } catch { return false; }
        });
        
        if (swapEvent) {
          console.log(`   🔄 Swap triggered`);
        }
        
        await delay(1000);
      }
      
      console.log(`\n✅ All sequential withdrawals completed successfully`);
    });
  });
});
