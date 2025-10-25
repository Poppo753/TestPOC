import { ethers } from "hardhat";
import { BaseContract } from "ethers";

/**
 * 🎭 MOCK CHAINLINK ORACLE
 * Mock implementazione di Chainlink AggregatorV3Interface per test
 */
export class MockChainlinkOracle {
  private price: bigint;
  private decimals: number;
  private description: string;
  private updatedAt: number;
  private roundId: bigint;

  constructor(
    initialPrice: bigint,
    decimals: number = 8,
    description: string = "Mock Price Feed"
  ) {
    this.price = initialPrice;
    this.decimals = decimals;
    this.description = description;
    this.updatedAt = Math.floor(Date.now() / 1000);
    this.roundId = 1n;
  }

  /**
   * Update the mock price
   */
  updatePrice(newPrice: bigint): void {
    this.price = newPrice;
    this.updatedAt = Math.floor(Date.now() / 1000);
    this.roundId += 1n;
  }

  /**
   * Simulate stale price by setting old timestamp
   */
  makeStale(ageInSeconds: number = 3700): void {
    this.updatedAt = Math.floor(Date.now() / 1000) - ageInSeconds;
  }

  /**
   * Get latest round data (Chainlink interface)
   */
  latestRoundData(): [bigint, bigint, bigint, bigint, bigint] {
    return [
      this.roundId,        // roundId
      this.price,          // answer
      BigInt(this.updatedAt - 100), // startedAt
      BigInt(this.updatedAt),       // updatedAt
      this.roundId         // answeredInRound
    ];
  }

  /**
   * Get decimals
   */
  decimalsValue(): number {
    return this.decimals;
  }

  /**
   * Get description
   */
  descriptionValue(): string {
    return this.description;
  }
}

/**
 * 🏭 MOCK ORACLE FACTORY
 * Factory per creare mock oracles con configurazioni standard
 */
export class MockOracleFactory {
  
  /**
   * Create mock ETH/USD price feed
   */
  static createETHUSD(price: bigint = ethers.parseUnits("2000", 8)): MockChainlinkOracle {
    return new MockChainlinkOracle(price, 8, "ETH/USD");
  }

  /**
   * Create mock USDC/USD price feed
   */
  static createUSDCUSD(price: bigint = ethers.parseUnits("1", 8)): MockChainlinkOracle {
    return new MockChainlinkOracle(price, 8, "USDC/USD");
  }

  /**
   * Create mock WBTC/USD price feed
   */
  static createWBTCUSD(price: bigint = ethers.parseUnits("40000", 8)): MockChainlinkOracle {
    return new MockChainlinkOracle(price, 8, "WBTC/USD");
  }

  /**
   * Create mock ARB/USD price feed
   */
  static createARBUSD(price: bigint = ethers.parseUnits("1.5", 8)): MockChainlinkOracle {
    return new MockChainlinkOracle(price, 8, "ARB/USD");
  }

  /**
   * Create custom mock oracle
   */
  static createCustom(
    price: bigint,
    decimals: number = 8,
    description: string = "Custom Feed"
  ): MockChainlinkOracle {
    return new MockChainlinkOracle(price, decimals, description);
  }
}

/**
 * 🎭 MOCK WETH CONTRACT
 * Mock implementazione di WETH per test
 */
export async function deployMockWETH(): Promise<BaseContract> {
  const MockWETHFactory = await ethers.getContractFactory("MockERC20");
  const mockWETH = await MockWETHFactory.deploy(
    "Wrapped Ether",
    "WETH",
    18,
    ethers.parseEther("1000000") // 1M WETH supply
  );
  await mockWETH.waitForDeployment();
  return mockWETH;
}

/**
 * 🎭 MOCK ERC20 TOKENS
 * Factory per creare mock ERC20 tokens per test
 */
export class MockTokenFactory {
  
  static async createUSDC(): Promise<BaseContract> {
    const MockTokenFactory = await ethers.getContractFactory("MockERC20");
    const usdc = await MockTokenFactory.deploy(
      "USD Coin",
      "USDC",
      6,
      ethers.parseUnits("1000000", 6) // 1M USDC
    );
    await usdc.waitForDeployment();
    return usdc;
  }

