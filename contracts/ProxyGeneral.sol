// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/IWETH.sol";

/**
 * @title ProxyGeneral
 * @dev Custode centrale di tutti gli asset (WETH + ERC20 tokens) + LP Token ERC20
 * @notice Contratto che gestisce la custodia asset, l'autorizzazione moduli e il controllo emergency
 * @custom:security-contact security@yourdomain.com
 */
contract ProxyGeneral is ERC20, Ownable, ReentrancyGuard {
    /// @notice Indirizzo del contratto Beacon per resolution moduli
    address public immutable beacon;
    
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
    constructor(address _beacon) ERC20("LP Token", "LPT") Ownable() {
        require(_beacon != address(0), "Invalid beacon address");
        beacon = _beacon;
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
        
        // Transfer WETH
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        if (wethAddress != address(0)) {
            uint256 wethBalance = IERC20(wethAddress).balanceOf(address(this));
            if (wethBalance > 0) {
                IERC20(wethAddress).transfer(recipient, wethBalance);
            }
        }
        
        // Transfer ETH se presente
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
        // Accetta ETH silenziosamente per supportare WETH.withdraw() e depositi
    }

    /**
     * @notice Fallback function
     */
    fallback() external payable {
        revert("Function does not exist");
    }
}