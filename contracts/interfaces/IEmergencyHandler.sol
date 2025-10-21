// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IEmergencyHandler
 * @dev Interfaccia completa per EmergencyHandler come da specs
 */
interface IEmergencyHandler {
    
    // ==================== STRUCTS ====================
    
    struct EmergencyContact {
        address contactAddress;
        string role;
        bool isActive;
        uint256 addedAt;
    }
    
    struct EmergencyState {
        bool isActive;
        uint256 activatedAt;
        uint256 lastActionAt;
        address activatedBy;
        string reason;
        uint256 cooldownUntil;
    }
    
    struct AssetSnapshot {
        uint256 timestamp;
        uint256 totalValue;
        uint256 wethBalance;
        string[] tokenCodes;
        uint256[] tokenBalances;
        uint256[] tokenValues;
    }

    // ==================== EMERGENCY MANAGEMENT ====================
    
    /**
     * @notice Attiva stato emergenza
     * @param reason Motivo attivazione
     */
    function activateEmergency(string memory reason) external;
    
    /**
     * @notice Disattiva stato emergenza
     */
    function deactivateEmergency() external;
    
    /**
     * @notice Verifica se è in stato emergenza
     * @return isEmergency Se in emergenza
     */
    function isEmergencyActive() external view returns (bool isEmergency);
    
    /**
     * @notice Ottiene stato emergenza completo
     * @return state Stato emergenza
     */
    function getEmergencyState() external view returns (EmergencyState memory state);

    // ==================== EMERGENCY CONTACTS ====================
    
    /**
     * @notice Aggiunge contatto emergenza
     * @param contact Indirizzo contatto
     * @param role Ruolo del contatto
     */
    function addEmergencyContact(address contact, string memory role) external;
    
    /**
     * @notice Rimuove contatto emergenza
     * @param contact Indirizzo contatto
     */
    function removeEmergencyContact(address contact) external;
    
    /**
     * @notice Lista tutti i contatti emergenza
     * @return contacts Array contatti
     */
    function getEmergencyContacts() external view returns (EmergencyContact[] memory contacts);
    
    /**
     * @notice Verifica se indirizzo è contatto emergenza
     * @param contact Indirizzo da verificare
     * @return isContact Se è contatto emergenza
     */
    function checkIsEmergencyContact(address contact) external view returns (bool isContact);

    // ==================== TIMELOCK MECHANISM ====================
    
    /**
     * @notice Imposta timelock per emergenza
     * @param newTimelock Nuovo timelock in secondi
     */
    function setEmergencyTimelock(uint256 newTimelock) external;
    
    /**
     * @notice Ottiene timelock corrente
     * @return timelock Timelock in secondi
     */
    function getEmergencyTimelock() external view returns (uint256 timelock);
    
    /**
     * @notice Verifica se timelock è scaduto
     * @return expired Se timelock scaduto
     */
    function isTimelockExpired() external view returns (bool expired);

    // ==================== COOLDOWN SYSTEM ====================
    
    /**
     * @notice Imposta cooldown emergenza
     * @param cooldownPeriod Periodo cooldown in secondi
     */
    function setEmergencyCooldown(uint256 cooldownPeriod) external;
    
    /**
     * @notice Verifica se in cooldown
     * @return inCooldown Se in periodo cooldown
     */
    function isInCooldown() external view returns (bool inCooldown);
    
    /**
     * @notice Tempo rimanente cooldown
     * @return remaining Secondi rimanenti
     */
    function getRemainingCooldown() external view returns (uint256 remaining);

    // ==================== ASSET SNAPSHOT ====================
    
    /**
     * @notice Crea snapshot asset correnti
     * @return snapshotId ID dello snapshot
     */
    function createAssetSnapshot() external returns (uint256 snapshotId);
    
    /**
     * @notice Ottiene snapshot per ID
     * @param snapshotId ID snapshot
     * @return snapshot Dati snapshot
     */
    function getAssetSnapshot(uint256 snapshotId) external view returns (AssetSnapshot memory snapshot);
    
    /**
     * @notice Lista tutti gli snapshot
     * @return snapshots Array snapshot
     */
    function getAllSnapshots() external view returns (AssetSnapshot[] memory snapshots);

    // ==================== SYSTEM HEALTH ====================
    
    /**
     * @notice Valida salute del sistema
     * @return isHealthy Se sistema è sano
     * @return issues Array problemi rilevati
     */
    function validateSystemHealth() external view returns (bool isHealthy, string[] memory issues);
    
    /**
     * @notice Controlla integrità asset
     * @return isIntact Se asset integri
     * @return errorReason Motivo errore se presenti
     */
    function checkAssetIntegrity() external view returns (bool isIntact, string memory errorReason);

    // ==================== EMERGENCY ACTIONS ====================
    
    /**
     * @notice Pausa tutte le operazioni
     */
    function pauseAllOperations() external;
    
    /**
     * @notice Riprende tutte le operazioni
     */
    function resumeAllOperations() external;
    
    /**
     * @notice Withdraw emergenza
     * @param token Indirizzo token
     * @param amount Quantità
     * @param recipient Destinatario
     */
    function emergencyWithdraw(address token, uint256 amount, address recipient) external;
    
    /**
     * @notice Trasferimento emergenza
     * @param to Destinatario
     * @param amount Quantità ETH
     */
    function emergencyTransfer(address payable to, uint256 amount) external;

    // ==================== ACCESS CONTROL ====================
    
    /**
     * @notice Verifica permessi emergenza per utente
     * @param user Indirizzo utente
     * @return hasAccess Se ha accesso
     * @return role Ruolo se applicabile
     */
    function checkEmergencyAccess(address user) external view returns (bool hasAccess, string memory role);

    // ==================== EVENTS ====================
    
    event EmergencyActivated(address indexed activatedBy, string reason, uint256 timestamp);
    event EmergencyDeactivated(address indexed deactivatedBy, uint256 timestamp);
    event EmergencyContactAdded(address indexed contact, string role, uint256 timestamp);
    event EmergencyContactRemoved(address indexed contact, uint256 timestamp);
    event EmergencyTimelockUpdated(uint256 oldTimelock, uint256 newTimelock);
    event EmergencyCooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event AssetSnapshotCreated(uint256 indexed snapshotId, uint256 totalValue, uint256 timestamp);
    event SystemHealthChecked(bool isHealthy, uint256 timestamp);
    event EmergencyWithdrawExecuted(address indexed token, uint256 amount, address indexed recipient);
    event EmergencyTransferExecuted(address indexed recipient, uint256 amount);
    event AllOperationsPaused(address indexed pausedBy, uint256 timestamp);
    event AllOperationsResumed(address indexed resumedBy, uint256 timestamp);
}