Create a highly detailed technical architecture diagram showing ALL function-level interactions between 8 smart contract modules in a DeFi system. Each arrow must represent a specific function call from one module to another.

CRITICAL REQUIREMENT: Show EVERY function call relationship, not just module-to-module connections.

═══════════════════════════════════════════════════════════════════

MODULE 1: BEACON (Central Registry)
├─ Public Functions:
│  ├─ getImplementation(string moduleName) → returns address
│  ├─ updateImplementation(string moduleName, address newImpl)
│  ├─ transferOwnership(address newOwner)
│  └─ acceptOwnership()
├─ Called BY (incoming):
│  ├─ ALL MODULES call getImplementation() for address resolution
│  └─ Owner calls updateImplementation(), transferOwnership()
└─ Calls TO (outgoing): NONE (independent module)

═══════════════════════════════════════════════════════════════════

MODULE 2: PROXYGENERAL (Asset Custodian + LP Token ERC20)
├─ Public Functions:
│  ├─ LP Token Management:
│  │  ├─ mint(address to, uint256 amount)
│  │  ├─ burn(address from, uint256 amount)
│  │  ├─ balanceOf(address account) → uint256
│  │  └─ totalSupply() → uint256
│  ├─ Asset Management:
│  │  ├─ transferFunds(address to, address asset, uint256 amount)
│  │  ├─ getAssetBalance(address asset) → uint256
│  │  ├─ approveSpender(address token, address spender, uint256 amount)
│  │  ├─ transferToModule(address token, address module, uint256 amount)
│  │  └─ transferFromModule(address token, address module, uint256 amount)
│  ├─ Access Control:
│  │  ├─ authorizeModule(address module)
│  │  ├─ deauthorizeModule(address module)
│  │  └─ isAuthorizedModule(address module) → bool
│  ├─ Emergency:
│  │  ├─ pause()
│  │  ├─ unpause()
│  │  ├─ isPaused() → bool
│  │  └─ emergencyTransferAll(address recipient)
│  └─ Rate Limiting:
│     ├─ getHourlyWithdrawn(address user, uint256 hour) → uint256
│     ├─ setHourlyWithdrawn(address user, uint256 hour, uint256 amount)
│     └─ incrementHourlyWithdrawn(address user, uint256 amount)
├─ Called BY (incoming):
│  ├─ LiquidityManager → mint(), burn(), totalSupply(), balanceOf(), transferFunds(), isPaused(), getHourlyWithdrawn(), incrementHourlyWithdrawn()
│  ├─ SwapManager → approveSpender(), getAssetBalance(), isPaused()
│  ├─ ValueCalculator → getAssetBalance()
│  ├─ EmergencyHandler → pause(), unpause(), isPaused(), emergencyTransferAll(), totalSupply()
│  ├─ Owner → authorizeModule(), deauthorizeModule(), unpause()
│  └─ All authorized modules check isAuthorizedModule()
└─ Calls TO (outgoing):
   └─ Beacon.getImplementation("WETH") [in emergencyTransferAll]
   └─ Beacon.getImplementation("TokenManager") [in emergencyTransferAll]

═══════════════════════════════════════════════════════════════════

MODULE 3: TOKENMANAGER (Token Registry + Chainlink)
├─ Public Functions:
│  ├─ Token Management:
│  │  ├─ manageTokenData(tokenCode, tokenAddress, priceFeed, decimals, heartbeat)
│  │  ├─ removeToken(string tokenCode)
│  │  └─ updateHeartbeat(string tokenCode, uint256 newHeartbeat)
│  ├─ Token Queries:
│  │  ├─ isTokenActive(string tokenCode) → bool
│  │  ├─ getTokenAddress(string tokenCode) → address
│  │  ├─ getTokenInfo(string tokenCode) → TokenInfo
│  │  ├─ getActiveTokens() → string[]
│  │  └─ getTokenCount() → uint256
│  ├─ Price Feeds:
│  │  ├─ getTokenPrice(tokenCode) → (price, updatedAt, isStale)
│  │  ├─ getTokenPriceWithEvents(tokenCode) → (price, updatedAt)
│  │  └─ validatePriceFeed(string tokenCode) → bool
│  └─ Error Management:
│     ├─ getTokenErrors(string tokenCode) → uint256
│     └─ resetTokenErrors(string tokenCode)
├─ Called BY (incoming):
│  ├─ ValueCalculator → getActiveTokens(), getTokenAddress(), getTokenPriceWithEvents(), getTokenPrice(), getTokenInfo()
│  ├─ SwapManager → getTokenAddress(), isTokenActive(), getTokenInfo()
│  ├─ EmergencyHandler → getActiveTokens(), getTokenAddress()
│  └─ Owner → manageTokenData(), removeToken(), updateHeartbeat()
└─ Calls TO (outgoing):
   ├─ Beacon.getImplementation("WETH") [in manageTokenData - WETH exclusion check]
   ├─ Chainlink.AggregatorV3Interface.latestRoundData() [EXTERNAL]
   └─ Chainlink.AggregatorV3Interface.decimals() [EXTERNAL]

