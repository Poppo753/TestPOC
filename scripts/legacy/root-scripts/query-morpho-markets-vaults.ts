/**
 * Query Morpho GraphQL API to find the biggest WETH/USDC markets 
 * and vaults on Arbitrum, compared to our small market.
 */

import { ethers } from "hardhat";

const MORPHO_API = "https://blue-api.morpho.org/graphql";

async function queryGraphQL(query: string, variables: any = {}) {
    const response = await fetch(MORPHO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
    });
    return (await response.json()).data;
}

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("  MORPHO ARBITRUM — MARKETS vs VAULTS ANALYSIS");
    console.log("=".repeat(70));

    // 1. Query top markets on Arbitrum (by supply)
    console.log("\n📊 TOP 15 MARKETS on Arbitrum (by supply):\n");
    
    const marketsData = await queryGraphQL(`{
        markets(
            where: { chainId_in: [42161] }
            orderBy: SupplyAssetsUsd
            first: 15
        ) {
            items {
                uniqueKey
                loanAsset { symbol address }
                collateralAsset { symbol address }
                lltv
                state {
                    supplyAssetsUsd
                    borrowAssetsUsd
                    utilization
                }
                oracleAddress
                irmAddress
            }
        }
    }`);

    const markets = marketsData.markets.items;
    console.log("  #  | Collateral/Loan      | Supply ($)      | Borrow ($)      | Util%  | LLTV");
    console.log("  " + "-".repeat(90));
    
    const OUR_MARKET_ID = "0xca83d02be579485cc10945c9597a6141e772f1cf0e0aa28d09a327b6cbd8642c";
    
    for (let i = 0; i < markets.length; i++) {
        const m = markets[i];
        const coll = m.collateralAsset?.symbol || "???";
        const loan = m.loanAsset?.symbol || "???";
        const supply = Number(m.state.supplyAssetsUsd || 0);
        const borrow = Number(m.state.borrowAssetsUsd || 0);
        const util = (Number(m.state.utilization || 0) * 100).toFixed(1);
        const lltv = (Number(m.lltv) / 1e18 * 100).toFixed(0);
        const pair = `${coll}/${loan}`.padEnd(20);
        const isOurs = m.uniqueKey?.toLowerCase() === OUR_MARKET_ID.toLowerCase() ? " ⬅️ OURS" : "";
        console.log(`  ${String(i+1).padStart(2)} | ${pair} | $${supply.toLocaleString().padStart(14)} | $${borrow.toLocaleString().padStart(14)} | ${util.padStart(5)}% | ${lltv}%${isOurs}`);
    }

    // 2. Query vaults on Arbitrum
    console.log("\n\n📦 TOP 10 VAULTS on Arbitrum (by TVL):\n");
    
    const vaultsData = await queryGraphQL(`{
        vaults(
            where: { chainId_in: [42161] }
            orderBy: TotalAssetsUsd
            first: 10
        ) {
            items {
                name
                symbol
                address
                asset { symbol }
                state {
                    totalAssetsUsd
                    apy
                    netApy
                    allocationMarket {
                        market {
                            uniqueKey
                            collateralAsset { symbol }
                            loanAsset { symbol }
                            lltv
                        }
                        supplyAssetsUsd
                    }
                }
            }
        }
    }`);

    const vaults = vaultsData.vaults.items;
    console.log("  #  | Vault Name                          | Asset | TVL ($)");
    console.log("  " + "-".repeat(75));
    
    for (let i = 0; i < vaults.length; i++) {
        const v = vaults[i];
        const name = (v.name || "???").padEnd(35);
        const asset = (v.asset?.symbol || "?").padEnd(5);
        const tvl = Number(v.state.totalAssetsUsd || 0);
        console.log(`  ${String(i+1).padStart(2)} | ${name} | ${asset} | $${tvl.toLocaleString()}`);
        
        // Show market allocations
        const allocs = v.state.allocationMarket || [];
        const nonZero = allocs.filter((a: any) => Number(a.supplyAssetsUsd) > 100);
        if (nonZero.length > 0) {
            for (const a of nonZero.slice(0, 5)) {
                const mkt = a.market;
                const coll = mkt?.collateralAsset?.symbol || "?";
                const loan = mkt?.loanAsset?.symbol || "?";
                const lltv = (Number(mkt?.lltv || 0) / 1e18 * 100).toFixed(0);
                const allocUsd = Number(a.supplyAssetsUsd || 0);
                const isOurs = mkt?.uniqueKey?.toLowerCase() === OUR_MARKET_ID.toLowerCase() ? " ⬅️ OUR MARKET" : "";
                console.log(`       └─ ${coll}/${loan} (${lltv}%) → $${allocUsd.toLocaleString()}${isOurs}`);
            }
        }
    }

    // 3. Find ALL WETH/USDC markets specifically
    console.log("\n\n🔍 ALL WETH/USDC MARKETS on Arbitrum:\n");
    
    const wethUsdcData = await queryGraphQL(`{
        markets(
            where: { 
                chainId_in: [42161]
                collateralAssetAddress_in: ["0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"]
                loanAssetAddress_in: ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831"]
            }
            orderBy: SupplyAssetsUsd
            first: 20
        ) {
            items {
                uniqueKey
                lltv
                oracleAddress
                irmAddress
                state {
                    supplyAssetsUsd
                    borrowAssetsUsd
                    utilization
                }
            }
        }
    }`);

    const wethMarkets = wethUsdcData.markets.items;
    console.log(`  Found ${wethMarkets.length} WETH/USDC markets:\n`);
    console.log("  #  | LLTV  | Supply ($)      | Borrow ($)      | Oracle                       | IRM");
    console.log("  " + "-".repeat(110));
    
    for (let i = 0; i < wethMarkets.length; i++) {
        const m = wethMarkets[i];
        const supply = Number(m.state.supplyAssetsUsd || 0);
        const borrow = Number(m.state.borrowAssetsUsd || 0);
        const lltv = (Number(m.lltv) / 1e18 * 100).toFixed(0);
        const oracle = m.oracleAddress?.substring(0, 12) + "...";
        const irm = m.irmAddress?.substring(0, 12) + "...";
        const isOurs = m.uniqueKey?.toLowerCase() === OUR_MARKET_ID.toLowerCase() ? " ⬅️ OURS" : "";
        console.log(`  ${String(i+1).padStart(2)} | ${lltv.padStart(4)}% | $${supply.toLocaleString().padStart(14)} | $${borrow.toLocaleString().padStart(14)} | ${oracle} | ${irm}${isOurs}`);
    }

    // 4. Summary
    const totalMarketSupply = markets.reduce((s: number, m: any) => s + Number(m.state.supplyAssetsUsd || 0), 0);
    const totalVaultTVL = vaults.reduce((s: number, v: any) => s + Number(v.state.totalAssetsUsd || 0), 0);
    
    console.log("\n\n📈 SUMMARY:");
    console.log(`  Top 15 markets total supply: $${totalMarketSupply.toLocaleString()}`);
    console.log(`  Top 10 vaults total TVL:     $${totalVaultTVL.toLocaleString()}`);
    console.log(`  Our WETH/USDC 86% market:    $${Number(wethMarkets.find((m: any) => m.uniqueKey?.toLowerCase() === OUR_MARKET_ID.toLowerCase())?.state.supplyAssetsUsd || 0).toLocaleString()}`);
    console.log("\n  💡 Most liquidity lives in VAULTS (MetaMorpho), not individual markets.");
    console.log("     Vaults allocate across multiple markets automatically.");
    console.log("     Our market is a valid isolated market, just not one of the biggest.\n");
}

main().catch(console.error);
