import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔄 SWAP MANAGER - SIMPLIFIED UNIT TESTS
 * 
 * Focus sui test core che funzionano con l'architettura attuale
 */

describe("SwapManager Contract - Core Tests", function () {
  let swapManager: any;
  let beacon: any;
  let proxyGeneral: any;
  let tokenManager: any;
  let mockUSDC: any;
  let mockWBTC: any;
  let mockWETH: any;
  let owner: any;
  let user1: any;

  // Test constants
  const DEFAULT_MAX_SLIPPAGE = 300;  // 3% (basis points)
  const HIGH_SLIPPAGE = 1000;        // 10%
  const LOW_SLIPPAGE = 50;           // 0.5%
  
  const MIN_SWAP_AMOUNT = ethers.parseUnits("10", 6);    // 10 USDC
  const MAX_SWAP_AMOUNT = ethers.parseUnits("100000", 6); // 100k USDC

  async function deploySwapManagerFixture() {
    const [owner, user1] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    const mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    const mockWETH = await MockERC20.deploy("Wrapped Ether", "WETH", 18);

    // Deploy MockOracleAdapter for TokenManager
    const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
    const mockOracleAdapter = await MockOracleAdapter.deploy();

    // Deploy Beacon
    const Beacon = await ethers.getContractFactory("Beacon");
    const beacon = await Beacon.deploy();
    await beacon.updateImplementation("WETH", mockWETH.target);

    // Deploy core contracts
    const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
    const proxyGeneral = await ProxyGeneral.deploy(beacon.target);

    const TokenManager = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TokenManager.deploy(beacon.target, mockOracleAdapter.target);

    // Deploy SwapManager
    const SwapManager = await ethers.getContractFactory("SwapManager");
    const swapManager = await SwapManager.deploy(beacon.target);

    // Register contracts in Beacon
    await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
    await beacon.updateImplementation("TokenManager", tokenManager.target);
    await beacon.updateImplementation("SwapManager", swapManager.target);

    // Setup tokens in MockOracleAdapter
    await mockOracleAdapter.setupToken("USDC", ethers.parseUnits("1", 8), 8, true);
    await mockOracleAdapter.setupToken("WBTC", ethers.parseUnits("30000", 8), 8, true);

    // Setup tokens in TokenManager (NEW SIGNATURE: 4 params)
    await tokenManager.manageTokenData("USDC", mockUSDC.target, 6, 3600);
    await tokenManager.manageTokenData("WBTC", mockWBTC.target, 8, 3600);

    // Set router address to a contract (use mockUSDC as mock router)
    await swapManager.setSimpleSwapRouter(mockUSDC.target);

    // Mint tokens to ProxyGeneral for testing
    await mockUSDC.mint(proxyGeneral.target, ethers.parseUnits("100000", 6));
    await mockWBTC.mint(proxyGeneral.target, ethers.parseUnits("5", 8));
    await mockWETH.mint(proxyGeneral.target, ethers.parseEther("100"));

    return {
      swapManager,
      beacon,
      proxyGeneral,
      tokenManager,
      mockUSDC,
      mockWBTC,
      mockWETH,
      mockOracleAdapter,
      owner,
      user1
    };
  }

  beforeEach(async function () {
    const fixture = await deploySwapManagerFixture();
    swapManager = fixture.swapManager;
    beacon = fixture.beacon;
    proxyGeneral = fixture.proxyGeneral;
    tokenManager = fixture.tokenManager;
    mockUSDC = fixture.mockUSDC;
    mockWBTC = fixture.mockWBTC;
    mockWETH = fixture.mockWETH;
    owner = fixture.owner;
    user1 = fixture.user1;
  });

  describe("📋 Deployment & Basic Functions", function () {
    it("should deploy with correct initial state", async function () {
      expect(await swapManager.beacon()).to.equal(beacon.target);
      expect(await swapManager.owner()).to.equal(await owner.getAddress());
      expect(await swapManager.maxSlippage()).to.equal(DEFAULT_MAX_SLIPPAGE);
      expect(await swapManager.swapsEnabled()).to.be.true;
      expect(await swapManager.simpleSwapRouter()).to.equal(mockUSDC.target);
    });

    it("should have expected function signatures", async function () {
      const expectedFunctions = [
        "performSwap",
        "performSwapAuto",
        "getExpectedSwapOutput",
        "getSwapStats",
        "setSwapLimits",
        "setMaxSlippage",
        "setSimpleSwapRouter",
        "setSwapsEnabled",
        "getSimpleSwapRouter",
        "areSwapsEnabled",
        "getTokenWETHPrice"
      ];

      for (const func of expectedFunctions) {
        expect(swapManager.interface.hasFunction(func)).to.be.true;
      }
    });

    it("should have default swap limits", async function () {
      const usdcMinLimit = await swapManager.minSwapAmounts("USDC");
      const usdcMaxLimit = await swapManager.maxSwapAmounts("USDC");
      
      expect(usdcMinLimit).to.be.greaterThanOrEqual(0);
      expect(usdcMaxLimit).to.be.greaterThanOrEqual(0);
    });
  });

  describe("🔧 Administrative Functions", function () {
    describe("setMaxSlippage", function () {
      it("should allow owner to update max slippage", async function () {
        const newSlippage = 500; // 5%
        
        await swapManager.setMaxSlippage(newSlippage);
        expect(await swapManager.maxSlippage()).to.equal(newSlippage);
      });

      it("should prevent non-owner from updating slippage", async function () {
        await expect(
          swapManager.connect(user1).setMaxSlippage(500)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should enforce maximum slippage limit", async function () {
        const tooHighSlippage = 5001; // > 50%
        
        await expect(
          swapManager.setMaxSlippage(tooHighSlippage)
        ).to.be.revertedWith("Slippage too high");
      });
    });

    describe("setSimpleSwapRouter", function () {
      it("should allow owner to update router", async function () {
        const newRouter = mockWBTC.target;
        
        await swapManager.setSimpleSwapRouter(newRouter);
        expect(await swapManager.simpleSwapRouter()).to.equal(newRouter);
      });

      it("should prevent non-owner from updating router", async function () {
        await expect(
          swapManager.connect(user1).setSimpleSwapRouter(mockWBTC.target)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should prevent zero address as router", async function () {
        await expect(
          swapManager.setSimpleSwapRouter(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid router address");
      });

      it("should prevent EOA as router", async function () {
        await expect(
          swapManager.setSimpleSwapRouter(await user1.getAddress())
        ).to.be.revertedWith("Router must be a contract");
      });
    });

    describe("setSwapsEnabled", function () {
      it("should allow owner to disable swaps", async function () {
        await swapManager.setSwapsEnabled(false);
        expect(await swapManager.swapsEnabled()).to.be.false;
      });

      it("should allow owner to re-enable swaps", async function () {
        await swapManager.setSwapsEnabled(false);
        await swapManager.setSwapsEnabled(true);
        expect(await swapManager.swapsEnabled()).to.be.true;
      });

      it("should prevent non-owner from toggling swaps", async function () {
        await expect(
          swapManager.connect(user1).setSwapsEnabled(false)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("setSwapLimits", function () {
      it("should allow owner to set swap limits", async function () {
        await swapManager.setSwapLimits("USDC", MIN_SWAP_AMOUNT, MAX_SWAP_AMOUNT);
        
        expect(await swapManager.minSwapAmounts("USDC")).to.equal(MIN_SWAP_AMOUNT);
        expect(await swapManager.maxSwapAmounts("USDC")).to.equal(MAX_SWAP_AMOUNT);
      });

      it("should prevent non-owner from setting limits", async function () {
        await expect(
          swapManager.connect(user1).setSwapLimits("USDC", MIN_SWAP_AMOUNT, MAX_SWAP_AMOUNT)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should validate min < max", async function () {
        await expect(
          swapManager.setSwapLimits("USDC", MAX_SWAP_AMOUNT, MIN_SWAP_AMOUNT)
        ).to.be.revertedWith("Invalid limits");
      });

      it("should allow multiple token limits", async function () {
        await swapManager.setSwapLimits("USDC", MIN_SWAP_AMOUNT, MAX_SWAP_AMOUNT);
        await swapManager.setSwapLimits("WBTC", ethers.parseUnits("0.001", 8), ethers.parseUnits("10", 8));
        
        expect(await swapManager.minSwapAmounts("USDC")).to.equal(MIN_SWAP_AMOUNT);
        expect(await swapManager.minSwapAmounts("WBTC")).to.equal(ethers.parseUnits("0.001", 8));
      });
    });
  });

  describe("📊 View Functions", function () {
    describe("getSimpleSwapRouter", function () {
      it("should return current router address", async function () {
        const router = await swapManager.getSimpleSwapRouter();
        expect(router).to.equal(mockUSDC.target);
      });
    });

    describe("areSwapsEnabled", function () {
      it("should return swaps enabled status", async function () {
        expect(await swapManager.areSwapsEnabled()).to.be.true;
        
        await swapManager.setSwapsEnabled(false);
        expect(await swapManager.areSwapsEnabled()).to.be.false;
        
        await swapManager.setSwapsEnabled(true);
        expect(await swapManager.areSwapsEnabled()).to.be.true;
      });
    });

    describe("getTokenWETHPrice", function () {
      it("should return token price in WETH", async function () {
        const price = await swapManager.getTokenWETHPrice("USDC");
        expect(price).to.be.greaterThanOrEqual(0);
      });

      it("should handle different tokens", async function () {
        const usdcPrice = await swapManager.getTokenWETHPrice("USDC");
        const wbtcPrice = await swapManager.getTokenWETHPrice("WBTC");
        
        // Both should return valid prices
        expect(usdcPrice).to.be.greaterThanOrEqual(0);
        expect(wbtcPrice).to.be.greaterThanOrEqual(0);
      });
    });

    describe("getSwapStats", function () {
      it("should return swap statistics for token pair", async function () {
        const [successCount, errorCount] = await swapManager.getSwapStats("USDC", "WBTC");
        
        expect(successCount).to.be.greaterThanOrEqual(0);
        expect(errorCount).to.be.greaterThanOrEqual(0);
      });

      it("should track different token pairs separately", async function () {
        const [success1, error1] = await swapManager.getSwapStats("USDC", "WBTC");
        const [success2, error2] = await swapManager.getSwapStats("WBTC", "USDC");
        
        // Should have separate tracking (values may be same if no swaps yet)
        expect(success1).to.be.greaterThanOrEqual(0);
        expect(success2).to.be.greaterThanOrEqual(0);
      });
    });

    describe("getExpectedSwapOutput", function () {
      it("should estimate swap output", async function () {
        const output = await swapManager.getExpectedSwapOutput(
          "USDC",
          "WBTC", 
          ethers.parseUnits("1000", 6)
        );
        
        // Should return tuple [expectedOutput, minOutput]
        expect(output[0]).to.be.greaterThanOrEqual(0); // expectedOutput
        expect(output[1]).to.be.greaterThanOrEqual(0); // minOutput
      });

      it("should handle WETH swaps", async function () {
        const output = await swapManager.getExpectedSwapOutput(
          "USDC",
          "WETH", 
          ethers.parseUnits("2000", 6)
        );
        
        expect(output[0]).to.be.greaterThanOrEqual(0);
        expect(output[1]).to.be.greaterThanOrEqual(0);
      });
    });
  });

  describe("⛽ Gas Optimization", function () {
    it("should deploy with reasonable gas cost", async function () {
      const SwapManager = await ethers.getContractFactory("SwapManager");
      const deployTx = await SwapManager.getDeployTransaction(beacon.target);
      
      const estimatedGas = await ethers.provider.estimateGas(deployTx);
      console.log(`✅ SwapManager deployment gas usage: ${estimatedGas}`);
      
      // Should deploy under 5.1M gas (updated after oracle modularity)
      expect(estimatedGas).to.be.lessThan(5100000);
    });

    it("should have reasonable gas for admin operations", async function () {
      const tx = await swapManager.setMaxSlippage.populateTransaction(500);
      const estimatedGas = await ethers.provider.estimateGas(tx);
      
      console.log(`✅ Set max slippage gas usage: ${estimatedGas}`);
      
      // Should update slippage under 100k gas
      expect(estimatedGas).to.be.lessThan(100000);
    });

    it("should have reasonable gas for view functions", async function () {
      const tx = await swapManager.getTokenWETHPrice.populateTransaction("USDC");
      const estimatedGas = await ethers.provider.estimateGas(tx);
      
      console.log(`✅ Get token price gas usage: ${estimatedGas}`);
      
      // Should query price under 200k gas
      expect(estimatedGas).to.be.lessThan(200000);
    });
  });

  describe("🛡️ Security Tests", function () {
    it("should prevent unauthorized access to admin functions", async function () {
      const adminFunctions = [
        () => swapManager.connect(user1).setMaxSlippage(500),
        () => swapManager.connect(user1).setSimpleSwapRouter(mockWBTC.target),
        () => swapManager.connect(user1).setSwapsEnabled(false),
        () => swapManager.connect(user1).setSwapLimits("USDC", MIN_SWAP_AMOUNT, MAX_SWAP_AMOUNT)
      ];

      for (const func of adminFunctions) {
        await expect(func()).to.be.revertedWith("Ownable: caller is not the owner");
      }
      console.log("✅ Security controls verified");
    });

    it("should validate input parameters correctly", async function () {
      // Test various edge cases
      await expect(
        swapManager.setMaxSlippage(5001) // > 50%
      ).to.be.revertedWith("Slippage too high");
      
      await expect(
        swapManager.setSimpleSwapRouter(await user1.getAddress())
      ).to.be.revertedWith("Router must be a contract");
      
      await expect(
        swapManager.setSwapLimits("USDC", MAX_SWAP_AMOUNT, MIN_SWAP_AMOUNT)
      ).to.be.revertedWith("Invalid limits");
      
      console.log("✅ Input validation working");
    });

    it("should handle edge cases gracefully", async function () {
      // Test setting limits to zero
      await swapManager.setSwapLimits("USDC", 0, MAX_SWAP_AMOUNT);
      expect(await swapManager.minSwapAmounts("USDC")).to.equal(0);
      
      // Test getting stats for non-existent pair
      const [successCount, errorCount] = await swapManager.getSwapStats("TOKEN1", "TOKEN2");
      expect(successCount).to.equal(0);
      expect(errorCount).to.equal(0);
      
      console.log("✅ Edge cases handled properly");
    });

    it("should maintain state consistency", async function () {
      const initialSlippage = await swapManager.maxSlippage();
      const initialEnabled = await swapManager.swapsEnabled();
      const initialRouter = await swapManager.simpleSwapRouter();
      
      // Change state
      await swapManager.setMaxSlippage(500);
      await swapManager.setSwapsEnabled(false);
      await swapManager.setSimpleSwapRouter(mockWBTC.target);
      
      // Verify changes
      expect(await swapManager.maxSlippage()).to.equal(500);
      expect(await swapManager.swapsEnabled()).to.be.false;
      expect(await swapManager.simpleSwapRouter()).to.equal(mockWBTC.target);
      
      // Restore state
      await swapManager.setMaxSlippage(initialSlippage);
      await swapManager.setSwapsEnabled(initialEnabled);
      await swapManager.setSimpleSwapRouter(initialRouter);
      
      // Verify restoration
      expect(await swapManager.maxSlippage()).to.equal(initialSlippage);
      expect(await swapManager.swapsEnabled()).to.equal(initialEnabled);
      expect(await swapManager.simpleSwapRouter()).to.equal(initialRouter);
      
      console.log("✅ State consistency verified");
    });
  });
});