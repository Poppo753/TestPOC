// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Beacon
 * @dev Registry centrale per gestione moduli con sicurezza avanzata
 * @custom:security-contact security@yourdomain.com
 */
contract Beacon {
    
    // ==================== STORAGE ====================
    
    /// @notice Mapping da module name a implementation address
    mapping(string => address) private implementations;
    
    /// @notice Owner corrente del Beacon
    address public owner;
    
    /// @notice Pending owner per 2-step transfer
    address public pendingOwner;
    
    /// @notice Lista moduli registrati
    string[] private registeredModules;
    
    /// @notice Tracking se un modulo è registrato
    mapping(string => bool) private moduleExists;
    
    /// @notice Implementation history per audit trail
    mapping(string => address[]) private implementationHistory;
    
    /// @notice Timestamp ultimo update per modulo
    mapping(string => uint256) private lastUpdate;
    
    /// @notice Freeze status per moduli (emergency)
    mapping(string => bool) private moduleFrozen;
    
    /// @notice Global freeze (emergency totale)
    bool public globalFreeze;

    // ==================== EVENTS ====================
    
    event ImplementationUpdated(
        string indexed module, 
        address indexed oldImplementation,
        address indexed newImplementation,
        uint256 timestamp
    );
    
    event OwnershipTransferInitiated(
        address indexed currentOwner,
        address indexed pendingOwner
    );
    
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    
    event ModuleFrozen(
        string indexed module,
        address indexed freezer
    );
    
    event ModuleUnfrozen(
        string indexed module,
        address indexed unfreezer
    );
    
    event GlobalFreezeActivated(
        address indexed activator
    );
    
    event GlobalFreezeDeactivated(
        address indexed deactivator
    );

    // ==================== MODIFIERS ====================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier notFrozen(string memory module) {
        require(!globalFreeze, "Global freeze active");
        require(!moduleFrozen[module], "Module is frozen");
        _;
    }
    
    modifier validModule(string memory module) {
        require(bytes(module).length > 0, "Invalid module name");
        require(bytes(module).length <= 50, "Module name too long");
        _;
    }

    // ==================== CONSTRUCTOR ====================
    
    constructor() {
        owner = msg.sender;
    }

    // ==================== IMPLEMENTATION MANAGEMENT ====================

    /**
     * @notice Aggiorna implementation di un modulo con validazioni sicurezza
     * @param module Nome del modulo
     * @param newImplementation Indirizzo nuova implementation
     */
    function updateImplementation(
        string memory module, 
        address newImplementation
    ) external onlyOwner validModule(module) notFrozen(module) {
        require(newImplementation != address(0), "Invalid implementation address");
        require(_isContract(newImplementation), "Implementation must be a contract");
        
        address oldImplementation = implementations[module];
        
        // PREVENT SAME ADDRESS UPDATE
        require(oldImplementation != newImplementation, "Same implementation address");
        
        // STORE OLD IMPLEMENTATION IN HISTORY
        if (oldImplementation != address(0)) {
            implementationHistory[module].push(oldImplementation);
        }
        
        // UPDATE IMPLEMENTATION
        implementations[module] = newImplementation;
        lastUpdate[module] = block.timestamp;
        
        // ADD TO REGISTERED MODULES IF NEW
        if (!moduleExists[module]) {
            moduleExists[module] = true;
            registeredModules.push(module);
        }
        
        emit ImplementationUpdated(module, oldImplementation, newImplementation, block.timestamp);
    }

    /**
     * @notice Ottiene implementation di un modulo
     * @param module Nome del modulo
     * @return implementation Indirizzo implementation
     */
    function getImplementation(string memory module) external view validModule(module) returns (address implementation) {
        implementation = implementations[module];
        require(implementation != address(0), "Implementation not found");
        require(!globalFreeze && !moduleFrozen[module], "Module access frozen");
        return implementation;
    }

    /**
     * @notice Verifica se un modulo esiste
     * @param module Nome del modulo
     * @return exists Se il modulo è registrato
     */
    function checkModuleExists(string memory module) external view returns (bool exists) {
        return moduleExists[module];
    }

    /**
     * @notice Ottiene lista di tutti i moduli registrati
     * @return modules Array nomi moduli
     */
    function getRegisteredModules() external view returns (string[] memory modules) {
        return registeredModules;
    }

    /**
     * @notice Ottiene history implementations per un modulo
     * @param module Nome del modulo
     * @return history Array indirizzi precedenti
     */
    function getImplementationHistory(string memory module) external view returns (address[] memory history) {
        return implementationHistory[module];
    }

    /**
     * @notice Ottiene info complete di un modulo
     * @param module Nome del modulo
     * @return currentImpl Implementation corrente
     * @return lastUpdated Timestamp ultimo update
     * @return historyCount Numero versioni precedenti
     * @return isFrozen Se modulo è frozen
     */
    function getModuleInfo(string memory module) external view returns (
        address currentImpl,
        uint256 lastUpdated,
        uint256 historyCount,
        bool isFrozen
    ) {
        currentImpl = implementations[module];
        lastUpdated = lastUpdate[module];
        historyCount = implementationHistory[module].length;
        isFrozen = moduleFrozen[module];
        
        return (currentImpl, lastUpdated, historyCount, isFrozen);
    }

    // ==================== EMERGENCY CONTROLS ====================

    /**
     * @notice Freeze un singolo modulo (emergenza)
     * @param module Nome del modulo da freezare
     */
    function freezeModule(string memory module) external onlyOwner validModule(module) {
        require(moduleExists[module], "Module does not exist");
        require(!moduleFrozen[module], "Module already frozen");
        
        moduleFrozen[module] = true;
        emit ModuleFrozen(module, msg.sender);
    }

    /**
     * @notice Unfreeze un singolo modulo
     * @param module Nome del modulo da unfreezare
     */
    function unfreezeModule(string memory module) external onlyOwner validModule(module) {
        require(moduleFrozen[module], "Module not frozen");
        
        moduleFrozen[module] = false;
        emit ModuleUnfrozen(module, msg.sender);
    }

    /**
     * @notice Freeze globale di tutto il sistema (emergenza totale)
     */
    function activateGlobalFreeze() external onlyOwner {
        require(!globalFreeze, "Global freeze already active");
        
        globalFreeze = true;
        emit GlobalFreezeActivated(msg.sender);
    }

    /**
     * @notice Rimuove freeze globale
     */
    function deactivateGlobalFreeze() external onlyOwner {
        require(globalFreeze, "Global freeze not active");
        
        globalFreeze = false;
        emit GlobalFreezeDeactivated(msg.sender);
    }

    // ==================== 2-STEP OWNERSHIP TRANSFER ====================

    /**
     * @notice Inizia trasferimento ownership (step 1)
     * @param newOwner Nuovo owner proposto
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner address");
        require(newOwner != owner, "Same owner address");
        require(newOwner != pendingOwner, "Already pending owner");
        
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(owner, newOwner);
    }

    /**
     * @notice Accetta ownership (step 2)
     * @dev Deve essere chiamata dal pending owner
     */
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not the pending owner");
        
        address previousOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        
        emit OwnershipTransferred(previousOwner, owner);
    }

    /**
     * @notice Cancella pending ownership transfer
     */
    function cancelOwnershipTransfer() external onlyOwner {
        require(pendingOwner != address(0), "No pending ownership transfer");
        
        pendingOwner = address(0);
    }

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * @notice Verifica se un indirizzo è un contratto
     * @param addr Indirizzo da verificare
     * @return isContract Se l'indirizzo è un contratto
     */
    function _isContract(address addr) internal view returns (bool isContract) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

    /**
     * @notice Batch update di più moduli
     * @param modules Array nomi moduli
     * @param newImplementations Array indirizzi implementations
     */
    function batchUpdateImplementations(
        string[] memory modules,
        address[] memory newImplementations
    ) external onlyOwner {
        require(modules.length == newImplementations.length, "Arrays length mismatch");
        require(modules.length <= 10, "Too many modules");
        require(!globalFreeze, "Global freeze active");
        
        for (uint256 i = 0; i < modules.length; i++) {
            string memory module = modules[i];
            address newImpl = newImplementations[i];
            
            // VALIDATE
            require(bytes(module).length > 0, "Invalid module name");
            require(newImpl != address(0), "Invalid implementation address");
            require(_isContract(newImpl), "Implementation must be a contract");
            require(!moduleFrozen[module], "Module is frozen");
            
            address oldImpl = implementations[module];
            require(oldImpl != newImpl, "Same implementation address");
            
            // UPDATE
            if (oldImpl != address(0)) {
                implementationHistory[module].push(oldImpl);
            }
            
            implementations[module] = newImpl;
            lastUpdate[module] = block.timestamp;
            
            if (!moduleExists[module]) {
                moduleExists[module] = true;
                registeredModules.push(module);
            }
            
            emit ImplementationUpdated(module, oldImpl, newImpl, block.timestamp);
        }
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Ottiene stato generale del Beacon
     * @return totalModules Numero moduli registrati
     * @return frozenModules Numero moduli frozen
     * @return isGlobalFrozen Se freeze globale è attivo
     * @return currentOwner Owner corrente
     * @return pendingOwner Pending owner (se presente)
     */
    function getBeaconStatus() external view returns (
        uint256 totalModules,
        uint256 frozenModules,
        bool isGlobalFrozen,
        address currentOwner,
        address pendingOwner
    ) {
        totalModules = registeredModules.length;
        
        // Count frozen modules
        for (uint256 i = 0; i < registeredModules.length; i++) {
            if (moduleFrozen[registeredModules[i]]) {
                frozenModules++;
            }
        }
        
        isGlobalFrozen = globalFreeze;
        currentOwner = owner;
        pendingOwner = pendingOwner;
        
        return (totalModules, frozenModules, isGlobalFrozen, currentOwner, pendingOwner);
    }

    /**
     * @notice Verifica salute del sistema
     * @return isHealthy Se tutti i moduli sono accessibili
     * @return issues Array problemi identificati
     */
    function checkSystemHealth() external view returns (bool isHealthy, string[] memory issues) {
        string[] memory tempIssues = new string[](20);
        uint256 issueCount = 0;
        
        if (globalFreeze) {
            tempIssues[issueCount] = "Global freeze is active";
            issueCount++;
        }
        
        for (uint256 i = 0; i < registeredModules.length; i++) {
            string memory module = registeredModules[i];
            
            if (moduleFrozen[module]) {
                tempIssues[issueCount] = string(abi.encodePacked("Module frozen: ", module));
                issueCount++;
            }
            
            if (implementations[module] == address(0)) {
                tempIssues[issueCount] = string(abi.encodePacked("No implementation: ", module));
                issueCount++;
            }
        }
        
        // Create properly sized array
        issues = new string[](issueCount);
        for (uint256 i = 0; i < issueCount; i++) {
            issues[i] = tempIssues[i];
        }
        
        isHealthy = (issueCount == 0);
        return (isHealthy, issues);
    }
}
