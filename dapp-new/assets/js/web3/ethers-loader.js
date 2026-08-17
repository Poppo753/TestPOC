/**
 * Loads Ethers exactly once. Failure is surfaced to the UI; it is never turned
 * into an empty balance. Keeping the CDN boundary here makes a future switch to
 * a bundled dependency local to one module.
 */
let ethersPromise;
export function loadEthers() {
  if (!ethersPromise) {
    ethersPromise = import('https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm')
      .then((module) => module)
      .catch((error) => {
        ethersPromise = undefined;
        throw new Error(`Unable to load the web3 library: ${error.message}`);
      });
  }
  return ethersPromise;
}

