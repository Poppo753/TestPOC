# 🔧 Piano di Integrazione Euler V2

**Data:** 29 Novembre 2025  
**Versione:** 1.0  
**Autore:** Copilot Analysis

---

## 📋 Indice

1. [Executive Summary](#executive-summary)
2. [Architettura Attuale](#architettura-attuale)
3. [Architettura Proposta](#architettura-proposta)
4. [Componenti da Creare](#componenti-da-creare)
5. [Dettaglio EulerV2Plugin](#dettaglio-eulerv2plugin)
6. [Dettaglio EulerLensAdapter](#dettaglio-eulerlensadapter)
7. [Flussi Operativi](#flussi-operativi)
8. [Modifiche ai Contratti Esistenti](#modifiche-ai-contratti-esistenti)
9. [Piano di Implementazione](#piano-di-implementazione)
10. [Rischi e Mitigazioni](#rischi-e-mitigazioni)

---

## Executive Summary

### La Tua Idea è ✅ Coerente e Fattibile

La proposta di creare un **EulerV2Plugin** segue perfettamente il pattern già consolidato con `DolomitePlugin`. L'architettura esistente è stata progettata proprio per questo tipo di estensioni modulari.

### Cosa Creeremo

| Componente | Tipo | Responsabilità |
|------------|------|----------------|
| **EulerV2Plugin** | Plugin ProtocolManager | deposit, withdraw, borrow, repay, posizioni leva |
| **EulerLensAdapter** | Adapter Oracle | health monitoring, valori posizioni, integrazione ValueCalculator |
| **IEulerV2Plugin** | Interfaccia | Estende ILendingProtocol con funzioni leverage |

### Perché Questa Struttura

1. **EulerV2Plugin in ProtocolManager** (non SwapManager):
   - ProtocolManager gestisce già lending via `ILendingProtocol`
   - Il pattern custody ProxyGeneral ↔ Plugin è consolidato
   - SwapManager è per swap spot, non posizioni

2. **Separare il Lens/Oracle Adapter**:
   - ValueCalculator usa pattern modulare `IOracleAdapter`
   - LiquidityManager ha bisogno di valori Euler per auto-close
   - Separazione = meno accoppiamento, più riusabilità

---

## Architettura Attuale

```
┌─────────────────────────────────────────────────────────────────┐
│                          BEACON (Registry)                       │
│    Risolve: "ProxyGeneral", "TokenManager", "DolomitePlugin"    │
└─────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ ProxyGeneral  │◄────────│ProtocolManager  │────────►│ LiquidityManager│
│   (Custody)   │         │  (Orchestrator) │         │ (Deposit/Withdr)│
└───────────────┘         └─────────────────┘         └─────────────────┘
        ▲                           │                           │
        │                           ▼                           ▼
        │                 ┌─────────────────┐         ┌─────────────────┐
        │                 │ DolomitePlugin  │         │ ValueCalculator │
        │                 │(ILendingProtocol)│        │  (Pool Values)  │
        │                 └─────────────────┘         └─────────────────┘
        │                           │                           │
        │                           ▼                           ▼
        │                 ┌─────────────────┐         ┌─────────────────┐
        └─────────────────│    Dolomite     │         │ ChainlinkAdapter│
                          │    Protocol     │         │  (IOracleAdapter)│
                          └─────────────────┘         └─────────────────┘
```

### Pattern Custody Esistente

```
DEPOSIT:
  ProxyGeneral.withdrawToken(token, amount, plugin)
       ↓
  Plugin riceve token
       ↓
  Plugin.deposit() → Protocollo Esterno

WITHDRAW:
  Plugin preleva da Protocollo Esterno
       ↓
  Plugin.transfer(proxyGeneral, amount)
       ↓
  Token tornano in custody
```

---

## Architettura Proposta

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BEACON (Registry)                               │
│  + "EulerV2Plugin", "EulerLensAdapter"                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
         ┌──────────────────────────────┼───────────────────────────────────┐
         ▼                              ▼                                   ▼
┌─────────────────┐          ┌──────────────────┐              ┌──────────────────┐
│  ProxyGeneral   │◄─────────│ ProtocolManager  │──────────────│ LiquidityManager │
│  (Custody)      │          │  (Orchestrator)  │              │ (+ Euler close)  │
└─────────────────┘          └──────────────────┘              └──────────────────┘
         ▲                              │                               │
         │              ┌───────────────┼───────────────┐               │
         │              ▼               ▼               ▼               │
         │     ┌──────────────┐ ┌──────────────┐ ┌────────────────┐     │
         │     │DolomitePlugin│ │EulerV2Plugin │ │EulerLensAdapter│◄────┘
         │     └──────────────┘ └──────────────┘ └────────────────┘
         │                              │               │
         │                              ▼               ▼
         │                      ┌──────────────┐ ┌──────────────┐
         │                      │     EVC      │ │ AccountLens  │
         │                      │  (Batching)  │ │  UtilsLens   │
         │                      └──────────────┘ └──────────────┘
         │                              │
         │                              ▼
         │                      ┌──────────────┐
         └──────────────────────│ Euler Vaults │
                                │ eWETH, eUSDC │
                                │ eUSDT, eWBTC │
                                └──────────────┘
```

---

## Componenti da Creare

### 1. Interfaccia IEulerV2Plugin

```
contracts/interfaces/IEulerV2Plugin.sol
```

Estende `ILendingProtocol` con funzioni specifiche per Euler V2.

### 2. EulerV2Plugin

```
contracts/plugins/EulerV2Plugin.sol
```

Implementa tutte le operazioni Euler: deposit, withdraw, borrow, repay, leverage.

### 3. EulerLensAdapter

```
contracts/adapters/EulerLensAdapter.sol
```

Interroga i Lens contracts di Euler per health monitoring e valori.

### 4. Modifiche Esistenti

| Contratto | Modifica |
|-----------|----------|
| `LiquidityManager` | Aggiungere logica auto-close posizioni Euler |
| `ValueCalculator` | Includere valore posizioni Euler nel calcolo pool |
| `Beacon` | Registrare nuovi moduli |

---

## Dettaglio EulerV2Plugin

### Storage

```solidity
contract EulerV2Plugin is IEulerV2Plugin, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ==================== IMMUTABLES ====================
    address public immutable beacon;
    IEVC public immutable evc;
    
    // ==================== CONSTANTS ====================
    // Indirizzi Euler V2 su Arbitrum
    address constant EVC_ADDRESS = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
    address constant SWAPPER = 0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7;
    address constant SWAP_VERIFIER = 0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5;
    
    // ==================== STATE ====================
    bool public circuitBreakerTripped;
    
    // Token Code → Euler Vault address
    mapping(string => address) public tokenVaults;
    
    // Position tracking
    uint256 public nextPositionId;
    mapping(uint256 => LeveragePosition) public positions;
    
    struct LeveragePosition {
        uint8 subAccountId;           // 1-255 (0 reserved for simple deposits)
        address collateralVault;
        address borrowVault;
        uint256 initialCollateral;
        uint256 borrowedAmount;
        bool isActive;
        uint256 createdAt;
    }
}
```

### Funzioni Base (via ProtocolManager)

```solidity
// ==================== IProtocolManager ====================

function deposit(string memory tokenCode, uint256 amount) 
    external 
    override 
    onlyProtocolManager 
    notCircuitBroken 
    returns (bool) 
{
    address token = _resolveToken(tokenCode);
    address vault = tokenVaults[tokenCode];
    require(vault != address(0), "Vault not configured");
    
    // Token già nel contratto (inviati da ProtocolManager)
    require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
    
    // Approva vault Euler
    IERC20(token).safeApprove(vault, amount);
    
    // Deposita nel vault (sub-account 0 per depositi semplici)
    IEVault(vault).deposit(amount, address(this));
    
    emit Deposited(tokenCode, amount, vault);
    return true;
}

function withdraw(string memory tokenCode, uint256 amount)
    external
    override
    onlyProtocolManager
    notCircuitBroken
    returns (bool)
{
    address token = _resolveToken(tokenCode);
    address vault = tokenVaults[tokenCode];
    
    // Preleva da Euler
    uint256 withdrawn = IEVault(vault).withdraw(amount, address(this), address(this));
    
    // Trasferisci a ProxyGeneral (CRITICO per custody)
    address proxyGeneral = _getProxyGeneral();
    IERC20(token).safeTransfer(proxyGeneral, withdrawn);
    
    emit Withdrawn(tokenCode, withdrawn, vault);
    return true;
}
```

### Funzioni Lending (via ProtocolManager)

```solidity
// ==================== ILendingProtocol ====================

function borrow(string memory tokenCode, uint256 amount)
    external
    override
    onlyProtocolManager
    notCircuitBroken
    returns (bool)
{
    address vault = tokenVaults[tokenCode];
    address token = _resolveToken(tokenCode);
    
    // Borrow da Euler (sub-account 0)
    IEVault(vault).borrow(amount, address(this));
    
    // Trasferisci borrowed tokens a ProxyGeneral
    address proxyGeneral = _getProxyGeneral();
    IERC20(token).safeTransfer(proxyGeneral, amount);
    
    emit Borrowed(tokenCode, amount);
    return true;
}

function repay(string memory tokenCode, uint256 amount)
    external
    override
    onlyProtocolManager
    notCircuitBroken
    returns (bool)
{
    address vault = tokenVaults[tokenCode];
    address token = _resolveToken(tokenCode);
    
    // Token già nel contratto (inviati da ProtocolManager)
    IERC20(token).safeApprove(vault, amount);
    
    // Repay su Euler
    IEVault(vault).repay(amount, address(this));
    
    emit Repaid(tokenCode, amount);
    return true;
}

function getDebt(string memory tokenCode) 
    external 
    view 
    override 
    returns (uint256) 
{
    address vault = tokenVaults[tokenCode];
    return IEVault(vault).debtOf(address(this));
}

function getHealthFactor() 
    external 
    view 
    override 
    returns (uint256) 
{
    // Delega a EulerLensAdapter
    address lensAdapter = IBeacon(beacon).getImplementation("EulerLensAdapter");
    return IEulerLensAdapter(lensAdapter).getHealthFactor(address(this));
}
```

### Funzioni Leverage (chiamate direttamente)

```solidity
// ==================== IEulerV2Plugin (Leverage) ====================

struct OpenLeverageParams {
    string collateralTokenCode;
    string borrowTokenCode;
    uint256 collateralAmount;
    uint256 borrowAmount;
    uint256 minCollateralReceived;  // Slippage protection
    bytes swapData;                  // Dati per Swapper Euler
    uint256 deadline;
}

function openLeveragePosition(OpenLeverageParams calldata params)
    external
    onlyOwner
    notCircuitBroken
    returns (uint256 positionId)
{
    // 1. Assegna sub-account per questa posizione
    uint8 subAccountId = uint8((nextPositionId % 254) + 1); // 1-255
    address subAccount = _deriveSubAccount(subAccountId);
    
    // 2. Prepara batch EVC
    IEVC.BatchItem[] memory items = _buildOpenLeverageBatch(
        params,
        subAccountId,
        subAccount
    );
    
    // 3. Esegui batch atomico
    evc.batch(items);
    
    // 4. Registra posizione
    positionId = nextPositionId++;
    positions[positionId] = LeveragePosition({
        subAccountId: subAccountId,
        collateralVault: tokenVaults[params.collateralTokenCode],
        borrowVault: tokenVaults[params.borrowTokenCode],
        initialCollateral: params.collateralAmount,
        borrowedAmount: params.borrowAmount,
        isActive: true,
        createdAt: block.timestamp
    });
    
    emit LeveragePositionOpened(positionId, subAccountId, params.collateralAmount, params.borrowAmount);
}

function closeLeveragePosition(uint256 positionId)
    external
    onlyOwner
    notCircuitBroken
    returns (uint256 collateralReturned)
{
    LeveragePosition storage pos = positions[positionId];
    require(pos.isActive, "Position not active");
    
    // 1. Prepara batch per chiudere
    IEVC.BatchItem[] memory items = _buildCloseLeverageBatch(pos);
    
    // 2. Esegui batch atomico
    evc.batch(items);
    
    // 3. Trasferisci collaterale residuo a ProxyGeneral
    address collateralToken = IEVault(pos.collateralVault).asset();
    collateralReturned = IERC20(collateralToken).balanceOf(address(this));
    
    if (collateralReturned > 0) {
        IERC20(collateralToken).safeTransfer(_getProxyGeneral(), collateralReturned);
    }
    
    // 4. Marca posizione come chiusa
    pos.isActive = false;
    
    emit LeveragePositionClosed(positionId, collateralReturned);
}
```

---

*Continua nel documento 08_Integration_Plan_Part2.md*
