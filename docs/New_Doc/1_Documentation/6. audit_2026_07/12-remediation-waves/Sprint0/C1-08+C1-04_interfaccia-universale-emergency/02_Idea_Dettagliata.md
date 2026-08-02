# C1-08 + C1-04 — IDEA DETTAGLIATA

> Pipeline step 3. Espansione massima con **inventario reale del codice** (verificato via
> 3 mappature parallele del sorgente, 2026-07-27) + piano file-per-file. In coda: revisione
> (step 4) + decisioni da confermare prima della checklist.

---

## 0. AVVISO — 3 scoperte che divergono dal design doc

L'inventario del codice reale ha rivelato che `security/design/UNIVERSAL_LENDING_INTERFACE.md` (approvato) contiene **3 assunzioni non allineate al sorgente**. Vanno riconciliate prima di implementare (gate umano):

1. **L'interfaccia che i plugin implementano NON è `ILendingProtocol`, è `IProtocolAdapter`.**
   - Ogni plugin fa `is I<Nome>Plugin`, e `I<Nome>Plugin is IProtocolAdapter`.
   - `ILendingProtocol` è un'interfaccia legacy semi-abbandonata che per di più fa `is IProtocolManager` (confusione storica). L'interfaccia Euler documenta: *"These come from ILendingProtocol which is being replaced by IProtocolAdapter"*.
   - `ProtocolManager.borrow` fa il cast `ILendingProtocol(plugin).borrow(tokenCode, amount)` — ecco perché con Morpho il selector non esiste (IFC-004).
   - **Decisione D1 richiesta:** il pair-based va applicato a `IProtocolAdapter` (quella vera) — non a `ILendingProtocol`. Vedi §7.

2. **`ProtocolManager` NON ha `onlyOperator` — ha solo `onlyOwner` (OZ Ownable).**
   - Non esiste alcun sistema operatori: niente `authorizedOperators`, niente `addOperator/removeOperator`.
   - DEC-008 (A2) richiede di **costruirlo da zero**. È lavoro netto, non un rename.

3. **`ProtocolManager` NON ha `openLeverage`/`closeLeverage`/`rebalance`.**
   - La leva oggi si raggiunge solo via `executeProtocolCall` (low-level call whitelistata) o chiamando `plugin.openLeverageAtomic(...)` direttamente (`onlyOwner` sul plugin).
   - Esporre la leva via ProtocolManager + unificare i 3 struct divergenti in una `ILeverageProtocol` condivisa è lavoro **netto**.

**Conseguenza:** la stima "8-16h" del design doc è ottimista. Con operator-system + leverage-entrypoints + 2 sistemi di registro da riconciliare, è realisticamente **più grande**. Va spezzato in sub-fasi con checkpoint (vedi §8).

---

## 1. INVENTARIO REALE DEL CODICE (verificato 2026-07-27)

### 1.1 Interfacce esistenti

| Interfaccia | File | Ruolo reale |
|-------------|------|-------------|
| `IProtocolAdapter` | `contracts/interfaces/IProtocolAdapter.sol` | **QUELLA VERA** — base di tutti i plugin. Metodi token-code single. |
| `ILendingProtocol` | `contracts/interfaces/ILendingProtocol.sol` | Legacy. `is IProtocolManager`. Usata solo dal cast in ProtocolManager.borrow/repay/getDebt/getHealthFactor. |
| `IProtocolManager` | `contracts/interfaces/IProtocolManager.sol` | Base plugin-facing (deposit/withdraw/getBalance/closePositionsForBaseAsset). NON è l'API del contratto ProtocolManager. |
| `ILeverageProtocol` | ❌ NON ESISTE | Da creare. |
| `IEulerV2PluginSpecific` | `contracts/interfaces/IEulerV2PluginSpecific.sol` | Contiene un `OpenLeverageParams` (fields diversi dai plugin). |

### 1.2 Firme attuali dei plugin (S = single-token, P = pair-based)

