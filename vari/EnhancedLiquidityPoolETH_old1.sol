// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EnhancedLiquidityPoolETH is ERC20, ReentrancyGuard, Ownable {
    // Constants
    uint256 public constant MAX_DEPOSIT = 100 ether;
    uint256 public constant MAX_WITHDRAW_PER_TX = 50 ether;
    uint256 public constant WITHDRAWAL_WINDOW = 24 hours;
    uint256 public constant CACHE_DURATION = 5 minutes;
    uint256 public constant MAX_PRICE_AGE = 1 hours;
    uint256 public constant MAX_TOKENS_PER_OPERATION = 10;
    uint256 public constant MAX_ERRORS = 3;
    
    uint256 public withdrawLimitPerHour = 100 ether;

    // Structs
    struct TokenInfo {
        address tokenAddress;
        uint8 tokenDecimals;
        string tokenCode;
        address priceFeed;
        uint8 priceFeedDecimals;
        bool isActive;
        uint256 lastPriceTimestamp;
        uint256 lastPrice;
        uint256 heartbeat;
    }

    struct TokenValueCache {
        uint256 value;
        uint256 timestamp;
        bool isValid;
    }

    struct WithdrawalRequest {
        uint256 shares;
        uint256 timestamp;
    }

    // Storage
    mapping(string => TokenInfo) public tokenData;
    mapping(string => TokenValueCache) private tokenValueCache;
    mapping(string => uint256) public tokenErrors;
    mapping(address => WithdrawalRequest) public withdrawalRequests;
    
    string[] public tokenCodes;
    uint256 public lastHourlyReset;
    uint256 public hourlyWithdrawnAmount;
    bool public paused;

    // Events
    event TokenAdded(string tokenCode, address tokenAddress, address priceFeed);
    event TokenRemoved(string tokenCode);
    event TokenError(string tokenCode, string errorMessage);
    event CacheUpdated(string tokenCode, uint256 value);
    event PriceStale(string tokenCode, uint256 lastUpdateTime);
    event WithdrawalRequested(address indexed user, uint256 shares, uint256 timestamp);
    event WithdrawalCompleted(address indexed user, uint256 amount);
    event PoolValueUpdated(uint256 totalValue);
    event CacheCleared(string tokenCode);
    event HeartbeatUpdated(string tokenCode, uint256 newHeartbeat);
    event ErrorThresholdReached(string tokenCode);

    constructor() ERC20("LP Token", "LPT") Ownable() {
        lastHourlyReset = block.timestamp;
    }

    // Modifiers
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier validToken(string memory _tokenCode) {
        require(tokenData[_tokenCode].isActive, "Token not found or inactive");
        _;
    }

    modifier withinLimits(uint256 amount) {
        if (block.timestamp >= lastHourlyReset + 1 hours) {
            hourlyWithdrawnAmount = 0;
            lastHourlyReset = block.timestamp;
        }
        require(hourlyWithdrawnAmount + amount <= withdrawLimitPerHour, "Exceeds hourly limit");
        _;
    }
    // Token Management Functions
    function manageTokenData(
        address _tokenAddress,
        uint8 _tokenDecimals,
        string calldata _tokenCode,
        address _priceFeed,
        uint8 _priceFeedDecimals,
        uint256 _heartbeat
    ) external onlyOwner {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_priceFeed != address(0), "Invalid price feed address");
        require(bytes(_tokenCode).length > 0, "Invalid token code");
        require(_heartbeat > 0, "Invalid heartbeat");

        if (!tokenData[_tokenCode].isActive) {
            require(tokenCodes.length < MAX_TOKENS_PER_OPERATION, "Too many tokens");
            tokenCodes.push(_tokenCode);
        }

        tokenData[_tokenCode] = TokenInfo({
            tokenAddress: _tokenAddress,
            tokenDecimals: _tokenDecimals,
            tokenCode: _tokenCode,
            priceFeed: _priceFeed,
            priceFeedDecimals: _priceFeedDecimals,
            isActive: true,
            lastPriceTimestamp: 0,
            lastPrice: 0,
            heartbeat: _heartbeat
        });

        // Invalidate any existing cache
        invalidateCache(_tokenCode);

        emit TokenAdded(_tokenCode, _tokenAddress, _priceFeed);
    }

    function removeToken(string calldata _tokenCode) external onlyOwner validToken(_tokenCode) {
        tokenData[_tokenCode].isActive = false;
        
        // Remove from tokenCodes array
        for (uint i = 0; i < tokenCodes.length; i++) {
            if (keccak256(bytes(tokenCodes[i])) == keccak256(bytes(_tokenCode))) {
                tokenCodes[i] = tokenCodes[tokenCodes.length - 1];
                tokenCodes.pop();
                break;
            }
        }

        invalidateCache(_tokenCode);
        emit TokenRemoved(_tokenCode);
    }

    function updateHeartbeat(string calldata _tokenCode, uint256 _newHeartbeat) 
        external 
        onlyOwner 
        validToken(_tokenCode) 
    {
        require(_newHeartbeat > 0, "Invalid heartbeat");
        tokenData[_tokenCode].heartbeat = _newHeartbeat;
        emit HeartbeatUpdated(_tokenCode, _newHeartbeat);
    }

    // Price and Value Calculation Functions
    function getTokenPrice(string memory _tokenCode) public returns (uint256) {
        TokenInfo storage token = tokenData[_tokenCode];
        require(token.isActive, "Token not found");

        // Check if cached price is still valid
        if (block.timestamp - token.lastPriceTimestamp <= token.heartbeat) {
            return token.lastPrice;
        }

        try AggregatorV3Interface(token.priceFeed).latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256 ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            require(price > 0, "Invalid price");
            require(updatedAt >= block.timestamp - MAX_PRICE_AGE, "Stale price");
            require(answeredInRound >= roundId, "Price round invalid");

            // Update cache
            token.lastPrice = uint256(price);
            token.lastPriceTimestamp = block.timestamp;
            
            // Reset error counter on successful price fetch
            tokenErrors[_tokenCode] = 0;

            return uint256(price);
        } catch {
            // Increment error counter
            tokenErrors[_tokenCode]++;
            emit TokenError(_tokenCode, "Price fetch failed");
            
            // If too many errors, disable token
            if (tokenErrors[_tokenCode] >= MAX_ERRORS) {
                token.isActive = false;
                emit ErrorThresholdReached(_tokenCode);
                emit TokenError(_tokenCode, "Token disabled due to errors");
            }
            
            // Return last valid price if available
            require(token.lastPrice > 0, "No valid price available");
            return token.lastPrice;
        }
    }

    function calculateTokenValue(string memory _tokenCode) public returns (uint256) {
        TokenInfo storage token = tokenData[_tokenCode];
        require(token.isActive, "Token not found");

        // Check cache first
        TokenValueCache storage cache = tokenValueCache[_tokenCode];
        if (cache.isValid && block.timestamp - cache.timestamp <= CACHE_DURATION) {
            return cache.value;
        }

        uint256 balance = IERC20(token.tokenAddress).balanceOf(address(this));
        uint256 price = getTokenPrice(_tokenCode);
        uint256 value = (balance * price) / (10 ** uint256(token.tokenDecimals));

        // Update cache
        cache.value = value;
        cache.timestamp = block.timestamp;
        cache.isValid = true;
        
        emit CacheUpdated(_tokenCode, value);
        
        return value;
    }
    function getTotalPoolValue() public returns (uint256 totalValue) {
        totalValue = address(this).balance; // ETH balance

        uint256 processedTokens = 0;
        for (uint i = 0; i < tokenCodes.length && processedTokens < MAX_TOKENS_PER_OPERATION; i++) {
            if (tokenData[tokenCodes[i]].isActive) {
                try this.calculateTokenValue(tokenCodes[i]) returns (uint256 value) {
                    totalValue += value;
                    processedTokens++;
                } catch {
                    emit TokenError(tokenCodes[i], "Value calculation failed");
                }
            }
        }

        emit PoolValueUpdated(totalValue);
    }

    // Cache Management Functions
    function invalidateCache(string memory _tokenCode) internal {
        tokenValueCache[_tokenCode].isValid = false;
        emit CacheCleared(_tokenCode);
    }

    function clearAllCaches() external onlyOwner {
        for (uint i = 0; i < tokenCodes.length; i++) {
            invalidateCache(tokenCodes[i]);
        }
    }

    // Deposit and Withdrawal Functions
    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "No ETH sent");
        require(msg.value <= MAX_DEPOSIT, "Exceeds max deposit");

        uint256 totalPoolValue = getTotalPoolValue();
        uint256 shares;
        
        if (totalSupply() == 0) {
            shares = msg.value;
        } else {
            shares = (msg.value * totalSupply()) / totalPoolValue;
        }

        _mint(msg.sender, shares);
        emit PoolValueUpdated(getTotalPoolValue());
    }

    function initiateWithdraw(uint256 shares) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(shares > 0, "No shares specified");
        require(shares <= balanceOf(msg.sender), "Insufficient shares");
        require(withdrawalRequests[msg.sender].shares == 0, "Pending withdrawal exists");

        _transfer(msg.sender, address(this), shares);
        withdrawalRequests[msg.sender] = WithdrawalRequest({
            shares: shares,
            timestamp: block.timestamp
        });

        emit WithdrawalRequested(msg.sender, shares, block.timestamp);
    }

    function completeWithdraw() 
        external 
        nonReentrant 
        whenNotPaused 
        withinLimits(MAX_WITHDRAW_PER_TX) 
    {
        WithdrawalRequest storage request = withdrawalRequests[msg.sender];
        require(request.shares > 0, "No withdrawal request");
        require(
            block.timestamp >= request.timestamp + WITHDRAWAL_WINDOW, 
            "Withdrawal window not met"
        );

        uint256 totalPoolValue = getTotalPoolValue();
        uint256 amountToWithdraw = (request.shares * totalPoolValue) / totalSupply();

        require(amountToWithdraw <= MAX_WITHDRAW_PER_TX, "Exceeds max withdrawal");
        require(amountToWithdraw <= address(this).balance, "Insufficient liquidity");

        // Update hourly withdrawal tracking
        if (block.timestamp >= lastHourlyReset + 1 hours) {
            hourlyWithdrawnAmount = 0;
            lastHourlyReset = block.timestamp;
        }
        require(
            hourlyWithdrawnAmount + amountToWithdraw <= withdrawLimitPerHour, 
            "Exceeds hourly limit"
        );
        hourlyWithdrawnAmount += amountToWithdraw;

        // Clear withdrawal request
        withdrawalRequests[msg.sender] = WithdrawalRequest(0, 0);
        
        // Burn shares and transfer ETH
        _burn(address(this), request.shares);
        
        (bool success, ) = payable(msg.sender).call{value: amountToWithdraw}("");
        require(success, "ETH transfer failed");

        emit WithdrawalCompleted(msg.sender, amountToWithdraw);
        emit PoolValueUpdated(getTotalPoolValue());
    }

    // Administrative Functions
    function setWithdrawLimitPerHour(uint256 _limit) external onlyOwner {
        require(_limit > 0, "Invalid limit");
        withdrawLimitPerHour = _limit;
    }

    function togglePause() external onlyOwner {
        paused = !paused;
    }

    function resetErrorCount(string calldata _tokenCode) 
        external 
        onlyOwner 
        validToken(_tokenCode) 
    {
        tokenErrors[_tokenCode] = 0;
    }

    // Emergency Functions
    function emergencyWithdraw() external onlyOwner {
        require(paused, "Contract must be paused");
        payable(owner()).transfer(address(this).balance);
    }

    function emergencyWithdrawToken(
        string calldata _tokenCode
    ) external onlyOwner validToken(_tokenCode) {
        require(paused, "Contract must be paused");
        TokenInfo storage token = tokenData[_tokenCode];
        IERC20 tokenContract = IERC20(token.tokenAddress);
        uint256 balance = tokenContract.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        require(
            tokenContract.transfer(owner(), balance),
            "Token transfer failed"
        );
    }

    // View Functions
    function getTokenCount() external view returns (uint256) {
        return tokenCodes.length;
    }

    function getActiveTokens() external view returns (string[] memory) {
        uint256 activeCount = 0;
        for (uint i = 0; i < tokenCodes.length; i++) {
            if (tokenData[tokenCodes[i]].isActive) {
                activeCount++;
            }
        }

        string[] memory activeTokens = new string[](activeCount);
        uint256 index = 0;
        for (uint i = 0; i < tokenCodes.length; i++) {
            if (tokenData[tokenCodes[i]].isActive) {
                activeTokens[index] = tokenCodes[i];
                index++;
            }
        }
        return activeTokens;
    }

    // Fallback and Receive Functions
    receive() external payable {}
    fallback() external payable {}
}
