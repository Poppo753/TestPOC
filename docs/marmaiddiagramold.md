%%{init: {
  "theme": "dark",
  "fontFamily": "Inter, Roboto, Arial",
  "themeVariables": {
    "edgeLabelBackground": "#0f172a",
    "tertiaryBorderColor": "#334155"
  },
  "flowchart": {
    "defaultRenderer": "elk",
    "curve": "linear",
    "nodeSpacing": 70,
    "rankSpacing": 120,
    "htmlLabels": true,
    "padding": 12,
    "useMaxWidth": false,
    "wrappingWidth": 180
  }
}}%%

graph TD

%% ===== Legend =====
subgraph Legend [Legend]
direction TB
L1["Direct call  -->"]
L2["Read/View   -.->"]
L3["CRITICAL = giallo spesso"]
L4["EXTERNAL = blu tratteggiato"]
L5["Beacon.getImplementation = viola"]
end

%% ===== MODULES =====
subgraph Beacon
direction TB
  B_getImpl["getImplementation(moduleName) -> address"]
  B_updateImpl["updateImplementation(name, addr)"]
  B_transferOwn["transferOwnership(newOwner)"]
  B_acceptOwn["acceptOwnership()"]
end

subgraph ProxyGeneral
direction TB
  PG_mint["mint(to, amount)"]
  PG_burn["burn(from, amount)"]
  PG_transfer["transferFunds(to, asset, amt)"]
  PG_balance["balanceOf(account) -> uint256"]
  PG_supply["totalSupply() -> uint256"]
  PG_approve["approveSpender(token, spender, amt)"]
  PG_pause["pause()"]
  PG_unpause["unpause()"]
  PG_isPaused["isPaused() -> bool"]
  PG_emergency["emergencyTransferAll(recipient)"]
  PG_hourly["getHourlyWithdrawn(user, hour) -> uint256"]
  PG_incHourly["incrementHourlyWithdrawn(user, amt)"]
  PG_authorize["authorizeModule(module)"]
  PG_isAuth["isAuthorizedModule(module) -> bool"]
end

subgraph TokenManager
direction TB
  TM_manage["manageTokenData(...)"]
  TM_remove["removeToken(code)"]
  TM_isActive["isTokenActive(code) -> bool"]
  TM_getAddr["getTokenAddress(code) -> address"]
  TM_getInfo["getTokenInfo(code) -> TokenInfo"]
  TM_getActive["getActiveTokens() -> string[]"]
  TM_getPrice["getTokenPrice(code) -> price time stale"]
  TM_getPriceEvent["getTokenPriceWithEvents(code) -> price time"]
end

subgraph ValueCalculator
direction TB
  VC_calcValue["calculateTokenValue(code) -> uint256"]
  VC_calcView["calculateTokenValueView(code) -> uint256"]
  VC_totalPool["getTotalPoolValue() -> PoolValueInfo"]
  VC_totalView["getTotalPoolValueView() -> uint256"]
  VC_selectSwap["selectTokenForSwap(target) -> code amt"]
  VC_getCached["getCachedTokenValue(code) -> val valid"]
  VC_invalidate["invalidateCache(code)"]
end

subgraph LiquidityManager
direction TB
  LM_deposit["deposit() payable -> uint256"]
  LM_calcDeposit["calculateDepositShares(eth) -> uint256"]
  LM_withdraw["withdraw(lpTokens) -> uint256"]
  LM_calcWithdraw["calculateWithdrawAmount(lp) -> uint256"]
  LM_checkLimits["checkWithdrawLimits(user, amt) -> bool reason"]
  LM_remainHourly["getRemainingHourlyLimit(user) -> uint256"]
  LM_setLimits["setWithdrawLimits(...)"]
  LM_setFee["setDepositFee(fee)"]
end

subgraph SwapManager
direction TB
  SM_swap["swapTokenForWETH(code, amtIn, minOut) -> uint256"]
  SM_quote["getSwapQuote(code, amtIn) -> uint256"]
  SM_calcMin["calculateMinAmountOut(code, amtIn) -> uint256"]
  SM_setRouter["setSimpleSwapRouter(router)"]
  SM_setSlippage["setMaxSlippage(slippage)"]
  SM_stats["getSwapStats(code) -> count total"]
