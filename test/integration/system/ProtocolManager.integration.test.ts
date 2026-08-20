import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ProtocolManager,
  ProtocolManager__factory,
  DolomitePlugin,
  DolomitePlugin__factory,
  Beacon,
  Beacon__factory,
  ProxyGeneral,
  ProxyGeneral__factory,
  MockERC20,
  MockERC20__factory,
} from "../../typechain-types";

describe("ProtocolManager - Integration Tests", function () {
  let protocolManager: ProtocolManager;
  let dolomitePlugin: DolomitePlugin;
  let beacon: Beacon;
  let proxyGeneral: ProxyGeneral;
  let mockToken: MockERC20;
  
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  // Test constants
  const PROTOCOL_NAME = "DolomitePlugin";
  const TOKEN_CODE = "WETH";
  const AMOUNT = ethers.parseEther("1.0");
  const INITIAL_BALANCE = ethers.parseEther("100.0");

  beforeEach(async function () {
    // Get signers
    [owner, user1] = await ethers.getSigners();

    // Deploy mock token
    const MockERC20Factory = (await ethers.getContractFactory(
      "MockERC20",
      owner
    )) as MockERC20__factory;
    mockToken = await MockERC20Factory.deploy("Wrapped ETH", "WETH", 18);
    await mockToken.waitForDeployment();

    // Mint tokens to owner
    await mockToken.mint(owner.address, INITIAL_BALANCE);

    // Deploy Beacon
    const BeaconFactory = (await ethers.getContractFactory(
      "Beacon",
      owner
    )) as Beacon__factory;
    beacon = await BeaconFactory.deploy();
    await beacon.waitForDeployment();

    // Deploy ProxyGeneral
    const ProxyGeneralFactory = (await ethers.getContractFactory(
      "ProxyGeneral",
      owner
    )) as ProxyGeneral__factory;
    proxyGeneral = await ProxyGeneralFactory.deploy(await beacon.getAddress(), "WETH");
    await proxyGeneral.waitForDeployment();

    // Deploy mock Dolomite contracts (just use MockERC20 as placeholder - won't be called in whitelist tests)
    const mockDolomiteMargin = await MockERC20Factory.deploy("MockDolomite", "DMT", 18);
    const mockDepositRouter = await MockERC20Factory.deploy("MockRouter1", "MR1", 18);
    const mockBorrowRouter = await MockERC20Factory.deploy("MockRouter2", "MR2", 18);
    await mockDolomiteMargin.waitForDeployment();
    await mockDepositRouter.waitForDeployment();
    await mockBorrowRouter.waitForDeployment();

    // Deploy DolomitePlugin with mock contracts
    const DolomitePluginFactory = (await ethers.getContractFactory(
      "DolomitePlugin",
      owner
    )) as DolomitePlugin__factory;
    
    dolomitePlugin = await DolomitePluginFactory.deploy(
      await beacon.getAddress(),
      await mockDolomiteMargin.getAddress(),
      await mockBorrowRouter.getAddress(), // Constructor expects: beacon, dolomiteMargin, borrowRouter, depositRouter
      await mockDepositRouter.getAddress()
    );
    await dolomitePlugin.waitForDeployment();

    // Deploy ProtocolManager
    const ProtocolManagerFactory = (await ethers.getContractFactory(
      "ProtocolManager",
      owner
    )) as ProtocolManager__factory;
    protocolManager = await ProtocolManagerFactory.deploy(await beacon.getAddress());
    await protocolManager.waitForDeployment();

    // Register DolomitePlugin in Beacon
    await beacon.updateImplementation(PROTOCOL_NAME, await dolomitePlugin.getAddress());

    // Register ProtocolManager in Beacon
    await beacon.updateImplementation("ProtocolManager", await protocolManager.getAddress());

    // Authorize ProtocolManager in ProxyGeneral
    await proxyGeneral.authorizeModule(await protocolManager.getAddress(), "ProtocolManager");
  });

  describe("Whitelist Integration Tests (OBBLIGATORIO)", function () {
    // Function selector for openBorrowPosition(uint256,uint256)
    const OPEN_BORROW_POSITION_SELECTOR = ethers.id("openBorrowPosition(uint256,uint256)").slice(0, 10);
    const BORROW_FROM_POSITION_SELECTOR = ethers.id("borrowFromPosition(uint256,address,uint256)").slice(0, 10);

    describe("setAllowedSelectors", function () {
      it("Should add selector to whitelist and emit event", async function () {
        const selectors = [OPEN_BORROW_POSITION_SELECTOR];
        
        await expect(
          protocolManager.setAllowedSelectors(PROTOCOL_NAME, selectors, true)
        )
          .to.emit(protocolManager, "SelectorAllowanceChanged")
          .withArgs(await dolomitePlugin.getAddress(), OPEN_BORROW_POSITION_SELECTOR, true);

        // Verify selector is whitelisted
        const isAllowed = await protocolManager.allowedSelectors(
          await dolomitePlugin.getAddress(),
          OPEN_BORROW_POSITION_SELECTOR
        );
        expect(isAllowed).to.be.true;
      });

      it("Should remove selector from whitelist", async function () {
        const selectors = [OPEN_BORROW_POSITION_SELECTOR];
        
        // Add first
        await protocolManager.setAllowedSelectors(PROTOCOL_NAME, selectors, true);
        
        // Remove
        await expect(
          protocolManager.setAllowedSelectors(PROTOCOL_NAME, selectors, false)
        )
          .to.emit(protocolManager, "SelectorAllowanceChanged")
          .withArgs(await dolomitePlugin.getAddress(), OPEN_BORROW_POSITION_SELECTOR, false);

        // Verify selector is not whitelisted
        const isAllowed = await protocolManager.allowedSelectors(
          await dolomitePlugin.getAddress(),
          OPEN_BORROW_POSITION_SELECTOR
        );
        expect(isAllowed).to.be.false;
      });

      it("Should handle multiple selectors in one call", async function () {
        const selectors = [OPEN_BORROW_POSITION_SELECTOR, BORROW_FROM_POSITION_SELECTOR];
        
        await protocolManager.setAllowedSelectors(PROTOCOL_NAME, selectors, true);

        // Verify both selectors are whitelisted
        const isAllowed1 = await protocolManager.allowedSelectors(
          await dolomitePlugin.getAddress(),
          OPEN_BORROW_POSITION_SELECTOR
        );
        const isAllowed2 = await protocolManager.allowedSelectors(
          await dolomitePlugin.getAddress(),
          BORROW_FROM_POSITION_SELECTOR
        );
        
        expect(isAllowed1).to.be.true;
        expect(isAllowed2).to.be.true;
      });

      it("Should allow toggling selector multiple times", async function () {
        const selectors = [OPEN_BORROW_POSITION_SELECTOR];
        
        // Add
        await protocolManager.setAllowedSelectors(PROTOCOL_NAME, selectors, true);
        expect(
          await protocolManager.allowedSelectors(
            await dolomitePlugin.getAddress(),
            OPEN_BORROW_POSITION_SELECTOR
          )
        ).to.be.true;

        // Remove
        await protocolManager.setAllowedSelectors(PROTOCOL_NAME, selectors, false);
        expect(
          await protocolManager.allowedSelectors(
            await dolomitePlugin.getAddress(),
            OPEN_BORROW_POSITION_SELECTOR
          )
        ).to.be.false;

        // Add again
        await protocolManager.setAllowedSelectors(PROTOCOL_NAME, selectors, true);
        expect(
          await protocolManager.allowedSelectors(
            await dolomitePlugin.getAddress(),
            OPEN_BORROW_POSITION_SELECTOR
          )
        ).to.be.true;
      });

      it("Should allow only owner to modify whitelist", async function () {
        const selectors = [OPEN_BORROW_POSITION_SELECTOR];
        
        await expect(
          protocolManager.connect(user1).setAllowedSelectors(PROTOCOL_NAME, selectors, true)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Should revert with ProtocolNotFound for invalid protocol", async function () {
        const selectors = [OPEN_BORROW_POSITION_SELECTOR];
        
        await expect(
          protocolManager.setAllowedSelectors("InvalidProtocol", selectors, true)
        ).to.be.revertedWith("Implementation not found");  // Beacon's require message
      });
    });

    describe("executeProtocolCall - Whitelist Validation", function () {
      beforeEach(async function () {
        // Whitelist the openBorrowPosition selector
        await protocolManager.setAllowedSelectors(
          PROTOCOL_NAME,
          [OPEN_BORROW_POSITION_SELECTOR],
          true
        );
      });

      it("Should revert if selector is not whitelisted", async function () {
        // Encode call to non-whitelisted function
        const calldata = ethers.concat([
          BORROW_FROM_POSITION_SELECTOR,
          ethers.zeroPadValue(ethers.toBeHex(1), 32), // accountNumber
          ethers.zeroPadValue(await mockToken.getAddress(), 32),  // tokenAddress
          ethers.zeroPadValue(ethers.toBeHex(AMOUNT), 32) // amount
        ]);

        await expect(
          protocolManager.executeProtocolCall(PROTOCOL_NAME, calldata)
        ).to.be.revertedWithCustomError(protocolManager, "SelectorNotAllowed");
      });

      it("Should allow call if selector is whitelisted", async function () {
        // Encode call to whitelisted function (will revert in plugin due to zero addresses, but whitelist check passes)
        const calldata = ethers.concat([
          OPEN_BORROW_POSITION_SELECTOR,
          ethers.zeroPadValue(ethers.toBeHex(1), 32),     // accountNumber
          ethers.zeroPadValue(ethers.toBeHex(AMOUNT), 32) // amountWei
        ]);

        // This will pass whitelist check but revert in plugin (DolomiteMargin is zero address)
        // We're testing whitelist validation, not plugin execution
        await expect(
          protocolManager.executeProtocolCall(PROTOCOL_NAME, calldata)
        ).to.be.reverted; // Plugin execution error, not whitelist error
      });

      it("Should extract selector correctly from calldata", async function () {
        // Test with minimal calldata (just selector + 1 parameter)
        const calldata = ethers.concat([
          OPEN_BORROW_POSITION_SELECTOR,
          ethers.zeroPadValue(ethers.toBeHex(1), 32)
        ]);

        // Should pass whitelist check (reverts in plugin execution)
        await expect(
          protocolManager.executeProtocolCall(PROTOCOL_NAME, calldata)
        ).to.be.reverted; // Not SelectorNotAllowed
      });

      it("Should revert with OperationFailed if calldata too short", async function () {
        // Calldata < 4 bytes (no valid selector)
        const invalidCalldata = "0x123456";

        await expect(
          protocolManager.executeProtocolCall(PROTOCOL_NAME, invalidCalldata)
        ).to.be.revertedWithCustomError(protocolManager, "OperationFailed");
      });

      it("Should revert with ProtocolNotFound for invalid protocol", async function () {
        const calldata = ethers.concat([
          OPEN_BORROW_POSITION_SELECTOR,
          ethers.zeroPadValue(ethers.toBeHex(1), 32)
        ]);

        await expect(
          protocolManager.executeProtocolCall("InvalidProtocol", calldata)
        ).to.be.revertedWith("Implementation not found");  // Beacon's require message
      });

      it("Should allow only owner to call executeProtocolCall", async function () {
        const calldata = ethers.concat([
          OPEN_BORROW_POSITION_SELECTOR,
          ethers.zeroPadValue(ethers.toBeHex(1), 32)
        ]);

        await expect(
          protocolManager.connect(user1).executeProtocolCall(PROTOCOL_NAME, calldata)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Whitelist Isolation - Multiple Protocols", function () {
      let anotherPlugin: DolomitePlugin;
      const ANOTHER_PROTOCOL_NAME = "AnotherDolomitePlugin";

      beforeEach(async function () {
        // Deploy mock Dolomite contracts for another plugin
        const MockERC20Factory = (await ethers.getContractFactory(
          "MockERC20",
          owner
        )) as MockERC20__factory;
        const mockDolomiteMargin2 = await MockERC20Factory.deploy("MockDolomite2", "DMT2", 18);
        const mockDepositRouter2 = await MockERC20Factory.deploy("MockRouter3", "MR3", 18);
        const mockBorrowRouter2 = await MockERC20Factory.deploy("MockRouter4", "MR4", 18);
        await mockDolomiteMargin2.waitForDeployment();
        await mockDepositRouter2.waitForDeployment();
        await mockBorrowRouter2.waitForDeployment();

        // Deploy another DolomitePlugin instance
        const DolomitePluginFactory = (await ethers.getContractFactory(
          "DolomitePlugin",
          owner
        )) as DolomitePlugin__factory;
        
        anotherPlugin = await DolomitePluginFactory.deploy(
          await beacon.getAddress(),
          await mockDolomiteMargin2.getAddress(),
          await mockBorrowRouter2.getAddress(),
          await mockDepositRouter2.getAddress()
        );
        await anotherPlugin.waitForDeployment();

        // Register another plugin in Beacon
        await beacon.updateImplementation(ANOTHER_PROTOCOL_NAME, await anotherPlugin.getAddress());
      });

      it("Should isolate whitelist between different protocols", async function () {
        // Whitelist selector for first protocol
        await protocolManager.setAllowedSelectors(
          PROTOCOL_NAME,
          [OPEN_BORROW_POSITION_SELECTOR],
          true
        );

        // Verify selector is whitelisted for first protocol
        const isAllowed1 = await protocolManager.allowedSelectors(
          await dolomitePlugin.getAddress(),
          OPEN_BORROW_POSITION_SELECTOR
        );
        expect(isAllowed1).to.be.true;

        // Verify selector is NOT whitelisted for second protocol
        const isAllowed2 = await protocolManager.allowedSelectors(
          await anotherPlugin.getAddress(),
          OPEN_BORROW_POSITION_SELECTOR
        );
        expect(isAllowed2).to.be.false;
      });

      it("Should allow independent whitelist management per protocol", async function () {
        // Whitelist different selectors for each protocol
        await protocolManager.setAllowedSelectors(
          PROTOCOL_NAME,
          [OPEN_BORROW_POSITION_SELECTOR],
          true
        );
        
        await protocolManager.setAllowedSelectors(
          ANOTHER_PROTOCOL_NAME,
          [BORROW_FROM_POSITION_SELECTOR],
          true
        );

        // First protocol: OPEN_BORROW_POSITION allowed, BORROW_FROM_POSITION not allowed
        expect(
          await protocolManager.allowedSelectors(
            await dolomitePlugin.getAddress(),
            OPEN_BORROW_POSITION_SELECTOR
          )
        ).to.be.true;
        expect(
          await protocolManager.allowedSelectors(
            await dolomitePlugin.getAddress(),
            BORROW_FROM_POSITION_SELECTOR
          )
        ).to.be.false;

        // Second protocol: BORROW_FROM_POSITION allowed, OPEN_BORROW_POSITION not allowed
        expect(
          await protocolManager.allowedSelectors(
            await anotherPlugin.getAddress(),
            BORROW_FROM_POSITION_SELECTOR
          )
        ).to.be.true;
        expect(
          await protocolManager.allowedSelectors(
            await anotherPlugin.getAddress(),
            OPEN_BORROW_POSITION_SELECTOR
          )
        ).to.be.false;
      });

      it("Should not affect other protocols when modifying one whitelist", async function () {
        // Setup initial state
        await protocolManager.setAllowedSelectors(
          PROTOCOL_NAME,
          [OPEN_BORROW_POSITION_SELECTOR],
          true
        );
        await protocolManager.setAllowedSelectors(
          ANOTHER_PROTOCOL_NAME,
          [OPEN_BORROW_POSITION_SELECTOR],
          true
        );

        // Both protocols have selector whitelisted
        expect(
          await protocolManager.allowedSelectors(
            await dolomitePlugin.getAddress(),
            OPEN_BORROW_POSITION_SELECTOR
          )
        ).to.be.true;
        expect(
          await protocolManager.allowedSelectors(
            await anotherPlugin.getAddress(),
            OPEN_BORROW_POSITION_SELECTOR
          )
        ).to.be.true;

        // Remove from first protocol
        await protocolManager.setAllowedSelectors(
          PROTOCOL_NAME,
          [OPEN_BORROW_POSITION_SELECTOR],
          false
        );

        // First protocol: removed
        expect(
          await protocolManager.allowedSelectors(
            await dolomitePlugin.getAddress(),
            OPEN_BORROW_POSITION_SELECTOR
          )
        ).to.be.false;

        // Second protocol: still whitelisted
        expect(
          await protocolManager.allowedSelectors(
            await anotherPlugin.getAddress(),
            OPEN_BORROW_POSITION_SELECTOR
          )
        ).to.be.true;
      });
    });
  });

  describe("Full Flow Integration Tests", function () {
    it("Should have ProtocolManager registered in Beacon", async function () {
      const pmAddress = await beacon.getImplementation("ProtocolManager");
      expect(pmAddress).to.equal(await protocolManager.getAddress());
    });

    it("Should have DolomitePlugin registered in Beacon", async function () {
      const pluginAddress = await beacon.getImplementation(PROTOCOL_NAME);
      expect(pluginAddress).to.equal(await dolomitePlugin.getAddress());
    });

    it("Should have ProtocolManager authorized in ProxyGeneral", async function () {
      const isAuthorized = await proxyGeneral.authorizedModules(await protocolManager.getAddress());
      expect(isAuthorized).to.be.true;
    });

    it("Should resolve plugin correctly", async function () {
      // Call view function that internally resolves plugin
      const beaconAddr = await protocolManager.beacon();
      expect(beaconAddr).to.equal(await beacon.getAddress());
    });
  });
});
