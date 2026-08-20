// ==================== FUNCTION CALLS MAPPING ====================
// Complete mapping of all function dependencies in the DeFi system
// Format: "ModuleName.functionName": [{ target: "TargetModule.targetFunction", type: COLOR, param: "optional" }]

// Color constants (will be replaced with actual constants in the HTML)
const READ = "READ";
const WRITE = "WRITE"; 
const EXTERNAL = "EXTERNAL";
const EMERGENCY = "EMERGENCY";

const functionCalls = {
  // ==================== BEACON CALLS ====================
  
  "Beacon.updateImplementation": [],
  
  "Beacon.getImplementation": [],
  
  "Beacon.checkModuleExists": [],
  
  "Beacon.getRegisteredModules": [],
  
  "Beacon.getImplementationHistory": [],
  
  "Beacon.getModuleInfo": [],
  
  "Beacon.freezeModule": [],
  
  "Beacon.unfreezeModule": [],
  
  "Beacon.activateGlobalFreeze": [],
  
  "Beacon.deactivateGlobalFreeze": [],
  
  "Beacon.transferOwnership": [],
  
  "Beacon.acceptOwnership": [],
  
  "Beacon.cancelOwnershipTransfer": [],
  
  "Beacon.batchUpdateImplementations": [],
  
  "Beacon.getBeaconStatus": [],
  
  "Beacon.checkSystemHealth": [],
  
  // ==================== PROXYGENERAL CALLS ====================
  
  "ProxyGeneral.mint": [],
  
  "ProxyGeneral.burn": [],
  
  "ProxyGeneral.balanceOf": [],
  
  "ProxyGeneral.totalSupply": [],
  
  "ProxyGeneral.transferFunds": [
    { target: "External.IERC20.balanceOf", type: READ },
    { target: "External.IERC20.transfer", type: EXTERNAL },
  ],
  
  "ProxyGeneral.getAssetBalance": [
    { target: "External.IERC20.balanceOf", type: EXTERNAL },
  ],
  
  "ProxyGeneral.approveSpender": [
    { target: "External.IERC20.approve", type: EXTERNAL },
  ],
  
  "ProxyGeneral.transferToModule": [
    { target: "External.IERC20.balanceOf", type: READ },
    { target: "External.IERC20.transfer", type: EXTERNAL },
  ],
  
  "ProxyGeneral.transferFromModule": [
    { target: "External.IERC20.transferFrom", type: EXTERNAL },
  ],
  
  "ProxyGeneral.authorizeModule": [],
  
  "ProxyGeneral.deauthorizeModule": [],
  
  "ProxyGeneral.isAuthorizedModule": [],
  
  "ProxyGeneral.pause": [],
  
  "ProxyGeneral.unpause": [],
  
  "ProxyGeneral.isPaused": [],
  
  "ProxyGeneral.emergencyTransferAll": [
    { target: "Beacon.getImplementation", type: READ, param: "WETH" },
    { target: "External.IERC20.balanceOf", type: READ },
    { target: "External.IERC20.transfer", type: EXTERNAL },
  ],
  
  "ProxyGeneral.setHourlyWithdrawn": [],
  
  "ProxyGeneral.getHourlyWithdrawn": [],
  
  "ProxyGeneral.incrementHourlyWithdrawn": [],
  
  "ProxyGeneral.setModuleParameter": [],
  
  "ProxyGeneral.getModuleParameter": [],
  
  "ProxyGeneral.checkRateLimit": [
    { target: "ProxyGeneral.getHourlyWithdrawn", type: READ },
  ],
  
  "ProxyGeneral.trackOperation": [
    { target: "ProxyGeneral.incrementHourlyWithdrawn", type: WRITE },
  ],
  
  "ProxyGeneral.setRateLimit": [],
  
  "ProxyGeneral.withdrawToken": [
    { target: "ProxyGeneral.transferFunds", type: WRITE },
  ],
  
  "ProxyGeneral.emergencyTransfer": [
    { target: "External.IERC20.transfer", type: EXTERNAL },
  ],
  
  // ==================== TOKENMANAGER CALLS ====================
  
  "TokenManager.manageTokenData": [
    { target: "Beacon.getImplementation", type: READ, param: "WETH" },
    { target: "External.AggregatorV3.latestRoundData", type: EXTERNAL },
  ],
  
  "TokenManager.removeToken": [],
  
  "TokenManager.updateHeartbeat": [],
  
  "TokenManager.getTokenPrice": [
    { target: "External.AggregatorV3.latestRoundData", type: EXTERNAL },
  ],
  
  "TokenManager.getTokenPriceWithEvents": [
    { target: "TokenManager.getTokenPrice", type: READ },
  ],
  
  "TokenManager.getTokenCount": [],
  
  "TokenManager.getActiveTokens": [],
  
  "TokenManager.isTokenActive": [],
  
  "TokenManager.getTokenAddress": [],
  
  "TokenManager.getTokenInfo": [],
  
  "TokenManager.getTokenPriceForModule": [
    { target: "TokenManager.getTokenPrice", type: READ },
  ],
  
  "TokenManager.validatePriceFeed": [
    { target: "TokenManager.getTokenPrice", type: READ },
  ],
  
  "TokenManager.getTokenErrors": [],
  
  "TokenManager.resetTokenErrors": [],
  
  "TokenManager.setMaxErrors": [],
  
  "TokenManager.setMaxTokensPerOperation": [],
  
  // ==================== VALUECALCULATOR CALLS ====================
  
  "ValueCalculator.calculateTokenValue": [
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "TokenManager.getTokenPrice", type: READ },
    { target: "TokenManager.getTokenAddress", type: READ },
    { target: "TokenManager.getTokenInfo", type: READ },
    { target: "External.IERC20.balanceOf", type: READ },
  ],
  
  "ValueCalculator.calculateTokenValueView": [
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "TokenManager.getTokenPrice", type: READ },
    { target: "TokenManager.getTokenAddress", type: READ },
    { target: "TokenManager.getTokenInfo", type: READ },
    { target: "External.IERC20.balanceOf", type: READ },
  ],
  
  "ValueCalculator.getTotalPoolValue": [
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "WETH" },
    { target: "TokenManager.getActiveTokens", type: READ },
    { target: "TokenManager.getTokenAddress", type: READ },
    { target: "ValueCalculator.calculateTokenValue", type: READ },
    { target: "External.WETH.balanceOf", type: READ },
  ],
  
  "ValueCalculator.getTotalPoolValueView": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "WETH" },
    { target: "TokenManager.getActiveTokens", type: READ },
    { target: "ValueCalculator.calculateTokenValueView", type: READ },
    { target: "External.WETH.balanceOf", type: READ },
  ],
  
  "ValueCalculator.getCachedTokenValue": [],
  
  "ValueCalculator.getCachedTokenPrice": [],
  
  "ValueCalculator.invalidateCache": [],
  
  "ValueCalculator.invalidateAllCache": [
    { target: "TokenManager.getActiveTokens", type: READ },
  ],
  
  "ValueCalculator.selectTokenForSwap": [
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "TokenManager.getActiveTokens", type: READ },
    { target: "TokenManager.getTokenAddress", type: READ },
    { target: "TokenManager.getTokenPrice", type: READ },
    { target: "TokenManager.getTokenInfo", type: READ },
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
    { target: "External.IERC20.balanceOf", type: READ },
  ],
  
  "ValueCalculator.getTokenValueInfo": [
    { target: "ValueCalculator.calculateTokenValueView", type: READ },
    { target: "TokenManager.getTokenAddress", type: READ },
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
    { target: "External.IERC20.balanceOf", type: READ },
  ],
  
  "ValueCalculator.validatePoolValue": [
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
  ],
  
  "ValueCalculator.setCacheDuration": [],
  
  "ValueCalculator.setMaxPriceAge": [],
  
  "ValueCalculator.setMaxErrors": [],
  
  // ==================== LIQUIDITYMANAGER CALLS ====================
  
  "LiquidityManager.deposit": [
    { target: "Beacon.getImplementation", type: READ, param: "ParameterManager" },
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "WETH" },
    { target: "ParameterManager.getCurrentParameterValue", type: READ },
    { target: "ProxyGeneral.checkRateLimit", type: READ },
    { target: "ProxyGeneral.trackOperation", type: WRITE },
    { target: "ProxyGeneral.totalSupply", type: READ },
    { target: "External.WETH.deposit", type: EXTERNAL },
    { target: "External.WETH.transfer", type: EXTERNAL },
    { target: "ProxyGeneral.mint", type: WRITE },
    { target: "External.IERC20.balanceOf", type: READ },
  ],
  
  "LiquidityManager.withdraw": [
    { target: "Beacon.getImplementation", type: READ, param: "ParameterManager" },
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "WETH" },
    { target: "Beacon.getImplementation", type: READ, param: "ValueCalculator" },
    { target: "Beacon.getImplementation", type: READ, param: "SwapManager" },
    { target: "ProxyGeneral.balanceOf", type: READ },
    { target: "ProxyGeneral.isPaused", type: READ },
    { target: "ValueCalculator.getTotalPoolValue", type: READ },
    { target: "ProxyGeneral.totalSupply", type: READ },
    { target: "LiquidityManager.checkWithdrawLimits", type: READ },
    { target: "ProxyGeneral.checkRateLimit", type: READ },
    { target: "ProxyGeneral.trackOperation", type: WRITE },
    { target: "External.IERC20.balanceOf", type: READ },
    { target: "ValueCalculator.selectTokenForSwap", type: READ },
    { target: "SwapManager.performSwap", type: WRITE },
    { target: "ProxyGeneral.burn", type: WRITE },
    { target: "ProxyGeneral.withdrawToken", type: WRITE },
    { target: "External.WETH.withdraw", type: EXTERNAL },
  ],
  
  "LiquidityManager.calculateDepositShares": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "ValueCalculator" },
    { target: "ProxyGeneral.totalSupply", type: READ },
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
  ],
  
  "LiquidityManager.calculateWithdrawAmount": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "ValueCalculator" },
    { target: "ProxyGeneral.totalSupply", type: READ },
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
  ],
  
  "LiquidityManager.canWithdraw": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "ValueCalculator" },
    { target: "ProxyGeneral.balanceOf", type: READ },
    { target: "ProxyGeneral.totalSupply", type: READ },
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
    { target: "LiquidityManager.checkWithdrawLimits", type: READ },
  ],
  
  "LiquidityManager.getPoolStats": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "ValueCalculator" },
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "Beacon.getImplementation", type: READ, param: "WETH" },
    { target: "ProxyGeneral.totalSupply", type: READ },
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
    { target: "TokenManager.getActiveTokens", type: READ },
    { target: "External.IERC20.balanceOf", type: READ },
  ],
  
  "LiquidityManager.validatePoolState": [
    { target: "Beacon.getImplementation", type: READ, param: "ValueCalculator" },
    { target: "ValueCalculator.validatePoolValue", type: READ },
  ],
  
  "LiquidityManager.checkWithdrawLimits": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.getHourlyWithdrawn", type: READ },
  ],
  
  "LiquidityManager.getRemainingHourlyLimit": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.getHourlyWithdrawn", type: READ },
  ],
  
  "LiquidityManager.getRemainingDailyLimit": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.getHourlyWithdrawn", type: READ },
  ],
  
  "LiquidityManager.setDepositFee": [],
  
  "LiquidityManager.setWithdrawFee": [],
  
  "LiquidityManager.setFeeRecipient": [],
  
  "LiquidityManager.setDepositsEnabled": [],
  
  "LiquidityManager.setWithdrawsEnabled": [],
  
  "LiquidityManager.setWithdrawLimits": [],
  
  "LiquidityManager.checkWithdrawRateLimit": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.checkRateLimit", type: READ },
  ],
  
  "LiquidityManager.checkDepositRateLimit": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.checkRateLimit", type: READ },
  ],
  
  "LiquidityManager.setRateLimit": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.setRateLimit", type: WRITE },
  ],
  
  "LiquidityManager.getRateLimitInfo": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.checkRateLimit", type: READ },
  ],
  
  // ==================== SWAPMANAGER CALLS ====================
  
  "SwapManager.swapTokenForWETH": [
    { target: "SwapManager.performSwap", type: WRITE },
  ],
  
  "SwapManager.swapWETHForToken": [
    { target: "SwapManager.performSwap", type: WRITE },
  ],
  
  "SwapManager.performSwap": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "TokenManager.isTokenActive", type: READ },
    { target: "TokenManager.getTokenAddress", type: READ },
    { target: "ProxyGeneral.approveSpender", type: WRITE },
    { target: "External.IERC20.balanceOf", type: READ },
    { target: "External.SimpleSwap.inputSwap", type: EXTERNAL },
    { target: "External.SimpleSwap.getExpectedOutput", type: EXTERNAL },
  ],
  
  "SwapManager.validateSwapParameters": [
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "TokenManager.isTokenActive", type: READ },
    { target: "TokenManager.getTokenAddress", type: READ },
    { target: "ProxyGeneral.getAssetBalance", type: READ },
    { target: "External.SimpleSwap.getExpectedOutput", type: EXTERNAL },
  ],
  
  "SwapManager.getExpectedSwapOutput": [
    { target: "SwapManager.validateSwapParameters", type: READ },
  ],
  
  "SwapManager.getSwapStats": [],
  
  "SwapManager.getSwapQuote": [
    { target: "SwapManager.getExpectedSwapOutput", type: READ },
  ],
  
  "SwapManager.calculateMinAmountOut": [
    { target: "SwapManager.getExpectedSwapOutput", type: READ },
  ],
  
  "SwapManager.setSwapLimits": [],
  
  "SwapManager.setMaxSlippage": [],
  
  "SwapManager.setSimpleSwapRouter": [],
  
  "SwapManager.setSwapsEnabled": [],
  
  "SwapManager.resetSwapStats": [],
  
  "SwapManager.getSimpleSwapRouter": [],
  
  "SwapManager.areSwapsEnabled": [],
  
  "SwapManager.getTokenWETHPrice": [
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "TokenManager.getTokenPrice", type: READ },
  ],
  
  "SwapManager.estimateSwapGas": [
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "TokenManager.getTokenInfo", type: READ },
    { target: "External.SimpleSwap.getExpectedOutput", type: EXTERNAL },
  ],
  
  "SwapManager.canSwap": [
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "TokenManager.getTokenAddress", type: READ },
  ],
  
  "SwapManager.validateSwapParams": [
    { target: "SwapManager.canSwap", type: READ },
  ],
  
  "SwapManager.emergencyTokenRecovery": [
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "TokenManager.getTokenAddress", type: READ },
    { target: "ProxyGeneral.transferFunds", type: WRITE },
  ],
  
  // ==================== EMERGENCYHANDLER CALLS ====================
  
  "EmergencyHandler.emergencyPause": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.pause", type: EMERGENCY },
  ],
  
  "EmergencyHandler.emergencyUnpause": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.unpause", type: EMERGENCY },
  ],
  
  "EmergencyHandler.canUnpause": [],
  
  "EmergencyHandler.getEmergencyState": [],
  
  "EmergencyHandler.emergencyWithdraw": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "Beacon.getImplementation", type: READ, param: "WETH" },
    { target: "Beacon.getImplementation", type: READ, param: "ValueCalculator" },
    { target: "TokenManager.getActiveTokens", type: READ },
    { target: "TokenManager.getTokenAddress", type: READ },
    { target: "ProxyGeneral.emergencyTransfer", type: EMERGENCY },
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
    { target: "External.IERC20.balanceOf", type: READ },
  ],
  
  "EmergencyHandler.generateEmergencyReport": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "Beacon.getImplementation", type: READ, param: "ValueCalculator" },
    { target: "Beacon.getImplementation", type: READ, param: "WETH" },
    { target: "ProxyGeneral.isPaused", type: READ },
    { target: "TokenManager.getActiveTokens", type: READ },
    { target: "TokenManager.getTokenAddress", type: READ },
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
    { target: "External.IERC20.balanceOf", type: READ },
  ],
  
  "EmergencyHandler.getLastEmergencyReport": [],
  
  "EmergencyHandler.isEmergencyExecuted": [],
  
  "EmergencyHandler.getEmergencyStats": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "ValueCalculator" },
    { target: "ProxyGeneral.isPaused", type: READ },
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
  ],
  
  "EmergencyHandler.getSystemHealthStatus": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "ProxyGeneral.isPaused", type: READ },
    { target: "ProxyGeneral.totalSupply", type: READ },
    { target: "TokenManager.getActiveTokens", type: READ },
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
  ],
  
  "EmergencyHandler.addEmergencyContact": [],
  
  "EmergencyHandler.removeEmergencyContact": [],
  
  "EmergencyHandler.isAuthorizedForEmergency": [],
  
  "EmergencyHandler.getEmergencyContactsCount": [],
  
  "EmergencyHandler.getContactInfo": [],
  
  "EmergencyHandler.setUnpauseTimelock": [],
  
  "EmergencyHandler.resetEmergencyState": [],
  
  "EmergencyHandler.activateEmergency": [
    { target: "EmergencyHandler.emergencyPause", type: EMERGENCY },
  ],
  
  "EmergencyHandler.deactivateEmergency": [
    { target: "EmergencyHandler.emergencyUnpause", type: EMERGENCY },
  ],
  
  "EmergencyHandler.isEmergencyActive": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.isPaused", type: READ },
  ],
  
  "EmergencyHandler.getEmergencyContacts": [],
  
  "EmergencyHandler.checkIsEmergencyContact": [],
  
  "EmergencyHandler.setEmergencyTimelock": [
    { target: "EmergencyHandler.setUnpauseTimelock", type: WRITE },
  ],
  
  "EmergencyHandler.getEmergencyTimelock": [],
  
  "EmergencyHandler.isTimelockExpired": [],
  
  "EmergencyHandler.setEmergencyCooldown": [],
  
  "EmergencyHandler.isInCooldown": [],
  
  "EmergencyHandler.getRemainingCooldown": [],
  
  "EmergencyHandler.createAssetSnapshot": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "Beacon.getImplementation", type: READ, param: "TokenManager" },
    { target: "Beacon.getImplementation", type: READ, param: "WETH" },
    { target: "TokenManager.getActiveTokens", type: READ },
    { target: "TokenManager.getTokenAddress", type: READ },
    { target: "External.IERC20.balanceOf", type: READ },
    { target: "ValueCalculator.getTotalPoolValueView", type: READ },
  ],
  
  "EmergencyHandler.getAssetSnapshot": [],
  
  "EmergencyHandler.getAllSnapshots": [],
  
  "EmergencyHandler.getSnapshotCount": [],
  
  "EmergencyHandler.validateSystemHealth": [
    { target: "Beacon.getImplementation", type: READ, param: "ValueCalculator" },
    { target: "ValueCalculator.validatePoolValue", type: READ },
  ],
  
  "EmergencyHandler.checkAssetIntegrity": [
    { target: "EmergencyHandler.validateSystemHealth", type: READ },
  ],
  
  "EmergencyHandler.pauseAllOperations": [
    { target: "EmergencyHandler.emergencyPause", type: EMERGENCY },
  ],
  
  "EmergencyHandler.resumeAllOperations": [
    { target: "EmergencyHandler.emergencyUnpause", type: EMERGENCY },
  ],
  
  "EmergencyHandler.emergencyWithdraw": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.emergencyTransfer", type: EMERGENCY },
  ],
  
  "EmergencyHandler.emergencyTransfer": [],
  
  "EmergencyHandler.checkEmergencyAccess": [],
  
  // ==================== PARAMETERMANAGER CALLS ====================
  
  "ParameterManager.getCurrentParameterValue": [],
  
  "ParameterManager.getAllParameterNames": [],
  
  "ParameterManager.getParameterInfo": [],
  
  "ParameterManager.proposeParameterChange": [],
  
  "ParameterManager.executeParameterChange": [],
  
  "ParameterManager.emergencySetParameter": [
    { target: "Beacon.getImplementation", type: READ, param: "ProxyGeneral" },
    { target: "ProxyGeneral.isPaused", type: READ },
  ],
  
  "ParameterManager.updateMultipleParameters": [],
  
  "ParameterManager.isValidParameterValue": [],
  
  "ParameterManager.canExecuteParameterChange": [],
  
  "ParameterManager.registerParameter": [],
  
  "ParameterManager.setParameterTimelock": [],
  
  "ParameterManager.resetParameterToDefault": [],
  
  "ParameterManager.proposeParameterChange": [],
  
  "ParameterManager.executeParameterChange": [],
  
  "ParameterManager.cancelParameterProposal": [],
  
  "ParameterManager.getParameter": [],
  
  "ParameterManager.setParameterEmergency": [],
  
  "ParameterManager.parameterExists": [],
  
  "ParameterManager.validateParameterValue": [],
  
  "ParameterManager.registerParameter": [],
  
  "ParameterManager.getRegisteredParameters": [],
  
  "ParameterManager.unregisterParameter": [],
  
  "ParameterManager.getParameterTimelock": [],
  
  "ParameterManager.getProposal": [],
  
  "ParameterManager.getActiveProposals": [],
  
  "ParameterManager.getExecutableProposals": [],
  
  "ParameterManager.getParameterHistory": [],
  
  "ParameterManager.getLastParameterChange": [],
  
  "ParameterManager.getUintParameter": [],
  
  "ParameterManager.getBoolParameter": [],
  
  "ParameterManager.getAddressParameter": [],
  
  "ParameterManager.getStringParameter": [],
  
  "ParameterManager.proposeBatchParameterChanges": [
    { target: "ParameterManager.proposeParameterChange", type: WRITE },
  ],
  
  "ParameterManager.executeBatchProposals": [
    { target: "ParameterManager.executeParameterChange", type: WRITE },
  ],
};
