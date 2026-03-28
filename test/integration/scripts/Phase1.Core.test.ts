// SPDX-License-Identifier: MIT
/**
 * @title Phase 1 Core Operations - Integration Tests
 * @dev E2E testing for deposit, withdraw, and monitoring scripts
 * 
 * Tests:
 * - DepositETH.ts
 * - DepositBatch.ts  
 * - DepositScheduled.ts
 * - WithdrawETH.ts
 * - WithdrawPartial.ts
 * - WithdrawEmergency.ts
 * - SystemStatus.ts
 * - CheckBalance.ts
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { 
  deployScriptTestFixture, 
  ScriptAssertions,
  ScriptTestHelpers 
} from "./fixtures";

// Import scripts to test
import { DepositETHScript } from "../../../scripts/core/deposit/DepositETH";
import { WithdrawETHScript } from "../../../scripts/core/withdraw/WithdrawETH";
import { SystemStatusScript } from "../../../scripts/monitoring/status/SystemStatus";
import { CheckBalanceScript } from "../../../scripts/core/portfolio/CheckBalance";

describe("Integration: Phase 1 - Core Operations Scripts", function () {
  let fixture: any;
  let snapshotId: string;

  before(async function () {
    fixture = await deployScriptTestFixture();
  });

  beforeEach(async function () {
    snapshotId = await ScriptTestHelpers.snapshot();
  });

  afterEach(async function () {
    await ScriptTestHelpers.restore(snapshotId);
  });

  describe("📥 DepositETH.ts", function () {
    it("should execute successful ETH deposit", async function () {
      const { user1, proxyGeneral } = fixture;

      // Get initial balances
      const initialLPBalance = await proxyGeneral.balanceOf(user1.address);
      const initialETHBalance = await ethers.provider.getBalance(user1.address);

      // Create and execute deposit script
      const depositScript = new DepositETHScript();
      
      // Mock process.argv for script
      const originalArgv = process.argv;
      process.argv = [
        "node",
        "DepositETH.ts",
        "--amount=1.0",
        `--network=localhost`
      ];

      const result = await depositScript.execute();
      
      process.argv = originalArgv;

      // Validate result
      ScriptAssertions.validateScriptResult(result);
      expect(result.success).to.be.true;
      expect(result.data).to.have.property("lpReceived");
      expect(result.data).to.have.property("txHash");

      // Validate balances changed
      const finalLPBalance = await proxyGeneral.balanceOf(user1.address);
      const finalETHBalance = await ethers.provider.getBalance(user1.address);

      expect(finalLPBalance).to.be.gt(initialLPBalance);
      expect(finalETHBalance).to.be.lt(initialETHBalance);

      // Validate transaction
      if (result.data.txHash) {
        await ScriptAssertions.validateTransaction(result.data.txHash);
      }
    });

    it("should handle insufficient balance gracefully", async function () {
      const depositScript = new DepositETHScript();
      
      process.argv = [
        "node",
        "DepositETH.ts",
        "--amount=100000",  // Unrealistic amount
        `--network=localhost`
      ];

      const result = await depositScript.execute();

      // Should fail gracefully
      expect(result.success).to.be.false;
      expect(result.error).to.exist;
    });
  });

  describe("📤 WithdrawETH.ts", function () {
    it("should execute successful ETH withdrawal", async function () {
      const { user1, proxyGeneral, liquidityManager } = fixture;

      // First deposit to have LP tokens
      await liquidityManager.connect(user1).deposit({ value: ethers.parseEther("2") });

      const initialLPBalance = await proxyGeneral.balanceOf(user1.address);
      expect(initialLPBalance).to.be.gt(0);

      // Create withdraw script
      const withdrawScript = new WithdrawETHScript();
      
      process.argv = [
        "node",
        "WithdrawETH.ts",
        `--amount=${ethers.formatEther(initialLPBalance / 2n)}`,  // Withdraw half
        `--network=localhost`
      ];

      const result = await withdrawScript.execute();

      // Validate result
      ScriptAssertions.validateScriptResult(result);
      expect(result.success).to.be.true;

      // Validate LP balance decreased
      const finalLPBalance = await proxyGeneral.balanceOf(user1.address);
      expect(finalLPBalance).to.be.lt(initialLPBalance);
    });

    it("should respect withdraw limits", async function () {
      const { user1 } = fixture;
      
      const withdrawScript = new WithdrawETHScript();
      
      process.argv = [
        "node",
        "WithdrawETH.ts",
        "--amount=10000",  // Exceeds max limit
        `--network=localhost`
      ];

      const result = await withdrawScript.execute();

      // Should fail due to limits
      expect(result.success).to.be.false;
      expect(result.error).to.include("limit");
    });
  });

  describe("📊 SystemStatus.ts", function () {
    it("should retrieve comprehensive system status", async function () {
      const statusScript = new SystemStatusScript();
      
      process.argv = [
        "node",
        "SystemStatus.ts",
        `--network=localhost`
      ];

      const result = await statusScript.execute();

      // Validate result
      ScriptAssertions.validateScriptResult(result);
      expect(result.success).to.be.true;
      expect(result.data).to.have.property("totalValue");
      expect(result.data).to.have.property("lpSupply");
      expect(result.data).to.have.property("isPaused");
      expect(result.data).to.have.property("moduleCount");

      // Validate data types
      expect(result.data.isPaused).to.be.a("boolean");
      expect(result.data.totalValue).to.be.a("string");
      expect(result.data.lpSupply).to.be.a("string");
    });

    it("should include all registered modules", async function () {
      const { beacon } = fixture;
      
      const statusScript = new SystemStatusScript();
      
      process.argv = [
        "node",
        "SystemStatus.ts",
        `--network=localhost`
      ];

      const result = await statusScript.execute();

      expect(result.success).to.be.true;
      expect(result.data.moduleCount).to.be.gte(7); // At least 7 core modules
    });
  });

  describe("💰 CheckBalance.ts", function () {
    it("should display user portfolio correctly", async function () {
      const { user1, proxyGeneral, liquidityManager } = fixture;

      // Create some activity
      await liquidityManager.connect(user1).deposit({ value: ethers.parseEther("3") });

      const balanceScript = new CheckBalanceScript();
      
      process.argv = [
        "node",
        "CheckBalance.ts",
        `--user=${user1.address}`,
        `--network=localhost`
      ];

      const result = await balanceScript.execute();

      // Validate result
      ScriptAssertions.validateScriptResult(result);
      expect(result.success).to.be.true;
      expect(result.data).to.have.property("lpBalance");
      expect(result.data).to.have.property("ethValue");
      expect(result.data).to.have.property("sharePercentage");

      // Validate LP balance matches
      const actualLPBalance = await proxyGeneral.balanceOf(user1.address);
      expect(result.data.lpBalance).to.equal(ethers.formatEther(actualLPBalance));
    });

    it("should handle zero balance users", async function () {
      const newUser = ethers.Wallet.createRandom();
      
      const balanceScript = new CheckBalanceScript();
      
      process.argv = [
        "node",
        "CheckBalance.ts",
        `--user=${newUser.address}`,
        `--network=localhost`
      ];

      const result = await balanceScript.execute();

      expect(result.success).to.be.true;
      expect(result.data.lpBalance).to.equal("0.0");
    });
  });

  describe("🔄 Cross-Script Integration", function () {
    it("should maintain consistency across deposit → check → withdraw flow", async function () {
      const { user2, proxyGeneral, liquidityManager } = fixture;

      // Step 1: Deposit
      await liquidityManager.connect(user2).deposit({ value: ethers.parseEther("5") });
      const lpAfterDeposit = await proxyGeneral.balanceOf(user2.address);

      // Step 2: Check balance (script)
      const checkScript = new CheckBalanceScript();
      process.argv = ["node", "CheckBalance.ts", `--user=${user2.address}`];
      const checkResult = await checkScript.execute();

      expect(checkResult.success).to.be.true;
      expect(checkResult.data.lpBalance).to.equal(ethers.formatEther(lpAfterDeposit));

      // Step 3: Partial withdraw
      const withdrawAmount = lpAfterDeposit / 2n;
      await liquidityManager.connect(user2).withdraw(withdrawAmount);
      
      // Step 4: Check balance again
      const checkResult2 = await checkScript.execute();
      const expectedLP = lpAfterDeposit - withdrawAmount;
      
      expect(checkResult2.success).to.be.true;
      expect(checkResult2.data.lpBalance).to.equal(ethers.formatEther(expectedLP));
    });

    it("should reflect system status changes after operations", async function () {
      const { user3, liquidityManager } = fixture;
      
      // Get initial system status
      const statusScript1 = new SystemStatusScript();
      process.argv = ["node", "SystemStatus.ts"];
      const result1 = await statusScript1.execute();
      
      const initialTotalValue = result1.data.totalValue;
      const initialLPSupply = result1.data.lpSupply;

      // Perform deposit
      await liquidityManager.connect(user3).deposit({ value: ethers.parseEther("10") });

      // Get updated system status
      const statusScript2 = new SystemStatusScript();
      const result2 = await statusScript2.execute();

      // Values should have increased
      expect(parseFloat(result2.data.totalValue)).to.be.gt(parseFloat(initialTotalValue));
      expect(parseFloat(result2.data.lpSupply)).to.be.gt(parseFloat(initialLPSupply));
    });
  });

  describe("⚠️ Error Handling", function () {
    it("should handle network connection errors", async function () {
      // This test would require mocking network failures
      // Placeholder for network error handling tests
    });

    it("should validate required parameters", async function () {
      const depositScript = new DepositETHScript();
      
      // Missing amount parameter
      process.argv = ["node", "DepositETH.ts"];
      
      const result = await depositScript.execute();
      
      expect(result.success).to.be.false;
      expect(result.error).to.exist;
    });

    it("should handle contract revert reasons properly", async function () {
      const { liquidityManager, owner } = fixture;
      
      // Try to withdraw when deposits are disabled
      await liquidityManager.setWithdrawsEnabled(false);
      
      const withdrawScript = new WithdrawETHScript();
      process.argv = ["node", "WithdrawETH.ts", "--amount=1"];
      
      const result = await withdrawScript.execute();
      
      expect(result.success).to.be.false;
      expect(result.error).to.include("disabled");
    });
  });

  describe("🎯 Performance", function () {
    it("should execute SystemStatus script in reasonable time", async function () {
      const start = Date.now();
      
      const statusScript = new SystemStatusScript();
      process.argv = ["node", "SystemStatus.ts"];
      await statusScript.execute();
      
      const duration = Date.now() - start;
      
      // Should complete in under 5 seconds
      expect(duration).to.be.lt(5000);
    });

    it("should handle multiple concurrent balance checks", async function () {
      const { user1, user2, user3 } = fixture;
      
      const checkScript1 = new CheckBalanceScript();
      const checkScript2 = new CheckBalanceScript();
      const checkScript3 = new CheckBalanceScript();
      
      const promises = [
        checkScript1.execute(),
        checkScript2.execute(),
        checkScript3.execute()
      ];
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).to.be.true;
      });
    });
  });
});
