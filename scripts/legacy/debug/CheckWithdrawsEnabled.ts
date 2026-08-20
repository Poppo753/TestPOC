import { ethers } from "hardhat";
import { getAllContracts } from "../config/config";

async function main() {
    console.log("\n🔍 CHECKING WITHDRAWS ENABLED STATUS\n");
    
    const contracts = await getAllContracts();
    const liquidityManager = contracts.liquidityManager;
    
    console.log(`LiquidityManager address: ${await liquidityManager.getAddress()}`);
    
    try {
        const withdrawsEnabled = await liquidityManager.withdrawsEnabled();
        console.log(`✅ withdrawsEnabled() returned: ${withdrawsEnabled}`);
    } catch (error: any) {
        console.log(`❌ Error calling withdrawsEnabled(): ${error.message}`);
        
        // Try calling with staticCall to see raw result
        try {
            const result = await liquidityManager.withdrawsEnabled.staticCall();
            console.log(`Static call result: ${result}`);
        } catch (staticError: any) {
            console.log(`Static call also failed: ${staticError.message}`);
        }
    }
    
    // Try to check if the function exists in the ABI
    const abi = liquidityManager.interface;
    const hasFunction = abi.fragments.some((f: any) => f.name === 'withdrawsEnabled');
    console.log(`\n📋 Function 'withdrawsEnabled' in ABI: ${hasFunction}`);
    
    // List all public state variables
    console.log(`\n📋 Available view functions:`);
    abi.fragments.forEach((f: any) => {
        if (f.type === 'function' && f.stateMutability === 'view') {
            console.log(`   - ${f.name}()`);
        }
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