end

subgraph EmergencyHandler
direction TB
  EH_pause["triggerEmergencyPause(reason)"]
  EH_unpause["unpause()"]
  EH_withdraw["emergencyWithdraw(recipient)"]
  EH_addContact["addEmergencyContact(contact)"]
  EH_canUnpause["canUnpause() -> bool reason"]
  EH_health["getSystemHealthStatus() -> ..."]
end

subgraph ParameterManager
direction TB
  PM_register["registerParameter(...)"]
  PM_propose["proposeParameterChange(name, val)"]
  PM_execute["executeParameterChange(name)"]
  PM_emergency["emergencySetParameter(name, val)"]
  PM_getValue["getCurrentParameterValue(name) -> uint256"]
  PM_getInfo["getParameterInfo(name) -> Parameter"]
  PM_getHistory["getParameterHistory(name) -> History[]"]
end

%% ===== EXTERNALS =====
subgraph Externals
direction TB
  WETH_deposit["WETH.deposit value eth"]
  WETH_withdraw["WETH.withdraw amt"]
  WETH_balance["WETH.balanceOf(account) -> uint256"]
  IERC20_balance["ERC20.balanceOf(account) -> uint256"]
  SimpleSwap_getAmountOut["SimpleSwap.getAmountOut tokenIn amtIn -> uint256"]
  SimpleSwap_swap["SimpleSwap.swap tokenIn tokenOut amtIn minOut -> uint256"]
  Chainlink_latestRoundData["Chainlink.latestRoundData feed -> answer updatedAt"]
end

%% ===== CONNECTIONS (ordine fisso) =====
%% Liquidity: deposit
LM_deposit -->|getImplementation| B_getImpl
LM_deposit -->|EXTERNAL WETH deposit| WETH_deposit
LM_deposit -->|calculateDepositShares| LM_calcDeposit
LM_calcDeposit -.->|totalSupply| PG_supply
LM_calcDeposit -.->|getTotalPoolValueView| VC_totalView
LM_deposit -->|CRITICAL mint| PG_mint

%% Liquidity: withdraw
LM_withdraw -->|getImplementation| B_getImpl
LM_withdraw -.->|balanceOf| PG_balance
LM_withdraw -.->|isPaused| PG_isPaused
LM_withdraw -->|calculateWithdrawAmount| LM_calcWithdraw
LM_calcWithdraw -.->|totalSupply| PG_supply
LM_calcWithdraw -.->|getTotalPoolValueView| VC_totalView
LM_withdraw -->|checkWithdrawLimits| LM_checkLimits
LM_checkLimits -.->|getHourlyWithdrawn| PG_hourly
LM_checkLimits -.->|getRemainingHourlyLimit| LM_remainHourly
LM_checkLimits -.->|getCurrentParameterValue hourlyLimit| PM_getValue
LM_withdraw -->|CRITICAL burn| PG_burn
LM_withdraw -->|incrementHourlyWithdrawn| PG_incHourly
LM_withdraw -.->|WETH balanceOf| WETH_balance
LM_withdraw -->|selectTokenForSwap| VC_selectSwap
LM_withdraw -->|CRITICAL swapTokenForWETH| SM_swap
LM_withdraw -->|transferFunds| PG_transfer
LM_withdraw -->|EXTERNAL WETH withdraw| WETH_withdraw

%% Swap
SM_swap -->|getImplementation| B_getImpl
SM_swap -.->|isPaused| PG_isPaused
SM_swap -.->|isTokenActive| TM_isActive
SM_swap -.->|getTokenAddress| TM_getAddr
SM_swap -->|approveSpender| PG_approve
SM_swap -->|EXTERNAL getAmountOut| SimpleSwap_getAmountOut
SM_swap -->|EXTERNAL swap| SimpleSwap_swap
SM_quote -.->|isTokenActive| TM_isActive
SM_quote -.->|getTokenAddress| TM_getAddr
SM_quote -->|EXTERNAL getAmountOut| SimpleSwap_getAmountOut
SM_calcMin -.->|getCurrentParameterValue maxSlippage| PM_getValue
SM_calcMin -.->|getTokenPrice| TM_getPrice
SM_setRouter -->|setSimpleSwapRouter| SM_setRouter
SM_setSlippage -->|setMaxSlippage| SM_setSlippage
SM_stats -.->|getSwapStats| SM_stats

