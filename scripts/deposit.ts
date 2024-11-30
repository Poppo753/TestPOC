import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function deposit() {
  // Configurazione
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);

  // Indirizzo del contratto (inserisci quello corretto dopo il deployment)
  const contractAddress = "0x0B11d8d864A02B40970e1a39aaD4A20BdE4C0F95";

  // ABI del contratto
  const abi = [
    "function deposit() external payable",
    "function balanceOf(address owner) view returns (uint256)",
  ];

  // Connessione al contratto
  const contract = new ethers.Contract(contractAddress, abi, wallet);

  // Invio del deposito
  const amount = ethers.parseEther("0.0001"); // 0.0001 ETH
  console.log(`Sending deposit of ${ethers.formatEther(amount)} ETH...`);

  const tx = await contract.deposit({ value: amount });
  console.log("Transaction sent. Hash:", tx.hash);

  // Aspetta la conferma
  const receipt = await tx.wait();
  console.log("Transaction confirmed. Block:", receipt.blockNumber);

  // Controlla il bilancio di LP token
  const balance = await contract.balanceOf(wallet.address);
  console.log(
    `Balance of LP tokens: ${ethers.formatEther(balance.toString())}`
  );
}

deposit().catch((error) => {
  console.error("Error during deposit:", error);
});
