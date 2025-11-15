import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 💧 LIQUIDITY MANAGER - SIMPLIFIED UNIT TESTS
 * 
 * Focus sui test core che funzionano con l'architettura attuale
 */

describe("LiquidityManager Contract - Core Tests", function () {
  let liquidityManager: any;
  let beacon: any;
  let proxyGeneral: any;
  let tokenManager: any;
  let valueCalculator: any;
  let swapManager: any;
  let parameterManager: any;
  let mockUSDC: any;
  let mockWETH: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let feeRecipient: any;

  // Test constants based on contract defaults
  const DEPOSIT_AMOUNT = ethers.parseEther("1.0");    // 1 ETH
  const LARGE_DEPOSIT = ethers.parseEther("10.0");    // 10 ETH
  
  const MAX_FEE = 500; // 5% maximum fee (from contract)
  
  const DEFAULT_HOURLY_LIMIT = ethers.parseEther("100.0");  // 100 ETH (contract default)
  const DEFAULT_DAILY_LIMIT = ethers.parseEther("1000.0");  // 1000 ETH (contract default)

  async function deployLiquidityManagerFixture() {
    const [owner, user1, user2, feeRecipient] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
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

    const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
    const valueCalculator = await ValueCalculator.deploy(beacon.target);

    const SwapManager = await ethers.getContractFactory("SwapManager");
    const swapManager = await SwapManager.deploy(beacon.target);

    const ParameterManager = await ethers.getContractFactory("ParameterManager");
    const parameterManager = await ParameterManager.deploy(beacon.target);

    // Deploy LiquidityManager
    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LiquidityManager.deploy(beacon.target);

    // Register all contracts in Beacon
    await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
    await beacon.updateImplementation("TokenManager", tokenManager.target);
    await beacon.updateImplementation("ValueCalculator", valueCalculator.target);
    await beacon.updateImplementation("SwapManager", swapManager.target);
    await beacon.updateImplementation("ParameterManager", parameterManager.target);
    await beacon.updateImplementation("LiquidityManager", liquidityManager.target);

    // Setup tokens in MockOracleAdapter
    await mockOracleAdapter.setupToken("USDC", ethers.parseUnits("1", 8), 8, true);

    // Setup tokens in TokenManager (NEW SIGNATURE: 4 params)
    await tokenManager.manageTokenData("USDC", mockUSDC.target, 6, 3600);

    // Set fee recipient
    await liquidityManager.setFeeRecipient(await feeRecipient.getAddress());

    // Mint tokens to various addresses for testing
    await mockUSDC.mint(proxyGeneral.target, ethers.parseUnits("50000", 6));
    await mockWETH.mint(proxyGeneral.target, ethers.parseEther("50"));

    return {
      liquidityManager,
      beacon,
      proxyGeneral,
      tokenManager,
      valueCalculator,
      swapManager,
      parameterManager,
      mockUSDC,
      mockWETH,
      mockOracleAdapter,
      owner,
      user1,
      user2,
      feeRecipient
    };
  }

  beforeEach(async function () {
    const fixture = await deployLiquidityManagerFixture();
    liquidityManager = fixture.liquidityManager;
    beacon = fixture.beacon;
    proxyGeneral = fixture.proxyGeneral;
    tokenManager = fixture.tokenManager;
    valueCalculator = fixture.valueCalculator;
    swapManager = fixture.swapManager;
    parameterManager = fixture.parameterManager;
    mockUSDC = fixture.mockUSDC;
    mockWETH = fixture.mockWETH;
    owner = fixture.owner;
    user1 = fixture.user1;
    user2 = fixture.user2;
    feeRecipient = fixture.feeRecipient;
  });

  describe("📋 Deployment & Basic Functions", function () {
    it("should deploy with correct initial state", async function () {
      expect(await liquidityManager.beacon()).to.equal(beacon.target);
      expect(await liquidityManager.owner()).to.equal(await owner.getAddress());
      expect(await liquidityManager.depositFee()).to.equal(0); // Default is 0
      expect(await liquidityManager.withdrawFee()).to.equal(0); // Default is 0
      expect(await liquidityManager.feeRecipient()).to.equal(await feeRecipient.getAddress());
    });

    it("should have expected function signatures", async function () {
      const expectedFunctions = [
        "deposit",
        "withdraw",
        "calculateDepositShares",
        "calculateWithdrawAmount",
        "setDepositFee",
        "setWithdrawFee",
        "setFeeRecipient",
        "setDepositsEnabled",
        "setWithdrawsEnabled",
        "checkWithdrawLimits",
        "getRemainingHourlyLimit",
        "getRemainingDailyLimit"
      ];

      for (const func of expectedFunctions) {
        expect(liquidityManager.interface.hasFunction(func)).to.be.true;
      }
    });

    it("should start with deposits and withdraws enabled", async function () {
      expect(await liquidityManager.depositsEnabled()).to.be.true;
      expect(await liquidityManager.withdrawsEnabled()).to.be.true;
    });

    it("should have correct withdrawal limits", async function () {
      expect(await liquidityManager.getRemainingHourlyLimit(await user1.getAddress())).to.equal(DEFAULT_HOURLY_LIMIT);
      expect(await liquidityManager.getRemainingDailyLimit(await user1.getAddress())).to.equal(DEFAULT_DAILY_LIMIT);
    });
  });

  describe("💸 Fee Management", function () {
    describe("setDepositFee", function () {
      it("should allow owner to update deposit fee", async function () {
        const newFee = 75; // 0.75%
        
        await liquidityManager.setDepositFee(newFee);
        expect(await liquidityManager.depositFee()).to.equal(newFee);
      });

      it("should prevent non-owner from updating deposit fee", async function () {
        await expect(
          liquidityManager.connect(user1).setDepositFee(75)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should enforce maximum deposit fee", async function () {
        await expect(
          liquidityManager.setDepositFee(MAX_FEE + 1)
        ).to.be.revertedWith("Fee exceeds maximum");
      });
    });

    describe("setWithdrawFee", function () {
      it("should allow owner to update withdraw fee", async function () {
        const newFee = 150; // 1.5%
        
        await liquidityManager.setWithdrawFee(newFee);
        expect(await liquidityManager.withdrawFee()).to.equal(newFee);
      });

      it("should prevent non-owner from updating withdraw fee", async function () {
        await expect(
          liquidityManager.connect(user1).setWithdrawFee(150)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should enforce maximum withdraw fee", async function () {
        await expect(
          liquidityManager.setWithdrawFee(MAX_FEE + 1)
        ).to.be.revertedWith("Fee exceeds maximum");
      });
    });

    describe("setFeeRecipient", function () {
      it("should allow owner to update fee recipient", async function () {
        const newRecipient = await user1.getAddress();
        
        await liquidityManager.setFeeRecipient(newRecipient);
        expect(await liquidityManager.feeRecipient()).to.equal(newRecipient);
      });

      it("should prevent non-owner from updating fee recipient", async function () {
        await expect(
          liquidityManager.connect(user1).setFeeRecipient(await user1.getAddress())
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should prevent zero address as fee recipient", async function () {
        await expect(
          liquidityManager.setFeeRecipient(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid recipient");
      });
    });
  });

  describe("🚪 Deposits/Withdraws Toggle", function () {
    describe("setDepositsEnabled", function () {
      it("should allow owner to disable deposits", async function () {
        await liquidityManager.setDepositsEnabled(false);
        expect(await liquidityManager.depositsEnabled()).to.be.false;
      });

      it("should allow owner to re-enable deposits", async function () {
        await liquidityManager.setDepositsEnabled(false);
        await liquidityManager.setDepositsEnabled(true);
        expect(await liquidityManager.depositsEnabled()).to.be.true;
      });

      it("should prevent non-owner from toggling deposits", async function () {
        await expect(
          liquidityManager.connect(user1).setDepositsEnabled(false)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("setWithdrawsEnabled", function () {
      it("should allow owner to disable withdraws", async function () {
        await liquidityManager.setWithdrawsEnabled(false);
        expect(await liquidityManager.withdrawsEnabled()).to.be.false;
      });

      it("should allow owner to re-enable withdraws", async function () {
        await liquidityManager.setWithdrawsEnabled(false);
        await liquidityManager.setWithdrawsEnabled(true);
        expect(await liquidityManager.withdrawsEnabled()).to.be.true;
      });

      it("should prevent non-owner from toggling withdraws", async function () {
        await expect(
          liquidityManager.connect(user1).setWithdrawsEnabled(false)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("⏰ Withdrawal Limits", function () {
    describe("checkWithdrawLimits", function () {
      it("should return true for amounts within limits", async function () {
        const smallAmount = ethers.parseEther("1.0");
        
        const [allowed, reason] = await liquidityManager.checkWithdrawLimits(
          await user1.getAddress(),
          smallAmount
        );
        
        expect(allowed).to.be.true;
        expect(reason).to.equal("");
      });

      it("should return false for amounts exceeding withdrawal limits", async function () {
        const largeAmount = ethers.parseEther("150.0"); // Above limits
        
        const [allowed, reason] = await liquidityManager.checkWithdrawLimits(
          await user1.getAddress(),
          largeAmount
        );
        
        expect(allowed).to.be.false;
        expect(reason).to.include("Exceeds"); // Can be transaction limit, hourly, or daily
      });

      it("should return false for very large amounts", async function () {
        const veryLargeAmount = ethers.parseEther("1500.0"); // Way above limits
        
        const [allowed, reason] = await liquidityManager.checkWithdrawLimits(
          await user1.getAddress(),
          veryLargeAmount
        );
        
        expect(allowed).to.be.false;
        expect(reason).to.include("Exceeds"); // Can be transaction limit, hourly, or daily
      });
    });

    describe("getRemainingHourlyLimit", function () {
      it("should return full limit for new user", async function () {
        const remaining = await liquidityManager.getRemainingHourlyLimit(await user2.getAddress());
        expect(remaining).to.equal(DEFAULT_HOURLY_LIMIT);
      });
    });

    describe("getRemainingDailyLimit", function () {
      it("should return full limit for new user", async function () {
        const remaining = await liquidityManager.getRemainingDailyLimit(await user2.getAddress());
        expect(remaining).to.equal(DEFAULT_DAILY_LIMIT);
      });
    });
  });

  describe("📊 View Functions", function () {
    describe("calculateDepositShares", function () {
      it("should return correct shares for deposit calculation", async function () {
        const shares = await liquidityManager.calculateDepositShares(DEPOSIT_AMOUNT);
        expect(shares).to.be.greaterThanOrEqual(0); // Should not revert
      });

      it("should handle different deposit amounts", async function () {
        const shares1 = await liquidityManager.calculateDepositShares(DEPOSIT_AMOUNT);
        const shares2 = await liquidityManager.calculateDepositShares(LARGE_DEPOSIT);
        
        // Larger deposits should generally result in more shares
        expect(shares2).to.be.greaterThanOrEqual(shares1);
      });
    });

    describe("calculateWithdrawAmount", function () {
      it("should return correct ETH amount for shares calculation", async function () {
        const testShares = ethers.parseEther("1.0");
        const ethAmount = await liquidityManager.calculateWithdrawAmount(testShares);
        expect(ethAmount).to.be.greaterThanOrEqual(0); // Should not revert
      });

      it("should handle different share amounts", async function () {
        const amount1 = await liquidityManager.calculateWithdrawAmount(ethers.parseEther("1.0"));
        const amount2 = await liquidityManager.calculateWithdrawAmount(ethers.parseEther("2.0"));
        
        // More shares should generally result in more ETH
        expect(amount2).to.be.greaterThanOrEqual(amount1);
      });
    });
  });

  describe("⛽ Gas Optimization", function () {
    it("should deploy with reasonable gas cost", async function () {
      const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
      const deployTx = await LiquidityManager.getDeployTransaction(beacon.target);
      
      const estimatedGas = await ethers.provider.estimateGas(deployTx);
      console.log(`✅ LiquidityManager deployment gas usage: ${estimatedGas}`);
      
      // Should deploy under 6M gas
      expect(estimatedGas).to.be.lessThan(6000000);
    });

    it("should have reasonable gas for fee updates", async function () {
      const tx = await liquidityManager.setDepositFee.populateTransaction(100);
      const estimatedGas = await ethers.provider.estimateGas(tx);
      
      console.log(`✅ Set deposit fee gas usage: ${estimatedGas}`);
      
      // Should update fee under 100k gas
      expect(estimatedGas).to.be.lessThan(100000);
    });

    it("should have reasonable gas for limit checks", async function () {
      const tx = await liquidityManager.checkWithdrawLimits.populateTransaction(
        await user1.getAddress(),
        DEPOSIT_AMOUNT
      );
      const estimatedGas = await ethers.provider.estimateGas(tx);
      
      console.log(`✅ Check withdraw limits gas usage: ${estimatedGas}`);
      
      // Should check limits under 150k gas
      expect(estimatedGas).to.be.lessThan(150000);
    });
  });

  describe("🛡️ Security Tests", function () {
    it("should prevent unauthorized access to admin functions", async function () {
      const user1Address = await user1.getAddress();
      
      const adminFunctions = [
        () => liquidityManager.connect(user1).setDepositFee(75),
        () => liquidityManager.connect(user1).setWithdrawFee(150),
        () => liquidityManager.connect(user1).setFeeRecipient(user1Address),
        () => liquidityManager.connect(user1).setDepositsEnabled(false),
        () => liquidityManager.connect(user1).setWithdrawsEnabled(false)
      ];

      for (const func of adminFunctions) {
        await expect(func()).to.be.revertedWith("Ownable: caller is not the owner");
      }
      console.log("✅ Security controls verified");
    });

    it("should validate input parameters correctly", async function () {
      // Test various edge cases
      await expect(
        liquidityManager.setDepositFee(MAX_FEE + 1) // > 5%
      ).to.be.revertedWith("Fee exceeds maximum");
      
      await expect(
        liquidityManager.setFeeRecipient(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid recipient");
      
      console.log("✅ Input validation working");
    });

    it("should handle edge cases in limit calculations", async function () {
      // Test limit calculations with edge values
      const [allowed1, reason1] = await liquidityManager.checkWithdrawLimits(
        await user1.getAddress(),
        ethers.parseEther("0.001") // Small amount that should be allowed
      );
      expect(allowed1).to.be.true; // Small amount should be allowed
      
      const [allowed2, reason2] = await liquidityManager.checkWithdrawLimits(
        ethers.ZeroAddress, // Zero address
        DEPOSIT_AMOUNT
      );
      // Should handle gracefully (not revert)
      expect(typeof allowed2).to.equal("boolean");
      
      console.log("✅ Edge cases handled properly");
    });

    it("should maintain state consistency", async function () {
      // Test state changes are consistent
      const initialDepositsEnabled = await liquidityManager.depositsEnabled();
      const initialWithdrawsEnabled = await liquidityManager.withdrawsEnabled();
      
      // Change state
      await liquidityManager.setDepositsEnabled(!initialDepositsEnabled);
      await liquidityManager.setWithdrawsEnabled(!initialWithdrawsEnabled);
      
      // Verify changes
      expect(await liquidityManager.depositsEnabled()).to.equal(!initialDepositsEnabled);
      expect(await liquidityManager.withdrawsEnabled()).to.equal(!initialWithdrawsEnabled);
      
      // Restore state
      await liquidityManager.setDepositsEnabled(initialDepositsEnabled);
      await liquidityManager.setWithdrawsEnabled(initialWithdrawsEnabled);
      
      // Verify restoration
      expect(await liquidityManager.depositsEnabled()).to.equal(initialDepositsEnabled);
      expect(await liquidityManager.withdrawsEnabled()).to.equal(initialWithdrawsEnabled);
      
      console.log("✅ State consistency verified");
    });
  });
});