import { ethers } from "ethers";

// Configura il provider e il wallet
const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Indirizzo del contratto SimpleSwap
const simpleSwapAddress = "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096"; // Sostituisci con l'indirizzo del contratto deployato

// Connettiti al contratto senza ABI predefinito
const simpleSwapContract = new ethers.Contract(simpleSwapAddress, [
  "function inputSwap(address spendToken, address receiveToken, uint256 amountIn) public returns (uint256)",
  "function outputSwap(address spendToken, address receiveToken, uint256 amountInMax, uint256 amountOut) public returns (uint256)"
], wallet);

// Funzione per eseguire un inputSwap
async function inputSwap(spendToken: string, receiveToken: string, amountIn: string) {
  try {
    // Approva il contratto per spendere i token
    const spendTokenContract = new ethers.Contract(spendToken, ["function approve(address spender, uint256 amount) public returns (bool)"], wallet);
    const approvalTx = await spendTokenContract.approve(simpleSwapAddress, amountIn);
    await approvalTx.wait();

    console.log(`Approved ${amountIn} of token ${spendToken}`);

    // Chiama la funzione inputSwap
    const tx = await simpleSwapContract.inputSwap(spendToken, receiveToken, amountIn);
    const receipt = await tx.wait();

    console.log("Input swap successful:", receipt.transactionHash);
  } catch (error) {
    console.error("Error in inputSwap:", error);
  }
}

// Esempi di utilizzo
(async () => {
  const spendToken = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // USDT
  const receiveToken = "0x4186BFC76E2E237523CBC30FD220FE055156b41F"; // USDC

  // Input swap
  const amountIn = ethers.parseUnits("0.0000001", 18).toString(); // 0.01 USDT (6 decimali)
  await inputSwap(spendToken, receiveToken, amountIn);

})();


/**
// Funzione per eseguire un outputSwap
async function outputSwap(spendToken: string, receiveToken: string, amountInMax: string, amountOut: string) {
  try {
    // Approva il contratto per spendere i token
    const spendTokenContract = new ethers.Contract(spendToken, ["function approve(address spender, uint256 amount) public returns (bool)"], wallet);
    const approvalTx = await spendTokenContract.approve(simpleSwapAddress, amountInMax);
    await approvalTx.wait();

    console.log(`Approved ${amountInMax} of token ${spendToken}`);

    // Chiama la funzione outputSwap
    const tx = await simpleSwapContract.outputSwap(spendToken, receiveToken, amountInMax, amountOut);
    const receipt = await tx.wait();

    console.log("Output swap successful:", receipt.transactionHash);
  } catch (error) {
    console.error("Error in outputSwap:", error);
  }
}

  // Output swap
  const amountInMax = ethers.parseUnits("0.000002", 18).toString(); // Massimo 0.02 USDT (6 decimali)
  const amountOut = ethers.parseUnits("0.00000001", 18).toString(); // Ricevere almeno 0.01 USDC (6 decimali)
  await outputSwap(spendToken, receiveToken, amountInMax, amountOut); */