import { ethers } from "hardhat";
import { expect } from "chai";

describe("OdosSwapper Integration Test", function () {
  let odosSwapper: any;
  let owner: any;

  // Indirizzi reali sulla rete di test Arbitrum (Goerli o Mainnet)
  const odosRouterAddress = "0xa669e7A0d4b3e4Fa48af2dE86BD4CD7126Be4e13"; // Odos Router
  const tokenAAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // USDC
  const tokenBAddress = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"; // USDT
  const amountIn = ethers.parseUnits("0.0001", 6); // 0.0001 USDC (6 decimali)
  const slippageBps = 50; // 0.5% di slippage

  before(async function () {
    [owner] = await ethers.getSigners();

    // Deploy del contratto OdosSwapper
    const OdosSwapper = await ethers.getContractFactory("OdosSwapper");
    odosSwapper = await OdosSwapper.deploy(odosRouterAddress);
    await odosSwapper.waitForDeployment();
  });

  it("Should check if wallet has enough Token A balance", async function () {
    const tokenA = await ethers.getContractAt("IERC20", tokenAAddress);

    // Ottieni l'indirizzo del wallet
    const walletAddress = await owner.getAddress();
    console.log(`Wallet address: ${walletAddress}`);

    // Controlla il saldo del wallet del mittente
    const balance = await tokenA.balanceOf(walletAddress);
    console.log(
      `Wallet balance for Token A: ${ethers.formatUnits(balance, 6)}`
    );

    // Verifica che il saldo sia sufficiente
    expect(balance).to.be.gte(
      amountIn,
      "Insufficient Token A balance for the swap"
    );
  });

  it("Should approve Odos Router to spend Token A", async function () {
    const tokenA = await ethers.getContractAt("IERC20", tokenAAddress);

    // Approva il contratto OdosSwapper a spendere Token A
    await tokenA.connect(owner).approve(odosSwapper.target, amountIn);

    const allowance = await tokenA.allowance(
      await owner.getAddress(),
      odosSwapper.target
    );
    expect(allowance).to.equal(amountIn);
  });

  it("Should execute a swap from Token A to Token B", async function () {
    const tokenA = await ethers.getContractAt("IERC20", tokenAAddress);
    const tokenB = await ethers.getContractAt("IERC20", tokenBAddress);

    console.log(
      `Attempting to swap ${ethers.formatUnits(amountIn, 6)} Token A (${tokenAAddress})`
    );

    // Saldo iniziale di Token A del router di Odos
    const initialRouterBalance = await tokenA.balanceOf(odosRouterAddress);

    // Trasferisci i token A al contratto OdosSwapper
    await tokenA.connect(owner).transfer(odosSwapper.target, amountIn);

    const initialBalance = await tokenB.balanceOf(await owner.getAddress());

    // Esegui lo swap
    const tx = await odosSwapper.swapTokens(
      tokenAAddress,
      tokenBAddress,
      amountIn,
      slippageBps,
      await owner.getAddress(),
      ethers.ZeroAddress // Nessun referral
    );
    await tx.wait();

    // Controlla che il router abbia ricevuto i token A
    const finalRouterBalance = await tokenA.balanceOf(odosRouterAddress);
    console.log(
      `Router received ${ethers.formatUnits(
        finalRouterBalance-(initialRouterBalance),
        6
      )} Token A`
    );

    // Controlla che il saldo di Token B sia aumentato
    const finalBalance = await tokenB.balanceOf(await owner.getAddress());
    expect(finalBalance).to.be.gt(initialBalance);

    console.log(
      `Swap completed. Received ${ethers.formatUnits(
        finalBalance-(initialBalance),
        6
      )} Token B (${tokenBAddress})`
    );
  });
});
