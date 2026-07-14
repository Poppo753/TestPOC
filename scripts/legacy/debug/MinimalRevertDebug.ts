import { ethers } from "hardhat";

/**
 * MINIMAL REVERT DEBUG
 * 
 * Calls performSwap and catches EXACT revert reason
 */

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";

async function main() {
    console.log("=== MINIMAL REVERT DEBUG ===\n");

    const [owner] = await ethers.getSigners();
    const beacon = await ethers.getContractAt("Beacon", BEACON);
    const swapManagerAddress = await beacon.getImplementation("SwapManager");
    const swapManager = await ethers.getContractAt("SwapManager", swapManagerAddress);

    console.log(`SwapManager: ${swapManagerAddress}`);
    console.log(`Caller: ${owner.address}\n`);

    const params = {
        tokenFrom: "WETH",
        tokenTo: "USDC",
        amount: ethers.parseEther("0.0001"),
        deadline: Math.floor(Date.now() / 1000) + 1200
    };

    console.log("Attempting performSwap with:");
    console.log(`  From: ${params.tokenFrom}`);
    console.log(`  To: ${params.tokenTo}`);
    console.log(`  Amount: ${ethers.formatEther(params.amount)}`);
    console.log(`  Deadline: ${params.deadline}\n`);

    try {
        console.log("Calling static...");
        const result = await swapManager.performSwap.staticCall(
            params.tokenFrom,
            params.tokenTo,
            params.amount,
            params.deadline
        );
        console.log(`✅ SUCCESS! Would receive: ${result.toString()}`);
    } catch (error: any) {
        console.log("❌ FAILED!\n");
        console.log("Error Properties:");
        console.log(`  - message: ${error.message}`);
        console.log(`  - reason: ${error.reason || "N/A"}`);
        console.log(`  - code: ${error.code || "N/A"}`);
        console.log(`  - method: ${error.method || "N/A"}`);
        console.log(`  - data: ${error.data || "N/A"}`);
        
        // Try to decode custom errors
        if (error.data && error.data !== "0x") {
            console.log("\nAttempting to decode error data...");
            
            const errorSelectors = {
                "0x3204506f": "InsufficientBalance(uint256,uint256)",
                "0x13be252b": "InsufficientAllowance(uint256,uint256)",
                "0x5274afe7": "InvalidToken()",
                "0xd92e233d": "SwapFailed(string)",
                "0x0": "Generic revert"
            };
            
            const selector = error.data.slice(0, 10);
            console.log(`  Error selector: ${selector}`);
            
            if (errorSelectors[selector]) {
                console.log(`  Decoded: ${errorSelectors[selector]}`);
            } else {
                console.log(`  Unknown error signature`);
            }
            
            // Try parsing as string revert
            try {
                // Error(string) signature: 0x08c379a0
                if (selector === "0x08c379a0") {
                    const reason = ethers.AbiCoder.defaultAbiCoder().decode(
                        ["string"],
                        "0x" + error.data.slice(10)
                    )[0];
                    console.log(`  Revert reason: "${reason}"`);
                }
            } catch (e) {
                console.log(`  Could not parse as string revert`);
            }
        }
        
        // Show full error in JSON
        console.log("\nFull error object:");
        console.log(JSON.stringify({
            message: error.message,
            reason: error.reason,
            code: error.code,
            data: error.data
        }, null, 2));
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
