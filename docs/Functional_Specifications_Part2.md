# 📋 SPECIFICHE FUNZIONALI COMPLETE - MODULI DEFI
## Blueprint Implementazione Dettagliato - PARTE 2 (4/8 Moduli)

*Documento di riferimento completo per implementazione di ogni modulo*

---

## 🎯 **MODULI PARTE 2**

**Moduli Parte 2:**
1. [LiquidityManager](#liquiditymanager-gestione-liquidità)
2. [SwapManager](#swapmanager-gestione-swap)
3. [EmergencyHandler](#emergencyhandler-gestione-emergenze)
4. [ParameterManager](#parametermanager-gestione-parametri)

---

## 💧 **LIQUIDITYMANAGER (Gestione Liquidità)**

### **Ruolo e Responsabilità**
- **Gestione deposit** ETH → LP tokens con wrap automatico in WETH
- **Gestione withdraw** LP tokens → ETH con unwrap WETH
- **Logica di swap automatico** quando WETH insufficiente per withdraw
- **Calcolo shares LP** basato su valore totale pool
- **Rate limiting** per withdraw (limiti orari/giornalieri)
- **Fee management** (deposit/withdraw fees)

### **Storage Requirements**

#### **State Variables**
```solidity
struct WithdrawLimits {
    uint256 hourlyLimit;      // Limite per ora (in ETH)
    uint256 dailyLimit;       // Limite per giorno (in ETH)
    uint256 minWithdraw;      // Minimo withdraw
    uint256 maxWithdraw;      // Massimo withdraw per transazione
}

WithdrawLimits public withdrawLimits;

// Fee structure
uint256 public depositFee;        // Basis points (10000 = 100%)
uint256 public withdrawFee;       // Basis points
uint256 public constant MAX_FEE = 500; // 5% max fee

// Minimum amounts
uint256 public minDepositAmount;
uint256 public minWithdrawAmount;

address public immutable beacon;
address public feeRecipient;

// Emergency state
bool public depositsEnabled;
bool public withdrawsEnabled;
```

### **Interfacce Required**

#### **Interfacce Esterne (Input)**
```solidity
interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}

interface IProxyGeneral {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function getAssetBalance(address asset) external view returns (uint256);
    function transferFunds(address to, address asset, uint256 amount) external;
    function isPaused() external view returns (bool);
    function getHourlyWithdrawn(address user, uint256 hour) external view returns (uint256);
    function incrementHourlyWithdrawn(address user, uint256 amount) external;
}

interface IValueCalculator {
    function getTotalPoolValue() external returns (PoolValueInfo memory);
    function getTotalPoolValueView() external view returns (uint256);
    function selectTokenForSwap(uint256 targetValue) external view returns (string memory tokenCode, uint256 amount);
}

interface ISwapManager {
    function swapTokenForWETH(
        string memory tokenCode,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);
}

interface IParameterManager {
    function getCurrentParameterValue(string memory parameterName) external view returns (uint256);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}
```

#### **Interfacce Esposte (Output)**
```solidity
interface ILiquidityManager {
    // Deposit Operations
    function deposit() external payable returns (uint256 lpTokens);
    function calculateDepositShares(uint256 ethAmount) external view returns (uint256 shares);
    
    // Withdraw Operations
    function withdraw(uint256 lpTokenAmount) external returns (uint256 ethReceived);
    function calculateWithdrawAmount(uint256 lpTokens) external view returns (uint256 ethAmount);
    
    // Withdraw Limits
    function setWithdrawLimits(
        uint256 hourlyLimit,
        uint256 dailyLimit,
        uint256 minWithdraw,
        uint256 maxWithdraw
    ) external;
    function checkWithdrawLimits(address user, uint256 amount) external view returns (bool canWithdraw, string memory reason);
    function getRemainingHourlyLimit(address user) external view returns (uint256);
    function getRemainingDailyLimit(address user) external view returns (uint256);
    
    // Fee Management
    function setDepositFee(uint256 newFee) external;
    function setWithdrawFee(uint256 newFee) external;
    function setFeeRecipient(address newRecipient) external;
    
    // State Management
    function setDepositsEnabled(bool enabled) external;
    function setWithdrawsEnabled(bool enabled) external;
}
```

### **Funzioni Core**

#### **1. Deposit Logic**
```solidity
function deposit() external payable nonReentrant returns (uint256 lpTokens) {
    // VALIDAZIONI CRITICHE:
    require(depositsEnabled, "Deposits are disabled");
    require(msg.value > 0, "Cannot deposit zero ETH");
    require(msg.value >= minDepositAmount, "Below minimum deposit");
    
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    require(!proxyGeneral.isPaused(), "System is paused");
    
    // CALCOLO FEE
    uint256 feeAmount = (msg.value * depositFee) / 10000;
    uint256 netDeposit = msg.value - feeAmount;
    
    // WRAP ETH → WETH
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    IWETH weth = IWETH(wethAddress);
    
    // Wrap net deposit amount
    weth.deposit{value: netDeposit}();
    
    // Transfer fee to recipient if applicable
    if (feeAmount > 0 && feeRecipient != address(0)) {
        (bool success, ) = feeRecipient.call{value: feeAmount}("");
        require(success, "Fee transfer failed");
    }
    
    // CALCOLO LP TOKENS
    lpTokens = calculateDepositShares(netDeposit);
    require(lpTokens > 0, "LP tokens amount is zero");
    
    // MINT LP TOKENS
    proxyGeneral.mint(msg.sender, lpTokens);
    
    // EVENTI:
    emit Deposited(msg.sender, msg.value, netDeposit, feeAmount, lpTokens);
    
    return lpTokens;
}

function calculateDepositShares(uint256 ethAmount) public view returns (uint256 shares) {
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    uint256 totalSupply = proxyGeneral.totalSupply();
    
    if (totalSupply == 0) {
        // PRIMO DEPOSITO: 1:1 ratio
        return ethAmount;
    }
    
    // DEPOSITI SUCCESSIVI: shares proporzionali al valore pool
    IValueCalculator valueCalculator = IValueCalculator(IBeacon(beacon).getImplementation("ValueCalculator"));
    uint256 totalPoolValue = valueCalculator.getTotalPoolValueView();
    
    require(totalPoolValue > 0, "Invalid pool value");
    
    // shares = (ethAmount * totalSupply) / totalPoolValue
    shares = (ethAmount * totalSupply) / totalPoolValue;
    
    return shares;
}
```

#### **2. Withdraw Logic**
```solidity
function withdraw(uint256 lpTokenAmount) external nonReentrant returns (uint256 ethReceived) {
    // VALIDAZIONI CRITICHE:
    require(withdrawsEnabled, "Withdrawals are disabled");
    require(lpTokenAmount > 0, "Cannot withdraw zero LP tokens");
    require(lpTokenAmount >= minWithdrawAmount, "Below minimum withdraw");
    
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    require(!proxyGeneral.isPaused(), "System is paused");
    require(proxyGeneral.balanceOf(msg.sender) >= lpTokenAmount, "Insufficient LP tokens");
    
    // CALCOLO ETH DA RESTITUIRE
    uint256 ethAmount = calculateWithdrawAmount(lpTokenAmount);
    require(ethAmount > 0, "Withdraw amount is zero");
    
    // CHECK WITHDRAW LIMITS
    (bool canWithdraw, string memory reason) = checkWithdrawLimits(msg.sender, ethAmount);
    require(canWithdraw, reason);
    
    // CALCOLO FEE
    uint256 feeAmount = (ethAmount * withdrawFee) / 10000;
    uint256 netWithdraw = ethAmount - feeAmount;
    
    // BURN LP TOKENS
    proxyGeneral.burn(msg.sender, lpTokenAmount);
    
    // UPDATE RATE LIMITS
    proxyGeneral.incrementHourlyWithdrawn(msg.sender, ethAmount);
    
    // CHECK WETH BALANCE
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    IWETH weth = IWETH(wethAddress);
    uint256 wethBalance = weth.balanceOf(address(proxyGeneral));
    
    if (wethBalance < netWithdraw) {
        // INSUFFICIENT WETH → SWAP TOKEN
        uint256 shortfall = netWithdraw - wethBalance;
        _swapTokensForWETH(shortfall);
        
        // Re-check WETH balance
        wethBalance = weth.balanceOf(address(proxyGeneral));
        require(wethBalance >= netWithdraw, "Insufficient WETH after swap");
    }
    
    // TRANSFER WETH TO THIS CONTRACT
    proxyGeneral.transferFunds(address(this), wethAddress, netWithdraw);
    
    // UNWRAP WETH → ETH
    weth.withdraw(netWithdraw);
    
    // TRANSFER ETH TO USER
    (bool success, ) = msg.sender.call{value: netWithdraw}("");
    require(success, "ETH transfer failed");
    
    // TRANSFER FEE
    if (feeAmount > 0 && feeRecipient != address(0)) {
        proxyGeneral.transferFunds(feeRecipient, wethAddress, feeAmount);
    }
    
    // EVENTI:
    emit Withdrawn(msg.sender, lpTokenAmount, ethAmount, netWithdraw, feeAmount);
    
    return netWithdraw;
}

function calculateWithdrawAmount(uint256 lpTokens) public view returns (uint256 ethAmount) {
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    uint256 totalSupply = proxyGeneral.totalSupply();
    
    require(totalSupply > 0, "No LP tokens in circulation");
    
    IValueCalculator valueCalculator = IValueCalculator(IBeacon(beacon).getImplementation("ValueCalculator"));
    uint256 totalPoolValue = valueCalculator.getTotalPoolValueView();
    
    // ethAmount = (lpTokens * totalPoolValue) / totalSupply
    ethAmount = (lpTokens * totalPoolValue) / totalSupply;
    
    return ethAmount;
}
```

#### **3. Swap Logic (Internal)**
```solidity
function _swapTokensForWETH(uint256 targetWethAmount) internal {
    IValueCalculator valueCalculator = IValueCalculator(IBeacon(beacon).getImplementation("ValueCalculator"));
    ISwapManager swapManager = ISwapManager(IBeacon(beacon).getImplementation("SwapManager"));
    
    // SELECT TOKEN TO SWAP
    (string memory tokenCode, uint256 amountIn) = valueCalculator.selectTokenForSwap(targetWethAmount);
    
    // CALCULATE MIN AMOUNT OUT (98% of target for 2% slippage)
    uint256 minAmountOut = (targetWethAmount * 98) / 100;
    
    // EXECUTE SWAP
    uint256 amountOut = swapManager.swapTokenForWETH(tokenCode, amountIn, minAmountOut);
    
    emit TokenSwappedForWithdraw(tokenCode, amountIn, amountOut);
}
```

#### **4. Withdraw Limits**
```solidity
function checkWithdrawLimits(address user, uint256 amount) public view returns (bool canWithdraw, string memory reason) {
    // CHECK MIN/MAX
    if (amount < withdrawLimits.minWithdraw) {
        return (false, "Below minimum withdraw");
    }
    if (amount > withdrawLimits.maxWithdraw) {
        return (false, "Exceeds maximum withdraw");
    }
    
    // CHECK HOURLY LIMIT
    uint256 currentHour = block.timestamp / 1 hours;
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    uint256 hourlyWithdrawn = proxyGeneral.getHourlyWithdrawn(user, currentHour);
    
    if (hourlyWithdrawn + amount > withdrawLimits.hourlyLimit) {
        return (false, "Exceeds hourly limit");
    }
    
    // CHECK DAILY LIMIT
    uint256 currentDay = block.timestamp / 1 days;
    uint256 dailyWithdrawn = 0;
    
    // Sum last 24 hours
    for (uint256 i = 0; i < 24; i++) {
        uint256 hour = currentDay * 24 + i;
        dailyWithdrawn += proxyGeneral.getHourlyWithdrawn(user, hour);
    }
    
    if (dailyWithdrawn + amount > withdrawLimits.dailyLimit) {
        return (false, "Exceeds daily limit");
    }
    
    return (true, "");
}

function getRemainingHourlyLimit(address user) external view returns (uint256) {
    uint256 currentHour = block.timestamp / 1 hours;
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    uint256 withdrawn = proxyGeneral.getHourlyWithdrawn(user, currentHour);
    
    if (withdrawn >= withdrawLimits.hourlyLimit) {
        return 0;
    }
    
    return withdrawLimits.hourlyLimit - withdrawn;
}

function getRemainingDailyLimit(address user) external view returns (uint256) {
    uint256 currentDay = block.timestamp / 1 days;
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    
    uint256 dailyWithdrawn = 0;
    for (uint256 i = 0; i < 24; i++) {
        uint256 hour = currentDay * 24 + i;
        dailyWithdrawn += proxyGeneral.getHourlyWithdrawn(user, hour);
    }
    
    if (dailyWithdrawn >= withdrawLimits.dailyLimit) {
        return 0;
    }
    
    return withdrawLimits.dailyLimit - dailyWithdrawn;
}
```

#### **5. Fee Management**
```solidity
function setDepositFee(uint256 newFee) external onlyOwner {
    require(newFee <= MAX_FEE, "Fee exceeds maximum");
    
    uint256 oldFee = depositFee;
    depositFee = newFee;
    
    emit DepositFeeUpdated(oldFee, newFee);
}

function setWithdrawFee(uint256 newFee) external onlyOwner {
    require(newFee <= MAX_FEE, "Fee exceeds maximum");
    
    uint256 oldFee = withdrawFee;
    withdrawFee = newFee;
    
    emit WithdrawFeeUpdated(oldFee, newFee);
}

function setFeeRecipient(address newRecipient) external onlyOwner {
    require(newRecipient != address(0), "Invalid recipient");
    
    address oldRecipient = feeRecipient;
    feeRecipient = newRecipient;
    
    emit FeeRecipientUpdated(oldRecipient, newRecipient);
}
```

### **Access Control**
```solidity
modifier onlyOwner() {
    require(msg.sender == owner(), "Only owner");
    _;
}

modifier nonReentrant() {
    require(!_locked, "Reentrant call");
    _locked = true;
    _;
    _locked = false;
}
```

### **Eventi Required**
```solidity
event Deposited(address indexed user, uint256 ethAmount, uint256 netDeposit, uint256 fee, uint256 lpTokens);
event Withdrawn(address indexed user, uint256 lpTokens, uint256 ethAmount, uint256 netWithdraw, uint256 fee);
event TokenSwappedForWithdraw(string indexed tokenCode, uint256 amountIn, uint256 amountOut);
event WithdrawLimitsUpdated(uint256 hourlyLimit, uint256 dailyLimit, uint256 minWithdraw, uint256 maxWithdraw);
event DepositFeeUpdated(uint256 oldFee, uint256 newFee);
event WithdrawFeeUpdated(uint256 oldFee, uint256 newFee);
event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
event DepositsEnabledChanged(bool enabled);
event WithdrawsEnabledChanged(bool enabled);
```

### **Moduli Dependencies**
- **Input**: Beacon, ProxyGeneral, ValueCalculator, SwapManager, ParameterManager, WETH
- **Output**: Espone interfacce pubbliche per utenti finali

### **Validazioni Business Logic**
1. First deposit ratio 1:1, successivi proporzionali a pool value
2. Withdraw limits enforcement (hourly/daily per user)
3. Automatic swap quando WETH insufficiente per withdraw
4. Fee calculation con cap massimo del 5%
5. Reentrancy protection su deposit/withdraw
6. Emergency pause rispettato
7. Rate limiting tracking tramite ProxyGeneral state

---

## 🔄 **SWAPMANAGER (Gestione Swap)**

### **Ruolo e Responsabilità**
- **Integrazione SimpleSwap** per swap Token → WETH
- **Orchestrazione swap** con custody delegata a ProxyGeneral
- **Slippage protection** e validazioni pre/post swap
- **Event tracking** per audit trail completo
- **Error handling** per swap falliti

### **Storage Requirements**

#### **State Variables**
```solidity
address public immutable beacon;
address public simpleSwapRouter;
uint256 public maxSlippage;        // Basis points (100 = 1%)
uint256 public constant MAX_SLIPPAGE_LIMIT = 500; // 5% max

// Swap statistics
mapping(string => uint256) public tokenSwapCount;
mapping(string => uint256) public totalSwappedAmount;

bool public swapsEnabled;
```

### **Interfacce Required**

#### **Interfacce Esterne (Input)**
```solidity
interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}

interface IProxyGeneral {
    function transferToModule(address token, address module, uint256 amount) external;
    function transferFromModule(address token, address module, uint256 amount) external;
    function approveSpender(address token, address spender, uint256 amount) external;
    function getAssetBalance(address asset) external view returns (uint256);
    function isPaused() external view returns (bool);
}

interface ITokenManager {
    function getTokenAddress(string memory tokenCode) external view returns (address);
    function isTokenActive(string memory tokenCode) external view returns (bool);
    function getTokenInfo(string memory tokenCode) external view returns (TokenInfo memory);
}

interface ISimpleSwap {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
    
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}
```

#### **Interfacce Esposte (Output)**
```solidity
interface ISwapManager {
    // Swap Operations
    function swapTokenForWETH(
        string memory tokenCode,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);
    
    // Quote Functions
    function getSwapQuote(
        string memory tokenCode,
        uint256 amountIn
    ) external view returns (uint256 estimatedOut);
    
    function calculateMinAmountOut(
        string memory tokenCode,
        uint256 amountIn
    ) external view returns (uint256 minOut);
    
    // Configuration
    function setSimpleSwapRouter(address newRouter) external;
    function setMaxSlippage(uint256 newSlippage) external;
    function setSwapsEnabled(bool enabled) external;
    
    // Statistics
    function getSwapStats(string memory tokenCode) external view returns (uint256 count, uint256 totalAmount);
}
```

### **Funzioni Core**

#### **1. Swap Execution**
```solidity
function swapTokenForWETH(
    string memory tokenCode,
    uint256 amountIn,
    uint256 minAmountOut
) external onlyAuthorizedModule nonReentrant returns (uint256 amountOut) {
    // VALIDAZIONI CRITICHE:
    require(swapsEnabled, "Swaps are disabled");
    require(amountIn > 0, "Invalid amount");
    require(simpleSwapRouter != address(0), "SimpleSwap router not set");
    
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    require(!proxyGeneral.isPaused(), "System is paused");
    
    // VALIDATE TOKEN
    ITokenManager tokenManager = ITokenManager(IBeacon(beacon).getImplementation("TokenManager"));
    require(tokenManager.isTokenActive(tokenCode), "Token not active");
    
    address tokenAddress = tokenManager.getTokenAddress(tokenCode);
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    
    // CHECK BALANCE IN PROXYGENERAL
    uint256 tokenBalance = IERC20(tokenAddress).balanceOf(address(proxyGeneral));
    require(tokenBalance >= amountIn, "Insufficient token balance");
    
    // BALANCES PRE-SWAP
    uint256 wethBalanceBefore = IERC20(wethAddress).balanceOf(address(proxyGeneral));
    uint256 tokenBalanceBefore = tokenBalance;
    
    // GET QUOTE FOR VALIDATION
    uint256 expectedOut = ISimpleSwap(simpleSwapRouter).getAmountOut(tokenAddress, wethAddress, amountIn);
    
    // VALIDATE SLIPPAGE
    uint256 minAcceptable = (expectedOut * (10000 - maxSlippage)) / 10000;
    require(minAmountOut >= minAcceptable, "Slippage too high");
    
    // APPROVE SIMPLESWAP
    proxyGeneral.approveSpender(tokenAddress, simpleSwapRouter, amountIn);
    
    // EXECUTE SWAP
    // Token stays in ProxyGeneral, SimpleSwap pulls from there
    amountOut = ISimpleSwap(simpleSwapRouter).swap(
        tokenAddress,
        wethAddress,
        amountIn,
        minAmountOut,
        address(proxyGeneral) // WETH goes back to ProxyGeneral
    );
    
    // VALIDAZIONI POST-SWAP
    uint256 wethBalanceAfter = IERC20(wethAddress).balanceOf(address(proxyGeneral));
    uint256 tokenBalanceAfter = IERC20(tokenAddress).balanceOf(address(proxyGeneral));
    
    uint256 wethReceived = wethBalanceAfter - wethBalanceBefore;
    uint256 tokenSpent = tokenBalanceBefore - tokenBalanceAfter;
    
    require(wethReceived >= minAmountOut, "Insufficient WETH received");
    require(tokenSpent <= amountIn, "Too many tokens spent");
    require(wethReceived == amountOut, "Amount mismatch");
    
    // UPDATE STATISTICS
    tokenSwapCount[tokenCode]++;
    totalSwappedAmount[tokenCode] += tokenSpent;
    
    // EVENTI:
    emit SwapExecuted(
        tokenCode,
        tokenAddress,
        tokenSpent,
        wethReceived,
        expectedOut,
        msg.sender
    );
    
    return wethReceived;
}
```

#### **2. Quote Functions**
```solidity
function getSwapQuote(
    string memory tokenCode,
    uint256 amountIn
) external view returns (uint256 estimatedOut) {
    require(simpleSwapRouter != address(0), "SimpleSwap router not set");
    require(amountIn > 0, "Invalid amount");
    
    ITokenManager tokenManager = ITokenManager(IBeacon(beacon).getImplementation("TokenManager"));
    require(tokenManager.isTokenActive(tokenCode), "Token not active");
    
    address tokenAddress = tokenManager.getTokenAddress(tokenCode);
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    
    estimatedOut = ISimpleSwap(simpleSwapRouter).getAmountOut(tokenAddress, wethAddress, amountIn);
    
    return estimatedOut;
}

function calculateMinAmountOut(
    string memory tokenCode,
    uint256 amountIn
) external view returns (uint256 minOut) {
    uint256 expectedOut = this.getSwapQuote(tokenCode, amountIn);
    
    // Apply slippage tolerance
    minOut = (expectedOut * (10000 - maxSlippage)) / 10000;
    
    return minOut;
}
```

#### **3. Configuration Management**
```solidity
function setSimpleSwapRouter(address newRouter) external onlyOwner {
    require(newRouter != address(0), "Invalid router address");
    require(newRouter.code.length > 0, "Router must be a contract");
    
    address oldRouter = simpleSwapRouter;
    simpleSwapRouter = newRouter;
    
    emit SimpleSwapRouterUpdated(oldRouter, newRouter);
}

function setMaxSlippage(uint256 newSlippage) external onlyOwner {
    require(newSlippage <= MAX_SLIPPAGE_LIMIT, "Slippage exceeds maximum");
    
    uint256 oldSlippage = maxSlippage;
    maxSlippage = newSlippage;
    
    emit MaxSlippageUpdated(oldSlippage, newSlippage);
}

function setSwapsEnabled(bool enabled) external onlyOwner {
    swapsEnabled = enabled;
    emit SwapsEnabledChanged(enabled);
}
```

#### **4. Statistics**
```solidity
function getSwapStats(string memory tokenCode) external view returns (uint256 count, uint256 totalAmount) {
    return (tokenSwapCount[tokenCode], totalSwappedAmount[tokenCode]);
}
```

### **Access Control**
```solidity
modifier onlyAuthorizedModule() {
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    require(
        proxyGeneral.isAuthorizedModule(msg.sender) || 
        msg.sender == owner(),
        "Not authorized"
    );
    _;
}

modifier nonReentrant() {
    require(!_locked, "Reentrant call");
    _locked = true;
    _;
    _locked = false;
}
```

### **Eventi Required**
```solidity
event SwapExecuted(
    string indexed tokenCode,
    address indexed tokenAddress,
    uint256 amountIn,
    uint256 amountOut,
    uint256 expectedOut,
    address indexed caller
);
event SimpleSwapRouterUpdated(address indexed oldRouter, address indexed newRouter);
event MaxSlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
event SwapsEnabledChanged(bool enabled);
event SwapFailed(string indexed tokenCode, string reason);
```

### **Moduli Dependencies**
- **Input**: Beacon, ProxyGeneral, TokenManager, SimpleSwap Router
- **Output**: LiquidityManager (per automatic swap su withdraw)

### **Validazioni Business Logic**
1. **Asset custody**: Token rimangono in ProxyGeneral durante swap
2. **Pre-swap validation**: balance check, quote verification, slippage check
3. **Post-swap validation**: amount received verification, token spent verification
4. **Approval management**: approve solo amount necessario per swap
5. **Reentrancy protection**: critical per evitare double-swap attacks
6. **Emergency pause respect**: no swap se sistema in pausa
7. **Statistics tracking**: audit trail completo per governance

---

## 🚨 **EMERGENCYHANDLER (Gestione Emergenze)**

### **Ruolo e Responsabilità**
- **Trigger emergency pause** per tutto il sistema
- **Emergency withdrawal** per owner (protezione fondi)
- **Coordinazione con ProxyGeneral** per trasferimento asset
- **Event logging** per trasparenza e audit
- **Timelock mechanism** per sicurezza governance

### **Storage Requirements**

#### **State Variables**
```solidity
address public immutable beacon;

struct EmergencyState {
    bool isActive;
    address triggeredBy;
    uint256 triggeredAt;
    string reason;
}

EmergencyState public emergencyState;

// Timelock for unpause
uint256 public unpauseTimelock;
uint256 public constant MIN_TIMELOCK = 1 hours;
uint256 public constant MAX_TIMELOCK = 7 days;

// Emergency contacts
address[] public emergencyContacts;
mapping(address => bool) public isEmergencyContact;

// Cooldown
uint256 public lastEmergencyTimestamp;
uint256 public constant EMERGENCY_COOLDOWN = 1 days;
```

### **Interfacce Required**

#### **Interfacce Esterne (Input)**
```solidity
interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}

interface IProxyGeneral {
    function pause() external;
    function unpause() external;
    function isPaused() external view returns (bool);
    function emergencyTransferAll(address recipient) external;
    function totalSupply() external view returns (uint256);
}

interface ITokenManager {
    function getActiveTokens() external view returns (string[] memory);
    function getTokenAddress(string memory tokenCode) external view returns (address);
}

interface IValueCalculator {
    function getTotalPoolValueView() external view returns (uint256);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

interface IWETH {
    function balanceOf(address account) external view returns (uint256);
}
```

#### **Interfacce Esposte (Output)**
```solidity
interface IEmergencyHandler {
    // Emergency Operations
    function triggerEmergencyPause(string memory reason) external;
    function unpause() external;
    function emergencyWithdraw(address recipient) external;
    
    // Emergency Contacts
    function addEmergencyContact(address contact) external;
    function removeEmergencyContact(address contact) external;
    function isAuthorizedForEmergency(address account) external view returns (bool);
    
    // Configuration
    function setUnpauseTimelock(uint256 newTimelock) external;
    
    // Status Queries
    function getEmergencyState() external view returns (EmergencyState memory);
    function canUnpause() external view returns (bool canUnpause, string memory reason);
    function getSystemHealthStatus() external view returns (
        bool isPaused,
        uint256 totalValue,
        uint256 lpSupply,
        string[] memory activeTokens
    );
}
```

### **Funzioni Core**

#### **1. Emergency Pause**
```solidity
function triggerEmergencyPause(string memory reason) external {
    // VALIDAZIONI:
    require(
        msg.sender == owner() || isEmergencyContact[msg.sender],
        "Not authorized for emergency"
    );
    require(bytes(reason).length > 0, "Reason required");
    require(!emergencyState.isActive, "Emergency already active");
    
    // COOLDOWN CHECK (prevent spam)
    if (lastEmergencyTimestamp > 0) {
        require(
            block.timestamp - lastEmergencyTimestamp >= EMERGENCY_COOLDOWN,
            "Emergency cooldown active"
        );
    }
    
    // TRIGGER PAUSE
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    proxyGeneral.pause();
    
    // UPDATE STATE
    emergencyState = EmergencyState({
        isActive: true,
        triggeredBy: msg.sender,
        triggeredAt: block.timestamp,
        reason: reason
    });
    
    lastEmergencyTimestamp = block.timestamp;
    
    // EVENTI:
    emit EmergencyPauseTriggered(msg.sender, reason, block.timestamp);
    
    // NOTIFY CONTACTS
    for (uint256 i = 0; i < emergencyContacts.length; i++) {
        emit EmergencyContactNotified(emergencyContacts[i]);
    }
}
```

#### **2. Unpause**
```solidity
function unpause() external onlyOwner {
    require(emergencyState.isActive, "No emergency active");
    
    // CHECK TIMELOCK
    uint256 timeSincePause = block.timestamp - emergencyState.triggeredAt;
    require(timeSincePause >= unpauseTimelock, "Timelock not expired");
    
    // UNPAUSE SYSTEM
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    proxyGeneral.unpause();
    
    // RESET STATE
    address triggeredBy = emergencyState.triggeredBy;
    string memory reason = emergencyState.reason;
    uint256 triggeredAt = emergencyState.triggeredAt;
    
    delete emergencyState;
    
    // EVENTI:
    emit EmergencyUnpaused(msg.sender, block.timestamp, timeSincePause);
    emit EmergencyResolved(triggeredBy, reason, triggeredAt, block.timestamp);
}

function canUnpause() external view returns (bool _canUnpause, string memory reason) {
    if (!emergencyState.isActive) {
        return (false, "No emergency active");
    }
    
    uint256 timeSincePause = block.timestamp - emergencyState.triggeredAt;
    if (timeSincePause < unpauseTimelock) {
        uint256 remaining = unpauseTimelock - timeSincePause;
        return (false, string(abi.encodePacked("Timelock: ", remaining, " seconds remaining")));
    }
    
    return (true, "Can unpause");
}
```

#### **3. Emergency Withdrawal**
```solidity
function emergencyWithdraw(address recipient) external onlyOwner {
    require(recipient != address(0), "Invalid recipient");
    
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    require(proxyGeneral.isPaused(), "System must be paused");
    require(emergencyState.isActive, "No emergency active");
    
    // GET CURRENT STATE FOR LOGGING
    uint256 totalValue = _getCurrentTotalValue();
    
    // EXECUTE EMERGENCY TRANSFER
    proxyGeneral.emergencyTransferAll(recipient);
    
    // EVENTI:
    emit EmergencyWithdrawExecuted(
        recipient,
        totalValue,
        msg.sender,
        block.timestamp
    );
    
    // LOG ASSET SNAPSHOT
    _logAssetSnapshot(recipient);
}

function _getCurrentTotalValue() internal view returns (uint256) {
    try IValueCalculator(IBeacon(beacon).getImplementation("ValueCalculator")).getTotalPoolValueView() returns (uint256 value) {
        return value;
    } catch {
        return 0;
    }
}

function _logAssetSnapshot(address recipient) internal {
    address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
    
    // LOG WETH
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    uint256 wethBalance = IERC20(wethAddress).balanceOf(proxyGeneral);
    emit AssetTransferred("WETH", wethAddress, wethBalance, recipient);
    
    // LOG OTHER TOKENS
    ITokenManager tokenManager = ITokenManager(IBeacon(beacon).getImplementation("TokenManager"));
    string[] memory activeTokens = tokenManager.getActiveTokens();
    
    for (uint256 i = 0; i < activeTokens.length; i++) {
        address tokenAddress = tokenManager.getTokenAddress(activeTokens[i]);
        uint256 balance = IERC20(tokenAddress).balanceOf(proxyGeneral);
        emit AssetTransferred(activeTokens[i], tokenAddress, balance, recipient);
    }
}
```

#### **4. Emergency Contacts Management**
```solidity
function addEmergencyContact(address contact) external onlyOwner {
    require(contact != address(0), "Invalid contact");
    require(!isEmergencyContact[contact], "Contact already added");
    
    emergencyContacts.push(contact);
    isEmergencyContact[contact] = true;
    
    emit EmergencyContactAdded(contact);
}

function removeEmergencyContact(address contact) external onlyOwner {
    require(isEmergencyContact[contact], "Contact not found");
    
    isEmergencyContact[contact] = false;
    
    // Remove from array
    for (uint256 i = 0; i < emergencyContacts.length; i++) {
        if (emergencyContacts[i] == contact) {
            emergencyContacts[i] = emergencyContacts[emergencyContacts.length - 1];
            emergencyContacts.pop();
            break;
        }
    }
    
    emit EmergencyContactRemoved(contact);
}

function isAuthorizedForEmergency(address account) external view returns (bool) {
    return account == owner() || isEmergencyContact[account];
}
```

#### **5. System Health Status**
```solidity
function getSystemHealthStatus() external view returns (
    bool isPaused,
    uint256 totalValue,
    uint256 lpSupply,
    string[] memory activeTokens
) {
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    IValueCalculator valueCalculator = IValueCalculator(IBeacon(beacon).getImplementation("ValueCalculator"));
    ITokenManager tokenManager = ITokenManager(IBeacon(beacon).getImplementation("TokenManager"));
    
    isPaused = proxyGeneral.isPaused();
    
    try valueCalculator.getTotalPoolValueView() returns (uint256 value) {
        totalValue = value;
    } catch {
        totalValue = 0;
    }
    
    lpSupply = proxyGeneral.totalSupply();
    activeTokens = tokenManager.getActiveTokens();
    
    return (isPaused, totalValue, lpSupply, activeTokens);
}
```

### **Access Control**
```solidity
modifier onlyOwner() {
    require(msg.sender == owner(), "Only owner");
    _;
}

modifier onlyEmergencyAuthorized() {
    require(
        msg.sender == owner() || isEmergencyContact[msg.sender],
        "Not authorized for emergency"
    );
    _;
}
```

### **Eventi Required**
```solidity
event EmergencyPauseTriggered(address indexed triggeredBy, string reason, uint256 timestamp);
event EmergencyUnpaused(address indexed by, uint256 timestamp, uint256 pauseDuration);
event EmergencyResolved(address indexed triggeredBy, string reason, uint256 triggeredAt, uint256 resolvedAt);
event EmergencyWithdrawExecuted(address indexed recipient, uint256 totalValue, address indexed by, uint256 timestamp);
event AssetTransferred(string indexed tokenCode, address indexed tokenAddress, uint256 amount, address indexed recipient);
event EmergencyContactAdded(address indexed contact);
event EmergencyContactRemoved(address indexed contact);
event EmergencyContactNotified(address indexed contact);
```

### **Moduli Dependencies**
- **Input**: Beacon, ProxyGeneral, TokenManager, ValueCalculator
- **Output**: Espone interfacce per governance e emergency contacts

### **Validazioni Business Logic**
1. **Multi-sig authorization**: Owner o emergency contacts possono trigger pause
2. **Timelock protection**: Unpause richiede timelock minimo per review
3. **Cooldown mechanism**: Previene spam di emergency pause
4. **Asset snapshot**: Log completo asset pre-transfer per trasparenza
5. **Emergency contacts**: Lista whitelisted per decentralized emergency response
6. **Health status**: Monitoring system state durante emergency

---

## ⚙️ **PARAMETERMANAGER (Gestione Parametri)**

### **Ruolo e Responsabilità**
- **Gestione parametri configurabili** del sistema
- **Timelock mechanism** per modifiche critiche
- **Versionamento parametri** con history tracking
- **Validazioni range** per parametri numerici
- **Emergency override** per situazioni critiche

### **Storage Requirements**

#### **State Variables**
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

mapping(string => Parameter) private parameters;
string[] private parameterNames;

struct ParameterHistory {
    uint256 value;
    uint256 timestamp;
    address changedBy;
}

mapping(string => ParameterHistory[]) private parameterHistory;

// Timelock configuration
uint256 public parameterTimelock;
uint256 public constant MIN_TIMELOCK = 1 hours;
uint256 public constant MAX_TIMELOCK = 7 days;

address public immutable beacon;
```

### **Interfacce Required**

#### **Interfacce Esterne (Input)**
```solidity
interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}

interface IProxyGeneral {
    function isPaused() external view returns (bool);
}
```

#### **Interfacce Esposte (Output)**
```solidity
interface IParameterManager {
    // Parameter Management
    function registerParameter(
        string memory parameterName,
        uint256 initialValue,
        uint256 minValue,
        uint256 maxValue,
        bool requiresTimelock
    ) external;
    
    function proposeParameterChange(string memory parameterName, uint256 newValue) external;
    function executeParameterChange(string memory parameterName) external;
    function emergencySetParameter(string memory parameterName, uint256 newValue) external;
    
    // Queries
    function getCurrentParameterValue(string memory parameterName) external view returns (uint256);
    function getParameterInfo(string memory parameterName) external view returns (Parameter memory);
    function getParameterHistory(string memory parameterName) external view returns (ParameterHistory[] memory);
    function getAllParameters() external view returns (string[] memory names, uint256[] memory values);
    
    // Validation
    function canExecuteParameterChange(string memory parameterName) external view returns (bool canExecute, string memory reason);
    
    // Configuration
    function setParameterTimelock(uint256 newTimelock) external;
}
```

### **Funzioni Core**

#### **1. Parameter Registration**
```solidity
function registerParameter(
    string memory parameterName,
    uint256 initialValue,
    uint256 minValue,
    uint256 maxValue,
    bool requiresTimelock
) external onlyOwner {
    // VALIDAZIONI:
    require(bytes(parameterName).length > 0, "Invalid parameter name");
    require(!parameters[parameterName].isActive, "Parameter already registered");
    require(minValue <= maxValue, "Invalid range");
    require(initialValue >= minValue && initialValue <= maxValue, "Initial value out of range");
    
    // REGISTER PARAMETER
    parameters[parameterName] = Parameter({
        currentValue: initialValue,
        proposedValue: 0,
        proposedAt: 0,
        effectiveAt: 0,
        minValue: minValue,
        maxValue: maxValue,
        requiresTimelock: requiresTimelock,
        isActive: true
    });
    
    parameterNames.push(parameterName);
    
    // INITIAL HISTORY ENTRY
    parameterHistory[parameterName].push(ParameterHistory({
        value: initialValue,
        timestamp: block.timestamp,
        changedBy: msg.sender
    }));
    
    emit ParameterRegistered(parameterName, initialValue, minValue, maxValue, requiresTimelock);
}
```

#### **2. Parameter Change (Timelock)**
```solidity
function proposeParameterChange(string memory parameterName, uint256 newValue) external onlyOwner {
    Parameter storage param = parameters[parameterName];
    
    // VALIDAZIONI:
    require(param.isActive, "Parameter not registered");
    require(newValue >= param.minValue && newValue <= param.maxValue, "Value out of range");
    require(newValue != param.currentValue, "Same as current value");
    
    if (param.requiresTimelock) {
        // PROPOSE WITH TIMELOCK
        param.proposedValue = newValue;
        param.proposedAt = block.timestamp;
        param.effectiveAt = block.timestamp + parameterTimelock;
        
        emit ParameterChangeProposed(parameterName, param.currentValue, newValue, param.effectiveAt);
    } else {
        // IMMEDIATE CHANGE
        uint256 oldValue = param.currentValue;
        param.currentValue = newValue;
        
        // ADD TO HISTORY
        parameterHistory[parameterName].push(ParameterHistory({
            value: newValue,
            timestamp: block.timestamp,
            changedBy: msg.sender
        }));
        
        emit ParameterChanged(parameterName, oldValue, newValue, msg.sender);
    }
}

function executeParameterChange(string memory parameterName) external onlyOwner {
    Parameter storage param = parameters[parameterName];
    
    // VALIDAZIONI:
    require(param.isActive, "Parameter not registered");
    require(param.requiresTimelock, "Parameter doesn't require timelock");
    require(param.proposedValue > 0, "No pending proposal");
    require(block.timestamp >= param.effectiveAt, "Timelock not expired");
    
    // EXECUTE CHANGE
    uint256 oldValue = param.currentValue;
    param.currentValue = param.proposedValue;
    
    // RESET PROPOSAL
    uint256 newValue = param.proposedValue;
    param.proposedValue = 0;
    param.proposedAt = 0;
    param.effectiveAt = 0;
    
    // ADD TO HISTORY
    parameterHistory[parameterName].push(ParameterHistory({
        value: newValue,
        timestamp: block.timestamp,
        changedBy: msg.sender
    }));
    
    emit ParameterChanged(parameterName, oldValue, newValue, msg.sender);
}
```

#### **3. Emergency Override**
```solidity
function emergencySetParameter(string memory parameterName, uint256 newValue) external onlyOwner {
    Parameter storage param = parameters[parameterName];
    
    // VALIDAZIONI:
    require(param.isActive, "Parameter not registered");
    require(newValue >= param.minValue && newValue <= param.maxValue, "Value out of range");
    
    // CHECK EMERGENCY STATE
    IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
    require(proxyGeneral.isPaused(), "System must be paused for emergency override");
    
    // EMERGENCY SET (bypasses timelock)
    uint256 oldValue = param.currentValue;
    param.currentValue = newValue;
    
    // CLEAR PENDING PROPOSAL
    param.proposedValue = 0;
    param.proposedAt = 0;
    param.effectiveAt = 0;
    
    // ADD TO HISTORY
    parameterHistory[parameterName].push(ParameterHistory({
        value: newValue,
        timestamp: block.timestamp,
        changedBy: msg.sender
    }));
    
    emit ParameterEmergencyChanged(parameterName, oldValue, newValue, msg.sender);
}
```

#### **4. Queries**
```solidity
function getCurrentParameterValue(string memory parameterName) external view returns (uint256) {
    Parameter storage param = parameters[parameterName];
    require(param.isActive, "Parameter not registered");
    
    return param.currentValue;
}

function getParameterInfo(string memory parameterName) external view returns (Parameter memory) {
    require(parameters[parameterName].isActive, "Parameter not registered");
    return parameters[parameterName];
}

function getParameterHistory(string memory parameterName) external view returns (ParameterHistory[] memory) {
    require(parameters[parameterName].isActive, "Parameter not registered");
    return parameterHistory[parameterName];
}

function getAllParameters() external view returns (string[] memory names, uint256[] memory values) {
    names = new string[](parameterNames.length);
    values = new uint256[](parameterNames.length);
    
    for (uint256 i = 0; i < parameterNames.length; i++) {
        names[i] = parameterNames[i];
        values[i] = parameters[parameterNames[i]].currentValue;
    }
    
    return (names, values);
}
```

#### **5. Validation**
```solidity
function canExecuteParameterChange(string memory parameterName) external view returns (bool canExecute, string memory reason) {
    Parameter storage param = parameters[parameterName];
    
    if (!param.isActive) {
        return (false, "Parameter not registered");
    }
    
    if (!param.requiresTimelock) {
        return (false, "Parameter doesn't require timelock execution");
    }
    
    if (param.proposedValue == 0) {
        return (false, "No pending proposal");
    }
    
    if (block.timestamp < param.effectiveAt) {
        uint256 remaining = param.effectiveAt - block.timestamp;
        return (false, string(abi.encodePacked("Timelock: ", remaining, " seconds remaining")));
    }
    
    return (true, "Can execute");
}
```

### **Access Control**
```solidity
modifier onlyOwner() {
    require(msg.sender == owner(), "Only owner");
    _;
}
```

### **Eventi Required**
```solidity
event ParameterRegistered(string indexed parameterName, uint256 initialValue, uint256 minValue, uint256 maxValue, bool requiresTimelock);
event ParameterChangeProposed(string indexed parameterName, uint256 oldValue, uint256 newValue, uint256 effectiveAt);
event ParameterChanged(string indexed parameterName, uint256 oldValue, uint256 newValue, address indexed changedBy);
event ParameterEmergencyChanged(string indexed parameterName, uint256 oldValue, uint256 newValue, address indexed changedBy);
event ParameterTimelockUpdated(uint256 oldTimelock, uint256 newTimelock);
```

### **Moduli Dependencies**
- **Input**: Beacon, ProxyGeneral (per emergency check)
- **Output**: Tutti i moduli possono leggere parametri configurabili

### **Validazioni Business Logic**
1. **Range validation**: Ogni parametro ha min/max bounds
2. **Timelock protection**: Parametri critici richiedono delay
3. **History tracking**: Audit trail completo di tutte le modifiche
4. **Emergency override**: Bypass timelock solo se sistema in pause
5. **Immutability**: Parametri registered non possono essere unregistered
6. **Versioning**: History mantiene chi/quando/quanto per governance

---

## 📊 **PARAMETRI COMUNI DA REGISTRARE**

```solidity
// LiquidityManager Parameters
registerParameter("DEPOSIT_FEE", 50, 0, 500, false);              // 0.5% default, max 5%
registerParameter("WITHDRAW_FEE", 50, 0, 500, false);             // 0.5% default, max 5%
registerParameter("MIN_DEPOSIT", 0.01 ether, 0.001 ether, 1 ether, false);
registerParameter("MIN_WITHDRAW", 0.01 ether, 0.001 ether, 1 ether, false);
registerParameter("HOURLY_LIMIT", 10 ether, 1 ether, 1000 ether, true);
registerParameter("DAILY_LIMIT", 100 ether, 10 ether, 10000 ether, true);

// TokenManager Parameters
registerParameter("MAX_TOKENS", 20, 5, 50, true);
registerParameter("MAX_ERRORS", 5, 1, 100, false);

// ValueCalculator Parameters
registerParameter("CACHE_DURATION", 5 minutes, 1 minutes, 1 hours, false);
registerParameter("MAX_PRICE_AGE", 1 hours, 5 minutes, 24 hours, true);

// SwapManager Parameters
registerParameter("MAX_SLIPPAGE", 200, 10, 500, false);           // 2% default, max 5%

// EmergencyHandler Parameters
registerParameter("UNPAUSE_TIMELOCK", 6 hours, 1 hours, 7 days, true);
registerParameter("EMERGENCY_COOLDOWN", 1 days, 1 hours, 30 days, true);

// ParameterManager Self-Configuration
registerParameter("PARAMETER_TIMELOCK", 24 hours, 1 hours, 7 days, true);
```

---

## 🎯 **FINE PARTE 2**

**Tutti gli 8 moduli del sistema DeFi modulare sono ora completamente specificati con:**

✅ **Ruoli e responsabilità** chiare per ogni modulo  
✅ **Storage requirements** dettagliati  
✅ **Interfacce complete** (input/output)  
✅ **Logiche implementative** con validazioni  
✅ **Access control** granulare  
✅ **Event management** per audit trail  
✅ **Dependencies mapping** tra moduli  
✅ **Business logic validations** critiche

**Sistema completo:**
1. **Beacon** - Registry centrale
2. **ProxyGeneral** - Custode asset + LP token
3. **TokenManager** - Registry token + Chainlink
4. **ValueCalculator** - Calcoli valore + cache
5. **LiquidityManager** - Deposit/withdraw + rate limiting
6. **SwapManager** - SimpleSwap integration
7. **EmergencyHandler** - Emergency procedures
8. **ParameterManager** - Configuration management

Questi documenti servono ora come **blueprint completo** per implementazione! 🚀