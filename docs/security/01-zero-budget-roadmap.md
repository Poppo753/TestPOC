# Roadmap "zero budget, tanto tempo" — dal livello 0 al top

**Ultimo aggiornamento:** 2026-07-15
**Vincolo:** budget = €0. Solo tool open source, community bounty, contest audit gratuiti.
**Assunzione:** 1 sviluppatore full-time, 20+ ore/settimana dedicate a security. Codebase target: `C:/Personal/TestPOC/contracts/` (23k LOC).
**Obiettivo finale:** raggiungere livello di sicurezza equivalente ad audit boutique ($30-80k) **senza spendere un euro**.

Complementare a `00-security-tools-overview.md` (spiega **cosa** sono i tool). Questo documento spiega **come** implementarli in ordine e in tempi realistici.

---

## Vincoli e cosa lasciamo fuori

| Cosa NON avremo (senza soldi) | Alternativa gratuita |
|------------------------------|---------------------|
| Certora Prover (formal verification pagata) | Halmos (a16z, gratis) + SMTChecker (built-in Solidity) |
| Trail of Bits audit ($100k+) | Code4rena / CodeHawks / Sherlock contest (audit crowd) |
| OpenZeppelin audit ($80k+) | Cantina community-driven / auto-audit rigoroso |
| Immunefi bounty pagata (~$500/mese base + payouts) | GitHub bug bounty via issue template + engagement Twitter/Discord |
| Tenderly premium (~$100/mese) | Anvil + Foundry + fork tests locali |
| Slither Enterprise / SonarQube DeFi | Slither community + custom detector Python |

**Cosa NON possiamo compensare gratis:**
- **Audit boutique senior** — nessuno lavora gratis 6 settimane con senior auditor. Alternativa: Code4rena/Cantina contest (community giudica).
- **Formal verification esaustiva** — Certora è irrimpiazzabile per progetti $10M+. Alternativa: Halmos su parti critiche, non su tutto.

**Cosa possiamo comunque raggiungere:** ~85-90% del livello di sicurezza di un audit boutique, in scambio di **6-9 mesi di lavoro** invece di 6 settimane.

---

## Fase overview

| Fase | Durata | Focus | Deliverable | Tool |
|------|--------|-------|-------------|------|
| **Fase 0** | 1 sett | Baseline static | CI verde con Slither+Aderyn | Slither, Aderyn, SMTChecker |
| **Fase 1** | 2 sett | Foundry setup + migrazione | Foundry integrato, 20+ fuzz tests | Foundry |
| **Fase 2** | 3 sett | Invariant testing avversario | 5 invariant + handler ostile | Foundry invariant |
| **Fase 3** | 2 sett | Echidna e Medusa | 3+ property Echidna, corpus salvato | Echidna, Medusa |
| **Fase 4** | 2 sett | Formal verification light | Halmos su formule critiche | Halmos, SMTChecker |
| **Fase 5** | 1 sett | MEV & concurrency | Sandwich/front-run test | Anvil mempool |
| **Fase 6** | 3 sett | Fix systematic dei findings | Ridotta backlog ISSUES.md | Fix code + rerun |
| **Fase 7** | 2 sett | Preparazione audit community | Repo pronta per Code4rena | Documentazione, tests |
| **Fase 8** | 4 sett | Contest audit (Code4rena/Cantina) | Bug findings esterni | Community |
| **Fase 9** | 2 sett | Post-contest remediation | Fix + regression + monitoring | Full stack |
| **Fase 10** | ongoing | Maintenance + monitoring | CI, alerts, bug bounty | GitHub bounty, Immunefi free tier |

**Totale**: ~5-6 mesi di lavoro full-part-time per raggiungere livello "audit-ready public".

---

## FASE 0 — Baseline static analysis (1 settimana)

### Obiettivi
- CI GitHub Actions con Slither, Aderyn, SMTChecker attivi
- Fail-fast: PR bloccato su HIGH findings
- ~30-40% dei bug attuali catturati automaticamente

### Deliverable
- `.github/workflows/security.yml`
- `slither.config.json` + `.slitherrc`
- Report iniziale: `docs/security/reports/00-slither-baseline.md`

### Step-by-step

**Giorno 1 — Slither**
```bash
# Setup Python env
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install slither-analyzer

# First run — baseline
cd C:/Personal/TestPOC
slither . --exclude-informational > docs/security/reports/00-slither-baseline.txt 2>&1
```

Analizza l'output. Per ogni HIGH:
- Se è **vero bug** → aggiungi a ISSUES.md
- Se è **falso positivo** → aggiungi a `slither.config.json` in `filter_paths` o `detectors_to_exclude`

Crea `slither.config.json`:
```json
{
  "detectors_to_exclude": "naming-convention,solc-version,pragma,assembly,too-many-digits",
  "filter_paths": "test/,contracts/mocks/,contracts/old/,node_modules/",
  "exclude_informational": true,
  "exclude_low": false,
  "fail_on": "high"
}
```

