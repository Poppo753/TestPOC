import { expect } from "chai";
import { ethers } from "hardhat";
import { envAddress, envBigInt, envBoolean, envInteger, envJson, envString } from "../../scripts/framework/env";
import { cliBoolean, parseCliArguments, stringifyForOutput } from "../../scripts/framework/cli";
import { emptyManifest, normalizeLegacyManifest, validateManifest } from "../../scripts/framework/manifest";
import { buildCall, buildPlan } from "../../scripts/framework/plans";
import { executePlan } from "../../scripts/framework/transactions";
import type { Address, ScriptRuntime } from "../../scripts/framework/types";
import { withRpcRetry } from "../../scripts/framework/retry";

describe("Operational scripts: framework", function () {
  it("parses strict environment values and rejects ambiguity", function () {
    const env = { TEXT: " value ", BOOL: "yes", INT: "42", BIG: "9007199254740993000", ADDR: ethers.ZeroAddress, JSON: '{"ok":true}' };
    expect(envString(env, "TEXT")).to.equal("value");
    expect(envBoolean(env, "BOOL")).to.equal(true);
    expect(envInteger(env, "INT")).to.equal(42);
    expect(envBigInt(env, "BIG")).to.equal(9007199254740993000n);
    expect(envAddress(env, "ADDR")).to.equal(ethers.ZeroAddress);
    expect(envJson<{ ok: boolean }>(env, "JSON").ok).to.equal(true);
    expect(() => envBoolean({ BOOL: "sometimes" }, "BOOL")).to.throw("must be true or false");
  });

  it("parses both CLI syntaxes and boolean flags", function () {
    const parsed = parseCliArguments(["--network=arbitrum", "--execute", "false", "--dry-run"]);
    expect(parsed.network).to.equal("arbitrum");
    expect(cliBoolean(parsed, "execute")).to.equal(false);
    expect(cliBoolean(parsed, "dry-run")).to.equal(true);
  });

  it("normalizes a legacy manifest and validates addresses", function () {
    const manifest = normalizeLegacyManifest({
      network: "arbitrum", chainId: 42161,
      contracts: { beacon: "0x0000000000000000000000000000000000000001", weth: "0x0000000000000000000000000000000000000002" },
    });
    expect(manifest.schemaVersion).to.equal(1);
    expect(manifest.baseAsset.address).to.equal("0x0000000000000000000000000000000000000002");
    expect(() => validateManifest({ ...manifest, contracts: { bad: "invalid" as Address } })).to.throw("Invalid contract address");
  });

  it("builds dependency-checked JSON plans with bigint encoded as strings", function () {
    const target = "0x0000000000000000000000000000000000000001";
    const first = buildCall({ id: "one", description: "first", chainId: 42161, target, abi: ["function set(uint256)"], method: "set", args: [123n], value: 7n });
    const second = buildCall({ id: "two", description: "second", chainId: 42161, target, abi: ["function set(uint256)"], method: "set", args: [456n], dependsOn: ["one"] });
    const plan = buildPlan("test", 42161, [first, second]);
    expect(JSON.parse(stringifyForOutput(plan)).calls[0].value).to.equal("7");
    expect(() => buildPlan("bad", 42161, [{ ...second, dependsOn: ["missing"] }])).to.throw("earlier call");
  });

  it("encode-only and execute=false never send transactions", async function () {
    const [signer] = await ethers.getSigners();
    const manifest = emptyManifest({ network: "hardhat", chainId: 42161, baseAssetCode: "ETH", baseAssetAddress: ethers.ZeroAddress, baseAssetDecimals: 18 });
    const call = buildCall({ id: "noop", description: "approve zero", chainId: 42161, target: ethers.ZeroAddress, abi: ["function noop()"], method: "noop" });
    const runtime: ScriptRuntime = { provider: ethers.provider, signer, signerAddress: signer.address as Address, chainId: 42161, networkName: "hardhat", manifest,
      options: { execute: false, dryRun: false, encodeOnly: true, confirmations: 1, allowedChainIds: [42161] } };
    const nonce = await ethers.provider.getTransactionCount(signer.address);
    const result = await executePlan(runtime, buildPlan("no-send", 42161, [call]));
    expect(result.success).to.equal(true);
    expect(result.transactions[0].status).to.equal("planned");
    expect(await ethers.provider.getTransactionCount(signer.address)).to.equal(nonce);
  });

  it("executes calls in nonce order and stops after the first failure", async function () {
    const [signer] = await ethers.getSigners();
    const weth = await (await ethers.getContractFactory("MockWETH")).deploy();
    const target = await weth.getAddress();
    const abi = ["function deposit() payable", "function withdraw(uint256)"];
    const calls = [
      buildCall({ id: "fund", description: "fund", chainId: 42161, target, abi, method: "deposit", value: 1n }),
      buildCall({ id: "fail", description: "fail", chainId: 42161, target, abi, method: "withdraw", args: [2n], dependsOn: ["fund"] }),
      buildCall({ id: "must-not-run", description: "must not run", chainId: 42161, target, abi, method: "deposit", value: 1n, dependsOn: ["fail"] }),
    ];
    const manifest = emptyManifest({ network: "hardhat", chainId: 42161, baseAssetCode: "WETH", baseAssetAddress: target, baseAssetDecimals: 18 });
    const runtime: ScriptRuntime = { provider: ethers.provider, signer, signerAddress: signer.address as Address, chainId: 42161, networkName: "hardhat", manifest,
      options: { execute: true, dryRun: false, encodeOnly: false, confirmations: 1, allowedChainIds: [42161] } };
    const result = await executePlan(runtime, buildPlan("ordered", 42161, calls));
    expect(result.success).to.equal(false);
    expect(result.transactions.map(item => item.callId)).to.deep.equal(["fund"]);
    expect(await weth.balanceOf(signer.address)).to.equal(1n);
  });

  it("simulates a dependent multi-call on a snapshot and reverts all state", async function () {
    const [signer] = await ethers.getSigners();
    const weth = await (await ethers.getContractFactory("MockWETH")).deploy();
    const target = await weth.getAddress();
    const abi = ["function deposit() payable"];
    const calls = [
      buildCall({ id: "one", description: "one", chainId: 42161, target, abi, method: "deposit", value: 1n }),
      buildCall({ id: "two", description: "two", chainId: 42161, target, abi, method: "deposit", value: 1n, dependsOn: ["one"] }),
    ];
    const manifest = emptyManifest({ network: "hardhat", chainId: 42161, baseAssetCode: "WETH", baseAssetAddress: target, baseAssetDecimals: 18 });
    const runtime: ScriptRuntime = { provider: ethers.provider, signer, signerAddress: signer.address as Address, chainId: 42161, networkName: "hardhat", manifest,
      options: { execute: true, dryRun: true, encodeOnly: false, confirmations: 1, allowedChainIds: [42161] } };
    const result = await executePlan(runtime, buildPlan("snapshot", 42161, calls));
    expect(result.success).to.equal(true);
    expect(result.transactions.every(item => item.status === "simulated")).to.equal(true);
    expect(await weth.balanceOf(signer.address)).to.equal(0n);
  });

  it("retries transient read failures but never deterministic errors", async function () {
    let attempts = 0;
    const result = await withRpcRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error("429 rate limit");
      return "ok";
    }, { retries: 3, delayMs: 1 });
    expect(result).to.equal("ok");
    expect(attempts).to.equal(3);
    attempts = 0;
    let deterministic: Error | undefined;
    try { await withRpcRetry(async () => { attempts++; throw new Error("execution reverted"); }, { retries: 3, delayMs: 1 }); } catch (error) { deterministic = error as Error; }
    expect(deterministic?.message).to.equal("execution reverted");
    expect(attempts).to.equal(1);
  });
});
