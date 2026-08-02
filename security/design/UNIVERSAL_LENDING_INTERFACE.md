# Universal Lending Interface — design definitivo (pair-based)

**Data:** 2026-07-17
**Decisione:** APPROVATA da `@Poppo753` — Opzione A (pair-based).
**Riferimento decisione:** `security/DECISIONS.md` DEC-006.
**Stato:** design approvato, implementazione = blocker C1-08 (Sprint 0).

> **⚠️ RETTIFICA 2026-07-27 (DEC-009):** la mappatura del codice reale ha corretto 3 assunzioni di questo documento:
> 1. **Il target dell'interfaccia pair-based è `IProtocolAdapter`** (quella che i plugin implementano davvero), NON `ILendingProtocol` (legacy semi-abbandonata). Dove sotto si legge "`ILendingProtocol` v2", intendere **`IProtocolAdapter` v2**.
> 2. `ProtocolManager` **non** ha `onlyOperator` oggi → va costruito (DEC-008).
> 3. `ProtocolManager` **non** ha `openLeverage`/`closeLeverage` oggi → sono entrypoint netti.
> Inoltre: scelta "unica interfaccia + revert" per i supply-only (DEC-009 D1b), risoluzione plugin unica sul Beacon (DEC-009 D2). Dettaglio in `docs/.../12-remediation-waves/Sprint0/C1-08+C1-04_.../02_Idea_Dettagliata.md`.

## 1. Scopo

Definire l'interfaccia universale che ogni plugin di lending (attuale e futuro) deve implementare, in modo che:
- `ProtocolManager` sia l'**unico punto di ingresso** per ogni operazione;
- la stessa firma funzioni per protocolli pooled (Aave), vault-controller (Euler), isolated-pair (Morpho, Fluid, Silo);
- i fondi confluiscano sempre in `ProxyGeneral` (custody centrico, già implementato);
- l'aggiunta di un nuovo lender non richieda di cambiare `ProtocolManager` né le altre interfacce.

## 2. I tre modelli di lending (perché serve pair-based)

| Modello | Esempi | Unità di posizione | Health factor |
|---------|--------|-------------------|---------------|
| **Pooled** | Aave V3, Compound V2, Spark | account globale | globale sull'account |
| **Vault-controller** | Euler V2 | (collateral vault, controller vault) | per-controller |
| **Isolated pairs** | Morpho Blue, Fluid, Silo | mercato (collateral, loan, oracle, lltv) | per-mercato |

**Osservazione chiave:** l'unità che accomuna tutti è la coppia **(collateral, loan)**.
- Pooled: `collateral` è contesto (il pool aggrega tutto), `loan` è l'asset preso in prestito.
- Vault-controller: `(collateral, loan)` → mappa a `(collateral vault, controller vault)`.
- Isolated: `(collateral, loan)` → identifica direttamente il mercato.

**L'interfaccia a 1 token (Aave-centrica) NON generalizza:** Aave è l'eccezione (pool globale), non la regola. L'interfaccia a coppia è quella universale.

## 3. Interfaccia universale — `ILendingProtocol` v2 (pair-based)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Interfaccia universale per ogni protocollo di lending.
/// @dev Convenzione (collateral, loan):
///      - Pooled (Aave): `collateral` è il contesto di collaterale; se ignorato dal
///        protocollo, DEVE comunque essere validato come token supportato.
///      - Vault-controller (Euler): (collateral, loan) → (collateral vault, controller vault).
///      - Isolated (Morpho): (collateral, loan) identifica il mercato isolato.
///      Tutti i fondi presi in prestito / ritirati confluiscono in ProxyGeneral.
interface ILendingProtocol {
    // ---- Supply side (collaterale) ----
    /// @param collateral token code del collaterale
    /// @param loan token code del mercato/loan (== collateral per pooled supply-only context)
    /// @param amount quantità di collaterale da depositare
    function supplyCollateral(string calldata collateral, string calldata loan, uint256 amount) external returns (bool);

    function withdrawCollateral(string calldata collateral, string calldata loan, uint256 amount) external returns (bool);

    // ---- Borrow side (debito) ----
    function borrow(string calldata collateral, string calldata loan, uint256 amount) external returns (bool);

    function repay(string calldata collateral, string calldata loan, uint256 amount) external returns (bool);

    // ---- Views ----
    function getCollateral(string calldata collateral, string calldata loan) external view returns (uint256);

    function getDebt(string calldata collateral, string calldata loan) external view returns (uint256);

    /// @return hf health factor in scala WAD (1e18 = 1.0). type(uint256).max se no debt.
    ///         MAI ritornare max per mascherare un errore (vedi VAL-005).
    function getHealthFactor(string calldata collateral, string calldata loan) external view returns (uint256 hf);

