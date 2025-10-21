// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract TokenPriceManager {
    struct TokenInfo {
        address tokenAddress;
        uint8 tokenDecimals;
        string tokenCode; // Custom identifier
        address priceFeed;
        uint8 priceFeedDecimals;
    }

    mapping(string => TokenInfo) private tokenData;
    string[] private tokenCodes; // Array per tracciare i codici
    address public owner;

    event TokenAdded(string tokenCode, address tokenAddress, address priceFeed);
    event TokenRemoved(string tokenCode);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Adds or removes a token based on the presence of its code.
     */
    function manageTokenData(
        address tokenAddress,
        uint8 tokenDecimals,
        string memory tokenCode,
        address priceFeed,
        uint8 priceFeedDecimals
    ) external onlyOwner {
        if (bytes(tokenData[tokenCode].tokenCode).length > 0) {
            // Remove existing entry
            delete tokenData[tokenCode];

            // Rimuovi il codice dall'array
            for (uint256 i = 0; i < tokenCodes.length; i++) {
                if (keccak256(abi.encodePacked(tokenCodes[i])) == keccak256(abi.encodePacked(tokenCode))) {
                    tokenCodes[i] = tokenCodes[tokenCodes.length - 1];
                    tokenCodes.pop();
                    break;
                }
            }

            emit TokenRemoved(tokenCode);
        } else {
            // Add new entry
            tokenData[tokenCode] = TokenInfo(
                tokenAddress,
                tokenDecimals,
                tokenCode,
                priceFeed,
                priceFeedDecimals
            );

            // Aggiungi il codice all'array
            tokenCodes.push(tokenCode);

            emit TokenAdded(tokenCode, tokenAddress, priceFeed);
        }
    }

    /**
     * @dev Fetches the latest price for a token based on its code.
     */
    function getTokenPrice(string memory tokenCode) external view returns (int256 price) {
        TokenInfo memory tokenInfo = tokenData[tokenCode];
        require(bytes(tokenInfo.tokenCode).length > 0, "Token code not found");

        AggregatorV3Interface priceFeed = AggregatorV3Interface(tokenInfo.priceFeed);
        (, price, , , ) = priceFeed.latestRoundData();
    }

    /**
     * @dev Fetches token info for a given code.
     */
    function getTokenInfo(string memory tokenCode) external view returns (TokenInfo memory) {
        require(bytes(tokenData[tokenCode].tokenCode).length > 0, "Token code not found");
        return tokenData[tokenCode];
    }

    /**
     * @dev Returns all stored token data.
     */
    function getAllTokenData() external view returns (TokenInfo[] memory) {
        TokenInfo[] memory allTokens = new TokenInfo[](tokenCodes.length);
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            allTokens[i] = tokenData[tokenCodes[i]];
        }
        return allTokens;
    }
}
