import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

// Helper to delay between RPC calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 🔄 AUTOMATIC SWAP VERIFICATION - FRESH DEPLOYMENT ON FORK
 * 
 * Testa scenario reale:
 * - Protocol deployment su fork con pool che ha USDC/WBTC
 * - User deposita ETH minimo
 * - User tenta withdraw grande → deve swappare USDC/WBTC automaticamente
 * 
 * Questo test usa deployment fresco quindi non ha limitazioni dei contratti mainnet
 */

describe("E2E: Automatic Swap on Withdraw (Fresh Fork Deploy)", function () {
  this.timeout(600000); // 10 minutes
  
  let beacon: Contract;
  let proxyGeneral: Contract;
  let liquidityManager: Contract;
  let tokenManager: Contract;
  let swapManager: Contract;
  let valueCalculator: Contract;
  let parameterManager: Contract;
  let emergencyHandler: Contract;
  let chainlinkAdapter: Contract;
  let uniswapV3Plugin: Contract;
  
  let owner: Signer;
  let user1: Signer;
  
  // Arbitrum mainnet token addresses
  const ARBITRUM_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const ARBITRUM_WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
  
  // Arbitrum Chainlink oracles
  const ETH_USD_FEED = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";
  const BTC_USD_FEED = "0x6ce185860a4963106506C203335A2910413708e9";
  const USDC_USD_FEED = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3";
  
  // UniswapV3 on Arbitrum
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const UNISWAP_V3_QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";

  before(async function () {
    if (process.env.FORK_ENABLED !== "true") {
      console.log("\u26a0\ufe0f  Skipping - requires Arbitrum fork (set FORK_ENABLED=true)");
      this.skip();
      return;
    }
    const network = await ethers.provider.getNetwork();

    [owner, user1] = await ethers.getSigners();

    console.log("\n🚀 FRESH DEPLOYMENT ON ARBITRUM FORK");
    console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`   Block: ${await ethers.provider.getBlockNumber()}`);
    console.log(`   Deployer: ${await owner.getAddress()}`);
    console.log(`   Test user: ${await user1.getAddress()}`);
    
    // Fund users
    await ethers.provider.send("hardhat_setBalance", [
      await owner.getAddress(),
      "0x56BC75E2D63100000", // 100 ETH
    ]);
    
    await ethers.provider.send("hardhat_setBalance", [
      await user1.getAddress(),
      "0x56BC75E2D63100000", // 100 ETH
    ]);
    
    await delay(1000);
  });

  it("Should deploy full protocol", async function () {
    console.log("\n📦 DEPLOYING PROTOCOL CONTRACTS...");
    
    // 1. Deploy Beacon
    const BeaconFactory = await ethers.getContractFactory("Beacon");
    beacon = await BeaconFactory.deploy();
    await beacon.waitForDeployment();
    console.log(`   ✅ Beacon: ${await beacon.getAddress()}`);
    await delay(1000);
    
    // 2. Deploy ProxyGeneral
    const ProxyFactory = await ethers.getContractFactory("ProxyGeneral");
    proxyGeneral = await ProxyFactory.deploy(await beacon.getAddress(), "WETH");
    await proxyGeneral.waitForDeployment();
    console.log(`   ✅ ProxyGeneral: ${await proxyGeneral.getAddress()}`);
    await delay(1000);
    
    // 3. Register implementations in Beacon
    await beacon.updateImplementation("ProxyGeneral", await proxyGeneral.getAddress());
    await beacon.updateImplementation("WETH", ARBITRUM_WETH);
    await beacon.updateImplementation("BASE_ASSET", ARBITRUM_WETH);
    await beacon.updateImplementation("USDC", ARBITRUM_USDC);
    await beacon.updateImplementation("WBTC", ARBITRUM_WBTC);
    await delay(1000);
    
    // 4. Deploy ChainlinkAdapter
    const ChainlinkFactory = await ethers.getContractFactory("ChainlinkAdapter");
    chainlinkAdapter = await ChainlinkFactory.deploy();
    await chainlinkAdapter.waitForDeployment();
    console.log(`   ✅ ChainlinkAdapter: ${await chainlinkAdapter.getAddress()}`);
    await delay(1000);
    
    // Register oracles
    await chainlinkAdapter.setPriceFeed("WETH", ETH_USD_FEED, 8, 3600, "USD");
    await chainlinkAdapter.setPriceFeed("WBTC", BTC_USD_FEED, 8, 3600, "USD");
    await chainlinkAdapter.setPriceFeed("USDC", USDC_USD_FEED, 8, 86400, "USD");
    await chainlinkAdapter.setReferenceFeed("USD", ETH_USD_FEED, 8, 3600);
    await beacon.updateImplementation("ChainlinkAdapter", await chainlinkAdapter.getAddress());
    await delay(1000);
    
    // 5. Deploy TokenManager
    const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
    tokenManager = await TokenManagerFactory.deploy(
      await beacon.getAddress(),
      await chainlinkAdapter.getAddress()
    );
    await tokenManager.waitForDeployment();
    console.log(`   ✅ TokenManager: ${await tokenManager.getAddress()}`);
    await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
    await tokenManager.manageTokenData("USDC", ARBITRUM_USDC, USDC_USD_FEED, 6, 8, 86400);
    await tokenManager.manageTokenData("WBTC", ARBITRUM_WBTC, BTC_USD_FEED, 8, 8, 3600);
    await delay(1000);
    
    // 6. Deploy ValueCalculator
    const ValueCalculatorFactory = await ethers.getContractFactory("ValueCalculator");
    valueCalculator = await ValueCalculatorFactory.deploy(await beacon.getAddress(), "WETH");
    await valueCalculator.waitForDeployment();
    console.log(`   ✅ ValueCalculator: ${await valueCalculator.getAddress()}`);
    await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
    await delay(1000);
    
    // 7. Deploy ParameterManager
    const ParameterManagerFactory = await ethers.getContractFactory("ParameterManager");
    parameterManager = await ParameterManagerFactory.deploy(await beacon.getAddress(), 18);
    await parameterManager.waitForDeployment();
    console.log(`   ✅ ParameterManager: ${await parameterManager.getAddress()}`);
    await beacon.updateImplementation("ParameterManager", await parameterManager.getAddress());
    await delay(1000);
    
    // 8. Deploy EmergencyHandler
    const EmergencyHandlerFactory = await ethers.getContractFactory("EmergencyHandler");
    emergencyHandler = await EmergencyHandlerFactory.deploy(await beacon.getAddress());
    await emergencyHandler.waitForDeployment();
    console.log(`   ✅ EmergencyHandler: ${await emergencyHandler.getAddress()}`);
    await beacon.updateImplementation("EmergencyHandler", await emergencyHandler.getAddress());
    await delay(1000);
    
    // 9. Deploy UniswapV3PluginDirect
    const UniswapPluginFactory = await ethers.getContractFactory("UniswapV3PluginDirect");
    uniswapV3Plugin = await UniswapPluginFactory.deploy(
      UNISWAP_V3_ROUTER,
      UNISWAP_V3_QUOTER_V2,
      await proxyGeneral.getAddress()
    );
    await uniswapV3Plugin.waitForDeployment();
    console.log(`   ✅ UniswapV3PluginDirect: ${await uniswapV3Plugin.getAddress()}`);
    await beacon.updateImplementation("UniswapV3PluginDirect", await uniswapV3Plugin.getAddress());
    await delay(1000);
    
    // 10. Deploy SwapManager
    const SwapManagerFactory = await ethers.getContractFactory("SwapManager");
    swapManager = await SwapManagerFactory.deploy(await beacon.getAddress(), "WETH");
    await swapManager.waitForDeployment();
    console.log(`   ✅ SwapManager: ${await swapManager.getAddress()}`);
    await beacon.updateImplementation("SwapManager", await swapManager.getAddress());
    await delay(1000);
    
    // 11. Deploy LiquidityManager
    const LiquidityManagerFactory = await ethers.getContractFactory("LiquidityManager");
    liquidityManager = await LiquidityManagerFactory.deploy(await beacon.getAddress(), "WETH");
    await liquidityManager.waitForDeployment();
    console.log(`   ✅ LiquidityManager: ${await liquidityManager.getAddress()}`);
    await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());
    await delay(1000);
    
    // 12. Configure SwapManager with plugin
    await swapManager.setActiveSwapPlugin("UniswapV3PluginDirect");
    console.log(`   ✅ Plugin configured`);
    
    // 13. Authorize modules in ProxyGeneral
    await proxyGeneral.authorizeModule(await liquidityManager.getAddress(), "LiquidityManager");
    await proxyGeneral.authorizeModule(await swapManager.getAddress(), "SwapManager");
    await proxyGeneral.authorizeModule(await emergencyHandler.getAddress(), "EmergencyHandler");
    console.log(`   ✅ Modules authorized`);
    
    console.log("\n✅ FULL PROTOCOL DEPLOYED SUCCESSFULLY");
  });

  it("Should fund pool with USDC and WBTC (simulate mainnet state)", async function () {
    console.log("\n💰 FUNDING POOL WITH USDC/WBTC...");
    
    // Get whale addresses on Arbitrum
    const USDC_WHALE = "0x2df1c51e09aecf9cacb7bc98cb1742757f163df7"; // Binance wallet
    const WBTC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A"; // GMX vault
    
    // Impersonate whales
    await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
    await ethers.provider.send("hardhat_impersonateAccount", [WBTC_WHALE]);
    
    const usdcWhale = await ethers.getSigner(USDC_WHALE);
    const wbtcWhale = await ethers.getSigner(WBTC_WHALE);
    
    // Fund whales with ETH for gas
    await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, "0x56BC75E2D63100000"]);
    await ethers.provider.send("hardhat_setBalance", [WBTC_WHALE, "0x56BC75E2D63100000"]);
    
    await delay(1000);
    
    // Transfer tokens to ProxyGeneral
    const usdcContract = await ethers.getContractAt("IERC20", ARBITRUM_USDC);
    const wbtcContract = await ethers.getContractAt("IERC20", ARBITRUM_WBTC);
    
    const usdcAmount = ethers.parseUnits("2500", 6); // 2500 USDC
    const wbtcAmount = ethers.parseUnits("0.02", 8); // 0.02 WBTC (~$2000)
    
    await usdcContract.connect(usdcWhale).transfer(await proxyGeneral.getAddress(), usdcAmount);
    console.log(`   ✅ Transferred 2500 USDC to ProxyGeneral`);
    await delay(1000);
    
    await wbtcContract.connect(wbtcWhale).transfer(await proxyGeneral.getAddress(), wbtcAmount);
    console.log(`   ✅ Transferred 0.02 WBTC to ProxyGeneral`);
    await delay(1000);
    
    // Verify balances
    const usdcBalance = await usdcContract.balanceOf(await proxyGeneral.getAddress());
    const wbtcBalance = await wbtcContract.balanceOf(await proxyGeneral.getAddress());
    
    console.log(`\n📊 ProxyGeneral Initial Holdings:`);
    console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    console.log(`   WBTC: ${ethers.formatUnits(wbtcBalance, 8)} WBTC`);
    console.log(`   WETH: 0 WETH`);
    console.log(`   LP Supply: 0 LP`);
    
    expect(usdcBalance).to.be.gt(0);
    expect(wbtcBalance).to.be.gt(0);
    expect(await tokenManager.getActiveTokens()).to.deep.equal(["USDC", "WBTC"]);
    expect(await valueCalculator.calculateTokenValuePure("USDC")).to.be.gt(0n);
    expect(await valueCalculator.calculateTokenValuePure("WBTC")).to.be.gt(0n);
  });

  it("Should allow user to deposit small ETH amount", async function () {
    console.log("\n💎 USER DEPOSITS ETH...");
    
    const depositAmount = ethers.parseEther("0.01"); // 0.01 ETH (very small)
    console.log(`   Depositing: ${ethers.formatEther(depositAmount)} ETH`);
    
    await delay(1000);
    
    const wethWrapper = await ethers.getContractAt("IWETH", ARBITRUM_WETH);
    await wethWrapper.connect(user1).deposit({ value: depositAmount });
    const wethErc20 = await ethers.getContractAt("IERC20", ARBITRUM_WETH);
    await wethErc20.connect(user1).approve(await liquidityManager.getAddress(), depositAmount);
    const tx = await liquidityManager.connect(user1).deposit(depositAmount, { gasLimit: 3000000 });
    const receipt = await tx.wait();
    
    await delay(1000);
    
    const lpBalance = await proxyGeneral.balanceOf(await user1.getAddress());
    console.log(`   ✅ LP tokens received: ${ethers.formatEther(lpBalance)} LP`);
    console.log(`   Gas used: ${receipt!.gasUsed.toLocaleString()}`);
    
    expect(lpBalance).to.be.gt(0);
    
    // Check pool state
    const wethContract = await ethers.getContractAt("IERC20", ARBITRUM_WETH);
    const wethBalance = await wethContract.balanceOf(await proxyGeneral.getAddress());
    console.log(`\n📊 Pool after deposit:`);
    console.log(`   WETH: ${ethers.formatEther(wethBalance)} WETH`);
  });

  it("Should automatically swap USDC/WBTC when user withdraws all LP", async function () {
    console.log("\n🔄 USER WITHDRAWS - TESTING AUTOMATIC SWAP...");
    
    const lpBalance = await proxyGeneral.balanceOf(await user1.getAddress());
    console.log(`   User LP balance: ${ethers.formatEther(lpBalance)} LP`);

    // Simula WETH già allocato a un protocollo: il withdraw deve quindi
    // convertire gli altri asset custoditi invece di usare il WETH depositato.
    const proxyAddress = await proxyGeneral.getAddress();
    await ethers.provider.send("hardhat_setBalance", [proxyAddress, ethers.toQuantity(ethers.parseEther("1"))]);
    await ethers.provider.send("hardhat_impersonateAccount", [proxyAddress]);
    const proxySigner = await ethers.getSigner(proxyAddress);
    const proxyWeth = await ethers.getContractAt("IERC20", ARBITRUM_WETH);
    const allocatedWeth = await proxyWeth.balanceOf(proxyAddress);
    await proxyWeth.connect(proxySigner).transfer(await owner.getAddress(), allocatedWeth);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [proxyAddress]);
    
    // Get balances before withdrawal
    const wethContract = await ethers.getContractAt("IERC20", ARBITRUM_WETH);
    const usdcContract = await ethers.getContractAt("IERC20", ARBITRUM_USDC);
    const wbtcContract = await ethers.getContractAt("IERC20", ARBITRUM_WBTC);
    
    const wethBefore = await wethContract.balanceOf(await proxyGeneral.getAddress());
    const usdcBefore = await usdcContract.balanceOf(await proxyGeneral.getAddress());
    const wbtcBefore = await wbtcContract.balanceOf(await proxyGeneral.getAddress());
    
    console.log(`\n📊 Pool before withdrawal:`);
    console.log(`   WETH: ${ethers.formatEther(wethBefore)} WETH`);
    console.log(`   USDC: ${ethers.formatUnits(usdcBefore, 6)} USDC`);
    console.log(`   WBTC: ${ethers.formatUnits(wbtcBefore, 8)} WBTC`);
    
    // Calculate expected withdrawal
    const totalSupply = await proxyGeneral.totalSupply();
    const totalValue = await valueCalculator.getTotalPoolValueView();
    const expectedEth = (lpBalance * totalValue) / totalSupply;
    
    console.log(`\n💰 Expected withdrawal:`);
    console.log(`   Value: ${ethers.formatEther(expectedEth)} ETH`);
    console.log(`   Available WETH: ${ethers.formatEther(wethBefore)} WETH`);
    console.log(`   NEEDS SWAP: ${wethBefore < expectedEth ? "YES ✅" : "NO"}`);
    
    await delay(2000);
    
    // Execute withdrawal
    const userWethBefore = await wethContract.balanceOf(await user1.getAddress());
    
    console.log(`\n⏳ Executing withdrawal...`);
    
    const tx = await liquidityManager.connect(user1).withdraw(
      lpBalance,
      { gasLimit: 5000000 }
    );
    const receipt = await tx.wait();
    
    await delay(1000);
    
    const userWethAfter = await wethContract.balanceOf(await user1.getAddress());
    const wethReceived = userWethAfter - userWethBefore;
    
    console.log(`\n✅ WITHDRAWAL COMPLETED:`);
    console.log(`   WETH received: ${ethers.formatEther(wethReceived)} WETH`);
    console.log(`   Gas used: ${receipt!.gasUsed.toLocaleString()}`);
    
    // Check for swap events
    const automaticSwapEvent = receipt!.logs.find((log: any) => {
      try {
        const parsed = liquidityManager.interface.parseLog({ 
          topics: log.topics, 
          data: log.data 
        });
        return parsed?.name === "AutomaticSwapTriggered";
      } catch { return false; }
    });
    
    if (automaticSwapEvent) {
      const parsed = liquidityManager.interface.parseLog({
        topics: automaticSwapEvent.topics,
        data: automaticSwapEvent.data
      });
      console.log(`\n🔄 AUTOMATIC SWAP DETECTED:`);
      console.log(`   Token swapped: ${parsed?.args.tokenToSwap}`);
      console.log(`   Amount: ${parsed?.args.tokenToSwap === "USDC" ? 
        ethers.formatUnits(parsed?.args.amountToSwap, 6) : 
        ethers.formatUnits(parsed?.args.amountToSwap, 8)}`);
      console.log(`   WETH needed: ${ethers.formatEther(parsed?.args.baseAssetNeeded)} WETH`);
    }
    
    // Check balances after withdrawal
    const wethAfter = await wethContract.balanceOf(await proxyGeneral.getAddress());
    const usdcAfter = await usdcContract.balanceOf(await proxyGeneral.getAddress());
    const wbtcAfter = await wbtcContract.balanceOf(await proxyGeneral.getAddress());
    
    console.log(`\n📊 Pool after withdrawal:`);
    console.log(`   WETH: ${ethers.formatEther(wethAfter)} WETH`);
    console.log(`   USDC: ${ethers.formatUnits(usdcAfter, 6)} USDC`);
    console.log(`   WBTC: ${ethers.formatUnits(wbtcAfter, 8)} WBTC`);
    
    // Verify swap occurred
    const usdcUsed = usdcBefore - usdcAfter;
    const wbtcUsed = wbtcBefore - wbtcAfter;
    
    console.log(`\n💱 TOKENS SWAPPED:`);
    console.log(`   USDC: ${ethers.formatUnits(usdcUsed, 6)} USDC`);
    console.log(`   WBTC: ${ethers.formatUnits(wbtcUsed, 8)} WBTC`);
    
    if (wethBefore < expectedEth) {
      expect(usdcUsed > 0n || wbtcUsed > 0n).to.be.true;
      console.log(`\n✅ VERIFICATION PASSED: Automatic swap executed successfully`);
    } else {
      console.log(`\nℹ️  No swap needed (sufficient WETH available)`);
    }
    
    expect(wethReceived).to.be.gt(0);
  });
});
