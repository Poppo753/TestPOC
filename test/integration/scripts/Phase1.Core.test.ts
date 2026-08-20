import { expect } from "chai";
import { ethers } from "hardhat";
import { deployScriptTestFixture, ScriptAssertions, ScriptTestHelpers } from "./fixtures";
import { DepositETHScript } from "../../../scripts/core/deposit/DepositETH";
import { WithdrawETHScript } from "../../../scripts/core/withdraw/WithdrawETH";
import { SystemStatusScript } from "../../../scripts/core/monitoring/SystemStatus";
import { CheckBalanceScript } from "../../../scripts/core/monitoring/CheckBalance";

describe("Integration: Phase 1 - current core operation scripts", function () {
  this.timeout(120000);
  let fixture: any;
  let snapshotId: string;
  const scriptOptions = { skipValidation: true, confirmations: 1, verbose: false };

  async function depositFor(signer: any, amount: bigint) {
    await fixture.mockWETH.connect(signer).deposit({ value: amount });
    await fixture.mockWETH.connect(signer).approve(await fixture.liquidityManager.getAddress(), amount);
    return fixture.liquidityManager.connect(signer).deposit(amount);
  }

  before(async function () {
    fixture = await deployScriptTestFixture();
  });

  beforeEach(async function () {
    snapshotId = await ScriptTestHelpers.snapshot();
  });

  afterEach(async function () {
    await ScriptTestHelpers.restore(snapshotId);
  });

  describe("DepositETH", function () {
    it("executes a successful WETH-backed deposit", async function () {
      const before = await fixture.proxyGeneral.balanceOf(fixture.owner.address);
      const result = await new DepositETHScript({ ...scriptOptions, amount: "1" }).execute();
      ScriptAssertions.validateScriptResult(result);
      expect(result.success).to.equal(true);
      expect(result.transactionHash).to.match(/^0x[0-9a-f]{64}$/i);
      expect(BigInt(result.data!.lpReceived)).to.be.gt(0n);
      expect(await fixture.proxyGeneral.balanceOf(fixture.owner.address)).to.be.gt(before);
    });

    it("reports insufficient balance without mutating the pool", async function () {
      const supplyBefore = await fixture.proxyGeneral.totalSupply();
      const result = await new DepositETHScript({ ...scriptOptions, amount: "100000" }).execute();
      expect(result.success).to.equal(false);
      expect(result.error).to.include("Insufficient balance");
      expect(await fixture.proxyGeneral.totalSupply()).to.equal(supplyBefore);
    });
  });

  describe("WithdrawETH", function () {
    it("executes a successful partial withdrawal", async function () {
      const before = await fixture.proxyGeneral.balanceOf(fixture.owner.address);
      const amount = before / 2n;
      const result = await new WithdrawETHScript({
        ...scriptOptions, amount: ethers.formatEther(amount)
      }).execute();
      expect(result.success).to.equal(true);
      expect(await fixture.proxyGeneral.balanceOf(fixture.owner.address)).to.equal(before - amount);
      expect(BigInt(result.data!.lpTokensBurned)).to.equal(amount);
    });

    it("rejects an amount above the caller LP balance", async function () {
      const result = await new WithdrawETHScript({ ...scriptOptions, amount: "10000" }).execute();
      expect(result.success).to.equal(false);
      expect(result.error).to.include("Insufficient LP balance");
    });
  });

  describe("SystemStatus", function () {
    it("returns the complete current system status", async function () {
      const result = await new SystemStatusScript(scriptOptions).execute();
      expect(result.success).to.equal(true);
      expect(result.data.liquidityPool.totalValue).to.be.a("string");
      expect(result.data.emergencyStatus.isPaused).to.be.a("boolean");
      expect(result.data.operationalStatus.depositsEnabled).to.equal(true);
      expect(result.data.operationalStatus.withdrawsEnabled).to.equal(true);
    });

    it("resolves every registered core module", async function () {
      const result = await new SystemStatusScript(scriptOptions).execute();
      expect(result.success).to.equal(true);
      expect(result.data.beacon.registeredModules.length).to.be.gte(7);
      for (const address of Object.values(result.data.beacon.moduleAddresses)) {
        expect(address).to.match(/^0x[0-9a-fA-F]{40}$/);
      }
    });
  });

  describe("CheckBalance", function () {
    it("reports a funded user's exact LP balance", async function () {
      const result = await new CheckBalanceScript({
        ...scriptOptions, userAddress: fixture.owner.address
      }).execute();
      expect(result.success).to.equal(true);
      const actual = await fixture.proxyGeneral.balanceOf(fixture.owner.address);
      expect(result.data.user.lpTokens.balance.wei).to.equal(actual.toString());
    });

    it("reports zero LP for a new address", async function () {
      const address = ethers.Wallet.createRandom().address;
      const result = await new CheckBalanceScript({ ...scriptOptions, userAddress: address }).execute();
      expect(result.success).to.equal(true);
      expect(result.data.user.lpTokens.balance.wei).to.equal("0");
    });
  });

  describe("cross-script consistency", function () {
    it("keeps deposit, balance check and withdraw accounting consistent", async function () {
      const deposit = await new DepositETHScript({ ...scriptOptions, amount: "1" }).execute();
      expect(deposit.success).to.equal(true);
      const afterDeposit = await fixture.proxyGeneral.balanceOf(fixture.owner.address);
      const checked = await new CheckBalanceScript({
        ...scriptOptions, userAddress: fixture.owner.address
      }).execute();
      expect(checked.data.user.lpTokens.balance.wei).to.equal(afterDeposit.toString());
      const withdrawn = await new WithdrawETHScript({
        ...scriptOptions, amount: ethers.formatEther(afterDeposit / 4n)
      }).execute();
      expect(withdrawn.success).to.equal(true);
    });

    it("reflects direct deposits in subsequent system status", async function () {
      const before = await new SystemStatusScript(scriptOptions).execute();
      await depositFor(fixture.user3, ethers.parseEther("2"));
      const after = await new SystemStatusScript(scriptOptions).execute();
      expect(BigInt(after.data.liquidityPool.totalValue)).to.be.gt(
        BigInt(before.data.liquidityPool.totalValue)
      );
    });
  });

  describe("error handling", function () {
    it("returns structured failures for invalid small deposits", async function () {
      const result = await new DepositETHScript({ ...scriptOptions, amount: "0.001" }).execute();
      expect(result.success).to.equal(false);
      expect(result.error).to.include("Deposit too small");
    });

    it("validates required withdrawal parameters at construction", async function () {
      expect(() => new WithdrawETHScript(scriptOptions)).to.throw(
        "Must specify either 'amount' or 'percentage'"
      );
    });

    it("preserves the contract revert reason when withdrawals are disabled", async function () {
      await fixture.liquidityManager.setWithdrawsEnabled(false);
      const result = await new WithdrawETHScript({ ...scriptOptions, amount: "1" }).execute();
      expect(result.success).to.equal(false);
      expect(result.error).to.include("Withdrawals are disabled");
    });
  });

  describe("performance", function () {
    it("collects system status in under five seconds", async function () {
      const start = Date.now();
      const result = await new SystemStatusScript(scriptOptions).execute();
      expect(result.success).to.equal(true);
      expect(Date.now() - start).to.be.lt(5000);
    });

    it("handles concurrent balance checks deterministically", async function () {
      const users = [fixture.owner, fixture.user1, fixture.user2];
      const results = await Promise.all(users.map((user: any) =>
        new CheckBalanceScript({ ...scriptOptions, userAddress: user.address }).execute()
      ));
      expect(results.every((result: any) => result.success)).to.equal(true);
    });
  });
});
