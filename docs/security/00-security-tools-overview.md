# Security testing toolkit — panoramica

**Ultimo aggiornamento:** 2026-07-15
**Autore:** audit team
**Scopo:** guida di riferimento per capire quale strumento serve, quando usarlo, e cosa ci si aspetta di catturare. Complementare al `01-zero-budget-roadmap.md` che ne descrive l'implementazione pratica.

---

## 1. Il modello mentale a 5 livelli

Il testing di sicurezza in DeFi enterprise è **stratificato**. Ogni livello prende bug che quello sotto non prende — non sono sostituti, sono complementi.

```
┌──────────────────────────────────────────────────────────────────┐
│ LIVELLO 4  │ Third-party audit (occhio umano esperto)            │
│            │ Cattura: intent bugs, design flaws, contesto       │
├──────────────────────────────────────────────────────────────────┤
│ LIVELLO 3  │ Formal verification (Certora, Halmos, SMT)          │
│            │ Cattura: prove matematiche di invariants globali    │
├──────────────────────────────────────────────────────────────────┤
│ LIVELLO 2  │ Adversarial fuzzing (Echidna, Foundry fuzz+invar)   │
│            │ Cattura: bug su input random + sequenze avversarie  │
├──────────────────────────────────────────────────────────────────┤
│ LIVELLO 1  │ Property-based tests / invariant tests              │
│            │ Cattura: asserzioni forti su happy path + edge case │
├──────────────────────────────────────────────────────────────────┤
│ LIVELLO 0  │ Static analysis (Slither, Aderyn, Mythril)          │
│            │ Cattura: pattern noti, drift, missing modifier      │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Modello di rischio: cosa cattura ogni livello

Applicato all'audit del progetto TestPOC (rev. 2, 320 findings):

| Livello | Bug tipici catturati | Esempi dal nostro audit |
|---------|---------------------|--------------------------|
| **0 Static** | Reentrancy visibile, missing `override`, MAX approve, USDT-incompat, dead code | NEW-004, IFC-022/23/24, CORE-055/56, CORE-012, PLG-070/71 |
| **1 Property** | Invariants su LP accounting, HF scale, rounding direction, no-fund-leakage | PLG-005, NEW-007, CORE-003, ADP-039 |
| **2 Fuzzing** | Share inflation, sandwich deposit, adversarial actors, oracle manipulation | NEW-001, NEW-002, NEW-003, NEW-028 |
| **3 Formal** | Prova matematica per tutti gli input: HF sempre ≥ min, price-per-share monotono | Verificherebbe l'assenza di PLG-005-like bugs in modo esaustivo |
| **4 Audit** | Design flaws, intent mismatch, context bug, novel attack vectors | CORE-001 (emergency path spezzato), NEW-005 (Beacon senza migrate) |

## 3. Livello 0 — Static analysis

Analizzano il codice **senza eseguirlo**. Girano in secondi/minuti. Basso investimento, cattura molti bug low-hanging.

### 3.1 Slither (Trail of Bits) — il tool più famoso

**Cosa fa:** parsa l'AST del codice Solidity, applica ~90 detector di vulnerabilità noti.

**Installazione:**
```bash
pip install slither-analyzer
```

**Uso base:**
```bash
slither .                                     # tutto il progetto
slither . --exclude-informational             # solo LOW+
slither contracts/SwapManager.sol             # singolo file
slither . --print inheritance-graph           # utility: grafo di ereditarietà
slither . --print human-summary               # riassunto contratto
```

**Detector più utili per DeFi:**
- `reentrancy-eth`, `reentrancy-no-eth`, `reentrancy-benign` — pattern reentrancy
- `arbitrary-send-eth`, `arbitrary-send-erc20` — invii a indirizzi controllati da caller
- `unchecked-transfer` — return value non verificato
- `uninitialized-state`, `uninitialized-storage` — state non inizializzato
- `shadowing-state`, `shadowing-local` — override accidentali
- `divide-before-multiply` — precision loss
- `weak-prng`, `timestamp` — usi rischiosi di block.timestamp
- `unused-return`, `dead-code` — code hygiene
- `missing-inheritance` — cattura CORE-001, IFC-* pattern
- `constant-function-state`, `costly-loop` — pattern gas

**Configurazione (opzionale):**

`slither.config.json`:
```json
{
  "detectors_to_exclude": "naming-convention,solc-version,pragma",
  "filter_paths": "test/,contracts/mocks/,contracts/old/",
  "exclude_informational": true,
  "exclude_low": false,
  "fail_high": true
}
```

**Output tipico:**
```
LiquidityManager._withdrawInternal(...) (contracts/Liquiditymanager.sol#255-395)
    ignores return value from ISwapManager(swapper).performSwap(...)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unused-return
```

**Limiti:**
- Molti falsi positivi su pattern legittimi (es. transfer verso owner)
- Non ragiona sulla semantica del business (non capisce che HF calcolato in scala errata è un bug)
- Non trova bug che richiedono state trace (fuzzing serve)

**ROI:** ⭐⭐⭐⭐⭐. Setup in mezz'ora, gira in CI, cattura il 30-40% dei bug medi.

---

### 3.2 Aderyn (Cyfrin) — alternativa Rust-based

**Vantaggi vs Slither:** più veloce (Rust), output Markdown nativo, meno falsi positivi.

**Installazione:**
```bash
cargo install aderyn        # richiede Rust toolchain
```

**Uso:**
```bash
cd C:/Personal/TestPOC
aderyn .                     # produce report.md
```

**Detector distintivi:** `useless-modifier`, `misordered-inheritance`, `push-0-opcode` (per compat chain), `costly-string-comparison`, ecc.

**Quando preferire ad Slither:** se il team lavora in Foundry, se preferisci un tool più giovane e meno rumoroso, o come **complemento** (i due catturano set diversi).

**Migliore approccio:** girare ENTRAMBI in CI. Combinati coprono più del solo Slither.

---

### 3.3 Mythril (ConsenSys) — symbolic execution

**Cosa fa:** oltre ai detector statici, esegue il codice **simbolicamente** con solver SMT (Z3). Esplora tutti i path possibili di esecuzione entro un limite di profondità.

**Installazione:**
```bash
pip install mythril
solc-select install 0.8.19 && solc-select use 0.8.19
```

**Uso:**
```bash
myth analyze contracts/ProxyGeneral.sol --solv 0.8.19 --execution-timeout 300
```

**Cosa trova che Slither non prende:**
- Assertion violations reachable (con quale input)
- Integer overflow su path specifici
- Selfdestruct raggiungibile da unauthorized caller
- Delegatecall a indirizzi non fidati

**Limiti:**
- Lento (5-30 min per contratto medio)
- Stalla su contratti > 500 LOC
- Genera falsi positivi su chiamate esterne

**ROI:** ⭐⭐⭐. Usalo **mirato** sui 3-4 contratti più critici (ProxyGeneral, LiquidityManager, plugin flash-loan). Non su tutto il progetto.

---

### 3.4 Semgrep + regole Solidity custom

Approccio "grep intelligente" con regole custom.

```yaml
# .semgrep/rules-solidity.yaml
rules:
  - id: raw-erc20-approve
    pattern: |
      IERC20($TOKEN).approve($SPENDER, $AMOUNT);
    message: Usa SafeERC20.forceApprove invece di approve() raw
    severity: ERROR
    languages: [solidity]
```

```bash
semgrep --config .semgrep/rules-solidity.yaml contracts/
```

**Uso:** enforcement di **regole team-specifiche** che nessun tool generico prende (es. "solo ParameterManager può leggere `parameters`").

**ROI:** ⭐⭐⭐ dopo aver stabilizzato le convenzioni interne.

---

## 4. Livello 1 — Property tests & invariant tests

Passa da test tabellari (`if input X → output Y`) a **asserzioni universali** (`per ogni input, questa proprietà tiene`).

### 4.1 Perché non basta l'unit test tradizionale

**Test tradizionale:**
```typescript
it("deposit 100 → shares 100", async () => {
    await lm.deposit(100);
    expect(await proxy.balanceOf(user)).to.equal(100);
});
```

Verifica **uno** scenario. Non cattura:
- Cosa succede se `totalSupply == 0` (first depositor attack)
- Cosa succede se un attaccante dona base asset prima
- Cosa succede se la somma di 100 deposit ha effetti collaterali

**Property test:**
```solidity
function testProperty_deposit(uint256 amount, uint256 seed) public {
    // per QUALSIASI amount, dopo un deposit valido:
    // - sum(userShares) == totalSupply
    // - pricePerShare non deve diminuire (senza withdraw intermedio)
    // - il caller riceve shares > 0 se amount >= minDeposit
    ...
    assertEq(sumOfShares(), proxy.totalSupply());
    assertGe(newPricePerShare, oldPricePerShare);
}
```

### 4.2 Foundry — Fuzz + Invariant testing (nativo)

**Foundry** è il framework Solidity de-facto oggi. Se sei su Hardhat, vale la pena migrare almeno i test critici.

**Installazione:**
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

**Setup nel progetto:**
```toml
# foundry.toml
[profile.default]
src = "contracts"
out = "out"
libs = ["node_modules", "lib"]
test = "test-foundry"
solc_version = "0.8.19"

[fuzz]
runs = 10000
max_test_rejects = 65536

[invariant]
runs = 500
depth = 100
fail_on_revert = false
```

**Fuzz test (property test su singola funzione):**
```solidity
// test-foundry/HealthFactor.fuzz.t.sol
import "forge-std/Test.sol";
import "contracts/plugins/MorphoPlugin.sol";

contract HealthFactorFuzz is Test {
    MorphoPlugin plugin;

    function setUp() public {
        // deploy Morpho plugin su fork Arbitrum
    }

    function testFuzz_hfAlwaysInWAD(uint256 collateral, uint256 leverage) public {
        collateral = bound(collateral, 0.01 ether, 1000 ether);
        leverage = bound(leverage, 110, 500);

        plugin.openLeverageAtomic({...});

        uint256 hf = plugin.getHealthFactor("WETH", "USDC");

        // ASSERTIONI FORTI: HF DEVE essere in WAD scale
        assertGe(hf, 1.05e18, "HF must be >= 1.05e18 in WAD");
        assertLe(hf, 100e18, "HF must be reasonable (< 100)");
    }
}
```

Run: `forge test --match-path "*HealthFactor.fuzz*" -vv`

Foundry chiama `testFuzz_hfAlwaysInWAD` **10000 volte** con `collateral` e `leverage` casuali. Se PLG-005 esiste, l'`assertGe(hf, 1.05e18)` fallisce al primo tentativo perché `hf` viene ritornato come `1` o `2` invece di `1.5e18`.

**Invariant test (proprietà su sequenza di azioni):**

```solidity
// test-foundry/invariants/LPAccounting.invariant.t.sol
import "forge-std/Test.sol";

contract LPHandler is Test {
    LiquidityManager lm;
    ProxyGeneral proxy;
    IERC20 baseAsset;

    uint256 public sumOfDeposits;
    uint256 public sumOfWithdrawals;

    function deposit(uint256 amount, uint256 userSeed) external {
        address user = _pickUser(userSeed);
        amount = bound(amount, 1e6, 1000e18);
        deal(address(baseAsset), user, amount);
        vm.prank(user);
        baseAsset.approve(address(lm), amount);
        vm.prank(user);
        try lm.deposit(amount) {
            sumOfDeposits += amount;
        } catch {}
    }

    function withdraw(uint256 shares, uint256 userSeed) external {
        address user = _pickUser(userSeed);
        shares = bound(shares, 1, proxy.balanceOf(user));
        if (shares == 0) return;
        vm.prank(user);
        try lm.withdraw(shares) returns (uint256 got) {
            sumOfWithdrawals += got;
        } catch {}
    }

    // ATTACCO: dona base asset direttamente al proxy
    function donateToProxy(uint256 amount) external {
        amount = bound(amount, 1, 100e18);
        deal(address(baseAsset), address(this), amount);
        baseAsset.transfer(address(proxy), amount);
    }
}

contract LPAccountingInvariant is Test {
    LPHandler handler;

    function setUp() public {
        // deploy
        handler = new LPHandler();
        targetContract(address(handler));
    }

    // INVARIANT 1: contabilità coerente
    function invariant_supplyMatchesUserShares() public {
        // sum(user shares) == totalSupply
    }

    // INVARIANT 2: nessuna inflazione del NAV da donazioni
    function invariant_pricePerShareBoundedByYield() public {
        uint256 ppShare = lm.getTotalValue() * 1e18 / proxy.totalSupply();
        assertLe(ppShare, INITIAL_PRICE_PER_SHARE * 105 / 100, "NAV inflated");
    }

    // INVARIANT 3: no fund leakage
    function invariant_noFundLeakage() public {
        uint256 poolValue = lm.getTotalValue();
        uint256 expected = handler.sumOfDeposits() - handler.sumOfWithdrawals();
        assertApproxEqAbs(poolValue, expected, 1e15);  // tolleranza 0.001
    }
}
```

Run: `forge test --match-contract LPAccountingInvariant --invariant-runs 500 -vv`

Foundry esegue **500 sequenze random di 100 azioni ciascuna** (deposit/withdraw/donation in ordine casuale, importi casuali, utenti casuali) e verifica gli invariant dopo OGNI azione. Il primo run avrebbe trovato **NEW-001, NEW-002, NEW-003** in secondi.

**Chiave dell'invariant testing:** l'**handler** definisce l'universo di azioni possibili. Includere azioni **avversarie** (donazione, front-run, oracle manipulation) è fondamentale. Se l'handler fa solo `deposit`/`withdraw` "onesti", non troverai attaccanti.

**ROI:** ⭐⭐⭐⭐⭐. È il tool più impattante del progetto. Priorità massima dopo Slither.

### 4.3 fast-check (property testing su Hardhat/TypeScript)

Se non vuoi migrare a Foundry, `fast-check` porta property testing in JS/TS.

```typescript
import * as fc from "fast-check";

it("price per share monotonic across deposits", async () => {
  await fc.assert(fc.asyncProperty(
    fc.array(fc.bigInt({min: 1n, max: 1000n * 10n**18n}), {maxLength: 20}),
    async (amounts) => {
      let prevPps = await getPricePerShare();
      for (const amount of amounts) {
        await deposit(amount);
        const pps = await getPricePerShare();
        expect(pps).to.be.gte(prevPps);
        prevPps = pps;
      }
    }
  ), { numRuns: 500 });
});
```

**Limiti vs Foundry:**
- Più lento (transazioni via ethers.js vs EVM nativo)
- Handler adversariali più complessi da scrivere
- Nessun invariant testing multi-actor nativo

**ROI:** ⭐⭐⭐. Ok come intermediate step se Hardhat è vincolo.

---

## 5. Livello 2 — Adversarial fuzzing

Fuzzing "smart" con coverage-guided exploration.

### 5.1 Echidna (Trail of Bits)

**Cosa fa:** dato un contratto Solidity con `assert()` statements, cerca **automaticamente** input che li rompono. A differenza di Foundry fuzz (che usa random puro), Echidna usa **coverage-guided fuzzing** — impara quali input portano a nuovi rami e li esplora prima.

**Installazione:**
```bash
# Docker (raccomandato)
docker pull trailofbits/echidna
# oppure
brew install echidna  # macOS
```

**Uso:**

```solidity
// contracts/echidna/EchidnaLiquidityManager.sol
import "contracts/Liquiditymanager.sol";

contract EchidnaLiquidityManager {
    LiquidityManager lm;
    ProxyGeneral proxy;

    // Property functions — Echidna cerca controesempi
    function echidna_shareAccounting() public view returns (bool) {
        // sum(user shares) == totalSupply
        return _sumUserShares() == proxy.totalSupply();
    }

    function echidna_noPriceInflation() public view returns (bool) {
        uint256 pps = lm.getTotalValue() * 1e18 / proxy.totalSupply();
        return pps <= MAX_EXPECTED_PPS;
    }

    // "Actions" — Echidna le chiama in ordine casuale
    function deposit(uint256 amount) public { lm.deposit(amount); }
    function withdraw(uint256 shares) public { lm.withdraw(shares); }
    function donateToProxy(uint256 amount) public {
        baseAsset.transfer(address(proxy), amount);
    }
}
```

Config `echidna.yaml`:
```yaml
testMode: property
testLimit: 100000
seqLen: 100
corpusDir: corpus/lm
prefix: echidna_
```

Run:
```bash
echidna contracts/echidna/EchidnaLiquidityManager.sol --config echidna.yaml
```

**Output tipico:**
```
echidna_noPriceInflation: FAILED with sequence:
  deposit(1000000)
  donateToProxy(1000000000000000000)  ← attacco identificato
  deposit(2000000)
  echidna_noPriceInflation() → false
```

Il **corpus** viene salvato: al prossimo run, Echidna riparte da quei casi (regression protection).

**Limiti:**
- Setup più laborioso di Foundry
- Solidity-only (no JS bindings)
- La proprietà deve essere `view` (Echidna non modifica state per test)

**Quando preferire ad Foundry invariant:** quando le proprietà sono complesse (multi-step) e Foundry non trova bug in 500 run — Echidna con 100k step spesso li trova.

**ROI:** ⭐⭐⭐⭐. Complementare a Foundry, non sostitutivo.

### 5.2 Medusa (Crytic — parallel fuzzing)

Successore ideologico di Echidna, gira in parallelo, output più leggibile.

```bash
go install github.com/crytic/medusa@latest
medusa init && medusa fuzz
```

Stessa filosofia di Echidna, ma più veloce su hardware moderno.

---

## 6. Livello 3 — Formal verification

**Prova matematica** che una proprietà tiene per **tutti** gli input. Non "testato 10M volte", ma "impossibile che non tenga".

### 6.1 Certora Prover — industry standard (a pagamento)

Scrivi le specifiche in **CVL** (Certora Verification Language). Certora invoca solver SMT (Z3, CVC5) per provare o trovare controesempio.

```cvl
// specs/LiquidityManager.spec
methods {
    function deposit(uint256) external returns (uint256);
    function totalSupply() external returns (uint256) envfree;
    function totalValue() external returns (uint256) envfree;
}

// SPECIFICA: dopo un deposit, price-per-share non aumenta
rule depositDoesNotInflatePrice {
    uint256 supplyBefore = totalSupply();
    uint256 valueBefore = totalValue();

    env e;
    uint256 amount;
    require amount > 0;
    deposit(e, amount);

    uint256 supplyAfter = totalSupply();
    uint256 valueAfter = totalValue();

    // pps_after <= pps_before + amount_contribution
    assert supplyAfter > 0 && (valueAfter * supplyBefore) <= (valueBefore * supplyAfter + amount * supplyBefore);
}
```

**Output:**
- ✅ "verified for all inputs"
- ❌ "counterexample: `supply=1, value=1e18, amount=1`" + traccia dettagliata

**Chi lo usa:** Aave, Compound, MakerDAO, Balancer, Morpho, Uniswap V3.

**Costo:** licenza ~$60k-$200k/anno + ingegnere dedicato + settimane di setup.

**ROI per progetti con < $10M TVL:** ⭐⭐. Sovradimensionato.

### 6.2 Halmos (a16z — open source, gratis)

Alternativa gratuita basata su symbolic execution. Meno espressivo di CVL ma funziona su codice Foundry-compatible.

**Installazione:**
```bash
pip install halmos
```

**Uso:**
```solidity
// test-halmos/HFScale.check.sol
import "forge-std/Test.sol";
import "contracts/plugins/MorphoPlugin.sol";

contract HFScaleCheck is Test {
    MorphoPlugin plugin;

    function check_hfAlwaysInWAD(uint256 collateral, uint256 debt, uint256 lltv) public {
        vm.assume(collateral > 0 && debt > 0);
        vm.assume(lltv >= 0.5e18 && lltv <= 1e18);

        uint256 hf = plugin.exposedComputeHealthFactor(collateral, debt, lltv);

        // Deve valere per TUTTI (collateral, debt, lltv):
        // se collateral * lltv / WAD >= debt → hf >= WAD
        if (collateral * lltv / 1e18 >= debt) {
            assert(hf >= 1e18);
        }
    }
}
```

Run:
```bash
halmos --contract HFScaleCheck --function check_hfAlwaysInWAD
```

Halmos esplora simbolicamente e prova (o smentisce) la proprietà.

**Limiti:**
- Path explosion su codice complesso (usa `vm.assume` aggressivo)
- Meno espressivo di CVL
- Community più piccola

**ROI:** ⭐⭐⭐⭐ per progetti open budget. È il "Certora del povero" e funziona sorprendentemente bene sui casi giusti.

### 6.3 SMTChecker (built-in Solidity compiler)

Solc ha un formal verifier integrato. Zero setup.

```solidity
pragma solidity ^0.8.19;

contract Example {
    function safeAdd(uint256 a, uint256 b) public pure returns (uint256) {
        assert(a + b >= a);  // ← SMTChecker prova / trova controesempio
        return a + b;
    }
}
```

Config:
```json
// hardhat.config.ts o foundry.toml
{
  "solc": {
    "settings": {
      "modelChecker": {
        "engine": "chc",
        "targets": ["assert", "underflow", "overflow", "divByZero"],
        "timeout": 60000
      }
    }
  }
}
```

Cattura overflow, divisione per zero, assertion violation raggiungibili. Ideale come sanity check sul codice matematico critico.

**ROI:** ⭐⭐⭐. Gratis, integrato, girare sempre.

---

## 7. Livello 4 — Third-party audit

Un'azienda o community esterna con auditor senior legge il tuo codice per settimane.

### 7.1 Boutique / Top-tier

| Azienda | Prezzo tipico | Durata | Specialità |
|---------|--------------|--------|------------|
| **Trail of Bits** | $100k-$300k | 6-12 sett. | Full-stack, symbolic exec |
| **OpenZeppelin** | $80k-$200k | 4-8 sett. | DeFi, upgradability |
| **ConsenSys Diligence** | $80k-$200k | 4-8 sett. | Ethereum core, EIP |
| **Certora** | $150k-$300k | 8-12 sett. | Formal verification incluso |
| **Zellic** | $60k-$120k | 3-6 sett. | Reactive, DeFi |

### 7.2 Mid-tier / Boutique

| Azienda | Prezzo tipico | Durata |
|---------|--------------|--------|
| **Halborn** | $50k-$100k | 3-5 sett. |
| **Cyfrin** | $40k-$80k | 3-4 sett. |
| **Spearbit** (con Cantina) | $40k-$100k | 2-4 sett. |
| **Sherlock** | $40k-$80k | 2-3 sett. (contest) |

### 7.3 Competitive audit (community-driven)

Il **contest audit** paga un premio unico ai migliori auditor che partecipano pubblicamente.

- **Cantina** — audit ibrido (spearbit + community). Prezzo ~$30-80k, 2 settimane, molti eyes.
- **Code4rena** — contest pubblico. Prezzo ~$50-150k, chiunque può partecipare. Alta scoperta di bug ma report può essere caotico.
- **CodeHawks** — simile a Code4rena, community più giovane, prezzi più bassi ($20-50k).
- **Sherlock** — contest + insurance combo.

**Vantaggio:** più economico e molti occhi diversi.
**Svantaggio:** minor continuity, alcuni auditor sono junior.

### 7.4 Bug bounty post-deploy

Non è un audit ma un incentive continuo per whitehat post-mainnet.

- **Immunefi** — la piattaforma dominante. Premio scalato per severity (critical fino a $1-5M).
- **Cantina Bounty** — nuovo, integrato con Cantina audit.
- **HackenProof** — alternativa.

**Costo:** solo se qualcuno trova un bug. Pagamento tipico critical: $50k-$500k.

**Da avere sempre attivo post-deploy per DeFi > $1M TVL.**

---

## 8. MEV / concurrency simulation

Nessun fork tradizionale simula MEV. Servono tool specifici.

### 8.1 Anvil con mempool (Foundry)

```bash
anvil --fork-url $ARB_RPC --mempool-order fifo
```

In una seconda shell, invii tx concorrenti via `cast`:
```bash
cast send --private-key $ATTACKER_KEY $PROXY_GENERAL "receiveDonation()" ...
cast send --private-key $VICTIM_KEY $LM "deposit(uint256)" 1000000000
```

Anvil le include nello stesso blocco secondo l'ordine specificato. Puoi testare sandwich, front-run, back-run.

### 8.2 Tenderly Simulator

Web UI + API. Supporta **transaction bundles** e vede l'ordine esecutivo. Utile per simulare exploit prima di eseguirli su mainnet.

### 8.3 Flashbots Simulator

MEV-Boost simulation reale. Utile solo per progetti che integrano con Flashbots direttamente. Overkill per la maggior parte.

**ROI:** ⭐⭐⭐ solo su AMM/lending/vault dove MEV è vettore primario di attacco.

---

## 9. CI integration (l'ultimo pezzo)

Tutti questi tool devono girare **su ogni PR**, non a mano. Esempio GitHub Actions:

```yaml
# .github/workflows/security.yml
name: Security checks
on: [pull_request]

jobs:
  static:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install slither-analyzer
      - run: slither . --fail-high --exclude-informational
      - uses: cyfrin/aderyn-action@v1

  foundry:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge test
      - run: forge test --fuzz-runs 5000
      - run: forge test --match-contract Invariant --invariant-runs 500

  echidna:
    runs-on: ubuntu-latest
    steps:
      - uses: crytic/echidna-action@v2
        with:
          files: contracts/echidna/
          config: echidna.yaml
          test-limit: 50000
```

**Regola d'oro:** un PR non è mergeable finché tutti i job security passano.

---

## 10. Comparazione riassuntiva

| Tool | Livello | Costo | Setup | Run time | Cattura |
|------|---------|-------|-------|----------|---------|
| **Slither** | 0 | Gratis | 30 min | 30 sec | Pattern noti, missing modifier, drift |
| **Aderyn** | 0 | Gratis | 30 min | 30 sec | Come Slither + set complementare |
| **Mythril** | 0.5 | Gratis | 1h | 5-30 min | Assertion reachable, symbolic |
| **SMTChecker** | 0.5 | Gratis | 5 min (config) | 1-5 min | Overflow, div/zero, assert |
| **Foundry fuzz** | 1 | Gratis | 2h (test) | 1-5 min | Bug su input random |
| **Foundry invariant** | 1-2 | Gratis | 1 giorno (handler) | 5-30 min | Bug su sequenze adversariali |
| **fast-check** | 1 | Gratis | 4h | 5-15 min | Property su HH/TS |
| **Echidna** | 2 | Gratis | 1 giorno | 10-60 min | Coverage-guided fuzzing |
| **Medusa** | 2 | Gratis | 1 giorno | 5-30 min | Come Echidna, più veloce |
| **Halmos** | 3 | Gratis | 2 giorni | 10-60 min | Proof via symbolic |
| **Certora** | 3 | ~$60-200k/anno | Settimane | Ore | Proof matematiche complete |
| **Code4rena** | 4 | $50k-$150k | 2 sett. contest | - | Auditor community |
| **Cantina** | 4 | $30k-$80k | 2 sett. | - | Auditor ibrido |
| **Trail of Bits** | 4 | $100k-$300k | 6-12 sett. | - | Top-tier auditor |
| **Immunefi** | 4 | Post-bug | - | Ongoing | Whitehat post-deploy |

---

## 11. Cosa NON fare

- **Non affidarti solo alla coverage %.** 100% righe eseguite ≠ 100% comportamenti verificati.
- **Non aspettare l'audit esterno per iniziare.** Slither + Foundry invariant portano il codice al 60% pulito prima. L'auditor esterno lavora sulla parte difficile, non su drift trivial.
- **Non pensare che "gli audit li fanno solo i big player".** Cantina/CodeHawks costano $30-50k, portata di qualsiasi seed round.
- **Non skippare Slither.** Gratis, 5 min, 30-40% dei bug medi. Assurdo non usarlo.
- **Non fare fuzzing sul happy path.** Il fuzzing serve solo se hai **actors ostili** nell'handler.
- **Non deployare senza bug bounty attivo.** Immunefi ~$1000/mese base + payout on bug. Insurance de facto.
- **Non trattare i test come one-shot.** Il corpus di Echidna, l'handler di Foundry, le regole Slither devono evolvere con il codice.

---

## 12. Riepilogo tabellare per decisioni

| Se hai... | Compra/installa... | Copre... |
|-----------|-------------------|----------|
| **1 giorno** | Slither + Aderyn + SMTChecker | 30-40% bug medi |
| **1 settimana** | + Foundry invariant tests con handler ostile | 60-70% bug medi |
| **1 mese** | + Echidna + Halmos | 80-85% bug medi |
| **$30-80k** | + audit competitivo Cantina/CodeHawks | 90%+ |
| **$100-300k** | + audit Trail of Bits / OpenZeppelin | 95%+ |
| **$500k+** | + Certora formal verification | 99%+ (matematico) |

Un progetto DeFi enterprise-ready **deve** avere almeno le prime 4 righe. **Non c'è scampo**: senza il livello 4, ti espone a bug che il tuo team non troverà mai da solo (bias del creatore).

---

## Riferimenti

- Slither docs: https://github.com/crytic/slither
- Aderyn docs: https://github.com/Cyfrin/aderyn
- Mythril docs: https://github.com/ConsenSys/mythril
- Foundry book: https://book.getfoundry.sh/
- Echidna tutorial: https://github.com/crytic/building-secure-contracts
- Halmos: https://github.com/a16z/halmos
- Certora docs: https://docs.certora.com/
- Immunefi: https://immunefi.com/
- Cantina: https://cantina.xyz/
- Code4rena: https://code4rena.com/
- Sherlock: https://audits.sherlock.xyz/

**Fine documento — vedi `01-zero-budget-roadmap.md` per il piano implementativo concreto.**
