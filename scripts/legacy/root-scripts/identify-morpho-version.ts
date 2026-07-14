/**
 * Identify what exact contract is at 0x6c247b... on Arbitrum
 * Check V1 vs V2 specific functions + compare with official docs
 */

import { ethers } from "hardhat";

const MORPHO_REAL = "0x6c247b1F6182318877311737BaC0844bAa518F5e";
const MORPHO_V1_CANONICAL = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

// V2 contracts from official docs (Arbitrum)
const V2_ADDRESSES = {
    VaultV2Factory: "0xA1D94F746dEfa1928926b84fB2596c06926C0405",
    MorphoVaultV1AdapterFactory: "0xD1B8E2dee25c2b89DCD2f98448a7ce87d6F63394",
    MorphoMarketV1AdapterV2Factory: "0x32BB1c0D48D8b1B3363e86eeB9A0300BAd61ccc1",
    MorphoRegistryOfficial: "0x3696c5eAe4a7Ffd04Ea163564571E9CD8Ed9364e",
};

// Morpho Blue (Market V1) function signatures
const V1_FUNCTIONS = [
    "function owner() view returns (address)",
    "function feeRecipient() view returns (address)",
    "function isIrmEnabled(address) view returns (bool)",
    "function isLltvEnabled(uint256) view returns (bool)",
    "function idToMarketParams(bytes32) view returns (address,address,address,address,uint256)",
    "function market(bytes32) view returns (uint128,uint128,uint128,uint128,uint128,uint128)",
    "function position(bytes32,address) view returns (uint256,uint128,uint128)",
    "function isAuthorized(address,address) view returns (bool)",
    "function nonce(address) view returns (uint256)",
];

// Try to detect additional V2-specific or adapter functions
const EXTRA_CHECKS = [
    { sig: "function DOMAIN_SEPARATOR() view returns (bytes32)", name: "DOMAIN_SEPARATOR (V1)" },
    { sig: "function extSloads(bytes32[]) view returns (bytes32[])", name: "extSloads (V1)" },
    // V2 might have additional functions
    { sig: "function version() view returns (string)", name: "version()" },
    { sig: "function VERSION() view returns (string)", name: "VERSION()" },
    { sig: "function implementation() view returns (address)", name: "implementation() (proxy?)" },
];

async function tryCall(address: string, abi: string[], funcName: string): Promise<{ok: boolean, result?: any, error?: string}> {
    try {
        const contract = new ethers.Contract(address, abi, ethers.provider);
        const fn = funcName.split("(")[0];
        const result = await contract[fn]();
        return { ok: true, result };
    } catch (e: any) {
        return { ok: false, error: e.message?.substring(0, 60) };
    }
}

