import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { SwapExamples } from "../typechain-types"; // Assicurati che il percorso sia corretto
dotenv.config();

// Configura l'ambiente
const ARBITRUM_RPC_URL = process.env.ARBITRUM_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// Indirizzo del contratto deployato su Arbitrum
const CONTRACT_ADDRESS = "0xFc89Ef673Cfae40E8DFDb55Af6266D84865Bda49";

// ABI del contratto (importa o copia dalla build)
const ABI = [
  "function swapExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn) external returns (uint256)"
];




async function main() {
  // Configura il provider e il wallet
  const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  

  // Instanzia il contratto
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet) as unknown as SwapExamples;

  // Parametri per lo swap
  const tokenIn = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Indirizzo del token da inviare
  const tokenOut = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"; // Indirizzo del token da ricevere
  const fee = 100; // Pool fee (es. 3000 per 0.3%)
  const amountIn = ethers.parseUnits("0.01", 6); // Importo in tokenIn (1.0 con 18 decimali)

  console.groupCollapsed("Amount In:", amountIn)

  // Assicurati che il wallet abbia approvato il contratto per il trasferimento di tokenIn
  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)"
  ];
  const tokenContract = new ethers.Contract(tokenIn, erc20Abi, wallet);
  const txApprove = await tokenContract.approve(CONTRACT_ADDRESS, amountIn);
  console.log("Approval transaction sent:", txApprove.hash);
  await txApprove.wait();
  console.log("Tokens approved!");

  // Effettua lo swap
  console.log("Starting swap...");
  const txSwap = await contract.swapExactInputSingle(tokenIn, tokenOut, fee, amountIn);
  console.log("Swap transaction sent:", txSwap.hash);

  const receipt = await txSwap.wait();
  console.log("Swap completed:", receipt);
}

// Esegui lo script
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
