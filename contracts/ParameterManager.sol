// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IParameterManager.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/IProxyGeneral.sol";

/**
 * @title ParameterManager
 * @dev Gestisce parametri di sistema con governance timelock
 * @custom:security-contact security@yourdomain.com
 */
contract ParameterManager is IParameterManager, Ownable {
    
    // ==================== STORAGE ====================
    
    /// @notice Beacon address per resolution moduli
    address public immutable beacon;
    
    /// @notice Storage parametri completo
    mapping(string => IParameterManager.Parameter) private parameters;
    
    /// @notice Default values per reset (set at initialization, scaled to base asset)
    mapping(string => uint256) private defaultValues;
    
    /// @notice Lista di tutti i parametri per iterazione
    string[] private parameterNames;
    
    mapping(string => IParameterManager.ParameterHistory[]) private parameterHistory;
    
    /// @notice Timelock configuration
    uint256 public parameterTimelock;
    uint256 public constant MIN_TIMELOCK = 1 hours;
    uint256 public constant MAX_TIMELOCK = 7 days;
    
    // ==================== STORAGE ENHANCEMENT (Issue #9) ====================
    
    /// @notice Proposal storage by ID for getProposal(uint256) lookup
    mapping(uint256 => IParameterManager.Parameter) private proposalById;
    
    /// @notice Counter for proposal IDs
    uint256 private nextProposalId = 1; // Start from 1 (0 = no proposal)

    // ==================== EVENTS (ENHANCED) ====================

    // ==================== EVENTS ====================
    
    event ParameterUpdated(
        string indexed parameterName,
        uint256 oldValue,
        uint256 newValue,
        uint256 timestamp,
        address indexed executor
    );
    
    event ParameterInitialized(
        string indexed parameterName,
        uint256 value,
        uint256 minValue,
        uint256 maxValue
    );
    
    event ParameterRegistered(
        string indexed parameterName,
        uint256 initialValue,
        uint256 minValue,
        uint256 maxValue,
        bool requiresTimelock
    );
    
    event ParameterChangeProposed(
        string indexed parameterName,
        uint256 oldValue,
        uint256 newValue,
        uint256 effectiveAt
    );
    
    event ParameterEmergencyChanged(
        string indexed parameterName,
        uint256 oldValue,
        uint256 newValue,
        address indexed changedBy
    );

    // ==================== MODIFIERS ====================

    modifier onlyAuthorizedUpdater() {
        require(
            msg.sender == owner() ||
            msg.sender == IBeacon(beacon).getImplementation("EmergencyHandler"),
            "Not authorized to update parameters"
        );
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(address _beacon, uint8 _baseDecimals) Ownable() {
        require(_beacon != address(0), "Invalid beacon address");
        beacon = _beacon;
        
        // Initialize default parameter timelock to 24 hours
        parameterTimelock = 24 hours;
        
        // INITIALIZE DEFAULT PARAMETERS (scaled to base asset decimals)
        _initializeDefaultParameters(_baseDecimals);
    }

    /**
     * @notice Inizializza parametri di default del sistema con complete struct
     * @param _baseDecimals Decimali del base asset (18 per WETH, 6 per USDC, 8 per WBTC)
     */
    function _initializeDefaultParameters(uint8 _baseDecimals) internal {
        uint256 unit = 10 ** uint256(_baseDecimals); // 1 full token in smallest units

        // LIQUIDITY LIMITS (critical - require timelock)
        _registerParameter("maxDeposit", 100 * unit, 1 * unit, 1000 * unit, true);
        _registerParameter("maxWithdrawPerTx", 50 * unit, unit / 10, 500 * unit, true);
        _registerParameter("minDeposit", unit / 1_000_000, unit / 1_000_000, 1 * unit, false);
        _registerParameter("minWithdraw", unit / 1_000_000, unit / 1_000_000, 1 * unit, false);
        _registerParameter("withdrawLimitPerHour", 100 * unit, 1 * unit, 10000 * unit, true);
        
        // POOL PARAMETERS (critical - require timelock)
        _registerParameter("maxSlippage", 200, 10, 1000, true); // 0.1% to 10%
        _registerParameter("poolReserveRatio", 0, 0, 5000, true); // 0% to 50%
        
        // CACHE & TIMING (non-critical)
        _registerParameter("cacheDuration", 5 minutes, 1 minutes, 1 hours, false);
        _registerParameter("maxPriceAge", 1 hours, 5 minutes, 24 hours, false);
        
        // OPERATIONAL LIMITS (non-critical)
        _registerParameter("maxTokensPerOperation", 10, 1, 50, false);
        _registerParameter("maxErrors", 3, 1, 100, false);
    }

    /**
     * @notice Helper per registrare parametro completo
     */
    function _registerParameter(
        string memory name,
        uint256 value,
        uint256 minVal,
        uint256 maxVal,
        bool requiresTimelock
    ) internal {
        require(value >= minVal && value <= maxVal, "Value out of range");
        require(!parameters[name].isActive, "Parameter already exists");
        
        parameters[name] = Parameter({
            currentValue: value,
            proposedValue: 0,
            proposedAt: 0,
            effectiveAt: 0,
            minValue: minVal,
            maxValue: maxVal,
            requiresTimelock: requiresTimelock,
            isActive: true
        });
        
        // Store initial default for reset
        defaultValues[name] = value;
        
        parameterNames.push(name);
        
        // Add to history
        parameterHistory[name].push(ParameterHistory({
            value: value,
            timestamp: block.timestamp,
            changedBy: address(this) // system initialization
        }));
        
        emit ParameterRegistered(name, value, minVal, maxVal, requiresTimelock);
    }

    // ==================== PARAMETER ACCESS ====================

    /**
     * @notice Ottiene valore corrente di un parametro
     * @param parameterName Nome del parametro
     * @return value Valore del parametro
     */
    function getCurrentParameterValue(string memory parameterName) public view returns (uint256 value) {
        require(parameters[parameterName].isActive, "Parameter does not exist");
        return parameters[parameterName].currentValue;
    }

    /**
     * @notice Ottiene lista di tutti i parametri
     * @return names Array nomi parametri
     */
    function getAllParameterNames() external view returns (string[] memory names) {
        return parameterNames;
    }

    /**
     * @notice Ottiene info complete di un parametro
     * @param parameterName Nome del parametro
     * @return param Parameter struct completo
     */
    function getParameterInfo(string memory parameterName) external view returns (Parameter memory param) {
        require(parameters[parameterName].isActive, "Parameter does not exist");
        return parameters[parameterName];
    }

    // ==================== PARAMETER UPDATES ====================

    /**
     * @notice Propone cambio parametro (con timelock se richiesto)
     * @param parameterName Nome del parametro
     * @param newValue Nuovo valore
     */
    function proposeParameterChange(string memory parameterName, uint256 newValue) external onlyAuthorizedUpdater {
        Parameter storage param = parameters[parameterName];
        require(param.isActive, "Parameter does not exist");
        require(newValue >= param.minValue && newValue <= param.maxValue, "Value out of range");
        require(newValue != param.currentValue, "Same as current value");
        
        if (param.requiresTimelock) {
            // PROPOSE WITH TIMELOCK
            param.proposedValue = newValue;
            param.proposedAt = block.timestamp;
            param.effectiveAt = block.timestamp + parameterTimelock;
            
            // Store proposal by ID for getProposal(uint256) lookup (Issue #9 FIX)
            uint256 proposalId = nextProposalId++;
            proposalById[proposalId] = param;
            
            emit ParameterChangeProposed(parameterName, param.currentValue, newValue, param.effectiveAt);
        } else {
            // IMMEDIATE CHANGE
            uint256 oldValue = param.currentValue;
            param.currentValue = newValue;
            
            // ADD TO HISTORY
            parameterHistory[parameterName].push(ParameterHistory({
                value: newValue,
                timestamp: block.timestamp,
                changedBy: msg.sender
            }));
            
            emit ParameterUpdated(parameterName, oldValue, newValue, block.timestamp, msg.sender);
        }
    }

    /**
     * @notice Esegue cambio parametro dopo timelock
     * @param parameterName Nome del parametro
     */
    function executeParameterChange(string memory parameterName) external onlyAuthorizedUpdater {
        Parameter storage param = parameters[parameterName];
        require(param.isActive, "Parameter does not exist");
        require(param.requiresTimelock, "Parameter doesn't require timelock");
        require(param.proposedValue > 0, "No pending proposal");
        require(block.timestamp >= param.effectiveAt, "Timelock not expired");
        
        uint256 oldValue = param.currentValue;
        param.currentValue = param.proposedValue;
        
        // RESET PROPOSAL
        uint256 newValue = param.proposedValue;
        param.proposedValue = 0;
        param.proposedAt = 0;
        param.effectiveAt = 0;
        
        // ADD TO HISTORY
        parameterHistory[parameterName].push(ParameterHistory({
            value: newValue,
            timestamp: block.timestamp,
            changedBy: msg.sender
        }));
        
        emit ParameterUpdated(parameterName, oldValue, newValue, block.timestamp, msg.sender);
    }

    /**
     * @notice Emergency parameter change (bypasses timelock)
     * @param parameterName Nome del parametro
     * @param newValue Nuovo valore
     */
    function emergencySetParameter(string memory parameterName, uint256 newValue) external onlyAuthorizedUpdater {
        Parameter storage param = parameters[parameterName];
        require(param.isActive, "Parameter does not exist");
        require(newValue >= param.minValue && newValue <= param.maxValue, "Value out of range");
        
        // CHECK EMERGENCY STATE (system must be paused)
        IProxyGeneral proxyGeneral = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        require(proxyGeneral.paused(), "System must be paused for emergency override");
        
        uint256 oldValue = param.currentValue;
        param.currentValue = newValue;
        
        // CLEAR PENDING PROPOSAL
        param.proposedValue = 0;
        param.proposedAt = 0;
        param.effectiveAt = 0;
        
        // ADD TO HISTORY
        parameterHistory[parameterName].push(ParameterHistory({
            value: newValue,
            timestamp: block.timestamp,
            changedBy: msg.sender
        }));
        
        emit ParameterEmergencyChanged(parameterName, oldValue, newValue, msg.sender);
    }

    /**
     * @notice Aggiorna multipli parametri in una transazione
     * @param parameterNames Array nomi parametri
     * @param newValues Array nuovi valori
     */
    function updateMultipleParameters(
        string[] memory parameterNames,
        uint256[] memory newValues
    ) external onlyAuthorizedUpdater {
        require(parameterNames.length == newValues.length, "Arrays length mismatch");
        require(parameterNames.length <= 20, "Too many parameters");
        
        for (uint256 i = 0; i < parameterNames.length; i++) {
            string memory paramName = parameterNames[i];
            uint256 newValue = newValues[i];
            
            require(parameters[paramName].isActive, "Parameter does not exist");
            require(_isValidParameterValue(paramName, newValue), "Invalid parameter value");
            
            uint256 oldValue = parameters[paramName].currentValue;
            parameters[paramName].currentValue = newValue;
            
            emit ParameterUpdated(
                paramName,
                oldValue,
                newValue,
                block.timestamp,
                msg.sender
            );
        }
    }

    // ==================== VALIDATION ====================

    /**
     * @notice Valida se un valore è accettabile per un parametro
     * @param parameterName Nome parametro
     * @param newValue Valore da validare
     * @return isValid Se il valore è valido
     */
    function isValidParameterValue(string memory parameterName, uint256 newValue) external view returns (bool isValid) {
        if (!parameters[parameterName].isActive) return false;
        return _isValidParameterValue(parameterName, newValue);
    }

    /**
     * @notice Controlla se un cambio parametro può essere eseguito
     * @param parameterName Nome parametro
     * @return canExecute Se può essere eseguito
     * @return reason Motivo se non può
     */
    function canExecuteParameterChange(string memory parameterName) external view returns (bool canExecute, string memory reason) {
        Parameter storage param = parameters[parameterName];
        
        if (!param.isActive) {
            return (false, "Parameter not registered");
        }
        
        if (!param.requiresTimelock) {
            return (false, "Parameter doesn't require timelock execution");
        }
        
        if (param.proposedValue == 0) {
            return (false, "No pending proposal");
        }
        
        if (block.timestamp < param.effectiveAt) {
            uint256 remaining = param.effectiveAt - block.timestamp;
            return (false, "Timelock active");
        }
        
        return (true, "Can execute");
    }

    /**
     * @notice Validazione interna parametri — usa range dinamici dal storage
     */
    function _isValidParameterValue(string memory parameterName, uint256 newValue) internal view returns (bool) {
        Parameter storage param = parameters[parameterName];
        if (!param.isActive) return false;
        return newValue >= param.minValue && newValue <= param.maxValue;
    }

    /**
     * @notice Ottiene range validazione per un parametro dal storage
     */
    function _getValidationRange(string memory parameterName) internal view returns (uint256 minVal, uint256 maxVal) {
        Parameter storage param = parameters[parameterName];
        if (!param.isActive) return (0, type(uint256).max);
        return (param.minValue, param.maxValue);
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @notice Registra nuovo parametro nel sistema
     * @param parameterName Nome nuovo parametro
     * @param initialValue Valore iniziale
     * @param minValue Valore minimo
     * @param maxValue Valore massimo
     * @param requiresTimelock Se richiede timelock
     */
    function registerParameter(
        string memory parameterName,
        uint256 initialValue,
        uint256 minValue,
        uint256 maxValue,
        bool requiresTimelock
    ) external onlyOwner {
        require(!parameters[parameterName].isActive, "Parameter already exists");
        require(bytes(parameterName).length > 0, "Invalid parameter name");
        require(initialValue >= minValue && initialValue <= maxValue, "Invalid initial value");
        
        _registerParameter(parameterName, initialValue, minValue, maxValue, requiresTimelock);
    }

    /**
     * @notice Imposta parameter timelock
     * @param newTimelock Nuovo timelock
     */
    function setParameterTimelock(uint256 newTimelock) external onlyOwner {
        require(newTimelock >= MIN_TIMELOCK, "Timelock below minimum");
        require(newTimelock <= MAX_TIMELOCK, "Timelock exceeds maximum");
        
        parameterTimelock = newTimelock;
    }

    /**
     * @notice Reset parametro al valore di default
     * @param parameterName Nome parametro da resettare
     */
    function resetParameterToDefault(string memory parameterName) external onlyOwner {
        require(parameters[parameterName].isActive, "Parameter does not exist");
        
        uint256 oldValue = parameters[parameterName].currentValue;
        uint256 defaultValue = _getDefaultValue(parameterName);
        
        parameters[parameterName].currentValue = defaultValue;
        
        emit ParameterUpdated(
            parameterName,
            oldValue,
            defaultValue,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @notice Ottiene valore di default per un parametro (dal storage, scaled al base asset)
     */
    function _getDefaultValue(string memory parameterName) internal view returns (uint256) {
        return defaultValues[parameterName];
    }

    // ==================== INTERFACE COMPLIANCE FUNCTIONS ====================

    /**
     * @notice Propone cambio parametro con timelock (usando struttura Parameter)
     * @param key Chiave parametro
     * @param value Nuovo valore (encoded come bytes)
     * @param description Descrizione cambio
     * @return proposalId ID della proposta
     */
    function proposeParameterChange(
        string memory key,
        bytes memory value,
        string memory description
    ) external override onlyOwner returns (uint256 proposalId) {
        require(bytes(key).length > 0, "Invalid parameter key");
        
        // Decode uint256 from bytes
        uint256 newValue = abi.decode(value, (uint256));
        
        // Store as parameter change proposal 
        Parameter storage param = parameters[key];
        param.proposedValue = newValue;
        param.proposedAt = block.timestamp;
        param.effectiveAt = block.timestamp + parameterTimelock;
        
        proposalId = uint256(keccak256(abi.encodePacked(key, block.timestamp)));
        
        emit ParameterProposed(proposalId, key, value, msg.sender, param.effectiveAt);
        emit ParameterChangeProposed(key, param.currentValue, newValue, param.effectiveAt);
    }

    /**
     * @notice Esegue cambio parametro dopo timelock
     * @param proposalId ID proposta (usando key encoding)
     */
    function executeParameterChange(uint256 proposalId) external override {
        // Find parameter by reconstructing from proposal ID
        // In full implementation, would maintain proposal mapping
        
        // For now, iterate through all parameters to find executable ones
        for (uint256 i = 0; i < parameterNames.length; i++) {
            string memory key = parameterNames[i];
            Parameter storage param = parameters[key];
            
            if (param.proposedAt > 0 && block.timestamp >= param.effectiveAt && !param.isActive) {
                uint256 oldValue = param.currentValue;
                param.currentValue = param.proposedValue;
                param.isActive = true;
                
                // Reset proposal state
                param.proposedValue = 0;
                param.proposedAt = 0;
                param.effectiveAt = 0;
                
                emit ParameterProposalExecuted(proposalId, key, msg.sender);
                emit ParameterChanged(key, abi.encode(oldValue), abi.encode(param.currentValue), msg.sender, block.timestamp);
                return;
            }
        }
        
        revert("No executable proposal found");
    }

    /**
     * @notice Annulla proposta parametro
     * @param proposalId ID proposta
     */
    function cancelParameterProposal(uint256 proposalId) external override onlyOwner {
        // Similar logic to find and cancel proposal
        for (uint256 i = 0; i < parameterNames.length; i++) {
            string memory key = parameterNames[i];
            Parameter storage param = parameters[key];
            
            if (param.proposedAt > 0) {
                param.proposedValue = 0;
                param.proposedAt = 0;
                param.effectiveAt = 0;
                
                emit ParameterProposalCancelled(proposalId, key, msg.sender);
                return;
            }
        }
    }

    /**
     * @notice Ottiene valore parametro come bytes
     * @param key Chiave parametro
     * @return value Valore parametro encoded
     */
    function getParameter(string memory key) external view override returns (bytes memory value) {
        uint256 paramValue = parameters[key].currentValue;
        return abi.encode(paramValue);
    }

    /**
     * @notice Imposta parametro direttamente (emergency override)
     * @param key Chiave parametro
     * @param value Valore parametro (bytes encoded)
     * @param reason Motivo override
     */
    function setParameterEmergency(
        string memory key,
        bytes memory value,
        string memory reason
    ) external override onlyOwner {
        uint256 newValue = abi.decode(value, (uint256));
        uint256 oldValue = parameters[key].currentValue;
        
        parameters[key].currentValue = newValue;
        
        emit EmergencyParameterSet(key, value, reason, msg.sender);
        emit ParameterEmergencyChanged(key, oldValue, newValue, msg.sender);
    }

    /**
     * @notice Verifica se parametro esiste
     * @param key Chiave parametro
     * @return exists Se parametro esiste
     */
    function parameterExists(string memory key) external view override returns (bool exists) {
        return parameters[key].isActive;
    }

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
    ) external view override returns (bool isValid, string memory errorMessage) {
        if (!parameters[key].isActive) {
            return (false, "Parameter does not exist");
        }
        
        uint256 newValue = abi.decode(value, (uint256));
        Parameter storage param = parameters[key];
        
        if (newValue < param.minValue) {
            return (false, "Value below minimum");
        }
        
        if (newValue > param.maxValue) {
            return (false, "Value above maximum");
        }
        
        return (true, "");
    }

    /**
     * @notice Registra nuovo parametro nel sistema
     * @param key Chiave parametro
     * @param defaultValue Valore default (bytes)
     * @param description Descrizione parametro
     */
    function registerParameter(
        string memory key,
        bytes memory defaultValue,
        string memory description
    ) external override onlyOwner {
        require(!parameters[key].isActive, "Parameter already exists");
        
        uint256 value = abi.decode(defaultValue, (uint256));
        parameters[key].isActive = true;
        parameterNames.push(key);
        
        parameters[key] = Parameter({
            currentValue: value,
            proposedValue: 0,
            proposedAt: 0,
            effectiveAt: 0,
            minValue: 0,
            maxValue: type(uint256).max,
            requiresTimelock: true,
            isActive: true
        });
        
        defaultValues[key] = value;
        
        emit ParameterRegistered(key, defaultValue, description);
    }

    /**
     * @notice Lista parametri registrati
     * @return keys Array chiavi parametri
     */
    function getRegisteredParameters() external view override returns (string[] memory keys) {
        return parameterNames;
    }

    /**
     * @notice Rimuove parametro dal registro
     * @param key Chiave parametro
     */
    function unregisterParameter(string memory key) external override onlyOwner {
        require(parameters[key].isActive, "Parameter does not exist");
        
        parameters[key].isActive = false;
        delete parameters[key];
        
        // Remove from array (expensive operation)
        for (uint256 i = 0; i < parameterNames.length; i++) {
            if (keccak256(bytes(parameterNames[i])) == keccak256(bytes(key))) {
                parameterNames[i] = parameterNames[parameterNames.length - 1];
                parameterNames.pop();
                break;
            }
        }
        
        emit ParameterUnregistered(key);
    }

    /**
     * @notice Ottiene timelock corrente
     * @return timelock Timelock in secondi
     */
    function getParameterTimelock() external view override returns (uint256 timelock) {
        return parameterTimelock;
    }

    /**
     * @notice Ottiene proposta per ID (Issue #9 FIX)
     * @param proposalId ID della proposta
     * @return proposal Struct Parameter con dati proposta
     * 
     * @custom:implementation
     * - Lookup diretto da proposalById mapping
     * - Ritorna proposta vuota se ID non esiste
     * - Usato per query alternative rispetto a getActiveProposals()
     */
    function getProposal(uint256 proposalId) external view override returns (Parameter memory proposal) {
        // Return proposal from storage (empty if not exists)
        return proposalById[proposalId];
    }

    /**
     * @notice Lista proposte attive
     * @return proposals Array proposte attive
     */
    function getActiveProposals() external view override returns (Parameter[] memory proposals) {
        uint256 activeCount = 0;
        
        // Count active proposals
        for (uint256 i = 0; i < parameterNames.length; i++) {
            if (parameters[parameterNames[i]].proposedAt > 0) {
                activeCount++;
            }
        }
        
        proposals = new Parameter[](activeCount);
        uint256 index = 0;
        
        // Fill active proposals
        for (uint256 i = 0; i < parameterNames.length; i++) {
            Parameter storage param = parameters[parameterNames[i]];
            if (param.proposedAt > 0) {
                proposals[index] = param;
                index++;
            }
        }
    }

    /**
     * @notice Lista proposte eseguibili
     * @return proposals Array proposte pronte
     */
    function getExecutableProposals() external view override returns (Parameter[] memory proposals) {
        uint256 executableCount = 0;
        
        // Count executable proposals
        for (uint256 i = 0; i < parameterNames.length; i++) {
            Parameter storage param = parameters[parameterNames[i]];
            if (param.proposedAt > 0 && block.timestamp >= param.effectiveAt) {
                executableCount++;
            }
        }
        
        proposals = new Parameter[](executableCount);
        uint256 index = 0;
        
        // Fill executable proposals
        for (uint256 i = 0; i < parameterNames.length; i++) {
            Parameter storage param = parameters[parameterNames[i]];
            if (param.proposedAt > 0 && block.timestamp >= param.effectiveAt) {
                proposals[index] = param;
                index++;
            }
        }
    }

    /**
     * @notice Storico modifiche parametro
     * @param key Chiave parametro
     * @return history Array modifiche
     */
    function getParameterHistory(string memory key) external view override returns (ParameterHistory[] memory history) {
        return parameterHistory[key];
    }

    /**
     * @notice Ultima modifica parametro
     * @param key Chiave parametro
     * @return lastChange Ultima modifica
     */
    function getLastParameterChange(string memory key) external view override returns (ParameterHistory memory lastChange) {
        ParameterHistory[] storage history = parameterHistory[key];
        if (history.length > 0) {
            return history[history.length - 1];
        }
        // Return empty struct if no history
    }

    // Typed parameter access functions
    function getUintParameter(string memory key) external view override returns (uint256 value) {
        return parameters[key].currentValue;
    }

    function getBoolParameter(string memory key) external view override returns (bool value) {
        return parameters[key].currentValue != 0;
    }

    function getAddressParameter(string memory key) external view override returns (address value) {
        return address(uint160(parameters[key].currentValue));
    }

    function getStringParameter(string memory key) external view override returns (string memory value) {
        // For strings, would need different storage mechanism
        // Return empty string for now
        return "";
    }

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
    ) external override onlyOwner returns (uint256[] memory proposalIds) {
        require(keys.length == values.length, "Arrays length mismatch");
        
        proposalIds = new uint256[](keys.length);
        
        for (uint256 i = 0; i < keys.length; i++) {
            proposalIds[i] = this.proposeParameterChange(keys[i], values[i], description);
        }
        
        emit BatchParametersProposed(proposalIds, keys, description);
    }

    /**
     * @notice Esegue multiple proposte
     * @param proposalIds Array ID proposte
     */
    function executeBatchProposals(uint256[] memory proposalIds) external override {
        for (uint256 i = 0; i < proposalIds.length; i++) {
            this.executeParameterChange(proposalIds[i]);
        }
        
        emit BatchParametersExecuted(proposalIds, msg.sender);
    }
}
