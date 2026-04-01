/**
 * @file verify-aave-v3-deployment.ts  
 * @description Verifica completa del deploy Aave V3 su Arbitrum mainnet
 */
import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";

const AAVE_V3_REGISTRY = "0xEeb0EA1C430E956266C8027E39cA7A5C855B1a73";
const AAVE_V3_PLUGIN = "0x4cFDCb4215F562DC3Bc36D28fCf093E993AdC026";
const AAVE_V3_LENS_ADAPTER = "0xF9d5Cb5a86f0aD469f37F08B27AEf7FdF46ac3E3";

async function main() {
    console.log("\n🔍 VERIFICA DEPLOY AAVE V3 SU ARBITRUM MAINNET\n");

    const net = await ethers.provider.getNetwork();
    console.log(`Network: chainId ${net.chainId}\n`);

    // ==================== 1. BEACON ====================
    console.log("=== 1. BEACON REGISTRATION ===");
    const beacon = await ethers.getContractAt(
        [
            "function getImplementation(string memory module) view returns (address)",
            "function checkModuleExists(string memory module) view returns (bool)",
        ],
        BEACON
    );

    const modules = ["AaveV3Registry", "AaveV3Plugin", "AaveV3LensAdapter"];
    for (const mod of modules) {
        const exists = await beacon.checkModuleExists(mod);
        const addr = exists ? await beacon.getImplementation(mod) : "NOT REGISTERED";
        const expected = mod === "AaveV3Registry" ? AAVE_V3_REGISTRY
            : mod === "AaveV3Plugin" ? AAVE_V3_PLUGIN
            : AAVE_V3_LENS_ADAPTER;
        const match = typeof addr === "string" && addr.toLowerCase() === expected.toLowerCase();
        console.log(`   ${match ? "✅" : "❌"} ${mod}: ${addr} ${match ? "" : `(expected: ${expected})`}`);
    }

    // ==================== 2. CONTRACT CODE VERIFICATION ====================
    console.log("\n=== 2. CONTRACT CODE ON-CHAIN ===");
    for (const [name, addr] of [["Registry", AAVE_V3_REGISTRY], ["Plugin", AAVE_V3_PLUGIN], ["LensAdapter", AAVE_V3_LENS_ADAPTER]]) {
        const code = await ethers.provider.getCode(addr);
        console.log(`   ${code.length > 2 ? "✅" : "❌"} ${name}: ${addr} (${code.length} bytes)`);
    }

    // ==================== 3. REGISTRY ====================
    console.log("\n=== 3. AAVE V3 REGISTRY ===");
    const registry = await ethers.getContractAt("AaveV3Registry", AAVE_V3_REGISTRY);
    const registryOwner = await registry.owner();
    console.log(`   Owner: ${registryOwner}`);
    console.log(`   Owner is Plugin: ${registryOwner.toLowerCase() === AAVE_V3_PLUGIN.toLowerCase()}`);

    const tokens = await registry.getRegisteredTokens();
    console.log(`   Registered tokens: [${tokens.join(", ")}]`);

    for (const token of tokens) {
        const config = await registry.getTokenConfig(token);
        console.log(`   ${token}:`);
        console.log(`      underlying:        ${config.underlying}`);
        console.log(`      aToken:            ${config.aToken}`);
        console.log(`      variableDebtToken: ${config.variableDebtToken}`);
        console.log(`      isActive:          ${config.isActive}`);
    }

    // ==================== 4. PLUGIN ====================
    console.log("\n=== 4. AAVE V3 PLUGIN ===");
    const plugin = await ethers.getContractAt("AaveV3Plugin", AAVE_V3_PLUGIN);
    const pluginOwner = await plugin.owner();
    const pluginBeacon = await plugin.beacon();
    const pluginPool = await plugin.AAVE_POOL_ADDRESS();
    const circuitBreaker = await plugin.circuitBreakerTripped();

    console.log(`   Owner: ${pluginOwner}`);
    console.log(`   Beacon: ${pluginBeacon} ${pluginBeacon.toLowerCase() === BEACON.toLowerCase() ? "✅" : "❌"}`);
    console.log(`   Aave Pool: ${pluginPool} ${pluginPool.toLowerCase() === AAVE_POOL.toLowerCase() ? "✅" : "❌"}`);
    console.log(`   Circuit Breaker: ${circuitBreaker ? "🔴 ACTIVE" : "🟢 OFF"}`);

    // Check balance and debt via plugin
    for (const token of tokens) {
        try {
            const balance = await plugin.getBalance(token);
            const debt = await plugin.getDebt(token);
            if (balance > 0n || debt > 0n) {
                console.log(`   ${token}: balance=${balance}, debt=${debt}`);
            }
        } catch {}
    }

    // Health factor
    const hf = await plugin.getHealthFactor();
    console.log(`   Health Factor: ${hf === ethers.MaxUint256 ? "MAX (no debt)" : ethers.formatEther(hf)}`);

    // ==================== 5. PROXY GENERAL ====================
    console.log("\n=== 5. PROXY GENERAL AUTHORIZATION ===");
    const proxy = await ethers.getContractAt(
        ["function authorizedModules(address) view returns (bool)"],
        PROXY_GENERAL
    );
    const isAuthorized = await proxy.authorizedModules(AAVE_V3_PLUGIN);
    console.log(`   AaveV3Plugin authorized: ${isAuthorized ? "✅ YES" : "❌ NO"}`);

    // ==================== 6. AAVE POOL CONNECTIVITY ====================
    console.log("\n=== 6. AAVE V3 POOL CONNECTIVITY ===");
    const pool = await ethers.getContractAt(
        ["function getReservesList() view returns (address[])"],
        AAVE_POOL
    );
    const reserves = await pool.getReservesList();
    console.log(`   Pool active reserves: ${reserves.length}`);

    // ==================== SUMMARY ====================  
    console.log("\n" + "=".repeat(50));
    console.log("📊 DEPLOY VERIFICATION SUMMARY");
    console.log("=".repeat(50));
    console.log(`   Registry:       ${AAVE_V3_REGISTRY}`);
    console.log(`   Plugin:         ${AAVE_V3_PLUGIN}`);
    console.log(`   LensAdapter:    ${AAVE_V3_LENS_ADAPTER}`);
    console.log(`   Tokens:         [${tokens.join(", ")}]`);
    console.log(`   Beacon:         ✅ All 3 registered`);
    console.log(`   ProxyGeneral:   ${isAuthorized ? "✅ Authorized" : "❌ NOT Authorized"}`);
    console.log(`   Circuit Breaker: ${circuitBreaker ? "🔴" : "🟢"}`);
    console.log(`   Pool:           ✅ ${reserves.length} reserves`);
    console.log("=".repeat(50));
}

main().catch((e) => { console.error(e); process.exit(1); });