**Giorno 2 — Aderyn**
```bash
# Install Rust se non presente
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install aderyn

# Run
aderyn .  # produce report.md
mv report.md docs/security/reports/01-aderyn-baseline.md
```

Confronta output con Slither. Molti findings overlappano ma alcuni sono complementari.

**Giorno 3 — SMTChecker (built-in solc)**

Aggiungi a `hardhat.config.ts`:
```typescript
solidity: {
  version: "0.8.19",
  settings: {
    optimizer: { enabled: true, runs: 200 },
    modelChecker: {
      engine: "chc",
      timeout: 30000,
      targets: ["assert", "underflow", "overflow", "divByZero", "constantCondition"],
      contracts: {
        "contracts/LiquidityManager.sol": ["LiquidityManager"],
        "contracts/plugins/MorphoPlugin.sol": ["MorphoPlugin"],
        "contracts/ValueCalculator.sol": ["ValueCalculator"],
      }
    }
  }
}
```

Run `npx hardhat compile` — SMTChecker gira automaticamente. Warnings vanno nel report.

**Giorno 4-5 — CI integration**

`.github/workflows/security.yml`:
```yaml
name: Security checks
on:
  pull_request:
  push:
    branches: [main]

jobs:
  slither:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: crytic/slither-action@v0.4.0
        with:
          fail-on: high
          slither-config: slither.config.json

  aderyn:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cyfrin/aderyn-action@v1

  compile-smt:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx hardhat compile
```

**Giorno 6-7 — Triage + fix low-hanging**

- Fix tutti gli **HIGH** di Slither/Aderyn che sono veri bug
- Documenta gli esclusi (falsi positivi) con `// slither-disable-next-line X` inline
- Aggiorna `ISSUES.md` con lo status di ogni finding

### Metriche di successo Fase 0
- ✅ CI verde
- ✅ 0 HIGH Slither/Aderyn non giustificati
- ✅ Report baseline salvati in `docs/security/reports/`

---

## FASE 1 — Foundry setup + property tests base (2 settimane)

### Obiettivi
- Foundry installato e configurato
- Test critici migrati da Hardhat a Foundry (LP accounting, HF, swap)
- 20+ fuzz test property-based sui contratti core

### Deliverable
- `foundry.toml` configurato
- Cartella `test-foundry/` con >20 fuzz test
- Helper contracts: `test-foundry/helpers/`

### Step-by-step

**Settimana 1 — Setup**

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

`foundry.toml`:
```toml
[profile.default]
src = "contracts"
out = "out-foundry"
libs = ["node_modules", "lib"]
test = "test-foundry"
solc_version = "0.8.19"
optimizer = true
optimizer_runs = 200

[fuzz]
runs = 10000
max_test_rejects = 65536
seed = "0x1"

[invariant]
runs = 500
depth = 100
fail_on_revert = false
call_override = false

[profile.ci]
fuzz.runs = 100000
invariant.runs = 2000
invariant.depth = 200

[rpc_endpoints]
arbitrum = "${ARB_RPC_URL}"
```

**Fork setup — usa RPC pubblico gratis (Alchemy free tier 300M compute units/mese, o public RPC):**
```bash
# .env
ARB_RPC_URL=https://arb1.arbitrum.io/rpc  # pubblico gratis
# oppure con Alchemy free tier:
# ARB_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_FREE_KEY
```

**Settimana 1 giorni 3-5 — Fuzz test critici**

Priorità: **PLG-005 (HF scale bug)** — questo test dovrebbe FALLIRE al primo run se il bug esiste ancora.

`test-foundry/plugins/MorphoPlugin.hf.fuzz.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "contracts/plugins/MorphoPlugin.sol";
import "./helpers/Deploy.sol";

contract MorphoPluginHFFuzz is Test, Deploy {
    MorphoPlugin plugin;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("arbitrum"), 200_000_000);
        plugin = _deployMorphoPluginOnFork();
    }

    /// @notice HF ritornato DEVE essere in scala WAD (1e18)
    /// @dev PLG-005: attualmente ritorna un intero (divide per WAD in più)
    function testFuzz_HF_alwaysInWADScale(
        uint256 collateral,
        uint256 leverage
    ) public {
        collateral = bound(collateral, 0.01 ether, 10 ether);
        leverage = bound(leverage, 110, 300);

        // Setup: fund plugin, open position
        deal(WETH, address(this), collateral);
        IERC20(WETH).approve(address(plugin), collateral);

        try plugin.openLeverageAtomic(MorphoPlugin.OpenLeverageAtomicParams({
            collateralToken: "WETH",
            borrowToken: "USDC",
            collateralAmount: collateral,
            targetLeverageX100: leverage,
            minHealthFactor: 1.05e18,  // ← WAD scale (1.05)
            deadline: block.timestamp + 1 hours
        })) {
            uint256 hf = plugin.getHealthFactor("WETH", "USDC");
            assertGe(hf, 1.05e18, "HF must be >= 1.05e18 (WAD)");
            assertLt(hf, 100e18, "HF must be < 100 (sanity)");
        } catch (bytes memory reason) {
            emit log_bytes(reason);
            revert("openLeverageAtomic reverted - HF bug likely");
        }
    }
}
```