═══════════════════════════════════════════════════════════════════

MODULE 4: VALUECALCULATOR (Value Calculations + Cache)
├─ Public Functions:
│  ├─ Value Calculations:
│  │  ├─ calculateTokenValue(string tokenCode) → uint256
│  │  ├─ calculateTokenValueView(string tokenCode) → uint256 [view]
│  │  ├─ getTotalPoolValue() → PoolValueInfo
│  │  └─ getTotalPoolValueView() → uint256 [view]
│  ├─ Cache Management:
│  │  ├─ getCachedTokenValue(tokenCode) → (value, isValid)
│  │  ├─ getCachedTokenPrice(tokenCode) → (price, isValid)
│  │  ├─ invalidateCache(string tokenCode)
│  │  └─ invalidateAllCache()
│  └─ Utility:
│     ├─ getTokenValueInfo(string tokenCode) → TokenValueInfo
│     ├─ selectTokenForSwap(uint256 targetValue) → (tokenCode, amount)
│     └─ validatePoolValue() → (isValid, errorReason)
├─ Called BY (incoming):
│  ├─ LiquidityManager → getTotalPoolValue(), getTotalPoolValueView(), selectTokenForSwap()
│  ├─ EmergencyHandler → getTotalPoolValueView()
│  └─ UI/Dashboard → calculateTokenValueView(), getTotalPoolValueView()
└─ Calls TO (outgoing):
   ├─ Beacon.getImplementation("TokenManager")
   ├─ Beacon.getImplementation("ProxyGeneral")
   ├─ Beacon.getImplementation("WETH")
   ├─ TokenManager.getActiveTokens()
   ├─ TokenManager.getTokenAddress(tokenCode)
   ├─ TokenManager.getTokenPriceWithEvents(tokenCode)
   ├─ TokenManager.getTokenPrice(tokenCode)
   ├─ TokenManager.getTokenInfo(tokenCode)
   ├─ ProxyGeneral (via IERC20).balanceOf(proxyGeneral) [for each token]
   └─ WETH (via IWETH).balanceOf(proxyGeneral)

═══════════════════════════════════════════════════════════════════

MODULE 5: LIQUIDITYMANAGER (Deposit/Withdraw Logic)
├─ Public Functions:
│  ├─ Deposit Operations:
│  │  ├─ deposit() payable → uint256 lpTokens
│  │  └─ calculateDepositShares(uint256 ethAmount) → uint256
│  ├─ Withdraw Operations:
│  │  ├─ withdraw(uint256 lpTokenAmount) → uint256 ethReceived
│  │  └─ calculateWithdrawAmount(uint256 lpTokens) → uint256
│  ├─ Withdraw Limits:
│  │  ├─ setWithdrawLimits(hourly, daily, min, max)
│  │  ├─ checkWithdrawLimits(user, amount) → (canWithdraw, reason)
│  │  ├─ getRemainingHourlyLimit(address user) → uint256
│  │  └─ getRemainingDailyLimit(address user) → uint256
│  ├─ Fee Management:
│  │  ├─ setDepositFee(uint256 newFee)
│  │  ├─ setWithdrawFee(uint256 newFee)
│  │  └─ setFeeRecipient(address newRecipient)
│  └─ State Management:
│     ├─ setDepositsEnabled(bool enabled)
│     └─ setWithdrawsEnabled(bool enabled)
├─ Called BY (incoming):
│  ├─ Users → deposit(), withdraw()
│  ├─ UI → calculateDepositShares(), calculateWithdrawAmount(), getRemainingHourlyLimit(), getRemainingDailyLimit()
│  └─ Owner → setWithdrawLimits(), setDepositFee(), setWithdrawFee(), setFeeRecipient(), setDepositsEnabled(), setWithdrawsEnabled()
└─ Calls TO (outgoing):
   ├─ Beacon.getImplementation("ProxyGeneral")
   ├─ Beacon.getImplementation("ValueCalculator")
   ├─ Beacon.getImplementation("SwapManager")
   ├─ Beacon.getImplementation("WETH")
   ├─ ProxyGeneral.mint(user, lpTokens)
   ├─ ProxyGeneral.burn(user, lpTokenAmount)
   ├─ ProxyGeneral.totalSupply()
   ├─ ProxyGeneral.balanceOf(user)
   ├─ ProxyGeneral.isPaused()
   ├─ ProxyGeneral.getHourlyWithdrawn(user, hour)
   ├─ ProxyGeneral.incrementHourlyWithdrawn(user, amount)
   ├─ ProxyGeneral.transferFunds(recipient, asset, amount)
   ├─ ValueCalculator.getTotalPoolValue()
   ├─ ValueCalculator.getTotalPoolValueView()
   ├─ ValueCalculator.selectTokenForSwap(targetValue)
   ├─ SwapManager.swapTokenForWETH(tokenCode, amountIn, minOut)
   ├─ WETH.deposit{value}()
   ├─ WETH.withdraw(amount)
   ├─ WETH.balanceOf(proxyGeneral)
   └─ WETH.transfer(recipient, amount)

