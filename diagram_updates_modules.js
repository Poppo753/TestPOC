// ==================== MODULES STRUCTURE ====================
// Complete visual representation of all modules and their functions
// Format: Array of module objects with key, title, subtitle, coordinates, and functions array

// Color constants (will be replaced with actual constants in the HTML)
const READ = "READ";
const WRITE = "WRITE"; 
const EXTERNAL = "EXTERNAL";
const EMERGENCY = "EMERGENCY";

const modules = [
  {
    key: "Beacon",
    title: "BEACON",
    subtitle: "Central Registry + Security",
    x: 50,
    y: 50,
    functions: [
      { id: "getImplementation", name: "getImplementation(name)", access: "view", color: READ },
      { id: "updateImplementation", name: "updateImplementation(...)", access: "owner", color: WRITE },
      { id: "checkModuleExists", name: "checkModuleExists(...)", access: "view", color: READ },
      { id: "getRegisteredModules", name: "getRegisteredModules()", access: "view", color: READ },
      { id: "getImplementationHistory", name: "getImplementationHistory(...)", access: "view", color: READ },
      { id: "getModuleInfo", name: "getModuleInfo(...)", access: "view", color: READ },
      { id: "freezeModule", name: "freezeModule(...)", access: "owner", color: EMERGENCY },
      { id: "unfreezeModule", name: "unfreezeModule(...)", access: "owner", color: EMERGENCY },
      { id: "activateGlobalFreeze", name: "activateGlobalFreeze()", access: "owner", color: EMERGENCY },
      { id: "deactivateGlobalFreeze", name: "deactivateGlobalFreeze()", access: "owner", color: EMERGENCY },
      { id: "transferOwnership", name: "transferOwnership(...)", access: "owner", color: WRITE },
      { id: "acceptOwnership", name: "acceptOwnership()", access: "pending", color: WRITE },
      { id: "cancelOwnershipTransfer", name: "cancelOwnershipTransfer()", access: "owner", color: WRITE },
      { id: "batchUpdateImplementations", name: "batchUpdateImplementations(...)", access: "owner", color: WRITE },
      { id: "getBeaconStatus", name: "getBeaconStatus()", access: "view", color: READ },
      { id: "checkSystemHealth", name: "checkSystemHealth()", access: "view", color: READ },
    ]
  },
  {
    key: "ProxyGeneral",
    title: "PROXYGENERAL",
    subtitle: "Asset Custodian + LP Token",
    x: 450,
    y: 50,
    functions: [
      { id: "mint", name: "mint(to, amount)", access: "auth", color: WRITE },
      { id: "burn", name: "burn(from, amount)", access: "auth", color: WRITE },
      { id: "balanceOf", name: "balanceOf(account)", access: "view", color: READ },
      { id: "totalSupply", name: "totalSupply()", access: "view", color: READ },
      { id: "transferFunds", name: "transferFunds(...)", access: "auth", color: WRITE },
      { id: "getAssetBalance", name: "getAssetBalance(asset)", access: "view", color: READ },
      { id: "approveSpender", name: "approveSpender(...)", access: "auth", color: WRITE },
      { id: "transferToModule", name: "transferToModule(...)", access: "auth", color: WRITE },
      { id: "transferFromModule", name: "transferFromModule(...)", access: "auth", color: WRITE },
      { id: "authorizeModule", name: "authorizeModule(...)", access: "owner", color: WRITE },
      { id: "deauthorizeModule", name: "deauthorizeModule(...)", access: "owner", color: WRITE },
      { id: "isAuthorizedModule", name: "isAuthorizedModule(...)", access: "view", color: READ },
      { id: "pause", name: "pause()", access: "auth", color: EMERGENCY },
      { id: "unpause", name: "unpause()", access: "owner", color: EMERGENCY },
      { id: "isPaused", name: "isPaused()", access: "view", color: READ },
      { id: "emergencyTransferAll", name: "emergencyTransferAll(...)", access: "owner", color: EMERGENCY },
      { id: "setHourlyWithdrawn", name: "setHourlyWithdrawn(...)", access: "auth", color: WRITE },
      { id: "getHourlyWithdrawn", name: "getHourlyWithdrawn(...)", access: "view", color: READ },
      { id: "incrementHourlyWithdrawn", name: "incrementHourlyWithdrawn(...)", access: "auth", color: WRITE },
      { id: "setModuleParameter", name: "setModuleParameter(...)", access: "owner", color: WRITE },
      { id: "getModuleParameter", name: "getModuleParameter(...)", access: "view", color: READ },
    ]
  },
  {
    key: "TokenManager",
    title: "TOKENMANAGER",
    subtitle: "Registry + Oracle Integration",
    x: 900,
    y: 50,
    functions: [
      { id: "manageTokenData", name: "manageTokenData(...)", access: "owner", color: WRITE },
      { id: "removeToken", name: "removeToken(code)", access: "owner", color: WRITE },
      { id: "isTokenActive", name: "isTokenActive(code)", access: "view", color: READ },
      { id: "getTokenAddress", name: "getTokenAddress(code)", access: "view", color: READ },
      { id: "getTokenInfo", name: "getTokenInfo(code)", access: "view", color: READ },
      { id: "getActiveTokens", name: "getActiveTokens()", access: "view", color: READ },
      { id: "getTokenCount", name: "getTokenCount()", access: "view", color: READ },
      { id: "getTokenPrice", name: "getTokenPrice(code)", access: "view", color: READ },
      { id: "getTokenPriceWithEvents", name: "getTokenPriceWithEvents(code)", access: "public", color: READ },
      { id: "addOrUpdateOracle", name: "addOrUpdateOracle(...)", access: "owner", color: WRITE },
      { id: "removeOracle", name: "removeOracle(code)", access: "owner", color: WRITE },
      { id: "updateHeartbeat", name: "updateHeartbeat(...)", access: "owner", color: WRITE },
      { id: "batchUpdateTokens", name: "batchUpdateTokens(...)", access: "owner", color: WRITE },
      { id: "getSystemTokensInfo", name: "getSystemTokensInfo()", access: "view", color: READ },
    ]
  },
  {
    key: "ValueCalculator",
    title: "VALUECALCULATOR",
    subtitle: "Valuation Engine + Cache",
    x: 50,
    y: 450,
    functions: [
      { id: "calculateTokenValue", name: "calculateTokenValue(code)", access: "public", color: READ },
      { id: "calculateTokenValueView", name: "calculateTokenValueView(code)", access: "view", color: READ },
      { id: "getTotalPoolValue", name: "getTotalPoolValue()", access: "public", color: READ },
      { id: "getTotalPoolValueView", name: "getTotalPoolValueView()", access: "view", color: READ },
      { id: "selectTokenForSwap", name: "selectTokenForSwap(target)", access: "view", color: READ },
      { id: "getCachedTokenValue", name: "getCachedTokenValue(code)", access: "view", color: READ },
      { id: "invalidateCache", name: "invalidateCache(code)", access: "auth", color: WRITE },
      { id: "refreshCache", name: "refreshCache(code)", access: "public", color: WRITE },
      { id: "getPoolComposition", name: "getPoolComposition()", access: "view", color: READ },
    ]
  },
  {
    key: "LiquidityManager",
    title: "LIQUIDITYMANAGER",
    subtitle: "Deposit/Withdraw + Rate Limiting",
    x: 450,
    y: 450,
    functions: [
      { id: "deposit", name: "deposit() payable", access: "public", color: WRITE },
      { id: "calculateDepositShares", name: "calculateDepositShares(...)", access: "view", color: READ },
      { id: "withdraw", name: "withdraw(lpTokens)", access: "public", color: WRITE },
      { id: "calculateWithdrawAmount", name: "calculateWithdrawAmount(...)", access: "view", color: READ },
      { id: "setWithdrawLimits", name: "setWithdrawLimits(...)", access: "owner", color: WRITE },
      { id: "checkWithdrawLimits", name: "checkWithdrawLimits(...)", access: "view", color: READ },
      { id: "emergencyWithdraw", name: "emergencyWithdraw(...)", access: "owner", color: EMERGENCY },
    ]
  },
  {
    key: "SwapManager",
    title: "SWAPMANAGER",
    subtitle: "DEX Integration + Swap Logic",
    x: 900,
    y: 450,
    functions: [
      { id: "swapTokenForWETH", name: "swapTokenForWETH(...)", access: "public", color: WRITE },
      { id: "getSwapQuote", name: "getSwapQuote(...)", access: "view", color: READ },
      { id: "calculateMinAmountOut", name: "calculateMinAmountOut(...)", access: "view", color: READ },
      { id: "setSimpleSwapRouter", name: "setSimpleSwapRouter(...)", access: "owner", color: WRITE },
      { id: "setSlippageTolerance", name: "setSlippageTolerance(...)", access: "owner", color: WRITE },
      { id: "batchSwap", name: "batchSwap(...)", access: "public", color: WRITE },
      { id: "getSwapHistory", name: "getSwapHistory(...)", access: "view", color: READ },
    ]
  },
  {
    key: "EmergencyHandler",
    title: "EMERGENCYHANDLER",
    subtitle: "Emergency Operations + Health",
    x: 50,
    y: 850,
    functions: [
      { id: "triggerEmergencyPause", name: "triggerEmergencyPause(...)", access: "emergency", color: EMERGENCY },
      { id: "unpause", name: "unpause()", access: "emergency", color: EMERGENCY },
      { id: "emergencyWithdraw", name: "emergencyWithdraw(...)", access: "emergency", color: EMERGENCY },
      { id: "addEmergencyContact", name: "addEmergencyContact(...)", access: "owner", color: WRITE },
      { id: "removeEmergencyContact", name: "removeEmergencyContact(...)", access: "owner", color: WRITE },
      { id: "getSystemHealthStatus", name: "getSystemHealthStatus()", access: "view", color: READ },
      { id: "setEmergencyTimelock", name: "setEmergencyTimelock(...)", access: "owner", color: WRITE },
      { id: "executeTimelockedAction", name: "executeTimelockedAction()", access: "emergency", color: EMERGENCY },
    ]
  },
  {
    key: "ParameterManager",
    title: "PARAMETERMANAGER",
    subtitle: "Configuration + Governance",
    x: 450,
    y: 850,
    functions: [
      { id: "registerParameter", name: "registerParameter(...)", access: "owner", color: WRITE },
      { id: "proposeParameterChange", name: "proposeParameterChange(...)", access: "owner", color: WRITE },
      { id: "executeParameterChange", name: "executeParameterChange(...)", access: "owner", color: WRITE },
      { id: "emergencySetParameter", name: "emergencySetParameter(...)", access: "owner", color: EMERGENCY },
      { id: "getCurrentParameterValue", name: "getCurrentParameterValue(...)", access: "view", color: READ },
      { id: "getParameterHistory", name: "getParameterHistory(...)", access: "view", color: READ },
      { id: "cancelProposal", name: "cancelProposal(...)", access: "owner", color: WRITE },
      { id: "batchExecuteChanges", name: "batchExecuteChanges(...)", access: "owner", color: WRITE },
    ]
  },
  {
    key: "External",
    title: "EXTERNAL",
    subtitle: "Integrations + Oracles",
    x: 900,
    y: 850,
    functions: [
      { id: "AggregatorV3.latestRoundData", name: "Chainlink.latestRoundData()", access: "external", color: EXTERNAL },
      { id: "AggregatorV3.decimals", name: "Chainlink.decimals()", access: "external", color: EXTERNAL },
      { id: "SimpleSwap.getAmountOut", name: "SimpleSwap.getAmountOut(...)", access: "external", color: EXTERNAL },
      { id: "SimpleSwap.swap", name: "SimpleSwap.swap(...)", access: "external", color: EXTERNAL },
      { id: "WETH.deposit", name: "WETH.deposit()", access: "external", color: EXTERNAL },
      { id: "WETH.withdraw", name: "WETH.withdraw(amount)", access: "external", color: EXTERNAL },
      { id: "WETH.balanceOf", name: "WETH.balanceOf(account)", access: "external", color: EXTERNAL },
      { id: "IERC20.balanceOf", name: "IERC20.balanceOf(account)", access: "external", color: EXTERNAL },
      { id: "IERC20.transfer", name: "IERC20.transfer(...)", access: "external", color: EXTERNAL },
      { id: "IERC20.transferFrom", name: "IERC20.transferFrom(...)", access: "external", color: EXTERNAL },
      { id: "IERC20.approve", name: "IERC20.approve(...)", access: "external", color: EXTERNAL },
    ]
  },
];

// Layout Information:
// Grid: 3 columns x 4 rows
// Column spacing: 450px
// Row spacing: 400px
// Module width: 350px (hardcoded in HTML)
// Module height: Dynamic based on function count (50px header + 20px per function + 20px padding)
//
// Coordinates:
// Col 1: x=50    (Beacon, ValueCalculator, EmergencyHandler)  
// Col 2: x=450   (ProxyGeneral, LiquidityManager, ParameterManager)
// Col 3: x=900   (TokenManager, SwapManager, External)
//
// Row 1: y=50    (Beacon, ProxyGeneral, TokenManager)
// Row 2: y=450   (ValueCalculator, LiquidityManager, SwapManager) 
// Row 3: y=850   (EmergencyHandler, ParameterManager, External)
//
// Note: Updated layout with more vertical space to accommodate new functions
// SVG height should be increased to at least 1400px to fit all modules