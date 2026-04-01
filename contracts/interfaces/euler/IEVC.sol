// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IEVC
 * @notice Interfaccia minima per Ethereum Vault Connector (EVC)
 * @dev L'EVC è l'hub centrale di Euler V2 che gestisce:
 *      - Batching di operazioni atomiche
 *      - Sub-accounts (256 per wallet)
 *      - Collateral/Controller management
 *      - Operator delegation
 * 
 * Fonte: https://github.com/euler-xyz/ethereum-vault-connector
 * 
 * Indirizzo Arbitrum: 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066
 * 
 * Sub-accounts:
 * - Ogni wallet può avere 256 sub-accounts (0-255)
 * - Derivazione: address(owner) XOR uint160(subAccountId)
 * - Sub-account 0 = indirizzo originale
 * - Permette isolamento posizioni
 */
interface IEVC {
    
    // ========== STRUCTS ==========
    
    /**
     * @notice Elemento di un batch di operazioni
     * @param targetContract Contratto da chiamare
     * @param onBehalfOfAccount Account per conto del quale eseguire (address(0) per nessuno)
     * @param value ETH da inviare con la chiamata
     * @param data Calldata della funzione
     */
    struct BatchItem {
        address targetContract;
        address onBehalfOfAccount;
        uint256 value;
        bytes data;
    }
    
    /**
     * @notice Risultato di una chiamata batch
     * @param success True se la chiamata è riuscita
     * @param result Return data della chiamata
     */
    struct BatchItemResult {
        bool success;
        bytes result;
    }
    
    // ========== BATCH OPERATIONS ==========
    
    /**
     * @notice Esegue un batch di operazioni atomicamente
     * @dev Se una operazione fallisce, tutto il batch viene revertato
     *      Le operazioni vengono eseguite in ordine
     *      I checks sullo stato degli account sono differiti alla fine
     * 
     * @param items Array di operazioni da eseguire
     * 
     * Example:
     * ```
     * IEVC.BatchItem[] memory items = new IEVC.BatchItem[](2);
     * items[0] = IEVC.BatchItem({
     *     targetContract: vault,
     *     onBehalfOfAccount: myAccount,
     *     value: 0,
     *     data: abi.encodeCall(IEVault.deposit, (1 ether, myAccount))
     * });
     * items[1] = IEVC.BatchItem({
     *     targetContract: vault,
     *     onBehalfOfAccount: myAccount,
     *     value: 0,
     *     data: abi.encodeCall(IEVault.borrow, (1000e6, myAccount))
     * });
     * evc.batch(items);
     * ```
     */
    function batch(BatchItem[] calldata items) external payable;
    
    /**
     * @notice Esegue batch e ritorna i risultati
     * @param items Array di operazioni
     * @return results Array di risultati per ogni operazione
     */
    function batchRevert(BatchItem[] calldata items) 
        external 
        payable 
        returns (BatchItemResult[] memory results);
    
    /**
     * @notice Simula un batch senza eseguirlo (per preview)
     * @param items Array di operazioni
     * @return results Array di risultati simulati
     */
    function batchSimulation(BatchItem[] calldata items)
        external
        payable
        returns (BatchItemResult[] memory results);
    
    /**
     * @notice Esegue una chiamata a un contratto target per conto di un account
     * @dev Usato per eseguire operazioni su vault per conto di un sub-account
     * @param targetContract Contratto da chiamare
     * @param onBehalfOfAccount Account per conto del quale eseguire
     * @param value ETH da inviare
     * @param data Calldata della funzione
     * @return result Return data della chiamata
     */
    function call(
        address targetContract,
        address onBehalfOfAccount,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory result);
    
    // ========== COLLATERAL/CONTROLLER MANAGEMENT ==========
    
    /**
     * @notice Abilita un vault come collaterale per un account
     * @dev Il vault potrà essere usato come collaterale per borrowing
     * @param account Account per cui abilitare
     * @param vault Vault da abilitare come collaterale
     */
    function enableCollateral(address account, address vault) external payable;
    
    /**
     * @notice Disabilita un vault come collaterale
     * @param account Account per cui disabilitare
     * @param vault Vault da disabilitare
     */
    function disableCollateral(address account, address vault) external payable;
    