| Metodo | Aave | Euler | Morpho | MorphoVault | InterVault |
|--------|------|-------|--------|-------------|------------|
| supply | `deposit(string,uint256)` S | `deposit` S | `deposit` S **+ `supplyCollateral(string,string,uint256)` P** | `deposit` S | `deposit` S |
| withdraw | `withdraw(string,uint256)` S | S | S **+ `withdrawCollateral` P** | S | S |
| borrow | `borrow(string,uint256)` S | S | **`borrow(string,string,uint256)` P** | ❌ | ❌ |
| repay | `repay(string,uint256)` S | S | **P** | ❌ | ❌ |
| getHealthFactor | `getHealthFactor()` S(no-arg) | S(no-arg) | **`getHealthFactor(string,string)` P** | ❌ | ❌ |
| getDebt | `getDebt(string)` S | `getDebt(string)` S(no override) | **`getDebt(string,string)` P** | ❌ | ❌ |
| getCollateral | ❌ (usa getBalance) | ❌ | **`getCollateral(string,string)` P** | ❌ | ❌ |
| close pair | `closePosition(string,string)` | `closePosition(string,string)` (no override) | `closeMarketPosition(string,string)` | ❌ | ❌ |
| openLeverageAtomic | struct `OpenLeverageAtomicParams` (L103) | struct (L685) | struct (L111) | ❌ | ❌ |
| closeLeverageAtomic | struct (L112) | struct (L819) | struct (L120) | ❌ | ❌ |

**Morpho è già interamente pair-based** (è il modello). Aave/Euler sono single-token con `getHealthFactor()` no-arg e nessun `getCollateral`.

### 1.3 Owner-bypass (PLG-084) — presente in TUTTI e 5

Modifier identico in tutti (con piccole varianti di forma):
```solidity
modifier onlyProtocolManager() {
    address protocolManager = IBeacon(beacon).getImplementation("ProtocolManager");
    if (msg.sender != protocolManager && msg.sender != owner()) revert OnlyProtocolManager();
    _;
}
```
Righe: Aave 166-172, Euler 210-216, Morpho 172-178, MorphoVault 94-100, InterVault 76-80.

### 1.4 `closePositionsForBaseAsset` — semantica divergente (CORE-081), verificata

| Plugin | Guard | Cosa chiude | Risk-sorted? |
|--------|-------|-------------|--------------|
| Aave (L454) | onlyOwnerOrLiquidityManager | SOLO supply del base asset (no debito, no leva) | ❌ |
| **Euler (L1403)** | onlyOwnerOrLiquidityManager | posizioni leverage via `getPositionsSortedByRisk()`, chiude fino a target | ✅ **è il modello** |
| Morpho (L530) | onlyOwnerOrLiquidityManager | mercati dove il collaterale è il base asset (repay+withdraw), ordine registry | ❌ |
| MorphoVault (L196) | onlyProtocolManager | TUTTI i vault, **ignora `targetAmount`** | ❌ |
| InterVault (L161) | onlyProtocolManager | singolo child del base asset | ❌ |

### 1.5 ProtocolManager (contract) — stato access control e routing

- `contract ProtocolManager is Ownable` (OZ v4 style, `Ownable()` no-arg).
- Access control: **solo `onlyOwner`** + un `onlyOwnerOrLiquidityManager` (L191-198) usato SOLO da `closePositionsForBaseAsset(uint256)` (L799).
- Nessun `onlyOperator`, nessun `authorizedOperators`.
- Chiamate plugin single-token: `deposit`/`withdraw`/`borrow(tokenCode,amount)` L320 / `repay` L351 / `getDebt(tokenCode)` L402 / `getHealthFactor()` L414.
- **Nessun** `openLeverage`/`closeLeverage`/`rebalance`.
- `closePositionsForBaseAsset(uint256)` (L799) itera `registeredProtocolNames` (registro locale) e chiama `IProtocolAdapter(info.plugin).closePositionsForBaseAsset(stillNeeded)` in try/catch, stop quando `obtained >= targetAmount`.
- **Doppio sistema di risoluzione plugin:** ops → Beacon by name (`_resolvePlugin`); portfolio/close → registro locale `protocols[name].plugin`. Da riconciliare (rischio di disallineamento).

### 1.6 Emergency / custody — stato (verificato)

