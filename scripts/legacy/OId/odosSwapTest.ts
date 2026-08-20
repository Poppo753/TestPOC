import { ethers } from "hardhat";

async function main() {
  // Configurazioni
  const odosRouterAddress = "0xa669e7A0d4b3e4Fa48af2dE86BD4CD7126Be4e13"; // Indirizzo del Router Odos
  const tokenAAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // USDC
  const tokenBAddress = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"; // USDT
  const amountIn = ethers.parseUnits("0.1", 6); // Importo di USDC (6 decimali)
  const slippageBps = 500n; // 0.5% di slippage (bigint)
  const [signer] = await ethers.getSigners();
  const recipient = await signer.getAddress();

  console.log("Starting Odos swap test...");
  console.log(`Signer Address: ${recipient}`);

  // Instanzia il router
  const odosRouter = await ethers.getContractAt(
    [
      "function swap(address fromToken, address toToken, uint256 amountIn, uint256 minAmountOut, address recipient, address referral) external returns (uint256 amountOut)"
    ],
    odosRouterAddress
  );

  // Calcola l'importo minimo accettabile (slippage)
  const minAmountOut = (amountIn * (10000n - slippageBps)) / 10000n; // Usare operazioni bigint
  console.log(`Calculated minAmountOut: ${ethers.formatUnits(minAmountOut, 6)} Token B`);

  try {
    // Ottieni l'interfaccia del token A
    const tokenA = await ethers.getContractAt("IERC20", tokenAAddress);

    // Controlla il saldo del wallet
    const balance = await tokenA.balanceOf(recipient);
    console.log(`Wallet balance for Token A: ${ethers.formatUnits(balance, 6)}`);

    if (balance < amountIn) {
      console.error("Insufficient Token A balance for the swap.");
      return;
    }

    // Approva il router a spendere USDC
    console.log(`Approving ${ethers.formatUnits(amountIn, 6)} Token A for Odos Router...`);
    const approveTx = await tokenA.connect(signer).approve(odosRouterAddress, amountIn);
    await approveTx.wait();
    console.log("Approval transaction confirmed.");

    // Controlla l'allowance
    const allowance = await tokenA.allowance(recipient, odosRouterAddress);
    console.log(`Allowance for Odos Router: ${ethers.formatUnits(allowance, 6)} Token A`);

    if (allowance < amountIn) {
      console.error("Allowance is insufficient for the swap.");
      return;
    }

    // Esegui lo swap
    console.log(
      `Executing swap: ${ethers.formatUnits(amountIn, 6)} Token A -> ${ethers.formatUnits(minAmountOut, 6)} Token B (min)...`
    );

    const swapTx = await odosRouter.swap(
      tokenAAddress,
      tokenBAddress,
      amountIn,
      minAmountOut,
      recipient,
      ethers.ZeroAddress // Nessun referral
    );

    const receipt = await swapTx.wait();
    console.log("Swap transaction confirmed:", receipt.transactionHash);

    // Controlla il saldo finale del destinatario
    const tokenB = await ethers.getContractAt("IERC20", tokenBAddress);
    const finalBalance = await tokenB.balanceOf(recipient);
    console.log(`Final balance for Token B: ${ethers.formatUnits(finalBalance, 6)} Token B`);
  } catch (error: any) {
    console.error("Error during swap:", error.message || error);
  }
}
main().catch((error) => {
  console.error("Unhandled error:", error.message || error);
  process.exitCode = 1;
});
