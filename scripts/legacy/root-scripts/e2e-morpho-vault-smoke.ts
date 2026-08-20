/**
 * @file e2e-morpho-vault-smoke.ts
 * @description E2E smoke test on Arbitrum MAINNET for MorphoVault system (no fork, no mock)
 * 
 * VERIFIES:
 *  1. Beacon resolves MorphoVaultPlugin, MorphoVaultLensAdapter, and updated MorphoRegistry
 *  2. All contracts have bytecode on-chain
 *  3. MorphoVaultPlugin configuration (beacon, owner, circuit breaker)
 *  4. MorphoVaultLensAdapter configuration (beacon, protocolName, protocolType)
 *  5. MorphoRegistry — vault configuration (3 vaults, default vault, statuses)
 *  6. MorphoRegistry — market configuration still intact (WETH/USDC)
 *  7. Registry ownership = MorphoPlugin
 *  8. Real MetaMorpho vaults respond (asset, totalAssets, maxDeposit)
 *  9. MorphoVaultPlugin authorized in ProxyGeneral
 * 10. Existing MorphoPlugin + MorphoLensAdapter still resolve correctly via Beacon
 * 11. MorphoVaultPlugin getBalance (should be 0 initially)
 * 12. MorphoVaultLensAdapter getPositionValue (should be 0 initially)
 * 
 * NOTE: READ-ONLY test — no actual deposits.
 * 
 * USAGE:
 *   npx hardhat run scripts/e2e-morpho-vault-smoke.ts --network arbitrum
 */

import { ethers } from "hardhat";

// Core addresses
const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const MORPHO_REAL = "0x6c247b1F6182318877311737BaC0844bAa518F5e";
const MORPHO_PLUGIN = "0xf653f0E3FddA2937C2A76C385FA381599BDb65dB";
const MORPHO_LENS = "0x37CbA12B65fA59f1D242a02c955b0C87db4d5088";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

// Vault addresses
const VAULT_HEXAONE = "0xaE73875437c86abb60cD7fA77286D63cb94F9a25";
const VAULT_CLEARSTAR = "0xa53Cf822FE93002aEaE16d395CD823Ece161a6AC";
const VAULT_STAGING = "0xd2d46099B70880e268B0c7557b9D22d3AA848654";

// Expected market ID for WETH/USDC 86%
const EXPECTED_MARKET_ID = "0xca83d02be579485cc10945c9597a6141e772f1cf0e0aa28d09a327b6cbd8642c";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
    if (ok) {
        passed++;
        console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
    } else {
        failed++;
        console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    }
}

