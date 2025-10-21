// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/IParameterManagerForModules.sol";

/**
 * @title TokenManager
 * @dev Gestione token registry e Chainlink price feeds per il sistema DeFi modulare
 * @custom:security-contact security@yourdomain.com
 */
contract TokenManager is Ownable {
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
        uint256 errorCount;
    }

    /// @notice Mapping dei token data per token code
    mapping(string => TokenInfo) private tokenData;
    
    /// @notice Array di tutti i token codes
    string[] private tokenCodes;
    
    /// @notice Contatore dei token codes (per limite massimo)
    uint256 public tokenCodesCount;

    /// @notice Error tracking per token
    mapping(string => uint256) public tokenErrors;
    
    /// @notice Massimo numero di errori prima di alert
    uint256 public maxErrors = 3;

    /// @notice Massimo numero di token per operazione
    uint256 public maxTokensPerOperation = 10;
    
    /// @notice Indirizzo del Beacon per resolution WETH
    address public immutable beacon;

    // ==================== EVENTS ====================
    
    event TokenAdded(string indexed tokenCode, address tokenAddress, address priceFeed);
    event TokenRemoved(string indexed tokenCode);
    event HeartbeatUpdated(string indexed tokenCode, uint256 newHeartbeat);
    event TokenError(string indexed tokenCode, string errorMessage);
    event PriceStale(string indexed tokenCode, uint256 lastUpdateTime);
    event ErrorThresholdReached(string indexed tokenCode);
    event TokenErrorsReset(string indexed tokenCode);

    // ==================== CONSTRUCTOR ====================

    /**
     * @dev Constructor che imposta il Beacon address
     * @param _beacon Indirizzo del contratto Beacon
     */
    constructor(address _beacon) Ownable() {
        require(_beacon != address(0), "Invalid beacon address");
        beacon = _beacon;
        tokenCodesCount = 0;
    }

    /**
     * @notice Adds or updates a token in the pool
     * @param _tokenCode Unique identifier for the token
     * @param _tokenAddress Address of the ERC20 token contract
     * @param _priceFeed Address of the Chainlink price feed
     * @param _tokenDecimals Number of decimals for the token
     * @param _priceFeedDecimals Number of decimals in price feed
     * @param _heartbeat Maximum time between price updates
     */
    function manageTokenData(
        string memory _tokenCode,
        address _tokenAddress,
        address _priceFeed,
        uint8 _tokenDecimals,
        uint8 _priceFeedDecimals,
        uint256 _heartbeat
    ) external onlyOwner {
        // VALIDAZIONI CRITICHE
        require(bytes(_tokenCode).length > 0 && bytes(_tokenCode).length <= 16, "Invalid token code");
        require(_tokenAddress != address(0), "Invalid token address");
        require(_priceFeed != address(0), "Invalid price feed address");
        require(_heartbeat > 0, "Invalid heartbeat");
        
        // WETH EXCLUSION CHECK (CRITICO)
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        require(_tokenAddress != wethAddress, "Cannot add WETH as token");
        
        // MAX TOKENS LIMIT CHECK
        if (!tokenData[_tokenCode].isActive) {
            require(tokenCodesCount < maxTokensPerOperation, "Too many tokens");
            tokenCodes.push(_tokenCode);
            tokenCodesCount++;
        }
        
        // VALIDAZIONE PRICE FEED CHAINLINK COMPLETA
        try AggregatorV3Interface(_priceFeed).latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            require(price > 0, "Invalid price feed");
            require(updatedAt > 0, "Round not complete");  // VALIDAZIONE MANCANTE
            require(answeredInRound >= roundId, "Stale price feed");  // VALIDAZIONE CRITICA MANCANTE
        } catch {
            revert("Price feed validation failed");
        }
        
        // AGGIORNA TOKEN DATA
        tokenData[_tokenCode] = TokenInfo({
            tokenAddress: _tokenAddress,
            tokenDecimals: _tokenDecimals,
            tokenCode: _tokenCode,
            priceFeed: _priceFeed,
            priceFeedDecimals: _priceFeedDecimals,
            isActive: true,
            lastPriceTimestamp: 0,
            lastPrice: 0,
            heartbeat: _heartbeat,
            errorCount: 0
        });
        
        // Reset error count se token esistente
        tokenErrors[_tokenCode] = 0;
        
        emit TokenAdded(_tokenCode, _tokenAddress, _priceFeed);
    }

    /**
     * @notice Removes a token from the pool
     * @param _tokenCode The token code to remove
     */
    /**
     * @notice Removes a token from the pool
     * @param _tokenCode The token code to remove
     */
    function removeToken(string memory _tokenCode) external onlyOwner {
        require(tokenData[_tokenCode].isActive, "Token not active");

        // DEATTIVA TOKEN
        tokenData[_tokenCode].isActive = false;

        // RIMUOVI DA ARRAY (swap and pop)
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            if (keccak256(bytes(tokenCodes[i])) == keccak256(bytes(_tokenCode))) {
                tokenCodes[i] = tokenCodes[tokenCodes.length - 1];
                tokenCodes.pop();
                tokenCodesCount--;  // DECREMENTA COUNTER
                break;
            }
        }

        emit TokenRemoved(_tokenCode);
    }

    /**
     * @notice Updates the heartbeat duration for a token's price feed
     * @param _tokenCode The token to update
     * @param _newHeartbeat New maximum time between price updates
     */
    function updateHeartbeat(string memory _tokenCode, uint256 _newHeartbeat) external onlyOwner {
        require(_newHeartbeat > 0, "Invalid heartbeat");
        require(tokenData[_tokenCode].isActive, "Token not active");

        tokenData[_tokenCode].heartbeat = _newHeartbeat;
        emit HeartbeatUpdated(_tokenCode, _newHeartbeat);
    }

    /**
     * @notice Gets the latest price for a token from Chainlink without events
     * @param _tokenCode The token to get the price for
     * @return price The current price
     * @return updatedAt The timestamp of the price
     * @return isStale Whether the price is considered stale
     */
    /**
     * @notice Gets the latest price for a token from Chainlink with complete validations
     * @param _tokenCode The token to get the price for
     * @return price The current price
     * @return updatedAt The timestamp of the price
     * @return isStale Whether the price is considered stale
     */
    function getTokenPrice(string memory _tokenCode)
        public
        view
        returns (
            uint256 price,
            uint256 updatedAt,
            bool isStale
        )
    {
        // VALIDAZIONI
        require(tokenData[_tokenCode].isActive, "Token not active");

        TokenInfo memory token = tokenData[_tokenCode];
        AggregatorV3Interface priceFeed = AggregatorV3Interface(token.priceFeed);
        
        // LOGICA CHAINLINK CON VALIDAZIONI COMPLETE
        (
            uint80 roundId,
            int256 rawPrice,
            ,
            uint256 timestamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        // VALIDAZIONI CHAINLINK COMPLETE
        require(rawPrice > 0, "Invalid price");
        require(timestamp > 0, "Round not complete");  // VALIDAZIONE MANCANTE AGGIUNTA
        require(answeredInRound >= roundId, "Stale price");  // VALIDAZIONE CRITICA AGGIUNTA

        return (
            uint256(rawPrice),
            timestamp,
            block.timestamp - timestamp > token.heartbeat
        );
    }

    /**
     * @notice Gets the latest price and emits events if needed
     * @param _tokenCode The token to get the price for
     * @return price The current price
     * @return updatedAt The timestamp of the price
     */
    /**
     * @notice Gets the latest price and emits events if needed with error tracking
     * @param _tokenCode The token to get the price for
     * @return price The current price
     * @return updatedAt The timestamp of the price
     */
    function getTokenPriceWithEvents(string memory _tokenCode)
        public
        returns (uint256 price, uint256 updatedAt)
    {
        try this.getTokenPrice(_tokenCode) returns (uint256 priceResult, uint256 updatedAtResult, bool isStale) {
            // UPDATE STORAGE se prezzo fresco
            if (!isStale) {
                tokenData[_tokenCode].lastPrice = priceResult;
                tokenData[_tokenCode].lastPriceTimestamp = updatedAtResult;
                
                // Reset error count su successo
                if (tokenErrors[_tokenCode] > 0) {
                    tokenErrors[_tokenCode] = 0;
                    emit TokenErrorsReset(_tokenCode);
                }
            } else {
                emit PriceStale(_tokenCode, updatedAtResult);
            }
            
            return (priceResult, updatedAtResult);
            
        } catch Error(string memory reason) {
            // ERROR TRACKING
            tokenErrors[_tokenCode]++;
            tokenData[_tokenCode].errorCount++;
            
            emit TokenError(_tokenCode, reason);
            
            if (tokenErrors[_tokenCode] >= maxErrors) {
                emit ErrorThresholdReached(_tokenCode);
            }
            
            revert(reason);
        }
    }

    /**
     * @notice Gets the number of tokens managed by the pool
     * @return The number of tokens in the pool
     */
    function getTokenCount() external view returns (uint256) {
        return tokenCodes.length;
    }

    /**
     * @notice Gets a list of all active tokens in the pool
     * @return Array of active token codes
     */
    function getActiveTokens() external view returns (string[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            if (tokenData[tokenCodes[i]].isActive) {
                activeCount++;
            }
        }

        string[] memory activeTokens = new string[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            if (tokenData[tokenCodes[i]].isActive) {
                activeTokens[index] = tokenCodes[i];
                index++;
            }
        }
        return activeTokens;
    }

    // ==================== INTERFACE FUNCTIONS FOR OTHER MODULES ====================
    
    /**
     * @notice Checks if a token is active (REQUIRED BY SWAPMANAGER)
     * @param _tokenCode The token code to check
     * @return True if token is active
     */
    function isTokenActive(string memory _tokenCode) external view returns (bool) {
        return tokenData[_tokenCode].isActive;
    }

    /**
     * @notice Gets token address for a token code
     * @param _tokenCode The token code
     * @return Address of the token contract
     */
    function getTokenAddress(string memory _tokenCode) external view returns (address) {
        require(tokenData[_tokenCode].isActive, "Token not active");
        return tokenData[_tokenCode].tokenAddress;
    }

    /**
     * @notice Gets complete token info for other modules
     * @param _tokenCode The token code
     * @return TokenInfo struct with all data
     */
    function getTokenInfo(string memory _tokenCode) external view returns (TokenInfo memory) {
        require(tokenData[_tokenCode].isActive, "Token not active");
        return tokenData[_tokenCode];
    }

    /**
     * @notice Gets token price for module use (legacy function)
     * @param _tokenCode The token code
     * @return Current price from price feed
     */
    function getTokenPriceForModule(string memory _tokenCode) external view returns (uint256) {
        (uint256 price, , ) = getTokenPrice(_tokenCode);
        return price;
    }

    /**
     * @notice Validates a price feed for a token
     * @param _tokenCode The token code to validate
     * @return True if price feed is working correctly
     */
    function validatePriceFeed(string memory _tokenCode) external view returns (bool) {
        if (!tokenData[_tokenCode].isActive) {
            return false;
        }
        
        try this.getTokenPrice(_tokenCode) returns (uint256, uint256, bool) {
            return true;
        } catch {
            return false;
        }
    }

    // ==================== ERROR MANAGEMENT ====================
    
    /**
     * @notice Gets error count for a token
     * @param _tokenCode The token code
     * @return Number of errors for this token
     */
    function getTokenErrors(string memory _tokenCode) external view returns (uint256) {
        return tokenErrors[_tokenCode];
    }

    /**
     * @notice Resets error count for a token (owner only)
     * @param _tokenCode The token code to reset
     */
    function resetTokenErrors(string memory _tokenCode) external onlyOwner {
        tokenErrors[_tokenCode] = 0;
        tokenData[_tokenCode].errorCount = 0;
        emit TokenErrorsReset(_tokenCode);
    }

    /**
     * @notice Updates max errors threshold
     * @param _maxErrors New maximum errors before alert
     */
    function setMaxErrors(uint256 _maxErrors) external onlyOwner {
        require(_maxErrors > 0 && _maxErrors <= 100, "Invalid max errors");
        maxErrors = _maxErrors;
    }

    /**
     * @notice Updates max tokens per operation
     * @param _maxTokens New maximum tokens limit
     */
    function setMaxTokensPerOperation(uint256 _maxTokens) external onlyOwner {
        require(_maxTokens > 0 && _maxTokens <= 50, "Invalid max tokens");
        maxTokensPerOperation = _maxTokens;
    }
}
