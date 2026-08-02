# Traceability matrix — property × finding × test × tool

**Ultimo aggiornamento:** 2026-07-15 al commit `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`.

Ogni riga collega:
- proprietà (`PROPERTY_CATALOG.md`)
- finding (`security/findings/register.json`)
- test file (path in `test/foundry/**` o `test/**`)
- tool (Hardhat/Foundry/Echidna/Halmos)
- status

## Matrice principale

| Property | Findings | Test path | Tool | Status |
|---|---|---|---|---|
| VAL-001 | VALUATION-001, CORE-049, NEW-028, CORE-044 | (planned) `test/foundry/invariant/ValValidity.invariant.t.sol` | Foundry invariant | PLANNED |
| VAL-002 | VALUATION-001, ADP-018, IFC-010 | (planned) same | Foundry + fork | PLANNED |
| VAL-003 | VALUATION-001, CORE-052 | (planned) `test/foundry/unit/LegacyFallback.t.sol` | Foundry unit | PLANNED |
| VAL-004 | VALUATION-001 §C1-01 | (planned) `test/foundry/unit/ValuationApi.t.sol` | Foundry unit | BLOCKED-HUMAN |
| VAL-005 | PLG-037 | (planned) `test/foundry/fuzz/EulerHFMask.fuzz.t.sol` | Foundry fuzz | BLOCKED-HUMAN |
| VAL-006 | VALUATION-001 | (planned) invariant su LPHandler | Foundry invariant | BLOCKED-HUMAN |
| VAL-007 | VALUATION-001 §C1-04, CORE-001 | (planned) `test/foundry/unit/EmergencyPath.t.sol` | Foundry unit | PLANNED |
| LP-001 | NEW-001 | `test/foundry/invariant/LPPoolInvariant.invariant.t.sol` (INV-3) | Foundry invariant | **PILOT (bug catturato)** |
| LP-002 | NEW-002, NEW-026 | (planned) `test/foundry/unit/DepositMinOut.t.sol` | Foundry unit | BLOCKED-HUMAN |
| LP-003 | NEW-002, NEW-003 | `test/foundry/invariant/LPPoolInvariant.invariant.t.sol` (INV-3) | Foundry + Echidna | PILOT |
| LP-004 | (property standalone) | LPPoolInvariant.invariant.t.sol (parziale) | Foundry invariant | PILOT |
| LP-005 | CORE-050, NEW-014 | (planned) `test/foundry/fuzz/RoundingBound.fuzz.t.sol` | Foundry fuzz + Halmos | PLANNED |
| LP-006 | (standard ERC20) | LPPoolInvariant.invariant.t.sol (INV-1) | Foundry invariant | **IMPLEMENTED** |
| LP-007 | CUST-001 (nuovo) | (planned) invariant fork | Foundry + fork | PLANNED |
| LP-008 | VALUATION-001 | (planned) invariant fork | Foundry + fork | PLANNED |
| WDR-001 | CORE-003 | (planned) `test/foundry/unit/WithdrawMinOut.t.sol` | Foundry unit + fuzz | BLOCKED-HUMAN |
| WDR-002 | CORE-003 | (planned) same | Foundry unit | BLOCKED-HUMAN |
| WDR-003 | NEW-014 | (planned) `test/foundry/unit/WithdrawFeeCoherence.t.sol` | Foundry unit | BLOCKED-HUMAN |
| WDR-004 | CORE-025 | (planned) hardhat fork | Hardhat fork | PLANNED |
| WDR-005 | CORE-027 | (planned) `test/foundry/fuzz/FeeDistribution.fuzz.t.sol` | Foundry fuzz | PLANNED |
| WDR-006 | CORE-037 | (planned) hardhat fork | Foundry + fork | PLANNED |
| CUST-001 | (standalone) | (planned) invariant fork | Foundry + fork | PLANNED |
| CUST-002 | CORE-012, CORE-055, PLG-023, NEW-020 | (planned) `test/foundry/invariant/AllowanceBound.invariant.t.sol` | Foundry invariant | PLANNED |
| CUST-003 | PLG-041, NEW-023 | (planned) `test/foundry/invariant/ActivePositionsCoherence.invariant.t.sol` | Foundry invariant | PLANNED |
| CUST-004 | NEW-023, PLG-040, PLG-041 | (planned) `test/foundry/unit/EmergencyPartialFailure.t.sol` | Foundry unit | PLANNED |
| CUST-005 | PLG-008, PLG-009, PLG-010 | (planned) hardhat fork | Foundry + fork | BLOCKED-HUMAN |
| CUST-006 | NEW-009, PLG-059, PLG-062 | (planned) `test/foundry/unit/RegistryLifecycle.t.sol` | Foundry unit | PLANNED |
| CUST-007 | NEW-005, CORE-058 | (planned) `test/foundry/unit/BeaconMigrate.t.sol` | Foundry unit | BLOCKED-HUMAN |
| GOV-001 | PLG-007, CORE-008, CORE-036, NEW-006 | (planned) `test/foundry/fuzz/CallerFuzz.fuzz.t.sol` | Foundry fuzz | PLANNED |
| GOV-002 | CORE-008 | (planned) `test/foundry/unit/PauseAccess.t.sol` | Foundry unit | BLOCKED-HUMAN |
| GOV-003 | CORE-005, CORE-067, CORE-068 | (planned) `test/foundry/unit/ParameterTimelock.t.sol` | Foundry unit | BLOCKED-HUMAN |
| GOV-004 | CORE-067, CORE-068 | (planned) same | Foundry unit | BLOCKED-HUMAN |
| GOV-005 | NEW-012 | (planned) `test/foundry/unit/ProtocolUpdateTimelock.t.sol` | Foundry unit | BLOCKED-HUMAN |
| GOV-006 | CORE-015 | (planned) `test/foundry/unit/EmergencyRecipient.t.sol` | Foundry unit | BLOCKED-HUMAN |
| GOV-007 | NEW-004 | (planned) `test/foundry/unit/ReentrancyAdversary.t.sol` + ERC777 mock | Foundry unit | PLANNED |
| ORC-001 | ADP-002, ADP-003, ADP-004 | (planned) `test/foundry/unit/ChainlinkStale.t.sol` | Foundry unit + mock | PLANNED |
| ORC-002 | NEW-017 | (planned) `test/foundry/unit/ChainlinkFutureTimestamp.t.sol` | Foundry unit + Halmos | PLANNED |
| ORC-003 | ADP-001 | (planned) `test/foundry/unit/SequencerDown.t.sol` | Foundry unit | BLOCKED-HUMAN |
| ORC-004 | NEW-021 | (planned) `test/foundry/unit/DenominationCoherence.t.sol` | Foundry unit | PLANNED |
| HF-001 | PLG-005, NEW-007 | `test/foundry/unit/HFScaleMath.t.sol` | Foundry unit + fuzz | **PILOT (bug catturato)** |
| HF-002 | HF plugin/lens consistency | (planned) hardhat fork | Foundry + fork | PLANNED |
| SWP-001 | ADP-027, PLG-030/31/32, CORE-002 | (planned) `test/foundry/unit/SwapMinOut.t.sol` | Foundry unit | BLOCKED-HUMAN |
| SWP-002 | CORE-002 | (planned) same | Foundry unit | BLOCKED-HUMAN |
| SWP-003 | NEW-025 | (planned) `test/foundry/unit/DeadlineTautology.t.sol` | Foundry unit | BLOCKED-HUMAN |
| SWP-004 | PLG-021, CORE-011 | (planned) `test/foundry/unit/SpotQuoteAsDefense.t.sol` | Foundry unit + Halmos | BLOCKED-HUMAN |
| EMG-001 | CORE-001, NEW-010, PLG-040/41 | (planned) `test/foundry/unit/EmergencyEffective.t.sol` | Foundry unit | PLANNED |
| EMG-002 | NEW-010 | (planned) same | Foundry unit | PLANNED |

