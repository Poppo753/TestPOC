# 🔧 Piano di Integrazione Euler V2 - Parte 2

**Continuazione di:** 08_Integration_Plan.md

---

## Dettaglio EulerV2Plugin (Continua)

### Funzioni Helper Interne

```solidity
// ==================== INTERNAL HELPERS ====================

function _resolveToken(string memory tokenCode) internal view returns (address) {
    address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
    return ITokenManagerForModules(tokenManager).getTokenAddress(tokenCode);
}

function _getProxyGeneral() internal view returns (address) {
    return IBeacon(beacon).getImplementation("ProxyGeneral");
}

function _deriveSubAccount(uint8 subAccountId) internal view returns (address) {
    // Euler sub-account derivation: address XOR subAccountId
    return address(uint160(address(this)) ^ uint160(subAccountId));
}

function _buildOpenLeverageBatch(
    OpenLeverageParams calldata params,
    uint8 subAccountId,
    address subAccount
) internal view returns (IEVC.BatchItem[] memory items) {
    address collateralVault = tokenVaults[params.collateralTokenCode];
    address borrowVault = tokenVaults[params.borrowTokenCode];
    
    items = new IEVC.BatchItem[](7);
    
    // 1. Depositare collaterale iniziale
    items[0] = IEVC.BatchItem({
        targetContract: collateralVault,
        onBehalfOfAccount: subAccount,
        value: 0,
        data: abi.encodeCall(IEVault.deposit, (params.collateralAmount, subAccount))
    });
    
    // 2. Abilitare collateral vault come collaterale
    items[1] = IEVC.BatchItem({
        targetContract: address(evc),
        onBehalfOfAccount: address(0),
        value: 0,
        data: abi.encodeCall(IEVC.enableCollateral, (subAccount, collateralVault))
    });
    
    // 3. Abilitare borrow vault come controller
    items[2] = IEVC.BatchItem({
        targetContract: address(evc),
        onBehalfOfAccount: address(0),
        value: 0,
        data: abi.encodeCall(IEVC.enableController, (subAccount, borrowVault))
    });
    
    // 4. Borrow → inviare a Swapper
    items[3] = IEVC.BatchItem({
        targetContract: borrowVault,
        onBehalfOfAccount: subAccount,
        value: 0,
        data: abi.encodeCall(IEVault.borrow, (params.borrowAmount, SWAPPER))
    });
    
    // 5. Eseguire swap via Swapper
    items[4] = IEVC.BatchItem({
        targetContract: SWAPPER,
        onBehalfOfAccount: subAccount,
        value: 0,
        data: params.swapData
    });
    
    // 6. Depositare collaterale swappato
    items[5] = IEVC.BatchItem({
        targetContract: collateralVault,
        onBehalfOfAccount: subAccount,
        value: 0,
        data: abi.encodeCall(IEVault.deposit, (type(uint256).max, subAccount))
    });
    
    // 7. Verificare con SwapVerifier
    items[6] = IEVC.BatchItem({
        targetContract: SWAP_VERIFIER,
        onBehalfOfAccount: subAccount,
        value: 0,
        data: abi.encodeCall(
            ISwapVerifier.verifyAmountMinAndSkim,
            (collateralVault, subAccount, params.minCollateralReceived, params.deadline)
        )
    });
}

function _buildCloseLeverageBatch(
    LeveragePosition storage pos
) internal view returns (IEVC.BatchItem[] memory items) {
    address subAccount = _deriveSubAccount(pos.subAccountId);
    
    items = new IEVC.BatchItem[](4);
    
    // 1. Prelevare collaterale → Swapper
    items[0] = IEVC.BatchItem({
        targetContract: pos.collateralVault,
        onBehalfOfAccount: subAccount,
        value: 0,
        data: abi.encodeCall(IEVault.withdraw, (type(uint256).max, SWAPPER, subAccount))
    });
    
    // 2. Swap collaterale → borrow asset (target debt mode)
    items[1] = IEVC.BatchItem({
        targetContract: SWAPPER,
        onBehalfOfAccount: subAccount,
        value: 0,
        data: _buildSwapToRepayData(pos)
    });
    
    // 3. Ripagare debito
    items[2] = IEVC.BatchItem({
        targetContract: pos.borrowVault,
        onBehalfOfAccount: subAccount,
        value: 0,
        data: abi.encodeCall(IEVault.repay, (type(uint256).max, subAccount))
    });
    
    // 4. Verificare debito = 0
    items[3] = IEVC.BatchItem({
        targetContract: SWAP_VERIFIER,
        onBehalfOfAccount: subAccount,
        value: 0,
        data: abi.encodeCall(
            ISwapVerifier.verifyDebtMax,
            (pos.borrowVault, subAccount, 0, block.timestamp + 300)
        )
    });
}
```

