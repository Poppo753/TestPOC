import { expect } from "chai";
import { ethers } from "hardhat";
import { deployInterVaultFullCoreFixture } from "../helpers/fixtures/interVaultFullCore";

describe("InterVault local E2E: user withdrawal through leaf unwind", function () {
  this.timeout(180_000);

  it("closes enough leaf liquidity when the parent custody reserve is insufficient", async function () {
    const f = await deployInterVaultFullCoreFixture();
    // The legacy LiquidityManager automatic-liquidity calculation targets the
    // user's net amount and does not add a non-zero withdrawal fee before
    // closing protocols. The deployed USDC POC uses a zero withdrawal fee; use
    // that production policy here so this E2E isolates InterVault behaviour.
    await f.liquidityManager.setWithdrawFee(0);
    await f.protocolManager.deposit("InterVault", "WETH", ethers.parseEther("8"));

    const yieldAmount = ethers.parseEther("1");
    await f.mockWETH.connect(f.user1).deposit({ value: yieldAmount });
    await f.mockWETH.connect(f.user1).approve(await f.leaf.getAddress(), yieldAmount);
    await f.leaf.connect(f.user1).donate(yieldAmount);

    const sharesBefore = await f.leaf.balanceOf(await f.plugin.getAddress());
    const userAssetBefore = await f.mockWETH.balanceOf(f.owner.address);
    const parentSharesBefore = await f.proxyGeneral.balanceOf(f.owner.address);
    const sharesToBurn = ethers.parseEther("5");
    expect(await f.mockWETH.balanceOf(await f.proxyGeneral.getAddress())).to.be.lt(
      await f.liquidityManager.calculateWithdrawAmount(sharesToBurn)
    );

    await f.liquidityManager.connect(f.owner).withdraw(sharesToBurn);

    expect(await f.mockWETH.balanceOf(f.owner.address)).to.be.gt(userAssetBefore);
    expect(await f.proxyGeneral.balanceOf(f.owner.address)).to.equal(parentSharesBefore - sharesToBurn);
    expect(await f.leaf.balanceOf(await f.plugin.getAddress())).to.be.lt(sharesBefore);
    expect(await f.valueCalculator.getTotalPoolValueView()).to.equal(
      await f.mockWETH.balanceOf(await f.proxyGeneral.getAddress()) + await f.lens.getTotalValue()
    );
  });
});
