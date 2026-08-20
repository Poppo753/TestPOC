# Revised dependency graph

## Architecture and implementation DAG

```mermaid
flowchart TB
  subgraph NOW[CAN START IMMEDIATELY]
    A[AUD-001..012 complete audit]
    G[GATE-001..005 send evidence requests]
    ADR[ARCH-001/002/011 + AA-001 + BACK-001 + WEB-001]
    BASE[ABI-001 + OPS-002A + WEB-001 + registry baseline]
    MIG1[MIG-001 immutable deployment/state snapshot]
  end

  subgraph EXT[EXTERNAL-GATE BLOCKED]
    CDPE[CDP ownership/delegation/recovery/3-chain evidence]
    SUME[Sumsub integrator + recipient compatibility]
    MONE[Monerium role/Gateway/SC-wallet/direct order]
    REAPE[Reap individual/role/Gateway/funding]
    X21E[21X retail/ACE/browser direct API]
  end

  subgraph LEG[LEGAL-GATE BLOCKED]
    L1[provider-role contracts]
    L2[MiCA/PSD2/MiFID/GDPR/marketing perimeter]
    L3[21X V2 specialist gate]
  end

  subgraph SEC[SECURITY-GATE BLOCKED]
    S0[MIG-002 legacy zero-loss runbook proof]
    S1[critical finding reachability closed]
    S2[exact plan/UserOp + registry + frontend threat tests]
  end

  A --> ADR
  A --> BASE
  A --> MIG1
  G --> CDPE & SUME & MONE & REAPE & X21E
  ADR --> REG[ARCH-004 verified registry]
  ADR --> ENG[shared domain/planner extraction]
  BASE --> ENG
  REG --> ENG
  CDPE --> WAL[CDP wallet/account adapter PoC]
  ENG --> SIM[decode/simulate/post-state]
  WAL --> SIM
  SIM --> AAVE[Aave direct supply/withdraw slice]
  AAVE --> MOR[Morpho Blue + MetaMorpho]
  AAVE --> EUL[Euler EVC PoC/adapter]
  AAVE --> DEX[direct DEX adapter]
  MIG1 --> S0 --> FREEZE[MIG-003 freeze ingress/allocation]
  FREEZE --> EXIT[MIG-004 authorized holder exit/unwind]
  EXIT --> DECOM[MIG-005 revoke/disposition/final snapshot]
  SIM --> S2
  AAVE --> S1
  SUME --> SUM[Sumsub sandbox]
  MONE --> MON[Monerium sandbox]
  REAPE --> REAP[Reap sandbox]
  X21E --> X21V1[21X external handoff]
  X21E --> L3 --> X21V2[21X embedded V2]
  SUM --> MON & REAP
  MON & REAP & X21V1 --> L1
  L1 --> L2
  DECOM & S1 & S2 & L2 --> BETA[real-money/public beta gate]
```

## Top implementation dependencies

| Order | Dependency | Blocks |
|---:|---|---|
| 1 | approved trust boundary and invariant ADR | every target package/service/connector |
| 2 | canonical executable-envelope/serialization decision | decode, simulation, CDP handoff, security tests |
| 3 | canonical frontend/package/backend ownership decision | code extraction and connector implementation |
| 4 | reproducible test/ABI baseline | safe reuse and regression evidence |
| 5 | verified chain/address/asset/ABI registry with provenance | every financial read/call |
| 6 | live deployment/state/holder/allowance snapshot | any legacy freeze/removal |
| 7 | CDP owner/delegation/batch/recovery proof | user execution and exitability |
| 8 | shared signer-free planner/simulator boundary | all direct protocol adapters |
| 9 | exact Aave supply/withdraw vertical slice | pattern approval for further DeFi adapters |
| 10 | provider/legal written gates | Sumsub/Monerium/Reap/21X production enablement |

## Gate semantics

- **CAN START IMMEDIATELY:** read-only evidence, ADRs, test repair, pure extraction, request preparation.
- **EXTERNAL-GATE BLOCKED:** acceptance requires written provider capability/credentials/sandbox evidence.
- **LEGAL-GATE BLOCKED:** implementation or enablement changes contractual/regulatory role and awaits qualified review.
- **SECURITY-GATE BLOCKED:** money/state must not move until a named invariant/test/evidence is satisfied.

An external provider gate does not block pure domain/registry/planner work. It does block connector behavior that would encode unconfirmed APIs or roles.

The legacy containment chain `MIG-001 → MIG-002 → MIG-003` depends on the pinned legacy ABI/test baseline, not on the new shared engine, CDP wallet or Aave adapter. Settlement/decommission follows only after separate production authorization and holder coordination; target construction continues in parallel.
