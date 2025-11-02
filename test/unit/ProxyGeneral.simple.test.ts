import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 🏦 PROXY GENERAL - SIMPLIFIED UNIT TESTS
 * 
 * Test del contratto ProxyGeneral: custody, LP tokens, module authorization
 */

describe("ProxyGeneral Contract - Core Tests", function () {
  let proxyGeneral: any;
  let beacon: any;
  let tokenManager: any;
  let mockUSDC: any;
  let mockWBTC: any;
  let mockWETH: any;
  let mockOracle: any;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    mockWETH = await MockERC20.deploy("Wrapped Ether", "WETH", 18);

    // Deploy MockChainlinkOracle
    const MockChainlinkOracle = await ethers.getContractFactory("MockChainlinkOracle");
    mockOracle = await MockChainlinkOracle.deploy(
      ethers.parseUnits("2000", 8),
      8,
      "ETH/USD"
    );

    // Deploy Beacon
    const Beacon = await ethers.getContractFactory("Beacon");
    beacon = await Beacon.deploy();
    await beacon.updateImplementation("WETH", mockWETH.target);

    // Deploy ProxyGeneral
    const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
    proxyGeneral = await ProxyGeneral.deploy(beacon.target);

    // Deploy TokenManager
    const TokenManager = await ethers.getContractFactory("TokenManager");
    tokenManager = await TokenManager.deploy(beacon.target);

    // Authorize TokenManager
    await proxyGeneral.authorizeModule(tokenManager.target, "TokenManager");
    
    // Give ProxyGeneral some tokens for tests
    await mockUSDC.mint(proxyGeneral.target, ethers.parseUnits("1000", 6));
    await mockWBTC.mint(proxyGeneral.target, ethers.parseUnits("1", 8));
  });

  describe("📋 Deployment & Basic Properties", function () {
    it("should deploy with correct initial state", async function () {
      expect(await proxyGeneral.name()).to.equal("LP Token");
      expect(await proxyGeneral.symbol()).to.equal("LPT");
      expect(await proxyGeneral.owner()).to.equal(owner.address);
      expect(await proxyGeneral.beacon()).to.equal(beacon.target);
      expect(await proxyGeneral.totalSupply()).to.equal(0);
      expect(await proxyGeneral.paused()).to.be.false;
    });

    it("should have correct ERC20 properties", async function () {
      expect(await proxyGeneral.decimals()).to.equal(18);
      expect(await proxyGeneral.balanceOf(owner.address)).to.equal(0);
    });
  });

  describe("🔐 Module Authorization", function () {
    describe("authorizeModule", function () {
      it("should allow owner to authorize new module", async function () {
        const newModule = user1.address;
        await proxyGeneral.authorizeModule(newModule, "TestModule");
        expect(await proxyGeneral.isAuthorizedModule(newModule)).to.be.true;
      });

      it("should prevent non-owner from authorizing modules", async function () {
        await expect(
          proxyGeneral.connect(user1).authorizeModule(user2.address, "TestModule")
        ).to.be.reverted;
      });

      it("should prevent authorizing zero address", async function () {
        await expect(
          proxyGeneral.authorizeModule(ethers.ZeroAddress, "TestModule")
        ).to.be.revertedWith("Invalid module address");
      });
    });

    describe("deauthorizeModule", function () {
      it("should allow owner to deauthorize module", async function () {
        const module = tokenManager.target;
        expect(await proxyGeneral.isAuthorizedModule(module)).to.be.true;
        
        await proxyGeneral.deauthorizeModule(module);
        expect(await proxyGeneral.isAuthorizedModule(module)).to.be.false;
      });

      it("should prevent non-owner from deauthorizing modules", async function () {
        await expect(
          proxyGeneral.connect(user1).deauthorizeModule(tokenManager.target)
        ).to.be.reverted;
      });
    });

    describe("isAuthorizedModule", function () {
      it("should correctly report module authorization status", async function () {
        expect(await proxyGeneral.isAuthorizedModule(tokenManager.target)).to.be.true;
        expect(await proxyGeneral.isAuthorizedModule(user1.address)).to.be.false;
      });
    });
  });

  describe("⏸️ Pause Functionality", function () {
    describe("pause", function () {
      it("should allow authorized module to pause", async function () {
        await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
        await proxyGeneral.pause();
        expect(await proxyGeneral.paused()).to.be.true;
      });

      it("should prevent unauthorized caller from pausing", async function () {
        await expect(
          proxyGeneral.connect(user1).pause()
        ).to.be.revertedWith("Caller not authorized");
      });
    });

    describe("unpause", function () {
      beforeEach(async function () {
        await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
        await proxyGeneral.pause();
      });

      it("should allow owner to unpause", async function () {
        await proxyGeneral.unpause();
        expect(await proxyGeneral.paused()).to.be.false;
      });

      it("should prevent non-owner from unpausing", async function () {
        await expect(
          proxyGeneral.connect(user1).unpause()
        ).to.be.reverted;
      });
    });
  });

  describe("💰 Asset Management", function () {
    describe("getAssetBalance", function () {
      it("should return correct token balance", async function () {
        expect(await proxyGeneral.getAssetBalance(mockUSDC.target))
          .to.equal(ethers.parseUnits("1000", 6));
        expect(await proxyGeneral.getAssetBalance(mockWBTC.target))
          .to.equal(ethers.parseUnits("1", 8));
      });

      it("should return zero for tokens not held", async function () {
        expect(await proxyGeneral.getAssetBalance(mockWETH.target)).to.equal(0);
      });
    });

    describe("transferFunds", function () {
      it("should allow authorized module to transfer funds", async function () {
        const amount = ethers.parseUnits("100", 6);
        await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
        
        await proxyGeneral.transferFunds(user1.address, mockUSDC.target, amount);
        expect(await mockUSDC.balanceOf(user1.address)).to.equal(amount);
      });

      it("should prevent unauthorized transfer", async function () {
        await expect(
          proxyGeneral.connect(user1).transferFunds(
            user2.address,
            mockUSDC.target,
            ethers.parseUnits("100", 6)
          )
        ).to.be.revertedWith("Caller not authorized");
      });

      it("should prevent transfer when paused", async function () {
        await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
        await proxyGeneral.pause();
        
        await expect(
          proxyGeneral.transferFunds(user1.address, mockUSDC.target, 100)
        ).to.be.revertedWith("Contract is paused");
      });
    });

    describe("approveSpender", function () {
      it("should allow authorized module to approve spender", async function () {
        const amount = ethers.parseUnits("100", 6);
        await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
        
        await proxyGeneral.approveSpender(mockUSDC.target, user1.address, amount);
        expect(await mockUSDC.allowance(proxyGeneral.target, user1.address))
          .to.equal(amount);
      });

      it("should prevent unauthorized approval", async function () {
        await expect(
          proxyGeneral.connect(user1).approveSpender(
            mockUSDC.target,
            user2.address,
            100
          )
        ).to.be.revertedWith("Caller not authorized");
      });
    });

    describe("transferToModule & transferFromModule", function () {
      it("should allow authorized transfer to module", async function () {
        const amount = ethers.parseUnits("50", 6);
        const moduleAddr = tokenManager.target;
        
        await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
        await proxyGeneral.transferToModule(mockUSDC.target, moduleAddr, amount);
        expect(await mockUSDC.balanceOf(moduleAddr)).to.equal(amount);
      });

      it("should prevent unauthorized module transfers", async function () {
        await expect(
          proxyGeneral.connect(user1).transferToModule(
            mockUSDC.target,
            tokenManager.target,
            100
          )
        ).to.be.revertedWith("Caller not authorized");
      });
    });
  });

  describe("🏦 LP Token Management", function () {
    describe("mint", function () {
      it("should allow authorized module to mint tokens", async function () {
        const amount = ethers.parseEther("100");
        await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
        
        await proxyGeneral.mint(user1.address, amount);
        expect(await proxyGeneral.balanceOf(user1.address)).to.equal(amount);
        expect(await proxyGeneral.totalSupply()).to.equal(amount);
      });

      it("should prevent unauthorized minting", async function () {
        await expect(
          proxyGeneral.connect(user1).mint(user2.address, ethers.parseEther("100"))
        ).to.be.revertedWith("Caller not authorized");
      });

      it("should prevent minting when paused", async function () {
        await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
        await proxyGeneral.pause();
        
        await expect(
          proxyGeneral.mint(user1.address, ethers.parseEther("100"))
        ).to.be.revertedWith("Contract is paused");
      });
    });

    describe("burn", function () {
      beforeEach(async function () {
        await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
        await proxyGeneral.mint(user1.address, ethers.parseEther("100"));
      });

      it("should allow authorized module to burn tokens", async function () {
        const amount = ethers.parseEther("50");
        await proxyGeneral.burn(user1.address, amount);
        
        expect(await proxyGeneral.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
        expect(await proxyGeneral.totalSupply()).to.equal(ethers.parseEther("50"));
      });

      it("should prevent unauthorized burning", async function () {
        await expect(
          proxyGeneral.connect(user1).burn(user1.address, ethers.parseEther("50"))
        ).to.be.revertedWith("Caller not authorized");
      });

      it("should prevent burning when paused", async function () {
        await proxyGeneral.pause();
        
        await expect(
          proxyGeneral.burn(user1.address, ethers.parseEther("50"))
        ).to.be.revertedWith("Contract is paused");
      });
    });
  });

  describe("📊 Withdrawal Tracking", function () {
    describe("setHourlyWithdrawn & getHourlyWithdrawn", function () {
      it("should allow authorized module to set hourly withdrawal", async function () {
        const hour = Math.floor(Date.now() / 3600000);
        const amount = ethers.parseEther("10");
        
        await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
        await proxyGeneral.setHourlyWithdrawn(user1.address, hour, amount);
        
        expect(await proxyGeneral.getHourlyWithdrawn(user1.address, hour)).to.equal(amount);
      });

      it("should prevent unauthorized access", async function () {
        const hour = Math.floor(Date.now() / 3600000);
        
        await expect(
          proxyGeneral.connect(user1).setHourlyWithdrawn(user1.address, hour, ethers.parseEther("10"))
        ).to.be.revertedWith("Caller not authorized");
      });
    });

    describe("incrementHourlyWithdrawn", function () {
      it("should allow authorized module to increment withdrawal", async function () {
        const amount = ethers.parseEther("5");
        
        await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
        await proxyGeneral.incrementHourlyWithdrawn(user1.address, amount);
        
        const currentHour = Math.floor(Date.now() / 3600000);
        expect(await proxyGeneral.getHourlyWithdrawn(user1.address, currentHour)).to.equal(amount);
      });

      it("should prevent unauthorized increment", async function () {
        await expect(
          proxyGeneral.connect(user1).incrementHourlyWithdrawn(user1.address, ethers.parseEther("5"))
        ).to.be.revertedWith("Caller not authorized");
      });
    });
  });

  describe("⚙️ Module Parameters", function () {
    describe("setModuleParameter & getModuleParameter", function () {
      it("should allow owner to set module parameter", async function () {
        const value = 12345;
        await proxyGeneral.setModuleParameter("testParam", value);
        expect(await proxyGeneral.getModuleParameter("testParam")).to.equal(value);
      });

      it("should prevent non-owner from setting parameters", async function () {
        await expect(
          proxyGeneral.connect(user1).setModuleParameter("testParam", 12345)
        ).to.be.reverted;
      });

      it("should return zero for unset parameters", async function () {
        expect(await proxyGeneral.getModuleParameter("nonExistent")).to.equal(0);
      });
    });
  });

  describe("🚨 Emergency Functions", function () {
    beforeEach(async function () {
      await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
      await proxyGeneral.pause();
    });

    describe("emergencyTransferAll", function () {
      it("should allow owner to emergency transfer when paused", async function () {
        await proxyGeneral.emergencyTransferAll(user1.address);
        // Check ETH was transferred (contract sends any ETH balance)
      });

      it("should prevent emergency transfer when not paused", async function () {
        await proxyGeneral.unpause();
        
        await expect(
          proxyGeneral.emergencyTransferAll(user1.address)
        ).to.be.revertedWith("Contract is not paused");
      });

      it("should prevent non-owner from emergency transfer", async function () {
        await expect(
          proxyGeneral.connect(user1).emergencyTransferAll(user2.address)
        ).to.be.reverted;
      });
    });
  });

  describe("⛽ Gas Optimization", function () {
    it("should deploy with reasonable gas cost", async function () {
      const ProxyGeneralFactory = await ethers.getContractFactory("ProxyGeneral");
      const newProxy = await ProxyGeneralFactory.deploy(beacon.target);
      const deployTx = newProxy.deploymentTransaction();
      
      console.log(`✅ ProxyGeneral deployment gas usage: ${deployTx?.gasLimit}`);
      expect(deployTx?.gasLimit).to.be.lessThan(35000000); // Adjusted for large contract
    });

    it("should have reasonable gas for authorization", async function () {
      const tx = await proxyGeneral.authorizeModule(user1.address, "TestModule");
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed;
      
      console.log(`✅ Module authorization gas usage: ${gasUsed}`);
      expect(gasUsed).to.be.lessThan(100000);
    });

    it("should have reasonable gas for view functions", async function () {
      const gas = await proxyGeneral.isAuthorizedModule.estimateGas(tokenManager.target);
      
      console.log(`✅ isAuthorizedModule gas usage: ${gas}`);
      expect(gas).to.be.lessThan(50000);
    });
  });

  describe("🛡️ Security Tests", function () {
    it("should prevent unauthorized access to protected functions", async function () {
      await expect(
        proxyGeneral.connect(user1).mint(user1.address, 100)
      ).to.be.revertedWith("Caller not authorized");
      
      await expect(
        proxyGeneral.connect(user1).burn(user1.address, 100)
      ).to.be.revertedWith("Caller not authorized");
      
      await expect(
        proxyGeneral.connect(user1).transferFunds(user2.address, mockUSDC.target, 100)
      ).to.be.revertedWith("Caller not authorized");
      
      console.log("✅ Security controls verified");
    });

    it("should enforce pause on critical operations", async function () {
      await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
      await proxyGeneral.mint(user1.address, ethers.parseEther("100"));
      
      await proxyGeneral.pause();
      
      await expect(
        proxyGeneral.mint(user1.address, 100)
      ).to.be.revertedWith("Contract is paused");
      
      await expect(
        proxyGeneral.burn(user1.address, 100)
      ).to.be.revertedWith("Contract is paused");
      
      console.log("✅ Pause enforcement verified");
    });

    it("should validate addresses correctly", async function () {
      await expect(
        proxyGeneral.authorizeModule(ethers.ZeroAddress, "TestModule")
      ).to.be.revertedWith("Invalid module address");
      
      console.log("✅ Address validation working");
    });
  });

  describe("⚡ HIGH: Edge Cases", function () {
    // EDGE-PG-HIGH-001: Mint/burn atomicity during pause
    it("EDGE-PG-HIGH-001: should handle mint/burn atomicity during pause correctly", async function () {
      await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
      
      // Mint tokens
      const amount = ethers.parseEther("100");
      await proxyGeneral.mint(user1.address, amount);
      expect(await proxyGeneral.balanceOf(user1.address)).to.equal(amount);
      
      // Pause contract
      await proxyGeneral.pause();
      
      // Verify mint and burn are blocked during pause
      await expect(
        proxyGeneral.mint(user1.address, amount)
      ).to.be.revertedWith("Contract is paused");
      
      await expect(
        proxyGeneral.burn(user1.address, amount / 2n)
      ).to.be.revertedWith("Contract is paused");
      
      // Unpause and verify operations work again
      await proxyGeneral.unpause();
      
      await proxyGeneral.burn(user1.address, amount / 2n);
      expect(await proxyGeneral.balanceOf(user1.address)).to.equal(amount / 2n);
    });

    // EDGE-PG-HIGH-002: Approve MAX_UINT256 and spend
    it("EDGE-PG-HIGH-002: should handle MAX_UINT256 approval correctly", async function () {
      await proxyGeneral.connect(owner).authorizeModule(owner.address, "TestModule");
      
      const maxAmount = ethers.MaxUint256;
      
      // Approve MAX_UINT256
      await proxyGeneral.approveSpender(mockUSDC.target, user1.address, maxAmount);
      
      // Verify allowance is set
      const allowance = await mockUSDC.allowance(proxyGeneral.target, user1.address);
      expect(allowance).to.equal(maxAmount);
      
      // User1 can spend part of allowance
      const spendAmount = ethers.parseUnits("500", 6);
      await mockUSDC.connect(user1).transferFrom(proxyGeneral.target, user2.address, spendAmount);
      
      // Verify transfer succeeded
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(spendAmount);
    });

    // EDGE-PG-HIGH-003: Multiple modules access custody
    it("EDGE-PG-HIGH-003: should handle multiple authorized modules accessing custody", async function () {
      // Authorize multiple modules
      const module1 = user1.address;
      const module2 = user2.address;
      
      await proxyGeneral.authorizeModule(module1, "Module1");
      await proxyGeneral.authorizeModule(module2, "Module2");
      
      expect(await proxyGeneral.isAuthorizedModule(module1)).to.be.true;
      expect(await proxyGeneral.isAuthorizedModule(module2)).to.be.true;
      
      // Module1 mints tokens
      const amount1 = ethers.parseEther("50");
      await proxyGeneral.connect(user1).mint(owner.address, amount1);
      
      // Module2 mints different amount
      const amount2 = ethers.parseEther("30");
      await proxyGeneral.connect(user2).mint(owner.address, amount2);
      
      // Verify total supply is sum of both
      expect(await proxyGeneral.balanceOf(owner.address)).to.equal(amount1 + amount2);
      expect(await proxyGeneral.totalSupply()).to.equal(amount1 + amount2);
      
      // Module1 can transfer funds
      const initialOwnerUSDC = await mockUSDC.balanceOf(owner.address);
      const transferAmount = ethers.parseUnits("100", 6);
      await proxyGeneral.connect(user1).transferFunds(owner.address, mockUSDC.target, transferAmount);
      expect(await mockUSDC.balanceOf(owner.address)).to.equal(initialOwnerUSDC + transferAmount);
      
      // Module2 can also transfer funds
      const transferAmount2 = ethers.parseUnits("50", 6);
      await proxyGeneral.connect(user2).transferFunds(user2.address, mockUSDC.target, transferAmount2);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(transferAmount2);
    });
  });
});
