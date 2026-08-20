import { ethers } from "hardhat";
async function main() {
    const b = await ethers.getContractAt(
        ["function getImplementation(string memory name) view returns (address)"],
        "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870"
    );
    for (const m of ["USDC", "WETH", "USDT", "DAI", "WBTC", "SimpleSwap", "TokenManager", "SwapManager"]) {
        try {
            const a = await b.getImplementation(m);
            console.log(`${m}: ${a}`);
        } catch {
            console.log(`${m}: NOT REGISTERED`);
        }
    }
}
main();
