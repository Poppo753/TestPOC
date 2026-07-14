/**
 * Check circuit breaker status
 */

import { ethers } from "hardhat";

const NEW_PLUGIN = "0x490139F3b29786D64056a236a0062CA23A7313f6";

async function main() {
    console.log("\n🔍 Checking circuit breaker...\n");
    
    const plugin = await ethers.getContractAt(
        ["function circuitBroken() view returns (bool)"],
        NEW_PLUGIN
    );
    
    const isBroken = await plugin.circuitBroken();
    
    console.log(`Circuit Breaker Status: ${isBroken ? '🔴 BROKEN (BLOCKED)' : '🟢 OK'}\n`);
    
    if (isBroken) {
        console.log(`⚠️  The circuit breaker is active - this blocks all operations!`);
        console.log(`   Need to call resetCircuitBreaker() to fix.\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
