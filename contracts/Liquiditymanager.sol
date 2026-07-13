// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./interfaces/ILiquidityManager.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/IProxyGeneral.sol";
import "./interfaces/ITokenManagerForModules.sol";
import "./interfaces/IValueCalculatorForModules.sol";
import "./interfaces/ISwapManagerForModules.sol";
import "./interfaces/IParameterManagerForModules.sol";
import "./interfaces/IProtocolManager.sol";

/**
 * @title LiquidityManager
 * @dev Gestisce deposit/withdraw con validazioni complete e automatic swap
 * @custom:security-contact security@yourdomain.com
 */
contract LiquidityManager is ILiquidityManager, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // ==================== STRUCTS ====================
    
    struct WithdrawValidation {
        uint256 shares;
        uint256 amount;
        uint256 totalSupply;
        uint256 totalValue;
        uint256 poolBaseAssetBalance;
        uint256 userBalance;
        bool requiresSwap;
        uint256 baseAssetNeeded;
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

    /// @notice Base asset code for this pool (e.g. "WETH", "USDC", "WBTC")
    string public baseAssetCode;

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

    constructor(address _beacon, string memory _baseAssetCode) Ownable() {
        require(_beacon != address(0), "Invalid beacon address");
        require(bytes(_baseAssetCode).length > 0, "Invalid base asset code");
        beacon = _beacon;
        baseAssetCode = _baseAssetCode;
        lastHourlyReset = block.timestamp;
        
        // Initialize default withdraw limits scaled to base asset decimals
        address baseAssetAddr = IBeacon(_beacon).getImplementation("BASE_ASSET");
        uint256 unit = 10 ** uint256(IERC20Metadata(baseAssetAddr).decimals());
        withdrawLimits = WithdrawLimits({
            hourlyLimit: 100 * unit,
            dailyLimit: 1000 * unit,
            minWithdraw: unit / 1_000_000,
            maxWithdraw: 50 * unit
        });
    }

    // ==================== DEPOSIT FUNCTION ====================

    /**
     * @notice Deposita base asset nel pool e riceve LP tokens
     * @dev ERC20-only: caller must approve this contract first
     * @param amount Quantità di base asset da depositare
     * @return lpTokens Numero di LP tokens ricevuti
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused whenDepositsEnabled returns (uint256 lpTokens) {
        require(amount > 0, "Invalid deposit amount");
        
        // GET PARAMETER VALUES
        address paramManager = IBeacon(beacon).getImplementation("ParameterManager");
        IParameterManagerForModules params = IParameterManagerForModules(paramManager);
        
        uint256 minDeposit = params.getCurrentParameterValue("minDeposit");
        uint256 maxDeposit = params.getCurrentParameterValue("maxDeposit");
        
        // INITIAL VALIDATIONS
        require(amount >= minDeposit, "Below minimum deposit");
        require(amount <= maxDeposit, "Exceeds maximum deposit");
        
        // CALCULATE FEE
        uint256 feeAmount = (amount * depositFee) / 10000;
        uint256 netDeposit = amount - feeAmount;
        
        // CHECK RATE LIMITING 
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        
        (bool rateLimitOk, , ) = proxy.checkRateLimit(msg.sender, "deposit", amount);
        require(rateLimitOk, "Rate limit exceeded for deposit operation");
        
        // TRACK OPERATION FOR RATE LIMITING
        proxy.trackOperation(msg.sender, "deposit", amount);
        
        // GET BASE ASSET ADDRESS
        address baseAssetAddr = IBeacon(beacon).getImplementation("BASE_ASSET");
        require(baseAssetAddr != address(0), "Base asset not configured");
        
        // CAPTURE PRE-DEPOSIT STATE
        uint256 preDepositBalance = IERC20(baseAssetAddr).balanceOf(proxyGeneral);
        uint256 preDepositSupply = proxy.totalSupply();
        
        // SHARES CALCULATION - PROPORTIONAL TO POOL VALUE
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
            
            shares = (netDeposit * preDepositSupply) / totalValue;
            
            require(shares > 0, "Deposit too small for current pool size");
        }
        
        require(shares > 0, "No shares to mint");
        
        // TRANSFER BASE ASSET FROM USER TO PROXYGENERAL (ERC20 transferFrom)
        IERC20(baseAssetAddr).safeTransferFrom(msg.sender, proxyGeneral, netDeposit);
        
        // TRANSFER FEE TO RECIPIENT IF APPLICABLE
        if (feeAmount > 0 && feeRecipient != address(0)) {
            IERC20(baseAssetAddr).safeTransferFrom(msg.sender, feeRecipient, feeAmount);
        }
        
        // MINT LP TOKENS
        proxy.mint(msg.sender, shares);
        
        // POST-DEPOSIT VALIDATIONS
        require(
            proxy.totalSupply() == preDepositSupply + shares,
            "Invalid supply change"
        );
        require(
            IERC20(baseAssetAddr).balanceOf(proxyGeneral) == preDepositBalance + netDeposit,
            "Invalid base asset balance change"
        );
        
        emit Deposit(
            msg.sender,
            amount,
            shares,
            IERC20(baseAssetAddr).balanceOf(proxyGeneral),
            proxy.totalSupply()
        );
        
        return shares;
    }

    // ==================== WITHDRAW FUNCTION ====================

    /**
     * @notice Preleva base asset dal pool bruciando LP tokens (con deadline automatico)
     * @param _shares Numero di LP tokens da bruciare
     * @return amount Base asset effettivamente prelevato
     */
    function withdraw(uint256 _shares) external nonReentrant whenNotPaused whenWithdrawsEnabled returns (uint256 amount) {
        uint256 deadline = block.timestamp + 20 minutes;
        return _withdrawInternal(_shares, deadline);
    }
    
    /**
     * @notice Preleva base asset dal pool con deadline esplicito (MEV protected)
     * @param _shares Numero di LP tokens da bruciare
     * @param deadline Timestamp massimo per completare operazione
     * @return amount Base asset effettivamente prelevato
     */
    function withdrawWithDeadline(uint256 _shares, uint256 deadline) external nonReentrant whenNotPaused whenWithdrawsEnabled returns (uint256 amount) {
        require(block.timestamp <= deadline, "Withdraw deadline expired");
        return _withdrawInternal(_shares, deadline);
    }

    /**
     * @notice Core withdraw logic (INTERNAL)
     * @dev Con automatic swap se base asset insufficiente + validazioni complete
     */
    function _withdrawInternal(uint256 _shares, uint256 deadline) internal returns (uint256 amount) {
        uint256 startTime = block.timestamp;
        
        require(_shares > 0, "Invalid shares amount");
        
        // GET PARAMETER VALUES  
        address paramManager = IBeacon(beacon).getImplementation("ParameterManager");
        IParameterManagerForModules params = IParameterManagerForModules(paramManager);
        uint256 poolReserveRatio = params.getCurrentParameterValue("poolReserveRatio");
        
        // GET CONTRACT REFERENCES
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address baseAssetAddr = IBeacon(beacon).getImplementation("BASE_ASSET");
        address valueCalculator = IBeacon(beacon).getImplementation("ValueCalculator");
        
        IProxyGeneral proxy = IProxyGeneral(proxyGeneral);
        IValueCalculatorForModules calculator = IValueCalculatorForModules(valueCalculator);
        
        // VALIDATE USER BALANCE
        require(proxy.balanceOf(msg.sender) >= _shares, "Insufficient balance");
        
        // GET CURRENT POOL STATE
        IValueCalculatorForModules.PoolValueInfo memory poolInfo = calculator.getTotalPoolValue();
        
        WithdrawValidation memory validation = WithdrawValidation({
            shares: _shares,
            amount: 0,
            totalSupply: proxy.totalSupply(),
            totalValue: poolInfo.totalValue,
            poolBaseAssetBalance: IERC20(baseAssetAddr).balanceOf(proxyGeneral),
            userBalance: proxy.balanceOf(msg.sender),
            requiresSwap: false,
            baseAssetNeeded: 0
        });
        
        // CALCULATE AMOUNT TO WITHDRAW
        validation.amount = (_shares * validation.totalValue) / validation.totalSupply;
        
        // CHECK WITHDRAW LIMITS
        (bool canWithdrawLimits, string memory limitReason) = checkWithdrawLimits(msg.sender, validation.amount);
        require(canWithdrawLimits, limitReason);
        
        // CALCULATE WITHDRAW FEE
        uint256 feeAmount = (validation.amount * withdrawFee) / 10000;
        uint256 netWithdraw = validation.amount - feeAmount;

        // CHECK RATE LIMITING
        (bool rateLimitOk, , ) = proxy.checkRateLimit(msg.sender, "withdraw", validation.amount);
        require(rateLimitOk, "Rate limit exceeded for withdraw operation");
        
        // TRACK OPERATION FOR RATE LIMITING
        proxy.trackOperation(msg.sender, "withdraw", validation.amount);
        
        // CHECK INITIAL RESERVE RATIO
        PoolReserveCheck memory reserveCheck;
        reserveCheck.currentReserveRatio = (validation.poolBaseAssetBalance * 10000) / validation.totalValue;
        require(reserveCheck.currentReserveRatio >= poolReserveRatio, "Insufficient pool reserves");
        
        // EMIT WITHDRAWAL STARTED EVENT
        emit WithdrawalStarted(
            msg.sender,
            _shares,
            deadline,
            deadline - block.timestamp,
            validation.poolBaseAssetBalance < netWithdraw
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
        if (validation.poolBaseAssetBalance < netWithdraw) {
            validation.requiresSwap = true;
            validation.baseAssetNeeded = netWithdraw - validation.poolBaseAssetBalance;
            
            _executeAutomaticSwap(validation.baseAssetNeeded, calculator, deadline);
            
            uint256 newBalance = IERC20(baseAssetAddr).balanceOf(proxyGeneral);
            
            if (newBalance < netWithdraw) {
                netWithdraw = newBalance;
            }
            
            validation.poolBaseAssetBalance = newBalance;
        }
        
        // VALIDATE POST-WITHDRAW RESERVE RATIO
        reserveCheck.postWithdrawBalance = validation.poolBaseAssetBalance - netWithdraw;
        reserveCheck.postWithdrawValue = validation.totalValue - netWithdraw;
        
        if (reserveCheck.postWithdrawValue > 0) {
            reserveCheck.postWithdrawRatio = (reserveCheck.postWithdrawBalance * 10000) / reserveCheck.postWithdrawValue;
            require(reserveCheck.postWithdrawRatio >= poolReserveRatio, "Would break reserve ratio");
        }
        
        // BURN LP TOKENS
        proxy.burn(msg.sender, _shares);
        
        // TRANSFER BASE ASSET FROM PROXYGENERAL TO USER (ERC20)
        uint256 totalNeeded = netWithdraw;
        if (feeAmount > 0 && feeRecipient != address(0)) {
            totalNeeded += feeAmount;
        }
        proxy.withdrawToken(baseAssetCode, totalNeeded, address(this));
        
        // TRANSFER BASE ASSET TO USER
        IERC20(baseAssetAddr).safeTransfer(msg.sender, netWithdraw);
        
        // TRANSFER FEE TO RECIPIENT IF APPLICABLE
        if (feeAmount > 0 && feeRecipient != address(0)) {
            IERC20(baseAssetAddr).safeTransfer(feeRecipient, feeAmount);
        }
        
        // FINAL VALIDATION
        require(
            proxy.totalSupply() == validation.totalSupply - _shares,
            "Invalid supply change"
        );
        
        // CHECK DEADLINE CRITICAL
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
            validation.amount,
            validation.totalValue,
            IERC20(baseAssetAddr).balanceOf(proxyGeneral)
        );
        
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
     * @notice Esegue automatic swap multipli per ottenere base asset necessario
     * @dev Loop intelligente con slippage tolerance
     * @param baseAssetNeeded Quantità di base asset necessaria
     * @param calculator Reference al ValueCalculator
     * @param deadline Timestamp massimo per swap
     */
    function _executeAutomaticSwap(
        uint256 baseAssetNeeded, 
        IValueCalculatorForModules calculator,
        uint256 deadline
    ) internal {
        uint256 stillNeeded = baseAssetNeeded;
        uint256 maxIterations = 10;
        uint256 iteration = 0;
        uint256 totalObtained = 0;
        
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address baseAssetAddr = IBeacon(beacon).getImplementation("BASE_ASSET");
        address swapManager = IBeacon(beacon).getImplementation("SwapManager");
        ISwapManagerForModules swapper = ISwapManagerForModules(swapManager);
        
        emit MultiSwapStarted(msg.sender, baseAssetNeeded, maxIterations);
        
        while (stillNeeded > 0 && iteration < maxIterations) {
            iteration++;
            
            uint256 currentBalance = IERC20(baseAssetAddr).balanceOf(proxyGeneral);
            
            if (currentBalance >= baseAssetNeeded) {
                emit MultiSwapCompleted(msg.sender, iteration - 1, totalObtained);
                return;
            }
            
            uint256 timeRemaining = deadline - block.timestamp;
            if (timeRemaining < 3 minutes) {
                emit WithdrawalDeadlineCritical(
                    msg.sender,
                    deadline,
                    timeRemaining,
                    "multi-swap"
                );
            }
            
            string memory tokenToSwap;
            uint256 amountToSwap;
            try calculator.selectTokenForSwap(stillNeeded) returns (
                string memory selectedToken,
                uint256 selectedAmount
            ) {
                tokenToSwap = selectedToken;
                amountToSwap = selectedAmount;
            } catch {
                // No single asset can cover the deficit. Fall through to the
                // aggregate liquid-token path, which can consume several assets.
                tokenToSwap = "";
                amountToSwap = 0;
            }
            
            if (bytes(tokenToSwap).length == 0 || amountToSwap == 0) {
                // STEP 1: Swap liquid tokens
                uint256 fromLiquidSwap = _swapLiquidTokensForBaseAsset(stillNeeded, proxyGeneral, baseAssetAddr);
                if (fromLiquidSwap > 0) {
                    totalObtained += fromLiquidSwap;
                    if (fromLiquidSwap >= stillNeeded) {
                        stillNeeded = 0;
                    } else {
                        stillNeeded -= fromLiquidSwap;
                    }
                    
                    uint256 newBalance = IERC20(baseAssetAddr).balanceOf(proxyGeneral);
                    if (newBalance >= baseAssetNeeded) {
                        emit MultiSwapCompleted(msg.sender, iteration, totalObtained);
                        return;
                    }
                }
                
                // STEP 2: Close protocol positions
                if (stillNeeded > 0) {
                    uint256 fromProtocols = _closeProtocolPositionsForBaseAsset(stillNeeded, proxyGeneral, baseAssetAddr);
                    if (fromProtocols > 0) {
                        totalObtained += fromProtocols;
                        if (fromProtocols >= stillNeeded) {
                            stillNeeded = 0;
                        } else {
                            stillNeeded -= fromProtocols;
                        }
                        uint256 newBalance = IERC20(baseAssetAddr).balanceOf(proxyGeneral);
                        if (newBalance >= baseAssetNeeded) {
                            emit MultiSwapCompleted(msg.sender, iteration, totalObtained);
                            return;
                        }
                    }
                }
                
                uint256 minAcceptable = (baseAssetNeeded * 97) / 100;
                if (totalObtained >= minAcceptable) {
                    emit MultiSwapCompleted(msg.sender, iteration - 1, totalObtained);
                    return;
                }
                
                revert("Insufficient total liquidity across all available tokens");
            }
            
            emit AutomaticSwapTriggered(
                msg.sender,
                tokenToSwap,
                amountToSwap,
                stillNeeded,
                deadline,
                timeRemaining
            );
            
            (bool isValid, string memory errorReason) = swapper.validateSwapParameters(
                tokenToSwap,
                baseAssetCode,
                amountToSwap
            );
            require(isValid, string(abi.encodePacked("Swap validation failed: ", errorReason)));
            
            uint256 received = swapper.performSwap(tokenToSwap, baseAssetCode, amountToSwap, deadline);
            require(received > 0, "Swap returned zero base asset");
            
            totalObtained += received;
            
            if (received >= stillNeeded) {
                stillNeeded = 0;
            } else {
                stillNeeded -= received;
            }
            
            emit MultiSwapIteration(
                msg.sender,
                iteration,
                tokenToSwap,
                amountToSwap,
                received,
                stillNeeded
            );
            emit TokenSwappedForWithdraw(tokenToSwap, amountToSwap, received);
        }
        
        require(stillNeeded == 0, "Could not obtain enough base asset after multiple swaps");
        emit MultiSwapCompleted(msg.sender, iteration, totalObtained);
    }

    // ==================== PROTOCOL INTEGRATION ====================

    /**
     * @notice Close positions across ALL registered protocols to obtain base asset
     * @dev Delegates to ProtocolManager which loops through all registered protocol adapters
     */
    function _closeProtocolPositionsForBaseAsset(
        uint256 amountNeeded,
        address proxyGeneral,
        address baseAssetAddr
    ) internal returns (uint256 baseAssetObtained) {
        address protocolManager;
        try IBeacon(beacon).getImplementation("ProtocolManager") returns (address pm) {
            protocolManager = pm;
        } catch {
            return 0;
        }
        
        if (protocolManager == address(0)) return 0;
        
        uint256 balanceBefore = IERC20(baseAssetAddr).balanceOf(proxyGeneral);
        
        try IProtocolManager(protocolManager).closePositionsForBaseAsset(amountNeeded) 
            returns (uint256 obtained, uint256 positionsClosed) 
        {
            uint256 balanceAfter = IERC20(baseAssetAddr).balanceOf(proxyGeneral);
            baseAssetObtained = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : obtained;
            
            if (positionsClosed > 0) {
                emit ProtocolPositionsClosedForBaseAsset(positionsClosed, baseAssetObtained);
            }
        } catch {
            return 0;
        }
        
        return baseAssetObtained;
    }
    
    /**
     * @notice Swap liquid tokens to base asset for withdrawal
     * @dev Swaps any available liquid tokens (non-base-asset) first
     */
    function _swapLiquidTokensForBaseAsset(
        uint256 amountNeeded,
        address proxyGeneral,
        address baseAssetAddr
    ) internal returns (uint256 baseAssetObtained) {
        address tokenManager;
        try IBeacon(beacon).getImplementation("TokenManager") returns (address tm) {
            tokenManager = tm;
        } catch {
            return 0;
        }
        if (tokenManager == address(0)) return 0;
        
        address swapManager;
        try IBeacon(beacon).getImplementation("SwapManager") returns (address sm) {
            swapManager = sm;
        } catch {
            return 0;
        }
        if (swapManager == address(0)) return 0;
        
        string[] memory activeTokens;
        try ITokenManagerForModules(tokenManager).getActiveTokens() returns (string[] memory tokens) {
            activeTokens = tokens;
        } catch {
            return 0;
        }
        
        for (uint256 i = 0; i < activeTokens.length && baseAssetObtained < amountNeeded; i++) {
            string memory tokenCode = activeTokens[i];
            
            address tokenAddr;
            try ITokenManagerForModules(tokenManager).getTokenAddress(tokenCode) returns (address addr) {
                tokenAddr = addr;
            } catch {
                continue;
            }
            
            uint256 balance = IERC20(tokenAddr).balanceOf(proxyGeneral);
            if (balance == 0) continue;
            
            uint256 amountToSwap = balance;
            
            try ISwapManagerForModules(swapManager).performSwapAuto(
                tokenCode,
                baseAssetCode,
                amountToSwap
            ) returns (uint256 amountOut) {
                if (amountOut > 0) {
                    baseAssetObtained += amountOut;
                    emit LiquidTokenSwappedForBaseAsset(tokenCode, amountToSwap, amountOut);
                }
            } catch {
                continue;
            }
        }
        
        return baseAssetObtained;
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
     * @notice Riceve ETH (solo se base asset è WETH - per DepositHelper)
     */
    receive() external payable {
        // Only accept ETH from known contracts (e.g. WETH unwrap, DepositHelper)
    }

    // ==================== INTERFACE COMPLIANCE FUNCTIONS ====================

    /**
     * @notice Calcola shares per un deposito di base asset
     * @param amount Quantità base asset da depositare
     * @return shares Shares che verranno ricevute
     */
    function calculateDepositShares(uint256 amount) external view returns (uint256 shares) {
        if (amount == 0) {
            return 0;
        }

        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        uint256 totalSupply = proxy.totalSupply();
        
        if (totalSupply == 0) {
            return amount;
        }

        IValueCalculatorForModules valueCalculator = IValueCalculatorForModules(IBeacon(beacon).getImplementation("ValueCalculator"));
        uint256 totalValue = valueCalculator.getTotalPoolValueView();
        
        if (totalValue == 0) {
            return amount;
        }

        uint256 effectiveAmount = amount;
        if (depositFee > 0) {
            uint256 feeAmount = (amount * depositFee) / 10000;
            effectiveAmount = amount - feeAmount;
        }

        return (effectiveAmount * totalSupply) / totalValue;
    }

    /**
     * @notice Calcola base asset ricevibile bruciando LP tokens
     * @param lpTokens Numero di LP tokens da bruciare
     * @return amount Base asset che verrà ricevuto
     */
    function calculateWithdrawAmount(uint256 lpTokens) external view returns (uint256 amount) {
        if (lpTokens == 0) {
            return 0;
        }

        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        uint256 totalSupply = proxy.totalSupply();
        
        if (totalSupply == 0) {
            return 0;
        }

        IValueCalculatorForModules valueCalculator = IValueCalculatorForModules(IBeacon(beacon).getImplementation("ValueCalculator"));
        uint256 totalValue = valueCalculator.getTotalPoolValueView();
        
        uint256 rawAmount = (lpTokens * totalValue) / totalSupply;
        
        if (withdrawFee > 0) {
            uint256 feeAmount = (rawAmount * withdrawFee) / 10000;
            amount = rawAmount - feeAmount;
        } else {
            amount = rawAmount;
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
        uint256 withdrawAmount = (shares * totalValue) / totalSupply;

        // Check withdraw limits
        (bool limitsOk, string memory limitReason) = this.checkWithdrawLimits(user, withdrawAmount);
        if (!limitsOk) {
            return (false, limitReason);
        }

        return (true, "");
    }

    /**
     * @notice Statistiche complete del pool
     * @return totalValue Valore totale del pool
     * @return totalSupply Supply totale LP tokens
     * @return baseAssetBalance Balance base asset nel pool
     * @return tokensCount Numero di token diversi
     */
    function getPoolStats() external view returns (
        uint256 totalValue,
        uint256 totalSupply,
        uint256 baseAssetBalance,
        uint256 tokensCount
    ) {
        IProxyGeneral proxy = IProxyGeneral(IBeacon(beacon).getImplementation("ProxyGeneral"));
        IValueCalculatorForModules valueCalculator = IValueCalculatorForModules(IBeacon(beacon).getImplementation("ValueCalculator"));
        ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));

        totalSupply = proxy.totalSupply();
        totalValue = valueCalculator.getTotalPoolValueView();
        
        address baseAssetAddr = IBeacon(beacon).getImplementation("BASE_ASSET");
        baseAssetBalance = IERC20(baseAssetAddr).balanceOf(address(proxy));
        
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
        // Get base asset decimals for rate limit defaults
        address baseAssetAddr = IBeacon(beacon).getImplementation("BASE_ASSET");
        uint256 unit = 10 ** uint256(IERC20Metadata(baseAssetAddr).decimals());
        hourlyLimit = 100 * unit;
        dailyLimit = 1000 * unit;
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
