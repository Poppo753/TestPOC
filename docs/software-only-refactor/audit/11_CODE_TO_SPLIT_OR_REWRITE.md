# Code to split or rewrite

## Split boundaries

| Current component | Keep/extract | Rewrite/remove | Dependency before change |
|---|---|---|---|
| `ProxyGeneral` | validation/rate/authorization test vectors | custody, LPT, authorized asset movement | migration snapshot and exit plan |
| `Liquiditymanager` | amount/rounding/min-output properties | global NAV/share deposit/withdraw | legacy safety tests |
| `ProtocolManager` | action/capability/selector inventory | privileged routing and plugin execution | ABI reconciliation + direct-adapter contract |
| `ParameterManager` | typed limits and validation | global discretionary financial config | RuleSet schema |
| `ValueCalculator` | decimals/oracle/position normalization | pooled NAV and fail-open aggregation | pricing and reader interfaces |
| `SwapManager` | slippage/balance/approval/error invariants | plugin selection and pooled approvals | DEX adapter/simulation |
| `EulerRegistry` | verified vault metadata | global subaccount allocation | CDP/EVC PoC |
| `scripts/framework` | pure plan/types/encode/validate/simulation contracts | Hardhat/Node/signing/filesystem dependencies | package ADR + pinned protocol ABIs |
| automation | observer/risk/notification and deterministic rule fragments | fixed allocations, pooled plan, direct/Safe execution | explicit user RuleSet and account readers |
| web app transaction modules | wallet lifecycle, receipt/event UI | vault calls and independently calculated preview | canonical plan/review APIs |
| wallet modules | EIP-1193 read/connect/switch | implicit EOA-only send model | CDP account adapter and chain model |
| deployment config | environment validation | copied Arbitrum constants | versioned registry loader |
| demo engine | pure decimal/rounding examples | local “portfolio” as financial truth | domain types and labeling |
| Hardhat tests | universal invariants + migration regression | obsolete target assertions | property disposition map |
| CI | working workflow/tool setup | stale globs/files and incomplete scopes | reproducibility baseline |
| generated artifacts | deployment evidence | target codegen from stale Jethos ABIs | artifact provenance policy |

## Required target interfaces

```ts
type AssetId = { chainId: number; address: `0x${string}` };
type AccountId = { chainId: number; address: `0x${string}`; kind: "cdp-smart-account" };

type PlannedCall = {
  chainId: number;
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
  capability: string;
};

interface ProtocolAdapter<C, P> {
  readPosition(ctx: { account: AccountId; atBlock: bigint }, config: C): Promise<P>;
  buildSupply(input: unknown, ctx: BuildContext): PlannedCall[];
  buildWithdraw(input: unknown, ctx: BuildContext): PlannedCall[];
  explain(calls: readonly PlannedCall[], registry: RegistrySnapshot): Explanation;
}
```

The adapter cannot receive a signer or submit transactions. Concrete types replace `unknown`; the sketch shows the architectural capability boundary only.

## Canonical plan contract

The shared engine owns one immutable canonical object containing user input provenance, normalized amounts, registry version/hash, chain/account, ordered calls, dependency and atomicity graph, assumptions, deadline, and expected post-state. It produces:

1. a deterministic serialization and fingerprint;
2. a decoded neutral explanation;
3. a block-bound simulation request/result;
4. account-specific executable calldata;
5. a proof that the executable calldata decodes to the same call graph;
6. post-state checks and a receipt reference.

Presentation never rebuilds calldata. Wallet code never substitutes calls. Provider-control-plane code cannot import the executable wallet adapter.

## Rewrite triggers

- Formula has a confirmed finding or cannot be differentially verified: rewrite from protocol specification/test vectors.
- File mixes browser-safe pure logic with Node fs/Hardhat signer: split by import boundary.
- Component assumes global symbol/chain/account: rewrite the type boundary before porting behavior.
- Test validates the obsolete pool but expresses a universal safety property: write a new target test, keep old test until migration closes.
- UI produces personalized/fixed allocation: replace with explicit input and neutral objective data, not a rename.
