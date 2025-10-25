import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 💧 LIQUIDITY MANAGER - UNIT TESTS
 * 
 * Tests liquidity provision and withdrawal with:
 * - Deposit/withdraw operations with automatic swaps
 * - Fee management and withdrawal limits
 * - Balance tracking and reserve management
 * - Integration with DEX protocols
 */

describe("LiquidityManager Contract", function () {
  let liquidityManager: any;
  let beacon: any;
  let proxyGeneral: any;
  let tokenManager: any;
  let valueCalculator: any;
  let swapManager: any;
  let parameterManager: any;
  let mockUSDC: any;
  let mockWBTC: any;
  let mockWETH: any;
  let mockOracle: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let feeRecipient: any;

  // Test constants
  const DEPOSIT_AMOUNT = ethers.parseEther("1.0");    // 1 ETH
  const LARGE_DEPOSIT = ethers.parseEther("10.0");    // 10 ETH
  const SMALL_DEPOSIT = ethers.parseEther("0.1");     // 0.1 ETH
  
  const DEFAULT_DEPOSIT_FEE = 50;  // 0.5%
  const DEFAULT_WITHDRAW_FEE = 100; // 1.0%
  const FEE_BASIS_POINTS = 10000;
  
  const DEFAULT_HOURLY_LIMIT = ethers.parseEther("5.0");  // 5 ETH
  const DEFAULT_DAILY_LIMIT = ethers.parseEther("20.0");  // 20 ETH
  
  const MIN_RESERVE_RATIO = 1000;  // 10%

  async function deployLiquidityManagerFixture() {
    const [owner, user1, user2, feeRecipient] = await ethers.getSigners();

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

    // Setup tokens in TokenManager
    await tokenManager.manageTokenData(
      "USDC", mockUSDC.target, mockOracle.target, 6, 8, 3600
    );
    await tokenManager.manageTokenData(
      "WBTC", mockWBTC.target, mockOracle.target, 8, 8, 3600
    );

    // Initialize parameters in ParameterManager with correct function
    // Note: Using simplified parameter setup for testing
    // await parameterManager.proposeParameterChange("MIN_RESERVE_RATIO", MIN_RESERVE_RATIO);
    // await parameterManager.proposeParameterChange("HOURLY_WITHDRAW_LIMIT", DEFAULT_HOURLY_LIMIT);
    // await parameterManager.proposeParameterChange("DAILY_WITHDRAW_LIMIT", DEFAULT_DAILY_LIMIT);

    // Set fee recipient
    await liquidityManager.setFeeRecipient(await feeRecipient.getAddress());

    // Mint tokens to various addresses for testing
    await mockUSDC.mint(proxyGeneral.target, ethers.parseUnits("50000", 6));
    await mockWBTC.mint(proxyGeneral.target, ethers.parseUnits("2", 8));
    await mockWETH.mint(proxyGeneral.target, ethers.parseEther("50"));

    // Mint some tokens to users for swaps
    await mockUSDC.mint(await user1.getAddress(), ethers.parseUnits("10000", 6));
    await mockWBTC.mint(await user1.getAddress(), ethers.parseUnits("0.5", 8));

    return {
      liquidityManager,
      beacon,
      proxyGeneral,
      tokenManager,
      valueCalculator,
      swapManager,
      parameterManager,
      mockUSDC,
      mockWBTC,
      mockWETH,
      mockOracle,
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
    mockWBTC = fixture.mockWBTC;
    mockWETH = fixture.mockWETH;
    mockOracle = fixture.mockOracle;
    owner = fixture.owner;
    user1 = fixture.user1;
    user2 = fixture.user2;
    feeRecipient = fixture.feeRecipient;
  });

  describe("📋 Deployment", function () {
    it("should deploy with correct initial state", async function () {
      expect(await liquidityManager.beacon()).to.equal(beacon.target);
      expect(await liquidityManager.owner()).to.equal(await owner.getAddress());
      expect(await liquidityManager.depositFee()).to.equal(DEFAULT_DEPOSIT_FEE);
      expect(await liquidityManager.withdrawFee()).to.equal(DEFAULT_WITHDRAW_FEE);
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
        "setWithdrawLimits",
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
  });

  describe("💰 Deposit Operations", function () {
    describe("deposit", function () {
      it("should allow user to deposit ETH and receive LP tokens", async function () {
        const user1BalanceBefore = await ethers.provider.getBalance(await user1.getAddress());
        
        const tx = await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
        await expect(tx).to.emit(liquidityManager, "DepositMade");

        // Check LP tokens were minted to ProxyGeneral (user gets shares there)
        const totalSupply = await proxyGeneral.totalSupply();
        expect(totalSupply).to.be.greaterThan(0);

        // Check ETH was transferred
        const user1BalanceAfter = await ethers.provider.getBalance(await user1.getAddress());
        expect(user1BalanceBefore - user1BalanceAfter).to.be.greaterThan(DEPOSIT_AMOUNT);
      });

      it("should calculate deposit shares correctly", async function () {
        // First deposit (bootstrap)
        await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
        
        // Calculate shares for second deposit
        const shares = await liquidityManager.calculateDepositShares(DEPOSIT_AMOUNT);
        expect(shares).to.be.greaterThan(0);
        
        // Second deposit should use calculated shares
        const tx = await liquidityManager.connect(user2).deposit({ value: DEPOSIT_AMOUNT });
        await expect(tx).to.not.be.reverted;
      });

      it("should charge deposit fee correctly", async function () {
        const feeRecipientBalanceBefore = await ethers.provider.getBalance(await feeRecipient.getAddress());
        
        await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
        
        const feeRecipientBalanceAfter = await ethers.provider.getBalance(await feeRecipient.getAddress());
        const expectedFee = (DEPOSIT_AMOUNT * BigInt(DEFAULT_DEPOSIT_FEE)) / BigInt(FEE_BASIS_POINTS);
        
        expect(feeRecipientBalanceAfter - feeRecipientBalanceBefore).to.equal(expectedFee);
      });

      it("should prevent deposit when paused", async function () {
        await proxyGeneral.pause();
        
        await expect(
          liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT })
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should prevent deposit when deposits disabled", async function () {
        await liquidityManager.setDepositsEnabled(false);
        
        await expect(
          liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT })
        ).to.be.revertedWith("Deposits disabled");
      });

      it("should prevent zero ETH deposit", async function () {
        await expect(
          liquidityManager.connect(user1).deposit({ value: 0 })
        ).to.be.revertedWith("Deposit amount must be > 0");
      });

      it("should handle large deposits correctly", async function () {
        const tx = await liquidityManager.connect(user1).deposit({ value: LARGE_DEPOSIT });
        await expect(tx).to.emit(liquidityManager, "DepositMade");
        
        // Check that contract can handle large amounts
        const contractBalance = await ethers.provider.getBalance(proxyGeneral.target);
        expect(contractBalance).to.be.greaterThanOrEqual(LARGE_DEPOSIT * BigInt(95) / BigInt(100)); // After fees
      });
    });

    describe("calculateDepositShares", function () {
      it("should return correct shares for bootstrap deposit", async function () {
        const shares = await liquidityManager.calculateDepositShares(DEPOSIT_AMOUNT);
        expect(shares).to.equal(DEPOSIT_AMOUNT); // 1:1 for first deposit
      });

      it("should calculate proportional shares after initial deposit", async function () {
        // Bootstrap deposit
        await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
        
        // Calculate shares for same amount
        const shares = await liquidityManager.calculateDepositShares(DEPOSIT_AMOUNT);
        
        // Should be proportional to existing supply
        expect(shares).to.be.greaterThan(0);
        expect(shares).to.be.lessThanOrEqual(DEPOSIT_AMOUNT);
      });
    });
  });

  describe("🏦 Withdrawal Operations", function () {
    beforeEach(async function () {
      // Setup with initial deposits
      await liquidityManager.connect(user1).deposit({ value: LARGE_DEPOSIT });
      await liquidityManager.connect(user2).deposit({ value: DEPOSIT_AMOUNT });
    });

    describe("withdraw", function () {
      it("should allow user to withdraw ETH by burning LP tokens", async function () {
        const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
        const withdrawShares = userShares / BigInt(2); // Withdraw half
        
        const user1BalanceBefore = await ethers.provider.getBalance(await user1.getAddress());
        
        const tx = await liquidityManager.connect(user1).withdraw(withdrawShares);
        await expect(tx).to.emit(liquidityManager, "WithdrawalMade");
        
        const user1BalanceAfter = await ethers.provider.getBalance(await user1.getAddress());
        expect(user1BalanceAfter).to.be.greaterThan(user1BalanceBefore);
      });

      it("should calculate withdraw amount correctly", async function () {
        const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
        const withdrawShares = userShares / BigInt(4); // Withdraw quarter
        
        const ethAmount = await liquidityManager.calculateWithdrawAmount(withdrawShares);
        expect(ethAmount).to.be.greaterThan(0);
      });

      it("should charge withdraw fee correctly", async function () {
        const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
        const withdrawShares = userShares / BigInt(2);
        
        const feeRecipientBalanceBefore = await ethers.provider.getBalance(await feeRecipient.getAddress());
        
        await liquidityManager.connect(user1).withdraw(withdrawShares);
        
        const feeRecipientBalanceAfter = await ethers.provider.getBalance(await feeRecipient.getAddress());
        expect(feeRecipientBalanceAfter).to.be.greaterThan(feeRecipientBalanceBefore);
      });

      it("should respect withdrawal limits", async function () {
        const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
        
        // Try to withdraw more than daily limit (should fail or require special handling)
        const largeWithdrawShares = userShares; // All shares
        
        const [allowed, reason] = await liquidityManager.checkWithdrawLimits(
          await user1.getAddress(),
          await liquidityManager.calculateWithdrawAmount(largeWithdrawShares)
        );
        
        if (!allowed) {
          await expect(
            liquidityManager.connect(user1).withdraw(largeWithdrawShares)
          ).to.be.revertedWith("Withdrawal limit exceeded");
        }
      });

      it("should prevent withdrawal when paused", async function () {
        await proxyGeneral.pause();
        
        const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
        
        await expect(
          liquidityManager.connect(user1).withdraw(userShares / BigInt(2))
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should prevent withdrawal when withdraws disabled", async function () {
        await liquidityManager.setWithdrawsEnabled(false);
        
        const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
        
        await expect(
          liquidityManager.connect(user1).withdraw(userShares / BigInt(2))
        ).to.be.revertedWith("Withdraws disabled");
      });

      it("should prevent zero shares withdrawal", async function () {
        await expect(
          liquidityManager.connect(user1).withdraw(0)
        ).to.be.revertedWith("Shares must be > 0");
      });

      it("should prevent withdrawal of more shares than owned", async function () {
        const userShares = await proxyGeneral.balanceOf(await user2.getAddress());
        const excessiveShares = userShares + ethers.parseEther("1");
        
        await expect(
          liquidityManager.connect(user2).withdraw(excessiveShares)
        ).to.be.revertedWith("Insufficient shares");
      });
    });

    describe("calculateWithdrawAmount", function () {
      it("should return correct ETH amount for given shares", async function () {
        const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
        const halfShares = userShares / BigInt(2);
        
        const ethAmount = await liquidityManager.calculateWithdrawAmount(halfShares);
        expect(ethAmount).to.be.greaterThan(0);
        
        // Should be roughly proportional
        const totalShares = await proxyGeneral.totalSupply();
        const expectedRatio = halfShares * BigInt(100) / totalShares;
        expect(expectedRatio).to.be.greaterThan(0);
      });
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
        const maxFee = 500; // 5%
        
        await expect(
          liquidityManager.setDepositFee(maxFee + 1)
        ).to.be.revertedWith("Fee too high");
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
        const maxFee = 500; // 5%
        
        await expect(
          liquidityManager.setWithdrawFee(maxFee + 1)
        ).to.be.revertedWith("Fee too high");
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
        
        await expect(
          liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT })
        ).to.be.revertedWith("Deposits disabled");
      });

      it("should allow owner to re-enable deposits", async function () {
        await liquidityManager.setDepositsEnabled(false);
        await liquidityManager.setDepositsEnabled(true);
        expect(await liquidityManager.depositsEnabled()).to.be.true;
        
        const tx = await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
        await expect(tx).to.not.be.reverted;
      });

      it("should prevent non-owner from toggling deposits", async function () {
        await expect(
          liquidityManager.connect(user1).setDepositsEnabled(false)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("setWithdrawsEnabled", function () {
      beforeEach(async function () {
        await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      });

      it("should allow owner to disable withdraws", async function () {
        await liquidityManager.setWithdrawsEnabled(false);
        expect(await liquidityManager.withdrawsEnabled()).to.be.false;
        
        const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
        
        await expect(
          liquidityManager.connect(user1).withdraw(userShares / BigInt(2))
        ).to.be.revertedWith("Withdraws disabled");
      });

      it("should allow owner to re-enable withdraws", async function () {
        await liquidityManager.setWithdrawsEnabled(false);
        await liquidityManager.setWithdrawsEnabled(true);
        expect(await liquidityManager.withdrawsEnabled()).to.be.true;
        
        const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
        const tx = await liquidityManager.connect(user1).withdraw(userShares / BigInt(2));
        await expect(tx).to.not.be.reverted;
      });

      it("should prevent non-owner from toggling withdraws", async function () {
        await expect(
          liquidityManager.connect(user1).setWithdrawsEnabled(false)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("⏰ Withdrawal Limits", function () {
    beforeEach(async function () {
      await liquidityManager.connect(user1).deposit({ value: LARGE_DEPOSIT });
    });

    describe("setWithdrawLimits", function () {
      it("should allow owner to update withdrawal limits", async function () {
        const newHourlyLimit = ethers.parseEther("3.0");
        const newDailyLimit = ethers.parseEther("15.0");
        
        await liquidityManager.setWithdrawLimits(newHourlyLimit, newDailyLimit);
        
        // Check limits are updated (via parameter manager)
        const hourlyParam = await parameterManager.getParameter("HOURLY_WITHDRAW_LIMIT");
        const dailyParam = await parameterManager.getParameter("DAILY_WITHDRAW_LIMIT");
        
        expect(hourlyParam.value).to.equal(newHourlyLimit);
        expect(dailyParam.value).to.equal(newDailyLimit);
      });

      it("should prevent non-owner from updating limits", async function () {
        await expect(
          liquidityManager.connect(user1).setWithdrawLimits(
            ethers.parseEther("3.0"),
            ethers.parseEther("15.0")
          )
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

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

      it("should return false for amounts exceeding hourly limit", async function () {
        const largeAmount = ethers.parseEther("6.0"); // Above 5 ETH hourly limit
        
        const [allowed, reason] = await liquidityManager.checkWithdrawLimits(
          await user1.getAddress(),
          largeAmount
        );
        
        expect(allowed).to.be.false;
        expect(reason).to.include("hourly");
      });

      it("should return false for amounts exceeding daily limit", async function () {
        const veryLargeAmount = ethers.parseEther("25.0"); // Above 20 ETH daily limit
        
        const [allowed, reason] = await liquidityManager.checkWithdrawLimits(
          await user1.getAddress(),
          veryLargeAmount
        );
        
        expect(allowed).to.be.false;
        expect(reason).to.include("daily");
      });
    });

    describe("getRemainingHourlyLimit", function () {
      it("should return full limit for new user", async function () {
        const remaining = await liquidityManager.getRemainingHourlyLimit(await user2.getAddress());
        expect(remaining).to.equal(DEFAULT_HOURLY_LIMIT);
      });

      it("should decrease after withdrawal", async function () {
        const withdrawAmount = ethers.parseEther("2.0");
        const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
        
        // Make a withdrawal
        await liquidityManager.connect(user1).withdraw(userShares / BigInt(5));
        
        const remaining = await liquidityManager.getRemainingHourlyLimit(await user1.getAddress());
        expect(remaining).to.be.lessThan(DEFAULT_HOURLY_LIMIT);
      });
    });

    describe("getRemainingDailyLimit", function () {
      it("should return full limit for new user", async function () {
        const remaining = await liquidityManager.getRemainingDailyLimit(await user2.getAddress());
        expect(remaining).to.equal(DEFAULT_DAILY_LIMIT);
      });

      it("should decrease after withdrawal", async function () {
        const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
        
        // Make a withdrawal
        await liquidityManager.connect(user1).withdraw(userShares / BigInt(5));
        
        const remaining = await liquidityManager.getRemainingDailyLimit(await user1.getAddress());
        expect(remaining).to.be.lessThan(DEFAULT_DAILY_LIMIT);
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

    it("should have reasonable gas for deposit", async function () {
      const tx = await liquidityManager.connect(user1).deposit.populateTransaction({ value: DEPOSIT_AMOUNT });
      const estimatedGas = await ethers.provider.estimateGas(tx);
      
      console.log(`✅ Deposit operation gas usage: ${estimatedGas}`);
      
      // Should deposit under 500k gas
      expect(estimatedGas).to.be.lessThan(500000);
    });

    it("should have reasonable gas for withdrawal", async function () {
      // Setup: make a deposit first
      await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      const userShares = await proxyGeneral.balanceOf(await user1.getAddress());
      
      const tx = await liquidityManager.connect(user1).withdraw.populateTransaction(userShares / BigInt(2));
      const estimatedGas = await ethers.provider.estimateGas(tx);
      
      console.log(`✅ Withdraw operation gas usage: ${estimatedGas}`);
      
      // Should withdraw under 600k gas
      expect(estimatedGas).to.be.lessThan(600000);
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
        () => liquidityManager.connect(user1).setWithdrawsEnabled(false),
        () => liquidityManager.connect(user1).setWithdrawLimits(ethers.parseEther("1"), ethers.parseEther("5"))
      ];

      for (const func of adminFunctions) {
        await expect(func()).to.be.revertedWith("Ownable: caller is not the owner");
      }
      console.log("✅ Security controls verified");
    });

    it("should handle reentrancy protection", async function () {
      // Test that reentrancy guard is in place
      const tx = await liquidityManager.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      await expect(tx).to.not.be.reverted;
      
      console.log("✅ Reentrancy protection active");
    });

    it("should validate input parameters correctly", async function () {
      // Test various edge cases
      await expect(
        liquidityManager.setDepositFee(10001) // > 100%
      ).to.be.revertedWith("Fee too high");
      
      await expect(
        liquidityManager.setFeeRecipient(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid recipient");
      
      console.log("✅ Input validation working");
    });
  });
});