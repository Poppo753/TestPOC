// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IProtocolManager
 * @notice Base interface per tutti i protocol plugins (lending, yield, trading)
 * @dev Questa interfaccia definisce le operazioni comuni che tutti i protocolli devono implementare
 * 
 * Architettura:
 * - Layer 1: IProtocolManager (base - deposit, withdraw, getBalance, getTotalValue)
 * - Layer 2: ILendingProtocol / IYieldProtocol / ITradingProtocol (estendono base)
 * - Layer 3: Protocol-specific (opzionale - IDolomiteLendingProtocol, ecc.)
 * 
 * Custody Flow:
 * ProxyGeneral → ProtocolManager → Plugin (implementa questa interface) → External Protocol
 * 
 * @author Project4 Team
 */
interface IProtocolManager {
    
    // ========== EVENTS ==========
    
    /**
     * @notice Emesso quando viene eseguita un'operazione sul protocollo
     * @param protocol Nome del protocollo (es. "DolomitePlugin")
     * @param operation Tipo di operazione (es. "deposit", "withdraw")
     * @param tokenCode Codice del token (es. "WETH", "USDC")
     * @param amount Importo dell'operazione
     */
    event ProtocolOperationExecuted(
        string protocol,
        string operation,
        string tokenCode,
        uint256 amount
    );
    
    // ========== CORE OPERATIONS ==========
    
    /**
     * @notice Deposita token nel protocollo
     * @dev Il plugin si aspetta che i token siano già nel suo contratto (inviati da ProtocolManager)
     * @dev Dopo il deposito, i token sono nel protocollo esterno (es. Dolomite)
     * 
     * @param tokenCode Codice del token da depositare (es. "WETH", "USDC")
     * @param amount Importo da depositare (in wei)
     * @return success True se il deposito è riuscito
     * 
     * Requirements:
     * - Il plugin DEVE avere già ricevuto i token da ProxyGeneral
     * - Il plugin DEVE depositare i token nel protocollo esterno
     * - Il plugin DEVE aggiornare l'accounting interno
     * 
     * Example:
     * ```
     * // ProtocolManager chiama:
     * IProtocolManager(dolomitePlugin).deposit("WETH", 1 ether);
     * // DolomitePlugin deposita WETH su Dolomite
     * ```
     */
    function deposit(string memory tokenCode, uint256 amount) external returns (bool success);
    
    /**
     * @notice Preleva token dal protocollo
     * @dev Il plugin ritira dal protocollo esterno e DEVE trasferire i token a ProxyGeneral
     * 
     * @param tokenCode Codice del token da prelevare (es. "WETH", "USDC")
     * @param amount Importo da prelevare (in wei)
     * @return success True se il prelievo è riuscito
     * 
     * Requirements:
     * - Il plugin DEVE prelevare i token dal protocollo esterno
     * - Il plugin DEVE trasferire i token a ProxyGeneral (non al caller)
     * - Il plugin DEVE aggiornare l'accounting interno
     * 
     * Example:
     * ```
     * // ProtocolManager chiama:
     * IProtocolManager(dolomitePlugin).withdraw("WETH", 0.5 ether);
     * // DolomitePlugin preleva da Dolomite e invia a ProxyGeneral
     * ```
     */
    function withdraw(string memory tokenCode, uint256 amount) external returns (bool success);
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Ottiene il balance di un token nel protocollo
     * @dev Ritorna il balance effettivo nel protocollo esterno (es. depositi su Dolomite)
     * 
     * @param tokenCode Codice del token (es. "WETH", "USDC")
     * @return balance Balance del token nel protocollo (in wei)
     * 
     * Example:
     * ```
     * uint256 wethBalance = IProtocolManager(dolomitePlugin).getBalance("WETH");
     * // Ritorna: 1000000000000000000 (1 WETH depositato su Dolomite)
     * ```
     */
    function getBalance(string memory tokenCode) external view returns (uint256 balance);
    
    /**
     * @notice Ottiene il valore totale di tutti i depositi nel protocollo
     * @dev Ritorna il valore in ETH equivalente di tutti i token depositati
     * @dev Usa oracle per conversione prezzi
     * 
     * @return totalValueETH Valore totale in ETH (in wei)
     * 
     * Example:
     * ```
     * uint256 totalValue = IProtocolManager(dolomitePlugin).getTotalValue();
     * // Ritorna: 5000000000000000000 (5 ETH equivalente)
     * // Calcolo: 1 WETH (1 ETH) + 2000 USDC (2 ETH) + 0.1 WBTC (2 ETH) = 5 ETH
     * ```
     */
    function getTotalValue() external view returns (uint256 totalValueETH);
    