Run:
```bash
forge test --match-path "*MorphoPlugin.hf.fuzz*" --fork-url arbitrum -vvv
```

**Al primo run, questo test DEVE fallire** perché PLG-005 esiste. È il "canary" per il fix.

**Settimana 2 — Altri fuzz test critici**

Priorità di scrittura:
1. **HF fuzz** per tutti i plugin (Aave, Euler, Morpho, MorphoVault)
2. **Swap slippage fuzz**: `testFuzz_swap_respectsMinAmountOut(...)` — cattura CORE-002, ADP-027
3. **Withdraw fuzz**: `testFuzz_withdraw_neverClampsSilently(...)` — cattura CORE-003
4. **Rounding direction fuzz**: `testFuzz_deposit_roundsInPoolFavor(...)`
5. **Access control fuzz**: `testFuzz_closePosition_onlyAuthorized(...)` — cattura PLG-007

### Metriche di successo Fase 1
- ✅ Foundry integrato, `forge test` verde per test happy path esistenti
- ✅ 20+ fuzz test scritti
- ✅ Test canary PLG-005 FAIL (segnala il bug prima del fix)
- ✅ CI aggiornato con `forge test --fuzz-runs 10000`

---

## FASE 2 — Invariant testing avversario (3 settimane)

### Obiettivi
- Handler `LPHandler` con azioni ostili
- 5+ invariant globali
- Cattura NEW-001, NEW-002, NEW-003 senza intervento umano

### Deliverable
- `test-foundry/invariants/` con 5 invariant test
- `test-foundry/handlers/LPHandler.sol`, `OracleHandler.sol`

### Step-by-step

**Settimana 1 — Handler ostile**

`test-foundry/handlers/LPHandler.sol`:
```solidity
contract LPHandler is Test {
    LiquidityManager lm;
    ProxyGeneral proxy;
    IERC20 baseAsset;
    address[] users;

    // Ghost variables — Foundry le esporta per gli invariant
    uint256 public ghost_sumDeposits;
    uint256 public ghost_sumWithdrawals;
    uint256 public ghost_sumDonations;
    mapping(bytes32 => uint256) public callCount;

    modifier countCall(bytes32 name) {
        callCount[name]++;
        _;
    }

    constructor(LiquidityManager _lm, ProxyGeneral _proxy) {
        lm = _lm;
        proxy = _proxy;
        baseAsset = IERC20(proxy.baseAsset());
        for (uint i = 0; i < 10; i++) {
            users.push(makeAddr(string.concat("user", vm.toString(i))));
        }
    }

    // Azione onesta 1
    function deposit(uint256 amount, uint256 userSeed) external countCall("deposit") {
        address user = users[userSeed % users.length];
        amount = bound(amount, 1e6, 1000e18);
        deal(address(baseAsset), user, amount);

        vm.prank(user);
        baseAsset.approve(address(lm), amount);
        vm.prank(user);
        try lm.deposit(amount) returns (uint256) {
            ghost_sumDeposits += amount;
        } catch {}
    }

    // Azione onesta 2
    function withdraw(uint256 shares, uint256 userSeed) external countCall("withdraw") {
        address user = users[userSeed % users.length];
        uint256 userShares = proxy.balanceOf(user);
        if (userShares == 0) return;
        shares = bound(shares, 1, userShares);

        vm.prank(user);
        try lm.withdraw(shares) returns (uint256 got) {
            ghost_sumWithdrawals += got;
        } catch {}
    }

    // ═══ ATTACCHI ══════════════════════════════════════════

    // NEW-002 / NEW-003 — donazione diretta al proxy
    function donateBaseAsset(uint256 amount) external countCall("donate") {
        amount = bound(amount, 1, 100e18);
        deal(address(baseAsset), address(this), amount);
        baseAsset.transfer(address(proxy), amount);
        ghost_sumDonations += amount;
    }

    function donateActiveToken(uint256 amount, uint256 tokenSeed) external countCall("donate_token") {
        // Simula donazione di token secondario per inflazionare NAV
        address[] memory activeTokens = _getActiveTokens();
        if (activeTokens.length == 0) return;
        address token = activeTokens[tokenSeed % activeTokens.length];
        amount = bound(amount, 1, 100e18);
        deal(token, address(this), amount);
        IERC20(token).transfer(address(proxy), amount);
    }

    // NEW-001 — sandwich del primo deposit
    function firstDepositAttack() external countCall("first_deposit") {
        if (proxy.totalSupply() > 0) return;
        // Deposit 1 wei per bootstrap
        vm.prank(users[0]);
        deal(address(baseAsset), users[0], 1);
        vm.prank(users[0]);
        baseAsset.approve(address(lm), 1);
        vm.prank(users[0]);
        try lm.deposit(1) {} catch { return; }
        // Ora dona per gonfiare NAV
        deal(address(baseAsset), address(this), 1e18);
        baseAsset.transfer(address(proxy), 1e18);
    }

    function _getActiveTokens() internal view returns (address[] memory) { ... }
}
```