    // ---- Metadata ----
    function protocolType() external pure returns (string memory);  // "AAVE_V3" | "EULER_V2" | "MORPHO_BLUE"
}
```

### 3.1 Note sulla convenzione (collateral, loan)

- **Aave/Compound (pooled)**: il plugin usa `loan` come asset operativo. `collateral` viene validato (deve essere un asset supportato e supplied) ma non vincola un mercato specifico. Per `supplyCollateral` con `loan == collateral` significa "deposita e basta".
- **Euler (vault-controller)**: il plugin risolve `collateral` → collateral vault, `loan` → controller vault. `enableController` avviene lazy alla prima `borrow`.
- **Morpho (isolated)**: `(collateral, loan)` risolve direttamente il `MarketParams` via `MorphoRegistry`. **MorphoPlugin già implementa questa firma** — non va cambiato.

## 4. Interfaccia leverage universale — `ILeverageProtocol`

Separata da `ILendingProtocol` perché non tutti i lender supportano leva atomica.

```solidity
interface ILeverageProtocol {
    struct OpenLeverageParams {
        string collateral;
        string loan;
        uint256 collateralAmount;      // collaterale iniziale dell'utente
        uint256 targetLeverageX100;    // es. 200 = 2x
        uint256 minCollateralAfterSwap; // slippage protection (SWP-001)
        uint256 minHealthFactor;       // in WAD
        uint256 maxSlippageBps;        // enforced nel callback (SWP-001)
        uint256 deadline;
    }

    struct CloseLeverageParams {
        string collateral;
        string loan;
        uint256 minCollateralOut;      // slippage protection
        uint256 maxSlippageBps;
        uint256 deadline;
    }

    function openLeverageAtomic(OpenLeverageParams calldata params)
        external returns (uint256 totalCollateral, uint256 totalDebt, uint256 healthFactor);

    function closeLeverageAtomic(CloseLeverageParams calldata params)
        external returns (uint256 collateralReturned);
}
```

## 5. `ProtocolManager` come unico punto di ingresso

```solidity
contract ProtocolManager {
    // Access control: solo operatori autorizzati (owner + VAC autorizzati).
    // NON gli utenti-LP (che usano solo LiquidityManager per deposit/withdraw shares).
    modifier onlyOperator() { ... }

    // ---- Lending (routing pair-based) ----
    function supplyCollateral(string protocol, string collateral, string loan, uint256 amount) external onlyOperator {
        address plugin = _resolvePlugin(protocol);
        require(ILendingProtocol(plugin).supplyCollateral(collateral, loan, amount), "supply failed");
        emit CollateralSupplied(protocol, collateral, loan, amount);
    }

    function borrow(string protocol, string collateral, string loan, uint256 amount) external onlyOperator {
        address plugin = _resolvePlugin(protocol);
        require(ILendingProtocol(plugin).borrow(collateral, loan, amount), "borrow failed");
        emit Borrowed(protocol, collateral, loan, amount);
    }

    function repay(string protocol, string collateral, string loan, uint256 amount) external onlyOperator {
        // ProxyGeneral invia i fondi al plugin PRIMA della repay
        // (il plugin li usa per ripagare il debito)
        ...
    }

    // ---- Leverage (routing) ----
    function openLeverage(string protocol, ILeverageProtocol.OpenLeverageParams params) external onlyOperator {
        address plugin = _resolvePlugin(protocol);
        ILeverageProtocol(plugin).openLeverageAtomic(params);
        emit LeverageOpened(protocol, params.collateral, params.loan);
    }
}
```

### 5.1 Chi può chiamare cosa (access control definitivo)

| Attore | Può | NON può |
|--------|-----|---------|
| **Utente-LP** | `LiquidityManager.deposit/withdraw` (shares) | toccare ProtocolManager/plugin |
| **Operatore** (owner + VAC autorizzati) | tutto via `ProtocolManager` | (niente vietato tra le operazioni) |
| **ProtocolManager** | chiamare i plugin | — |
| **LiquidityManager** | `ProtocolManager.closePositionsForBaseAsset` (per auto-swap durante withdraw) | — |

## 6. Rimozione del bypass owner (PLG-084)

**Decisione collegata:** i modifier `onlyProtocolManager` dei plugin **NON devono più accettare `owner()`** come bypass.

Prima (bug PLG-084):
```solidity
modifier onlyProtocolManager() {
    if (msg.sender != protocolManager && msg.sender != owner()) revert OnlyProtocolManager();
    _;
}
```

Dopo:
```solidity
modifier onlyProtocolManager() {
    if (msg.sender != protocolManager) revert OnlyProtocolManager();
    _;
}
```

**Eccezione emergency (single escape hatch documentato):**
Un solo path diretto `onlyOwner` per incident response, esplicitamente documentato come "rompe la modularità per emergenza":
```solidity
/// @notice EMERGENCY ONLY — bypassa ProtocolManager. Usare solo se ProtocolManager
///         è compromesso/frozen. Rompe la modularità di proposito.
function emergencyClosePosition(string calldata collateral, string calldata loan)
    external onlyOwner { ... }