═══════════════════════════════════════════════════════════════════

MODULE 6: SWAPMANAGER (DEX Integration)
├─ Public Functions:
│  ├─ Swap Operations:
│  │  └─ swapTokenForWETH(tokenCode, amountIn, minAmountOut) → uint256
│  ├─ Quote Functions:
│  │  ├─ getSwapQuote(tokenCode, amountIn) → uint256
│  │  └─ calculateMinAmountOut(tokenCode, amountIn) → uint256
│  ├─ Configuration:
│  │  ├─ setSimpleSwapRouter(address newRouter)
│  │  ├─ setMaxSlippage(uint256 newSlippage)
│  │  └─ setSwapsEnabled(bool enabled)
│  └─ Statistics:
│     └─ getSwapStats(string tokenCode) → (count, totalAmount)
├─ Called BY (incoming):
│  ├─ LiquidityManager → swapTokenForWETH() [during withdraw if WETH insufficient]
│  ├─ UI → getSwapQuote(), calculateMinAmountOut(), getSwapStats()
│  └─ Owner → setSimpleSwapRouter(), setMaxSlippage(), setSwapsEnabled()
└─ Calls TO (outgoing):
   ├─ Beacon.getImplementation("ProxyGeneral")
   ├─ Beacon.getImplementation("TokenManager")
   ├─ Beacon.getImplementation("WETH")
   ├─ ProxyGeneral.isPaused()
   ├─ ProxyGeneral.approveSpender(token, simpleSwapRouter, amount)
   ├─ TokenManager.isTokenActive(tokenCode)
   ├─ TokenManager.getTokenAddress(tokenCode)
   ├─ TokenManager.getTokenInfo(tokenCode)
   ├─ IERC20(token).balanceOf(proxyGeneral) [pre/post swap verification]
   ├─ IERC20(weth).balanceOf(proxyGeneral) [pre/post swap verification]
   ├─ SimpleSwap.getAmountOut(tokenIn, tokenOut, amountIn) [EXTERNAL - quote]
   └─ SimpleSwap.swap(tokenIn, tokenOut, amountIn, minOut, recipient) [EXTERNAL - execution]

═══════════════════════════════════════════════════════════════════