**Settimana 2 — Invariant globali**

`test-foundry/invariants/LPAccounting.invariant.t.sol`:
```solidity
contract LPAccountingInvariant is Test {
    LPHandler handler;
    LiquidityManager lm;
    ProxyGeneral proxy;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("arbitrum"), 200_000_000);
        // Deploy fresh pool
        (lm, proxy) = _deployPool();
        handler = new LPHandler(lm, proxy);

        targetContract(address(handler));

        // Restringi selezione delle funzioni a chiamare
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = LPHandler.deposit.selector;
        selectors[1] = LPHandler.withdraw.selector;
        selectors[2] = LPHandler.donateBaseAsset.selector;
        selectors[3] = LPHandler.donateActiveToken.selector;
        selectors[4] = LPHandler.firstDepositAttack.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    // ═══ INVARIANT 1: contabilità coerente ═══
    /// sum(user shares) == totalSupply
    function invariant_shareAccounting() public view {
        // ...
        assertEq(_sumUserShares(), proxy.totalSupply());
    }

    // ═══ INVARIANT 2: price-per-share bounded ═══
    /// Il PPS non deve crescere oltre X% del baseline
    /// (le donazioni NON devono aumentare il PPS legittimamente)
    function invariant_ppsBoundedByYield() public view {
        if (proxy.totalSupply() == 0) return;
        uint256 pps = lm.getTotalValue() * 1e18 / proxy.totalSupply();
        // baseline: 1:1 al bootstrap
        assertLe(pps, 1.1e18, "PPS inflated beyond expected yield");
    }

    // ═══ INVARIANT 3: no fund leakage ═══
    /// TVL == depositi - withdrawals + donazioni tracciate
    function invariant_noFundLeakage() public view {
        uint256 poolValue = lm.getTotalValue();
        uint256 expected = handler.ghost_sumDeposits()
                         - handler.ghost_sumWithdrawals()
                         + handler.ghost_sumDonations();
        assertApproxEqRel(poolValue, expected, 0.001e18); // 0.1% tolerance
    }

    // ═══ INVARIANT 4: nessun utente perde più di quanto deposita ═══
    function invariant_userCannotLoseMoreThanDeposit() public view {
        for (uint256 i = 0; i < 10; i++) {
            address user = handler.users(i);
            uint256 currentValue = _userValue(user);
            uint256 deposited = handler.userDeposits(user);
            uint256 withdrawn = handler.userWithdrawals(user);
            // (deposited - withdrawn) - currentValue = perdita
            // deve essere <= depositi (mai perdite oltre il capitale)
            if (deposited > withdrawn) {
                assertLe(deposited - withdrawn - currentValue, deposited);
            }
        }
    }

    // ═══ INVARIANT 5: emergency path funzionante ═══
    function invariant_emergencyWithdrawWorks() public {
        // Force pause, try emergency withdraw, verify balance moves
        // (questo test cattura CORE-001 automaticamente)
        if (proxy.totalSupply() == 0) return;

        address emergencyContact = _getEmergencyContact();
        vm.prank(emergencyContact);
        try IEmergencyHandler(_getEmergency()).emergencyPause() {} catch {}

        uint256 ownerBalBefore = baseAsset.balanceOf(_owner());
        vm.prank(_owner());
        try IEmergencyHandler(_getEmergency()).emergencyWithdraw() {} catch {}
        uint256 ownerBalAfter = baseAsset.balanceOf(_owner());

        // Se il proxy aveva balance > 0, owner deve aver ricevuto
        // se pool non-empty, questa asserzione fallisce con CORE-001 attivo
        if (baseAsset.balanceOf(address(proxy)) > 0) {
            assertGt(ownerBalAfter, ownerBalBefore, "Emergency withdraw silent failure");
        }
    }

    // ═══ Statistiche runtime ═══
    function invariant_callSummary() public view {
        console.log("deposits: %d", handler.callCount("deposit"));
        console.log("withdraws: %d", handler.callCount("withdraw"));
        console.log("donations: %d", handler.callCount("donate"));
    }
}
```

**Settimana 3 — Esegui, analizza, itera**

```bash
forge test --match-contract LPAccountingInvariant --invariant-runs 500 --invariant-depth 100 -vv
```

Ogni failure produce una **shrink sequence** — la minima sequenza di azioni che rompe l'invariant. Salvala nel test come regression:

