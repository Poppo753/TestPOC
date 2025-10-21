// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/ITokenManagerForModules.sol";
import "./interfaces/IProxyGeneral.sol";
import "./interfaces/IWETH.sol";

/**
 * @title ValueCalculator
 * @dev Calcolo valore totale pool e cache system per ottimizzazione gas
 * @custom:security-contact security@yourdomain.com
 */
contract ValueCalculator is Ownable {
    
    // ==================== STRUCTS ====================
    
    struct TokenValueCache {
        uint256 value;          // Valore totale posizione in ETH
        uint256 pricePerToken;  // Prezzo per singolo token (scale: priceFeedDecimals)
        uint256 timestamp;      // Quando aggiornata
        bool isValid;           // Se cache è valida
    }

    struct PoolValueInfo {
        uint256 totalValue;                    // Valore totale pool in ETH
        TokenValueInfo[] tokenValues;          // Info per ogni token
    }

    struct TokenValueInfo {
        string tokenCode;
        uint256 value;          // Valore posizione in ETH
        uint256 balance;        // Balance token nel ProxyGeneral
        uint256 pricePerToken;  // Prezzo per token
        uint256 percentage;     // Percentuale (basis points, 10000 = 100%)
    }

    // ==================== STORAGE ====================

    /// @notice Beacon address per resolution moduli
    address public immutable beacon;

    /// @notice Cache dei valori token con TTL
    mapping(string => TokenValueCache) private tokenValueCache;
    
    /// @notice Error tracking per token
    mapping(string => uint256) private tokenErrors;

    /// @notice Parametri per cache e validazioni
    uint256 public cacheDuration = 5 minutes;
    uint256 public maxPriceAge = 1 hours;
    uint256 public maxErrors = 3;

    // ==================== EVENTS ====================

    event CacheUpdated(string indexed tokenCode, uint256 value, uint256 pricePerToken);
    event PoolValueUpdated(uint256 totalValue);
    event CacheCleared(string indexed tokenCode);
    event TokenError(string indexed tokenCode, string errorMessage);
    event ErrorThresholdReached(string indexed tokenCode);

    // ==================== MODIFIERS ====================

    modifier onlyAuthorized() {
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        require(
            msg.sender == owner() || 
            msg.sender == IBeacon(beacon).getImplementation("LiquidityManager") ||
            msg.sender == proxyGeneral,
            "Not authorized"
        );
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(address _beacon) Ownable() {
        require(_beacon != address(0), "Invalid beacon address");
        beacon = _beacon;
    }

    // ==================== TOKEN VALUE CALCULATION ====================

    /**
     * @notice Calcola il valore di un token con cache system
     * @param _tokenCode Codice del token
     * @return Valore totale della posizione in ETH
     */
    function calculateTokenValue(string memory _tokenCode) public returns (uint256) {
        // CHECK CACHE FIRST
        (uint256 cachedValue, bool isCacheValid) = getCachedTokenValue(_tokenCode);
        if (isCacheValid) {
            return cachedValue;
        }
        
        // GET FRESH PRICE
        ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
        
        try tokenManager.getTokenPrice(_tokenCode) returns (uint256 price, uint256 timestamp, bool isStale) {
            // VALIDATE PRICE AGE
            require(!isStale && block.timestamp - timestamp <= maxPriceAge, "Price too old");
            
            // GET TOKEN BALANCE FROM PROXYGENERAL
            address tokenAddress = tokenManager.getTokenAddress(_tokenCode);
            address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
            uint256 tokenBalance = IERC20(tokenAddress).balanceOf(proxyGeneral);
            
            // GET TOKEN INFO FOR DECIMALS
            ITokenManagerForModules.TokenInfo memory tokenInfo = tokenManager.getTokenInfo(_tokenCode);
            
            // CALCULATE VALUE (normalize by price feed decimals)
            uint256 value = (tokenBalance * price) / (10 ** tokenInfo.priceFeedDecimals);
            
            // UPDATE CACHE
            tokenValueCache[_tokenCode] = TokenValueCache({
                value: value,
                pricePerToken: price,
                timestamp: block.timestamp,
                isValid: true
            });
            
            // RESET ERRORS ON SUCCESS
            if (tokenErrors[_tokenCode] > 0) {
                tokenErrors[_tokenCode] = 0;
            }
            
            emit CacheUpdated(_tokenCode, value, price);
            return value;
            
        } catch Error(string memory reason) {
            // ERROR HANDLING
            tokenErrors[_tokenCode]++;
            
            emit TokenError(_tokenCode, reason);
            
            if (tokenErrors[_tokenCode] >= maxErrors) {
                emit ErrorThresholdReached(_tokenCode);
            }
            
            revert(string(abi.encodePacked("Value calculation failed for ", _tokenCode, ": ", reason)));
        }
    }

    /**
     * @notice Calcola valore token in modalità view (senza aggiornare cache)
     * @param _tokenCode Codice del token
     * @return Valore della posizione
     */
    function calculateTokenValueView(string memory _tokenCode) external view returns (uint256) {
        // VIEW-ONLY VERSION che non aggiorna cache/eventi
        (uint256 cachedValue, bool isCacheValid) = getCachedTokenValue(_tokenCode);
        if (isCacheValid) {
            return cachedValue;
        }
        
        // Calcola senza aggiornare storage
        ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
        (uint256 price, uint256 timestamp, bool isStale) = tokenManager.getTokenPrice(_tokenCode);
        
        require(!isStale && block.timestamp - timestamp <= maxPriceAge, "Price not reliable");
        
        address tokenAddress = tokenManager.getTokenAddress(_tokenCode);
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        uint256 tokenBalance = IERC20(tokenAddress).balanceOf(proxyGeneral);
        
        ITokenManagerForModules.TokenInfo memory tokenInfo = tokenManager.getTokenInfo(_tokenCode);
        return (tokenBalance * price) / (10 ** tokenInfo.priceFeedDecimals);
    }

    /**
     * @notice Calcola il valore totale del pool con percentuali
     * @return PoolValueInfo con valore totale e breakdown per token
     */
    function getTotalPoolValue() external returns (PoolValueInfo memory) {
        ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        
        // START WITH WETH BALANCE
        uint256 wethBalance = IWETH(wethAddress).balanceOf(proxyGeneral);
        uint256 totalValue = wethBalance;
        
        // GET ACTIVE TOKENS
        string[] memory activeTokens = tokenManager.getActiveTokens();
        
        // CALCULATE VALUE FOR EACH TOKEN
        TokenValueInfo[] memory tokenValues = new TokenValueInfo[](activeTokens.length + 1);
        
        // WETH info (index 0)
        tokenValues[0] = TokenValueInfo({
            tokenCode: "WETH",
            value: wethBalance,
            balance: wethBalance,
            pricePerToken: 1e18, // 1 WETH = 1 ETH by definition
            percentage: 0 // Will be calculated after total
        });
        
        // CALCULATE EACH TOKEN VALUE
        for (uint256 i = 0; i < activeTokens.length; i++) {
            string memory tokenCode = activeTokens[i];
            
            try this.calculateTokenValue(tokenCode) returns (uint256 tokenValue) {
                // GET ADDITIONAL INFO
                address tokenAddress = tokenManager.getTokenAddress(tokenCode);
                uint256 tokenBalance = IERC20(tokenAddress).balanceOf(proxyGeneral);
                
                TokenValueCache memory cache = tokenValueCache[tokenCode];
                uint256 pricePerToken = cache.isValid ? cache.pricePerToken : 0;
                
                tokenValues[i + 1] = TokenValueInfo({
                    tokenCode: tokenCode,
                    value: tokenValue,
                    balance: tokenBalance,
                    pricePerToken: pricePerToken,
                    percentage: 0 // Will be calculated after total
                });
                
                totalValue += tokenValue;
                
            } catch Error(string memory reason) {
                // Log error but continue with other tokens
                emit TokenError(tokenCode, reason);
                
                tokenValues[i + 1] = TokenValueInfo({
                    tokenCode: tokenCode,
                    value: 0,
                    balance: 0,
                    pricePerToken: 0,
                    percentage: 0
                });
            }
        }
        
        // CALCULATE PERCENTAGES (basis points)
        if (totalValue > 0) {
            for (uint256 i = 0; i < tokenValues.length; i++) {
                tokenValues[i].percentage = (tokenValues[i].value * 10000) / totalValue;
            }
        }
        
        emit PoolValueUpdated(totalValue);
        
        return PoolValueInfo({
            totalValue: totalValue,
            tokenValues: tokenValues
        });
    }

    /**
     * @notice Versione view del calcolo valore totale
     * @return Valore totale del pool
     */
    function getTotalPoolValueView() external view returns (uint256) {
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        
        uint256 totalValue = IWETH(wethAddress).balanceOf(proxyGeneral);
        
        ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
        string[] memory activeTokens = tokenManager.getActiveTokens();
        
        for (uint256 i = 0; i < activeTokens.length; i++) {
            try this.calculateTokenValueView(activeTokens[i]) returns (uint256 tokenValue) {
                totalValue += tokenValue;
            } catch {
                // Skip failed tokens in view mode
            }
        }
        
        return totalValue;
    }

    // ==================== CACHE MANAGEMENT ====================

    /**
     * @notice Ottiene valore da cache se valido
     * @param _tokenCode Codice del token
     * @return value Valore cachato, isValid Se cache è valida
     */
    function getCachedTokenValue(string memory _tokenCode) public view returns (uint256 value, bool isValid) {
        TokenValueCache memory cache = tokenValueCache[_tokenCode];
        
        if (cache.isValid && block.timestamp - cache.timestamp <= cacheDuration) {
            return (cache.value, true);
        }
        
        return (0, false);
    }

    /**
     * @notice Ottiene prezzo da cache se valido
     * @param _tokenCode Codice del token
     * @return pricePerToken Prezzo cachato per token, isValid Se cache è valida
     */
    function getCachedTokenPrice(string memory _tokenCode) external view returns (uint256 pricePerToken, bool isValid) {
        TokenValueCache memory cache = tokenValueCache[_tokenCode];
        
        if (cache.isValid && block.timestamp - cache.timestamp <= cacheDuration) {
            return (cache.pricePerToken, true);
        }
        
        return (0, false);
    }

    /**
     * @notice Invalida cache per un token
     * @param _tokenCode Codice del token
     */
    function invalidateCache(string memory _tokenCode) external onlyAuthorized {
        delete tokenValueCache[_tokenCode];
        emit CacheCleared(_tokenCode);
    }

    /**
     * @notice Invalida tutta la cache
     */
    function invalidateAllCache() external onlyOwner {
        ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
        string[] memory activeTokens = tokenManager.getActiveTokens();
        
        for (uint256 i = 0; i < activeTokens.length; i++) {
            delete tokenValueCache[activeTokens[i]];
            emit CacheCleared(activeTokens[i]);
        }
    }

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * @notice Seleziona token per swap basato su percentuale più bassa
     * @param targetValue Valore target da ottenere dallo swap
     * @return tokenCode Codice del token selezionato, amount Quantità da swappare
     */
    function selectTokenForSwap(uint256 targetValue) external view returns (string memory tokenCode, uint256 amount) {
        // GET CURRENT POOL STATE - Use internal call since we need PoolValueInfo struct
        // Note: This requires getTotalPoolValue to be made view-compatible or use getTotalPoolValueView differently
        uint256 totalValue = this.getTotalPoolValueView();
        
        // For now, return empty values - this function needs proper implementation
        // based on actual pool state tracking
        return ("", 0);
    }

    /**
     * @notice Ottiene info dettagliate per un token
     * @param _tokenCode Codice del token
     * @return TokenValueInfo con tutti i dettagli
     */
    function getTokenValueInfo(string memory _tokenCode) external view returns (TokenValueInfo memory) {
        (uint256 cachedValue, bool isCacheValid) = getCachedTokenValue(_tokenCode);
        
        if (!isCacheValid) {
            try this.calculateTokenValueView(_tokenCode) returns (uint256 value) {
                cachedValue = value;
            } catch {
                cachedValue = 0;
            }
        }
        
        ITokenManagerForModules tokenManager = ITokenManagerForModules(IBeacon(beacon).getImplementation("TokenManager"));
        address tokenAddress = tokenManager.getTokenAddress(_tokenCode);
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        uint256 tokenBalance = IERC20(tokenAddress).balanceOf(proxyGeneral);
        
        TokenValueCache memory cache = tokenValueCache[_tokenCode];
        
        uint256 totalPoolValue = this.getTotalPoolValueView();
        uint256 percentage = totalPoolValue > 0 ? (cachedValue * 10000) / totalPoolValue : 0;
        
        return TokenValueInfo({
            tokenCode: _tokenCode,
            value: cachedValue,
            balance: tokenBalance,
            pricePerToken: cache.pricePerToken,
            percentage: percentage
        });
    }

    /**
     * @notice Valida lo stato del pool
     * @return isValid Se il pool è in stato valido, errorReason Motivo errore se non valido
     */
    function validatePoolValue() external view returns (bool isValid, string memory errorReason) {
        try this.getTotalPoolValueView() returns (uint256 totalValue) {
            if (totalValue == 0) {
                return (false, "Pool value is zero");
            }
            return (true, "");
        } catch Error(string memory reason) {
            return (false, reason);
        }
    }

    // ==================== PARAMETER MANAGEMENT ====================

    /**
     * @notice Aggiorna durata cache
     * @param _cacheDuration Nuova durata cache in secondi
     */
    function setCacheDuration(uint256 _cacheDuration) external onlyOwner {
        require(_cacheDuration >= 1 minutes && _cacheDuration <= 1 hours, "Invalid cache duration");
        cacheDuration = _cacheDuration;
    }

    /**
     * @notice Aggiorna età massima prezzo
     * @param _maxPriceAge Nuova età massima in secondi
     */
    function setMaxPriceAge(uint256 _maxPriceAge) external onlyOwner {
        require(_maxPriceAge >= 5 minutes && _maxPriceAge <= 24 hours, "Invalid max price age");
        maxPriceAge = _maxPriceAge;
    }

    /**
     * @notice Aggiorna soglia errori massimi
     * @param _maxErrors Nuova soglia errori
     */
    function setMaxErrors(uint256 _maxErrors) external onlyOwner {
        require(_maxErrors > 0 && _maxErrors <= 100, "Invalid max errors");
        maxErrors = _maxErrors;
    }
}