### View Functions

```solidity
// ==================== VIEW FUNCTIONS ====================

function getBalance(string memory tokenCode) 
    external 
    view 
    override 
    returns (uint256) 
{
    address vault = tokenVaults[tokenCode];
    if (vault == address(0)) return 0;
    
    // Shares nel vault convertite in assets
    uint256 shares = IEVault(vault).balanceOf(address(this));
    return IEVault(vault).convertToAssets(shares);
}

function getTotalValue() 
    external 
    view 
    override 
    returns (uint256) 
{
    // Delega a EulerLensAdapter per calcolo completo
    address lensAdapter = IBeacon(beacon).getImplementation("EulerLensAdapter");
    return IEulerLensAdapter(lensAdapter).getTotalEulerValue();
}

function getPositionHealth(uint256 positionId) 
    external 
    view 
    returns (uint256 healthFactor) 
{
    LeveragePosition storage pos = positions[positionId];
    require(pos.isActive, "Position not active");
    
    address lensAdapter = IBeacon(beacon).getImplementation("EulerLensAdapter");
    address subAccount = _deriveSubAccount(pos.subAccountId);
    
    return IEulerLensAdapter(lensAdapter).getSubAccountHealth(subAccount, pos.borrowVault);
}

function getAllPositions() 
    external 
    view 
    returns (LeveragePosition[] memory) 
{
    uint256 count = 0;
    for (uint256 i = 0; i < nextPositionId; i++) {
        if (positions[i].isActive) count++;
    }
    
    LeveragePosition[] memory activePositions = new LeveragePosition[](count);
    uint256 idx = 0;
    for (uint256 i = 0; i < nextPositionId; i++) {
        if (positions[i].isActive) {
            activePositions[idx++] = positions[i];
        }
    }
    
    return activePositions;
}

function getProtocolInfo() 
    external 
    pure 
    override 
    returns (string memory name, string memory version, bool isActive) 
{
    return ("EulerV2", "1.0.0", true);
}
```

### Admin Functions

```solidity
// ==================== ADMIN FUNCTIONS ====================

function setTokenVault(string memory tokenCode, address vault) 
    external 
    onlyOwner 
{
    require(vault != address(0), "Invalid vault");
    tokenVaults[tokenCode] = vault;
    emit TokenVaultSet(tokenCode, vault);
}

function setCircuitBreaker(bool tripped) 
    external 
    onlyOwner 
{
    circuitBreakerTripped = tripped;
    emit CircuitBreakerSet(tripped);
}

function emergencyWithdrawAll(string[] memory tokenCodes) 
    external 
    override 
    onlyOwner 
    returns (bool) 
{
    address proxyGeneral = _getProxyGeneral();
    
    for (uint256 i = 0; i < tokenCodes.length; i++) {
        address vault = tokenVaults[tokenCodes[i]];
        if (vault == address(0)) continue;
        
        uint256 shares = IEVault(vault).balanceOf(address(this));
        if (shares > 0) {
            uint256 withdrawn = IEVault(vault).redeem(shares, proxyGeneral, address(this));
            emit EmergencyWithdraw(tokenCodes[i], withdrawn);
        }
    }
    
    return true;
}

// ==================== MODIFIERS ====================

modifier onlyProtocolManager() {
    address protocolManager = IBeacon(beacon).getImplementation("ProtocolManager");
    require(msg.sender == protocolManager, "Only ProtocolManager");
    _;
}

modifier notCircuitBroken() {
    require(!circuitBreakerTripped, "Circuit breaker tripped");
    _;
}
```

---

## Dettaglio EulerLensAdapter

### Storage e Constructor

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IOracleAdapter.sol";
import "../interfaces/IBeacon.sol";