```solidity
function test_regression_NEW001() public {
    handler.firstDepositAttack();
    handler.deposit(2e18, 0);
    handler.withdraw(proxy.balanceOf(users[0]), 0);
    assertLe(handler.userLoss(users[0]), 0);  // vittima non deve perdere
}
```

**Iterare**: dopo ogni fix, rilancia invariant. Il corpus di failure diventa la regression suite permanente.

### Metriche di successo Fase 2
- ✅ 5+ invariant test
- ✅ Handler con 8+ azioni (di cui 3+ ostili)
- ✅ Almeno 3 bug catturati automaticamente e replicati come regression test
- ✅ CI aggiornato con `forge test --match-contract Invariant`

---

## FASE 3 — Echidna + Medusa (2 settimane)

### Obiettivi
- Echidna gira su 3 contratti critici con corpus salvato
- Medusa in parallelo per confronto

### Setup Echidna

```bash
# Docker (raccomandato)
docker pull trailofbits/echidna
alias echidna="docker run --rm -v $PWD:/src trailofbits/echidna echidna"

# Oppure via brew (macOS/Linux)
brew install echidna
```

### Property contracts

`contracts/echidna/EchidnaLPPool.sol`:
```solidity
pragma solidity ^0.8.19;

import "../Liquiditymanager.sol";
import "../ProxyGeneral.sol";

contract EchidnaLPPool {
    LiquidityManager lm;
    ProxyGeneral proxy;
    IERC20 baseAsset;

    address[3] users = [address(0x1), address(0x2), address(0x3)];
    uint256 constant INITIAL = 1000e18;

    constructor() {
        // Deploy pool (setup identico all'invariant)
        _setup();
        for (uint i = 0; i < 3; i++) {
            baseAsset.transfer(users[i], INITIAL);
        }
    }

    // ═══ Actions (Echidna chiama in ordine casuale) ═══
    function deposit(uint8 userId, uint256 amount) public {
        userId = userId % 3;
        amount = amount % INITIAL;
        vm_prank(users[userId]);
        try lm.deposit(amount) {} catch {}
    }

    function withdraw(uint8 userId, uint256 shares) public {
        userId = userId % 3;
        vm_prank(users[userId]);
        try lm.withdraw(shares) returns (uint256) {} catch {}
    }

    function donate(uint256 amount) public {
        // ATTACCO
        baseAsset.transfer(address(proxy), amount);
    }

    // ═══ Echidna properties ═══
    function echidna_totalSupplyMatchesShares() public view returns (bool) {
        uint256 sumShares;
        for (uint i = 0; i < 3; i++) sumShares += proxy.balanceOf(users[i]);
        return sumShares == proxy.totalSupply();
    }

    function echidna_ppsBoundedByYield() public view returns (bool) {
        if (proxy.totalSupply() == 0) return true;
        uint256 pps = lm.getTotalValue() * 1e18 / proxy.totalSupply();
        return pps <= 1.1e18;
    }

    function echidna_userNeverLosesMoreThanDeposit() public view returns (bool) {
        // ...
    }
}
```

Config `echidna.yaml`:
```yaml
testMode: property
testLimit: 100000
seqLen: 100
corpusDir: corpus/lp-pool
prefix: echidna_
codeSize: 0x6000
```

Run:
```bash
echidna contracts/echidna/EchidnaLPPool.sol --config echidna.yaml
```

Echidna:
1. Genera sequenze di azioni random (deposit/withdraw/donate)
2. Se una property fallisce, minimizza la sequenza al minimo
3. Salva il caso nel corpus per rerun futuro

**Cerchia i 3 property contracts più critici:**
- `EchidnaLPPool.sol` — LP accounting
- `EchidnaSwapManager.sol` — swap slippage properties
- `EchidnaPluginBase.sol` — plugin HF / borrow / repay

### Medusa (alternativa/complemento)

```bash
go install github.com/crytic/medusa@latest
medusa init
# Modifica medusa.json per usare i contratti Echidna con lievi adattamenti
medusa fuzz --config medusa.json
```

Girati in parallelo, catturano bug diversi (parallelism e strategie di corpus differenti).

### CI
Echidna in CI è **lento** (30-60 min). Non su ogni PR, ma:
- Nightly build su `main`
- Manual trigger per PR critici

```yaml
# .github/workflows/echidna-nightly.yml
on:
  schedule:
    - cron: '0 2 * * *'  # ogni notte alle 02:00 UTC
  workflow_dispatch:

jobs:
  echidna:
    runs-on: ubuntu-latest
    timeout-minutes: 120
    steps:
      - uses: actions/checkout@v4
      - uses: crytic/echidna-action@v2
        with:
          files: contracts/echidna/
          config: echidna.yaml
          test-limit: 500000
```

### Metriche di successo Fase 3
- ✅ 3+ property contracts Echidna
- ✅ Corpus salvato in `corpus/` (versioning)
- ✅ Medusa configurato in parallelo
- ✅ Nightly CI attivo

---

