/**
 * Query Morpho GraphQL API — corrected field names
 */

async function queryGraphQL(query: string) {
    const response = await fetch("https://blue-api.morpho.org/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
    });
    const json = await response.json();
    if (json.errors) {
        console.log("API Errors:", JSON.stringify(json.errors, null, 2));
    }
    return json.data;
}

async function main() {
    console.log("\n=== MORPHO ARBITRUM — MARKETS & VAULTS ===\n");

    // First, let's introspect what fields are available on Market
    // Query top markets with raw numeric fields
    const data = await queryGraphQL(`{
        markets(
            where: { chainId_in: [42161] }
            first: 20
        ) {
            items {
                uniqueKey
                loanAsset { symbol decimals }
                collateralAsset { symbol }
                lltv
                oracleAddress
                irmAddress
                state {
                    supplyAssets
                    supplyAssetsUsd
                    borrowAssets
                    borrowAssetsUsd
                }
            }
        }
    }`);

    const markets = data?.markets?.items || [];
    console.log(`Found ${markets.length} markets. Showing non-zero ones:\n`);

    // Filter and sort by supplyAssets (numeric)
    const withSupply = markets
        .map((m: any) => ({
            ...m,
            supplyUsd: Number(m.state?.supplyAssetsUsd || 0),
            borrowUsd: Number(m.state?.borrowAssetsUsd || 0),
            supplyRaw: BigInt(m.state?.supplyAssets || "0"),
        }))
        .sort((a: any, b: any) => b.supplyUsd - a.supplyUsd);

    const OUR_ID = "0xca83d02be579485cc10945c9597a6141e772f1cf0e0aa28d09a327b6cbd8642c";

    for (const m of withSupply) {
        const coll = m.collateralAsset?.symbol || "?";
        const loan = m.loanAsset?.symbol || "?";
        const lltv = (Number(m.lltv) / 1e18 * 100).toFixed(0);
        const decimals = m.loanAsset?.decimals || 18;
        const supplyHuman = Number(m.supplyRaw) / (10 ** decimals);
        const isOurs = m.uniqueKey?.toLowerCase() === OUR_ID.toLowerCase() ? " ⬅️ OURS" : "";
        
        if (supplyHuman > 0 || m.uniqueKey?.toLowerCase() === OUR_ID.toLowerCase()) {
            console.log(`  ${coll}/${loan} (${lltv}%) — Supply: ${supplyHuman.toFixed(2)} ${loan} ($${m.supplyUsd.toLocaleString()}) | Borrow: $${m.borrowUsd.toLocaleString()}${isOurs}`);
            console.log(`    oracle: ${m.oracleAddress} | irm: ${m.irmAddress}`);
        }
    }

    // Now query vaults
    console.log("\n\n=== VAULTS (MetaMorpho) on Arbitrum ===\n");
    
    const vaultData = await queryGraphQL(`{
        vaults(
            where: { chainId_in: [42161] }
            first: 15
        ) {
            items {
                name
                address
                asset { symbol }
                state {
                    totalAssets
                    totalAssetsUsd
                    apy
                }
            }
        }
    }`);

    if (!vaultData?.vaults?.items) {
        console.log("  No vault data returned. Trying alternative query...\n");
        
        // Try different query structure
        const vaultData2 = await queryGraphQL(`{
            vaults(
                where: { chainId_in: [42161] }
                first: 10
            ) {
                items {
                    name
                    address
                    asset { symbol decimals }
                    state {
                        totalAssets
                        totalAssetsUsd
                    }
                }
            }
        }`);
        
        if (vaultData2?.vaults?.items) {
            const vaults = vaultData2.vaults.items
                .map((v: any) => ({ ...v, tvl: Number(v.state?.totalAssetsUsd || 0) }))
                .sort((a: any, b: any) => b.tvl - a.tvl);
            
            for (const v of vaults) {
                console.log(`  ${v.name || "?"} (${v.asset?.symbol || "?"}) — TVL: $${v.tvl.toLocaleString()}`);
                console.log(`    address: ${v.address}`);
            }
        } else {
            console.log("  Vault query not supported. Check https://app.morpho.org/vaults?chains=42161 directly.");
        }
    } else {
        const vaults = vaultData.vaults.items
            .map((v: any) => ({ ...v, tvl: Number(v.state?.totalAssetsUsd || 0) }))
            .sort((a: any, b: any) => b.tvl - a.tvl);
        
        for (const v of vaults) {
            const apy = v.state?.apy ? (Number(v.state.apy) * 100).toFixed(2) + "%" : "?";
            console.log(`  ${v.name || "?"} (${v.asset?.symbol || "?"}) — TVL: $${v.tvl.toLocaleString()} | APY: ${apy}`);
            console.log(`    address: ${v.address}`);
        }
    }

    // Query all WETH/USDC markets specifically
    console.log("\n\n=== ALL WETH/USDC MARKETS ===\n");
    
    const wethData = await queryGraphQL(`{
        markets(
            where: { 
                chainId_in: [42161]
                collateralAssetAddress_in: ["0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"]
                loanAssetAddress_in: ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831"]
            }
            first: 30
        ) {
            items {
                uniqueKey
                lltv
                oracleAddress
                irmAddress
                loanAsset { decimals }
                state {
                    supplyAssets
                    supplyAssetsUsd
                    borrowAssets
                    borrowAssetsUsd
                }
            }
        }
    }`);

    const wethMarkets = (wethData?.markets?.items || [])
        .map((m: any) => ({
            ...m,
            supplyUsd: Number(m.state?.supplyAssetsUsd || 0),
            supplyRaw: Number(m.state?.supplyAssets || 0) / 1e6,
        }))
        .sort((a: any, b: any) => b.supplyRaw - a.supplyRaw);

    console.log(`Found ${wethMarkets.length} WETH/USDC markets:\n`);
    
    for (let i = 0; i < wethMarkets.length; i++) {
        const m = wethMarkets[i];
        const lltv = (Number(m.lltv) / 1e18 * 100).toFixed(0);
        const supply = m.supplyRaw.toFixed(2);
        const borrow = (Number(m.state?.borrowAssets || 0) / 1e6).toFixed(2);
        const isOurs = m.uniqueKey?.toLowerCase() === OUR_ID.toLowerCase() ? " ⬅️ OURS" : "";
        console.log(`  ${i+1}. LLTV ${lltv}% | Supply: ${supply} USDC ($${m.supplyUsd.toLocaleString()}) | Borrow: ${borrow} USDC${isOurs}`);
        console.log(`     oracle: ${m.oracleAddress?.substring(0, 20)}... | irm: ${m.irmAddress?.substring(0, 20)}...`);
    }
}

main().catch(console.error);
