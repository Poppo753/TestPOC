// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./IProtocolManager.sol";

/**
 * @title ILendingProtocol
 * @notice Interfaccia per protocolli lending (Dolomite, Aave, Compound, ecc.)
 * @dev Estende IProtocolManager aggiungendo operazioni specifiche per lending
 * 
 * Architettura:
 * - Estende IProtocolManager (eredita deposit, withdraw, getBalance, getTotalValue)
 * - Aggiunge operazioni lending: borrow, repay, getDebt, getHealthFactor
 * - Permette funzioni protocol-specific tramite ProtocolManager.executeProtocolCall()
 * 
 * Custody Flow (borrow):
 * Dolomite → Plugin → ProxyGeneral (borrowed tokens)
 * 
 * Custody Flow (repay):
 * ProxyGeneral → Plugin → Dolomite (repayment tokens)
 * 
 * @author Project4 Team
 */
interface ILendingProtocol is IProtocolManager {
    
    // ========== EVENTS ==========
    
    /**
     * @notice Emesso quando viene eseguito un borrow
     * @param tokenCode Codice del token preso in prestito
     * @param amount Importo preso in prestito
     * @param accountNumber Account number (per protocolli con isolated positions, es. Dolomite)
     */
    event Borrowed(string tokenCode, uint256 amount, uint256 accountNumber);
    
    /**
     * @notice Emesso quando viene eseguito un repay
     * @param tokenCode Codice del token ripagato
     * @param amount Importo ripagato
     * @param accountNumber Account number (per protocolli con isolated positions)
     */
    event Repaid(string tokenCode, uint256 amount, uint256 accountNumber);
    
    // ========== LENDING OPERATIONS ==========
    
    /**
     * @notice Prende in prestito token dal protocollo
     * @dev Il plugin esegue borrow dal protocollo esterno e DEVE trasferire i token a ProxyGeneral
     * @dev Utilizza collaterale già depositato (via deposit() ereditata da IProtocolManager)
     * 
     * @param tokenCode Codice del token da prendere in prestito (es. "USDC", "WETH")
     * @param amount Importo da prendere in prestito (in wei)
     * @return success True se il borrow è riuscito
     * 
     * Requirements:
     * - Il plugin DEVE avere collaterale sufficiente depositato
     * - Il plugin DEVE eseguire borrow dal protocollo esterno
     * - Il plugin DEVE trasferire i borrowed tokens a ProxyGeneral (non al caller)
     * - Il plugin DEVE aggiornare debt tracking
     * 
     * Example:
     * ```
     * // Scenario: 1 WETH collaterale depositato, borrow 1000 USDC
     * // 1. Precedente: deposit("WETH", 1 ether) già eseguito
     * // 2. ProtocolManager chiama:
     * ILendingProtocol(dolomitePlugin).borrow("USDC", 1000e6);
     * // 3. DolomitePlugin:
     * //    - Borrow 1000 USDC da Dolomite contro 1 WETH collaterale
     * //    - Trasferisce 1000 USDC a ProxyGeneral
     * // 4. ProxyGeneral ora ha 1000 USDC disponibili
     * ```
     */
    function borrow(string memory tokenCode, uint256 amount) external returns (bool success);
    
