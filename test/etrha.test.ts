import { expect } from "chai";
import { ethers } from "hardhat";
import { LiquidityPoolETH } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LiquidityPoolETH", function () {
  let pool: LiquidityPoolETH;
  let deployer: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress;

  beforeEach(async function () {
    // Ottieni il factory e distribuisci il contratto
    const Pool = await ethers.getContractFactory("LiquidityPoolETH");
    pool = (await Pool.deploy()) as unknown as LiquidityPoolETH;

    // Ottieni gli account
    [deployer, user1, user2] = await ethers.getSigners();
  });

  // Test di deposito
  it("Should allow deposits and mint LP tokens", async function () {
    const depositAmount = ethers.parseEther("1");

    // Simula un deposito
    await pool.connect(user1).deposit({ value: depositAmount });

    // Verifica il bilancio di LP token dell'utente
    const balance = await pool.balanceOf(user1.address);
    expect(balance).to.equal(depositAmount);

    // Verifica che la liquidità totale sia aggiornata
    const totalLiquidity = await pool.totalLiquidity();
    expect(totalLiquidity).to.equal(depositAmount);
  });

  // Test di prelievo
  it("Should allow withdrawals and burn LP tokens", async function () {
    const depositAmount = ethers.parseEther("1");

    // Deposita e poi ritira
    await pool.connect(user1).deposit({ value: depositAmount });
    await pool.connect(user1).initiateWithdraw(depositAmount);
    await pool.connect(user1).completeWithdraw();

    // Verifica che l'utente non abbia più LP token
    const balance = await pool.balanceOf(user1.address);
    expect(balance).to.equal(0);

    // Verifica che la liquidità totale sia aggiornata
    const totalLiquidity = await pool.totalLiquidity();
    expect(totalLiquidity).to.equal(0);
  });

  // Test di deposito con limite temporale
  it("Should reject deposits after the deadline", async function () {
    const depositAmount = ethers.parseEther("1");
    const deadline = Math.floor(Date.now() / 1000) - 60; // 60 secondi nel passato

    // Deposito oltre il limite temporale
    await expect(
      pool.connect(user1).timedDeposit(deadline, { value: depositAmount })
    ).to.be.revertedWith("Transaction expired");
  });

  // Test del limite massimo di deposito
  it("Should reject deposits above the maximum limit", async function () {
    const depositAmount = ethers.parseEther("101"); // Oltre il limite di 100 ETH
    await expect(
      pool.connect(user1).deposit({ value: depositAmount })
    ).to.be.revertedWith("Deposit exceeds maximum limit");
  });

  it("Should reject withdrawals that exceed the hourly limit", async function () {
    // Deposita più di 100 ETH in transazioni separate
    const depositAmount1 = ethers.parseEther("60");
    const depositAmount2 = ethers.parseEther("50");
  
    await pool.connect(user1).deposit({ value: depositAmount1 });
  
    // Avanza il tempo di 1 minuto per rispettare il rate limiter
    await ethers.provider.send("evm_increaseTime", [60]);
    await ethers.provider.send("evm_mine", []); // Genera un nuovo blocco
  
    await pool.connect(user1).deposit({ value: depositAmount2 });
  
    // Primo prelievo (50 ETH)
    const firstWithdraw = ethers.parseEther("50");
    await pool.connect(user1).initiateWithdraw(firstWithdraw);
    await pool.connect(user1).completeWithdraw();
  
    // Secondo prelievo (50 ETH)
    const secondWithdraw = ethers.parseEther("50");
    await pool.connect(user1).initiateWithdraw(secondWithdraw);
    await pool.connect(user1).completeWithdraw();
  
    // Terzo prelievo (51 ETH, supera il limite orario di 100 ETH)
    const thirdWithdraw = ethers.parseEther("1");
  
    // Calcola il numero di token LP necessari per il terzo prelievo
    const userShares = await pool.balanceOf(user1.address);
    const totalSupply = await pool.totalSupply();
    const totalLiquidity = await pool.totalLiquidity();
  
    const requiredShares = (thirdWithdraw * totalSupply) / totalLiquidity;
  
    // Verifica che l'utente abbia abbastanza token LP per il terzo prelievo
    expect(userShares).to.be.gte(
      requiredShares,
       'Insufficient LP tokens for third withdrawal. Use shares: ${userShares.toString()}, Required: ${requiredShares.toString()}'
);
  
    // Il terzo prelievo deve fallire per superamento del limite orario
    await expect(
      pool.connect(user1).initiateWithdraw(thirdWithdraw)
    ).to.be.revertedWith("Exceeds hourly withdraw limit");
  });
  
  

  // Test della modalità di emergenza
  it("Should allow emergency withdrawals in paused mode", async function () {
    const depositAmount = ethers.parseEther("10");
    await pool.connect(user1).deposit({ value: depositAmount });

    // Attiva la modalità di emergenza
    await pool.connect(deployer).pause();

    // L'utente preleva in emergenza
    await pool.connect(user1).emergencyWithdraw();

    // Verifica che l'utente non abbia più LP token
    const balance = await pool.balanceOf(user1.address);
    expect(balance).to.equal(0);

    // Verifica che la liquidità totale sia aggiornata
    const totalLiquidity = await pool.totalLiquidity();
    expect(totalLiquidity).to.equal(0);
  });

  // Test di rate limiting (tempo tra due azioni)
  it("Should prevent actions performed too frequently", async function () {
    const depositAmount = ethers.parseEther("1");

    // Primo deposito
    await pool.connect(user1).deposit({ value: depositAmount });

    // Secondo deposito immediato deve fallire
    await expect(
      pool.connect(user1).deposit({ value: depositAmount })
    ).to.be.revertedWith("Wait before next action");
  });
});