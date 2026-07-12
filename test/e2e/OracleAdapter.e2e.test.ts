import { expect } from "chai";
import { ethers } from "hardhat";
import {
  Beacon,
  TokenManager,
  ChainlinkAdapter,
  MockOracleAdapter,
  MockChainlinkOracle,
  MockERC20,
  MockLINK
} from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * 🎬 ORACLE ADAPTER - END-TO-END TESTS
 * 
 * Complete user flow simulations with oracle modularity:
 * - Multi-user portfolio price queries
 * - Price changes during active sessions
 * - Oracle upgrades during operations
 * - Token management lifecycle
 * - Emergency oracle replacement scenarios
 * 
 * These tests verify the entire TokenManager + Oracle system
 * works correctly in realistic end-to-end scenarios.
 */
describe("🎬 Oracle Adapter - End-to-End Tests", function () {
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let trader1: SignerWithAddress;
  let trader2: SignerWithAddress;

  let beacon: Beacon;
  let tokenManager: TokenManager;
  let chainlinkAdapter: ChainlinkAdapter;
  let mockOracleAdapter: MockOracleAdapter;
  let mockChainlinkOracle: MockChainlinkOracle;

  let weth: MockWETH;
  let usdc: MockERC20;
  let wbtc: MockERC20;
  let dai: MockERC20;
  let link: MockERC20;

  const INITIAL_PRICES = {
    USDC: ethers.parseUnits("1", 8),     // $1
    WBTC: ethers.parseUnits("50000", 8), // $50000
    DAI: ethers.parseUnits("1", 8),      // $1
    LINK: ethers.parseUnits("15", 8)     // $15
  };

  const HEARTBEAT = 3600; // 1 hour

  beforeEach(async function () {
    [owner, admin, trader1, trader2] = await ethers.getSigners();

    // Deploy Beacon
    const BeaconFactory = await ethers.getContractFactory("Beacon");
    beacon = await BeaconFactory.deploy();

    // Deploy MockOracleAdapter
    const MockOracleAdapterFactory = await ethers.getContractFactory("MockOracleAdapter");
    mockOracleAdapter = await MockOracleAdapterFactory.deploy();

    // Deploy tokens
    const MockWETHFactory = await ethers.getContractFactory("MockWETH");
    weth = await MockWETHFactory.deploy();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
    wbtc = await MockERC20Factory.deploy("Wrapped Bitcoin", "WBTC", 8);
    dai = await MockERC20Factory.deploy("Dai Stablecoin", "DAI", 18);
    link = await MockERC20Factory.deploy("Chainlink Token", "LINK", 18);

    // Setup WETH in beacon (required)
    await beacon.updateImplementation("WETH", await weth.getAddress());
    // BASE_ASSET required by TokenManager.manageTokenData
    await beacon.updateImplementation("BASE_ASSET", await weth.getAddress());

    // Deploy TokenManager
    const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
    tokenManager = await TokenManagerFactory.deploy(
      await beacon.getAddress(),
      await mockOracleAdapter.getAddress()
    );

    // Setup tokens in MockOracleAdapter
    await mockOracleAdapter.setupToken("USDC", INITIAL_PRICES.USDC, 8, true);
    await mockOracleAdapter.setupToken("WBTC", INITIAL_PRICES.WBTC, 8, true);
    await mockOracleAdapter.setupToken("DAI", INITIAL_PRICES.DAI, 8, true);
    await mockOracleAdapter.setupToken("LINK", INITIAL_PRICES.LINK, 8, true);

    // Register tokens in TokenManager
    await tokenManager["manageTokenData(string,address,uint8,uint256)"]("USDC", await usdc.getAddress(), 6, HEARTBEAT);
    await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WBTC", await wbtc.getAddress(), 8, HEARTBEAT);
    await tokenManager["manageTokenData(string,address,uint8,uint256)"]("DAI", await dai.getAddress(), 18, HEARTBEAT);
    await tokenManager["manageTokenData(string,address,uint8,uint256)"]("LINK", await link.getAddress(), 18, HEARTBEAT);

    // Deploy ChainlinkAdapter for later use
    const ChainlinkAdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
    chainlinkAdapter = await ChainlinkAdapterFactory.deploy();

    // Set targetDenomination to "USD" so USD-denominated feeds don't need conversion
    await chainlinkAdapter.setTargetDenomination("USD");

    // Deploy and setup Chainlink oracles
    const MockChainlinkOracleFactory = await ethers.getContractFactory("MockChainlinkOracle");
    mockChainlinkOracle = await MockChainlinkOracleFactory.deploy(INITIAL_PRICES.USDC, 8, "USDC / USD");
    await chainlinkAdapter.setPriceFeed("USDC", await mockChainlinkOracle.getAddress(), 8, HEARTBEAT, "USD");
    
    const wbtcOracle = await MockChainlinkOracleFactory.deploy(INITIAL_PRICES.WBTC, 8, "WBTC / USD");
    await chainlinkAdapter.setPriceFeed("WBTC", await wbtcOracle.getAddress(), 8, HEARTBEAT, "USD");
  });

  describe("💼 Multi-User Portfolio Price Queries", function () {

    it("Should allow multiple traders to query token prices simultaneously", async function () {
      // Trader1 queries USDC price
      const [usdcPrice1] = await tokenManager.connect(trader1).getTokenPrice("USDC");
      
      // Trader2 queries WBTC price
      const [wbtcPrice2] = await tokenManager.connect(trader2).getTokenPrice("WBTC");
      
      // Both get correct prices
      expect(usdcPrice1).to.equal(INITIAL_PRICES.USDC);
      expect(wbtcPrice2).to.equal(INITIAL_PRICES.WBTC);
    });

    it("Should handle portfolio valuation across multiple tokens", async function () {
      // Simulate trader1 wanting to value a portfolio:
      // 10,000 USDC + 1 WBTC + 5000 DAI
      
      const [usdcPrice] = await tokenManager.getTokenPrice("USDC");
      const [wbtcPrice] = await tokenManager.getTokenPrice("WBTC");
      const [daiPrice] = await tokenManager.getTokenPrice("DAI");

      // Calculate portfolio value (in 8-decimal USD)
      const usdcValue = (10000n * usdcPrice); // 10000 * $1 = $10,000
      const wbtcValue = (1n * wbtcPrice); // 1 * $50000 = $50,000
      const daiValue = (5000n * daiPrice); // 5000 * $1 = $5,000
      
      const totalValue = usdcValue + wbtcValue + daiValue; // $65,000

      expect(totalValue).to.equal(ethers.parseUnits("65000", 8));
    });

    it("Should provide consistent prices across multiple queries", async function () {
      // Query same token multiple times
      const [price1] = await tokenManager.getTokenPrice("USDC");
      const [price2] = await tokenManager.getTokenPrice("USDC");
      const [price3] = await tokenManager.getTokenPrice("USDC");

      expect(price1).to.equal(price2);
      expect(price2).to.equal(price3);
      expect(price1).to.equal(INITIAL_PRICES.USDC);
    });
  });

  describe("📈 Price Changes During Active Sessions", function () {

    it("Should reflect price changes immediately for all users", async function () {
      // Initial state: LINK at $2000
      const [initialPrice] = await tokenManager.getTokenPrice("LINK");
      expect(initialPrice).to.equal(INITIAL_PRICES.LINK);

      // MARKET UPDATE: LINK price increases to $2500
      const newPrice = ethers.parseUnits("20", 8);
      await mockOracleAdapter.setPrice("LINK", newPrice);

      // All traders immediately see new price
      const [trader1Price] = await tokenManager.connect(trader1).getTokenPrice("LINK");
      const [trader2Price] = await tokenManager.connect(trader2).getTokenPrice("LINK");

      expect(trader1Price).to.equal(newPrice);
      expect(trader2Price).to.equal(newPrice);
    });

    it("Should handle rapid price fluctuations", async function () {
      // Simulate volatile market
      const prices = [
        ethers.parseUnits("15", 8),
        ethers.parseUnits("16", 8),
        ethers.parseUnits("14", 8),
        ethers.parseUnits("17", 8),
        ethers.parseUnits("15.5", 8)
      ];

      for (const price of prices) {
        await mockOracleAdapter.setPrice("LINK", price);
        const [currentPrice] = await tokenManager.getTokenPrice("LINK");
        expect(currentPrice).to.equal(price);
      }
    });

    it("Should maintain independent prices for different tokens", async function () {
      // Update prices for different tokens
      await mockOracleAdapter.setPrice("LINK", ethers.parseUnits("16", 8));
      await mockOracleAdapter.setPrice("USDC", ethers.parseUnits("0.99", 8)); // USDC depegs slightly
      await mockOracleAdapter.setPrice("WBTC", ethers.parseUnits("51000", 8));

      // Verify each token has independent price
      const [LINKPrice] = await tokenManager.getTokenPrice("LINK");
      const [usdcPrice] = await tokenManager.getTokenPrice("USDC");
      const [wbtcPrice] = await tokenManager.getTokenPrice("WBTC");

      expect(LINKPrice).to.equal(ethers.parseUnits("16", 8));
      expect(usdcPrice).to.equal(ethers.parseUnits("0.99", 8));
      expect(wbtcPrice).to.equal(ethers.parseUnits("51000", 8));
    });
  });

  describe("🔄 Oracle Adapter Hot-Swapping During Operations", function () {

    it("Should switch oracle provider without disrupting price queries", async function () {
      // Traders actively querying prices with MockOracleAdapter
      const [priceBefore] = await tokenManager.getTokenPrice("USDC");
      expect(priceBefore).to.equal(INITIAL_PRICES.USDC);

      // ADMIN DECISION: Switch to ChainlinkAdapter for better reliability
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());

      // Traders continue querying without interruption
      const [priceAfter] = await tokenManager.getTokenPrice("USDC");
      expect(priceAfter).to.equal(INITIAL_PRICES.USDC); // Same price from Chainlink

      // Multiple traders query simultaneously after switch
      const [trader1Price] = await tokenManager.connect(trader1).getTokenPrice("USDC");
      const [trader2Price] = await tokenManager.connect(trader2).getTokenPrice("USDC");

      expect(trader1Price).to.equal(INITIAL_PRICES.USDC);
      expect(trader2Price).to.equal(INITIAL_PRICES.USDC);
    });

    it("Should maintain token registry across oracle switch", async function () {
      // Get active tokens before switch
      const tokensBefore = await tokenManager.getActiveTokens();
      expect(tokensBefore.length).to.equal(4); // LINK, USDC, WBTC, DAI

      // Switch oracle
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());

      // Token registry unchanged
      const tokensAfter = await tokenManager.getActiveTokens();
      expect(tokensAfter.length).to.equal(4);
      expect(tokensAfter).to.deep.equal(tokensBefore);
    });

    it("Should handle partial token support after oracle switch", async function () {
      // Switch to ChainlinkAdapter (only has USDC and WBTC configured)
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());

      // Tokens in Chainlink work fine
      const [usdcPrice] = await tokenManager.getTokenPrice("USDC");
      const [wbtcPrice] = await tokenManager.getTokenPrice("WBTC");
      
      expect(usdcPrice).to.equal(INITIAL_PRICES.USDC);
      expect(wbtcPrice).to.equal(INITIAL_PRICES.WBTC);

      // Tokens NOT in Chainlink fail gracefully
      await expect(tokenManager.getTokenPrice("LINK"))
        .to.be.revertedWithCustomError(chainlinkAdapter, "TokenNotSupported");
      
      await expect(tokenManager.getTokenPrice("DAI"))
        .to.be.revertedWithCustomError(chainlinkAdapter, "TokenNotSupported");
    });
  });

  describe("⚠️ Emergency Oracle Replacement Scenarios", function () {

    it("Should handle emergency oracle replacement due to malfunction", async function () {
      // System running normally
      const [initialPrice] = await tokenManager.getTokenPrice("USDC");
      expect(initialPrice).to.equal(INITIAL_PRICES.USDC);

      // EMERGENCY: Oracle malfunctions and starts returning stale data
      await mockOracleAdapter.setStale("USDC");

      // System detects stale data
      await expect(tokenManager.getTokenPrice("USDC"))
        .to.be.revertedWithCustomError(tokenManager, "StalePrice");

      // EMERGENCY ACTION: Admin switches to backup Chainlink adapter
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());

      // System immediately recovers
      const [recoveredPrice] = await tokenManager.getTokenPrice("USDC");
      expect(recoveredPrice).to.equal(INITIAL_PRICES.USDC);

      // All traders can resume operations
      const [trader1Price] = await tokenManager.connect(trader1).getTokenPrice("USDC");
      const [trader2Price] = await tokenManager.connect(trader2).getTokenPrice("USDC");
      
      expect(trader1Price).to.equal(INITIAL_PRICES.USDC);
      expect(trader2Price).to.equal(INITIAL_PRICES.USDC);
    });

    it("Should isolate failures to specific tokens", async function () {
      // USDC oracle fails
      await mockOracleAdapter.setStale("USDC");

      // USDC queries fail
      await expect(tokenManager.getTokenPrice("USDC"))
        .to.be.revertedWithCustomError(tokenManager, "StalePrice");

      // But other tokens still work
      const [LINKPrice] = await tokenManager.getTokenPrice("LINK");
      const [wbtcPrice] = await tokenManager.getTokenPrice("WBTC");
      const [daiPrice] = await tokenManager.getTokenPrice("DAI");

      expect(LINKPrice).to.equal(INITIAL_PRICES.LINK);
      expect(wbtcPrice).to.equal(INITIAL_PRICES.WBTC);
      expect(daiPrice).to.equal(INITIAL_PRICES.DAI);

      // Fix USDC oracle
      await mockOracleAdapter.setValid("USDC");

      // USDC works again
      const [usdcPrice] = await tokenManager.getTokenPrice("USDC");
      expect(usdcPrice).to.equal(INITIAL_PRICES.USDC);
    });

    it("Should handle complete oracle failure with quick replacement", async function () {
      // All tokens fail
      await mockOracleAdapter.setStale("LINK");
      await mockOracleAdapter.setStale("USDC");
      await mockOracleAdapter.setStale("WBTC");
      await mockOracleAdapter.setStale("DAI");

      // No price queries work
      await expect(tokenManager.getTokenPrice("LINK")).to.be.revertedWithCustomError(tokenManager, "StalePrice");
      await expect(tokenManager.getTokenPrice("USDC")).to.be.revertedWithCustomError(tokenManager, "StalePrice");

      // Emergency switch to Chainlink
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());

      // Configured tokens immediately work
      const [usdcPrice] = await tokenManager.getTokenPrice("USDC");
      const [wbtcPrice] = await tokenManager.getTokenPrice("WBTC");

      expect(usdcPrice).to.equal(INITIAL_PRICES.USDC);
      expect(wbtcPrice).to.equal(INITIAL_PRICES.WBTC);
    });
  });

  describe("🔧 Token Management Lifecycle", function () {

    it("Should add new token with oracle validation", async function () {
      // Deploy new token
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const link = await MockERC20Factory.deploy("Chainlink", "LINK", 18);

      // Setup in oracle first
      const linkPrice = ethers.parseUnits("15", 8); // $15
      await mockOracleAdapter.setupToken("LINK", linkPrice, 8, true);

      // Add to TokenManager
      await tokenManager["manageTokenData(string,address,uint8,uint256)"]("LINK", await link.getAddress(), 18, HEARTBEAT);

      // Verify price accessible
      const [price] = await tokenManager.getTokenPrice("LINK");
      expect(price).to.equal(linkPrice);
    });

    it("Should prevent adding token not supported by oracle", async function () {
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const unsupportedToken = await MockERC20Factory.deploy("Unsupported", "UNSUP", 18);

      // Try to add without oracle support
      await expect(
        tokenManager["manageTokenData(string,address,uint8,uint256)"]("UNSUP", await unsupportedToken.getAddress(), 18, HEARTBEAT)
      ).to.be.revertedWith("Token not supported by oracle");
    });

    it("Should handle token addition after oracle switch", async function () {
      // Switch to ChainlinkAdapter
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());

      // Try to add token not in Chainlink
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const newToken = await MockERC20Factory.deploy("NewToken", "NEW", 18);

      // Should fail - Chainlink doesn't support it
      await expect(
        tokenManager["manageTokenData(string,address,uint8,uint256)"]("NEW", await newToken.getAddress(), 18, HEARTBEAT)
      ).to.be.revertedWith("Token not supported by oracle");

      // Switch back to MockOracleAdapter
      await mockOracleAdapter.setupToken("NEW", ethers.parseUnits("10", 8), 8, true);
      await tokenManager.setOracleAdapter(await mockOracleAdapter.getAddress());

      // Now it works
      await tokenManager["manageTokenData(string,address,uint8,uint256)"]("NEW", await newToken.getAddress(), 18, HEARTBEAT);
      
      const [price] = await tokenManager.getTokenPrice("NEW");
      expect(price).to.equal(ethers.parseUnits("10", 8));
    });
  });

  describe("🎯 Complex Real-World Scenarios", function () {

    it("Should handle trading day with multiple price updates and queries", async function () {
      // Morning: Traders check prices
      const [morningLINK] = await tokenManager.connect(trader1).getTokenPrice("LINK");
      const [morningUSDC] = await tokenManager.connect(trader2).getTokenPrice("USDC");

      // Midday: Market moves
      await mockOracleAdapter.setPrice("LINK", ethers.parseUnits("16", 8));
      await mockOracleAdapter.setPrice("WBTC", ethers.parseUnits("51000", 8));

      // Traders check updated prices
      const [middayLINK] = await tokenManager.connect(trader1).getTokenPrice("LINK");
      const [middayWBTC] = await tokenManager.connect(trader2).getTokenPrice("WBTC");

      expect(middayLINK).to.equal(ethers.parseUnits("16", 8));
      expect(middayWBTC).to.equal(ethers.parseUnits("51000", 8));

      // Evening: More updates
      await mockOracleAdapter.setPrice("LINK", ethers.parseUnits("15.5", 8));

      const [eveningLINK] = await tokenManager.getTokenPrice("LINK");
      expect(eveningLINK).to.equal(ethers.parseUnits("15.5", 8));

      // Verify price progression
      expect(morningLINK).to.equal(INITIAL_PRICES.LINK); // $2000
      expect(middayLINK).to.be.gt(morningLINK); // $2100
      expect(eveningLINK).to.be.lt(middayLINK); // $2050
    });

    it("Should handle oracle upgrade during high activity", async function () {
      // High activity: Multiple concurrent price queries
      const queries = await Promise.all([
        tokenManager.connect(trader1).getTokenPrice("LINK"),
        tokenManager.connect(trader2).getTokenPrice("USDC"),
        tokenManager.connect(trader1).getTokenPrice("WBTC"),
        tokenManager.connect(trader2).getTokenPrice("DAI")
      ]);

      // All succeed
      expect(queries[0][0]).to.equal(INITIAL_PRICES.LINK);
      expect(queries[1][0]).to.equal(INITIAL_PRICES.USDC);
      expect(queries[2][0]).to.equal(INITIAL_PRICES.WBTC);
      expect(queries[3][0]).to.equal(INITIAL_PRICES.DAI);

      // Admin upgrades oracle
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());

      // Activity continues (for supported tokens)
      const [usdcPrice] = await tokenManager.connect(trader1).getTokenPrice("USDC");
      const [wbtcPrice] = await tokenManager.connect(trader2).getTokenPrice("WBTC");

      expect(usdcPrice).to.equal(INITIAL_PRICES.USDC);
      expect(wbtcPrice).to.equal(INITIAL_PRICES.WBTC);
    });

    it("Should maintain data consistency across rapid oracle switches", async function () {
      // Get initial state
      const [initialPrice] = await tokenManager.getTokenPrice("USDC");

      // Rapid switches
      for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
          await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
        } else {
          await tokenManager.setOracleAdapter(await mockOracleAdapter.getAddress());
        }

        // Price should remain consistent
        const [currentPrice] = await tokenManager.getTokenPrice("USDC");
        expect(currentPrice).to.equal(initialPrice);
      }

      // Final state: All data intact
      const tokens = await tokenManager.getActiveTokens();
      expect(tokens.length).to.equal(4);
    });
  });

  describe("⚡ Performance & Edge Cases", function () {

    it("Should handle maximum number of tokens efficiently", async function () {
      // Query all registered tokens
      const tokens = await tokenManager.getActiveTokens();
      
      for (const tokenCode of tokens) {
        const [price] = await tokenManager.getTokenPrice(tokenCode);
        expect(price).to.be.gt(0);
      }
    });

    it("Should handle decimal precision correctly", async function () {
      // All prices should be 8 decimals (oracle standard)
      const [LINKPrice] = await tokenManager.getTokenPrice("LINK");
      const [usdcPrice] = await tokenManager.getTokenPrice("USDC");
      const [wbtcPrice] = await tokenManager.getTokenPrice("WBTC");

      const LINKDecimals = await mockOracleAdapter.getPriceDecimals("LINK");
      const usdcDecimals = await mockOracleAdapter.getPriceDecimals("USDC");
      const wbtcDecimals = await mockOracleAdapter.getPriceDecimals("WBTC");

      expect(LINKDecimals).to.equal(8);
      expect(usdcDecimals).to.equal(8);
      expect(wbtcDecimals).to.equal(8);

      // Price values should be reasonable
      expect(LINKPrice).to.equal(ethers.parseUnits("15", 8));
      expect(usdcPrice).to.equal(ethers.parseUnits("1", 8));
      expect(wbtcPrice).to.equal(ethers.parseUnits("50000", 8));
    });

    it("Should handle edge case of zero address oracle switch", async function () {
      // Cannot set zero address as oracle
      await expect(
        tokenManager.setOracleAdapter(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid adapter address");
    });

    it("Should handle non-owner attempting oracle switch", async function () {
      // Trader tries to switch oracle (should fail)
      await expect(
        tokenManager.connect(trader1).setOracleAdapter(await chainlinkAdapter.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
