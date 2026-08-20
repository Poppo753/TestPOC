import { expect } from "chai";
import { ethers } from "hardhat";
import { deployInterVaultFullCoreFixture } from "../../helpers/fixtures/interVaultFullCore";

describe("InterVault integration with the unchanged full core", function () {
  this.timeout(180_000);

  it("moves custody into a leaf while preserving the parent NAV and core API", async function () {
    const f = await deployInterVaultFullCoreFixture();
    const amount = ethers.parseEther("4");
    const navBefore = await f.valueCalculator.getTotalPoolValueView();
    const custodyBefore = await f.mockWETH.balanceOf(await f.proxyGeneral.getAddress());

    await f.protocolManager.deposit("InterVault", "WETH", amount);

    expect(await f.mockWETH.balanceOf(await f.proxyGeneral.getAddress())).to.equal(custodyBefore - amount);
    expect(await f.leaf.balanceOf(await f.plugin.getAddress())).to.equal(amount);
    expect(await f.protocolManager.getBalance("InterVault", "WETH")).to.equal(amount);
    expect(await f.protocolManager.getAllProtocolsValue()).to.equal(amount);
    expect(await f.lens.getTotalValue()).to.equal(amount);
    expect(await f.valueCalculator.getTotalPoolValueView()).to.equal(navBefore);
    expect((await f.lens.getChildPosition(f.childId)).exposureBps).to.equal(10_000);
  });

  it("includes deterministic leaf yield exactly once in parent valuation", async function () {
    const f = await deployInterVaultFullCoreFixture();
    await f.protocolManager.deposit("InterVault", "WETH", ethers.parseEther("4"));
    const navBefore = await f.valueCalculator.getTotalPoolValueView();
    const yieldAmount = ethers.parseEther("0.5");
    await f.mockWETH.connect(f.user1).deposit({ value: yieldAmount });
    await f.mockWETH.connect(f.user1).approve(await f.leaf.getAddress(), yieldAmount);
    await f.leaf.connect(f.user1).donate(yieldAmount);

    expect(await f.lens.getTotalValue()).to.equal(ethers.parseEther("4.5"));
    expect(await f.valueCalculator.getTotalPoolValueView()).to.equal(navBefore + yieldAmount);
  });
});
