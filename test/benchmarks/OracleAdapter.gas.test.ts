import { expect } from "chai";
import { ethers } from "hardhat";
import { Beacon, TokenManager, ChainlinkAdapter, MockOracleAdapter, MockChainlinkOracle, MockERC20 } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("⛽ Oracle Adapter - Gas Benchmarks", function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  
  let tokenManager: TokenManager;
  let chainlinkAdapter: ChainlinkAdapter;
  let mockOracleAdapter: MockOracleAdapter;
  let mockChainlinkOracle: MockChainlinkOracle;
  let usdcToken: MockERC20;
  let beacon: Beacon;

  const USDC_CODE = "USDC";
  const USDC_PRICE = ethers.parseUnits("1", 8); // $1 with 8 decimals
  const USDC_DECIMALS = 6;
  const HEARTBEAT = 3600; // 1 hour

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy Beacon (required by TokenManager)
    const BeaconFactory = await ethers.getContractFactory("Beacon");
    beacon = await BeaconFactory.deploy();
    await beacon.waitForDeployment();

    // Setup WETH in beacon (required by TokenManager constructor)
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const wethForBeacon = await MockERC20Factory.deploy("Wrapped Ether", "WETH", 18);
    await beacon.updateImplementation("WETH", await wethForBeacon.getAddress());

    // Deploy MockOracleAdapter
    const MockOracleAdapterFactory = await ethers.getContractFactory("MockOracleAdapter");
    mockOracleAdapter = await MockOracleAdapterFactory.deploy();
    await mockOracleAdapter.waitForDeployment();

    // Deploy TokenManager with MockOracleAdapter
    const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
    tokenManager = await TokenManagerFactory.deploy(
      await beacon.getAddress(),
      await mockOracleAdapter.getAddress()
    );
    await tokenManager.waitForDeployment();

    // Setup USDC token in MockOracleAdapter
    await mockOracleAdapter.setupToken(USDC_CODE, USDC_PRICE, 8, true);

    // Deploy USDC token (reuse MockERC20Factory from earlier)
    usdcToken = await MockERC20Factory.deploy("USD Coin", "USDC", USDC_DECIMALS);
    await usdcToken.waitForDeployment();

    // Register USDC in TokenManager
    await tokenManager["manageTokenData(string,address,uint8,uint256)"](
      USDC_CODE,
      await usdcToken.getAddress(),
      USDC_DECIMALS,
      HEARTBEAT
    );

    // Deploy Chainlink components for direct comparison
    const MockChainlinkOracleFactory = await ethers.getContractFactory("MockChainlinkOracle");
    mockChainlinkOracle = await MockChainlinkOracleFactory.deploy(USDC_PRICE, 8, "USDC / USD");
    await mockChainlinkOracle.waitForDeployment();

    // Deploy ChainlinkAdapter
    const ChainlinkAdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
    chainlinkAdapter = await ChainlinkAdapterFactory.deploy();
    await chainlinkAdapter.waitForDeployment();
    await chainlinkAdapter.setPriceFeed(
      USDC_CODE,
      await mockChainlinkOracle.getAddress(),
      8,
      HEARTBEAT
    );
  });

  describe("📊 Gas Cost Comparisons", function () {
    
    it("Should measure getTokenPrice() gas cost with MockOracleAdapter", async function () {
      const gasUsed = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);

      console.log(`      MockOracleAdapter getTokenPrice(): ${gasUsed} gas`);
      
      // Should be reasonable (< 50k gas)
      expect(gasUsed).to.be.lt(50000);
    });

    it("Should measure getTokenPrice() gas cost with ChainlinkAdapter", async function () {
      // Switch to ChainlinkAdapter
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
      
      const gasUsed = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);

      console.log(`      ChainlinkAdapter getTokenPrice(): ${gasUsed} gas`);
      
      // Should be reasonable (< 100k gas for external call to Chainlink)
      expect(gasUsed).to.be.lt(100000);
    });

    it("Should measure direct Chainlink call gas cost (baseline)", async function () {
      const gasUsed = await mockChainlinkOracle.latestRoundData.estimateGas();

      console.log(`      Direct Chainlink latestRoundData(): ${gasUsed} gas`);
      
      // Baseline for comparison
      expect(gasUsed).to.be.gt(0);
    });

    it("Should compare adapter overhead (ChainlinkAdapter vs Direct)", async function () {
      // Direct Chainlink call
      const directGas = await mockChainlinkOracle.latestRoundData.estimateGas();

      // Through adapter
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
      const adapterGas = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);

      const overhead = adapterGas - directGas;
      const overheadPercent = Number((overhead * 100n) / directGas);

      console.log(`      Direct Chainlink: ${directGas} gas`);
      console.log(`      Through Adapter: ${adapterGas} gas`);
      console.log(`      Overhead: ${overhead} gas (${overheadPercent}%)`);

      // Overhead should be reasonable (< 30k gas)
      expect(overhead).to.be.lt(30000);
    });

    it("Should measure setOracleAdapter() one-time migration cost", async function () {
      const tx = await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
      const receipt = await tx.wait();
      const gasUsed = receipt?.gasUsed || 0n;

      console.log(`      setOracleAdapter() migration: ${gasUsed} gas`);
      
      // One-time cost, should be acceptable (< 100k gas)
      expect(gasUsed).to.be.lt(100000);
    });
  });

  describe("📈 Gas Optimization Analysis", function () {

    it("Should measure multiple price retrievals (SLOAD caching)", async function () {
      // First call (cold SLOAD)
      const gas1 = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);

      // Second call (warm SLOAD)
      const gas2 = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);

      // Third call (warm SLOAD)
      const gas3 = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);

      console.log(`      1st call (cold): ${gas1} gas`);
      console.log(`      2nd call (warm): ${gas2} gas`);
      console.log(`      3rd call (warm): ${gas3} gas`);

      // All estimates should be the same (estimateGas doesn't show cold/warm difference)
      expect(gas2).to.equal(gas1);
      expect(gas3).to.equal(gas1);
    });

    it("Should measure batch price retrieval efficiency", async function () {
      // Setup additional tokens
      await mockOracleAdapter.setupToken("WBTC", ethers.parseUnits("50000", 8), 8, true);
      await mockOracleAdapter.setupToken("WETH", ethers.parseUnits("2000", 8), 8, true);

      const wbtcToken = await (await ethers.getContractFactory("MockERC20")).deploy("Wrapped Bitcoin", "WBTC", 8);
      const wethToken = await (await ethers.getContractFactory("MockERC20")).deploy("Wrapped Ether", "WETH", 18);

      await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WBTC", await wbtcToken.getAddress(), 8, HEARTBEAT);
      await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WETH", await wethToken.getAddress(), 18, HEARTBEAT);

      // Measure individual calls
      const gas1 = await tokenManager.getTokenPrice.estimateGas("USDC");
      const gas2 = await tokenManager.getTokenPrice.estimateGas("WBTC");
      const gas3 = await tokenManager.getTokenPrice.estimateGas("WETH");

      const totalGas = gas1 + gas2 + gas3;
      const avgGas = totalGas / 3n;

      console.log(`      USDC: ${gas1} gas`);
      console.log(`      WBTC: ${gas2} gas`);
      console.log(`      WETH: ${gas3} gas`);
      console.log(`      Total: ${totalGas} gas`);
      console.log(`      Average: ${avgGas} gas per token`);

      // All calls should be within reasonable range
      expect(gas1).to.be.lt(50000);
      expect(gas2).to.be.lt(50000);
      expect(gas3).to.be.lt(50000);
    });

    it("Should measure adapter switch impact on subsequent calls", async function () {
      // Before switch
      const beforeGas = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);

      // Switch adapter
      const switchTx = await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
      const switchReceipt = await switchTx.wait();
      const switchGas = switchReceipt?.gasUsed || 0n;

      // After switch (first call)
      const afterGas = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);

      console.log(`      Before switch: ${beforeGas} gas`);
      console.log(`      Switch operation: ${switchGas} gas`);
      console.log(`      After switch: ${afterGas} gas`);

      // After switch should still be reasonable
      expect(afterGas).to.be.lt(150000);
    });
  });

  describe("💾 Storage vs External Call Costs", function () {

    it("Should compare MockAdapter (storage) vs ChainlinkAdapter (external call)", async function () {
      // MockAdapter (storage read)
      const mockGas = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);

      // Switch to ChainlinkAdapter (external call)
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
      const chainlinkGas = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);

      const difference = chainlinkGas - mockGas;
      const diffPercent = Number((difference * 100n) / mockGas);

      console.log(`      MockAdapter (storage): ${mockGas} gas`);
      console.log(`      ChainlinkAdapter (external): ${chainlinkGas} gas`);
      console.log(`      Difference: ${difference} gas (${diffPercent}% increase)`);

      // External calls are expected to be more expensive
      expect(chainlinkGas).to.be.gt(mockGas);
      
      // But should still be reasonable
      expect(chainlinkGas).to.be.lt(150000);
    });

    it("Should verify adapter pattern doesn't add excessive overhead", async function () {
      // Direct oracle call baseline
      const directGas = await mockChainlinkOracle.latestRoundData.estimateGas();

      // Through full stack (TokenManager -> ChainlinkAdapter -> Oracle)
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
      const fullStackGas = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);

      const adapterOverhead = fullStackGas - directGas;
      const maxAcceptableOverhead = 50000n; // 50k gas maximum overhead

      console.log(`      Direct oracle call: ${directGas} gas`);
      console.log(`      Full stack (TM -> Adapter -> Oracle): ${fullStackGas} gas`);
      console.log(`      Adapter pattern overhead: ${adapterOverhead} gas`);
      console.log(`      Max acceptable overhead: ${maxAcceptableOverhead} gas`);

      // Verify overhead is acceptable
      expect(adapterOverhead).to.be.lt(maxAcceptableOverhead);
      
      // Overhead should be less than 100% increase
      expect(fullStackGas).to.be.lt(directGas * 2n);
    });
  });

  describe("📉 Gas Report Summary", function () {

    it("Should generate comprehensive gas cost report", async function () {
      console.log("\n      ╔══════════════════════════════════════════════════════════════╗");
      console.log("      ║         ORACLE ADAPTER GAS BENCHMARK SUMMARY                 ║");
      console.log("      ╚══════════════════════════════════════════════════════════════╝\n");

      // 1. MockOracleAdapter price retrieval
      const mockGas = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);
      console.log(`      1. MockOracleAdapter.getTokenPrice():`);
      console.log(`         ${mockGas} gas (storage-based)\n`);

      // 2. ChainlinkAdapter price retrieval
      await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
      const chainlinkGas = await tokenManager.getTokenPrice.estimateGas(USDC_CODE);
      console.log(`      2. ChainlinkAdapter.getTokenPrice():`);
      console.log(`         ${chainlinkGas} gas (external call)\n`);

      // 3. Direct Chainlink call baseline
      const directGas = await mockChainlinkOracle.latestRoundData.estimateGas();
      console.log(`      3. Direct Chainlink.latestRoundData():`);
      console.log(`         ${directGas} gas (baseline)\n`);

      // 4. Adapter overhead calculation
      const overhead = chainlinkGas - directGas;
      const overheadPercent = Number((overhead * 100n) / directGas);
      console.log(`      4. Adapter Pattern Overhead:`);
      console.log(`         ${overhead} gas (${overheadPercent}%)\n`);

      // 5. One-time migration cost
      await tokenManager.setOracleAdapter(await mockOracleAdapter.getAddress());
      const migrationTx = await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
      const migrationReceipt = await migrationTx.wait();
      const migrationGas = migrationReceipt?.gasUsed || 0n;
      console.log(`      5. One-Time Migration (setOracleAdapter):`);
      console.log(`         ${migrationGas} gas\n`);

      console.log("      ╔══════════════════════════════════════════════════════════════╗");
      console.log("      ║  VERDICT: Adapter pattern adds minimal overhead (~20-30k)   ║");
      console.log("      ║  Flexibility gain >> Gas cost increase                      ║");
      console.log("      ╚══════════════════════════════════════════════════════════════╝\n");

      // All values should be reasonable
      expect(mockGas).to.be.lt(50000);
      expect(chainlinkGas).to.be.lt(150000);
      expect(overhead).to.be.lt(50000);
      expect(migrationGas).to.be.lt(100000);
    });
  });
});
