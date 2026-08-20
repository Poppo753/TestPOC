// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/balancer/IBalancerVault.sol";
import "../interfaces/IFlashLoanCallback.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/ISimpleSwap.sol";
import "../interfaces/ITokenManagerForModules.sol";

/**
 * @title FlashLoanService
 * @notice Servizio centralizzato per flash loans Balancer V2 (0% fee!)
 * @dev Deployato UNA sola volta, riutilizzato da tutti i plugin.
 * 
 * ARCHITETTURA:
 * - Implementa IFlashLoanRecipient per callback Balancer
 * - Usa Beacon check per verificare che il caller sia un plugin registrato
 * - Double-layer security: Beacon check + Trust The Revert
 * 
 * SICUREZZA:
 * - Layer 1 (Beacon Check): Solo plugin registrati nel Beacon possono chiamare
 * - Layer 2 (Trust The Revert): Se il plugin non restituisce i token, tutto reverta
 * 
 * FLUSSO:
 * 1. Plugin chiama executeFlashLoan(tokens, amounts, callbackData)
 * 2. Service verifica plugin via Beacon
 * 3. Service richiede flash loan a Balancer
 * 4. Balancer chiama receiveFlashLoan()
 * 5. Service trasferisce token al plugin
 * 6. Service chiama plugin.onFlashLoanReceived()
 * 7. Plugin esegue logica e restituisce token al Service
 * 8. Service ripaga Balancer
 * 
 * INDIRIZZI ARBITRUM:
 * - Balancer Vault: 0xBA12222222228d8Ba445958a75a0704d566BF2C8 (0% fee!)
 * - SimpleSwap: 0xa0DB78167CBAccD47524a261b7741C6B41Bbd096
 * 
 * @author Project4 Team
 * @custom:version 1.0.0
 */
