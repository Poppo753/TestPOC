import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function withdraw() {
  // Configurazione
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);

  // Indirizzo del contratto (inserisci quello corretto dopo il deployment)
  const contractAddress = "0x0B11d8d864A02B40970e1a39aaD4A20BdE4C0F95";

  // ABI del contratto
  const abi = [
    "function initiateWithdraw(uint256 shares) external",
    "function completeWithdraw() external",
    "function balanceOf(address owner) view returns (uint256)",
  ];

  // Connessione al contratto
  const contract = new ethers.Contract(contractAddress, abi, wallet);

  // Ottieni il bilancio di LP token dell'utente
  const balance = await contract.balanceOf(wallet.address);
  console.log(
    `Balance of LP tokens: ${ethers.formatEther(balance.toString())}`
  );

  if (balance === 0n) {
    console.error("No LP tokens to withdraw.");
    return;
  }

  // Inizio del prelievo
  console.log(`Initiating withdrawal of ${ethers.formatEther(balance)} shares...`);
  const tx1 = await contract.initiateWithdraw(balance);
  console.log("Transaction sent. Hash:", tx1.hash);

  // Aspetta la conferma
  const receipt1 = await tx1.wait();
  console.log("Initiate withdraw confirmed. Block:", receipt1.blockNumber);

  // Completa il prelievo
  console.log("Completing withdrawal...");
  const tx2 = await contract.completeWithdraw();
  console.log("Transaction sent. Hash:", tx2.hash);

  // Aspetta la conferma
  const receipt2 = await tx2.wait();
  console.log("Withdraw completed. Block:", receipt2.blockNumber);
}

withdraw().catch((error) => {
  console.error("Error during withdrawal:", error);
});
