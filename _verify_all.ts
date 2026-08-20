import { ethers } from "hardhat";

async function main() {
  const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
  const beacon = await ethers.getContractAt(
    ["function getImplementation(string) view returns (address)", "function owner() view returns (address)"],
    BEACON
  );

  // All keys that contracts use via beacon.getImplementation(...)
  const REQUIRED_KEYS = [
    "WETH",
    "ProxyGeneral",
    "TokenManager",
    "ProtocolManager",
    "LiquidityManager",
    "ValueCalculator",
    "SwapManager",
    "ParameterManager",
    "EulerRegistry",
    "EulerLensAdapter",
    "FlashLoanService",
    "EmergencyHandler",
  ];

  // Expected addresses from mainnet-latest.json + deploy history
  const EXPECTED: Record<string, string> = {
    "WETH": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    "ProxyGeneral": "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1",
    "TokenManager": "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517",
    "ProtocolManager": "", // will just check non-zero
    "LiquidityManager": "0x545b79254F74Ba33958290BB73F2a338509c975d",
    "ValueCalculator": "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B",
    "SwapManager": "0x01269d496E957A54e02cdcd5888957baf317A947", // or newer
    "ParameterManager": "0xe5401565c77B41A5206e3E1b6A2b7F54E93bED5e",
    "EulerRegistry": "0xe55c78577c84E2cB6E71F8Eb134a66e7B1d9fd56",
    "EulerLensAdapter": "0x55d4dC6536Ddcb62AeDd4A9275Cf96aa15e24353", // or newer
    "FlashLoanService": "0x638C0175a1883063F22fc2439C85364e4aC27b03",
    "EmergencyHandler": "0xcaf7DD1cA3A5857893D97BA3A9C029986A5CAc66",
  };

  console.log("=== BEACON REGISTRATION CHECK ===");
  console.log(`Beacon: ${BEACON}`);
  const owner = await beacon.owner();
  console.log(`Beacon Owner: ${owner}\n`);

  let allGood = true;
  for (const key of REQUIRED_KEYS) {
    try {
      const addr = await beacon.getImplementation(key);
      const isZero = addr === ethers.ZeroAddress;
      const expected = EXPECTED[key];
      let status = "";

      if (isZero) {
        status = "❌ NOT REGISTERED";
        allGood = false;
      } else if (expected && expected !== "" && addr.toLowerCase() !== expected.toLowerCase()) {
        status = `⚠️ MISMATCH (expected ${expected})`;
        allGood = false;
      } else {
        status = "✅";
      }

      console.log(`${key.padEnd(20)} ${addr}  ${status}`);
    } catch (e: any) {
      console.log(`${key.padEnd(20)} ERROR: ${e.message}`);
      allGood = false;
    }
  }

  // Check EulerPlugin in Beacon
  console.log("\n=== EULER V2 PLUGIN CHECK ===");
  try {
    const pluginAddr = await beacon.getImplementation("EulerV2Plugin");
    console.log(`EulerV2Plugin         ${pluginAddr}  ${pluginAddr !== ethers.ZeroAddress ? "✅" : "❌"}`);
  } catch {
    console.log("EulerV2Plugin         not registered (may use different key)");
  }

  // Check FlashLoanService internals
  console.log("\n=== FLASHLOAN SERVICE CHECK ===");
  const FLS = "0x638C0175a1883063F22fc2439C85364e4aC27b03";
  const fls = await ethers.getContractAt(
    ["function beacon() view returns (address)", "function SIMPLE_SWAP() view returns (address)", "function BALANCER_VAULT() view returns (address)"],
    FLS
  );
  const flsBeacon = await fls.beacon();
  const simpleSwap = await fls.SIMPLE_SWAP();
  const balancerVault = await fls.BALANCER_VAULT();
  console.log(`FlashLoanService Beacon:   ${flsBeacon}  ${flsBeacon.toLowerCase() === BEACON.toLowerCase() ? "✅" : "❌"}`);
  console.log(`SimpleSwap (hardcoded):    ${simpleSwap}  ${simpleSwap !== ethers.ZeroAddress ? "✅" : "❌"}`);
  console.log(`Balancer Vault:            ${balancerVault}  ${balancerVault !== ethers.ZeroAddress ? "✅" : "❌"}`);

  // Check EulerRegistry internals
  console.log("\n=== EULER REGISTRY CHECK ===");
  const ER = "0xe55c78577c84E2cB6E71F8Eb134a66e7B1d9fd56";
  const er = await ethers.getContractAt(
    ["function owner() view returns (address)", "function getVault(string) view returns (address)"],
    ER
  );
  const erOwner = await er.owner();
  const wethVault = await er.getVault("WETH");
  const usdcVault = await er.getVault("USDC");
  console.log(`EulerRegistry Owner:       ${erOwner}`);
  console.log(`WETH Vault:                ${wethVault}  ${wethVault !== ethers.ZeroAddress ? "✅" : "❌"}`);
  console.log(`USDC Vault:                ${usdcVault}  ${usdcVault !== ethers.ZeroAddress ? "✅" : "❌"}`);

  // Check EulerLensAdapter
  console.log("\n=== EULER LENS ADAPTER CHECK ===");
  const elaAddr = await beacon.getImplementation("EulerLensAdapter");
  if (elaAddr !== ethers.ZeroAddress) {
    const ela = await ethers.getContractAt(
      ["function eulerRegistry() view returns (address)"],
      elaAddr
    );
    try {
      const elaRegistry = await ela.eulerRegistry();
      const registryMatch = elaRegistry.toLowerCase() === ER.toLowerCase();
      console.log(`EulerLensAdapter Registry: ${elaRegistry}  ${registryMatch ? "✅" : "⚠️ points to OLD registry!"}`);
    } catch {
      console.log("Could not read eulerRegistry from EulerLensAdapter");
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(allGood ? "✅ ALL BEACON REGISTRATIONS OK" : "⚠️ SOME ISSUES FOUND — review above");
}

main().catch(console.error);
