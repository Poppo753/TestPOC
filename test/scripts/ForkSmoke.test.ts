import { expect } from "chai";
import { ethers } from "hardhat";
import { loadManifest } from "../../scripts/framework/manifest";
import type { ScriptRuntime } from "../../scripts/framework/types";
import { getSystemStatus } from "../../scripts/operations/monitoring/system-status";

const forkEnabled = process.env.FORK_ENABLED === "true";

(forkEnabled ? describe : describe.skip)("Operational scripts: fixed Arbitrum fork smoke", function () {
  this.timeout(300_000);

  it("reads the deployed system without a signer or state mutation", async function () {
    expect(process.env.FORK_BLOCK_NUMBER, "FORK_BLOCK_NUMBER must be fixed").to.match(/^\d+$/);
    const manifest = loadManifest("deployments/mainnet-latest.json");
    const runtime: ScriptRuntime = {
      provider: ethers.provider,
      chainId: 42161,
      networkName: "hardhat-fork",
      manifest,
      options: { execute: false, dryRun: true, encodeOnly: false, confirmations: 1, allowedChainIds: [42161] },
    };
    const blockBefore = await ethers.provider.getBlockNumber();
    const status = await getSystemStatus(runtime);
    expect(status.chainId).to.equal(42161);
    expect(status.modules.Beacon ?? status.modules.ProxyGeneral).to.not.equal(undefined);
    expect(await ethers.provider.getBlockNumber()).to.equal(blockBefore);
  });
});

