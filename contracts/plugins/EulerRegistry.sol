// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EulerRegistry
 * @notice Registry centralizzato per vault Euler V2 e posizioni leverage
 * @dev Registrato nel Beacon come "EulerRegistry"
 *      Gestisce sia vault mapping che position storage centralizzato
 * 
 * Architettura:
 * - Mappa tokenCode (es. "WETH") → vault address Euler
 * - Reverse lookup: vault address → tokenCode
 * - Storage centralizzato posizioni leverage (Position Manager)
 * - Usato da EulerV2Plugin e EulerLensAdapter
 * 
 * Indirizzi Euler V2 Arbitrum (da configurare post-deploy):
 * - EVC: 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066
 * - Vault Factory: 0x78Df1CF5bf06a7f27f2ACc580B934238C1b80D50
 * 
 * @author Project4 Team
 */
contract EulerRegistry is Ownable {
    
    // ========== STATE - VAULT REGISTRY ==========
    
    /// @notice Mappa tokenCode → vault address
    mapping(string => address) private _vaults;
    
    /// @notice Mappa vault address → tokenCode (reverse lookup)
    mapping(address => string) private _tokenCodes;
    
    /// @notice Array di tutti i tokenCode registrati (per iterazione)
    string[] private _registeredTokens;
    
    /// @notice Mappa tokenCode → indice in _registeredTokens (per rimozione efficiente)
    mapping(string => uint256) private _tokenIndex;
    
    /// @notice Flag per verificare se un tokenCode è registrato
    mapping(string => bool) private _isRegistered;
    
    // ========== STATE - POSITION MANAGER ==========
    
    /// @notice Prossimo position ID da assegnare
    uint256 public nextPositionId;
    
    /// @notice Mapping positionId → LeveragePosition
    mapping(uint256 => LeveragePositionStorage) private _positions;
    
    /// @notice Mapping per iterazione efficiente delle posizioni attive
    uint256[] private _activePositionIds;
    
    /// @notice Mapping positionId → indice in _activePositionIds
    mapping(uint256 => uint256) private _activePositionIndex;
    
    /// @notice Flag per verificare se position è nell'array attivo
    mapping(uint256 => bool) private _isInActiveArray;
    
    // ========== STRUCTS ==========
    
    /// @notice Struct interna per storage posizioni leverage
    struct LeveragePositionStorage {
        uint8 subAccountId;
        address collateralVault;
        address borrowVault;
        uint256 initialCollateral;
        uint256 borrowedAmount;
        bool isActive;
        uint256 createdAt;
    }
    
    // ========== EVENTS - VAULT REGISTRY ==========
    
    /**
     * @notice Emesso quando un vault viene registrato o aggiornato
     * @param tokenCode Codice del token (es. "WETH")
     * @param vault Indirizzo del vault Euler
     * @param isNew True se nuovo, false se aggiornamento
     */
    event VaultSet(string indexed tokenCode, address indexed vault, bool isNew);
    
    /**
     * @notice Emesso quando un vault viene rimosso
     * @param tokenCode Codice del token rimosso
     * @param vault Indirizzo del vault rimosso
     */
    event VaultRemoved(string indexed tokenCode, address indexed vault);
    
    // ========== EVENTS - POSITION MANAGER ==========
    
    /**
     * @notice Emesso quando una nuova posizione leverage viene creata
     * @param positionId ID della posizione
     * @param subAccountId Sub-account ID EVC
     * @param collateralVault Vault del collaterale
     * @param borrowVault Vault del borrow
     */
    event PositionCreated(
        uint256 indexed positionId,
        uint8 subAccountId,
        address indexed collateralVault,
        address indexed borrowVault
    );
    
    /**
     * @notice Emesso quando una posizione viene aggiornata
     * @param positionId ID della posizione
     * @param borrowedAmount Nuovo importo borrowed
     */
    event PositionUpdated(uint256 indexed positionId, uint256 borrowedAmount);
    
    /**
     * @notice Emesso quando una posizione viene chiusa
     * @param positionId ID della posizione
     */
    event PositionClosed(uint256 indexed positionId);
    
    // ========== ERRORS - VAULT REGISTRY ==========
    
    error VaultNotFound(string tokenCode);
    error InvalidVaultAddress();
    error TokenCodeEmpty();
    error VaultAlreadyRegistered(address vault, string existingTokenCode);
    
    // ========== ERRORS - POSITION MANAGER ==========
    
    error PositionNotFound(uint256 positionId);
    error PositionNotActive(uint256 positionId);
    error PositionAlreadyClosed(uint256 positionId);
    error InvalidSubAccountId();
    error InvalidVault();
    
    // ========== CONSTRUCTOR ==========
    
    constructor() Ownable() {}
    
    // ========== POSITION MANAGER - WRITE FUNCTIONS ==========
    
    /**
     * @notice Crea una nuova posizione leverage (chiamata solo da EulerV2Plugin)
     * @dev Solo owner (Plugin) può chiamare
     * @param subAccountId Sub-account ID EVC
     * @param collateralVault Indirizzo vault collaterale
     * @param borrowVault Indirizzo vault borrow
     * @param initialCollateral Collaterale iniziale depositato
     * @param borrowedAmount Importo borrowed
     * @return positionId ID della nuova posizione
     * 
     * Requirements:
     * - subAccountId valido (0-255)
     * - collateralVault e borrowVault non zero
     * - initialCollateral > 0
     */
    function createPosition(
        uint8 subAccountId,
        address collateralVault,
        address borrowVault,
        uint256 initialCollateral,
        uint256 borrowedAmount
    ) external onlyOwner returns (uint256 positionId) {
        if (collateralVault == address(0) || borrowVault == address(0)) {
            revert InvalidVault();
        }
        if (initialCollateral == 0) {
            revert InvalidVault(); // Riusa error per semplicità
        }
        
        positionId = nextPositionId++;
        
        _positions[positionId] = LeveragePositionStorage({
            subAccountId: subAccountId,
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            initialCollateral: initialCollateral,
            borrowedAmount: borrowedAmount,
            isActive: true,
            createdAt: block.timestamp
        });
        
        // Aggiungi all'array delle posizioni attive
        _activePositionIndex[positionId] = _activePositionIds.length;
        _activePositionIds.push(positionId);
        _isInActiveArray[positionId] = true;
        
        emit PositionCreated(positionId, subAccountId, collateralVault, borrowVault);
    }
    
    /**
     * @notice Aggiorna l'importo borrowed di una posizione
     * @dev Solo owner (Plugin) può chiamare
     * @param positionId ID della posizione
     * @param newBorrowedAmount Nuovo importo borrowed
     * 
     * Requirements:
     * - positionId deve esistere e essere attiva
     */
    function updatePosition(
        uint256 positionId,
        uint256 newBorrowedAmount
    ) external onlyOwner {
        LeveragePositionStorage storage pos = _positions[positionId];
        
        if (pos.createdAt == 0) revert PositionNotFound(positionId);
        if (!pos.isActive) revert PositionNotActive(positionId);
        
        pos.borrowedAmount = newBorrowedAmount;
        
        emit PositionUpdated(positionId, newBorrowedAmount);
    }
    
    /**
     * @notice Chiude una posizione (marca come inattiva)
     * @dev Solo owner (Plugin) può chiamare
     * @param positionId ID della posizione da chiudere
     * 
     * Requirements:
     * - positionId deve esistere
     * - posizione deve essere attiva
     */
    function closePositionRecord(uint256 positionId) external onlyOwner {
        LeveragePositionStorage storage pos = _positions[positionId];
        
        if (pos.createdAt == 0) revert PositionNotFound(positionId);
        if (!pos.isActive) revert PositionAlreadyClosed(positionId);
        
        pos.isActive = false;
        
        // Rimuovi dall'array attivo (swap and pop)
        if (_isInActiveArray[positionId]) {
            uint256 indexToRemove = _activePositionIndex[positionId];
            uint256 lastIndex = _activePositionIds.length - 1;
            
            if (indexToRemove != lastIndex) {
                uint256 lastPositionId = _activePositionIds[lastIndex];
                _activePositionIds[indexToRemove] = lastPositionId;
                _activePositionIndex[lastPositionId] = indexToRemove;
            }
            
            _activePositionIds.pop();
            delete _activePositionIndex[positionId];
            delete _isInActiveArray[positionId];
        }
        
        emit PositionClosed(positionId);
    }
    
    // ========== ADMIN FUNCTIONS - VAULT REGISTRY ==========
    
    /**
     * @notice Registra o aggiorna un vault per un token
     * @dev Solo owner può chiamare
     * @param tokenCode Codice del token (es. "WETH", "USDC")
     * @param vault Indirizzo del vault Euler V2
     * 
     * Requirements:
     * - tokenCode non può essere vuoto
     * - vault non può essere address(0)
     * - vault non deve essere già registrato per un altro token
     * 
     * Example:
     * ```
     * registry.setVault("WETH", 0x1234...);
     * registry.setVault("USDC", 0x5678...);
     * ```
     */
    function setVault(string memory tokenCode, address vault) external onlyOwner {
        if (bytes(tokenCode).length == 0) revert TokenCodeEmpty();
        if (vault == address(0)) revert InvalidVaultAddress();
        
        // Verifica che il vault non sia già registrato per un altro token
        string memory existingTokenCode = _tokenCodes[vault];
        if (bytes(existingTokenCode).length > 0 && 
            keccak256(bytes(existingTokenCode)) != keccak256(bytes(tokenCode))) {
            revert VaultAlreadyRegistered(vault, existingTokenCode);
        }
        
        bool isNew = !_isRegistered[tokenCode];
        
        // Se stiamo aggiornando, rimuovi il vecchio reverse lookup
        address oldVault = _vaults[tokenCode];
        if (oldVault != address(0)) {
            delete _tokenCodes[oldVault];
        }
        
        // Imposta il nuovo vault
        _vaults[tokenCode] = vault;
        _tokenCodes[vault] = tokenCode;
        
        // Se nuovo, aggiungi all'array
        if (isNew) {
            _tokenIndex[tokenCode] = _registeredTokens.length;
            _registeredTokens.push(tokenCode);
            _isRegistered[tokenCode] = true;
        }
        
        emit VaultSet(tokenCode, vault, isNew);
    }
    
    /**
     * @notice Registra multipli vault in una singola transazione
     * @param tokenCodes Array di codici token
     * @param vaults Array di indirizzi vault (stesso ordine)
     */
    function setVaultsBatch(
        string[] memory tokenCodes, 
        address[] memory vaults
    ) external onlyOwner {
        require(tokenCodes.length == vaults.length, "Array length mismatch");
        
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            // Inline version per gas efficiency
            string memory tokenCode = tokenCodes[i];
            address vault = vaults[i];
            
            if (bytes(tokenCode).length == 0) revert TokenCodeEmpty();
            if (vault == address(0)) revert InvalidVaultAddress();
            
            string memory existingTokenCode = _tokenCodes[vault];
            if (bytes(existingTokenCode).length > 0 && 
                keccak256(bytes(existingTokenCode)) != keccak256(bytes(tokenCode))) {
                revert VaultAlreadyRegistered(vault, existingTokenCode);
            }
            
            bool isNew = !_isRegistered[tokenCode];
            
            address oldVault = _vaults[tokenCode];
            if (oldVault != address(0)) {
                delete _tokenCodes[oldVault];
            }
            
            _vaults[tokenCode] = vault;
            _tokenCodes[vault] = tokenCode;
            
            if (isNew) {
                _tokenIndex[tokenCode] = _registeredTokens.length;
                _registeredTokens.push(tokenCode);
                _isRegistered[tokenCode] = true;
            }
            
            emit VaultSet(tokenCode, vault, isNew);
        }
    }
    
    /**
     * @notice Rimuove un vault dal registry
     * @param tokenCode Codice del token da rimuovere
     * 
     * Requirements:
     * - tokenCode deve essere registrato
     */
    function removeVault(string memory tokenCode) external onlyOwner {
        if (!_isRegistered[tokenCode]) revert VaultNotFound(tokenCode);
        
        address vault = _vaults[tokenCode];
        
        // Rimuovi dai mapping
        delete _vaults[tokenCode];
        delete _tokenCodes[vault];
        delete _isRegistered[tokenCode];
        
        // Rimuovi dall'array (swap and pop)
        uint256 indexToRemove = _tokenIndex[tokenCode];
        uint256 lastIndex = _registeredTokens.length - 1;
        
        if (indexToRemove != lastIndex) {
            string memory lastTokenCode = _registeredTokens[lastIndex];
            _registeredTokens[indexToRemove] = lastTokenCode;
            _tokenIndex[lastTokenCode] = indexToRemove;
        }
        
        _registeredTokens.pop();
        delete _tokenIndex[tokenCode];
        
        emit VaultRemoved(tokenCode, vault);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Ottiene l'indirizzo vault per un token
     * @param tokenCode Codice del token (es. "WETH")
     * @return vault Indirizzo del vault Euler
     */
    function getVault(string memory tokenCode) external view returns (address vault) {
        vault = _vaults[tokenCode];
        if (vault == address(0)) revert VaultNotFound(tokenCode);
    }
    
    /**
     * @notice Ottiene l'indirizzo vault senza revert (ritorna address(0) se non trovato)
     * @param tokenCode Codice del token
     * @return vault Indirizzo del vault o address(0)
     */
    function getVaultSafe(string memory tokenCode) external view returns (address vault) {
        return _vaults[tokenCode];
    }
    
    /**
     * @notice Ottiene il tokenCode per un vault
     * @param vault Indirizzo del vault
     * @return tokenCode Codice del token
     */
    function getTokenCode(address vault) external view returns (string memory tokenCode) {
        tokenCode = _tokenCodes[vault];
        if (bytes(tokenCode).length == 0) revert VaultNotFound("unknown");
    }
    
    /**
     * @notice Verifica se un token è registrato
     * @param tokenCode Codice del token
     * @return True se registrato
     */
    function isRegistered(string memory tokenCode) external view returns (bool) {
        return _isRegistered[tokenCode];
    }
    
    /**
     * @notice Ottiene tutti i token registrati
     * @return Array di tokenCode
     */
    function getAllRegisteredTokens() external view returns (string[] memory) {
        return _registeredTokens;
    }
    
    /**
     * @notice Ottiene il numero di token registrati
     * @return Numero di vault registrati
     */
    function getRegisteredCount() external view returns (uint256) {
        return _registeredTokens.length;
    }
    
    /**
     * @notice Ottiene tutti i vault e i loro token codes
     * @return tokenCodes Array di codici token
     * @return vaults Array di indirizzi vault (stesso ordine)
     */
    function getAllVaults() 
        external 
        view 
        returns (string[] memory tokenCodes, address[] memory vaults) 
    {
        uint256 length = _registeredTokens.length;
        tokenCodes = new string[](length);
        vaults = new address[](length);
        
        for (uint256 i = 0; i < length; i++) {
            tokenCodes[i] = _registeredTokens[i];
            vaults[i] = _vaults[_registeredTokens[i]];
        }
    }
    
    // ========== POSITION MANAGER - VIEW FUNCTIONS ==========
    
    /**
     * @notice Ottiene i dettagli di una posizione leverage
     * @param positionId ID della posizione
     * @return pos Struct della posizione
     * 
     * Requirements:
     * - positionId deve esistere
     */
    function getPosition(uint256 positionId) 
        external 
        view 
        returns (LeveragePositionStorage memory pos) 
    {
        pos = _positions[positionId];
        if (pos.createdAt == 0) revert PositionNotFound(positionId);
    }
    
    /**
     * @notice Ottiene i dettagli di una posizione senza revert
     * @param positionId ID della posizione
     * @return pos Struct della posizione (zero struct se non esiste)
     */
    function getPositionSafe(uint256 positionId) 
        external 
        view 
        returns (LeveragePositionStorage memory pos) 
    {
        return _positions[positionId];
    }
    
    /**
     * @notice Ottiene tutte le posizioni create (attive e inattive)
     * @return positions Array di tutte le posizioni
     * 
     * Note: Include anche posizioni chiuse (isActive=false)
     */
    function getAllPositions() 
        external 
        view 
        returns (LeveragePositionStorage[] memory positions) 
    {
        positions = new LeveragePositionStorage[](nextPositionId);
        
        for (uint256 i = 0; i < nextPositionId; i++) {
            positions[i] = _positions[i];
        }
    }
    
    /**
     * @notice Ottiene solo le posizioni attive
     * @return activePositions Array delle posizioni attive
     * @return positionIds Array degli ID corrispondenti
     * 
     * Note: Usa l'array _activePositionIds per efficienza
     */
    function getActivePositions() 
        external 
        view 
        returns (
            LeveragePositionStorage[] memory activePositions,
            uint256[] memory positionIds
        ) 
    {
        uint256 length = _activePositionIds.length;
        activePositions = new LeveragePositionStorage[](length);
        positionIds = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            uint256 posId = _activePositionIds[i];
            positionIds[i] = posId;
            activePositions[i] = _positions[posId];
        }
    }
    
    /**
     * @notice Ottiene il numero di posizioni attive
     * @return Numero di posizioni con isActive=true
     */
    function getActivePositionCount() external view returns (uint256) {
        return _activePositionIds.length;
    }
    
    /**
     * @notice Verifica se una posizione esiste ed è attiva
     * @param positionId ID della posizione
     * @return True se esiste ed è attiva
     */
    function isPositionActive(uint256 positionId) external view returns (bool) {
        LeveragePositionStorage storage pos = _positions[positionId];
        return pos.createdAt != 0 && pos.isActive;
    }
    
    /**
     * @notice Ottiene tutti gli ID delle posizioni attive
     * @return Array di position IDs attivi
     */
    function getActivePositionIds() external view returns (uint256[] memory) {
        return _activePositionIds;
    }
}
