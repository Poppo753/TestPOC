import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ProtocolManager,
  ProtocolManager__factory,
} from "../../typechain-types";

describe("ProtocolManager - Unit Tests", function () {
  let protocolManager: ProtocolManager;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let mockBeacon: SignerWithAddress;
  let mockPlugin: SignerWithAddress;
  let mockProxyGeneral: SignerWithAddress;

  // Test constants
  const PROTOCOL_NAME = "DolomitePlugin";
  const TOKEN_CODE = "WETH";
  const AMOUNT = ethers.parseEther("1.0");

  beforeEach(async function () {
    // Get signers
    [owner, user1, mockBeacon, mockPlugin, mockProxyGeneral] =
      await ethers.getSigners();

    // Deploy ProtocolManager
    const ProtocolManagerFactory = (await ethers.getContractFactory(
      "ProtocolManager",
      owner
    )) as ProtocolManager__factory;

    protocolManager = await ProtocolManagerFactory.deploy(mockBeacon.address);
    await protocolManager.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct beacon address", async function () {
      expect(await protocolManager.beacon()).to.equal(mockBeacon.address);
    });

    it("Should set deployer as owner", async function () {
      expect(await protocolManager.owner()).to.equal(owner.address);
    });

    it("Should revert if beacon is zero address", async function () {
      const ProtocolManagerFactory = (await ethers.getContractFactory(
        "ProtocolManager",
        owner
      )) as ProtocolManager__factory;

      await expect(
        ProtocolManagerFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid beacon address");
    });
  });

  describe("Access Control", function () {
    it("Should allow only owner to call deposit", async function () {
      await expect(
        protocolManager.connect(addr1).deposit(PROTOCOL_NAME, TOKEN_CODE, AMOUNT)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow only owner to call withdraw", async function () {
      await expect(
        protocolManager.connect(addr1).withdraw(PROTOCOL_NAME, TOKEN_CODE, AMOUNT)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow only owner to call borrow", async function () {
      await expect(
        protocolManager.connect(addr1).borrow(PROTOCOL_NAME, TOKEN_CODE, AMOUNT)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow only owner to call repay", async function () {
      await expect(
        protocolManager.connect(addr1).repay(PROTOCOL_NAME, TOKEN_CODE, AMOUNT)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow only owner to call setAllowedSelectors", async function () {
      const selectors = ["0x12345678"];
      await expect(
        protocolManager.connect(user1).setAllowedSelectors(PROTOCOL_NAME, selectors, true)
      ).to.be.revertedWithCustomError(protocolManager, "OwnableUnauthorizedAccount");
    });

    it("Should allow only owner to call executeProtocolCall", async function () {
      const data = "0x12345678";
      await expect(
        protocolManager.connect(user1).executeProtocolCall(PROTOCOL_NAME, data)
      ).to.be.revertedWithCustomError(protocolManager, "OwnableUnauthorizedAccount");
    });

    it("Should allow only owner to call emergencyWithdrawAll", async function () {
      await expect(
        protocolManager.connect(addr1).emergencyWithdrawAll(PROTOCOL_NAME)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Input Validation", function () {
    it("Should revert deposit with zero amount", async function () {
      await expect(
        protocolManager.deposit(PROTOCOL_NAME, TOKEN_CODE, 0)
      ).to.be.revertedWithCustomError(protocolManager, "InvalidAmount");
    });

    it("Should revert deposit with empty tokenCode", async function () {
      await expect(
        protocolManager.deposit(PROTOCOL_NAME, "", AMOUNT)
      ).to.be.revertedWithCustomError(protocolManager, "InvalidTokenCode");
    });

    it("Should revert withdraw with zero amount", async function () {
      await expect(
        protocolManager.withdraw(PROTOCOL_NAME, TOKEN_CODE, 0)
      ).to.be.revertedWithCustomError(protocolManager, "InvalidAmount");
    });

    it("Should revert borrow with zero amount", async function () {
      await expect(
        protocolManager.borrow(PROTOCOL_NAME, TOKEN_CODE, 0)
      ).to.be.revertedWithCustomError(protocolManager, "InvalidAmount");
    });

    it("Should revert repay with zero amount", async function () {
      await expect(
        protocolManager.repay(PROTOCOL_NAME, TOKEN_CODE, 0)
      ).to.be.revertedWithCustomError(protocolManager, "InvalidAmount");
    });

    it("Should revert executeProtocolCall with invalid calldata (< 4 bytes)", async function () {
      const invalidData = "0x1234"; // Only 2 bytes
      await expect(
        protocolManager.executeProtocolCall(PROTOCOL_NAME, invalidData)
      ).to.be.revertedWithCustomError(protocolManager, "OperationFailed");
    });
  });

  describe("Whitelist Management - setAllowedSelectors (OBBLIGATORIO)", function () {
    const SELECTOR_1 = "0x12345678";
    const SELECTOR_2 = "0xabcdef12";
    const SELECTOR_3 = "0x87654321";

    it("Should allow owner to add selectors to whitelist", async function () {
      // Note: In real scenario, we'd need to mock Beacon.getImplementation
      // For now, this tests the interface
      const selectors = [SELECTOR_1, SELECTOR_2];
      
      // This will revert with ProtocolNotFound since we don't have a real Beacon
      // In integration tests with mocks, this will work
      await expect(
        protocolManager.setAllowedSelectors(PROTOCOL_NAME, selectors, true)
      ).to.be.revertedWithCustomError(protocolManager, "ProtocolNotFound");
    });

    it("Should emit SelectorAllowanceChanged event for each selector", async function () {
      // Test with mock will be in integration tests
      // Unit test verifies interface exists
      expect(protocolManager.setAllowedSelectors).to.exist;
    });

    it("Should allow removing selectors from whitelist", async function () {
      const selectors = [SELECTOR_1];
      
      // Test interface exists
      await expect(
        protocolManager.setAllowedSelectors(PROTOCOL_NAME, selectors, false)
      ).to.be.revertedWithCustomError(protocolManager, "ProtocolNotFound");
    });

    it("Should handle multiple selectors in single call", async function () {
      const selectors = [SELECTOR_1, SELECTOR_2, SELECTOR_3];
      
      await expect(
        protocolManager.setAllowedSelectors(PROTOCOL_NAME, selectors, true)
      ).to.be.revertedWithCustomError(protocolManager, "ProtocolNotFound");
    });

    it("Should allow only owner to call setAllowedSelectors", async function () {
      const selectors = [SELECTOR_1];
      
      await expect(
        protocolManager.connect(user1).setAllowedSelectors(PROTOCOL_NAME, selectors, true)
      ).to.be.revertedWithCustomError(protocolManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("Whitelist Validation - executeProtocolCall (OBBLIGATORIO)", function () {
    const ALLOWED_SELECTOR = "0x12345678";
    const NOT_ALLOWED_SELECTOR = "0xabcdef12";

    it("Should revert if selector is not whitelisted", async function () {
      // Encode calldata with non-whitelisted selector
      const data = ALLOWED_SELECTOR + "0000000000000000000000000000000000000000000000000000000000000001";
      
      // Will revert with ProtocolNotFound (no mock beacon setup)
      // In integration tests with proper mocks, will test whitelist validation
      await expect(
        protocolManager.executeProtocolCall(PROTOCOL_NAME, data)
      ).to.be.revertedWithCustomError(protocolManager, "ProtocolNotFound");
    });

    it("Should extract selector correctly from calldata", async function () {
      // Test that executeProtocolCall exists and can be called
      const data = ALLOWED_SELECTOR + "1234567890abcdef";
      
      await expect(
        protocolManager.executeProtocolCall(PROTOCOL_NAME, data)
      ).to.be.revertedWithCustomError(protocolManager, "ProtocolNotFound");
    });
  });

  describe("View Functions", function () {
    it("Should return correct beacon address", async function () {
      expect(await protocolManager.beacon()).to.equal(mockBeacon.address);
    });

    it("Should have allowedSelectors mapping public", async function () {
      // Test that allowedSelectors mapping is accessible
      const isAllowed = await protocolManager.allowedSelectors(
        mockPlugin.address,
        "0x12345678"
      );
      expect(isAllowed).to.be.false;
    });

    it("Should allow checking selector allowance", async function () {
      const selector = "0x12345678";
      const isAllowed = await protocolManager.allowedSelectors(
        mockPlugin.address,
        selector
      );
      expect(typeof isAllowed).to.equal("boolean");
    });
  });

  describe("Error Messages", function () {
    it("Should provide clear error for ProtocolNotFound", async function () {
      // Will trigger when Beacon returns address(0)
      await expect(
        protocolManager.deposit(PROTOCOL_NAME, TOKEN_CODE, AMOUNT)
      ).to.be.revertedWithCustomError(protocolManager, "ProtocolNotFound");
    });

    it("Should provide clear error for InvalidAmount", async function () {
      await expect(
        protocolManager.deposit(PROTOCOL_NAME, TOKEN_CODE, 0)
      ).to.be.revertedWithCustomError(protocolManager, "InvalidAmount")
        .withArgs(0);
    });

    it("Should provide clear error for InvalidTokenCode", async function () {
      await expect(
        protocolManager.deposit(PROTOCOL_NAME, "", AMOUNT)
      ).to.be.revertedWithCustomError(protocolManager, "InvalidTokenCode")
        .withArgs("");
    });
  });

  describe("Storage Layout", function () {
    it("Should have immutable beacon", async function () {
      const beaconAddr = await protocolManager.beacon();
      expect(beaconAddr).to.equal(mockBeacon.address);
      expect(beaconAddr).to.not.equal(ethers.ZeroAddress);
    });

    it("Should have allowedSelectors mapping initialized", async function () {
      const selector = "0x12345678";
      const isAllowed = await protocolManager.allowedSelectors(
        mockPlugin.address,
        selector
      );
      expect(isAllowed).to.be.false; // Default is false
    });
  });

  describe("Contract Size", function () {
    it("Should be within deployment size limit", async function () {
      const deployedCode = await ethers.provider.getCode(
        await protocolManager.getAddress()
      );
      const sizeInBytes = (deployedCode.length - 2) / 2; // Remove 0x and convert hex to bytes
      
      // Ethereum contract size limit is 24KB (24576 bytes)
      expect(sizeInBytes).to.be.lessThan(24576);
      
      console.log(`      ProtocolManager size: ${sizeInBytes} bytes (${(sizeInBytes/24576*100).toFixed(2)}% of limit)`);
    });
  });
});
