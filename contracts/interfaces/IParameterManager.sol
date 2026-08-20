// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IParameterManager
 * @dev Interfaccia completa per ParameterManager come da specs
 */
interface IParameterManager {
    
    // ==================== STRUCTS ====================
    
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
    
    struct ParameterHistory {
        uint256 value;
        uint256 timestamp;
        address changedBy;
    }

    // ==================== PARAMETER MANAGEMENT ====================
    
    /**
     * @notice Propone cambio parametro con timelock
     * @param key Chiave parametro
     * @param value Nuovo valore
     * @param description Descrizione cambio
     * @return proposalId ID della proposta
     */
    function proposeParameterChange(
        string memory key,
        bytes memory value,
        string memory description
    ) external returns (uint256 proposalId);
    
    /**
     * @notice Esegue cambio parametro dopo timelock
     * @param proposalId ID proposta
     */
    function executeParameterChange(uint256 proposalId) external;
    
    /**
     * @notice Annulla proposta parametro
     * @param proposalId ID proposta
     */
    function cancelParameterProposal(uint256 proposalId) external;

    // ==================== DIRECT PARAMETER ACCESS ====================
    
    /**
     * @notice Ottiene valore parametro
     * @param key Chiave parametro
     * @return value Valore parametro
     */
    function getParameter(string memory key) external view returns (bytes memory value);
    
    /**
     * @notice Imposta parametro (emergency override)
     * @param key Chiave parametro
     * @param value Valore parametro
     * @param reason Motivo override
     */
    function setParameterEmergency(
        string memory key,
        bytes memory value,
        string memory reason
    ) external;

    // ==================== PARAMETER VALIDATION ====================
    
    /**
     * @notice Verifica se parametro esiste
     * @param key Chiave parametro
     * @return exists Se parametro esiste
     */
    function parameterExists(string memory key) external view returns (bool exists);
    
    /**
     * @notice Valida valore parametro
     * @param key Chiave parametro
     * @param value Valore da validare
     * @return isValid Se valore valido
     * @return errorMessage Messaggio errore
     */
    function validateParameterValue(
        string memory key,
        bytes memory value
    ) external view returns (bool isValid, string memory errorMessage);

    // ==================== REGISTRATION SYSTEM ====================
    
    /**
     * @notice Registra nuovo parametro nel sistema
     * @param key Chiave parametro
     * @param defaultValue Valore default
     * @param description Descrizione parametro
     */
    function registerParameter(
        string memory key,
        bytes memory defaultValue,
        string memory description
    ) external;
    
    /**
     * @notice Lista parametri registrati
     * @return keys Array chiavi parametri
     */
    function getRegisteredParameters() external view returns (string[] memory keys);
    
    /**
     * @notice Rimuove parametro dal registro
     * @param key Chiave parametro
     */
    function unregisterParameter(string memory key) external;

    // ==================== TIMELOCK MANAGEMENT ====================
    
    /**
     * @notice Imposta timelock per parametri
     * @param newTimelock Nuovo timelock in secondi
     */
    function setParameterTimelock(uint256 newTimelock) external;
    
    /**
     * @notice Ottiene timelock corrente
     * @return timelock Timelock in secondi
     */
    function getParameterTimelock() external view returns (uint256 timelock);

    // ==================== PROPOSAL TRACKING ====================
    
    /**
     * @notice Ottiene proposta per ID
     * @param proposalId ID proposta
     * @return proposal Dati proposta
     */
    function getProposal(uint256 proposalId) external view returns (Parameter memory proposal);
    
    /**
     * @notice Lista proposte attive
     * @return proposals Array proposte attive
     */
    function getActiveProposals() external view returns (Parameter[] memory proposals);
    
    /**
     * @notice Lista proposte eseguibili
     * @return proposals Array proposte pronte
     */
    function getExecutableProposals() external view returns (Parameter[] memory proposals);

    // ==================== PARAMETER HISTORY ====================
    
    /**
     * @notice Storico modifiche parametro
     * @param key Chiave parametro
     * @return history Array modifiche
     */
    function getParameterHistory(string memory key) external view returns (ParameterHistory[] memory history);
    
    /**
     * @notice Ultima modifica parametro
     * @param key Chiave parametro
     * @return lastChange Ultima modifica
     */
    function getLastParameterChange(string memory key) external view returns (ParameterHistory memory lastChange);

    // ==================== TYPED PARAMETER ACCESS ====================
    
    /**
     * @notice Ottiene parametro uint256
     * @param key Chiave parametro
     * @return value Valore uint256
     */
    function getUintParameter(string memory key) external view returns (uint256 value);
    
    /**
     * @notice Ottiene parametro bool
     * @param key Chiave parametro
     * @return value Valore bool
     */
    function getBoolParameter(string memory key) external view returns (bool value);
    
    /**
     * @notice Ottiene parametro address
     * @param key Chiave parametro
     * @return value Valore address
     */
    function getAddressParameter(string memory key) external view returns (address value);
    
    /**
     * @notice Ottiene parametro string
     * @param key Chiave parametro
     * @return value Valore string
     */
    function getStringParameter(string memory key) external view returns (string memory value);

    // ==================== BATCH OPERATIONS ====================
    
    /**
     * @notice Propone multiple modifiche parametri
     * @param keys Array chiavi
     * @param values Array valori
     * @param description Descrizione batch
     * @return proposalIds Array ID proposte
     */
    function proposeBatchParameterChanges(
        string[] memory keys,
        bytes[] memory values,
        string memory description
    ) external returns (uint256[] memory proposalIds);
    
    /**
     * @notice Esegue multiple proposte
     * @param proposalIds Array ID proposte
     */
    function executeBatchProposals(uint256[] memory proposalIds) external;

    // ==================== EVENTS ====================
    
    event ParameterProposed(
        uint256 indexed proposalId,
        string key,
        bytes value,
        address indexed proposer,
        uint256 executeAfter
    );
    event ParameterChanged(
        string key,
        bytes oldValue,
        bytes newValue,
        address indexed changedBy,
        uint256 timestamp
    );
    event ParameterProposalExecuted(uint256 indexed proposalId, string key, address indexed executor);
    event ParameterProposalCancelled(uint256 indexed proposalId, string key, address indexed canceller);
    event ParameterRegistered(string key, bytes defaultValue, string description);
    event ParameterUnregistered(string key);
    event ParameterTimelockUpdated(uint256 oldTimelock, uint256 newTimelock);
    event EmergencyParameterSet(string key, bytes value, string reason, address indexed setter);
    event BatchParametersProposed(uint256[] proposalIds, string[] keys, string description);
    event BatchParametersExecuted(uint256[] proposalIds, address indexed executor);
}