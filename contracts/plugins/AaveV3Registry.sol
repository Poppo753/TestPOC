// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IAaveV3Registry.sol";

/**
 * @title AaveV3Registry
 * @notice Registry centralizzato per asset Aave V3 su Arbitrum
 * @dev Registrato nel Beacon come "AaveV3Registry"
 *      Maps tokenCode (es. "WETH") → underlying, aToken, variableDebtToken
 * 
 * DIFFERENZA CHIAVE VS EULER:
 * - Euler ha vault separati per ogni token (ERC-4626)
 * - Aave V3 ha un Pool unico condiviso
 * - Per Aave, il Registry mappa token → aToken + debtToken (non vault)
 * 
 * INDIRIZZI AAVE V3 ARBITRUM:
 * - Pool: 0x794a61358D6845594F94dc1DB02A252b5b4814aD
 * - Oracle: 0xb56c2F0B653B2e0b10C9b928C8580Ac5Df02C7C7
 * - WETH aToken: 0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8
 * - USDC aToken: 0x625E7708f30cA75bfd92586e17077590C60eb4cD
 * - USDCn aToken: 0x724dc807b04555b71ed48a6896b6F41593b8C637
 * 
 * @author Project4 Team
 */
contract AaveV3Registry is IAaveV3Registry, Ownable {

    // ========== STATE ==========

    /// @notice Mappa tokenCode → TokenConfig
    mapping(string => TokenConfig) private _tokenConfigs;

    /// @notice Array di tutti i tokenCode registrati (per iterazione)
    string[] private _registeredTokens;

    /// @notice Mappa tokenCode → indice in _registeredTokens (per rimozione efficiente)
    mapping(string => uint256) private _tokenIndex;

    /// @notice Flag per verificare se un tokenCode è registrato
    mapping(string => bool) private _isRegistered;

    // ========== CONSTRUCTOR ==========

    constructor() Ownable() {}

    // ========== ADMIN FUNCTIONS ==========

    /**
     * @notice Configura un token per Aave V3
     * @dev Solo owner può chiamare. Deve essere chiamato PRIMA di transferOwnership al Plugin!
     * @param tokenCode Codice del token (es. "WETH", "USDC")
     * @param underlying Indirizzo dell'asset sottostante
     * @param aToken Indirizzo dell'aToken corrispondente
     * @param variableDebtToken Indirizzo del variable debt token
     */
    function configureToken(
        string memory tokenCode,
        address underlying,
        address aToken,
        address variableDebtToken
    ) external override onlyOwner {
        if (bytes(tokenCode).length == 0) revert TokenCodeEmpty();
        if (underlying == address(0)) revert InvalidAddress();
        if (aToken == address(0)) revert InvalidAddress();
        if (variableDebtToken == address(0)) revert InvalidAddress();

        bool isNew = !_isRegistered[tokenCode];

        _tokenConfigs[tokenCode] = TokenConfig({
            underlying: underlying,
            aToken: aToken,
            variableDebtToken: variableDebtToken,
            isActive: true
        });

        if (isNew) {
            _tokenIndex[tokenCode] = _registeredTokens.length;
            _registeredTokens.push(tokenCode);
            _isRegistered[tokenCode] = true;
        }

        emit TokenConfigured(tokenCode, underlying, aToken, variableDebtToken);
    }

    /**
     * @notice Configura multipli token in una singola transazione
     * @param tokenCodes Array di codici token
     * @param underlyings Array di indirizzi underlying
     * @param aTokens Array di indirizzi aToken
     * @param variableDebtTokens Array di indirizzi variableDebtToken
     */
    function configureTokensBatch(
        string[] memory tokenCodes,
        address[] memory underlyings,
        address[] memory aTokens,
        address[] memory variableDebtTokens
    ) external onlyOwner {
        require(
            tokenCodes.length == underlyings.length &&
            tokenCodes.length == aTokens.length &&
            tokenCodes.length == variableDebtTokens.length,
            "AaveV3Registry: length mismatch"
        );

        for (uint256 i = 0; i < tokenCodes.length; i++) {
            if (bytes(tokenCodes[i]).length == 0) revert TokenCodeEmpty();
            if (underlyings[i] == address(0)) revert InvalidAddress();
            if (aTokens[i] == address(0)) revert InvalidAddress();
            if (variableDebtTokens[i] == address(0)) revert InvalidAddress();

            bool isNew = !_isRegistered[tokenCodes[i]];

            _tokenConfigs[tokenCodes[i]] = TokenConfig({
                underlying: underlyings[i],
                aToken: aTokens[i],
                variableDebtToken: variableDebtTokens[i],
                isActive: true
            });

            if (isNew) {
                _tokenIndex[tokenCodes[i]] = _registeredTokens.length;
                _registeredTokens.push(tokenCodes[i]);
                _isRegistered[tokenCodes[i]] = true;
            }

            emit TokenConfigured(tokenCodes[i], underlyings[i], aTokens[i], variableDebtTokens[i]);
        }
    }

    /**
     * @notice Rimuove un token dal registry
     * @param tokenCode Codice del token da rimuovere
     */
    function removeToken(string memory tokenCode) external override onlyOwner {
        if (!_isRegistered[tokenCode]) revert TokenNotConfigured(tokenCode);

        // Swap and pop per rimozione efficiente
        uint256 indexToRemove = _tokenIndex[tokenCode];
        uint256 lastIndex = _registeredTokens.length - 1;

        if (indexToRemove != lastIndex) {
            string memory lastToken = _registeredTokens[lastIndex];
            _registeredTokens[indexToRemove] = lastToken;
            _tokenIndex[lastToken] = indexToRemove;
        }

        _registeredTokens.pop();
        delete _tokenIndex[tokenCode];
        delete _isRegistered[tokenCode];
        delete _tokenConfigs[tokenCode];

        emit TokenRemoved(tokenCode);
    }

    /**
     * @notice Attiva/disattiva un token
     * @param tokenCode Codice del token
     * @param active true = attivo, false = disattivato
     */
    function setTokenActive(string memory tokenCode, bool active) external override onlyOwner {
        if (!_isRegistered[tokenCode]) revert TokenNotConfigured(tokenCode);
        _tokenConfigs[tokenCode].isActive = active;
        emit TokenStatusChanged(tokenCode, active);
    }

    // ========== VIEW FUNCTIONS ==========

    /// @inheritdoc IAaveV3Registry
    function getTokenConfig(string memory tokenCode) external view override returns (TokenConfig memory) {
        if (!_isRegistered[tokenCode]) revert TokenNotConfigured(tokenCode);
        return _tokenConfigs[tokenCode];
    }

    /// @inheritdoc IAaveV3Registry
    function getUnderlying(string memory tokenCode) external view override returns (address) {
        if (!_isRegistered[tokenCode]) revert TokenNotConfigured(tokenCode);
        return _tokenConfigs[tokenCode].underlying;
    }

    /// @inheritdoc IAaveV3Registry
    function getAToken(string memory tokenCode) external view override returns (address) {
        if (!_isRegistered[tokenCode]) revert TokenNotConfigured(tokenCode);
        return _tokenConfigs[tokenCode].aToken;
    }

    /// @inheritdoc IAaveV3Registry
    function getVariableDebtToken(string memory tokenCode) external view override returns (address) {
        if (!_isRegistered[tokenCode]) revert TokenNotConfigured(tokenCode);
        return _tokenConfigs[tokenCode].variableDebtToken;
    }

    /// @inheritdoc IAaveV3Registry
    function isTokenConfigured(string memory tokenCode) external view override returns (bool) {
        return _isRegistered[tokenCode];
    }

    /// @inheritdoc IAaveV3Registry
    function getRegisteredTokens() external view override returns (string[] memory) {
        return _registeredTokens;
    }

    /// @inheritdoc IAaveV3Registry
    function getRegisteredTokenCount() external view override returns (uint256) {
        return _registeredTokens.length;
    }

    /**
     * @notice Get underlying address with safe fallback (returns address(0) if not found)
     * @param tokenCode Token code
     * @return underlying address or address(0)
     */
    function getUnderlyingSafe(string memory tokenCode) external view returns (address) {
        if (!_isRegistered[tokenCode]) return address(0);
        return _tokenConfigs[tokenCode].underlying;
    }

    /**
     * @notice Get aToken address with safe fallback
     * @param tokenCode Token code
     * @return aToken address or address(0)
     */
    function getATokenSafe(string memory tokenCode) external view returns (address) {
        if (!_isRegistered[tokenCode]) return address(0);
        return _tokenConfigs[tokenCode].aToken;
    }

    /**
     * @notice Get variableDebtToken address with safe fallback
     * @param tokenCode Token code
     * @return variableDebtToken address or address(0)
     */
    function getVariableDebtTokenSafe(string memory tokenCode) external view returns (address) {
        if (!_isRegistered[tokenCode]) return address(0);
        return _tokenConfigs[tokenCode].variableDebtToken;
    }
}
