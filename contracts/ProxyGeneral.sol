// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/ITokenManagerForModules.sol";

/**
 * @title ProxyGeneral
 * @dev Custode centrale di tutti gli asset (base asset + ERC20 tokens) + LP Token ERC20
 * @notice Contratto che gestisce la custodia asset, l'autorizzazione moduli e il controllo emergency
 * @custom:security-contact security@yourdomain.com
 */
contract ProxyGeneral is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    /// @notice Indirizzo del contratto Beacon per resolution moduli
    address public immutable beacon;
    
    /// @notice Base asset code for this pool (e.g. "WETH", "USDC", "WBTC")
    string public baseAssetCode;
    
    /// @notice Flag per emergency pause di tutto il sistema
    bool public paused;

    /// @notice Mapping dei moduli autorizzati a chiamare funzioni sensibili
    mapping(address => bool) public authorizedModules;

    /// @notice Emergency state tracking
    address public emergencyRecipient;
    uint256 public emergencyExecutedAt;

    /// @notice Cross-module shared state per rate limiting utenti
    mapping(address => mapping(uint256 => uint256)) public hourlyWithdrawnAmounts; // user => hour => amount

    /// @notice Storage opzionale per parametri condivisi cross-modulo
    mapping(string => uint256) public moduleParameters;

    // ==================== RATE LIMITING STORAGE ====================

    /// @notice Rate limit tracking structure
    struct RateLimit {
        uint256 hourlyLimit;      // Limite orario in wei
        uint256 dailyLimit;       // Limite giornaliero in wei
        uint256 hourlyUsed;       // Consumato nell'ora corrente
        uint256 dailyUsed;        // Consumato nel giorno corrente
        uint256 lastHourReset;    // Timestamp ultimo reset orario
        uint256 lastDayReset;     // Timestamp ultimo reset giornaliero
    }

    /// @notice Per-user rate limits per operation type
    mapping(address => mapping(string => RateLimit)) private userRateLimits;

    /// @notice Global rate limits configuration per operation type
    mapping(string => RateLimit) private globalRateLimits;

    // ==================== EVENTS ====================

    /// @notice Emesso quando LP tokens sono minted
    event LPTokenMinted(address indexed to, uint256 amount, uint256 newTotalSupply);
    
    /// @notice Emesso quando LP tokens sono burned
    event LPTokenBurned(address indexed from, uint256 amount, uint256 newTotalSupply);
    
    /// @notice Emesso quando asset sono trasferiti
    event AssetTransferred(address indexed to, address indexed asset, uint256 amount, address indexed module);
    
    /// @notice Emesso quando uno spender è approvato per token
    event SpenderApproved(address indexed token, address indexed spender, uint256 amount, address indexed module);
    
    /// @notice Emesso quando asset sono trasferiti temporaneamente a un modulo
    event AssetTransferredToModule(address indexed token, address indexed module, uint256 amount);
    
    /// @notice Emesso quando un modulo è autorizzato
    event ModuleAuthorized(address indexed module, string moduleType);
    
    /// @notice Emesso quando un modulo è de-autorizzato
    event ModuleDeauthorized(address indexed module);
    
    /// @notice Emesso quando il sistema è messo in pausa
    event Paused(address indexed account);
    
    /// @notice Emesso quando il sistema è riattivato
    event Unpaused(address indexed account);
    
    /// @notice Emesso quando emergency transfer è eseguito
    event EmergencyTransferExecuted(address indexed recipient, uint256 timestamp);
    
    /// @notice Emesso quando hourly withdrawn è aggiornato
    event HourlyWithdrawnUpdated(address indexed user, uint256 hour, uint256 amount);
    
    /// @notice Emesso quando hourly withdrawn è incrementato
    event HourlyWithdrawnIncremented(address indexed user, uint256 hour, uint256 amount);

    // Rate limiting events
    event OperationTracked(address indexed user, string operationType, uint256 amount, uint256 timestamp);
    event RateLimitExceeded(address indexed user, string operationType, uint256 amount, uint256 remaining);
    event RateLimitUpdated(string operationType, uint256 hourlyLimit, uint256 dailyLimit);

    // Token operation events
    event TokenDeposited(string indexed tokenCode, uint256 amount, address indexed from);
    event TokenWithdrawn(string indexed tokenCode, uint256 amount, address indexed to);
    event ETHDeposited(address indexed from, uint256 amount);
    event ETHWithdrawn(address indexed to, uint256 amount);
    event ETHWrapped(uint256 amount);
    event ETHUnwrapped(uint256 amount);

    // ==================== MODIFIERS ====================

    /// @notice Solo moduli autorizzati o owner possono chiamare
    modifier onlyAuthorizedModule() {
        require(
            authorizedModules[msg.sender] || msg.sender == owner(),
            "Caller not authorized"
        );
        _;
    }

    /// @notice Solo quando il sistema non è in pausa
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    /// @notice Solo quando il sistema è in pausa
    modifier whenPaused() {
        require(paused, "Contract is not paused");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    /**
     * @dev Constructor che imposta il Beacon e inizializza LP token
     * @param _beacon Indirizzo del contratto Beacon
     */
    constructor(address _beacon, string memory _baseAssetCode) ERC20("LP Token", "LPT") Ownable() {
        require(_beacon != address(0), "Invalid beacon address");
        require(bytes(_baseAssetCode).length > 0, "Invalid base asset code");
        beacon = _beacon;
        baseAssetCode = _baseAssetCode;
        paused = false;
    }

    // ==================== LP TOKEN MANAGEMENT ====================

    /**
     * @notice Mint LP tokens per un utente
     * @dev Solo moduli autorizzati possono chiamare questa funzione
     * @param to Indirizzo che riceverà i LP tokens
     * @param amount Quantità di LP tokens da mintare
     */
    function mint(address to, uint256 amount) external onlyAuthorizedModule whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Cannot mint zero amount");
        
        _mint(to, amount);
        
        emit LPTokenMinted(to, amount, totalSupply());
    }

    /**
     * @notice Burn LP tokens da un utente
     * @dev Solo moduli autorizzati possono chiamare questa funzione
     * @param from Indirizzo da cui bruciare i LP tokens
     * @param amount Quantità di LP tokens da bruciare
     */
    function burn(address from, uint256 amount) external onlyAuthorizedModule whenNotPaused {
        require(from != address(0), "Cannot burn from zero address");
        require(amount > 0, "Cannot burn zero amount");
        require(balanceOf(from) >= amount, "Insufficient LP token balance");
        
        _burn(from, amount);
        
        emit LPTokenBurned(from, amount, totalSupply());
    }

    // ==================== ASSET MANAGEMENT ====================

    /**
     * @notice Trasferisce fondi dal ProxyGeneral a un indirizzo
     * @dev Solo moduli autorizzati possono chiamare questa funzione
     * @param to Indirizzo destinatario
     * @param asset Indirizzo del token asset (address(0) per ETH)
     * @param amount Quantità da trasferire
     */
    function transferFunds(address to, address asset, uint256 amount) external onlyAuthorizedModule whenNotPaused {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        
        if (asset == address(0)) {
            // Trasferimento ETH
            require(address(this).balance >= amount, "Insufficient ETH balance");
            (bool success, ) = to.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // Trasferimento ERC20
            uint256 currentBalance = IERC20(asset).balanceOf(address(this));
            require(currentBalance >= amount, "Insufficient asset balance");
            
            bool success = IERC20(asset).transfer(to, amount);
            require(success, "Asset transfer failed");
        }
        
        emit AssetTransferred(to, asset, amount, msg.sender);
    }

    /**
     * @notice Ottiene il bilancio di un asset detenuto dal ProxyGeneral
     * @param asset Indirizzo del token asset (address(0) per ETH)
     * @return Bilancio dell'asset
     */
    function getAssetBalance(address asset) external view returns (uint256) {
        if (asset == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(asset).balanceOf(address(this));
        }
    }

    // ==================== TOKEN CUSTODY OPERATIONS ====================

    /**
     * @notice Preleva token dal custody ProxyGeneral
     * @dev Solo moduli autorizzati. Risolve tokenAddress tramite TokenManager.
     * @param tokenCode Codice token (es: "WETH", "USDC", "WBTC")
     * @param amount Quantità token in wei/smallest unit
     * @param to Indirizzo destinatario (user o modulo)
     * 
     * @custom:security onlyAuthorizedModule
     * @custom:validation tokenCode must be active in TokenManager
     * @custom:validation amount > 0
     * @custom:validation to != address(0)
     * @custom:validation sufficient balance in custody
     * 
     * @custom:emits TokenWithdrawn
     * @custom:reverts "Invalid token code" se tokenCode vuoto
     * @custom:reverts "Invalid amount" se amount == 0
     * @custom:reverts "Invalid recipient" se to == address(0)
     * @custom:reverts "Token not active" se token non trovato (da TokenManager)
     * @custom:reverts "Invalid token address" se resolution fallisce
     * @custom:reverts "Insufficient token balance" se balance < amount
     * @custom:reverts SafeERC20 errors se transfer fallisce
     */
    function withdrawToken(
        string memory tokenCode, 
        uint256 amount, 
        address to
    ) external onlyAuthorizedModule whenNotPaused {
        // VALIDAZIONI INIZIALI
        require(bytes(tokenCode).length > 0, "Invalid token code");
        require(amount > 0, "Invalid amount");
        require(to != address(0), "Invalid recipient");
        
        address tokenAddress = _resolveTokenAddress(tokenCode);
        
        // CHECK BALANCE
        uint256 currentBalance = IERC20(tokenAddress).balanceOf(address(this));
        require(currentBalance >= amount, "Insufficient token balance");
        
        // EXECUTE TRANSFER (SafeERC20 auto-reverts on failure)
        IERC20(tokenAddress).safeTransfer(to, amount);
        
        // EMIT EVENT
        emit TokenWithdrawn(tokenCode, amount, to);
    }

    /**
     * @notice Deposita token nel custody ProxyGeneral
     * @dev Solo moduli autorizzati. Richiede approval preventiva.
     * @param tokenCode Codice token (es: "WETH", "USDC", "WBTC")
     * @param amount Quantità token in wei/smallest unit
     * @param from Indirizzo mittente (deve aver dato approval)
     * 
     * @custom:security onlyAuthorizedModule
     * @custom:validation tokenCode must be active in TokenManager
     * @custom:validation amount > 0
     * @custom:validation from != address(0)
     * @custom:validation from must have approved ProxyGeneral
     * 
     * @custom:emits TokenDeposited
     * @custom:reverts "Invalid token code" se tokenCode vuoto
     * @custom:reverts "Invalid amount" se amount == 0
     * @custom:reverts "Invalid sender" se from == address(0)
     * @custom:reverts "Token not active" se token non trovato (da TokenManager)
     * @custom:reverts "Invalid token address" se resolution fallisce
     * @custom:reverts SafeERC20 errors se transferFrom fallisce o no approval
     */
    function depositToken(
        string memory tokenCode, 
        uint256 amount, 
        address from
    ) external onlyAuthorizedModule whenNotPaused {
        // VALIDAZIONI INIZIALI
        require(bytes(tokenCode).length > 0, "Invalid token code");
        require(amount > 0, "Invalid amount");
        require(from != address(0), "Invalid sender");
        
        address tokenAddress = _resolveTokenAddress(tokenCode);
        
        // EXECUTE TRANSFER FROM (SafeERC20 auto-reverts on failure)
        IERC20(tokenAddress).safeTransferFrom(from, address(this), amount);
        
        // EMIT EVENT
        emit TokenDeposited(tokenCode, amount, from);
    }

    // ==================== INTERNAL TOKEN RESOLUTION ====================

    /**
     * @notice Resolve token address from token code
     * @dev Base asset is resolved via Beacon("BASE_ASSET"), other tokens via TokenManager
     * @param tokenCode Token identifier (e.g. "WETH", "USDC", "WBTC")
     * @return tokenAddress Resolved ERC20 address
     */
    function _resolveTokenAddress(string memory tokenCode) internal view returns (address tokenAddress) {
        // Base asset is resolved via Beacon directly (not in TokenManager)
        if (keccak256(bytes(tokenCode)) == keccak256(bytes(baseAssetCode))) {
            tokenAddress = IBeacon(beacon).getImplementation("BASE_ASSET");
            require(tokenAddress != address(0), "Base asset not found in Beacon");
        } else {
            // Other tokens resolved via TokenManager
            address tokenManagerAddr = IBeacon(beacon).getImplementation("TokenManager");
            require(tokenManagerAddr != address(0), "TokenManager not found");
            
            ITokenManagerForModules tokenManager = ITokenManagerForModules(tokenManagerAddr);
            ITokenManagerForModules.TokenInfo memory tokenInfo = tokenManager.getTokenInfo(tokenCode);
            
            tokenAddress = tokenInfo.tokenAddress;
            require(tokenAddress != address(0), "Invalid token address");
        }
    }

    // ==================== SWAP SUPPORT ====================

    /**
     * @notice Approva uno spender per un token specifico
     * @dev Solo moduli autorizzati possono chiamare questa funzione
     * @param token Indirizzo del token da approvare
     * @param spender Indirizzo dello spender
     * @param amount Quantità da approvare
     */
    function approveSpender(address token, address spender, uint256 amount) external onlyAuthorizedModule {
        require(token != address(0), "Invalid token");
        require(spender != address(0), "Invalid spender");
        
        IERC20(token).approve(spender, amount);
        
        emit SpenderApproved(token, spender, amount, msg.sender);
    }

    /**
     * @notice Trasferisce token temporaneamente a un modulo per operazioni
     * @dev Solo moduli autorizzati possono chiamare questa funzione
     * @param token Indirizzo del token
     * @param module Indirizzo del modulo destinatario
     * @param amount Quantità da trasferire
     */
    function transferToModule(address token, address module, uint256 amount) external onlyAuthorizedModule {
        require(authorizedModules[module], "Module not authorized");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
        
        bool success = IERC20(token).transfer(module, amount);
        require(success, "Transfer to module failed");
        
        emit AssetTransferredToModule(token, module, amount);
    }

    /**
     * @notice Riceve token da un modulo dopo operazioni
     * @dev Solo moduli autorizzati possono chiamare questa funzione
     * @param token Indirizzo del token
     * @param module Indirizzo del modulo mittente
     * @param amount Quantità da ricevere
     */
    function transferFromModule(address token, address module, uint256 amount) external onlyAuthorizedModule {
        require(authorizedModules[module], "Module not authorized");
        
        bool success = IERC20(token).transferFrom(module, address(this), amount);
        require(success, "Transfer from module failed");
    }

    // ==================== ACCESS CONTROL ====================

    /**
     * @notice Autorizza un modulo a chiamare funzioni sensibili
     * @dev Solo l'owner può chiamare questa funzione
     * @param module Indirizzo del modulo da autorizzare
     * @param moduleType Tipo del modulo (es. "TokenManager", "SwapManager")
     */
    function authorizeModule(address module, string memory moduleType) external onlyOwner {
        require(module != address(0), "Invalid module address");
        require(!authorizedModules[module], "Module already authorized");
        
        authorizedModules[module] = true;
        emit ModuleAuthorized(module, moduleType);
    }

    /**
     * @notice Rimuove l'autorizzazione da un modulo
     * @dev Solo l'owner può chiamare questa funzione
     * @param module Indirizzo del modulo da de-autorizzare
     */
    function deauthorizeModule(address module) external onlyOwner {
        require(authorizedModules[module], "Module not authorized");
        
        authorizedModules[module] = false;
        emit ModuleDeauthorized(module);
    }

    /**
     * @notice Verifica se un modulo è autorizzato
     * @param module Indirizzo del modulo
     * @return True se il modulo è autorizzato
     */
    function isAuthorizedModule(address module) external view returns (bool) {
        return authorizedModules[module];
    }

    // ==================== EMERGENCY CONTROLS ====================

    /**
     * @notice Mette il sistema in pausa
     * @dev Solo moduli autorizzati possono chiamare questa funzione
     */
    function pause() external onlyAuthorizedModule {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Riattiva il sistema dalla pausa
     * @dev Solo l'owner può chiamare questa funzione
     */
    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Verifica se il sistema è in pausa
     * @return True se il sistema è in pausa
     */
    function isPaused() external view returns (bool) {
        return paused;
    }

    /**
     * @notice Trasferisce tutti gli asset in caso di emergenza
     * @dev Solo l'owner può chiamare questa funzione e solo quando in pausa
     * @param recipient Indirizzo che riceverà tutti gli asset
     */
    function emergencyTransferAll(address recipient) external onlyOwner whenPaused {
        require(recipient != address(0), "Invalid recipient");
        
        // Transfer base asset
        address baseAssetAddr = IBeacon(beacon).getImplementation("BASE_ASSET");
        if (baseAssetAddr != address(0)) {
            uint256 baseBalance = IERC20(baseAssetAddr).balanceOf(address(this));
            if (baseBalance > 0) {
                IERC20(baseAssetAddr).safeTransfer(recipient, baseBalance);
            }
        }
        
        // Transfer ETH se presente (from DepositHelper or other sources)
        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            (bool success, ) = recipient.call{value: ethBalance}("");
            require(success, "ETH emergency transfer failed");
        }
        
        emergencyRecipient = recipient;
        emergencyExecutedAt = block.timestamp;
        
        emit EmergencyTransferExecuted(recipient, block.timestamp);
    }

    // ==================== CROSS-MODULE STATE MANAGEMENT ====================

    // ==================== RATE LIMITING FUNCTIONS ====================

    /**
     * @notice Configura limiti rate limiting per tipo operazione
     * @dev Solo owner. Inizializza o aggiorna limiti globali.
     * @param operationType Tipo operazione ("deposit", "withdraw", etc.)
     * @param hourlyLimit Limite orario in wei (0 = unlimited)
     * @param dailyLimit Limite giornaliero in wei (0 = unlimited)
     */
    function setRateLimit(
        string memory operationType, 
        uint256 hourlyLimit, 
        uint256 dailyLimit
    ) external onlyOwner {
        require(bytes(operationType).length > 0, "Invalid operation type");
        require(hourlyLimit <= dailyLimit || dailyLimit == 0, "Hourly limit exceeds daily limit");
        
        globalRateLimits[operationType] = RateLimit({
            hourlyLimit: hourlyLimit,
            dailyLimit: dailyLimit,
            hourlyUsed: 0,
            dailyUsed: 0,
            lastHourReset: block.timestamp,
            lastDayReset: block.timestamp
        });
        
        emit RateLimitUpdated(operationType, hourlyLimit, dailyLimit);
    }

    /**
     * @notice Verifica se operazione è permessa per rate limit
     * @param user Indirizzo utente
     * @param operationType Tipo operazione ("deposit", "withdraw", etc.)
     * @param amount Quantità proposta (in wei)
     * @return allowed True se operazione permessa
     * @return remainingHourly Quanto può ancora usare nell'ora corrente
     * @return remainingDaily Quanto può ancora usare nel giorno corrente
     */
    function checkRateLimit(
        address user, 
        string memory operationType, 
        uint256 amount
    ) external view returns (
        bool allowed, 
        uint256 remainingHourly, 
        uint256 remainingDaily
    ) {
        // Get global configuration
        RateLimit storage globalLimit = globalRateLimits[operationType];
        
        // If no limit configured, allow all
        if (globalLimit.hourlyLimit == 0 && globalLimit.dailyLimit == 0) {
            return (true, type(uint256).max, type(uint256).max);
        }
        
        // Get user limit
        RateLimit storage userLimit = userRateLimits[user][operationType];
        
        // Calculate effective usage (with expiration check)
        uint256 effectiveHourlyUsed = userLimit.hourlyUsed;
        uint256 effectiveDailyUsed = userLimit.dailyUsed;
        
        // Check if hour period expired
        if (userLimit.lastHourReset > 0 && block.timestamp >= userLimit.lastHourReset + 1 hours) {
            effectiveHourlyUsed = 0;
        }
        
        // Check if day period expired
        if (userLimit.lastDayReset > 0 && block.timestamp >= userLimit.lastDayReset + 1 days) {
            effectiveDailyUsed = 0;
        }
        
        // Calculate remaining amounts
        remainingHourly = globalLimit.hourlyLimit > effectiveHourlyUsed 
            ? globalLimit.hourlyLimit - effectiveHourlyUsed 
            : 0;
            
        remainingDaily = globalLimit.dailyLimit > effectiveDailyUsed 
            ? globalLimit.dailyLimit - effectiveDailyUsed 
            : 0;
        
        // Check if operation allowed
        allowed = (remainingHourly >= amount && remainingDaily >= amount);
        
        // If not allowed, emit event for monitoring
        if (!allowed) {
            // Note: cannot emit in view function, monitoring must be done via off-chain tools
        }
        
        return (allowed, remainingHourly, remainingDaily);
    }

    /**
     * @notice Traccia operazione completata per rate limiting
     * @dev Solo moduli autorizzati. Chiamare DOPO esecuzione operazione.
     * @param user Indirizzo utente che ha eseguito operazione
     * @param operationType Tipo operazione ("deposit", "withdraw", etc.)
     * @param amount Quantità effettivamente processata (in wei)
     */
    function trackOperation(
        address user, 
        string memory operationType, 
        uint256 amount
    ) external onlyAuthorizedModule {
        require(amount > 0, "Invalid amount");
        
        // Get global configuration
        RateLimit storage globalLimit = globalRateLimits[operationType];
        
        // If no limit configured, no tracking needed
        if (globalLimit.hourlyLimit == 0 && globalLimit.dailyLimit == 0) {
            emit OperationTracked(user, operationType, amount, block.timestamp);
            return;
        }
        
        // Get or initialize user limit
        RateLimit storage userLimit = userRateLimits[user][operationType];
        
        // Initialize on first use
        if (userLimit.lastHourReset == 0) {
            userLimit.hourlyLimit = globalLimit.hourlyLimit;
            userLimit.dailyLimit = globalLimit.dailyLimit;
            userLimit.lastHourReset = block.timestamp;
            userLimit.lastDayReset = block.timestamp;
        }
        
        // Reset hourly counter if period expired
        if (block.timestamp >= userLimit.lastHourReset + 1 hours) {
            userLimit.hourlyUsed = 0;
            userLimit.lastHourReset = block.timestamp;
        }
        
        // Reset daily counter if period expired
        if (block.timestamp >= userLimit.lastDayReset + 1 days) {
            userLimit.dailyUsed = 0;
            userLimit.lastDayReset = block.timestamp;
        }
        
        // Check for overflow before incrementing
        require(userLimit.hourlyUsed + amount >= userLimit.hourlyUsed, "Hourly overflow");
        require(userLimit.dailyUsed + amount >= userLimit.dailyUsed, "Daily overflow");
        
        // Track operation
        userLimit.hourlyUsed += amount;
        userLimit.dailyUsed += amount;
        
        emit OperationTracked(user, operationType, amount, block.timestamp);
    }

    // ==================== LEGACY HOURLY TRACKING (BACKWARD COMPATIBILITY) ====================

    /**
     * @notice Imposta l'importo prelevato in una specifica ora per un utente
     * @dev Solo moduli autorizzati possono chiamare questa funzione
     * @param user Indirizzo dell'utente
     * @param hour Timestamp dell'ora (in ore)
     * @param amount Importo prelevato
     */
    function setHourlyWithdrawn(address user, uint256 hour, uint256 amount) external onlyAuthorizedModule {
        hourlyWithdrawnAmounts[user][hour] = amount;
        emit HourlyWithdrawnUpdated(user, hour, amount);
    }

    /**
     * @notice Ottiene l'importo prelevato in una specifica ora per un utente
     * @param user Indirizzo dell'utente
     * @param hour Timestamp dell'ora (in ore)
     * @return Importo prelevato in quella ora
     */
    function getHourlyWithdrawn(address user, uint256 hour) external view returns (uint256) {
        return hourlyWithdrawnAmounts[user][hour];
    }

    /**
     * @notice Incrementa l'importo prelevato nell'ora corrente per un utente
     * @dev Solo moduli autorizzati possono chiamare questa funzione
     * @param user Indirizzo dell'utente
     * @param amount Importo da aggiungere
     */
    function incrementHourlyWithdrawn(address user, uint256 amount) external onlyAuthorizedModule {
        uint256 currentHour = block.timestamp / 1 hours;
        hourlyWithdrawnAmounts[user][currentHour] += amount;
        emit HourlyWithdrawnIncremented(user, currentHour, amount);
    }

    // ==================== PARAMETER STORAGE (OPZIONALE) ====================

    /**
     * @notice Imposta un parametro condiviso cross-modulo
     * @dev Solo l'owner può chiamare questa funzione
     * @param parameterName Nome del parametro
     * @param value Valore del parametro
     */
    function setModuleParameter(string memory parameterName, uint256 value) external onlyOwner {
        moduleParameters[parameterName] = value;
    }

    /**
     * @notice Ottiene un parametro condiviso cross-modulo
     * @param parameterName Nome del parametro
     * @return Valore del parametro
     */
    function getModuleParameter(string memory parameterName) external view returns (uint256) {
        return moduleParameters[parameterName];
    }

    // ==================== RECEIVE/FALLBACK ====================

    /**
     * @notice Accetta ETH diretto (per WETH unwrapping e depositi diretti)
     */
    receive() external payable {
        // Accetta ETH per supportare DepositHelper wrapping e operazioni WETH
    }

    /**
     * @notice Fallback function
     */
    fallback() external payable {
        revert("Function does not exist");
    }
}