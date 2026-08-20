// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IProxyGeneral
 * @dev Interfaccia completa per ProxyGeneral come da specs - ERC20 LP Token + Custody
 */
interface IProxyGeneral {
    
    // ==================== ERC20 LP TOKEN FUNCTIONS ====================
    
    /**
     * @notice Nome del token LP
     * @return name Nome token
     */
    function name() external view returns (string memory);
    
    /**
     * @notice Simbolo del token LP
     * @return symbol Simbolo token
     */
    function symbol() external view returns (string memory);
    
    /**
     * @notice Decimali del token LP
     * @return decimals Numero decimali
     */
    function decimals() external view returns (uint8);
    
    /**
     * @notice Supply totale LP tokens
     * @return totalSupply Supply totale
     */
    function totalSupply() external view returns (uint256);
    
    /**
     * @notice Balance LP tokens di un utente
     * @param account Indirizzo utente
     * @return balance Balance utente
     */
    function balanceOf(address account) external view returns (uint256);
    
    /**
     * @notice Trasferisce LP tokens
     * @param to Destinatario
     * @param amount Quantità
     * @return success Se trasferimento riuscito
     */
    function transfer(address to, uint256 amount) external returns (bool);
    
    /**
     * @notice Allowance per LP tokens
     * @param owner Proprietario
     * @param spender Autorizzato
     * @return allowance Allowance corrente
     */
    function allowance(address owner, address spender) external view returns (uint256);
    
    /**
     * @notice Approva spesa LP tokens
     * @param spender Autorizzato
     * @param amount Quantità
     * @return success Se approvazione riuscita
     */
    function approve(address spender, uint256 amount) external returns (bool);
    
    /**
     * @notice Approva spender per un token specifico (per swap)
     * @param token Indirizzo del token
     * @param spender Indirizzo dello spender
     * @param amount Quantità da approvare
     */
    function approveSpender(address token, address spender, uint256 amount) external;
    
    /**
     * @notice Trasferisce LP tokens da un indirizzo
     * @param from Mittente
     * @param to Destinatario
     * @param amount Quantità
     * @return success Se trasferimento riuscito
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // ==================== LP TOKEN MINTING/BURNING ====================
    
    /**
     * @notice Minta nuovi LP tokens
     * @param to Destinatario
     * @param amount Quantità da mintare
     */
    function mint(address to, uint256 amount) external;
    
    /**
     * @notice Brucia LP tokens
     * @param from Proprietario
     * @param amount Quantità da bruciare
     */
    function burn(address from, uint256 amount) external;

    // ==================== CUSTODY MANAGEMENT ====================
    
    /**
     * @notice Deposita token nel custody
     * @param tokenCode Codice token (es: "WBTC")
     * @param amount Quantità token
     * @param from Mittente
     */
    function depositToken(string memory tokenCode, uint256 amount, address from) external;
    
    /**
     * @notice Preleva token dal custody
     * @param tokenCode Codice token
     * @param amount Quantità token
     * @param to Destinatario
     */
    function withdrawToken(string memory tokenCode, uint256 amount, address to) external;
    
    /**
     * @notice Ottiene balance di un asset specifico
     * @param asset Indirizzo del token (address(0) per ETH)
     * @return balance Balance dell'asset
     */
    function getAssetBalance(address asset) external view returns (uint256 balance);
    
    /**
     * @notice Balance token nel custody
     * @param tokenCode Codice token
     * @return balance Balance corrente
     */
    function getTokenBalance(string memory tokenCode) external view returns (uint256 balance);
    
    /**
     * @notice Lista tutti i token nel custody
     * @return tokenCodes Array codici token
     * @return balances Array balance corrispondenti
     */
    function getAllTokenBalances() external view returns (string[] memory tokenCodes, uint256[] memory balances);
    
    /**
     * @notice Trasferisce fondi (ETH o token) dal custody a un destinatario
     * @param to Indirizzo destinatario
     * @param asset Indirizzo del token (address(0) per ETH)
     * @param amount Quantità da trasferire
     */
    function transferFunds(address to, address asset, uint256 amount) external;

    // ==================== ETH/WETH MANAGEMENT ====================
    
    /**
     * @notice Deposita ETH nel pool
     */
    function depositETH() external payable;
    
    /**
     * @notice Preleva ETH dal pool
     * @param amount Quantità ETH
     * @param to Destinatario
     */
    function withdrawETH(uint256 amount, address payable to) external;
    
    /**
     * @notice Balance ETH del contratto
     * @return balance Balance ETH
     */
    function getETHBalance() external view returns (uint256 balance);
    
    /**
     * @notice Converte ETH in WETH
     * @param amount Quantità ETH
     */
    function wrapETH(uint256 amount) external;
    
    /**
     * @notice Converte WETH in ETH
     * @param amount Quantità WETH
     */
    function unwrapWETH(uint256 amount) external;

    // ==================== RATE LIMITING ====================
    
