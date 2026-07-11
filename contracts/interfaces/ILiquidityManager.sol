// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ILiquidityManager
 * @dev Interfaccia completa per LiquidityManager come da specs
 */
interface ILiquidityManager {
    
    // ==================== STRUCTS ====================
    
    struct WithdrawLimits {
        uint256 hourlyLimit;
        uint256 dailyLimit;
        uint256 minWithdraw;
        uint256 maxWithdraw;
    }

    // ==================== DEPOSIT OPERATIONS ====================
    
    /**
     * @notice Deposita base asset e riceve LP tokens
     * @param amount Quantità di base asset da depositare
     */
    function deposit(uint256 amount) external returns (uint256 lpTokens);
    
    /**
     * @notice Calcola shares per un deposito
     * @param amount Quantità base asset
     * @return shares Shares calcolate
     */
    function calculateDepositShares(uint256 amount) external view returns (uint256 shares);

    // ==================== WITHDRAW OPERATIONS ====================
    
    /**
     * @notice Preleva base asset bruciando LP tokens
     * @param lpTokenAmount LP tokens da bruciare
     * @return amount Base asset ricevuto
     */
    function withdraw(uint256 lpTokenAmount) external returns (uint256 amount);
    
    /**
     * @notice Calcola base asset ricevibile per LP tokens
     * @param lpTokens Numero di LP tokens
     * @return amount Base asset ricevibile
     */
    function calculateWithdrawAmount(uint256 lpTokens) external view returns (uint256 amount);

    // ==================== WITHDRAW LIMITS ====================
    
    /**
     * @notice Imposta limiti withdraw
     * @param hourlyLimit Limite orario
     * @param dailyLimit Limite giornaliero
     * @param minWithdraw Minimo withdraw
     * @param maxWithdraw Massimo withdraw per transazione
     */
    function setWithdrawLimits(
        uint256 hourlyLimit,
        uint256 dailyLimit,
        uint256 minWithdraw,
        uint256 maxWithdraw
    ) external;
    
    /**
     * @notice Controlla limiti withdraw
     * @param user Utente
     * @param amount Quantità
     * @return canWithdraw Se può prelevare
     * @return reason Motivo se non può
     */
    function checkWithdrawLimits(address user, uint256 amount) external view returns (bool canWithdraw, string memory reason);
    
    /**
     * @notice Limite orario rimanente
     * @param user Utente
     * @return remaining Rimanente
     */
    function getRemainingHourlyLimit(address user) external view returns (uint256 remaining);
    
    /**
     * @notice Limite giornaliero rimanente
     * @param user Utente
     * @return remaining Rimanente
     */
    function getRemainingDailyLimit(address user) external view returns (uint256 remaining);

    // ==================== FEE MANAGEMENT ====================
    
    /**
     * @notice Imposta deposit fee
     * @param newFee Nuova fee in basis points
     */
    function setDepositFee(uint256 newFee) external;
    
    /**
     * @notice Imposta withdraw fee
     * @param newFee Nuova fee in basis points
     */
    function setWithdrawFee(uint256 newFee) external;
    
    /**
     * @notice Imposta fee recipient
     * @param newRecipient Nuovo recipient
     */
    function setFeeRecipient(address newRecipient) external;

    // ==================== STATE MANAGEMENT ====================
    
    /**
     * @notice Abilita/disabilita deposits
     * @param enabled Stato enabled
     */
    function setDepositsEnabled(bool enabled) external;
    
    /**
     * @notice Abilita/disabilita withdrawals
     * @param enabled Stato enabled
     */
    function setWithdrawsEnabled(bool enabled) external;

    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @notice Verifica se withdraw è possibile
     * @param user Utente
     * @param shares Shares da prelevare
     * @return canWithdraw Se possibile
     * @return errorReason Motivo errore
     */
    function canWithdraw(address user, uint256 shares) external view returns (bool canWithdraw, string memory errorReason);
    
    /**
     * @notice Statistiche pool
     * @return totalValue Valore totale
     * @return totalSupply Supply totale
     * @return baseAssetBalance Balance base asset
     * @return tokensCount Numero token
     */
    function getPoolStats() external view returns (
        uint256 totalValue,
        uint256 totalSupply,
        uint256 baseAssetBalance,
        uint256 tokensCount
    );
    
    /**
     * @notice Valida stato pool
     * @return isValid Se valido
     * @return errorReason Motivo errore
     */
    function validatePoolState() external view returns (bool isValid, string memory errorReason);

    // ==================== EVENTS ====================
    
    event Deposit(address indexed user, uint256 amount, uint256 sharesReceived, uint256 totalPoolBaseAsset, uint256 totalSupply);
    event Withdrawn(address indexed user, uint256 shares, uint256 amount, uint256 totalPoolValue, uint256 remainingPoolBalance);
    event TokenSwappedForWithdraw(string indexed tokenCode, uint256 amountIn, uint256 amountOut);
    event WithdrawLimitsUpdated(uint256 hourlyLimit, uint256 dailyLimit, uint256 minWithdraw, uint256 maxWithdraw);
    event DepositFeeUpdated(uint256 oldFee, uint256 newFee);
    event WithdrawFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event DepositsEnabledChanged(bool enabled);
    event WithdrawsEnabledChanged(bool enabled);
    
    // ==================== DEADLINE MONITORING EVENTS ====================
    
    /// @notice Emitted when withdrawal starts with deadline
    event WithdrawalStarted(
        address indexed user,
        uint256 shares,
        uint256 deadline,
        uint256 timeRemaining,
        bool requiresSwap
    );
    
    /// @notice Emitted when automatic swap is triggered during withdrawal
    event AutomaticSwapTriggered(
        address indexed user,
        string tokenToSwap,
        uint256 amountToSwap,
        uint256 baseAssetNeeded,
        uint256 deadline,
        uint256 timeRemaining
    );
    
    /// @notice Emitted when withdrawal completes with timing info
    event WithdrawalCompleted(
        address indexed user,
        uint256 shares,
        uint256 amountReceived,
        uint256 deadline,
        uint256 timeUsed,
        bool swapExecuted
    );
    
    /// @notice Emitted when deadline is critical during withdrawal (< 3 min)
    event WithdrawalDeadlineCritical(
        address indexed user,
        uint256 deadline,
        uint256 timeRemaining,
        string stage
    );
    
    // ==================== MULTI-SWAP EVENTS ====================
    
    /// @notice Emitted when multi-swap process starts
    event MultiSwapStarted(
        address indexed user,
        uint256 wethNeeded,
        uint256 maxIterations
    );
    
    /// @notice Emitted for each iteration of multi-swap
    event MultiSwapIteration(
        address indexed user,
        uint256 iteration,
        string tokenCode,
        uint256 amountSwapped,
        uint256 baseAssetReceived,
        uint256 baseAssetStillNeeded
    );
    
    /// @notice Emitted when multi-swap process completes
    event MultiSwapCompleted(
        address indexed user,
        uint256 totalIterations,
        uint256 totalBaseAssetObtained
    );

    // ==================== PROTOCOL INTEGRATION EVENTS ====================

    /// @notice Emitted when protocol positions are closed to obtain base asset for withdrawal
    /// @dev This is the modular version - works with ANY protocol via IProtocolAdapter
    event ProtocolPositionsClosedForBaseAsset(
        uint256 positionsClosed,
        uint256 baseAssetObtained
    );
    
    /// @notice Emitted when liquid tokens are swapped to base asset during withdrawal
    event LiquidTokenSwappedForBaseAsset(
        string indexed tokenCode,
        uint256 tokenAmount,
        uint256 baseAssetObtained
    );
}