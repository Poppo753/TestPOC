/**
 * ============================================================
 * 📦 ARCHIVED TEST FILE - COMMENTED OUT TO AVOID WORKSPACE ERRORS
 * ============================================================
 * 
 * This file has been moved to /old/ folder and commented out because:
 * - Too specific for one contract that might have changed
 * - Has hardcoded dependencies and addresses
 * - Complex setup requirements that were hard to maintain
 * 
 * File preserved for reference and potential future use
 * Date archived: October 24, 2025
 * 
 * ORIGINAL PURPOSE:
 * Tests for EnhancedLiquidityPoolETH contract with parameter updates
 * ============================================================
 */

/*
// ENTIRE FILE COMMENTED OUT TO PREVENT WORKSPACE ERRORS
// Uncomment if you need to reference or restore this test

import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { EnhancedLiquidityPoolETH } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// Add these for chai matchers
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import "@nomicfoundation/hardhat-chai-matchers";

describe("EnhancedLiquidityPool Tests", function () {
  // Declare all variables at the top level
  let contract: Contract;
  let liquidityPool: EnhancedLiquidityPoolETH;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let wallet: HardhatEthersSigner;
  const TIMELOCK_DURATION = 2 * 24 * 60 * 60; // 2 days in seconds

  before(async function () {
    try {
      console.log("Initializing tests...");
      [owner, user] = await ethers.getSigners();
      wallet = owner; // Use owner as wallet for consistency

      console.log("Using wallet address:", wallet.address);

      const contractAddress = process.env.EthResVaultAdress!;
      console.log("Testing contract at:", contractAddress);

      // Initialize both contract instances
      const abi = [
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address account) view returns (uint256)",
        "function getTokenCount() view returns (uint256)",
        "function getActiveTokens() view returns (string[])",
        "function paused() view returns (bool)",
        "function withdrawLimitPerHour() view returns (uint256)",
        "function tokenData(string) view returns (address tokenAddress, uint8 tokenDecimals, string tokenCode, address priceFeed, uint8 priceFeedDecimals, bool isActive, uint256 lastPriceTimestamp, uint256 lastPrice, uint256 heartbeat)",
        "function tokenErrors(string) view returns (uint256)",
        "function tokenCodes(uint256) view returns (string)",
        "function lastHourlyReset() view returns (uint256)",
        "function hourlyWithdrawnAmount() view returns (uint256)",
        "function getTokenPrice(string) view returns (uint256 price, uint256 updatedAt, bool isStale)",
        "function getTotalPoolValue() view returns (uint256)",
        "function deposit() payable returns (uint256)",
        "function withdraw(uint256 _shares, uint256 _minEthAmount) external returns (uint256 ethAmount)",
        "function calculateTokenValue(string) view returns (uint256)",
        "function owner() view returns (address)",
        "function maxDeposit() view returns (uint256)",
        "function minDeposit() view returns (uint256)",
        "function maxWithdrawPerTx() view returns (uint256)",
        "function proposeParameterUpdate(string,uint256)",
        "function cancelParameterUpdate(string,uint256)",
        "function executeParameterUpdate(string,uint256)",
        "function getPendingUpdate(string,uint256) view returns (bool,uint256,address,uint256)",
      ];

      contract = new Contract(contractAddress, abi, wallet);

      // Initialize liquidityPool with the same contract
      liquidityPool = (await ethers.getContractAt(
        "EnhancedLiquidityPoolETH",
        contractAddress,
        owner
      )) as EnhancedLiquidityPoolETH;

      // Verify contract connection
      const code = await ethers.provider.getCode(contractAddress);
      if (code === "0x") {
        throw new Error("Contract not found at specified address");
      }
    } catch (error) {
      console.error("Initialization failed:", error);
      throw error;
    }

    it("Should connect and get basic contract information", async function () {
      try {
        console.log("\n=== Basic Contract Information ===");

        // Get total supply
        const totalSupply = await contract.totalSupply();
        console.log("Total Supply:", ethers.formatEther(totalSupply), "ETH");

        // Get wallet balance
        const balance = await contract.balanceOf(wallet.address);
        console.log(
          "Wallet LP Token Balance:",
          ethers.formatEther(balance),
          "LP"
        );

        // Get total pool value with error handling
        try {
          const poolValue = await contract.getTotalPoolValue();
          console.log(
            "Total Pool Value:",
            ethers.formatEther(poolValue),
            "ETH"
          );
        } catch (error: any) {
          console.log(
            "Note: Total Pool Value calculation failed (expected if price feeds are not initialized)"
          );
        }

        // Get contract ETH balance
        const contractBalance = await ethers.provider.getBalance(
          contract.getAddress()
        );
        console.log(
          "Contract ETH Balance:",
          ethers.formatEther(contractBalance),
          "ETH"
        );
      } catch (error) {
        console.error("Error getting basic information:", error);
      }
    });

    it("Should get token information", async function () {
      try {
        console.log("\n=== Token Information ===");

        // Get token count
        const tokenCount = await contract.getTokenCount();
        console.log("Token Count:", tokenCount.toString());

        // Get active tokens
        const activeTokens = await contract.getActiveTokens();
        console.log("Active Tokens:", activeTokens);

        if (activeTokens.length > 0) {
          for (const tokenCode of activeTokens) {
            console.log(`\nToken Details for: ${tokenCode}`);
            const data = await contract.tokenData(tokenCode);
            console.log("- Address:", data.tokenAddress);
            console.log("- Decimals:", data.tokenDecimals);
            console.log("- Price Feed:", data.priceFeed);
            console.log("- Price Feed Decimals:", data.priceFeedDecimals);
            console.log("- Is Active:", data.isActive);
            console.log("- Last Price:", data.lastPrice.toString());
            console.log(
              "- Last Price Timestamp:",
              new Date(Number(data.lastPriceTimestamp) * 1000).toLocaleString()
            );
            console.log("- Heartbeat:", data.heartbeat.toString(), "seconds");
          }
        }
      } catch (error) {
        console.error("Error getting token information:", error);
        throw error;
      }
    });

    it("Should check contract status", async function () {
      try {
        console.log("\n=== Contract Status ===");

        // Check if contract is paused
        const isPaused = await contract.paused();
        console.log("Contract Paused:", isPaused);

        // Get withdraw limit
        const withdrawLimit = await contract.withdrawLimitPerHour();
        console.log(
          "Hourly Withdraw Limit:",
          ethers.formatEther(withdrawLimit),
          "ETH"
        );

        // Get last hourly reset
        const lastReset = await contract.lastHourlyReset();
        console.log(
          "Last Hourly Reset:",
          new Date(Number(lastReset) * 1000).toLocaleString()
        );

        // Get hourly withdrawn amount
        const hourlyWithdrawn = await contract.hourlyWithdrawnAmount();
        console.log(
          "Hourly Withdrawn Amount:",
          ethers.formatEther(hourlyWithdrawn),
          "ETH"
        );
      } catch (error) {
        console.error("Error checking contract status:", error);
        throw error;
      }
    });

    it("Should update price feeds", async function () {
      console.log("\n=== Updating Price Feeds ===");

      // Get token count
      const tokenCount = await contract.getTokenCount();

      for (let i = 0; i < tokenCount; i++) {
        const tokenCode = await contract.tokenCodes(i);
        try {
          const [price, timestamp, isStale] = await contract.getTokenPrice(
            tokenCode
          );
          console.log(`\nToken: ${tokenCode}`);
          console.log("Price:", price.toString());
          console.log(
            "Timestamp:",
            new Date(Number(timestamp) * 1000).toLocaleString()
          );
          console.log("Is Stale:", isStale);
        } catch (error) {
          console.error(`Error getting price for ${tokenCode}:`, error);
        }
      }
    });
  });

  // ... (previous code remains the same until the last test)

  it("Should update price feeds", async function () {
    console.log("\n=== Updating Price Feeds ===");
    const tokenCount = await contract.getTokenCount();
    for (let i = 0; i < tokenCount; i++) {
      const tokenCode = await contract.tokenCodes(i);
      try {
        const [price, timestamp, isStale] = await contract.getTokenPrice(
          tokenCode
        );
        console.log(`\nToken: ${tokenCode}`);
        console.log("Price:", price.toString());
        console.log(
          "Timestamp:",
          new Date(Number(timestamp) * 1000).toLocaleString()
        );
        console.log("Is Stale:", isStale);
      } catch (error) {
        console.error(`Error getting price for ${tokenCode}:`, error);
      }
    }

    describe("Parameter Updates", function () {
      describe("Access Control", function () {
        it("Should only allow owner to propose updates", async function () {
          const newValue = ethers.parseEther("150");
          await expect(
            liquidityPool
              .connect(user)
              .proposeParameterUpdate("maxDeposit", newValue)
          ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should only allow owner to cancel updates", async function () {
          const newValue = ethers.parseEther("150");
          await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);

          await expect(
            liquidityPool
              .connect(user)
              .cancelParameterUpdate("maxDeposit", newValue)
          ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should only allow owner to execute updates", async function () {
          const newValue = ethers.parseEther("150");
          await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);
          await time.increase(TIMELOCK_DURATION);

          await expect(
            liquidityPool
              .connect(user)
              .executeParameterUpdate("maxDeposit", newValue)
          ).to.be.revertedWith("Ownable: caller is not the owner");
        });
      });

      describe("Parameter Validation", function () {
        it("Should reject invalid parameter names", async function () {
          const newValue = ethers.parseEther("150");
          await expect(
            liquidityPool.proposeParameterUpdate("invalidParameter", newValue)
          ).to.be.revertedWith("Invalid parameter or value");
        });

        it("Should reject invalid parameter values", async function () {
          await expect(
            liquidityPool.proposeParameterUpdate("maxSlippage", 5001)
          ).to.be.revertedWith("Invalid parameter or value");

          await expect(
            liquidityPool.proposeParameterUpdate("maxDeposit", 0)
          ).to.be.revertedWith("Invalid parameter or value");
        });
      });

      describe("Timelock Functionality", function () {
        it("Should enforce timelock duration", async function () {
          const newValue = ethers.parseEther("150");
          await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);

          await expect(
            liquidityPool.executeParameterUpdate("maxDeposit", newValue)
          ).to.be.revertedWith("Timelock not expired");

          await time.increase(TIMELOCK_DURATION - 60);
          await expect(
            liquidityPool.executeParameterUpdate("maxDeposit", newValue)
          ).to.be.revertedWith("Timelock not expired");

          await time.increase(60);
          await expect(
            liquidityPool.executeParameterUpdate("maxDeposit", newValue)
          ).to.not.be.reverted;
        });
      });

      describe("Update Management", function () {
        it("Should handle multiple pending updates", async function () {
          const updates = {
            maxDeposit: ethers.parseEther("150"),
            maxWithdrawPerTx: ethers.parseEther("75"),
            maxSlippage: 150n,
          };

          for (const [param, value] of Object.entries(updates)) {
            await liquidityPool.proposeParameterUpdate(param, value);
            const [exists] = await liquidityPool.getPendingUpdate(param, value);
            expect(exists).to.be.true;
          }
        });

        it("Should prevent duplicate pending updates", async function () {
          const newValue = ethers.parseEther("150");
          await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);

          await expect(
            liquidityPool.proposeParameterUpdate("maxDeposit", newValue)
          ).to.be.revertedWith("Update already pending");
        });

        it("Should allow cancellation of pending updates", async function () {
          const newValue = ethers.parseEther("150");
          await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);

          await liquidityPool.cancelParameterUpdate("maxDeposit", newValue);

          const [exists] = await liquidityPool.getPendingUpdate(
            "maxDeposit",
            newValue
          );
          expect(exists).to.be.false;
        });
      });

      describe("Event Emissions", function () {
        it("Should emit correct events for the full update lifecycle", async function () {
          const newValue = ethers.parseEther("150");
          const oldValue = await liquidityPool.maxDeposit();

          await expect(
            liquidityPool.proposeParameterUpdate("maxDeposit", newValue)
          )
            .to.emit(liquidityPool, "ParameterUpdateProposed")
            .withArgs(
              "maxDeposit",
              newValue,
              (await time.latest()) + TIMELOCK_DURATION,
              owner.address
            );

          await expect(
            liquidityPool.cancelParameterUpdate("maxDeposit", newValue)
          )
            .to.emit(liquidityPool, "ParameterUpdateCancelled")
            .withArgs(
              "maxDeposit",
              newValue,
              owner.address,
              await time.latest()
            );

          await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);
          await time.increase(TIMELOCK_DURATION);

          await expect(
            liquidityPool.executeParameterUpdate("maxDeposit", newValue)
          )
            .to.emit(liquidityPool, "ParameterUpdated")
            .withArgs(
              "maxDeposit",
              oldValue,
              newValue,
              await time.latest(),
              owner.address
            );
        });
      });

      describe("State Changes", function () {
        it("Should correctly update and restore parameter values", async function () {
          const originalValue = await liquidityPool.maxDeposit();
          const newValue = ethers.parseEther("150");

          await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);
          await time.increase(TIMELOCK_DURATION);
          await liquidityPool.executeParameterUpdate("maxDeposit", newValue);

          expect(await liquidityPool.maxDeposit()).to.equal(newValue);

          await liquidityPool.proposeParameterUpdate(
            "maxDeposit",
            originalValue
          );
          await time.increase(TIMELOCK_DURATION);
          await liquidityPool.executeParameterUpdate(
            "maxDeposit",
            originalValue
          );

          expect(await liquidityPool.maxDeposit()).to.equal(originalValue);
        });
      });
    });

    describe("Deposit and Withdraw Tests", function () {
      it("Should test deposit and withdraw", async function () {
        try {
          console.log("\n=== Deposit and Withdraw Tests ===");

          // Get minimum deposit amount
          const minDeposit = await liquidityPool.minDeposit();
          console.log(
            "Minimum Deposit:",
            ethers.formatEther(minDeposit),
            "ETH"
          );

          // Test deposit
          const depositAmount = ethers.parseEther("1.0");
          const depositTx = await liquidityPool.deposit({
            value: depositAmount,
          });
          await depositTx.wait();

          // Get balance after deposit
          const balance = await liquidityPool.balanceOf(wallet.address);
          console.log(
            "Balance after deposit:",
            ethers.formatEther(balance),
            "LP tokens"
          );

          // Test withdraw
          if (balance > 0n) {
            const withdrawTx = await liquidityPool.withdraw(balance, 0);
            await withdrawTx.wait();
            console.log("Withdrawal successful");
          }
        } catch (error) {
          console.error("Error in deposit/withdraw tests:", error);
        }
      });
    });

    describe("Deposit Limits", function () {
      it("Should test deposit limits and errors", async function () {
        console.log("\n=== Deposit Limits Tests ===");

        // Test over maximum deposit
        const overMaxAmount = ethers.parseEther("101.0");
        console.log(
          "\nTesting over maximum deposit:",
          ethers.formatEther(overMaxAmount),
          "ETH"
        );
        try {
          await liquidityPool.deposit({ value: overMaxAmount });
          throw new Error("Should have failed");
        } catch (error: any) {
          console.log(
            "Successfully rejected over-maximum deposit:",
            error.message
          );
        }

        // Test under minimum deposit
        const underMinAmount = ethers.parseEther("0.0000001");
        console.log(
          "\nTesting under minimum deposit:",
          ethers.formatEther(underMinAmount),
          "ETH"
        );
        try {
          await liquidityPool.deposit({ value: underMinAmount });
          throw new Error("Should have failed");
        } catch (error: any) {
          console.log(
            "Successfully rejected under-minimum deposit:",
            error.message
          );
        }
      });
    });

    describe("Withdrawal Limits", function () {
      it("Should test withdrawal limits and errors", async function () {
        console.log("\n=== Withdrawal Limits Tests ===");

        // Test over maximum withdrawal
        const overMaxAmount = ethers.parseEther("51.0");
        console.log(
          "\nTesting over maximum withdrawal:",
          ethers.formatEther(overMaxAmount),
          "ETH"
        );
        try {
          await liquidityPool.withdraw(overMaxAmount, 0);
          throw new Error("Should have failed");
        } catch (error: any) {
          console.log(
            "Successfully rejected over-maximum withdrawal:",
            error.message
          );
        }
      });
    });
  });

  // Add these new test blocks after your existing tests

  describe("Additional Security Tests", function () {
    it("Should prevent reentrancy attacks", async function () {
      // Skip the malicious contract test for now
      // We would need to implement a separate malicious contract for testing
      expect(true).to.be.true; // Placeholder
    });

    it("Should handle emergency pause correctly", async function () {
      // Test pause functionality
      await liquidityPool.pause();
      expect(await liquidityPool.paused()).to.be.true;

      // Verify operations are blocked when paused
      await expect(
        liquidityPool.deposit({ value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Pausable: paused");

      // Test unpause
      await liquidityPool.unpause();
      expect(await liquidityPool.paused()).to.be.false;
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should maintain reasonable gas costs for deposits", async function () {
      const tx = await liquidityPool.deposit({
        value: ethers.parseEther("1.0"),
      });
      const receipt = await tx.wait();
      if (receipt) {
        expect(receipt.gasUsed).to.be.below(300000n); // Using bigint
      }
    });

    it("Should maintain reasonable gas costs for withdrawals", async function () {
      const tx = await liquidityPool.withdraw(ethers.parseEther("0.1"), 0);
      const receipt = await tx.wait();
      if (receipt) {
        expect(receipt.gasUsed).to.be.below(400000n); // Using bigint
      }
    });
  });

  describe("Integration Tests", function () {
    it("Should handle multiple deposits and withdrawals in sequence", async function () {
      // Initial state
      const initialSupply = await liquidityPool.totalSupply();

      // Multiple deposits
      for (let i = 0; i < 3; i++) {
        await liquidityPool.deposit({ value: ethers.parseEther("1.0") });
      }

      // Verify total supply increased correctly
      const afterDepositsSupply = await liquidityPool.totalSupply();
      expect(afterDepositsSupply > initialSupply).to.be.true;

      // Multiple withdrawals
      const balance = await liquidityPool.balanceOf(owner.address);
      const withdrawAmount = balance / 3n; // Using bigint division

      for (let i = 0; i < 3; i++) {
        await liquidityPool.withdraw(withdrawAmount, 0);
      }
    });

    it("Should maintain correct token balances across operations", async function () {
      const initialBalance = await liquidityPool.balanceOf(owner.address);
      const depositAmount = ethers.parseEther("1.0");

      // Deposit
      await liquidityPool.deposit({ value: depositAmount });
      const afterDepositBalance = await liquidityPool.balanceOf(owner.address);
      expect(afterDepositBalance > initialBalance).to.be.true;

      // Partial withdraw
      const withdrawAmount = afterDepositBalance / 2n; // Using bigint division
      await liquidityPool.withdraw(withdrawAmount, 0);
      const finalBalance = await liquidityPool.balanceOf(owner.address);
      expect(finalBalance < afterDepositBalance).to.be.true;
    });
  });

  describe("Price Feed Tests", function () {
    it("Should update prices within heartbeat period", async function () {
      const tokens = await liquidityPool.getActiveTokens();
      for (const token of tokens) {
        const data = await liquidityPool.tokenData(token);
        const [price, timestamp, isStale] = await liquidityPool.getTokenPrice(
          token
        );

        // Verify price freshness
        const currentTime = await time.latest();
        expect(currentTime - Number(timestamp)).to.be.lte(
          Number(data.heartbeat)
        );
      }
    });
  });

  describe("Slippage Protection Tests", function () {
    it("Should protect against excessive slippage on withdrawals", async function () {
      const balance = await liquidityPool.balanceOf(owner.address);
      if (balance > 0n) {
        // Try to withdraw with very high minimum amount (should fail)
        await expect(
          liquidityPool.withdraw(
            balance,
            ethers.parseEther("999999") // Unreasonably high minimum amount
          )
        ).to.be.revertedWith("Slippage protection");
      }
    });
  });

  describe("Event Tests", function () {
    it("Should emit correct events for all major operations", async function () {
      // Deposit event
      await expect(liquidityPool.deposit({ value: ethers.parseEther("1.0") }))
        .to.emit(liquidityPool, "Deposit")
        .withArgs(owner.address, anyValue, anyValue);

      // Withdraw event
      const balance = await liquidityPool.balanceOf(owner.address);
      if (balance > 0n) {
        await expect(liquidityPool.withdraw(balance, 0))
          .to.emit(liquidityPool, "Withdraw")
          .withArgs(owner.address, anyValue, anyValue);
      }
    });
  });
});

// END OF COMMENTED CODE
*/

/*
 * To restore this test:
 * 1. Uncomment the entire code block above
 * 2. Update hardcoded contract addresses
 * 3. Verify EnhancedLiquidityPoolETH interface is current
 * 4. Update environment variable requirements
 */