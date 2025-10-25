import { ethers } from "hardhat";
import { BaseContract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * 🏗️ SYSTEM CONTRACTS INTERFACE
 * Definisce la struttura dei contratti del sistema
 */
export interface SystemContracts {
  // Core contracts
  beacon: BaseContract;
  proxyGeneral: BaseContract;
  
  // Modules
  liquidityManager: BaseContract;
  swapManager: BaseContract;
  emergencyHandler: BaseContract;
  parameterManager: BaseContract;
  tokenManager: BaseContract;
  valueCalculator: BaseContract;
  
  // Test accounts
  accounts: {
    owner: HardhatEthersSigner;
    user1: HardhatEthersSigner;
    user2: HardhatEthersSigner;
    feeRecipient: HardhatEthersSigner;
    emergencyContact: HardhatEthersSigner;
  };
  
  // Configuration
  config: {
    mockWETH: string;
    depositAmount: bigint;
    withdrawAmount: bigint;
    feeBasisPoints: number;
    timelockPeriod: number;
  };
}

/**
 * 🚀 DEPLOY COMPLETE SYSTEM FIXTURE
 * Deploya tutto il sistema DeFi con configurazione standard per test
 */
export async function deploySystemFixture(): Promise<SystemContracts> {
  console.log("🔧 Deploying complete DeFi system for testing...");
  
  // Get test accounts
  const [owner, user1, user2, feeRecipient, emergencyContact] = await ethers.getSigners();
  
  // Configuration
  const config = {
    mockWETH: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // Arbitrum WETH
    depositAmount: ethers.parseEther("1"),
    withdrawAmount: ethers.parseEther("0.5"),
    feeBasisPoints: 100, // 1%
    timelockPeriod: 3600, // 1 hour
  };
  
  // 1. Deploy Beacon
  console.log("   📦 Deploying Beacon...");
  const BeaconFactory = await ethers.getContractFactory("Beacon");
  const beacon = await BeaconFactory.deploy();
  await beacon.waitForDeployment();
  
  // 2. Deploy ProxyGeneral
  console.log("   📦 Deploying ProxyGeneral...");
  const ProxyGeneralFactory = await ethers.getContractFactory("ProxyGeneral");
  const beaconAddress = await beacon.getAddress();
  const proxyGeneral = await ProxyGeneralFactory.deploy(beaconAddress);
  await proxyGeneral.waitForDeployment();
  
  // 3. Deploy all modules
  console.log("   📦 Deploying modules...");
  const modules = [
    "LiquidityManager",
    "SwapManager", 
    "EmergencyHandler",
    "ParameterManager",
    "TokenManager",
    "ValueCalculator"
  ];
  
  const deployedModules: Record<string, BaseContract> = {};
  
  for (const moduleName of modules) {
    console.log(`      - ${moduleName}`);
    const Factory = await ethers.getContractFactory(moduleName);
    const moduleContract = await Factory.deploy(beaconAddress);
    await moduleContract.waitForDeployment();
    deployedModules[moduleName] = moduleContract;
    
    // Register in Beacon
    await beacon.updateImplementation(moduleName, await moduleContract.getAddress());
  }
  
  // 4. Register ProxyGeneral in Beacon
  console.log("   🔗 Registering ProxyGeneral in Beacon...");
  await beacon.updateImplementation("ProxyGeneral", await proxyGeneral.getAddress());
  
  // 5. Setup module authorizations
  console.log("   🔐 Setting up module authorizations...");
  await proxyGeneral.authorizeModule(await deployedModules["LiquidityManager"].getAddress(), "LiquidityManager");
  await proxyGeneral.authorizeModule(await deployedModules["SwapManager"].getAddress(), "SwapManager");
  await proxyGeneral.authorizeModule(await deployedModules["EmergencyHandler"].getAddress(), "EmergencyHandler");
  
  console.log("   ✅ System deployment complete!");
  
  return {
    // Core contracts
    beacon,
    proxyGeneral,
    
    // Modules
    liquidityManager: deployedModules["LiquidityManager"],
    swapManager: deployedModules["SwapManager"],
    emergencyHandler: deployedModules["EmergencyHandler"],
    parameterManager: deployedModules["ParameterManager"],
    tokenManager: deployedModules["TokenManager"],
    valueCalculator: deployedModules["ValueCalculator"],
    
    // Test accounts
    accounts: {
      owner,
      user1,
      user2,
      feeRecipient,
      emergencyContact,
    },
    
    // Configuration
    config,
  };
}

/**
 * 🔧 DEPLOY SINGLE MODULE FIXTURE
 * Deploya un singolo modulo con Beacon minimo per test isolati
 */
export async function deployModuleFixture(moduleName: string): Promise<{
  beacon: BaseContract;
  module: BaseContract;
  owner: HardhatEthersSigner;
}> {
  const [owner] = await ethers.getSigners();
  
  // Deploy minimal Beacon
  const BeaconFactory = await ethers.getContractFactory("Beacon");
  const beacon = await BeaconFactory.deploy();
  await beacon.waitForDeployment();
  
  // Deploy target module
  const ModuleFactory = await ethers.getContractFactory(moduleName);
  const module = await ModuleFactory.deploy(await beacon.getAddress());
  await module.waitForDeployment();
  
  // Register in Beacon
  await beacon.updateImplementation(moduleName, await module.getAddress());
  
  return {
    beacon,
    module,
    owner,
  };
}

/**
 * 🎭 DEPLOY MINIMAL SYSTEM FIXTURE
 * Setup minimo per test veloci che non richiedono sistema completo
 */
export async function deployMinimalSystemFixture(): Promise<{
  beacon: BaseContract;
  proxyGeneral: BaseContract;
  accounts: SystemContracts['accounts'];
}> {
  const [owner, user1, user2, feeRecipient, emergencyContact] = await ethers.getSigners();
  
  // Deploy only Beacon and ProxyGeneral
  const BeaconFactory = await ethers.getContractFactory("Beacon");
  const beacon = await BeaconFactory.deploy();
  await beacon.waitForDeployment();
  
  const ProxyGeneralFactory = await ethers.getContractFactory("ProxyGeneral");
  const proxyGeneral = await ProxyGeneralFactory.deploy(await beacon.getAddress());
  await proxyGeneral.waitForDeployment();
  
  await beacon.updateImplementation("ProxyGeneral", await proxyGeneral.getAddress());
  
  return {
    beacon,
    proxyGeneral,
    accounts: {
      owner,
      user1,
      user2,
      feeRecipient,
      emergencyContact,
    },
  };
}