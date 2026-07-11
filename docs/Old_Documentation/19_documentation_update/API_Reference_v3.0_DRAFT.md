# 📚 DeFi Modular System - API Reference

**Version:** 3.0.0 (DRAFT)  
**Last Updated:** November 17, 2025  
**Status:** Complete System Documentation  
**Authors:** System Architecture Team

---

## 📋 Version History & Breaking Changes

### Version 3.0.0 (November 17, 2025) - COMPREHENSIVE UPDATE

#### 🔄 Breaking Changes

**1. ProxyGeneral.authorizeModule()** - Enhanced Event Tracking (from v2.0)
- **Previous Signature:** `authorizeModule(address module)`
- **New Signature:** `authorizeModule(address module, string memory moduleType)`
- **Impact:** API signature change - requires update in deployment scripts
- **Migration:**
  ```solidity
  // Before v2.0:
  proxyGeneral.authorizeModule(address(liquidityManager));
  
  // After v2.0+:
  proxyGeneral.authorizeModule(address(liquidityManager), "LiquidityManager");
  ```

**2. SwapManager.performSwap()** - MEV Protection via Deadline
- **Previous Signature:** `performSwap(string tokenIn, string tokenOut, uint256 amountIn)`
- **New Signature:** `performSwap(string tokenIn, string tokenOut, uint256 amountIn, uint256 deadline)`
- **Impact:** All swap calls must include deadline parameter
- **Migration:**
  ```solidity
  // Before:
  swapManager.performSwap("USDC", "WETH", 1000e6);
  
  // After:
  swapManager.performSwap("USDC", "WETH", 1000e6, block.timestamp + 20 minutes);
  
  // Or use auto-deadline wrapper:
  swapManager.performSwapAuto("USDC", "WETH", 1000e6); // Uses defaultDeadlineWindow
  ```

**3. TokenManager Oracle Architecture** - Oracle Adapter Modularity
- **Impact:** Oracle management now delegated to pluggable IOracleAdapter interface
- **New Function:** `setOracleAdapter(address _newAdapter)` - Switch oracle providers
- **Modified Signature:** `manageTokenData(string, address, uint8, uint256)` - Removed price feed params
- **Backward Compatibility:** Legacy `manageTokenData` with 6 params still supported

**4. LiquidityManager.withdraw()** - Enhanced MEV Protection
- **New Function:** `withdrawWithDeadline(uint256 shares, uint256 deadline)` - Explicit deadline
- **Modified Behavior:** `withdraw(uint256 shares)` now uses auto-deadline (20 minutes)
- **Impact:** Minimal - old signature still works with automatic deadline

#### ✨ Major Enhancements

**System-Wide:**
- 130+ new functions documented (from 60 to 193 total)
- Complete emergency handling system
- Comprehensive rate limiting across all operations
- Multi-plugin swap architecture (Phase 1A/1B)

**New Modules:**
- Rate limiting system in ProxyGeneral
- Asset snapshot system in EmergencyHandler
- Emergency contacts with roles
- Complete governance interfaces in ParameterManager

---

## 📑 Table of Contents

