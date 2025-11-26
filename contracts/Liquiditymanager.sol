// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ILiquidityManager.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/IProxyGeneral.sol";
import "./interfaces/ITokenManagerForModules.sol";
import "./interfaces/IValueCalculatorForModules.sol";
import "./interfaces/ISwapManagerForModules.sol";
import "./interfaces/IParameterManagerForModules.sol";
import "./interfaces/IWETH.sol";

/**
 * @title LiquidityManager
 * @dev Gestisce deposit/withdraw con validazioni complete e automatic swap
 * @custom:security-contact security@yourdomain.com
 */
contract LiquidityManager is ILiquidityManager, ReentrancyGuard, Ownable {
    
    // ==================== STRUCTS ====================
    
    struct WithdrawValidation {
        uint256 shares;
        uint256 ethAmount;
        uint256 totalSupply;
        uint256 totalValue;
        uint256 poolEthBalance;
        uint256 userBalance;
        bool requiresSwap;
        uint256 wethNeeded;
    }

    struct PoolReserveCheck {
        uint256 currentReserveRatio;
        uint256 postWithdrawBalance;
        uint256 postWithdrawValue;
        uint256 postWithdrawRatio;
        bool reserveValid;
    }

    // ==================== STORAGE ====================

    /// @notice Beacon address per resolution moduli
    address public immutable beacon;

    /// @notice Tracking ultimo reset limite orario
    uint256 private lastHourlyReset;
    
    /// @notice Amount prelevato nell'ora corrente
    uint256 private hourlyWithdrawnAmount;

    /// @notice Contract pause state
    bool public paused;
    
    // ==================== FEE SYSTEM ====================
    
    /// @notice Fee structure (basis points, 10000 = 100%)
    uint256 public depositFee;        // Basis points for deposit fee
    uint256 public withdrawFee;       // Basis points for withdraw fee
    uint256 public constant MAX_FEE = 500; // 5% maximum fee
    address public feeRecipient;      // Address to receive fees
    
    /// @notice Enabled/disabled controls
    bool public depositsEnabled = true;
    bool public withdrawsEnabled = true;
    
    /// @notice Withdraw limits structure
    WithdrawLimits public withdrawLimits;

    // ==================== MODIFIERS ====================

    modifier whenNotPaused() {
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        require(!IProxyGeneral(proxyGeneral).paused(), "Contract is paused");
        _;
    }

    modifier whenDepositsEnabled() {
        require(depositsEnabled, "Deposits are disabled");
        _;
    }

    modifier whenWithdrawsEnabled() {
        require(withdrawsEnabled, "Withdrawals are disabled");
        _;
    }

    // Withdraw limits sono gestiti tramite checkWithdrawLimits() e ProxyGeneral rate limiting

    // ==================== CONSTRUCTOR ====================

    constructor(address _beacon) Ownable() {
        require(_beacon != address(0), "Invalid beacon address");
        beacon = _beacon;
        lastHourlyReset = block.timestamp;
        
        // Initialize default withdraw limits
        withdrawLimits = WithdrawLimits({
            hourlyLimit: 100 ether,    // 100 ETH per hour default
            dailyLimit: 1000 ether,    // 1000 ETH per day default
            minWithdraw: 0.000001 ether,  // 1 Wei minimum
            maxWithdraw: 50 ether      // 50 ETH per transaction default
        });
    }

    // ==================== DEPOSIT FUNCTION ====================

    /**
     * @notice Deposita ETH nel pool e riceve LP tokens in rapporto 1:1
     * @dev Validazioni complete secondo functional specifications
     * @return lpTokens Numero di LP tokens ricevuti
     */
    function deposit() external payable nonReentrant whenNotPaused whenDepositsEnabled returns (uint256 lpTokens) {
        // GET PARAMETER VALUES
        address paramManager = IBeacon(beacon).getImplementation("ParameterManager");
        IParameterManagerForModules params = IParameterManagerForModules(paramManager);
        
        uint256 minDeposit = params.getCurrentParameterValue("minDeposit");
        uint256 maxDeposit = params.getCurrentParameterValue("maxDeposit");
        
        // INITIAL VALIDATIONS
        require(msg.value >= minDeposit, "Below minimum deposit");
        require(msg.value <= maxDeposit, "Exceeds maximum deposit");
        
        // CALCULATE FEE
        uint256 feeAmount = (msg.value * depositFee) / 10000;
        uint256 netDeposit = msg.value - feeAmount;
        
        // CHECK RATE LIMITING 
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        
        (bool rateLimitOk, , ) = proxy.checkRateLimit(msg.sender, "deposit", msg.value);
        require(rateLimitOk, "Rate limit exceeded for deposit operation");
        
        // TRACK OPERATION FOR RATE LIMITING
        proxy.trackOperation(msg.sender, "deposit", msg.value);
        
        // GET CONTRACT REFERENCES
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        IWETH weth = IWETH(wethAddress);
        
        // CAPTURE PRE-DEPOSIT STATE
        uint256 preDepositWethBalance = IERC20(wethAddress).balanceOf(proxyGeneral);
        uint256 preDepositSupply = proxy.totalSupply();
        
        // SHARES CALCULATION - PROPORTIONAL TO POOL VALUE
        // Formula: shares = (netDeposit * totalSupply) / totalPoolValue
        // Bootstrap (first deposit): shares = netDeposit (1:1 ratio)
        uint256 shares;
        
        if (preDepositSupply == 0) {
            // Bootstrap deposit: 1:1 ratio
            shares = netDeposit;
        } else {
            // Subsequent deposits: proportional to pool value
            address valueCalculatorAddr = IBeacon(beacon).getImplementation("ValueCalculator");
            IValueCalculatorForModules calculator = IValueCalculatorForModules(valueCalculatorAddr);
            
            uint256 totalValue = calculator.getTotalPoolValueView();
            require(totalValue > 0, "Invalid pool state");
            
            // Calculate proportional shares
            shares = (netDeposit * preDepositSupply) / totalValue;
            
            require(shares > 0, "Deposit too small for current pool size");
        }
        
        require(shares > 0, "No shares to mint");
        
        // WRAP NET DEPOSIT TO WETH AND TRANSFER TO PROXY
        weth.deposit{value: netDeposit}();
        require(weth.transfer(proxyGeneral, netDeposit), "WETH transfer failed");
        
        // TRANSFER FEE TO RECIPIENT IF APPLICABLE
        if (feeAmount > 0 && feeRecipient != address(0)) {
            (bool success, ) = feeRecipient.call{value: feeAmount}("");
            require(success, "Fee transfer failed");
        }
        
        // MINT LP TOKENS
        proxy.mint(msg.sender, shares);
        
        // POST-DEPOSIT VALIDATIONS
        require(
            proxy.totalSupply() == preDepositSupply + shares,
            "Invalid supply change"
        );
        require(
            IERC20(wethAddress).balanceOf(proxyGeneral) == preDepositWethBalance + netDeposit,
            "Invalid WETH balance change"
        );
        
        emit Deposit(
            msg.sender,
            msg.value,
            shares,
            IERC20(wethAddress).balanceOf(proxyGeneral),
            proxy.totalSupply()
        );
        
        return shares;
    }

    // ==================== WITHDRAW FUNCTION ====================

    /**
     * @notice Preleva ETH dal pool bruciando LP tokens (LEGACY con deadline automatico)
     * @dev Usa default deadline di 20 minuti per backward compatibility
     * @param _shares Numero di LP tokens da bruciare
     * @return ethAmount ETH effettivamente prelevato
     */
    function withdraw(uint256 _shares) external nonReentrant whenNotPaused whenWithdrawsEnabled returns (uint256 ethAmount) {
        // Calcola deadline automatico (20 minuti)
        uint256 deadline = block.timestamp + 20 minutes;
        
        // Delega a versione con deadline
        return _withdrawInternal(_shares, deadline);
    }
    
    /**
     * @notice Preleva ETH dal pool con deadline esplicito (MEV protected)
     * @dev Fornisce protezione MEV per swap automatici durante withdraw
     * @param _shares Numero di LP tokens da bruciare
     * @param deadline Timestamp massimo per completare operazione (inclusi swap)
     * @return ethAmount ETH effettivamente prelevato
     */
    function withdrawWithDeadline(uint256 _shares, uint256 deadline) external nonReentrant whenNotPaused whenWithdrawsEnabled returns (uint256 ethAmount) {
        // DEADLINE PRE-CHECK (fail fast)
        require(block.timestamp <= deadline, "Withdraw deadline expired");
        
        // Delega a funzione interna
        return _withdrawInternal(_shares, deadline);
    }

    /**
     * @notice Core withdraw logic (INTERNAL)
     * @dev Con automatic swap se WETH insufficiente + validazioni complete
     * @param _shares Numero di LP tokens da bruciare
     * @param deadline Timestamp massimo per swap (se necessario)
     * @return ethAmount ETH effettivamente prelevato
     */
    function _withdrawInternal(uint256 _shares, uint256 deadline) internal returns (uint256 ethAmount) {
        // STORE START TIME FOR DURATION TRACKING
        uint256 startTime = block.timestamp;
        uint256 timeRemaining = deadline - block.timestamp;
        
        // INITIAL VALIDATION
        require(_shares > 0, "Invalid shares amount");
        
        // GET PARAMETER VALUES  
        address paramManager = IBeacon(beacon).getImplementation("ParameterManager");
        IParameterManagerForModules params = IParameterManagerForModules(paramManager);
        
        uint256 poolReserveRatio = params.getCurrentParameterValue("poolReserveRatio");
        
        // GET CONTRACT REFERENCES
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        address valueCalculator = IBeacon(beacon).getImplementation("ValueCalculator");
        
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        IValueCalculatorForModules calculator = IValueCalculatorForModules(valueCalculator);
        
        // VALIDATE USER BALANCE
        require(proxy.balanceOf(msg.sender) >= _shares, "Insufficient balance");
        
        // GET CURRENT POOL STATE
        IValueCalculatorForModules.PoolValueInfo memory poolInfo = calculator.getTotalPoolValue();
        
        WithdrawValidation memory validation = WithdrawValidation({
            shares: _shares,
            ethAmount: 0,
            totalSupply: proxy.totalSupply(),
            totalValue: poolInfo.totalValue,
            poolEthBalance: IERC20(wethAddress).balanceOf(proxyGeneral),
            userBalance: proxy.balanceOf(msg.sender),
            requiresSwap: false,
            wethNeeded: 0
        });
        
        // CALCULATE ETH AMOUNT TO WITHDRAW
        validation.ethAmount = (_shares * validation.totalValue) / validation.totalSupply;
        
        // CHECK WITHDRAW LIMITS
        (bool canWithdrawLimits, string memory limitReason) = checkWithdrawLimits(msg.sender, validation.ethAmount);
        require(canWithdrawLimits, limitReason);
        
        // CALCULATE WITHDRAW FEE
        uint256 feeAmount = (validation.ethAmount * withdrawFee) / 10000;
        uint256 netWithdraw = validation.ethAmount - feeAmount;

        // CHECK RATE LIMITING
        (bool rateLimitOk, , ) = proxy.checkRateLimit(msg.sender, "withdraw", validation.ethAmount);
        require(rateLimitOk, "Rate limit exceeded for withdraw operation");
        
        // TRACK OPERATION FOR RATE LIMITING
        proxy.trackOperation(msg.sender, "withdraw", validation.ethAmount);
        
        // CHECK INITIAL RESERVE RATIO
        PoolReserveCheck memory reserveCheck;
        reserveCheck.currentReserveRatio = (validation.poolEthBalance * 10000) / validation.totalValue;
        require(reserveCheck.currentReserveRatio >= poolReserveRatio, "Insufficient pool reserves");
        
        // EMIT WITHDRAWAL STARTED EVENT
        emit WithdrawalStarted(
            msg.sender,
            _shares,
            deadline,
            deadline - block.timestamp,
            validation.poolEthBalance < netWithdraw
        );
        
        // CHECK DEADLINE CRITICAL (< 3 min remaining)
        if (deadline - block.timestamp < 3 minutes) {
            emit WithdrawalDeadlineCritical(
                msg.sender,
                deadline,
                deadline - block.timestamp,
                "validation"
            );
        }
        
        // CHECK IF SWAP IS REQUIRED (for net withdraw amount)
        if (validation.poolEthBalance < netWithdraw) {
            validation.requiresSwap = true;
            validation.wethNeeded = netWithdraw - validation.poolEthBalance;
            
            // EXECUTE AUTOMATIC SWAP CON DEADLINE PROPAGATION
            // Multi-swap handles slippage tolerance internally
            _executeAutomaticSwap(validation.wethNeeded, calculator, deadline);
            
            // GET ACTUAL WETH BALANCE AFTER ALL SWAPS
            uint256 newWethBalance = IERC20(wethAddress).balanceOf(proxyGeneral);
            
            // Adjust netWithdraw to what we actually have (multi-swap gave us the best possible)
            if (newWethBalance < netWithdraw) {
                netWithdraw = newWethBalance;
            }
            
            // UPDATE poolEthBalance after swap
            validation.poolEthBalance = newWethBalance;
        }
        
        // VALIDATE POST-WITHDRAW RESERVE RATIO
        reserveCheck.postWithdrawBalance = validation.poolEthBalance - netWithdraw;
        reserveCheck.postWithdrawValue = validation.totalValue - netWithdraw;
        
        if (reserveCheck.postWithdrawValue > 0) {
            reserveCheck.postWithdrawRatio = (reserveCheck.postWithdrawBalance * 10000) / reserveCheck.postWithdrawValue;
            require(reserveCheck.postWithdrawRatio >= poolReserveRatio, "Would break reserve ratio");
        }
        
        // HOURLY TRACKING gestito da ProxyGeneral rate limiting
        
        // BURN LP TOKENS
        proxy.burn(msg.sender, _shares);
        
        // GET WETH FROM PROXYGENERAL
        IWETH weth = IWETH(wethAddress);
        
        // TRANSFER WETH TO THIS CONTRACT from ProxyGeneral (netWithdraw + fee if applicable)
        uint256 totalWethNeeded = netWithdraw;
        if (feeAmount > 0 && feeRecipient != address(0)) {
            totalWethNeeded += feeAmount;
        }
        proxy.withdrawToken("WETH", totalWethNeeded, address(this));
        
        // UNWRAP WETH TO ETH (all at once)
        weth.withdraw(totalWethNeeded);
        
        // TRANSFER ETH TO USER
        (bool success, ) = msg.sender.call{value: netWithdraw}("");
        require(success, "ETH transfer failed");
        
        // TRANSFER FEE TO RECIPIENT IF APPLICABLE (in ETH)
        if (feeAmount > 0 && feeRecipient != address(0)) {
            (bool feeSuccess, ) = feeRecipient.call{value: feeAmount}("");
            require(feeSuccess, "Fee transfer failed");
        }
        
        // FINAL VALIDATION
        require(
            proxy.totalSupply() == validation.totalSupply - _shares,
            "Invalid supply change"
        );
        
        // CHECK DEADLINE CRITICAL BEFORE FINAL TRANSFER
        if (deadline - block.timestamp < 3 minutes) {
            emit WithdrawalDeadlineCritical(
                msg.sender,
                deadline,
                deadline - block.timestamp,
                "transfer"
            );
        }
        
        emit Withdrawn(
            msg.sender,
            _shares,
            validation.ethAmount,
            validation.totalValue,
            IERC20(wethAddress).balanceOf(proxyGeneral)
        );
        
        // EMIT WITHDRAWAL COMPLETED EVENT WITH TIMING
        emit WithdrawalCompleted(
            msg.sender,
            _shares,
            netWithdraw,
            deadline,
            block.timestamp - startTime,
            validation.requiresSwap
        );
        
        return netWithdraw;
    }

    /**
     * @notice Esegue automatic swap multipli per ottenere WETH necessario
     * @dev Loop intelligente con slippage tolerance - swappa token finché target raggiunto
     * @param wethNeeded Quantità di WETH necessaria
     * @param calculator Reference al ValueCalculator
     * @param deadline Timestamp massimo per swap
     */
    function _executeAutomaticSwap(
        uint256 wethNeeded, 
        IValueCalculatorForModules calculator,
        uint256 deadline
    ) internal {
        uint256 wethStillNeeded = wethNeeded;
        uint256 maxIterations = 10; // Safety limit
        uint256 iteration = 0;
        uint256 totalWethObtained = 0;
        
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        address swapManager = IBeacon(beacon).getImplementation("SwapManager");
        ISwapManagerForModules swapper = ISwapManagerForModules(swapManager);
        
        emit MultiSwapStarted(msg.sender, wethNeeded, maxIterations);
        
        while (wethStillNeeded > 0 && iteration < maxIterations) {
            iteration++;
            
            // Check current WETH balance in ProxyGeneral
            uint256 currentWeth = IERC20(wethAddress).balanceOf(proxyGeneral);
            
            // If current balance is enough for our original target, stop
            if (currentWeth >= wethNeeded) {
                emit MultiSwapCompleted(msg.sender, iteration - 1, totalWethObtained);
                return;
            }
            
            // Check deadline critical
            uint256 timeRemaining = deadline - block.timestamp;
            if (timeRemaining < 3 minutes) {
                emit WithdrawalDeadlineCritical(
                    msg.sender,
                    deadline,
                    timeRemaining,
                    "multi-swap"
                );
            }
            
            // Select next token to swap
            (string memory tokenToSwap, uint256 amountToSwap) = calculator.selectTokenForSwap(wethStillNeeded);
            
            // No more tokens available
            if (bytes(tokenToSwap).length == 0 || amountToSwap == 0) {
                // Check if we have at least 97% of target (slippage tolerance)
                uint256 minAcceptable = (wethNeeded * 97) / 100;
                if (totalWethObtained >= minAcceptable) {
                    emit MultiSwapCompleted(msg.sender, iteration - 1, totalWethObtained);
                    return;
                }
                
                revert("Insufficient total liquidity across all available tokens");
            }
            
            // Emit swap trigger for this iteration
            emit AutomaticSwapTriggered(
                msg.sender,
                tokenToSwap,
                amountToSwap,
                wethStillNeeded,
                deadline,
                timeRemaining
            );
            
            // Validate swap parameters
            (bool isValid, string memory errorReason) = swapper.validateSwapParameters(
                tokenToSwap,
                "WETH",
                amountToSwap
            );
            require(isValid, string(abi.encodePacked("Swap validation failed: ", errorReason)));
            
            // Execute swap
            uint256 receivedWeth = swapper.performSwap(tokenToSwap, "WETH", amountToSwap, deadline);
            require(receivedWeth > 0, "Swap returned zero WETH");
            
            // Update counters
            totalWethObtained += receivedWeth;
            
            if (receivedWeth >= wethStillNeeded) {
                wethStillNeeded = 0;
            } else {
                wethStillNeeded -= receivedWeth;
            }
            
            // Emit events for this iteration
            emit MultiSwapIteration(
                msg.sender,
                iteration,
                tokenToSwap,
                amountToSwap,
                receivedWeth,
                wethStillNeeded
            );
            emit TokenSwappedForWithdraw(tokenToSwap, amountToSwap, receivedWeth);
        }
        
        // Final check
        require(wethStillNeeded == 0, "Could not obtain enough WETH after multiple swaps");
        emit MultiSwapCompleted(msg.sender, iteration, totalWethObtained);
    }

    // ==================== VIEW FUNCTIONS ====================

    // ==================== FEE MANAGEMENT FUNCTIONS ====================

    /**
     * @notice Imposta fee per deposit
     * @param newFee Nuova fee in basis points
     */
    function setDepositFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_FEE, "Fee exceeds maximum");
        
        uint256 oldFee = depositFee;
        depositFee = newFee;
        
        emit DepositFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Imposta fee per withdraw
     * @param newFee Nuova fee in basis points
     */
    function setWithdrawFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_FEE, "Fee exceeds maximum");
        
        uint256 oldFee = withdrawFee;
        withdrawFee = newFee;
        
        emit WithdrawFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Imposta recipient per fee
     * @param newRecipient Nuovo indirizzo recipient
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    /**
     * @notice Abilita/disabilita deposits
     * @param enabled Stato enabled
     */
    function setDepositsEnabled(bool enabled) external onlyOwner {
        depositsEnabled = enabled;
        emit DepositsEnabledChanged(enabled);
    }

    /**
     * @notice Abilita/disabilita withdrawals
     * @param enabled Stato enabled
     */
    function setWithdrawsEnabled(bool enabled) external onlyOwner {
        withdrawsEnabled = enabled;
        emit WithdrawsEnabledChanged(enabled);
    }

    // ==================== WITHDRAW LIMITS MANAGEMENT ====================

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
    ) external onlyOwner {
        require(minWithdraw <= maxWithdraw, "Invalid min/max range");
        require(hourlyLimit <= dailyLimit, "Hourly limit exceeds daily limit");
        require(maxWithdraw <= hourlyLimit, "Max withdraw exceeds hourly limit");
        
        withdrawLimits.hourlyLimit = hourlyLimit;
        withdrawLimits.dailyLimit = dailyLimit;
        withdrawLimits.minWithdraw = minWithdraw;
        withdrawLimits.maxWithdraw = maxWithdraw;
        
        emit WithdrawLimitsUpdated(hourlyLimit, dailyLimit, minWithdraw, maxWithdraw);
    }

    /**
     * @notice Controlla se un withdraw è permesso dai limiti
     * @dev Implementa accumulo reale degli ultimi 24h invece di semplice validazione (Issue #2 FIX)
     * @param user Indirizzo utente
     * @param amount Quantità da prelevare (in ETH wei)
     * @return allowed Se può prelevare
     * @return reason Motivo se non può
     * 
     * @custom:logic-flow
     * 1. CHECK MIN/MAX per transazione
     * 2. Calcola current hour = block.timestamp / 3600
     * 3. Accumula hourly usage (current hour only)
     * 4. Loop ultimi 24 ore per daily usage
     * 5. Valida: hourly + amount <= hourlyLimit && daily + amount <= dailyLimit
     */
    function checkWithdrawLimits(address user, uint256 amount) public view returns (bool allowed, string memory reason) {
        // CHECK MIN/MAX PER TRANSAZIONE
        if (amount < withdrawLimits.minWithdraw) {
            return (false, "Below minimum withdraw");
        }
        if (amount > withdrawLimits.maxWithdraw) {
            return (false, "Exceeds maximum withdraw per transaction");
        }
        
        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        
        // Calculate current hour
        uint256 currentHour = block.timestamp / 1 hours;
        
        // 1. CHECK HOURLY LIMIT (current hour only)
        uint256 currentHourlyUsed = proxy.getHourlyWithdrawn(user, currentHour);
        
        if (currentHourlyUsed + amount > withdrawLimits.hourlyLimit) {
            return (false, "Hourly withdraw limit exceeded");
        }
        
        // 2. CHECK DAILY LIMIT (last 24 hours)
        uint256 totalDailyUsed = 0;
        
        // Loop through last 24 hours
        for (uint256 i = 0; i < 24; i++) {
            uint256 hour = currentHour - i;
            uint256 hourlyAmount = proxy.getHourlyWithdrawn(user, hour);
            totalDailyUsed += hourlyAmount;
            
            // Early exit optimization: if already over limit, no need to continue
            if (totalDailyUsed + amount > withdrawLimits.dailyLimit) {
                return (false, "Daily withdraw limit exceeded");
            }
        }
        
        // All checks passed
        return (true, "");
    }

    /**
     * @notice Calcola quanto prelevato nelle ultime 24 ore (sliding window)
     * @param user Indirizzo utente
     * @return dailyWithdrawn Totale prelevato in 24 ore
     */
    // Rate limit tracking gestito da ProxyGeneral - funzioni interne rimosse

    /**
     * @notice Ottiene limite orario rimanente (Issue #3 FIX)
     * @dev Calcola usage reale dell'ora corrente
     * @param user Indirizzo utente
     * @return remaining Importo rimanente prelevabile nell'ora corrente (in wei)
     * 
     * @custom:implementation
     * - Legge hourlyWithdrawn per current hour da ProxyGeneral
     * - Calcola: hourlyLimit - currentHourUsage
     * - Ritorna 0 se limite già superato
     */
    function getRemainingHourlyLimit(address user) external view returns (uint256 remaining) {
        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        
        // Get current hour usage
        uint256 currentHour = block.timestamp / 1 hours;
        uint256 currentHourUsed = proxy.getHourlyWithdrawn(user, currentHour);
        
        // Calculate remaining
        if (currentHourUsed >= withdrawLimits.hourlyLimit) {
            return 0;
        }
        
        return withdrawLimits.hourlyLimit - currentHourUsed;
    }

    /**
     * @notice Ottiene limite giornaliero rimanente (Issue #3 FIX)
     * @dev Accumula usage degli ultimi 24h
     * @param user Indirizzo utente  
     * @return remaining Importo rimanente prelevabile nelle prossime 24h (in wei)
     * 
     * @custom:implementation
     * - Loop ultimi 24 ore
     * - Accumula totalDailyUsed da ProxyGeneral.getHourlyWithdrawn()
     * - Calcola: dailyLimit - totalDailyUsed
     * - Ritorna 0 se limite già superato
     */
    function getRemainingDailyLimit(address user) external view returns (uint256 remaining) {
        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        
        // Calculate current hour
        uint256 currentHour = block.timestamp / 1 hours;
        
        // Accumulate last 24 hours usage
        uint256 totalDailyUsed = 0;
        for (uint256 i = 0; i < 24; i++) {
            uint256 hour = currentHour - i;
            totalDailyUsed += proxy.getHourlyWithdrawn(user, hour);
        }
        
        // Calculate remaining
        if (totalDailyUsed >= withdrawLimits.dailyLimit) {
            return 0;
        }
        
        return withdrawLimits.dailyLimit - totalDailyUsed;
    }

    // ==================== EMERGENCY FUNCTIONS ====================

    // ==================== FALLBACK ====================

    /**
     * @notice Riceve ETH solo da WETH unwrapping o deposit()
     */
    receive() external payable {
        // Allow ETH from WETH unwrapping or deposit() calls
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        if (msg.sender != wethAddress) {
            revert("Direct ETH transfers not allowed. Use deposit().");
        }
    }

    // ==================== INTERFACE COMPLIANCE FUNCTIONS ====================

    /**
     * @notice Calcola shares per un deposito ETH
     * @param ethAmount Quantità ETH da depositare
     * @return shares Shares che verranno ricevute
     */
    function calculateDepositShares(uint256 ethAmount) external view returns (uint256 shares) {
        if (ethAmount == 0) {
            return 0;
        }

        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        uint256 totalSupply = proxy.totalSupply();
        
        if (totalSupply == 0) {
            return ethAmount;
        }

        // Calcola valore pool attuale
        IValueCalculatorForModules valueCalculator = IValueCalculatorForModules(IBeacon(beacon).getImplementation("ValueCalculator"));
        uint256 totalValue = valueCalculator.getTotalPoolValueView();
        
        if (totalValue == 0) {
            return ethAmount;
        }

        // Apply deposit fee
        uint256 effectiveAmount = ethAmount;
        if (depositFee > 0) {
            uint256 feeAmount = (ethAmount * depositFee) / 10000;
            effectiveAmount = ethAmount - feeAmount;
        }

        return (effectiveAmount * totalSupply) / totalValue;
    }

    /**
     * @notice Calcola ETH ricevibile bruciando LP tokens
     * @param lpTokens Numero di LP tokens da bruciare
     * @return ethAmount ETH che verrà ricevuto
     */
    function calculateWithdrawAmount(uint256 lpTokens) external view returns (uint256 ethAmount) {
        if (lpTokens == 0) {
            return 0;
        }

        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        uint256 totalSupply = proxy.totalSupply();
        
        if (totalSupply == 0) {
            return 0;
        }

        // Calcola valore pool
        IValueCalculatorForModules valueCalculator = IValueCalculatorForModules(IBeacon(beacon).getImplementation("ValueCalculator"));
        uint256 totalValue = valueCalculator.getTotalPoolValueView();
        
        uint256 rawEthAmount = (lpTokens * totalValue) / totalSupply;
        
        // Apply withdraw fee
        if (withdrawFee > 0) {
            uint256 feeAmount = (rawEthAmount * withdrawFee) / 10000;
            ethAmount = rawEthAmount - feeAmount;
        } else {
            ethAmount = rawEthAmount;
        }
    }

    /**
     * @notice Verifica se withdraw è possibile per utente
     * @param user Indirizzo utente
     * @param shares Shares da prelevare
     * @return isAllowed Se può prelevare
     * @return errorReason Motivo errore se non può
     */
    function canWithdraw(address user, uint256 shares) external view returns (bool isAllowed, string memory errorReason) {
        // Check if paused
        if (paused) {
            return (false, "Contract is paused");
        }

        // Check if withdraws enabled
        if (!withdrawsEnabled) {
            return (false, "Withdrawals are disabled");
        }

        // Check user balance
        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        if (proxy.balanceOf(user) < shares) {
            return (false, "Insufficient LP token balance");
        }

        // Calculate ETH amount
        uint256 totalSupply = proxy.totalSupply();
        if (totalSupply == 0) {
            return (false, "No total supply");
        }

        IValueCalculatorForModules valueCalculator = IValueCalculatorForModules(IBeacon(beacon).getImplementation("ValueCalculator"));
        uint256 totalValue = valueCalculator.getTotalPoolValueView();
        uint256 ethAmount = (shares * totalValue) / totalSupply;

        // Check withdraw limits
        (bool limitsOk, string memory limitReason) = this.checkWithdrawLimits(user, ethAmount);
        if (!limitsOk) {
            return (false, limitReason);
        }

        return (true, "");
    }

    /**
     * @notice Statistiche complete del pool
     * @return totalValue Valore totale del pool
     * @return totalSupply Supply totale LP tokens
     * @return wethBalance Balance WETH nel pool
     * @return tokensCount Numero di token diversi
     */
    function getPoolStats() external view returns (
        uint256 totalValue,
        uint256 totalSupply,
        uint256 wethBalance,
        uint256 tokensCount
    ) {
        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        IValueCalculatorForModules valueCalculator = IValueCalculatorForModules(IBeacon(beacon).getImplementation("ValueCalculator"));
        ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));

        totalSupply = proxy.totalSupply();
        totalValue = valueCalculator.getTotalPoolValueView();
        
        // Get WETH balance
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        wethBalance = IERC20(wethAddress).balanceOf(address(proxy));
        
        // Get token count from TokenManager (Issue #7 FIX)
        tokensCount = tokenManager.getActiveTokens().length;
    }

    /**
     * @notice Valida lo stato del pool
     * @return isValid Se il pool è in stato valido
     * @return errorReason Motivo errore se non valido
     */
    function validatePoolState() external view returns (bool isValid, string memory errorReason) {
        IValueCalculatorForModules valueCalculator = IValueCalculatorForModules(IBeacon(beacon).getImplementation("ValueCalculator"));
        return valueCalculator.validatePoolValue();
    }

    // ==================== RATE LIMITING PASSTHROUGH ====================

    /**
     * @notice Verifica rate limit per utente
     * @param user Utente
     * @param amount Quantità proposta
     * @return allowed Se operazione permessa
     * @return remainingHourly Rimanente limite orario
     * @return remainingDaily Rimanente limite giornaliero
     */
    function checkWithdrawRateLimit(address user, uint256 amount) 
        external view returns (bool allowed, uint256 remainingHourly, uint256 remainingDaily) {
        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        return proxy.checkRateLimit(user, "withdraw", amount);
    }

    /**
     * @notice Verifica rate limit depositi per utente
     * @param user Utente
     * @param amount Quantità proposta
     * @return allowed Se operazione permessa
     * @return remainingHourly Rimanente limite orario
     * @return remainingDaily Rimanente limite giornaliero
     */
    function checkDepositRateLimit(address user, uint256 amount) 
        external view returns (bool allowed, uint256 remainingHourly, uint256 remainingDaily) {
        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        return proxy.checkRateLimit(user, "deposit", amount);
    }

    /**
     * @notice Imposta rate limits (solo owner)
     * @param operationType Tipo operazione
     * @param hourlyLimit Limite orario
     * @param dailyLimit Limite giornaliero
     */
    function setRateLimit(string memory operationType, uint256 hourlyLimit, uint256 dailyLimit) external onlyOwner {
        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        proxy.setRateLimit(operationType, hourlyLimit, dailyLimit);
    }

    /**
     * @notice Ottiene informazioni rate limit per utente
     * @param user Indirizzo utente
     * @param operationType Tipo operazione
     * @return hourlyLimit Limite orario
     * @return dailyLimit Limite giornaliero
     * @return currentHourlyUsage Utilizzo corrente orario
     * @return currentDailyUsage Utilizzo corrente giornaliero
     */
    function getRateLimitInfo(address user, string memory operationType) 
        external view returns (uint256 hourlyLimit, uint256 dailyLimit, uint256 currentHourlyUsage, uint256 currentDailyUsage) {
        
        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        
        // Get configuration and usage (simplified interface)
        (bool allowed, uint256 remainingHourly, uint256 remainingDaily) = proxy.checkRateLimit(user, operationType, 0);
        
        // For proper implementation, ProxyGeneral would need getter functions for these values
        // Here we return approximations based on remaining amounts
        hourlyLimit = 100 ether; // Default values - should be retrieved from config
        dailyLimit = 1000 ether;
        currentHourlyUsage = hourlyLimit > remainingHourly ? hourlyLimit - remainingHourly : 0;
        currentDailyUsage = dailyLimit > remainingDaily ? dailyLimit - remainingDaily : 0;
    }

    // ==================== WITHDRAW LIMIT FUNCTIONS (Issue #2-3 FIX) ====================
    // Funzioni già implementate sopra: checkWithdrawLimits(), getRemainingHourlyLimit(), getRemainingDailyLimit()

    // ==================== FALLBACK ====================

    /**
     * @notice Blocca chiamate a funzioni inesistenti
     */
    fallback() external payable {
        revert("Function does not exist.");
    }
}
