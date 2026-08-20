export const BEACON_ABI = [
  "function owner() view returns (address)",
  "function updateImplementation(string module,address newImplementation)",
  "function getImplementation(string module) view returns (address)",
  "function getRegisteredModules() view returns (string[])",
  "function getImplementationHistory(string module) view returns (address[])",
  "function checkModuleExists(string module) view returns (bool)",
  "function checkSystemHealth() view returns (bool,string[])",
] as const;

export const PROXY_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function isPaused() view returns (bool)",
  "function isAuthorizedModule(address) view returns (bool)",
  "function authorizeModule(address module,string moduleType)",
  "function setRateLimit(string,uint256,uint256)",
] as const;

export const LIQUIDITY_ABI = [
  "function deposit(uint256 amount) returns (uint256)",
  "function withdrawWithDeadline(uint256 shares,uint256 deadline) returns (uint256)",
  "function canWithdraw(address user,uint256 shares) view returns (bool,string)",
  "function depositsEnabled() view returns (bool)",
  "function withdrawsEnabled() view returns (bool)",
  "function setDepositFee(uint256)",
  "function setWithdrawFee(uint256)",
  "function setFeeRecipient(address)",
  "function setDepositsEnabled(bool)",
  "function setWithdrawsEnabled(bool)",
  "function setWithdrawLimits(uint256,uint256,uint256,uint256)",
] as const;

export const PROTOCOL_MANAGER_ABI = [
  "function owner() view returns (address)",
  "function registerProtocol(string,address,address,address)",
  "function updateProtocol(string,address,address,address)",
  "function setProtocolActive(string,bool)",
  "function setAllowedSelectors(string,bytes4[],bool)",
  "function getProtocolInfo(string) view returns (tuple(address plugin,address lensAdapter,address registry,bool isActive,uint256 registeredAt))",
  "function getAllProtocolNames() view returns (string[])",
  "function getActiveProtocolCount() view returns (uint256)",
  "function getAllProtocolsValue() view returns (uint256)",
  "function getGlobalHealthFactor() view returns (uint256)",
  "function getAllProtocolSummaries() view returns (tuple(string name,uint8 protocolType,uint256 totalCollateral,uint256 totalDebt,uint256 netValue,uint256 activePositionCount,uint256 lowestHealthFactor,bool isHealthy)[])",
  "function getAllPositionsSortedByRisk() view returns (tuple(uint256 positionId,string protocolName,address protocol,uint256 collateral,uint256 debt,uint256 healthFactor,uint256 liquidationThreshold,bool isActive,uint256 lastUpdate)[])",
  "function deposit(string,string,uint256)",
  "function withdraw(string,string,uint256)",
  "function borrow(string,string,uint256)",
  "function repay(string,string,uint256)",
  "function closePosition(string,string,string)",
  "function getBalance(string,string) view returns (uint256)",
  "function getDebt(string,string) view returns (uint256)",
  "function getHealthFactor(string) view returns (uint256)",
] as const;

export const TOKEN_MANAGER_ABI = [
  "function owner() view returns (address)",
  "function manageTokenData(string,address,uint8,uint256)",
  "function removeToken(string)",
  "function getTokenInfo(string) view returns (tuple(address tokenAddress,uint8 tokenDecimals,string tokenCode,bool isActive,uint256 lastPriceTimestamp,uint256 lastPrice,uint256 heartbeat,uint256 errorCount))",
  "function getActiveTokens() view returns (string[])",
  "function getTokenAddress(string) view returns (address)",
] as const;

export const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

export const WETH_ABI = [...ERC20_ABI, "function deposit() payable", "function withdraw(uint256)"] as const;

export const SWAP_MANAGER_ABI = [
  "function owner() view returns (address)",
  "function areSwapsEnabled() view returns (bool)",
  "function getSwapQuote(string,uint256) view returns (uint256)",
  "function getAllQuotes(string,string,uint256) view returns (tuple(string pluginName,uint256 quote,bool isValid,string errorReason)[])",
  "function swapWithBestPlugin(string,string,uint256,uint256,uint256) returns (uint256)",
  "function setSwapsEnabled(bool)",
  "function setSwapLimits(string,uint256,uint256)",
  "function setMaxSlippage(uint256)",
] as const;

export const EMERGENCY_ABI = [
  "function owner() view returns (address)",
  "function isEmergencyActive() view returns (bool)",
  "function emergencyPause(string)",
  "function emergencyUnpause()",
  "function validateSystemHealth() view returns (bool,string[])",
] as const;