- **`ProxyGeneral.emergencyTransfer(address,uint256,address)` NON esiste** (solo in `IProxyGeneral.sol:293`). `EmergencyHandler.emergencyWithdraw()` la chiama (L330/363) → contro produzione va in `fallback()` → `revert("Function does not exist")`, mascherato dal try/catch (ogni token contato come "failed", 0 trasferito). Contro `MockProxyGeneral` il fallback vuoto "riesce" → **maschera il bug nei test**.
- `ProxyGeneral.emergencyTransferAll(address recipient)` (L459) `onlyOwner whenPaused`: sweep SOLO base asset + ETH (non gli altri ERC20). Setta `emergencyRecipient`.
- `EmergencyHandler.emergencyWithdraw()` (L291) `onlyOwner`, **NO whenPaused**, manda tutto a `owner()`, one-shot flag `emergencyExecuted["withdraw"]`. `resetEmergencyState("withdraw")` (L671) la ri-arma.
- Overload `emergencyWithdraw(address,uint256,address)` (L948) `onlyOwner`, recipient arbitrario, **no try/catch**.
- **Pause:** custom (non OZ). `ProxyGeneral.pause()` (L430) `onlyAuthorizedModule`; `unpause()` (L440) `onlyOwner`. `LiquidityManager.deposit/withdraw` gated `whenNotPaused` (legge `proxy.paused()`).
- **Emergency contacts:** in EmergencyHandler. `onlyEmergencyAuthorized` (L141) = owner + `isEmergencyContact`. `emergencyPause` (L165) chiamabile dai contatti. `emergencyUnpause` (L206) solo owner, con timelock (default 6h). `addEmergencyContact`/`removeEmergencyContact` onlyOwner. → **DEC-008 B2 è già in parte supportato** dall'infrastruttura contatti esistente.
- **LiquidityManager silent clamp** (L329-331) + accept 97% (L494) + try/catch-return-0 (L576): sono **C1-02**, non questa wave, ma il path di unwind (`_closeProtocolPositionsForBaseAsset` L567 → `ProtocolManager.closePositionsForBaseAsset`) è ciò che C1-04/CORE-081 sistema.

### 1.7 Struct leverage attuali (3 copie divergenti)

