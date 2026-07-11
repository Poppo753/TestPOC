// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/IParameterManagerForModules.sol";
import "./interfaces/IOracleAdapter.sol";

/**
 * @title TokenManager
 * @dev Gestione token registry con oracle modularity tramite IOracleAdapter
 * @notice Refactored per supportare oracle providers plug & play (Chainlink, Pyth, etc.)
 * @custom:security-contact security@yourdomain.com
 */
contract TokenManager is Ownable {
    struct TokenInfo {
        address tokenAddress;
        uint8 tokenDecimals;
        string tokenCode;
        bool isActive;
        uint256 lastPriceTimestamp;
        uint256 lastPrice;
        uint256 heartbeat;
        uint256 errorCount;
    }

    /// @notice Oracle adapter for price feeds (pluggable)
    IOracleAdapter public oracleAdapter;

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
    
    /// @notice Indirizzo del Beacon per resolution base asset
    address public immutable beacon;

    /// @notice Code of the base asset (e.g., "USDC", "WETH") — set by owner
    string public baseAssetCode;

    // ==================== EVENTS ====================
    
    event TokenAdded(string indexed tokenCode, address tokenAddress, address oracleAdapter);
    event TokenRemoved(string indexed tokenCode);
    event HeartbeatUpdated(string indexed tokenCode, uint256 newHeartbeat);
    event TokenError(string indexed tokenCode, string errorMessage);
    event PriceStale(string indexed tokenCode, uint256 lastUpdateTime);
    event ErrorThresholdReached(string indexed tokenCode);
    event TokenErrorsReset(string indexed tokenCode);
    event OracleAdapterUpdated(address indexed oldAdapter, address indexed newAdapter);
    event BaseAssetCodeSet(string baseAssetCode);

    // ==================== CONSTRUCTOR ====================

    /**
     * @dev Constructor che imposta Beacon e OracleAdapter iniziale
     * @param _beacon Indirizzo del contratto Beacon
     * @param _oracleAdapter Indirizzo del contratto OracleAdapter iniziale
     */
    constructor(address _beacon, address _oracleAdapter) Ownable() {
        require(_beacon != address(0), "Invalid beacon address");
        require(_oracleAdapter != address(0), "Invalid oracle adapter");
        beacon = _beacon;
        oracleAdapter = IOracleAdapter(_oracleAdapter);
        tokenCodesCount = 0;
    }

    // ==================== ORACLE ADAPTER MANAGEMENT ====================

    /**
     * @notice Update oracle adapter to a new implementation
     * @dev Owner only - allows switching between oracle providers (Chainlink, Pyth, etc.)
     * @param _newAdapter Address of new IOracleAdapter implementation
     */
    function setOracleAdapter(address _newAdapter) external onlyOwner {
        require(_newAdapter != address(0), "Invalid adapter address");
        
        address oldAdapter = address(oracleAdapter);
        oracleAdapter = IOracleAdapter(_newAdapter);
        
        emit OracleAdapterUpdated(oldAdapter, _newAdapter);
    }

    /**
     * @notice Sets the base asset code used for price lookups
     * @dev Owner only — must match a token supported by the oracle adapter
     * @param _code The base asset code (e.g., "USDC", "WETH", "WBTC")
     */
    function setBaseAssetCode(string memory _code) external onlyOwner {
        require(bytes(_code).length > 0 && bytes(_code).length <= 16, "Invalid code");
        require(oracleAdapter.supportsToken(_code), "Token not supported by oracle");
        baseAssetCode = _code;
        emit BaseAssetCodeSet(_code);
    }

    // ==================== TOKEN MANAGEMENT ====================

    /**
     * @notice Adds or updates a token in the pool (REFACTORED for oracle modularity)
     * @dev Oracle adapter must support token BEFORE calling this
     * @param _tokenCode Unique identifier for the token
     * @param _tokenAddress Address of the ERC20 token contract
     * @param _tokenDecimals Number of decimals for the token
     * @param _heartbeat Maximum time between price updates
     */
    function manageTokenData(
        string memory _tokenCode,
        address _tokenAddress,
        uint8 _tokenDecimals,
        uint256 _heartbeat
    ) external onlyOwner {
        // VALIDAZIONI CRITICHE
        require(bytes(_tokenCode).length > 0 && bytes(_tokenCode).length <= 16, "Invalid token code");
        require(_tokenAddress != address(0), "Invalid token address");
        require(_heartbeat > 0, "Invalid heartbeat");
        
        // VERIFY ORACLE SUPPORTS TOKEN (NEW VALIDATION)
        require(oracleAdapter.supportsToken(_tokenCode), "Token not supported by oracle");
        
        // BASE ASSET EXCLUSION CHECK (CRITICO)
        // Il base asset (WETH, USDC, etc.) è risolto via Beacon, non registrato qui
        address baseAsset = IBeacon(beacon).getImplementation("BASE_ASSET");
        require(_tokenAddress != baseAsset, "Cannot add base asset as token");
        
        // MAX TOKENS LIMIT CHECK
        if (!tokenData[_tokenCode].isActive) {
            require(tokenCodesCount < maxTokensPerOperation, "Too many tokens");
            tokenCodes.push(_tokenCode);
            tokenCodesCount++;
        }
        
        // AGGIORNA TOKEN DATA (REMOVED price feed params)
        tokenData[_tokenCode] = TokenInfo({
            tokenAddress: _tokenAddress,
            tokenDecimals: _tokenDecimals,
            tokenCode: _tokenCode,
            isActive: true,
            lastPriceTimestamp: 0,
            lastPrice: 0,
            heartbeat: _heartbeat,
            errorCount: 0
        });
        
        // Reset error count se token esistente
        tokenErrors[_tokenCode] = 0;
        
        emit TokenAdded(_tokenCode, _tokenAddress, address(oracleAdapter));
    }

    /**
     * @notice Adds or updates a token in the pool (LEGACY - backward compatibility)
     * @dev Kept for backward compatibility - ignores price feed params
     * @param _tokenCode Unique identifier for the token
     * @param _tokenAddress Address of the ERC20 token contract
     * @param _tokenDecimals Number of decimals for the token
     * @param _heartbeat Maximum time between price updates
     */
    function manageTokenData(
        string memory _tokenCode,
        address _tokenAddress,
        address /* _priceFeed */,
        uint8 _tokenDecimals,
        uint8 /* _priceFeedDecimals */,
        uint256 _heartbeat
    ) external onlyOwner {
        // LEGACY FUNCTION - duplicates logic for backward compatibility
        // Price feed params are IGNORED (oracle adapter handles price feeds now)
        
        // VALIDAZIONI CRITICHE
        require(bytes(_tokenCode).length > 0 && bytes(_tokenCode).length <= 16, "Invalid token code");
        require(_tokenAddress != address(0), "Invalid token address");
        require(_heartbeat > 0, "Invalid heartbeat");
        
        // VERIFY ORACLE SUPPORTS TOKEN
        require(oracleAdapter.supportsToken(_tokenCode), "Token not supported by oracle");
        
        // BASE ASSET EXCLUSION CHECK (CRITICO)
        address baseAsset = IBeacon(beacon).getImplementation("BASE_ASSET");
        require(_tokenAddress != baseAsset, "Cannot add base asset as token");
        
        // MAX TOKENS LIMIT CHECK
        if (!tokenData[_tokenCode].isActive) {
            require(tokenCodesCount < maxTokensPerOperation, "Too many tokens");
            tokenCodes.push(_tokenCode);
            tokenCodesCount++;
        }

        // UPDATE/ADD TOKEN INFO
        tokenData[_tokenCode] = TokenInfo({
            tokenAddress: _tokenAddress,
            tokenDecimals: _tokenDecimals,
            tokenCode: _tokenCode,
            isActive: true,
            lastPriceTimestamp: 0,
            lastPrice: 0,
            heartbeat: _heartbeat,
            errorCount: 0
        });

        emit TokenAdded(_tokenCode, _tokenAddress, address(oracleAdapter));
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
     * @notice Gets the latest price for a token via oracle adapter
     * @dev CRITICAL: Interface remains IDENTICAL for backward compatibility
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

        // DELEGATE TO ORACLE ADAPTER (NEW LOGIC)
        (uint256 adapterPrice, uint256 timestamp, bool isValid) = oracleAdapter.getPrice(_tokenCode);
        
        // Revert if oracle returns stale/invalid price
        if (!isValid) {
            revert IOracleAdapter.StalePrice(timestamp, 0);
        }
        
        // Convert isValid to isStale (always false here since we reverted if invalid)
        bool priceIsStale = false;
        
        return (adapterPrice, timestamp, priceIsStale);
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
     * @notice Gets the base asset price from oracle adapter
     * @dev Returns the price of the configured base asset (set via setBaseAssetCode).
     *      Bypasses token registration check since base asset is intentionally excluded
     *      from TokenManager registration (to avoid error tracking/heartbeat interference).
     * @return price Current base asset price from oracle adapter (18 decimals normalized)
     */
    function getBaseAssetPrice() external view returns (uint256) {
        require(bytes(baseAssetCode).length > 0, "Base asset code not set");
        (uint256 price, , bool isValid) = oracleAdapter.getPrice(baseAssetCode);
        require(isValid, "Oracle price invalid");
        return price;
    }

    /**
     * @notice Converts a USD-denominated value to base asset units
     * @dev Used by LensAdapters for protocols that return aggregated USD values
     *      (Aave, Compound, GMX). Formula uses overflow-safe variable exponent.
     *      The base asset price is fetched from the oracle adapter (18-dec normalized).
     * @param valueInUsd The value in USD (with usdDecimals precision)
     * @param usdDecimals Number of decimals in the USD value (8 for Aave/Compound, 30 for GMX)
     * @return Value in base asset units (with baseDecimals precision)
     */
    function convertUsdToBaseAsset(
        uint256 valueInUsd,
        uint8 usdDecimals
    ) external view returns (uint256) {
        if (valueInUsd == 0) return 0;
        require(bytes(baseAssetCode).length > 0, "Base asset code not set");

        // Base asset price in USD, normalized to 18 decimals.
        // IMPORTANT: We use getPriceInUsd (not getPrice) because the base asset price
        // must be expressed in USD to convert a USD value, regardless of the oracle's
        // targetDenomination. getPrice would return a denomination-relative price
        // (e.g. 1.0 when base asset == targetDenomination), which is wrong here.
        (uint256 baseAssetPrice, , bool isValid) = oracleAdapter.getPriceInUsd(baseAssetCode);
        require(isValid, "Oracle price invalid");
        if (baseAssetPrice == 0) return 0;

        // Base asset decimals (6 for USDC, 18 for WETH, 8 for WBTC)
        address baseAsset = IBeacon(beacon).getImplementation("BASE_ASSET");
        uint8 baseDecimals = IERC20Metadata(baseAsset).decimals();

        // Overflow-safe formula with variable exponent
        // exponent = baseDecimals + 18 - usdDecimals
        int256 exponent = int256(uint256(baseDecimals)) + 18 - int256(uint256(usdDecimals));

        if (exponent >= 0) {
            return (valueInUsd * (10 ** uint256(exponent))) / baseAssetPrice;
        } else {
            return valueInUsd / (baseAssetPrice * (10 ** uint256(-exponent)));
        }
    }

    /**
     * @notice Gets price decimals from oracle adapter
     * @param _tokenCode The token code
     * @return Decimals used by the price feed
     */
    function getPriceDecimals(string memory _tokenCode) external view returns (uint256) {
        require(tokenData[_tokenCode].isActive, "Token not active");
        return oracleAdapter.getPriceDecimals(_tokenCode);
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
