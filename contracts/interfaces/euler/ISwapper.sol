// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title ISwapper
 * @notice Interfaccia per lo Swapper Euler V2
 * @dev Lo Swapper è un contratto UNTRUSTED che esegue swap tramite DEX esterni
 *      Usato per operazioni leverage (borrow → swap → deposit)
 * 
 * Fonte: https://github.com/euler-xyz/evk-periphery
 * 
 * Indirizzo Arbitrum: 0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7
 * 
 * IMPORTANTE:
 * - Lo Swapper è UNTRUSTED - non mantiene fondi
 * - SEMPRE usare SwapVerifier dopo lo Swapper per verificare output
 * - I fondi vengono inviati allo Swapper e poi swappati
 */
interface ISwapper {
    
    // ========== ENUMS ==========
    
    /**
     * @notice Modalità di swap
     */
    enum SwapMode {
        EXACT_INPUT,      // Swap quantità esatta di input per massimo output
        EXACT_OUTPUT,     // Swap minimo input per quantità esatta di output
        TARGET_DEBT       // Swap per ripagare un target di debito specifico
    }
    
    // ========== STRUCTS ==========
    
    /**
     * @notice Parametri per eseguire uno swap
     * @param handler Handler da usare (es. Uniswap V3, 1inch)
     * @param mode Modalità di swap
     * @param account Account per conto del quale swappare
     * @param tokenIn Token da vendere
     * @param tokenOut Token da comprare
     * @param amountIn Quantità input (per EXACT_INPUT)
     * @param amountOut Quantità output (per EXACT_OUTPUT)
     * @param data Dati specifici per l'handler (es. path Uniswap)
     */
    struct SwapParams {
        address handler;
        SwapMode mode;
        address account;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        bytes data;
    }
    
    // ========== FUNCTIONS ==========
    
    /**
     * @notice Esegue uno swap
     * @param params Parametri dello swap
     * @return amountIn Quantità effettiva di token in usata
     * @return amountOut Quantità effettiva di token out ricevuta
     */
    function swap(SwapParams calldata params) 
        external 
        returns (uint256 amountIn, uint256 amountOut);
}

/**
 * @title ISwapVerifier
 * @notice Interfaccia per il SwapVerifier Euler V2
 * @dev Il SwapVerifier è un contratto TRUSTED che verifica l'esito degli swap
 *      SEMPRE usare dopo lo Swapper per protezione slippage
 * 
 * Indirizzo Arbitrum: 0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5
 */
interface ISwapVerifier {
    
    /**
     * @notice Verifica che l'ammontare ricevuto sia almeno il minimo e skim surplus
     * @dev Usato dopo uno swap per verificare slippage
     * @param vault Vault dove depositare
     * @param account Account beneficiario
     * @param minAmount Minimo amount richiesto
     * @param deadline Timestamp deadline
     */
    function verifyAmountMinAndSkim(
        address vault,
        address account,
        uint256 minAmount,
        uint256 deadline
    ) external;
    
    /**
     * @notice Verifica che il debito non superi un massimo
     * @dev Usato per verificare che il debito sia stato ripagato
     * @param vault Vault del debito
     * @param account Account da verificare
     * @param maxDebt Massimo debito accettabile (0 per ripagato completamente)
     * @param deadline Timestamp deadline
     */
    function verifyDebtMax(
        address vault,
        address account,
        uint256 maxDebt,
        uint256 deadline
    ) external;
    
    /**
     * @notice Verifica ammontare minimo senza skim
     * @param token Token da verificare
     * @param account Account beneficiario
     * @param minAmount Minimo amount richiesto
     * @param deadline Timestamp deadline
     */
    function verifyAmountMin(
        address token,
        address account,
        uint256 minAmount,
        uint256 deadline
    ) external;
}
