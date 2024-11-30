import { expect } from "chai";
import { ethers } from "hardhat";
import { ETHToTokenSwap } from "../typechain-types";

describe("ETHToTokenSwap", function () {
  let swapContract: ETHToTokenSwap;
  let owner: any;
  let user: any;

  const ODOS_ROUTER = "0xa669e7A0d4b3e4Fa48af2dE86BD4CD7126Be4e13";
  const OUTPUT_TOKEN = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const DEPLOYED_ADDRESS = "0x3ddF7667C9F0e3bf170629FbdFECa97c554495cD";

  before(async () => {
    [owner, user] = await ethers.getSigners();

    // Connetti il contratto all'indirizzo deployato
    swapContract = (await ethers.getContractAt(
      "ETHToTokenSwap",
      DEPLOYED_ADDRESS
    )) as unknown as ETHToTokenSwap;
  });

  it("Deve avere le costanti correttamente impostate", async function () {
    const routerAddress = await swapContract.ODOS_ROUTER();
    const outputTokenAddress = await swapContract.OUTPUT_TOKEN();
    expect(routerAddress).to.equal(ODOS_ROUTER);
    expect(outputTokenAddress).to.equal(OUTPUT_TOKEN);
  });

  it("Deve effettuare correttamente lo swap", async function () {
    const depositAmount = ethers.parseEther("1");

    // Simula uno swap
    const tx = await swapContract.connect(user).depositAndSwap({ value: depositAmount });

    // Verifica che l'evento SwapExecuted sia stato emesso
    await expect(tx).to.emit(swapContract, "SwapExecuted").withArgs(user.address, depositAmount, 0);
  });
});