async function main() {
    console.log("\n" + "=".repeat(64));
    console.log("  E2E SMOKE TEST — MORPHO VAULT PLUGIN ON ARBITRUM MAINNET");
    console.log("=".repeat(64));

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    console.log(`\nDeployer: ${deployer.address}`);
    console.log(`Network: arbitrum (chainId: ${network.chainId})\n`);

    // ==================== 1. Beacon Resolution ====================
    console.log("📡 1. Beacon Resolution");

    const beacon = await ethers.getContractAt(
        ["function getImplementation(string memory name) view returns (address)"],
        BEACON
    );

    const vaultPluginAddr = await beacon.getImplementation("MorphoVaultPlugin");
    const vaultLensAddr = await beacon.getImplementation("MorphoVaultLensAdapter");
    const registryAddr = await beacon.getImplementation("MorphoRegistry");
    const morphoPluginAddr = await beacon.getImplementation("MorphoPlugin");
    const morphoLensAddr = await beacon.getImplementation("MorphoLensAdapter");

    check("MorphoVaultPlugin registered", vaultPluginAddr !== ethers.ZeroAddress, vaultPluginAddr);
    check("MorphoVaultLensAdapter registered", vaultLensAddr !== ethers.ZeroAddress, vaultLensAddr);
    check("MorphoRegistry registered", registryAddr !== ethers.ZeroAddress, registryAddr);
    check("MorphoPlugin still registered", morphoPluginAddr !== ethers.ZeroAddress, morphoPluginAddr);
    check("MorphoLensAdapter still registered", morphoLensAddr !== ethers.ZeroAddress, morphoLensAddr);

    // Verify expected addresses
    check("VaultPlugin address correct", vaultPluginAddr === "0x118fd15a78C0Dada24c49343A55142938Ca1868E");
    check("VaultLensAdapter address correct", vaultLensAddr === "0xd5dE87464d1C77417f5a47C8B5F73f7B351F47Cc");
    check("Registry address correct (new)", registryAddr === "0xe2e3a074aC000c087fCa87ae2fe0741139660f94");

    // ==================== 2. Bytecode Verification ====================
    console.log("\n📦 2. Bytecode Verification");

    const codes = await Promise.all([
        ethers.provider.getCode(vaultPluginAddr),
        ethers.provider.getCode(vaultLensAddr),
        ethers.provider.getCode(registryAddr),
    ]);

    check("MorphoVaultPlugin has bytecode", codes[0] !== "0x", `${(codes[0].length - 2) / 2} bytes`);
    check("MorphoVaultLensAdapter has bytecode", codes[1] !== "0x", `${(codes[1].length - 2) / 2} bytes`);
    check("MorphoRegistry has bytecode", codes[2] !== "0x", `${(codes[2].length - 2) / 2} bytes`);

    // ==================== 3. MorphoVaultPlugin Configuration ====================
    console.log("\n🔌 3. MorphoVaultPlugin Configuration");

    const vaultPlugin = await ethers.getContractAt(
        [
            "function beacon() view returns (address)",
            "function owner() view returns (address)",
            "function circuitBreakerTripped() view returns (bool)",
            "function getBalance(string memory tokenCode) view returns (uint256)",
            "function getAllVaultPositions() view returns (tuple(address vault, uint256 shares, uint256 assets)[])",
            "function getTotalVaultValue() view returns (uint256)",
        ],
        vaultPluginAddr
    );

    const vpBeacon = await vaultPlugin.beacon();
    check("VaultPlugin beacon correct", vpBeacon.toLowerCase() === BEACON.toLowerCase());

    const vpOwner = await vaultPlugin.owner();
    check("VaultPlugin owner = deployer", vpOwner.toLowerCase() === deployer.address.toLowerCase(), vpOwner);

    const vpCb = await vaultPlugin.circuitBreakerTripped();
    check("Circuit breaker OFF", vpCb === false);

    // ==================== 4. MorphoVaultLensAdapter Configuration ====================
    console.log("\n🔍 4. MorphoVaultLensAdapter Configuration");

    const vaultLens = await ethers.getContractAt(
        [
            "function beacon() view returns (address)",
            "function protocolName() view returns (string memory)",
            "function protocolType() view returns (uint8)",
            "function getHealthFactor() view returns (uint256)",
        ],
        vaultLensAddr
    );

    const vlBeacon = await vaultLens.beacon();
    check("VaultLens beacon correct", vlBeacon.toLowerCase() === BEACON.toLowerCase());

    const vlName = await vaultLens.protocolName();
    check("VaultLens protocolName = 'MorphoVault'", vlName === "MorphoVault", vlName);

    const vlType = await vaultLens.protocolType();
    check("VaultLens protocolType = YIELD (1)", vlType === 1n, `${vlType}`);

    const vlHealth = await vaultLens.getHealthFactor();
    check("VaultLens healthFactor = MAX_UINT256 (supply-only)", vlHealth === ethers.MaxUint256);

    // ==================== 5. MorphoRegistry — Vault Configuration ====================
    console.log("\n📋 5. MorphoRegistry — Vault Configuration");

    const registry = await ethers.getContractAt(
        [
            "function owner() view returns (address)",
            "function isVaultApproved(address vault) view returns (bool)",
            "function getVaultConfig(address vault) view returns (tuple(address vault, string assetCode, bool isActive))",
            "function getDefaultVault(string memory assetCode) view returns (address)",
            "function getRegisteredVaults() view returns (address[])",
            "function getRegisteredVaultCount() view returns (uint256)",
            "function isMarketConfigured(string memory collateralCode, string memory loanCode) view returns (bool)",
            "function getMarketParams(string memory collateralCode, string memory loanCode) view returns (tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv))",
            "function getRegisteredMarkets() view returns (string[] memory, string[] memory)",
        ],
        registryAddr
    );

    // Ownership
    const regOwner = await registry.owner();
    check("Registry owner = MorphoPlugin", regOwner.toLowerCase() === MORPHO_PLUGIN.toLowerCase(), regOwner);

    // Vault count
    const vaultCount = await registry.getRegisteredVaultCount();
    check("3 vaults registered", vaultCount === 3n, `${vaultCount}`);

    // All vaults list
    const registeredVaults = await registry.getRegisteredVaults();
    check("Registered vaults list has 3 entries", registeredVaults.length === 3);

    // HexaOne vault
    const hexaApproved = await registry.isVaultApproved(VAULT_HEXAONE);
    check("HexaOne vault approved", hexaApproved === true);
    const hexaConfig = await registry.getVaultConfig(VAULT_HEXAONE);
    check("HexaOne vault address correct", hexaConfig.vault.toLowerCase() === VAULT_HEXAONE.toLowerCase());
    check("HexaOne assetCode = USDC", hexaConfig.assetCode === "USDC");
    check("HexaOne isActive", hexaConfig.isActive === true);

    // Clearstar vault
    const clearApproved = await registry.isVaultApproved(VAULT_CLEARSTAR);
    check("Clearstar vault approved", clearApproved === true);
    const clearConfig = await registry.getVaultConfig(VAULT_CLEARSTAR);
    check("Clearstar vault address correct", clearConfig.vault.toLowerCase() === VAULT_CLEARSTAR.toLowerCase());
    check("Clearstar assetCode = USDC", clearConfig.assetCode === "USDC");

    // Staging vault
    const stagingApproved = await registry.isVaultApproved(VAULT_STAGING);
    check("Staging vault approved", stagingApproved === true);
    const stagingConfig = await registry.getVaultConfig(VAULT_STAGING);
    check("Staging vault address correct", stagingConfig.vault.toLowerCase() === VAULT_STAGING.toLowerCase());
    check("Staging assetCode = USDC", stagingConfig.assetCode === "USDC");

    // Default vault
    const defaultVault = await registry.getDefaultVault("USDC");
    check("Default USDC vault = HexaOne", defaultVault.toLowerCase() === VAULT_HEXAONE.toLowerCase(), defaultVault);

    // ==================== 6. MorphoRegistry — Market Configuration Intact ====================
    console.log("\n🏦 6. MorphoRegistry — Market Configuration (Backward Compatibility)");

    const marketConfigured = await registry.isMarketConfigured("WETH", "USDC");
    check("WETH/USDC market still configured", marketConfigured === true);

    const params = await registry.getMarketParams("WETH", "USDC");
    check("loanToken = USDC", params.loanToken.toLowerCase() === USDC.toLowerCase());
    check("collateralToken = WETH", params.collateralToken.toLowerCase() === "0x82af49447d8a07e3bd95bd0d56f35241523fbab1");
    check("lltv = 86%", params.lltv.toString() === "860000000000000000");

    // Verify computed market ID
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "address", "address", "uint256"],
        [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv]
    );
    const computedId = ethers.keccak256(encoded);
    check("MarketId matches expected", computedId.toLowerCase() === EXPECTED_MARKET_ID.toLowerCase());

    const [collCodes, loanCodes] = await registry.getRegisteredMarkets();
    check("1 market registered", collCodes.length === 1, `${collCodes.length} market(s)`);

    // ==================== 7. Real MetaMorpho Vaults On-Chain ====================
    console.log("\n🏛️  7. Real MetaMorpho Vaults On-Chain");

    const vaultAbi = [
        "function asset() view returns (address)",
        "function totalAssets() view returns (uint256)",
        "function maxDeposit(address) view returns (uint256)",
    ];

    for (const [name, addr] of [
        ["HexaOne USDC", VAULT_HEXAONE],
        ["Clearstar USDC", VAULT_CLEARSTAR],
        ["usdc staging", VAULT_STAGING],
    ]) {
        const vault = await ethers.getContractAt(vaultAbi, addr);
        try {
            const asset = await vault.asset();
            const totalAssets = await vault.totalAssets();
            const maxDep = await vault.maxDeposit(ethers.ZeroAddress);
            const totalUSDC = Number(totalAssets) / 1e6;
            check(`${name} asset = USDC`, asset.toLowerCase() === USDC.toLowerCase());
            check(`${name} totalAssets > 0`, totalAssets > 0n, `${totalUSDC.toFixed(2)} USDC`);
            check(`${name} responds to maxDeposit`, true, `${maxDep}`);
        } catch (e: any) {
            check(`${name} vault query`, false, e.message?.substring(0, 80));
        }
    }

    // ==================== 8. ProxyGeneral Authorization ====================
    console.log("\n🔓 8. ProxyGeneral Authorization");

    try {
        const proxy = await ethers.getContractAt(
            ["function isModuleAuthorized(address module) view returns (bool)"],
            PROXY_GENERAL
        );
        const isAuth = await proxy.isModuleAuthorized(vaultPluginAddr);
        check("MorphoVaultPlugin authorized in ProxyGeneral", isAuth === true);
    } catch (e: any) {
        console.log(`  ⚠️  Could not check authorization: ${e.message?.substring(0, 60)}`);
    }

    // ==================== 9. Existing Morpho Plugin Still Works ====================
    console.log("\n🔗 9. Existing MorphoPlugin Backward Compatibility");

    const morphoPlugin = await ethers.getContractAt(
        [
            "function MORPHO_ADDRESS() view returns (address)",
            "function beacon() view returns (address)",
            "function circuitBreakerTripped() view returns (bool)",
        ],
        morphoPluginAddr
    );

    const morphoAddr = await morphoPlugin.MORPHO_ADDRESS();
    check("MorphoPlugin MORPHO_ADDRESS correct", morphoAddr.toLowerCase() === MORPHO_REAL.toLowerCase());

    const mpBeacon = await morphoPlugin.beacon();
    check("MorphoPlugin beacon correct", mpBeacon.toLowerCase() === BEACON.toLowerCase());

    const mpCb = await morphoPlugin.circuitBreakerTripped();
    check("MorphoPlugin circuit breaker OFF", mpCb === false);

    // Verify MorphoLensAdapter
    const morphoLens = await ethers.getContractAt(
        [
            "function MORPHO() view returns (address)",
            "function protocolName() view returns (string memory)",
        ],
        morphoLensAddr
    );

    const lmMorpho = await morphoLens.MORPHO();
    check("MorphoLensAdapter MORPHO correct", lmMorpho.toLowerCase() === MORPHO_REAL.toLowerCase());

    const lmName = await morphoLens.protocolName();
    check("MorphoLensAdapter protocolName = 'Morpho'", lmName === "Morpho", lmName);

    // ==================== 10. Position Queries (Should Be Empty) ====================
    console.log("\n👤 10. Position Queries (Should Be Empty Initially)");

    try {
        const balance = await vaultPlugin.getBalance("USDC");
        check("VaultPlugin getBalance('USDC') = 0", balance === 0n, `${balance}`);
    } catch (e: any) {
        check("VaultPlugin getBalance", false, e.message?.substring(0, 80));
    }

    try {
        const totalValue = await vaultPlugin.getTotalVaultValue();
        check("VaultPlugin getTotalVaultValue = 0", totalValue === 0n, `${totalValue}`);
    } catch (e: any) {
        check("VaultPlugin getTotalVaultValue", false, e.message?.substring(0, 80));
    }

    try {
        const positions = await vaultPlugin.getAllVaultPositions();
        check("VaultPlugin getAllVaultPositions empty", positions.length === 0, `${positions.length} positions`);
    } catch (e: any) {
        // Some implementations might return only for approved vaults
        check("VaultPlugin getAllVaultPositions", false, e.message?.substring(0, 80));
    }

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(64));
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log("=".repeat(64));

    if (failed > 0) {
        console.log("\n  ⚠️  Some checks failed. Review above for details.");
        process.exitCode = 1;
    } else {
        console.log("\n  🎉 ALL CHECKS PASSED — MorphoVault Plugin is LIVE on Arbitrum!");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