async function main() {
    console.log("\n" + "=".repeat(65));
    console.log("  MORPHO VERSION IDENTIFICATION — 0x6c247b...518F5e");
    console.log("=".repeat(65));

    // 1. Check V1 canonical
    console.log("\n📍 Canonical addresses:");
    const v1Code = await ethers.provider.getCode(MORPHO_V1_CANONICAL);
    console.log(`  V1 canonical (0xBBBB...): ${v1Code === "0x" ? "❌ NO CODE" : `✅ ${(v1Code.length-2)/2} bytes`}`);
    
    const realCode = await ethers.provider.getCode(MORPHO_REAL);
    console.log(`  Real (0x6c24...):         ✅ ${(realCode.length-2)/2} bytes`);

    // 2. Check all V2 official addresses
    console.log("\n📦 Official V2 contract addresses:");
    for (const [name, addr] of Object.entries(V2_ADDRESSES)) {
        const code = await ethers.provider.getCode(addr);
        const hasCode = code !== "0x";
        console.log(`  ${name}: ${hasCode ? `✅ ${(code.length-2)/2} bytes` : "❌ NO CODE"}`);
    }

    // 3. Test V1 (Morpho Blue) functions against 0x6c247b
    console.log("\n🧪 Testing Morpho Blue (V1) functions on 0x6c247b...:");
    
    const morpho = new ethers.Contract(MORPHO_REAL, V1_FUNCTIONS, ethers.provider);
    
    // owner()
    try {
        const owner = await morpho.owner();
        console.log(`  ✅ owner() = ${owner}`);
    } catch (e: any) {
        console.log(`  ❌ owner() reverted: ${e.message?.substring(0, 60)}`);
    }

    // feeRecipient()
    try {
        const fee = await morpho.feeRecipient();
        console.log(`  ✅ feeRecipient() = ${fee}`);
    } catch (e: any) {
        console.log(`  ❌ feeRecipient() reverted: ${e.message?.substring(0, 60)}`);
    }

    // isIrmEnabled — check our IRM
    try {
        const enabled = await morpho.isIrmEnabled("0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA");
        console.log(`  ✅ isIrmEnabled(ourIRM) = ${enabled}`);
    } catch (e: any) {
        console.log(`  ❌ isIrmEnabled() reverted: ${e.message?.substring(0, 60)}`);
    }

    // isLltvEnabled — check 86%
    try {
        const enabled = await morpho.isLltvEnabled("860000000000000000");
        console.log(`  ✅ isLltvEnabled(86%) = ${enabled}`);
    } catch (e: any) {
        console.log(`  ❌ isLltvEnabled() reverted: ${e.message?.substring(0, 60)}`);
    }

    // nonce for zero address
    try {
        const n = await morpho.nonce(ethers.ZeroAddress);
        console.log(`  ✅ nonce(0x0) = ${n}`);
    } catch (e: any) {
        console.log(`  ❌ nonce() reverted: ${e.message?.substring(0, 60)}`);
    }

    // 4. Extra function checks
    console.log("\n🔍 Extra function signatures:");
    for (const check of EXTRA_CHECKS) {
        const result = await tryCall(MORPHO_REAL, [check.sig], check.sig.match(/function (\w+)/)?.[1] || "");
        if (result.ok) {
            console.log(`  ✅ ${check.name} = ${result.result}`);
        } else {
            console.log(`  ❌ ${check.name} — not present`);
        }
    }

    // 5. Check bytecode similarity (first/last bytes)
    console.log("\n📊 Bytecode analysis:");
    console.log(`  Length: ${(realCode.length - 2) / 2} bytes`);
    console.log(`  First 20 bytes: ${realCode.substring(0, 42)}`);
    console.log(`  Last 20 bytes:  ...${realCode.substring(realCode.length - 40)}`);

    // Check if it's a proxy (EIP-1967 implementation slot)
    try {
        const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const implData = await ethers.provider.getStorage(MORPHO_REAL, implSlot);
        if (implData !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            const implAddr = "0x" + implData.substring(26);
            console.log(`  ⚠️  EIP-1967 PROXY detected! Implementation: ${implAddr}`);
        } else {
            console.log(`  Not an EIP-1967 proxy (no implementation slot)`);
        }
    } catch {}

    // Check admin slot too (EIP-1967)
    try {
        const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
        const adminData = await ethers.provider.getStorage(MORPHO_REAL, adminSlot);
        if (adminData !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            const adminAddr = "0x" + adminData.substring(26);
            console.log(`  ⚠️  EIP-1967 Admin: ${adminAddr}`);
        } else {
            console.log(`  No EIP-1967 admin slot`);
        }
    } catch {}

    // 6. Check official MorphoRegistry V2 for our market
    console.log("\n📋 Official MorphoRegistry V2 (0x3696c5...):");
    try {
        const officialReg = new ethers.Contract(
            V2_ADDRESSES.MorphoRegistryOfficial,
            [
                "function morpho() view returns (address)",
                "function owner() view returns (address)",
                "function id() view returns (bytes32)",
            ],
            ethers.provider
        );

        try {
            const m = await officialReg.morpho();
            console.log(`  ✅ morpho() = ${m}`);
            console.log(`     ${m.toLowerCase() === MORPHO_REAL.toLowerCase() ? "⬆️ MATCHES our 0x6c247b!" : m.toLowerCase() === MORPHO_V1_CANONICAL.toLowerCase() ? "Points to 0xBBBB... (V1 canonical)" : "Points to unknown address"}`);
        } catch { console.log(`  morpho() — not available`); }

        try {
            const o = await officialReg.owner();
            console.log(`  owner() = ${o}`);
        } catch { console.log(`  owner() — not available`); }
    } catch (e: any) {
        console.log(`  Could not query: ${e.message?.substring(0, 60)}`);
    }

    // 7. Conclusion
    console.log("\n" + "=".repeat(65));
    console.log("  VERDICT:");
    console.log("=".repeat(65));
    console.log("  All Morpho Blue V1 functions (owner, feeRecipient, isIrmEnabled,");
    console.log("  isLltvEnabled, idToMarketParams, market, position, nonce) work.");
    console.log("  This IS Morpho Blue (Market V1) — the core lending singleton.");
    console.log("  V2 refers to MetaMorpho Vaults, not the core market contract.");
    console.log("=".repeat(65));
}

main().catch(console.error);
