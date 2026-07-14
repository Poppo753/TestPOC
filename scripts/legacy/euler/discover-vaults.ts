/**
 * Script per scoprire i vault Euler V2 disponibili su Arbitrum
 * 
 * Run: $env:FORK_ENABLED="true"; npx hardhat run scripts/euler/discover-vaults.ts --network hardhat
 * Oppure su mainnet: npx hardhat run scripts/euler/discover-vaults.ts --network arbitrum
 */

import { ethers } from "hardhat";

// Euler V2 Addresses su Arbitrum
const VAULT_LENS = "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380";
const ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
const EVC = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
const E_VAULT_FACTORY = "0x78Df1CF5bf06a7f27f2ACc580B934238C1b80D50";

// Tokens su Arbitrum
const TOKENS = {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
};

async function main() {
    console.log("\n🔍 EULER V2 VAULT DISCOVERY - ARBITRUM");
    console.log("=".repeat(80));
    
    const network = await ethers.provider.getNetwork();
    console.log(`\n📡 Network: ${network.name} (chainId: ${network.chainId})`);

    // Verifica che EVC sia raggiungibile
    console.log("\n1️⃣ Verificando EVC...");
    const evc = await ethers.getContractAt([
        "function getRawExecutionContext() external view returns (uint256)",
        "function haveCommonOwner(address,address) external pure returns (bool)"
    ], EVC);

    try {
        const ctx = await evc.getRawExecutionContext();
        console.log(`   ✅ EVC attivo, context: ${ctx}`);
    } catch (e: any) {
        console.log(`   ❌ EVC non raggiungibile: ${e.message}`);
        return;
    }

    // Prova a interrogare il VaultLens
    console.log("\n2️⃣ Interrogando VaultLens...");
    
    // ABI minimale per VaultLens
    const vaultLensAbi = [
        "function getVaultInfoFull(address vault) external view returns (tuple(address vault, string vaultName, string vaultSymbol, uint8 vaultDecimals, address asset, string assetName, string assetSymbol, uint8 assetDecimals, address unitOfAccount, string unitOfAccountName, string unitOfAccountSymbol, uint8 unitOfAccountDecimals, uint256 totalShares, uint256 totalCash, uint256 totalBorrowed, uint256 totalAssets, uint256 accumulatedFeesAssets, uint256 accumulatedFeesShares, address governorAdmin, address feeReceiver, address interestRateModel, address oracle, uint16 supplyCap, uint16 borrowCap, uint32 interestFee, uint256 liquidationCoolOffTime, address hookTarget, uint32 hookedOps, uint32 configFlags, uint256 lastInterestAccumulatorUpdate, uint256 interestAccumulator, uint256 cash, uint256 convertToAssetsConversionRate, uint256 convertToSharesConversionRate))"
    ];

    // Prova con la factory per ottenere vault esistenti
    console.log("\n3️⃣ Interrogando eVaultFactory...");
    
    const factoryAbi = [
        "function getProxyListLength() external view returns (uint256)",
        "function proxyList(uint256 index) external view returns (address)"
    ];

    try {
        const factory = await ethers.getContractAt(factoryAbi, E_VAULT_FACTORY);
        const proxyCount = await factory.getProxyListLength();
        console.log(`   📊 Numero totale vault creati: ${proxyCount}`);

        // Elenca i primi vault
        const maxToShow = Math.min(Number(proxyCount), 20);
        console.log(`\n   Primi ${maxToShow} vault:`);
        
        const vaultAbi = [
            "function asset() external view returns (address)",
            "function name() external view returns (string)",
            "function symbol() external view returns (string)",
            "function totalAssets() external view returns (uint256)",
            "function maxDeposit(address) external view returns (uint256)",
            "function decimals() external view returns (uint8)"
        ];

        const foundVaults: { [key: string]: string } = {};

        for (let i = 0; i < maxToShow; i++) {
            try {
                const vaultAddress = await factory.proxyList(i);
                const vault = await ethers.getContractAt(vaultAbi, vaultAddress);
                
                const asset = await vault.asset();
                const name = await vault.name();
                const symbol = await vault.symbol();
                const totalAssets = await vault.totalAssets();
                const decimals = await vault.decimals();

                // Trova il nome del token
                let tokenName = "Unknown";
                for (const [key, addr] of Object.entries(TOKENS)) {
                    if (addr.toLowerCase() === asset.toLowerCase()) {
                        tokenName = key;
                        foundVaults[key] = vaultAddress;
                        break;
                    }
                }

                console.log(`\n   [${i}] ${symbol} (${name})`);
                console.log(`       Vault: ${vaultAddress}`);
                console.log(`       Asset: ${asset} (${tokenName})`);
                console.log(`       Total Assets: ${ethers.formatUnits(totalAssets, decimals)}`);
            } catch (e: any) {
                console.log(`   [${i}] Error: ${e.message.substring(0, 50)}...`);
            }
        }

        // Riepilogo vault trovati
        console.log("\n" + "=".repeat(80));
        console.log("📋 RIEPILOGO VAULT PER TOKEN NOTI:");
        console.log("=".repeat(80));
        
        for (const [token, vault] of Object.entries(foundVaults)) {
            console.log(`   ${token}: ${vault}`);
        }

        // Output per copia-incolla nel test
        console.log("\n📝 COPIA QUESTI NEL TEST:");
        console.log("const EULER_VAULTS = {");
        for (const [token, vault] of Object.entries(foundVaults)) {
            console.log(`    ${token}: "${vault}",`);
        }
        console.log("};");

    } catch (e: any) {
        console.log(`   ❌ Errore factory: ${e.message}`);
        
        // Fallback: prova con indirizzi noti dalla community
        console.log("\n4️⃣ Tentativo fallback con vault noti...");
        
        // Questi sono vault che potrebbero esistere - da verificare
        const knownVaults = [
            "0x7c7D999CebA8a72f5Dc53baED5F636bC994b3375", // Possibile eWETH
            "0x1D2F71E2e48E21E18d0A7c0a7f1e17Eb89d8c9F9", // Possibile eUSDC
        ];

        for (const vaultAddr of knownVaults) {
            try {
                const vaultAbi = [
                    "function asset() external view returns (address)",
                    "function name() external view returns (string)",
                    "function symbol() external view returns (string)",
                ];
                const vault = await ethers.getContractAt(vaultAbi, vaultAddr);
                const name = await vault.name();
                const asset = await vault.asset();
                console.log(`   ✅ Vault ${vaultAddr}: ${name}, Asset: ${asset}`);
            } catch (e: any) {
                console.log(`   ❌ Vault ${vaultAddr} non valido`);
            }
        }
    }

    console.log("\n✅ Discovery completato!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
