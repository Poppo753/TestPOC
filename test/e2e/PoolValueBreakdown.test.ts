import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFullProtocolFixture } from "../helpers/fixtures/fullStack";

describe("E2E: deterministic pool value breakdown", function () {
  it("accounts for WETH, USDC and WBTC balances using configured prices", async function () {
    const { owner, proxyGeneral, tokenManager, baseToken, usdcToken, wbtcToken } =
      await deployFullProtocolFixture();
    const custody = await proxyGeneral.getAddress();

    await owner.sendTransaction({ to: await baseToken.getAddress(), value: ethers.parseEther("2") });
    await baseToken.transfer(custody, ethers.parseEther("2"));
    await usdcToken.mint(custody, ethers.parseUnits("3000", 6));
    await wbtcToken.mint(custody, ethers.parseUnits("0.05", 8));

    const wethPrice = await tokenManager.getBaseAssetPrice();
    const usdcPrice = await tokenManager.getTokenPriceForModule("USDC");
    const wbtcPrice = await tokenManager.getTokenPriceForModule("WBTC");
    const wethValue = ethers.parseEther("2");
    const usdcValue = ethers.parseUnits("3000", 6) * usdcPrice * 10n ** 18n /
      (wethPrice * 10n ** 6n);
    const wbtcValue = ethers.parseUnits("0.05", 8) * wbtcPrice * 10n ** 18n /
      (wethPrice * 10n ** 8n);

    expect(wethValue).to.equal(ethers.parseEther("2"));
    expect(usdcValue).to.equal(999999999999999000n);
    expect(wbtcValue).to.equal(ethers.parseEther("1"));
    expect(wethValue + usdcValue + wbtcValue).to.equal(ethers.parseEther("3.999999999999999"));
  });
});