`OpenLeverageAtomicParams` (Aave L103, Morpho L111, Euler L685) — campi:
```
string collateralToken; string borrowToken; uint256 collateralAmount;
uint256 targetLeverageX100; uint256 minHealthFactor; uint256 deadline;
```
`CloseLeverageAtomicParams` (Aave L112, Morpho L120, Euler L819) — campi:
```
string collateralToken; string borrowToken; uint256 maxSlippageBps; uint256 deadline;
```
**Mancano** `minCollateralAfterSwap` e (nell'open) `maxSlippageBps` → li aggiunge DEC-006/C1-06.
Inoltre `IEulerV2PluginSpecific.OpenLeverageParams` (L30) ha campi ancora diversi (`borrowAmount`, `minCollateralReceived`, `bytes swapData`).

---

## 2. GAP ANALYSIS (design approvato vs realtà)

| Design doc dice | Realtà | Azione |
|-----------------|--------|--------|
| "riscrivere `ILendingProtocol` pair-based" | plugin usano `IProtocolAdapter` | **D1**: rendere `IProtocolAdapter` pair-based (non ILendingProtocol) |
| "ProtocolManager ha `onlyOperator`" | ha solo `onlyOwner` | costruire operator-system (DEC-008 A2) |
| "ProtocolManager espone openLeverage" | non esiste | aggiungere entrypoints + `ILeverageProtocol` condivisa |
| "Morpho già pair-based, solo override" | ✅ vero | Morpho minime modifiche |
| "Aave/Euler aggiungono collateral" | ✅ vero | migrazione firme |
| "MorphoVault supply-only loan==collateral" | ✅ vero (ma non ha supplyCollateral) | aggiungere supplyCollateral pair supply-only |
| emergency: rimuovere drain | drain è pure **rotto** (selector mancante) | rimuovere + redesign No-drain |

---

## 3. TARGET — interfaccia universale (riconciliata col codice reale)

### 3.1 `IProtocolAdapter` v2 pair-based (l'interfaccia VERA)
Rendere `IProtocolAdapter` pair-based (retro-compat NON richiesta: fase test). Firme:
```solidity
function supplyCollateral(string calldata collateral, string calldata loan, uint256 amount) external returns (bool);
function withdrawCollateral(string calldata collateral, string calldata loan, uint256 amount) external returns (bool);
function borrow(string calldata collateral, string calldata loan, uint256 amount) external returns (bool);
function repay(string calldata collateral, string calldata loan, uint256 amount) external returns (bool);
function getCollateral(string calldata collateral, string calldata loan) external view returns (uint256);
function getDebt(string calldata collateral, string calldata loan) external view returns (uint256);
function getHealthFactor(string calldata collateral, string calldata loan) external view returns (uint256 hf);
function closePositionsForBaseAsset(uint256 targetAmount) external returns (uint256 obtained, uint256 positionsClosed);
function protocolType() external pure returns (string memory);
```
- Plugin **supply-only** (MorphoVault/InterVault): implementano supply/withdraw pair con `loan==collateral`; `borrow/repay` → revert `UnsupportedOperation` (o non in questa sub-interfaccia — vedi D1b).
- `getHealthFactor` pair-based per tutti (Aave/Euler ignorano parte del pair ma validano).

### 3.2 `ILeverageProtocol` (nuova, condivisa)
Come da design doc §4, con i campi slippage (DEC-006 + C1-06):
```solidity
struct OpenLeverageParams { string collateral; string loan; uint256 collateralAmount;
  uint256 targetLeverageX100; uint256 minCollateralAfterSwap; uint256 minHealthFactor;
  uint256 maxSlippageBps; uint256 deadline; }
struct CloseLeverageParams { string collateral; string loan; uint256 minCollateralOut;
  uint256 maxSlippageBps; uint256 deadline; }
function openLeverageAtomic(OpenLeverageParams calldata) external returns (uint256,uint256,uint256);
function closeLeverageAtomic(CloseLeverageParams calldata) external returns (uint256);
```
Sostituisce i 3 struct locali divergenti con UN tipo condiviso.

### 3.3 Unwind uniforme (DEC-007) — semantica per `closePositionsForBaseAsset`
Modello **Euler** (già corretto) propagato a tutti:
1. Raccogli tutte le posizioni (leverage + supply) del plugin.
2. Ordina per HF crescente (più rischiose prima) — via lens `getPositionsSortedByRisk()` dove esiste.
3. Chiudi progressivamente: withdrawal mode → fino a `targetAmount`; emergency mode → tutto.
Per i plugin supply-only (MorphoVault/InterVault) "sort-by-risk" è banale (nessun debito) ma devono **rispettare `targetAmount`** (MorphoVault oggi lo ignora — bug da fixare).

### 3.4 ProtocolManager v2
- Aggiungere sistema operatori (DEC-008 A2):
  ```solidity
  mapping(address => bool) public authorizedOperators;
  function addOperator(address) external onlyOwner; function removeOperator(address) external onlyOwner;
  modifier onlyOperator() { require(msg.sender == owner() || authorizedOperators[msg.sender], "not operator"); _; }
  event OperatorAuthorized(address indexed operator, bool authorized);
  ```
- Convertire supply/withdraw/borrow/repay a firma pair-based `(protocol, collateral, loan, amount)` + `onlyOperator`.
- Aggiungere `openLeverage/closeLeverage(protocol, params)` con routing a `ILeverageProtocol`.
- Aggiungere `emergencyUnwindAll()` (emergency mode: chiude tutto su tutti i plugin) triggerabile da owner + emergency contacts (DEC-008 B2).
- Riconciliare i due sistemi di risoluzione plugin (usare il Beacon come unica fonte, o il registro — decisione D2).

### 3.5 Emergency No-drain (C1-04 / DEC-007)
- **Rimuovere**: `EmergencyHandler.emergencyWithdraw()` (L291), overload `(address,uint256,address)` (L948), `ProxyGeneral.emergencyTransferAll` (L459) + la dead `emergencyTransfer` dall'interfaccia.
- **Tenere/estendere**: `pause`/`unpause` (già ok), emergency contacts (già ok, serve DEC-008 B2), `emergencyClosePosition` onlyOwner come escape hatch documentato.
- **Aggiungere**: flusso `pause()` → `ProtocolManager.emergencyUnwindAll()` (owner + contacts) → pool withdraw-only → LP ritirano pro-rata via `LiquidityManager.withdraw`.
- Nessuna funzione manda fondi a un EOA.

---

## 4. PIANO FILE-PER-FILE (ordinato, test-red → green)

Sub-fasi con checkpoint umano tra loro (vedi §8 per il perché spezzato):

**SUB-FASE A — Interfacce (foundation, nessun cambio di comportamento)**
1. `IProtocolAdapter.sol` → pair-based (§3.1).
2. Nuovo `ILeverageProtocol.sol` (§3.2).
3. Rimuovere `emergencyTransfer` fantasma da `IProxyGeneral.sol`.

**SUB-FASE B — Test rosso user-journey**
4. Nuovo `test/foundry/.../UniversalLendingJourney.t.sol`: operatore via ProtocolManager apre/chiude su ogni plugin (oggi rosso per Morpho + per assenza operator/leverage entrypoints).

**SUB-FASE C — Plugin (uno alla volta, build tra ciascuno)**
5. MorphoPlugin: allineare a `IProtocolAdapter` v2 (override + nomi). Minimo.
6. AaveV3Plugin: firme pair-based + rimozione owner-bypass + `closePositionsForBaseAsset` sort-by-risk (include leva).
7. EulerV2Plugin: firme pair-based + rimozione owner-bypass + fix override mancanti (L482/L580).
8. MorphoVaultPlugin: `supplyCollateral/withdrawCollateral` pair supply-only + rispettare `targetAmount` + rimozione owner-bypass.
9. InterVaultPlugin: idem supply-only + rispettare `targetAmount` + rimozione owner-bypass.

**SUB-FASE D — ProtocolManager**
10. Operator-system (DEC-008 A2).
11. Routing pair-based supply/withdraw/borrow/repay + `onlyOperator`.
12. `openLeverage/closeLeverage` + `ILeverageProtocol` routing.
13. `emergencyUnwindAll()` (owner + contacts).
14. Riconciliare risoluzione plugin (D2).

**SUB-FASE E — Emergency No-drain**
15. Rimuovere le funzioni di drain (EmergencyHandler + ProxyGeneral).
16. Cablare pause → emergencyUnwindAll → withdraw-only.
17. `emergencyClosePosition` onlyOwner escape hatch.

**SUB-FASE F — Adapter Lens + consumatori**
18. Lens adapter: `getHealthFactor(collateral, loan)` per Aave/Euler.
19. Script off-chain/VAC: aggiornare firme.

**SUB-FASE G — Test + verifica**
20. Riscrivere i test come user-journey; green.
21. `forge build` + `hardhat compile` + full suite + `forge inspect storage-layout` prima/dopo su ogni plugin + Slither differenziale.
22. register.json: IFC-004/PLG-084/IFC-022/23/24/CORE-081/CORE-001/015/010/NEW-010/018 → fixed-pending-verification.

---

## 5. STRATEGIA DI TEST
- **User-journey operatore**: `ProtocolManager.addOperator(vac)`, poi vac apre/chiude posizioni su ogni plugin. Verifica routing pair-based su tutti.
- **Access control**: LP non può chiamare ProtocolManager; owner-bypass sui plugin rimosso (chiamata diretta plugin → revert); solo ProtocolManager (o escape hatch onlyOwner) passa.
- **Unwind sort-by-risk**: creare 2+ posizioni con HF diversi, verificare che la più rischiosa si chiude prima; withdrawal si ferma a targetAmount; emergency chiude tutto.
- **No-drain**: owner NON può prendere custody (le funzioni non esistono più); dopo pause+unwind, LP ritira pro-rata.
- **Storage layout**: `forge inspect <Plugin> storage-layout` prima/dopo — deve restare invariato (le firme cambiano, non lo storage).

---

## 6. RISCHI
| Rischio | Mitigazione |
|---------|-------------|
| Superficie enorme, rottura a cascata | sub-fasi con build+checkpoint tra ciascuna |
| Cambio storage plugin | `forge inspect storage-layout` before/after |
| Riconciliazione due-registri introduce regressioni | isolare in D2, test dedicato |
| Rimuovere drain lascia il sistema senza escape se withdraw è rotto | `emergencyClosePosition` onlyOwner + property test su withdraw+unwind |
| Interfaccia `ILendingProtocol` legacy ancora referenziata altrove | grep completo prima di rimuoverla; potrebbe restare come alias deprecato |

---

## 7. DECISIONI — ✅ CONFERMATE (Poppo753, 2026-07-27, DEC-009)

**D1a — ✅ Target = `IProtocolAdapter`** (l'interfaccia reale). `ILendingProtocol` legacy + i cast in ProtocolManager → cleanup (previa grep sugli usi residui).

**D1b — ✅ Unica interfaccia + revert** (scelta utente). `IProtocolAdapter` v2 contiene anche `borrow`/`repay`; MorphoVault/InterVault li dichiarano e revertano `UnsupportedOperation`. **Chiarimento vincolante:** supply-only tocca SOLO borrow/repay; `supplyCollateral`/`withdrawCollateral` restano operativi (è così che InterVault restituisce i fondi).

**D2 — ✅ Risoluzione plugin unica sul Beacon.** L'indirizzo del plugin si risolve sempre dal Beacon by-name; il registro locale `protocols[name]` resta solo per metadati (isActive, lensAdapter), senza duplicare l'indirizzo del plugin.

**D3 — ✅ Sub-fasi con checkpoint** (A→G). Review dopo B (interfacce+test rosso) e dopo C (plugin). Build rossa durante il refactor breaking = atteso.

---

## 8. REVISIONE (pipeline step 4)

Rilettura e rianalisi dopo la conferma delle decisioni.

**V1 — Il target `IProtocolAdapter` v2 regge per tutti i 5 plugin?** ✅ Sì. Aave/Euler/Morpho implementano supply/borrow/repay/views pair-based; MorphoVault/InterVault implementano supply/withdraw pair (loan==collateral) + revert su borrow/repay. `closePositionsForBaseAsset`, `closePosition(uint256)`, `getBalance`, `emergencyWithdrawAll`, `activateCircuitBreaker`, struct/enum/eventi di IProtocolAdapter restano.

**V2 — Rimuovere borrow/repay single-token rompe qualcosa oltre ProtocolManager?** ⚠️ Da verificare con grep completo prima di rimuovere: cercare chiamanti di `.borrow(string,uint256)` / `.repay(string,uint256)` / `ILendingProtocol` in tutto `contracts/`, script, test. Aggiunto task in checklist (Fase A0 — grep di impatto).

**V3 — `getHealthFactor()` no-arg → pair-based rompe i lens/consumatori?** ⚠️ Sì (Aave/Euler adapter + ProtocolManager.getHealthFactor L414 + getGlobalHealthFactor). Va propagato in Sub-fase F. Aggiunto task.

**V4 — La rimozione dell'owner-bypass rompe i test esistenti?** ✅ Sì ed è desiderato (è ciò che mascherava IFC-004). I test vanno riscritti user-journey (Sub-fase G). Serve però l'escape hatch `emergencyClosePosition` onlyOwner PRIMA di rimuovere il bypass, per non lasciare scoperto l'incident response.

**V5 — `emergencyUnwindAll` e `closePositionsForBaseAsset` sono la stessa cosa?** Parzialmente. `closePositionsForBaseAsset(target)` = withdrawal mode (fino a target). `emergencyUnwindAll()` = emergency mode (tutto). Implementare `emergencyUnwindAll` come `closePositionsForBaseAsset(type(uint256).max)` su tutti i plugin. Chiarito: un solo meccanismo, due modalità (target finito vs infinito).

**V6 — Storage layout dei plugin cambia?** Le firme cambiano, lo storage no. Ma aggiungere `authorizedOperators` a ProtocolManager aggiunge storage (append in coda → sicuro). `forge inspect storage-layout` before/after su ProtocolManager + ogni plugin (task in checklist).

**V7 — Ordine sicuro delle sub-fasi.** Correzione: l'escape hatch `emergencyClosePosition` va introdotto PRIMA della rimozione owner-bypass — altrimenti tra le due l'incident response è scoperto. Riflesso in checklist.

**Conclusione revisione:** target confermato solido. 3 correzioni al piano: (a) Fase A0 grep di impatto prima di rimuovere le firme legacy; (b) escape hatch emergency prima della rimozione bypass; (c) `emergencyUnwindAll` = `closePositionsForBaseAsset(∞)`, un solo meccanismo. Procedo con la checklist recependole.