## Statistiche

- **Proprietà definite:** 41
- **IMPLEMENTED:** 1 (LP-006 via INV-1)
- **PILOT (bug catturato):** 3 (LP-001, LP-003, HF-001)
- **PILOT (parziale):** 1 (LP-004)
- **PLANNED:** 21
- **BLOCKED-HUMAN:** 15 (richiedono autorizzazione per API/semantica change prima di implementare)

## Gap coverage

Categorie con più `BLOCKED-HUMAN`:
- **WDR:** 3/6 blocked (cambia API `withdraw`)
- **GOV:** 5/7 blocked (cambia semantica timelock/pause)
- **SWP:** 4/4 blocked (cambia signature `swap`)
- **VAL:** 3/7 blocked (cambia API valuation)

Questi sblocchi richiedono decisioni utente formali (§1.4 gate) prima di essere convertiti in test rossi + fix.

## Prossime azioni

1. Sbloccare i test PLANNED che non richiedono API change (ORC-001/002/004, LP-005, CUST-003/004/006, GOV-001/007, EMG-001/002).
2. Preparare mock ERC777 + Chainlink failure per abilitare i PLANNED oracle/reentrancy.
3. Attivare Echidna (S7) sulle stesse proprietà del pilot Foundry per fuzzing profondo.
4. Attivare Halmos (S8) sulle proprietà bounded (HF-001, LP-005, ORC-002, SWP-004).