### 🏗️ Core Infrastructure
- [Beacon](#beacon) - Central Registry for Module Resolution (16 functions)
- [ProxyGeneral](#proxygeneral) - Asset Custodian & LP Token Manager (26 functions)

### 📊 Data & Valuation Layer
- [TokenManager](#tokenmanager) - Token Registry & Oracle Integration (19 functions)
- [ValueCalculator](#valuecalculator) - Pool Valuation Engine & Price Cache (14 functions)

### 💰 Liquidity Operations
- [LiquidityManager](#liquiditymanager) - Deposit & Withdrawal Management (21 functions)
- [SwapManager](#swapmanager) - DEX Integration & Multi-Plugin Swaps (24 functions)

### 🚨 Governance & Safety
- [EmergencyHandler](#emergencyhandler) - Emergency Pause & Recovery (39 functions)
- [ParameterManager](#parametermanager) - Dynamic Configuration Management (34 functions)

### 📖 Appendices
- [Architecture Overview](#architecture-overview) - System Design & Module Interactions
- [Common Patterns](#common-patterns) - Reusable Implementation Patterns
- [Events Index](#events-index) - Complete Event Reference
- [Error Codes](#error-codes) - Error Messages & Resolution
- [Glossary](#glossary) - Technical Terms & Definitions

---

## 🔗 Beacon {#beacon}

**Purpose:** Central registry providing dynamic module address resolution with emergency controls  
**Inheritance:** `Ownable` (custom 2-step transfer)  
**Dependencies:** None (fully independent)  
**Storage Pattern:** Mapping-based registry with history tracking

### Module Functions Overview

**Core Implementation Management:**
- [getImplementation](#beacon-getimplementation) - Resolve module address
- [updateImplementation](#beacon-updateimplementation) - Update module address
- [checkModuleExists](#beacon-checkmoduleexists) - Verify module registration
- [getRegisteredModules](#beacon-getregisteredmodules) - List all registered modules
- [getImplementationHistory](#beacon-getimplementationhistory) - Get upgrade history
- [getModuleInfo](#beacon-getmoduleinfo) - Get complete module info

**Emergency Controls:**
- [freezeModule](#beacon-freezemodule) - Freeze single module
- [unfreezeModule](#beacon-unfreezemodule) - Unfreeze module
- [activateGlobalFreeze](#beacon-activateglobalfreeze) - Freeze entire system
- [deactivateGlobalFreeze](#beacon-deactivateglobalfreeze) - Unfreeze system

**Ownership Transfer (2-step):**
- [transferOwnership](#beacon-transferownership) - Initiate transfer
- [acceptOwnership](#beacon-acceptownership) - Accept transfer
- [cancelOwnershipTransfer](#beacon-cancelownershiptransfer) - Cancel pending transfer

**Batch Operations:**
- [batchUpdateImplementations](#beacon-batchupdateimplementations) - Update multiple modules

**System Status:**
- [getBeaconStatus](#beacon-getbeaconstatus) - Get comprehensive status
- [checkSystemHealth](#beacon-checksystemhealth) - Health validation

---

### getImplementation {#beacon-getimplementation}

Resolves a module name to its implementation contract address. Core function for dynamic address resolution.

**Signature:**
```solidity
function getImplementation(string memory moduleName) 
    external view 
    returns (address implementation)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `moduleName` | `string` | Name of the module to resolve (e.g., "ProxyGeneral", "WETH") |

**Returns:**
| Type | Description |
|------|-------------|
| `address` | Implementation contract address for the specified module |

**Access Control:** `public view` (no restrictions)

**Validations:**
- ✅ Module name must be non-empty and max 50 bytes
- ✅ Implementation address must exist (non-zero)
- ✅ Module must not be frozen
- ✅ Global freeze must not be active
- ❌ Reverts with `"Invalid module name"` if name empty/too long
- ❌ Reverts with `"Implementation not found"` if module not registered
- ❌ Reverts with `"Module access frozen"` if module or global freeze active

**Events Emitted:** None (view function)

**Gas Cost:** ~3,500 gas (SLOAD + freeze checks)

**Usage Example:**
```solidity
IBeacon beacon = IBeacon(beaconAddress);
address proxyAddress = beacon.getImplementation("ProxyGeneral");
IProxyGeneral proxy = IProxyGeneral(proxyAddress);
```

**Called By:** All modules for dynamic dependency injection

**Security Notes:**
- Critical for system modularity - all modules depend on this
- Freeze protection prevents access during emergency situations
- View function - no state changes, safe for external calls

---

### updateImplementation {#beacon-updateimplementation}

Updates the implementation address for a specific module. Primary upgrade mechanism for the entire system.

**Signature:**
```solidity
function updateImplementation(string memory moduleName, address newImplementation) 
    external 
    onlyOwner 
    validModule(moduleName) 
    notFrozen(moduleName)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `moduleName` | `string` | Name of the module to update (1-50 bytes) |
| `newImplementation` | `address` | New implementation contract address |

**Returns:** None (void)

**Access Control:** `onlyOwner` (restricted to contract owner)

**Validations:**
- ✅ Module name must be 1-50 bytes
- ✅ New implementation must be non-zero address
- ✅ New implementation must be a contract (not EOA)
- ✅ New implementation must differ from current one
- ✅ Module must not be frozen
- ✅ Global freeze must not be active
- ❌ Reverts with validation errors if any check fails

**Events Emitted:**
```solidity
event ImplementationUpdated(
    string indexed module,
    address indexed oldImplementation,
    address indexed newImplementation,
    uint256 timestamp
)
```

**Gas Cost:** ~60,000 gas (SSTORE + history + event)

**Usage Example:**
```solidity
// Deploy new version
LiquidityManagerV2 newLM = new LiquidityManagerV2(beaconAddress);

// Update registry (owner only)
beacon.updateImplementation("LiquidityManager", address(newLM));
```

**Security Notes:**
- ⚠️ **CRITICAL:** Can upgrade any module - requires multi-sig in production
- Old implementation saved in history for rollback
- Recommend timelock mechanism for production deployments

---

### checkModuleExists {#beacon-checkmoduleexists}

Verifies if a module is registered in the Beacon.

**Signature:**
```solidity
function checkModuleExists(string memory module) 
    external view 
    returns (bool exists)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `module` | `string` | Module name to check |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if module is registered, false otherwise |

**Access Control:** `public view` (no restrictions)

**Gas Cost:** ~1,000 gas (single mapping lookup)

**Usage Example:**
```solidity
if (beacon.checkModuleExists("LiquidityManager")) {
    // Module is registered
}
```

---

### getRegisteredModules {#beacon-getregisteredmodules}

Returns array of all registered module names.

**Signature:**
```solidity
function getRegisteredModules() 
    external view 
    returns (string[] memory modules)
```

**Returns:**
| Type | Description |
|------|-------------|
| `string[]` | Array of all module names registered in Beacon |

**Access Control:** `public view` (no restrictions)

**Gas Cost:** ~5,000 + (n * 1,000) gas where n = number of modules

**Usage Example:**
```solidity
string[] memory allModules = beacon.getRegisteredModules();
for (uint i = 0; i < allModules.length; i++) {
    console.log("Module:", allModules[i]);
}
```

**Use Cases:**
- Admin dashboards
- Monitoring systems
- System health checks

---

### getImplementationHistory {#beacon-getimplementationhistory}

Returns array of previous implementation addresses for a module.

**Signature:**
```solidity
function getImplementationHistory(string memory module) 
    external view 
    returns (address[] memory history)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `module` | `string` | Module name to query history for |

**Returns:**
| Type | Description |
|------|-------------|
| `address[]` | Array of previous implementation addresses (chronological) |

**Access Control:** `public view` (no restrictions)

**Gas Cost:** ~3,000 + (n * 800) gas where n = history length

**Usage Example:**
```solidity
address[] memory history = beacon.getImplementationHistory("TokenManager");
console.log("Previous versions:", history.length);
```

**Use Cases:**
- Audit trails
- Rollback planning
- Upgrade tracking

---

### getModuleInfo {#beacon-getmoduleinfo}

Returns comprehensive information about a specific module.

**Signature:**
```solidity
function getModuleInfo(string memory module) 
    external view 
    returns (
        address currentImpl,
        uint256 lastUpdated,
        uint256 historyCount,
        bool isFrozen
    )
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `module` | `string` | Module name to query |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `currentImpl` | `address` | Current implementation address |
| `lastUpdated` | `uint256` | Timestamp of last update |
| `historyCount` | `uint256` | Number of previous versions |
| `isFrozen` | `bool` | Whether module is currently frozen |

**Access Control:** `public view` (no restrictions)

**Gas Cost:** ~4,500 gas (multiple SLOADs)

**Usage Example:**
```solidity
(address impl, uint256 updated, uint256 count, bool frozen) = 
    beacon.getModuleInfo("SwapManager");

console.log("Current implementation:", impl);
console.log("Last updated:", updated);
console.log("Version count:", count);
console.log("Is frozen:", frozen);
```

---

### freezeModule {#beacon-freezemodule}

Freezes a single module, preventing all access to it.

**Signature:**
```solidity
function freezeModule(string memory module) 
    external 
    onlyOwner 
    validModule(module)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `module` | `string` | Module name to freeze |

**Returns:** None (void)

**Access Control:** `onlyOwner` (emergency use only)

**Validations:**
- ✅ Module must exist
- ✅ Module must not already be frozen
- ❌ Reverts if module doesn't exist or already frozen

**Events Emitted:**
```solidity
event ModuleFrozen(
    string indexed module,
    address indexed freezer
)
```

**Gas Cost:** ~25,000 gas (SSTORE + event)

**Usage Example:**
```solidity
// Emergency freeze specific module
beacon.freezeModule("SwapManager");
```

**Security Notes:**
- ⚠️ Emergency use only - disrupts all operations using this module
- Prevents getImplementation() calls for frozen module
- Use unfreeze to restore access

---

### unfreezeModule {#beacon-unfreezemodule}

Removes freeze from a module, restoring access.

**Signature:**
```solidity
function unfreezeModule(string memory module) 
    external 
    onlyOwner 
    validModule(module)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `module` | `string` | Module name to unfreeze |

**Access Control:** `onlyOwner`

**Events Emitted:**
```solidity
event ModuleUnfrozen(
    string indexed module,
    address indexed unfreezer
)
```

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
beacon.unfreezeModule("SwapManager");
```

---

### activateGlobalFreeze {#beacon-activateglobalfreeze}

Activates global freeze, blocking ALL module resolutions system-wide.

**Signature:**
```solidity
function activateGlobalFreeze() 
    external 
    onlyOwner
```

**Returns:** None (void)

**Access Control:** `onlyOwner` (emergency use only)

**Events Emitted:**
```solidity
event GlobalFreezeActivated(
    address indexed activator
)
```

**Gas Cost:** ~25,000 gas

**Usage Example:**
```solidity
// Emergency: freeze entire system
beacon.activateGlobalFreeze();
```

**Security Notes:**
- ⚠️ **NUCLEAR OPTION**: Stops ALL module operations
- All getImplementation() calls will revert
- Use only in critical emergencies
- Coordinate with EmergencyHandler

---

### deactivateGlobalFreeze {#beacon-deactivateglobalfreeze}

Deactivates global freeze, restoring system access.

**Signature:**
```solidity
function deactivateGlobalFreeze() 
    external 
    onlyOwner
```

**Access Control:** `onlyOwner`

**Events Emitted:**
```solidity
event GlobalFreezeDeactivated(
    address indexed deactivator
)
```

**Gas Cost:** ~20,000 gas

---

### transferOwnership {#beacon-transferownership}

Initiates 2-step ownership transfer (step 1).

**Signature:**
```solidity
function transferOwnership(address newOwner) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newOwner` | `address` | Proposed new owner address |

**Validations:**
- ✅ New owner must be non-zero
- ✅ New owner must differ from current owner
- ✅ New owner must differ from pending owner

**Events Emitted:**
```solidity
event OwnershipTransferInitiated(
    address indexed currentOwner,
    address indexed pendingOwner
)
```

**Security Notes:**
- 2-step process prevents accidental transfers
- Old owner retains control until new owner accepts

---

### acceptOwnership {#beacon-acceptownership}

Completes 2-step ownership transfer (step 2).

**Signature:**
```solidity
function acceptOwnership() 
    external
```

**Access Control:** Must be called by pendingOwner

**Events Emitted:**
```solidity
event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
)
```

**Usage Example:**
```solidity
// Step 1: Current owner proposes transfer
beacon.transferOwnership(newOwnerAddress);

// Step 2: New owner accepts
beacon.acceptOwnership(); // Called by newOwnerAddress
```

---

### cancelOwnershipTransfer {#beacon-cancelownershiptransfer}

Cancels a pending ownership transfer.

**Signature:**
```solidity
function cancelOwnershipTransfer() 
    external 
    onlyOwner
```

**Validations:**
- ✅ Must have pending transfer active

**Gas Cost:** ~5,000 gas

---

### batchUpdateImplementations {#beacon-batchupdateimplementations}

Updates multiple module implementations in a single transaction.

**Signature:**
```solidity
function batchUpdateImplementations(
    string[] memory modules,
    address[] memory newImplementations
) external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `modules` | `string[]` | Array of module names (max 10) |
| `newImplementations` | `address[]` | Array of new implementation addresses |

**Validations:**
- ✅ Arrays must have same length
- ✅ Max 10 modules per batch
- ✅ Global freeze must not be active
- ✅ Individual modules must not be frozen
- ✅ All standard updateImplementation validations per module

**Events Emitted:**
```solidity
event ImplementationUpdated(...) // Emitted for EACH module
```

**Gas Cost:** ~(60,000 * n) gas where n = number of modules

**Usage Example:**
```solidity
string[] memory modules = new string[](3);
modules[0] = "LiquidityManager";
modules[1] = "SwapManager";
modules[2] = "ValueCalculator";

address[] memory implementations = new address[](3);
implementations[0] = address(newLM);
implementations[1] = address(newSM);
implementations[2] = address(newVC);

beacon.batchUpdateImplementations(modules, implementations);
```

**Use Cases:**
- Coordinated multi-module upgrades
- System-wide version updates
- Deployment optimization

---

### getBeaconStatus {#beacon-getbeaconstatus}

Returns comprehensive status of the Beacon system.

**Signature:**
```solidity
function getBeaconStatus() 
    external view 
    returns (
        uint256 totalModules,
        uint256 frozenModules,
        bool isGlobalFrozen,
        address currentOwner,
        address pendingOwnerAddress
    )
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `totalModules` | `uint256` | Number of registered modules |
| `frozenModules` | `uint256` | Number of currently frozen modules |
| `isGlobalFrozen` | `bool` | Whether global freeze is active |
| `currentOwner` | `address` | Current contract owner |
| `pendingOwnerAddress` | `address` | Pending owner (if transfer initiated) |

**Access Control:** `public view`

**Gas Cost:** ~10,000 + (n * 1,500) gas where n = total modules

**Usage Example:**
```solidity
(uint256 total, uint256 frozen, bool globalFrozen, address owner, address pending) = 
    beacon.getBeaconStatus();

console.log("Total modules:", total);
console.log("Frozen modules:", frozen);
console.log("Global freeze:", globalFrozen);
```

**Use Cases:**
- Admin dashboards
- Monitoring systems
- Health checks before operations

---

### checkSystemHealth {#beacon-checksystemhealth}

Performs comprehensive health check of the Beacon system.

**Signature:**
```solidity
function checkSystemHealth() 
    external view 
    returns (
        bool isHealthy,
        string[] memory issues
    )
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `isHealthy` | `bool` | True if no issues detected |
| `issues` | `string[]` | Array of issue descriptions |

**Access Control:** `public view`

**Gas Cost:** ~15,000 + (n * 2,000) gas where n = total modules

**Health Checks Performed:**
- Global freeze status
- Individual module freeze status
- Missing implementations
- Zero address implementations

**Usage Example:**
```solidity
(bool healthy, string[] memory problems) = beacon.checkSystemHealth();

if (!healthy) {
    for (uint i = 0; i < problems.length; i++) {
        console.log("Issue:", problems[i]);
    }
}
```

**Use Cases:**
- Pre-deployment validation
- Monitoring systems
- Emergency diagnostics

---

## 🏛️ ProxyGeneral {#proxygeneral}

**Purpose:** Central asset custodian, LP token implementation, and rate limiting coordinator  
**Inheritance:** `ERC20`, `Ownable`, `ReentrancyGuard`  
**Dependencies:** Beacon (for module authorization)  
**Token Standard:** ERC20 (LP tokens: "LP Token" / "LPT")

### Module Functions Overview

**LP Token Management (ERC20):**
- [mint](#proxygeneral-mint) - Mint LP tokens
- [burn](#proxygeneral-burn) - Burn LP tokens
- [balanceOf](#proxygeneral-balanceof) - Check LP balance (ERC20)
- [totalSupply](#proxygeneral-totalsupply) - Total LP supply (ERC20)

**Asset Management:**
- [transferFunds](#proxygeneral-transferfunds) - Transfer assets (ETH or ERC20)
- [getAssetBalance](#proxygeneral-getassetbalance) - Query asset balance

**Token Custody Operations:**
- [withdrawToken](#proxygeneral-withdrawtoken) - Withdraw token by code
- [depositToken](#proxygeneral-deposittoken) - Deposit token by code

**Swap Support:**
- [approveSpender](#proxygeneral-approvespender) - Approve token spender
- [transferToModule](#proxygeneral-transfertomodule) - Transfer to authorized module
- [transferFromModule](#proxygeneral-transferfrommodule) - Receive from authorized module

**Access Control:**
- [authorizeModule](#proxygeneral-authorizemodule) - Add authorized module
- [deauthorizeModule](#proxygeneral-deauthorizemodule) - Remove authorized module
- [isAuthorizedModule](#proxygeneral-isauthorizedmodule) - Check authorization

**Emergency Controls:**
- [pause](#proxygeneral-pause) - Pause all operations
- [unpause](#proxygeneral-unpause) - Resume operations
- [isPaused](#proxygeneral-ispaused) - Check pause state
- [emergencyTransferAll](#proxygeneral-emergencytransferall) - Emergency recovery

**Rate Limiting System:**
- [setRateLimit](#proxygeneral-setratelimit) - Configure rate limits
- [checkRateLimit](#proxygeneral-checkratelimit) - Verify operation allowed
- [trackOperation](#proxygeneral-trackoperation) - Track completed operation

**Legacy Hourly Tracking (Backward Compatibility):**
- [setHourlyWithdrawn](#proxygeneral-sethourly withdrawn) - Set hourly amount
- [getHourlyWithdrawn](#proxygeneral-gethourlywithdrawn) - Get hourly amount
- [incrementHourlyWithdrawn](#proxygeneral-incrementhourlywithdrawn) - Increment hourly

**Parameter Storage:**
- [setModuleParameter](#proxygeneral-setmoduleparameter) - Set shared parameter
- [getModuleParameter](#proxygeneral-getmoduleparameter) - Get shared parameter

---

### mint {#proxygeneral-mint}

Mints LP tokens to a user address. Core function for deposit flow.

**Signature:**
```solidity
function mint(address to, uint256 amount) 
    external 
    onlyAuthorizedModule 
    whenNotPaused
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `to` | `address` | Recipient address for LP tokens |
| `amount` | `uint256` | Quantity of LP tokens to mint (in wei) |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule` (only authorized modules or owner)

**Validations:**
- ✅ `to` must be non-zero address
- ✅ `amount` must be greater than 0
- ✅ System must not be paused
- ❌ Reverts with `"Cannot mint to zero address"` if to == address(0)
- ❌ Reverts with `"Cannot mint zero amount"` if amount == 0
- ❌ Reverts with `"Contract is paused"` if system paused

**Events Emitted:**
```solidity
event LPTokenMinted(
    address indexed to,
    uint256 amount,
    uint256 newTotalSupply
)
```

**Gas Cost:** ~50,000 gas (SSTORE + ERC20 mint + event)

**Usage Example:**
```solidity
// Called by LiquidityManager during deposit
IProxyGeneral proxy = IProxyGeneral(proxyAddress);
proxy.mint(msg.sender, lpTokensToMint);
```

**Called By:** LiquidityManager.deposit()

**Security Notes:**
- Protected by onlyAuthorizedModule - only LiquidityManager should call this
- whenNotPaused prevents minting during emergency
- ERC20._mint handles all token accounting

---

### burn {#proxygeneral-burn}

Burns LP tokens from a user address. Core function for withdrawal flow.

**Signature:**
```solidity
function burn(address from, uint256 amount) 
    external 
    onlyAuthorizedModule 
    whenNotPaused
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `from` | `address` | Address from which to burn LP tokens |
| `amount` | `uint256` | Quantity of LP tokens to burn (in wei) |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule`

**Validations:**
- ✅ `from` must be non-zero address
- ✅ `amount` must be greater than 0
- ✅ `from` must have sufficient LP token balance
- ✅ System must not be paused
- ❌ Reverts with `"Cannot burn from zero address"` if from == address(0)
- ❌ Reverts with `"Cannot burn zero amount"` if amount == 0
- ❌ Reverts with `"Insufficient LP token balance"` if balanceOf(from) < amount

**Events Emitted:**
```solidity
event LPTokenBurned(
    address indexed from,
    uint256 amount,
    uint256 newTotalSupply
)
```

**Gas Cost:** ~40,000 gas (SSTORE + ERC20 burn + event)

**Usage Example:**
```solidity
// Called by LiquidityManager during withdrawal
proxy.burn(msg.sender, lpTokensToBurn);
```

**Called By:** LiquidityManager.withdraw(), LiquidityManager.withdrawWithDeadline()

---

### balanceOf {#proxygeneral-balanceof}

Returns the LP token balance of an address. Standard ERC20 function.

**Signature:**
```solidity
function balanceOf(address account) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `account` | `address` | Address to query |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | LP token balance |

**Access Control:** `public view` (ERC20 standard)

**Gas Cost:** ~2,500 gas

**Usage Example:**
```solidity
uint256 lpBalance = proxy.balanceOf(userAddress);
console.log("User LP tokens:", lpBalance);
```

---

### totalSupply {#proxygeneral-totalsupply}

Returns total LP token supply. Standard ERC20 function.

**Signature:**
```solidity
function totalSupply() 
    external view 
    returns (uint256)
```

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Total LP tokens in circulation |

**Access Control:** `public view` (ERC20 standard)

**Gas Cost:** ~2,000 gas

**Usage Example:**
```solidity
uint256 supply = proxy.totalSupply();
console.log("Total LP supply:", supply);
```

**Called By:** LiquidityManager (share calculations), ValueCalculator, monitoring tools

---

### transferFunds {#proxygeneral-transferfunds}

Transfers assets (ETH or ERC20) from ProxyGeneral custody to a recipient.

**Signature:**
```solidity
function transferFunds(address to, address asset, uint256 amount) 
    external 
    onlyAuthorizedModule 
    whenNotPaused
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `to` | `address` | Recipient address |
| `asset` | `address` | Token address (address(0) for ETH) |
| `amount` | `uint256` | Amount to transfer (in wei or token smallest unit) |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule`

**Validations:**
- ✅ `to` must be non-zero address
- ✅ `amount` must be greater than 0
- ✅ ProxyGeneral must have sufficient balance
- ❌ Reverts with `"Invalid recipient"` if to == address(0)
- ❌ Reverts with `"Invalid amount"` if amount == 0
- ❌ Reverts with `"Insufficient ETH balance"` for ETH transfers
- ❌ Reverts with `"Insufficient asset balance"` for ERC20 transfers
- ❌ Reverts with `"ETH transfer failed"` or `"Asset transfer failed"` if transfer fails

**Events Emitted:**
```solidity
event AssetTransferred(
    address indexed to,
    address indexed asset,
    uint256 amount,
    address indexed module
)
```

**Gas Cost:** ~30,000 gas for ETH, ~50,000 gas for ERC20

**Usage Example:**
```solidity
// Transfer WETH to user during withdrawal
address wethAddress = beacon.getImplementation("WETH");
proxy.transferFunds(user, wethAddress, wethAmount);

// Transfer ETH (if needed)
proxy.transferFunds(user, address(0), ethAmount);
```

**Called By:** LiquidityManager, SwapManager, EmergencyHandler

---

### getAssetBalance {#proxygeneral-getassetbalance}

Returns the balance of a specific asset held by ProxyGeneral.

**Signature:**
```solidity
function getAssetBalance(address asset) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `asset` | `address` | Token address (address(0) for ETH) |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Current balance of the asset in custody |

**Access Control:** `public view` (no restrictions)

**Gas Cost:** ~2,500 gas (single SLOAD or balance query)

**Usage Example:**
```solidity
address wethAddress = beacon.getImplementation("WETH");
uint256 wethBalance = proxy.getAssetBalance(wethAddress);

uint256 ethBalance = proxy.getAssetBalance(address(0));
```

**Called By:** ValueCalculator.calculateTokenValue(), LiquidityManager, monitoring tools

---

### withdrawToken {#proxygeneral-withdrawtoken}

Withdraws token from custody using token code resolution via TokenManager.

**Signature:**
```solidity
function withdrawToken(string memory tokenCode, uint256 amount, address to) 
    external 
    onlyAuthorizedModule 
    whenNotPaused
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier ("WETH", "USDC", "WBTC", etc.) |
| `amount` | `uint256` | Amount in token's smallest unit (wei for WETH, 1e6 for USDC) |
| `to` | `address` | Recipient address |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule`

**Validations:**
- ✅ `tokenCode` must be non-empty string
- ✅ `amount` must be greater than 0
- ✅ `to` must be non-zero address
- ✅ Token must exist in TokenManager (or Beacon for WETH)
- ✅ ProxyGeneral must have sufficient token balance
- ❌ Reverts with `"Invalid token code"` if tokenCode empty
- ❌ Reverts with `"Invalid amount"` if amount == 0
- ❌ Reverts with `"Invalid recipient"` if to == address(0)
- ❌ Reverts with `"WETH not found in Beacon"` if WETH resolution fails
- ❌ Reverts with `"TokenManager not found"` if TokenManager not in Beacon
- ❌ Reverts with `"Invalid token address"` if token resolution fails
- ❌ Reverts with `"Insufficient token balance"` if balance < amount
- ❌ Reverts with SafeERC20 errors if transfer fails

**Events Emitted:**
```solidity
event TokenWithdrawn(
    string indexed tokenCode,
    uint256 amount,
    address indexed to
)
```

**Gas Cost:** ~60,000 gas (resolution + transfer + event)

**Usage Example:**
```solidity
// Withdraw USDC to user
proxy.withdrawToken("USDC", 1000e6, userAddress);

// Withdraw WETH (special case, resolved via Beacon)
proxy.withdrawToken("WETH", 1 ether, userAddress);
```

**Called By:** LiquidityManager, SwapManager

**Security Notes:**
- Uses SafeERC20 for secure transfers
- Special handling for WETH (Beacon resolution)
- Other tokens resolved via TokenManager
- Auto-reverts on insufficient balance or invalid token

---

### depositToken {#proxygeneral-deposittoken}

Deposits token into custody using token code resolution. Requires prior approval.

**Signature:**
```solidity
function depositToken(string memory tokenCode, uint256 amount, address from) 
    external 
    onlyAuthorizedModule 
    whenNotPaused
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier ("WETH", "USDC", "WBTC", etc.) |
| `amount` | `uint256` | Amount in token's smallest unit |
| `from` | `address` | Sender address (must have approved ProxyGeneral) |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule`

**Validations:**
- ✅ `tokenCode` must be non-empty string
- ✅ `amount` must be greater than 0
- ✅ `from` must be non-zero address
- ✅ Token must exist in TokenManager (or Beacon for WETH)
- ✅ `from` must have approved ProxyGeneral for >= amount
- ❌ Reverts with `"Invalid token code"` if tokenCode empty
- ❌ Reverts with `"Invalid amount"` if amount == 0
- ❌ Reverts with `"Invalid sender"` if from == address(0)
- ❌ Reverts with SafeERC20 errors if no approval or insufficient balance

**Events Emitted:**
```solidity
event TokenDeposited(
    string indexed tokenCode,
    uint256 amount,
    address indexed from
)
```

**Gas Cost:** ~65,000 gas (resolution + transferFrom + event)

**Usage Example:**
```solidity
// User must first approve ProxyGeneral
IERC20(usdcAddress).approve(proxyAddress, 1000e6);

// Then module can deposit
proxy.depositToken("USDC", 1000e6, msg.sender);
```

**Called By:** LiquidityManager.deposit()

**Security Notes:**
- Requires explicit approval before calling
- Uses SafeERC20.safeTransferFrom for security
- Same resolution logic as withdrawToken

---

### approveSpender {#proxygeneral-approvespender}

Approves a spender (typically DEX router) to spend tokens held in custody.

**Signature:**
```solidity
function approveSpender(address token, address spender, uint256 amount) 
    external 
    onlyAuthorizedModule
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `token` | `address` | Token contract address |
| `spender` | `address` | Spender address (DEX router, etc.) |
| `amount` | `uint256` | Approval amount (use type(uint256).max for unlimited) |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule`

**Validations:**
- ✅ `token` must be non-zero address
- ✅ `spender` must be non-zero address
- ❌ Reverts with `"Invalid token"` if token == address(0)
- ❌ Reverts with `"Invalid spender"` if spender == address(0)

**Events Emitted:**
```solidity
event SpenderApproved(
    address indexed token,
    address indexed spender,
    uint256 amount,
    address indexed module
)
```

**Gas Cost:** ~45,000 gas (ERC20 approve + event)

**Usage Example:**
```solidity
// Approve SimpleSwap router for WETH swaps
address wethAddress = beacon.getImplementation("WETH");
address routerAddress = beacon.getImplementation("SimpleSwapRouter");
proxy.approveSpender(wethAddress, routerAddress, type(uint256).max);
```

**Called By:** SwapManager.performSwap()

**Security Notes:**
- ⚠️ **CRITICAL**: Only approve trusted routers
- Use exact amounts when possible (avoid unlimited approvals)
- Only authorized modules can call this

---

### transferToModule {#proxygeneral-transfertomodule}

Transfers tokens temporarily to an authorized module for operations.

**Signature:**
```solidity
function transferToModule(address token, address module, uint256 amount) 
    external 
    onlyAuthorizedModule
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `token` | `address` | Token contract address |
| `module` | `address` | Target module address |
| `amount` | `uint256` | Amount to transfer |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule`

**Validations:**
- ✅ `module` must be authorized
- ✅ ProxyGeneral must have sufficient token balance
- ❌ Reverts with `"Module not authorized"` if module not in authorizedModules
- ❌ Reverts with `"Insufficient balance"` if balance < amount
- ❌ Reverts with `"Transfer to module failed"` if transfer fails

**Events Emitted:**
```solidity
event AssetTransferredToModule(
    address indexed token,
    address indexed module,
    uint256 amount
)
```

**Gas Cost:** ~50,000 gas

**Usage Example:**
```solidity
// Transfer WETH to SwapManager for swap execution
proxy.transferToModule(wethAddress, swapManagerAddress, 1 ether);
```

**Called By:** SwapManager (for complex swap operations)

---

### transferFromModule {#proxygeneral-transferfrommodule}

Receives tokens back from a module after operations.

**Signature:**
```solidity
function transferFromModule(address token, address module, uint256 amount) 
    external 
    onlyAuthorizedModule
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `token` | `address` | Token contract address |
| `module` | `address` | Source module address |
| `amount` | `uint256` | Amount to receive |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule`

**Validations:**
- ✅ `module` must be authorized
- ✅ Module must have approved ProxyGeneral
- ❌ Reverts with `"Module not authorized"` if module not authorized
- ❌ Reverts with `"Transfer from module failed"` if transferFrom fails

**Events Emitted:** None (implicit in transferFrom)

**Gas Cost:** ~55,000 gas

**Usage Example:**
```solidity
// Receive USDC back from SwapManager after swap
proxy.transferFromModule(usdcAddress, swapManagerAddress, outputAmount);
```

---

### authorizeModule {#proxygeneral-authorizemodule}

Authorizes a module to call sensitive functions. **BREAKING CHANGE** in v2.0+.

**Signature:**
```solidity
function authorizeModule(address module, string memory moduleType) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `module` | `address` | Module contract address |
| `moduleType` | `string` | Module type identifier ("LiquidityManager", "SwapManager", etc.) |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ `module` must be non-zero address
- ✅ Module must not already be authorized
- ❌ Reverts with `"Invalid module address"` if module == address(0)
- ❌ Reverts with `"Module already authorized"` if already authorized

**Events Emitted:**
```solidity
event ModuleAuthorized(
    address indexed module,
    string moduleType
)
```

**Gas Cost:** ~50,000 gas

**Usage Example:**
```solidity
// NEW signature (v2.0+):
proxy.authorizeModule(address(liquidityManager), "LiquidityManager");

// OLD signature (pre-v2.0) - NO LONGER SUPPORTED:
// proxy.authorizeModule(address(liquidityManager));
```

**Breaking Change Note:**
- **Previous:** `authorizeModule(address module)`
- **Current:** `authorizeModule(address module, string moduleType)`
- **Migration:** Add moduleType parameter to all authorization calls

---

### deauthorizeModule {#proxygeneral-deauthorizemodule}

Removes authorization from a module.

**Signature:**
```solidity
function deauthorizeModule(address module) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `module` | `address` | Module contract address to deauthorize |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Module must currently be authorized
- ❌ Reverts with `"Module not authorized"` if not currently authorized

**Events Emitted:**
```solidity
event ModuleDeauthorized(
    address indexed module
)
```

**Gas Cost:** ~30,000 gas

**Usage Example:**
```solidity
// Remove authorization (emergency or upgrade)
proxy.deauthorizeModule(address(oldSwapManager));
```

---

### isAuthorizedModule {#proxygeneral-isauthorizedmodule}

Checks if a module is currently authorized.

**Signature:**
```solidity
function isAuthorizedModule(address module) 
    external view 
    returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `module` | `address` | Module address to check |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if module is authorized, false otherwise |

**Access Control:** `public view`

**Gas Cost:** ~1,000 gas

**Usage Example:**
```solidity
if (proxy.isAuthorizedModule(address(swapManager))) {
    // Module is authorized
}
```

---

### pause {#proxygeneral-pause}

Activates emergency pause, blocking all operations.

**Signature:**
```solidity
function pause() 
    external 
    onlyAuthorizedModule
```

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule`

**Validations:**
- ✅ System must not already be paused
- ❌ Reverts with `"Already paused"` if already paused

**Events Emitted:**
```solidity
event Paused(
    address indexed account
)
```

**Gas Cost:** ~25,000 gas

**Usage Example:**
```solidity
// Called by EmergencyHandler
proxy.pause();
```

**Called By:** EmergencyHandler.emergencyPause()

---

### unpause {#proxygeneral-unpause}

Deactivates emergency pause, resuming operations.

**Signature:**
```solidity
function unpause() 
    external 
    onlyOwner
```

**Returns:** None (void)

**Access Control:** `onlyOwner` (more restrictive than pause)

**Validations:**
- ✅ System must currently be paused
- ❌ Reverts with `"Not paused"` if not paused

**Events Emitted:**
```solidity
event Unpaused(
    address indexed account
)
```

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
// Resume operations after emergency resolved
proxy.unpause();
```

---

### isPaused {#proxygeneral-ispaused}

Returns current pause state.

**Signature:**
```solidity
function isPaused() 
    external view 
    returns (bool)
```

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if system is paused, false otherwise |

**Access Control:** `public view`

**Gas Cost:** ~1,000 gas

---

### emergencyTransferAll {#proxygeneral-emergencytransferall}

Emergency recovery function - transfers all assets to a recipient. **NUCLEAR OPTION**.

**Signature:**
```solidity
function emergencyTransferAll(address recipient) 
    external 
    onlyOwner 
    whenPaused
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `recipient` | `address` | Emergency recovery address |

**Returns:** None (void)

**Access Control:** `onlyOwner` + `whenPaused` (double protection)

**Validations:**
- ✅ `recipient` must be non-zero address
- ✅ System must be paused
- ❌ Reverts with `"Invalid recipient"` if recipient == address(0)
- ❌ Reverts with `"Contract is not paused"` if not paused
- ❌ Reverts with `"ETH emergency transfer failed"` if ETH transfer fails

**Events Emitted:**
```solidity
event EmergencyTransferExecuted(
    address indexed recipient,
    uint256 timestamp
)
```

**Gas Cost:** ~100,000+ gas (depends on number of assets)

**Usage Example:**
```solidity
// EMERGENCY ONLY:
// 1. Pause system
proxy.pause();

// 2. Transfer all assets to recovery wallet
proxy.emergencyTransferAll(recoveryWallet);
```

**Security Notes:**
- ⚠️ **NUCLEAR OPTION**: Transfers ALL WETH and ETH
- Only works when system is paused
- Records recipient and timestamp for audit trail
- Coordinate with EmergencyHandler

---

### setRateLimit {#proxygeneral-setratelimit}

Configures global rate limits for an operation type.

**Signature:**
```solidity
function setRateLimit(
    string memory operationType, 
    uint256 hourlyLimit, 
    uint256 dailyLimit
) external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `operationType` | `string` | Operation identifier ("deposit", "withdraw", etc.) |
| `hourlyLimit` | `uint256` | Hourly limit in wei (0 = unlimited) |
| `dailyLimit` | `uint256` | Daily limit in wei (0 = unlimited) |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ `operationType` must be non-empty
- ✅ `hourlyLimit` <= `dailyLimit` (unless dailyLimit == 0)
- ❌ Reverts with `"Invalid operation type"` if operationType empty
- ❌ Reverts with `"Hourly limit exceeds daily limit"` if hourlyLimit > dailyLimit

**Events Emitted:**
```solidity
event RateLimitUpdated(
    string operationType,
    uint256 hourlyLimit,
    uint256 dailyLimit
)
```

**Gas Cost:** ~60,000 gas

**Usage Example:**
```solidity
// Set withdraw limits: 10 ETH/hour, 50 ETH/day
proxy.setRateLimit("withdraw", 10 ether, 50 ether);

// Set deposit limits: unlimited
proxy.setRateLimit("deposit", 0, 0);
```

**Security Notes:**
- Use 0 for unlimited (not recommended for production)
- Hourly limit resets every 60 minutes
- Daily limit resets every 24 hours

---

### checkRateLimit {#proxygeneral-checkratelimit}

Checks if an operation is allowed under current rate limits.

**Signature:**
```solidity
function checkRateLimit(
    address user, 
    string memory operationType, 
    uint256 amount
) external view returns (
    bool allowed, 
    uint256 remainingHourly, 
    uint256 remainingDaily
)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User address |
| `operationType` | `string` | Operation type ("deposit", "withdraw", etc.) |
| `amount` | `uint256` | Proposed operation amount in wei |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `allowed` | `bool` | True if operation is within limits |
| `remainingHourly` | `uint256` | Remaining hourly capacity |
| `remainingDaily` | `uint256` | Remaining daily capacity |

**Access Control:** `public view`

**Gas Cost:** ~5,000 gas

**Usage Example:**
```solidity
(bool allowed, uint256 hourly, uint256 daily) = 
    proxy.checkRateLimit(msg.sender, "withdraw", 5 ether);

if (!allowed) {
    revert("Rate limit exceeded");
}
```

**Called By:** LiquidityManager (before withdraw operations)

**Security Notes:**
- View function - does not modify state
- Auto-resets expired periods
- Returns type(uint256).max for unlimited

---

### trackOperation {#proxygeneral-trackoperation}

Records a completed operation for rate limiting tracking.

**Signature:**
```solidity
function trackOperation(
    address user, 
    string memory operationType, 
    uint256 amount
) external onlyAuthorizedModule
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User who performed operation |
| `operationType` | `string` | Operation type ("deposit", "withdraw", etc.) |
| `amount` | `uint256` | Amount actually processed in wei |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule`

**Validations:**
- ✅ `amount` must be greater than 0
- ✅ No overflow in tracking counters
- ❌ Reverts with `"Invalid amount"` if amount == 0
- ❌ Reverts with `"Hourly overflow"` or `"Daily overflow"` on arithmetic overflow

**Events Emitted:**
```solidity
event OperationTracked(
    address indexed user,
    string operationType,
    uint256 amount,
    uint256 timestamp
)
```

**Gas Cost:** ~35,000 gas (SSTOREs + event)

**Usage Example:**
```solidity
// After successful withdrawal
proxy.trackOperation(msg.sender, "withdraw", actualAmount);
```

**Called By:** LiquidityManager (after successful operations)

**Security Notes:**
- Call AFTER operation completes successfully
- Auto-initializes user limits on first use
- Auto-resets expired periods
- Overflow protection prevents manipulation

---

### setHourlyWithdrawn {#proxygeneral-sethourlywithdrawn}

**(LEGACY - Backward Compatibility)** Sets hourly withdrawn amount for a user.

**Signature:**
```solidity
function setHourlyWithdrawn(address user, uint256 hour, uint256 amount) 
    external 
    onlyAuthorizedModule
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User address |
| `hour` | `uint256` | Hour timestamp (in hours since epoch) |
| `amount` | `uint256` | Amount withdrawn in that hour |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule`

**Events Emitted:**
```solidity
event HourlyWithdrawnUpdated(
    address indexed user,
    uint256 hour,
    uint256 amount
)
```

**Gas Cost:** ~30,000 gas

**Note:** Legacy function - prefer using new rate limiting system (setRateLimit, trackOperation)

---

### getHourlyWithdrawn {#proxygeneral-gethourlywithdrawn}

**(LEGACY - Backward Compatibility)** Gets hourly withdrawn amount for a user.

**Signature:**
```solidity
function getHourlyWithdrawn(address user, uint256 hour) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User address |
| `hour` | `uint256` | Hour timestamp (in hours since epoch) |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Amount withdrawn in that hour |

**Access Control:** `public view`

**Gas Cost:** ~2,000 gas

---

### incrementHourlyWithdrawn {#proxygeneral-incrementhourlywithdrawn}

**(LEGACY - Backward Compatibility)** Increments hourly withdrawn for current hour.

**Signature:**
```solidity
function incrementHourlyWithdrawn(address user, uint256 amount) 
    external 
    onlyAuthorizedModule
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User address |
| `amount` | `uint256` | Amount to add to current hour |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule`

**Events Emitted:**
```solidity
event HourlyWithdrawnIncremented(
    address indexed user,
    uint256 hour,
    uint256 amount
)
```

**Gas Cost:** ~35,000 gas

**Note:** Legacy function - prefer using new rate limiting system

---

### setModuleParameter {#proxygeneral-setmoduleparameter}

Sets a shared parameter accessible to all modules.

**Signature:**
```solidity
function setModuleParameter(string memory parameterName, uint256 value) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter identifier |
| `value` | `uint256` | Parameter value |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Gas Cost:** ~25,000 gas

**Usage Example:**
```solidity
// Set shared configuration
proxy.setModuleParameter("maxSlippage", 500); // 5% = 500 basis points
```

**Use Cases:**
- Cross-module configuration sharing
- Dynamic parameter updates without redeployment

---

### getModuleParameter {#proxygeneral-getmoduleparameter}

Gets a shared parameter value.

**Signature:**
```solidity
function getModuleParameter(string memory parameterName) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter identifier |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Parameter value (0 if not set) |

**Access Control:** `public view`

**Gas Cost:** ~2,000 gas

**Usage Example:**
```solidity
uint256 maxSlippage = proxy.getModuleParameter("maxSlippage");
```

---

> **✅ ProxyGeneral Module Complete (26/26 functions documented)**

---

## 🎯 TokenManager {#tokenmanager}

**Purpose:** Token registry with oracle modularity via IOracleAdapter interface  
**Inheritance:** `Ownable`  
**Dependencies:** Beacon (for WETH resolution), IOracleAdapter (pluggable oracle provider)  
**Architecture:** Supports multiple oracle providers (Chainlink, Pyth, etc.) via adapter pattern

### Module Functions Overview

**Oracle Adapter Management:**
- [setOracleAdapter](#tokenmanager-setoracleadapter) - Switch oracle provider

**Token Management:**
- [manageTokenData](#tokenmanager-managetokendata) - Add/update token (new signature)
- [manageTokenData (legacy)](#tokenmanager-managetokendata-legacy) - Add/update token (legacy overload)
- [removeToken](#tokenmanager-removetoken) - Remove token from registry
- [updateHeartbeat](#tokenmanager-updateheartbeat) - Update heartbeat duration

**Price Feeds:**
- [getTokenPrice](#tokenmanager-gettokenprice) - Get token price via oracle
- [getTokenPriceWithEvents](#tokenmanager-gettokenpricewithevents) - Get price with error tracking

**Token Information:**
- [getTokenCount](#tokenmanager-gettokencount) - Get total token count
- [getActiveTokens](#tokenmanager-getactivetokens) - Get array of active tokens
- [isTokenActive](#tokenmanager-istokenactive) - Check if token is active
- [getTokenAddress](#tokenmanager-gettokenaddress) - Get token contract address
- [getTokenInfo](#tokenmanager-gettokeninfo) - Get complete TokenInfo struct
- [getTokenPriceForModule](#tokenmanager-gettokenpriceformodule) - Get price (legacy interface)
- [getPriceDecimals](#tokenmanager-getpricedecimals) - Get oracle price decimals
- [validatePriceFeed](#tokenmanager-validatepricefeed) - Validate price feed working

**Error Management:**
- [getTokenErrors](#tokenmanager-gettokenerrors) - Get error count
- [resetTokenErrors](#tokenmanager-resettokenerrors) - Reset error count
- [setMaxErrors](#tokenmanager-setmaxerrors) - Set error threshold
- [setMaxTokensPerOperation](#tokenmanager-setmaxtokensperoperation) - Set max tokens limit

---

### setOracleAdapter {#tokenmanager-setoracleadapter}

Switches the oracle adapter to a new implementation. **Core feature for oracle modularity**.

**Signature:**
```solidity
function setOracleAdapter(address _newAdapter) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_newAdapter` | `address` | Address of new IOracleAdapter implementation |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ `_newAdapter` must be non-zero address
- ❌ Reverts with `"Invalid adapter address"` if _newAdapter == address(0)

**Events Emitted:**
```solidity
event OracleAdapterUpdated(
    address indexed oldAdapter,
    address indexed newAdapter
)
```

**Gas Cost:** ~30,000 gas

**Usage Example:**
```solidity
// Switch from Chainlink to Pyth oracle
address pythAdapter = address(new PythOracleAdapter(pythAddress));
tokenManager.setOracleAdapter(pythAdapter);
```

**Use Cases:**
- Migrate from Chainlink to Pyth Network
- Update oracle implementation for new features
- Emergency oracle provider switch

**Security Notes:**
- ⚠️ **CRITICAL**: All tokens must be supported by new adapter
- Validate new adapter thoroughly before switching
- Consider using timelock for production changes

---

### manageTokenData {#tokenmanager-managetokendata}

Adds or updates a token in the registry (NEW signature - oracle modularity).

**Signature:**
```solidity
function manageTokenData(
    string memory _tokenCode,
    address _tokenAddress,
    uint8 _tokenDecimals,
    uint256 _heartbeat
) external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token identifier (1-16 chars, e.g., "USDC", "ARB") |
| `_tokenAddress` | `address` | ERC20 token contract address |
| `_tokenDecimals` | `uint8` | Token decimals (6 for USDC, 18 for most tokens) |
| `_heartbeat` | `uint256` | Max seconds between price updates |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ `_tokenCode` must be 1-16 characters
- ✅ `_tokenAddress` must be non-zero
- ✅ `_heartbeat` must be greater than 0
- ✅ Token must be supported by current oracle adapter
- ✅ `_tokenAddress` cannot be WETH (WETH handled separately via Beacon)
- ✅ Total token count must not exceed `maxTokensPerOperation`
- ❌ Reverts with `"Invalid token code"` if code empty or > 16 chars
- ❌ Reverts with `"Invalid token address"` if address == address(0)
- ❌ Reverts with `"Invalid heartbeat"` if heartbeat == 0
- ❌ Reverts with `"Token not supported by oracle"` if oracle doesn't support token
- ❌ Reverts with `"Cannot add WETH as token"` if trying to add WETH
- ❌ Reverts with `"Too many tokens"` if limit exceeded

**Events Emitted:**
```solidity
event TokenAdded(
    string indexed tokenCode,
    address tokenAddress,
    address oracleAdapter
)
```

**Gas Cost:** ~80,000 gas (new token), ~50,000 gas (update existing)

**Usage Example:**
```solidity
// Add USDC (6 decimals, 1 hour heartbeat)
tokenManager.manageTokenData(
    "USDC",
    0xaf88d065e77c8cC2239327C5EDb3A432268e5831, // Arbitrum USDC
    6,
    3600 // 1 hour
);

// Add ARB (18 decimals, 30 min heartbeat)
tokenManager.manageTokenData(
    "ARB",
    0x912CE59144191C1204E64559FE8253a0e49E6548, // Arbitrum ARB
    18,
    1800 // 30 minutes
);
```

**Security Notes:**
- Oracle adapter MUST support token before calling this
- WETH exclusion prevents double custody (WETH handled via Beacon)
- Heartbeat determines staleness threshold
- Resets error count on update

---

### manageTokenData (legacy) {#tokenmanager-managetokendata-legacy}

Adds or updates a token (LEGACY signature - backward compatibility).

**Signature:**
```solidity
function manageTokenData(
    string memory _tokenCode,
    address _tokenAddress,
    address /* _priceFeed */,
    uint8 _tokenDecimals,
    uint8 /* _priceFeedDecimals */,
    uint256 _heartbeat
) external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token identifier |
| `_tokenAddress` | `address` | ERC20 token contract address |
| `_priceFeed` | `address` | **IGNORED** (kept for backward compatibility) |
| `_tokenDecimals` | `uint8` | Token decimals |
| `_priceFeedDecimals` | `uint8` | **IGNORED** (oracle adapter handles this) |
| `_heartbeat` | `uint256` | Max seconds between price updates |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Note:** This is a legacy overload kept for backward compatibility with old deployment scripts. Price feed parameters are **IGNORED** - the oracle adapter handles all price feed configuration.

**Usage Example:**
```solidity
// OLD CODE (still works):
tokenManager.manageTokenData(
    "USDC",
    usdcAddress,
    chainlinkUsdcFeed, // IGNORED
    6,
    8, // IGNORED
    3600
);

// RECOMMENDED: Use new signature without price feed params
tokenManager.manageTokenData("USDC", usdcAddress, 6, 3600);
```

---

### removeToken {#tokenmanager-removetoken}

Removes a token from the registry.

**Signature:**
```solidity
function removeToken(string memory _tokenCode) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to remove |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Token must currently be active
- ❌ Reverts with `"Token not active"` if token not found or already removed

**Events Emitted:**
```solidity
event TokenRemoved(
    string indexed tokenCode
)
```

**Gas Cost:** ~60,000 gas (includes array element removal)

**Usage Example:**
```solidity
// Remove token from pool
tokenManager.removeToken("USDC");
```

**Security Notes:**
- Marks token as inactive
- Removes from tokenCodes array (swap and pop pattern)
- Decrements tokenCodesCount
- Cannot be called while token is actively used in positions

---

### updateHeartbeat {#tokenmanager-updateheartbeat}

Updates the heartbeat duration for a token's price feed.

**Signature:**
```solidity
function updateHeartbeat(string memory _tokenCode, uint256 _newHeartbeat) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to update |
| `_newHeartbeat` | `uint256` | New heartbeat in seconds |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ `_newHeartbeat` must be greater than 0
- ✅ Token must be active
- ❌ Reverts with `"Invalid heartbeat"` if _newHeartbeat == 0
- ❌ Reverts with `"Token not active"` if token not found

**Events Emitted:**
```solidity
event HeartbeatUpdated(
    string indexed tokenCode,
    uint256 newHeartbeat
)
```

**Gas Cost:** ~25,000 gas

**Usage Example:**
```solidity
// Increase heartbeat to 2 hours for stable token
tokenManager.updateHeartbeat("USDC", 7200);

// Decrease heartbeat to 15 minutes for volatile token
tokenManager.updateHeartbeat("ARB", 900);
```

---

### getTokenPrice {#tokenmanager-gettokenprice}

Gets the latest price for a token via oracle adapter.

**Signature:**
```solidity
function getTokenPrice(string memory _tokenCode)
    public view
    returns (
        uint256 price,
        uint256 updatedAt,
        bool isStale
    )
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to query |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `price` | `uint256` | Current price from oracle (in oracle's decimals) |
| `updatedAt` | `uint256` | Timestamp of last price update |
| `isStale` | `bool` | Always false (reverts if stale) |

**Access Control:** `public view`

**Validations:**
- ✅ Token must be active
- ✅ Oracle must return valid (non-stale) price
- ❌ Reverts with `"Token not active"` if token not found
- ❌ Reverts with `IOracleAdapter.StalePrice` if price is stale

**Gas Cost:** ~8,000 gas (oracle call + validations)

**Usage Example:**
```solidity
(uint256 price, uint256 timestamp, bool stale) = 
    tokenManager.getTokenPrice("USDC");

console.log("USDC price:", price); // e.g., 1000000 (8 decimals)
console.log("Updated at:", timestamp);
// stale is always false here (reverts if true)
```

**Called By:** ValueCalculator, SwapManager, monitoring tools

**Security Notes:**
- **REVERTS** if price is stale (no silent failures)
- Delegates to oracle adapter for actual price fetch
- Interface unchanged from previous versions (backward compatibility)

---

### getTokenPriceWithEvents {#tokenmanager-gettokenpricewithevents}

Gets token price with error tracking and event emission.

**Signature:**
```solidity
function getTokenPriceWithEvents(string memory _tokenCode)
    public
    returns (uint256 price, uint256 updatedAt)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to query |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `price` | `uint256` | Current price from oracle |
| `updatedAt` | `uint256` | Timestamp of last price update |

**Access Control:** `public` (non-view, modifies error tracking)

**Behavior:**
- ✅ On success: Updates tokenData storage, resets error count, returns price
- ❌ On failure: Increments error count, emits events, reverts

**Events Emitted (on success):**
```solidity
event TokenErrorsReset(string indexed tokenCode) // If errors > 0
```

**Events Emitted (on failure):**
```solidity
event TokenError(string indexed tokenCode, string errorMessage)
event ErrorThresholdReached(string indexed tokenCode) // If errors >= maxErrors
```

**Events Emitted (if stale):**
```solidity
event PriceStale(string indexed tokenCode, uint256 lastUpdateTime)
```

**Gas Cost:** ~35,000 gas (includes storage writes)

**Usage Example:**
```solidity
try tokenManager.getTokenPriceWithEvents("ARB") returns (uint256 price, uint256 timestamp) {
    // Price retrieved successfully
    console.log("ARB price:", price);
} catch {
    // Error tracked and emitted
    console.log("ARB price fetch failed");
}
```

**Called By:** ValueCalculator (for state-changing price fetches)

**Security Notes:**
- Tracks errors in storage (tokenErrors mapping)
- Emits ErrorThresholdReached for monitoring alerts
- Automatically resets error count on successful fetch

---

### getTokenCount {#tokenmanager-gettokencount}

Returns the number of tokens in the registry.

**Signature:**
```solidity
function getTokenCount() 
    external view 
    returns (uint256)
```

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Total number of tokens (active and inactive) |

**Access Control:** `public view`

**Gas Cost:** ~1,000 gas

**Usage Example:**
```solidity
uint256 totalTokens = tokenManager.getTokenCount();
console.log("Total tokens:", totalTokens);
```

---

### getActiveTokens {#tokenmanager-getactivetokens}

Returns array of all active token codes.

**Signature:**
```solidity
function getActiveTokens() 
    external view 
    returns (string[] memory)
```

**Returns:**
| Type | Description |
|------|-------------|
| `string[]` | Array of active token codes |

**Access Control:** `public view`

**Gas Cost:** ~5,000 + (n * 1,500) gas where n = number of tokens

**Usage Example:**
```solidity
string[] memory tokens = tokenManager.getActiveTokens();
for (uint i = 0; i < tokens.length; i++) {
    console.log("Token:", tokens[i]);
}
```

**Called By:** ValueCalculator.getTotalPoolValue(), admin dashboards

---

### isTokenActive {#tokenmanager-istokenactive}

Checks if a token is currently active.

**Signature:**
```solidity
function isTokenActive(string memory _tokenCode) 
    external view 
    returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to check |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if token is active, false otherwise |

**Access Control:** `public view`

**Gas Cost:** ~2,000 gas

**Usage Example:**
```solidity
if (tokenManager.isTokenActive("USDC")) {
    // USDC is available for operations
}
```

**Called By:** SwapManager, LiquidityManager

---

### getTokenAddress {#tokenmanager-gettokenaddress}

Returns the contract address for a token.

**Signature:**
```solidity
function getTokenAddress(string memory _tokenCode) 
    external view 
    returns (address)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to query |

**Returns:**
| Type | Description |
|------|-------------|
| `address` | ERC20 token contract address |

**Access Control:** `public view`

**Validations:**
- ✅ Token must be active
- ❌ Reverts with `"Token not active"` if token not found

**Gas Cost:** ~3,000 gas

**Usage Example:**
```solidity
address usdcAddress = tokenManager.getTokenAddress("USDC");
IERC20 usdc = IERC20(usdcAddress);
```

**Called By:** ProxyGeneral, SwapManager

---

### getTokenInfo {#tokenmanager-gettokeninfo}

Returns complete TokenInfo struct for a token.

**Signature:**
```solidity
function getTokenInfo(string memory _tokenCode) 
    external view 
    returns (TokenInfo memory)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to query |

**Returns:**
| Type | Description |
|------|-------------|
| `TokenInfo` | Complete token information struct |

**TokenInfo Struct:**
```solidity
struct TokenInfo {
    address tokenAddress;
    uint8 tokenDecimals;
    string tokenCode;
    bool isActive;
    uint256 lastPriceTimestamp;
    uint256 lastPrice;
    uint256 heartbeat;
    uint256 errorCount;
}
```

**Access Control:** `public view`

**Validations:**
- ✅ Token must be active
- ❌ Reverts with `"Token not active"` if token not found

**Gas Cost:** ~5,000 gas

**Usage Example:**
```solidity
ITokenManagerForModules.TokenInfo memory info = 
    tokenManager.getTokenInfo("USDC");

console.log("Address:", info.tokenAddress);
console.log("Decimals:", info.tokenDecimals);
console.log("Last price:", info.lastPrice);
console.log("Error count:", info.errorCount);
```

**Called By:** ProxyGeneral (withdrawToken, depositToken), ValueCalculator

---

### getTokenPriceForModule {#tokenmanager-gettokenpriceformodule}

Gets token price (legacy interface for modules).

**Signature:**
```solidity
function getTokenPriceForModule(string memory _tokenCode) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to query |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Current token price |

**Access Control:** `public view`

**Gas Cost:** ~8,000 gas

**Usage Example:**
```solidity
uint256 price = tokenManager.getTokenPriceForModule("ARB");
```

**Note:** Wrapper around getTokenPrice() - kept for backward compatibility

---

### getPriceDecimals {#tokenmanager-getpricedecimals}

Gets the decimals used by the oracle for price values.

**Signature:**
```solidity
function getPriceDecimals(string memory _tokenCode) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to query |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Decimals used by oracle (e.g., 8 for Chainlink) |

**Access Control:** `public view`

**Validations:**
- ✅ Token must be active
- ❌ Reverts with `"Token not active"` if token not found

**Gas Cost:** ~5,000 gas

**Usage Example:**
```solidity
uint256 decimals = tokenManager.getPriceDecimals("USDC");
// Returns 8 for Chainlink (price in 1e8 format)
```

**Called By:** ValueCalculator (for decimal conversion)

---

### validatePriceFeed {#tokenmanager-validatepricefeed}

Validates that a token's price feed is working correctly.

**Signature:**
```solidity
function validatePriceFeed(string memory _tokenCode) 
    external view 
    returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to validate |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if price feed is working, false otherwise |

**Access Control:** `public view`

**Gas Cost:** ~10,000 gas (includes try-catch)

**Usage Example:**
```solidity
if (!tokenManager.validatePriceFeed("ARB")) {
    console.log("WARNING: ARB price feed not working");
}
```

**Use Cases:**
- Pre-operation validation
- Health checks
- Monitoring systems

---

### getTokenErrors {#tokenmanager-gettokenerrors}

Returns the error count for a token.

**Signature:**
```solidity
function getTokenErrors(string memory _tokenCode) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to query |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Number of consecutive errors |

**Access Control:** `public view`

**Gas Cost:** ~2,000 gas

**Usage Example:**
```solidity
uint256 errors = tokenManager.getTokenErrors("ARB");
if (errors >= 3) {
    console.log("ARB has too many errors");
}
```

---

### resetTokenErrors {#tokenmanager-resettokenerrors}

Resets the error count for a token.

**Signature:**
```solidity
function resetTokenErrors(string memory _tokenCode) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token code to reset |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Events Emitted:**
```solidity
event TokenErrorsReset(
    string indexed tokenCode
)
```

**Gas Cost:** ~30,000 gas

**Usage Example:**
```solidity
// After fixing oracle issue
tokenManager.resetTokenErrors("ARB");
```

---

### setMaxErrors {#tokenmanager-setmaxerrors}

Sets the maximum error threshold before alerts.

**Signature:**
```solidity
function setMaxErrors(uint256 _maxErrors) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_maxErrors` | `uint256` | New maximum errors (1-100) |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ `_maxErrors` must be 1-100
- ❌ Reverts with `"Invalid max errors"` if out of range

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
// Set threshold to 5 errors
tokenManager.setMaxErrors(5);
```

---

### setMaxTokensPerOperation {#tokenmanager-setmaxtokensperoperation}

Sets the maximum number of tokens allowed in the registry.

**Signature:**
```solidity
function setMaxTokensPerOperation(uint256 _maxTokens) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_maxTokens` | `uint256` | New maximum tokens (1-50) |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ `_maxTokens` must be 1-50
- ❌ Reverts with `"Invalid max tokens"` if out of range

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
// Allow up to 20 tokens
tokenManager.setMaxTokensPerOperation(20);
```

---

> **✅ TokenManager Module Complete (19/19 functions documented)**

---

## 📊 ValueCalculator {#valuecalculator}

**Purpose:** Pool valuation engine with intelligent caching and token selection strategies  
**Inheritance:** `Ownable`  
**Dependencies:** Beacon, TokenManager, ProxyGeneral, WETH  
**Architecture:** Cache-first strategy for gas optimization, error tracking per token

### Module Functions Overview

**Token Value Calculation:**
- [calculateTokenValue](#valuecalculator-calculatetokenvalue) - Calculate token value with caching
- [calculateTokenValueView](#valuecalculator-calculatetokenvalueview) - View-only value calculation
- [getTotalPoolValue](#valuecalculator-gettotalpoolvalue) - Get complete pool breakdown
- [getTotalPoolValueView](#valuecalculator-gettotalpoolvalueview) - View-only total value

**Token Selection:**
- [selectTokenForSwap](#valuecalculator-selecttokenforswap) - Smart token selection for swaps

**Cache Management:**
- [getCachedTokenValue](#valuecalculator-getcachedtokenvalue) - Get cached value if valid
- [getCachedTokenPrice](#valuecalculator-getcachedtokenprice) - Get cached price if valid
- [invalidateCache](#valuecalculator-invalidatecache) - Invalidate single token cache
- [invalidateAllCache](#valuecalculator-invalidateallcache) - Clear entire cache

**Utility Functions:**
- [getTokenValueInfo](#valuecalculator-gettokenvalueinfo) - Get detailed token info
- [validatePoolValue](#valuecalculator-validatepoolvalue) - Validate pool state

**Parameter Management:**
- [setCacheDuration](#valuecalculator-setcacheduration) - Set cache TTL
- [setMaxPriceAge](#valuecalculator-setmaxpriceage) - Set price staleness threshold
- [setMaxErrors](#valuecalculator-setmaxerrors) - Set error threshold

---

### calculateTokenValue {#valuecalculator-calculatetokenvalue}

Calculates token value with intelligent caching to optimize gas costs.

**Signature:**
```solidity
function calculateTokenValue(string memory _tokenCode) 
    public 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token identifier |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Total position value in USD (oracle decimals, typically 1e8) |

**Access Control:** `public` (non-view, updates cache)

**Validations:**
- ✅ Token must be active in TokenManager
- ✅ Price must not be stale
- ✅ Price timestamp must be within maxPriceAge
- ❌ Reverts with `"Price too old"` if timestamp too old
- ❌ Reverts with `"Value calculation failed for {token}: {reason}"` on errors

**Events Emitted (on success):**
```solidity
event CacheUpdated(
    string indexed tokenCode,
    uint256 value,
    uint256 pricePerToken
)
```

**Events Emitted (on error):**
```solidity
event TokenError(string indexed tokenCode, string errorMessage)
event ErrorThresholdReached(string indexed tokenCode) // If errors >= maxErrors
```

**Gas Cost:** 
- ~3,000 gas (cache hit)
- ~45,000 gas (cache miss, includes TokenManager calls + storage writes)

**Formula:**
```solidity
value = (tokenBalance * price) / (10 ** tokenDecimals)
```

**Usage Example:**
```solidity
// Get USDC value (updates cache)
uint256 usdcValue = valueCalculator.calculateTokenValue("USDC");
// Returns: 1000e8 (if 1000 USDC in pool, Chainlink 8 decimals)
```

**Called By:** LiquidityManager, getTotalPoolValue()

**Security Notes:**
- Cache-first strategy saves gas on repeated calls
- Cache duration: 5 minutes default (configurable)
- Automatic error tracking and threshold alerts
- Resets error count on successful calculation

---

### calculateTokenValueView {#valuecalculator-calculatetokenvalueview}

View-only version of calculateTokenValue (no cache updates or events).

**Signature:**
```solidity
function calculateTokenValueView(string memory _tokenCode) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token identifier |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Position value in USD (oracle decimals) |

**Access Control:** `public view`

**Validations:**
- ✅ Token must be active
- ✅ Price must be reliable (not stale)
- ❌ Reverts with `"Price not reliable"` if stale

**Gas Cost:** ~8,000 gas (no storage writes)

**Usage Example:**
```solidity
// Check value without updating state
uint256 value = valueCalculator.calculateTokenValueView("ARB");
```

**Use Cases:**
- Pre-operation value checks
- Off-chain monitoring
- Gas-efficient value queries

---

### getTotalPoolValue {#valuecalculator-gettotalpoolvalue}

Calculates total pool value with complete breakdown per token and percentages.

**Signature:**
```solidity
function getTotalPoolValue() 
    external 
    returns (PoolValueInfo memory)
```

**Returns:**
| Type | Description |
|------|-------------|
| `PoolValueInfo` | Complete pool value breakdown |

**PoolValueInfo Struct:**
```solidity
struct PoolValueInfo {
    uint256 totalValue;                    // Total pool value in USD
    TokenValueInfo[] tokenValues;          // Array of token info
}

struct TokenValueInfo {
    string tokenCode;
    uint256 value;          // Position value in USD
    uint256 balance;        // Token balance in custody
    uint256 pricePerToken;  // Price per token
    uint256 percentage;     // Percentage in basis points (10000 = 100%)
}
```

**Access Control:** `public`

**Behavior:**
- Calculates WETH value (always index 0 in array)
- Iterates through all active tokens from TokenManager
- For each token: calls calculateTokenValue() to update cache
- Calculates percentages in basis points (10000 = 100%)
- Continues even if individual tokens fail (logs errors)

**Events Emitted:**
```solidity
event PoolValueUpdated(uint256 totalValue)
event CacheUpdated(...) // For each successful token
event TokenError(...) // For each failed token
```

**Gas Cost:** ~100,000 + (n * 45,000) gas where n = number of tokens

**Usage Example:**
```solidity
PoolValueInfo memory poolInfo = valueCalculator.getTotalPoolValue();

console.log("Total pool value:", poolInfo.totalValue);
console.log("Number of positions:", poolInfo.tokenValues.length);

for (uint i = 0; i < poolInfo.tokenValues.length; i++) {
    TokenValueInfo memory token = poolInfo.tokenValues[i];
    console.log("Token:", token.tokenCode);
    console.log("Value:", token.value);
    console.log("Percentage:", token.percentage / 100, "%");
}
```

**Called By:** LiquidityManager (deposit/withdraw calculations), monitoring dashboards

**Security Notes:**
- Always includes WETH as first element
- Graceful degradation: failed tokens get zero value but don't break calculation
- Percentages always sum to 10000 (100%)

---

### getTotalPoolValueView {#valuecalculator-gettotalpoolvalueview}

View-only version of total pool value (no cache updates).

**Signature:**
```solidity
function getTotalPoolValueView() 
    external view 
    returns (uint256)
```

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Total pool value in USD |

**Access Control:** `public view`

**Gas Cost:** ~15,000 + (n * 8,000) gas where n = number of tokens

**Usage Example:**
```solidity
// Quick value check
uint256 totalValue = valueCalculator.getTotalPoolValueView();
```

**Use Cases:**
- Pre-operation validation
- Gas-efficient monitoring
- External integrations

---

### selectTokenForSwap {#valuecalculator-selecttokenforswap}

Intelligently selects token for swap based on portfolio diversification strategy.

**Signature:**
```solidity
function selectTokenForSwap(uint256 targetValue) 
    external view 
    returns (string memory tokenCode, uint256 amount)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `targetValue` | `uint256` | Target value to obtain from swap (in USD, oracle decimals) |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Selected token identifier |
| `amount` | `uint256` | Amount to swap (with 10% buffer) |

**Access Control:** `public view`

**Validations:**
- ✅ `targetValue` must be greater than 0
- ✅ Must have at least one active token with balance
- ✅ Selected token must have sufficient balance for target + 10% buffer
- ❌ Reverts with `"Target value must be positive"` if targetValue == 0
- ❌ Reverts with `"No swappable tokens"` if no active tokens
- ❌ Reverts with `"Pool has no value"` if totalPoolValue == 0
- ❌ Reverts with `"Insufficient liquidity"` if no valid tokens found
- ❌ Reverts with `"Insufficient liquidity for target value"` if no token has sufficient balance

**Strategy Logic:**
1. Gets all active tokens from TokenManager
2. Excludes WETH (swapping TO WETH, not FROM it)
3. Calculates each token's percentage in pool
4. Sorts tokens by percentage (ascending - lowest first)
5. Selects token with **lowest percentage** that has sufficient balance
6. Adds 10% buffer to amount for slippage protection

**Formula:**
```solidity
requiredAmount = (targetValue * 1.1 * 10^tokenDecimals) / pricePerToken
```

**Gas Cost:** ~30,000 + (n * 5,000) gas where n = number of tokens

**Usage Example:**
```solidity
// Need 1000 USD worth of WETH
(string memory tokenToSwap, uint256 amountToSwap) = 
    valueCalculator.selectTokenForSwap(1000e8); // 1000 USD in 8 decimals

console.log("Swap token:", tokenToSwap); // e.g., "USDC"
console.log("Amount:", amountToSwap); // e.g., 1100e6 (1100 USDC with 10% buffer)
```

**Called By:** LiquidityManager (automatic swaps during withdrawals)

**Security Notes:**
- Diversification strategy: prefers tokens with lower % of pool
- 10% buffer provides slippage protection
- Skips tokens with zero balance or stale prices
- Graceful fallback to next token if insufficient balance

---

### getCachedTokenValue {#valuecalculator-getcachedtokenvalue}

Returns cached token value if still valid (within TTL).

**Signature:**
```solidity
function getCachedTokenValue(string memory _tokenCode) 
    public view 
    returns (uint256 value, bool isValid)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token identifier |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `value` | `uint256` | Cached value (0 if invalid) |
| `isValid` | `bool` | True if cache is fresh |

**Access Control:** `public view`

**Cache Validity:**
- Cache is valid if: `block.timestamp - cache.timestamp <= cacheDuration`
- Default cacheDuration: 5 minutes

**Gas Cost:** ~2,000 gas

**Usage Example:**
```solidity
(uint256 value, bool valid) = valueCalculator.getCachedTokenValue("USDC");

if (valid) {
    console.log("Cached USDC value:", value);
} else {
    console.log("Cache expired, need fresh calculation");
}
```

---

### getCachedTokenPrice {#valuecalculator-getcachedtokenprice}

Returns cached token price if still valid.

**Signature:**
```solidity
function getCachedTokenPrice(string memory _tokenCode) 
    external view 
    returns (uint256 pricePerToken, bool isValid)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token identifier |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `pricePerToken` | `uint256` | Cached price (0 if invalid) |
| `isValid` | `bool` | True if cache is fresh |

**Access Control:** `public view`

**Gas Cost:** ~2,000 gas

**Usage Example:**
```solidity
(uint256 price, bool valid) = valueCalculator.getCachedTokenPrice("ARB");
```

---

### invalidateCache {#valuecalculator-invalidatecache}

Invalidates cache for a specific token.

**Signature:**
```solidity
function invalidateCache(string memory _tokenCode) 
    external 
    onlyAuthorized
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token to invalidate |

**Returns:** None (void)

**Access Control:** `onlyAuthorized` (owner, LiquidityManager, ProxyGeneral)

**Events Emitted:**
```solidity
event CacheCleared(
    string indexed tokenCode
)
```

**Gas Cost:** ~25,000 gas

**Usage Example:**
```solidity
// Force fresh price fetch on next calculation
valueCalculator.invalidateCache("USDC");
```

**Use Cases:**
- After known oracle updates
- Emergency price adjustments
- Testing/debugging

---

### invalidateAllCache {#valuecalculator-invalidateallcache}

Clears entire cache for all tokens.

**Signature:**
```solidity
function invalidateAllCache() 
    external 
    onlyOwner
```

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Events Emitted:**
```solidity
event CacheCleared(string indexed tokenCode) // For each token
```

**Gas Cost:** ~25,000 + (n * 10,000) gas where n = number of active tokens

**Usage Example:**
```solidity
// Full cache reset
valueCalculator.invalidateAllCache();
```

**Use Cases:**
- Oracle provider switch
- System-wide price updates
- Emergency situations

---

### getTokenValueInfo {#valuecalculator-gettokenvalueinfo}

Returns detailed information for a specific token.

**Signature:**
```solidity
function getTokenValueInfo(string memory _tokenCode) 
    external view 
    returns (TokenValueInfo memory)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_tokenCode` | `string` | Token identifier |

**Returns:**
| Type | Description |
|------|-------------|
| `TokenValueInfo` | Complete token information struct |

**TokenValueInfo Fields:**
- `tokenCode`: Token identifier
- `value`: Position value in USD
- `balance`: Token balance in custody
- `pricePerToken`: Current price
- `percentage`: Percentage of pool (basis points)

**Access Control:** `public view`

**Gas Cost:** ~10,000 gas

**Usage Example:**
```solidity
TokenValueInfo memory info = valueCalculator.getTokenValueInfo("ARB");

console.log("ARB balance:", info.balance);
console.log("ARB value:", info.value);
console.log("ARB percentage:", info.percentage / 100, "%");
```

**Use Cases:**
- Token analytics
- Portfolio dashboards
- Pre-operation checks

---

### validatePoolValue {#valuecalculator-validatepoolvalue}

Validates pool state and returns error details if invalid.

**Signature:**
```solidity
function validatePoolValue() 
    external view 
    returns (bool isValid, string memory errorReason)
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `isValid` | `bool` | True if pool is valid |
| `errorReason` | `string` | Error description (empty if valid) |

**Access Control:** `public view`

**Validation Checks:**
- Pool value must be greater than 0
- getTotalPoolValueView() must not revert

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
(bool valid, string memory reason) = valueCalculator.validatePoolValue();

if (!valid) {
    console.log("Pool invalid:", reason);
}
```

**Use Cases:**
- Pre-operation health checks
- Monitoring systems
- Emergency diagnostics

---

### setCacheDuration {#valuecalculator-setcacheduration}

Sets cache TTL duration.

**Signature:**
```solidity
function setCacheDuration(uint256 _cacheDuration) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_cacheDuration` | `uint256` | New cache duration in seconds |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Duration must be 1 minute to 1 hour
- ❌ Reverts with `"Invalid cache duration"` if out of range

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
// Set cache to 10 minutes
valueCalculator.setCacheDuration(10 minutes);
```

**Recommended Values:**
- High frequency trading: 1-2 minutes
- Normal operations: 5 minutes (default)
- Low frequency: 15-30 minutes

---

### setMaxPriceAge {#valuecalculator-setmaxpriceage}

Sets maximum acceptable price age threshold.

**Signature:**
```solidity
function setMaxPriceAge(uint256 _maxPriceAge) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_maxPriceAge` | `uint256` | New max age in seconds |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Age must be 5 minutes to 24 hours
- ❌ Reverts with `"Invalid max price age"` if out of range

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
// Set max age to 30 minutes
valueCalculator.setMaxPriceAge(30 minutes);
```

**Security Notes:**
- Lower values: more security, higher revert rate
- Higher values: more leniency, potential stale data risk

---

### setMaxErrors {#valuecalculator-setmaxerrors}

Sets error threshold for alert triggering.

**Signature:**
```solidity
function setMaxErrors(uint256 _maxErrors) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_maxErrors` | `uint256` | New error threshold (1-100) |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Errors must be 1-100
- ❌ Reverts with `"Invalid max errors"` if out of range

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
// Alert after 5 consecutive errors
valueCalculator.setMaxErrors(5);
```

---

> **✅ ValueCalculator Module Complete (14/14 functions documented)**

---

## 💰 LiquidityManager {#liquiditymanager}

**Purpose:** Manages deposits and withdrawals with comprehensive validations, MEV protection, and automatic swaps  
**Inheritance:** `ILiquidityManager`, `ReentrancyGuard`, `Ownable`  
**Dependencies:** Beacon, ProxyGeneral, TokenManager, ValueCalculator, SwapManager, ParameterManager, WETH  
**Architecture:** Fee system, rate limiting, sliding window limits, automatic swap execution

### Module Functions Overview

**Core Operations:**
- [deposit](#liquiditymanager-deposit) - Deposit ETH for LP tokens
- [withdraw](#liquiditymanager-withdraw) - Withdraw with auto-deadline (LEGACY)
- [withdrawWithDeadline](#liquiditymanager-withdrawwithdeadline) - Withdraw with MEV protection (NEW)

**Fee Management:**
- [setDepositFee](#liquiditymanager-setdepositfee) - Set deposit fee
- [setWithdrawFee](#liquiditymanager-setwithdrawfee) - Set withdraw fee
- [setFeeRecipient](#liquiditymanager-setfeerecipient) - Set fee recipient
- [setDepositsEnabled](#liquiditymanager-setdepositsenabled) - Enable/disable deposits
- [setWithdrawsEnabled](#liquiditymanager-setwithdrawsenabled) - Enable/disable withdrawals

**Withdraw Limits:**
- [setWithdrawLimits](#liquiditymanager-setwithdrawlimits) - Configure all limits
- [checkWithdrawLimits](#liquiditymanager-checkwithdrawlimits) - Validate limits
- [getRemainingHourlyLimit](#liquiditymanager-getremaining hourlylimit) - Get hourly capacity
- [getRemainingDailyLimit](#liquiditymanager-getremainingdailylimit) - Get daily capacity

**Interface Compliance:**
- [calculateDepositShares](#liquiditymanager-calculatedepositshares) - Calculate shares for deposit
- [calculateWithdrawAmount](#liquiditymanager-calculatewithdrawamount) - Calculate ETH for shares
- [canWithdraw](#liquiditymanager-canwithdraw) - Pre-check withdraw validity
- [getPoolStats](#liquiditymanager-getpoolstats) - Get pool statistics
- [validatePoolState](#liquiditymanager-validatepoolstate) - Validate pool health

**Rate Limiting Passthrough:**
- [checkWithdrawRateLimit](#liquiditymanager-checkwithdrawratelimit) - Check withdraw rate limit
- [checkDepositRateLimit](#liquiditymanager-checkdepositratelimit) - Check deposit rate limit
- [setRateLimit](#liquiditymanager-setratelimit) - Configure rate limits
- [getRateLimitInfo](#liquiditymanager-getratelimitinfo) - Get rate limit status

---

### deposit {#liquiditymanager-deposit}

Deposits ETH into the pool and receives LP tokens proportional to pool value.

**Signature:**
```solidity
function deposit() 
    external payable 
    nonReentrant 
    whenNotPaused 
    whenDepositsEnabled 
    returns (uint256 lpTokens)
```

**Parameters:** None (uses `msg.value` for ETH amount)

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Number of LP tokens minted |

**Access Control:** `public` (anyone can deposit)

**Validations:**
- ✅ System must not be paused
- ✅ Deposits must be enabled
- ✅ `msg.value` >= minDeposit (from ParameterManager)
- ✅ `msg.value` <= maxDeposit (from ParameterManager)
- ✅ Rate limit must not be exceeded
- ✅ Shares must be greater than 0
- ✅ Post-deposit supply and balance checks
- ❌ Reverts with `"Below minimum deposit"` if too small
- ❌ Reverts with `"Exceeds maximum deposit"` if too large
- ❌ Reverts with `"Rate limit exceeded for deposit operation"` if rate limited
- ❌ Reverts with `"Invalid pool state"` if pool value calculation fails
- ❌ Reverts with `"Deposit too small for current pool size"` if shares == 0
- ❌ Reverts with `"No shares to mint"` if shares calculation fails
- ❌ Reverts with validation errors on post-deposit checks

**Share Calculation Logic:**
```solidity
// Bootstrap (first deposit): 1:1 ratio
if (totalSupply == 0) {
    shares = netDeposit;
}

// Subsequent deposits: proportional to pool value
else {
    shares = (netDeposit * totalSupply) / totalPoolValue;
}
```

**Fee System:**
- Deposit fee deducted from `msg.value`
- Net deposit = `msg.value` - feeAmount
- Fee transferred to feeRecipient
- Shares calculated on net deposit

**Events Emitted:**
```solidity
event Deposit(
    address indexed user,
    uint256 ethAmount,
    uint256 lpTokens,
    uint256 newPoolEthBalance,
    uint256 newTotalSupply
)
```

**Gas Cost:** ~200,000 gas (includes WETH wrap, mint, rate limit tracking)

**Usage Example:**
```solidity
// Deposit 1 ETH
uint256 shares = liquidityManager.deposit{value: 1 ether}();

console.log("Received LP tokens:", shares);
```

**Called By:** Users directly

**Security Notes:**
- ReentrancyGuard protects against reentrancy
- Rate limiting prevents spam attacks
- Fee system transparent and configurable
- Comprehensive pre/post validations

---

### withdraw {#liquiditymanager-withdraw}

Withdraws ETH by burning LP tokens. **LEGACY** function with automatic 20-minute deadline.

**Signature:**
```solidity
function withdraw(uint256 _shares) 
    external 
    nonReentrant 
    whenNotPaused 
    whenWithdrawsEnabled 
    returns (uint256 ethAmount)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_shares` | `uint256` | Amount of LP tokens to burn |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Amount of ETH returned to user |

**Access Control:** `public`

**Note:** This function internally calls `_withdrawInternal()` with auto-deadline: `block.timestamp + 20 minutes`.

**Usage Example:**
```solidity
// Withdraw using 100 LP tokens (auto-deadline)
uint256 ethReceived = liquidityManager.withdraw(100 ether);
```

**Recommended:** Use `withdrawWithDeadline()` for explicit MEV protection control.

---

### withdrawWithDeadline {#liquiditymanager-withdrawwithdeadline}

Withdraws ETH with explicit deadline for MEV protection. **RECOMMENDED** function.

**Signature:**
```solidity
function withdrawWithDeadline(uint256 _shares, uint256 deadline) 
    external 
    nonReentrant 
    whenNotPaused 
    whenWithdrawsEnabled 
    returns (uint256 ethAmount)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `_shares` | `uint256` | Amount of LP tokens to burn |
| `deadline` | `uint256` | Unix timestamp deadline |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Amount of ETH returned to user |

**Access Control:** `public`

**Validations:**
- ✅ System must not be paused
- ✅ Withdrawals must be enabled
- ✅ `deadline` must be in the future
- ✅ `_shares` > 0 and <= user's balance
- ✅ `_shares` >= minWithdraw and <= maxWithdraw (per-transaction limits)
- ✅ User must have sufficient LP tokens
- ✅ Hourly and daily limits must not be exceeded
- ✅ Rate limits must not be exceeded
- ✅ Pool must have sufficient WETH or swappable tokens
- ❌ Reverts with `"Transaction too old"` if block.timestamp > deadline
- ❌ Reverts with `"No shares to withdraw"` if _shares == 0
- ❌ Reverts with `"Insufficient LP token balance"` if user balance too low
- ❌ Reverts with withdraw limit errors
- ❌ Reverts with rate limit errors
- ❌ Reverts with `"Insufficient liquidity"` if cannot fulfill withdrawal

**Withdrawal Flow:**
1. Validate deadline
2. Validate shares and user balance
3. Check withdraw limits (per-tx, hourly, daily)
4. Check rate limits
5. Calculate ETH amount (proportional to pool value)
6. Check if WETH balance sufficient
7. If insufficient: execute automatic swap from lowest % token
8. Unwrap WETH to ETH
9. Apply withdraw fee
10. Transfer net ETH to user
11. Burn LP tokens
12. Track operation for rate limiting

**Automatic Swap Logic:**
- Triggered if WETH balance < required amount
- Uses ValueCalculator.selectTokenForSwap() to find best token
- Swaps from token with lowest pool percentage
- Includes 10% buffer for slippage
- All swaps routed through SwapManager

**Fee System:**
- Withdraw fee deducted from ETH amount
- Net withdrawal = ethAmount - feeAmount
- Fee transferred to feeRecipient

**Events Emitted:**
```solidity
event Withdraw(
    address indexed user,
    uint256 lpTokens,
    uint256 ethAmount,
    uint256 remainingPoolEthBalance,
    uint256 remainingTotalSupply
)

// If automatic swap triggered:
event AutomaticSwapExecuted(
    address indexed user,
    string tokenSwapped,
    uint256 tokenAmount,
    uint256 wethReceived,
    uint256 timestamp
)
```

**Gas Cost:** 
- ~180,000 gas (no swap needed)
- ~350,000+ gas (with automatic swap)

**Usage Example:**
```solidity
// Withdraw 100 LP tokens with 10-minute deadline
uint256 deadline = block.timestamp + 10 minutes;
uint256 ethReceived = liquidityManager.withdrawWithDeadline(100 ether, deadline);

console.log("ETH received:", ethReceived);
```

**Security Notes:**
- ⚠️ **MEV PROTECTION**: Deadline prevents transaction delays
- Automatic swaps executed at best available price
- Comprehensive validations prevent edge cases
- ReentrancyGuard + whenNotPaused protection

---

### setDepositFee {#liquiditymanager-setdepositfee}

Sets the deposit fee in basis points.

**Signature:**
```solidity
function setDepositFee(uint256 newFee) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newFee` | `uint256` | New fee in basis points (10000 = 100%) |

**Validations:**
- ✅ `newFee` <= MAX_FEE (500 = 5%)
- ❌ Reverts with `"Fee exceeds maximum"` if too high

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
// Set 1% deposit fee
liquidityManager.setDepositFee(100); // 100 basis points = 1%
```

---

### setWithdrawFee {#liquiditymanager-setwithdrawfee}

Sets the withdrawal fee in basis points.

**Signature:**
```solidity
function setWithdrawFee(uint256 newFee) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newFee` | `uint256` | New fee in basis points (10000 = 100%) |

**Validations:**
- ✅ `newFee` <= MAX_FEE (500 = 5%)

**Gas Cost:** ~20,000 gas

---

### setFeeRecipient {#liquiditymanager-setfeerecipient}

Sets the address that receives collected fees.

**Signature:**
```solidity
function setFeeRecipient(address newRecipient) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newRecipient` | `address` | New fee recipient address |

**Validations:**
- ✅ `newRecipient` must be non-zero address

**Gas Cost:** ~20,000 gas

---

### setDepositsEnabled {#liquiditymanager-setdepositsenabled}

Enables or disables deposit operations.

**Signature:**
```solidity
function setDepositsEnabled(bool enabled) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `enabled` | `bool` | True to enable, false to disable |

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
// Temporarily disable deposits
liquidityManager.setDepositsEnabled(false);
```

---

### setWithdrawsEnabled {#liquiditymanager-setwithdrawsenabled}

Enables or disables withdrawal operations.

**Signature:**
```solidity
function setWithdrawsEnabled(bool enabled) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `enabled` | `bool` | True to enable, false to disable |

**Gas Cost:** ~20,000 gas

---

### setWithdrawLimits {#liquiditymanager-setwithdrawlimits}

Configures all withdrawal limits in a single transaction.

**Signature:**
```solidity
function setWithdrawLimits(
    uint256 hourlyLimit,
    uint256 dailyLimit,
    uint256 minWithdraw,
    uint256 maxWithdraw
) external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `hourlyLimit` | `uint256` | Max ETH per hour per user |
| `dailyLimit` | `uint256` | Max ETH per day per user |
| `minWithdraw` | `uint256` | Min ETH per transaction |
| `maxWithdraw` | `uint256` | Max ETH per transaction |

**Validations:**
- ✅ `hourlyLimit` <= `dailyLimit`
- ✅ `minWithdraw` <= `maxWithdraw`

**Gas Cost:** ~40,000 gas

**Usage Example:**
```solidity
liquidityManager.setWithdrawLimits(
    50 ether,    // 50 ETH per hour
    500 ether,   // 500 ETH per day
    0.01 ether,  // Min 0.01 ETH
    100 ether    // Max 100 ETH per tx
);
```

---

### checkWithdrawLimits {#liquiditymanager-checkwithdrawlimits}

Validates if a withdrawal amount is within all limits.

**Signature:**
```solidity
function checkWithdrawLimits(address user, uint256 amount) 
    public view 
    returns (bool allowed, string memory reason)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User address |
| `amount` | `uint256` | Proposed withdrawal amount |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `allowed` | `bool` | True if within limits |
| `reason` | `string` | Error description if not allowed |

**Gas Cost:** ~5,000 gas

**Usage Example:**
```solidity
(bool allowed, string memory reason) = 
    liquidityManager.checkWithdrawLimits(msg.sender, 10 ether);

if (!allowed) {
    console.log("Cannot withdraw:", reason);
}
```

---

### getRemainingHourlyLimit {#liquiditymanager-getremaininghourlyLimit}

Returns remaining hourly withdrawal capacity for a user.

**Signature:**
```solidity
function getRemainingHourlyLimit(address user) 
    external view 
    returns (uint256 remaining)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User address |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Remaining ETH capacity in current hour |

**Gas Cost:** ~3,000 gas

---

### getRemainingDailyLimit {#liquiditymanager-getremainingdailylimit}

Returns remaining daily withdrawal capacity for a user.

**Signature:**
```solidity
function getRemainingDailyLimit(address user) 
    external view 
    returns (uint256 remaining)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User address |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Remaining ETH capacity in current day |

**Gas Cost:** ~3,000 gas

---

### calculateDepositShares {#liquiditymanager-calculatedepositshares}

Calculates how many LP tokens would be received for a deposit.

**Signature:**
```solidity
function calculateDepositShares(uint256 ethAmount) 
    external view 
    returns (uint256 shares)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `ethAmount` | `uint256` | ETH amount to deposit |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Expected LP tokens (before fees) |

**Gas Cost:** ~10,000 gas

**Usage Example:**
```solidity
// Check shares before depositing
uint256 expectedShares = liquidityManager.calculateDepositShares(1 ether);
console.log("Will receive ~", expectedShares, "LP tokens");
```

---

### calculateWithdrawAmount {#liquiditymanager-calculatewithdrawamount}

Calculates how much ETH would be received for burning LP tokens.

**Signature:**
```solidity
function calculateWithdrawAmount(uint256 lpTokens) 
    external view 
    returns (uint256 ethAmount)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `lpTokens` | `uint256` | LP tokens to burn |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Expected ETH amount (before fees) |

**Gas Cost:** ~10,000 gas

---

### canWithdraw {#liquiditymanager-canwithdraw}

Pre-validates if a withdrawal would succeed.

**Signature:**
```solidity
function canWithdraw(address user, uint256 shares) 
    external view 
    returns (bool isAllowed, string memory errorReason)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User address |
| `shares` | `uint256` | LP tokens to withdraw |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `isAllowed` | `bool` | True if withdrawal would succeed |
| `errorReason` | `string` | Error description if not allowed |

**Gas Cost:** ~15,000 gas

**Usage Example:**
```solidity
(bool can, string memory why) = liquidityManager.canWithdraw(msg.sender, 100 ether);

if (!can) {
    revert(why);
}
```

---

### getPoolStats {#liquiditymanager-getpoolstats}

Returns comprehensive pool statistics.

**Signature:**
```solidity
function getPoolStats() 
    external view 
    returns (
        uint256 totalValueLocked,
        uint256 totalSupply,
        uint256 wethBalance,
        uint256 sharePrice
    )
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `totalValueLocked` | `uint256` | Total pool value in USD |
| `totalSupply` | `uint256` | Total LP tokens in circulation |
| `wethBalance` | `uint256` | WETH balance in custody |
| `sharePrice` | `uint256` | Price per LP token (in USD) |

**Gas Cost:** ~20,000 gas

---

### validatePoolState {#liquiditymanager-validatepoolstate}

Validates pool health and consistency.

**Signature:**
```solidity
function validatePoolState() 
    external view 
    returns (bool isValid, string memory errorReason)
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `isValid` | `bool` | True if pool is healthy |
| `errorReason` | `string` | Error description if invalid |

**Gas Cost:** ~25,000 gas

---

### checkWithdrawRateLimit {#liquiditymanager-checkwithdrawratelimit}

Checks if withdraw operation is within rate limits (passthrough to ProxyGeneral).

**Signature:**
```solidity
function checkWithdrawRateLimit(address user, uint256 amount) 
    external view 
    returns (bool allowed, uint256 remainingHourly, uint256 remainingDaily)
```

**Gas Cost:** ~6,000 gas

---

### checkDepositRateLimit {#liquiditymanager-checkdepositratelimit}

Checks if deposit operation is within rate limits (passthrough to ProxyGeneral).

**Signature:**
```solidity
function checkDepositRateLimit(address user, uint256 amount) 
    external view 
    returns (bool allowed, uint256 remainingHourly, uint256 remainingDaily)
```

**Gas Cost:** ~6,000 gas

---

### setRateLimit {#liquiditymanager-setratelimit}

Configures rate limits (passthrough to ProxyGeneral).

**Signature:**
```solidity
function setRateLimit(string memory operationType, uint256 hourlyLimit, uint256 dailyLimit) 
    external 
    onlyOwner
```

**Gas Cost:** ~65,000 gas (ProxyGeneral call)

---

### getRateLimitInfo {#liquiditymanager-getratelimitinfo}

Gets rate limit status for a user (passthrough to ProxyGeneral).

**Signature:**
```solidity
function getRateLimitInfo(address user, string memory operationType) 
    external view 
    returns (
        uint256 hourlyLimit,
        uint256 dailyLimit,
        uint256 hourlyUsed,
        uint256 dailyUsed
    )
```

**Gas Cost:** ~8,000 gas

---

> **✅ LiquidityManager Module Complete (21/21 functions documented)**

---

## 🔄 SwapManager {#swapmanager}

**Purpose:** DEX integration with multi-plugin architecture, MEV protection, and intelligent routing  
**Inheritance:** `ISwapManager`, `Ownable`, `ReentrancyGuard`  
**Dependencies:** Beacon, TokenManager, ProxyGeneral, swap plugins (Uniswap V3, etc.)  
**Architecture:** Phase 1B multi-plugin system with best-price selection, MEV deadline protection

### Module Functions Overview

**Main Swap Functions:**
- [performSwap](#swapmanager-performswap) - Execute swap with deadline (MEV protected)
- [performSwapAuto](#swapmanager-performswapauto) - Execute swap with auto-deadline
- [swapWithBestPlugin](#swapmanager-swapwithbestplugin) - Multi-plugin best price selection (Phase 1B)

**Validation:**
- [validateSwapParameters](#swapmanager-validateswapparameters) - Validate swap params
- [canSwap](#swapmanager-canswap) - Pre-check if swap possible
- [validateSwapParams](#swapmanager-validateswapparams) - Comprehensive validation

**Quote & Price:**
- [getExpectedSwapOutput](#swapmanager-getexpectedswapoutput) - Get expected output
- [getSwapQuote](#swapmanager-getswapquote) - Get quote for amount
- [calculateMinAmountOut](#swapmanager-calculateminamountout) - Calculate min with slippage
- [getTokenWETHPrice](#swapmanager-gettokenwethprice) - Get token price vs WETH
- [estimateSwapGas](#swapmanager-estimateswapgas) - Estimate gas cost

**Multi-Plugin System (Phase 1B):**
- [getAllQuotes](#swapmanager-getallquotes) - Query all registered plugins

**Statistics:**
- [getSwapStats](#swapmanager-getswapstats) - Get success/error counts
- [resetSwapStats](#swapmanager-resetswapstats) - Reset statistics

**Admin Functions:**
- [setSwapLimits](#swapmanager-setswaplimits) - Set min/max limits
- [setMaxSlippage](#swapmanager-setmaxslippage) - Set slippage tolerance
- [setSimpleSwapRouter](#swapmanager-setsimpleswaprouter) - Set router (DEPRECATED)
- [setActiveSwapPlugin](#swapmanager-setactiveswapplugin) - Set active plugin (Phase 1A)
- [setSwapsEnabled](#swapmanager-setswapsenabled) - Enable/disable swaps
- [setDefaultDeadlineWindow](#swapmanager-setdefaultdeadlinewindow) - Set auto-deadline window
- [getDefaultDeadlineWindow](#swapmanager-getdefaultdeadlinewindow) - Get deadline window

**Interface Compliance:**
- [getSimpleSwapRouter](#swapmanager-getsimpleswaprouter) - Get router address
- [areSwapsEnabled](#swapmanager-areswapsenabled) - Check if enabled
- [emergencyTokenRecovery](#swapmanager-emergencytokenrecovery) - Emergency recovery

---

### performSwap {#swapmanager-performswap}

Executes token swap with explicit deadline for MEV protection. **PRIMARY SWAP FUNCTION**.

**Signature:**
```solidity
function performSwap(
    string memory spendToken,
    string memory receiveToken,
    uint256 amountIn,
    uint256 deadline
) public nonReentrant returns (uint256 amountOut)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `spendToken` | `string` | Token code to sell ("USDC", "ARB", etc.) |
| `receiveToken` | `string` | Token code to buy (typically "WETH") |
| `amountIn` | `uint256` | Amount to swap (in token's smallest unit) |
| `deadline` | `uint256` | Unix timestamp deadline for transaction |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Actual amount received (in receiveToken's smallest unit) |

**Access Control:** `public` (anyone can call, but typically called by LiquidityManager)

**Validations:**
- ✅ Swaps must be enabled
- ✅ Deadline must be in the future
- ✅ Both tokens must be active in TokenManager
- ✅ AmountIn must be within min/max limits
- ✅ ProxyGeneral must have sufficient balance
- ✅ Expected output must be calculable
- ✅ Actual received must meet minimum (slippage protection)
- ❌ Reverts with `"Swaps are disabled"` if not enabled
- ❌ Reverts with `"Transaction too old"` if block.timestamp > deadline
- ❌ Reverts with validation errors from validateSwapParameters
- ❌ Reverts with `"Excessive slippage"` if output too low

**Swap Flow:**
1. Validate deadline (MEV protection)
2. Validate swap parameters
3. Resolve plugin via Beacon (activeSwapPlugin)
4. Get expected output from plugin
5. Calculate minimum acceptable output (maxSlippage)
6. Approve plugin router for spendToken
7. Execute swap via plugin
8. Validate actual received >= minAcceptable
9. Update statistics
10. Emit events

**MEV Protection:**
- **Deadline check**: Reverts if transaction delayed beyond deadline
- **TightDeadlineWarning**: Emitted if deadline < 5 minutes from now
- Recommended: Set deadline = block.timestamp + 10-20 minutes

**Events Emitted:**
```solidity
event SwapExecuted(
    string indexed tokenIn,
    string indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    uint256 slippageBps,
    address indexed executor
)

// If deadline tight:
event TightDeadlineWarning(
    address indexed caller,
    string spendToken,
    string receiveToken,
    uint256 deadline,
    uint256 currentTime
)

// On failure (before revert):
event SwapFailed(
    string indexed tokenIn,
    string indexed tokenOut,
    uint256 amountIn,
    string reason,
    address indexed executor,
    uint256 timestamp
)
```

**Gas Cost:** ~250,000-400,000 gas (depends on DEX and token pair)

**Usage Example:**
```solidity
// Swap 1000 USDC to WETH with 10-minute deadline
uint256 deadline = block.timestamp + 10 minutes;
uint256 wethReceived = swapManager.performSwap(
    "USDC",
    "WETH",
    1000e6,
    deadline
);

console.log("WETH received:", wethReceived);
```

**Called By:** LiquidityManager (automatic swaps during withdrawals)

**Security Notes:**
- ⚠️ **BREAKING CHANGE**: Now requires deadline parameter
- ReentrancyGuard prevents reentrancy attacks
- Slippage protection prevents sandwich attacks
- Deadline prevents transaction delay attacks (MEV)

---

### performSwapAuto {#swapmanager-performswapauto}

Convenience wrapper that uses automatic deadline window.

**Signature:**
```solidity
function performSwapAuto(
    string memory spendToken,
    string memory receiveToken,
    uint256 amountIn
) public returns (uint256 amountOut)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `spendToken` | `string` | Token to sell |
| `receiveToken` | `string` | Token to buy |
| `amountIn` | `uint256` | Amount to swap |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Amount received |

**Behavior:** Internally calls `performSwap()` with deadline = `block.timestamp + defaultDeadlineWindow` (20 minutes default)

**Gas Cost:** Same as performSwap + ~500 gas overhead

**Usage Example:**
```solidity
// Swap with automatic 20-minute deadline
uint256 received = swapManager.performSwapAuto("ARB", "WETH", 100 ether);
```

**Recommended:** Use explicit `performSwap()` for production; this is convenience only.

---

### swapWithBestPlugin {#swapmanager-swapwithbestplugin}

Queries all registered plugins and executes swap with best price. **Phase 1B feature**.

**Signature:**
```solidity
function swapWithBestPlugin(
    string memory tokenIn,
    string memory tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 deadline
) external nonReentrant returns (uint256 amountOut)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenIn` | `string` | Token to sell |
| `tokenOut` | `string` | Token to buy |
| `amountIn` | `uint256` | Amount to swap |
| `minAmountOut` | `uint256` | Minimum acceptable output (user-defined) |
| `deadline` | `uint256` | Transaction deadline |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Actual amount received |

**Strategy:**
1. Calls getAllQuotes() to query all plugins
2. Filters valid quotes
3. Selects plugin with highest expected output
4. Falls back to activeSwapPlugin if no valid quotes
5. Executes swap via best plugin
6. Validates output >= minAmountOut

**Gas Cost:** ~300,000+ gas (queries multiple plugins)

**Usage Example:**
```solidity
// Get best price across all DEXs
uint256 minOut = swapManager.calculateMinAmountOut("USDC", "WETH", 1000e6, 300);
uint256 deadline = block.timestamp + 15 minutes;

uint256 received = swapManager.swapWithBestPlugin(
    "USDC",
    "WETH",
    1000e6,
    minOut,
    deadline
);
```

**Security Notes:**
- More gas-intensive than performSwap
- Requires multiple plugin registrations
- Graceful fallback to default plugin

---

### validateSwapParameters {#swapmanager-validateswapparameters}

Comprehensive validation of swap parameters before execution.

**Signature:**
```solidity
function validateSwapParameters(
    string memory spendToken,
    string memory receiveToken,
    uint256 amountIn
) external view returns (bool isValid, string memory errorReason)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `spendToken` | `string` | Token to sell |
| `receiveToken` | `string` | Token to buy |
| `amountIn` | `uint256` | Amount to swap |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `isValid` | `bool` | True if valid |
| `errorReason` | `string` | Error description if invalid |

**Validations Performed:**
- Swaps enabled check
- Token codes non-empty
- Tokens different
- Both tokens active
- Amount within limits
- Sufficient balance
- Price availability

**Gas Cost:** ~15,000 gas

**Usage Example:**
```solidity
(bool valid, string memory why) = swapManager.validateSwapParameters(
    "USDC",
    "WETH",
    1000e6
);

if (!valid) {
    console.log("Cannot swap:", why);
}
```

---

### canSwap {#swapmanager-canswap}

Quick check if a swap can be executed (alias for validateSwapParameters).

**Signature:**
```solidity
function canSwap(
    string memory tokenIn,
    string memory tokenOut,
    uint256 amount
) external view returns (bool, string memory)
```

**Gas Cost:** ~15,000 gas

---

### validateSwapParams {#swapmanager-validateswapparams}

Validates swap with minOut and deadline parameters.

**Signature:**
```solidity
function validateSwapParams(
    string memory tokenIn,
    string memory tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 deadline
) external view returns (bool isValid, string memory errorReason)
```

**Additional Validations:**
- minAmountOut > 0
- deadline in future

**Gas Cost:** ~16,000 gas

---

### getExpectedSwapOutput {#swapmanager-getexpectedswapoutput}

Calculates expected output for a swap using active plugin.

**Signature:**
```solidity
function getExpectedSwapOutput(
    string memory spendToken,
    string memory receiveToken,
    uint256 amountIn
) public view returns (uint256 expectedOutput, uint256 priceImpact)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `spendToken` | `string` | Token to sell |
| `receiveToken` | `string` | Token to buy |
| `amountIn` | `uint256` | Amount to swap |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `expectedOutput` | `uint256` | Expected output amount |
| `priceImpact` | `uint256` | Price impact in basis points |

**Gas Cost:** ~12,000 gas

**Usage Example:**
```solidity
(uint256 expected, uint256 impact) = swapManager.getExpectedSwapOutput(
    "USDC",
    "WETH",
    1000e6
);

console.log("Expected:", expected);
console.log("Impact:", impact / 100, "%");
```

---

### getSwapQuote {#swapmanager-getswapquote}

Gets quote for swapping tokenCode to WETH.

**Signature:**
```solidity
function getSwapQuote(string memory tokenCode, uint256 amountIn) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token to swap |
| `amountIn` | `uint256` | Amount to swap |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Expected WETH output |

**Gas Cost:** ~10,000 gas

---

### calculateMinAmountOut {#swapmanager-calculateminamountout}

Calculates minimum acceptable output with slippage protection.

**Signature:**
```solidity
function calculateMinAmountOut(
    string memory tokenIn,
    string memory tokenOut,
    uint256 amountIn,
    uint256 slippageBps
) external view returns (uint256 minOut)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenIn` | `string` | Token to sell |
| `tokenOut` | `string` | Token to buy |
| `amountIn` | `uint256` | Amount to swap |
| `slippageBps` | `uint256` | Slippage tolerance in basis points |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Minimum output after slippage |

**Formula:**
```solidity
minOut = (expectedOutput * (10000 - slippageBps)) / 10000
```

**Gas Cost:** ~13,000 gas

**Usage Example:**
```solidity
// 1% slippage tolerance
uint256 minOut = swapManager.calculateMinAmountOut(
    "USDC",
    "WETH",
    1000e6,
    100 // 1% = 100 bps
);
```

---

### getTokenWETHPrice {#swapmanager-gettokenwethprice}

Gets current token price in WETH terms.

**Signature:**
```solidity
function getTokenWETHPrice(string memory tokenCode) 
    external view 
    returns (uint256 price)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token to query |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Price in WETH (18 decimals) |

**Gas Cost:** ~8,000 gas

---

### estimateSwapGas {#swapmanager-estimateswapgas}

Estimates gas cost for a swap operation.

**Signature:**
```solidity
function estimateSwapGas(
    string memory tokenIn,
    string memory tokenOut,
    uint256 amountIn
) external view returns (uint256 gasEstimate)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenIn` | `string` | Token to sell |
| `tokenOut` | `string` | Token to buy |
| `amountIn` | `uint256` | Amount to swap |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Estimated gas cost |

**Estimation Logic:**
- Base: 180,000 gas
- Queries active plugin if available
- Plugin-specific estimates preferred

**Gas Cost:** ~5,000 gas (view function)

**Usage Example:**
```solidity
uint256 estimatedGas = swapManager.estimateSwapGas("USDC", "WETH", 1000e6);
console.log("Estimated gas:", estimatedGas);
```

---

### getAllQuotes {#swapmanager-getallquotes}

Queries all registered swap plugins for quotes. **Phase 1B feature**.

**Signature:**
```solidity
function getAllQuotes(
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external view returns (QuoteResult[] memory)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenIn` | `address` | Token to sell (address) |
| `tokenOut` | `address` | Token to buy (address) |
| `amountIn` | `uint256` | Amount to swap |

**Returns:**
| Type | Description |
|------|-------------|
| `QuoteResult[]` | Array of quotes from all plugins |

**QuoteResult Struct:**
```solidity
struct QuoteResult {
    string pluginName;
    uint256 quote;
    bool isValid;
    string errorReason;
}
```

**Gas Cost:** ~50,000 + (n * 15,000) gas where n = number of plugins

**Usage Example:**
```solidity
QuoteResult[] memory quotes = swapManager.getAllQuotes(
    usdcAddress,
    wethAddress,
    1000e6
);

for (uint i = 0; i < quotes.length; i++) {
    if (quotes[i].isValid) {
        console.log("Plugin:", quotes[i].pluginName);
        console.log("Quote:", quotes[i].quote);
    }
}
```

**Use Cases:**
- Price comparison across DEXs
- Finding best execution venue
- Analytics and monitoring

---

### getSwapStats {#swapmanager-getswapstats}

Returns success and error counts for a token pair.

**Signature:**
```solidity
function getSwapStats(string memory tokenIn, string memory tokenOut) 
    external view 
    returns (uint256 successCount, uint256 errorCount)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenIn` | `string` | First token |
| `tokenOut` | `string` | Second token |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `successCount` | `uint256` | Number of successful swaps |
| `errorCount` | `uint256` | Number of failed swaps |

**Gas Cost:** ~3,000 gas

---

### resetSwapStats {#swapmanager-resetswapstats}

Resets statistics for a token pair.

**Signature:**
```solidity
function resetSwapStats(string memory tokenIn, string memory tokenOut) 
    external 
    onlyOwner
```

**Gas Cost:** ~25,000 gas

---

### setSwapLimits {#swapmanager-setswaplimits}

Sets minimum and maximum swap amounts for a token.

**Signature:**
```solidity
function setSwapLimits(
    string memory tokenCode,
    uint256 minAmount,
    uint256 maxAmount
) external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier |
| `minAmount` | `uint256` | Minimum swap amount |
| `maxAmount` | `uint256` | Maximum swap amount |

**Validations:**
- ✅ minAmount <= maxAmount

**Gas Cost:** ~40,000 gas

---

### setMaxSlippage {#swapmanager-setmaxslippage}

Sets maximum acceptable slippage in basis points.

**Signature:**
```solidity
function setMaxSlippage(uint256 newSlippage) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newSlippage` | `uint256` | New slippage in basis points (max 1000 = 10%) |

**Validations:**
- ✅ newSlippage <= 1000 (10%)

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
// Set 2% max slippage
swapManager.setMaxSlippage(200);
```

---

### setSimpleSwapRouter {#swapmanager-setsimpleswaprouter}

**(DEPRECATED)** Sets SimpleSwap router address.

**Signature:**
```solidity
function setSimpleSwapRouter(address newRouter) 
    external 
    onlyOwner
```

**Note:** Deprecated in favor of plugin architecture. Use `setActiveSwapPlugin()` instead.

---

### setActiveSwapPlugin {#swapmanager-setactiveswapplugin}

Sets the active swap plugin name for Beacon resolution. **Phase 1A feature**.

**Signature:**
```solidity
function setActiveSwapPlugin(string memory pluginName) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `pluginName` | `string` | Plugin name in Beacon ("UniswapV3Plugin", "SushiSwapPlugin", etc.) |

**Validations:**
- ✅ pluginName must be non-empty
- ✅ Plugin must exist in Beacon

**Events Emitted:**
```solidity
event SwapPluginChanged(
    string indexed oldPlugin,
    string indexed newPlugin
)
```

**Gas Cost:** ~30,000 gas

**Usage Example:**
```solidity
// Switch to Uniswap V3
swapManager.setActiveSwapPlugin("UniswapV3Plugin");

// Switch to SushiSwap
swapManager.setActiveSwapPlugin("SushiSwapPlugin");
```

---

### setSwapsEnabled {#swapmanager-setswapsenabled}

Enables or disables all swap operations.

**Signature:**
```solidity
function setSwapsEnabled(bool enabled) 
    external 
    onlyOwner
```

**Gas Cost:** ~20,000 gas

---

### setDefaultDeadlineWindow {#swapmanager-setdefaultdeadlinewindow}

Sets the default deadline window for automatic swaps.

**Signature:**
```solidity
function setDefaultDeadlineWindow(uint256 windowSeconds) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `windowSeconds` | `uint256` | Deadline window in seconds |

**Validations:**
- ✅ windowSeconds >= MIN_DEADLINE_WINDOW (1 minute)
- ✅ windowSeconds <= MAX_DEADLINE_WINDOW (1 hour)

**Gas Cost:** ~20,000 gas

**Usage Example:**
```solidity
// Set 15-minute default deadline
swapManager.setDefaultDeadlineWindow(15 minutes);
```

---

### getDefaultDeadlineWindow {#swapmanager-getdefaultdeadlinewindow}

Returns the current default deadline window.

**Signature:**
```solidity
function getDefaultDeadlineWindow() 
    external view 
    returns (uint256 windowSeconds)
```

**Gas Cost:** ~1,000 gas

---

### getSimpleSwapRouter {#swapmanager-getsimpleswaprouter}

Returns the SimpleSwap router address (legacy).

**Signature:**
```solidity
function getSimpleSwapRouter() 
    external view 
    returns (address router)
```

**Gas Cost:** ~1,000 gas

---

### areSwapsEnabled {#swapmanager-areswapsenabled}

Returns whether swaps are currently enabled.

**Signature:**
```solidity
function areSwapsEnabled() 
    external view 
    returns (bool enabled)
```

**Gas Cost:** ~1,000 gas

---

### emergencyTokenRecovery {#swapmanager-emergencytokenrecovery}

Emergency function to recover stuck tokens.

**Signature:**
```solidity
function emergencyTokenRecovery(
    string memory tokenCode,
    uint256 amount,
    address recipient
) external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token to recover |
| `amount` | `uint256` | Amount to recover |
| `recipient` | `address` | Recovery address |

**Gas Cost:** ~50,000 gas

**Security Notes:**
- ⚠️ Emergency use only
- Owner-only access
- For recovering tokens stuck in SwapManager

---

> **✅ SwapManager Module Complete (24/24 functions documented)**

**Progress: 120/193 functions (62%)**

---

## ⚠️ EmergencyHandler {#emergencyhandler}

**Purpose:** System-wide emergency procedures, emergency pause/unpause, asset recovery, health monitoring  
**Inheritance:** `IEmergencyHandler`, `Ownable`  
**Dependencies:** Beacon, ProxyGeneral, TokenManager, ValueCalculator, WETH  
**Security:** Emergency contact system with roles, timelock protection, cooldown mechanism

### Module Functions Overview

**Core Emergency Operations:**
- [emergencyPause](#emergencyhandler-emergencypause) - Pause entire system
- [emergencyUnpause](#emergencyhandler-emergencyunpause) - Unpause after timelock
- [emergencyWithdraw](#emergencyhandler-emergencywithdraw) - Withdraw all assets
- [generateEmergencyReport](#emergencyhandler-generateemergencyreport) - Full system report

**Emergency State:**
- [getEmergencyState](#emergencyhandler-getemergencystate) - Get emergency state
- [canUnpause](#emergencyhandler-canunpause) - Check if can unpause
- [isEmergencyExecuted](#emergencyhandler-isemergencyexecuted) - Check if executed

**Health Monitoring:**
- [getSystemHealthStatus](#emergencyhandler-getsystemhealthstatus) - Complete health check
- [getEmergencyStats](#emergencyhandler-getemergencystats) - Emergency statistics
- [getLastEmergencyReport](#emergencyhandler-getlastemergencyreport) - Get last report
- [validateSystemHealth](#emergencyhandler-validatesystemhealth) - Comprehensive validation
- [checkAssetIntegrity](#emergencyhandler-checkassetintegrity) - Asset integrity check

**Emergency Contacts:**
- [addEmergencyContact](#emergencyhandler-addemergencycontact) - Add contact with role
- [removeEmergencyContact](#emergencyhandler-removeemergencycontact) - Remove contact
- [isAuthorizedForEmergency](#emergencyhandler-isauthorizedforemergency) - Check authorization
- [getContactInfo](#emergencyhandler-getcontactinfo) - Get contact details
- [getEmergencyContactsCount](#emergencyhandler-getemergencycontactscount) - Count contacts

**Asset Snapshots (Sprint 3.2):**
- [createAssetSnapshot](#emergencyhandler-createassetsnapshot) - Create snapshot
- [getAssetSnapshot](#emergencyhandler-getassetsnapshot) - Get snapshot by ID
- [getAllSnapshots](#emergencyhandler-getallsnapshots) - List all snapshots
- [getSnapshotCount](#emergencyhandler-getsnapshotcount) - Count snapshots

**Admin Functions:**
- [setUnpauseTimelock](#emergencyhandler-setunpausetimelock) - Set unpause delay
- [resetEmergencyState](#emergencyhandler-resetemergencystate) - Reset state

**Interface Compliance (19 functions):**
- [activateEmergency](#emergencyhandler-activateemergency) - Alias for pause
- [deactivateEmergency](#emergencyhandler-deactivateemergency) - Alias for unpause
- [isEmergencyActive](#emergencyhandler-isemergencyactive) - Check if active
- [getEmergencyContacts](#emergencyhandler-getemergencycontacts) - List contacts
- [checkIsEmergencyContact](#emergencyhandler-checkisemergencycontact) - Verify contact
- [setEmergencyTimelock](#emergencyhandler-setemergencytimelock) - Set timelock
- [getEmergencyTimelock](#emergencyhandler-getemergencytimelock) - Get timelock
- [isTimelockExpired](#emergencyhandler-istimeclockexpired) - Check expiry
- [setEmergencyCooldown](#emergencyhandler-setemergencycooldown) - Set cooldown
- [isInCooldown](#emergencyhandler-isincooldown) - Check cooldown
- [getRemainingCooldown](#emergencyhandler-getremainingcooldown) - Time remaining
- [pauseAllOperations](#emergencyhandler-pausealloperations) - Pause all
- [resumeAllOperations](#emergencyhandler-resumealloperations) - Resume all
- [emergencyWithdraw (interface)](#emergencyhandler-emergencywithdraw-interface) - Interface withdraw
- [emergencyTransfer](#emergencyhandler-emergencytransfer) - Transfer ETH
- [checkEmergencyAccess](#emergencyhandler-checkemergencyaccess) - Check access

---

### emergencyPause {#emergencyhandler-emergencypause}

Pauses the entire system in emergency. Only authorized contacts can trigger.

**Signature:**
```solidity
function emergencyPause(string memory reason) 
    public 
    onlyEmergencyAuthorized
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `reason` | `string` | Emergency pause reason |

**Access Control:** `onlyEmergencyAuthorized` (owner or emergency contact)

**Validations:**
- ✅ Emergency not already active
- ✅ Cooldown period expired (1 day minimum)
- ❌ Reverts with `"Emergency already active"` if already paused
- ❌ Reverts with `"Emergency cooldown active"` if cooldown active

**Behavior:**
1. Set emergencyState (isActive=true, activatedBy, reason, timestamp)
2. Call ProxyGeneral.pause()
3. Mark emergencyExecuted["pause"] = true
4. Update lastEmergencyTimestamp
5. Notify all emergency contacts

**Events Emitted:**
```solidity
event EmergencyPauseExecuted(
    address indexed executor,
    uint256 timestamp,
    string reason
)

event EmergencyContactNotified(address indexed contact)
```

**Gas Cost:** ~150,000 gas

**Usage Example:**
```solidity
emergencyHandler.emergencyPause("Oracle failure detected");
```

**Security Notes:**
- 1-day cooldown prevents spam
- All emergency contacts notified
- System-wide pause via ProxyGeneral

---

### emergencyUnpause {#emergencyhandler-emergencyunpause}

Removes emergency pause after timelock expires.

**Signature:**
```solidity
function emergencyUnpause() 
    public 
    onlyOwner
```

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Emergency must be active
- ✅ Timelock must have expired (6 hours default)
- ❌ Reverts with `"No emergency active"` if not paused
- ❌ Reverts with `"Timelock not expired"` if too early

**Behavior:**
1. Check timelock expiry
2. Call ProxyGeneral.unpause()
3. Reset emergencyState
4. Mark emergencyExecuted["pause"] = false
5. Emit events

**Events Emitted:**
```solidity
event EmergencyUnpauseExecuted(address indexed executor, uint256 timestamp)
event EmergencyResolved(address indexed triggeredBy, string reason, uint256 triggeredAt, uint256 resolvedAt)
```

**Gas Cost:** ~80,000 gas

---

### canUnpause {#emergencyhandler-canunpause}

Checks if system can be unpaused.

**Signature:**
```solidity
function canUnpause() 
    external view 
    returns (bool canUnpause, string memory reason)
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `canUnpause` | `bool` | If unpause possible |
| `reason` | `string` | Reason if not possible |

**Gas Cost:** ~3,000 gas

---

### emergencyWithdraw {#emergencyhandler-emergencywithdraw}

Withdraws ALL assets from ProxyGeneral to owner.

**Signature:**
```solidity
function emergencyWithdraw() 
    external 
    onlyOwner 
    returns (WithdrawResult[] memory results)
```

**Returns:**
| Type | Description |
|------|-------------|
| `WithdrawResult[]` | Withdrawal results for each token |

**WithdrawResult Struct:**
```solidity
struct WithdrawResult {
    string tokenCode;
    address tokenAddress;
    uint256 amount;
    bool success;
    string errorReason;
}
```

**Behavior:**
1. Check withdraw not already executed
2. Get all active tokens
3. Create asset snapshot
4. Withdraw each token via ProxyGeneral.emergencyTransfer
5. Withdraw WETH
6. Track successes/failures
7. Mark emergencyExecuted["withdraw"] = true

**Events Emitted:**
```solidity
event EmergencyWithdrawInitiated(address indexed executor, uint256 timestamp, uint256 totalValue)
event TokenWithdrawAttempted(string indexed tokenCode, uint256 amount, bool success, string errorReason)
event EmergencyWithdrawCompleted(uint256 totalWithdrawn, uint256 successfulWithdraws, uint256 failedWithdraws)
event AssetTransferred(string indexed tokenCode, address indexed tokenAddress, uint256 amount, address indexed recipient)
```

**Gas Cost:** ~500,000+ gas (depends on number of tokens)

**Usage Example:**
```solidity
WithdrawResult[] memory results = emergencyHandler.emergencyWithdraw();

for (uint i = 0; i < results.length; i++) {
    if (results[i].success) {
        console.log("Withdrew", results[i].tokenCode, results[i].amount);
    } else {
        console.log("Failed:", results[i].errorReason);
    }
}
```

**Security Notes:**
- One-time operation
- Creates audit trail via asset snapshot
- Graceful error handling

---

### generateEmergencyReport {#emergencyhandler-generateemergencyreport}

Generates comprehensive system report.

**Signature:**
```solidity
function generateEmergencyReport() 
    external 
    returns (EmergencyReport memory report)
```

**Returns:**
| Type | Description |
|------|-------------|
| `EmergencyReport` | Complete system report |

**EmergencyReport Struct:**
```solidity
struct EmergencyReport {
    uint256 totalPoolValue;
    uint256 wethBalance;
    uint256 totalTokensValue;
    uint256 numberOfTokens;
    bool systemPaused;
    uint256 reportTimestamp;
    address reportedBy;
}
```

**Gas Cost:** ~50,000 gas

---

### getEmergencyState {#emergencyhandler-getemergencystate}

Returns current emergency state.

**Signature:**
```solidity
function getEmergencyState() 
    external view 
    returns (IEmergencyHandler.EmergencyState memory state)
```

**EmergencyState Struct:**
```solidity
struct EmergencyState {
    bool isActive;
    address activatedBy;
    uint256 activatedAt;
    uint256 lastActionAt;
    string reason;
    uint256 cooldownUntil;
}
```

**Gas Cost:** ~2,000 gas

---

### getSystemHealthStatus {#emergencyhandler-getsystemhealthstatus}

Complete health check for governance.

**Signature:**
```solidity
function getSystemHealthStatus() 
    external view 
    returns (
        bool isPaused,
        uint256 totalValue,
        uint256 lpSupply,
        string[] memory activeTokens
    )
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `isPaused` | `bool` | If system paused |
| `totalValue` | `uint256` | Total pool value |
| `lpSupply` | `uint256` | LP token supply |
| `activeTokens` | `string[]` | Active tokens |

**Gas Cost:** ~15,000 gas

**Security Notes:**
- Try/catch protection
- Assumes paused if check fails

---

### addEmergencyContact {#emergencyhandler-addemergencycontact}

Adds emergency contact with role. **Sprint 3.3 enhancement**.

**Signature:**
```solidity
function addEmergencyContact(address contact, string memory role) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `contact` | `address` | Contact address |
| `role` | `string` | Contact role |

**Validations:**
- ✅ contact != address(0)
- ✅ Not already added
- ✅ Max 10 contacts
- ✅ Role non-empty

**Behavior:**
- Stores contact address
- Stores role (Sprint 3.3)
- Stores timestamp (Sprint 3.3)

**Gas Cost:** ~40,000 gas

---

### removeEmergencyContact {#emergencyhandler-removeemergencycontact}

Removes emergency contact and cleans up metadata. **Sprint 3.3 enhancement**.

**Signature:**
```solidity
function removeEmergencyContact(address contact) 
    external 
    onlyOwner
```

**Behavior:**
- Removes from array
- Deletes role (Sprint 3.3)
- Deletes timestamp (Sprint 3.3)

**Gas Cost:** ~30,000 gas

---

### getContactInfo {#emergencyhandler-getcontactinfo}

Gets emergency contact details. **Sprint 3.3 feature**.

**Signature:**
```solidity
function getContactInfo(address contact) 
    external view 
    returns (
        string memory role,
        uint256 addedAt,
        bool isActive
    )
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `role` | `string` | Contact role |
| `addedAt` | `uint256` | Timestamp added |
| `isActive` | `bool` | If currently active |

**Gas Cost:** ~2,000 gas

---

### createAssetSnapshot {#emergencyhandler-createassetsnapshot}

Creates snapshot of all system assets. **Sprint 3.2 feature**.

**Signature:**
```solidity
function createAssetSnapshot() 
    external 
    returns (uint256 snapshotId)
```

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Snapshot ID |

**AssetSnapshot Struct:**
```solidity
struct AssetSnapshot {
    uint256 snapshotId;
    uint256 timestamp;
    uint256 totalValue;
    uint256 wethBalance;
    TokenBalance[] tokenBalances;
    address capturedBy;
}
```

**Behavior:**
1. Increment snapshotCount
2. Get all active tokens
3. Query balances for each
4. Store complete snapshot
5. Emit event

**Gas Cost:** ~100,000+ gas (depends on token count)

**Usage Example:**
```solidity
uint256 id = emergencyHandler.createAssetSnapshot();
console.log("Snapshot created:", id);
```

---

### getAssetSnapshot {#emergencyhandler-getassetsnapshot}

Retrieves snapshot by ID.

**Signature:**
```solidity
function getAssetSnapshot(uint256 snapshotId) 
    external view 
    returns (AssetSnapshot memory snapshot)
```

**Gas Cost:** ~5,000 gas

---

### getAllSnapshots {#emergencyhandler-getallsnapshots}

Lists all created snapshots.

**Signature:**
```solidity
function getAllSnapshots() 
    external view 
    returns (AssetSnapshot[] memory snapshotList)
```

**Gas Cost:** Variable (depends on count)

**Security Notes:**
- Use with caution for large datasets
- Consider pagination for production

---

### setUnpauseTimelock {#emergencyhandler-setunpausetimelock}

Sets unpause timelock delay.

**Signature:**
```solidity
function setUnpauseTimelock(uint256 newTimelock) 
    public 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newTimelock` | `uint256` | Timelock in seconds |

**Validations:**
- ✅ >= MIN_TIMELOCK (1 hour)
- ✅ <= MAX_TIMELOCK (7 days)

**Gas Cost:** ~20,000 gas

---

### validateSystemHealth {#emergencyhandler-validatesystemhealth}

Comprehensive system validation.

**Signature:**
```solidity
function validateSystemHealth() 
    external view 
    returns (bool isHealthy, string[] memory issues)
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `isHealthy` | `bool` | If system healthy |
| `issues` | `string[]` | Detected issues |

**Gas Cost:** ~20,000 gas

---

### activateEmergency {#emergencyhandler-activateemergency}

Alias for emergencyPause. Interface compliance function.

**Signature:**
```solidity
function activateEmergency(string memory reason) 
    external
```

**Behavior:** Calls emergencyPause(reason)

**Gas Cost:** Same as emergencyPause (~150,000 gas)

---

### deactivateEmergency {#emergencyhandler-deactivateemergency}

Alias for emergencyUnpause. Interface compliance function.

**Signature:**
```solidity
function deactivateEmergency() 
    external
```

**Behavior:** Calls emergencyUnpause()

**Gas Cost:** Same as emergencyUnpause (~80,000 gas)

---

### isEmergencyActive {#emergencyhandler-isemergencyactive}

Checks if emergency is currently active.

**Signature:**
```solidity
function isEmergencyActive() 
    external view 
    returns (bool)
```

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if emergency active |

**Gas Cost:** ~1,500 gas

---

### getEmergencyContacts {#emergencyhandler-getemergencycontacts}

Returns array of all emergency contact addresses.

**Signature:**
```solidity
function getEmergencyContacts() 
    external view 
    returns (address[] memory)
```

**Returns:**
| Type | Description |
|------|-------------|
| `address[]` | Array of emergency contacts |

**Gas Cost:** ~3,000 + (n * 800) gas

---

### checkIsEmergencyContact {#emergencyhandler-checkisemergencycontact}

Verifies if address is an emergency contact.

**Signature:**
```solidity
function checkIsEmergencyContact(address contact) 
    external view 
    returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `contact` | `address` | Address to check |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if is emergency contact |

**Gas Cost:** ~2,000 gas

---

### isAuthorizedForEmergency {#emergencyhandler-isauthorizedforemergency}

Checks if address can trigger emergency actions.

**Signature:**
```solidity
function isAuthorizedForEmergency(address user) 
    external view 
    returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | Address to check |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if owner or emergency contact |

**Gas Cost:** ~2,500 gas

---

### setEmergencyTimelock {#emergencyhandler-setemergencytimelock}

Alias for setUnpauseTimelock. Interface compliance.

**Signature:**
```solidity
function setEmergencyTimelock(uint256 newTimelock) 
    external
```

**Behavior:** Calls setUnpauseTimelock(newTimelock)

**Gas Cost:** ~20,000 gas

---

### getEmergencyTimelock {#emergencyhandler-getemergencytimelock}

Returns current unpause timelock duration.

**Signature:**
```solidity
function getEmergencyTimelock() 
    external view 
    returns (uint256)
```

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Timelock duration in seconds |

**Gas Cost:** ~1,000 gas

---

### isTimelockExpired {#emergencyhandler-istimeclockexpired}

Checks if unpause timelock has expired.

**Signature:**
```solidity
function isTimelockExpired() 
    external view 
    returns (bool)
```

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if timelock expired |

**Gas Cost:** ~2,000 gas

---

### setEmergencyCooldown {#emergencyhandler-setemergencycooldown}

Sets cooldown period between emergency activations.

**Signature:**
```solidity
function setEmergencyCooldown(uint256 newCooldown) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newCooldown` | `uint256` | Cooldown in seconds |

**Validations:**
- ✅ >= MIN_COOLDOWN (1 hour)
- ✅ <= MAX_COOLDOWN (30 days)

**Gas Cost:** ~20,000 gas

---

### isInCooldown {#emergencyhandler-isincooldown}

Checks if system is in cooldown period.

**Signature:**
```solidity
function isInCooldown() 
    external view 
    returns (bool)
```

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if in cooldown |

**Gas Cost:** ~1,500 gas

---

### getRemainingCooldown {#emergencyhandler-getremainingcooldown}

Returns remaining cooldown time.

**Signature:**
```solidity
function getRemainingCooldown() 
    external view 
    returns (uint256)
```

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Remaining cooldown seconds (0 if expired) |

**Gas Cost:** ~2,000 gas

---

### pauseAllOperations {#emergencyhandler-pausealloperations}

Alias for emergencyPause. Interface compliance.

**Signature:**
```solidity
function pauseAllOperations(string memory reason) 
    external
```

**Behavior:** Calls emergencyPause(reason)

**Gas Cost:** ~150,000 gas

---

### resumeAllOperations {#emergencyhandler-resumealloperations}

Alias for emergencyUnpause. Interface compliance.

**Signature:**
```solidity
function resumeAllOperations() 
    external
```

**Behavior:** Calls emergencyUnpause()

**Gas Cost:** ~80,000 gas

---

### emergencyWithdraw (interface) {#emergencyhandler-emergencywithdraw-interface}

Interface version of emergencyWithdraw with different signature.

**Signature:**
```solidity
function emergencyWithdraw(address token, address recipient) 
    external
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `token` | `address` | Token to withdraw (address(0) for ETH) |
| `recipient` | `address` | Withdrawal recipient |

**Behavior:** Withdraws specific token instead of all assets

**Gas Cost:** ~60,000 gas

---

### emergencyTransfer {#emergencyhandler-emergencytransfer}

Transfers ETH in emergency.

**Signature:**
```solidity
function emergencyTransfer(address payable recipient, uint256 amount) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `recipient` | `address payable` | Transfer recipient |
| `amount` | `uint256` | Amount in wei |

**Validations:**
- ✅ recipient != address(0)
- ✅ amount > 0
- ✅ Contract has sufficient balance

**Gas Cost:** ~30,000 gas

---

### checkEmergencyAccess {#emergencyhandler-checkemergencyaccess}

Checks if address has emergency access.

**Signature:**
```solidity
function checkEmergencyAccess(address user) 
    external view 
    returns (bool hasAccess)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | Address to check |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if owner or emergency contact |

**Gas Cost:** ~2,500 gas

---

### isEmergencyExecuted {#emergencyhandler-isemergencyexecuted}

Checks if specific emergency action has been executed.

**Signature:**
```solidity
function isEmergencyExecuted(string memory action) 
    external view 
    returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `action` | `string` | Action name ("pause", "withdraw") |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if executed |

**Gas Cost:** ~2,000 gas

---

### getEmergencyStats {#emergencyhandler-getemergencystats}

Returns emergency statistics.

**Signature:**
```solidity
function getEmergencyStats() 
    external view 
    returns (
        uint256 totalEmergencies,
        uint256 lastEmergencyTime,
        uint256 totalContactsNotified
    )
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `totalEmergencies` | `uint256` | Total emergency count |
| `lastEmergencyTime` | `uint256` | Last emergency timestamp |
| `totalContactsNotified` | `uint256` | Total notifications sent |

**Gas Cost:** ~3,000 gas

---

### getLastEmergencyReport {#emergencyhandler-getlastemergencyreport}

Returns last generated emergency report.

**Signature:**
```solidity
function getLastEmergencyReport() 
    external view 
    returns (EmergencyReport memory)
```

**Returns:**
| Type | Description |
|------|-------------|
| `EmergencyReport` | Last report data |

**Gas Cost:** ~4,000 gas

---

### resetEmergencyState {#emergencyhandler-resetemergencystate}

Resets emergency state variables. Admin function.

**Signature:**
```solidity
function resetEmergencyState() 
    external 
    onlyOwner
```

**Behavior:**
- Clears emergency state
- Resets executed flags
- Clears cooldown

**Events Emitted:**
```solidity
event EmergencyStateReset(address indexed executor, uint256 timestamp)
```

**Gas Cost:** ~35,000 gas

---

### checkAssetIntegrity {#emergencyhandler-checkassetintegrity}

Validates asset balances match expected values.

**Signature:**
```solidity
function checkAssetIntegrity() 
    external view 
    returns (bool isValid, string[] memory issues)
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `isValid` | `bool` | True if all assets valid |
| `issues` | `string[]` | List of detected issues |

**Validations:**
- Asset balances consistency
- Oracle price availability
- Token registration status

**Gas Cost:** ~25,000 gas

---

### getEmergencyContactsCount {#emergencyhandler-getemergencycontactscount}

Returns number of emergency contacts.

**Signature:**
```solidity
function getEmergencyContactsCount() 
    external view 
    returns (uint256)
```

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Number of contacts |

**Gas Cost:** ~1,000 gas

---

### getSnapshotCount {#emergencyhandler-getsnapshotcount}

Returns total number of snapshots created.

**Signature:**
```solidity
function getSnapshotCount() 
    external view 
    returns (uint256)
```

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Total snapshot count |

**Gas Cost:** ~1,000 gas

---

> **✅ EmergencyHandler Module Complete (39/39 functions documented)**

**Progress: 159/193 functions (82%)**

---

## 🎛️ ParameterManager {#parametermanager}

**Purpose:** System parameter governance with timelock protection  
**Inheritance:** `IParameterManager`, `Ownable`  
**Dependencies:** Beacon, ProxyGeneral  
**Architecture:** Timelock-based governance with proposal system, emergency override capability

### Module Functions Overview

**Parameter Access:**
- [getCurrentParameterValue](#parametermanager-getcurrentparametervalue) - Get current value
- [getAllParameterNames](#parametermanager-getallparameternames) - List all parameters
- [getParameterInfo](#parametermanager-getparameterinfo) - Full parameter info

**Parameter Updates:**
- [proposeParameterChange](#parametermanager-proposeparameterchange) - Propose change with timelock
- [executeParameterChange](#parametermanager-executeparameterchange) - Execute after timelock
- [emergencySetParameter](#parametermanager-emergencysetparameter) - Emergency override
- [updateMultipleParameters](#parametermanager-updatemultipleparameters) - Batch update

**Validation:**
- [isValidParameterValue](#parametermanager-isvalidparametervalue) - Validate value
- [canExecuteParameterChange](#parametermanager-canexecuteparameterchange) - Check if executable

**Admin Functions:**
- [registerParameter](#parametermanager-registerparameter) - Register new parameter
- [setParameterTimelock](#parametermanager-setparametertimelock) - Set timelock delay
- [resetParameterToDefault](#parametermanager-resetparametertodefault) - Reset to default

**Interface Compliance (17 functions):**
- proposeParameterChange (interface version)
- executeParameterChange (interface version)
- cancelParameterProposal
- getParameter
- setParameterEmergency
- parameterExists
- validateParameterValue
- registerParameter (interface)
- getRegisteredParameters
- unregisterParameter
- getParameterTimelock
- getProposal
- getActiveProposals
- getExecutableProposals
- getParameterHistory
- getLastParameterChange
- Typed access (getUintParameter, getBoolParameter, getAddressParameter, getStringParameter)
- Batch operations (proposeBatchParameterChanges, executeBatchProposals)

---

### getCurrentParameterValue {#parametermanager-getcurrentparametervalue}

Returns current value of a parameter.

**Signature:**
```solidity
function getCurrentParameterValue(string memory parameterName) 
    public view 
    returns (uint256 value)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter name |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Current parameter value |

**Gas Cost:** ~2,000 gas

**Usage Example:**
```solidity
uint256 maxDeposit = parameterManager.getCurrentParameterValue("maxDeposit");
console.log("Max deposit:", maxDeposit);
```

---

### getAllParameterNames {#parametermanager-getallparameternames}

Lists all registered parameters.

**Signature:**
```solidity
function getAllParameterNames() 
    external view 
    returns (string[] memory names)
```

**Gas Cost:** ~5,000 gas

---

### getParameterInfo {#parametermanager-getparameterinfo}

Returns complete parameter information.

**Signature:**
```solidity
function getParameterInfo(string memory parameterName) 
    external view 
    returns (Parameter memory param)
```

**Parameter Struct:**
```solidity
struct Parameter {
    uint256 currentValue;
    uint256 proposedValue;
    uint256 proposedAt;
    uint256 effectiveAt;
    uint256 minValue;
    uint256 maxValue;
    bool requiresTimelock;
    bool isActive;
}
```

**Gas Cost:** ~3,000 gas

---

### proposeParameterChange {#parametermanager-proposeparameterchange}

Proposes parameter change with timelock (if required).

**Signature:**
```solidity
function proposeParameterChange(string memory parameterName, uint256 newValue) 
    external 
    onlyAuthorizedUpdater
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter to change |
| `newValue` | `uint256` | New value |

**Access Control:** `onlyAuthorizedUpdater` (owner or EmergencyHandler)

**Validations:**
- ✅ Parameter exists
- ✅ Value within min/max range
- ✅ Different from current value

**Behavior:**
- **If requiresTimelock=true**: Proposes with 24h delay
- **If requiresTimelock=false**: Updates immediately

**Events Emitted:**
```solidity
event ParameterChangeProposed(
    string indexed parameterName,
    uint256 oldValue,
    uint256 newValue,
    uint256 effectiveAt
)

// OR if immediate:
event ParameterUpdated(
    string indexed parameterName,
    uint256 oldValue,
    uint256 newValue,
    uint256 timestamp,
    address indexed executor
)
```

**Gas Cost:** ~30,000-50,000 gas

**Usage Example:**
```solidity
// Propose changing max deposit (requires timelock)
parameterManager.proposeParameterChange("maxDeposit", 150 ether);

// Change cache duration (immediate)
parameterManager.proposeParameterChange("cacheDuration", 10 minutes);
```

---

### executeParameterChange {#parametermanager-executeparameterchange}

Executes parameter change after timelock expires.

**Signature:**
```solidity
function executeParameterChange(string memory parameterName) 
    external 
    onlyAuthorizedUpdater
```

**Validations:**
- ✅ Parameter exists
- ✅ Requires timelock
- ✅ Has pending proposal
- ✅ Timelock expired

**Gas Cost:** ~40,000 gas

**Usage Example:**
```solidity
// After 24 hours:
parameterManager.executeParameterChange("maxDeposit");
```

---

### emergencySetParameter {#parametermanager-emergencysetparameter}

Bypasses timelock for emergency changes.

**Signature:**
```solidity
function emergencySetParameter(string memory parameterName, uint256 newValue) 
    external 
    onlyAuthorizedUpdater
```

**Validations:**
- ✅ System must be paused

**Events Emitted:**
```solidity
event ParameterEmergencyChanged(
    string indexed parameterName,
    uint256 oldValue,
    uint256 newValue,
    address indexed changedBy
)
```

**Gas Cost:** ~35,000 gas

**Security Notes:**
- Requires system pause
- Clears pending proposals
- Adds to history

---

### updateMultipleParameters {#parametermanager-updatemultipleparameters}

Batch update multiple parameters.

**Signature:**
```solidity
function updateMultipleParameters(
    string[] memory parameterNames,
    uint256[] memory newValues
) external onlyAuthorizedUpdater
```

**Validations:**
- ✅ Arrays same length
- ✅ Max 20 parameters
- ✅ Each parameter valid

**Gas Cost:** ~50,000 + (n * 30,000) gas

---

### isValidParameterValue {#parametermanager-isvalidparametervalue}

Validates if value is acceptable for parameter.

**Signature:**
```solidity
function isValidParameterValue(string memory parameterName, uint256 newValue) 
    external view 
    returns (bool isValid)
```

**Gas Cost:** ~3,000 gas

---

### canExecuteParameterChange {#parametermanager-canexecuteparameterchange}

Checks if parameter change can be executed.

**Signature:**
```solidity
function canExecuteParameterChange(string memory parameterName) 
    external view 
    returns (bool canExecute, string memory reason)
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `canExecute` | `bool` | If executable |
| `reason` | `string` | Reason if not |

**Gas Cost:** ~3,000 gas

---

### registerParameter {#parametermanager-registerparameter}

Registers new parameter in system.

**Signature:**
```solidity
function registerParameter(
    string memory parameterName,
    uint256 initialValue,
    uint256 minValue,
    uint256 maxValue,
    bool requiresTimelock
) external onlyOwner
```

**Validations:**
- ✅ Not already registered
- ✅ Non-empty name
- ✅ Initial value within range

**Gas Cost:** ~80,000 gas

---

### setParameterTimelock {#parametermanager-setparametertimelock}

Sets parameter timelock delay.

**Signature:**
```solidity
function setParameterTimelock(uint256 newTimelock) 
    external 
    onlyOwner
```

**Validations:**
- ✅ >= MIN_TIMELOCK (1 hour)
- ✅ <= MAX_TIMELOCK (7 days)

**Gas Cost:** ~20,000 gas

---

### getProposal {#parametermanager-getproposal}

Gets proposal by ID. **Issue #9 fix**.

**Signature:**
```solidity
function getProposal(uint256 proposalId) 
    external view 
    returns (Parameter memory proposal)
```

**Implementation:**
- Direct lookup from proposalById mapping
- Returns empty if not exists

**Gas Cost:** ~2,000 gas

---

### getActiveProposals {#parametermanager-getactiveproposals}

Lists all active proposals.

**Signature:**
```solidity
function getActiveProposals() 
    external view 
    returns (Parameter[] memory proposals)
```

**Gas Cost:** Variable (depends on count)

---

### getExecutableProposals {#parametermanager-getexecutableproposals}

Lists proposals ready for execution.

**Signature:**
```solidity
function getExecutableProposals() 
    external view 
    returns (Parameter[] memory proposals)
```

**Criteria:** proposedAt > 0 AND block.timestamp >= effectiveAt

**Gas Cost:** Variable

---

### getParameterHistory {#parametermanager-getparameterhistory}

Returns full change history for parameter.

**Signature:**
```solidity
function getParameterHistory(string memory key) 
    external view 
    returns (ParameterHistory[] memory history)
```

**ParameterHistory Struct:**
```solidity
struct ParameterHistory {
    uint256 value;
    uint256 timestamp;
    address changedBy;
}
```

**Gas Cost:** Variable

---

### cancelParameterProposal {#parametermanager-cancelparameterproposal}

Cancels a pending parameter proposal.

**Signature:**
```solidity
function cancelParameterProposal(string memory parameterName) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter to cancel proposal for |

**Validations:**
- ✅ Must have pending proposal

**Events Emitted:**
```solidity
event ParameterProposalCancelled(
    string indexed parameterName,
    uint256 proposedValue,
    address indexed cancelledBy
)
```

**Gas Cost:** ~25,000 gas

---

### getParameter {#parametermanager-getparameter}

Alias for getCurrentParameterValue. Interface compliance.

**Signature:**
```solidity
function getParameter(string memory key) 
    external view 
    returns (uint256)
```

**Behavior:** Calls getCurrentParameterValue(key)

**Gas Cost:** ~2,000 gas

---

### setParameterEmergency {#parametermanager-setparameteremergency}

Alias for emergencySetParameter. Interface compliance.

**Signature:**
```solidity
function setParameterEmergency(string memory key, uint256 value) 
    external
```

**Behavior:** Calls emergencySetParameter(key, value)

**Gas Cost:** ~35,000 gas

---

### parameterExists {#parametermanager-parameterexists}

Checks if parameter is registered.

**Signature:**
```solidity
function parameterExists(string memory key) 
    external view 
    returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Parameter name |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if registered |

**Gas Cost:** ~1,500 gas

---

### validateParameterValue {#parametermanager-validateparametervalue}

Alias for isValidParameterValue. Interface compliance.

**Signature:**
```solidity
function validateParameterValue(string memory key, uint256 value) 
    external view 
    returns (bool)
```

**Behavior:** Calls isValidParameterValue(key, value)

**Gas Cost:** ~3,000 gas

---

### getRegisteredParameters {#parametermanager-getregisteredparameters}

Alias for getAllParameterNames. Interface compliance.

**Signature:**
```solidity
function getRegisteredParameters() 
    external view 
    returns (string[] memory)
```

**Behavior:** Calls getAllParameterNames()

**Gas Cost:** ~5,000 gas

---

### unregisterParameter {#parametermanager-unregisterparameter}

Removes parameter from system.

**Signature:**
```solidity
function unregisterParameter(string memory key) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Parameter to unregister |

**Validations:**
- ✅ Parameter must exist
- ✅ No pending proposals

**Events Emitted:**
```solidity
event ParameterUnregistered(
    string indexed parameterName,
    address indexed unregisteredBy
)
```

**Gas Cost:** ~40,000 gas

---

### getParameterTimelock {#parametermanager-getparametertimelock}

Returns current parameter timelock duration.

**Signature:**
```solidity
function getParameterTimelock() 
    external view 
    returns (uint256)
```

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Timelock duration in seconds |

**Gas Cost:** ~1,000 gas

---

### getLastParameterChange {#parametermanager-getlastparameterchange}

Returns timestamp of last parameter change.

**Signature:**
```solidity
function getLastParameterChange(string memory key) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Parameter name |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Last change timestamp |

**Gas Cost:** ~2,000 gas

---

### resetParameterToDefault {#parametermanager-resetparametertodefault}

Resets parameter to its initial default value.

**Signature:**
```solidity
function resetParameterToDefault(string memory key) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Parameter to reset |

**Validations:**
- ✅ Parameter must exist
- ✅ Default value must be set

**Events Emitted:**
```solidity
event ParameterResetToDefault(
    string indexed parameterName,
    uint256 oldValue,
    uint256 defaultValue
)
```

**Gas Cost:** ~35,000 gas

---

### getUintParameter {#parametermanager-getuintparameter}

Gets uint256 parameter value. Type-safe accessor.

**Signature:**
```solidity
function getUintParameter(string memory key) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Parameter name |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Parameter value |

**Gas Cost:** ~2,000 gas

---

### getBoolParameter {#parametermanager-getboolparameter}

Gets bool parameter value. Type-safe accessor.

**Signature:**
```solidity
function getBoolParameter(string memory key) 
    external view 
    returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Parameter name |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | Parameter value (value != 0) |

**Gas Cost:** ~2,000 gas

---

### getAddressParameter {#parametermanager-getaddressparameter}

Gets address parameter value. Type-safe accessor.

**Signature:**
```solidity
function getAddressParameter(string memory key) 
    external view 
    returns (address)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Parameter name |

**Returns:**
| Type | Description |
|------|-------------|
| `address` | Parameter value as address |

**Gas Cost:** ~2,000 gas

---

### getStringParameter {#parametermanager-getstringparameter}

Gets string parameter value. Type-safe accessor.

**Signature:**
```solidity
function getStringParameter(string memory key) 
    external view 
    returns (string memory)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Parameter name |

**Returns:**
| Type | Description |
|------|-------------|
| `string` | Parameter value as string |

**Note:** Requires separate string storage mapping

**Gas Cost:** ~2,500 gas

---

### proposeBatchParameterChanges {#parametermanager-proposebatchparameterchanges}

Proposes multiple parameter changes as a batch.

**Signature:**
```solidity
function proposeBatchParameterChanges(
    string[] memory keys,
    bytes[] memory values,
    string memory description
) external returns (uint256[] memory proposalIds)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `keys` | `string[]` | Parameter names |
| `values` | `bytes[]` | Encoded values |
| `description` | `string` | Proposal description |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256[]` | Array of proposal IDs |

**Validations:**
- ✅ Arrays same length
- ✅ Max 20 parameters per batch
- ✅ All parameters exist

**Gas Cost:** ~100,000 + (n * 30,000) gas

---

### executeBatchProposals {#parametermanager-executebatchproposals}

Executes multiple proposals that have passed timelock.

**Signature:**
```solidity
function executeBatchProposals(uint256[] memory proposalIds) 
    external
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `proposalIds` | `uint256[]` | Proposal IDs to execute |

**Validations:**
- ✅ All proposals exist
- ✅ All timelocks expired
- ✅ Max 20 proposals per batch

**Gas Cost:** ~80,000 + (n * 40,000) gas

---

### proposeParameterChange (interface) {#parametermanager-proposeparameterchange-interface}

Interface version with additional parameters for governance tracking.

**Signature:**
```solidity
function proposeParameterChange(
    string memory key,
    uint256 value,
    string memory description
) external returns (uint256 proposalId)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Parameter name |
| `value` | `uint256` | New value |
| `description` | `string` | Proposal description |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Proposal ID for tracking |

**Gas Cost:** ~35,000 gas

---

### executeParameterChange (interface) {#parametermanager-executeparameterchange-interface}

Interface version that executes by proposal ID instead of name.

**Signature:**
```solidity
function executeParameterChange(uint256 proposalId) 
    external
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `proposalId` | `uint256` | Proposal ID to execute |

**Validations:**
- ✅ Proposal exists
- ✅ Timelock expired
- ✅ Not already executed

**Gas Cost:** ~40,000 gas

---

### registerParameter (interface) {#parametermanager-registerparameter-interface}

Interface version with simplified signature.

**Signature:**
```solidity
function registerParameter(
    string memory key,
    uint256 initialValue,
    uint256 minValue,
    uint256 maxValue
) external
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Parameter name |
| `initialValue` | `uint256` | Initial value |
| `minValue` | `uint256` | Minimum allowed value |
| `maxValue` | `uint256` | Maximum allowed value |

**Note:** Defaults requiresTimelock to true

**Gas Cost:** ~80,000 gas

---

### Default Parameters

**ParameterManager initializes these defaults on deployment:**

| Parameter | Default | Min | Max | Timelock Required |
|-----------|---------|-----|-----|-------------------|
| `maxDeposit` | 100 ETH | 1 ETH | 1000 ETH | ✅ |
| `maxWithdrawPerTx` | 50 ETH | 0.1 ETH | 500 ETH | ✅ |
| `minDeposit` | 0.000001 ETH | 0.000001 ETH | 1 ETH | ❌ |
| `minWithdraw` | 0.000001 ETH | 0.000001 ETH | 1 ETH | ❌ |
| `withdrawLimitPerHour` | 100 ETH | 1 ETH | 10000 ETH | ✅ |
| `maxSlippage` | 200 (2%) | 10 (0.1%) | 1000 (10%) | ✅ |
| `poolReserveRatio` | 0 (0%) | 0 | 5000 (50%) | ✅ |
| `cacheDuration` | 5 min | 1 min | 1 hour | ❌ |
| `maxPriceAge` | 1 hour | 5 min | 24 hours | ❌ |
| `maxTokensPerOperation` | 10 | 1 | 50 | ❌ |
| `maxErrors` | 3 | 1 | 100 | ❌ |

**Typed Access Functions:**

```solidity
function getUintParameter(string memory key) external view returns (uint256 value)
function getBoolParameter(string memory key) external view returns (bool value)
function getAddressParameter(string memory key) external view returns (address value)
function getStringParameter(string memory key) external view returns (string memory value)
```

**Batch Operations:**

```solidity
function proposeBatchParameterChanges(
    string[] memory keys,
    bytes[] memory values,
    string memory description
) external returns (uint256[] memory proposalIds)

function executeBatchProposals(uint256[] memory proposalIds) external
```

---

> **✅ ParameterManager Module Complete (34/34 functions documented)**

**Progress: 193/193 functions (100%)**

---

## 🎉 DOCUMENTATION COMPLETE

**All 8 modules fully documented:**
1. ✅ Beacon (16 functions)
2. ✅ ProxyGeneral (26 functions)
3. ✅ TokenManager (19 functions)
4. ✅ ValueCalculator (14 functions)
5. ✅ LiquidityManager (21 functions)
6. ✅ SwapManager (24 functions)
7. ✅ EmergencyHandler (39 functions)
8. ✅ ParameterManager (34 functions)

**Total: 193/193 functions documented (100%)**

---

## 📝 Documentation Status

**Version:** 3.0.0 - COMPLETE  
**Date:** November 17, 2025  
**Total Functions:** 193/193 (100%)

This comprehensive API reference includes:
- ✅ Complete function signatures with all parameters
- ✅ Detailed parameter and return value documentation
- ✅ Access control and validation requirements
- ✅ Event emissions with full struct definitions
- ✅ Gas cost estimates for all operations
- ✅ Practical usage examples with Solidity code
- ✅ Security notes and best practices
- ✅ Breaking changes and migration guides
- ✅ Interface compliance documentation

**Next Sections (To Be Added):**
- Architecture Overview - System design and module interactions
- Common Patterns - Reusable implementation patterns
- Events Index - Complete event reference
- Error Codes - Error messages and resolution
- Glossary - Technical terms and definitions

---

*For questions or clarifications, refer to the contract source code in `contracts/` or the detailed implementation guides in `docs/02_developers/`.*
