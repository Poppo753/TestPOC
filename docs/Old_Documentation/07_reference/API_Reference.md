# 📚 DeFi Modular System - API Reference

**Version:** 2.0.0  
**Last Updated:** October 23, 2025  
**Status:** Complete Implementation Blueprint  
**Authors:** System Architecture Team

---

## 📋 Version History & Breaking Changes

### Version 2.0.0 (October 23, 2025)

#### 🔄 Breaking Changes

**ProxyGeneral.authorizeModule()** - Enhanced Event Tracking
- **Previous Signature:** `authorizeModule(address module)`
- **New Signature:** `authorizeModule(address module, string memory moduleType)`
- **Impact:** API signature change - requires update in deployment scripts
- **Migration:**
  ```solidity
  // Before v2.0:
  proxyGeneral.authorizeModule(address(liquidityManager));
  
  // After v2.0:
  proxyGeneral.authorizeModule(address(liquidityManager), "LiquidityManager");
  ```
- **Rationale:** Enhanced event filtering and off-chain monitoring capabilities
- **Backward Compatibility:** Existing authorized modules remain functional, only new authorizations require the parameter

#### ✨ Enhancements
- Added `moduleType` parameter to `ModuleAuthorized` event for better tracking
- Improved event filtering capabilities for indexers and monitoring tools

---

## 📑 Table of Contents

