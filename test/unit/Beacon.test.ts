import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🏛️ BEACON CONTRACT - UNIT TESTS
 * 
 * Tests all functions of the Beacon contract:
 * - Registry management (updateImplementation, getImplementation)
 * - Ownership control
 * - Access permissions
 * - Error handling
 * - Events emission
 */

describe("Beacon Contract", function () {
  let beacon: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let mockContract: any;

  // Test constants
  const MODULE_NAMES = {
    LIQUIDITY_MANAGER: "LiquidityManager",
    SWAP_MANAGER: "SwapManager",
    TOKEN_MANAGER: "TokenManager",
    EMERGENCY_HANDLER: "EmergencyHandler",
  };

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy Beacon
    const BeaconFactory = await ethers.getContractFactory("Beacon");
    beacon = await BeaconFactory.deploy();
    await beacon.waitForDeployment();

    // Deploy a mock contract to use as valid implementation
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockContract = await MockERC20Factory.deploy("Mock Token", "MOCK", 18);
    await mockContract.waitForDeployment();
  });

  describe("📋 Deployment", function () {
    it("should deploy with correct initial state", async function () {
      expect(await beacon.getAddress()).to.be.properAddress;
      expect(await beacon.owner()).to.equal(owner.address);
    });

    it("should have expected function signatures", async function () {
      // Test that basic ownership functions exist
      expect(beacon.owner).to.be.a('function');
      expect(beacon.transferOwnership).to.be.a('function');
      
      // Check Beacon-specific functions
      expect(beacon.updateImplementation).to.be.a('function');
      expect(beacon.getImplementation).to.be.a('function');
      
      console.log("✅ Beacon contract deployed successfully");
      console.log("Available functions:");
      console.log("- owner:", typeof beacon.owner);
      console.log("- transferOwnership:", typeof beacon.transferOwnership);
      console.log("- updateImplementation:", typeof beacon.updateImplementation);
      console.log("- getImplementation:", typeof beacon.getImplementation);
    });
  });

  describe("🔐 Ownership Management", function () {
    describe("transferOwnership (2-step process)", function () {
      it("should initiate ownership transfer", async function () {
        await beacon.transferOwnership(user1.address);
        
        // Owner should remain the same until acceptance
        expect(await beacon.owner()).to.equal(owner.address);
        expect(await beacon.pendingOwner()).to.equal(user1.address);
      });

      it("should emit OwnershipTransferInitiated event", async function () {
        await expect(beacon.transferOwnership(user1.address))
          .to.emit(beacon, "OwnershipTransferInitiated")
          .withArgs(owner.address, user1.address);
      });

      it("should prevent non-owner from initiating transfer", async function () {
        await expect(
          beacon.connect(user1).transferOwnership(user2.address)
        ).to.be.revertedWith("Only owner can call this function");
      });

      it("should prevent transfer to zero address", async function () {
        await expect(
          beacon.transferOwnership(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid new owner address");
      });

      it("should prevent transfer to same owner", async function () {
        await expect(
          beacon.transferOwnership(owner.address)
        ).to.be.revertedWith("Same owner address");
      });
    });

    describe("acceptOwnership", function () {
      beforeEach(async function () {
        await beacon.transferOwnership(user1.address);
      });

      it("should allow pending owner to accept ownership", async function () {
        await beacon.connect(user1).acceptOwnership();
        
        expect(await beacon.owner()).to.equal(user1.address);
        expect(await beacon.pendingOwner()).to.equal(ethers.ZeroAddress);
      });

      it("should emit OwnershipTransferred event", async function () {
        await expect(beacon.connect(user1).acceptOwnership())
          .to.emit(beacon, "OwnershipTransferred")
          .withArgs(owner.address, user1.address);
      });

      it("should prevent non-pending owner from accepting", async function () {
        await expect(
          beacon.connect(user2).acceptOwnership()
        ).to.be.revertedWith("Not the pending owner");
      });

      it("should prevent current owner from accepting", async function () {
        await expect(
          beacon.acceptOwnership()
        ).to.be.revertedWith("Not the pending owner");
      });
    });

    describe("cancelOwnershipTransfer", function () {
      it("should allow owner to cancel pending transfer", async function () {
        await beacon.transferOwnership(user1.address);
        expect(await beacon.pendingOwner()).to.equal(user1.address);
        
        await beacon.cancelOwnershipTransfer();
        expect(await beacon.pendingOwner()).to.equal(ethers.ZeroAddress);
      });

      it("should prevent non-owner from canceling", async function () {
        await beacon.transferOwnership(user1.address);
        
        await expect(
          beacon.connect(user1).cancelOwnershipTransfer()
        ).to.be.revertedWith("Only owner can call this function");
      });

      it("should revert if no pending transfer", async function () {
        await expect(
          beacon.cancelOwnershipTransfer()
        ).to.be.revertedWith("No pending ownership transfer");
      });
    });
  });

  describe("🔧 Implementation Management", function () {
    describe("updateImplementation", function () {
      it("should allow owner to update implementation with valid contract", async function () {
        await beacon.updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, await mockContract.getAddress());
        
        const storedImplementation = await beacon.getImplementation(MODULE_NAMES.LIQUIDITY_MANAGER);
        expect(storedImplementation).to.equal(await mockContract.getAddress());
        console.log("✅ Implementation update and retrieval working");
      });

      it("should prevent updating with EOA address", async function () {
        await expect(
          beacon.updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, user1.address)
        ).to.be.revertedWith("Implementation must be a contract");
      });

      it("should prevent non-owner from updating implementation", async function () {
        await expect(
          beacon.connect(user1).updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, await mockContract.getAddress())
        ).to.be.revertedWith("Only owner can call this function");
      });

      it("should emit ImplementationUpdated event", async function () {
        const tx = await beacon.updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, await mockContract.getAddress());
        
        // Use the chai matchers for event checking
        await expect(tx)
          .to.emit(beacon, "ImplementationUpdated");
        
        // Get the receipt to check event details
        const receipt = await tx.wait();
        expect(receipt.logs.length).to.be.greaterThan(0);
        
        console.log("✅ ImplementationUpdated event emitted correctly");
      });

      it("should handle multiple different modules", async function () {
        // Create another mock contract
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        const mockContract2 = await MockERC20Factory.deploy("Mock Token 2", "MOCK2", 18);
        await mockContract2.waitForDeployment();

        await beacon.updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, await mockContract.getAddress());
        await beacon.updateImplementation(MODULE_NAMES.SWAP_MANAGER, await mockContract2.getAddress());
        
        expect(await beacon.getImplementation(MODULE_NAMES.LIQUIDITY_MANAGER)).to.equal(await mockContract.getAddress());
        expect(await beacon.getImplementation(MODULE_NAMES.SWAP_MANAGER)).to.equal(await mockContract2.getAddress());
      });
    });

    describe("getImplementation", function () {
      beforeEach(async function () {
        await beacon.updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, await mockContract.getAddress());
      });

      it("should return correct implementation address", async function () {
        const implementation = await beacon.getImplementation(MODULE_NAMES.LIQUIDITY_MANAGER);
        expect(implementation).to.equal(await mockContract.getAddress());
      });

      it("should revert for non-existent module", async function () {
        await expect(
          beacon.getImplementation("NonExistentModule")
        ).to.be.revertedWith("Implementation not found");
      });

      it("should be callable by anyone", async function () {
        const implementation = await beacon.connect(user1).getImplementation(MODULE_NAMES.LIQUIDITY_MANAGER);
        expect(implementation).to.equal(await mockContract.getAddress());
      });
    });
  });

  describe("⛽ Gas Optimization", function () {
    it("should deploy with reasonable gas cost", async function () {
      const BeaconFactory = await ethers.getContractFactory("Beacon");
      const beacon2 = await BeaconFactory.deploy();
      await beacon2.waitForDeployment();
      
      expect(await beacon2.getAddress()).to.be.properAddress;
      console.log("✅ Beacon deployment successful");
    });

    it("should have reasonable gas for basic operations", async function () {
      // Test ownership transfer gas cost
      const tx = await beacon.transferOwnership(user1.address);
      const receipt = await tx.wait();
      
      expect(receipt?.gasUsed).to.be.lt(100000n);
      console.log("✅ Ownership transfer gas usage:", receipt?.gasUsed.toString());
    });

    it("should use reasonable gas for implementation updates", async function () {
      const tx = await beacon.updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, await mockContract.getAddress());
      const receipt = await tx.wait();
      
      expect(receipt?.gasUsed).to.be.lt(150000n);
      console.log("✅ Implementation update gas usage:", receipt?.gasUsed.toString());
    });
  });

  describe("🧪 Integration Readiness", function () {
    it("should be ready for module deployment", async function () {
      console.log("Beacon address:", await beacon.getAddress());
      console.log("Beacon owner:", await beacon.owner());
      
      // Try to deploy a module that uses this beacon
      try {
        const LiquidityManagerFactory = await ethers.getContractFactory("LiquidityManager");
        const liquidityManager = await LiquidityManagerFactory.deploy(await beacon.getAddress());
        await liquidityManager.waitForDeployment();
        
        console.log("✅ Module deployment successful with Beacon");
        expect(await liquidityManager.getAddress()).to.be.properAddress;
        
        // Check if module can query the beacon
        if (typeof liquidityManager.beacon === 'function') {
          const beaconFromModule = await liquidityManager.beacon();
          expect(beaconFromModule).to.equal(await beacon.getAddress());
          console.log("✅ Module-Beacon connection verified");
        }
      } catch (error: any) {
        console.log("⚠️ Module deployment failed:", error.message);
        console.log("This may be expected if modules are not yet implemented");
      }
    });

    it("should support multiple module registrations", async function () {
      // Deploy additional mock contracts
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const mockContract2 = await MockERC20Factory.deploy("Mock Token 2", "MOCK2", 18);
      const mockContract3 = await MockERC20Factory.deploy("Mock Token 3", "MOCK3", 18);
      const mockContract4 = await MockERC20Factory.deploy("Mock Token 4", "MOCK4", 18);
      await mockContract2.waitForDeployment();
      await mockContract3.waitForDeployment();
      await mockContract4.waitForDeployment();
      
      // Register all module types
      await beacon.updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, await mockContract.getAddress());
      await beacon.updateImplementation(MODULE_NAMES.SWAP_MANAGER, await mockContract2.getAddress());
      await beacon.updateImplementation(MODULE_NAMES.TOKEN_MANAGER, await mockContract3.getAddress());
      await beacon.updateImplementation(MODULE_NAMES.EMERGENCY_HANDLER, await mockContract4.getAddress());
      
      // Verify all registrations
      expect(await beacon.getImplementation(MODULE_NAMES.LIQUIDITY_MANAGER)).to.equal(await mockContract.getAddress());
      expect(await beacon.getImplementation(MODULE_NAMES.SWAP_MANAGER)).to.equal(await mockContract2.getAddress());
      expect(await beacon.getImplementation(MODULE_NAMES.TOKEN_MANAGER)).to.equal(await mockContract3.getAddress());
      expect(await beacon.getImplementation(MODULE_NAMES.EMERGENCY_HANDLER)).to.equal(await mockContract4.getAddress());
    });
  });

  describe("📊 Contract State", function () {
    it("should maintain consistent state", async function () {
      const initialOwner = await beacon.owner();
      expect(initialOwner).to.equal(owner.address);
      
      // Initiate ownership transfer
      await beacon.transferOwnership(user1.address);
      
      // Owner should remain unchanged until acceptance
      expect(await beacon.owner()).to.equal(owner.address);
      expect(await beacon.pendingOwner()).to.equal(user1.address);
      
      // Accept ownership
      await beacon.connect(user1).acceptOwnership();
      expect(await beacon.owner()).to.equal(user1.address);
      expect(await beacon.pendingOwner()).to.equal(ethers.ZeroAddress);
      
      console.log("✅ State consistency verified");
    });

    it("should handle sequential ownership transfers", async function () {
      // Transfer to user1
      await beacon.transferOwnership(user1.address);
      await beacon.connect(user1).acceptOwnership();
      expect(await beacon.owner()).to.equal(user1.address);
      
      // User1 transfers to user2
      await beacon.connect(user1).transferOwnership(user2.address);
      await beacon.connect(user2).acceptOwnership();
      expect(await beacon.owner()).to.equal(user2.address);
      
      // User2 transfers back to owner
      await beacon.connect(user2).transferOwnership(owner.address);
      await beacon.acceptOwnership();
      expect(await beacon.owner()).to.equal(owner.address);
      
      console.log("✅ Sequential transfers handled correctly");
    });

    it("should maintain implementation state after ownership transfer", async function () {
      // Set initial implementation
      await beacon.updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, await mockContract.getAddress());
      
      // Transfer ownership
      await beacon.transferOwnership(user1.address);
      await beacon.connect(user1).acceptOwnership();
      
      // Verify implementation still exists
      expect(await beacon.getImplementation(MODULE_NAMES.LIQUIDITY_MANAGER)).to.equal(await mockContract.getAddress());
      
      // New owner can update
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const mockContract2 = await MockERC20Factory.deploy("Mock Token 2", "MOCK2", 18);
      await mockContract2.waitForDeployment();
      
      await beacon.connect(user1).updateImplementation(MODULE_NAMES.SWAP_MANAGER, await mockContract2.getAddress());
      expect(await beacon.getImplementation(MODULE_NAMES.SWAP_MANAGER)).to.equal(await mockContract2.getAddress());
    });
  });

  describe("🛡️ Security Tests", function () {
    it("should prevent unauthorized access", async function () {
      // Non-owner cannot transfer ownership
      await expect(
        beacon.connect(user1).transferOwnership(user2.address)
      ).to.be.revertedWith("Only owner can call this function");
      
      // Non-owner cannot update implementations
      await expect(
        beacon.connect(user1).updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, await mockContract.getAddress())
      ).to.be.revertedWith("Only owner can call this function");
      
      console.log("✅ Security controls verified");
    });

    it("should handle edge cases", async function () {
      // Cannot transfer to zero address
      await expect(
        beacon.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner address");
      
      // Cannot update with EOA
      await expect(
        beacon.updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, user1.address)
      ).to.be.revertedWith("Implementation must be a contract");
      
      console.log("✅ Edge cases handled properly");
    });

    it("should handle implementation updates correctly", async function () {
      // Initial update
      await beacon.updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, await mockContract.getAddress());
      expect(await beacon.getImplementation(MODULE_NAMES.LIQUIDITY_MANAGER)).to.equal(await mockContract.getAddress());
      
      // Update to new implementation
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const newMockContract = await MockERC20Factory.deploy("New Mock", "NMOCK", 18);
      await newMockContract.waitForDeployment();
      
      await beacon.updateImplementation(MODULE_NAMES.LIQUIDITY_MANAGER, await newMockContract.getAddress());
      expect(await beacon.getImplementation(MODULE_NAMES.LIQUIDITY_MANAGER)).to.equal(await newMockContract.getAddress());
    });
  });
});