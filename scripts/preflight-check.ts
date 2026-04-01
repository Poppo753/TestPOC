import { ethers, network } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");
    const net = await ethers.provider.getNetwork();
    console.log("ChainId:", net.chainId.toString());
    console.log("Network:", network.name);

    // Check Beacon ownership
    const beacon = await ethers.getContractAt(
        ["function owner() view returns (address)"],
        "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870"
    );
    const beaconOwner = await beacon.owner();
    console.log("Beacon owner:", beaconOwner);
    console.log("Is deployer Beacon owner:", beaconOwner.toLowerCase() === deployer.address.toLowerCase());

    // Gas price
    const fee = await ethers.provider.getFeeData();
    console.log("gasPrice:", ethers.formatUnits(fee.gasPrice || 0n, "gwei"), "gwei");

    // Rough estimate: 3 deploys ~5M gas total + 6 txs ~300K gas = ~5.3M gas
    const estimatedGas = 5_300_000n;
    const gasPrice = fee.gasPrice || 100000000n; // fallback 0.1 gwei
    const estimatedCost = estimatedGas * gasPrice;
    console.log("Estimated deploy cost:", ethers.formatEther(estimatedCost), "ETH");
    console.log("Sufficient funds:", balance >= estimatedCost);
}

main().catch((e) => { console.error(e); process.exit(1); });
