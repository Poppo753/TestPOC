// ==================== FUNCTION DETAILS STRUCTURE ====================
// Complete documentation details for all functions in the DeFi system
// Format: "ModuleName.functionName": { signature, params, returns, access, description, docs }

const functionDetails = {
  // ==================== BEACON FUNCTIONS ====================
  "Beacon.updateImplementation": {
    signature: "updateImplementation(string module, address newImplementation)",
    params: "module: Name of the module to update, newImplementation: New implementation contract address",
    returns: "void",
    access: "onlyOwner",
    description: "Updates the implementation address for a specific module with comprehensive security validations and history tracking.",
    docs: "docs/API_Reference.md#beacon-updateimplementation"
  },
  
  "Beacon.getImplementation": {
    signature: "getImplementation(string module) → address",
    params: "module: Name of the module to resolve",
    returns: "address: Implementation contract address",
    access: "public view",
    description: "Resolves module names to their implementation addresses. Core function for dynamic address resolution with freeze protection.",
    docs: "docs/API_Reference.md#beacon-getimplementation"
  },
  
  "Beacon.checkModuleExists": {
    signature: "checkModuleExists(string module) → bool",
    params: "module: Name of the module to check",
    returns: "bool: True if module is registered",
    access: "public view",
    description: "Verifies if a module exists in the registry without revealing implementation details.",
    docs: "docs/API_Reference.md#beacon-checkmoduleexists"
  },
  
  "Beacon.getRegisteredModules": {
    signature: "getRegisteredModules() → string[]",
    params: "none",
    returns: "string[]: Array of all registered module names",
    access: "public view",
    description: "Returns complete list of registered modules for system auditing and monitoring.",
    docs: "docs/API_Reference.md#beacon-getregisteredmodules"
  },
  
  "Beacon.getImplementationHistory": {
    signature: "getImplementationHistory(string module) → address[]",
    params: "module: Name of the module",
    returns: "address[]: Array of previous implementation addresses",
    access: "public view",
    description: "Provides audit trail of all previous implementations for a module.",
    docs: "docs/API_Reference.md#beacon-getimplementationhistory"
  },
  
  "Beacon.getModuleInfo": {
    signature: "getModuleInfo(string module) → (address, uint256, uint256, bool)",
    params: "module: Name of the module",
    returns: "currentImpl: Current implementation, lastUpdated: Last update timestamp, historyCount: Number of previous versions, isFrozen: Freeze status",
    access: "public view",
    description: "Returns comprehensive information about a module including implementation, update history, and status.",
    docs: "docs/API_Reference.md#beacon-getmoduleinfo"
  },
  
  "Beacon.freezeModule": {
    signature: "freezeModule(string module)",
    params: "module: Name of the module to freeze",
    returns: "void",
    access: "onlyOwner",
    description: "Emergency function to freeze a specific module, preventing access to its implementation.",
    docs: "docs/API_Reference.md#beacon-freezemodule"
  },
  
  "Beacon.unfreezeModule": {
    signature: "unfreezeModule(string module)",
    params: "module: Name of the module to unfreeze",
    returns: "void",
    access: "onlyOwner",
    description: "Removes freeze from a module, restoring normal access to its implementation.",
    docs: "docs/API_Reference.md#beacon-unfreezemodule"
  },
  
  "Beacon.activateGlobalFreeze": {
    signature: "activateGlobalFreeze()",
    params: "none",
    returns: "void",
    access: "onlyOwner",
    description: "Emergency function to freeze the entire system, blocking all module access.",
    docs: "docs/API_Reference.md#beacon-activateglobalfreeze"
  },
  
  "Beacon.deactivateGlobalFreeze": {
    signature: "deactivateGlobalFreeze()",
    params: "none",
    returns: "void",
    access: "onlyOwner",
    description: "Removes global freeze, restoring normal system operations.",
    docs: "docs/API_Reference.md#beacon-deactivateglobalfreeze"
  },
  
  "Beacon.transferOwnership": {
    signature: "transferOwnership(address newOwner)",
    params: "newOwner: Address of the proposed new owner",
    returns: "void",
    access: "onlyOwner",
    description: "Initiates 2-step ownership transfer process. New owner must accept to complete transfer.",
    docs: "docs/API_Reference.md#beacon-transferownership"
  },
  
  "Beacon.acceptOwnership": {
    signature: "acceptOwnership()",
    params: "none",
    returns: "void",
    access: "pendingOwner only",
    description: "Completes ownership transfer. Must be called by the pending owner.",
    docs: "docs/API_Reference.md#beacon-acceptownership"
  },
  
  "Beacon.cancelOwnershipTransfer": {
    signature: "cancelOwnershipTransfer()",
    params: "none",
    returns: "void",
    access: "onlyOwner",
    description: "Cancels pending ownership transfer, clearing the pending owner.",
    docs: "docs/API_Reference.md#beacon-cancelownershiptransfer"
  },
  
  "Beacon.batchUpdateImplementations": {
    signature: "batchUpdateImplementations(string[] modules, address[] newImplementations)",
    params: "modules: Array of module names, newImplementations: Array of new implementation addresses",
    returns: "void",
    access: "onlyOwner",
    description: "Updates multiple module implementations in a single transaction with validation.",
    docs: "docs/API_Reference.md#beacon-batchupdateimplementations"
  },
  
  "Beacon.getBeaconStatus": {
    signature: "getBeaconStatus() → (uint256, uint256, bool, address, address)",
    params: "none",
    returns: "totalModules: Number of registered modules, frozenModules: Number of frozen modules, isGlobalFrozen: Global freeze status, currentOwner: Current owner, pendingOwner: Pending owner if any",
    access: "public view",
    description: "Returns comprehensive status overview of the Beacon system.",
    docs: "docs/API_Reference.md#beacon-getbeaconstatus"
  },
  
  "Beacon.checkSystemHealth": {
    signature: "checkSystemHealth() → (bool, string[])",
    params: "none",
    returns: "isHealthy: Overall system health status, issues: Array of identified issues",
    access: "public view",
    description: "Performs comprehensive health check of the entire module system.",
    docs: "docs/API_Reference.md#beacon-checksystemhealth"
  },

  // ==================== PROXYGENERAL FUNCTIONS ====================
  "ProxyGeneral.mint": {
    signature: "mint(address to, uint256 amount)",
    params: "to: Recipient address, amount: LP tokens to mint (18 decimals)",
    returns: "void",
    access: "onlyAuthorizedModule",
    description: "Mints LP tokens to a user address. Only callable by authorized modules during deposits.",
    docs: "docs/API_Reference.md#proxygeneral-mint"
  },
  
  "ProxyGeneral.burn": {
    signature: "burn(address from, uint256 amount)",
    params: "from: Address to burn tokens from, amount: LP tokens to burn (18 decimals)",
    returns: "void",
    access: "onlyAuthorizedModule",
    description: "Burns LP tokens from a user address. Only callable by authorized modules during withdrawals.",
    docs: "docs/API_Reference.md#proxygeneral-burn"
  },
  
  "ProxyGeneral.balanceOf": {
    signature: "balanceOf(address account) → uint256",
    params: "account: Address to query LP token balance for",
    returns: "uint256: LP token balance (18 decimals)",
    access: "public view",
    description: "Returns the LP token balance for a specific address. Standard ERC20 function.",
    docs: "docs/API_Reference.md#proxygeneral-balanceof"
  },
  
  "ProxyGeneral.totalSupply": {
    signature: "totalSupply() → uint256",
    params: "none",
    returns: "uint256: Total LP token supply (18 decimals)",
    access: "public view",
    description: "Returns the total supply of LP tokens in circulation. Standard ERC20 function.",
    docs: "docs/API_Reference.md#proxygeneral-totalsupply"
  },
  
  "ProxyGeneral.transferFunds": {
    signature: "transferFunds(address to, address asset, uint256 amount)",
    params: "to: Recipient address, asset: ERC20 token address (or address(0) for ETH), amount: Amount to transfer",
    returns: "void",
    access: "onlyAuthorizedModule",
    description: "Transfers ERC20 tokens or ETH from ProxyGeneral to a specified address. Critical asset management function.",
    docs: "docs/API_Reference.md#proxygeneral-transferfunds"
  },
  
  "ProxyGeneral.getAssetBalance": {
    signature: "getAssetBalance(address asset) → uint256",
    params: "asset: ERC20 token address (or address(0) for ETH)",
    returns: "uint256: Token balance held by ProxyGeneral",
    access: "public view",
    description: "Queries the balance of a specific ERC20 token or ETH held by ProxyGeneral.",
    docs: "docs/API_Reference.md#proxygeneral-getassetbalance"
  },
  
  "ProxyGeneral.approveSpender": {
    signature: "approveSpender(address token, address spender, uint256 amount)",
    params: "token: ERC20 token address, spender: Address to approve (e.g., DEX router), amount: Approval amount",
    returns: "void",
    access: "onlyAuthorizedModule",
    description: "Approves an external spender to spend ProxyGeneral's tokens. Required for swap operations.",
    docs: "docs/API_Reference.md#proxygeneral-approvespender"
  },
  
  "ProxyGeneral.transferToModule": {
    signature: "transferToModule(address token, address module, uint256 amount)",
    params: "token: ERC20 token address, module: Authorized module address, amount: Amount to transfer",
    returns: "void",
    access: "onlyAuthorizedModule",
    description: "Transfers tokens temporarily to an authorized module for operations.",
    docs: "docs/API_Reference.md#proxygeneral-transfertomodule"
  },
  
  "ProxyGeneral.transferFromModule": {
    signature: "transferFromModule(address token, address module, uint256 amount)",
    params: "token: ERC20 token address, module: Authorized module address, amount: Amount to receive",
    returns: "void",
    access: "onlyAuthorizedModule",
    description: "Receives tokens back from an authorized module after operations.",
    docs: "docs/API_Reference.md#proxygeneral-transferfrommodule"
  },
  
  "ProxyGeneral.authorizeModule": {
    signature: "authorizeModule(address module, string moduleType)",
    params: "module: Module address to authorize, moduleType: Type identifier (e.g., 'LiquidityManager')",
    returns: "void",
    access: "onlyOwner",
    description: "Adds a module to the authorized list with enhanced event tracking for better monitoring.",
    docs: "docs/API_Reference.md#proxygeneral-authorizemodule"
  },
  
  "ProxyGeneral.deauthorizeModule": {
    signature: "deauthorizeModule(address module)",
    params: "module: Module address to deauthorize",
    returns: "void",
    access: "onlyOwner",
    description: "Removes authorization from a module, immediately revoking all its privileges.",
    docs: "docs/API_Reference.md#proxygeneral-deauthorizemodule"
  },
  
  "ProxyGeneral.isAuthorizedModule": {
    signature: "isAuthorizedModule(address module) → bool",
    params: "module: Address to check authorization for",
    returns: "bool: True if authorized, false otherwise",
    access: "public view",
    description: "Checks if an address is currently authorized to call restricted functions.",
    docs: "docs/API_Reference.md#proxygeneral-isauthorizedmodule"
  },
  
  "ProxyGeneral.pause": {
    signature: "pause()",
    params: "none",
    returns: "void",
    access: "onlyAuthorizedModule",
    description: "Pauses all state-changing operations except unpause and emergency functions.",
    docs: "docs/API_Reference.md#proxygeneral-pause"
  },
  
  "ProxyGeneral.unpause": {
    signature: "unpause()",
    params: "none",
    returns: "void",
    access: "onlyOwner",
    description: "Resumes normal operations after emergency pause has been resolved.",
    docs: "docs/API_Reference.md#proxygeneral-unpause"
  },
  
  "ProxyGeneral.isPaused": {
    signature: "isPaused() → bool",
    params: "none",
    returns: "bool: True if paused, false if operating normally",
    access: "public view",
    description: "Returns the current pause state of the system.",
    docs: "docs/API_Reference.md#proxygeneral-ispaused"
  },
  
  "ProxyGeneral.emergencyTransferAll": {
    signature: "emergencyTransferAll(address recipient)",
    params: "recipient: Safe address to receive all assets",
    returns: "void",
    access: "onlyOwner whenPaused",
    description: "Transfers all assets (WETH + supported tokens) to a safe address during emergency situations.",
    docs: "docs/API_Reference.md#proxygeneral-emergencytransferall"
  },
  
  "ProxyGeneral.setHourlyWithdrawn": {
    signature: "setHourlyWithdrawn(address user, uint256 hour, uint256 amount)",
    params: "user: User address, hour: Hour timestamp, amount: Amount withdrawn",
    returns: "void",
    access: "onlyAuthorizedModule",
    description: "Sets the amount withdrawn in a specific hour for rate limiting purposes.",
    docs: "docs/API_Reference.md#proxygeneral-sethourlywithdraw"
  },
  
  "ProxyGeneral.getHourlyWithdrawn": {
    signature: "getHourlyWithdrawn(address user, uint256 hour) → uint256",
    params: "user: User address, hour: Hour timestamp",
    returns: "uint256: Amount withdrawn in that hour",
    access: "public view",
    description: "Gets the amount withdrawn by a user in a specific hour for rate limiting checks.",
    docs: "docs/API_Reference.md#proxygeneral-gethourlywithdraw"
  },
  
  "ProxyGeneral.incrementHourlyWithdrawn": {
    signature: "incrementHourlyWithdrawn(address user, uint256 amount)",
    params: "user: User address, amount: Amount to add to current hour",
    returns: "void",
    access: "onlyAuthorizedModule",
    description: "Increments the amount withdrawn in the current hour for rate limiting tracking.",
    docs: "docs/API_Reference.md#proxygeneral-incrementhourlywithdraw"
  },
  
  "ProxyGeneral.setModuleParameter": {
    signature: "setModuleParameter(string parameterName, uint256 value)",
    params: "parameterName: Name of the parameter, value: Parameter value",
    returns: "void",
    access: "onlyOwner",
    description: "Sets a shared parameter value accessible across all modules.",
    docs: "docs/API_Reference.md#proxygeneral-setmoduleparameter"
  },
  
  "ProxyGeneral.getModuleParameter": {
    signature: "getModuleParameter(string parameterName) → uint256",
    params: "parameterName: Name of the parameter",
    returns: "uint256: Parameter value",
    access: "public view",
    description: "Gets a shared parameter value used across modules.",
    docs: "docs/API_Reference.md#proxygeneral-getmoduleparameter"
  },

  // ==================== TOKENMANAGER FUNCTIONS ====================
  "TokenManager.manageTokenData": {
    signature: "manageTokenData(string code, address tokenAddress, address oracle, uint256 heartbeat, uint8 decimals, bool isActive)",
    params: "code: Token identifier, tokenAddress: Token contract address, oracle: Chainlink oracle address, heartbeat: Price update frequency, decimals: Token decimals, isActive: Activation status",
    returns: "void",
    access: "onlyOwner",
    description: "Adds or updates comprehensive token information including oracle configuration with WETH exclusion validation.",
    docs: "docs/API_Reference.md#tokenmanager-managetokendata"
  },
  
  "TokenManager.removeToken": {
    signature: "removeToken(string code)",
    params: "code: Token identifier to remove",
    returns: "void",
    access: "onlyOwner",
    description: "Removes a token from the system, deactivating all related operations.",
    docs: "docs/API_Reference.md#tokenmanager-removetoken"
  },
  
  "TokenManager.isTokenActive": {
    signature: "isTokenActive(string code) → bool",
    params: "code: Token identifier",
    returns: "bool: True if token is active and supported",
    access: "public view",
    description: "Checks if a token is currently active and available for operations.",
    docs: "docs/API_Reference.md#tokenmanager-istokenactive"
  },
  
  "TokenManager.getTokenAddress": {
    signature: "getTokenAddress(string code) → address",
    params: "code: Token identifier",
    returns: "address: Token contract address",
    access: "public view",
    description: "Returns the contract address for a given token identifier.",
    docs: "docs/API_Reference.md#tokenmanager-gettokenaddress"
  },
  
  "TokenManager.getTokenInfo": {
    signature: "getTokenInfo(string code) → TokenInfo",
    params: "code: Token identifier",
    returns: "TokenInfo: Complete token information struct",
    access: "public view",
    description: "Returns comprehensive information about a token including address, decimals, oracle, and status.",
    docs: "docs/API_Reference.md#tokenmanager-gettokeninfo"
  },
  
  "TokenManager.getActiveTokens": {
    signature: "getActiveTokens() → string[]",
    params: "none",
    returns: "string[]: Array of active token identifiers",
    access: "public view",
    description: "Returns list of all currently active token identifiers in the system.",
    docs: "docs/API_Reference.md#tokenmanager-getactivetokens"
  },
  
  "TokenManager.getTokenCount": {
    signature: "getTokenCount() → uint256",
    params: "none",
    returns: "uint256: Total number of registered tokens",
    access: "public view",
    description: "Returns the total count of tokens registered in the system, including inactive ones.",
    docs: "docs/API_Reference.md#tokenmanager-gettokencount"
  },
  
  "TokenManager.getTokenPrice": {
    signature: "getTokenPrice(string code) → (uint256, uint256, bool)",
    params: "code: Token identifier",
    returns: "price: USD price (18 decimals), updatedAt: Last update timestamp, isStale: Staleness flag",
    access: "public view",
    description: "Fetches current token price from Chainlink oracle with staleness validation.",
    docs: "docs/API_Reference.md#tokenmanager-gettokenprice"
  },
  
  "TokenManager.getTokenPriceWithEvents": {
    signature: "getTokenPriceWithEvents(string code) → (uint256, uint256, bool)",
    params: "code: Token identifier",
    returns: "price: USD price (18 decimals), updatedAt: Last update timestamp, isStale: Staleness flag",
    access: "public",
    description: "Fetches token price with event emission for monitoring and tracking purposes.",
    docs: "docs/API_Reference.md#tokenmanager-gettokenpricewithevents"
  },
  
  "TokenManager.addOrUpdateOracle": {
    signature: "addOrUpdateOracle(string code, address oracle)",
    params: "code: Token identifier, oracle: Chainlink oracle address",
    returns: "void",
    access: "onlyOwner",
    description: "Adds or updates the Chainlink oracle for a specific token with validation.",
    docs: "docs/API_Reference.md#tokenmanager-addorupdateoracle"
  },
  
  "TokenManager.removeOracle": {
    signature: "removeOracle(string code)",
    params: "code: Token identifier",
    returns: "void",
    access: "onlyOwner",
    description: "Removes the oracle association for a token, disabling price feeds.",
    docs: "docs/API_Reference.md#tokenmanager-removeoracle"
  },
  
  "TokenManager.updateHeartbeat": {
    signature: "updateHeartbeat(string code, uint256 newHeartbeat)",
    params: "code: Token identifier, newHeartbeat: New heartbeat period in seconds",
    returns: "void",
    access: "onlyOwner",
    description: "Updates the heartbeat period for staleness detection of a token's price feed.",
    docs: "docs/API_Reference.md#tokenmanager-updateheartbeat"
  },
  
  "TokenManager.batchUpdateTokens": {
    signature: "batchUpdateTokens(TokenUpdateData[] updates)",
    params: "updates: Array of token update data structs",
    returns: "void",
    access: "onlyOwner",
    description: "Updates multiple tokens in a single transaction for gas efficiency.",
    docs: "docs/API_Reference.md#tokenmanager-batchupdatetokens"
  },
  
  "TokenManager.getSystemTokensInfo": {
    signature: "getSystemTokensInfo() → TokenSummary[]",
    params: "none",
    returns: "TokenSummary[]: Array of token summaries with current prices",
    access: "public view",
    description: "Returns comprehensive information about all active tokens including current prices.",
    docs: "docs/API_Reference.md#tokenmanager-getsystemtokensinfo"
  },

  // ==================== VALUECALCULATOR FUNCTIONS ====================
  "ValueCalculator.calculateTokenValue": {
    signature: "calculateTokenValue(string code) → TokenValueInfo",
    params: "code: Token identifier",
    returns: "TokenValueInfo: Token value information with caching",
    access: "public",
    description: "Calculates and caches the total value of a specific token held by the system.",
    docs: "docs/API_Reference.md#valuecalculator-calculatetokenvalue"
  },
  
  "ValueCalculator.calculateTokenValueView": {
    signature: "calculateTokenValueView(string code) → TokenValueInfo",
    params: "code: Token identifier",
    returns: "TokenValueInfo: Token value information (read-only)",
    access: "public view",
    description: "Calculates token value without caching for read-only operations.",
    docs: "docs/API_Reference.md#valuecalculator-calculatetokenvalueview"
  },
  
  "ValueCalculator.getTotalPoolValue": {
    signature: "getTotalPoolValue() → PoolValueInfo",
    params: "none",
    returns: "PoolValueInfo: Complete pool valuation with caching",
    access: "public",
    description: "Calculates total pool value by summing WETH and all token values with price caching.",
    docs: "docs/API_Reference.md#valuecalculator-gettotalpoolvalue"
  },
  
  "ValueCalculator.getTotalPoolValueView": {
    signature: "getTotalPoolValueView() → PoolValueInfo",
    params: "none",
    returns: "PoolValueInfo: Complete pool valuation (read-only)",
    access: "public view",
    description: "Calculates total pool value without caching for view operations.",
    docs: "docs/API_Reference.md#valuecalculator-gettotalpoolvalueview"
  },
  
  "ValueCalculator.selectTokenForSwap": {
    signature: "selectTokenForSwap(uint256 targetValue) → string",
    params: "targetValue: Target value in ETH to achieve",
    returns: "string: Selected token identifier for optimal swap",
    access: "public view",
    description: "Intelligently selects the best token to swap based on value target and pool composition.",
    docs: "docs/API_Reference.md#valuecalculator-selecttokenforswap"
  },
  
  "ValueCalculator.getCachedTokenValue": {
    signature: "getCachedTokenValue(string code) → TokenValueInfo",
    params: "code: Token identifier",
    returns: "TokenValueInfo: Cached token value information",
    access: "public view",
    description: "Returns cached token value without recalculation for performance optimization.",
    docs: "docs/API_Reference.md#valuecalculator-getcachedtokenvalue"
  },
  
  "ValueCalculator.invalidateCache": {
    signature: "invalidateCache(string code)",
    params: "code: Token identifier to invalidate",
    returns: "void",
    access: "onlyAuthorizedModule",
    description: "Invalidates cached value for a specific token, forcing recalculation on next access.",
    docs: "docs/API_Reference.md#valuecalculator-invalidatecache"
  },
  
  "ValueCalculator.refreshCache": {
    signature: "refreshCache(string code)",
    params: "code: Token identifier to refresh",
    returns: "void",
    access: "public",
    description: "Manually refreshes cached token value with current data.",
    docs: "docs/API_Reference.md#valuecalculator-refreshcache"
  },
  
  "ValueCalculator.getPoolComposition": {
    signature: "getPoolComposition() → PoolComposition",
    params: "none",
    returns: "PoolComposition: Detailed breakdown of pool assets",
    access: "public view",
    description: "Returns detailed composition of the pool showing percentage allocation of each asset.",
    docs: "docs/API_Reference.md#valuecalculator-getpoolcomposition"
  },

  // ==================== LIQUIDITYMANAGER FUNCTIONS ====================
  "LiquidityManager.deposit": {
    signature: "deposit() payable → uint256",
    params: "msg.value: ETH amount to deposit",
    returns: "uint256: LP tokens minted to user",
    access: "public payable",
    description: "Main entry point for user deposits. Converts ETH to WETH, calculates shares, and mints LP tokens with rate limiting.",
    docs: "docs/API_Reference.md#liquiditymanager-deposit"
  },
  
  "LiquidityManager.calculateDepositShares": {
    signature: "calculateDepositShares(uint256 ethAmount) → uint256",
    params: "ethAmount: ETH amount to deposit",
    returns: "uint256: LP tokens that would be minted",
    access: "public view",
    description: "Calculates how many LP tokens would be minted for a given ETH deposit amount.",
    docs: "docs/API_Reference.md#liquiditymanager-calculatedepositshares"
  },
  
  "LiquidityManager.withdraw": {
    signature: "withdraw(uint256 lpTokens) → uint256",
    params: "lpTokens: Amount of LP tokens to burn",
    returns: "uint256: ETH amount returned to user",
    access: "public",
    description: "Main withdrawal function. Burns LP tokens, swaps assets to WETH as needed, converts to ETH and transfers to user.",
    docs: "docs/API_Reference.md#liquiditymanager-withdraw"
  },
  
  "LiquidityManager.calculateWithdrawAmount": {
    signature: "calculateWithdrawAmount(uint256 lpTokens) → uint256",
    params: "lpTokens: Amount of LP tokens to burn",
    returns: "uint256: ETH amount that would be returned",
    access: "public view",
    description: "Calculates how much ETH would be returned for burning a given amount of LP tokens.",
    docs: "docs/API_Reference.md#liquiditymanager-calculatewithdrawamount"
  },
  
  "LiquidityManager.setWithdrawLimits": {
    signature: "setWithdrawLimits(uint256 hourlyLimit, uint256 dailyLimit)",
    params: "hourlyLimit: Maximum ETH per hour, dailyLimit: Maximum ETH per day",
    returns: "void",
    access: "onlyOwner",
    description: "Sets withdrawal rate limits to prevent excessive draining of the pool.",
    docs: "docs/API_Reference.md#liquiditymanager-setwithdrawlimits"
  },
  
  "LiquidityManager.checkWithdrawLimits": {
    signature: "checkWithdrawLimits(address user, uint256 amount) → bool",
    params: "user: User address, amount: Withdrawal amount to check",
    returns: "bool: True if withdrawal is within limits",
    access: "public view",
    description: "Checks if a withdrawal amount is within the user's rate limits.",
    docs: "docs/API_Reference.md#liquiditymanager-checkwithdrawlimits"
  },
  
  "LiquidityManager.emergencyWithdraw": {
    signature: "emergencyWithdraw(address recipient)",
    params: "recipient: Address to receive emergency funds",
    returns: "void",
    access: "onlyOwner",
    description: "Emergency function to transfer all pool assets when system is paused.",
    docs: "docs/API_Reference.md#liquiditymanager-emergencywithdraw"
  },

  // ==================== SWAPMANAGER FUNCTIONS ====================
  "SwapManager.swapTokenForWETH": {
    signature: "swapTokenForWETH(string code, uint256 amountIn, uint256 minOut) → uint256",
    params: "code: Token identifier, amountIn: Amount to swap, minOut: Minimum WETH to receive",
    returns: "uint256: WETH amount received",
    access: "public",
    description: "Swaps any supported token to WETH via SimpleSwap DEX with slippage protection.",
    docs: "docs/API_Reference.md#swapmanager-swaptokenforweth"
  },
  
  "SwapManager.getSwapQuote": {
    signature: "getSwapQuote(string code, uint256 amount) → uint256",
    params: "code: Token identifier, amount: Amount to swap",
    returns: "uint256: Expected WETH output amount",
    access: "public view",
    description: "Gets expected output amount for a token→WETH swap without executing.",
    docs: "docs/API_Reference.md#swapmanager-getswapquote"
  },
  
  "SwapManager.calculateMinAmountOut": {
    signature: "calculateMinAmountOut(string code, uint256 amountIn) → uint256",
    params: "code: Token identifier, amountIn: Input amount",
    returns: "uint256: Minimum output after slippage tolerance",
    access: "public view",
    description: "Calculates minimum output amount considering configured slippage tolerance.",
    docs: "docs/API_Reference.md#swapmanager-calculateminamountout"
  },
  
  "SwapManager.setSimpleSwapRouter": {
    signature: "setSimpleSwapRouter(address router)",
    params: "router: SimpleSwap router contract address",
    returns: "void",
    access: "onlyOwner",
    description: "Updates the SimpleSwap router address used for all swap operations.",
    docs: "docs/API_Reference.md#swapmanager-setsimpleswaprouter"
  },
  
  "SwapManager.setSlippageTolerance": {
    signature: "setSlippageTolerance(uint256 tolerance)",
    params: "tolerance: Slippage tolerance in basis points (e.g., 50 = 0.5%)",
    returns: "void",
    access: "onlyOwner",
    description: "Sets the maximum allowed slippage for swap operations.",
    docs: "docs/API_Reference.md#swapmanager-setslippagetolerance"
  },
  
  "SwapManager.batchSwap": {
    signature: "batchSwap(SwapParams[] swaps) → uint256[]",
    params: "swaps: Array of swap parameter structs",
    returns: "uint256[]: Array of WETH amounts received",
    access: "public",
    description: "Executes multiple token swaps in a single transaction for gas efficiency.",
    docs: "docs/API_Reference.md#swapmanager-batchswap"
  },
  
  "SwapManager.getSwapHistory": {
    signature: "getSwapHistory(uint256 limit) → SwapRecord[]",
    params: "limit: Maximum number of records to return",
    returns: "SwapRecord[]: Array of historical swap records",
    access: "public view",
    description: "Returns historical swap data for analysis and monitoring.",
    docs: "docs/API_Reference.md#swapmanager-getswaphistory"
  },

  // ==================== EMERGENCYHANDLER FUNCTIONS ====================
  "EmergencyHandler.triggerEmergencyPause": {
    signature: "triggerEmergencyPause(string reason)",
    params: "reason: Human-readable reason for emergency pause",
    returns: "void",
    access: "onlyEmergencyContact",
    description: "Immediately pauses all system operations. Only callable by authorized emergency contacts.",
    docs: "docs/API_Reference.md#emergencyhandler-triggeremergencypause"
  },
  
  "EmergencyHandler.unpause": {
    signature: "unpause()",
    params: "none",
    returns: "void",
    access: "onlyEmergencyContact",
    description: "Resumes system operations after emergency has been resolved and timelock expired.",
    docs: "docs/API_Reference.md#emergencyhandler-unpause"
  },
  
  "EmergencyHandler.emergencyWithdraw": {
    signature: "emergencyWithdraw(address recipient)",
    params: "recipient: Safe address to receive all assets",
    returns: "void",
    access: "onlyEmergencyContact",
    description: "Transfers all system assets to a safe address during critical emergencies.",
    docs: "docs/API_Reference.md#emergencyhandler-emergencywithdraw"
  },
  
  "EmergencyHandler.addEmergencyContact": {
    signature: "addEmergencyContact(address contact, string role)",
    params: "contact: Address to authorize, role: Role description",
    returns: "void",
    access: "onlyOwner",
    description: "Adds a new address to the emergency contacts list with specified role.",
    docs: "docs/API_Reference.md#emergencyhandler-addemergencycontact"
  },
  
  "EmergencyHandler.removeEmergencyContact": {
    signature: "removeEmergencyContact(address contact)",
    params: "contact: Address to remove from emergency contacts",
    returns: "void",
    access: "onlyOwner",
    description: "Removes an address from the emergency contacts list.",
    docs: "docs/API_Reference.md#emergencyhandler-removeemergencycontact"
  },
  
  "EmergencyHandler.getSystemHealthStatus": {
    signature: "getSystemHealthStatus() → SystemHealth",
    params: "none",
    returns: "SystemHealth: Comprehensive system health report",
    access: "public view",
    description: "Performs comprehensive system health check including pause status, balances, and token states.",
    docs: "docs/API_Reference.md#emergencyhandler-getsystemhealthstatus"
  },
  
  "EmergencyHandler.setEmergencyTimelock": {
    signature: "setEmergencyTimelock(uint256 timelockPeriod)",
    params: "timelockPeriod: Timelock duration in seconds",
    returns: "void",
    access: "onlyOwner",
    description: "Sets the required timelock period before emergency unpause can be executed.",
    docs: "docs/API_Reference.md#emergencyhandler-setemergencytimelock"
  },
  
  "EmergencyHandler.executeTimelockedAction": {
    signature: "executeTimelockedAction()",
    params: "none",
    returns: "void",
    access: "onlyEmergencyContact",
    description: "Executes a timelock-protected action after the timelock period has elapsed.",
    docs: "docs/API_Reference.md#emergencyhandler-executetimelockaction"
  },

  // ==================== PARAMETERMANAGER FUNCTIONS ====================
  "ParameterManager.registerParameter": {
    signature: "registerParameter(string name, uint256 defaultValue, uint256 minValue, uint256 maxValue)",
    params: "name: Parameter name, defaultValue: Default value, minValue: Minimum allowed value, maxValue: Maximum allowed value",
    returns: "void",
    access: "onlyOwner",
    description: "Registers a new parameter with validation constraints.",
    docs: "docs/API_Reference.md#parametermanager-registerparameter"
  },
  
  "ParameterManager.proposeParameterChange": {
    signature: "proposeParameterChange(string name, uint256 newValue)",
    params: "name: Parameter name, newValue: Proposed new value",
    returns: "void",
    access: "onlyOwner",
    description: "Proposes a change to a parameter value with timelock mechanism.",
    docs: "docs/API_Reference.md#parametermanager-proposeparameterchange"
  },
  
  "ParameterManager.executeParameterChange": {
    signature: "executeParameterChange(string name)",
    params: "name: Parameter name to execute change for",
    returns: "void",
    access: "onlyOwner",
    description: "Executes a proposed parameter change after timelock period expires.",
    docs: "docs/API_Reference.md#parametermanager-executeparameterchange"
  },
  
  "ParameterManager.emergencySetParameter": {
    signature: "emergencySetParameter(string name, uint256 value)",
    params: "name: Parameter name, value: Emergency value to set",
    returns: "void",
    access: "onlyOwner",
    description: "Sets parameter value immediately during emergency situations, bypassing timelock.",
    docs: "docs/API_Reference.md#parametermanager-emergencysetparameter"
  },
  
  "ParameterManager.getCurrentParameterValue": {
    signature: "getCurrentParameterValue(string name) → uint256",
    params: "name: Parameter name",
    returns: "uint256: Current parameter value",
    access: "public view",
    description: "Returns the current value of a registered parameter.",
    docs: "docs/API_Reference.md#parametermanager-getcurrentparametervalue"
  },
  
  "ParameterManager.getParameterHistory": {
    signature: "getParameterHistory(string name) → ParameterChange[]",
    params: "name: Parameter name",
    returns: "ParameterChange[]: Array of historical parameter changes",
    access: "public view",
    description: "Returns complete history of changes for a specific parameter.",
    docs: "docs/API_Reference.md#parametermanager-getparameterhistory"
  },
  
  "ParameterManager.cancelProposal": {
    signature: "cancelProposal(string name)",
    params: "name: Parameter name to cancel proposal for",
    returns: "void",
    access: "onlyOwner",
    description: "Cancels a pending parameter change proposal before execution.",
    docs: "docs/API_Reference.md#parametermanager-cancelproposal"
  },
  
  "ParameterManager.batchExecuteChanges": {
    signature: "batchExecuteChanges(string[] names)",
    params: "names: Array of parameter names to execute",
    returns: "void",
    access: "onlyOwner",
    description: "Executes multiple parameter changes in a single transaction for efficiency.",
    docs: "docs/API_Reference.md#parametermanager-batchexecutechanges"
  },
};