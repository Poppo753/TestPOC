# State and deployment migration

## Evidence currently available

| Evidence | Fact | Limitation |
|---|---|---|
| `deployments/mainnet-latest.json` | April Arbitrum address family exists; observed pool state zero | source/live code differ; not proof of all historical users/allowances |
| `.env.mainnet` | contains another partial configuration | diverges from recorded deployment on multiple modules |
| `scripts/manifests/arbitrum-usdc-poc-1.json` | July PoC address family and 22 deployment tx hashes | no source commit or code hash |
| current frontend constants | point to July PoC family | copied, not generated/verified against live bytecode |
| read-only PoC query | 3.1 USDC in PG, 3.1 LPT, one positive holder equal owner/deployer, four net-zero protocols | queried at `latest` on 2026-08-17; block, RPC identity and literal command were not archived, so this is indicative audit evidence, not migration-grade evidence |
| owner reads | 21 components owned by one EOA | same non-reproducible `latest` observation; no multisig/timelock; ownership may change after snapshot |
| repository | no product DB/backend | cannot prove absence of off-repository support/user records |

The audit does not assert external users. It also does not assert their absence. The 3.1 USDC appears to be operator test capital, an inference that must be signed off with complete event and operational evidence. None of the 2026-08-17 live values may authorize a mutation; `MIG-001` must reproduce them at one finalized block through two named RPC sources with the exact command and runtime code hashes.

## Migration ledger required by `MIG-001`

For every known address family record: chain ID; deployment/verification block; contract address; runtime code hash and matched source/artifact commit; owner/operator/authorized modules; Beacon route/history; pause/operation flags; native/ERC-20 balances; LPT supply and holders; allowances from/to each component; active registries/markets; protocol positions/debt/shares; relevant events; and snapshot RPC/block/timestamp.

Search scope includes April, July, `.env.mainnet`, frontend copies, Git history, explorer-labelled deployments, and operator records. A manifest without code hash/source commit is incomplete.

## Ordered migration

### M1 — Establish immutable evidence (`MIG-001`)

- Re-run diagnostics at a finalized block through at least two RPC sources.
- Reconcile the three address/config families.
- Match every runtime bytecode hash to an artifact/commit or label it unknown.
- Enumerate all LPT holders from genesis transfer events and current state.
- Enumerate ERC-20 approvals and protocol positions, including plugin/subaccounts.

Rollback: none required; read-only. Completion: signed machine-readable snapshot and human review.

### M2 — Prove exit and approve the runbook (`MIG-002`)

- Simulate each holder redemption on a fork at the snapshot block.
- If protocol debt/position exists, simulate protocol-native close/unwind in the correct order.
- Reproduce/guard the partial-payout/full-burn defect; never ask a user to exit through a lossy path.
- Define a user-driven alternative/make-whole procedure, per-step expected deltas, signer, monitoring and stop/rollback triggers before changing ingress.
- Obtain the security/operator review of the runbook; do not execute a production redemption in this proof task.

Rollback: restore fork snapshot; production remains unchanged. Completion: signed zero-loss exit plan per holder/position. This proof uses the legacy ABI/test baseline and does not depend on the new shared engine, CDP, or Aave target path.

### M3 — Stop new exposure immediately after proof (`MIG-003`)

- Announce and set deposit ingress off using the verified legacy control path.
- Preserve withdrawals only if the exact deployed version is proven safe for the holder state.
- Freeze automation/direct allocation and new borrowing/leverage.
- Monitor attempted deposits and state changes.

Rollback: only through a reviewed owner action if the freeze itself prevents safe exit. Completion: no new deposits/positions after an agreed block. This containment lane must not wait for target engine, CDP, or Aave implementation.

### M4 — Execute user/operator exit (`MIG-004`)

- The observed owner/deployer redeems the 3.1 LPT/USDC only after fork proof.
- Notify/assist any newly discovered holder through the user-driven exit route.
- Close/redeem protocol positions and return assets to the rightful holder; do not migrate into a new pooled vehicle.
- Verify balances, supply, debts, shares, events and receipts after each action.

Rollback: pre-defined per transaction; no bulk irreversible batch without intermediate checks. Completion: all user claims settled and protocol state zero.

### M5 — Revoke, disposition and attest (`MIG-005`)

- Revoke token/router/protocol/plugin allowances.
- Deauthorize modules and operators in a dependency-safe order.
- Freeze Beacon entries or mark them permanently legacy; do not repoint stateful names as an “upgrade”.
- Transfer/renounce ownership only after confirming it cannot block residual recovery.
- Remove frontend entry points and publish direct protocol recovery metadata.

Rollback: retain only a named, time-bounded recovery owner until the challenge/observation window ends; actions require dual review. Completion: zero asset/debt/supply/allowance, no ingress, no product consumer, final snapshot.

## Separate target exit proof (`MIG-006`)

After the CDP+Aave vertical slice exists, disable Jethos services and prove account recovery plus protocol-native withdrawal against the exact approved envelope and receipt. This target test is not a prerequisite for freezing the legacy pool; conversely, it cannot be used to auto-reinvest a legacy redemption.

## User-driven target migration

There is no legitimate automatic conversion from LPT to a user-owned Aave/Morpho/Euler position. The legacy claim is redeemed to the user's wallet. The user then separately reviews and authorizes a new direct protocol plan. Combining redemption and reinvestment would hide a new investment action and preserve pooled coupling.

## State that does not migrate

- LPT balances/supply and global NAV;
- owner target allocations, pooled strategy state, and global user-risk classification;
- Beacon/Parameter/Token registry state as target authority;
- plugin-owned position identity;
- off-chain automation execution authority.

Historical receipts, consent/audit evidence, deployment hashes, and security findings are retained under documented retention rules.

## Emergency and rollback constraints

The current emergency functions cannot be assumed reliable: interfaces drift, close semantics differ, and silent catches exist. Every production mutation requires encode-only output, independent decode, fork simulation at the current snapshot, named signer/owner, expected balance deltas, and a stop condition. No audit task authorizes executing these mutations.
