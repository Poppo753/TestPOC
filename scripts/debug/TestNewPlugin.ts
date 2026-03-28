import { ethers } from "hardhat";

async function main() {
    console.log("Testing new plugin direct call...\n");

    const PLUGIN_ADDRESS = "0xF222789984D039061a71862b103b6FA5f5362968";
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

    try {
        const plugin = await ethers.getContractAt("UniswapV3PluginDirect", PLUGIN_ADDRESS);
        
        console.log("Plugin address:", PLUGIN_ADDRESS);
        
        // Test getProtocolInfo
        const info = await plugin.getProtocolInfo();
        console.log(`\nProtocol: ${info.name} v${info.version}`);
        console.log(`Features: ${info.features}`);
        
        // Test isHealthy
        const [healthy, reason] = await plugin.isHealthy();
        console.log(`\nHealth: ${healthy ? "✅" : "❌"}`);
        if (reason) console.log(`Reason: ${reason}`);
        
        // Test getExpectedOutput
        console.log("\nTesting getExpectedOutput...");
        const output = await plugin.getExpectedOutput(
            WETH,
            USDC,
            ethers.parseEther("0.0001")
        );
        console.log(`Expected output: ${output.toString()} USDC`);
        
        console.log("\n✅ Plugin is working!");
        
    } catch (error: any) {
        console.error("❌ Error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch(console.error);