## FASE 4 — Formal verification light con Halmos (2 settimane)

### Obiettivi
- Halmos su formule matematiche critiche (health factor, share pricing)
- SMTChecker attivo sui contratti core
- 3+ proprietà formalmente verificate

### Setup Halmos

```bash
pip install halmos
```

### Property target: HF sempre in scala WAD (PLG-005 formal proof)

`test-halmos/HFScale.check.t.sol`:
```solidity
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "contracts/plugins/MorphoPlugin.sol";

contract HFScaleCheck is Test {
    // Halmos richiede una funzione `check_*` con symbolic input
    function check_hfAlwaysInWADScale(
        uint256 collateral,
        uint256 debt,
        uint256 lltv,
        uint256 oraclePrice
    ) public {
        // Domain constraints
        vm.assume(collateral > 0 && collateral < 1e30);
        vm.assume(debt > 0 && debt < 1e30);
        vm.assume(lltv >= 0.5e18 && lltv <= 1e18);
        vm.assume(oraclePrice > 0 && oraclePrice < 1e40);

        // Simulate the exact formula
        uint256 collateralValue = (collateral * oraclePrice) / 1e36;
        vm.assume(collateralValue > 0);

        // HF DEVE tenere questa property:
        // Se collateral * lltv / WAD >= debt, HF >= WAD
        uint256 maxBorrow = collateralValue * lltv / 1e18;

        // Chiamiamo la funzione buggy
        uint256 hf = _hfComputation(collateralValue, debt, lltv);

        if (maxBorrow >= debt) {
            assert(hf >= 1e18);  // ← property da provare
        }
    }

    // Repro della formula del plugin (identica al bug PLG-005)
    function _hfComputation(uint256 cv, uint256 debt, uint256 lltv) internal pure returns (uint256) {
        return (cv * lltv) / (debt * 1e18);  // ← bug: /WAD extra
    }
}
```

Run:
```bash
halmos --contract HFScaleCheck --function check_hfAlwaysInWADScale
```

**Output atteso:**
```
Counterexample:
  collateral = 2000e18
  debt = 1000e18
  lltv = 0.86e18
  oraclePrice = 1e36
  → maxBorrow = 1720e18 >= debt (1000e18)
  → hf = 1 (integer)
  → assert(1 >= 1e18) FAILS
```

Halmos ha **provato** che la formula è sbagliata, non solo trovato un caso random.

### Altre proprietà da verificare

1. **HF scale** — MorphoPlugin, AaveV3Plugin, EulerV2Plugin
2. **Share monotonicity** — LiquidityManager: `pps` non decrescente su deposit
3. **Round-in-favor-of-pool** — deposit/withdraw favoriscono il pool (protection)
4. **No overflow in cross-rate** — FlashLoanService.estimateFromTokenManager (NEW-016)
5. **Timestamp underflow** — ChainlinkAdapter (NEW-017)

### SMTChecker come safety net

Come descritto in Fase 0. Girare sempre in compile.

### Metriche di successo Fase 4
- ✅ 3+ formal properties provate/smentite via Halmos
- ✅ Counterexamples di bug documentati come regression test
- ✅ SMTChecker verde su contratti core

---

## FASE 5 — MEV & concurrency (1 settimana)

### Obiettivi
- Test di sandwich, front-run, back-run
- Simulazione multi-tx nello stesso blocco

### Setup Anvil mempool

```bash
# Terminal 1: Anvil con mempool
anvil --fork-url $ARB_RPC_URL --mempool-order fifo --block-time 12
```

### Test: sandwich del deposit

`test-foundry/mev/SandwichDeposit.mev.t.sol`:
```solidity
contract SandwichDepositMEV is Test {
    function testMEV_sandwichDeposit() public {
        // Setup pool con state esistente
        // ...

        address attacker = makeAddr("attacker");
        address victim = makeAddr("victim");

        // ═══ FRONT-RUN: attaccante dona base asset ═══
        vm.roll(block.number + 1);
        vm.prank(attacker);
        baseAsset.transfer(address(proxy), 100e18);

        // ═══ VICTIM TX (stessa transazione blocco) ═══
        deal(address(baseAsset), victim, 10e18);
        vm.prank(victim);
        baseAsset.approve(address(lm), 10e18);
        vm.prank(victim);
        uint256 victimShares = lm.deposit(10e18);

        // ═══ BACK-RUN: attaccante withdraw ═══
        // (assumendo attaccante avesse shares esistenti)
        // ...

        // ═══ ASSERT: la vittima NON deve perdere più del 1% ═══
        uint256 victimValue = _valueOfShares(victim, victimShares);
        assertGe(victimValue, 9.9e18, "Victim lost >1% to sandwich");
    }
}
```

### Test: front-run del closePosition

Simile pattern per PLG-007 (chiunque può chiamare `closePosition(uint256)`).

### Metriche di successo Fase 5
- ✅ 3+ scenari MEV testati
- ✅ Cattura o smentita di NEW-001, NEW-002, PLG-007