### 🏗️ Core Infrastructure
- [Beacon](#beacon) - Central Registry for Module Resolution
- [ProxyGeneral](#proxygeneral) - Asset Custodian & LP Token Manager

### 📊 Data & Valuation Layer
- [TokenManager](#tokenmanager) - Token Registry & Chainlink Oracle Integration
- [ValueCalculator](#valuecalculator) - Pool Valuation Engine & Price Cache

### 💰 Liquidity Operations
- [LiquidityManager](#liquiditymanager) - Deposit & Withdrawal Management
- [SwapManager](#swapmanager) - DEX Integration & Token Swaps

### 🚨 Governance & Safety
- [EmergencyHandler](#emergencyhandler) - Emergency Pause & Recovery Procedures
- [ParameterManager](#parametermanager) - Dynamic Configuration Management

### 📖 Appendices
- [Architecture Overview](#architecture-overview) - System Design & Module Interactions
- [Common Patterns](#common-patterns) - Reusable Implementation Patterns
- [Events Index](#events-index) - Complete Event Reference
- [Error Codes](#error-codes) - Error Messages & Resolution
- [Enhancement Functions](#enhancement-functions) - Additional Utility & Monitoring Functions (Sprint 3)
- [Glossary](#glossary) - Technical Terms & Definitions

---

## 🔗 Beacon {#beacon}

**Purpose:** Central registry providing dynamic module address resolution for the entire system  
**Inheritance:** `Ownable`  
**Dependencies:** None (fully independent)  
**Storage Pattern:** Mapping-based registry

### Module Functions
- [getImplementation](#beacon-getimplementation) - Resolve module address
- [updateImplementation](#beacon-updateimplementation) - Update module address
- [transferOwnership](#beacon-transferownership) - Initiate ownership transfer
- [acceptOwnership](#beacon-acceptownership) - Accept ownership transfer

---

### getImplementation {#beacon-getimplementation}

Resolves a module name to its implementation contract address. This is the core function called by all modules for dynamic address resolution.

**Signature:**
```solidity
function getImplementation(string memory moduleName) 
    external view 
    returns (address)
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
- ✅ Module name must be non-empty
- ✅ Implementation address must exist (non-zero)
- ❌ Reverts with `"Implementation not found"` if module not registered

**Events Emitted:** None (view function)

**Gas Cost:** ~2,500 gas (single SLOAD)

**Usage Example:**
```solidity
IBeacon beacon = IBeacon(beaconAddress);
address proxyAddress = beacon.getImplementation("ProxyGeneral");
IProxyGeneral proxy = IProxyGeneral(proxyAddress);
```

**Called By:** 
- ProxyGeneral (for module authorization checks)
- TokenManager (for WETH exclusion validation)
- ValueCalculator (for all module resolutions)
- LiquidityManager (for dependency injection)
- SwapManager (for module coordination)
- EmergencyHandler (for emergency operations)
- ParameterManager (for emergency state checks)

**Security Notes:**
- View function - no state changes, safe for external calls
- Critical for system modularity - all modules depend on this

---

### updateImplementation {#beacon-updateimplementation}

Updates the implementation address for a specific module. This is the primary upgrade mechanism for the entire system.

**Signature:**
```solidity
function updateImplementation(string memory moduleName, address newImplementation) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `moduleName` | `string` | Name of the module to update (max 32 bytes) |
| `newImplementation` | `address` | New implementation contract address |

**Returns:** None (void)

**Access Control:** `onlyOwner` (restricted to contract owner)

**Validations:**
- ✅ Module name must be 1-32 bytes
- ✅ New implementation must be non-zero address
- ✅ New implementation must be a contract (not EOA)
- ✅ New implementation must differ from current one
- ❌ Reverts with `"Invalid module name"` if name is empty/too long
- ❌ Reverts with `"Invalid implementation address"` if zero address
- ❌ Reverts with `"Implementation must be a contract"` if EOA
- ❌ Reverts with `"Same implementation already set"` if unchanged

**Events Emitted:**
```solidity
event ImplementationUpdated(
    string indexed moduleName,
    address indexed oldImplementation,
    address indexed newImplementation
)
```

**Gas Cost:** ~45,000 gas (SSTORE + event emission)

**Usage Example:**
```solidity
// Deploy new version
LiquidityManagerV2 newLM = new LiquidityManagerV2(beaconAddress);

// Update registry (owner only)
beacon.updateImplementation("LiquidityManager", address(newLM));
```

**Security Notes:**
- ⚠️ **CRITICAL:** This function can upgrade any module - requires multi-sig in production
- ⚠️ Recommend timelock mechanism for production deployments
- ⚠️ Validate new implementation thoroughly before update
- ✅ Old implementation remains deployed (rollback possible)

**Best Practices:**
1. Test new implementation on testnet
2. Verify contract source code
3. Use timelock for upgrade delay
4. Announce upgrade to users in advance
5. Monitor system after upgrade

---

### transferOwnership {#beacon-transferownership}

Initiates a 2-step ownership transfer process. This is the first step - the new owner must accept ownership.

**Signature:**
```solidity
function transferOwnership(address newOwner) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newOwner` | `address` | Address of the proposed new owner |

**Returns:** None (void)

**Access Control:** `onlyOwner` (restricted to current owner)

**Validations:**
- ✅ New owner must be non-zero address
- ✅ New owner must differ from current owner
- ❌ Reverts with `"Invalid new owner"` if zero address
- ❌ Reverts with `"Already current owner"` if same address

**Events Emitted:**
```solidity
event OwnershipTransferStarted(
    address indexed previousOwner,
    address indexed newOwner
)
```

**Gas Cost:** ~30,000 gas (SSTORE + event)

**Usage Example:**
```solidity
// Initiate transfer to multi-sig
beacon.transferOwnership(multiSigAddress);

// New owner must call acceptOwnership()
```

**Security Notes:**
- ✅ 2-step process prevents accidental transfers to wrong address
- ✅ Old owner retains control until new owner accepts
- ⚠️ Pending transfer can be overwritten by calling again with different address

**Related Functions:**
- [acceptOwnership](#beacon-acceptownership) - Complete the transfer

---

### acceptOwnership {#beacon-acceptownership}

Completes the 2-step ownership transfer process. Must be called by the pending owner.

**Signature:**
```solidity
function acceptOwnership() 
    external
```

**Parameters:** None

**Returns:** None (void)

**Access Control:** `msg.sender` must be pending owner

**Validations:**
- ✅ Caller must be the pending owner
- ❌ Reverts with `"Not pending owner"` if unauthorized

**Events Emitted:**
```solidity
event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
)
```

**Gas Cost:** ~35,000 gas (2 SSTOREs + event)

**Usage Example:**
```solidity
// After transferOwnership was called by old owner:
// New owner accepts
beacon.acceptOwnership();
```

**Security Notes:**
- ✅ Only pending owner can complete transfer
- ✅ Clears pending owner after successful transfer
- ✅ Old owner loses all privileges immediately

**State Changes:**
- `owner` = `pendingOwner`
- `pendingOwner` = `address(0)`

---

## 🏛️ ProxyGeneral {#proxygeneral}

**Purpose:** Central asset custodian and LP token implementation. All ETH/ERC20 assets are held here.  
**Inheritance:** `ERC20`, `Ownable`  
**Dependencies:** Beacon (for module authorization)  
**Token Standard:** ERC20 (LP tokens)

### Module Functions

**LP Token Management:**
- [mint](#proxygeneral-mint) - Mint LP tokens
- [burn](#proxygeneral-burn) - Burn LP tokens
- [balanceOf](#proxygeneral-balanceof) - Check LP balance
- [totalSupply](#proxygeneral-totalsupply) - Total LP supply

**Asset Management:**
- [transferFunds](#proxygeneral-transferfunds) - Transfer assets
- [getAssetBalance](#proxygeneral-getassetbalance) - Query asset balance
- [approveSpender](#proxygeneral-approvespender) - Approve token spender

**Access Control:**
- [authorizeModule](#proxygeneral-authorizemodule) - Add authorized module
- [deauthorizeModule](#proxygeneral-deauthorizemodule) - Remove authorized module
- [isAuthorizedModule](#proxygeneral-isauthorizedmodule) - Check authorization

**Emergency Controls:**
- [pause](#proxygeneral-pause) - Pause all operations
- [unpause](#proxygeneral-unpause) - Resume operations
- [isPaused](#proxygeneral-ispaused) - Check pause state
- [emergencyTransferAll](#proxygeneral-emergencytransferall) - Emergency asset recovery

**Rate Limiting:**
- [getHourlyWithdrawn](#proxygeneral-gethourlywithdrawn) - Get hourly withdrawn amount
- [incrementHourlyWithdrawn](#proxygeneral-incrementhourlywithdrawn) - Update hourly limit

---

### mint {#proxygeneral-mint}

Mints LP tokens to a user address. Only callable by authorized modules (typically LiquidityManager during deposits).

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
| `to` | `address` | Recipient address to receive LP tokens |
| `amount` | `uint256` | Amount of LP tokens to mint (18 decimals) |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule` (restricted to authorized modules)

**Validations:**
- ✅ Recipient must be non-zero address
- ✅ Amount must be greater than zero
- ✅ Contract must not be paused
- ✅ Caller must be authorized module
- ❌ Reverts with `"Cannot mint to zero address"` if zero address
- ❌ Reverts with `"Cannot mint zero amount"` if zero amount
- ❌ Reverts with `"Contract is paused"` if system paused
- ❌ Reverts with `"Caller not authorized"` if unauthorized

**Events Emitted:**
```solidity
event LPTokenMinted(
    address indexed to,
    uint256 amount,
    uint256 newTotalSupply
)
```

**Gas Cost:** ~50,000 gas (SSTORE + event emission)

**Usage Example:**
```solidity
// Called by LiquidityManager during deposit
IProxyGeneral proxy = IProxyGeneral(proxyAddress);
proxy.mint(user, lpTokensToMint);
```

**State Changes:**
- User's LP token balance increases by `amount`
- Total supply increases by `amount`

**Security Notes:**
- ✅ Only authorized modules can mint (prevents unauthorized inflation)
- ✅ Respects pause state for emergency situations
- ⚠️ No maximum supply check - ensure proper validation in calling module

**Called By:**
- LiquidityManager.deposit() - Main use case for user deposits

**Related Functions:**
- [burn](#proxygeneral-burn) - Opposite operation (burns LP tokens)
- [balanceOf](#proxygeneral-balanceof) - Check LP token balance

---

### burn {#proxygeneral-burn}

Burns LP tokens from a user address. Only callable by authorized modules (typically LiquidityManager during withdrawals).

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
| `from` | `address` | Address to burn LP tokens from |
| `amount` | `uint256` | Amount of LP tokens to burn (18 decimals) |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule` (restricted to authorized modules)

**Validations:**
- ✅ Source address must be non-zero
- ✅ Amount must be greater than zero
- ✅ User must have sufficient LP token balance
- ✅ Contract must not be paused
- ✅ Caller must be authorized module
- ❌ Reverts with `"Cannot burn from zero address"` if zero address
- ❌ Reverts with `"Cannot burn zero amount"` if zero amount
- ❌ Reverts with `"Insufficient LP token balance"` if insufficient balance
- ❌ Reverts with `"Contract is paused"` if system paused
- ❌ Reverts with `"Caller not authorized"` if unauthorized

**Events Emitted:**
```solidity
event LPTokenBurned(
    address indexed from,
    uint256 amount,
    uint256 newTotalSupply
)
```

**Gas Cost:** ~45,000 gas (SSTORE + event emission)

**Usage Example:**
```solidity
// Called by LiquidityManager during withdrawal
IProxyGeneral proxy = IProxyGeneral(proxyAddress);
proxy.burn(user, lpTokensToBurn);
```

**State Changes:**
- User's LP token balance decreases by `amount`
- Total supply decreases by `amount`

**Security Notes:**
- ✅ Validates sufficient balance before burning
- ✅ Only authorized modules can burn (prevents unauthorized deflation)
- ✅ Respects pause state for emergency situations

**Called By:**
- LiquidityManager.withdraw() - Main use case for user withdrawals

**Related Functions:**
- [mint](#proxygeneral-mint) - Opposite operation (mints LP tokens)
- [balanceOf](#proxygeneral-balanceof) - Check LP token balance before burning

---

### balanceOf {#proxygeneral-balanceof}

Returns the LP token balance for a specific address. Standard ERC20 function.

**Signature:**
```solidity
function balanceOf(address account) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `account` | `address` | Address to query LP token balance for |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | LP token balance (18 decimals) |

**Access Control:** `public view` (no restrictions)

**Validations:** None (standard ERC20 behavior)

**Events Emitted:** None (view function)

**Gas Cost:** ~800 gas (single SLOAD)

**Usage Example:**
```solidity
uint256 userLPBalance = proxyGeneral.balanceOf(userAddress);
console.log("User holds:", userLPBalance, "LP tokens");
```

**Security Notes:**
- ✅ Standard ERC20 implementation
- ✅ No state changes possible

**Called By:** 
- LiquidityManager (withdrawal validation)
- User interfaces (display balance)
- Smart contracts (balance checks)

---

### totalSupply {#proxygeneral-totalsupply}

Returns the total supply of LP tokens in circulation. Standard ERC20 function.

**Signature:**
```solidity
function totalSupply() 
    external view 
    returns (uint256)
```

**Parameters:** None

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Total LP token supply (18 decimals) |

**Access Control:** `public view` (no restrictions)

**Validations:** None

**Events Emitted:** None (view function)

**Gas Cost:** ~400 gas (single SLOAD)

**Usage Example:**
```solidity
uint256 totalLP = proxyGeneral.totalSupply();
uint256 userShare = (userBalance * 10000) / totalLP; // Basis points
```

**Security Notes:**
- ✅ Used for calculating user's proportional share of pool
- ✅ Always reflects sum of all minted - burned LP tokens

**Called By:**
- LiquidityManager (share calculations)
- ValueCalculator (proportional value calculations)
- Analytics/monitoring systems

---

### transferFunds {#proxygeneral-transferfunds}

Transfers ERC20 tokens or WETH from ProxyGeneral to a specified address. Critical function for asset management.

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
| `to` | `address` | Recipient address for the asset transfer |
| `asset` | `address` | ERC20 token contract address (or WETH) |
| `amount` | `uint256` | Amount of tokens to transfer (in token's decimals) |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule` (restricted to authorized modules)

**Validations:**
- ✅ Recipient must be non-zero address
- ✅ Asset address must be non-zero
- ✅ Amount must be greater than zero
- ✅ ProxyGeneral must have sufficient asset balance
- ✅ Transfer must succeed
- ❌ Reverts with `"Invalid recipient"` if zero address
- ❌ Reverts with `"Invalid asset"` if zero address
- ❌ Reverts with `"Invalid amount"` if zero amount
- ❌ Reverts with `"Insufficient asset balance"` if balance too low
- ❌ Reverts with `"Asset transfer failed"` if ERC20 transfer fails

**Events Emitted:**
```solidity
event AssetTransferred(
    address indexed to,
    address indexed asset,
    uint256 amount,
    address indexed module
)
```

**Gas Cost:** ~55,000 gas (ERC20 transfer + event)

**Usage Example:**
```solidity
// Transfer WETH to user during withdrawal
IProxyGeneral proxy = IProxyGeneral(proxyAddress);
proxy.transferFunds(user, wethAddress, wethAmount);
```

**State Changes:**
- ProxyGeneral's asset balance decreases by `amount`
- Recipient's asset balance increases by `amount`

**Security Notes:**
- ⚠️ **CRITICAL:** Only authorized modules can call this
- ✅ Validates balance before transfer
- ✅ Uses safe ERC20 transfer patterns
- ⚠️ Ensure calling module validates recipient address

**Called By:**
- LiquidityManager (withdraw operations, fee transfers)
- SwapManager (transferring tokens for swaps)
- EmergencyHandler (emergency asset recovery)

**Related Functions:**
- [getAssetBalance](#proxygeneral-getassetbalance) - Check balance before transfer
- [approveSpender](#proxygeneral-approvespender) - Related to swap approvals

---

### getAssetBalance {#proxygeneral-getassetbalance}

Queries the balance of a specific ERC20 token or WETH held by ProxyGeneral.

**Signature:**
```solidity
function getAssetBalance(address asset) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `asset` | `address` | ERC20 token contract address to query |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Token balance held by ProxyGeneral (in token's decimals) |

**Access Control:** `public view` (no restrictions)

**Validations:** None (delegates to ERC20.balanceOf)

**Events Emitted:** None (view function)

**Gas Cost:** ~2,500 gas (external call to ERC20)

**Usage Example:**
```solidity
uint256 wethBalance = proxyGeneral.getAssetBalance(wethAddress);
uint256 arbBalance = proxyGeneral.getAssetBalance(arbTokenAddress);
```

**Security Notes:**
- ✅ Read-only, no security concerns
- ✅ Used extensively for validation and calculations

**Called By:**
- ValueCalculator (for pool valuation)
- LiquidityManager (withdrawal validation)
- SwapManager (swap feasibility checks)
- Monitoring/analytics systems

**Related Functions:**
- [transferFunds](#proxygeneral-transferfunds) - Transfer assets out

---

### approveSpender {#proxygeneral-approvespender}

Approves an external spender (e.g., DEX router) to spend ProxyGeneral's tokens. Required for swap operations.

**Signature:**
```solidity
function approveSpender(address token, address spender, uint256 amount) 
    external 
    onlyAuthorizedModule
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `token` | `address` | ERC20 token contract to approve |
| `spender` | `address` | Address authorized to spend tokens (e.g., SimpleSwap router) |
| `amount` | `uint256` | Approval amount (use `type(uint256).max` for unlimited) |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule` (restricted to authorized modules)

**Validations:**
- ✅ Token address must be non-zero
- ✅ Spender address must be non-zero
- ❌ Reverts with `"Invalid token"` if zero address
- ❌ Reverts with `"Invalid spender"` if zero address

**Events Emitted:**
```solidity
event SpenderApproved(
    address indexed token,
    address indexed spender,
    uint256 amount,
    address indexed module
)
```

**Gas Cost:** ~46,000 gas (ERC20 approve + event)

**Usage Example:**
```solidity
// Before swap: approve SimpleSwap router
IProxyGeneral proxy = IProxyGeneral(proxyAddress);
proxy.approveSpender(arbToken, simpleSwapRouter, arbAmount);

// Now router can swap ARB → WETH
```

**Security Notes:**
- ⚠️ **CRITICAL:** Approve only trusted spenders (DEX routers)
- ✅ Recommend approving exact amount needed (not unlimited)
- ⚠️ Reset approval to 0 after swap to prevent leftover approvals
- ✅ Only authorized modules can approve (prevents malicious approvals)

**Best Practices:**
1. Approve exact amount before swap
2. Check if swap succeeded
3. Optionally reset approval to 0 after swap

**Called By:**
- SwapManager (before executing DEX swaps)

**Related Functions:**
- [transferFunds](#proxygeneral-transferfunds) - Transfer approved tokens

---

### authorizeModule {#proxygeneral-authorizemodule}

Adds a module to the authorized list, allowing it to call restricted functions.

**Signature:**
```solidity
function authorizeModule(address module, string memory moduleType) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `module` | `address` | Module contract address to authorize |
| `moduleType` | `string` | Type identifier for the module (e.g., "LiquidityManager", "SwapManager", "TokenManager") |

**Returns:** None (void)

**Access Control:** `onlyOwner` (restricted to contract owner)

**Validations:**
- ✅ Module address must be non-zero
- ✅ Module must not already be authorized
- ❌ Reverts with `"Invalid module address"` if zero address
- ❌ Reverts with `"Module already authorized"` if duplicate

**Events Emitted:**
```solidity
event ModuleAuthorized(address indexed module, string moduleType)
```

**Event Parameters:**
- `module` (indexed): Address of the authorized module
- `moduleType`: String identifier for better event tracking and filtering (e.g., "LiquidityManager")

**Gas Cost:** ~45,000 gas (SSTORE + event)

**Usage Example:**
```solidity
// After deploying new LiquidityManager v2
LiquidityManagerV2 newLM = new LiquidityManagerV2(beaconAddress);
proxyGeneral.authorizeModule(address(newLM), "LiquidityManager");

// Now LiquidityManagerV2 can call mint/burn/transferFunds

// Authorize other modules with descriptive types
proxyGeneral.authorizeModule(address(swapManager), "SwapManager");
proxyGeneral.authorizeModule(address(tokenManager), "TokenManager");
```

**State Changes:**
- `authorizedModules[module]` = `true`

**Security Notes:**
- ⚠️ **CRITICAL:** Only authorize trusted modules - they get full asset access
- ✅ Owner-only function prevents unauthorized module additions
- ⚠️ Recommend multi-sig for module authorization in production

**Best Practices:**
1. Audit module code thoroughly before authorization
2. Test module on testnet first
3. Use multi-sig for production authorization
4. Document why module was authorized
5. Use descriptive `moduleType` strings for easier event filtering and monitoring

**Implementation Notes:**
- ⚠️ **API Change (v2.0):** Added `moduleType` parameter for enhanced event tracking
- ✅ **Backward Compatibility:** Existing authorized modules are not affected
- 📋 **Migration:** Update deployment scripts to include `moduleType` parameter
  ```solidity
  // Old (pre-v2.0):
  // proxyGeneral.authorizeModule(address(module));
  
  // New (v2.0+):
  proxyGeneral.authorizeModule(address(module), "ModuleName");
  ```
- ℹ️ **Rationale:** `moduleType` parameter improves:
  - Event log filtering and monitoring
  - Debugging and auditing capabilities
  - Off-chain indexing and analytics

**Called By:** Owner during system setup or upgrades

**Related Functions:**
- [deauthorizeModule](#proxygeneral-deauthorizemodule) - Remove authorization
- [isAuthorizedModule](#proxygeneral-isauthorizedmodule) - Check authorization status

---

### deauthorizeModule {#proxygeneral-deauthorizemodule}

Removes a module from the authorized list, revoking its access to restricted functions.

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

**Access Control:** `onlyOwner` (restricted to contract owner)

**Validations:**
- ✅ Module must currently be authorized
- ❌ Reverts with `"Module not authorized"` if not in list

**Events Emitted:**
```solidity
event ModuleDeauthorized(address indexed module)
```

**Gas Cost:** ~30,000 gas (SSTORE + event)

**Usage Example:**
```solidity
// Deprecate old LiquidityManager after upgrade
proxyGeneral.deauthorizeModule(oldLiquidityManagerAddress);

// Old version can no longer call restricted functions
```

**State Changes:**
- `authorizedModules[module]` = `false`

**Security Notes:**
- ✅ Immediately revokes all module privileges
- ⚠️ Ensure no pending operations from module before deauthorizing
- ✅ Can be used to quickly disable compromised module

**Best Practices:**
1. Verify module has no pending operations
2. Notify users if module is being deprecated
3. Update Beacon to point to new module if applicable

**Called By:** Owner during module deprecation or security response

**Related Functions:**
- [authorizeModule](#proxygeneral-authorizemodule) - Add authorization
- [isAuthorizedModule](#proxygeneral-isauthorizedmodule) - Check status

---

### isAuthorizedModule {#proxygeneral-isauthorizedmodule}

Checks if an address is currently authorized to call restricted functions.

**Signature:**
```solidity
function isAuthorizedModule(address module) 
    external view 
    returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `module` | `address` | Address to check authorization for |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | `true` if authorized, `false` otherwise |

**Access Control:** `public view` (no restrictions)

**Validations:** None

**Events Emitted:** None (view function)

**Gas Cost:** ~800 gas (single SLOAD)

**Usage Example:**
```solidity
if (proxyGeneral.isAuthorizedModule(msg.sender)) {
    // Caller is authorized
    proxyGeneral.mint(user, amount);
}
```

**Security Notes:**
- ✅ Used internally by `onlyAuthorizedModule` modifier
- ✅ Can be called externally for pre-flight checks

**Called By:**
- Internal modifier checks
- External monitoring systems

---

### pause {#proxygeneral-pause}

Pauses all operations that modify state (except unpause and emergency functions). Part of emergency response system.

**Signature:**
```solidity
function pause() 
    external 
    onlyAuthorizedModule
```

**Parameters:** None

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule` (any authorized module can pause)

**Validations:**
- ✅ Must not already be paused
- ❌ Reverts with `"Already paused"` if already paused

**Events Emitted:**
```solidity
event Paused(address indexed account)
```

**Gas Cost:** ~30,000 gas (SSTORE + event)

**Usage Example:**
```solidity
// EmergencyHandler triggers pause
IProxyGeneral proxy = IProxyGeneral(proxyAddress);
proxy.pause();

// Now: mint/burn/transferFunds blocked
// deposit/withdraw operations halted
```

**State Changes:**
- `paused` = `true`

**What Gets Blocked:**
- ✅ mint() - No new LP token minting
- ✅ burn() - No LP token burning
- ✅ transferFunds() - No asset transfers
- ✅ All state-changing functions with `whenNotPaused` modifier

**What Still Works:**
- ✅ View functions (balanceOf, getAssetBalance, etc.)
- ✅ unpause() - Can be called to resume
- ✅ emergencyTransferAll() - Emergency recovery

**Security Notes:**
- ✅ Critical emergency mechanism to halt operations
- ✅ Any authorized module can trigger (fast response)
- ⚠️ Only owner can unpause (prevents premature resume)
- ✅ Typically called by EmergencyHandler

**Called By:**
- EmergencyHandler.triggerEmergencyPause()

**Related Functions:**
- [unpause](#proxygeneral-unpause) - Resume operations
- [isPaused](#proxygeneral-ispaused) - Check pause state

---

### unpause {#proxygeneral-unpause}

Resumes normal operations after emergency pause has been resolved.

**Signature:**
```solidity
function unpause() 
    external 
    onlyOwner
```

**Parameters:** None

**Returns:** None (void)

**Access Control:** `onlyOwner` (restricted to contract owner only)

**Validations:**
- ✅ Must currently be paused
- ❌ Reverts with `"Not paused"` if not paused

**Events Emitted:**
```solidity
event Unpaused(address indexed account)
```

**Gas Cost:** ~30,000 gas (SSTORE + event)

**Usage Example:**
```solidity
// After resolving emergency issue
proxyGeneral.unpause();

// System resumes normal operations
```

**State Changes:**
- `paused` = `false`

**Security Notes:**
- ✅ Owner-only prevents unauthorized resume
- ⚠️ Recommend thorough validation before unpausing
- ✅ EmergencyHandler may enforce timelock before unpause

**Best Practices:**
1. Verify emergency issue is resolved
2. Test system state after unpause
3. Communicate resume to users
4. Monitor system closely after resume

**Called By:** 
- Owner directly
- EmergencyHandler.unpause() (after timelock)

**Related Functions:**
- [pause](#proxygeneral-pause) - Trigger pause
- [isPaused](#proxygeneral-ispaused) - Check state

---

### isPaused {#proxygeneral-ispaused}

Returns the current pause state of the system.

**Signature:**
```solidity
function isPaused() 
    external view 
    returns (bool)
```

**Parameters:** None

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | `true` if paused, `false` if operating normally |

**Access Control:** `public view` (no restrictions)

**Validations:** None

**Events Emitted:** None (view function)

**Gas Cost:** ~400 gas (single SLOAD)

**Usage Example:**
```solidity
if (proxyGeneral.isPaused()) {
    revert("System is paused - operations disabled");
}

// Proceed with operation
```

**Security Notes:**
- ✅ Called by all modules before critical operations
- ✅ Used by UI to display system status

**Called By:**
- LiquidityManager (before deposit/withdraw)
- EmergencyHandler (state checks)
- User interfaces (display status)

---

### emergencyTransferAll {#proxygeneral-emergencytransferall}

Transfers all assets (WETH + supported tokens) to a safe recipient address during emergency situations.

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
| `recipient` | `address` | Safe address to receive all assets (e.g., multi-sig) |

**Returns:** None (void)

**Access Control:** `onlyOwner` + `whenPaused` (double protection)

**Validations:**
- ✅ Must be paused before emergency transfer
- ✅ Recipient must be non-zero address
- ❌ Reverts with `"Must be paused for emergency"` if not paused
- ❌ Reverts with `"Invalid recipient"` if zero address

**Events Emitted:**
```solidity
event EmergencyTransferExecuted(
    address indexed recipient,
    uint256 timestamp
)

// For each asset transferred:
event AssetTransferred(
    address indexed to,
    address indexed asset,
    uint256 amount,
    address indexed module
)
```

**Gas Cost:** ~150,000 gas + (50,000 per token) - Varies with token count

**Usage Example:**
```solidity
// After critical vulnerability discovered:
// 1. Pause system
proxyGeneral.pause();

// 2. Transfer all assets to multi-sig
proxyGeneral.emergencyTransferAll(multiSigAddress);

// 3. Assets now safe, can be redistributed after fix
```

**Assets Transferred:**
1. WETH balance
2. All active tokens from TokenManager registry

**State Changes:**
- All asset balances in ProxyGeneral → 0
- Recipient receives all assets
- `emergencyRecipient` and `emergencyExecutedAt` recorded

**Security Notes:**
- ⚠️ **NUCLEAR OPTION:** Only use for critical emergencies
- ✅ Requires pause first (prevents accidental execution)
- ✅ Owner-only (highest privilege level)
- ✅ All transfers logged for transparency
- ⚠️ Consider timelock in production for added safety

**Best Practices:**
1. Only use for contract bug/hack/critical vulnerability
2. Communicate with community immediately
3. Document reason for emergency transfer
4. Plan asset redistribution strategy
5. Fix vulnerability before redeploying

**Called By:** Owner during critical emergency scenarios

**Related Functions:**
- [pause](#proxygeneral-pause) - Must be called first
- EmergencyHandler.emergencyWithdraw() - Wrapper with additional checks

---

### getHourlyWithdrawn {#proxygeneral-gethourlywithdrawn}

Retrieves the amount withdrawn by a user during a specific hour. Used for rate limiting enforcement.

**Signature:**
```solidity
function getHourlyWithdrawn(address user, uint256 hour) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User address to query |
| `hour` | `uint256` | Hour timestamp (calculated as `block.timestamp / 1 hours`) |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Total amount withdrawn in ETH during that hour |

**Access Control:** `public view` (no restrictions)

**Validations:** None

**Events Emitted:** None (view function)

**Gas Cost:** ~2,500 gas (nested mapping SLOAD)

**Usage Example:**
```solidity
uint256 currentHour = block.timestamp / 1 hours;
uint256 withdrawn = proxyGeneral.getHourlyWithdrawn(user, currentHour);
uint256 remaining = hourlyLimit - withdrawn;
```

**Security Notes:**
- ✅ Critical for enforcing withdrawal limits
- ✅ Separate tracking per hour prevents limit circumvention
- ✅ Read-only, no manipulation possible

**Called By:**
- LiquidityManager.checkWithdrawLimits()
- LiquidityManager.getRemainingHourlyLimit()

**Related Functions:**
- [incrementHourlyWithdrawn](#proxygeneral-incrementhourlywithdrawn) - Update after withdrawal

---

### incrementHourlyWithdrawn {#proxygeneral-incrementhourlywithdrawn}

Updates the hourly withdrawn amount for a user after a successful withdrawal. Core rate limiting mechanism.

**Signature:**
```solidity
function incrementHourlyWithdrawn(address user, uint256 amount) 
    external 
    onlyAuthorizedModule
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User who withdrew funds |
| `amount` | `uint256` | Amount withdrawn in ETH (18 decimals) |

**Returns:** None (void)

**Access Control:** `onlyAuthorizedModule` (restricted to authorized modules)

**Validations:**
- ✅ Caller must be authorized module
- ❌ Reverts with `"Caller not authorized"` if unauthorized

**Events Emitted:**
```solidity
event HourlyWithdrawnIncremented(
    address indexed user,
    uint256 hour,
    uint256 amount
)
```

**Gas Cost:** ~45,000 gas (SSTORE + event)

**Usage Example:**
```solidity
// After successful withdrawal in LiquidityManager
uint256 currentHour = block.timestamp / 1 hours;
proxyGeneral.incrementHourlyWithdrawn(user, ethAmount);

// User's hourly limit now reduced by ethAmount
```

**State Changes:**
- `hourlyWithdrawnAmounts[user][currentHour]` += `amount`

**Security Notes:**
- ✅ Only authorized modules can update (prevents manipulation)
- ✅ Increment pattern prevents race conditions
- ✅ Per-hour tracking prevents circumventing limits

**Best Practices:**
1. Always increment AFTER successful withdrawal
2. Use exact withdrawal amount (not requested amount)
3. Check limits BEFORE withdrawal, update AFTER

**Called By:**
- LiquidityManager.withdraw() - After successful withdrawal

**Related Functions:**
- [getHourlyWithdrawn](#proxygeneral-gethourlywithdrawn) - Query current amount
- LiquidityManager.checkWithdrawLimits() - Validate before withdrawal

---

## 🏦 TokenManager {#tokenmanager}

**Purpose:** Registry for supported tokens and Chainlink price feed integration  
**Inheritance:** `Ownable`  
**Dependencies:** Beacon, Chainlink Aggregator interfaces  
**Max Tokens:** Configurable (default: 20)

### Module Functions

**Token Management:**
- [manageTokenData](#tokenmanager-managetokendata) - Add/update token
- [removeToken](#tokenmanager-removetoken) - Deactivate token
- [updateHeartbeat](#tokenmanager-updateheartbeat) - Update price staleness check

**Token Queries:**
- [isTokenActive](#tokenmanager-istokenactive) - Check if token is active
- [getTokenAddress](#tokenmanager-gettokenaddress) - Get token contract address
- [getTokenInfo](#tokenmanager-gettokeninfo) - Get full token information
- [getActiveTokens](#tokenmanager-getactivetokens) - List all active tokens
- [getTokenCount](#tokenmanager-gettokencount) - Count of active tokens

**Price Feeds:**
- [getTokenPrice](#tokenmanager-gettokenprice) - Get token price (view)
- [getTokenPriceWithEvents](#tokenmanager-gettokenpricewithevents) - Get price with error tracking

**Error Management:**
- [getTokenErrors](#tokenmanager-gettokenerrors) - Get error count
- [resetTokenErrors](#tokenmanager-resettokenerrors) - Reset error counter

---

### manageTokenData {#tokenmanager-managetokendata}

Adds a new token to the registry or updates an existing token's configuration. Performs comprehensive validation including Chainlink price feed verification.

**Signature:**
```solidity
function manageTokenData(
    string memory tokenCode,
    address tokenAddress,
    address priceFeed,
    uint8 tokenDecimals,
    uint8 priceFeedDecimals,
    uint256 heartbeat
) external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Unique identifier for token (e.g., "ARB", "USDC") - max 16 bytes |
| `tokenAddress` | `address` | ERC20 token contract address |
| `priceFeed` | `address` | Chainlink price feed aggregator address |
| `tokenDecimals` | `uint8` | Token decimals (e.g., 18 for ARB, 6 for USDC) |
| `priceFeedDecimals` | `uint8` | Chainlink feed decimals (typically 8) |
| `heartbeat` | `uint256` | Maximum acceptable price staleness in seconds |

**Returns:** None (void)

**Access Control:** `onlyOwner` (restricted to contract owner)

**Validations:**
- ✅ Token code must be 1-16 bytes
- ✅ Token address must be non-zero and valid contract
- ✅ Price feed address must be non-zero
- ✅ Heartbeat must be greater than zero
- ✅ **CRITICAL:** Token cannot be WETH (WETH is handled separately)
- ✅ Total token count must not exceed `maxTokensPerOperation`
- ✅ Price feed must respond with valid data
- ✅ Price must be > 0
- ✅ Price must be recently updated
- ✅ Round must not be stale (answeredInRound >= roundId)
- ❌ Reverts with `"Invalid token code"` if empty or >16 bytes
- ❌ Reverts with `"Cannot add WETH as token"` if WETH address
- ❌ Reverts with `"Too many tokens"` if limit exceeded
- ❌ Reverts with `"Price feed validation failed"` if Chainlink call fails

**Events Emitted:**
```solidity
event TokenAdded(
    string indexed tokenCode,
    address indexed tokenAddress,
    address indexed priceFeed
)
```

**Gas Cost:** ~120,000 gas (multiple SSTOREs + Chainlink call + event)

**Usage Example:**
```solidity
// Add ARB token with Chainlink feed
tokenManager.manageTokenData(
    "ARB",                              // tokenCode
    0x912CE59144191C1204E64559FE8253a0e49E6548, // ARB token address
    0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6, // ARB/USD Chainlink feed
    18,                                  // ARB has 18 decimals
    8,                                   // Chainlink feeds typically 8 decimals
    86400                                // 24 hour heartbeat
);
```

**State Changes:**
- `tokenData[tokenCode]` = new TokenInfo struct
- `tokenCodes` array updated (if new token)
- `tokenCodesCount` incremented (if new token)
- `tokenErrors[tokenCode]` reset to 0

**Security Notes:**
- ⚠️ **CRITICAL:** WETH exclusion prevents double-counting (WETH tracked separately)
- ⚠️ Verify Chainlink feed address is correct for network (Arbitrum feeds)
- ✅ Price feed validation prevents adding broken oracles
- ⚠️ Recommend testing on testnet before mainnet

**Chainlink Integration:**
- Calls `latestRoundData()` to validate feed
- Checks for stale data via `answeredInRound` comparison
- Validates price is positive and recently updated

**Best Practices:**
1. Use official Chainlink feed addresses for network
2. Set appropriate heartbeat (24h for most feeds, 1h for volatile assets)
3. Test feed responds correctly before adding
4. Document why token was added

**Called By:** Owner during system configuration or token additions

**Related Functions:**
- [removeToken](#tokenmanager-removetoken) - Deactivate token
- [updateHeartbeat](#tokenmanager-updateheartbeat) - Adjust staleness threshold

---

### removeToken {#tokenmanager-removetoken}

Deactivates a token from the registry. Token data remains but `isActive` flag is set to false.

**Signature:**
```solidity
function removeToken(string memory tokenCode) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier to deactivate |

**Returns:** None (void)

**Access Control:** `onlyOwner` (restricted to contract owner)

**Validations:**
- ✅ Token must currently be active
- ❌ Reverts with `"Token not active"` if already inactive or not found

**Events Emitted:**
```solidity
event TokenRemoved(string indexed tokenCode)
```

**Gas Cost:** ~35,000 gas (SSTORE + array manipulation + event)

**Usage Example:**
```solidity
// Deprecate USDC token (e.g., if oracle fails)
tokenManager.removeToken("USDC");

// Token no longer included in calculations
```

**State Changes:**
- `tokenData[tokenCode].isActive` = `false`
- Token removed from `tokenCodes` array (swap & pop pattern)
- `tokenCodesCount` decremented

**Security Notes:**
- ✅ Does not delete token data (can be reactivated if needed)
- ⚠️ Ensure pool has no significant balance of token before removing
- ⚠️ Removing active token affects pool value calculations

**Best Practices:**
1. Swap token balance to other assets before removal
2. Notify users of token deprecation
3. Document removal reason
4. Consider emergency pause if rapid removal needed

**Called By:** Owner during token deprecation or emergency response

**Related Functions:**
- [manageTokenData](#tokenmanager-managetokendata) - Can reactivate by calling again
- [isTokenActive](#tokenmanager-istokenactive) - Check token status

---

### updateHeartbeat {#tokenmanager-updateheartbeat}

Updates the heartbeat (staleness threshold) for a token's price feed.

**Signature:**
```solidity
function updateHeartbeat(string memory tokenCode, uint256 newHeartbeat) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier |
| `newHeartbeat` | `uint256` | New heartbeat in seconds |

**Returns:** None (void)

**Access Control:** `onlyOwner` (restricted to contract owner)

**Validations:**
- ✅ Token must be active
- ✅ New heartbeat must be > 0
- ❌ Reverts with `"Token not active"` if inactive
- ❌ Reverts with `"Invalid heartbeat"` if zero

**Events Emitted:**
```solidity
event HeartbeatUpdated(
    string indexed tokenCode,
    uint256 newHeartbeat
)
```

**Gas Cost:** ~30,000 gas (SSTORE + event)

**Usage Example:**
```solidity
// Increase ARB heartbeat to 2 hours due to low volatility
tokenManager.updateHeartbeat("ARB", 7200);

// Now prices up to 2 hours old are acceptable
```

**State Changes:**
- `tokenData[tokenCode].heartbeat` = `newHeartbeat`

**Security Notes:**
- ⚠️ Longer heartbeat = less strict staleness check
- ⚠️ Shorter heartbeat = more frequent price rejections
- ✅ Balance between reliability and data freshness

**Recommended Heartbeats:**
- High volatility assets (ETH, BTC): 1 hour (3600s)
- Mid volatility (altcoins): 24 hours (86400s)
- Stablecoins: 24+ hours (86400s+)

**Called By:** Owner to adjust staleness sensitivity

**Related Functions:**
- [getTokenPrice](#tokenmanager-gettokenprice) - Uses heartbeat for staleness check

---

### isTokenActive {#tokenmanager-istokenactive}

Checks if a token is currently active in the registry.

**Signature:**
```solidity
function isTokenActive(string memory tokenCode) 
    external view 
    returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier to check |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | `true` if token is active, `false` otherwise |

**Access Control:** `public view` (no restrictions)

**Gas Cost:** ~2,500 gas (mapping SLOAD)

**Usage Example:**
```solidity
if (tokenManager.isTokenActive("ARB")) {
    // Proceed with ARB operations
}
```

**Called By:** All modules before token operations

---

### getTokenAddress {#tokenmanager-gettokenaddress}

Retrieves the contract address for a token.

**Signature:**
```solidity
function getTokenAddress(string memory tokenCode) 
    external view 
    returns (address)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier |

**Returns:**
| Type | Description |
|------|-------------|
| `address` | ERC20 token contract address |

**Access Control:** `public view`

**Validations:**
- ✅ Token must be active
- ❌ Reverts with `"Token not active"` if inactive

**Gas Cost:** ~2,800 gas

**Usage Example:**
```solidity
address arbToken = tokenManager.getTokenAddress("ARB");
uint256 balance = IERC20(arbToken).balanceOf(proxyGeneral);
```

**Called By:** ValueCalculator, SwapManager, monitoring systems

---

### getTokenInfo {#tokenmanager-gettokeninfo}

Retrieves complete TokenInfo struct for a token.

**Signature:**
```solidity
function getTokenInfo(string memory tokenCode) 
    external view 
    returns (TokenInfo memory)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier |

**Returns:**
| Type | Description |
|------|-------------|
| `TokenInfo` | Complete token data struct including address, decimals, price feed, heartbeat, etc. |

**Access Control:** `public view`

**Validations:**
- ✅ Token must be active
- ❌ Reverts with `"Token not active"` if inactive

**Gas Cost:** ~3,500 gas (multiple SLOADs)

**Usage Example:**
```solidity
TokenInfo memory info = tokenManager.getTokenInfo("USDC");
console.log("Decimals:", info.tokenDecimals);
console.log("Price Feed:", info.priceFeed);
console.log("Heartbeat:", info.heartbeat);
```

**Called By:** ValueCalculator (for decimal normalization), analytics systems

---

### getActiveTokens {#tokenmanager-getactivetokens}

Returns array of all currently active token codes.

**Signature:**
```solidity
function getActiveTokens() 
    external view 
    returns (string[] memory)
```

**Parameters:** None

**Returns:**
| Type | Description |
|------|-------------|
| `string[]` | Array of active token codes (e.g., ["ARB", "USDC", "LINK"]) |

**Access Control:** `public view`

**Gas Cost:** ~5,000 gas + (500 per token) - Scales with token count

**Usage Example:**
```solidity
string[] memory tokens = tokenManager.getActiveTokens();
for (uint i = 0; i < tokens.length; i++) {
    console.log("Active token:", tokens[i]);
}
```

**Implementation:**
- Iterates through `tokenCodes` array
- Filters for `isActive == true`
- Returns compacted array

**Called By:** ValueCalculator (pool value calculations), UI (display token list)

---

### getTokenCount {#tokenmanager-gettokencount}

Returns count of currently active tokens.

**Signature:**
```solidity
function getTokenCount() 
    external view 
    returns (uint256)
```

**Parameters:** None

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Number of active tokens |

**Access Control:** `public view`

**Gas Cost:** ~400 gas (single SLOAD)

**Usage Example:**
```solidity
uint256 count = tokenManager.getTokenCount();
console.log("Pool supports", count, "tokens");
```

**Called By:** UI, monitoring systems

---

### getTokenPrice {#tokenmanager-gettokenprice}

Fetches token price from Chainlink oracle with staleness validation. View-only version (no state changes).

**Signature:**
```solidity
function getTokenPrice(string memory tokenCode) 
    external view 
    returns (uint256 price, uint256 updatedAt, bool isStale)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `price` | `uint256` | Token price from Chainlink (in feed's decimal format) |
| `updatedAt` | `uint256` | Timestamp of last price update |
| `isStale` | `bool` | `true` if price exceeds heartbeat age |

**Access Control:** `public view`

**Validations:**
- ✅ Token must be active
- ✅ Chainlink price must be > 0
- ✅ Chainlink timestamp must be > 0 (round complete)
- ✅ answeredInRound >= roundId (not stale at source)
- ✅ Staleness flag if `block.timestamp - updatedAt > heartbeat`
- ❌ Reverts with `"Token not active"` if inactive
- ❌ Reverts with `"Invalid price"` if price <= 0
- ❌ Reverts with `"Round not complete"` if timestamp == 0
- ❌ Reverts with `"Stale price"` if answeredInRound < roundId

**Gas Cost:** ~15,000 gas (external Chainlink call)

**Usage Example:**
```solidity
(uint256 price, uint256 updatedAt, bool isStale) = tokenManager.getTokenPrice("ARB");

if (isStale) {
    console.log("Warning: Price is stale");
}

console.log("ARB price:", price); // e.g., 150000000 (8 decimals = $1.50)
```

**Chainlink Integration:**
```solidity
// Calls Chainlink aggregator
AggregatorV3Interface priceFeed = AggregatorV3Interface(token.priceFeed);
(uint80 roundId, int256 rawPrice, , uint256 timestamp, uint80 answeredInRound) = 
    priceFeed.latestRoundData();

// Validates data integrity
require(rawPrice > 0, "Invalid price");
require(timestamp > 0, "Round not complete");
require(answeredInRound >= roundId, "Stale price");

// Check heartbeat
bool isStale = block.timestamp - timestamp > token.heartbeat;
```

**Security Notes:**
- ✅ Comprehensive Chainlink validation (prevents manipulation)
- ✅ Staleness detection via heartbeat comparison
- ✅ View function - safe for external calls

**Called By:** ValueCalculator (view-only calculations), UI (display prices)

**Related Functions:**
- [getTokenPriceWithEvents](#tokenmanager-gettokenpricewithevents) - State-modifying version with error tracking

---

### getTokenPriceWithEvents {#tokenmanager-gettokenpricewithevents}

Fetches token price from Chainlink with event emission and error tracking. State-modifying version.

**Signature:**
```solidity
function getTokenPriceWithEvents(string memory tokenCode) 
    external 
    returns (uint256 price, uint256 updatedAt)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `price` | `uint256` | Token price from Chainlink |
| `updatedAt` | `uint256` | Timestamp of last update |

**Access Control:** `public` (any caller)

**Validations:** Same as [getTokenPrice](#tokenmanager-gettokenprice)

**Events Emitted:**
```solidity
// On success:
// (implicit - price data updated in storage)

// On staleness:
event PriceStale(
    string indexed tokenCode,
    uint256 lastUpdateTime
)

// On error:
event TokenError(
    string indexed tokenCode,
    string errorMessage
)

// If error threshold reached:
event ErrorThresholdReached(string indexed tokenCode)
```

**Gas Cost:** ~50,000 gas (Chainlink call + SSTOREs + events)

**Usage Example:**
```solidity
try tokenManager.getTokenPriceWithEvents("ARB") returns (uint256 price, uint256 timestamp) {
    // Use price for calculations
    console.log("Fresh ARB price:", price);
} catch Error(string memory reason) {
    console.log("Price fetch failed:", reason);
    // Handle error (use cached value, skip token, etc.)
}
```

**State Changes:**
- `tokenData[tokenCode].lastPrice` = new price
- `tokenData[tokenCode].lastPriceTimestamp` = new timestamp
- `tokenErrors[tokenCode]` incremented on error, reset on success

**Error Tracking:**
```solidity
// On error, increment counter
tokenErrors[tokenCode]++;

// If errors exceed threshold
if (tokenErrors[tokenCode] >= maxErrors) {
    emit ErrorThresholdReached(tokenCode);
    // Consider auto-disabling token or alerting admin
}

// On success, reset counter
tokenErrors[tokenCode] = 0;
```

**Security Notes:**
- ⚠️ Use try-catch when calling to handle oracle failures gracefully
- ✅ Error tracking prevents relying on permanently broken oracles
- ✅ State updates allow caching last known good price

**Called By:** ValueCalculator.calculateTokenValue() (state-modifying path)

**Related Functions:**
- [getTokenPrice](#tokenmanager-gettokenprice) - View-only version
- [getTokenErrors](#tokenmanager-gettokenerrors) - Query error count

---

### getTokenErrors {#tokenmanager-gettokenerrors}

Retrieves error count for a token's price feed.

**Signature:**
```solidity
function getTokenErrors(string memory tokenCode) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Number of consecutive errors for this token's price feed |

**Access Control:** `public view`

**Gas Cost:** ~800 gas

**Usage Example:**
```solidity
uint256 errors = tokenManager.getTokenErrors("ARB");
if (errors > 3) {
    console.log("Warning: ARB oracle experiencing issues");
}
```

**Called By:** Monitoring systems, emergency response logic

---

### resetTokenErrors {#tokenmanager-resettokenerrors}

Manually resets error counter for a token (e.g., after oracle is fixed).

**Signature:**
```solidity
function resetTokenErrors(string memory tokenCode) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Events Emitted:**
```solidity
event TokenErrorsReset(string indexed tokenCode)
```

**Gas Cost:** ~30,000 gas

**Usage Example:**
```solidity
// After Chainlink oracle is repaired
tokenManager.resetTokenErrors("ARB");
```

**State Changes:**
- `tokenErrors[tokenCode]` = 0

**Called By:** Owner after resolving oracle issues

---

## 📊 ValueCalculator {#valuecalculator}

**Purpose:** Calculate pool value and individual token values with caching layer  
**Inheritance:** `Ownable`  
**Dependencies:** Beacon, TokenManager, ProxyGeneral  
**Cache Duration:** Configurable (default: 5 minutes)

### Module Functions

**Value Calculations:**
- [calculateTokenValue](#valuecalculator-calculatetokenvalue) - Calculate single token value
- [calculateTokenValueView](#valuecalculator-calculatetokenvalueview) - Calculate value (view-only)
- [getTotalPoolValue](#valuecalculator-gettotalpoolvalue) - Calculate total pool value
- [getTotalPoolValueView](#valuecalculator-gettotalpoolvalueview) - Total value (view-only)

**Cache Management:**
- [getCachedTokenValue](#valuecalculator-getcachedtokenvalue) - Retrieve cached value
- [getCachedTokenPrice](#valuecalculator-getcachedtokenprice) - Retrieve cached price
- [invalidateCache](#valuecalculator-invalidatecache) - Clear single token cache
- [invalidateAllCache](#valuecalculator-invalidateallcache) - Clear all caches

**Utility Functions:**
- [getTokenValueInfo](#valuecalculator-gettokenvalueinfo) - Get detailed token value info
- [selectTokenForSwap](#valuecalculator-selecttokenforswap) - Select token for withdrawal swap
- [validatePoolValue](#valuecalculator-validatepoolvalue) - Validate pool state

---

### calculateTokenValue {#valuecalculator-calculatetokenvalue}

Calculates the total value (in ETH) of a token's position in the pool. Uses cache if valid, otherwise fetches fresh price.

**Signature:**
```solidity
function calculateTokenValue(string memory tokenCode) 
    external 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Total value of token position in ETH (18 decimals) |

**Access Control:** `public` (any caller)

**Calculation:**
```solidity
// 1. Get token price from Chainlink (via TokenManager)
(uint256 price, uint256 timestamp) = tokenManager.getTokenPriceWithEvents(tokenCode);

// 2. Get token balance from ProxyGeneral
uint256 balance = IERC20(tokenAddress).balanceOf(proxyGeneral);

// 3. Normalize by price feed decimals
uint256 value = (balance * price) / (10 ** priceFeedDecimals);

// Result: ETH value of entire token position
```

**Cache Logic:**
1. Check if cached value is valid (`timestamp + cacheDuration > block.timestamp`)
2. If valid, return cached value (gas optimization)
3. If invalid or missing, fetch fresh price from Chainlink
4. Update cache with new value
5. Reset error counter on success

**Validations:**
- ✅ Price age must be within `maxPriceAge`
- ✅ Token must be active
- ❌ Reverts with `"Price too old"` if stale
- ❌ Reverts with `"Value calculation failed"` on Chainlink error

**Events Emitted:**
```solidity
event CacheUpdated(
    string indexed tokenCode,
    uint256 value,
    uint256 pricePerToken
)

// Also from TokenManager:
// TokenError, PriceStale, ErrorThresholdReached
```

**Gas Cost:**
- Cache hit: ~3,000 gas
- Cache miss: ~60,000 gas (includes Chainlink call + storage updates)

**Usage Example:**
```solidity
// Calculate ARB position value
uint256 arbValue = valueCalculator.calculateTokenValue("ARB");
console.log("ARB position worth:", arbValue / 1e18, "ETH");
```

**State Changes:**
- `tokenValueCache[tokenCode]` updated with new value, price, timestamp
- `tokenErrors[tokenCode]` reset to 0 on success, incremented on error

**Security Notes:**
- ✅ Cache prevents excessive Chainlink calls (gas optimization)
- ✅ Error tracking prevents relying on broken oracles
- ⚠️ Use try-catch when calling to handle failures gracefully

**Called By:** 
- ValueCalculator.getTotalPoolValue() - Main use case
- LiquidityManager (indirectly via pool value)
- Monitoring systems

**Related Functions:**
- [calculateTokenValueView](#valuecalculator-calculatetokenvalueview) - View-only version
- [getCachedTokenValue](#valuecalculator-getcachedtokenvalue) - Retrieve cached value

---

### calculateTokenValueView {#valuecalculator-calculatetokenvalueview}

View-only version of calculateTokenValue. No state changes, no cache updates.

**Signature:**
```solidity
function calculateTokenValueView(string memory tokenCode) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Token position value in ETH |

**Access Control:** `public view`

**Behavior:**
1. Check cache first (same as state-modifying version)
2. If cache invalid, calculate fresh (no cache update)
3. Uses `TokenManager.getTokenPrice()` (view version)

**Gas Cost:** ~15,000 gas (Chainlink call, no storage writes)

**Usage Example:**
```solidity
// UI display - no state changes
uint256 value = valueCalculator.calculateTokenValueView("USDC");
```

**Called By:** UI, monitoring dashboards, preview calculations

---

### getTotalPoolValue {#valuecalculator-gettotalpoolvalue}

Calculates total pool value by summing WETH balance + all active token values.

**Signature:**
```solidity
function getTotalPoolValue() 
    external 
    returns (PoolValueInfo memory)
```

**Parameters:** None

**Returns:**
| Type | Description |
|------|-------------|
| `PoolValueInfo` | Struct containing total value, per-token breakdown, percentages |

**PoolValueInfo Structure:**
```solidity
struct PoolValueInfo {
    uint256 totalValue;              // Total pool value in ETH
    TokenValueInfo[] tokenValues;    // Array of token breakdowns
}

struct TokenValueInfo {
    string tokenCode;
    uint256 value;                   // Token position value in ETH
    uint256 balance;                 // Raw token balance
    uint256 pricePerToken;           // Price from Chainlink
    uint256 percentage;              // Percentage of pool (basis points)
}
```

**Access Control:** `public`

**Calculation Flow:**
```solidity
// 1. Get WETH balance
uint256 wethBalance = IWETH(wethAddress).balanceOf(proxyGeneral);
uint256 totalValue = wethBalance;

// 2. Add each active token's value
string[] memory tokens = tokenManager.getActiveTokens();
for (uint i = 0; i < tokens.length; i++) {
    uint256 tokenValue = calculateTokenValue(tokens[i]);
    totalValue += tokenValue;
    // Store in TokenValueInfo array
}

// 3. Calculate percentages
for (uint i = 0; i < tokenValues.length; i++) {
    tokenValues[i].percentage = (tokenValues[i].value * 10000) / totalValue;
}
```

**Events Emitted:**
```solidity
event PoolValueUpdated(uint256 totalValue)

// Plus CacheUpdated for each token (from calculateTokenValue)
```

**Gas Cost:** ~80,000 base + (60,000 per token) - Scales with token count

**Usage Example:**
```solidity
PoolValueInfo memory info = valueCalculator.getTotalPoolValue();

console.log("Total pool:", info.totalValue / 1e18, "ETH");
for (uint i = 0; i < info.tokenValues.length; i++) {
    console.log(
        info.tokenValues[i].tokenCode, ":",
        info.tokenValues[i].percentage / 100, "%"
    );
}
```

**State Changes:**
- All token caches updated
- Error counters modified

**Security Notes:**
- ✅ Comprehensive pool valuation
- ✅ Includes percentage breakdown (useful for rebalancing)
- ⚠️ Can be gas-intensive with many tokens

**Called By:**
- LiquidityManager (deposit/withdraw share calculations)
- UI (dashboard display)

**Related Functions:**
- [getTotalPoolValueView](#valuecalculator-gettotalpoolvalueview) - View-only, returns only total

---

### getTotalPoolValueView {#valuecalculator-gettotalpoolvalueview}

View-only version returning total pool value (no breakdown, no state changes).

**Signature:**
```solidity
function getTotalPoolValueView() 
    external view 
    returns (uint256)
```

**Parameters:** None

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Total pool value in ETH |

**Access Control:** `public view`

**Gas Cost:** ~30,000 gas + (15,000 per token)

**Usage Example:**
```solidity
// Quick pool value check
uint256 totalValue = valueCalculator.getTotalPoolValueView();
```

**Called By:** LiquidityManager.calculateDepositShares() - Needs total only

---

### getCachedTokenValue {#valuecalculator-getcachedtokenvalue}

Retrieves cached token value without recalculating.

**Signature:**
```solidity
function getCachedTokenValue(string memory tokenCode) 
    external view 
    returns (uint256 value, bool isValid)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token identifier |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `value` | `uint256` | Cached value (0 if invalid) |
| `isValid` | `bool` | True if cache is still valid |

**Access Control:** `public view`

**Cache Validity:**
```solidity
bool isValid = cache.isValid && 
               (block.timestamp - cache.timestamp <= cacheDuration);
```

**Gas Cost:** ~2,500 gas

**Usage Example:**
```solidity
(uint256 value, bool valid) = valueCalculator.getCachedTokenValue("ARB");
if (valid) {
    // Use cached value
} else {
    // Need fresh calculation
}
```

**Called By:** Internal optimization checks

---

### getCachedTokenPrice {#valuecalculator-getcachedtokenprice}

Retrieves cached price per token.

**Signature:**
```solidity
function getCachedTokenPrice(string memory tokenCode) 
    external view 
    returns (uint256 pricePerToken, bool isValid)
```

**Parameters/Returns:** Similar to getCachedTokenValue but returns price instead of total value

**Gas Cost:** ~2,500 gas

---

### invalidateCache {#valuecalculator-invalidatecache}

Manually invalidates cache for a specific token.

**Signature:**
```solidity
function invalidateCache(string memory tokenCode) 
    external 
    onlyAuthorized
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token to invalidate |

**Returns:** None (void)

**Access Control:** `onlyAuthorized` (owner or authorized modules)

**Events Emitted:**
```solidity
event CacheCleared(string indexed tokenCode)
```

**Gas Cost:** ~30,000 gas

**Usage Example:**
```solidity
// After token price oracle update
valueCalculator.invalidateCache("ARB");
// Next calculation will fetch fresh price
```

**State Changes:**
- `tokenValueCache[tokenCode]` deleted

**Called By:** Emergency handler, admin operations

---

### invalidateAllCache {#valuecalculator-invalidateallcache}

Clears all token caches.

**Signature:**
```solidity
function invalidateAllCache() 
    external 
    onlyOwner
```

**Parameters:** None

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Gas Cost:** ~40,000 + (30,000 per token)

**Usage Example:**
```solidity
// After major oracle upgrade
valueCalculator.invalidateAllCache();
```

**Called By:** Owner during system maintenance

---

### getTokenValueInfo {#valuecalculator-gettokenvalueinfo}

Returns detailed TokenValueInfo for a single token (view-only).

**Signature:**
```solidity
function getTokenValueInfo(string memory tokenCode) 
    external view 
    returns (TokenValueInfo memory)
```

**Returns:** TokenValueInfo struct with value, balance, price, percentage

**Gas Cost:** ~18,000 gas

**Called By:** UI, analytics

---

### selectTokenForSwap {#valuecalculator-selecttokenforswap}

Selects which token to swap when WETH balance is insufficient for withdrawal.

**Signature:**
```solidity
function selectTokenForSwap(uint256 targetValue) 
    external view 
    returns (string memory tokenCode, uint256 amount)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `targetValue` | `uint256` | Required WETH value in ETH |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token to swap |
| `amount` | `uint256` | Amount of token to swap |

**Access Control:** `public view`

**Selection Logic:**
```solidity
// 1. Get all active tokens and their values
// 2. Select token with highest value (avoid dust swaps)
// 3. Calculate amount needed to reach targetValue
// 4. Ensure amount doesn't exceed token balance
```

**Gas Cost:** ~50,000 gas (iterates through tokens)

**Usage Example:**
```solidity
// User wants to withdraw 10 ETH but only 5 WETH available
(string memory tokenToSwap, uint256 amount) = valueCalculator.selectTokenForSwap(5 ether);

console.log("Swap", amount, tokenToSwap, "for 5 ETH worth of WETH");
```

**Selection Strategy:**
- Prefer largest position (minimizes swap count)
- Ensure token has sufficient balance
- Calculate exact amount needed

**Called By:** LiquidityManager.withdraw() - When WETH insufficient

---

### validatePoolValue {#valuecalculator-validatepoolvalue}

Validates pool state for consistency checks.

**Signature:**
```solidity
function validatePoolValue() 
    external view 
    returns (bool isValid, string memory errorReason)
```

**Parameters:** None

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `isValid` | `bool` | True if pool state is valid |
| `errorReason` | `string` | Description if invalid |

**Validation Checks:**
- All price feeds responding
- No stale prices
- Total value > 0
- Token balances match expected values

**Gas Cost:** ~100,000 gas

**Called By:** Monitoring systems, pre-flight checks

---

## 💧 LiquidityManager {#liquiditymanager}

**Purpose:** Handle user deposits and withdrawals with automatic WETH wrapping/unwrapping  
**Inheritance:** `Ownable`, `ReentrancyGuard`  
**Dependencies:** Beacon, ProxyGeneral, ValueCalculator, SwapManager, WETH  
**Fee Structure:** Configurable (max 5%)

### Module Functions

**Deposit Operations:**
- [deposit](#liquiditymanager-deposit) - Deposit ETH and receive LP tokens
- [calculateDepositShares](#liquiditymanager-calculatedepositshares) - Preview LP tokens for deposit

**Withdraw Operations:**
- [withdraw](#liquiditymanager-withdraw) - Burn LP tokens and receive ETH
- [calculateWithdrawAmount](#liquiditymanager-calculatewithdrawamount) - Preview ETH for LP tokens

**Withdraw Limits:**
- [setWithdrawLimits](#liquiditymanager-setwithdrawlimits) - Configure withdrawal limits
- [checkWithdrawLimits](#liquiditymanager-checkwithdrawlimits) - Validate withdrawal request
- [getRemainingHourlyLimit](#liquiditymanager-getremaininghourlylimit) - Get remaining hourly quota
- [getRemainingDailyLimit](#liquiditymanager-getremainingdailylimit) - Get remaining daily quota

**Fee Management:**
- [setDepositFee](#liquiditymanager-setdepositfee) - Set deposit fee
- [setWithdrawFee](#liquiditymanager-setwithdrawfee) - Set withdrawal fee
- [setFeeRecipient](#liquiditymanager-setfeerecipient) - Set fee recipient address

**State Management:**
- [setDepositsEnabled](#liquiditymanager-setdepositsenabled) - Enable/disable deposits
- [setWithdrawsEnabled](#liquiditymanager-setwithdrawsenabled) - Enable/disable withdrawals

---

### deposit {#liquiditymanager-deposit}

Main entry point for user deposits. Accepts ETH, wraps to WETH, calculates LP token shares, and mints to user.

**Signature:**
```solidity
function deposit() 
    external payable 
    nonReentrant 
    returns (uint256 lpTokens)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `msg.value` | `uint256` | ETH amount to deposit (sent with transaction) |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Amount of LP tokens minted to user |

**Access Control:** `public payable` (open to all users)

**Deposit Flow:**
```
User sends ETH
    ↓
Calculate fee (depositFee %)
    ↓
Net deposit = msg.value - fee
    ↓
Wrap ETH → WETH (via WETH.deposit())
    ↓
Calculate LP shares:
  - First deposit: 1:1 ratio
  - Subsequent: (netDeposit * totalSupply) / totalPoolValue
    ↓
Mint LP tokens to user (via ProxyGeneral.mint())
    ↓
Transfer fee to feeRecipient
    ↓
Return LP tokens amount
```

**Validations:**
- ✅ Deposits must be enabled (`depositsEnabled == true`)
- ✅ Amount must be > 0
- ✅ Amount must be >= `minDepositAmount`
- ✅ System must not be paused (`ProxyGeneral.isPaused() == false`)
- ✅ LP tokens calculated must be > 0
- ✅ Fee transfer must succeed (if applicable)
- ❌ Reverts with `"Deposits are disabled"` if disabled
- ❌ Reverts with `"Cannot deposit zero ETH"` if zero
- ❌ Reverts with `"Below minimum deposit"` if too small
- ❌ Reverts with `"System is paused"` if paused
- ❌ Reverts with `"LP tokens amount is zero"` if calculation fails
- ❌ Reverts with `"Fee transfer failed"` if fee send fails

**Events Emitted:**
```solidity
event Deposited(
    address indexed user,
    uint256 ethAmount,          // msg.value
    uint256 netDeposit,         // After fee
    uint256 feeAmount,          // Fee charged
    uint256 lpTokens            // LP tokens minted
)
```

**Gas Cost:** ~180,000 gas (WETH wrap + mint + transfers + events)

**Usage Example:**
```solidity
// User deposits 10 ETH
uint256 lpTokens = liquidityManager.deposit{value: 10 ether}();

console.log("Received", lpTokens / 1e18, "LP tokens");
```

**Fee Calculation:**
```solidity
// Example: 0.5% deposit fee (50 basis points)
depositFee = 50; // 50/10000 = 0.5%

feeAmount = (msg.value * depositFee) / 10000;
netDeposit = msg.value - feeAmount;

// 10 ETH deposit with 0.5% fee:
// feeAmount = 10 * 50 / 10000 = 0.05 ETH
// netDeposit = 10 - 0.05 = 9.95 ETH
```

**State Changes:**
- WETH balance in ProxyGeneral increases by `netDeposit`
- User's LP token balance increases by `lpTokens`
- Total LP supply increases by `lpTokens`
- Fee recipient receives `feeAmount` in ETH

**Security Notes:**
- ✅ Reentrancy protected (`nonReentrant` modifier)
- ✅ Fee capped at 5% maximum (`MAX_FEE = 500`)
- ✅ First deposit 1:1 prevents inflation attacks
- ✅ Subsequent deposits proportional to pool value (fair pricing)
- ⚠️ Ensure WETH wrap succeeds before minting LP tokens

**Best Practices:**
1. Check `minDepositAmount` before depositing
2. Calculate expected LP tokens via `calculateDepositShares()`
3. Account for deposit fee in expectations
4. Verify LP tokens received matches calculation

**Called By:** Users directly via UI/wallet

**Related Functions:**
- [calculateDepositShares](#liquiditymanager-calculatedepositshares) - Preview LP tokens
- [withdraw](#liquiditymanager-withdraw) - Opposite operation

---

### calculateDepositShares {#liquiditymanager-calculatedepositshares}

Preview calculation of LP tokens for a given ETH deposit amount. View-only, no state changes.

**Signature:**
```solidity
function calculateDepositShares(uint256 ethAmount) 
    external view 
    returns (uint256 shares)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `ethAmount` | `uint256` | ETH amount to deposit (net, after fees) |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | LP tokens that would be minted |

**Access Control:** `public view`

**Calculation Logic:**
```solidity
// First deposit (totalSupply == 0):
if (totalSupply == 0) {
    return ethAmount; // 1:1 ratio
}

// Subsequent deposits:
totalPoolValue = ValueCalculator.getTotalPoolValueView();
shares = (ethAmount * totalSupply) / totalPoolValue;
```

**Example:**
```solidity
// Pool state:
// - Total supply: 1000 LP tokens
// - Total value: 100 ETH

// User deposits 10 ETH:
shares = (10 * 1000) / 100 = 100 LP tokens

// User gets 10% of supply for 10% of value (fair)
```

**Validations:**
- ✅ Total pool value must be > 0 (if supply > 0)
- ❌ Reverts with `"Invalid pool value"` if zero

**Gas Cost:** ~25,000 gas (calls ValueCalculator.getTotalPoolValueView)

**Usage Example:**
```solidity
// Preview before deposit
uint256 netAmount = 10 ether - feeAmount;
uint256 expectedLP = liquidityManager.calculateDepositShares(netAmount);

console.log("Will receive ~", expectedLP / 1e18, "LP tokens");
```

**Security Notes:**
- ✅ View-only, safe for pre-flight checks
- ✅ Proportional to pool value (prevents dilution)
- ⚠️ Result is preview - actual may differ if pool value changes

**Called By:** 
- UI (display expected LP tokens)
- Internal deposit() function
- Smart contracts (integration checks)

---

### withdraw {#liquiditymanager-withdraw}

Main entry point for withdrawals. Burns LP tokens, calculates ETH owed, swaps tokens to WETH if needed, unwraps to ETH, and transfers to user.

**Signature:**
```solidity
function withdraw(uint256 lpTokenAmount) 
    external 
    nonReentrant 
    returns (uint256 ethReceived)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `lpTokenAmount` | `uint256` | Amount of LP tokens to burn |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Net ETH amount received by user (after fees) |

**Access Control:** `public` (any LP token holder)

**Withdrawal Flow:**
```
User burns LP tokens
    ↓
Calculate ETH owed: (lpTokens * totalPoolValue) / totalSupply
    ↓
Check withdrawal limits (hourly/daily)
    ↓
Calculate fee (withdrawFee %)
    ↓
Net withdraw = ethOwed - fee
    ↓
Check WETH balance in ProxyGeneral
    ↓
If insufficient WETH:
    Select token to swap (via ValueCalculator)
    Swap token → WETH (via SwapManager)
    ↓
Burn LP tokens (via ProxyGeneral.burn())
    ↓
Update rate limits (incrementHourlyWithdrawn)
    ↓
Transfer WETH to this contract
    ↓
Unwrap WETH → ETH (via WETH.withdraw())
    ↓
Transfer ETH to user
    ↓
Transfer fee to feeRecipient (if applicable)
    ↓
Return net ETH amount
```

**Validations:**
- ✅ Withdrawals must be enabled
- ✅ LP token amount must be > 0
- ✅ Amount must be >= `minWithdrawAmount`
- ✅ System must not be paused
- ✅ User must have sufficient LP token balance
- ✅ Calculated ETH amount must be > 0
- ✅ Must pass withdrawal limit checks (hourly/daily)
- ✅ Must have enough WETH after swap (if needed)
- ✅ ETH transfer must succeed
- ❌ Reverts with `"Withdrawals are disabled"` if disabled
- ❌ Reverts with `"Insufficient LP tokens"` if balance too low
- ❌ Reverts with various limit errors (from checkWithdrawLimits)
- ❌ Reverts with `"Insufficient WETH after swap"` if swap inadequate
- ❌ Reverts with `"ETH transfer failed"` if transfer fails

**Events Emitted:**
```solidity
event Withdrawn(
    address indexed user,
    uint256 lpTokens,           // LP tokens burned
    uint256 ethAmount,          // ETH owed (before fee)
    uint256 netWithdraw,        // Net ETH received
    uint256 feeAmount           // Fee charged
)

// If swap occurred:
event TokenSwappedForWithdraw(
    string indexed tokenCode,
    uint256 amountIn,
    uint256 amountOut
)
```

**Gas Cost:**
- Without swap: ~200,000 gas
- With swap: ~450,000 gas (includes DEX interaction)

**Usage Example:**
```solidity
// User withdraws all LP tokens
uint256 lpBalance = proxyGeneral.balanceOf(msg.sender);
uint256 ethReceived = liquidityManager.withdraw(lpBalance);

console.log("Received", ethReceived / 1e18, "ETH");
```

**Automatic Swap Logic:**
```solidity
// Calculate WETH needed
uint256 wethNeeded = netWithdraw;

// Check WETH balance
uint256 wethBalance = WETH.balanceOf(proxyGeneral);

if (wethBalance < wethNeeded) {
    // Need to swap token → WETH
    uint256 deficit = wethNeeded - wethBalance;
    
    // Select best token to swap
    (string memory tokenCode, uint256 amountIn) = 
        valueCalculator.selectTokenForSwap(deficit);
    
    // Execute swap
    swapManager.swapTokenForWETH(tokenCode, amountIn, minAmountOut);
    
    // Verify sufficient WETH now
    wethBalance = WETH.balanceOf(proxyGeneral);
    require(wethBalance >= wethNeeded, "Insufficient WETH after swap");
}
```

**State Changes:**
- User's LP token balance decreases by `lpTokenAmount`
- Total LP supply decreases by `lpTokenAmount`
- WETH balance decreases by `netWithdraw`
- User receives `netWithdraw` in ETH
- Hourly/daily withdrawal tracking updated
- If swap: token balance decreases, WETH increases

**Security Notes:**
- ✅ Reentrancy protected (`nonReentrant` modifier)
- ✅ Rate limiting prevents bank run scenarios
- ✅ Automatic swap ensures liquidity availability
- ✅ Fee capped at 5% maximum
- ⚠️ Swap may have slippage - validate minAmountOut
- ⚠️ Large withdrawals may require multiple token swaps

**Best Practices:**
1. Check withdrawal limits before calling
2. Preview ETH amount via `calculateWithdrawAmount()`
3. Account for withdrawal fee
4. Be aware of potential token swaps (gas cost)
5. Monitor remaining limits after withdrawal

**Called By:** Users directly via UI/wallet

**Related Functions:**
- [calculateWithdrawAmount](#liquiditymanager-calculatewithdrawamount) - Preview ETH amount
- [checkWithdrawLimits](#liquiditymanager-checkwithdrawlimits) - Validate limits
- [deposit](#liquiditymanager-deposit) - Opposite operation

---

### calculateWithdrawAmount {#liquiditymanager-calculatewithdrawamount}

Preview calculation of ETH amount for a given LP token burn. View-only.

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
| `uint256` | ETH amount (before fees) |

**Access Control:** `public view`

**Calculation:**
```solidity
totalSupply = ProxyGeneral.totalSupply();
totalPoolValue = ValueCalculator.getTotalPoolValueView();

ethAmount = (lpTokens * totalPoolValue) / totalSupply;
```

**Gas Cost:** ~25,000 gas

**Usage Example:**
```solidity
uint256 lpBalance = proxyGeneral.balanceOf(user);
uint256 ethAmount = liquidityManager.calculateWithdrawAmount(lpBalance);
uint256 netAfterFee = ethAmount - (ethAmount * withdrawFee / 10000);

console.log("Will receive ~", netAfterFee / 1e18, "ETH");
```

**Called By:** UI, internal withdraw() function

---

### setWithdrawLimits {#liquiditymanager-setwithdrawlimits}

Configures withdrawal rate limits (hourly/daily caps, min/max per transaction).

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
| `hourlyLimit` | `uint256` | Maximum ETH withdrawable per user per hour |
| `dailyLimit` | `uint256` | Maximum ETH withdrawable per user per day |
| `minWithdraw` | `uint256` | Minimum withdrawal amount |
| `maxWithdraw` | `uint256` | Maximum withdrawal per transaction |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Hourly limit <= daily limit
- ✅ Min withdraw <= max withdraw
- ✅ All values must be reasonable

**Events Emitted:**
```solidity
event WithdrawLimitsUpdated(
    uint256 hourlyLimit,
    uint256 dailyLimit,
    uint256 minWithdraw,
    uint256 maxWithdraw
)
```

**Gas Cost:** ~50,000 gas

**Usage Example:**
```solidity
// Set limits:
// - 10 ETH per hour per user
// - 100 ETH per day per user
// - Min 0.01 ETH per withdrawal
// - Max 50 ETH per withdrawal
liquidityManager.setWithdrawLimits(
    10 ether,   // hourlyLimit
    100 ether,  // dailyLimit
    0.01 ether, // minWithdraw
    50 ether    // maxWithdraw
);
```

**Security Notes:**
- ⚠️ **CRITICAL:** Prevents bank run attacks
- ✅ Per-user limits (not global)
- ⚠️ Adjust based on pool size and risk tolerance

**Called By:** Owner during configuration

---

### checkWithdrawLimits {#liquiditymanager-checkwithdrawlimits}

Validates if a withdrawal request passes rate limit checks.

**Signature:**
```solidity
function checkWithdrawLimits(address user, uint256 amount) 
    external view 
    returns (bool canWithdraw, string memory reason)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User address |
| `amount` | `uint256` | Withdrawal amount in ETH |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `canWithdraw` | `bool` | True if allowed |
| `reason` | `string` | Error message if not allowed |

**Access Control:** `public view`

**Checks Performed:**
1. Amount >= `minWithdraw`
2. Amount <= `maxWithdraw`
3. Hourly limit not exceeded
4. Daily limit not exceeded

**Gas Cost:** ~5,000 gas

**Usage Example:**
```solidity
(bool canWithdraw, string memory reason) = 
    liquidityManager.checkWithdrawLimits(msg.sender, 5 ether);

if (!canWithdraw) {
    console.log("Cannot withdraw:", reason);
}
```

**Called By:** UI (pre-flight checks), internal withdraw()

---

### getRemainingHourlyLimit {#liquiditymanager-getremaininghourlylimit}

Returns remaining hourly withdrawal quota for a user.

**Signature:**
```solidity
function getRemainingHourlyLimit(address user) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `user` | `address` | User address |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Remaining ETH withdrawable this hour |

**Access Control:** `public view`

**Calculation:**
```solidity
uint256 currentHour = block.timestamp / 1 hours;
uint256 withdrawn = proxyGeneral.getHourlyWithdrawn(user, currentHour);
uint256 remaining = withdrawLimits.hourlyLimit - withdrawn;
```

**Gas Cost:** ~3,000 gas

**Called By:** UI (display remaining quota)

---

### getRemainingDailyLimit {#liquiditymanager-getremainingdailylimit}

Returns remaining daily withdrawal quota for a user.

**Signature:**
```solidity
function getRemainingDailyLimit(address user) 
    external view 
    returns (uint256)
```

**Implementation:** Similar to hourly, but checks last 24 hours

**Gas Cost:** ~10,000 gas (iterates 24 hours)

---

### setDepositFee {#liquiditymanager-setdepositfee}

Updates deposit fee percentage.

**Signature:**
```solidity
function setDepositFee(uint256 newFee) 
    external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newFee` | `uint256` | Fee in basis points (50 = 0.5%) |

**Validations:**
- ✅ Fee must be <= `MAX_FEE` (500 = 5%)

**Gas Cost:** ~30,000 gas

---

### setWithdrawFee {#liquiditymanager-setwithdrawfee}

Updates withdrawal fee percentage. Similar to setDepositFee.

---

### setFeeRecipient {#liquiditymanager-setfeerecipient}

Updates address that receives deposit/withdrawal fees.

**Signature:**
```solidity
function setFeeRecipient(address newRecipient) 
    external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newRecipient` | `address` | New fee recipient address |

**Validations:**
- ✅ Recipient must be non-zero address

**Gas Cost:** ~30,000 gas

---

### setDepositsEnabled {#liquiditymanager-setdepositsenabled}

Enables or disables deposit functionality.

**Signature:**
```solidity
function setDepositsEnabled(bool enabled) 
    external onlyOwner
```

**Gas Cost:** ~30,000 gas

---

### setWithdrawsEnabled {#liquiditymanager-setwithdrawsenabled}

Enables or disables withdrawal functionality.

**Signature:**
```solidity
function setWithdrawsEnabled(bool enabled) 
    external onlyOwner
```

**Gas Cost:** ~30,000 gas

---

## 🔄 SwapManager {#swapmanager}

**Purpose:** Integrate with SimpleSwap DEX for token-to-WETH swaps  
**Inheritance:** `Ownable`, `ReentrancyGuard`  
**Dependencies:** Beacon, ProxyGeneral, TokenManager, SimpleSwap Router  
**Max Slippage:** Configurable (default: 2%, max 5%)

### Module Functions

**Swap Operations:**
- [swapTokenForWETH](#swapmanager-swaptokenforweth) - Execute token → WETH swap
- [getSwapQuote](#swapmanager-getswapquote) - Get estimated output amount
- [calculateMinAmountOut](#swapmanager-calculateminamountout) - Calculate minimum with slippage

**Configuration:**
- [setSimpleSwapRouter](#swapmanager-setsimpleSwaprouter) - Update router address
- [setMaxSlippage](#swapmanager-setmaxslippage) - Update slippage tolerance
- [setSwapsEnabled](#swapmanager-setswapsenabled) - Enable/disable swaps

**Statistics:**
- [getSwapStats](#swapmanager-getswapstats) - Get swap count and volume

---

### swapTokenForWETH {#swapmanager-swaptokenforweth}

Executes a token-to-WETH swap via SimpleSwap DEX. Assets remain custodied in ProxyGeneral throughout the swap.

**Signature:**
```solidity
function swapTokenForWETH(
    string memory tokenCode,
    uint256 amountIn,
    uint256 minAmountOut
) external onlyAuthorizedModule nonReentrant returns (uint256 amountOut)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token to swap (e.g., "ARB", "USDC") |
| `amountIn` | `uint256` | Amount of tokens to swap (in token's decimals) |
| `minAmountOut` | `uint256` | Minimum WETH to receive (slippage protection) |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Actual WETH amount received |

**Access Control:** `onlyAuthorizedModule` (typically LiquidityManager)

**Swap Flow:**
```
Validate token is active
    ↓
Check token balance in ProxyGeneral >= amountIn
    ↓
Record balances before swap
    ↓
Get quote from SimpleSwap (expectedOut)
    ↓
Validate slippage: minAmountOut >= (expectedOut * (1 - maxSlippage))
    ↓
Approve SimpleSwap router to spend tokens (via ProxyGeneral)
    ↓
Execute swap via SimpleSwap.swap()
  - Token: ProxyGeneral → SimpleSwap → WETH
  - WETH: Returns to ProxyGeneral
    ↓
Verify balances post-swap:
  - Token balance decreased by amountIn
  - WETH balance increased by amountOut
    ↓
Validate amountOut >= minAmountOut
    ↓
Update statistics (swap count, total volume)
    ↓
Reset approval to 0 (security best practice)
    ↓
Return amountOut
```

**Validations:**
- ✅ Swaps must be enabled (`swapsEnabled == true`)
- ✅ Amount must be > 0
- ✅ SimpleSwap router must be configured
- ✅ System must not be paused
- ✅ Token must be active in TokenManager
- ✅ ProxyGeneral must have sufficient token balance
- ✅ Slippage must be within acceptable range
- ✅ Actual output must meet minimum requirement
- ✅ Post-swap balance changes must match expected
- ❌ Reverts with `"Swaps are disabled"` if disabled
- ❌ Reverts with `"Invalid amount"` if zero
- ❌ Reverts with `"SimpleSwap router not set"` if not configured
- ❌ Reverts with `"System is paused"` if paused
- ❌ Reverts with `"Token not active"` if inactive
- ❌ Reverts with `"Insufficient token balance"` if balance too low
- ❌ Reverts with `"Slippage too high"` if minAmountOut too low
- ❌ Reverts with `"Swap output below minimum"` if received < minAmountOut
- ❌ Reverts with `"Invalid token balance after swap"` if balance mismatch
- ❌ Reverts with `"Invalid WETH balance after swap"` if WETH mismatch

**Events Emitted:**
```solidity
event SwapExecuted(
    string indexed tokenCode,
    uint256 amountIn,
    uint256 amountOut,
    uint256 minAmountOut,
    address indexed caller
)
```

**Gas Cost:** ~250,000 gas (includes DEX interaction, approvals, validations)

**Usage Example:**
```solidity
// LiquidityManager needs 5 WETH for withdrawal
// Swap 500 ARB tokens to WETH

// 1. Get quote
uint256 expectedWETH = swapManager.getSwapQuote("ARB", 500e18);
// expectedWETH = 5.1 WETH

// 2. Calculate min with 2% slippage tolerance
uint256 minWETH = (expectedWETH * 9800) / 10000; // 98% of expected
// minWETH = 4.998 WETH

// 3. Execute swap
uint256 wethReceived = swapManager.swapTokenForWETH(
    "ARB",
    500e18,    // 500 ARB
    minWETH    // Min 4.998 WETH
);

console.log("Received", wethReceived / 1e18, "WETH");
```

**Slippage Protection:**
```solidity
// Get quote from DEX
expectedOut = SimpleSwap.getAmountOut(token, WETH, amountIn);
// e.g., expectedOut = 5.1 WETH

// Calculate minimum with maxSlippage (e.g., 200 basis points = 2%)
minAcceptable = (expectedOut * (10000 - maxSlippage)) / 10000;
// minAcceptable = (5.1 * 9800) / 10000 = 4.998 WETH

// Validate user's minAmountOut is reasonable
require(minAmountOut >= minAcceptable, "Slippage too high");
// Prevents user from setting minAmountOut too low (e.g., 1 WETH)
```

**Balance Verification:**
```solidity
// Before swap
uint256 tokenBefore = IERC20(token).balanceOf(proxyGeneral);
uint256 wethBefore = IERC20(weth).balanceOf(proxyGeneral);

// Execute swap
amountOut = SimpleSwap.swap(...);

// After swap
uint256 tokenAfter = IERC20(token).balanceOf(proxyGeneral);
uint256 wethAfter = IERC20(weth).balanceOf(proxyGeneral);

// Validate changes
require(tokenBefore - tokenAfter == amountIn, "Token balance mismatch");
require(wethAfter - wethBefore == amountOut, "WETH balance mismatch");
```

**State Changes:**
- Token balance in ProxyGeneral decreases by `amountIn`
- WETH balance in ProxyGeneral increases by `amountOut`
- `tokenSwapCount[tokenCode]` incremented
- `totalSwappedAmount[tokenCode]` increased by `amountIn`

**Security Notes:**
- ✅ Reentrancy protected (`nonReentrant` modifier)
- ✅ Assets never leave ProxyGeneral custody
- ✅ Pre/post balance verification prevents manipulation
- ✅ Slippage validation prevents sandwich attacks
- ✅ Approval reset to 0 after swap (prevents leftover approvals)
- ⚠️ Only authorized modules can swap (prevents unauthorized trades)
- ⚠️ SimpleSwap router must be trusted DEX

**Best Practices:**
1. Always call `getSwapQuote()` first to estimate output
2. Set `minAmountOut` based on acceptable slippage
3. Be aware of DEX liquidity for large swaps
4. Monitor swap statistics for anomalies

**Called By:**
- LiquidityManager.withdraw() - When WETH insufficient for withdrawal

**Related Functions:**
- [getSwapQuote](#swapmanager-getswapquote) - Get estimated output
- [calculateMinAmountOut](#swapmanager-calculateminamountout) - Calculate min with slippage

---

### getSwapQuote {#swapmanager-getswapquote}

Gets estimated WETH output for a given token input amount. View-only, queries SimpleSwap router.

**Signature:**
```solidity
function getSwapQuote(
    string memory tokenCode,
    uint256 amountIn
) external view returns (uint256 estimatedOut)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token to swap |
| `amountIn` | `uint256` | Amount of tokens to swap |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Estimated WETH amount to receive |

**Access Control:** `public view`

**Implementation:**
```solidity
// Get addresses
address tokenAddress = tokenManager.getTokenAddress(tokenCode);
address wethAddress = beacon.getImplementation("WETH");

// Query SimpleSwap
estimatedOut = ISimpleSwap(simpleSwapRouter).getAmountOut(
    tokenAddress,
    wethAddress,
    amountIn
);
```

**Validations:**
- ✅ SimpleSwap router must be configured
- ✅ Token must be active
- ❌ Reverts with `"SimpleSwap router not set"` if not configured
- ❌ Reverts with `"Token not active"` if inactive

**Gas Cost:** ~10,000 gas (external view call to DEX)

**Usage Example:**
```solidity
// How much WETH for 100 ARB?
uint256 wethOut = swapManager.getSwapQuote("ARB", 100e18);
console.log("100 ARB = ", wethOut / 1e18, "WETH");
```

**Security Notes:**
- ✅ View-only, no state changes
- ✅ Safe for pre-flight calculations
- ⚠️ Estimate may differ from actual due to:
  - Liquidity changes
  - Front-running
  - Slippage
  - Time delay between quote and execution

**Called By:** 
- UI (display expected output)
- LiquidityManager (calculate swap amounts)
- Internal swapTokenForWETH() for validation

---

### calculateMinAmountOut {#swapmanager-calculateminamountout}

Calculates minimum acceptable output with configured slippage protection.

**Signature:**
```solidity
function calculateMinAmountOut(
    string memory tokenCode,
    uint256 amountIn
) external view returns (uint256 minOut)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token to swap |
| `amountIn` | `uint256` | Amount of tokens to swap |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Minimum WETH output with slippage applied |

**Access Control:** `public view`

**Calculation:**
```solidity
// Get quote
uint256 expectedOut = getSwapQuote(tokenCode, amountIn);

// Apply slippage (e.g., maxSlippage = 200 = 2%)
minOut = (expectedOut * (10000 - maxSlippage)) / 10000;
```

**Gas Cost:** ~12,000 gas

**Usage Example:**
```solidity
// Get safe minimum for 100 ARB swap (2% slippage tolerance)
uint256 minWETH = swapManager.calculateMinAmountOut("ARB", 100e18);

// Use in swap
swapManager.swapTokenForWETH("ARB", 100e18, minWETH);
```

**Called By:** UI, smart contracts preparing swaps

---

### setSimpleSwapRouter {#swapmanager-setsimpleswaprouter}

Updates the SimpleSwap DEX router address.

**Signature:**
```solidity
function setSimpleSwapRouter(address newRouter) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newRouter` | `address` | New SimpleSwap router contract address |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Router must be non-zero address
- ✅ Router must be a contract (not EOA)
- ❌ Reverts with `"Invalid router address"` if zero address

**Events Emitted:**
```solidity
event SimpleSwapRouterUpdated(
    address indexed oldRouter,
    address indexed newRouter
)
```

**Gas Cost:** ~45,000 gas

**Usage Example:**
```solidity
// Update to new SimpleSwap router version
address newRouter = 0x1234...;
swapManager.setSimpleSwapRouter(newRouter);
```

**Security Notes:**
- ⚠️ **CRITICAL:** Only use trusted DEX routers
- ⚠️ Verify router contract code before updating
- ✅ Recommend multi-sig for router updates
- ⚠️ Test on testnet first

**Called By:** Owner during DEX upgrades or configuration

---

### setMaxSlippage {#swapmanager-setmaxslippage}

Updates maximum acceptable slippage for swaps.

**Signature:**
```solidity
function setMaxSlippage(uint256 newSlippage) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newSlippage` | `uint256` | Slippage in basis points (100 = 1%, 200 = 2%) |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Slippage must be <= `MAX_SLIPPAGE_LIMIT` (500 = 5%)
- ❌ Reverts with `"Slippage exceeds maximum"` if > 5%

**Events Emitted:**
```solidity
event MaxSlippageUpdated(
    uint256 oldSlippage,
    uint256 newSlippage
)
```

**Gas Cost:** ~30,000 gas

**Usage Example:**
```solidity
// Set 2% max slippage (200 basis points)
swapManager.setMaxSlippage(200);

// Now all swaps must have minAmountOut >= 98% of expected
```

**Recommended Values:**
- Liquid pairs (ARB/WETH): 1-2% (100-200)
- Less liquid pairs: 2-3% (200-300)
- Stablecoins: 0.5-1% (50-100)

**Security Notes:**
- ⚠️ Higher slippage = more susceptible to sandwich attacks
- ⚠️ Lower slippage = more swap failures in volatile markets
- ✅ Balance between protection and reliability

**Called By:** Owner to adjust for market conditions

---

### setSwapsEnabled {#swapmanager-setswapsenabled}

Enables or disables all swap operations.

**Signature:**
```solidity
function setSwapsEnabled(bool enabled) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `enabled` | `bool` | True to enable, false to disable |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Events Emitted:**
```solidity
event SwapsEnabledChanged(bool enabled)
```

**Gas Cost:** ~30,000 gas

**Usage Example:**
```solidity
// Disable swaps during emergency
swapManager.setSwapsEnabled(false);

// Re-enable after issue resolved
swapManager.setSwapsEnabled(true);
```

**Security Notes:**
- ✅ Emergency kill switch for swap functionality
- ✅ Prevents withdrawals if swaps required but disabled
- ⚠️ Disabling may prevent withdrawals (if WETH insufficient)

**Called By:** Owner during emergency or maintenance

---

### getSwapStats {#swapmanager-getswapstats}

Retrieves swap statistics for a specific token (count and total volume).

**Signature:**
```solidity
function getSwapStats(string memory tokenCode) 
    external view 
    returns (uint256 count, uint256 totalAmount)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tokenCode` | `string` | Token to query stats for |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `count` | `uint256` | Number of swaps executed for this token |
| `totalAmount` | `uint256` | Total token amount swapped (cumulative) |

**Access Control:** `public view`

**Gas Cost:** ~2,500 gas

**Usage Example:**
```solidity
(uint256 count, uint256 total) = swapManager.getSwapStats("ARB");

console.log("ARB swaps:", count);
console.log("Total ARB swapped:", total / 1e18);
```

**Security Notes:**
- ✅ Read-only statistics
- ✅ Useful for monitoring and analytics
- ✅ Can detect unusual swap patterns

**Called By:** 
- Monitoring systems
- Analytics dashboards
- Governance for decision-making

---

## 🚨 EmergencyHandler {#emergencyhandler}

**Purpose:** Emergency pause mechanism and asset recovery procedures  
**Inheritance:** `Ownable`  
**Dependencies:** Beacon, ProxyGeneral, TokenManager, ValueCalculator  
**Timelock:** Configurable (default: 6 hours, max 7 days)

### Module Functions

**Emergency Operations:**
- [triggerEmergencyPause](#emergencyhandler-triggeremergencypause) - Pause entire system
- [unpause](#emergencyhandler-unpause) - Resume operations after timelock
- [emergencyWithdraw](#emergencyhandler-emergencywithdraw) - Transfer all assets to safe address
- [canUnpause](#emergencyhandler-canunpause) - Check if unpause is allowed

**Emergency Contacts:**
- [addEmergencyContact](#emergencyhandler-addemergencycontact) - Add authorized contact
- [removeEmergencyContact](#emergencyhandler-removeemergencycontact) - Remove contact
- [isAuthorizedForEmergency](#emergencyhandler-isauthorizedforemergency) - Check authorization

**System Status:**
- [getSystemHealthStatus](#emergencyhandler-getsystemhealthstatus) - Get system state overview

---

### triggerEmergencyPause {#emergencyhandler-triggeremergencypause}

Triggers emergency pause for the entire system. Can be called by owner or whitelisted emergency contacts.

**Signature:**
```solidity
function triggerEmergencyPause(string memory reason) 
    external 
    onlyEmergencyAuthorized
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `reason` | `string` | Required explanation for emergency (e.g., "Security breach detected") |

**Returns:** None (void)

**Access Control:** `onlyEmergencyAuthorized` (owner or emergency contacts)

**Emergency Flow:**
```
Validate authorization (owner or emergency contact)
    ↓
Validate reason provided (non-empty)
    ↓
Check not already in emergency
    ↓
Check cooldown period passed (if previous emergency)
    ↓
Pause ProxyGeneral (blocks all deposits/withdrawals)
    ↓
Record emergency state:
  - Triggered by
  - Timestamp
  - Reason
    ↓
Update lastEmergencyTimestamp
    ↓
Emit EmergencyPauseTriggered event
    ↓
Notify all emergency contacts
```

**Validations:**
- ✅ Caller must be owner or emergency contact
- ✅ Reason must be non-empty
- ✅ System must not already be paused
- ✅ Cooldown period must have passed (1 day since last emergency)
- ❌ Reverts with `"Not authorized for emergency"` if unauthorized
- ❌ Reverts with `"Reason required"` if empty reason
- ❌ Reverts with `"Emergency already active"` if already paused
- ❌ Reverts with `"Emergency cooldown active"` if < 1 day since last

**Events Emitted:**
```solidity
event EmergencyPauseTriggered(
    address indexed triggeredBy,
    string reason,
    uint256 timestamp
)

event EmergencyContactNotified(address indexed contact)
```

**Gas Cost:** ~80,000 gas + (5,000 per emergency contact)

**Usage Example:**
```solidity
// Security team detects exploit
emergencyHandler.triggerEmergencyPause("Potential reentrancy exploit detected in swap");

// System now paused:
// - No deposits allowed
// - No withdrawals allowed
// - No swaps allowed
// - Emergency contacts notified
```

**Security Notes:**
- ✅ Multi-actor authorization (owner + emergency contacts)
- ✅ Cooldown prevents spam attacks
- ✅ Reason required for transparency/audit
- ⚠️ Emergency contacts must be trusted addresses

**Called By:** Owner or emergency contacts during security issues

**Related Functions:**
- [unpause](#emergencyhandler-unpause) - Resume operations
- [addEmergencyContact](#emergencyhandler-addemergencycontact) - Manage contacts

---

### unpause {#emergencyhandler-unpause}

Resumes system operations after emergency pause. Requires timelock to have elapsed.

**Signature:**
```solidity
function unpause() 
    external 
    onlyOwner
```

**Parameters:** None

**Returns:** None (void)

**Access Control:** `onlyOwner` (only owner can unpause)

**Validations:**
- ✅ Emergency must be active
- ✅ Timelock period must have elapsed (default: 6 hours)
- ❌ Reverts with `"No emergency active"` if not paused
- ❌ Reverts with `"Timelock not expired"` if too soon

**Events Emitted:**
```solidity
event EmergencyUnpaused(
    address indexed by,
    uint256 timestamp,
    uint256 pauseDuration
)

event EmergencyResolved(
    address indexed triggeredBy,
    string reason,
    uint256 triggeredAt,
    uint256 resolvedAt
)
```

**Gas Cost:** ~55,000 gas

**Usage Example:**
```solidity
// After 6 hours, issue resolved
emergencyHandler.unpause();
```

**Security Notes:**
- ✅ Timelock prevents hasty unpausing
- ✅ Only owner can unpause (not emergency contacts)

**Called By:** Owner after emergency resolved

---

### emergencyWithdraw {#emergencyhandler-emergencywithdraw}

Transfers all assets from ProxyGeneral to specified recipient. **CRITICAL FUNCTION - only for dire emergencies.**

**Signature:**
```solidity
function emergencyWithdraw(address recipient) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `recipient` | `address` | Destination address for all assets (recommend multi-sig) |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Recipient must be non-zero address
- ✅ System must be paused
- ✅ Emergency must be active
- ❌ Reverts with `"Invalid recipient"` if zero address
- ❌ Reverts with `"System must be paused"` if not paused
- ❌ Reverts with `"No emergency active"` if no emergency

**Events Emitted:**
```solidity
event EmergencyWithdrawExecuted(
    address indexed recipient,
    uint256 totalValue,
    address indexed by,
    uint256 timestamp
)

event AssetTransferred(
    string indexed tokenCode,
    address indexed tokenAddress,
    uint256 amount,
    address indexed recipient
)
```

**Gas Cost:** ~150,000 gas + (50,000 per active token)

**Usage Example:**
```solidity
// CRITICAL: Contract compromised
address safeMultiSig = 0xABC...;
emergencyHandler.emergencyWithdraw(safeMultiSig);
```

**Security Notes:**
- ⚠️ **NUCLEAR OPTION** - LP holders lose all funds
- ⚠️ No way to reverse this action
- ⚠️ Use multi-sig recipient address
- ✅ Full audit trail via events

**Called By:** Owner in catastrophic emergency

---

### canUnpause {#emergencyhandler-canunpause}

Checks if system can be unpaused (timelock validation).

**Signature:**
```solidity
function canUnpause() 
    external view 
    returns (bool canUnpause, string memory reason)
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `canUnpause` | `bool` | Whether unpause is allowed |
| `reason` | `string` | Explanation (e.g., "Timelock: 3600 seconds remaining") |

**Gas Cost:** ~5,000 gas

**Usage Example:**
```solidity
(bool can, string memory reason) = emergencyHandler.canUnpause();
if (!can) {
    console.log("Cannot unpause:", reason);
}
```

---

### addEmergencyContact {#emergencyhandler-addemergencycontact}

Adds address to whitelist of emergency contacts who can trigger pause.

**Signature:**
```solidity
function addEmergencyContact(address contact) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `contact` | `address` | Address to authorize for emergency pause |

**Validations:**
- ✅ Contact must be non-zero address
- ✅ Contact must not already be added
- ❌ Reverts with `"Invalid contact"` if zero address
- ❌ Reverts with `"Contact already added"` if duplicate

**Events Emitted:**
```solidity
event EmergencyContactAdded(address indexed contact)
```

**Gas Cost:** ~50,000 gas

---

### removeEmergencyContact {#emergencyhandler-removeemergencycontact}

Removes address from emergency contacts whitelist.

**Signature:**
```solidity
function removeEmergencyContact(address contact) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `contact` | `address` | Address to remove from whitelist |

**Validations:**
- ✅ Contact must exist in whitelist
- ❌ Reverts with `"Contact not found"` if not whitelisted

**Events Emitted:**
```solidity
event EmergencyContactRemoved(address indexed contact)
```

**Gas Cost:** ~40,000 gas

---

### isAuthorizedForEmergency {#emergencyhandler-isauthorizedforemergency}

Checks if address can trigger emergency pause.

**Signature:**
```solidity
function isAuthorizedForEmergency(address account) 
    external view 
    returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `account` | `address` | Address to check |

**Returns:**
| Type | Description |
|------|-------------|
| `bool` | True if owner or emergency contact |

**Gas Cost:** ~3,000 gas

---

### getSystemHealthStatus {#emergencyhandler-getsystemhealthstatus}

Retrieves comprehensive system health snapshot.

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
| `isPaused` | `bool` | Whether system is currently paused |
| `totalValue` | `uint256` | Total pool value in ETH (18 decimals) |
| `lpSupply` | `uint256` | Total LP token supply |
| `activeTokens` | `string[]` | List of active token codes |

**Gas Cost:** ~50,000 gas

**Usage Example:**
```solidity
(bool paused, uint256 value, uint256 supply, string[] memory tokens) = 
    emergencyHandler.getSystemHealthStatus();

console.log("Paused:", paused);
console.log("Total Value:", value / 1e18, "ETH");
console.log("LP Supply:", supply / 1e18);
```

**Called By:** Monitoring systems, dashboards

---

## ⚙️ ParameterManager {#parametermanager}

**Purpose:** Dynamic configuration management with timelock protection  
**Inheritance:** `Ownable`  
**Dependencies:** Beacon, ProxyGeneral (for emergency checks)  
**Default Timelock:** 24 hours

### Module Functions

**Parameter Management:**
- [registerParameter](#parametermanager-registerparameter) - Register new parameter
- [proposeParameterChange](#parametermanager-proposeparameterchange) - Propose value change
- [executeParameterChange](#parametermanager-executeparameterchange) - Execute after timelock
- [emergencySetParameter](#parametermanager-emergencysetparameter) - Override timelock in emergency

**Queries:**
- [getCurrentParameterValue](#parametermanager-getcurrentparametervalue) - Get current value
- [getParameterInfo](#parametermanager-getparameterinfo) - Get full parameter details
- [getParameterHistory](#parametermanager-getparameterhistory) - Get change history
- [getAllParameters](#parametermanager-getallparameters) - List all parameters

**Validation:**
- [canExecuteParameterChange](#parametermanager-canexecuteparameterchange) - Check if executable

**Configuration:**
- [setParameterTimelock](#parametermanager-setparametertimelock) - Update timelock duration

---

### registerParameter {#parametermanager-registerparameter}

Registers a new configurable parameter with validation bounds and timelock requirements.

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

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Unique identifier (e.g., "DEPOSIT_FEE", "MAX_SLIPPAGE") |
| `initialValue` | `uint256` | Starting value |
| `minValue` | `uint256` | Minimum allowed value (inclusive) |
| `maxValue` | `uint256` | Maximum allowed value (inclusive) |
| `requiresTimelock` | `bool` | Whether changes require timelock delay |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Parameter name must be non-empty
- ✅ Parameter must not already exist
- ✅ minValue <= maxValue
- ✅ initialValue must be within [minValue, maxValue]
- ❌ Reverts with `"Invalid parameter name"` if empty
- ❌ Reverts with `"Parameter already registered"` if exists
- ❌ Reverts with `"Invalid range"` if min > max
- ❌ Reverts with `"Initial value out of range"` if not in bounds

**Events Emitted:**
```solidity
event ParameterRegistered(
    string indexed parameterName,
    uint256 initialValue,
    uint256 minValue,
    uint256 maxValue,
    bool requiresTimelock
)
```

**Gas Cost:** ~120,000 gas

**Usage Example:**
```solidity
// Register deposit fee parameter
// Value in basis points: 50 = 0.5%, max 5%
parameterManager.registerParameter(
    "DEPOSIT_FEE",     // name
    50,                 // initial: 0.5%
    0,                  // min: 0%
    500,                // max: 5%
    false               // immediate changes allowed
);

// Register hourly withdraw limit (critical parameter)
parameterManager.registerParameter(
    "HOURLY_LIMIT",
    10 ether,           // initial: 10 ETH
    1 ether,            // min: 1 ETH
    1000 ether,         // max: 1000 ETH
    true                // requires timelock
);
```

**Common Parameters:**
```solidity
// Fees (basis points: 100 = 1%)
DEPOSIT_FEE:    0-500 (0-5%)
WITHDRAW_FEE:   0-500 (0-5%)

// Limits (wei)
MIN_DEPOSIT:    0.001-1 ether
HOURLY_LIMIT:   1-1000 ether (timelock)
DAILY_LIMIT:    10-10000 ether (timelock)

// Counts
MAX_TOKENS:     5-50 (timelock)
MAX_ERRORS:     1-100

// Durations (seconds)
CACHE_DURATION: 1 minutes - 1 hours
MAX_PRICE_AGE:  5 minutes - 24 hours (timelock)

// Slippage (basis points)
MAX_SLIPPAGE:   10-500 (0.1-5%)
```

**Parameter Structure:**
```solidity
struct Parameter {
    uint256 currentValue;      // Active value
    uint256 proposedValue;     // Pending value (if timelock)
    uint256 proposedAt;        // When proposed
    uint256 effectiveAt;       // When executable
    uint256 minValue;          // Minimum bound
    uint256 maxValue;          // Maximum bound
    bool requiresTimelock;     // If delayed change
    bool isActive;             // If registered
}
```

**Security Notes:**
- ✅ Bounds prevent invalid configurations
- ✅ Timelock for critical parameters (limits, durations)
- ✅ History tracking for audit
- ⚠️ Cannot unregister parameters (permanent)

**Called By:** Owner during system initialization

**Related Functions:**
- [proposeParameterChange](#parametermanager-proposeparameterchange) - Change value
- [getParameterInfo](#parametermanager-getparameterinfo) - View details

---

### proposeParameterChange {#parametermanager-proposeparameterchange}

Proposes a parameter value change. Immediate for non-timelock params, delayed for timelock params.

**Signature:**
```solidity
function proposeParameterChange(
    string memory parameterName,
    uint256 newValue
) external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter to update |
| `newValue` | `uint256` | Proposed new value |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Parameter must be registered
- ✅ newValue must be within [minValue, maxValue]
- ✅ newValue must differ from currentValue
- ❌ Reverts with `"Parameter not registered"` if not exists
- ❌ Reverts with `"Value out of range"` if not in bounds
- ❌ Reverts with `"Same as current value"` if unchanged

**Events Emitted:**
```solidity
// For timelock parameters
event ParameterChangeProposed(
    string indexed parameterName,
    uint256 oldValue,
    uint256 newValue,
    uint256 effectiveAt
)

// For immediate parameters
event ParameterChanged(
    string indexed parameterName,
    uint256 oldValue,
    uint256 newValue,
    address indexed changedBy
)
```

**Gas Cost:** 
- Immediate change: ~80,000 gas
- Timelock proposal: ~60,000 gas

**Usage Example:**
```solidity
// Immediate change (no timelock)
parameterManager.proposeParameterChange("DEPOSIT_FEE", 100); // 1%
// Changes immediately

// Timelock change (requires timelock)
parameterManager.proposeParameterChange("HOURLY_LIMIT", 20 ether);
// Proposal recorded, must wait 24 hours to execute
```

**Timelock Flow:**
```solidity
if (requiresTimelock) {
    // Store proposal
    proposedValue = newValue;
    proposedAt = block.timestamp;
    effectiveAt = block.timestamp + parameterTimelock; // +24 hours
    
    emit ParameterChangeProposed(..., effectiveAt);
    
    // Must call executeParameterChange after timelock
} else {
    // Apply immediately
    currentValue = newValue;
    
    // Add to history
    parameterHistory.push(...);
    
    emit ParameterChanged(...);
}
```

**Security Notes:**
- ✅ Timelock gives community time to react
- ✅ Range validation prevents extreme values
- ✅ History tracking for audit

**Called By:** Owner to adjust system parameters

**Related Functions:**
- [executeParameterChange](#parametermanager-executeparameterchange) - Execute timelock
- [canExecuteParameterChange](#parametermanager-canexecuteparameterchange) - Check status

---

### executeParameterChange {#parametermanager-executeparameterchange}

Executes a proposed parameter change after timelock period expires.

**Signature:**
```solidity
function executeParameterChange(string memory parameterName) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter with pending proposal |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Parameter must be registered
- ✅ Parameter must require timelock
- ✅ Must have pending proposal
- ✅ Timelock period must have elapsed
- ❌ Reverts with `"Parameter not registered"` if not exists
- ❌ Reverts with `"Parameter doesn't require timelock"` if immediate
- ❌ Reverts with `"No pending proposal"` if none
- ❌ Reverts with `"Timelock not expired"` if too soon

**Events Emitted:**
```solidity
event ParameterChanged(
    string indexed parameterName,
    uint256 oldValue,
    uint256 newValue,
    address indexed changedBy
)
```

**Gas Cost:** ~85,000 gas

**Usage Example:**
```solidity
// Day 1: Propose change
parameterManager.proposeParameterChange("HOURLY_LIMIT", 20 ether);
// effectiveAt = now + 24 hours

// Day 2 (after 24 hours): Execute
parameterManager.executeParameterChange("HOURLY_LIMIT");
// Now currentValue = 20 ether
```

**Execution Flow:**
```
Validate timelock expired
    ↓
Apply change: currentValue = proposedValue
    ↓
Reset proposal state:
  - proposedValue = 0
  - proposedAt = 0
  - effectiveAt = 0
    ↓
Add to history:
  - value: newValue
  - timestamp: block.timestamp
  - changedBy: msg.sender
    ↓
Emit ParameterChanged event
```

**Security Notes:**
- ✅ Cannot skip timelock (must wait full duration)
- ✅ Owner can cancel by proposing different value
- ✅ Full history maintained

**Called By:** Owner after timelock expires

**Related Functions:**
- [proposeParameterChange](#parametermanager-proposeparameterchange) - Create proposal
- [canExecuteParameterChange](#parametermanager-canexecuteparameterchange) - Validate timing

---

### emergencySetParameter {#parametermanager-emergencysetparameter}

Bypasses timelock to set parameter immediately. **Only allowed when system is paused.**

**Signature:**
```solidity
function emergencySetParameter(
    string memory parameterName,
    uint256 newValue
) external onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter to update |
| `newValue` | `uint256` | New value |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Parameter must be registered
- ✅ newValue must be within [minValue, maxValue]
- ✅ System must be paused
- ❌ Reverts with `"Parameter not registered"` if not exists
- ❌ Reverts with `"Value out of range"` if not in bounds
- ❌ Reverts with `"System must be paused for emergency override"` if not paused

**Events Emitted:**
```solidity
event ParameterEmergencyChanged(
    string indexed parameterName,
    uint256 oldValue,
    uint256 newValue,
    address indexed changedBy
)
```

**Gas Cost:** ~90,000 gas

**Usage Example:**
```solidity
// Emergency: need to increase limits immediately
// 1. Pause system
emergencyHandler.triggerEmergencyPause("Need emergency parameter change");

// 2. Set parameter (bypasses timelock)
parameterManager.emergencySetParameter("HOURLY_LIMIT", 100 ether);

// 3. Unpause after timelock
emergencyHandler.unpause();
```

**Security Notes:**
- ⚠️ **Use sparingly** - bypasses safety timelock
- ✅ Requires system pause (deliberate action)
- ✅ Distinct event for audit trail
- ⚠️ Still respects min/max bounds

**Called By:** Owner during emergency requiring immediate config change

---

### getCurrentParameterValue {#parametermanager-getcurrentparametervalue}

Gets the active value for a parameter.

**Signature:**
```solidity
function getCurrentParameterValue(string memory parameterName) 
    external view 
    returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter to query |

**Returns:**
| Type | Description |
|------|-------------|
| `uint256` | Current active value |

**Validations:**
- ❌ Reverts with `"Parameter not registered"` if not exists

**Gas Cost:** ~3,000 gas

**Usage Example:**
```solidity
uint256 depositFee = parameterManager.getCurrentParameterValue("DEPOSIT_FEE");
// e.g., 50 (0.5%)

uint256 hourlyLimit = parameterManager.getCurrentParameterValue("HOURLY_LIMIT");
// e.g., 10 ether
```

**Called By:** All modules needing configuration values

---

### getParameterInfo {#parametermanager-getparameterinfo}

Gets full parameter details including bounds, proposal status, and timelock info.

**Signature:**
```solidity
function getParameterInfo(string memory parameterName) 
    external view 
    returns (Parameter memory)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter to query |

**Returns:**
| Type | Description |
|------|-------------|
| `Parameter` | Complete parameter struct |

**Parameter Struct:**
```solidity
struct Parameter {
    uint256 currentValue;      // Active value
    uint256 proposedValue;     // Pending value (0 if none)
    uint256 proposedAt;        // Proposal timestamp
    uint256 effectiveAt;       // When executable
    uint256 minValue;          // Min bound
    uint256 maxValue;          // Max bound
    bool requiresTimelock;     // Delay required
    bool isActive;             // Is registered
}
```

**Gas Cost:** ~5,000 gas

**Usage Example:**
```solidity
Parameter memory info = parameterManager.getParameterInfo("HOURLY_LIMIT");

console.log("Current:", info.currentValue / 1e18, "ETH");
console.log("Range:", info.minValue / 1e18, "-", info.maxValue / 1e18, "ETH");

if (info.proposedValue > 0) {
    console.log("Pending:", info.proposedValue / 1e18, "ETH");
    console.log("Effective at:", info.effectiveAt);
}
```

**Called By:** Dashboards, monitoring tools

---

### getParameterHistory {#parametermanager-getparameterhistory}

Retrieves complete change history for a parameter (audit trail).

**Signature:**
```solidity
function getParameterHistory(string memory parameterName) 
    external view 
    returns (ParameterHistory[] memory)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter to query |

**Returns:**
| Type | Description |
|------|-------------|
| `ParameterHistory[]` | Array of all changes (chronological) |

**ParameterHistory Struct:**
```solidity
struct ParameterHistory {
    uint256 value;           // Value set
    uint256 timestamp;       // When changed
    address changedBy;       // Who changed it
}
```

**Gas Cost:** ~5,000 + (500 per history entry)

**Usage Example:**
```solidity
ParameterHistory[] memory history = 
    parameterManager.getParameterHistory("DEPOSIT_FEE");

for (uint i = 0; i < history.length; i++) {
    console.log("Changed to", history[i].value, "by", history[i].changedBy);
    console.log("At timestamp:", history[i].timestamp);
}
```

**Called By:** Governance, auditors, analytics

---

### getAllParameters {#parametermanager-getallparameters}

Lists all registered parameters with their current values.

**Signature:**
```solidity
function getAllParameters() 
    external view 
    returns (
        string[] memory names,
        uint256[] memory values
    )
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `names` | `string[]` | Array of parameter names |
| `values` | `uint256[]` | Array of current values (same order) |

**Gas Cost:** ~10,000 + (1,000 per parameter)

**Usage Example:**
```solidity
(string[] memory names, uint256[] memory values) = 
    parameterManager.getAllParameters();

for (uint i = 0; i < names.length; i++) {
    console.log(names[i], "=", values[i]);
}

// Output:
// DEPOSIT_FEE = 50
// WITHDRAW_FEE = 50
// HOURLY_LIMIT = 10000000000000000000
// ...
```

**Called By:** Dashboards, configuration management tools

---

### canExecuteParameterChange {#parametermanager-canexecuteparameterchange}

Validates if a proposed parameter change can be executed.

**Signature:**
```solidity
function canExecuteParameterChange(string memory parameterName) 
    external view 
    returns (bool canExecute, string memory reason)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `parameterName` | `string` | Parameter to check |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| `canExecute` | `bool` | Whether execution allowed |
| `reason` | `string` | Explanation if cannot execute |

**Gas Cost:** ~5,000 gas

**Usage Example:**
```solidity
(bool can, string memory reason) = 
    parameterManager.canExecuteParameterChange("HOURLY_LIMIT");

if (can) {
    parameterManager.executeParameterChange("HOURLY_LIMIT");
} else {
    console.log("Cannot execute:", reason);
    // e.g., "Timelock: 3600 seconds remaining"
}
```

**Possible Reasons:**
- "Parameter not registered"
- "Parameter doesn't require timelock execution"
- "No pending proposal"
- "Timelock: X seconds remaining"

**Called By:** UI/scripts before attempting execution

---

### setParameterTimelock {#parametermanager-setparametertimelock}

Updates the default timelock duration for parameter changes.

**Signature:**
```solidity
function setParameterTimelock(uint256 newTimelock) 
    external 
    onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `newTimelock` | `uint256` | New timelock duration in seconds |

**Returns:** None (void)

**Access Control:** `onlyOwner`

**Validations:**
- ✅ Timelock must be >= MIN_TIMELOCK (1 hour)
- ✅ Timelock must be <= MAX_TIMELOCK (7 days)
- ❌ Reverts with `"Timelock out of range"` if not in [1 hour, 7 days]

**Events Emitted:**
```solidity
event ParameterTimelockUpdated(
    uint256 oldTimelock,
    uint256 newTimelock
)
```

**Gas Cost:** ~30,000 gas

**Usage Example:**
```solidity
// Set to 48 hours
parameterManager.setParameterTimelock(48 hours);

// Now all timelock proposals require 48 hour delay
```

**Security Notes:**
- ✅ Bounds prevent too short (hasty) or too long (inflexible)
- ⚠️ Affects only future proposals (not existing pending changes)

**Called By:** Owner to adjust governance timing

---

---

### proposeParameterChange {#parametermanager-proposeparameterchange}

_See comprehensive documentation above in registerParameter section_

---

### executeParameterChange {#parametermanager-executeparameterchange}

_See comprehensive documentation above in registerParameter section_

---

### emergencySetParameter {#parametermanager-emergencysetparameter}

_See comprehensive documentation above in registerParameter section_

---

### getCurrentParameterValue {#parametermanager-getcurrentparametervalue}

_See comprehensive documentation above in registerParameter section_

---

### getParameterInfo {#parametermanager-getparameterinfo}

_See comprehensive documentation above in registerParameter section_

---

### getParameterHistory {#parametermanager-getparameterhistory}

_See comprehensive documentation above in registerParameter section_

---

### getAllParameters {#parametermanager-getallparameters}

_See comprehensive documentation above in registerParameter section_

---

### canExecuteParameterChange {#parametermanager-canexecuteparameterchange}

_See comprehensive documentation above in registerParameter section_

---

### setParameterTimelock {#parametermanager-setparametertimelock}

_See comprehensive documentation above in registerParameter section_

---

## 📖 Architecture Overview {#architecture-overview}

### System Architecture

The DeFi Modular System follows a **hub-and-spoke architecture** with the Beacon as the central registry and ProxyGeneral as the asset custodian.

```
                           🔗 Beacon (Registry)
                                    |
                    ┌───────────────┼───────────────┐
                    |               |               |
              🏛️ ProxyGeneral ──────┼────── 🏦 TokenManager
              (Asset Custodian)     |     (Oracle Integration)
                    |               |               |
                    └───────────────┼───────────────┘
                                    |
            ┌───────────────────────┼───────────────────────┐
            |                       |                       |
      📊 ValueCalculator    💰 LiquidityManager    🔄 SwapManager
      (Pool Valuation)     (Deposit/Withdraw)    (DEX Integration)
            |                       |                       |
            └───────────────────────┼───────────────────────┘
                                    |
                    ┌───────────────┼───────────────┐
                    |               |               |
              🚨 EmergencyHandler  ⚙️ ParameterManager
              (Emergency Control)  (Configuration)
```

### Module Dependencies

```
Dependency Flow (A → B means A depends on B):

🔗 Beacon
  ├── No dependencies (fully independent)

🏛️ ProxyGeneral
  ├── → Beacon (for module authorization)
  
🏦 TokenManager  
  ├── → Beacon (for WETH address resolution)
  └── → Chainlink Oracles (external)

📊 ValueCalculator
  ├── → Beacon (for all module resolution)
  ├── → TokenManager (for token data & prices)
  └── → ProxyGeneral (for asset balances)

💰 LiquidityManager
  ├── → Beacon (for module resolution)
  ├── → ProxyGeneral (mint/burn/transfer)
  ├── → ValueCalculator (pool valuations)
  └── → SwapManager (for insufficient WETH)

🔄 SwapManager
  ├── → Beacon (for module resolution)
  ├── → ProxyGeneral (asset transfers)
  ├── → TokenManager (token validation)
  └── → SimpleSwap DEX (external)

🚨 EmergencyHandler
  ├── → Beacon (for module resolution)
  ├── → ProxyGeneral (pause/emergency transfers)
  ├── → TokenManager (asset enumeration)
  └── → ValueCalculator (system health)

⚙️ ParameterManager
  ├── → Beacon (for module resolution)
  └── → ProxyGeneral (emergency state checks)
```

### Data Flow Patterns

#### **Deposit Flow**
```
User (ETH) → LiquidityManager → ValueCalculator → TokenManager
                     ↓                ↓              ↓
                ProxyGeneral ← Pool Valuation ← Price Feeds
                (WETH + LP tokens)
```

#### **Withdrawal Flow**
```
User (LP) → LiquidityManager → ValueCalculator → ProxyGeneral
                   ↓                ↓              ↓
             SwapManager ← Token Selection ← Asset Balances
                   ↓              
            SimpleSwap DEX → WETH → User (ETH)
```

#### **Emergency Flow**
```
Trigger → EmergencyHandler → ProxyGeneral (Pause)
            ↓                      ↓
    Emergency Contacts      All Operations Halted
            ↓                      ↓
    Owner Decision → Unpause/Emergency Transfer
```

### Access Control Hierarchy

```
🔐 Access Levels:

1️⃣ PUBLIC VIEW
   - Price queries, balance checks, status queries
   - No state changes, gas-efficient

2️⃣ AUTHORIZED MODULES  
   - mint/burn LP tokens, transfer assets
   - Core operational functions
   - Validated via Beacon registry

3️⃣ OWNER ONLY
   - Module authorization, parameter updates
   - System configuration, emergency unpause
   - Highest privilege level

4️⃣ EMERGENCY CONTACTS
   - Can trigger emergency pause
   - Subset of emergency functions
   - Fast response capability

Multi-Sig Recommended:
├── Owner functions (upgrades, config)  
├── Emergency contacts (pause triggers)
└── Parameter timelock (governance)
```

### State Management

#### **Storage Patterns**
- **Beacon**: Mapping-based registry (`moduleName → address`)
- **ProxyGeneral**: ERC20 standard + authorization mapping + rate limiting
- **TokenManager**: Struct-based token data + dynamic arrays + error counters
- **ValueCalculator**: Cache mappings with timestamps + error tracking
- **LiquidityManager**: Rate limiting structs per user per timeframe
- **SwapManager**: Configuration variables + statistics tracking
- **EmergencyHandler**: Emergency state struct + contacts array + timelock
- **ParameterManager**: Parameter structs + history arrays + proposal system

#### **Cache Strategy**
```
📊 ValueCalculator Cache Layers:

L1: Token Prices (5 min TTL)
├── Individual token price + timestamp
├── Chainlink staleness validation
└── Error counter per token

L2: Token Values (computed on-demand)
├── Balance × Price calculation
├── Decimal normalization
└── ETH-denominated result

L3: Pool Value (aggregated)
├── WETH + all token values
├── Percentage breakdown
└── LP share calculations
```

### Security Architecture

#### **Defense in Depth**
```
🛡️ Security Layers:

1️⃣ ACCESS CONTROL
   - onlyOwner, onlyAuthorizedModule modifiers
   - Multi-sig recommendations
   - Emergency contact whitelist

2️⃣ VALIDATION
   - Input sanitization (addresses, amounts, ranges)
   - Business logic validation (limits, staleness)
   - Oracle data validation (Chainlink)

3️⃣ REENTRANCY PROTECTION  
   - nonReentrant modifiers on state-changing functions
   - Checks-Effects-Interactions pattern
   - Asset custody in single contract

4️⃣ PAUSE MECHANISM
   - Emergency halt capability
   - Timelock for unpause
   - Graduated response (pause → emergency transfer)

5️⃣ RATE LIMITING
   - Hourly/daily withdrawal limits
   - Per-user tracking
   - Cooldown mechanisms

6️⃣ UPGRADE SAFETY
   - Beacon-based upgrades (not proxy)
   - Timelock recommendations
   - Module isolation
```

#### **Critical Invariants**
1. **Asset Conservation**: `ProxyGeneral assets ≥ LP token claims`
2. **Authorization**: Only authorized modules can mint/burn/transfer
3. **Oracle Safety**: Price feeds validated before use
4. **Rate Limiting**: Withdrawal limits enforced per user
5. **Emergency Safety**: Pause halts operations, unpause requires timelock

### Integration Points

#### **External Dependencies**
```
🔗 Chainlink Oracles
├── Price feeds for all supported tokens
├── Staleness validation (heartbeat)
├── Error handling & fallback

🔄 SimpleSwap DEX
├── Token → WETH swaps
├── Slippage protection
├── Approval management

🌐 ERC20 Tokens
├── Standard interface compliance
├── Balance queries & transfers
├── Approval patterns
```

#### **User Interfaces**
```
👥 Frontend Integration Points:

📱 Web UI
├── Deposit/withdrawal forms
├── Portfolio dashboard
├── Emergency notifications

🔧 Smart Contract Interfaces  
├── Direct function calls
├── Event monitoring
├── Error handling

📊 Analytics & Monitoring
├── Pool metrics
├── Oracle health
├── System status
```

---

## 🔧 Common Patterns {#common-patterns}

### Access Control Patterns

#### **1. Owner-Only Pattern**
```solidity
modifier onlyOwner() {
    require(msg.sender == owner(), "Only owner");
    _;
}

// Usage across modules
function updateImplementation(...) external onlyOwner { }  // Beacon
function authorizeModule(address, string) external onlyOwner { }  // ProxyGeneral (v2.0: added moduleType param)
function manageTokenData(...) external onlyOwner { }       // TokenManager
function registerParameter(...) external onlyOwner { }     // ParameterManager
```

#### **2. Authorized Module Pattern**
```solidity
modifier onlyAuthorizedModule() {
    require(
        IBeacon(beacon).getImplementation("ProxyGeneral") != address(0) &&
        IProxyGeneral(beacon.getImplementation("ProxyGeneral"))
            .isAuthorizedModule(msg.sender),
        "Caller not authorized"
    );
    _;
}

// Critical functions restricted to authorized modules
function mint(...) external onlyAuthorizedModule { }           // LP token minting
function burn(...) external onlyAuthorizedModule { }           // LP token burning  
function transferFunds(...) external onlyAuthorizedModule { }  // Asset transfers
function approveSpender(...) external onlyAuthorizedModule { } // DEX approvals
```

#### **3. Emergency Authorization Pattern**
```solidity
modifier onlyEmergencyAuthorized() {
    require(
        msg.sender == owner() || isEmergencyContact[msg.sender],
        "Not authorized for emergency"
    );
    _;
}

// Emergency functions callable by owner OR emergency contacts
function triggerEmergencyPause(...) external onlyEmergencyAuthorized { }
```

#### **4. Two-Step Ownership Transfer**
```solidity
// Step 1: Current owner proposes new owner
function transferOwnership(address newOwner) external onlyOwner {
    pendingOwner = newOwner;
    emit OwnershipTransferStarted(owner(), newOwner);
}

// Step 2: New owner accepts ownership
function acceptOwnership() external {
    require(msg.sender == pendingOwner, "Not pending owner");
    emit OwnershipTransferred(owner(), pendingOwner);
    _transferOwnership(pendingOwner);
    pendingOwner = address(0);
}
```

### Reentrancy Protection Patterns

#### **1. NonReentrant Modifier**
```solidity
bool private _locked;

modifier nonReentrant() {
    require(!_locked, "Reentrant call");
    _locked = true;
    _;
    _locked = false;
}

// Applied to all state-changing functions
function deposit() external payable nonReentrant whenNotPaused { }
function withdraw(...) external nonReentrant whenNotPaused { }
function swapTokenForWETH(...) external nonReentrant { }
```

#### **2. Checks-Effects-Interactions Pattern**
```solidity
function withdraw(uint256 lpAmount) external nonReentrant whenNotPaused {
    // 1️⃣ CHECKS
    require(lpAmount > 0, "Invalid amount");
    require(balanceOf(msg.sender) >= lpAmount, "Insufficient balance");
    
    // 2️⃣ EFFECTS (state changes first)
    _burn(msg.sender, lpAmount);
    uint256 ethAmount = calculateWithdrawAmount(lpAmount);
    
    // 3️⃣ INTERACTIONS (external calls last)
    IWETH(weth).transfer(msg.sender, ethAmount);
    
    emit Withdrawal(msg.sender, lpAmount, ethAmount);
}
```

### Pause Mechanism Patterns

#### **1. Pausable Operations**
```solidity
modifier whenNotPaused() {
    require(!paused(), "System is paused");
    _;
}

modifier whenPaused() {
    require(paused(), "System is not paused");
    _;
}

// Normal operations require system to be active
function mint(...) external onlyAuthorizedModule whenNotPaused { }
function burn(...) external onlyAuthorizedModule whenNotPaused { }
function deposit() external payable whenNotPaused { }

// Emergency operations require system to be paused
function emergencyTransferAll(...) external onlyOwner whenPaused { }
```

#### **2. Emergency Pause Pattern**
```solidity
// Any authorized module can pause (fast response)
function pause() external onlyAuthorizedModule {
    require(!paused(), "Already paused");
    _pause();
}

// Only owner can unpause (deliberate action)
function unpause() external onlyOwner {
    require(paused(), "Not paused");
    _unpause();
}

// Emergency handler adds timelock
function unpause() external onlyOwner {
    require(emergencyState.isActive, "No emergency active");
    require(
        block.timestamp >= emergencyState.triggeredAt + unpauseTimelock,
        "Timelock not expired"
    );
    // ... unpause logic
}
```

### Caching Patterns

#### **1. Timestamped Cache with TTL**
```solidity
struct CachedValue {
    uint256 value;
    uint256 timestamp;
    uint256 price;        // Additional cached data
}

mapping(string => CachedValue) private tokenValueCache;
uint256 public cacheDuration = 5 minutes;

function getCachedValue(string memory tokenCode) public view returns (uint256) {
    CachedValue memory cached = tokenValueCache[tokenCode];
    
    // Check if cache is valid
    if (cached.timestamp > 0 && 
        block.timestamp <= cached.timestamp + cacheDuration) {
        return cached.value;  // Cache hit
    }
    
    return 0; // Cache miss - caller must refresh
}

function updateCache(string memory tokenCode, uint256 value, uint256 price) internal {
    tokenValueCache[tokenCode] = CachedValue({
        value: value,
        timestamp: block.timestamp,
        price: price
    });
}
```

#### **2. Error-Aware Caching**
```solidity
mapping(string => uint256) private tokenErrors;
uint256 public constant maxErrors = 5;

function calculateWithErrorTracking(string memory tokenCode) external returns (uint256) {
    try this.calculateValue(tokenCode) returns (uint256 value) {
        // Success: reset error counter
        tokenErrors[tokenCode] = 0;
        updateCache(tokenCode, value);
        return value;
        
    } catch Error(string memory reason) {
        // Error: increment counter
        tokenErrors[tokenCode]++;
        
        if (tokenErrors[tokenCode] >= maxErrors) {
            emit ErrorThresholdReached(tokenCode);
            // Consider disabling token or using fallback
        }
        
        // Try to return cached value
        uint256 cached = getCachedValue(tokenCode);
        require(cached > 0, "No cached value available");
        return cached;
    }
}
```

### Validation Patterns

#### **1. Comprehensive Input Validation**
```solidity
function manageTokenData(
    string memory tokenCode,
    address tokenAddress,
    address priceFeed,
    uint8 tokenDecimals,
    uint8 priceFeedDecimals,
    uint256 heartbeat
) external onlyOwner {
    // String validation
    require(bytes(tokenCode).length > 0 && bytes(tokenCode).length <= 16, "Invalid token code");
    
    // Address validation
    require(tokenAddress != address(0), "Invalid token address");
    require(tokenAddress.code.length > 0, "Token must be contract");
    
    // Business logic validation
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    require(tokenAddress != wethAddress, "Cannot add WETH as token");
    
    // Range validation
    require(heartbeat > 0, "Invalid heartbeat");
    require(tokenDecimals <= 18, "Too many decimals");
    
    // External validation (Chainlink feed test)
    AggregatorV3Interface feed = AggregatorV3Interface(priceFeed);
    (, int256 price, , uint256 updatedAt, ) = feed.latestRoundData();
    require(price > 0, "Invalid price feed");
    require(updatedAt > 0, "Price feed not updated");
    
    // State update after all validations
    _updateTokenData(tokenCode, tokenAddress, priceFeed, tokenDecimals, priceFeedDecimals, heartbeat);
}
```

#### **2. Oracle Data Validation**
```solidity
function validateChainlinkPrice(
    AggregatorV3Interface priceFeed,
    uint256 heartbeat
) internal view returns (uint256 price, uint256 updatedAt, bool isStale) {
    (
        uint80 roundId,
        int256 rawPrice,
        uint256 startedAt,
        uint256 timestamp,
        uint80 answeredInRound
    ) = priceFeed.latestRoundData();
    
    // Validate round completion
    require(timestamp > 0, "Round not complete");
    require(rawPrice > 0, "Invalid price");
    
    // Validate round freshness (not stale at source)
    require(answeredInRound >= roundId, "Stale price");
    
    // Check staleness based on heartbeat
    bool stale = block.timestamp - timestamp > heartbeat;
    
    return (uint256(rawPrice), timestamp, stale);
}
```

### Rate Limiting Patterns

#### **1. Time-Window Rate Limiting**
```solidity
struct WithdrawLimits {
    uint256 hourlyLimit;      // Max per hour
    uint256 dailyLimit;       // Max per day  
}

mapping(address => WithdrawLimits) private userLimits;
mapping(address => mapping(uint256 => uint256)) private hourlyWithdrawn;
mapping(address => mapping(uint256 => uint256)) private dailyWithdrawn;

function checkWithdrawLimits(address user, uint256 amount) external view {
    uint256 currentHour = block.timestamp / 1 hours;
    uint256 currentDay = block.timestamp / 1 days;
    
    WithdrawLimits memory limits = userLimits[user];
    
    // Check hourly limit
    uint256 hourlyUsed = hourlyWithdrawn[user][currentHour];
    require(hourlyUsed + amount <= limits.hourlyLimit, "Hourly limit exceeded");
    
    // Check daily limit
    uint256 dailyUsed = dailyWithdrawn[user][currentDay];
    require(dailyUsed + amount <= limits.dailyLimit, "Daily limit exceeded");
}

function incrementWithdrawLimits(address user, uint256 amount) external onlyAuthorizedModule {
    uint256 currentHour = block.timestamp / 1 hours;
    uint256 currentDay = block.timestamp / 1 days;
    
    hourlyWithdrawn[user][currentHour] += amount;
    dailyWithdrawn[user][currentDay] += amount;
}
```

### Event Emission Patterns

#### **1. Comprehensive Event Logging**
```solidity
// Always emit events for state changes
event LPTokenMinted(
    address indexed to,
    uint256 amount,
    uint256 newTotalSupply
);

event AssetTransferred(
    address indexed to,
    address indexed asset,
    uint256 amount,
    address indexed module      // Which module initiated transfer
);

// Include relevant context in events
function mint(address to, uint256 amount) external onlyAuthorizedModule whenNotPaused {
    _mint(to, amount);
    
    emit LPTokenMinted(
        to,
        amount, 
        totalSupply()           // Current total supply
    );
}
```

#### **2. Error Event Pattern**
```solidity
// Emit events for errors (especially in try-catch blocks)
event TokenError(
    string indexed tokenCode,
    string errorMessage
);

event ErrorThresholdReached(string indexed tokenCode);

try tokenManager.getTokenPriceWithEvents(tokenCode) {
    // Success path
} catch Error(string memory reason) {
    emit TokenError(tokenCode, reason);
    
    tokenErrors[tokenCode]++;
    if (tokenErrors[tokenCode] >= maxErrors) {
        emit ErrorThresholdReached(tokenCode);
    }
}
```

### Timelock Patterns

#### **1. Parameter Change Timelock**
```solidity
struct Parameter {
    uint256 currentValue;
    uint256 proposedValue;
    uint256 proposedAt;
    uint256 effectiveAt;        // When change can be executed
    bool requiresTimelock;
}

function proposeParameterChange(string memory param, uint256 newValue) external onlyOwner {
    Parameter storage p = parameters[param];
    
    if (p.requiresTimelock) {
        p.proposedValue = newValue;
        p.proposedAt = block.timestamp;
        p.effectiveAt = block.timestamp + parameterTimelock;
        
        emit ParameterChangeProposed(param, p.currentValue, newValue, p.effectiveAt);
    } else {
        p.currentValue = newValue;
        emit ParameterChanged(param, p.currentValue, newValue, msg.sender);
    }
}

function executeParameterChange(string memory param) external onlyOwner {
    Parameter storage p = parameters[param];
    require(p.proposedValue > 0, "No pending proposal");
    require(block.timestamp >= p.effectiveAt, "Timelock not expired");
    
    uint256 oldValue = p.currentValue;
    p.currentValue = p.proposedValue;
    
    // Clear proposal
    p.proposedValue = 0;
    p.proposedAt = 0;
    p.effectiveAt = 0;
    
    emit ParameterChanged(param, oldValue, p.currentValue, msg.sender);
}
```

#### **2. Emergency Timelock Pattern**
```solidity
function unpause() external onlyOwner {
    require(emergencyState.isActive, "No emergency active");
    
    uint256 timeSincePause = block.timestamp - emergencyState.triggeredAt;
    require(timeSincePause >= unpauseTimelock, "Timelock not expired");
    
    // Unpause system
    IProxyGeneral(beacon.getImplementation("ProxyGeneral")).unpause();
    
    // Clear emergency state
    delete emergencyState;
    
    emit EmergencyUnpaused(msg.sender, block.timestamp, timeSincePause);
}
```

---

## 📡 Events Index {#events-index}

### All System Events (Alphabetical)

| Event Name | Module | Description | Key Parameters |
|------------|---------|-------------|----------------|
| **AssetTransferred** | ProxyGeneral, EmergencyHandler | Asset transferred out of ProxyGeneral | `to`, `asset`, `amount`, `module` |
| **CacheUpdated** | ValueCalculator | Token value cache refreshed | `tokenCode`, `value`, `pricePerToken` |
| **EmergencyContactAdded** | EmergencyHandler | New emergency contact authorized | `contact` |
| **EmergencyContactNotified** | EmergencyHandler | Emergency contact notified of pause | `contact` |
| **EmergencyContactRemoved** | EmergencyHandler | Emergency contact deauthorized | `contact` |
| **EmergencyPauseTriggered** | EmergencyHandler | System emergency pause activated | `triggeredBy`, `reason`, `timestamp` |
| **EmergencyResolved** | EmergencyHandler | Emergency fully resolved | `triggeredBy`, `reason`, `triggeredAt`, `resolvedAt` |
| **EmergencyTransferExecuted** | EmergencyHandler | Emergency asset recovery executed | `recipient`, `totalValue`, `by`, `timestamp` |
| **EmergencyUnpaused** | EmergencyHandler | System resumed after emergency | `by`, `timestamp`, `pauseDuration` |
| **ErrorThresholdReached** | TokenManager | Token oracle errors exceeded limit | `tokenCode` |
| **HeartbeatUpdated** | TokenManager | Price feed heartbeat threshold changed | `tokenCode`, `newHeartbeat` |
| **HourlyWithdrawnIncremented** | ProxyGeneral | User's hourly withdrawal limit updated | `user`, `currentHour`, `amount` |
| **ImplementationUpdated** | Beacon | Module implementation address updated | `moduleName`, `oldImplementation`, `newImplementation` |
| **LPTokenBurned** | ProxyGeneral | LP tokens burned during withdrawal | `from`, `amount`, `newTotalSupply` |
| **LPTokenMinted** | ProxyGeneral | LP tokens minted during deposit | `to`, `amount`, `newTotalSupply` |
| **MaxSlippageUpdated** | SwapManager | Maximum swap slippage tolerance changed | `oldSlippage`, `newSlippage` |
| **ModuleAuthorized** | ProxyGeneral | Module granted access to restricted functions | `module` |
| **ModuleDeauthorized** | ProxyGeneral | Module access revoked | `module` |
| **OwnershipTransferred** | Beacon | Ownership transfer completed | `previousOwner`, `newOwner` |
| **OwnershipTransferStarted** | Beacon | Two-step ownership transfer initiated | `previousOwner`, `newOwner` |
| **ParameterChanged** | ParameterManager | Parameter value updated | `parameterName`, `oldValue`, `newValue`, `changedBy` |
| **ParameterChangeProposed** | ParameterManager | Parameter change proposed (timelock) | `parameterName`, `oldValue`, `newValue`, `effectiveAt` |
| **ParameterEmergencyChanged** | ParameterManager | Parameter changed via emergency override | `parameterName`, `oldValue`, `newValue`, `changedBy` |
| **ParameterRegistered** | ParameterManager | New parameter registered | `parameterName`, `initialValue`, `minValue`, `maxValue`, `requiresTimelock` |
| **ParameterTimelockUpdated** | ParameterManager | Parameter timelock duration changed | `oldTimelock`, `newTimelock` |
| **Paused** | ProxyGeneral | System operations paused | `account` |
| **PoolValueUpdated** | ValueCalculator | Total pool value recalculated | `totalValue` |
| **PriceStale** | TokenManager | Oracle price is stale but used | `tokenCode`, `lastUpdateTime` |
| **SimpleSwapRouterUpdated** | SwapManager | DEX router address updated | `oldRouter`, `newRouter` |
| **SpenderApproved** | ProxyGeneral | Token approval granted to external spender | `token`, `spender`, `amount`, `module` |
| **SwapExecuted** | SwapManager | Token-to-WETH swap completed | `tokenCode`, `amountIn`, `amountOut`, `minAmountOut`, `caller` |
| **SwapsEnabledChanged** | SwapManager | Swap functionality enabled/disabled | `enabled` |
| **TokenAdded** | TokenManager | New token added to registry | `tokenCode`, `tokenAddress`, `priceFeed` |
| **TokenError** | TokenManager | Oracle error encountered | `tokenCode`, `errorMessage` |
| **TokenErrorsReset** | TokenManager | Token error counter manually reset | `tokenCode` |
| **TokenRemoved** | TokenManager | Token deactivated from registry | `tokenCode` |
| **Unpaused** | ProxyGeneral | System operations resumed | `account` |

### Events by Module

#### 🔗 **Beacon Events**
- **ImplementationUpdated**: Module address changed
- **OwnershipTransferStarted**: Ownership transfer initiated  
- **OwnershipTransferred**: Ownership transfer completed

#### 🏛️ **ProxyGeneral Events**
- **AssetTransferred**: Assets moved out of custody
- **HourlyWithdrawnIncremented**: Rate limiting tracker updated
- **LPTokenBurned**: LP tokens destroyed
- **LPTokenMinted**: LP tokens created
- **ModuleAuthorized**: Module access granted
- **ModuleDeauthorized**: Module access revoked
- **Paused**: Operations halted
- **SpenderApproved**: External approval granted
- **Unpaused**: Operations resumed

#### 🏦 **TokenManager Events**
- **ErrorThresholdReached**: Oracle reliability threshold exceeded
- **HeartbeatUpdated**: Staleness threshold changed
- **PriceStale**: Using stale but valid price
- **TokenAdded**: New token registered
- **TokenError**: Oracle fetch failed
- **TokenErrorsReset**: Error counter cleared
- **TokenRemoved**: Token deactivated

#### 📊 **ValueCalculator Events**
- **CacheUpdated**: Price/value cache refreshed
- **PoolValueUpdated**: Total pool valuation completed

#### 💰 **LiquidityManager Events**
*Note: LiquidityManager primarily triggers events in other modules (ProxyGeneral, ValueCalculator) rather than emitting its own events.*

#### 🔄 **SwapManager Events**
- **MaxSlippageUpdated**: Slippage tolerance changed
- **SimpleSwapRouterUpdated**: DEX integration updated
- **SwapExecuted**: Token swap completed
- **SwapsEnabledChanged**: Swap functionality toggled

#### 🚨 **EmergencyHandler Events**
- **AssetTransferred**: Emergency asset recovery (inherits from ProxyGeneral event)
- **EmergencyContactAdded**: Contact authorized for emergency pause
- **EmergencyContactNotified**: Contact alerted of emergency
- **EmergencyContactRemoved**: Contact deauthorized
- **EmergencyPauseTriggered**: Emergency activated
- **EmergencyResolved**: Emergency fully resolved
- **EmergencyTransferExecuted**: Asset recovery completed
- **EmergencyUnpaused**: System resumed

#### ⚙️ **ParameterManager Events**
- **ParameterChanged**: Configuration value updated
- **ParameterChangeProposed**: Timelock proposal created
- **ParameterEmergencyChanged**: Emergency configuration override
- **ParameterRegistered**: New configurable parameter added
- **ParameterTimelockUpdated**: Governance timelock changed

### Event Monitoring Recommendations

#### **Critical Events (Immediate Alert)**
- `EmergencyPauseTriggered` - System halted
- `EmergencyTransferExecuted` - Assets moved out
- `ErrorThresholdReached` - Oracle failure
- `ModuleAuthorized`/`ModuleDeauthorized` - Access changes
- `ImplementationUpdated` - System upgrade

#### **Important Events (Daily Monitoring)**
- `TokenError` - Oracle issues
- `PriceStale` - Data freshness issues  
- `SwapExecuted` - Trading activity
- `ParameterChanged` - Configuration updates
- `TokenAdded`/`TokenRemoved` - Registry changes

#### **Operational Events (Metrics/Analytics)**
- `LPTokenMinted`/`LPTokenBurned` - User activity
- `PoolValueUpdated` - Valuation changes
- `CacheUpdated` - Cache performance
- `HourlyWithdrawnIncremented` - Rate limiting metrics
- `SwapsEnabledChanged` - Feature toggles

### Event Filtering Examples

#### **User Activity Dashboard**
```solidity
// Filter for user-specific LP token events
filter = {
    topics: [
        [
            keccak256("LPTokenMinted(address,uint256,uint256)"),
            keccak256("LPTokenBurned(address,uint256,uint256)")
        ],
        [userAddress]  // Filter by user address
    ]
}
```

#### **System Health Monitoring**
```solidity
// Monitor critical system events
filter = {
    topics: [
        [
            keccak256("EmergencyPauseTriggered(address,string,uint256)"),
            keccak256("TokenError(string,string)"),
            keccak256("ErrorThresholdReached(string)")
        ]
    ]
}
```

#### **Oracle Status Tracking**
```solidity
// Track oracle-related events for specific token
filter = {
    address: tokenManagerAddress,
    topics: [
        [
            keccak256("TokenError(string,string)"),
            keccak256("PriceStale(string,uint256)"),
            keccak256("ErrorThresholdReached(string)")
        ],
        [keccak256(tokenCode)]  // Filter by token
    ]
}
```

---

## ❌ Error Codes {#error-codes}

_Section pending: All error messages with descriptions and resolution steps_

---

## � Error Codes {#error-codes}

### Complete Error Reference

| Error Message | Module | Cause | Resolution |
|---------------|---------|-------|------------|
| **"Already current owner"** | Beacon | Trying to transfer ownership to current owner | Use different address |
| **"Already paused"** | ProxyGeneral | Attempting to pause already paused system | Check `isPaused()` first |
| **"Caller not authorized"** | Multiple | Unauthorized module calling restricted function | Ensure module is authorized via `authorizeModule()` |
| **"Cannot add WETH as token"** | TokenManager | Attempting to register WETH as regular token | WETH handled separately - use different token |
| **"Cannot burn from zero address"** | ProxyGeneral | Attempting to burn LP tokens from address(0) | Use valid user address |
| **"Cannot burn zero amount"** | ProxyGeneral | Attempting to burn 0 LP tokens | Use amount > 0 |
| **"Cannot mint to zero address"** | ProxyGeneral | Attempting to mint LP tokens to address(0) | Use valid recipient address |
| **"Cannot mint zero amount"** | ProxyGeneral | Attempting to mint 0 LP tokens | Use amount > 0 |
| **"Contact already added"** | EmergencyHandler | Trying to add existing emergency contact | Check if contact already authorized |
| **"Contact not found"** | EmergencyHandler | Trying to remove non-existent emergency contact | Verify contact exists first |
| **"Contract is paused"** | Multiple | Operation blocked due to system pause | Wait for unpause or check emergency status |
| **"Daily limit exceeded"** | LiquidityManager | Withdrawal exceeds user's daily limit | Reduce amount or wait for next day |
| **"Emergency already active"** | EmergencyHandler | Trying to trigger emergency when one exists | Check emergency status first |
| **"Emergency cooldown active"** | EmergencyHandler | Emergency triggered too soon after previous | Wait for cooldown period (24 hours) |
| **"Implementation must be a contract"** | Beacon | Trying to set EOA as module implementation | Use contract address only |
| **"Implementation not found"** | Beacon | Querying unregistered module | Register module first via `updateImplementation()` |
| **"Insufficient asset balance"** | ProxyGeneral | Transferring more assets than available | Check balance via `getAssetBalance()` |
| **"Insufficient LP token balance"** | ProxyGeneral | Burning more LP tokens than user owns | Check balance via `balanceOf()` |
| **"Invalid amount"** | Multiple | Using amount = 0 or invalid value | Use positive amount within valid range |
| **"Invalid contact"** | EmergencyHandler | Using address(0) for emergency contact | Use valid address |
| **"Invalid heartbeat"** | TokenManager | Setting heartbeat to 0 | Use positive value (recommended: 1-24 hours) |
| **"Invalid implementation address"** | Beacon | Using address(0) for module implementation | Use valid contract address |
| **"Invalid module address"** | ProxyGeneral | Using address(0) for module authorization | Use valid module contract address |
| **"Invalid module name"** | Beacon | Empty or too long module name | Use 1-32 byte string |
| **"Invalid new owner"** | Beacon | Using address(0) for ownership transfer | Use valid address |
| **"Invalid parameter name"** | ParameterManager | Empty parameter name | Use non-empty string identifier |
| **"Invalid price"** | TokenManager | Chainlink returned price ≤ 0 | Check oracle feed status |
| **"Invalid range"** | ParameterManager | minValue > maxValue | Ensure minValue ≤ maxValue |
| **"Invalid recipient"** | Multiple | Using address(0) for transfers | Use valid recipient address |
| **"Invalid router address"** | SwapManager | Setting SimpleSwap router to address(0) | Use valid DEX router address |
| **"Invalid spender"** | ProxyGeneral | Using address(0) for token approval | Use valid spender address |
| **"Invalid token"** | ProxyGeneral | Using address(0) for token operations | Use valid ERC20 token address |
| **"Invalid token address"** | TokenManager | Using address(0) or non-contract for token | Use valid ERC20 contract |
| **"Invalid token code"** | TokenManager | Empty or >16 byte token code | Use 1-16 byte identifier (e.g., "ARB") |
| **"Minimum deposit not met"** | LiquidityManager | Deposit amount below minimum | Increase deposit amount |
| **"Module already authorized"** | ProxyGeneral | Trying to authorize already authorized module | Check authorization status first |
| **"Module not authorized"** | ProxyGeneral | Trying to deauthorize non-authorized module | Verify module is currently authorized |
| **"No emergency active"** | EmergencyHandler | Trying to unpause when no emergency exists | Only call after emergency triggered |
| **"No pending proposal"** | ParameterManager | Executing parameter change without proposal | Propose change first |
| **"Not authorized for emergency"** | EmergencyHandler | Non-authorized address triggering emergency | Must be owner or emergency contact |
| **"Not paused"** | ProxyGeneral | Trying to unpause when not paused | Check pause state first |
| **"Not pending owner"** | Beacon | Non-pending owner accepting ownership | Only pending owner can accept |
| **"Only owner"** | Multiple | Non-owner calling owner-only function | Use owner account |
| **"Parameter already registered"** | ParameterManager | Trying to register existing parameter | Use different parameter name |
| **"Parameter doesn't require timelock"** | ParameterManager | Executing non-timelock parameter change | Use `proposeParameterChange()` for immediate changes |
| **"Parameter not registered"** | ParameterManager | Accessing non-existent parameter | Register parameter first |
| **"Price feed validation failed"** | TokenManager | Chainlink feed test failed | Verify feed address and network compatibility |
| **"Price too old"** | ValueCalculator | Oracle price exceeds maximum age | Wait for fresh price or increase age limit |
| **"Reason required"** | EmergencyHandler | Empty reason for emergency pause | Provide explanation string |
| **"Reentrant call"** | Multiple | Reentrancy attack detected | External call should not call back |
| **"Round not complete"** | TokenManager | Chainlink round not finished (timestamp = 0) | Wait for oracle update |
| **"Same as current value"** | ParameterManager | Proposing unchanged parameter value | Use different value |
| **"Same implementation already set"** | Beacon | Setting same module implementation | Use different implementation address |
| **"SimpleSwap router not set"** | SwapManager | Attempting swap without configured router | Set router via `setSimpleSwapRouter()` |
| **"Slippage exceeds maximum"** | SwapManager | Setting slippage > 5% (500 basis points) | Use slippage ≤ 500 |
| **"Slippage too high"** | SwapManager | User's minAmountOut too low vs expected | Increase minAmountOut or accept higher slippage |
| **"Stale price"** | TokenManager | Chainlink answeredInRound < roundId | Wait for fresh oracle round |
| **"Swap output below minimum"** | SwapManager | Actual swap output < minAmountOut | Increase slippage tolerance |
| **"Swaps are disabled"** | SwapManager | Attempting swap when disabled | Enable swaps via `setSwapsEnabled(true)` |
| **"System is paused"** | Multiple | Operation blocked by pause state | Wait for unpause |
| **"System must be paused"** | EmergencyHandler | Emergency operation requires pause | Trigger pause first |
| **"System must be paused for emergency override"** | ParameterManager | Emergency parameter change needs pause | Pause system first |
| **"Timelock exceeds maximum"** | Multiple | Setting timelock > 7 days | Use timelock ≤ 7 days |
| **"Timelock not expired"** | Multiple | Executing before timelock period | Wait for full timelock duration |
| **"Token not active"** | Multiple | Using inactive/removed token | Verify token is active via `isTokenActive()` |
| **"Too many tokens"** | TokenManager | Exceeding maximum token limit | Remove unused tokens or increase limit |
| **"Value calculation failed"** | ValueCalculator | Token valuation error | Check token/oracle status |
| **"Withdrawals disabled"** | LiquidityManager | Attempting withdrawal when disabled | Enable withdrawals |

### Error Categories

#### **🔐 Access Control Errors**
- `"Only owner"` - Function restricted to contract owner
- `"Caller not authorized"` - Module not in authorized list
- `"Not authorized for emergency"` - Emergency function access denied

#### **⏸️ Pause State Errors**
- `"Contract is paused"` - Normal operations blocked
- `"System is paused"` - Synonym for contract paused
- `"Already paused"` - Attempting redundant pause
- `"Not paused"` - Unpause when not paused

#### **🏦 Oracle & Price Errors**
- `"Invalid price"` - Chainlink returned bad data
- `"Price too old"` - Stale price exceeds age limit
- `"Stale price"` - Oracle round inconsistency
- `"Round not complete"` - Chainlink round pending

#### **💰 Amount & Balance Errors**
- `"Invalid amount"` - Zero or negative amounts
- `"Insufficient LP token balance"` - Not enough LP tokens
- `"Insufficient asset balance"` - Not enough tokens to transfer

#### **🚨 Emergency Errors**
- `"Emergency already active"` - Multiple emergency triggers
- `"No emergency active"` - Emergency function without emergency
- `"Emergency cooldown active"` - Too frequent emergency triggers

#### **⏱️ Timelock Errors**
- `"Timelock not expired"` - Premature execution
- `"No pending proposal"` - No proposal to execute
- `"Parameter doesn't require timelock"` - Immediate vs timelock confusion

#### **🔄 Swap Errors**
- `"Swaps are disabled"` - Swap functionality disabled
- `"SimpleSwap router not set"` - No DEX router configured
- `"Slippage too high"` - Price protection triggered
- `"Swap output below minimum"` - Slippage exceeded

#### **📊 Validation Errors**
- `"Invalid token code"` - Bad token identifier format
- `"Cannot add WETH as token"` - WETH exclusion rule
- `"Too many tokens"` - Registry capacity exceeded

### Troubleshooting Guide

#### **Common Error Scenarios**

**🔄 "Caller not authorized" when calling mint/burn/transfer:**
1. Check if calling contract is authorized: `proxyGeneral.isAuthorizedModule(address)`
2. If not, authorize via: `proxyGeneral.authorizeModule(address, moduleType)` (owner only, v2.0+)
   - Example: `proxyGeneral.authorizeModule(0x123..., "LiquidityManager")`
3. Verify beacon resolves ProxyGeneral correctly

**⏸️ "Contract is paused" during normal operations:**
1. Check pause state: `proxyGeneral.isPaused()`
2. Check emergency status: `emergencyHandler.getSystemHealthStatus()`
3. If emergency active, wait for resolution + timelock
4. If incorrectly paused, owner can unpause (if no emergency)

**🏦 Oracle errors ("Invalid price", "Stale price"):**
1. Check Chainlink feed status on network explorer
2. Verify feed address is correct for network (Arbitrum)
3. Check if heartbeat setting is appropriate
4. Consider increasing `maxPriceAge` if network congestion

**💰 "Insufficient balance" errors:**
1. Verify actual balance: `proxyGeneral.getAssetBalance(token)`
2. Check if tokens are held by different address
3. For LP tokens: `proxyGeneral.balanceOf(user)`
4. Ensure tokens were properly deposited

**🔄 Swap failures:**
1. Verify swaps enabled: `swapManager.swapsEnabled()`
2. Check router configured: `swapManager.simpleSwapRouter()`  
3. Verify token is active: `tokenManager.isTokenActive(tokenCode)`
4. Check slippage settings vs market volatility

**⏱️ Timelock issues:**
1. Check remaining time: `parameterManager.canExecuteParameterChange(param)`
2. Verify proposal exists and timelock expired
3. For emergency unpause: check `emergencyHandler.canUnpause()`

### Error Prevention

#### **Development Best Practices**
1. **Always validate inputs** before state changes
2. **Check authorizations** before calling restricted functions  
3. **Use view functions** to verify state before transactions
4. **Implement proper error handling** with try-catch blocks
5. **Test edge cases** thoroughly on testnet

#### **Pre-Transaction Checks**
```solidity
// Before deposit
require(liquidityManager.depositsEnabled(), "Deposits disabled");
require(!proxyGeneral.isPaused(), "System paused");
require(msg.value >= minDeposit, "Below minimum");

// Before withdrawal  
require(lpBalance >= amount, "Insufficient LP balance");
require(liquidityManager.withdrawalsEnabled(), "Withdrawals disabled");
liquidityManager.checkWithdrawLimits(user, ethAmount); // Will revert if exceeded

// Before swap
require(swapManager.swapsEnabled(), "Swaps disabled");
require(tokenManager.isTokenActive(tokenCode), "Token inactive");
(uint256 quote,) = swapManager.getSwapQuote(tokenCode, amountIn);
uint256 minOut = (quote * 9800) / 10000; // 2% slippage
```

---

## 🔧 Enhancement Functions {#enhancement-functions}

**Purpose:** Additional utility, monitoring, and safety functions not in original specifications  
**Added in:** Sprint 3 - Enhancement Phase  
**Status:** Fully functional (27 functions) + Enhanced (5 functions) + ~~Placeholder (0 functions)~~ ✅ ALL COMPLETE

**Last Updated:** October 23, 2025 - Sprint 3.2 Completed

This section documents the 32 enhancement functions added during development for:
- 🛡️ **Security:** Emergency freeze mechanisms, validation helpers
- 📊 **Monitoring:** System health checks, statistics queries
- ⚡ **Optimization:** Batch operations, gas-efficient utilities
- 🎯 **Usability:** Dashboard queries, aggregated data retrieval

### 📋 Quick Reference Table

| Module | Working | Enhanced | Placeholder | Total |
|--------|---------|----------|-------------|-------|
| Beacon | 11 | 0 | 0 | 11 |
| ProxyGeneral | 3 | 0 | 0 | 3 |
| LiquidityManager | 4 | 1 | 0 | 5 |
| SwapManager | 1 | 1 | 0 | 2 |
| EmergencyHandler | 6 | **2 ✅** | ~~2~~ **0** | 8 |
| ParameterManager | 2 | 1 | 0 | 3 |
| **TOTAL** | **27** | **5** | **0** | **32** |

**Sprint 3.2 Achievement:** All placeholder functions now fully implemented! 🎉

---

### 🔷 Beacon Module (11 functions)

#### Emergency & Freeze Functions

| Function | Type | Purpose | Status |
|----------|------|---------|--------|
| `freezeAllModules()` | External | Freeze entire system instantly | ✅ Working |
| `unfreezeAllModules()` | External | Unfreeze all modules after emergency | ✅ Working |
| `freezeModule(string)` | External | Freeze specific module by name | ✅ Working |
| `unfreezeModule(string)` | External | Unfreeze specific module | ✅ Working |
| `isFrozen(string)` | View | Check if module is frozen | ✅ Working |

**Usage Example:**
```solidity
// Emergency: Freeze entire system
beacon.freezeAllModules();

// Or freeze specific module
beacon.freezeModule("LiquidityManager");

// Check status
bool frozen = beacon.isFrozen("LiquidityManager"); // true

// Unfreeze after issue resolved
beacon.unfreezeModule("LiquidityManager");
```

#### Query & Utility Functions

| Function | Type | Purpose | Status |
|----------|------|---------|--------|
| `getAllModuleNames()` | View | Get list of all registered modules | ✅ Working |
| `getModuleCount()` | View | Total number of modules | ✅ Working |
| `isModuleRegistered(string)` | View | Check if module exists | ✅ Working |
| `getProxyAddress()` | View | Get main proxy address | ✅ Working |
| `authorizeModule(address, string)` | External | Register module with type validation | ✅ Working |
| `deauthorizeModule(string)` | External | Remove module authorization | ✅ Working |

**Usage Example:**
```solidity
// Dashboard: Get all modules
string[] memory modules = beacon.getAllModuleNames();
// Returns: ["LiquidityManager", "SwapManager", "TokenManager", ...]

// Validate module exists before calling
if (beacon.isModuleRegistered("SwapManager")) {
    ISwapManager swapManager = ISwapManager(beacon.getImplementation("SwapManager"));
}

// Get proxy for cross-module calls
address proxy = beacon.getProxyAddress();
```

---

### 🔷 ProxyGeneral Module (3 functions)

| Function | Type | Purpose | Status |
|----------|------|---------|--------|
| `transferToModule(string, uint256)` | External | Send ETH to specific module | ✅ Working |
| `trackOperation(string, uint256)` | Internal | Record operation for monitoring | ✅ Working |
| `batchGetModuleBalances(string[])` | View | Get ETH balances of multiple modules | ✅ Working |

**Usage Example:**
```solidity
// Transfer ETH to SwapManager for gas
proxy.transferToModule("SwapManager", 1 ether);

// Monitor multiple modules at once (dashboard)
string[] memory modules = new string[](3);
modules[0] = "LiquidityManager";
modules[1] = "SwapManager";
modules[2] = "TokenManager";
uint256[] memory balances = proxy.batchGetModuleBalances(modules);
// Returns: [5.2 ETH, 0.8 ETH, 0 ETH]
```

---

### 🔷 LiquidityManager Module (5 functions)

| Function | Type | Purpose | Status |
|----------|------|---------|--------|
| `getPoolInfo()` | View | Get comprehensive pool statistics | ✅ Enhanced (Sprint 2) |
| `validateDepositLimits(uint256)` | View | Check deposit amount validity | ✅ Working |
| `validateWithdrawLimits(address, uint256)` | View | Check withdrawal limits compliance | ✅ Working |
| `setMinDeposit(uint256)` | External | Update minimum deposit amount | ✅ Working |
| `setMaxDeposit(uint256)` | External | Update maximum deposit amount | ✅ Working |

**Enhancement Details (Issue #7 - Sprint 2):**
- **Before:** `getPoolInfo()` returned hardcoded `tokensCount = 5`
- **After:** Dynamic calculation via `tokenManager.getActiveTokens().length`
- **Fix Complexity:** One-line change
- **Time:** ~2 minutes

**Usage Example:**
```solidity
// Dashboard: Get complete pool overview
ILiquidityManager.PoolInfo memory info = liquidityManager.getPoolInfo();
console.log("Total ETH:", info.totalETH);
console.log("Tokens:", info.tokensCount); // Now dynamic!

// Validate before attempting deposit
bool valid = liquidityManager.validateDepositLimits(10 ether);
require(valid, "Exceeds limits");

// Admin: Update limits
liquidityManager.setMinDeposit(0.1 ether);
liquidityManager.setMaxDeposit(1000 ether);
```

---

### 🔷 SwapManager Module (2 functions)

| Function | Type | Purpose | Status |
|----------|------|---------|--------|
| `estimateSwapGas()` | View | Predict gas cost for swap operation | ✅ Enhanced (Sprint 2) |
| `getLastSwapInfo()` | View | Retrieve last swap statistics | ✅ Working |

**Enhancement Details (Issue #8 - Sprint 2):**
- **Before:** Placeholder returning static `300000` gas
- **After:** Router integration with try/catch fallback
- **Features:**
  - Calls `simpleSwapRouter.getExpectedOutput()` for accuracy
  - Adds 50k gas safety buffer
  - Graceful fallback to base estimate if router unavailable
  - External helper function for try/catch pattern
- **Code Review:** 9.5/10 - "Innovative use of external function"

**Usage Example:**
```solidity
// Predict gas before swap
uint256 gasEstimate = swapManager.estimateSwapGas(
    "USDC",
    address(this),
    1000e6, // 1000 USDC
    950e6   // Min 950 USDC out (5% slippage)
);
console.log("Estimated gas:", gasEstimate); // e.g., 350000

// Check last swap results
(address user, string memory token, uint256 amount, uint256 timestamp) = 
    swapManager.getLastSwapInfo();
```

---

### 🔷 EmergencyHandler Module (9 functions)

#### Health & Monitoring (7 working)

| Function | Type | Purpose | Status |
|----------|------|---------|--------|
| `checkSystemHealth()` | View | Comprehensive health check | ✅ Working |
| `getEmergencyStatus()` | View | Get current emergency state | ✅ Working |
| `getAllEmergencyContacts()` | View | List emergency contacts with real timestamps | ✅ **Enhanced (Sprint 3.3)** |
| `isEmergencyContact(address)` | View | Check if address is emergency contact | ✅ Working |
| `getContactInfo(address)` | View | Get contact role, timestamp, status | ✅ **New (Sprint 3.3)** |
| `captureAssetSnapshot()` | External | Store current system state | ✅ Working |
| `getEmergencyMetrics()` | View | Get operational metrics | ✅ Working |

#### Snapshot Functions (✅ Sprint 3.2 COMPLETED)

| Function | Type | Purpose | Status |
|----------|------|---------|--------|
| `createAssetSnapshot()` | External | Store complete system state snapshot | ✅ **Enhanced** |
| `getAssetSnapshot(uint256)` | View | Retrieve specific snapshot by ID | ✅ **Enhanced** |
| `getAllSnapshots()` | View | Get all stored snapshots | ✅ **Enhanced** |
| `getSnapshotCount()` | View | Get total number of snapshots | ✅ **New** |

**Working Functions Usage:**
```solidity
// Monitor system health
IEmergencyHandler.HealthStatus memory health = emergencyHandler.checkSystemHealth();
if (!health.isHealthy) {
    console.log("Alert:", health.issues[0]);
}

// Check emergency state
bool inEmergency = emergencyHandler.getEmergencyStatus();

// Sprint 3.3: Add contact with role and timestamp tracking
emergencyHandler.addEmergencyContact(
    0x1234567890123456789012345678901234567890,
    "Security Officer"
);

// Sprint 3.3: Get specific contact info
(string memory role, uint256 addedAt, bool isActive) = 
    emergencyHandler.getContactInfo(contactAddress);
console.log("Role:", role);
console.log("Added:", addedAt); // Real timestamp from storage!

// Sprint 3.3: Get all contacts with real timestamps
IEmergencyHandler.EmergencyContact[] memory contacts = 
    emergencyHandler.getEmergencyContacts();
for (uint i = 0; i < contacts.length; i++) {
    console.log("Contact:", contacts[i].contactAddress);
    console.log("Role:", contacts[i].role); // Real role!
    console.log("Added At:", contacts[i].addedAt); // Real timestamp!
}

// Capture state before risky operation
emergencyHandler.captureAssetSnapshot();

// Get metrics
(uint256 uptime, uint256 operations, uint256 lastCheck) = 
    emergencyHandler.getEmergencyMetrics();
```

**✅ Enhanced Functions (Sprint 3.2 - Issue #10 - COMPLETED):**
```solidity
// ✅ NOW WORKING: Full snapshot storage implementation
uint256 snapshotId = emergencyHandler.createAssetSnapshot();
console.log("Snapshot created:", snapshotId);

// ✅ Retrieve specific snapshot by ID
IEmergencyHandler.AssetSnapshot memory snapshot = 
    emergencyHandler.getAssetSnapshot(snapshotId);
console.log("Total Value:", snapshot.totalValue);
console.log("WETH Balance:", snapshot.wethBalance);
console.log("Token Count:", snapshot.tokenBalances.length);

// ✅ Get all snapshots
IEmergencyHandler.AssetSnapshot[] memory all = 
    emergencyHandler.getAllSnapshots();
console.log("Total snapshots:", all.length);

// ✅ Get snapshot count
uint256 count = emergencyHandler.getSnapshotCount();
```

**Sprint 3.2 Implementation (COMPLETED Oct 23, 2025):**
- ✅ Added `mapping(uint256 => AssetSnapshot) private snapshots;`
- ✅ Implemented `uint256 private snapshotCount;` auto-increment counter
- ✅ Added `uint256[] private snapshotIds;` for iteration
- ✅ Modified `createAssetSnapshot()` to persist complete token data
- ✅ Implemented real retrieval in `getAssetSnapshot()` with validation
- ✅ Implemented `getAllSnapshots()` with full iteration
- ✅ Added `getSnapshotCount()` helper function
- ✅ Updated `IEmergencyHandler.sol` with `TokenBalance` struct
- ✅ Test script created: `scripts/snapshotTest.ts`
- **Actual effort:** ~45 minutes (vs 4h estimated, 81% faster)

**✅ Enhanced Functions (Sprint 3.3 - Issue #11 - COMPLETED):**
```solidity
// ✅ NOW WORKING: Real timestamp and role tracking for emergency contacts

// Add contact with role (timestamp stored automatically)
emergencyHandler.addEmergencyContact(
    0x1234567890123456789012345678901234567890,
    "Security Officer" // Role stored in contactRole mapping
);

// Get specific contact info with real data
(string memory role, uint256 addedAt, bool isActive) = 
    emergencyHandler.getContactInfo(contactAddress);
// Returns: ("Security Officer", 1698067200, true)
// addedAt is the REAL block.timestamp from when contact was added!

// Get all contacts with real timestamps and roles
IEmergencyHandler.EmergencyContact[] memory contacts = 
    emergencyHandler.getEmergencyContacts();

for (uint i = 0; i < contacts.length; i++) {
    console.log("Address:", contacts[i].contactAddress);
    console.log("Role:", contacts[i].role); // From contactRole[address]
    console.log("Added:", contacts[i].addedAt); // From contactAddedAt[address]
    console.log("Active:", contacts[i].isActive);
}
```

**Sprint 3.3 Implementation (COMPLETED Oct 23, 2025):**
- ✅ Added `mapping(address => uint256) public contactAddedAt;` for timestamp tracking
- ✅ Added `mapping(address => string) public contactRole;` for role storage
- ✅ Updated `addEmergencyContact()` to store `block.timestamp` and role
- ✅ Updated `removeEmergencyContact()` to clean up timestamp and role
- ✅ Enhanced `getEmergencyContacts()` to return real data from storage
- ✅ Added `getContactInfo(address)` helper function for individual contact queries
- ✅ Added role validation: `require(bytes(role).length > 0, "Role cannot be empty");`
- ✅ Test script created: `scripts/contactTimestampTest.ts`
- **Actual effort:** ~30 minutes (vs 2h estimated, 75% faster)

**Key Improvements:**
- **Before:** `addedAt` returned `block.timestamp` (always current time, not useful)
- **After:** `addedAt` returns actual timestamp from when contact was added
- **Before:** Role hardcoded as `"Emergency Contact"`
- **After:** Role customizable and stored per contact (e.g., "Security Officer", "Technical Lead")

---

### 🔷 ParameterManager Module (3 functions)

| Function | Type | Purpose | Status |
|----------|------|---------|--------|
| `getProposal(uint256)` | View | Get proposal by ID | ✅ Enhanced (Sprint 2) |
| `getActiveProposals()` | View | List all pending proposals | ✅ Working |
| `cancelProposal(uint256)` | External | Cancel proposal before execution | ✅ Working |

**Enhancement Details (Issue #9 - Sprint 2):**
- **Before:** Placeholder returning empty struct
- **After:** Real storage with auto-increment IDs
- **Implementation:**
  - Added `mapping(uint256 => Parameter) private proposalById;`
  - Added `uint256 private nextProposalId = 1;` counter
  - Modified `proposeParameterChange()` to store: `proposalById[nextProposalId++] = param;`
  - Implemented direct lookup: `return proposalById[proposalId];`
- **Code Review:** 9.5/10 - "Clean, efficient implementation"

**Usage Example:**
```solidity
// Create proposal
uint256 id = parameterManager.proposeParameterChange(
    IParameterManager.ParameterType.MinDeposit,
    1 ether,
    "Increase minimum"
);

// Later: Retrieve by ID (now works!)
IParameterManager.Parameter memory proposal = parameterManager.getProposal(id);
console.log("Value:", proposal.newValue);
console.log("Expires:", proposal.expiryTime);

// List all active proposals
IParameterManager.Parameter[] memory active = parameterManager.getActiveProposals();

// Cancel if needed
parameterManager.cancelProposal(id);
```

---

### 📊 Summary Statistics

**Enhancement Functions Coverage:**
- ✅ **32 Fully Working** - ALL functions production-ready! 🎉
- ✅ **5 Enhanced Total:**
  - Sprint 2: Issues #7, #8, #9 (getPoolInfo, estimateSwapGas, getProposal)
  - Sprint 3.2: Issue #10 (snapshot storage: createAssetSnapshot, getAssetSnapshot, getAllSnapshots)
  - Sprint 3.3: Issue #11 (contact timestamps: addEmergencyContact, getEmergencyContacts, getContactInfo)
- ✅ **0 Placeholders Remaining** - All completed!

**Categories:**
- 🛡️ **Security:** 6 freeze/emergency functions
- 📊 **Monitoring:** 11 health/status check functions (added getContactInfo)
- ⚡ **Optimization:** 3 batch/gas-efficient utilities
- 🎯 **Usability:** 12 query/dashboard functions

**Sprint Achievements:**

**Sprint 2 (Oct 23, 2025):**
- Fixed `getPoolInfo()` dynamic token count (2 minutes)
- Enhanced `estimateSwapGas()` with router (45 minutes, 9.5/10 review)
- Implemented `getProposal()` storage (45 minutes, 9.5/10 review)

**Sprint 3.2 (Oct 23, 2025):**
- ✅ Implemented snapshot storage (45 minutes vs 4h estimated, 81% faster)
- ✅ Complete `getAssetSnapshot()` and `getAllSnapshots()` with full persistence
- ✅ Added `getSnapshotCount()` helper and `TokenBalance` struct

**Sprint 3.3 (Oct 23, 2025):**
- ✅ Implemented contact timestamp tracking (30 minutes vs 2h estimated, 75% faster)
- ✅ Real timestamps and roles stored in `contactAddedAt` and `contactRole` mappings
- ✅ Enhanced `addEmergencyContact()`, `removeEmergencyContact()`, `getEmergencyContacts()`
- ✅ Added `getContactInfo()` helper function
- ✅ Test script: `scripts/contactTimestampTest.ts`

---

## �📚 Glossary {#glossary}

### Core Concepts

#### **📊 DeFi & Protocol Terms**

**APR (Annual Percentage Rate)**  
Annualized return rate on investments, calculated as simple interest without compounding effects.

**APY (Annual Percentage Yield)**  
Annualized return rate including compounding effects. APY = (1 + rate/periods)^periods - 1.

**Arbitrum**  
Layer 2 Ethereum scaling solution using optimistic rollups. Provides faster transactions and lower gas costs while maintaining Ethereum compatibility.

**Basis Points (bps)**  
Unit of measurement equal to 0.01%. Used for fees and slippage: 100 bps = 1%, 10 bps = 0.1%.

**DEX (Decentralized Exchange)**  
Peer-to-peer cryptocurrency exchange protocol without central authority. Examples: Uniswap, SushiSwap, Camelot.

**Impermanent Loss**  
Temporary decrease in value when providing liquidity to AMM pools due to price divergence between paired assets.

**LP Tokens (Liquidity Provider Tokens)**  
ERC20 tokens representing user's share of liquidity pool. Users receive LP tokens when depositing and burn them when withdrawing.

**Liquidity Pool**  
Smart contract holding reserves of tokens that enable automated trading. Users deposit assets to earn fees from trades.

**MEV (Maximal Extractable Value)**  
Profit extraction opportunities through transaction ordering, frontrunning, or sandwich attacks in DeFi protocols.

**Slippage**  
Price difference between expected and actual execution price due to market movements during transaction processing.

**TVL (Total Value Locked)**  
Total value of assets deposited in DeFi protocol, measuring protocol size and user trust.

**Yield Farming**  
Strategy of providing liquidity or staking tokens to earn rewards, often involving multiple protocols for optimized returns.

#### **🔧 Technical Terms**

**ABI (Application Binary Interface)**  
JSON specification defining how to interact with smart contract functions and events from external applications.

**Beacon Proxy Pattern**  
Upgradeable proxy pattern where multiple proxies delegate to implementations resolved through a central beacon contract.

**Call Forwarding**  
Mechanism where proxy contracts redirect function calls to implementation contracts while preserving msg.sender context.

**Delegatecall**  
Ethereum opcode that executes code in another contract while maintaining the calling contract's storage context.

**EIP-1967 (Proxy Storage Slots)**  
Ethereum standard defining specific storage slots for proxy contracts to avoid collisions with implementation storage.

**Gas Optimization**  
Techniques to reduce transaction costs: storage packing, view functions, efficient algorithms, batching operations.

**Heartbeat**  
Time interval for oracle price updates. Chainlink feeds update when price changes exceed threshold or heartbeat expires.

**Multicall**  
Pattern allowing multiple function calls in a single transaction to reduce gas costs and ensure atomic execution.

**Nonreentrant**  
Security modifier preventing contracts from calling back into functions before initial execution completes.

**Oracle**  
External service providing off-chain data to smart contracts. Chainlink provides decentralized price feeds for tokens.

**Proxy Contract**  
Contract that forwards calls to implementation contract, enabling upgrades while preserving state and address.

**Reentrancy**  
Attack where external calls back into contract before function completes, potentially exploiting state inconsistencies.

#### **🏦 Financial & Risk Terms**

**Circuit Breaker**  
Safety mechanism that halts operations when abnormal conditions detected, preventing further damage during issues.

**Collateral Factor**  
Maximum percentage of collateral value that can be borrowed. 80% factor means $80 can be borrowed against $100 collateral.

**Emergency Pause**  
System halt mechanism activated during critical issues to prevent user fund loss while problems are resolved.

**Health Factor**  
Metric indicating position safety in lending protocols. < 1.0 indicates liquidation risk in borrowing positions.

**Liquidation**  
Forced closure of positions when collateral value falls below required ratios to protect lenders from default.

**Price Impact**  
Price change caused by trade execution, especially significant for large trades in low-liquidity markets.

**Risk Parameters**  
Configuration values controlling protocol risk: collateral ratios, liquidation thresholds, borrowing limits.

**Timelock**  
Delay mechanism requiring waiting period before critical parameter changes take effect, providing transparency.

#### **💰 Token & Asset Terms**

**Borrow Rate**  
Interest rate charged for borrowing assets, typically variable based on utilization ratios in lending pools.

**Bridge Tokens**  
Wrapped versions of tokens moved across different blockchain networks maintaining 1:1 value peg with originals.

**ERC20**  
Ethereum token standard defining interface for fungible tokens with transfer, approval, and balance functions.

**Lending Rate**  
Interest rate earned by supplying assets to lending pools, usually percentage of borrowing rates.

**Native Token**  
Blockchain's primary cryptocurrency used for gas fees. ETH for Ethereum, AVAX for Avalanche, MATIC for Polygon.

**Stablecoin**  
Cryptocurrency designed to maintain stable value relative to reference asset, usually USD pegged (USDC, USDT, DAI).

**Supply Rate**  
Annual percentage rate earned by lenders in lending protocols, calculated from borrowing activity.

**Token Whitelisting**  
Process of approving specific tokens for use in protocol, ensuring compatibility and reducing security risks.

**WETH (Wrapped ETH)**  
ERC20 version of ETH enabling interaction with contracts requiring ERC20 interface while maintaining 1:1 ETH value.

**Wrapped Tokens**  
Tokenized versions of native assets from other chains, maintaining value peg through custodial or algorithmic mechanisms.

#### **🔐 Security Terms**

**Access Control**  
System defining who can execute specific functions using roles (owner, admin, user) and permission modifiers.

**Admin Keys**  
Private keys controlling administrative functions. Centralized risk if compromised, requiring secure management practices.

**Audit**  
Security review of smart contract code by experts to identify vulnerabilities before mainnet deployment.

**Flash Loan**  
Uncollateralized loan borrowed and repaid within single transaction, often used in arbitrage and liquidations.

**Governance**  
Decentralized decision-making process where token holders vote on protocol changes and parameter updates.

**Multi-signature (Multisig)**  
Wallet requiring multiple private key signatures to execute transactions, reducing single point of failure risk.

**Pausable**  
Contract feature allowing authorized addresses to halt operations during emergencies while preserving user funds.

**Permission System**  
Framework controlling function access through roles: onlyOwner, authorized modules, emergency contacts.

**Smart Contract Risk**  
Potential losses from code bugs, logic errors, or security vulnerabilities in automated contract execution.

**Timelock Controller**  
Contract enforcing delays between proposal and execution of sensitive changes, providing transparency.

#### **⚙️ System Components**

**Beacon Contract**  
Central registry mapping module names to implementation addresses, enabling coordinated upgrades across system.

**Emergency Handler**  
Module managing system pause/unpause functionality and emergency procedures with appropriate access controls.

**Liquidity Manager**  
Component handling user deposits/withdrawals with rate limiting and safety checks for fund security.

**Parameter Manager**  
Module controlling system configuration with timelock delays for sensitive changes and emergency overrides.

**Proxy General**  
Main contract users interact with, holding assets and delegating operations to specialized modules.

**Swap Manager**  
Module handling token exchanges through DEX integrations with slippage protection and rate validation.

**Token Manager**  
Component managing supported tokens registry with Chainlink price feed integration and validation.

**Value Calculator**  
Module computing asset values using current market prices with staleness checks and error handling.

### Protocol-Specific Terms

#### **📋 Configuration Parameters**

**Daily Limits**  
Maximum withdrawal amounts per user per day, preventing large sudden outflows while allowing normal usage.

**Deposit Minimums**  
Smallest accepted deposit amounts to ensure economic viability and prevent dust accumulation.

**Max Price Age**  
Maximum acceptable age for oracle prices before considering them stale and rejecting transactions.

**Rate Limits**  
Restrictions on operation frequency preventing spam attacks and ensuring fair access to system resources.

**Slippage Tolerance**  
Maximum acceptable price change during swap execution, protecting users from MEV attacks and volatility.

**Withdrawal Limits**  
Caps on withdrawal amounts within time periods, balancing liquidity management with user accessibility.

#### **📈 Performance Metrics**

**Gas Efficiency**  
Measurement of transaction cost optimization, important for user experience and protocol competitiveness.

**Price Accuracy**  
Oracle price deviation from market rates, affecting swap execution quality and value calculations.

**System Uptime**  
Percentage of time protocol operates normally without emergency pauses or critical issues.

**Transaction Throughput**  
Number of operations protocol can handle per block, limited by gas costs and computational complexity.

**User Experience Score**  
Composite metric measuring transaction success rates, gas costs, and interface responsiveness.

### Common Abbreviations

- **AMM**: Automated Market Maker
- **CEFI**: Centralized Finance  
- **DAO**: Decentralized Autonomous Organization
- **DEFI**: Decentralized Finance
- **DEX**: Decentralized Exchange
- **EOA**: Externally Owned Account
- **LP**: Liquidity Provider
- **MEV**: Maximal Extractable Value
- **TVL**: Total Value Locked
- **UX**: User Experience
- **WETH**: Wrapped Ethereum

### Mathematical Formulas

#### **LP Token Calculations**
```
LP Tokens Minted = (ETH Deposited × Current LP Supply) ÷ Total ETH Value
ETH per LP Token = Total ETH Value ÷ Total LP Supply
Withdrawal Amount = LP Tokens Burned × ETH per LP Token
```

#### **Slippage Calculations**
```
Price Impact = |Execution Price - Expected Price| ÷ Expected Price × 100%
Min Amount Out = Expected Amount × (1 - Slippage Tolerance)
Effective Price = Amount In ÷ Amount Out
```

#### **Yield Calculations**
```
APR = (Rewards ÷ Principal) × (365 ÷ Days) × 100%
APY = ((1 + Daily Rate)^365 - 1) × 100%
Total Return = Principal × (1 + APY)^Years
```

---

**End of API Reference - Version 1.0.0**
