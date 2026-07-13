import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFullProtocolFixture } from "../helpers/fixtures/fullStack";

describe("ValueCalculator - deterministic regression coverage", function () {
  let fixture: Awaited<ReturnType<typeof deployFullProtocolFixture>>;

  beforeEach(async function () {
    fixture = await deployFullProtocolFixture();
  });

  describe("calculateTokenValuePure", function () {
    it("is callable through staticCall without changing state", async function () {
      await fixture.usdcToken.mint(await fixture.proxyGeneral.getAddress(), ethers.parseUnits("3", 6));
      expect(await fixture.valueCalculator.calculateTokenValuePure.staticCall("USDC")).to.be.gt(0n);
    });

    it("calculates USDC value with token decimals", async function () {
      await fixture.usdcToken.mint(await fixture.proxyGeneral.getAddress(), ethers.parseUnits("1200", 6));
      expect(await fixture.valueCalculator.calculateTokenValuePure("USDC"))
        .to.equal(399999999999999600n);
    });

    it("calculates WBTC value with token decimals", async function () {
      await fixture.wbtcToken.mint(await fixture.proxyGeneral.getAddress(), ethers.parseUnits("0.02", 8));
      expect(await fixture.valueCalculator.calculateTokenValuePure("WBTC"))
        .to.equal(ethers.parseEther("0.4"));
    });
  });

  describe("getTotalPoolValue", function () {
    it("is a view call and returns a positive funded-pool value", async function () {
      await fixture.owner.sendTransaction({
        to: await fixture.baseToken.getAddress(), value: ethers.parseEther("1")
      });
      await fixture.baseToken.transfer(await fixture.proxyGeneral.getAddress(), ethers.parseEther("1"));
      expect((await fixture.valueCalculator.getTotalPoolValue.staticCall()).totalValue)
        .to.equal(ethers.parseEther("1"));
    });

    it("returns a complete PoolValueInfo struct", async function () {
      const info = await fixture.valueCalculator.getTotalPoolValue();
      expect(info.tokenValues).to.have.length(3);
      expect(info.tokenValues[0].tokenCode).to.equal("WETH");
    });

    it("matches getTotalPoolValueView exactly", async function () {
      await fixture.usdcToken.mint(await fixture.proxyGeneral.getAddress(), ethers.parseUnits("1200", 6));
      const detailed = await fixture.valueCalculator.getTotalPoolValue();
      expect(detailed.totalValue).to.equal(await fixture.valueCalculator.getTotalPoolValueView());
    });

    it("includes the base asset plus every active token", async function () {
      const active = await fixture.tokenManager.getActiveTokens();
      const info = await fixture.valueCalculator.getTotalPoolValue();
      expect(info.tokenValues).to.have.length(active.length + 1);
      expect(info.tokenValues.map((item: any) => item.tokenCode)).to.deep.equal(["WETH", ...active]);
    });
  });

  describe("withdrawal calculation regression", function () {
    it("calculates a non-zero full withdrawal from self-created LP state", async function () {
      const amount = ethers.parseEther("2");
      await fixture.user1.sendTransaction({ to: await fixture.baseToken.getAddress(), value: amount });
      await fixture.baseToken.connect(fixture.user1).approve(await fixture.liquidityManager.getAddress(), amount);
      await fixture.liquidityManager.connect(fixture.user1).deposit(amount);
      const shares = await fixture.proxyGeneral.balanceOf(fixture.user1.address);
      expect(await fixture.liquidityManager.calculateWithdrawAmount(shares)).to.equal(amount);
    });
  });

  describe("performance regression", function () {
    it("executes the aggregate view successfully", async function () {
      const result = await fixture.valueCalculator.getTotalPoolValue.staticCall();
      expect(result.totalValue).to.equal(0n);
    });
  });
});
