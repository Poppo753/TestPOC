# Guida Pratica: Creare un Nuovo Plugin per un Protocollo DeFi

> Questa guida spiega come integrare un nuovo protocollo di lending/yield nel sistema,
> seguendo il pattern **"3 Musketeers"** già collaudato con Euler V2.

---

## Indice

1. [Panoramica: Cosa Serve](#1-panoramica-cosa-serve)
2. [Step 1: Registry (La Mappa)](#2-step-1-registry)
3. [Step 2: Plugin (Il Braccio)](#3-step-2-plugin)
4. [Step 3: LensAdapter (Gli Occhi)](#4-step-3-lensadapter)
5. [Step 4: Leverage via FlashLoanService](#5-step-4-leverage-via-flashloanservice)
6. [Step 5: Deploy e Registrazione](#6-step-5-deploy-e-registrazione)
7. [Step 6: Test](#7-step-6-test)
8. [Checklist Finale](#8-checklist-finale)
9. [Esempio Concreto: Aave V3](#9-esempio-concreto-aave-v3)

---

## 1. Panoramica: Cosa Serve

Ogni integrazione richiede **3 contratti** (pattern "3 Musketeers") + integrazione con il **FlashLoanService** condiviso per leverage:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Registry      │     │     Plugin        │     │   LensAdapter    │
│   (La Mappa)     │     │   (Il Braccio)    │     │   (Gli Occhi)    │
│                  │     │                   │     │                  │
│ token → vault    │◄────│ deposit/withdraw  │     │ getTotalValue()  │
│ posizioni        │     │ borrow/repay      │────►│ getHealthFactor()│
│ sub-accounts     │     │ leverage ←─────┐ │     │ getPositionsAtRisk│
└─────────────────┘     └────────────────┼─┘     └─────────────────┘
                              │     ▲    │
                              ▼     │    │
                        ┌──────────────┐ │  ┌──────────────────┐
                        │  Protocollo   │ │  │ FlashLoanService  │
                        │   Esterno     │ └──│  (Condiviso)      │
                        │ (Aave, Comp.) │    │ Balancer 0% fee   │
                        └──────────────┘    └──────────────────┘
```

> **FlashLoanService** è un servizio **condiviso** già deployato. Non va ricreato per ogni plugin.
> Ogni plugin che vuole supportare leverage deve implementare `IFlashLoanCallback`
> e aggiungere la propria logica protocollo-specifica dentro il callback.

### Interfacce da implementare

| Contratto | Interfaccia | File di Riferimento |
|-----------|------------|---------------------|
| Plugin | `IProtocolAdapter` + `ILendingProtocol` + `IFlashLoanCallback` | `contracts/interfaces/IProtocolAdapter.sol`, `ILendingProtocol.sol`, `IFlashLoanCallback.sol` |
| LensAdapter | `ILensAdapter` | `contracts/interfaces/ILensAdapter.sol` |
| Registry | Nessuna (custom per protocollo) | `contracts/plugins/EulerRegistry.sol` come esempio |

### Regola d'Oro: Custody Model

```
ProxyGeneral è l'UNICO custode dei fondi.
Il Plugin NON deve MAI trattenere asset tra una transazione e l'altra.

DEPOSIT:   ProxyGeneral → Plugin → Protocollo Esterno
WITHDRAW:  Protocollo Esterno → Plugin → ProxyGeneral  ⚠️
BORROW:    Protocollo Esterno → Plugin → ProxyGeneral  ⚠️
REPAY:     ProxyGeneral → Plugin → Protocollo Esterno
```

---

## 2. Step 1: Registry

Il Registry mappa i token code (stringhe come `"WETH"`, `"USDC"`) agli indirizzi vault/pool del protocollo esterno.

### Template Base

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";

contract NuovoProtocolloRegistry is Ownable {
    
    // Mapping: token code → vault/pool address del protocollo
    mapping(string => address) private _vaults;
    mapping(address => string) private _vaultToToken;
    
    // Se il protocollo supporta posizioni multiple
    struct Position {
        uint256 positionId;
        address collateralVault;
        address borrowVault;
        uint256 initialCollateral;
        uint256 borrowedAmount;
        bool isActive;
    }
    
    Position[] private _positions;
    
    // ===== Gestione Vault =====
    
    function setVault(string memory tokenCode, address vault) external onlyOwner {
        require(vault != address(0), "Invalid vault");
        _vaults[tokenCode] = vault;
        _vaultToToken[vault] = tokenCode;
    }
    
    function getVault(string memory tokenCode) external view returns (address) {
        address vault = _vaults[tokenCode];
        require(vault != address(0), "Vault not configured");
        return vault;
    }
    
    function getTokenCode(address vault) external view returns (string memory) {
        return _vaultToToken[vault];
    }
    
    // ===== Gestione Posizioni (opzionale, per protocolli con leverage) =====
    
    function getActivePositionCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < _positions.length; i++) {
            if (_positions[i].isActive) count++;
        }
    }
    
    function getPosition(uint256 positionId) external view returns (Position memory) {
        require(positionId < _positions.length, "Invalid position");
        return _positions[positionId];
    }
    
    function getAllPositions() external view returns (Position[] memory) {
        return _positions;
    }
}
```

### Punti Chiave

- **Ownership**: Il Plugin deve essere owner del Registry (per `createPositionOnDemand`)
- **setVault** deve essere chiamato PRIMA di trasferire ownership
- Il Registry è l'unica fonte di verità per "quale vault corrisponde a WETH?"

---

## 3. Step 2: Plugin

Il Plugin esegue le operazioni sul protocollo esterno. Riceve chiamate da ProtocolManager (o direttamente dall'owner).

### Template Base

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/IProtocolAdapter.sol";

contract NuovoProtocolloPlugin is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    address public immutable beacon;
    bool public circuitBreakerActive;
    
    // ===== Modifiers =====
    
    modifier notCircuitBroken() {
        require(!circuitBreakerActive, "Circuit breaker active");
        _;
    }
    
    // ===== Constructor =====
    
    constructor(address _beacon) {
        require(_beacon != address(0), "Invalid beacon");
        beacon = _beacon;
    }
    
    // ===== Core Operations =====
    
    function deposit(string memory tokenCode, uint256 amount) 
        external onlyOwner notCircuitBroken nonReentrant 
        returns (bool) 
    {
        address vault = _getVault(tokenCode);
        address token = _resolveToken(tokenCode);
        
        // Approva il protocollo esterno
        IERC20(token).safeApprove(vault, amount);
        
        // TODO: Chiama la funzione deposit del protocollo esterno
        // Es: IPool(pool).supply(token, amount, address(this), 0);
        
        emit Deposited(tokenCode, amount);
        return true;
    }
    
    function withdraw(string memory tokenCode, uint256 amount) 
        external onlyOwner notCircuitBroken nonReentrant 
        returns (bool) 
    {
        address vault = _getVault(tokenCode);
        address token = _resolveToken(tokenCode);
        
        // TODO: Chiama la funzione withdraw del protocollo esterno
        // Es: IPool(pool).withdraw(token, amount, address(this));
        
        // ⚠️ CRITICO: Trasferisci a ProxyGeneral!
        address proxyGeneral = _getProxyGeneral();
        IERC20(token).safeTransfer(proxyGeneral, amount);
        
        emit Withdrawn(tokenCode, amount);
        return true;
    }
    
    function borrow(string memory tokenCode, uint256 amount) 
        external onlyOwner notCircuitBroken nonReentrant 
        returns (bool) 
    {
        address vault = _getVault(tokenCode);
        address token = _resolveToken(tokenCode);
        
        // TODO: Chiama la funzione borrow del protocollo esterno
        // Es: IPool(pool).borrow(token, amount, 2, 0, address(this));
        
        // ⚠️ CRITICO: Trasferisci borrowed tokens a ProxyGeneral!
        address proxyGeneral = _getProxyGeneral();
        IERC20(token).safeTransfer(proxyGeneral, amount);
        
        emit Borrowed(tokenCode, amount, 0);
        return true;
    }
    
    function repay(string memory tokenCode, uint256 amount) 
        external onlyOwner notCircuitBroken nonReentrant 
        returns (bool) 
    {
        address vault = _getVault(tokenCode);
        address token = _resolveToken(tokenCode);
        
        // Approva il protocollo esterno
        IERC20(token).safeApprove(vault, amount);
        
        // TODO: Chiama la funzione repay del protocollo esterno
        // Es: IPool(pool).repay(token, amount, 2, address(this));
        
        emit Repaid(tokenCode, amount, 0);
        return true;
    }
    
    // ===== Position Management =====
    
    function closePosition(uint256 positionId) 
        external onlyOwner notCircuitBroken nonReentrant 
        returns (uint256 wethReturned) 
    {
        // 1. Leggi posizione dal Registry
        // 2. Repay debito
        // 3. Withdraw collaterale
        // 4. Se collaterale != WETH, swap verso WETH
        // 5. Trasferisci WETH a ProxyGeneral
        // 6. Aggiorna posizione nel Registry
    }
    
    function getDebt(string memory tokenCode) external view returns (uint256) {
        address vault = _getVault(tokenCode);
        // TODO: Query debito dal protocollo esterno
        // Es: return IPool(pool).getDebt(address(this), token);
    }
    
    function getHealthFactor() external view returns (uint256) {
        // TODO: Query health factor dal protocollo esterno
        // Ritorna in scala 1e18 (1.0 = 1e18)
        // Se no debito: return type(uint256).max
    }
    
    function getBalance(string memory tokenCode) external view returns (uint256) {
        address vault = _getVault(tokenCode);
        // TODO: Query balance dal protocollo esterno
    }
    
    // ===== Leverage via FlashLoanService =====
    // (Vedi Step 4 per il template completo)
    
    // ===== Emergency =====
    
    function setCircuitBreaker(bool active) external onlyOwner {
        circuitBreakerActive = active;
        if (active) emit CircuitBreakerActivated(msg.sender);
    }
    
    function emergencyWithdrawAll(string[] memory tokenCodes) 
        external onlyOwner 
        returns (bool) 
    {
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            // Withdraw max balance di ogni token
            uint256 balance = this.getBalance(tokenCodes[i]);
            if (balance > 0) {
                this.withdraw(tokenCodes[i], balance);
            }
        }
        return true;
    }
    
    // ===== Internal: Risoluzione Indirizzi via Beacon =====
    
    function _resolveToken(string memory tokenCode) internal view returns (address) {
        // WETH è direttamente nel Beacon
        if (keccak256(bytes(tokenCode)) == keccak256(bytes("WETH"))) {
            return IBeacon(beacon).getImplementation("WETH");
        }
        // Tutti gli altri token via TokenManager
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        return ITokenManagerForModules(tokenManager).getTokenAddress(tokenCode);
    }
    
    function _getVault(string memory tokenCode) internal view returns (address) {
        address registry = IBeacon(beacon).getImplementation("NuovoProtocolloRegistry");
        return INuovoProtocolloRegistry(registry).getVault(tokenCode);
    }
    
    function _getProxyGeneral() internal view returns (address) {
        return IBeacon(beacon).getImplementation("ProxyGeneral");
    }
    
    // ===== Events =====
    
    event Deposited(string tokenCode, uint256 amount);
    event Withdrawn(string tokenCode, uint256 amount);
    event Borrowed(string tokenCode, uint256 amount, uint256 accountNumber);
    event Repaid(string tokenCode, uint256 amount, uint256 accountNumber);
    event CircuitBreakerActivated(address indexed triggeredBy);
}

// ===== Interfacce Minime Necessarie =====

interface IBeacon {
    function getImplementation(string memory name) external view returns (address);
}

interface ITokenManagerForModules {
    function getTokenAddress(string memory tokenCode) external view returns (address);
}

interface INuovoProtocolloRegistry {
    function getVault(string memory tokenCode) external view returns (address);
}
```

### Punti Chiave

| Aspetto | Regola |
|---------|--------|
| **Ownership** | Ogni funzione operativa è `onlyOwner` |
| **Reentrancy** | Usa `nonReentrant` su tutte le funzioni che muovono fondi |
| **Circuit Breaker** | Usa `notCircuitBroken` per pause d'emergenza |
| **Token resolution** | WETH via Beacon, altri via TokenManager |
| **Vault resolution** | Sempre via Registry (mai hardcoded) |
| **Custody** | `withdraw` e `borrow` DEVONO trasferire a ProxyGeneral |
| **Approve** | Usa `safeApprove` verso il protocollo esterno prima di deposit/repay |

---

## 4. Step 3: LensAdapter

Il LensAdapter è il componente read-only che fornisce dati a ValueCalculator e alla DApp.

### Template Base

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "../interfaces/ILensAdapter.sol";

contract NuovoProtocolloLensAdapter {
    
    address public immutable beacon;
    
    constructor(address _beacon) {
        require(_beacon != address(0), "Invalid beacon");
        beacon = _beacon;
    }
    
    // ===== Funzioni Critiche per ValueCalculator =====
    
    /// @notice Valore netto totale (collaterale - debito) in ETH
    /// @dev Chiamata da ValueCalculator per calcolo NAV del pool
    function getTotalValue() external view returns (uint256 netValueEth) {
        // Itera su tutte le posizioni attive
        // Per ogni posizione: collateral_eth - debt_eth
        // Usa Chainlink per conversione USD → ETH
    }
    
    /// @notice Health factor minimo tra tutte le posizioni
    function getHealthFactor() external view returns (uint256) {
        // Se nessun debito: return type(uint256).max
        // Altrimenti: min(healthFactor di ogni posizione)
    }
    
    /// @notice Breakdown dettagliato del valore
    function getValueBreakdown() external view returns (
        ILensAdapter.ValueBreakdown memory
    ) {
        // totalCollateralEth, totalDebtEth, netValueEth, availableToWithdrawEth
    }
    
    // ===== Funzioni per Risk Management =====
    
    /// @notice Posizioni a rischio sotto una soglia di health factor
    function getPositionsAtRisk(uint256 minHealthFactor) 
        external view 
        returns (ILensAdapter.PositionWithRisk[] memory) 
    {
        // Ritorna posizioni con healthFactor < minHealthFactor
        // Usato da LiquidityManager per auto-close
    }
    
    // ===== Funzioni per la DApp =====
    
    function getProtocolSummary() external view returns (
        ILensAdapter.ProtocolSummary memory
    ) {
        // Overview completo per la dashboard
    }
    
    function getPositionHealth(uint256 positionId) external view returns (
        ILensAdapter.HealthInfo memory
    ) {
        // Health dettagliato di una singola posizione
    }
    
    // ===== Internal =====
    
    function _getPlugin() internal view returns (address) {
        return IBeacon(beacon).getImplementation("NuovoProtocolloPlugin");
    }
    
    function _getRegistry() internal view returns (address) {
        return IBeacon(beacon).getImplementation("NuovoProtocolloRegistry");
    }
}
```

### Funzioni Obbligatorie per il Sistema

| Funzione | Chiamata da | Scopo |
|----------|------------|-------|
| `getTotalValue()` | ValueCalculator | Calcolo NAV del pool |
| `getHealthFactor()` | UI + monitoring | Safety check |
| `getPositionsAtRisk()` | LiquidityManager | Auto-close posizioni pericolose |
| `getValueBreakdown()` | UI | Dashboard dettaglio |
| `estimateWethFromCloseAll()` | LiquidityManager | Stima liquidity disponibile |

---

## 5. Step 4: Leverage via FlashLoanService

Ogni plugin di lending **deve** implementare il supporto leverage usando il `FlashLoanService` condiviso.

### Architettura Flash Loan Leverage

```
┌─────────────────────────────────────────────────────────────────┐
│         FlashLoanService (CONDIVISO, già deployato)              │
│                                                                  │
│  executeFlashLoan()   → Richiede flash loan a Balancer V2       │
│  receiveFlashLoan()   → Callback Balancer, inoltra al plugin    │
│  swap()               → Servizio swap via Uniswap V3            │
│  getExpectedOutput()  → Stima output swap                       │
│                                                                  │
│  Indirizzo Arbitrum: 0x638C0175a1883063F22fc2439C85364e4aC27b03 │
│  Bytecode: ~5.7 KB (23% del limite)                             │
│  Balancer Vault: 0xBA12222222228d8Ba445958a75a0704d566BF2C8     │
│  Fee: 0% (Balancer V2!)                                         │
└─────────────────────────────────────────────────────────────────┘
         ▲                              │
         │ executeFlashLoan()           │ onFlashLoanReceived()
         │                              ▼
┌─────────────────────────────────────────────────────────────────┐
│         Plugin (LOGICA SPECIFICA PER PROTOCOLLO)                │
│                                                                  │
│  Deve implementare IFlashLoanCallback:                          │
│    onFlashLoanReceived(tokens, amounts, fees, data)             │
│                                                                  │
│  Deve esporre:                                                  │
│    openLeverageAtomic(params)  → Apre posizione leverage        │
│    closeLeverageAtomic(params) → Chiude posizione leverage      │
└─────────────────────────────────────────────────────────────────┘
```

### Principio Fondamentale

| Responsabilità | Dove vive |
|---|---|
| Richiedere flash loan a Balancer | FlashLoanService (generico) |
| Ricevere callback da Balancer | FlashLoanService (generico) |
| Servizio swap (Uniswap V3) | FlashLoanService (generico) |
| Deposit/supply su protocollo | Plugin (specifico) |
| Borrow da protocollo | Plugin (specifico) |
| Repay debito su protocollo | Plugin (specifico) |
| Withdraw collaterale | Plugin (specifico) |
| Enable/disable collateral (se necessario) | Plugin (specifico) |

### Requisiti per il Plugin

1. **Implementare `IFlashLoanCallback`** — per ricevere il callback dal FlashLoanService
2. **Essere registrato nel Beacon** — FlashLoanService verifica via Beacon check
3. **Aggiornare `_isRegisteredPlugin` in FlashLoanService** — aggiungere il nome del plugin

### Template Leverage nel Plugin

```solidity
import "../interfaces/IFlashLoanCallback.sol";

// Interfaccia FlashLoanService (inline, non serve file separato)
interface IFlashLoanService {
    function executeFlashLoan(
        address[] calldata tokens, uint256[] calldata amounts, bytes calldata callbackData
    ) external;
    function swap(
        address tokenIn, address tokenOut, uint256 amountIn
    ) external returns (uint256);
    function getExpectedOutput(
        address tokenIn, address tokenOut, uint256 amountIn
    ) external view returns (uint256);
}

contract NuovoProtocolloPlugin is IFlashLoanCallback, Ownable, ReentrancyGuard {
    
    // ===== Stato Flash Loan =====
    
    enum FlashLoanOperation { OPEN, CLOSE }
    
    struct FlashLoanCallbackContext {
        FlashLoanOperation operation;
        address user;
        uint256 initialCollateral;   // Solo per OPEN
        uint256 maxSlippageBps;      // Solo per CLOSE
        string collateralTokenCode;
        string borrowTokenCode;
    }
    
    FlashLoanCallbackContext private _flashLoanContext;
    bool private _inFlashLoanCallback;
    
    // ===== Parametri Leverage =====
    
    struct OpenLeverageAtomicParams {
        string collateralToken;       // e.g., "WETH"
        string borrowToken;           // e.g., "USDC"
        uint256 collateralAmount;     // Importo collaterale iniziale
        uint256 targetLeverageX100;   // Target leverage × 100 (200 = 2x, 300 = 3x)
        uint256 minHealthFactor;      // Soglia sicurezza minima
        uint256 deadline;             // Block timestamp scadenza
    }
    
    struct CloseLeverageAtomicParams {
        string collateralToken;
        string borrowToken;
        uint256 maxSlippageBps;       // Slippage massimo in basis points (100 = 1%)
        uint256 deadline;
    }
    
    // ===== Open Leverage =====
    
    function openLeverageAtomic(
        OpenLeverageAtomicParams calldata params
    ) external onlyOwner notCircuitBroken nonReentrant returns (
        uint256 totalCollateral, uint256 totalDebt, uint256 healthFactor
    ) {
        // 1. Validazioni
        require(block.timestamp <= params.deadline, "Deadline expired");
        require(params.targetLeverageX100 >= 110 && params.targetLeverageX100 <= 500, "Invalid leverage");
        
        // 2. Risolvi token address
        address collateralToken = _resolveToken(params.collateralToken);
        address borrowToken = _resolveToken(params.borrowToken);
        
        // 3. Trasferisci collaterale iniziale dall'utente
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), params.collateralAmount);
        
        // 4. Calcola importo flash loan
        uint256 leverageMultiplier = params.targetLeverageX100 - 100;
        uint256 flashLoanAmount = _calculateFlashLoanAmount(
            collateralToken, borrowToken, params.collateralAmount, leverageMultiplier
        );
        
        // 5. Salva contesto per callback
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.OPEN,
            user: msg.sender,
            initialCollateral: params.collateralAmount,
            maxSlippageBps: 0,
            collateralTokenCode: params.collateralToken,
            borrowTokenCode: params.borrowToken
        });
        
        // 6. Esegui flash loan
        address flashLoanService = _getFlashLoanService();
        address[] memory tokens = new address[](1);
        tokens[0] = borrowToken;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashLoanAmount;
        
        _inFlashLoanCallback = true;
        IFlashLoanService(flashLoanService).executeFlashLoan(tokens, amounts, "");
        _inFlashLoanCallback = false;
        
        // 7. Verifica stato finale e health factor
        // TODO: Implementare query protocollo-specifica per:
        //       totalCollateral, totalDebt, healthFactor
        
        // 8. Pulizia
        delete _flashLoanContext;
        return (totalCollateral, totalDebt, healthFactor);
    }
    
    // ===== Close Leverage =====
    
    function closeLeverageAtomic(
        CloseLeverageAtomicParams calldata params
    ) external onlyOwnerOrLiquidityManager notCircuitBroken nonReentrant returns (uint256 collateralReturned) {
        require(block.timestamp <= params.deadline, "Deadline expired");
        
        address borrowToken = _resolveToken(params.borrowToken);
        
        // 1. Ottieni debito corrente
        // TODO: Query protocollo-specifica per debito corrente
        uint256 currentDebt = ...;
        require(currentDebt > 0, "No position to close");
        
        // 2. Salva contesto
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.CLOSE,
            user: msg.sender,
            initialCollateral: 0,
            maxSlippageBps: params.maxSlippageBps > 0 ? params.maxSlippageBps : 100,
            collateralTokenCode: params.collateralToken,
            borrowTokenCode: params.borrowToken
        });
        
        // 3. Flash loan = importo debito
        address flashLoanService = _getFlashLoanService();
        address[] memory tokens = new address[](1);
        tokens[0] = borrowToken;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = currentDebt;
        
        _inFlashLoanCallback = true;
        IFlashLoanService(flashLoanService).executeFlashLoan(tokens, amounts, "");
        _inFlashLoanCallback = false;
        
        // 4. Trasferisci collaterale rimanente all'utente
        address collateralToken = _resolveToken(params.collateralToken);
        collateralReturned = IERC20(collateralToken).balanceOf(address(this));
        if (collateralReturned > 0) {
            IERC20(collateralToken).safeTransfer(msg.sender, collateralReturned);
        }
        
        delete _flashLoanContext;
    }
    
    // ===== Flash Loan Callback =====
    
    function onFlashLoanReceived(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory /* callbackData */
    ) external override {
        // SICUREZZA: verifica caller
        address flashLoanService = _getFlashLoanService();
        require(msg.sender == flashLoanService, "Unauthorized callback");
        require(_inFlashLoanCallback, "Not in flash loan");
        
        FlashLoanCallbackContext memory ctx = _flashLoanContext;
        
        if (ctx.operation == FlashLoanOperation.OPEN) {
            _handleOpenLeverageCallback(tokens, amounts, feeAmounts, ctx, flashLoanService);
        } else {
            _handleCloseLeverageCallback(tokens, amounts, feeAmounts, ctx, flashLoanService);
        }
    }
    
    // ===== Callback Handlers (PROTOCOLLO-SPECIFICI) =====
    
    function _handleOpenLeverageCallback(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        FlashLoanCallbackContext memory ctx,
        address flashLoanService
    ) internal {
        address collateralToken = _resolveToken(ctx.collateralTokenCode);
        address borrowToken = address(tokens[0]);
        uint256 flashLoanAmount = amounts[0];
        uint256 feeAmount = feeAmounts[0];
        
        // Step 1: Swap borrow → collateral (USDC → WETH)
        IERC20(borrowToken).safeIncreaseAllowance(flashLoanService, flashLoanAmount);
        uint256 collateralFromSwap = IFlashLoanService(flashLoanService).swap(
            borrowToken, collateralToken, flashLoanAmount
        );
        
        // Step 2: Deposita tutto il collaterale nel protocollo
        uint256 totalCollateral = ctx.initialCollateral + collateralFromSwap;
        // TODO: Chiamare funzione deposit del protocollo esterno
        // Es. Aave: pool.supply(collateralToken, totalCollateral, address(this), 0)
        // Es. Compound: cToken.mint(totalCollateral)
        
        // Step 3: Borrow per ripagare flash loan
        uint256 borrowAmount = flashLoanAmount + feeAmount;
        // TODO: Chiamare funzione borrow del protocollo esterno
        // Es. Aave: pool.borrow(borrowToken, borrowAmount, 2, 0, address(this))
        // Es. Compound: cToken.borrow(borrowAmount)
        
        // Step 4: Trasferisci al FlashLoanService per ripagare Balancer
        IERC20(borrowToken).safeTransfer(flashLoanService, borrowAmount);
    }
    
    function _handleCloseLeverageCallback(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        FlashLoanCallbackContext memory ctx,
        address flashLoanService
    ) internal {
        address collateralToken = _resolveToken(ctx.collateralTokenCode);
        address borrowToken = address(tokens[0]);
        uint256 flashLoanAmount = amounts[0];
        uint256 feeAmount = feeAmounts[0];
        
        // Step 1: Ripaga debito
        // TODO: Chiamare funzione repay del protocollo esterno
        // Es. Aave: pool.repay(borrowToken, flashLoanAmount, 2, address(this))
        
        // Step 2: Ritira tutto il collaterale
        // TODO: Chiamare funzione withdraw del protocollo esterno
        // Es. Aave: pool.withdraw(collateralToken, max, address(this))
        
        // Step 3: Swap collaterale → borrow token per ripagare flash loan
        uint256 repayAmount = flashLoanAmount + feeAmount;
        uint256 collateralBalance = IERC20(collateralToken).balanceOf(address(this));
        IERC20(collateralToken).safeIncreaseAllowance(flashLoanService, collateralBalance);
        uint256 borrowReceived = IFlashLoanService(flashLoanService).swap(
            collateralToken, borrowToken, collateralBalance
        );
        require(borrowReceived >= repayAmount, "Slippage exceeded");
        
        // Step 4: Trasferisci al FlashLoanService per ripagare Balancer
        IERC20(borrowToken).safeTransfer(flashLoanService, repayAmount);
    }
    
    // ===== Helpers Flash Loan =====
    
    function _getFlashLoanService() internal view returns (address) {
        address service = IBeacon(beacon).getImplementation("FlashLoanService");
        require(service != address(0), "FlashLoanService not found");
        return service;
    }
    
    function _calculateFlashLoanAmount(
        address collateralToken,
        address borrowToken,
        uint256 collateralAmount,
        uint256 leverageMultiplier
    ) internal view returns (uint256) {
        address flashLoanService = _getFlashLoanService();
        uint256 collateralValueInBorrow = IFlashLoanService(flashLoanService)
            .getExpectedOutput(collateralToken, borrowToken, collateralAmount);
        return (collateralValueInBorrow * leverageMultiplier) / 100;
    }
}
```

### Flusso Open Leverage (generico)

```
1. Plugin.openLeverageAtomic({WETH, USDC, 1 ETH, 200, 1.3e18})
   ↓
2. Plugin → FlashLoanService.executeFlashLoan([USDC], [~$3000])
   ↓
3. FlashLoanService → Balancer.flashLoan(USDC, $3000)
   ↓
4. Balancer → FlashLoanService.receiveFlashLoan()
   ↓
5. FlashLoanService → Plugin.onFlashLoanReceived([USDC], [$3000])
   ↓
6. Plugin callback:
   ├── FlashLoanService.swap(USDC → WETH)  →  ~1 WETH
   ├── Protocollo.deposit(2 WETH)           →  collaterale
   ├── Protocollo.borrow($3000 USDC)        →  debito
   └── IERC20(USDC).transfer(FlashLoanService, $3000)
   ↓
7. FlashLoanService → Balancer.transfer($3000 USDC)  ← ripaga flash loan
   ↓
8. Risultato: 2 WETH collaterale, $3000 debito, ~1.5 HF
```

### ⚠️ Punti Chiave per Leverage

| Punto | Dettaglio |
|---|---|
| **FlashLoanService è condiviso** | NON creare un nuovo servizio per ogni plugin |
| **Fee Balancer = 0%** | Flash loan gratuiti |
| **IFlashLoanCallback** | Il plugin DEVE implementare `onFlashLoanReceived()` |
| **Trasferimento token** | I token flash loan sono GIA' nel plugin quando parte il callback |
| **Ripagamento** | Il plugin deve `safeTransfer(flashLoanService, amount+fee)` alla fine del callback |
| **Registrazione Beacon** | Il plugin DEVE essere registrato nel Beacon per autorizzazione |
| **Swap via service** | Usare `FlashLoanService.swap()` per gli swap, NON implementare swap nel plugin |
| **Bytecode** | La logica leverage aggiunge ~6-7 KB. Tenere sotto 24,576 bytes totali |

### FlashLoanService: Registrazione Plugin

Il FlashLoanService verifica i plugin autorizzati **dinamicamente** tramite `_isRegisteredPlugin()` che itera su tutti i moduli registrati nel Beacon. **Non serve aggiornare o rideployare FlashLoanService quando si aggiunge un nuovo plugin** — basta registrarlo nel Beacon.

Nel file `contracts/services/FlashLoanService.sol`:

```solidity
function _isRegisteredPlugin(address plugin) internal view returns (bool) {
    // Dinamico: legge TUTTI i moduli dal Beacon
    string[] memory moduleNames = beacon.getRegisteredModules();
    
    for (uint256 i = 0; i < moduleNames.length; i++) {
        try beacon.getImplementation(moduleNames[i]) returns (address registered) {
            if (registered == plugin) return true;
        } catch {}
    }
    return false;
}
```

> ✅ Il Beacon è la **single source of truth**. Registra il plugin nel Beacon e FlashLoanService lo riconosce automaticamente.

---

## 6. Step 5: Deploy e Registrazione

### Script di Deploy

```typescript
import { ethers } from "hardhat";

async function main() {
    const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
    
    // 1. Deploy Registry
    const Registry = await ethers.getContractFactory("NuovoProtocolloRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    console.log(`Registry: ${await registry.getAddress()}`);
    
    // 2. Configura vault NEL Registry (prima di trasferire ownership!)
    await registry.setVault("WETH", "0x...vault_weth");
    await registry.setVault("USDC", "0x...vault_usdc");
    
    // 3. Deploy Plugin
    const Plugin = await ethers.getContractFactory("NuovoProtocolloPlugin");
    const plugin = await Plugin.deploy(BEACON);
    await plugin.waitForDeployment();
    console.log(`Plugin: ${await plugin.getAddress()}`);
    
    // 4. Trasferisci ownership del Registry al Plugin
    await registry.transferOwnership(await plugin.getAddress());
    
    // 5. Deploy LensAdapter
    const Adapter = await ethers.getContractFactory("NuovoProtocolloLensAdapter");
    const adapter = await Adapter.deploy(BEACON);
    await adapter.waitForDeployment();
    console.log(`LensAdapter: ${await adapter.getAddress()}`);
    
    // 6. Registra nel Beacon
    const beacon = await ethers.getContractAt("Beacon", BEACON);
    await beacon.updateImplementation("NuovoProtocolloRegistry", await registry.getAddress());
    await beacon.updateImplementation("NuovoProtocolloPlugin", await plugin.getAddress());
    await beacon.updateImplementation("NuovoProtocolloLensAdapter", await adapter.getAddress());
    
    // 7. Autorizza in ProxyGeneral
    const PROXY = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
    const proxy = await ethers.getContractAt("ProxyGeneral", PROXY);
    await proxy.authorizeModule(await plugin.getAddress(), "NuovoProtocolloPlugin");
    
    console.log("✅ Deploy completo!");
}
```

### Ordine CRITICO delle Operazioni

```
1. Deploy Registry
2. setVault() per ogni token supportato        ← PRIMA di transferOwnership!
3. Deploy Plugin
4. registry.transferOwnership(pluginAddress)    ← Il Plugin diventa owner del Registry
5. Deploy LensAdapter
6. Beacon.updateImplementation() × 3           ← Registra tutti e 3
7. ProxyGeneral.authorizeModule(plugin)         ← Autorizza il Plugin a operare
```

> ⚠️ Se trasferisci ownership del Registry prima di configurare i vault,
> non potrai più chiamare `setVault()` perché non sei più l'owner!

---

## 7. Step 6: Test

### Struttura Raccomandata

```
test/integration/
    NuovoProtocollo.test.ts          ← Unit test con mock (essenziale)
    NuovoProtocollo.fork.test.ts     ← Fork test su mainnet (essenziale)
    NuovoProtocollo.leverage.test.ts ← Test leverage via flash loan (essenziale)
    NuovoProtocollo.e2e.test.ts      ← E2E con fondi reali (opzionale)
```

### Template Test Base

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";

describe("NuovoProtocolloPlugin", function () {
    let plugin, registry, lensAdapter, mockBeacon;
    let owner, wethContract;

    before(async function () {
        [owner] = await ethers.getSigners();

        // Deploy MockBeacon
        const MockBeacon = await ethers.getContractFactory("MockBeacon");
        mockBeacon = await MockBeacon.deploy();

        // Deploy 3 Musketeers
        const Registry = await ethers.getContractFactory("NuovoProtocolloRegistry");
        registry = await Registry.deploy();

        // Configura vault PRIMA di trasferire ownership
        await registry.setVault("WETH", VAULT_ADDRESSES.WETH);
        await registry.setVault("USDC", VAULT_ADDRESSES.USDC);

        const Plugin = await ethers.getContractFactory("NuovoProtocolloPlugin");
        plugin = await Plugin.deploy(await mockBeacon.getAddress());

        // Trasferisci ownership Registry → Plugin
        await registry.transferOwnership(await plugin.getAddress());

        const Adapter = await ethers.getContractFactory("NuovoProtocolloLensAdapter");
        lensAdapter = await Adapter.deploy(await mockBeacon.getAddress());

        // Registra nel MockBeacon
        await mockBeacon.setImplementation("NuovoProtocolloRegistry", await registry.getAddress());
        await mockBeacon.setImplementation("NuovoProtocolloPlugin", await plugin.getAddress());
        await mockBeacon.setImplementation("NuovoProtocolloLensAdapter", await lensAdapter.getAddress());
        await mockBeacon.setImplementation("WETH", WETH_ADDRESS);

        // MockTokenManager per token non-WETH
        const MockTM = await ethers.getContractFactory("MockTokenManager");
        const mockTM = await MockTM.deploy();
        await mockTM.setTokenAddress("USDC", USDC_ADDRESS);
        await mockBeacon.setImplementation("TokenManager", await mockTM.getAddress());

        // MockProxyGeneral
        const MockProxy = await ethers.getContractFactory("MockProxyGeneral");
        const mockProxy = await MockProxy.deploy();
        await mockBeacon.setImplementation("ProxyGeneral", await mockProxy.getAddress());
    });

    describe("Deposit", function () {
        it("Should deposit WETH successfully", async function () {
            // Trasferisci WETH al plugin (simula ProxyGeneral)
            await wethContract.transfer(await plugin.getAddress(), amount);

            await plugin.deposit("WETH", amount);

            // Verifica che il protocollo abbia ricevuto il deposito
            const balance = await plugin.getBalance("WETH");
            expect(balance).to.be.gt(0);
        });
    });

    describe("Withdraw", function () {
        it("Should withdraw to ProxyGeneral", async function () {
            const proxyBefore = await wethContract.balanceOf(proxyAddress);
            
            await plugin.withdraw("WETH", amount);
            
            const proxyAfter = await wethContract.balanceOf(proxyAddress);
            // ⚠️ Verifica che i fondi siano in ProxyGeneral, NON nel plugin
            expect(proxyAfter - proxyBefore).to.be.gte(amount);
        });
    });

    describe("Access Control", function () {
        it("Should reject non-owner calls", async function () {
            const [, attacker] = await ethers.getSigners();
            await expect(
                plugin.connect(attacker).deposit("WETH", 100)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Circuit Breaker", function () {
        it("Should block operations when active", async function () {
            await plugin.setCircuitBreaker(true);
            await expect(plugin.deposit("WETH", 100))
                .to.be.revertedWith("Circuit breaker active");
            await plugin.setCircuitBreaker(false);
        });
    });
});
```

### Cosa Testare (Checklist)

**Operazioni Base:**
- [ ] Deposit trasferisce fondi al protocollo esterno
- [ ] Withdraw riporta fondi a ProxyGeneral (NON al caller)
- [ ] Borrow riporta token prestati a ProxyGeneral
- [ ] Repay riduce il debito nel protocollo
- [ ] getBalance ritorna il saldo corretto
- [ ] getDebt ritorna il debito corretto
- [ ] getHealthFactor ritorna `type(uint256).max` senza debito
- [ ] Circuit breaker blocca tutte le operazioni
- [ ] Solo l'owner può chiamare le funzioni
- [ ] LensAdapter.getTotalValue() corrisponde a (collateral - debt)
- [ ] emergencyWithdrawAll recupera tutti i fondi

**Leverage via FlashLoanService:**
- [ ] openLeverageAtomic deposita collaterale amplificato
- [ ] openLeverageAtomic genera debito corretto
- [ ] openLeverageAtomic rispetta minHealthFactor
- [ ] openLeverageAtomic rifiuta leverage > 5x e < 1.1x
- [ ] openLeverageAtomic rifiuta deadline scaduto
- [ ] closeLeverageAtomic ripaga debito completamente
- [ ] closeLeverageAtomic restituisce collaterale all'utente
- [ ] closeLeverageAtomic rifiuta se non c'è posizione
- [ ] onFlashLoanReceived rifiuta caller non autorizzato
- [ ] Circuit breaker blocca operazioni leverage
- [ ] Plugin non trattiene token dopo operazione leverage

---

## 8. Checklist Finale

Prima del deploy su mainnet, verifica ogni punto:

### Contratti

- [ ] Registry: vault configurati per tutti i token supportati
- [ ] Plugin: implementa `IProtocolAdapter` + `ILendingProtocol` + `IFlashLoanCallback`
- [ ] Plugin: `withdraw` e `borrow` trasferiscono a ProxyGeneral
- [ ] Plugin: non trattiene fondi tra transazioni
- [ ] Plugin: tutte le funzioni hanno `onlyOwner` + `nonReentrant`
- [ ] Plugin: circuit breaker funzionante
- [ ] Plugin: `openLeverageAtomic()` e `closeLeverageAtomic()` funzionanti
- [ ] Plugin: `onFlashLoanReceived()` verifica `msg.sender == FlashLoanService`
- [ ] LensAdapter: `getTotalValue()` ritorna valore in ETH
- [ ] LensAdapter: `getPositionsAtRisk()` identifica posizioni pericolose
- [ ] Compilazione senza errori/warning

### Deploy

- [ ] Registry: vault configurati PRIMA di transferOwnership
- [ ] Registry: ownership trasferita al Plugin
- [ ] Beacon: tutti e 3 i contratti registrati
- [ ] ProxyGeneral: Plugin autorizzato
- [ ] FlashLoanService: plugin registrato nel Beacon (rilevamento automatico)
- [ ] Bytecode < 24,576 bytes (limite EVM)

### Test

- [ ] Unit test: tutte le operazioni base passano
- [ ] Fork test: operazioni reali su Arbitrum fork
- [ ] Leverage test: open/close via FlashLoanService su Arbitrum fork
- [ ] Access control: non-owner viene rifiutato
- [ ] Edge case: health factor senza debito = max
- [ ] Callback security: onFlashLoanReceived rifiuta caller non autorizzato

---

## 9. Esempio Concreto: Aave V3

Per capire come applicare il template, ecco come sarebbe un'integrazione Aave V3 su Arbitrum:

### Indirizzi Aave V3 Arbitrum

```solidity
// Pool (entry point per deposit/borrow/withdraw/repay)
address constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;

// aToken (receipt token per depositi)
address constant aWETH = 0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8;
address constant aUSDC = 0x625E7708f30cA75bfd92586e17077590C60eb4cD;

// Variable debt token
address constant variableDebtUSDC = 0xFCCf3cAbbe80101232d343252614b6A3eE81C989;
```

### Mapping alle Funzioni del Template

| Operazione | Chiamata Aave V3 |
|-----------|-------------------|
| `deposit` | `IPool(AAVE_POOL).supply(token, amount, address(this), 0)` |
| `withdraw` | `IPool(AAVE_POOL).withdraw(token, amount, proxyGeneral)` |
| `borrow` | `IPool(AAVE_POOL).borrow(token, amount, 2, 0, address(this))` |
| `repay` | `IPool(AAVE_POOL).repay(token, amount, 2, address(this))` |
| `getBalance` | `IERC20(aToken).balanceOf(address(this))` |
| `getDebt` | `IERC20(debtToken).balanceOf(address(this))` |
| `getHealthFactor` | `IPool(AAVE_POOL).getUserAccountData(address(this)).healthFactor` |

### Note Specifiche Aave

- Aave ha un **Pool unico** (non vault separati per token) → il Registry mappa token → aToken
- `withdraw` di Aave può inviare direttamente a un recipient (il 3° parametro) → semplifica il flusso
- Health factor è nativo in Aave → non serve calcolarlo manualmente
- `getUserAccountData()` ritorna tutto in un colpo: collateral, debt, available borrow, LTV, health factor

### Leverage Aave V3 vs Euler V2

**Aave V3** è significativamente più semplice di Euler V2 per il leverage:

| Aspetto | Euler V2 | Aave V3 |
|---------|----------|---------|  
| Architettura | Vault per token (EVC) | Pool unico condiviso |
| Sub-accounts | Sì (fino a 256 via EVC) | No (1 account per address) |
| Collateral enable | Serve EVC batch | Automatico al primo supply |
| Flash Loans | Via Balancer (FlashLoanService) | Via Balancer (FlashLoanService) |
| Health Factor | Calcolato via AccountLens | Nativo `getUserAccountData()` |
| Batch atomico | Obbligatorio (EVC.batch) | Non necessario (sequenziale) |
| Open leverage callback | 4-step EVC batch | 3 chiamate sequenziali (supply, borrow, transfer) |
| Close leverage callback | 4-step EVC batch + cleanup | 4 chiamate sequenziali (repay, withdraw, swap, transfer) |

### Bytecode Comparison

| Contratto | Bytes | % Limite | Margine |
|---|---|---|---|
| EulerV2Plugin (con leverage + EVC batch) | 22,538 | 91.7% | 2,038 |
| AaveV3Plugin (con leverage) | 17,183 | 69.9% | 7,393 |
| FlashLoanService (condiviso) | 5,766 | 23.5% | 18,810 |

---

## Riepilogo Architettura

```
                    ┌──────────────────────────────────────────┐
                    │               BEACON                      │
                    │  "NuovoProtocolloRegistry"  → 0x...      │
                    │  "NuovoProtocolloPlugin"    → 0x...      │
                    │  "NuovoProtocolloLensAdapter"→ 0x...     │
                    │  "FlashLoanService"         → 0x638...   │
                    │  "WETH"                     → 0x82a...   │
                    │  "TokenManager"             → 0xc4c...   │
                    │  "ProxyGeneral"             → 0x875...   │
                    └──────────────────────────────────────────┘
                           │              │              │
                    ┌──────┘       ┌──────┘       ┌──────┘
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────────┐
              │ Registry  │  │  Plugin   │  │ LensAdapter  │
              │           │  │           │  │              │
              │ Mappa     │  │ Esegue    │  │ Legge        │
              │ token→vault│ │ operazioni│  │ stato        │
              │           │  │ su proto. │  │ posizioni    │
              └──────────┘  │ esterno + │  └──────────────┘
                    ▲        │ LEVERAGE  │         │
                    │        └─────┬────┘          │
                    │              │                │
                    └──────────────┘                │
                    read vault addr    ┌────────────┘
                                       │
              ┌─────────────────┐      ▼
              │FlashLoanService │  ┌──────────────┐
              │  (Condiviso)    │  │ValueCalculator│
              │  Balancer 0%    │  │ getTotalValue│
              │  Swap service   │  └──────────────┘
              └─────────────────┘
```
