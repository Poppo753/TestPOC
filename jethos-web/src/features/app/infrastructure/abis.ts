export const erc20Abi = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
] as const;

export const shareAbi = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function paused() view returns (bool)',
] as const;

export const liquidityManagerAbi = [
  'function deposit(uint256 amount) returns (uint256 lpTokens)',
  'function withdraw(uint256 shares) returns (uint256 amount)',
  'function withdrawWithDeadline(uint256 shares,uint256 deadline) returns (uint256 amount)',
  'function calculateDepositShares(uint256 amount) view returns (uint256 shares)',
  'function calculateWithdrawAmount(uint256 shares) view returns (uint256 amount)',
  'function canWithdraw(address user,uint256 shares) view returns (bool isAllowed,string errorReason)',
  'function depositsEnabled() view returns (bool)',
  'function withdrawsEnabled() view returns (bool)',
  'function depositFee() view returns (uint256)',
  'function withdrawFee() view returns (uint256)',
  'function feeRecipient() view returns (address)',
  'function paused() view returns (bool)',
] as const;

export const valueCalculatorAbi = [
  'function getTotalPoolValueView() view returns (uint256)',
] as const;

export const protocolManagerAbi = [
  'function getAllProtocolNames() view returns (string[] names)',
  'function getActiveProtocolCount() view returns (uint256 count)',
  'function getAllProtocolsValue() view returns (uint256 totalValue)',
  'function getProtocolInfo(string protocolName) view returns (tuple(address plugin,address lensAdapter,address registry,bool isActive,uint256 registeredAt) info)',
  'function getProtocolPositionBreakdown(string protocolName) view returns (uint256 collateral,uint256 debt,uint256 netValue)',
  'function getGlobalHealthFactor() view returns (uint256 lowestHF,string protocolName)',
] as const;