interface IAccountLens {
    struct AccountInfo {
        // ... struct completa
    }
    struct AccountLiquidityInfo {
        int256 timeToLiquidation;
        uint256 liabilityValueLiquidation;
        uint256 collateralValueLiquidation;
        uint256 collateralValueRaw;
        // ...
    }
    
    function getAccountInfo(address account, address vault) 
        external view returns (AccountInfo memory);
    function getTimeToLiquidation(address account, address vault) 
        external view returns (int256);
}

interface IUtilsLens {
    function getAPYs(address vault) external view returns (uint256 borrowAPY, uint256 supplyAPY);
}

contract EulerLensAdapter {
    
    // ==================== IMMUTABLES ====================
    address public immutable beacon;
    
    // Lens Addresses (Arbitrum)
    address constant ACCOUNT_LENS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
    address constant VAULT_LENS = 0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380;
    address constant UTILS_LENS = 0xDAf44060DCe217Fd603908A49fcaa1FA900304BE;
    
    // TTL Constants
    int256 constant TTL_LIQUIDATION = -1;
    int256 constant TTL_INFINITY = type(int256).max;
    int256 constant TTL_MORE_THAN_ONE_YEAR = type(int256).max - 1;
    
    constructor(address _beacon) {
        beacon = _beacon;
    }
}
```

### Funzioni Health Monitoring

```solidity
// ==================== HEALTH MONITORING ====================

function getHealthFactor(address account) 
    external 
    view 
    returns (uint256) 
{
    // Query EulerV2Plugin per il vault controller principale
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    
    // Per depositi semplici (sub-account 0), usa il vault principale
    // Per questo esempio, assumiamo che ci sia un vault "primario"
    address controllerVault = _getPrimaryControllerVault(plugin);
    
    return _calculateHealthFactor(account, controllerVault);
}

function getSubAccountHealth(address subAccount, address controllerVault) 
    external 
    view 
    returns (uint256 healthFactor) 
{
    return _calculateHealthFactor(subAccount, controllerVault);
}

function _calculateHealthFactor(address account, address vault) 
    internal 
    view 
    returns (uint256) 
{
    IAccountLens.AccountInfo memory info = IAccountLens(ACCOUNT_LENS).getAccountInfo(account, vault);
    IAccountLens.AccountLiquidityInfo memory liq = info.vaultAccountInfo.liquidityInfo;
    
    if (liq.liabilityValueLiquidation == 0) {
        return type(uint256).max; // Nessun debito = infinitamente sicuro
    }
    
    // Health Factor = collateral / liability (in 1e18)
    return (liq.collateralValueLiquidation * 1e18) / liq.liabilityValueLiquidation;
}

function getTimeToLiquidation(address account, address vault) 
    external 
    view 
    returns (int256 ttl, string memory status) 
{
    ttl = IAccountLens(ACCOUNT_LENS).getTimeToLiquidation(account, vault);
    
    if (ttl == TTL_LIQUIDATION) {
        status = "LIQUIDATABLE";
    } else if (ttl == TTL_INFINITY) {
        status = "SAFE_NO_DEBT";
    } else if (ttl == TTL_MORE_THAN_ONE_YEAR) {
        status = "SAFE_OVER_1_YEAR";
    } else if (ttl > 0) {
        status = "AT_RISK";
    } else {
        status = "ERROR";
    }
}
```

### Funzioni Valore

```solidity
// ==================== VALUE FUNCTIONS ====================

function getTotalEulerValue() 
    external 
    view 
    returns (uint256 netValue) 
{
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    
    // Calcola: Σ(collateral values) - Σ(debt values)
    (uint256 totalCollateral, uint256 totalDebt) = _calculateTotalValues(plugin);
    
    // Net value (può essere 0 se debt > collateral, ma non negativo)
    netValue = totalCollateral > totalDebt ? totalCollateral - totalDebt : 0;
}

function getEulerPositionValues() 
    external 
    view 
    returns (uint256 totalCollateral, uint256 totalDebt, uint256 netValue) 
{
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    (totalCollateral, totalDebt) = _calculateTotalValues(plugin);
    netValue = totalCollateral > totalDebt ? totalCollateral - totalDebt : 0;
}