---

## FASE 6 — Fix systematic dei findings (3 settimane)

### Obiettivi
- Chiudere tutti i CRITICAL + HIGH del `ISSUES.md`
- Ogni fix accompagnato da regression test
- Rilancio full suite dopo ogni fix

### Priorità
Seguire il **Piano di remediation** in `ISSUES.md` sezione "Sprint 0/1/2/3".

**Sprint 0 (deploy blockers):**
- CORE-001, PLG-005, CORE-002, CORE-003
- NEW-001, NEW-002, NEW-003, NEW-004, NEW-005, NEW-007, NEW-018
- PLG-019/20/21, ADP-027
- CORE-005/06/07
- IFC-022/23/24, IFC-001
- ADP-033

**Sprint 1 (high severity):**
- ADP-001, ADP-002, ADP-030
- CORE-012, CORE-55/56
- PLG-42/43/44
- NEW-006, NEW-008, NEW-009, NEW-012
- Ecc.

**Regola:** ogni fix richiede:
1. Un test di regressione (in Foundry) che avrebbe catturato il bug
2. Verifica che il fix non rompa altri test
3. Slither/Aderyn passano
4. Update ISSUES.md marcando lo stato

### Metriche di successo Fase 6
- ✅ 0 CRITICAL aperti
- ✅ 0 HIGH aperti (o marcati come "known limitation" con documento)
- ✅ Test suite verde: Slither, Aderyn, Foundry unit/fuzz/invariant, Echidna corpus, Halmos

---

## FASE 7 — Preparazione contest audit (2 settimane)

### Obiettivi
- Repo pronta per essere consumata da audit community
- Documentazione completa
- Threat model esplicito

### Deliverable

**README audit-ready:**
```markdown
# TestPOC — audit-ready package

## Scope
- Contratti in `contracts/` (23k LOC)
- Escludi: `contracts/plugins/old/`, `test/`

## In-scope contracts (ordinati per priorità)
1. LiquidityManager.sol — LP accounting, deposit/withdraw
2. ProxyGeneral.sol — custody, module authorization
3. MorphoPlugin.sol — leverage on Morpho Blue
4. ... (elenco completo)

## Threat model
- User attaccante può: front-run tx, donare token direttamente, chiamare funzioni pubbliche
- Owner NON è considerato malicious (ma vogliamo minimizzare blast radius del owner-compromise)
- Oracoli (Chainlink) sono fidati ma possono stale/deviate

## Trusted assumptions
- Beacon owner è multisig
- Chainlink feed heartbeat < 24h
- ...

## Known issues (già note al team, NON in scope)
- Vedi `docs/audit_2026_07/ISSUES.md`

## Setup
- npm install
- forge install
- npm run test
- forge test

## Testing coverage
- Unit: hardhat (`npx hardhat test`)
- Fuzz: foundry (`forge test --fuzz-runs 10000`)
- Invariant: foundry (`forge test --match-contract Invariant`)
- Echidna: `echidna contracts/echidna/`

## Compensation
- Prize pool: $X (or contest-based, see platform)
```

**Deliverable aggiuntivi:**
- Diagrammi architetturali aggiornati
- NatSpec completo su ogni funzione external/public
- Runbook di deploy documentato

### Metriche di successo Fase 7
- ✅ README audit-ready completo
- ✅ Threat model documentato
- ✅ Tutti i test in verde su fresh clone
- ✅ Repo pubblicabile

---

## FASE 8 — Contest audit gratis o low-cost (4 settimane)

### Opzione A: Code4rena / CodeHawks contest

**Non è gratis** (costa $30-150k premio), ma è **il modo più efficiente** di ottenere un audit di qualità community.

Se il budget è VERAMENTE zero, **saltare a Opzione B**.

### Opzione B: Community-audit auto-organizzato (gratis)

Zero-budget alternative concreta:

1. **Pubblica il repo con label "audit-ready"** su Twitter/Warpcast + Discord DeFi (DeFi Devs, Yield Farming, ecc.)
2. **Offri bounty in equity/token futuri** invece di cash
3. **Immunefi ha piani gratis** — bug bounty attivo dal deploy, paga solo se trovano bug (fatti finanziare dai TVL futuri)
4. **Crowd feedback via Discord/Telegram DeFi communities** — post con link + threat model, chiedi "critiche libere". Auditor junior spesso danno feedback gratis per portfolio.
5. **Coordinati con altri progetti simili** per un "mutual audit" — voi guardate il loro, loro guardano il vostro.
6. **Chiedi review a Trail of Bits GitHub public** — a volte fanno review pubblica gratis se il codebase è interessante o open source con missione allineata.
7. **Contatta security researcher indipendenti su Twitter** — molti fanno report gratis per portfolio (con permission a pubblicare i findings).

### Opzione C: Immunefi Boost (post-audit)

