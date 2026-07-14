import { ethers } from "hardhat";

async function main() {
    const PG = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
    const MORPHO_PLUGIN = "0xf653f0E3FddA2937C2A76C385FA381599BDb65dB";
    const VAULT_PLUGIN = "0x118fd15a78C0Dada24c49343A55142938Ca1868E";
    const USDC_ADDR = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH_ADDR = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

    const erc20abi = ["function balanceOf(address) view returns (uint256)"];
    const usdc = await ethers.getContractAt(erc20abi, USDC_ADDR);
    const weth = await ethers.getContractAt(erc20abi, WETH_ADDR);

    console.log("=== ProxyGeneral ===");
    console.log("  USDC:", ethers.formatUnits(await usdc.balanceOf(PG), 6));
    console.log("  WETH:", ethers.formatUnits(await weth.balanceOf(PG), 18));
    console.log("  ETH:", ethers.formatEther(await ethers.provider.getBalance(PG)));

    console.log("\n=== MorphoPlugin ===");
    console.log("  USDC:", ethers.formatUnits(await usdc.balanceOf(MORPHO_PLUGIN), 6));
    console.log("  WETH:", ethers.formatUnits(await weth.balanceOf(MORPHO_PLUGIN), 18));

    console.log("\n=== MorphoVaultPlugin ===");
    console.log("  USDC:", ethers.formatUnits(await usdc.balanceOf(VAULT_PLUGIN), 6));

    // Morpho Blue positions
    const MORPHO = "0x6c247b1F6182318877311737BaC0844bAa518F5e";
    const MARKET_ID = "0xca83d02be579485cc10945c9597a6141e772f1cf0e0aa28d09a327b6cbd8642c";
    const morpho = await ethers.getContractAt(
        ["function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)"],
        MORPHO
    );
    const pos = await morpho.position(MARKET_ID, MORPHO_PLUGIN);
    console.log("\n=== Morpho Blue Position (MorphoPlugin) ===");
    console.log("  supplyShares:", pos.supplyShares.toString());
    console.log("  borrowShares:", pos.borrowShares.toString());
    console.log("  collateral:", ethers.formatUnits(pos.collateral, 18), "WETH");

    // Vault shares
    const VAULTS = [
        ["HexaOne", "0xaE73875437c86abb60cD7fA77286D63cb94F9a25"],
        ["Clearstar", "0xa53Cf822FE93002aEaE16d395CD823Ece161a6AC"],
        ["Staging", "0xd2d46099B70880e268B0c7557b9D22d3AA848654"],
    ];
    const vaultAbi = ["function balanceOf(address) view returns (uint256)", "function convertToAssets(uint256) view returns (uint256)"];
    console.log("\n=== Vault Shares (MorphoVaultPlugin) ===");
    for (const [name, addr] of VAULTS) {
        const v = await ethers.getContractAt(vaultAbi, addr);
        const shares = await v.balanceOf(VAULT_PLUGIN);
        let assetsStr = "0";
        if (shares > 0n) {
            const assets = await v.convertToAssets(shares);
            assetsStr = ethers.formatUnits(assets, 6);
        }
        console.log(`  ${name}: ${shares} shares (${assetsStr} USDC)`);
    }

    // Deployer balance
    const [deployer] = await ethers.getSigners();
    console.log("\n=== Deployer ===");
    console.log("  Address:", deployer.address);
    console.log("  ETH:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
}

main().catch(console.error);
