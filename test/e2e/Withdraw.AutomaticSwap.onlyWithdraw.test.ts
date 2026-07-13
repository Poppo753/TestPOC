import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFullProtocolFixture } from "../helpers/fixtures/fullStack";

describe("E2E: standalone withdrawal with existing LP", function () {
  it("creates its own LP state and completes a full withdrawal", async function () {
    const { baseToken, liquidityManager, proxyGeneral, user1 } =
      await deployFullProtocolFixture();
    const amount = ethers.parseEther("2");

    await user1.sendTransaction({ to: await baseToken.getAddress(), value: amount });
    await baseToken.connect(user1).approve(await liquidityManager.getAddress(), amount);
    await liquidityManager.connect(user1).deposit(amount);

    const shares = await proxyGeneral.balanceOf(user1.address);
    expect(shares).to.be.gt(0n);
    const before = await baseToken.balanceOf(user1.address);

    await liquidityManager.connect(user1).withdraw(shares);

    expect(await proxyGeneral.balanceOf(user1.address)).to.equal(0n);
    expect(await baseToken.balanceOf(user1.address)).to.be.gt(before);
  });
});