MODULE 7: EMERGENCYHANDLER (Emergency Procedures)
├─ Public Functions:
│  ├─ Emergency Operations:
│  │  ├─ triggerEmergencyPause(string reason)
│  │  ├─ unpause()
│  │  └─ emergencyWithdraw(address recipient)
│  ├─ Emergency Contacts:
│  │  ├─ addEmergencyContact(address contact)
│  │  ├─ removeEmergencyContact(address contact)
│  │  └─ isAuthorizedForEmergency(address account) → bool
│  ├─ Configuration:
│  │  └─ setUnpauseTimelock(uint256 newTimelock)
│  └─ Status Queries:
│     ├─ getEmergencyState() → EmergencyState
│     ├─ canUnpause() → (bool, reason)
│     └─ getSystemHealthStatus() → (isPaused, totalValue, lpSupply, tokens[])
├─ Called BY (incoming):
│  ├─ Owner/Emergency Contacts → triggerEmergencyPause(), unpause(), emergencyWithdraw()
│  ├─ Owner → addEmergencyContact(), removeEmergencyContact(), setUnpauseTimelock()
│  └─ UI/Monitoring → getEmergencyState(), canUnpause(), getSystemHealthStatus()
└─ Calls TO (outgoing):
   ├─ Beacon.getImplementation("ProxyGeneral")
   ├─ Beacon.getImplementation("TokenManager")
   ├─ Beacon.getImplementation("ValueCalculator")
   ├─ Beacon.getImplementation("WETH")
   ├─ ProxyGeneral.pause()
   ├─ ProxyGeneral.unpause()
   ├─ ProxyGeneral.isPaused()
   ├─ ProxyGeneral.emergencyTransferAll(recipient)
   ├─ ProxyGeneral.totalSupply()
   ├─ TokenManager.getActiveTokens()
   ├─ TokenManager.getTokenAddress(tokenCode)
   ├─ ValueCalculator.getTotalPoolValueView()
   ├─ IERC20(weth).balanceOf(proxyGeneral)
   └─ IERC20(token).balanceOf(proxyGeneral) [for each active token]

═══════════════════════════════════════════════════════════════════

MODULE 8: PARAMETERMANAGER (System Configuration)
├─ Public Functions:
│  ├─ Parameter Management:
│  │  ├─ registerParameter(name, initialValue, min, max, requiresTimelock)
│  │  ├─ proposeParameterChange(name, newValue)
│  │  ├─ executeParameterChange(name)
│  │  └─ emergencySetParameter(name, newValue)
│  ├─ Queries:
│  │  ├─ getCurrentParameterValue(string name) → uint256
│  │  ├─ getParameterInfo(string name) → Parameter
│  │  ├─ getParameterHistory(string name) → ParameterHistory[]
│  │  └─ getAllParameters() → (names[], values[])
│  ├─ Validation:
│  │  └─ canExecuteParameterChange(name) → (bool, reason)
│  └─ Configuration:
│     └─ setParameterTimelock(uint256 newTimelock)
├─ Called BY (incoming):
│  ├─ All modules (read) → getCurrentParameterValue(paramName)
│  ├─ Owner → registerParameter(), proposeParameterChange(), executeParameterChange(), emergencySetParameter(), setParameterTimelock()
│  └─ UI/Governance → getParameterInfo(), getParameterHistory(), getAllParameters(), canExecuteParameterChange()
└─ Calls TO (outgoing):
   ├─ Beacon.getImplementation("ProxyGeneral")
   └─ ProxyGeneral.isPaused() [for emergencySetParameter validation]

═══════════════════════════════════════════════════════════════════

EXTERNAL INTEGRATIONS (Outside System):
├─ Chainlink Price Feeds (Oracle Network):
│  └─ Called by TokenManager:
│     ├─ AggregatorV3Interface.latestRoundData() → (roundId, price, timestamp, answeredInRound)
│     └─ AggregatorV3Interface.decimals() → uint8
├─ SimpleSwap DEX (Third-party Router):
│  └─ Called by SwapManager:
│     ├─ SimpleSwap.getAmountOut(tokenIn, tokenOut, amountIn) → uint256 [quote]
│     └─ SimpleSwap.swap(tokenIn, tokenOut, amountIn, minOut, recipient) → uint256 [execute]
├─ WETH Contract (Wrapped Ether):
│  └─ Called by LiquidityManager, ValueCalculator, EmergencyHandler:
│     ├─ WETH.deposit{value}() [ETH → WETH]
│     ├─ WETH.withdraw(amount) [WETH → ETH]
│     ├─ WETH.balanceOf(account) → uint256
│     └─ WETH.transfer(to, amount) → bool
└─ User Wallets (EOAs):
   └─ Call LiquidityManager:
      ├─ deposit() payable [ETH deposits]
      └─ withdraw(lpTokenAmount) [LP token redemption]

═══════════════════════════════════════════════════════════════════

CRITICAL FUNCTION CALL FLOWS:

FLOW 1: USER DEPOSIT
User → LiquidityManager.deposit{value: ETH}()
  ├─> Beacon.getImplementation("ProxyGeneral")
  ├─> Beacon.getImplementation("WETH")
  ├─> Beacon.getImplementation("ValueCalculator")
  ├─> WETH.deposit{value: netDeposit}()
  ├─> LiquidityManager.calculateDepositShares(netDeposit)
  │   ├─> ProxyGeneral.totalSupply()
  │   └─> ValueCalculator.getTotalPoolValueView()
  │       ├─> TokenManager.getActiveTokens()
  │       ├─> TokenManager.getTokenAddress()
  │       ├─> IERC20.balanceOf(proxyGeneral)
  │       └─> WETH.balanceOf(proxyGeneral)
  └─> ProxyGeneral.mint(user, lpTokens)

