/**
 * @file deploy-morpho-vault-plugin.ts
 * @description Deploy dei "3 Musketeers" MorphoVault su Arbitrum:
 *              1. MorphoVaultPlugin (operazioni vault ERC-4626)
 *              2. MorphoVaultLensAdapter (monitoring vault)
 *              3. Configura vaults nel MorphoRegistry condiviso (già deployed)
 * 
 * NOTA: Il MorphoRegistry è GIÀ deployed e condiviso con MorphoPlugin.
 *       Deve essere ri-deployed con i nuovi metodi vault.
 * 
 * ORDINE CRITICO:
 * 1. Re-deploy MorphoRegistry (nuova versione con vault methods)
 * 2. Riconfigura il market WETH/USDC nel nuovo Registry
 * 3. configureVault() per ogni vault supportato
 * 4. setDefaultVault() per routing IProtocolAdapter
 * 5. Deploy MorphoVaultPlugin (passa beacon address)
 * 6. Deploy MorphoVaultLensAdapter (passa beacon address)
 * 7. Beacon.setImplementation() per Registry + VaultPlugin + VaultLensAdapter
 * 8. ProxyGeneral.authorizeModule(vaultPlugin) 
 * 9. Update deployments/mainnet-latest.json
 * 
 * USAGE:
 *   npx hardhat run scripts/deploy-morpho-vault-plugin.ts --network arbitrum
 *   
 * DRY-RUN (fork locale):
 *   $env:FORK_ENABLED="true"; npx hardhat run scripts/deploy-morpho-vault-plugin.ts --network hardhat
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ==================== CONFIGURAZIONE ====================

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

// Morpho Blue on Arbitrum
const MORPHO_ADDRESS = "0x6c247b1F6182318877311737BaC0844bAa518F5e";

// Token sottostanti su Arbitrum
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

// Existing Morpho market config (must be re-configured in new Registry)
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

// MetaMorpho vaults on Arbitrum (ERC-4626, verified with maxDeposit > 0)
const VAULTS = [
    {
        address: "0xaE73875437c86abb60cD7fA77286D63cb94F9a25",
        assetCode: "USDC",
        name: "HexaOne USDC",
    },
    {
        address: "0xa53Cf822FE93002aEaE16d395CD823Ece161a6AC",
        assetCode: "USDC",
        name: "Clearstar USDC Reactor",
    },
    {
        address: "0xd2d46099B70880e268B0c7557b9D22d3AA848654",
        assetCode: "USDC",
        name: "usdc staging",
    },
];

// Default vault per tokenCode (routing IProtocolAdapter)
const DEFAULT_VAULTS: Record<string, string> = {
    "USDC": "0xaE73875437c86abb60cD7fA77286D63cb94F9a25", // HexaOne USDC
};

// ==================== MAIN ====================

async function main() {
    console.log("\n🚀 Deploying MorphoVault Plugin (3 Musketeers) to Arbitrum...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
    console.log("Network:", network.name, `(chainId: ${(await ethers.provider.getNetwork()).chainId})`);

    // ==================== STEP 1: Verify vaults exist on-chain ====================

    console.log("\n📡 Verifying MetaMorpho vaults on Arbitrum...");
    for (const v of VAULTS) {
        const code = await ethers.provider.getCode(v.address);
        if (code === "0x") {
            console.log(`   ❌ ${v.name} (${v.address}) — NO bytecode!`);
            process.exit(1);
        }
        try {
            const vault = new ethers.Contract(v.address, [
                "function asset() view returns (address)",
                "function totalAssets() view returns (uint256)",
                "function maxDeposit(address) view returns (uint256)",
            ], ethers.provider);
            const asset = await vault.asset();
            const ta = await vault.totalAssets();
            const md = await vault.maxDeposit(deployer.address);
            console.log(`   ✅ ${v.name}: asset=${asset.substring(0, 10)}... totalAssets=${ta} maxDeposit=${md}`);
        } catch (e: any) {
            console.log(`   ⚠️  ${v.name}: could not fully verify (${e.message?.substring(0, 60)})`);
        }
    }

    // ==================== STEP 2: Re-deploy MorphoRegistry (with vault support) ====================

    console.log("\n📦 Step 1/7: Re-deploying MorphoRegistry (with vault methods)...");
    const RegistryFactory = await ethers.getContractFactory("MorphoRegistry");
    const registry = await RegistryFactory.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log(`   ✅ MorphoRegistry deployed: ${registryAddress}`);

    // ==================== STEP 3: Re-configure markets ====================

    console.log("\n⚙️  Step 2/7: Re-configuring markets in new Registry...");
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

    // ==================== STEP 4: Configure vaults ====================

    console.log("\n⚙️  Step 3/7: Configuring vaults in Registry...");
    for (const v of VAULTS) {
        const tx = await registry.configureVault(v.address, v.assetCode);
        await tx.wait();
        console.log(`   ✅ ${v.name} (${v.address}) configured for ${v.assetCode}`);
    }

    // Set default vaults
    for (const [assetCode, vaultAddr] of Object.entries(DEFAULT_VAULTS)) {
        const tx = await registry.setDefaultVault(assetCode, vaultAddr);
        await tx.wait();
        console.log(`   ✅ Default ${assetCode} vault: ${vaultAddr}`);
    }

    // ==================== STEP 5: Deploy MorphoVaultPlugin ====================

    console.log("\n📦 Step 4/7: Deploying MorphoVaultPlugin...");
    const VaultPluginFactory = await ethers.getContractFactory("MorphoVaultPlugin");
    const vaultPlugin = await VaultPluginFactory.deploy(BEACON);
    await vaultPlugin.waitForDeployment();
    const vaultPluginAddress = await vaultPlugin.getAddress();
    console.log(`   ✅ MorphoVaultPlugin deployed: ${vaultPluginAddress}`);

    // ==================== STEP 6: Deploy MorphoVaultLensAdapter ====================

    console.log("\n📦 Step 5/7: Deploying MorphoVaultLensAdapter...");
    const VaultLensFactory = await ethers.getContractFactory("MorphoVaultLensAdapter");
    const vaultLens = await VaultLensFactory.deploy(BEACON, "USDC");
    await vaultLens.waitForDeployment();
    const vaultLensAddress = await vaultLens.getAddress();
    console.log(`   ✅ MorphoVaultLensAdapter deployed: ${vaultLensAddress}`);

    // ==================== STEP 7: Transfer Registry ownership to MorphoPlugin ====================

    console.log("\n🔑 Step 6/7: Transferring Registry ownership...");
    // Registry owner stays deployer for now (both plugins need admin access via owner)
    // MorphoPlugin is already deployed but uses old Registry — it must be pointed to the new one via Beacon
    const existingPluginAddr = await (await ethers.getContractAt(
        ["function getImplementation(string memory) view returns (address)"],
        BEACON
    )).getImplementation("MorphoPlugin");
    console.log(`   Existing MorphoPlugin: ${existingPluginAddr}`);
    
    // Transfer ownership to MorphoPlugin (for market config calls)
    if (existingPluginAddr !== ethers.ZeroAddress) {
        const txTransfer = await registry.transferOwnership(existingPluginAddr);
        await txTransfer.wait();
        const newOwner = await registry.owner();
        console.log(`   ✅ Registry ownership transferred to MorphoPlugin: ${newOwner}`);
    } else {
        console.log(`   ⚠️  MorphoPlugin not registered in Beacon yet, keeping deployer as owner`);
    }

    // ==================== STEP 8: Register in Beacon ====================

    console.log("\n📝 Step 7/7: Registering in Beacon...");
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
        // Update Registry (new version with vault methods)
        await (await beacon.updateImplementation("MorphoRegistry", registryAddress)).wait();
        console.log(`   ✅ "MorphoRegistry" → ${registryAddress} (updated!)`);

        // Register new contracts
        await (await beacon.updateImplementation("MorphoVaultPlugin", vaultPluginAddress)).wait();
        console.log(`   ✅ "MorphoVaultPlugin" → ${vaultPluginAddress}`);

        await (await beacon.updateImplementation("MorphoVaultLensAdapter", vaultLensAddress)).wait();
        console.log(`   ✅ "MorphoVaultLensAdapter" → ${vaultLensAddress}`);

        // Verify
        const regCheck = await beacon.getImplementation("MorphoVaultPlugin");
        console.log(`   Verifica: beacon.get("MorphoVaultPlugin") = ${regCheck}`);
    } else {
        console.log(`   ⚠️  Non sei il Beacon owner. Registrazione manuale necessaria:`);
        console.log(`      beacon.updateImplementation("MorphoRegistry", "${registryAddress}")`);
        console.log(`      beacon.updateImplementation("MorphoVaultPlugin", "${vaultPluginAddress}")`);
        console.log(`      beacon.updateImplementation("MorphoVaultLensAdapter", "${vaultLensAddress}")`);
    }

    // ==================== STEP 9: Authorize VaultPlugin in ProxyGeneral ====================

    console.log("\n🔓 Authorizing VaultPlugin in ProxyGeneral...");
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
            await (await proxy.authorizeModule(vaultPluginAddress, "MorphoVaultPlugin")).wait();
            console.log(`   ✅ MorphoVaultPlugin autorizzato in ProxyGeneral`);
        } else {
            console.log(`   ⚠️  Non sei il ProxyGeneral owner. Autorizzazione manuale necessaria:`);
            console.log(`      proxyGeneral.authorizeModule("${vaultPluginAddress}", "MorphoVaultPlugin")`);
        }
    } catch (e: any) {
        console.log(`   ⚠️  ProxyGeneral non raggiungibile: ${e.message}`);
    }

    // ==================== STEP 10: Update deployment file ====================

    console.log("\n📁 Updating deployment file...");
    const deploymentPath = path.join(__dirname, "..", "deployments", "mainnet-latest.json");
    if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

        deployment.contracts.morphoRegistry = registryAddress;
        deployment.contracts.morphoVaultPlugin = vaultPluginAddress;
        deployment.contracts.morphoVaultLensAdapter = vaultLensAddress;
        deployment.timestamp = new Date().toISOString();

        deployment.MorphoRegistry = {
            address: registryAddress,
            deployer: deployer.address,
            owner: existingPluginAddr || deployer.address,
            markets: MARKETS.map(m => `${m.collateralCode}/${m.loanCode}`),
            vaults: VAULTS.map(v => ({ name: v.name, address: v.address, assetCode: v.assetCode })),
            defaultVaults: DEFAULT_VAULTS,
            previousVersion: "0x9370CC33F5336186849a4bAA2ecD3dd75263d86d",
            upgradeReason: "Added vault config methods (configureVault, setDefaultVault, etc.)",
        };

        deployment.MorphoVaultPlugin = {
            address: vaultPluginAddress,
            deployer: deployer.address,
            beacon: BEACON,
            timestamp: new Date().toISOString(),
            vaults: VAULTS.map(v => v.address),
        };

        deployment.MorphoVaultLensAdapter = {
            address: vaultLensAddress,
            deployer: deployer.address,
            beacon: BEACON,
            timestamp: new Date().toISOString(),
        };

        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log(`   ✅ Updated ${deploymentPath}`);
    }

    // ==================== RIEPILOGO ====================

    console.log("\n" + "=".repeat(60));
    console.log("✅ DEPLOY MORPHO VAULT PLUGIN COMPLETATO!");
    console.log("=".repeat(60));
    console.log(`   MorphoRegistry:          ${registryAddress} (re-deployed)`);
    console.log(`   MorphoVaultPlugin:       ${vaultPluginAddress}`);
    console.log(`   MorphoVaultLensAdapter:  ${vaultLensAddress}`);
    console.log(`   Vaults configurati: [${VAULTS.map(v => v.name).join(", ")}]`);
    console.log(`   Default USDC vault: ${DEFAULT_VAULTS["USDC"]}`);
    console.log(`   Registry owner: ${existingPluginAddr || deployer.address}`);
    console.log("\n   NOTA: Il MorphoRegistry vecchio (0x9370CC...) è ora sostituito.`");
    console.log("         MorphoPlugin + MorphoLensAdapter usano lo stesso Registry via Beacon.\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
