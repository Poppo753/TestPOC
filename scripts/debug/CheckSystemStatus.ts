import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const VALUE_CALCULATOR = "0x2E042874BcFc6bE51e0D6b23F8Da22bDd8B215B0";

async function main() {
  console.log("\n🔍 SYSTEM STATUS CHECK");
  console.log("=".repeat(100) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}\n`);

  // Check Beacon implementations
  console.log("📡 Beacon Implementations:");
  console.log("-".repeat(100));
  
  const beacon = await ethers.getContractAt(
    ["function getImplementation(string) external view returns (address)"],
    BEACON
  );

  const liquidityManager = await beacon.getImplementation("LiquidityManager");
  const valueCalculator = await beacon.getImplementation("ValueCalculator");
  const tokenManager = await beacon.getImplementation("TokenManager");
  const swapManager = await beacon.getImplementation("SwapManager");

  console.log(`   LiquidityManager: ${liquidityManager}`);
  console.log(`   ValueCalculator:  ${valueCalculator}`);
  console.log(`   TokenManager:     ${tokenManager}`);
  console.log(`   SwapManager:      ${swapManager}\n`);

  // Check if LiquidityManager is authorized
  console.log("🔐 Authorization Check:");
  console.log("-".repeat(100));
  
  const proxyGeneral = await ethers.getContractAt(
    [
      "function isModuleAuthorized(address) external view returns (bool)",
      "function totalSupply() external view returns (uint256)",
      "function balanceOf(address) external view returns (uint256)"
    ],
    PROXY
  );

  const isAuthorized = await proxyGeneral.isModuleAuthorized(liquidityManager);
  console.log(`   LiquidityManager Authorized: ${isAuthorized ? "✅" : "❌"}\n`);

  // Check LP tokens
  console.log("💎 LP Token Status:");
  console.log("-".repeat(100));
  
  const totalSupply = await proxyGeneral.totalSupply();
  const userBalance = await proxyGeneral.balanceOf(signer.address);
  
  console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} LP`);
  console.log(`   Your Balance: ${ethers.formatEther(userBalance)} LP\n`);

  // Check pool value
  console.log("💰 Pool Value:");
  console.log("-".repeat(100));
  
  try {
    const valueCalc = await ethers.getContractAt(
      ["function getTotalPoolValueView() external view returns (uint256)"],
      VALUE_CALCULATOR
    );
    
    const totalValue = await valueCalc.getTotalPoolValueView();
    console.log(`   Total Pool Value: ${ethers.formatEther(totalValue)} ETH`);
    
    if (totalSupply > 0n) {
      const lpPrice = (totalValue * ethers.parseEther("1")) / totalSupply;
      console.log(`   LP Price: ${ethers.formatEther(lpPrice)} ETH per LP\n`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error getting pool value: ${error.message}\n`);
  }

  // Check ValueCalculator settings
  console.log("⚙️  ValueCalculator Settings:");
  console.log("-".repeat(100));
  
  try {
    const valueCalc = await ethers.getContractAt(
      [
        "function maxPriceAge() external view returns (uint256)",
        "function cacheDuration() external view returns (uint256)"
      ],
      VALUE_CALCULATOR
    );
    
    const maxPriceAge = await valueCalc.maxPriceAge();
    const cacheDuration = await valueCalc.cacheDuration();
    
    console.log(`   maxPriceAge: ${maxPriceAge} seconds (${Number(maxPriceAge) / 3600} hours)`);
    console.log(`   cacheDuration: ${cacheDuration} seconds\n`);
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  console.log("=".repeat(100));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
