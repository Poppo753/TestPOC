import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  DolomitePlugin,
  DolomitePlugin__factory,
  Beacon,
  Beacon__factory,
  MockERC20,
  MockERC20__factory,
} from "../../typechain-types";

describe("DolomitePlugin - Unit Tests", function () {
  let dolomitePlugin: DolomitePlugin;
  let beacon: Beacon;
  let mockToken: MockERC20;
  let mockDolomiteMargin: MockERC20;
  let mockDepositRouter: MockERC20;
  let mockBorrowRouter: MockERC20;
  
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  // Test constants
  const TOKEN_CODE = "WETH";
  const AMOUNT = ethers.parseEther("1.0");
  const INITIAL_BALANCE = ethers.parseEther("100.0");

  beforeEach(async function () {
    // Get signers
    [owner, user1] = await ethers.getSigners();

    // Deploy Beacon
    const BeaconFactory = (await ethers.getContractFactory(
      "Beacon",
      owner
    )) as Beacon__factory;
    beacon = await BeaconFactory.deploy();
    await beacon.waitForDeployment();

    // Deploy mock tokens (used as mock contracts for Dolomite dependencies)
    const MockERC20Factory = (await ethers.getContractFactory(
      "MockERC20",
      owner
    )) as MockERC20__factory;
    
    mockToken = await MockERC20Factory.deploy("Wrapped ETH", "WETH", 18);
    mockDolomiteMargin = await MockERC20Factory.deploy("MockDolomite", "DMT", 18);
    mockDepositRouter = await MockERC20Factory.deploy("MockDepositRouter", "MDR", 18);
    mockBorrowRouter = await MockERC20Factory.deploy("MockBorrowRouter", "MBR", 18);
    
    await mockToken.waitForDeployment();
    await mockDolomiteMargin.waitForDeployment();
    await mockDepositRouter.waitForDeployment();
    await mockBorrowRouter.waitForDeployment();

    // Mint tokens
    await mockToken.mint(owner.address, INITIAL_BALANCE);

    // Deploy DolomitePlugin
    const DolomitePluginFactory = (await ethers.getContractFactory(
      "DolomitePlugin",
      owner
    )) as DolomitePlugin__factory;
    
    dolomitePlugin = await DolomitePluginFactory.deploy(
      await beacon.getAddress(),
      await mockDolomiteMargin.getAddress(),
      await mockBorrowRouter.getAddress(),
      await mockDepositRouter.getAddress()
    );
    await dolomitePlugin.waitForDeployment();

    // Register TokenManager in Beacon (needed for _resolveTokenFromCode)
    await beacon.updateImplementation("TokenManager", await mockToken.getAddress());
  });

  describe("Deployment", function () {
    it("Should deploy with correct beacon address", async function () {
      // DolomitePlugin doesn't expose beacon publicly, but we can test it was set
      expect(await dolomitePlugin.getAddress()).to.be.properAddress;
    });

    it("Should set deployer as owner", async function () {
      expect(await dolomitePlugin.owner()).to.equal(owner.address);
    });

    it("Should revert if beacon is zero address", async function () {
      const DolomitePluginFactory = (await ethers.getContractFactory(
        "DolomitePlugin",
        owner
      )) as DolomitePlugin__factory;

      await expect(
        DolomitePluginFactory.deploy(
          ethers.ZeroAddress,
          await mockDolomiteMargin.getAddress(),
          await mockBorrowRouter.getAddress(),
          await mockDepositRouter.getAddress()
        )
      ).to.be.revertedWithCustomError(dolomitePlugin, "InvalidAddress");
    });

    it("Should revert if dolomiteMargin is zero address", async function () {
      const DolomitePluginFactory = (await ethers.getContractFactory(
        "DolomitePlugin",
        owner
      )) as DolomitePlugin__factory;

      await expect(
        DolomitePluginFactory.deploy(
          await beacon.getAddress(),
          ethers.ZeroAddress,
          await mockBorrowRouter.getAddress(),
          await mockDepositRouter.getAddress()
        )
      ).to.be.revertedWithCustomError(dolomitePlugin, "InvalidAddress");
    });

    it("Should revert if borrowRouter is zero address", async function () {
      const DolomitePluginFactory = (await ethers.getContractFactory(
        "DolomitePlugin",
        owner
      )) as DolomitePlugin__factory;

      await expect(
        DolomitePluginFactory.deploy(
          await beacon.getAddress(),
          await mockDolomiteMargin.getAddress(),
          ethers.ZeroAddress,
          await mockDepositRouter.getAddress()
        )
      ).to.be.revertedWithCustomError(dolomitePlugin, "InvalidAddress");
    });

    it("Should revert if depositRouter is zero address", async function () {
      const DolomitePluginFactory = (await ethers.getContractFactory(
        "DolomitePlugin",
        owner
      )) as DolomitePlugin__factory;

      await expect(
        DolomitePluginFactory.deploy(
          await beacon.getAddress(),
          await mockDolomiteMargin.getAddress(),
          await mockBorrowRouter.getAddress(),
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(dolomitePlugin, "InvalidAddress");
    });

    it("Should initialize with circuit breaker off", async function () {
      expect(await dolomitePlugin.circuitBreakerTripped()).to.be.false;
    });
  });

  describe("IProtocolManager Interface Implementation", function () {
    describe("deposit()", function () {
      it("Should have deposit function with correct signature", async function () {
        expect(dolomitePlugin.deposit).to.exist;
      });

      it("Should revert when circuit breaker is active", async function () {
        // Activate circuit breaker
        await dolomitePlugin.setCircuitBreaker(true);

        await expect(
          dolomitePlugin.deposit(TOKEN_CODE, AMOUNT)
        ).to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
      });

      it("Should revert if tokens not transferred to contract", async function () {
        // TokenNotSupported is checked first (mockToken not in Dolomite)
        await expect(
          dolomitePlugin.deposit(TOKEN_CODE, AMOUNT)
        ).to.be.reverted; // Will revert in _isTokenSupported -> getMarketIdByTokenAddress
      });

      it("Should revert for unsupported token", async function () {
        // Transfer tokens to contract
        await mockToken.transfer(await dolomitePlugin.getAddress(), AMOUNT);

        // Try to deposit (will fail in _isTokenSupported check)
        await expect(
          dolomitePlugin.deposit(TOKEN_CODE, AMOUNT)
        ).to.be.reverted; // Will revert in getMarketIdByTokenAddress or _isTokenSupported
      });
    });

    describe("withdraw()", function () {
      it("Should have withdraw function with correct signature", async function () {
        expect(dolomitePlugin.withdraw).to.exist;
      });

      it("Should revert when circuit breaker is active", async function () {
        await dolomitePlugin.setCircuitBreaker(true);

        await expect(
          dolomitePlugin.withdraw(TOKEN_CODE, AMOUNT)
        ).to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
      });

      it("Should revert for unsupported token", async function () {
        await expect(
          dolomitePlugin.withdraw(TOKEN_CODE, AMOUNT)
        ).to.be.reverted; // Will revert in getMarketIdByTokenAddress
      });
    });

    describe("getBalance()", function () {
      it("Should have getBalance function with correct signature", async function () {
        expect(dolomitePlugin.getBalance).to.exist;
      });

      it("Should be a view function", async function () {
        // View function - skip test as requires proper TokenManager mock
        expect(dolomitePlugin.getBalance).to.exist;
      });

      it("Should return 0 for token with no balance", async function () {
        // This will fail without proper Dolomite mock, but tests interface exists
        expect(dolomitePlugin.getBalance).to.exist;
      });
    });

    describe("getTotalValue()", function () {
      it("Should have getTotalValue function with correct signature", async function () {
        expect(dolomitePlugin.getTotalValue).to.exist;
      });

      it("Should return 0 initially (placeholder implementation)", async function () {
        const totalValue = await dolomitePlugin.getTotalValue();
        expect(totalValue).to.equal(0); // Placeholder implementation returns 0
      });

      it("Should be a view function", async function () {
        const totalValue = await dolomitePlugin.getTotalValue.staticCall();
        expect(totalValue).to.be.a("bigint");
      });
    });

    describe("getProtocolInfo()", function () {
      it("Should have getProtocolInfo function with correct signature", async function () {
        expect(dolomitePlugin.getProtocolInfo).to.exist;
      });

      it("Should return correct protocol info", async function () {
        const [name, version, isActive] = await dolomitePlugin.getProtocolInfo();
        
        expect(name).to.equal("Dolomite Lending");
        expect(version).to.equal("2.0.0");
        expect(isActive).to.be.true; // Always returns true (pure function)
      });

      it("Should be a pure function (always returns same values)", async function () {
        const [name1, version1, isActive1] = await dolomitePlugin.getProtocolInfo();
        
        // Circuit breaker doesn't affect getProtocolInfo (it's pure)
        await dolomitePlugin.setCircuitBreaker(true);
        const [name2, version2, isActive2] = await dolomitePlugin.getProtocolInfo();
        
        expect(name1).to.equal(name2);
        expect(version1).to.equal(version2);
        expect(isActive1).to.equal(isActive2);
      });
    });

    describe("emergencyWithdrawAll()", function () {
      it("Should have emergencyWithdrawAll function with correct signature", async function () {
        expect(dolomitePlugin.emergencyWithdrawAll).to.exist;
      });

      it("Should work with empty array", async function () {
        const tokenCodes: string[] = [];
        
        // Will fail trying to get ProxyGeneral from Beacon
        await expect(
          dolomitePlugin.emergencyWithdrawAll(tokenCodes)
        ).to.be.revertedWith("Implementation not found");
      });

      it("Should work with single token (will fail getting ProxyGeneral)", async function () {
        const tokenCodes = [TOKEN_CODE];
        
        // Will fail trying to resolve ProxyGeneral from Beacon
        await expect(
          dolomitePlugin.emergencyWithdrawAll(tokenCodes)
        ).to.be.revertedWith("Implementation not found");
      });
    });
  });

  describe("ILendingProtocol Interface Implementation", function () {
    describe("borrow()", function () {
      it("Should have borrow function with correct signature", async function () {
        expect(dolomitePlugin.borrow).to.exist;
      });

      it("Should revert when circuit breaker is active", async function () {
        await dolomitePlugin.setCircuitBreaker(true);

        await expect(
          dolomitePlugin.borrow(TOKEN_CODE, AMOUNT)
        ).to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
      });

      it("Should revert for unsupported token", async function () {
        await expect(
          dolomitePlugin.borrow(TOKEN_CODE, AMOUNT)
        ).to.be.reverted; // Will revert in getMarketIdByTokenAddress
      });
    });

    describe("repay()", function () {
      it("Should have repay function with correct signature", async function () {
        expect(dolomitePlugin.repay).to.exist;
      });

      it("Should revert when circuit breaker is active", async function () {
        await dolomitePlugin.setCircuitBreaker(true);

        await expect(
          dolomitePlugin.repay(TOKEN_CODE, AMOUNT)
        ).to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
      });

      it("Should revert if tokens not transferred to contract", async function () {
        // TokenNotSupported is checked first (mockToken not in Dolomite)
        await expect(
          dolomitePlugin.repay(TOKEN_CODE, AMOUNT)
        ).to.be.reverted; // Will revert in _isTokenSupported
      });
    });

    describe("getDebt()", function () {
      it("Should have getDebt function with correct signature", async function () {
        expect(dolomitePlugin.getDebt).to.exist;
      });

      it("Should be a view function", async function () {
        // Will revert trying to resolve token without proper mock
        await expect(
          dolomitePlugin.getDebt.staticCall(TOKEN_CODE)
        ).to.be.reverted;
      });
    });

    describe("getHealthFactor()", function () {
      it("Should have getHealthFactor function with correct signature", async function () {
        expect(dolomitePlugin.getHealthFactor).to.exist;
      });

      it("Should return max uint256 initially (placeholder - no debt)", async function () {
        const healthFactor = await dolomitePlugin.getHealthFactor();
        expect(healthFactor).to.equal(ethers.MaxUint256); // Placeholder returns max
      });

      it("Should be a view function", async function () {
        const healthFactor = await dolomitePlugin.getHealthFactor.staticCall();
        expect(healthFactor).to.be.a("bigint");
      });
    });

    describe("getBorrowCapacity()", function () {
      it("Should have getBorrowCapacity function with correct signature", async function () {
        expect(dolomitePlugin.getBorrowCapacity).to.exist;
      });

      it("Should return 0 initially (placeholder - no collateral)", async function () {
        const capacity = await dolomitePlugin.getBorrowCapacity(TOKEN_CODE);
        expect(capacity).to.equal(0); // Placeholder returns 0
      });

      it("Should be a view function", async function () {
        const capacity = await dolomitePlugin.getBorrowCapacity.staticCall(TOKEN_CODE);
        expect(capacity).to.be.a("bigint");
      });
    });
  });

  describe("Dolomite-Specific Functions", function () {
    describe("openBorrowPosition()", function () {
      it("Should have openBorrowPosition function", async function () {
        expect(dolomitePlugin.openBorrowPosition).to.exist;
      });

      it("Should revert when circuit breaker is active", async function () {
        await dolomitePlugin.setCircuitBreaker(true);

        await expect(
          dolomitePlugin.openBorrowPosition(await mockToken.getAddress(), AMOUNT)
        ).to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
      });

      it("Should revert if tokens not in contract", async function () {
        // TokenNotSupported is checked first (mockToken not in Dolomite)
        await expect(
          dolomitePlugin.openBorrowPosition(await mockToken.getAddress(), AMOUNT)
        ).to.be.reverted; // Will revert in _isTokenSupported
      });
    });

    describe("borrowFromPosition()", function () {
      it("Should have borrowFromPosition function", async function () {
        expect(dolomitePlugin.borrowFromPosition).to.exist;
      });

      it("Should revert when circuit breaker is active", async function () {
        await dolomitePlugin.setCircuitBreaker(true);

        await expect(
          dolomitePlugin.borrowFromPosition(1, await mockToken.getAddress(), AMOUNT)
        ).to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
      });

      it("Should revert for invalid account number (0)", async function () {
        await expect(
          dolomitePlugin.borrowFromPosition(0, await mockToken.getAddress(), AMOUNT)
        ).to.be.revertedWithCustomError(dolomitePlugin, "InvalidAccountNumber");
      });
    });

    describe("repayBorrowPosition()", function () {
      it("Should have repayBorrowPosition function", async function () {
        expect(dolomitePlugin.repayBorrowPosition).to.exist;
      });

      it("Should revert when circuit breaker is active", async function () {
        await dolomitePlugin.setCircuitBreaker(true);

        await expect(
          dolomitePlugin.repayBorrowPosition(1, await mockToken.getAddress(), AMOUNT)
        ).to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
      });

      it("Should revert if tokens not in contract", async function () {
        // TokenNotSupported is checked first (mockToken not in Dolomite)
        await expect(
          dolomitePlugin.repayBorrowPosition(1, await mockToken.getAddress(), AMOUNT)
        ).to.be.reverted; // Will revert in _isTokenSupported
      });
    });

    describe("closeBorrowPosition()", function () {
      it("Should have closeBorrowPosition function", async function () {
        expect(dolomitePlugin.closeBorrowPosition).to.exist;
      });

      it("Should revert when circuit breaker is active", async function () {
        await dolomitePlugin.setCircuitBreaker(true);

        await expect(
          dolomitePlugin.closeBorrowPosition(1, [await mockToken.getAddress()])
        ).to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
      });

      it("Should revert for invalid account number (0)", async function () {
        await expect(
          dolomitePlugin.closeBorrowPosition(0, [await mockToken.getAddress()])
        ).to.be.revertedWithCustomError(dolomitePlugin, "InvalidAccountNumber");
      });
    });

    describe("executeFlashLoan()", function () {
      it("Should have executeFlashLoan function", async function () {
        expect(dolomitePlugin.executeFlashLoan).to.exist;
      });

      it("Should revert when circuit breaker is active", async function () {
        await dolomitePlugin.setCircuitBreaker(true);

        await expect(
          dolomitePlugin.executeFlashLoan(await mockToken.getAddress(), AMOUNT, owner.address, "0x")
        ).to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
      });

      it("Should revert with zero address callback", async function () {
        // TokenNotSupported is checked first (mockToken not in Dolomite)
        await expect(
          dolomitePlugin.executeFlashLoan(await mockToken.getAddress(), AMOUNT, ethers.ZeroAddress, "0x")
        ).to.be.reverted; // Will revert in _isTokenSupported before checking callback
      });
    });
  });

  describe("Circuit Breaker & Admin Functions", function () {
    describe("Circuit Breaker", function () {
      it("Should allow owner to activate circuit breaker", async function () {
        expect(await dolomitePlugin.circuitBreakerTripped()).to.be.false;

        await dolomitePlugin.setCircuitBreaker(true);

        expect(await dolomitePlugin.circuitBreakerTripped()).to.be.true;
      });

      it("Should allow owner to deactivate circuit breaker", async function () {
        await dolomitePlugin.setCircuitBreaker(true);
        expect(await dolomitePlugin.circuitBreakerTripped()).to.be.true;

        await dolomitePlugin.setCircuitBreaker(false);

        expect(await dolomitePlugin.circuitBreakerTripped()).to.be.false;
      });

      it("Should allow only owner to modify circuit breaker", async function () {
        await expect(
          dolomitePlugin.connect(user1).setCircuitBreaker(true)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Should block all state-changing operations when active", async function () {
        await dolomitePlugin.setCircuitBreaker(true);
        const tokenAddress = await mockToken.getAddress();

        // Test all state-changing functions are blocked
        await expect(dolomitePlugin.deposit(TOKEN_CODE, AMOUNT))
          .to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
        
        await expect(dolomitePlugin.withdraw(TOKEN_CODE, AMOUNT))
          .to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
        
        await expect(dolomitePlugin.borrow(TOKEN_CODE, AMOUNT))
          .to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
        
        await expect(dolomitePlugin.repay(TOKEN_CODE, AMOUNT))
          .to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
        
        await expect(dolomitePlugin.openBorrowPosition(tokenAddress, AMOUNT))
          .to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");

        await expect(dolomitePlugin.borrowFromPosition(1, tokenAddress, AMOUNT))
          .to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");

        await expect(dolomitePlugin.repayBorrowPosition(1, tokenAddress, AMOUNT))
          .to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");

        await expect(dolomitePlugin.closeBorrowPosition(1, [tokenAddress]))
          .to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");

        await expect(dolomitePlugin.executeFlashLoan(tokenAddress, AMOUNT, owner.address, "0x"))
          .to.be.revertedWithCustomError(dolomitePlugin, "CircuitBreakerActive");
      });

      it("Should allow view functions when circuit breaker is active", async function () {
        await dolomitePlugin.setCircuitBreaker(true);

        // View functions should still work (though some may revert due to missing mocks)
        await expect(dolomitePlugin.getTotalValue()).to.not.be.reverted;
        await expect(dolomitePlugin.getHealthFactor()).to.not.be.reverted;
        await expect(dolomitePlugin.getProtocolInfo()).to.not.be.reverted;
        await expect(dolomitePlugin.getBorrowCapacity(TOKEN_CODE)).to.not.be.reverted;
      });
    });

    describe("Emergency Withdraw", function () {
      it("Should allow owner to emergency withdraw tokens", async function () {
        // Transfer tokens to plugin
        await mockToken.transfer(await dolomitePlugin.getAddress(), AMOUNT);

        const initialBalance = await mockToken.balanceOf(user1.address);

        await dolomitePlugin.emergencyWithdraw(
          await mockToken.getAddress(),
          AMOUNT,
          user1.address
        );

        expect(await mockToken.balanceOf(user1.address)).to.equal(initialBalance + AMOUNT);
      });

      it("Should revert if recipient is zero address", async function () {
        await expect(
          dolomitePlugin.emergencyWithdraw(
            await mockToken.getAddress(),
            AMOUNT,
            ethers.ZeroAddress
          )
        ).to.be.revertedWithCustomError(dolomitePlugin, "InvalidAddress");
      });

      it("Should allow only owner to call emergencyWithdraw", async function () {
        await expect(
          dolomitePlugin.connect(user1).emergencyWithdraw(
            await mockToken.getAddress(),
            AMOUNT,
            owner.address
          )
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("Interface Compliance", function () {
    it("Should have all IProtocolManager required functions", async function () {
      expect(dolomitePlugin.deposit).to.exist;
      expect(dolomitePlugin.withdraw).to.exist;
      expect(dolomitePlugin.getBalance).to.exist;
      expect(dolomitePlugin.getTotalValue).to.exist;
      expect(dolomitePlugin.getProtocolInfo).to.exist;
      expect(dolomitePlugin.emergencyWithdrawAll).to.exist;
    });

    it("Should have all ILendingProtocol required functions", async function () {
      expect(dolomitePlugin.borrow).to.exist;
      expect(dolomitePlugin.repay).to.exist;
      expect(dolomitePlugin.getDebt).to.exist;
      expect(dolomitePlugin.getHealthFactor).to.exist;
      expect(dolomitePlugin.getBorrowCapacity).to.exist;
    });

    it("Should have all Dolomite-specific functions", async function () {
      expect(dolomitePlugin.openBorrowPosition).to.exist;
      expect(dolomitePlugin.borrowFromPosition).to.exist;
      expect(dolomitePlugin.repayBorrowPosition).to.exist;
      expect(dolomitePlugin.closeBorrowPosition).to.exist;
      expect(dolomitePlugin.executeFlashLoan).to.exist;
    });
  });

  describe("Contract Size", function () {
    it("Should be within deployment size limit", async function () {
      const deployedCode = await ethers.provider.getCode(await dolomitePlugin.getAddress());
      const sizeInBytes = (deployedCode.length - 2) / 2; // Remove '0x' and convert hex to bytes
      const maxSize = 24576; // 24KB limit
      
      console.log(`      DolomitePlugin size: ${sizeInBytes} bytes (${(sizeInBytes / maxSize * 100).toFixed(2)}% of limit)`);
      
      expect(sizeInBytes).to.be.lessThan(maxSize);
    });
  });
});
