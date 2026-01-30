// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./ILendingProtocol.sol";

/**
 * @title IEulerV2Plugin
 * @notice Interfaccia per il plugin Euler V2
 * @dev Estende ILendingProtocol aggiungendo operazioni specifiche per Euler V2:
 *      - Gestione posizioni con leva tramite EVC batching
 *      - Sub-accounts per isolamento posizioni
 *      - Integrazione con Swapper per leverage
 * 
 * Architettura Euler V2:
 * - EVC (Ethereum Vault Connector): Hub centrale per batching e sub-accounts
 * - EVK (Euler Vault Kit): Vault ERC-4626 con borrowing
 * - Swapper: Contratto per swap durante operazioni leverage
 * - SwapVerifier: Verifica output swap (protezione slippage)
 * 
 * Sub-accounts:
 * - Account 0: Depositi semplici (yield farming)
 * - Account 1-255: Posizioni leverage isolate
 * - Derivazione: address(plugin) XOR subAccountId
 * 
 * Custody Flow (leverage):
 * ProxyGeneral → Plugin → EVC.batch([deposit, borrow, swap, deposit]) → Euler Vaults
 * 
 * @author Project4 Team
 */
interface IEulerV2Plugin is ILendingProtocol {
    
    // ========== STRUCTS ==========
    
    /**
     * @notice Parametri per aprire una posizione con leva
     * @param collateralTokenCode Codice token collaterale (es. "WETH")
     * @param borrowTokenCode Codice token da prendere in prestito (es. "USDC")
     * @param collateralAmount Importo collaterale iniziale da depositare
     * @param borrowAmount Importo da prendere in prestito
     * @param minCollateralReceived Minimo collaterale da ricevere dopo swap (slippage protection)
     * @param swapData Dati per lo Swapper Euler (da API aggregator)
     * @param deadline Timestamp deadline per l'operazione
     */
    struct OpenLeverageParams {
        string collateralTokenCode;
        string borrowTokenCode;
        uint256 collateralAmount;
        uint256 borrowAmount;
        uint256 minCollateralReceived;
        bytes swapData;
        uint256 deadline;
    }
    
    /**
     * @notice Informazioni su una posizione leverage
     * @param positionId ID univoco della posizione
     * @param subAccountId ID del sub-account Euler (1-255)
     * @param collateralVault Indirizzo vault collaterale
     * @param borrowVault Indirizzo vault del debito
     * @param initialCollateral Collaterale iniziale depositato
     * @param borrowedAmount Importo preso in prestito
     * @param isActive True se la posizione è ancora aperta
     * @param createdAt Timestamp creazione
     */
    struct LeveragePosition {
        uint256 positionId;
        uint8 subAccountId;
        address collateralVault;
        address borrowVault;
        uint256 initialCollateral;
        uint256 borrowedAmount;
        bool isActive;
        uint256 createdAt;
    }
    
    // ========== EVENTS ==========
    
    /**
     * @notice Emesso quando viene aperta una posizione leverage
     * @param positionId ID della posizione
     * @param subAccountId Sub-account Euler utilizzato
     * @param collateralAmount Collaterale totale (iniziale + swappato)
     * @param borrowAmount Importo preso in prestito
     */
    event LeveragePositionOpened(
        uint256 indexed positionId,
        uint8 indexed subAccountId,
        uint256 collateralAmount,
        uint256 borrowAmount
    );
    
    /**
     * @notice Emesso quando viene chiusa una posizione leverage
     * @param positionId ID della posizione
     * @param collateralReturned Collaterale restituito a ProxyGeneral
     */
    event LeveragePositionClosed(
        uint256 indexed positionId,
        uint256 collateralReturned
    );
    
    /**
     * @notice Emesso quando viene aggiunto collaterale a una posizione
     * @param positionId ID della posizione
     * @param amount Importo aggiunto
     */
    event CollateralAdded(uint256 indexed positionId, uint256 amount);
    
    /**
     * @notice Emesso quando viene rimosso collaterale da una posizione
     * @param positionId ID della posizione
     * @param amount Importo rimosso
     */
    event CollateralRemoved(uint256 indexed positionId, uint256 amount);
    
    /**
     * @notice Emesso quando il circuit breaker viene attivato/disattivato
     * @param tripped True se attivato, false se disattivato
     */
    event CircuitBreakerSet(bool tripped);
    
    // ========== LEVERAGE OPERATIONS ==========
    
