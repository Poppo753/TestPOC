// Query Morpho Blue API for Arbitrum markets
async function main() {
  const query = `{
    markets(where: { chainId_in: [42161], loanAssetAddress_in: ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831"] }) {
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
  
  if (data.errors) {
    console.error("GraphQL errors:", JSON.stringify(data.errors, null, 2));
    return;
  }
  
  const markets = data.data?.markets?.items || [];
  console.log(`Found ${markets.length} USDC markets on Arbitrum:\n`);
  
  for (const m of markets) {
    console.log(`--- ${m.collateralAsset?.symbol || "?"}/USDC ---`);
    console.log(`  MarketId: ${m.uniqueKey}`);
    console.log(`  Morpho Blue: ${m.morphoBlue?.address}`);
    console.log(`  Collateral: ${m.collateralAsset?.address}`);
    console.log(`  Oracle: ${m.oracle?.address}`);
    console.log(`  IRM: ${m.irmAddress}`);
    console.log(`  LLTV: ${m.lltv}`);
    console.log(`  Supply: $${m.state?.supplyAssetsUsd?.toFixed(2)}`);
    console.log(`  Borrow: $${m.state?.borrowAssetsUsd?.toFixed(2)}`);
    console.log(`  Util: ${(m.state?.utilization * 100)?.toFixed(2)}%`);
    console.log("");
  }
}

main().catch(console.error);