%% Value calc
VC_calcValue -->|getImplementation| B_getImpl
VC_calcValue -.->|getCachedTokenValue| VC_getCached
VC_calcValue -->|getTokenPriceWithEvents| TM_getPriceEvent
VC_calcValue -.->|getTokenAddress| TM_getAddr
VC_calcValue -.->|getTokenInfo| TM_getInfo
VC_calcValue -.->|ERC20 balanceOf| IERC20_balance

VC_calcView -.->|getCachedTokenValue| VC_getCached
VC_calcView -.->|getTokenPrice| TM_getPrice
VC_calcView -.->|getTokenAddress| TM_getAddr
VC_calcView -.->|ERC20 balanceOf| IERC20_balance

VC_totalPool -->|getImplementation| B_getImpl
VC_totalPool -.->|WETH balanceOf| WETH_balance
VC_totalPool -->|getActiveTokens| TM_getActive
VC_totalPool -->|CRITICAL calculateTokenValue| VC_calcValue
VC_totalPool -.->|getTokenAddress| TM_getAddr
VC_totalPool -.->|ERC20 balanceOf| IERC20_balance

VC_totalView -.->|getActiveTokens| TM_getActive
VC_totalView -.->|calculateTokenValueView| VC_calcView

VC_selectSwap -.->|getTotalPoolValueView| VC_totalView
VC_selectSwap -.->|getTokenInfo| TM_getInfo
VC_selectSwap -.->|getTokenAddress| TM_getAddr
VC_selectSwap -.->|ERC20 balanceOf| IERC20_balance

VC_invalidate -->|invalidateCache| VC_invalidate

%% TokenManager
TM_manage -->|getImplementation| B_getImpl
TM_manage -->|EXTERNAL latestRoundData| Chainlink_latestRoundData
TM_getPriceEvent -->|getTokenPrice| TM_getPrice
TM_getPrice -->|EXTERNAL latestRoundData| Chainlink_latestRoundData

%% Emergency
EH_pause -->|getImplementation| B_getImpl
EH_pause -->|CRITICAL pause| PG_pause
EH_unpause -->|CRITICAL unpause| PG_unpause
EH_withdraw -->|getImplementation| B_getImpl
EH_withdraw -->|CRITICAL emergencyTransferAll| PG_emergency
EH_health -.->|isPaused| PG_isPaused
EH_health -.->|totalSupply| PG_supply
EH_health -.->|getTotalPoolValueView| VC_totalView
EH_health -.->|getActiveTokens| TM_getActive
EH_canUnpause -.->|isPaused| PG_isPaused

%% Parameters
PM_emergency -->|getImplementation| B_getImpl
PM_emergency -.->|isPaused| PG_isPaused
PM_register -->|registerParameter| PM_register
PM_propose -->|proposeParameterChange| PM_propose
PM_execute -->|executeParameterChange| PM_execute
PM_execute -.->|getParameterInfo| PM_getInfo
PM_getValue -->|getCurrentParameterValue| PM_getValue
PM_getHistory -->|getParameterHistory| PM_getHistory

%% ProxyGeneral (auth)
PG_authorize -.->|getImplementation| B_getImpl
PG_isAuth -.->|isAuthorizedModule| PG_isAuth

%% ===== COLORI MODULI =====
classDef beacon fill:#9f6ef2,stroke:#7c3aed,color:#fff
classDef proxy fill:#f59e0b,stroke:#d97706,color:#fff
classDef token fill:#10b981,stroke:#059669,color:#fff
classDef value fill:#06b6d4,stroke:#0891b2,color:#fff
classDef liquidity fill:#3b82f6,stroke:#2563eb,color:#fff
classDef swap fill:#ef4444,stroke:#dc2626,color:#fff
classDef emergency fill:#f97316,stroke:#ea580c,color:#fff
classDef parameter fill:#8b5cf6,stroke:#7c3aed,color:#fff
classDef external fill:#94a3b8,stroke:#475569,color:#111

