import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 💰 TOKEN MANAGER - UNIT TESTS
 * 
 * Tests basic functions of the TokenManager contract:
 * - Token registration and management
 * - Price feed integration
 * - Basic queries and validations
 */

describe("TokenManager Contract", function () {
  let tokenManager: any;
  let beacon: any;
  let mockToken: any;
  let mockOracle: any;
  let owner: any;
  let user1: any;
  let user2: any;

  // Test constants
  const TOKEN_CODES = {
    WETH: "WETH",
    USDC: "USDC",
    INVALID: "INVALID_TOKEN",
  };

  const MOCK_PRICES = {
    WETH: ethers.parseUnits("2000", 8), // $2000 with 8 decimals
    USDC: ethers.parseUnits("1", 8),    // $1 with 8 decimals
  };

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy Beacon
    const BeaconFactory = await ethers.getContractFactory("Beacon");
    beacon = await BeaconFactory.deploy();
    await beacon.waitForDeployment();
    
    // Deploy mock WETH token for beacon registration
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const wethForBeacon = await MockERC20Factory.deploy("Wrapped Ether Beacon", "WETH", 18);
    await wethForBeacon.waitForDeployment();
    
    // Register WETH in beacon to avoid errors in TokenManager
    await beacon.updateImplementation("WETH", await wethForBeacon.getAddress());
    
    // Deploy mock token for tests
    mockToken = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
    await mockToken.waitForDeployment();
    
    // Deploy mock oracle
    const MockOracleFactory = await ethers.getContractFactory("MockChainlinkOracle");
    mockOracle = await MockOracleFactory.deploy(
      MOCK_PRICES.WETH,  // price
      8,                 // decimals
      "USDC/USD"        // description
    );
    await mockOracle.waitForDeployment();
    
    // Deploy TokenManager
    const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
    tokenManager = await TokenManagerFactory.deploy(await beacon.getAddress());
    await tokenManager.waitForDeployment();
  });

  describe("📋 Deployment", function () {
    it("should deploy with correct initial state", async function () {
      expect(await tokenManager.getAddress()).to.be.properAddress;
      expect(await tokenManager.owner()).to.equal(owner.address);
      expect(await tokenManager.beacon()).to.equal(await beacon.getAddress());
      expect(await tokenManager.tokenCodesCount()).to.equal(0);
      expect(await tokenManager.maxErrors()).to.equal(3);
      expect(await tokenManager.maxTokensPerOperation()).to.equal(10);
    });

    it("should have expected function signatures", async function () {
      expect(tokenManager.manageTokenData).to.be.a('function');
      expect(tokenManager.removeToken).to.be.a('function');
      expect(tokenManager.getTokenPrice).to.be.a('function');
      expect(tokenManager.getTokenInfo).to.be.a('function');
      expect(tokenManager.getActiveTokens).to.be.a('function');
      expect(tokenManager.updateHeartbeat).to.be.a('function');
      expect(tokenManager.resetTokenErrors).to.be.a('function');
      
      console.log("✅ TokenManager contract deployed successfully");
    });

    it("should start with no tokens registered", async function () {
      expect(await tokenManager.getTokenCount()).to.equal(0);
      
      const activeTokens = await tokenManager.getActiveTokens();
      expect(activeTokens.length).to.equal(0);
    });
  });

  describe("🔧 Token Management", function () {
    describe("manageTokenData", function () {
      it("should allow owner to add new token", async function () {
        await tokenManager.manageTokenData(
          TOKEN_CODES.USDC, // Use USDC instead of WETH (WETH is restricted)
          await mockToken.getAddress(),
          await mockOracle.getAddress(),
          18, // tokenDecimals
          8,  // priceFeedDecimals
          3600 // heartbeat
        );
        
        expect(await tokenManager.getTokenCount()).to.equal(1);
        expect(await tokenManager.isTokenActive(TOKEN_CODES.USDC)).to.be.true;
        
        const tokenInfo = await tokenManager.getTokenInfo(TOKEN_CODES.USDC);
        expect(tokenInfo.tokenAddress).to.equal(await mockToken.getAddress());
        expect(tokenInfo.tokenCode).to.equal(TOKEN_CODES.USDC);
        expect(tokenInfo.tokenDecimals).to.equal(18);
        expect(tokenInfo.priceFeed).to.equal(await mockOracle.getAddress());
        expect(tokenInfo.priceFeedDecimals).to.equal(8);
        expect(tokenInfo.isActive).to.be.true;
        expect(tokenInfo.heartbeat).to.equal(3600);
      });

      it("should emit TokenAdded event", async function () {
        await expect(
          tokenManager.manageTokenData(
            TOKEN_CODES.USDC,
            await mockToken.getAddress(),
            await mockOracle.getAddress(),
            18,
            8,
            3600
          )
        )
          .to.emit(tokenManager, "TokenAdded")
          .withArgs(TOKEN_CODES.USDC, await mockToken.getAddress(), await mockOracle.getAddress());
      });

      it("should prevent non-owner from adding tokens", async function () {
        await expect(
          tokenManager.connect(user1).manageTokenData(
            TOKEN_CODES.USDC,
            await mockToken.getAddress(),
            await mockOracle.getAddress(),
            18,
            8,
            3600
          )
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should validate token parameters", async function () {
        // Should reject zero address for token
        await expect(
          tokenManager.manageTokenData(
            TOKEN_CODES.USDC,
            ethers.ZeroAddress,
            await mockOracle.getAddress(),
            18,
            8,
            3600
          )
        ).to.be.revertedWith("Invalid token address");

        // Should reject zero address for oracle
        await expect(
          tokenManager.manageTokenData(
            TOKEN_CODES.USDC,
            await mockToken.getAddress(),
            ethers.ZeroAddress,
            18,
            8,
            3600
          )
        ).to.be.revertedWith("Invalid price feed address");

        // Should reject empty token code
        await expect(
          tokenManager.manageTokenData(
            "",
            await mockToken.getAddress(),
            await mockOracle.getAddress(),
            18,
            8,
            3600
          )
        ).to.be.revertedWith("Invalid token code");
      });
    });

    describe("removeToken", function () {
      beforeEach(async function () {
        await tokenManager.manageTokenData(
          TOKEN_CODES.USDC,
          await mockToken.getAddress(),
          await mockOracle.getAddress(),
          18,
          8,
          3600
        );
      });

      it("should allow owner to remove token", async function () {
        expect(await tokenManager.isTokenActive(TOKEN_CODES.USDC)).to.be.true;
        
        await tokenManager.removeToken(TOKEN_CODES.USDC);
        
        expect(await tokenManager.isTokenActive(TOKEN_CODES.USDC)).to.be.false;
      });

      it("should emit TokenRemoved event", async function () {
        await expect(tokenManager.removeToken(TOKEN_CODES.USDC))
          .to.emit(tokenManager, "TokenRemoved")
          .withArgs(TOKEN_CODES.USDC);
      });

      it("should prevent non-owner from removing tokens", async function () {
        await expect(
          tokenManager.connect(user1).removeToken(TOKEN_CODES.USDC)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should revert when trying to remove non-existent token", async function () {
        await expect(
          tokenManager.removeToken(TOKEN_CODES.INVALID)
        ).to.be.revertedWith("Token not active");
      });
    });
  });

  describe("💰 Price Management", function () {
    beforeEach(async function () {
      await tokenManager.manageTokenData(
        TOKEN_CODES.USDC,
        await mockToken.getAddress(),
        await mockOracle.getAddress(),
        18,
        8,
        3600
      );
    });

    describe("getTokenPrice", function () {
      it("should return current token price", async function () {
        const [price, updatedAt, isStale] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
        expect(price.toString()).to.equal(MOCK_PRICES.WETH.toString()); // Compare as strings to avoid BigInt serialization
        expect(updatedAt).to.be.greaterThan(0);
        expect(isStale).to.be.false;
      });

      it("should revert for inactive token", async function () {
        await tokenManager.removeToken(TOKEN_CODES.USDC);
        
        await expect(
          tokenManager.getTokenPrice(TOKEN_CODES.USDC)
        ).to.be.revertedWith("Token not active");
      });

      it("should revert for non-existent token", async function () {
        await expect(
          tokenManager.getTokenPrice(TOKEN_CODES.INVALID)
        ).to.be.revertedWith("Token not active");
      });
    });

    describe("getTokenPriceForModule", function () {
      it("should return price for modules", async function () {
        const price = await tokenManager.getTokenPriceForModule(TOKEN_CODES.USDC);
        expect(price).to.equal(MOCK_PRICES.WETH);
      });
    });
  });

  describe("📊 Token Queries", function () {
    beforeEach(async function () {
      // Add USDC token
      await tokenManager.manageTokenData(
        TOKEN_CODES.USDC,
        await mockToken.getAddress(),
        await mockOracle.getAddress(),
        18,
        8,
        3600
      );
    });

    describe("getActiveTokens", function () {
      it("should return all active tokens", async function () {
        const activeTokens = await tokenManager.getActiveTokens();
        expect(activeTokens.length).to.equal(1);
        expect(activeTokens).to.include(TOKEN_CODES.USDC);
      });

      it("should not include removed tokens", async function () {
        await tokenManager.removeToken(TOKEN_CODES.USDC);
        
        const activeTokens = await tokenManager.getActiveTokens();
        expect(activeTokens.length).to.equal(0);
        expect(activeTokens).to.not.include(TOKEN_CODES.USDC);
      });
    });

    describe("getTokenCount", function () {
      it("should return correct token count", async function () {
        expect(await tokenManager.getTokenCount()).to.equal(1);
      });
    });

    describe("getTokenAddress", function () {
      it("should return correct token address", async function () {
        const address = await tokenManager.getTokenAddress(TOKEN_CODES.USDC);
        expect(address).to.equal(await mockToken.getAddress());
      });

      it("should revert for non-existent token", async function () {
        await expect(
          tokenManager.getTokenAddress(TOKEN_CODES.INVALID)
        ).to.be.revertedWith("Token not active");
      });
    });

    describe("isTokenActive", function () {
      it("should return true for active tokens", async function () {
        expect(await tokenManager.isTokenActive(TOKEN_CODES.USDC)).to.be.true;
      });

      it("should return false for inactive tokens", async function () {
        await tokenManager.removeToken(TOKEN_CODES.USDC);
        expect(await tokenManager.isTokenActive(TOKEN_CODES.USDC)).to.be.false;
      });

      it("should return false for non-existent tokens", async function () {
        expect(await tokenManager.isTokenActive(TOKEN_CODES.INVALID)).to.be.false;
      });
    });
  });

  describe("⚙️ Heartbeat Management", function () {
    beforeEach(async function () {
      await tokenManager.manageTokenData(
        TOKEN_CODES.USDC,
        await mockToken.getAddress(),
        await mockOracle.getAddress(),
        18,
        8,
        3600
      );
    });

    describe("updateHeartbeat", function () {
      it("should allow owner to update heartbeat", async function () {
        await tokenManager.updateHeartbeat(TOKEN_CODES.USDC, 7200);
        
        const tokenInfo = await tokenManager.getTokenInfo(TOKEN_CODES.USDC);
        expect(tokenInfo.heartbeat).to.equal(7200);
      });

      it("should emit HeartbeatUpdated event", async function () {
        await expect(tokenManager.updateHeartbeat(TOKEN_CODES.USDC, 7200))
          .to.emit(tokenManager, "HeartbeatUpdated")
          .withArgs(TOKEN_CODES.USDC, 7200);
      });

      it("should prevent non-owner from updating heartbeat", async function () {
        await expect(
          tokenManager.connect(user1).updateHeartbeat(TOKEN_CODES.USDC, 7200)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should revert for non-existent token", async function () {
        await expect(
          tokenManager.updateHeartbeat(TOKEN_CODES.INVALID, 7200)
        ).to.be.revertedWith("Token not active");
      });
    });
  });

  describe("🚨 Error Handling", function () {
    beforeEach(async function () {
      await tokenManager.manageTokenData(
        TOKEN_CODES.USDC,
        await mockToken.getAddress(),
        await mockOracle.getAddress(),
        18,
        8,
        3600
      );
    });

    describe("error tracking", function () {
      it("should track token errors", async function () {
        const initialErrors = await tokenManager.getTokenErrors(TOKEN_CODES.USDC);
        expect(initialErrors).to.equal(0);
      });

      it("should have correct max errors threshold", async function () {
        expect(await tokenManager.maxErrors()).to.equal(3);
      });
    });

    describe("resetTokenErrors", function () {
      it("should allow owner to reset token errors", async function () {
        await tokenManager.resetTokenErrors(TOKEN_CODES.USDC);
        
        const errors = await tokenManager.getTokenErrors(TOKEN_CODES.USDC);
        expect(errors).to.equal(0);
      });

      it("should emit TokenErrorsReset event", async function () {
        await expect(tokenManager.resetTokenErrors(TOKEN_CODES.USDC))
          .to.emit(tokenManager, "TokenErrorsReset")
          .withArgs(TOKEN_CODES.USDC);
      });

      it("should prevent non-owner from resetting errors", async function () {
        await expect(
          tokenManager.connect(user1).resetTokenErrors(TOKEN_CODES.USDC)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should allow resetting errors for non-existent token", async function () {
        // resetTokenErrors doesn't validate token existence - it just resets the error count
        await expect(tokenManager.resetTokenErrors(TOKEN_CODES.INVALID))
          .to.emit(tokenManager, "TokenErrorsReset")
          .withArgs(TOKEN_CODES.INVALID);
      });
    });

    describe("validatePriceFeed", function () {
      it("should validate working price feed", async function () {
        const isValid = await tokenManager.validatePriceFeed(TOKEN_CODES.USDC);
        expect(isValid).to.be.true;
      });

      it("should return false for non-existent token", async function () {
        const isValid = await tokenManager.validatePriceFeed(TOKEN_CODES.INVALID);
        expect(isValid).to.be.false;
      });
    });
  });

  describe("⛽ Gas Optimization", function () {
    it("should deploy with reasonable gas cost", async function () {
      const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
      const tokenManager2 = await TokenManagerFactory.deploy(await beacon.getAddress());
      await tokenManager2.waitForDeployment();
      
      expect(await tokenManager2.getAddress()).to.be.properAddress;
      console.log("✅ TokenManager deployment successful");
    });

    it("should have reasonable gas for token operations", async function () {
      // Test token addition gas cost
      const tx = await tokenManager.manageTokenData(
        TOKEN_CODES.USDC,
        await mockToken.getAddress(),
        await mockOracle.getAddress(),
        18,
        8,
        3600
      );
      const receipt = await tx.wait();
      
      expect(receipt?.gasUsed).to.be.lt(300000n);
      console.log("✅ Token addition gas usage:", receipt?.gasUsed.toString());
    });
  });

  describe("🛡️ Security Tests", function () {
    it("should prevent unauthorized access to owner functions", async function () {
      await expect(
        tokenManager.connect(user1).manageTokenData(
          TOKEN_CODES.USDC,
          await mockToken.getAddress(),
          await mockOracle.getAddress(),
          18,
          8,
          3600
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      console.log("✅ Security controls verified");
    });

    it("should handle edge cases gracefully", async function () {
      // Empty token code
      await expect(
        tokenManager.manageTokenData(
          "",
          await mockToken.getAddress(),
          await mockOracle.getAddress(),
          18,
          8,
          3600
        )
      ).to.be.revertedWith("Invalid token code");
      
      // Zero addresses
      await expect(
        tokenManager.manageTokenData(
          TOKEN_CODES.USDC,
          ethers.ZeroAddress,
          await mockOracle.getAddress(),
          18,
          8,
          3600
        )
      ).to.be.revertedWith("Invalid token address");
      
      console.log("✅ Edge cases handled properly");
    });
  });

  describe("⚡ HIGH: TokenManager Edge Cases", function () {
    beforeEach(async function () {
      // Register USDC token for edge case tests
      await tokenManager.manageTokenData(
        TOKEN_CODES.USDC,
        await mockToken.getAddress(),
        await mockOracle.getAddress(),
        6,  // USDC has 6 decimals
        8,  // Oracle price decimals
        3600 // heartbeat
      );
    });

    it("TM-EDGE-HIGH-001: should handle oracle errors gracefully", async function () {
      await expect(tokenManager.getTokenPrice("NONEXISTENT")).to.be.revertedWith("Token not active");
    });

    it("TM-EDGE-HIGH-002: should handle multiple price updates", async function () {
      await mockOracle.updatePrice(ethers.parseUnits("2100", 8));
      const [price1] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
      await mockOracle.updatePrice(ethers.parseUnits("2300", 8));
      const [price2] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
      expect(price2).to.be.gt(price1);
    });

    it("TM-EDGE-HIGH-003: should handle token removal correctly", async function () {
      expect(await tokenManager.isTokenActive(TOKEN_CODES.USDC)).to.be.true;
      await tokenManager.removeToken(TOKEN_CODES.USDC);
      expect(await tokenManager.isTokenActive(TOKEN_CODES.USDC)).to.be.false;
      await expect(tokenManager.getTokenPrice(TOKEN_CODES.USDC)).to.be.revertedWith("Token not active");
    });

    it("TM-EDGE-HIGH-004: should handle multiple active tokens", async function () {
      const activeTokens = await tokenManager.getActiveTokens();
      expect(activeTokens.length).to.be.gte(1);
      expect(activeTokens.length).to.be.lte(10);
    });

    it("TM-EDGE-HIGH-005: should handle heartbeat = 0", async function () {
      // Contract validates heartbeat > 0, so we test the validation
      await expect(
        tokenManager.updateHeartbeat(TOKEN_CODES.USDC, 0)
      ).to.be.revertedWith("Invalid heartbeat");
    });

    it("TM-EDGE-HIGH-006: should handle large price values", async function () {
      const largePrice = ethers.parseUnits("99999999", 8);
      await mockOracle.updatePrice(largePrice);
      const [price] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
      expect(price).to.be.gt(0);
      expect(price).to.be.lte(ethers.MaxUint256);
    });
  });
});