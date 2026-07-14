async function main() {
    const hre = require("hardhat");
    const names = [
        "MorphoPlugin", "MorphoRegistry", "MorphoLensAdapter",
        "AaveV3Plugin", "SwapManager", "ProtocolManager", 
        "LiquidityManager", "FlashLoanService", "TokenManager",
        "ProxyGeneral", "EmergencyHandler", "ParameterManager"
    ];
    
    console.log("\n  CONTRACT BYTECODE SIZES (24,576 byte limit)\n");
    console.log("  " + "-".repeat(55));
    
    for (const n of names) {
        try {
            const art = await hre.artifacts.readArtifact(n);
            const sz = (art.deployedBytecode.length - 2) / 2;
            const pct = (sz / 24576 * 100).toFixed(1);
            const bar = "█".repeat(Math.round(sz / 24576 * 30));
            const warn = sz > 22000 ? " ⚠️" : sz > 20000 ? " ⚡" : "";
            console.log(`  ${n.padEnd(22)} ${String(sz).padStart(6)} bytes  ${pct.padStart(5)}%  ${bar}${warn}`);
        } catch(e) {}
    }
    
    console.log("  " + "-".repeat(55));
    console.log(`  Limit: 24,576 bytes (Spurious Dragon EIP-170)`);
    
    // Calculate headroom for MorphoPlugin
    try {
        const art = await hre.artifacts.readArtifact("MorphoPlugin");
        const sz = (art.deployedBytecode.length - 2) / 2;
        const headroom = 24576 - sz;
        console.log(`\n  MorphoPlugin headroom: ${headroom} bytes (${(headroom/24576*100).toFixed(1)}%)`);
        console.log(`  Approx functions that fit: ~${Math.floor(headroom / 400)} simple or ~${Math.floor(headroom / 800)} complex`);
    } catch(e) {}
}
main();
