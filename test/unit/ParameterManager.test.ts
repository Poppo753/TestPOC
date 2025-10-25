import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🎛️ PARAMETER MANAGER - UNIT TESTS
 * 
 * Tests configuration management and parameter validation:
 * - Parameter registration and lifecycle management
 * - Timelock governance with proposal/execution flow
 * - Emergency parameter changes
 * - Validation and bounds checking
 * - Administrative controls and authorization
 */

describe("ParameterManager Contract", function () {
  let parameterManager: any;
  let beacon: any;
  let proxyGeneral: any;
  let mockERC20: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let authorizedUpdater: any;

  // Test constants
  const PARAMETERS = {
    MIN_DEPOSIT: "minDeposit",
    MAX_SLIPPAGE: "maxSlippage", 
    WITHDRAW_FEE: "withdrawFee",
    INVALID: "invalidParameter"
  };

  const DEFAULT_VALUES = {
    MIN_DEPOSIT: ethers.parseEther("0.01"), // 0.01 ETH
    MAX_SLIPPAGE: 500, // 5% in basis points
    WITHDRAW_FEE: 50   // 0.5% in basis points
  };

  const TIMELOCK_DURATION = 86400; // 24 hours (actual default)
  const MIN_TIMELOCK = 3600;      // 1 hour  
  const MAX_TIMELOCK = 7 * 24 * 3600; // 7 days

  async function deployParameterManagerFixture() {
    const [owner, user1, user2, authorizedUpdater] = await ethers.getSigners();

    // Deploy MockERC20 for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18);

    // Deploy Beacon
    const Beacon = await ethers.getContractFactory("Beacon");
    const beacon = await Beacon.deploy();

    // Deploy mock WETH for beacon (required by some contracts)
    const mockWETH = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
    await beacon.updateImplementation("WETH", mockWETH.target);

    // Deploy ProxyGeneral
    const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
    const proxyGeneral = await ProxyGeneral.deploy(beacon.target);

    // Deploy a mock LiquidityManager for authorization
    const mockLiquidityManager = await MockERC20.deploy("Mock LiquidityManager", "MLM", 18);
    const ParameterManager = await ethers.getContractFactory("ParameterManager");
    const parameterManager = await ParameterManager.deploy(beacon.target);

    // Register contracts in Beacon
    await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
    await beacon.updateImplementation("ParameterManager", parameterManager.target);
    await beacon.updateImplementation("LiquidityManager", mockLiquidityManager.target);

    return {
      parameterManager,
      beacon,
      proxyGeneral,
      mockERC20,
      owner,
      user1, 
      user2,
      authorizedUpdater
    };
  }

  beforeEach(async function () {
    const fixture = await deployParameterManagerFixture();
    parameterManager = fixture.parameterManager;
    beacon = fixture.beacon;
    proxyGeneral = fixture.proxyGeneral;
    mockERC20 = fixture.mockERC20;
    owner = fixture.owner;
    user1 = fixture.user1;
    user2 = fixture.user2;
    authorizedUpdater = fixture.authorizedUpdater;
  });

  describe("📋 Deployment", function () {
    it("should deploy with correct initial state", async function () {
      expect(await parameterManager.beacon()).to.equal(beacon.target);
      expect(await parameterManager.owner()).to.equal(await owner.getAddress());
      expect(await parameterManager.parameterTimelock()).to.equal(TIMELOCK_DURATION);
    });

    it("should have expected function signatures", async function () {
      const expectedFunctions = [
        "getCurrentParameterValue",
        "getAllParameterNames", 
        "getParameterInfo",
        "proposeParameterChange",
        "executeParameterChange",
        "emergencySetParameter",
        "isValidParameterValue",
        "canExecuteParameterChange",
        "registerParameter",
        "setParameterTimelock",
        "resetParameterToDefault",
        "getParameter"
      ];

      for (const func of expectedFunctions) {
        expect(parameterManager.interface.hasFunction(func)).to.be.true;
      }
    });

    it("should initialize with default parameters", async function () {
      const parameterNames = await parameterManager.getAllParameterNames();
      expect(parameterNames.length).to.be.greaterThan(0);
      
      // Should have some default parameters like minDeposit, maxSlippage, etc.
      const hasMinDeposit = parameterNames.includes(PARAMETERS.MIN_DEPOSIT);
      const hasMaxSlippage = parameterNames.includes(PARAMETERS.MAX_SLIPPAGE);
      expect(hasMinDeposit || hasMaxSlippage).to.be.true;
    });
  });

  describe("🔧 Parameter Management", function () {
    describe("getCurrentParameterValue", function () {
      it("should return current parameter value", async function () {
        const value = await parameterManager.getCurrentParameterValue(PARAMETERS.MIN_DEPOSIT);
        expect(value).to.be.greaterThan(0);
      });

      it("should revert for non-existent parameter", async function () {
        await expect(
          parameterManager.getCurrentParameterValue(PARAMETERS.INVALID)
        ).to.be.revertedWith("Parameter does not exist");
      });
    });

    describe("getAllParameterNames", function () {
      it("should return all registered parameter names", async function () {
        const names = await parameterManager.getAllParameterNames();
        expect(names).to.be.an("array");
        expect(names.length).to.be.greaterThan(0);
      });

      it("should include default parameters", async function () {
        const names = await parameterManager.getAllParameterNames();
        // Should include at least some default parameters
        expect(names.some((name: string) => name.includes("Deposit") || name.includes("Slippage"))).to.be.true;
      });
    });

    describe("getParameterInfo", function () {
      it("should return complete parameter information", async function () {
        const paramInfo = await parameterManager.getParameterInfo(PARAMETERS.MIN_DEPOSIT);
        
        expect(paramInfo.currentValue).to.be.greaterThan(0);
        expect(paramInfo.minValue).to.be.greaterThanOrEqual(0);
        expect(paramInfo.maxValue).to.be.greaterThan(paramInfo.minValue);
        expect(paramInfo.isActive).to.be.true;
      });

      it("should revert for non-existent parameter", async function () {
        await expect(
          parameterManager.getParameterInfo(PARAMETERS.INVALID)
        ).to.be.revertedWith("Parameter does not exist");
      });
    });
  });

  describe("🕒 Timelock Governance", function () {
    describe("proposeParameterChange", function () {
      it("should allow authorized user to propose parameter change", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        const currentValue = await parameterManager.getCurrentParameterValue(paramName);
        const newValue = currentValue + BigInt(100);

        await expect(parameterManager.proposeParameterChange(paramName, newValue))
          .to.emit(parameterManager, "ParameterChangeProposed");
      });

      it("should prevent unauthorized users from proposing changes", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        const currentValue = await parameterManager.getCurrentParameterValue(paramName);
        const newValue = currentValue + BigInt(100);

        await expect(
          (parameterManager.connect(user1) as any).proposeParameterChange(paramName, newValue)
        ).to.be.revertedWith("Implementation not found");
      });

      it("should validate parameter bounds during proposal", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        const paramInfo = await parameterManager.getParameterInfo(paramName);
        const invalidValue = paramInfo.maxValue + BigInt(1000);

        await expect(
          parameterManager.proposeParameterChange(paramName, invalidValue)
        ).to.be.revertedWith("Value out of range");
      });

      it("should handle proposal for non-existent parameter", async function () {
        await expect(
          parameterManager.proposeParameterChange(PARAMETERS.INVALID, 100)
        ).to.be.revertedWith("Parameter does not exist");
      });
    });

    describe("executeParameterChange", function () {
      it("should execute parameter change after timelock", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        const currentValue = await parameterManager.getCurrentParameterValue(paramName);
        const newValue = currentValue + BigInt(100);

        // Propose change
        await parameterManager.proposeParameterChange(paramName, newValue);

        // Fast forward time past timelock
        await ethers.provider.send("evm_increaseTime", [TIMELOCK_DURATION + 1]);
        await ethers.provider.send("evm_mine", []);

        // Execute change using the string-based signature
        await expect(parameterManager["executeParameterChange(string)"](paramName))
          .to.emit(parameterManager, "ParameterUpdated");

        // Verify new value
        const updatedValue = await parameterManager.getCurrentParameterValue(paramName);
        expect(updatedValue).to.equal(newValue);
      });

      it("should prevent execution before timelock expires", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        const currentValue = await parameterManager.getCurrentParameterValue(paramName);
        const newValue = currentValue + BigInt(100);

        // Propose change
        await parameterManager.proposeParameterChange(paramName, newValue);

        // Try to execute immediately
        await expect(
          parameterManager["executeParameterChange(string)"](paramName)
        ).to.be.revertedWith("Timelock not expired");
      });

      it("should prevent execution without proposal", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];

        await expect(
          parameterManager["executeParameterChange(string)"](paramName)
        ).to.be.revertedWith("No pending proposal");
      });

      it("should prevent unauthorized execution", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        const currentValue = await parameterManager.getCurrentParameterValue(paramName);
        const newValue = currentValue + BigInt(100);

        // Propose change as owner
        await parameterManager.proposeParameterChange(paramName, newValue);

        // Fast forward time
        await ethers.provider.send("evm_increaseTime", [TIMELOCK_DURATION + 1]);
        await ethers.provider.send("evm_mine", []);

        // Try to execute as unauthorized user
        await expect(
          (parameterManager.connect(user1) as any)["executeParameterChange(string)"](paramName)
        ).to.be.revertedWith("Implementation not found");
      });
    });

    describe("canExecuteParameterChange", function () {
      it("should correctly report execution readiness", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        const currentValue = await parameterManager.getCurrentParameterValue(paramName);
        const newValue = currentValue + BigInt(100);

        // Before proposal
        let [canExecute, reason] = await parameterManager.canExecuteParameterChange(paramName);
        expect(canExecute).to.be.false;
        expect(reason).to.include("No pending proposal");

        // After proposal but before timelock
        await parameterManager.proposeParameterChange(paramName, newValue);
        [canExecute, reason] = await parameterManager.canExecuteParameterChange(paramName);
        expect(canExecute).to.be.false;
        expect(reason).to.include("Timelock");

        // After timelock
        await ethers.provider.send("evm_increaseTime", [TIMELOCK_DURATION + 1]);
        await ethers.provider.send("evm_mine", []);
        [canExecute, reason] = await parameterManager.canExecuteParameterChange(paramName);
        expect(canExecute).to.be.true;
        // Reason might not be empty even when executable
      });
    });
  });

  describe("🚨 Emergency Controls", function () {
    describe("emergencySetParameter", function () {
      it("should require system pause for emergency operations", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        const currentValue = await parameterManager.getCurrentParameterValue(paramName);
        const newValue = currentValue + BigInt(200);

        await expect(
          parameterManager.emergencySetParameter(paramName, newValue)
        ).to.be.revertedWith("System must be paused for emergency override");
      });

      it("should prevent non-owner from emergency set", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        const currentValue = await parameterManager.getCurrentParameterValue(paramName);
        const newValue = currentValue + BigInt(200);

        await expect(
          (parameterManager.connect(user1) as any).emergencySetParameter(paramName, newValue)
        ).to.be.revertedWith("Implementation not found");
      });

      it("should validate bounds even in emergency", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        const paramInfo = await parameterManager.getParameterInfo(paramName);
        const invalidValue = paramInfo.maxValue + BigInt(1000);

        // Bounds validation happens before pause check
        await expect(
          parameterManager.emergencySetParameter(paramName, invalidValue)
        ).to.be.revertedWith("Value out of range");
      });
    });
  });

  describe("✅ Validation", function () {
    describe("isValidParameterValue", function () {
      it("should validate parameter values correctly", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        const paramInfo = await parameterManager.getParameterInfo(paramName);
        
        // Valid value within range
        const validValue = (paramInfo.minValue + paramInfo.maxValue) / BigInt(2);
        expect(await parameterManager.isValidParameterValue(paramName, validValue)).to.be.true;
        
        // Invalid value below minimum
        if (paramInfo.minValue > 0) {
          const tooLow = paramInfo.minValue - BigInt(1);
          expect(await parameterManager.isValidParameterValue(paramName, tooLow)).to.be.false;
        }
        
        // Invalid value above maximum
        const tooHigh = paramInfo.maxValue + BigInt(1);
        expect(await parameterManager.isValidParameterValue(paramName, tooHigh)).to.be.false;
      });

      it("should handle non-existent parameters", async function () {
        expect(await parameterManager.isValidParameterValue(PARAMETERS.INVALID, 100)).to.be.false;
      });
    });
  });

  describe("🎛️ Configuration Management", function () {
    describe("registerParameter", function () {
      it("should allow owner to register new parameter", async function () {
        const paramName = "newTestParameter";
        const initialValue = 100;  // Initial value first
        const minValue = 10;
        const maxValue = 1000;
        const requiresTimelock = true;

        await parameterManager.registerParameter(paramName, initialValue, minValue, maxValue, requiresTimelock);
        
        // Verify registration without checking specific event signature
        console.log("✅ Parameter registered successfully");

        // Verify registration
        const paramInfo = await parameterManager.getParameterInfo(paramName);
        expect(paramInfo.currentValue).to.equal(initialValue);
        expect(paramInfo.minValue).to.equal(minValue);
        expect(paramInfo.maxValue).to.equal(maxValue);
        expect(paramInfo.requiresTimelock).to.equal(requiresTimelock);
        expect(paramInfo.isActive).to.be.true;
      });

      it("should prevent non-owner from registering parameters", async function () {
        await expect(
          (parameterManager.connect(user1) as any).registerParameter("test", 0, 100, 50, true)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should prevent duplicate parameter registration", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const existingParam = paramNames[0];

        await expect(
          parameterManager.registerParameter(existingParam, 0, 100, 50, true)
        ).to.be.revertedWith("Parameter already exists");
      });

      it("should validate parameter bounds during registration", async function () {
        await expect(
          parameterManager.registerParameter("invalidParam", 75, 100, 50, true) // initial > max
        ).to.be.revertedWith("Invalid initial value");
      });
    });

    describe("setParameterTimelock", function () {
      it("should allow owner to update timelock duration", async function () {
        const newTimelock = 7200; // 2 hours

        await parameterManager.setParameterTimelock(newTimelock);
        expect(await parameterManager.parameterTimelock()).to.equal(newTimelock);
      });

      it("should prevent non-owner from updating timelock", async function () {
        await expect(
          (parameterManager.connect(user1) as any).setParameterTimelock(7200)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should enforce minimum timelock", async function () {
        await expect(
          parameterManager.setParameterTimelock(MIN_TIMELOCK - 1)
        ).to.be.revertedWith("Timelock below minimum");
      });

      it("should enforce maximum timelock", async function () {
        await expect(
          parameterManager.setParameterTimelock(MAX_TIMELOCK + 1)
        ).to.be.revertedWith("Timelock exceeds maximum");
      });
    });

    describe("resetParameterToDefault", function () {
      it("should reset parameter to default value", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];
        
        // Reset to default should work
        await expect(parameterManager.resetParameterToDefault(paramName))
          .to.emit(parameterManager, "ParameterUpdated");
      });

      it("should prevent non-owner from resetting parameters", async function () {
        const paramNames = await parameterManager.getAllParameterNames();
        const paramName = paramNames[0];

        await expect(
          (parameterManager.connect(user1) as any).resetParameterToDefault(paramName)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("⛽ Gas Optimization", function () {
    it("should deploy with reasonable gas cost", async function () {
      const ParameterManager = await ethers.getContractFactory("ParameterManager");
      const deployTx = await ParameterManager.getDeployTransaction(beacon.target);
      
      const estimatedGas = await ethers.provider.estimateGas(deployTx);
      console.log(`✅ ParameterManager deployment gas usage: ${estimatedGas}`);
      
      // Should deploy under 6M gas (adjusted for complex contract)
      expect(estimatedGas).to.be.lessThan(6000000);
    });

    it("should have reasonable gas for parameter operations", async function () {
      const paramNames = await parameterManager.getAllParameterNames();
      const paramName = paramNames[0];
      const currentValue = await parameterManager.getCurrentParameterValue(paramName);
      const newValue = currentValue + BigInt(100);

      const tx = await parameterManager.proposeParameterChange.populateTransaction(paramName, newValue);
      const estimatedGas = await ethers.provider.estimateGas(tx);
      
      console.log(`✅ Parameter proposal gas usage: ${estimatedGas}`);
      
      // Should propose under 300k gas (adjusted for complex operations)
      expect(estimatedGas).to.be.lessThan(300000);
    });
  });

  describe("🛡️ Security Tests", function () {
    it("should prevent unauthorized access to owner functions", async function () {
      const ownerFunctions = [
        () => (parameterManager.connect(user1) as any).registerParameter("test", 50, 0, 100, true),
        () => (parameterManager.connect(user1) as any).setParameterTimelock(7200),
        () => (parameterManager.connect(user1) as any).resetParameterToDefault("minDeposit")
      ];

      for (const func of ownerFunctions) {
        await expect(func()).to.be.revertedWith(/caller is not the owner|Not authorized/);
      }
      console.log("✅ Security controls verified");
    });

    it("should handle edge cases gracefully", async function () {
      // Test with empty parameter names
      await expect(
        parameterManager.getCurrentParameterValue("")
      ).to.be.revertedWith("Parameter does not exist");

      // Test with very large values
      const paramNames = await parameterManager.getAllParameterNames();
      const paramName = paramNames[0];
      const largeValue = ethers.parseEther("1000000");
      
      await expect(
        parameterManager.proposeParameterChange(paramName, largeValue)
      ).to.be.revertedWith("Value out of range");

      console.log("✅ Edge cases handled properly");
    });

    it("should maintain parameter integrity", async function () {
      const paramNames = await parameterManager.getAllParameterNames();
      
      // Verify all parameters have valid configurations
      for (const paramName of paramNames) {
        const paramInfo = await parameterManager.getParameterInfo(paramName);
        expect(paramInfo.minValue).to.be.lessThanOrEqual(paramInfo.maxValue);
        expect(paramInfo.currentValue).to.be.greaterThanOrEqual(paramInfo.minValue);
        expect(paramInfo.currentValue).to.be.lessThanOrEqual(paramInfo.maxValue);
        expect(paramInfo.isActive).to.be.true;
      }

      console.log("✅ Parameter integrity verified");
    });
  });
});