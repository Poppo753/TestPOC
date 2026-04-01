/**
 * @file deploy-aave-v3-plugin.ts
 * @description Deploy completo dei "3 Musketeers" Aave V3 su Arbitrum:
 *              1. AaveV3Registry (configurazione token)
 *              2. AaveV3Plugin (operazioni)
 *              3. AaveV3LensAdapter (monitoring)
 * 
 * ORDINE CRITICO:
 * 1. Deploy Registry
 * 2. configureToken() per ogni token supportato ← PRIMA di transferOwnership!
 * 3. Deploy Plugin
 * 4. registry.transferOwnership(pluginAddress) ← Plugin diventa owner del Registry
 * 5. Deploy LensAdapter
 * 6. Beacon.setImplementation() × 3 ← Registra tutti e 3
 * 7. ProxyGeneral.authorizeModule(plugin) ← Autorizza il Plugin a operare
 * 
 * USAGE:
 *   npx hardhat run scripts/deploy-aave-v3-plugin.ts --network arbitrum
 *   
 * DRY-RUN (fork locale):
 *   $env:FORK_ENABLED="true"; npx hardhat run scripts/deploy-aave-v3-plugin.ts --network hardhat
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ==================== CONFIGURAZIONE ====================

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

// Aave V3 Pool su Arbitrum (entry point per tutte le operazioni)
const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";

// Token sottostanti su Arbitrum
const TOKENS = {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",  // Native USDC
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
};

// ==================== MAIN ====================

async function main() {
    console.log("\n🚀 Deploying Aave V3 Plugin (3 Musketeers) to Arbitrum...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
    console.log("Network:", network.name, `(chainId: ${(await ethers.provider.getNetwork()).chainId})`);

    // ==================== STEP 1: Auto-discover aToken/debtToken da Aave Pool ====================

    console.log("\n📡 Querying Aave V3 Pool per aToken e debtToken addresses...");
    const pool = await ethers.getContractAt(
        [
            "function getReserveAToken(address asset) view returns (address)",
            "function getReserveVariableDebtToken(address asset) view returns (address)",
        ],
        AAVE_POOL
    );

    type TokenConfig = { underlying: string; aToken: string; variableDebtToken: string };
    const tokenConfigs: Record<string, TokenConfig> = {};

    for (const [code, underlying] of Object.entries(TOKENS)) {
        try {
            const aToken = await pool.getReserveAToken(underlying);
            const variableDebtToken = await pool.getReserveVariableDebtToken(underlying);

            if (aToken === ethers.ZeroAddress || variableDebtToken === ethers.ZeroAddress) {
                console.log(`   ⚠️  ${code}: reserve non trovata nel Pool, skip`);
                continue;
            }

            tokenConfigs[code] = { underlying, aToken, variableDebtToken };
            console.log(`   ✅ ${code}:`);
            console.log(`      underlying:        ${underlying}`);
            console.log(`      aToken:            ${aToken}`);
            console.log(`      variableDebtToken: ${variableDebtToken}`);
        } catch (e: any) {
            console.log(`   ⚠️  ${code}: query fallita (${e.message}), skip`);
        }
    }

    if (Object.keys(tokenConfigs).length === 0) {
        console.error("\n❌ Nessun token configurato! Verifica la connessione alla rete.");
        process.exit(1);
    }

    // ==================== STEP 2: Deploy AaveV3Registry ====================

    console.log("\n📦 Step 1/6: Deploying AaveV3Registry...");
    const RegistryFactory = await ethers.getContractFactory("AaveV3Registry");
    const registry = await RegistryFactory.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log(`   ✅ AaveV3Registry deployed: ${registryAddress}`);

    // ==================== STEP 3: Configura token NEL Registry (PRIMA di transferOwnership!) ====================

    console.log("\n⚙️  Step 2/6: Configuring tokens in Registry...");
    for (const [code, config] of Object.entries(tokenConfigs)) {
        const tx = await registry.configureToken(
            code,
            config.underlying,
            config.aToken,
            config.variableDebtToken
        );
        await tx.wait();
        console.log(`   ✅ ${code} configurato`);
    }

    // Verifica configurazione
    const registeredTokens = await registry.getRegisteredTokens();
    console.log(`   Tokens registrati: [${registeredTokens.join(", ")}]`);

    // ==================== STEP 4: Deploy AaveV3Plugin ====================

    console.log("\n📦 Step 3/6: Deploying AaveV3Plugin...");
    const PluginFactory = await ethers.getContractFactory("AaveV3Plugin");
    const plugin = await PluginFactory.deploy(BEACON);
    await plugin.waitForDeployment();
    const pluginAddress = await plugin.getAddress();
    console.log(`   ✅ AaveV3Plugin deployed: ${pluginAddress}`);

    // Verifica
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

    // ==================== STEP 6: Deploy AaveV3LensAdapter ====================

    console.log("\n📦 Step 5/6: Deploying AaveV3LensAdapter...");
    const AdapterFactory = await ethers.getContractFactory("AaveV3LensAdapter");
    const lensAdapter = await AdapterFactory.deploy(BEACON);
    await lensAdapter.waitForDeployment();
    const lensAdapterAddress = await lensAdapter.getAddress();
    console.log(`   ✅ AaveV3LensAdapter deployed: ${lensAdapterAddress}`);

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
        await (await beacon.updateImplementation("AaveV3Registry", registryAddress)).wait();
        console.log(`   ✅ "AaveV3Registry" → ${registryAddress}`);

        await (await beacon.updateImplementation("AaveV3Plugin", pluginAddress)).wait();
        console.log(`   ✅ "AaveV3Plugin" → ${pluginAddress}`);

        await (await beacon.updateImplementation("AaveV3LensAdapter", lensAdapterAddress)).wait();
        console.log(`   ✅ "AaveV3LensAdapter" → ${lensAdapterAddress}`);

        // Verifica registrazione
        const regCheck = await beacon.getImplementation("AaveV3Plugin");
        console.log(`   Verifica: beacon.get("AaveV3Plugin") = ${regCheck}`);
    } else {
        console.log(`   ⚠️  Non sei il Beacon owner. Registrazione manuale necessaria:`);
        console.log(`      beacon.updateImplementation("AaveV3Registry", "${registryAddress}")`);
        console.log(`      beacon.updateImplementation("AaveV3Plugin", "${pluginAddress}")`);
        console.log(`      beacon.updateImplementation("AaveV3LensAdapter", "${lensAdapterAddress}")`);
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
            await (await proxy.authorizeModule(pluginAddress, "AaveV3Plugin")).wait();
            console.log(`   ✅ AaveV3Plugin autorizzato in ProxyGeneral`);
        } else {
            console.log(`   ⚠️  Non sei il ProxyGeneral owner. Autorizzazione manuale necessaria:`);
            console.log(`      proxyGeneral.authorizeModule("${pluginAddress}", "AaveV3Plugin")`);
        }
    } catch (e: any) {
        console.log(`   ⚠️  ProxyGeneral non raggiungibile: ${e.message}`);
    }

    // ==================== STEP 9: Aggiorna file deployment ====================

    console.log("\n📁 Updating deployment file...");
    const deploymentPath = path.join(__dirname, "..", "deployments", "mainnet-latest.json");
    if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

        deployment.contracts.aaveV3Plugin = pluginAddress;
        deployment.contracts.aaveV3Registry = registryAddress;
        deployment.contracts.aaveV3LensAdapter = lensAdapterAddress;
        deployment.timestamp = new Date().toISOString();

        deployment.AaveV3Plugin = {
            address: pluginAddress,
            deployer: deployer.address,
            beacon: BEACON,
            pool: AAVE_POOL,
            tokens: tokenConfigs,
        };

        deployment.AaveV3Registry = {
            address: registryAddress,
            owner: pluginAddress,
            tokens: Object.keys(tokenConfigs),
        };

        deployment.AaveV3LensAdapter = {
            address: lensAdapterAddress,
            beacon: BEACON,
        };

        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log(`   ✅ Updated ${deploymentPath}`);
    } else {
        console.log(`   ⚠️  File deployment non trovato, salva manualmente:`);

        // Salva come file separato
        const aaveDeployPath = path.join(__dirname, "..", "deployments", "aave-v3-deployment.json");
        const aaveDeployment = {
            timestamp: new Date().toISOString(),
            network: network.name,
            chainId: Number((await ethers.provider.getNetwork()).chainId),
            deployer: deployer.address,
            AaveV3Registry: { address: registryAddress, owner: pluginAddress, tokens: Object.keys(tokenConfigs) },
            AaveV3Plugin: { address: pluginAddress, beacon: BEACON, pool: AAVE_POOL },
            AaveV3LensAdapter: { address: lensAdapterAddress, beacon: BEACON },
            tokenConfigs,
        };
        fs.writeFileSync(aaveDeployPath, JSON.stringify(aaveDeployment, null, 2));
        console.log(`   ✅ Saved to ${aaveDeployPath}`);
    }

    // ==================== RIEPILOGO ====================

    console.log("\n" + "=".repeat(60));
    console.log("✅ DEPLOY AAVE V3 COMPLETATO!");
    console.log("=".repeat(60));
    console.log(`   AaveV3Registry:     ${registryAddress}`);
    console.log(`   AaveV3Plugin:       ${pluginAddress}`);
    console.log(`   AaveV3LensAdapter:  ${lensAdapterAddress}`);
    console.log(`   Tokens configurati: [${Object.keys(tokenConfigs).join(", ")}]`);
    console.log(`   Registry owner:     ${pluginAddress} (Plugin)`);
    console.log("=".repeat(60));

    console.log("\n📋 Checklist post-deploy:");
    console.log("   [1] Verifica Beacon registrations (beacon.getImplementation)");
    console.log("   [2] Verifica ProxyGeneral authorization");
    console.log("   [3] Registra plugin in ProtocolManager se necessario");
    console.log("   [4] Esegui fork test: $env:FORK_ENABLED=\"true\"; npx hardhat test test/integration/AaveV3Plugin.fork.test.ts");
    console.log("   [5] Test deposit con piccolo importo (0.001 WETH)");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
