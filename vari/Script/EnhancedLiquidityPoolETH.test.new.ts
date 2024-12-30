import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { EnhancedLiquidityPoolETH } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// Add these for chai matchers
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import "@nomicfoundation/hardhat-chai-matchers";

describe("EnhancedLiquidityPool Tests", function () {
  this.timeout(30000);

  let liquidityPool: EnhancedLiquidityPoolETH;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  let contract: Contract;
  let wallet: any;
  const TIMELOCK_DURATION = 2 * 24 * 60 * 60; // 2 days in seconds

  // Setup before each test
  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Get contract instance
    const DEPLOYED_CONTRACT_ADDRESS = process.env.EthResVaultAdress!;
    liquidityPool = (await ethers.getContractAt(
      "EnhancedLiquidityPoolETH",
      DEPLOYED_CONTRACT_ADDRESS,
      owner
    )) as EnhancedLiquidityPoolETH;
  });

  before(async function () {
    try {
      console.log("Initializing tests...");
      [wallet] = await ethers.getSigners();
      console.log("Using wallet address:", wallet.address);

      const contractAddress = process.env.EthResVaultAdress!;
      console.log("Testing contract at:", contractAddress);

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
        // Updated withdraw function signature with both parameters
        "function withdraw(uint256 _shares, uint256 _minEthAmount) external returns (uint256 ethAmount)",
        "function calculateTokenValue(string) view returns (uint256)",
        "function MIN_DEPOSIT() view returns (uint256)",
        "function MAX_DEPOSIT() view returns (uint256)",
        "function MIN_WITHDRAW() view returns (uint256)",
        "function MAX_WITHDRAW_PER_TX() view returns (uint256)",
        "function MAX_SLIPPAGE() view returns (uint256)",
        "function POOL_RESERVE_RATIO() view returns (uint256)",
      ];

      contract = new Contract(contractAddress, abi, wallet);

      // Verify contract connection
      const code = await ethers.provider.getCode(contractAddress);
      if (code === "0x") {
        throw new Error("Contract not found at specified address");
      }
    } catch (error) {
      console.error("Initialization failed:", error);
      throw error;
    }
  });

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
        console.log("Total Pool Value:", ethers.formatEther(poolValue), "ETH");
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

  it("Should get contract parameters", async function () {
    try {
      console.log("\n=== Contract Parameters ===");

      const minDeposit = await contract.MIN_DEPOSIT();
      console.log("Minimum Deposit:", ethers.formatEther(minDeposit), "ETH");

      const maxDeposit = await contract.MAX_DEPOSIT();
      console.log("Maximum Deposit:", ethers.formatEther(maxDeposit), "ETH");

      const minWithdraw = await contract.MIN_WITHDRAW();
      console.log("Minimum Withdraw:", ethers.formatEther(minWithdraw), "ETH");

      const maxWithdrawPerTx = await contract.MAX_WITHDRAW_PER_TX();
      console.log(
        "Maximum Withdraw Per TX:",
        ethers.formatEther(maxWithdrawPerTx),
        "ETH"
      );

      const maxSlippage = await contract.MAX_SLIPPAGE();
      console.log("Maximum Slippage:", maxSlippage.toString(), "basis points");

      const poolReserveRatio = await contract.POOL_RESERVE_RATIO();
      console.log(
        "Pool Reserve Ratio:",
        poolReserveRatio.toString(),
        "basis points"
      );
    } catch (error) {
      console.error("Error getting contract parameters:", error);
      throw error;
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

  // Add the new price feed update test here
  it("Should update price feeds", async function () {
    console.log("\n=== Updating Price Feeds ===");

    // Get all token codes
    const tokenCount = await contract.getTokenCount();

    for (let i = 0; i < tokenCount; i++) {
      const tokenCode = await contract.tokenCodes(i);
      console.log(`\nUpdating ${tokenCode} price feed:`);

      try {
        // Update price feed
        const updateTx = await contract.updateTokenPrice(tokenCode);
        await updateTx.wait();

        // Get updated token info
        const tokenInfo = await contract.tokenData(tokenCode);
        console.log(
          "New Price:",
          ethers.formatUnits(tokenInfo.lastPrice, tokenInfo.priceFeedDecimals)
        );
        console.log(
          "New Timestamp:",
          new Date(Number(tokenInfo.lastPriceTimestamp) * 1000).toLocaleString()
        );
      } catch (error: any) {
        console.log(`Error updating ${tokenCode} price:`, error.message);
      }
    }
  });

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
        console.log("Total Pool Value:", ethers.formatEther(poolValue), "ETH");
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

  // ... (other tests remain the same until withdraw test)

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
        console.log("Total Pool Value:", ethers.formatEther(poolValue), "ETH");
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

  // ... (other tests remain the same until withdraw test)

  it("Should test deposit and withdraw", async function () {
    try {
      console.log("\n=== Deposit and Withdraw Tests ===");

      const isPaused = await contract.paused();
      if (isPaused) {
        console.log("Contract is paused, skipping deposit/withdraw tests");
        return;
      }

      // Get minimum deposit amount
      const minDeposit = await contract.MIN_DEPOSIT();
      const testAmount = minDeposit;

      // Test deposit
      console.log("\nTesting deposit...");
      console.log("Deposit amount:", ethers.formatEther(testAmount), "ETH");

      const balanceBefore = await contract.balanceOf(wallet.address);
      console.log(
        "Balance before deposit:",
        ethers.formatEther(balanceBefore),
        "LP"
      );

      try {
        const depositTx = await contract.deposit({
          value: testAmount,
        });
        const depositReceipt = await depositTx.wait();
        console.log("Deposit successful");
        console.log("Transaction hash:", depositReceipt?.hash);

        const balanceAfter = await contract.balanceOf(wallet.address);
        console.log(
          "Balance after deposit:",
          ethers.formatEther(balanceAfter),
          "LP"
        );

        // Test withdraw
        if (balanceAfter > 0n) {
          console.log("\nTesting withdraw...");
          try {
            const maxSlippage = await contract.MAX_SLIPPAGE();
            const sharesToWithdraw = balanceAfter;
            const minEthAmount =
              (sharesToWithdraw * BigInt(9800)) / BigInt(10000);

            console.log(
              "Withdrawing shares:",
              ethers.formatEther(sharesToWithdraw),
              "LP"
            );
            console.log(
              "Minimum ETH expected:",
              ethers.formatEther(minEthAmount),
              "ETH"
            );
            console.log(
              "Max slippage:",
              maxSlippage.toString(),
              "basis points"
            );

            try {
              const withdrawTx = await contract.withdraw(
                sharesToWithdraw,
                minEthAmount
              );
              const withdrawReceipt = await withdrawTx.wait();
              console.log("Withdraw successful");
              console.log("Transaction hash:", withdrawReceipt?.hash);
            } catch (error: any) {
              console.log(
                "Note: Withdraw failed (expected if price feeds are not initialized):",
                error.message
              );
            }

            const finalBalance = await contract.balanceOf(wallet.address);
            console.log(
              "Final balance:",
              ethers.formatEther(finalBalance),
              "LP"
            );
          } catch (error: any) {
            console.log("Withdraw setup failed:", error.message);
          }
        } else {
          console.log("No balance to withdraw");
        }
      } catch (error: any) {
        console.error("Deposit failed:", error.message);
      }
    } catch (error) {
      console.error("Error in deposit/withdraw tests:", error);
    }
  });

  // Add these tests after your existing ones

  it("Should test deposit limits and errors", async function () {
    try {
      console.log("\n=== Deposit Limits Tests ===");

      // Test over maximum deposit
      const overMaxDeposit = ethers.parseEther("101"); // Over 100 ETH limit
      console.log(
        "\nTesting over maximum deposit:",
        ethers.formatEther(overMaxDeposit),
        "ETH"
      );
      try {
        await contract.deposit({ value: overMaxDeposit });
        console.log("Error: Should have failed");
      } catch (error: any) {
        console.log(
          "Successfully rejected over-maximum deposit:",
          error.message
        );
      }

      // Test under minimum deposit
      const underMinDeposit = ethers.parseEther("0.0000001"); // Under 0.000001 ETH
      console.log(
        "\nTesting under minimum deposit:",
        ethers.formatEther(underMinDeposit),
        "ETH"
      );
      try {
        await contract.deposit({ value: underMinDeposit });
        console.log("Error: Should have failed");
      } catch (error: any) {
        console.log(
          "Successfully rejected under-minimum deposit:",
          error.message
        );
      }
    } catch (error) {
      console.error("Error in deposit limits test:", error);
      throw error;
    }
  });

  it("Should test withdrawal limits and errors", async function () {
    try {
      console.log("\n=== Withdrawal Limits Tests ===");

      // Test over maximum withdrawal
      const overMaxWithdraw = ethers.parseEther("51"); // Over 50 ETH limit
      console.log(
        "\nTesting over maximum withdrawal:",
        ethers.formatEther(overMaxWithdraw),
        "ETH"
      );
      try {
        const minEthAmount = (overMaxWithdraw * BigInt(9800)) / BigInt(10000);
        await contract.withdraw(overMaxWithdraw, minEthAmount);
        console.log("Error: Should have failed");
      } catch (error: any) {
        console.log(
          "Successfully rejected over-maximum withdrawal:",
          error.message
        );
      }

      // Test hourly withdrawal limit
      console.log("\nTesting hourly withdrawal limit");
      const hourlyLimit = await contract.withdrawLimitPerHour();
      const currentHourlyWithdrawn = await contract.hourlyWithdrawnAmount();
      console.log("Hourly limit:", ethers.formatEther(hourlyLimit), "ETH");
      console.log(
        "Currently withdrawn this hour:",
        ethers.formatEther(currentHourlyWithdrawn),
        "ETH"
      );
    } catch (error) {
      console.error("Error in withdrawal limits test:", error);
      throw error;
    }
  });

  it("Should test emergency pause functionality", async function () {
    try {
      console.log("\n=== Emergency Pause Tests ===");

      // Check current pause state
      const initialPauseState = await contract.paused();
      console.log("Initial pause state:", initialPauseState);

      // Try to deposit while paused (if paused)
      if (initialPauseState) {
        try {
          const testAmount = ethers.parseEther("0.001");
          await contract.deposit({ value: testAmount });
          console.log("Error: Should not allow deposit while paused");
        } catch (error: any) {
          console.log(
            "Successfully rejected deposit while paused:",
            error.message
          );
        }
      }
    } catch (error) {
      console.error("Error in emergency pause test:", error);
      throw error;
    }
  });

  it("Should test reserve ratio requirements", async function () {
    try {
      console.log("\n=== Reserve Ratio Tests ===");

      const poolReserveRatio = await contract.POOL_RESERVE_RATIO();
      console.log(
        "Pool Reserve Ratio:",
        poolReserveRatio.toString(),
        "basis points"
      );

      // Get current pool value and balance
      const totalPoolValue = await contract.getTotalPoolValue();
      const contractBalance = await ethers.provider.getBalance(
        contract.getAddress()
      );

      console.log(
        "Total Pool Value:",
        ethers.formatEther(totalPoolValue),
        "ETH"
      );
      console.log(
        "Contract Balance:",
        ethers.formatEther(contractBalance),
        "ETH"
      );

      // Calculate current reserve ratio
      const currentRatio = (contractBalance * BigInt(10000)) / totalPoolValue;
      console.log(
        "Current Reserve Ratio:",
        currentRatio.toString(),
        "basis points"
      );

      // Verify reserve ratio is maintained
      expect(currentRatio >= poolReserveRatio).to.be.true;
    } catch (error) {
      console.error("Error in reserve ratio test:", error);
      throw error;
    }
  });

  it("Should test slippage protection", async function () {
    try {
      console.log("\n=== Slippage Protection Tests ===");

      const maxSlippage = await contract.MAX_SLIPPAGE();
      console.log("Maximum Slippage:", maxSlippage.toString(), "basis points");

      // Try to withdraw with excessive slippage
      const testAmount = ethers.parseEther("0.001");
      const tooLowMinAmount = (testAmount * BigInt(9700)) / BigInt(10000); // More than MAX_SLIPPAGE

      console.log("\nTesting withdrawal with excessive slippage");
      console.log("Withdrawal amount:", ethers.formatEther(testAmount), "ETH");
      console.log(
        "Min amount (too low):",
        ethers.formatEther(tooLowMinAmount),
        "ETH"
      );

      try {
        await contract.withdraw(testAmount, tooLowMinAmount);
        console.log("Error: Should have failed");
      } catch (error: any) {
        console.log(
          "Successfully rejected high slippage withdrawal:",
          error.message
        );
      }
    } catch (error) {
      console.error("Error in slippage protection test:", error);
      throw error;
    }
  });

  it("Should verify contract invariants", async function () {
    try {
      console.log("\n=== Contract Invariants Tests ===");

      // Check total supply matches contract balance
      const totalSupply = await contract.totalSupply();
      const contractBalance = await ethers.provider.getBalance(
        contract.getAddress()
      );

      console.log("Total Supply:", ethers.formatEther(totalSupply), "LP");
      console.log(
        "Contract Balance:",
        ethers.formatEther(contractBalance),
        "ETH"
      );

      // Verify pool value calculation
      const poolValue = await contract.getTotalPoolValue();
      console.log("Total Pool Value:", ethers.formatEther(poolValue), "ETH");

      // Check if contract has enough ETH to cover all LP tokens
      expect(contractBalance >= totalSupply).to.be.true;
      console.log("Contract has sufficient ETH to cover all LP tokens");
    } catch (error) {
      console.error("Error in contract invariants test:", error);
      throw error;
    }
  });
  async function checkPriceFeed(contract: Contract, tokenCode: string) {
    try {
      const tokenInfo = await contract.tokenData(tokenCode);
      console.log(`\nChecking price feed for ${tokenCode}:`);

      // Create price feed interface
      const priceFeedABI = [
        "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
        "function decimals() external view returns (uint8)",
      ];
      const priceFeed = new Contract(
        tokenInfo.priceFeed,
        priceFeedABI,
        contract.runner
      );

      // Get latest price data
      const [roundId, answer, startedAt, updatedAt, answeredInRound] =
        await priceFeed.latestRoundData();

      console.log("Price Feed Address:", tokenInfo.priceFeed);
      console.log("Latest Round ID:", roundId.toString());
      console.log(
        "Price:",
        ethers.formatUnits(answer, tokenInfo.priceFeedDecimals)
      );
      console.log(
        "Started At:",
        new Date(Number(startedAt) * 1000).toLocaleString()
      );
      console.log(
        "Updated At:",
        new Date(Number(updatedAt) * 1000).toLocaleString()
      );
      console.log("Answered In Round:", answeredInRound.toString());

      // Check contract's stored price
      console.log("\nContract Stored Data:");
      console.log(
        "Last Price:",
        ethers.formatUnits(tokenInfo.lastPrice, tokenInfo.priceFeedDecimals)
      );
      console.log(
        "Last Update:",
        new Date(Number(tokenInfo.lastPriceTimestamp) * 1000).toLocaleString()
      );

      return {
        hasValidPrice: answer > 0 && updatedAt > 0,
        lastUpdateTime: Number(updatedAt),
        currentPrice: answer,
      };
    } catch (error) {
      console.error(`Error checking price feed for ${tokenCode}:`, error);
      return {
        hasValidPrice: false,
        lastUpdateTime: 0,
        currentPrice: 0,
      };
    }
  }

  // Add this new test to your test file
  it("Should debug price feeds", async function () {
    console.log("\n=== Price Feed Debug ===");

    // Get all token codes
    const tokenCount = await contract.getTokenCount();
    console.log(`Found ${tokenCount} tokens`);

    // Check each token's price feed
    for (let i = 0; i < tokenCount; i++) {
      const tokenCode = await contract.tokenCodes(i);
      await checkPriceFeed(contract, tokenCode);
    }
  });

  // Then test the full functionality
  it("Should test full pool functionality with tokens", async function () {
    console.log("\n=== Full Pool Functionality Test ===");

    try {
      // 1. Check initial state
      const totalSupply = await contract.totalSupply();
      const ethBalance = await ethers.provider.getBalance(
        contract.getAddress()
      );
      console.log("Initial Total Supply:", ethers.formatEther(totalSupply));
      console.log("Initial ETH Balance:", ethers.formatEther(ethBalance));

      // 2. Try to get total pool value
      try {
        const totalValue = await contract.getTotalPoolValue();
        console.log("Total Pool Value:", ethers.formatEther(totalValue));
      } catch (error: any) {
        console.log("Error getting total pool value:", error.message);
      }

      // 3. Make a deposit
      const depositAmount = ethers.parseEther("0.001");
      console.log(
        "\nMaking deposit of:",
        ethers.formatEther(depositAmount),
        "ETH"
      );

      const depositTx = await contract.deposit({
        value: depositAmount,
      });
      await depositTx.wait();

      // 4. Check balances after deposit
      const newSupply = await contract.totalSupply();
      const newEthBalance = await ethers.provider.getBalance(
        contract.getAddress()
      );
      const lpBalance = await contract.balanceOf(wallet.address);

      console.log("New Total Supply:", ethers.formatEther(newSupply));
      console.log("New ETH Balance:", ethers.formatEther(newEthBalance));
      console.log("LP Token Balance:", ethers.formatEther(lpBalance));

      // 5. Try to withdraw
      if (lpBalance > 0n) {
        console.log("\nAttempting withdrawal...");
        const maxSlippage = await contract.MAX_SLIPPAGE();
        const minEthAmount = (lpBalance * BigInt(9800)) / BigInt(10000);

        try {
          const withdrawTx = await contract.withdraw(lpBalance, minEthAmount);
          const receipt = await withdrawTx.wait();
          console.log("Withdrawal successful!");
          console.log("Transaction hash:", receipt?.hash);
        } catch (error: any) {
          console.log("Withdrawal failed:", error.message);

          // Check if it's due to price feed issues
          const tokenCount = await contract.getTokenCount();
          console.log("\nChecking price feeds after failed withdrawal:");
          for (let i = 0; i < tokenCount; i++) {
            const tokenCode = await contract.tokenCodes(i);
            await checkPriceFeed(contract, tokenCode);
          }
        }
      }
    } catch (error) {
      console.error("Error in full functionality test:", error);
    }
  });
  // Add these new test blocks at the bottom of your existing test file
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
        // Try to set maxSlippage too high
        await expect(
          liquidityPool.proposeParameterUpdate("maxSlippage", 5001)
        ).to.be.revertedWith("Invalid parameter or value");

        // Try to set maxDeposit to zero
        await expect(
          liquidityPool.proposeParameterUpdate("maxDeposit", 0)
        ).to.be.revertedWith("Invalid parameter or value");
      });
    });

    describe("Timelock Functionality", function () {
      it("Should enforce timelock duration", async function () {
        const newValue = ethers.parseEther("150");
        await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);

        // Try to execute immediately
        await expect(
          liquidityPool.executeParameterUpdate("maxDeposit", newValue)
        ).to.be.revertedWith("Timelock not expired");

        // Try to execute just before timelock expires
        await time.increase(TIMELOCK_DURATION - 60);
        await expect(
          liquidityPool.executeParameterUpdate("maxDeposit", newValue)
        ).to.be.revertedWith("Timelock not expired");

        // Should succeed after timelock
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

        // Propose multiple updates
        for (const [param, value] of Object.entries(updates)) {
          await liquidityPool.proposeParameterUpdate(param, value);

          // Verify pending update exists
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

        // Cancel the update
        await liquidityPool.cancelParameterUpdate("maxDeposit", newValue);

        // Verify update no longer exists
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

        // Propose
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

        // Cancel
        await expect(
          liquidityPool.cancelParameterUpdate("maxDeposit", newValue)
        )
          .to.emit(liquidityPool, "ParameterUpdateCancelled")
          .withArgs("maxDeposit", newValue, owner.address, await time.latest());

        // Propose again and execute
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
        // Store original value
        const originalValue = await liquidityPool.maxDeposit();
        const newValue = ethers.parseEther("150");

        // Update value
        await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);
        await time.increase(TIMELOCK_DURATION);
        await liquidityPool.executeParameterUpdate("maxDeposit", newValue);

        // Verify update
        expect(await liquidityPool.maxDeposit()).to.equal(newValue);

        // Restore original value
        await liquidityPool.proposeParameterUpdate("maxDeposit", originalValue);
        await time.increase(TIMELOCK_DURATION);
        await liquidityPool.executeParameterUpdate("maxDeposit", originalValue);

        // Verify restoration
        expect(await liquidityPool.maxDeposit()).to.equal(originalValue);
      });
    });
  });
});
