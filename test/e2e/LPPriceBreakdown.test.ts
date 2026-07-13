import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFullProtocolFixture } from "../helpers/fixtures/fullStack";

describe("E2E: deterministic LP price breakdown", function () {
  it("derives the LP price from real pool value and total supply", async function () {
    const { user1, baseToken, liquidityManager, proxyGeneral, valueCalculator } =
      await deployFullProtocolFixture();
    const deposit = ethers.parseEther("4");

    await user1.sendTransaction({ to: await baseToken.getAddress(), value: deposit });
    await baseToken.connect(user1).approve(await liquidityManager.getAddress(), deposit);
    await liquidityManager.connect(user1).deposit(deposit);

    const totalPoolValue = await valueCalculator.getTotalPoolValueView();
    const totalSupply = await proxyGeneral.totalSupply();
    const lpPrice = (totalPoolValue * ethers.parseEther("1")) / totalSupply;

    expect(totalPoolValue).to.equal(deposit);
    expect(totalSupply).to.equal(deposit);
    expect(lpPrice).to.equal(ethers.parseEther("1"));
  });
});
