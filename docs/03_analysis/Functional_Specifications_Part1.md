# 📋 SPECIFICHE FUNZIONALI COMPLETE - MODULI DEFI
## Blueprint Implementazione Dettagliato - PARTE 1 (4/8 Moduli)

*Documento di riferimento completo per implementazione di ogni modulo*

---

## 🎯 **SCOPO DEL DOCUMENTO**

Questo documento definisce **in dettaglio** ogni logica, interfaccia, parametro, validazione e interazione che deve essere presente in ogni modulo del sistema DeFi modulare. Serve come **blueprint completo** per l'implementazione.

**Moduli Parte 1:**
1. [Beacon](#beacon-registry-centrale)
2. [ProxyGeneral](#proxygeneral-custode-centrale)  
3. [TokenManager](#tokenmanager-gestione-token)
4. [ValueCalculator](#valuecalculator-calcoli-valore)

---

## 🔗 **BEACON (Registry Centrale)**

### **Ruolo e Responsabilità**
- **Registry unico** di tutti gli indirizzi di moduli e servizi
- **Punto centrale** per resolution degli indirizzi runtime
- **Meccanismo di upgrade** per l'intera architettura modulare
- **Source of truth** per dependency injection

### **Storage Requirements**

#### **State Variables**
```solidity
mapping(string => address) private implementations;
address public owner;
address public pendingOwner; // Per 2-step ownership
```

#### **Constants/Parameters**
```solidity
uint256 public constant MAX_MODULE_NAME_LENGTH = 32;
```

### **Interfacce Required**

#### **Interfacce Esterne (Input)**
Nessuna - Il Beacon non dipende da altri contratti

#### **Interfacce Esposte (Output)**
```solidity
interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
    function updateImplementation(string memory moduleName, address newImplementation) external;
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;
}
```

### **Funzioni Core**

#### **1. updateImplementation()**
```solidity
function updateImplementation(string memory module, address newImplementation) external onlyOwner {
    // VALIDAZIONI RICHIESTE:
    require(bytes(module).length > 0 && bytes(module).length <= MAX_MODULE_NAME_LENGTH, "Invalid module name");
    require(newImplementation != address(0), "Invalid implementation address");
    require(newImplementation.code.length > 0, "Implementation must be a contract");
    require(implementations[module] != newImplementation, "Same implementation already set");
    
    // LOGICA:
    address oldImplementation = implementations[module];
    implementations[module] = newImplementation;
    
    // EVENTI:
    emit ImplementationUpdated(module, oldImplementation, newImplementation);
}
```

#### **2. getImplementation()**
```solidity
function getImplementation(string memory module) external view returns (address) {
    // VALIDAZIONI:
    require(bytes(module).length > 0, "Invalid module name");
    
    // LOGICA:
    address implementation = implementations[module];
    require(implementation != address(0), "Implementation not found");
    
    return implementation;
}
```

#### **3. transferOwnership() & acceptOwnership()**
```solidity
function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), "Invalid new owner");
    require(newOwner != owner, "Already current owner");
    
    pendingOwner = newOwner;
    emit OwnershipTransferStarted(owner, newOwner);
}

function acceptOwnership() external {
    require(msg.sender == pendingOwner, "Not pending owner");
    
    address oldOwner = owner;
    owner = pendingOwner;
    pendingOwner = address(0);
    
    emit OwnershipTransferred(oldOwner, owner);
}
```

### **Access Control**
```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Only owner can call this function");
    _;
}
```

### **Eventi Required**
```solidity
event ImplementationUpdated(string indexed moduleName, address indexed oldImplementation, address indexed newImplementation);
event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

### **Moduli Dependencies**
- **Input**: Nessuno (indipendente)
- **Output**: Tutti i moduli leggono da Beacon

### **Validazioni Business Logic**
1. Module names devono essere non-empty e con lunghezza limitata
2. Implementations devono essere contratti validi (non EOA)
3. Nessun update a stesso indirizzo
4. 2-step ownership transfer per sicurezza

---

## 🏛️ **PROXYGENERAL (Custode Centrale)**

### **Ruolo e Responsabilità**
- **Custode unico** di tutti gli asset (WETH + ERC20 tokens)
- **LP Token ERC20** (mint/burn authority)
- **Access Control Layer** per moduli autorizzati
- **Emergency Pause Mechanism** per tutto il sistema
- **Storage centrale** per parametri cross-modulo

### **Storage Requirements**

#### **State Variables**
```solidity
address public immutable beacon;
bool public paused;

// Asset custody tracking (opzionale per gas optimization)
mapping(address => uint256) private assetBalances;

// Module authorization
mapping(address => bool) public authorizedModules;

// Emergency state
address public emergencyRecipient;
uint256 public emergencyExecutedAt;

// Cross-module shared state
mapping(address => mapping(uint256 => uint256)) public hourlyWithdrawnAmounts; // user => hour => amount
mapping(string => uint256) public moduleParameters; // shared parameters storage
```

#### **Inherited Storage (ERC20)**
```solidity
// Da ERC20: _balances, _allowances, _totalSupply, _name, _symbol, _decimals
```

### **Interfacce Required**

#### **Interfacce Esterne (Input)**
```solidity
interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
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
interface IProxyGeneral {
    // LP Token Management
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    
    // Asset Management
    function transferFunds(address to, address asset, uint256 amount) external;
    function getAssetBalance(address asset) external view returns (uint256);
    function getTotalAssetValue() external view returns (uint256);
    
    // Swap Support
    function approveSpender(address token, address spender, uint256 amount) external;
    function transferToModule(address token, address module, uint256 amount) external;
    function transferFromModule(address token, address module, uint256 amount) external;
    
    // Access Control
    function authorizeModule(address module) external;
    function deauthorizeModule(address module) external;
    function isAuthorizedModule(address module) external view returns (bool);
    
    // Emergency Controls
    function pause() external;
    function unpause() external;
    function isPaused() external view returns (bool);
    function emergencyTransferAll(address recipient) external;
    
    // Cross-Module State
    function setHourlyWithdrawn(address user, uint256 hour, uint256 amount) external;
    function getHourlyWithdrawn(address user, uint256 hour) external view returns (uint256);
    function incrementHourlyWithdrawn(address user, uint256 amount) external;
}
```

### **Funzioni Core**

#### **1. LP Token Management**
```solidity
function mint(address to, uint256 amount) external onlyAuthorizedModule whenNotPaused {
    // VALIDAZIONI:
    require(to != address(0), "Cannot mint to zero address");
    require(amount > 0, "Cannot mint zero amount");
    
    // LOGICA:
    _mint(to, amount);
    
    // EVENTI:
    emit LPTokenMinted(to, amount, totalSupply());
}

function burn(address from, uint256 amount) external onlyAuthorizedModule whenNotPaused {
    // VALIDAZIONI:
    require(from != address(0), "Cannot burn from zero address");
    require(amount > 0, "Cannot burn zero amount");
    require(balanceOf(from) >= amount, "Insufficient LP token balance");
    
    // LOGICA:
    _burn(from, amount);
    
    // EVENTI:
    emit LPTokenBurned(from, amount, totalSupply());
}
```

#### **2. Asset Management**
```solidity
function transferFunds(address to, address asset, uint256 amount) external onlyAuthorizedModule whenNotPaused {
    // VALIDAZIONI:
    require(to != address(0), "Invalid recipient");
    require(asset != address(0), "Invalid asset");
    require(amount > 0, "Invalid amount");
    
    uint256 currentBalance = IERC20(asset).balanceOf(address(this));
    require(currentBalance >= amount, "Insufficient asset balance");
    
    // LOGICA:
    bool success = IERC20(asset).transfer(to, amount);
    require(success, "Asset transfer failed");
    
    // EVENTI:
    emit AssetTransferred(to, asset, amount, msg.sender);
}

function getAssetBalance(address asset) external view returns (uint256) {
    return IERC20(asset).balanceOf(address(this));
}
```

#### **3. Swap Support**
```solidity
function approveSpender(address token, address spender, uint256 amount) external onlyAuthorizedModule {
    // VALIDAZIONI:
    require(token != address(0), "Invalid token");
    require(spender != address(0), "Invalid spender");
    
    // LOGICA:
    IERC20(token).approve(spender, amount);
    
    // EVENTI:
    emit SpenderApproved(token, spender, amount, msg.sender);
}

function transferToModule(address token, address module, uint256 amount) external onlyAuthorizedModule {
    // VALIDAZIONI:
    require(isAuthorizedModule(module), "Module not authorized");
    require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
    
    // LOGICA:
    bool success = IERC20(token).transfer(module, amount);
    require(success, "Transfer to module failed");
    
    // EVENTI:
    emit AssetTransferredToModule(token, module, amount);
}
```

#### **4. Access Control**
```solidity
function authorizeModule(address module) external onlyOwner {
    require(module != address(0), "Invalid module address");
    require(!authorizedModules[module], "Module already authorized");
    
    authorizedModules[module] = true;
    emit ModuleAuthorized(module);
}

function deauthorizeModule(address module) external onlyOwner {
    require(authorizedModules[module], "Module not authorized");
    
    authorizedModules[module] = false;
    emit ModuleDeauthorized(module);
}

function isAuthorizedModule(address module) external view returns (bool) {
    return authorizedModules[module];
}
```

#### **5. Emergency Controls**
```solidity
function pause() external onlyAuthorizedModule {
    require(!paused, "Already paused");
    paused = true;
    emit Paused(msg.sender);
}

function unpause() external onlyOwner {
    require(paused, "Not paused");
    paused = false;
    emit Unpaused(msg.sender);
}

function emergencyTransferAll(address recipient) external onlyOwner {
    require(paused, "Must be paused for emergency");
    require(recipient != address(0), "Invalid recipient");
    
    // Transfer WETH
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    uint256 wethBalance = IERC20(wethAddress).balanceOf(address(this));
    if (wethBalance > 0) {
        IERC20(wethAddress).transfer(recipient, wethBalance);
    }
    
    // Transfer other assets (get list from TokenManager)
    address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
    // Implementation requires TokenManager interface...
    
    emergencyRecipient = recipient;
    emergencyExecutedAt = block.timestamp;
    
    emit EmergencyTransferExecuted(recipient, block.timestamp);
}
```

#### **6. Cross-Module State Management**
```solidity
function setHourlyWithdrawn(address user, uint256 hour, uint256 amount) external onlyAuthorizedModule {
    hourlyWithdrawnAmounts[user][hour] = amount;
    emit HourlyWithdrawnUpdated(user, hour, amount);
}

function incrementHourlyWithdrawn(address user, uint256 amount) external onlyAuthorizedModule {
    uint256 currentHour = block.timestamp / 1 hours;
    hourlyWithdrawnAmounts[user][currentHour] += amount;
    emit HourlyWithdrawnIncremented(user, currentHour, amount);
}
```

### **Access Control**
```solidity
modifier onlyAuthorizedModule() {
    require(
        authorizedModules[msg.sender] || 
        msg.sender == owner(), 
        "Caller not authorized"
    );
    _;
}

modifier whenNotPaused() {
    require(!paused, "Contract is paused");
    _;
}

modifier whenPaused() {
    require(paused, "Contract is not paused");
    _;
}
```

### **Eventi Required**
```solidity
event LPTokenMinted(address indexed to, uint256 amount, uint256 newTotalSupply);
event LPTokenBurned(address indexed from, uint256 amount, uint256 newTotalSupply);
event AssetTransferred(address indexed to, address indexed asset, uint256 amount, address indexed module);
event SpenderApproved(address indexed token, address indexed spender, uint256 amount, address indexed module);
event AssetTransferredToModule(address indexed token, address indexed module, uint256 amount);
event ModuleAuthorized(address indexed module);
event ModuleDeauthorized(address indexed module);
event Paused(address indexed account);
event Unpaused(address indexed account);
event EmergencyTransferExecuted(address indexed recipient, uint256 timestamp);
event HourlyWithdrawnUpdated(address indexed user, uint256 hour, uint256 amount);
event HourlyWithdrawnIncremented(address indexed user, uint256 hour, uint256 amount);
```

### **Moduli Dependencies**
- **Input**: Beacon (per resolution moduli), WETH, ERC20 tokens
- **Output**: Tutti i moduli interagiscono con ProxyGeneral

### **Validazioni Business Logic**
1. Solo moduli autorizzati possono chiamare funzioni sensibili
2. Pause mechanism blocca operazioni normali ma non emergency
3. Emergency transfer richiede pause attivo
4. LP token mint/burn devono essere bilanciati con asset custody
5. Asset transfers devono verificare bilanci sufficienti
6. Cross-module state management per limiti orari

---

## 🏦 **TOKENMANAGER (Gestione Token)**

### **Ruolo e Responsabilità**
- **Registry on-chain** di tutti i token supportati dal pool
- **Gestione price feeds Chainlink** per valutazione asset
- **Validazioni token** per operazioni di altri moduli
- **Error tracking** per price feed malfunzionanti
- **Token metadata management** (decimals, addresses, heartbeats)

### **Storage Requirements**

#### **State Variables**
```solidity
struct TokenInfo {
    address tokenAddress;
    uint8 tokenDecimals;
    string tokenCode;
    address priceFeed;
    uint8 priceFeedDecimals;
    bool isActive;
    uint256 lastPriceTimestamp;
    uint256 lastPrice;
    uint256 heartbeat;
    uint256 errorCount;
}

mapping(string => TokenInfo) private tokenData;
string[] private tokenCodes;
uint256 public tokenCodesCount;

// Error tracking
mapping(string => uint256) public tokenErrors;
uint256 public maxErrors;

// Parameters
uint256 public maxTokensPerOperation;
address public immutable beacon;
```

### **Interfacce Required**

#### **Interfacce Esterne (Input)**
```solidity
interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

interface IParameterManager {
    function getCurrentParameterValue(string memory parameterName) external view returns (uint256);
}
```

#### **Interfacce Esposte (Output)**
```solidity
interface ITokenManager {
    // Token Management
    function manageTokenData(
        string memory tokenCode,
        address tokenAddress,
        address priceFeed,
        uint8 tokenDecimals,
        uint8 priceFeedDecimals,
        uint256 heartbeat
    ) external;
    function removeToken(string memory tokenCode) external;
    function updateHeartbeat(string memory tokenCode, uint256 newHeartbeat) external;
    
    // Token Queries
    function isTokenActive(string memory tokenCode) external view returns (bool);
    function getTokenAddress(string memory tokenCode) external view returns (address);
    function getTokenInfo(string memory tokenCode) external view returns (TokenInfo memory);
    function getActiveTokens() external view returns (string[] memory);
    function getTokenCount() external view returns (uint256);
    
    // Price Feeds
    function getTokenPrice(string memory tokenCode) external view returns (uint256 price, uint256 updatedAt, bool isStale);
    function getTokenPriceWithEvents(string memory tokenCode) external returns (uint256 price, uint256 updatedAt);
    function validatePriceFeed(string memory tokenCode) external view returns (bool isValid);
    
    // Error Management
    function getTokenErrors(string memory tokenCode) external view returns (uint256);
    function resetTokenErrors(string memory tokenCode) external;
}
```

### **Funzioni Core**

#### **1. Token Management**
```solidity
function manageTokenData(
    string memory _tokenCode,
    address _tokenAddress,
    address _priceFeed,
    uint8 _tokenDecimals,
    uint8 _priceFeedDecimals,
    uint256 _heartbeat
) external onlyOwner {
    // VALIDAZIONI CRITICHE:
    require(bytes(_tokenCode).length > 0 && bytes(_tokenCode).length <= 16, "Invalid token code");
    require(_tokenAddress != address(0), "Invalid token address");
    require(_priceFeed != address(0), "Invalid price feed address");
    require(_heartbeat > 0, "Invalid heartbeat");
    
    // WETH EXCLUSION (CRITICO)
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    require(_tokenAddress != wethAddress, "Cannot add WETH as token");
    
    // MAX TOKENS LIMIT
    if (!tokenData[_tokenCode].isActive) {
        require(tokenCodesCount < maxTokensPerOperation, "Too many tokens");
        tokenCodes.push(_tokenCode);
        tokenCodesCount++;
    }
    
    // VALIDAZIONE PRICE FEED
    try AggregatorV3Interface(_priceFeed).latestRoundData() returns (
        uint80 roundId,
        int256 price,
        uint256,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        require(price > 0, "Invalid price feed");
        require(updatedAt > 0, "Price feed not updating");
        require(answeredInRound >= roundId, "Stale price feed");
    } catch {
        revert("Price feed validation failed");
    }
    
    // LOGICA:
    tokenData[_tokenCode] = TokenInfo({
        tokenAddress: _tokenAddress,
        tokenDecimals: _tokenDecimals,
        tokenCode: _tokenCode,
        priceFeed: _priceFeed,
        priceFeedDecimals: _priceFeedDecimals,
        isActive: true,
        lastPriceTimestamp: 0,
        lastPrice: 0,
        heartbeat: _heartbeat,
        errorCount: 0
    });
    
    // Reset error count se token esistente
    tokenErrors[_tokenCode] = 0;
    
    // EVENTI:
    emit TokenAdded(_tokenCode, _tokenAddress, _priceFeed);
}

function removeToken(string memory _tokenCode) external onlyOwner {
    require(tokenData[_tokenCode].isActive, "Token not active");
    
    // LOGICA:
    tokenData[_tokenCode].isActive = false;
    
    // Remove from array (swap and pop)
    for (uint256 i = 0; i < tokenCodes.length; i++) {
        if (keccak256(bytes(tokenCodes[i])) == keccak256(bytes(_tokenCode))) {
            tokenCodes[i] = tokenCodes[tokenCodes.length - 1];
            tokenCodes.pop();
            tokenCodesCount--;
            break;
        }
    }
    
    emit TokenRemoved(_tokenCode);
}
```

#### **2. Price Feed Management**
```solidity
function getTokenPrice(string memory _tokenCode) 
    public view 
    returns (uint256 price, uint256 updatedAt, bool isStale) 
{
    // VALIDAZIONI:
    require(tokenData[_tokenCode].isActive, "Token not active");
    
    TokenInfo memory token = tokenData[_tokenCode];
    AggregatorV3Interface priceFeed = AggregatorV3Interface(token.priceFeed);
    
    // LOGICA CHAINLINK:
    (
        uint80 roundId,
        int256 rawPrice,
        ,
        uint256 timestamp,
        uint80 answeredInRound
    ) = priceFeed.latestRoundData();
    
    // VALIDAZIONI CHAINLINK COMPLETE:
    require(rawPrice > 0, "Invalid price");
    require(timestamp > 0, "Round not complete");
    require(answeredInRound >= roundId, "Stale price");
    
    return (
        uint256(rawPrice),
        timestamp,
        block.timestamp - timestamp > token.heartbeat
    );
}

function getTokenPriceWithEvents(string memory _tokenCode) 
    public 
    returns (uint256 price, uint256 updatedAt) 
{
    try this.getTokenPrice(_tokenCode) returns (uint256 priceResult, uint256 updatedAtResult, bool isStale) {
        // UPDATE STORAGE se prezzo fresco
        if (!isStale) {
            tokenData[_tokenCode].lastPrice = priceResult;
            tokenData[_tokenCode].lastPriceTimestamp = updatedAtResult;
            
            // Reset error count su successo
            if (tokenErrors[_tokenCode] > 0) {
                tokenErrors[_tokenCode] = 0;
                emit TokenErrorsReset(_tokenCode);
            }
        } else {
            emit PriceStale(_tokenCode, updatedAtResult);
        }
        
        return (priceResult, updatedAtResult);
        
    } catch Error(string memory reason) {
        // ERROR TRACKING
        tokenErrors[_tokenCode]++;
        tokenData[_tokenCode].errorCount++;
        
        emit TokenError(_tokenCode, reason);
        
        if (tokenErrors[_tokenCode] >= maxErrors) {
            emit ErrorThresholdReached(_tokenCode);
        }
        
        revert(reason);
    }
}
```

#### **3. Token Queries**
```solidity
function isTokenActive(string memory _tokenCode) external view returns (bool) {
    return tokenData[_tokenCode].isActive;
}

function getTokenAddress(string memory _tokenCode) external view returns (address) {
    require(tokenData[_tokenCode].isActive, "Token not active");
    return tokenData[_tokenCode].tokenAddress;
}

function getActiveTokens() external view returns (string[] memory) {
    uint256 activeCount = 0;
    
    // Count active tokens
    for (uint256 i = 0; i < tokenCodes.length; i++) {
        if (tokenData[tokenCodes[i]].isActive) {
            activeCount++;
        }
    }
    
    // Build array
    string[] memory activeTokens = new string[](activeCount);
    uint256 index = 0;
    for (uint256 i = 0; i < tokenCodes.length; i++) {
        if (tokenData[tokenCodes[i]].isActive) {
            activeTokens[index] = tokenCodes[i];
            index++;
        }
    }
    
    return activeTokens;
}
```

### **Access Control**
```solidity
modifier onlyOwner() {
    require(msg.sender == owner(), "Only owner");
    _;
}

modifier validToken(string memory _tokenCode) {
    require(tokenData[_tokenCode].isActive, "Token not active");
    _;
}
```

### **Eventi Required**
```solidity
event TokenAdded(string indexed tokenCode, address indexed tokenAddress, address indexed priceFeed);
event TokenRemoved(string indexed tokenCode);
event HeartbeatUpdated(string indexed tokenCode, uint256 newHeartbeat);
event TokenError(string indexed tokenCode, string errorMessage);
event PriceStale(string indexed tokenCode, uint256 lastUpdateTime);
event ErrorThresholdReached(string indexed tokenCode);
event TokenErrorsReset(string indexed tokenCode);
```

### **Moduli Dependencies**
- **Input**: Beacon, ParameterManager, Chainlink Price Feeds
- **Output**: ValueCalculator, SwapManager, LiquidityManager, EmergencyHandler

### **Validazioni Business Logic**
1. WETH non può essere aggiunto come token del pool
2. Limite massimo di token per operazione
3. Validazioni complete dei price feed Chainlink
4. Error tracking e threshold alerts
5. Token codes devono essere unici e validi
6. Heartbeat validation per staleness detection

---

## 📊 **VALUECALCULATOR (Calcoli Valore)**

### **Ruolo e Responsabilità**
- **Calcolo valore totale del pool** in ETH terms
- **Cache system** per ottimizzazione gas sui prezzi
- **Percentuali distribuzione asset** per algoritmi di selezione
- **Aggregazione bilanci** da ProxyGeneral
- **Error handling** per price feeds malfunzionanti

### **Storage Requirements**

#### **State Variables**
```solidity
struct TokenValueCache {
    uint256 value;          // Valore totale posizione in ETH
    uint256 pricePerToken;  // Prezzo per singolo token (scale: priceFeedDecimals)
    uint256 timestamp;      // Quando aggiornata
    bool isValid;           // Se cache è valida
}

struct PoolValueInfo {
    uint256 totalValue;                    // Valore totale pool in ETH
    TokenValueInfo[] tokenValues;          // Info per ogni token
}

struct TokenValueInfo {
    string tokenCode;
    uint256 value;          // Valore posizione in ETH
    uint256 balance;        // Balance token nel ProxyGeneral
    uint256 pricePerToken;  // Prezzo per token
    uint256 percentage;     // Percentuale (basis points, 10000 = 100%)
}

mapping(string => TokenValueCache) private tokenValueCache;
mapping(string => uint256) private tokenErrors;

// Parameters
uint256 public cacheDuration;
uint256 public maxPriceAge;
uint256 public maxErrors;

address public immutable beacon;
```

### **Interfacce Required**

#### **Interfacce Esterne (Input)**
```solidity
interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}

interface ITokenManager {
    function getActiveTokens() external view returns (string[] memory);
    function getTokenAddress(string memory tokenCode) external view returns (address);
    function getTokenPriceWithEvents(string memory tokenCode) external returns (uint256 price, uint256 updatedAt);
    function getTokenPrice(string memory tokenCode) external view returns (uint256 price, uint256 updatedAt, bool isStale);
    function getTokenInfo(string memory tokenCode) external view returns (TokenInfo memory);
}

interface IProxyGeneral {
    function getAssetBalance(address asset) external view returns (uint256);
}

interface IParameterManager {
    function getCurrentParameterValue(string memory parameterName) external view returns (uint256);
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
interface IValueCalculator {
    // Value Calculations
    function calculateTokenValue(string memory tokenCode) external returns (uint256);
    function calculateTokenValueView(string memory tokenCode) external view returns (uint256);
    function getTotalPoolValue() external returns (PoolValueInfo memory);
    function getTotalPoolValueView() external view returns (uint256);
    
    // Cache Management
    function getCachedTokenValue(string memory tokenCode) external view returns (uint256 value, bool isValid);
    function getCachedTokenPrice(string memory tokenCode) external view returns (uint256 pricePerToken, bool isValid);
    function invalidateCache(string memory tokenCode) external;
    function invalidateAllCache() external;
    
    // Utility Functions
    function getTokenValueInfo(string memory tokenCode) external view returns (TokenValueInfo memory);
    function selectTokenForSwap(uint256 targetValue) external view returns (string memory tokenCode, uint256 amount);
    function validatePoolValue() external view returns (bool isValid, string memory errorReason);
}
```

### **Funzioni Core**

#### **1. Token Value Calculation**
```solidity
function calculateTokenValue(string memory _tokenCode) public returns (uint256) {
    // CHECK CACHE FIRST
    (uint256 cachedValue, bool isCacheValid) = getCachedTokenValue(_tokenCode);
    if (isCacheValid) {
        return cachedValue;
    }
    
    // GET FRESH PRICE
    ITokenManager tokenManager = ITokenManager(IBeacon(beacon).getImplementation("TokenManager"));
    
    try tokenManager.getTokenPriceWithEvents(_tokenCode) returns (uint256 price, uint256 timestamp) {
        // VALIDATE PRICE AGE
        require(block.timestamp - timestamp <= maxPriceAge, "Price too old");
        
        // GET TOKEN BALANCE FROM PROXYGENERAL
        address tokenAddress = tokenManager.getTokenAddress(_tokenCode);
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        uint256 tokenBalance = IERC20(tokenAddress).balanceOf(proxyGeneral);
        
        // GET TOKEN INFO FOR DECIMALS
        TokenInfo memory tokenInfo = tokenManager.getTokenInfo(_tokenCode);
        
        // CALCULATE VALUE (normalize by price feed decimals)
        uint256 value = (tokenBalance * price) / (10 ** tokenInfo.priceFeedDecimals);
        
        // UPDATE CACHE
        tokenValueCache[_tokenCode] = TokenValueCache({
            value: value,
            pricePerToken: price,
            timestamp: block.timestamp,
            isValid: true
        });
        
        // RESET ERRORS ON SUCCESS
        if (tokenErrors[_tokenCode] > 0) {
            tokenErrors[_tokenCode] = 0;
        }
        
        emit CacheUpdated(_tokenCode, value, price);
        return value;
        
    } catch Error(string memory reason) {
        // ERROR HANDLING
        tokenErrors[_tokenCode]++;
        
        emit TokenError(_tokenCode, reason);
        
        if (tokenErrors[_tokenCode] >= maxErrors) {
            emit ErrorThresholdReached(_tokenCode);
        }
        
        revert(string(abi.encodePacked("Value calculation failed for ", _tokenCode, ": ", reason)));
    }
}

function calculateTokenValueView(string memory _tokenCode) external view returns (uint256) {
    // VIEW-ONLY VERSION che non aggiorna cache/eventi
    (uint256 cachedValue, bool isCacheValid) = getCachedTokenValue(_tokenCode);
    if (isCacheValid) {
        return cachedValue;
    }
    
    // Calcola senza aggiornare storage
    ITokenManager tokenManager = ITokenManager(IBeacon(beacon).getImplementation("TokenManager"));
    (uint256 price, uint256 timestamp, bool isStale) = tokenManager.getTokenPrice(_tokenCode);
    
    require(!isStale && block.timestamp - timestamp <= maxPriceAge, "Price not reliable");
    
    address tokenAddress = tokenManager.getTokenAddress(_tokenCode);
    address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
    uint256 tokenBalance = IERC20(tokenAddress).balanceOf(proxyGeneral);
    
    TokenInfo memory tokenInfo = tokenManager.getTokenInfo(_tokenCode);
    return (tokenBalance * price) / (10 ** tokenInfo.priceFeedDecimals);
}
```

#### **2. Total Pool Value Calculation**
```solidity
function getTotalPoolValue() external returns (PoolValueInfo memory) {
    ITokenManager tokenManager = ITokenManager(IBeacon(beacon).getImplementation("TokenManager"));
    address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    
    // START WITH WETH BALANCE
    uint256 wethBalance = IWETH(wethAddress).balanceOf(proxyGeneral);
    uint256 totalValue = wethBalance;
    
    // GET ACTIVE TOKENS
    string[] memory activeTokens = tokenManager.getActiveTokens();
    
    // CALCULATE VALUE FOR EACH TOKEN
    TokenValueInfo[] memory tokenValues = new TokenValueInfo[](activeTokens.length + 1);
    
    // WETH info (index 0)
    tokenValues[0] = TokenValueInfo({
        tokenCode: "WETH",
        value: wethBalance,
        balance: wethBalance,
        pricePerToken: 1e18, // 1 WETH = 1 ETH by definition
        percentage: 0 // Will be calculated after total
    });
    
    // CALCULATE EACH TOKEN VALUE
    for (uint256 i = 0; i < activeTokens.length; i++) {
        string memory tokenCode = activeTokens[i];
        
        try this.calculateTokenValue(tokenCode) returns (uint256 tokenValue) {
            // GET ADDITIONAL INFO
            address tokenAddress = tokenManager.getTokenAddress(tokenCode);
            uint256 tokenBalance = IERC20(tokenAddress).balanceOf(proxyGeneral);
            
            TokenValueCache memory cache = tokenValueCache[tokenCode];
            uint256 pricePerToken = cache.isValid ? cache.pricePerToken : 0;
            
            tokenValues[i + 1] = TokenValueInfo({
                tokenCode: tokenCode,
                value: tokenValue,
                balance: tokenBalance,
                pricePerToken: pricePerToken,
                percentage: 0 // Will be calculated after total
            });
            
            totalValue += tokenValue;
            
        } catch Error(string memory reason) {
            // Log error but continue with other tokens
            emit TokenError(tokenCode, reason);
            
            tokenValues[i + 1] = TokenValueInfo({
                tokenCode: tokenCode,
                value: 0,
                balance: 0,
                pricePerToken: 0,
                percentage: 0
            });
        }
    }
    
    // CALCULATE PERCENTAGES (basis points)
    if (totalValue > 0) {
        for (uint256 i = 0; i < tokenValues.length; i++) {
            tokenValues[i].percentage = (tokenValues[i].value * 10000) / totalValue;
        }
    }
    
    emit PoolValueUpdated(totalValue);
    
    return PoolValueInfo({
        totalValue: totalValue,
        tokenValues: tokenValues
    });
}
```

#### **3. Cache Management**
```solidity
function getCachedTokenValue(string memory _tokenCode) public view returns (uint256 value, bool isValid) {
    TokenValueCache memory cache = tokenValueCache[_tokenCode];
    
    if (cache.isValid && block.timestamp - cache.timestamp <= cacheDuration) {
        return (cache.value, true);
    }
    
    return (0, false);
}

function getCachedTokenPrice(string memory _tokenCode) external view returns (uint256 pricePerToken, bool isValid) {
    TokenValueCache memory cache = tokenValueCache[_tokenCode];
    
    if (cache.isValid && block.timestamp - cache.timestamp <= cacheDuration) {
        return (cache.pricePerToken, true);
    }
    
    return (0, false);
}

function invalidateCache(string memory _tokenCode) external onlyAuthorized {
    delete tokenValueCache[_tokenCode];
    emit CacheCleared(_tokenCode);
}

function invalidateAllCache() external onlyOwner {
    ITokenManager tokenManager = ITokenManager(IBeacon(beacon).getImplementation("TokenManager"));
    string[] memory activeTokens = tokenManager.getActiveTokens();
    
    for (uint256 i = 0; i < activeTokens.length; i++) {
        delete tokenValueCache[activeTokens[i]];
        emit CacheCleared(activeTokens[i]);
    }
}
```

#### **4. Utility Functions**
```solidity
function selectTokenForSwap(uint256 targetValue) external view returns (string memory tokenCode, uint256 amount) {
    // GET CURRENT POOL STATE
    PoolValueInfo memory poolInfo = this.getTotalPoolValueView();
    
    string memory selectedToken;
    uint256 lowestPercentage = type(uint256).max;
    uint256 selectedAmount = 0;
    
    // FIND TOKEN WITH LOWEST PERCENTAGE THAT COVERS TARGET
    for (uint256 i = 1; i < poolInfo.tokenValues.length; i++) { // Skip WETH (index 0)
        TokenValueInfo memory tokenInfo = poolInfo.tokenValues[i];
        
        if (tokenInfo.value >= targetValue && tokenInfo.percentage < lowestPercentage) {
            lowestPercentage = tokenInfo.percentage;
            selectedToken = tokenInfo.tokenCode;
            
            // CALCULATE AMOUNT NEEDED (with 10% buffer)
            uint256 targetWithBuffer = (targetValue * 110) / 100;
            
            if (tokenInfo.pricePerToken > 0) {
                ITokenManager tokenManager = ITokenManager(IBeacon(beacon).getImplementation("TokenManager"));
                TokenInfo memory tokenData = tokenManager.getTokenInfo(selectedToken);
                
                selectedAmount = (targetWithBuffer * (10 ** tokenData.tokenDecimals)) / tokenInfo.pricePerToken;
            }
        }
    }
    
    require(bytes(selectedToken).length > 0, "No suitable token found for swap");
    require(selectedAmount > 0, "Cannot calculate swap amount");
    
    return (selectedToken, selectedAmount);
}
```

### **Access Control**
```solidity
modifier onlyAuthorized() {
    address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
    require(
        IProxyGeneral(proxyGeneral).isAuthorizedModule(msg.sender) || 
        msg.sender == owner(),
        "Not authorized"
    );
    _;
}
```

### **Eventi Required**
```solidity
event CacheUpdated(string indexed tokenCode, uint256 value, uint256 pricePerToken);
event PoolValueUpdated(uint256 totalValue);
event CacheCleared(string indexed tokenCode);
event TokenError(string indexed tokenCode, string errorMessage);
event ErrorThresholdReached(string indexed tokenCode);
```

### **Moduli Dependencies**
- **Input**: Beacon, TokenManager, ProxyGeneral, ParameterManager
- **Output**: LiquidityManager (per calcoli withdraw/swap), UI/Dashboard

### **Validazioni Business Logic**
1. Cache TTL validation per evitare dati stantii
2. Price age validation per sicurezza prezzi
3. Error tracking e recovery per price feeds malfunzionanti
4. Bilanci letti sempre da ProxyGeneral (custode asset)
5. Calcoli percentuali accurate per algoritmi selezione token
6. View functions separate per UI senza state changes

---

*Fine Parte 1 - Prossima parte: LiquidityManager, SwapManager, EmergencyHandler, ParameterManager*