Immunefi ha un tier "Boost" gratis per pre-launch — bug bounty attivo con premi in equity o post-TGE.

### Metriche di successo Fase 8
- ✅ Almeno 2-3 auditor esterni hanno guardato il codice
- ✅ Findings aggiuntivi documentati (attesi 5-20 additional)
- ✅ Public commitment su bug bounty post-deploy

---

## FASE 9 — Post-contest remediation (2 settimane)

### Obiettivi
- Fix di tutti i bug scoperti nel contest
- Rerun full stack
- Preparazione a mainnet deploy

### Checklist finale pre-deploy

- [ ] Tutti i CRITICAL/HIGH chiusi (originali + contest)
- [ ] Test suite verde: Slither, Aderyn, SMTChecker, Foundry unit/fuzz/invariant, Echidna, Halmos
- [ ] Threat model aggiornato
- [ ] Runbook deploy scritto
- [ ] Multisig/timelock per operazioni critiche configurati
- [ ] Immunefi bounty attivo (anche free tier)
- [ ] Monitoring on-chain configurato (Tenderly alerts free tier, o Forta community bots)
- [ ] Emergency response plan documentato
- [ ] Owner keys in hardware wallet / multisig

### Metriche di successo Fase 9
- ✅ Codebase pronta al mainnet deploy

---

## FASE 10 — Monitoring & maintenance (ongoing)

### Setup gratuiti

**Forta Network** — bot di monitoring on-chain gratis (community-run):
- Detect anomalie: TVL drop, price deviation, unusual withdrawals
- Alert via Discord webhook / email

**Tenderly free tier** — monitoring 3 contracts, alert essenziali gratis:
- Failed tx alerts
- Function call anomalies
- Gas usage spikes

**OpenZeppelin Defender free tier** — ex-Autotasks:
- Automated response a eventi on-chain
- Multi-sig proposal automation

**GitHub bug bounty** — issue template dedicato per whitehat:
```markdown
## Security disclosure template
- Severity:
- Attack vector:
- Reproducibility:
- Suggested fix:
- Compensation expected: [equity/token/none]
```

### Runbook incident response

Documento standardizzato:
1. Detection: chi/come rileva
2. Escalation: chi contattare
3. Containment: pause / emergency multisig
4. Recovery: emergencyWithdraw / migrazione
5. Post-mortem: template report + timeline pubblico

---

## Summary tempistica

| Fase | Durata | Focus | Skill level required |
|------|--------|-------|---------------------|
| 0 | 1 sett | Static analysis baseline | Junior+ |
| 1 | 2 sett | Foundry fuzz | Mid |
| 2 | 3 sett | Invariant + handler ostile | Mid-Senior |
| 3 | 2 sett | Echidna + Medusa | Senior |
| 4 | 2 sett | Halmos formal | Senior |
| 5 | 1 sett | MEV simulation | Mid-Senior |
| 6 | 3 sett | Fix systematic | Senior |
| 7 | 2 sett | Audit-ready package | Mid-Senior |
| 8 | 4 sett | Contest / community audit | - |
| 9 | 2 sett | Remediation post-contest | Senior |
| 10 | ongoing | Monitoring | Junior+ |

**Totale (fasi 0-9):** **22 settimane** di lavoro, ~500 ore full-time equivalent.

Se lavori 20h/settimana → ~5-6 mesi calendar.
Se lavori 40h/settimana → ~3 mesi calendar.

**Cosa ottieni alla fine:**
- Codebase con ~85-90% del livello di sicurezza di un audit boutique da $100k
- Tutti i tool automatici in CI (regression protection permanente)
- Community di whitehat che monitorizza post-deploy
- Documentazione audit-ready che accelera qualsiasi audit futuro pagato

**Cosa NON ottieni:**
- Prova matematica esaustiva (senza Certora)
- Firma di auditor famoso (senza Trail of Bits / OpenZeppelin)
- Insurance obbligatoria pre-listing su alcuni exchange centralizzati

Ma per il 90% dei progetti DeFi in fase di startup, questo è **più che sufficiente** per fare un deploy responsabile.

---

## Cosa iniziare **DOMANI** (0-day plan)

Se vuoi iniziare subito:

1. **Domani mattina**: installa Slither, run baseline, salva report.
   ```bash
   pip install slither-analyzer && slither . > baseline.txt
   ```

2. **Domani pomeriggio**: installa Foundry, primo fuzz test su MorphoPlugin.
   ```bash
   curl -L https://foundry.paradigm.xyz | bash && foundryup
   ```

3. **Fine settimana 1**: CI GitHub Actions con Slither `--fail-high`.

4. **Settimana 2**: primo invariant test con LPHandler ostile.

5. **Mese 1**: tutti gli HIGH del ISSUES.md fixati (o marcati as-planned).

Dopodiché segui la roadmap sopra.

---

**Fine documento — `02-fase-0-implementation.md` conterrà il setup pratico dettagliato quando iniziamo.**
