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
 * 
 * HANDLER DISPONIBILI:
 * - HANDLER_GENERIC = bytes32("Generic") - Per aggregatori esterni (1inch, Paraswap, etc.)
 * - HANDLER_UNISWAP_V2 = bytes32("UniswapV2") - Exact output su Uniswap V2
 * - HANDLER_UNISWAP_V3 = bytes32("UniswapV3") - Exact output su Uniswap V3
 * 
 * SWAPPING MODES:
 * - MODE_EXACT_IN = 0 - Swap quantità esatta di input
 * - MODE_EXACT_OUT = 1 - Swap per quantità esatta di output
 * - MODE_TARGET_DEBT = 2 - Swap per ripagare debito target
 */
interface ISwapper {
    
    // ========== CONSTANTS ==========
    
    // Handler identifiers (bytes32)
    // HANDLER_GENERIC = bytes32("Generic")
    // HANDLER_UNISWAP_V2 = bytes32("UniswapV2")  
    // HANDLER_UNISWAP_V3 = bytes32("UniswapV3")
    
    // Swap modes
    // MODE_EXACT_IN = 0
    // MODE_EXACT_OUT = 1
    // MODE_TARGET_DEBT = 2
    
    // ========== STRUCTS ==========
    
    /**
     * @notice Parametri per eseguire uno swap
     * @dev Fonte: https://github.com/euler-xyz/evk-periphery/blob/main/src/Swaps/ISwapper.sol
     * 
     * @param handler Handler ID (bytes32) - es. bytes32("Generic")
     * @param mode Modalità di swap (0=EXACT_IN, 1=EXACT_OUT, 2=TARGET_DEBT)
     * @param account Account EVC-compatibile (usato per repay in TARGET_DEBT mode)
     * @param tokenIn Token da vendere
     * @param tokenOut Token da comprare
     * @param amountOut Quantità output (per EXACT_OUT/TARGET_DEBT)
     * @param vaultIn Vault da cui ripristinare input inutilizzato (EXACT_OUT mode)
     * @param accountIn Account per deposito input inutilizzato
     * @param receiver Destinatario del token output
     * @param data Dati specifici per l'handler:
     *             - GenericHandler: abi.encode(targetAddress, calldata)
     *             - UniswapV2: abi.encode(address[] path)
     *             - UniswapV3: bytes path (token+fee+token+fee+...)
     */
    struct SwapParams {
        bytes32 handler;
        uint256 mode;
        address account;
        address tokenIn;
        address tokenOut;
        uint256 amountOut;
        address vaultIn;
        address accountIn;
        address receiver;
        bytes data;
    }
    
    // ========== FUNCTIONS ==========
    
    /**
     * @notice Esegue uno swap
     * @param params Parametri dello swap
     */
    function swap(SwapParams calldata params) external;
    
    /**
     * @notice Ripaga debito usando balance del contratto
     * @param token Asset preso in prestito
     * @param vault Vault dove è tracciato il debito
     * @param repayAmount Quantità da ripagare
     * @param account Account beneficiario del repay
     */
    function repay(address token, address vault, uint256 repayAmount, address account) external;
    
    /**
     * @notice Ripaga debito e deposita surplus
     * @param token Asset preso in prestito
     * @param vault Vault dove è tracciato il debito e depositare
     * @param repayAmount Quantità da ripagare
     * @param account Account beneficiario
     */
    function repayAndDeposit(address token, address vault, uint256 repayAmount, address account) external;
    
    /**
     * @notice Deposita balance del contratto nel vault
     * @param token Token da depositare
     * @param vault Vault destinazione
     * @param amountMin Minimo da depositare (revert se balance < amountMin)
     * @param account Account beneficiario
     */
    function deposit(address token, address vault, uint256 amountMin, address account) external;
    
    /**
     * @notice Trasferisce balance del contratto
     * @param token Token da trasferire
     * @param amountMin Minimo da trasferire
     * @param receiver Destinatario
     */
    function sweep(address token, uint256 amountMin, address receiver) external;
    
    /**
     * @notice Esegue multiple chiamate in una transazione
     * @param calls Array di calldata da eseguire
     * @return results Array di risultati
     */
    function multicall(bytes[] calldata calls) external returns (bytes[] memory results);
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
