// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IAccountLens
 * @notice Interfaccia per AccountLens di Euler V2
 * @dev Permette di query informazioni sullo stato degli account
 * 
 * Indirizzo Arbitrum: 0x90a52DDcb232e7bb003DD9258fA1235c553eC956
 * 
 * IMPORTANTE: La struct AccountLiquidityInfo deve matchare esattamente
 * l'ABI on-chain, altrimenti i dati vengono decodificati nei campi sbagliati!
 */
interface IAccountLens {
    
    /**
     * @notice Informazioni sulla liquidità di un account
     * @dev ORDINE CRITICO - deve matchare l'ABI on-chain esattamente!
     */
    struct AccountLiquidityInfo {
        bool queryFailure;              // Se la query è fallita
        bytes queryFailureReason;       // Motivo del fallimento
        address account;                // Account interrogato
        address vault;                  // Vault controller
        address unitOfAccount;          // Unit of account per i valori
        int256 timeToLiquidation;       // Tempo alla liquidazione (secondi)
        uint256 liabilityValueBorrowing;    // Valore del debito (borrow context)
        uint256 liabilityValueLiquidation;  // Valore del debito (liquidation context)
        uint256 collateralValueBorrowing;   // Valore collaterale (borrow context)
        uint256 collateralValueLiquidation; // Valore collaterale (liquidation context)
        uint256 collateralValueRaw;         // Valore collaterale raw
        address[] collaterals;              // Lista collaterali
        uint256[] collateralValuesBorrowing;    // Valori per collaterale (borrow)
        uint256[] collateralValuesLiquidation;  // Valori per collaterale (liquidation)
        uint256[] collateralValuesRaw;          // Valori per collaterale (raw)
    }
    
    /**
     * @notice Informazioni complete su un account per un vault specifico
     */
    struct VaultAccountInfo {
        uint256 timestamp;
        address account;
        address vault;
        address asset;
        uint256 assetsAccount;
        uint256 shares;
        uint256 assets;
        uint256 borrowed;
        uint256 assetAllowanceVault;
        uint256 assetAllowanceVaultPermit2;
        uint256 assetAllowanceExpirationVaultPermit2;
        uint256 assetAllowancePermit2;
        bool balanceForwarderEnabled;
        bool isController;
        bool isCollateral;
        AccountLiquidityInfo liquidityInfo;
    }
    
    /**
     * @notice Informazioni EVC per un account
     */
    struct EVCAccountInfo {
        uint256 timestamp;
        address evc;
        address account;
        bytes19 addressPrefix;
        address owner;
        bool isLockdownMode;
        bool isPermitDisabledMode;
        uint256 lastAccountStatusCheckTimestamp;
        address[] enabledControllers;
        address[] enabledCollaterals;
    }
    
    /**
     * @notice Informazioni complete dell'account
     */
    struct AccountInfo {
        EVCAccountInfo evcAccountInfo;
        VaultAccountInfo vaultAccountInfo;
    }
    
    /**
     * @notice Ottiene informazioni complete su un account per un vault
     * @param account Indirizzo dell'account
     * @param vault Vault da interrogare
     * @return info Informazioni complete
     */
    function getAccountInfo(address account, address vault) 
        external 
        view 
        returns (AccountInfo memory info);
    
    /**
     * @notice Ottiene il tempo alla liquidazione per un account
     * @param account Indirizzo account
     * @param vault Vault controller
     * @return ttl Tempo in secondi, valori speciali:
     *         -1 (TTL_LIQUIDATION) = già liquidabile
     *         type(int256).max (TTL_INFINITY) = nessun debito
     *         type(int256).max - 1 (TTL_MORE_THAN_ONE_YEAR) = più di un anno
     */
    function getTimeToLiquidation(address account, address vault) 
        external 
        view 
        returns (int256 ttl);
    
    /**
     * @notice Ottiene informazioni sulla liquidità per un account/vault
     * @param account Indirizzo account
     * @param vault Vault controller da interrogare
     * @return info Informazioni liquidità
     */
    function getAccountLiquidityInfo(address account, address vault)
        external
        view
        returns (AccountLiquidityInfo memory info);
    
    /**
     * @notice Come getAccountLiquidityInfo ma non valida lo stato account
     * @param account Indirizzo account
     * @param vault Vault controller
     * @return info Informazioni liquidità
     */
    function getAccountLiquidityInfoNoValidation(address account, address vault)
        external
        view
        returns (AccountLiquidityInfo memory info);
    
    /**
     * @notice Costanti TTL
     */
    function TTL_LIQUIDATION() external view returns (int256);
    function TTL_INFINITY() external view returns (int256);
    function TTL_MORE_THAN_ONE_YEAR() external view returns (int256);
    function TTL_ERROR() external view returns (int256);
}