    /**
     * @notice Apre una nuova posizione con leva
     * @dev Esegue un batch EVC atomico:
     *      1. Deposita collaterale iniziale
     *      2. Abilita collateral vault come collaterale
     *      3. Abilita borrow vault come controller
     *      4. Borrow → invia a Swapper
     *      5. Swap borrowed → collaterale
     *      6. Deposita collaterale swappato
     *      7. Verifica con SwapVerifier
     * 
     * @param params Parametri della posizione (vedi struct OpenLeverageParams)
     * @return positionId ID univoco della posizione creata
     * 
     * Requirements:
     * - collateralAmount > 0
     * - borrowAmount > 0
     * - Plugin deve avere ricevuto collaterale da ProxyGeneral
     * - Vault per entrambi i token devono essere configurati
     * - deadline non scaduto
     * 
     * Example:
     * ```
     * // Apri posizione 3x leverage su WETH
     * // 1. ProtocolManager trasferisce 1 WETH al plugin
     * // 2. Chiama openLeveragePosition:
     * uint256 posId = plugin.openLeveragePosition(OpenLeverageParams({
     *     collateralTokenCode: "WETH",
     *     borrowTokenCode: "USDC", 
     *     collateralAmount: 1 ether,
     *     borrowAmount: 2000e6,           // 2000 USDC
     *     minCollateralReceived: 0.8 ether, // Min ~0.8 ETH da swap
     *     swapData: aggregatorData,
     *     deadline: block.timestamp + 300
     * }));
     * // Risultato: sub-account #1 con ~1.8 ETH collaterale, 2000 USDC debito
     * ```
     */
    function openLeveragePosition(OpenLeverageParams calldata params) 
        external 
        returns (uint256 positionId);
    
    /**
     * @notice Chiude una posizione leverage esistente
     * @dev Esegue un batch EVC atomico:
     *      1. Preleva tutto il collaterale → Swapper
     *      2. Swap collaterale → debt asset (target debt = 0)
     *      3. Ripaga tutto il debito
     *      4. Verifica debito = 0
     *      5. Trasferisce collaterale residuo a ProxyGeneral
     * 
     * @param positionId ID della posizione da chiudere
     * @return collateralReturned Collaterale restituito a ProxyGeneral
     * 
     * Requirements:
     * - Posizione deve esistere e essere attiva
     * - Caller deve essere owner o ProtocolManager
     * 
     * Example:
     * ```
     * uint256 returned = plugin.closeLeveragePosition(0);
     * // Ritorna: 0.2 ether (profit se ETH è salito)
     * // ProxyGeneral riceve 0.2 ETH
     * ```
     */
    function closeLeveragePosition(uint256 positionId) 
        external 
        returns (uint256 collateralReturned);
    
    /**
     * @notice Aggiunge collaterale a una posizione esistente
     * @dev Aumenta health factor della posizione
     * 
     * @param positionId ID della posizione
     * @param amount Importo collaterale da aggiungere
     * 
     * Requirements:
     * - Posizione deve esistere e essere attiva
     * - Plugin deve avere ricevuto collaterale da ProxyGeneral
     */
    function addCollateralToPosition(uint256 positionId, uint256 amount) external;
    
    /**
     * @notice Rimuove collaterale da una posizione esistente
     * @dev Diminuisce health factor - verificare che rimanga > 1.0
     * 
     * @param positionId ID della posizione
     * @param amount Importo collaterale da rimuovere
     * 
     * Requirements:
     * - Posizione deve esistere e essere attiva
     * - Health factor deve rimanere > 1.0 dopo rimozione
     * - Collaterale rimosso viene trasferito a ProxyGeneral
     */
    function removeCollateralFromPosition(uint256 positionId, uint256 amount) external;
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Ottiene health factor di una specifica posizione
     * @param positionId ID della posizione
     * @return healthFactor Health factor in 18 decimali (1.0 = 1e18)
     */
    function getPositionHealth(uint256 positionId) 
        external 
        view 
        returns (uint256 healthFactor);
    
    /**
     * @notice Ottiene i valori di una posizione
     * @param positionId ID della posizione
     * @return collateralValue Valore collaterale in ETH (18 decimali)
     * @return debtValue Valore debito in ETH (18 decimali)
     */
    function getPositionValue(uint256 positionId) 
        external 
        view 
        returns (uint256 collateralValue, uint256 debtValue);
    
    /**
     * @notice Ottiene tutte le posizioni attive
     * @return positions Array di tutte le posizioni attive
     */
    function getAllPositions() 
        external 
        view 
        returns (LeveragePosition[] memory positions);
    
    /**
     * @notice Ottiene una specifica posizione
     * @param positionId ID della posizione
     * @return position Dati della posizione
     */
    function getPosition(uint256 positionId) 
        external 
        view 
        returns (LeveragePosition memory position);
    
    /**
     * @notice Conta il numero di posizioni attive
     * @return count Numero di posizioni attive
     */
    function getActivePositionCount() external view returns (uint256 count);
    
    /**
     * @notice Prossimo ID posizione che sarà assegnato
     * @return nextId Prossimo position ID
     */
    function nextPositionId() external view returns (uint256 nextId);
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @notice Attiva/disattiva il circuit breaker
     * @dev Quando attivo, blocca tutte le operazioni tranne emergencyWithdrawAll
     * @param tripped True per attivare, false per disattivare
     */
    function setCircuitBreaker(bool tripped) external;
    
    /**
     * @notice Verifica se il circuit breaker è attivo
     * @return True se attivo
     */
    function circuitBreakerTripped() external view returns (bool);
}