    /**
     * @notice Ripaga un debito nel protocollo
     * @dev Il plugin si aspetta che i token di repayment siano già nel suo contratto
     * @dev Dopo il repayment, il debito è ridotto nel protocollo esterno
     * 
     * @param tokenCode Codice del token da ripagare (es. "USDC", "WETH")
     * @param amount Importo da ripagare (in wei)
     * @return success True se il repayment è riuscito
     * 
     * Requirements:
     * - Il plugin DEVE avere già ricevuto i repayment tokens da ProxyGeneral
     * - Il plugin DEVE eseguire repay nel protocollo esterno
     * - Il plugin DEVE aggiornare debt tracking
     * 
     * Example:
     * ```
     * // Scenario: repay 500 USDC di un debito di 1000 USDC
     * // 1. ProtocolManager ha già trasferito 500 USDC al plugin
     * // 2. ProtocolManager chiama:
     * ILendingProtocol(dolomitePlugin).repay("USDC", 500e6);
     * // 3. DolomitePlugin:
     * //    - Repay 500 USDC su Dolomite
     * //    - Debt ridotto da 1000 USDC → 500 USDC
     * ```
     */
    function repay(string memory tokenCode, uint256 amount) external returns (bool success);
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Ottiene il debito corrente per un token
     * @dev Ritorna il debito effettivo nel protocollo esterno (inclusi interessi maturati)
     * 
     * @param tokenCode Codice del token (es. "USDC", "WETH")
     * @return debtAmount Importo del debito (in wei)
     * 
     * Example:
     * ```
     * uint256 usdcDebt = ILendingProtocol(dolomitePlugin).getDebt("USDC");
     * // Ritorna: 1005000000 (1005 USDC - capitale 1000 + interessi 5)
     * ```
     */
    function getDebt(string memory tokenCode) external view returns (uint256 debtAmount);
    
    /**
     * @notice Ottiene il health factor della posizione
     * @dev Health factor = (Collateral Value * Liquidation Threshold) / Debt Value
     * @dev Health factor < 1.0 (1e18) = posizione liquidabile
     * 
     * @return healthFactor Health factor in 18 decimali (1.0 = 1e18)
     * 
     * Example:
     * ```
     * uint256 hf = ILendingProtocol(dolomitePlugin).getHealthFactor();
     * // Ritorna: 1500000000000000000 (1.5 = posizione sicura)
     * // Ritorna: 800000000000000000 (0.8 = LIQUIDABILE!)
     * 
     * // Calcolo esempio:
     * // Collateral: 1 WETH ($2000) * 0.8 (LT) = $1600
     * // Debt: 1000 USDC = $1000
     * // Health Factor = 1600 / 1000 = 1.6
     * ```
     */
    function getHealthFactor() external view returns (uint256 healthFactor);
    
    /**
     * @notice Ottiene la capacità di borrow rimanente per un token
     * @dev Ritorna quanto può ancora essere preso in prestito senza andare in liquidazione
     * @dev Considera collateral value, existing debt, liquidation threshold
     * 
     * @param tokenCode Codice del token (es. "USDC", "WETH")
     * @return borrowCapacity Capacità di borrow rimanente (in wei)
     * 
     * Example:
     * ```
     * uint256 capacity = ILendingProtocol(dolomitePlugin).getBorrowCapacity("USDC");
     * // Ritorna: 500000000 (500 USDC ancora borrowable)
     * 
     * // Calcolo esempio:
     * // Collateral: 1 WETH ($2000) * 0.8 (LT) = $1600 max borrowable
     * // Current debt: 1000 USDC = $1000
     * // Remaining capacity: $1600 - $1000 = $600 (600 USDC)
     * // Con safety buffer (es. mantieni HF > 1.2): $500 (500 USDC)
     * ```
     */
    function getBorrowCapacity(string memory tokenCode) external view returns (uint256 borrowCapacity);
    
    // ========== NOTES ==========
    
    /**
     * @dev Protocol-specific functions (es. Dolomite isolated positions, flash loans)
     *      sono accessibili tramite ProtocolManager.executeProtocolCall()
     * 
     * Example Dolomite-specific:
     * ```
     * // openBorrowPosition, borrowFromPosition, closeBorrowPosition, executeFlashLoan
     * bytes memory data = abi.encodeWithSignature(
     *     "openBorrowPosition(string,uint256)",
     *     "WETH",
     *     5e17
     * );
     * bytes memory result = protocolManager.executeProtocolCall("DolomitePlugin", data);
     * uint256 accountNumber = abi.decode(result, (uint256));
     * ```
     * 
     * @dev Inherited from IProtocolManager:
     * - deposit(tokenCode, amount) → deposita collaterale
     * - withdraw(tokenCode, amount) → preleva collaterale (se health factor permette)
     * - getBalance(tokenCode) → balance collaterale depositato
     * - getTotalValue() → valore totale collaterale in ETH
     * - getProtocolInfo() → info protocollo
     * - emergencyWithdrawAll(tokenCodes[]) → emergency withdraw
     */
}
