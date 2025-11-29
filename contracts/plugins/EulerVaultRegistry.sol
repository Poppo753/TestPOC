// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EulerVaultRegistry
 * @notice Registry dinamico per mappare token codes ai vault Euler V2
 * @dev Registrato nel Beacon come "EulerVaultRegistry"
 *      Permette di aggiungere/rimuovere vault senza rideploy del plugin
 * 
 * Architettura:
 * - Mappa tokenCode (es. "WETH") → vault address Euler
 * - Reverse lookup: vault address → tokenCode
 * - Usato da EulerV2Plugin e EulerLensAdapter
 * 
 * Indirizzi Euler V2 Arbitrum (da configurare post-deploy):
 * - EVC: 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066
 * - Vault Factory: 0x78Df1CF5bf06a7f27f2ACc580B934238C1b80D50
 * 
 * @author Project4 Team
 */
contract EulerVaultRegistry is Ownable {
    
    // ========== STATE ==========
    
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
    
    // ========== EVENTS ==========
    
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
    
    // ========== ERRORS ==========
    
    error VaultNotFound(string tokenCode);
    error InvalidVaultAddress();
    error TokenCodeEmpty();
    error VaultAlreadyRegistered(address vault, string existingTokenCode);
    
    // ========== CONSTRUCTOR ==========
    
    constructor() Ownable() {}
    
    // ========== ADMIN FUNCTIONS ==========
    
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
}
