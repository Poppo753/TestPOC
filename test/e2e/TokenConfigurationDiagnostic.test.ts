import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFullProtocolFixture } from "../helpers/fixtures/fullStack";

describe("E2E: deterministic token configuration diagnostics", function () {
  this.timeout(180_000);

  it("validates the complete USDC registration and live oracle path", async function () {
    const { tokenManager, usdcToken } = await deployFullProtocolFixture();
    const info = await tokenManager.getTokenInfo("USDC");
    const [price, timestamp, isStale] = await tokenManager.getTokenPrice("USDC");

    expect(info.tokenAddress).to.equal(await usdcToken.getAddress());
    expect(info.tokenDecimals).to.equal(6n);
    expect(info.isActive).to.equal(true);
    expect(price).to.equal(333333333333333n);
    expect(timestamp).to.be.gt(0n);
    expect(isStale).to.equal(false);
  });

  it("validates the complete WBTC registration and live oracle path", async function () {
    const { tokenManager, wbtcToken } = await deployFullProtocolFixture();
    const info = await tokenManager.getTokenInfo("WBTC");
    const [price, timestamp, isStale] = await tokenManager.getTokenPrice("WBTC");

    expect(info.tokenAddress).to.equal(await wbtcToken.getAddress());
    expect(info.tokenDecimals).to.equal(8n);
    expect(info.isActive).to.equal(true);
    expect(price).to.equal(ethers.parseEther("20"));
    expect(timestamp).to.be.gt(0n);
    expect(isStale).to.equal(false);
  });

  it("values configured USDC and WBTC custody balances in the base asset", async function () {
    const { proxyGeneral, valueCalculator, usdcToken, wbtcToken } =
      await deployFullProtocolFixture();
    const custody = await proxyGeneral.getAddress();
    await usdcToken.mint(custody, ethers.parseUnits("1200", 6));
    await wbtcToken.mint(custody, ethers.parseUnits("0.02", 8));

    const usdcValue = await valueCalculator.calculateTokenValueView("USDC");
    const wbtcValue = await valueCalculator.calculateTokenValueView("WBTC");

    expect(usdcValue).to.equal(399999999999999600n);
    expect(wbtcValue).to.equal(ethers.parseEther("0.4"));
    expect(await valueCalculator.getTotalPoolValueView()).to.equal(799999999999999600n);
  });
});
