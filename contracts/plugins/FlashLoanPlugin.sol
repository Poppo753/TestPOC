// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/balancer/IBalancerVault.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/ISimpleSwap.sol";
import "../interfaces/euler/IEVault.sol";
import "../interfaces/euler/IEVC.sol";
import "../interfaces/euler/IAccountLens.sol";

// Forward declaration per EulerVaultRegistry
interface IEulerVaultRegistry {
    function getVault(string memory tokenCode) external view returns (address);
    function getVaultSafe(string memory tokenCode) external view returns (address);
    function getTokenCode(address vault) external view returns (string memory);
    function isRegistered(string memory tokenCode) external view returns (bool);
}

/**
 * @title FlashLoanPlugin
 * @notice Plugin per leverage atomico su Euler V2 usando Balancer flash loans (0% fee)
 * @dev Implementa IFlashLoanRecipient per callback Balancer
 * 
 * ARCHITETTURA:
 * - Utilizza Balancer V2 flash loans (0% fee!)
 * - Si integra con EulerVaultRegistry per risolvere vault Euler
 * - Usa SimpleSwap (Uniswap V3) per gli swap
 * - Segue il pattern Beacon per risoluzione moduli
 * 
 * FLUSSO LEVERAGE ATOMICO:
 * 1. Flash loan WETH da Balancer
 * 2. Deposit WETH in Euler come collaterale
 * 3. Borrow USDC da Euler
 * 4. Swap USDC → WETH via SimpleSwap
 * 5. Ripaga flash loan con WETH swappato
 * 
 * FLUSSO DELEVERAGE ATOMICO:
 * 1. Flash loan USDC da Balancer
 * 2. Ripaga debito USDC su Euler
 * 3. Withdraw WETH collaterale da Euler
 * 4. Swap WETH → USDC via SimpleSwap
 * 5. Ripaga flash loan con USDC swappato
 * 
 * INDIRIZZI ARBITRUM:
 * - Balancer Vault: 0xBA12222222228d8Ba445958a75a0704d566BF2C8 (0% fee!)
 * - EVC: 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066
 * - SimpleSwap: 0xa0DB78167CBAccD47524a261b7741C6B41Bbd096
 * - AccountLens: 0x90a52DDcb232e7bb003DD9258fA1235c553eC956
 * 
 * @author Project4 Team
 * @custom:version 1.0.0
 */