    /**
     * @notice Ottiene informazioni sul protocollo
     * @return name Nome del protocollo (es. "Dolomite")
     * @return version Versione dell'implementazione (es. "1.0.0")
     * @return isActive True se il protocollo è attivo e operativo
     * 
     * Example:
     * ```
     * (string memory name, string memory version, bool isActive) = 
     *     IProtocolManager(dolomitePlugin).getProtocolInfo();
     * // Ritorna: ("Dolomite", "1.0.0", true)
     * ```
     */
    function getProtocolInfo() external view returns (
        string memory name,
        string memory version,
        bool isActive
    );
    
    // ========== EMERGENCY ==========
    
    /**
     * @notice Emergency withdraw di tutti i token dal protocollo
     * @dev Preleva TUTTI i token specificati e li invia a ProxyGeneral
     * @dev Usare solo in caso di emergenza (es. protocollo compromesso, upgrade urgente)
     * 
     * @param tokenCodes Array di codici token da prelevare (es. ["WETH", "USDC", "WBTC"])
     * @return success True se tutti i prelievi sono riusciti
     * 
     * Requirements:
     * - Il plugin DEVE prelevare TUTTI i fondi per ogni token
     * - Il plugin DEVE trasferire tutto a ProxyGeneral
     * - Il plugin DEVE gestire gracefully token con balance zero
     * 
     * Example:
     * ```
     * string[] memory tokens = new string[](2);
     * tokens[0] = "WETH";
     * tokens[1] = "USDC";
     * bool success = IProtocolManager(dolomitePlugin).emergencyWithdrawAll(tokens);
     * // Preleva tutti i WETH e USDC da Dolomite → ProxyGeneral
     * ```
     */
    function emergencyWithdrawAll(string[] memory tokenCodes) external returns (bool success);
    
    // ========== MODULAR WITHDRAWAL ==========
    
    /**
     * @notice Chiude posizioni su TUTTI i protocolli registrati per ottenere WETH
     * @dev Loop su tutti i protocolli attivi, chiama IProtocolAdapter.closePositionsForWeth
     * @dev Priorità: chiude le posizioni più rischiose prima (lowest health factor)
     * 
     * @param targetWethAmount Quantità di WETH necessaria
     * @return wethObtained WETH effettivamente ottenuto
     * @return totalPositionsClosed Numero totale di posizioni chiuse
     * 
     * Flow:
     * ```
     * for each protocol in registeredProtocols:
     *     if (wethObtained < targetWethAmount):
     *         IProtocolAdapter(plugin).closePositionsForWeth(stillNeeded)
     * ```
     * 
     * Requirements:
     * - Callable solo da owner o LiquidityManager
     * - I plugin DEVONO implementare IProtocolAdapter.closePositionsForWeth
     */
    function closePositionsForWeth(uint256 targetWethAmount) 
        external 
        returns (uint256 wethObtained, uint256 totalPositionsClosed);
    
    // ========== MODULAR VALUE CALCULATION ==========
    
    /**
     * @notice Get total value across ALL active protocols (MODULAR)
     * @dev Loops through all registered protocols and sums their net values via LensAdapters
     * @dev Each protocol's LensAdapter must implement getTotalValue()
     * 
     * @return totalValueEth Sum of all protocol net values in ETH (in wei)
     * 
     * Flow:
     * ```
     * for each protocol in registeredProtocols:
     *     totalValue += ILensAdapter(protocol.lensAdapter).getTotalValue()
     * ```
     * 
     * Example:
     * ```
     * uint256 totalProtocolValue = IProtocolManager(protocolManager).getAllProtocolsValue();
     * // Returns: 10 ETH (5 ETH from Euler + 3 ETH from Morpho + 2 ETH from Aave)
     * ```
     */
    function getAllProtocolsValue() external view returns (uint256 totalValueEth);
    
    /**
     * @notice Get position breakdown for a specific protocol
     * @dev Returns collateral, debt, and net value from the protocol's LensAdapter
     * 
     * @param protocolName Name of the protocol (e.g., "EulerV2", "Morpho", "Dolomite")
     * @return collateral Total collateral value in ETH
     * @return debt Total debt value in ETH
     * @return netValue Net value (collateral - debt) in ETH
     * 
     * Example:
     * ```
     * (uint256 col, uint256 dbt, uint256 net) = protocolManager.getProtocolPositionBreakdown("EulerV2");
     * // Returns: (10 ETH collateral, 5 ETH debt, 5 ETH net)
     * ```
     */
    function getProtocolPositionBreakdown(string memory protocolName) 
        external 
        view 
        returns (uint256 collateral, uint256 debt, uint256 netValue);
}