  static async createWBTC(): Promise<BaseContract> {
    const MockTokenFactory = await ethers.getContractFactory("MockERC20");
    const wbtc = await MockTokenFactory.deploy(
      "Wrapped Bitcoin",
      "WBTC",
      8,
      ethers.parseUnits("1000", 8) // 1000 WBTC
    );
    await wbtc.waitForDeployment();
    return wbtc;
  }

  static async createARB(): Promise<BaseContract> {
    const MockTokenFactory = await ethers.getContractFactory("MockERC20");
    const arb = await MockTokenFactory.deploy(
      "Arbitrum",
      "ARB",
      18,
      ethers.parseEther("1000000") // 1M ARB
    );
    await arb.waitForDeployment();
    return arb;
  }

  static async createCustomToken(
    name: string,
    symbol: string,
    decimals: number,
    supply: bigint
  ): Promise<BaseContract> {
    const MockTokenFactory = await ethers.getContractFactory("MockERC20");
    const token = await MockTokenFactory.deploy(name, symbol, decimals, supply);
    await token.waitForDeployment();
    return token;
  }
}

/**
 * 🎭 MOCK DEX ROUTER
 * Mock per router DEX (Uniswap, SushiSwap, etc.)
 */
export class MockDEXRouter {
  private exchangeRates: Map<string, bigint> = new Map();
  private slippage: number = 300; // 3% default slippage

  constructor() {
    // Default exchange rates
    this.exchangeRates.set("ETH->USDC", ethers.parseUnits("2000", 6)); // 1 ETH = 2000 USDC
    this.exchangeRates.set("USDC->ETH", ethers.parseEther("0.0005")); // 1 USDC = 0.0005 ETH
    this.exchangeRates.set("ETH->WBTC", ethers.parseUnits("0.05", 8)); // 1 ETH = 0.05 WBTC
    this.exchangeRates.set("WBTC->ETH", ethers.parseEther("20")); // 1 WBTC = 20 ETH
  }

  setExchangeRate(pair: string, rate: bigint): void {
    this.exchangeRates.set(pair, rate);
  }

  setSlippage(slippageBasisPoints: number): void {
    this.slippage = slippageBasisPoints;
  }

  getAmountOut(amountIn: bigint, tokenPair: string): bigint {
    const rate = this.exchangeRates.get(tokenPair);
    if (!rate) {
      throw new Error(`Exchange rate not found for pair: ${tokenPair}`);
    }

    const amountOut = (amountIn * rate) / ethers.parseEther("1");
    
    // Apply slippage
    const slippageAmount = (amountOut * BigInt(this.slippage)) / 10000n;
    return amountOut - slippageAmount;
  }

  simulateFailedSwap(): void {
    throw new Error("Swap failed: Insufficient liquidity");
  }
}

/**
 * 📦 ORACLE DEPLOYMENT HELPERS
 * Helper per deploy mock oracles in test environment
 */
export async function deployMockOracles(): Promise<{
  ethUsd: MockChainlinkOracle;
  usdcUsd: MockChainlinkOracle;
  wbtcUsd: MockChainlinkOracle;
  arbUsd: MockChainlinkOracle;
}> {
  return {
    ethUsd: MockOracleFactory.createETHUSD(),
    usdcUsd: MockOracleFactory.createUSDCUSD(),
    wbtcUsd: MockOracleFactory.createWBTCUSD(),
    arbUsd: MockOracleFactory.createARBUSD(),
  };
}

/**
 * 📦 TOKEN DEPLOYMENT HELPERS
 * Helper per deploy mock tokens in test environment
 */
export async function deployMockTokens(): Promise<{
  weth: BaseContract;
  usdc: BaseContract;
  wbtc: BaseContract;
  arb: BaseContract;
}> {
  const [weth, usdc, wbtc, arb] = await Promise.all([
    deployMockWETH(),
    MockTokenFactory.createUSDC(),
    MockTokenFactory.createWBTC(),
    MockTokenFactory.createARB(),
  ]);

  return { weth, usdc, wbtc, arb };
}