contract FlashLoanPlugin is IFlashLoanRecipient, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ==================== CONSTANTS ====================
    
    /// @notice Balancer V2 Vault (same on all chains, 0% fee!)
    address public constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    
    /// @notice Euler Vault Connector su Arbitrum
    address public constant EVC_ADDRESS = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
    
    /// @notice SimpleSwap router (Uniswap V3 wrapper) su Arbitrum
    address public constant SIMPLE_SWAP = 0xa0DB78167CBAccD47524a261b7741C6B41Bbd096;
    
    /// @notice AccountLens per health factor checks
    address public constant ACCOUNT_LENS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
    
    /// @notice WETH su Arbitrum
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    
    /// @notice USDC su Arbitrum
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    
    /// @notice Minimum health factor (1.05 = 105%, buffer di sicurezza)
    uint256 public constant MIN_HEALTH_FACTOR = 1.05e18;
    
    /// @notice WETH Vault su Arbitrum
    address public constant WETH_VAULT = 0x78E3E051D32157AACD550fBB78458762d8f7edFF;
    
    /// @notice USDC Vault su Arbitrum
    address public constant USDC_VAULT = 0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899;
    
    // ==================== STATE ====================
    
    /// @notice Beacon per risoluzione moduli
    address public immutable beacon;
    
    /// @notice EVC reference
    IEVC public immutable evc;
    
    /// @notice Flag per verificare che callback venga da flash loan legittimo
    bool private _inFlashLoan;
    
    /// @notice Dati temporanei per callback (user, operation, params)
    FlashLoanContext private _context;
    
    // ==================== ENUMS ====================
    
    enum OperationType {
        OPEN_LEVERAGE,
        CLOSE_LEVERAGE
    }
    
    // ==================== STRUCTS ====================
    
    /// @notice Contesto per callback flash loan
    struct FlashLoanContext {
        address user;
        OperationType operation;
        address collateralVault;
        address borrowVault;
        uint256 targetLeverageX100;  // e.g., 200 = 2x leverage
        uint256 initialCollateral;
        uint256 minHealthFactor;
    }
    
    /// @notice Parametri per aprire posizione leverage
    struct OpenLeverageParams {
        string collateralToken;     // e.g., "WETH"
        string borrowToken;         // e.g., "USDC"
        uint256 collateralAmount;   // Initial collateral amount
        uint256 targetLeverageX100; // Target leverage * 100 (e.g., 200 = 2x)
        uint256 minHealthFactor;    // Minimum acceptable health factor
        uint256 deadline;           // Transaction deadline
    }
    
    /// @notice Parametri per chiudere posizione leverage
    struct CloseLeverageParams {
        string collateralToken;     // e.g., "WETH"
        string borrowToken;         // e.g., "USDC"
        uint256 maxSlippageBps;     // Max slippage in basis points (e.g., 100 = 1%)
        uint256 deadline;           // Transaction deadline
    }
    
    /// @notice Risultato operazione leverage
    struct LeverageResult {
        uint256 totalCollateral;
        uint256 totalDebt;
        uint256 healthFactor;
        bool success;
    }
    
    // ==================== ERRORS ====================
    
    error InvalidAddress();
    error DeadlineExpired();
    error InvalidLeverage();
    error HealthFactorTooLow(uint256 current, uint256 minimum);
    error UnauthorizedCallback();
    error FlashLoanFailed();
    error SwapFailed();
    error InsufficientRepayment(uint256 required, uint256 available);
    error VaultNotFound(string tokenCode);
    error TokenNotSupported(address token);
    
    // ==================== EVENTS ====================
    
    event LeverageOpened(
        address indexed user,
        address indexed collateralVault,
        address indexed borrowVault,
        uint256 initialCollateral,
        uint256 totalCollateral,
        uint256 totalDebt,
        uint256 healthFactor,
        uint256 targetLeverageX100
    );
    
    event LeverageClosed(
        address indexed user,
        address indexed collateralVault,
        address indexed borrowVault,
        uint256 collateralReturned,
        uint256 debtRepaid,
        uint256 profit  // In collateral token terms
    );
    
    event FlashLoanExecuted(
        address indexed token,
        uint256 amount,
        OperationType operation
    );
    
    // ==================== CONSTRUCTOR ====================
    
    /**
     * @notice Costruttore del plugin
     * @param _beacon Indirizzo del Beacon per risoluzione moduli
     */
    constructor(address _beacon) Ownable() {
        if (_beacon == address(0)) revert InvalidAddress();
        
        beacon = _beacon;
        evc = IEVC(EVC_ADDRESS);
    }
    
    // ==================== MAIN FUNCTIONS ====================
    
    /**
     * @notice Apre una posizione leverage atomica usando flash loan
     * @param params Parametri per l'apertura (vedi OpenLeverageParams)
     * @return result Risultato dell'operazione
     * 
     * @dev Flusso:
     * 1. Calcola quanto prendere in prestito per raggiungere leverage target
     * 2. Flash loan del borrow token
     * 3. In callback: deposit collateral, enable as collateral, borrow, swap, repay flash loan
     * 4. Verifica health factor finale
     */
    function openLeverageWithFlashLoan(
        OpenLeverageParams calldata params
    ) external nonReentrant returns (LeverageResult memory result) {
        // Validate deadline
        if (block.timestamp > params.deadline) revert DeadlineExpired();
        
        // Validate leverage (min 1.1x, max 5x)
        if (params.targetLeverageX100 < 110 || params.targetLeverageX100 > 500) {
            revert InvalidLeverage();
        }
        
        // Resolve vaults
        address collateralVault = _getVault(params.collateralToken);
        address borrowVault = _getVault(params.borrowToken);
        
        // Get underlying tokens
        address collateralToken = IEVault(collateralVault).asset();
        address borrowToken = IEVault(borrowVault).asset();
        
        // Transfer initial collateral from user
        IERC20(collateralToken).safeTransferFrom(
            msg.sender,
            address(this),
            params.collateralAmount
        );
        
        // Calculate flash loan amount
        // For 2x leverage: need to borrow collateralAmount worth of borrow token
        // For 3x leverage: need to borrow 2 * collateralAmount worth, etc.
        uint256 leverageMultiplier = params.targetLeverageX100 - 100; // e.g., 200 - 100 = 100 (1x additional)
        uint256 flashLoanAmount = _calculateFlashLoanAmount(
            collateralToken,
            borrowToken,
            params.collateralAmount,
            leverageMultiplier
        );
        
        // Store context for callback
        _context = FlashLoanContext({
            user: msg.sender,
            operation: OperationType.OPEN_LEVERAGE,
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            targetLeverageX100: params.targetLeverageX100,
            initialCollateral: params.collateralAmount,
            minHealthFactor: params.minHealthFactor > 0 ? params.minHealthFactor : MIN_HEALTH_FACTOR
        });
        
        // Execute flash loan
        _inFlashLoan = true;
        
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = IERC20(borrowToken);
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashLoanAmount;
        
        IBalancerVault(BALANCER_VAULT).flashLoan(
            IFlashLoanRecipient(address(this)),
            tokens,
            amounts,
            ""  // userData not needed, we use storage
        );
        
        _inFlashLoan = false;
        
        // Get final position state
        result = _getPositionState(collateralVault, borrowVault);
        
        // Verify health factor
        if (result.healthFactor < _context.minHealthFactor) {
            revert HealthFactorTooLow(result.healthFactor, _context.minHealthFactor);
        }
        
        emit LeverageOpened(
            msg.sender,
            collateralVault,
            borrowVault,
            params.collateralAmount,
            result.totalCollateral,
            result.totalDebt,
            result.healthFactor,
            params.targetLeverageX100
        );
        
        // Clear context
        delete _context;
        
        result.success = true;
        return result;
    }
    
    /**
     * @notice Chiude una posizione leverage atomica usando flash loan
     * @param params Parametri per la chiusura (vedi CloseLeverageParams)
     * @return collateralReturned Collaterale restituito all'utente
     * 
     * @dev Flusso:
     * 1. Ottieni debito totale
     * 2. Flash loan del borrow token per ripagare debito
     * 3. In callback: repay debt, withdraw collateral, swap to repay flash loan
     * 4. Restituisci collaterale rimanente all'utente
     */
    function closeLeverageWithFlashLoan(
        CloseLeverageParams calldata params
    ) external nonReentrant returns (uint256 collateralReturned) {
        // Validate deadline
        if (block.timestamp > params.deadline) revert DeadlineExpired();
        
        // Resolve vaults
        address collateralVault = _getVault(params.collateralToken);
        address borrowVault = _getVault(params.borrowToken);
        
        // Get underlying tokens
        address borrowToken = IEVault(borrowVault).asset();
        
        // Get current debt
        uint256 currentDebt = IEVault(borrowVault).debtOf(address(this));
        
        if (currentDebt == 0) {
            // No debt, just withdraw collateral
            return _withdrawAllCollateral(collateralVault, msg.sender);
        }
        
        // Store context for callback
        _context = FlashLoanContext({
            user: msg.sender,
            operation: OperationType.CLOSE_LEVERAGE,
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            targetLeverageX100: 0,
            initialCollateral: 0,
            minHealthFactor: 0
        });
        
        // Flash loan to repay debt (add 1% buffer for interest accrual and safety)
        uint256 flashLoanAmount = currentDebt * 101 / 100;
        
        // Execute flash loan
        _inFlashLoan = true;
        
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = IERC20(borrowToken);
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashLoanAmount;
        
        IBalancerVault(BALANCER_VAULT).flashLoan(
            IFlashLoanRecipient(address(this)),
            tokens,
            amounts,
            ""
        );
        
        _inFlashLoan = false;
        
        // Get collateral token
        address collateralToken = IEVault(collateralVault).asset();
        collateralReturned = IERC20(collateralToken).balanceOf(address(this));
        
        // Return collateral to user
        if (collateralReturned > 0) {
            IERC20(collateralToken).safeTransfer(msg.sender, collateralReturned);
        }
        
        emit LeverageClosed(
            msg.sender,
            collateralVault,
            borrowVault,
            collateralReturned,
            currentDebt,
            0  // Profit calculation can be added
        );
        
        // Clear context
        delete _context;
        
        return collateralReturned;
    }
    
    // ==================== FLASH LOAN CALLBACK ====================
    
    /**
     * @notice Callback da Balancer Vault durante flash loan
     * @param tokens Array di token presi in prestito
     * @param amounts Array di importi presi in prestito
     * @param feeAmounts Array di fee (sempre 0 per Balancer V2!)
     * @param userData Dati arbitrari (non usati, usiamo storage)
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
        if (msg.sender != BALANCER_VAULT) revert UnauthorizedCallback();
        if (!_inFlashLoan) revert UnauthorizedCallback();
        
        // Suppress unused variable warning
        (userData);
        
        // Route to appropriate handler
        if (_context.operation == OperationType.OPEN_LEVERAGE) {
            _executeOpenLeverage(tokens[0], amounts[0], feeAmounts[0]);
        } else if (_context.operation == OperationType.CLOSE_LEVERAGE) {
            _executeCloseLeverage(tokens[0], amounts[0], feeAmounts[0]);
        }
        
        // Repay flash loan (Balancer will revert if not repaid)
        uint256 repayAmount = amounts[0] + feeAmounts[0];
        uint256 balance = tokens[0].balanceOf(address(this));
        
        if (balance < repayAmount) {
            revert InsufficientRepayment(repayAmount, balance);
        }
        
        // Transfer repayment to Vault
        tokens[0].safeTransfer(BALANCER_VAULT, repayAmount);
        
        emit FlashLoanExecuted(address(tokens[0]), amounts[0], _context.operation);
    }
    
    // ==================== INTERNAL: OPEN LEVERAGE ====================
    
    /**
     * @notice Esegue logica di apertura leverage nel callback
     * @param borrowToken Token preso in prestito (flash loan)
     * @param flashLoanAmount Importo del flash loan
     * @param feeAmount Fee del flash loan (0 per Balancer)
     */
    function _executeOpenLeverage(
        IERC20 borrowToken,
        uint256 flashLoanAmount,
        uint256 feeAmount
    ) internal {
        // Suppress unused variable warning
        (feeAmount);
        
        FlashLoanContext memory ctx = _context;
        address collateralToken = IEVault(ctx.collateralVault).asset();
        
        // Step 1: Swap borrowed tokens to collateral (USDC → WETH)
        // We received flashLoanAmount of borrowToken, need to swap to collateral
        IERC20(address(borrowToken)).safeIncreaseAllowance(SIMPLE_SWAP, flashLoanAmount);
        
        uint256 collateralFromSwap = ISimpleSwap(SIMPLE_SWAP).inputSwap(
            address(borrowToken),
            collateralToken,
            flashLoanAmount
        );
        
        if (collateralFromSwap == 0) revert SwapFailed();
        
        // Step 2: Deposit ALL collateral (initial + from swap) into Euler
        uint256 totalCollateral = ctx.initialCollateral + collateralFromSwap;
        IERC20(collateralToken).safeIncreaseAllowance(ctx.collateralVault, totalCollateral);
        IEVault(ctx.collateralVault).deposit(totalCollateral, address(this));
        
        // Step 3: Enable collateral vault as collateral in EVC
        evc.enableCollateral(address(this), ctx.collateralVault);
        
        // Step 4: Enable borrow vault as controller in EVC
        evc.enableController(address(this), ctx.borrowVault);
        
        // Step 5: Borrow from Euler to repay flash loan
        // Need to borrow enough to repay the flash loan
        IEVault(ctx.borrowVault).borrow(flashLoanAmount, address(this));
        
        // borrowToken is now in this contract, ready to repay flash loan
    }
    
    // ==================== INTERNAL: CLOSE LEVERAGE ====================
    
    /**
     * @notice Esegue logica di chiusura leverage nel callback
     * @param borrowToken Token preso in prestito (flash loan)
     * @param flashLoanAmount Importo del flash loan
     * @param feeAmount Fee del flash loan (0 per Balancer)
     */
    function _executeCloseLeverage(
        IERC20 borrowToken,
        uint256 flashLoanAmount,
        uint256 feeAmount
    ) internal {
        // Suppress unused variable warning
        (feeAmount);
        
        FlashLoanContext memory ctx = _context;
        address collateralToken = IEVault(ctx.collateralVault).asset();
        address borrowTokenAddr = address(borrowToken);
        
        // Check we received the flash loan
        uint256 flashLoanBalance = IERC20(borrowTokenAddr).balanceOf(address(this));
        require(flashLoanBalance >= flashLoanAmount, "FL: Flash loan not received");
        
        // Step 1: Repay all debt on Euler
        uint256 debt = IEVault(ctx.borrowVault).debtOf(address(this));
        require(debt > 0, "FL: No debt to repay");
        require(flashLoanBalance >= debt, "FL: Insufficient USDC for repay");
        
        IERC20(borrowTokenAddr).safeIncreaseAllowance(ctx.borrowVault, debt);
        IEVault(ctx.borrowVault).repay(debt, address(this));
        
        // Verify debt is now 0
        uint256 debtAfter = IEVault(ctx.borrowVault).debtOf(address(this));
        require(debtAfter == 0, "FL: Debt not fully repaid");
        
        // Step 2: Disable controller via vault (correct pattern: vault calls evc.disableController)
        IEVault(ctx.borrowVault).disableController();
        
        // Step 3: Withdraw all collateral from Euler
        uint256 shares = IEVault(ctx.collateralVault).balanceOf(address(this));
        require(shares > 0, "FL: No shares to redeem");
        IEVault(ctx.collateralVault).redeem(shares, address(this), address(this));
        
        // Verify we got the collateral
        uint256 collateralBalance = IERC20(collateralToken).balanceOf(address(this));
        require(collateralBalance > 0, "FL: No collateral received");
        
        // Step 4: Disable collateral
        evc.disableCollateral(address(this), ctx.collateralVault);
        
        // Step 5: Swap collateral to repay flash loan (WETH → USDC)
        // Calculate how much collateral we need to swap
        uint256 collateralToSwap = _estimateCollateralForFlashLoan(
            collateralToken, 
            borrowTokenAddr, 
            flashLoanAmount
        );
        
        // Ensure we don't swap more than we have
        if (collateralToSwap > collateralBalance) {
            collateralToSwap = collateralBalance;
        }
        
        // Swap collateral using inputSwap
        IERC20(collateralToken).safeIncreaseAllowance(SIMPLE_SWAP, collateralToSwap);
        uint256 usdcReceived = ISimpleSwap(SIMPLE_SWAP).inputSwap(
            collateralToken,
            borrowTokenAddr,
            collateralToSwap
        );
        
        require(usdcReceived >= flashLoanAmount, "FL: Insufficient USDC from swap");
        
        // Remaining collateral will be returned to user after callback
    }
    
    // ==================== INTERNAL HELPERS ====================
    
    /**
     * @notice Calcola quanto flash loan serve per raggiungere il leverage target
     * @param collateralToken Indirizzo token collaterale
     * @param borrowToken Indirizzo token da borroware
     * @param collateralAmount Collaterale iniziale
     * @param leverageMultiplier Moltiplicatore - 100 (e.g., 100 per 2x)
     * @return Importo flash loan necessario
     */
    function _calculateFlashLoanAmount(
        address collateralToken,
        address borrowToken,
        uint256 collateralAmount,
        uint256 leverageMultiplier
    ) internal view returns (uint256) {
        uint8 collateralDecimals = _getDecimals(collateralToken);
        uint8 borrowDecimals = _getDecimals(borrowToken);
        
        // Try to get quote from SimpleSwap
        try ISimpleSwap(SIMPLE_SWAP).getExpectedOutput(
            collateralToken,
            borrowToken,
            collateralAmount,
            collateralDecimals,
            borrowDecimals
        ) returns (uint256 collateralInBorrowTerms) {
            // Flash loan amount = collateralValue * (leverageMultiplier / 100)
            return collateralInBorrowTerms * leverageMultiplier / 100;
        } catch {
            // Fallback: Use approximate price (1 ETH ≈ 3000 USDC)
            // This is just for estimation, actual swap will use real price
            if (collateralToken == WETH && borrowToken == USDC) {
                // WETH to USDC: multiply by ~3000 and adjust decimals
                uint256 collateralInUSDC = collateralAmount * 3000 / (10 ** (18 - 6));
                return collateralInUSDC * leverageMultiplier / 100;
            } else if (collateralToken == USDC && borrowToken == WETH) {
                // USDC to WETH: divide by ~3000 and adjust decimals
                uint256 collateralInWETH = collateralAmount * (10 ** (18 - 6)) / 3000;
                return collateralInWETH * leverageMultiplier / 100;
            }
            
            // Generic fallback for same-decimal tokens
            return collateralAmount * leverageMultiplier / 100;
        }
    }
    
    /**
     * @notice Stima quanto collaterale serve per ripagare il flash loan
     * @param collateralToken Token collaterale (da vendere)
     * @param borrowToken Token da comprare (per ripagare flash loan)
     * @param flashLoanAmount Importo flash loan da ripagare
     * @return Collaterale necessario (con 5% buffer per slippage)
     */
    function _estimateCollateralForFlashLoan(
        address collateralToken,
        address borrowToken,
        uint256 flashLoanAmount
    ) internal view returns (uint256) {
        // Try to get quote from SimpleSwap
        try ISimpleSwap(SIMPLE_SWAP).getExpectedOutput(
            borrowToken,
            collateralToken,
            flashLoanAmount,
            _getDecimals(borrowToken),
            _getDecimals(collateralToken)
        ) returns (uint256 collateralNeeded) {
            // Add 5% buffer for slippage
            return collateralNeeded * 105 / 100;
        } catch {
            // Fallback: Use approximate price (1 ETH ≈ 3000 USDC)
            if (collateralToken == WETH && borrowToken == USDC) {
                // Need to swap WETH to get USDC
                // flashLoanAmount USDC / 3000 = WETH needed
                uint256 collateralNeeded = flashLoanAmount * (10 ** (18 - 6)) / 3000;
                // Add 5% buffer
                return collateralNeeded * 105 / 100;
            }
            
            // Can't estimate - return max (will be capped to balance)
            return type(uint256).max;
        }
    }
    
    /**
     * @notice Ottiene i decimali di un token
     */
    function _getDecimals(address token) internal view returns (uint8) {
        // WETH = 18, USDC = 6
        if (token == WETH) return 18;
        if (token == USDC) return 6;
        
        // Fallback: try to call decimals()
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        if (success && data.length >= 32) {
            return abi.decode(data, (uint8));
        }
        
        return 18; // Default
    }
    
    /**
     * @notice Ottiene lo stato corrente della posizione
     */
    function _getPositionState(
        address collateralVault,
        address borrowVault
    ) internal view returns (LeverageResult memory result) {
        // Get collateral value
        uint256 shares = IEVault(collateralVault).balanceOf(address(this));
        result.totalCollateral = IEVault(collateralVault).convertToAssets(shares);
        
        // Get debt
        result.totalDebt = IEVault(borrowVault).debtOf(address(this));
        
        // Calculate health factor using AccountLens
        // Use getAccountLiquidityInfo instead of getAccountInfo for direct access
        IAccountLens.AccountLiquidityInfo memory liquidityInfo = IAccountLens(ACCOUNT_LENS).getAccountLiquidityInfo(
            address(this),
            borrowVault
        );
        
        // Health factor = collateralValueBorrowing / liabilityValueBorrowing
        if (liquidityInfo.liabilityValueBorrowing > 0) {
            result.healthFactor = liquidityInfo.collateralValueBorrowing * 1e18 / liquidityInfo.liabilityValueBorrowing;
        } else {
            result.healthFactor = type(uint256).max; // No debt = infinite health
        }
        
        result.success = true;
        return result;
    }
    
    /**
     * @notice Preleva tutto il collaterale e lo invia a un destinatario
     */
    function _withdrawAllCollateral(
        address collateralVault,
        address recipient
    ) internal returns (uint256) {
        address collateralToken = IEVault(collateralVault).asset();
        uint256 shares = IEVault(collateralVault).balanceOf(address(this));
        
        if (shares == 0) return 0;
        
        uint256 assets = IEVault(collateralVault).redeem(shares, address(this), address(this));
        IERC20(collateralToken).safeTransfer(recipient, assets);
        
        return assets;
    }
    
    /**
     * @notice Risolve un vault da tokenCode
     * @dev Prima controlla i vault hardcoded, poi fallback a registry
     */
    function _getVault(string memory tokenCode) internal view returns (address) {
        // Hardcoded vaults for common tokens
        bytes32 tokenHash = keccak256(bytes(tokenCode));
        if (tokenHash == keccak256(bytes("WETH"))) {
            return WETH_VAULT;
        }
        if (tokenHash == keccak256(bytes("USDC"))) {
            return USDC_VAULT;
        }
        
        // Fallback to registry if available
        try IBeacon(beacon).getImplementation("EulerVaultRegistry") returns (address registry) {
            if (registry != address(0)) {
                address vault = IEulerVaultRegistry(registry).getVaultSafe(tokenCode);
                if (vault != address(0)) return vault;
            }
        } catch {}
        
        revert VaultNotFound(tokenCode);
    }
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @notice Ottiene il leverage corrente della posizione
     * @param collateralToken Token collaterale
     * @param borrowToken Token borrowato
     * @return leverageX100 Leverage * 100 (e.g., 200 = 2x)
     */
    function getCurrentLeverage(
        string calldata collateralToken,
        string calldata borrowToken
    ) external view returns (uint256 leverageX100) {
        address collateralVault = _getVault(collateralToken);
        address borrowVault = _getVault(borrowToken);
        
        LeverageResult memory state = _getPositionState(collateralVault, borrowVault);
        
        if (state.totalCollateral == 0) return 0;
        if (state.totalDebt == 0) return 100; // No debt = 1x leverage
        
        // Leverage = totalCollateral / (totalCollateral - totalDebtInCollateralTerms)
        // Convert debt to collateral terms
        address collateralTokenAddr = IEVault(collateralVault).asset();
        address borrowTokenAddr = IEVault(borrowVault).asset();
        
        uint256 debtInCollateralTerms;
        
        // Try to get quote from SimpleSwap
        try ISimpleSwap(SIMPLE_SWAP).getExpectedOutput(
            borrowTokenAddr,
            collateralTokenAddr,
            state.totalDebt,
            _getDecimals(borrowTokenAddr),
            _getDecimals(collateralTokenAddr)
        ) returns (uint256 result) {
            debtInCollateralTerms = result;
        } catch {
            // Fallback: estimate based on approximate price
            if (borrowTokenAddr == USDC && collateralTokenAddr == WETH) {
                // USDC to WETH: divide by ~3000
                debtInCollateralTerms = state.totalDebt * (10 ** (18 - 6)) / 3000;
            } else {
                // Can't calculate
                return 0;
            }
        }
        
        uint256 equity = state.totalCollateral > debtInCollateralTerms 
            ? state.totalCollateral - debtInCollateralTerms 
            : 0;
            
        if (equity == 0) return 0;
        
        leverageX100 = state.totalCollateral * 100 / equity;
        return leverageX100;
    }
    
    /**
     * @notice Simula l'apertura di una posizione per stimare i risultati
     * @param collateralAmount Importo collaterale
     * @param targetLeverageX100 Leverage target * 100
     * @param collateralToken Token collaterale
     * @param borrowToken Token da borroware
     * @return flashLoanNeeded Importo flash loan necessario
     * @return expectedCollateral Collaterale totale atteso
     * @return expectedDebt Debito atteso
     */
    function simulateOpenLeverage(
        uint256 collateralAmount,
        uint256 targetLeverageX100,
        string calldata collateralToken,
        string calldata borrowToken
    ) external view returns (
        uint256 flashLoanNeeded,
        uint256 expectedCollateral,
        uint256 expectedDebt
    ) {
        address collateralVault = _getVault(collateralToken);
        address borrowVault = _getVault(borrowToken);
        
        address collateralTokenAddr = IEVault(collateralVault).asset();
        address borrowTokenAddr = IEVault(borrowVault).asset();
        
        uint256 leverageMultiplier = targetLeverageX100 - 100;
        
        flashLoanNeeded = _calculateFlashLoanAmount(
            collateralTokenAddr,
            borrowTokenAddr,
            collateralAmount,
            leverageMultiplier
        );
        
        // Expected collateral = initial + what we get from swapping flash loan
        // Try to get expected output from SimpleSwap
        try ISimpleSwap(SIMPLE_SWAP).getExpectedOutput(
            borrowTokenAddr,
            collateralTokenAddr,
            flashLoanNeeded,
            _getDecimals(borrowTokenAddr),
            _getDecimals(collateralTokenAddr)
        ) returns (uint256 collateralFromSwap) {
            expectedCollateral = collateralAmount + collateralFromSwap;
        } catch {
            // Fallback: estimate based on approximate price
            if (borrowTokenAddr == USDC && collateralTokenAddr == WETH) {
                // USDC to WETH: divide by ~3000
                uint256 collateralFromSwap = flashLoanNeeded * (10 ** (18 - 6)) / 3000;
                expectedCollateral = collateralAmount + collateralFromSwap;
            } else {
                // Generic fallback
                expectedCollateral = collateralAmount * targetLeverageX100 / 100;
            }
        }
        
        expectedDebt = flashLoanNeeded; // We borrow exactly what we flash loaned
        
        return (flashLoanNeeded, expectedCollateral, expectedDebt);
    }
    
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @notice Recupera token bloccati in emergenza
     * @param token Indirizzo token
     * @param amount Importo
     * @param recipient Destinatario
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner {
        IERC20(token).safeTransfer(recipient, amount);
    }
}
