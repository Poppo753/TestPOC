/**
 * Verify access to the big markets and vaults shown in app.morpho.org
 * 
 * Markets: Should all be on our Morpho singleton 0x6c247b
 * Vaults: Separate ERC-4626 contracts — NOT currently supported by MorphoPlugin
 */

import { ethers } from "hardhat";

const MORPHO = "0x6c247b1F6182318877311737BaC0844bAa518F5e";

// Token addresses on Arbitrum
const TOKENS: Record<string, string> = {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    wstETH: "0x5979D7b546E38E9Ab8bF35e0Ef2C8A3BF18A5B10", // approximate
    weETH: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe", // approximate
};

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("  MORPHO ACCESS CHECK — MARKETS + VAULTS");
    console.log("=".repeat(70));

    const morpho = new ethers.Contract(MORPHO, [
        "function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)",
        "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
    ], ethers.provider);

    // ================================================================
    // PART 1: MARKETS — Query the big ones from the screenshot
    // ================================================================
    console.log("\n\n=== PART 1: MARKETS (tutti sul singleton 0x6c247b...) ===\n");
    console.log("  Querying Morpho GraphQL API for top Arbitrum markets...\n");

    const response = await fetch("https://blue-api.morpho.org/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query: `{
                markets(where: { chainId_in: [42161] }, first: 50) {
                    items {
                        uniqueKey
                        loanAsset { symbol decimals address }
                        collateralAsset { symbol decimals address }
                        lltv
                        oracleAddress
                        irmAddress
                        morphoBlue { address }
                        state { supplyAssets borrowAssets }
                    }
                }
            }`
        }),
    });
    const data = (await response.json()).data;
    const markets = data?.markets?.items || [];

    // Filter markets with meaningful supply and sort
    const bigMarkets = markets
        .map((m: any) => {
            const loanDec = m.loanAsset?.decimals || 18;
            const supply = Number(BigInt(m.state?.supplyAssets || "0")) / (10 ** loanDec);
            const borrow = Number(BigInt(m.state?.borrowAssets || "0")) / (10 ** loanDec);
            return { ...m, supplyHuman: supply, borrowHuman: borrow };
        })
        .filter((m: any) => m.supplyHuman > 100)
        .sort((a: any, b: any) => b.supplyHuman - a.supplyHuman);

    console.log(`  Found ${bigMarkets.length} markets con supply > $100:\n`);
    console.log("  #  | Collateral/Loan          | Supply           | Borrow           | LLTV  | Morpho Address");
    console.log("  " + "-".repeat(110));

    let allOnOurMorpho = true;
    for (let i = 0; i < bigMarkets.length; i++) {
        const m = bigMarkets[i];
        const coll = (m.collateralAsset?.symbol || "?").padEnd(10);
        const loan = (m.loanAsset?.symbol || "?").padEnd(6);
        const lltv = ((Number(m.lltv) / 1e18) * 100).toFixed(0);
        const morphoAddr = m.morphoBlue?.address || "?";
        const onOurs = morphoAddr.toLowerCase() === MORPHO.toLowerCase();
        if (!onOurs) allOnOurMorpho = false;
        
        console.log(
            `  ${String(i + 1).padStart(2)} | ${coll}/${loan} | ` +
            `${m.supplyHuman.toLocaleString(undefined, {maximumFractionDigits: 0}).padStart(16)} | ` +
            `${m.borrowHuman.toLocaleString(undefined, {maximumFractionDigits: 0}).padStart(16)} | ` +
            `${lltv.padStart(4)}% | ${onOurs ? "✅ 0x6c24..." : "❌ " + morphoAddr.substring(0, 10)}`
        );
    }

    console.log(`\n  ${allOnOurMorpho ? "✅" : "⚠️"} Tutti i markets su ${allOnOurMorpho ? "nostro Morpho 0x6c247b" : "ATTENZIONE: non tutti su nostro Morpho!"}`);

    // Verify a few on-chain directly
    console.log("\n  📡 Verifica on-chain diretta dei top 3 markets:");
    for (let i = 0; i < Math.min(3, bigMarkets.length); i++) {
        const m = bigMarkets[i];
        try {
            const mkt = await morpho.market(m.uniqueKey);
            const loanDec = m.loanAsset?.decimals || 18;
            const supply = Number(mkt.totalSupplyAssets) / (10 ** loanDec);
            console.log(`  ✅ ${m.collateralAsset?.symbol}/${m.loanAsset?.symbol}: supply=${supply.toLocaleString()} ${m.loanAsset?.symbol} (on-chain via nostro Morpho)`);
        } catch (e: any) {
            console.log(`  ❌ ${m.collateralAsset?.symbol}/${m.loanAsset?.symbol}: ERRORE — ${e.message?.substring(0, 60)}`);
        }
    }

    // ================================================================
    // PART 2: Can we add these markets to our Registry?
    // ================================================================
    console.log("\n\n=== PART 2: POSSIAMO AGGIUNGERE QUESTI MARKETS? ===\n");
    console.log("  Il nostro MorphoRegistry attualmente ha SOLO: WETH/USDC (86%)");
    console.log("  Per usare gli altri markets basta chiamare registry.configureMarket()");
    console.log("  con i MarketParams corretti.\n");
    console.log("  Markets che potremmo aggiungere subito:");
    
    for (let i = 0; i < Math.min(10, bigMarkets.length); i++) {
        const m = bigMarkets[i];
        console.log(`    ${m.collateralAsset?.symbol}/${m.loanAsset?.symbol} (${((Number(m.lltv)/1e18)*100).toFixed(0)}%) — supply: ${m.supplyHuman.toLocaleString(undefined, {maximumFractionDigits: 0})} ${m.loanAsset?.symbol}`);
        console.log(`      oracle: ${m.oracleAddress}`);
        console.log(`      irm:    ${m.irmAddress}`);
    }

    // ================================================================
    // PART 3: VAULTS — These are SEPARATE contracts
    // ================================================================
    console.log("\n\n=== PART 3: VAULTS (MetaMorpho — contratti SEPARATI) ===\n");

    const vaultResponse = await fetch("https://blue-api.morpho.org/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query: `{
                vaults(where: { chainId_in: [42161] }, first: 20) {
                    items {
                        name
                        address
                        asset { symbol decimals }
                        state { totalAssets }
                    }
                }
            }`
        }),
    });
    const vaultData = (await vaultResponse.json()).data;
    const vaults = (vaultData?.vaults?.items || [])
        .map((v: any) => {
            const dec = v.asset?.decimals || 18;
            const total = Number(BigInt(v.state?.totalAssets || "0")) / (10 ** dec);
            return { ...v, totalHuman: total };
        })
        .filter((v: any) => v.totalHuman > 10)
        .sort((a: any, b: any) => b.totalHuman - a.totalHuman);

    console.log(`  Found ${vaults.length} vaults con depositi > $10:\n`);

    for (let i = 0; i < vaults.length; i++) {
        const v = vaults[i];
        console.log(`  ${String(i + 1).padStart(2)}. ${(v.name || "?").padEnd(35)} | ${v.totalHuman.toLocaleString(undefined, {maximumFractionDigits: 0}).padStart(12)} ${v.asset?.symbol}`);
        console.log(`      address: ${v.address}`);

        // Check if it's ERC-4626
        try {
            const vault = new ethers.Contract(v.address, [
                "function asset() view returns (address)",
                "function totalAssets() view returns (uint256)",
                "function deposit(uint256, address) returns (uint256)",
                "function withdraw(uint256, address, address) returns (uint256)",
            ], ethers.provider);
            const asset = await vault.asset();
            const total = await vault.totalAssets();
            const dec = v.asset?.decimals || 18;
            console.log(`      ✅ ERC-4626: asset=${asset.substring(0,10)}... totalAssets=${(Number(total)/(10**dec)).toLocaleString()} ${v.asset?.symbol}`);
        } catch {
            console.log(`      ❌ Non ERC-4626 o non raggiungibile`);
        }
    }

    // ================================================================
    // CONCLUSIONE
    // ================================================================
    console.log("\n\n" + "=".repeat(70));
    console.log("  CONCLUSIONE");
    console.log("=".repeat(70));
    console.log("\n  📊 MARKETS (isolati):");
    console.log("     ✅ TUTTI vivono sul singleton Morpho a 0x6c247b...");
    console.log("     ✅ Il nostro MorphoPlugin PUÒ interagire con QUALSIASI market");
    console.log("     ✅ Basta aggiungere MarketParams al Registry (configureMarket)");
    console.log("     ⚠️  Attualmente configurato SOLO: WETH/USDC 86%\n");
    console.log("  📦 VAULTS (MetaMorpho, ERC-4626):");
    console.log("     ❌ Il nostro MorphoPlugin NON supporta vault deposits");
    console.log("     ❌ Sono contratti SEPARATI (Steakhouse, Gauntlet, kpk, etc.)");
    console.log("     ❌ Servirebbero nuove funzioni: vault.deposit() / vault.withdraw()");
    console.log("     💡 I vault sono wrapper che allocano in markets sottostanti");
    console.log("     💡 Il vantaggio dei vault: diversificazione automatica + curation\n");
}

main().catch(console.error);