    /**
     * @notice Ottiene l'importo prelevato in una specifica ora per un utente
     * @param user Indirizzo dell'utente
     * @param hour Timestamp dell'ora (in ore dal epoch)
     * @return amount Importo prelevato in quella ora
     */
    function getHourlyWithdrawn(address user, uint256 hour) external view returns (uint256 amount);
    
    /**
     * @notice Traccia operazione per rate limiting
     * @param user Utente
     * @param operationType Tipo operazione ("withdraw", "deposit", etc.)
     * @param amount Quantità operazione
     */
    function trackOperation(address user, string memory operationType, uint256 amount) external;
    
    /**
     * @notice Verifica rate limit per utente
     * @param user Utente
     * @param operationType Tipo operazione
     * @param amount Quantità proposta
     * @return allowed Se operazione permessa
     * @return remainingHourly Rimanente limite orario
     * @return remainingDaily Rimanente limite giornaliero
     */
    function checkRateLimit(address user, string memory operationType, uint256 amount) 
        external view returns (bool allowed, uint256 remainingHourly, uint256 remainingDaily);
    
    /**
     * @notice Imposta limiti rate limiting
     * @param operationType Tipo operazione
     * @param hourlyLimit Limite orario
     * @param dailyLimit Limite giornaliero
     */
    function setRateLimit(string memory operationType, uint256 hourlyLimit, uint256 dailyLimit) external;

    // ==================== POOL VALUE CALCULATION ====================
    
    /**
     * @notice Calcola valore totale del pool
     * @return totalValue Valore totale in ETH
     */
    function calculateTotalValue() external view returns (uint256 totalValue);
    
    /**
     * @notice Valore per singolo LP token
     * @return valuePerToken Valore in ETH per LP token
     */
    function getValuePerLPToken() external view returns (uint256 valuePerToken);
    
    /**
     * @notice Statistiche complete del pool
     * @return totalValue Valore totale
     * @return totalSupply Supply LP tokens
     * @return ethBalance Balance ETH
     * @return wethBalance Balance WETH  
     * @return tokenCount Numero token diversi
     */
    function getPoolStatistics() external view returns (
        uint256 totalValue,
        uint256 totalSupply,
        uint256 ethBalance,
        uint256 wethBalance,
        uint256 tokenCount
    );

    // ==================== ACCESS CONTROL ====================
    
    /**
     * @notice Verifica se indirizzo è modulo autorizzato
     * @param module Indirizzo modulo
     * @return isAuthorized Se autorizzato
     */
    function isAuthorizedModule(address module) external view returns (bool isAuthorized);
    
    /**
     * @notice Aggiunge modulo autorizzato
     * @param module Indirizzo modulo
     * @param moduleType Tipo modulo
     */
    function addAuthorizedModule(address module, string memory moduleType) external;
    
    /**
     * @notice Rimuove modulo autorizzato
     * @param module Indirizzo modulo
     */
    function removeAuthorizedModule(address module) external;

    // ==================== EMERGENCY FUNCTIONS ====================
    
    /**
     * @notice Pausa tutte le operazioni
     */
    function pause() external;
    
    /**
     * @notice Riprende operazioni
     */
    function unpause() external;
    
    /**
     * @notice Verifica se contratto è in pausa
     * @return paused Se contratto in pausa
     */
    function paused() external view returns (bool paused);
    
    // RIMOSSO (DEC-007 "No drain"): emergencyTransfer(token,amount,to) era un drain
    // custody->owner mai implementato in ProxyGeneral. Emergenza = pause + unwind + LP withdraw.

    // ==================== EVENTS ====================
    
    // ERC20 Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    // LP Token Events
    event LPTokensMinted(address indexed to, uint256 amount, uint256 totalSupply);
    event LPTokensBurned(address indexed from, uint256 amount, uint256 totalSupply);
    
    // Custody Events
    event TokenDeposited(string tokenCode, uint256 amount, address indexed from);
    event TokenWithdrawn(string tokenCode, uint256 amount, address indexed to);
    event ETHDeposited(address indexed from, uint256 amount);
    event ETHWithdrawn(address indexed to, uint256 amount);
    event ETHWrapped(uint256 amount);
    event ETHUnwrapped(uint256 amount);
    
    // Rate Limiting Events
    event OperationTracked(address indexed user, string operationType, uint256 amount, uint256 timestamp);
    event RateLimitUpdated(string operationType, uint256 hourlyLimit, uint256 dailyLimit);
    event RateLimitExceeded(address indexed user, string operationType, uint256 requested, uint256 allowed);
    
    // Access Control Events
    event ModuleAuthorized(address indexed module, string moduleType);
    event ModuleDeauthorized(address indexed module);
    
    // Emergency Events
    event ContractPaused(address indexed pausedBy);
    event ContractUnpaused(address indexed unpausedBy);
    event EmergencyTransferExecuted(address token, uint256 amount, address indexed to);
}