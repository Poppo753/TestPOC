/**
 * @file deploy-morpho-plugin.ts
 * @description Deploy completo dei "3 Musketeers" Morpho Blue su Arbitrum:
 *              1. MorphoRegistry (configurazione mercati)
 *              2. MorphoPlugin (operazioni)
 *              3. MorphoLensAdapter (monitoring)
 * 
 * ORDINE CRITICO:
 * 1. Deploy Registry
 * 2. configureMarket() per ogni mercato supportato ← PRIMA di transferOwnership!
 * 3. Deploy Plugin (passa beacon)
 * 4. registry.transferOwnership(pluginAddress) ← Plugin diventa owner del Registry
 * 5. Deploy LensAdapter (passa beacon)
 * 6. Beacon.setImplementation() × 3 ← Registra tutti e 3
 * 7. ProxyGeneral.authorizeModule(plugin) ← Autorizza il Plugin a operare
 * 
 * USAGE:
 *   npx hardhat run scripts/deploy-morpho-plugin.ts --network arbitrum
 *   
 * DRY-RUN (fork locale):
 *   $env:FORK_ENABLED="true"; npx hardhat run scripts/deploy-morpho-plugin.ts --network hardhat
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ==================== CONFIGURAZIONE ====================

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

// Morpho Blue on Arbitrum (real address — canonical 0xBBBB... not deployed on Arb)
const MORPHO_ADDRESS = "0x6c247b1F6182318877311737BaC0844bAa518F5e";

// Token sottostanti su Arbitrum
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

// Morpho market params per WETH/USDC 86% LLTV su Arbitrum
// Ottenuti da Morpho Blue GraphQL API (blue-api.morpho.org)
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

// ==================== MAIN ====================

async function main() {
    console.log("\n🚀 Deploying Morpho Blue Plugin (3 Musketeers) to Arbitrum...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
    console.log("Network:", network.name, `(chainId: ${(await ethers.provider.getNetwork()).chainId})`);

    // ==================== STEP 1: Verifica Morpho Blue è attivo ====================

    console.log("\n📡 Verifying Morpho Blue on Arbitrum...");
    
    // Check if Morpho contract exists
    const morphoCode = await ethers.provider.getCode(MORPHO_ADDRESS);
    console.log(`   Morpho bytecode length: ${morphoCode.length}`);
    if (morphoCode === "0x") {
        console.log("   ⚠️  Morpho contract not found at current fork block. Skipping verification.");
    } else {
        const morpho = await ethers.getContractAt(
            [
                "function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)",
            ],
            MORPHO_ADDRESS
        );

        // Verify WETH/USDC market exists by computing and checking market ID
        for (const market of MARKETS) {
            const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "address", "address", "uint256"],
                [market.loanToken, market.collateralToken, market.oracle, market.irm, market.lltv]
            );
            const marketId = ethers.keccak256(encoded);
            try {
                const params = await morpho.idToMarketParams(marketId);
                if (params.loanToken.toLowerCase() === market.loanToken.toLowerCase()) {
                    console.log(`   ✅ ${market.collateralCode}/${market.loanCode}: verified (marketId: ${marketId.substring(0, 18)}...)`);
                } else {
                    console.log(`   ⚠️  ${market.collateralCode}/${market.loanCode}: params mismatch, market may not exist yet`);
                }
            } catch (e: any) {
                console.log(`   ⚠️  ${market.collateralCode}/${market.loanCode}: could not verify (${e.message?.substring(0, 60)})`);
            }
        }
    }

    // ==================== STEP 2: Deploy MorphoRegistry ====================

    console.log("\n📦 Step 1/6: Deploying MorphoRegistry...");
    const RegistryFactory = await ethers.getContractFactory("MorphoRegistry");
    const registry = await RegistryFactory.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log(`   ✅ MorphoRegistry deployed: ${registryAddress}`);

    // ==================== STEP 3: Configura markets NEL Registry ====================

    console.log("\n⚙️  Step 2/6: Configuring markets in Registry...");
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
        console.log(`   ✅ ${market.collateralCode}/${market.loanCode} configured (LLTV: ${Number(market.lltv) / 1e16}%)`);
    }

    // ==================== STEP 4: Deploy MorphoPlugin ====================

    console.log("\n📦 Step 3/6: Deploying MorphoPlugin...");
    const PluginFactory = await ethers.getContractFactory("MorphoPlugin");
    const plugin = await PluginFactory.deploy(BEACON);
    await plugin.waitForDeployment();
    const pluginAddress = await plugin.getAddress();
    console.log(`   ✅ MorphoPlugin deployed: ${pluginAddress}`);

    const pluginOwner = await plugin.owner();
    const pluginBeacon = await plugin.beacon();
    console.log(`   Owner: ${pluginOwner}`);
    console.log(`   Beacon: ${pluginBeacon}`);

    // ==================== STEP 5: Transfer Registry ownership al Plugin ====================

    console.log("\n🔑 Step 4/6: Transferring Registry ownership to Plugin...");
    const txTransfer = await registry.transferOwnership(pluginAddress);
    await txTransfer.wait();
    const newRegistryOwner = await registry.owner();
    console.log(`   ✅ Registry owner: ${newRegistryOwner}`);
    if (newRegistryOwner.toLowerCase() !== pluginAddress.toLowerCase()) {
        console.error("   ❌ ERRORE: ownership non trasferita correttamente!");
        process.exit(1);
    }

    // ==================== STEP 6: Deploy MorphoLensAdapter ====================

    console.log("\n📦 Step 5/6: Deploying MorphoLensAdapter...");
    const AdapterFactory = await ethers.getContractFactory("MorphoLensAdapter");
    const lensAdapter = await AdapterFactory.deploy(BEACON);
    await lensAdapter.waitForDeployment();
    const lensAdapterAddress = await lensAdapter.getAddress();
    console.log(`   ✅ MorphoLensAdapter deployed: ${lensAdapterAddress}`);

    // ==================== STEP 7: Registra nel Beacon ====================

    console.log("\n📝 Step 6/6: Registering in Beacon...");
    const beacon = await ethers.getContractAt(
        [
            "function updateImplementation(string memory module, address newImplementation) external",
            "function getImplementation(string memory name) view returns (address)",
            "function owner() view returns (address)",
        ],
        BEACON
    );

    const beaconOwner = await beacon.owner();
    console.log(`   Beacon owner: ${beaconOwner}`);

    if (beaconOwner.toLowerCase() === deployer.address.toLowerCase()) {
        await (await beacon.updateImplementation("MorphoRegistry", registryAddress)).wait();
        console.log(`   ✅ "MorphoRegistry" → ${registryAddress}`);

        await (await beacon.updateImplementation("MorphoPlugin", pluginAddress)).wait();
        console.log(`   ✅ "MorphoPlugin" → ${pluginAddress}`);

        await (await beacon.updateImplementation("MorphoLensAdapter", lensAdapterAddress)).wait();
        console.log(`   ✅ "MorphoLensAdapter" → ${lensAdapterAddress}`);

        // Verifica registrazione
        const regCheck = await beacon.getImplementation("MorphoPlugin");
        console.log(`   Verifica: beacon.get("MorphoPlugin") = ${regCheck}`);
    } else {
        console.log(`   ⚠️  Non sei il Beacon owner. Registrazione manuale necessaria:`);
        console.log(`      beacon.updateImplementation("MorphoRegistry", "${registryAddress}")`);
        console.log(`      beacon.updateImplementation("MorphoPlugin", "${pluginAddress}")`);
        console.log(`      beacon.updateImplementation("MorphoLensAdapter", "${lensAdapterAddress}")`);
    }

    // ==================== STEP 8: Autorizza Plugin in ProxyGeneral ====================

    console.log("\n🔓 Authorizing Plugin in ProxyGeneral...");
    try {
        const proxy = await ethers.getContractAt(
            [
                "function authorizeModule(address module, string memory name) external",
                "function owner() view returns (address)",
            ],
            PROXY_GENERAL
        );

        const proxyOwner = await proxy.owner();
        if (proxyOwner.toLowerCase() === deployer.address.toLowerCase()) {
            await (await proxy.authorizeModule(pluginAddress, "MorphoPlugin")).wait();
            console.log(`   ✅ MorphoPlugin autorizzato in ProxyGeneral`);
        } else {
            console.log(`   ⚠️  Non sei il ProxyGeneral owner. Autorizzazione manuale necessaria:`);
            console.log(`      proxyGeneral.authorizeModule("${pluginAddress}", "MorphoPlugin")`);
        }
    } catch (e: any) {
        console.log(`   ⚠️  ProxyGeneral non raggiungibile: ${e.message}`);
    }

    // ==================== STEP 9: Aggiorna file deployment ====================

    console.log("\n📁 Updating deployment file...");
    const deploymentPath = path.join(__dirname, "..", "deployments", "mainnet-latest.json");
    if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

        deployment.contracts.morphoPlugin = pluginAddress;
        deployment.contracts.morphoRegistry = registryAddress;
        deployment.contracts.morphoLensAdapter = lensAdapterAddress;
        deployment.timestamp = new Date().toISOString();

        deployment.MorphoPlugin = {
            address: pluginAddress,
            deployer: deployer.address,
            beacon: BEACON,
            morpho: MORPHO_ADDRESS,
            markets: MARKETS,
        };

        deployment.MorphoRegistry = {
            address: registryAddress,
            owner: pluginAddress,
            markets: MARKETS.map(m => `${m.collateralCode}/${m.loanCode}`),
        };

        deployment.MorphoLensAdapter = {
            address: lensAdapterAddress,
            beacon: BEACON,
        };

        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log(`   ✅ Updated ${deploymentPath}`);
    } else {
        // Salva come file separato
        const morphoDeployPath = path.join(__dirname, "..", "deployments", "morpho-deployment.json");
        const morphoDeployment = {
            timestamp: new Date().toISOString(),
            network: network.name,
            chainId: Number((await ethers.provider.getNetwork()).chainId),
            deployer: deployer.address,
            MorphoRegistry: { address: registryAddress, owner: pluginAddress, markets: MARKETS.map(m => `${m.collateralCode}/${m.loanCode}`) },
            MorphoPlugin: { address: pluginAddress, beacon: BEACON, morpho: MORPHO_ADDRESS },
            MorphoLensAdapter: { address: lensAdapterAddress, beacon: BEACON },
            marketConfigs: MARKETS,
        };
        fs.writeFileSync(morphoDeployPath, JSON.stringify(morphoDeployment, null, 2));
        console.log(`   ✅ Saved to ${morphoDeployPath}`);
    }

    // ==================== RIEPILOGO ====================

    console.log("\n" + "=".repeat(60));
    console.log("✅ DEPLOY MORPHO BLUE COMPLETATO!");
    console.log("=".repeat(60));
    console.log(`   MorphoRegistry:     ${registryAddress}`);
    console.log(`   MorphoPlugin:       ${pluginAddress}`);
    console.log(`   MorphoLensAdapter:  ${lensAdapterAddress}`);
    console.log(`   Markets configurati: [${MARKETS.map(m => `${m.collateralCode}/${m.loanCode}`).join(", ")}]`);
    console.log(`   Registry owner:     ${pluginAddress} (Plugin)`);
    console.log("=".repeat(60));

    console.log("\n📋 Checklist post-deploy:");
    console.log("   [1] Verifica Beacon registrations (beacon.getImplementation)");
    console.log("   [2] Verifica ProxyGeneral authorization");
    console.log("   [3] Verifica MorphoRegistry markets configuration");
    console.log("   [4] Test supplyCollateral + borrow su fork");
    console.log("   [5] Verifica health factor computation");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
