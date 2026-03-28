import { ethers } from "hardhat";

async function main() {
    // Get Beacon address from environment or use default for hardhat
    const beaconAddress = process.env.BEACON_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    console.log("Deploying modules...");
    console.log(`Using Beacon address: ${beaconAddress}`);

    // Deploy MockOracleAdapter FIRST
    console.log("Deploying MockOracleAdapter...");
    const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
    const oracleAdapter = await MockOracleAdapter.deploy();
    await oracleAdapter.waitForDeployment();
    console.log(`MockOracleAdapter deployed at: ${oracleAdapter.target}`);
    
    // Setup default tokens in OracleAdapter
    console.log("Configuring default tokens...");
    await oracleAdapter.setupToken("USDC", ethers.parseUnits("1", 8), 8, true);
    await oracleAdapter.setupToken("WBTC", ethers.parseUnits("42000", 8), 8, true);
    await oracleAdapter.setupToken("ETH", ethers.parseUnits("3000", 8), 8, true);
    console.log("✅ OracleAdapter configured");

    // Deploy TokenManager.sol
    console.log("Deploying TokenManager...");
    const TokenManager = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TokenManager.deploy(
        beaconAddress,
        oracleAdapter.target
    );
    await tokenManager.waitForDeployment();
    console.log(`TokenManager deployed at: ${tokenManager.target}`);

    // Deploy SwapManager.sol
    console.log("Deploying SwapManager...");
    const SwapManager = await ethers.getContractFactory("SwapManager");
    const swapManager = await SwapManager.deploy(beaconAddress);
    await swapManager.waitForDeployment();
    console.log(`SwapManager deployed at: ${swapManager.target}`);

    // Deploy ValueCalculator.sol
    console.log("Deploying ValueCalculator...");
    const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
    const valueCalculator = await ValueCalculator.deploy(beaconAddress);
    await valueCalculator.waitForDeployment();
    console.log(`ValueCalculator deployed at: ${valueCalculator.target}`);

    // Deploy ParameterManager.sol
    console.log("Deploying ParameterManager...");
    const ParameterManager = await ethers.getContractFactory("ParameterManager");
    const parameterManager = await ParameterManager.deploy(beaconAddress);
    await parameterManager.waitForDeployment();
    console.log(`ParameterManager deployed at: ${parameterManager.target}`);

    // Deploy EmergencyHandler.sol
    console.log("Deploying EmergencyHandler...");
    const EmergencyHandler = await ethers.getContractFactory("EmergencyHandler");
    const emergencyHandler = await EmergencyHandler.deploy(beaconAddress);
    await emergencyHandler.waitForDeployment();
    console.log(`EmergencyHandler deployed at: ${emergencyHandler.target}`);

    // Deploy LiquidityManager.sol
    console.log("Deploying LiquidityManager...");
    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LiquidityManager.deploy(beaconAddress);
    await liquidityManager.waitForDeployment();
    console.log(`LiquidityManager deployed at: ${liquidityManager.target}`);

    console.log("All modules deployed successfully!");

    console.log("\nDeployed module addresses:");
    console.log(`Beacon: ${beaconAddress}`);
    console.log(`OracleAdapter: ${oracleAdapter.target}`);
    console.log(`TokenManager: ${tokenManager.target}`);
    console.log(`SwapManager: ${swapManager.target}`);
    console.log(`ValueCalculator: ${valueCalculator.target}`);
    console.log(`ParameterManager: ${parameterManager.target}`);
    console.log(`EmergencyHandler: ${emergencyHandler.target}`);
    console.log(`LiquidityManager: ${liquidityManager.target}`);
}

// Run the script
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