contract FlashLoanService is IFlashLoanRecipient, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ==================== CONSTANTS ====================
    
    /// @notice Balancer V2 Vault (same on all chains, 0% fee!)
    address public constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    
    /// @notice SimpleSwap router (Uniswap V3 wrapper) su Arbitrum
    address public constant SIMPLE_SWAP = 0xa0DB78167CBAccD47524a261b7741C6B41Bbd096;
    
    // ==================== IMMUTABLES ====================
    
    /// @notice Beacon per verifica plugin autorizzati
    IBeacon public immutable beacon;
    
    // ==================== STATE ====================
    
    /// @notice Flag anti-reentrancy per callback flash loan
    bool private _inFlashLoan;
    
    /// @notice Flag anti-reentrancy per swap standalone (fuori da flash loan)
    bool private _swapping;
    
    /// @notice Contesto temporaneo durante flash loan
    FlashLoanContext private _context;
    
    // ==================== STRUCTS ====================
    
    /// @notice Contesto salvato durante flash loan
    struct FlashLoanContext {
        address caller;         // Plugin che ha richiesto il flash loan
        bytes callbackData;     // Dati da passare al callback
    }
    
    // ==================== ERRORS ====================
    
    error NotRegisteredPlugin(address caller);
    error NotBalancerVault(address caller);
    error NotInFlashLoan();
    error ReentrantCall();
    error InsufficientRepayment(address token, uint256 required, uint256 available);
    error InvalidAddress();
    error SwapFailed(address tokenIn, address tokenOut, uint256 amountIn);
    
    // ==================== EVENTS ====================
    
    event FlashLoanExecuted(
        address indexed caller,
        address indexed token,
        uint256 amount,
        uint256 fee
    );
    
    event SwapExecuted(
        address indexed caller,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    // ==================== CONSTRUCTOR ====================
    
    /**
     * @notice Costruttore del servizio
     * @param _beacon Indirizzo del Beacon per verifica plugin
     */
    constructor(address _beacon) {
        if (_beacon == address(0)) revert InvalidAddress();
        beacon = IBeacon(_beacon);
    }
    
    // ==================== MAIN FUNCTIONS ====================
    
    /**
     * @notice Esegue un flash loan per conto di un plugin registrato
     * @param tokens Array di token da prendere in prestito
     * @param amounts Array di importi da prendere in prestito
     * @param callbackData Dati da passare al plugin nel callback
     * 
     * @dev SICUREZZA:
     *      - Layer 1: Verifica che msg.sender sia un plugin registrato nel Beacon
     *      - Layer 2: Se il plugin non restituisce i token, Balancer reverta tutto
     */
    function executeFlashLoan(
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata callbackData
    ) external nonReentrant {
        // ═══════════════════════════════════════════════
        // LAYER 1: Beacon Check
        // ═══════════════════════════════════════════════
        if (!_isRegisteredPlugin(msg.sender)) {
            revert NotRegisteredPlugin(msg.sender);
        }
        
        // Prevent reentrant flash loans
        if (_inFlashLoan) revert ReentrantCall();
        
        // Store context for callback
        _context = FlashLoanContext({
            caller: msg.sender,
            callbackData: callbackData
        });
        
        // Set flash loan flag
        _inFlashLoan = true;
        
        // Convert to IERC20 array for Balancer
        IERC20[] memory ierc20Tokens = new IERC20[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            ierc20Tokens[i] = IERC20(tokens[i]);
        }
        
        // Request flash loan from Balancer
        IBalancerVault(BALANCER_VAULT).flashLoan(
            IFlashLoanRecipient(address(this)),
            ierc20Tokens,
            amounts,
            ""  // userData not needed, we use storage
        );
        
        // Clear state
        _inFlashLoan = false;
        delete _context;
    }
    
    /**
     * @notice Callback da Balancer Vault
     * @param tokens Array di token ricevuti
     * @param amounts Array di importi ricevuti
     * @param feeAmounts Array di fee (sempre 0!)
     * @param userData Non usato, usiamo storage
     * 
     * @dev SICUREZZA: Verifica che msg.sender sia Balancer Vault
     */
    function receiveFlashLoan(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external override {
        // Security: verify caller is Balancer Vault
        if (msg.sender != BALANCER_VAULT) revert NotBalancerVault(msg.sender);
        if (!_inFlashLoan) revert NotInFlashLoan();
        
        // Suppress unused variable warning
        (userData);
        
        FlashLoanContext memory ctx = _context;
        
        // Step 1: Transfer flash loan tokens to the plugin
        for (uint256 i = 0; i < tokens.length; i++) {
            tokens[i].safeTransfer(ctx.caller, amounts[i]);
        }
        
        // Step 2: Call plugin callback
        // Plugin must execute its logic and transfer tokens back
        IFlashLoanCallback(ctx.caller).onFlashLoanReceived(
            tokens,
            amounts,
            feeAmounts,
            ctx.callbackData
        );
        
        // ═══════════════════════════════════════════════
        // LAYER 2: Trust The Revert
        // ═══════════════════════════════════════════════
        // Step 3: Repay Balancer (will revert if insufficient balance)
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 repayAmount = amounts[i] + feeAmounts[i];
            uint256 balance = tokens[i].balanceOf(address(this));
            
            if (balance < repayAmount) {
                revert InsufficientRepayment(address(tokens[i]), repayAmount, balance);
            }
            
            // Transfer to Balancer Vault
            tokens[i].safeTransfer(BALANCER_VAULT, repayAmount);
            
            emit FlashLoanExecuted(ctx.caller, address(tokens[i]), amounts[i], feeAmounts[i]);
        }
    }
    
    // ==================== SWAP SERVICE ====================
    
    /**
     * @notice Esegue uno swap via SimpleSwap (Uniswap V3)
     * @param tokenIn Token da vendere
     * @param tokenOut Token da comprare
     * @param amountIn Importo da vendere
     * @return amountOut Importo ricevuto
     * 
     * @dev Servizio centralizzato di swap per tutti i plugin
     *      I token devono essere già in questo contratto
     *      Durante flash loan, la reentrancy è già gestita dal flash loan stesso
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        // Se non siamo in un flash loan, applica reentrancy guard manualmente
        // Durante flash loan, la protezione viene dalla transazione atomica
        if (!_inFlashLoan) {
            // Reentrancy check manuale
            require(!_swapping, "ReentrancyGuard: reentrant call");
            _swapping = true;
        }
        
        // Verify caller is registered plugin
        if (!_isRegisteredPlugin(msg.sender)) {
            if (!_inFlashLoan) _swapping = false;
            revert NotRegisteredPlugin(msg.sender);
        }
        
        // Transfer tokens from caller
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve SimpleSwap
        IERC20(tokenIn).safeIncreaseAllowance(SIMPLE_SWAP, amountIn);
        
        // Execute swap
        amountOut = ISimpleSwap(SIMPLE_SWAP).inputSwap(tokenIn, tokenOut, amountIn);
        
        if (amountOut == 0) {
            if (!_inFlashLoan) _swapping = false;
            revert SwapFailed(tokenIn, tokenOut, amountIn);
        }
        
        // Transfer result back to caller
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
        
        if (!_inFlashLoan) _swapping = false;
        
        return amountOut;
    }
    
    /**
     * @notice Stima output di uno swap senza eseguirlo
     * @param tokenIn Token da vendere
     * @param tokenOut Token da comprare
     * @param amountIn Importo da vendere
     * @return amountOut Importo stimato
     */
    function getExpectedOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        // Determina decimali dinamicamente
        uint8 decimalsIn = IERC20Metadata(tokenIn).decimals();
        uint8 decimalsOut = IERC20Metadata(tokenOut).decimals();
        
        try ISimpleSwap(SIMPLE_SWAP).getExpectedOutput(tokenIn, tokenOut, amountIn, decimalsIn, decimalsOut) returns (uint256 result) {
            return result;
        } catch {
            // Fallback: usa prezzi da TokenManager per stima cross-asset
            return _estimateViaTokenManager(tokenIn, tokenOut, amountIn, decimalsIn, decimalsOut);
        }
    }

    /**
     * @notice Stima output swap usando prezzi da TokenManager
     * @dev Fallback quando SimpleSwap.getExpectedOutput() non è disponibile.
     *      Usa try/catch su this.estimateFromTokenManager() per gestire 
     *      qualsiasi errore nelle sotto-chiamate (getActiveTokens, getTokenAddress, etc.)
     * @param tokenIn Token in ingresso
     * @param tokenOut Token in uscita
     * @param amountIn Importo in ingresso
     * @param decimalsIn Decimali tokenIn
     * @param decimalsOut Decimali tokenOut
     * @return Importo stimato in tokenOut
     */
    function _estimateViaTokenManager(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint8 decimalsIn,
        uint8 decimalsOut
    ) internal view returns (uint256) {
        try this.estimateFromTokenManager(tokenIn, tokenOut, amountIn, decimalsIn, decimalsOut) returns (uint256 result) {
            if (result > 0) return result;
        } catch {}
        
        // Ultimo fallback: conversione 1:1 (solo per same-asset o token sconosciuti)
        return (amountIn * (10 ** decimalsOut)) / (10 ** decimalsIn);
    }

    /**
     * @notice Stima output swap tramite TokenManager (external per try/catch safety)
     * @dev Essendo external, può essere chiamata via try this.estimateFromTokenManager()
     *      e qualsiasi revert interno viene catturato dal catch
     */
    function estimateFromTokenManager(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint8 decimalsIn,
        uint8 decimalsOut
    ) external view returns (uint256) {
        address tmAddr = beacon.getImplementation("TokenManager");
        require(tmAddr != address(0), "No TokenManager");
        
        ITokenManagerForModules tm = ITokenManagerForModules(tmAddr);
        string[] memory tokens = tm.getActiveTokens();
        uint256 priceIn;
        uint256 priceOut;
        
        for (uint256 i = 0; i < tokens.length; i++) {
            address addr = tm.getTokenAddress(tokens[i]);
            if (addr == tokenIn) {
                priceIn = tm.getTokenPriceForModule(tokens[i]);
            }
            if (addr == tokenOut) {
                priceOut = tm.getTokenPriceForModule(tokens[i]);
            }
        }
        
        require(priceIn > 0 && priceOut > 0, "Price not found");
        
        // cross-rate: amountOut = amountIn * priceIn / priceOut * 10^decimalsOut / 10^decimalsIn
        return (amountIn * priceIn * (10 ** decimalsOut)) / (priceOut * (10 ** decimalsIn));
    }
    
    // ==================== INTERNAL FUNCTIONS ====================
    
    /**
     * @notice Verifica se un indirizzo è un plugin registrato nel Beacon
     * @param plugin Indirizzo da verificare
     * @return isRegistered True se è un plugin registrato
     * 
     * @dev Completamente dinamico: itera su TUTTI i moduli registrati nel Beacon.
     *      Non serve aggiornare/rideployare FlashLoanService quando si aggiunge un nuovo plugin.
     */
    function _isRegisteredPlugin(address plugin) internal view returns (bool) {
        string[] memory moduleNames = beacon.getRegisteredModules();
        
        for (uint256 i = 0; i < moduleNames.length; i++) {
            try beacon.getImplementation(moduleNames[i]) returns (address registered) {
                if (registered == plugin) {
                    return true;
                }
            } catch {
                // Modulo frozen o errore, continua
            }
        }
        
        return false;
    }
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @notice Ritorna indirizzo Balancer Vault
     * @return Indirizzo del vault
     */
    function getBalancerVault() external pure returns (address) {
        return BALANCER_VAULT;
    }
    
    /**
     * @notice Ritorna indirizzo SimpleSwap
     * @return Indirizzo del router
     */
    function getSimpleSwap() external pure returns (address) {
        return SIMPLE_SWAP;
    }
    
    /**
     * @notice Verifica se un plugin è autorizzato
     * @param plugin Indirizzo da verificare
     * @return True se autorizzato
     */
    function isAuthorizedPlugin(address plugin) external view returns (bool) {
        return _isRegisteredPlugin(plugin);
    }
}