    /**
     * @notice Abilita un vault come controller per un account
     * @dev Il controller vault può liquidare l'account e controllarne lo stato
     * @param account Account da controllare
     * @param vault Vault controller
     */
    function enableController(address account, address vault) external payable;
    
    /**
     * @notice Disabilita msg.sender come controller per un account
     * @dev Solo il controller stesso (msg.sender) può disabilitarsi.
     *      Per disabilitare un controller, chiamare la funzione disableController()
     *      direttamente sul vault (che internamente chiama evc.disableController(account))
     *      oppure usare evc.batch con target=vault e data=IEVault.disableController.selector
     * @param account Account da cui rimuovere il controller
     */
    function disableController(address account) external payable;
    
    /**
     * @notice Ottiene i collateral abilitati per un account
     * @param account Indirizzo account
     * @return Array di vault abilitati come collaterale
     */
    function getCollaterals(address account) external view returns (address[] memory);
    
    /**
     * @notice Ottiene i controller per un account
     * @param account Indirizzo account
     * @return Array di vault controller
     */
    function getControllers(address account) external view returns (address[] memory);
    
    /**
     * @notice Verifica se un vault è collaterale per un account
     * @param account Account
     * @param vault Vault da verificare
     * @return True se è collaterale abilitato
     */
    function isCollateralEnabled(address account, address vault) external view returns (bool);
    
    /**
     * @notice Verifica se un vault è controller per un account
     * @param account Account
     * @param vault Vault da verificare
     * @return True se è controller abilitato
     */
    function isControllerEnabled(address account, address vault) external view returns (bool);
    
    // ========== SUB-ACCOUNT UTILITIES ==========
    
    /**
     * @notice Deriva l'indirizzo di un sub-account
     * @param owner Indirizzo owner
     * @param subAccountId ID del sub-account (0-255)
     * @return Indirizzo del sub-account
     */
    function getSubAccount(address owner, uint8 subAccountId) external pure returns (address);
    
    /**
     * @notice Ottiene il prefix dell'indirizzo (primi 19 bytes)
     * @dev Tutti i sub-accounts dello stesso owner condividono lo stesso prefix
     * @param account Indirizzo account
     * @return Prefix di 19 bytes
     */
    function getAddressPrefix(address account) external pure returns (bytes19);
    
    /**
     * @notice Verifica se due indirizzi appartengono allo stesso owner
     * @param account1 Primo account
     * @param account2 Secondo account
     * @return True se hanno lo stesso owner
     */
    function haveSameOwner(address account1, address account2) external pure returns (bool);
    
    // ========== OPERATOR MANAGEMENT ==========
    
    /**
     * @notice Imposta un operatore per un account
     * @dev L'operatore può eseguire operazioni per conto dell'account
     * @param operator Indirizzo operatore
     * @param authorized True per autorizzare, false per revocare
     */
    function setOperator(address operator, bool authorized) external;
    
    /**
     * @notice Verifica se un operatore è autorizzato
     * @param account Account
     * @param operator Operatore da verificare
     * @return True se autorizzato
     */
    function isOperator(address account, address operator) external view returns (bool);
    
    // ========== ACCOUNT STATUS ==========
    
    /**
     * @notice Verifica lo stato di un account (se è in violazione)
     * @param account Account da verificare
     * @return True se l'account è sano
     */
    function checkAccountStatus(address account) external view returns (bool);
    
    /**
     * @notice Forza un check dello stato account
     * @dev Usato dai controller per verificare che l'account sia sano dopo operazioni
     * @param account Account da verificare
     */
    function requireAccountStatusCheck(address account) external;
    
    // ========== LIQUIDATION ==========
    
    /**
     * @notice Permette a un controller di controllare il collaterale di un account
     * @dev Usato per liquidazioni
     * @param targetCollateral Vault collaterale target
     * @param onBehalfOfAccount Account da liquidare
     * @param data Calldata per l'operazione
     * @return result Risultato dell'operazione
     */
    function controlCollateral(
        address targetCollateral,
        address onBehalfOfAccount,
        bytes calldata data
    ) external payable returns (bytes memory result);
}
