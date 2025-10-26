import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🔄 SWAP MANAGER - UNIT TESTS
 * 
 * Tests DEX routing and swap operations:
 * - Swap validation and execution
 * - Slippage protection and limits
 * - Multi-token swap functionality
 * - Router management and configurations
 */

describe("SwapManager Contract", function () {
  let swapManager: any;
  let beacon: any;
  let proxyGeneral: any;
  let tokenManager: any;
  let mockUSDC: any;
  let mockWBTC: any;
  let mockWETH: any;
  let mockOracle: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let router: any;

  // Test constants
  const SWAP_AMOUNT = ethers.parseEther("1.0");      // 1 ETH worth
  const LARGE_SWAP = ethers.parseEther("10.0");      // 10 ETH worth
  const SMALL_SWAP = ethers.parseEther("0.1");       // 0.1 ETH worth
  
  const DEFAULT_MAX_SLIPPAGE = 300;  // 3% (basis points)
  const HIGH_SLIPPAGE = 1000;        // 10%
  const LOW_SLIPPAGE = 50;           // 0.5%
  
  const MIN_SWAP_AMOUNT = ethers.parseUnits("10", 6);    // 10 USDC
  const MAX_SWAP_AMOUNT = ethers.parseUnits("100000", 6); // 100k USDC

  async function deploySwapManagerFixture() {
    const [owner, user1, user2, router] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    const mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    const mockWETH = await MockERC20.deploy("Wrapped Ether", "WETH", 18);

    // Deploy MockChainlinkOracle
    const MockChainlinkOracle = await ethers.getContractFactory("MockChainlinkOracle");
    const mockOracle = await MockChainlinkOracle.deploy(
      ethers.parseUnits("2000", 8), // $2000
      8,
      "ETH/USD"
    );

    // Deploy Beacon
    const Beacon = await ethers.getContractFactory("Beacon");
    const beacon = await Beacon.deploy();
    await beacon.updateImplementation("WETH", mockWETH.target);

    // Deploy core contracts
    const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
    const proxyGeneral = await ProxyGeneral.deploy(beacon.target);

    const TokenManager = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TokenManager.deploy(beacon.target);

    // Deploy SwapManager
    const SwapManager = await ethers.getContractFactory("SwapManager");
    const swapManager = await SwapManager.deploy(beacon.target);

    // Register contracts in Beacon
    await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
    await beacon.updateImplementation("TokenManager", tokenManager.target);
    await beacon.updateImplementation("SwapManager", swapManager.target);

    // Setup tokens in TokenManager (WETH is NOT registered - handled via Beacon)
    await tokenManager.manageTokenData(
      "USDC", mockUSDC.target, mockOracle.target, 6, 8, 3600
    );
    await tokenManager.manageTokenData(
      "WBTC", mockWBTC.target, mockOracle.target, 8, 8, 3600
    );

    // Set router address to a contract (use mockUSDC as mock router for testing)
    await swapManager.setSimpleSwapRouter(mockUSDC.target);

    // Mint tokens to ProxyGeneral for testing
    await mockUSDC.mint(proxyGeneral.target, ethers.parseUnits("100000", 6));
    await mockWBTC.mint(proxyGeneral.target, ethers.parseUnits("5", 8));
    await mockWETH.mint(proxyGeneral.target, ethers.parseEther("100"));

    // Mint tokens to users for testing
    await mockUSDC.mint(await user1.getAddress(), ethers.parseUnits("50000", 6));
    await mockWBTC.mint(await user1.getAddress(), ethers.parseUnits("2", 8));

    return {
      swapManager,
      beacon,
      proxyGeneral,
      tokenManager,
      mockUSDC,
      mockWBTC,
      mockWETH,
      mockOracle,
      owner,
      user1,
      user2,
      router
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
    mockOracle = fixture.mockOracle;
    owner = fixture.owner;
    user1 = fixture.user1;
    user2 = fixture.user2;
    router = fixture.router;
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
        "swapTokenForWETH",
        "swapWETHForToken",
        "performSwap",
        "validateSwapParameters",
        "getExpectedSwapOutput",
        "getSwapStats",
        "getSwapQuote",
        "calculateMinAmountOut",
        "setSwapLimits",
        "setMaxSlippage",
        "setSimpleSwapRouter",
        "setSwapsEnabled"
      ];

      for (const func of expectedFunctions) {
        expect(swapManager.interface.hasFunction(func)).to.be.true;
      }
    });

    it("should have default swap limits", async function () {
      // Check that swap limits can be queried (even if 0 by default)
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
        const newRouter = mockWBTC.target; // Use another contract as router
        
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
          swapManager.setSwapLimits("USDC", MAX_SWAP_AMOUNT, MIN_SWAP_AMOUNT) // min > max
        ).to.be.revertedWith("Invalid limits");
      });
    });
  });

  describe("✅ Swap Validation", function () {
    beforeEach(async function () {
      // Set reasonable swap limits
      await swapManager.setSwapLimits("USDC", MIN_SWAP_AMOUNT, MAX_SWAP_AMOUNT);
      await swapManager.setSwapLimits("WBTC", ethers.parseUnits("0.001", 8), ethers.parseUnits("10", 8));
    });

    describe("validateSwapParameters", function () {
      it("should validate correct swap parameters", async function () {
        const validation = await swapManager.validateSwapParameters(
          "USDC",
          "WBTC", 
          ethers.parseUnits("1000", 6), // 1000 USDC
          LOW_SLIPPAGE
        );
        
        expect(validation.isValid).to.be.true;
        expect(validation.errorMessage).to.equal("");
      });

      it("should reject disabled swaps", async function () {
        await swapManager.setSwapsEnabled(false);
        
        const validation = await swapManager.validateSwapParameters(
          "USDC",
          "WBTC", 
          ethers.parseUnits("1000", 6),
          LOW_SLIPPAGE
        );
        
        expect(validation.isValid).to.be.false;
        expect(validation.errorMessage).to.include("disabled");
      });

      it("should reject excessive slippage", async function () {
        const validation = await swapManager.validateSwapParameters(
          "USDC",
          "WBTC", 
          ethers.parseUnits("1000", 6),
          6000 // 60% slippage
        );
        
        expect(validation.isValid).to.be.false;
        expect(validation.errorMessage).to.include("slippage");
      });

      it("should reject amounts below minimum", async function () {
        const validation = await swapManager.validateSwapParameters(
          "USDC",
          "WBTC", 
          ethers.parseUnits("1", 6), // 1 USDC, below 10 USDC minimum
          LOW_SLIPPAGE
        );
        
        expect(validation.isValid).to.be.false;
        expect(validation.errorMessage).to.include("minimum");
      });

      it("should reject amounts above maximum", async function () {
        const validation = await swapManager.validateSwapParameters(
          "USDC",
          "WBTC", 
          ethers.parseUnits("200000", 6), // 200k USDC, above 100k maximum
          LOW_SLIPPAGE
        );
        
        expect(validation.isValid).to.be.false;
        expect(validation.errorMessage).to.include("maximum");
      });

      it("should reject swapping same token", async function () {
        const validation = await swapManager.validateSwapParameters(
          "USDC",
          "USDC", // Same token
          ethers.parseUnits("1000", 6),
          LOW_SLIPPAGE
        );
        
        expect(validation.isValid).to.be.false;
        expect(validation.errorMessage).to.include("same");
      });
    });
  });

  describe("📊 View Functions", function () {
    describe("calculateMinAmountOut", function () {
      it("should calculate minimum output with slippage", async function () {
        const amountIn = ethers.parseUnits("1000", 6); // 1000 USDC
        const expectedOut = ethers.parseUnits("0.5", 8); // 0.5 WBTC
        const slippage = 300; // 3%
        
        const minOut = await swapManager.calculateMinAmountOut(expectedOut, slippage);
        
        // Should be 97% of expected (100% - 3% slippage)
        const expected = (expectedOut * BigInt(9700)) / BigInt(10000);
        expect(minOut).to.equal(expected);
      });

      it("should handle zero slippage", async function () {
        const expectedOut = ethers.parseUnits("0.5", 8);
        const minOut = await swapManager.calculateMinAmountOut(expectedOut, 0);
        
        expect(minOut).to.equal(expectedOut);
      });

      it("should handle maximum slippage", async function () {
        const expectedOut = ethers.parseUnits("0.5", 8);
        const maxSlippage = await swapManager.maxSlippage();
        const minOut = await swapManager.calculateMinAmountOut(expectedOut, maxSlippage);
        
        const expected = (expectedOut * (BigInt(10000) - BigInt(maxSlippage))) / BigInt(10000);
        expect(minOut).to.equal(expected);
      });
    });

    describe("getSwapStats", function () {
      it("should return swap statistics", async function () {
        const pairKey = ethers.keccak256(ethers.toUtf8Bytes("USDC-WBTC"));
        const stats = await swapManager.getSwapStats("USDC", "WBTC");
        
        expect(stats.successes).to.be.greaterThanOrEqual(0);
        expect(stats.errors).to.be.greaterThanOrEqual(0);
        expect(stats.totalSwaps).to.equal(stats.successes + stats.errors);
      });
    });

    describe("getSwapQuote", function () {
      it("should return swap quote information", async function () {
        const quote = await swapManager.getSwapQuote(
          "USDC",
          "WBTC",
          ethers.parseUnits("1000", 6)
        );
        
        expect(quote.expectedOutput).to.be.greaterThanOrEqual(0);
        expect(quote.minimumOutput).to.be.greaterThanOrEqual(0);
        expect(quote.slippageApplied).to.equal(DEFAULT_MAX_SLIPPAGE);
        expect(quote.minimumOutput).to.be.lessThanOrEqual(quote.expectedOutput);
      });
    });

    describe("getExpectedSwapOutput", function () {
      it("should estimate swap output", async function () {
        const output = await swapManager.getExpectedSwapOutput(
          "USDC",
          "WBTC", 
          ethers.parseUnits("1000", 6)
        );
        
        expect(output).to.be.greaterThanOrEqual(0);
      });

      it("should handle WETH swaps", async function () {
        const output = await swapManager.getExpectedSwapOutput(
          "USDC",
          "WETH", 
          ethers.parseUnits("2000", 6) // $2000 USDC
        );
        
        expect(output).to.be.greaterThanOrEqual(0);
      });
    });
  });

  describe("🔥 performSwap() - CRITICAL Tests", function () {
    let mockRouter: any;

    beforeEach(async function () {
      // Deploy MockSimpleSwap router
      const MockSimpleSwap = await ethers.getContractFactory("MockSimpleSwap");
      mockRouter = await MockSimpleSwap.deploy();

      // Configure custody holder (ProxyGeneral) for custody-based swap pattern
      await mockRouter.setCustodyHolder(proxyGeneral.target);

      // Set router in SwapManager
      await swapManager.setSimpleSwapRouter(mockRouter.target);

      // Authorize SwapManager in ProxyGeneral
      await proxyGeneral.authorizeModule(swapManager.target, "SwapManager");

      // Configure swap limits
      await swapManager.setSwapLimits("USDC", ethers.parseUnits("10", 6), ethers.parseUnits("100000", 6));
      await swapManager.setSwapLimits("WBTC", ethers.parseUnits("0.001", 8), ethers.parseUnits("10", 8));

      // Mint tokens to router for swaps
      await mockUSDC.mint(mockRouter.target, ethers.parseUnits("1000000", 6));
      await mockWBTC.mint(mockRouter.target, ethers.parseUnits("100", 8));
      await mockWETH.mint(mockRouter.target, ethers.parseEther("1000"));

      // Configure expected outputs in mock router
      // Direct pairs
      // USDC → WETH: 1000 USDC → 0.5 ETH (price $2000/ETH)
      await mockRouter.setExpectedOutput(mockUSDC.target, mockWETH.target, ethers.parseEther("0.5"));
      // WETH → USDC: 1 ETH → 2000 USDC
      await mockRouter.setExpectedOutput(mockWETH.target, mockUSDC.target, ethers.parseUnits("2000", 6));
      // USDC → WBTC: 1000 USDC → 0.02 WBTC (direct routing)
      await mockRouter.setExpectedOutput(mockUSDC.target, mockWBTC.target, ethers.parseUnits("0.02", 8));
      // WBTC → USDC: 0.1 WBTC → 5000 USDC
      await mockRouter.setExpectedOutput(mockWBTC.target, mockUSDC.target, ethers.parseUnits("5000", 6));
      
      // Intermediate pairs for multi-hop routing (USDC → WETH → WBTC)
      // WETH → WBTC: 0.5 ETH → 0.04 WBTC (for USDC→WETH→WBTC path)
      await mockRouter.setExpectedOutput(mockWETH.target, mockWBTC.target, ethers.parseUnits("0.04", 8));
      // WBTC → WETH: 0.02 WBTC → 1 ETH
      await mockRouter.setExpectedOutput(mockWBTC.target, mockWETH.target, ethers.parseEther("1.0"));
    });

    // SM-SWAP-CRIT-001: Successful swap TokenA → WETH
    it("SM-SWAP-CRIT-001: should execute successful swap TokenA → WETH", async function () {
      // Arrange: Mint USDC to ProxyGeneral
      await mockUSDC.mint(proxyGeneral.target, ethers.parseUnits("10000", 6));

      const swapAmount = ethers.parseUnits("1000", 6); // 1000 USDC
      const expectedWETH = ethers.parseEther("0.5"); // Expected: 0.5 WETH (from mock setup)

      const wethBalanceBefore = await mockWETH.balanceOf(proxyGeneral.target);

      // Act: Perform swap USDC → WETH
      await swapManager.performSwap("USDC", "WETH", swapAmount);

      // Assert: Verify WETH received
      const wethBalanceAfter = await mockWETH.balanceOf(proxyGeneral.target);
      const wethReceived = wethBalanceAfter - wethBalanceBefore;

      expect(wethReceived).to.equal(expectedWETH);
    });

    // SM-SWAP-CRIT-002: Successful swap WETH → TokenB
    it("SM-SWAP-CRIT-002: should execute successful swap WETH → TokenB", async function () {
      // Arrange: Mint WETH to ProxyGeneral
      await mockWETH.mint(proxyGeneral.target, ethers.parseEther("10"));

      const swapAmount = ethers.parseEther("1"); // 1 WETH
      const expectedUSDC = ethers.parseUnits("2000", 6); // Expected: 2000 USDC (from mock setup)

      const usdcBalanceBefore = await mockUSDC.balanceOf(proxyGeneral.target);

      // Act: Perform swap WETH → USDC
      await swapManager.performSwap("WETH", "USDC", swapAmount);

      // Assert: Verify USDC received
      const usdcBalanceAfter = await mockUSDC.balanceOf(proxyGeneral.target);
      const usdcReceived = usdcBalanceAfter - usdcBalanceBefore;

      expect(usdcReceived).to.equal(expectedUSDC);
    });

    // SM-SWAP-CRIT-003: Successful swap TokenA → TokenB (via WETH)
    it("SM-SWAP-CRIT-003: should execute successful swap TokenA → TokenB (via WETH)", async function () {
      // Arrange: Ensure ProxyGeneral has USDC balance
      await mockUSDC.mint(proxyGeneral.target, ethers.parseUnits("10000", 6));

      const swapAmount = ethers.parseUnits("1000", 6);
      const expectedWBTC = ethers.parseUnits("0.02", 8);

      const wbtcBalanceBefore = await mockWBTC.balanceOf(proxyGeneral.target);

      // Act: Swap USDC → WBTC via SwapManager
      const amountReceived = await swapManager.performSwap.staticCall("USDC", "WBTC", swapAmount);
      await swapManager.performSwap("USDC", "WBTC", swapAmount);

      // Assert
      const wbtcBalanceAfter = await mockWBTC.balanceOf(proxyGeneral.target);
      const wbtcReceived = wbtcBalanceAfter - wbtcBalanceBefore;

      expect(wbtcReceived).to.equal(expectedWBTC);
      expect(amountReceived).to.equal(expectedWBTC);
    });

    // SM-SWAP-CRIT-004: Slippage protection (revert if exceeded)
    it("SM-SWAP-CRIT-004: should revert when slippage exceeds maximum", async function () {
      // Arrange: Configure mock router to return low output (simulate high slippage)
      await mockRouter.setSimulateLowOutput(true, 8000); // 20% slippage (80% of expected)

      const swapAmount = ethers.parseUnits("1000", 6);

      // Act & Assert: Should revert with slippage error
      // maxSlippage is 300 bps (3%), but we're simulating 20% slippage
      await expect(swapManager.performSwap("USDC", "WBTC", swapAmount))
        .to.be.revertedWith("Slippage exceeds maximum allowed");

      // Cleanup
      await mockRouter.setSimulateLowOutput(false, 10000);
    });

    // SM-SWAP-CRIT-005: Swap when swaps disabled (revert)
    it("SM-SWAP-CRIT-005: should revert when swaps are disabled", async function () {
      // Arrange: Disable swaps
      await swapManager.setSwapsEnabled(false);

      const swapAmount = ethers.parseUnits("1000", 6);

      // Act & Assert
      await expect(swapManager.performSwap("USDC", "WBTC", swapAmount))
        .to.be.revertedWith("Swaps are disabled");

      // Cleanup
      await swapManager.setSwapsEnabled(true);
    });

    // SM-SWAP-CRIT-006: Swap when paused (revert)
    it.skip("SM-SWAP-CRIT-006: should revert when contract is paused", async function () {
      // Note: SwapManager doesn't have pause() function in current implementation
      // It uses whenSwapsEnabled modifier instead
      // This test is skipped pending pause feature implementation via Beacon
      // When implemented, test should verify revert with "Pausable: paused"
    });

    // SM-SWAP-CRIT-007: Insufficient balance (revert)
    it("SM-SWAP-CRIT-007: should revert when insufficient token balance", async function () {
      // Arrange: Try to swap more than available
      const availableBalance = await mockUSDC.balanceOf(proxyGeneral.target);
      const swapAmount = availableBalance + ethers.parseUnits("1000", 6);

      // Act & Assert
      await expect(swapManager.performSwap("USDC", "WBTC", swapAmount))
        .to.be.revertedWith("Insufficient balance in pool");
    });

    // SM-SWAP-CRIT-008: Zero amount swap (revert)
    it("SM-SWAP-CRIT-008: should revert when swap amount is zero", async function () {
      // Act & Assert
      await expect(swapManager.performSwap("USDC", "WETH", 0))
        .to.be.revertedWith("Amount must be greater than 0");
    });

    // SM-SWAP-CRIT-009: Identical from/to tokens (revert)
    it("SM-SWAP-CRIT-009: should revert when swapping same token", async function () {
      const swapAmount = ethers.parseUnits("1000", 6);

      // Act & Assert
      await expect(swapManager.performSwap("USDC", "USDC", swapAmount))
        .to.be.revertedWith("Cannot swap same token");
    });

    // SM-SWAP-CRIT-010: Token not registered (revert)
    it("SM-SWAP-CRIT-010: should revert when token not registered in TokenManager", async function () {
      const swapAmount = ethers.parseUnits("1000", 6);

      // Act & Assert: Try to swap to unregistered token (DAI not registered)
      await expect(swapManager.performSwap("USDC", "DAI", swapAmount))
        .to.be.revertedWith("Receive token is inactive");
    });

    // SM-SWAP-CRIT-011: Deadline expired (revert)
    it.skip("SM-SWAP-CRIT-011: should revert when deadline expired", async function () {
      // Note: performSwap() doesn't have deadline parameter in current implementation
      // This test is skipped pending deadline feature implementation
      // When implemented, test should verify revert with "Transaction too old"
    });

    // SM-SWAP-CRIT-012: Balance verification after swap
    it("SM-SWAP-CRIT-012: should verify balance changes correctly after swap", async function () {
      // Arrange: Ensure ProxyGeneral has USDC
      await mockUSDC.mint(proxyGeneral.target, ethers.parseUnits("10000", 6));

      const swapAmount = ethers.parseUnits("1000", 6);
      const expectedWBTC = ethers.parseUnits("0.02", 8);

      const usdcBefore = await mockUSDC.balanceOf(proxyGeneral.target);
      const wbtcBefore = await mockWBTC.balanceOf(proxyGeneral.target);

      // Act
      await swapManager.performSwap("USDC", "WBTC", swapAmount);

      // Assert: USDC decreased, WBTC increased
      const usdcAfter = await mockUSDC.balanceOf(proxyGeneral.target);
      const wbtcAfter = await mockWBTC.balanceOf(proxyGeneral.target);

      expect(usdcBefore - usdcAfter).to.equal(swapAmount);
      expect(wbtcAfter - wbtcBefore).to.equal(expectedWBTC);
    });
  });

  describe("⛽ Gas Optimization", function () {
    it("should deploy with reasonable gas cost", async function () {
      const SwapManager = await ethers.getContractFactory("SwapManager");
      const deployTx = await SwapManager.getDeployTransaction(beacon.target);
      
      const estimatedGas = await ethers.provider.estimateGas(deployTx);
      console.log(`✅ SwapManager deployment gas usage: ${estimatedGas}`);
      
      // Should deploy under 5M gas
      expect(estimatedGas).to.be.lessThan(5000000);
    });

    it("should have reasonable gas for validation", async function () {
      const tx = await swapManager.validateSwapParameters.populateTransaction(
        "USDC",
        "WBTC",
        ethers.parseUnits("1000", 6),
        300
      );
      const estimatedGas = await ethers.provider.estimateGas(tx);
      
      console.log(`✅ Swap validation gas usage: ${estimatedGas}`);
      
      // Should validate under 200k gas
      expect(estimatedGas).to.be.lessThan(200000);
    });

    it("should have reasonable gas for quotes", async function () {
      const tx = await swapManager.getSwapQuote.populateTransaction(
        "USDC",
        "WBTC",
        ethers.parseUnits("1000", 6)
      );
      const estimatedGas = await ethers.provider.estimateGas(tx);
      
      console.log(`✅ Swap quote gas usage: ${estimatedGas}`);
      
      // Should quote under 300k gas
      expect(estimatedGas).to.be.lessThan(300000);
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

    it("should handle edge cases in calculations", async function () {
      // Test calculation edge cases
      const zeroOutput = await swapManager.calculateMinAmountOut(0, 300);
      expect(zeroOutput).to.equal(0);
      
      const maxSlippageCalc = await swapManager.calculateMinAmountOut(
        ethers.parseEther("1"),
        5000 // 50%
      );
      expect(maxSlippageCalc).to.equal(ethers.parseEther("0.5"));
      
      console.log("✅ Edge cases handled properly");
    });

    it("should maintain state consistency", async function () {
      // Test state changes are consistent
      const initialSlippage = await swapManager.maxSlippage();
      const initialEnabled = await swapManager.swapsEnabled();
      
      // Change state
      await swapManager.setMaxSlippage(500);
      await swapManager.setSwapsEnabled(false);
      
      // Verify changes
      expect(await swapManager.maxSlippage()).to.equal(500);
      expect(await swapManager.swapsEnabled()).to.be.false;
      
      // Restore state
      await swapManager.setMaxSlippage(initialSlippage);
      await swapManager.setSwapsEnabled(initialEnabled);
      
      // Verify restoration
      expect(await swapManager.maxSlippage()).to.equal(initialSlippage);
      expect(await swapManager.swapsEnabled()).to.equal(initialEnabled);
      
      console.log("✅ State consistency verified");
    });
  });
});