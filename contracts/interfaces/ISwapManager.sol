// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ISwapManager
 * @dev Interfaccia completa per SwapManager come da specs
 */
interface ISwapManager {
    
    // ==================== SWAP OPERATIONS ====================

    /**
     * @notice Calcola quantità minima output per uno swap
     * @param tokenCodeIn Token input
     * @param tokenCodeOut Token output  
     * @param amountIn Quantità input
     * @param slippageTolerance Tolleranza slippage (basis points)
     * @return minAmountOut Quantità minima output
     */
    function calculateMinAmountOut(
        string memory tokenCodeIn,
        string memory tokenCodeOut,
        uint256 amountIn,
        uint256 slippageTolerance
    ) external view returns (uint256 minAmountOut);

    // ==================== ROUTER MANAGEMENT ====================
    
    /**
     * @notice Imposta SimpleSwap router address
     * @param newRouter Indirizzo nuovo router
     */
    function setSimpleSwapRouter(address newRouter) external;
    
    /**
     * @notice Ottiene indirizzo SimpleSwap router corrente
     * @return router Indirizzo router
     */
    function getSimpleSwapRouter() external view returns (address router);

    // ==================== STATE MANAGEMENT ====================
    
    /**
     * @notice Abilita/disabilita swaps
     * @param enabled Stato swaps
     */
    function setSwapsEnabled(bool enabled) external;
    
    /**
     * @notice Verifica se swaps sono abilitati
     * @return enabled Se swaps abilitati
     */
    function areSwapsEnabled() external view returns (bool enabled);

    // ==================== PRICE & ESTIMATION ====================
    
    /**
     * @notice Ottiene prezzo corrente token/base asset
     * @param tokenCode Codice token
     * @return price Prezzo in base asset per unità token
     */
    function getTokenBaseAssetPrice(string memory tokenCode) external view returns (uint256 price);
    
    /**
     * @notice Stima gas per uno swap
     * @param tokenCodeIn Token input
     * @param tokenCodeOut Token output
     * @param amountIn Quantità input
     * @return gasEstimate Stima gas
     */
    function estimateSwapGas(
        string memory tokenCodeIn,
        string memory tokenCodeOut,
        uint256 amountIn
    ) external view returns (uint256 gasEstimate);

    // ==================== VALIDATION ====================
    
    /**
     * @notice Verifica se uno swap è fattibile
     * @param tokenCodeIn Token input
     * @param tokenCodeOut Token output
     * @param amountIn Quantità input
     * @return canSwap Se fattibile
     * @return reason Motivo se non fattibile
     */
    function canSwap(
        string memory tokenCodeIn,
        string memory tokenCodeOut,
        uint256 amountIn
    ) external view returns (bool canSwap, string memory reason);
    
    /**
     * @notice Valida parametri swap
     * @param tokenCodeIn Token input
     * @param tokenCodeOut Token output
     * @param amountIn Quantità input
     * @param minAmountOut Quantità minima output
     * @param deadline Deadline
     * @return isValid Se parametri validi
     * @return errorMessage Messaggio errore
     */
    function validateSwapParams(
        string memory tokenCodeIn,
        string memory tokenCodeOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external view returns (bool isValid, string memory errorMessage);

    // ==================== EMERGENCY ====================
    
    /**
     * @notice Recupero token in emergenza
     * @param tokenCode Codice token
     * @param amount Quantità da recuperare
     * @param recipient Destinatario
     */
    function emergencyTokenRecovery(
        string memory tokenCode,
        uint256 amount,
        address recipient
    ) external;

    // ==================== EVENTS ====================
    
    event SwapExecuted(
        address indexed user,
        string tokenIn,
        string tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );
    event SwapRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event SwapsEnabledChanged(bool enabled);
    event EmergencyTokenRecovered(string tokenCode, uint256 amount, address recipient);
    event SlippageExceeded(
        string tokenIn,
        string tokenOut,
        uint256 expectedAmount,
        uint256 actualAmount,
        uint256 slippage
    );
}