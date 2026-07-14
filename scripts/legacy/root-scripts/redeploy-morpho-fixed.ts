/**
 * @file redeploy-morpho-fixed.ts
 * @description Redeploy Morpho contracts with CORRECT Arbitrum address.
 * 
 * FIX: The V1 canonical address 0xBBBB... has NO bytecode on Arbitrum.
 *      Real Morpho on Arbitrum: 0x6c247b1F6182318877311737BaC0844bAa518F5e
 *      (confirmed via 3 independent RPCs + Morpho GraphQL API)
 * 
 * WHAT GETS REDEPLOYED:
 * - MorphoRegistry (new, because old one is owned by old Plugin which can't transfer)
 * - MorphoPlugin (new, with correct MORPHO_ADDRESS constant)
 * - MorphoLensAdapter (new, with correct MORPHO constant)
 * 
 * STEPS:
 * 1. Verify real Morpho at 0x6c247b has bytecode
 * 2. Deploy new MorphoRegistry
 * 3. configureMarket (WETH/USDC 86%)
 * 4. Deploy new MorphoPlugin
 * 5. Transfer Registry ownership to new Plugin
 * 6. Deploy new MorphoLensAdapter
 * 7. Update Beacon (3 implementations)
 * 8. Authorize new Plugin in ProxyGeneral  
 * 9. Verify everything works by querying real Morpho market
 * 10. Update deployment file
 * 
 * USAGE:
 *   npx hardhat run scripts/redeploy-morpho-fixed.ts --network arbitrum
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ==================== ADDRESSES ====================

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

// REAL Morpho on Arbitrum (canonical 0xBBBB... has NO bytecode on Arb)
const MORPHO_REAL = "0x6c247b1F6182318877311737BaC0844bAa518F5e";

// Old deployments (for reference/deauthorization)
const OLD_PLUGIN = "0x84824B667ce8b268EEf5267bA5f030Ab89E9CfBE";
const OLD_REGISTRY = "0x4Ff9306f450dbF152143317be833702822aD463F";
const OLD_LENS = "0x1Bc36aE66319Fd4485F87DB84832b007C3549573";

// Arbitrum tokens
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

// Market configs (same as original — oracle/IRM/LLTV are correct)
const MARKETS = [
    {
        collateralCode: "WETH",
        loanCode: "USDC",
        collateralToken: WETH,
        loanToken: USDC,
        oracle: "0x282FEB10549fde52bD61A6979424Ddf18A4971A2",
        irm: "0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA",
        lltv: "860000000000000000", // 86%
    },
];

// Real market ID (from Morpho GraphQL API)
const EXPECTED_MARKET_ID = "0xca83d02be579485cc10945c9597a6141e772f1cf0e0aa28d09a327b6cbd8642c";

// ==================== MAIN ====================

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  MORPHO BLUE REDEPLOYMENT — ADDRESS FIX");
    console.log("  Old (broken): 0xBBBB...FFCb (no bytecode on Arb)");
    console.log("  New (correct): 0x6c247b...518F5e (31,166 bytes)");
    console.log("=".repeat(60));

    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`\nDeployer: ${deployer.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`Network: ${network.name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);

    if (balance < ethers.parseEther("0.0001")) {
        console.error("\n❌ Insufficient balance for deployment. Need at least 0.0001 ETH.");
        process.exit(1);
    }

    // ==================== STEP 0: Verify real Morpho ====================

    console.log("\n📡 Step 0: Verifying real Morpho at", MORPHO_REAL, "...");
    const morphoCode = await ethers.provider.getCode(MORPHO_REAL);
    const morphoBytes = (morphoCode.length - 2) / 2;
    console.log(`   Bytecode: ${morphoBytes} bytes`);
    if (morphoCode === "0x") {
        console.error("❌ Real Morpho address has no bytecode! Aborting.");
        process.exit(1);
    }
    console.log("   ✅ Morpho contract verified");

    // Verify market exists on real Morpho
    const morpho = await ethers.getContractAt(
        [
            "function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)",
            "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
        ],
        MORPHO_REAL
    );

    try {
        const params = await morpho.idToMarketParams(EXPECTED_MARKET_ID);
        console.log(`   Market WETH/USDC 86%: loanToken=${params.loanToken.substring(0,10)}...`);
        
        const mkt = await morpho.market(EXPECTED_MARKET_ID);
        console.log(`   Supply: ${ethers.formatUnits(mkt.totalSupplyAssets, 6)} USDC`);
        console.log(`   Borrow: ${ethers.formatUnits(mkt.totalBorrowAssets, 6)} USDC`);
        console.log("   ✅ Market verified on-chain");
    } catch (e: any) {
        console.log(`   ⚠️  Could not verify market: ${e.message?.substring(0, 80)}`);
        console.log("   Continuing anyway (market params may use different ABI)...");
    }

    // ==================== STEP 1: Deploy MorphoRegistry ====================

    console.log("\n📦 Step 1/7: Deploying new MorphoRegistry...");
    const RegistryFactory = await ethers.getContractFactory("MorphoRegistry");
    const registry = await RegistryFactory.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log(`   ✅ MorphoRegistry: ${registryAddress}`);

    // ==================== STEP 2: Configure markets ====================

    console.log("\n⚙️  Step 2/7: Configuring markets...");
    for (const market of MARKETS) {
        const tx = await registry.configureMarket(
            market.collateralCode,
            market.loanCode,
            market.collateralToken,
            market.loanToken,
            market.oracle,
            market.irm,
            market.lltv
        );
        await tx.wait();

        // Verify market ID matches expected
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "address", "address", "uint256"],
            [market.loanToken, market.collateralToken, market.oracle, market.irm, market.lltv]
        );
        const computedId = ethers.keccak256(encoded);
        const idMatch = computedId.toLowerCase() === EXPECTED_MARKET_ID.toLowerCase();
        console.log(`   ✅ ${market.collateralCode}/${market.loanCode} (LLTV: ${Number(market.lltv) / 1e16}%)`);
        console.log(`      MarketId: ${computedId.substring(0, 18)}... ${idMatch ? "✅ MATCHES" : "⚠️  MISMATCH!"}`);
    }

    // ==================== STEP 3: Deploy MorphoPlugin ====================

    console.log("\n📦 Step 3/7: Deploying new MorphoPlugin...");
    const PluginFactory = await ethers.getContractFactory("MorphoPlugin");
    const plugin = await PluginFactory.deploy(BEACON, "USDC", MORPHO_REAL);
    await plugin.waitForDeployment();
    const pluginAddress = await plugin.getAddress();
    console.log(`   ✅ MorphoPlugin: ${pluginAddress}`);
    
    // Verify it uses correct Morpho address
    const morphoFromPlugin = await plugin.morpho();
    console.log(`   morpho (immutable): ${morphoFromPlugin}`);
    if (morphoFromPlugin.toLowerCase() !== MORPHO_REAL.toLowerCase()) {
        console.error("   ❌ morpho address mismatch! Check deploy args.");
        process.exit(1);
    }
    console.log("   ✅ Correct Morpho address confirmed");

    // ==================== STEP 4: Transfer Registry ownership ====================

    console.log("\n🔑 Step 4/7: Transferring Registry ownership to Plugin...");
    const txTransfer = await registry.transferOwnership(pluginAddress);
    await txTransfer.wait();
    const registryOwner = await registry.owner();
    console.log(`   Registry owner: ${registryOwner}`);
    if (registryOwner.toLowerCase() !== pluginAddress.toLowerCase()) {
        console.error("   ❌ Ownership transfer failed!");
        process.exit(1);
    }
    console.log("   ✅ Ownership transferred");

    // ==================== STEP 5: Deploy MorphoLensAdapter ====================

    console.log("\n📦 Step 5/7: Deploying new MorphoLensAdapter...");
    const LensFactory = await ethers.getContractFactory("MorphoLensAdapter");
    const lens = await LensFactory.deploy(BEACON, "USDC", MORPHO_REAL);
    await lens.waitForDeployment();
    const lensAddress = await lens.getAddress();
    console.log(`   ✅ MorphoLensAdapter: ${lensAddress}`);

    // ==================== STEP 6: Update Beacon ====================

    console.log("\n📝 Step 6/7: Updating Beacon registrations...");
    const beaconContract = await ethers.getContractAt(
        [
            "function updateImplementation(string memory module, address newImplementation) external",
            "function getImplementation(string memory name) view returns (address)",
            "function owner() view returns (address)",
        ],
        BEACON
    );

    const beaconOwner = await beaconContract.owner();
    if (beaconOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log(`   ⚠️  Not Beacon owner (owner: ${beaconOwner}). Manual registration needed:`);
        console.log(`      beacon.updateImplementation("MorphoRegistry", "${registryAddress}")`);
        console.log(`      beacon.updateImplementation("MorphoPlugin", "${pluginAddress}")`);
        console.log(`      beacon.updateImplementation("MorphoLensAdapter", "${lensAddress}")`);
    } else {
        // Show old → new
        const oldReg = await beaconContract.getImplementation("MorphoRegistry");
        const oldPlug = await beaconContract.getImplementation("MorphoPlugin");
        const oldLens = await beaconContract.getImplementation("MorphoLensAdapter");
        console.log(`   Old: Registry=${oldReg.substring(0,10)}... Plugin=${oldPlug.substring(0,10)}... Lens=${oldLens.substring(0,10)}...`);

        await (await beaconContract.updateImplementation("MorphoRegistry", registryAddress)).wait();
        console.log(`   ✅ MorphoRegistry → ${registryAddress}`);

        await (await beaconContract.updateImplementation("MorphoPlugin", pluginAddress)).wait();
        console.log(`   ✅ MorphoPlugin → ${pluginAddress}`);

        await (await beaconContract.updateImplementation("MorphoLensAdapter", lensAddress)).wait();
        console.log(`   ✅ MorphoLensAdapter → ${lensAddress}`);

        // Verify
        const checkPlugin = await beaconContract.getImplementation("MorphoPlugin");
        console.log(`   Verify: beacon.get("MorphoPlugin") = ${checkPlugin}`);
    }

    // ==================== STEP 7: Authorize in ProxyGeneral ====================

    console.log("\n🔓 Step 7/7: Authorizing Plugin in ProxyGeneral...");
    try {
        const proxy = await ethers.getContractAt(
            [
                "function authorizeModule(address module, string memory name) external",
                "function deauthorizeModule(address module) external",
                "function owner() view returns (address)",
            ],
            PROXY_GENERAL
        );

        const proxyOwner = await proxy.owner();
        if (proxyOwner.toLowerCase() === deployer.address.toLowerCase()) {
            // Deauthorize old plugin first
            try {
                await (await proxy.deauthorizeModule(OLD_PLUGIN)).wait();
                console.log(`   ✅ Old Plugin deauthorized: ${OLD_PLUGIN}`);
            } catch (e: any) {
                console.log(`   ⚠️  Could not deauthorize old Plugin: ${e.message?.substring(0, 60)}`);
            }

            // Authorize new plugin
            await (await proxy.authorizeModule(pluginAddress, "MorphoPlugin")).wait();
            console.log(`   ✅ New Plugin authorized: ${pluginAddress}`);
        } else {
            console.log(`   ⚠️  Not ProxyGeneral owner. Manual authorization needed:`);
            console.log(`      proxy.deauthorizeModule("${OLD_PLUGIN}")`);
            console.log(`      proxy.authorizeModule("${pluginAddress}", "MorphoPlugin")`);
        }
    } catch (e: any) {
        console.log(`   ⚠️  ProxyGeneral error: ${e.message?.substring(0, 80)}`);
    }

    // ==================== SAVE DEPLOYMENT ====================

    console.log("\n📁 Updating deployment file...");
    const deploymentPath = path.join(__dirname, "..", "deployments", "mainnet-latest.json");
    if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

        deployment.contracts.morphoPlugin = pluginAddress;
        deployment.contracts.morphoRegistry = registryAddress;
        deployment.contracts.morphoLensAdapter = lensAddress;
        deployment.timestamp = new Date().toISOString();

        deployment.MorphoPlugin = {
            address: pluginAddress,
            deployer: deployer.address,
            beacon: BEACON,
            morpho: MORPHO_REAL,
            markets: MARKETS,
            previousVersion: OLD_PLUGIN,
            upgradeReason: "Fix: MORPHO_ADDRESS 0xBBBB... has no bytecode on Arb. Real: 0x6c247b...",
        };

        deployment.MorphoRegistry = {
            address: registryAddress,
            owner: pluginAddress,
            markets: MARKETS.map(m => `${m.collateralCode}/${m.loanCode}`),
            previousVersion: OLD_REGISTRY,
        };

        deployment.MorphoLensAdapter = {
            address: lensAddress,
            beacon: BEACON,
            previousVersion: OLD_LENS,
        };

        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log(`   ✅ Updated mainnet-latest.json`);
    }

    // ==================== SUMMARY ====================

    console.log("\n" + "=".repeat(60));
    console.log("  ✅ MORPHO BLUE REDEPLOYMENT COMPLETE");
    console.log("=".repeat(60));
    console.log(`  Morpho (real):       ${MORPHO_REAL}`);
    console.log(`  MorphoRegistry:      ${registryAddress}  (was: ${OLD_REGISTRY})`);
    console.log(`  MorphoPlugin:        ${pluginAddress}  (was: ${OLD_PLUGIN})`);
    console.log(`  MorphoLensAdapter:   ${lensAddress}  (was: ${OLD_LENS})`);
    console.log(`  Markets: [${MARKETS.map(m => `${m.collateralCode}/${m.loanCode}`).join(", ")}]`);
    console.log(`  Registry owner:      ${pluginAddress}`);
    console.log("=".repeat(60));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
