// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IProtocolManager.sol";
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/IProxyGeneral.sol";

/**
 * @title ProtocolManager
 * @notice Manager unificato per protocolli non-swap (lending, yield, trading)
 * @dev Gestisce operazioni comuni (deposit, withdraw, borrow, repay) e protocol-specific via executeProtocolCall
 * 
 * Architettura:
 * - Layer 1: IProtocolManager (base - deposit, withdraw, getBalance, getTotalValue)
 * - Layer 2: ILendingProtocol / IYieldProtocol (estendono base)
 * - Plugin implementano interfacce e gestiscono logica protocol-specific
 * 
 * Custody Flow:
 * ProxyGeneral (custody) → ProtocolManager (orchestration) → Plugin → External Protocol
 * 
 * Security:
 * - onlyOwner: solo owner può eseguire operazioni (futuro multi-sig Gnosis Safe)
 * - Whitelist dinamica: function selectors allowed per protocollo (configurabile runtime)
 * - Event logging: audit trail completo di tutte le operazioni
 * - No timelock: operazioni immediate per trading (incompatibile con timelock 24h)
 * 
 * Usage Examples:
 * ```solidity
 * // 1. Deposit in Dolomite
 * protocolManager.deposit("DolomitePlugin", "WETH", 1 ether);
 * 
 * // 2. Borrow USDC from Dolomite
 * protocolManager.borrow("DolomitePlugin", "USDC", 1000e6);
 * 
 * // 3. Configurare whitelist per openBorrowPosition
 * bytes4[] memory selectors = new bytes4[](1);
 * selectors[0] = bytes4(keccak256("openBorrowPosition(uint256,uint256)"));
 * protocolManager.setAllowedSelectors("DolomitePlugin", selectors, true);
 * 
 * // 4. Chiamare funzione Dolomite-specific
 * bytes memory data = abi.encodeWithSignature("openBorrowPosition(uint256,uint256)", 1000e18, 0);
 * protocolManager.executeProtocolCall("DolomitePlugin", data);
 * ```
 * 
 * @author Project4 Team
 * @custom:security-contact security@project4.com
 * @custom:version 1.0.0
 */
