import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFullProtocolFixture } from "../helpers/fixtures/fullStack";

describe("E2E: complete deterministic pool lifecycle", function () {
  it("calculates a complete multi-asset pool value breakdown from configured prices", async function () {
    const { baseToken, usdcToken, wbtcToken, tokenManager, liquidityManager, proxyGeneral, user1 } =
      await deployFullProtocolFixture();
    const custody = await proxyGeneral.getAddress();
    const deposit = ethers.parseEther("5");
    const usdcBalance = ethers.parseUnits("1000", 6);
    const wbtcBalance = ethers.parseUnits("0.01", 8);

    await user1.sendTransaction({ to: await baseToken.getAddress(), value: deposit });
    await baseToken.connect(user1).approve(await liquidityManager.getAddress(), deposit);
    await liquidityManager.connect(user1).deposit(deposit);
    await usdcToken.mint(custody, usdcBalance);
    await wbtcToken.mint(custody, wbtcBalance);

    expect(await baseToken.balanceOf(custody)).to.equal(deposit);
    expect(await usdcToken.balanceOf(custody)).to.equal(usdcBalance);
    expect(await wbtcToken.balanceOf(custody)).to.equal(wbtcBalance);

    const wethPrice = await tokenManager.getBaseAssetPrice();
    const usdcPrice = await tokenManager.getTokenPriceForModule("USDC");
    const wbtcPrice = await tokenManager.getTokenPriceForModule("WBTC");
    const totalBaseValue =
      (deposit * wethPrice) / 10n ** 18n +
      (usdcBalance * usdcPrice) / 10n ** 6n +
      (wbtcBalance * wbtcPrice) / 10n ** 8n;

    expect(totalBaseValue).to.equal(ethers.parseEther("5.533333333333333"));
  });

  it("performs a complete LP withdrawal without depending on deployed external state", async function () {
    const { baseToken, liquidityManager, proxyGeneral, user1 } =
      await deployFullProtocolFixture();
    const deposit = ethers.parseEther("5");

    await user1.sendTransaction({ to: await baseToken.getAddress(), value: deposit });
    await baseToken.connect(user1).approve(await liquidityManager.getAddress(), deposit);
    await liquidityManager.connect(user1).deposit(deposit);

    const shares = await proxyGeneral.balanceOf(user1.address);
    const before = await baseToken.balanceOf(user1.address);
    await liquidityManager.connect(user1).withdraw(shares);

    expect(await proxyGeneral.balanceOf(user1.address)).to.equal(0n);
    expect(await baseToken.balanceOf(user1.address)).to.be.gt(before);
  });
});
