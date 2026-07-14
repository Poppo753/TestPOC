/**
 * 🎯 REGISTER IMPLEMENTATIONS IN BEACON
 * 
 * Script per registrare tutte le implementazioni dei contratti nel Beacon.
 * Deve essere eseguito DOPO il deployment dei moduli.
 * 
 * PREREQUISITI:
 * - Beacon deployato
 * - Tutti i moduli deployati
 * - Addresses configurati in .env
 * 
 * USAGE:
 *   npx hardhat run scripts/admin/beacon/RegisterImplementations.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { Logger } from "../../config/config";

interface ImplementationConfig {
    name: string;
    envVar: string;
    description: string;
}

const IMPLEMENTATIONS: ImplementationConfig[] = [
    {
        name: "TokenManager",
        envVar: "TOKEN_MANAGER_ADDRESS",
        description: "Token registry and oracle management"
    },
    {
        name: "SwapManager",
        envVar: "SWAP_MANAGER_ADDRESS",
        description: "DEX routing and swap execution"
    },
    {
        name: "ValueCalculator",
        envVar: "VALUE_CALCULATOR_ADDRESS",
        description: "Pool valuation and LP token pricing"
    },
    {
        name: "ParameterManager",
        envVar: "PARAMETER_MANAGER_ADDRESS",
        description: "System parameters and configuration"
    },
    {
        name: "EmergencyHandler",
        envVar: "EMERGENCY_HANDLER_ADDRESS",
        description: "Emergency pause and recovery"
    },
    {
        name: "LiquidityManager",
        envVar: "LIQUIDITY_MANAGER_ADDRESS",
        description: "Deposit/withdraw and liquidity management"
    }
];

async function main() {
    Logger.section("REGISTER IMPLEMENTATIONS IN BEACON");

    // Get deployer
    const [deployer] = await ethers.getSigners();
    Logger.info(`Using account: ${deployer.address}`);
    Logger.info(`Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

    // Get Beacon address
    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress || !ethers.isAddress(beaconAddress)) {
        throw new Error("BEACON_ADDRESS not configured in .env!");
    }

    Logger.info(`Beacon address: ${beaconAddress}\n`);

    // Connect to Beacon
    const beacon = await ethers.getContractAt("Beacon", beaconAddress);

    // Verify beacon ownership
    try {
        const owner = await beacon.owner();
        if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
            Logger.warn(`⚠️ Warning: Deployer is not Beacon owner!`);
            Logger.warn(`   Beacon owner: ${owner}`);
            Logger.warn(`   Current account: ${deployer.address}\n`);
        }
    } catch (error) {
        Logger.warn("⚠️ Could not verify Beacon ownership\n");
    }

    Logger.section("REGISTERING IMPLEMENTATIONS");

    let successCount = 0;
    let failCount = 0;

    for (const impl of IMPLEMENTATIONS) {
        Logger.info(`\n📝 Registering ${impl.name}...`);
        Logger.info(`   ${impl.description}`);

        // Get address from env
        const address = process.env[impl.envVar];
        
        if (!address || !ethers.isAddress(address)) {
            Logger.error(`   ❌ ${impl.envVar} not configured or invalid!`);
            failCount++;
            continue;
        }

        Logger.info(`   Address: ${address}`);

        // Verify contract exists
        const code = await deployer.provider.getCode(address);
        if (code === "0x") {
            Logger.error(`   ❌ No contract found at ${address}!`);
            failCount++;
            continue;
        }

        // Check if already registered
        try {
            const currentImpl = await beacon.getImplementation(impl.name);
            if (currentImpl.toLowerCase() === address.toLowerCase()) {
                Logger.success(`   ✅ Already registered`);
                successCount++;
                continue;
            }
        } catch (error) {
            // Not registered yet, continue
        }

        // Register implementation
        try {
            const tx = await beacon.updateImplementation(impl.name, address);
            Logger.info(`   Transaction: ${tx.hash}`);
            
            const receipt = await tx.wait();
            Logger.success(`   ✅ Registered successfully (block ${receipt!.blockNumber})`);
            Logger.info(`   Gas used: ${receipt!.gasUsed.toString()}`);
            successCount++;
        } catch (error: any) {
            Logger.error(`   ❌ Registration failed: ${error.message}`);
            failCount++;
        }
    }

    // Summary
    Logger.section("REGISTRATION SUMMARY");
    Logger.info(`Total implementations: ${IMPLEMENTATIONS.length}`);
    Logger.success(`✅ Successfully registered: ${successCount}`);
    if (failCount > 0) {
        Logger.error(`❌ Failed: ${failCount}`);
    }

    // Verify all registrations
    if (successCount === IMPLEMENTATIONS.length) {
        Logger.section("VERIFICATION");
        Logger.info("Verifying all implementations...\n");

        for (const impl of IMPLEMENTATIONS) {
            const address = process.env[impl.envVar];
            if (address) {
                try {
                    const registered = await beacon.getImplementation(impl.name);
                    if (registered.toLowerCase() === address.toLowerCase()) {
                        Logger.success(`✅ ${impl.name}: ${registered}`);
                    } else {
                        Logger.error(`❌ ${impl.name}: Mismatch!`);
                        Logger.error(`   Expected: ${address}`);
                        Logger.error(`   Got: ${registered}`);
                    }
                } catch (error: any) {
                    Logger.error(`❌ ${impl.name}: ${error.message}`);
                }
            }
        }

        Logger.section("✅ REGISTRATION COMPLETED SUCCESSFULLY");
        Logger.info("\nNext steps:");
        Logger.info("1. Add tokens using AddToken.ts");
        Logger.info("2. Configure system parameters");
        Logger.info("3. Test deposits/withdrawals");
        Logger.info("4. Transfer ownership to multi-sig\n");
    } else {
        Logger.section("⚠️ REGISTRATION INCOMPLETE");
        Logger.warn("Some implementations failed to register.");
        Logger.warn("Check errors above and retry.\n");
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Registration script failed:", error);
        process.exit(1);
    });