function _calculateTotalValues(address plugin) 
    internal 
    view 
    returns (uint256 totalCollateral, uint256 totalDebt) 
{
    // Query tutti i vault configurati nel plugin
    IEulerV2Plugin eulerPlugin = IEulerV2Plugin(plugin);
    string[] memory tokenCodes = _getConfiguredTokenCodes(plugin);
    
    for (uint256 i = 0; i < tokenCodes.length; i++) {
        address vault = eulerPlugin.tokenVaults(tokenCodes[i]);
        if (vault == address(0)) continue;
        
        // Collateral: shares → assets
        uint256 shares = IEVault(vault).balanceOf(plugin);
        uint256 assets = IEVault(vault).convertToAssets(shares);
        
        // Converti in ETH value usando prezzo
        uint256 ethValue = _convertToEthValue(tokenCodes[i], assets);
        totalCollateral += ethValue;
        
        // Debt
        uint256 debt = IEVault(vault).debtOf(plugin);
        uint256 debtEthValue = _convertToEthValue(tokenCodes[i], debt);
        totalDebt += debtEthValue;
    }
    
    // Aggiungi anche posizioni leverage (sub-accounts)
    (uint256 leverageCollateral, uint256 leverageDebt) = _calculateLeverageValues(plugin);
    totalCollateral += leverageCollateral;
    totalDebt += leverageDebt;
}

function _convertToEthValue(string memory tokenCode, uint256 amount) 
    internal 
    view 
    returns (uint256 ethValue) 
{
    if (amount == 0) return 0;
    
    // Usa TokenManager per ottenere prezzo in ETH
    address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
    (uint256 price, , bool isStale) = ITokenManagerForModules(tokenManager).getTokenPrice(tokenCode);
    
    if (isStale) return 0;
    
    // Converti usando decimali corretti
    uint256 decimals = ITokenManagerForModules(tokenManager).getTokenDecimals(tokenCode);
    ethValue = (amount * price) / (10 ** decimals);
}
```

### Funzioni per Auto-Close (LiquidityManager)

```solidity
// ==================== AUTO-CLOSE SUPPORT ====================

function getEulerPositionsAtRisk(uint256 minHealthFactor) 
    external 
    view 
    returns (uint256[] memory positionIds) 
{
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    IEulerV2Plugin eulerPlugin = IEulerV2Plugin(plugin);
    
    // Prima conta quante posizioni sono a rischio
    uint256 count = 0;
    uint256 totalPositions = eulerPlugin.nextPositionId();
    
    for (uint256 i = 0; i < totalPositions; i++) {
        if (_isPositionAtRisk(plugin, i, minHealthFactor)) {
            count++;
        }
    }
    
    // Poi popola l'array
    positionIds = new uint256[](count);
    uint256 idx = 0;
    
    for (uint256 i = 0; i < totalPositions; i++) {
        if (_isPositionAtRisk(plugin, i, minHealthFactor)) {
            positionIds[idx++] = i;
        }
    }
}

function _isPositionAtRisk(address plugin, uint256 positionId, uint256 minHealthFactor) 
    internal 
    view 
    returns (bool) 
{
    IEulerV2Plugin.LeveragePosition memory pos = IEulerV2Plugin(plugin).positions(positionId);
    
    if (!pos.isActive) return false;
    
    address subAccount = address(uint160(plugin) ^ uint160(pos.subAccountId));
    uint256 hf = _calculateHealthFactor(subAccount, pos.borrowVault);
    
    return hf < minHealthFactor;
}

function shouldAutoClosePosition(uint256 positionId, uint256 healthThreshold) 
    external 
    view 
    returns (bool) 
{
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    return _isPositionAtRisk(plugin, positionId, healthThreshold);
}

function getPositionCollateralInEth(uint256 positionId) 
    external 
    view 
    returns (uint256 ethValue) 
{
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    IEulerV2Plugin.LeveragePosition memory pos = IEulerV2Plugin(plugin).positions(positionId);
    
    if (!pos.isActive) return 0;
    
    address subAccount = address(uint160(plugin) ^ uint160(pos.subAccountId));
    
    // Query collateral shares
    uint256 shares = IEVault(pos.collateralVault).balanceOf(subAccount);
    uint256 assets = IEVault(pos.collateralVault).convertToAssets(shares);
    
    // Converti in ETH
    address asset = IEVault(pos.collateralVault).asset();
    string memory tokenCode = _getTokenCodeFromAddress(asset);
    
    ethValue = _convertToEthValue(tokenCode, assets);
}
```

---

*Continua nel documento 08_Integration_Plan_Part3.md*