class B_getImpl,B_updateImpl,B_transferOwn,B_acceptOwn beacon
class PG_mint,PG_burn,PG_transfer,PG_balance,PG_supply,PG_approve,PG_pause,PG_unpause,PG_isPaused,PG_emergency,PG_hourly,PG_incHourly,PG_authorize,PG_isAuth proxy
class TM_manage,TM_remove,TM_isActive,TM_getAddr,TM_getInfo,TM_getActive,TM_getPrice,TM_getPriceEvent token
class VC_calcValue,VC_calcView,VC_totalPool,VC_totalView,VC_selectSwap,VC_getCached,VC_invalidate value
class LM_deposit,LM_calcDeposit,LM_withdraw,LM_calcWithdraw,LM_checkLimits,LM_remainHourly,LM_setLimits,LM_setFee liquidity
class SM_swap,SM_quote,SM_calcMin,SM_setRouter,SM_setSlippage,SM_stats swap
class EH_pause,EH_unpause,EH_withdraw,EH_addContact,EH_canUnpause,EH_health emergency
class PM_register,PM_propose,PM_execute,PM_emergency,PM_getValue,PM_getInfo,PM_getHistory parameter
class WETH_deposit,WETH_withdraw,WETH_balance,IERC20_balance,SimpleSwap_getAmountOut,SimpleSwap_swap,Chainlink_latestRoundData external

%% ===== STILI LINK (indici fissi) =====
%% CRITICAL (giallo, spesso)
linkStyle 6 stroke:#facc15,stroke-width:3px
linkStyle 17 stroke:#facc15,stroke-width:3px
linkStyle 21 stroke:#facc15,stroke-width:3px
linkStyle 52 stroke:#facc15,stroke-width:3px
linkStyle 67 stroke:#facc15,stroke-width:3px
linkStyle 68 stroke:#facc15,stroke-width:3px
linkStyle 70 stroke:#facc15,stroke-width:3px

%% EXTERNAL (blu, tratteggiato)
linkStyle 2 stroke:#60a5fa,stroke-width:2.5px,stroke-dasharray:5 3
linkStyle 23 stroke:#60a5fa,stroke-width:2.5px,stroke-dasharray:5 3
linkStyle 29 stroke:#60a5fa,stroke-width:2.5px,stroke-dasharray:5 3
linkStyle 30 stroke:#60a5fa,stroke-width:2.5px,stroke-dasharray:5 3
linkStyle 33 stroke:#60a5fa,stroke-width:2.5px,stroke-dasharray:5 3
linkStyle 63 stroke:#60a5fa,stroke-width:2.5px,stroke-dasharray:5 3
linkStyle 65 stroke:#60a5fa,stroke-width:2.5px,stroke-dasharray:5 3

%% READ/VIEW (grigio, tratteggiato)
linkStyle 3  stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 4  stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 9  stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 10 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 12 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 14 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 15 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 19 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 24 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 25 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 27 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 28 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 31 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 34 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 35 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 36 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 38 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 39 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 41 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 42 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 44 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 45 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 46 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 47 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 48 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 49 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 50 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 54 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 55 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 56 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 57 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 58 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 59 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 61 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 62 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 64 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3
linkStyle 69 stroke:#9ca3af,stroke-width:2px,stroke-dasharray:4 3

%% Beacon.getImplementation (viola)
linkStyle 0  stroke:#a78bfa,stroke-width:2.5px
linkStyle 11 stroke:#a78bfa,stroke-width:2.5px
linkStyle 32 stroke:#a78bfa,stroke-width:2.5px
linkStyle 40 stroke:#a78bfa,stroke-width:2.5px
linkStyle 51 stroke:#a78bfa,stroke-width:2.5px
linkStyle 60 stroke:#a78bfa,stroke-width:2.5px
linkStyle 66 stroke:#a78bfa,stroke-width:2.5px
linkStyle 72 stroke:#a78bfa,stroke-width:2.5px
linkStyle 78 stroke:#a78bfa,stroke-width:2.5px
