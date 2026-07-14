// Query specifically for WETH collateral markets on Arbitrum
async function main() {
  const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  
  const query = `{
    markets(where: { chainId_in: [42161], collateralAssetAddress_in: ["${WETH}"] }) {
      items {
        uniqueKey
        loanAsset { address symbol }
        collateralAsset { address symbol }
        oracle { address }
        irmAddress
        lltv
        state {
          supplyAssetsUsd
          borrowAssetsUsd
          utilization
        }
        morphoBlue { address chain { id } }
      }
    }
  }`;

  const res = await fetch("https://blue-api.morpho.org/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });
  
  const data = await res.json();
  const markets = data.data?.markets?.items || [];
  console.log(`Found ${markets.length} WETH collateral markets on Arbitrum:\n`);
  
  for (const m of markets) {
    const supplyUsd = m.state?.supplyAssetsUsd || 0;
    console.log(`--- WETH/${m.loanAsset?.symbol} (LLTV: ${Number(m.lltv) / 1e16}%) ---`);
    console.log(`  MarketId: ${m.uniqueKey}`);
    console.log(`  Oracle: ${m.oracle?.address}`);
    console.log(`  IRM: ${m.irmAddress}`);
    console.log(`  Supply: $${supplyUsd.toFixed(2)}`);
    console.log(`  Borrow: $${(m.state?.borrowAssetsUsd || 0).toFixed(2)}`);
    console.log(`  Morpho: ${m.morphoBlue?.address}`);
    console.log("");
  }
}

main().catch(console.error);
