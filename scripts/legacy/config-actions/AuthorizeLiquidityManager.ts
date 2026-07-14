import { ethers } from "hardhat";

const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const NEW_LIQUIDITY_MANAGER = "0xfb26C7A0CF5b4e86Dcf870b2349A29DA4F630150"; // Multi-swap WORKING!

async function main() {
  console.log("\n⚙️ AUTHORIZE NEW LIQUIDITY MANAGER");
  console.log("=".repeat(80) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}\n`);

  const proxyGeneral = await ethers.getContractAt(
    [
      "function authorizeModule(address,string) external",
      "function authorizedModules(address) external view returns (bool)"
    ],
    PROXY_GENERAL
  );

  // Check current status
  const isAuthorized = await proxyGeneral.authorizedModules(NEW_LIQUIDITY_MANAGER);
  console.log(`Current status: ${isAuthorized ? 'AUTHORIZED ✅' : 'NOT AUTHORIZED ❌'}\n`);

  if (isAuthorized) {
    console.log("Already authorized!");
    return;
  }

  // Authorize
  console.log("Authorizing new LiquidityManager...");
  const tx = await proxyGeneral.authorizeModule(NEW_LIQUIDITY_MANAGER, "LiquidityManager");
  console.log(`📝 TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ Authorized!\n`);

  // Verify
  const newStatus = await proxyGeneral.authorizedModules(NEW_LIQUIDITY_MANAGER);
  console.log(`✅ New status: ${newStatus ? 'AUTHORIZED ✅' : 'NOT AUTHORIZED ❌'}`);

  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