contract ProtocolManager is Ownable {
    using SafeERC20 for IERC20;
    
    // ==================== STORAGE ====================
    
    /// @notice Beacon address per resolution moduli
    address public immutable beacon;
    
    /// @notice Whitelist function selectors per protocollo
    /// @dev mapping(pluginAddress => mapping(functionSelector => allowed))
    /// @dev Configurabile runtime via setAllowedSelectors()
    mapping(address => mapping(bytes4 => bool)) public allowedSelectors;
    
    // ==================== EVENTS ====================
    
    /**
     * @notice Emesso quando viene eseguita un'operazione comune (deposit, withdraw)
     * @param protocolName Nome del protocollo (es. "DolomitePlugin")
     * @param operation Tipo di operazione (es. "deposit", "withdraw")
     * @param tokenCode Codice del token (es. "WETH", "USDC")
     * @param amount Importo dell'operazione
     */
    event ProtocolOperationExecuted(
        string protocolName,
        string operation,
        string tokenCode,
        uint256 amount
    );
    
    /**
     * @notice Emesso quando viene eseguita un'operazione lending (borrow, repay)
     * @param protocolName Nome del protocollo
     * @param operation Tipo di operazione (es. "borrow", "repay")
     * @param tokenCode Codice del token
     * @param amount Importo dell'operazione
     */
    event LendingOperationExecuted(
        string protocolName,
        string operation,
        string tokenCode,
        uint256 amount
    );
    
    /**
     * @notice Emesso quando viene eseguita una chiamata protocol-specific
     * @param protocolName Nome del protocollo
     * @param selector Function selector chiamato
     * @param data Calldata completo
     */
    event ProtocolSpecificCallExecuted(
        string protocolName,
        bytes4 selector,
        bytes data
    );
    
    /**
     * @notice Emesso quando viene modificata la whitelist selectors
     * @param pluginAddress Indirizzo del plugin
     * @param selector Function selector
     * @param allowed True se allowed, false se revoked
     */
    event SelectorAllowanceChanged(
        address indexed pluginAddress,
        bytes4 selector,
        bool allowed
    );
    
    // ==================== ERRORS ====================
    
    error ProtocolNotFound(string protocolName);
    error InvalidProtocol(address pluginAddress);
    error SelectorNotAllowed(address pluginAddress, bytes4 selector);
    error OperationFailed(string operation, string reason);
    error InvalidAmount(uint256 amount);
    error InvalidTokenCode(string tokenCode);
    
    // ==================== CONSTRUCTOR ====================
    
    /**
     * @notice Costruttore
     * @param _beacon Indirizzo del Beacon per resolution moduli
     */
    constructor(address _beacon) Ownable() {
        require(_beacon != address(0), "Invalid beacon address");
        beacon = _beacon;
    }
    
    // ==================== COMMON OPERATIONS ====================
    
    /**
     * @notice Deposita token in un protocollo
     * @dev Flow: ProxyGeneral → Plugin → External Protocol
     * @param protocolName Nome del protocollo (es. "DolomitePlugin")
     * @param tokenCode Codice del token (es. "WETH", "USDC")
     * @param amount Importo da depositare (in wei)
     */
    function deposit(
        string memory protocolName,
        string memory tokenCode,
        uint256 amount
    ) external onlyOwner {
        if (amount == 0) revert InvalidAmount(amount);
        if (bytes(tokenCode).length == 0) revert InvalidTokenCode(tokenCode);
        
        // 1. Resolve plugin via Beacon
        address plugin = _resolvePlugin(protocolName);
        _validateProtocol(plugin);
        
        // 2. Withdraw from ProxyGeneral to plugin
        address proxyGeneral = _getProxyGeneral();
        IProxyGeneral(proxyGeneral).withdrawToken(tokenCode, amount, plugin);
        
        // 3. Delegate to plugin.deposit()
        bool success = IProtocolManager(plugin).deposit(tokenCode, amount);
        if (!success) revert OperationFailed("deposit", "Plugin deposit failed");
        
        // 4. Emit event
        emit ProtocolOperationExecuted(protocolName, "deposit", tokenCode, amount);
    }
    
    /**
     * @notice Preleva token da un protocollo
     * @dev Flow: External Protocol → Plugin → ProxyGeneral
     * @param protocolName Nome del protocollo
     * @param tokenCode Codice del token
     * @param amount Importo da prelevare (in wei)
     */
    function withdraw(
        string memory protocolName,
        string memory tokenCode,
        uint256 amount
    ) external onlyOwner {
        if (amount == 0) revert InvalidAmount(amount);
        if (bytes(tokenCode).length == 0) revert InvalidTokenCode(tokenCode);
        
        // 1. Resolve plugin
        address plugin = _resolvePlugin(protocolName);
        _validateProtocol(plugin);
        
        // 2. Delegate to plugin.withdraw() (plugin returns to ProxyGeneral)
        bool success = IProtocolManager(plugin).withdraw(tokenCode, amount);
        if (!success) revert OperationFailed("withdraw", "Plugin withdraw failed");
        
        // 3. Emit event
        emit ProtocolOperationExecuted(protocolName, "withdraw", tokenCode, amount);
    }
    
    /**
     * @notice Ottiene il balance di un token nel protocollo
     * @param protocolName Nome del protocollo
     * @param tokenCode Codice del token
     * @return balance Balance del token (in wei)
     */
    function getBalance(
        string memory protocolName,
        string memory tokenCode
    ) external view returns (uint256 balance) {
        address plugin = _resolvePlugin(protocolName);
        return IProtocolManager(plugin).getBalance(tokenCode);
    }
    
    /**
     * @notice Ottiene il valore totale di tutti i depositi nel protocollo
     * @param protocolName Nome del protocollo
     * @return totalValueETH Valore totale in ETH (in wei)
     */
    function getTotalValue(
        string memory protocolName
    ) external view returns (uint256 totalValueETH) {
        address plugin = _resolvePlugin(protocolName);
        return IProtocolManager(plugin).getTotalValue();
    }

    
    // ==================== LENDING OPERATIONS ====================
    
    /**
     * @notice Prende in prestito token da un protocollo lending
     * @dev Flow: External Protocol → Plugin → ProxyGeneral (borrowed tokens)
     * @param protocolName Nome del protocollo (es. "DolomitePlugin")
     * @param tokenCode Codice del token da prendere in prestito (es. "USDC")
     * @param amount Importo da prendere in prestito (in wei)
     */
    function borrow(
        string memory protocolName,
        string memory tokenCode,
        uint256 amount
    ) external onlyOwner {
        if (amount == 0) revert InvalidAmount(amount);
        if (bytes(tokenCode).length == 0) revert InvalidTokenCode(tokenCode);
        
        // 1. Resolve plugin
        address plugin = _resolvePlugin(protocolName);
        _validateProtocol(plugin);
        
        // 2. Delegate to plugin.borrow() (plugin transfers borrowed tokens to ProxyGeneral)
        bool success = ILendingProtocol(plugin).borrow(tokenCode, amount);
        if (!success) revert OperationFailed("borrow", "Plugin borrow failed");
        
        // 3. Emit event
        emit LendingOperationExecuted(protocolName, "borrow", tokenCode, amount);
    }
    
    /**
     * @notice Ripaga un debito in un protocollo lending
     * @dev Flow: ProxyGeneral → Plugin → External Protocol (repayment tokens)
     * @param protocolName Nome del protocollo
     * @param tokenCode Codice del token da ripagare (es. "USDC")
     * @param amount Importo da ripagare (in wei)
     */
    function repay(
        string memory protocolName,
        string memory tokenCode,
        uint256 amount
    ) external onlyOwner {
        if (amount == 0) revert InvalidAmount(amount);
        if (bytes(tokenCode).length == 0) revert InvalidTokenCode(tokenCode);
        
        // 1. Resolve plugin
        address plugin = _resolvePlugin(protocolName);
        _validateProtocol(plugin);
        
        // 2. Withdraw repayment tokens from ProxyGeneral to plugin
        address proxyGeneral = _getProxyGeneral();
        IProxyGeneral(proxyGeneral).withdrawToken(tokenCode, amount, plugin);
        
        // 3. Delegate to plugin.repay()
        bool success = ILendingProtocol(plugin).repay(tokenCode, amount);
        if (!success) revert OperationFailed("repay", "Plugin repay failed");
        
        // 4. Emit event
        emit LendingOperationExecuted(protocolName, "repay", tokenCode, amount);
    }
    
    /**
     * @notice Ottiene il debito corrente per un token
     * @param protocolName Nome del protocollo
     * @param tokenCode Codice del token
     * @return debtAmount Importo del debito (in wei)
     */
    function getDebt(
        string memory protocolName,
        string memory tokenCode
    ) external view returns (uint256 debtAmount) {
        address plugin = _resolvePlugin(protocolName);
        return ILendingProtocol(plugin).getDebt(tokenCode);
    }
    
    /**
     * @notice Ottiene il health factor della posizione
     * @param protocolName Nome del protocollo
     * @return healthFactor Health factor in 18 decimali (1.0 = 1e18)
     */
    function getHealthFactor(
        string memory protocolName
    ) external view returns (uint256 healthFactor) {
        address plugin = _resolvePlugin(protocolName);
        return ILendingProtocol(plugin).getHealthFactor();
    }

    
    // ==================== GENERIC OPERATIONS ====================
    
    /**
     * @notice Configura la whitelist dinamica per i selector di un plugin
     * @dev Permette/nega l'esecuzione di funzioni specifiche via executeProtocolCall
     * @param protocolName Nome del protocolio (es. "DolomitePlugin")
     * @param selectors Array di selettori (es. [bytes4(keccak256("openBorrowPosition(uint256,uint256)"))])
     * @param allowed true = permetti, false = nega
     */
    function setAllowedSelectors(
        string memory protocolName,
        bytes4[] memory selectors,
        bool allowed
    ) external onlyOwner {
        // 1. Resolve plugin
        address plugin = _resolvePlugin(protocolName);
        _validateProtocol(plugin);
        
        // 2. Update whitelist for each selector
        for (uint256 i = 0; i < selectors.length; i++) {
            allowedSelectors[plugin][selectors[i]] = allowed;
            emit SelectorAllowanceChanged(plugin, selectors[i], allowed);
        }
    }
    
    /**
     * @notice Esegue una chiamata protocol-specific validata dalla whitelist
     * @dev Solo funzioni whitelistate possono essere eseguite
     * @param protocolName Nome del protocollo
     * @param data Calldata encodata (include selector + parametri)
     * @return success true se la chiamata è riuscita
     * @return returnData Dati ritornati dalla chiamata
     */
    function executeProtocolCall(
        string memory protocolName,
        bytes memory data
    ) external onlyOwner returns (bool success, bytes memory returnData) {
        if (data.length < 4) revert OperationFailed("executeProtocolCall", "Invalid calldata");
        
        // 1. Resolve plugin
        address plugin = _resolvePlugin(protocolName);
        _validateProtocol(plugin);
        
        // 2. Extract selector from calldata
        bytes4 selector;
        assembly {
            selector := mload(add(data, 32))
        }
        
        // 3. Validate selector is whitelisted
        if (!allowedSelectors[plugin][selector]) {
            revert SelectorNotAllowed(plugin, selector);
        }
        
        // 4. Execute low-level call
        (success, returnData) = plugin.call(data);
        if (!success) {
            revert OperationFailed("executeProtocolCall", "Low-level call failed");
        }
        
        // 5. Emit event
        emit ProtocolSpecificCallExecuted(protocolName, selector, data);
    }

    
    // ==================== EMERGENCY ====================
    
    /**
     * @notice Ritira tutti i fondi da un protocollo in emergenza
     * @dev Chiama emergencyWithdrawAll sul plugin, che ritorna tutti i token a ProxyGeneral
     * @param protocolName Nome del protocollo
     * @param tokenCodes Array di codici token da ritirare (es. ["WETH", "USDC"])
     * @return success true se il ritiro è riuscito
     */
    function emergencyWithdrawAll(
        string memory protocolName,
        string[] memory tokenCodes
    ) external onlyOwner returns (bool success) {
        // 1. Resolve plugin
        address plugin = _resolvePlugin(protocolName);
        _validateProtocol(plugin);
        
        // 2. Delegate to plugin.emergencyWithdrawAll()
        success = IProtocolManager(plugin).emergencyWithdrawAll(tokenCodes);
        if (!success) revert OperationFailed("emergencyWithdrawAll", "Emergency withdrawal failed");
        
        // 3. Emit event
        emit ProtocolOperationExecuted(protocolName, "emergencyWithdrawAll", "", 0);
    }

    
    // ==================== INTERNAL HELPERS ====================
    
    /**
     * @notice Risolve l'indirizzo del plugin dal nome tramite Beacon
     * @param protocolName Nome del protocollo (es. "DolomitePlugin")
     * @return pluginAddress Indirizzo del plugin
     */
    function _resolvePlugin(string memory protocolName) internal view returns (address pluginAddress) {
        pluginAddress = IBeacon(beacon).getImplementation(protocolName);
        if (pluginAddress == address(0)) {
            revert ProtocolNotFound(protocolName);
        }
    }
    
    /**
     * @notice Valida che un indirizzo plugin sia valido (non zero)
     * @param pluginAddress Indirizzo da validare
     * @return valid True se valido
     */
    function _validateProtocol(address pluginAddress) internal pure returns (bool valid) {
        if (pluginAddress == address(0)) {
            revert InvalidProtocol(pluginAddress);
        }
        return true;
    }
    
    /**
     * @notice Ottiene l'indirizzo di ProxyGeneral tramite Beacon
     * @return proxyGeneralAddress Indirizzo di ProxyGeneral
     */
    function _getProxyGeneral() internal view returns (address proxyGeneralAddress) {
        proxyGeneralAddress = IBeacon(beacon).getImplementation("ProxyGeneral");
        require(proxyGeneralAddress != address(0), "ProxyGeneral not found");
    }
}
