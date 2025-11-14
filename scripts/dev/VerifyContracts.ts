// SPDX-License-Identifier: MIT
/**
 * @title VerifyContracts
 * @dev Script per verifica automatica di tutti i contratti su Etherscan/Arbiscan
 * 
 * Features:
 * - Verifica tutti i contratti core del sistema
 * - Gestione automatica constructor arguments
 * - Retry logic per rate limiting
 * - Status tracking e reporting
 * 
 * CLI Usage:
 *   npx hardhat run scripts/dev/VerifyContracts.ts --network <network>
 *   --contracts=<file.json>        (deployment addresses file)
 *   --module=<ModuleName>          (verify single module)
 *   --retry=<number>               (retry attempts, default: 3)
 *   --delay=<ms>                   (delay between verifications, default: 5000)
 * 
 * Examples:
 *   npx hardhat run scripts/dev/VerifyContracts.ts --network sepolia --contracts=deployment.json
 *   npx hardhat run scripts/dev/VerifyContracts.ts --network arbitrum --module=LiquidityManager
 */

import { ethers, run } from "hardhat";
import { BaseScript, ScriptResult } from "../utils/BaseScript";
import { Logger } from "../config/config";
import * as fs from "fs";

interface VerifyOptions {
  contractsFile?: string;
  module?: string;
  retry: number;
  delay: number;
}

interface ContractInfo {
  name: string;
  address: string;
  constructorArgs: any[];
}

interface VerificationResult {
  contract: string;
  address: string;
  success: boolean;
  error?: string;
  alreadyVerified?: boolean;
}

/**
 * @notice Script per verifica contratti su Etherscan
 * @dev Pattern: hardhat-etherscan plugin
 */
export class VerifyContractsScript extends BaseScript {
  private verifyOptions: VerifyOptions;
  private verificationResults: VerificationResult[] = [];
  
  constructor() {
    super();
    this.verifyOptions = this.parseVerifyOptions();
  }

  protected getScriptName(): string {
    return "VerifyContracts";
  }