FLOW 2: USER WITHDRAW (with automatic swap)
User → LiquidityManager.withdraw(lpTokenAmount)
  ├─> Beacon.getImplementation("ProxyGeneral")
  ├─> Beacon.getImplementation("WETH")
  ├─> Beacon.getImplementation("ValueCalculator")
  ├─> Beacon.getImplementation("SwapManager")
  ├─> ProxyGeneral.balanceOf(user)
  ├─> ProxyGeneral.isPaused()
  ├─> LiquidityManager.calculateWithdrawAmount(lpTokenAmount)
  │   ├─> ProxyGeneral.totalSupply()
  │   └─> ValueCalculator.getTotalPoolValueView()
  ├─> LiquidityManager.checkWithdrawLimits(user, ethAmount)
  │   └─> ProxyGeneral.getHourlyWithdrawn(user, hour)
  ├─> ProxyGeneral.burn(user, lpTokenAmount)
  ├─> ProxyGeneral.incrementHourlyWithdrawn(user, ethAmount)
  ├─> WETH.balanceOf(proxyGeneral)
  ├─> IF (wethBalance < netWithdraw):
  │   └─> LiquidityManager._swapTokensForWETH(shortfall)
  │       ├─> ValueCalculator.selectTokenForSwap(targetValue)
  │       │   ├─> ValueCalculator.getTotalPoolValueView()
  │       │   └─> TokenManager.getTokenInfo(selectedToken)
  │       └─> SwapManager.swapTokenForWETH(tokenCode, amountIn, minOut)
  │           ├─> TokenManager.isTokenActive(tokenCode)
  │           ├─> TokenManager.getTokenAddress(tokenCode)
  │           ├─> ProxyGeneral.approveSpender(token, simpleSwap, amount)
  │           ├─> SimpleSwap.getAmountOut(token, weth, amountIn) [EXTERNAL]
  │           ├─> SimpleSwap.swap(token, weth, amountIn, minOut, proxyGeneral) [EXTERNAL]
  │           └─> IERC20.balanceOf() [verification]
  ├─> ProxyGeneral.transferFunds(liquidityManager, weth, netWithdraw)
  ├─> WETH.withdraw(netWithdraw)
  └─> user.call{value: netWithdraw}()

FLOW 3: EMERGENCY PAUSE
EmergencyContact → EmergencyHandler.triggerEmergencyPause(reason)
  ├─> Beacon.getImplementation("ProxyGeneral")
  └─> ProxyGeneral.pause()
      └─> [ALL modules check isPaused() before operations]

FLOW 4: PRICE UPDATE & VALUE CALCULATION
ValueCalculator.calculateTokenValue(tokenCode) [triggered by getTotalPoolValue]
  ├─> Beacon.getImplementation("TokenManager")
  ├─> Beacon.getImplementation("ProxyGeneral")
  ├─> TokenManager.getTokenPriceWithEvents(tokenCode)
  │   └─> TokenManager.getTokenPrice(tokenCode)
  │       └─> Chainlink.latestRoundData() [EXTERNAL]
  ├─> TokenManager.getTokenAddress(tokenCode)
  ├─> TokenManager.getTokenInfo(tokenCode)
  ├─> IERC20(token).balanceOf(proxyGeneral)
  └─> [cache updated internally]

═══════════════════════════════════════════════════════════════════

DIAGRAM REQUIREMENTS:
1. Every module shown as a separate box with ALL functions listed
2. Every arrow labeled with specific function name (not just "calls")
3. Different arrow colors for:
   - Read operations (blue)
   - Write operations (red)
   - External calls (orange)
   - Emergency operations (dark red)
4. Group similar functions within modules (e.g., "LP Token Management", "Price Feeds")
5. Show data flow direction clearly
6. Highlight critical paths (deposit flow, withdraw flow, emergency flow)
7. Include external integrations (Chainlink, SimpleSwap, WETH, Users)
8. Use legends to explain arrow types and colors
9. Show function parameters and return types on hover/annotation
10. Indicate access control (onlyOwner, onlyAuthorizedModule, public)

GENERATE: A production-ready, function-level architecture diagram suitable for technical documentation and developer onboarding.