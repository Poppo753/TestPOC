// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IEVault
 * @notice Interfaccia minima per interagire con i vault Euler V2 (EVK)
 * @dev I vault Euler V2 sono ERC-4626 con funzionalità di borrowing aggiuntive
 * 
 * Fonte: https://github.com/euler-xyz/euler-vault-kit
 * 
 * Note:
 * - deposit/withdraw/mint/redeem: Standard ERC-4626
 * - borrow/repay: Estensioni Euler per lending
 * - Le shares rappresentano proprietà proporzionale degli asset
 * - Exchange rate cresce nel tempo man mano che maturano interessi
 */
interface IEVault {
    
    // ========== ERC-4626 STANDARD ==========
    
    /**
     * @notice Indirizzo dell'asset sottostante del vault
     * @return asset address dell'ERC20 sottostante
     */
    function asset() external view returns (address);
    
    /**
     * @notice Deposita asset e riceve shares
     * @param assets Quantità di asset da depositare
     * @param receiver Indirizzo che riceve le shares
     * @return shares Quantità di shares mintate
     */
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    
    /**
     * @notice Minta una quantità specifica di shares
     * @param shares Quantità di shares da mintare
     * @param receiver Indirizzo che riceve le shares
     * @return assets Quantità di asset depositati
     */
    function mint(uint256 shares, address receiver) external returns (uint256 assets);
    
    /**
     * @notice Preleva asset bruciando shares
     * @param assets Quantità di asset da prelevare
     * @param receiver Indirizzo che riceve gli asset
     * @param owner Proprietario delle shares da bruciare
     * @return shares Quantità di shares bruciate
     */
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    
    /**
     * @notice Redime shares per asset
     * @param shares Quantità di shares da bruciare
     * @param receiver Indirizzo che riceve gli asset
     * @param owner Proprietario delle shares
     * @return assets Quantità di asset ricevuti
     */
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    
    /**
     * @notice Converte assets in shares
     * @param assets Quantità di asset
     * @return shares Quantità equivalente di shares
     */
    function convertToShares(uint256 assets) external view returns (uint256 shares);
    
    /**
     * @notice Converte shares in assets
     * @param shares Quantità di shares
     * @return assets Quantità equivalente di asset
     */
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    
    /**
     * @notice Balance di shares per un account
     * @param account Indirizzo dell'account
     * @return Balance di shares
     */
    function balanceOf(address account) external view returns (uint256);
    
    /**
     * @notice Totale asset gestiti dal vault
     * @return Total assets
     */
    function totalAssets() external view returns (uint256);
    
    /**
     * @notice Totale shares emesse
     * @return Total supply di shares
     */
    function totalSupply() external view returns (uint256);
    
    /**
     * @notice Massimo deposito permesso per un receiver
     * @param receiver Indirizzo del receiver
     * @return Massimo amount depositabile
     */
    function maxDeposit(address receiver) external view returns (uint256);
    
    /**
     * @notice Massimo prelievo permesso per un owner
     * @param owner Proprietario delle shares
     * @return Massimo amount prelevabile
     */
    function maxWithdraw(address owner) external view returns (uint256);
    
    // ========== EULER LENDING EXTENSIONS ==========
    
    /**
     * @notice Prende in prestito asset dal vault
     * @param assets Quantità di asset da prendere in prestito
     * @param receiver Indirizzo che riceve gli asset borrowed
     * @return assets effettivamente borrowati
     */
    function borrow(uint256 assets, address receiver) external returns (uint256);
    
    /**
     * @notice Ripaga un debito
     * @param assets Quantità di asset da ripagare
     * @param receiver Account il cui debito viene ripagato
     * @return assets effettivamente ripagati
     */
    function repay(uint256 assets, address receiver) external returns (uint256);
    
    /**
     * @notice Ottiene il debito corrente di un account
     * @param account Indirizzo dell'account
     * @return Debito in asset (inclusi interessi maturati)
     */
    function debtOf(address account) external view returns (uint256);
    
    /**
     * @notice Totale debiti outstanding nel vault
     * @return Total borrows
     */
    function totalBorrows() external view returns (uint256);
    
    /**
     * @notice Disabilita questo vault come controller per il caller
     * @dev Chiama internamente evc.disableController(account) dove msg.sender è il vault.
     *      Richiede che il debito dell'account sia 0 (altrimenti reverte con E_OutstandingDebt).
     *      Questo è il modo corretto per rilasciare il controller status in Euler V2.
     */
    function disableController() external;
    
    /**
     * @notice Verifica se un account è in stato di violazione (liquidabile)
     * @param account Indirizzo da verificare
     * @return True se l'account è in violazione
     */
    function checkAccountStatus(address account) external view returns (bool);
    
    // ========== VAULT INFO ==========
    
    /**
     * @notice Nome del vault
     * @return Nome
     */
    function name() external view returns (string memory);
    
    /**
     * @notice Simbolo del vault
     * @return Simbolo
     */
    function symbol() external view returns (string memory);
    
    /**
     * @notice Decimali del vault (tipicamente uguale all'asset sottostante)
     * @return Decimali
     */
    function decimals() external view returns (uint8);
}