```

**Impatto sui test:** i test che oggi fanno `plugin.connect(owner).borrow(...)` devono essere riscritti per passare da ProtocolManager. Questo è desiderabile — è ciò che ha nascosto IFC-004.

## 7. Come regge i lender futuri

| Lender | Modello | Mapping su `ILendingProtocol` pair-based |
|--------|---------|------------------------------------------|
| Compound III | Isolated per base asset | `(collateral, baseAsset)` |
| Spark | Pooled (fork Aave) | `(collateral, loan)`, collateral validato |
| Fluid | Isolated pairs | `(collateral, loan)` diretto |
| Silo | Isolated pairs | `(collateral, loan)` diretto |
| Aave V4 | Isolated "spokes" | `(collateral, loan)` diretto |

Aggiungere un nuovo lender = scrivere un nuovo plugin che implementa `ILendingProtocol` (e opzionalmente `ILeverageProtocol`). **Zero modifiche a ProtocolManager, LiquidityManager, ValueCalculator.**

## 8. Migrazione dei plugin esistenti

| Plugin | Cosa cambia |
|--------|-------------|
| **MorphoPlugin** | ✅ **Già pair-based.** Solo aggiungere `override` + allineare nomi (supplyCollateral). Minimo lavoro. |
| **AaveV3Plugin** | Cambiare firma `borrow(loan, amount)` → `borrow(collateral, loan, amount)`. Il plugin valida `collateral` supplied e usa `loan` per l'operazione Aave. |
| **EulerV2Plugin** | Cambiare firma → `(collateral, loan)`. Risolve collateral vault + controller vault. |
| **MorphoVaultPlugin** | Supply-only, non implementa borrow/repay. Implementa solo `supplyCollateral`/`withdrawCollateral` con `loan == collateral` (il vault è il "mercato"). |

**Osservazione importante:** la migrazione **NON tocca Morpho** (già corretto). Cambia Aave/Euler per aggiungere il parametro collateral. Questo ribalta l'intuizione iniziale ("cambiare Morpho") — è Aave/Euler che si adattano all'interfaccia universale.

## 9. Impatto sui consumatori

| Consumatore | Cosa cambia |
|-------------|-------------|
| `ProtocolManager` | Nuove firme + `openLeverage`/`closeLeverage` esposti + `onlyOperator` |
| Lens adapter | `getHealthFactor(collateral, loan)` — Aave/Euler adapter aggiungono param |
| Script off-chain / VAC | Chiamano ProtocolManager con nuove firme (collateral, loan) |
| Test Hardhat | Riscrivere per passare da ProtocolManager, non `plugin.connect(owner)` |
| `ILendingProtocol` interface | Riscritta pair-based |

## 10. Finding chiusi da questa migrazione

- **IFC-004** — Morpho borrow via ProtocolManager (root del refactor)
- **PLG-084** — owner bypass rimosso
- **IFC-022/23/24** — override mancanti aggiunti
- Parzialmente **PLG-033/34/35** — `minCollateralAfterSwap` entra in `OpenLeverageParams`
- Parzialmente **PLG-030/31/32** — `maxSlippageBps` entra nei params ed è enforced (collegato a C1-06)

## 11. Rischi della migrazione

| Rischio | Mitigazione |
|---------|-------------|
| Rottura di tutti i test esistenti | Riscrivere test come user-journey via ProtocolManager (desiderabile) |
| Storage layout dei plugin cambia | Verificare con `forge inspect storage-layout` prima/dopo |
| Emergency path perde il bypass owner | Escape hatch `emergencyClosePosition` onlyOwner documentato |
| Off-chain scripts rotti | Aggiornare in blocco con la stessa PR |

## 12. Ciclo di implementazione (C1-08 ampliato)

Seguendo il protocollo test-red → fix → test-green:

1. Scrivere `ILendingProtocol` v2 pair-based + `ILeverageProtocol`.
2. Test rosso: user-journey operatore via ProtocolManager (fallisce oggi per Morpho).
3. Migrare MorphoPlugin (minimo: override + nomi).
4. Migrare AaveV3Plugin (aggiungere param collateral).
5. Migrare EulerV2Plugin (aggiungere param collateral).
6. Migrare MorphoVaultPlugin (supply-only con loan==collateral).
7. Aggiornare ProtocolManager (routing + openLeverage/closeLeverage + onlyOperator).
8. Rimuovere bypass owner dai modifier (PLG-084) + escape hatch emergency.
9. Aggiornare Lens adapter (firme pair-based).
10. Riscrivere test come user-journey.
11. Verificare: `forge build`, `hardhat compile`, full suite, Slither differenziale.
12. Aggiornare register.json (IFC-004, PLG-084, IFC-022/23/24 → fixed-pending-verification).

**Stima:** 8-16 ore agente + review intermedie.

## 13. Decisione registrata

Vedi `security/DECISIONS.md` DEC-006. Approvata da `@Poppo753` il 2026-07-17.
