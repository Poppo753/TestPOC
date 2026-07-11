// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IEmergencyHandler.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/IProxyGeneral.sol";
import "./interfaces/ITokenManagerForModules.sol";
import "./interfaces/IValueCalculatorForModules.sol";

/**
 * @title EmergencyHandler
 * @dev Gestisce procedure di emergenza per l'intero sistema DeFi
 * @custom:security-contact security@yourdomain.com
 */
contract EmergencyHandler is IEmergencyHandler, Ownable {
    
    // ==================== STORAGE ====================
    
    /// @notice Beacon address per resolution moduli
    address public immutable beacon;
    
    /// @notice Tracking emergenze eseguite
    mapping(string => bool) public emergencyExecuted;
    
    /// @notice Ultimo emergency report
    EmergencyReport public lastReport;
    
    /// @notice Emergency contacts system
    address[] public emergencyContacts;
    mapping(address => bool) public isEmergencyContact;
    mapping(address => uint256) public contactAddedAt; // Sprint 3.3: Track addition timestamp
    mapping(address => string) public contactRole; // Sprint 3.3: Store contact role
    
    /// @notice Timelock mechanism
    uint256 public unpauseTimelock;
    uint256 public constant MIN_TIMELOCK = 1 hours;
    uint256 public constant MAX_TIMELOCK = 7 days;
    
    /// @notice Emergency state tracking
    IEmergencyHandler.EmergencyState public emergencyState;
    
    /// @notice Emergency cooldown system
    uint256 public constant EMERGENCY_COOLDOWN = 1 days;
    uint256 public lastEmergencyTimestamp;
    
    /// @notice Snapshot storage system (Sprint 3.2)
    mapping(uint256 => IEmergencyHandler.AssetSnapshot) private snapshots;
    uint256 private snapshotCount;
    uint256[] private snapshotIds; // For getAllSnapshots() iteration
    
    // ==================== STRUCTS ====================
    
    struct EmergencyReport {
        uint256 totalPoolValue;
        uint256 baseAssetBalance;
        uint256 totalTokensValue;
        uint256 numberOfTokens;
        bool systemPaused;
        uint256 reportTimestamp;
        address reportedBy;
    }
    
    struct WithdrawResult {
        string tokenCode;
        address tokenAddress;
        uint256 amount;
        bool success;
        string errorReason;
    }

    // ==================== EVENTS ====================
    
    event EmergencyPauseExecuted(
        address indexed executor,
        uint256 timestamp,
        string reason
    );
    
    event EmergencyUnpauseExecuted(
        address indexed executor,
        uint256 timestamp
    );
    
    event EmergencyWithdrawInitiated(
        address indexed executor,
        uint256 timestamp,
        uint256 totalValue
    );
    
    event TokenWithdrawAttempted(
        string indexed tokenCode,
        uint256 amount,
        bool success,
        string errorReason
    );
    
    event EmergencyWithdrawCompleted(
        uint256 totalWithdrawn,
        uint256 successfulWithdraws,
        uint256 failedWithdraws
    );
    
    event EmergencyReportGenerated(
        uint256 totalValue,
        uint256 numberOfTokens,
        bool systemPaused,
        address generator
    );
    
    // Emergency Contacts Events
    event EmergencyContactAdded(address indexed contact);
    event EmergencyContactRemoved(address indexed contact);
    event EmergencyContactNotified(address indexed contact);
    
    // Enhanced Emergency Events  
    event EmergencyResolved(
        address indexed triggeredBy,
        string reason,
        uint256 triggeredAt,
        uint256 resolvedAt
    );
    
    event AssetTransferred(
        string indexed tokenCode,
        address indexed tokenAddress,
        uint256 amount,
        address indexed recipient
    );
    
    event UnpauseTimelockUpdated(
        uint256 oldTimelock,
        uint256 newTimelock
    );

    // ==================== CONSTRUCTOR ====================

    // ==================== MODIFIERS ====================

    modifier onlyEmergencyAuthorized() {
        require(
            msg.sender == owner() || isEmergencyContact[msg.sender],
            "Not authorized for emergency operations"
        );
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(address _beacon) Ownable() {
        require(_beacon != address(0), "Invalid beacon address");
        beacon = _beacon;
        
        // Initialize default unpause timelock to 6 hours
        unpauseTimelock = 6 hours;
    }

    // ==================== EMERGENCY PAUSE/UNPAUSE ====================

    /**
     * @notice Pausa di emergenza dell'intero sistema
     * @param reason Motivo della pausa
     */
    function emergencyPause(string memory reason) public onlyEmergencyAuthorized {
        require(!emergencyState.isActive, "Emergency already active");
        
        // COOLDOWN CHECK (prevent spam)
        if (lastEmergencyTimestamp > 0) {
            require(
                block.timestamp - lastEmergencyTimestamp >= EMERGENCY_COOLDOWN,
                "Emergency cooldown active"
            );
        }
        
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        
        // SET EMERGENCY STATE
        emergencyState = IEmergencyHandler.EmergencyState({
            isActive: true,
            activatedBy: msg.sender,
            activatedAt: block.timestamp,
            lastActionAt: block.timestamp,
            reason: reason,
            cooldownUntil: 0
        });
        
        // Esegui pausa tramite ProxyGeneral
        proxy.pause();
        
        emergencyExecuted["pause"] = true;
        lastEmergencyTimestamp = block.timestamp;
        
        emit EmergencyPauseExecuted(msg.sender, block.timestamp, reason);
        
        // NOTIFY ALL EMERGENCY CONTACTS
        for (uint256 i = 0; i < emergencyContacts.length; i++) {
            emit EmergencyContactNotified(emergencyContacts[i]);
        }
    }

    /**
     * @notice Rimuove pausa di emergenza con timelock protection
     */
    function emergencyUnpause() public onlyOwner {
        require(emergencyState.isActive, "No emergency active");
        
        // CHECK TIMELOCK
        uint256 timeSincePause = block.timestamp - emergencyState.activatedAt;
        require(timeSincePause >= unpauseTimelock, "Timelock not expired");
        
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        
        // CAPTURE EMERGENCY DETAILS FOR EVENT
        address triggeredBy = emergencyState.activatedBy;
        string memory reason = emergencyState.reason;
        uint256 triggeredAt = emergencyState.activatedAt;
        
        // UNPAUSE SYSTEM
        proxy.unpause();
        
        // RESET STATE
        delete emergencyState;
        emergencyExecuted["pause"] = false;
        
        emit EmergencyUnpauseExecuted(msg.sender, block.timestamp);
        emit EmergencyResolved(triggeredBy, reason, triggeredAt, block.timestamp);
    }

    /**
     * @notice Controlla se unpause è possibile
     * @return canUnpause Se unpause è possibile
     * @return reason Motivo se non possibile
     */
    function canUnpause() external view returns (bool canUnpause, string memory reason) {
        if (!emergencyState.isActive) {
            return (false, "No emergency active");
        }
        
        uint256 timeSincePause = block.timestamp - emergencyState.activatedAt;
        if (timeSincePause < unpauseTimelock) {
            uint256 remaining = unpauseTimelock - timeSincePause;
            return (false, string(abi.encodePacked("Timelock: ", _uint2str(remaining), " seconds remaining")));
        }
        
        return (true, "Can unpause");
    }

    /**
     * @notice Ottiene stato emergency corrente
     * @return state Emergency state struct
     */
    function getEmergencyState() external view returns (IEmergencyHandler.EmergencyState memory state) {
        return emergencyState;
    }

    /**
     * @notice Utility per convertire uint a string
     */
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    // ==================== EMERGENCY WITHDRAW ====================

    /**
     * @notice Prelievo di emergenza di tutti gli asset
     * @dev Preleva tutti i token e base asset dal ProxyGeneral all'owner
     * @return results Array con risultati per ogni token
     */
    function emergencyWithdraw() external onlyOwner returns (WithdrawResult[] memory results) {
        require(!emergencyExecuted["withdraw"], "Emergency withdraw already executed");
        
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        address baseAssetAddress = IBeacon(beacon).getImplementation("BASE_ASSET");
        
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        ITokenManagerForModules tokens = ITokenManagerForModules(tokenManager);
        
        uint256 totalValueBefore = _getCurrentTotalValue();
        
        emit EmergencyWithdrawInitiated(msg.sender, block.timestamp, totalValueBefore);
        
        _logAssetSnapshot(owner());
        
        string[] memory activeTokens = tokens.getActiveTokens();
        
        // CREATE RESULTS ARRAY (tokens + base asset)
        results = new WithdrawResult[](activeTokens.length + 1);
        
        uint256 successfulWithdraws = 0;
        uint256 failedWithdraws = 0;
        uint256 totalWithdrawn = 0;
        
        for (uint256 i = 0; i < activeTokens.length; i++) {
            string memory tokenCode = activeTokens[i];
            address tokenAddress = tokens.getTokenAddress(tokenCode);
            uint256 balance = IERC20(tokenAddress).balanceOf(proxyGeneral);
            
            results[i] = WithdrawResult({
                tokenCode: tokenCode,
                tokenAddress: tokenAddress,
                amount: balance,
                success: false,
                errorReason: ""
            });
            
            if (balance > 0) {
                try proxy.emergencyTransfer(tokenAddress, balance, owner()) {
                    results[i].success = true;
                    successfulWithdraws++;
                    totalWithdrawn += balance;
                    
                    emit TokenWithdrawAttempted(tokenCode, balance, true, "");
                } catch Error(string memory reason) {
                    results[i].errorReason = reason;
                    failedWithdraws++;
                    
                    emit TokenWithdrawAttempted(tokenCode, balance, false, reason);
                } catch {
                    results[i].errorReason = "Unknown error during withdrawal";
                    failedWithdraws++;
                    
                    emit TokenWithdrawAttempted(tokenCode, balance, false, "Unknown error");
                }
            } else {
                results[i].errorReason = "No balance to withdraw";
            }
        }
        
        // WITHDRAW BASE ASSET
        uint256 baseAssetBalance = IERC20(baseAssetAddress).balanceOf(proxyGeneral);
        results[activeTokens.length] = WithdrawResult({
            tokenCode: "BASE_ASSET",
            tokenAddress: baseAssetAddress,
            amount: baseAssetBalance,
            success: false,
            errorReason: ""
        });
        
        if (baseAssetBalance > 0) {
            try proxy.emergencyTransfer(baseAssetAddress, baseAssetBalance, owner()) {
                results[activeTokens.length].success = true;
                successfulWithdraws++;
                totalWithdrawn += baseAssetBalance;
                
                emit TokenWithdrawAttempted("BASE_ASSET", baseAssetBalance, true, "");
            } catch Error(string memory reason) {
                results[activeTokens.length].errorReason = reason;
                failedWithdraws++;
                
                emit TokenWithdrawAttempted("BASE_ASSET", baseAssetBalance, false, reason);
            } catch {
                results[activeTokens.length].errorReason = "Unknown error during base asset withdrawal";
                failedWithdraws++;
                
                emit TokenWithdrawAttempted("BASE_ASSET", baseAssetBalance, false, "Unknown error");
            }
        } else {
            results[activeTokens.length].errorReason = "No base asset balance to withdraw";
        }
        
        emergencyExecuted["withdraw"] = true;
        
        emit EmergencyWithdrawCompleted(totalWithdrawn, successfulWithdraws, failedWithdraws);
        
        return results;
    }

    // ==================== EMERGENCY REPORTING ====================

    /**
     * @notice Genera report completo dello stato di emergenza
     * @return report Struct con tutti i dettagli
     */
    function generateEmergencyReport() external returns (EmergencyReport memory report) {
        // GET CONTRACT REFERENCES
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        address valueCalculator = IBeacon(beacon).getImplementation("ValueCalculator");
        address baseAssetAddress = IBeacon(beacon).getImplementation("BASE_ASSET");
        
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        ITokenManagerForModules tokens = ITokenManagerForModules(tokenManager);
        IValueCalculatorForModules calculator = IValueCalculatorForModules(valueCalculator);
        
        // COLLECT POOL DATA
        report.totalPoolValue = calculator.getTotalPoolValueView();
        report.baseAssetBalance = IERC20(baseAssetAddress).balanceOf(proxyGeneral);
        report.systemPaused = proxy.paused();
        report.reportTimestamp = block.timestamp;
        report.reportedBy = msg.sender;
        
        // CALCULATE TOKEN VALUES
        string[] memory activeTokens = tokens.getActiveTokens();
        report.numberOfTokens = activeTokens.length;
        
        uint256 totalTokensValue = 0;
        for (uint256 i = 0; i < activeTokens.length; i++) {
            address tokenAddress = tokens.getTokenAddress(activeTokens[i]);
            uint256 balance = IERC20(tokenAddress).balanceOf(proxyGeneral);
            
            // Note: Simplified value calculation for emergency report
            // For precise values, use ValueCalculator.getTotalPoolValueView()
            totalTokensValue += balance;
        }
        
        report.totalTokensValue = totalTokensValue;
        
        // STORE REPORT
        lastReport = report;
        
        emit EmergencyReportGenerated(
            report.totalPoolValue,
            report.numberOfTokens,
            report.systemPaused,
            msg.sender
        );
        
        return report;
    }

    /**
     * @notice Ottiene ultimo report generato
     * @return report Ultimo report
     */
    function getLastEmergencyReport() external view returns (EmergencyReport memory report) {
        return lastReport;
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Verifica se un'emergenza specifica è stata eseguita
     * @param emergencyType Tipo di emergenza ("pause", "withdraw")
     * @return executed Se è stata eseguita
     */
    function isEmergencyExecuted(string memory emergencyType) external view returns (bool executed) {
        return emergencyExecuted[emergencyType];
    }

    /**
     * @notice Ottiene statistiche emergency per monitoring
     * @return isPaused Se sistema è pausato
     * @return pauseExecuted Se pausa emergenza eseguita
     * @return withdrawExecuted Se prelievo emergenza eseguito
     * @return totalValue Valore totale pool
     */
    function getEmergencyStats() external view returns (
        bool isPaused,
        bool pauseExecuted,
        bool withdrawExecuted,
        uint256 totalValue
    ) {
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address valueCalculator = IBeacon(beacon).getImplementation("ValueCalculator");
        
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        IValueCalculatorForModules calculator = IValueCalculatorForModules(valueCalculator);
        
        isPaused = proxy.paused();
        pauseExecuted = emergencyExecuted["pause"];
        withdrawExecuted = emergencyExecuted["withdraw"];
        totalValue = calculator.getTotalPoolValueView();
        
        return (isPaused, pauseExecuted, withdrawExecuted, totalValue);
    }

    /**
     * @notice Ottiene status health completo per governance
     * @return isPaused Se sistema pausato
     * @return totalValue Valore totale pool
     * @return lpSupply LP supply totale
     * @return activeTokens Lista token attivi
     */
    function getSystemHealthStatus() external view returns (
        bool isPaused,
        uint256 totalValue,
        uint256 lpSupply,
        string[] memory activeTokens
    ) {
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        
        try IProxyGeneral(proxyGeneral).paused() returns (bool paused) {
            isPaused = paused;
        } catch {
            isPaused = true; // Assume paused if can't check
        }
        
        totalValue = _getCurrentTotalValue();
        
        try IProxyGeneral(proxyGeneral).totalSupply() returns (uint256 supply) {
            lpSupply = supply;
        } catch {
            lpSupply = 0;
        }
        
        try ITokenManagerForModules(tokenManager).getActiveTokens() returns (string[] memory tokens) {
            activeTokens = tokens;
        } catch {
            activeTokens = new string[](0);
        }
        
        return (isPaused, totalValue, lpSupply, activeTokens);
    }

    // ==================== EMERGENCY CONTACTS MANAGEMENT ====================

    /**
     * @notice Aggiunge emergency contact
     * @dev Stores contact with timestamp and role (Sprint 3.3)
     * @param contact Indirizzo contact da aggiungere
     * @param role Ruolo del contact
     */
    function addEmergencyContact(address contact, string memory role) external onlyOwner {
        require(contact != address(0), "Invalid contact address");
        require(!isEmergencyContact[contact], "Contact already added");
        require(emergencyContacts.length < 10, "Too many emergency contacts"); // Limit to 10
        require(bytes(role).length > 0, "Role cannot be empty");
        
        emergencyContacts.push(contact);
        isEmergencyContact[contact] = true;
        contactAddedAt[contact] = block.timestamp; // Sprint 3.3: Store actual timestamp
        contactRole[contact] = role; // Sprint 3.3: Store role
        
        emit EmergencyContactAdded(contact);
    }

    /**
     * @notice Rimuove emergency contact
     * @dev Cleans up all contact data including timestamp and role (Sprint 3.3)
     * @param contact Indirizzo contact da rimuovere
     */
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
        
        // Sprint 3.3: Clean up timestamp and role
        delete contactAddedAt[contact];
        delete contactRole[contact];
        
        emit EmergencyContactRemoved(contact);
    }

    /**
     * @notice Verifica se address è autorizzato per emergency
     * @param account Indirizzo da verificare
     * @return authorized Se è autorizzato
     */
    function isAuthorizedForEmergency(address account) external view returns (bool authorized) {
        return account == owner() || isEmergencyContact[account];
    }

    /**
     * @notice Ottiene numero di emergency contacts
     * @return count Numero contacts
     */
    function getEmergencyContactsCount() external view returns (uint256 count) {
        return emergencyContacts.length;
    }
    
    /**
     * @notice Ottiene dettagli di un emergency contact (Sprint 3.3)
     * @param contact Indirizzo contact
     * @return role Ruolo del contact
     * @return addedAt Timestamp aggiunta
     * @return isActive Se attualmente attivo
     */
    function getContactInfo(address contact) external view returns (
        string memory role,
        uint256 addedAt,
        bool isActive
    ) {
        require(isEmergencyContact[contact], "Not an emergency contact");
        return (contactRole[contact], contactAddedAt[contact], true);
    }

    // ==================== INTERNAL HELPER FUNCTIONS ====================

    /**
     * @notice Ottiene valore totale pool corrente con try/catch
     * @return totalValue Valore totale o 0 se errore
     */
    function _getCurrentTotalValue() internal view returns (uint256 totalValue) {
        try IValueCalculatorForModules(IBeacon(beacon).getImplementation("ValueCalculator")).getTotalPoolValueView() returns (uint256 value) {
            return value;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Log snapshot completo asset per audit trail
     * @param recipient Destinatario assets
     */
    function _logAssetSnapshot(address recipient) internal {
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        
        // LOG BASE ASSET BALANCE
        address baseAssetAddress = IBeacon(beacon).getImplementation("BASE_ASSET");
        uint256 baseAssetBalance = IERC20(baseAssetAddress).balanceOf(proxyGeneral);
        emit AssetTransferred("BASE_ASSET", baseAssetAddress, baseAssetBalance, recipient);
        
        // LOG ALL ACTIVE TOKENS
        try ITokenManagerForModules(tokenManager).getActiveTokens() returns (string[] memory activeTokens) {
            for (uint256 i = 0; i < activeTokens.length; i++) {
                string memory tokenCode = activeTokens[i];
                address tokenAddress = ITokenManagerForModules(tokenManager).getTokenAddress(tokenCode);
                uint256 balance = IERC20(tokenAddress).balanceOf(proxyGeneral);
                emit AssetTransferred(tokenCode, tokenAddress, balance, recipient);
            }
        } catch {
            // If token manager fails, just log what we can
            emit AssetTransferred("ERROR", address(0), 0, recipient);
        }
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @notice Imposta unpause timelock
     * @param newTimelock Nuovo timelock in seconds
     */
    function setUnpauseTimelock(uint256 newTimelock) public onlyOwner {
        require(newTimelock >= MIN_TIMELOCK, "Timelock below minimum");
        require(newTimelock <= MAX_TIMELOCK, "Timelock exceeds maximum");
        
        uint256 oldTimelock = unpauseTimelock;
        unpauseTimelock = newTimelock;
        
        emit UnpauseTimelockUpdated(oldTimelock, newTimelock);
    }

    /**
     * @notice Reset stato emergenza (solo per test/recovery)
     * @param emergencyType Tipo emergenza da resettare
     */
    function resetEmergencyState(string memory emergencyType) external onlyOwner {
        emergencyExecuted[emergencyType] = false;
        
        // Reset also emergency state if resetting pause
        if (keccak256(bytes(emergencyType)) == keccak256(bytes("pause"))) {
            delete emergencyState;
        }
    }

    // ==================== INTERFACE COMPLIANCE FUNCTIONS ====================

    /**
     * @notice Attiva stato emergenza (alias per emergencyPause)
     * @param reason Motivo attivazione
     */
    function activateEmergency(string memory reason) external override {
        emergencyPause(reason);
    }

    /**
     * @notice Disattiva stato emergenza (alias per emergencyUnpause)
     */
    function deactivateEmergency() external override {
        emergencyUnpause();
    }

    /**
     * @notice Verifica se è in stato emergenza
     * @return isEmergency Se in emergenza
     */
    function isEmergencyActive() external view override returns (bool isEmergency) {
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        return IProxyGeneral(proxyGeneral).paused();
    }

    /**
     * @notice Lista tutti i contatti emergenza
     * @dev Returns real timestamps and roles stored during addition (Sprint 3.3)
     * @return contacts Array contatti con metadati completi
     */
    function getEmergencyContacts() external view override returns (EmergencyContact[] memory contacts) {
        contacts = new EmergencyContact[](emergencyContacts.length);
        
        for (uint256 i = 0; i < emergencyContacts.length; i++) {
            address contactAddr = emergencyContacts[i];
            contacts[i] = EmergencyContact({
                contactAddress: contactAddr,
                role: contactRole[contactAddr], // Sprint 3.3: Real role from storage
                isActive: true,
                addedAt: contactAddedAt[contactAddr] // Sprint 3.3: Real timestamp from storage
            });
        }
    }

    /**
     * @notice Verifica se indirizzo è contatto emergenza
     * @param contact Indirizzo da verificare
     * @return isContact Se è contatto emergenza
     */
    function checkIsEmergencyContact(address contact) external view override returns (bool isContact) {
        return isEmergencyContact[contact];
    }

    /**
     * @notice Imposta timelock per emergenza (alias for setUnpauseTimelock)
     * @param newTimelock Nuovo timelock in secondi
     */
    function setEmergencyTimelock(uint256 newTimelock) external override onlyOwner {
        setUnpauseTimelock(newTimelock);
    }

    /**
     * @notice Ottiene timelock corrente
     * @return timelock Timelock in secondi
     */
    function getEmergencyTimelock() external view override returns (uint256 timelock) {
        return unpauseTimelock;
    }

    /**
     * @notice Verifica se timelock è scaduto
     * @return expired Se timelock scaduto
     */
    function isTimelockExpired() external view override returns (bool expired) {
        if (!emergencyState.isActive) return false;
        return block.timestamp >= (emergencyState.activatedAt + unpauseTimelock);
    }

    /**
     * @notice Imposta cooldown emergenza
     * @param cooldownPeriod Periodo cooldown in secondi
     */
    function setEmergencyCooldown(uint256 cooldownPeriod) external override onlyOwner {
        emergencyState.cooldownUntil = block.timestamp + cooldownPeriod;
        emit EmergencyCooldownUpdated(0, cooldownPeriod);
    }

    /**
     * @notice Verifica se in cooldown
     * @return inCooldown Se in periodo cooldown
     */
    function isInCooldown() external view override returns (bool inCooldown) {
        return block.timestamp < emergencyState.cooldownUntil;
    }

    /**
     * @notice Tempo rimanente cooldown
     * @return remaining Secondi rimanenti
     */
    function getRemainingCooldown() external view override returns (uint256 remaining) {
        if (block.timestamp >= emergencyState.cooldownUntil) {
            return 0;
        }
        return emergencyState.cooldownUntil - block.timestamp;
    }

    /**
     * @notice Crea snapshot asset correnti
     * @dev Stores complete snapshot of system state for audit/recovery
     * @return snapshotId ID dello snapshot creato
     */
    function createAssetSnapshot() external override returns (uint256 snapshotId) {
        // INCREMENT SNAPSHOT COUNTER
        snapshotCount++;
        snapshotId = snapshotCount;
        
        // GET CONTRACT REFERENCES
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        address baseAssetAddress = IBeacon(beacon).getImplementation("BASE_ASSET");
        
        ITokenManagerForModules tokens = ITokenManagerForModules(tokenManager);
        
        string[] memory activeTokens = tokens.getActiveTokens();
        
        IEmergencyHandler.TokenBalance[] memory tokenBalances = new IEmergencyHandler.TokenBalance[](activeTokens.length + 1);
        
        for (uint256 i = 0; i < activeTokens.length; i++) {
            string memory tokenCode = activeTokens[i];
            address tokenAddress = tokens.getTokenAddress(tokenCode);
            uint256 balance = IERC20(tokenAddress).balanceOf(proxyGeneral);
            
            tokenBalances[i] = IEmergencyHandler.TokenBalance({
                tokenCode: tokenCode,
                tokenAddress: tokenAddress,
                balance: balance
            });
        }
        
        // SNAPSHOT BASE ASSET
        uint256 baseAssetBalance = IERC20(baseAssetAddress).balanceOf(proxyGeneral);
        tokenBalances[activeTokens.length] = IEmergencyHandler.TokenBalance({
            tokenCode: "BASE_ASSET",
            tokenAddress: baseAssetAddress,
            balance: baseAssetBalance
        });
        
        IEmergencyHandler.AssetSnapshot memory snapshot = IEmergencyHandler.AssetSnapshot({
            snapshotId: snapshotId,
            timestamp: block.timestamp,
            totalValue: _getTotalPoolValue(),
            baseAssetBalance: baseAssetBalance,
            tokenBalances: tokenBalances,
            capturedBy: msg.sender
        });
        
        // STORE SNAPSHOT
        snapshots[snapshotId] = snapshot;
        snapshotIds.push(snapshotId);
        
        emit AssetSnapshotCreated({
            snapshotId: snapshotId,
            totalValue: snapshot.totalValue,
            timestamp: block.timestamp
        });
        
        return snapshotId;
    }

    /**
     * @notice Ottiene snapshot per ID
     * @dev Retrieves stored snapshot from mapping
     * @param snapshotId ID snapshot da recuperare
     * @return snapshot Dati completi snapshot
     */
    function getAssetSnapshot(uint256 snapshotId) external view override returns (AssetSnapshot memory snapshot) {
        require(snapshotId > 0 && snapshotId <= snapshotCount, "Invalid snapshot ID");
        
        snapshot = snapshots[snapshotId];
        
        // Validate snapshot exists (check timestamp as indicator)
        require(snapshot.timestamp > 0, "Snapshot not found");
        
        return snapshot;
    }

    /**
     * @notice Lista tutti gli snapshot creati
     * @dev Returns all stored snapshots (use with caution for large datasets)
     * @return snapshotList Array completo di tutti gli snapshot
     */
    function getAllSnapshots() external view override returns (AssetSnapshot[] memory snapshotList) {
        snapshotList = new AssetSnapshot[](snapshotCount);
        
        for (uint256 i = 0; i < snapshotIds.length; i++) {
            uint256 id = snapshotIds[i];
            snapshotList[i] = snapshots[id];
        }
        
        return snapshotList;
    }
    
    /**
     * @notice Ottiene numero totale di snapshot creati
     * @return count Numero snapshot
     */
    function getSnapshotCount() external view returns (uint256 count) {
        return snapshotCount;
    }

    /**
     * @notice Valida completa dello stato sistema
     * @return isHealthy Se sistema è healthy
     * @return issues Array problemi rilevati
     */
    function validateSystemHealth() external view override returns (bool isHealthy, string[] memory issues) {
        address valueCalculator = IBeacon(beacon).getImplementation("ValueCalculator");
        
        // Get pool validation result
        (bool poolValid, string memory poolError) = IValueCalculatorForModules(valueCalculator).validatePoolValue();
        
        if (!poolValid) {
            issues = new string[](1);
            issues[0] = poolError;
            return (false, issues);
        }
        
        // System is healthy
        issues = new string[](0);
        return (true, issues);
    }

    /**
     * @notice Controlla integrità asset
     * @return isIntact Se asset integri
     * @return errorReason Motivo errore se presenti
     */
    function checkAssetIntegrity() external view override returns (bool isIntact, string memory errorReason) {
        (bool isHealthy, string[] memory issues) = this.validateSystemHealth();
        
        if (!isHealthy && issues.length > 0) {
            return (false, issues[0]);
        }
        
        return (true, "");
    }

    /**
     * @notice Pausa tutte le operazioni
     */
    function pauseAllOperations() external override onlyEmergencyAuthorized {
        emergencyPause("All operations paused by emergency contact");
    }

    /**
     * @notice Riprende tutte le operazioni
     */
    function resumeAllOperations() external override onlyOwner {
        emergencyUnpause();
    }

    /**
     * @notice Withdraw emergenza con interfaccia compatibile
     * @param token Indirizzo token
     * @param amount Quantità
     * @param recipient Destinatario
     */
    function emergencyWithdraw(address token, uint256 amount, address recipient) external override onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        IProxyGeneral(proxyGeneral).emergencyTransfer(token, amount, recipient);
        
        emit EmergencyWithdrawExecuted(token, amount, recipient);
    }

    /**
     * @notice Trasferimento emergenza ETH
     * @param to Destinatario
     * @param amount Quantità ETH
     */
    function emergencyTransfer(address payable to, uint256 amount) external override onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(address(this).balance >= amount, "Insufficient balance");
        
        to.transfer(amount);
        emit EmergencyTransferExecuted(to, amount);
    }

    /**
     * @notice Verifica permessi emergenza per utente
     * @param user Indirizzo utente
     * @return hasAccess Se ha accesso
     * @return role Ruolo se applicabile
     */
    function checkEmergencyAccess(address user) external view override returns (bool hasAccess, string memory role) {
        if (user == owner()) {
            return (true, "Owner");
        }
        
        if (isEmergencyContact[user]) {
            return (true, "Emergency Contact");
        }
        
        return (false, "No Access");
    }

    // ==================== HELPER FUNCTIONS ====================

    /**
     * @notice Ottiene valore totale pool (helper interno)
     * @return totalValue Valore totale
     */
    function _getTotalPoolValue() internal view returns (uint256 totalValue) {
        try IValueCalculatorForModules(IBeacon(beacon).getImplementation("ValueCalculator")).getTotalPoolValueView() returns (uint256 value) {
            return value;
        } catch {
            return 0;
        }
    }
}