  private parseVerifyOptions(): VerifyOptions {
    const args = process.argv.slice(2);
    
    const getArg = (name: string, defaultValue: string = ""): string => {
      const arg = args.find(a => a.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : defaultValue;
    };

    return {
      contractsFile: getArg("contracts"),
      module: getArg("module"),
      retry: parseInt(getArg("retry", "3")),
      delay: parseInt(getArg("delay", "5000"))
    };
  }

  protected async executeMain(): Promise<ScriptResult> {
    Logger.section("CONTRACT VERIFICATION");
    Logger.info(`Network: ${await ethers.provider.getNetwork().then(n => n.name)}`);
    Logger.info(`Retry Attempts: ${this.verifyOptions.retry}`);
    Logger.info(`Delay: ${this.verifyOptions.delay}ms`);

    try {
      let contractsToVerify: ContractInfo[] = [];

      // Step 1: Build contracts list
      if (this.verifyOptions.module) {
        // Single module verification
        contractsToVerify = await this.buildSingleModuleList();
      } else if (this.verifyOptions.contractsFile) {
        // Full deployment verification
        contractsToVerify = await this.loadContractsFromFile();
      } else {
        // Auto-detect from Beacon
        contractsToVerify = await this.buildContractsFromBeacon();
      }

      Logger.info(`Contracts to verify: ${contractsToVerify.length}`);

      // Step 2: Verify each contract
      for (const contract of contractsToVerify) {
        await this.verifyContract(contract);
        
        // Delay to avoid rate limiting
        if (contractsToVerify.indexOf(contract) < contractsToVerify.length - 1) {
          Logger.info(`Waiting ${this.verifyOptions.delay}ms before next verification...`);
          await this.sleep(this.verifyOptions.delay);
        }
      }

      // Step 3: Report results
      this.reportResults();

      const successCount = this.verificationResults.filter(r => r.success).length;

      return {
        success: successCount === contractsToVerify.length,
        data: {
          total: contractsToVerify.length,
          verified: successCount,
          failed: contractsToVerify.length - successCount,
          results: this.verificationResults
        }
      };

    } catch (error: any) {
      Logger.error(`Verification failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * @notice Build list for single module verification
   */
  private async buildSingleModuleList(): Promise<ContractInfo[]> {
    Logger.info(`Building verification info for ${this.verifyOptions.module}`);

    const moduleAddr = await this.contracts.beacon.getImplementation(this.verifyOptions.module!);
    
    if (moduleAddr === ethers.ZeroAddress) {
      throw new Error(`Module ${this.verifyOptions.module} not found in Beacon`);
    }

    const beaconAddr = await this.contracts.beacon.getAddress();

    return [{
      name: this.verifyOptions.module!,
      address: moduleAddr,
      constructorArgs: [beaconAddr]
    }];
  }

  /**
   * @notice Load contracts from deployment file
   */
  private async loadContractsFromFile(): Promise<ContractInfo[]> {
    Logger.info(`Loading contracts from ${this.verifyOptions.contractsFile}`);

    if (!fs.existsSync(this.verifyOptions.contractsFile!)) {
      throw new Error(`File not found: ${this.verifyOptions.contractsFile}`);
    }

    const deploymentData = JSON.parse(fs.readFileSync(this.verifyOptions.contractsFile!, 'utf-8'));

    const contracts: ContractInfo[] = [];

    // Beacon (no constructor args)
    if (deploymentData.beacon) {
      contracts.push({
        name: "Beacon",
        address: deploymentData.beacon,
        constructorArgs: []
      });
    }

    // All modules (beacon address as constructor arg)
    const modules = [
      "tokenManager",
      "parameterManager",
      "valueCalculator",
      "proxyGeneral",
      "liquidityManager",
      "swapManager",
      "emergencyHandler"
    ];

    for (const module of modules) {
      if (deploymentData[module]) {
        const moduleName = module.charAt(0).toUpperCase() + module.slice(1);
        contracts.push({
          name: moduleName,
          address: deploymentData[module],
          constructorArgs: [deploymentData.beacon]
        });
      }
    }

    // Mock contracts if present
    if (deploymentData.mockWETH) {
      contracts.push({
        name: "MockWETH",
        address: deploymentData.mockWETH,
        constructorArgs: []
      });
    }

    if (deploymentData.mockUSDC) {
      contracts.push({
        name: "MockERC20",
        address: deploymentData.mockUSDC,
        constructorArgs: ["USD Coin", "USDC", 6]
      });
    }

    if (deploymentData.mockWBTC) {
      contracts.push({
        name: "MockERC20",
        address: deploymentData.mockWBTC,
        constructorArgs: ["Wrapped Bitcoin", "WBTC", 8]
      });
    }

    if (deploymentData.mockOracle) {
      contracts.push({
        name: "MockChainlinkOracle",
        address: deploymentData.mockOracle,
        constructorArgs: [ethers.parseUnits("2000", 8), 8, "ETH/USD"]
      });
    }

    return contracts;
  }

  /**
   * @notice Auto-detect contracts from Beacon
   */
  private async buildContractsFromBeacon(): Promise<ContractInfo[]> {
    Logger.info("Auto-detecting contracts from Beacon");

    const contracts: ContractInfo[] = [];
    const beaconAddr = await this.contracts.beacon.getAddress();

    // Add Beacon itself
    contracts.push({
      name: "Beacon",
      address: beaconAddr,
      constructorArgs: []
    });

    // Get all registered modules
    const modules = [
      "TokenManager",
      "ParameterManager",
      "ValueCalculator",
      "ProxyGeneral",
      "LiquidityManager",
      "SwapManager",
      "EmergencyHandler"
    ];

    for (const moduleName of modules) {
      try {
        const moduleAddr = await this.contracts.beacon.getImplementation(moduleName);
        
        if (moduleAddr !== ethers.ZeroAddress) {
          contracts.push({
            name: moduleName,
            address: moduleAddr,
            constructorArgs: [beaconAddr]
          });
        }
      } catch (error) {
        Logger.warn(`Module ${moduleName} not found in Beacon`);
      }
    }

    return contracts;
  }

  /**
   * @notice Verify single contract with retry logic
   */
  private async verifyContract(contract: ContractInfo): Promise<void> {
    Logger.section(`VERIFYING ${contract.name.toUpperCase()}`);
    Logger.info(`Address: ${contract.address}`);
    Logger.info(`Constructor Args: ${JSON.stringify(contract.constructorArgs)}`);

    let attempts = 0;
    let success = false;
    let error = "";
    let alreadyVerified = false;

    while (attempts < this.verifyOptions.retry && !success) {
      attempts++;
      
      if (attempts > 1) {
        Logger.info(`Attempt ${attempts}/${this.verifyOptions.retry}...`);
      }

      try {
        await run("verify:verify", {
          address: contract.address,
          constructorArguments: contract.constructorArgs
        });

        success = true;
        Logger.success(`${contract.name} verified successfully`);

      } catch (err: any) {
        error = err.message;

        // Check if already verified
        if (error.includes("Already Verified") || error.includes("already verified")) {
          alreadyVerified = true;
          success = true;
          Logger.success(`${contract.name} already verified`);
        } else if (error.includes("rate limit")) {
          Logger.warn("Rate limit hit, waiting before retry...");
          await this.sleep(10000); // Wait 10s on rate limit
        } else {
          Logger.error(`Verification failed: ${error}`);
          
          if (attempts < this.verifyOptions.retry) {
            Logger.info("Retrying...");
            await this.sleep(3000);
          }
        }
      }
    }

    this.verificationResults.push({
      contract: contract.name,
      address: contract.address,
      success,
      error: success ? undefined : error,
      alreadyVerified
    });
  }

  /**
   * @notice Report verification results
   */
  private reportResults(): void {
    Logger.section("VERIFICATION RESULTS");

    const successful = this.verificationResults.filter(r => r.success);
    const failed = this.verificationResults.filter(r => !r.success);
    const alreadyVerified = this.verificationResults.filter(r => r.alreadyVerified);

    Logger.info(`Total Contracts: ${this.verificationResults.length}`);
    Logger.success(`Verified: ${successful.length}`);
    Logger.info(`Already Verified: ${alreadyVerified.length}`);
    if (failed.length > 0) {
      Logger.error(`Failed: ${failed.length}`);
    }

    if (failed.length > 0) {
      Logger.section("FAILED VERIFICATIONS");
      for (const result of failed) {
        Logger.error(`${result.contract} (${result.address}): ${result.error}`);
      }
    }

    if (successful.length === this.verificationResults.length) {
      Logger.success("\n✅ All contracts verified successfully!");
    }
  }

  /**
   * @notice Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Execute script
if (require.main === module) {
  const script = new VerifyContractsScript();
  script.execute()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
