/**
 * Decode WBTC Swap Failure
 * Analizza la transazione fallita per capire l'errore esatto
 */

import { ethers } from "hardhat";

const FAILED_TX_HASH = "0x43d2dd74584d88c6eeb402070f35ac197eaea663ce4dcedf2c82ad071877c6ef";

async function main() {
    console.log("🔍 Analyzing failed transaction\n");

    try {
        // Get transaction
        const tx = await ethers.provider.getTransaction(FAILED_TX_HASH);
        
        if (!tx) {
            console.log("❌ Transaction not found");
            return;
        }

        console.log("Transaction Details:");
        console.log(`  From: ${tx.from}`);
        console.log(`  To: ${tx.to}`);
        console.log(`  Value: ${ethers.formatEther(tx.value || 0n)} ETH`);
        console.log(`  Gas Limit: ${tx.gasLimit?.toString()}`);
        console.log(`  Gas Price: ${tx.gasPrice?.toString()}`);

        // Get receipt
        const receipt = await ethers.provider.getTransactionReceipt(FAILED_TX_HASH);
        
        if (!receipt) {
            console.log("❌ Receipt not found");
            return;
        }

        console.log("\nReceipt Details:");
        console.log(`  Status: ${receipt.status === 0 ? "❌ FAILED" : "✅ SUCCESS"}`);
        console.log(`  Block: ${receipt.blockNumber}`);
        console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`  Logs: ${receipt.logs.length}`);

        // Try to decode the revert reason
        console.log("\n🔍 Attempting to decode revert reason...\n");

        try {
            // Call the transaction to get revert reason
            const result = await ethers.provider.call({
                from: tx.from,
                to: tx.to,
                data: tx.data,
                value: tx.value,
                gasLimit: tx.gasLimit
            }, receipt.blockNumber - 1); // Call at previous block

            console.log("Result:", result);

        } catch (error: any) {
            if (error.data) {
                console.log("❌ Revert Data:", error.data);
                
                // Try to decode custom error
                try {
                    const swapManagerAbi = await ethers.getContractFactory("SwapManager");
                    const iface = swapManagerAbi.interface;
                    
                    // Try to parse error
                    const decoded = iface.parseError(error.data);
                    console.log("📝 Decoded Error:", decoded);
                } catch (e) {
                    console.log("⚠️  Could not decode with SwapManager interface");
                }
            }
            
            if (error.message) {
                console.log("❌ Error Message:", error.message);
            }

            if (error.reason) {
                console.log("📝 Revert Reason:", error.reason);
            }
        }

        // Try using debug_traceTransaction if available
        console.log("\n🔍 Attempting trace (may not work on all nodes)...\n");

        try {
            const trace = await ethers.provider.send("debug_traceTransaction", [
                FAILED_TX_HASH,
                { tracer: "callTracer" }
            ]);
            
            console.log("Trace Result:");
            console.log(JSON.stringify(trace, null, 2));
        } catch (error: any) {
            console.log("⚠️  Trace not available:", error.message.substring(0, 100));
        }

    } catch (error: any) {
        console.error("💥 Error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Script error:", error);
        process.exit(1);
    });
