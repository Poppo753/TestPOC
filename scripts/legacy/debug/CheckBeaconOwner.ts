import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";

async function main() {
  const [signer] = await ethers.getSigners();
  
  const beacon = await ethers.getContractAt(
    ["function owner() external view returns (address)"],
    BEACON
  );
  
  const owner = await beacon.owner();
  
  console.log(`\nBeacon: ${BEACON}`);
  console.log(`Owner: ${owner}`);
  console.log(`Signer: ${signer.address}`);
  console.log(`Is Owner: ${owner.toLowerCase() === signer.address.toLowerCase()}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
