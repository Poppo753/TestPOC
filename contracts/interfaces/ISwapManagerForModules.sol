// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISwapManagerForModules {
    /**
     * @notice Esegue swap con deadline esplicito (MEV protected)
     * @param spendTokenCode Token da vendere
     * @param receiveTokenCode Token da ricevere
     * @param amountIn Quantità input
     * @param deadline Timestamp massimo esecuzione
     * @return amountReceived Quantità ricevuta
     */
    function performSwap(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn,
        uint256 deadline
    ) external returns (uint256 amountReceived);
    
    /**
     * @notice Esegue swap con deadline automatico (backward compatibility)
     * @param spendTokenCode Token da vendere
     * @param receiveTokenCode Token da ricevere
     * @param amountIn Quantità input
     * @return amountReceived Quantità ricevuta
     */
    function performSwapAuto(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) external returns (uint256 amountReceived);
    
    function validateSwapParameters(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) external view returns (bool isValid, string memory errorReason);
}
